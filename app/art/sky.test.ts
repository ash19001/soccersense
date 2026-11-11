import { describe, expect, it } from "vitest";
import { Surface, TRANSPARENT, type Sun } from "~/pixel";
import { lightingFor, skyFor } from "./lighting";
import {
  cloudSprite,
  drawSky,
  moonPosition,
  sunPosition,
  type SkyOptions,
} from "./sky";

const DAY: Sun = { elevation: 45, morning: false };
const DUSK: Sun = { elevation: -3, morning: false };
const DAWN: Sun = { elevation: -3, morning: true };
const NIGHT: Sun = { elevation: -30, morning: false };

function render(
  w: number,
  h: number,
  sun: Sun,
  opts: Partial<SkyOptions> = {},
): Surface {
  const s = new Surface(w, h);
  drawSky(s, {
    light: lightingFor(sun),
    t: 0,
    seed: 7,
    horizonY: Math.round(h * 0.44),
    ...opts,
  });
  return s;
}

function same(a: Surface, b: Surface): boolean {
  if (a.w !== b.w || a.h !== b.h) return false;
  for (let i = 0; i < a.data.length; i++) {
    if (a.data[i] !== b.data[i]) return false;
  }
  return true;
}

function count(s: Surface, c: number): number {
  let n = 0;
  for (let i = 0; i < s.data.length; i++) if (s.data[i] === c) n++;
  return n;
}

