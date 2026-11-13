/**
 * RETRO's effects in the career scene (career-fx.ts hands them over when the era is
 * "retro"): the promotion's close-up of an old brown leather ball, laced, in a net of thick
 * rope before a warm, gas-lit stand; a goal's fireworks of the early days (gold willows on
 * rockets on sticks); and the trophy lift's paper and caps thrown in the air.
 *
 * Pure functions of the time and a seed; nothing allocates once warm.
 */

import { oldBurst } from "~/art/grounds/retro-high";
import { P } from "~/art/palette";
import { clamp, hash2, mix, shade, type Color, type Surface } from "~/pixel";
import { fireworkStart, type BuildColors } from "./career-fx";

/** The close-up's colours in RETRO: hemp rope, a brown leather ball, gas light behind. */
export function retroBuildColors(grade: (c: Color) => Color): BuildColors {
  return {
    hi: grade(P.white),
    base: grade(P.chalk),
    shade: grade(mix(P.concreteLight, P.retroLight, 0.3)),
    deep: grade(mix(P.concrete, P.wood, 0.25)),
    backTop: grade(mix(P.night, P.woodDark, 0.35)),
    backMid: grade(mix(P.slate, P.woodDark, 0.4)),
    backPitch: grade(P.grassDeep),
    bokeh: grade(mix(P.retroLight, P.goldLight, 0.4)),
    net: grade(mix(P.chalk, P.wood, 0.3)),
    netShade: grade(mix(P.wood, P.woodDark, 0.4)),
    knot: grade(mix(P.chalk, P.retroLight, 0.4)),
    netFar: grade(mix(P.mist, P.wood, 0.35)),
    netOnBall: grade(mix(P.retroLight, P.chalk, 0.3)),
    netOnPatch: grade(P.retro),
    leatherHi: grade(mix(P.retroLight, P.retro, 0.35)),
    leather: grade(mix(P.retro, P.wood, 0.45)),
    leatherShade: grade(P.wood),
    leatherDeep: grade(P.woodDark),
    // the lace's slot and the lace
    patch: grade(mix(P.woodDark, P.ink, 0.45)),
    patchHi: grade(mix(P.retroLight, P.chalk, 0.25)),
    ink: grade(P.ink),
    era: "retro",
  };
}

/** The light on the ball: from the top left and in front (as today's close-up). */
const LX = -0.45;
const LY = -0.58;
const LZ = 0.68;

/**
 * An old leather football of radius `r` on (cx, cy), close up, turned `yaw` about the
 * upright and `pitch` about the level: brown leather in four tones lit from the top left,
 * an ink outline, eighteen panels in six groups of three (the strips on neighbouring faces
 * crossing), their stitched seams a tone darker, and the lace's slot with its criss-cross
 * of pale thong on one middle strip. Only what `inHole` allows is painted.
 */
export function drawOldBall(
  s: Surface,
  cx: number,
  cy: number,
  r: number,
  yaw: number,
  pitch: number,
  c: BuildColors,
  inHole: (x: number, y: number) => boolean,
): void {
  const lim = r * r + r;
  const rim = (r - 1) * (r - 1) + (r - 1);
  const cyw = Math.cos(yaw);
  const syw = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const tones = [c.leatherHi, c.leather, c.leatherShade, c.leatherDeep, c.ink];
  const seamW = 0.75 / Math.max(4, r);
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      const d = x * x + y * y;
      if (d > lim || !inHole(cx + x, cy + y)) continue;
      if (d > rim) {
        s.px(cx + x, cy + y, c.ink);
        continue;
      }
      const X = x / r;
      const Y = y / r;
      const Z = Math.sqrt(Math.max(0, 1 - X * X - Y * Y));
      const l = X * LX + Y * LY + Z * LZ;
      let tone = l > 0.72 ? 0 : l > 0.3 ? 1 : l > 0.02 ? 2 : 3;
      if (r >= 4) {
        // the point on the ball under this pixel, turned back to the ball's own frame
        const vy = Y * cp + Z * sp;
        const z1 = -Y * sp + Z * cp;
        const vx = X * cyw - z1 * syw;
        const vz = X * syw + z1 * cyw;
        const ax = Math.abs(vx);
        const ay = Math.abs(vy);
        const az = Math.abs(vz);
        // which face of the cube of panels, its strips' coordinate, and the next face's
        let dom: number;
        let q: number;
        let along: number;
        let second: number;
        if (ax >= ay && ax >= az) {
          dom = ax;
          q = vy / ax;
          along = vz / ax;
          second = Math.max(ay, az);
        } else if (ay >= az) {
          dom = ay;
          q = vz / ay;
          along = vx / ay;
          second = Math.max(ax, az);
        } else {
          dom = az;
          q = vx / az;
          along = vy / az;
          second = Math.max(ax, ay);
        }
        const w = seamW / Math.max(0.35, dom * Z + 0.2);
        const edge = dom - second < w * 1.6;
        const strip = Math.abs(Math.abs(q) - 1 / 3) < w;
        if (edge || strip) {
          // a seam: a tone darker, its stitches darker still every other pixel
          tone = Math.min(4, tone + (((x + y) & 1) === 0 ? 2 : 1));
        } else if (vy > 0 && ay === dom && Math.abs(q) < 1 / 3) {
          // (on the face that turns to us as the net holds it)
          // the lace: a slot down the middle strip, a thong criss-crossing it
          const slot = Math.abs(q) < w * 1.4 && Math.abs(along) < 0.42;
          const k = Math.round(along / 0.12);
          const cross =
            Math.abs(along) < 0.42 &&
            Math.abs(along - k * 0.12) < w * 1.6 &&
            Math.abs(q) < 0.11;
          if (cross) {
            s.px(cx + x, cy + y, c.patchHi);
            continue;
          }
          if (slot) {
            s.px(cx + x, cy + y, c.patch);
            continue;
          }
        }
      }
      s.px(cx + x, cy + y, tones[tone]);
    }
  }
}

