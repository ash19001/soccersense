/**
 * Accounts, as the page and the server agree on them (worker/accounts): what the server
 * says about who is signed in, and the check an email address has to pass before a link is
 * sent to it. Pure: both ends import it.
 *
 * An account is optional. It keeps a player's games on the server, so they are the same on
 * every device and can stand on a leaderboard; a player with no account keeps their own
 * games on their device and nothing about them is stored (docs/ARCHITECTURE.md section 8).
 * Signing in is by a link sent to an email address, or with Google: there are no passwords.
 */

import { QUESTION_COUNT, type Turn } from "./session";
import { MODES, type StorageLike, isTurn, resolveStorage } from "./storage";
import type { Mode } from "./types";

/** The longest address taken: the longest an address can be. */
export const EMAIL_MAX = 254;

export type EmailCheck = { ok: true; email: string } | { ok: false };

/** Something, an at sign, something with a dot in it: no spaces, one at sign. */
const EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

/**
 * An email address as typed, tidied (no spaces round it, lower case) and checked for the
 * shape of one. Whether anyone reads it is found out by sending the link.
 */
export function checkEmail(text: unknown): EmailCheck {
  if (typeof text !== "string") return { ok: false };
  const email = text.trim().toLowerCase();
  if (email.length > EMAIL_MAX || !EMAIL.test(email)) return { ok: false };
  return { ok: true, email };
}

/** The signed-in player, as their own page may see them. */
export interface AccountView {
  /** The name the leaderboards show for them. */
  nickname: string;
  email: string;
}

/** The ways of signing in the server has been set up for. */
export interface SignInWays {
  /** A link sent by email. */
  email: boolean;
  google: boolean;
  /**
   * The bot check's site key (Cloudflare Turnstile), where asking for a link needs it; null
   * where it is not set up. Not a secret: it is how the page shows the check.
   */
  check: string | null;
}

/** What `/api/account` says, and what every change to an account answers with. */
export interface AccountAnswer {
  /** Who is signed in on this device, or null. */
  account: AccountView | null;
  signIn: SignInWays;
}

const isBag = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function isAccountView(value: unknown): value is AccountView {
  return (
    isBag(value) &&
    typeof value.nickname === "string" &&
    value.nickname !== "" &&
    typeof value.email === "string"
  );
}

/** Whether something the server sent is an answer about the account. */
export function isAccountAnswer(value: unknown): value is AccountAnswer {
  return (
    isBag(value) &&
    (value.account === null || isAccountView(value.account)) &&
    isBag(value.signIn) &&
    typeof value.signIn.email === "boolean" &&
    typeof value.signIn.google === "boolean" &&
    (value.signIn.check === null ||
      (typeof value.signIn.check === "string" && value.signIn.check !== ""))
  );
}

// --- an account's games ------------------------------------------------------------------
//
// An account's finished games are kept by the server (worker/games), with the games each of
// its devices played before it signed in. A signed-in device swaps them with the server
// (POST /api/account/history), so its streak, stats, scores and reviews are the account's
// on every device: the server sends the games the device does not have, and the device
// sends the ones the server does not have.

/** One finished game, as a device and the server swap them. */
export interface HistoryGame {
  /** The game day (`dayNumber`): day 1 is 2026-11-10. */
  day: number;
  mode: Mode;
  total: number;
  turns: Turn[];
  /** What each question asked, one per turn; null where that is not known. */
  prompts: string[] | null;
}

/** A finished game a device has: its day, its mode and its total. */
export type HistoryKey = [day: number, mode: Mode, total: number];

/** What `POST /api/account/history` answers. */
export interface HistoryAnswer {
  /** The account's games the device does not have, or has with another total. */
  games: HistoryGame[];
  /** The device's games the server does not have: it is to send them. */
  want: [day: number, mode: Mode][];
  /** How many of the games the device sent were kept. */
  saved: number;
}

/** The most games sent in one request, either way round. */
export const HISTORY_BATCH = 100;
/** The longest piece of text a game kept for an account may hold: a typed answer, a name. */
export const HISTORY_TEXT_MAX = 200;
/** The longest question kept with it. */
export const HISTORY_PROMPT_MAX = 300;

const short = (value: unknown, most: number): boolean =>
  value === null ||
  value === undefined ||
  (typeof value === "string" && value.length <= most);

/**
 * Whether something is a whole finished game: seven turns of the right kind, a total that is
 * their sum, and nothing longer than a game holds. A game a device sends is taken on its
 * word for its own streak and stats (never for a leaderboard), but nothing else is stored.
 */
