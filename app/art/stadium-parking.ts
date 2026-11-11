/**
 * The big car park south east of the ground. Its cars are parked for the day: they are
 * part of the painted picture (stadium-town.ts), and no car drives in or out. The traffic
 * goes past on Stadium Road (stadium-road.ts).
 *
 * The plan, in map units (see stadium-view.ts). North is up the screen:
 *
 *   Stadium Road      along the north side of the car park
 *   the gate          X 66 to 78, with the gatehouse on its east side
 *   row A             bays facing the aisle, nose south
 *   the aisle
 *   row B             bays facing the aisle, nose north
 *   ... and the same again every BAND units to the south
 */

import { hash2 } from "~/pixel";
import { CARPARK, LOT_GATE, ROAD } from "~/art/stadium-plan";

/** The kerb between the hedge and the first row. */
export const LOT_TOP = ROAD.stadiumV0 - 3.2;
/** Rows repeat every this many units to the south. */
export const BAND = 22;
/** A bay's width. */
export const BAY = 4;
export const GATE = LOT_GATE;
/** The aisle between the two rows of the first band. */
export const AISLE = {
  north: LOT_TOP - 8.3,
  south: LOT_TOP - 10.7,
  mid: LOT_TOP - 9.5,
} as const;
/** The footpath along the hedge that people take to the plaza. */
export const KERB_V = LOT_TOP - 0.7;

/** The middle of bay `n` (0 is the first one inside the west fence). */
export function bayX(n: number): number {
  return CARPARK.x0 + 6 + n * BAY;
}

/** Where a car stands in row 0 (A) or 1 (B) of a band, and which way it points. */
export function rowV(band: number, row: number): number {
  return LOT_TOP - band * BAND - (row === 0 ? 3.6 : 15.4);
}
export function rowDir(row: number): number {
  return row === 0 ? 3 : 2;
}

/** How many bays a row has. */
export const BAYS_PER_ROW = Math.floor((CARPARK.x1 - 4 - bayX(0)) / BAY);

/**
 * Whether the painter puts a car in this bay: never in the gate's lane or under the
 * gatehouse; otherwise nearly always (it is a matchday).
 */
export function staticCar(
  band: number,
  row: number,
  n: number,
  seed: number,
): boolean {
  if (n < 0 || n >= BAYS_PER_ROW) return false;
  if (band === 0 && row === 0 && n < 4) return false;
  return hash2(n + row * 977, band * 31 + 5, seed) < 0.93;
}
