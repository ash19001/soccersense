import { describe, expect, test } from "vitest";

import {
  FRAME_MS,
  MAX_STEP_MS,
  SLIDE_MS,
  createSlider,
  sampleSlide,
  slideCurve,
  snapToDevice,
} from "./slide";

describe("snapToDevice", () => {
  test("rounds to whole device pixels at any ratio", () => {
    expect(snapToDevice(10.4, 1)).toBe(10);
    expect(snapToDevice(10.6, 1)).toBe(11);
    expect(snapToDevice(10.3, 2)).toBe(10.5);
    expect(snapToDevice(10.1, 1.25)).toBeCloseTo(10.4);
    for (const dpr of [1, 1.25, 1.5, 2, 3]) {
      for (let x = -40; x < 40; x += 0.37) {
        const device = snapToDevice(x, dpr) * dpr;
        expect(Math.abs(device - Math.round(device))).toBeLessThan(1e-9);
      }
    }
  });

  test("never gives -0, and a bad ratio counts as 1", () => {
    expect(Object.is(snapToDevice(-0.2, 1), 0)).toBe(true);
    expect(snapToDevice(3.6, 0)).toBe(4);
    expect(snapToDevice(3.6, Number.NaN)).toBe(4);
  });
});

describe("the curve", () => {
  test("from rest it is the ease-out cubic: quick to leave, gentle to settle", () => {
    const curve = slideCurve(0, 300, 0);
    for (let t = 0; t <= SLIDE_MS; t += 10) {
      const u = t / SLIDE_MS;
      expect(sampleSlide(curve, t).x).toBeCloseTo(300 * (1 - (1 - u) ** 3), 6);
    }
    // Most of the way in the first third, the last tenth of the time barely moving.
    expect(sampleSlide(curve, SLIDE_MS / 3).x).toBeGreaterThan(200);
    expect(300 - sampleSlide(curve, SLIDE_MS * 0.9).x).toBeLessThan(1);
    expect(sampleSlide(curve, SLIDE_MS)).toEqual({ x: 300, v: 0, done: true });
    expect(sampleSlide(curve, 5000).done).toBe(true);
  });

  test("moves the same way every frame, and never past the target", () => {
    for (const [from, to] of [
      [0, 312],
      [312, 0],
      [0, -400],
    ] as const) {
      const curve = slideCurve(from, to, 0);
      let last: number = from;
      for (let t = 0; t <= SLIDE_MS; t += FRAME_MS) {
        const { x } = sampleSlide(curve, t);
        expect(
          Math.sign(x - last) * Math.sign(to - from),
        ).toBeGreaterThanOrEqual(0);
        expect(Math.abs(x - from)).toBeLessThanOrEqual(
          Math.abs(to - from) + 1e-9,
        );
        last = x;
      }
    }
  });

  test("turned round, it keeps its speed, so it slows and comes back without a jolt", () => {
    const out = slideCurve(0, 300, 0);
    const half = sampleSlide(out, SLIDE_MS / 2);
    const back = slideCurve(half.x, 0, SLIDE_MS / 2, SLIDE_MS, half.v);
    const start = sampleSlide(back, SLIDE_MS / 2);
    expect(start.x).toBeCloseTo(half.x, 9);
    expect(start.v).toBeCloseTo(half.v, 9);
    // It carries on a little, stays short of where it was going, then comes all the way back.
    let furthest = half.x;
    for (let t = SLIDE_MS / 2; t <= SLIDE_MS * 1.5; t += 1) {
      furthest = Math.max(furthest, sampleSlide(back, t).x);
    }
    expect(furthest).toBeGreaterThan(half.x);
    expect(furthest).toBeLessThan(300);
    expect(sampleSlide(back, SLIDE_MS * 1.5).x).toBe(0);
  });

  test("never sets off towards the target faster than a fresh slide", () => {
    const curve = slideCurve(0, 100, 0, SLIDE_MS, 50);
    expect(curve.v0).toBeCloseTo(300 / SLIDE_MS);
    for (let t = 0; t <= SLIDE_MS; t += 5) {
      expect(sampleSlide(curve, t).x).toBeLessThanOrEqual(100 + 1e-9);
    }
  });
});

