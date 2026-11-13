import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import {
  DEFAULT_SCALE,
  WIDE_ROW_CP,
  WIDE_ROW_PX,
  canvasDpFor,
  deviceToCss,
  iconPixel,
  isWide,
  noticeDevicePixelRatio,
  pixelScale,
  pixelVariables,
  tapSize,
  usePixelScale,
} from "./scale";

describe("pixelScale", () => {
  test("phones in portrait use the width", () => {
    expect(pixelScale(390, 844)).toEqual({
      px: 3,
      tx: 2,
      fp: 1,
      cp: 2,
      logicalW: 130,
      logicalH: 282,
      portrait: true,
      dpr: 1,
      dp: 3,
      snap: 1,
      // The canvas: half the interface's pixel, rounded up.
      canvasW: 195,
      canvasH: 422,
      canvasDp: 2,
      canvasPx: 2,
    });
    expect(pixelScale(360, 740)).toMatchObject({ px: 3, logicalW: 120 });
    expect(pixelScale(375, 667)).toMatchObject({ px: 3, logicalW: 125 });
    expect(pixelScale(320, 568)).toMatchObject({ px: 2, logicalW: 160 });
    expect(pixelScale(412, 915)).toMatchObject({ px: 3, logicalW: 138 });
  });

  test("a wide, short portrait screen is limited by its height", () => {
    // By width alone these would be px 6 and px 3: the canvas would be too short.
    expect(pixelScale(768, 1024)).toMatchObject({
      px: 4,
      fp: 1,
      logicalW: 192,
      logicalH: 256,
      portrait: true,
    });
    expect(pixelScale(360, 640)).toMatchObject({ px: 2, logicalH: 320 });
    expect(pixelScale(600, 600)).toMatchObject({ px: 2, portrait: true });
    // The width still wins when it asks for less.
    expect(pixelScale(390, 2000)).toMatchObject({ px: 3 });
    // The canvas is at least 220 logical pixels tall whenever px is above the minimum.
    for (const [w, h] of [
      [768, 1024],
      [820, 1180],
      [1024, 1366],
      [500, 700],
    ] as const) {
      const s = pixelScale(w, h);
      expect(s.px).toBeGreaterThan(2);
      expect(s.logicalH).toBeGreaterThanOrEqual(220);
    }
  });

  test("landscape uses the height", () => {
    expect(pixelScale(1440, 900)).toMatchObject({
      px: 3,
      tx: 2,
      fp: 1,
      logicalW: 480,
      logicalH: 300,
      portrait: false,
    });
    expect(pixelScale(1920, 1080)).toMatchObject({ px: 4, tx: 3, fp: 1 });
    expect(pixelScale(1024, 768)).toMatchObject({ px: 3, portrait: false });
  });

  test("px is clamped to 2..8 and tx is never below 2", () => {
    expect(pixelScale(200, 400)).toMatchObject({ px: 2, tx: 2 });
    expect(pixelScale(844, 390)).toMatchObject({ px: 2, tx: 2 });
    expect(pixelScale(3000, 4000)).toMatchObject({ px: 8, tx: 7 });
    expect(pixelScale(6000, 4000)).toMatchObject({ px: 8, tx: 7 });
  });

  test("a font pixel is a third of a logical pixel, as a whole CSS pixel", () => {
    const fps = [2, 3, 4, 5, 6, 7, 8].map(
      (px) => pixelScale(4000, px * 290).fp,
    );
    expect(fps).toEqual([1, 1, 1, 2, 2, 2, 3]);
  });

  test("a caption pixel is half a logical pixel, rounded up, and never less than a font pixel", () => {
    const cps = [2, 3, 4, 5, 6, 7, 8].map(
      (px) => pixelScale(4000, px * 290).cp,
    );
    expect(cps).toEqual([1, 2, 2, 3, 3, 4, 4]);
    for (const dpr of [1, 1.25, 1.5, 1.75, 2, 2.625, 3]) {
      for (const [w, h] of [
        [390, 844],
        [1280, 720],
        [1920, 1080],
        [2560, 1440],
      ] as const) {
        const s = pixelScale(w, h, dpr);
        expect(s.cp).toBeGreaterThanOrEqual(s.fp);
        expect(s.cp).toBeLessThanOrEqual(s.px);
      }
    }
  });

  test("the logical canvas always covers the viewport", () => {
    for (const [w, h] of [
      [361, 741],
      [412, 915],
      [768, 1024],
      [1366, 768],
    ] as const) {
      const s = pixelScale(w, h);
      expect(s.logicalW * s.px).toBeGreaterThanOrEqual(w);
      expect(s.logicalH * s.px).toBeGreaterThanOrEqual(h);
      expect(s.logicalW * s.px - w).toBeLessThan(s.px);
    }
  });

  test("the server default is a 390 x 844 phone at ratio 1", () => {
    expect(DEFAULT_SCALE).toEqual(pixelScale(390, 844));
    expect(DEFAULT_SCALE).toEqual(pixelScale(390, 844, 1));
    expect(DEFAULT_SCALE.px).toBe(3);
    expect(DEFAULT_SCALE.fp).toBe(1);
    expect(DEFAULT_SCALE.tx).toBe(2);
    expect(DEFAULT_SCALE.dpr).toBe(1);
  });
});

