// @vitest-environment node
import { crc32, inflateSync } from "node:zlib";

import { describe, expect, test } from "vitest";

import { contactSheet, encodePng, sideBySide } from "../../tools/png";
import { TRANSPARENT, rgb } from "./color";
import { shots } from "./pixel.shots";
import { Surface } from "./surface";

const RED = rgb(0xff0000);
const BLUE = rgb(0x0000ff);

interface Chunk {
  type: string;
  data: Buffer;
  crcOk: boolean;
}

function chunks(png: Buffer): Chunk[] {
  const out: Chunk[] = [];
  let at = 8;
  while (at < png.length) {
    const length = png.readUInt32BE(at);
    const type = png.toString("latin1", at + 4, at + 8);
    const data = png.subarray(at + 8, at + 8 + length);
    const crc = png.readUInt32BE(at + 8 + length);
    out.push({
      type,
      data,
      crcOk: crc32(png.subarray(at + 4, at + 8 + length)) === crc,
    });
    at += 12 + length;
  }
  return out;
}

describe("encodePng", () => {
  const s = new Surface(3, 2);
  s.px(0, 0, RED);
  s.px(2, 1, rgb(0x112233));

  test("starts with the PNG signature", () => {
    const png = encodePng(s);
    expect(Array.from(png.subarray(0, 8))).toEqual([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
  });

  test("has IHDR, IDAT, IEND with correct CRCs and dimensions", () => {
    for (const scale of [1, 4]) {
      const parts = chunks(encodePng(s, scale));
      expect(parts.map((c) => c.type)).toEqual(["IHDR", "IDAT", "IEND"]);
      for (const part of parts) expect(part.crcOk, part.type).toBe(true);
      const header = parts[0].data;
      expect(header.length).toBe(13);
      expect(header.readUInt32BE(0)).toBe(3 * scale);
      expect(header.readUInt32BE(4)).toBe(2 * scale);
      expect(header[8]).toBe(8); // bit depth
      expect(header[9]).toBe(6); // RGBA
      expect(parts[2].data.length).toBe(0);
    }
  });

  test("pixel data is RGBA rows, with transparency kept", () => {
    const raw = inflateSync(chunks(encodePng(s))[1].data);
    expect(Array.from(raw)).toEqual([
      // filter, then three RGBA pixels
      0, 255, 0, 0, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0x11, 0x22, 0x33, 255,
    ]);
  });

  test("scale is a nearest-neighbour upscale", () => {
    const k = 3;
    const raw = inflateSync(chunks(encodePng(s, k))[1].data);
    const stride = 3 * k * 4 + 1;
    expect(raw.length).toBe(stride * 2 * k);
    for (let y = 0; y < 2 * k; y++) {
      expect(raw[y * stride]).toBe(0);
      for (let x = 0; x < 3 * k; x++) {
        const at = y * stride + 1 + x * 4;
        const c = s.get(Math.floor(x / k), Math.floor(y / k));
        expect(raw.readUInt32LE(at)).toBe(c);
      }
    }
  });
});

describe("layout helpers", () => {
  test("sideBySide lays surfaces left to right with a gap", () => {
    const a = new Surface(2, 3);
    const b = new Surface(4, 1);
    a.clear(RED);
    b.clear(BLUE);
    const row = sideBySide([a, b], { gap: 2, bg: TRANSPARENT });
    expect([row.w, row.h]).toEqual([8, 3]);
    expect(row.get(1, 2)).toBe(RED);
    expect(row.get(2, 0)).toBe(TRANSPARENT);
    expect(row.get(4, 0)).toBe(BLUE);
    expect(row.get(7, 0)).toBe(BLUE);
    expect(row.get(4, 1)).toBe(TRANSPARENT);
    expect(sideBySide([a]).w).toBe(2);
  });

  test("contactSheet labels each cell and wraps", () => {
    const a = new Surface(10, 10);
    const b = new Surface(10, 10);
    a.clear(RED);
    b.clear(BLUE);
    const label = rgb(0xffffff);
    const one = contactSheet([a, b], ["A", "B"], { labelColor: label });
    expect(one.h).toBeGreaterThan(10);
    expect(one.w).toBeGreaterThan(20);
    let labelPixels = 0;
    for (const v of one.data) if (v === label) labelPixels++;
    expect(labelPixels).toBeGreaterThan(8);
    const wrapped = contactSheet([a, b], ["A", "B"], {
      labelColor: label,
      maxWidth: 0,
    });
    expect(wrapped.h).toBeGreaterThan(one.h);
    expect(wrapped.w).toBeLessThan(one.w);
  });
});

describe("the engine's own shots", () => {
  test("render without throwing, and are deterministic", () => {
    const ctx = {
      w: 130,
      h: 281,
      t: 0,
      seed: 1,
      sun: { elevation: 45, morning: false },
    };
    for (const [id, shot] of Object.entries(shots)) {
      const first = shot(ctx);
      const second = shot(ctx);
      expect(first.w * first.h, id).toBeGreaterThan(100);
      expect(
        Buffer.from(first.data.buffer).equals(Buffer.from(second.data.buffer)),
        id,
      ).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Added in review
// ---------------------------------------------------------------------------

describe("contactSheet rows", () => {
  test("rowStarts forces a new row before those cells", () => {
    const cell = (): Surface => {
      const s = new Surface(6, 4);
      s.clear(RED);
      return s;
    };
    const cells = [cell(), cell(), cell(), cell()];
    const labels = ["", "", "", ""];
    const oneRow = contactSheet(cells, labels, { labelColor: BLUE });
    const twoRows = contactSheet(cells, labels, {
      labelColor: BLUE,
      rowStarts: [0, 2],
    });
    expect(twoRows.w).toBeLessThan(oneRow.w);
    expect(twoRows.h).toBeGreaterThan(oneRow.h);
    let red = 0;
    for (const v of twoRows.data) if (v === RED) red++;
    expect(red).toBe(4 * 24);
    // Two cells across, then two more underneath them.
    expect(twoRows.get(3, 3)).toBe(RED);
    expect(twoRows.get(3 + 6 + 4, 3)).toBe(RED);
    expect(twoRows.get(3 + 2 * (6 + 4), 3)).toBe(TRANSPARENT);
    expect(twoRows.get(3, twoRows.h - 3 - 8 - 1)).toBe(RED);
  });
});
