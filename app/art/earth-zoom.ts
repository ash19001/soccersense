/**
 * The Earth from the street to space (2026-11-18): FURTHEST's kick-off on the home screen
 * pulls back from the stadium until it is a speck on the globe. The product owner: "it
 * should feel like a place within that globe so maybe there should be stages and
 * cities/fields around as it zooms out until its far enough where it looks like a globe".
 *
 * One picture of the ground at any scale, seen straight down, round the day's place:
 *
 * - **The street** (while a block is STREET_SAMPLES samples across): the town's blocks with
 *   streets between them (a side street missing here and there, so that blocks join), two
 *   buildings a block, their roofs by the quarter (grey or brick) with a lit north edge, and
 *   parks with trees; by night the streets are dark with lamps at the crossings, and
 *   windows are lit.
 * - **The town** (under MID_KPP km a pixel): its quarters and its main streets (every
 *   MAIN_EVERY blocks, fewer further off), its blocks told apart while they are big enough
 *   (BLOCK_SAMPLES) and then a quarter one colour; by night the main streets
 *   are lit and the rest sparkles. Further off, a speck (lit at night).
 * - **The region** (out of town): fields one by one while they are FIELD_SAMPLES samples
 *   across (green pasture, mixed, or wheat and earth by the area; dry ones in a desert),
 *   then parcels of fields (PARCEL_SAMPLES), half of them the land's own green; woods, and
 *   the main roads out of the home town (lit by night).
 * - **The country**: the land's broad colours (lush and green, dry and sand in the world's
 *   deserts, snow in the far north and south), forests, and nearer, smaller woods and
 *   changes of green (DETAIL_KM); the sea.
 * - **The globe**: the same ground on an orthographic Earth among stars, once it is small
 *   enough to be seen whole (PLANAR_FROM).
 *
 * The stages are reckoned by the size of a sample on the ground: what would be smaller than
 * a few samples is drawn as the next stage. Each gives way to the next a piece of ground at
 * a time (`shown`: a parcel, a cell of the town's main streets), not in a dither on the
 * screen, so that nothing makes a pattern and nothing swims as the ground moves under it.
 * Coasts are the world map's (./world-map.ts), the deserts roughly where the real ones are
 * (DESERTS); the town, its fields and the other towns are made up from the seed, not real.
 * Colours go through the light (`env`); lit windows and street lights keep their own. The
 * ground is sampled in blocks of a few pixels on a big picture (MOST_SAMPLES), and nothing
 * in it is drawn narrower than a block, so that nothing flickers in and out between
 * samples. Pure, seeded.
 */

import { type Color, Surface, hash2 } from "~/pixel";

import { drawStars } from "./globe";
import type { Lighting } from "./lighting";
import { P } from "./palette";
import { EARTH_KM, type GeoPoint, isLand } from "./world-map";

const RAD = Math.PI / 180;
const KM_PER_DEG = EARTH_KM * RAD;

/** Towns are specks from MID_KPP km a pixel. */
const MID_KPP = 0.3;
/** Each piece of ground changes stage this share sooner or later than the scale says. */
const JITTER = 0.25;
/**
 * The home town: its middle is 1 and its edge, about 0.7 of HOME_TOWN_KM out (some 15 km: a
 * football city), is broken up. Within HOME_LAND_KM of the place it is land whatever the
 * coast's grid says (the ground from above stands on it); further out the sea is the sea, so a
 * harbour stays one.
 */
const HOME_TOWN_KM = 22;
const HOME_LAND_KM = 3;
/**
 * A town block and the share of it that is street, both ways. Its streets and roofs are
 * drawn while a block is STREET_SAMPLES samples across; smaller, the town is its quarters
 * and main streets.
 */
