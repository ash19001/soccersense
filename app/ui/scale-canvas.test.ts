import { describe, expect, test } from "vitest";

import { canvasDpFor, deviceToCss, pixelScale } from "./scale";

/**
 * The interface's rule (scale.ts before the canvas got its own pixel, 2026-11-12), copied
 * verbatim, so that a change to the real one that moves any of the interface's values fails
 * here.
 */
function interfaceScale(cssWidth: number, cssHeight: number, dpr = 1) {
  const clamp = (v: number, lo: number, hi: number) =>
    Math.min(hi, Math.max(lo, v));
  const ratio = Number.isFinite(dpr) && dpr > 0 ? clamp(dpr, 0.2, 16) : 1;
  const span = (css: number) =>
    Number.isInteger(ratio)
      ? Math.max(1, Math.floor(css)) * ratio
      : Math.max(1, Math.ceil(css * ratio - 1e-3));
  const w = Math.max(1, Math.floor(cssWidth));
  const h = Math.max(1, Math.floor(cssHeight));
  const portrait = h >= w;
  const target = portrait
    ? clamp(Math.min(Math.round(w / 135), Math.floor(h / 220)), 2, 8)
    : clamp(Math.round(h / 290), 2, 8);
  const fontTarget = Math.max(1, Math.round(target / 3));
  const textTarget = Math.max(2, target - 1);
  const dp = Math.max(2, Math.round(target * ratio));
  const fontDp = Math.max(1, Math.round(fontTarget * ratio));
  const textDp = Math.max(1, Math.round(textTarget * ratio));
  const captionDp = Math.max(fontDp, Math.ceil(dp / 2));
  const snapDp = Math.max(1, Math.round(ratio));
  const css = (d: number) => Math.ceil((d / ratio) * 1e5 - 1e-6) / 1e5;
  return {
    px: css(dp),
    tx: css(textDp),
    fp: css(fontDp),
    cp: css(captionDp),
    logicalW: Math.ceil(span(cssWidth) / dp),
    logicalH: Math.ceil(span(cssHeight) / dp),
    portrait,
    dpr: ratio,
    dp,
    snap: css(snapDp),
  };
}

const RATIOS = [0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.625, 2.75, 3, 4];
const WIDTHS = [
  280, 320, 360, 375, 390, 412, 430, 600, 768, 820, 1024, 1097, 1280, 1366,
  1440, 1536, 1600, 1707, 1745, 1920, 2048, 2133, 2560, 3440, 3840,
];
const HEIGHTS = [
  360, 500, 568, 617, 667, 720, 740, 768, 844, 864, 900, 915, 960, 982, 1024,
  1080, 1180, 1200, 1366, 1440, 1600, 2160,
];

function* grid(): Generator<[number, number, number]> {
  for (const dpr of RATIOS) {
    for (const w of WIDTHS) {
      for (const h of HEIGHTS) yield [w, h, dpr];
    }
  }
  // fractions of a CSS pixel: the exact viewport at browser zoom
  yield [1745.45, 981.82, 1.1];
  yield [1536.4, 864.2, 1.25];
}

/** A viewport side in device pixels, as scale.ts measures it. */
function deviceSpan(css: number, ratio: number): number {
  if (Number.isInteger(ratio)) return Math.max(1, Math.floor(css)) * ratio;
  return Math.max(1, Math.ceil(css * ratio - 1e-3));
}

/** The fields the interface uses: everything but the canvas's own. */
const CANVAS_FIELDS = new Set(["canvasW", "canvasH", "canvasDp", "canvasPx"]);

function ui(s: ReturnType<typeof pixelScale>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(s).filter(([key]) => !CANVAS_FIELDS.has(key)),
  );
}

