/**
 * The town plan: where everything is, in map units (see stadium-view.ts: X east, V north, the
 * centre spot at the origin, the camera to the south).
 *
 *   - STADIUM ROAD runs east-west right in front of the ground. The main plaza crosses it
 *     on a wide zebra; south of it, to the west, a street of terraced houses backs on to
 *     the camera (back gardens, sheds, washing lines) with the pub on the plaza corner;
 *     to the east is the big car park, with the pie van at its gate.
 *   - WEST ROAD and EAST ROAD run north either side of the concourse. West of the ground
 *     is the coach park (the away coaches in teal), then WESTERN AVENUE, a dual
 *     carriageway with trees down the middle, then the terraces and the school of Westgate.
 *   - East of the ground is VICTORIA PARK: a pond with an island, a bandstand, a kickabout,
 *     a dog walker. Beyond it PARK LANE and more houses.
 *   - Behind the ground NORTH ROAD, then allotments, a car park and the station forecourt,
 *     then the RAILWAY on its embankment with STADIUM HALT to the north east: supporters
 *     walk from the train down East Road to the gates.
 *   - Beyond the railway the old town: terraces, mills, tower blocks, the river with its
 *     bridges, then fields, woods and the hills.
 */

import { hash2 } from "~/pixel";
import { P } from "~/art/palette";
import type { Color } from "~/pixel";
import { OUT_A, OUT_B, gOut, inBowlShadow } from "~/art/stadium-bowl";

export const ROAD = {
  stadiumV0: -119,
  stadiumV1: -108,
  westX0: -178,
  westX1: -167,
  eastX0: 167,
  eastX1: 178,
  aveX0: -254,
  aveX1: -226,
  northV0: 121,
  northV1: 130,
  laneX0: 338,
  laneX1: 348,
  farWestX0: -420,
  farWestX1: -411,
  /** The north-south roads end at the station forecourt. */
  sideEnd: 166,
} as const;

export const RAIL = { v0: 170, v1: 180, mid: 175 } as const;
export const RIVER = { v0: 214, v1: 234 } as const;
export const STATION = { x0: 176, x1: 268 } as const;
export const PLAZA_HALF = 62;
/** The paved concourse: the wall's oval, grown. */
export const CONCOURSE = 1.19;
/** House lots along a terrace. */
export const LOT = 7.4;
/** The terraces south of Stadium Road repeat every this many units of depth. */
export const STREET = 34;

export const PARK = { x0: 178, x1: 338, v0: -108, v1: 121 } as const;
export const POND = { x: 226, v: 34, a: 24, b: 15 } as const;
export const COACHES = { x0: -226, x1: -178, v0: -108, v1: 121 } as const;
/** The bay in the coach park that the coach of the timetable (stadium-life.ts) uses. */
export const COACH_BAY = { X: -204, V: 63.5 } as const;
export const CARPARK = { x0: 62, x1: 330, v0: -400, v1: -122 } as const;
export const HOUSES_SW = { x0: -226, x1: -62 } as const;
/** The car park's gate on Stadium Road (stadium-parking.ts has the lanes and the bays). */
export const LOT_GATE = { x0: 66, x1: 78 } as const;

/** Where the river runs at this X (its middle line). */
export function riverMid(X: number): number {
  return (
    (RIVER.v0 + RIVER.v1) / 2 + 9 * Math.sin(X / 85) + 5 * Math.sin(X / 37 + 1)
  );
}

/** Markers the grader turns into the sky's own colours. */
export const WATER = -1;
export const WATER_HI = -2;
export const WATER_LO = -3;

export interface GroundHit {
  /** A daylight palette colour, or one of the WATER markers. */
  c: Color | number;
  /** Paved ground round the stadium: floodlit at night. */
  lit: boolean;
}

const hit: GroundHit = { c: P.grass, lit: false };

function near(d: number, width: number, s: number): boolean {
  return Math.abs(d) <= Math.max(width / 2, 0.5 / s);
}

/** A road seen across (`a`, from its middle) and along (`l`). */
function road(a: number, l: number, half: number, s: number): Color {
  if (Math.abs(a) > half - Math.max(1.3, 1 / s)) return P.concreteLight;
  if (s > 1.24 && near(a, 0.5, s) && Math.floor(l / 5) % 2 === 0) return P.mist;
  return P.concreteDark;
}

function paving(X: number, V: number): Color {
  return (Math.floor(X / 6) + Math.floor(V / 6)) % 2 === 0
    ? P.concreteLight
    : P.mist;
}

