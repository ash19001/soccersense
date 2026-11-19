import { describe, expect, it } from "vitest";

import { type Color, Surface, rgb } from "~/pixel";

import { lightingFor } from "./lighting";
import { P } from "./palette";
import { PITCH_X, bowlTopAt } from "./stadium-bowl";
import { clubLight, clubRaw, schemeForDay } from "./stadium-club";
import { POND, WATER } from "./stadium-plan";
import {
  LAMP,
  OUTER_AREA,
  PICTURE_TILT,
  TopTones,
  TopTown,
  colorOf,
  drawTopTilt,
  levelFor,
  topAt,
} from "./stadium-top";

const DAY = lightingFor({ elevation: 45, morning: false });
const NIGHT = lightingFor({ elevation: -30, morning: false });
const SCHEME = schemeForDay(7);
const SWAP = clubRaw(clubLight(DAY, SCHEME));
const same = (c: Color): Color => c;
const PITCH = [P.grass, P.grassLight, P.grassDark, P.white];
const ROOF = [P.white, P.chalk, P.steelHi, P.mist, P.concreteLight];
const ROOFS = [
  P.steel,
  P.slate,
  P.brick,
  P.brickDark,
  P.concreteLight,
  P.concrete,
  P.mist,
];

let built: TopTown | null = null;
/** One picture for the tests that need it: it takes a moment to build. */
function town(): TopTown {
  if (!built) {
    built = new TopTown(7, SWAP, SCHEME);
    built.finish();
  }
  return built;
}

describe("bowlTopAt", () => {
  it("is the stadium from above: the pitch in the middle, the roof round it, nothing outside", () => {
    // the product owner, 2026-11-18: "Maybe the transition should be making stadium birds
    // eye view first and as it zooms out it can get pixelated too"
    expect(PITCH).toContain(bowlTopAt(30.5, 10.5, 1, 7, same)!.c);
    expect(ROOF).toContain(bowlTopAt(0.5, 90.5, 1, 7, same)!.c);
    expect(bowlTopAt(0.5, 160.5, 1, 7, same)).toBeNull();
    expect(bowlTopAt(200, 0, 1, 7, same)).toBeNull();
  });

  it("marks the pitch: its goal lines and halfway line a pixel wide, one pixel each", () => {
    // the halfway line: X = 0 falls between two pixels, and takes one of them
    expect(bowlTopAt(-0.5, 20.5, 1, 7, same)!.c).toBe(P.white);
    expect(bowlTopAt(0.5, 20.5, 1, 7, same)!.c).not.toBe(P.white);
    // the goal line, just inside the pitch
    expect(bowlTopAt(PITCH_X - 0.5, 20.5, 1, 7, same)!.c).toBe(P.white);
    expect(bowlTopAt(PITCH_X - 1.5, 20.5, 1, 7, same)!.c).not.toBe(P.white);
  });

  it("fills the stand with the day's crowd: HOME's red swapped for the club's", () => {
    const swapped = SWAP(P.home);
    let red = 0;
    let club = 0;
    for (let a = 0; a < 360; a += 0.5) {
      const t = (a * Math.PI) / 180;
      const c = bowlTopAt(Math.cos(t) * 88, Math.sin(t) * 62, 1, 7, SWAP)!.c;
      if (c === P.home) red++;
      if (c === swapped) club++;
    }
    expect(club).toBeGreaterThan(10);
    if (swapped !== P.home) expect(red).toBe(0);
  });
});

describe("topAt", () => {
  it("is the same town as the picture's: the pond, the houses' roofs, the stadium", () => {
    expect(topAt(POND.x, POND.v - 4, 1, 7, SWAP, SCHEME).c).toBe(WATER);
    expect(PITCH).toContain(topAt(30.5, 10.5, 1, 7, SWAP, SCHEME).c);
    // a row of houses in the streets east of the park, from above: roofs
    expect(ROOFS).toContain(topAt(500.5, -499.5, 1, 7, SWAP, SCHEME).c);
  });

  it("puts lamps on the pavements up close only", () => {
    let near = 0;
    let far = 0;
    for (let x = -300; x < 300; x += 0.5) {
      for (let v = -200; v < -100; v += 0.5) {
        if (topAt(x, v, 1, 7, SWAP, SCHEME).c === LAMP) near++;
        if (topAt(x, v, 0.25, 7, SWAP, SCHEME).c === LAMP) far++;
      }
    }
    expect(near).toBeGreaterThan(0);
    expect(far).toBe(0);
  });
});

