/**
 * Tiers 0 to 3 of the career ground (his street, the park, the hut, the small and proper
 * grounds, the near sides, the pitch) and their moving things.
 */

import { describe, expect, it } from "vitest";
import { lightingFor } from "~/art/lighting";
import { P } from "~/art/palette";
import { Surface, TRANSPARENT } from "~/pixel";
import { paintBoards, paintStreet } from "./far";
import { CareerGround, CROWD_MOODS, type CrowdMood, type Tier } from "./index";
import { Life, drawPerched, drawRope, drawSmoke } from "./life";
import { HOUSE_W, WALL_H, across, geoFor, paintFor } from "./paint";
import { tuft } from "./pitch";
import { STAND } from "./stand";

const DAY = lightingFor({ elevation: 35, morning: false });
const NIGHT = lightingFor({ elevation: -25, morning: false });
const LABELS = { boards: ["SOCCERSENSE", "PLAY DAILY"], banners: ["COME ON"] };
const LOW: readonly Tier[] = [0, 1, 2, 3];

/** Canvases across art bible 2.1's ranges (monitors and phones). */
const SIZES: readonly (readonly [number, number])[] = [
  [960, 540],
  [683, 384],
  [854, 480],
  [1440, 720],
  [260, 562],
  [234, 507],
  [215, 400],
];

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
  } = {},
): { s: Surface; ground: CareerGround } {
  const w = opts.w ?? 960;
  const h = opts.h ?? 540;
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
  ground.drawFront(s, opts.t ?? 1);
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

/** The paint context of a build. */
function paint(tier: Tier, w = 960, h = 540, light = DAY) {
  return paintFor(geoFor(w, h), light, tier, "home", 7, LABELS);
}

describe("the small grounds cover the canvas", () => {
  for (const [w, h] of SIZES) {
    it(`tiers 0 to 3, both modes, day and night at ${w} x ${h}`, () => {
      for (const tier of LOW) {
        for (const mode of ["home", "away"] as const) {
          for (const light of [DAY, NIGHT]) {
            const { s } = render(tier, { w, h, mode, light });
            expect(holes(s), `tier ${tier} ${mode} ${light.phase}`).toBe(0);
          }
        }
      }
    }, 30000);
  }

  it("every mood at every small tier, at times through a minute", () => {
    for (const tier of LOW) {
      const ground = new CareerGround({
        seed: 7,
        mode: "home",
        tier,
        labels: LABELS,
      });
      ground.resize(960, 540);
      ground.setLighting(DAY);
      const s = new Surface(960, 540);
      for (const mood of CROWD_MOODS) {
        ground.setMood(mood, 0);
        for (const t of [0, 0.4, 3.3, 17, 59.9]) {
          s.clear();
          ground.drawBack(s, t);
          ground.drawFront(s, t);
          expect(holes(s), `tier ${tier} ${mood} ${t}`).toBe(0);
        }
      }
    }
  }, 30000);
});

describe("the small grounds are drawn", () => {
  it("the same inputs give the same pixels", () => {
    for (const tier of LOW) {
      const a = render(tier, { t: 2.5, light: NIGHT }).s;
      const b = render(tier, { t: 2.5, light: NIGHT }).s;
      expect(diff(a, b), `tier ${tier}`).toBe(0);
    }
  });

  it("builds the terrace: walls of 34 px under 10 px of roof", () => {
    const p = paint(0);
    const s = new Surface(960, 540);
    const life = new Life(0);
    paintStreet(s, p, life);
    const { g } = p;
    // his house: the wall's top row and the roof's ridge over it
    const x = g.houseX + HOUSE_W / 2;
    expect(WALL_H).toBe(34);
    expect(s.get(x, g.B - WALL_H)).not.toBe(TRANSPARENT);
    expect(s.get(x, g.B - WALL_H - 10)).not.toBe(TRANSPARENT);
    expect(s.get(x, g.B - WALL_H - 11)).toBe(TRANSPARENT);
    // smoke rises from chimneys, each over its stack, and the washing hangs out
    expect(life.smoke.length).toBeGreaterThan(0);
    for (const c of life.smoke) {
      expect(s.get(c.x, c.y)).toBe(TRANSPARENT);
      expect(s.get(c.x + 2, c.y + 6)).not.toBe(TRANSPARENT);
    }
    expect(life.washing).not.toBeNull();
  });

  it("paints the boards' words in the native font, 10 px tall", () => {
    const p = paint(2);
    const plain = { ...p, labels: {} };
    const a = new Surface(960, 40);
    const b = new Surface(960, 40);
    paintBoards(a, p, 10, 14);
    paintBoards(b, plain, 10, 14);
    expect(diff(a, b)).toBeGreaterThan(0);
    // the letters reach the board's tenth row, and nothing is drawn outside the strip
    let rows = 0;
    for (let y = 10; y < 24; y++) {
      for (let x = 0; x < 960; x++) {
        if (a.get(x, y) !== b.get(x, y)) {
          rows++;
          break;
        }
      }
    }
    expect(rows).toBeGreaterThanOrEqual(10);
    for (let x = 0; x < 960; x++) {
      expect(a.get(x, 9)).toBe(TRANSPARENT);
      expect(a.get(x, 24)).toBe(TRANSPARENT);
    }
  });

  it("keeps the pitch's lines 1 px wide (markings are not doubled)", () => {
    const { s } = render(2);
    const chalk = DAY.lit(P.chalk);
    const g = geoFor(960, 540);
    // the far touchline: one row of chalk at F, grass on either side
    expect(s.get(100, g.F)).toBe(chalk);
    expect(s.get(100, g.F + 1)).not.toBe(chalk);
    // the goal line near the near touchline (leaning to the camera) is one pixel wide
    const at = across(g, g.goalX, g.N - 3);
    let run = 0;
    for (let x = at - 8; x <= at + 8; x++)
      if (s.get(x, g.N - 3) === chalk) run++;
    expect(run).toBe(1);
  });

  it("puts the mates on the railings and the parents behind the rope", () => {
    const t0 = render(0).ground as unknown as {
      life: Life;
      geo: { F: number };
    };
    expect(t0.life.watchers.length).toBe(2);
    for (const w of t0.life.watchers) expect(w.y).toBe(t0.geo.F + 2);
    const t1 = render(1).ground as unknown as {
      life: Life;
      geo: { F: number };
    };
    expect(t1.life.watchers.length).toBeGreaterThan(4);
    for (const w of t1.life.watchers) expect(w.y).toBe(t1.geo.F - 2);
    expect(t1.life.rope?.y).toBe(t1.geo.F - 8);
  });

  it("hangs the moon over a stadium clear above its roof (tiers 4 to 7)", () => {
    for (const tier of [4, 5, 6, 7] as const) {
      const { ground } = render(tier, { light: NIGHT });
      const g = ground as unknown as {
        sky: { moon?: { x: number; y: number } };
        geo: { F: number };
      };
      const moon = g.sky.moon;
      expect(moon, `tier ${tier}`).toBeDefined();
      expect(moon!.y).toBeLessThan(g.geo.F - STAND.roofTop);
      expect(moon!.y).toBeGreaterThan(0);
    }
  });
});

describe("the small grounds' moving things", () => {
  it("grass clusters: a dark tuft is blades on a base, never a lone pixel", () => {
    for (let seed = 0; seed < 4; seed++) {
      for (let cy = 0; cy < 20; cy++) {
        for (let cx = 0; cx < 20; cx++) {
          let n = 0;
          for (let y = cy * 6; y < cy * 6 + 6; y++)
            for (let x = cx * 8; x < cx * 8 + 8; x++)
              if (tuft(x, y, seed, 0.5, false) === 1) n++;
          expect([0, 5, 7]).toContain(n);
        }
      }
    }
  });

  it("a perched bird stays in its 9 x 8 box over its spot", () => {
    const life = new Life(0);
    life.perchColor = P.slate;
    life.perched.push({ x: 20, y: 20 }, { x: 60, y: 20 });
    for (const t of [0, 0.5, 1, 2.2, 4.1, 9]) {
      const s = new Surface(80, 30);
      drawPerched(s, life, t, 3);
      for (let y = 0; y < 30; y++) {
        for (let x = 0; x < 80; x++) {
          if (s.get(x, y) === TRANSPARENT) continue;
          const b = x < 40 ? life.perched[0] : life.perched[1];
          expect(Math.abs(x - b.x)).toBeLessThanOrEqual(10);
          expect(y).toBeLessThan(b.y);
          expect(y).toBeGreaterThanOrEqual(b.y - 9);
        }
      }
    }
  });

  it("the rope is 2 px thick, sags 2 px between stakes 10 px tall", () => {
    const s = new Surface(100, 30);
    drawRope(s, 0, 100, 10, 24, P.chalk, P.wood);
    // half way between two stakes the rope is two rows lower
    let top = -1;
    for (let y = 0; y < 30; y++) {
      if (s.get(12, y) !== TRANSPARENT) {
        top = y;
        break;
      }
    }
    expect(top).toBe(12);
    expect(s.get(12, 13)).not.toBe(TRANSPARENT);
    expect(s.get(12, 14)).toBe(TRANSPARENT);
    // a stake from y - 3 to y + 7
    expect(s.get(24, 7)).not.toBe(TRANSPARENT);
    expect(s.get(24, 17)).not.toBe(TRANSPARENT);
    expect(s.get(24, 18)).toBe(TRANSPARENT);
  });

  it("smoke draws only in its two colours, above the chimney, through a whole loop", () => {
    const life = new Life(0);
    life.smoke.push({ x: 20, y: 40 });
    life.smokeColors = [P.mist, P.steel];
    for (let t = 0; t < 5; t += 0.2) {
      const s = new Surface(60, 50);
      drawSmoke(s, life, t);
      for (let i = 0; i < s.data.length; i++) {
        const c = s.data[i];
        if (c === TRANSPARENT) continue;
        expect([P.mist, P.steel]).toContain(c);
        expect(Math.floor(i / 60)).toBeLessThanOrEqual(42);
      }
    }
  });
});
