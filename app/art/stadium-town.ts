/**
 * Paints everything that does not move: the land from the horizon down, the town on it,
 * and the stadium in the middle. Back to front, in final colours.
 *
 * The ground comes first, straight from the plan (stadium-plan.ts), then pools of lamplight at
 * night, then every object in the town sorted by depth, the stadium among them.
 */

import { Surface, bayer4, hash2, mix, type Color } from "~/pixel";
import { distant, skyFor, type Lighting } from "~/art/lighting";
import { P } from "~/art/palette";
import { BAYS, paintBowlSteps, wallPoint, type Bowl } from "~/art/stadium-bowl";
import {
  DEFAULT_SCHEME,
  clubOf,
  clubRaw,
  type ClubScheme,
} from "~/art/stadium-club";
import {
  CARPARK,
  COACHES,
  COACH_BAY,
  HOUSES_SW,
  LOT,
  PARK,
  PLAZA_HALF,
  POND,
  RAIL,
  ROAD,
  STATION,
  STREET,
  WATER,
  WATER_HI,
  WATER_LO,
  groundAt,
  riverMid,
} from "~/art/stadium-plan";
import {
  BAND,
  BAYS_PER_ROW,
  GATE,
  LOT_TOP,
  bayX,
  rowDir,
  rowV,
  staticCar,
} from "~/art/stadium-parking";
import { EAST, mapHeading } from "~/art/stadium-cars";
import { sizeStep } from "~/art/traffic-steps";
import { paintSkyline } from "~/art/stadium-skyline";
import {
  box,
  bush,
  car,
  castOn,
  coach,
  drawBin,
  drawBollard,
  drawChimney,
  drawDoor,
  drawLamp,
  drawParasol,
  drawWindow,
  lampHeight,
  type LampLook,
  conifer,
  lightPool,
  logShadows,
  person,
  shadowBlob,
  ShadowLog,
  tree,
  type BoxLook,
  type CarLook,
  type CoachLook,
  type PersonLook,
  type TreeLook,
} from "~/art/stadium-things";
import {
  ZC,
  depthAtRow,
  hazeAt,
  project,
  rowAt,
  scaleAt,
  sizeClass,
  type Spot,
  type View,
} from "~/art/stadium-view";

/** What a painter of static things draws with. */
export interface Pen {
  s: Surface;
  view: View;
  light: Lighting;
  seed: number;
  night: boolean;
  /** A daylight colour as the sky lights it at depth V (hazier with distance). */
  tone(c: Color, V: number): Color;
  /** A daylight colour under the floodlights. */
  lit(c: Color): Color;
}

interface Item {
  V: number;
  draw(): void;
  /** The stadium: it stamps its own depth. */
  bowl?: boolean;
}

interface Ctx extends Pen {
  items: Item[];
  /** Hash of two integers with this picture's seed. */
  h(a: number, b: number): number;
}

export interface Town {
  /** The land, opaque, for rows `top` and below. */
  land: Surface;
  top: number;
  /** The hills and whatever else stands against the sky: transparent where the sky shows. */
  skyline: Surface;
  skylineY: number;
  bowl: Bowl;
  /** Chimneys that smoke: the top of each, on screen. */
  chimneys: { x: number; y: number; big: boolean }[];
  /** Wind turbines on the hills: the hub of each. */
  turbines: { x: number; y: number }[];
  /** Blinking lights (masts, cranes): on screen. */
  beacons: { x: number; y: number }[];
  /** The floodlight heads: the middle of each, on screen. */
  pylons: { x: number; y: number }[];
  /**
   * The lamps lit: each street lamp's pool of light on the ground (lightPool's centre and
   * radii, on screen), for the shadows of what passes through it (stadium-life.ts). Empty
   * by day.
   */
  pools: LampPool[];
  /**
   * For every pixel of the screen, how far away (V) the static thing painted there is:
   * very far for the bare ground. Moving things are hidden by anything nearer.
   */
  depth: Float32Array;
}

/** A street lamp's pool of light on screen (Town.pools), and how tall its lamp stands. */
export interface LampPool {
  x: number;
  y: number;
  rx: number;
  ry: number;
  /** The lamp's height over its foot, in pixels (stadium-things.ts `lampHeight`). */
  lamp: number;
}

/** The depth masks of the last two views (paintTown): never written once made. */
const depthMasks: { key: string; depth: Float32Array }[] = [];
const EMPTY_DEPTH = new Float32Array(0);

const SKYLINE_H = 40;
/** Where the stadium sits in the painting order: behind everything on its near concourse. */
const BOWL_V = -58;

/**
 * Draw every item, far to near, and note in the depth mask which pixels each slice of
 * depth painted (by comparing the rows it can reach before and after). A pixel only the
 * slice's shadows darkened is still bare ground (`log`): a tree's shadow on the road
 * must not hide a car driving through it, nor a van's shadow the queue at its hatch.
 * A generator: it pauses after every `slice` items or so (a few milliseconds), and the
 * caller sets the shadows' surface and log around each run (stadium-life.ts `castOn`).
 */
function* drawItems(
  c: Ctx,
  town: Town,
  log: ShadowLog,
): Generator<void, void, void> {
  const { s, view } = c;
  const { w, h } = view;
  const items = c.items;
  items.sort((a, b) => b.V - a.V);
  const data = s.data;
  const depth = town.depth;
  const prev = new Uint32Array(w * h);
  // a pause every few items, or every few groups (each compares a band of rows)
  const slice = Math.max(40, Math.ceil(items.length / 10));
  let drawn = 0;
  let groups = 0;
  let i = 0;
  while (i < items.length) {
    if (drawn >= slice || groups >= 3) {
      drawn = 0;
      groups = 0;
      yield;
    }
    const first = items[i];
    if (first.bowl) {
      first.draw();
      const b = town.bowl;
      for (let y = 0; y < b.layer.h; y++) {
        const sy = b.y + y;
        if (sy < 0 || sy >= h) continue;
        for (let x = 0; x < b.layer.w; x++) {
          const sx = b.x + x;
          if (sx < 0 || sx >= w) continue;
          if (b.layer.data[y * b.layer.w + x] !== 0)
            depth[sy * w + sx] = BOWL_V;
        }
      }
      i++;
      drawn += slice;
      continue;
    }
    const far = first.V > 190;
    const lo = far ? 190 : first.V - 3;
    let j = i + 1;
    while (j < items.length && items[j].V > lo && !items[j].bowl) j++;
    const y0 = far
      ? 0
      : Math.max(
          0,
          Math.min(
            h,
            Math.floor(rowAt(view, first.V) - 54 * scaleAt(view, first.V)) - 3,
          ),
        );
    const y1 = Math.max(y0, Math.min(h, Math.ceil(rowAt(view, lo - 9)) + 5));
    prev.set(data.subarray(y0 * w, y1 * w), y0 * w);
    log.now++;
    for (let n = i; n < j; n++) items[n].draw();
    for (let p = y0 * w; p < y1 * w; p++) {
      if (data[p] !== prev[p] && !log.onlyShadow(p, prev[p])) depth[p] = lo;
    }
    drawn += j - i;
    groups++;
    i = j;
  }
}

/**
 * The town for this view, light and seed. When the same view was painted before (in any
 * light: the lamps coming on too), a change of light does not stop the picture: the town
 * comes back at once with the last picture in it, and the new one is built a slice a
 * frame (`advanceTown`, called by the life's draw) and swapped in whole when it is done.
 * Otherwise it is painted at once.
 */
export function paintTown(view: View, light: Lighting, seed: number): Town {
  const steps = townSteps(view, light, seed);
  const key = `${townKey(view, seed)}:${light.lightsOn}`;
  const last = lastTown;
  // only for the same view (the same picture, relit: a new size or a new backdrop makes a
  // new view and is painted at once). The lamps coming on or going off are relit the same
  // way: the depth mask of the new kind of light is made a slice a frame too.
  if (
    last !== null &&
    last.view === view &&
    last.base === townKey(view, seed)
  ) {
    // its own bowl, so filling it in later touches no other town
    const town: Town = { ...last.town, bowl: { ...last.town.bowl } };
    // the first slice waits a frame: the frame of the change repaints the rest of the picture
    pending.set(
      town,
      (function* () {
        yield;
        return yield* steps;
      })(),
    );
    lastTown = { key, base: townKey(view, seed), town, view };
    return town;
  }
  let r = steps.next();
  while (!r.done) r = steps.next();
  lastTown = { key, base: townKey(view, seed), town: r.value, view };
  return r.value;
}

/**
 * One slice of a town still being built (`paintTown`): a few milliseconds of work. When
 * the last slice is done the new picture is swapped into `town` (and its bowl) in one go.
 * Nothing to do for a town that is finished.
 */
export function advanceTown(town: Town): void {
  const steps = pending.get(town);
  if (!steps) return;
  const r = steps.next();
  if (!r.done) return;
  pending.delete(town);
  const made = r.value;
  // the life drawn over it holds the bowl: it is filled in place
  Object.assign(town.bowl, made.bowl);
  Object.assign(town, { ...made, bowl: town.bowl });
}

/** Whether `town` is still being built (it shows the last picture until it is done). */
export function townPending(town: Town): boolean {
  return pending.has(town);
}

const pending = new WeakMap<Town, Generator<void, Town, void>>();
let lastTown: {
  key: string;
  base: string;
  town: Town;
  view: View;
} | null = null;

function townKey(view: View, seed: number): string {
  return `${view.w}x${view.h}:${view.k}:${view.cx}:${view.yc}:${view.hy}:${seed}`;
}

/** paintTown's work, in slices of a few milliseconds each at 960 x 540. */
function* townSteps(
  view: View,
  light: Lighting,
  seed: number,
): Generator<void, Town, void> {
  const { w, h, hy } = view;
  const s = new Surface(w, h);
  const night = light.lightsOn;
  const c: Ctx = {
    s,
    view,
    light,
    seed,
    night,
    tone: (col, V) => distant(light, col, hazeAt(view, V)),
    lit: light.lit,
    items: [],
    h: (a, b) => hash2(a, b, seed),
  };
  const town: Town = {
    land: s,
    top: hy,
    skyline: s,
    skylineY: 0,
    bowl: null as unknown as Bowl,
    chimneys: [],
    turbines: [],
    beacons: [],
    pylons: [],
    pools: [],
    depth: EMPTY_DEPTH,
  };

  paintHills(c, town);
  // the city stays under the logo zone, however short the screen
  s.pushClip(0, view.logoH, w, h);
  town.beacons.push(...paintSkyline(s, view, light, seed));
  s.popClip();
  yield;
  yield* paintGround(c);
  if (night) paintPools(c, town);
  yield;

  const bowl = yield* paintBowlSteps(
    view,
    {
      lit: light.lit,
      env: light.env,
      lightsOn: night,
      sunny: light.sun.elevation > 3,
      club: clubOf(light),
      raw: clubRaw(light),
    },
    seed,
  );
  town.bowl = bowl;
  c.items.push({
    V: BOWL_V,
    bowl: true,
    draw: () => s.blit(bowl.layer, bowl.x, bowl.y),
  });
  yield;

  farTown(c, town);
  northStrip(c);
  westSide(c);
  eastSide(c);
  southWest(c, town);
  southEast(c);
  concourse(c, town);
  lamps(c);
  yield;

  // The depth mask is the same for every light of a kind (day or night: lit windows and the
  // floodlights' glow add pixels), so a change of light draws the items without noting it.
  const depthKey = `${townKey(view, seed)}:${night}`;
  const knownDepth = depthMasks.find((d) => d.key === depthKey);
  if (knownDepth) {
    town.depth = knownDepth.depth;
    const items = c.items;
    items.sort((a, b) => b.V - a.V);
    const slice = Math.max(40, Math.ceil(items.length / 10));
    for (let i = 0; i < items.length; i += slice) {
      castOn(s);
      try {
        for (let j = i; j < Math.min(items.length, i + slice); j++) {
          items[j].draw();
        }
      } finally {
        castOn(null);
      }
      yield;
    }
  } else {
    town.depth = new Float32Array(w * h).fill(1e9);
    const log = new ShadowLog(s);
    const steps = drawItems(c, town, log);
    for (;;) {
      castOn(s);
      logShadows(log);
      let r: IteratorResult<void, void>;
      try {
        r = steps.next();
      } finally {
        logShadows(null);
        castOn(null);
      }
      if (r.done) break;
      yield;
    }
    depthMasks.unshift({ key: depthKey, depth: town.depth });
    if (depthMasks.length > 2) depthMasks.length = 2;
  }

  const landH = Math.max(1, h - hy);
  const land = new Surface(w, landH);
  land.blit(s, 0, -hy);
  // Anything still unpainted in the land (it should not be) takes the haze.
  const haze = distant(light, P.grassDark, 1);
  for (let i = 0; i < land.data.length; i++) {
    if (land.data[i] === 0) land.data[i] = haze;
  }
  const skylineY = Math.max(0, hy - SKYLINE_H * 2);
  const skyline = new Surface(w, Math.max(1, hy - skylineY));
  skyline.blit(s, 0, -skylineY);
  town.land = land;
  town.skyline = skyline;
  town.skylineY = skylineY;
  return town;
}

