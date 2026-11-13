/**
 * The small things the town is made of, as the camera sees them from above: buildings
 * (boxes with flat or pitched roofs, drawn through the projection so their roofs and
 * walls foreshorten properly), and fixed-size sprites in three sizes for trees, bushes,
 * cars, coaches, people and lamps (docs/ART_BIBLE.md 5), and the town's and the life's
 * small parts: windows, doors, chimneys, bins, parasols, bollards, flags, the tiny match's
 * players, smoke. Nothing here is scaled smoothly.
 *
 * Every sprite stands on `(x, y)`: its lowest row is `y - 1` (the ground point is the row
 * below). A sprite two columns wide in its middle stands on `x` and `x + 1` (the anchor is
 * the left of the two middle columns, as the people of stadium-people.ts).
 *
 * Light from the top left: crowns are lumps of leaves, lit on their upper left, with a
 * darker rim on the lower right; a cast shadow falls down and to the right. Variety comes
 * from the position (a hash of x and y), so the same tree in the same place is always the
 * same.
 */

import { Surface, hash2, mix, shade, type Color, type Point } from "~/pixel";
import { P } from "~/art/palette";
import {
  EAST,
  NORTH,
  SOUTH,
  carSprite,
  coachSprite,
  headingAngle,
} from "~/art/stadium-cars";
import { drawPerson } from "~/art/stadium-people";
import { projectRaw, sizeClass, type View } from "~/art/stadium-view";
import { stepOfClass, type Step } from "~/art/traffic-steps";

// ---------------------------------------------------------------------------
// Pixels by rule: cast shadows and pools of light recolour what is already there
// ---------------------------------------------------------------------------

const darker = new Map<Color, Color>();
const warmer = new Map<Color, Color>();
const cooler = new Map<Color, Color>();
/** The other way: a pool's colour back to the ground's own (for the shadows cast in it). */
const unlit = new Map<Color, Color>();

function darkOf(c: Color): Color {
  let o = darker.get(c);
  if (o === undefined) {
    o = shade(c, -0.24);
    darker.set(c, o);
  }
  return o;
}

function warmOf(c: Color): Color {
  let o = warmer.get(c);
  if (o === undefined) {
    o = mix(shade(c, 0.3), P.gold, 0.3);
    warmer.set(c, o);
    if (!unlit.has(o)) unlit.set(o, c);
  }
  return o;
}

function coolOf(c: Color): Color {
  let o = cooler.get(c);
  if (o === undefined) {
    o = mix(shade(c, 0.34), P.steelHi, 0.22);
    cooler.set(c, o);
    if (!unlit.has(o)) unlit.set(o, c);
  }
  return o;
}

/**
 * A shadow cast from a street lamp on a pixel its pool lit (`lightPool`): the ground as it
 * was before the lamp lit it, a cast shadow's tone darker (`darkOf`, as the day's shadows),
 * so it reads against the night ground round the pool as well as in it. Undefined for a
 * colour no pool made.
 */
export function lampShadeOf(c: Color): Color | undefined {
  const u = unlit.get(c);
  return u === undefined ? undefined : darkOf(u);
}

/** Scanline fill of any polygon: `fn(y, x0, x1)` for every covered span (inclusive). */
export function spans(
  pts: ReadonlyArray<Point>,
  w: number,
  h: number,
  fn: (y: number, x0: number, x1: number) => void,
): void {
  const n = pts.length;
  if (n < 3) return;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    if (p[1] < minY) minY = p[1];
    if (p[1] > maxY) maxY = p[1];
  }
  const y0 = Math.max(0, Math.ceil(minY));
  const y1 = Math.min(h - 1, Math.floor(maxY));
  const xs: number[] = [];
  for (let y = y0; y <= y1; y++) {
    xs.length = 0;
    for (let i = 0; i < n; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % n];
      if (a[1] === b[1]) continue;
      const lo = Math.min(a[1], b[1]);
      const hi = Math.max(a[1], b[1]);
      if (y < lo || y >= hi) continue;
      xs.push(a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
    }
    xs.sort((p, q) => p - q);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const xa = Math.max(0, Math.ceil(xs[i] - 0.5));
      const xb = Math.min(w - 1, Math.floor(xs[i + 1] - 0.5));
      if (xb >= xa) fn(y, xa, xb);
    }
  }
}

/**
 * What the static painter's shadows darkened while it notes the depth mask
 * (stadium-town.ts): for each pixel of `s`, the colour the first shadow of a pass found
 * there, the colour the last one left, and the pass. A shadow is not a thing standing on
 * the ground, so a pixel only shadows changed must not hide what moves behind it.
 */
export class ShadowLog {
  readonly under: Uint32Array;
  readonly left: Uint32Array;
  readonly pass: Int32Array;
  /** The pass now being painted: bump it for each one. */
  now = 1;
  constructor(readonly s: Surface) {
    const n = s.w * s.h;
    this.under = new Uint32Array(n);
    this.left = new Uint32Array(n);
    this.pass = new Int32Array(n);
  }

