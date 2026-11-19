import { describe, expect, it } from "vitest";

import { Surface } from "~/pixel";

import { GLOBE_COLORS, drawGlobe, drawMapPin, drawStars } from "./globe";
import { P } from "./palette";

const { sea, land, coast, rim } = GLOBE_COLORS;
const EMPTY = P.white;

function blank(w = 120, h = 90): Surface {
  const s = new Surface(w, h);
  s.clear(EMPTY);
  return s;
}

function count(s: Surface, colors: readonly number[]): number {
  let n = 0;
  for (const c of s.data) if (colors.includes(c)) n++;
  return n;
}

describe("drawGlobe", () => {
  it("has the place it is turned to in its middle: land in Brazil, sea in the Pacific", () => {
    const brazil = blank();
    drawGlobe(brazil, 60, 45, 40, { lat: -10, lng: -55 });
    expect([land, coast]).toContain(brazil.get(60, 45));
    const pacific = blank();
    drawGlobe(pacific, 60, 45, 40, { lat: 0, lng: -150 });
    expect(pacific.get(60, 45)).toBe(sea);
  });

  it("is a disc: nothing outside its radius, and its rim where all of it is in sight", () => {
    const s = blank();
    drawGlobe(s, 60, 45, 30, { lat: 20, lng: 10 });
    expect(s.get(5, 5)).toBe(EMPTY);
    expect(s.get(60 + 34, 45)).toBe(EMPTY);
    expect(count(s, [rim, coast])).toBeGreaterThan(0);
    // about the disc's area in its colours
    const disc = count(s, [sea, land, coast]);
    expect(disc).toBeGreaterThan(Math.PI * 28 * 28 * 0.9);
  });

  it("dissolves in: none of it at no coverage, some of it at half", () => {
    const none = blank();
    drawGlobe(none, 60, 45, 30, { lat: 0, lng: 0 }, { coverage: 0 });
    expect(count(none, [sea, land, coast, rim])).toBe(0);
    const half = blank();
    drawGlobe(half, 60, 45, 30, { lat: 0, lng: 0 }, { coverage: 0.5 });
    const all = blank();
    drawGlobe(all, 60, 45, 30, { lat: 0, lng: 0 });
    const shown = count(half, [sea, land, coast]);
    const whole = count(all, [sea, land, coast]);
    expect(shown).toBeGreaterThan(whole * 0.35);
    expect(shown).toBeLessThan(whole * 0.65);
  });

  it("can be far bigger than the picture: its middle then fills it, the map round the place", () => {
    const s = blank(480, 270);
    drawGlobe(s, 240, 135, 100000, { lat: 51.5, lng: -0.1 });
    expect(count(s, [EMPTY])).toBe(0);
    // London is on land
    expect([land, coast]).toContain(s.get(240, 135));
  });
});

describe("drawStars and drawMapPin", () => {
  it("draws the same stars for the same seed", () => {
    const a = blank();
    const b = blank();
    drawStars(a, 9);
    drawStars(b, 9);
    expect(a.data).toEqual(b.data);
    expect(count(a, [EMPTY])).toBeLessThan(a.w * a.h);
  });

  it("stands the pin on its point and says where its top is", () => {
    const s = blank();
    const top = drawMapPin(s, 60, 60, 1, P.closest, P.closestLight);
    expect(top).toBe(60 - 8 - 6);
    expect(s.get(60, 60 - 10)).not.toBe(EMPTY);
    expect(s.get(60, 10)).toBe(EMPTY);
  });
});