// ---------------------------------------------------------------------------
// The ground
// ---------------------------------------------------------------------------

/**
 * What the plan says is on each pixel of the ground, for one view and seed: it does not
 * depend on the light, so a change of light (every couple of minutes) only recolours it.
 * `idx` is an index into `colors` (the plan's daylight colours, or a water marker) plus
 * LIT_BIT when the floodlights reach it; `step` is each pixel's haze step.
 */
interface GroundPlan {
  key: string;
  idx: Uint16Array;
  step: Uint8Array;
  colors: number[];
}
const LIT_BIT = 0x8000;
const groundPlans: GroundPlan[] = [];

function groundPlan(c: Ctx): GroundPlan {
  const { view, seed } = c;
  const { w, h, hy, cx, k } = view;
  const key = `${w}x${h}:${k}:${cx}:${view.yc}:${hy}:${seed}`;
  const known = groundPlans.find((g) => g.key === key);
  if (known) return known;
  const n = Math.max(0, h - hy) * w;
  const idx = new Uint16Array(n);
  const stepOf = new Uint8Array(n);
  const colors: number[] = [];
  const index = new Map<number, number>();
  for (let y = hy; y < h; y++) {
    const V = depthAtRow(view, y + 0.5);
    const sc = (k * ZC) / (ZC + V);
    const e = hazeAt(view, V) * 8;
    const lo = Math.floor(e);
    const f = e - lo;
    const row = (y - hy) * w;
    for (let x = 0; x < w; x++) {
      const X = (x + 0.5 - cx) / sc;
      const g = groundAt(X, V, sc, seed);
      let i = index.get(g.c);
      if (i === undefined) {
        i = colors.length;
        colors.push(g.c);
        index.set(g.c, i);
      }
      idx[row + x] = g.lit ? i | LIT_BIT : i;
      stepOf[row + x] = f > 0.25 + 0.5 * bayer4(x, y) ? lo + 1 : lo;
    }
  }
  const plan: GroundPlan = { key, idx, step: stepOf, colors };
  groundPlans.unshift(plan);
  if (groundPlans.length > 2) groundPlans.length = 2;
  return plan;
}

/** The ground itself, row by row: every pixel asks the plan what is there (cached per view). */
function* paintGround(c: Ctx): Generator<void, void, void> {
  const { s, view, light } = c;
  const { w, h, hy } = view;
  const sky = skyFor(light);
  const water = mix(sky.bands[3], light.env(P.skyMid), 0.35);
  const waterHi = mix(sky.bands[5], light.env(P.skyLow), 0.3);
  const waterLo = mix(sky.bands[1], light.env(P.skyTop), 0.4);
  const data = s.data;
  const plan = groundPlan(c);
  const { idx, step, colors } = plan;
  // this light's colour for each (plan colour, haze step), and lit, made as they are met
  const STEPS = 10;
  const toned = new Uint32Array(colors.length * STEPS);
  const lit = new Uint32Array(colors.length);
  // about 60,000 pixels a slice
  const slice = Math.max(1, Math.floor(60000 / w));
  for (let y = hy; y < h; y++) {
    if (y > hy && (y - hy) % slice === 0) yield;
    const row = (y - hy) * w;
    for (let x = 0; x < w; x++) {
      const at = row + x;
      const i = idx[at];
      const g = colors[i & ~LIT_BIT];
      let col: Color;
      if (g === WATER) col = water;
      else if (g === WATER_HI) col = waterHi;
      else if (g === WATER_LO) col = waterLo;
      else if (i & LIT_BIT) {
        const j = i & ~LIT_BIT;
        col = lit[j] as Color;
        if (col === 0) col = lit[j] = light.lit(g as Color);
      } else {
        const t = i * STEPS + step[at];
        col = toned[t] as Color;
        if (col === 0)
          col = toned[t] = distant(light, g as Color, step[at] / 8);
      }
      data[y * w + x] = col;
    }
  }
}

