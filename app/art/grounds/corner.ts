/**
 * The corner stand at an international (tiers 5 to 7): where the side stand stops at the
 * corner and the end (end.ts) runs towards us behind the goal, the seats sweep round from
 * one to the other like a bowl's, instead of leaving a gap to the town (the product owner,
 * 2026-11-15: "make seatings in the corners as well when it wraps around rather than just a
 * gap", then "make it look like it curves around instead").
 *
 * Each row of the corner, `hu` stand pixels up the end's profile (`END_PROFILE`), leaves
 * the side stand level, on the same part of the side stand (`SIDE`: its boards, tiers,
 * walkway and roof), and bends round into the same row of the end, running on in the end's
 * direction. It is a quadratic curve from the side stand's end `A`, about the point `I`
 * where the side's row and the end's would cross, to the point `B` on the end's row where
 * the end now starts (`cornerStart`; the end's far end is gone, taken into the bend):
 *
 *   P(t) = (1 - t)² A + 2 t (1 - t) I + t² B.
 *
 * `B` is `REACH` as far from `I` as `A` is, on screen: the end's rows run towards us, so a
 * bend that is round on the ground turns quickly once it faces us. It is never below the
 * far touchline (the pitch is painted after the corner): so the boards' foot keeps its
 * corner on the touchline, and the rows above it sweep round in wider and wider curves.
 *
 * Along a row the corner carries on the end's own measure `u` (`alongAt`): the boards'
 * panels, the aisles and the lamps under the roof run on round the bend, so the seam
 * between the corner and the end does not show. The fans are the end's seated fans on the
 * same rows, shoulder to shoulder on from the end's.
 */

import { P } from "~/art/palette";
import { bayer4, type Color, type Surface } from "~/pixel";
import { fanStyle, seatFan } from "./crowd";
import { cornerFilled, endFor, endTopAt, type EndGeo } from "./end";
import { END_PROFILE } from "./end-profile";
import type { Life } from "./life";
import { rnd, type Paint } from "./paint";

export { cornerFilled };

const { WALL, LOW, WALK, UP, BACK, UNDER, FASCIA, TOP, ROW, AISLE } =
  END_PROFILE;

/**
 * How far round the end a row runs before it is the end's, against how far it runs on from
 * the side stand to where the two rows would cross (both on screen).
 */
const REACH = 0.5;

/**
 * Added to the corner's `u` when it asks the end's colours: a whole number of every pattern
 * along the end's rows (aisles 83, boards' panels 26 x 5, lamps 14 and 6, the truss 8, the
 * roof's seams 21 and 12), so they run on unchanged, and never near the end's far end
 * (`u` under 1.5), which the corner has taken in.
 */
const U_OFF = 906_360;

/**
 * The same part of the side stand as `h` up the end's profile, in rows above the far
 * touchline: its boards, the lower tier, the boxes and balcony (the walkway), the upper
 * tier, the dark under the roof and the roof.
 */
const SIDE: readonly [number, number][] = [
  [0, 0],
  [WALL, 14],
  [WALK, 62],
  [UP, 78],
  [BACK, 126],
  [UNDER, 128],
  [FASCIA, 130],
  [TOP, 142],
];

function sideAt(h: number): number {
  for (let i = 1; i < SIDE.length; i++) {
    const [a, sa] = SIDE[i - 1];
    const [b, sb] = SIDE[i];
    if (h <= b) return sa + ((h - a) * (sb - sa)) / (b - a);
  }
  const [b, sb] = SIDE[SIDE.length - 1];
  return sb + (h - b);
}

/** The corner's frame at this canvas size. */
export interface CornerGeo {
  /** The side stand's last column + 1: the corner starts here. */
  x0: number;
  /** The far touchline. */
  F: number;
  e: EndGeo;
}

export function cornerFor(p: Paint): CornerGeo {
  const { g } = p;
  const e = endFor(g);
  return { x0: Math.min(g.w, e.corner), F: g.F, e };
}

