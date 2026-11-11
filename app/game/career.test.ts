import { describe, expect, it } from "vitest";

import {
  careerFor,
  isPerfect,
  MAX_TOTAL,
  tierFor,
  TIER_STEP,
  TIERS,
  tiersCrossed,
  TOP_TIER,
} from "./career";

describe("TIERS", () => {
  it("is the ladder from the game design brief", () => {
    expect(TIERS).toEqual([
      { tier: 0, from: 0, id: "park" },
      { tier: 1, from: 90, id: "sunday" },
      { tier: 2, from: 180, id: "nonleague" },
      { tier: 3, from: 270, id: "lower" },
      { tier: 4, from: 360, id: "topflight" },
      { tier: 5, from: 450, id: "international" },
      { tier: 6, from: 540, id: "final" },
      { tier: 7, from: 630, id: "winner" },
    ]);
  });

  it("steps up every 90 points and is indexed by tier", () => {
    TIERS.forEach((t, i) => {
      expect(t.tier).toBe(i);
      expect(t.from).toBe(i * TIER_STEP);
    });
    expect(TOP_TIER).toBe(7);
    expect(MAX_TOTAL).toBe(700);
  });

  it("puts the top tier out of reach until the last question", () => {
    expect(tierFor(6 * 100)).toBe(6);
    expect(tierFor(7 * 100)).toBe(7);
  });
});

describe("careerFor", () => {
  it("starts in the park", () => {
    expect(careerFor(0)).toEqual({
      tier: 0,
      id: "park",
      from: 0,
      next: 90,
      progress: 0,
    });
  });

  it.each(TIERS.filter((t) => t.tier > 0))(
    "promotes to tier $tier at exactly $from points",
    ({ tier, from }) => {
      const below = careerFor(from - 1);
      expect(below.tier).toBe(tier - 1);
      expect(below.from).toBe(from - TIER_STEP);
      expect(below.next).toBe(from);
      expect(below.progress).toBeCloseTo(89 / 90, 10);

      const at = careerFor(from);
      expect(at.tier).toBe(tier);
      expect(at.from).toBe(from);

      const above = careerFor(from + 1);
      expect(above.tier).toBe(tier);
      expect(tierFor(from - 1)).toBe(tier - 1);
      expect(tierFor(from)).toBe(tier);
    },
  );

  it("measures progress towards the next tier", () => {
    expect(careerFor(45)).toEqual({
      tier: 0,
      id: "park",
      from: 0,
      next: 90,
      progress: 0.5,
    });
    expect(careerFor(90)).toEqual({
      tier: 1,
      id: "sunday",
      from: 90,
      next: 180,
      progress: 0,
    });
    expect(careerFor(135).progress).toBe(0.5);
    expect(careerFor(512)).toMatchObject({ tier: 5, from: 450, next: 540 });
    expect(careerFor(512).progress).toBeCloseTo(62 / 90, 10);
    expect(careerFor(629).progress).toBeCloseTo(89 / 90, 10);
  });

  it("is complete at the top tier", () => {
    for (const total of [630, 631, 699, 700]) {
      expect(careerFor(total)).toEqual({
        tier: 7,
        id: "winner",
        from: 630,
        next: null,
        progress: 1,
      });
    }
  });

  it("clamps totals outside 0 to 700", () => {
    expect(careerFor(-10)).toMatchObject({ tier: 0, next: 90, progress: 0 });
    expect(careerFor(9999).tier).toBe(7);
  });
});

describe("tiersCrossed", () => {
  it("is empty when no threshold is crossed", () => {
    expect(tiersCrossed(0, 0)).toEqual([]);
    expect(tiersCrossed(0, 89)).toEqual([]);
    expect(tiersCrossed(90, 90)).toEqual([]);
    expect(tiersCrossed(90, 179)).toEqual([]);
    expect(tiersCrossed(630, 700)).toEqual([]);
  });

  it("lists a single promotion", () => {
    expect(tiersCrossed(89, 90)).toEqual([1]);
    expect(tiersCrossed(0, 100)).toEqual([1]);
    expect(tiersCrossed(100, 200)).toEqual([2]);
    expect(tiersCrossed(629, 630)).toEqual([7]);
    expect(tiersCrossed(600, 700)).toEqual([7]);
  });

  it("lists every tier a big answer jumps through, in order", () => {
    expect(tiersCrossed(85, 185)).toEqual([1, 2]);
    expect(tiersCrossed(170, 270)).toEqual([2, 3]);
    expect(tiersCrossed(0, 700)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("is empty when the total does not go up", () => {
    expect(tiersCrossed(200, 100)).toEqual([]);
    expect(tiersCrossed(700, 0)).toEqual([]);
  });

  it("matches a perfect game one answer at a time", () => {
    const steps: number[][] = [];
    for (let total = 0; total < 700; total += 100) {
      steps.push(tiersCrossed(total, total + 100));
    }
    expect(steps).toEqual([[1], [2], [3], [4], [5], [6], [7]]);
  });
});

describe("isPerfect", () => {
  it("is true only for a full 700", () => {
    expect(isPerfect(700)).toBe(true);
    expect(isPerfect(699)).toBe(false);
    expect(isPerfect(0)).toBe(false);
  });
});
