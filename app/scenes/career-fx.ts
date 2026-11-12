/**
 * The career scene's effects: the smoke of a promotion (and in it a close-up of the ball
 * at the back of the net), fireworks over the stand for a goal, the trophy lift's confetti, the
 * referee's whistle, the worldie's gold burst, the arrival's iris and soft shadows on the
 * grass.
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
  lerp,
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
// Promotion: a sweep of smoke, and in it a close-up of the ball at the back of the net
// ---------------------------------------------------------------------------

/** The beats of a promotion, in seconds from its start. */
export const BUILD = {
  /** The smoke sweeps in from the left. */
  sweep: 0.5,
  /**
   * Under full cover, the hole all but closed: the new tier goes in (the ground's rebuild is
   * a long frame, so not while the close-up is still moving).
   */
  swap: 0.8,
  /** The smoke starts to clear. */
  clear0: 0.85,
  /** It has gone. */
  clear1: 1.35,
  /** The new ground is there: a ripple of new crowd. */
  cheer: 1.12,
  /** A hole opens in the middle of the smoke onto the close-up, between these. */
  open0: 0.24,
  open1: 0.34,
  /** The ball comes in from `ball0` and hits the net at `hit` (the picture's 1 px jolt). */
  ball0: 0.27,
  hit: 0.36,
  /** The smoke rolls back over the close-up between these. */
  shut0: 0.72,
  shut1: 0.86,
} as const;

