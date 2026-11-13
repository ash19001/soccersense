import { EPOCH_UTC, MS_PER_DAY, dayKeyFor } from "./day";
import type { Session, Turn } from "./session";
import { SHOT_ORDER } from "./shots";
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

/** Every grade. A game saved before the six shots (with the old grades) reads as nothing. */
const GRADES: readonly Grade[] = [...SHOT_ORDER, "timeup", "skipped"];

/**
 * The six shots' first names (2026-11-11), for a game saved under them: read as the shot of
 * the same points.
 */
const RENAMED: Readonly<Record<string, Grade>> = {
  bicycle: "worldie",
  finesse: "golazo",
  power: "trivela",
  chip: "toepoke",
};

/** A saved turn with any of the shots' first names read as its shot today. */
function renamed(value: unknown): unknown {
  if (typeof value !== "object" || value === null) return value;
  const t = value as Record<string, unknown>;
  if (typeof t.grade !== "string" || !Object.hasOwn(RENAMED, t.grade)) {
    return value;
  }
  return { ...t, grade: RENAMED[t.grade] };
}

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
    // Games saved before HOME and AWAY were scored by popularity have no share.
    (t.share === undefined || t.share === null || isNumber(t.share)) &&
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
 *
 * The history is then pruned to the year up to `today`, the real game day (`dayNumber` of
 * the clock, with no `?day=` override), or the game's own day if that is earlier. So a game
 * played on a far-off `?day=` never deletes the real games. Left out, it is the game's day.
 */
export function saveSession(
  session: Session,
  storage?: StorageLike | null,
  today?: number,
): boolean {
  try {
    if (session.phase !== "done") return false;
    const saved = saveGame(
      dayKeyFor(session.dayNumber),
      session.mode,
      session,
      storage,
    );
    // The history keeps a year: anything older goes as a new game comes in.
    if (saved) {
      pruneHistory(
        today !== undefined && Number.isFinite(today)
          ? Math.min(session.dayNumber, today)
          : session.dayNumber,
        storage,
      );
    }
    return saved;
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
    let parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null) {
      const g = parsed as Record<string, unknown>;
      if (Array.isArray(g.turns))
        parsed = { ...g, turns: g.turns.map(renamed) };
    }
    if (!isStoredGame(parsed)) return null;
    return {
      total: parsed.total,
      turns: parsed.turns.map((turn) => ({
        ...turn,
        share: turn.share ?? null,
      })),
    };
  } catch {
    return null;
  }
}

/** Every mode (`MODES`) for one day, for the menu's "already played" scores. */
export function loadDay(
  dayKey: string,
  storage?: StorageLike | null,
): Record<Mode, StoredGame | null> {
  return Object.fromEntries(
    MODES.map((mode) => [mode, loadGame(dayKey, mode, storage)]),
  ) as Record<Mode, StoredGame | null>;
}

/**
 * Every mode that can be played, in the menu's order: HOME and AWAY, then RETRO and
 * NEXT-GEN (the past, then the future). The history and the stats are built over this
 * list, so a mode added here (and to `Mode`) joins them with no other change.
 */
export const MODES: readonly Mode[] = ["home", "away", "retro", "nextgen"];

/** How many days of finished games the history keeps: a year, today included. */
export const HISTORY_DAYS = 366;

/** Storage that can also list its keys, for the history. `localStorage` fits. */
export type ListableStorage = StorageLike & Pick<Storage, "key" | "length">;

/** One finished game in the history: its day, its mode, its total and its seven grades. */
export interface PlayedGame {
  /** The game day (`dayNumber`): day 1 is 2026-11-10. */
  day: number;
  mode: Mode;
  total: number;
  /** One per question, in order. */
  grades: readonly Grade[];
  /**
   * The points each answer scored, as saved: one per grade. A game saved under older
   * points keeps its own, so they always add up to `total`.
   */
  points: readonly number[];
}

/**
 * The game day of a "YYYY-MM-DD" key (`dayKeyFor(day)` the other way round), or null for
 * anything that is not a real calendar day from day 1 on.
 */
export function dayOfKey(dayKey: string): number | null {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
  if (!parts) return null;
  const ms = Date.UTC(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]));
  const day = Math.round((ms - EPOCH_UTC) / MS_PER_DAY) + 1;
  if (!Number.isFinite(day) || day < 1) return null;
  // 2026-02-31 is not a day: it must come back as itself.
  return dayKeyFor(day) === dayKey ? day : null;
}

/** The store, if it can list its keys. */
function listable(given: ListableStorage | null | undefined) {
  const store = resolveStorage(given) as Partial<ListableStorage> | null;
  if (
    !store ||
    typeof store.key !== "function" ||
    typeof store.length !== "number"
  ) {
    return null;
  }
  return store as ListableStorage;
}

/** Every finished game's key in the store, with its day and mode. */
function finishedKeys(
  store: ListableStorage,
): { key: string; day: number; mode: Mode }[] {
  const found: { key: string; day: number; mode: Mode }[] = [];
  const head = `${STORAGE_PREFIX}:`;
  // Read every key first: removing while counting would skip some.
  const keys: string[] = [];
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i);
    if (key !== null && key.startsWith(head)) keys.push(key);
  }
  for (const key of keys) {
    // `soccersense:v1:<YYYY-MM-DD>:<mode>`, and nothing after it (a game in progress has
    // `:live` after it).
    const rest = key.slice(head.length).split(":");
    if (rest.length !== 2) continue;
    const day = dayOfKey(rest[0]);
    const mode = MODES.find((m) => m === rest[1]);
    if (day !== null && mode) found.push({ key, day, mode });
  }
  return found;
}

/**
 * The history: every finished game kept on this device in the year up to `today` (the
 * game day, `HISTORY_DAYS` of them, today included), oldest first and, on one day, in the
 * order of `MODES`. Games after `today` (played with a `?day=` override) and anything that
 * cannot be read are left out. Empty where storage cannot list its keys. Read it in an
 * effect or a handler: it is browser storage.
 */
export function loadHistory(
  today: number,
  storage?: ListableStorage | null,
): PlayedGame[] {
  try {
    const store = listable(storage);
    if (!store) return [];
    const from = today - HISTORY_DAYS + 1;
    const games: PlayedGame[] = [];
    for (const { day, mode } of finishedKeys(store)) {
      if (day < from || day > today) continue;
      const game = loadGame(dayKeyFor(day), mode, store);
      if (!game) continue;
      games.push({
        day,
        mode,
        total: game.total,
        grades: game.turns.map((turn) => turn.grade),
        points: game.turns.map((turn) => turn.points),
      });
    }
    return games.sort(
      (a, b) => a.day - b.day || MODES.indexOf(a.mode) - MODES.indexOf(b.mode),
    );
  } catch {
    return [];
  }
}

/**
 * Forget the finished games from before the year up to `today` (see `loadHistory`), so the
 * history never outgrows a year. Returns how many were removed. `saveSession` calls it.
 */
export function pruneHistory(
  today: number,
  storage?: ListableStorage | StorageLike | null,
): number {
  try {
    const store = listable(storage as ListableStorage | null | undefined);
    if (!store) return 0;
    const from = today - HISTORY_DAYS + 1;
    let removed = 0;
    for (const { key, day } of finishedKeys(store)) {
      if (day >= from) continue;
      store.removeItem(key);
      removed++;
    }
    return removed;
  } catch {
    return 0;
  }
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