describe("TopTown", () => {
  it("is built a slice at a time, and the same when finished at once", () => {
    const a = new TopTown(7, SWAP, SCHEME);
    let slices = 0;
    while (!a.step()) slices++;
    expect(slices).toBeGreaterThan(20);
    expect(a.done).toBe(true);
    const b = town();
    for (const [x, v] of [
      [0, 0],
      [200, 30],
      [-700, 500],
      [1000, -600],
    ]) {
      expect(colorOf(a, a.at(x, v, 0))).toBe(colorOf(b, b.at(x, v, 0)));
    }
  });

  it("keeps the stadium a texel a unit, the town round it coarser, and nothing past that", () => {
    const t = town();
    expect(PITCH).toContain(colorOf(t, t.at(30.5, 10.5, 0)));
    expect(t.at(1000, -600, 0)).toBeGreaterThanOrEqual(0);
    expect(t.at(OUTER_AREA.x1 + 10, 0, 0)).toBe(-1);
    expect(t.at(0, OUTER_AREA.v1 + 10, 0)).toBe(-1);
  });

  it("pixelates in its own colours: every texel of every level one of the picture's", () => {
    const t = town();
    for (const layer of [t.inner, t.outer]) {
      expect(layer.levels.length).toBeGreaterThan(4);
      for (const level of layer.levels) {
        let most = 0;
        for (const idx of level) most = Math.max(most, idx & 0x7fff);
        expect(most).toBeLessThan(t.colors.length);
      }
    }
    // a big texel over the pitch is the pitch's green
    const greens = [P.grass, P.grassLight, P.grassDark, P.grassDeep];
    expect(greens).toContain(colorOf(t, t.at(20, 10, 3)));
  });

  it("repeats its streets of houses past its edge, so the town goes on (suburbAt)", () => {
    const t = town();
    for (const level of [2, 3, 4]) {
      for (const [x, v] of [
        [5000, 3000],
        [-4200, -2600],
      ]) {
        expect(t.suburbAt(x, v, level)).toBe(t.suburbAt(x + 780, v, level));
        expect(t.suburbAt(x, v, level)).toBe(t.suburbAt(x, v + 520, level));
      }
    }
  });
});

describe("drawTopTilt", () => {
  it("rises from the picture's camera, leaving the sky alone, to straight above the centre spot", () => {
    const t = town();
    const tones = new TopTones(t, DAY);
    const EMPTY = rgb(0xff00ff);
    const tilted = new Surface(240, 135);
    tilted.clear(EMPTY);
    drawTopTilt(tilted, t, tones, {
      cx: 120,
      cy: 90,
      k: 0.5,
      tilt: PICTURE_TILT,
    });
    expect(tilted.get(120, 0)).toBe(EMPTY);
    expect(tilted.get(120, 130)).not.toBe(EMPTY);
    const above = new Surface(240, 135);
    above.clear(EMPTY);
    drawTopTilt(above, t, tones, {
      cx: 120,
      cy: 90,
      k: 0.5,
      tilt: Math.PI / 2,
    });
    for (const c of above.data) expect(c).not.toBe(EMPTY);
    const greens = [P.grass, P.grassLight, P.grassDark].map((c) => DAY.lit(c));
    expect(greens).toContain(above.get(126, 86));
  });
});

describe("TopTones", () => {
  it("lights the lamps at night, and keeps the floodlit pitch bright", () => {
    const t = town();
    const lamp = t.colors.indexOf(LAMP);
    expect(lamp).toBeGreaterThanOrEqual(0);
    expect(new TopTones(t, NIGHT).color(lamp)).toBe(P.amber);
    expect(new TopTones(t, DAY).color(lamp)).not.toBe(P.amber);
    const pitch = t.at(30.5, 10.5, 0);
    expect(new TopTones(t, NIGHT).color(pitch)).toBe(
      NIGHT.lit(colorOf(t, pitch) as never),
    );
  });
});

describe("levelFor", () => {
  it("picks texels no smaller than a pixel's ground, near enough", () => {
    expect(levelFor(0.5)).toBe(0);
    expect(levelFor(1)).toBe(0);
    expect(levelFor(2)).toBe(1);
    expect(levelFor(4)).toBe(2);
    expect(levelFor(7)).toBe(3);
  });
});
