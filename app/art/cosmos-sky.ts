/**
 * Space's backdrop and its life, for FURTHEST's career out from the Earth (./cosmos.ts). The
 * product owner, 2026-11-19: "even though it may not be realistic, can you add more details
 * to furthest game mode when it goes into outer space. just so it looks cool rather than
 * black with a couple dots and labels."
 *
 * `drawSpaceBackdrop`, behind everything: black; clouds of gas in banded colours, a layer a
 * tenfold of scale fixed to the sky, so that as the camera pulls back they close in on the
 * Earth and thin out while the next tenfold's come in; the far stars, fixed to the picture,
 * some coloured and a few big; and nearer things fixed to the sky, a layer a tenfold, drawn
 * in towards the Earth with the clouds: specks of dust in the solar system, stars out to the
 * size of a galaxy, far galaxies beyond that.
 *
 * `drawSpaceLife`, over the picture each frame: the big stars twinkle, a star shoots now and
 * then, and satellites go round the Earth. Pure functions of the view, the time and a seed.
 */

import { type Color, Surface, bayer4, hash2 } from "~/pixel";

import { drawStars } from "./globe";
import { P } from "./palette";

/** Kilometres in a light year (as ./cosmos.ts's LY). */
const LY = 9.4607e12;
const EARTH_RADIUS = 6371;

// --- the clouds -------------------------------------------------------------------------------

/** A cloud's colours, faintest first: each cloud is in one of these. */
const CLOUDS: readonly (readonly Color[])[] = [
  [P.nightMid, P.duskTop, P.nextgenDark, P.duskMid],
  [P.nightMid, P.nightLow, P.awayDark, P.away],
  [P.nightMid, P.duskTop, P.duskMid, P.dawnMid],
  [P.nightMid, P.nightLow, P.furthestDark, P.furthest],
  [P.nightMid, P.duskTop, P.brickDark, P.brick],
];
/**
 * How much of the sky each of a cloud's colours covers, or more (the faintest about half
 * of it, the brightest only the clouds' hearts): the same every day and at every scale.
 */
const COVER = [0.45, 0.24, 0.08, 0.022] as const;
/** The clouds are worked out every this many pixels and in a line between. */
const GRID = 4;
/** How much the colours' edges are dithered (in thickness). */
const FRINGE = 0.03;

/** The dither added to a cloud's thickness at each place of the 4 x 4 pattern. */
const DITHER = new Float32Array(16);
for (let y = 0; y < 4; y++) {
  for (let x = 0; x < 4; x++)
    DITHER[(y << 2) | x] = (bayer4(x, y) - 0.5) * FRINGE * 2;
}

/** Every colour of the backdrop: what the life over it may draw on. */
const BACKDROP: ReadonlySet<Color> = new Set<Color>([
  P.ink,
  P.steel,
  P.slate,
  ...CLOUDS.flat(),
]);

/** The noise's random values, a square of them made once (and wrapped round). */
const LATTICE = 256;
const lattice = new Float32Array(LATTICE * LATTICE);
for (let j = 0; j < LATTICE; j++) {
  for (let i = 0; i < LATTICE; i++)
    lattice[j * LATTICE + i] = hash2(i, j, 7919);
}

/**
 * Smooth noise, 0 to 1, a cell a unit: between the lattice's values, each seed a different
 * part of it (looked up, not hashed: the clouds take hundreds of thousands of these a frame).
 */
function noise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const ox = Math.imul(seed, 0x9e3779b1) >>> 24;
  const oy = Math.imul(seed + 1, 0x85ebca6b) >>> 24;
  const x0 = (ix + ox) & (LATTICE - 1);
  const x1 = (x0 + 1) & (LATTICE - 1);
  const y0 = ((iy + oy) & (LATTICE - 1)) * LATTICE;
  const y1 = ((iy + oy + 1) & (LATTICE - 1)) * LATTICE;
  const a = lattice[y0 + x0];
  const b = lattice[y0 + x1];
  const c = lattice[y1 + x0];
  const d = lattice[y1 + x1];
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Five octaves of it: billowing. */
function fbm(x: number, y: number, seed: number): number {
  let sum = 0;
  let amp = 0.5;
  let f = 1;
  let norm = 0;
  for (let o = 0; o < 5; o++) {
    sum += amp * noise(x * f, y * f, seed + o * 101);
    norm += amp;
    amp *= 0.5;
    f *= 2.07;
  }
  return sum / norm;
}

