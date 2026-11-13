import { describe, expect, it } from "vitest";
import { careerLayout } from "~/art/layout";
import { lightingFor } from "~/art/lighting";
import { P } from "~/art/palette";
import { Surface, TRANSPARENT } from "~/pixel";
import { CareerGround } from "./ground";
import type { Life } from "./life";
import { ngGoalBack, ngGoalColors, ngGoalFront } from "./nextgen-low";
import type { Tier } from "./types";

const DAY = lightingFor({ elevation: 40, morning: false });
const NIGHT = lightingFor({ elevation: -30, morning: false });
const SIZES: readonly [number, number][] = [
  [960, 540],
  [260, 562],
  [683, 384],
  [234, 507],
];
const LABELS = { boards: ["PLAY DAILY", "HOME"] };

function render(
  era: "today" | "nextgen",
  tier: Tier,
  w: number,
  h: number,
  night = false,
  t = 3,
): { s: Surface; ground: CareerGround } {
  const ground = new CareerGround({
    seed: 2,
    mode: "home",
    tier,
    labels: LABELS,
    era,
  });
  ground.resize(w, h);
  ground.setLighting(night ? NIGHT : DAY);
  const s = new Surface(w, h);
  ground.drawBack(s, t);
  ground.drawFront(s, t, { y: ground.goal.barY + 8, amount: 1 });
  return { s, ground };
}

function differing(a: Surface, b: Surface): number {
  let n = 0;
  for (let i = 0; i < a.data.length; i++) if (a.data[i] !== b.data[i]) n++;
  return n;
}

describe("NEXT-GEN small grounds (tiers 0 to 3)", () => {
  for (const tier of [0, 1, 2, 3] as const) {
    for (const [w, h] of SIZES) {
      it(`tier ${tier} at ${w} x ${h} covers the canvas, day and night`, () => {
        for (const night of [false, true]) {
          const { s } = render("nextgen", tier, w, h, night);
          let holes = 0;
          for (let i = 0; i < s.data.length; i++) {
            if (s.data[i] === TRANSPARENT) holes++;
          }
          expect(holes).toBe(0);
        }
      });
    }

    it(`tier ${tier}: the goal, the light and the podium are HOME's; the look is not`, () => {
      const home = render("today", tier, 960, 540);
      const ng = render("nextgen", tier, 960, 540);
      expect(ng.ground.goal).toEqual(home.ground.goal);
      expect(ng.ground.light).toBe(home.ground.light);
      expect(ng.ground.podium).toEqual(home.ground.podium);
      // much of the far side and the near side are new art (open sky between the towers)
      expect(differing(home.s, ng.s)).toBeGreaterThan(960 * 540 * 0.12);
    });

    it(`tier ${tier} draws the same pixels for the same time, and moves`, () => {
      const a = render("nextgen", tier, 960, 540, false, 3).s;
      const b = render("nextgen", tier, 960, 540, false, 3).s;
      const c = render("nextgen", tier, 960, 540, false, 4.5).s;
      expect(differing(a, b)).toBe(0);
      // the hover traffic and the drones go on their way
      expect(differing(a, c)).toBeGreaterThan(0);
    });
  }

  it("copies only the skyline the finished layer leaves in view, to the same pixels", () => {
    for (const tier of [0, 3, 7] as const) {
      const { ground } = render("nextgen", tier, 960, 540);
      const inside = ground as unknown as { life: Life; layer: Surface };
      const city = inside.life.movers[0];
      const frame = (layer: Surface): Surface => {
        city.seen?.(layer);
        const s = new Surface(960, 540);
        s.clear(P.skyMid);
        city.sky?.(s, 2);
        s.blit(inside.layer, 0, 0);
        return s;
      };
      const all = frame(new Surface(960, 540));
      const seen = frame(inside.layer);
      expect(differing(all, seen)).toBe(0);
    }
  });

  it("crawls the holographic boards, but the corner flag's pole stays in front", () => {
    for (const tier of [2, 3] as const) {
      const a = render("nextgen", tier, 960, 540, false, 3);
      const b = render("nextgen", tier, 960, 540, false, 3.5).s;
      const F = careerLayout(960, 540).farTouchY;
      let moved = 0;
      for (let y = F - 14; y < F - 2; y++) {
        for (let x = 0; x < 300; x++)
          if (a.s.get(x, y) !== b.get(x, y)) moved++;
      }
      expect(moved).toBeGreaterThan(200);
      const life = (a.ground as unknown as { life: Life }).life;
      const flag = life.flags[0];
      for (let y = F - 12; y < F - 2; y++) {
        expect(a.s.get(flag.x, y)).toBe(flag.pole);
        expect(b.get(flag.x, y)).toBe(flag.pole);
      }
    }
  });

  it("tier 0's pylons stand on HOME's spots, lower than the rail behind", () => {
    const { groundY: gy, farTouchY, goalX } = careerLayout(960, 540);
    for (const dark of [false, true]) {
      const G = (c: number) => (dark ? (c & 0xff1f1f1f) >>> 0 : c) as never;
      const c = ngGoalColors(G);
      const s = new Surface(960, 540);
      ngGoalBack(s, goalX, gy, "jumpers", c);
      ngGoalFront(s, goalX, gy, "jumpers", c, null);
      let top = 540;
      let x0 = 960;
      let x1 = 0;
      for (let y = 0; y < 540; y++) {
        for (let x = 0; x < 960; x++) {
          if (s.get(x, y) === TRANSPARENT) continue;
          top = Math.min(top, y);
          x0 = Math.min(x0, x);
          x1 = Math.max(x1, x);
        }
      }
      // below the glass rail's foot, on HOME's two piles of jumpers (goalX - 14 to + 9; the
      // glow on the grass at night 2 px more either side)
      expect(top).toBeGreaterThan(farTouchY - 3);
      expect(top).toBeLessThan(gy - 12);
      expect(x0).toBeGreaterThanOrEqual(goalX - 14 - (dark ? 2 : 0));
      expect(x1).toBeLessThanOrEqual(goalX + 9 + (dark ? 2 : 0));
    }
  });

  it("leaves HOME alone: a ground with no era draws exactly as era today", () => {
    for (const tier of [0, 1, 2, 3] as const) {
      const draw = (era?: "today"): Surface => {
        const ground = new CareerGround({ seed: 2, mode: "home", tier, era });
        ground.resize(260, 562);
        ground.setLighting(NIGHT);
        const s = new Surface(260, 562);
        ground.drawBack(s, 3);
        ground.drawFront(s, 3);
        return s;
      };
      expect(differing(draw(), draw("today"))).toBe(0);
    }
  });
});