export function isHistoryGame(value: unknown): value is HistoryGame {
  if (!isBag(value)) return false;
  const { day, mode, total, turns, prompts } = value;
  return (
    typeof day === "number" &&
    Number.isInteger(day) &&
    day >= 1 &&
    MODES.includes(mode as Mode) &&
    Array.isArray(turns) &&
    turns.length === QUESTION_COUNT &&
    turns.every(
      (turn) =>
        isTurn(turn) &&
        turn.questionId.length <= HISTORY_TEXT_MAX &&
        short(turn.answerId, HISTORY_TEXT_MAX) &&
        short(turn.input, HISTORY_TEXT_MAX) &&
        short(turn.name, HISTORY_TEXT_MAX),
    ) &&
    typeof total === "number" &&
    total === (turns as Turn[]).reduce((sum, turn) => sum + turn.points, 0) &&
    (prompts === null ||
      (Array.isArray(prompts) &&
        prompts.length === turns.length &&
        prompts.every(
          (prompt) => short(prompt, HISTORY_PROMPT_MAX) && prompt !== null,
        )))
  );
}

/** Whether something is what `POST /api/account/history` answers. */
export function isHistoryAnswer(value: unknown): value is HistoryAnswer {
  return (
    isBag(value) &&
    Array.isArray(value.games) &&
    value.games.every(isHistoryGame) &&
    Array.isArray(value.want) &&
    value.want.every(
      (key) =>
        Array.isArray(key) &&
        typeof key[0] === "number" &&
        MODES.includes(key[1] as Mode),
    ) &&
    typeof value.saved === "number"
  );
}

/**
 * Why the server would not do what was asked of an account, as the page shows it. The
 * server's own codes are in worker/accounts/api.ts; anything else is `failed`.
 * - `bad_email`: not an address.
 * - `bot_check`: the check that a person is asking (Cloudflare Turnstile) did not pass.
 * - `too_many`: links have just been sent to that address; wait a little.
 * - `not_set_up`: that way of signing in is not switched on.
 * - `bad_link`: the link has been used, has run out, or is not one of ours.
 * - `signed_out`: nobody is signed in on this device (any more).
 * - `bad_name`, `taken`: the nickname cannot be used; somebody has it.
 * - `failed`: the server could not be reached, or something went wrong there.
 */
export type AccountProblem =
  | "bad_email"
  | "bot_check"
  | "too_many"
  | "not_set_up"
  | "bad_link"
  | "signed_out"
  | "bad_name"
  | "taken"
  | "failed";

export const ACCOUNT_PROBLEMS: readonly AccountProblem[] = [
  "bad_email",
  "bot_check",
  "too_many",
  "not_set_up",
  "bad_link",
  "signed_out",
  "bad_name",
  "taken",
  "failed",
];

// --- what a device keeps -----------------------------------------------------------------
//
// The cookie that signs a device in cannot be read by the page (worker/accounts/session.ts),
// so the page keeps its own note of who the server last said is signed in. It is only a
// note: the server decides. With it the page knows, before asking, to ask (a player with
// no account is never asked about), and the game page knows to take its game from the
// server and not start one of its own. Like `./storage`, safe to call anywhere.

export const ACCOUNT_KEY = "soccersense:v1:account";

/** Who the server last said is signed in on this device, or null. */
export function loadAccount(storage?: StorageLike | null): AccountView | null {
  try {
    const raw = resolveStorage(storage)?.getItem(ACCOUNT_KEY) ?? null;
    if (raw === null) return null;
    const value: unknown = JSON.parse(raw);
    return isAccountView(value)
      ? { nickname: value.nickname, email: value.email }
      : null;
  } catch {
    return null;
  }
}

/** Notes who is signed in on this device; null takes the note away. */
export function saveAccount(
  account: AccountView | null,
  storage?: StorageLike | null,
): void {
  try {
    const store = resolveStorage(storage);
    if (!store) return;
    if (account === null) store.removeItem(ACCOUNT_KEY);
    else {
      store.setItem(
        ACCOUNT_KEY,
        JSON.stringify({ nickname: account.nickname, email: account.email }),
      );
    }
  } catch {
    // nothing can be kept: the server still knows
  }
}

/**
 * A sign-in link was asked for from this browser. The page the link opens signs in at once
 * where it finds this note, and asks for a press where it does not (another device, or a
 * mail scanner opening the link: worker/accounts/api.ts).
 */
export const LINK_ASKED_KEY = "soccersense:v1:signin";
/** How long the note counts: a little longer than a link works. */
export const LINK_ASKED_MS = 20 * 60 * 1000;

export function noteLinkAsked(now: number, storage?: StorageLike | null): void {
  try {
    resolveStorage(storage)?.setItem(LINK_ASKED_KEY, String(Math.round(now)));
  } catch {
    // the link's page will ask for a press
  }
}

/** Whether a link was asked for from this browser in the last while. */
export function linkAsked(now: number, storage?: StorageLike | null): boolean {
  try {
    const at = Number(resolveStorage(storage)?.getItem(LINK_ASKED_KEY));
    return (
      Number.isFinite(at) && at > 0 && now - at >= 0 && now - at < LINK_ASKED_MS
    );
  } catch {
    return false;
  }
}

export function forgetLinkAsked(storage?: StorageLike | null): void {
  try {
    resolveStorage(storage)?.removeItem(LINK_ASKED_KEY);
  } catch {
    // nothing to forget
  }
}
