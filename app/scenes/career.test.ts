// The career scene's API, as the game page relies on it (docs/CAREER_SCENE.md section 7).
// These hold for the stand-in and must keep holding for the real scene.

import { describe, expect, test, vi } from "vitest";

import { CareerGround } from "~/art/grounds";
import { careerLayout } from "~/art/layout";
import { lightingFor } from "~/art/lighting";
import { P } from "~/art/palette";
import type { Grade } from "~/game";
import { Surface, TRANSPARENT } from "~/pixel";
import {
  ARRIVAL_SECONDS,
  ARRIVAL_STEP,
  CareerScene,
  OPEN_HOLD,
} from "./career";
import { BUILD, buildColors, closeUpSize, drawBuild } from "./career-fx";
import type { SoundCue } from "./scene";

const GRADES: Grade[] = [
  "worldie",
  "golazo",
  "trivela",
  "toepoke",
  "tapin",
  "miss",
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
  test.each(GRADES.flatMap((g) => [0, 100, 400].map((t) => [g, t] as const)))(
    "a %s shot (total %i) takes about 2.4 s and calls back exactly once",
    (grade, total) => {
      const scene = ready(total);
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
    scene.playShot("trivela", done);
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
    scene.playShot("miss", first);
    run(scene, 0.5);
    scene.playShot("toepoke", second);
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
    scene.playShot("golazo");
    scene.update(0.05);
    const s = new Surface(480, 270);
    scene.draw(s);
    expect(s.data.includes(TRANSPARENT)).toBe(false);
  });
});

