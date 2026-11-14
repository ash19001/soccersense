/**
 * The old ball: a brown leather football of the early days, as big as the menu ball, for
 * RETRO's kick-off on the home screen, where the menu ball turns into it (2026-11-13).
 *
 *   drawLeatherBall(s, ball, light);          // the whole ball
 *   drawLeatherBall(s, ball, light, cover);   // `cover` (0 to 1) of its pixels: a dissolve
 *
 * Geometry. Eighteen panels, six groups of three strips on the faces of a cube, the strips
 * on neighbouring faces crossing: the ball of RETRO's career scene (`drawOldBall`), drawn at
 * the menu ball's size and finish. A point belongs to the cube face of its largest
 * coordinate, and to the strip of its coordinate across the face's strips. The lace is a
 * slot down the middle strip of the face in front (+z at rest), laced with a pale thong in
 * a criss-cross.
 *
 * Pose. The menu ball's: axes the screen's (x right, y down, z towards the viewer),
 * positive `yaw` turns the front to the right, `pitch` up and away, `roll` clockwise, in
 * that order. The disc is the engine's circle, as the menu ball's: the two outlines match
 * pixel for pixel, so the one can turn into the other: in a dissolve, `cover` of the old
 * ball's pixels drawn over the menu ball in an ordered (Bayer 4 x 4) pattern fixed to the
 * screen, sixteen steps from none to all, while both spin fast (2026-11-13: "spinning really
 * fast then by the time it stops spinning it's the old leather ball").
 *
 * Look. Brown leather in five bands lit from the top left (the old gold ramp run into the
 * wood browns, as the career ball), each strip padded: a lit lip on the side of a seam that
 * faces the light and a shaded one on the other; seams as dark grooves; a warm glint; a 1 px
 * ink outline; under floodlights a lit rim, as the menu ball's. Every tone goes through
 * `light.lit`. The lace's thong from r = 40, its slot alone from 24.
 *
 * Pure: the same inputs give the same pixels. Nothing allocates once warm.
 */

import { Surface, clamp, mix, type Color } from "~/pixel";
import type { Lighting } from "./lighting";
import { P } from "./palette";

export interface LeatherBallState {
  cx: number;
  cy: number;
  r: number;
  yaw: number;
  pitch: number;
  roll?: number;
}

/** The dissolve's pattern: a pixel shows from a cover of (its value + 1) / 16. */
const BAYER: readonly number[] = [
  0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5,
];

/** This draw's cover, in sixteenths: a pixel shows if its Bayer value is under it. */
let coverStep = 16;

function covered(x: number, y: number): boolean {
  return coverStep >= 16 || BAYER[((y & 3) << 2) | (x & 3)] < coverStep;
}

// ---------------------------------------------------------------------------
// Light
// ---------------------------------------------------------------------------

function unit(x: number, y: number, z: number): [number, number, number] {
  const n = Math.hypot(x, y, z);
  return [x / n, y / n, z / n];
}

/** Towards the light: up, left and out of the screen (the menu ball's). */
const [LX, LY, LZ] = unit(-0.52, -0.62, 0.58);
/** The glint, where the menu ball's is, smaller: waxed leather, not plastic. */
const [HX, HY, HZ] = unit(-0.5, -0.59, 0.64);
const GLINT_HALO = 0.9935;
const GLINT_CORE = 0.998;
/** Light on the leather by band: highlight, light, base, shade, deep. */
const STEPS = [0.66, 0.3, -0.06, -0.48] as const;
/** The floodlit rim is on the side of the ball where the key light is weaker than this. */
const RIM_SIDE = -0.05;

interface Tones {
  ink: Color;
  /** The leather, lightest first. */
  leather: readonly Color[];
  /** A seam's groove, on the lit half and in the shade. */
  grooveLit: Color;
  grooveDark: Color;
  glintHalo: Color;
  glintCore: Color;
  rim: Color;
  /** The lace's slot and holes, and its thong (lit and shaded). */
  slot: Color;
  thong: Color;
  thongShade: Color;
  /** How far the floodlights are up: 0 off, 1 full. */
  flood: number;
}

const toneCache = new WeakMap<Lighting, Tones>();

