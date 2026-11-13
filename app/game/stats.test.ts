import { describe, expect, it } from "vitest";

import { OUTCOMES, apportion, outcomeOf, statsFor, streakFor } from "./stats";
import type { PlayedGame } from "./storage";
import type { Grade, Mode } from "./types";

const POINTS: Record<Grade, number> = {
  worldie: 100,
  golazo: 80,
  trivela: 60,
  toepoke: 30,
  tapin: 10,
  miss: 0,
  timeup: 0,
  skipped: 0,
};

function game(day: number, mode: Mode, grades: Grade[]): PlayedGame {
  return {
    day,
    mode,
    grades,
    points: grades.map((g) => POINTS[g]),
    total: grades.reduce((sum, g) => sum + POINTS[g], 0),
  };
}

describe("outcomeOf", () => {
  it("is the shot, or none for a pass or a time-up", () => {
    expect(outcomeOf("golazo")).toBe("golazo");
    expect(outcomeOf("miss")).toBe("miss");
    expect(outcomeOf("timeup")).toBe("none");
    expect(outcomeOf("skipped")).toBe("none");
    expect(OUTCOMES).toEqual([
      "worldie",
      "golazo",
      "trivela",
      "toepoke",
      "tapin",
      "miss",
      "none",
    ]);
  });
});

describe("streakFor", () => {
  it("counts the run that ends today", () => {
    expect(streakFor([3, 4, 5], 5)).toEqual({ current: 3, best: 3 });
  });

  it("keeps yesterday's run alive while today is not played yet", () => {
    expect(streakFor([3, 4], 5)).toEqual({ current: 2, best: 2 });
  });

  it("is broken by a missed day", () => {
    expect(streakFor([1, 2, 3, 4, 6], 8)).toEqual({ current: 0, best: 4 });
    expect(streakFor([1, 2, 3, 4, 6], 6)).toEqual({ current: 1, best: 4 });
  });

  it("counts a day once however many games it had, in any order", () => {
    expect(streakFor([5, 4, 5, 4, 3], 5)).toEqual({ current: 3, best: 3 });
  });

  it("leaves out days after today, and is nothing with no days", () => {
    expect(streakFor([5, 6, 7], 5)).toEqual({ current: 1, best: 1 });
    expect(streakFor([], 5)).toEqual({ current: 0, best: 0 });
  });
});

describe("statsFor", () => {
  const history = [
    game(2, "home", ["worldie", "golazo", "miss", "timeup"]),
    game(3, "away", ["tapin", "skipped"]),
    game(4, "home", ["worldie", "worldie"]),
    game(5, "home", ["golazo", "golazo", "trivela"]),
    // Played with ?day= ahead of today: not counted.
    game(9, "home", ["worldie"]),
  ];

  it("is empty on a first visit", () => {
    const stats = statsFor([], 5);
    expect(stats.played).toBe(0);
    expect(stats.streak).toEqual({ current: 0, best: 0 });
    expect(stats.modes.map((m) => m.mode)).toEqual([
      "home",
      "away",
      "retro",
      "nextgen",
    ]);
    for (const mode of stats.modes) {
      expect(mode).toMatchObject({
        today: null,
        played: 0,
        average: null,
        best: null,
        answers: 0,
      });
      expect(Object.values(mode.tally).every((n) => n === 0)).toBe(true);
    }
  });

  it("works out each mode over the history", () => {
    const stats = statsFor(history, 5);
    expect(stats.played).toBe(4);
    expect(stats.streak).toEqual({ current: 4, best: 4 });
    const [home, away] = stats.modes;
    expect(home.played).toBe(3);
    // 180, 200, 220: the mean is 200.
    expect(home.average).toBe(200);
    expect(home.best).toEqual({ total: 220, day: 5 });
    expect(home.today?.total).toBe(220);
    expect(home.answers).toBe(9);
    expect(home.tally).toEqual({
      worldie: 3,
      golazo: 3,
      trivela: 1,
      toepoke: 0,
      tapin: 0,
      miss: 1,
      none: 1,
    });
    expect(away.played).toBe(1);
    expect(away.today).toBeNull();
    expect(away.best).toEqual({ total: 10, day: 3 });
    expect(away.tally.none).toBe(1);
  });

  it("names the first day a best total was made", () => {
    const stats = statsFor(
      [game(1, "away", ["golazo"]), game(2, "away", ["golazo"])],
      2,
    );
    expect(stats.modes[1].best).toEqual({ total: 80, day: 1 });
  });

  it("rounds the average to a whole point", () => {
    const stats = statsFor(
      [
        game(1, "home", ["tapin"]),
        game(2, "home", ["tapin"]),
        game(3, "home", ["toepoke"]),
      ],
      3,
    );
    // 50 / 3 = 16.67
    expect(stats.modes[0].average).toBe(17);
  });

  it("is built over the modes it is given, in their order", () => {
    const stats = statsFor(history, 5, ["away"]);
    expect(stats.modes.map((m) => m.mode)).toEqual(["away"]);
    expect(stats.played).toBe(1);
  });
});

describe("apportion", () => {
  it("shares the cells out in proportion, adding up exactly", () => {
    expect(apportion([1, 1], 10)).toEqual([5, 5]);
    expect(apportion([1, 2, 1], 8)).toEqual([2, 4, 2]);
    const cells = apportion([3, 3, 1, 0, 0, 1, 1], 100);
    expect(cells.reduce((a, b) => a + b, 0)).toBe(100);
    expect(cells[3]).toBe(0);
  });

  it("gives every count above 0 at least one cell", () => {
    const cells = apportion([500, 1, 0, 1], 60);
    expect(cells.reduce((a, b) => a + b, 0)).toBe(60);
    expect(cells[1]).toBeGreaterThanOrEqual(1);
    expect(cells[3]).toBeGreaterThanOrEqual(1);
    expect(cells[2]).toBe(0);
  });

  it("gives nothing for nothing", () => {
    expect(apportion([0, 0, 0], 60)).toEqual([0, 0, 0]);
    expect(apportion([1, 2], 0)).toEqual([0, 0]);
    expect(apportion([], 60)).toEqual([]);
    expect(apportion([Number.NaN, -3, 2], 4)).toEqual([0, 0, 4]);
  });
});