interface CloudLayer {
  /** The tenfold: its clouds are about 10^i km across. */
  i: number;
  /** How much of it shows (0 to 1): the two layers' add up to one. */
  cover: number;
  seed: number;
  colours: readonly [readonly Color[], readonly Color[]];
}

/** The two layers of cloud for a picture `across` km wide. */
function cloudLayers(across: number, seed: number): CloudLayer[] {
  // a layer is at its fullest when its clouds are about a third of the picture
  const z = Math.log10(across) - 0.5;
  const i0 = Math.floor(z);
  const out: CloudLayer[] = [];
  for (const i of [i0, i0 + 1]) {
    const cover = 1 - Math.abs(i - z);
    // a layer all but gone shows next to nothing: not worth working out
    if (cover <= 0.12) continue;
    const f = Math.floor(hash2(i, 3, seed + 71) * CLOUDS.length);
    out.push({
      i,
      cover,
      seed: (seed * 31 + i * 977) | 0,
      colours: [CLOUDS[f], CLOUDS[(f + 2) % CLOUDS.length]],
    });
  }
  return out;
}

/** Which colour of a cloud a thickness is, by where each starts (-1: none). */
function bandOf(v: number, bands: readonly number[]): number {
  return v >= bands[3]
    ? 3
    : v >= bands[2]
      ? 2
      : v >= bands[1]
        ? 1
        : v >= bands[0]
          ? 0
          : -1;
}

/**
 * Where each colour starts so that it covers its share (COVER) of the sky: the thickness
 * that share of the grid's points reach, the thickest layer at each.
 */
function bandsFor(
  thick: readonly Float32Array[],
  seen: (k: number) => boolean,
): number[] {
  const all = thick[0]?.length ?? 0;
  // every third point is plenty to tell, of those that can be seen
  const picked: number[] = [];
  for (let k = 0; k < all; k += 3) {
    if (!seen(k)) continue;
    let m = -Infinity;
    for (const t of thick) if (t[k] > m) m = t[k];
    picked.push(m);
  }
  const n = picked.length;
  if (n === 0) return [Infinity, Infinity, Infinity, Infinity];
  const most = Float32Array.from(picked);
  most.sort();
  return COVER.map((c) => most[Math.min(n - 1, Math.floor(n * (1 - c)))]);
}

/**
 * The clouds round the Earth's middle at (`ex`, `ey`), `kpp` km a pixel, in squares of
 * `block` pixels; only inside `within` (a circle on the picture) if it is given.
 */
