/**
 * Accounts: `/api/account`. An account is optional: it keeps a player's games, streak and
 * stats the same on every device. Signing in is by a link sent to an email address or with
 * Google; there are no passwords.
 *
 * Every player who plays is kept by the server (the product owner, 2026-11-18: players with
 * no account on the leaderboards, their answers counted, only their stats and streak on the
 * device). A player with no account is a guest: an account with no address, made at their
 * first game (worker/app.ts) or when they first change their name (`/name`), and kept by
 * the same cookie as an account. Signing in gives the guest an address, so it becomes the
 * account; or, where the address has an account already, brings the guest's games into it.
 *
 *   GET  /api/account                  who plays on this device, and which ways of signing
 *                                      in are set up: { account, player, signIn }.
 *                                      `account`: someone signed in; `player`: the name
 *                                      the server keeps for whoever plays here, guest or
 *                                      account, or null before their first game
 *   POST /api/account/link    { email, check? }  send a sign-in link to the address:
 *                                           { sent }. `check`: the bot check's token
 *                                           (./check.ts), where there is a check
 *   POST /api/account/enter   { token }     use a link's token: signs the device in
 *   GET  /api/account/google                off to Google to pick an account ...
 *   GET  /api/account/google/callback       ... and back: signs the device in, then /enter
 *   POST /api/account/name    { nickname, check? }  change the player's nickname (a player
 *                                           with no game yet becomes a guest, with that
 *                                           name: `check` is the bot check's token)
 *   POST /api/account/leave                 sign this device out
 *   POST /api/account/delete                delete the account (or guest) and everything
 *                                           kept for it
 *   POST /api/account/history { have?, give? }  swap finished games with this device: the
 *                                           account's it lacks, and which of its own the
 *                                           account wants (`HistoryAnswer`, ~/game/account)
 *
 * Signing in with an address that has no account makes one, named `soccerfan` and the next
 * number. An address is one account however it is reached: the link and Google both prove
 * the address is the person's.
 *
 * A device is known by a cookie (./session.ts), an account's or a guest's. A visitor who
 * has not played has none, and `GET /api/account` without one answers without touching
 * the database.
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
import { nicknameKey } from "~/game/nickname";
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
  GUEST_SESSION_LIFE_MS,
  googleTrip,
  needsRenewing,
  sessionLife,
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
  adoptGuest,
  createAccount,
  createGuest,
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
  upgradeGuest,
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
 * The player the request comes from, an account or a guest (`email` null), or null. With
 * no session cookie (a visitor who has not played) the database is not touched.
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

/**
 * Whether one more new player may be made for this request now (the product owner,
 * 2026-11-18: "yes add both protections"):
 *
 * - **the new-player limit** (`NEW_PLAYER_LIMIT`, wrangler.jsonc): ten a minute from one
 *   connection, counted in Cloudflare's memory and never kept. A script making player after
 *   player from one machine is held to a trickle; a person never meets it.
 * - **the bot check** (Turnstile, ./check.ts), where it is set up: `check` is a token from
 *   the widget the page runs before a first game, and Turnstile must say it is good. A
 *   script spread over many connections is stopped here.
 */
async function mayMakePlayer(
  request: Request,
  env: Env,
  check: unknown,
  outside: Outside,
): Promise<"yes" | "too_many" | "bot_check"> {
  const address = request.headers.get("cf-connecting-ip");
  if (env.NEW_PLAYER_LIMIT) {
    const { success } = await env.NEW_PLAYER_LIMIT.limit({
      key: address ?? "unknown",
    });
    if (!success) return "too_many";
  }
  if (
    checkSiteKey(env) !== null &&
    !(await passesCheck(env, check, address, outside))
  ) {
    return "bot_check";
  }
  return "yes";
}

/**
 * A new guest for a device that has no player, as its first game starts (worker/app.ts):
 * the guest and the `Set-Cookie` that keeps it on the device. `wish`: the name the device
 * has been showing, taken where the server would take it from a player and it is free;
 * else the next soccerfan number (a soccerfan name on a device was made up there). `check`:
 * the bot check's token, where there is a check (`mayMakePlayer`). Null where there is no
 * database, the connection has made too many players just now, or the check did not pass:
 * the game is then the player's own, as it was before (a ticket, ../games/ticket.ts), kept
 * nowhere, on no board and not counted.
 */