  /** Whether pixel `i` holds nothing but the shadows of this pass over `before`. */
  onlyShadow(i: number, before: number): boolean {
    return (
      this.pass[i] === this.now &&
      this.under[i] === before &&
      this.left[i] === this.s.data[i]
    );
  }
}

let shadowLog: ShadowLog | null = null;
/** Note every shadow cast on the log's surface in it (null: stop). */
export function logShadows(log: ShadowLog | null): void {
  shadowLog = log;
}

/** Darken pixel `i` of `s`, noting it when `s` is the logged surface. */
function darken(s: Surface, i: number): void {
  const c = s.data[i] as Color;
  if (c === 0) return;
  const o = darkOf(c);
  s.data[i] = o;
  const log = shadowLog;
  if (log === null || log.s !== s) return;
  if (log.pass[i] !== log.now) {
    log.pass[i] = log.now;
    log.under[i] = c;
  }
  log.left[i] = o;
}

/** Put a polygon of the ground into cast shadow. */
export function shadowPoly(s: Surface, pts: ReadonlyArray<Point>): void {
  spans(pts, s.w, s.h, (y, x0, x1) => {
    const row = y * s.w;
    for (let x = x0; x <= x1; x++) darken(s, row + x);
  });
}

/**
 * A small round shadow on the ground. With a depth mask (`depth`, one entry for each pixel
 * of `s`: stadium-town.ts) it darkens only where nothing nearer than `V` stands, the rule
 * a moving thing is drawn by (stadium-life.ts): a car behind a tree or a roof leaves its
 * shadow behind it too.
 */
export function shadowBlob(
  s: Surface,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  depth?: Float32Array,
  V = 0,
): void {
  for (let y = Math.ceil(cy - ry); y <= Math.floor(cy + ry); y++) {
    if (y < 0 || y >= s.h) continue;
    const t = ry <= 0 ? 0 : (y - cy) / ry;
    const half = rx * Math.sqrt(Math.max(0, 1 - t * t));
    for (let x = Math.ceil(cx - half); x <= Math.floor(cx + half); x++) {
      if (x < 0 || x >= s.w) continue;
      const i = y * s.w + x;
      if (depth !== undefined && !(depth[i] >= V)) continue;
      darken(s, i);
    }
  }
}

/** A pool of lamplight on whatever is there: warm (sodium) or cool (car park white). */
export function lightPool(
  s: Surface,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  cool = false,
): void {
  const d = s.data;
  const map = cool ? coolOf : warmOf;
  for (let y = Math.ceil(cy - ry); y <= Math.floor(cy + ry); y++) {
    if (y < 0 || y >= s.h) continue;
    const t = ry <= 0 ? 0 : (y - cy) / ry;
    const half = rx * Math.sqrt(Math.max(0, 1 - t * t));
    for (let x = Math.ceil(cx - half); x <= Math.floor(cx + half); x++) {
      if (x < 0 || x >= s.w) continue;
      // a ragged edge: the outer ring is every other pixel
      const u = half <= 0 ? 0 : Math.abs(x - cx) / rx;
      if (u * u + t * t > 0.5 && (x + y) % 2 !== 0) continue;
      const c = d[y * s.w + x] as Color;
      if (c !== 0) d[y * s.w + x] = map(c);
    }
  }
}

// ---------------------------------------------------------------------------
// Buildings
// ---------------------------------------------------------------------------

export interface BoxLook {
  /** The roof's lit plane (or the whole of a flat roof). */
  roof: Color;
  /** The roof's shaded plane. */
  roofShade: Color;
  /** The wall facing the camera. */
  wall: Color;
  /** The wall on the side. */
  side: Color;
}

export interface BoxOptions {
  /** Height of the walls. */
  H: number;
  /** Height of the ridge above the walls: 0 for a flat roof. */
  R?: number;
  /** The ridge runs "ew" (the default) or "ns". */
  ridge?: "ew" | "ns";
  /** Leave out the cast shadow. */
  noShadow?: boolean;
}

type Tone = (c: Color, V: number) => Color;

/**
 * A building on the plan from (X0, V0) to (X1, V1), V0 nearest the camera. Final colours
 * come from `tone`.
 */
