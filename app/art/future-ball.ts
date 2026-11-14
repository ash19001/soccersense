/**
 * The ball of the future: a sleek football with light in its seams, as big as the menu ball,
 * for NEXT-GEN's kick-off on the home screen, where the menu ball turns into it (2026-11-14:
 * "for next gen can we do it turns into a futuristic ball").
 *
 *   drawFutureBall(s, ball, light);          // the ball, its seams lit
 *   drawFutureBall(s, ball, light, power);   // 0 dark, 1 dim, 2 lit, 3 a flash as it powers on
 *   pixelate(s, cx, cy, r, block, frame);    // the disc in big square pixels, as it changes
 *
 * Geometry. Eight panels, bonded, no stitches: the octants of the ball, their edges three
 * great circles (one round each axis) that each wave twice either side of the true circle, so
 * every panel is a curved triangle with a propeller's sweep and two of the circles cross at
 * each of the six points on the axes. A light (a stud) sits on each crossing. The panels are
 * gunmetal and black chrome in turn, as a chessboard's squares, so the spin can be seen.
 *
 * Pose. The menu ball's: axes the screen's (x right, y down, z towards the viewer),
 * positive `yaw` turns the front to the right, `pitch` up and away, `roll` clockwise, in that
 * order. The disc is the engine's circle, as the menu ball's: the two outlines match pixel for
 * pixel.
 *
 * Look. Gunmetal and black chrome, each in five bands lit from the top left, a hard glint (it is
 * polished), a 1 px ink outline; under floodlights a lit rim, as the menu ball's. The seams are
 * lights of their own (NEXT-GEN's electric magenta, raw, not graded by the sky): with `power` 2
 * a pale pink core with magenta round it and a little of its light on the panels beside it, and a stripe of it inset along the edges of the
 * black panels; 3,
 * the flash as it powers on, a white core; 1, a dim violet core and nothing round it; 0 dark
 * grooves. Lit, there is a magenta rim on the shaded side, the light of its own seams. The
 * studs from r = 24.
 *
 * Pixelate. The ball's change is digital: its disc is redrawn in squares `block` pixels
 * across, each the colour at its middle (palette colours only, no averaging), with a few of
 * them lit in the mode's colours by `frame`. The squares sit on a grid centred on the ball,
 * and only those whose middle is within a square of the disc change, so the outline steps too.
 *
 * Pure: the same inputs give the same pixels. Nothing allocates once warm.
 */

import { Surface, TRANSPARENT, clamp, hash2, mix, type Color } from "~/pixel";
import type { Lighting } from "./lighting";
import { P } from "./palette";

