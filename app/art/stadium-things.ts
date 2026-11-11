/**
 * The small things the town is made of, as the camera sees them from above: buildings
 * (boxes with flat or pitched roofs, drawn through the projection so their roofs and
 * walls foreshorten properly), and fixed-size sprites in three sizes for trees, bushes,
 * cars, coaches, people and lamps. Nothing here is scaled smoothly.
 */

import { Surface, mix, shade, type Color, type Point } from "~/pixel";
import { P } from "~/art/palette";
import { projectRaw, sizeClass, type View } from "~/art/stadium-view";

// ---------------------------------------------------------------------------
// Pixels by rule: cast shadows and pools of light recolour what is already there
// ---------------------------------------------------------------------------

const darker = new Map<Color, Color>();
const warmer = new Map<Color, Color>();
const cooler = new Map<Color, Color>();

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
  }
  return o;
}

function coolOf(c: Color): Color {
  let o = cooler.get(c);
  if (o === undefined) {
    o = mix(shade(c, 0.34), P.steelHi, 0.22);
    cooler.set(c, o);
  }
  return o;
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

/** Put a polygon of the ground into cast shadow. */
export function shadowPoly(s: Surface, pts: ReadonlyArray<Point>): void {
  const d = s.data;
  spans(pts, s.w, s.h, (y, x0, x1) => {
    const row = y * s.w;
    for (let x = x0; x <= x1; x++) {
      const c = d[row + x] as Color;
      if (c !== 0) d[row + x] = darkOf(c);
    }
  });
}

/** A small round shadow on the ground. */
export function shadowBlob(
  s: Surface,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
): void {
  const d = s.data;
  for (let y = Math.ceil(cy - ry); y <= Math.floor(cy + ry); y++) {
    if (y < 0 || y >= s.h) continue;
    const t = ry <= 0 ? 0 : (y - cy) / ry;
    const half = rx * Math.sqrt(Math.max(0, 1 - t * t));
    for (let x = Math.ceil(cx - half); x <= Math.floor(cx + half); x++) {
      if (x < 0 || x >= s.w) continue;
      const c = d[y * s.w + x] as Color;
      if (c !== 0) d[y * s.w + x] = darkOf(c);
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

/** A broadleaf tree's crown from above, standing on (x, y). */
export function tree(
  s: Surface,
  x: number,
  y: number,
  cls: 0 | 1 | 2,
  k: TreeLook,
  big = false,
): void {
  if (cls === 0) {
    s.rect(x - 1, y - 3, 3, 3, k.base);
    s.px(x + 1, y - 1, k.dark);
    s.px(x - 1, y - 3, k.light);
    if (big) {
      s.rect(x - 2, y - 2, 1, 2, k.base);
      s.px(x + 2, y - 2, k.dark);
    }
    return;
  }
  if (cls === 1) {
    const r = big ? 4 : 3;
    shadowBlob(s, x + 2, y, r, 1.5);
    s.disc(x, y - r - 1, r, k.dark);
    s.disc(x - 1, y - r - 2, r - 1, k.base);
    s.rect(x - 2, y - r - 3, 2, 2, k.light);
    if (big) s.px(x - 2, y - r - 4, k.hi);
    return;
  }
  const r = big ? 6 : 5;
  shadowBlob(s, x + 3, y + 1, r, 2.5);
  s.disc(x, y - r - 1, r, k.dark);
  s.disc(x - 1, y - r - 2, r - 1, k.base);
  s.disc(x - 2, y - r - 3, r - 3, k.light);
  s.rect(x - 3, y - r - 4, 2, 1, k.hi);
  // a notch of shade so the crown is not a perfect ball
  s.px(x + 1, y - r, k.dark);
  s.px(x + r - 2, y - r - 3, k.dark);
}

/** A conifer or poplar: tall and narrow. */
export function conifer(
  s: Surface,
  x: number,
  y: number,
  cls: 0 | 1 | 2,
  k: TreeLook,
): void {
  if (cls === 0) {
    s.rect(x, y - 4, 1, 4, k.dark);
    s.px(x, y - 4, k.base);
    return;
  }
  const hgt = cls === 1 ? 8 : 13;
  shadowBlob(s, x + 2, y, cls === 1 ? 2 : 3, 1);
  for (let i = 0; i < hgt; i++) {
    const half = Math.min(cls === 1 ? 1 : 2, Math.floor((i + 1) / 3));
    s.rect(x - half, y - hgt + i, half * 2 + 1, 1, k.dark);
    if (half > 0) s.px(x - half, y - hgt + i, k.base);
  }
  s.px(x, y - hgt, k.base);
}

/** A bush or a clump of shrubs. */
export function bush(
  s: Surface,
  x: number,
  y: number,
  cls: 0 | 1 | 2,
  k: TreeLook,
): void {
  if (cls === 0) {
    s.px(x, y - 1, k.dark);
    return;
  }
  if (cls === 1) {
    s.rect(x - 1, y - 2, 3, 2, k.dark);
    s.px(x - 1, y - 2, k.base);
    return;
  }
  s.rect(x - 2, y - 3, 5, 3, k.dark);
  s.rect(x - 1, y - 4, 3, 1, k.base);
  s.rect(x - 2, y - 3, 2, 1, k.base);
  s.px(x - 1, y - 4, k.light);
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
}

/**
 * A car from above, centred on (x, y) on the ground. `dir`: 0 pointing east, 1 west,
 * 2 north (away), 3 south (towards the camera).
 */
export function car(
  s: Ink,
  x: number,
  y: number,
  cls: 0 | 1 | 2,
  dir: number,
  k: CarLook,
): void {
  const ew = dir < 2;
  if (cls === 0) {
    if (ew) {
      s.rect(x - 1, y - 1, 3, 1, k.l);
      s.rect(x - 1, y, 3, 1, k.d);
    } else {
      s.rect(x, y - 2, 2, 2, k.l);
      s.rect(x, y, 2, 1, k.d);
    }
    return;
  }
  if (cls === 1) {
    if (ew) {
      s.rect(x - 2, y - 2, 5, 2, k.b);
      s.rect(x - 1, y - 2, 3, 1, k.l);
      const front = dir === 0 ? x + 1 : x - 1;
      s.px(front, y - 2, k.g);
      s.rect(x - 2, y, 5, 1, k.d);
    } else {
      s.rect(x - 1, y - 3, 3, 4, k.b);
      s.rect(x - 1, y - 2, 3, 1, k.g);
      s.px(x, y - 1, k.l);
      s.rect(x - 1, y + 1, 3, 1, k.d);
    }
    return;
  }
  if (ew) {
    if (groundShadow) shadowBlob(groundShadow, x + 1, y + 2, 4, 1);
    s.rect(x - 3, y - 2, 7, 2, k.b);
    s.rect(x - 1, y - 2, 3, 2, k.l);
    const front = dir === 0 ? x + 2 : x - 2;
    const back = dir === 0 ? x - 2 : x + 2;
    s.rect(front, y - 2, 1, 2, k.g);
    s.px(back, y - 2, k.g);
    s.rect(x - 3, y, 7, 1, k.d);
    s.px(x - 2, y + 1, k.k);
    s.px(x + 2, y + 1, k.k);
    s.rect(x - 1, y + 1, 3, 1, k.d);
    return;
  }
  if (groundShadow) shadowBlob(groundShadow, x + 2, y + 3, 3, 1);
  s.rect(x - 1, y - 4, 4, 7, k.b);
  s.rect(x - 1, y - (dir === 2 ? 3 : 0), 4, 1, k.g);
  s.rect(x - 1, y - (dir === 2 ? 0 : 3), 4, 1, k.g);
  s.rect(x, y - 2, 2, 2, k.l);
  s.rect(x - 1, y + 3, 4, 1, k.d);
}

export interface CoachLook {
  roof: Color;
  roofHi: Color;
  side: Color;
  stripe: Color;
  glass: Color;
  tyre: Color;
}

/** A coach or a bus from above, pointing east or west, centred on (x, y). */
export function coach(
  s: Ink,
  x: number,
  y: number,
  cls: 0 | 1 | 2,
  k: CoachLook,
): void {
  if (cls === 0) {
    s.rect(x - 3, y - 2, 6, 2, k.roof);
    s.rect(x - 3, y, 6, 1, k.stripe);
    return;
  }
  if (cls === 1) {
    if (groundShadow) shadowBlob(groundShadow, x + 1, y + 2, 6, 1);
    s.rect(x - 5, y - 3, 11, 3, k.roof);
    s.rect(x - 4, y - 3, 9, 1, k.roofHi);
    s.px(x - 2, y - 2, k.glass);
    s.px(x + 2, y - 2, k.glass);
    s.rect(x - 5, y, 11, 1, k.glass);
    s.rect(x - 5, y + 1, 11, 1, k.stripe);
    return;
  }
  if (groundShadow) shadowBlob(groundShadow, x + 2, y + 4, 9, 1.5);
  s.rect(x - 8, y - 4, 17, 4, k.roof);
  s.rect(x - 7, y - 4, 15, 1, k.roofHi);
  s.rect(x - 4, y - 3, 2, 1, k.glass);
  s.rect(x + 3, y - 3, 2, 1, k.glass);
  s.rect(x - 8, y, 17, 1, k.glass);
  s.rect(x - 8, y + 1, 17, 1, k.side);
  s.rect(x - 8, y + 2, 17, 1, k.stripe);
  s.px(x - 5, y + 3, k.tyre);
  s.px(x + 5, y + 3, k.tyre);
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
  if (cls === 0) {
    s.rect(x, y - 3, 2, 4, k.roof);
    s.rect(x, y + 1, 2, 1, k.stripe);
    return;
  }
  if (cls === 1) {
    if (groundShadow) shadowBlob(groundShadow, x + 2, y + 3, 3, 1);
    s.rect(x - 1, y - 5, 4, 8, k.roof);
    s.rect(x - 1, y - 5, 1, 8, k.roofHi);
    s.rect(x - 1, north ? y - 5 : y + 2, 4, 1, k.glass);
    s.rect(x - 1, y + 3, 4, 1, k.stripe);
    return;
  }
  if (groundShadow) shadowBlob(groundShadow, x + 3, y + 6, 4, 1.5);
  s.rect(x - 2, y - 8, 6, 13, k.roof);
  s.rect(x - 2, y - 8, 1, 13, k.roofHi);
  s.rect(x - 1, north ? y - 7 : y + 3, 4, 1, k.glass);
  s.rect(x, y - 3, 2, 2, k.glass);
  s.rect(x - 2, y + 5, 6, 1, k.side);
  s.rect(x - 2, y + 6, 6, 1, k.stripe);
}

export interface PersonLook {
  shirt: Color;
  hair: Color;
  skin: Color;
  legs: Color;
}

/** A person standing on (x, y). `step` 0 or 1 swaps the stride; `up` lifts them (a jump). */
export function person(
  s: Ink,
  x: number,
  y: number,
  cls: 0 | 1 | 2,
  k: PersonLook,
  step = 0,
  up = 0,
): void {
  const b = y - up;
  if (cls === 0) {
    s.px(x, b - 2, k.skin);
    s.px(x, b - 1, k.shirt);
    return;
  }
  if (cls === 1) {
    s.px(x, b - 3, k.hair);
    s.px(x, b - 2, k.shirt);
    s.px(x, b - 1, k.legs);
    if (step) s.px(x + 1, b - 2, k.shirt);
    return;
  }
  s.px(x, b - 5, k.hair);
  s.px(x, b - 4, k.skin);
  s.rect(x - 1, b - 3, 3, 2, k.shirt);
  if (step) {
    s.px(x, b - 1, k.legs);
  } else {
    s.px(x - 1, b - 1, k.legs);
    s.px(x + 1, b - 1, k.legs);
  }
}

/** The sprite size for something standing at this scale. */
export function clsOf(scale: number): 0 | 1 | 2 {
  return sizeClass(scale);
}
