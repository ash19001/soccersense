import { describe, expect, it } from "vitest";
import type { Grade, Mode } from "~/game";
import { lightingFor } from "~/art/lighting";
import { Surface, TRANSPARENT } from "~/pixel";
import { CareerScene } from "./career";

const STEP = 1 / 60;
const TOTALS = [0, 100, 200, 300, 400, 500, 600, 680];

interface Seen {
  poses: { on: boolean; x: number; y: number; anim: string; frame: number }[];
}

function run(
  mode: Mode,
  tier: number,
  then: (s: CareerScene) => void,
  t: number,
  night = false,
): { scene: CareerScene; frame: Surface } {
  const scene = new CareerScene({ seed: 11, mode, total: TOTALS[tier] });
  scene.resize(320, 180);
  scene.setLighting(
    lightingFor({ elevation: night ? -30 : 40, morning: false }),
  );
  scene.update(0);
  for (let i = 0; i < 72; i++) scene.update(STEP);
  then(scene);
  for (let i = 0; i < Math.round(t / STEP); i++) scene.update(STEP);
  const frame = new Surface(320, 180);
  scene.draw(frame);
  return { scene, frame };
}

function places(scene: CareerScene): number[][] {
  return (scene as unknown as Seen).poses.map((p) => [
    p.on ? 1 : 0,
    p.x,
    p.y,
    p.frame,
  ]);
}

function covered(s: Surface): boolean {
  for (let i = 0; i < s.data.length; i++) {
    if (s.data[i] === TRANSPARENT) return false;
  }
  return true;
}

const MOMENTS: [string, (s: CareerScene) => void, number][] = [
  ["asking", () => {}, 0.5],
  ["a golazo", (s) => s.playShot("golazo" as Grade), 0.8],
  ["a worldie", (s) => s.playShot("worldie" as Grade), 1.4],
  ["a miss", (s) => s.playShot("miss" as Grade), 2.2],
  ["time up", (s) => s.playShot("timeup" as Grade), 1],
  ["full time", (s) => s.showFullTime(680), 1],
];

describe("NEXT-GEN's cast in the career scene", () => {
  for (let tier = 0; tier < 8; tier++) {
    it(`draws tier ${tier}, covering the canvas, the cast where HOME's is`, () => {
      for (const [, then, t] of MOMENTS) {
        for (const night of [false, true]) {
          const ng = run("nextgen", tier, then, t, night);
          const home = run("home", tier, then, t, night);
          expect(covered(ng.frame)).toBe(true);
          expect(places(ng.scene)).toEqual(places(home.scene));
        }
      }
    });
  }

  it("looks different from HOME's (the kits, the ball, the referee)", () => {
    const ng = run("nextgen", 4, () => {}, 0.5);
    const home = run("home", 4, () => {}, 0.5);
    let differ = 0;
    for (let i = 0; i < ng.frame.data.length; i++) {
      if (ng.frame.data[i] !== home.frame.data[i]) differ++;
    }
    expect(differ).toBeGreaterThan(500);
  });
});
