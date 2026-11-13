import { describe, expect, it } from "vitest";

import { DEFAULT_SCALE, pixelScale } from "~/ui";

import { planeFits } from "./home-plane";

describe("planeFits", () => {
  it("keeps the plane off every phone, either way up", () => {
    const phones: [number, number, number][] = [
      [320, 568, 2],
      [360, 800, 3],
      [390, 844, 3],
      [402, 874, 3],
      [412, 915, 2.625],
      [440, 956, 3],
    ];
    for (const [w, h, dpr] of phones) {
      expect(planeFits(pixelScale(w, h, dpr)), `${w}x${h}`).toBe(false);
      expect(planeFits(pixelScale(h, w, dpr)), `${h}x${w}`).toBe(false);
    }
  });

  it("flies it on tablets, laptops and monitors", () => {
    expect(planeFits(pixelScale(744, 1133, 2))).toBe(true);
    expect(planeFits(pixelScale(1024, 768, 2))).toBe(true);
    expect(planeFits(pixelScale(1366, 768))).toBe(true);
    expect(planeFits(pixelScale(1536, 864, 1.25))).toBe(true);
    expect(planeFits(pixelScale(1920, 1080))).toBe(true);
  });

  it("keeps it off at build time (a phone)", () => {
    expect(planeFits(DEFAULT_SCALE)).toBe(false);
  });
});