describe("drawSky", () => {
  it.each([DAY, DUSK, DAWN, NIGHT])(
    "fills down to the horizon and nothing below it (%o)",
    (sun) => {
      const s = render(130, 281, sun);
      const horizonY = Math.round(281 * 0.44);
      for (let y = 0; y < s.h; y++) {
        for (let x = 0; x < s.w; x++) {
          const painted = s.get(x, y) !== TRANSPARENT;
          if (painted !== y < horizonY) {
            throw new Error(`pixel ${x},${y} painted=${painted}`);
          }
        }
      }
    },
  );

  it("is deterministic", () => {
    for (const sun of [DAY, DUSK, NIGHT]) {
      const a = render(130, 281, sun, { t: 12.3 });
      const b = render(130, 281, sun, { t: 12.3 });
      expect(same(a, b)).toBe(true);
    }
  });

  it("moves with time and changes with the seed", () => {
    expect(same(render(130, 281, DAY), render(130, 281, DAY, { t: 30 }))).toBe(
      false,
    );
    expect(
      same(render(130, 281, NIGHT), render(130, 281, NIGHT, { seed: 8 })),
    ).toBe(false);
  });

  it("does not move when nothing should: one frame apart, no clouds, by day", () => {
    const a = render(
      130,
      281,
      { elevation: 60, morning: false },
      { clouds: 0 },
    );
    const b = render(
      130,
      281,
      { elevation: 60, morning: false },
      { clouds: 0, t: 1 / 60 },
    );
    expect(same(a, b)).toBe(true);
  });

  it("never leaves a hole or paints below the horizon, at any time", () => {
    for (const t of [0, 13.7, 250, 99999.5, -40]) {
      const s = render(130, 281, NIGHT, { clouds: 1, t });
      expect(count(s, TRANSPARENT)).toBe(130 * (281 - Math.round(281 * 0.44)));
    }
  });

  it("uses only the band colours for a clear noon sky, plus the sun and the birds", () => {
    const light = lightingFor({ elevation: 75, morning: false });
    const s = render(130, 281, light.sun, { clouds: 0 });
    const sky = skyFor(light);
    const bands = new Set<number>(sky.bands);
    const others = new Set<number>();
    for (let i = 0; i < s.data.length; i++) {
      const c = s.data[i];
      if (c !== TRANSPARENT && !bands.has(c)) others.add(c);
    }
    // The disc, the two tones of its glow, and the birds.
    expect(others.has(sky.sunDisc)).toBe(true);
    expect(others.size).toBeLessThanOrEqual(4);
  });

  it("keeps the sun and the moon below clearTop, and puts the sun where it is told", () => {
    const noon = lightingFor({ elevation: 80, morning: false });
    const disc = skyFor(noon).sunDisc;
    const s = render(130, 281, noon.sun, {
      clouds: 0,
      clearTop: 40,
      sunX: 100,
    });
    let top = 999;
    let left = 999;
    let right = -1;
    for (let y = 0; y < s.h; y++) {
      for (let x = 0; x < s.w; x++) {
        if (s.get(x, y) !== disc) continue;
        top = Math.min(top, y);
        left = Math.min(left, x);
        right = Math.max(right, x);
      }
    }
    expect(top).toBeGreaterThanOrEqual(40);
    expect((left + right) / 2).toBe(100);

    const moon = skyFor(lightingFor(NIGHT)).moon;
    const n = render(130, 281, NIGHT, { clouds: 0, clearTop: 60 });
    for (let y = 0; y < 60; y++) {
      for (let x = 0; x < n.w; x++) expect(n.get(x, y)).not.toBe(moon);
    }
    expect(count(n, moon)).toBeGreaterThan(60);
  });

  it("fades the moon in from nothing", () => {
    // Just after it starts to show, the moon is within a whisker of the sky behind it.
    const early = lightingFor({ elevation: -3.5, morning: false });
    expect(skyFor(early).moonVisibility).toBeGreaterThan(0);
    expect(skyFor(early).moonVisibility).toBeLessThan(0.05);
    const withMoon = render(130, 281, early.sun, { clouds: 0 });
    const without = render(130, 281, early.sun, { clouds: 0, moonPhase: 0 });
    let worst = 0;
    for (let i = 0; i < withMoon.data.length; i++) {
      const a = withMoon.data[i];
      const b = without.data[i];
      if (a === b) continue;
      for (const shift of [0, 8, 16]) {
        worst = Math.max(
          worst,
          Math.abs(((a >>> shift) & 0xff) - ((b >>> shift) & 0xff)),
        );
      }
    }
    expect(worst).toBeLessThan(12);
  });

  it("starts at the zenith colour and ends at the horizon colour", () => {
    const light = lightingFor(DAY);
    const s = render(130, 281, DAY, { clouds: 0 });
    const sky = skyFor(light);
    expect(s.get(0, 0)).toBe(sky.bands[0]);
    expect(s.get(0, Math.round(281 * 0.44) - 1)).toBe(sky.bands[6]);
  });

  it("shows stars at night and none by day", () => {
    const sky = skyFor(lightingFor(NIGHT));
    const night = render(130, 281, NIGHT, { clouds: 0 });
    const stars =
      count(night, sky.starColors[0]) +
      count(night, sky.starColors[1]) +
      count(night, sky.starColors[2]);
    expect(stars).toBeGreaterThan(20);
    expect(stars).toBeLessThan(200);
    const day = render(130, 281, DAY, { clouds: 0 });
    expect(count(day, sky.starColors[1])).toBe(0);
  });

  it("twinkles: some stars change, most do not", () => {
    const a = render(130, 281, NIGHT, { clouds: 0, t: 0 });
    const b = render(130, 281, NIGHT, { clouds: 0, t: 0.4 });
    let changed = 0;
    for (let i = 0; i < a.data.length; i++) {
      if (a.data[i] !== b.data[i]) changed++;
    }
    expect(changed).toBeLessThan(60);
  });

  it("cuts the moon to its phase", () => {
    const moon = skyFor(lightingFor(NIGHT)).moon;
    const lit = (moonPhase: number): number =>
      count(render(130, 281, NIGHT, { clouds: 0, moonPhase }), moon);
    const full = lit(0.5);
    expect(full).toBeGreaterThan(60);
    expect(lit(0)).toBe(0);
    expect(lit(1)).toBe(0);
    const quarter = lit(0.25);
    expect(quarter).toBeGreaterThan(full * 0.3);
    expect(quarter).toBeLessThan(full * 0.7);
    const crescent = lit(0.1);
    expect(crescent).toBeGreaterThan(0);
    expect(crescent).toBeLessThan(quarter);
    // Waxing is lit on the right, waning on the left: mirror images in area.
    expect(Math.abs(lit(0.75) - quarter)).toBeLessThan(full * 0.25);
  });

  it("has no moon by day", () => {
    const moon = skyFor(lightingFor(NIGHT)).moon;
    expect(count(render(130, 281, DAY, { clouds: 0 }), moon)).toBe(0);
  });

  it("draws the default cloud cover when none is given, and none at zero", () => {
    const clear = render(130, 281, DAY, { clouds: 0 });
    const some = render(130, 281, DAY);
    const lots = render(130, 281, DAY, { clouds: 1 });
    const white = skyFor(lightingFor(DAY)).cloudNear[1];
    expect(count(clear, white)).toBe(0);
    expect(count(some, white)).toBeGreaterThan(0);
    expect(count(lots, white)).toBeGreaterThan(count(some, white));
  });

  it("starts with the sun and the moon in the open, whatever the seed", () => {
    const morning: Sun = { elevation: 30, morning: true };
    for (const [w, h] of [
      [130, 281],
      [480, 270],
    ]) {
      for (let seed = 1; seed <= 8; seed++) {
        for (const sun of [DAY, morning]) {
          const disc = skyFor(lightingFor(sun)).sunDisc;
          const open = count(render(w, h, sun, { seed, clouds: 0 }), disc);
          expect(count(render(w, h, sun, { seed }), disc)).toBe(open);
        }
        const moon = skyFor(lightingFor(NIGHT)).moon;
        const open = count(render(w, h, NIGHT, { seed, clouds: 0 }), moon);
        expect(count(render(w, h, NIGHT, { seed }), moon)).toBe(open);
      }
    }
  });

  it("lets the clouds drift on from there without a jump", () => {
    // One second on, the near clouds have moved one pixel and the far ones none or one.
    const a = render(130, 281, DAY, { t: 20 });
    const b = render(130, 281, DAY, { t: 21 });
    const white = skyFor(lightingFor(DAY)).cloudNear[1];
    expect(count(a, white)).toBeGreaterThan(0);
    let changed = 0;
    for (let i = 0; i < a.data.length; i++) {
      if (a.data[i] !== b.data[i]) changed++;
    }
    expect(changed).toBeGreaterThan(0);
    expect(changed).toBeLessThan(400);
  });

  it.each([
    [120, 222],
    [130, 281],
    [160, 300],
    [195, 310],
    [400, 250],
    [480, 270],
    [720, 360],
  ])("works at %i x %i at every time of day", (w, h) => {
    for (const sun of [DAY, DUSK, DAWN, NIGHT]) {
      const horizonY = Math.round(h * 0.44);
      const s = render(w, h, sun, { t: 5 });
      expect(count(s, TRANSPARENT)).toBe(w * (h - horizonY));
    }
  });

  it("copes with any horizon, odd numbers and tiny surfaces", () => {
    const light = lightingFor(DUSK);
    for (const horizonY of [0, -5, 1, 3, 17, 60.4, 281, 500, NaN]) {
      const s = new Surface(130, 281);
      expect(() =>
        drawSky(s, { light, t: 3, seed: 1, horizonY }),
      ).not.toThrow();
      const rows = Number.isFinite(horizonY)
        ? Math.max(0, Math.min(281, Math.round(horizonY)))
        : 0;
      expect(count(s, TRANSPARENT)).toBe(130 * (281 - rows));
    }
    const tiny = new Surface(1, 1);
    expect(() =>
      drawSky(tiny, { light, t: NaN, seed: NaN, horizonY: 1 }),
    ).not.toThrow();
    expect(tiny.get(0, 0)).not.toBe(TRANSPARENT);
  });

  it("respects the caller's clip and restores it", () => {
    const s = new Surface(130, 281);
    s.clip(10, 10, 50, 50);
    drawSky(s, { light: lightingFor(DAY), t: 0, seed: 1, horizonY: 124 });
    expect(s.get(5, 5)).toBe(TRANSPARENT);
    expect(s.get(20, 20)).not.toBe(TRANSPARENT);
    expect(s.get(70, 70)).toBe(TRANSPARENT);
    s.rect(0, 0, 130, 281, skyFor(lightingFor(DAY)).bands[0]);
    expect(s.get(5, 5)).toBe(TRANSPARENT);
    s.unclip();
  });
});

