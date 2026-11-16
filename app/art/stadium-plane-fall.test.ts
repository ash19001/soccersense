import { describe, expect, it } from "vitest";

import { Surface, TRANSPARENT } from "~/pixel";
import { lightingFor } from "~/art/lighting";
import type { CrashSite } from "~/art/stadium-airship-fall";
import {
  PLANE_FIRST,
  PLANE_SIZE,
  bannerWords,
  paintBanner,
  planeBox,
  trainLength,
} from "~/art/stadium-plane";
import {
  PLANE_FALL,
  type PlaneCrash,
  drawPlaneCrash,
  planeBallSpot,
  planePilotAt,
} from "~/art/stadium-plane-fall";

// The plane brought down (AWAY's ball meets it): it falls as the airship does, to a place
// on the ground, and lands with the airship's dust or splash.

const DAY = lightingFor({ elevation: 40, morning: false });
const NIGHT = lightingFor({ elevation: -25, morning: false });
const W = 960;
const H = 420;
const ROW = 120;
const b = paintBanner(
  bannerWords("DID YOU KNOW?", "A fact about a goal."),
  DAY,
);
/** Hit two seconds into its first pass. */
const T0 = PLANE_FIRST + 2;
/** Grass well under it and a little to the left, the pilot's place beside it. */
const GRASS: CrashSite = {
  x: 800,
  y: 330,
  V: 40,
  scale: 1,
  water: false,
  pilotX: 826,
  pilotY: 334,
};
const POND: CrashSite = { ...GRASS, water: true };
/** Where the wreck lies, clear of where the pilot comes down beside it (to its right). */
const WRECK = [GRASS.x - 20, GRASS.y - 26, GRASS.x + 12, GRASS.y + 8] as const;
/** Nothing stands anywhere: the whole town is far off. */
const OPEN = new Float32Array(W * H).fill(1e6);

function crashOf(site = GRASS): PlaneCrash {
  const box = planeBox(T0, W, trainLength(b), ROW);
  if (!box) throw new Error("no plane to hit");
  return { t0: T0, x: box.x, y: box.y + box.h / 2, site };
}

function draw(t: number, site = GRASS, depth = OPEN, light = DAY): Surface {
  const s = new Surface(W, H);
  drawPlaneCrash(s, b, crashOf(site), light, t, depth);
  return s;
}

/** How much is drawn in a box, and its lowest row. */
function inBox(
  s: Surface,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): { count: number; bottom: number } {
  let count = 0;
  let bottom = -1;
  for (let y = Math.max(0, y0); y < Math.min(s.h, y1); y++) {
    for (let x = Math.max(0, x0); x < Math.min(s.w, x1); x++) {
      if (s.data[y * s.w + x] === TRANSPARENT) continue;
      count++;
      bottom = y;
    }
  }
  return { count, bottom };
}

