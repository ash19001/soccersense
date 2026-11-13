/**
 * Package G2's sheets: the five size steps of the traffic and people
 * (traffic-steps.ts), side by side from the furthest to the nearest, so the in-between
 * drawings (steps 1 and 3) can be judged against their neighbours.
 *
 *   traffic-steps/cars      every drawn car heading (a row each: the 7 drawn, then the
 *                           same 7 turned round), steps 0 to 4 by day, then at night
 *                           with the lamps and the beam
 *   traffic-steps/coaches   every drawn coach heading, steps 0 to 4 by day, then night
 *   traffic-steps/people    a look of each style, steps 0 to 4: front standing and
 *                           striding, back, a jump; by day, then at night
 *
 *   ./node_modules/.bin/tsx tools/snap.ts traffic-steps/cars --scale 3
 */

import { Surface, type Color, type ShotContext, type ShotMap } from "~/pixel";
import { distant, lightingFor, type Lighting } from "~/art/lighting";
import { P } from "~/art/palette";
import {
  carLamps,
  carSprite,
  coachLamps,
  coachSprite,
} from "~/art/stadium-cars";
import { makeLife, type Life } from "~/art/stadium-life";
import { ROAD } from "~/art/stadium-plan";
import { person } from "~/art/stadium-things";
import { carLook, coachLook, paintTown, personLook } from "~/art/stadium-town";
import { makeView, project } from "~/art/stadium-view";
import type { Step } from "~/art/traffic-steps";

const DAY = lightingFor({ elevation: 45, morning: false });
const NIGHT = lightingFor({ elevation: -30, morning: false });
const STEPS: readonly Step[] = [0, 1, 2, 3, 4];
/** The drawn headings: east round to north, then west round to south. */
const DRAWN = [0, 1, 2, 3, 4, 5, 6, 12, 13, 14, 15, 16, 17, 18];

function toneOf(light: Lighting): (c: Color, V: number) => Color {
  return (c) => distant(light, c, 0);
}

function vehicles(coach: boolean): Surface {
  const cell = coach ? 40 : 20;
  const s = new Surface(cell * 10 + 4, cell * DRAWN.length);
  s.clear(distant(DAY, P.concrete, 0));
  s.rect(cell * 5 + 4, 0, cell * 5, s.h, distant(NIGHT, P.concrete, 0));
  DRAWN.forEach((hd, row) => {
    for (const night of [false, true]) {
      const light = night ? NIGHT : DAY;
      for (const step of STEPS) {
        const x = (night ? cell * 5 + 4 : 0) + step * cell + cell / 2;
        const y = row * cell + Math.round(cell * 0.6);
        if (coach) {
          const look = coachLook(toneOf(light), 0, row % 6);
          coachSprite(s, x, y, 2, hd, look, step);
          if (night) coachLamps(s, x, y, 2, hd, 1, step);
        } else {
          const look = carLook(toneOf(light), 0, ((row * 5) % 12) / 12 + 0.01);
          carSprite(s, x, y, 2, hd, look, step);
          if (night) carLamps(s, x, y, 2, hd, 1, step);
        }
      }
    }
  });
  return s;
}

/** [pick, kind] for personLook: plain, scarf, steward, long hair, bobble hat. */
const LOOKS: readonly (readonly [number, number])[] = [
  [0.02, 0],
  [0.3, 1],
  [0.5, 2],
  [0.71, 3],
  [0.44, 0],
];

function people(light: Lighting): Surface {
  const cell = 9;
  const band = 64;
  const s = new Surface(cell * 5 * LOOKS.length + 4, band);
  s.clear(distant(light, P.concreteLight, 0));
  const tone = (c: Color): Color => (light.lightsOn ? light.lit(c) : c);
  LOOKS.forEach(([r, kind], i) => {
    const k = personLook(tone, r, kind);
    for (const step of STEPS) {
      const x = 4 + (i * 5 + step) * cell;
      person(s, x, 14, 2, k, 0, 0, false, step);
      person(s, x, 28, 2, k, 1, 0, false, step);
      person(s, x, 42, 2, k, 0, 0, true, step);
      person(
        s,
        x,
        60,
        2,
        k,
        0,
        step === 4 ? 4 : step === 3 ? 3 : 2,
        false,
        step,
      );
    }
  });
  return s;
}

/**
 * Frames of the home picture following one thing as it moves: `find` picks
 * it at the first frame (its map place), `next` finds it again at each later time.
 * Each frame is a `cw` x `ch` window round it; two rows of `n / 2`.
 */
function follow(
  ctx: ShotContext,
  cw: number,
  ch: number,
  n: number,
  dt: number,
  where: (life: Life, t: number) => { X: number; V: number } | null,
): Surface {
  const light = lightingFor(ctx.sun);
  const view = makeView(960, 540);
  const town = paintTown(view, light, ctx.seed);
  const life = makeLife(view, light, ctx.seed, town);
  const frame = new Surface(view.w, view.h);
  const per = Math.ceil(n / 2);
  const out = new Surface(per * (cw + 2), 2 * (ch + 2));
  out.clear(P.ink);
  for (let i = 0; i < n; i++) {
    const t = ctx.t + i * dt;
    const at = where(life, t);
    if (at === null) continue;
    frame.clear(P.ink);
    frame.copy(town.land, 0, town.top);
    life.draw(frame, t, 0);
    const p = project(view, at.X, at.V);
    out.blit(frame, (i % per) * (cw + 2), Math.floor(i / per) * (ch + 2), {
      sx: p.x - cw / 2,
      sy: p.y - ch + 8,
      sw: cw,
      sh: ch,
    });
  }
  return out;
}

export const shots: ShotMap = {
  // a car driving away up West Road (the lane beside the coach park) from the bottom of
  // the screen to North Road, every 2.5 s: it shrinks a step at a time (--t picks when)
  "traffic-steps/drive": (ctx) => {
    const X0 = ROAD.westX0 + 2.9;
    let V0 = 0;
    let t0 = -1;
    return follow(ctx, 40, 34, 16, 2.5, (life, t) => {
      let got: { X: number; V: number } | null = null;
      life.cars(t, (X, V) => {
        if (Math.abs(X - X0) > 0.01) return;
        if (t0 < 0) {
          if (V > -100 && (got === null || V < got.V)) got = { X, V };
        } else if (Math.abs(V - (V0 + 6 * (t - t0))) < 0.2) got = { X, V };
      });
      if (t0 < 0 && got !== null) {
        t0 = t;
        V0 = (got as { V: number }).V;
      }
      return got;
    });
  },
  // a supporter walking up the screen by East Road, away towards North Road, every 5 s
  // (--t 30 starts one at the bottom of the walk)
  "traffic-steps/walk": (ctx) => {
    let who: number | null = null;
    return follow(ctx, 24, 30, 16, 5, (life, t) => {
      let got: { X: number; V: number } | null = null;
      life.people(t, (X, V, _waiting, w) => {
        if (who === null) {
          if (V < -50 && V > -75 && X > 150 && got === null) {
            got = { X, V };
            who = w;
          }
        } else if (w === who) got = { X, V };
      });
      return got;
    });
  },

  "traffic-steps/cars": () => vehicles(false),
  "traffic-steps/coaches": () => vehicles(true),
  "traffic-steps/people": () => {
    const day = people(DAY);
    const night = people(NIGHT);
    const s = new Surface(day.w, day.h * 2 + 2);
    s.blit(day, 0, 0);
    s.blit(night, 0, day.h + 2);
    return s;
  },
};