describe("createSlider", () => {
  function rig(ratio = 1) {
    const shown: number[] = [];
    let ended = 0;
    let queue: ((time: number) => void)[] = [];
    let clock = 1000;
    const slider = createSlider({
      apply: (x) => shown.push(x),
      end: () => ended++,
      ratio: () => ratio,
      frame: (callback) => {
        queue.push(callback);
        return queue.length;
      },
      cancelFrame: () => {
        queue = [];
      },
    });
    /** One frame of the display, `ms` after the last. */
    const step = (ms = FRAME_MS) => {
      clock += ms;
      const due = queue;
      queue = [];
      for (const callback of due) callback(clock);
    };
    return {
      slider,
      shown,
      step,
      ended: () => ended,
      pending: () => queue.length,
    };
  }

  test("shows the start at once, then one whole-pixel position a frame until it rests", () => {
    const { slider, shown, step, ended } = rig(1.25);
    slider.to(312, 0);
    expect(shown).toEqual([0]);
    expect(slider.moving).toBe(true);
    expect(slider.target).toBe(312);
    let frames = 0;
    while (slider.moving && frames < 100) {
      step();
      frames++;
    }
    // 0.3 s at 60 Hz: 18 frames.
    expect(frames).toBe(18);
    expect(shown.at(-1)).toBe(snapToDevice(312, 1.25));
    expect(ended()).toBe(1);
    for (const x of shown) {
      expect(Math.abs(x * 1.25 - Math.round(x * 1.25))).toBeLessThan(1e-9);
    }
    // Every frame moves (the ease-out is fast enough until the last few), always outwards.
    for (let i = 1; i < shown.length; i++) {
      expect(shown[i]!).toBeGreaterThanOrEqual(shown[i - 1]!);
    }
    expect(shown[1]).toBeGreaterThan(0);
  });

  test("a late frame is a moment's wait, never a jump", () => {
    const ease = (ms: number) => 300 * (1 - (1 - ms / SLIDE_MS) ** 3);
    const { slider, shown, step } = rig();
    slider.to(300, 0);
    // The first frame is one frame in, however late.
    step(200);
    expect(shown[1]).toBe(Math.round(ease(FRAME_MS)));
    // A stall moves it on by at most 1/30 s.
    step(150);
    expect(shown[2]).toBe(Math.round(ease(FRAME_MS + MAX_STEP_MS)));
    step();
    expect(shown[3]).toBe(Math.round(ease(2 * FRAME_MS + MAX_STEP_MS)));
  });

  test("a second press turns it round from where it is", () => {
    const { slider, shown, step, ended } = rig();
    slider.to(300, 0);
    for (let i = 0; i < 9; i++) step();
    const there = shown.at(-1)!;
    slider.to(0, 300);
    // Nothing jumps: the next frame is near the last.
    step();
    expect(Math.abs(shown.at(-1)! - there)).toBeLessThan(10);
    while (slider.moving) step();
    expect(shown.at(-1)).toBe(0);
    expect(ended()).toBe(1);
    expect(Math.max(...shown)).toBeLessThan(300);
  });

  test("keeps within its bounds, and stop is silent", () => {
    const shown: number[] = [];
    let queued: ((time: number) => void) | null = null;
    let ended = false;
    const slider = createSlider({
      apply: (x) => shown.push(x),
      end: () => (ended = true),
      bounds: [0, 50],
      ratio: () => 1,
      frame: (callback) => {
        queued = callback;
        return 1;
      },
      cancelFrame: () => {
        queued = null;
      },
    });
    slider.to(0, 80);
    expect(shown).toEqual([50]);
    slider.stop();
    expect(slider.moving).toBe(false);
    expect(queued).toBeNull();
    expect(ended).toBe(false);
  });
});
