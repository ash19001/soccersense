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
 * The legend is shared by every person:
 *
 *   k outline   h hair      s skin      S skin shade
 *   t shirt     T shirt shade           r trim (collar, cuffs, a stripe)
 *   p shorts    q shorts shade (derived) o socks     O socks shade (derived)
 *   b boots     g gloves    G glove shade (derived)
 */

import { sprite, type Sprite } from "~/pixel";

/** The slot letters, in the order of the colour array `drawPlayer` builds. */
export const LEGEND = "khsStTrpqoObgG";

/**
 * Parse fill art into frames of rows, outline it and build the sprite. Throws (naming the
 * frame and row) if a frame is not `cellW` x `cellH` or its outline would leave the cell.
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
