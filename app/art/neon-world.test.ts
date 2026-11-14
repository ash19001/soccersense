import { describe, expect, it } from "vitest";
import { Surface, luma, rgb } from "~/pixel";
import { drawScanGlitch, neonTone } from "./neon-world";
import { P } from "./palette";

/** A picture of stripes in the palette's colours, light to dark and back. */
function picture(): Surface {
  const colours = [
    P.white,
    P.chalk,
    P.skyLow,
    P.grass,
    P.home,
    P.away,
    P.slate,
    P.ink,
  ];
  const s = new Surface(120, 81);
  for (let y = 0; y < 81; y++) {
    for (let x = 0; x < 120; x++) {
      s.px(x, y, colours[Math.floor(x / 15)]);
    }
  }
  return s;
}

describe("neonTone", () => {
  it("does nothing at level 0", () => {
    const s = picture();
    const before = s.data.slice();
    neonTone(s, 0);
    expect(s.data).toEqual(before);
  });

  it("turns the whole picture into a few magentas, brighter for brighter colours", () => {
    const s = picture();
    neonTone(s, 1);
    const tones = new Set(s.data);
    expect(tones.size).toBeLessThanOrEqual(8);
    // on a row that is not a scan line, white is lighter than ink
    expect(luma(s.get(5, 40))).toBeGreaterThan(luma(s.get(110, 40)));
    for (const c of tones) {
      // magenta: more red and blue than green
      const r = c & 0xff;
      const g = (c >>> 8) & 0xff;
      const b = (c >>> 16) & 0xff;
      expect(r).toBeGreaterThanOrEqual(g);
      expect(b).toBeGreaterThanOrEqual(g);
    }
  });

  it("has scan lines: every third row a step darker", () => {
    const s = new Surface(30, 30);
    s.clear(P.chalk);
    neonTone(s, 1);
    expect(luma(s.get(10, 2))).toBeLessThan(luma(s.get(10, 1)));
    expect(s.get(10, 0)).toBe(s.get(10, 1));
    expect(s.get(10, 5)).toBe(s.get(10, 2));
  });

  it("leaves the hole as it is", () => {
    const s = picture();
    const before = s.data.slice();
    neonTone(s, 1, { cx: 60, cy: 40, r: 20 });
    expect(s.get(60, 40)).toBe(before[40 * 120 + 60]);
    expect(s.get(60, 22)).toBe(before[22 * 120 + 60]);
    expect(s.get(5, 5)).not.toBe(before[5 * 120 + 5]);
  });

  it("is part of the way there below level 1", () => {
    const a = picture();
    const b = picture();
    neonTone(a, 0.35);
    neonTone(b, 1);
    expect(a.get(70, 40)).not.toBe(b.get(70, 40));
    expect(a.get(70, 40)).not.toBe(P.home);
  });
});

describe("drawScanGlitch", () => {
  it("draws a scan bar and glitches, the same way for the same frame", () => {
    const blank = rgb(0x808080);
    const frame = (f: number): Surface => {
      const s = new Surface(200, 120);
      s.clear(blank);
      drawScanGlitch(s, f, 3);
      return s;
    };
    const a = frame(5);
    expect(a.data).toEqual(frame(5).data);
    expect(a.data).not.toEqual(frame(6).data);
    // the bar runs most of the way across
    const marked = a.data.filter((x) => x !== blank).length;
    expect(marked).toBeGreaterThan(100);
  });
});
