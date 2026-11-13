/**
 * Cars and coaches seen from the air, pointing any way on screen (docs/ART_BIBLE.md 5).
 *
 * The picture is an aerial view, so a road or a bay that runs north on the map leans on
 * screen (towards the vanishing point above the stadium). A car is drawn along the way it
 * points on screen, from a set of HEADINGS drawn headings. A near car is about 14 x 8
 * pointing east, with a windscreen, side windows, wheels with hubs, head and tail lamps,
 * sills and bumpers; a coach has its windows, doors, roof pods and hatches.
 *
 * The drawings are data (stadium-cars-grids.ts). A coach has 14 drawn headings per size
 * class (0 to 90 and 180 to 270 degrees) and the rest are mirrored. A car has 7 (0 to 90):
 * a car is the same box at either end, so the 180-to-270 set is the same drawing turned
 * round (windscreen and rear window, headlamps and tail lamps swapped: `turned`), and
 * the rest are mirrored.
 *
 * Five sizes (traffic-steps.ts): the three size classes are steps 0, 2 and 4, and
 * stadium-cars-steps.ts draws steps 1 and 3 between them, so a car or a coach shrinks a
 * step at a time as it drives away (a car 6, 8, 10, 12, 14 px long pointing east).
 *
 * The anchor is the ground point under the vehicle's middle; a mirrored pixel at column c
 * of a grid lands at `x + ax - c`.
 *
 * Everything here is pure: headings are worked out from the camera (stadium-view.ts).
 */

import type { Color } from "~/pixel";
import { P } from "~/art/palette";
import { CARS, COACHES, type Grid } from "~/art/stadium-cars-grids";
import { CARS_STEPS, COACHES_STEPS } from "~/art/stadium-cars-steps";
import type { CarLook, CoachLook, Ink } from "~/art/stadium-things";
import { projectRaw, type View } from "~/art/stadium-view";
import { stepOfClass, type Step } from "~/art/traffic-steps";

/** How many ways a car can point on screen. */
export const HEADINGS = 24;
/** Degrees between neighbouring headings. */
export const HEADING_STEP = 360 / HEADINGS;
/** The heading pointing up the screen. */
const QUARTER = HEADINGS / 4;
const HALF = HEADINGS / 2;

/** Heading east, north (up the screen), west and south (down the screen). */
export const EAST = 0;
export const NORTH = QUARTER;
export const WEST = HALF;
export const SOUTH = QUARTER * 3;

/** The angle a heading stands for, degrees anticlockwise from east on screen. */
export function headingAngle(h: number): number {
  return (((h % HEADINGS) + HEADINGS) % HEADINGS) * HEADING_STEP;
}

/** The heading nearest a direction on screen: `dx` to the right, `dy` down. */
export function headingOf(dx: number, dy: number): number {
  if (dx === 0 && dy === 0) return EAST;
  const a = Math.atan2(-dy, dx) / ((2 * Math.PI) / HEADINGS);
  return ((Math.round(a) % HEADINGS) + HEADINGS) % HEADINGS;
}

/** The heading on screen of something at (X, V) on the ground moving by (dX, dV). */
export function groundHeading(
  view: View,
  X: number,
  V: number,
  dX: number,
  dV: number,
): number {
  const len = Math.hypot(dX, dV);
  if (len === 0) return EAST;
  const e = 0.5 / len;
  const a = projectRaw(view, X - dX * e, V - dV * e);
  const b = projectRaw(view, X + dX * e, V + dV * e);
  return headingOf(b.x - a.x, b.y - a.y);
}

/** The map's four ways: 0 east, 1 west, 2 north, 3 south, as (dX, dV). */
const MAP_DIRS: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** The heading on screen of something at (X, V) pointing one of the map's four ways. */
export function mapHeading(
  view: View,
  X: number,
  V: number,
  dir: number,
): number {
  const d = MAP_DIRS[((dir % 4) + 4) % 4];
  return groundHeading(view, X, V, d[0], d[1]);
}

/** Which drawn grid a heading uses (index into a class's 14), and whether it is mirrored. */
interface Slot {
  i: number;
  mirror: boolean;
}

const slotOut: Slot = { i: 0, mirror: false };
/** heading 0-6 drawn; 7-11 mirror 5-1; 12-18 drawn; 19-23 mirror 17-13. */
export function slotOf(heading: number): Slot {
  const h = ((Math.round(heading) % HEADINGS) + HEADINGS) % HEADINGS;
  if (h <= 6) {
    slotOut.i = h;
    slotOut.mirror = false;
  } else if (h < 12) {
    slotOut.i = 12 - h;
    slotOut.mirror = true;
  } else if (h <= 18) {
    slotOut.i = h - 5;
    slotOut.mirror = false;
  } else {
    slotOut.i = 31 - h;
    slotOut.mirror = true;
  }
  return slotOut;
}