describe("sunPosition", () => {
  const W = 130;
  const H = 124;
  const at = (elevation: number, morning: boolean) =>
    sunPosition(lightingFor({ elevation, morning }), W, H);

  it("sits on the horizon line at 0 degrees", () => {
    expect(at(0, false).y).toBe(H);
    expect(at(0, true).y).toBe(H);
  });

  it("climbs all morning and is still in view at noon", () => {
    let last = at(0, true).y;
    for (const elevation of [5, 15, 30, 50, 70, 90]) {
      const sun = at(elevation, true);
      expect(sun.y).toBeLessThan(last);
      expect(sun.y - sun.r).toBeGreaterThan(0);
      last = sun.y;
    }
  });

  it("never rises above clearTop", () => {
    const high = sunPosition(
      lightingFor({ elevation: 90, morning: false }),
      W,
      H,
      42,
    );
    expect(high.y - high.r).toBeGreaterThanOrEqual(42);
    const low = sunPosition(
      lightingFor({ elevation: 0, morning: false }),
      W,
      H,
      42,
    );
    expect(low.y).toBe(H);
  });

  it("stays in the column it is given, mirrored in the morning", () => {
    const evening = (elevation: number) =>
      sunPosition(lightingFor({ elevation, morning: false }), W, H, 0, 120);
    expect(evening(3).x).toBe(120);
    expect(evening(60).x).toBe(120);
    const morning = lightingFor({ elevation: 20, morning: true });
    expect(sunPosition(morning, W, H, 0, 120).x).toBe(10);
  });

  it("is gone soon after it sets, however short the sky", () => {
    for (const horizonY of [124, 88, 40]) {
      const set = sunPosition(
        lightingFor({ elevation: -3, morning: false }),
        W,
        horizonY,
        30,
      );
      expect(set.y - set.r).toBeGreaterThanOrEqual(horizonY);
    }
  });

  it("is below the horizon when the elevation is negative", () => {
    const set = at(-10, false);
    expect(set.y - set.r).toBeGreaterThan(H);
  });

  it("is in the left third in the morning and the right third in the evening", () => {
    expect(at(5, true).x).toBeLessThan(W / 3);
    expect(at(5, false).x).toBeGreaterThan((W * 2) / 3);
  });

  it("rises and sets in one column, mirrored between morning and evening", () => {
    expect(at(40, false).x).toBe(at(5, false).x);
    expect(at(40, true).x).toBe(at(-2, true).x);
    expect(at(20, true).x).toBe(W - at(20, false).x);
  });

  it("shares its morning column with the moon", () => {
    for (const w of [120, 130, 480]) {
      const sun = sunPosition(
        lightingFor({ elevation: 9, morning: true }),
        w,
        H,
      );
      expect(moonPosition(w, H).x).toBe(sun.x);
    }
  });
});

