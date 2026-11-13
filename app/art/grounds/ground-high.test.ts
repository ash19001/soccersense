/**
 * The career ground's high tiers: the stand's heights, the goals, the podium and the
 * stadium's tiers (4 to 7).
 */

import { describe, expect, it } from "vitest";
import { careerLayout } from "~/art/layout";
import { lightingFor } from "~/art/lighting";
import { Surface, TRANSPARENT } from "~/pixel";
import { STAND } from "./stand";
import { geoFor, paintFor, pocket } from "./paint";
import {
  CareerGround,
  FINAL_NIGHT,
  GROUND_TIERS,
  type CrowdMood,
  type Tier,
} from "./index";

const DAY = lightingFor({ elevation: 35, morning: false });
const NIGHT = lightingFor({ elevation: -25, morning: false });
const LABELS = { boards: ["SOCCERSENSE", "PLAY DAILY"], banners: ["COME ON"] };
const W = 960;
const H = 540;

function render(
  tier: Tier,
  opts: {
    w?: number;
    h?: number;
    mode?: "home" | "away";
    light?: ReturnType<typeof lightingFor>;
    t?: number;
    mood?: CrowdMood;
    seed?: number;
    bulge?: { y: number; amount: number } | null;
  } = {},
): { s: Surface; ground: CareerGround } {
  const w = opts.w ?? W;
  const h = opts.h ?? H;
  const ground = new CareerGround({
    seed: opts.seed ?? 7,
    mode: opts.mode ?? "home",
    tier,
    labels: LABELS,
  });
  ground.resize(w, h);
  ground.setLighting(opts.light ?? DAY);
  if (opts.mood) ground.setMood(opts.mood, 0);
  const s = new Surface(w, h);
  ground.drawBack(s, opts.t ?? 1);
  ground.drawFront(s, opts.t ?? 1, opts.bulge);
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

describe("the stand", () => {
  it("has its heights above the far touchline", () => {
    expect(STAND).toEqual({
      roofTop: 142,
      upperTop: 126,
      balcony: 78,
      boxes: 74,
      lowerTop: 62,
      boards: 14,
    });
  });

  it("puts the travelling pocket's foot on the balcony, 12 px wider than 26 stage px", () => {
    const g = geoFor(W, H);
    const pk = pocket(paintFor(g, DAY, 4, "away", 1, {}));
    expect(pk[2]).toBe(g.F - 78);
    expect(pk[1] - pk[0]).toBe(Math.round(26 * g.k) + 12);
  });

  it("puts the street's foot 16 px above the far touchline", () => {
    const g = geoFor(W, H);
    expect(g.F - g.B).toBe(16);
  });
});

describe("the goal", () => {
  it("has its numbers for each kind", () => {
    const c = careerLayout(W, H);
    const goals = GROUND_TIERS.map((tier) => render(tier).ground.goal);
    expect(goals[0]).toEqual({
      kind: "jumpers",
      lineX: c.goalX,
      barY: c.groundY - 30,
      depth: 0,
    });
    expect(goals[1]).toEqual({
      kind: "small",
      lineX: c.goalX,
      barY: c.groundY - 34,
      depth: 16,
    });
    for (const tier of [2, 3, 4, 5, 6, 7]) {
      expect(goals[tier]).toEqual({
        kind: "full",
        lineX: c.goalX,
        barY: c.groundY - 48,
        depth: 22,
      });
    }
  });

  it("stands its posts 4 px thick on their feet", () => {
    const { s, ground } = render(4);
    const c = careerLayout(W, H);
    const gy = c.groundY;
    const lx = ground.goal.lineX;
    const white = s.get(lx + 2, gy);
    // the near post: columns lineX + 2 .. + 5 down to its foot on gy + 4
    for (let x = lx + 2; x <= lx + 5; x++) {
      expect(s.get(x, gy + 3)).not.toBe(s.get(lx + 12, gy + 3));
    }
    expect(s.get(lx + 2, gy + 3)).toBe(white);
    expect(s.get(lx + 2, gy + 4)).not.toBe(white);
    // the far post: columns lineX - 8 .. - 5, its last pixel on gy - 7
    const far = s.get(lx - 6, gy - 7);
    for (let x = lx - 8; x <= lx - 5; x++)
      expect(s.get(x, gy - 20)).not.toBe(s.get(lx - 20, gy - 20));
    expect(s.get(lx - 6, gy - 6)).not.toBe(far);
  });

  it("bulges only when asked, near the ball's height", () => {
    const flat = render(4, { bulge: null }).s;
    const none = render(4, { bulge: { y: 250, amount: 0 } }).s;
    const full = render(4, { bulge: { y: 250, amount: 1 } }).s;
    expect(diff(flat, none)).toBe(0);
    expect(diff(flat, full)).toBeGreaterThan(0);
    const c = careerLayout(W, H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (flat.get(x, y) !== full.get(x, y)) {
          expect(Math.abs(y - 250)).toBeLessThanOrEqual(16);
          expect(x).toBeGreaterThan(c.goalX);
          expect(x).toBeLessThan(c.goalX + 40);
        }
      }
    }
  });

  it("lets a 6 x 6 ball in the net show through the mesh", () => {
    for (const tier of [1, 4] as const) {
      const ground = new CareerGround({ seed: 1, mode: "home", tier });
      ground.resize(W, H);
      ground.setLighting(DAY);
      const s = new Surface(W, H);
      ground.drawBack(s, 0);
      const g = ground.goal;
      const bx = g.lineX + 10;
      const by = g.barY + 16;
      const ball = s.get(0, 0) === 1 ? 2 : 1;
      s.rect(bx, by, 6, 6, ball as never);
      ground.drawFront(s, 0);
      let seen = 0;
      for (let y = by; y < by + 6; y++)
        for (let x = bx; x < bx + 6; x++)
          if ((s.get(x, y) as number) === ball) seen++;
      expect(seen).toBeGreaterThanOrEqual(24);
      expect(seen).toBeLessThan(36);
    }
  });
});

describe("the stadium", () => {
  it("covers the canvas at every stadium tier, mode and light, monitor and phone", () => {
    for (const [w, h] of [
      [W, H],
      [683, 384],
      [260, 562],
      [234, 507],
    ] as const) {
      for (const tier of [4, 5, 6, 7] as const) {
        for (const mode of ["home", "away"] as const) {
          for (const light of [DAY, NIGHT]) {
            expect(holes(render(tier, { w, h, mode, light }).s)).toBe(0);
          }
        }
      }
    }
  });

  it("is night at tiers 6 and 7, and the same pixels for the same inputs", () => {
    for (const tier of [4, 5, 6, 7] as const) {
      const a = render(tier, { t: 3.3, mood: "roar" });
      const b = render(tier, { t: 3.3, mood: "roar" });
      expect(diff(a.s, b.s)).toBe(0);
      if (tier >= 6) expect(a.ground.light).toBe(FINAL_NIGHT);
    }
    expect(
      diff(render(6, { light: DAY }).s, render(6, { light: NIGHT }).s),
    ).toBe(0);
  });

  it("moves: the boards crawl, the flags wave, the fireworks burst, the tape falls", () => {
    const a = render(7, { t: 1 }).s;
    const b = render(7, { t: 1.5 }).s;
    expect(diff(a, b)).toBeGreaterThan(500);
  });

  it("puts the podium under the hero at tier 7 only", () => {
    const c = careerLayout(W, H);
    expect(render(6).ground.podium).toBeNull();
    const pd = render(7).ground.podium;
    expect(pd).toEqual({ x: c.heroX, top: c.groundY - 10, w: 60 });
  });
});
