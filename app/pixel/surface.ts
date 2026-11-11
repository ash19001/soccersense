/**
 * Surface: the software framebuffer every scene and painter draws into.
 *
 * Rules that hold for every method:
 * - Coordinates and sizes are rounded to whole pixels with `Math.round`.
 * - Drawing is clipped to the surface and to the current clip rect (`clip` / `unclip`).
 * - No drawing call throws on odd input. A zero or negative size, a shape that is completely
 *   outside, or a NaN anywhere simply draws nothing.
 * - Drawing with `TRANSPARENT` is a no-op (use `erase` or `clear` to remove pixels).
 * - There is no blending: a pixel is replaced or left alone. Where a shape takes a dither
 *   `level` (0..1) it is painted through the Bayer 4x4 pattern instead: 1 is solid, 0.5 a
 *   checkerboard, 0.25 a regular grid of dots on every second row and column. The pattern
 *   is anchored to the surface, not to the shape, so a dithered shadow that moves does not
 *   flicker and neighbouring dithers line up.
 */

import { TRANSPARENT, type Color } from "./color";

export interface BlitOptions {
  /** Source rectangle. Defaults to the whole source surface. */
  sx?: number;
  sy?: number;
  sw?: number;
  sh?: number;
  /** Mirror the source rectangle left to right. */
  flipX?: boolean;
  /** Mirror the source rectangle top to bottom. */
  flipY?: boolean;
}

/** A pixel position, `[x, y]`. Annotate point lists with it: `const roof: Point[] = [...]`. */
export type Point = readonly [number, number];

export interface BandOptions {
  /**
   * Where each band ends and the next begins, as fractions of the height from 0 (top) to
   * 1 (bottom). One fewer than the number of colours. Default: equal heights.
   */
  stops?: readonly number[];
  /**
   * How many rows either side of each boundary are dithered between the two bands.
   * Default 2. 0 gives hard edges. See `Surface.bands` for what the rows look like.
   */
  dither?: number;
}

// Bayer 4x4 ordered-dither matrix, row-major.
const BAYER = new Uint8Array([
  0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5,
]);

// ROW_MASK[n * 4 + (y & 3)] has bit (x & 3) set when the pixel is one of the first n of the
// 16 cells to switch on. It lets the dither loops test a pixel with one shift and mask.
const ROW_MASK = new Uint8Array(17 * 4);
for (let n = 0; n <= 16; n++) {
  for (let row = 0; row < 4; row++) {
    let mask = 0;
    for (let col = 0; col < 4; col++) {
      if (BAYER[row * 4 + col] < n) mask |= 1 << col;
    }
    ROW_MASK[n * 4 + row] = mask;
  }
}

/** How many of the 16 Bayer cells are on at `level` (0..1). NaN counts as 0. */
function ditherSteps(level: number): number {
  const n = Math.ceil(level * 16 - 0.5);
  return n > 16 ? 16 : n > 0 ? n : 0;
}

/**
 * The dither pattern for one row of a band edge, as a mask over `x & 7`: a set bit takes
 * the neighbouring band's colour. `d` is the row's distance from the boundary (0 for the
 * two rows that touch it), `k` the number of dithered rows on each side, and `above` says
 * which side of the boundary the row is on.
 *
 * Rows run from a checkerboard next to the boundary, through one dot in four, to one dot
 * in eight at the far edge. They are placed relative to the boundary, never to the
 * surface, so every band edge looks the same wherever it falls. Dots on neighbouring rows
 * are staggered so they form a lattice instead of streaks.
 */
function edgeMask(d: number, k: number, above: boolean): number {
  const checkers = Math.floor(0.25 * k + 0.5);
  if (d < checkers) return ((checkers - 1 - d) & 1) === 0 ? 0xaa : 0x55;
  const e = d - checkers;
  const col = ((e & 1) === 0) === above ? 0 : 2;
  if ((2 * (k - d - 0.5)) / k >= 0.5) return 0x11 << col;
  return 1 << (col + (((e >> 1) & 1) << 2));
}

/** Fill pixels `x0` (included) to `x1` (not included) of a row through a 4-bit dither mask. */
function span(
  data: Uint32Array,
  row: number,
  x0: number,
  x1: number,
  c: number,
  mask: number,
): void {
  if (mask === 15) {
    for (let i = row + x0, end = row + x1; i < end; i++) data[i] = c;
  } else if (mask !== 0) {
    for (let x = x0; x < x1; x++) {
      if ((mask >> (x & 3)) & 1) data[row + x] = c;
    }
  }
}

/**
 * The Bayer 4x4 threshold (0..1, never exactly 0 or 1) for a pixel, anchored to absolute
 * surface coordinates. Paint a pixel when `bayer4(x, y) < coverage` to get the same pattern
 * as `Surface.dither`, so hand-rolled dithers line up with everything else.
 * `x` and `y` must be whole numbers.
 */
export function bayer4(x: number, y: number): number {
  return (BAYER[((y & 3) << 2) | (x & 3)] + 0.5) / 16;
}

