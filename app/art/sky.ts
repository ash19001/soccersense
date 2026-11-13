/**
 * The sky: the backdrop of the home screen and of every ground.
 *
 * `drawSky` fills the surface from y = 0 down to `horizonY` and nothing below it. It is a
 * pure function of its options: same light, time, seed and size, same pixels.
 *
 * Back to front: flat colour bands with dithered edges (arching up over the sun when it is
 * low), stars (and now and then a shooting star), the moon, the sun, far clouds, near
 * clouds, birds.
 */

import {
  Surface,
  TRANSPARENT,
  clamp,
  hash2,
  mix,
  rng,
  type Color,
} from "~/pixel";
import {
  skyFor,
  type CloudTones,
  type Lighting,
  type SkySpec,
} from "./lighting";
import { P } from "./palette";

export interface SkyOptions {
  light: Lighting;
  /** Seconds. Clouds drift, stars twinkle and birds fly as it advances. */
  t: number;
  /** Fixes the star field and the cloud shapes. */
  seed: number;
  /** The sky is painted from y = 0 down to (not including) this row. */
  horizonY: number;
  /** 0 new, 0.25 first quarter, 0.5 full (the default), 0.75 last quarter. */
  moonPhase?: number;
  /** Cloud cover from 0 (clear) to 1 (crowded). Default 0.5. */
  clouds?: number;
  /**
   * Rows above this are hidden by something else (the logo, the board), so the sun and the
   * moon are kept below it. Default 0. (The home screen spreads in `menuLayout().sky`,
   * which sets this, `horizonY`, `sunX` and `moon` together.)
   */
  clearTop?: number;
  /**
   * The column the evening sun climbs and sets in, for a scene that has to keep it clear
   * of something. The morning sun uses the mirror image. Default: about three quarters of
   * the way across.
   */
  sunX?: number;
  /**
   * Where the centre of the moon goes, for a scene that has to fit it between other
   * things. Default: `moonPosition()`.
   */
  moon?: { x: number; y: number };
}

/** A disc in the sky. */
export interface SkyBody {
  x: number;
  y: number;
  r: number;
}

/** The evening sun's column, as a fraction of the width. Clear of the middle third. */
const SUN_COLUMN = 0.74;

/** The evening sun's column on a sky `w` wide: `sunX` if it was given, else the default. */
function eveningColumn(w: number, sunX: number | undefined): number {
  return Math.round(
    sunX !== undefined && Number.isFinite(sunX) ? sunX : w * SUN_COLUMN,
  );
}

/**
 * Where the sun is on a sky `w` wide with its horizon at `horizonY`. On the horizon line
 * at 0 degrees, then climbing on a sine, so it is still in view at noon: its highest
 * centre is `clearTop + r + 4`. It rises and sets in one column: about three quarters of
 * the way across in the evening (or `sunX`), and the mirror image of that in the morning.
 * Below 0 degrees it sinks under the horizon and is gone by about -3.
 */
export function sunPosition(
  light: Lighting,
  w: number,
  horizonY: number,
  clearTop = 0,
  sunX?: number,
): SkyBody {
  const { elevation, morning } = light.sun;
  const r = clamp(Math.round(6 + w / 40), 12, 20);
  const top = clamp(clearTop, 0, horizonY) + r + 4;
  const track = Math.max(r, horizonY - top);
  const rise =
    elevation >= 0
      ? Math.sin((Math.min(elevation, 90) * Math.PI) / 180) * track
      : elevation * Math.max(track / 57.3, (r + 4) / 3);
  const column = eveningColumn(w, sunX);
  return {
    x: morning ? w - column : column,
    y: Math.round(horizonY - rise),
    r,
  };
}

/**
 * Where the moon is: upper left, in the column the morning sun uses, the same place all
 * night (so it never jumps at solar midnight), and never above `clearTop`.
 */
export function moonPosition(
  w: number,
  horizonY: number,
  clearTop = 0,
): SkyBody {
  // the same radius as menuLayout's `moonR` (layout.ts)
  const r = clamp(Math.round(6 + w / 45), 12, 18);
  return {
    x: w - eveningColumn(w, undefined),
    y: Math.max(
      Math.round(horizonY * 0.4),
      Math.round(clamp(clearTop, 0, horizonY)) + r + 4,
    ),
    r,
  };
}

