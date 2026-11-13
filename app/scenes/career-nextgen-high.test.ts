/**
 * NEXT-GEN in the career scene at tiers 4 to 7: the cast stands and plays where HOME's
 * does, the picture is its own, and its effects (bursts of light, glowing confetti, the
 * close-up's net of light) are drawn.
 */

import { describe, expect, it } from "vitest";
import type { Mode } from "~/game";
import { lightingFor } from "~/art/lighting";
import { P } from "~/art/palette";
import { Surface, TRANSPARENT, shade } from "~/pixel";
import { ARRIVAL_SECONDS, CareerScene } from "./career";
import {
  BUILD,
  buildColors,
  drawConfetti,
  drawGoalFireworks,
} from "./career-fx";

const DAY = lightingFor({ elevation: 30, morning: true });
const TOTALS = [400, 500, 600, 680];

function run(scene: CareerScene, seconds: number): void {
  for (let t = 0; t < seconds; t += 1 / 30) scene.update(1 / 30);
}

function scene(mode: Mode, total: number, w: number, h: number): CareerScene {
  const sc = new CareerScene({ seed: 5, mode, total });
  sc.resize(w, h);
  sc.setLighting(DAY);
  sc.update(0);
  run(sc, ARRIVAL_SECONDS + 0.5);
  return sc;
}

type Poses = { poses: { x: number; y: number }[] };

function places(sc: CareerScene): number[][] {
  return (sc as unknown as Poses).poses.map((p) => [p.x, p.y]);
}

function count(s: Surface, c: number): number {
  let n = 0;
  for (let i = 0; i < s.data.length; i++) if (s.data[i] === c) n++;
  return n;
}

describe("NEXT-GEN at the big grounds", () => {
  for (const total of TOTALS) {
    for (const [w, h] of [
      [960, 540],
      [260, 562],
    ] as const) {
      it(`keeps HOME's places and draws its own picture (total ${total}, ${w} x ${h})`, () => {
        const home = scene("home", total, w, h);
        const ng = scene("nextgen", total, w, h);
        expect(places(ng)).toEqual(places(home));
        // and through a goal, beat for beat
        home.playShot("golazo");
        ng.playShot("golazo");
        for (let k = 0; k < 8; k++) {
          run(home, 0.3);
          run(ng, 0.3);
          expect(places(ng)).toEqual(places(home));
        }
        const s = new Surface(w, h);
        ng.draw(s);
        const t = new Surface(w, h);
        home.draw(t);
        expect(s.data.includes(TRANSPARENT)).toBe(false);
        expect(s.data).not.toEqual(t.data);
      });
    }
  }

  it("lifts the trophy on the podium where HOME's hero does", () => {
    const home = scene("home", 600, 960, 540);
    const ng = scene("nextgen", 600, 960, 540);
    home.showFullTime(680);
    ng.showFullTime(680);
    run(home, 1.5);
    run(ng, 1.5);
    expect(places(ng)).toEqual(places(home));
  });
});

describe("NEXT-GEN's effects", () => {
  it("bursts light over the roof for a goal, its own and not today's fireworks", () => {
    const a = new Surface(480, 270);
    const b = new Surface(480, 270);
    a.clear(P.ink);
    b.clear(P.ink);
    drawGoalFireworks(
      a,
      0.9,
      5,
      0.8,
      40,
      440,
      120,
      3,
      P.nextgenLight,
      "nextgen",
    );
    drawGoalFireworks(b, 0.9, 5, 0.8, 40, 440, 120, 3, P.nextgenLight);
    expect(count(a, P.ink)).toBeLessThan(480 * 270);
    expect(a.data).not.toEqual(b.data);
    // no amber rocket trails: drones of light
    expect(count(a, P.amber)).toBe(0);
  });

  it("throws glowing confetti at the trophy lift", () => {
    const a = new Surface(480, 270);
    a.clear(P.ink);
    drawConfetti(
      a,
      1.2,
      0,
      480,
      0,
      200,
      3,
      P.nextgen,
      P.nextgenLight,
      "nextgen",
    );
    expect(count(a, P.skyLow) + count(a, P.white)).toBeGreaterThan(10);
  });

  it("draws the close-up's net in light whatever the ground's grade", () => {
    const c = buildColors((x) => shade(x, -0.3), "nextgen");
    expect(c.net).toBe(P.skyLow);
    expect(c.knot).toBe(P.white);
    expect(c.patch).toBe(P.nextgen);
    expect(c.era).toBe("nextgen");
    // today's is untouched
    expect(buildColors((x) => x).net).toBe(P.chalk);
  });

  it("shows the ball with glowing panels in a net of light during a promotion", () => {
    const sc = scene("nextgen", 300, 960, 540);
    sc.promote(400);
    run(sc, BUILD.hit + 0.1);
    const s = new Surface(960, 540);
    sc.draw(s);
    expect(count(s, P.skyLow)).toBeGreaterThan(300);
    expect(count(s, P.nextgen)).toBeGreaterThan(100);
  });

  it("writes NEXT-GEN's own words on its boards, and leaves HOME's alone", () => {
    const draw = (mode: Mode, nextgen: string): Surface => {
      const sc = new CareerScene({
        seed: 5,
        mode,
        total: 400,
        labels: {
          boards: ["HOT PIES", "TEA BAR"],
          nextgen: { boards: [nextgen] },
        },
      });
      sc.resize(960, 540);
      sc.setLighting(DAY);
      sc.update(0);
      run(sc, ARRIVAL_SECONDS + 0.5);
      const s = new Surface(960, 540);
      sc.draw(s);
      return s;
    };
    expect(draw("nextgen", "DRONE PIES").data).not.toEqual(
      draw("nextgen", "HOLO SEATS").data,
    );
    expect(draw("home", "DRONE PIES").data).toEqual(
      draw("home", "HOLO SEATS").data,
    );
  });
});