export interface FutureBallState {
  cx: number;
  cy: number;
  r: number;
  yaw: number;
  pitch: number;
  roll?: number;
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
/** The glint, where the menu ball's is: bigger and harder than the leather's, polished. */
const [HX, HY, HZ] = unit(-0.5, -0.59, 0.64);
const GLINT_HALO = 0.984;
const GLINT_CORE = 0.994;
/** Light on a panel by band: highlight, light, base, shade, deep. */
const STEPS = [0.68, 0.34, -0.02, -0.42] as const;
/** The rim (floodlit, or its own magenta) is where the key light is weaker than this. */
const RIM_SIDE = -0.05;

interface Tones {
  ink: Color;
  /** By material (0 gunmetal, 1 black chrome), lightest band first. */
  shell: readonly (readonly Color[])[];
  /** The same, with a little of the seams' light on it (lit, and in the flash). */
  spill: readonly (readonly Color[])[];
  flash: readonly (readonly Color[])[];
  /** An unlit seam: a groove. */
  groove: Color;
  glintHalo: Color;
  glintCore: Color;
  rim: Color;
  /** How far the floodlights are up: 0 off, 1 full. */
  flood: number;
}

const toneCache = new WeakMap<Lighting, Tones>();

function tonesFor(light: Lighting): Tones {
  const hit = toneCache.get(light);
  if (hit) return hit;
  const c = light.lit;
  // gunmetal: steel greys into slate; black chrome: slate into night and ink with a little
  // of the mode's violet in it
  const gunmetal = [
    mix(P.steelHi, P.mist, 0.45),
    mix(P.mist, P.steel, 0.4),
    P.steel,
    mix(P.steel, P.slate, 0.6),
    mix(P.slate, P.night, 0.35),
  ];
  const chrome = [
    mix(P.slate, P.steel, 0.25),
    mix(P.slate, P.nextgenDark, 0.2),
    mix(P.night, P.nextgenDark, 0.14),
    mix(P.night, P.ink, 0.45),
    mix(P.ink, P.nextgenDark, 0.06),
  ];
  const shell = [gunmetal.map(c), chrome.map(c)];
  const tones: Tones = {
    ink: c(P.ink),
    shell,
    spill: shell.map((band) => band.map((t) => mix(t, P.nextgen, 0.32))),
    flash: shell.map((band) => band.map((t) => mix(t, P.nextgenLight, 0.45))),
    groove: c(mix(P.night, P.ink, 0.5)),
    glintHalo: c(P.steelHi),
    glintCore: c(P.white),
    rim: c(mix(P.steelHi, P.mist, 0.4)),
    // the floodlights fade up from 4 degrees to -4, as the menu ball's rim (lighting.ts)
    flood: light.lightsOn ? clamp((4 - light.sun.elevation) / 8, 0, 1) : 0,
  };
  toneCache.set(light, tones);
  return tones;
}

/** The seams' own light (raw: a light is not graded by the sky), by `power`. */
const SEAM_CORE: readonly Color[] = [
  TRANSPARENT,
  mix(P.nextgenDark, P.nextgen, 0.25),
  P.nextgenLight,
  P.white,
];
const SEAM_GLOW: readonly Color[] = [
  TRANSPARENT,
  mix(P.nextgenDark, P.night, 0.3),
  P.nextgen,
  P.nextgenLight,
];
/** The studs on the crossings: their ring and their heart, by `power`. */
const STUD_RING: readonly Color[] = [
  mix(P.night, P.ink, 0.4),
  P.nextgenDark,
  P.nextgen,
  P.nextgenLight,
];
const STUD_HEART: readonly Color[] = [
  mix(P.slate, P.night, 0.5),
  P.nextgen,
  P.white,
  P.white,
];
/** The stripe inset along the edges of the black chrome panels, by `power`. */
const STRIPE: readonly Color[] = [
  TRANSPARENT,
  mix(P.nextgenDark, P.night, 0.5),
  mix(P.nextgenDark, P.nextgen, 0.3),
  P.nextgen,
];
/** How far in the stripe is (a share of the radius, 4 px at least), from STRIPE_R up. */
const STRIPE_IN = 0.08;
const STRIPE_R = 40;
/** The magenta rim on the shaded side when lit. */
const NEON_RIM: readonly Color[] = [
  TRANSPARENT,
  TRANSPARENT,
  mix(P.nextgen, P.nextgenDark, 0.35),
  P.nextgen,
];

// ---------------------------------------------------------------------------
// Pose and panels
// ---------------------------------------------------------------------------

let cyw = 1;
let syw = 0;
let cpt = 1;
let spt = 0;
let crl = 1;
let srl = 0;

function orient(ball: FutureBallState): void {
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
 * How far each great circle's two waves carry it from the true circle (as a share of the
 * radius, at their tops).
 */
const WAVE = 0.3;

/**
 * Which side of the circle round axis `a` (its height over the circle's plane) a point is
 * on, where (b, c) is the point in that plane: the circle runs at height WAVE sin 2 phi, phi
 * the angle of (b, c). (sin 2 phi = 2 b c / (b^2 + c^2).)
 */
function side(a: number, b: number, c: number): number {
  const q = b * b + c * c;
  return a - (q > 1e-9 ? (2 * WAVE * b * c) / q : 0);
}

/**
 * The panel of a point of the ball's frame: three bits, one for its side of each circle
 * (round x, through y and z; round y, through z and x; round z, through x and y), so the
 * panels about a point on an axis turn the same way.
 */
function panelOf(x: number, y: number, z: number): number {
  return (
    (side(x, y, z) > 0 ? 1 : 0) |
    (side(y, z, x) > 0 ? 2 : 0) |
    (side(z, x, y) > 0 ? 4 : 0)
  );
}

/** Gunmetal (0) or black chrome (1): neighbouring panels differ by one bit, and so in this. */
function materialOf(id: number): number {
  return (id & 1) ^ ((id >> 1) & 1) ^ ((id >> 2) & 1);
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
function measure(ball: FutureBallState): boolean {
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

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

/**
 * Draw the ball of the future, its seams at `power` (0 dark, 1 dim, 2 lit, 3 the flash as
 * it powers on; whole steps).
 */
export function drawFutureBall(
  s: Surface,
  ball: FutureBallState,
  light: Lighting,
  power = 2,
): void {
  if (!measure(ball)) return;
  const pw = Number.isFinite(power)
    ? Math.max(0, Math.min(3, Math.round(power)))
    : 2;
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
  const r = ball.r;
  // Detail comes in with size: seams from r = 8, two pixels wide from 20, with their glow
  // round them from 40.
  const seams = r >= 8;
  const wide = r >= 20;
  const glow = r >= 40 && pw >= 2;
  const core = pw > 0 ? SEAM_CORE[pw] : tones.groove;
  const halo = pw > 0 ? SEAM_GLOW[pw] : tones.groove;
  const lit = pw >= 3 ? tones.flash : pw >= 2 ? tones.spill : null;
  const stripe =
    r >= STRIPE_R && pw >= 1 ? Math.max(4, Math.round(r * STRIPE_IN)) : 0;
  const stripeTone = STRIPE[pw];
  // The rim: the seams' own magenta when lit, else the floodlights' (the menu ball's).
  const neon = NEON_RIM[pw];
  const flood = tones.flood;
  const rimW =
    neon !== TRANSPARENT
      ? r >= 80
        ? 3
        : r >= 30
          ? 2
          : 1
      : flood <= 0.25
        ? 0
        : (flood < 0.6 ? 2 : 4) + (r >= 80 ? 2 : 0) - (r < 40 ? 2 : 0);
  const rimTone = neon !== TRANSPARENT ? neon : tones.rim;
  const rimIn = rimW > 0 ? (rad - 1 - rimW) * inv : 2;
  const rimIn2 = rimIn * rimIn;

  for (let j = jMin; j < jMax; j++) {
    const dy = j - half;
    const ny = dy * inv;
    const row = (j + 1) * stride + 1;
    const out = (y0 + j) * sw + x0;
    for (let i = iMin; i < iMax; i++) {
      const k = row + i;
      const f = idBuf[k];
      if (f === OUTSIDE) continue;
      if (f === OUTLINE) {
        data[out + i] = tones.ink;
        continue;
      }
      const dx = i - half;
      const nx = dx * inv;
      const q = nx * nx + ny * ny;
      const nz = Math.sqrt(Math.max(0, 1 - q));
      const l = nx * LX + ny * LY + nz * LZ;
      const dist = distBuf[k];
      if (seams && dist === 1) {
        // the seam: both sides of the edge when wide, else only the lower panel's side;
        // when wide, the higher panel's side is the core and the lower's its glow
        const lower =
          idBuf[k - 1] > f ||
          idBuf[k + 1] > f ||
          idBuf[k - stride] > f ||
          idBuf[k + stride] > f;
        if (wide || lower) {
          data[out + i] = wide && lower && pw >= 2 ? halo : core;
          continue;
        }
      }
      if (glow && dist === 2) {
        data[out + i] = halo;
        continue;
      }
      if (dist === stripe && materialOf(f) === 1) {
        data[out + i] = stripeTone;
        continue;
      }
      if (
        rimW > 0 &&
        q > rimIn2 &&
        l < RIM_SIDE &&
        (1 - Math.sqrt(q)) * rad - 1 <
          rimW * Math.min(1, 0.34 + (RIM_SIDE - l) * 2.2)
      ) {
        data[out + i] = rimTone;
        continue;
      }
      const band =
        l >= STEPS[0]
          ? 0
          : l >= STEPS[1]
            ? 1
            : l >= STEPS[2]
              ? 2
              : l >= STEPS[3]
                ? 3
                : 4;
      const m = materialOf(f);
      let c =
        lit !== null && glow && dist === 3
          ? lit[m][band]
          : tones.shell[m][band];
      const spec = nx * HX + ny * HY + nz * HZ;
      if (spec >= GLINT_CORE) c = tones.glintCore;
      else if (spec >= GLINT_HALO) c = tones.glintHalo;
      data[out + i] = c;
    }
  }
  if (r >= STUD_R) drawStuds(s, pw);
}

// ---------------------------------------------------------------------------
// The studs
// ---------------------------------------------------------------------------

/** The studs on the six crossings, from this radius up. */
const STUD_R = 24;
/** A stud this far round (its facing) or less is not drawn: it would be a smear. */
const STUD_FACING = 0.25;

/** The six points on the axes, where the seams cross. */
const AXES: readonly (readonly [number, number, number])[] = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

function drawStuds(s: Surface, pw: number): void {
  const rad = disc.rad;
  // a diamond: its ring `size` from the middle, its heart one less
  const size = rad >= 80 ? 4 : rad >= 44 ? 3 : 2;
  for (const [x, y, z] of AXES) {
    toView(x, y, z);
    if (oz <= STUD_FACING) continue;
    const px = Math.round(disc.tx + ox * rad);
    const py = Math.round(disc.ty + oy * rad);
    // turned away, it is narrower across the way it turns
    const sx = Math.max(1, Math.round(size * Math.sqrt(1 - ox * ox)));
    const sy = Math.max(1, Math.round(size * Math.sqrt(1 - oy * oy)));
    diamond(s, px, py, sx, sy, STUD_RING[pw]);
    diamond(s, px, py, sx - 1, sy - 1, STUD_HEART[pw]);
  }
}

/** A filled diamond `ax` across each way and `ay` up and down, on the ball only. */
function diamond(
  s: Surface,
  x: number,
  y: number,
  ax: number,
  ay: number,
  c: Color,
): void {
  if (ax < 0 || ay < 0) return;
  const d = disc.d;
  for (let j = -ay; j <= ay; j++) {
    const w = ay === 0 ? ax : Math.round(ax * (1 - Math.abs(j) / (ay + 1)));
    for (let i = -w; i <= w; i++) {
      const px = x + i;
      const py = y + j;
      const bi = px - disc.x0;
      const bj = py - disc.y0;
      if (bi < 0 || bj < 0 || bi >= d || bj >= d) continue;
      if (px < s.clipX0 || py < s.clipY0 || px >= s.clipX1 || py >= s.clipY1) {
        continue;
      }
      if (idBuf[(bj + 1) * (d + 2) + 1 + bi] < 0) continue;
      s.data[py * s.w + px] = c;
    }
  }
}

// ---------------------------------------------------------------------------
// Pixelate
// ---------------------------------------------------------------------------

/**
 * A square lit in the mode's colours: about this share of the ball's squares a frame, when
 * they are SPARK_FULL pixels across or more (fewer when smaller: they would be confetti).
 */
const SPARK = 0.07;
const SPARK_FULL = 8;
const SPARK_TONES: readonly Color[] = [P.nextgen, P.nextgenLight, P.white];

/**
 * The disc of radius `r` on (cx, cy) in squares `block` pixels across: each square takes the
 * colour of the pixel at its middle, and a few (SPARK, somewhere else each `frame`) light up
 * in the mode's colours. Squares whose middle is more than half a square outside the disc
 * are left as they are. A `block` under 2 changes nothing.
 */
export function pixelate(
  s: Surface,
  cx: number,
  cy: number,
  r: number,
  block: number,
  frame = 0,
  seed = 0,
): void {
  const b = Math.floor(block);
  if (!(b >= 2) || !(r >= 1) || !Number.isFinite(cx + cy + r)) return;
  const x = Math.round(cx);
  const y = Math.round(cy);
  // a square centred on the ball's middle, so the steps are the same all round
  const off = (b - 1) >> 1;
  const n = Math.ceil((r + b) / b);
  const reach = r + b / 2;
  const reach2 = reach * reach;
  const data = s.data;
  const sw = s.w;
  const f = Math.floor(frame);
  const spark = SPARK * Math.min(1, b / SPARK_FULL);
  for (let gj = -n; gj <= n; gj++) {
    const top = y + gj * b - off;
    const my = top + off;
    for (let gi = -n; gi <= n; gi++) {
      const left = x + gi * b - off;
      const mx = left + off;
      const ddx = mx - x;
      const ddy = my - y;
      if (ddx * ddx + ddy * ddy > reach2) continue;
      if (mx < s.clipX0 || my < s.clipY0 || mx >= s.clipX1 || my >= s.clipY1) {
        continue;
      }
      let c = data[my * sw + mx] as Color;
      const h = hash2(gi * 131 + gj, f, seed);
      if (h < spark && ddx * ddx + ddy * ddy <= r * r) {
        c = SPARK_TONES[Math.floor((h / spark) * SPARK_TONES.length)];
      }
      const x0 = Math.max(left, s.clipX0);
      const x1 = Math.min(left + b, s.clipX1);
      const y0 = Math.max(top, s.clipY0);
      const y1 = Math.min(top + b, s.clipY1);
      for (let yy = y0; yy < y1; yy++) data.fill(c, yy * sw + x0, yy * sw + x1);
    }
  }
}