/** Paint the sky into `s` from the top down to `opts.horizonY`. */
export function drawSky(s: Surface, opts: SkyOptions): void {
  const w = s.w;
  const horizonY = Math.round(clamp(opts.horizonY, 0, s.h));
  if (!(horizonY > 0) || w <= 0) return;
  const light = opts.light;
  const spec = skyFor(light);
  const t = Number.isFinite(opts.t) ? opts.t : 0;
  const seed = Math.round(Number.isFinite(opts.seed) ? opts.seed : 0) | 0;
  const density = clamp(opts.clouds ?? 0.5, 0, 1);
  const clearTop = Number.isFinite(opts.clearTop) ? (opts.clearTop ?? 0) : 0;
  const sun = sunPosition(light, w, horizonY, clearTop, opts.sunX);
  const moon = moonPosition(w, horizonY, clearTop);
  if (opts.moon && Number.isFinite(opts.moon.x + opts.moon.y)) {
    moon.x = Math.round(opts.moon.x);
    moon.y = Math.round(opts.moon.y);
  }
  const moonOut = spec.moonVisibility > 0;

  s.pushClip(0, 0, w, horizonY);
  s.blit(backdrop(spec, w, horizonY, sun.x), 0, 0);
  if (spec.stars > 0) {
    drawStars(s, spec, t, seed, horizonY, moonOut ? moon : undefined);
    if (spec.stars > 0.7) drawShootingStar(s, spec, t, seed, horizonY);
  }
  if (moonOut) drawMoon(s, spec, moon, opts.moonPhase ?? 0.5);
  if (sun.y - sun.r < horizonY) drawSun(s, spec, sun, horizonY);
  if (density > 0) {
    // The columns the clouds start clear of, each with the room it wants either side:
    // where the sun climbs in the evening and in the morning, and the moon.
    const eveningX = eveningColumn(w, opts.sunX);
    const room = sun.r + 6;
    const clear: ClearColumn[] = [
      [eveningX, room],
      [w - eveningX, room],
      [moon.x, moon.r + 4],
    ];
    drawClouds(s, spec.cloudFar, t, seed, horizonY, density, FAR, clear);
    drawClouds(s, spec.cloudNear, t, seed, horizonY, density, NEAR, clear);
  }
  if (spec.birds) drawBirds(s, spec, t, seed, horizonY);
  s.popClip();
}

// ---------------------------------------------------------------------------
// Bands
// ---------------------------------------------------------------------------

/** The band colour at a row, ignoring the arch over the sun. */
function bandAt(spec: SkySpec, y: number, horizonY: number): Color {
  const f = y / horizonY;
  let i = 0;
  while (i < spec.stops.length && f >= spec.stops[i]) i++;
  return spec.bands[i];
}

const BELL_STEPS = 256;
const BELL_REACH = 2.6;
const BELL = new Float64Array(BELL_STEPS + 1);
for (let i = 0; i <= BELL_STEPS; i++) {
  const u = (i / BELL_STEPS) * BELL_REACH;
  BELL[i] = Math.exp(-u * u);
}

const backdrops = new Map<string, Surface>();
let backdropId = 0;
const specIds = new WeakMap<SkySpec, number>();

/**
 * The bands, as a cached layer. Each boundary is four rows of ordered dither: one dot in
 * four, two rows of checkerboard, one dot in four. When the sun is low the boundaries rise
 * in an arch over it (`glowStrength`), so the warm bands dome up around the sun.
 */
function backdrop(
  spec: SkySpec,
  w: number,
  horizonY: number,
  sunX: number,
): Surface {
  let id = specIds.get(spec);
  if (id === undefined) {
    id = backdropId++;
    specIds.set(spec, id);
  }
  const key = `${id}|${w}|${horizonY}|${sunX}`;
  const hit = backdrops.get(key);
  if (hit) return hit;

  const layer = new Surface(w, horizonY);
  const bands = spec.bands;
  const n = bands.length;
  const glow = spec.glowStrength;
  // edge[i] is the height above the horizon of the boundary under band i.
  const edge: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    edge.push(horizonY - Math.round(clamp(spec.stops[i], 0, 1) * horizonY));
  }
  // How many rows either side of a boundary are dithered: never past the middle of a band.
  const soft: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const above = (i === 0 ? horizonY : edge[i - 1]) - edge[i];
    const below = edge[i] - (i === n - 2 ? 0 : edge[i + 1]);
    soft.push(Math.min(4, Math.floor(Math.min(above, below) / 4)));
  }
  // How many of a boundary's dithered rows are checkerboard (the rest one dot in four): the
  // first half of them.
  const half = (k: number): number => Math.ceil(k / 2);

  const data = layer.data;
  for (let y = 0; y < horizonY; y++) {
    const d = horizonY - y - 0.5; // height above the horizon
    const u = d / horizonY;
    // How far this row's bands are lifted at the sun, and how wide the arch is here.
    const lift =
      glow > 0
        ? glow * 0.115 * horizonY * (u / 0.2) * Math.exp(1 - u / 0.2)
        : 0;
    const sigma = horizonY * 0.3 + d * 1.7;
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let h = d;
      if (lift > 0) {
        const q = (Math.abs(x - sunX) / sigma) * (BELL_STEPS / BELL_REACH);
        if (q < BELL_STEPS) h -= lift * BELL[q | 0];
      }
      let i = 0;
      while (i < n - 1 && h < edge[i]) i++;
      let c = bands[i];
      // Distance above the boundary below, and below the boundary above.
      const up = i < n - 1 ? h - edge[i] : 99;
      const down = i > 0 ? edge[i - 1] - h : 99;
      if (up < down) {
        const k = soft[i];
        if (up < k) {
          const other = bands[i + 1];
          if (up < half(k) || k === 1) {
            if (((x + y) & 1) === 0) c = other;
          } else if (((x - y) & 3) === 0) c = other;
        }
      } else {
        const k = soft[i - 1] ?? 0;
        if (down <= k) {
          const other = bands[i - 1];
          if (down <= half(k) || k === 1) {
            if (((x + y) & 1) === 1) c = other;
          } else if (((x - y) & 3) === 1) c = other;
        }
      }
      data[row + x] = c;
    }
  }

  if (backdrops.size >= 12) backdrops.clear();
  backdrops.set(key, layer);
  return layer;
}

