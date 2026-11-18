/**
 * The day's leaderboards, as the page and the server agree on them (worker/games/board.ts):
 * for each mode, the top ten accounts, how many accounts have each total, and, for a
 * signed-in player who is on the board, their own place. Pure: both ends import it.
 *
 * Only accounts are on the leaderboards, and only with a game played through the server
 * (the product owner, 2026-11-17: "only accounts are on leaderboards"). A player with no
 * account is told where they would have placed: the page works it out from the totals'
 * counts (`rankFor`), and nothing about them is sent or kept.
 */

import { MODES } from "./storage";
import type { Mode } from "./types";

/** How many of the best a board lists. */
export const BOARD_TOP = 10;

/** The most a game can score: seven shots of 100. */
export const BOARD_MAX = 700;

/** One row of a board. Equal totals share a rank ("1, 2, 2, 4"). */
export interface BoardEntry {
  rank: number;
  /** The account's nickname. */
  name: string;
  points: number;
  /** The signed-in player's own row. */
  you?: boolean;
}

/** How many accounts finished on one total: `[total, players]`. */
export type TallyEntry = [total: number, players: number];

/** One mode's board for a day. */
export interface ModeBoard {
  /** How many accounts are on it. */
  count: number;
  /** The best, best first, at most `BOARD_TOP` (ties broken by who finished first). */
  top: BoardEntry[];
  /** How many accounts finished on each total, best first; totals nobody got are left out. */
  tally: TallyEntry[];
  /** The signed-in player's own place, where they are on this board; else null. */
  you: { rank: number; points: number } | null;
}

/** What `GET /api/leaderboard` answers. */
export interface BoardAnswer {
  day: number;
  modes: Record<Mode, ModeBoard>;
}

/**
 * Where a total places on a board: one more than the players with more (equal totals share
 * a place). For a player not on the board this is where they would have placed.
 */
export function rankFor(tally: readonly TallyEntry[], total: number): number {
  let above = 0;
  for (const [points, players] of tally) {
    if (points > total) above += players;
  }
  return above + 1;
}

/** An empty board: nobody on it yet. */
export function emptyBoard(): ModeBoard {
  return { count: 0, top: [], tally: [], you: null };
}

const isBag = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isCount = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0;

const isPoints = (value: unknown): value is number =>
  isCount(value) && value <= BOARD_MAX;

function isModeBoard(value: unknown): value is ModeBoard {
  if (!isBag(value)) return false;
  const { count, top, tally, you } = value;
  return (
    isCount(count) &&
    Array.isArray(top) &&
    top.length <= BOARD_TOP &&
    top.every(
      (entry) =>
        isBag(entry) &&
        isCount(entry.rank) &&
        entry.rank >= 1 &&
        typeof entry.name === "string" &&
        isPoints(entry.points) &&
        (entry.you === undefined || typeof entry.you === "boolean"),
    ) &&
    Array.isArray(tally) &&
    tally.every(
      (entry) =>
        Array.isArray(entry) &&
        entry.length === 2 &&
        isPoints(entry[0]) &&
        isCount(entry[1]),
    ) &&
    (you === null ||
      (isBag(you) &&
        isCount(you.rank) &&
        you.rank >= 1 &&
        isPoints(you.points)))
  );
}

/** Whether something the server sent is a day's boards. */
export function isBoardAnswer(value: unknown): value is BoardAnswer {
  return (
    isBag(value) &&
    isCount(value.day) &&
    isBag(value.modes) &&
    MODES.every((mode) =>
      isModeBoard((value.modes as Record<string, unknown>)[mode]),
    )
  );
}
