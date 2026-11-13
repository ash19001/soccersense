/**
 * The street lamps' shadows (lamp-shadows.ts): the town at night at 960 x 540,
 * and in four lamps' pools (a Stadium Road lantern, a plaza lamp, a concourse lamp, a car
 * park lamp) people and a car standing at every distance from the lamp, each with the
 * shadow it throws. `--t` walks one more person across each pool, left to right.
 *
 *   ./node_modules/.bin/tsx tools/snap.ts lamps/shadows --time night --scale 3
 *   ./node_modules/.bin/tsx tools/snap.ts lamps/shadows --time dusk --scale 3 --strip 6 --dt 0.5
 */

import { Surface, type Color, type ShotMap } from "~/pixel";
import { distant, lightingFor } from "~/art/lighting";
import { EAST, NORTH } from "~/art/stadium-cars";
import { personLampShadow, vehicleLampShadow } from "~/art/lamp-shadows";
import { car, person } from "~/art/stadium-things";
import {
  carLook,
  paintTown,
  personLook,
  type LampPool,
} from "~/art/stadium-town";
import { makeView } from "~/art/stadium-view";

const W = 960;
const H = 540;
const CELL_W = 64;
const CELL_H = 36;

/** The pools to show: the nearest to these points on screen. */
const PICKS: readonly (readonly [number, number])[] = [
  [190, 405], // a lantern on Stadium Road's near kerb
  [360, 470], // the plaza's edge
  [250, 360], // the concourse
  [830, 470], // the car park
];

/** Where the caster stands in the pool (its radii), and a car's heading (or a person). */
const CASTS: readonly (readonly [number, number, number | null])[] = [
  [-0.6, 0, null],
  [0.6, 0, null],
  [-0.4, 0.55, null],
  [0, 0.65, null],
  [0.45, 0.5, null],
  [0.15, -0.6, null],
  [-0.55, 0.35, EAST],
  [0.55, 0.3, NORTH],
];

export const shots: ShotMap = {
  "lamps/shadows": (ctx) => {
    const light = lightingFor(ctx.sun);
    const view = makeView(W, H);
    const town = paintTown(view, light, ctx.seed);
    const tone = (c: Color): Color => distant(light, c, 0);
    const out = new Surface(CELL_W * CASTS.length, CELL_H * PICKS.length);
    const s = new Surface(W, H);
    PICKS.forEach(([px, py], row) => {
      let pool: LampPool | null = null;
      let best = Infinity;
      for (const pl of town.pools) {
        const d = Math.hypot(pl.x - px, pl.y - py);
        if (d < best) {
          best = d;
          pool = pl;
        }
      }
      if (!pool) return;
      const { x: cx, y: cy, rx, ry } = pool;
      const size = pool.rx >= 20 ? 4 : pool.rx >= 12 ? 3 : 2;
      CASTS.forEach(([gx, gy, hd], col) => {
        s.copy(town.land, 0, town.top);
        // the one in the cell walks: --t moves them a pixel at a time to the right
        const x = Math.round(cx + gx * rx) + (Math.floor(ctx.t * 4) % 9) - 4;
        const y = Math.round(cy + gy * ry);
        if (hd === null) {
          personLampShadow(s, town, x, y, size);
          person(
            s,
            x,
            y,
            2,
            personLook(tone, 0.13 * (col + 1), col % 3),
            col % 2,
            0,
            false,
            size,
          );
        } else {
          vehicleLampShadow(s, town, x, y, false, size, hd);
          car(
            s,
            x,
            y,
            2,
            hd,
            carLook((c) => tone(c), 0, 0.3 + col * 0.05),
            size,
          );
        }
        const x0 = Math.round(cx - CELL_W / 2);
        const y0 = Math.round(cy - CELL_H * 0.55);
        for (let yy = 0; yy < CELL_H; yy++) {
          for (let xx = 0; xx < CELL_W; xx++) {
            const sx = x0 + xx;
            const sy = y0 + yy;
            if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
            out.data[(row * CELL_H + yy) * out.w + col * CELL_W + xx] =
              s.data[sy * W + sx];
          }
        }
      });
    });
    return out;
  },
};
