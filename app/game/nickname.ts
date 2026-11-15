import { type StorageLike, resolveStorage } from "./storage";

/**
 * The player's nickname: the name the leaderboards show for them. Every player gets one on
 * their first visit, `soccerfan` and a number (`fanNickname`), and can change it. It is kept
 * on the device in local storage under `NICKNAME_KEY`. The number is random for now: only a
 * backend can hand out the next one in order and so promise no two players share a name
 * (docs/ARCHITECTURE.md section 8).
 *
 * Like `./storage`, every function here is safe to call anywhere: when storage is missing,
 * blocked, full or holding junk, reads return null and writes do nothing. Nothing touches
 * storage at import time.
 */

export const NICKNAME_KEY = "soccersense:v1:nickname";
/** The shortest nickname. */
export const NICKNAME_MIN = 3;
/** The longest: what the leaderboard's name column fits (`soccerfan` and four digits). */
export const NICKNAME_MAX = 13;

/** What every first nickname starts with. */
export const FAN_PREFIX = "soccerfan";
/** The numbers of the first nicknames for now: four digits, `FAN_FIRST` to `FAN_LAST`. */
export const FAN_FIRST = 1000;
export const FAN_LAST = 9999;

/**
 * A first nickname: `soccerfan` and the number ("soccerfan4821"). The number is a whole number
 * from 1 up (a backend's counter will hand them out in order); anything else is 1.
 */
export function fanNickname(number: number): string {
  const n = Number.isSafeInteger(number) && number >= 1 ? number : 1;
  return FAN_PREFIX + String(n);
}

/**
 * The number for a first nickname from a random value from 0 to 1 (`Math.random()` on the
 * page): `FAN_FIRST` to `FAN_LAST`, each as likely.
 */
export function fanNumber(random: number): number {
  const r = Number.isFinite(random)
    ? Math.min(Math.max(random, 0), 1 - 1e-12)
    : 0;
  return FAN_FIRST + Math.floor(r * (FAN_LAST - FAN_FIRST + 1));
}

/**
 * Why a nickname cannot be used: too short, too long, a character it cannot have, or no
 * letter in it.
 */
export type NicknameProblem = "short" | "long" | "characters" | "letter";

export type NicknameCheck =
  { ok: true; name: string } | { ok: false; problem: NicknameProblem };

/** Letters, numbers, spaces, hyphens and underscores: what the pixel font draws. */
const ALLOWED = /^[A-Za-z0-9 _-]+$/;
const LETTER = /[A-Za-z]/;

/**
 * A nickname as typed, tidied (no spaces at the ends, one space at most between words) and
 * checked: `NICKNAME_MIN` to `NICKNAME_MAX` characters of letters, numbers, spaces, `-` and
 * `_`, with at least one letter.
 */
export function checkNickname(text: string): NicknameCheck {
  const name = String(text).trim().replace(/\s+/g, " ");
  if (name.length < NICKNAME_MIN) return { ok: false, problem: "short" };
  if (name.length > NICKNAME_MAX) return { ok: false, problem: "long" };
  if (!ALLOWED.test(name)) return { ok: false, problem: "characters" };
  if (!LETTER.test(name)) return { ok: false, problem: "letter" };
  return { ok: true, name };
}

/** The nickname kept on this device, or null if there is none (or it is not a good one). */
export function loadNickname(storage?: StorageLike | null): string | null {
  try {
    const raw = resolveStorage(storage)?.getItem(NICKNAME_KEY) ?? null;
    if (raw === null) return null;
    const checked = checkNickname(raw);
    return checked.ok ? checked.name : null;
  } catch {
    return null;
  }
}

/**
 * Keep a nickname on this device. Returns the name kept (tidied), or null if it is not a
 * good one or could not be written.
 */
export function saveNickname(
  text: string,
  storage?: StorageLike | null,
): string | null {
  const checked = checkNickname(text);
  if (!checked.ok) return null;
  try {
    const store = resolveStorage(storage);
    if (!store) return null;
    store.setItem(NICKNAME_KEY, checked.name);
    return checked.name;
  } catch {
    return null;
  }
}

/**
 * The player's nickname: the one kept on this device, or, the first time, `fresh()` kept
 * from now on. Where nothing can be kept (no storage), `fresh()` for this visit only.
 */
export function ensureNickname(
  fresh: () => string,
  storage?: StorageLike | null,
): string {
  const kept = loadNickname(storage);
  if (kept !== null) return kept;
  const made = fresh();
  return saveNickname(made, storage) ?? made;
}
