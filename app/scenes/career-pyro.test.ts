/**
 * The goal show (career-pyro.ts): what a goal sets off at each kind of ground, how it grows
 * with the shot, and that it is a pure function of the time and a seed.
 */
import { describe, expect, test } from "vitest";

import { careerLayout } from "~/art/layout";
import { P } from "~/art/palette";
import { Surface } from "~/pixel";
import { CareerScene } from "./career";
import {
  CONFETTI_FROM,
  PYRO_SECONDS,
  type Pyro,
  birdCount,
  cannonPieces,
  drawPyroBack,
  drawPyroFront,
  drawPyroRig,
  flareCount,
  flarePlaces,
  jetCount,
  jetHeight,
  jetLevel,
  jetPulses,
  jetX,
  jetsLit,
  newPyro,
  pyroKind,
} from "./career-pyro";

const SIZES: readonly (readonly [number, number])[] = [
  [960, 540],
  [260, 562],
  [683, 384],
];

/** A show at `tier`, `age` seconds after a goal of `size`, on a `w` x `h` canvas. */
function show(
  tier: number,
  age: number,
  size: number,
  w = 960,
  h = 540,
  era: Pyro["era"] = "today",
): Pyro {
  const L = careerLayout(w, h);
  const p = newPyro();
  p.age = age;
  p.size = size;
  p.tier = tier;
  p.era = era;
  p.seed = 7;
  p.w = L.w;
  p.x0 = L.stageLeft;
  p.x1 = L.stageRight;
  p.touchY = L.farTouchY;
  p.groundY = L.groundY;
  p.goalX = L.goalX;
  return p;
}

/** How many pixels a painter changed on a blank canvas, and the rows they are in. */
function painted(w: number, h: number, paint: (s: Surface) => void) {
  const s = new Surface(w, h);
  s.clear(P.ink);
  const b = s.bytes;
  const r0 = b[0];
  const g0 = b[1];
  const b0 = b[2];
  paint(s);
  let n = 0;
  let top = h;
  let bottom = -1;
  for (let y = 0; y < h; y++) {
    let any = false;
    const end = (y + 1) * w * 4;
    for (let i = y * w * 4; i < end; i += 4) {
      if (b[i] !== r0 || b[i + 1] !== g0 || b[i + 2] !== b0) {
        n++;
        any = true;
      }
    }
    if (any) {
      if (y < top) top = y;
      bottom = y;
    }
  }
  return { n, top, bottom, s };
}

/** Whether two canvases hold the same pixels. */
function same(a: Surface, b: Surface): boolean {
  const x = a.bytes;
  const y = b.bytes;
  if (x.length !== y.length) return false;
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
  return true;
}

describe("what a goal sets off", () => {
  test("birds in the park, flares at a small ground, flame jets at a stadium", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map(pyroKind)).toEqual([
      "birds",
      "birds",
      "flares",
      "flares",
      "jets",
      "jets",
      "jets",
      "jets",
    ]);
  });

  test("the better the shot, the more of it", () => {
    // a tap in is size 0 and a worldie 1 (the scene's plans)
    expect(birdCount(0)).toBeLessThan(birdCount(1));
    expect(flareCount(0)).toBe(2);
    expect(flareCount(1)).toBe(5);
    expect(jetPulses(0)).toBe(1);
    expect(jetPulses(1)).toBe(3);
    expect(jetHeight(1)).toBeGreaterThan(jetHeight(0));
    // a flame is always taller than a player (36 px)
    expect(jetHeight(0)).toBeGreaterThan(36);
    expect(cannonPieces(1)).toBeGreaterThan(cannonPieces(CONFETTI_FROM));
    for (const [w, h] of SIZES) {
      const tap = show(4, 0.5, 0, w, h);
      const worldie = show(4, 0.5, 1, w, h);
      expect(jetsLit(tap)).toBe(2);
      expect(jetsLit(worldie)).toBe(jetCount(worldie));
    }
  });

  test("nothing before the ball goes in, and nothing once the show is over", () => {
    for (const tier of [0, 2, 4]) {
      for (const age of [-1, -0.01, PYRO_SECONDS, 60, Number.NaN]) {
        const p = show(tier, age, 1);
        expect(
          painted(960, 540, (s) => {
            drawPyroBack(s, p);
            drawPyroFront(s, p);
          }).n,
        ).toBe(0);
      }
    }
  });

  test("every kind paints, in every era, and the same show paints the same pixels", () => {
    const eras = ["today", "retro", "nextgen"] as const;
    eras.forEach((era, e) => {
      [0, 2, 4].forEach((tier, k) => {
        // each era at each kind of ground, the three canvas sizes shared between them
        const [w, h] = SIZES[(e + k) % SIZES.length];
        const p = show(tier, 0.5, 1, w, h, era);
        const a = painted(w, h, (s) => drawPyroBack(s, p));
        const b = painted(w, h, (s) => drawPyroBack(s, p));
        expect(a.n, `${era} tier ${tier} at ${w}x${h}`).toBeGreaterThan(20);
        expect(same(a.s, b.s)).toBe(true);
      });
    });
  });
});

