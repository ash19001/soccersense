/**
 * What every painter of the career ground shares: the geometry of one canvas size, the
 * paint context of one build (size, light, tier, mode), and the list of moving things a
 * build hands to the frame loop.
 *
 * Positions are written for the 130 px phone stage and scaled with `g.sx(offset)`, so a
 * monitor's wider stage keeps the same arrangement. Heights are fixed pixels measured up
 * from the far touchline `g.F` (the far side) or down from the near touchline `g.N`.
 */

import type { Mode } from "~/game/types";
import type { Era } from "~/art/era";
import { careerLayout } from "~/art/layout";
import { distant, skyFor, type Lighting, type SkySpec } from "~/art/lighting";
import { P } from "~/art/palette";
import { hash2, type Color } from "~/pixel";
import { nextgenColors, nextgenShirts } from "./nextgen-people";
import { retroGrade, retroWarm } from "./retro-grade";
import { STAND } from "./stand";
import type { GroundLabels, Tier } from "./types";

export type Grade = (c: Color) => Color;

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

export interface Geo {
  w: number;
  h: number;
  cx: number;
  /** The stage's scale (careerLayout().stageScale). */
  k: number;
  /** The feet row. */
  gy: number;
  /** The far touchline. */
  F: number;
  /** The near touchline. */
  N: number;
  /** The foot of the street of houses behind the park, and the sky's horizon. */
  B: number;
  goalX: number;
  heroX: number;
  stageL: number;
  stageR: number;
  /** The rows the interface leaves visible (for the guides shot and the sun). */
  boardShrunkY: number;
  /** The vanishing point of lines that run across the pitch (towards the camera). */
  vx: number;
  vy: number;
  /** His house: its left column (it is `HOUSE_W` wide). */
  houseX: number;
  /** The church spire's middle column. */
  spireX: number;
}

/** A terraced house is this wide. */
export const HOUSE_W = 32;

/** Rows from the street's foot (B) up: wall top, roof ridge, chimney top. */
export const WALL_H = 34;
export const ROOF_H = 10;
export const CHIMNEY_H = 8;

export function geoFor(w: number, h: number): Geo {
  const c = careerLayout(w, h);
  const k = c.stageScale;
  const F = c.farTouchY;
  // Lines across the pitch lean like the goal's posts: 4 px in 5 rows at the goal line.
  const reach = Math.max(16, (c.goalX - c.cx) / 0.8);
  const sx = (off: number): number => c.cx + Math.round(off * k);
  return {
    w: c.w,
    h: c.h,
    cx: c.cx,
    k,
    gy: c.groundY,
    F,
    N: c.nearTouchY,
    B: F - 16,
    goalX: c.goalX,
    heroX: c.heroX,
    stageL: c.stageLeft,
    stageR: c.stageRight,
    boardShrunkY: c.boardShrunkY,
    vx: c.cx,
    vy: c.groundY - reach,
    houseX: sx(13) - HOUSE_W / 2,
    spireX: sx(52),
  };
}

/** A position on the 130 px stage, scaled to this canvas. */
export function sx(g: Geo, off: number): number {
  return g.cx + Math.round(off * g.k);
}

/** Where a line across the pitch that is at `xAtFeet` on the feet row is at row `y`. */
export function across(g: Geo, xAtFeet: number, y: number): number {
  return Math.round(g.vx + ((xAtFeet - g.vx) * (y - g.vy)) / (g.gy - g.vy));
}

// ---------------------------------------------------------------------------
// One build: the paint context
// ---------------------------------------------------------------------------

export interface Paint {
  g: Geo;
  light: Lighting;
  spec: SkySpec;
  tier: Tier;
  mode: Mode;
  seed: number;
  labels: GroundLabels;
  /** The era the ground is drawn in (`~/art/era`): "today" is HOME's and AWAY's look. */
  era: Era;
  /** Lit by the sky. */
  E: Grade;
  /** The ground's own structures: under the floodlights from tier 2 (lit), else the sky (env). */
  S: Grade;
  /** The floodlights are on (tier 2 and up, at night). */
  flood: boolean;
  /** Street lights, lit windows and lamps are on. */
  lamps: boolean;
  /** Far things: depth 0 is env, 1 the far horizon. */
  D: (c: Color, depth: number) => Color;
}

export function paintFor(
  g: Geo,
  light: Lighting,
  tier: Tier,
  mode: Mode,
  seed: number,
  labels: GroundLabels,
  era: Era = "today",
): Paint {
  const flood = tier >= 2 && light.lightsOn;
  const S = tier >= 2 ? light.lit : light.env;
  const D = (c: Color, depth: number): Color => distant(light, c, depth);
  // RETRO is warmed a little towards a faded sepia at every tier (retro-grade.ts)
  if (era === "retro") {
    return {
      g,
      light,
      spec: skyFor(light),
      tier,
      mode,
      seed,
      labels,
      era,
      E: retroGrade(light.env),
      S: retroGrade(S),
      flood,
      lamps: light.lightsOn,
      D: (c, depth) => D(retroWarm(c), depth),
    };
  }
  return {
    g,
    light,
    spec: skyFor(light),
    tier,
    mode,
    seed,
    labels,
    era,
    E: light.env,
    S,
    flood,
    lamps: light.lightsOn,
    D,
  };
}

// ---------------------------------------------------------------------------
// Crowd colours
// ---------------------------------------------------------------------------

export type Weighted = readonly (readonly [Color, number])[];

export function pick(table: Weighted, r: number): Color {
  let total = 0;
  for (const [, wgt] of table) total += wgt;
  let acc = 0;
  const target = r * total;
  for (const [c, wgt] of table) {
    acc += wgt;
    if (target < acc) return c;
  }
  return table[0][0];
}

