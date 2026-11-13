/**
 * Package G2: no car, bus or coach on the move ever drives over a parked one beside it.
 * The parked vehicles are painted into the town (stadium-town.ts), the moving ones drawn
 * over it each frame (stadium-life.ts); this records both through the sprite functions
 * (stadium-cars.ts `carSprite`, `coachSprite`) and checks, frame by frame for two
 * minutes, that no pixel of a moving vehicle lands on a parked one at about the same
 * depth (side by side on the map). One far behind the other is the nearer passing in
 * front, as it should be, and is not counted. By day, monitor and phone canvases.
 */

import { describe, expect, it, vi } from "vitest";
import { lightingFor } from "~/art/lighting";
import { P } from "~/art/palette";
import type { CarLook, CoachLook, Ink } from "~/art/stadium-things";

interface Drawn {
  coach: boolean;
  x: number;
  y: number;
  args: unknown[];
}

const log: { on: boolean; drawn: Drawn[] } = { on: false, drawn: [] };

vi.mock("~/art/stadium-cars", async (importOriginal) => {
  const real = await importOriginal<typeof import("~/art/stadium-cars")>();
  const wrap =
    (coach: boolean, fn: (...a: never[]) => void) =>
    (...a: unknown[]): void => {
      if (log.on) {
        log.drawn.push({
          coach,
          x: a[1] as number,
          y: a[2] as number,
          args: a,
        });
      }
      (fn as (...b: unknown[]) => void)(...a);
    };
  return {
    ...real,
    carSprite: wrap(false, real.carSprite),
    coachSprite: wrap(true, real.coachSprite),
  };
});

const cars = await import("~/art/stadium-cars");
const { makeLife } = await import("~/art/stadium-life");
const { paintTown } = await import("~/art/stadium-town");
const { depthAtRow, makeView } = await import("~/art/stadium-view");
const { Surface } = await import("~/pixel");

const DAY = lightingFor({ elevation: 45, morning: false });
const CAR: CarLook = { b: P.home, l: P.home, d: P.home, g: P.home, k: P.home };
const COACH: CoachLook = {
  roof: P.home,
  roofHi: P.home,
  side: P.home,
  stripe: P.home,
  glass: P.home,
  tyre: P.home,
};
/** Map units of depth within which two vehicles stand side by side. */
const BESIDE = 5;
/** Pixels two vehicles may share where their corners touch. */
const TOUCH = 2;

/** The pixels a recorded vehicle covers, as indices into a w-wide canvas. */
function footprint(d: Drawn, w: number, h: number): number[] {
  const out: number[] = [];
  const ink: Ink = {
    px(x, y) {
      if (x >= 0 && x < w && y >= 0 && y < h) out.push(y * w + x);
    },
    rect() {},
  };
  const a = d.args.slice();
  a[0] = ink;
  a[5] = d.coach ? COACH : CAR;
  log.on = false;
  // the real functions (the mock passes everything on to them)
  ((d.coach ? cars.coachSprite : cars.carSprite) as (...b: unknown[]) => void)(
    ...a,
  );
  return out;
}

/** Every moving vehicle drawn over a parked one beside it, in `seconds` of traffic. */
function overlaps(w: number, h: number, seconds: number): string[] {
  const view = makeView(w, h);
  log.drawn = [];
  log.on = true;
  const town = paintTown(view, DAY, 3);
  log.on = false;
  const parked = log.drawn.slice();
  const taken = new Map<number, number>();
  parked.forEach((p, i) => {
    for (const k of footprint(p, w, h)) taken.set(k, i);
  });
  const life = makeLife(view, DAY, 3, town);
  const s = new Surface(w, h);
  const found = new Set<string>();
  for (let t = 0; t < seconds; t += 0.2) {
    log.drawn = [];
    log.on = true;
    life.draw(s, t, 0);
    log.on = false;
    for (const m of log.drawn.slice()) {
      // the parked ones under it, and how many of its pixels each
      const under = new Map<number, number>();
      for (const k of footprint(m, w, h)) {
        const i = taken.get(k);
        if (i !== undefined) under.set(i, (under.get(i) ?? 0) + 1);
      }
      for (const [i, shared] of under) {
        // two corners touching is not driving over it
        if (shared <= TOUCH) continue;
        const p = parked[i];
        // how far apart in depth they may be, from the rows of their ground points (a
        // row spans a little depth): beside only if even the most is under BESIDE
        const apart = Math.max(
          Math.abs(depthAtRow(view, p.y - 0.5) - depthAtRow(view, m.y + 0.5)),
          Math.abs(depthAtRow(view, m.y - 0.5) - depthAtRow(view, p.y + 0.5)),
        );
        if (apart >= BESIDE) continue;
        found.add(
          `${w}x${h} t ${t.toFixed(1)}: ${m.coach ? "coach" : "car"} at ${m.x},${m.y} over ${p.coach ? "coach" : "car"} at ${p.x},${p.y} (${shared} px)`,
        );
      }
    }
  }
  return [...found];
}

describe("parked and moving cars", () => {
  it("never drives a car, bus or coach over a parked one beside it", () => {
    for (const [w, h] of [
      [960, 540],
      [683, 384],
      [854, 480],
      [260, 563],
    ] as const) {
      const found = overlaps(w, h, 120);
      expect(found.slice(0, 8), `${found.length} at ${w}x${h}`).toEqual([]);
    }
  }, 300_000);
});