/** The back gardens of a terrace: one lot per house, lawns, paths and beds. */
function garden(lx: number, depth: number, lot: number, seed: number): Color {
  const kind = Math.floor(hash2(lot, 11, seed) * 5);
  if (lx < 0.7) return P.wood;
  if (kind === 0) return depth < 3 ? P.concreteLight : P.grass;
  if (kind === 1) return lx > 5.2 ? P.woodDark : P.grassLight;
  if (kind === 2) return Math.abs(lx - 3.9) < 0.7 ? P.chalk : P.grass;
  if (kind === 3) return depth > 8 ? P.grassDark : P.grassLight;
  return P.grass;
}

/**
 * What the ground is at (X, V). `s` is the scale there (pixels per unit), so thin lines
 * never fall between pixels.
 */
export function groundAt(
  X: number,
  V: number,
  s: number,
  seed: number,
): GroundHit {
  hit.lit = false;
  hit.c = pick(X, V, s, seed);
  if (V < 140 && V > -140 && hit.c >= 0 && inBowlShadow(X, V)) {
    hit.c = shadeOf(hit.c as Color);
  }
  return hit;
}

const SHADES = new Map<Color, Color>([
  [P.concreteLight, P.concrete],
  [P.mist, P.steel],
  [P.concreteDark, P.slate],
  [P.grass, P.grassDark],
  [P.grassLight, P.grass],
  [P.grassDark, P.grassDeep],
  [P.concrete, P.concreteDark],
  [P.chalk, P.concreteLight],
]);

/** One step down the ramp: what a surface looks like in cast shadow. */
export function shadeOf(c: Color): Color {
  return SHADES.get(c) ?? c;
}

