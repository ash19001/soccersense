/**
 * The big car park south east of the ground, and the cars that come and go.
 *
 * The plan, in map units (see stadium-view.ts). North is up the screen:
 *
 *   Stadium Road      eastbound lane   V = ROAD_EAST   (the far side)
 *                     westbound lane   V = ROAD_WEST   (the near side, along the hedge)
 *   the gate          X 66 to 78: cars come in down IN_X and go out up OUT_X
 *   row A             bays facing the aisle, nose south
 *   the aisle         eastbound on its north side, westbound on its south side
 *   row B             bays facing the aisle, nose north
 *   ... and the same again every BAND units to the south (those rows never change)
 *
 * Most bays hold the same car all day (the static painter draws those). A handful in the
 * first two rows are LIVE: each has a timetable, a pure function of the time:
 *
 *   - a car comes west along Stadium Road, turns in at the gate on its tick, drives down
 *     the aisle, reverses into the bay and stays;
 *   - later it pulls out forwards, drives back to the gate, crosses to the eastbound lane
 *     and leaves; the bay stands empty until the next one arrives.
 *
 * Time is cut into ticks of TICK seconds. On every tick exactly one car turns in at the
 * gate and exactly one crosses the road on its way out (0.9 of a tick later), so cars at
 * the gate never meet. The through traffic on Stadium Road is slotted between them (see
 * `roadCars`). The order the bays are served in (ORDER) was chosen so that no two moving
 * cars ever come within a car's length of each other inside the car park: a test walks
 * the whole timetable to prove it.
 */

import { hash2 } from "~/pixel";
import { CARPARK, LOT_GATE, ROAD } from "~/art/stadium-plan";

/** Seconds between two arrivals (and between two departures). */
export const TICK = 6;
/** Speed on the road and inside the car park, units a second. */
export const ROAD_SPEED = 7;
const LOT_SPEED = 6;
const REVERSE_SPEED = 3;
const PULL_OUT_SPEED = 4;

export const ROAD_EAST = ROAD.stadiumV1 - 2.9;
export const ROAD_WEST = ROAD.stadiumV0 + 2.9;

/** The kerb between the hedge and the first row. */
export const LOT_TOP = ROAD.stadiumV0 - 3.2;
/** Rows repeat every this many units to the south. */
export const BAND = 22;
/** A bay's width. */
export const BAY = 4;
export const GATE = { ...LOT_GATE, inX: 75, outX: 69 } as const;
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

/** The live bays: [row, bay]. All can be seen on a monitor of any shape. */
export const LIVE: readonly (readonly [number, number])[] = [
  [0, 5],
  [1, 2],
  [0, 8],
  [1, 5],
  [0, 10],
  [1, 8],
  [0, 13],
  [1, 11],
  [0, 15],
  [1, 14],
];

/** The tick (within a period) each live bay's car turns in at the gate on. */
export const ORDER: readonly number[] = [8, 6, 7, 4, 1, 5, 3, 2, 9, 0];
/** A car leaves this many ticks after it arrived. */
const STAY = 9;
/** The whole timetable repeats (with other cars) after this long. */
export const PERIOD = LIVE.length * TICK;
/** A departing car is in the middle of the westbound lane this long after its tick. */
const CROSS = 0.9 * TICK;

function liveIndex(row: number, n: number): number {
  for (let i = 0; i < LIVE.length; i++) {
    if (LIVE[i][0] === row && LIVE[i][1] === n) return i;
  }
  return -1;
}

/**
 * Whether the static painter puts a car in this bay: never in a live bay, in the gate's
 * lane or under the gatehouse; otherwise nearly always (it is a matchday).
 */
export function staticCar(
  band: number,
  row: number,
  n: number,
  seed: number,
): boolean {
  if (n < 0 || n >= BAYS_PER_ROW) return false;
  if (band === 0) {
    if (row === 0 && n < 4) return false;
    if (liveIndex(row, n) >= 0) return false;
  }
  return hash2(n + row * 977, band * 31 + 5, seed) < 0.93;
}

/** One straight piece of a car's way through the car park. */
interface Leg {
  X0: number;
  V0: number;
  X1: number;
  V1: number;
  t0: number;
  t1: number;
  dir: number;
  reversing: boolean;
}

interface BayPlan {
  row: number;
  n: number;
  X: number;
  V: number;
  dir: number;
  /** From the gate to the bay; times are seconds after turning in. */
  inLegs: Leg[];
  inTime: number;
  /** From the bay to the eastbound lane; times are seconds after pulling out. */
  outLegs: Leg[];
  /** Seconds from pulling out to the middle of the westbound lane. */
  outToCross: number;
  outTime: number;
}

function legs(
  pts: readonly (readonly [number, number, number, number, boolean])[],
): { legs: Leg[]; time: number } {
  const out: Leg[] = [];
  let t = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const len = Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]);
    const dur = len / b[2];
    out.push({
      X0: a[0],
      V0: a[1],
      X1: b[0],
      V1: b[1],
      t0: t,
      t1: t + dur,
      dir: b[3],
      reversing: b[4],
    });
    t += dur;
  }
  return { legs: out, time: t };
}

