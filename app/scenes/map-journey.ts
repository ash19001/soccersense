/**
 * FURTHEST's career as a journey (2026-11-18; docs/GAME_DESIGN.md section 5.3): every
 * promotion is a move to a bigger ground further from the day's place, the World Cup final
 * on the far side of the world. The product owner chose the plan from image demos:
 * "sure do it".
 *
 * `journeyFor(place)` gives a stop for each tier, from ~/data/cities: tier 0 the day's place
 * itself, then one about STOP_KM away for tiers 1 to 5 (each further than the last, and
 * after the first roughly the way the journey set off, so that it reads as one journey),
 * and for tiers 6 and 7 the city furthest from home of all. Each stop says how it was
 * reached from the one before: by coach up the road, by ferry or train across a border or the
 * sea, by plane from there on. Pure: the same place always has the same journey.
 */

import { type GeoPoint, alongGreatCircle, isLand } from "~/art/world-map";
import { CITIES, type City } from "~/data/cities";
import { distanceKm } from "~/game/geo";

export type Travel = "coach" | "ferry" | "train" | "plane";

export interface Stop {
  name: string;
  lat: number;
  lng: number;
  /** Kilometres from the day's place. */
  km: number;
  /** How it was reached from the stop before it; null for the day's place. */
  by: Travel | null;
}

/** How far from home each tier's stop is aimed at (km), tiers 0 to 5. */
export const STOP_KM: readonly number[] = [0, 70, 600, 2200, 6000, 11000];
/** No stop nearer home than this (km): the day's place's own city is not a move. */
const NEAREST_KM = 15;
/** Each stop at least this many times as far from home as the last. */
const FURTHER = 1.25;
/** How much keeping to the journey's way counts against the distance being right. */
const KEEP_WAY = 0.35;

/** The bearing from `a` to `b`, in degrees (0 north, 90 east). */
export function bearing(a: GeoPoint, b: GeoPoint): number {
  const R = Math.PI / 180;
  const p1 = a.lat * R;
  const p2 = b.lat * R;
  const dl = (b.lng - a.lng) * R;
  const y = Math.sin(dl) * Math.cos(p2);
  const x =
    Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return (((Math.atan2(y, x) / R) % 360) + 360) % 360;
}

function turn(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/** How a leg is travelled: by coach the first time, then by sea, rail or air. */
function travelFor(tier: number, from: GeoPoint, to: GeoPoint): Travel {
  if (tier <= 1) return "coach";
  const km = distanceKm(from, to);
  if (km > 2500) return "plane";
  let sea = false;
  for (let i = 1; i < 20 && !sea; i++) {
    const p = alongGreatCircle(from, to, i / 20);
    if (!isLand(p.lat, p.lng)) sea = true;
  }
  if (sea) return km < 1500 ? "ferry" : "plane";
  return "train";
}

/** FURTHEST's stops for the day's place: index by the career's tier, 0 to 7. */
export function journeyFor(
  place: GeoPoint & { name: string },
  cities: readonly City[] = CITIES,
): Stop[] {
  const home: Stop = {
    name: place.name,
    lat: place.lat,
    lng: place.lng,
    km: 0,
    by: null,
  };
  const stops: Stop[] = [home];
  const used = new Set<string>();
  let way: number | null = null;
  for (let tier = 1; tier < STOP_KM.length; tier++) {
    const last = stops[tier - 1];
    const target = STOP_KM[tier];
    let best: City | null = null;
    let bestKm = 0;
    let bestScore = Infinity;
    for (const c of cities) {
      if (used.has(c.name)) continue;
      const km = distanceKm(place, c);
      if (km < NEAREST_KM || km <= last.km * FURTHER) continue;
      let score = Math.abs(Math.log(km / target));
      if (way !== null)
        score += (KEEP_WAY * turn(bearing(place, c), way)) / 180;
      if (score < bestScore) {
        bestScore = score;
        best = c;
        bestKm = km;
      }
    }
    if (!best) {
      stops.push({ ...last, by: last.by });
      continue;
    }
    used.add(best.name);
    if (way === null) way = bearing(place, best);
    stops.push({
      name: best.name,
      lat: best.lat,
      lng: best.lng,
      km: bestKm,
      by: travelFor(tier, last, best),
    });
  }
  // the final, and the trophy: the far side of the world, as far from home as any city is
  let far: City = cities[0];
  let farKm = -1;
  for (const c of cities) {
    const km = distanceKm(place, c);
    if (km > farKm) {
      farKm = km;
      far = c;
    }
  }
  const before = stops[stops.length - 1];
  const final: Stop = {
    name: far.name,
    lat: far.lat,
    lng: far.lng,
    km: farKm,
    by: farKm > before.km ? travelFor(6, before, far) : before.by,
  };
  stops.push(final, { ...final });
  return stops;
}
