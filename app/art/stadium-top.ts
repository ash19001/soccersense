/**
 * The home town from straight above (2026-11-18): FURTHEST's kick-off rises from the home
 * picture to a bird's-eye view of the stadium and its streets, then pulls back from it to
 * the Earth (menu.ts, ./earth-zoom.ts). The product owner: "Maybe the transition should be
 * making stadium birds eye view first and as it zooms out it can get pixelated too".
 *
 * It is the same town as the picture's: the plan (./stadium-plan.ts) seen from another
 * camera, the stadium as ./stadium-bowl.ts `bowlTopAt` sees it from above, and what the
 * picture stands on the plan as sprites drawn flat from above: the houses' roofs (ridged,
 * slate, tile or flat, a chimney at each party wall), trees with their shadows, the cars in
 * the car parks, the away coaches, the lamps on the pavements (lit at night).
 *
 * `TopTown` keeps it as a picture of TOP_AREA round the centre spot, a texel a unit, built a
 * slice at a time, and smaller copies of it, each half the last each way, every texel the
 * average of four snapped to the nearest of the picture's own colours: so it pixelates as it
 * pulls back, cleanly, and never sparkles. Its colours are daylight ones (the crowd already
 * in the club's): `TopTones` grades them for a light. `drawTopTilt` draws it from a camera
 * rising from the home picture's (PICTURE_TILT) to straight above, the centre spot kept
 * where it is. Pure, seeded.
 */

import { type Color, Surface, hash2, toRgb } from "~/pixel";

import type { Lighting } from "./lighting";
import { P } from "./palette";
import { bowlTopAt, gOut } from "./stadium-bowl";
import type { ClubScheme } from "./stadium-club";
import {
  BLOCKS,
  CARPARK,
  COACHES,
  CONCOURSE,
  HOUSES_SW,
  KICKABOUT,
  LOT,
  NORTH_LOT,
  OLD_TOWN,
  PARK,
  PLAZA_HALF,
  RAIL,
  ROAD,
  SCHOOL,
  STREET,
  TERRACE,
  WATER,
  WATER_HI,
  WATER_LO,
  groundAt,
  streets,
} from "./stadium-plan";
import { A, ZC } from "./stadium-view";

/** A lamp on a pavement: steel by day, lit at night (graded by TopTones). */
export const LAMP = -4;

/** What is at a point from above: a daylight colour or a marker, and whether it is floodlit. */
export interface TopHit {
  c: number;
  lit: boolean;
}
const hit: TopHit = { c: P.grass, lit: false };

/** The cars in the car parks. */
const CARS: readonly Color[] = [
  P.chalk,
  P.white,
  P.slate,
  P.home,
  P.furthest,
  P.gold,
  P.steelHi,
  P.awayDark,
  P.concrete,
  P.homeDark,
  P.ink,
  P.grassDark,
];

/** Trees: one a cell this size at most, its crown this big. */
const TREE_CELL = 11;
const CROWN = 2.6;
/** North of this the town is streets of houses (the river and its banks are south of it). */
const PAST_RIVER = 262;
/** Lamps along the pavements: one in a cell this size at most. */
const LAMP_CELL = 16;

function mod(a: number, n: number): number {
  return ((a % n) + n) % n;
}

/**
 * The town from straight above at (X, V): `s` pixels a unit (so nothing narrow falls
 * between pixels), `swap` and `club` the day's colours for the crowd. The hit is shared:
 * read it before the next call.
 */
