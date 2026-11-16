/**
 * The plane, brought down: an easter egg of the home screen (AWAY's ball, struck at the
 * right moment, meets the plane on its way to the sky: scenes/menu.ts). It comes down as
 * the airship does when it is popped (stadium-airship-fall.ts), and with the same landing:
 *
 * - Where: a place of its own, which the backdrop hands over (stadium.ts `landings`): the
 *   open grass or water of the painted town as near as there is to straight below where it
 *   is hit (`findCrashSite`), which is the lawn at the right of the picture. The airship
 *   used to come down there in most windows, and the plane was sent there for that (the
 *   product owner, 2026-11-16: "it should fall where the blimp currently falls"); the
 *   airship now lands behind the mascot ("so that area is only for the plane").
 * - The fall (PLANE_FALL seconds): its engine stops and it goes into a spin, carried on
 *   along its way at first and then across and down to the site, nose down and swaying,
 *   shrinking as it falls away from us into the town (the ground is a long way under it),
 *   with a trail of smoke. Whatever stands nearer than where it lands hides it.
 * - The landing: on grass a bounce, a puff of dust and the wreck left nose down; in water a
 *   splash, rings, and it bobs and sinks.
 * - The banner, let go, slows and drifts down like the ribbon it is, still rippling.
 * - The pilot jumps on the way down, floats down under a parachute to the grass beside
 *   the wreck and waves: nobody is hurt. (The airship's pilot, a size smaller.)
 *
 * Everything is a function of the seconds since the hit. Pure: no randomness.
 */

import type { Lighting } from "~/art/lighting";
import { P } from "~/art/palette";
import { warpBlit } from "~/art/stadium-airship";
import {
  type CrashSite,
  drawLandingDust,
  drawLandingSplash,
  drawPilot,
} from "~/art/stadium-airship-fall";
import {
  BANNER_BEHIND,
  PLANE_SIZE,
  PLANE_SPEED,
  type Banner,
  drawBanner,
  planeStill,
} from "~/art/stadium-plane";
import type { Surface } from "~/pixel";

/** Seconds from the hit until the plane is down (the airship takes 2.8). */
export const PLANE_FALL = 2.4;
/**
 * The pilot jumps PILOT_JUMPS seconds after the hit, once the plane is well on its way
 * down: thrown on along its way at PILOT_THROWN of its speed and up a little, tumbling
 * for PILOT_TUMBLE, then under his canopy, which
 * slows him, to the grass. He lands PILOT_LANDS after the hit: soon after the plane, in
 * time to be seen waving before the home screen's iris closes (scenes/menu.ts).
 */
const PILOT_JUMPS = 1.5;
const PILOT_TUMBLE = 0.4;
const PILOT_THROWN = 0.5;
const PILOT_LANDS = 3.2;

/** A plane that has been hit: when, where it was, and where it comes down. */
export interface PlaneCrash {
  /** When it was hit: the clock the fly-by is drawn with. */
  t0: number;
  /** Where its nose was then, and the row it flew along (its middle, bob and all). */
  x: number;
  y: number;
  /** Where it lands, and its pilot beside it. */
  site: CrashSite;
}

/**
 * The wreck is WRECK units of ground long where it lies (the plane in the sky is nearer to
 * us than the ground under it, and so bigger), never less than WRECK_MIN of the plane's
 * size nor more than WRECK_MAX.
 */
const WRECK = 20;
const WRECK_MIN = 0.36;
const WRECK_MAX = 0.75;
/** It turns right round SPINS times on the way down, faster and faster. */
const SPINS = 2;
/** Nose down by this much (radians) once it is falling, swaying SWAY either way. */
const NOSE_DOWN = 0.85;
const SWAY = 0.28;
/** The wreck's pose: nose in the grass (radians, as NOSE_DOWN), or lying in the water. */
const WRECK_TILT = 0.6;
const WRECK_AFLOAT = -0.15;
/**
 * A puff of smoke every SMOKE_EVERY seconds of the fall (close enough together to make a
 * trail of it, however fast it falls), each hanging SMOKE_LIFE.
 */
const SMOKE_EVERY = 0.0125;
const SMOKE_LIFE = 0.9;
/** The banner, let go: it loses its way in BANNER_STOP seconds and sinks BANNER_SINK px a second. */
const BANNER_STOP = 1.8;
const BANNER_SINK = 20;
/** The ball that hit it lands this far to the side of the wreck, away from the pilot. */
const BALL_ASIDE = 15;