function pick(X: number, V: number, s: number, seed: number): Color | number {
  if (V > 192) return far(X, V, s, seed);

  // ---- the railway ----------------------------------------------------------
  if (V >= RAIL.v0 && V <= RAIL.v1) {
    const d = V - RAIL.mid;
    if (X >= STATION.x0 && X <= STATION.x1 && Math.abs(d) > 2.6) {
      return P.concreteLight;
    }
    if (Math.abs(d) <= 2.6) {
      return s > 1 && near(Math.abs(d) - 1.3, 0.4, s)
        ? P.concreteDark
        : P.concrete;
    }
    return P.grassDark;
  }

  // ---- the big roads --------------------------------------------------------
  if (X >= ROAD.aveX0 && X <= ROAD.aveX1) {
    const mid = (ROAD.aveX0 + ROAD.aveX1) / 2;
    const a = X - mid;
    if (Math.abs(a) < 3) return P.grass;
    const lane = Math.abs(a) - 8.5;
    if (Math.abs(lane) > 4.4) return P.concreteLight;
    if (s > 1.24 && near(lane, 0.5, s) && Math.floor(V / 5) % 2 === 0) {
      return P.mist;
    }
    return P.concreteDark;
  }
  if (V >= ROAD.stadiumV0 && V <= ROAD.stadiumV1) {
    const a = V - (ROAD.stadiumV0 + ROAD.stadiumV1) / 2;
    // the zebra where the plaza crosses
    if (Math.abs(X) < PLAZA_HALF - 14 && Math.abs(a) < 4.2) {
      return Math.floor((X + 400) / 3) % 2 === 0 ? P.chalk : P.concreteDark;
    }
    return road(a, X, 5.5, s);
  }
  if (V > ROAD.stadiumV1 && V < ROAD.sideEnd) {
    if (X >= ROAD.westX0 && X <= ROAD.westX1) {
      return road(X - (ROAD.westX0 + ROAD.westX1) / 2, V, 5.5, s);
    }
    if (X >= ROAD.eastX0 && X <= ROAD.eastX1) {
      return road(X - (ROAD.eastX0 + ROAD.eastX1) / 2, V, 5.5, s);
    }
  }
  if (X >= ROAD.laneX0 && X <= ROAD.laneX1 && V < ROAD.sideEnd) {
    return road(X - (ROAD.laneX0 + ROAD.laneX1) / 2, V, 5, s);
  }
  if (X >= ROAD.farWestX0 && X <= ROAD.farWestX1 && V < ROAD.sideEnd) {
    return road(X - (ROAD.farWestX0 + ROAD.farWestX1) / 2, V, 4.5, s);
  }
  if (V >= ROAD.northV0 && V <= ROAD.northV1) {
    return road(V - (ROAD.northV0 + ROAD.northV1) / 2, X, 4.5, s);
  }

  // ---- the concourse and the plaza -----------------------------------------
  const g = gOut(X, V);
  if (g <= CONCOURSE) {
    hit.lit = true;
    // a ring of darker setts where the turnstiles are
    if (g < 1.045) return P.concrete;
    return paving(X, V);
  }
  if (Math.abs(X) <= PLAZA_HALF && V < -96) {
    hit.lit = V > ROAD.stadiumV0 - 6;
    if (V < ROAD.stadiumV0) {
      // the fan park: a wide walk with a darker band down the middle
      if (near(Math.abs(X) - (PLAZA_HALF - 1), 1.4, s)) return P.concrete;
      return Math.abs(X) < 16
        ? (Math.floor(V / 6) + Math.floor(X / 8)) % 2 === 0
          ? P.steelHi
          : P.concreteLight
        : paving(X, V);
    }
    return paving(X, V);
  }

  // ---- south of Stadium Road ------------------------------------------------
  if (V < ROAD.stadiumV0) {
    const d = ROAD.stadiumV0 - V;
    if (X < -PLAZA_HALF && X > ROAD.aveX1) {
      const row = d % STREET;
      // pavement, the houses, their gardens, the back alley
      if (row < 4) return P.concreteLight;
      if (row < 15) return P.concrete;
      if (row < 29) {
        const lx = (((X - HOUSES_SW.x0) % LOT) + LOT) % LOT;
        const lot =
          Math.floor((X - HOUSES_SW.x0) / LOT) + Math.floor(d / STREET) * 64;
        return garden(lx, row - 15, lot, seed);
      }
      return near(row - 31.5, 0.5, s) ? P.concrete : P.concreteDark;
    }
    if (X > PLAZA_HALF && X < CARPARK.x1) {
      // the car park: a verge and a hedge, then rows of bays
      const gate = X >= LOT_GATE.x0 && X <= LOT_GATE.x1;
      if (d < 3.2) {
        if (!gate) return P.grass;
        // the way in and the way out, a kerb either side
        return X - LOT_GATE.x0 < 1 || LOT_GATE.x1 - X < 1
          ? P.concreteLight
          : P.concreteDark;
      }
      if (gate && d < 10.2) {
        return s > 1.8 &&
          near(X - (LOT_GATE.x0 + LOT_GATE.x1) / 2, 0.5, s) &&
          Math.floor(d / 2) % 2 === 0
          ? P.mist
          : P.concreteDark;
      }
      // the footpath along the hedge
      if (d < 4.5) return P.concreteLight;
      const row = (d - 3.2) % 22;
      const bays = row < 7 || (row >= 12 && row < 19);
      if (bays && s > 1.1 && near((((X - 62) % 4) + 4) % 4, 0.4, s)) {
        return P.concreteLight;
      }
      return bays ? P.concrete : P.concreteDark;
    }
    return X < 0 ? westgate(X, V, s, seed) : eastside(X, V, s, seed);
  }

  // ---- beside the ground ----------------------------------------------------
  if (V <= ROAD.northV0) {
    if (X > ROAD.westX1 && X < ROAD.eastX0) {
      // verges between the concourse and the side roads, and behind the ground
      return P.grass;
    }
    if (X >= COACHES.x0 && X <= COACHES.x1) {
      // the coach park: tarmac with long bays, a verge along the avenue
      if (X < COACHES.x0 + 3 || V > ROAD.northV0 - 4) return P.grass;
      if (s > 1.1 && near(((V + 400) % 6.5) - 0.2, 0.4, s) && X < -183) {
        return P.concreteLight;
      }
      return P.concrete;
    }
    if (X >= PARK.x0 && X <= PARK.x1) return park(X, V, s);
    return X < 0 ? westgate(X, V, s, seed) : eastside(X, V, s, seed);
  }

  // ---- between North Road and the railway -----------------------------------
  if (X > ROAD.aveX1 && X < -24) {
    // allotments: strips of soil, greens and paths
    const plot = Math.floor((X + 226) / 9);
    const strip = Math.floor((V - 130) / 3.2);
    if (near((((X + 226) % 9) + 9) % 9, 0.8, s)) return P.grassLight;
    const kind = hash2(plot, strip, seed);
    return kind < 0.4
      ? P.woodDark
      : kind < 0.65
        ? P.wood
        : kind < 0.85
          ? P.grassDark
          : P.grassLight;
  }
  if (X >= -24 && X < 150) {
    // the north car park
    const row = (V - 131) % 13;
    if (X < -18 || X > 144 || V > 165) return P.grassDark;
    const bays = row < 5 || (row >= 8 && row < 13);
    return bays ? P.concrete : P.concreteDark;
  }
  if (X >= 150 && X < ROAD.laneX0) {
    // the station forecourt
    if (V > 163) return P.concreteLight;
    return X > 186 && X < 250 && V > 140 && V < 156
      ? P.concreteDark
      : paving(X, V);
  }
  return X < 0 ? westgate(X, V, s, seed) : eastside(X, V, s, seed);
}