/** The colour already painted at a point, clamped into the sky. */
function skyBehind(s: Surface, x: number, y: number, horizonY: number): Color {
  return s.get(clamp(x, 0, s.w - 1), clamp(y, 0, horizonY - 1));
}

// ---------------------------------------------------------------------------
// Sun
// ---------------------------------------------------------------------------

function drawSun(
  s: Surface,
  spec: SkySpec,
  sun: SkyBody,
  horizonY: number,
): void {
  const { x, y, r } = sun;
  // The glow is the halo colour worked into the sky behind, so it is soft against any band.
  const behind = skyBehind(s, x, y, horizonY);
  const inner = mix(behind, spec.sunHalo[0], 0.8);
  const outer = mix(behind, spec.sunHalo[1], 0.5);
  // The glow draws in as the disc sinks under the horizon.
  const reach = 1 - clamp((y - horizonY) / (r + 1), 0, 1);
  if (reach > 0) {
    s.disc(x, y, r + Math.round(12 * reach), outer, 0.25);
    s.disc(x, y, r + Math.round(8 * reach), outer, 0.5);
    s.disc(x, y, r + Math.round(4 * reach), inner);
  }
  s.disc(x, y, r, spec.sunDisc);
}

// ---------------------------------------------------------------------------
// Moon
// ---------------------------------------------------------------------------

function drawMoon(
  s: Surface,
  spec: SkySpec,
  moon: SkyBody,
  phase: number,
): void {
  const { x, y, r } = moon;
  const p = (((Number.isFinite(phase) ? phase : 0.5) % 1) + 1) % 1;
  const k = Math.cos(p * Math.PI * 2); // 1 new, 0 quarter, -1 full
  if (k > 0.97) return; // new moon: nothing to see

  // Halo and disc are built on their own layer in full-strength colours...
  const reach = r + 12;
  const size = reach * 2 + 1;
  const layer = new Surface(size, size);
  layer.disc(reach, reach, r + 12, spec.moonHalo, 0.25);
  layer.disc(reach, reach, r + 8, spec.moonHalo, 0.5);
  layer.disc(reach, reach, r + 4, spec.moonHalo);

  const disc = r * 2 + 1;
  const m = new Surface(disc, disc);
  m.disc(r, r, r, spec.moonShade);
  // Lit from the top left: the shade is a thin limb on the bottom right.
  const face = new Surface(disc, disc);
  face.disc(r - 2, r - 2, r, spec.moon);
  face.mask(m);
  m.blit(face, 0, 0);
  drawMoonSeas(m, r, spec.moon, spec.moonShade);

  // Cut the phase: each row keeps only its lit part.
  if (k > -0.97) {
    const waxing = p < 0.5;
    for (let j = 0; j < disc; j++) {
      const dy = j - r;
      const half = Math.sqrt(Math.max(0, (r + 0.5) * (r + 0.5) - dy * dy));
      // Never thinner than a clean two-pixel crescent.
      const terminator = half * Math.min(k, 0.72);
      for (let i = 0; i < disc; i++) {
        const dx = i - r;
        const inLight = waxing ? dx > terminator : dx < -terminator;
        if (!inLight) m.erase(i, j, 1, 1);
      }
    }
  }
  layer.blit(m, reach - r, reach - r);

  // ...and then faded, pixel by pixel, into whatever sky is behind: the moon comes up out
  // of the dusk rather than switching on, and the halo is only ever a tint of the sky.
  const v = spec.moonVisibility;
  const faded = new Map<number, Color>();
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const c = layer.get(i, j);
      if (c === TRANSPARENT) continue;
      const px = x - reach + i;
      const py = y - reach + j;
      const behind = s.get(px, py);
      if (behind === TRANSPARENT) continue;
      const amount = c === spec.moonHalo ? 0.4 * v : v;
      if (amount >= 1) {
        s.px(px, py, c);
        continue;
      }
      // Few distinct pairs: a handful of sky colours behind three moon colours.
      const key =
        behind * 4 + (c === spec.moonHalo ? 0 : c === spec.moon ? 1 : 2);
      let out = faded.get(key);
      if (out === undefined) {
        out = mix(behind, c, amount);
        faded.set(key, out);
      }
      s.px(px, py, out);
    }
  }
}