function tonesFor(light: Lighting): Tones {
  const hit = toneCache.get(light);
  if (hit) return hit;
  const c = light.lit;
  const tones: Tones = {
    ink: c(P.ink),
    // brown leather: tan where the light is, chestnut, and a deep brown leaning cool
    leather: [
      c(mix(P.retro, P.wood, 0.35)),
      c(mix(P.retro, P.wood, 0.68)),
      c(P.wood),
      c(mix(P.wood, P.woodDark, 0.6)),
      c(mix(P.woodDark, P.ink, 0.3)),
    ],
    grooveLit: c(mix(P.woodDark, P.ink, 0.3)),
    grooveDark: c(mix(P.woodDark, P.ink, 0.6)),
    glintHalo: c(mix(P.retroLight, P.retro, 0.35)),
    glintCore: c(P.retroLight),
    rim: c(mix(P.retro, P.retroLight, 0.4)),
    slot: c(mix(P.woodDark, P.ink, 0.5)),
    thong: c(mix(P.retroLight, P.chalk, 0.3)),
    thongShade: c(mix(P.retro, P.retroLight, 0.25)),
    // the floodlights fade up from 4 degrees to -4, as the menu ball's rim (lighting.ts)
    flood: light.lightsOn ? clamp((4 - light.sun.elevation) / 8, 0, 1) : 0,
  };
  toneCache.set(light, tones);
  return tones;
}

// ---------------------------------------------------------------------------
// Pose and panels
// ---------------------------------------------------------------------------

let cyw = 1;
let syw = 0;
let cpt = 1;
let spt = 0;
let crl = 1;
let srl = 0;

function orient(ball: LeatherBallState): void {
  const yaw = Number.isFinite(ball.yaw) ? ball.yaw : 0;
  const pitch = Number.isFinite(ball.pitch) ? ball.pitch : 0;
  const roll =
    ball.roll !== undefined && Number.isFinite(ball.roll) ? ball.roll : 0;
  cyw = Math.cos(yaw);
  syw = Math.sin(yaw);
  cpt = Math.cos(pitch);
  spt = Math.sin(pitch);
  crl = Math.cos(roll);
  srl = Math.sin(roll);
}

/** The last point turned (`toBall`, `toView`). */
let ox = 0;
let oy = 0;
let oz = 0;

/** A view-space point back into the ball's own frame: roll, pitch and yaw undone. */
function toBall(x: number, y: number, z: number): void {
  const x1 = x * crl + y * srl;
  const y2 = -x * srl + y * crl;
  const by = y2 * cpt + z * spt;
  const z1 = -y2 * spt + z * cpt;
  ox = x1 * cyw - z1 * syw;
  oy = by;
  oz = x1 * syw + z1 * cyw;
}

/** A point of the ball's own frame into view space: yaw, pitch, roll (as `ball.ts`). */
function toView(x: number, y: number, z: number): void {
  const x1 = x * cyw + z * syw;
  const z1 = -x * syw + z * cyw;
  const y2 = y * cpt - z1 * spt;
  oz = y * spt + z1 * cpt;
  ox = x1 * crl - y2 * srl;
  oy = x1 * srl + y2 * crl;
}

/**
 * The panel of a point of the ball's frame: its cube face (0 to 5: +x, -x, +y, -y, +z, -z)
 * times three, plus its strip (0 to 2). The strips of the x faces run along z, those of
 * the y faces along x and those of the z faces along y, so neighbouring faces cross.
 */
function panelOf(x: number, y: number, z: number): number {
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  const az = Math.abs(z);
  let face: number;
  let q: number;
  if (ax >= ay && ax >= az) {
    face = x > 0 ? 0 : 1;
    q = y / ax;
  } else if (ay >= az) {
    face = y > 0 ? 2 : 3;
    q = z / ay;
  } else {
    face = z > 0 ? 4 : 5;
    q = x / az;
  }
  return face * 3 + (q < -1 / 3 ? 0 : q > 1 / 3 ? 2 : 1);
}

// ---------------------------------------------------------------------------
// Scratch (the ball is redrawn every frame: nothing here allocates once warm)
// ---------------------------------------------------------------------------

const OUTSIDE = -1;
const OUTLINE = -2;
/** Panel of every pixel in the ball's box, with a 1 px border. */
let idBuf = new Int8Array(0);
/** City-block distance to the nearest pixel of another panel (1 = on the seam), capped. */
let distBuf = new Uint8Array(0);

const disc = { x0: 0, y0: 0, d: 0, tx: 0, ty: 0, rad: 0 };

