/**
 * Package G2: the five size steps of the home picture's cars, coaches and people
 * (traffic-steps.ts, stadium-cars-steps.ts, stadium-people.ts), which keep the three size
 * classes as steps 0, 2 and 4 and draw two more between them.
 */

import { describe, expect, it } from "vitest";
import { type Color } from "~/pixel";
import { P } from "~/art/palette";
import { HEADINGS, carSprite, coachSprite } from "~/art/stadium-cars";
import {
  carGrid,
  carStepGrid,
  coachGrid,
  coachStepGrid,
} from "~/art/stadium-cars";
import { CARS_STEPS, COACHES_STEPS } from "~/art/stadium-cars-steps";
import {
  carShadow,
  person,
  type CarLook,
  type CoachLook,
  type Ink,
} from "~/art/stadium-things";
import { personLook } from "~/art/stadium-town";
import { sizeClass } from "~/art/stadium-view";
import { STEP_AT, sizeStep, stepOfClass, type Step } from "~/art/traffic-steps";

const STEPS: readonly Step[] = [0, 1, 2, 3, 4];
const CAR: CarLook = {
  b: P.home,
  l: P.homeLight,
  d: P.homeDark,
  g: P.night,
  k: P.ink,
};
const COACH: CoachLook = {
  roof: P.chalk,
  roofHi: P.white,
  side: P.mist,
  stripe: P.gold,
  glass: P.slate,
  tyre: P.ink,
};

function record(draw: (ink: Ink) => void): Map<string, Color> {
  const out = new Map<string, Color>();
  draw({
    px(x, y, c) {
      out.set(`${x},${y}`, c);
    },
    rect(x, y, w, h, c) {
      for (let j = 0; j < h; j++)
        for (let i = 0; i < w; i++) out.set(`${x + i},${y + j}`, c);
    },
  });
  return out;
}

