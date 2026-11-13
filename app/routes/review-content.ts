// What the review pop-up on the home screen says: a game finished today (`loadGame`), as
// the full-time card showed it (the total, the career tier, the title it earned and the
// seven answers), in the interface's words. Each mode is played once a day, so a played
// mode's card offers this instead of a new game.

import { questionsFor } from "~/data";
import {
  type Mode,
  MAX_TOTAL,
  type StoredGame,
  careerFor,
  dayKeyFor,
  isShot,
  loadGame,
  titleFor,
} from "~/game";
import { strings } from "~/i18n";
import type { FullTimeResult, ReviewProps } from "~/ui";

export type ReviewContent = Omit<
  ReviewProps,
  "open" | "onClose" | "returnFocus"
>;

/**
 * The review of `mode` on game day `today` (with any `?day=` override), or null if it has
 * not been finished that day. Reads browser storage unless `game` is given: call it in an
 * effect or a handler, never while rendering.
 */
export function reviewContent(
  today: number,
  mode: Mode,
  game?: StoredGame | null,
): ReviewContent | null {
  const done = game === undefined ? loadGame(dayKeyFor(today), mode) : game;
  if (!done) return null;
  const play = strings.play;
  const full = play.fullTime;
  const label = strings.home.modes[mode].label;
  const text = strings.home.review;
  const questions = questionsFor(mode);
  const results: FullTimeResult[] = done.turns.map((turn) => {
    const question = questions.find((q) => q.id === turn.questionId);
    const answer =
      turn.answerId === null
        ? null
        : (question?.answers.find((a) => a.id === turn.answerId) ?? null);
    return {
      grade: turn.grade,
      points: turn.points,
      label: isShot(turn.grade) ? play.shots[turn.grade] : undefined,
      // An answer the game no longer knows is shown as it was typed.
      answer:
        answer?.name ??
        (turn.grade === "timeup"
          ? full.timeup
          : turn.grade === "skipped"
            ? full.skipped
            : (turn.input ?? full.skipped)),
    };
  });
  const titles: Readonly<Record<string, string>> = play.titles[mode];
  return {
    labels: {
      heading: text.heading(label),
      close: text.close,
    },
    mode,
    total: done.total,
    maxTotal: MAX_TOTAL,
    totalSpoken: full.totalSpoken(done.total, MAX_TOTAL),
    careerTitle: play.tiers[careerFor(done.total).id],
    earnedTitle: titles[titleFor(mode, done.total)] || undefined,
    earnedTitleSpoken: full.titleSpoken,
    results,
    resultsLabel: full.results,
  };
}