function drawClouds(
  s: Surface,
  ex: number,
  ey: number,
  kpp: number,
  seed: number,
  block: number,
  within?: { x: number; y: number; r: number },
): void {
  const w = s.w;
  const h = s.h;
  const layers = cloudLayers(kpp * w, seed);
  const b = Math.max(1, Math.round(block));
  // worked out more coarsely in squares (while the camera moves)
  const G = GRID * b;
  const gw = Math.ceil(w / G) + 1;
  const gh = Math.ceil(h / G) + 1;
  const thick: Float32Array[] = [];
  const hue: Float32Array[] = [];
  for (const L of layers) {
    const t = new Float32Array(gw * gh);
    const u = new Float32Array(gw * gh);
    const scale = kpp / 10 ** L.i;
    const ox = hash2(L.i, 1, seed) * 1000;
    const oy = hash2(L.i, 2, seed) * 1000;
    // a layer coming in or going out shows only its thickest parts
    const thin = 0.55 * (1 - L.cover) ** 2;
    for (let gy = 0; gy < gh; gy++) {
      for (let gx = 0; gx < gw; gx++) {
        let X = (gx * G - ex) * scale + ox;
        let Y = (gy * G - ey) * scale + oy;
        // wisps: the cloud pulled about by a larger swirl
        const twist = noise(X * 0.6, Y * 0.6, L.seed + 3);
        const swirl = twist - 0.5;
        X += swirl * 1.6;
        Y -= swirl * 1.1;
        // clouds in patches, billowing
        const patch = noise(X * 0.4, Y * 0.4, L.seed + 7);
        const d = 0.5 + (fbm(X, Y, L.seed) - 0.5) * 1.8;
        const k = gy * gw + gx;
        t[k] = d * (0.38 + 0.8 * patch) - thin;
        // which of its two colours: by the same swirl, so it follows the wisps
        u[k] = twist;
      }
    }
    thick.push(t);
    hue.push(u);
  }
  const data = s.data;
  // (only the clouds inside `within` count, if it is given: they are all that is seen)
  const bands = bandsFor(
    thick,
    within
      ? (k) =>
          ((k % gw) * G - within.x) ** 2 +
            (Math.floor(k / gw) * G - within.y) ** 2 <
          within.r * within.r
      : () => true,
  );
  const [b0, b1, b2, b3] = bands;
  const low = b0 - FRINGE;
  const r2 = within ? within.r * within.r : 0;
  const inv = 1 / G;
  const t0 = thick[0];
  const u0 = hue[0];
  const t1 = thick[1];
  const u1 = hue[1];
  for (let cy = 0; cy < gh - 1; cy++) {
    for (let cx = 0; cx < gw - 1; cx++) {
      const k00 = cy * gw + cx;
      const k10 = k00 + 1;
      const k01 = k00 + gw;
      const k11 = k01 + 1;
      // each layer's thinnest and thickest corner, and is anything here at all
      const lo0 = Math.min(t0[k00], t0[k10], t0[k01], t0[k11]);
      const hi0 = Math.max(t0[k00], t0[k10], t0[k01], t0[k11]);
      const lo1 = t1 ? Math.min(t1[k00], t1[k10], t1[k01], t1[k11]) : -1;
      const hi1 = t1 ? Math.max(t1[k00], t1[k10], t1[k01], t1[k11]) : -1;
      const most = Math.max(hi0, hi1);
      if (most < low) continue;
      const top = hi1 > hi0 ? 1 : 0;
      const lo = top === 1 ? lo1 : lo0;
      const other = top === 1 ? hi0 : hi1;
      const x0 = cx * G;
      const y0 = cy * G;
      const x1 = Math.min(w, x0 + G);
      const y1 = Math.min(h, y0 + G);
      const inside =
        !within ||
        [
          [x0, y0],
          [x1, y0],
          [x0, y1],
          [x1, y1],
        ].every(([x, y]) => (x - within.x) ** 2 + (y - within.y) ** 2 < r2);
      // all one colour, clear of the other layer and of every edge: filled whole
      const u = top === 1 ? u1 : u0;
      const band = bandOf(lo - FRINGE, bands);
      const hlo = Math.min(u[k00], u[k10], u[k01], u[k11]);
      const hhi = Math.max(u[k00], u[k10], u[k01], u[k11]);
      if (
        inside &&
        band >= 0 &&
        band === bandOf(most + FRINGE, bands) &&
        other < lo - FRINGE &&
        (hhi < 0.5 - 0.04 || hlo > 0.5 + 0.04)
      ) {
        const c = layers[top].colours[hlo > 0.5 ? 1 : 0][band];
        for (let y = y0; y < y1; y++) data.fill(c, y * w + x0, y * w + x1);
        continue;
      }
      // pixel by pixel: each layer across the square as a + bx fx + by fy + bxy fx fy,
      // the other layer only if it can be the thicker somewhere here
      const use0 = top === 0 || hi0 >= lo1 - FRINGE * 2;
      const use1 = !!t1 && (top === 1 || hi1 >= lo0 - FRINGE * 2);
      const a0 = t0[k00];
      const x0b = t0[k10] - a0;
      const y0b = t0[k01] - a0;
      const xy0 = a0 - t0[k10] - t0[k01] + t0[k11];
      const ha0 = u0[k00];
      const hx0 = u0[k10] - ha0;
      const hy0 = u0[k01] - ha0;
      const hxy0 = ha0 - u0[k10] - u0[k01] + u0[k11];
      const a1 = t1 ? t1[k00] : 0;
      const x1b = t1 ? t1[k10] - a1 : 0;
      const y1b = t1 ? t1[k01] - a1 : 0;
      const xy1 = t1 ? a1 - t1[k10] - t1[k01] + t1[k11] : 0;
      const ha1 = u1 ? u1[k00] : 0;
      const hx1 = u1 ? u1[k10] - ha1 : 0;
      const hy1 = u1 ? u1[k01] - ha1 : 0;
      const hxy1 = u1 ? ha1 - u1[k10] - u1[k01] + u1[k11] : 0;
      const pal0 = layers[0].colours;
      const pal1 = layers[1]?.colours ?? pal0;
      for (let y = y0; y < y1; y += b) {
        const fy = (y - y0) * inv;
        const ra0 = a0 + y0b * fy;
        const rb0 = x0b + xy0 * fy;
        const ra1 = a1 + y1b * fy;
        const rb1 = x1b + xy1 * fy;
        const qa0 = ha0 + hy0 * fy;
        const qb0 = hx0 + hxy0 * fy;
        const qa1 = ha1 + hy1 * fy;
        const qb1 = hx1 + hxy1 * fy;
        const drow = (y & 3) << 2;
        const ye = Math.min(y1, y + b);
        for (let x = x0; x < x1; x += b) {
          if (within) {
            const dx = x + 0.5 - within.x;
            const dy = y + 0.5 - within.y;
            if (dx * dx + dy * dy > r2) continue;
          }
          const fx = (x - x0) * inv;
          const dither = DITHER[drow | (x & 3)];
          let best = -1;
          let pick = 0;
          if (use0) best = ra0 + rb0 * fx + dither;
          if (use1) {
            const v = ra1 + rb1 * fx + dither;
            if (v > best) {
              best = v;
              pick = 1;
            }
          }
          if (best < b0) continue;
          const bd = best >= b3 ? 3 : best >= b2 ? 2 : best >= b1 ? 1 : 0;
          const hv =
            (pick === 1 ? qa1 + qb1 * fx : qa0 + qb0 * fx) + dither * 2.5;
          const c = (pick === 1 ? pal1 : pal0)[hv < 0.5 ? 0 : 1][bd];
          if (b === 1) {
            data[y * w + x] = c;
            continue;
          }
          const xe = Math.min(x1, x + b);
          for (let yy = y; yy < ye; yy++) {
            for (let xx = x; xx < xe; xx++) data[yy * w + xx] = c;
          }
        }
      }
    }
  }
}

