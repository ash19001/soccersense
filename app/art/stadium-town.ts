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
import { BAYS, paintBowl, wallPoint, type Bowl } from "~/art/stadium-bowl";
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
import { paintSkyline } from "~/art/stadium-skyline";
import {
  box,
  bush,
  car,
  castOn,
  coach,
  conifer,
  lightPool,
  person,
  shadowBlob,
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
   * For every pixel of the screen, how far away (V) the static thing painted there is:
   * very far for the bare ground. Moving things are hidden by anything nearer.
   */
  depth: Float32Array;
}

const SKYLINE_H = 40;
/** Where the stadium sits in the painting order: behind everything on its near concourse. */
const BOWL_V = -58;

/**
 * Draw every item, far to near, and note in the depth mask which pixels each slice of
 * depth painted (by comparing the rows it can reach before and after).
 */
function drawItems(c: Ctx, town: Town): void {
  const { s, view } = c;
  const { w, h } = view;
  const items = c.items;
  items.sort((a, b) => b.V - a.V);
  const data = s.data;
  const depth = town.depth;
  const prev = new Uint32Array(w * h);
  let i = 0;
  while (i < items.length) {
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
    for (let n = i; n < j; n++) items[n].draw();
    for (let p = y0 * w; p < y1 * w; p++) {
      if (data[p] !== prev[p]) depth[p] = lo;
    }
    i = j;
  }
}

export function paintTown(view: View, light: Lighting, seed: number): Town {
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
    depth: new Float32Array(w * h).fill(1e9),
  };

  paintHills(c, town);
  // the city stays under the logo zone, however short the screen
  s.pushClip(0, view.logoH, w, h);
  town.beacons.push(...paintSkyline(s, view, light, seed));
  s.popClip();
  paintGround(c);
  if (night) paintPools(c);

  const bowl = paintBowl(
    view,
    {
      lit: light.lit,
      env: light.env,
      lightsOn: night,
      sunny: light.sun.elevation > 3,
    },
    seed,
  );
  town.bowl = bowl;
  c.items.push({
    V: BOWL_V,
    bowl: true,
    draw: () => s.blit(bowl.layer, bowl.x, bowl.y),
  });

  farTown(c, town);
  northStrip(c);
  westSide(c);
  eastSide(c);
  southWest(c, town);
  southEast(c);
  concourse(c, town);
  lamps(c);

  castOn(s);
  drawItems(c, town);
  castOn(null);

  const landH = Math.max(1, h - hy);
  const land = new Surface(w, landH);
  land.blit(s, 0, -hy);
  // Anything still unpainted in the land (it should not be) takes the haze.
  const haze = distant(light, P.grassDark, 1);
  for (let i = 0; i < land.data.length; i++) {
    if (land.data[i] === 0) land.data[i] = haze;
  }
  const skylineY = Math.max(0, hy - SKYLINE_H);
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

