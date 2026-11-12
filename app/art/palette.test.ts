import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";
import { toHex } from "~/pixel";
import type { Grade } from "~/game/types";
import {
  GRADE_COLORS,
  MODE_COLORS,
  P,
  PALETTE_HEX,
  PALETTE_NAMES,
} from "./palette";

/** The art bible's v0 table (section 3.1). A change here must be reported. */
const BIBLE: Record<string, string> = {
  ink: "#0f1220",
  night: "#1a2036",
  slate: "#2c3654",
  steel: "#56668a",
  mist: "#9fb0cc",
  chalk: "#f3eedd",
  white: "#ffffff",
  grassDeep: "#1b5e3f",
  grassDark: "#23824a",
  grass: "#33a653",
  grassLight: "#5cc45a",
  grassHi: "#9be06a",
  skyTop: "#2f6fd0",
  skyMid: "#5aa6f0",
  skyLow: "#a5dcf7",
  haze: "#e3f4f7",
  duskTop: "#2b2a66",
  duskMid: "#8c3f7d",
  duskLow: "#f0774a",
  duskGlow: "#ffcf6b",
  dawnTop: "#2a3f86",
  dawnMid: "#b877a8",
  dawnLow: "#ffc58a",
  dawnGlow: "#fff0c2",
  nightTop: "#070a1c",
  nightMid: "#101a3c",
  nightLow: "#1f2f5e",
  concreteDark: "#3b4159",
  concrete: "#6b7390",
  concreteLight: "#a2abc2",
  steelHi: "#d6dceb",
  brickDark: "#6e2c2a",
  brick: "#a8483a",
  brickLight: "#d0714f",
  wood: "#8a5a34",
  woodDark: "#5c3a22",
  skinA: "#f2c6a0",
  skinAShade: "#c98d6b",
  skinB: "#c98a5e",
  skinBShade: "#9a6040",
  skinC: "#7a4a32",
  skinCShade: "#55301f",
  hairDark: "#2a1c16",
  hairBrown: "#7a4b20",
  hairBlond: "#e0b040",
  homeDark: "#a3271f",
  home: "#e8452c",
  homeLight: "#ff8552",
  awayDark: "#116a80",
  away: "#19a9bf",
  awayLight: "#6fe0dc",
  goldDark: "#b9770e",
  gold: "#ffc928",
  goldLight: "#fff2a0",
  ledOff: "#1c1f2b",
  amberDim: "#6b3f0e",
  amber: "#ffb21f",
  ledGreen: "#6dff7a",
  ledRed: "#ff5a4d",
  gradeWorldie: "#ffc928",
  gradeGolazo: "#8fe35c",
  gradeTrivela: "#2fb36b",
  gradeToepoke: "#4aa6e8",
  gradeTapin: "#a66bea",
  gradeMiss: "#e9584a",
  gradeTimeup: "#7b86a3",
};

/** Colours added to the v0 table by the art-core owner. */
const ADDED = [
  "nightGlow",
  "cloudLight",
  "cloud",
  "cloudShade",
  "sun",
  "moon",
  "moonShade",
];

describe("palette", () => {
  it("has every colour of the art bible at its v0 value", () => {
    for (const [name, value] of Object.entries(BIBLE)) {
      expect(PALETTE_HEX, name).toHaveProperty(name, value);
    }
  });

  it("has nothing but the art bible's colours and the reported additions", () => {
    expect([...PALETTE_NAMES].sort()).toEqual(
      [...Object.keys(BIBLE), ...ADDED].sort(),
    );
  });

  it("keeps P and PALETTE_HEX in step", () => {
    expect(Object.keys(P)).toEqual(Object.keys(PALETTE_HEX));
    for (const name of PALETTE_NAMES) {
      expect(PALETTE_HEX[name], name).toMatch(/^#[0-9a-f]{6}$/);
      expect(toHex(P[name]), name).toBe(PALETTE_HEX[name]);
      expect(P[name] >>> 24, name).toBe(0xff);
    }
  });

  it("is frozen", () => {
    expect(Object.isFrozen(P)).toBe(true);
    expect(Object.isFrozen(PALETTE_HEX)).toBe(true);
  });

  it("makes the worldie gold", () => {
    expect(P.gradeWorldie).toBe(P.gold);
  });

  it("is the same in the interface's tokens.css, for every colour", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const css = readFileSync(join(here, "../ui/tokens.css"), "utf8");
    const kebab = (name: string) =>
      name.replace(/[A-Z]/g, (ch) => `-${ch.toLowerCase()}`);
    const missing: string[] = [];
    // The sky's extras (ADDED) are only for painters; everything in the bible's table is CSS.
    for (const name of PALETTE_NAMES.filter((n) => n in BIBLE)) {
      const found = new RegExp(`--c-${kebab(name)}: *(#[0-9a-fA-F]{6})`).exec(
        css,
      );
      if (found?.[1].toLowerCase() !== PALETTE_HEX[name]) missing.push(name);
    }
    expect(missing).toEqual([]);
    // And no grade colour in the CSS that the palette does not have.
    const grades = [...css.matchAll(/--c-grade-([a-z]+):/g)].map((m) => m[1]);
    expect(grades.sort()).toEqual(
      PALETTE_NAMES.filter((n) => n.startsWith("grade"))
        .map((n) => n.slice(5).toLowerCase())
        .sort(),
    );
  });
});

describe("MODE_COLORS", () => {
  it("is warm for home and teal for away", () => {
    expect(MODE_COLORS.home).toEqual({
      dark: P.homeDark,
      base: P.home,
      light: P.homeLight,
    });
    expect(MODE_COLORS.away).toEqual({
      dark: P.awayDark,
      base: P.away,
      light: P.awayLight,
    });
  });
});

describe("GRADE_COLORS", () => {
  it("has a colour for every grade", () => {
    const grades: Grade[] = [
      "worldie",
      "golazo",
      "trivela",
      "toepoke",
      "tapin",
      "miss",
      "timeup",
      "skipped",
    ];
    expect(Object.keys(GRADE_COLORS).sort()).toEqual([...grades].sort());
    expect(GRADE_COLORS.worldie).toBe(P.gold);
    expect(GRADE_COLORS.golazo).toBe(P.gradeGolazo);
    expect(GRADE_COLORS.trivela).toBe(P.gradeTrivela);
    expect(GRADE_COLORS.toepoke).toBe(P.gradeToepoke);
    expect(GRADE_COLORS.tapin).toBe(P.gradeTapin);
    expect(GRADE_COLORS.miss).toBe(P.gradeMiss);
  });

  it("uses the time-up grey for both timeup and skipped", () => {
    expect(GRADE_COLORS.timeup).toBe(P.gradeTimeup);
    expect(GRADE_COLORS.skipped).toBe(P.gradeTimeup);
  });
});
