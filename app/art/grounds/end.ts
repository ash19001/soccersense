/**
 * The end behind the goal (tiers 3 to 7): the side stand stops at the corner,
 * level with the goal line, and beyond the goal an end stand (a roofed two-tier stand at the
 * stadium, an open terrace at tier 3) wraps round towards us, seen at an angle from this
 * side-on view. Between them is the corner, where the town and the spire show through.
 *
 * The end is drawn in its own slanted frame: its front runs along a line across the pitch
 * (like the goal line, through the pitch's vanishing point, `across` in paint.ts), each row
 * up the stand steps back to the right by `lean`, and the stand grows a little as it comes
 * towards us (`grow`), so its rows open out like steps seen close. A point `u` rows down
 * its front and `h` px up the stand is at
 *
 *   X = xA + m u + lean h,   Y = y0 + u - h,
 *
 * and every part of the stand's profile is measured in "stand pixels" `h / z(u)` with
 * `z(u) = 1 + grow u`, so the far end is the size of the side stand and the near end a
 * little taller. The fans are the far stands' seated fans at their own size (6 x 8), on
 * rows that follow the stand: the stand opens out, the people do not grow.
 */

import { P } from "~/art/palette";
import { bayer4, hash2, mix, shade, type Color, type Surface } from "~/pixel";
import { fanStyle, seatFan } from "./crowd";
import { BOARD_LOOKS } from "./far-tables";
import type { Life } from "./life";
import { across, rnd, type Geo, type Paint } from "./paint";
import { tuft } from "./pitch";
import { paintRetroEnd } from "./retro-end";
import { RETRO_BOARD_LOOKS } from "./retro-club";
import { arenaEndColors, paintArenaCorner } from "./nextgen-high";
import { ngBarrierColors, ngTerraceColors } from "./nextgen-low";

/** Where the end is at this canvas size. */
export interface EndGeo {
  /** The side stand runs from the left edge up to (not including) this column. */
  corner: number;
  /** The front of the end's far end (its foot) is at (xA, y0). */
  xA: number;
  y0: number;
  /** Columns the front moves right for each row it comes down. */
  m: number;
  /** Columns each pixel up the stand steps back (right). */
  lean: number;
  /** How much taller the end is for each row it comes towards us. */
  grow: number;
}

/** Each pixel up the stand steps back this much: the rake seen from the side. */
const LEAN = 0.3;

/** The stadium's end, in stand pixels from its foot (the far end's size). */
const WALL = 16;
const LOW = 16;
const WALK = 64;
const UP = 72;
const BACK = 120;
const UNDER = 124;
const FASCIA = 128;
const TOP = 140;

/** Tier 3's open terrace: a wall of painted boards, five rows, a lit back wall. */
const T_ROWS = 5;
const T_BACK = LOW + T_ROWS * 8;
const T_TOP = T_BACK + 6;

/** A row of seats is 8 stand pixels, and a seat 8 px along the row (6.9 rows of the front). */
const ROW = 8;

/** Aisles: one every this many rows of the front, 4 wide. */
const AISLE = 83;

/** The stadium end's profile, for an era's own colours along it (nextgen-high.ts). */
export const END_PROFILE = Object.freeze({
  WALL,
  LOW,
  WALK,
  UP,
  BACK,
  UNDER,
  FASCIA,
  TOP,
  ROW,
  AISLE,
});

export function endFor(g: Geo): EndGeo {
  const corner = across(g, g.goalX, g.F) + 2;
  // the front runs along a line across the pitch, behind the goal and its photographers
  const f0 = g.goalX + Math.round(16 * g.k);
  const m = (f0 - g.vx) / (g.gy - g.vy);
  // its far end tucks in a little behind the far touchline, so the corner stays tight
  const y0 = g.F - 12;
  const xA = g.vx + m * (y0 - g.vy);
  // it grows towards us so its roof stays over the town's foot to the canvas's right edge
  const uEnd = Math.max(1, (g.w - xA) / m);
  const zEnd = Math.min(2.4, Math.max(1, (y0 + uEnd - (g.B - 6)) / TOP));
  return { corner, xA, y0, m, lean: LEAN, grow: (zEnd - 1) / uEnd };
}

/** The row where the near side (in front of the end) starts. */
export function nearTop(p: Paint): number {
  return p.g.N + (p.tier >= 4 ? 48 : 45);
}

