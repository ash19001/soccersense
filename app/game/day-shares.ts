/**
 * HOME's and AWAY's shares, as a question is scored on its day (docs/ARCHITECTURE.md
 * section 8, "How HOME's and AWAY's shares are worked out"). The product owner,
 * 2026-11-16: "what fans would naturally say have a strong foundation and the premise,
 * then the answers given that day also add weight to the scores".
 *
 * An answer's share is a blend of two:
 *
 *     share = (1 - t) x natural + t x the day's,    t = DAY_WEIGHT_MOST x n / (n + DAY_WEIGHT_HALF)
 *
 * - **natural**: the share written with the question (`Answer.popularity`), what fans
 *   would say when they are not trying to be clever. It is the foundation, and never counts
 *   for less than two thirds.
 * - **the day's**: of the `n` answers accepted for the question so far that day, the share
 *   that were this one.
 *
 * So the first players of a day are scored on the foundation alone, the day's weight comes
 * in as people play, and it never passes `DAY_WEIGHT_MOST`. That stops both failures: AWAY
 * turning inside out (everyone dodges the obvious answer, which would then count as rare),
 * and a posted list of the day's rare answers staying rare as everyone copies it.
 *
 * The scale is the server's (worker/games/shares.ts counts the answers); this file is the
 * rule, pure, so the tests and the page can read it.
 */

import { ruleFor } from "./scoring";
import { shotsFor } from "./shots";
import type { Mode, Question } from "./types";

/** The most the day's answers can weigh in a share: about a third. */
export const DAY_WEIGHT_MOST = 0.35;
/** After this many answers the day weighs half of `DAY_WEIGHT_MOST`. */
export const DAY_WEIGHT_HALF = 300;

/** How many times each answer of a question was given and accepted that day, by answer id. */
export type DayCounts = ReadonlyMap<string, number>;

/** Whether a mode's shares move with the day's answers: HOME and AWAY. Years and distances are facts. */
export function sharesMove(mode: Mode): boolean {
  const rule = ruleFor(mode);
  return rule === "common" || rule === "niche";
}

/** How much the day's answers weigh (`t`), after `answered` accepted answers. */
export function dayWeight(answered: number): number {
  if (!Number.isFinite(answered) || answered <= 0) return 0;
  return (DAY_WEIGHT_MOST * answered) / (answered + DAY_WEIGHT_HALF);
}

const countOf = (counts: DayCounts, id: string): number => {
  const n = counts.get(id) ?? 0;
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/**
 * Each answer's share in percent, in the question's answer order, with the day's counts
 * blended in. Counts for answers the question does not have are left out.
 */
export function blendShares(question: Question, counts: DayCounts): number[] {
  let answered = 0;
  for (const answer of question.answers) answered += countOf(counts, answer.id);
  const t = dayWeight(answered);
  return question.answers.map((answer) => {
    const day =
      answered > 0 ? (100 * countOf(counts, answer.id)) / answered : 0;
    return (1 - t) * answer.popularity + t * day;
  });
}

/**
 * The question as it is scored now: in HOME and AWAY, each answer's share blended with the
 * day's (to a thousandth of a percent), and its shot filed again from those shares by the
 * mode's rule (`shotsFor`, the rule every drafted question is filed by). The same question,
 * untouched, where nothing has been counted yet or the mode is not scored on shares.
 */
export function scoredToday(question: Question, counts: DayCounts): Question {
  if (!sharesMove(question.mode)) return question;
  if (!question.answers.some((answer) => countOf(counts, answer.id) > 0)) {
    return question;
  }
  const shares = blendShares(question, counts).map(
    (share) => Math.round(share * 1000) / 1000,
  );
  const shots = shotsFor(shares, ruleFor(question.mode));
  return {
    ...question,
    answers: question.answers.map((answer, i) => ({
      ...answer,
      popularity: shares[i],
      shot: shots[i],
    })),
  };
}