const BLOCK_KM = 0.09;
const ROAD_SHARE = 0.2;
const STREET_SAMPLES = 4;
/** At the town's scale its blocks are told apart while one is this many samples across. */
const BLOCK_SAMPLES = 1.5;
/** A side street between two blocks is there this often; without it they are one block. */
const SIDE_STREETS = 0.7;
/** A main street every this many blocks; further off, every other one, and so on. */
const MAIN_EVERY = 4;
/** Main streets are drawn no closer than this many samples apart. */
const MAIN_SAMPLES = 5;
/** A roof's lit edge (its north side): this share of the block, a sample at least. */
const ROOF_EDGE = 0.14;
/** The town's quarters, about this size (km): parks, grey roofs or brick. */
const QUARTER_KM = 1;
/** By night a window (a cell of WINDOW_KM) is lit this often, brightly this often. */
const WINDOW_KM = 0.015;
const WINDOWS_LIT = 0.1;
const WINDOWS_BRIGHT = 0.04;
/** A field, drawn one by one while it is FIELD_SAMPLES samples across. */
const FIELD_KM = 0.45;
const FIELD_SAMPLES = 3;
/** Fields in parcels of this size (km), drawn while one is PARCEL_SAMPLES across. */
const PARCEL_KM = 1.35;
const PARCEL_SAMPLES = 3;
/** Farmland in areas of this size (km): pasture, mixed, or wheat and earth. */
const FARM_KM = 3.5;
/** The main roads out of the home town are drawn while a sample is under this (km). */
const ROADS_SEEN_KM = 0.5;
/** The country's smaller woods and changes of green (km), seen while DETAIL_SAMPLES across. */
const DETAIL_KM = 12;
const DETAIL_SAMPLES = 4;
/** The country's forests, and its lusher and plainer greens (km). */
const FOREST_KM = 90;
const GREENS_KM = 220;
/**
 * The coast's grid is half a degree: up close its edges would be straight lines and steps.
 * The land is looked up a little way off (COAST_WOBBLE degrees at most, in smooth waves of
 * COAST_WAVE degrees), so the coast wanders as a real one does.
 */
const COAST_WOBBLE = 0.2;
const COAST_WAVE = 0.4;
/** Other towns: one in TOWN_CHANCE of the cells of TOWN_DEG degrees. */
const TOWN_DEG = 0.25;
const TOWN_CHANCE = 0.45;
/** Main roads out of the home town. */
const ROADS = 5;
/** Snow beyond this latitude, north and south. */
const SNOW_LAT = 66;
/** Seen from further than this many diagonals of the picture, the ground is flat. */
const PLANAR_FROM = 4;
/** No more samples than this a frame (blocks of a few pixels on a big picture). */
const MOST_SAMPLES = 20000;
/** The same, for a caller that chooses its own mosaic (EarthView.block). */
export const EARTH_SAMPLES = MOST_SAMPLES;

/** A desert, roughly: an ellipse in degrees round its middle. */
interface Desert {
  lat: number;
  lng: number;
  rLat: number;
  rLng: number;
}

/** The world's great deserts and dry lands, roughly where they are. */
const DESERTS: readonly Desert[] = [
  { lat: 23, lng: 10, rLat: 9, rLng: 24 }, // the Sahara
  { lat: 22, lng: 47, rLat: 8, rLng: 10 }, // Arabia
  { lat: 29, lng: 63, rLat: 5, rLng: 11 }, // Iran to the Thar
  { lat: 41, lng: 61, rLat: 4, rLng: 8 }, // the Karakum
  { lat: 41, lng: 96, rLat: 4, rLng: 17 }, // the Taklamakan and the Gobi
  { lat: -25, lng: 132, rLat: 7, rLng: 13 }, // the middle of Australia
  { lat: -23, lng: 19, rLat: 5, rLng: 6 }, // the Kalahari and the Namib
  { lat: -23, lng: -69.5, rLat: 7, rLng: 1.6 }, // the Atacama
  { lat: -44, lng: -68, rLat: 6, rLng: 3 }, // Patagonia
  { lat: 32, lng: -111, rLat: 5, rLng: 7 }, // the American south west
  { lat: 7, lng: 46, rLat: 4, rLng: 4 }, // the Horn of Africa
];