// --- the device ------------------------------------------------------------------------------

const RATIOS = [1, 1.1, 1.25, 1.5, 1.75, 2, 2.625, 3] as const;
const VIEWPORTS = [
  [390, 844],
  [360, 740],
  [375, 667],
  [320, 568],
  [768, 1024],
  [820, 1180],
  [1024, 768],
  [1280, 720],
  [1366, 768],
  [1440, 900],
  [1536, 864],
  [1920, 1080],
  [2560, 1440],
  [3840, 2160],
] as const;

/** `css` CSS pixels as device pixels, which must come out whole. */
function devicePixels(css: number, dpr: number): number {
  const exact = css * dpr;
  // The CSS value is rounded up in its fifth decimal place, so it lands just above.
  expect(exact - Math.round(exact)).toBeGreaterThanOrEqual(-1e-9);
  expect(exact - Math.round(exact)).toBeLessThan(2e-4);
  return Math.round(exact);
}

describe("pixelScale on a device", () => {
  test("nothing changes at ratios 1, 2 and 3", () => {
    for (const [w, h] of VIEWPORTS) {
      const one = pixelScale(w, h, 1);
      for (const dpr of [1, 2, 3]) {
        const s = pixelScale(w, h, dpr);
        const canvasDp = canvasDpFor(one.px * dpr);
        // (The caption pixel is new, and is half a logical pixel in device pixels: on a
        // 2x screen with a px of 3 that is 1.5 CSS pixels, not the 2 of a 1x screen.)
        // The canvas's pixel is half the interface's in device pixels, rounded up.
        expect(s).toEqual({
          ...one,
          dpr,
          dp: one.px * dpr,
          cp: s.cp,
          canvasDp,
          canvasPx: deviceToCss(canvasDp, dpr),
          canvasW: Math.ceil((w * dpr) / canvasDp),
          canvasH: Math.ceil((h * dpr) / canvasDp),
        });
        expect(devicePixels(s.cp, dpr)).toBe(
          Math.max(s.fp * dpr, Math.ceil(s.dp / 2)),
        );
        expect(Number.isInteger(s.px)).toBe(true);
        expect(Number.isInteger(s.fp)).toBe(true);
        expect(s.snap).toBe(1);
        expect(s.logicalW).toBe(Math.ceil(w / s.px));
        expect(s.logicalH).toBe(Math.ceil(h / s.px));
      }
    }
  });

  test("every unit is a whole number of device pixels at any ratio", () => {
    for (const dpr of RATIOS) {
      for (const [w, h] of VIEWPORTS) {
        const s = pixelScale(w, h, dpr);
        expect(Number.isInteger(s.dp)).toBe(true);
        expect(s.dp).toBeGreaterThanOrEqual(2);
        expect(devicePixels(s.px, dpr)).toBe(s.dp);
        expect(devicePixels(s.fp, dpr)).toBeGreaterThanOrEqual(1);
        expect(devicePixels(s.cp, dpr)).toBeGreaterThanOrEqual(1);
        expect(devicePixels(s.tx, dpr)).toBeGreaterThanOrEqual(1);
        expect(devicePixels(s.snap, dpr)).toBe(Math.max(1, Math.round(dpr)));
      }
    }
  });

  test("the rule: dp = max(2, round(target * ratio)), where the target is the CSS-pixel rule", () => {
    for (const dpr of RATIOS) {
      for (const [w, h] of VIEWPORTS) {
        const target = pixelScale(w, h).px;
        const fontTarget = pixelScale(w, h).fp;
        const s = pixelScale(w, h, dpr);
        expect(s.dp).toBe(Math.max(2, Math.round(target * dpr)));
        expect(devicePixels(s.fp, dpr)).toBe(
          Math.max(1, Math.round(fontTarget * dpr)),
        );
        // Never far from the size that was asked for.
        expect(Math.abs(s.px - target)).toBeLessThanOrEqual(0.5 / dpr + 1e-4);
      }
    }
  });

  test("Windows at 125% and 150%, and browser zoom", () => {
    // A 1920 x 1080 panel at 125%: the same picture as at 100%.
    expect(pixelScale(1536, 864, 1.25)).toMatchObject({
      px: 3.2,
      fp: 0.8,
      cp: 1.6,
      dp: 4,
      snap: 0.8,
      logicalW: 480,
      logicalH: 270,
    });
    // The same panel at 150%: 3 device pixels, a font pixel of 2.
    expect(pixelScale(1280, 720, 1.5)).toMatchObject({
      px: 2,
      dp: 3,
      logicalW: 640,
      logicalH: 360,
    });
    expect(pixelScale(1280, 720, 1.5).fp).toBeCloseTo(4 / 3, 4);
    // At 175%, where the browser reports 1097 x 617 for 1097.14 x 617.14.
    expect(pixelScale(1097, 617, 1.75)).toMatchObject({
      dp: 4,
      logicalW: 480,
      logicalH: 270,
    });
    expect(pixelScale(1097, 617, 1.75).px).toBeCloseTo(4 / 1.75, 4);
    // A 2560 x 1440 panel at 150%.
    expect(pixelScale(1707, 960, 1.5)).toMatchObject({ dp: 5, logicalH: 288 });
    // Browser zoom at 110% and at 90% on a 1920 x 1080 panel.
    expect(pixelScale(1745, 982, 1.1)).toMatchObject({ dp: 3, logicalW: 640 });
    expect(pixelScale(2133, 1200, 0.9)).toMatchObject({
      dp: 4,
      logicalW: 480,
      logicalH: 270,
    });
    // A Pixel phone at 2.625.
    expect(pixelScale(412, 915, 2.625)).toMatchObject({ dp: 8, logicalW: 136 });
  });

  test("a logical pixel is never one device pixel", () => {
    expect(pixelScale(1000, 500, 0.5)).toMatchObject({ dp: 2, px: 4 });
    expect(pixelScale(4000, 2000, 0.25).dp).toBeGreaterThanOrEqual(2);
  });

  test("the logical canvas covers the screen in device pixels, with less than a logical pixel to spare", () => {
    for (const dpr of RATIOS) {
      for (const [w, h] of VIEWPORTS) {
        const s = pixelScale(w, h, dpr);
        for (const [css, logical] of [
          [w, s.logicalW],
          [h, s.logicalH],
        ] as const) {
          const device = css * dpr;
          expect(logical * s.dp).toBeGreaterThanOrEqual(device - 1e-6);
          // Rounded up to a device pixel, then to a logical one.
          expect(logical * s.dp - device).toBeLessThan(s.dp + 1);
        }
      }
    }
  });

  test("an exact viewport size (a fraction of a CSS pixel) gives the exact canvas", () => {
    // 1920 x 1080 device pixels at 110% are 1745.4545 x 981.8182 CSS pixels.
    const dpr = 1.100000023841858; // what Chrome reports
    const s = pixelScale(1920 / dpr, 1080 / dpr, dpr);
    expect(s).toMatchObject({ dp: 3, logicalW: 640, logicalH: 360 });
    // Rounded down to whole CSS pixels the height is a device pixel short of certain.
    expect(pixelScale(1745, 981, dpr).logicalH).toBe(360);
    expect(pixelScale(1745, 982, dpr).logicalH).toBe(361);
  });

  test("a ratio that is not a usable number counts as 1", () => {
    for (const bad of [0, -2, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(pixelScale(1440, 900, bad)).toEqual(pixelScale(1440, 900));
    }
  });

  test("deviceToCss is exact for whole CSS pixels and a hair above for fractions", () => {
    expect(deviceToCss(6, 2)).toBe(3);
    expect(deviceToCss(9, 3)).toBe(3);
    expect(deviceToCss(4, 1.25)).toBe(3.2);
    expect(deviceToCss(1920, 1.25)).toBe(1536);
    const third = deviceToCss(2, 1.5);
    expect(third).toBeGreaterThanOrEqual(4 / 3);
    expect(third - 4 / 3).toBeLessThan(1e-5);
  });

  test("pixelVariables: whole CSS pixels at whole ratios, fractions and a nudge otherwise", () => {
    expect(pixelVariables(pixelScale(390, 844, 3))).toEqual({
      "--px": "3px",
      "--fp": "1px",
      "--cp": "1.66667px",
      "--tx": "2px",
      "--ip-fit": "2px",
      "--snap": "1px",
      "--nudge": "0px",
    });
    expect(pixelVariables(pixelScale(1536, 864, 1.25))).toEqual({
      "--px": "3.2px",
      "--fp": "0.8px",
      "--cp": "1.6px",
      "--tx": "2.4px",
      "--ip-fit": "2.4px",
      "--snap": "0.8px",
      "--nudge": "0.0125px",
    });
  });

  test("iconPixel: a symbol fills about two fifths of its icon button, in whole device pixels", () => {
    // Phones: 2 px, whether a logical pixel is 2 px (as it always looked) or 3 px.
    expect(iconPixel(pixelScale(320, 568, 2))).toBe(2);
    expect(iconPixel(pixelScale(360, 640, 3))).toBe(2);
    expect(iconPixel(pixelScale(390, 844, 3))).toBe(2);
    expect(iconPixel(pixelScale(402, 874, 3))).toBe(2);
    expect(iconPixel(pixelScale(414, 896, 2))).toBe(2);
    // Fractional ratios: whole device pixels (5 at 2.625, 6 at 2.75).
    expect(iconPixel(pixelScale(412, 915, 2.625)) * 2.625).toBeCloseTo(5, 3);
    expect(iconPixel(pixelScale(393, 873, 2.75)) * 2.75).toBeCloseTo(6, 3);
    // A monitor: 3 px in a 56 px button.
    expect(iconPixel(pixelScale(1920, 1080))).toBe(3);
    for (const [w, h, dpr] of [
      [390, 844, 3],
      [412, 915, 2.625],
      [1920, 1080, 1],
      [1536, 864, 1.25],
    ]) {
      const scale = pixelScale(w, h, dpr);
      const share = (iconPixel(scale) * 9) / tapSize(scale);
      expect(share).toBeGreaterThan(0.35);
      expect(share).toBeLessThan(0.5);
      expect(iconPixel(scale)).toBeLessThanOrEqual(scale.px);
    }
  });

  test("wide is landscape with room for the caption row", () => {
    expect(isWide(pixelScale(1920, 1080))).toBe(true);
    expect(isWide(pixelScale(1366, 768))).toBe(true);
    expect(isWide(pixelScale(1536, 864, 1.25))).toBe(true);
    expect(isWide(pixelScale(1280, 720, 1.5))).toBe(true);
    expect(isWide(pixelScale(1097, 617, 1.75))).toBe(true);
    expect(isWide(pixelScale(1280, 1024))).toBe(true);
    expect(isWide(pixelScale(2560, 1440))).toBe(true);
    // Phones and upright tablets are not, and nor is a landscape window with no room.
    expect(isWide(pixelScale(390, 844, 3))).toBe(false);
    expect(isWide(pixelScale(768, 1024, 2))).toBe(false);
    expect(isWide(pixelScale(844, 390, 3))).toBe(true);
    expect(isWide(pixelScale(900, 800))).toBe(false);
    expect(isWide(pixelScale(1024, 768))).toBe(false);
    // The same tablet at 2x has a finer caption pixel (1.5 CSS px), and the room.
    expect(isWide(pixelScale(1024, 768, 2))).toBe(true);
    // The room asked for: 60 logical pixels and 480 caption pixels.
    for (const [w, h, dpr] of [
      [1920, 1080, 1],
      [1366, 768, 1],
      [1024, 768, 1],
      [2560, 1440, 1],
      [1280, 720, 1.5],
    ] as const) {
      const s = pixelScale(w, h, dpr);
      const need = WIDE_ROW_PX * s.px + WIDE_ROW_CP * s.cp;
      expect(isWide(s)).toBe(s.logicalW * s.px >= need - 1e-3);
    }
  });
});

// --- the hook ----------------------------------------------------------------------------------

/** A `(resolution: ...)` media query that the test can fire. */
class FakeQuery {
  readonly listeners = new Set<() => void>();
  constructor(readonly media: string) {}
  addEventListener = (_type: string, listener: () => void) => {
    this.listeners.add(listener);
  };
  removeEventListener = (_type: string, listener: () => void) => {
    this.listeners.delete(listener);
  };
}

function setWindow(width: number, height: number, dpr: number): void {
  vi.stubGlobal("innerWidth", width);
  vi.stubGlobal("innerHeight", height);
  vi.stubGlobal("devicePixelRatio", dpr);
}

describe("usePixelScale", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("reads the window and its device pixel ratio, and follows a resize", () => {
    setWindow(1536, 864, 1.25);
    const { result } = renderHook(() => usePixelScale());
    expect(result.current).toMatchObject({ dp: 4, px: 3.2, logicalW: 480 });

    act(() => {
      setWindow(1920, 1080, 1);
      window.dispatchEvent(new Event("resize"));
    });
    expect(result.current).toEqual(pixelScale(1920, 1080, 1));
  });

  test("follows the device pixel ratio live, with no resize: zoom, another monitor", () => {
    const queries: FakeQuery[] = [];
    vi.stubGlobal("matchMedia", (media: string) => {
      const query = new FakeQuery(media);
      queries.push(query);
      return query;
    });
    setWindow(1440, 900, 1);
    const { result, unmount } = renderHook(() => usePixelScale());
    expect(result.current).toEqual(pixelScale(1440, 900, 1));
    expect(queries.map((q) => q.media)).toEqual(["(resolution: 1dppx)"]);

    // The window is dragged to a monitor at 150%. Only the media query says so.
    act(() => {
      vi.stubGlobal("devicePixelRatio", 1.5);
      for (const listener of [...queries[0]!.listeners]) listener();
    });
    expect(result.current).toEqual(pixelScale(1440, 900, 1.5));
    expect(result.current.dp).toBe(5);
    // A new query watches the new ratio; the old one has been let go.
    expect(queries.map((q) => q.media)).toEqual([
      "(resolution: 1dppx)",
      "(resolution: 1.5dppx)",
    ]);
    expect(queries[0]!.listeners.size).toBe(0);
    expect(queries[1]!.listeners.size).toBe(1);

    // And back again.
    act(() => {
      vi.stubGlobal("devicePixelRatio", 1);
      for (const listener of [...queries[1]!.listeners]) listener();
    });
    expect(result.current).toEqual(pixelScale(1440, 900, 1));

    unmount();
    expect(queries.every((q) => q.listeners.size === 0)).toBe(true);
  });

  test("noticeDevicePixelRatio tells the store about a ratio that changed without an event", () => {
    // Nobody is listening yet: nothing to do, and nothing thrown.
    expect(() => noticeDevicePixelRatio()).not.toThrow();

    setWindow(1440, 900, 1);
    const { result, unmount } = renderHook(() => usePixelScale());
    const before = result.current;
    act(() => noticeDevicePixelRatio());
    expect(result.current).toBe(before);

    act(() => {
      vi.stubGlobal("devicePixelRatio", 1.25);
      noticeDevicePixelRatio();
    });
    expect(result.current).toEqual(pixelScale(1440, 900, 1.25));
    expect(result.current.dp).toBe(4);

    unmount();
    vi.stubGlobal("devicePixelRatio", 2);
    expect(() => noticeDevicePixelRatio()).not.toThrow();
  });

  test("uses the visual viewport's exact size at a fractional ratio, while it is the same measurement", () => {
    const dpr = 1.100000023841858;
    setWindow(1745, 982, dpr);
    vi.stubGlobal("visualViewport", {
      width: 1920 / dpr,
      height: 1080 / dpr,
      scale: 1,
    });
    const { result, unmount } = renderHook(() => usePixelScale());
    expect(result.current).toMatchObject({ logicalW: 640, logicalH: 360 });
    unmount();

    // With a keyboard up the visual viewport is something else: the window's size is used.
    setWindow(1745, 983, dpr);
    vi.stubGlobal("visualViewport", {
      width: 1920 / dpr,
      height: 500,
      scale: 1,
    });
    const second = renderHook(() => usePixelScale());
    expect(second.result.current.logicalH).toBe(Math.ceil((983 * dpr) / 3));
  });

  test("the build-time render and the first client render are the default scale", () => {
    setWindow(1920, 1080, 1.25);
    const seen: number[] = [];
    renderHook(
      () => {
        const scale = usePixelScale();
        seen.push(scale.dpr);
        return scale;
      },
      { hydrate: false },
    );
    // After mounting it is the window's. (Under hydration React renders the server value
    // first: that path is covered by the routes' hydration tests.)
    expect(seen.at(-1)).toBe(1.25);
    expect(DEFAULT_SCALE.dpr).toBe(1);
  });
});
