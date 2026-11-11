/**
 * Giving way: how people on foot get across Stadium Road.
 *
 * The cars keep to their timetable (stadium-road.ts); the people fit round it. A walker who
 * reaches a kerb with a car coming, or the zebra in the cars' window, stops there, waits,
 * and then crosses in one go: nobody is ever under a car, nobody is on the zebra while a
 * car is, and small knots of people gather at the kerbs and cross together, as they do.
 *
 * It stays a pure function of the time. The traffic repeats every CYCLE seconds, so a walk
 * that starts at a known moment of the cycle has waits that can be worked out once
 * (`planWalk`); and a walker who goes round and round a path is given a lap that is a
 * whole number of cycles, so every lap of theirs starts at the same moment of the cycle and
 * the same plan holds for ever (`lapOf`).
 */

import { CYCLE, crossingBusy } from "~/art/stadium-road";
import { ROAD } from "~/art/stadium-plan";

/** How near a car's middle is too near, the way it is going: half a car, a person, a pace. */
export const CLEAR_ALONG = 3.6;
/** And to its side: half its width and a person. */
export const CLEAR_ACROSS = 2.2;

/** The kerb a walker waits at is this far outside the roadway. */
const KERB = 1.3;
/** How finely a way is looked along for roadway, and a crossing for cars: map units. */
const LOOK = 0.4;
/** How finely the wait is searched, seconds. */
const PATIENCE = 0.25;

/** A place on a walker's way where they stop: how far along, and for how long. */
export interface Stop {
  d: number;
  wait: number;
}

export interface WalkPlace {
  /** How far along the way. At or past its length: the walk is over. */
  d: number;
  /** Standing at a kerb. */
  waiting: boolean;
}

export interface WalkRules {
  /** Whether (X, V) is roadway to be crossed in one go. Default: `roadway`. */
  roadway?: (X: number, V: number) => boolean;
  /** Whether (X, V) may not be stood on at time t. Default: `crossingBusy`. */
  busy?: (X: number, V: number, t: number) => boolean;
  /** The longest a walker waits at one kerb, seconds. Default: a cycle. */
  patience?: number;
}

/** Whether (X, V) is roadway that cars use: Stadium Road, kerb to kerb. */
export function roadway(_X: number, V: number): boolean {
  return V > ROAD.stadiumV0 - KERB && V < ROAD.stadiumV1 + KERB;
}

/**
 * Where a walker must stop on a way and for how long, setting off at time `start` and
 * walking at `speed`. `at(d)` is the place `d` along the way (the result may be reused).
 * Stretches of roadway are crossed in one go, never coming within the clearances of a car
 * and never on the zebra outside the people's window; before each, the walker waits at the
 * kerb for as long as that takes (never more than a cycle). Waits of nothing are left out.
 */
export function planWalk(
  at: (d: number) => { X: number; V: number },
  len: number,
  speed: number,
  start: number,
  rules?: WalkRules,
): Stop[] {
  const stops: Stop[] = [];
  if (!(len > 0) || !(speed > 0)) return stops;
  const isRoad = rules?.roadway ?? roadway;
  const busy =
    rules?.busy ??
    ((X: number, V: number, t: number): boolean =>
      crossingBusy(X, V, t, CLEAR_ALONG, CLEAR_ACROSS));
  const patience = rules?.patience ?? CYCLE;
  let waited = 0;
  let d = 0;
  while (d <= len) {
    const p = at(d);
    if (!isRoad(p.X, p.V)) {
      d += LOOK;
      continue;
    }
    // a stretch of roadway from here to `end`
    const from = d;
    let end = d;
    while (end + LOOK <= len) {
      const q = at(end + LOOK);
      if (!isRoad(q.X, q.V)) break;
      end += LOOK;
    }
    const arrive = start + from / speed + waited;
    let wait = 0;
    for (; wait < patience; wait += PATIENCE) {
      let clear = true;
      for (let x = from; x <= end && clear; x += LOOK) {
        const q = at(x);
        const t = arrive + wait + (x - from) / speed;
        if (busy(q.X, q.V, t)) clear = false;
      }
      if (clear) break;
    }
    // no gap in all that time (it does not happen): walk on rather than stand for ever
    if (wait >= patience) wait = 0;
    if (wait > 0) {
      stops.push({ d: from, wait });
      waited += wait;
    }
    d = end + LOOK;
  }
  return stops;
}

/** The seconds of waiting in a plan. */
export function waitOf(stops: readonly Stop[]): number {
  let w = 0;
  for (const s of stops) w += s.wait;
  return w;
}

/**
 * The lap of a walker who goes round a way of length `len` for ever: the walk and its
 * waits, rounded up to a whole number of cycles, so that every lap starts at the same
 * moment of the cycle. The time left over is spent out of sight at the end of the way.
 */
export function lapOf(
  len: number,
  speed: number,
  stops: readonly Stop[],
): number {
  const walk = len / speed + waitOf(stops);
  return CYCLE * Math.max(1, Math.ceil(walk / CYCLE - 1e-9));
}

/** Where a walker is `tau` seconds after setting off, with this plan. Fills `out`. */
export function walkAt(
  stops: readonly Stop[],
  speed: number,
  tau: number,
  out: WalkPlace,
): WalkPlace {
  let waited = 0;
  for (const s of stops) {
    const arrive = s.d / speed + waited;
    if (tau < arrive) break;
    if (tau < arrive + s.wait) {
      out.d = s.d;
      out.waiting = true;
      return out;
    }
    waited += s.wait;
  }
  out.d = (tau - waited) * speed;
  out.waiting = false;
  return out;
}