/** Over DRY the land is dry; over SANDY, sand. */
const DRY = 0.15;
const SANDY = 0.5;

export interface EarthView {
  /** The day's place: the home town is round it. */
  place: GeoPoint;
  seed: number;
  light: Lighting;
  /**
   * Ground something else knows better (FURTHEST's town from above, ./stadium-top.ts):
   * its colour `east` and `north` km of the place, or undefined where it does not know.
   */
  near?: (east: number, north: number) => Color | undefined;
  /**
   * The towns' ground in someone else's look (FURTHEST's: the home town's streets from
   * above, pixelated as they are), where this module would draw its own streets, quarters
   * and specks; or undefined to draw them.
   */
  town?: (east: number, north: number) => Color | undefined;
  /**
   * The size of a sample in pixels, a square of them in one colour (a mosaic), instead of
   * the smallest that keeps to MOST_SAMPLES. The squares are lined up on the Earth's
   * middle, so that it does not shimmer as the mosaic changes.
   */
  block?: number;
  /**
   * Only these rows, `from` up to `to` (a picture drawn a band at a time: the map's, as it
   * sharpens). Space and its stars go in with the first band, the globe's rim with the last.
   */
  rows?: { from: number; to: number };
}

interface Tones {
  sea: Color;
  /** Farmland's colours by area: pasture, mixed, wheat and earth; the middle two the most. */
  farms: Color[][];
  /** Farmland in a desert. */
  arid: Color[];
  /**
   * Roofs by the quarter (grey, brick): two kinds of building, each a roof and its lit
   * edge; the first kind the more.
   */
  quarters: Color[][];
  road: Color;
  park: Color;
  tree: Color;
  forest: Color;
  forestLight: Color;
  town: Color;
  townLight: Color;
  lush: Color;
  green: Color;
  dry: Color;
  sand: Color;
  snow: Color;
  rim: Color;
  space: Color;
}

function tonesFor(light: Lighting): Tones {
  const e = light.env;
  return {
    sea: e(P.furthestDark),
    farms: [
      [e(P.grassDark), e(P.grass), e(P.grassLight), e(P.grassHi)],
      [e(P.grassDark), e(P.grassLight), e(P.retro), e(P.wood)],
      [e(P.grass), e(P.retroLight), e(P.retro), e(P.wood)],
    ],
    arid: [e(P.retro), e(P.retroLight), e(P.retroLight), e(P.wood)],
    quarters: [
      [e(P.concrete), e(P.concreteLight), e(P.concreteLight), e(P.steelHi)],
      [e(P.brick), e(P.brickLight), e(P.brickDark), e(P.brick)],
    ],
    road: e(P.concreteDark),
    park: e(P.grass),
    tree: e(P.grassDark),
    forest: e(P.grassDeep),
    forestLight: e(P.grassDark),
    town: e(P.concrete),
    townLight: e(P.concreteLight),
    lush: e(P.grassDark),
    green: e(P.grass),
    dry: e(P.retro),
    sand: e(P.retroLight),
    snow: e(P.steelHi),
    rim: e(P.skyLow),
    space: P.ink,
  };
}

/** Smooth noise, 0 to 1 (mostly near the middle), on a grid of `cell`. */
function smooth(x: number, y: number, cell: number, seed: number): number {
  const gx = x / cell;
  const gy = y / cell;
  const ix = Math.floor(gx);
  const iy = Math.floor(gy);
  let fx = gx - ix;
  let fy = gy - iy;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, seed);
  const b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed);
  const d = hash2(ix + 1, iy + 1, seed);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

/**
 * Whether something `size` km across is drawn, a sample being `foot` km: while it is
 * `samples` samples across, give or take JITTER by the piece of ground it is on (`h`, 0 to
 * 1), so that pieces change one by one as the scale does.
 */