describe("the flame jets", () => {
  test("stand along the far touchline, inside the stage, short of the goal", () => {
    for (const [w, h] of SIZES) {
      const p = show(4, -1, 0, w, h);
      const n = jetCount(p);
      expect(n).toBeGreaterThanOrEqual(2);
      let last = -Infinity;
      for (let i = 0; i < n; i++) {
        const x = jetX(p, i);
        expect(x).toBeGreaterThan(last + 30);
        expect(x).toBeGreaterThanOrEqual(Math.max(0, p.x0));
        expect(x).toBeLessThan(p.goalX - 14);
        last = x;
      }
    }
  });

  test("the machines are there whenever the ground has them, and only then", () => {
    for (const tier of [0, 1, 2, 3]) {
      expect(
        painted(960, 540, (s) => drawPyroRig(s, show(tier, -1, 0))).n,
      ).toBe(0);
    }
    for (const era of ["today", "retro", "nextgen"] as const) {
      const p = show(5, -1, 0, 960, 540, era);
      const rig = painted(960, 540, (s) => drawPyroRig(s, p));
      expect(rig.n).toBeGreaterThan(0);
      // low units at the touchline: none taller than 8 px
      expect(rig.top).toBeGreaterThanOrEqual(p.touchY - 8);
      expect(rig.bottom).toBeLessThanOrEqual(p.touchY + 2);
    }
  });

  test("go off from the goal end outwards, in a wave", () => {
    const at = (age: number, j: number) => jetLevel(show(4, age, 1), j);
    // the one nearest the goal is up first, its neighbour a moment later
    expect(at(0.1, 0)).toBeGreaterThan(0);
    expect(at(0.1, 1)).toBe(0);
    expect(at(0.2, 1)).toBeGreaterThan(0);
    // full height at the top of a pulse, and dark between pulses
    expect(at(0.3, 0)).toBe(1);
    expect(at(0.66, 0)).toBe(0);
    expect(at(0.9, 0)).toBe(1);
    // a tap in fires two jets, once
    const tap = (age: number, j: number) => jetLevel(show(4, age, 0), j);
    expect(tap(0.2, 0)).toBe(1);
    expect(tap(0.3, 2)).toBe(0);
    expect(tap(0.7, 0)).toBe(0);
  });

  test("a flame rises from the touchline and never below it", () => {
    const p = show(4, 0.3, 1);
    const fire = painted(960, 540, (s) => drawPyroBack(s, p));
    expect(fire.bottom).toBeLessThanOrEqual(p.touchY);
    expect(fire.top).toBeLessThan(p.touchY - jetHeight(1) + 12);
    expect(fire.top).toBeGreaterThan(p.touchY - jetHeight(1) - 16);
  });

  test("confetti is for a golazo and a worldie", () => {
    const tap = show(4, 0.8, 0.4);
    const golazo = show(4, 0.8, 0.65);
    expect(painted(960, 540, (s) => drawPyroFront(s, tap)).n).toBe(0);
    expect(
      painted(960, 540, (s) => drawPyroFront(s, golazo)).n,
    ).toBeGreaterThan(40);
    // and never at a ground with no cannons
    expect(painted(960, 540, (s) => drawPyroFront(s, show(2, 0.8, 1))).n).toBe(
      0,
    );
  });
});