export function box(
  s: Surface,
  view: View,
  tone: Tone,
  X0: number,
  X1: number,
  V0: number,
  V1: number,
  look: BoxLook,
  opts: BoxOptions,
): void {
  const H = opts.H;
  const R = opts.R ?? 0;
  const at = (X: number, V: number, h: number): Point => {
    const p = projectRaw(view, X, V, h);
    return [Math.round(p.x), Math.round(p.y)];
  };
  const Vm = (V0 + V1) / 2;
  const Xm = (X0 + X1) / 2;
  if (!opts.noShadow) {
    const dx = (H + R * 0.5) * 0.62;
    const dv = -(H + R * 0.5) * 0.5;
    shadowPoly(s, [
      at(X0, V1, 0),
      at(X1, V1, 0),
      at(X1 + dx, V1 + dv, 0),
      at(X1 + dx, V0 + dv, 0),
      at(X0 + dx, V0 + dv, 0),
      at(X0, V0, 0),
    ]);
  }
  const roof = tone(look.roof, Vm);
  const roofShade = tone(look.roofShade, Vm);
  const wall = tone(look.wall, V0);
  const side = tone(look.side, Vm);
  // The side wall the camera can see: the one facing the middle of the picture.
  const sx = Xm < 0 ? X1 : X0;
  if (R <= 0) {
    s.poly([at(sx, V0, 0), at(sx, V1, 0), at(sx, V1, H), at(sx, V0, H)], side);
    s.poly([at(X0, V0, 0), at(X1, V0, 0), at(X1, V0, H), at(X0, V0, H)], wall);
    s.poly([at(X0, V0, H), at(X1, V0, H), at(X1, V1, H), at(X0, V1, H)], roof);
    return;
  }
  if ((opts.ridge ?? "ew") === "ew") {
    // gable on the visible side
    s.poly(
      [
        at(sx, V0, 0),
        at(sx, V1, 0),
        at(sx, V1, H),
        at(sx, Vm, H + R),
        at(sx, V0, H),
      ],
      side,
    );
    s.poly([at(X0, V0, 0), at(X1, V0, 0), at(X1, V0, H), at(X0, V0, H)], wall);
    // the far slope (lit: it faces up and away), then the near one over it
    s.poly(
      [at(X0, Vm, H + R), at(X1, Vm, H + R), at(X1, V1, H), at(X0, V1, H)],
      roof,
    );
    s.poly(
      [at(X0, V0, H), at(X1, V0, H), at(X1, Vm, H + R), at(X0, Vm, H + R)],
      roofShade,
    );
    return;
  }
  // ridge north-south: the gable faces the camera
  s.poly(
    [
      at(X0, V0, 0),
      at(X1, V0, 0),
      at(X1, V0, H),
      at(Xm, V0, H + R),
      at(X0, V0, H),
    ],
    wall,
  );
  s.poly(
    [at(X0, V0, H), at(Xm, V0, H + R), at(Xm, V1, H + R), at(X0, V1, H)],
    roof,
  );
  s.poly(
    [at(Xm, V0, H + R), at(X1, V0, H), at(X1, V1, H), at(Xm, V1, H + R)],
    roofShade,
  );
}

// ---------------------------------------------------------------------------
// Sprites: three sizes each, never scaled
// ---------------------------------------------------------------------------

export interface TreeLook {
  dark: Color;
  base: Color;
  light: Color;
  hi: Color;
}

// ---------------------------------------------------------------------------
// Broadleaf trees
// ---------------------------------------------------------------------------

/**
 * The lumps a crown is built of, as (dx, dy, r) in fractions of the crown's radius from
 * its middle: a big middle and four lobes round it, so the outline is scalloped.
 */
const LOBES: readonly (readonly [number, number, number])[] = [
  [0, 0.06, 0.78],
  [-0.4, 0.16, 0.56],
  [0.42, 0.2, 0.52],
  [-0.22, -0.4, 0.56],
  [0.3, -0.34, 0.5],
];

/** How far below its middle a crown of radius R reaches (its lowest lobe's lowest row). */
function crownFoot(R: number): number {
  let low = 0;
  for (const [, dy, r] of LOBES) {
    low = Math.max(low, Math.round(dy * R) + Math.max(1, Math.round(r * R)));
  }
  return low;
}