/*
 * Circle convention (disc, circle, ellipse)
 * -----------------------------------------
 * A radius r gives a shape exactly `round(2r) + 1` pixels across, whose left edge is
 * `round(cx - r)` (and the same vertically):
 *
 *   - Whole radius: odd diameter, centred on the pixel (cx, cy).
 *     disc(10, 10, 3) covers x = 7..13.
 *   - Radius ending in .5: even diameter. The true centre is then the corner shared by
 *     four pixels, so with a whole-number centre the extra column and row go to the right
 *     and bottom: disc(10, 10, 1.5) covers x = 9..12. Pass a centre ending in .5 to say
 *     the same thing explicitly: disc(10.5, 10.5, 1.5) is identical.
 *   - Radius 0 is a single pixel, 0.5 is a 2 x 2 block, 1 is a 3 x 3 plus.
 *
 * A pixel is inside when its centre is within the shape (u^2 + v^2 <= d^2, in half-pixel
 * units from the true centre, d = diameter). That test is symmetric in all eight octants,
 * so every disc is too. A few small diameters get a hand-picked limit (DISC_LIMIT) where
 * the plain rule gives an octagon or a square. `circle` draws exactly the edge pixels of
 * `disc` (the pixels with an empty neighbour above, below, left or right), so the two
 * always register, and the outline is a thin one with diagonal steps.
 *
 * An ellipse uses the same bounding-box rule on each axis. Its middle row always spans the
 * full width and its middle column the full height, so thin ellipses (ground shadows) keep
 * their stated size. An ellipse with equal radii is the disc.
 */
const DISC_LIMIT: Record<number, number> = {
  3: 5, // a plus, not a 3 x 3 square
  9: 76, // edge runs 3,2,2,3, not a rounded square (5,1,5)
  14: 186, // edge runs 4,2,1,1,2,4, not an octagon (6,1,1,1,6)
};

const MAX_ROUND_SIZE = 1 << 15;
/** The largest width or height a surface may have. */
const MAX_SURFACE_SIZE = 1 << 14;

/** Pixels trimmed from each end of row `j` of a `wd` x `hd` ellipse. */
function rowInset(j: number, wd: number, hd: number, limit: number): number {
  const v = 2 * j - (hd - 1); // twice the distance from the centre line
  if (v >= -1 && v <= 1) return 0; // the middle row or rows are always full width
  const parity = (wd - 1) & 1; // u has the same parity as wd - 1
  const room = wd === hd ? limit - v * v : wd * wd * (1 - (v * v) / (hd * hd));
  let u = room > 0 ? Math.floor(Math.sqrt(room)) : 0;
  if ((u & 1) !== parity) u--;
  if (u < parity) u = parity; // at least the middle one or two pixels
  if (u > wd - 1) u = wd - 1;
  return (wd - 1 - u) / 2;
}

// Scratch space for poly and bands, so they allocate nothing per call.
let polyX = new Float64Array(64);
let polyY = new Float64Array(64);
let crossings = new Float64Array(64);
let bandEdges = new Float64Array(64);
// Scratch space for recolor: what each distinct colour maps to.
const recolorMap = new Map<number, number>();

export class Surface {
  readonly w: number;
  readonly h: number;
  /** One packed `Color` per pixel, row by row from the top left. */
  readonly data: Uint32Array<ArrayBuffer>;
  /**
   * The same memory as RGBA bytes, ready for `new ImageData(surface.bytes, w, h)`.
   * It is a view, not a copy: it always shows the current pixels.
   */
  readonly bytes: Uint8ClampedArray<ArrayBuffer>;

  /**
   * The current clip rect: x from `clipX0` up to (not including) `clipX1`, and the same
   * for y. Read-only for callers: change it with `clip` and `unclip`. Exposed so code that
   * writes to `data` directly (text, sprites) can respect it.
   */
  clipX0 = 0;
  clipY0 = 0;
  clipX1: number;
  clipY1: number;

  private readonly clipStack: number[] = [];

  /**
   * A transparent surface. Width and height are rounded and are at least 1, so a zero,
   * negative or NaN size gives a 1 x 1 surface. A size above 16384 throws a `RangeError`:
   * that is always a bug, and the memory would not be there anyway.
   */
  constructor(w: number, h: number) {
    this.w = Math.max(1, Math.round(w) || 1);
    this.h = Math.max(1, Math.round(h) || 1);
    if (!(this.w <= MAX_SURFACE_SIZE && this.h <= MAX_SURFACE_SIZE)) {
      throw new RangeError(
        `Surface: ${w} x ${h} is too large (the limit is ${MAX_SURFACE_SIZE} each way)`,
      );
    }
    this.data = new Uint32Array(this.w * this.h);
    this.bytes = new Uint8ClampedArray(this.data.buffer);
    this.clipX1 = this.w;
    this.clipY1 = this.h;
  }

  /** A separate copy of the pixels (the clip rect is not copied). */
  clone(): Surface {
    const out = new Surface(this.w, this.h);
    out.data.set(this.data);
    return out;
  }

  /** Fill the whole surface, ignoring the clip rect. Default: transparent. */
  clear(c: Color = TRANSPARENT): void {
    this.data.fill(c);
  }

