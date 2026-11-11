import { describe, expect, it } from "vitest";
import { TRANSPARENT, luma, toOklab, toRgb, type Color } from "~/pixel";
import { distant, lightingFor, skyFor } from "./lighting";
import { P, PALETTE_NAMES } from "./palette";

const NOON = lightingFor({ elevation: 60, morning: false });
const NIGHT = lightingFor({ elevation: -30, morning: false });
const DUSK = lightingFor({ elevation: -3, morning: false });
const DAWN = lightingFor({ elevation: -3, morning: true });
const GOLDEN = lightingFor({ elevation: 6, morning: false });

function distance(a: Color, b: Color): number {
  const [l1, a1, b1] = toOklab(a);
  const [l2, a2, b2] = toOklab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

describe("phase", () => {
  it("is day at 6 degrees and above", () => {
    expect(lightingFor({ elevation: 6, morning: false }).phase).toBe("day");
    expect(lightingFor({ elevation: 6, morning: true }).phase).toBe("day");
    expect(lightingFor({ elevation: 90, morning: true }).phase).toBe("day");
  });

  it("is dusk or dawn from just under 6 down to -6", () => {
    expect(lightingFor({ elevation: 5.5, morning: false }).phase).toBe("dusk");
    expect(lightingFor({ elevation: 5.5, morning: true }).phase).toBe("dawn");
    expect(lightingFor({ elevation: 0, morning: false }).phase).toBe("dusk");
    expect(lightingFor({ elevation: -6, morning: false }).phase).toBe("dusk");
    expect(lightingFor({ elevation: -6, morning: true }).phase).toBe("dawn");
  });

  it("is night below -6", () => {
    expect(lightingFor({ elevation: -6.5, morning: false }).phase).toBe(
      "night",
    );
    expect(lightingFor({ elevation: -6.5, morning: true }).phase).toBe("night");
    expect(lightingFor({ elevation: -90, morning: true }).phase).toBe("night");
  });
});

describe("lightsOn", () => {
  it("switches on below 4 degrees", () => {
    expect(lightingFor({ elevation: 4, morning: false }).lightsOn).toBe(false);
    expect(lightingFor({ elevation: 45, morning: false }).lightsOn).toBe(false);
    expect(lightingFor({ elevation: 3.5, morning: false }).lightsOn).toBe(true);
    expect(lightingFor({ elevation: 3.5, morning: true }).lightsOn).toBe(true);
    expect(lightingFor({ elevation: -30, morning: false }).lightsOn).toBe(true);
  });
});

describe("env", () => {
  it("is the identity in full daylight", () => {
    for (const elevation of [20, 45, 60, 90]) {
      const light = lightingFor({ elevation, morning: false });
      for (const name of PALETTE_NAMES) {
        expect(light.env(P[name]), name).toBe(P[name]);
        expect(light.lit(P[name]), name).toBe(P[name]);
      }
    }
  });

  it("makes every palette colour darker at night, but never black", () => {
    for (const name of PALETTE_NAMES) {
      const out = NIGHT.env(P[name]);
      expect(luma(out), name).toBeLessThan(luma(P[name]));
      const [r, g, b] = toRgb(out);
      expect(r + g + b, name).toBeGreaterThan(0);
    }
  });

  it("keeps dark shapes apart at night", () => {
    // Shapes must still read: neighbouring steps of a ramp stay different colours.
    expect(NIGHT.env(P.ink)).not.toBe(NIGHT.env(P.slate));
    expect(NIGHT.env(P.concreteDark)).not.toBe(NIGHT.env(P.concrete));
    expect(NIGHT.env(P.brickDark)).not.toBe(NIGHT.env(P.brick));
    expect(NIGHT.env(P.grassDeep)).not.toBe(NIGHT.env(P.grassDark));
    expect(luma(NIGHT.env(P.chalk))).toBeGreaterThan(
      luma(NIGHT.env(P.concrete)),
    );
  });

  it("turns the night blue", () => {
    const [, , b] = toOklab(NIGHT.env(P.chalk));
    expect(b).toBeLessThan(-0.02);
  });

  it("is warm in the golden hour and only a little dimmer", () => {
    const out = GOLDEN.env(P.chalk);
    const [, a, b] = toOklab(out);
    const [, a0, b0] = toOklab(P.chalk);
    expect(a).toBeGreaterThan(a0);
    expect(b).toBeGreaterThan(b0);
    expect(luma(out)).toBeGreaterThan(luma(P.chalk) * 0.85);
    expect(luma(out)).toBeLessThan(luma(P.chalk));
  });

  it("is dimmer at dusk than in the golden hour, and darker again at night", () => {
    for (const c of [P.chalk, P.grass, P.brick, P.concrete]) {
      expect(luma(DUSK.env(c))).toBeLessThan(luma(GOLDEN.env(c)));
      expect(luma(NIGHT.env(c))).toBeLessThan(luma(DUSK.env(c)));
    }
  });

  it("makes dawn cooler and pinker than dusk", () => {
    const [, , bDawn] = toOklab(DAWN.env(P.chalk));
    const [, , bDusk] = toOklab(DUSK.env(P.chalk));
    expect(bDawn).toBeLessThan(bDusk);
    const [, aDawn] = toOklab(DAWN.env(P.chalk));
    expect(aDawn).toBeGreaterThan(0);
  });

  it("changes smoothly from one half degree to the next", () => {
    for (const morning of [false, true]) {
      for (let e = -30; e < 30; e += 0.5) {
        const a = lightingFor({ elevation: e, morning });
        const b = lightingFor({ elevation: e + 0.5, morning });
        for (const name of PALETTE_NAMES) {
          const where = `${name} at ${e}`;
          expect(distance(a.env(P[name]), b.env(P[name])), where).toBeLessThan(
            0.03,
          );
          expect(distance(a.lit(P[name]), b.lit(P[name])), where).toBeLessThan(
            0.06,
          );
        }
      }
    }
  });

  it("leaves transparent alone", () => {
    expect(NIGHT.env(TRANSPARENT)).toBe(TRANSPARENT);
    expect(NIGHT.lit(TRANSPARENT)).toBe(TRANSPARENT);
  });

  it("only ever returns opaque colours for opaque colours", () => {
    for (const light of [NIGHT, DUSK, DAWN, GOLDEN]) {
      for (const name of PALETTE_NAMES) {
        expect(light.env(P[name]) >>> 24, name).toBe(0xff);
        expect(light.lit(P[name]) >>> 24, name).toBe(0xff);
      }
    }
  });
});

describe("lit", () => {
  it("keeps a floodlit pitch much brighter than the night around it", () => {
    for (const c of [P.grass, P.grassLight]) {
      expect(luma(NIGHT.lit(c)) - luma(NIGHT.env(c))).toBeGreaterThan(0.15);
    }
    for (const c of [P.grassDeep, P.grassDark, P.grass, P.grassLight]) {
      expect(luma(NIGHT.lit(c))).toBeGreaterThan(luma(NIGHT.env(c)) * 1.5);
    }
    // Vivid: still clearly green.
    const [r, g, b] = toRgb(NIGHT.lit(P.grass));
    expect(g).toBeGreaterThan(r + 60);
    expect(g).toBeGreaterThan(b + 40);
  });

  it("keeps the mode colours apart under floodlights", () => {
    const [homeR, , homeB] = toRgb(NIGHT.lit(P.home));
    const [awayR, , awayB] = toRgb(NIGHT.lit(P.away));
    expect(homeR).toBeGreaterThan(homeB + 80);
    expect(awayB).toBeGreaterThan(awayR + 80);
  });

  it("is slightly cool at night", () => {
    for (const c of [P.chalk, P.concreteLight, P.grass]) {
      const [, , before] = toOklab(c);
      const [, , after] = toOklab(NIGHT.lit(c));
      expect(after).toBeLessThan(before);
      expect(before - after).toBeLessThan(0.03);
    }
  });

  it("equals env whenever the lights are off", () => {
    for (const elevation of [4, 6, 12, 30]) {
      for (const morning of [false, true]) {
        const light = lightingFor({ elevation, morning });
        expect(light.lightsOn).toBe(false);
        for (const name of PALETTE_NAMES) {
          expect(light.lit(P[name]), name).toBe(light.env(P[name]));
        }
      }
    }
  });

  it("fades the floodlights up as the daylight goes", () => {
    const justOn = lightingFor({ elevation: 3.5, morning: false });
    expect(distance(justOn.lit(P.grass), justOn.env(P.grass))).toBeLessThan(
      0.02,
    );
    expect(luma(DUSK.lit(P.grass))).toBeGreaterThan(luma(DUSK.env(P.grass)));
  });
});

describe("lightingFor", () => {
  it("returns the same object for the same sun", () => {
    const a = lightingFor({ elevation: 12, morning: true });
    const b = lightingFor({ elevation: 12, morning: true });
    expect(a).toBe(b);
  });

  it("rounds elevation to half a degree", () => {
    const a = lightingFor({ elevation: 10.1, morning: false });
    expect(lightingFor({ elevation: 10.2, morning: false })).toBe(a);
    expect(lightingFor({ elevation: 9.8, morning: false })).toBe(a);
    expect(a.sun.elevation).toBe(10);
    expect(lightingFor({ elevation: 10.3, morning: false }).sun.elevation).toBe(
      10.5,
    );
  });

  it("keeps morning and evening apart", () => {
    const evening = lightingFor({ elevation: -3, morning: false });
    const morning = lightingFor({ elevation: -3, morning: true });
    expect(evening).not.toBe(morning);
    expect(evening.sun.morning).toBe(false);
    expect(morning.sun.morning).toBe(true);
  });

  it("memoises its grades, and they work unbound", () => {
    const { env, lit } = NIGHT;
    expect(env(P.grass)).toBe(NIGHT.env(P.grass));
    expect(lit(P.grass)).toBe(NIGHT.lit(P.grass));
    expect([P.grass, P.brick].map(env)).toEqual([
      NIGHT.env(P.grass),
      NIGHT.env(P.brick),
    ]);
  });

  it("copes with a broken sun", () => {
    expect(() => lightingFor({ elevation: NaN, morning: false })).not.toThrow();
    expect(lightingFor({ elevation: 1000, morning: false }).phase).toBe("day");
    expect(lightingFor({ elevation: -1000, morning: false }).phase).toBe(
      "night",
    );
  });
});

describe("skyFor", () => {
  it("gives seven bands and six rising stops", () => {
    for (const light of [NOON, NIGHT, DUSK, DAWN, GOLDEN]) {
      const sky = skyFor(light);
      expect(sky.bands).toHaveLength(7);
      expect(sky.stops).toHaveLength(6);
      for (let i = 1; i < sky.stops.length; i++) {
        expect(sky.stops[i]).toBeGreaterThan(sky.stops[i - 1]);
      }
      expect(sky.stops[0]).toBeGreaterThan(0);
      expect(sky.stops[5]).toBeLessThan(1);
    }
  });

  it("thins the bands towards the horizon", () => {
    const { stops } = skyFor(NOON);
    const heights = [stops[0]];
    for (let i = 1; i < stops.length; i++)
      heights.push(stops[i] - stops[i - 1]);
    heights.push(1 - stops[stops.length - 1]);
    for (let i = 1; i < heights.length; i++) {
      expect(heights[i]).toBeLessThan(heights[i - 1] + 1e-9);
    }
  });

  it("is cached per lighting", () => {
    expect(skyFor(NIGHT)).toBe(skyFor(NIGHT));
    expect(skyFor(NIGHT)).not.toBe(skyFor(DUSK));
  });

  it("uses the palette's skies at their own times", () => {
    expect(skyFor(NOON).bands[0]).toBe(P.skyTop);
    expect(skyFor(NOON).bands[6]).toBe(P.haze);
    expect(skyFor(NIGHT).bands[0]).toBe(P.nightTop);
    expect(skyFor(DUSK).bands[0]).toBe(P.duskTop);
    expect(skyFor(DUSK).bands[2]).toBe(P.duskMid);
    expect(skyFor(DUSK).bands[4]).toBe(P.duskLow);
    expect(skyFor(DUSK).bands[6]).toBe(P.duskGlow);
    expect(skyFor(DAWN).bands[0]).toBe(P.dawnTop);
    expect(skyFor(DAWN).bands[6]).toBe(P.dawnGlow);
  });

  it("brings the stars and the moon out at night only", () => {
    expect(skyFor(NOON).stars).toBe(0);
    expect(skyFor(NOON).moonVisibility).toBe(0);
    expect(skyFor(GOLDEN).stars).toBe(0);
    expect(skyFor(NIGHT).stars).toBe(1);
    expect(skyFor(NIGHT).moonVisibility).toBe(1);
    const dusk = skyFor(DUSK).stars;
    expect(dusk).toBeGreaterThanOrEqual(0);
    expect(dusk).toBeLessThan(0.2);
  });

  it("glows on the horizon when the sun is low, and not at noon or at night", () => {
    expect(skyFor(NOON).glowStrength).toBe(0);
    expect(skyFor(NIGHT).glowStrength).toBe(0);
    expect(skyFor(DUSK).glowStrength).toBeGreaterThan(0.5);
    expect(skyFor(DAWN).glowStrength).toBeGreaterThan(0.5);
    expect(skyFor(DUSK).glow).toBe(P.duskGlow);
  });

  it("gets darker from day to dusk to night at the zenith", () => {
    expect(luma(skyFor(DUSK).bands[0])).toBeLessThan(
      luma(skyFor(NOON).bands[0]),
    );
    expect(luma(skyFor(NIGHT).bands[0])).toBeLessThan(
      luma(skyFor(DUSK).bands[0]),
    );
  });

  it("lights the clouds from below at dusk", () => {
    const [, top, , under] = skyFor(DUSK).cloudNear;
    expect(luma(under)).toBeGreaterThan(luma(top));
    const [, dayTop, , dayUnder] = skyFor(NOON).cloudNear;
    expect(luma(dayTop)).toBeGreaterThan(luma(dayUnder));
    expect(skyFor(NOON).cloudLight).toBe(P.cloudLight);
    expect(skyFor(NOON).cloudShade).toBe(P.cloudShade);
  });

  it("keeps a bright sun and a moon that stands out from the night", () => {
    for (const light of [NOON, GOLDEN, DUSK, DAWN]) {
      const sky = skyFor(light);
      expect(luma(sky.sunDisc)).toBeGreaterThan(luma(sky.bands[6]) - 0.02);
    }
    const night = skyFor(NIGHT);
    expect(luma(night.moon) - luma(night.bands[1])).toBeGreaterThan(0.6);
  });
});

describe("skyFor, between its keys", () => {
  it("steps evenly from band to band at every time of day", () => {
    for (const morning of [false, true]) {
      for (let elevation = 30; elevation >= -24; elevation -= 1.5) {
        const { bands } = skyFor(lightingFor({ elevation, morning }));
        const steps: number[] = [];
        for (let i = 1; i < bands.length; i++) {
          steps.push(distance(bands[i - 1], bands[i]));
        }
        const where = `${elevation} ${morning ? "morning" : "evening"}`;
        // No two bands so close they read as one, and no step three times another.
        expect(Math.min(...steps), where).toBeGreaterThan(0.025);
        expect(Math.max(...steps) / Math.min(...steps), where).toBeLessThan(3);
      }
    }
  });

  it("never jumps from one half degree to the next", () => {
    for (const morning of [false, true]) {
      let last = skyFor(lightingFor({ elevation: 24, morning }));
      for (let elevation = 23.5; elevation >= -20; elevation -= 0.5) {
        const sky = skyFor(lightingFor({ elevation, morning }));
        const where = `${elevation} ${morning ? "morning" : "evening"}`;
        for (let i = 0; i < sky.bands.length; i++) {
          expect(distance(sky.bands[i], last.bands[i]), where).toBeLessThan(
            0.05,
          );
        }
        for (let i = 0; i < 4; i++) {
          expect(
            distance(sky.cloudNear[i], last.cloudNear[i]),
            where,
          ).toBeLessThan(0.06);
          expect(
            distance(sky.cloudFar[i], last.cloudFar[i]),
            where,
          ).toBeLessThan(0.06);
        }
        expect(
          Math.abs(sky.moonVisibility - last.moonVisibility),
          where,
        ).toBeLessThan(0.13);
        expect(Math.abs(sky.stars - last.stars), where).toBeLessThan(0.05);
        last = sky;
      }
    }
  });

  it("brings the moon up from nothing", () => {
    expect(skyFor(DUSK).moonVisibility).toBe(0);
    const early = skyFor(lightingFor({ elevation: -3.5, morning: false }));
    expect(early.moonVisibility).toBeGreaterThan(0);
    expect(early.moonVisibility).toBeLessThan(0.05);
    expect(
      skyFor(lightingFor({ elevation: -9, morning: false })).moonVisibility,
    ).toBe(1);
  });
});

describe("distant", () => {
  it("is env up close and leaves transparent alone", () => {
    for (const light of [NOON, DUSK, NIGHT]) {
      expect(distant(light, P.brick, 0)).toBe(light.env(P.brick));
      expect(distant(light, TRANSPARENT, 0.5)).toBe(TRANSPARENT);
    }
  });

  it("sinks towards the low sky with depth, in every light", () => {
    for (const light of [NOON, GOLDEN, DUSK, DAWN, NIGHT]) {
      const sky = skyFor(light).bands[5];
      for (const c of [P.slate, P.brick, P.grassDark, P.chalk]) {
        let last = distance(light.env(c), sky);
        for (const depth of [0.25, 0.5, 0.75, 1]) {
          const d = distance(distant(light, c, depth), sky);
          expect(d).toBeLessThan(last);
          last = d;
        }
        // The far horizon still is not the sky itself.
        expect(last).toBeGreaterThan(0);
      }
    }
  });

  it("keeps two shapes apart, but closer, at a distance", () => {
    const near = distance(NOON.env(P.slate), NOON.env(P.chalk));
    const far = distance(distant(NOON, P.slate, 1), distant(NOON, P.chalk, 1));
    expect(far).toBeLessThan(near * 0.5);
    expect(far).toBeGreaterThan(0.05);
  });

  it("copes with odd depths and is cached", () => {
    expect(distant(NOON, P.brick, -3)).toBe(NOON.env(P.brick));
    expect(distant(NOON, P.brick, 9)).toBe(distant(NOON, P.brick, 1));
    expect(distant(NOON, P.brick, NaN)).toBe(NOON.env(P.brick));
    expect(distant(DUSK, P.brick, 0.5)).toBe(distant(DUSK, P.brick, 0.5));
  });
});