export function topAt(
  X: number,
  V: number,
  s: number,
  seed: number,
  swap: (c: Color) => Color,
  club?: ClubScheme,
): TopHit {
  const bowl = bowlTopAt(X, V, s, seed, swap, club);
  if (bowl) {
    hit.c = bowl.c;
    hit.lit = bowl.lit;
    return hit;
  }
  // the plan's plaza and car park run on south for ever, and beyond the river it is the
  // far town of a picture seen from the ground: past them, more streets of houses
  const past =
    V > PAST_RIVER || (V < CARPARK.v0 && X >= -PLAZA_HALF && X < CARPARK.x1);
  let c: number;
  if (past) {
    c = streets(X, V, s, seed);
    hit.lit = false;
  } else {
    const g = groundAt(X, V, s, seed);
    c = g.c;
    hit.lit = g.lit;
  }
  hit.c = c;
  if (c === P.concrete && (past || roofZone(X, V))) {
    hit.c = roofAt(X, V, s, seed, past);
    hit.lit = false;
    return hit;
  }
  if (c === P.grass || c === P.grassLight) {
    const t = treeAt(X, V, c, seed);
    if (t >= 0) hit.c = t;
    return hit;
  }
  if (c === P.concrete || c === P.concreteDark) {
    const v = vehicleAt(X, V, s, seed);
    if (v >= 0) hit.c = v;
    return hit;
  }
  if (c === P.concreteLight && s >= 0.9) {
    const i = Math.floor(X / LAMP_CELL);
    const j = Math.floor(V / LAMP_CELL);
    if (hash2(i, j, seed + 70) < 0.5) {
      // on a pixel's middle, so that one pixel is the lamp
      const dx = X - (i + 0.5) * LAMP_CELL - 0.5;
      const dv = V - (j + 0.5) * LAMP_CELL - 0.5;
      const r = Math.max(0.7, 0.5 / s);
      if (dx * dx + dv * dv < r * r) hit.c = LAMP;
    }
  }
  return hit;
}

/** Whether the plan's concrete here is houses (their roofs, from above) and not paving. */
function roofZone(X: number, V: number): boolean {
  if (gOut(X, V) <= CONCOURSE) return false;
  if (Math.abs(X) <= PLAZA_HALF && V < -96) return false;
  if (V >= RAIL.v0 && V <= RAIL.v1) return false;
  if (V < ROAD.stadiumV0 && X > PLAZA_HALF && X < CARPARK.x1) return false;
  if (X >= COACHES.x0 && X <= COACHES.x1 && V <= ROAD.northV0) return false;
  if (X >= -24 && X < 150 && V > ROAD.northV1 && V < RAIL.v0) return false;
  return true;
}

/**
 * A roof: its ridge along the terrace, the north slope lit and the south one in shade, slate
 * or tile or flat by the house, a chimney on the ridge at each party wall.
 */
function roofAt(
  X: number,
  V: number,
  s: number,
  seed: number,
  past: boolean,
): Color {
  let across: number;
  let along: number;
  let lot: number;
  if (V > 192 && !past) {
    const { w, h, x, v, roadH } = OLD_TOWN;
    across = mod(V - v, h) - (roadH + h) / 2;
    along = X + x;
    lot =
      Math.floor(along / LOT) * 7 +
      Math.floor((V - v) / h) * 131 +
      Math.floor(along / w);
  } else if (V < ROAD.stadiumV0 && X < -PLAZA_HALF && X > ROAD.aveX1) {
    const d = ROAD.stadiumV0 - V;
    across = (TERRACE.pavement + TERRACE.houses) / 2 - mod(d, STREET);
    along = X - HOUSES_SW.x0;
    lot = Math.floor(along / LOT) + Math.floor(d / STREET) * 64;
  } else {
    const { w, h, x, v, road, houses } = BLOCKS;
    const lv = mod(V + v, h) - road;
    across = lv < houses ? lv - houses / 2 : lv - (h - road - houses / 2);
    along = mod(X + x, w) - road;
    const block = Math.floor((X + x) / w) * 31 + Math.floor((V + v) / h);
    lot = Math.floor(along / LOT) + block * 16 + (lv > h / 2 ? 8 : 0);
  }
  const line = Math.max(1, 1 / s);
  const kind = hash2(lot, 21, seed);
  const inLot = mod(along, LOT);
  if (s >= 0.9 && Math.abs(across) < 1.3 && inLot < 1.5) return P.brickDark;
  if (s >= 0.9 && Math.abs(across) < line / 2) return P.mist;
  const lit = across > 0;
  if (kind < 0.68) return lit ? P.steel : P.slate;
  if (kind < 0.9) return lit ? P.brick : P.brickDark;
  return lit ? P.concreteLight : P.concrete;
}

/** How likely a tree is in a cell here: many in the park, some on verges, a few in gardens. */
function treeChance(X: number, V: number): number {
  if (X >= PARK.x0 && X <= PARK.x1 && V >= PARK.v0 && V <= PARK.v1) {
    const kick =
      X > KICKABOUT.x0 - 4 &&
      X < KICKABOUT.x1 + 4 &&
      V > KICKABOUT.v0 - 4 &&
      V < KICKABOUT.v1 + 4;
    return kick ? 0 : 0.55;
  }
  if (X > SCHOOL.x0 && X < SCHOOL.x1 && V > SCHOOL.v0 && V < SCHOOL.v1)
    return 0;
  if (V > ROAD.northV1 && V < RAIL.v0) return 0;
  return V > 192 ? 0.08 : 0.2;
}