/**
 * The column of the end's front (its boards' foot) on row `y`, tiers 3 to 7:
 * anything standing behind the goal (a ball kid, a photographer) stays left of it.
 */
export function endFrontAt(g: Geo, y: number): number {
  const e = endFor(g);
  return Math.round(e.xA + e.m * (y - e.y0));
}

/** Where the end's roof (or its top) is in column `x`. */
export function endTopAt(e: EndGeo, x: number, top: number): number {
  const u = Math.max(
    0,
    (x - e.xA - e.lean * top) / (e.m + e.lean * top * e.grow),
  );
  return Math.round(e.y0 + u - top * (1 + e.grow * u));
}

interface Look {
  bg: Color;
  fg: Color;
}

/** The LED boards along the stadium end's front: the far side's looks, without words. */
const LED_LOOKS: readonly Look[] = [
  { bg: P.ledOff, fg: P.amber },
  { bg: P.home, fg: P.chalk },
  { bg: P.ledOff, fg: P.ledGreen },
  { bg: P.chalk, fg: P.night },
  { bg: P.night, fg: P.gold },
];

/**
 * Paint the end into the layer: after the pitch and the near side, so it covers the grass
 * beyond its front and the near boards and apron beyond it, and stops at the near side's
 * crowd, which is nearer than it (tiers 3 to 7).
 */
export function paintEnd(s: Surface, p: Paint, life: Life): void {
  // RETRO's end at the big grounds (retro-end.ts)
  if (p.era === "retro" && p.tier >= 4) {
    paintRetroEnd(s, p, life);
    return;
  }
  const { g } = p;
  const e = endFor(g);
  const stadium = p.tier >= 4;
  const top = stadium ? TOP : T_TOP;
  const clipY = Math.min(g.h, nearTop(p));
  const { xA, y0, m, lean, grow } = e;
  // NEXT-GEN's arena (nextgen-high.ts): its corner and its colours along the profile
  const arena = stadium && p.era === "nextgen";
  // (NEXT-GEN's tier 3 takes the arena's glass corner too, and its own terrace:
  // nextgen-low.ts)
  const ngTerrace = !stadium && p.era === "nextgen";
  if (arena || ngTerrace) paintArenaCorner(s, p, e);
  else paintCorner(s, p, e);

  const colour = arena
    ? arenaEndColors(p)
    : stadium
      ? stadiumColors(p)
      : ngTerrace
        ? ngTerraceColors(p, seats, { low: LOW, back: T_BACK, top: T_TOP })
        : terraceColors(p);
  const behind = stadium ? stadiumBack(p) : grassBank(p);
  const zMax = 1 + grow * Math.max(0, clipY - y0 + top * 2);
  const yTop = Math.max(0, Math.floor(y0 - top * zMax - 14));
  for (let Y = yTop; Y < clipY; Y++) {
    const xs = Y <= y0 ? xA + lean * (y0 - Y) : xA + m * (Y - y0);
    for (let X = Math.max(e.corner, Math.floor(xs)); X < g.w; X++) {
      const h = (X - xA - m * (Y - y0)) / (m + lean);
      const u = Y - y0 + h;
      if (u < 0 || h < 0) continue;
      const z = 1 + grow * u;
      const hu = h / z;
      if (hu >= top) {
        // over its top: what lies behind it, down from the town's foot
        if (Y >= g.B) {
          s.px(X, Y, behind(X, Y, hu - top));
          continue;
        }
        // over the stadium's roof at night: its glow against the sky (the arena's crown of
        // glass glows of itself, nextgen-high.ts)
        if (
          stadium &&
          !arena &&
          p.flood &&
          hu < top + 12 &&
          bayer4(X, Y) < 0.25
        )
          s.px(X, Y, P.nightGlow);
        if (hu > top + 12 && Y < g.B - 14) break;
        continue;
      }
      s.px(X, Y, colour(hu, u, h, z, X, Y));
    }
  }

  // the fans, the back rows first
  const st = fanStyle(p);
  const blocks = stadium
    ? [
        { base: UP, rows: 6, seat: p.S(P.night), dim: 4, empty: 0 },
        { base: LOW, rows: 6, seat: p.S(P.concreteDark), dim: 99, empty: 0 },
      ]
    : [
        {
          base: LOW,
          rows: T_ROWS,
          seat: p.S(
            p.era === "retro" ? shade(P.woodDark, -0.25) : P.concreteDark,
          ),
          dim: 99,
          empty: 0.08,
        },
      ];
  // shoulder to shoulder: each seat 6 px along (the fan's width) and a little down the row,
  // so a row's fans tile the stand like the side stand's; never overlapping, at any growth
  const pitch = 6 / m;
  for (const b of blocks) {
    for (let r = b.rows - 1; r >= 0; r--) {
      for (let i = 0; ; i++) {
        const u = 3 + i * pitch;
        const hb = (b.base + r * ROW) * (1 + grow * u);
        const x = Math.round(xA + m * u + lean * hb) - 3;
        const y = Math.round(y0 + u - hb) - 8;
        if (x >= g.w || y + 8 > clipY) break;
        const a = (u + 40) % AISLE;
        if (a > AISLE - 7 || a < 3) continue;
        if (rnd(p, x, y, 21) < b.empty) continue;
        seatFan(s, p, life, st, x, y, b.seat, r >= b.dim);
      }
    }
  }
  if (!stadium) terraceBarriers(s, p, e, clipY);
}

