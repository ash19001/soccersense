/**
 * NEXT-GEN's effects in the career scene (career-fx.ts hands them over when the era is
 * "nextgen"): the promotion's close-up of a ball with glowing panels driven into a net of
 * light, before an arena's lights out of focus; a goal's bursts of light (drones rising
 * from the roof and opening into rings, in place of fireworks); and the trophy lift's
 * glowing confetti.
 *
 * Lights are raw palette colours, their glows stepped halos of the next colour down the
 * ramp. Pure functions of the time and a seed; nothing allocates once warm.
 */

import { P } from "~/art/palette";
import { clamp, hash2, type Color, type Surface } from "~/pixel";
import { fireworkStart, type BuildColors } from "./career-fx";

/**
 * The close-up's colours in NEXT-GEN: a cool mist for the smoke; the near net's strings
 * cyan light with white knots, the far netting magenta; the ball white with glowing
 * magenta panels; the arena behind out of focus, its lights cyan and magenta.
 */
export function nextgenBuildColors(grade: (c: Color) => Color): BuildColors {
  return {
    hi: grade(P.cloudLight),
    base: grade(P.cloud),
    shade: grade(P.cloudShade),
    deep: grade(P.mist),
    backTop: grade(P.night),
    backMid: grade(P.slate),
    backPitch: grade(P.grassDeep),
    bokeh: P.skyLow,
    net: P.skyLow,
    netShade: P.skyMid,
    knot: P.white,
    netFar: P.nextgen,
    netOnBall: P.skyMid,
    netOnPatch: P.skyLow,
    leatherHi: grade(P.white),
    leather: grade(P.haze),
    leatherShade: grade(P.mist),
    leatherDeep: grade(P.steel),
    patch: P.nextgen,
    patchHi: P.nextgenLight,
    ink: grade(P.ink),
    era: "nextgen",
  };
}

/** The close-up's second colour of lights out of focus (every other one). */
export const NEXTGEN_BOKEH_2: Color = P.nextgenLight;

/** The streaks of air behind the ball: trails of light. */
export const NEXTGEN_TRAIL: Color = P.skyLow;

// ---------------------------------------------------------------------------
// A goal's bursts of light (tiers 4 to 7)
// ---------------------------------------------------------------------------

/** Colours that read on a day sky as well as a night one (no pale cyan on pale blue). */
const RING: Color[] = [
  P.nextgen,
  P.nextgenLight,
  P.white,
  P.ledGreen,
  P.goldLight,
  P.gradeToepoke,
];
const RING_LO: Color[] = [
  P.nextgenDark,
  P.nextgen,
  P.skyMid,
  P.grassLight,
  P.gold,
  P.nextgenDark,
];

/**
 * `n` bursts of light over the roof, `age` seconds after the goal, timed like today's
 * fireworks (`fireworkStart`, a 0.3 s climb, 1.1 s of burst, so the sound of each still
 * fits): a drone's light climbing on a dotted trail, then a ring of light opening out with
 * a dotted glow inside it, four glints round it while it is young, a flash at its heart;
 * the ring breaks up as it fades. `size` 0 (a tap in's) to 1 (a worldie's).
 */
