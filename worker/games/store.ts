/**
 * Games kept in the database: an account's. One row for a player's game of a day and mode,
 * as it stands (./state.ts). It is written when the game starts and at each move that
 * changes it (an answer the judge knows, a pass, the clock running out, the next question).
 *
 * Only accounts' games are kept here (the product owner, 2026-11-17): a player with no
 * account keeps their own (./ticket.ts) and nothing about them is stored. There are no
 * accounts yet, so nothing writes here until there are; the Worker's tests play through it.
 * A game kept here cannot be answered twice or played twice in a day, which is what a
 * leaderboard needs: only accounts are on the leaderboards.
 */

import type { ServedPhase } from "~/game/served";
import type { Turn } from "~/game/session";
import type { Mode } from "~/game/types";

import type { D1 } from "../env";
import type { GameState } from "./state";

export interface GameKey {
  /** The account the game belongs to. */
  playerId: string;
  day: number;
  mode: Mode;
}

export interface GameRow extends GameState, GameKey {}

interface Stored {
  player_id: string;
  day: number;
  mode: string;
  source: string;
  idx: number;
  phase: string;
  turns: string;
  total: number;
  started_at: number;
  deadline: number | null;
  created_at: number;
  updated_at: number;
  finished_at: number | null;
}

const toRow = (stored: Stored): GameRow => ({
  playerId: stored.player_id,
  day: stored.day,
  mode: stored.mode as Mode,
  source: stored.source === "scheduled" ? "scheduled" : "sample",
  index: stored.idx,
  phase: stored.phase as ServedPhase,
  turns: JSON.parse(stored.turns) as Turn[],
  total: stored.total,
  startedAt: stored.started_at,
  deadline: stored.deadline,
  createdAt: stored.created_at,
  updatedAt: stored.updated_at,
  finishedAt: stored.finished_at,
});

/** A player's game of a day and mode, or null if they have not started it. */
export async function gameOf(db: D1, key: GameKey): Promise<GameRow | null> {
  const found = await db
    .prepare("SELECT * FROM games WHERE player_id = ? AND day = ? AND mode = ?")
    .bind(key.playerId, key.day, key.mode)
    .first<Stored>();
  return found ? toRow(found) : null;
}

/** A new game. False if the player already has one for that day and mode (it is kept). */
export async function insertGame(db: D1, row: GameRow): Promise<boolean> {
  const done = await db
    .prepare(
      `INSERT OR IGNORE INTO games (player_id, day, mode, source, idx, phase, turns,
         total, started_at, deadline, created_at, updated_at, finished_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      row.playerId,
      row.day,
      row.mode,
      row.source,
      row.index,
      row.phase,
      JSON.stringify(row.turns),
      row.total,
      Math.round(row.startedAt),
      row.deadline === null ? null : Math.round(row.deadline),
      Math.round(row.createdAt),
      Math.round(row.updatedAt),
      row.finishedAt === null ? null : Math.round(row.finishedAt),
    )
    .run();
  return (done.meta.changes ?? 0) > 0;
}

/**
 * The game after a move, written only if it still stands where the move found it (`was`).
 * False means another request moved it first (a second tab, a press sent twice): nothing
 * is written, and the caller reads the game again.
 */
export async function updateGame(
  db: D1,
  row: GameRow,
  was: { index: number; phase: ServedPhase },
): Promise<boolean> {
  const done = await db
    .prepare(
      `UPDATE games SET idx = ?, phase = ?, turns = ?, total = ?, started_at = ?,
         deadline = ?, updated_at = ?, finished_at = ?
       WHERE player_id = ? AND day = ? AND mode = ? AND idx = ? AND phase = ?`,
    )
    .bind(
      row.index,
      row.phase,
      JSON.stringify(row.turns),
      row.total,
      Math.round(row.startedAt),
      row.deadline === null ? null : Math.round(row.deadline),
      Math.round(row.updatedAt),
      row.finishedAt === null ? null : Math.round(row.finishedAt),
      row.playerId,
      row.day,
      row.mode,
      was.index,
      was.phase,
    )
    .run();
  return (done.meta.changes ?? 0) > 0;
}

/** Takes a game away: one that cannot be carried on (its questions have changed). */
export async function deleteGame(db: D1, key: GameKey): Promise<void> {
  await db
    .prepare("DELETE FROM games WHERE player_id = ? AND day = ? AND mode = ?")
    .bind(key.playerId, key.day, key.mode)
    .run();
}
