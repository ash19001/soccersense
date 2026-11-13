import { describe, expect, it } from "vitest";

import { BALL_WORDS_R, menuLayout } from "~/art/layout";
import { pixelScale } from "~/ui";

import { BALL_CLEAR_U, ICON_IN_U, menuIconInset, tapSize } from "./home-icons";

/** Phones in portrait: CSS width, height and device pixel ratio. */
const PHONES: [number, number, number][] = [
  [320, 568, 2],
  [360, 640, 3],
  [360, 740, 4],
  [360, 780, 3],
  [360, 800, 3],
  [360, 800, 2],
  [375, 667, 2],
  [375, 812, 3],
  [384, 854, 2.8125],
  [390, 844, 3],
  [393, 852, 3],
  [393, 873, 2.75],
  [402, 874, 3],
  [412, 915, 2.625],
  [414, 896, 2],
  [428, 926, 3],
  [430, 932, 3],
  [440, 956, 3],
];

const inset = (w: number, h: number, dpr: number) =>
  menuIconInset(pixelScale(w, h, dpr), w);

describe("menuIconInset", () => {
  it("moves the icons two logical pixels in on most phones", () => {
    expect(inset(390, 844, 3)).toBe(6);
    expect(inset(375, 812, 3)).toBe(6);
    expect(inset(393, 852, 3)).toBe(6);
    expect(inset(430, 932, 3)).toBe(6);
    expect(inset(440, 956, 3)).toBe(6);
    expect(inset(320, 568, 2)).toBe(4);
    expect(inset(360, 640, 3)).toBe(4);
    const pixel = pixelScale(412, 915, 2.625);
    expect(inset(412, 915, 2.625)).toBeCloseTo(pixel.px * 2, 6);
  });

  it("leaves them where they were where the ball is as small as its words allow", () => {
    const scale = pixelScale(360, 800, 3);
    expect(menuLayout(scale.canvasW, scale.canvasH).ballR).toBe(BALL_WORDS_R);
    expect(inset(360, 800, 3)).toBe(0);
    expect(inset(360, 780, 3)).toBe(0);
  });

  it("is a whole number of logical pixels, never more than ICON_IN_U", () => {
    for (const [w, h, dpr] of PHONES) {
      const scale = pixelScale(w, h, dpr);
      const steps = inset(w, h, dpr) / scale.px;
      expect(steps, `${w}x${h}@${dpr}`).toBeGreaterThanOrEqual(0);
      expect(steps, `${w}x${h}@${dpr}`).toBeLessThanOrEqual(ICON_IN_U);
      expect(Math.abs(steps - Math.round(steps))).toBeLessThan(1e-9);
    }
  });

  it("keeps every stack clear of the ball wherever it moves them", () => {
    for (const [w, h, dpr] of PHONES) {
      const scale = pixelScale(w, h, dpr);
      const into = inset(w, h, dpr);
      if (into === 0) continue;
      const { ballR, cx } = menuLayout(scale.canvasW, scale.canvasH);
      // The ball's right side, with the canvas centred on the page (ui.css section 19).
      const ballRight =
        w / 2 + (cx - scale.canvasW / 2 + ballR) * scale.canvasPx;
      const column = Math.min(w, Math.max(135 * scale.px, 405 * scale.fp));
      const stack = w - (w - column) / 2 - 3 * scale.px - into - tapSize(scale);
      expect(stack - ballRight, `${w}x${h}@${dpr}`).toBeGreaterThanOrEqual(
        BALL_CLEAR_U * scale.px - 1,
      );
    }
  });

  it("is never bolder without the page's width than with it", () => {
    for (const [w, h, dpr] of PHONES) {
      const scale = pixelScale(w, h, dpr);
      expect(menuIconInset(scale)).toBeLessThanOrEqual(inset(w, h, dpr));
    }
  });

  it("takes the tap size ui.css does: 44 px in whole pairs of device pixels", () => {
    expect(tapSize(pixelScale(390, 844, 3))).toBe(44);
    expect(tapSize(pixelScale(412, 915, 2.625))).toBeCloseTo(160 / 3.5, 3);
    expect(tapSize(pixelScale(1920, 1080, 1))).toBe(56);
  });
});