export function drawNextgenGoalFireworks(
  s: Surface,
  age: number,
  n: number,
  size: number,
  x0: number,
  x1: number,
  roofY: number,
  seed: number,
  modeColor: Color,
): void {
  RING[1] = modeColor;
  const z = clamp(Number(size) || 0);
  const tt = Math.floor(age * 15) / 15;
  const RISE = 0.3;
  const LIFE = 1.1;
  for (let i = 0; i < n; i++) {
    const start = fireworkStart(i, z, seed);
    const a = tt - start;
    if (a < 0 || a >= RISE + LIFE) continue;
    const bx = Math.round(
      x0 + ((i * 0.618 + hash2(i, 2, seed) * 0.3) % 1) * (x1 - x0),
    );
    const high = (14 + 8 * z) * 2;
    const by = Math.max(8, Math.round(roofY - 12 - hash2(i, 3, seed) * high));
    const k = Math.floor(hash2(i, 4, seed) * RING.length) % RING.length;
    const col = RING[k];
    const lo = RING_LO[k];
    if (a < RISE) {
      // the drone climbing, its light and a dotted trail
      const y = Math.round(by + (1 - a / RISE) * (roofY - by + 8));
      s.px(bx, y, P.white);
      s.px(bx - 1, y, lo);
      s.px(bx + 1, y, lo);
      s.px(bx, y + 1, col);
      s.px(bx, y + 3, lo);
      s.px(bx, y + 6, lo);
      continue;
    }
    const u = (a - RISE) / LIFE;
    const rMax = (5 + 5 * z + hash2(i, 6, seed) * (3 + z)) * 2;
    const r = 2 + Math.round(Math.sqrt(u) * rMax);
    const drop = Math.round(u * u * 6);
    const cy = by + drop;
    const steps = Math.max(12, Math.round(r * 4.4));
    for (let q = 0; q < steps; q++) {
      if (
        u > 0.55 &&
        hash2(i * 41 + q, Math.floor(tt * 15), seed) < (u - 0.55) * 2.4
      ) {
        continue;
      }
      const ang = (q / steps) * Math.PI * 2;
      const cs = Math.cos(ang);
      const sn = Math.sin(ang) * 0.9;
      s.px(Math.round(bx + cs * r), Math.round(cy + sn * r), col);
      // the ring is a band of light two pixels deep for most of its life (three while
      // young), so it reads against a bright day sky as well as the night
      if (u < 0.7) {
        s.px(Math.round(bx + cs * (r - 1)), Math.round(cy + sn * (r - 1)), col);
      }
      if (u < 0.35) {
        s.px(Math.round(bx + cs * (r + 1)), Math.round(cy + sn * (r + 1)), col);
      }
      // its glow, dotted just inside it
      if ((q & 1) === 0 && r > 4) {
        s.px(
          Math.round(bx + cs * (r - 2.5)),
          Math.round(cy + sn * (r - 2.5)),
          lo,
        );
      }
      // spokes of light from its heart while it opens: a burst, not only a hoop
      if (u < 0.4 && (q & 3) === 2 && r > 8) {
        for (const f of [0.3, 0.42, 0.54, 0.66]) {
          s.px(Math.round(bx + cs * r * f), Math.round(cy + sn * r * f), col);
        }
      }
      // an inner ring of the glow colour while it is young
      if (u < 0.45 && (q & 3) === 0 && r > 8) {
        s.px(
          Math.round(bx + cs * r * 0.55),
          Math.round(cy + sn * r * 0.55),
          lo,
        );
      }
    }
    if (u < 0.5 && r > 6) {
      // four glints round it, a plus each
      for (let g = 0; g < 4; g++) {
        const ang = (g / 4) * Math.PI * 2 + Math.PI / 4 + i;
        const gx = Math.round(bx + Math.cos(ang) * (r + 3));
        const gy = Math.round(cy + Math.sin(ang) * (r + 3) * 0.9);
        s.px(gx, gy, P.white);
        s.px(gx - 1, gy, col);
        s.px(gx + 1, gy, col);
        s.px(gx, gy - 1, col);
        s.px(gx, gy + 1, col);
      }
    }
    if (u < 0.12) {
      s.rect(bx - 1, cy - 1, 2, 2, P.white);
      s.px(bx - 2, cy - 1, col);
      s.px(bx + 1, cy, col);
      s.px(bx - 1, cy - 2, col);
      s.px(bx, cy + 1, col);
    }
  }
}

// ---------------------------------------------------------------------------
// Glowing confetti for the trophy lift
// ---------------------------------------------------------------------------

const CHIP: Color[] = [
  P.nextgenLight,
  P.skyLow,
  P.white,
  P.nextgen,
  P.nextgenLight,
  P.ledGreen,
];
const CHIP_LO: Color[] = [
  P.nextgen,
  P.skyMid,
  P.mist,
  P.nextgenDark,
  P.nextgen,
  P.grassLight,
];

/**
 * Glowing confetti falling over `x0..x1` from `top` to `bottom`, `t` seconds after it was
 * fired (the same fall as today's): bright chips of light, each with a pixel of its glow
 * trailing above it, tumbling to an edge-on sliver and back.
 */
export function drawNextgenConfetti(
  s: Surface,
  t: number,
  x0: number,
  x1: number,
  top: number,
  bottom: number,
  seed: number,
  mode: Color,
  modeLight: Color,
): void {
  CHIP[3] = mode;
  CHIP[4] = modeLight;
  const span = Math.max(1, bottom - top);
  const width = Math.max(1, x1 - x0);
  const count = Math.round(Math.min(140, (width * 0.45) / 2));
  const flutter = Math.floor(t * 6);
  for (let i = 0; i < count; i++) {
    const speed = (12 + hash2(i, 1, seed) * 16) * 2;
    const fall = t * speed - hash2(i, 2, seed) * span * 1.3;
    if (fall < 0) continue;
    const y = Math.round(top + (fall % span));
    const sway = Math.sin(t * (1.5 + hash2(i, 3, seed)) + i) * 4.4;
    const x = Math.round(x0 + hash2(i, 4, seed) * width + sway);
    const c = CHIP[i % CHIP.length];
    const lo = CHIP_LO[i % CHIP.length];
    const turn = (flutter + i) % 4;
    if (turn === 0) {
      s.rect(x, y, 2, 2, c);
      s.hline(x, y - 1, 2, lo);
    } else if (turn === 1) {
      s.rect(x, y, 3, 1, c);
      s.px(x + 1, y - 1, lo);
    } else if (turn === 2) {
      s.rect(x, y, 1, 3, c);
      s.px(x, y - 1, lo);
    } else {
      s.px(x, y, P.white);
      s.px(x - 1, y, lo);
      s.px(x + 1, y, lo);
      s.px(x, y - 1, lo);
    }
  }
}
