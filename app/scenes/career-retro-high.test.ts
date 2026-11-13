/**
 * RETRO in the career scene at tiers 4 to 7: the cast stands and plays where HOME's does,
 * the picture is its own (the grand old stadium), and its effects (rockets on sticks, paper
 * and caps at the trophy lift, the close-up's old leather ball in a rope net) are drawn.
 */

import { describe, expect, it } from "vitest";
import type { Mode } from "~/game";
import { lightingFor } from "~/art/lighting";
import { P } from "~/art/palette";
import { Surface, TRANSPARENT, mix, shade } from "~/pixel";
import { ARRIVAL_SECONDS, CareerScene } from "./career";
import {
  BUILD,
  buildColors,
  drawConfetti,
  drawGoalFireworks,
} from "./career-fx";

const DAY = lightingFor({ elevation: 30, morning: true });
const NIGHT = lightingFor({ elevation: -30, morning: false });
const TOTALS = [400, 500, 600, 680];

function run(scene: CareerScene, seconds: number): void {
  for (let t = 0; t < seconds; t += 1 / 30) scene.update(1 / 30);
}

function scene(
  mode: Mode,
  total: number,
  w: number,
  h: number,
  light = DAY,
): CareerScene {
  const sc = new CareerScene({ seed: 5, mode, total });
  sc.resize(w, h);
  sc.setLighting(light);
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

function frame(sc: CareerScene, w: number, h: number): Surface {
  const s = new Surface(w, h);
  sc.draw(s);
  return s;
}

describe("RETRO at the big grounds", () => {
  for (const total of TOTALS) {
    for (const [w, h] of [
      [960, 540],
      [260, 562],
    ] as const) {
      it(`keeps HOME's places and draws its own picture (total ${total}, ${w} x ${h})`, () => {
        const home = scene("home", total, w, h);
        const retro = scene("retro", total, w, h);
        expect(places(retro)).toEqual(places(home));
        // and through a goal, beat for beat
        home.playShot("golazo");
        retro.playShot("golazo");
        for (let k = 0; k < 8; k++) {
          run(home, 0.3);
          run(retro, 0.3);
          expect(places(retro)).toEqual(places(home));
        }
        const s = frame(retro, w, h);
        expect(s.data.includes(TRANSPARENT)).toBe(false);
        expect(s.data).not.toEqual(frame(home, w, h).data);
      });
    }
  }

  it("covers the canvas at night and on every screen size it must hold at", () => {
    for (const [w, h] of [
      [683, 384],
      [854, 480],
      [234, 507],
      [1440, 720],
    ] as const) {
      for (const total of TOTALS) {
        const s = frame(scene("retro", total, w, h, NIGHT), w, h);
        expect(s.data.includes(TRANSPARENT), `${w}x${h} ${total}`).toBe(false);
      }
    }
  });

  it("lifts the trophy on the podium where HOME's hero does", () => {
    const home = scene("home", 600, 960, 540);
    const retro = scene("retro", 600, 960, 540);
    home.showFullTime(680);
    retro.showFullTime(680);
    run(home, 1.5);
    run(retro, 1.5);
    expect(places(retro)).toEqual(places(home));
  });

  it("leaves HOME and AWAY as they were: the same picture whatever RETRO did", () => {
    // a RETRO scene built first must not change what HOME or AWAY draw after it
    const before = frame(scene("home", 500, 480, 270), 480, 270);
    const away = frame(scene("away", 500, 480, 270), 480, 270);
    frame(scene("retro", 500, 480, 270), 480, 270);
    expect(frame(scene("home", 500, 480, 270), 480, 270).data).toEqual(
      before.data,
    );
    expect(frame(scene("away", 500, 480, 270), 480, 270).data).toEqual(
      away.data,
    );
  });
});

describe("RETRO's effects", () => {
  it("sends up rockets on sticks for a goal: gold willows, none of today's colours", () => {
    const a = new Surface(480, 270);
    const b = new Surface(480, 270);
    a.clear(P.ink);
    b.clear(P.ink);
    for (const age of [0.2, 0.9, 1.4]) {
      drawGoalFireworks(a, age, 5, 0.8, 40, 440, 120, 3, P.retroLight, "retro");
      drawGoalFireworks(b, age, 5, 0.8, 40, 440, 120, 3, P.retroLight);
    }
    expect(count(a, P.ink)).toBeLessThan(480 * 270);
    expect(a.data).not.toEqual(b.data);
    expect(count(a, P.gold) + count(a, P.goldLight)).toBeGreaterThan(10);
    // no electric green or teal sparks: those are today's
    expect(count(a, P.ledGreen)).toBe(0);
    expect(count(a, P.awayLight)).toBe(0);
  });

  it("throws paper, caps and bowlers at the trophy lift", () => {
    const a = new Surface(480, 270);
    a.clear(P.grass);
    drawConfetti(a, 1.2, 0, 480, 0, 200, 3, P.retro, P.retroLight, "retro");
    expect(count(a, P.chalk) + count(a, P.retroLight)).toBeGreaterThan(10);
    // the caps' and bowlers' crowns
    let hats = 0;
    for (let t = 0.2; t < 4; t += 0.4) {
      const s = new Surface(480, 270);
      s.clear(P.grass);
      drawConfetti(s, t, 0, 480, 0, 200, 3, P.retro, P.retroLight, "retro");
      hats += count(s, P.ink);
    }
    expect(hats).toBeGreaterThan(0);
  });

  it("draws the close-up's net in rope and the ball in brown leather", () => {
    const c = buildColors((x) => x, "retro");
    expect(c.era).toBe("retro");
    expect(c.net).toBe(mix(P.chalk, P.wood, 0.3));
    expect(c.leatherShade).toBe(P.wood);
    expect(c.leatherDeep).toBe(P.woodDark);
    // graded like the ground it opens onto
    const g = buildColors((x) => shade(x, -0.3), "retro");
    expect(g.leatherShade).toBe(shade(P.wood, -0.3));
    // today's is untouched
    expect(buildColors((x) => x).net).toBe(P.chalk);
    expect(buildColors((x) => x).era).toBeUndefined();
  });

  it("shows the old ball, laced, in a rope net during a promotion", () => {
    const sc = scene("retro", 300, 960, 540);
    sc.promote(400);
    run(sc, BUILD.hit + 0.25);
    const s = frame(sc, 960, 540);
    const c = buildColors(DAY.lit, "retro");
    expect(count(s, c.leather) + count(s, c.leatherHi)).toBeGreaterThan(300);
    expect(count(s, c.leatherShade)).toBeGreaterThan(50);
    // the rope's shaded underside along its strings
    expect(count(s, c.netShade)).toBeGreaterThan(100);
  });
});
