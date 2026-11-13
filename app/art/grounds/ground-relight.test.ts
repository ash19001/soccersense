// The career ground relit a slice a frame (a change of light keeps the last picture
// up until the new one is done) and the next tier built ahead under a promotion's smoke
// (`prepare`). Either way the picture it ends on is the one built at once.

import { describe, expect, it } from "vitest";

import { lightingFor } from "~/art/lighting";
import { Surface } from "~/pixel";
import type { Tier } from "./types";
import { CareerGround } from "./ground";

const W = 480;
const H = 270;
const light = (elevation: number) => lightingFor({ elevation, morning: false });

function ground(tier: number, elevation: number): CareerGround {
  const g = new CareerGround({ seed: 4, mode: "home", tier: tier as Tier });
  g.setLighting(light(elevation));
  g.resize(W, H);
  return g;
}

function frame(g: CareerGround): Uint32Array {
  const s = new Surface(W, H);
  g.drawBack(s, 3.5);
  g.drawFront(s, 3.5);
  return s.data.slice();
}

/** The ground under the sky (the sky itself follows the light at once). */
const belowSky = (data: Uint32Array): Uint32Array =>
  data.slice(W * Math.round(H * 0.6));

const same = (a: Uint32Array, b: Uint32Array): boolean =>
  a.length === b.length && a.every((v, i) => v === b[i]);

describe("the career ground", () => {
  it.each([0, 1, 4])(
    "tier %i: a change of light keeps the last picture, then shows the new one whole",
    (tier) => {
      const g = ground(tier, 2);
      const before = frame(g);
      g.setLighting(light(-12));
      // the frame of the change: the last picture still, under the sky
      expect(same(belowSky(frame(g)), belowSky(before))).toBe(true);
      let frames = 1;
      const want = frame(ground(tier, -12));
      let now = frame(g);
      while (!same(now, want) && frames < 60) {
        now = frame(g);
        frames++;
      }
      expect(same(now, want)).toBe(true);
      expect(frames).toBeGreaterThan(3);
    },
    60_000,
  );

  it.each([0, 3, 5])(
    "tier %i to the next: prepared ahead, the tier swaps in whole on its first frame",
    (tier) => {
      const g = ground(tier, 20);
      frame(g);
      g.prepare(tier + 1);
      for (let i = 0; i < 20; i++) frame(g);
      g.setTier((tier + 1) as Tier);
      expect(same(frame(g), frame(ground(tier + 1, 20)))).toBe(true);
    },
    60_000,
  );
});
