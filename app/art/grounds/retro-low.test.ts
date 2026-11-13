/**
 * RETRO's small grounds (tiers 0 to 3, retro-low.ts, retro-club.ts, goal-retro.ts): they
 * draw at every size and light, cover the canvas, keep HOME's composition (the goal, the
 * touchlines, the podium) and leave today's look exactly as it was.
 */

import { describe, expect, it } from "vitest";
import type { Era } from "~/art/era";
import { lightingFor } from "~/art/lighting";
import { P } from "~/art/palette";
import { Surface, TRANSPARENT } from "~/pixel";
import { CareerGround, type Tier } from "./index";
import { goalColors } from "./goal";
import { geoFor, paintFor } from "./paint";
import { RETRO_WARM, retroWarm } from "./retro-grade";

const DAY = lightingFor({ elevation: 35, morning: false });
const NIGHT = lightingFor({ elevation: -25, morning: false });
const LABELS = { boards: ["SOCCERSENSE", "PLAY DAILY"], banners: ["COME ON"] };
const LOW: readonly Tier[] = [0, 1, 2, 3];

/** Canvases across the art bible's ranges (monitors and phones). */
const SIZES: readonly (readonly [number, number])[] = [
  [960, 540],
  [683, 384],
  [1440, 720],
  [260, 562],
  [234, 507],
  [215, 400],
];

function render(
  tier: Tier,
  era: Era | undefined,
  w = 960,
  h = 540,
  light = DAY,
  bulge = 0,
): { s: Surface; ground: CareerGround } {
  const ground = new CareerGround({
    seed: 7,
    mode: "home",
    tier,
    labels: LABELS,
    ...(era ? { era } : {}),
  });
  ground.resize(w, h);
  ground.setLighting(light);
  const s = new Surface(w, h);
  ground.drawBack(s, 2.3);
  const b = bulge > 0 ? { y: ground.goal.barY + 12, amount: bulge } : null;
  ground.drawFront(s, 2.3, b);
  return { s, ground };
}

function holes(s: Surface): number {
  let n = 0;
  for (let i = 0; i < s.data.length; i++) if (s.data[i] === TRANSPARENT) n++;
  return n;
}

function diff(a: Surface, b: Surface): number {
  let n = 0;
  for (let i = 0; i < a.data.length; i++) if (a.data[i] !== b.data[i]) n++;
  return n;
}

describe("RETRO's small grounds", () => {
  it("draw every pixel at every tier, size and light", () => {
    for (const tier of LOW) {
      for (const [w, h] of SIZES) {
        for (const light of [DAY, NIGHT]) {
          const { s } = render(tier, "retro", w, h, light);
          expect(holes(s), `tier ${tier} ${w}x${h}`).toBe(0);
        }
      }
    }
  }, 60_000);

  it("look different from today's at every tier", () => {
    for (const tier of LOW) {
      const a = render(tier, "today").s;
      const b = render(tier, "retro").s;
      expect(diff(a, b), `tier ${tier}`).toBeGreaterThan(960 * 540 * 0.2);
    }
  }, 60_000);

  it("keep the composition: the goal, the podium, the light", () => {
    for (const tier of LOW) {
      for (const [w, h] of SIZES) {
        const a = render(tier, "today", w, h).ground;
        const b = render(tier, "retro", w, h).ground;
        expect(b.goal).toEqual(a.goal);
        expect(b.podium).toEqual(a.podium);
        expect(b.light).toBe(a.light);
      }
    }
  }, 60_000);

  it("leave today's look as it was (no era is today)", () => {
    for (const tier of LOW) {
      for (const light of [DAY, NIGHT]) {
        const a = render(tier, undefined, 960, 540, light, 0.6).s;
        const b = render(tier, "today", 960, 540, light, 0.6).s;
        expect(diff(a, b)).toBe(0);
      }
    }
    const g = geoFor(960, 540);
    for (const tier of LOW) {
      const p = paintFor(g, DAY, tier, "home", 7, LABELS);
      expect(p.era).toBe("today");
      expect(goalColors(p.S, tier).style).toBeUndefined();
    }
  }, 60_000);

  it("draw the wooden goal with a rope net, which a shot pushes out", () => {
    for (const tier of [1, 2, 3] as const) {
      const g = geoFor(960, 540);
      const p = paintFor(g, DAY, tier, "home", 7, LABELS, "retro");
      expect(goalColors(p.S, tier, "retro").style).toBe("wood");
      const still = render(tier, "retro", 960, 540, DAY, 0).s;
      const hit = render(tier, "retro", 960, 540, DAY, 1).s;
      // the bulge moves the back of the net, behind the goal line only
      let n = 0;
      let before = 0;
      for (let y = 0; y < 540; y++) {
        for (let x = 0; x < 960; x++) {
          if (still.get(x, y) === hit.get(x, y)) continue;
          n++;
          if (x < g.goalX - 6) before++;
        }
      }
      expect(n, `tier ${tier}`).toBeGreaterThan(10);
      expect(before).toBe(0);
    }
  }, 60_000);

  it("warms every tier alike with one grade, a faded warmth and never a brown fog", () => {
    const g = geoFor(960, 540);
    // one grade at every tier, so the promotion from 3 to 4 keeps its colour
    const warm = [0, 1, 2, 3, 4, 5, 6, 7].map((tier) => {
      const today = paintFor(g, DAY, tier as Tier, "home", 7, LABELS);
      const retro = paintFor(g, DAY, tier as Tier, "home", 7, LABELS, "retro");
      expect(retro.S(P.grass)).not.toBe(today.S(P.grass));
      expect(retro.S(P.grass)).toBe(today.S(retroWarm(P.grass)));
      expect(retro.E(P.brick)).toBe(today.E(retroWarm(P.brick)));
      return retro;
    });
    expect(warm[4].S(P.chalk)).toBe(warm[2].S(P.chalk));
    // a faded warmth, not a brown fog: every colour stays most of the way to itself
    expect(RETRO_WARM).toBeLessThanOrEqual(0.2);
  });
});