export interface BuildArea {
  /** The rows the smoke covers: from above the new stands to just below the cast's feet. */
  top: number;
  bottom: number;
  w: number;
  /** The close-up: the middle of the hole in the smoke, and its half width and height. */
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

/**
 * The close-up's hole for a canvas `w` wide whose action band runs from `actionTop` to
 * `groundY`: in the middle of the stage, as big as fits (at 480 x 270, 222 x 106; on a
 * 130 px phone, 114 x 112).
 */
export function closeUpSize(
  w: number,
  actionTop: number,
  groundY: number,
): { rx: number; ry: number; cy: number } {
  const ry = Math.round(clamp((groundY - actionTop) * 0.95, 20, 70));
  const rx = Math.round(Math.max(16, Math.min(w / 2 - 8, ry * 2.1)));
  return { rx, ry, cy: Math.round((actionTop + groundY) / 2) };
}

export interface BuildColors {
  /** The smoke, light to dark. */
  hi: Color;
  base: Color;
  shade: Color;
  deep: Color;
  /** Behind the net, out of focus: the shadow of the stand, the crowd, the pitch. */
  backTop: Color;
  backMid: Color;
  backPitch: Color;
  bokeh: Color;
  /**
   * The net: its strings (and in the shadow of the pocket round the ball), its knots, the
   * far netting, a string across leather or a patch.
   */
  net: Color;
  netShade: Color;
  knot: Color;
  netFar: Color;
  netOnBall: Color;
  netOnPatch: Color;
  /** The ball: its leather, light to dark, its patches and its outline. */
  leatherHi: Color;
  leather: Color;
  leatherShade: Color;
  leatherDeep: Color;
  patch: Color;
  patchHi: Color;
  ink: Color;
}

export function buildColors(grade: (c: Color) => Color): BuildColors {
  return {
    hi: grade(P.white),
    base: grade(P.chalk),
    shade: grade(P.concreteLight),
    deep: grade(P.concrete),
    backTop: grade(P.night),
    backMid: grade(P.slate),
    backPitch: grade(P.grassDeep),
    bokeh: grade(P.mist),
    net: grade(P.chalk),
    netShade: grade(P.concrete),
    knot: grade(P.white),
    netFar: grade(P.steel),
    netOnBall: grade(P.concrete),
    netOnPatch: grade(P.concreteLight),
    leatherHi: grade(P.white),
    leather: grade(P.chalk),
    leatherShade: grade(P.concreteLight),
    leatherDeep: grade(P.concrete),
    patch: grade(P.ink),
    patchHi: grade(P.slate),
    ink: grade(P.ink),
  };
}

/**
 * The promotion's smoke at `t` seconds. A wall of smoke sweeps in from the left with a big
 * cloud in the middle of it; a hole opens in the cloud onto a close-up of the back of a
 * goal's net, and the ball is driven into it: the net takes it in a pocket, the diamonds of
 * the mesh pulled in round it, the ball still turning. The smoke rolls back over it, then
 * thins away to the right in clumps, leaving the new ground.
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

  // the body of the smoke: solid while it is thick
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

  // the cloud in the middle, and the close-up in it
  if (front > 0) {
    s.pushClip(0, 0, front, s.h);
    drawCloud(s, t, a, c, seed, clear, solid, drift, sink);
    s.popClip();
  }

  // the leading edge, rolling over itself (and over the cloud)
  if (t < BUILD.sweep + 0.05) {
    for (
      let y = Math.min(top, a.cy - a.ry) + 4, i = 0;
      y < Math.max(bottom, a.cy + a.ry + 4);
      y += 8, i++
    ) {
      const r = 7 + Math.round(hash2(i, 50, seed) * 3);
      const x = front - 4 + Math.round(hash2(i, 51, seed) * 4);
      s.disc(x, y, r, c.base);
      s.disc(x - 2, y - 2, r - 3, c.hi);
      s.disc(x + 3, y + 3, r - 4, c.shade);
    }
  }
}

/** Has this puff of the smoke already cleared? */
function gone(col: number, i: number, seed: number, clear: number): boolean {
  return hash2(col, i, seed) * 0.9 < clear;
}

/** How open the hole onto the close-up is at `t`, 0 to 1. */
function holeAt(t: number): number {
  if (t <= BUILD.open0 || t >= BUILD.shut1) return 0;
  if (t < BUILD.open1) {
    const u = (t - BUILD.open0) / (BUILD.open1 - BUILD.open0);
    return 1 - (1 - u) * (1 - u) * (1 - u);
  }
  if (t > BUILD.shut0) {
    return 1 - easeInOutCubic((t - BUILD.shut0) / (BUILD.shut1 - BUILD.shut0));
  }
  return 1;
}

/** The cloud round the close-up: a big billowing puff in the middle of the band. */
function drawCloud(
  s: Surface,
  t: number,
  a: BuildArea,
  c: BuildColors,
  seed: number,
  clear: number,
  solid: number,
  drift: number,
  sink: number,
): void {
  const { cx, cy, rx, ry } = a;
  // how far the cloud reaches past the hole
  const m = Math.max(7, Math.round(ry * 0.2));
  const orx = rx + m;
  const ory = ry + m;
  if (solid > 0)
    s.ellipse(
      cx + drift,
      cy + sink,
      orx,
      ory,
      c.base,
      true,
      Math.min(1, solid),
    );
  const k = holeAt(t);
  // billows all through it (the open hole covers those in its middle), clumps as it clears
  for (let j = 0, row = 8 - ory; row < ory - 5; j++, row += 14) {
    const half = orx * Math.sqrt(Math.max(0, 1 - (row / ory) ** 2)) - 8;
    for (let i = 0, col = (j & 1) * 7 - half; col < half; i++, col += 14) {
      const id = i * 31 + j;
      if (gone(id, 83, seed, clear)) continue;
      const hx = k > 0 ? col / (rx * k) : 9;
      const hy = k > 0 ? row / (ry * k) : 9;
      if (hx * hx + hy * hy < 0.6) continue;
      const r = Math.round(7 + hash2(id, 84, seed) * 4);
      const x = Math.round(cx + col + hash2(id, 85, seed) * 4) + drift;
      const y = Math.round(cy + row + hash2(id, 86, seed) * 4) + sink;
      s.disc(x + 1, y + 1, r, c.shade);
      s.disc(x, y, r - 1, c.base);
      s.disc(x - 2, y - 2, Math.max(0, r - 4), c.hi);
    }
  }
  const n = Math.max(12, Math.round((orx + ory) * 0.3));
  for (let i = 0; i < n; i++) {
    if (gone(i, 80, seed, clear)) continue;
    const ang = ((i + hash2(i, 81, seed) * 0.4) / n) * Math.PI * 2;
    // shrinking away as the smoke clears
    const r = Math.round(
      (m * 0.75 + hash2(i, 82, seed) * m * 0.5) * (1 - clear * 0.3),
    );
    const x = Math.round(cx + Math.cos(ang) * (orx - r * 0.4)) + drift;
    const y = Math.round(cy + Math.sin(ang) * (ory - r * 0.4)) + sink;
    s.disc(x + 1, y + 1, r, c.shade);
    s.disc(x, y, r - 1, c.base);
    s.disc(x - 2, y - 2, Math.max(0, r - 4), c.hi);
  }
  if (k > 0) drawCloseUp(s, t, a, c, seed, k, m);
}

// The hole onto the close-up, for the pixel tests below (`hole` sets it).
let holeX = 0;
let holeY = 0;
let holeIX = 0;
let holeIY = 0;

function hole(cx: number, cy: number, rx: number, ry: number): void {
  holeX = cx;
  holeY = cy;
  holeIX = 1 / Math.max(0.5, rx * rx);
  holeIY = 1 / Math.max(0.5, ry * ry);
}

function inHole(x: number, y: number): boolean {
  const dx = x - holeX;
  const dy = y - holeY;
  return dx * dx * holeIX + dy * dy * holeIY <= 1;
}

/**
 * The close-up, `k` open: behind the net the ground out of focus and the far netting; the
 * ball, coming in at us out of the goal and then held in the net; the back of the net in
 * front of it, a diamond mesh pulled into a pocket round it; the smoke's billows round the
 * hole, and a wisp or two drifting across.
 */
function drawCloseUp(
  s: Surface,
  t: number,
  a: BuildArea,
  c: BuildColors,
  seed: number,
  k: number,
  m: number,
): void {
  const { cx, cy, rx, ry } = a;
  const hrx = rx * k;
  const hry = ry * k;
  hole(cx, cy, hrx, hry);

  // behind the net: the stand's shadow, the crowd, the pitch, all out of focus
  const y0 = Math.ceil(cy - hry);
  const y1 = Math.floor(cy + hry);
  const bandA = cy - ry + ry * 0.62;
  const bandB = cy - ry + ry * 1.18;
  for (let y = y0; y <= y1; y++) {
    const dy = (y - cy) / Math.max(0.5, hry);
    const half = hrx * Math.sqrt(Math.max(0, 1 - dy * dy));
    const xa = Math.ceil(cx - half);
    const len = Math.floor(cx + half) - xa + 1;
    if (len <= 0) continue;
    backRow(s, xa, y, len, y - bandA, c.backTop, c.backMid);
    if (y > bandB - 3)
      backRow(s, xa, y, len, y - bandB, c.backMid, c.backPitch, true);
  }
  // the lights of the stand, out of focus: soft discs
  for (let i = 0; i < 7; i++) {
    const x = Math.round(
      cx - rx + ((i + 0.3 + hash2(i, 96, seed) * 0.5) / 7) * 2 * rx,
    );
    const y = Math.round(cy - ry * (0.45 - hash2(i, 97, seed) * 0.35));
    const r = Math.round(ry * (0.06 + hash2(i, 98, seed) * 0.05));
    if (!inHole(x, y)) continue;
    s.disc(x, y, r, c.bokeh, 0.25);
    s.disc(x, y, Math.max(1, r - 2), c.bokeh, 0.5);
  }

  // the far netting, out of focus: a dotted mesh twice the size
  const R = Math.max(5, Math.round(Math.min(ry * 0.48, rx * 0.36)));
  const gx = Math.max(3, Math.round(R * 0.3));
  const gy = Math.max(3, Math.round(R * 0.36));
  meshLattice(s, cx + gx, cy + gy, rx, ry, gx * 2, gy * 2, c, true);

  // the ball: in at us out of the goal, then held by the net, still turning
  const restX = cx + Math.round(rx * 0.2);
  const restY = cy - Math.round(ry * 0.06);
  const u = t - BUILD.hit;
  let bx = restX;
  let by = restY;
  let br = R;
  let press = 0;
  let turn = 0;
  if (u < 0) {
    const v = (t - BUILD.ball0) / (BUILD.hit - BUILD.ball0);
    if (v > 0) {
      bx = Math.round(lerp(cx - rx - R, restX, v));
      by = Math.round(lerp(restY + R * 0.7, restY, v));
      br = Math.max(2, Math.round(R / (1 + 1.2 * (1 - v))));
      turn = t * 16;
      // the rush of it: streaks behind
      for (let j = -1; j <= 1; j++) {
        const yy = by + Math.round(j * br * 0.55);
        const tail = Math.round(R * (1.4 - 0.4 * Math.abs(j)));
        streak(s, bx - br - 2 - tail, yy, tail, c.hi);
      }
    } else {
      br = 0;
    }
  } else {
    // the net takes it: out past where it settles, back, and held there
    press = 0.85 * (1 - Math.exp(-7 * u) * Math.cos(18 * u));
    bx = restX + Math.round(press * 3);
    turn = BUILD.hit * 16 + (16 * (1 - Math.exp(-3 * u))) / 3;
  }
  if (br > 0) bigBall(s, bx, by, br, turn, 0.5 + turn * 0.12, c);

  // the back of the net in front of it: a diamond mesh, pulled into a pocket round it
  pocket.bx = bx;
  pocket.by = by;
  pocket.r = br;
  pocket.b = br > 0 ? press : 0;
  meshLattice(s, cx, cy, rx, ry, gx, gy, c, false);

  // the smoke round the hole, drifting slowly round it
  const n = Math.max(8, Math.round((hrx + hry) * 0.17));
  for (let i = 0; i < n; i++) {
    const ang = ((i + hash2(i, 90, seed) * 0.6) / n) * Math.PI * 2 + t * 0.2;
    // shrinking with the hole as it closes
    const r = Math.round(
      m * (0.6 + hash2(i, 91, seed) * 0.7) * (0.4 + 0.6 * k),
    );
    const out = r * (0.25 + hash2(i, 95, seed) * 0.35);
    const x = Math.round(cx + Math.cos(ang) * (hrx + out));
    const y = Math.round(cy + Math.sin(ang) * (hry + out));
    s.disc(x + 1, y + 1, r, c.shade);
    s.disc(x, y, r - 1, c.base);
    s.disc(x - 2, y - 2, Math.max(0, r - 4), c.hi);
  }
}

/**
 * One row of the out-of-focus ground: `above` until `d` rows before the change, `below`
 * after it, dithered over the six rows between. With `under`, only the part past the
 * change is painted (the first colour is already there).
 */
function backRow(
  s: Surface,
  x: number,
  y: number,
  len: number,
  d: number,
  above: Color,
  below: Color,
  under = false,
): void {
  if (d < -3) {
    if (!under) s.hline(x, y, len, above);
    return;
  }
  if (d >= 3) {
    s.hline(x, y, len, below);
    return;
  }
  if (!under) s.hline(x, y, len, above);
  s.dither(x, y, len, 1, below, (d + 3.5) / 7);
}

/** A streak of air behind the ball, `len` long, ending at x + len, inside the hole. */
function streak(
  s: Surface,
  x: number,
  y: number,
  len: number,
  col: Color,
): void {
  for (let i = 0; i < len; i++) {
    // broken towards the tail
    if (i < len / 3 && (i & 1) === 0) continue;
    if (inHole(x + i, y)) s.px(x + i, y, col);
  }
}

// ---------------------------------------------------------------------------
// The net's mesh, and the pocket the ball pulls it into
// ---------------------------------------------------------------------------

/** The ball in the net: its middle and radius, and how hard it presses (0 none, ~1 full). */
const pocket = { bx: 0, by: 0, r: 0, b: 0 };
/** A point of the mesh where the pocket has pulled it (`warp` writes it here). */
const warped = { x: 0, y: 0 };

/**
 * Where the pocket pulls the mesh point (x, y). Out to a ring a third bigger than the ball,
 * the mesh is wrapped over the ball's front (closer together towards its rim); past that it
 * is stretched in towards the ball, most nearest it, so the diamonds lean in round it and
 * the strings run into it. `pocket.b` blends it in from the flat net.
 */
function warp(x: number, y: number): void {
  const { bx, by, r: R, b } = pocket;
  warped.x = x;
  warped.y = y;
  if (b <= 0 || R <= 0) return;
  const dx = x - bx;
  const dy = y - by;
  const r = Math.sqrt(dx * dx + dy * dy);
  if (r < 1e-3) return;
  // over the ball: stretched across its front, wrapping round to its rim
  const a = R * 0.8;
  // the flanks of the pocket, from the rim back to the flat net: seen end on, a tight ring
  const out = R * 2;
  const ring = R * 1.25;
  let to: number;
  if (r < a) {
    to = R * 0.97 * Math.sin((r / a) * (Math.PI / 2));
  } else if (r < out) {
    to = R * 0.97 + ((ring - R * 0.97) * (r - a)) / (out - a);
  } else {
    // the flat net pulled in towards it: the diamonds long and narrow, leaning in
    to = r - (out - ring) * Math.exp(-(r - out) / (1.6 * R));
  }
  const rr = Math.max(0, r + (to - r) * b);
  warped.x = bx + (dx / r) * rr;
  warped.y = by + (dy / r) * rr;
}

/**
 * A diamond mesh over the close-up (centred on cx, cy, a node every `gx` across and `gy`
 * down, in diagonals), inside the hole. The far netting (`far`) is dotted and flat; the
 * near netting is pulled by the pocket, with a knot at each crossing.
 */
function meshLattice(
  s: Surface,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  gx: number,
  gy: number,
  c: BuildColors,
  far: boolean,
): void {
  const pad = far ? 0 : pocket.r * 1.2 + 4;
  const i0 = Math.floor((-rx - pad) / gx) - 1;
  const i1 = Math.ceil((rx + pad) / gx) + 1;
  const j0 = Math.floor((-ry - pad) / gy) - 1;
  const j1 = Math.ceil((ry + pad) / gy) + 1;
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      if (((i + j) & 1) !== 0) continue;
      const x = cx + i * gx;
      const y = cy + j * gy;
      if (far) {
        dotted(s, x, y, x + gx, y + gy, c.netFar);
        dotted(s, x, y, x + gx, y - gy, c.netFar);
        continue;
      }
      warp(x, y);
      const px = warped.x;
      const py = warped.y;
      warp(x + gx, y + gy);
      netLine(s, px, py, warped.x, warped.y, c);
      warp(x + gx, y - gy);
      netLine(s, px, py, warped.x, warped.y, c);
    }
  }
  if (far) return;
  // the knots, over the strings
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      if (((i + j) & 1) !== 0) continue;
      warp(cx + i * gx, cy + j * gy);
      const x = Math.round(warped.x);
      const y = Math.round(warped.y);
      if (!inHole(x, y) || onBall(x, y)) continue;
      s.px(x, y, c.knot);
    }
  }
}