/** A crown of radius R whose middle is at (x, cy). */
function crown(
  s: Surface,
  x: number,
  cy: number,
  R: number,
  k: TreeLook,
  turn: number,
): void {
  // turned a little, tree by tree, so a row of them is not a row of stamps
  const flip = turn < 0.5 ? 1 : -1;
  const lobe = (i: number, grow: number, ox: number, oy: number, c: Color) => {
    const [dx, dy, r] = LOBES[i];
    const rr = Math.max(1, Math.round(r * R) + grow);
    s.disc(
      x + Math.round(dx * R * flip) + ox,
      cy + Math.round(dy * R) + oy,
      rr,
      c,
    );
  };
  // the silhouette, in the deep tone
  for (let i = 0; i < LOBES.length; i++) lobe(i, 0, 0, 0, k.dark);
  // the leaves in light: each lump again, up and to the left, leaving a dark rim
  for (let i = 0; i < LOBES.length; i++) lobe(i, -1, -1, -1, k.base);
  // the sunlit tops of the upper lumps
  const lit = Math.max(1, Math.round(R * 0.08));
  for (const i of [3, 1, 4]) lobe(i, -lit - 2, -2, -2, k.light);
  lobe(
    0,
    -Math.round(R * 0.42),
    -Math.round(R * 0.3),
    -Math.round(R * 0.36),
    k.light,
  );
  // glints on the brightest lump, and a few dark gaps between the leaves
  const hx = x - Math.round(R * 0.36 * flip) - (flip > 0 ? 1 : 0);
  const hy = cy - Math.round(R * 0.62);
  s.rect(hx, hy, 2, 1, k.hi);
  if (R >= 8) s.px(hx - 1 * flip + (flip > 0 ? 0 : 1), hy + 2, k.hi);
  if (R >= 6) {
    s.rect(
      x + Math.round(R * 0.18 * flip),
      cy + Math.round(R * 0.3),
      2,
      1,
      k.dark,
    );
    s.px(x - Math.round(R * 0.5 * flip), cy + Math.round(R * 0.5), k.dark);
  }
  if (R >= 10) {
    // clusters of leaves catching the light across the shaded side
    for (const [fx, fy] of [
      [0.42, 0.18],
      [-0.12, 0.42],
      [0.62, -0.18],
    ] as const) {
      s.rect(
        x + Math.round(fx * R * flip),
        cy + Math.round(fy * R),
        2,
        1,
        k.base,
      );
      s.px(x + Math.round(fx * R * flip), cy + Math.round(fy * R) - 1, k.light);
    }
    // a gap low in the leaves (never two side by side: no faces in the trees)
    s.px(x + Math.round(R * 0.62 * flip), cy + Math.round(R * 0.5), k.dark);
  }
}

/** A broadleaf tree's crown from above, standing on (x, y). */
export function tree(
  s: Surface,
  x: number,
  y: number,
  cls: 0 | 1 | 2,
  k: TreeLook,
  big = false,
): void {
  const turn = hash2(x, y, 77);
  if (cls === 0) {
    // a little round crown, 6 x 6 (8 wide when big)
    const w = big ? 8 : 6;
    const x0 = x - (big ? 4 : 2);
    s.rect(x0 + 1, y - 6, w - 2, 6, k.base);
    s.rect(x0, y - 5, w, 4, k.base);
    s.rect(x0 + 1, y - 2, w - 2, 1, k.dark);
    s.rect(x0 + w - 1, y - 4, 1, 3, k.dark);
    s.px(x0 + w - 2, y - 2, k.dark);
    s.rect(x0 + 1, y - 6, 2, 1, k.light);
    s.px(x0, y - 5, k.light);
    s.px(x0 + 1, y - 5, k.hi);
    return;
  }
  if (cls === 1) {
    const R = big ? 9 : 7;
    shadowBlob(s, x + 4, y, R, 3);
    // its lowest leaves on the row above the ground point
    crown(s, x, y - 1 - crownFoot(R), R, k, turn);
    return;
  }
  const R = big ? 13 : 11;
  shadowBlob(s, x + 6, y + 2, R, 5);
  // the trunk, where it meets the ground under the crown
  s.rect(x, y - 3, 2, 3, k.dark);
  crown(s, x, y - 3 - crownFoot(R), R, k, turn);
}

// ---------------------------------------------------------------------------
// Conifers and poplars
// ---------------------------------------------------------------------------

/** A conifer or poplar: tall and narrow. */
export function conifer(
  s: Surface,
  x: number,
  y: number,
  cls: 0 | 1 | 2,
  k: TreeLook,
): void {
  if (cls === 0) {
    s.rect(x, y - 8, 2, 8, k.dark);
    s.rect(x, y - 8, 1, 6, k.base);
    s.px(x, y - 8, k.light);
    return;
  }
  const hgt = cls === 1 ? 16 : 26;
  const most = cls === 1 ? 3 : 5;
  shadowBlob(s, x + 4, y, cls === 1 ? 4 : 6, 2);
  // tiers of branches, each wider at its foot, narrowing to a spire
  const tier = cls === 1 ? 4 : 5;
  for (let i = 0; i < hgt; i++) {
    const yy = y - hgt + i;
    const grow = Math.min(most, Math.floor((i + 2) / 3));
    const inTier = i % tier;
    const half = Math.max(1, grow - (inTier === 0 && i > 3 ? 1 : 0));
    // columns x - half + 1 .. x + half
    s.rect(x - half + 1, yy, half * 2, 1, k.dark);
    s.rect(x - half + 1, yy, half, 1, k.base);
    if (inTier === tier - 1 && half > 1) s.px(x - half + 1, yy, k.light);
    if (inTier === 2 && half > 1) s.px(x - half + 2, yy, k.light);
  }
  s.px(x, y - hgt, k.light);
  s.px(x + 1, y - hgt + 1, k.dark);
}

// ---------------------------------------------------------------------------
// Bushes
// ---------------------------------------------------------------------------