type Paint = (ch: string, mirror: boolean) => Color | null;

function stamp(
  s: Ink,
  g: Grid,
  x: number,
  y: number,
  mirror: boolean,
  paint: Paint,
): void {
  for (let r = 0; r < g.day.length; r++) {
    const row = g.day[r];
    const yy = y + r - g.ay;
    for (let c = 0; c < row.length; c++) {
      if (row.charCodeAt(c) === 46) continue; // "."
      const col = paint(row[c], mirror);
      if (col === null) continue;
      s.px(mirror ? x + g.ax - c : x + c - g.ax, yy, col);
    }
  }
}

function lamps(
  s: Ink,
  g: Grid,
  x: number,
  y: number,
  mirror: boolean,
  beam: boolean,
  reversing: boolean,
): void {
  const tail = reversing ? P.white : P.ledRed;
  for (let r = 0; r < g.day.length; r++) {
    const row = g.day[r];
    for (let c = 0; c < row.length; c++) {
      const ch = row[c];
      // a headlamp (y, H, Y) or a tail lamp (q, T, Q)
      const col =
        ch === "y" || ch === "H" || ch === "Y"
          ? P.goldLight
          : ch === "q" || ch === "T" || ch === "Q"
            ? tail
            : null;
      if (col === null) continue;
      s.px(mirror ? x + g.ax - c : x + c - g.ax, y + r - g.ay, col);
    }
  }
  if (!beam) return;
  for (const [dx, dy] of g.beam) s.px(mirror ? x - dx : x + dx, y + dy, P.gold);
}

/** A car drawing turned round: the same outline pointing the other way. */
function turned(g: Grid): Grid {
  const swap: Record<string, string> = {
    f: "r",
    r: "f",
    y: "q",
    q: "y",
    H: "T",
    T: "H",
    Y: "Q",
    Q: "Y",
  };
  const day = g.day.map((row) => row.replace(/[fryqHTYQ]/g, (c) => swap[c]));
  return { day, ax: g.ax, ay: g.ay, beam: beamAhead(g, day) };
}

/**
 * The beam of a car turned round: the drawn beam through the anchor, then drawn back
 * along itself until it starts right at the car's new front (G2: the ground point is
 * below the middle of an angled car, so the beam through it alone fell a pixel or two
 * short of the bonnet at night).
 */
function beamAhead(
  g: Grid,
  day: readonly string[],
): readonly (readonly [number, number])[] {
  if (g.beam.length === 0) return [];
  const solid = (x: number, y: number): boolean => {
    const row = day[y + g.ay];
    const ch = row === undefined ? undefined : row[x + g.ax];
    return ch !== undefined && ch !== ".";
  };
  const touches = (x: number, y: number): boolean => {
    for (let j = -1; j <= 1; j++) {
      for (let i = -1; i <= 1; i++) if (solid(x + i, y + j)) return true;
    }
    return false;
  };
  const [x0, y0] = g.beam[0];
  const len = Math.hypot(x0, y0);
  let back = 0;
  for (let k = 0; k < len; k++) {
    const x = Math.round(-x0 + (x0 / len) * k);
    const y = Math.round(-y0 + (y0 / len) * k);
    if (solid(x, y)) break;
    back = k;
    if (touches(x, y)) break;
  }
  const dx = Math.round(-x0 + (x0 / len) * back) + x0;
  const dy = Math.round(-y0 + (y0 / len) * back) + y0;
  return g.beam.map(([x, y]) => [-x + dx, -y + dy] as const);
}

/**
 * The drawings of each size step, the furthest first (traffic-steps.ts): the three size
 * classes are steps 0, 2 and 4; stadium-cars-steps.ts has steps 1 and 3.
 */
const CAR_SIZES: readonly (readonly Grid[])[] = [
  CARS[0],
  CARS_STEPS[0],
  CARS[1],
  CARS_STEPS[1],
  CARS[2],
];
const COACH_SIZES: readonly (readonly Grid[])[] = [
  COACHES[0],
  COACHES_STEPS[0],
  COACHES[1],
  COACHES_STEPS[1],
  COACHES[2],
];

/** Every step's 14 car drawings: the drawn 7, then the same turned round (made once). */
let carSets: (readonly Grid[])[] | null = null;
function cars(step: Step): readonly Grid[] {
  carSets ??= CAR_SIZES.map((set) => [...set, ...set.map(turned)]);
  return carSets[step];
}

const carPaint =
  (k: CarLook): Paint =>
  (ch) => {
    switch (ch) {
      case "b":
        return k.b;
      case "l":
        return k.l;
      case "d":
        return k.d;
      case "n":
        return k.n ?? k.d;
      case "g":
      case "f":
      case "r":
        return k.g;
      case "w":
        return k.w ?? k.l;
      case "k":
        return k.k;
      case "m":
        return k.m ?? k.d;
      case "y":
        return k.y ?? k.l;
      case "q":
        return k.q ?? k.d;
      // the small cars' lamps, dark by day: on the top, on an end
      case "Y":
      case "Q":
        return k.b;
      case "H":
      case "T":
        return k.d;
      default:
        return null;
    }
  };