function shown(
  size: number,
  samples: number,
  foot: number,
  h: number,
): boolean {
  return foot * samples * (1 + JITTER * (2 * h - 1)) < size;
}

function mod(a: number, n: number): number {
  return ((a % n) + n) % n;
}

/** Whether `i` is a whole multiple of `n` (negative ones too). */
function every(i: number, n: number): boolean {
  return ((i % n) + n) % n === 0;
}

/**
 * How dry the land is: over DRY in a desert's dry edge, over SANDY in its sand; its edge
 * broken up a little.
 */
export function drynessAt(lat: number, lng: number, seed: number): number {
  let most = -1;
  for (const z of DESERTS) {
    const a = (lat - z.lat) / z.rLat;
    let dl = lng - z.lng;
    dl -= Math.round(dl / 360) * 360;
    const b = dl / z.rLng;
    const v = 1 - Math.sqrt(a * a + b * b);
    if (v > most) most = v;
  }
  if (most < -0.3) return most;
  const ax = lng * KM_PER_DEG * Math.cos(lat * RAD);
  const ay = lat * KM_PER_DEG;
  return most + (smooth(ax, ay, 300, seed + 13) - 0.5) * 0.5;
}

interface Road {
  c: number;
  s: number;
}

/** What one sample needs to know besides where it is. */
interface Sampling {
  /** The km a pixel, and the km between samples (a sample's size on the ground). */
  kpp: number;
  foot: number;
  seed: number;
  lights: boolean;
  T: Tones;
  roads: readonly Road[];
  /** Whether the region in sight is in a desert (taken once, at the picture's middle). */
  arid: boolean;
  near?: (east: number, north: number) => Color | undefined;
  town?: (east: number, north: number) => Color | undefined;
}

/**
 * The ground at a point: its latitude and longitude, and `east` and `north` of the day's
 * place in km.
 */
function groundAt(
  lat: number,
  lng: number,
  east: number,
  north: number,
  g: Sampling,
): Color {
  const { seed, T } = g;
  if (g.near) {
    const c = g.near(east, north);
    if (c !== undefined) return c;
  }
  const home = Math.hypot(east, north);
  // the ground round the place is on land, whatever the coast's grid says
  if (home > HOME_LAND_KM) {
    const wobLng =
      (smooth(lng, lat, COAST_WAVE, seed + 20) - 0.5) * 2 * COAST_WOBBLE;
    const wobLat =
      (smooth(lng, lat, COAST_WAVE, seed + 21) - 0.5) * 2 * COAST_WOBBLE;
    if (!isLand(lat + wobLat, lng + wobLng)) return T.sea;
  }
  if (Math.abs(lat) > SNOW_LAT) return T.snow;
  // how much of a town is here: the home town's, broken up at its edge, or another's
  let urban = -1;
  if (home < HOME_TOWN_KM + 4) {
    const jitter = (smooth(east, north, 2.5, seed + 1) - 0.5) * 6;
    urban = 1 - (home + jitter) / HOME_TOWN_KM;
  }
  const ci = Math.floor(lat / TOWN_DEG);
  const cj = Math.floor(lng / TOWN_DEG);
  if (hash2(ci, cj, seed + 7) < TOWN_CHANCE) {
    const tlat = (ci + 0.2 + 0.6 * hash2(ci, cj, seed + 8)) * TOWN_DEG;
    const tlng = (cj + 0.2 + 0.6 * hash2(ci, cj, seed + 9)) * TOWN_DEG;
    const size = 0.7 + 5 * hash2(ci, cj, seed + 10) ** 3;
    const dt = Math.hypot(
      (lat - tlat) * KM_PER_DEG,
      (lng - tlng) * KM_PER_DEG * Math.cos(lat * RAD),
    );
    urban = Math.max(urban, 1 - dt / size);
  }
  if (urban > 0.3) return townAt(east, north, urban, g);
  return regionAt(lat, lng, east, north, g);
}