/**
 * The moon's face, on its own layer `m` (radius `r`, centre (r, r)): two seas
 * running on a diagonal from the upper left, a third low on the right, a ray crater and a
 * few small ones. Never two eyes and a mouth. The seas are flat shade; a crater is a dark
 * bowl lit on its lower right rim (the light comes from the top left).
 */
function drawMoonSeas(m: Surface, r: number, lit: Color, shade: Color): void {
  const u = r / 18;
  const at = (f: number): number => Math.round(f * u);
  // the big sea, upper left, and the one joined to it below
  m.ellipse(r - at(5), r - at(6), at(4.5), at(3), shade, true);
  m.ellipse(r - at(8), r - at(2), at(3), at(2.5), shade, true);
  m.ellipse(r - at(1), r - at(2), at(2.5), at(2), shade, true);
  // a bay of light biting into it
  m.rect(r - at(6), r - at(5), at(2), 1, lit);
  // the sea low on the right
  m.ellipse(r + at(4), r + at(4), at(4), at(2.5), shade, true);
  m.ellipse(r + at(1), r + at(6), at(2.5), at(1.5), shade, true);
  // a crater high on the right: a dark bowl, its lower right rim catching the light
  const cx = r + at(6);
  const cy = r - at(5);
  m.disc(cx, cy, Math.max(1, at(2)), shade);
  m.px(cx + Math.max(1, at(2)), cy + 1, lit);
  m.px(cx + 1, cy + Math.max(1, at(2)), lit);
  // small craters
  m.rect(r - at(9), r + at(6), 2, 2, shade);
  m.px(r - at(9) + 2, r + at(6) + 1, lit);
  m.rect(r + at(9), r + at(1), 2, 1, shade);
  m.px(r - at(2), r + at(10), shade);
  m.px(r + at(2), r - at(11), shade);
}

// ---------------------------------------------------------------------------
// Stars
// ---------------------------------------------------------------------------

const STAR_CELL = 12;

function drawStars(
  s: Surface,
  spec: SkySpec,
  t: number,
  seed: number,
  horizonY: number,
  moon: SkyBody | undefined,
): void {
  const [bright, medium, dim, warm] = spec.starColors;
  const w = s.w;
  const cell = STAR_CELL;
  const cols = Math.ceil(w / cell);
  const rows = Math.ceil(horizonY / cell);
  // A loose river of stars runs down the sky from the upper right.
  const riverX = w * 0.72;
  const riverWidth = 20 + horizonY * 0.1;
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      const h = hash2(cx, cy, seed);
      // Two pixels of margin in every cell, so two stars never touch.
      const x = cx * cell + 2 + Math.floor(hash2(cx, cy, seed + 1) * 8);
      const y = cy * cell + 2 + Math.floor(hash2(cx, cy, seed + 2) * 8);
      const depth = y / horizonY; // 0 zenith, 1 horizon
      const off = (x - riverX + y * 0.9) / riverWidth;
      const river = Math.exp(-off * off);
      // Fewer stars towards the horizon, more in the river.
      if (h > (0.13 + 0.3 * river) * (1 - 0.85 * depth * depth)) continue;
      if (moon) {
        const reach = moon.r + 12;
        if (Math.abs(x - moon.x) <= reach && Math.abs(y - moon.y) <= reach) {
          continue;
        }
      }
      const kind = hash2(cx, cy, seed + 3);
      // 0 bright, 1 medium, 2 dim. The river is mostly dust. Stars sink a level near the
      // horizon.
      let level = kind < 0.14 ? 0 : kind < 0.5 - 0.2 * river ? 1 : 2;
      const plus = kind < 0.045 && depth < 0.62;
      if (depth > 0.5) level = Math.min(2, level + 1);
      if (depth > 0.78) level = 2;
      // The brightest come out first, from the zenith down.
      const needs =
        0.08 + level * 0.25 + depth * 0.35 + hash2(cx, cy, seed + 4) * 0.2;
      if (spec.stars < needs) continue;

      // A slow twinkle: now and then a star drops one level for a moment.
      const period = 3 + hash2(cx, cy, seed + 5) * 5;
      const at = (t / period + hash2(cx, cy, seed + 6)) % 1;
      const blink = at < 0.09;
      if (blink) level++;
      if (level > 2) continue;
      const tint = level === 0 && kind > 0.1 ? warm : bright;
      drawStar(s, x, y, level, plus && !blink, tint, medium, dim);
    }
  }
}