const coachPaint =
  (k: CoachLook): Paint =>
  (ch, mirror) => {
    switch (ch) {
      case "o":
        return k.roof;
      case "i":
        return k.roofHi;
      case "j":
        return mirror ? k.roof : k.roofHi;
      case "J":
        return mirror ? k.roofHi : k.roof;
      case "s":
        return k.side;
      case "e":
        return k.stripe;
      case "g":
      case "f":
      case "r":
        return k.glass;
      case "w":
        return k.glassHi ?? k.glass;
      case "k":
        return k.tyre;
      case "m":
        return k.hub ?? k.side;
      case "n":
        return k.deep ?? k.tyre;
      case "y":
        return k.lamp ?? k.roofHi;
      case "q":
        return k.tail ?? k.stripe;
      // the small coaches lamps, dark by day: on the roof, on an end
      case "Y":
      case "Q":
        return k.roof;
      case "H":
      case "T":
        return k.side;
      default:
        return null;
    }
  };

/** The car grid for a size class and a heading (for tests and sheets). */
export function carGrid(cls: 0 | 1 | 2, heading: number): Grid {
  return cars(cls === 0 ? 0 : cls === 1 ? 2 : 4)[slotOf(heading).i];
}

/** The coach grid for a size class and a heading (for tests and sheets). */
export function coachGrid(cls: 0 | 1 | 2, heading: number): Grid {
  return COACHES[cls][slotOf(heading).i];
}

/** The car grid for a size step and a heading (for tests and sheets). */
export function carStepGrid(step: Step, heading: number): Grid {
  return cars(step)[slotOf(heading).i];
}

/** The coach grid for a size step and a heading (for tests and sheets). */
export function coachStepGrid(step: Step, heading: number): Grid {
  return COACH_SIZES[step][slotOf(heading).i];
}

/**
 * A car from above with its ground point at (x, y), pointing `heading` on screen
 * (0 east, HEADINGS / 4 up the screen). `step`: which of the five sizes
 * (traffic-steps.ts `sizeStep`); without it, the one that stands for `cls`.
 */
export function carSprite(
  s: Ink,
  x: number,
  y: number,
  cls: 0 | 1 | 2,
  heading: number,
  k: CarLook,
  step?: Step,
): void {
  const p = slotOf(heading);
  stamp(s, cars(step ?? stepOfClass(cls))[p.i], x, y, p.mirror, carPaint(k));
}

/**
 * A car's lamps at night: headlights (and a beam ahead when it is driving and not far
 * away) and tail lights, white while it reverses (`state` 2).
 */
export function carLamps(
  s: Ink,
  x: number,
  y: number,
  cls: 0 | 1 | 2,
  heading: number,
  state: 1 | 2,
  step?: Step,
): void {
  const size = step ?? stepOfClass(cls);
  const p = slotOf(heading);
  const beam = size > 0 && state === 1;
  lamps(s, cars(size)[p.i], x, y, p.mirror, beam, state === 2);
}

/**
 * A coach or a bus from above, its ground point at (x, y), pointing `heading`. `step` as
 * `carSprite`'s.
 */
export function coachSprite(
  s: Ink,
  x: number,
  y: number,
  cls: 0 | 1 | 2,
  heading: number,
  k: CoachLook,
  step?: Step,
): void {
  const p = slotOf(heading);
  const set = COACH_SIZES[step ?? stepOfClass(cls)];
  stamp(s, set[p.i], x, y, p.mirror, coachPaint(k));
}

/** A coach's lamps at night (as `carLamps`; a coach shows no beam). */
export function coachLamps(
  s: Ink,
  x: number,
  y: number,
  cls: 0 | 1 | 2,
  heading: number,
  state: 1 | 2,
  step?: Step,
): void {
  const p = slotOf(heading);
  const set = COACH_SIZES[step ?? stepOfClass(cls)];
  lamps(s, set[p.i], x, y, p.mirror, false, state === 2);
}

/**
 * How big a car (or with `bus`, a coach) is drawn at size step `step` and
 * `heading`: its grid's width and height, round its ground point in the middle. For the
 * shadows the street lamps throw (stadium-life.ts).
 */
export function vehicleSize(
  bus: boolean,
  step: Step,
  heading: number,
): { w: number; h: number } {
  const g = (bus ? COACH_SIZES[step] : cars(step))[slotOf(heading).i];
  let w = 0;
  for (const row of g.day) w = Math.max(w, row.length);
  return { w, h: g.day.length };
}
