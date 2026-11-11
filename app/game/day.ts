import type { Stadium } from "./types";

export const MS_PER_DAY = 86_400_000;

/** Midnight UTC on 2026-11-10: the start of day 1. */
export const EPOCH_UTC = Date.UTC(2026, 10, 10);

/**
 * The game day for a moment in time. Days change at midnight UTC. The epoch day is day 1, and
 * anything before it (or an invalid date) is also day 1.
 */
export function dayNumber(date: Date): number {
  const days = Math.floor((date.getTime() - EPOCH_UTC) / MS_PER_DAY) + 1;
  return days >= 1 ? days : 1;
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

/** The UTC calendar day as "YYYY-MM-DD". An invalid date gives the epoch day. */
export function utcDayKey(date: Date): string {
  if (Number.isNaN(date.getTime())) return utcDayKey(new Date(EPOCH_UTC));
  return [
    pad(date.getUTCFullYear(), 4),
    pad(date.getUTCMonth() + 1, 2),
    pad(date.getUTCDate(), 2),
  ].join("-");
}

/** The "YYYY-MM-DD" key of a game day: `dayKeyFor(1)` is "2026-11-10". */
export function dayKeyFor(day: number): string {
  const n = Number.isFinite(day) ? Math.max(1, Math.floor(day)) : 1;
  return utcDayKey(new Date(EPOCH_UTC + (n - 1) * MS_PER_DAY));
}

/**
 * Milliseconds until the next midnight UTC. A full day at exactly midnight, and for an
 * invalid date (so a timer set from it can never fire in a tight loop).
 */
export function msUntilNextDay(date: Date): number {
  if (Number.isNaN(date.getTime())) return MS_PER_DAY;
  const into = ((date.getTime() % MS_PER_DAY) + MS_PER_DAY) % MS_PER_DAY;
  return MS_PER_DAY - into;
}

/** The stadium for day `n` (1-based), cycling through the list. Throws on an empty list. */
export function stadiumForDay(
  n: number,
  stadiums: readonly Stadium[],
): Stadium {
  const count = stadiums.length;
  if (count === 0) throw new Error("stadiumForDay: the stadium list is empty");
  const day = Number.isFinite(n) ? Math.floor(n) : 1;
  return stadiums[(((day - 1) % count) + count) % count];
}

/** Debug overrides read from the query string. Demo only. */
export interface Overrides {
  /** `?stadium=anfield`: pin this stadium whatever the day. */
  stadiumId?: string;
  /** `?day=3`: play this day number. */
  day?: number;
  /** `?time=21:30`: force the sky's time of day. */
  time?: { hours: number; minutes: number };
  /** `?notimer=1`: no clock. */
  noTimer: boolean;
}

/**
 * Parse `?stadium=anfield&day=3&time=21:30&notimer=1` (with or without the "?").
 * Anything invalid is ignored.
 */
export function parseOverrides(search: string): Overrides {
  const result: Overrides = { noTimer: false };
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search);
  } catch {
    return result;
  }

  const stadium = params.get("stadium")?.trim().toLowerCase();
  if (stadium && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(stadium)) {
    result.stadiumId = stadium;
  }

  const day = params.get("day")?.trim();
  if (day && /^\d{1,7}$/.test(day) && Number(day) >= 1) {
    result.day = Number(day);
  }

  const time = /^(\d{1,2}):(\d{2})$/.exec(params.get("time")?.trim() ?? "");
  if (time) {
    const hours = Number(time[1]);
    const minutes = Number(time[2]);
    if (hours <= 23 && minutes <= 59) result.time = { hours, minutes };
  }

  const noTimer = params.get("notimer")?.trim().toLowerCase();
  result.noTimer = noTimer === "1" || noTimer === "true" || noTimer === "";
  return result;
}

/** Everything the interface needs to know about today, with the debug overrides applied. */
export interface Today {
  dayNumber: number;
  /** The storage key for this day: `dayKeyFor(dayNumber)`, so it follows a `?day=` override. */
  dayKey: string;
  stadium: Stadium;
  /** `?notimer=1`: pass it to `createSession`. */
  noTimer: boolean;
  /** `?time=21:30`: the forced time of day for the sky, when given. */
  time?: { hours: number; minutes: number };
}

/**
 * Today's day number, storage key and stadium, with any debug overrides applied. An unknown
 * `?stadium=` id is ignored. Throws on an empty stadium list.
 */
export function resolveToday(
  now: Date,
  search: string,
  stadiums: readonly Stadium[],
): Today {
  const overrides = parseOverrides(search);
  const day = overrides.day ?? dayNumber(now);
  const pinned =
    overrides.stadiumId === undefined
      ? undefined
      : stadiums.find((s) => s.id === overrides.stadiumId);
  const today: Today = {
    dayNumber: day,
    dayKey: dayKeyFor(day),
    stadium: pinned ?? stadiumForDay(day, stadiums),
    noTimer: overrides.noTimer,
  };
  if (overrides.time) today.time = overrides.time;
  return today;
}