/** A tree's crown (lit from the top left) or its shadow on the grass, or -1. */
function treeAt(X: number, V: number, under: number, seed: number): number {
  // the avenue's trees, down its middle
  const mid = (ROAD.aveX0 + ROAD.aveX1) / 2;
  let cx: number;
  let cv: number;
  let r: number;
  if (Math.abs(X - mid) < 3) {
    cx = mid;
    cv = Math.round(V / 10) * 10;
    r = 2.4;
  } else {
    const i = Math.floor(X / TREE_CELL);
    const j = Math.floor(V / TREE_CELL);
    if (!(hash2(i, j, seed + 50) < treeChance(X, V))) return -1;
    cx = (i + 0.35 + 0.3 * hash2(i, j, seed + 51)) * TREE_CELL;
    cv = (j + 0.35 + 0.3 * hash2(i, j, seed + 52)) * TREE_CELL;
    r = CROWN + 1.2 * hash2(i, j, seed + 53);
  }
  const dx = X - cx;
  const dv = V - cv;
  if (dx * dx + dv * dv <= r * r) {
    const toLight = dv - dx;
    return toLight > r * 0.55
      ? P.grassLight
      : toLight < -r * 0.35
        ? P.grassDeep
        : P.grassDark;
  }
  const sx = dx - 1.6;
  const sv = dv + 1.6;
  if (sx * sx + sv * sv <= r * r) {
    return under === P.grassLight ? P.grass : P.grassDark;
  }
  return -1;
}

/** A car in a bay of the car parks, or an away coach in the coach park, or -1. */
function vehicleAt(X: number, V: number, s: number, seed: number): number {
  if (
    V < ROAD.stadiumV0 &&
    V >= CARPARK.v0 &&
    X > PLAZA_HALF &&
    X < CARPARK.x1
  ) {
    const d = ROAD.stadiumV0 - V;
    if (d < 4.5) return -1;
    const row = mod(d - 3.2, 22);
    const first = row < 7;
    const inRow = first ? row : row - 12;
    if (!(first || (row >= 12 && row < 19))) return -1;
    return carAt(
      X - 62,
      inRow,
      7,
      Math.floor((d - 3.2) / 22) * 2 + (first ? 0 : 1),
      first,
      s,
      seed,
    );
  }
  if (
    X >= NORTH_LOT.x0 &&
    X <= NORTH_LOT.x1 &&
    V >= NORTH_LOT.v0 &&
    V <= NORTH_LOT.v1
  ) {
    const row = mod(V - 131, 13);
    const first = row < 5;
    if (!(first || row >= 8)) return -1;
    return carAt(
      X - NORTH_LOT.x0,
      first ? row : row - 8,
      5,
      first ? 100 : 101,
      !first,
      s,
      seed,
    );
  }
  if (X >= COACHES.x0 && X <= COACHES.x1 && V <= ROAD.northV0) {
    const bay = Math.floor((V + 400) / 6.5);
    const bv = mod(V + 400, 6.5);
    if (X < -221 || X > -187 || bv < 1.1 || bv > 5.4) return -1;
    if (!(hash2(bay, 3, seed + 61) < 0.55)) return -1;
    if (X > -190) return P.ink;
    return X > -212 && X < -196 && bv > 2.4 && bv < 4.1 ? P.awayLight : P.away;
  }
  return -1;
}

/**
 * A car in a row of bays four units wide and `deep` deep: `x` along the row, `y` into the
 * bay; its windscreen towards the aisle (`front` if the aisle is at the bay's far end).
 */
function carAt(
  x: number,
  y: number,
  deep: number,
  rowId: number,
  front: boolean,
  s: number,
  seed: number,
): number {
  const col = Math.floor(x / 4);
  const fx = mod(x, 4);
  if (fx < 0.6 || fx > 3.4 || y < 0.7 || y > deep - 0.7) return -1;
  if (!(hash2(col, rowId, seed + 60) < 0.72)) return -1;
  const body = CARS[Math.floor(hash2(col, rowId, seed + 62) * CARS.length)];
  if (s >= 1.4) {
    const glass = front ? deep - 2.4 : 1.6;
    if (y > glass && y < glass + 0.9) return P.ink;
  }
  return body;
}

