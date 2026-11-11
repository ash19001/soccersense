/**
 * The palette (art bible section 3.1). Painters use these names, never raw hex.
 *
 * `SOURCE` below is the single source of truth. `P` (engine colours) and `PALETTE_HEX`
 * (CSS strings, which the DOM interface checks its `--c-*` variables against) are both
 * generated from it, so they cannot drift.
 *
 * The six grade colours are named `gradeWorldie` ... `gradeTimeup` to match the interface's
 * `--c-grade-*` variables. Most code should reach them through `GRADE_COLORS`.
 *
 * Colours that are not in the art bible's v0 table are marked "added": each one is a step
 * of a ramp, hue-shifted along it (shadows lean blue or purple, highlights lean yellow).
 */

import { hex, type Color } from "~/pixel";
import type { Grade, Mode } from "~/game/types";

const SOURCE = {
  // neutrals
  ink: "#0f1220",
  night: "#1a2036",
  slate: "#2c3654",
  steel: "#56668a",
  mist: "#9fb0cc",
  chalk: "#f3eedd",
  white: "#ffffff",

  // grass
  grassDeep: "#1b5e3f",
  grassDark: "#23824a",
  grass: "#33a653",
  grassLight: "#5cc45a",
  grassHi: "#9be06a",

  // day sky, zenith to horizon
  skyTop: "#2f6fd0",
  skyMid: "#5aa6f0",
  skyLow: "#a5dcf7",
  haze: "#e3f4f7",

  // dusk sky
  duskTop: "#2b2a66",
  duskMid: "#8c3f7d",
  duskLow: "#f0774a",
  duskGlow: "#ffcf6b",

  // dawn sky
  dawnTop: "#2a3f86",
  dawnMid: "#b877a8",
  dawnLow: "#ffc58a",
  dawnGlow: "#fff0c2",

  // night sky
  nightTop: "#070a1c",
  nightMid: "#101a3c",
  nightLow: "#1f2f5e",
  /** added: the night ramp's fourth step, the faint glow that sits on the horizon. */
  nightGlow: "#344a82",

  // clouds (added): a three-step daylight ramp, white top to blue-grey underside
  cloudLight: "#ffffff",
  cloud: "#d6e6f7",
  cloudShade: "#b4cbe8",

  // sun and moon (added)
  sun: "#fff8d0",
  moon: "#f6f1dc",
  moonShade: "#c3c8d8",

  // structure
  concreteDark: "#3b4159",
  concrete: "#6b7390",
  concreteLight: "#a2abc2",
  steelHi: "#d6dceb",

  // warm buildings
  brickDark: "#6e2c2a",
  brick: "#a8483a",
  brickLight: "#d0714f",
  wood: "#8a5a34",
  woodDark: "#5c3a22",

  // skin, each with its shade
  skinA: "#f2c6a0",
  skinAShade: "#c98d6b",
  skinB: "#c98a5e",
  skinBShade: "#9a6040",
  skinC: "#7a4a32",
  skinCShade: "#55301f",

  // hair
  hairDark: "#2a1c16",
  hairBrown: "#7a4b20",
  hairBlond: "#e0b040",

  // HOME is always warm red-orange
  homeDark: "#a3271f",
  home: "#e8452c",
  homeLight: "#ff8552",

  // AWAY is always teal
  awayDark: "#116a80",
  away: "#19a9bf",
  awayLight: "#6fe0dc",

  // gold
  goldDark: "#b9770e",
  gold: "#ffc928",
  goldLight: "#fff2a0",

  // scoreboard
  ledOff: "#1c1f2b",
  amberDim: "#6b3f0e",
  amber: "#ffb21f",
  ledGreen: "#6dff7a",
  ledRed: "#ff5a4d",

  // grades (worldie is gold)
  gradeWorldie: "#ffc928",
  gradeTopbins: "#8fe35c",
  gradeGoal: "#2fb36b",
  gradeOntarget: "#4aa6e8",
  gradeWide: "#e9584a",
  gradeTimeup: "#7b86a3",
} as const;

export type PaletteName = keyof typeof SOURCE;

const NAMES = Object.keys(SOURCE) as PaletteName[];

function build<T>(fn: (css: string) => T): Readonly<Record<PaletteName, T>> {
  const out = {} as Record<PaletteName, T>;
  for (const name of NAMES) out[name] = fn(SOURCE[name]);
  return Object.freeze(out);
}

/** Every palette colour as an engine `Color`: `P.grass`, `P.duskLow`. */
export const P: Readonly<Record<PaletteName, Color>> = build(hex);

/** The same names as lower-case `"#rrggbb"` strings. */
export const PALETTE_HEX: Readonly<Record<PaletteName, string>> = build((css) =>
  css.toLowerCase(),
);

/** Every palette name, in the order of the art bible's table. */
export const PALETTE_NAMES: readonly PaletteName[] = Object.freeze(NAMES);

/** A three-step ramp for one mode's kit, patches, badges and buttons. */
export interface ModeRamp {
  dark: Color;
  base: Color;
  light: Color;
}

/** HOME is warm red-orange, AWAY is teal. Everywhere. */
export const MODE_COLORS: Readonly<Record<Mode, ModeRamp>> = Object.freeze({
  home: Object.freeze({ dark: P.homeDark, base: P.home, light: P.homeLight }),
  away: Object.freeze({ dark: P.awayDark, base: P.away, light: P.awayLight }),
});

/** One colour per grade. `timeup` and `skipped` share the time-up grey. */
export const GRADE_COLORS: Readonly<Record<Grade, Color>> = Object.freeze({
  worldie: P.gradeWorldie,
  topbins: P.gradeTopbins,
  goal: P.gradeGoal,
  ontarget: P.gradeOntarget,
  wide: P.gradeWide,
  timeup: P.gradeTimeup,
  skipped: P.gradeTimeup,
});