const PLANS: readonly BayPlan[] = LIVE.map(([row, n]) => {
  const X = bayX(n);
  const V = rowV(0, row);
  const dir = rowDir(row);
  // each point: X, V, the speed to get there, the heading on the way, reversing
  const arrive = legs([
    [GATE.inX, ROAD_WEST, 0, 0, false],
    [GATE.inX, AISLE.north, LOT_SPEED, 3, false],
    [X, AISLE.north, LOT_SPEED, 0, false],
    [X, V, REVERSE_SPEED, dir, true],
  ]);
  const leave = legs([
    [X, V, 0, 0, false],
    [X, AISLE.south, PULL_OUT_SPEED, dir, false],
    [GATE.outX, AISLE.south, LOT_SPEED, 1, false],
    [GATE.outX, ROAD_EAST, LOT_SPEED, 2, false],
  ]);
  const last = leave.legs[2];
  const toCross = last.t0 + Math.abs(ROAD_WEST - AISLE.south) / LOT_SPEED;
  return {
    row,
    n,
    X,
    V,
    dir,
    inLegs: arrive.legs,
    inTime: arrive.time,
    outLegs: leave.legs,
    outToCross: toCross,
    outTime: leave.time,
  };
});

/** What one of the timetable's cars is doing. */
export interface LiveCar {
  X: number;
  V: number;
  /** 0 pointing east, 1 west, 2 north, 3 south. */
  dir: number;
  /** 0 parked, 1 driving, 2 reversing into its bay. */
  state: number;
  /** Which paint, 0..1. */
  paint: number;
  /** Its bay (an index into LIVE) and which visit to it this is. */
  bay: number;
  visit: number;
}

export function makeLiveCar(): LiveCar {
  return { X: 0, V: 0, dir: 0, state: 0, paint: 0, bay: 0, visit: 0 };
}

/** When the car of `visit` to live bay `i` turns in at the gate. */
export function turnInTime(i: number, visit: number): number {
  return (ORDER[i] + visit * LIVE.length) * TICK;
}

/** When that car has finished parking, and when it pulls out again. */
export function parkedFrom(i: number, visit: number): number {
  return turnInTime(i, visit) + PLANS[i].inTime;
}
export function parkedUntil(i: number, visit: number): number {
  return turnInTime(i, visit) + STAY * TICK + CROSS - PLANS[i].outToCross;
}

export function bayPlace(i: number): { X: number; V: number; row: number } {
  const p = PLANS[i];
  return { X: p.X, V: p.V, row: p.row };
}

function along(car: LiveCar, list: readonly Leg[], t: number): boolean {
  for (const l of list) {
    if (t < l.t1) {
      const u = l.t1 <= l.t0 ? 1 : Math.max(0, (t - l.t0) / (l.t1 - l.t0));
      car.X = l.X0 + (l.X1 - l.X0) * u;
      car.V = l.V0 + (l.V1 - l.V0) * u;
      car.dir = l.dir;
      car.state = l.reversing ? 2 : 1;
      return true;
    }
  }
  return false;
}

/**
 * Where the car of `visit` to live bay `i` is at time `t`. False when it is not in the
 * picture: still beyond `reachX` on its way in, or gone past it on its way out.
 */
export function carAt(
  car: LiveCar,
  i: number,
  visit: number,
  t: number,
  seed: number,
  reachX: number,
): boolean {
  const plan = PLANS[i];
  const tin = turnInTime(i, visit);
  car.bay = i;
  car.visit = visit;
  car.paint = hash2(i * 13 + 3, visit & 1023, seed);
  if (t < tin) {
    // on Stadium Road, westbound
    car.X = GATE.inX + ROAD_SPEED * (tin - t);
    car.V = ROAD_WEST;
    car.dir = 1;
    car.state = 1;
    return car.X <= reachX;
  }
  const since = t - tin;
  if (since < plan.inTime) return along(car, plan.inLegs, since);
  const out = parkedUntil(i, visit);
  if (t < out) {
    car.X = plan.X;
    car.V = plan.V;
    car.dir = plan.dir;
    car.state = 0;
    return true;
  }
  const gone = t - out;
  if (gone < plan.outTime) return along(car, plan.outLegs, gone);
  // on Stadium Road, eastbound
  car.X = GATE.outX + ROAD_SPEED * (gone - plan.outTime);
  car.V = ROAD_EAST;
  car.dir = 0;
  car.state = 1;
  return car.X <= reachX;
}

/**
 * Every timetable car in the picture at time `t`, written into `out` (which grows as
 * needed). Returns how many.
 */
export function liveCars(
  out: LiveCar[],
  t: number,
  seed: number,
  reachX: number,
): number {
  let count = 0;
  for (let i = 0; i < LIVE.length; i++) {
    const base = Math.floor((t - ORDER[i] * TICK) / PERIOD);
    for (let visit = base - 1; visit <= base + 1; visit++) {
      if (count >= out.length) out.push(makeLiveCar());
      if (carAt(out[count], i, visit, t, seed, reachX)) count++;
    }
  }
  return count;
}