// --- the stars ----------------------------------------------------------------------------------

/** The far stars' colours beyond white and grey. */
const TINTS: readonly Color[] = [
  P.goldLight,
  P.awayLight,
  P.nextgenLight,
  P.brickLight,
  P.furthestLight,
  P.retroLight,
];

/** A big far star, fixed to the picture: where, its colour, and when it twinkles. */
export interface Sparkle {
  x: number;
  y: number;
  c: Color;
  phase: number;
}

/** The big far stars of a picture `w` by `h`. */
export function sparkles(w: number, h: number, seed: number): Sparkle[] {
  const n = Math.max(4, Math.round((w * h) / 24000));
  const out: Sparkle[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      x: 3 + Math.floor(hash2(i, 1, seed + 211) * (w - 6)),
      y: 3 + Math.floor(hash2(i, 2, seed + 211) * (h - 6)),
      c: TINTS[Math.floor(hash2(i, 3, seed + 211) * TINTS.length)],
      phase: hash2(i, 4, seed + 211),
    });
  }
  return out;
}

/** A sparkle: a white heart, and arms `arm` long in its colour (the outer one dimmer). */
function drawSparkle(
  s: Surface,
  sp: Sparkle,
  arm: number,
  onlyOver?: ReadonlySet<Color>,
): void {
  for (let d = 1; d <= arm; d++) {
    const c = d === 1 ? sp.c : d === 2 ? P.mist : P.steel;
    for (const [dx, dy] of [
      [d, 0],
      [-d, 0],
      [0, d],
      [0, -d],
    ]) {
      const x = sp.x + dx;
      const y = sp.y + dy;
      if (onlyOver && !onlyOver.has(s.get(x, y))) continue;
      s.px(x, y, c);
    }
  }
  s.px(sp.x, sp.y, P.white);
}

