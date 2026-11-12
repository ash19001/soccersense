/**
 * The reveal's table: five rows, one for each shot that scores, best first (WORLDIE,
 * GOLAZO, TRIVELA, TOE POKE, TAP IN). A miss is never a row. See docs/GAME_DESIGN.md
 * section 3, step 6.
 *
 * - The player's answer, when it scored, is the row for its own shot.
 * - Every other row is that shot's best answer: the one ranked highest in the full table
 *   (`rankAnswers`). In HOME that is the most picked answer in the shot, in AWAY the least
 *   picked. So the WORLDIE row is always #1, and AWAY's pass or time-up sentence (which
 *   names the deepest cut) names an answer on screen. The same question always shows the
 *   same answers.
 * - A question with no answer in some shot has no row for it (the data tests keep that from
 *   happening).
 *
 * An answer that did not score (a listed miss, a pass, a time-up) is not a row: the sheet
 * shows it above the table.
 */
import { rankAnswers, ruleFor } from "./scoring";
import { SHOT_ORDER, isGoal } from "./shots";
import type { LatLng, Mode, Question, RankedAnswer, Shot } from "./types";

/** The five shots that score, best first: one row of the reveal's table each. */
export const SCORING_SHOTS: readonly Shot[] = SHOT_ORDER.filter(isGoal);

/** One row of the reveal's table. */
export interface RevealRow extends RankedAnswer {
  /** The row's shot as a grade (the same value as `shot`), for `data-grade`. */
  grade: Shot;
  /** The answer the player gave. */
  isPlayer: boolean;
  /** 0-based position of this answer in the full table. */
  index: number;
}

/**
 * The reveal's rows from a full ranked table (`rankAnswers`, best first) and the id of the
 * player's answer (null for a pass or a time-up): one per scoring shot that the table has,
 * best first. See the top of this file.
 */
export function shotRows(
  table: readonly RankedAnswer[],
  answerId: string | null,
): RevealRow[] {
  const player =
    answerId === null
      ? null
      : (table.find((row) => row.answer.id === answerId) ?? null);
  const rows: RevealRow[] = [];
  for (const shot of SCORING_SHOTS) {
    // The table is best first, so the shot's first row is its best answer.
    const pick =
      (player?.shot === shot ? player : null) ??
      table.find((row) => row.shot === shot);
    if (!pick) continue;
    rows.push({
      ...pick,
      grade: pick.shot,
      isPlayer: pick === player,
      index: table.indexOf(pick),
    });
  }
  return rows;
}

/**
 * The reveal's rows for a question played in a mode, after the player's result (a `Turn`
 * will do: only its `answerId` is read, null for a pass or a time-up). The stadium only
 * fills each row's `km`.
 */
export function revealRows(
  question: Question,
  mode: Mode,
  result: { answerId: string | null },
  stadium: LatLng,
): RevealRow[] {
  return shotRows(
    rankAnswers(question, stadium, ruleFor(mode)),
    result.answerId,
  );
}
