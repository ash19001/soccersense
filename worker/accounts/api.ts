/**
 * Accounts: `/api/account`. An account is optional: it keeps a player's games on the
 * server (worker/games), the same on every device and fit to stand on a leaderboard.
 * Signing in is by a link sent to an email address or with Google; there are no passwords.
 *
 *   GET  /api/account                  who is signed in on this device, and which ways of
 *                                      signing in are set up: { account, signIn }
 *   POST /api/account/link    { email, check? }  send a sign-in link to the address:
 *                                           { sent }. `check`: the bot check's token
 *                                           (./check.ts), where there is a check
 *   POST /api/account/enter   { token }     use a link's token: signs the device in
 *   GET  /api/account/google                off to Google to pick an account ...
 *   GET  /api/account/google/callback       ... and back: signs the device in, then /enter
 *   POST /api/account/name    { nickname }  change the account's nickname
 *   POST /api/account/leave                 sign this device out
 *   POST /api/account/delete                delete the account and everything kept for it
 *   POST /api/account/history { have?, give? }  swap finished games with this device: the
 *                                           account's it lacks, and which of its own the
 *                                           account wants (`HistoryAnswer`, ~/game/account)
 *
 * Signing in with an address that has no account makes one, named `soccerfan` and the next
 * number. An address is one account however it is reached: the link and Google both prove
 * the address is the person's.
 *
 * A device is signed in by a cookie (./session.ts). Only accounts have one: a player with
 * no account is never given a cookie, and `GET /api/account` without one answers without
 * touching the database.
 *
 * Errors are `{ error }`: `bad_request`, `bad_email`, `bot_check` (the bot check did not
 * pass), `too_many` (links have just been
 * sent to that address, or asked for from that connection), `not_set_up` (that way of
 * signing in has no key yet), `failed` (the email could not be sent), `bad_link` (used,
 * run out, or not ours), `signed_out`, `bad_name` (with `problem`), `taken`.
 */

import {
  type AccountAnswer,
  HISTORY_BATCH,
  type HistoryAnswer,
  type HistoryGame,
  type SignInWays,
  checkEmail,
  isHistoryGame,
} from "~/game/account";
import { dayNumber } from "~/game/day";
import { HISTORY_DAYS, MODES } from "~/game/storage";
import type { Mode } from "~/game/types";

import { database } from "../db/migrate";
import type { D1, Env, Outside } from "../env";
import { finishedGames, importGames } from "../games/store";
import { API_HEADERS, failure, json, wrongMethod } from "../http";
import { checkSiteKey, passesCheck } from "./check";
import { googlePerson, googleReady, googleStart, tripParts } from "./google";
import { mailReady, sendMail, signInMail } from "./mail";
import { checkAccountName } from "./names";
import {
  SESSION_RENEW_MS,
  googleTrip,
  googleTripCookie,
  noGoogleTripCookie,
  noSessionCookie,
  sessionCookie,
  sessionToken,
} from "./session";
import {
  type Account,
  LINK_KEPT_MS,
  LINK_LIFE_MS,
  accountByEmail,
  accountByGoogle,
  createAccount,
  createLink,
  createSession,
  deleteAccount,
  dropLink,
  endSession,
  linkGoogle,
  linksSince,
  rename,
  renewSession,
  sessionOf,
  spendLink,
} from "./store";
import { isToken } from "./tokens";

/** The most links sent to one address in the time a link works. */
export const LINKS_PER_EMAIL = 3;
/** The most links sent in a day, to everyone: a stop on the email bill, and on abuse. */
export const MAX_LINKS_A_DAY = 2000;
/** The most a request here may carry; a history's, a batch of games. */
const MAX_BODY = 6000;
const MAX_HISTORY_BODY = 1_000_000;

/** The page the emailed link opens, and where a trip to Google ends (app/routes/enter.tsx). */
const ENTER = "/enter";

const READ: readonly string[] = ["GET", "HEAD"];

const isLocalHost = (hostname: string): boolean =>
  hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";