/** The far stars, fixed to the picture: white and grey, some coloured, a few big. */
function drawFarStars(s: Surface, seed: number): void {
  drawStars(s, seed);
  const n = Math.round((s.w * s.h) / 2600);
  for (let i = 0; i < n; i++) {
    s.px(
      Math.floor(hash2(i, 1, seed + 97) * s.w),
      Math.floor(hash2(i, 2, seed + 97) * s.h),
      TINTS[Math.floor(hash2(i, 3, seed + 97) * TINTS.length)],
    );
  }
  for (const sp of sparkles(s.w, s.h, seed)) drawSparkle(s, sp, 1);
}

/** The Milky Way's band as worked out for a picture: its sky, and its stars over the clouds. */
interface Band {
  key: string;
  /** Every pixel of the picture: ink, or the band's haze. */
  sky: Uint32Array;
  stars: { i: number; c: Color }[];
}

/** The band last worked out (it is the same for every frame while the picture's size is). */
let bandMade: Band | null = null;

/** How strong the band is for a picture `across` km wide (1 inside the galaxy, 0 out of it). */
function bandStrength(across: number): number {
  const fade =
    1 - (Math.log10(across / LY) - Math.log10(3000)) / Math.log10(10);
  return Math.min(1, Math.max(0, fade));
}

/**
 * The Milky Way across the sky, fixed to the picture: a band of haze, thick with stars, a
 * dark lane of dust down it. Worked out once for a picture's size and kept; its wanderings
 * along its length are worked out once a pixel along it.
 */
function bandFor(w: number, h: number, seed: number): Band {
  const key = `${w}x${h}|${seed}`;
  if (bandMade?.key === key) return bandMade;
  const sky = new Uint32Array(w * h).fill(P.ink);
  const stars: { i: number; c: Color }[] = [];
  const th = -0.3 - 0.45 * hash2(1, 1, seed + 301);
  const ca = Math.cos(th);
  const sa = Math.sin(th);
  const cx = w * (0.3 + 0.4 * hash2(1, 2, seed + 301));
  const cy = h * (0.35 + 0.3 * hash2(1, 3, seed + 301));
  const W = h * 0.24;
  const sd = seed + 303;
  // along its length: how far its middle wanders, how wide it is, where its dust lane is
  // and how thick that is
  const reach = Math.ceil(Math.hypot(w, h)) + 2;
  const size = reach * 2 + 1;
  const off = new Float32Array(size);
  const wide = new Float32Array(size);
  const lane = new Float32Array(size);
  const dust = new Float32Array(size);
  for (let a = 0; a < size; a++) {
    const along = a - reach;
    off[a] = (noise(along / 170, 0.5, sd) - 0.5) * W * 0.7;
    wide[a] = W * (0.75 + 0.5 * noise(along / 120, 3.5, sd));
    lane[a] = wide[a] * 0.25 * (noise(along / 90, 7.5, sd) - 0.5);
    dust[a] = Math.max(0, noise(along / 55, 9.5, sd) - 0.3) * wide[a] * 0.16;
  }
  if (W > 0) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const a = Math.round((x - cx) * ca + (y - cy) * sa) + reach;
        const d = (x - cx) * -sa + (y - cy) * ca - off[a];
        const width = wide[a];
        const u = Math.abs(d) / width;
        if (u >= 1) continue;
        // the dust lane, wandering a little off its middle, pinched to nothing here and there
        const t = bayer4(x, y) * 0.12 - 0.06;
        const lanes = Math.abs(d - lane[a]) / (dust[a] || 1e-9) + t * 4;
        if (lanes < 0.55) continue;
        const v = u + t;
        const i = y * w + x;
        if (lanes < 1) sky[i] = P.nightMid;
        else if (v < 0.35) sky[i] = P.nightLow;
        else if (v < 0.75) sky[i] = P.nightMid;
      }
    }
    // its stars, crowded towards its middle
    const n = Math.round((w * h) / 90);
    for (let i = 0; i < n; i++) {
      const along = (hash2(i, 1, sd) - 0.5) * Math.hypot(w, h);
      const spread =
        (hash2(i, 2, sd) + hash2(i, 3, sd) + hash2(i, 4, sd) - 1.5) * W * 0.9;
      const o = off[Math.round(along) + reach];
      const x = Math.round(cx + along * ca - (spread + o) * sa);
      const y = Math.round(cy + along * sa + (spread + o) * ca);
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const r = hash2(i, 5, sd);
      stars.push({
        i: y * w + x,
        c:
          r < 0.55
            ? P.steel
            : r < 0.85
              ? P.mist
              : r < 0.95
                ? P.white
                : P.goldLight,
      });
    }
  }
  bandMade = { key, sky, stars };
  return bandMade;
}