/** Coats and jumpers: the neutral part of any crowd. */
const NEUTRAL: Weighted = [
  [P.chalk, 10],
  [P.mist, 8],
  [P.steel, 10],
  [P.slate, 9],
  [P.concreteDark, 5],
  [P.night, 5],
  [P.wood, 3],
  [P.skyMid, 2],
  [P.grassDark, 2],
];

/** His club's crowd: his colour, more of it the bigger the ground. */
function clubShirts(share: number): Weighted {
  return [
    ...NEUTRAL.map(([c, wgt]) => [c, wgt * (1 - share)] as const),
    [P.home, 34 * share],
    [P.homeDark, 14 * share],
    [P.homeLight, 6 * share],
    [P.chalk, 8 * share],
  ];
}

/** The nation's crowd: chalk shirts with his colour. */
const NATIONAL: Weighted = [
  [P.chalk, 40],
  [P.white, 6],
  [P.home, 22],
  [P.homeDark, 6],
  [P.mist, 6],
  [P.steel, 4],
  [P.slate, 3],
  [P.gold, 2],
];

/**
 * RETRO's crowd: his club's old gold (the shirt he wears, RETRO's colour) where today's
 * wears red, and the nation's brick red with chalk from tier 5 (retro.ts's kits). At the
 * small grounds most of them are in overcoats anyway (retro-people.ts).
 */
function retroShirts(tier: number, share: number): Weighted {
  if (tier >= 5) {
    return [
      [P.chalk, 40],
      [P.white, 6],
      [P.brick, 22],
      [P.brickDark, 6],
      [P.mist, 6],
      [P.steel, 4],
      [P.slate, 3],
      [P.retro, 2],
    ];
  }
  // his old gold, light and bright, with chalk and cream (no brown: retroDark and goldDark
  // muddy a stand, and goldDark is his own shirt, which must stand off the crowd)
  return [
    ...NEUTRAL.map(([c, wgt]) => [c, wgt * (1 - share)] as const),
    [P.retro, 14 * share],
    [P.gold, 18 * share],
    [P.retroLight, 16 * share],
    [P.chalk, 14 * share],
  ];
}

/** The hostile crowd away from home: the rival's plum, with chalk. */
function hostileShirts(share: number): Weighted {
  return [
    ...NEUTRAL.map(([c, wgt]) => [c, wgt * (1 - share)] as const),
    [P.duskMid, 34 * share],
    [P.duskTop, 16 * share],
    [P.chalk, 8 * share],
  ];
}

/** The travelling fans: teal. */
export const TRAVELLING: Weighted = [
  [P.away, 50],
  [P.awayDark, 22],
  [P.awayLight, 12],
  [P.chalk, 10],
  [P.night, 6],
];

export const HEADS: Weighted = [
  [P.skinA, 44],
  [P.skinB, 28],
  [P.skinC, 16],
  [P.hairDark, 6],
  [P.hairBrown, 4],
  [P.hairBlond, 2],
];

export const HAIR: Weighted = [
  [P.hairDark, 50],
  [P.hairBrown, 30],
  [P.hairBlond, 12],
  [P.mist, 8],
];

export const SKIN: Weighted = [
  [P.skinA, 45],
  [P.skinB, 32],
  [P.skinC, 23],
];

/** How much of the crowd wears colours at each tier (the rest wear coats). */
const SHARE: readonly number[] = [0.2, 0.3, 0.4, 0.6, 0.8, 0.85, 0.9, 0.9];

/** The shirts of the crowd at this tier and mode (not counting the travelling pocket). */
export function crowdShirts(p: Paint): Weighted {
  const share = SHARE[p.tier];
  if (p.era === "nextgen") return nextgenShirts(p.tier, share);
  if (p.era === "retro") return retroShirts(p.tier, share);
  if (p.mode === "away") return hostileShirts(share);
  return p.tier >= 5 ? NATIONAL : clubShirts(share);
}

/** Scarves and flags held up: the crowd's two colours. */
export function crowdColors(p: Paint, travelling: boolean): [Color, Color] {
  if (travelling) return [P.away, P.chalk];
  if (p.era === "nextgen") return nextgenColors(p.tier);
  if (p.era === "retro")
    return p.tier >= 5 ? [P.chalk, P.brick] : [P.retro, P.chalk];
  if (p.mode === "away") return [P.duskMid, P.chalk];
  return p.tier >= 5 ? [P.chalk, P.home] : [P.home, P.chalk];
}

/**
 * In AWAY mode a pocket of travelling fans in teal, in a corner of the far side: the
 * columns `[x0, x1)` above row `yEnd` (in a two-tier stand, the upper tier only). Empty in
 * HOME mode.
 */
export function pocket(p: Paint): [number, number, number] {
  if (p.mode !== "away") return [0, 0, 0];
  const x0 = sx(p.g, -64);
  const yEnd = p.tier >= 4 ? p.g.F - STAND.balcony : p.g.F;
  return [x0, x0 + Math.round(26 * p.g.k) + 12, yEnd];
}

/** Is this place in the travelling fans' pocket? */
export function inPocket(p: Paint, x: number, y: number): boolean {
  const [x0, x1, yEnd] = pocket(p);
  return x >= x0 && x < x1 && y < yEnd;
}

/** A stable 0..1 per thing, from its place and the build's seed. */
export function rnd(p: Paint, a: number, b: number, salt: number): number {
  return hash2(a, b, (p.seed * 131 + salt) | 0);
}
