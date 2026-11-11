import { describe, expect, test } from "vitest";

import {
  TRANSPARENT,
  fromOklab,
  fromRgb,
  hex,
  luma,
  mix,
  rgb,
  shade,
  toHex,
  toOklab,
  toRgb,
} from "./color";

describe("packing", () => {
  test("rgb packs as 0xAABBGGRR with full alpha", () => {
    expect(rgb(0xff8800)).toBe(0xff0088ff);
    expect(rgb(0x000000)).toBe(0xff000000);
    expect(rgb(0xffffff)).toBe(0xffffffff);
    expect(TRANSPARENT).toBe(0);
  });

  test("a Uint32Array of colours is RGBA bytes in memory", () => {
    const pixels = new Uint32Array([rgb(0x112233), TRANSPARENT]);
    const bytes = new Uint8ClampedArray(pixels.buffer);
    expect(Array.from(bytes)).toEqual([0x11, 0x22, 0x33, 0xff, 0, 0, 0, 0]);
  });

  test("hex accepts #rrggbb, rrggbb, #rgb and ignores an alpha pair", () => {
    expect(hex("#ff8800")).toBe(rgb(0xff8800));
    expect(hex("FF8800")).toBe(rgb(0xff8800));
    expect(hex("#f80")).toBe(rgb(0xff8800));
    expect(hex("#ff880000")).toBe(rgb(0xff8800));
    expect(() => hex("orange")).toThrow(/not a hex colour/);
  });

  test("round trips", () => {
    for (const value of [0x000000, 0xffffff, 0x0f1220, 0xe8452c, 0x19a9bf]) {
      const c = rgb(value);
      const [r, g, b] = toRgb(c);
      expect((r << 16) | (g << 8) | b).toBe(value);
      expect(fromRgb(r, g, b)).toBe(c);
      expect(hex(toHex(c))).toBe(c);
      const [L, A, B] = toOklab(c);
      expect(fromOklab(L, A, B)).toBe(c);
    }
    expect(toHex(rgb(0x0f1220))).toBe("#0f1220");
  });

  test("fromRgb clamps and rounds", () => {
    expect(toRgb(fromRgb(-20, 127.6, 999))).toEqual([0, 128, 255]);
  });

  test("luma runs from 0 to 1", () => {
    expect(luma(rgb(0x000000))).toBe(0);
    expect(luma(rgb(0xffffff))).toBeCloseTo(1, 10);
    expect(luma(rgb(0x00ff00))).toBeGreaterThan(luma(rgb(0x0000ff)));
  });
});

describe("mix", () => {
  const a = rgb(0xe8452c);
  const b = rgb(0x19a9bf);

  test("returns the end points exactly", () => {
    expect(mix(a, b, 0)).toBe(a);
    expect(mix(a, b, 1)).toBe(b);
    expect(mix(a, b, -3)).toBe(a);
    expect(mix(a, b, 7)).toBe(b);
    expect(mix(a, b, NaN)).toBe(a);
  });

  test("the middle is opaque and between the two in lightness", () => {
    const m = mix(rgb(0x000000), rgb(0xffffff), 0.5);
    expect(m >>> 24).toBe(255);
    const [r, g, bl] = toRgb(m);
    expect(r).toBe(g);
    expect(g).toBe(bl);
    // OKLab's mid grey is darker than the sRGB average of 128.
    expect(r).toBeGreaterThan(80);
    expect(r).toBeLessThan(128);
  });

  test("never blends with transparent: it snaps to the nearer end", () => {
    expect(mix(a, TRANSPARENT, 0.4)).toBe(a);
    expect(mix(a, TRANSPARENT, 0.6)).toBe(TRANSPARENT);
  });
});

describe("shade", () => {
  const grass = rgb(0x33a653);

  test("zero leaves the colour alone", () => {
    for (const value of [0x33a653, 0x000000, 0xffffff, 0x808080]) {
      expect(shade(rgb(value), 0)).toBe(rgb(value));
    }
    expect(shade(grass, NaN)).toBe(grass);
    expect(shade(TRANSPARENT, -0.5)).toBe(TRANSPARENT);
  });

  test("negative is darker, positive is lighter, in order", () => {
    const steps = [-0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75].map(
      (amount) => toOklab(shade(grass, amount))[0],
    );
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i]).toBeGreaterThan(steps[i - 1]);
    }
  });

  test("shadows lean blue, highlights lean yellow", () => {
    // In OKLab, b is the blue (negative) to yellow (positive) axis.
    const [, , base] = toOklab(grass);
    expect(toOklab(shade(grass, -0.4))[2]).toBeLessThan(base);
    const grey = rgb(0x808080);
    expect(toOklab(shade(grey, -0.5))[2]).toBeLessThan(-0.005);
    expect(toOklab(shade(grey, 0.5))[2]).toBeGreaterThan(0.005);
  });

  test("always opaque", () => {
    for (const amount of [-1, -0.3, 0.3, 1, 5]) {
      expect(shade(rgb(0xffc928), amount) >>> 24).toBe(255);
    }
  });
});
