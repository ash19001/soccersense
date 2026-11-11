/**
 * The career scene's effects: the builders' dust of a promotion (with a crane and girders
 * showing through it), fireworks over the stand for a goal, the trophy lift's confetti,
 * the referee's whistle, the worldie's gold burst, and soft shadows on the grass.
 *
 * Everything is a pure function of the time it is given and a seed, and allocates nothing
 * once warm (the shadow cache fills once per light).
 */

import { P } from "~/art/palette";
import {
  TRANSPARENT,
  clamp,
  easeInOutCubic,
  hash2,
  shade,
  sprite,
  drawSprite,
  type Color,
  type Surface,
} from "~/pixel";

// ---------------------------------------------------------------------------
// Shadows: whatever is on the grass under him, a step darker
// ---------------------------------------------------------------------------

const darks = new Map<Color, Color>();

function darkOf(c: Color): Color {
  let d = darks.get(c);
  if (d === undefined) {
    if (darks.size > 1024) darks.clear();
    d = shade(c, -0.3);
    darks.set(c, d);
  }
  return d;
}

/** A 1 px shadow row from x0 to x1 (inclusive) on row y, darkening what is there. */
export function shadowRow(s: Surface, x0: number, x1: number, y: number): void {
  const yy = Math.round(y);
  if (yy < 0 || yy >= s.h) return;
  const a = Math.max(0, Math.round(x0));
  const b = Math.min(s.w - 1, Math.round(x1));
  for (let x = a; x <= b; x++) {
    const c = s.get(x, yy);
    if (c !== TRANSPARENT) s.px(x, yy, darkOf(c));
  }
}

// ---------------------------------------------------------------------------
// Promotion: the ground is built around him
// ---------------------------------------------------------------------------

/** The beats of a promotion, in seconds from its start. */
export const BUILD = {
  /** The dust sweeps in from the left. */
  sweep: 0.5,
  /** Under full cover: the new tier goes in. */
  swap: 0.7,
  /** The dust starts to clear. */
  clear0: 0.85,
  /** It has gone. */
  clear1: 1.35,
  /** The new stands land: a thud and a ripple of new crowd. */
  thud: 1.12,
  /** The crane and girders show through it between these. */
  steel0: 0.22,
  steel1: 1.0,
} as const;

export interface BuildArea {
  /** The rows the dust covers: from above the new stands to just below the cast's feet. */
  top: number;
  bottom: number;
  w: number;
  cx: number;
  /** The stage's scale (positions written for the 130 px stage). */
  k: number;
}

export interface BuildColors {
  hi: Color;
  base: Color;
  shade: Color;
  deep: Color;
  crane: Color;
  craneDark: Color;
  steel: Color;
  steelDark: Color;
  cable: Color;
}

export function buildColors(grade: (c: Color) => Color): BuildColors {
  return {
    hi: grade(P.white),
    base: grade(P.chalk),
    shade: grade(P.concreteLight),
    deep: grade(P.concrete),
    crane: grade(P.gold),
    craneDark: grade(P.goldDark),
    steel: grade(P.steel),
    steelDark: grade(P.slate),
    cable: grade(P.concreteDark),
  };
}

/**
 * The builders' dust at `t` seconds into a promotion. A wall of dust sweeps in from the
 * left, a crane's arm swings over it and girders stand in it, then it thins away to the
 * right in clumps, leaving the new ground.
 */
