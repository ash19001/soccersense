/**
 * Stadium Road's traffic and its zebra.
 *
 * The zebra is as wide as the plaza, so a car takes a good while to cross it, and a car and
 * a person are never on it at the same time. Every CYCLE seconds it belongs first to the
 * cars and then to the people:
 *
 *   [0, CARS_UNTIL)        the cars' window: a platoon of up to PLATOON cars in each lane
 *                          comes over the stripes, HEADWAY seconds apart, and is off them
 *                          MARGIN seconds before the window ends;
 *   [CARS_UNTIL, CYCLE)    the people's window: people step on to the stripes only MARGIN
 *                          seconds after it opens and are off them MARGIN seconds before it
 *                          closes (stadium-crossing.ts plans their waits at the kerb).
 *
 * The cars keep a steady speed: their timetable is built round the windows, so a platoon
 * reaches the stripes just as the cars' window opens, as if it had been let through by a
 * light up the road. Everything here is a pure function of the time, and repeats every
 * CYCLE seconds (a slot's car may be missing, but `roadBusy` counts every slot as taken, so
 * the gaps people use come round every cycle).
 */

import { hash2 } from "~/pixel";
import { PLAZA_HALF, ROAD } from "~/art/stadium-plan";

/** Speed on Stadium Road, units a second. */
export const ROAD_SPEED = 8;
export const ROAD_EAST = ROAD.stadiumV1 - 2.9;
export const ROAD_WEST = ROAD.stadiumV0 + 2.9;

/** The zebra's stripes, as stadium-plan.ts paints them. */
export const ZEBRA = {
  x0: -(PLAZA_HALF - 14),
  x1: PLAZA_HALF - 14,
  v0: (ROAD.stadiumV0 + ROAD.stadiumV1) / 2 - 4.2,
  v1: (ROAD.stadiumV0 + ROAD.stadiumV1) / 2 + 4.2,
} as const;

/** Half a car along the way it is going, and across: map units. */
export const CAR_HALF_LONG = 2.2;
export const CAR_HALF_WIDE = 1.0;
/** Half a person, either way. */
export const PERSON_HALF = 0.5;

/** The zebra's cycle, seconds: the cars' window and then the people's. */
export const CYCLE = 25;
/** At most this many cars a lane in each cars' window. */
export const PLATOON = 4;
/** Seconds between the cars of a platoon. */
export const HEADWAY = 1.3;
/** Seconds kept clear at each end of a window. */
export const MARGIN = 0.5;
/** Seconds a car's footprint is over the stripes. */
const ON_ZEBRA = (ZEBRA.x1 - ZEBRA.x0 + 2 * CAR_HALF_LONG) / ROAD_SPEED;
/** When in the cycle the cars' window closes and the people's opens. */
export const CARS_UNTIL = MARGIN + (PLATOON - 1) * HEADWAY + ON_ZEBRA + MARGIN;
/** How many of a slot's cars are left out (the timetable is a little irregular). */
const MISSING = 0.42;

/** The remainder that is never negative. */
function mod(a: number, n: number): number {
  return ((a % n) + n) % n;
}

/** Whether people may be on the stripes at time `t` (MARGIN inside their window). */
export function peopleWindow(t: number): boolean {
  const u = mod(t, CYCLE);
  return u >= CARS_UNTIL + MARGIN && u <= CYCLE - MARGIN;
}

/** Whether a person standing at (X, V) has a foot on the stripes. */
export function onZebra(X: number, V: number): boolean {
  return (
    X + PERSON_HALF > ZEBRA.x0 &&
    X - PERSON_HALF < ZEBRA.x1 &&
    V + PERSON_HALF > ZEBRA.v0 &&
    V - PERSON_HALF < ZEBRA.v1
  );
}

/** When slot `j` of a lane's timetable has its front at the edge of the stripes. */
function slotTime(j: number): number {
  const c = Math.floor(j / PLATOON);
  return c * CYCLE + MARGIN + (j - c * PLATOON) * HEADWAY;
}

/** A car passing along Stadium Road. */
export interface RoadCar {
  X: number;
  V: number;
  /** 0 east, 1 west. */
  dir: number;
  paint: number;
}

/**
 * Every car on Stadium Road at time `t` within `reachX` of the middle. Calls `fn` for
 * each (the object is reused).
 */
export function roadCars(
  t: number,
  seed: number,
  reachX: number,
  fn: (car: RoadCar) => void,
): void {
  const car: RoadCar = { X: 0, V: 0, dir: 0, paint: 0 };
  const edge = ZEBRA.x1 + CAR_HALF_LONG;
  // a slot's car is within reach while its time at the stripes is in this span
  const early = t - (edge + reachX) / ROAD_SPEED;
  const late = t - (edge - reachX) / ROAD_SPEED;
  const j0 = Math.floor(early / CYCLE) * PLATOON - PLATOON;
  const j1 = Math.ceil(late / CYCLE) * PLATOON + PLATOON;
  for (let lane = 0; lane < 2; lane++) {
    for (let j = j0; j <= j1; j++) {
      const e = slotTime(j);
      if (e < early || e > late) continue;
      const key = mod(j, 256);
      if (hash2(key, 12 + lane * 2, seed) < MISSING) continue;
      const run = ROAD_SPEED * (t - e);
      car.dir = lane === 0 ? 1 : 0;
      car.X = lane === 0 ? edge - run : -edge + run;
      car.V = lane === 0 ? ROAD_WEST : ROAD_EAST;
      car.paint = hash2(key, 13 + lane * 2, seed);
      fn(car);
    }
  }
}

/**
 * Whether somebody standing on (X, V) at time `t` would be under a car on Stadium Road, or
 * too close in front of or behind one: `along` is how far from a car's middle counts, the
 * way it is going, and `across` how far to its side, in map units. Every slot of the
 * timetable is taken to hold a car, so the answer repeats every CYCLE seconds.
 */
export function roadBusy(
  X: number,
  V: number,
  t: number,
  along: number,
  across: number,
): boolean {
  const edge = ZEBRA.x1 + CAR_HALF_LONG;
  const slack = along / ROAD_SPEED;
  for (let lane = 0; lane < 2; lane++) {
    const laneV = lane === 0 ? ROAD_WEST : ROAD_EAST;
    if (Math.abs(V - laneV) >= across) continue;
    // the time a slot's car would have to have been at the stripes to be at X now
    const run = lane === 0 ? edge - X : X + edge;
    const e = t - run / ROAD_SPEED;
    const c = Math.floor(e / CYCLE);
    for (let k = c - 1; k <= c + 1; k++) {
      for (let i = 0; i < PLATOON; i++) {
        if (Math.abs(e - slotTime(k * PLATOON + i)) < slack) return true;
      }
    }
  }
  return false;
}

/**
 * The rule a walker on Stadium Road keeps: clear of every car, and on the stripes only in
 * the people's window.
 */
export function crossingBusy(
  X: number,
  V: number,
  t: number,
  along: number,
  across: number,
): boolean {
  if (onZebra(X, V) && !peopleWindow(t)) return true;
  return roadBusy(X, V, t, along, across);
}