type Colour = (
  hu: number,
  u: number,
  h: number,
  z: number,
  x: number,
  y: number,
) => Color;

/** The stadium's end, part by part from its foot up to the roof's lit edge. */
function stadiumColors(p: Paint): Colour {
  const { S } = p;
  const lit = p.lamps;
  const boardBg = LED_LOOKS.map((l) => (lit ? l.bg : S(l.bg)));
  const boardFg = LED_LOOKS.map((l) => (lit ? l.fg : S(l.fg)));
  const boardDim = LED_LOOKS.map((l, i) => mix(boardBg[i], boardFg[i], 0.22));
  const dark = LED_LOOKS.map((l) => l.bg === P.ledOff || l.bg === P.night);
  const c = {
    ink: S(P.ink),
    night: S(P.night),
    slate: S(P.slate),
    steel: S(P.steel),
    hi: S(P.steelHi),
    light: S(P.concreteLight),
    mid: S(P.concrete),
    low: S(P.concreteDark),
    noseLow: S(mix(P.concreteDark, P.concrete, 0.55)),
    noseUp: S(mix(P.night, P.slate, 0.6)),
    tA: S(p.tier >= 5 ? P.chalk : P.home),
    tB: S(p.tier >= 5 ? P.home : P.homeDark),
  };
  const BW = 26;
  return (hu, u, h, z, x, y) => {
    // the far end's side, seen edge on: a lit concrete screen
    if (u < 1.5 && hu < FASCIA) return hu < WALL ? c.mid : c.light;
    if (hu < WALL) {
      if (hu < 2) return c.ink;
      if (hu >= WALL - 1) return c.hi;
      if (hu >= WALL - 2) return c.light;
      // the boards: panels along the front, a seam between two
      const k = Math.floor(u / BW);
      const i = ((k % LED_LOOKS.length) + LED_LOOKS.length) % LED_LOOKS.length;
      const along = u - k * BW;
      if (along < 1) return c.ink;
      const row = hu - 2;
      if (dark[i]) {
        // a matrix of lamps: blocks of lit lamps along the middle, the rest dim
        const lamp = ((x + y) & 1) === 0;
        if (row >= 3 && row < 9 && along > 4 && along < BW - 3) {
          const block = Math.floor((along - 4) / 4) % 3 !== 2;
          if (block && lamp) return boardFg[i];
        }
        return lamp && bayer4(x, y) < 0.5 ? boardDim[i] : boardBg[i];
      }
      // a painted panel: a band of its second colour
      if (row >= 4 && row < 8 && along > 4 && along < BW - 3) return boardFg[i];
      return boardBg[i];
    }
    if (hu < WALK) return seats(hu - LOW, h, z, u, c.low, c.noseLow, c);
    if (hu < UP) {
      // the walkway between the tiers: its lit lip, its face, a shadow under it
      const d = UP - hu;
      return d < 1 ? c.hi : d < 2 ? c.light : d < 5 ? c.mid : c.low;
    }
    if (hu < BACK) return seats(hu - UP, h, z, u, c.night, c.noseUp, c);
    if (hu < UNDER) return c.night;
    if (hu < FASCIA) {
      // under the roof: a row of lamps at night, the truss's zig-zag by day
      const along = u % 14;
      if (p.flood && along < 5) return hu < UNDER + 2 ? P.white : P.goldLight;
      const k = Math.floor(u) % 8;
      return Math.floor(hu - UNDER) === (k < 4 ? k : 7 - k) >> 1
        ? c.night
        : c.ink;
    }
    // the roof's fascia: a lit edge, panels with their seams, the club's stripes, its lip
    const d = TOP - hu;
    if (d < 1) return c.hi;
    if (d < 6) return u % 21 < 1 ? c.mid : c.light;
    if (d < 8) return c.tA;
    if (d < 10) return c.tB;
    if (d < 11) return c.mid;
    return c.low;
  };
}

