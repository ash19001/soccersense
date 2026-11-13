/**
 * Package G2: the cars on the side roads and far away drive as evenly as the
 * train: frame by frame a car moves along its line on screen a whole pixel at a time,
 * the step across and the step up together, at an even beat, and shrinks a size step at
 * a time as it drives away, never back. Records the cars as stadium-life.ts draws them
 * (through stadium-cars.ts `carSprite`).
 */

import { describe, expect, it, vi } from "vitest";
import { lightingFor } from "~/art/lighting";

const log: { on: boolean; cars: { x: number; y: number; step: number }[] } = {
  on: false,
  cars: [],
};

vi.mock("~/art/stadium-cars", async (importOriginal) => {
  const real = await importOriginal<typeof import("~/art/stadium-cars")>();
  return {
    ...real,
    carSprite: (...a: unknown[]): void => {
      if (log.on) {
        log.cars.push({
          x: a[1] as number,
          y: a[2] as number,
          step: (a[6] as number | undefined) ?? -1,
        });
      }
      (real.carSprite as (...b: unknown[]) => void)(...a);
    },
  };
});

const { makeLife } = await import("~/art/stadium-life");
const { ROAD } = await import("~/art/stadium-plan");
const { paintTown } = await import("~/art/stadium-town");
const { makeView, project } = await import("~/art/stadium-view");
const { Surface } = await import("~/pixel");

const DAY = lightingFor({ elevation: 45, morning: false });

/**
 * One car on West Road's northbound lane, frame by frame at 60 a second from the bottom
 * of the screen to North Road: where its sprite is drawn, and its size step.
 */
function westRoadCar() {
  const w = 960;
  const h = 540;
  const view = makeView(w, h);
  const life = makeLife(view, DAY, 3, paintTown(view, DAY, 3));
  const s = new Surface(w, h);
  const X0 = ROAD.westX0 + 2.9;
  // the first car on the lane low on the screen at t = 0 (the last reported is the
  // away coach, which uses the same lane)
  const all: [number, number][] = [];
  life.cars(0, (X, V) => all.push([X, V]));
  let V0 = Infinity;
  for (const [X, V] of all.slice(0, -1)) {
    if (Math.abs(X - X0) < 0.01 && V > -100 && V < V0) V0 = V;
  }
  const frames: { x: number; y: number; step: number }[] = [];
  // followed from the bottom of the road (some time before t = 0) to the top
  const t0 = (-100 - V0) / 6;
  for (let f = 0; ; f++) {
    const t = t0 + f / 60;
    const V = V0 + 6 * t;
    if (V > ROAD.northV0 - 4) break;
    const want = project(view, X0, V);
    log.cars = [];
    log.on = true;
    life.draw(s, t, 0);
    log.on = false;
    // the one drawn where this car is (within a pixel of its ground point)
    const it = log.cars.find(
      (c) => Math.abs(c.x - want.x) <= 1 && Math.abs(c.y - want.y) <= 1,
    );
    if (it) frames.push(it);
  }
  return frames;
}

describe("cars that drive evenly", () => {
  it("moves a West Road car a pixel at a time, across and up together, at an even beat", () => {
    const frames = westRoadCar();
    expect(frames.length).toBeGreaterThan(1500);
    const gaps: number[] = [];
    let since = 0;
    let lone = 0;
    for (let i = 1; i < frames.length; i++) {
      const dx = frames[i].x - frames[i - 1].x;
      const dy = frames[i].y - frames[i - 1].y;
      expect(Math.abs(dx)).toBeLessThanOrEqual(1);
      expect(Math.abs(dy)).toBeLessThanOrEqual(1);
      since++;
      if (dx === 0 && dy === 0) continue;
      // the road runs across more than up: every move steps across
      if (dx === 0) lone++;
      gaps.push(since);
      since = 0;
    }
    expect(lone).toBe(0);
    // an even beat: neighbouring moves are never more than a frame apart in rhythm,
    // except once in a while where the perspective slows it by a frame
    let uneven = 0;
    for (let i = 2; i < gaps.length; i++) {
      if (Math.abs(gaps[i] - gaps[i - 1]) > 1) uneven++;
    }
    expect(uneven / gaps.length).toBeLessThan(0.02);
  }, 120_000);

  it("shrinks it a size step at a time as it drives away, never back", () => {
    const steps = westRoadCar().map((f) => f.step);
    const seen: number[] = [];
    for (const s of steps) if (seen[seen.length - 1] !== s) seen.push(s);
    // from near to far through every step between
    expect(seen.length).toBeGreaterThanOrEqual(4);
    for (let i = 1; i < seen.length; i++) expect(seen[i]).toBe(seen[i - 1] - 1);
  }, 120_000);
});