/**
 * A goal's fireworks in RETRO: the same number and the same moments as today's
 * (`fireworkStart`, so the sounds still match), each a rocket on its stick bursting into a
 * willow of gold or a hanging star.
 */
export function drawRetroGoalFireworks(
  s: Surface,
  age: number,
  n: number,
  size: number,
  x0: number,
  x1: number,
  roofY: number,
  seed: number,
): void {
  if (!(age >= 0)) return;
  const z = clamp(Number(size) || 0);
  const tt = Math.floor(age * 15) / 15;
  const RISE = 0.4;
  const LIFE = 1.3;
  for (let i = 0; i < n; i++) {
    const a = tt - fireworkStart(i, z, seed);
    if (a < 0 || a >= RISE + LIFE) continue;
    const bx = Math.round(
      x0 + ((i * 0.618 + hash2(i, 2, seed) * 0.3) % 1) * (x1 - x0),
    );
    const high = (14 + 8 * z) * 2;
    const by = Math.max(8, Math.round(roofY - 12 - hash2(i, 3, seed) * high));
    oldBurst(
      s,
      i,
      a,
      RISE + LIFE,
      bx,
      by,
      seed,
      0.7 + 0.4 * z,
      roofY - by + 8,
      true,
    );
  }
}

/** What is thrown at the trophy lift: paper in cream and the club's colours. */
const PAPERS: Color[] = [
  P.chalk,
  P.retroLight,
  P.white,
  P.gold,
  P.home,
  P.homeLight,
];

/**
 * The trophy lift in RETRO: torn paper and programmes in the air, and a few caps and
 * bowlers thrown up from the crowd tumbling down over the pitch.
 */
export function drawRetroConfetti(
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
  if (!(t >= 0)) return;
  PAPERS[4] = mode;
  PAPERS[5] = modeLight;
  const span = Math.max(1, bottom - top);
  const width = Math.max(1, x1 - x0);
  const count = Math.round(Math.min(110, (width * 0.35) / 2));
  const flutter = Math.floor(t * 5);
  for (let i = 0; i < count; i++) {
    const speed = (10 + hash2(i, 1, seed) * 12) * 2;
    const fall = t * speed - hash2(i, 2, seed) * span * 1.3;
    if (fall < 0) continue;
    const y = Math.round(top + (fall % span));
    const sway = Math.sin(t * (1.3 + hash2(i, 3, seed)) + i) * 5;
    const x = Math.round(x0 + hash2(i, 4, seed) * width + sway);
    const col = PAPERS[i % PAPERS.length];
    const lo = shade(col, -0.25);
    const turn = (flutter + i) % 4;
    if (turn === 0) {
      s.rect(x, y, 4, 3, col);
      s.hline(x + 1, y + 1, 2, lo);
    } else if (turn === 1) s.rect(x, y, 3, 2, col);
    else if (turn === 2) s.hline(x, y + 1, 4, lo);
    else {
      s.hline(x + 1, y, 3, col);
      s.hline(x, y + 1, 3, lo);
    }
  }
  // caps and bowlers thrown up from the crowd, each on its own arc, then falling
  const caps = Math.max(2, Math.round(width / 120));
  for (let i = 0; i < caps; i++) {
    const period = 3.2 + hash2(i, 20, seed) * 1.6;
    const u = ((t + hash2(i, 21, seed) * period) % period) / period;
    const x = Math.round(x0 + hash2(i, 22, seed) * width + (u - 0.5) * 30);
    // up out of the near crowd and back down into it
    const yy = Math.round(
      bottom + 30 - Math.sin(u * Math.PI) * (bottom - top) * 0.85,
    );
    const bowler = (i & 1) === 1;
    const spin = Math.floor(t * 6 + i) % 2;
    const dark = bowler ? P.ink : mix(P.slate, P.wood, 0.35);
    const lit = bowler ? P.slate : mix(P.steel, P.retroLight, 0.3);
    if (bowler) {
      s.hline(x + 1, yy, 3, lit);
      s.rect(x + 1, yy + 1, 3, 1, dark);
      s.hline(x, yy + 2, 5, dark);
    } else if (spin === 0) {
      s.hline(x, yy, 4, lit);
      s.hline(x, yy + 1, 5, dark);
      s.px(x + 4, yy + 1, P.ink);
    } else {
      s.hline(x + 1, yy, 3, lit);
      s.hline(x, yy + 1, 3, dark);
      s.px(x - 1, yy + 1, P.ink);
    }
  }
}
