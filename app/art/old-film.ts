/**
 * The picture as an old photograph, or a frame of an old newsreel: RETRO's kick-off on the
 * home screen fades the world to sepia round the old ball (2026-11-13).
 *
 *   sepiaTone(s, level, hole);      // the picture in browns, `level` of the way (0 to 1)
 *   drawFilmDamage(s, frame, seed); // a frame's scratches and dust
 *
 * Sepia. Each colour goes to one of eight browns by its brightness (ink brown to cream, the
 * wood and old gold ramps run together), a step or two darker towards the corners (a
 * stepped vignette, no fade, its edges in an ordered dither), and `level` of the way there
 * (stepped by the caller: the fade
 * is a few whole steps). A `hole` (a disc) is left as it is: the old ball keeps its own
 * colours. Colours are worked out once and remembered.
 *
 * Damage. A frame of old film has a scratch or two down it and a few specks of dust, in
 * cream or dark brown, somewhere else each frame (`frame` is a whole step of the film's
 * rate). Clusters of two or three pixels, never single ones.
 *
 * Pure: the same inputs give the same pixels.
 */

import { Surface, hash2, luma, mix, type Color } from "~/pixel";
import { P } from "./palette";

/** The browns, darkest first. */
const RAMP: readonly Color[] = [
  mix(P.woodDark, P.ink, 0.6),
  mix(P.woodDark, P.ink, 0.3),
  P.woodDark,
  mix(P.woodDark, P.wood, 0.5),
  P.wood,
  mix(P.wood, P.retro, 0.55),
  mix(P.retro, P.retroLight, 0.45),
  mix(P.retroLight, P.chalk, 0.55),
];

/** Brightness is lifted a little before it is banded, so a night picture still shows. */
const LIFT = 0.72;
/** The vignette: a step darker beyond this share of the half width and height, two beyond. */
const VIGNETTE = 0.8;
const VIGNETTE_DEEP = 1.1;
/** The vignette's edges are dithered (Bayer 4 x 4) over about this much of `e`. */
const VIGNETTE_DITHER = 0.09;
const BAYER: readonly number[] = [
  0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5,
];

/** Remembered: a colour's brown, by colour, vignette step and level. */
const cache = new Map<number, Color>();
const CACHE_MAX = 8192;

function toned(c: Color, dark: number, level: number): Color {
  const key =
    (c >>> 0) + dark * 4294967296 + Math.round(level * 20) * 17179869184;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const band = Math.min(
    RAMP.length - 1,
    Math.floor(Math.pow(luma(c), LIFT) * RAMP.length),
  );
  const brown = RAMP[Math.max(0, band - dark)];
  const out = level >= 1 ? brown : mix(c, brown, level);
  if (cache.size >= CACHE_MAX) cache.clear();
  cache.set(key, out);
  return out;
}

/**
 * Tone the whole picture `level` of the way to sepia (nothing at 0), except inside `hole`:
 * the pixels of the engine's circle of radius `r` on (cx, cy), as the menu ball's disc.
 */
export function sepiaTone(
  s: Surface,
  level: number,
  hole: { cx: number; cy: number; r: number } | null = null,
): void {
  if (!(level > 0)) return;
  const k = Math.min(1, level);
  const { w, h, data } = s;
  // the hole, as the ball's disc (round(2r) + 1 across)
  let hx0 = 0;
  let hy0 = 0;
  let half = 0;
  let rad2 = -1;
  if (hole !== null && hole.r >= 1) {
    const hd = Math.round(2 * hole.r) + 1;
    hx0 = Math.round(hole.cx - hole.r);
    hy0 = Math.round(hole.cy - hole.r);
    half = (hd - 1) / 2;
    rad2 = (hd / 2) * (hd / 2);
  }
  const mx = (w - 1) / 2;
  const my = (h - 1) / 2;
  const ix = 1 / Math.max(1, mx);
  const iy = 1 / Math.max(1, my);
  const v1 = VIGNETTE * VIGNETTE;
  const v2 = VIGNETTE_DEEP * VIGNETTE_DEEP;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    const ey = (y - my) * iy;
    const ey2 = ey * ey;
    const hdy = y - hy0 - half;
    let last = -1;
    let lastDark = -1;
    let lastOut = 0 as Color;
    for (let x = 0; x < w; x++) {
      if (rad2 >= 0) {
        const hdx = x - hx0 - half;
        if (hdx * hdx + hdy * hdy <= rad2) continue;
      }
      const ex = (x - mx) * ix;
      const e =
        ex * ex +
        ey2 +
        (BAYER[((y & 3) << 2) | (x & 3)] / 16 - 0.47) * VIGNETTE_DITHER;
      const dark = e > v2 ? 2 : e > v1 ? 1 : 0;
      const c = data[row + x];
      if (c === last && dark === lastDark) {
        data[row + x] = lastOut;
        continue;
      }
      last = c;
      lastDark = dark;
      lastOut = toned(c as Color, dark, k);
      data[row + x] = lastOut;
    }
  }
}

/** A scratch's cream and dark tones, and the dust's. */
const SCRATCH_LIGHT = mix(P.retroLight, P.chalk, 0.5);
const SCRATCH_DARK = mix(P.woodDark, P.ink, 0.5);

/**
 * One frame's scratches and dust: a long scratch down the picture (now and then two),
 * cream or dark, and a few specks of dust, each a little cluster.
 */
export function drawFilmDamage(s: Surface, frame: number, seed = 0): void {
  const { w, h } = s;
  if (w < 4 || h < 4) return;
  const f = Math.floor(frame);
  const scratches = hash2(f, 1, seed) > 0.6 ? 2 : 1;
  for (let n = 0; n < scratches; n++) {
    const x = Math.floor(hash2(f, 10 + n, seed) * w);
    const top = Math.floor(hash2(f, 20 + n, seed) * h * 0.5);
    const len = Math.floor(h * (0.35 + hash2(f, 30 + n, seed) * 0.65));
    const c = hash2(f, 40 + n, seed) > 0.4 ? SCRATCH_LIGHT : SCRATCH_DARK;
    // a scratch wanders a pixel now and then
    let xx = x;
    for (let y = top; y < Math.min(h, top + len); y++) {
      if ((y & 15) === 0 && hash2(y, f + n, seed) > 0.6) {
        xx += hash2(y, f + n + 3, seed) > 0.5 ? 1 : -1;
      }
      if (xx >= 0 && xx < w) s.data[y * w + xx] = c;
    }
  }
  const specks = 3 + Math.floor(hash2(f, 2, seed) * 4);
  for (let n = 0; n < specks; n++) {
    const x = Math.floor(hash2(f, 50 + n, seed) * (w - 3));
    const y = Math.floor(hash2(f, 60 + n, seed) * (h - 3));
    const c = hash2(f, 70 + n, seed) > 0.5 ? SCRATCH_LIGHT : SCRATCH_DARK;
    const shape = Math.floor(hash2(f, 80 + n, seed) * 3);
    if (shape === 0) s.rect(x, y, 2, 2, c);
    else if (shape === 1) s.rect(x, y, 3, 1, c);
    else {
      // a hair: a little hook
      s.rect(x, y, 2, 1, c);
      s.px(x + 2, y + 1, c);
      s.px(x + 2, y + 2, c);
    }
  }
}