/** About this many of the nearer things in the picture, from each tenfold. */
const NEAR = 150;

/**
 * The nearer things, fixed to the sky a layer a tenfold (a thing in about every 1/16 of the
 * layer's size, kept to about NEAR in the picture): dust in the solar system, stars out to
 * the size of a galaxy, far galaxies beyond; none at the size of the universe.
 */
function drawNear(
  s: Surface,
  ex: number,
  ey: number,
  kpp: number,
  seed: number,
): void {
  const w = s.w;
  const h = s.h;
  const z = Math.log10(kpp * w);
  for (const i of [Math.floor(z), Math.floor(z) + 1]) {
    const size = 10 ** i;
    if (size >= 1e23) continue;
    const weight = 1 - Math.abs(i - z);
    if (weight <= 0) continue;
    const cell = size / 16;
    const cx0 = Math.floor((-ex * kpp) / cell);
    const cx1 = Math.floor(((w - ex) * kpp) / cell);
    const cy0 = Math.floor((-ey * kpp) / cell);
    const cy1 = Math.floor(((h - ey) * kpp) / cell);
    const count = (cx1 - cx0 + 1) * (cy1 - cy0 + 1);
    if (count > 40000) continue;
    const p = Math.min(1, NEAR / count) * weight;
    const sd = (seed * 17 + i * 389) | 0;
    const dust = size < 1e9;
    const galaxies = size >= 1e5 * LY;
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        if (hash2(cx, cy, sd) >= p) continue;
        const x = Math.round(ex + ((cx + hash2(cx, cy, sd + 1)) * cell) / kpp);
        const y = Math.round(ey + ((cy + hash2(cx, cy, sd + 2)) * cell) / kpp);
        if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) continue;
        const r = hash2(cx, cy, sd + 3);
        if (dust) {
          s.px(x, y, r < 0.8 ? P.steel : P.mist);
        } else if (galaxies) {
          drawFarGalaxy(s, x, y, r, hash2(cx, cy, sd + 4));
        } else {
          s.px(
            x,
            y,
            r < 0.45
              ? P.steel
              : r < 0.75
                ? P.mist
                : r < 0.85
                  ? P.white
                  : TINTS[Math.floor(((r - 0.85) / 0.15) * TINTS.length)],
          );
        }
      }
    }
  }
}

/**
 * A far galaxy at (x, y): mostly a smudge at an angle with a bright middle; some a lens with
 * a warm heart (an old elliptical), some a little spiral; `r` and `q` (0 to 1) choose.
 */
function drawFarGalaxy(
  s: Surface,
  x: number,
  y: number,
  r: number,
  q: number,
): void {
  const dir = Math.floor(q * 4);
  const dx = dir === 1 ? 0 : 1;
  const dy = dir === 0 ? 0 : dir === 3 ? -1 : 1;
  const edge = r < 0.15 ? P.nextgenDark : r < 0.3 ? P.furthestDark : P.steel;
  if (r < 0.6) {
    s.px(x - dx, y - dy, edge);
    s.px(x + dx, y + dy, edge);
    s.px(x, y, r < 0.45 ? P.mist : P.chalk);
    return;
  }
  if (r < 0.85) {
    // an old elliptical: a lens, warm in the middle
    for (const [ax, ay] of [
      [-2, 0],
      [2, 0],
      [-1, -1],
      [0, -1],
      [1, -1],
      [-1, 1],
      [0, 1],
      [1, 1],
    ]) {
      s.px(x + (dir === 1 ? ay : ax), y + (dir === 1 ? ax : ay), P.slate);
    }
    s.px(x - 1, y, P.retroDark);
    s.px(x + 1, y, P.retroDark);
    s.px(x, y, P.retroLight);
    return;
  }
  // a little spiral: a bright middle, two arms curling out
  const flip = q < 0.5 ? 1 : -1;
  for (const [ax, ay, c] of [
    [1, 0, P.mist],
    [-1, 0, P.mist],
    [2, 1 * flip, P.furthestLight],
    [-2, -1 * flip, P.furthestLight],
    [2, 2 * flip, P.steel],
    [-2, -2 * flip, P.steel],
    [0, 1 * flip, P.slate],
    [0, -1 * flip, P.slate],
  ] as const) {
    s.px(x + ax, y + ay, c);
  }
  s.px(x, y, P.white);
}

