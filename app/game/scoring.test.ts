import { describe, expect, it } from "vitest";

import { gradeFor, rankAnswers, rankedFor, tableExcerpt } from "./scoring";
import { answer, east, ORIGIN, question } from "./test-fixtures";
import type { Mode, RankedAnswer } from "./types";

const names = (table: readonly RankedAnswer[]) =>
  table.map((r) => r.answer.name);
const points = (table: readonly RankedAnswer[]) => table.map((r) => r.points);
const ranks = (table: readonly RankedAnswer[]) => table.map((r) => r.rank);
const kms = (table: readonly RankedAnswer[]) => table.map((r) => r.km);

const MODES: Mode[] = ["home", "away"];

describe("rankAnswers", () => {
  // Deliberately out of order in the list.
  const five = question("five", [
    east("Charlie", 3),
    east("Alpha", 1),
    east("Echo", 5),
    east("Bravo", 2),
    east("Delta", 4),
  ]);

  it("rounds each distance to whole kilometres", () => {
    const table = rankAnswers(five, ORIGIN, "home");
    expect(kms(table)).toEqual([111, 222, 334, 445, 556]);
  });

  it("HOME: nearest first, 100 for the best down to 0 for the worst", () => {
    const table = rankAnswers(five, ORIGIN, "home");
    expect(names(table)).toEqual([
      "Alpha",
      "Bravo",
      "Charlie",
      "Delta",
      "Echo",
    ]);
    expect(points(table)).toEqual([100, 75, 50, 25, 0]);
    expect(ranks(table)).toEqual([1, 2, 3, 4, 5]);
  });

  it("AWAY: furthest first, 100 for the best down to 0 for the worst", () => {
    const table = rankAnswers(five, ORIGIN, "away");
    expect(names(table)).toEqual([
      "Echo",
      "Delta",
      "Charlie",
      "Bravo",
      "Alpha",
    ]);
    expect(points(table)).toEqual([100, 75, 50, 25, 0]);
    expect(ranks(table)).toEqual([1, 2, 3, 4, 5]);
  });

  it("HOME and AWAY are mirror images", () => {
    const home = rankAnswers(five, ORIGIN, "home");
    const away = rankAnswers(five, ORIGIN, "away");
    expect(names(away)).toEqual(names(home).reverse());
    for (const row of home) {
      const mirrored = rankedFor(away, row.answer.id);
      expect(mirrored?.km).toBe(row.km);
      expect(mirrored?.points).toBe(100 - row.points);
      expect(mirrored?.rank).toBe(home.length + 1 - row.rank);
    }
  });

  it("depends on where the stadium is", () => {
    const pin = { lat: 0, lng: 5 };
    expect(names(rankAnswers(five, pin, "home"))).toEqual([
      "Echo",
      "Delta",
      "Charlie",
      "Bravo",
      "Alpha",
    ]);
  });

  it("gives tied answers the same points and the best rank of their group", () => {
    const q = question("ties", [
      east("Far", 3),
      east("Mid Zulu", 2),
      east("Near", 1),
      east("Mid Alpha", 2),
    ]);
    const home = rankAnswers(q, ORIGIN, "home");
    expect(names(home)).toEqual(["Near", "Mid Alpha", "Mid Zulu", "Far"]);
    expect(points(home)).toEqual([100, 50, 50, 0]);
    expect(ranks(home)).toEqual([1, 2, 2, 4]);

    const away = rankAnswers(q, ORIGIN, "away");
    expect(names(away)).toEqual(["Far", "Mid Alpha", "Mid Zulu", "Near"]);
    expect(points(away)).toEqual([100, 50, 50, 0]);
    expect(ranks(away)).toEqual([1, 2, 2, 4]);
  });

  it("ties the best answers at 100 and the worst at 0", () => {
    const q = question("ends", [
      east("A", 1),
      east("B", 1),
      east("C", 2),
      east("D", 3),
      east("E", 3),
      east("F", 3),
    ]);
    const home = rankAnswers(q, ORIGIN, "home");
    expect(points(home)).toEqual([100, 100, 60, 0, 0, 0]);
    expect(ranks(home)).toEqual([1, 1, 3, 4, 4, 4]);
    const away = rankAnswers(q, ORIGIN, "away");
    expect(names(away)).toEqual(["D", "E", "F", "C", "A", "B"]);
    expect(points(away)).toEqual([100, 100, 100, 40, 0, 0]);
    expect(ranks(away)).toEqual([1, 1, 1, 4, 5, 5]);
  });

  it("ties answers whose distances round to the same kilometre", () => {
    // 111.195 km per degree. 0.6 km and 1.4 km both round to 1 km; 0.4 km rounds to 0.
    const q = question("rounding", [
      east("One point four", 1.4 / 111.195),
      east("Point six", 0.6 / 111.195),
      east("Point four", 0.4 / 111.195),
    ]);
    const table = rankAnswers(q, ORIGIN, "home");
    expect(kms(table)).toEqual([0, 1, 1]);
    expect(names(table)).toEqual(["Point four", "One point four", "Point six"]);
    expect(points(table)).toEqual([100, 0, 0]);
    expect(ranks(table)).toEqual([1, 2, 2]);
  });

  it.each(MODES)("scores a single answer 100 (%s)", (mode) => {
    const table = rankAnswers(question("one", [east("Only", 7)]), ORIGIN, mode);
    expect(points(table)).toEqual([100]);
    expect(ranks(table)).toEqual([1]);
  });

  it.each(MODES)(
    "scores 100 all round when every answer is tied (%s)",
    (mode) => {
      const q = question("level", [east("C", 2), east("A", 2), east("B", 2)]);
      const table = rankAnswers(q, ORIGIN, mode);
      expect(names(table)).toEqual(["A", "B", "C"]);
      expect(points(table)).toEqual([100, 100, 100]);
      expect(ranks(table)).toEqual([1, 1, 1]);
    },
  );

  it("returns an empty table for an empty question", () => {
    expect(rankAnswers(question("none", []), ORIGIN, "home")).toEqual([]);
  });

  it("orders ties by name without regard to case or accents, then by id", () => {
    const q = question("names", [
      east("eric", 1),
      east("Émile", 1),
      east("Zed", 1),
      east("adam", 1),
      { ...east("Adam", 1), id: "adam-2" },
    ]);
    const table = rankAnswers(q, ORIGIN, "home");
    expect(table.map((r) => r.answer.id)).toEqual([
      "adam",
      "adam-2",
      "emile",
      "eric",
      "zed",
    ]);
  });

  it("rounds half points up, so the two modes can add up to 101", () => {
    // Nine answers: second place has 1 better and 7 worse (87.5).
    const q = question(
      "nine",
      Array.from({ length: 9 }, (_, i) => east(`N${i + 1}`, i + 1)),
    );
    expect(points(rankAnswers(q, ORIGIN, "home"))).toEqual([
      100, 88, 75, 63, 50, 38, 25, 13, 0,
    ]);
    expect(points(rankAnswers(q, ORIGIN, "away"))).toEqual([
      100, 88, 75, 63, 50, 38, 25, 13, 0,
    ]);
  });

  it.each(MODES)(
    "keeps 100 for the best answer alone, however long the list (%s)",
    (mode) => {
      const q = question(
        "long",
        Array.from({ length: 400 }, (_, i) =>
          east(`N${String(i).padStart(3, "0")}`, (i + 1) * 0.1),
        ),
      );
      const table = rankAnswers(q, ORIGIN, mode);
      expect(table).toHaveLength(400);
      expect(table.filter((r) => r.points === 100)).toHaveLength(1);
      expect(table[0].points).toBe(100);
      // 100 * 398 / 399 is 99.7, which would round to 100.
      expect(table[1].points).toBe(99);
      expect(table[399].points).toBe(0);
      for (let i = 1; i < table.length; i++) {
        expect(table[i].points).toBeLessThanOrEqual(table[i - 1].points);
      }
    },
  );

  it("does not reorder or change the question's answers", () => {
    const before = five.answers.map((a) => a.name);
    const copy = JSON.stringify(five);
    rankAnswers(five, ORIGIN, "away");
    expect(five.answers.map((a) => a.name)).toEqual(before);
    expect(JSON.stringify(five)).toBe(copy);
  });

  it("keeps the answer objects themselves in the rows", () => {
    const table = rankAnswers(five, ORIGIN, "home");
    expect(table[0].answer).toBe(five.answers[1]);
  });

  describe("worked example: Anfield", () => {
    const anfield = { lat: 53.4308, lng: -2.9608 };
    const q = question("managers", [
      answer("Santiago", -33.4489, -70.6693),
      answer("Glasgow", 55.8642, -4.2518),
      answer("West Derby", 53.4338, -2.9108),
      answer("Auckland", -36.8485, 174.7633),
      answer("Wembley", 51.556, -0.2796),
      answer("Old Trafford", 53.4631, -2.2913),
    ]);

    it("HOME rewards the local lad", () => {
      const table = rankAnswers(q, anfield, "home");
      expect(names(table)).toEqual([
        "West Derby",
        "Old Trafford",
        "Wembley",
        "Glasgow",
        "Santiago",
        "Auckland",
      ]);
      expect(kms(table)).toEqual([3, 44, 276, 283, 11_644, 18_163]);
      expect(points(table)).toEqual([100, 80, 60, 40, 20, 0]);
      expect(ranks(table)).toEqual([1, 2, 3, 4, 5, 6]);
      expect(table.map((r) => gradeFor(r.points))).toEqual([
        "worldie",
        "topbins",
        "goal",
        "ontarget",
        "wide",
        "wide",
      ]);
    });

    it("AWAY rewards the other side of the world", () => {
      const table = rankAnswers(q, anfield, "away");
      expect(names(table)).toEqual([
        "Auckland",
        "Santiago",
        "Glasgow",
        "Wembley",
        "Old Trafford",
        "West Derby",
      ]);
      expect(kms(table)).toEqual([18_163, 11_644, 283, 276, 44, 3]);
      expect(points(table)).toEqual([100, 80, 60, 40, 20, 0]);
    });

    it("plays differently from another stadium", () => {
      const hampden = { lat: 55.8258, lng: -4.252 };
      const table = rankAnswers(q, hampden, "home");
      expect(names(table).slice(0, 3)).toEqual([
        "Glasgow",
        "West Derby",
        "Old Trafford",
      ]);
    });
  });
});

