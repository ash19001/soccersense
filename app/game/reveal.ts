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
import type {
  Answer,
  LatLng,
  Mode,
  Question,
  RankedAnswer,
  ShownAnswer,
  Shot,
} from "./types";

/** The five shots that score, best first: one row of the reveal's table each. */
export const SCORING_SHOTS: readonly Shot[] = SHOT_ORDER.filter(isGoal);

/** One row of the reveal's table. */
export interface RevealRow<
  A extends ShownAnswer = ShownAnswer,
> extends RankedAnswer<A> {
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
export function shotRows<A extends ShownAnswer>(
  table: readonly RankedAnswer<A>[],
  answerId: string | null,
): RevealRow<A>[] {
  const player =
    answerId === null
      ? null
      : (table.find((row) => row.answer.id === answerId) ?? null);
  const rows: RevealRow<A>[] = [];
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
 * A question's reveal, whole: everything the sheet shows once the question is decided. It
 * is made from the full table at that moment (`revealOf`), and it is all the page needs,
 * so the server can send it in place of the answers.
 */
export interface Reveal {
  /** The table's rows to draw: `shotRows`. */
  rows: RevealRow[];
  /** The player's answer in the table. Null for a pass or a time-up. */
  row: RankedAnswer | null;
  /** The best answer: the table's top row. Null only for an empty answer list. */
  best: RankedAnswer | null;
  /** How many answers the full table has. */
  tableSize: number;
  /** Every answer is in the one country (the Premier League's clubs): no row repeats it. */
  oneCountry: boolean;
}

/**
 * The reveal from a full ranked table (`rankAnswers`, best first) and the id of the
 * player's answer (null for a pass or a time-up).
 */
export function revealOf(
  table: readonly RankedAnswer[],
  answerId: string | null,
): Reveal {
  const country = table[0]?.answer.country;
  return {
    rows: shotRows(table, answerId),
    row:
      answerId === null
        ? null
        : (table.find((row) => row.answer.id === answerId) ?? null),
    best: table[0] ?? null,
    tableSize: table.length,
    oneCountry:
      table.length > 0 && table.every((row) => row.answer.country === country),
  };
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
): RevealRow<Answer>[] {
  return shotRows(
    rankAnswers(question, stadium, ruleFor(mode)),
    result.answerId,
  );
}