/** A bush or a clump of shrubs. */
export function bush(
  s: Surface,
  x: number,
  y: number,
  cls: 0 | 1 | 2,
  k: TreeLook,
): void {
  if (cls === 0) {
    s.rect(x, y - 2, 2, 2, k.dark);
    s.px(x, y - 2, k.base);
    return;
  }
  if (cls === 1) {
    // 6 x 4, two lumps
    s.rect(x - 2, y - 3, 6, 3, k.dark);
    s.rect(x - 1, y - 4, 4, 1, k.dark);
    s.rect(x - 2, y - 3, 3, 1, k.base);
    s.rect(x - 1, y - 4, 2, 1, k.base);
    s.px(x + 2, y - 3, k.base);
    s.px(x - 1, y - 4, k.light);
    s.rect(x - 1, y - 1, 4, 1, k.dark);
    return;
  }
  // 10 x 8: three lumps, lit on their upper left
  const turn = hash2(x, y, 78) < 0.5;
  s.disc(x - 2, y - 4, 3, k.dark);
  s.disc(x + 3, y - 4, 3, k.dark);
  s.disc(turn ? x : x + 1, y - 5, 3, k.dark);
  s.rect(x - 4, y - 3, 10, 3, k.dark);
  s.disc(x - 3, y - 5, 2, k.base);
  s.disc(x + 2, y - 5, 2, k.base);
  s.disc(turn ? x - 1 : x, y - 6, 2, k.base);
  s.rect(x - 4, y - 4, 3, 1, k.base);
  s.rect(turn ? x - 2 : x - 1, y - 8, 2, 1, k.light);
  s.px(x - 4, y - 6, k.light);
  s.px(x + 1, y - 7, k.light);
  s.px(turn ? x - 2 : x - 1, y - 8, k.hi);
}

/** What a sprite is drawn with: a surface, or a writer that lets nearer things hide it. */
export interface Ink {
  px(x: number, y: number, c: Color): void;
  rect(x: number, y: number, w: number, h: number, c: Color): void;
}

/** The static painter also drops a small shadow under near cars and coaches. */
let groundShadow: Surface | null = null;
export function castOn(s: Surface | null): void {
  groundShadow = s;
}

export interface CarLook {
  /** The body. */
  b: Color;
  /** The roof, a little lighter. */
  l: Color;
  /** The side in shade. */
  d: Color;
  /** Glass. */
  g: Color;
  /** Tyres. */
  k: Color;
  // (carLook fills these, stadium-town.ts)
  /** Deep shade: sills, bumpers, the grille. */
  n?: Color;
  /** Glass catching the sky. */
  w?: Color;
  /** Wheel hubs. */
  m?: Color;
  /** Headlamps and tail lamps by day. */
  y?: Color;
  q?: Color;
}

/**
 * A car from above, its ground point at (x, y), pointing `heading` on screen (0 east,
 * anticlockwise; the set and its sprites are in stadium-cars.ts).
 */
export function car(
  s: Ink,
  x: number,
  y: number,
  cls: 0 | 1 | 2,
  heading: number,
  k: CarLook,
  step?: Step,
): void {
  if (groundShadow) {
    const sh = carShadow(heading, cls, step);
    if (sh) shadowBlob(groundShadow, x + sh[0], y + sh[1], sh[2], sh[3]);
  }
  carSprite(s, x, y, cls, heading, k, step);
}

const shadowOut: [number, number, number, number] = [0, 0, 0, 0];
/**
 * A car's shadow on the ground, as `shadowBlob`'s offset from its ground point and its
 * radii, or null when it casts none: only the two nearest size steps (traffic-steps.ts;
 * `step` as `carSprite`'s) cast one, the smaller one a little smaller. The same object
 * every call.
 */
export function carShadow(
  heading: number,
  cls: 0 | 1 | 2,
  step?: Step,
): readonly [number, number, number, number] | null {
  const size = step ?? stepOfClass(cls);
  if (size < 3) return null;
  const along =
    Math.abs(Math.sin((headingAngle(heading) * Math.PI) / 180)) < 0.5;
  if (size === 4) {
    if (along) shadowOut.splice(0, 4, 2, 4, 8, 2);
    else shadowOut.splice(0, 4, 4, 6, 6, 2);
  } else if (along) shadowOut.splice(0, 4, 2, 3, 7, 1.5);
  else shadowOut.splice(0, 4, 3, 5, 5, 1.5);
  return shadowOut;
}

export interface CoachLook {
  roof: Color;
  roofHi: Color;
  side: Color;
  stripe: Color;
  glass: Color;
  tyre: Color;
  // (coachLook fills these, stadium-town.ts)
  glassHi?: Color;
  deep?: Color;
  hub?: Color;
  lamp?: Color;
  tail?: Color;
}

/** A coach or a bus from above, pointing east or west, centred on (x, y). */
export function coach(
  s: Ink,
  x: number,
  y: number,
  cls: 0 | 1 | 2,
  k: CoachLook,
): void {
  // the moving coach's drawing, parked east-west (stadium-cars.ts)
  if (groundShadow && cls === 1) shadowBlob(groundShadow, x + 2, y + 4, 12, 2);
  if (groundShadow && cls === 2) shadowBlob(groundShadow, x + 4, y + 8, 18, 3);
  coachSprite(s, x, y, cls, EAST, k);
}

