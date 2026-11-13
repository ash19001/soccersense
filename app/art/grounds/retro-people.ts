/**
 * RETRO's crowd (.snaps/era-art/THEME.md): how the people watching dress in the early days
 * of the game. Called by the crowd painters (crowd.ts) when `p.era === "retro"`; the people
 * themselves are drawn by people.ts (`HAT_*`, `RATTLE`). At the small grounds most wear dark
 * overcoats; in the big stands (tier 4 and up) fewer do, so the club's colours read as
 * cleanly as today's crowd. Half wear flat caps of light tweed, one in five a black bowler;
 * one in eight swings a rattle painted in the club's colour when they cheer. Pure: the same
 * place gives the same person.
 */

import { P } from "~/art/palette";
import type { Color } from "~/pixel";
import { HAT_BOWLER, HAT_CAP, HAT_NONE, RATTLE } from "./people";
import { pick, rnd, type Paint, type Weighted } from "./paint";

/** Overcoats and jackets: blues and greys mostly, few mid-browns (they muddy a stand). */
const COATS: Weighted = [
  [P.night, 30],
  [P.slate, 26],
  [P.steel, 18],
  [P.concreteDark, 12],
  [P.concrete, 8],
  [P.woodDark, 6],
];

/**
 * Flat caps of tweed: light greys and browns, so a cap reads lighter than the black
 * bowler at a squint.
 */
const CAPS: Weighted = [
  [P.steel, 26],
  [P.concrete, 24],
  [P.wood, 20],
  [P.concreteLight, 14],
  [P.hairBrown, 16],
];

/** How many wear a dark overcoat over their colours, by tier. */
const COAT_SHARE: readonly number[] = [
  0.62, 0.62, 0.6, 0.55, 0.2, 0.2, 0.2, 0.2,
];

/**
 * How many wear a flat cap, and a bowler, by tier: in the big stands fewer hats, so the
 * faces and the colours read as today's crowd does.
 */
const CAP_SHARE: readonly number[] = [
  0.5, 0.5, 0.5, 0.5, 0.34, 0.34, 0.34, 0.34,
];
const BOWLER_SHARE: readonly number[] = [
  0.2, 0.2, 0.2, 0.2, 0.14, 0.14, 0.14, 0.14,
];

/** One person's dress, reused (painting allocates nothing per person). */
export interface RetroDress {
  body: Color;
  hair: Color;
  hat: number;
  rattle: Color;
}

const dress: RetroDress = {
  body: P.night,
  hair: P.night,
  hat: HAT_NONE,
  rattle: P.wood,
};

/**
 * The dress of the person at (x, y) (a seat, a place on the terrace): `body` and `hair`
 * are what today's crowd would wear there. The returned object is reused.
 */
export function retroDress(
  p: Paint,
  x: number,
  y: number,
  body: Color,
  hair: Color,
): RetroDress {
  const coat = rnd(p, x, y, 71) < (COAT_SHARE[p.tier] ?? 0.2);
  dress.body = coat ? pick(COATS, rnd(p, x, y, 72)) : body;
  const h = rnd(p, x, y, 73);
  const caps = CAP_SHARE[p.tier] ?? 0.34;
  if (h < caps) {
    dress.hat = HAT_CAP;
    dress.hair = pick(CAPS, rnd(p, x, y, 74));
  } else if (h < caps + (BOWLER_SHARE[p.tier] ?? 0.14)) {
    dress.hat = HAT_BOWLER;
    dress.hair = P.night;
  } else {
    dress.hat = HAT_NONE;
    dress.hair = hair;
  }
  if (rnd(p, x, y, 75) < 0.12) dress.hat |= RATTLE;
  // rattles were painted in the club's colours: his old gold, the nation's chalk
  dress.rattle = p.tier >= 5 ? P.chalk : P.retroLight;
  return dress;
}

/**
 * A standing watcher's coat (far.ts `watcher`, already graded by `E`): where today's wears
 * his red, RETRO's wears his old gold (and where his teal, a dark overcoat).
 */
export function retroCoat(E: (c: Color) => Color, coat: Color): Color {
  if (coat === E(P.home)) return E(P.retro);
  if (coat === E(P.homeLight)) return E(P.retroLight);
  if (coat === E(P.homeDark)) return E(P.retroDark);
  // and where today's wears teal, a dark wool overcoat
  if (coat === E(P.away) || coat === E(P.awayLight)) return E(P.slate);
  if (coat === E(P.awayDark)) return E(P.night);
  return coat;
}

/**
 * A standing watcher's hat (people.ts `Watcher.hat`, `hatColor`), graded by the sky (`p.E`)
 * as the watcher is: `n` is the watcher's own number.
 */
export function retroWatcherHat(
  p: Paint,
  n: number,
): { hat: number; hatColor: Color } {
  const d = retroDress(p, n, 977, P.night, P.night);
  return { hat: d.hat & 3, hatColor: p.E(d.hair) };
}