function smooth(u: number): number {
  const v = Math.max(0, Math.min(1, u));
  return v * v * (3 - 2 * v);
}

/**
 * Where the ball that brought it down comes to rest: on the ground beside the wreck (the
 * side the pilot is not on), a little nearer to us. `w` is the canvas's width.
 */
export function planeBallSpot(
  site: CrashSite,
  w: number,
): { x: number; y: number; water: boolean } {
  const side = site.pilotX >= site.x ? -1 : 1;
  return {
    x: Math.max(6, Math.min(w - 7, site.x + side * BALL_ASIDE)),
    y: site.y + 2,
    water: site.water,
  };
}

/** The way the plane falls: its middle and its size `sec` seconds after it is hit. */
interface Fall {
  /** Its size as a wreck, and where its middle rests. */
  kEnd: number;
  restY: number;
  midX(sec: number): number;
  midY(sec: number): number;
  sizeAt(sec: number): number;
}

function fallOf(crash: PlaneCrash): Fall {
  const { site } = crash;
  const startX = crash.x + PLANE_SIZE.w / 2;
  const startY = crash.y;
  const kEnd = Math.max(
    WRECK_MIN,
    Math.min(WRECK_MAX, (WRECK * site.scale) / PLANE_SIZE.w),
  );
  // from its middle to its wheels
  const restY = site.y - (PLANE_SIZE.h / 2) * kEnd;
  const share = (sec: number): number =>
    Math.max(0, Math.min(1, sec / PLANE_FALL));
  return {
    kEnd,
    restY,
    midX: (sec) => {
      // carried on along its way at first, and then across and down to where it lands
      const on = startX - PLANE_SPEED * Math.min(sec, PLANE_FALL);
      return on + (site.x - on) * smooth(share(sec));
    },
    midY: (sec) => {
      const u = share(sec);
      return startY + (restY - startY) * u * u;
    },
    sizeAt: (sec) => 1 + (kEnd - 1) * Math.pow(share(sec), 1.2),
  };
}

/**
 * The pilot `c` seconds after the plane is hit: where his boots are, what he is doing and
 * the way he faces (1: to the right). Null while he is still in the plane.
 */
export function planePilotAt(
  crash: PlaneCrash,
  c: number,
): {
  x: number;
  y: number;
  state: "tumble" | "chute" | "landed";
  side: number;
} | null {
  if (!(c >= PILOT_JUMPS)) return null;
  const { site } = crash;
  const fall = fallOf(crash);
  // out of the plane where it has got to
  const jx = fall.midX(PILOT_JUMPS);
  const jy = fall.midY(PILOT_JUMPS) - 4 * fall.sizeAt(PILOT_JUMPS);
  const vx =
    ((fall.midX(PILOT_JUMPS + PILOT_TUMBLE) - jx) / PILOT_TUMBLE) *
    PILOT_THROWN;
  const side = site.pilotX >= jx ? 1 : -1;
  const d = c - PILOT_JUMPS;
  const thrownX = (e: number): number => jx + vx * e;
  const thrownY = (e: number): number => jy - 60 * e + 140 * e * e;
  if (d < PILOT_TUMBLE) {
    return { x: thrownX(d), y: thrownY(d), state: "tumble", side };
  }
  if (c < PILOT_LANDS) {
    const u = (d - PILOT_TUMBLE) / (PILOT_LANDS - PILOT_JUMPS - PILOT_TUMBLE);
    const ox = thrownX(PILOT_TUMBLE);
    const oy = thrownY(PILOT_TUMBLE);
    // the canopy slows him: fastest as it opens, and straight down by the end
    const across = 1 - (1 - u) * (1 - u);
    return {
      x: ox + (site.pilotX - ox) * across + Math.sin(c * 2.6) * 4 * (1 - u),
      y: oy + (site.pilotY - oy) * u,
      state: "chute",
      side,
    };
  }
  return { x: site.pilotX, y: site.pilotY, state: "landed", side };
}

/**
 * The plane from the moment it is hit (`crash.t0`), at `t`: nothing before it. `depth` is
 * the town's depth mask: the falling plane and its wreck are behind whatever stands nearer
 * than where it lands.
 */