  /**
   * Restrict all drawing to this rectangle (intersected with the surface). This replaces
   * the current clip rect, so it is for whoever owns the surface (a scene, a shot). A
   * painter that wants to clip its own drawing should use `pushClip` and `popClip`, which
   * respect a clip the caller has already set.
   */
  clip(x: number, y: number, w: number, h: number): void {
    x = Math.round(x);
    y = Math.round(y);
    const x0 = Math.max(0, x);
    const y0 = Math.max(0, y);
    const x1 = Math.min(this.w, x + Math.round(w));
    const y1 = Math.min(this.h, y + Math.round(h));
    if (x0 < x1 && y0 < y1) {
      this.clipX0 = x0;
      this.clipY0 = y0;
      this.clipX1 = x1;
      this.clipY1 = y1;
    } else {
      // Empty or nonsense: nothing can be drawn until unclip().
      this.clipX0 = this.clipY0 = this.clipX1 = this.clipY1 = 0;
    }
  }

  /** Remove the clip rect: drawing covers the whole surface again. */
  unclip(): void {
    this.clipX0 = 0;
    this.clipY0 = 0;
    this.clipX1 = this.w;
    this.clipY1 = this.h;
  }

  /**
   * Narrow the clip rect to the part of this rectangle that is inside the current clip,
   * and remember the old one. Every `pushClip` needs a matching `popClip`:
   *
   * ```ts
   * s.pushClip(x, y, w, h);
   * drawText(s, name, x - scroll, y, amber); // cannot spill out of the panel
   * s.popClip();
   * ```
   */
  pushClip(x: number, y: number, w: number, h: number): void {
    const x0 = this.clipX0;
    const y0 = this.clipY0;
    const x1 = this.clipX1;
    const y1 = this.clipY1;
    this.clipStack.push(x0, y0, x1, y1);
    this.clip(x, y, w, h);
    const nx0 = Math.max(x0, this.clipX0);
    const ny0 = Math.max(y0, this.clipY0);
    const nx1 = Math.min(x1, this.clipX1);
    const ny1 = Math.min(y1, this.clipY1);
    if (nx0 < nx1 && ny0 < ny1) {
      this.clipX0 = nx0;
      this.clipY0 = ny0;
      this.clipX1 = nx1;
      this.clipY1 = ny1;
    } else {
      this.clipX0 = this.clipY0 = this.clipX1 = this.clipY1 = 0;
    }
  }

  /**
   * Put back the clip rect that was current before the matching `pushClip`. With nothing
   * to pop it removes the clip rect.
   */
  popClip(): void {
    const stack = this.clipStack;
    if (stack.length < 4) {
      this.unclip();
      return;
    }
    this.clipY1 = stack.pop() as number;
    this.clipX1 = stack.pop() as number;
    this.clipY0 = stack.pop() as number;
    this.clipX0 = stack.pop() as number;
  }

  /** Set one pixel. */
  px(x: number, y: number, c: Color): void {
    if (c === TRANSPARENT) return;
    x = Math.round(x);
    y = Math.round(y);
    if (
      x >= this.clipX0 &&
      x < this.clipX1 &&
      y >= this.clipY0 &&
      y < this.clipY1
    ) {
      this.data[y * this.w + x] = c;
    }
  }

  /** Read one pixel. `TRANSPARENT` outside the surface. Not affected by the clip rect. */
  get(x: number, y: number): Color {
    x = Math.round(x);
    y = Math.round(y);
    if (x >= 0 && x < this.w && y >= 0 && y < this.h) {
      return this.data[y * this.w + x] as Color;
    }
    return TRANSPARENT;
  }

  /** Filled rectangle. */
  rect(x: number, y: number, w: number, h: number, c: Color): void {
    if (c === TRANSPARENT) return;
    this.fill(x, y, w, h, c);
  }

  /** Make a rectangle transparent again (for punching holes in a cached layer). */
  erase(x: number, y: number, w: number, h: number): void {
    this.fill(x, y, w, h, TRANSPARENT);
  }

  private fill(x: number, y: number, w: number, h: number, c: Color): void {
    x = Math.round(x);
    y = Math.round(y);
    const x0 = Math.max(this.clipX0, x);
    const y0 = Math.max(this.clipY0, y);
    const x1 = Math.min(this.clipX1, x + Math.round(w));
    const y1 = Math.min(this.clipY1, y + Math.round(h));
    if (!(x0 < x1 && y0 < y1)) return;
    const data = this.data;
    const W = this.w;
    if (x1 - x0 < 12) {
      for (let yy = y0; yy < y1; yy++) {
        const end = yy * W + x1;
        for (let i = yy * W + x0; i < end; i++) data[i] = c;
      }
    } else {
      for (let yy = y0; yy < y1; yy++) {
        data.fill(c, yy * W + x0, yy * W + x1);
      }
    }
  }

  /** Rectangle outline, 1 px thick, drawn inside the given bounds. */
  frame(x: number, y: number, w: number, h: number, c: Color): void {
    if (c === TRANSPARENT) return;
    x = Math.round(x);
    y = Math.round(y);
    w = Math.round(w);
    h = Math.round(h);
    if (!(w > 0 && h > 0)) return;
    this.fill(x, y, w, 1, c);
    if (h > 1) this.fill(x, y + h - 1, w, 1, c);
    if (h > 2) {
      this.fill(x, y + 1, 1, h - 2, c);
      if (w > 1) this.fill(x + w - 1, y + 1, 1, h - 2, c);
    }
  }