/**
 * One star. Level 0 (the brightest) is a 2 x 2 block, and the very brightest (`plus`)
 * have a cross of light round it; levels 1 and 2 are single pixels.
 */
function drawStar(
  s: Surface,
  x: number,
  y: number,
  level: number,
  plus: boolean,
  tint: Color,
  medium: Color,
  dim: Color,
): void {
  if (level === 0) {
    s.rect(x, y, 2, 2, tint);
    if (plus) {
      s.rect(x - 2, y, 2, 1, medium);
      s.rect(x + 2, y + 1, 2, 1, medium);
      s.rect(x, y - 2, 1, 2, medium);
      s.rect(x + 1, y + 2, 1, 2, medium);
    }
    return;
  }
  if (level === 1) {
    s.px(x, y, medium);
    s.px(x + 1, y + 1, dim);
    return;
  }
  s.px(x, y, dim);
}

/** Seconds between chances of a shooting star, and how long one lasts. */
const SHOOT_EVERY = 9;
const SHOOT_FOR = 0.55;

/** Now and then a short streak crosses the upper sky. Deliberate, brief and rare. */
function drawShootingStar(
  s: Surface,
  spec: SkySpec,
  t: number,
  seed: number,
  horizonY: number,
): void {
  const cycle = Math.floor(t / SHOOT_EVERY);
  if (hash2(cycle, 11, seed) > 0.55) return;
  const start = hash2(cycle, 12, seed) * (SHOOT_EVERY - SHOOT_FOR);
  const p = (t - cycle * SHOOT_EVERY - start) / SHOOT_FOR;
  if (p < 0 || p >= 1) return;
  const [bright, medium, dim] = spec.starColors;
  const dir = hash2(cycle, 13, seed) < 0.5 ? -1 : 1;
  const x0 = Math.round(s.w * (0.2 + 0.6 * hash2(cycle, 14, seed)));
  const y0 = Math.round(horizonY * (0.06 + 0.3 * hash2(cycle, 15, seed)));
  // Four across and two down a step, 12 steps a second.
  const along = Math.floor(p * 12) * 4;
  shootingTail(s, x0, y0, dir, along, bright, medium, dim);
}

/**
 * The shooting star's streak: its head `along` pixels from (x0, y0), going
 * `dir` (1 right, -1 left) two across for every one down, a 2 x 2 head and a tail that
 * thins and fades behind it.
 */
function shootingTail(
  s: Surface,
  x0: number,
  y0: number,
  dir: number,
  along: number,
  bright: Color,
  medium: Color,
  dim: Color,
): void {
  for (let i = 11; i >= 0; i--) {
    const a = along - i;
    if (a < 0) continue;
    const c = i < 4 ? bright : i < 8 ? medium : dim;
    const x = x0 + dir * a;
    const y = y0 + (a >> 1);
    s.px(x, y, c);
    // the head is two pixels deep, and so is the first of the tail
    if (i < 3) s.px(x, y + 1, i === 0 ? bright : medium);
  }
}

// ---------------------------------------------------------------------------
// Clouds
// ---------------------------------------------------------------------------

interface CloudLayer {
  /** Seed offset, so the layers differ. */
  salt: number;
  /** Pixels per second. */
  speed: number;
  /**
   * Cloud widths. The widest grows by `2 * grow` px for every 2 px the sky is wider than
   * 260, in steps of 2 px.
   */
  minW: number;
  maxW: number;
  grow: number;
  /** The band of sky the cloud bases sit in, as fractions of the sky height. */
  top: number;
  bottom: number;
  /** One cloud per this many pixels of width at full density. */
  every: number;
}

const FAR: CloudLayer = {
  salt: 101,
  speed: 0.8,
  minW: 26,
  maxW: 48,
  grow: 0.02,
  top: 0.66,
  bottom: 0.87,
  every: 76,
};

const NEAR: CloudLayer = {
  salt: 202,
  speed: 2,
  minW: 48,
  maxW: 92,
  grow: 0.07,
  top: 0.27,
  bottom: 0.57,
  every: 124,
};

const cloudCache = new Map<string, Surface>();

interface Puff {
  x: number;
  /** Height of the centre above the base row. */
  lift: number;
  rx: number;
  ry: number;
  /** Sits on the base (false for a crown riding on another puff). */
  grounded: boolean;
}