/** In the shadow of the pocket's flanks: just round the ball, once it presses. */
function inFlank(x: number, y: number): boolean {
  const R = pocket.r;
  if (R <= 0 || pocket.b < 0.3) return false;
  const ox = x - pocket.bx;
  const oy = y - pocket.by;
  const d = R * 1.32;
  return ox * ox + oy * oy <= d * d;
}

function onBall(x: number, y: number): boolean {
  const R = pocket.r;
  if (R <= 0) return false;
  const ox = x - pocket.bx;
  const oy = y - pocket.by;
  return ox * ox + oy * oy <= R * R + R;
}

/** A string of the near netting: across the ball it shows grey on leather, pale on a patch. */
function netLine(
  s: Surface,
  ax: number,
  ay: number,
  ex: number,
  ey: number,
  c: BuildColors,
): void {
  let x = Math.round(ax);
  let y = Math.round(ay);
  const x1 = Math.round(ex);
  const y1 = Math.round(ey);
  const dx = Math.abs(x1 - x);
  const dy = -Math.abs(y1 - y);
  const sx = x < x1 ? 1 : -1;
  const sy = y < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    if (inHole(x, y)) {
      if (onBall(x, y)) {
        const under = s.get(x, y);
        s.px(
          x,
          y,
          under === c.patch || under === c.patchHi ? c.netOnPatch : c.netOnBall,
        );
      } else {
        s.px(x, y, inFlank(x, y) ? c.netShade : c.net);
      }
    }
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

/** A string of the far netting, every other pixel, inside the hole. */
function dotted(
  s: Surface,
  ax: number,
  ay: number,
  ex: number,
  ey: number,
  col: Color,
): void {
  let x = Math.round(ax);
  let y = Math.round(ay);
  const x1 = Math.round(ex);
  const y1 = Math.round(ey);
  const dx = Math.abs(x1 - x);
  const dy = -Math.abs(y1 - y);
  const sx = x < x1 ? 1 : -1;
  const sy = y < y1 ? 1 : -1;
  let err = dx + dy;
  for (let n = 0; ; n++) {
    if ((n & 1) === 0 && inHole(x, y)) s.px(x, y, col);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

// ---------------------------------------------------------------------------
// The ball, close up: a truncated icosahedron, black pentagons and their seams
// ---------------------------------------------------------------------------

/**
 * The ball's twelve pentagons: each one's middle (an icosahedron's corner, on the unit
 * sphere), its five corners in order round it (a third of the way along each edge to its
 * five neighbours) and which neighbour each corner leans towards.
 */
const BALL = (() => {
  const g = (1 + Math.sqrt(5)) / 2;
  const raw = [
    [0, 1, g],
    [0, -1, g],
    [0, 1, -g],
    [0, -1, -g],
    [1, g, 0],
    [-1, g, 0],
    [1, -g, 0],
    [-1, -g, 0],
    [g, 0, 1],
    [-g, 0, 1],
    [g, 0, -1],
    [-g, 0, -1],
  ];
  const n = Math.sqrt(1 + g * g);
  const v = raw.map((p) => [p[0] / n, p[1] / n, p[2] / n]);
  const dot = (a: number[], b: number[]): number =>
    a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const centres = new Float32Array(36);
  const corners = new Float32Array(180);
  const toward = new Int8Array(60);
  for (let i = 0; i < 12; i++) {
    const vi = v[i];
    for (let d = 0; d < 3; d++) centres[i * 3 + d] = vi[d];
    const near: number[] = [];
    for (let j = 0; j < 12; j++)
      if (j !== i && dot(vi, v[j]) > 0.4) near.push(j);
    // round the pentagon in order: by angle in the plane that touches the sphere there
    const n0 = v[near[0]];
    const d0 = dot(vi, n0);
    const e1 = [n0[0] - vi[0] * d0, n0[1] - vi[1] * d0, n0[2] - vi[2] * d0];
    const l1 = Math.sqrt(dot(e1, e1));
    for (let d = 0; d < 3; d++) e1[d] /= l1;
    const e2 = [
      vi[1] * e1[2] - vi[2] * e1[1],
      vi[2] * e1[0] - vi[0] * e1[2],
      vi[0] * e1[1] - vi[1] * e1[0],
    ];
    near.sort(
      (a, b) =>
        Math.atan2(dot(v[a], e2), dot(v[a], e1)) -
        Math.atan2(dot(v[b], e2), dot(v[b], e1)),
    );
    for (let q = 0; q < 5; q++) {
      const vj = v[near[q]];
      const p = [0, 1, 2].map((d) => (2 * vi[d] + vj[d]) / 3);
      const l = Math.sqrt(dot(p, p));
      for (let d = 0; d < 3; d++) corners[(i * 5 + q) * 3 + d] = p[d] / l;
      toward[i * 5 + q] = near[q];
    }
  }
  return { centres, corners, toward };
})();

/** The ball's points turned for this frame: x, y across the screen, z towards us. */
const turnedCentres = new Float32Array(36);
const turnedCorners = new Float32Array(180);
/** A pentagon on the screen, for its fill. */
const penX = new Float64Array(5);
const penY = new Float64Array(5);
const cross = new Float64Array(6);

/** The light on the ball: from the top left and in front. */
const LX = -0.45;
const LY = -0.58;
const LZ = 0.68;

function turn(
  src: Float32Array,
  dst: Float32Array,
  count: number,
  yaw: number,
  pitch: number,
): void {
  const cyw = Math.cos(yaw);
  const syw = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  for (let i = 0; i < count; i++) {
    const vx = src[i * 3];
    const vy = src[i * 3 + 1];
    const vz = src[i * 3 + 2];
    const x1 = vx * cyw + vz * syw;
    const z1 = vz * cyw - vx * syw;
    dst[i * 3] = x1;
    dst[i * 3 + 1] = vy * cp - z1 * sp;
    dst[i * 3 + 2] = vy * sp + z1 * cp;
  }
}

/** How lit the ball is at (x, y) from its middle, radius r: -1 to 1. */
function lit(x: number, y: number, r: number): number {
  const nx = x / r;
  const ny = y / r;
  const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
  return nx * LX + ny * LY + nz * LZ;
}

/**
 * A football of radius `r` on (cx, cy), close up, turned `yaw` about the upright and
 * `pitch` about the level: leather in four tones lit from the top left, an ink outline,
 * its black pentagons (shining where the light catches them) and the seams between the
 * white hexagons. Only what is inside the hole is painted.
 */
function bigBall(
  s: Surface,
  cx: number,
  cy: number,
  r: number,
  yaw: number,
  pitch: number,
  c: BuildColors,
): void {
  const lim = r * r + r;
  const rim = (r - 1) * (r - 1) + (r - 1);
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      const d = x * x + y * y;
      if (d > lim || !inHole(cx + x, cy + y)) continue;
      let col = c.ink;
      if (d <= rim) {
        const l = lit(x, y, r);
        col =
          l > 0.72
            ? c.leatherHi
            : l > 0.3
              ? c.leather
              : l > 0.02
                ? c.leatherShade
                : c.leatherDeep;
      }
      s.px(cx + x, cy + y, col);
    }
  }
  if (r < 4) return;
  turn(BALL.centres, turnedCentres, 12, yaw, pitch);
  turn(BALL.corners, turnedCorners, 60, yaw, pitch);
  const k = r - 0.5;
  // the seams between the hexagons: from a pentagon's corner to its neighbour's facing one
  for (let i = 0; i < 12; i++) {
    for (let q = 0; q < 5; q++) {
      const j = BALL.toward[i * 5 + q];
      if (j < i) continue;
      let back = 0;
      while (back < 5 && BALL.toward[j * 5 + back] !== i) back++;
      const a = (i * 5 + q) * 3;
      const b = (j * 5 + back) * 3;
      if (turnedCorners[a + 2] < 0.1 || turnedCorners[b + 2] < 0.1) continue;
      seam(
        s,
        cx + turnedCorners[a] * k,
        cy + turnedCorners[a + 1] * k,
        cx + turnedCorners[b] * k,
        cy + turnedCorners[b + 1] * k,
        cx,
        cy,
        rim,
        c,
      );
    }
  }
  // the pentagons that face us (those near the rim pushed out onto it)
  for (let i = 0; i < 12; i++) {
    if (turnedCentres[i * 3 + 2] < -0.3) continue;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let q = 0; q < 5; q++) {
      const o = (i * 5 + q) * 3;
      let x = turnedCorners[o];
      let y = turnedCorners[o + 1];
      if (turnedCorners[o + 2] < 0) {
        const l = Math.sqrt(x * x + y * y) || 1;
        x /= l;
        y /= l;
      }
      penX[q] = cx + x * k;
      penY[q] = cy + y * k;
      if (penY[q] < minY) minY = penY[q];
      if (penY[q] > maxY) maxY = penY[q];
    }
    for (let y = Math.ceil(minY - 0.5); y <= Math.floor(maxY + 0.5); y++) {
      let n = 0;
      for (let q = 0; q < 5; q++) {
        const ax = penX[q];
        const ay = penY[q];
        const bx = penX[(q + 1) % 5];
        const by = penY[(q + 1) % 5];
        if ((ay <= y && by > y) || (by <= y && ay > y)) {
          cross[n++] = ax + ((y - ay) * (bx - ax)) / (by - ay);
        }
      }
      if (n < 2) continue;
      let lo = cross[0];
      let hi = cross[0];
      for (let q = 1; q < n; q++) {
        if (cross[q] < lo) lo = cross[q];
        if (cross[q] > hi) hi = cross[q];
      }
      for (let x = Math.round(lo); x <= Math.round(hi); x++) {
        const ox = x - cx;
        const oy = y - cy;
        if (ox * ox + oy * oy > rim || !inHole(x, y)) continue;
        s.px(x, y, lit(ox, oy, r) > 0.78 ? c.patchHi : c.patch);
      }
    }
  }
}