/** A row of the corner, `hu` up the end's profile. */
interface Row {
  hu: number;
  /** The row it leaves the side stand on (`A` and `I`). */
  y: number;
  /** Where the side's row and the end's would cross. */
  ix: number;
  /** Where it is the end's: `B`, `ub` along the end's row. */
  bx: number;
  by: number;
  ub: number;
  /** The end's row's direction for each `u` along it, and its length on screen. */
  dx: number;
  dy: number;
  sp: number;
}

function rowOf(c: CornerGeo, hu: number): Row {
  const { e } = c;
  const side = sideAt(hu);
  const y = c.F - side;
  // the end's row `hu` up is a straight line (end.ts): X = xA + m u + lean hu (1 + grow u),
  // Y = y0 + u - hu (1 + grow u)
  const dy = 1 - hu * e.grow;
  const dx = e.m + e.lean * hu * e.grow;
  const ui = (y - e.y0 + hu) / dy;
  const ix = e.xA + e.m * ui + e.lean * hu * (1 + e.grow * ui);
  const sp = Math.hypot(dx, dy);
  // `REACH` as far on as from the side, but never below the far touchline
  const reach = Math.min((REACH * Math.max(0, ix - c.x0)) / sp, side / dy);
  return {
    hu,
    y,
    ix,
    bx: ix + dx * reach,
    by: y + dy * reach,
    ub: ui + reach,
    dx,
    dy,
    sp,
  };
}

/** How far round its bend row `r` is at column `x`: 0 at the side stand, 1 at the end. */
function tOf(c: CornerGeo, r: Row, x: number): number {
  const d = x - c.x0;
  if (d <= 0) return 0;
  if (x >= r.bx) return 1;
  // x - x0 = 2 p t + (q - p) t²
  const p = r.ix - c.x0;
  const q = r.bx - r.ix;
  const a = q - p;
  const b = 2 * p;
  if (Math.abs(a) < 1e-9) return Math.min(1, d / b);
  return Math.min(1, (2 * d) / (b + Math.sqrt(Math.max(0, b * b + 4 * a * d))));
}

/** Where row `r` is in column `x`: on the side stand, round the bend, on the end. */
function rowY(c: CornerGeo, r: Row, x: number): number {
  if (x <= c.x0) return r.y;
  if (x >= r.bx) return r.by + ((x - r.bx) * r.dy) / r.dx;
  const t = tOf(c, r, x);
  return r.y + t * t * (r.by - r.y);
}

/** Gauss-Legendre on four points, for the bend's length. */
const GL: readonly [number, number][] = [
  [-0.861136311594053, 0.347854845137454],
  [-0.339981043584856, 0.652145154862546],
  [0.339981043584856, 0.652145154862546],
  [0.861136311594053, 0.347854845137454],
];

/** The end's `u` along row `r` at column `x`, carried on back round the bend. */
function alongAt(c: CornerGeo, r: Row, x: number): number {
  if (x >= r.bx) return r.ub + (x - r.bx) / r.dx;
  // the bend's length from `x` on to `B`: its speed is 2 |(1 - t)(I - A) + t (B - I)|
  const px = r.ix - c.x0;
  const qx = r.bx - r.ix;
  const qy = r.by - r.y;
  const t0 = tOf(c, r, x);
  const half = (1 - t0) / 2;
  let len = 0;
  for (const [n, w] of GL) {
    const t = t0 + half * (n + 1);
    len += w * 2 * Math.hypot((1 - t) * px + t * qx, t * qy);
  }
  len *= half;
  // (past the side stand's end, level)
  if (x < c.x0) len += c.x0 - x;
  return r.ub - len / r.sp;
}

/**
 * Where the end starts, `hu` up its profile: the `u` along its row where the corner's bend
 * hands it on (end.ts paints from there, the corner up to there); null when the corner is
 * open (tiers 3 and 4).
 */
