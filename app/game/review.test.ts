/**
 * One test for each bug or gap found in review, outside the judge, scorer and reducer (those
 * have their own *.hostile.test.ts files).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { careerFor, tierFor, tiersCrossed, TIERS } from "./career";
import {
  dayKeyFor,
  dayNumber,
  EPOCH_UTC,
  MS_PER_DAY,
  msUntilNextDay,
  resolveToday,
  utcDayKey,
} from "./day";
import { formatDistance, usesMiles } from "./geo";
import { gradeFor, rankAnswers, tableExcerpt } from "./scoring";
import { createSession, reduce } from "./session";
import type { Action, Session, Turn } from "./session";
import { GRADE_SYMBOLS } from "./share";
import {
  loadDay,
  loadGame,
  saveGame,
  saveSession,
  storageKey,
} from "./storage";
import type { StorageLike } from "./storage";
import { ORIGIN, east, question, stadium } from "./test-fixtures";

class FakeStorage implements StorageLike {
  readonly items = new Map<string, string>();
  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.items.set(key, String(value));
  }
  removeItem(key: string): void {
    this.items.delete(key);
  }
}

describe("career", () => {
  it("careerFor carries the tier's id, the key for its display name", () => {
    for (const tier of TIERS) {
      expect(careerFor(tier.from).id).toBe(tier.id);
      expect(careerFor(tier.from + 89).id).toBe(tier.id);
    }
    expect(careerFor(700).id).toBe("winner");
  });

  it("never reports a progress that is not a number", () => {
    for (const total of [NaN, Infinity, -Infinity, -1, 0, 89.5, 1e9]) {
      const career = careerFor(total);
      expect(Number.isFinite(career.progress), String(total)).toBe(true);
      expect(career.progress).toBeGreaterThanOrEqual(0);
      expect(career.progress).toBeLessThanOrEqual(1);
      expect(Number.isInteger(career.tier)).toBe(true);
    }
    expect(careerFor(NaN)).toMatchObject({ tier: 0, progress: 0 });
    expect(careerFor(Infinity)).toMatchObject({ tier: 7, progress: 1 });
    expect(tierFor(NaN)).toBe(0);
    expect(tiersCrossed(NaN, 200)).toEqual([1, 2]);
    expect(tiersCrossed(200, NaN)).toEqual([]);
  });

  it("can only reach the top tier on the seventh question", () => {
    // Six perfect answers are 600: tier 6. The trophy needs the last question.
    expect(tierFor(600)).toBe(6);
    expect(tierFor(629)).toBe(6);
    expect(tierFor(630)).toBe(7);
  });
});

describe("day", () => {
  const STADIUMS = [
    stadium("anfield"),
    stadium("hampden"),
    stadium("maracana"),
  ];

  it("the day changes at midnight UTC and at no other moment", () => {
    const midnight = EPOCH_UTC + 5 * MS_PER_DAY;
    expect(dayNumber(new Date(midnight - 1))).toBe(5);
    expect(dayNumber(new Date(midnight))).toBe(6);
    expect(dayNumber(new Date(midnight + MS_PER_DAY - 1))).toBe(6);
    expect(utcDayKey(new Date(midnight - 1))).toBe("2026-11-14");
    expect(utcDayKey(new Date(midnight))).toBe("2026-11-15");
    expect(msUntilNextDay(new Date(midnight - 1))).toBe(1);
    expect(msUntilNextDay(new Date(midnight))).toBe(MS_PER_DAY);
    // The same instant written in other time zones is the same day.
    expect(dayNumber(new Date("2026-11-11T09:30:00+10:00"))).toBe(1);
    expect(dayNumber(new Date("2026-11-10T19:30:00-05:00"))).toBe(2);
  });

  it("dayKeyFor and utcDayKey agree for every day of the first two years", () => {
    for (let day = 1; day <= 730; day++) {
      const noon = new Date(EPOCH_UTC + (day - 1) * MS_PER_DAY + 43_200_000);
      expect(dayNumber(noon)).toBe(day);
      expect(dayKeyFor(day)).toBe(utcDayKey(noon));
    }
    expect(dayKeyFor(1)).toBe("2026-11-10");
    expect(dayKeyFor(52)).toBe("2026-12-31");
    expect(dayKeyFor(53)).toBe("2027-01-01");
    // 2028 is a leap year.
    expect(dayKeyFor(dayNumber(new Date("2028-02-29T12:00:00Z")))).toBe(
      "2028-02-29",
    );
  });

  it("msUntilNextDay is a whole day for an invalid date, never NaN", () => {
    expect(msUntilNextDay(new Date(NaN))).toBe(MS_PER_DAY);
    for (const ms of [0, 1, EPOCH_UTC, EPOCH_UTC + 12_345_678, -1]) {
      const wait = msUntilNextDay(new Date(ms));
      expect(wait).toBeGreaterThan(0);
      expect(wait).toBeLessThanOrEqual(MS_PER_DAY);
    }
  });

  it("resolveToday hands over the storage key and the debug switches", () => {
    const now = new Date("2026-11-12T08:00:00Z");
    expect(resolveToday(now, "", STADIUMS)).toEqual({
      dayNumber: 3,
      dayKey: "2026-11-12",
      stadium: STADIUMS[2],
      noTimer: false,
    });
    expect(resolveToday(now, "?day=40&notimer=1&time=21:30", STADIUMS)).toEqual(
      {
        dayNumber: 40,
        dayKey: "2026-12-19",
        stadium: STADIUMS[0],
        noTimer: true,
        time: { hours: 21, minutes: 30 },
      },
    );
    // ?stadium changes the pin, not the day or its key.
    expect(resolveToday(now, "?stadium=anfield", STADIUMS)).toMatchObject({
      dayNumber: 3,
      dayKey: "2026-11-12",
      stadium: STADIUMS[0],
    });
  });

  it("the stadium rotation starts at the first stadium and wraps", () => {
    const ids = [1, 2, 3, 4, 5, 6, 7].map(
      (n) =>
        resolveToday(new Date(EPOCH_UTC + (n - 1) * MS_PER_DAY), "", STADIUMS)
          .stadium.id,
    );
    expect(ids).toEqual([
      "anfield",
      "hampden",
      "maracana",
      "anfield",
      "hampden",
      "maracana",
      "anfield",
    ]);
  });
});

describe("storage", () => {
  const DAY = "2026-11-10";
  const turn = (points: number): Turn => ({
    questionId: "q",
    input: "x",
    answerId: "x",
    grade: "goal",
    points,
    km: 10,
    rank: 2,
    msLeft: 5000,
  });

  it.each([
    ["a total that is not the sum of its turns", { total: 700, turns: [] }],
    ["a total above its turns", { total: 101, turns: [turn(100)] }],
    ["points above 100", { total: 250, turns: [turn(250)] }],
    ["negative points", { total: -5, turns: [turn(-5)] }],
    ["fractional points", { total: 50.5, turns: [turn(50.5)] }],
  ])("loadGame refuses %s", (_label, game) => {
    const storage = new FakeStorage();
    storage.setItem(storageKey(DAY, "home"), JSON.stringify(game));
    expect(loadGame(DAY, "home", storage)).toBeNull();
    expect(loadDay(DAY, storage).home).toBeNull();
  });

  it("loadGame accepts what saveGame wrote for a real game", () => {
    const storage = new FakeStorage();
    const game = { total: 155, turns: [turn(100), turn(55), turn(0)] };
    expect(saveGame(DAY, "away", game, storage)).toBe(true);
    expect(loadGame(DAY, "away", storage)).toEqual(game);
  });

  function finished(dayNo: number): Session {
    const q = question("q", [east("Alpha", 1), east("Bravo", 2)]);
    let s = createSession({
      mode: "away",
      dayNumber: dayNo,
      stadium: ORIGIN,
      questions: [q],
      now: 0,
    });
    s = reduce(s, { type: "submit", input: "Bravo", now: 10 });
    s = reduce(s, { type: "resolved" });
    return reduce(s, { type: "next", now: 20 });
  }

  it("saveSession files a finished game under its own day and mode", () => {
    const storage = new FakeStorage();
    const done = finished(3);
    expect(done.phase).toBe("done");
    expect(saveSession(done, storage)).toBe(true);
    expect([...storage.items.keys()]).toEqual([
      "soccersense:v1:2026-11-12:away",
    ]);
    expect(loadGame(dayKeyFor(3), "away", storage)).toEqual({
      total: 100,
      turns: done.turns,
    });
    // The same key resolveToday gives for that day.
    const today = resolveToday(new Date(0), "?day=3", [ORIGIN]);
    expect(loadDay(today.dayKey, storage).away?.total).toBe(100);
  });

  it("saveSession refuses a game that is not at full time, and never throws", () => {
    const storage = new FakeStorage();
    const q = question("q", [east("Alpha", 1)]);
    const asking = createSession({
      mode: "home",
      dayNumber: 1,
      stadium: ORIGIN,
      questions: [q],
      now: 0,
    });
    const resolving = reduce(asking, {
      type: "submit",
      input: "Alpha",
      now: 1,
    });
    const reveal = reduce(resolving, { type: "resolved" });
    for (const s of [asking, resolving, reveal]) {
      expect(saveSession(s, storage)).toBe(false);
    }
    expect(storage.items.size).toBe(0);
    expect(saveSession(finished(1), null)).toBe(false);
    expect(saveSession(null as unknown as Session, storage)).toBe(false);
    expect(saveSession({} as Session, storage)).toBe(false);
    const broken: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error("full");
      },
      removeItem: () => undefined,
    };
    expect(saveSession(finished(1), broken)).toBe(false);
  });

  it("no storage function throws on arguments of the wrong type", () => {
    const storage = new FakeStorage();
    const junk = [null, undefined, 42, {}, [], Symbol("s")] as unknown[];
    for (const value of junk) {
      expect(() => {
        saveGame(value as string, "home", value as never, storage);
        saveGame(DAY, "home", value as never, value as never);
        loadGame(value as string, value as never, storage);
        loadGame(DAY, "home", value as never);
        loadDay(value as string, value as never);
      }).not.toThrow();
    }
  });
});

describe("share", () => {
  it("every symbol is the agreed code points", () => {
    const points = (text: string) =>
      [...text].map((ch) => ch.codePointAt(0)?.toString(16));
    expect(points(GRADE_SYMBOLS.worldie)).toEqual(["1f31f"]);
    expect(points(GRADE_SYMBOLS.topbins)).toEqual(["1f3af"]);
    expect(points(GRADE_SYMBOLS.goal)).toEqual(["26bd"]);
    expect(points(GRADE_SYMBOLS.ontarget)).toEqual(["1f9e4"]);
    expect(points(GRADE_SYMBOLS.wide)).toEqual(["274c"]);
    expect(points(GRADE_SYMBOLS.timeup)).toEqual(["23f1", "fe0f"]);
    expect(points(GRADE_SYMBOLS.skipped)).toEqual(["2796"]);
  });

  it("share.ts spells its symbols as escapes, so no tool can mangle them", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(join(here, "share.ts"), "utf8");
    // Nothing outside ASCII except the middle dot of the separator.
    const odd = [...source].filter((ch) => ch > "\u007f" && ch !== "·");
    expect(odd).toEqual([]);
  });
});

describe("small guards", () => {
  it("usesMiles and formatDistance fall back to kilometres without a locale", () => {
    const missing = undefined as unknown as string;
    expect(usesMiles(missing)).toBe(false);
    expect(usesMiles(null as unknown as string)).toBe(false);
    expect(formatDistance(283, missing)).toBe("283 km");
    expect(formatDistance(283, "en-GB")).toBe("176 miles");
  });

  it("every table row carries its grade, and only the best is a worldie", () => {
    const q = question(
      "q",
      Array.from({ length: 12 }, (_, i) => east(`Answer ${i}`, i + 1)),
    );
    const table = rankAnswers(q, ORIGIN, "home");
    const rows = tableExcerpt(table, "answer-4", Infinity);
    expect(rows).toHaveLength(12);
    for (const row of rows) expect(row.grade).toBe(gradeFor(row.points));
    expect(rows.filter((row) => row.grade === "worldie")).toHaveLength(1);
    expect(rows[0].grade).toBe("worldie");
    expect(rows[11].grade).toBe("wide");
    expect(rows.find((row) => row.isPlayer)?.answer.id).toBe("answer-4");
  });

  it("a submit that carries no text is ignored, not a crash", () => {
    const q = question("q", [east("Alpha", 1)]);
    const s = createSession({
      mode: "home",
      dayNumber: 1,
      stadium: ORIGIN,
      questions: [q],
      now: 0,
    });
    for (const input of [undefined, null, 42, {}]) {
      const action = { type: "submit", input, now: 5 } as unknown as Action;
      expect(reduce(s, action)).toBe(s);
    }
  });
});
