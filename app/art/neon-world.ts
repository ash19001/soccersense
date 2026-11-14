/**
 * The picture as a screen of the future: NEXT-GEN's kick-off on the home screen turns the
 * world neon round the ball of the future (2026-11-14), as RETRO's turns it into an old
 * photograph round the old ball.
 *
 *   neonTone(s, level, hole);        // the picture in NEXT-GEN's magentas, `level` of the way
 *   drawScanGlitch(s, frame, seed);  // a frame's scan bar and glitches
 *
 * Neon. Each colour goes to one of eight steps of NEXT-GEN's electric magenta by its
 * brightness (deep violet to pale pink, the shadows leaning to the night's blue), every third
 * row a step darker (scan lines), and `level` of the way there (stepped by the caller: the
 * change is a few whole steps). A `hole` (a disc) is left as it is: the ball keeps its own
 * colours. Colours are worked out once and remembered.
 *
 * Scan. A frame of the screen has a bright scan bar going down it, a row or two of glitches
 * (short runs of light or dark across it) and a few dead pixels, somewhere else each frame
 * (`frame` is a whole step of the screen's rate). Clusters, never single pixels.
 *
 * Pure: the same inputs give the same pixels.
 */

import { Surface, hash2, luma, mix, type Color } from "~/pixel";
import { P } from "./palette";

/** The magentas, darkest first. */
const RAMP: readonly Color[] = [
  mix(P.ink, P.nextgenDark, 0.18),
  mix(P.night, P.nextgenDark, 0.45),
  mix(P.nextgenDark, P.night, 0.2),
  P.nextgenDark,
  mix(P.nextgenDark, P.nextgen, 0.55),
  P.nextgen,
  mix(P.nextgen, P.nextgenLight, 0.55),
  mix(P.nextgenLight, P.white, 0.5),
];

/** Brightness is pressed down a little before it is banded: a dark screen, the hot magenta
 * kept for what is brightest, so the lit ball stands out. */
const LIFT = 1.15;
/** Every SCAN-th row is a step darker. */
const SCAN = 3;

/** Remembered: a colour's magenta, by colour, row and level. */
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
  const neon = RAMP[Math.max(0, band - dark)];
  const out = level >= 1 ? neon : mix(c, neon, level);
  if (cache.size >= CACHE_MAX) cache.clear();
  cache.set(key, out);
  return out;
}

/**
 * Tone the whole picture `level` of the way to neon (nothing at 0), except inside `hole`:
 * the pixels of the engine's circle of radius `r` on (cx, cy), as the menu ball's disc.
 */
export function neonTone(
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
  for (let y = 0; y < h; y++) {
    const row = y * w;
    const dark = y % SCAN === SCAN - 1 ? 1 : 0;
    const hdy = y - hy0 - half;
    let last = -1;
    let lastOut = 0 as Color;
    for (let x = 0; x < w; x++) {
      if (rad2 >= 0) {
        const hdx = x - hx0 - half;
        if (hdx * hdx + hdy * hdy <= rad2) continue;
      }
      const c = data[row + x];
      if (c === last) {
        data[row + x] = lastOut;
        continue;
      }
      last = c;
      lastOut = toned(c as Color, dark, k);
      data[row + x] = lastOut;
    }
  }
}

/** The scan bar's and the glitches' light and dark. */
const SCAN_LIGHT = mix(P.nextgenLight, P.white, 0.6);
const SCAN_DARK = mix(P.ink, P.nextgenDark, 0.3);
/** The scan bar goes down the screen in this many frames. */
const BAR_FRAMES = 8;

/**
 * One frame's scan bar, glitches and dead pixels: the bar a bright row with a dimmer one
 * over it, a little further down each frame; one or two glitches, each a few short runs
 * across a row or two; and a few dead pixels, each a little square.
 */
export function drawScanGlitch(s: Surface, frame: number, seed = 0): void {
  const { w, h } = s;
  if (w < 4 || h < 4) return;
  const f = Math.floor(frame);
  // the bar, broken where a hash says so
  const by = Math.floor(
    ((((f % BAR_FRAMES) + BAR_FRAMES) % BAR_FRAMES) * h) / BAR_FRAMES,
  );
  for (let x = 0; x < w; x += 4) {
    if (hash2(x >> 4, f, seed + 5) < 0.18) continue;
    s.rect(x, by, 3, 1, SCAN_LIGHT);
    if (by > 0) s.rect(x, by - 1, 2, 1, RAMP[6]);
  }
  const glitches = hash2(f, 1, seed) > 0.55 ? 2 : 1;
  for (let n = 0; n < glitches; n++) {
    const y = Math.floor(hash2(f, 10 + n, seed) * (h - 2));
    const tall = hash2(f, 20 + n, seed) > 0.5 ? 2 : 1;
    const c = hash2(f, 30 + n, seed) > 0.45 ? SCAN_LIGHT : SCAN_DARK;
    let x = Math.floor(hash2(f, 40 + n, seed) * w * 0.6);
    const runs = 2 + Math.floor(hash2(f, 50 + n, seed) * 3);
    for (let k = 0; k < runs && x < w; k++) {
      const len = 6 + Math.floor(hash2(f + k, 60 + n, seed) * 30);
      s.rect(x, y, len, tall, c);
      x += len + 3 + Math.floor(hash2(f + k, 70 + n, seed) * 12);
    }
  }
  const dead = 2 + Math.floor(hash2(f, 2, seed) * 3);
  for (let n = 0; n < dead; n++) {
    const x = Math.floor(hash2(f, 80 + n, seed) * (w - 2));
    const y = Math.floor(hash2(f, 90 + n, seed) * (h - 2));
    s.rect(x, y, 2, 2, hash2(f, 100 + n, seed) > 0.5 ? SCAN_LIGHT : P.nextgen);
  }
}