export function cornerStart(p: Paint): ((hu: number) => number) | null {
  if (!cornerFilled(p)) return null;
  const c = cornerFor(p);
  // asked for every pixel of the end: a table a quarter of a stand pixel apart, between
  const ub = new Float64Array(TOP * 4 + 1);
  for (let i = 0; i < ub.length; i++) ub[i] = rowOf(c, i / 4).ub;
  return (hu) => {
    const f = Math.min(TOP, Math.max(0, hu)) * 4;
    const i = Math.min(ub.length - 2, Math.floor(f));
    return ub[i] + (ub[i + 1] - ub[i]) * (f - i);
  };
}

/**
 * The corner's columns: from the side stand's end to where its roof is the end's, for
 * anything along its roof (flags, NEXT-GEN's crown and ribbon).
 */
export function cornerColumns(p: Paint): [number, number] {
  const c = cornerFor(p);
  return [c.x0, Math.min(p.g.w, Math.ceil(rowOf(c, TOP).bx))];
}

/** Where column `x` of the corner is `h` up its profile (`TOP`: its roof's top). */
export function cornerRowAt(p: Paint, x: number, h: number): number {
  const c = cornerFor(p);
  return rowY(c, rowOf(c, h), x + 0.5);
}

/** How far round the corner column `x` is at its roof, 0 at the side stand to 1 at the end. */
export function cornerRound(p: Paint, x: number): number {
  const c = cornerFor(p);
  return tOf(c, rowOf(c, TOP), x + 0.5);
}

/**
 * The top of the roof in column `x` from the corner on (things that stand on it: beams,
 * drums, lasers, flags): round the corner's bend at an international, then the end's.
 */
export function standRoofAt(p: Paint, x: number): number {
  const e = endFor(p.g);
  if (!cornerFilled(p)) return endTopAt(e, x, TOP);
  const c = cornerFor(p);
  const r = rowOf(c, TOP);
  if (x + 0.5 >= r.bx) return endTopAt(e, x, TOP);
  return Math.round(rowY(c, r, x + 0.5));
}

/**
 * The colour of the corner `hu` up its profile: the end's colours (end.ts), `u` the end's
 * measure along the row (its boards' panels, its aisles, its roof's seams).
 */
export type CornerColour = (
  hu: number,
  u: number,
  h: number,
  z: number,
  x: number,
  y: number,
) => Color;

export interface CornerLook {
  colour: CornerColour;
  /** The lower and the upper tier's seat colours, under the fans. */
  seatLow: Color;
  seatUp: Color;
  /**
   * How thickly the roof glows against the night sky (a share of a dither, 0 for none: the
   * arena's crown of glass glows of itself).
   */
  glow: number;
  /** The share of empty seats (RETRO's few gaps). */
  empty?: number;
  /**
   * What stands on the roof over the side stand's end, `d` rows above the corner's top
   * (1 the lowest), `t` of the way round: RETRO's iron slope, gone by the end; null, sky.
   */
  cap?: (x: number, y: number, d: number, t: number) => Color | null;
}

/**
 * Paint the corner into the layer, after the side stand and before the end: every pixel
 * from the corner's roof down to the far touchline that the end will not paint (end.ts,
 * from `cornerStart` on), then the fans.
 */