/** The far hills against the sky, with whatever stands on them. */
function paintHills(c: Ctx, town: Town): void {
  const { s, view, light, seed } = c;
  const { w, hy, k } = view;
  if (hy < 4) return;
  const far = distant(light, P.grassDark, 1);
  const nearer = distant(light, P.grassDeep, 0.86);
  // the hills' bounds and heights follow the scale, so they keep their size on screen
  const unit = Math.max(0.9, k);
  const grow = Math.min(1.5, unit / 2 + 0.3) * 2;
  for (let x = 0; x < w; x++) {
    const u = (x - view.cx) / unit;
    const a =
      2.2 +
      2.4 * Math.sin(u / 61 + seed) +
      1.4 * Math.sin(u / 23 + 2.1 * seed) +
      0.8 * Math.sin(u / 9.7 + 1.3);
    const b =
      0.6 +
      1.6 * Math.sin(u / 47 + 4 + seed) +
      1.1 * Math.sin(u / 17 + 0.6 * seed);
    const ha = Math.max(2, Math.round(a * grow));
    const hb = Math.max(0, Math.round(b * grow));
    s.rect(x, hy - ha, 1, ha, far);
    if (hb > 0) s.rect(x, hy - hb, 1, hb, nearer);
  }
  // wind turbines on the left, a mast on the right
  const post = distant(light, P.chalk, 0.75);
  for (let i = 0; i < 3; i++) {
    const x = Math.round(view.cx - (212 - i * 17) * unit);
    if (x < 4 || x > w - 6) continue;
    const top = hy - (9 + (i % 2)) * 2;

    // a tapering tower: two pixels at its foot, one at its top
    s.rect(x - 1, top + 6, 2, 12, post);
    s.rect(x - 1, top, 1, 6, post);
    town.turbines.push({ x, y: top });
  }
  const mx = Math.round(view.cx + 196 * unit);
  if (mx > 4 && mx < w - 4) {
    const mast = distant(light, P.concreteDark, 0.7);

    // a lattice mast with its stays
    s.rect(mx, hy - 26, 2, 24, mast);
    for (let y = hy - 24; y < hy - 2; y += 4)
      s.px(mx + (y % 8 === 0 ? 0 : 1), y, distant(light, P.concrete, 0.7));
    for (const y of [hy - 8, hy - 16]) {
      s.px(mx - 1, y, mast);
      s.px(mx - 2, y + 1, mast);
      s.px(mx + 2, y, mast);
      s.px(mx + 3, y + 1, mast);
    }
    town.beacons.push({ x: mx, y: hy - 28 });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function at(c: Ctx, X: number, V: number, H = 0): Spot {
  return project(c.view, X, V, H);
}

function seen(c: Ctx, p: Spot, margin = 60): boolean {
  return (
    p.x > -margin &&
    p.x < c.view.w + margin &&
    p.y < c.view.h + margin * 1.6 &&
    p.y > -margin
  );
}

function add(c: Ctx, V: number, draw: () => void): void {
  c.items.push({ V, draw });
}

function treeLook(c: Ctx, V: number, alt: boolean): TreeLook {
  return alt
    ? {
        dark: c.tone(P.grassDark, V),
        base: c.tone(P.grass, V),
        light: c.tone(P.grassLight, V),
        hi: c.tone(P.grassHi, V),
      }
    : {
        dark: c.tone(P.grassDeep, V),
        base: c.tone(P.grassDark, V),
        light: c.tone(P.grass, V),
        hi: c.tone(P.grassLight, V),
      };
}

function addTree(c: Ctx, X: number, V: number, key: number, kind = 0): void {
  const p = at(c, X, V);
  if (!seen(c, p, 28)) return;
  const cls = sizeClass(p.s);
  const r = c.h(key, 77);
  const look = treeLook(c, V, r < 0.38);
  add(c, V, () => {
    if (kind === 1) conifer(c.s, p.x, p.y, cls, look);
    else tree(c.s, p.x, p.y, cls, look, r > 0.7);
  });
}

function addBush(c: Ctx, X: number, V: number, key: number): void {
  const p = at(c, X, V);
  if (!seen(c, p, 16)) return;
  const look = treeLook(c, V, c.h(key, 78) < 0.5);
  add(c, V, () => bush(c.s, p.x, p.y, sizeClass(p.s), look));
}

const CAR_PAINTS: readonly (readonly [Color, Color, Color, Color])[] = [
  [P.mist, P.steelHi, P.steel, P.slate],
  [P.mist, P.steelHi, P.steel, P.slate],
  [P.steelHi, P.white, P.mist, P.slate],
  [P.steelHi, P.white, P.mist, P.slate],
  [P.slate, P.steel, P.night, P.mist],
  [P.slate, P.steel, P.night, P.mist],
  [P.home, P.homeLight, P.homeDark, P.night],
  [P.homeDark, P.home, P.brickDark, P.night],
  [P.skyTop, P.skyMid, P.duskTop, P.night],
  [P.away, P.awayLight, P.awayDark, P.night],
  [P.grassDark, P.grass, P.grassDeep, P.night],
  [P.gold, P.goldLight, P.goldDark, P.night],
];

export function carLook(
  tone: (c: Color, V: number) => Color,
  V: number,
  pick: number,
): CarLook {
  const p =
    CAR_PAINTS[Math.floor(pick * CAR_PAINTS.length) % CAR_PAINTS.length];
  return {
    b: tone(p[0], V),
    l: tone(p[1], V),
    d: tone(p[2], V),
    g: tone(p[3], V),
    k: tone(P.ink, V),
    n: tone(DEEP.get(p[2]) ?? P.ink, V),
    w: tone(GLINT.get(p[3]) ?? P.steel, V),
    m: tone(P.steel, V),
    y: tone(P.chalk, V),
    q: tone(P.brick, V),
  };
}

/** A deep shade one step down the ramp from a car's side colour. */
const DEEP = new Map<Color, Color>([
  [P.steel, P.slate],
  [P.mist, P.steel],
  [P.night, P.ink],
  [P.homeDark, P.brickDark],
  [P.brickDark, P.ink],
  [P.duskTop, P.night],
  [P.awayDark, P.night],
  [P.grassDeep, P.night],
  [P.goldDark, P.woodDark],
]);
/** Glass catching the sky: one step up the ramp from the glass. */
const GLINT = new Map<Color, Color>([
  [P.slate, P.steel],
  [P.night, P.slate],
  [P.mist, P.steelHi],
]);

/** A parked car at (X, V) on the map, pointing `dir` (0 east, 1 west, 2 north, 3 south). */
function addCar(c: Ctx, X: number, V: number, dir: number, key: number): void {
  const p = at(c, X, V);
  if (!seen(c, p, 20)) return;
  const look = carLook(c.tone, V, c.h(key, 31));
  const heading = mapHeading(c.view, X, V, dir);
  // one of five sizes by the scale (G2, traffic-steps.ts)
  const step = sizeStep(p.s);
  add(c, V, () => car(c.s, p.x, p.y, sizeClass(p.s), heading, look, step));
}

const COACH_PAINTS: readonly (readonly [Color, Color, Color, Color])[] = [
  [P.steelHi, P.white, P.mist, P.home],
  [P.away, P.awayLight, P.awayDark, P.chalk],
  [P.away, P.awayLight, P.awayDark, P.chalk],
  [P.chalk, P.white, P.mist, P.gold],
  [P.homeDark, P.home, P.brickDark, P.chalk],
  [P.steelHi, P.white, P.mist, P.skyTop],
];

export function coachLook(
  tone: (c: Color, V: number) => Color,
  V: number,
  pick: number,
): CoachLook {
  const p = COACH_PAINTS[Math.floor(pick) % COACH_PAINTS.length];
  return {
    roof: tone(p[0], V),
    roofHi: tone(p[1], V),
    side: tone(p[2], V),
    stripe: tone(p[3], V),
    glass: tone(P.slate, V),
    tyre: tone(P.ink, V),
    glassHi: tone(P.steel, V),
    deep: tone(P.night, V),
    hub: tone(P.steel, V),
    lamp: tone(P.chalk, V),
    tail: tone(P.brick, V),
  };
}

/** Home supporters' shirts: the club's main colour, and its second (index 4 and 9). */
const SHIRTS_HOME: readonly Color[] = [
  P.home,
  P.home,
  P.home,
  P.homeLight,
  P.chalk,
  P.homeDark,
  P.home,
  P.steel,
  P.slate,
  P.gold,
];
function homeShirt(i: number, club: ClubScheme): Color {
  return i === 4
    ? club.second.base
    : i === 9
      ? club.second.light
      : SHIRTS_HOME[i];
}

const HAIRS: readonly Color[] = [
  P.hairDark,
  P.hairBrown,
  P.hairBlond,
  P.hairDark,
  P.chalk,
  P.home,
];
const SKINS: readonly Color[] = [P.skinA, P.skinB, P.skinC, P.skinA];

/** One step down each ramp (shade), and one up (light). */
const DARK = new Map<Color, Color>([
  [P.homeLight, P.home],
  [P.home, P.homeDark],
  [P.homeDark, P.brickDark],
  [P.chalk, P.mist],
  [P.white, P.steelHi],
  [P.steelHi, P.mist],
  [P.steel, P.slate],
  [P.slate, P.night],
  [P.night, P.ink],
  [P.mist, P.steel],
  [P.gold, P.goldDark],
  [P.goldLight, P.gold],
  [P.goldDark, P.woodDark],
  [P.awayLight, P.away],
  [P.away, P.awayDark],
  [P.wood, P.woodDark],
  [P.skyMid, P.skyTop],
  [P.skinA, P.skinAShade],
  [P.skinB, P.skinBShade],
  [P.skinC, P.skinCShade],
  [P.hairDark, P.ink],
  [P.hairBrown, P.hairDark],
  [P.hairBlond, P.goldDark],
]);
const LIGHT = new Map<Color, Color>([
  [P.homeDark, P.home],
  [P.home, P.homeLight],
  [P.chalk, P.white],
  [P.steel, P.mist],
  [P.slate, P.steel],
  [P.mist, P.steelHi],
  [P.gold, P.goldLight],
  [P.away, P.awayLight],
  [P.skyMid, P.skyLow],
  [P.wood, P.brickLight],
]);

/**
 * A supporter's clothes: `kind` 0 home, 1 away, 2 steward, 3 anyone; `club` the day's
 * colours. With the shades and lights of the shirt, skin, hair and trousers, shoes, a
 * scarf, a vest's band, a hat's bobble, and the head and body styles; the same `r`, the
 * same person in the same clothes.
 */
export function personLook(
  tone: (c: Color) => Color,
  r: number,
  kind = 0,
  club: ClubScheme = DEFAULT_SCHEME,
): PersonLook {
  const i = Math.floor(r * 997);
  const shirt =
    kind === 1
      ? i % 4 === 0
        ? P.awayLight
        : P.away
      : kind === 2
        ? P.gold
        : kind === 3
          ? [P.steel, P.chalk, P.slate, P.mist, P.wood, P.skyMid][i % 6]
          : homeShirt(i % SHIRTS_HOME.length, club);
  const hair = HAIRS[(i >> 2) % HAIRS.length];
  const skin = SKINS[(i >> 4) % SKINS.length];
  const legs = i % 3 === 0 ? P.slate : P.night;
  const dark = (c: Color): Color =>
    DARK.get(c) ??
    (c === club.second.base
      ? club.second.dark
      : c === club.second.light
        ? club.second.base
        : c);
  const light = (c: Color): Color =>
    LIGHT.get(c) ??
    (c === club.second.base
      ? club.second.light
      : c === club.second.dark
        ? club.second.base
        : c);
  // the red-haired are home fans in a bobble hat
  const hat = hair === P.home;
  const long = !hat && (hair === P.hairBrown || hair === P.hairBlond);
  const scarfy =
    kind === 0 ? (i >> 3) % 3 === 0 : kind === 1 && (i >> 3) % 4 === 0;
  return {
    shirt: tone(shirt),
    hair: tone(hair),
    skin: tone(skin),
    legs: tone(legs),
    shirtDark: tone(dark(shirt)),
    shirtLight: tone(light(shirt)),
    skinDark: tone(dark(skin)),
    hairDark: tone(hat ? P.homeDark : dark(hair)),
    legsDark: tone(dark(legs)),
    shoe: tone([P.ink, P.woodDark, P.chalk, P.ink][(i >> 5) % 4]),
    scarf: tone(
      kind === 1
        ? P.awayLight
        : shirt === club.second.base || shirt === club.second.light
          ? P.home
          : club.second.base,
    ),
    band: tone(P.steelHi),
    bobble: tone(club.second.light),
    head: hat ? 2 : long && (i >> 6) % 2 === 0 ? 1 : 0,
    body: kind === 2 ? 2 : scarfy ? 1 : 0,
  };
}

function addPerson(
  c: Ctx,
  X: number,
  V: number,
  key: number,
  kind = 0,
  floodlit = false,
): void {
  const p = at(c, X, V);
  if (!seen(c, p, 12)) return;
  const look = personLook(
    floodlit ? c.lit : (col) => c.tone(col, V),
    c.h(key, 53),
    kind,
    clubOf(c.light),
  );
  add(c, V - 0.01, () => {
    const cls = sizeClass(p.s);
    // one of five sizes by the scale (G2, traffic-steps.ts)
    const size = sizeStep(p.s);
    // the 6-wide person's middle is half a pixel right of its anchor
    if (size === 4) shadowBlob(c.s, p.x + 2.5, p.y, 3, 1);
    else if (size === 3) shadowBlob(c.s, p.x + 1.5, p.y, 2, 1);

    person(c.s, p.x, p.y, cls, look, 0, 0, false, size);
  });
}

// ---------------------------------------------------------------------------
// Houses
// ---------------------------------------------------------------------------

const HOUSE_LOOKS: readonly (BoxLook & { line: Color })[] = [
  // slate roofs on brick
  {
    roof: P.concreteLight,
    roofShade: P.steel,
    wall: P.brick,
    side: P.brickDark,
    line: P.slate,
  },
  // red tiles on render
  {
    roof: P.brickLight,
    roofShade: P.brick,
    wall: P.chalk,
    side: P.concreteLight,
    line: P.brickDark,
  },
  // dark slate on pale brick
  {
    roof: P.steel,
    roofShade: P.concreteDark,
    wall: P.brickLight,
    side: P.brick,
    line: P.slate,
  },
  // brown tiles on brick
  {
    roof: P.wood,
    roofShade: P.woodDark,
    wall: P.brick,
    side: P.brickDark,
    line: P.hairDark,
  },
];

const HOUSE_H = 5.2;
const HOUSE_R = 3.4;

interface TerraceOptions {
  style: number;
  /** The camera sees the backs: outriggers, gardens, sheds, washing. */
  backs: boolean;
  key: number;
  /** Depth of the back gardens (0: none). */
  garden?: number;
}

function terrace(
  c: Ctx,
  X0: number,
  X1: number,
  V0: number,
  V1: number,
  o: TerraceOptions,
  town?: Town,
): void {
  const { view, s } = c;
  const a = at(c, X0, V0);
  const b = at(c, X1, V0);
  if (b.x < -16 || a.x > view.w + 16) return;
  if (at(c, X0, V1, HOUSE_H + HOUSE_R).y > view.h + 8 || a.y < view.hy - 4) {
    return;
  }
  const cls = sizeClass(a.s);
  const look = HOUSE_LOOKS[o.style % HOUSE_LOOKS.length];
  const Vm = (V0 + V1) / 2;
  const n = Math.max(1, Math.round((X1 - X0) / LOT));
  const lw = (X1 - X0) / n;
  const tone = c.tone;
  const windowOff = tone(P.slate, V0);

  add(c, V0, () => {
    box(s, view, tone, X0, X1, V0, V1, look, { H: HOUSE_H, R: HOUSE_R });
    if (cls === 0) {
      // far away: the chimneys are a row of dots on the ridge
      for (let i = 0; i < n; i += 2) {
        const p = at(c, X0 + i * lw + 1, Vm, HOUSE_H + HOUSE_R);

        s.rect(p.x, p.y - 3, 2, 3, tone(P.brickDark, Vm));
        s.px(p.x, p.y - 3, tone(P.brickLight, Vm));
      }
      if (c.night) {
        for (let i = 0; i < n; i++) {
          if (c.h(i, o.key + 5) < 0.42) {
            const p = at(c, X0 + (i + 0.5) * lw, V0, 2);
            const lit = c.h(i, o.key) < 0.5 ? P.gold : P.amber;
            s.rect(p.x, p.y - 1, 2, 2, lit);
          }
        }
      }
      return;
    }
    const lineC = tone(look.line, Vm);
    for (let i = 0; i < n; i++) {
      const Xl = X0 + i * lw;
      const r = c.h(i, o.key);
      if (i > 0) {
        const p0 = at(c, Xl, V0, HOUSE_H);
        const p1 = at(c, Xl, Vm, HOUSE_H + HOUSE_R);
        s.line(p0.x, p0.y, p1.x, p1.y, lineC);
      }
      // a skylight or a dormer on some
      if (cls === 2 && r > 0.72) {
        const q = at(
          c,
          Xl + lw * 0.55,
          V0 + (Vm - V0) * 0.5,
          HOUSE_H + HOUSE_R * 0.5,
        );
        const pane = c.night && r > 0.86 ? P.gold : tone(P.steelHi, V0);

        // a roof light: a frame and two panes catching the sky
        s.rect(q.x - 1, q.y - 1, 6, 5, tone(P.slate, V0));
        s.rect(q.x, q.y, 4, 3, pane);
        s.rect(q.x + 2, q.y, 1, 3, tone(P.slate, V0));
        if (!c.night) s.px(q.x, q.y, tone(P.white, V0));
      }
      const ch = at(c, Xl + lw * 0.16, Vm, HOUSE_H + HOUSE_R);
      if (cls === 2) {
        const top = drawChimney(
          s,
          ch.x,
          ch.y,
          tone(P.brick, Vm),
          tone(P.brickDark, Vm),
          tone(P.brickLight, Vm),
          tone(P.wood, Vm),
        );
        if (town && r < 0.3)
          town.chimneys.push({ x: ch.x, y: top - 1, big: false });
      } else {
        s.rect(ch.x, ch.y - 4, 2, 4, tone(P.brickDark, Vm));
        s.px(ch.x, ch.y - 4, tone(P.brickLight, Vm));
      }
      // the wall facing the camera: a window and a door
      const foot = at(c, Xl, V0, 0);
      const eave = at(c, Xl, V0, HOUSE_H);
      const wh = foot.y - eave.y;
      const wpx = Math.round(lw * foot.s);
      const lit = c.night && c.h(i, o.key + 5) < 0.6;
      const glass = lit ? (r < 0.5 ? P.gold : P.goldLight) : windowOff;
      const door = [P.woodDark, P.slate, P.homeDark, P.awayDark, P.grassDeep][
        Math.floor(r * 5)
      ];
      if (wh >= 12 && wpx >= 18) {
        // framed windows with panes and sills, a door with its fanlight and step
        const frame = tone(P.chalk, V0);
        const sill = tone(P.concreteLight, V0);
        const sky = tone(P.mist, V0);
        const bars = P.goldDark;
        const wx = foot.x + Math.round(wpx * 0.18);
        drawWindow(s, wx, eave.y + 3, glass, frame, sky, sill, lit, bars);
        const dx = foot.x + Math.round(wpx * 0.62);
        drawDoor(
          s,
          dx,
          foot.y,
          tone(door, V0),
          tone(P.ink, V0),
          lit ? glass : windowOff,
          tone(P.gold, V0),
          sill,
        );
        if (!o.backs) {
          drawWindow(s, dx + 6, eave.y + 3, glass, frame, sky, sill, lit, bars);
        }
        // the gutter under the eaves
        s.rect(foot.x, eave.y, wpx, 1, tone(P.slate, V0));
      } else if (wh >= 6) {
        s.rect(
          foot.x + Math.max(2, Math.round(wpx * 0.3)),
          eave.y + 2,
          2,
          2,
          glass,
        );
        if (wpx >= 12) {
          s.rect(
            foot.x + Math.round(wpx * 0.7),
            foot.y - 3,
            2,
            3,
            tone(P.woodDark, V0),
          );
        }
      } else {
        // too small for a window
      }
    }
  });

  if (!o.backs || cls === 0) return;
  const depth = o.garden ?? 0;
  for (let i = 0; i < n; i++) {
    const Xl = X0 + i * lw;
    const r = c.h(i, o.key + 1);
    const r2 = c.h(i, o.key + 2);
    // the outrigger: every terrace has a kitchen sticking out the back
    if (r < 0.62) {
      const side = i % 2 === 0 ? 0.5 : 0.08;
      add(c, V0 - 4.4, () =>
        box(
          s,
          view,
          tone,
          Xl + lw * side,
          Xl + lw * (side + 0.42),
          V0 - 4.4,
          V0,
          {
            roof: look.roofShade,
            roofShade: look.roofShade,
            wall: look.wall,
            side: look.side,
          },
          { H: 3.3 },
        ),
      );
    }
    if (depth <= 0) continue;
    // a shed at the bottom of the garden
    if (r2 < 0.5) {
      const sv = V0 - depth + 1.2;
      add(c, sv, () =>
        box(
          s,
          view,
          tone,
          Xl + 1.3,
          Xl + 4.6,
          sv,
          sv + 3,
          {
            roof: r2 < 0.25 ? P.wood : P.concrete,
            roofShade: r2 < 0.25 ? P.woodDark : P.concreteDark,
            wall: P.woodDark,
            side: P.hairDark,
          },
          { H: 2.2, R: 1.1 },
        ),
      );
    } else if (r2 < 0.72) {
      addTree(c, Xl + lw * 0.6, V0 - depth + 3, o.key * 31 + i);
    } else if (r2 < 0.86) {
      addBush(c, Xl + lw * 0.4, V0 - depth + 2, o.key * 31 + i);
      addBush(c, Xl + lw * 0.75, V0 - depth * 0.5, o.key * 37 + i);
    }
    if (cls < 2) continue;
    // washing on the line
    if (r > 0.45 && r < 0.8) {
      const w0 = at(c, Xl + lw * 0.28, V0 - 5.5, 2.2);
      const w1 = at(c, Xl + lw * 0.34, V0 - depth + 4.5, 2.2);
      add(c, V0 - depth + 4.5, () => {
        const wash = [P.home, P.white, P.away, P.gold, P.white, P.home];

        // the line, its post at the end, shirts and towels pegged along it
        s.line(w0.x, w0.y, w1.x, w1.y, tone(P.steelHi, V0));
        s.rect(w1.x, w1.y, 1, 6, tone(P.woodDark, V0));
        const steps = Math.max(2, Math.floor((w1.y - w0.y) / 6));
        for (let j = 1; j < steps; j++) {
          const yy = w0.y + j * 6;
          const xx = Math.round(
            w0.x + ((w1.x - w0.x) * (yy - w0.y)) / Math.max(1, w1.y - w0.y),
          );
          const col = tone(wash[(i + j) % wash.length], V0);
          const fold = tone(P.mist, V0);
          if ((i + j) % 3 === 0) {
            // a shirt, sleeves out
            s.rect(xx - 2, yy, 6, 2, col);
            s.rect(xx - 1, yy + 2, 4, 3, col);
            s.rect(xx + 2, yy + 2, 1, 3, fold);
          } else {
            // a towel
            s.rect(xx - 1, yy, 4, 4, col);
            s.rect(xx - 1, yy + 3, 4, 1, fold);
          }
          s.px(xx, yy - 1, tone(P.wood, V0));
        }
      });
    }
    // a trampoline, a paddling pool, a greenhouse
    if (r > 0.9) {
      const q = at(c, Xl + lw * 0.62, V0 - depth * 0.55);
      add(c, V0 - depth * 0.55, () => {
        // the mat, its pads round it, the frame's legs
        shadowBlob(s, q.x + 2, q.y + 2, 8, 4);
        s.ellipse(q.x, q.y - 2, 8, 4, tone(P.away, V0), true);
        s.ellipse(q.x, q.y - 2, 6, 3, tone(P.night, V0), true);
        s.ellipse(q.x, q.y - 2, 8, 4, tone(P.awayLight, V0));
        s.rect(q.x - 6, q.y + 1, 1, 2, tone(P.slate, V0));
        s.rect(q.x + 6, q.y + 1, 1, 2, tone(P.slate, V0));
      });
    } else if (r > 0.84) {
      const q = at(c, Xl + lw * 0.6, V0 - depth * 0.5);
      add(c, V0 - depth * 0.5, () => {
        // a blow-up pool: a ring of plastic, water, a glint
        s.ellipse(q.x, q.y, 6, 3, tone(P.awayLight, V0), true);
        s.ellipse(q.x, q.y, 5, 2, tone(P.skyMid, V0), true);
        s.rect(q.x - 3, q.y - 1, 2, 1, tone(P.skyLow, V0));
        s.px(q.x - 1, q.y - 1, tone(P.white, V0));
      });
    }
    // wheelie bins by the back gate
    const bin = at(c, Xl + lw * 0.86, V0 - depth - 0.6);
    add(c, V0 - depth - 0.6, () => {
      const wheel = tone(P.ink, V0);
      drawBin(
        s,
        bin.x,
        bin.y,
        tone(P.grassDeep, V0),
        tone(P.grassDark, V0),
        wheel,
      );
      if (r2 > 0.4) {
        drawBin(
          s,
          bin.x + 4,
          bin.y,
          tone(P.awayDark, V0),
          tone(P.away, V0),
          wheel,
        );
      }
    });
  }
}

/** The grid of ordinary streets (plan.ts `streets`): two terraces to a block. */
function streetsGrid(
  c: Ctx,
  Xa: number,
  Xb: number,
  Va: number,
  Vb: number,
  skip: (X: number, V: number) => boolean,
): void {
  const bx0 = Math.floor((Xa + 3) / 78);
  const bx1 = Math.floor((Xb + 3) / 78);
  const bv0 = Math.floor((Va + 30) / 52);
  const bv1 = Math.floor((Vb + 30) / 52);
  for (let bx = bx0; bx <= bx1; bx++) {
    for (let bv = bv0; bv <= bv1; bv++) {
      const x0 = bx * 78 - 3 + 7;
      const x1 = bx * 78 - 3 + 77;
      const v0 = bv * 52 - 30 + 6;
      if (x0 < Xa || x1 > Xb || v0 < Va || v0 + 46 > Vb) continue;
      if (skip((x0 + x1) / 2, v0 + 23)) continue;
      const key = bx * 131 + bv * 17;
      const style = Math.floor(c.h(bx, bv + 400) * 4);
      // fronts on the street to the south, backs and gardens behind
      terrace(c, x0, x1, v0 + 0.8, v0 + 8.6, { style, backs: false, key });
      terrace(c, x0, x1, v0 + 37.6, v0 + 45.4, {
        style: (style + 1 + Math.floor(c.h(bx, bv) * 2)) % 4,
        backs: true,
        key: key + 7,
        garden: 13,
      });
      // trees in a few gardens and on the corners
      for (let i = 0; i < 4; i++) {
        if (c.h(key, i + 60) < 0.55) {
          addTree(
            c,
            x0 + 6 + c.h(key, i) * 58,
            v0 + 14 + c.h(key, i + 9) * 16,
            key + i,
          );
        }
      }
      // cars parked along the kerb
      for (let i = 0; i < 9; i++) {
        if (c.h(key + 3, i) < 0.6)
          addCar(c, x0 + 4 + i * 7.6, v0 - 1.6, i % 2, key + i);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Districts
// ---------------------------------------------------------------------------

/** South-west: the terraces that back on to the camera, and the pub on the plaza corner. */
function southWest(c: Ctx, town: Town): void {
  const { s, view, tone } = c;
  const pubX0 = -PLAZA_HALF - 24;
  const pubX1 = -PLAZA_HALF - 3;
  for (let j = 0; j < 3; j++) {
    const top = ROAD.stadiumV0 - j * STREET;
    const V1 = top - 4.5;
    const V0 = top - 14.5;
    const x0 = HOUSES_SW.x0 + 3;
    const end = j === 0 ? pubX0 - 2 : HOUSES_SW.x1 - 2;
    const n = Math.floor((end - x0) / LOT);
    terrace(
      c,
      end - n * LOT,
      end,
      V0,
      V1,
      { style: j, backs: true, key: 900 + j * 13, garden: 13.5 },
      town,
    );
    // parked cars on the street in front (the far side of the row)
    if (j > 0) {
      for (let i = 0; i < 20; i++) {
        if (c.h(i, 940 + j) < 0.6)
          addCar(c, x0 + 5 + i * 8, top - 1.5, i % 2, 950 + i + j * 40);
      }
    }
  }
  // the pub: white walls, a red roof, a beer garden with parasols
  const pv0 = ROAD.stadiumV0 - 15.5;
  const pv1 = ROAD.stadiumV0 - 4;
  add(c, pv0, () => {
    box(
      s,
      view,
      tone,
      pubX0,
      pubX1,
      pv0,
      pv1,
      {
        roof: P.brickLight,
        roofShade: P.brick,
        wall: P.chalk,
        side: P.concreteLight,
      },
      { H: 6.4, R: 4 },
    );
    const Vm = (pv0 + pv1) / 2;
    for (const u of [0.12, 0.86]) {
      const ch = at(c, pubX0 + (pubX1 - pubX0) * u, Vm, 10.4);

      const top = drawChimney(
        s,
        ch.x,
        ch.y - 2,
        tone(P.brick, Vm),
        tone(P.brickDark, Vm),
        tone(P.chalk, Vm),
        tone(P.wood, Vm),
      );
      if (u < 0.5) town.chimneys.push({ x: ch.x, y: top - 1, big: false });
    }
    const foot = at(c, pubX0, pv0, 0);
    const eave = at(c, pubX0, pv0, 6.4);
    const end = at(c, pubX1, pv0, 0);
    const wide = end.x - foot.x;
    const wh = foot.y - eave.y;
    if (wh >= 12 && wide >= 40) {
      // the black beams of a timbered front, leaded windows, the door under a
      // lamp, the hanging sign in the club's green and gold
      const beam = tone(P.hairDark, pv0);
      s.rect(foot.x, eave.y + 2, wide, 2, beam);
      s.rect(foot.x, foot.y - 2, wide, 1, beam);
      for (let i = 0; i <= 8; i++) {
        s.rect(
          foot.x + Math.round((i * (wide - 2)) / 8),
          eave.y + 2,
          2,
          foot.y - eave.y - 3,
          beam,
        );
      }
      const glass = c.night ? P.gold : tone(P.slate, pv0);
      for (let i = 0; i < 4; i++) {
        const wx = foot.x + 6 + Math.round((i * (wide - 16)) / 4);
        drawWindow(
          s,
          wx,
          eave.y + 6,
          glass,
          beam,
          tone(P.mist, pv0),
          tone(P.chalk, pv0),
          c.night,
          P.goldDark,
        );
      }
      const dx = foot.x + Math.round(wide * 0.45);
      s.rect(dx, foot.y - 10, 6, 10, tone(P.homeDark, pv0));
      s.rect(dx + 5, foot.y - 9, 1, 9, tone(P.brickDark, pv0));
      s.px(dx + 4, foot.y - 5, tone(P.gold, pv0));
      s.rect(dx - 1, foot.y - 11, 8, 1, beam);
      const sx = foot.x + Math.round(wide * 0.3);
      const sw = Math.round(wide * 0.4);
      s.rect(sx, eave.y - 2, sw, 6, tone(P.grassDeep, pv0));
      s.rect(sx + 1, eave.y - 1, sw - 2, 1, tone(P.gold, pv0));
      s.rect(sx + 1, eave.y + 2, sw - 2, 1, tone(P.gold, pv0));
      for (let x = sx + 3; x < sx + sw - 3; x += 3) {
        s.rect(x, eave.y + 1, 2, 1, tone(P.goldLight, pv0));
      }
    } else if (wh >= 4) {
      s.rect(
        foot.x + 2,
        eave.y + 2,
        Math.max(2, wide - 4),
        2,
        c.night ? P.gold : tone(P.slate, pv0),
      );
    } else {
      // too far for its front
    }
  });
  // the beer garden
  const g0 = pv0 - 13;
  for (let i = 0; i < 6; i++) {
    const X = pubX0 + 3 + (i % 3) * 7.2;
    const V = pv0 - 3.6 - Math.floor(i / 3) * 5.6;
    const p = at(c, X, V, 2.6);
    const f = at(c, X, V, 0);
    if (!seen(c, p, 16)) continue;
    const cls = sizeClass(p.s);
    add(c, V, () => {
      const a = tone(i % 2 === 0 ? P.home : P.chalk, V);
      const b = tone(i % 2 === 0 ? P.chalk : P.home, V);

      if (cls === 2) {
        shadowBlob(s, f.x + 4, f.y + 2, 8, 3);
        // the pole under the canopy, the table at its foot
        s.rect(p.x, p.y + 3, 1, f.y - p.y - 3, tone(P.steel, V));
        s.rect(f.x - 3, f.y - 3, 7, 2, tone(P.woodDark, V));
        s.rect(f.x - 3, f.y - 3, 7, 1, tone(P.wood, V));
        drawParasol(s, p.x, p.y, a, b, tone(P.white, V), tone(P.brickDark, V));
      } else if (cls === 1) {
        s.rect(p.x - 4, p.y - 2, 10, 3, a);
        s.rect(p.x - 3, p.y - 3, 8, 1, a);
        s.rect(p.x, p.y - 3, 2, 4, b);
        s.rect(p.x - 4, p.y + 1, 10, 1, tone(P.brickDark, V));
      } else {
        s.rect(p.x, p.y - 1, 2, 2, a);
      }
    });
    addPerson(c, X + 2.6, V - 0.8, 700 + i, i % 3 === 0 ? 3 : 0);
    if (i % 2 === 0) addPerson(c, X - 2.6, V - 1.4, 720 + i, 0);
  }
  // its fence and hedge
  for (let i = 0; i < 6; i++) addBush(c, pubX0 + 1 + i * 4, g0, 760 + i);
}

/** South-east: the big car park, its hedge and gate, the pie van. */
function southEast(c: Ctx): void {
  const { s, view, tone } = c;
  // The cars that stay all day: every car in the car park (none drives in or out).
  for (let band = 0; band < 7; band++) {
    for (let row = 0; row < 2; row++) {
      const V = rowV(band, row);
      if (at(c, bayX(0), V).y > view.h + 12) break;
      for (let n = 0; n < BAYS_PER_ROW; n++) {
        if (!staticCar(band, row, n, c.seed)) continue;
        addCar(c, bayX(n), V, rowDir(row), band * 977 + row * 211 + n);
      }
    }
  }
  // the hedge along the road, with trees in it; the gate is a gap in it
  for (let X = CARPARK.x0 + 3; X < CARPARK.x1; X += 3.4) {
    if (X > GATE.x0 - 2 && X < GATE.x1 + 6) continue;
    addBush(c, X, ROAD.stadiumV0 - 1.6, Math.round(X) + 3000);
  }
  for (let X = CARPARK.x0 + 34; X < CARPARK.x1; X += 26) {
    addTree(c, X, ROAD.stadiumV0 - 2, Math.round(X) + 3100);
  }
  // the gatehouse beside the way in, its boom raised, a steward on the kerb
  const hutV = ROAD.stadiumV0 - 3.6;
  add(c, hutV, () => {
    box(
      s,
      view,
      tone,
      GATE.x1 + 1,
      GATE.x1 + 4.8,
      hutV,
      ROAD.stadiumV0 - 0.4,
      {
        roof: P.home,
        roofShade: P.homeDark,
        wall: P.chalk,
        side: P.concreteLight,
      },
      { H: 3.4 },
    );
    const foot = at(c, GATE.x1 + 0.4, hutV, 0);
    const tall = Math.max(4, Math.round(4.2 * foot.s));
    for (let j = 0; j < tall; j++) {
      // the raised boom: red and white bands (two pixels wide)
      s.rect(
        foot.x,
        foot.y - 1 - j,
        2,
        1,
        Math.floor(j / 4) % 2 === 0 ? tone(P.home, hutV) : tone(P.white, hutV),
      );
    }

    // its pivot box at the foot
    s.rect(foot.x - 1, foot.y - 3, 4, 3, tone(P.slate, hutV));
    s.px(foot.x - 1, foot.y - 3, tone(P.steel, hutV));
  });
  addPerson(c, GATE.x1 + 2.4, hutV - 1.2, 3301, 2);

  // the pie van on the corner of the plaza: its hatch faces the camera
  const vx0 = PLAZA_HALF - 17;
  const vx1 = PLAZA_HALF - 5;
  const vv = ROAD.stadiumV0 - 10;
  add(c, vv, () => {
    box(
      s,
      view,
      c.tone,
      vx0,
      vx1,
      vv,
      vv + 5,
      {
        roof: P.chalk,
        roofShade: P.chalk,
        wall: P.steelHi,
        side: P.mist,
      },
      { H: 4.6 },
    );
    const foot = at(c, vx0, vv, 0);
    const end = at(c, vx1, vv, 0);
    const top2 = at(c, vx0, vv, 4.6);
    const wide = end.x - foot.x;
    const wh = foot.y - top2.y;
    // the awning: stripes of the club's colours
    for (let x = 0; x < wide; x++) {
      const stripe = Math.floor(x / 4) % 2 === 0 ? P.home : P.chalk;
      s.rect(
        foot.x + x,
        top2.y,
        1,
        Math.max(1, Math.round(wh * 0.3)),
        tone(stripe, vv),
      );
    }
    if (wh >= 12) {
      // the awning's scalloped edge, the hatch with someone serving behind the
      // counter (a face, an apron), a menu board, the wheels
      const aw = Math.max(2, Math.round(wh * 0.3));
      for (let x = 0; x < wide; x += 4) {
        const stripe = Math.floor(x / 4) % 2 === 0 ? P.home : P.chalk;
        s.rect(foot.x + x, top2.y + aw, 2, 1, tone(stripe, vv));
      }
      const hy2 = top2.y + aw + 2;
      const hh = Math.round(wh * 0.38);
      s.rect(
        foot.x + 4,
        hy2,
        wide - 10,
        hh,
        c.night ? P.goldLight : tone(P.slate, vv),
      );
      const sx = foot.x + Math.round(wide * 0.4);
      s.rect(sx, hy2 + 1, 3, 1, tone(P.hairBrown, vv));
      s.rect(sx, hy2 + 2, 3, 2, tone(P.skinA, vv));
      s.px(sx + 2, hy2 + 3, tone(P.skinAShade, vv));
      s.rect(sx - 1, hy2 + 4, 5, Math.max(1, hh - 4), tone(P.chalk, vv));
      s.rect(foot.x + 6, hy2 + 2, 4, 3, tone(P.ink, vv));
      s.rect(foot.x + 7, hy2 + 3, 2, 1, tone(P.chalk, vv));
      s.rect(foot.x + 2, hy2 + hh, wide - 6, 2, tone(P.home, vv));
      s.rect(foot.x + 2, hy2 + hh, wide - 6, 1, tone(P.homeLight, vv));
      s.rect(foot.x + 2, foot.y - 1, 4, 2, tone(P.ink, vv));
      s.rect(end.x - 6, foot.y - 1, 4, 2, tone(P.ink, vv));
      s.px(foot.x + 3, foot.y - 1, tone(P.steel, vv));
      s.px(end.x - 5, foot.y - 1, tone(P.steel, vv));
    } else {
      // too far for its hatch
    }
  });
}

/** The concourse: kiosks and bollards. People are in stadium-life.ts, so they can move. */
function concourse(c: Ctx, town: Town): void {
  const { s, view } = c;
  const tone = (col: Color): Color => c.lit(col);
  // the four floodlight pylons, at the corners of the ground
  for (const [sx, sv] of [
    [-1, 1],
    [1, 1],
    [-1, -1],
    [1, -1],
  ] as const) {
    const X = sx * 128;
    const V = sv * 84;
    const foot = at(c, X, V);
    const top = at(c, X, V, 35);
    const big = foot.s >= 2.2;
    const mid = foot.s >= 1.2;
    const hw = (big ? 11 : mid ? 7 : 5) * 2;
    const hh = (big ? 7 : mid ? 5 : 3) * 2;
    const hx = foot.x - Math.floor(hw / 2) + (big ? 2 : 0);
    const hy2 = top.y - hh + 1;
    town.pylons.push({
      x: hx + Math.floor(hw / 2),
      y: hy2 + Math.floor(hh / 2),
    });
    add(c, V, () => {
      const hgt = foot.y - top.y;

      // a lattice mast, lit on its left, braced every few pixels, on a plinth
      const w2 = big ? 4 : 2;
      s.rect(foot.x, top.y, w2, hgt, c.tone(P.concreteLight, V));
      if (big) {
        s.rect(foot.x + 2, top.y, 2, hgt, c.tone(P.concrete, V));
        for (let y = top.y + 3; y < foot.y - 4; y += 6) {
          s.px(foot.x + 1, y, c.tone(P.slate, V));
          s.px(foot.x + 2, y + 3, c.tone(P.slate, V));
        }
        s.rect(foot.x - 2, foot.y - 4, 8, 4, c.tone(P.concrete, V));
        s.rect(foot.x - 2, foot.y - 4, 8, 1, c.tone(P.concreteLight, V));
      } else {
        s.rect(foot.x + 1, top.y, 1, hgt, c.tone(P.concrete, V));
      }
      if (c.night) {
        // the glow in three bands of light over what is behind it, each with a ragged
        // edge (a lamp's pool, lightPool): not a screen of dots, which at these fine
        // pixels reads as a dotted veil
        const cx2 = hx + Math.floor(hw / 2);
        const cy2 = hy2 + Math.floor(hh / 2);
        for (const k of [1, 0.8, 0.62]) {
          const r = Math.round(hw * k);
          lightPool(s, cx2, cy2, r, r, true);
        }
      }
      // the head: a frame of lamps in rows, a walkway under it
      s.rect(hx, hy2, hw, hh, c.tone(P.slate, V));
      s.rect(hx, hy2, hw, 1, c.tone(P.steel, V));
      s.rect(hx, hy2 + hh - 1, hw, 1, c.tone(P.night, V));
      for (let yy = hy2 + 2; yy < hy2 + hh - 2; yy += 3) {
        for (let xx = hx + 2; xx < hx + hw - 2; xx += 3) {
          s.rect(xx, yy, 2, 2, c.night ? P.white : c.tone(P.steelHi, V));
          if (!c.night) s.px(xx + 1, yy + 1, c.tone(P.mist, V));
        }
      }
    });
  }
  // kiosks either side of the main gates, striped canopies
  for (const side of [-1, 1]) {
    for (let i = 0; i < 2; i++) {
      const w = wallPoint(
        (-90 + side * (38 + i * 13)) * (Math.PI / 180),
        1.115,
      );
      const X0 = w.X - 4;
      const V0 = w.V - 2.4;
      add(c, V0, () => {
        box(
          s,
          view,
          tone,
          X0,
          X0 + 8,
          V0,
          V0 + 4.2,
          {
            roof: i === 0 ? P.home : P.gold,
            roofShade: i === 0 ? P.home : P.gold,
            wall: P.chalk,
            side: P.concreteLight,
          },
          { H: 3.6 },
        );
        const a = at(c, X0, V0, 3.6);
        const b = at(c, X0 + 8, V0 + 4.2, 3.6);
        for (let x = a.x; x <= at(c, X0 + 8, V0, 3.6).x; x += 4) {
          s.rect(x, b.y, 2, Math.max(1, a.y - b.y + 1), tone(P.chalk));
        }
        const foot = at(c, X0, V0, 0);
        if (foot.y - a.y >= 10) {
          // the canopy's valance, the serving hatch, a price board, the counter
          const right = at(c, X0 + 8, V0, 0).x;
          for (let x = a.x; x < right; x += 4) {
            s.rect(x, a.y + 1, 2, 1, tone(i === 0 ? P.home : P.gold));
          }
          s.rect(
            a.x + 2,
            a.y + 4,
            right - a.x - 4,
            4,
            c.night ? P.goldLight : tone(P.slate),
          );
          s.rect(a.x + 4, a.y + 5, 3, 2, tone(P.ink));
          s.px(a.x + 5, a.y + 5, tone(P.chalk));
          s.rect(a.x + 2, a.y + 8, right - a.x - 4, 1, tone(P.concreteLight));
        } else {
          // too far for its hatch
        }
      });
    }
  }
  // bollards where the plaza meets the road
  for (let X = -PLAZA_HALF + 6; X <= PLAZA_HALF - 6; X += 6) {
    for (const V of [ROAD.stadiumV1 + 1.2, ROAD.stadiumV0 - 1.2]) {
      const p = at(c, X, V);
      add(c, V, () => {
        const cls = sizeClass(p.s);
        if (cls === 2) {
          drawBollard(
            s,
            p.x,
            p.y,
            tone(P.slate),
            tone(P.night),
            tone(P.gold),
            tone(P.goldLight),
          );
        } else if (cls === 1) {
          s.rect(p.x, p.y - 2, 2, 2, tone(P.slate));
          s.px(p.x, p.y - 3, tone(P.gold));
        }
      });
    }
  }
  // gates: a rail either side of each queue
  for (let b = 1; b < BAYS / 2; b += 3) {
    const a = (b / BAYS) * Math.PI * 2 - Math.PI;
    const p0 = wallPoint(a, 1.012);
    const p1 = wallPoint(a, 1.075);
    for (const off of [-1.6, 1.6]) {
      const q0 = at(c, p0.X + off * Math.sin(a), p0.V - off * Math.cos(a), 0.9);
      const q1 = at(c, p1.X + off * Math.sin(a), p1.V - off * Math.cos(a), 0.9);
      add(c, p1.V, () => {
        s.line(q0.x, q0.y, q1.x, q1.y, tone(P.steel));
        // a rail is a thing, twice as thick, lit on top

        s.line(q0.x, q0.y + 1, q1.x, q1.y + 1, tone(P.slate));
        s.line(q0.x, q0.y, q1.x, q1.y, tone(P.steelHi));
      });
    }
  }
}

/** West: verge trees, the coach park, the avenue's trees, Westgate beyond. */
function westSide(c: Ctx): void {
  // trees along both side roads, on the stadium's side
  for (const side of [-1, 1]) {
    for (let V = -98; V < 118; V += 13) {
      addTree(c, side * 162.5, V + c.h(V, side + 9) * 4, 5000 + V + side);
      if (c.h(V, side + 19) < 0.5)
        addBush(c, side * 160.5, V + 6, 5200 + V + side);
    }
  }
  // behind the ground: a belt of trees along North Road
  for (let X = -160; X < 162; X += 11) {
    if (Math.abs(X) < 14) continue;
    addTree(
      c,
      X + c.h(X, 4) * 5,
      116 - c.h(X, 5) * 6,
      5400 + X,
      c.h(X, 6) < 0.25 ? 1 : 0,
    );
  }
  // the coach park: coaches nose to tail in long bays, cars at the far end
  let n = 0;
  for (let V = COACHES.v1 - 12; V > COACHES.v0 + 4; V -= 6.5) {
    n++;
    const p = at(c, -203, V);
    if (!seen(c, p, 40)) continue;
    const r = c.h(n, 61);
    if (V > 84) {
      for (let X = -220; X < -182; X += Math.max(4, 5 / p.s)) {
        if (c.h(Math.round(X), n + 70) < 0.8)
          addCar(c, X, V, n % 2 === 0 ? 3 : 2, n * 91 + Math.round(X));
      }
      continue;
    }
    if (r > 0.84 || Math.abs(V - COACH_BAY.V) < 1) continue;
    // the away coaches park together, at the far end
    const pick = V > 20 ? 1 + (n % 2) : [0, 3, 4, 5, 0, 3][n % 6];
    const look = coachLook(c.tone, V, pick);
    const X = -205 + (n % 2) * 3;
    const q = at(c, X, V);
    add(c, V, () => coach(c.s, q.x, q.y, sizeClass(q.s), look));
    if (r < 0.3 && X < -190) {
      const q2 = at(c, -187, V);
      const heading = mapHeading(c.view, -187, V, 2);
      add(c, V, () =>
        car(
          c.s,
          q2.x,
          q2.y,
          sizeClass(q2.s),
          heading,
          carLook(c.tone, V, r * 3),
        ),
      );
    }
  }
  for (let V = COACHES.v0 + 6; V < COACHES.v1 - 4; V += 17) {
    addTree(c, COACHES.x0 + 1.5, V, 5600 + V);
  }
  // the avenue: trees down the middle, all the way out
  for (let V = -150; V < 190; V += 15) addTree(c, -240, V, 5700 + V);
  for (let V = 240; V < 620; V += 24) addTree(c, -240, V, 5800 + V);

  // Westgate: the school, then streets
  const { s, view, tone } = c;
  add(c, 4, () => {
    box(
      s,
      view,
      tone,
      -326,
      -268,
      4,
      21,
      {
        roof: P.concreteLight,
        roofShade: P.concreteLight,
        wall: P.brickLight,
        side: P.brick,
      },
      { H: 6.5 },
    );
    const a = at(c, -322, 8, 6.5);
    const b = at(c, -272, 17, 6.5);
    for (let i = 0; i < 5; i++) {
      // roof lights over the classrooms: framed, two panes each
      const x = Math.round(a.x + ((b.x - a.x) * i) / 5) + 4;
      const y = Math.round((a.y + b.y) / 2);
      s.rect(x - 1, y - 1, 6, 4, tone(P.concrete, 10));
      s.rect(x, y, 4, 2, tone(P.skyLow, 10));
      s.px(x + 2, y, tone(P.concrete, 10));
      s.px(x, y, tone(P.white, 10));
    }
  });
  add(c, -5, () => {
    box(
      s,
      view,
      tone,
      -326,
      -308,
      -5,
      4,
      {
        roof: P.steel,
        roofShade: P.concreteDark,
        wall: P.brickLight,
        side: P.brick,
      },
      { H: 5, R: 3 },
    );
  });
  for (let i = 0; i < 7; i++) addTree(c, -332 + i * 11, -60, 5900 + i);
  streetsGrid(
    c,
    -1200,
    -256,
    -330,
    168,
    (X, V) => X > -340 && X < -256 && V > -70 && V < 30,
  );
  streetsGrid(c, -1200, -430, -330, 168, () => false);
}

/** East: Victoria Park, Park Lane, and the streets beyond. */
function eastSide(c: Ctx): void {
  const { s, view, tone } = c;
  // the park's trees: thick along the edges, loose groves inside
  let key = 6000;
  for (let V = PARK.v0 + 6; V < PARK.v1 - 2; V += 9) {
    addTree(c, PARK.x0 + 5 + c.h(V, 1) * 3, V, key++, c.h(V, 2) < 0.2 ? 1 : 0);
    addTree(c, PARK.x1 - 5 - c.h(V, 3) * 3, V, key++);
  }
  for (let X = PARK.x0 + 14; X < PARK.x1 - 8; X += 10) {
    addTree(c, X, PARK.v1 - 5 - c.h(X, 4) * 4, key++, c.h(X, 5) < 0.3 ? 1 : 0);
    addTree(c, X + 3, PARK.v0 + 6 + c.h(X, 6) * 4, key++);
  }
  for (let i = 0; i < 46; i++) {
    const X = PARK.x0 + 20 + c.h(i, 7) * (PARK.x1 - PARK.x0 - 40);
    const V = PARK.v0 + 20 + c.h(i, 8) * (PARK.v1 - PARK.v0 - 40);
    const dx = (X - POND.x) / (POND.a + 9);
    const dv = (V - POND.v) / (POND.b + 8);
    if (dx * dx + dv * dv < 1) continue;
    if (X > 258 && X < 326 && V > -74 && V < -8) continue;
    if (X > 196 && X < 250 && V > 62 && V < 104) continue;
    addTree(c, X, V, key++, c.h(i, 9) < 0.18 ? 1 : 0);
    if (c.h(i, 10) < 0.5) addBush(c, X + 5, V - 2, key++);
  }
  // willows and reeds round the pond, the island's tree, ducks
  addTree(c, POND.x + 5, POND.v - 1, key++);
  addBush(c, POND.x - POND.a - 2, POND.v + 3, key++);
  addBush(c, POND.x + POND.a + 1, POND.v - 4, key++);
  addBush(c, POND.x - 8, POND.v + POND.b + 1, key);
  // the bandstand
  add(c, 78, () => {
    box(
      s,
      view,
      tone,
      262,
      272,
      78,
      86,
      {
        roof: P.homeLight,
        roofShade: P.home,
        wall: P.chalk,
        side: P.steelHi,
      },
      { H: 3.6, R: 3 },
    );
  });
  // flower beds by the path
  for (let i = 0; i < 5; i++) {
    const p = at(c, 246 + i * 4.4, 70);
    add(c, 70, () => {
      const a = tone(i % 2 ? P.gold : P.home, 70);
      const b = tone(i % 2 ? P.chalk : P.gold, 70);
      if (sizeClass(p.s) === 0) {
        c.s.rect(p.x, p.y - 2, 2, 2, a);
        return;
      }
      // a bed edged in dark earth, flowers in two colours among the leaves
      c.s.rect(p.x - 2, p.y - 3, 6, 4, tone(P.woodDark, 70));
      c.s.rect(p.x - 2, p.y - 3, 6, 3, tone(P.grassDeep, 70));
      for (const [dx, dy, col] of [
        [-2, -3, a],
        [1, -3, b],
        [0, -2, a],
        [3, -2, a],
        [-1, -1, b],
        [2, -1, a],
      ] as const) {
        c.s.px(p.x + dx, p.y + dy, col);
      }
    });
  }
  // benches facing the pond
  for (const bx of [-14, 2, 18]) {
    const p = at(c, POND.x + bx, POND.v - POND.b - 5);
    add(c, POND.v - POND.b - 5, () => {
      // a park bench: its back, the seat, two iron legs
      const w2 = sizeClass(p.s) === 0 ? 4 : 6;
      c.s.rect(p.x - 2, p.y - 3, w2, 1, tone(P.woodDark, 20));
      c.s.rect(p.x - 2, p.y - 2, w2, 1, tone(P.wood, 20));
      c.s.px(p.x - 2, p.y - 1, tone(P.ink, 20));
      c.s.px(p.x + w2 - 3, p.y - 1, tone(P.ink, 20));
    });
  }
  // the playground in the south of the park
  add(c, -92, () => {
    const p = at(c, 300, -92);
    if (!seen(c, p)) return;

    // the swings: a frame in the club's colours, two seats on their chains, a slide
    const red = tone(P.home, -90);
    const dark = tone(P.homeDark, -90);
    c.s.rect(p.x - 12, p.y - 10, 2, 10, red);
    c.s.px(p.x - 11, p.y - 9, dark);
    c.s.rect(p.x + 12, p.y - 10, 2, 10, red);
    c.s.rect(p.x + 13, p.y - 9, 1, 9, dark);
    c.s.rect(p.x - 12, p.y - 10, 26, 2, tone(P.gold, -90));
    c.s.rect(p.x - 12, p.y - 9, 26, 1, tone(P.goldDark, -90));
    for (const sx of [-6, 4]) {
      c.s.rect(p.x + sx, p.y - 8, 1, 5, tone(P.steel, -90));
      c.s.rect(p.x + sx + 3, p.y - 8, 1, 5, tone(P.steel, -90));
      c.s.rect(p.x + sx, p.y - 3, 4, 1, tone(P.ink, -90));
    }
    // sand under them
    c.s.rect(p.x - 8, p.y, 18, 1, tone(P.goldLight, -90));
  });

  // cars parked along East Road and West Road
  // G2: only where no traffic runs beside them, beyond North Road (none on Park Lane,
  // whose lanes run its whole length): at the size the cars are drawn a row of parked
  // cars and a lane do not fit side by side on these roads, and the moving cars drove
  // over the parked ones (traffic-overlap.test.ts).
  for (let V = -100; V < 150; V += 8) {
    if (V < ROAD.northV1 + 6) continue;
    if (c.h(V, 40) < 0.55) addCar(c, ROAD.eastX1 - 2.2, V, 2, 6400 + V);
    if (c.h(V, 41) < 0.5) addCar(c, ROAD.westX0 + 2.2, V, 3, 6500 + V);
  }
  streetsGrid(c, 352, 1200, -330, 168, () => false);
}

/** Behind the ground: allotments, the north car park, the station. */
function northStrip(c: Ctx): void {
  const { s, view, tone } = c;
  // allotment sheds and bean rows
  for (let i = 0; i < 22; i++) {
    const X = -220 + i * 9 + 2.5;
    if (X > -30) break;
    const V = 136 + c.h(i, 80) * 24;
    if (c.h(i, 81) < 0.7) {
      add(c, V, () =>
        box(
          s,
          view,
          tone,
          X,
          X + 3.4,
          V,
          V + 3,
          {
            roof: c.h(i, 82) < 0.5 ? P.wood : P.concreteLight,
            roofShade: P.woodDark,
            wall: P.woodDark,
            side: P.hairDark,
          },
          { H: 2.2, R: 1 },
        ),
      );
    }
    if (c.h(i, 83) < 0.35) addTree(c, X + 5, 134 + c.h(i, 84) * 30, 7000 + i);
  }
  // the north car park
  for (let row = 0; row < 5; row++) {
    const V = 133.5 + Math.floor(row / 2) * 13 + (row % 2) * 8.5;
    if (V > 164) break;
    const p = at(c, 60, V);
    const step = Math.max(4, 3.4 / p.s);
    for (let X = -14; X < 142; X += step) {
      if (c.h(Math.round(X), row + 90) < 0.84)
        addCar(c, X, V, row % 2 === 0 ? 2 : 3, row * 71 + Math.round(X));
    }
  }
  // the station: the building, two canopies, the footbridge, taxis
  add(c, 158, () => {
    box(
      s,
      view,
      tone,
      204,
      240,
      158,
      166,
      {
        roof: P.steel,
        roofShade: P.concreteDark,
        wall: P.brickLight,
        side: P.brick,
      },
      { H: 6, R: 3.5 },
    );
    const t = at(c, 222, 158, 6);
    const top = at(c, 222, 158, 14);

    // the clock tower: lit on its left, a slate cap, a clock face with its hands
    s.rect(t.x - 2, top.y, 6, t.y - top.y + 1, tone(P.brickLight, 158));
    s.rect(t.x + 2, top.y, 2, t.y - top.y + 1, tone(P.brick, 158));
    s.rect(t.x - 3, top.y - 2, 8, 2, tone(P.steel, 158));
    s.rect(t.x - 1, top.y - 4, 4, 2, tone(P.concreteDark, 158));
    s.rect(
      t.x - 1,
      top.y + 2,
      4,
      4,
      c.night ? P.goldLight : tone(P.chalk, 158),
    );
    s.rect(t.x, top.y + 3, 1, 2, tone(P.ink, 158));
    s.px(t.x + 1, top.y + 4, tone(P.ink, 158));
  });
  for (const v of [RAIL.v0 + 0.4, RAIL.v1 - 2.4]) {
    add(c, v, () =>
      box(
        s,
        view,
        tone,
        STATION.x0 + 4,
        STATION.x1 - 6,
        v,
        v + 2,
        {
          roof: P.steelHi,
          roofShade: P.steelHi,
          wall: P.homeDark,
          side: P.homeDark,
        },
        { H: 3.2, noShadow: true },
      ),
    );
  }
  add(c, RAIL.v0 - 1, () =>
    box(
      s,
      view,
      tone,
      250,
      254,
      RAIL.v0 - 1,
      RAIL.v1 + 1,
      {
        roof: P.concreteLight,
        roofShade: P.concreteLight,
        wall: P.concrete,
        side: P.concrete,
      },
      { H: 5.5, noShadow: true },
    ),
  );
  for (let i = 0; i < 6; i++) {
    const p = at(c, 192 + i * 9, 148);
    const look = carLook(tone, 148, i % 3 === 0 ? 0.99 : 0.36);
    add(c, 148, () => car(s, p.x, p.y, sizeClass(p.s), EAST, look));
  }
  for (let i = 0; i < 5; i++) addTree(c, 156 + i * 7, 134, 7100 + i);
  // signals and a signal box by the line
  add(c, RAIL.v1 + 1, () =>
    box(
      s,
      view,
      tone,
      120,
      127,
      RAIL.v1 + 1,
      RAIL.v1 + 5,
      {
        roof: P.steel,
        roofShade: P.concreteDark,
        wall: P.chalk,
        side: P.concreteLight,
      },
      { H: 4.5, R: 2 },
    ),
  );
}

/** Beyond the railway: rooftops in rows, mills, towers, the river's bridges, fields. */
function farTown(c: Ctx, town: Town): void {
  const { s, view, tone } = c;
  const span = (view.w / 2 / Math.max(0.05, view.k)) * 3.4;
  for (let j = 0; j < 14; j++) {
    const Vb = 196 + j * 26;
    for (
      let bx = Math.floor((-span + 40) / 130);
      bx <= Math.floor((span + 40) / 130);
      bx++
    ) {
      const X0 = bx * 130 - 40 + 8;
      const block = bx * 17 + j;
      const rm = riverMid(X0 + 60);
      if (Math.abs(Vb + 13 - rm) < 26) {
        // the river bank: trees, and a mill or two
        for (let i = 0; i < 6; i++) {
          if (c.h(block, i) < 0.6)
            addTree(
              c,
              X0 + i * 20 + c.h(block, i + 7) * 9,
              rm + (i % 2 === 0 ? 13 : -13),
              block * 9 + i,
            );
        }
        continue;
      }
      if (c.h(block, 5) < 0.16) {
        // a green: trees round a square
        for (let i = 0; i < 7; i++)
          addTree(
            c,
            X0 + 6 + i * 17,
            Vb + 8 + c.h(block, i + 20) * 12,
            block * 11 + i,
          );
        continue;
      }
      const style = Math.floor(c.h(block, 3) * 4);
      const gap = c.h(block, 6);
      for (const [v0, k2] of [
        [Vb + 5.5, 0],
        [Vb + 16, 1],
      ] as const) {
        const cut = 20 + Math.floor(gap * 70);
        const look = HOUSE_LOOKS[(style + k2) % 4];
        const a = at(c, X0, v0);
        const b = at(c, X0 + 118, v0);
        if (b.x < -4 || a.x > view.w + 4) continue;
        add(c, v0, () => {
          box(s, view, tone, X0, X0 + cut - 3, v0, v0 + 6, look, {
            H: 5,
            R: 3,
            noShadow: true,
          });
          box(s, view, tone, X0 + cut + 3, X0 + 118, v0, v0 + 6, look, {
            H: 5,
            R: 3,
            noShadow: true,
          });
          if (c.night) {
            for (let x = a.x; x < b.x; x += 2) {
              // a window is two pixels wide (the same on screen), on the same hash
              const hx = x >> 1;
              if (c.h(hx, block + k2 * 3 + 300) < 0.2) {
                const col = c.h(hx, block) < 0.6 ? P.gold : P.amber;
                s.rect(x, a.y - 2, 2, 1, col);
              }
            }
          }
        });
      }
    }
  }
  // landmarks: mills with chimneys, tower blocks, a church, a gasometer
  const mill = (X: number, V: number, key: number): void => {
    const p = at(c, X, V);
    if (p.x < -40 || p.x > view.w + 40) return;
    add(c, V, () => {
      for (let i = 0; i < 4; i++) {
        box(
          s,
          view,
          tone,
          X + i * 9,
          X + i * 9 + 9,
          V,
          V + 22,
          {
            roof: P.concreteLight,
            roofShade: P.steel,
            wall: P.brick,
            side: P.brickDark,
          },
          { H: 9, R: 3, ridge: "ns", noShadow: i > 0 },
        );
      }
      const foot = at(c, X + 40, V + 4, 0);
      const top = at(c, X + 40, V + 4, 42);
      const wide = foot.s > 1.2 ? 4 : 2;
      s.rect(foot.x, top.y, wide, foot.y - top.y, tone(P.brick, V));
      if (wide >= 2)
        s.rect(
          foot.x + wide / 2,
          top.y,
          wide / 2,
          foot.y - top.y,
          tone(P.brickDark, V),
        );
      s.rect(foot.x, top.y, wide, 2, tone(P.chalk, V));

      // bands of darker brick up the stack
      for (let y = top.y + 6; y < foot.y - 4; y += 8) {
        s.rect(foot.x, y, wide, 1, tone(P.brickDark, V));
      }

      town.chimneys.push({ x: foot.x, y: top.y - 1, big: true });
      void key;
    });
  };
  mill(-470, 262, 1);
  mill(330, 300, 2);
  mill(-120, 350, 3);
  const tower = (X: number, V: number, H: number, key: number): void => {
    const p = at(c, X, V);
    if (p.x < -30 || p.x > view.w + 30) return;
    add(c, V, () => {
      box(
        s,
        view,
        tone,
        X,
        X + 16,
        V,
        V + 12,
        {
          roof: P.concrete,
          roofShade: P.concrete,
          wall: P.steelHi,
          side: P.mist,
        },
        { H },
      );
      const foot = at(c, X, V, 0);
      const top = at(c, X, V, H);
      const end = at(c, X + 16, V, 0);

      // a window on every floor of every flat: 2 x 2 with a balcony slab under each row
      for (let y = top.y + 2; y < foot.y - 2; y += 4) {
        for (let x = foot.x + 2; x < end.x - 1; x += 4) {
          const litW = c.night && c.h((x >> 1) + key * 50, y >> 1) < 0.45;
          s.rect(x, y, 2, 2, litW ? P.gold : tone(P.steel, V));
          if (!litW && !c.night) s.px(x, y, tone(P.mist, V));
        }
        s.rect(foot.x + 1, y + 2, end.x - foot.x - 2, 1, tone(P.mist, V));
      }
    });
  };
  tower(250, 250, 46, 1);
  tower(284, 268, 38, 2);
  tower(-360, 330, 42, 3);
  tower(520, 290, 44, 4);
  tower(-640, 300, 40, 5);
  // the church: a nave, a tower, a spire
  const church = (X: number, V: number): void => {
    const p = at(c, X, V);
    if (p.x < -30 || p.x > view.w + 30) return;
    add(c, V, () => {
      box(
        s,
        view,
        tone,
        X,
        X + 22,
        V,
        V + 9,
        {
          roof: P.steel,
          roofShade: P.concreteDark,
          wall: P.concreteLight,
          side: P.concrete,
        },
        { H: 9, R: 5 },
      );
      box(
        s,
        view,
        tone,
        X - 6,
        X,
        V + 1,
        V + 7,
        {
          roof: P.concrete,
          roofShade: P.concrete,
          wall: P.concreteLight,
          side: P.concrete,
        },
        { H: 20 },
      );
      const top = at(c, X - 3, V + 4, 20);
      const tip = at(c, X - 3, V + 4, 34);
      for (let y = tip.y; y < top.y; y++) {
        const half = Math.round(
          ((y - tip.y) / Math.max(1, top.y - tip.y)) * (3 * top.s),
        );
        s.rect(top.x - half, y, half * 2 + 1, 1, tone(P.steel, V));
      }
    });
  };
  church(60, 290);
  church(-590, 250);
  // the gasometer: a drum in a frame
  const gas = at(c, -250, 300);
  if (seen(c, gas, 30)) {
    add(c, 296, () => {
      const top = at(c, -250, 300, 24);
      const rx = Math.max(4, Math.round(13 * gas.s));
      const ry = Math.max(2, Math.round(rx * 0.3));
      s.rect(
        gas.x - rx,
        top.y,
        rx * 2 + 1,
        gas.y - top.y,
        tone(P.concrete, 300),
      );
      s.rect(gas.x, top.y, rx + 1, gas.y - top.y, tone(P.concreteDark, 300));
      s.ellipse(gas.x, top.y, rx, ry, tone(P.concreteLight, 300), true);
      for (const dx of [-rx - 2, 0, rx + 1]) {
        s.rect(gas.x + dx, top.y - 6, 2, gas.y - top.y + 6, tone(P.slate, 300));
      }

      // the guide frame's girders
      s.rect(gas.x - rx - 2, top.y - 6, rx * 2 + 5, 1, tone(P.slate, 300));
      s.rect(
        gas.x - rx - 2,
        Math.round((top.y + gas.y) / 2),
        rx * 2 + 5,
        1,
        tone(P.slate, 300),
      );
    });
  }
  // fields and woods out to the hills: hedgerow trees and farms
  for (let i = 0; i < 150; i++) {
    const V = 580 + c.h(i, 200) * c.h(i, 203) * 2600;
    const X = (c.h(i, 201) - 0.5) * 2 * span * (1 + V / 600);
    addTree(c, X, V, 8000 + i);
    if (i % 3 === 0) {
      addTree(c, X + 16, V + 3, 8200 + i);
      addTree(c, X + 31, V - 2, 8400 + i);
    }
  }
}

// ---------------------------------------------------------------------------
// Lamps
// ---------------------------------------------------------------------------

interface LampSpot {
  X: number;
  V: number;
  cool: boolean;
  tall: boolean;
}

function lampSpots(c: Ctx): LampSpot[] {
  const out: LampSpot[] = [];
  for (let X = -600; X <= 600; X += 30) {
    if (Math.abs(X) < PLAZA_HALF - 4) continue;
    out.push({ X, V: ROAD.stadiumV1 + 1.4, cool: false, tall: false });
    out.push({ X: X + 15, V: ROAD.stadiumV0 - 1.4, cool: false, tall: false });
  }
  for (let V = -92; V < 164; V += 32) {
    out.push({ X: ROAD.westX1 + 1.5, V, cool: false, tall: false });
    out.push({ X: ROAD.eastX0 - 1.5, V: V + 12, cool: false, tall: false });
    out.push({ X: ROAD.laneX0 - 1.5, V: V + 6, cool: false, tall: false });
  }
  for (let V = -150; V < 190; V += 30) {
    out.push({ X: -240, V: V + 7, cool: false, tall: true });
  }
  for (let V = 215; V < 600; V += 34) {
    out.push({ X: -240, V, cool: false, tall: true });
  }
  // the plaza: lamps down both edges
  for (let V = ROAD.stadiumV0 - 10; V > -260; V -= 18) {
    out.push({ X: -PLAZA_HALF + 3, V, cool: false, tall: true });
    out.push({ X: PLAZA_HALF - 3, V, cool: false, tall: true });
  }
  // car parks: tall white lamps on the aisles
  for (let band = 0; band < 7; band++) {
    for (let X = CARPARK.x0 + 22; X < CARPARK.x1; X += 44) {
      // on the kerbs between the rows, clear of the aisles the cars drive down
      out.push({
        X,
        V: LOT_TOP - band * BAND + (band === 0 ? 0.5 : 1.5),
        cool: true,
        tall: true,
      });
    }
  }
  for (let V = COACHES.v0 + 14; V < COACHES.v1; V += 38) {
    out.push({ X: -181, V, cool: true, tall: true });
  }
  for (let X = 0; X < 140; X += 46)
    out.push({ X, V: 139.5, cool: true, tall: true });
  // the park: lamps round the pond
  out.push({ X: POND.x - POND.a - 4, V: POND.v - 6, cool: false, tall: false });
  out.push({ X: POND.x + POND.a + 4, V: POND.v + 4, cool: false, tall: false });
  out.push({ X: 252, V: -30, cool: false, tall: false });
  out.push({ X: 215, V: 96, cool: false, tall: false });
  // the concourse: a ring of lamps
  for (let i = 0; i < 20; i++) {
    const w = wallPoint((i / 20) * Math.PI * 2 + 0.16, 1.15);
    if (Math.abs(w.X) < 40 && w.V < 0) continue;
    out.push({ X: w.X, V: w.V, cool: true, tall: true });
  }
  void c;
  return out;
}

/** Pools of light on the ground, before anything stands on it. */
function paintPools(c: Ctx, town: Town): void {
  for (const l of lampSpots(c)) {
    const p = at(c, l.X, l.V);
    if (!seen(c, p, 40)) continue;
    if (p.s < 0.6) continue;
    const rx = Math.max(4, Math.round((l.tall ? 9 : 7) * p.s));
    const ry = Math.max(2, Math.round(rx * 0.42));
    // the pool lies under the lamp's head, which reaches out over the road
    const off = l.tall && p.s >= 1.48 ? (l.X < 0 ? 6 : -6) : 0;
    lightPool(c.s, p.x + off, p.y, rx, ry, l.cool);

    const lamp = lampHeight(sizeClass(p.s), l.tall);
    town.pools.push({ x: p.x + off, y: p.y, rx, ry, lamp });
  }
}

function lamps(c: Ctx): void {
  const { s } = c;
  for (const l of lampSpots(c)) {
    const p = at(c, l.X, l.V);
    if (!seen(c, p, 24)) continue;
    const cls = sizeClass(p.s);
    const post = c.tone(P.slate, l.V);
    const head = c.night
      ? l.cool
        ? P.white
        : P.goldLight
      : c.tone(P.steelHi, l.V);

    // two and a half times as tall as the people under them (`lampHeight`)
    const look: LampLook = {
      post: c.tone(P.steel, l.V),
      postShade: post,
      cap: c.tone(P.night, l.V),
      glow: c.night ? head : c.tone(P.mist, l.V),
      night: c.night,
    };
    const right = l.X < 0;
    add(c, l.V, () => drawLamp(s, p.x, p.y, cls, l.tall, look, right));
  }
}