  /** Horizontal run of `len` pixels starting at (x, y) and going right. */
  hline(x: number, y: number, len: number, c: Color): void {
    if (c === TRANSPARENT) return;
    x = Math.round(x);
    y = Math.round(y);
    if (!(y >= this.clipY0 && y < this.clipY1)) return;
    const x0 = Math.max(this.clipX0, x);
    const x1 = Math.min(this.clipX1, x + Math.round(len));
    if (!(x0 < x1)) return;
    const data = this.data;
    const end = y * this.w + x1;
    for (let i = y * this.w + x0; i < end; i++) data[i] = c;
  }

  /** Vertical run of `len` pixels starting at (x, y) and going down. */
  vline(x: number, y: number, len: number, c: Color): void {
    if (c === TRANSPARENT) return;
    x = Math.round(x);
    y = Math.round(y);
    if (!(x >= this.clipX0 && x < this.clipX1)) return;
    const y0 = Math.max(this.clipY0, y);
    const y1 = Math.min(this.clipY1, y + Math.round(len));
    if (!(y0 < y1)) return;
    const data = this.data;
    const W = this.w;
    const end = y1 * W + x;
    for (let i = y0 * W + x; i < end; i += W) data[i] = c;
  }

  /**
   * A 1 px line that includes both end points.
   *
   * It takes exactly one pixel per step along its longer axis. When the ideal line passes
   * exactly between two pixels, the one nearer the closer end point wins. That makes
   * `line(a, b)` identical to `line(b, a)`, and makes mirrored lines exact mirror images,
   * so symmetric shapes (roofs, pylons, nets) stay symmetric.
   */
  line(x0: number, y0: number, x1: number, y1: number, c: Color): void {
    this.stroke(x0, y0, x1, y1, c, 16);
  }

  /** `line`, painted through the dither pattern for `steps` sixteenths. */
  private stroke(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    c: Color,
    steps: number,
  ): void {
    if (c === TRANSPARENT || steps === 0) return;
    const full = steps === 16;
    const pattern = steps * 4;
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    if (!Number.isFinite(x0 + y0 + x1 + y1)) return;
    const adx = Math.abs(x1 - x0);
    const ady = Math.abs(y1 - y0);
    const data = this.data;
    const W = this.w;
    const cx0 = this.clipX0;
    const cy0 = this.clipY0;
    const cx1 = this.clipX1;
    const cy1 = this.clipY1;
    if (adx >= ady) {
      // Mostly horizontal: walk left to right from (xa, ya).
      const swap = x1 < x0;
      const xa = swap ? x1 : x0;
      const ya = swap ? y1 : y0;
      if (adx === 0) {
        if (
          xa >= cx0 &&
          xa < cx1 &&
          ya >= cy0 &&
          ya < cy1 &&
          (full || (ROW_MASK[pattern + (ya & 3)] >> (xa & 3)) & 1)
        ) {
          data[ya * W + xa] = c;
        }
        return;
      }
      const sy = (swap ? y0 : y1) < ya ? -1 : 1;
      const den = 2 * adx;
      const i0 = Math.max(0, cx0 - xa);
      const i1 = Math.min(adx, cx1 - 1 - xa);
      for (let i = i0; i <= i1; i++) {
        const num = 2 * i * ady + adx;
        let q = Math.floor(num / den);
        if (num % den === 0 && 2 * i < adx) q--;
        const y = ya + sy * q;
        if (
          y >= cy0 &&
          y < cy1 &&
          (full || (ROW_MASK[pattern + (y & 3)] >> ((xa + i) & 3)) & 1)
        ) {
          data[y * W + xa + i] = c;
        }
      }
    } else {
      // Mostly vertical: walk top to bottom from (xa, ya).
      const swap = y1 < y0;
      const xa = swap ? x1 : x0;
      const ya = swap ? y1 : y0;
      const sx = (swap ? x0 : x1) < xa ? -1 : 1;
      const den = 2 * ady;
      const i0 = Math.max(0, cy0 - ya);
      const i1 = Math.min(ady, cy1 - 1 - ya);
      for (let i = i0; i <= i1; i++) {
        const num = 2 * i * adx + ady;
        let q = Math.floor(num / den);
        if (num % den === 0 && 2 * i < ady) q--;
        const x = xa + sx * q;
        if (
          x >= cx0 &&
          x < cx1 &&
          (full || (ROW_MASK[pattern + ((ya + i) & 3)] >> (x & 3)) & 1)
        ) {
          data[(ya + i) * W + x] = c;
        }
      }
    }
  }

  /**
   * Filled circle. See the circle convention at the top of this file. A `level` below 1
   * dithers it. Stack two or three for a glow: `disc(x, y, 12, c, 0.25)`, then
   * `disc(x, y, 8, c, 0.5)`, then `disc(x, y, 4, c)`.
   */
  disc(cx: number, cy: number, r: number, c: Color, level = 1): void {
    this.ellipse(cx, cy, r, r, c, true, level);
  }

  /** Circle outline: exactly the edge pixels of `disc` with the same arguments. */
  circle(cx: number, cy: number, r: number, c: Color): void {
    this.ellipse(cx, cy, r, r, c, false);
  }