describe("the real career scene", () => {
  const MOODS: Record<Grade, string> = {
    worldie: "roar",
    golazo: "cheer",
    trivela: "cheer",
    toepoke: "cheer",
    tapin: "cheer",
    miss: "groan",
    timeup: "hush",
    skipped: "idle",
  };

  test.each(GRADES.flatMap((g) => [0, 400].map((t) => [g, t] as const)))(
    "the crowd answers a %s (total %i) once, when the ball gets there",
    (grade, total) => {
      const spy = vi.spyOn(CareerGround.prototype, "setMood");
      try {
        const scene = ready(total);
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
    scene.playShot("trivela");
    run(scene, 2.5);
    const s1 = new Surface(130, 281);
    scene.draw(s1);
    run(scene, 0.5);
    const s2 = new Surface(130, 281);
    scene.draw(s2);
    expect(s2.data).not.toEqual(s1.data);
  });
});

describe("the opening", () => {
  /** A scene as the page makes it, at 480 x 270, before any time has passed. */
  function fresh(): CareerScene {
    const scene = new CareerScene({ seed: 4, mode: "home", total: 400 });
    scene.resize(480, 270);
    scene.setLighting(lightingFor({ elevation: 25, morning: true }));
    return scene;
  }

  /** How many pixels the iris inks in this frame (the picture's own ink aside). */
  function covered(scene: CareerScene, a: Surface, b: Surface): number {
    scene.draw(a);
    scene.setReducedMotion(true);
    scene.draw(b);
    scene.setReducedMotion(false);
    let n = 0;
    for (let i = 0; i < a.data.length; i++) {
      if (a.data[i] === P.ink && b.data[i] !== P.ink) n++;
    }
    return n;
  }

  test("it starts on ink, with its picture built before any time passes", () => {
    const draws = vi.spyOn(CareerGround.prototype, "drawBack");
    try {
      // the size and the light build the picture (one frame painted off screen)...
      const scene = fresh();
      expect(draws).toHaveBeenCalledTimes(1);
      scene.update(0);
      const s = new Surface(480, 270);
      scene.draw(s);
      expect(s.data.every((c) => c === P.ink)).toBe(true);
      // ...the frames just after the build (shown late by a browser) stay on ink...
      draws.mockClear();
      for (let i = 0; i < OPEN_HOLD; i++) {
        scene.update(1 / 60);
        scene.draw(s);
        expect(s.data.every((c) => c === P.ink)).toBe(true);
      }
      expect(draws).toHaveBeenCalledTimes(0);
      // ...and then the opening paints once a frame, like every other
      scene.update(1 / 60);
      scene.draw(s);
      expect(draws).toHaveBeenCalledTimes(1);
      expect(s.data.every((c) => c === P.ink)).toBe(false);
    } finally {
      draws.mockRestore();
    }
  });

  test("without a light yet, the first update builds it and does not count", () => {
    const scene = new CareerScene({ seed: 4, mode: "home", total: 400 });
    scene.resize(480, 270);
    scene.update(0.05);
    const s = new Surface(480, 270);
    scene.draw(s);
    expect(s.data.every((c) => c === P.ink)).toBe(true);
  });

  test("the iris opens a little every frame, never a jump, and is gone after ARRIVAL_SECONDS", () => {
    const scene = fresh();
    scene.update(0);
    for (let i = 0; i < OPEN_HOLD; i++) scene.update(1 / 60);
    const a = new Surface(480, 270);
    const b = new Surface(480, 270);
    const all = 480 * 270;
    let before = covered(scene, a, b);
    expect(a.data.every((c) => c === P.ink)).toBe(true);
    let still = 0;
    let longest = 0;
    let frames = 0;
    while (before > 0 && frames < 120) {
      scene.update(1 / 60);
      frames++;
      const now = covered(scene, a, b);
      expect(now).toBeLessThanOrEqual(before);
      // never more than a tenth of the screen in one sixtieth of a second
      expect(before - now).toBeLessThan(all * 0.1);
      still = now === before ? still + 1 : 0;
      longest = Math.max(longest, still);
      before = now;
    }
    expect(longest).toBeLessThanOrEqual(2);
    expect(frames / 60).toBeGreaterThan(ARRIVAL_SECONDS - 0.1);
    expect(frames / 60).toBeLessThanOrEqual(ARRIVAL_SECONDS + 1 / 60);
  });

  test("a long frame moves the opening on by one step at most", () => {
    const a = fresh();
    const b = fresh();
    a.update(0);
    b.update(0);
    for (let i = 0; i < OPEN_HOLD; i++) {
      a.update(1 / 60);
      b.update(1 / 60);
    }
    a.update(0.25);
    b.update(ARRIVAL_STEP);
    const s1 = new Surface(480, 270);
    const s2 = new Surface(480, 270);
    // the same opening (the picture under it has moved on: allow its own ink a few pixels)
    expect(Math.abs(covered(a, s1, s2) - covered(b, s1, s2))).toBeLessThan(40);
  });

  test("with reduced motion there is no iris", () => {
    const scene = fresh();
    scene.setReducedMotion(true);
    scene.update(0);
    const s = new Surface(480, 270);
    scene.draw(s);
    expect(s.data.filter((c) => c === P.ink).length).toBeLessThan(
      480 * 270 * 0.05,
    );
  });
});

describe("the promotion's close-up", () => {
  // The smoke on its own, in plain colours, at 480 x 270 and on a phone.
  const c = buildColors((col) => col);
  function frame(t: number, w: number, actionTop: number, groundY: number) {
    const size = closeUpSize(w, actionTop, groundY);
    const area = { top: 30, bottom: groundY + 9, w, cx: w >> 1, ...size };
    const s = new Surface(w, 270);
    s.clear(P.grass);
    drawBuild(s, t, area, c, 7);
    // the ball's ink (its outline and patches): nothing else in the smoke is ink
    let x0 = w;
    let x1 = -1;
    let ink = 0;
    let back = 0;
    let knots = 0;
    for (let y = 0; y < s.h; y++) {
      for (let x = 0; x < w; x++) {
        const col = s.get(x, y);
        if (col === c.patch) {
          ink++;
          x0 = Math.min(x0, x);
          x1 = Math.max(x1, x);
        }
        if (col === c.backTop) back++;
        if (col === c.knot) knots++;
      }
    }
    return { size, ink, wide: x1 - x0 + 1, mid: (x0 + x1) / 2, back, knots };
  }

  test.each([
    [480, 84, 140],
    [130, 87, 146],
  ])(
    "at %i wide: shut, then the ball big in the net in the middle, then shut again",
    (w, top, ground) => {
      for (const t of [
        0.1,
        BUILD.open0,
        BUILD.shut1 + 0.01,
        BUILD.clear0 + 0.2,
      ]) {
        const f = frame(t, w, top, ground);
        expect(f.ink, String(t)).toBe(0);
        expect(f.back, String(t)).toBe(0);
      }
      for (const t of [BUILD.hit + 0.05, (BUILD.hit + BUILD.shut0) / 2]) {
        const f = frame(t, w, top, ground);
        // a ball a good third of the hole's height across, right of the middle
        expect(f.wide, String(t)).toBeGreaterThanOrEqual(
          Math.min(f.size.ry * 0.8, f.size.rx * 0.7),
        );
        expect(f.mid).toBeGreaterThan(w / 2);
        expect(f.mid).toBeLessThan(w / 2 + f.size.rx * 0.5);
        // the ground out of focus behind it, and the net's knots in front
        expect(f.back).toBeGreaterThan(100);
        expect(f.knots).toBeGreaterThan(20);
      }
    },
  );

  test("it fills the middle of the screen: most of the action band on a monitor", () => {
    const L = careerLayout(480, 270);
    const { rx, ry, cy } = closeUpSize(L.w, L.actionTop, L.groundY);
    expect(cy - ry).toBeLessThanOrEqual(L.actionTop);
    expect(cy + ry).toBeGreaterThanOrEqual(L.groundY);
    expect(2 * rx).toBeGreaterThanOrEqual(200);
  });
});

describe("between shots", () => {
  test("the last goal's ball stays in the net when the next shot starts", () => {
    // the same next shot, after a goal and after a pass: only the first has a ball in the net
    const grab = (first: Grade): Surface => {
      const scene = new CareerScene({ seed: 2, mode: "home", total: 400 });
      scene.resize(480, 270);
      scene.setLighting(lightingFor({ elevation: 30, morning: true }));
      scene.update(0);
      scene.playShot(first);
      run(scene, 6);
      scene.playShot("timeup");
      run(scene, 0.2);
      const s = new Surface(480, 270);
      scene.draw(s);
      return s;
    };
    const L = careerLayout(480, 270);
    const a = grab("trivela");
    const b = grab("skipped");
    let differ = 0;
    for (let y = L.groundY - 5; y <= L.groundY + 1; y++) {
      for (let x = L.goalX + 4; x <= L.goalX + 12; x++) {
        if (a.get(x, y) !== b.get(x, y)) differ++;
      }
    }
    expect(differ).toBeGreaterThan(4);
  });

  test("a shot asked for during the last one's reaction moves people there, it does not cut", () => {
    const scene = new CareerScene({ seed: 2, mode: "home", total: 400 });
    scene.resize(480, 270);
    scene.update(0);
    const poses = (scene as unknown as { poses: { x: number; y: number }[] })
      .poses;
    const s = new Surface(480, 270);
    // the golazo: he is on his knees in the corner, a team-mate with him
    scene.playShot("golazo");
    run(scene, 2.8);
    scene.draw(s);
    const before = poses.map((p) => [p.x, p.y]);
    scene.playShot("toepoke");
    for (let i = 0; i < 24; i++) {
      scene.draw(s);
      for (let j = 0; j < poses.length; j++) {
        expect(Math.abs(poses[j].x - before[j][0])).toBeLessThanOrEqual(8);
        expect(Math.abs(poses[j].y - before[j][1])).toBeLessThanOrEqual(2);
        before[j] = [poses[j].x, poses[j].y];
      }
      scene.update(1 / 60);
    }
  });
});

describe("sound", () => {
  type Heard = { at: number; cue: SoundCue };

  /** A scene that writes down what it wants heard, and when (seconds since `listen`). */
  function listening(total: number, reduced = false) {
    const scene = ready(total, reduced);
    run(scene, 1);
    const heard: Heard[] = [];
    let now = 0;
    scene.onSound = (cue) => heard.push({ at: now, cue });
    const play = (seconds: number): void => {
      for (let t = 0; t < seconds; t += 1 / 60) {
        now += 1 / 60;
        scene.update(1 / 60);
      }
    };
    return { scene, heard, play };
  }

  const kinds = (heard: Heard[], kind: SoundCue["kind"]): Heard[] =>
    heard.filter((h) => h.cue.kind === kind);
  const power = (h: Heard): number =>
    h.cue.kind === "kick" ? h.cue.power : -1;

  const SHOTS = ["worldie", "golazo", "trivela", "toepoke", "tapin"] as const;

  test.each(SHOTS.flatMap((g) => [0, 400].map((t) => [g, t] as const)))(
    "a %s (total %i): a kick at the strike, then its sting and a cheer once, as it goes in",
    (grade, total) => {
      const { scene, heard, play } = listening(total);
      scene.playShot(grade);
      play(6);
      const score = kinds(heard, "score");
      expect(score.map((h) => h.cue)).toEqual([{ kind: "score", shot: grade }]);
      const cheers = kinds(heard, "cheer");
      expect(cheers).toHaveLength(1);
      expect(cheers[0].at).toBeCloseTo(score[0].at, 5);
      // the shot's own kick is the hardest, and it comes before the ball goes in
      const kicks = kinds(heard, "kick");
      const strike = kicks.reduce((a, b) => (power(b) > power(a) ? b : a));
      expect(strike.at).toBeLessThan(score[0].at);
      expect(strike.at).toBeGreaterThan(0.08);
      expect(kinds(heard, "groan")).toHaveLength(0);
      expect(kinds(heard, "whistle")).toHaveLength(0);
    },
  );

  test("the better the shot, the harder the kick and the bigger the cheer", () => {
    const powers: number[] = [];
    const sizes: number[] = [];
    for (const grade of SHOTS) {
      const { scene, heard, play } = listening(400);
      scene.playShot(grade);
      play(3);
      powers.push(Math.max(...kinds(heard, "kick").map(power)));
      const cheer = kinds(heard, "cheer")[0].cue;
      sizes.push(cheer.kind === "cheer" ? cheer.size : -1);
    }
    expect(powers[0]).toBe(1);
    expect(powers.at(-1)).toBeCloseTo(0.2, 5);
    expect(sizes[0]).toBe(1);
    expect(sizes.at(-1)).toBeCloseTo(0.2, 5);
    for (let i = 1; i < SHOTS.length; i++) {
      expect(sizes[i]).toBeLessThan(sizes[i - 1]);
    }
    expect(powers[1]).toBeGreaterThan(powers[3]);
    expect(powers[2]).toBeGreaterThan(powers[3]);
  });

  test("a vuvuzela for every goal at the World Cup (tiers 6 and 7), sized by the shot; never below", () => {
    for (const total of [0, 100, 200, 300, 400, 500, 540, 600, 630]) {
      for (const grade of GRADES) {
        const { scene, heard, play } = listening(total);
        scene.playShot(grade);
        play(6);
        const horns = kinds(heard, "vuvuzela");
        const goal = (SHOTS as readonly string[]).includes(grade);
        expect(horns.length, `${grade} at ${total}`).toBe(
          goal && total >= 540 ? 1 : 0,
        );
        if (horns.length > 0) {
          // with the cheer, as big as it
          const cheer = kinds(heard, "cheer")[0];
          expect(horns[0].at).toBeGreaterThan(cheer.at);
          expect(horns[0].at - cheer.at).toBeLessThan(0.5);
          expect(horns[0].cue).toEqual({
            kind: "vuvuzela",
            size: cheer.cue.kind === "cheer" ? cheer.cue.size : -1,
          });
        }
      }
    }
  });

  test("fireworks at the stadium tiers only, faint, more for a better shot", () => {
    const count = (grade: Grade, total: number): number => {
      const { scene, heard, play } = listening(total);
      scene.playShot(grade);
      play(5);
      const fw = kinds(heard, "firework");
      for (const h of fw) {
        expect(h.cue).toEqual({ kind: "firework", distant: true });
      }
      return fw.length;
    };
    expect(count("worldie", 300)).toBe(0);
    expect(count("worldie", 0)).toBe(0);
    expect(count("miss", 400)).toBe(0);
    expect(SHOTS.map((g) => count(g, 400))).toEqual([7, 5, 4, 3, 2]);
  });

  test("the wind blows only while a hard shot is in the air", () => {
    for (const grade of GRADES) {
      const { scene, heard, play } = listening(400);
      scene.playShot(grade);
      play(4);
      const wind = kinds(heard, "wind");
      if (grade === "worldie" || grade === "golazo" || grade === "trivela") {
        expect(wind.length).toBeGreaterThan(8);
        const score = kinds(heard, "score")[0];
        for (const h of wind) {
          expect(h.at).toBeLessThanOrEqual(score.at);
          const speed = h.cue.kind === "wind" ? h.cue.speed : -1;
          expect(speed).toBeGreaterThan(0);
          expect(speed).toBeLessThanOrEqual(1);
        }
      } else if (grade !== "miss") {
        expect(wind).toHaveLength(0);
      }
    }
  });

  test("a miss: skied is a groan, dragged wide an ooh; its sting either way", () => {
    const { scene, heard, play } = listening(400);
    scene.playShot("miss");
    play(6);
    expect(kinds(heard, "groan")).toHaveLength(1);
    expect(kinds(heard, "ooh")).toHaveLength(0);
    scene.playShot("miss");
    play(6);
    expect(kinds(heard, "groan")).toHaveLength(1);
    expect(kinds(heard, "ooh")).toHaveLength(1);
    expect(kinds(heard, "score").map((h) => h.cue)).toEqual([
      { kind: "score", shot: "miss" },
      { kind: "score", shot: "miss" },
    ]);
    expect(kinds(heard, "cheer")).toHaveLength(0);
  });

  test("time up is the referee's whistle; a pass is two soft kicks; neither has a sting", () => {
    const a = listening(200);
    a.scene.playShot("timeup");
    a.play(6);
    expect(kinds(a.heard, "whistle").map((h) => h.cue)).toEqual([
      { kind: "whistle" },
    ]);
    expect(kinds(a.heard, "kick")).toHaveLength(0);
    expect(kinds(a.heard, "score")).toHaveLength(0);

    const b = listening(200);
    b.scene.playShot("skipped");
    b.play(6);
    const kicks = kinds(b.heard, "kick");
    expect(kicks).toHaveLength(2);
    for (const k of kicks) expect(power(k)).toBeLessThanOrEqual(0.2);
    expect(kinds(b.heard, "score")).toHaveLength(0);
    expect(kinds(b.heard, "cheer")).toHaveLength(0);
  });

  test("with reduced motion the strike and the result are heard at once", () => {
    const { scene, heard, play } = listening(600, true);
    scene.playShot("worldie");
    play(0.05);
    expect(heard.map((h) => h.cue.kind)).toEqual(
      expect.arrayContaining(["kick", "score", "cheer", "vuvuzela"]),
    );
    expect(kinds(heard, "wind")).toHaveLength(0);
    play(4);
    expect(kinds(heard, "score")).toHaveLength(1);
    expect(kinds(heard, "firework")).toHaveLength(0);
  });

  test("the juggle while the player types is very quiet: every other touch, at 0.15", () => {
    const { heard, play } = listening(0);
    play(4);
    const touches = kinds(heard, "touch");
    expect(touches.length).toBeGreaterThanOrEqual(6);
    expect(touches.length).toBeLessThanOrEqual(8);
    for (const h of touches)
      expect(h.cue).toEqual({ kind: "touch", level: 0.15 });
    expect(heard.every((h) => h.cue.kind === "touch")).toBe(true);
  });

  test("the opening is heard as it starts, and the whistle starts play as it ends", () => {
    const scene = new CareerScene({ seed: 4, mode: "home", total: 0 });
    const heard: Heard[] = [];
    let now = 0;
    scene.onSound = (cue) => heard.push({ at: now, cue });
    scene.resize(480, 270);
    scene.setLighting(lightingFor({ elevation: 25, morning: true }));
    scene.update(0);
    expect(heard).toHaveLength(0);
    for (let i = 0; i < 90; i++) {
      now += 1 / 60;
      scene.update(1 / 60);
    }
    const transitions = kinds(heard, "transition");
    expect(transitions.map((h) => h.cue)).toEqual([
      { kind: "transition", opening: true },
    ]);
    // after the frames held on ink once the picture is built
    expect(transitions[0].at).toBeLessThan((OPEN_HOLD + 1) / 60 + 0.002);
    const whistles = kinds(heard, "whistle");
    expect(whistles.map((h) => h.cue)).toEqual([{ kind: "whistle" }]);
    expect(
      Math.abs(whistles[0].at - ARRIVAL_SECONDS - OPEN_HOLD / 60),
    ).toBeLessThan(0.03);
  });

  test("a promotion: the sweep as it starts, the ball into the net, a cheer as the new ground appears", () => {
    const { scene, heard, play } = listening(100);
    scene.promote(400);
    play(2);
    const other = heard.filter((h) => h.cue.kind !== "touch");
    expect(other.map((h) => h.cue.kind)).toEqual(["sweep", "net", "cheer"]);
    expect(other[0].at).toBeLessThan(0.02);
    expect(Math.abs(other[1].at - BUILD.hit)).toBeLessThan(0.02);
    expect(other[2].at).toBeGreaterThan(0.9);
  });

  test("full time: the long whistle, then the crowd", () => {
    const { scene, heard, play } = listening(600);
    scene.showFullTime(700);
    play(2);
    expect(heard.map((h) => h.cue.kind)).toEqual(["whistle", "cheer"]);
    expect(heard[0].cue).toEqual({ kind: "whistle", long: true });
  });

  test("the bed of sound follows the tier: the park, then a ground, then a stadium", () => {
    const venues: string[] = [];
    let crowd = -1;
    for (let tier = 0; tier < 8; tier++) {
      const scene = ready([0, 100, 200, 300, 400, 500, 600, 690][tier]);
      const a = scene.ambience();
      expect(a.tier).toBe(tier);
      expect(a.crowd).toBeGreaterThanOrEqual(crowd);
      expect(a.crowd).toBeGreaterThan(0);
      expect(a.crowd).toBeLessThanOrEqual(1);
      crowd = a.crowd;
      venues.push(a.venue);
      // the World Cup is always played at night; this morning's light is not night
      expect(a.night).toBe(tier >= 6);
    }
    expect(venues).toEqual([
      "park",
      "park",
      "ground",
      "ground",
      "stadium",
      "stadium",
      "stadium",
      "stadium",
    ]);
    const night = new CareerScene({ seed: 1, mode: "away", total: 100 });
    night.setLighting(lightingFor({ elevation: -30, morning: false }));
    expect(night.ambience().night).toBe(true);
  });
});
