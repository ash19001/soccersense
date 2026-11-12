/**
 * The palette (art bible section 3.1). Painters use these names, never raw hex.
 *
 * `SOURCE` below is the single source of truth. `P` (engine colours) and `PALETTE_HEX`
 * (CSS strings, which the DOM interface checks its `--c-*` variables against) are both
 * generated from it, so they cannot drift.
 *
 * The seven grade colours are named `gradeWorldie` ... `gradeTimeup` (one per shot, and the
 * time-up grey) to match the interface's `--c-grade-*` variables. Most code should reach them
 * through `GRADE_COLORS`.
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

  // grades, one per shot, best first: a ramp round the colour wheel from gold to red
  // (the worldie is gold)
  gradeWorldie: "#ffc928",
  gradeGolazo: "#8fe35c",
  gradeTrivela: "#2fb36b",
  gradeToepoke: "#4aa6e8",
  /** added: the tap in, the ramp's step between the toe poke's blue and the miss's red. */
  gradeTapin: "#a66bea",
  gradeMiss: "#e9584a",
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

/**
 * Club colours (added 2026-11-11 for the home screen's daily stadium colours,
 * stadium-club.ts): three-step ramps, dark, base and light, hue-shifted along each (shadows
 * lean blue or purple, highlights lean yellow). Kept apart from `P`, which is the art
 * bible's table and the interface's tokens: these are only for the stadium painters.
 */
const CLUB_SOURCE = {
  crimsonDark: "#6e1230",
  crimson: "#c2203c",
  crimsonLight: "#ef5a55",
  claretDark: "#3f1236",
  claret: "#7a1d43",
  claretLight: "#a83c4e",
  skyBlueDark: "#3b6fb0",
  skyBlue: "#6ab0e4",
  skyBlueLight: "#b0e2ee",
  canaryDark: "#c48a10",
  canary: "#ffd83a",
  canaryLight: "#fff59a",
  forestDark: "#0f4a3c",
  forest: "#1c7f48",
  forestLight: "#46b05a",
  emeraldDark: "#0d4f3a",
  emerald: "#178a55",
  emeraldLight: "#3fbf78",
  // black and white stay warm all along: a cool charcoal or a blue-grey shadow on white reads
  // as navy and white, which no scheme may ever look like (stadium-club.test.ts holds it)
  charcoalDark: "#141312",
  charcoal: "#2a2826",
  charcoalLight: "#4a4643",
  snowDark: "#c3c0ba",
  snow: "#eceef0",
  snowLight: "#ffffff",
  tangerineDark: "#b2420f",
  tangerine: "#f2771c",
  tangerineLight: "#ffad45",
  violetDark: "#351a63",
  violet: "#5f30a3",
  violetLight: "#8f5ed0",
  pinkDark: "#9c2a68",
  pink: "#e45697",
  pinkLight: "#ff96bf",
  royalDark: "#1a2c80",
  royal: "#2a4cc0",
  royalLight: "#5c82e6",
  lilacDark: "#4b2c8c",
  lilac: "#7e55d3",
  lilacLight: "#b893f2",
} as const;

export type ClubColorName = keyof typeof CLUB_SOURCE;

/** Every club colour as an engine `Color`: `CLUB.claret`, `CLUB.skyBlueLight`. */
export const CLUB: Readonly<Record<ClubColorName, Color>> = (() => {
  const out = {} as Record<ClubColorName, Color>;
  for (const name of Object.keys(CLUB_SOURCE) as ClubColorName[]) {
    out[name] = hex(CLUB_SOURCE[name]);
  }
  return Object.freeze(out);
})();

/** One colour per grade. `timeup` and `skipped` share the time-up grey. */
export const GRADE_COLORS: Readonly<Record<Grade, Color>> = Object.freeze({
  worldie: P.gradeWorldie,
  golazo: P.gradeGolazo,
  trivela: P.gradeTrivela,
  toepoke: P.gradeToepoke,
  tapin: P.gradeTapin,
  miss: P.gradeMiss,
  timeup: P.gradeTimeup,
  skipped: P.gradeTimeup,
});