/** The engine's circle convention, as the menu ball's: a radius r is round(2r) + 1 across. */
function measure(ball: LeatherBallState): boolean {
  const r = ball.r;
  if (!(r >= 1) || !Number.isFinite(ball.cx + ball.cy + r) || r > 512) {
    return false;
  }
  const d = Math.round(2 * r) + 1;
  disc.d = d;
  disc.x0 = Math.round(ball.cx - r);
  disc.y0 = Math.round(ball.cy - r);
  disc.tx = disc.x0 + (d - 1) / 2;
  disc.ty = disc.y0 + (d - 1) / 2;
  disc.rad = d / 2;
  return true;
}

/** Fill `idBuf` and `distBuf` for the current disc and pose. */
function rasterise(): void {
  const d = disc.d;
  const stride = d + 2;
  const size = stride * stride;
  if (idBuf.length < size) {
    idBuf = new Int8Array(size);
    distBuf = new Uint8Array(size);
  }
  idBuf.fill(OUTSIDE, 0, size);
  const rad = disc.rad;
  const rad2 = rad * rad;
  const inv = 1 / rad;
  const half = (d - 1) / 2;
  for (let j = 0; j < d; j++) {
    const dy = j - half;
    const row = (j + 1) * stride + 1;
    for (let i = 0; i < d; i++) {
      const dx = i - half;
      if (dx * dx + dy * dy > rad2) continue;
      const nx = dx * inv;
      const ny = dy * inv;
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      toBall(nx, ny, nz);
      idBuf[row + i] = panelOf(ox, oy, oz);
    }
  }
  // the outline: the disc's pixels that touch the outside (marked after, so the test reads
  // the panels)
  for (let j = 0; j < d; j++) {
    const row = (j + 1) * stride + 1;
    for (let i = 0; i < d; i++) {
      const k = row + i;
      distBuf[k] =
        idBuf[k] !== OUTSIDE &&
        (idBuf[k - 1] === OUTSIDE ||
          idBuf[k + 1] === OUTSIDE ||
          idBuf[k - stride] === OUTSIDE ||
          idBuf[k + stride] === OUTSIDE)
          ? 1
          : 0;
    }
  }
  for (let j = 0; j < d; j++) {
    const row = (j + 1) * stride + 1;
    for (let i = 0; i < d; i++) {
      if (distBuf[row + i] === 1) idBuf[row + i] = OUTLINE;
    }
  }
  // distance to another panel, city-block, capped: two chamfer sweeps
  for (let j = 0; j < d; j++) {
    const row = (j + 1) * stride + 1;
    for (let i = 0; i < d; i++) {
      const k = row + i;
      const f = idBuf[k];
      if (f < 0) {
        distBuf[k] = 0;
        continue;
      }
      const a = idBuf[k - 1];
      const b = idBuf[k + 1];
      const c = idBuf[k - stride];
      const e = idBuf[k + stride];
      if (
        (a >= 0 && a !== f) ||
        (b >= 0 && b !== f) ||
        (c >= 0 && c !== f) ||
        (e >= 0 && e !== f)
      ) {
        distBuf[k] = 1;
        continue;
      }
      const m = Math.min(distBuf[k - 1], distBuf[k - stride]);
      distBuf[k] = m === 0 || m >= 30 ? 31 : m + 1;
    }
  }
  for (let j = d - 1; j >= 0; j--) {
    const row = (j + 1) * stride + 1;
    for (let i = d - 1; i >= 0; i--) {
      const k = row + i;
      if (idBuf[k] < 0) continue;
      const a = distBuf[k + 1];
      const b = distBuf[k + stride];
      const m = Math.min(a === 0 ? 31 : a, b === 0 ? 31 : b) + 1;
      if (m < distBuf[k]) distBuf[k] = m;
    }
  }
}

