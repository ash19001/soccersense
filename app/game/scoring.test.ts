import { describe, expect, it } from "vitest";

import {
  RULES,
  formatShare,
  isDistanceRule,
  rankAnswers,
  rankedFor,
  ruleFor,
  shotsOf,
  tableExcerpt,
} from "./scoring";
import { SHOT_ORDER, SHOT_POINTS } from "./shots";
import { answer, east, ORIGIN, popular, question } from "./test-fixtures";
import type { Rule, RankedAnswer } from "./types";

const names = (table: readonly RankedAnswer[]) =>
  table.map((r) => r.answer.name);
const shots = (table: readonly RankedAnswer[]) => table.map((r) => r.shot);
const points = (table: readonly RankedAnswer[]) => table.map((r) => r.points);
const ranks = (table: readonly RankedAnswer[]) => table.map((r) => r.rank);
const kms = (table: readonly RankedAnswer[]) => table.map((r) => r.km);
const shares = (table: readonly RankedAnswer[]) => table.map((r) => r.share);

const DISTANCE_RULES: Rule[] = ["closest", "furthest"];

/** What every table keeps: shots best first, and each row's points are its shot's. */
function expectWellFormed(table: readonly RankedAnswer[]) {
  for (let i = 0; i < table.length; i++) {
    expect(table[i].points).toBe(SHOT_POINTS[table[i].shot]);
    if (i > 0) {
      expect(SHOT_ORDER.indexOf(table[i].shot)).toBeGreaterThanOrEqual(
        SHOT_ORDER.indexOf(table[i - 1].shot),
      );
    }
  }
}