/** A seam across the white leather: a tone darker than the leather under it. */
function seam(
  s: Surface,
  ax: number,
  ay: number,
  ex: number,
  ey: number,
  cx: number,
  cy: number,
  rim: number,
  c: BuildColors,
): void {
  let x = Math.round(ax);
  let y = Math.round(ay);
  const x1 = Math.round(ex);
  const y1 = Math.round(ey);
  const dx = Math.abs(x1 - x);
  const dy = -Math.abs(y1 - y);
  const sx = x < x1 ? 1 : -1;
  const sy = y < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    const ox = x - cx;
    const oy = y - cy;
    if (ox * ox + oy * oy <= rim && inHole(x, y)) {
      const under = s.get(x, y);
      if (under === c.leatherHi || under === c.leather)
        s.px(x, y, c.leatherShade);
      else if (under === c.leatherShade) s.px(x, y, c.leatherDeep);
    }
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
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

/** When the `i`th of a goal's fireworks goes up, in seconds after the goal (`size` 0 to 1). */
export function fireworkStart(i: number, size: number, seed: number): number {
  const z = clamp(Number(size) || 0);
  return i * (0.22 - 0.06 * z) + hash2(i, 1, seed) * 0.08;
}

/**
 * `n` small fireworks going up from the roof (`roofY`) and bursting over it, staggered,
 * `age` seconds after the goal. `size` from 0 (a tap in's) to 1 (a worldie's): the
 * bigger, the higher they go, the wider they burst and the closer they follow each other.
 */
export function drawGoalFireworks(
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
  if (!(age >= 0)) return;
  BURST[3] = modeColor;
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
    const high = 14 + 8 * z;
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
    const rMax = 5 + 5 * z + hash2(i, 6, seed) * (3 + z);
    const r = 1 + Math.round(Math.sqrt(u) * rMax);
    const drop = Math.round(u * u * 5);
    const spokes = 10 + Math.round(4 * z);
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

// ---------------------------------------------------------------------------
// The arrival's iris
// ---------------------------------------------------------------------------

/**
 * The iris: everything further than `r` from (cx, cy) becomes `ink`; a negative `r` inks
 * the whole surface. The same clean pixel circle as the home screen's closing iris
 * (inside when dx² + dy² <= r² + r), so the page opens the way the home screen shut.
 * Pass a whole-pixel radius. Allocates nothing.
 */
export function drawIris(
  s: Surface,
  cx: number,
  cy: number,
  r: number,
  ink: Color,
): void {
  const { w, h, data } = s;
  if (!(r >= 0)) {
    data.fill(ink);
    return;
  }
  const limit = r * r + r;
  for (let y = 0; y < h; y++) {
    const dy = y - cy;
    const row = y * w;
    const room = limit - dy * dy;
    if (room < 0) {
      data.fill(ink, row, row + w);
      continue;
    }
    const half = Math.floor(Math.sqrt(room));
    const x0 = cx - half;
    const x1 = cx + half + 1;
    if (x0 > 0) data.fill(ink, row, row + Math.min(w, x0));
    if (x1 < w) data.fill(ink, row + Math.max(0, x1), row + w);
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