  /**
   * Ellipse, outlined by default, filled when `filled` is true.
   * See the circle convention at the top of this file. A `level` below 1 dithers it:
   * `ellipse(x, groundY, 6, 1.5, shadow, true, 0.5)` is a soft ground shadow.
   */
  ellipse(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    c: Color,
    filled = false,
    level = 1,
  ): void {
    if (c === TRANSPARENT || !(rx >= 0 && ry >= 0)) return;
    const steps = ditherSteps(level);
    if (steps === 0) return;
    const pattern = steps * 4;
    const left = Math.round(cx - rx);
    const top = Math.round(cy - ry);
    const wd = Math.round(2 * rx) + 1;
    const hd = Math.round(2 * ry) + 1;
    if (!(wd <= MAX_ROUND_SIZE && hd <= MAX_ROUND_SIZE)) return;
    const cx0 = this.clipX0;
    const cx1 = this.clipX1;
    const j0 = Math.max(0, this.clipY0 - top);
    const j1 = Math.min(hd, this.clipY1 - top);
    if (!(j0 < j1 && left < cx1 && left + wd > cx0)) return;
    const limit = DISC_LIMIT[wd] ?? wd * wd;
    const data = this.data;
    const W = this.w;
    for (let j = j0; j < j1; j++) {
      const inset = rowInset(j, wd, hd, limit);
      const xa = left + inset;
      const xb = left + wd - inset; // exclusive
      const row = (top + j) * W;
      const mask = steps === 16 ? 15 : ROW_MASK[pattern + ((top + j) & 3)];
      if (!filled) {
        // Edge pixels: the row's two ends, plus whatever sticks out past the rows
        // above and below.
        const above = j > 0 ? rowInset(j - 1, wd, hd, limit) : wd;
        const below = j < hd - 1 ? rowInset(j + 1, wd, hd, limit) : wd;
        const reach = Math.max(above, below, inset + 1);
        const leftEnd = left + reach; // exclusive
        const rightStart = left + wd - reach;
        if (leftEnd < rightStart) {
          span(data, row, Math.max(xa, cx0), Math.min(leftEnd, cx1), c, mask);
          span(
            data,
            row,
            Math.max(rightStart, cx0),
            Math.min(xb, cx1),
            c,
            mask,
          );
          continue;
        }
      }
      span(data, row, Math.max(xa, cx0), Math.min(xb, cx1), c, mask);
    }
  }

