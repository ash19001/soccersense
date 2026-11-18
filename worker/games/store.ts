/**
 * Games kept in the database: every player's the server keeps. One row for a player's game
 * of a day and mode,
 * as it stands (./state.ts). It is written when the game starts and at each move that
 * changes it (an answer the judge knows, a pass, the clock running out, the next question).
 *
 * The player is an account, or a guest (a player with no account, since 2026-11-18:
 * ../accounts/store.ts). A game no player could be made for is a ticket the player keeps
 * (./ticket.ts), and nothing about it is stored.
 *
 * Two kinds of row (`origin`, migration 4): `server`, a game played through the server, and
 * `device`, a finished game one of the account's devices had played before it signed in,
 * sent up so that the account's streak and stats are whole (`importGames`). Only `server`
 * games can stand on a leaderboard. Either way, a day and mode is played once: a `device`
 * game of today's is today's game for the account too.
 * A game kept here cannot be answered twice or played twice in a day, which is what a
 * leaderboard needs: only kept games are on the leaderboards.
 */

import type { HistoryGame } from "~/game/account";
import type { ServedPhase } from "~/game/served";
import type { Turn } from "~/game/session";
import type { Mode } from "~/game/types";

import type { D1 } from "../env";
import { type CountedAnswer, countAnswer } from "./shares";
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
 * is written, and the caller reads the game again. `prompts`, once the game is decided:
 * what its questions asked, so another device can show it again. `decided`: this move
 * decided the game, so its total is counted on the day's board (`board_tally`). `answer`:
 * the answer this move decided, to be counted for the day's shares (./shares.ts). Both are
 * counted in the same transaction as the move, and only if the move was written: once,
 * however many requests carry it.
 */
export async function updateGame(
  db: D1,
  row: GameRow,
  was: { index: number; phase: ServedPhase },
  prompts: readonly string[] | null = null,
  decided = false,
  answer: CountedAnswer | null = null,
): Promise<boolean> {
  const update = db
    .prepare(
      `UPDATE games SET idx = ?, phase = ?, turns = ?, total = ?, started_at = ?,
         deadline = ?, updated_at = ?, finished_at = ?, prompts = COALESCE(?, prompts)
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
      prompts === null ? null : JSON.stringify(prompts),
      row.playerId,
      row.day,
      row.mode,
      was.index,
      was.phase,
    );
  if (!decided && answer === null) {
    const done = await update.run();
    return (done.meta.changes ?? 0) > 0;
  }
  // Each count goes in only if the statement before it changed a row (`changes()`): the
  // update, or the count before it, which went in only if the update did. An update that
  // changed nothing counts nothing.
  const [done] = await db.batch([
    update,
    ...(answer === null ? [] : [countAnswer(db, answer)]),
    ...(decided
      ? [
          db
            .prepare(
              `INSERT INTO board_tally (day, mode, total, players)
               SELECT ?, ?, ?, 1 WHERE changes() > 0
               ON CONFLICT (day, mode, total) DO UPDATE SET players = players + 1`,
            )
            .bind(row.day, row.mode, row.total),
        ]
      : []),
  ]);
  return (done.meta.changes ?? 0) > 0;
}

/**
 * An account's decided games from `fromDay` on, oldest first: every one whose last
 * question has been decided, whether or not its full-time card has been shown.
 */
export async function finishedGames(
  db: D1,
  playerId: string,
  fromDay: number,
): Promise<HistoryGame[]> {
  const { results } = await db
    .prepare(
      `SELECT day, mode, total, turns, prompts FROM games
       WHERE player_id = ? AND day >= ? AND finished_at IS NOT NULL
       ORDER BY day, mode`,
    )
    .bind(playerId, fromDay)
    .all<{
      day: number;
      mode: string;
      total: number;
      turns: string;
      prompts: string | null;
    }>();
  return results.map((row) => ({
    day: row.day,
    mode: row.mode as Mode,
    total: row.total,
    turns: JSON.parse(row.turns) as Turn[],
    prompts:
      row.prompts === null ? null : (JSON.parse(row.prompts) as string[]),
  }));
}

/**
 * Takes in finished games one of an account's devices played before it signed in, as
 * `device` games. A day and mode the account already has a game for keeps that game.
 * Returns how many were kept.
 */
export async function importGames(
  db: D1,
  playerId: string,
  games: readonly HistoryGame[],
  now: number,
): Promise<number> {
  if (games.length === 0) return 0;
  const at = Math.round(now);
  const done = await db.batch(
    games.map((game) =>
      db
        .prepare(
          `INSERT OR IGNORE INTO games (player_id, day, mode, source, idx, phase, turns,
             total, started_at, deadline, created_at, updated_at, finished_at, origin,
             prompts)
           VALUES (?, ?, ?, 'sample', ?, 'done', ?, ?, ?, NULL, ?, ?, ?, 'device', ?)`,
        )
        .bind(
          playerId,
          game.day,
          game.mode,
          game.turns.length - 1,
          JSON.stringify(game.turns),
          game.total,
          at,
          at,
          at,
          at,
          game.prompts === null ? null : JSON.stringify(game.prompts),
        ),
    ),
  );
  return done.reduce((sum, result) => sum + (result.meta.changes ?? 0), 0);
}

/** Takes a game away: one that cannot be carried on (its questions have changed). */
export async function deleteGame(db: D1, key: GameKey): Promise<void> {
  await db
    .prepare("DELETE FROM games WHERE player_id = ? AND day = ? AND mode = ?")
    .bind(key.playerId, key.day, key.mode)
    .run();
}
