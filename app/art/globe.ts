/**
 * The Earth as a ball (2026-11-18): CLOSEST's and FURTHEST's kick-offs on the home screen
 * (the menu ball turning into it and diving in; the home screen pulling back to it), in the
 * game's world map's colours (app/scenes/map.ts) and from its land (./world-map.ts).
 *
 * - `drawGlobe`: an orthographic globe of any size, from a ball on the screen to one many
 *   times the screen across (its middle then is the map round a place), its land sampled in
 *   blocks no bigger than half a cell of the land's grid (and fewer, the bigger it is on
 *   the screen), coasts where land meets sea, dissolved in by `coverage` (a 4 x 4 dither).
 * - `drawStars`: the night round it, seeded.
 * - `drawMapPin`: the day's place's pin, as the map draws it.
 *
 * Pure: no clock, no randomness but the seed.
 */

import { type Color, Surface, bayer4, hash2 } from "~/pixel";

import { P } from "./palette";
import { type GeoPoint, isLand } from "./world-map";

/** The map's colours (MapScene's world): its sea, its land, the coast between them. */
export interface GlobeColors {
  sea: Color;
  land: Color;
  coast: Color;
  /** The globe's edge, against space: drawn where the whole of it is on the screen. */
  rim: Color;
}

export const GLOBE_COLORS: GlobeColors = Object.freeze({
  sea: P.ledOff,
  land: P.slate,
  coast: P.steel,
  rim: P.steel,
});

/** The land's grid is half a degree: blocks are at most half of one of its cells across. */
const CELL_DEG = 0.5;
/**
 * No more samples than this a frame: SMALL_SAMPLES for a globe no more than SMALL_R across
 * (in sight whole, and still for a while: every pixel of it), MOST_SAMPLES for a bigger one
 * (on its way in or out: blocks of a few pixels, under 4 ms a frame at 640 x 310).
 */
const MOST_SAMPLES = 16000;
const SMALL_SAMPLES = 40000;
const SMALL_R = 150;
const BIGGEST_BLOCK = 16;

const RAD = Math.PI / 180;

/**
 * An orthographic globe of radius `r` (pixels) at (`cx`, `cy`), `centre` (degrees) in its
 * middle, north up. Only what is on `s` is drawn. `coverage` (0 to 1) dissolves it in.
 */