function box(px: Map<string, Color>) {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const k of px.keys()) {
    const [x, y] = k.split(",").map(Number);
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  return { x0, x1, y0, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

describe("the size steps", () => {
  it("keep the far and near size classes, and split the middle one in three", () => {
    for (let s = 0.05; s < 4; s += 0.01) {
      const step = sizeStep(s * 2);
      const cls = sizeClass(s * 2);
      if (cls === 0) expect(step).toBe(0);
      else if (cls === 2) expect(step).toBe(4);
      else expect([1, 2, 3]).toContain(step);
    }
  });

  it("only ever grow with the scale, one step at a time", () => {
    let last = 0;
    for (let s = 0.1; s < 8; s += 0.002) {
      const step = sizeStep(s);
      expect(step - last).toBeGreaterThanOrEqual(0);
      expect(step - last).toBeLessThanOrEqual(1);
      last = step;
    }
    expect(last).toBe(4);
    expect(STEP_AT.length).toBe(4);
  });
});

const LETTERS_CAR = new Set("blndfrgwkmyqHTYQ.");
const LETTERS_COACH = new Set("oijJsegfrwkmnyqHTYQ.");

describe("the in-between vehicles", () => {
  it("keeps every grid rectangular, in its own letters, the anchor inside", () => {
    for (const [set, letters, n] of [
      [CARS_STEPS, LETTERS_CAR, 7],
      [COACHES_STEPS, LETTERS_COACH, 14],
    ] as const) {
      expect(set.length).toBe(2);
      for (const step of set) {
        expect(step.length).toBe(n);
        for (const g of step) {
          const w = g.day[0].length;
          for (const row of g.day) {
            expect(row.length).toBe(w);
            for (const ch of row) expect(letters.has(ch), ch).toBe(true);
          }
          expect(g.ax).toBeGreaterThanOrEqual(0);
          expect(g.ax).toBeLessThan(w);
          expect(g.ay).toBeGreaterThanOrEqual(0);
          expect(g.ay).toBeLessThan(g.day.length);
        }
      }
    }
  });

  it("draws the three size classes as steps 0, 2 and 4", () => {
    for (let hd = 0; hd < HEADINGS; hd++) {
      for (const cls of [0, 1, 2] as const) {
        expect(carStepGrid(stepOfClass(cls), hd)).toBe(carGrid(cls, hd));
        expect(coachStepGrid(stepOfClass(cls), hd)).toBe(coachGrid(cls, hd));
      }
    }
  });

  it("grows a car and a coach step by step: 6, 8, 10, 12, 14 px long pointing east", () => {
    for (let hd = 0; hd < HEADINGS; hd++) {
      let car = 0;
      let coach = 0;
      for (const step of STEPS) {
        const c = box(record((ink) => carSprite(ink, 0, 0, 2, hd, CAR, step)));
        const b = box(
          record((ink) => coachSprite(ink, 0, 0, 2, hd, COACH, step)),
        );
        // bigger every step, in area
        expect(c.w * c.h, `car ${hd} step ${step}`).toBeGreaterThan(car);
        expect(b.w * b.h, `coach ${hd} step ${step}`).toBeGreaterThan(coach);
        car = c.w * c.h;
        coach = b.w * b.h;
      }
    }
    const east = STEPS.map(
      (step) => box(record((ink) => carSprite(ink, 0, 0, 2, 0, CAR, step))).w,
    );
    expect(east).toEqual([7, 9, 11, 13, 15]);
  });

  it("keeps each car round its ground point at every step", () => {
    for (let hd = 0; hd < HEADINGS; hd++) {
      for (const step of STEPS) {
        const c = box(record((ink) => carSprite(ink, 0, 0, 2, hd, CAR, step)));
        expect(c.x0).toBeLessThanOrEqual(0);
        expect(c.x1).toBeGreaterThanOrEqual(0);
        expect(c.y0).toBeLessThanOrEqual(0);
        expect(c.y1).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("casts a shadow at the two nearest steps, a smaller one at step 3", () => {
    expect(carShadow(0, 2, 0)).toBeNull();
    expect(carShadow(0, 2, 2)).toBeNull();
    const near = [...(carShadow(0, 2, 4) ?? [])];
    const mid = [...(carShadow(0, 2, 3) ?? [])];
    expect(mid[2]).toBeLessThan(near[2]);
    // without a step, the size class's
    expect(carShadow(0, 1)).toBeNull();
    expect(carShadow(0, 2)).toEqual(near);
  });
});

describe("the in-between people", () => {
  it("stands 4, 5, 6, 8 and 10 tall, 2, 2, 2, 4 and 6 wide, on row y - 1, centred", () => {
    for (let i = 0; i < 64; i++) {
      const k = personLook((c) => c, (i + 0.5) / 64, i % 4);
      const hat = k.head === 2;
      const sizes = STEPS.map((step) =>
        box(record((ink) => person(ink, 10, 20, 2, k, 0, 0, false, step))),
      );
      expect(sizes.map((b) => b.y1)).toEqual([19, 19, 19, 19, 19]);
      expect(sizes.map((b) => b.h)).toEqual(
        hat ? [4, 5, 6, 9, 11] : [4, 5, 6, 8, 10],
      );
      expect(sizes.map((b) => b.w)).toEqual([2, 2, 2, 4, 6]);
      // the middle of each is half a pixel right of x, as the middle class's
      for (const b of sizes) expect(b.x0 + b.x1).toBe(21);
    }
  });

  it("strides, turns its back and throws its arms up at step 3", () => {
    const k = personLook((c) => c, 0.3, 1);
    const stand = record((ink) => person(ink, 0, 0, 2, k, 0, 0, false, 3));
    const stride = record((ink) => person(ink, 0, 0, 2, k, 1, 0, false, 3));
    const back = record((ink) => person(ink, 0, 0, 2, k, 0, 0, true, 3));
    const jump = record((ink) => person(ink, 0, 0, 2, k, 0, 3, false, 3));
    expect(stride).not.toEqual(stand);
    expect(back).not.toEqual(stand);
    // in a jump the hands go up beside the head, above where the shoulders were
    expect(box(jump).y0).toBeLessThan(box(stand).y0 - 2);
    expect(box(jump).w).toBe(4);
  });

  it("draws the size classes when no step is given", () => {
    const k = personLook((c) => c, 0.2, 0);
    for (const cls of [0, 1, 2] as const) {
      expect(record((ink) => person(ink, 5, 30, cls, k, 1))).toEqual(
        record((ink) =>
          person(ink, 5, 30, cls, k, 1, 0, false, stepOfClass(cls)),
        ),
      );
    }
  });
});
