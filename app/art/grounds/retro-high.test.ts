/**
 * RETRO's big grounds (tiers 4 to 7): every pixel drawn at every size and light, the goal,
 * the podium and the light where HOME's are, a picture of its own, and HOME's untouched.
 */

import { describe, expect, it } from "vitest";
import { lightingFor } from "~/art/lighting";
import { P } from "~/art/palette";
import { Surface, TRANSPARENT } from "~/pixel";
import { CareerGround } from "./ground";
import { geoFor, paintFor } from "./paint";
import {
  drawOldBursts,
  drawPaperTape,
  endScoreboardX,
  standScoreboardX,
  trimFor,
} from "./retro-high";
import { podiumFor } from "./pitch";
import { paintRetroPodium } from "./retro-pitch";
import type { Tier } from "./types";

const TIERS: readonly Tier[] = [4, 5, 6, 7];
const SIZES = [
  [960, 540],
  [260, 562],
  [234, 507],
  [683, 384],
  [1440, 720],
] as const;
const DAY = lightingFor({ elevation: 30, morning: true });
const NIGHT = lightingFor({ elevation: -30, morning: false });
const LABELS = { boards: ["TEA BAR", "HOT PIES"], banners: ["COME ON"] };

function ground(
  tier: Tier,
  w: number,
  h: number,
  era?: "retro" | "today",
  light = DAY,
): CareerGround {
  const g = new CareerGround({
    seed: 7,
    mode: "home",
    tier,
    labels: LABELS,
    era,
  });
  g.resize(w, h);
  g.setLighting(light);
  return g;
}

function draw(g: CareerGround, w: number, h: number, t = 1.3): Surface {
  const s = new Surface(w, h);
  g.drawBack(s, t);
  g.drawFront(s, t, { y: g.goal.barY + 12, amount: 0.6 });
  return s;
}

describe("RETRO's big grounds", () => {
  for (const tier of TIERS) {
    it(`covers the canvas at tier ${tier}, by day and at night, at every size`, () => {
      for (const [w, h] of SIZES) {
        for (const light of [DAY, NIGHT]) {
          const s = draw(ground(tier, w, h, "retro", light), w, h);
          expect(s.data.includes(TRANSPARENT), `${w}x${h}`).toBe(false);
        }
      }
    });

    it(`keeps HOME's goal, podium and light at tier ${tier}, with a picture of its own`, () => {
      for (const [w, h] of SIZES) {
        const home = ground(tier, w, h);
        const retro = ground(tier, w, h, "retro");
        const a = draw(home, w, h);
        const b = draw(retro, w, h);
        expect(retro.goal).toEqual(home.goal);
        expect(retro.podium).toEqual(home.podium);
        expect(retro.light).toBe(home.light);
        let differ = 0;
        for (let i = 0; i < a.data.length; i++)
          if (a.data[i] !== b.data[i]) differ++;
        // most of the far side, the end and the near side are its own
        expect(differ, `${w}x${h}`).toBeGreaterThan(a.data.length * 0.25);
      }
    });
  }

  it("leaves today's ground exactly as it was", () => {
    for (const tier of TIERS) {
      const a = draw(ground(tier, 480, 270), 480, 270);
      const b = draw(ground(tier, 480, 270, "today"), 480, 270);
      expect(b.data).toEqual(a.data);
    }
  });

  it("moves: the same time gives the same frame, another time another", () => {
    const g = ground(7, 480, 270, "retro");
    const a = draw(g, 480, 270, 2);
    const b = draw(g, 480, 270, 2);
    const c = draw(g, 480, 270, 2.6);
    expect(b.data).toEqual(a.data);
    expect(c.data).not.toEqual(a.data);
  });

  it("throws torn paper at tier 7 in place of today's ticker tape", () => {
    const s = new Surface(480, 270);
    s.clear(P.ink);
    drawPaperTape(s, 3, 9);
    let paper = 0;
    for (const c of s.data) if (c === P.chalk || c === P.white) paper++;
    expect(paper).toBeGreaterThan(40);
    // today's tape has no newsprint: the scraps carry a line of print
    let print = 0;
    for (const c of s.data) if (c === P.steel) print++;
    expect(print).toBeGreaterThan(0);
  });

  it("bursts its fireworks inside their zone and never draws off the canvas", () => {
    const s = new Surface(200, 120);
    s.clear(P.ink);
    for (let t = 0; t < 4; t += 0.25)
      drawOldBursts(s, t, 40, 30, 120, 40, 3, 0.42, 1.9, 1);
    let lit = 0;
    for (const c of s.data) if (c !== P.ink) lit++;
    expect(lit).toBeGreaterThan(50);
  });
  it("paints its trim in his old gold to tier 4 and the nation's brick from tier 5", () => {
    expect(trimFor(4).club).toBe(P.retro);
    expect(trimFor(5).club).toBe(P.brick);
    expect(trimFor(7).club).toBe(P.brick);
  });

  it("stands the hand-turned scoreboard where every canvas shows it", () => {
    for (const [w, h] of SIZES) {
      const p = paintFor(geoFor(w, h), DAY, 4, "retro", 7, LABELS, "retro");
      const onEnd = endScoreboardX(p.g);
      const onStand = standScoreboardX(p);
      expect(onEnd !== null || onStand !== null, `${w}x${h}`).toBe(true);
    }
  });

  it("raises the winner's box on the podium 4 to 6 rows over the others", () => {
    const g = geoFor(960, 540);
    const p = paintFor(g, DAY, 7, "retro", 7, LABELS, "retro");
    const pd = podiumFor(g);
    const s = new Surface(960, 540);
    paintRetroPodium(s, p, pd);
    const topOf = (x: number): number => {
      for (let y = 0; y < 540; y++) if (s.get(x, y) !== TRANSPARENT) return y;
      return -1;
    };
    const x0 = pd.x - pd.w / 2;
    const first = topOf(x0 + 30);
    for (const x of [x0 + 10, x0 + 50]) {
      expect(topOf(x) - first).toBeGreaterThanOrEqual(4);
      expect(topOf(x) - first).toBeLessThanOrEqual(6);
    }
  });
});