/**
 * Whether the Worker is running on a developer's own machine (`pnpm api`): plain HTTP to
 * this machine's own address. The live site is only ever HTTPS at its own name.
 */
export const isLocal = (request: Request): boolean => {
  const url = new URL(request.url);
  return url.protocol === "http:" && isLocalHost(url.hostname);
};

/**
 * Whether a request that changes something comes from this site's own pages. A browser
 * says where every such request is from (`Origin`); another site's page cannot leave it
 * out or change it. A request with none is not a page's (a script, the drafting tool).
 * On a developer's machine the pages are on another port, or another device on the
 * network, so anything is taken there.
 */
export function fromThisSite(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (origin === null) return true;
  const here = new URL(request.url);
  if (here.protocol === "http:" && isLocalHost(here.hostname)) return true;
  try {
    return new URL(origin).host === here.host;
  } catch {
    return false;
  }
}

/** The site's address as the player's browser has it: where an emailed link leads. */
function siteOf(request: Request): string {
  const origin = request.headers.get("origin");
  if (origin !== null && fromThisSite(request)) {
    try {
      return new URL(origin).origin;
    } catch {
      // not an address: the request's own
    }
  }
  return new URL(request.url).origin;
}

const callbackOf = (request: Request): string =>
  `${new URL(request.url).origin}/api/account/google/callback`;

/** The ways of signing in that are set up. */
export function signInWays(env: Env, request: Request): SignInWays {
  return {
    // With no key, a developer's own machine writes the link to its log (./mail.ts).
    email: mailReady(env) || isLocal(request),
    google: googleReady(env),
    check: checkSiteKey(env),
  };
}

/**
 * The account the request is signed in to, or null. With no session cookie (every player
 * with no account) the database is not touched.
 */
export async function signedIn(
  request: Request,
  env: Env,
  now: number,
): Promise<Account | null> {
  const token = sessionToken(request);
  if (!isToken(token) || !env.DB) return null;
  await database(env.DB, now);
  return (await sessionOf(env.DB, token, now))?.account ?? null;
}

async function bagOf(
  request: Request,
  most = MAX_BODY,
): Promise<Record<string, unknown> | null> {
  try {
    const text = await request.text();
    if (text.length > most) return null;
    const bag: unknown = text.trim() === "" ? {} : JSON.parse(text);
    if (typeof bag !== "object" || bag === null || Array.isArray(bag)) {
      return null;
    }
    return bag as Record<string, unknown>;
  } catch {
    return null;
  }
}

function redirect(location: string, cookies: readonly string[]): Response {
  const response = new Response(null, {
    status: 302,
    headers: { ...API_HEADERS, location },
  });
  for (const cookie of cookies) response.headers.append("set-cookie", cookie);
  return response;
}

