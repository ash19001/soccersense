import { describe, expect, it } from "vitest";

import {
  RULES,
  formatShare,
  gradeFor,
  isDistanceRule,
  rankAnswers,
  rankedFor,
  ruleFor,
  tableExcerpt,
} from "./scoring";
import { answer, east, ORIGIN, popular, question } from "./test-fixtures";
import type { Rule, RankedAnswer } from "./types";

const names = (table: readonly RankedAnswer[]) =>
  table.map((r) => r.answer.name);
const points = (table: readonly RankedAnswer[]) => table.map((r) => r.points);
const ranks = (table: readonly RankedAnswer[]) => table.map((r) => r.rank);
const kms = (table: readonly RankedAnswer[]) => table.map((r) => r.km);
const shares = (table: readonly RankedAnswer[]) => table.map((r) => r.share);

const DISTANCE_RULES: Rule[] = ["closest", "furthest"];

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
    const table = rankAnswers(five, ORIGIN, "closest");
    expect(kms(table)).toEqual([111, 222, 334, 445, 556]);
  });

  it("CLOSEST: nearest first, 100 for the best down to 0 for the worst", () => {
    const table = rankAnswers(five, ORIGIN, "closest");
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

  it("FURTHEST: furthest first, 100 for the best down to 0 for the worst", () => {
    const table = rankAnswers(five, ORIGIN, "furthest");
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

  it("CLOSEST and FURTHEST are mirror images", () => {
    const home = rankAnswers(five, ORIGIN, "closest");
    const away = rankAnswers(five, ORIGIN, "furthest");
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
    expect(names(rankAnswers(five, pin, "closest"))).toEqual([
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
    const home = rankAnswers(q, ORIGIN, "closest");
    expect(names(home)).toEqual(["Near", "Mid Alpha", "Mid Zulu", "Far"]);
    expect(points(home)).toEqual([100, 50, 50, 0]);
    expect(ranks(home)).toEqual([1, 2, 2, 4]);

    const away = rankAnswers(q, ORIGIN, "furthest");
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
    const home = rankAnswers(q, ORIGIN, "closest");
    expect(points(home)).toEqual([100, 100, 60, 0, 0, 0]);
    expect(ranks(home)).toEqual([1, 1, 3, 4, 4, 4]);
    const away = rankAnswers(q, ORIGIN, "furthest");
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
    const table = rankAnswers(q, ORIGIN, "closest");
    expect(kms(table)).toEqual([0, 1, 1]);
    expect(names(table)).toEqual(["Point four", "One point four", "Point six"]);
    expect(points(table)).toEqual([100, 0, 0]);
    expect(ranks(table)).toEqual([1, 2, 2]);
  });

  it.each(DISTANCE_RULES)("scores a single answer 100 (%s)", (mode) => {
    const table = rankAnswers(question("one", [east("Only", 7)]), ORIGIN, mode);
    expect(points(table)).toEqual([100]);
    expect(ranks(table)).toEqual([1]);
  });

  it.each(DISTANCE_RULES)(
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
    expect(rankAnswers(question("none", []), ORIGIN, "closest")).toEqual([]);
  });

  it("orders ties by name without regard to case or accents, then by id", () => {
    const q = question("names", [
      east("eric", 1),
      east("Émile", 1),
      east("Zed", 1),
      east("adam", 1),
      { ...east("Adam", 1), id: "adam-2" },
    ]);
    const table = rankAnswers(q, ORIGIN, "closest");
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
    expect(points(rankAnswers(q, ORIGIN, "closest"))).toEqual([
      100, 88, 75, 63, 50, 38, 25, 13, 0,
    ]);
    expect(points(rankAnswers(q, ORIGIN, "furthest"))).toEqual([
      100, 88, 75, 63, 50, 38, 25, 13, 0,
    ]);
  });

  it.each(DISTANCE_RULES)(
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
    rankAnswers(five, ORIGIN, "furthest");
    expect(five.answers.map((a) => a.name)).toEqual(before);
    expect(JSON.stringify(five)).toBe(copy);
  });

  it("keeps the answer objects themselves in the rows", () => {
    const table = rankAnswers(five, ORIGIN, "closest");
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

    it("CLOSEST rewards the local lad", () => {
      const table = rankAnswers(q, anfield, "closest");
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

    it("FURTHEST rewards the other side of the world", () => {
      const table = rankAnswers(q, anfield, "furthest");
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
      const table = rankAnswers(q, hampden, "closest");
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
    "closest",
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
    "closest",
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

describe("ruleFor", () => {
  it("scores HOME by the most common answer and AWAY by the most niche", () => {
    expect(ruleFor("home")).toBe("common");
    expect(ruleFor("away")).toBe("niche");
  });

  it("knows the distance rules apart from the popularity rules", () => {
    expect(RULES).toEqual(["common", "niche", "closest", "furthest"]);
    expect(RULES.filter(isDistanceRule)).toEqual(["closest", "furthest"]);
  });
});

describe("rankAnswers by popularity", () => {
  // Out of order in the list, and placed so that distance would rank them the other way.
  const ballon = question("ballon", [
    answer("Kaka", 0, 1, [], 2.6),
    answer("Lionel Messi", 0, 9, [], 32),
    answer("Josef Masopust", 0, 2, [], 0.1),
    answer("Cristiano Ronaldo", 0, 8, [], 24.7),
    answer("Luka Modric", 0, 5, [], 3),
  ]);

  it("common: the most popular first, 100 down to 0", () => {
    const table = rankAnswers(ballon, ORIGIN, "common");
    expect(names(table)).toEqual([
      "Lionel Messi",
      "Cristiano Ronaldo",
      "Luka Modric",
      "Kaka",
      "Josef Masopust",
    ]);
    expect(shares(table)).toEqual([32, 24.7, 3, 2.6, 0.1]);
    expect(points(table)).toEqual([100, 75, 50, 25, 0]);
    expect(ranks(table)).toEqual([1, 2, 3, 4, 5]);
  });

  it("niche: the least popular first, 100 down to 0", () => {
    const table = rankAnswers(ballon, ORIGIN, "niche");
    expect(names(table)).toEqual([
      "Josef Masopust",
      "Kaka",
      "Luka Modric",
      "Cristiano Ronaldo",
      "Lionel Messi",
    ]);
    expect(points(table)).toEqual([100, 75, 50, 25, 0]);
  });

  it("common and niche are mirror images", () => {
    const common = rankAnswers(ballon, ORIGIN, "common");
    const niche = rankAnswers(ballon, ORIGIN, "niche");
    for (const row of common) {
      const mirrored = rankedFor(niche, row.answer.id);
      expect(mirrored?.points).toBe(100 - row.points);
      expect(mirrored?.rank).toBe(common.length + 1 - row.rank);
    }
  });

  it("ignores the stadium, but every row still carries its distance", () => {
    const here = rankAnswers(ballon, ORIGIN, "common");
    const there = rankAnswers(ballon, { lat: 0, lng: 9 }, "common");
    expect(names(there)).toEqual(names(here));
    expect(points(there)).toEqual(points(here));
    expect(kms(here)).toEqual([1001, 890, 556, 111, 222]);
    expect(rankedFor(there, "lionel-messi")?.km).toBe(0);
  });

  it("ties shares to a tenth of a percent: shared points and rank, name order", () => {
    const q = question("ties", [
      popular("Zed", 10),
      popular("Bravo", 4.04),
      popular("Alpha", 3.96),
      popular("Echo", 1),
    ]);
    const common = rankAnswers(q, ORIGIN, "common");
    expect(names(common)).toEqual(["Zed", "Alpha", "Bravo", "Echo"]);
    expect(points(common)).toEqual([100, 50, 50, 0]);
    expect(ranks(common)).toEqual([1, 2, 2, 4]);
    const niche = rankAnswers(q, ORIGIN, "niche");
    expect(names(niche)).toEqual(["Echo", "Alpha", "Bravo", "Zed"]);
    expect(points(niche)).toEqual([100, 50, 50, 0]);
    expect(ranks(niche)).toEqual([1, 2, 2, 4]);
  });

  it("gives every answer tied at the top 100 and a worldie", () => {
    const q = question("top", [
      popular("Brazil", 30),
      popular("Germany", 30),
      popular("Uruguay", 2),
    ]);
    const table = rankAnswers(q, ORIGIN, "common");
    expect(points(table)).toEqual([100, 100, 0]);
    expect(table.map((r) => gradeFor(r.points))).toEqual([
      "worldie",
      "worldie",
      "wide",
    ]);
  });

  it("scores a lone answer 100 under every rule", () => {
    const q = question("one", [popular("Only", 100)]);
    for (const rule of RULES) {
      expect(points(rankAnswers(q, ORIGIN, rule))).toEqual([100]);
    }
  });

  it("does not change the question's answers", () => {
    const before = JSON.stringify(ballon);
    rankAnswers(ballon, ORIGIN, "niche");
    expect(JSON.stringify(ballon)).toBe(before);
  });
});

describe("formatShare", () => {
  it.each([
    [34, "34%"],
    [32.04, "32%"],
    [2.5, "2.5%"],
    [0.1, "0.1%"],
    [0.05, "0.1%"],
    [100, "100%"],
    [0.04, "under 0.1%"],
    [0, "under 0.1%"],
    [-3, "under 0.1%"],
    [Number.NaN, "under 0.1%"],
    [250, "100%"],
  ])("%s is %s", (share, text) => {
    expect(formatShare(share)).toBe(text);
  });
});