// ---------------------------------------------------------------------------
// The picture of it
// ---------------------------------------------------------------------------

/**
 * What the bird's-eye picture keeps, in units round the centre spot (x east, v north): a
 * texel a unit here, round the stadium...
 */
export const TOP_AREA = { x0: -352, x1: 352, v0: -224, v1: 288 } as const;
/** ...and OUTER_SCALE units a texel out to here, the town round it. */
export const OUTER_AREA = { x0: -1408, x1: 1408, v0: -896, v1: 1152 } as const;
const OUTER_SCALE = 4;
/**
 * Nothing but streets of houses, east of the park and south of the ground: ten blocks by ten
 * of the plan's grid (BLOCKS), from a corner of one. The plan's streets repeat, so the town
 * beyond the picture is this, over and over (suburbAt).
 */
const SUBURB = {
  x0: 387,
  v0: -862,
  w: BLOCKS.w * 10,
  h: BLOCKS.h * 10,
} as const;
/** In an index, the bit for "the floodlights reach it". */
const LIT_BIT = 0x8000;
/** Texels built a slice. */
const SLICE = 6000;

/** One layer of the picture: its texels, a level per halving, rows from the north. */
interface Layer {
  x0: number;
  v1: number;
  /** Units a texel at level 0. */
  scale: number;
  levels: Uint16Array[];
  widths: number[];
  heights: number[];
}

function layerAt(l: Layer, X: number, V: number, level: number): number {
  const L = Math.min(level, l.levels.length - 1);
  if (L < 0) return -1;
  const size = l.scale * (1 << L);
  const i = Math.floor((X - l.x0) / size);
  const j = Math.floor((l.v1 - V) / size);
  const w = l.widths[L];
  if (i < 0 || j < 0 || i >= w || j >= l.heights[L]) return -1;
  return l.levels[L][j * w + i];
}

/** The light's colours for a picture's daylight ones (and its markers), made once a light. */
export class TopTones {
  /** Graded colour by index: the sky's light, then the floodlit ones after them. */
  readonly table: Uint32Array;
  constructor(
    readonly town: TopTown,
    readonly light: Lighting,
  ) {
    const n = town.colors.length;
    this.table = new Uint32Array(n * 2);
    for (let i = 0; i < n; i++) {
      const c = town.colors[i];
      this.table[i] = grade(c, light, false);
      this.table[i + n] = grade(c, light, true);
    }
  }
  /** The graded colour of an index from TopTown.at (not -1). */
  color(idx: number): Color {
    const n = this.town.colors.length;
    return (
      idx & LIT_BIT ? this.table[(idx & ~LIT_BIT) + n] : this.table[idx]
    ) as Color;
  }
}

function grade(c: number, light: Lighting, lit: boolean): Color {
  if (c === WATER) return light.env(P.skyMid);
  if (c === WATER_HI) return light.env(P.skyLow);
  if (c === WATER_LO) return light.env(P.skyTop);
  if (c === LAMP) return light.lightsOn ? P.amber : light.env(P.steel);
  return lit ? light.lit(c as Color) : light.env(c as Color);
}

/** The daylight colour a marker stands for when texels are averaged. */
function proxy(c: number): Color {
  if (c === WATER) return P.skyMid;
  if (c === WATER_HI) return P.skyLow;
  if (c === WATER_LO) return P.skyTop;
  if (c === LAMP) return P.concreteLight;
  return c as Color;
}

/**
 * The bird's-eye picture of the home town: a texel a unit round the stadium, and coarser
 * round that, each with its smaller copies. Their edges are ragged, so neither shows as a
 * box.
 */
export class TopTown {
  readonly inner: Layer;
  readonly outer: Layer;
  /** The picture's colours: daylight ones, or markers. */
  readonly colors: number[] = [];
  private readonly index = new Map<number, number>();
  /** Whether the outer layer is built, so that suburbAt can repeat its streets. */
  private tiled = false;
  private readonly job: Generator<void, void, void>;
  private finished = false;