/** A town: its streets and roofs, its quarters and main streets, or a speck of it. */
function townAt(
  east: number,
  north: number,
  urban: number,
  g: Sampling,
): Color {
  const { seed, lights, T, foot } = g;
  if (g.town) {
    // its parks stay parks; the rest in the other look
    if (smooth(east, north, QUARTER_KM, seed + 3) >= 0.3) {
      const c = g.town(east, north);
      if (c !== undefined) return c;
    } else if (g.kpp < MID_KPP) {
      // a park: grass and trees, a tree no smaller than a sample
      const cell = Math.max(0.02, foot * 1.5);
      const tree = hash2(
        Math.floor(east / cell),
        Math.floor(north / cell),
        seed + 33,
      );
      return tree < 0.35 ? T.tree : T.park;
    }
  }
  const bx = east / BLOCK_KM;
  const by = north / BLOCK_KM;
  const ix = Math.floor(bx);
  const iy = Math.floor(by);
  // a speck further off, block by block
  const hb = hash2(ix, iy, seed + 51);
  if (g.kpp * (1 + JITTER * (2 * hb - 1)) >= MID_KPP) {
    if (lights) return urban > 0.55 ? P.amber : P.amberDim;
    return T.townLight;
  }
  const q = smooth(east, north, QUARTER_KM, seed + 3);
  const quarter = q < 0.3 ? -1 : q < 0.72 ? 0 : 1;
  // the streets and roofs, a cell of main streets at a time
  const main = BLOCK_KM * MAIN_EVERY;
  const hm = hash2(
    Math.floor(east / main),
    Math.floor(north / main),
    seed + 50,
  );
  if (shown(BLOCK_KM, STREET_SAMPLES, foot, hm)) {
    const fx = bx - ix;
    const fy = by - iy;
    // the streets on the block's west and south sides, a sample wide at least; a side
    // street is not always there, and never in a park
    const road = Math.max(ROAD_SHARE, foot / BLOCK_KM);
    const side = quarter >= 0;
    const mainX = every(ix, MAIN_EVERY);
    const mainY = every(iy, MAIN_EVERY);
    const westStreet =
      fx < road && (mainX || (side && hash2(ix, iy, seed + 40) < SIDE_STREETS));
    const southStreet =
      fy < road && (mainY || (side && hash2(ix, iy, seed + 41) < SIDE_STREETS));
    if (westStreet || southStreet) {
      if (!lights) return T.road;
      // by night the streets are dark, with lamps at the main crossings, at some others,
      // and here and there
      if (fx < road && fy < road) {
        return (mainX && mainY) || hash2(ix, iy, seed + 42) < 0.4
          ? P.amber
          : P.amberDim;
      }
      const lamp = hash2(
        Math.floor(east / 0.03),
        Math.floor(north / 0.03),
        seed + 4,
      );
      return lamp < 0.1 ? P.amberDim : T.road;
    }
    if (quarter < 0 || hash2(ix, iy, seed + 30) < 0.06) {
      // a park: grass and trees
      const tree = hash2(
        Math.floor(east / 0.02),
        Math.floor(north / 0.02),
        seed + 33,
      );
      return tree < 0.35 ? T.tree : T.park;
    }
    if (lights) {
      const win = hash2(
        Math.floor(east / WINDOW_KM),
        Math.floor(north / WINDOW_KM),
        seed + 34,
      );
      if (win < WINDOWS_BRIGHT) return P.amber;
      if (win < WINDOWS_LIT) return P.amberDim;
    }
    // two buildings on a block, side by side one way or the other, each roof with a lit
    // north edge
    const across = hash2(ix, iy, seed + 31) < 0.5;
    const along = ((across ? fx : fy) - road) / (1 - road);
    const half = along < 0.5 ? 0 : 1;
    const h = hash2(ix * 2 + half, iy * 2 + (across ? 0 : 1), seed + 32);
    const kind = h < 0.65 ? 0 : 2;
    const edge = Math.max(ROOF_EDGE, foot / BLOCK_KM);
    return T.quarters[quarter][fy > 1 - edge ? kind + 1 : kind];
  }
  // the town's scale: its main streets, a sample wide and no closer than MAIN_SAMPLES
  // samples (fewer of them further off), and its quarters
  let cell = main;
  while (cell < foot * MAIN_SAMPLES) cell *= 2;
  const mx = east / cell;
  const my = north / cell;
  const wide = foot / cell;
  const alongX = mx - Math.floor(mx) < wide;
  const alongY = my - Math.floor(my) < wide;
  if (lights) {
    if (alongX && alongY) return P.amber;
    if (alongX || alongY) return P.amberDim;
    return hb < 0.06 ? P.amber : hb < 0.16 ? P.amberDim : T.town;
  }
  if (alongX || alongY) return T.road;
  if (quarter < 0) return T.park;
  // its blocks, each one kind of building, while they are BLOCK_SAMPLES samples across
  const roofs = T.quarters[quarter];
  if (shown(BLOCK_KM, BLOCK_SAMPLES, foot, hm)) {
    return hash2(ix, iy, seed + 32) < 0.65 ? roofs[0] : roofs[2];
  }
  return roofs[0];
}