/** A car passing along Stadium Road. */
export interface RoadCar {
  X: number;
  V: number;
  dir: number;
  paint: number;
}

/** The through traffic's slots are this far apart, bumper to bumper. */
const SLOT_GAP = ROAD_SPEED * TICK;
/** An eastbound slot passes the gate's out-lane this long after a tick: half a tick after
 * the departing car has joined the lane. */
const EAST_JOIN =
  CROSS + Math.abs(ROAD_EAST - ROAD_WEST) / LOT_SPEED + TICK / 2;

/**
 * The through traffic on Stadium Road at time `t`, slotted half a tick away from the
 * cars of the timetable so that nothing ever overlaps. Calls `fn` for each.
 *
 * Cars only: a slot is one car long, which is what leaves the gaps that people on foot
 * cross in (`roadBusy`). The buses run on the avenue.
 */
export function roadCars(
  t: number,
  seed: number,
  reachX: number,
  fn: (car: RoadCar) => void,
): void {
  const car: RoadCar = { X: 0, V: 0, dir: 0, paint: 0 };
  // westbound: slot m is at the gate's in-lane at (m + 0.5) ticks
  const mw = Math.floor(t / TICK - 0.5 + (reachX - GATE.inX) / SLOT_GAP);
  for (let m = mw; ; m--) {
    const X = GATE.inX - ROAD_SPEED * (t - (m + 0.5) * TICK);
    if (X < -reachX) break;
    const key = ((m % 64) + 64) % 64;
    if (X > reachX || hash2(key, 12, seed) < 0.3) continue;
    car.X = X;
    car.V = ROAD_WEST;
    car.dir = 1;
    car.paint = hash2(key, 13, seed);
    fn(car);
  }
  // eastbound: half a tick after each departing car joins the lane
  const me = Math.floor(
    (t - EAST_JOIN) / TICK + (reachX + GATE.outX) / SLOT_GAP,
  );
  for (let m = me; ; m--) {
    const X = GATE.outX + ROAD_SPEED * (t - (m * TICK + EAST_JOIN));
    if (X > reachX) break;
    const key = ((m % 64) + 64) % 64;
    if (X < -reachX || hash2(key, 14, seed) < 0.3) continue;
    car.X = X;
    car.V = ROAD_EAST;
    car.dir = 0;
    car.paint = hash2(key, 15, seed);
    fn(car);
  }
}

/** How near a slot's car is to X at time `t`, with the slot's car at `base`. */
function slotGap(X: number, base: number): number {
  const d = (((X - base) % SLOT_GAP) + SLOT_GAP) % SLOT_GAP;
  return Math.min(d, SLOT_GAP - d);
}

/**
 * Whether somebody standing on (X, V) at time `t` would be under a car, or too close in
 * front of or behind one: on Stadium Road (the through traffic of both lanes) or in the
 * lanes of the car park's gate (the car that turns in on every tick and the one that
 * pulls out). `along` is how far from a car's middle counts, the way it is going, and
 * `across` how far to its side, in map units.
 *
 * Every slot of the through traffic is taken to hold a car (three in ten are empty), so
 * the answer repeats every TICK seconds: that is what lets people on foot wait at the
 * kerb for a gap that is certain to come (stadium-crossing.ts).
 */
export function roadBusy(
  X: number,
  V: number,
  t: number,
  along: number,
  across: number,
): boolean {
  // Stadium Road
  if (Math.abs(V - ROAD_WEST) < across) {
    const base = GATE.inX - ROAD_SPEED * (t - TICK / 2);
    if (slotGap(X, base) < along) return true;
  }
  if (Math.abs(V - ROAD_EAST) < across) {
    const base = GATE.outX + ROAD_SPEED * (t - EAST_JOIN);
    if (slotGap(X, base) < along) return true;
  }
  // the gate: a car is in the in-lane from its tick until it turns into the aisle
  const u = ((t % TICK) + TICK) % TICK;
  if (Math.abs(X - GATE.inX) < across) {
    const Vin = ROAD_WEST - LOT_SPEED * u;
    if (Vin >= AISLE.north - along && Math.abs(V - Vin) < along) return true;
    // and the next one is slowing to turn in
    if (TICK - u < 0.6 && Math.abs(V - ROAD_WEST) < along) return true;
  }
  // and one comes up the out-lane, in the westbound lane CROSS seconds after its tick
  if (Math.abs(X - GATE.outX) < across) {
    let c = (((t - CROSS) % TICK) + TICK) % TICK;
    if (c > TICK / 2) c -= TICK;
    const Vout = ROAD_WEST + LOT_SPEED * c;
    if (
      Vout >= AISLE.south - along &&
      Vout <= ROAD_EAST + along &&
      Math.abs(V - Vout) < along
    )
      return true;
  }
  return false;
}
