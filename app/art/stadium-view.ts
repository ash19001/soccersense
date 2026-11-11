/**
 * The camera of the aerial home screen: one viewpoint for everything.
 *
 * The town is a flat map. A place on it is (X, V): X to the east (right), V to the north
 * (away from the camera), both in map units, with the centre spot of the pitch at (0, 0).
 * One unit is one pixel at the centre spot on the reference monitor (480 x 270).
 *
 * The camera is high up to the south, looking north and down. It is a shifted-lens
 * camera, so verticals stay vertical and a circle on the ground is an ellipse:
 *
 *   scale(V) = k * ZC / (ZC + V)            pixels per unit, east-west, at depth V
 *   row(V)   = yc - k * A * (1 - ZC / (ZC + V))
 *
 * which is a true perspective whose vanishing line is A units above the centre spot. That
 * line is high in the sky: used as it is, the land would climb the whole screen. So beyond
 * the stadium (V > VF) the rows are squeezed towards a visible horizon B units above the
 * centre spot, smoothly (the slope is continuous at VF): the far town thins into a
 * texture and then into haze, the way it does through a long lens.
 *
 * Something H units tall stands `H * scale(V)` pixels above its foot. Nothing is ever
 * scaled smoothly on screen: painters pick one of three sprite sizes with `sizeClass`.
 */

import { clamp } from "~/pixel";
import { MENU_CAMERA, menuLayout, type Zone } from "~/art/layout";

/** Depth foreshortening at the centre spot: rows per unit of depth, per unit of scale. */
export const Q = 0.44;
/** The vanishing line, in units above the centre spot. */
export const A = 116;
/** The visible horizon, in units above the centre spot. */
export const B = MENU_CAMERA.horizonRise;
/** The camera's distance from the centre spot along the ground, in units. */
export const ZC = A / Q;
/** Where the far zone begins: just behind the stadium's far wall. */
export const VF = 112;

const MF = ZC / (ZC + VF);
/** Units above the centre spot of the row at VF. */
const UF = A * (1 - MF);
/** Rows (in units) per unit of depth at VF. */
const SLOPE_F = (A * MF) / (ZC + VF);
/** The far zone's falloff length: makes the slope continuous at VF. */
const LF = (B - UF) / SLOPE_F;
/** The nearest depth anything is ever projected at. */
const V_MIN = -ZC * 0.86;

/** Half the widest the stadium gets on screen, in units (its near side, a little magnified). */
export const STADIUM_HALF = MENU_CAMERA.stadiumHalf;

export interface View {
  w: number;
  h: number;
  /** Pixels per unit at the centre spot. 1 on the reference monitor, about 0.43 on a phone. */
  k: number;
  cx: number;
  /** The row of the centre spot. */
  yc: number;
  /** The visible horizon: land from this row down. */
  hy: number;
  ballR: number;
  ballCy: number;
  /** The bottom of the logo zone. */
  logoH: number;
  /** The top of the caption zone. */
  capY: number;
  /** The sign's LED panel, at rest. */
  sign: Zone;
  /** Where the moon goes: all of it in open sky, or all of it behind the airship. */
  moon: { x: number; y: number };
}

/**
 * The view for a canvas. The numbers that place the picture (the scale, the centre spot,
 * the horizon, the sign) are `menuLayout`'s, so the scene and other painters share them.
 */
export function makeView(w: number, h: number): View {
  const m = menuLayout(w, h);
  return {
    w: m.w,
    h: m.h,
    k: m.scale,
    cx: m.cx,
    yc: m.spotY,
    hy: m.horizonY,
    ballR: m.ballR,
    ballCy: m.ballCy,
    logoH: m.logo.h,
    capY: m.caption.y,
    sign: m.scoreboard,
    moon: m.sky.moon,
  };
}

/** Pixels per unit, east-west, at depth V. */
export function scaleAt(v: View, V: number): number {
  return (v.k * ZC) / (ZC + Math.max(V, V_MIN));
}

/** The (fractional) screen row of the ground at depth V. */
export function rowAt(v: View, V: number): number {
  const d = Math.max(V, V_MIN);
  if (d <= VF) return v.yc - v.k * A * (1 - ZC / (ZC + d));
  return v.yc - v.k * (B - ((B - UF) * LF) / (LF + d - VF));
}

export interface Spot {
  x: number;
  y: number;
  /** Pixels per unit here. */
  s: number;
}

/** Where the point H units above (X, V) is on screen. Whole pixels. */
export function project(v: View, X: number, V: number, H = 0): Spot {
  const s = scaleAt(v, V);
  return {
    x: Math.round(v.cx + X * s),
    y: Math.round(rowAt(v, V) - H * s),
    s,
  };
}

/** The same without rounding, for polygons that must share edges. */
export function projectRaw(v: View, X: number, V: number, H = 0): Spot {
  const s = scaleAt(v, V);
  return { x: v.cx + X * s, y: rowAt(v, V) - H * s, s };
}

/** The depth of the ground seen on screen row `sy` (rows above the horizon: very far). */
export function depthAtRow(v: View, sy: number): number {
  const u = (v.yc - sy) / v.k;
  if (u <= UF) {
    const m = Math.max(0.14, 1 - u / A);
    return ZC / m - ZC;
  }
  const rem = (B - u) / (B - UF);
  if (rem <= 0.002) return 60000;
  return VF + LF * (1 / rem - 1);
}

/** 0 far (a texture), 1 middle, 2 near: which of the three sprite sizes to draw. */
export function sizeClass(s: number): 0 | 1 | 2 {
  return s < 0.74 ? 0 : s < 1.42 ? 1 : 2;
}

/**
 * How far away a depth looks, for `distant()`: 0 from the stadium forward, rising to
 * about 0.9 at the horizon.
 */
export function hazeAt(v: View, V: number): number {
  if (V <= 30) return 0;
  const near = rowAt(v, 30);
  const span = Math.max(1, near - v.hy);
  const r = clamp((near - rowAt(v, V)) / span);
  return 0.92 * Math.pow(r, 1.15);
}