/** The ground itself, row by row: every pixel asks the plan what is there. */
function paintGround(c: Ctx): void {
  const { s, view, light, seed } = c;
  const { w, h, hy, cx, k } = view;
  const sky = skyFor(light);
  const water = mix(sky.bands[3], light.env(P.skyMid), 0.35);
  const waterHi = mix(sky.bands[5], light.env(P.skyLow), 0.3);
  const waterLo = mix(sky.bands[1], light.env(P.skyTop), 0.4);
  const data = s.data;
  for (let y = hy; y < h; y++) {
    const V = depthAtRow(view, y + 0.5);
    const sc = (k * ZC) / (ZC + V);
    const e = hazeAt(view, V) * 8;
    const lo = Math.floor(e);
    const f = e - lo;
    for (let x = 0; x < w; x++) {
      const X = (x + 0.5 - cx) / sc;
      const g = groundAt(X, V, sc, seed);
      let col: Color;
      if (g.c === WATER) col = water;
      else if (g.c === WATER_HI) col = waterHi;
      else if (g.c === WATER_LO) col = waterLo;
      else if (g.lit) col = light.lit(g.c as Color);
      else {
        const step = f > 0.25 + 0.5 * bayer4(x, y) ? lo + 1 : lo;
        col = distant(light, g.c as Color, step / 8);
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
  const unit = Math.max(0.45, k);
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
    const ha = Math.max(1, Math.round(a * Math.min(1.5, unit + 0.3)));
    const hb = Math.max(0, Math.round(b * Math.min(1.5, unit + 0.3)));
    s.rect(x, hy - ha, 1, ha, far);
    if (hb > 0) s.rect(x, hy - hb, 1, hb, nearer);
  }
  // wind turbines on the left, a mast on the right
  const post = distant(light, P.chalk, 0.75);
  for (let i = 0; i < 3; i++) {
    const x = Math.round(view.cx - (212 - i * 17) * unit);
    if (x < 2 || x > w - 3) continue;
    const top = hy - 9 - (i % 2);
    s.rect(x, top, 1, 9, post);
    town.turbines.push({ x, y: top });
  }
  const mx = Math.round(view.cx + 196 * unit);
  if (mx > 2 && mx < w - 2) {
    const mast = distant(light, P.concreteDark, 0.7);
    s.rect(mx, hy - 13, 1, 12, mast);
    s.px(mx - 1, hy - 4, mast);
    s.px(mx + 1, hy - 4, mast);
    s.px(mx - 1, hy - 8, mast);
    s.px(mx + 1, hy - 8, mast);
    town.beacons.push({ x: mx, y: hy - 14 });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function at(c: Ctx, X: number, V: number, H = 0): Spot {
  return project(c.view, X, V, H);
}

function seen(c: Ctx, p: Spot, margin = 30): boolean {
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
  if (!seen(c, p, 14)) return;
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
  if (!seen(c, p, 8)) return;
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
  };
}

function addCar(c: Ctx, X: number, V: number, dir: number, key: number): void {
  const p = at(c, X, V);
  if (!seen(c, p, 10)) return;
  const look = carLook(c.tone, V, c.h(key, 31));
  add(c, V, () => car(c.s, p.x, p.y, sizeClass(p.s), dir, look));
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
  };
}

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
const HAIRS: readonly Color[] = [
  P.hairDark,
  P.hairBrown,
  P.hairBlond,
  P.hairDark,
  P.chalk,
  P.home,
];
const SKINS: readonly Color[] = [P.skinA, P.skinB, P.skinC, P.skinA];

/** A supporter's clothes: `kind` 0 home, 1 away, 2 steward, 3 anyone. */
export function personLook(
  tone: (c: Color) => Color,
  r: number,
  kind = 0,
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
          : SHIRTS_HOME[i % SHIRTS_HOME.length];
  return {
    shirt: tone(shirt),
    hair: tone(HAIRS[(i >> 2) % HAIRS.length]),
    skin: tone(SKINS[(i >> 4) % SKINS.length]),
    legs: tone(i % 3 === 0 ? P.slate : P.night),
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
  if (!seen(c, p, 6)) return;
  const look = personLook(
    floodlit ? c.lit : (col) => c.tone(col, V),
    c.h(key, 53),
    kind,
  );
  add(c, V - 0.01, () => {
    const cls = sizeClass(p.s);
    if (cls === 2) shadowBlob(c.s, p.x + 1, p.y, 1.5, 0.5);
    person(c.s, p.x, p.y, cls, look, 0);
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
  if (b.x < -8 || a.x > view.w + 8) return;
  if (at(c, X0, V1, HOUSE_H + HOUSE_R).y > view.h + 4 || a.y < view.hy - 2) {
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
        s.px(p.x, p.y - 1, tone(P.brickDark, Vm));
      }
      if (c.night) {
        for (let i = 0; i < n; i++) {
          if (c.h(i, o.key + 5) < 0.42) {
            const p = at(c, X0 + (i + 0.5) * lw, V0, 2);
            s.px(p.x, p.y, c.h(i, o.key) < 0.5 ? P.gold : P.amber);
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
        s.rect(
          q.x,
          q.y,
          2,
          2,
          c.night && r > 0.86 ? P.gold : tone(P.steelHi, V0),
        );
      }
      const ch = at(c, Xl + lw * 0.16, Vm, HOUSE_H + HOUSE_R);
      if (cls === 2) {
        s.rect(ch.x, ch.y - 3, 2, 4, tone(P.brickDark, Vm));
        s.rect(ch.x, ch.y - 4, 2, 1, tone(P.brickLight, Vm));
        if (town && r < 0.3)
          town.chimneys.push({ x: ch.x, y: ch.y - 5, big: false });
      } else {
        s.rect(ch.x, ch.y - 2, 1, 2, tone(P.brickDark, Vm));
      }
      // the wall facing the camera: a window and a door
      const foot = at(c, Xl, V0, 0);
      const eave = at(c, Xl, V0, HOUSE_H);
      const wh = foot.y - eave.y;
      const wpx = Math.round(lw * foot.s);
      const lit = c.night && c.h(i, o.key + 5) < 0.6;
      const glass = lit ? (r < 0.5 ? P.gold : P.goldLight) : windowOff;
      if (wh >= 6 && wpx >= 9) {
        const wx = foot.x + Math.round(wpx * 0.18);
        s.rect(wx, eave.y + 2, 3, 3, glass);
        if (!lit) s.px(wx, eave.y + 2, tone(P.mist, V0));
        const dx = foot.x + Math.round(wpx * 0.62);
        const door = [P.woodDark, P.slate, P.homeDark, P.awayDark, P.grassDeep][
          Math.floor(r * 5)
        ];
        s.rect(dx, foot.y - 4, 2, 4, tone(door, V0));
        if (!o.backs) s.px(dx + 3, eave.y + 2, glass);
      } else if (wh >= 3) {
        s.px(foot.x + Math.max(1, Math.round(wpx * 0.3)), eave.y + 1, glass);
        if (wpx >= 6) {
          s.px(
            foot.x + Math.round(wpx * 0.7),
            foot.y - 1,
            tone(P.woodDark, V0),
          );
        }
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
        s.line(w0.x, w0.y, w1.x, w1.y, tone(P.steelHi, V0));
        const wash = [P.home, P.white, P.away, P.gold, P.white, P.home];
        const steps = Math.max(2, Math.floor((w1.y - w0.y) / 3));
        for (let j = 1; j < steps; j++) {
          const yy = w0.y + j * 3;
          const xx = Math.round(
            w0.x + ((w1.x - w0.x) * (yy - w0.y)) / Math.max(1, w1.y - w0.y),
          );
          s.rect(xx, yy - 1, 2, 2, tone(wash[(i + j) % wash.length], V0));
        }
      });
    }
    // a trampoline, a paddling pool, a greenhouse
    if (r > 0.9) {
      const q = at(c, Xl + lw * 0.62, V0 - depth * 0.55);
      add(c, V0 - depth * 0.55, () => {
        shadowBlob(s, q.x + 1, q.y + 1, 4, 2);
        s.ellipse(q.x, q.y - 1, 4, 2, tone(P.night, V0), true);
        s.ellipse(q.x, q.y - 1, 4, 2, tone(P.away, V0));
      });
    } else if (r > 0.84) {
      const q = at(c, Xl + lw * 0.6, V0 - depth * 0.5);
      add(c, V0 - depth * 0.5, () => {
        s.ellipse(q.x, q.y, 3, 1.5, tone(P.skyMid, V0), true);
        s.px(q.x - 1, q.y, tone(P.skyLow, V0));
      });
    }
    // wheelie bins by the back gate
    const bin = at(c, Xl + lw * 0.86, V0 - depth - 0.6);
    add(c, V0 - depth - 0.6, () => {
      s.rect(bin.x, bin.y - 2, 1, 2, tone(P.grassDeep, V0));
      if (r2 > 0.4) s.rect(bin.x + 2, bin.y - 2, 1, 2, tone(P.awayDark, V0));
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
      s.rect(ch.x, ch.y - 4, 2, 5, tone(P.brickDark, Vm));
      s.rect(ch.x, ch.y - 5, 2, 1, tone(P.chalk, Vm));
      if (u < 0.5) town.chimneys.push({ x: ch.x, y: ch.y - 6, big: false });
    }
    const foot = at(c, pubX0, pv0, 0);
    const eave = at(c, pubX0, pv0, 6.4);
    const end = at(c, pubX1, pv0, 0);
    const wide = end.x - foot.x;
    const wh = foot.y - eave.y;
    if (wh >= 6 && wide >= 20) {
      // black beams, windows, the door, the sign
      s.rect(foot.x, eave.y + 1, wide, 1, tone(P.hairDark, pv0));
      for (let i = 0; i < 4; i++) {
        const wx = foot.x + 3 + Math.round((i * (wide - 8)) / 4);
        s.rect(wx, eave.y + 3, 3, 3, c.night ? P.gold : tone(P.slate, pv0));
      }
      s.rect(
        foot.x + Math.round(wide * 0.45),
        foot.y - 5,
        3,
        5,
        tone(P.homeDark, pv0),
      );
      s.rect(
        foot.x + Math.round(wide * 0.3),
        eave.y - 1,
        Math.round(wide * 0.4),
        3,
        tone(P.grassDeep, pv0),
      );
      s.rect(
        foot.x + Math.round(wide * 0.3) + 1,
        eave.y,
        Math.round(wide * 0.4) - 2,
        1,
        tone(P.gold, pv0),
      );
    } else if (wh >= 2) {
      s.rect(
        foot.x + 1,
        eave.y + 1,
        Math.max(1, wide - 2),
        1,
        c.night ? P.gold : tone(P.slate, pv0),
      );
    }
  });
  // the beer garden
  const g0 = pv0 - 13;
  for (let i = 0; i < 6; i++) {
    const X = pubX0 + 3 + (i % 3) * 7.2;
    const V = pv0 - 3.6 - Math.floor(i / 3) * 5.6;
    const p = at(c, X, V, 2.6);
    const f = at(c, X, V, 0);
    if (!seen(c, p, 8)) continue;
    const cls = sizeClass(p.s);
    add(c, V, () => {
      const a = tone(i % 2 === 0 ? P.home : P.chalk, V);
      const b = tone(i % 2 === 0 ? P.chalk : P.home, V);
      if (cls === 2) {
        shadowBlob(s, f.x + 2, f.y + 1, 4, 1.5);
        s.ellipse(p.x, p.y, 4, 2, a, true);
        s.rect(p.x - 1, p.y - 2, 3, 1, b);
        s.rect(p.x - 4, p.y, 2, 1, b);
        s.rect(p.x + 3, p.y, 2, 1, b);
        s.px(p.x, p.y - 1, tone(P.white, V));
      } else if (cls === 1) {
        s.rect(p.x - 2, p.y - 1, 5, 2, a);
        s.px(p.x, p.y - 1, b);
      } else {
        s.px(p.x, p.y, a);
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
  // The cars that stay all day. The live bays (stadium-parking.ts) are drawn by stadium-life.ts.
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
    const tall = Math.max(2, Math.round(4.2 * foot.s));
    for (let j = 0; j < tall; j++) {
      s.px(
        foot.x,
        foot.y - 1 - j,
        Math.floor(j / 2) % 2 === 0 ? tone(P.home, hutV) : tone(P.white, hutV),
      );
    }
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
      const stripe = Math.floor(x / 2) % 2 === 0 ? P.home : P.chalk;
      s.rect(
        foot.x + x,
        top2.y,
        1,
        Math.max(1, Math.round(wh * 0.3)),
        tone(stripe, vv),
      );
    }
    if (wh >= 6) {
      // the hatch, lit from inside, and someone serving
      s.rect(
        foot.x + 2,
        top2.y + Math.round(wh * 0.3),
        wide - 5,
        Math.round(wh * 0.38),
        c.night ? P.goldLight : tone(P.slate, vv),
      );
      s.px(
        foot.x + Math.round(wide * 0.4),
        top2.y + Math.round(wh * 0.3) + 1,
        tone(P.skinA, vv),
      );
      s.rect(foot.x, foot.y - 1, wide, 1, tone(P.home, vv));
      s.px(foot.x + 1, foot.y, tone(P.ink, vv));
      s.px(end.x - 2, foot.y, tone(P.ink, vv));
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
    const big = foot.s >= 1.1;
    const mid = foot.s >= 0.6;
    const hw = big ? 11 : mid ? 7 : 5;
    const hh = big ? 7 : mid ? 5 : 3;
    const hx = foot.x - Math.floor(hw / 2) + (big ? 1 : 0);
    const hy2 = top.y - hh + 1;
    town.pylons.push({
      x: hx + Math.floor(hw / 2),
      y: hy2 + Math.floor(hh / 2),
    });
    add(c, V, () => {
      const hgt = foot.y - top.y;
      s.rect(foot.x, top.y, 1, hgt, c.tone(P.concreteLight, V));
      if (big) {
        s.rect(foot.x + 1, top.y, 1, hgt, c.tone(P.concrete, V));
        for (let y = top.y + 2; y < foot.y; y += 3) {
          s.px(foot.x + (Math.floor(y / 3) % 2), y, c.tone(P.slate, V));
        }
        s.rect(foot.x - 1, foot.y - 2, 4, 2, c.tone(P.concrete, V));
      }
      if (c.night) {
        const cx2 = hx + Math.floor(hw / 2);
        const cy2 = hy2 + Math.floor(hh / 2);
        s.disc(cx2, cy2, hw, P.steelHi, 0.25);
        s.disc(cx2, cy2, Math.round(hw * 0.62), P.white, 0.5);
      }
      s.rect(hx, hy2, hw, hh, c.tone(P.slate, V));
      s.rect(hx, hy2, hw, 1, c.tone(P.steel, V));
      for (let yy = hy2 + 1; yy < hy2 + hh - 1; yy += 2) {
        for (let xx = hx + 1; xx < hx + hw - 1; xx += 2) {
          s.px(xx, yy, c.night ? P.white : c.tone(P.steelHi, V));
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
        for (let x = a.x; x <= at(c, X0 + 8, V0, 3.6).x; x += 2) {
          s.rect(x, b.y, 1, Math.max(1, a.y - b.y + 1), tone(P.chalk));
        }
        const foot = at(c, X0, V0, 0);
        if (foot.y - a.y >= 5) {
          s.rect(
            a.x + 1,
            a.y + 2,
            at(c, X0 + 8, V0, 0).x - a.x - 2,
            2,
            c.night ? P.goldLight : tone(P.slate),
          );
        }
      });
    }
  }
  // bollards where the plaza meets the road
  for (let X = -PLAZA_HALF + 6; X <= PLAZA_HALF - 6; X += 6) {
    for (const V of [ROAD.stadiumV1 + 1.2, ROAD.stadiumV0 - 1.2]) {
      const p = at(c, X, V);
      add(c, V, () => {
        if (sizeClass(p.s) === 2) {
          s.rect(p.x, p.y - 2, 1, 2, tone(P.slate));
          s.px(p.x, p.y - 3, tone(P.gold));
        } else if (sizeClass(p.s) === 1) s.px(p.x, p.y - 1, tone(P.slate));
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
      add(c, p1.V, () => s.line(q0.x, q0.y, q1.x, q1.y, tone(P.steel)));
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
    if (!seen(c, p, 20)) continue;
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
      add(c, V, () =>
        car(c.s, q2.x, q2.y, sizeClass(q2.s), 2, carLook(c.tone, V, r * 3)),
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
      const x = Math.round(a.x + ((b.x - a.x) * i) / 5) + 2;
      s.rect(x, Math.round((a.y + b.y) / 2), 2, 1, tone(P.skyLow, 10));
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
      if (sizeClass(p.s) === 0) {
        c.s.px(p.x, p.y - 1, tone(i % 2 ? P.gold : P.home, 70));
        return;
      }
      c.s.rect(p.x - 1, p.y - 1, 3, 2, tone(P.grassDeep, 70));
      c.s.px(p.x - 1, p.y - 1, tone(i % 2 ? P.gold : P.home, 70));
      c.s.px(p.x + 1, p.y, tone(i % 2 ? P.chalk : P.gold, 70));
    });
  }
  // benches facing the pond
  for (const bx of [-14, 2, 18]) {
    const p = at(c, POND.x + bx, POND.v - POND.b - 5);
    add(c, POND.v - POND.b - 5, () =>
      c.s.rect(
        p.x - 1,
        p.y - 1,
        sizeClass(p.s) === 0 ? 2 : 3,
        1,
        tone(P.wood, 20),
      ),
    );
  }
  // the playground in the south of the park
  add(c, -92, () => {
    const p = at(c, 300, -92);
    if (!seen(c, p)) return;
    c.s.rect(p.x - 6, p.y - 5, 1, 5, tone(P.home, -90));
    c.s.rect(p.x + 6, p.y - 5, 1, 5, tone(P.home, -90));
    c.s.rect(p.x - 6, p.y - 5, 13, 1, tone(P.gold, -90));
    c.s.rect(p.x - 3, p.y - 4, 1, 3, tone(P.steel, -90));
    c.s.rect(p.x + 2, p.y - 4, 1, 3, tone(P.steel, -90));
  });

  // cars parked along East Road and Park Lane
  for (let V = -100; V < 150; V += 8) {
    if (c.h(V, 40) < 0.55) addCar(c, ROAD.eastX1 - 2.2, V, 2, 6400 + V);
    if (c.h(V, 41) < 0.5) addCar(c, ROAD.westX0 + 2.2, V, 3, 6500 + V);
    if (c.h(V, 42) < 0.5) addCar(c, ROAD.laneX1 - 2, V, 2, 6600 + V);
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
    s.rect(t.x - 1, top.y, 3, t.y - top.y + 1, tone(P.brickLight, 158));
    s.rect(t.x - 1, top.y - 1, 3, 1, tone(P.steel, 158));
    s.px(t.x, top.y + 1, c.night ? P.goldLight : tone(P.chalk, 158));
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
    add(c, 148, () => car(s, p.x, p.y, sizeClass(p.s), 0, look));
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
            for (let x = a.x; x < b.x; x++) {
              if (c.h(x, block + k2 * 3 + 300) < 0.2)
                s.px(x, a.y - 1, c.h(x, block) < 0.6 ? P.gold : P.amber);
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
      const wide = foot.s > 0.6 ? 2 : 1;
      s.rect(foot.x, top.y, wide, foot.y - top.y, tone(P.brick, V));
      if (wide === 2)
        s.rect(foot.x + 1, top.y, 1, foot.y - top.y, tone(P.brickDark, V));
      s.rect(foot.x, top.y, wide, 1, tone(P.chalk, V));
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
      for (let y = top.y + 1; y < foot.y - 1; y += 2) {
        for (let x = foot.x + 1; x < end.x - 0; x += 2) {
          const litW = c.night && c.h(x + key * 50, y) < 0.45;
          s.px(x, y, litW ? P.gold : tone(P.steel, V));
        }
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
      const rx = Math.max(2, Math.round(13 * gas.s));
      const ry = Math.max(1, Math.round(rx * 0.3));
      s.rect(
        gas.x - rx,
        top.y,
        rx * 2 + 1,
        gas.y - top.y,
        tone(P.concrete, 300),
      );
      s.rect(gas.x, top.y, rx + 1, gas.y - top.y, tone(P.concreteDark, 300));
      s.ellipse(gas.x, top.y, rx, ry, tone(P.concreteLight, 300), true);
      for (const dx of [-rx - 1, 0, rx + 1]) {
        s.rect(gas.x + dx, top.y - 3, 1, gas.y - top.y + 3, tone(P.slate, 300));
      }
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
function paintPools(c: Ctx): void {
  for (const l of lampSpots(c)) {
    const p = at(c, l.X, l.V);
    if (!seen(c, p, 20)) continue;
    if (p.s < 0.3) continue;
    const rx = Math.max(2, Math.round((l.tall ? 9 : 7) * p.s));
    lightPool(c.s, p.x, p.y, rx, Math.max(1, Math.round(rx * 0.42)), l.cool);
  }
}

function lamps(c: Ctx): void {
  const { s } = c;
  for (const l of lampSpots(c)) {
    const p = at(c, l.X, l.V);
    if (!seen(c, p, 12)) continue;
    const cls = sizeClass(p.s);
    const post = c.tone(P.slate, l.V);
    const head = c.night
      ? l.cool
        ? P.white
        : P.goldLight
      : c.tone(P.steelHi, l.V);
    add(c, l.V, () => {
      if (cls === 0) {
        if (c.night) s.px(p.x, p.y - 2, l.cool ? P.steelHi : P.gold);
        return;
      }
      const hgt = cls === 1 ? (l.tall ? 6 : 5) : l.tall ? 11 : 8;
      s.rect(p.x, p.y - hgt, 1, hgt, post);
      if (l.tall) {
        s.rect(p.x - 1, p.y - hgt, 3, 1, head);
      } else {
        s.rect(p.x, p.y - hgt, 2, 1, head);
      }
    });
  }
}
