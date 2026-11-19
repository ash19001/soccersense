/**
 * Space (./cosmos.ts): FURTHEST's career out from the Earth, a scale a tier, each drawn
 * whole and named, the names clear of the pin.
 */
import { describe, expect, it } from "vitest";

import { Surface } from "~/pixel";

import { AU, LY, type CosmosLabels, cosmosSpots, drawCosmos } from "./cosmos";
import { P } from "./palette";

const LABELS: CosmosLabels = {
  moon: "THE MOON",
  sun: "THE SUN",
  mercury: "MERCURY",
  venus: "VENUS",
  mars: "MARS",
  jupiter: "JUPITER",
  saturn: "SATURN",
  uranus: "URANUS",
  neptune: "NEPTUNE",
  alphaCentauri: "ALPHA CENTAURI",
  barnard: "BARNARD'S STAR",
  sirius: "SIRIUS",
  milkyWay: "THE MILKY WAY",
  andromeda: "ANDROMEDA",
  triangulum: "TRIANGULUM",
  magellanic: "MAGELLANIC CLOUDS",
  universe: "THE OBSERVABLE UNIVERSE",
  asteroidBelt: "ASTEROID BELT",
  kuiperBelt: "KUIPER BELT",
  oortCloud: "OORT CLOUD",
};

const [w, h] = [320, 180];

/** km across the picture for each tier from 1: the Moon, the planets, ..., the universe. */
const ACROSS = [
  9e5,
  3 * AU,
  60 * AU,
  25 * LY,
  1.4e5 * LY,
  3.5e6 * LY,
  2.5e11 * LY,
];

function draw(kpp: number, opts: { labels?: boolean; keep?: boolean } = {}) {
  const s = new Surface(w, h);
  s.clear(P.white);
  drawCosmos(s, {
    ex: w * 0.3,
    ey: h * 0.5,
    kpp,
    k: 1,
    seed: 7,
    ...(opts.labels !== false && { labels: LABELS }),
    ...(opts.keep && { keep: { x: 0, y: 0, w, h } }),
  });
  return s;
}

describe("space", () => {
  it("shows more of it a tier, further out", () => {
    let last = 0;
    for (let tier = 1; tier <= 7; tier++) {
      const far = Math.max(
        ...cosmosSpots(tier).map((p) => Math.hypot(p.x, p.y)),
      );
      expect(far, `tier ${tier}`).toBeGreaterThan(last * 2);
      last = far;
    }
  });

  it("fills the picture at every scale, and each looks different", () => {
    const seen = new Set<string>();
    for (const across of ACROSS) {
      const s = draw(across / w);
      let white = 0;
      for (const c of s.data) if (c === P.white) white++;
      // only stars and lit things are white: never the bare page
      expect(white).toBeLessThan(w * h * 0.02);
      seen.add(Buffer.from(s.data.buffer).toString("base64"));
    }
    expect(seen.size).toBe(ACROSS.length);
  });

  it("names what it shows, and nothing over the pin", () => {
    for (const across of ACROSS) {
      const kpp = across / w;
      const plain = draw(kpp, { labels: false });
      const named = draw(kpp);
      const kept = draw(kpp, { keep: true });
      expect(
        Buffer.from(named.data.buffer).equals(Buffer.from(plain.data.buffer)),
      ).toBe(false);
      // a keep box over all of it: no names at all
      expect(
        Buffer.from(kept.data.buffer).equals(Buffer.from(plain.data.buffer)),
      ).toBe(true);
    }
  });
});