export function drawBuild(
  s: Surface,
  t: number,
  a: BuildArea,
  c: BuildColors,
  seed: number,
): void {
  if (!(t >= 0) || t >= BUILD.clear1) return;
  const { top, bottom, w } = a;
  const front =
    t < BUILD.sweep
      ? Math.round(-30 + (w + 60) * easeInOutCubic(t / BUILD.sweep))
      : w + 30;
  const clear = clamp((t - BUILD.clear0) / (BUILD.clear1 - BUILD.clear0));
  const drift = Math.round(clear * clear * 14);
  const sink = Math.round(clear * 4);

  // the body of the dust: solid while it is thick
  const bodyTop = top + 7;
  const bodyBottom = bottom - 5;
  const solid = 1 - clear * 3;
  if (solid > 0 && front > 0) {
    if (solid >= 1) s.rect(0, bodyTop, front, bodyBottom - bodyTop, c.base);
    else s.dither(0, bodyTop, front, bodyBottom - bodyTop, c.base, solid);
  }

  // puffs along the top, the bottom and the leading edge, and clumps inside
  const step = 9;
  for (let col = -1; col * step < w + step; col++) {
    const x = col * step + Math.round(hash2(col, 1, seed) * 5) + drift;
    if (x - 12 > front) break;
    // top edge: billows lit from the top left
    if (!gone(col, 11, seed, clear)) {
      const r = 6 + Math.round(hash2(col, 2, seed) * 3);
      const y = top + 6 + Math.round(hash2(col, 3, seed) * 3) + sink;
      s.disc(x, y, r, c.base);
      s.disc(x - 2, y - 2, r - 3, c.hi);
    }
    // bottom edge: rolling along the grass, darker underneath
    if (!gone(col, 12, seed, clear)) {
      const r = 5 + Math.round(hash2(col, 4, seed) * 3);
      const y = bottom - 5 + Math.round(hash2(col, 5, seed) * 2);
      s.disc(x, y + 1, r, c.shade);
      s.disc(x - 1, y - 1, r - 1, c.base);
    }
    // billows inside (every other one while it is thick), clumps once it breaks up
    for (let row = 1; bodyTop + row * 10 < bodyBottom; row++) {
      if (clear === 0 && ((col + row) & 1) === 1) continue;
      if (gone(col, 20 + row, seed, clear)) continue;
      {
        const r = 5 + Math.round(hash2(col, 30 + row, seed) * 3);
        const y =
          bodyTop +
          row * 10 -
          3 +
          Math.round(hash2(col, 40 + row, seed) * 4) +
          sink;
        s.disc(x + 1, y + 1, r, c.shade);
        s.disc(x, y, r - 1, c.base);
        s.disc(x - 2, y - 2, Math.max(0, r - 4), c.hi);
      }
    }
  }
  // the leading edge, rolling over itself
  if (t < BUILD.sweep + 0.05) {
    for (let y = top + 4, i = 0; y < bottom; y += 8, i++) {
      const r = 7 + Math.round(hash2(i, 50, seed) * 3);
      const x = front - 4 + Math.round(hash2(i, 51, seed) * 4);
      s.disc(x, y, r, c.base);
      s.disc(x - 2, y - 2, r - 3, c.hi);
      s.disc(x + 3, y + 3, r - 4, c.shade);
    }
  }

  // steel in the dust: girders standing and a crane swinging a beam over
  if (t >= BUILD.steel0 && t < BUILD.steel1 && clear < 0.3) {
    drawSteel(s, t, a, c, front);
    // the dust drifts across in front of the steel
    s.pushClip(0, bodyTop, Math.max(0, front), bodyBottom - bodyTop);
    for (let i = 0; i < 18; i++) {
      const x = (Math.round(hash2(i, 60, seed) * w + t * 30) % (w + 20)) - 10;
      const y =
        bodyTop + Math.round(hash2(i, 61, seed) * (bodyBottom - bodyTop));
      s.disc(x, y, 4 + Math.round(hash2(i, 62, seed) * 3), c.base, 0.5);
    }
    s.popClip();
  }

  // texture: a few lighter swirls and darker hollows in the body
  if (solid > 0.5) {
    for (let i = 0; i < 26; i++) {
      const x = Math.round(hash2(i, 70, seed) * w + t * 12) % w;
      if (x > front - 6) continue;
      const y =
        bodyTop +
        3 +
        Math.round(hash2(i, 71, seed) * (bodyBottom - bodyTop - 6));
      if (i % 3 === 0) s.disc(x, y, 2, c.shade, 0.5);
      else s.disc(x, y, 2 + (i % 2), c.hi);
    }
  }
}