/** A coach from above, pointing north or south, centred on (x, y). */
export function coachNS(
  s: Ink,
  x: number,
  y: number,
  cls: 0 | 1 | 2,
  north: boolean,
  k: CoachLook,
): void {
  if (groundShadow && cls === 1) shadowBlob(groundShadow, x + 4, y + 6, 6, 2);
  if (groundShadow && cls === 2) shadowBlob(groundShadow, x + 6, y + 12, 8, 3);
  coachSprite(s, x, y, cls, north ? NORTH : SOUTH, k);
}

export interface PersonLook {
  shirt: Color;
  hair: Color;
  skin: Color;
  legs: Color;
  // (personLook fills these, stadium-town.ts)
  shirtDark?: Color;
  shirtLight?: Color;
  skinDark?: Color;
  hairDark?: Color;
  legsDark?: Color;
  shoe?: Color;
  scarf?: Color;
  band?: Color;
  bobble?: Color;
  /** 0 short hair, 1 long hair, 2 a bobble hat. */
  head?: 0 | 1 | 2;
  /** 0 plain, 1 a scarf, 2 a steward's vest. */
  body?: 0 | 1 | 2;
}

/**
 * A person standing on (x, y). `step` 0 or 1 swaps the stride; `up` lifts them (a jump),
 * in canvas pixels. `back`: seen from behind, walking away up the screen. `size`: which of
 * the five sizes (traffic-steps.ts `sizeStep`); without it, the one that stands for `cls`.
 * The drawings are in stadium-people.ts.
 */
export function person(
  s: Ink,
  x: number,
  y: number,
  cls: 0 | 1 | 2,
  k: PersonLook,
  step = 0,
  up = 0,
  back = false,
  size?: Step,
): void {
  drawPerson(s, x, y, size ?? stepOfClass(cls), k, step, up, back);
}

/** The sprite size for something standing at this scale. */
export function clsOf(scale: number): 0 | 1 | 2 {
  return sizeClass(scale);
}

// ---------------------------------------------------------------------------
// Street lamps
// ---------------------------------------------------------------------------

/** What a street lamp is drawn with. */
export interface LampLook {
  /** The post's lit side, and its shaded side. */
  post: Color;
  postShade: Color;
  /** The head's housing. */
  cap: Color;
  /** The lamp itself: lit at night, a pale glass by day. */
  glow: Color;
  /** At night the lamp throws a few pixels of light round its glass. */
  night: boolean;
}

/**
 * How tall a lamp stands, by size class: a street lamp is about two and a half times as
 * tall as the people under it (a near person is 10 px, stadium-people.ts; a middle one 6). `tall`: the lamps of the main roads, the plaza and the car parks.
 */
export function lampHeight(cls: 0 | 1 | 2, tall: boolean): number {
  if (cls === 0) return tall ? 9 : 8;
  if (cls === 1) return tall ? 16 : 14;
  return tall ? 27 : 23;
}

/**
 * A street lamp standing on (x, y), its post on columns x and x + 1. `tall`: a column with
 * an arm reaching out over the road and a lamp hanging from it; otherwise a lantern on a
 * post (side streets, the park). `right`: which way the arm reaches.
 */
