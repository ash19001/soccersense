import { describe, expect, it } from "vitest";
import { Surface, luma, rgb } from "~/pixel";
import { drawFilmDamage, sepiaTone } from "./old-film";
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
  const s = new Surface(120, 80);
  for (let y = 0; y < 80; y++) {
    for (let x = 0; x < 120; x++) {
      s.px(x, y, colours[Math.floor(x / 15)]);
    }
  }
  return s;
}

describe("sepiaTone", () => {
  it("does nothing at level 0", () => {
    const s = picture();
    const before = s.data.slice();
    sepiaTone(s, 0);
    expect(s.data).toEqual(before);
  });

  it("turns the whole picture into a few browns, brighter for brighter colours", () => {
    const s = picture();
    sepiaTone(s, 1);
    const browns = new Set(s.data);
    expect(browns.size).toBeLessThanOrEqual(8);
    // in the middle row (no vignette there at the centre), white is lighter than ink
    expect(luma(s.get(52, 40))).toBeGreaterThan(luma(s.get(110, 40)));
    for (const c of browns) {
      // warm: more red than blue
      expect(c & 0xff).toBeGreaterThan((c >>> 16) & 0xff);
    }
  });

  it("darkens the corners a step (the vignette)", () => {
    const s = new Surface(120, 80);
    s.clear(P.chalk);
    sepiaTone(s, 1);
    expect(luma(s.get(0, 0))).toBeLessThan(luma(s.get(60, 40)));
  });

  it("leaves the hole as it is", () => {
    const s = picture();
    const before = s.data.slice();
    sepiaTone(s, 1, { cx: 60, cy: 40, r: 20 });
    expect(s.get(60, 40)).toBe(before[40 * 120 + 60]);
    expect(s.get(60, 22)).toBe(before[22 * 120 + 60]);
    expect(s.get(5, 5)).not.toBe(before[5 * 120 + 5]);
  });

  it("is part of the way there below level 1", () => {
    const a = picture();
    const b = picture();
    sepiaTone(a, 0.35);
    sepiaTone(b, 1);
    expect(a.get(70, 40)).not.toBe(b.get(70, 40));
    expect(a.get(70, 40)).not.toBe(P.home);
  });
});

describe("drawFilmDamage", () => {
  it("scratches and specks the frame, the same way for the same frame", () => {
    const blank = rgb(0x808080);
    const a = new Surface(200, 120);
    const b = new Surface(200, 120);
    const c = new Surface(200, 120);
    a.clear(blank);
    b.clear(blank);
    c.clear(blank);
    drawFilmDamage(a, 5, 3);
    drawFilmDamage(b, 5, 3);
    drawFilmDamage(c, 6, 3);
    expect(a.data).toEqual(b.data);
    expect(a.data).not.toEqual(c.data);
    // a scratch runs a good way down the picture
    const marked = a.data.filter((x) => x !== blank).length;
    expect(marked).toBeGreaterThan(40);
  });
});