export function drawGlobe(
  s: Surface,
  cx: number,
  cy: number,
  r: number,
  centre: GeoPoint,
  opts: { coverage?: number; colors?: GlobeColors } = {},
): void {
  const coverage = opts.coverage ?? 1;
  if (!(r >= 1) || !(coverage > 0)) return;
  const colors = opts.colors ?? GLOBE_COLORS;
  const x0 = Math.max(0, Math.floor(cx - r));
  const x1 = Math.min(s.w - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r));
  const y1 = Math.min(s.h - 1, Math.ceil(cy + r));
  if (x0 > x1 || y0 > y1) return;
  // blocks: half a cell of the land's grid at the middle, fewer where that is too many
  const cellPx = r * CELL_DEG * RAD;
  const area = Math.min(Math.PI * r * r, (x1 - x0 + 1) * (y1 - y0 + 1));
  let block = Math.max(1, Math.floor(cellPx / 2));
  const most = r <= SMALL_R ? SMALL_SAMPLES : MOST_SAMPLES;
  block = Math.max(block, Math.ceil(Math.sqrt(area / most)));
  block = Math.min(block, BIGGEST_BLOCK);
  // the blocks lie on the screen's own grid, so they do not crawl as the globe grows
  const bx0 = Math.floor(x0 / block);
  const by0 = Math.floor(y0 / block);
  const cols = Math.floor(x1 / block) - bx0 + 1;
  const rows = Math.floor(y1 / block) - by0 + 1;
  // 0 sea, 1 land, 2 off the globe
  const grid = new Uint8Array(cols * rows);
  const lat0 = centre.lat * RAD;
  const sin0 = Math.sin(lat0);
  const cos0 = Math.cos(lat0);
  for (let j = 0; j < rows; j++) {
    const sy = (by0 + j) * block + block / 2;
    const v = (sy - cy) / r;
    for (let i = 0; i < cols; i++) {
      const sx = (bx0 + i) * block + block / 2;
      let u = (sx - cx) / r;
      let w = v;
      let d2 = u * u + w * w;
      if (d2 > 1) {
        // a block on the edge: its sample is pulled in onto the globe
        const k = 0.999 / Math.sqrt(d2);
        if (Math.sqrt(d2) - 1 > (block * 0.75) / r) {
          grid[j * cols + i] = 2;
          continue;
        }
        u *= k;
        w *= k;
        d2 = u * u + w * w;
      }
      const z = Math.sqrt(1 - d2);
      const north = -w;
      const lat = Math.asin(Math.max(-1, Math.min(1, z * sin0 + north * cos0)));
      const lng = Math.atan2(u, z * cos0 - north * sin0);
      grid[j * cols + i] = isLand(lat / RAD, centre.lng + lng / RAD) ? 1 : 0;
    }
  }
  const r2 = r * r;
  const data = s.data;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const here = grid[j * cols + i];
      if (here === 2) continue;
      let color = here === 1 ? colors.land : colors.sea;
      if (here === 1) {
        // a coast: land beside sea
        const sea = (a: number, b: number) =>
          a >= 0 && a < cols && b >= 0 && b < rows && grid[b * cols + a] === 0;
        if (sea(i - 1, j) || sea(i + 1, j) || sea(i, j - 1) || sea(i, j + 1)) {
          color = colors.coast;
        }
      }
      const px0 = (bx0 + i) * block;
      const py0 = (by0 + j) * block;
      const xa = Math.max(px0, x0);
      const xb = Math.min(px0 + block, x1 + 1);
      const ya = Math.max(py0, y0);
      const yb = Math.min(py0 + block, y1 + 1);
      // a big block wholly inside the disc is filled a row at a time; the rest a pixel at a
      // time, each tested against the edge
      let inside = false;
      if (block > 2) {
        const ax = xa + 0.5 - cx;
        const bx = xb - 0.5 - cx;
        const ay = ya + 0.5 - cy;
        const by = yb - 0.5 - cy;
        const mx = Math.max(ax * ax, bx * bx);
        const my = Math.max(ay * ay, by * by);
        inside = mx + my <= r2;
      }
      for (let y = ya; y < yb; y++) {
        const row = y * s.w;
        if (inside && coverage >= 1) {
          for (let x = row + xa; x < row + xb; x++) data[x] = color;
          continue;
        }
        const dy = y + 0.5 - cy;
        for (let x = xa; x < xb; x++) {
          const dx = x + 0.5 - cx;
          if (!inside && dx * dx + dy * dy > r2) continue;
          if (coverage < 1 && !(bayer4(x, y) < coverage)) continue;
          data[row + x] = color;
        }
      }
    }
  }
  // its edge against space, where all of it is in sight
  if (
    coverage >= 1 &&
    cx - r >= 0 &&
    cx + r < s.w &&
    cy - r >= 0 &&
    cy + r < s.h
  ) {
    s.circle(Math.round(cx), Math.round(cy), Math.round(r), colors.rim);
  }
}

/** Stars on `s`: about one a STAR_SPACE pixels square, a few bright, seeded. */
const STAR_SPACE = 22;

export function drawStars(s: Surface, seed: number): void {
  const n = Math.round((s.w * s.h) / (STAR_SPACE * STAR_SPACE));
  for (let i = 0; i < n; i++) {
    const x = Math.floor(hash2(i, 1, seed) * s.w);
    const y = Math.floor(hash2(i, 2, seed) * s.h);
    const bright = hash2(i, 3, seed);
    s.px(x, y, bright > 0.85 ? P.white : bright > 0.4 ? P.mist : P.steel);
  }
}

/**
 * The map's pin standing on (`x`, `y`), its point there: `k` its scale (1, or 2 on a wide
 * picture), `base` and `light` its colours. Returns the row of its top.
 */
export function drawMapPin(
  s: Surface,
  x: number,
  y: number,
  k: number,
  base: Color,
  light: Color,
): number {
  const head = 5 * k + 1;
  s.poly(
    [
      [x - 4 * k, y - 8 * k],
      [x + 4 * k, y - 8 * k],
      [x, y],
    ],
    P.ink,
  );
  s.poly(
    [
      [x - 3 * k, y - 8 * k],
      [x + 3 * k, y - 8 * k],
      [x, y - 1],
    ],
    base,
  );
  s.disc(x, y - 8 * k - 2 * k, head + 1, P.ink);
  s.disc(x, y - 8 * k - 2 * k, head, base);
  s.disc(x, y - 8 * k - 2 * k, 2 * k, P.chalk);
  s.rect(x - 2 * k - 1, y - 8 * k - 2 * k - 3 * k, k, k, light);
  return y - 8 * k - head;
}
