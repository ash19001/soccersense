/**
 * Property checks for the scorer over seeded random tables: the rules of GAME_DESIGN 4.1
 * must hold for any list, any stadium and both modes, not just for the worked examples.
 */
import { describe, expect, it } from "vitest";

import { distanceKm } from "./geo";
import { gradeFor, rankAnswers, tableExcerpt } from "./scoring";
import { answer, question } from "./test-fixtures";
import type { Answer, LatLng, Mode, Question, RankedAnswer } from "./types";

/** mulberry32: a small seeded generator, so every run sees the same tables. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Sample {
  seed: number;
  question: Question;
  stadium: LatLng;
}

/**
 * A random table. A third are spread over the globe, a third are crowded into one city (so
 * many distances round to the same kilometre), and a third are built from a handful of
 * repeated places (so there are big groups of exact ties).
 */
function sample(seed: number): Sample {
  const rand = seeded(seed);
  const count = 1 + Math.floor(rand() * 60);
  const stadium = { lat: rand() * 170 - 85, lng: rand() * 360 - 180 };
  const kind = seed % 3;
  const places: LatLng[] = Array.from({ length: 4 }, () => ({
    lat: rand() * 170 - 85,
    lng: rand() * 360 - 180,
  }));
  const answers: Answer[] = [];
  for (let i = 0; i < count; i++) {
    let at: LatLng;
    if (kind === 0) {
      at = { lat: rand() * 170 - 85, lng: rand() * 360 - 180 };
    } else if (kind === 1) {
      at = {
        lat: stadium.lat + (rand() - 0.5) * 0.08,
        lng: stadium.lng + (rand() - 0.5) * 0.08,
      };
    } else {
      at = places[Math.floor(rand() * places.length)];
    }
    answers.push(
      answer(`Answer ${String(i).padStart(2, "0")}`, at.lat, at.lng),
    );
  }
  return { seed, question: question(`random-${seed}`, answers), stadium };
}

const SAMPLES = Array.from({ length: 300 }, (_, i) => sample(i + 1));
const MODES: Mode[] = ["home", "away"];

function better(mode: Mode, a: number, b: number): boolean {
  return mode === "home" ? a < b : a > b;
}

