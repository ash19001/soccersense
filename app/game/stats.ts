/**
 * The player's stats, worked out from the history of finished games on this device
 * (`loadHistory` in ./storage): today's result per mode, and per mode over the year the
 * history keeps, how many games, the average and the best total, and how the answers went
 * (how many worldies, golazos...). And the daily streak: days in a row with at least one
 * finished game, in any mode. Pure: the day is passed in.
 */
import { SHOT_ORDER } from "./shots";
import { MODES, type PlayedGame } from "./storage";
import type { Grade, Mode, Shot } from "./types";

/** How an answer went, for the tally: a shot, or no answer (passed or out of time). */
export type Outcome = Shot | "none";

/** The tally's order: the six shots, best first, then no answer. */
export const OUTCOMES: readonly Outcome[] = [...SHOT_ORDER, "none"];

/** The outcome of a grade: its shot, or "none" for a pass or a time-up. */
export function outcomeOf(grade: Grade): Outcome {
  return grade === "timeup" || grade === "skipped" ? "none" : grade;
}

/** Days in a row with a finished game. */
export interface Streak {
  /** The run that ends today, or yesterday while today is not played yet. 0 if neither. */
  current: number;
  /** The longest run in the history. */
  best: number;
}

/** One mode's stats. */
export interface ModeStats {
  mode: Mode;
  /** Today's finished game, or null if it has not been played (or finished) today. */
  today: PlayedGame | null;
  /** Games finished, over the history. */
  played: number;
  /** The mean total, rounded to a whole point; null with no games. */
  average: number | null;
  /** The highest total and the day it was first made; null with no games. */
  best: { total: number; day: number } | null;
  /** How every answer of every game went, by outcome (`OUTCOMES`). */
  tally: Readonly<Record<Outcome, number>>;
  /** How many answers the tally counts (7 a game). */
  answers: number;
}

export interface Stats {
  /** One per mode, in the order asked for (the menu's, `MODES`). */
  modes: ModeStats[];
  /** Over every mode: a day counts if any game was finished on it. */
  streak: Streak;
  /** Games finished in all, over every mode. 0 on a first visit. */
  played: number;
}

function emptyTally(): Record<Outcome, number> {
  return {
    worldie: 0,
    golazo: 0,
    trivela: 0,
    toepoke: 0,
    tapin: 0,
    miss: 0,
    none: 0,
  };
}

/**
 * The streak on `today` from the days that had a finished game (in any order, repeats
 * allowed). Days after `today` are left out.
 */
export function streakFor(days: Iterable<number>, today: number): Streak {
  const played = new Set<number>();
  for (const day of days) {
    if (Number.isInteger(day) && day <= today) played.add(day);
  }
  const sorted = [...played].sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  let last = Number.NaN;
  for (const day of sorted) {
    run = day === last + 1 ? run + 1 : 1;
    last = day;
    best = Math.max(best, run);
  }
  // Today's game may not be played yet: the run up to yesterday is still alive.
  let end = played.has(today) ? today : today - 1;
  let current = 0;
  while (played.has(end)) {
    current++;
    end--;
  }
  return { current, best };
}

/**
 * The stats on `today` (the game day) from the history: `games` as `loadHistory` gives
 * them. Games after `today` are left out; so are games in a mode not in `modes`.
 */
export function statsFor(
  games: readonly PlayedGame[],
  today: number,
  modes: readonly Mode[] = MODES,
): Stats {
  const counted = games.filter((g) => g.day <= today && modes.includes(g.mode));
  const perMode = modes.map((mode): ModeStats => {
    const mine = counted.filter((g) => g.mode === mode);
    const tally = emptyTally();
    let answers = 0;
    let sum = 0;
    let best: ModeStats["best"] = null;
    for (const game of mine) {
      sum += game.total;
      if (
        !best ||
        game.total > best.total ||
        (game.total === best.total && game.day < best.day)
      ) {
        best = { total: game.total, day: game.day };
      }
      for (const grade of game.grades) {
        tally[outcomeOf(grade)]++;
        answers++;
      }
    }
    return {
      mode,
      today: mine.find((g) => g.day === today) ?? null,
      played: mine.length,
      average: mine.length === 0 ? null : Math.round(sum / mine.length),
      best,
      tally,
      answers,
    };
  });
  return {
    modes: perMode,
    streak: streakFor(
      counted.map((g) => g.day),
      today,
    ),
    played: counted.length,
  };
}

/**
 * Shares `cells` whole cells out between `counts` in proportion (the largest remainders get
 * the cells left over), for a bar drawn in whole pixels. Every count above 0 gets at least
 * one cell, taken from the largest share, as long as there are cells enough. All zeros, or
 * no cells, give all zeros. The result always adds up to `cells` (or to 0).
 */
export function apportion(counts: readonly number[], cells: number): number[] {
  const n = Math.max(0, Math.floor(cells));
  const clean = counts.map((c) => (Number.isFinite(c) && c > 0 ? c : 0));
  const total = clean.reduce((a, b) => a + b, 0);
  if (total === 0 || n === 0) return clean.map(() => 0);
  const exact = clean.map((c) => (c * n) / total);
  const out = exact.map(Math.floor);
  let left = n - out.reduce((a, b) => a + b, 0);
  // The largest remainders first; on a tie, the earlier (the better shot).
  const order = exact
    .map((x, i) => ({ i, rest: x - Math.floor(x) }))
    .sort((a, b) => b.rest - a.rest || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    out[i]++;
    left--;
  }
  // A count that shows nothing: one cell from the largest, if it can spare one.
  for (let i = 0; i < out.length; i++) {
    if (clean[i] === 0 || out[i] > 0) continue;
    let from = -1;
    for (let j = 0; j < out.length; j++) {
      if (out[j] > 1 && (from < 0 || out[j] > out[from])) from = j;
    }
    if (from < 0) break;
    out[from]--;
    out[i]++;
  }
  return out;
}
