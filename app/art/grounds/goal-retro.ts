/**
 * RETRO's goal (tiers 0 to 3; .snaps/era-art/THEME.md): the same place, height and depth
 * as today's (goal.ts hands its geometry in), drawn as the early game's goal.
 *
 * - Square wooden posts that stand a little proud of the crossbar, its bar a squared
 *   timber; painted white at the club grounds (tiers 2 and 3), bare wood at Sunday league
 *   (tier 1, its bar sagging).
 * - A net of thick hemp rope on a square mesh (strings 7 px apart, each a lit cord with its
 *   shade beside it, a knot where two cross), held at the back by a slim wooden stanchion.
 *   A ball in the net still shows through the 5 px holes.
 * - Tier 0: jumpers for goalposts still, but a knitted jersey in his colour and a tweed
 *   jacket, a flat cap dropped on top of the near pile.
 *
 * Nothing here is drawn for today's look: goal.ts calls it only when `c.style` is "wood".
 */

import { P } from "~/art/palette";
import { mix, shade, type Color, type Surface } from "~/pixel";
import type { Grade } from "./paint";
import type { NetBulge, Tier } from "./types";

/** The colours of RETRO's goal, as goal.ts's `GoalColors` names them. */
export function retroGoalColors(G: Grade, tier: Tier) {
  const bare = tier === 1;
  // tier 1's rope is raw hemp; the club grounds' is whitened (cream), its shade dark wood,
  // so it reads against brick and timber behind it
  const rope = bare ? mix(P.chalk, P.wood, 0.3) : mix(P.chalk, P.wood, 0.1);
  return {
    // square timber: a flat lit face and a flat shaded one (warm, not today's cool greys)
    post: G(bare ? shade(P.wood, 0.3) : P.chalk),
    postShade: G(bare ? P.wood : mix(P.mist, P.wood, 0.45)),
    postDark: G(P.woodDark),
    net: G(rope),
    netFar: G(mix(P.mist, P.wood, bare ? 0.35 : 0.2)),
    netShade: G(bare ? mix(P.wood, P.woodDark, 0.4) : P.woodDark),
    netFarShade: G(P.woodDark),
    ground: G(P.grassDeep),
    // tier 0: a knitted jersey in his colour (RETRO's old gold), a tweed jacket
    jumperA: G(P.retro),
    jumperAHi: G(P.retroLight),
    jumperShade: G(P.retroDark),
    jumperB: G(P.wood),
    jumperBHi: G(shade(P.wood, 0.25)),
    jumperBLo: G(P.woodDark),
  };
}

/** What goal.ts hands over: the colours (as above) and its geometry. */
export interface RetroGoal {
  post: Color;
  postShade: Color;
  postDark: Color;
  net: Color;
  netFar: Color;
  netShade: Color;
  netFarShade: Color;
  ground: Color;
}

export interface GoalGeometry {
  /** Near post's left column and foot row; far post's right column and foot row. */
  nx: number;
  nfoot: number;
  fx: number;
  ffoot: number;
  /** Post height (bar above the foot), depth of the net, roof rows and the back's lean. */
  ph: number;
  depth: number;
  roof: number;
  lean: number;
  /** How far the back of the net is pushed out at row y. */
  push: (y: number, bulge: NetBulge | null | undefined) => number;
}

/** The mesh: squares of rope this many pixels apart (2 px cords, 6 px holes). */
const MESH = 8;
/** Posts stand this far proud of the crossbar's top. */
const PROUD = 3;

/** The back edge of a side panel at row y (goal.ts `panel`'s, to the pixel). */
function backAt(
  px: number,
  foot: number,
  geo: GoalGeometry,
  y: number,
): number {
  const top = foot - geo.ph;
  const backTop = top + geo.roof;
  const d = geo.depth;
  return y < backTop
    ? px + Math.round(((y - top) * (d - geo.lean)) / geo.roof)
    : px +
        d -
        geo.lean +
        Math.round(
          ((y - backTop) * geo.lean) / Math.max(1, foot - 1 - backTop),
        );
}