/**
 * One chunky cumulus, flat on its bottom row, about `width` px wide. Same seed, same
 * shape. It is a row of overlapping puffs, tallest near the middle, sometimes with a crown.
 * `top` fills the upper mass, `mid` is the scalloped belly the puffs bulge down into,
 * `under` is the flat line of the base and `rim` the 1 px edge along the top. The result is
 * cached: do not draw on it.
 */
export function cloudSprite(
  seed: number,
  width: number,
  tones: CloudTones,
): Surface {
  const [rim, top, mid, under] = tones;
  const key = `${seed}|${width}|${rim}|${top}|${mid}|${under}`;
  const hit = cloudCache.get(key);
  if (hit) return hit;

  const r = rng(seed);
  const want = Math.max(16, Math.round(width));
  // Small clouds are stubby, big ones stretch out.
  const tall =
    want >= 80
      ? r.range(0.33, 0.4)
      : want >= 40
        ? r.range(0.38, 0.45)
        : r.range(0.42, 0.5);
  const height = clamp(Math.round(want * tall), 10, 52);
  // The big puff is as tall as the cloud. The rest are built outwards from it, each
  // smaller than the one before, until the cloud is as wide as asked.
  const peakRy = Math.max(4, Math.round(height * 0.52));
  const peakRx = Math.max(6, Math.round(peakRy / 0.84));
  const puffs: Puff[] = [
    {
      x: 0,
      lift: height - 1 - peakRy,
      rx: peakRx,
      ry: peakRy,
      grounded: true,
    },
  ];
  let left = puffs[0];
  let right = puffs[0];
  let side = r.chance(0.5) ? -1 : 1;
  let stuck = 0;
  for (let i = 0; i < 12 && stuck < 2; i++) {
    const from = side < 0 ? left : right;
    const overlap = r.range(0.7, 0.82);
    const room = want - 1 - (right.x + right.rx - (left.x - left.rx));
    // The widest a puff on this side can be without overshooting.
    const fit = (room + from.rx * (1 - overlap)) / (1 + overlap);
    const rx = Math.min(
      Math.round(Math.max(from.rx * r.range(0.6, 0.86), peakRx * 0.42)),
      Math.floor(fit),
    );
    if (rx < 4) {
      // No room on this side: try the other, and stop when neither has any.
      stuck++;
      side = -side;
      continue;
    }
    stuck = 0;
    const ry = Math.max(4, Math.round(rx * 0.86));
    const puff: Puff = {
      x: from.x + side * Math.max(4, Math.round((from.rx + rx) * overlap)),
      // Sitting low keeps the ends round.
      lift: Math.min(
        Math.round(ry * r.range(0.5, 0.8)),
        Math.max(0, height - 1 - ry),
      ),
      rx,
      ry,
      grounded: true,
    };
    puffs.push(puff);
    if (side < 0) left = puff;
    else right = puff;
    // Mostly alternate sides, so the big puff ends up near the middle but rarely on it.
    if (i === 0 || !r.chance(0.3)) side = -side;
  }
  // A crown on the shoulder of the big puff makes a broader, two-headed cloud.
  if (want >= 52 && r.chance(0.5)) {
    const big = puffs[0];
    const rx = Math.max(6, Math.round(big.rx * r.range(0.55, 0.7)));
    puffs.push({
      x: big.x + (r.chance(0.5) ? -1 : 1) * Math.round(big.rx * 0.6),
      lift: big.lift + Math.round(big.ry * 0.35),
      rx,
      ry: Math.max(4, Math.round(rx * 0.86)),
      grounded: false,
    });
  }
  // Shift everything so the leftmost pixel is column 0.
  let minX = Infinity;
  let maxX = -Infinity;
  let h = 0;
  for (const p of puffs) {
    minX = Math.min(minX, p.x - p.rx);
    maxX = Math.max(maxX, p.x + p.rx);
    h = Math.max(h, p.lift + p.ry + 1);
  }
  for (const p of puffs) p.x -= minX;
  const w = maxX - minX + 1;
  const base = h - 1;

  const shape = new Surface(w, h);
  for (const p of puffs) {
    shape.ellipse(p.x, base - p.lift, p.rx, p.ry, top, true);
  }
  // No hollows under the puffs: between the end puffs, every column is solid to the base.
  for (let cx = left.x; cx <= right.x; cx++) {
    let cy = 0;
    while (cy < h && shape.get(cx, cy) === TRANSPARENT) cy++;
    if (cy < h) shape.vline(cx, cy, h - cy, top);
  }
  // No one-pixel spikes or nicks along the top: a puff that barely pokes out of another
  // would leave one.
  for (let cx = 1; cx < w - 1; cx++) {
    const here = topOf(shape, cx);
    const a = topOf(shape, cx - 1);
    const b = topOf(shape, cx + 1);
    if (here < a && here < b) shape.erase(cx, here, 1, Math.min(a, b) - here);
    else if (here > a && here > b) {
      shape.vline(cx, Math.max(a, b), here - Math.max(a, b), top);
    }
  }
  // Round the two bottom corners.
  trimCorners(shape, base, 2);

  const baseRows = h >= 24 ? 4 : 2;
  // The belly: each puff bulges down into it as a round lobe, so its top edge is a row
  // of scallops. Light comes from the top left, so the belly also climbs the right end.
  if (h >= 12) {
    const floor = baseRows + (h >= 24 ? 4 : h >= 16 ? 2 : 0);
    const cap = floor + (h >= 28 ? 6 : 4);
    const rows: number[] = [];
    for (let cx = 0; cx < w; cx++) {
      let edge = cx < left.x ? floor : h;
      for (const p of puffs) {
        if (!p.grounded) continue;
        const dx = Math.abs(cx - p.x) / p.rx;
        if (dx >= 1) continue;
        const depth = clamp(Math.round(p.ry * 0.8), 4, 16);
        edge = Math.min(edge, floor + depth * (1 - Math.sqrt(1 - dx * dx)));
      }
      if (cx <= right.x) edge = Math.min(edge, cap);
      rows.push(Math.round(edge));
    }
    // No one-pixel teeth or nicks: every step in the scallops is at least two wide.
    for (let cx = 1; cx < w - 1; cx++) {
      const a = rows[cx - 1];
      const b = rows[cx + 1];
      if (rows[cx] > a && rows[cx] > b) rows[cx] = Math.max(a, b);
      else if (rows[cx] < a && rows[cx] < b) rows[cx] = Math.min(a, b);
    }
    for (let cx = 0; cx < w; cx++) {
      for (let j = 0; j < rows[cx]; j++) {
        if (shape.get(cx, base - j) !== TRANSPARENT)
          shape.px(cx, base - j, mid);
      }
    }
  }
  // The flat base.
  for (let cx = 0; cx < w; cx++) {
    for (let j = 0; j < baseRows; j++) {
      if (shape.get(cx, base - j) !== TRANSPARENT) {
        shape.px(cx, base - j, under);
      }
    }
  }
  // The rim: the top pixel of every column.
  if (rim !== top) {
    for (let cx = 0; cx < w; cx++) {
      for (let cy = 0; cy < base; cy++) {
        const c = shape.get(cx, cy);
        if (c === TRANSPARENT) continue;
        if (c === top) shape.px(cx, cy, rim);
        break;
      }
    }
  }

  if (cloudCache.size > 240) cloudCache.clear();
  cloudCache.set(key, shape);
  return shape;
}

