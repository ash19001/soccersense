// The menu's first picture, built a step at a time (`MenuScene.prepareStep`), is the very
// picture `draw` builds in one go: the same pixels, frame after frame.

import { describe, expect, it } from "vitest";

import { lightingFor } from "~/art/lighting";
import { strings } from "~/i18n";
import { Surface } from "~/pixel";

import { MenuScene } from "./menu";

const W = 300;
const H = 220;
const DAY = lightingFor({ elevation: 35, morning: false });
const NIGHT = lightingFor({ elevation: -25, morning: false });

function menu(seed: number): MenuScene {
  return new MenuScene({
    seed,
    fact: "THE FIRST WORLD CUP WAS IN 1930",
    labels: strings.home.canvas,
    intro: true,
    matchSeed: 5,
  });
}

/** The frames at 0, 0.5 and 2 seconds, as copies of their pixels. */
function frames(scene: MenuScene): Uint32Array[] {
  const s = new Surface(W, H);
  const out: Uint32Array[] = [];
  scene.update(0);
  scene.draw(s);
  out.push(s.data.slice());
  for (const dt of [0.5, 1.5]) {
    scene.update(dt);
    scene.draw(s);
    out.push(s.data.slice());
  }
  return out;
}

describe("MenuScene.prepareStep", () => {
  it("has nothing to do before the scene has a size", () => {
    expect(menu(41).prepareStep()).toBe(false);
  });

  for (const [name, light] of [
    ["by day", DAY],
    ["at night", NIGHT],
  ] as const) {
    it(`builds the picture in many steps, pixel for pixel the one drawn at once (${name})`, () => {
      const whole = menu(42);
      whole.resize(W, H);
      whole.setLighting(light);
      const expected = frames(whole);

      const stepped = menu(42);
      stepped.resize(W, H);
      stepped.setLighting(light);
      let steps = 0;
      while (stepped.prepareStep()) steps++;
      expect(steps).toBeGreaterThan(20);
      // done: nothing more to do, before the first frame or after it
      expect(stepped.prepareStep()).toBe(false);
      const got = frames(stepped);
      expect(stepped.prepareStep()).toBe(false);
      for (let i = 0; i < expected.length; i++) {
        expect(got[i]).toEqual(expected[i]);
      }
    });
  }

  it("a draw before the last step builds the rest itself", () => {
    const whole = menu(43);
    whole.resize(W, H);
    whole.setLighting(DAY);
    const expected = frames(whole);

    const part = menu(43);
    part.resize(W, H);
    part.setLighting(DAY);
    for (let i = 0; i < 7; i++) expect(part.prepareStep()).toBe(true);
    const got = frames(part);
    expect(got[0]).toEqual(expected[0]);
    expect(got[2]).toEqual(expected[2]);
    expect(part.prepareStep()).toBe(false);
  });

  it("starts again for a new size or a new light, and still ends on the same picture", () => {
    const whole = menu(44);
    whole.resize(W, H);
    whole.setLighting(NIGHT);
    const expected = frames(whole);

    const moved = menu(44);
    moved.resize(W + 40, H + 10);
    moved.setLighting(DAY);
    for (let i = 0; i < 9; i++) moved.prepareStep();
    moved.resize(W, H);
    for (let i = 0; i < 9; i++) moved.prepareStep();
    moved.setLighting(NIGHT);
    while (moved.prepareStep());
    const got = frames(moved);
    for (let i = 0; i < expected.length; i++) {
      expect(got[i]).toEqual(expected[i]);
    }
  });
});
