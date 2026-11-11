/**
 * Sprites written as text, so the art lives in the code and reads like the picture.
 *
 * ```ts
 * const BALL = sprite(
 *   `
 * .ww.
 * wwkw
 * wkww
 * .ww.
 * `,
 *   "wk",
 * );
 * drawSprite(s, BALL, 0, x, y, [white, ink]);
 * ```
 *
 * The legend names the characters used in the art: its first character is painted with
 * `colors[0]`, the second with `colors[1]`, and so on. '.' and ' ' are transparent.
 * Because colours are supplied at draw time, one sprite serves every kit and every
 * time of day.
 */

import { TRANSPARENT, type Color } from "./color";
import type { Surface } from "./surface";

export interface Sprite {
  readonly w: number;
  readonly h: number;
  /** One array per frame, row by row. 0 is transparent, otherwise legend index + 1. */
  readonly frames: Uint8Array[];
  /** The legend the sprite was made with: character `i` is painted with `colors[i]`. */
  readonly legend: string;
}

export interface SpriteOptions {
  /**
   * Mirror left to right (a character facing the other way). The sprite is mirrored
   * inside its own box, so it covers exactly the same pixels flipped or not.
   */
  flipX?: boolean;
  /** Mirror top to bottom, inside the same box. */
  flipY?: boolean;
  /**
   * What (x, y) means.
   * - `"top-left"` (default): the sprite's top left pixel.
   * - `"bottom-center"`: the pixel directly under the middle of the sprite's bottom row,
   *   so y is the ground line and the sprite stands on it (its bottom row is y - 1 and
   *   its left edge is x - floor(w / 2)).
   * - `"center"`: the sprite's middle pixel (its left edge is x - floor(w / 2) and its
   *   top edge y - floor(h / 2)). For balls, sparks, anything thrown.
   */
  anchor?: "top-left" | "bottom-center" | "center";
  /** Whole-number magnification. Default 1. */
  scale?: number;
}

/**
 * Parse sprite art.
 *
 * - Frames are separated by one or more blank lines. Blank lines at the start and end are
 *   ignored. (So a fully transparent row must be written with dots, not left empty.)
 * - Every row of every frame must be the same width and every frame the same height.
 * - Indentation shared by every row is ignored, so the art may be indented along with the
 *   code around it. Write transparent pixels at the left edge as dots, not spaces.
 * - Any character other than '.', ' ' or one from the legend is an error.
 *
 * Errors name the frame and row, both counted from 0.
 */
export function sprite(art: string, legend: string): Sprite {
  const keys = Array.from(legend);
  if (keys.length > 255) {
    throw new Error("sprite: the legend can have at most 255 characters");
  }
  const index = new Map<string, number>();
  keys.forEach((key, i) => {
    if (key === "." || key === " " || key === "\t") {
      throw new Error(
        `sprite: "${key}" is always transparent and cannot be in the legend`,
      );
    }
    if (index.has(key)) {
      throw new Error(
        `sprite: "${key}" appears twice in the legend "${legend}"`,
      );
    }
    index.set(key, i + 1);
  });

  // Group the lines into frames, and find the indentation every row shares.
  const frameRows: string[][] = [];
  let current: string[] | undefined;
  let indent = Infinity;
  for (const raw of art.split("\n")) {
    const line = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
    if (line.trim() === "") {
      current = undefined;
      continue;
    }
    if (line.includes("\t")) {
      throw new Error("sprite: the art contains a tab; indent with spaces");
    }
    if (current === undefined) {
      current = [];
      frameRows.push(current);
    }
    current.push(line);
    indent = Math.min(indent, line.length - line.trimStart().length);
  }
  if (frameRows.length === 0) throw new Error("sprite: the art is empty");

  const w = Array.from(frameRows[0][0]).length - indent;
  const h = frameRows[0].length;
  const frames: Uint8Array[] = [];
  frameRows.forEach((rows, f) => {
    if (rows.length !== h) {
      throw new Error(
        `sprite: frame ${f} has ${rows.length} rows but frame 0 has ${h}`,
      );
    }
    const cells = new Uint8Array(w * h);
    rows.forEach((row, r) => {
      const chars = Array.from(row.slice(indent));
      if (chars.length !== w) {
        throw new Error(
          `sprite: frame ${f}, row ${r} is ${chars.length} wide but the first row is ${w}`,
        );
      }
      chars.forEach((ch, x) => {
        if (ch === "." || ch === " ") return;
        const value = index.get(ch);
        if (value === undefined) {
          throw new Error(
            `sprite: unknown character "${ch}" in frame ${f}, row ${r} (the legend is "${legend}")`,
          );
        }
        cells[r * w + x] = value;
      });
    });
    frames.push(cells);
  });
  return { w, h, frames, legend };
}