/** Answers a request under `/api/account`. `route` is the path after `/api`. */
export async function account(
  request: Request,
  env: Env,
  now: number,
  route: string,
  outside: Outside,
): Promise<Response> {
  const path = route.slice("/account".length) || "/";

  const answer = (who: Account | null, cookie?: string): Response => {
    const body: AccountAnswer = {
      account: who ? { nickname: who.nickname, email: who.email } : null,
      signIn: signInWays(env, request),
    };
    const response = json(body, now, { head: request.method === "HEAD" });
    if (cookie) response.headers.append("set-cookie", cookie);
    return response;
  };

  /** The database, brought up to date; null where there is none. */
  const open = async (): Promise<D1 | null> => {
    if (!env.DB) return null;
    await database(env.DB, now);
    return env.DB;
  };

  /** Signs this device in to an account, and out of any it was signed in to. */
  const enter = async (db: D1, who: Account): Promise<string> => {
    const old = sessionToken(request);
    if (isToken(old)) await endSession(db, old);
    return sessionCookie(request, await createSession(db, who.id, now));
  };

  if (path === "/") {
    const refused = wrongMethod(request, READ, now);
    if (refused) return refused;
    const token = sessionToken(request);
    if (token === null) return answer(null);
    const db = isToken(token) ? await open() : null;
    const found = db && isToken(token) ? await sessionOf(db, token, now) : null;
    if (!db || !found || !isToken(token)) {
      return answer(null, noSessionCookie(request));
    }
    if (found.expiresAt - now < SESSION_RENEW_MS) {
      await renewSession(db, token, now);
      return answer(found.account, sessionCookie(request, token));
    }
    return answer(found.account);
  }

  // --- Google: two page loads, not requests from the page --------------------------------

  if (path === "/google") {
    const refused = wrongMethod(request, READ, now);
    if (refused) return refused;
    if (!googleReady(env)) return redirect(`${ENTER}#failed`, []);
    const { url, trip } = await googleStart(env, callbackOf(request));
    return redirect(url, [googleTripCookie(request, trip)]);
  }

  if (path === "/google/callback") {
    const refused = wrongMethod(request, READ, now);
    if (refused) return refused;
    const failed = () =>
      redirect(`${ENTER}#failed`, [noGoogleTripCookie(request)]);
    const query = new URL(request.url).searchParams;
    const code = query.get("code");
    const trip = tripParts(googleTrip(request));
    // The way back must belong to a trip this browser started.
    if (
      !googleReady(env) ||
      !code ||
      !trip ||
      trip.state !== query.get("state")
    ) {
      return failed();
    }
    const db = await open();
    if (!db) return failed();
    const person = await googlePerson(
      env,
      code,
      trip.verifier,
      callbackOf(request),
      now,
      outside,
    );
    if (!person) return failed();
    let who =
      (await accountByGoogle(db, person.id)) ??
      (await accountByEmail(db, person.email));
    if (who && who.googleId === null) {
      await linkGoogle(db, who.id, person.id, now);
    }
    who ??= await createAccount(
      db,
      { email: person.email, googleId: person.id },
      now,
    );
    return redirect(`${ENTER}#google`, [
      await enter(db, who),
      noGoogleTripCookie(request),
    ]);
  }

  // --- everything else is a request from the page ----------------------------------------

  const known = ["/link", "/enter", "/name", "/leave", "/delete", "/history"];
  if (!known.includes(path)) return failure("not_found", 404, now);
  const refused = wrongMethod(request, ["POST"], now);
  if (refused) return refused;
  const body = await bagOf(
    request,
    path === "/history" ? MAX_HISTORY_BODY : MAX_BODY,
  );
  if (!body) return failure("bad_request", 400, now);

  if (path === "/link") {
    const checked = checkEmail(body.email);
    if (!checked.ok) return failure("bad_email", 400, now);
    const { email } = checked;
    if (!signInWays(env, request).email) return failure("not_set_up", 503, now);
    // One connection asking again and again, whatever the addresses: counted for a minute
    // in Cloudflare's memory, never kept.
    const ip = request.headers.get("cf-connecting-ip");
    if (env.SIGN_IN_LIMIT) {
      const { success } = await env.SIGN_IN_LIMIT.limit({
        key: ip ?? "unknown",
      });
      if (!success) return failure("too_many", 429, now);
    }
    // A person, not a script: where the check is set up, its token must pass.
    if (
      checkSiteKey(env) !== null &&
      !(await passesCheck(env, body.check, ip, outside))
    ) {
      return failure("bot_check", 403, now);
    }
    const db = await open();
    if (!db) return failure("no_database", 503, now);
    if ((await linksSince(db, now - LINK_LIFE_MS, email)) >= LINKS_PER_EMAIL) {
      return failure("too_many", 429, now);
    }
    if ((await linksSince(db, now - LINK_KEPT_MS)) >= MAX_LINKS_A_DAY) {
      return failure("failed", 503, now);
    }
    const token = await createLink(db, email, now);
    // The token is after the "#": a browser never sends that part to a server, so it is
    // in nobody's logs, and a mail scanner that fetches the address uses nothing up.
    const link = `${siteOf(request)}${ENTER}#${token}`;
    if (mailReady(env)) {
      if (!(await sendMail(env, signInMail(email, link), outside))) {
        await dropLink(db, token);
        return failure("failed", 502, now);
      }
    } else {
      // Only on a developer's own machine (`signInWays`).
      console.log(
        `[account] no email key: the sign-in link for ${email} is ${link}`,
      );
    }
    return json({ sent: true }, now);
  }

  const db = await open();
  if (!db) return failure("no_database", 503, now);

  if (path === "/enter") {
    const email = isToken(body.token)
      ? await spendLink(db, body.token, now)
      : null;
    if (email === null) return failure("bad_link", 400, now);
    const who =
      (await accountByEmail(db, email)) ??
      (await createAccount(db, { email, googleId: null }, now));
    return answer(who, await enter(db, who));
  }

  // The rest are for whoever is signed in.
  const token = sessionToken(request);
  const who = isToken(token)
    ? ((await sessionOf(db, token, now))?.account ?? null)
    : null;
  if (!who || !isToken(token)) {
    const response = failure("signed_out", 401, now);
    if (token !== null) {
      response.headers.append("set-cookie", noSessionCookie(request));
    }
    return response;
  }

  if (path === "/name") {
    const checked = checkAccountName(body.nickname, who.nickname);
    if (!checked.ok) {
      return json({ error: "bad_name", problem: checked.problem }, now, {
        status: 400,
      });
    }
    if (!(await rename(db, who.id, checked.name, now))) {
      return failure("taken", 409, now);
    }
    return answer({ ...who, nickname: checked.name });
  }

  if (path === "/leave") {
    await endSession(db, token);
    return answer(null, noSessionCookie(request));
  }

  if (path === "/history") {
    return json(await history(db, who.id, body, now), now);
  }

  // "/delete"
  await deleteAccount(db, who);
  return answer(null, noSessionCookie(request));
}

