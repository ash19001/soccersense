import { describe, expect, it } from "vitest";

import {
  SHOT_BANDS,
  SHOT_ORDER,
  SHOT_POINTS,
  isGoal,
  isShot,
  shotForStanding,
  shotIndex,
  shotsFor,
  standings,
} from "./shots";
import type { Grade, Rule } from "./types";

const RULES: Rule[] = ["common", "niche", "closest", "furthest"];

describe("the six shots", () => {
  it("are worth 100, 80, 60, 30, 10 and 0, best first", () => {
    expect(SHOT_ORDER).toEqual([
      "worldie",
      "golazo",
      "trivela",
      "toepoke",
      "tapin",
      "miss",
    ]);
    expect(SHOT_ORDER.map((shot) => SHOT_POINTS[shot])).toEqual([
      100, 80, 60, 30, 10, 0,
    ]);
  });

  it("give nothing for a time-up or a pass", () => {
    expect(SHOT_POINTS.timeup).toBe(0);
    expect(SHOT_POINTS.skipped).toBe(0);
    expect(Object.keys(SHOT_POINTS).sort()).toEqual(
      [...SHOT_ORDER, "timeup", "skipped"].sort(),
    );
  });

  it("are all goals but the miss", () => {
    const grades: Grade[] = [...SHOT_ORDER, "timeup", "skipped"];
    expect(grades.filter(isShot)).toEqual(SHOT_ORDER);
    expect(grades.filter(isGoal)).toEqual([
      "worldie",
      "golazo",
      "trivela",
      "toepoke",
      "tapin",
    ]);
    expect(grades.map(shotIndex)).toEqual([0, 1, 2, 3, 4, 5, 6, 6]);
  });
});

describe("shotForStanding", () => {
  it.each([
    [0, "worldie"],
    [0.1, "worldie"],
    [0.11, "golazo"],
    [0.25, "golazo"],
    [0.26, "trivela"],
    [0.42, "trivela"],
    [0.43, "toepoke"],
    [0.58, "toepoke"],
    [0.59, "tapin"],
    [0.8, "tapin"],
    [0.81, "miss"],
    [1, "miss"],
  ])("%s is %s", (standing, shot) => {
    expect(shotForStanding(standing)).toBe(shot);
  });

  it("has one band per shot, in order, ending at 1", () => {
    expect(SHOT_BANDS.map((b) => b.shot)).toEqual(SHOT_ORDER);
    for (let i = 1; i < SHOT_BANDS.length; i++) {
      expect(SHOT_BANDS[i].upTo).toBeGreaterThan(SHOT_BANDS[i - 1].upTo);
    }
    expect(SHOT_BANDS[SHOT_BANDS.length - 1].upTo).toBe(1);
  });
});

describe("standings", () => {
  it("is the mean of the place and the gap", () => {
    // 40, 20, 10: place 0, 0.5, 1; gap in halvings 0, 0.5, 1.
    expect(standings([40, 20, 10], "common")).toEqual([0, 0.5, 1]);
    const niche = standings([40, 20, 10], "niche");
    expect(niche[0]).toBe(1);
    expect(niche[1]).toBeCloseTo(0.5, 12);
    expect(niche[2]).toBe(0);
    // 100, 200, 400 km: place 0, 0.5, 1; gap 0, 1/3, 1.
    const near = standings([100, 200, 400], "closest");
    expect(near[0]).toBe(0);
    expect(near[1]).toBeCloseTo((0.5 + 1 / 3) / 2, 12);
    expect(near[2]).toBe(1);
  });

  it("measures shares as ratios and distances in kilometres", () => {
    // 30 and 15 are as far apart as 2 and 1 (a halving each).
    const shares = standings([30, 15, 2, 1], "common");
    expect(shares[1] - shares[0]).toBeCloseTo(
      (1 / 3 + Math.log(2) / Math.log(30)) / 2,
      12,
    );
    const far = standings([1000, 900, 0], "furthest");
    expect(far[1]).toBeCloseTo((0.5 + 0.1) / 2, 12);
  });

  it("ties shares to a tenth of a percent, and equal distances", () => {
    const s = standings([10, 4.04, 3.96, 1], "common");
    expect(s[1]).toBe(s[2]);
    const d = standings([5, 7, 7, 9], "closest");
    expect(d[1]).toBe(d[2]);
  });

  it("puts the best at 0 and the worst at 1 even when they are tied", () => {
    expect(standings([3, 3, 2, 1, 1], "common")).toEqual([
      0,
      0,
      expect.closeTo((0.5 + Math.log(1.5) / Math.log(3)) / 2, 12),
      1,
      1,
    ]);
  });

  it("stands one answer, or all tied, at 0", () => {
    for (const rule of RULES) {
      expect(standings([7], rule)).toEqual([0]);
      expect(standings([4, 4, 4], rule)).toEqual([0, 0, 0]);
      expect(standings([], rule)).toEqual([]);
    }
  });

  it("copes with shares of nothing", () => {
    const s = standings([50, 0, 0.1], "niche");
    expect(s.every(Number.isFinite)).toBe(true);
    expect(s[1]).toBe(0);
    expect(standings([0, 0], "common")).toEqual([0, 0]);
  });
});

describe("shotsFor", () => {
  it("makes the best a worldie and the worst a miss", () => {
    for (const rule of RULES) {
      const s = shotsFor([1, 2, 3, 4, 5, 6, 7, 8], rule);
      const best = rule === "common" || rule === "furthest" ? 7 : 0;
      expect(s[best]).toBe("worldie");
      expect(s[7 - best]).toBe("miss");
    }
  });

  it("never gives a better answer a worse shot", () => {
    // A long tail, like the sample questions: a few big shares and many small ones.
    const shares = Array.from(
      { length: 60 },
      (_, i) => Math.round(300 / (1 + i * 0.3)) / 10,
    );
    for (const rule of ["common", "niche"] as const) {
      const s = shotsFor(shares, rule);
      const order = shares
        .map((share, i) => ({ share, i }))
        .sort((a, b) =>
          rule === "common" ? b.share - a.share : a.share - b.share,
        );
      for (let k = 1; k < order.length; k++) {
        expect(shotIndex(s[order[k].i])).toBeGreaterThanOrEqual(
          shotIndex(s[order[k - 1].i]),
        );
      }
      expect(new Set(s)).toEqual(new Set(SHOT_ORDER));
    }
  });

  it("files the Premier League's winners as a fan would, HOME and AWAY", () => {
    // Manchester United 30, City 21, Liverpool 17, Arsenal 14, Chelsea 12, Leicester 4,
    // Blackburn 2 (the sample data's estimates).
    const shares = [30, 21, 17, 14, 12, 4, 2];
    expect(shotsFor(shares, "common")).toEqual([
      "worldie",
      "golazo",
      "trivela",
      "trivela",
      "toepoke",
      "tapin",
      "miss",
    ]);
    expect(shotsFor(shares, "niche")).toEqual([
      "miss",
      "miss",
      "tapin",
      "tapin",
      "toepoke",
      "golazo",
      "worldie",
    ]);
  });
});
