/**
 * NEXT-GEN's arena (tiers 4 to 7, nextgen-high.ts): it draws every pixel at every tier and
 * size, it is not HOME's picture, and the places the scene aims at (the goal, the podium)
 * and today's picture are untouched.
 */

import { describe, expect, it } from "vitest";
import type { Era } from "~/art/era";
import { lightingFor, type Lighting } from "~/art/lighting";
import { P } from "~/art/palette";
import { Surface, TRANSPARENT, type Color } from "~/pixel";
import { CareerGround, type Tier } from "./index";
import { goalColors } from "./goal";
import { arenaGoalBack, arenaGoalFront, drawGlowTape } from "./nextgen-high";

const DAY = lightingFor({ elevation: 35, morning: false });
const NIGHT = lightingFor({ elevation: -25, morning: false });
const LABELS = { boards: ["SOCCERSENSE", "PLAY DAILY"], banners: ["COME ON"] };
const SIZES: readonly [number, number][] = [
  [960, 540],
  [260, 562],
  [683, 384],
  [234, 507],
];
const HIGH: readonly Tier[] = [4, 5, 6, 7];

function render(
  tier: Tier,
  era: Era | undefined,
  w = 960,
  h = 540,
  light: Lighting = DAY,
  mode: "home" | "away" = "home",
  t = 1,
): { s: Surface; ground: CareerGround } {
  const ground = new CareerGround({
    seed: 7,
    mode,
    tier,
    labels: LABELS,
    ...(era ? { era } : {}),
  });
  ground.resize(w, h);
  ground.setLighting(light);
  const s = new Surface(w, h);
  ground.drawBack(s, t);
  ground.drawFront(s, t);
  return { s, ground };
}

function count(s: Surface, c: number): number {
  let n = 0;
  for (let i = 0; i < s.data.length; i++) if (s.data[i] === c) n++;
  return n;
}

describe("NEXT-GEN's arena", () => {
  for (const tier of HIGH) {
    for (const [w, h] of SIZES) {
      it(`covers the canvas and is its own picture at tier ${tier}, ${w} x ${h}`, () => {
        const ng = render(tier, "nextgen", w, h);
        const home = render(tier, undefined, w, h);
        expect(ng.s.data.includes(TRANSPARENT)).toBe(false);
        expect(ng.s.data).not.toEqual(home.s.data);
        // the scene aims at the same goal and stands him on the same podium
        expect(ng.ground.goal).toEqual(home.ground.goal);
        expect(ng.ground.podium).toEqual(home.ground.podium);
        expect(ng.ground.light).toBe(home.ground.light);
      });
    }
  }

  it("leaves today's picture alone: era 'today' is HOME's and AWAY's picture", () => {
    for (const tier of HIGH) {
      for (const mode of ["home", "away"] as const) {
        const plain = render(tier, undefined, 480, 270, DAY, mode);
        const today = render(tier, "today", 480, 270, DAY, mode);
        expect(today.s.data).toEqual(plain.s.data);
      }
    }
  });

  it("is lit with its own light: the ribbon's magenta and the cyan strips, by day and night", () => {
    for (const light of [DAY, NIGHT]) {
      const { s } = render(4, "nextgen", 960, 540, light);
      expect(count(s, P.nextgenLight)).toBeGreaterThan(400);
      expect(count(s, P.skyLow)).toBeGreaterThan(400);
    }
  });

  it("moves: drones, the ribbon's pulse, the light sticks and the lasers change the picture", () => {
    for (const tier of HIGH) {
      const a = render(tier, "nextgen", 960, 540, DAY, "home", 1).s;
      const b = render(tier, "nextgen", 960, 540, DAY, "home", 1.7).s;
      let n = 0;
      for (let i = 0; i < a.data.length; i++) if (a.data[i] !== b.data[i]) n++;
      expect(n).toBeGreaterThan(200);
    }
  });

  it("puts glowing confetti, not ticker tape, over tier 7", () => {
    const s = new Surface(260, 562);
    s.clear(P.ink);
    drawGlowTape(s, 1.3, 7);
    expect(count(s, P.nextgenLight) + count(s, P.skyLow)).toBeGreaterThan(20);
    // the confetti is drawn in front of everything: it changes from frame to frame
    const a = render(7, "nextgen", 260, 562, DAY, "home", 1).s;
    const b = render(7, "nextgen", 260, 562, DAY, "home", 1.1).s;
    expect(a.data).not.toEqual(b.data);
  });

  it("stands a goal of tubes of light at tiers 4 to 7: white faces, cyan cores, ink behind", () => {
    const G = (c: Color): Color => c;
    expect(goalColors(G, 3, "nextgen").arena).toBeUndefined();
    expect(goalColors(G, 4, "today").arena).toBeUndefined();
    const c = goalColors(G, 4, "nextgen").arena;
    expect(c).toBeDefined();
    if (!c) return;
    const s = new Surface(120, 100);
    s.clear(P.slate);
    arenaGoalBack(s, 50, 80, c);
    arenaGoalFront(s, 50, 80, c, null);
    // the near post and the bar: a face of white and a core of cyan light 2 px wide in all
    expect(count(s, P.white)).toBeGreaterThan(48 + 20);
    expect(count(s, P.awayLight)).toBeGreaterThan(48 + 20);
    // the near post's column, top to foot: ink, white, cyan, steel, ink
    const row = 80 + 4 - 20;
    expect([51, 52, 53, 54, 55].map((x) => s.get(x, row))).toEqual([
      P.ink,
      P.white,
      P.awayLight,
      P.steelHi,
      P.ink,
    ]);
  });

  it("draws the same pixels for the same inputs", () => {
    const a = render(6, "nextgen", 683, 384, NIGHT, "home", 2.2).s;
    const b = render(6, "nextgen", 683, 384, NIGHT, "home", 2.2).s;
    expect(a.data).toEqual(b.data);
  });
});
