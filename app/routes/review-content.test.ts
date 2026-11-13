import { describe, expect, it } from "vitest";

import { questionsFor } from "~/data";
import { MAX_TOTAL, SHOT_POINTS, type StoredGame } from "~/game";
import { strings } from "~/i18n";

import { reviewContent } from "./review-content";

/** A finished HOME game: a WORLDIE with the first answer, a time-up, then passes. */
function game(): StoredGame {
  const questions = questionsFor("home");
  const turns = questions.map((q, i) => {
    const first = i === 0;
    return {
      questionId: q.id,
      input: first ? q.answers[0].name : null,
      answerId: first ? q.answers[0].id : null,
      grade: first
        ? ("worldie" as const)
        : i === 1
          ? ("timeup" as const)
          : ("skipped" as const),
      points: first ? SHOT_POINTS.worldie : 0,
      km: null,
      share: null,
      rank: null,
      msLeft: 0,
    };
  });
  return { total: SHOT_POINTS.worldie, turns };
}

describe("reviewContent", () => {
  it("is nothing for a mode not finished today", () => {
    expect(reviewContent(4, "home", null)).toBeNull();
  });

  it("says the day's game as the full-time card did: total, title, tier and seven answers", () => {
    const saved = game();
    const review = reviewContent(4, "home", saved);
    expect(review).not.toBeNull();
    if (!review) return;
    const play = strings.play;
    expect(review.mode).toBe("home");
    expect(review.labels.heading).toBe(strings.home.review.heading("HOME"));
    // no line under the heading
    expect(review.labels.intro).toBeUndefined();
    expect(review.total).toBe(100);
    expect(review.maxTotal).toBe(MAX_TOTAL);
    expect(review.totalSpoken).toBe(play.fullTime.totalSpoken(100, MAX_TOTAL));
    expect(review.careerTitle.length).toBeGreaterThan(0);
    expect(review.results).toHaveLength(saved.turns.length);
    expect(review.results[0]).toEqual({
      grade: "worldie",
      points: 100,
      label: play.shots.worldie,
      answer: questionsFor("home")[0].answers[0].name,
    });
    expect(review.results[1]).toMatchObject({
      grade: "timeup",
      answer: play.fullTime.timeup,
      label: undefined,
    });
    expect(review.results[2]).toMatchObject({
      grade: "skipped",
      answer: play.fullTime.skipped,
    });
  });

  it("shows an answer the game no longer knows as it was typed", () => {
    const saved = game();
    const turns = saved.turns.map((t, i) =>
      i === 0 ? { ...t, answerId: "gone", input: "Old Name FC" } : t,
    );
    const review = reviewContent(4, "home", { ...saved, turns });
    expect(review?.results[0].answer).toBe("Old Name FC");
  });
});