export function paintCornerStand(
  s: Surface,
  p: Paint,
  life: Life,
  look: CornerLook,
): void {
  const c = cornerFor(p);
  const { g } = p;
  const { e } = c;
  // (the end's own measure of where it starts, so the two paint every pixel between them)
  const start = cornerStart(p) ?? (() => 0);
  // the rows a whole stand pixel apart, to find each pixel's row from
  const rows: Row[] = [];
  for (let k = 0; k <= TOP; k++) rows.push(rowOf(c, k));
  const at = new Float64Array(TOP + 1);
  const top = rows[TOP];
  const xEnd = Math.min(g.w, Math.ceil(top.bx) + 1);
  for (let X = c.x0; X < xEnd; X++) {
    const x = X + 0.5;
    for (let k = 0; k <= TOP; k++) at[k] = rowY(c, rows[k], x);
    const yTop = at[TOP];
    const y0 = Math.max(0, Math.floor(yTop));
    let k = TOP;
    for (let Y = y0; Y < c.F; Y++) {
      const yc = Y + 0.5;
      if (yc < yTop) continue;
      // the end's from where it starts (end.ts finds its pixels just so)
      const h = (X - e.xA - e.m * (Y - e.y0)) / (e.m + e.lean);
      const ue = Y - e.y0 + h;
      if (ue >= 0 && h >= 0) {
        const hue = h / (1 + e.grow * ue);
        if (hue < TOP && ue >= start(hue)) continue;
      }
      // this pixel's row: between the rows a stand pixel apart either side of it
      while (k > 0 && at[k] < yc) k--;
      const gap = k < TOP ? at[k] - at[k + 1] : 0;
      const hu =
        k >= TOP
          ? TOP
          : at[k] < yc
            ? 0
            : k + (gap > 1e-9 ? (at[k] - yc) / gap : 0);
      const u = alongAt(c, rowOf(c, hu), x);
      s.px(X, Y, look.colour(hu, u + U_OFF, hu, 1, X, Y));
    }
    // the roof's glow against the night, and what stands on the roof
    if (look.glow > 0 && p.flood) {
      for (let Y = Math.max(0, y0 - 12); Y < y0; Y++) {
        if (bayer4(X, Y) < look.glow) s.px(X, Y, P.nightGlow);
      }
    }
    if (look.cap) {
      const t = tOf(c, top, x);
      for (let d = 1; d <= 8 && y0 - d >= 0; d++) {
        const col = look.cap(X, y0 - d, d, t);
        if (col === null) break;
        s.px(X, y0 - d, col);
      }
    }
  }

  // the fans, shoulder to shoulder along each row as it bends, on from the end's first
  // (end.ts: one every `6 / m` along its rows, from 3 on). Where the rows close up (a narrow
  // corner, on a phone) a fan would sit mostly behind the one in front of it: that seat
  // shows empty instead. Worked out from the front rows back, painted the back rows first.
  const st = fanStyle(p);
  const pitch = 6 / e.m;
  const blocks = [
    { base: LOW, rows: 6, seat: look.seatLow, dim: 99 },
    { base: UP, rows: 6, seat: look.seatUp, dim: 4 },
  ];
  const seated: Seated[] = [];
  const taken: Seated[] = [];
  const endSeat = (hu: number, u: number): Seated => {
    const hb = hu * (1 + e.grow * u);
    return {
      x: Math.round(e.xA + e.m * u + e.lean * hb) - 3,
      y: Math.round(e.y0 + u - hb) - 8,
      seat: look.seatLow,
      dim: false,
    };
  };
  for (const b of blocks) {
    for (let r = 0; r < b.rows; r++) {
      const hu = b.base + r * ROW;
      const row = rowOf(c, hu);
      // the end's first two seats on this row: the corner's run on from them
      const u1 =
        3 + Math.max(0, Math.ceil((row.ub - 3) / pitch - 1e-9)) * pitch;
      const first = endSeat(hu, u1);
      taken.push(first, endSeat(hu, u1 + pitch));
      for (let x = first.x - 6; x >= c.x0; x -= 6) {
        const a = (alongAt(c, row, x + 3) + U_OFF + 40) % AISLE;
        if (a > AISLE - 7 || a < 3) continue;
        const y = Math.round(rowY(c, row, x + 3)) - 8;
        if (look.empty && rnd(p, x, y, 21) < look.empty) continue;
        const hidden = (f: Seated): boolean =>
          Math.abs(f.x - x) < 6 && Math.abs(f.y - y) < FAN_CLEAR;
        if (seated.some(hidden) || taken.some(hidden)) continue;
        seated.push({ x, y, seat: b.seat, dim: r >= b.dim });
      }
    }
  }
  for (let i = seated.length - 1; i >= 0; i--) {
    const f = seated[i];
    seatFan(s, p, life, st, f.x, f.y, f.seat, f.dim);
  }
}

/** A fan's place in the corner. */
interface Seated {
  x: number;
  y: number;
  seat: Color;
  dim: boolean;
}

/**
 * Two fans of the corner side by side are at least this far apart up and down: a fan in
 * front hides at most the foot of one behind (a fan is 8 tall).
 */
export const FAN_CLEAR = 6;