/** The region round a town: roads, woods, fields and parcels of them, then the country. */
function regionAt(
  lat: number,
  lng: number,
  east: number,
  north: number,
  g: Sampling,
): Color {
  const { seed, lights, T, foot } = g;
  // the main roads out of the home town, a sample wide at least
  const hr = hash2(Math.floor(east), Math.floor(north), seed + 56);
  if (shown(ROADS_SEEN_KM, 1, foot, hr)) {
    const width = Math.max(0.012, foot * 0.6);
    for (const road of g.roads) {
      if (east * road.c + north * road.s <= 0) continue;
      if (Math.abs(east * road.s - north * road.c) < width) {
        return lights ? P.amberDim : T.road;
      }
    }
  }
  // parcel by parcel, the region gives way to the country
  const pi = Math.floor(east / PARCEL_KM);
  const pj = Math.floor(north / PARCEL_KM);
  if (!shown(PARCEL_KM, PARCEL_SAMPLES, foot, hash2(pi, pj, seed + 52))) {
    return countryAt(lat, lng, g);
  }
  if (smooth(east, north, 1.6, seed + 5) > 0.66) {
    if (!shown(BLOCK_KM, STREET_SAMPLES, foot, 0.5)) return T.forest;
    const tree = hash2(
      Math.floor(east / 0.03),
      Math.floor(north / 0.03),
      seed + 11,
    );
    return tree < 0.3 ? T.forestLight : T.forest;
  }
  const zone = smooth(east, north, FARM_KM, seed + 16);
  const farm = g.arid ? T.arid : T.farms[zone < 0.45 ? 0 : zone < 0.68 ? 1 : 2];
  // fields one by one, and then (parcel by parcel) a parcel's one colour: the land's own
  // for half of them
  if (shown(FIELD_KM, FIELD_SAMPLES, foot, hash2(pi, pj, seed + 53))) {
    const ix = Math.floor(east / FIELD_KM);
    const iy = Math.floor(north / FIELD_KM);
    return farm[Math.floor(hash2(ix, iy, seed + 6) * farm.length)];
  }
  const h = hash2(pi, pj, seed + 54);
  if (h < 0.5) return countryAt(lat, lng, g);
  return farm[h < 0.75 ? 1 : h < 0.9 ? 2 : 0];
}

