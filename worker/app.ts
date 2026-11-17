/**
 * The Worker's requests: `/api/...` is answered here, and everything else is the built site
 * (wrangler.jsonc sends only `/api/*` to the Worker first; the rest never gets here).
 *
 *   GET /api/today    the day by the server: the time, the day's number and key, how long
 *                     until the next day, and where the day's questions come from
 *   GET /api/health   whether the Worker and its database are up: for a look after a deploy
 *   /api/admin/...    the approval desk for the day's questions (./questions/admin.ts)
 *
 * `now` is handed in, so every answer is a pure function of the request, the settings, the
 * database and the time.
 */

import { dayKeyFor, dayNumber, msUntilNextDay } from "~/game/day";

import { SCHEMA_VERSION, database } from "./db/migrate";
import { type Env, type QuestionSource, questionSource } from "./env";
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
): Promise<Response> {
  const { pathname } = new URL(request.url);
  if (pathname !== "/api" && !pathname.startsWith("/api/")) {
    return env.ASSETS.fetch(request);
  }
  const route = pathname.slice(4).replace(/\/+$/, "");
  const head = request.method === "HEAD";
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
    if (route === "/admin" || route.startsWith("/admin/")) {
      return await admin(request, env, now, route);
    }
    return failure("not_found", 404, now);
  } catch {
    return failure("server_error", 500, now);
  }
}