/** The first painted row in a column (the surface height if the column is empty). */
function topOf(shape: Surface, cx: number): number {
  let cy = 0;
  while (cy < shape.h && shape.get(cx, cy) === TRANSPARENT) cy++;
  return cy;
}

/** Take `n` px off each end of the bottom row, then `n - 1` off the row above, and so on. */
function trimCorners(shape: Surface, base: number, n: number): void {
  for (let j = 0; j < n; j++) {
    const y = base - j;
    const cut = n - j;
    let left = 0;
    while (left < shape.w && shape.get(left, y) === TRANSPARENT) left++;
    let right = shape.w - 1;
    while (right >= 0 && shape.get(right, y) === TRANSPARENT) right--;
    if (right - left + 1 <= cut * 2 + 2) continue;
    shape.erase(left, y, cut, 1);
    shape.erase(right - cut + 1, y, cut, 1);
  }
}

/** One cloud of a layer: where it starts on the layer's loop, and which cloud it is. */
interface CloudSpot {
  slot: number;
  width: number;
  /** Its base row as a fraction of the sky height. */
  base: number;
  shape: number;
}

interface CloudField {
  spots: readonly CloudSpot[];
  /** The loop is this long, and clouds enter this far off the left edge. */
  period: number;
  margin: number;
}

/** A column the clouds start clear of, and how many px either side of it to leave open. */
type ClearColumn = readonly [x: number, room: number];

const cloudFields = new Map<string, CloudField>();

/**
 * Where a layer's clouds are at t = 0. They sit in jittered slots along a loop a little
 * longer than the sky is wide. The loop is then turned, as little as it takes, until the
 * `clear` columns (sun and moon) sit in gaps: the first thing anyone sees is an open sun,
 * and after that the clouds drift across it as clouds do.
 */
