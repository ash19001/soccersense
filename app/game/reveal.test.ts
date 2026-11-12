import { describe, expect, it } from "vitest";

import { SCORING_SHOTS, revealRows, shotRows } from "./reveal";
import { rankAnswers } from "./scoring";
import { SHOT_POINTS } from "./shots";
import { ORIGIN, popular, question } from "./test-fixtures";
import type { Answer, Question, Shot } from "./types";

/** A question whose answers are filed by hand, for exact control of the shots. */
function filed(rows: readonly [string, number, Shot][]): Question {
  const answers: Answer[] = rows.map(([name, share, shot]) => ({
    ...popular(name, share),
    shot,
  }));
  return { ...question("filed", []), answers };
}

/** Two answers in every scoring shot (the less popular first in each) and two misses. */
const TWO_EACH = filed([
  ["Worldie low", 15, "worldie"],
  ["Worldie high", 20, "worldie"],
  ["Golazo low", 9, "golazo"],
  ["Golazo high", 11, "golazo"],
  ["Trivela low", 7, "trivela"],
  ["Trivela high", 8, "trivela"],
  ["Toe poke low", 5, "toepoke"],
  ["Toe poke high", 6, "toepoke"],
  ["Tap in low", 3, "tapin"],
  ["Tap in high", 4, "tapin"],
  ["Miss low", 1, "miss"],
  ["Miss high", 2, "miss"],
]);

const names = (rows: readonly { answer: Answer }[]) =>
  rows.map((r) => r.answer.name);

describe("SCORING_SHOTS", () => {
  it("is the five shots that score, best first", () => {
    expect(SCORING_SHOTS).toEqual([
      "worldie",
      "golazo",
      "trivela",
      "toepoke",
      "tapin",
    ]);
  });
});

describe("revealRows", () => {
  it("shows the best answer of each shot after a pass or a time-up", () => {
    const rows = revealRows(TWO_EACH, "home", { answerId: null }, ORIGIN);
    expect(names(rows)).toEqual([
      "Worldie high",
      "Golazo high",
      "Trivela high",
      "Toe poke high",
      "Tap in high",
    ]);
    expect(rows.map((r) => r.shot)).toEqual(SCORING_SHOTS);
    expect(rows.map((r) => r.grade)).toEqual(SCORING_SHOTS);
    expect(rows.map((r) => r.points)).toEqual([100, 80, 60, 30, 10]);
    expect(rows.some((r) => r.isPlayer)).toBe(false);
  });

  it("puts the player's scoring answer in its own shot's row, and only there", () => {
    for (const shot of SCORING_SHOTS) {
      const mine = TWO_EACH.answers.find(
        (a) => a.shot === shot && a.name.endsWith("low"),
      );
      if (!mine) throw new Error(shot);
      const rows = revealRows(TWO_EACH, "home", { answerId: mine.id }, ORIGIN);
      expect(rows).toHaveLength(5);
      const yours = rows.filter((r) => r.isPlayer);
      expect(yours).toHaveLength(1);
      expect(yours[0].answer).toBe(mine);
      expect(yours[0].shot).toBe(shot);
      expect(yours[0].points).toBe(SHOT_POINTS[shot]);
      // The other rows are unchanged: the best answer of their shot.
      expect(
        names(rows.filter((r) => !r.isPlayer)).every((n) => n.endsWith("high")),
      ).toBe(true);
    }
  });

  it("never shows a miss: a listed miss leaves the five rows as they are", () => {
    const miss = TWO_EACH.answers.find((a) => a.name === "Miss high");
    const rows = revealRows(
      TWO_EACH,
      "home",
      { answerId: miss?.id ?? "" },
      ORIGIN,
    );
    expect(names(rows)).toEqual(
      names(revealRows(TWO_EACH, "home", { answerId: null }, ORIGIN)),
    );
    expect(rows.some((r) => r.isPlayer || r.shot === "miss")).toBe(false);
  });

  it("an id that is not in the question marks nothing", () => {
    const rows = revealRows(TWO_EACH, "home", { answerId: "nobody" }, ORIGIN);
    expect(rows).toHaveLength(5);
    expect(rows.some((r) => r.isPlayer)).toBe(false);
  });

  it("takes the least picked answer of a shot in AWAY: the one ranked highest", () => {
    // The same question played in AWAY: its shots come from the niche rule.
    const crowd = question(
      "crowd",
      [
        popular("A", 30),
        popular("B", 20),
        popular("C", 12),
        popular("D", 9),
        popular("E", 7),
        popular("F", 6),
        popular("G", 5),
        popular("H", 4),
        popular("I", 3),
        popular("J", 2),
        popular("K", 1.5),
        popular("L", 0.5),
      ],
      "away",
    );
    const table = rankAnswers(crowd, ORIGIN, "niche");
    const rows = revealRows(crowd, "away", { answerId: null }, ORIGIN);
    for (const row of rows) {
      const inShot = table.filter((r) => r.shot === row.shot);
      expect(row.share).toBe(Math.min(...inShot.map((r) => r.share)));
      expect(row.index).toBe(table.indexOf(inShot[0]));
    }
    expect(rows[0].shot).toBe("worldie");
    // The worldie row is the table's #1: the deepest cut that AWAY's pass sentence names.
    expect(rows[0].index).toBe(0);
    expect(rows[0].answer.name).toBe("L");
  });

  it("always shows the table's #1 as the worldie row when the player has not taken it", () => {
    for (const mode of ["home", "away"] as const) {
      const table = rankAnswers(
        TWO_EACH,
        ORIGIN,
        mode === "home" ? "common" : "niche",
      );
      const rows = revealRows(TWO_EACH, mode, { answerId: null }, ORIGIN);
      expect(rows[0].index).toBe(0);
      expect(rows[0].answer).toBe(table[0].answer);
      // Each row is the first of its shot in the table.
      for (const row of rows) {
        expect(row.index).toBe(table.findIndex((r) => r.shot === row.shot));
      }
    }
  });

  it("breaks a tie in popularity by the table's order, so it is the same every time", () => {
    const tied = filed([
      ["Zed", 30, "worldie"],
      ["Bravo", 10, "golazo"],
      ["Alpha", 10, "golazo"],
      ["Miss", 1, "miss"],
    ]);
    const rows = revealRows(tied, "home", { answerId: null }, ORIGIN);
    expect(names(rows)).toEqual(["Zed", "Alpha"]);
    expect(names(revealRows(tied, "home", { answerId: null }, ORIGIN))).toEqual(
      names(rows),
    );
  });

  it("shows the rows it has when a shot has no answer, and nothing for no answers", () => {
    const gappy = filed([
      ["Top", 50, "worldie"],
      ["Middle", 30, "trivela"],
      ["Low", 15, "tapin"],
      ["Bottom", 5, "miss"],
    ]);
    const rows = revealRows(gappy, "home", { answerId: null }, ORIGIN);
    expect(rows.map((r) => r.shot)).toEqual(["worldie", "trivela", "tapin"]);
    expect(shotRows([], "anything")).toEqual([]);
    expect(shotRows([], null)).toEqual([]);
  });

  it("carries each row's rank and place in the full table", () => {
    const table = rankAnswers(TWO_EACH, ORIGIN, "common");
    const rows = shotRows(table, null);
    for (const row of rows) {
      expect(table[row.index].answer).toBe(row.answer);
      expect(row.rank).toBe(table[row.index].rank);
    }
    expect(rows.map((r) => r.index)).toEqual([0, 2, 4, 6, 8]);
  });
});