/** Victoria Park. */
function park(X: number, V: number, s: number): Color | number {
  // the hedge and railings along its edges
  if (X < PARK.x0 + 2.5 || X > PARK.x1 - 2.5 || V < PARK.v0 + 2.5) {
    return P.grassDeep;
  }
  const dx = (X - POND.x) / POND.a;
  const dv = (V - POND.v) / POND.b;
  const pd = dx * dx + dv * dv;
  if (pd <= 1) {
    // the island
    const ix = (X - POND.x - 5) / 6;
    const iv = (V - POND.v + 1) / 3.6;
    if (ix * ix + iv * iv <= 1) return P.grassLight;
    if (pd > 0.8 && dv > 0.2) return WATER_LO;
    return dv < -0.25 && pd < 0.5 && Math.floor(X / 5) % 2 === 0
      ? WATER_HI
      : WATER;
  }
  if (pd <= 1.32) return P.chalk;
  // paths: round the edge, and two across to the pond
  const edge = Math.min(X - PARK.x0, PARK.x1 - X, V - PARK.v0, PARK.v1 - V);
  if (near(edge - 12, 3, s)) return P.chalk;
  if (near(V - POND.v - (X - POND.x) * 0.55, 3, s) && X < POND.x + 40) {
    return P.chalk;
  }
  if (near(X - 252, 3, s) && V < POND.v) return P.chalk;
  // a mown kickabout lawn
  if (X > 262 && X < 322 && V > -70 && V < -12) {
    return Math.floor((X - 262) / 7.5) % 2 === 0 ? P.grassLight : P.grass;
  }
  return P.grass;
}

/** West of the avenue: streets running north-south, the school and its field. */
function westgate(X: number, V: number, s: number, seed: number): Color {
  // the school field
  if (X < -262 && X > -330 && V > -62 && V < 24) {
    if (V > 2) return P.concreteLight;
    const inX = X > -322 && X < -270;
    const inV = V > -54 && V < -6;
    if (inX && inV) {
      if (
        near(X + 322, 0.6, s) ||
        near(X + 270, 0.6, s) ||
        near(V + 54, 0.6, s) ||
        near(V + 6, 0.6, s) ||
        near(X + 296, 0.6, s)
      ) {
        return P.chalk;
      }
      return Math.floor((X + 322) / 6.5) % 2 === 0 ? P.grassLight : P.grass;
    }
    return P.grass;
  }
  return streets(X, V, s, seed);
}

function eastside(X: number, V: number, s: number, seed: number): Color {
  return streets(X, V, s, seed);
}

/** A grid of streets with gardens between the houses (the houses are painted on top). */
function streets(X: number, V: number, s: number, seed: number): Color {
  const col = (((X + 3) % 78) + 78) % 78;
  const row = (((V + 30) % 52) + 52) % 52;
  if (row < 6) return road(row - 3, X, 3, s);
  if (col < 6) return road(col - 3, V, 3, s);
  const block = Math.floor((X + 3) / 78) * 31 + Math.floor((V + 30) / 52);
  const lx = col - 6;
  const lv = row - 6;
  // houses along the two long sides, gardens in the middle
  if (lv < 9 || lv > 37) return P.concrete;
  const lot = Math.floor(lx / LOT) + block * 16 + (lv > 23 ? 8 : 0);
  if (near(lv - 23, 0.6, s)) return P.wood;
  return garden(lx % LOT, Math.abs(lv - 23), lot, seed);
}

/** Beyond the railway: the old town, the river, fields, woods. */
function far(X: number, V: number, s: number, seed: number): Color | number {
  const rm = riverMid(X);
  const rd = V - rm;
  if (Math.abs(rd) < 10) {
    if (Math.abs(rd) > 8) return P.grassDark;
    return rd < -4 ? WATER_HI : WATER;
  }
  if (V < 560) {
    // streets every so often, the rest is rooftops painted on top
    if (X >= ROAD.aveX0 && X <= ROAD.aveX1) return P.concreteDark;
    const row = (((V - 196) % 26) + 26) % 26;
    if (row < 4) return P.concreteDark;
    const col = (((X + 40) % 130) + 130) % 130;
    if (col < 5) return P.concreteDark;
    const block = Math.floor((X + 40) / 130) * 17 + Math.floor((V - 196) / 26);
    return hash2(block, 5, seed) < 0.16 ? P.grass : P.concrete;
  }
  // fields: a patchwork with hedges
  const fx = Math.floor((X + 3000) / 150);
  const fv = Math.floor(Math.log(V) * 5.5);
  const kind = hash2(fx + fv * 7, fv, seed);
  if (V > 4000) return P.grassDark;
  return kind < 0.3
    ? P.grassLight
    : kind < 0.62
      ? P.grass
      : kind < 0.85
        ? P.grassDark
        : P.grassHi;
}

export { OUT_A, OUT_B };