export function drawLamp(
  s: Surface,
  x: number,
  y: number,
  cls: 0 | 1 | 2,
  tall: boolean,
  k: LampLook,
  right = true,
): void {
  const hgt = lampHeight(cls, tall);
  const top = y - hgt;
  if (cls === 0) {
    // far away: a thin post and, at night, the light at its top
    s.rect(x, top + 1, 1, hgt - 1, k.post);
    s.rect(x, top, 2, 1, k.night ? k.glow : k.cap);
    return;
  }
  const dir = right ? 1 : -1;
  if (cls === 1) {
    s.rect(x, top + 1, 1, hgt - 1, k.post);
    s.rect(x + 1, top + 1, 1, hgt - 1, k.postShade);
    if (tall) {
      // the arm, and the lamp under its end
      const ax = right ? x + 2 : x - 3;
      s.rect(right ? x : x - 3, top, 5, 1, k.cap);
      s.rect(ax, top + 1, 3, 1, k.glow);
      if (k.night) s.px(ax + 1, top + 2, k.glow);
    } else {
      s.rect(x - 1, top - 1, 4, 1, k.cap);
      s.rect(x, top, 2, 1, k.glow);
    }
    return;
  }
  // near: a base, the column lit on its left, a collar halfway up
  s.rect(x - 1, y - 3, 4, 3, k.postShade);
  s.rect(x - 1, y - 3, 2, 2, k.post);
  s.rect(x, top + 2, 1, hgt - 5, k.post);
  s.rect(x + 1, top + 2, 1, hgt - 5, k.postShade);
  const collar = top + Math.round(hgt * 0.45);
  s.rect(x - 1, collar, 4, 1, k.postShade);
  s.px(x - 1, collar, k.post);
  if (tall) {
    // a swan neck: up, over and down to the lamp head reaching out over the road
    const ax = right ? x + 2 : x - 7;
    s.rect(x, top, 2, 2, k.post);
    s.px(x + 1, top + 1, k.postShade);
    s.rect(ax, top, 5, 1, k.post);
    s.rect(ax, top + 1, 5, 1, k.postShade);
    // the head: a dark hood over the lamp
    const hx = right ? x + 5 : x - 9;
    s.rect(hx, top + 1, 6, 2, k.cap);
    s.rect(hx + 1, top + 3, 4, 1, k.glow);
    if (k.night) {
      s.rect(hx + 2, top + 4, 2, 1, k.glow);
      s.px(hx, top + 3, k.glow);
      s.px(hx + 5, top + 3, k.glow);
    }
    void dir;
    return;
  }
  // a lantern: a cap, the glass, a finial
  s.rect(x, top + 1, 2, 1, k.postShade);
  s.rect(x - 1, top - 3, 4, 4, k.glow);
  s.rect(x - 2, top - 4, 6, 1, k.cap);
  s.rect(x - 1, top - 5, 4, 1, k.cap);
  s.px(x, top - 6, k.cap);
  s.rect(x - 1, top, 4, 1, k.cap);
  if (!k.night) {
    s.px(x + 2, top - 3, k.cap);
    s.px(x + 2, top - 2, k.cap);
  } else {
    s.px(x - 2, top - 2, k.glow);
    s.px(x + 3, top - 2, k.glow);
  }
}

// ---------------------------------------------------------------------------
// The life's small things (stadium-life.ts): flags, the tiny match, smoke
// ---------------------------------------------------------------------------

/**
 * A flag on its pole: the pole two pixels wide on columns x and x + 1 from the
 * ground at y up `pole` pixels, the cloth from column x + 2. `big`: 12 x 8, in three
 * panels that ripple one after the other as the wind lifts the fly end; otherwise 6 x 4,
 * its fly end flapping. `step` (0 to 3) is the wind's beat. Two bands of `b` across `a`.
 */
export function drawFlag(
  ink: Ink,
  x: number,
  y: number,
  pole: number,
  big: boolean,
  step: number,
  a: Color,
  b: Color,
  post: Color,
  postShade: Color,
): void {
  const top = y - pole;
  ink.rect(x, top, 1, pole, post);
  ink.rect(x + 1, top + 1, 1, pole - 1, postShade);
  ink.px(x + 1, top - 1, post);
  if (big) {
    const WAVE = [0, -1, 0, 1];
    for (let p = 0; p < 3; p++) {
      // the ripple runs out to the fly end, a panel behind the one before
      const lift = p === 0 ? 0 : WAVE[(step + 4 - p) % 4];
      const px0 = x + 2 + p * 4;
      const ty = top + lift;
      ink.rect(px0, ty, 4, 8, a);
      ink.rect(px0, ty, 4, 2, b);
      ink.rect(px0, ty + 4, 4, 2, b);
      // where a panel lifts above the one before it, the fold shows in shadow
      if (p > 0 && lift !== WAVE[(step + 5 - p) % 4]) {
        ink.rect(px0, ty + 2, 1, 2, b);
      }
    }
    return;
  }
  const lift = step % 2 === 0 ? 0 : 1;
  ink.rect(x + 2, top, 4, 4, a);
  ink.rect(x + 6, top + lift, 2, 4, a);
  ink.rect(x + 2, top, 4, 1, b);
  ink.rect(x + 6, top + lift, 2, 1, b);
  ink.rect(x + 2, top + 2, 2, 1, b);
}

/**
 * One of the tiny players on the aerial pitch, standing on (x, y): 2 wide and
 * 6 tall: a head with its hair, the shirt, shorts and a running stride (`stride` 0 or 1:
 * which foot leads; -1: he stands, both feet down), and a short shadow to the right.
 * `tall` false (a small view): only the shirt and head, 2 x 3.
 */
export function drawTinyPlayer(
  ink: Ink,
  x: number,
  y: number,
  tall: boolean,
  skin: Color,
  hair: Color,
  shirt: Color,
  shorts: Color,
  shade: Color,
  stride: number,
): void {
  if (!tall) {
    ink.rect(x, y - 3, 2, 2, shirt);
    ink.px(x, y - 4, skin);
    return;
  }
  ink.rect(x + 2, y, 2, 1, shade);
  ink.rect(x, y - 5, 2, 2, skin);
  ink.px(x, y - 5, hair);
  ink.px(x + 1, y - 5, hair);
  ink.rect(x, y - 3, 2, 2, shirt);
  ink.rect(x, y - 1, 2, 1, shorts);
  if (stride < 0) ink.rect(x, y, 2, 1, skin);
  else ink.px(x + (stride % 2), y, skin);
}