/** The land's broad colours, and nearer its smaller woods and changes of green. */
function countryAt(lat: number, lng: number, g: Sampling): Color {
  const { seed, T } = g;
  const dry = drynessAt(lat, lng, seed);
  if (dry > SANDY) return T.sand;
  if (dry > DRY) return T.dry;
  const ax = lng * KM_PER_DEG * Math.cos(lat * RAD);
  const ay = lat * KM_PER_DEG;
  // each scale of woods and greens while it is a few samples across, giving way a little
  // piece of ground at a time
  const fine = DETAIL_KM / 2;
  const hd = hash2(Math.floor(ax / fine), Math.floor(ay / fine), seed + 55);
  const coarse = FOREST_KM / 2;
  const hf = hash2(Math.floor(ax / coarse), Math.floor(ay / coarse), seed + 57);
  if (
    shown(FOREST_KM, DETAIL_SAMPLES, g.foot, hf) &&
    smooth(ax, ay, FOREST_KM, seed + 12) > 0.68
  ) {
    return T.forest;
  }
  let lush =
    shown(GREENS_KM, 2, g.foot, hf) &&
    smooth(ax, ay, GREENS_KM, seed + 14) <= 0.5;
  if (shown(DETAIL_KM, DETAIL_SAMPLES, g.foot, hd)) {
    const d = smooth(ax, ay, DETAIL_KM, seed + 18);
    if (d > 0.7) return T.forest;
    if (d < 0.32) lush = !lush;
  }
  return lush ? T.lush : T.green;
}

/** Whether an Earth of radius `r` on a `w` x `h` picture is drawn flat (it fills it). */
export function earthIsFlat(r: number, w: number, h: number): boolean {
  return r > PLANAR_FROM * Math.hypot(w, h);
}

/**
 * Where `p` is on the picture `drawEarthZoom` draws with the same `cx`, `cy`, `r` and
 * `centre` on a `w` x `h` picture: flat as it is drawn flat, on the globe otherwise, and
 * `seen` false on the globe's far side.
 */
export function earthPoint(
  cx: number,
  cy: number,
  r: number,
  centre: GeoPoint,
  p: GeoPoint,
  w: number,
  h: number,
): { x: number; y: number; seen: boolean } {
  let dl = p.lng - centre.lng;
  dl -= Math.round(dl / 360) * 360;
  if (earthIsFlat(r, w, h)) {
    const kpp = EARTH_KM / r;
    return {
      x: cx + (dl * KM_PER_DEG * Math.cos(centre.lat * RAD)) / kpp,
      y: cy - ((p.lat - centre.lat) * KM_PER_DEG) / kpp,
      seen: true,
    };
  }
  const lat0 = centre.lat * RAD;
  const lat = p.lat * RAD;
  const d = dl * RAD;
  const front =
    Math.sin(lat0) * Math.sin(lat) +
    Math.cos(lat0) * Math.cos(lat) * Math.cos(d);
  return {
    x: cx + r * Math.cos(lat) * Math.sin(d),
    y:
      cy -
      r *
        (Math.cos(lat0) * Math.sin(lat) -
          Math.sin(lat0) * Math.cos(lat) * Math.cos(d)),
    seen: front > 0,
  };
}

/**
 * The ground round the day's place seen from `EARTH_KM / r` km a pixel: an Earth of radius
 * `r` at (`cx`, `cy`), `centre` in its middle (the place, or turned a little past it). Big,
 * it fills the picture, flat; small, it is a globe among stars. Fills every pixel of `s`.
 */