/** Has this puff of the dust already cleared? */
function gone(col: number, i: number, seed: number, clear: number): boolean {
  return hash2(col, i, seed) * 0.9 < clear;
}

function drawSteel(
  s: Surface,
  t: number,
  a: BuildArea,
  c: BuildColors,
  front: number,
): void {
  const { top, bottom, cx, k } = a;
  const sx = (off: number): number => cx + Math.round(off * k);
  s.pushClip(0, 0, Math.max(0, front), s.h);
  // two girders, a lattice each, joined at the top
  const gTop = top + 8;
  const gBottom = bottom - 8;
  const g1 = sx(-46);
  const g2 = sx(-12);
  lattice(s, g1, gTop, gBottom, c.steel, c.steelDark);
  lattice(s, g2, gTop, gBottom, c.steel, c.steelDark);
  s.rect(g1, gTop - 2, g2 - g1 + 3, 2, c.steel);
  s.hline(g1, gTop, g2 - g1 + 3, c.steelDark);

  // the crane: a mast behind the goal end, its arm reaching over the stand
  const mx = sx(30);
  const jibY = Math.max(2, top - 12);
  lattice(s, mx, jibY, gBottom, c.crane, c.craneDark);
  const reach = Math.round(76 * k);
  // the arm swings a little: seen side on, a swing shortens it
  const swing = Math.round(Math.sin(t * 2.2) * 6 * k);
  const tip = mx - reach + swing;
  s.rect(tip, jibY, mx - tip + 3, 2, c.crane);
  for (let x = tip + 1; x < mx; x += 3) s.px(x, jibY + 2, c.craneDark);
  s.line(tip, jibY + 2, mx, jibY + 2, c.craneDark);
  // the counter-jib and its weight
  const back = Math.round(16 * k);
  s.rect(mx + 3, jibY, back, 2, c.crane);
  s.rect(mx + back - 2, jibY + 2, 5, 4, c.cable);
  // the cab and the peak, with stays down to both ends
  s.rect(mx - 1, jibY + 2, 5, 3, c.craneDark);
  s.vline(mx + 1, jibY - 6, 6, c.crane);
  s.line(mx + 1, jibY - 6, tip + 2, jibY, c.cable);
  s.line(mx + 1, jibY - 6, mx + back, jibY, c.cable);
  // the trolley, the cable and a beam coming down on it
  const trolley = mx - Math.round(reach * 0.62) + Math.round(swing * 0.6);
  const lower = clamp((t - BUILD.steel0) / (BUILD.swap - BUILD.steel0));
  const beamY = Math.round(jibY + 8 + lower * (gTop - jibY - 14));
  s.rect(trolley - 1, jibY + 2, 3, 1, c.cable);
  s.vline(trolley, jibY + 3, beamY - jibY - 3, c.cable);
  s.line(trolley, beamY - 3, trolley - 5, beamY, c.cable);
  s.line(trolley, beamY - 3, trolley + 5, beamY, c.cable);
  const bw = Math.round(22 * k);
  s.rect(trolley - (bw >> 1), beamY, bw, 1, c.steel);
  s.rect(trolley - (bw >> 1), beamY + 1, bw, 1, c.steelDark);
  s.rect(trolley - (bw >> 1), beamY + 2, bw, 1, c.steel);
  s.popClip();
}

/** A 3 px lattice column: two rails and a zigzag between them. */
function lattice(
  s: Surface,
  x: number,
  y0: number,
  y1: number,
  c: Color,
  d: Color,
): void {
  if (y1 <= y0) return;
  s.vline(x, y0, y1 - y0, c);
  s.vline(x + 2, y0, y1 - y0, d);
  // the zigzag: a step across every other row, light and dark by turns
  for (let y = y0; y < y1; y += 2) s.px(x + 1, y, ((y - y0) & 2) === 0 ? d : c);
}

// ---------------------------------------------------------------------------
// Fireworks over the stand for a goal (tiers 4 to 7)
// ---------------------------------------------------------------------------

const BURST: Color[] = [
  P.gold,
  P.goldLight,
  P.chalk,
  P.homeLight,
  P.awayLight,
  P.ledGreen,
];