describe("rankAnswers by distance (the locked modes CLOSEST and FURTHEST)", () => {
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

  it("CLOSEST: nearest first, a worldie down to a miss", () => {
    const table = rankAnswers(five, ORIGIN, "closest");
    expect(names(table)).toEqual([
      "Alpha",
      "Bravo",
      "Charlie",
      "Delta",
      "Echo",
    ]);
    expect(shots(table)).toEqual([
      "worldie",
      "golazo",
      "toepoke",
      "tapin",
      "miss",
    ]);
    expect(points(table)).toEqual([100, 80, 30, 10, 0]);
    expect(ranks(table)).toEqual([1, 2, 3, 4, 5]);
  });

  it("FURTHEST: furthest first, a worldie down to a miss", () => {
    const table = rankAnswers(five, ORIGIN, "furthest");
    expect(names(table)).toEqual([
      "Echo",
      "Delta",
      "Charlie",
      "Bravo",
      "Alpha",
    ]);
    expect(shots(table)).toEqual([
      "worldie",
      "golazo",
      "toepoke",
      "tapin",
      "miss",
    ]);
    expect(ranks(table)).toEqual([1, 2, 3, 4, 5]);
  });

  it("CLOSEST and FURTHEST are mirror images for evenly spaced answers", () => {
    const home = rankAnswers(five, ORIGIN, "closest");
    const away = rankAnswers(five, ORIGIN, "furthest");
    expect(names(away)).toEqual(names(home).reverse());
    expect(shots(away)).toEqual(shots(home));
    for (const row of home) {
      const mirrored = rankedFor(away, row.answer.id);
      expect(mirrored?.km).toBe(row.km);
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

  it("gives tied answers the same shot and the best rank of their group", () => {
    const q = question("ties", [
      east("Far", 3),
      east("Mid Zulu", 2),
      east("Near", 1),
      east("Mid Alpha", 2),
    ]);
    const home = rankAnswers(q, ORIGIN, "closest");
    expect(names(home)).toEqual(["Near", "Mid Alpha", "Mid Zulu", "Far"]);
    expect(shots(home)).toEqual(["worldie", "toepoke", "toepoke", "miss"]);
    expect(ranks(home)).toEqual([1, 2, 2, 4]);

    const away = rankAnswers(q, ORIGIN, "furthest");
    expect(names(away)).toEqual(["Far", "Mid Alpha", "Mid Zulu", "Near"]);
    expect(shots(away)).toEqual(["worldie", "toepoke", "toepoke", "miss"]);
    expect(ranks(away)).toEqual([1, 2, 2, 4]);
  });

  it("ties the best answers as worldies and the worst as misses", () => {
    const q = question("ends", [
      east("A", 1),
      east("B", 1),
      east("C", 2),
      east("D", 3),
      east("E", 3),
      east("F", 3),
    ]);
    const home = rankAnswers(q, ORIGIN, "closest");
    expect(points(home)).toEqual([100, 100, 30, 0, 0, 0]);
    expect(ranks(home)).toEqual([1, 1, 3, 4, 4, 4]);
    const away = rankAnswers(q, ORIGIN, "furthest");
    expect(names(away)).toEqual(["D", "E", "F", "C", "A", "B"]);
    expect(points(away)).toEqual([100, 100, 100, 30, 0, 0]);
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
    expect(shots(table)).toEqual(["worldie", "miss", "miss"]);
    expect(ranks(table)).toEqual([1, 2, 2]);
  });

  it.each(DISTANCE_RULES)("makes a single answer a worldie (%s)", (mode) => {
    const table = rankAnswers(question("one", [east("Only", 7)]), ORIGIN, mode);
    expect(shots(table)).toEqual(["worldie"]);
    expect(points(table)).toEqual([100]);
    expect(ranks(table)).toEqual([1]);
  });

  it.each(DISTANCE_RULES)(
    "makes every answer a worldie when all are tied (%s)",
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

  it("uses all six shots on a list of nine", () => {
    const q = question(
      "nine",
      Array.from({ length: 9 }, (_, i) => east(`N${i + 1}`, i + 1)),
    );
    for (const rule of DISTANCE_RULES) {
      const table = rankAnswers(q, ORIGIN, rule);
      expect(shots(table)).toEqual([
        "worldie",
        "golazo",
        "trivela",
        "trivela",
        "toepoke",
        "tapin",
        "tapin",
        "miss",
        "miss",
      ]);
      expectWellFormed(table);
    }
  });

  it.each(DISTANCE_RULES)(
    "makes the best a worldie and the worst a miss, however long the list (%s)",
    (mode) => {
      const q = question(
        "long",
        Array.from({ length: 400 }, (_, i) =>
          east(`N${String(i).padStart(3, "0")}`, (i + 1) * 0.1),
        ),
      );
      const table = rankAnswers(q, ORIGIN, mode);
      expect(table).toHaveLength(400);
      expect(table[0].shot).toBe("worldie");
      expect(table[399].shot).toBe("miss");
      expect(new Set(shots(table))).toEqual(new Set(SHOT_ORDER));
      expectWellFormed(table);
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
      expect(shots(table)).toEqual([
        "worldie",
        "golazo",
        "golazo",
        "trivela",
        "tapin",
        "miss",
      ]);
      expect(points(table)).toEqual([100, 80, 80, 60, 10, 0]);
      expect(ranks(table)).toEqual([1, 2, 3, 4, 5, 6]);
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
      // Glasgow and Wembley are near Anfield as the world goes: both a long way from best.
      expect(shots(table)).toEqual([
        "worldie",
        "trivela",
        "tapin",
        "tapin",
        "miss",
        "miss",
      ]);
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
  it("scores HOME by the most common answer and AWAY by the most uncommon", () => {
    expect(ruleFor("home")).toBe("common");
    expect(ruleFor("away")).toBe("niche");
  });

  it("knows the distance rules apart from the popularity rules", () => {
    expect(RULES).toEqual([
      "common",
      "niche",
      "oldest",
      "newest",
      "closest",
      "furthest",
    ]);
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

  it("common: the most popular first, a worldie down to a miss", () => {
    const table = rankAnswers(ballon, ORIGIN, "common");
    expect(names(table)).toEqual([
      "Lionel Messi",
      "Cristiano Ronaldo",
      "Luka Modric",
      "Kaka",
      "Josef Masopust",
    ]);
    expect(shares(table)).toEqual([32, 24.7, 3, 2.6, 0.1]);
    expect(shots(table)).toEqual([
      "worldie",
      "golazo",
      "toepoke",
      "tapin",
      "miss",
    ]);
    expect(points(table)).toEqual([100, 80, 30, 10, 0]);
    expect(ranks(table)).toEqual([1, 2, 3, 4, 5]);
  });

  it("niche: the least popular first, a worldie down to a miss", () => {
    const table = rankAnswers(ballon, ORIGIN, "niche");
    expect(names(table)).toEqual([
      "Josef Masopust",
      "Kaka",
      "Luka Modric",
      "Cristiano Ronaldo",
      "Lionel Messi",
    ]);
    // Kaka is 26 times as common as Masopust, but much further from Messi: a trivela.
    expect(shots(table)).toEqual([
      "worldie",
      "trivela",
      "toepoke",
      "miss",
      "miss",
    ]);
    expect(points(table)).toEqual([100, 60, 30, 0, 0]);
  });

  it("uses the shots filed in the data under the question's own rule", () => {
    const q = question("filed", [
      popular("A", 50),
      popular("B", 30),
      popular("C", 20),
    ]);
    const filed = {
      ...q,
      answers: q.answers.map((a) => ({ ...a, shot: "trivela" as const })),
    };
    const table = rankAnswers(filed, ORIGIN, "common");
    expect(shots(table)).toEqual(["trivela", "trivela", "trivela"]);
    expect(points(table)).toEqual([60, 60, 60]);
    // Under another rule they are worked out again.
    expect(shotsOf(filed, ORIGIN, "niche")).toEqual([
      "miss",
      "toepoke",
      "worldie",
    ]);
  });

  it("ranks by shot first, then by share within a shot", () => {
    // Filed by hand against the popularity: the table follows the shots.
    const q = question("hand", [
      popular("A", 50),
      popular("B", 30),
      popular("C", 20),
    ]);
    const filed = {
      ...q,
      answers: [
        { ...q.answers[0], shot: "toepoke" as const },
        { ...q.answers[1], shot: "worldie" as const },
        { ...q.answers[2], shot: "toepoke" as const },
      ],
    };
    const table = rankAnswers(filed, ORIGIN, "common");
    expect(names(table)).toEqual(["B", "A", "C"]);
    expect(ranks(table)).toEqual([1, 2, 3]);
    expectWellFormed(table);
  });

  it("ignores the stadium, but every row still carries its distance", () => {
    const here = rankAnswers(ballon, ORIGIN, "common");
    const there = rankAnswers(ballon, { lat: 0, lng: 9 }, "common");
    expect(names(there)).toEqual(names(here));
    expect(points(there)).toEqual(points(here));
    expect(kms(here)).toEqual([1001, 890, 556, 111, 222]);
    expect(rankedFor(there, "lionel-messi")?.km).toBe(0);
  });

  it("ties shares to a tenth of a percent: shared shot and rank, name order", () => {
    const q = question("ties", [
      popular("Zed", 10),
      popular("Bravo", 4.04),
      popular("Alpha", 3.96),
      popular("Echo", 1),
    ]);
    const common = rankAnswers(q, ORIGIN, "common");
    expect(names(common)).toEqual(["Zed", "Alpha", "Bravo", "Echo"]);
    expect(shots(common)).toEqual(["worldie", "toepoke", "toepoke", "miss"]);
    expect(ranks(common)).toEqual([1, 2, 2, 4]);
    const niche = rankAnswers(q, ORIGIN, "niche");
    expect(names(niche)).toEqual(["Echo", "Alpha", "Bravo", "Zed"]);
    expect(shots(niche)).toEqual(["worldie", "toepoke", "toepoke", "miss"]);
    expect(ranks(niche)).toEqual([1, 2, 2, 4]);
  });

  it("makes every answer tied at the top a worldie", () => {
    const q = question("top", [
      popular("Brazil", 30),
      popular("Germany", 30),
      popular("Uruguay", 2),
    ]);
    const table = rankAnswers(q, ORIGIN, "common");
    expect(shots(table)).toEqual(["worldie", "worldie", "miss"]);
    expect(points(table)).toEqual([100, 100, 0]);
  });

  it("makes a lone answer a worldie under every rule", () => {
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