type Behind = (x: number, y: number, over: number) => Color;

/** Behind the stadium's end, below the town's foot: the back of its roof, in shade. */
function stadiumBack(p: Paint): Behind {
  const edge = p.S(P.slate);
  const dark = p.S(P.night);
  return (_x, _y, over) => (over < 2 ? edge : dark);
}

/** Behind tier 3's open terrace: a grass bank up to a hedge at the town's foot. */
function grassBank(p: Paint): Behind {
  const { S, g } = p;
  const base = S(mix(P.grass, P.grassDark, 0.55));
  const dark = S(P.grassDeep);
  const light = S(mix(P.grass, P.grassLight, 0.3));
  const hedge = S(P.grassDeep);
  const hedgeHi = S(P.grassDark);
  return (x, y) => {
    const d = y - g.B;
    if (d < 4) return hash2(x >> 1, y, p.seed + 77) < 0.35 ? hedgeHi : hedge;
    const k = tuft(x, y, p.seed + 7, 0.4, false);
    return k === 1 ? dark : k === 2 ? light : base;
  };
}

/** A block of rows: a lit nosing along each step, the seats behind it, the aisles' steps. */
function seats(
  k: number,
  h: number,
  z: number,
  u: number,
  seat: Color,
  nose: Color,
  c: { hi: Color; light: Color; mid: Color },
): Color {
  const r = Math.floor(k / ROW);
  const hb = h - (h / z - k + r * ROW) * z;
  const a = (u + 40) % AISLE;
  if (a > AISLE - 4) {
    // an aisle: steps two to a row, a lit nosing over a tread in the stand's shade
    const s = Math.floor(hb) % 4;
    return s === 0 ? c.mid : s === 1 ? nose : seat;
  }
  return hb < 1 ? nose : seat;
}

/** Tier 3's terrace: painted boards on a wall, five rows of steps, a lit back wall. */
function terraceColors(p: Paint): Colour {
  const { S } = p;
  // RETRO (retro-club.ts): hand-painted boards and steps of timber
  const retro = p.era === "retro";
  const looks = retro ? RETRO_BOARD_LOOKS : BOARD_LOOKS;
  const bg = looks.map((l) => S(l.bg));
  const fg = looks.map((l) => S(l.fg));
  const hiB = looks.map((l) => S(shade(l.bg, 0.2)));
  const loB = looks.map((l) => S(shade(l.bg, -0.15)));
  const c = retro
    ? {
        wood: S(shade(P.woodDark, -0.35)),
        woodDark: S(P.woodDark),
        hi: S(shade(P.wood, 0.3)),
        light: S(P.wood),
        mid: S(P.woodDark),
        low: S(shade(P.woodDark, -0.25)),
        nose: S(mix(P.woodDark, P.wood, 0.55)),
      }
    : {
        wood: S(shade(P.woodDark, -0.35)),
        woodDark: S(P.woodDark),
        hi: S(P.steelHi),
        light: S(P.concreteLight),
        mid: S(P.concrete),
        low: S(P.concreteDark),
        nose: S(mix(P.concreteDark, P.concrete, 0.55)),
      };
  const BW = 30;
  return (hu, u, h, z) => {
    if (u < 1.5) return hu < 14 ? c.woodDark : c.light;
    if (hu < 14) {
      if (hu < 2) return c.wood;
      const k = Math.floor(u / BW);
      const i = (((k + p.seed) % bg.length) + bg.length) % bg.length;
      const along = u - k * BW;
      if (along < 1.5) return c.woodDark;
      const row = hu - 2;
      if (row >= 11) return hiB[i];
      if (row < 1) return loB[i];
      if (row >= 4 && row < 8 && along > 5 && along < BW - 4) return fg[i];
      return bg[i];
    }
    if (hu < LOW) return hu < LOW - 1 ? c.mid : c.light;
    if (hu < T_BACK) return seats(hu - LOW, h, z, u, c.low, c.nose, c);
    const d = T_TOP - hu;
    return d < 2 ? c.light : c.mid;
  };
}

