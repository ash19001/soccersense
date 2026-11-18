/**
 * The day's answers in HOME and AWAY, counted (`answer_tally`, migration 6), for the shares
 * a question is scored by on its day (`scoredToday`, ~/game/day-shares).
 *
 * **Whose answers count**: every player the server keeps, with an account or not (a
 * guest: the product owner, 2026-11-18), and only the answers the judge accepted (its
 * aliases and spellings count as the one answer). Not passes, time-ups or answers it did
 * not know; not a player taken off the leaderboards. A kept player plays a day and mode
 * once, and a move is kept once however often it is sent, so an answer is counted once: in
 * the same transaction as the move that decided it, and only if that move was written
 * (worker/games/store.ts, `updateGame`).
 *
 * A game no player could be made for (the new-player limit said no) is a ticket the server
 * does not remember (./ticket.ts), which can be sent again: it is scored by the same blend
 * but not counted.
 *
 * **What is kept**: for each day, mode, question and answer, how many. Nothing says whose
 * answer was whose. The counts of a day stop moving once its games are played: they are
 * the day's table, frozen, for anything that plays the day again later.
 */

import type { DayCounts } from "~/game/day-shares";
import type { Mode } from "~/game/types";

import type { D1, D1Statement } from "../env";

/**
 * How long an instance of the Worker remembers a question's counts. Every answer in HOME
 * and AWAY is scored on them; ten seconds behind is nothing to a share made of hundreds of
 * answers, and it spares the database a read for each one.
 */
export const COUNTS_KEPT_MS = 10_000;

/** An accepted answer to count. */
export interface CountedAnswer {
  day: number;
  mode: Mode;
  questionId: string;
  answerId: string;
}

const kept = new WeakMap<D1, Map<string, { at: number; counts: DayCounts }>>();

/** How many accounts gave each answer to a question of a day and mode, so far. */
export async function dayCounts(
  db: D1,
  day: number,
  mode: Mode,
  questionId: string,
  now: number,
): Promise<DayCounts> {
  let known = kept.get(db);
  if (!known) {
    known = new Map();
    kept.set(db, known);
  }
  const fresh = (at: number) => now >= at && now - at < COUNTS_KEPT_MS;
  const key = `${day}:${mode}:${questionId}`;
  const found = known.get(key);
  if (found && fresh(found.at)) return found.counts;

  const { results } = await db
    .prepare(
      `SELECT answer_id, players FROM answer_tally
       WHERE day = ? AND mode = ? AND question_id = ?`,
    )
    .bind(day, mode, questionId)
    .all<{ answer_id: string; players: number }>();
  const counts: DayCounts = new Map(
    results.map((row) => [row.answer_id, row.players]),
  );
  // Only what is still fresh stays: other questions' counts are not kept for ever.
  for (const [other, entry] of known) {
    if (!fresh(entry.at)) known.delete(other);
  }
  known.set(key, { at: now, counts });
  return counts;
}

/**
 * The statement that counts an answer: one more for it, **only if the statement just
 * before it in the batch changed a row** (`changes()`), which is the move that decided it.
 * A move that was not written (another request moved the game first) counts nothing.
 */
export function countAnswer(db: D1, answer: CountedAnswer): D1Statement {
  return db
    .prepare(
      `INSERT INTO answer_tally (day, mode, question_id, answer_id, players)
       SELECT ?, ?, ?, ?, 1 WHERE changes() > 0
       ON CONFLICT (day, mode, question_id, answer_id) DO UPDATE SET players = players + 1`,
    )
    .bind(answer.day, answer.mode, answer.questionId, answer.answerId);
}