describe("moonPosition", () => {
  it("sits in the upper left, clear of the top of the sky", () => {
    for (const [w, horizonY] of [
      [120, 98],
      [130, 124],
      [480, 119],
      [720, 158],
    ]) {
      const moon = moonPosition(w, horizonY);
      expect(moon.x + moon.r).toBeLessThan(w / 3);
      expect(moon.x - moon.r).toBeGreaterThan(0);
      expect(moon.y - moon.r).toBeGreaterThan(horizonY * 0.3);
      expect(moon.y + moon.r).toBeLessThan(horizonY * 0.5);
    }
  });

  it("drops below clearTop when the top of the sky is covered", () => {
    const moon = moonPosition(130, 88, 42);
    expect(moon.y - moon.r).toBeGreaterThanOrEqual(42);
    expect(moonPosition(130, 124, 10).y).toBe(moonPosition(130, 124).y);
  });
});

describe("cloudSprite", () => {
  const tones = skyFor(lightingFor(DAY)).cloudNear;

  it("is flat on its bottom row and about as wide as asked", () => {
    for (const width of [12, 18, 24, 32, 44]) {
      for (let seed = 1; seed < 12; seed++) {
        const c = cloudSprite(seed, width, tones);
        expect(Math.abs(c.w - width)).toBeLessThanOrEqual(4);
        expect(c.h).toBeGreaterThanOrEqual(4);
        expect(c.h).toBeLessThan(c.w);
        let first = -1;
        let last = -1;
        let gaps = 0;
        for (let x = 0; x < c.w; x++) {
          if (c.get(x, c.h - 1) !== TRANSPARENT) {
            if (first < 0) first = x;
            last = x;
          } else if (first >= 0) gaps++;
        }
        // One unbroken run along the base, most of the cloud's width.
        expect(gaps).toBe(c.w - 1 - last);
        expect(last - first + 1).toBeGreaterThan(c.w * 0.6);
      }
    }
  });

  it("uses only its tones", () => {
    // Top, mid, underside, the one blend between mid and underside, and transparent
    // (by day the rim is the same white as the top).
    for (let seed = 1; seed < 8; seed++) {
      const c = cloudSprite(seed, 40, tones);
      expect(new Set<number>(c.data).size).toBeLessThanOrEqual(5);
    }
  });

  it("is the same cloud for the same seed", () => {
    expect(cloudSprite(5, 30, tones)).toBe(cloudSprite(5, 30, tones));
    expect(same(cloudSprite(5, 30, tones), cloudSprite(6, 30, tones))).toBe(
      false,
    );
  });
});