/** Whether a panel pixel's neighbour `k2` is of another panel. */
function other(k: number, k2: number): boolean {
  const g = idBuf[k2];
  return g >= 0 && g !== idBuf[k];
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

/**
 * Draw the old ball. With a `cover` under 1, only that share of its pixels is drawn, in
 * the dissolve's pattern (`covered`), and the rest is left as it was: the menu ball.
 */
export function drawLeatherBall(
  s: Surface,
  ball: LeatherBallState,
  light: Lighting,
  cover = 1,
): void {
  coverStep = Math.round(clamp(Number.isFinite(cover) ? cover : 1) * 16);
  if (coverStep <= 0 || !measure(ball)) return;
  const d = disc.d;
  const x0 = disc.x0;
  const y0 = disc.y0;
  if (
    x0 >= s.clipX1 ||
    y0 >= s.clipY1 ||
    x0 + d <= s.clipX0 ||
    y0 + d <= s.clipY0
  ) {
    return;
  }
  orient(ball);
  rasterise();
  const tones = tonesFor(light);
  const stride = d + 2;
  const rad = disc.rad;
  const inv = 1 / rad;
  const half = (d - 1) / 2;
  const data = s.data;
  const sw = s.w;
  const iMin = Math.max(0, s.clipX0 - x0);
  const iMax = Math.min(d, s.clipX1 - x0);
  const jMin = Math.max(0, s.clipY0 - y0);
  const jMax = Math.min(d, s.clipY1 - y0);
  const leather = tones.leather;
  // Detail comes in with size: seams from r = 10, padding and scuffs from 24.
  const r = ball.r;
  const seams = r >= 10;
  const padded = r >= 24;
  // The floodlit rim (the menu ball's): a crescent just inside the outline.
  const flood = tones.flood;
  const rimW =
    flood <= 0.25
      ? 0
      : (flood < 0.6 ? 2 : 4) + (r >= 80 ? 2 : 0) - (r < 40 ? 2 : 0);
  const rimIn = rimW > 0 ? (rad - 1 - rimW) * inv : 2;
  const rimIn2 = rimIn * rimIn;

  for (let j = jMin; j < jMax; j++) {
    const dy = j - half;
    const ny = dy * inv;
    const row = (j + 1) * stride + 1;
    const py = y0 + j;
    const out = py * sw + x0;
    for (let i = iMin; i < iMax; i++) {
      const k = row + i;
      const f = idBuf[k];
      if (f === OUTSIDE) continue;
      const px = x0 + i;
      if (!covered(px, py)) continue;
      if (f === OUTLINE) {
        data[out + i] = tones.ink;
        continue;
      }
      const dx = i - half;
      const nx = dx * inv;
      const q = nx * nx + ny * ny;
      const nz = Math.sqrt(Math.max(0, 1 - q));
      const l = nx * LX + ny * LY + nz * LZ;
      if (
        rimW > 0 &&
        q > rimIn2 &&
        l < RIM_SIDE &&
        (1 - Math.sqrt(q)) * rad - 1 <
          rimW * Math.min(1, 0.34 + (RIM_SIDE - l) * 2.2)
      ) {
        data[out + i] = tones.rim;
        continue;
      }
      let band =
        l >= STEPS[0]
          ? 0
          : l >= STEPS[1]
            ? 1
            : l >= STEPS[2]
              ? 2
              : l >= STEPS[3]
                ? 3
                : 4;
      const dist = distBuf[k];
      if (seams && dist === 1) {
        // a seam is drawn on one side only, in the panel with the lower number, so it is a
        // single pixel wide whichever way it runs
        if (
          idBuf[k - 1] > f ||
          idBuf[k + 1] > f ||
          idBuf[k - stride] > f ||
          idBuf[k + stride] > f
        ) {
          data[out + i] = band <= 1 ? tones.grooveLit : tones.grooveDark;
          continue;
        }
      }
      if (padded && dist <= 3) {
        // The padding: where the seam is up or to the left, the strip's edge faces the
        // light and its lip is lit; where it is down or to the right, it turns away.
        const lit =
          dist <= 2 &&
          (other(k, k - 1) ||
            other(k, k - stride) ||
            (dist === 2 && (other(k, k - 2) || other(k, k - 2 * stride))));
        const away =
          other(k, k + 1) ||
          other(k, k + stride) ||
          other(k, k + 2) ||
          other(k, k + 2 * stride) ||
          (dist === 3 && (other(k, k + 3) || other(k, k + 3 * stride)));
        if (lit && !away && band > 0) band -= 1;
        else if (away && !lit && band < 4) band += 1;
      }
      let c = leather[band];
      const spec = nx * HX + ny * HY + nz * HZ;
      if (spec >= GLINT_CORE) c = tones.glintCore;
      else if (spec >= GLINT_HALO) c = tones.glintHalo;
      data[out + i] = c;
    }
  }
  if (r >= LACE_SLOT_R) drawLace(s, tones, r >= LACE_R);
}

// ---------------------------------------------------------------------------
// The lace
// ---------------------------------------------------------------------------

/** The lace: its slot from this radius up, and its thong and holes from LACE_R. */
const LACE_SLOT_R = 24;
const LACE_R = 40;
/** The lace: down the middle strip of the +z face, from `LACE_END` above to below. */
const LACE_END = 0.4;
/** Its holes: this many pairs, each `LACE_HOLE` either side of the slot (face units). */
const LACE_PAIRS = 7;
const LACE_HOLE = 0.1;

/** A point of the lace (face units: `a` along the strip, `q` across) in screen pixels. */
let lx = 0;
let ly = 0;
let lz = 0;

function lacePoint(a: number, q: number): void {
  const n = Math.hypot(q, a, 1);
  toView(q / n, a / n, 1 / n);
  lx = disc.tx + ox * disc.rad;
  ly = disc.ty + oy * disc.rad;
  lz = oz;
}

/** Plot (x, y) if it is on the ball, inside its outline, and in the cover. */
function lacePixel(s: Surface, x: number, y: number, c: Color): void {
  const i = x - disc.x0;
  const j = y - disc.y0;
  const d = disc.d;
  if (i < 0 || j < 0 || i >= d || j >= d) return;
  if (x < s.clipX0 || y < s.clipY0 || x >= s.clipX1 || y >= s.clipY1) return;
  if (idBuf[(j + 1) * (d + 2) + 1 + i] < 0) return;
  if (!covered(x, y)) return;
  s.data[y * s.w + x] = c;
}

/** A line of `w` pixels' thickness (1 or 2) from (x0, y0) to (x1, y1), on the ball only. */
function laceLine(
  s: Surface,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  w: number,
  c: Color,
): void {
  const steep = Math.abs(y1 - y0) > Math.abs(x1 - x0);
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let t = 0; t <= n; t++) {
    const x = Math.round(n === 0 ? x0 : x0 + ((x1 - x0) * t) / n);
    const y = Math.round(n === 0 ? y0 : y0 + ((y1 - y0) * t) / n);
    lacePixel(s, x, y, c);
    if (w > 1) lacePixel(s, x + (steep ? 1 : 0), y + (steep ? 0 : 1), c);
  }
}