  /**
   * Filled polygon. Concave shapes are fine (even-odd rule). The points are pixels, and
   * the fill includes them and the edges between them, so `poly(points, c)` covers
   * everything `polyline(points, c, true)` draws plus the inside. One point is a pixel and
   * two are a line. A `level` below 1 dithers the whole shape (a floodlight beam, a pane
   * of glass, a soft shadow).
   */
  poly(points: ReadonlyArray<Point>, c: Color, level = 1): void {
    const n = points.length;
    const steps = ditherSteps(level);
    if (c === TRANSPARENT || n === 0 || steps === 0) return;
    const pattern = steps * 4;
    if (polyX.length < n) {
      polyX = new Float64Array(n * 2);
      polyY = new Float64Array(n * 2);
      crossings = new Float64Array(n * 2);
    }
    let minY = Infinity;
    let maxY = -Infinity;
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const x = Math.round(points[i][0]);
      const y = Math.round(points[i][1]);
      polyX[i] = x;
      polyY[i] = y;
      sum += x + y;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    if (!Number.isFinite(sum)) return;
    const data = this.data;
    const W = this.w;
    const cx0 = this.clipX0;
    const cx1 = this.clipX1;
    const yStart = Math.max(minY, this.clipY0);
    const yEnd = Math.min(maxY, this.clipY1 - 1);
    for (let y = yStart; y <= yEnd; y++) {
      // Where does this row cross each edge? An edge owns its top end but not its bottom.
      let count = 0;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const ya = polyY[j];
        const yb = polyY[i];
        if (ya === yb) continue;
        if (y >= Math.min(ya, yb) && y < Math.max(ya, yb)) {
          const xa = polyX[j];
          const v = xa + ((y - ya) * (polyX[i] - xa)) / (yb - ya);
          // Insertion sort: polygons have few crossings per row.
          let k = count++;
          while (k > 0 && crossings[k - 1] > v) {
            crossings[k] = crossings[k - 1];
            k--;
          }
          crossings[k] = v;
        }
      }
      const row = y * W;
      const mask = steps === 16 ? 15 : ROW_MASK[pattern + (y & 3)];
      for (let k = 0; k + 1 < count; k += 2) {
        const a = Math.max(cx0, Math.ceil(crossings[k]));
        const b = Math.min(cx1 - 1, Math.floor(crossings[k + 1]));
        span(data, row, a, b + 1, c, mask);
      }
    }
    // The edges themselves, so the fill and the outline always agree.
    for (let i = 0, j = n - 1; i < n; j = i++) {
      this.stroke(polyX[j], polyY[j], polyX[i], polyY[i], c, steps);
    }
  }

  /** Connected 1 px lines through the points. `closed` joins the last back to the first. */
  polyline(points: ReadonlyArray<Point>, c: Color, closed = false): void {
    const n = points.length;
    if (c === TRANSPARENT || n === 0) return;
    if (n === 1) {
      this.px(points[0][0], points[0][1], c);
      return;
    }
    for (let i = 1; i < n; i++) {
      this.line(
        points[i - 1][0],
        points[i - 1][1],
        points[i][0],
        points[i][1],
        c,
      );
    }
    if (closed && n > 2) {
      this.line(
        points[n - 1][0],
        points[n - 1][1],
        points[0][0],
        points[0][1],
        c,
      );
    }
  }

  /**
   * Draw `src` (or a rectangle of it) with its top left at (dx, dy), skipping transparent
   * pixels. With a flip, the source rectangle is mirrored in place: it still lands on the
   * same destination rectangle. `src` may be this surface (that costs a temporary copy).
   */
  blit(src: Surface, dx: number, dy: number, opts?: BlitOptions): void {
    let sx = 0;
    let sy = 0;
    let sw = src.w;
    let sh = src.h;
    let flipX = false;
    let flipY = false;
    if (opts !== undefined) {
      if (opts.sx !== undefined) sx = Math.round(opts.sx);
      if (opts.sy !== undefined) sy = Math.round(opts.sy);
      sw = opts.sw !== undefined ? Math.round(opts.sw) : src.w - sx;
      sh = opts.sh !== undefined ? Math.round(opts.sh) : src.h - sy;
      flipX = opts.flipX === true;
      flipY = opts.flipY === true;
    }
    dx = Math.round(dx);
    dy = Math.round(dy);
    // (i, j) counts across and down the destination rectangle. Keep the part that is inside
    // the clip rect and whose source pixel exists.
    const i0 = Math.max(0, this.clipX0 - dx, flipX ? sx + sw - src.w : -sx);
    const i1 = Math.min(sw, this.clipX1 - dx, flipX ? sx + sw : src.w - sx);
    const j0 = Math.max(0, this.clipY0 - dy, flipY ? sy + sh - src.h : -sy);
    const j1 = Math.min(sh, this.clipY1 - dy, flipY ? sy + sh : src.h - sy);
    if (!(i0 < i1 && j0 < j1)) return;
    // Drawing a surface onto itself reads from a snapshot, so nothing is read after it
    // has been overwritten.
    const from = src === this ? src.data.slice() : src.data;
    const to = this.data;
    const SW = src.w;
    const W = this.w;
    for (let j = j0; j < j1; j++) {
      const srow = (flipY ? sy + sh - 1 - j : sy + j) * SW;
      let di = (dy + j) * W + dx + i0;
      const end = di + (i1 - i0);
      if (flipX) {
        let si = srow + sx + sw - 1 - i0;
        for (; di < end; di++, si--) {
          const v = from[si];
          if (v !== 0) to[di] = v;
        }
      } else {
        let si = srow + sx + i0;
        for (; di < end; di++, si++) {
          const v = from[si];
          if (v !== 0) to[di] = v;
        }
      }
    }
  }

  /**
   * Copy all of `src` with its top left at (dx, dy), replacing what was there, transparent
   * pixels included. This is the fast way to put a cached layer down as the first thing in
   * a frame. Clip first to copy only part of it. `src` may be this surface (that scrolls
   * the picture, at the cost of a temporary copy).
   */
  copy(src: Surface, dx = 0, dy = 0): void {
    dx = Math.round(dx);
    dy = Math.round(dy);
    const x0 = Math.max(this.clipX0, dx);
    const y0 = Math.max(this.clipY0, dy);
    const x1 = Math.min(this.clipX1, dx + src.w);
    const y1 = Math.min(this.clipY1, dy + src.h);
    if (!(x0 < x1 && y0 < y1)) return;
    if (src === this && dx === 0 && dy === 0) return;
    const from = src === this ? src.data.slice() : src.data;
    const to = this.data;
    const SW = src.w;
    const W = this.w;
    if (SW === W && dx === 0 && x0 === 0 && x1 === W) {
      // Whole rows of both surfaces: one block copy.
      if (dy === 0 && y0 === 0 && y1 === this.h && src.h === this.h) {
        to.set(from);
      } else {
        to.set(from.subarray((y0 - dy) * SW, (y1 - dy) * SW), y0 * W);
      }
      return;
    }
    const len = x1 - x0;
    for (let y = y0; y < y1; y++) {
      let si = (y - dy) * SW + (x0 - dx);
      let di = y * W + x0;
      const end = di + len;
      for (; di < end; di++, si++) to[di] = from[si];
    }
  }

  /**
   * Paint colour `c` over the existing pixels with coverage `level`: 0 paints nothing,
   * 1 paints the whole rectangle, 0.5 a checkerboard. The Bayer 4x4 pattern is anchored to
   * absolute surface coordinates, so neighbouring dithers line up.
   */
  dither(
    x: number,
    y: number,
    w: number,
    h: number,
    c: Color,
    level: number,
  ): void {
    if (c === TRANSPARENT) return;
    const steps = ditherSteps(level);
    if (steps === 0) return;
    if (steps === 16) {
      this.fill(x, y, w, h, c);
      return;
    }
    x = Math.round(x);
    y = Math.round(y);
    const x0 = Math.max(this.clipX0, x);
    const y0 = Math.max(this.clipY0, y);
    const x1 = Math.min(this.clipX1, x + Math.round(w));
    const y1 = Math.min(this.clipY1, y + Math.round(h));
    if (!(x0 < x1 && y0 < y1)) return;
    const data = this.data;
    const W = this.w;
    for (let yy = y0; yy < y1; yy++) {
      const mask = ROW_MASK[steps * 4 + (yy & 3)];
      if (mask === 0) continue;
      const row = yy * W;
      for (let xx = x0; xx < x1; xx++) {
        if ((mask >> (xx & 3)) & 1) data[row + xx] = c;
      }
    }
  }

  /**
   * A vertical gradient as flat bands, `colors[0]` at the top and the last colour at the
   * bottom, with an ordered dither on the rows either side of each boundary.
   *
   * With the default `dither: 2` each boundary is four rows: one dot in four of the lower
   * colour, a two-row checkerboard across the boundary, then one dot in four of the upper
   * colour. `dither: 1` is just the two dotted rows; 3 and more add sparser rows outside.
   * The rows are placed relative to the boundary, so an edge looks the same at any height
   * and any canvas size. Across, the pattern is anchored to the surface, so two calls side
   * by side join up. A dither zone never reaches past the middle of a band.
   *
   * `opts.stops` must have one entry fewer than `colors` (anything else is ignored and
   * the bands get equal heights).
   *
   * A `TRANSPARENT` band leaves the existing pixels alone, dithered edge included, so a
   * glow can fade out into whatever is already there.
   */
  bands(
    x: number,
    y: number,
    w: number,
    h: number,
    colors: readonly Color[],
    opts?: BandOptions,
  ): void {
    const n = colors.length;
    x = Math.round(x);
    y = Math.round(y);
    h = Math.round(h);
    const x0 = Math.max(this.clipX0, x);
    const y0 = Math.max(this.clipY0, y);
    const x1 = Math.min(this.clipX1, x + Math.round(w));
    const y1 = Math.min(this.clipY1, y + h);
    if (n === 0 || !(x0 < x1 && y0 < y1) || !Number.isFinite(y + h)) return;

    // bandEdges[i] is the first row (relative to y) of band i; bandEdges[n] is h.
    if (bandEdges.length < n + 1) bandEdges = new Float64Array((n + 1) * 2);
    const edges = bandEdges;
    const stops = opts?.stops;
    const useStops = stops !== undefined && stops.length === n - 1;
    edges[0] = 0;
    for (let i = 1; i < n; i++) {
      const f = useStops ? stops[i - 1] : i / n;
      const e = Math.round((f > 1 ? 1 : f > 0 ? f : 0) * h);
      edges[i] = e > edges[i - 1] ? e : edges[i - 1];
    }
    edges[n] = h;

    let soft = Math.round(opts?.dither ?? 2);
    if (!(soft > 0)) soft = 0;

    const data = this.data;
    const W = this.w;
    let i = 0;
    for (let yy = y0; yy < y1; yy++) {
      const j = yy - y;
      while (i < n - 1 && j >= edges[i + 1]) i++;
      const base = colors[i];
      let over = base;
      let mask = 0;
      if (soft > 0) {
        const half = Math.floor((edges[i + 1] - edges[i]) / 2);
        const up = j - edges[i]; // 0 on the band's first row
        const down = edges[i + 1] - 1 - j; // 0 on the band's last row
        // A dither zone never reaches past the middle of a band.
        if (i > 0) {
          const above = Math.floor((edges[i] - edges[i - 1]) / 2);
          const k = Math.min(soft, half, above);
          if (up < k) {
            over = colors[i - 1];
            mask = edgeMask(up, k, false);
          }
        }
        if (mask === 0 && i < n - 1) {
          const below = Math.floor((edges[i + 2] - edges[i + 1]) / 2);
          const k = Math.min(soft, half, below);
          if (down < k) {
            over = colors[i + 1];
            mask = edgeMask(down, k, true);
          }
        }
      }
      const row = yy * W;
      if (mask === 0 || over === base) {
        if (base !== 0) data.fill(base, row + x0, row + x1);
      } else {
        for (let xx = x0; xx < x1; xx++) {
          const v = (mask >> (xx & 7)) & 1 ? over : base;
          if (v !== 0) data[row + xx] = v;
        }
      }
    }
  }

  /**
   * Call `fn(x, y)` once for every pixel of the rectangle that survives clipping and paint
   * what it returns. Returning `TRANSPARENT` leaves that pixel alone. `x` and `y` are
   * absolute surface coordinates. This is the escape hatch for anything the other calls
   * cannot do (a shaded sphere, a mask, a hand-rolled dither with `bayer4`). It costs a
   * function call per pixel, about 0.05 ms for 100 x 100 before your own maths, so use it
   * for cached layers and small areas, not for the whole screen every frame.
   */
  shadeRect(
    x: number,
    y: number,
    w: number,
    h: number,
    fn: (x: number, y: number) => Color,
  ): void {
    x = Math.round(x);
    y = Math.round(y);
    const x0 = Math.max(this.clipX0, x);
    const y0 = Math.max(this.clipY0, y);
    const x1 = Math.min(this.clipX1, x + Math.round(w));
    const y1 = Math.min(this.clipY1, y + Math.round(h));
    if (!(x0 < x1 && y0 < y1)) return;
    const data = this.data;
    const W = this.w;
    for (let yy = y0; yy < y1; yy++) {
      const row = yy * W;
      for (let xx = x0; xx < x1; xx++) {
        const v = fn(xx, yy);
        if (v !== 0) data[row + xx] = v;
      }
    }
  }

  /**
   * Replace every colour in a rectangle (default: the whole surface) with `fn(colour)`.
   * `fn` is called once per distinct colour, not once per pixel, so it can be as slow as
   * `shade` or a lighting grade. Transparent pixels are left alone and never passed in;
   * returning `TRANSPARENT` erases that colour.
   *
   * ```ts
   * layer.recolor(light.env); // grade a layer that was painted in daylight colours
   * s.recolor((c) => shade(c, 0.5)); // a flash
   * s.recolor((c) => (c === kitRed ? kitBlue : c), x, y, 16, 20); // a palette swap
   * ```
   */
  recolor(
    fn: (c: Color) => Color,
    x = 0,
    y = 0,
    w: number = this.w,
    h: number = this.h,
  ): void {
    x = Math.round(x);
    y = Math.round(y);
    const x0 = Math.max(this.clipX0, x);
    const y0 = Math.max(this.clipY0, y);
    const x1 = Math.min(this.clipX1, x + Math.round(w));
    const y1 = Math.min(this.clipY1, y + Math.round(h));
    if (!(x0 < x1 && y0 < y1)) return;
    const data = this.data;
    const W = this.w;
    const map = recolorMap;
    map.clear();
    let last = 0;
    let lastOut = 0;
    for (let yy = y0; yy < y1; yy++) {
      const end = yy * W + x1;
      for (let i = yy * W + x0; i < end; i++) {
        const v = data[i];
        if (v === 0) continue;
        if (v !== last) {
          let out = map.get(v);
          if (out === undefined) {
            out = fn(v as Color) >>> 0;
            map.set(v, out);
          }
          last = v;
          lastOut = out;
        }
        if (lastOut !== v) data[i] = lastOut;
      }
    }
    map.clear();
  }

  /**
   * Give everything on this surface a 1 px outline: paint `c` on every transparent pixel
   * that touches a painted one (above, below, left or right, and diagonally too with
   * `corners`). For shapes built from rects and discs on a layer of their own (a coach, a
   * trophy, the ball), which then get the art bible's ink outline in one call.
   *
   * The shape needs a 1 px transparent margin, because there is nowhere to put an outline
   * outside the surface. Only pixels inside the clip rect are painted.
   */
  outline(c: Color, corners = false): void {
    if (c === TRANSPARENT) return;
    const W = this.w;
    const H = this.h;
    const data = this.data;
    const src = data.slice();
    for (let y = this.clipY0; y < this.clipY1; y++) {
      const up = y > 0;
      const down = y < H - 1;
      for (let x = this.clipX0; x < this.clipX1; x++) {
        const i = y * W + x;
        if (src[i] !== 0) continue;
        const left = x > 0;
        const right = x < W - 1;
        if (
          (left && src[i - 1] !== 0) ||
          (right && src[i + 1] !== 0) ||
          (up && src[i - W] !== 0) ||
          (down && src[i + W] !== 0) ||
          (corners &&
            ((up && left && src[i - W - 1] !== 0) ||
              (up && right && src[i - W + 1] !== 0) ||
              (down && left && src[i + W - 1] !== 0) ||
              (down && right && src[i + W + 1] !== 0)))
        ) {
          data[i] = c;
        }
      }
    }
  }

  /**
   * Keep only what lies under the painted pixels of `shape` (placed with its top left at
   * (dx, dy)) and erase the rest. This clips a layer to any shape: draw a crowd on one
   * surface, the stand's polygon on another, then `crowd.mask(stand)`.
   * Only pixels inside the clip rect are touched.
   */
  mask(shape: Surface, dx = 0, dy = 0): void {
    this.stencil(shape, dx, dy, true);
  }

  /**
   * Erase what lies under the painted pixels of `shape` (placed with its top left at
   * (dx, dy)): the opposite of `mask`. For punching a hole of any shape (a crescent moon,
   * a tunnel mouth, an arch). Only pixels inside the clip rect are touched.
   */
  cut(shape: Surface, dx = 0, dy = 0): void {
    this.stencil(shape, dx, dy, false);
  }

  private stencil(shape: Surface, dx: number, dy: number, keep: boolean): void {
    dx = Math.round(dx);
    dy = Math.round(dy);
    if (!Number.isFinite(dx + dy)) return;
    const from = shape === this ? shape.data.slice() : shape.data;
    const SW = shape.w;
    const SH = shape.h;
    const data = this.data;
    const W = this.w;
    const x0 = this.clipX0;
    const x1 = this.clipX1;
    for (let y = this.clipY0; y < this.clipY1; y++) {
      const sy = y - dy;
      const row = y * W;
      if (sy < 0 || sy >= SH) {
        if (keep) data.fill(0, row + x0, row + x1);
        continue;
      }
      const srow = sy * SW - dx;
      for (let x = x0; x < x1; x++) {
        const sx = x - dx;
        const covered = sx >= 0 && sx < SW && from[srow + x] !== 0;
        if (covered !== keep) data[row + x] = 0;
      }
    }
  }
}
