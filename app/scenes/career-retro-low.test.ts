/**
 * The career scene in RETRO at the small grounds (tiers 0 to 3): it draws every pixel while
 * asking, through a goal and a promotion, by day and at night, on a monitor and a phone.
 */

import { describe, expect, it } from "vitest";
import { lightingFor } from "~/art/lighting";
import { Surface, TRANSPARENT } from "~/pixel";
import { CareerScene } from "./career";

const DAY = lightingFor({ elevation: 35, morning: false });
const NIGHT = lightingFor({ elevation: -25, morning: false });
const STEP = 1 / 60;

function run(scene: CareerScene, t: number): void {
  for (let i = 0; i < Math.round(t / STEP); i++) scene.update(STEP);
}

function holes(s: Surface): number {
  let n = 0;
  for (let i = 0; i < s.data.length; i++) if (s.data[i] === TRANSPARENT) n++;
  return n;
}

describe("the career scene in RETRO, tiers 0 to 3", () => {
  it("covers the canvas asking, in a goal and in a promotion", () => {
    for (const [w, h] of [
      [960, 540],
      [260, 562],
    ] as const) {
      for (const light of [DAY, NIGHT]) {
        for (const total of [0, 100, 200, 300]) {
          const scene = new CareerScene({ seed: 3, mode: "retro", total });
          scene.resize(w, h);
          scene.setLighting(light);
          scene.update(0);
          run(scene, 1.2);
          const s = new Surface(w, h);
          scene.draw(s);
          expect(holes(s), `${w}x${h} ${total}`).toBe(0);
          scene.playShot("golazo");
          run(scene, 1.3);
          scene.draw(s);
          expect(holes(s)).toBe(0);
          if (total < 300) {
            scene.promote(total + 100);
            run(scene, 0.4);
            scene.draw(s);
            expect(holes(s)).toBe(0);
          }
        }
      }
    }
  }, 120_000);
});