describe("gradeFor", () => {
  it.each([
    [100, "worldie"],
    [99, "topbins"],
    [80, "topbins"],
    [79, "goal"],
    [55, "goal"],
    [54, "ontarget"],
    [30, "ontarget"],
    [29, "wide"],
    [1, "wide"],
    [0, "wide"],
  ])("%i points is %s", (pts, grade) => {
    expect(gradeFor(pts)).toBe(grade);
  });
});

describe("rankedFor", () => {
  const table = rankAnswers(
    question("q", [east("Alpha", 1), east("Bravo", 2)]),
    ORIGIN,
    "home",
  );

  it("finds the row for an answer id", () => {
    expect(rankedFor(table, "bravo")).toBe(table[1]);
  });

  it("returns null for an unknown or missing id", () => {
    expect(rankedFor(table, "zulu")).toBeNull();
    expect(rankedFor(table, null)).toBeNull();
    expect(rankedFor([], "alpha")).toBeNull();
  });
});

describe("tableExcerpt", () => {
  const twenty = rankAnswers(
    question(
      "twenty",
      Array.from({ length: 20 }, (_, i) =>
        east(`N${String(i).padStart(2, "0")}`, i + 1),
      ),
    ),
    ORIGIN,
    "home",
  );
  const indexes = (rows: ReturnType<typeof tableExcerpt>) =>
    rows.map((r) => r.index);

  it("returns the whole table when it fits", () => {
    const rows = tableExcerpt(twenty, "n07", 20);
    expect(indexes(rows)).toEqual(Array.from({ length: 20 }, (_, i) => i));
    expect(rows.every((r) => !r.gapBefore)).toBe(true);
    expect(rows.filter((r) => r.isPlayer).map((r) => r.index)).toEqual([7]);
    expect(indexes(tableExcerpt(twenty, "n07", 99))).toHaveLength(20);
    expect(indexes(tableExcerpt(twenty, "n07", Infinity))).toHaveLength(20);
  });

  it("keeps the best, the player's and the worst rows, with others spread evenly", () => {
    const rows = tableExcerpt(twenty, "n07", 6);
    expect(indexes(rows)).toEqual([0, 4, 7, 11, 15, 19]);
    expect(rows.map((r) => r.isPlayer)).toEqual([
      false,
      false,
      true,
      false,
      false,
      false,
    ]);
    expect(rows.map((r) => r.gapBefore)).toEqual([
      false,
      true,
      true,
      true,
      true,
      true,
    ]);
  });

  it("carries the full row through", () => {
    const rows = tableExcerpt(twenty, "n07", 6);
    expect(rows[2]).toMatchObject({
      answer: twenty[7].answer,
      km: twenty[7].km,
      points: twenty[7].points,
      rank: 8,
      index: 7,
      isPlayer: true,
    });
  });

  it("spreads evenly when there is no player's row", () => {
    expect(indexes(tableExcerpt(twenty, null, 6))).toEqual([
      0, 4, 8, 11, 15, 19,
    ]);
    const unknown = tableExcerpt(twenty, "not-in-the-table", 6);
    expect(indexes(unknown)).toEqual([0, 4, 8, 11, 15, 19]);
    expect(unknown.some((r) => r.isPlayer)).toBe(false);
  });

  it("does not add a row when the player's is already the best, the worst or a spread row", () => {
    expect(indexes(tableExcerpt(twenty, "n00", 6))).toEqual([
      0, 4, 8, 11, 15, 19,
    ]);
    expect(tableExcerpt(twenty, "n00", 6)[0].isPlayer).toBe(true);
    expect(indexes(tableExcerpt(twenty, "n19", 6))).toEqual([
      0, 4, 8, 11, 15, 19,
    ]);
    expect(tableExcerpt(twenty, "n19", 6)[5].isPlayer).toBe(true);
    expect(indexes(tableExcerpt(twenty, "n11", 6))).toEqual([
      0, 4, 8, 11, 15, 19,
    ]);
  });

  it("marks gaps only where rows were left out", () => {
    const rows = tableExcerpt(twenty, "n01", 4);
    expect(indexes(rows)).toEqual([0, 1, 13, 19]);
    expect(rows.map((r) => r.gapBefore)).toEqual([false, false, true, true]);
  });

  it("always has exactly maxRows rows when the table is longer", () => {
    for (let max = 3; max < 20; max++) {
      for (let player = 0; player < 20; player++) {
        const id = twenty[player].answer.id;
        const rows = tableExcerpt(twenty, id, max);
        const idx = indexes(rows);
        expect(idx).toHaveLength(max);
        expect(new Set(idx).size).toBe(max);
        expect([...idx].sort((a, b) => a - b)).toEqual(idx);
        expect(idx[0]).toBe(0);
        expect(idx[idx.length - 1]).toBe(19);
        expect(idx).toContain(player);
        expect(rows.filter((r) => r.isPlayer)).toHaveLength(1);
      }
    }
  });

  it("never drops the rows that must be shown, even for a tiny maxRows", () => {
    expect(indexes(tableExcerpt(twenty, "n07", 2))).toEqual([0, 7, 19]);
    expect(indexes(tableExcerpt(twenty, "n07", 1))).toEqual([0, 7, 19]);
    expect(indexes(tableExcerpt(twenty, "n07", 0))).toEqual([0, 7, 19]);
    expect(indexes(tableExcerpt(twenty, "n07", -5))).toEqual([0, 7, 19]);
    expect(indexes(tableExcerpt(twenty, null, 1))).toEqual([0, 19]);
    expect(indexes(tableExcerpt(twenty, "n00", 0))).toEqual([0, 19]);
  });

  it("copes with tiny and empty tables", () => {
    expect(tableExcerpt([], "x", 5)).toEqual([]);
    expect(indexes(tableExcerpt(twenty.slice(0, 1), null, 0))).toEqual([0]);
    expect(indexes(tableExcerpt(twenty.slice(0, 2), null, 1))).toEqual([0, 1]);
    expect(indexes(tableExcerpt(twenty, "n07", Number.NaN))).toHaveLength(20);
  });
});