describe("rankAnswers on random tables", () => {
  it("covers single answers, ties and long lists", () => {
    const sizes = SAMPLES.map((s) => s.question.answers.length);
    expect(Math.min(...sizes)).toBe(1);
    expect(Math.max(...sizes)).toBeGreaterThan(50);
    const tied = SAMPLES.filter((s) => {
      const kms = rankAnswers(s.question, s.stadium, "home").map((r) => r.km);
      return new Set(kms).size < kms.length;
    });
    expect(tied.length).toBeGreaterThan(100);
  });

  it.each(MODES)("keeps every answer exactly once (%s)", (mode) => {
    for (const s of SAMPLES) {
      const table = rankAnswers(s.question, s.stadium, mode);
      expect(table).toHaveLength(s.question.answers.length);
      expect(new Set(table.map((r) => r.answer)).size).toBe(table.length);
      for (const row of table) {
        expect(s.question.answers).toContain(row.answer);
        expect(row.km).toBe(Math.round(distanceKm(s.stadium, row.answer)));
      }
    }
  });

  it.each(MODES)("gives the best answer 100, always (%s)", (mode) => {
    for (const s of SAMPLES) {
      const table = rankAnswers(s.question, s.stadium, mode);
      expect(table[0].points, `seed ${s.seed}`).toBe(100);
      expect(table[0].rank).toBe(1);
      const bestKm = table[0].km;
      for (const row of table) {
        expect(better(mode, row.km, bestKm), `seed ${s.seed}`).toBe(false);
      }
    }
  });

  it.each(MODES)(
    "gives the worst answer 0 when there are two distinct distances (%s)",
    (mode) => {
      let checked = 0;
      for (const s of SAMPLES) {
        const table = rankAnswers(s.question, s.stadium, mode);
        const distinct = new Set(table.map((r) => r.km)).size;
        const last = table[table.length - 1];
        if (distinct >= 2) {
          expect(last.points, `seed ${s.seed}`).toBe(0);
          checked++;
        } else {
          // Everything tied: everyone is the best.
          for (const row of table) expect(row.points).toBe(100);
        }
      }
      expect(checked).toBeGreaterThan(200);
    },
  );

  it.each(MODES)(
    "never gives more points to a worse answer, and ties are equal (%s)",
    (mode) => {
      for (const s of SAMPLES) {
        const table = rankAnswers(s.question, s.stadium, mode);
        for (let i = 1; i < table.length; i++) {
          const above = table[i - 1];
          const row = table[i];
          const label = `seed ${s.seed} row ${i}`;
          // Table order: best first.
          expect(better(mode, row.km, above.km), label).toBe(false);
          if (row.km === above.km) {
            expect(row.points, label).toBe(above.points);
            expect(row.rank, label).toBe(above.rank);
          } else {
            expect(row.points, label).toBeLessThanOrEqual(above.points);
            expect(row.rank, label).toBe(i + 1);
          }
        }
        // And across every pair, not just neighbours.
        for (const x of table) {
          for (const y of table) {
            if (better(mode, x.km, y.km)) {
              expect(x.points).toBeGreaterThanOrEqual(y.points);
              expect(x.rank).toBeLessThan(y.rank);
            }
          }
        }
      }
    },
  );

  it.each(MODES)("follows the formula to the letter (%s)", (mode) => {
    for (const s of SAMPLES) {
      const table = rankAnswers(s.question, s.stadium, mode);
      for (const row of table) {
        const ahead = table.filter((r) => better(mode, r.km, row.km)).length;
        const behind = table.filter((r) => better(mode, row.km, r.km)).length;
        const expected =
          ahead + behind === 0
            ? 100
            : Math.round((100 * behind) / (ahead + behind));
        expect(row.points, `seed ${s.seed}`).toBe(expected);
        expect(row.rank).toBe(ahead + 1);
        expect(Number.isInteger(row.points)).toBe(true);
        expect(row.points).toBeGreaterThanOrEqual(0);
        expect(row.points).toBeLessThanOrEqual(100);
      }
    }
  });

  it("makes HOME and AWAY mirror orders", () => {
    for (const s of SAMPLES) {
      const home = rankAnswers(s.question, s.stadium, "home");
      const away = rankAnswers(s.question, s.stadium, "away");
      const label = `seed ${s.seed}`;
      // The distances run one way in HOME and the other way in AWAY.
      expect(
        away.map((r) => r.km),
        label,
      ).toEqual(home.map((r) => r.km).reverse());
      const awayById = new Map(away.map((r) => [r.answer.id, r]));
      const groups = new Set(home.map((r) => r.km)).size;
      for (const h of home) {
        const w = awayById.get(h.answer.id);
        expect(w, label).toBeDefined();
        if (!w) continue;
        expect(w.km).toBe(h.km);
        const tiedWith = home.filter((r) => r.km === h.km).length;
        // The answers ahead in one mode are the answers behind in the other.
        expect(w.rank - 1, label).toBe(home.length - tiedWith - (h.rank - 1));
        if (groups === 1) {
          expect(h.points + w.points).toBe(200);
        } else {
          // Rounding half up in both modes can make the pair add up to 101.
          expect([100, 101], label).toContain(h.points + w.points);
        }
      }
      // Inside a group of ties both modes use the same name order.
      for (const km of new Set(home.map((r) => r.km))) {
        const inHome = home.filter((r) => r.km === km).map((r) => r.answer.id);
        const inAway = away.filter((r) => r.km === km).map((r) => r.answer.id);
        expect(inAway, label).toEqual(inHome);
      }
    }
  });

  it("does not depend on the order of the answer list", () => {
    for (const s of SAMPLES.slice(0, 60)) {
      const reversed = {
        ...s.question,
        answers: [...s.question.answers].reverse(),
      };
      for (const mode of MODES) {
        const a = rankAnswers(s.question, s.stadium, mode);
        const b = rankAnswers(reversed, s.stadium, mode);
        expect(b.map((r) => [r.answer.id, r.km, r.points, r.rank])).toEqual(
          a.map((r) => [r.answer.id, r.km, r.points, r.rank]),
        );
      }
    }
  });

  it("grades exactly one distance as a worldie", () => {
    for (const s of SAMPLES) {
      for (const mode of MODES) {
        const table = rankAnswers(s.question, s.stadium, mode);
        const worldies = table.filter((r) => gradeFor(r.points) === "worldie");
        expect(worldies.length).toBeGreaterThanOrEqual(1);
        expect(new Set(worldies.map((r) => r.km)).size).toBe(1);
        expect(worldies[0].km).toBe(table[0].km);
      }
    }
  });
});

