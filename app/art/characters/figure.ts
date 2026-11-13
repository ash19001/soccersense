/**
 * Figure art: sprites written as fill only, with the 1 px ink outline added here.
 *
 * Every character frame in this folder is drawn as its colour fill. `figure()` then puts an
 * outline (`k`) on every empty cell that touches a filled cell on one of its four sides, so
 * corners stay round and no frame can forget a pixel of outline. A `k` written in the art
 * is a hand-placed line (an eye, the edge of an arm in front of the body). A `,` is a cell
 * that must stay empty even beside a fill: that is how the outline is broken on the lit top
 * left, or a gap is kept open.
 *
 * The legend is shared by every person (adult, youth, keeper) and coloured by
 * `kitColors(kit)` (kit.ts): the kit's slots, then more tones of the same kit, each
 * derived from one of its slots.
 *
 *   k outline   h hair      s skin      S skin shade
 *   t shirt     T shirt shade           r trim (collar, cuffs, a stripe)
 *   p shorts    q shorts shade (derived) o socks     O socks shade (derived)
 *   b boots     g gloves    G glove shade (derived)
 *   H hair highlight   m skin dark (brow, mouth, ear, nostril)   U shirt highlight
 *   R trim shade       B boot highlight     w glove highlight     l skin highlight
 *   1 2 3 4 9 A C D    the era's own slots (`kit.eraColors`, graded; not B: the boot)
 *   5 6 7 8            the era's lights (`kit.eraGlows`, raw)
 *   (only an era's layer writes these: era-frames.ts, .snaps/era-art/THEME.md)
 *
 * Letters are only ever added at the end.
 */

import { sprite, type Sprite } from "~/pixel";

/** The slot letters, in the order of the colour array `kitColors` builds. */
export const LEGEND = "khsStTrpqoObgGHmURBwl123456789ACD";

/**
 * An animation's art: its frames joined by blank lines (fill only, as `figure()` reads
 * them), or a function that builds that string (called once, on first use, so nothing is
 * composed at load time).
 */
export type FrameArt = string | (() => string);

/** Art by animation name (one file holds some of a person's animations: moves, shots). */
export type ArtRecord<A extends string> = Partial<Record<A, FrameArt>>;

/** The art string behind a `FrameArt`. */
export function artText(art: FrameArt): string {
  return typeof art === "function" ? art() : art;
}

// ---------------------------------------------------------------------------
// Building frames from parts
// ---------------------------------------------------------------------------

/** A part: its rows, placed with its top-left at (col, row) in the cell. */
export type Part = readonly [rows: readonly string[], col: number, row: number];

/** The rows of a part written as a template string (blank lines and indentation dropped). */
export function rows(art: string): string[] {
  return art
    .split("\n")
    .map((r) => r.trim())
    .filter((r) => r !== "");
}

/**
 * Lay parts over an empty `w` x `h` cell in order (a later part covers an earlier one; a
 * part's "." is see-through, its "," punches a hole that stays empty). Throws if a part's
 * pixel falls outside the cell.
 */
export function compose(w: number, h: number, parts: readonly Part[]): string {
  const g: string[][] = [];
  for (let y = 0; y < h; y++) g.push(new Array<string>(w).fill("."));
  for (const [r, c0, r0] of parts) {
    r.forEach((line, dy) => {
      for (let dx = 0; dx < line.length; dx++) {
        const ch = line[dx];
        if (ch === ".") continue;
        const y = r0 + dy;
        const x = c0 + dx;
        if (y < 0 || y >= h || x < 0 || x >= w) {
          throw new Error(`compose: part pixel outside the cell at ${x},${y}`);
        }
        g[y][x] = ch;
      }
    });
  }
  return g.map((row) => row.join("")).join("\n");
}

/** Drop `n` rows of a part starting at row `at` (a body that settles by n pixels). */
export function squash(r: readonly string[], at: number, n: number): string[] {
  return [...r.slice(0, at), ...r.slice(at + n)];
}

/** Mirror a part left to right (an arm or leg drawn once, used on both sides). */
export function mirror(r: readonly string[]): string[] {
  return r.map((line) => Array.from(line).reverse().join(""));
}

/** Frames joined as `figure()` reads them. */
export function frames(list: readonly string[]): string {
  return list.join("\n\n");
}

/**
 * Parse fill art into frames of rows, outline it and build the sprite (in `LEGEND`).
 * Throws (naming the frame and row) if a frame is not `cellW` x `cellH` or its outline
 * would leave the cell.
 */
export function figure(
  art: string,
  cellW: number,
  cellH: number,
  name: string,
): Sprite {
  const frames: string[][] = [];
  let current: string[] | undefined;
  for (const raw of art.split("\n")) {
    const line = raw.trim();
    if (line === "") {
      current = undefined;
      continue;
    }
    if (current === undefined) {
      current = [];
      frames.push(current);
    }
    current.push(line);
  }
  const out: string[] = [];
  frames.forEach((rows, f) => {
    if (rows.length !== cellH) {
      throw new Error(
        `${name}: frame ${f} has ${rows.length} rows, not ${cellH}`,
      );
    }
    rows.forEach((row, r) => {
      if (row.length !== cellW) {
        throw new Error(
          `${name}: frame ${f}, row ${r} is ${row.length} wide, not ${cellW}`,
        );
      }
    });
    out.push(outline(rows, name, f).join("\n"));
  });
  return sprite(out.join("\n\n"), LEGEND);
}

function filled(ch: string | undefined): boolean {
  return ch !== undefined && ch !== "." && ch !== ",";
}

function outline(rows: string[], name: string, f: number): string[] {
  const h = rows.length;
  const w = rows[0].length;
  const grid = rows.map((row) => Array.from(row));
  const out = grid.map((row) => row.slice());
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = grid[y][x];
      if (ch === ",") {
        out[y][x] = ".";
        continue;
      }
      if (ch !== ".") continue;
      if (
        filled(grid[y - 1]?.[x]) ||
        filled(grid[y + 1]?.[x]) ||
        filled(grid[y][x - 1]) ||
        filled(grid[y][x + 1])
      ) {
        out[y][x] = "k";
      }
    }
  }
  // A fill on the cell's border would need its outline outside the cell.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = grid[y][x];
      if (!filled(ch) || ch === "k") continue;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) {
        throw new Error(
          `${name}: frame ${f}, row ${y}: a fill touches the cell's edge at column ${x}`,
        );
      }
    }
  }
  return out.map((row) => row.join(""));
}