  constructor(
    readonly seed: number,
    readonly swap: (c: Color) => Color,
    readonly club?: ClubScheme,
  ) {
    const layer = (
      a: typeof TOP_AREA | typeof OUTER_AREA,
      scale: number,
    ): Layer => ({
      x0: a.x0,
      v1: a.v1,
      scale,
      levels: [],
      widths: [],
      heights: [],
    });
    this.inner = layer(TOP_AREA, 1);
    this.outer = layer(OUTER_AREA, OUTER_SCALE);
    this.job = this.build();
  }

  /** Whether it is all built. */
  get done(): boolean {
    return this.finished;
  }

  /** Build a slice more. True when it is all built. */
  step(): boolean {
    if (!this.finished && this.job.next().done) this.finished = true;
    return this.finished;
  }

  /** Build the rest now. */
  finish(): void {
    while (!this.step()) {
      // building
    }
  }

  /**
   * The index at (X, V) for texels of 2^level units (0: a unit), or -1 where the picture
   * does not reach: the fine layer, inside its ragged edge, and then the coarse one.
   */
  at(X: number, V: number, level: number): number {
    const e =
      10 + 30 * hash2(Math.floor(X / 24), Math.floor(V / 24), this.seed + 80);
    if (
      X > TOP_AREA.x0 + e &&
      X < TOP_AREA.x1 - e &&
      V > TOP_AREA.v0 + e &&
      V < TOP_AREA.v1 - e
    ) {
      return layerAt(this.inner, X, V, level);
    }
    const o =
      40 + 120 * hash2(Math.floor(X / 96), Math.floor(V / 96), this.seed + 81);
    if (
      X > OUTER_AREA.x0 + o &&
      X < OUTER_AREA.x1 - o &&
      V > OUTER_AREA.v0 + o &&
      V < OUTER_AREA.v1 - o
    ) {
      return layerAt(this.outer, X, V, Math.max(0, level - 2));
    }
    return -1;
  }

  private indexOf(c: number): number {
    let i = this.index.get(c);
    if (i === undefined) {
      i = this.colors.length;
      this.colors.push(c);
      this.index.set(c, i);
    }
    return i;
  }

  /** A layer's level 0: the town sampled once a texel, at its middle. */
  private *base(
    l: Layer,
    area: typeof TOP_AREA | typeof OUTER_AREA,
  ): Generator<void, void, void> {
    const w = Math.round((area.x1 - area.x0) / l.scale);
    const h = Math.round((area.v1 - area.v0) / l.scale);
    const texels = new Uint16Array(w * h);
    l.levels.push(texels);
    l.widths.push(w);
    l.heights.push(h);
    const s = 1 / l.scale;
    let n = 0;
    for (let j = 0; j < h; j++) {
      const V = l.v1 - (j + 0.5) * l.scale;
      for (let i = 0; i < w; i++) {
        const t = topAt(
          l.x0 + (i + 0.5) * l.scale,
          V,
          s,
          this.seed,
          this.swap,
          this.club,
        );
        const idx = this.indexOf(t.c);
        texels[j * w + i] = t.lit ? idx | LIT_BIT : idx;
      }
      n += w;
      if (n >= SLICE) {
        n = 0;
        yield;
      }
    }
  }

  /** A layer's smaller copies: each texel the average of four, snapped to the nearest colour. */
  private *copies(
    l: Layer,
    nearest: (r: number, g: number, b: number) => number,
    rgbs: [number, number, number][],
  ): Generator<void, void, void> {
    let pw = l.widths[0];
    let ph = l.heights[0];
    let prev = l.levels[0];
    let n = 0;
    while (pw > 4 && ph > 4) {
      const lw = Math.ceil(pw / 2);
      const lh = Math.ceil(ph / 2);
      const next = new Uint16Array(lw * lh);
      for (let j = 0; j < lh; j++) {
        for (let i = 0; i < lw; i++) {
          let r = 0;
          let g = 0;
          let b = 0;
          let lit = 0;
          for (let q = 0; q < 4; q++) {
            const ci = Math.min(pw - 1, i * 2 + (q & 1));
            const cj = Math.min(ph - 1, j * 2 + (q >> 1));
            const v = prev[cj * pw + ci];
            const c = rgbs[v & ~LIT_BIT];
            r += c[0];
            g += c[1];
            b += c[2];
            if (v & LIT_BIT) lit++;
          }
          const k = nearest(r >> 2, g >> 2, b >> 2);
          next[j * lw + i] = lit >= 2 ? k | LIT_BIT : k;
        }
        n += lw;
        if (n >= SLICE * 2) {
          n = 0;
          yield;
        }
      }
      l.levels.push(next);
      l.widths.push(lw);
      l.heights.push(lh);
      prev = next;
      pw = lw;
      ph = lh;
    }
  }