/**
 * The `colors` array for a sprite, built from names instead of positions, so a kit reads
 * `spriteColors(PLAYER, { o: ink, h: hair, s: skin, k: shirt })` and cannot get out of step
 * with the legend. A legend character that is left out is not drawn. A key that is not in
 * the legend is an error (it is always a typo).
 *
 * Build each kit once and keep it; do not call this for every sprite on every frame.
 */
export function spriteColors(
  sp: Sprite,
  byChar: Readonly<Record<string, Color>>,
): Color[] {
  const keys = Array.from(sp.legend);
  for (const key of Object.keys(byChar)) {
    if (!keys.includes(key)) {
      throw new Error(
        `spriteColors: "${key}" is not in the sprite's legend "${sp.legend}"`,
      );
    }
  }
  return keys.map((key) => byChar[key] ?? TRANSPARENT);
}

// Colours for the sprite being drawn, indexed by cell value, so the inner loop is a
// single typed-array lookup. Entry 0 stays transparent.
const lut = new Uint32Array(256);
let lutUsed = 0;

/**
 * Draw one frame of a sprite.
 *
 * `frame` wraps round, so a running counter can be passed straight in. `colors[i]` paints
 * the legend's character `i`; a `TRANSPARENT` (or missing) entry leaves that part out,
 * which is how one sprite can have optional pieces. Passing one colour for every entry
 * draws a flat silhouette (a shadow, a white hit flash).
 */
export function drawSprite(
  s: Surface,
  sp: Sprite,
  frame: number,
  x: number,
  y: number,
  colors: readonly Color[],
  opts?: SpriteOptions,
): void {
  const count = sp.frames.length;
  let f = Math.floor(frame) % count;
  if (f < 0) f += count;
  const cells = sp.frames[f];
  if (cells === undefined) return; // frame was NaN

  const k = Math.round(opts?.scale ?? 1);
  const scale = k >= 1 ? k : 1;
  const w = sp.w;
  const h = sp.h;
  x = Math.round(x);
  y = Math.round(y);
  const anchor = opts?.anchor;
  if (anchor === "bottom-center") {
    x -= Math.floor((w * scale) / 2);
    y -= h * scale;
  } else if (anchor === "center") {
    x -= Math.floor((w * scale) / 2);
    y -= Math.floor((h * scale) / 2);
  }
  const flipX = opts?.flipX === true;
  const flipY = opts?.flipY === true;

  const used = Math.min(colors.length, 255);
  for (let i = 0; i < used; i++) lut[i + 1] = colors[i];
  if (lutUsed > used) lut.fill(0, used + 1, lutUsed + 1);
  lutUsed = used;

  const data = s.data;
  const W = s.w;
  const cx0 = s.clipX0;
  const cy0 = s.clipY0;
  const cx1 = s.clipX1;
  const cy1 = s.clipY1;

  if (scale === 1) {
    const i0 = Math.max(0, cx0 - x);
    const i1 = Math.min(w, cx1 - x);
    const j0 = Math.max(0, cy0 - y);
    const j1 = Math.min(h, cy1 - y);
    if (!(i0 < i1 && j0 < j1)) return;
    for (let j = j0; j < j1; j++) {
      const srow = (flipY ? h - 1 - j : j) * w;
      let di = (y + j) * W + x + i0;
      const end = di + (i1 - i0);
      if (flipX) {
        let si = srow + w - 1 - i0;
        for (; di < end; di++, si--) {
          const v = lut[cells[si]];
          if (v !== 0) data[di] = v;
        }
      } else {
        let si = srow + i0;
        for (; di < end; di++, si++) {
          const v = lut[cells[si]];
          if (v !== 0) data[di] = v;
        }
      }
    }
    return;
  }

  if (!Number.isFinite(x + y)) return;
  // Only the source cells whose blocks can touch the clip rect.
  const i0 = Math.max(0, Math.floor((cx0 - x) / scale));
  const i1 = Math.min(w, Math.ceil((cx1 - x) / scale));
  const j0 = Math.max(0, Math.floor((cy0 - y) / scale));
  const j1 = Math.min(h, Math.ceil((cy1 - y) / scale));
  for (let j = j0; j < j1; j++) {
    const srow = (flipY ? h - 1 - j : j) * w;
    // One rectangle per run of cells that share a colour.
    for (let i = i0; i < i1;) {
      const v = lut[cells[srow + (flipX ? w - 1 - i : i)]];
      let run = 1;
      while (
        i + run < i1 &&
        lut[cells[srow + (flipX ? w - 1 - i - run : i + run)]] === v
      ) {
        run++;
      }
      if (v !== 0) {
        s.rect(x + i * scale, y + j * scale, run * scale, scale, v as Color);
      }
      i += run;
    }
  }
}

/** A sprite's frame count, for `frameAt(t, fps, frameCount(sp))`. */
export function frameCount(sp: Sprite): number {
  return sp.frames.length;
}
