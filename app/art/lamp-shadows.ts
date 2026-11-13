/**
 * Shadows from the street lamps (the product owner: "people and cars going under
 * street lamps should cast a shadow"). At dusk and at night every street lamp on the home
 * picture lights a pool on the ground (stadium-town.ts `paintPools`, noted in
 * `Town.pools`). Whatever passes through a pool (a person, a car, a coach) throws a short
 * shadow straight away from the lamp, on the pool's lit ground:
 *
 * - a lamp is a point of light, so the shadow is as long as the caster stands far out in the
 *   pool: none right under the lamp, longest at its edge (the caster's height over the
 *   lamp's less its own, times the distance: `reach`);
 * - it shows only where the lamp lights the ground: beyond the pool the ground is as dark
 *   as the shadow. Its pixels go back to the ground's own colour, a shadow's tone darker
 *   (`lampShadeOf`): the light that lamp would have given is what the caster stops;
 * - like the casters it goes through the depth mask: only on bare ground, never over a
 *   tree, a wall or a lamp post, and never over anything already drawn this frame (it is
 *   drawn just before its caster).
 *
 * Pure: the same inputs give the same pixels.
 */

import type { Color, Surface } from "~/pixel";
import { vehicleSize } from "~/art/stadium-cars";
import { lampShadeOf } from "~/art/stadium-things";
import type { Town } from "~/art/stadium-town";
import type { Step } from "~/art/traffic-steps";

/** The footprint stamped along a shadow: an ellipse's radii round each point. */
interface Foot {
  rx: number;
  ry: number;
}

/** Depth of bare ground in the town's depth mask (stadium-town.ts). */
const BARE = 1e9;

/**
 * The shadow of something whose ground point is (x, y) on `s` (the frame, drawn over
 * `town.land`), from each lamp whose pool it stands in. `foot(dx, dy)` gives the footprint
 * for a shadow falling along (dx, dy) on the ground (a unit vector in the pool's circle).
 */
export function castLampShadow(
  s: Surface,
  town: Town,
  x: number,
  y: number,
  reach: number,
  foot: (dx: number, dy: number) => Foot,
): void {
  const pools = town.pools;
  if (pools.length === 0) return;
  const { w, h } = s;
  const land = town.land;
  if (land.w !== w) return;
  const data = s.data;
  const ground = land.data;
  const top = town.top;
  const depth = town.depth;
  if (depth.length !== w * h) return;
  for (const pl of pools) {
    const gx = (x - pl.x) / pl.rx;
    const gy = (y - pl.y) / pl.ry;
    const e2 = gx * gx + gy * gy;
    // outside the pool, or right under the lamp
    if (e2 >= 1 || e2 < 0.004) continue;
    const e = Math.sqrt(e2);
    const dx = gx / e;
    const dy = gy / e;
    // on screen the ground is foreshortened as the pool is
    const sy = (dy * pl.ry) / pl.rx;
    const n = Math.round(e * pl.rx * reach);
    if (n < 1) continue;
    const { rx, ry } = foot(dx, dy);
    for (let k = 1; k <= n; k++) {
      const cx = Math.round(x + dx * k);
      const cy = Math.round(y + sy * k);
      for (let yy = Math.ceil(cy - ry); yy <= Math.floor(cy + ry); yy++) {
        if (yy < top || yy < 0 || yy >= h) continue;
        const t = ry <= 0 ? 0 : (yy - cy) / ry;
        const half = rx * Math.sqrt(Math.max(0, 1 - t * t));
        const py = (yy - pl.y) / pl.ry;
        const xa = Math.max(0, Math.ceil(cx - half));
        const xb = Math.min(w - 1, Math.floor(cx + half));
        for (let xx = xa; xx <= xb; xx++) {
          const px = (xx - pl.x) / pl.rx;
          if (px * px + py * py >= 1) continue;
          const i = yy * w + xx;
          if (depth[i] < BARE) continue;
          const c = data[i] as Color;
          if (c !== ground[(yy - top) * w + xx]) continue;
          const u = lampShadeOf(c);
          if (u !== undefined) data[i] = u;
        }
      }
    }
  }
}

/** How wide a person stands at each of the five sizes (traffic-steps.ts). */
const PERSON_W = [1, 1, 2, 3, 4] as const;
/**
 * How far a person's shadow reaches for each unit out from the lamp: a person stands
 * about two fifths of a street lamp's height (stadium-things.ts `lampHeight`).
 */
const PERSON_REACH = 0.65;
/** A car is about a quarter of a lamp's height; a coach over half of it. */
const CAR_REACH = 0.4;
const COACH_REACH = 1;

const personFoot: Foot = { rx: 0, ry: 0 };

/**
 * A person's lamp shadow, their feet at (x, y), at size step `size`: a streak as wide as
 * they are seen across it (their width when it falls up or down the screen, a pixel when it
 * falls sideways, the ground being foreshortened).
 */
export function personLampShadow(
  s: Surface,
  town: Town,
  x: number,
  y: number,
  size: Step,
): void {
  if (town.pools.length === 0) return;
  const wide = PERSON_W[size];
  castLampShadow(s, town, x, y, PERSON_REACH, (dx, dy) => {
    personFoot.rx = Math.max(0, (Math.round(wide * Math.abs(dy)) - 1) / 2);
    personFoot.ry = Math.max(
      0,
      (Math.round(wide * Math.abs(dx) * 0.42) - 1) / 2,
    );
    return personFoot;
  });
}

const vehicleFoot: Foot = { rx: 0, ry: 0 };

/**
 * A car's (or with `bus`, a coach's) lamp shadow, its ground point at (x, y), at size step
 * `step` and `heading` (stadium-cars.ts): its footprint, most of its sprite's width and
 * half its height, carried away from the lamp.
 */
export function vehicleLampShadow(
  s: Surface,
  town: Town,
  x: number,
  y: number,
  bus: boolean,
  step: Step,
  heading: number,
): void {
  if (town.pools.length === 0) return;
  const size = vehicleSize(bus, step, heading);
  vehicleFoot.rx = Math.max(0, (size.w - 3) / 2);
  vehicleFoot.ry = Math.max(0, (size.h - 3) / 4);
  castLampShadow(
    s,
    town,
    x,
    y,
    bus ? COACH_REACH : CAR_REACH,
    () => vehicleFoot,
  );
}