/**
 * One side panel of rope: horizontal strings every `MESH` rows from the bar down, upright
 * strings every `MESH` columns back from the post, each a cord with its shade under it (or
 * to its right), a knot where they cross; the back edge a rope (the near side's on a slim
 * stanchion), the roof's edge sagging when `sag`.
 */
function ropePanel(
  s: Surface,
  px: number,
  foot: number,
  geo: GoalGeometry,
  sag: boolean,
  c: Color,
  low: Color,
  edge: Color,
  stanchion: readonly [Color, Color] | null,
  bulge: NetBulge | null | undefined,
): void {
  const top = foot - geo.ph;
  const backTop = top + geo.roof;
  for (let y = top + 1; y < foot; y++) {
    const back = backAt(px, foot, geo, y) + geo.push(y, bulge);
    // a square mesh of thick rope: cords running back from the post and across, each 2 px
    // (lit, its shade under it or to its right), a dark knot where two cross
    const ry = (y - top) % MESH;
    for (let x = px + 2; x < back; x++) {
      const rx = (x - px - 2) % MESH;
      if (ry === 1 && rx === 1) s.px(x, y, low);
      else if (ry === 0 || rx === 0) s.px(x, y, c);
      else if (ry === 1 || rx === 1) s.px(x, y, low);
    }
    if (y >= backTop) {
      if (stanchion && geo.push(y, bulge) === 0) {
        s.px(back, y, stanchion[0]);
        s.px(back + 1, y, stanchion[1]);
      } else {
        s.px(back, y, edge);
      }
    }
  }
  // the roof's edge: a rope from the bar down to the back, sagging when old
  const n = geo.depth - geo.lean;
  for (let i = 0; i <= n; i++) {
    const y = top + Math.round((i * geo.roof) / Math.max(1, n));
    const dip = sag && i > 2 && i < n - 2 ? (i > 4 && i < n - 4 ? 2 : 1) : 0;
    s.px(px + i, y + dip, edge);
    s.px(px + i, y + dip + 1, low);
  }
  if (stanchion) {
    // the stanchion's top above the roof's back corner, and its peg in the grass
    const bx = px + n;
    s.px(bx, backTop - 1, stanchion[0]);
    s.px(bx + 1, backTop - 1, stanchion[1]);
    const fb = backAt(px, foot, geo, foot - 1);
    s.px(fb + 2, foot - 1, stanchion[1]);
  }
}

/** The far side's netting and the far post (drawn before the cast). */
export function drawRetroGoalBack(
  s: Surface,
  geo: GoalGeometry,
  small: boolean,
  c: RetroGoal,
): void {
  const { fx, ffoot, ph } = geo;
  s.hline(fx + 1, ffoot - 2, geo.depth, c.ground);
  s.hline(fx + 1, ffoot - 1, geo.depth, c.ground);
  ropePanel(
    s,
    fx,
    ffoot,
    geo,
    small,
    c.netFar,
    c.netFarShade,
    c.netFar,
    null,
    null,
  );
  // the far post, square, standing proud of the bar: its face lit, its side in shade
  const top = ffoot - ph - PROUD;
  const w = small ? 2 : 3;
  s.rect(fx - w, top, w, ph + PROUD, c.post);
  s.vline(fx, top + 1, ph + PROUD - 1, c.postShade);
  s.hline(fx - w, top, w + 1, c.postShade);
  s.px(fx, top, c.postDark);
}

