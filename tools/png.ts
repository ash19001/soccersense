/**
 * PNG output for the snap tool. Node only: never import this from `app/`.
 */

import { crc32, deflateSync } from "node:zlib";

import {
  FONT_3x5,
  Surface,
  TRANSPARENT,
  drawText,
  measureText,
  type Color,
} from "~/pixel";

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function chunk(type: string, body: Buffer): Buffer {
  const out = Buffer.alloc(body.length + 12);
  out.writeUInt32BE(body.length, 0);
  out.write(type, 4, "latin1");
  body.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + body.length)), 8 + body.length);
  return out;
}

/**
 * Encode a surface as an 8-bit RGBA PNG, magnified `scale` times with nearest-neighbour
 * (every logical pixel becomes a `scale` x `scale` block). Transparent pixels stay
 * transparent.
 */
export function encodePng(surface: Surface, scale = 1): Buffer {
  const k = Math.max(1, Math.round(scale) || 1);
  const { w, h, data } = surface;
  const stride = w * k * 4 + 1; // one filter byte, then the row
  const raw = Buffer.alloc(stride * h * k);
  for (let y = 0; y < h; y++) {
    const start = y * k * stride;
    let o = start + 1; // filter byte stays 0 (None)
    for (let x = 0; x < w; x++) {
      const v = data[y * w + x];
      const r = v & 0xff;
      const g = (v >>> 8) & 0xff;
      const b = (v >>> 16) & 0xff;
      const a = v >>> 24;
      for (let n = 0; n < k; n++) {
        raw[o++] = r;
        raw[o++] = g;
        raw[o++] = b;
        raw[o++] = a;
      }
    }
    for (let n = 1; n < k; n++) {
      raw.copy(raw, start + n * stride, start, start + stride);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(w * k, 0);
  header.writeUInt32BE(h * k, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // colour type: RGBA
  header[10] = 0; // compression
  header[11] = 0; // filter
  header[12] = 0; // no interlace
  return Buffer.concat([
    SIGNATURE,
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

export interface RowOptions {
  /** Pixels between neighbours. Default 2. */
  gap?: number;
  /** Backdrop, visible in the gaps and behind transparent pixels. Default transparent. */
  bg?: Color;
}

/** Lay surfaces out left to right, tops aligned. Used for animation strips. */
export function sideBySide(
  surfaces: readonly Surface[],
  opts?: RowOptions,
): Surface {
  const gap = opts?.gap ?? 2;
  let width = 0;
  let height = 1;
  for (const s of surfaces) {
    width += s.w;
    if (s.h > height) height = s.h;
  }
  width += gap * Math.max(0, surfaces.length - 1);
  const out = new Surface(width, height);
  out.clear(opts?.bg ?? TRANSPARENT);
  let x = 0;
  for (const s of surfaces) {
    out.blit(s, x, 0);
    x += s.w + gap;
  }
  return out;
}

export interface SheetOptions {
  /** Pixels between cells. Default 4. */
  gap?: number;
  /** Margin round the whole sheet. Default 3. */
  pad?: number;
  /** Backdrop. Default transparent. */
  bg?: Color;
  /** Label colour. */
  labelColor: Color;
  /** Start a new row when the next cell would pass this width. Default: one row. */
  maxWidth?: number;
  /** Indexes of cells that must start a new row. */
  rowStarts?: readonly number[];
}

/**
 * Lay surfaces out left to right with a small label under each, wrapping to a new row
 * when `maxWidth` is reached. Cells in a row stand on a common bottom line.
 */
export function contactSheet(
  surfaces: readonly Surface[],
  labels: readonly string[],
  opts: SheetOptions,
): Surface {
  const gap = opts.gap ?? 4;
  const pad = opts.pad ?? 3;
  const maxWidth = opts.maxWidth ?? Infinity;
  const font = FONT_3x5;
  const labelH = font.height + 2;

  // Place every cell first, then paint.
  const cells: {
    s: Surface;
    label: string;
    x: number;
    y: number;
    rowH: number;
  }[] = [];
  let x = pad;
  let y = pad;
  let rowH = 0;
  let rowStart = 0;
  let width = 0;
  const closeRow = (): void => {
    for (let i = rowStart; i < cells.length; i++) cells[i].rowH = rowH;
    y += rowH + labelH + gap;
    x = pad;
    rowH = 0;
    rowStart = cells.length;
  };
  surfaces.forEach((s, i) => {
    const label = labels[i] ?? "";
    const cellW = Math.max(s.w, measureText(label, { font }));
    if (
      x > pad &&
      (x + cellW + pad > maxWidth || opts.rowStarts?.includes(i) === true)
    ) {
      closeRow();
    }
    cells.push({ s, label, x, y, rowH: 0 });
    if (s.h > rowH) rowH = s.h;
    x += cellW + gap;
    if (x - gap + pad > width) width = x - gap + pad;
  });
  if (cells.length > rowStart) closeRow();
  const height = y - gap + pad;

  const out = new Surface(width, height);
  out.clear(opts.bg ?? TRANSPARENT);
  for (const cell of cells) {
    out.blit(cell.s, cell.x, cell.y + cell.rowH - cell.s.h);
    drawText(out, cell.label, cell.x, cell.y + cell.rowH + 2, opts.labelColor, {
      font,
    });
  }
  return out;
}