export interface BackdropView {
  /** The Earth's middle on the picture, and km a pixel. */
  ex: number;
  ey: number;
  kpp: number;
  seed: number;
  /** The clouds worked out in squares of this many pixels (moving: cheaper), or 1. */
  block?: number;
  /** The clouds only inside this circle (the edge of the observable universe). */
  within?: { x: number; y: number; r: number };
}

/**
 * Space behind everything round the Earth at (`ex`, `ey`), `kpp` km a pixel: black, the
 * clouds, the far stars and the nearer things. Fills every pixel of `s`.
 */
export function drawSpaceBackdrop(s: Surface, v: BackdropView): void {
  // the Milky Way's band behind the clouds while the picture is inside it, its stars over them
  const strength = bandStrength(v.kpp * s.w);
  const band = strength > 0 ? bandFor(s.w, s.h, v.seed) : null;
  if (band && strength >= 1) s.data.set(band.sky);
  else {
    s.clear(P.ink);
    // leaving the galaxy: the band dissolves, a dither at a time
    if (band) {
      const sky = band.sky;
      const data = s.data;
      const w = s.w;
      const ink = P.ink;
      // the dither cells it keeps at this strength
      const keep = DITHER.map((t) =>
        t / (FRINGE * 2) + 0.5 < strength ? 1 : 0,
      );
      for (let y = 0; y < s.h; y++) {
        const row = y * w;
        const krow = (y & 3) << 2;
        for (let x = 0; x < w; x++) {
          const c = sky[row + x];
          if (c !== ink && keep[krow | (x & 3)]) data[row + x] = c;
        }
      }
    }
  }
  drawClouds(s, v.ex, v.ey, v.kpp, v.seed, v.block ?? 1, v.within);
  if (band) {
    const n = Math.round(band.stars.length * strength);
    for (let i = 0; i < n; i++) s.data[band.stars[i].i] = band.stars[i].c;
  }
  drawFarStars(s, v.seed);
  drawNear(s, v.ex, v.ey, v.kpp, v.seed);
}

// --- its life -----------------------------------------------------------------------------------

/** A star shoots about this often (seconds), for SHOOT_S. */
const SHOOT_EVERY = 6;
const SHOOT_S = 0.7;

/** Satellites in low orbit: km up, how flat the orbit looks, turned how far, how fast. */
const LOW_ORBITS = [
  { up: 420, flat: 0.32, turn: -0.35, speed: 0.55, from: 0.4 },
  { up: 540, flat: 0.5, turn: 0.5, speed: 0.42, from: 3.1 },
] as const;
/** Geostationary and GPS orbits (km from the Earth's middle). */
export const GEO_KM = 42164;
const GPS_KM = 26560;

export interface LifeView {
  /** The Earth's middle on the picture, km a pixel, and the scale of things (1 or 2). */
  ex: number;
  ey: number;
  kpp: number;
  k: number;
  seed: number;
  /** Seconds. */
  t: number;
  reduced: boolean;
}

/**
 * Space's life over the picture `s` (the backdrop and what is in it already drawn): the big
 * stars twinkle where nothing covers them; a star shoots across the backdrop now and then;
 * satellites go round the Earth, in low orbit round a big globe, further out round a small
 * one. With reduced motion, no shooting stars and everything slower.
 */
export function drawSpaceLife(s: Surface, v: LifeView): void {
  const w = s.w;
  const h = s.h;
  const t = v.reduced ? v.t * 0.25 : v.t;
  // twinkling: now and then a big star's arms grow, for a moment
  for (const sp of sparkles(w, h, v.seed)) {
    if (s.get(sp.x, sp.y) !== P.white) continue;
    const f = Math.floor(t * 3 + sp.phase * 12) % 12;
    const arm = f === 0 ? 3 : f === 1 || f === 11 ? 2 : 0;
    if (arm) drawSparkle(s, sp, arm, BACKDROP);
  }
  if (!v.reduced) drawShootingStar(s, v);
  drawSatellites(s, v, t);
}

