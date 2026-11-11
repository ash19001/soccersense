import { dayKeyFor } from "./day";
import type { Session, Turn } from "./session";
import type { Grade, Mode } from "./types";

/**
 * Finished games, kept in localStorage under `soccersense:v1:<utcDayKey>:<mode>`.
 *
 * Every function here is safe to call anywhere: when storage is missing (server render),
 * blocked (private mode), full or holding junk, reads return null and writes do nothing.
 * Nothing touches storage at import time.
 */

export const STORAGE_PREFIX = "soccersense:v1";

/** What is kept for one finished game. */
export interface StoredGame {
  total: number;
  turns: readonly Turn[];
}

/** The slice of the Web Storage API these functions use. `localStorage` fits. */
export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** `dayKey` is the UTC day as "YYYY-MM-DD": see `utcDayKey` and `dayKeyFor`. */
export function storageKey(dayKey: string, mode: Mode): string {
  return `${STORAGE_PREFIX}:${dayKey}:${mode}`;
}

function resolveStorage(
  given: StorageLike | null | undefined,
): StorageLike | null {
  if (given !== undefined) return given;
  try {
    // Reading the property can itself throw when storage is blocked.
    const found: unknown = (globalThis as { localStorage?: unknown })
      .localStorage;
    if (
      typeof found === "object" &&
      found !== null &&
      typeof (found as StorageLike).getItem === "function" &&
      typeof (found as StorageLike).setItem === "function" &&
      typeof (found as StorageLike).removeItem === "function"
    ) {
      return found as StorageLike;
    }
  } catch {
    // Fall through.
  }
  return null;
}

const GRADES: readonly Grade[] = [
  "worldie",
  "topbins",
  "goal",
  "ontarget",
  "wide",
  "timeup",
  "skipped",
];

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isTurn(value: unknown): value is Turn {
  if (typeof value !== "object" || value === null) return false;
  const t = value as Record<string, unknown>;
  return (
    typeof t.questionId === "string" &&
    (t.input === null || typeof t.input === "string") &&
    (t.answerId === null || typeof t.answerId === "string") &&
    typeof t.grade === "string" &&
    (GRADES as readonly string[]).includes(t.grade) &&
    isNumber(t.points) &&
    Number.isInteger(t.points) &&
    t.points >= 0 &&
    t.points <= 100 &&
    (t.km === null || isNumber(t.km)) &&
    (t.rank === null || isNumber(t.rank)) &&
    isNumber(t.msLeft)
  );
}

function isStoredGame(value: unknown): value is StoredGame {
  if (typeof value !== "object" || value === null) return false;
  const g = value as Record<string, unknown>;
  if (!isNumber(g.total) || !Array.isArray(g.turns)) return false;
  if (!g.turns.every(isTurn)) return false;
  // The total is always the sum of the turns: anything else has been damaged or edited.
  return g.total === g.turns.reduce((sum, turn) => sum + turn.points, 0);
}

/**
 * Save a finished game, replacing any earlier one for that day and mode. Returns whether it
 * was written. Pass `storage` in tests; leave it out to use `localStorage`.
 */
export function saveGame(
  dayKey: string,
  mode: Mode,
  game: StoredGame,
  storage?: StorageLike | null,
): boolean {
  try {
    const store = resolveStorage(storage);
    if (!store) return false;
    const value: StoredGame = { total: game.total, turns: [...game.turns] };
    store.setItem(storageKey(dayKey, mode), JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/**
 * Save a game that has reached full time, under its own day (`dayKeyFor(session.dayNumber)`,
 * the same key as `resolveToday(...).dayKey`) and mode. Returns whether it was written: false
 * for a game that is not done yet.
 */
export function saveSession(
  session: Session,
  storage?: StorageLike | null,
): boolean {
  try {
    if (session.phase !== "done") return false;
    return saveGame(
      dayKeyFor(session.dayNumber),
      session.mode,
      session,
      storage,
    );
  } catch {
    return false;
  }
}

/** The finished game for that day and mode, or null if there is none or it cannot be read. */
export function loadGame(
  dayKey: string,
  mode: Mode,
  storage?: StorageLike | null,
): StoredGame | null {
  try {
    const store = resolveStorage(storage);
    if (!store) return null;
    const raw = store.getItem(storageKey(dayKey, mode));
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isStoredGame(parsed)) return null;
    return { total: parsed.total, turns: parsed.turns };
  } catch {
    return null;
  }
}

/** Both modes for one day, for the menu's "already played" scores. */
export function loadDay(
  dayKey: string,
  storage?: StorageLike | null,
): Record<Mode, StoredGame | null> {
  return {
    home: loadGame(dayKey, "home", storage),
    away: loadGame(dayKey, "away", storage),
  };
}

/** Forget the finished game for that day and mode. */
export function clearGame(
  dayKey: string,
  mode: Mode,
  storage?: StorageLike | null,
): void {
  try {
    resolveStorage(storage)?.removeItem(storageKey(dayKey, mode));
  } catch {
    // Nothing to do.
  }
}
