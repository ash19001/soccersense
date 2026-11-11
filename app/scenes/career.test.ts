// The career scene's API, as the game page relies on it (docs/CAREER_SCENE.md section 7).
// These hold for the stand-in and must keep holding for the real scene.

import { describe, expect, test, vi } from "vitest";

import { CareerGround } from "~/art/grounds";
import { lightingFor } from "~/art/lighting";
import type { Grade } from "~/game";
import { Surface, TRANSPARENT } from "~/pixel";
import { CareerScene } from "./career";

const GRADES: Grade[] = [
  "worldie",
  "topbins",
  "goal",
  "ontarget",
  "wide",
  "timeup",
  "skipped",
];

function ready(total = 0, reduced = false): CareerScene {
  const scene = new CareerScene({ seed: 3, mode: "home", total });
  scene.resize(130, 281);
  scene.setLighting(lightingFor({ elevation: 30, morning: true }));
  scene.setReducedMotion(reduced);
  scene.update(0);
  return scene;
}

/** Run it as the canvas host would, a sixtieth of a second at a time. */
function run(scene: CareerScene, seconds: number): void {
  for (let t = 0; t < seconds; t += 1 / 60) scene.update(1 / 60);
}

describe("the career scene", () => {
  test.each(GRADES)(
    "a %s shot takes about 2.4 s and calls back exactly once",
    (grade) => {
      const scene = ready();
      const done = vi.fn(() => {
        // By the time it calls back, it is free for the next thing.
        expect(scene.busy).toBe(false);
      });
      expect(scene.busy).toBe(false);
      scene.playShot(grade, done);
      expect(scene.busy).toBe(true);
      run(scene, 2.2);
      expect(done).not.toHaveBeenCalled();
      run(scene, 0.4);
      expect(done).toHaveBeenCalledTimes(1);
      expect(scene.busy).toBe(false);
      run(scene, 5);
      expect(done).toHaveBeenCalledTimes(1);
    },
  );

  test("with reduced motion a shot is over at once", () => {
    const scene = ready(0, true);
    const done = vi.fn();
    scene.playShot("goal", done);
    run(scene, 0.5);
    expect(done).toHaveBeenCalledTimes(1);
  });

  test("a promotion takes about 1.5 s; no change of tier calls back at once", () => {
    const scene = ready(80);
    const same = vi.fn();
    scene.promote(85, same);
    expect(same).toHaveBeenCalledTimes(1);
    expect(scene.busy).toBe(false);

    const up = vi.fn();
    scene.promote(185, up);
    expect(scene.busy).toBe(true);
    run(scene, 1.3);
    expect(up).not.toHaveBeenCalled();
    run(scene, 0.3);
    expect(up).toHaveBeenCalledTimes(1);
    expect(scene.busy).toBe(false);
    // Now at tier 2: promoting to the same total again is a no-op.
    const again = vi.fn();
    scene.promote(185, again);
    expect(again).toHaveBeenCalledTimes(1);
  });

  test("a new shot finishes the one playing first, so every caller hears back once", () => {
    const scene = ready();
    const first = vi.fn();
    const second = vi.fn();
    scene.playShot("wide", first);
    run(scene, 0.5);
    scene.playShot("goal", second);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
    run(scene, 2.5);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  test("full time stops whatever was playing and is not busy", () => {
    const scene = ready(600);
    const done = vi.fn();
    scene.playShot("worldie", done);
    scene.showFullTime(700);
    expect(done).toHaveBeenCalledTimes(1);
    expect(scene.busy).toBe(false);
  });

  test("every frame covers every pixel, at every tier, and the same calls give the same pixels", () => {
    for (const total of [0, 100, 200, 300, 400, 500, 600, 700]) {
      const a = ready(total);
      const b = ready(total);
      run(a, 1);
      run(b, 1);
      if (total === 700) {
        a.showFullTime(700);
        b.showFullTime(700);
      }
      const sa = new Surface(130, 281);
      const sb = new Surface(130, 281);
      a.draw(sa);
      b.draw(sb);
      expect(sa.data.includes(TRANSPARENT)).toBe(false);
      expect(sb.data).toEqual(sa.data);
    }
  });

  test("it draws at a monitor's size too, and survives odd steps of time", () => {
    const scene = new CareerScene({ seed: 1, mode: "away" });
    scene.resize(480, 270);
    scene.setLighting(lightingFor({ elevation: -20, morning: false }));
    scene.update(0);
    scene.update(Number.NaN);
    scene.update(-1);
    scene.update(100);
    scene.playShot("topbins");
    scene.update(0.05);
    const s = new Surface(480, 270);
    scene.draw(s);
    expect(s.data.includes(TRANSPARENT)).toBe(false);
  });
});

describe("the real career scene", () => {
  const MOODS: Record<Grade, string> = {
    worldie: "roar",
    topbins: "cheer",
    goal: "cheer",
    ontarget: "ooh",
    wide: "groan",
    timeup: "hush",
    skipped: "idle",
  };

  test.each(GRADES)(
    "the crowd answers a %s once, when the ball gets there",
    (grade) => {
      const spy = vi.spyOn(CareerGround.prototype, "setMood");
      try {
        const scene = ready(400);
        scene.playShot(grade);
        // nothing before the strike
        run(scene, 0.45);
        expect(spy).not.toHaveBeenCalled();
        run(scene, 2);
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0][0]).toBe(MOODS[grade]);
        run(scene, 5);
        expect(spy).toHaveBeenCalledTimes(1);
      } finally {
        spy.mockRestore();
      }
    },
  );

  test("with reduced motion the crowd answers at once", () => {
    const spy = vi.spyOn(CareerGround.prototype, "setMood");
    try {
      const scene = ready(400, true);
      scene.playShot("worldie");
      expect(spy).toHaveBeenCalledWith("roar", expect.any(Number));
    } finally {
      spy.mockRestore();
    }
  });

  test("a promotion over two tiers goes straight to the higher one, then the crowd ripples", () => {
    const tiers = vi.spyOn(CareerGround.prototype, "setTier");
    const moods = vi.spyOn(CareerGround.prototype, "setMood");
    try {
      const scene = ready(100);
      tiers.mockClear();
      scene.promote(400);
      run(scene, 0.5);
      expect(tiers).not.toHaveBeenCalled();
      run(scene, 1.2);
      expect(tiers.mock.calls).toEqual([[4]]);
      expect(moods).toHaveBeenCalledWith("cheer", expect.any(Number));
    } finally {
      tiers.mockRestore();
      moods.mockRestore();
    }
  });

  test("with reduced motion a promotion changes the ground at once", () => {
    const tiers = vi.spyOn(CareerGround.prototype, "setTier");
    try {
      const scene = ready(100, true);
      tiers.mockClear();
      const done = vi.fn();
      scene.promote(200, done);
      expect(tiers.mock.calls).toEqual([[2]]);
      run(scene, 0.3);
      expect(done).toHaveBeenCalledTimes(1);
    } finally {
      tiers.mockRestore();
    }
  });

  test("full time is a party at the top tier and a cheer below it", () => {
    const moods = vi.spyOn(CareerGround.prototype, "setMood");
    try {
      ready(600).showFullTime(700);
      expect(moods.mock.calls.at(-1)?.[0]).toBe("party");
      ready(200).showFullTime(250);
      expect(moods.mock.calls.at(-1)?.[0]).toBe("cheer");
    } finally {
      moods.mockRestore();
    }
  });

  test("a whole shot, at odd sizes and steps, always covers every pixel and never throws", () => {
    const sizes: [number, number][] = [
      [130, 281],
      [120, 222],
      [160, 300],
      [480, 270],
      [688, 288],
      [1, 1],
      [9, 400],
      [700, 40],
    ];
    for (const [w, h] of sizes) {
      for (const grade of GRADES) {
        const scene = new CareerScene({ seed: 5, mode: "away", total: 0 });
        scene.resize(w, h);
        scene.setLighting(lightingFor({ elevation: -10, morning: true }));
        scene.update(0);
        scene.playShot(grade);
        const s = new Surface(w, h);
        for (let t = 0; t < 6; t += 0.37) {
          scene.update(0.37);
          scene.draw(s);
          expect(s.data.includes(TRANSPARENT)).toBe(false);
        }
      }
      const scene = new CareerScene({ seed: 5, mode: "home", total: 500 });
      scene.resize(w, h);
      scene.update(0);
      scene.promote(600);
      const s = new Surface(w, h);
      for (let t = 0; t < 2; t += 0.19) {
        scene.update(0.19);
        scene.draw(s);
        expect(s.data.includes(TRANSPARENT)).toBe(false);
      }
      scene.showFullTime(700);
      scene.update(1);
      scene.draw(s);
      expect(s.data.includes(TRANSPARENT)).toBe(false);
    }
  });

  test("the same calls give the same pixels all through a shot, a promotion and full time", () => {
    const play = (): Uint32Array[] => {
      const scene = new CareerScene({ seed: 9, mode: "home", total: 350 });
      scene.resize(480, 270);
      scene.setLighting(lightingFor({ elevation: 20, morning: false }));
      scene.update(0);
      const frames: Uint32Array[] = [];
      const s = new Surface(480, 270);
      const grab = (): void => {
        scene.draw(s);
        frames.push(s.data.slice());
      };
      scene.playShot("worldie");
      for (let i = 0; i < 12; i++) {
        run(scene, 0.25);
        grab();
      }
      scene.promote(460);
      for (let i = 0; i < 4; i++) {
        run(scene, 0.4);
        grab();
      }
      scene.showFullTime(690);
      run(scene, 1);
      grab();
      return frames;
    };
    const a = play();
    const b = play();
    expect(b).toEqual(a);
  });

  test("the picture moves on after the shot: the next frame is not the last", () => {
    const scene = ready(400);
    scene.playShot("goal");
    run(scene, 2.5);
    const s1 = new Surface(130, 281);
    scene.draw(s1);
    run(scene, 0.5);
    const s2 = new Surface(130, 281);
    scene.draw(s2);
    expect(s2.data).not.toEqual(s1.data);
  });
});