/**
 * `n` small fireworks going up from the roof (`roofY`) and bursting over it, staggered,
 * `age` seconds after the goal. `big` for a worldie: higher, wider, more of them.
 */
export function drawGoalFireworks(
  s: Surface,
  age: number,
  n: number,
  big: boolean,
  x0: number,
  x1: number,
  roofY: number,
  seed: number,
  modeColor: Color,
): void {
  if (!(age >= 0)) return;
  BURST[3] = modeColor;
  const tt = Math.floor(age * 15) / 15;
  const RISE = 0.3;
  const LIFE = 1.1;
  for (let i = 0; i < n; i++) {
    const start = i * (big ? 0.16 : 0.22) + hash2(i, 1, seed) * 0.08;
    const a = tt - start;
    if (a < 0 || a >= RISE + LIFE) continue;
    const bx = Math.round(
      x0 + ((i * 0.618 + hash2(i, 2, seed) * 0.3) % 1) * (x1 - x0),
    );
    const high = big ? 22 : 14;
    const by = Math.max(4, Math.round(roofY - 6 - hash2(i, 3, seed) * high));
    const col =
      BURST[Math.floor(hash2(i, 4, seed) * BURST.length) % BURST.length];
    const col2 =
      BURST[Math.floor(hash2(i, 5, seed) * BURST.length) % BURST.length];
    if (a < RISE) {
      const y = Math.round(by + (1 - a / RISE) * (roofY - by + 4));
      s.px(bx, y, P.goldLight);
      s.px(bx, y + 1, P.amber);
      s.px(bx, y + 2, P.amberDim);
      continue;
    }
    const u = (a - RISE) / LIFE;
    const rMax = big ? 10 + hash2(i, 6, seed) * 4 : 5 + hash2(i, 6, seed) * 3;
    const r = 1 + Math.round(Math.sqrt(u) * rMax);
    const drop = Math.round(u * u * 5);
    const spokes = big ? 14 : 10;
    for (let k = 0; k < spokes; k++) {
      if (
        u > 0.55 &&
        hash2(i * 37 + k, Math.floor(tt * 15), seed) < (u - 0.55) * 2.4
      ) {
        continue;
      }
      const ang = (k / spokes) * Math.PI * 2 + i;
      const x = Math.round(bx + Math.cos(ang) * r);
      const y = Math.round(by + Math.sin(ang) * r * 0.9) + drop;
      s.px(x, y, k % 2 === 0 ? col : col2);
      if (u < 0.4 && r > 3) {
        s.px(
          Math.round(bx + Math.cos(ang) * (r - 2)),
          Math.round(by + Math.sin(ang) * (r - 2) * 0.9) + drop,
          col,
        );
      }
    }
    if (u < 0.12) s.px(bx, by, P.white);
  }
}

// ---------------------------------------------------------------------------
// Confetti for the trophy lift
// ---------------------------------------------------------------------------

const CONFETTI: Color[] = [
  P.gold,
  P.goldLight,
  P.chalk,
  P.home,
  P.homeLight,
  P.white,
];

/**
 * Confetti falling over `x0..x1` from `top` to `bottom`, `t` seconds after it was fired:
 * the first pieces come down from the top, then it keeps falling.
 */
export function drawConfetti(
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
  CONFETTI[3] = mode;
  CONFETTI[4] = modeLight;
  const span = Math.max(1, bottom - top);
  const width = Math.max(1, x1 - x0);
  const count = Math.round(Math.min(140, width * 0.45));
  const flutter = Math.floor(t * 6);
  for (let i = 0; i < count; i++) {
    const speed = 12 + hash2(i, 1, seed) * 16;
    const fall = t * speed - hash2(i, 2, seed) * span * 1.3;
    if (fall < 0) continue;
    const y = top + (fall % span);
    const sway = Math.sin(t * (1.5 + hash2(i, 3, seed)) + i) * 2.2;
    const x = Math.round(x0 + hash2(i, 4, seed) * width + sway);
    const c = CONFETTI[i % CONFETTI.length];
    const yy = Math.round(y);
    if ((flutter + i) % 3 === 0) {
      s.px(x, yy, c);
      s.px(x, yy + 1, c);
    } else {
      s.px(x, yy, c);
      s.px(x + 1, yy, c);
    }
  }
}