describe("rankAnswers at the extremes", () => {
  const line = (n: number) =>
    question(
      "line",
      Array.from({ length: n }, (_, i) => answer(`P${i}`, 0, 0.01 * (i + 1))),
    );
  const pin = { lat: 0, lng: 0 };

  it("keeps 100 for the best alone in a list of 1000", () => {
    for (const mode of MODES) {
      const table = rankAnswers(line(1000), pin, mode);
      expect(table.filter((r) => r.points === 100)).toHaveLength(
        table.filter((r) => r.km === table[0].km).length,
      );
      expect(table[1].km === table[0].km || table[1].points < 100).toBe(true);
      expect(table[table.length - 1].points).toBe(0);
    }
  });

  it("two answers score 100 and 0", () => {
    for (const mode of MODES) {
      const table = rankAnswers(
        question("two", [answer("Near", 0, 1), answer("Far", 0, 50)]),
        pin,
        mode,
      );
      expect(table.map((r) => r.points)).toEqual([100, 0]);
      expect(table[0].answer.name).toBe(mode === "home" ? "Near" : "Far");
    }
  });

  it("three answers score 100, 50 and 0", () => {
    const q = question("three", [
      answer("A", 0, 1),
      answer("B", 0, 2),
      answer("C", 0, 3),
    ]);
    for (const mode of MODES) {
      expect(rankAnswers(q, pin, mode).map((r) => r.points)).toEqual([
        100, 50, 0,
      ]);
    }
  });

  it("an answer at the stadium itself is 0 km and the best HOME answer", () => {
    const q = question("at", [answer("Here", 10, 10), answer("There", 20, 20)]);
    const table = rankAnswers(q, { lat: 10, lng: 10 }, "home");
    expect(table[0]).toMatchObject({ km: 0, points: 100, rank: 1 });
    expect(Object.is(table[0].km, -0)).toBe(false);
  });

  it("copes with the poles and the date line", () => {
    const q = question("edge", [
      answer("North Pole", 90, 0),
      answer("South Pole", -90, 0),
      answer("Fiji", -17.7, 178),
      answer("Samoa", -13.8, -172),
    ]);
    const fromFiji = rankAnswers(q, { lat: -17.7, lng: 178 }, "home");
    expect(fromFiji.map((r) => r.answer.name)).toEqual([
      "Fiji",
      "Samoa",
      "South Pole",
      "North Pole",
    ]);
    // Across the date line Samoa is about 1,100 km from Fiji, not 38,000.
    expect(fromFiji[1].km).toBeGreaterThan(900);
    expect(fromFiji[1].km).toBeLessThan(1300);
    for (const row of fromFiji) expect(Number.isFinite(row.km)).toBe(true);
  });
});

describe("gradeFor at every point", () => {
  it("matches the table in GAME_DESIGN 4.2 for 0 to 100", () => {
    for (let points = 0; points <= 100; points++) {
      const expected =
        points === 100
          ? "worldie"
          : points >= 80
            ? "topbins"
            : points >= 55
              ? "goal"
              : points >= 30
                ? "ontarget"
                : "wide";
      expect(gradeFor(points), String(points)).toBe(expected);
    }
  });

  it("never returns timeup or skipped", () => {
    for (const points of [-5, 0, 29.9, 54.5, 79.99, 99.9, 100, 250, NaN]) {
      expect(["timeup", "skipped"]).not.toContain(gradeFor(points));
    }
    expect(gradeFor(NaN)).toBe("wide");
    expect(gradeFor(-1)).toBe("wide");
  });
});

describe("tableExcerpt on random tables", () => {
  it("always shows the best, the worst and the player's row, in order, once each", () => {
    for (const s of SAMPLES) {
      const table: RankedAnswer[] = rankAnswers(s.question, s.stadium, "home");
      const rand = seeded(s.seed * 7919);
      for (const maxRows of [0, 1, 2, 3, 5, 8, 12, 1000, Infinity, NaN, -4]) {
        const pick = Math.floor(rand() * table.length);
        const id = rand() < 0.2 ? null : table[pick].answer.id;
        const rows = tableExcerpt(table, id, maxRows);
        const label = `seed ${s.seed} maxRows ${maxRows}`;
        const indexes = rows.map((r) => r.index);
        expect(
          [...indexes].sort((x, y) => x - y),
          label,
        ).toEqual(indexes);
        expect(new Set(indexes).size, label).toBe(indexes.length);
        expect(indexes[0], label).toBe(0);
        expect(indexes[indexes.length - 1], label).toBe(table.length - 1);
        const marked = rows.filter((r) => r.isPlayer);
        expect(marked, label).toHaveLength(id === null ? 0 : 1);
        if (id !== null) expect(marked[0].answer.id).toBe(id);
        const must = id === null || pick === 0 || pick === table.length - 1;
        const floor = Math.min(table.length, must ? 2 : 3);
        const cap = Number.isNaN(maxRows) ? table.length : maxRows;
        expect(rows.length, label).toBe(
          Math.min(table.length, Math.max(cap, floor)),
        );
        rows.forEach((row, i) => {
          expect(row.answer).toBe(table[row.index].answer);
          expect(row.points).toBe(table[row.index].points);
          const gap = i > 0 && rows[i - 1].index !== row.index - 1;
          expect(row.gapBefore, label).toBe(gap);
        });
      }
    }
  });

  it("marks nothing for an id that is not in the table", () => {
    const table = rankAnswers(
      SAMPLES[10].question,
      SAMPLES[10].stadium,
      "home",
    );
    expect(tableExcerpt(table, "nobody", 5).some((r) => r.isPlayer)).toBe(
      false,
    );
  });
});