/** Now and then, a star shooting down across the backdrop, its trail behind it. */
function drawShootingStar(s: Surface, v: LifeView): void {
  const slot = Math.floor(v.t / SHOOT_EVERY);
  const start = slot * SHOOT_EVERY + 1 + hash2(slot, 1, v.seed + 5) * 3;
  const u = (v.t - start) / SHOOT_S;
  if (u < 0 || u > 1) return;
  const w = s.w;
  const h = s.h;
  const k = v.k;
  const x0 = w * (0.15 + 0.7 * hash2(slot, 2, v.seed + 5));
  const y0 = h * (0.08 + 0.4 * hash2(slot, 3, v.seed + 5));
  const left = hash2(slot, 4, v.seed + 5) < 0.5 ? -1 : 1;
  const a = 0.35 + 0.35 * hash2(slot, 5, v.seed + 5);
  const dx = Math.cos(a) * left;
  const dy = Math.sin(a);
  const travel = w * 0.3;
  const hx = x0 + dx * travel * u;
  const hy = y0 + dy * travel * u;
  // the trail grows, then goes out from its tail
  const long = 16 * Math.min(1, u * 5) * (u > 0.75 ? (1 - u) * 4 : 1);
  for (let d = 0; d <= long; d++) {
    const c = d < 2 ? P.white : d < 5 ? P.chalk : d < 10 ? P.mist : P.steel;
    if (d >= 10 && d % 2 === 1) continue;
    const x = Math.round(hx - dx * d * k);
    const y = Math.round(hy - dy * d * k);
    for (let j = 0; j < k; j++) {
      for (let i = 0; i < k; i++) {
        if (BACKDROP.has(s.get(x + i, y + j))) s.px(x + i, y + j, c);
      }
    }
  }
}

/** Satellites round the Earth, at whatever height shows at this scale. */
function drawSatellites(s: Surface, v: LifeView, t: number): void {
  const diag = Math.hypot(s.w, s.h);
  const r = EARTH_RADIUS / v.kpp;
  const k = v.k;
  // round a big globe: two in low orbit, behind it on the far side
  if (r >= 30 && r < diag * 2) {
    for (const o of LOW_ORBITS) {
      const R = r * (1 + o.up / EARTH_RADIUS);
      const a = o.from + t * o.speed;
      const lx = Math.cos(a) * R;
      const ly = Math.sin(a) * R * o.flat;
      const x = v.ex + lx * Math.cos(o.turn) - ly * Math.sin(o.turn);
      const y = v.ey + lx * Math.sin(o.turn) + ly * Math.cos(o.turn);
      const behind = Math.sin(a) < 0;
      if (behind && Math.hypot(x - v.ex, y - v.ey) < r + 2) continue;
      drawSatellite(s, x, y, 2, k);
    }
    return;
  }
  // round a small one: a ring of them standing still over the equator, more going round
  const geo = GEO_KM / v.kpp;
  if (geo < 14 || geo > diag * 2) return;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + t * 0.12;
    drawSatellite(s, v.ex + Math.cos(a) * geo, v.ey + Math.sin(a) * geo, 1, 1);
  }
  const gps = GPS_KM / v.kpp;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + t * 0.2;
    const lx = Math.cos(a) * gps;
    const ly = Math.sin(a) * gps * 0.45;
    const x = v.ex + lx * Math.cos(0.6) - ly * Math.sin(0.6);
    const y = v.ey + lx * Math.sin(0.6) + ly * Math.cos(0.6);
    if (Math.sin(a) < 0 && Math.hypot(x - v.ex, y - v.ey) < r + 1) continue;
    drawSatellite(s, x, y, 1, 1);
  }
}

/** A satellite: a gold body, its blue panels `span` long each side (at `k`). */
function drawSatellite(
  s: Surface,
  cx: number,
  cy: number,
  span: number,
  k: number,
): void {
  const x = Math.round(cx);
  const y = Math.round(cy);
  for (let d = 1; d <= span; d++) {
    const c = d === span && span > 1 ? P.furthestDark : P.furthest;
    s.rect(x - d * k, y, k, k, c);
    s.rect(x + d * k, y, k, k, c);
  }
  s.rect(x, y, k, k, span > 1 ? P.chalk : P.goldLight);
}
