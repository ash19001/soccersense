import { describe, expect, it } from "vitest";

import { buildShareText, GRADE_SYMBOLS } from "./share";
import type { Grade } from "./types";

const STAR = "\u{1F31F}";
const TARGET = "\u{1F3AF}";
const BALL = "⚽";
const GLOVES = "\u{1F9E4}";
const CROSS = "❌";
const STOPWATCH = "⏱️";
const MINUS = "➖";

describe("GRADE_SYMBOLS", () => {
  it("has the agreed symbol for every grade", () => {
    expect(GRADE_SYMBOLS).toEqual({
      worldie: STAR,
      topbins: TARGET,
      goal: BALL,
      ontarget: GLOVES,
      wide: CROSS,
      timeup: STOPWATCH,
      skipped: MINUS,
    });
  });

  it("uses the agreed code points", () => {
    const codePoints = (s: string) =>
      [...s].map((ch) => ch.codePointAt(0)?.toString(16).toUpperCase());
    expect(codePoints(GRADE_SYMBOLS.worldie)).toEqual(["1F31F"]);
    expect(codePoints(GRADE_SYMBOLS.topbins)).toEqual(["1F3AF"]);
    expect(codePoints(GRADE_SYMBOLS.goal)).toEqual(["26BD"]);
    expect(codePoints(GRADE_SYMBOLS.ontarget)).toEqual(["1F9E4"]);
    expect(codePoints(GRADE_SYMBOLS.wide)).toEqual(["274C"]);
    // The stopwatch is followed by the emoji presentation selector.
    expect(codePoints(GRADE_SYMBOLS.timeup)).toEqual(["23F1", "FE0F"]);
    expect(codePoints(GRADE_SYMBOLS.skipped)).toEqual(["2796"]);
  });
});

describe("buildShareText", () => {
  it("builds the three lines", () => {
    const text = buildShareText({
      dayNumber: 12,
      mode: "home",
      stadiumName: "Anfield",
      total: 512,
      tierName: "TOP FLIGHT",
      grades: [
        "worldie",
        "topbins",
        "goal",
        "ontarget",
        "wide",
        "timeup",
        "skipped",
      ],
    });
    expect(text.split("\n")).toEqual([
      "soccersense #12 · HOME · Anfield",
      "512/700 · TOP FLIGHT",
      STAR + TARGET + BALL + GLOVES + CROSS + STOPWATCH + MINUS,
    ]);
  });

  it("names the mode in capitals", () => {
    const text = buildShareText({
      dayNumber: 1,
      mode: "away",
      stadiumName: "Estádio do Maracanã",
      total: 700,
      tierName: "WORLD CUP WINNER",
      grades: Array<Grade>(7).fill("worldie"),
    });
    expect(text).toBe(
      `soccersense #1 · AWAY · Estádio do Maracanã\n700/700 · WORLD CUP WINNER\n${STAR.repeat(7)}`,
    );
  });

  it("has one symbol per question, in order", () => {
    const text = buildShareText({
      dayNumber: 3,
      mode: "home",
      stadiumName: "Hampden Park",
      total: 0,
      tierName: "PARK KICKABOUT",
      grades: ["timeup", "skipped", "wide"],
    });
    const lines = text.split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe("0/700 · PARK KICKABOUT");
    expect(lines[2]).toBe(STOPWATCH + MINUS + CROSS);
  });

  it("still has three lines with no answers", () => {
    const text = buildShareText({
      dayNumber: 3,
      mode: "home",
      stadiumName: "Anfield",
      total: 0,
      tierName: "PARK KICKABOUT",
      grades: [],
    });
    expect(text.split("\n")).toEqual([
      "soccersense #3 · HOME · Anfield",
      "0/700 · PARK KICKABOUT",
      "",
    ]);
  });

  it("gives nothing away about the answers", () => {
    const text = buildShareText({
      dayNumber: 12,
      mode: "home",
      stadiumName: "Anfield",
      total: 512,
      tierName: "TOP FLIGHT",
      grades: ["worldie", "goal"],
    });
    expect(text).not.toMatch(/[a-z]{3,}.*\d+ (km|miles)/);
    expect(text.split("\n")[2]).toBe(STAR + BALL);
  });
});