export function drawPlaneCrash(
  s: Surface,
  banner: Banner,
  crash: PlaneCrash,
  light: Lighting,
  t: number,
  depth: Float32Array,
): void {
  const c = t - crash.t0;
  if (!(c >= 0)) return;
  const { site } = crash;
  const g = light.env;
  const art = planeStill(light);
  const { kEnd, restY, midX, midY, sizeAt } = fallOf(crash);

  // ---- the banner, let go ------------------------------------------------------
  {
    const bh = banner.flat.h;
    const k = Math.min(c, BANNER_STOP);
    const bx = Math.round(
      crash.x + BANNER_BEHIND - PLANE_SPEED * (k - (k * k) / (2 * BANNER_STOP)),
    );
    const by = Math.round(
      crash.y - Math.floor(bh / 2) + 2 + BANNER_SINK * c + 2 * Math.sin(c * 3),
    );
    drawBanner(s, banner, bx, by, light, t);
    // what is left of the rope, trailing from the pole
    const rope = g(P.steel);
    s.line(bx - 2, by + Math.floor(bh / 2), bx - 9, by + bh + 4, rope);
    s.line(bx - 2, by + Math.floor(bh / 2) + 1, bx - 9, by + bh + 5, rope);
  }

  // ---- the smoke it trails: the oldest puffs first ------------------------------
  const smoke = [g(P.night), g(P.slate), g(P.steel)];
  const fell = Math.min(c, PLANE_FALL);
  const puffs = Math.floor(fell / SMOKE_EVERY);
  for (let i = 1; i <= puffs; i++) {
    const born = i * SMOKE_EVERY;
    const age = c - born;
    if (age >= SMOKE_LIFE) continue;
    const a = age / SMOKE_LIFE;
    const size = sizeAt(born);
    s.disc(
      Math.round(midX(born) + 6 * size),
      Math.round(midY(born) - 2 - 10 * age),
      Math.max(1, Math.round((2 + a * 6) * size)),
      smoke[a < 0.3 ? 0 : a < 0.65 ? 1 : 2],
      a < 0.4 ? 1 : a < 0.75 ? 0.5 : 0.25,
    );
  }

  // ---- the fall and the wreck ---------------------------------------------------
  const landed = c >= PLANE_FALL;
  const down = c - PLANE_FALL;
  {
    let x: number;
    let y: number;
    let k: number;
    let angle: number;
    let spin = 1;
    if (!landed) {
      const u = c / PLANE_FALL;
      x = midX(c);
      y = midY(c);
      k = sizeAt(c);
      // a flat spin: it turns right round, faster and faster, as the airship's sign does
      spin = Math.cos(Math.PI * 2 * SPINS * u * u);
      const tilt =
        -NOSE_DOWN * smooth(u * 3) +
        SWAY * Math.sin(Math.PI * 2 * 1.4 * c) * (1 - u * 0.8);
      // (turned the other way round, the same tilt keeps its nose down)
      angle = spin < 0 ? -tilt : tilt;
    } else {
      x = site.x;
      y = restY;
      k = kEnd;
      const settle = Math.min(1, down / 0.45);
      angle =
        -NOSE_DOWN +
        ((site.water ? WRECK_AFLOAT : -WRECK_TILT) + NOSE_DOWN) * settle;
      if (!site.water && down < 0.45) {
        // it bounces once
        const v = down / 0.45;
        y -= Math.round(Math.max(4, 22 * kEnd) * 4 * v * (1 - v));
      }
      if (site.water) {
        // bobs, then sinks
        if (down < 0.4) y += Math.round(2 * Math.sin(down * 20));
        else y += ((down - 0.4) / 1.8) * (art.h * kEnd + 8);
      }
    }
    warpBlit(s, art, {
      px: art.w / 2,
      py: art.h / 2,
      x: Math.round(x),
      y: Math.round(y),
      angle,
      sx: k * spin,
      sy: k,
      // it falls into the town: whatever stands nearer than where it lands hides it, and
      // the water closes over what has sunk
      keep: (X, Y) => {
        if (depth[Y * s.w + X] < site.V - 0.5) return false;
        return !(landed && site.water && Y > site.y);
      },
    });
  }

  // ---- the landing: the airship's own dust and splash ------------------------------
  drawLandingDust(s, site, down, light, depth);
  drawLandingSplash(s, site, down, light, t);

  // ---- the pilot, under a parachute ------------------------------------------------
  const pilot = planePilotAt(crash, c);
  if (pilot) {
    drawPilot(
      s,
      Math.round(pilot.x),
      Math.round(pilot.y),
      pilot.state,
      pilot.side,
      2,
      light,
      Math.floor(t * 4) % 2 === 0,
    );
  }
}