export function drawEarthZoom(
  s: Surface,
  cx: number,
  cy: number,
  r: number,
  centre: GeoPoint,
  view: EarthView,
): void {
  const w = s.w;
  const h = s.h;
  const T = tonesFor(view.light);
  const seed = view.seed | 0;
  const diag = Math.hypot(w, h);
  const planar = earthIsFlat(r, w, h);
  const kpp = EARTH_KM / r;
  const place = view.place;
  const cosPlace = Math.cos(place.lat * RAD);
  const roads: Road[] = [];
  for (let i = 0; i < ROADS; i++) {
    const a = ((i + hash2(i, 1, seed + 15) * 0.6) / ROADS) * Math.PI * 2;
    roads.push({ c: Math.cos(a), s: Math.sin(a) });
  }
  const from = Math.max(0, view.rows?.from ?? 0);
  const to = Math.min(h, view.rows?.to ?? h);
  // space round a globe that does not fill the picture
  if (!planar && r < diag && from === 0) {
    s.clear(T.space);
    drawStars(s, seed);
  }
  const x0 = planar ? 0 : Math.max(0, Math.floor(cx - r));
  const x1 = planar ? w - 1 : Math.min(w - 1, Math.ceil(cx + r));
  const y0 = Math.max(from, planar ? 0 : Math.floor(cy - r));
  const y1 = Math.min(to - 1, planar ? h - 1 : Math.ceil(cy + r));
  if (x0 > x1 || y0 > y1) return;
  const area = (x1 - x0 + 1) * (y1 - y0 + 1);
  const block = Math.max(
    1,
    Math.round(view.block ?? Math.ceil(Math.sqrt(area / MOST_SAMPLES))),
  );
  // the squares lined up on the Earth's middle
  const ox = mod(Math.round(cx), block);
  const oy = mod(Math.round(cy), block);
  const g: Sampling = {
    kpp,
    foot: kpp * block,
    seed,
    lights: view.light.lightsOn,
    T,
    roads,
    arid: drynessAt(centre.lat, centre.lng, seed) > DRY,
    near: view.near,
    town: view.town,
  };
  const lat0 = centre.lat * RAD;
  const sin0 = Math.sin(lat0);
  const cos0 = Math.cos(lat0);
  const r2 = r * r;
  const data = s.data;
  for (
    let by = Math.floor((y0 - oy) / block) * block + oy;
    by <= y1;
    by += block
  ) {
    const sy = by + block / 2;
    for (
      let bx = Math.floor((x0 - ox) / block) * block + ox;
      bx <= x1;
      bx += block
    ) {
      const sx = bx + block / 2;
      let lat: number;
      let lng: number;
      if (planar) {
        lat = centre.lat - ((sy - cy) * kpp) / KM_PER_DEG;
        lng = centre.lng + ((sx - cx) * kpp) / (KM_PER_DEG * cos0);
      } else {
        let u = (sx - cx) / r;
        let v = (sy - cy) / r;
        let d2 = u * u + v * v;
        if (d2 > 1) {
          if (Math.sqrt(d2) - 1 > (block * 0.75) / r) continue;
          const k = 0.999 / Math.sqrt(d2);
          u *= k;
          v *= k;
          d2 = u * u + v * v;
        }
        const z = Math.sqrt(1 - d2);
        const north = -v;
        lat =
          Math.asin(Math.max(-1, Math.min(1, z * sin0 + north * cos0))) / RAD;
        lng = centre.lng + Math.atan2(u, z * cos0 - north * sin0) / RAD;
      }
      let dl = lng - place.lng;
      dl -= Math.round(dl / 360) * 360;
      const east = dl * KM_PER_DEG * cosPlace;
      const north = (lat - place.lat) * KM_PER_DEG;
      const color = groundAt(lat, lng, east, north, g);
      const ya = Math.max(by, y0);
      const yb = Math.min(by + block, y1 + 1);
      const xa = Math.max(bx, x0);
      const xb = Math.min(bx + block, x1 + 1);
      for (let y = ya; y < yb; y++) {
        const row = y * w;
        const dy = y + 0.5 - cy;
        for (let x = xa; x < xb; x++) {
          if (!planar) {
            const dx = x + 0.5 - cx;
            if (dx * dx + dy * dy > r2) continue;
          }
          data[row + x] = color;
        }
      }
    }
  }
  // the air's edge round a globe that is all in sight
  if (
    to >= h &&
    !planar &&
    cx - r >= 0 &&
    cx + r < w &&
    cy - r >= 0 &&
    cy + r < h
  ) {
    s.circle(Math.round(cx), Math.round(cy), Math.round(r), T.rim);
  }
}