/** Crush barriers across the terrace on posts, drawn over the fans as at the far side. */
function terraceBarriers(s: Surface, p: Paint, e: EndGeo, clipY: number): void {
  const { S, g } = p;
  const retro = p.era === "retro";
  // (NEXT-GEN's are glass rails lit along the top: nextgen-low.ts)
  const [hi, lo] =
    p.era === "nextgen"
      ? ngBarrierColors(p)
      : [
          S(retro ? shade(P.wood, 0.3) : P.steelHi),
          S(retro ? P.woodDark : P.steel),
        ];
  const { xA, y0, m, lean, grow } = e;
  const at = (u: number, hs: number): [number, number] => {
    const h = hs * (1 + grow * u);
    return [Math.round(xA + m * u + lean * h), Math.round(y0 + u - h)];
  };
  for (const hs of [LOW + 2 * ROW, LOW + 4 * ROW]) {
    for (let u = 2; u < g.h; u += 0.5) {
      const [x, y] = at(u, hs);
      if (x >= g.w || y + 2 > clipY) break;
      const seg = u % 24;
      if (seg > 17) continue;
      s.px(x, y, hi);
      s.px(x, y + 1, lo);
      // a post at either end of each length
      if (seg < 0.5 || (seg >= 14 && seg < 14.5)) {
        for (let k = 2; k < 6; k++) s.px(x, y + k, lo);
      }
    }
  }
}

/**
 * The corner between the side stand and the end, at the foot of the gap: a concourse
 * behind a railing, a gate, a lamp over it at night (rows `B` to `F`).
 */
function paintCorner(s: Surface, p: Paint, e: EndGeo): void {
  const { g, S } = p;
  const { xA, y0, m, lean } = e;
  // RETRO (tier 3): a cinder path behind a wooden fence
  const retro = p.era === "retro";
  const floor = S(retro ? mix(P.wood, P.concrete, 0.55) : P.concrete);
  const floorDark = S(
    retro ? mix(P.woodDark, P.concrete, 0.5) : P.concreteDark,
  );
  const rail = S(retro ? shade(P.wood, 0.3) : P.steelHi);
  const post = S(retro ? P.woodDark : P.steel);
  for (let Y = g.B; Y < g.F; Y++) {
    const xs = Y <= y0 ? xA + lean * (y0 - Y) : xA + m * (Y - y0);
    for (let X = e.corner; X < Math.ceil(xs) && X < g.w; X++) {
      const d = Y - g.B;
      let c = d < 2 ? floorDark : d < 3 ? floor : floorDark;
      if (d >= 3) {
        // the railing in front of the concourse: a lit rail, posts, the floor through it
        if (d === 4) c = rail;
        else if (d === 5) c = post;
        else if (d > 5 && (X - e.corner) % 6 === 0) c = post;
        else if (d > 5) c = d > 12 ? floorDark : floor;
      }
      s.px(X, Y, c);
    }
  }
  // the gate's lamp at night
  if (p.lamps) {
    const lx = e.corner + 6;
    if (lx < g.w) {
      s.px(lx, g.B + 1, P.goldLight);
      s.px(lx + 1, g.B + 1, P.goldLight);
    }
  }
}

/** Flags along the end's roof (an international, tiers 5 to 7): poles stepping down it. */
export function endFlags(p: Paint, life: Life, a: Color, b: Color): void {
  const { g, S } = p;
  const e = endFor(g);
  const start = Math.ceil(e.xA + e.lean * TOP) + 14;
  let n = 0;
  for (let x = start; x < g.w; x += 52) {
    const top = endTopAt(e, x, TOP);
    life.flags.push({
      x,
      top: top - 18,
      poleH: 18,
      w: 12,
      h: 8,
      a: S(n % 2 === 0 ? a : b),
      b: S(n % 2 === 0 ? b : a),
      pole: S(P.steelHi),
      phase: n + 3,
    });
    n++;
  }
}

/** The top of the end's roof in column `x` (the stadium), for beams and flags. */
export function endRoofAt(g: Geo, x: number): number {
  return endTopAt(endFor(g), x, TOP);
}
