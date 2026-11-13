/**
 * RETRO's near crowd seen from behind (crowd.ts `crowdBacks`, tiers 3 to 7): the people
 * closest to the camera, the biggest patch of crowd on a phone. The seated crowd's dress
 * (`retroDress`, retro-people.ts) is mostly dark overcoats, which far away reads as a crowd;
 * this close it read as a dark mush. So the near crowd wears lighter things: cream and chalk
 * mackintoshes and old gold jerseys to tier 4, chalk and the nation's brick from tier 5
 * (over half the crowd, the way HOME's near crowd is mostly red), with browns and a little
 * tweed, and navy kept under a fifth. Caps are a step lighter than the coat
 * under them (or a step darker on a pale coat), so every head separates from its shoulders.
 * About one in five wears his colours as a knotted scarf on the collar (`neckScarf`).
 *
 * Pure: the same place gives the same person. Nothing allocates per person.
 */

import { P } from "~/art/palette";
import { mix, type Color, type Surface } from "~/pixel";
import { pick, rnd, type Paint, type Weighted } from "./paint";
import { BACK_BOWLER, BACK_CAP } from "./people";

/** Cream paint and cloth (as retro-high.ts's `RETRO.cream`). */
export const CREAM = mix(P.chalk, P.retroLight, 0.35);
/** A pale tweed, and a mid one. */
const TWEED_LIGHT = mix(P.concreteLight, P.retroLight, 0.25);
const TWEED = mix(P.steel, P.wood, 0.35);

/**
 * Coats and jerseys to tier 4: over half cream, chalk and his old gold (a crowd in his
 * colours, as HOME's is in red), the rest browns, a little tweed, navy under a fifth.
 */
const CLUB_COATS: Weighted = [
  [CREAM, 18],
  [P.chalk, 10],
  [P.retro, 20],
  [P.retroLight, 6],
  [P.wood, 10],
  [P.retroDark, 6],
  [TWEED, 6],
  [P.brickDark, 4],
  [P.slate, 8],
  [P.night, 12],
];

/** From tier 5: the nation's chalk and brick, the same browns and navy round them. */
const NATION_COATS: Weighted = [
  [P.chalk, 20],
  [CREAM, 8],
  [P.brick, 20],
  [P.brickLight, 6],
  [P.wood, 10],
  [TWEED, 6],
  [P.brickDark, 6],
  [P.slate, 8],
  [P.night, 12],
];

/** Caps over a dark coat: a step lighter. */
const CAPS_ON_DARK: Weighted = [
  [P.steel, 30],
  [TWEED_LIGHT, 22],
  [P.wood, 22],
  [P.concrete, 16],
  [P.retro, 10],
];

/** Caps over a pale or bright coat: a step darker. */
const CAPS_ON_LIGHT: Weighted = [
  [TWEED, 30],
  [P.wood, 26],
  [P.slate, 24],
  [P.woodDark, 20],
];

/** The coats a cap must be lighter than. */
const DARK: ReadonlySet<Color> = new Set<Color>([
  P.night,
  P.slate,
  P.brickDark,
  P.retroDark,
  P.wood,
  TWEED,
]);

/** One near fan's dress, reused (painting allocates nothing per person). */
export interface NearDress {
  /** The coat. */
  body: Color;
  /** `BACK_CAP`, `BACK_BOWLER`, or -1 for a bare head. */
  style: number;
  /** The hat and its shade (its peak, a bowler's brim). */
  hat: Color;
  hatShade: Color;
  /** A knotted scarf on his collar. */
  scarf: boolean;
}

const dress: NearDress = {
  body: P.night,
  style: -1,
  hat: P.night,
  hatShade: P.night,
  scarf: false,
};

/**
 * The near fan at (x, y): his coat, his hat (or none) and whether he wears a scarf. The
 * returned object is reused.
 */
export function retroNearDress(p: Paint, x: number, y: number): NearDress {
  const coat = pick(p.tier >= 5 ? NATION_COATS : CLUB_COATS, rnd(p, x, y, 171));
  dress.body = coat;
  const dark = DARK.has(coat);
  const h = rnd(p, x, y, 173);
  if (h < 0.46) {
    dress.style = BACK_CAP;
    dress.hat = pick(dark ? CAPS_ON_DARK : CAPS_ON_LIGHT, rnd(p, x, y, 174));
    // (never the coat's own colour: the head must separate from the shoulders)
    if (dress.hat === coat) dress.hat = dark ? P.concrete : P.woodDark;
    dress.hatShade = mix(dress.hat, P.night, 0.3);
  } else if (h < 0.64) {
    // a bowler: dark felt with a lit crown, or a brown one over a dark coat
    dress.style = BACK_BOWLER;
    dress.hat = dark ? (coat === P.wood ? P.steel : P.wood) : P.slate;
    dress.hatShade = dark ? P.woodDark : P.night;
  } else {
    dress.style = -1;
    dress.hat = coat;
    dress.hatShade = coat;
  }
  dress.scarf = rnd(p, x, y, 176) < 0.2;
  return dress;
}

/**
 * A scarf round a near fan's collar (the `crowdBack` sprite at (x, y)): a band across the
 * shoulders in 2 px stripes of his two colours, its end hanging down his back in 2 px
 * stripes too, so it reads as a striped scarf on any coat (on a coat of one of its
 * colours the other's stripes still show as a run, never as a lone fleck).
 */
export function neckScarf(
  s: Surface,
  x: number,
  y: number,
  a: Color,
  b: Color,
): void {
  for (let i = 0; i < 8; i++) {
    const c = (i >> 1) & 1 ? b : a;
    s.px(x + 1 + i, y + 6, c);
    s.px(x + 1 + i, y + 7, c);
  }
  // the end hanging down his back, 2 px wide, in stripes of his two colours
  for (let k = 0; k < 4; k++) {
    const c = (k >> 1) & 1 ? a : b;
    s.px(x + 6, y + 8 + k, c);
    s.px(x + 7, y + 8 + k, c);
  }
}