/** The roof and back of the net, the near side's netting, the crossbar and the near post. */
export function drawRetroGoalFront(
  s: Surface,
  geo: GoalGeometry,
  small: boolean,
  c: RetroGoal,
  bulge: NetBulge | null | undefined,
): void {
  const { nx, nfoot, fx, ffoot, ph, depth: d, roof, lean } = geo;
  const ntop = nfoot - ph;
  const ftop = ffoot - ph;
  // the back of the net, seen edge on: a rope between the two back edges, knots on it
  for (let y = ftop + roof; y < nfoot; y++) {
    const p = geo.push(y, bulge);
    const t = (y - (ftop + roof)) / Math.max(1, nfoot - 1 - (ftop + roof));
    const x = Math.round(fx + d - lean + t * lean + (nx - fx) * t) + p;
    s.px(x, y, (y - ftop) % MESH === 0 ? c.netFarShade : c.netFar);
  }
  // the roof of the net: ropes running back from the bar, and across it
  for (let y = ftop; y < ntop + roof; y++) {
    const a = Math.max(fx, fx + Math.round(((y - ftop) * (nx - fx)) / roof));
    const b = Math.min(nx + d - lean, a + d - lean + 1);
    for (let x = a + 1; x < b; x++) {
      if ((((x - y) % MESH) + MESH) % MESH !== 0) continue;
      s.px(x, y, c.netFar);
      s.px(x - 1, y + 1, c.netFarShade);
    }
  }
  // the near side's netting on its stanchion, the net's foot pegged down
  ropePanel(s, nx, nfoot, geo, small, c.net, c.netShade, c.net, null, bulge);
  s.hline(nx + 1, nfoot - 2, d, c.ground);
  s.hline(nx + 1, nfoot - 1, d, c.ground);
  frame(s, nx, ntop, fx, ftop, ph, small, c);
}

/**
 * A squared timber crossbar from the far post to the near (3 px, 2 at Sunday league, lit
 * on top), then the near post, square, standing proud of the bar with its cut end lit.
 */
function frame(
  s: Surface,
  nx: number,
  ntop: number,
  fx: number,
  ftop: number,
  ph: number,
  small: boolean,
  c: RetroGoal,
): void {
  const T = small ? 2 : 3;
  const x0 = fx - T + 1;
  const steps = Math.max(Math.abs(nx - x0), Math.abs(ntop - ftop));
  for (let i = 0; i <= steps; i++) {
    const bx = Math.round(x0 + ((nx - x0) * i) / steps);
    let by = Math.round(ftop + ((ntop - ftop) * i) / steps);
    // the Sunday league's bar sags in the middle
    if (small && i > steps * 0.25 && i < steps * 0.75) by += 1;
    s.hline(bx, by, T, c.post);
    if (T === 3) s.hline(bx, by + 1, T, c.postShade);
    s.hline(bx, by + T - 1, T, c.postDark);
  }
  // the near post, a squared timber: a flat lit face and a flat shaded side meeting at a
  // hard corner (never today's rounded steel), its sawn top lit with a dark edge
  const W = small ? 3 : 4;
  const top = ntop - PROUD;
  const h = ph + PROUD;
  s.rect(nx, top, W - 1, h, c.post);
  s.vline(nx + W - 1, top + 1, h - 1, c.postShade);
  s.hline(nx, top, W, c.postShade);
  s.px(nx + W - 1, top, c.postDark);
  // the bar's end through the post: its end grain showing past the shaded side
  const by = ntop + (small ? 1 : 0);
  s.rect(nx + W, by, 1, T, c.postShade);
  s.vline(nx + W + 1, by, T, c.postDark);
  s.px(nx + W, by + T - 1, c.postDark);
  if (!small) {
    // the paint chipped where boots and balls have hit it
    s.px(nx + 1, top + 30, c.postShade);
    s.px(nx, top + 41, c.postShade);
    s.px(nx + 1, top + 41, c.postDark);
  } else {
    // bare wood: a knot and a split in the grain
    s.px(nx, top + 14, c.postDark);
    s.px(nx + 1, top + 22, c.postShade);
    s.px(nx + 1, top + 23, c.postShade);
  }
}

/** A flat cap dropped on the near pile of jackets (tier 0): (x, y) its crown's left. */
export function drawCapOnPile(
  s: Surface,
  x: number,
  y: number,
  cap: Color,
  capLit: Color,
  capLow: Color,
): void {
  s.hline(x + 1, y, 4, capLit);
  s.hline(x, y + 1, 6, cap);
  s.px(x, y + 1, capLit);
  s.hline(x, y + 2, 8, capLow);
  s.hline(x + 6, y + 1, 2, cap);
}
