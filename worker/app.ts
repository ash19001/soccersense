/**
 * The Worker's requests: `/api/...` is answered here, and everything else is the built site
 * (wrangler.jsonc sends only `/api/*` to the Worker first; the rest never gets here).
 *
 *   GET /api/today    the day by the server: the time, the day's number and key, how long
 *                     until the next day, and where the day's questions come from
 *   GET /api/health   whether the Worker and its database are up: for a look after a deploy
 *   /api/games/...    the games the server runs: questions out, answers judged (./games/play.ts)
 *   /api/account/...  accounts: signing in and out, the nickname (./accounts/api.ts)
 *   GET /api/leaderboard?day=<n>   the day's boards: accounts only (./games/board.ts)
 *   /api/admin/...    the approval desk for the day's questions (./questions/admin.ts)
 *
 * `now` is handed in, so every answer is a pure function of the request, the settings, the
 * database and the time. `outside` is how the Worker reaches other services (the email
 * service, Google): `fetch`, unless a test hands in its own.
 *
 * A request that changes something must come from this site's own pages (`fromThisSite`):
 * another site's page cannot play a signed-in player's game or sign them in or out.
 */

import { dayKeyFor, dayNumber, msUntilNextDay } from "~/game/day";

import { account, fromThisSite, signedIn } from "./accounts/api";
import { SCHEMA_VERSION, database } from "./db/migrate";
import {
  type Env,
  type Outside,
  type QuestionSource,
  questionSource,
} from "./env";
import { leaderboard } from "./games/board";
import { games } from "./games/play";
import { failure, json, wrongMethod } from "./http";
import { admin } from "./questions/admin";

/** What `/api/today` says. */
export interface TodayAnswer {
  /** Milliseconds since 1970, by the server. */
  now: number;
  /** The day's number (1 is the first day of the game) and its date, "2026-11-17", in UTC. */
  day: number;
  dayKey: string;
  /** Milliseconds until the next day starts (midnight UTC). */
  nextDayIn: number;
  questions: QuestionSource;
}

export function todayAnswer(
  env: Pick<Env, "QUESTIONS">,
  now: number,
): TodayAnswer {
  const date = new Date(now);
  const day = dayNumber(date);
  return {
    now: Math.round(now),
    day,
    dayKey: dayKeyFor(day),
    nextDayIn: msUntilNextDay(date),
    questions: questionSource(env),
  };
}

/** What `/api/health` says. */
export interface HealthAnswer {
  ok: boolean;
  /** The database's migration number, or null if there is no database or it is failing. */
  db: number | null;
  /** The number the code expects it to be at. */
  schema: number;
  questions: QuestionSource;
}

async function health(env: Env, now: number, head: boolean): Promise<Response> {
  let db: number | null = null;
  if (env.DB) {
    try {
      db = await database(env.DB, now);
    } catch {
      db = null;
    }
  }
  const ok = db === SCHEMA_VERSION;
  const body: HealthAnswer = {
    ok,
    db,
    schema: SCHEMA_VERSION,
    questions: questionSource(env),
  };
  return json(body, now, { status: ok ? 200 : 503, head });
}

const READ: readonly string[] = ["GET", "HEAD"];

/** Answers one request. */
export async function handle(
  request: Request,
  env: Env,
  now: number,
  outside: Outside = (url, init) => fetch(url, init),
): Promise<Response> {
  const { pathname } = new URL(request.url);
  if (pathname !== "/api" && !pathname.startsWith("/api/")) {
    return env.ASSETS.fetch(request);
  }
  const route = pathname.slice(4).replace(/\/+$/, "");
  const head = request.method === "HEAD";
  if (!READ.includes(request.method) && !fromThisSite(request)) {
    return failure("forbidden", 403, now);
  }
  try {
    if (route === "/today") {
      return (
        wrongMethod(request, READ, now) ??
        json(todayAnswer(env, now), now, { head })
      );
    }
    if (route === "/health") {
      return wrongMethod(request, READ, now) ?? (await health(env, now, head));
    }
    if (route === "/games" || route.startsWith("/games/")) {
      // An account's game is kept in the database; anyone else keeps their own.
      const player = await signedIn(request, env, now);
      // A script sending moves over and over: stopped for the rest of the minute. Counted
      // in Cloudflare's memory, never kept. An account is counted by itself (players who
      // share a connection, at a school or behind a phone network, are not added up),
      // anyone else by their connection.
      if (env.GAME_LIMIT) {
        const key = player
          ? `account:${player.id}`
          : `address:${request.headers.get("cf-connecting-ip") ?? "unknown"}`;
        const { success } = await env.GAME_LIMIT.limit({ key });
        if (!success) {
          const refused = failure("too_many", 429, now);
          refused.headers.set("retry-after", "60");
          return refused;
        }
      }
      return await games(
        request,
        env,
        now,
        route,
        player?.id ?? null,
        // an account taken off the leaderboards plays, and is not counted
        player?.bannedAt == null,
      );
    }
    if (route === "/leaderboard") {
      const player = await signedIn(request, env, now);
      // An account taken off the leaderboards is told where it would have placed, as a
      // player with no account is.
      return await leaderboard(
        request,
        env,
        now,
        player && player.bannedAt === null ? player.id : null,
      );
    }
    if (route === "/account" || route.startsWith("/account/")) {
      return await account(request, env, now, route, outside);
    }
    if (route === "/admin" || route.startsWith("/admin/")) {
      return await admin(request, env, now, route);
    }
    return failure("not_found", 404, now);
  } catch {
    return failure("server_error", 500, now);
  }
}