function cloudField(
  w: number,
  seed: number,
  density: number,
  layer: CloudLayer,
  clear: readonly ClearColumn[],
): CloudField {
  const key = `${w}|${seed}|${density}|${layer.salt}|${clear.join("|")}`;
  const hit = cloudFields.get(key);
  if (hit) return hit;

  const maxW =
    layer.maxW + 2 * Math.round(clamp((w / 2 - 130) * layer.grow, 0, 24));
  const margin = maxW + 12;
  const period = w + margin;
  const count = Math.round((density * 1.3 * period) / layer.every);
  const r = rng(seed * 31 + layer.salt);
  const spots: CloudSpot[] = [];
  // One cloud in each run of five is a big one; the rest lean small.
  const hero = count > 0 ? r.int(0, Math.min(count, 5) - 1) : 0;
  for (let i = 0; i < count; i++) {
    const size = i % 5 === hero ? r.range(0.8, 1) : Math.pow(r(), 1.6) * 0.75;
    const width = Math.round(layer.minW + (maxW - layer.minW) * size);
    const slot = Math.floor(((i + r.range(0.25, 0.75)) / count) * period);
    // Bigger clouds ride higher: they are the nearer ones.
    const height = clamp(size * 0.65 + r() * 0.45, 0, 1);
    spots.push({
      slot,
      width,
      base: layer.bottom + (layer.top - layer.bottom) * height,
      shape: r.int(0, 1 << 30),
    });
  }

  // Turn the loop to the first place that gives every clear column its room, or failing
  // that to the place that comes closest.
  let best = 0;
  let bestSpare = -Infinity;
  for (let turn = 0; turn < period && bestSpare < 0; turn += 2) {
    let spare = Infinity;
    for (const spot of spots) {
      const x0 = ((spot.slot + turn) % period) - margin;
      const x1 = x0 + spot.width + 2;
      for (const [column, room] of clear) {
        const gap = column < x0 ? x0 - column : column > x1 ? column - x1 : 0;
        if (gap - room < spare) spare = gap - room;
      }
    }
    if (spare > bestSpare) {
      bestSpare = spare;
      best = turn;
    }
  }
  for (const spot of spots) spot.slot = (spot.slot + best) % period;

  const field: CloudField = { spots, period, margin };
  if (cloudFields.size >= 24) cloudFields.clear();
  cloudFields.set(key, field);
  return field;
}

function drawClouds(
  s: Surface,
  tones: CloudTones,
  t: number,
  seed: number,
  horizonY: number,
  density: number,
  layer: CloudLayer,
  clear: readonly ClearColumn[],
): void {
  const { spots, period, margin } = cloudField(
    s.w,
    seed,
    density,
    layer,
    clear,
  );
  const drift = Math.floor(t * layer.speed);
  for (const spot of spots) {
    const cloud = cloudSprite(spot.shape, spot.width, tones);
    const x = ((((spot.slot + drift) % period) + period) % period) - margin;
    s.blit(cloud, x, Math.round(horizonY * spot.base) - cloud.h + 1);
  }
}

// ---------------------------------------------------------------------------
// Birds
// ---------------------------------------------------------------------------

const FLOCK: readonly (readonly [number, number])[] = [
  [0, 0],
  [-12, 6],
  [-18, -4],
];

function drawBirds(
  s: Surface,
  spec: SkySpec,
  t: number,
  seed: number,
  horizonY: number,
): void {
  const r = rng(seed * 17 + 9);
  const span = s.w + 180;
  const y0 = Math.round(horizonY * r.range(0.3, 0.5));
  const start = r.range(0, span);
  const x0 = (((Math.floor(start + t * 10) % span) + span) % span) - 80;
  const c = mix(bandAt(spec, y0, horizonY), P.slate, 0.7);
  for (let i = 0; i < FLOCK.length; i++) {
    const up = Math.floor(t * 3 + i * 0.37) % 2 === 0;
    drawGull(s, x0 + FLOCK[i][0], y0 + FLOCK[i][1], up, c);
  }
}

/**
 * A bird: a body two pixels wide at (x, y) and (x + 1, y), the wings raised
 * (`up`) or spread level with their tips down, seven pixels from tip to tip.
 */
export function drawGull(
  s: Surface,
  x: number,
  y: number,
  up: boolean,
  c: Color,
): void {
  s.rect(x, y, 2, 1, c);
  if (up) {
    s.px(x - 1, y - 1, c);
    s.px(x - 2, y - 2, c);
    s.px(x + 2, y - 1, c);
    s.px(x + 3, y - 2, c);
    return;
  }
  s.rect(x - 2, y, 2, 1, c);
  s.rect(x + 2, y, 2, 1, c);
  s.px(x - 3, y + 1, c);
  s.px(x + 4, y + 1, c);
}