describe("the flares", () => {
  // the product owner, 2026-11-17: "random people in crowd, not the same four people in a
  // row that do it at the exact same time. just so it feels more natural"
  /** A goal's flares, copied out of the painter's one object. */
  const places = (p: Pyro) => {
    const f = flarePlaces(p);
    return Array.from({ length: f.n }, (_, i) => ({
      x: f.x[i],
      y: f.y[i],
      at: f.at[i],
      burn: f.burn[i],
    }));
  };

  test("are lit in the crowd behind the boards, wherever the canvas", () => {
    for (const [w, h] of SIZES) {
      for (const tier of [2, 3]) {
        for (let seed = 1; seed <= 40; seed++) {
          const p = show(tier, 0.5, 1, w, h);
          p.seed = seed * 131;
          const span = p.x1 - p.x0;
          const lit = places(p);
          expect(lit).toHaveLength(flareCount(1));
          for (const f of lit) {
            // on the canvas, never right of the middle of tier 3's stage (its main
            // stand ends there) or outside tier 2's small stand
            expect(f.x).toBeGreaterThanOrEqual(8);
            expect(f.x).toBeLessThanOrEqual(
              p.x0 + Math.ceil(span * (tier === 2 ? 0.68 : 0.5)),
            );
            if (tier === 2)
              expect(f.x).toBeGreaterThanOrEqual(
                p.x0 + Math.floor(span * 0.16),
              );
            // over the heads of the crowd: above the boards, under the roof
            expect(f.y).toBeLessThanOrEqual(p.touchY - 24);
            expect(f.y).toBeGreaterThanOrEqual(
              p.touchY - (tier === 2 ? 36 : 54),
            );
          }
        }
      }
    }
  });

  test("not in a row: at the big stand they are at different heights and all across it", () => {
    let rows = 0;
    let wide = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const p = show(3, 0.5, 1);
      p.seed = seed * 131;
      const lit = places(p);
      const ys = lit.map((f) => f.y);
      const xs = lit.map((f) => f.x);
      if (Math.max(...ys) - Math.min(...ys) >= 10) rows++;
      if (Math.max(...xs) - Math.min(...xs) >= 120) wide++;
      // and no two close enough for their plumes to be one
      for (let i = 0; i < lit.length; i++) {
        for (let j = 0; j < i; j++) {
          const near =
            Math.abs(lit[i].x - lit[j].x) < 24 &&
            Math.abs(lit[i].y - lit[j].y) < 22;
          expect(near, `seed ${seed}: flares ${j} and ${i}`).toBe(false);
        }
      }
    }
    expect(rows).toBeGreaterThanOrEqual(34);
    expect(wide).toBeGreaterThanOrEqual(30);
  });

  test("not at the same time: one as the ball goes in, the others in their own time", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const p = show(3, 0.5, 1);
      p.seed = seed * 131;
      const lit = places(p);
      expect(lit[0].at).toBeCloseTo(0.1, 5);
      const later = lit.slice(1).map((f) => f.at);
      for (const at of later) {
        expect(at).toBeGreaterThanOrEqual(0.15);
        expect(at).toBeLessThanOrEqual(1.3);
      }
      // spread over the best part of a second, not a volley: no two within a
      // twentieth of a second of each other
      expect(Math.max(...later) - Math.min(...later)).toBeGreaterThan(0.5);
      const order = lit.map((f) => f.at).sort((a, b) => a - b);
      for (let i = 1; i < order.length; i++) {
        expect(order[i] - order[i - 1]).toBeGreaterThan(0.05);
      }
      for (const f of lit) {
        expect(f.burn).toBeGreaterThanOrEqual(1.05);
        expect(f.burn).toBeLessThanOrEqual(1.6);
        // lit, burnt out and its smoke gone before the show is over
        expect(f.at + f.burn + 1.45).toBeLessThanOrEqual(PYRO_SECONDS + 0.2);
      }
    }
  });

  test("no two goals have the same people, and the same goal always has", () => {
    const a = show(3, 0.5, 1);
    const b = show(3, 0.5, 1);
    b.seed = a.seed + 131;
    expect(places(a)).toEqual(places(a));
    expect(places(a).map((f) => [f.x, f.y])).not.toEqual(
      places(b).map((f) => [f.x, f.y]),
    );
    expect(places(a).map((f) => f.at)).not.toEqual(places(b).map((f) => f.at));
  });
});

describe("in the scene", () => {
  const STEP = 1 / 60;
  const make = (total: number, reduced = false) => {
    const scene = new CareerScene({ seed: 3, mode: "home", total });
    scene.resize(480, 270);
    scene.setReducedMotion(reduced);
    scene.update(0);
    for (let i = 0; i < 72; i++) scene.update(STEP);
    return scene;
  };
  const frame = (scene: CareerScene) => {
    const s = new Surface(480, 270);
    scene.draw(s);
    return s;
  };
  /** Pixels of flame colour in the band above the far touchline. */
  const fire = (s: Surface) => {
    const L = careerLayout(480, 270);
    let n = 0;
    for (let y = L.farTouchY - 90; y < L.farTouchY; y++) {
      for (let x = 0; x < L.goalX - 10; x++) {
        const c = s.get(x, y);
        if (c === P.goldLight || c === P.white) n++;
      }
    }
    return n;
  };

  test("a goal at a stadium sets the jets off, and a miss does not", () => {
    const goal = make(400);
    const idle = fire(frame(goal));
    goal.playShot("golazo");
    for (let i = 0; i < 90; i++) goal.update(STEP);
    expect(fire(frame(goal))).toBeGreaterThan(idle + 300);

    const miss = make(400);
    miss.playShot("miss");
    for (let i = 0; i < 90; i++) miss.update(STEP);
    expect(fire(frame(miss))).toBeLessThanOrEqual(idle + 150);
  });

  test("with reduced motion nothing goes off", () => {
    const scene = make(400, true);
    const idle = fire(frame(scene));
    scene.playShot("worldie");
    for (let i = 0; i < 20; i++) {
      scene.update(STEP * 6);
      expect(fire(frame(scene))).toBeLessThanOrEqual(idle + 150);
    }
  });
});