// ---------------------------------------------------------------------------
// The whistle and the gold burst
// ---------------------------------------------------------------------------

// A referee's whistle seen side on: the round chamber, the hole on top, the mouthpiece.
// k ink, w body, m shade, o the hole.
const WHISTLE = sprite(
  `
..kkkk....
.kwwwwkkkk
kwwookwwwk
kwmmmmmmmk
.kmmmkkkkk
..kkk.....
`,
  "kwmo",
);

const whistleColors: Color[] = [
  TRANSPARENT,
  TRANSPARENT,
  TRANSPARENT,
  TRANSPARENT,
];

/**
 * The whistle sign: a little chalk sign with a whistle on it, its tail pointing down at
 * (x, y) (the top of the referee's head), the blast flashing beside the whistle. `age`
 * seconds since it went. `paper` is the sign, `ink` its outline.
 */
export function drawWhistle(
  s: Surface,
  x: number,
  y: number,
  age: number,
  ink: Color,
  paper: Color,
  body: Color,
  bodyShade: Color,
): void {
  if (!(age >= 0)) return;
  whistleColors[0] = ink;
  whistleColors[1] = body;
  whistleColors[2] = bodyShade;
  whistleColors[3] = ink;
  // it pops up, then sits with a small bob while it blows
  const lift = age < 0.06 ? 2 : age < 0.12 ? 1 : 0;
  const bob = age > 0.3 && Math.floor(age * 3) % 2 === 1 ? 1 : 0;
  const W = 19;
  const H = 10;
  const x0 = x - 9;
  const y0 = y - H - 3 - lift - bob;
  // the sign, corners rounded off, and its tail
  s.rect(x0 + 1, y0 + 1, W - 2, H - 2, paper);
  s.hline(x0 + 1, y0, W - 2, ink);
  s.hline(x0 + 1, y0 + H - 1, W - 2, ink);
  s.vline(x0, y0 + 1, H - 2, ink);
  s.vline(x0 + W - 1, y0 + 1, H - 2, ink);
  s.px(x - 1, y0 + H, ink);
  s.px(x, y0 + H, paper);
  s.px(x + 1, y0 + H, ink);
  s.px(x, y0 + H + 1, ink);
  // the whistle, and the blast coming out of it to the left, on and off
  drawSprite(s, WHISTLE, 0, x0 + 7, y0 + 2, whistleColors);
  if (age < 0.4 || Math.floor(age * 6) % 2 === 0) {
    s.px(x0 + 4, y0 + 2, ink);
    s.px(x0 + 5, y0 + 3, ink);
    s.hline(x0 + 2, y0 + 5, 3, ink);
    s.px(x0 + 5, y0 + 7, ink);
    s.px(x0 + 4, y0 + 8, ink);
  }
}

/** The worldie's gold burst where the ball hits the net, `age` seconds after. */
export function drawGoldBurst(
  s: Surface,
  x: number,
  y: number,
  age: number,
): void {
  if (!(age >= 0) || age >= 0.45) return;
  const r = 2 + Math.round(age * 22);
  for (let k = 0; k < 10; k++) {
    if (age > 0.25 && (k + Math.floor(age * 20)) % 3 === 0) continue;
    const ang = (k / 10) * Math.PI * 2 + 0.3;
    const px = Math.round(x + Math.cos(ang) * r);
    const py = Math.round(y + Math.sin(ang) * r);
    s.px(px, py, k % 2 === 0 ? P.gold : P.goldLight);
    if (age < 0.2) {
      s.px(
        Math.round(x + Math.cos(ang) * (r - 2)),
        Math.round(y + Math.sin(ang) * (r - 2)),
        P.goldLight,
      );
    }
  }
  if (age < 0.08) {
    s.disc(x, y, 2, P.goldLight);
    s.px(x, y, P.white);
  }
}
