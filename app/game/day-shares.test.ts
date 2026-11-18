import { describe, expect, it } from "vitest";

import {
  DAY_WEIGHT_HALF,
  DAY_WEIGHT_MOST,
  blendShares,
  dayWeight,
  scoredToday,
  sharesMove,
} from "./day-shares";
import { rankAnswers } from "./scoring";
import { shotsFor } from "./shots";
import { popular, question } from "./test-fixtures";

const counts = (entries: Record<string, number>) =>
  new Map(Object.entries(entries));

/** A HOME question: one obvious answer, a few others, a rare one. */
const home = question("q-home", [
  popular("Messi", 32),
  popular("Ronaldo", 25),
  popular("Neymar", 12),
  popular("Mbappe", 8),
  popular("Salah", 4),
  popular("Kane", 2),
  popular("Obscure", 0.1),
]);
const away = { ...home, id: "q-away", mode: "away" as const };

describe("how much the day weighs", () => {
  it("is nothing before anyone has answered", () => {
    expect(dayWeight(0)).toBe(0);
    expect(dayWeight(-3)).toBe(0);
    expect(dayWeight(Number.NaN)).toBe(0);
  });

  it("is half its most after DAY_WEIGHT_HALF answers, and never passes the most", () => {
    expect(dayWeight(DAY_WEIGHT_HALF)).toBeCloseTo(DAY_WEIGHT_MOST / 2, 10);
    expect(dayWeight(1)).toBeLessThan(0.002);
    expect(dayWeight(1e9)).toBeLessThan(DAY_WEIGHT_MOST);
    expect(dayWeight(1e9)).toBeGreaterThan(DAY_WEIGHT_MOST - 0.001);
  });

  it("is the foundation's at least two thirds", () => {
    expect(1 - DAY_WEIGHT_MOST).toBeGreaterThan(0.6);
  });
});

describe("which modes move", () => {
  it("HOME and AWAY, scored on shares; never RETRO or NEXT-GEN, scored on years", () => {
    expect(sharesMove("home")).toBe(true);
    expect(sharesMove("away")).toBe(true);
    expect(sharesMove("retro")).toBe(false);
    expect(sharesMove("nextgen")).toBe(false);
  });
});

describe("the blend", () => {
  it("is the natural shares while nothing has been counted", () => {
    expect(blendShares(home, new Map())).toEqual(
      home.answers.map((a) => a.popularity),
    );
  });

  it("keeps the obvious answer common in AWAY, even when hardly anyone types it", () => {
    // A big day: 1% typed Messi, 99% something rare.
    const shares = blendShares(
      away,
      counts({ messi: 10_000, obscure: 990_000 }),
    );
    // natural 32%, the day's 1%: still about 21%
    expect(shares[0]).toBeCloseTo(0.65 * 32 + 0.35 * 1, 1);
  });

  it("undoes a leak: a rare answer copied by many is no longer rare", () => {
    const shares = blendShares(
      away,
      counts({ obscure: 300_000, messi: 700_000 }),
    );
    // natural 0.1%, typed by 30%: about 10.6%
    expect(shares[6]).toBeCloseTo(0.65 * 0.1 + 0.35 * 30, 1);
  });

  it("comes in gently: one answer barely moves anything", () => {
    const shares = blendShares(home, counts({ obscure: 1 }));
    expect(shares[6] - 0.1).toBeLessThan(0.2);
    expect(shares[0]).toBeGreaterThan(31.9);
  });

  it("leaves out counts for answers the question does not have", () => {
    expect(blendShares(home, counts({ "someone-else": 500 }))).toEqual(
      home.answers.map((a) => a.popularity),
    );
  });
});

describe("a question as it is scored on its day", () => {
  it("is the same question while nothing has been counted, or in RETRO and NEXT-GEN", () => {
    expect(scoredToday(home, new Map())).toBe(home);
    const retro = { ...home, mode: "retro" as const };
    expect(scoredToday(retro, counts({ messi: 500 }))).toBe(retro);
  });

  it("has the blended shares, and its shots filed again from them by the mode's rule", () => {
    const day = counts({ obscure: 600, messi: 200 });
    const scored = scoredToday(away, day);
    const shares = scored.answers.map((a) => a.popularity);
    expect(shares).toEqual(
      blendShares(away, day).map((s) => Math.round(s * 1000) / 1000),
    );
    expect(scored.answers.map((a) => a.shot)).toEqual(
      shotsFor(shares, "niche"),
    );
    // the rare answer everyone gave is no longer AWAY's best
    const best = rankAnswers(scored, { lat: 0, lng: 0 }, "niche")[0];
    expect(best.answer.id).not.toBe("obscure");
    // the rest of each answer is as it was, and the question given is not changed
    expect(scored.answers.map((a) => a.id)).toEqual(
      away.answers.map((a) => a.id),
    );
    expect(away.answers[6].popularity).toBe(0.1);
  });

  it("in HOME, lifts an answer the day gives a lot", () => {
    const scored = scoredToday(home, counts({ kane: 3000 }));
    const kane = scored.answers.find((a) => a.id === "kane");
    expect(kane?.popularity).toBeGreaterThan(20);
    expect(kane?.shot).not.toBe(
      home.answers.find((a) => a.id === "kane")?.shot,
    );
  });
});