  private *build(): Generator<void, void, void> {
    yield* this.base(this.inner, TOP_AREA);
    yield* this.base(this.outer, OUTER_AREA);
    const rgbs = this.colors.map((c) => toRgb(proxy(c)));
    const near = new Map<number, number>();
    const nearest = (r: number, g: number, b: number): number => {
      const key = ((r >> 2) << 12) | ((g >> 2) << 6) | (b >> 2);
      let best = near.get(key);
      if (best !== undefined) return best;
      let bd = Infinity;
      best = 0;
      for (let k = 0; k < rgbs.length; k++) {
        if (this.colors[k] === LAMP) continue;
        const q = rgbs[k];
        const d = (q[0] - r) ** 2 + (q[1] - g) ** 2 + (q[2] - b) ** 2;
        if (d < bd) {
          bd = d;
          best = k;
        }
      }
      near.set(key, best);
      return best;
    };
    yield* this.copies(this.inner, nearest, rgbs);
    yield* this.copies(this.outer, nearest, rgbs);
    this.tiled = true;
  }

  /**
   * A town beyond the picture: the picture's streets of houses (SUBURB) over and over, in
   * texels of 2^level units as `at` gives them. -1 before it is built.
   */
  suburbAt(X: number, V: number, level: number): number {
    if (!this.tiled) return -1;
    const x = SUBURB.x0 + mod(X - SUBURB.x0, SUBURB.w);
    const v = SUBURB.v0 + mod(V - SUBURB.v0, SUBURB.h);
    return layerAt(this.outer, x, v, Math.max(0, level - 2));
  }
}

/** The level for texels of about `foot` units a pixel: the one no smaller than it. */
export function levelFor(foot: number): number {
  return foot <= 1 ? 0 : Math.ceil(Math.log2(foot) - 0.25);
}

// ---------------------------------------------------------------------------
// The camera rising over it
// ---------------------------------------------------------------------------

/** The home picture's camera: A units up and ZC back from the centre spot (stadium-view.ts). */
export const PICTURE_TILT = Math.atan2(A, ZC);
const CAMERA_R = Math.hypot(A, ZC);

export interface TopCamera {
  /** The centre spot on the screen. */
  cx: number;
  cy: number;
  /** Pixels a unit across at the centre spot. */
  k: number;
  /** How high the camera looks down from: PICTURE_TILT (the picture's) to PI / 2 (straight down). */
  tilt: number;
}

/**
 * The picture as `cam` sees it, in `tones`, over `s`: only where it sees the kept area,
 * leaving the rest of `s` as it was (the sky, and beyond).
 */
export function drawTopTilt(
  s: Surface,
  town: TopTown,
  tones: TopTones,
  cam: TopCamera,
): void {
  const f = cam.k * CAMERA_R;
  const sinT = Math.sin(cam.tilt);
  const cosT = Math.cos(cam.tilt);
  const data = s.data;
  const table = tones.table;
  const n = town.colors.length;
  for (let y = 0; y < s.h; y++) {
    const dy = cam.cy - (y + 0.5);
    const den = f * sinT - dy * cosT;
    if (den <= 1e-6) continue;
    // units a pixel along this row, and the row's depth
    const t = (CAMERA_R * sinT) / den;
    const V = -CAMERA_R * cosT + t * (f * cosT + dy * sinT);
    if (V <= OUTER_AREA.v0 || V >= OUTER_AREA.v1) continue;
    const level = levelFor(t);
    const row = y * s.w;
    for (let x = 0; x < s.w; x++) {
      const idx = town.at(t * (x + 0.5 - cam.cx), V, level);
      if (idx < 0) continue;
      data[row + x] = idx & LIT_BIT ? table[(idx & ~LIT_BIT) + n] : table[idx];
    }
  }
}

/** The kept area's colours, for tests: an index's daylight colour or marker. */
export function colorOf(town: TopTown, idx: number): number {
  return town.colors[idx & ~LIT_BIT];
}
