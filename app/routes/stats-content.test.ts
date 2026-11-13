import { afterEach, describe, expect, it, vi } from "vitest";

import { MODES, type PlayedGame, saveGame, dayKeyFor } from "~/game";
import { strings } from "~/i18n";
import { STATS_BAR_CELLS } from "~/ui";
import { statsContent } from "./stats-content";

const HOME: PlayedGame = {
  day: 1,
  mode: "home",
  total: 380,
  grades: [
    "worldie",
    "golazo",
    "trivela",
    "miss",
    "tapin",
    "worldie",
    "toepoke",
  ],
  points: [100, 80, 60, 0, 10, 100, 30],
};
const AWAY: PlayedGame = {
  day: 2,
  mode: "away",
  total: 330,
  grades: [
    "golazo",
    "skipped",
    "worldie",
    "trivela",
    "timeup",
    "tapin",
    "golazo",
  ],
  points: [80, 0, 100, 60, 0, 10, 80],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("statsContent", () => {
  it("is the empty state on a first visit, over every mode", () => {
    const content = statsContent(2, []);
    expect(content.empty).toBe(true);
    expect(content.modes.map((m) => m.mode)).toEqual([...MODES]);
    expect(content.labels.disclaimer).toBe(strings.legal.disclaimer);
  });

  it("puts a HOME game and an AWAY game on two days into words", () => {
    const content = statsContent(2, [HOME, AWAY]);
    expect(content.empty).toBe(false);
    expect(content.streak).toEqual({ current: 2, best: 2 });
    const [home, away] = content.modes;
    expect(home.label).toBe("HOME");
    expect(home.today).toBeNull();
    expect(home.best).toEqual({ total: 380, day: 1 });
    expect(away.today?.total).toBe(330);
    expect(away.today?.title).toBe(strings.play.titles.away.thirdkit);
    expect(away.today?.shots.map((s) => [s.label, s.points])).toEqual([
      ["GOLAZO", 80],
      ["PASSED", 0],
      ["WORLDIE", 100],
      ["TRIVELA", 60],
      ["TIME'S UP", 0],
      ["TAP IN", 10],
      ["GOLAZO", 80],
    ]);
    // The tally: the six shots and no answer, the bar's cells adding up.
    expect(away.tally.map((t) => [t.label, t.count])).toEqual([
      ["WORLDIE", 1],
      ["GOLAZO", 2],
      ["TRIVELA", 1],
      ["TOE POKE", 0],
      ["TAP IN", 1],
      ["MISS", 0],
      [strings.stats.none, 2],
    ]);
    expect(away.tally.at(-1)?.grade).toBe("timeup");
    expect(away.tally.reduce((sum, t) => sum + t.cells, 0)).toBe(
      STATS_BAR_CELLS,
    );
  });

  it("shows today's points as saved, so a game saved under older points adds up", () => {
    const old: PlayedGame = {
      ...AWAY,
      total: 350,
      points: [80, 0, 100, 80, 0, 10, 80],
    };
    const content = statsContent(2, [HOME, old]);
    const shots = content.modes[1].today?.shots ?? [];
    expect(shots.map((s) => s.points)).toEqual(old.points);
    expect(shots.reduce((sum, s) => sum + s.points, 0)).toBe(old.total);
  });

  it("reads the history from the device when it is not given", () => {
    const items = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => items.get(k) ?? null,
      setItem: (k: string, v: string) => void items.set(k, v),
      removeItem: (k: string) => void items.delete(k),
      key: (i: number) => [...items.keys()][i] ?? null,
      get length() {
        return items.size;
      },
    });
    saveGame(dayKeyFor(3), "home", {
      total: 100,
      turns: [
        {
          questionId: "q1",
          input: "x",
          answerId: "x",
          grade: "worldie",
          points: 100,
          km: null,
          share: 30,
          rank: 1,
          msLeft: 1000,
        },
      ],
    });
    const content = statsContent(3);
    expect(content.empty).toBe(false);
    expect(content.modes[0].today?.total).toBe(100);
  });
});