const isModeKey = (value: unknown): value is Mode =>
  MODES.includes(value as Mode);

/**
 * Swaps finished games with a device (`POST /api/account/history`). The device says which
 * it has (`have`: day, mode and total of each) and may send games the server wants
 * (`give`, at most `HISTORY_BATCH` at a time). Games it sends are kept as `device` games
 * where the account has none for that day and mode; then the answer is the account's
 * games the device lacks or holds with another total (the account's win), and which of
 * the device's the account lacks. Only the year up to today counts, as on the device.
 * Without `have` the answer is only what was kept.
 */
async function history(
  db: D1,
  accountId: string,
  body: Record<string, unknown>,
  now: number,
): Promise<HistoryAnswer> {
  const today = dayNumber(new Date(now));
  const from = today - HISTORY_DAYS + 1;
  const inYear = (day: unknown): day is number =>
    typeof day === "number" &&
    Number.isInteger(day) &&
    day >= from &&
    day <= today;

  const given: HistoryGame[] = (Array.isArray(body.give) ? body.give : [])
    .slice(0, HISTORY_BATCH)
    .filter(isHistoryGame)
    .filter((game) => inYear(game.day))
    .map((game) => ({
      day: game.day,
      mode: game.mode,
      total: game.total,
      turns: game.turns,
      prompts: game.prompts,
    }));
  const saved = await importGames(db, accountId, given, now);

  if (!Array.isArray(body.have)) return { games: [], want: [], saved };
  const held = new Map<string, number>();
  for (const key of body.have.slice(0, HISTORY_DAYS * MODES.length)) {
    if (!Array.isArray(key)) continue;
    const [day, mode, total] = key as unknown[];
    if (!inYear(day) || !isModeKey(mode) || typeof total !== "number") continue;
    held.set(`${day}:${mode}`, total);
  }
  const games = await finishedGames(db, accountId, from);
  const ours = new Set(games.map((game) => `${game.day}:${game.mode}`));
  return {
    games: games.filter(
      (game) => held.get(`${game.day}:${game.mode}`) !== game.total,
    ),
    want: [...held.keys()]
      .filter((key) => !ours.has(key))
      .map((key) => {
        const [day, mode] = key.split(":");
        return [Number(day), mode as Mode];
      }),
    saved,
  };
}
