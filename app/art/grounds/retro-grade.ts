/**
 * RETRO's one grade (.snaps/era-art/THEME.md; art bible 10.2), for every tier: each ground
 * colour is moved a little way towards a faded warm tan before the light grades it, so the
 * whole picture leans warm and a touch faded, as an old print does. The sky, lamps and every
 * light source are raw colour and never pass through it; the grass stays green and the cast
 * (graded by the ground's light, not this) stands out.
 *
 * paint.ts `paintFor` applies it to `E`, `S` and `D` whenever the era is "retro", at tiers 0
 * to 7 alike, so the promotion from 3 to 4 keeps its colour.
 */

import { P } from "~/art/palette";
import { mix, type Color } from "~/pixel";

type Grade = (c: Color) => Color;

/** The tan RETRO leans towards: chalk a little under halfway to wood. */
const SEPIA = mix(P.chalk, P.wood, 0.45);

/** How far towards it every ground colour goes. */
export const RETRO_WARM = 0.14;

const warmed = new Map<Color, Color>();

/** A colour warmed and faded RETRO's way, before the light. */
export function retroWarm(c: Color): Color {
  let v = warmed.get(c);
  if (v === undefined) {
    v = mix(c, SEPIA, RETRO_WARM);
    warmed.set(c, v);
  }
  return v;
}

/** A grade that warms each colour first (cached per grade, so per build). */
export function retroGrade(grade: Grade): Grade {
  const cache = new Map<Color, Color>();
  return (c) => {
    let v = cache.get(c);
    if (v === undefined) {
      v = grade(retroWarm(c));
      cache.set(c, v);
    }
    return v;
  };
}