/** A puff of smoke, its top left at (x, y): small 2 x 2, middle 4 x 4, big 6 x 4. */
export function drawPuff(
  s: Ink,
  x: number,
  y: number,
  size: 0 | 1 | 2,
  c: Color,
): void {
  if (size === 0) {
    s.rect(x, y, 2, 2, c);
    return;
  }
  if (size === 1) {
    s.rect(x + 1, y, 2, 4, c);
    s.rect(x, y + 1, 4, 2, c);
    return;
  }
  s.rect(x + 1, y, 4, 4, c);
  s.rect(x, y + 1, 6, 2, c);
}

// ---------------------------------------------------------------------------
// The town's small parts (stadium-town.ts): windows, doors, chimneys, bins...
// ---------------------------------------------------------------------------

/**
 * A house window, 6 x 6 with its top left at (x, y): a frame,
 * four panes with the sky caught in the upper left one by day, a sill under it. Lit, the
 * panes glow and the glazing bars show dark.
 */
export function drawWindow(
  s: Surface,
  x: number,
  y: number,
  glass: Color,
  frame: Color,
  sky: Color,
  sill: Color,
  lit: boolean,
  bars: Color,
): void {
  s.rect(x, y, 6, 6, frame);
  s.rect(x + 1, y + 1, 4, 4, glass);
  if (lit) {
    s.rect(x + 1, y + 3, 4, 1, bars);
    s.rect(x + 3, y + 1, 1, 4, bars);
  } else {
    s.rect(x + 1, y + 1, 2, 2, sky);
    s.px(x + 1, y + 1, sill);
  }
  s.rect(x - 1, y + 6, 8, 1, sill);
}

/** A front door, 4 x 8 standing on `foot`: a fanlight, a knob, a step. */
export function drawDoor(
  s: Surface,
  x: number,
  foot: number,
  door: Color,
  shade: Color,
  glass: Color,
  knob: Color,
  step: Color,
): void {
  s.rect(x, foot - 8, 4, 8, door);
  s.rect(x + 3, foot - 7, 1, 7, shade);
  s.rect(x, foot - 8, 4, 1, glass);
  s.px(x + 2, foot - 4, knob);
  s.rect(x - 1, foot - 1, 6, 1, step);
}

/**
 * A chimney stack standing on the ridge at (x, y):
 * 4 x 8, lit on the left, a cap that oversails it, and two pots. Returns the top of the
 * pots, where the smoke starts.
 */
export function drawChimney(
  s: Surface,
  x: number,
  y: number,
  brick: Color,
  shade: Color,
  cap: Color,
  pot: Color,
): number {
  s.rect(x, y - 6, 4, 8, brick);
  s.rect(x + 3, y - 6, 1, 8, shade);
  s.rect(x, y - 3, 3, 1, shade);
  s.rect(x - 1, y - 8, 6, 2, cap);
  s.rect(x - 1, y - 7, 6, 1, shade);
  s.rect(x, y - 10, 1, 2, pot);
  s.rect(x + 2, y - 10, 2, 2, pot);
  s.px(x + 3, y - 10, shade);
  return y - 10;
}

/** A wheelie bin, 2 x 4 standing on (x, y): a lid, a body, a wheel. */
export function drawBin(
  s: Surface,
  x: number,
  y: number,
  body: Color,
  lid: Color,
  wheel: Color,
): void {
  s.rect(x, y - 4, 2, 4, body);
  s.rect(x, y - 4, 2, 1, lid);
  s.px(x + 1, y - 1, wheel);
}

/**
 * A garden parasol from above, its canopy's middle at (x, y) (
 * ellipse): eight panels in turn of two colours round a white finial.
 */
export function drawParasol(
  s: Surface,
  x: number,
  y: number,
  a: Color,
  b: Color,
  top: Color,
  edge: Color,
): void {
  s.ellipse(x, y, 8, 4, edge, true);
  s.ellipse(x, y - 1, 8, 4, a, true);
  // the panels: wedges of the second colour, every other one
  for (const [dx, dy, w] of [
    [-7, -1, 3],
    [-2, -5, 4],
    [5, -1, 3],
    [-2, 2, 4],
  ] as const) {
    s.rect(x + dx, y + dy, w, 2, b);
  }
  s.rect(x - 1, y - 2, 2, 2, top);
}

/** A bollard standing on (x, y): 2 x 4, a band. */
export function drawBollard(
  s: Surface,
  x: number,
  y: number,
  body: Color,
  shade: Color,
  band: Color,
  bandHi: Color,
): void {
  s.rect(x, y - 4, 2, 4, body);
  s.px(x + 1, y - 4, shade);
  s.rect(x, y - 6, 2, 2, band);
  s.px(x, y - 6, bandHi);
}
