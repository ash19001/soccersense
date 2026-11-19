import { describe, expect, it } from "vitest";

import { type Color, Surface } from "~/pixel";

import { BADGE_H, BADGE_W, drawGroundBadge } from "./ground-badge";
import { MODE_COLORS, P } from "./palette";

const GREEN = MODE_COLORS.closest;
const COLORS = {
  frame: GREEN.base,
  dark: GREEN.dark,
  base: GREEN.base,
  light: GREEN.light,
};

function badge(tier: number, k = 1): Surface {
  const s = new Surface(BADGE_W * k + 4, BADGE_H * k + 4);
  s.clear(P.white);
  drawGroundBadge(s, 2, 2, tier, k, COLORS);
  return s;
}

function count(s: Surface, c: Color): number {
  let n = 0;
  for (const v of s.data) if (v === c) n++;
  return n;
}

describe("drawGroundBadge", () => {
  it("draws a different ground at every tier, in a frame of the mode's colour", () => {
    const seen = new Set<string>();
    for (let t = 0; t < 8; t++) {
      const s = badge(t);
      seen.add(Array.from(s.data).join(","));
      // the frame: the mode's colour all round, ink outside it
      expect(s.get(3, 10)).toBe(GREEN.base);
      expect(s.get(2, 10)).toBe(P.ink);
    }
    expect(seen.size).toBe(8);
  });

  it("fills the stands with the mode's crowd from the lower leagues up", () => {
    expect(count(badge(1), GREEN.light)).toBe(0);
    for (const t of [3, 4, 5]) {
      expect(count(badge(t), GREEN.light), `tier ${t}`).toBeGreaterThan(5);
    }
  });

  it("plays the final at night and lifts the cup at the top", () => {
    expect(count(badge(6), P.night)).toBeGreaterThan(count(badge(4), P.night));
    expect(count(badge(7), P.gold)).toBeGreaterThan(count(badge(6), P.gold));
  });

  it("draws every pixel as a k x k square", () => {
    const one = badge(4, 1);
    const two = badge(4, 2);
    for (let y = 0; y < BADGE_H; y++) {
      for (let x = 0; x < BADGE_W; x++) {
        const c = one.get(x + 2, y + 2);
        expect(two.get(x * 2 + 2, y * 2 + 2)).toBe(c);
        expect(two.get(x * 2 + 3, y * 2 + 3)).toBe(c);
      }
    }
  });
});