export async function newGuest(
  request: Request,
  env: Env,
  now: number,
  wish: unknown,
  check: unknown,
  outside: Outside,
): Promise<{ player: Account; cookie: string } | null> {
  if (!env.DB) return null;
  if ((await mayMakePlayer(request, env, check, outside)) !== "yes") {
    return null;
  }
  await database(env.DB, now);
  const checked = checkAccountName(wish, "");
  const player = await createGuest(
    env.DB,
    checked.ok ? checked.name : null,
    now,
  );
  const token = await createSession(
    env.DB,
    player.id,
    now,
    GUEST_SESSION_LIFE_MS,
  );
  return {
    player,
    cookie: sessionCookie(request, token, GUEST_SESSION_LIFE_MS),
  };
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
      account:
        who && who.email !== null
          ? { nickname: who.nickname, email: who.email }
          : null,
      player: who ? { nickname: who.nickname } : null,
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
    const life = sessionLife(who);
    return sessionCookie(
      request,
      await createSession(db, who.id, now, life),
      life,
    );
  };

  /** The guest this device plays as, if it is one. */
  const guestHere = async (db: D1): Promise<Account | null> => {
    const token = sessionToken(request);
    if (!isToken(token)) return null;
    const found = (await sessionOf(db, token, now))?.account ?? null;
    return found && found.email === null ? found : null;
  };

  /**
   * The account an address (and Google's id, with Google) signs in to. A guest playing on
   * this device comes too: it becomes the account where the address has none, with its
   * name and games; else its games are brought into the account the address has.
   */
  const accountFor = async (
    db: D1,
    person: { email: string; googleId: string | null },
  ): Promise<Account> => {
    let who =
      (person.googleId === null
        ? null
        : await accountByGoogle(db, person.googleId)) ??
      (await accountByEmail(db, person.email));
    if (who && person.googleId !== null && who.googleId === null) {
      await linkGoogle(db, who.id, person.googleId, now);
    }
    const guest = await guestHere(db);
    if (guest && !who) {
      const became = await upgradeGuest(db, guest, person, now);
      if (became) return became;
      // The address has had an account made in the same moment.
      who = await accountByEmail(db, person.email);
    }
    if (guest && who) await adoptGuest(db, guest, who);
    return who ?? (await createAccount(db, person, now));
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
    const life = sessionLife(found.account);
    if (needsRenewing(found.expiresAt, now, life)) {
      await renewSession(db, token, now, life);
      return answer(found.account, sessionCookie(request, token, life));
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
    const who = await accountFor(db, {
      email: person.email,
      googleId: person.id,
    });
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
    const who = await accountFor(db, { email, googleId: null });
    return answer(who, await enter(db, who));
  }

  // The rest are for whoever plays on this device: an account, or a guest.
  const token = sessionToken(request);
  const who = isToken(token)
    ? ((await sessionOf(db, token, now))?.account ?? null)
    : null;

  // A name chosen before a first game: the player is made, with it.
  if (path === "/name" && !who) {
    const checked = checkAccountName(body.nickname, "");
    if (!checked.ok) {
      return json({ error: "bad_name", problem: checked.problem }, now, {
        status: 400,
      });
    }
    const taken = await db
      .prepare("SELECT 1 AS taken FROM accounts WHERE nickname_key = ?")
      .bind(nicknameKey(checked.name))
      .first();
    if (taken) return failure("taken", 409, now);
    const may = await mayMakePlayer(request, env, body.check, outside);
    if (may === "too_many") return failure("too_many", 429, now);
    if (may === "bot_check") return failure("bot_check", 403, now);
    const guest = await createGuest(db, checked.name, now);
    const made = sessionCookie(
      request,
      await createSession(db, guest.id, now, GUEST_SESSION_LIFE_MS),
      GUEST_SESSION_LIFE_MS,
    );
    // Taken in the same moment: the guest has the next soccerfan name instead.
    if (guest.nickname !== checked.name) {
      const response = failure("taken", 409, now);
      response.headers.append("set-cookie", made);
      return response;
    }
    return answer(guest, made);
  }

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
    // A guest's streak and stats are its device's own: nothing to swap.
    if (who.email === null) {
      const none: HistoryAnswer = { games: [], want: [], saved: 0 };
      return json(none, now);
    }
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