describe("pixelScale: the interface and the canvas", () => {
  test("the interface's values are the rule's, for a grid of screens and ratios", () => {
    let n = 0;
    for (const [w, h, dpr] of grid()) {
      expect(ui(pixelScale(w, h, dpr))).toEqual(interfaceScale(w, h, dpr));
      n++;
    }
    expect(n).toBeGreaterThan(5000);
  });

  test("the canvas's pixel is half the interface's rounded up to whole device pixels, never 1 unless the interface's is 2", () => {
    expect(
      [2, 3, 4, 5, 6, 7, 8, 9, 10, 16].map((dp) => canvasDpFor(dp)),
    ).toEqual([1, 2, 2, 3, 3, 4, 4, 5, 5, 8]);
    for (const [w, h, dpr] of grid()) {
      const s = pixelScale(w, h, dpr);
      expect(Number.isInteger(s.canvasDp)).toBe(true);
      expect(s.canvasDp).toBe(Math.max(1, Math.ceil(s.dp / 2)));
      if (s.dp > 2) expect(s.canvasDp).toBeGreaterThanOrEqual(2);
      // a whole number of device pixels, in CSS pixels the way the browser rounds
      expect(s.canvasPx).toBe(deviceToCss(s.canvasDp, s.dpr));
      const device = s.canvasPx * s.dpr;
      expect(Math.abs(device - s.canvasDp)).toBeLessThan(2e-4);
    }
  });

  test("the canvas covers the screen in device pixels, with less than a canvas pixel to spare", () => {
    for (const [w, h, dpr] of grid()) {
      const s = pixelScale(w, h, dpr);
      const deviceW = deviceSpan(w, s.dpr);
      const deviceH = deviceSpan(h, s.dpr);
      expect(s.canvasW * s.canvasDp).toBeGreaterThanOrEqual(deviceW);
      expect(s.canvasW * s.canvasDp).toBeLessThan(deviceW + s.canvasDp);
      expect(s.canvasH * s.canvasDp).toBeGreaterThanOrEqual(deviceH);
      expect(s.canvasH * s.canvasDp).toBeLessThan(deviceH + s.canvasDp);
      // the canvas is about twice the interface's logical canvas each way: from 1.5 to 2
      // times (2 exactly where the interface's pixel is an even number of device pixels)
      const kx = s.canvasW / s.logicalW;
      const ky = s.canvasH / s.logicalH;
      for (const k of [kx, ky]) {
        expect(k).toBeGreaterThan(1.45);
        expect(k).toBeLessThan(2.05);
      }
      if (s.dp % 2 === 0) {
        expect(Math.abs(s.canvasW - 2 * s.logicalW)).toBeLessThanOrEqual(1);
        expect(Math.abs(s.canvasH - 2 * s.logicalH)).toBeLessThanOrEqual(1);
      }
    }
  });

  test("the screens the art bible names", () => {
    const at = (w: number, h: number, dpr: number) => {
      const s = pixelScale(w, h, dpr);
      return `${s.canvasW}x${s.canvasH}@${s.canvasDp}`;
    };
    // landscape
    expect(at(1920, 1080, 1)).toBe("960x540@2");
    expect(at(1536, 864, 1.25)).toBe("960x540@2");
    expect(at(1280, 720, 1.5)).toBe("960x540@2");
    expect(at(1097, 617, 1.75)).toBe("960x540@2");
    expect(at(1366, 768, 1)).toBe("683x384@2");
    expect(at(1440, 900, 1)).toBe("720x450@2");
    expect(at(2560, 1440, 1)).toBe("854x480@3");
    expect(at(3840, 2160, 1)).toBe("960x540@4");
    expect(at(2560, 1440, 1.5)).toBe("960x540@4");
    expect(at(1920, 1080, 2)).toBe("960x540@4");
    expect(at(1280, 720, 1)).toBe("1280x720@1");
    // portrait
    expect(at(390, 844, 3)).toBe("234x507@5");
    expect(at(390, 844, 2)).toBe("260x563@3");
    expect(at(412, 915, 2.625)).toBe("271x601@4");
    expect(at(360, 740, 3)).toBe("216x444@5");
    expect(at(768, 1024, 2)).toBe("384x512@4");
  });
});