/** The facing below which the lace is too far round to draw (it would be a smear). */
const LACE_FACING = 0.2;

function drawLace(s: Surface, tones: Tones, laced: boolean): void {
  const r = disc.rad;
  const w = r >= 50 ? 2 : 1;
  // the slot, in a few pieces so it follows the ball round
  const pieces = 8;
  lacePoint(-LACE_END, 0);
  let px = Math.round(lx);
  let py = Math.round(ly);
  let pz = lz;
  for (let n = 1; n <= pieces; n++) {
    lacePoint(-LACE_END + (2 * LACE_END * n) / pieces, 0);
    const x = Math.round(lx);
    const y = Math.round(ly);
    if (pz > LACE_FACING && lz > LACE_FACING) {
      laceLine(s, px, py, x, y, w, tones.slot);
    }
    px = x;
    py = y;
    pz = lz;
  }
  if (!laced) return;
  // the thong, crossing from each pair of holes to the next, its shade under it
  const step = (2 * LACE_END * 0.9) / (LACE_PAIRS - 1);
  const first = -LACE_END * 0.9;
  for (let p = 0; p < LACE_PAIRS - 1; p++) {
    const a0 = first + p * step;
    const a1 = a0 + step;
    for (let side = -1; side <= 1; side += 2) {
      lacePoint(a0, side * LACE_HOLE);
      const x0 = Math.round(lx);
      const y0 = Math.round(ly);
      const z0 = lz;
      lacePoint(a1, -side * LACE_HOLE);
      const x1 = Math.round(lx);
      const y1 = Math.round(ly);
      if (z0 <= LACE_FACING || lz <= LACE_FACING) continue;
      laceLine(s, x0 + 1, y0 + 1, x1 + 1, y1 + 1, 1, tones.thongShade);
      laceLine(s, x0, y0, x1, y1, w, tones.thong);
    }
  }
  // the holes it goes through, dark
  for (let p = 0; p < LACE_PAIRS; p++) {
    const a = first + p * step;
    for (let side = -1; side <= 1; side += 2) {
      lacePoint(a, side * LACE_HOLE);
      if (lz <= LACE_FACING) continue;
      const x = Math.round(lx);
      const y = Math.round(ly);
      lacePixel(s, x, y, tones.slot);
      if (w > 1) {
        lacePixel(s, x + side, y, tones.slot);
      }
    }
  }
}