describe("the plane brought down", () => {
  it("is nothing before it is hit", () => {
    expect(inBox(draw(T0 - 0.01), 0, 0, W, H).count).toBe(0);
    expect(inBox(draw(Number.NaN), 0, 0, W, H).count).toBe(0);
  });

  it("starts as the plane where it was, and falls all the way to its place on the ground", () => {
    const crash = crashOf();
    // as it is hit: the whole plane, on its row
    const first = inBox(
      draw(T0),
      crash.x - 4,
      crash.y - 12,
      crash.x + PLANE_SIZE.w + 4,
      crash.y + 12,
    );
    expect(first.count).toBeGreaterThan(250);
    // on the way down something of it is lower and lower, between its row and the ground
    let last = crash.y;
    for (const u of [0.35, 0.6, 0.85]) {
      const s = draw(T0 + PLANE_FALL * u);
      // (left of where the banner is, and above the ground: the plane and its smoke)
      const now = inBox(s, 0, 0, crash.x + PLANE_SIZE.w, GRASS.y);
      expect(now.bottom, `${u}`).toBeGreaterThan(last);
      expect(now.bottom, `${u}`).toBeLessThanOrEqual(GRASS.y);
      last = now.bottom;
    }
    // down: the wreck lies at its place, on the ground's row and not under it, smaller
    // than the plane was in the sky (the ground is a long way under it)
    const down = draw(T0 + PLANE_FALL + 2.5);
    const wreck = inBox(down, ...WRECK);
    expect(wreck.count).toBeGreaterThan(30);
    expect(wreck.count).toBeLessThan(first.count);
    expect(wreck.bottom).toBeGreaterThanOrEqual(GRASS.y - 6);
    expect(wreck.bottom).toBeLessThanOrEqual(GRASS.y + 3);
    // and it stays there
    const later = draw(T0 + PLANE_FALL + 20);
    expect(inBox(later, ...WRECK).count).toBe(wreck.count);
  });

  it("is behind whatever stands nearer than where it lands", () => {
    // a wall of nearer things across the ground from row 200 down
    const wall = new Float32Array(W * H).fill(1e6);
    for (let y = 200; y < H; y++) wall.fill(1, y * W, (y + 1) * W);
    const at = T0 + PLANE_FALL + 2.5;
    const box = WRECK;
    expect(inBox(draw(at), ...box).count).toBeGreaterThan(30);
    expect(inBox(draw(at, GRASS, wall), ...box).count).toBe(0);
  });

  it("lands on grass with dust, and in water with a splash and sinks", () => {
    const just = T0 + PLANE_FALL + 0.15;
    const grass = draw(just);
    const pond = draw(just, POND);
    expect(pond.data).not.toEqual(grass.data);
    // the splash: a column of water straight up from where it went in
    const column = inBox(pond, POND.x - 3, POND.y - 14, POND.x + 5, POND.y - 6);
    expect(column.count).toBeGreaterThan(20);
    // sunk: nothing of the wreck is left above the water, and nothing ever shows under it
    const sunk = draw(T0 + PLANE_FALL + 3.9, POND);
    expect(
      inBox(sunk, POND.x - 20, POND.y - 26, POND.x + 20, POND.y - 10).count,
    ).toBe(0);
    // on grass the dust is gone by then and the wreck is still there
    const settled = draw(T0 + PLANE_FALL + 3.9);
    expect(inBox(settled, ...WRECK).count).toBeGreaterThan(30);
  });

  it("has the pilot out under a parachute, down beside the wreck and waving in the end", () => {
    const crash = crashOf();
    // in the plane at first, then out of it on the way down: tumbling, under his canopy,
    // and down at his place soon after the plane
    expect(planePilotAt(crash, 0.5)).toBeNull();
    const states = [1.6, 2.4, PLANE_FALL + 1].map(
      (c) => planePilotAt(crash, c)?.state,
    );
    expect(states).toEqual(["tumble", "chute", "landed"]);
    expect(planePilotAt(crash, PLANE_FALL + 1)).toMatchObject({
      x: GRASS.pilotX,
      y: GRASS.pilotY,
    });
    // lower and lower all the way, never under the ground he lands on
    let last = -Infinity;
    for (let c = 2; c < PLANE_FALL + 1; c += 0.1) {
      const p = planePilotAt(crash, c);
      expect(p?.y, `${c}`).toBeGreaterThanOrEqual(last);
      expect(p?.y, `${c}`).toBeLessThanOrEqual(GRASS.pilotY);
      last = p?.y ?? last;
    }
    // under his canopy near the end: drawn in the air over his place, to his side of the
    // wreck, clear of its smoke and its dust
    const air = draw(T0 + 2.9);
    const hanging = inBox(
      air,
      GRASS.pilotX - 12,
      GRASS.pilotY - 70,
      GRASS.pilotX + 24,
      GRASS.pilotY - 22,
    );
    expect(hanging.count).toBeGreaterThan(20);
    // landed: he stands at his place, boots on its row
    const landed = draw(T0 + 8);
    const man = inBox(
      landed,
      GRASS.pilotX - 1,
      GRASS.pilotY - 8,
      GRASS.pilotX + 3,
      GRASS.pilotY + 2,
    );
    expect(man.count).toBeGreaterThan(8);
    expect(man.bottom).toBe(GRASS.pilotY);
    // and waves: two frames a quarter of a second apart differ only there
    expect(draw(T0 + 8.25).data).not.toEqual(landed.data);
  });

  it("puts the ball that hit it on the ground beside the wreck, away from the pilot", () => {
    const spot = planeBallSpot(GRASS, W);
    expect(spot.water).toBe(false);
    // the pilot is to the right of the wreck, so the ball is to its left, and close
    expect(spot.x).toBeLessThan(GRASS.x);
    expect(GRASS.x - spot.x).toBeLessThanOrEqual(20);
    expect(Math.abs(spot.y - GRASS.y)).toBeLessThanOrEqual(4);
    const other = planeBallSpot({ ...POND, pilotX: POND.x - 26 }, W);
    expect(other.x).toBeGreaterThan(POND.x);
    expect(other.water).toBe(true);
    // never off the canvas
    expect(
      planeBallSpot({ ...GRASS, x: 2, pilotX: 30 }, W).x,
    ).toBeGreaterThanOrEqual(0);
  });

  it("is a pure function of the time and the light", () => {
    for (const c of [0, 0.6, 1.4, PLANE_FALL + 0.3, PLANE_FALL + 2]) {
      expect(draw(T0 + c).data).toEqual(draw(T0 + c).data);
      expect(draw(T0 + c, GRASS, OPEN, NIGHT).data).not.toEqual(
        draw(T0 + c).data,
      );
    }
    expect(draw(T0 + 0.5).data).not.toEqual(draw(T0 + 0.6).data);
  });
});
