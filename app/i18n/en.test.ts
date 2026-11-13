import { describe, expect, it } from "vitest";

import { SHOT_ORDER, TITLES } from "~/game";
import { en } from "./en";

/** Every string a player can see or hear: the values, and what the functions say. */
function words(value: unknown, path = "en"): { path: string; text: string }[] {
  if (typeof value === "string") return [{ path, text: value }];
  if (typeof value === "function") {
    // Call it with sample values of the usual shape: names, shares, numbers.
    const fn = value as (...args: unknown[]) => unknown;
    const args = Array.from({ length: fn.length }, (_, i) =>
      i % 2 === 0 ? "Sample" : 3,
    );
    return words(fn(...args), `${path}()`);
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, i) => words(item, `${path}[${i}]`));
  }
  if (typeof value === "object" && value !== null) {
    return Object.entries(value).flatMap(([key, item]) =>
      words(item, `${path}.${key}`),
    );
  }
  return [];
}

describe("the interface text", () => {
  const all = words(en);

  it("is read whole by this test", () => {
    expect(all.length).toBeGreaterThan(100);
  });

  it("never says niche: AWAY's answers are uncommon", () => {
    expect(all.filter((w) => /niche/i.test(w.text))).toEqual([]);
    expect(en.home.modes.away.line).toMatch(/uncommon/);
    expect(en.play.board.instruction.away).toMatch(/uncommon/);
    expect(en.play.title.away).toMatch(/uncommon/);
    expect(en.home.description).toMatch(/uncommon/);
  });

  it("keeps the how-to-play page's description free of any one mode", () => {
    expect(en.howToPlay.description).not.toMatch(/HOME|AWAY|common/i);
    expect(en.howToPlay.description).toMatch(/30 seconds/);
  });

  it("names the six shots by their names, and no other", () => {
    expect(SHOT_ORDER.map((shot) => en.play.shots[shot])).toEqual([
      "WORLDIE",
      "GOLAZO",
      "TRIVELA",
      "TOE POKE",
      "TAP IN",
      "MISS",
    ]);
    const old = /bicycle|finesse|power shot|\bchip\b/i;
    expect(all.filter((w) => old.test(w.text))).toEqual([]);
  });

  it("has a title for every rung of all four ladders, all different", () => {
    const home = TITLES.home.map((rung) => en.play.titles.home[rung.id]);
    const away = TITLES.away.map((rung) => en.play.titles.away[rung.id]);
    const retro = TITLES.retro.map((rung) => en.play.titles.retro[rung.id]);
    const nextgen = TITLES.nextgen.map(
      (rung) => en.play.titles.nextgen[rung.id],
    );
    const all4 = [...home, ...away, ...retro, ...nextgen];
    for (const title of all4) {
      expect(title).toMatch(/^[A-Z0-9 '!-]+$/);
      // One line on the full-time card in the big type, on a monitor.
      expect(title.length).toBeLessThanOrEqual(20);
    }
    expect(new Set(all4).size).toBe(40);
  });

  it("words RETRO by the oldest answer and NEXT-GEN by the most recent", () => {
    expect(en.home.modes.retro.label).toBe("RETRO");
    expect(en.home.modes.nextgen.label).toBe("NEXT-GEN");
    expect(en.play.board.instruction.retro).toMatch(/oldest/);
    expect(en.play.board.instruction.nextgen).toMatch(/most recent/);
    expect(en.play.title.retro).toMatch(/oldest/);
    expect(en.play.title.nextgen).toMatch(/most recent/);
    // The year where HOME and AWAY say a share.
    expect(en.play.sentence.retro.worldie("Wanderers", "1872")).toMatch(
      /^Wanderers: first did it in 1872\./,
    );
    expect(en.play.sentence.nextgen.miss("Ajax", "1995")).toMatch(
      /^Ajax: last did it in 1995\./,
    );
    // The full-time card's other-mode button fits its row of three (10 letters at most).
    for (const label of Object.values(en.play.fullTime.other)) {
      expect(label.length).toBeLessThanOrEqual(10);
    }
    // ...and all four are worded alike: the mode's name, "Play <name>" read out.
    for (const mode of ["home", "away", "retro", "nextgen"] as const) {
      expect(en.play.fullTime.other[mode]).toBe(en.home.modes[mode].label);
    }
    expect(en.play.fullTime.otherSpoken("RETRO")).toBe("Play RETRO");
  });
});
