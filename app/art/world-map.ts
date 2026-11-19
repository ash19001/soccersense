/**
 * The world, for CLOSEST's and FURTHEST's map (app/scenes/map.ts): where the land is, half a
 * degree at a time (./world-map-data.ts, made by tools/world-map.ts from Natural Earth's
 * public-domain land), and the few sums on a globe the map needs: the point on the way from
 * one place to another, a point a given distance away in a given direction, and the place on
 * the other side of the world. Pure.
 */

import {
  WORLD_COLS,
  WORLD_NORTH,
  WORLD_PER_DEGREE,
  WORLD_ROWS,
  WORLD_RUNS,
  WORLD_SOUTH,
} from "./world-map-data";

export { WORLD_NORTH, WORLD_SOUTH };

/** A place on the globe, in degrees: north and east positive. */
export interface GeoPoint {
  lat: number;
  lng: number;
}

/** The Earth's mean radius, in kilometres (as `distanceKm` in ~/game uses). */
export const EARTH_KM = 6371;

let land: Uint8Array | null = null;

/** The land and sea, one byte a cell (1 land), row by row from the north; read once. */
export function worldLand(): Uint8Array {
  if (land) return land;
  const cells = new Uint8Array(WORLD_COLS * WORLD_ROWS);
  const rows = WORLD_RUNS.split("|");
  for (let row = 0; row < WORLD_ROWS; row++) {
    let col = 0;
    let value = 0;
    for (const run of (rows[row] ?? "").split(",")) {
      const length = parseInt(run, 36) || 0;
      if (value === 1)
        cells.fill(1, row * WORLD_COLS + col, row * WORLD_COLS + col + length);
      col += length;
      value = 1 - value;
    }
  }
  land = cells;
  return cells;
}

/** A longitude brought into -180 (included) to 180 (left out). */
export function wrapLng(lng: number): number {
  const x = (((lng + 180) % 360) + 360) % 360;
  return x - 180;
}

/** Whether there is land at a place. Off the map's north and south: sea. */
export function isLand(lat: number, lng: number): boolean {
  if (!(lat < WORLD_NORTH) || !(lat >= WORLD_SOUTH)) return false;
  const row = Math.floor((WORLD_NORTH - lat) * WORLD_PER_DEGREE);
  const col = Math.floor((wrapLng(lng) + 180) * WORLD_PER_DEGREE);
  return worldLand()[row * WORLD_COLS + Math.min(col, WORLD_COLS - 1)] === 1;
}

const RAD = Math.PI / 180;

function toVector(p: GeoPoint): [number, number, number] {
  const lat = p.lat * RAD;
  const lng = p.lng * RAD;
  return [
    Math.cos(lat) * Math.cos(lng),
    Math.cos(lat) * Math.sin(lng),
    Math.sin(lat),
  ];
}

function fromVector(x: number, y: number, z: number): GeoPoint {
  const r = Math.hypot(x, y, z) || 1;
  return {
    lat: Math.asin(Math.max(-1, Math.min(1, z / r))) / RAD,
    lng: Math.atan2(y, x) / RAD,
  };
}

/**
 * The point `t` of the way along the shortest path over the globe from `a` to `b` (0 is
 * `a`, 1 is `b`). Places on exactly opposite sides of the world have no shortest path: the
 * way then goes over the north.
 */
export function alongGreatCircle(
  a: GeoPoint,
  b: GeoPoint,
  t: number,
): GeoPoint {
  const va = toVector(a);
  let vb = toVector(b);
  let dot = va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2];
  if (dot < -0.999999) {
    // opposite: by way of the pole, a quarter of the way round from a
    const pole = toVector({ lat: 90, lng: 0 });
    const half = alongGreatCircle(a, fromVector(...pole), Math.min(1, t * 2));
    if (t <= 0.5) return half;
    return alongGreatCircle(fromVector(...pole), b, (t - 0.5) * 2);
  }
  dot = Math.max(-1, Math.min(1, dot));
  const angle = Math.acos(dot);
  if (angle < 1e-9) return { lat: a.lat, lng: a.lng };
  const sin = Math.sin(angle);
  const wa = Math.sin((1 - t) * angle) / sin;
  const wb = Math.sin(t * angle) / sin;
  vb = [
    va[0] * wa + vb[0] * wb,
    va[1] * wa + vb[1] * wb,
    va[2] * wa + vb[2] * wb,
  ];
  return fromVector(vb[0], vb[1], vb[2]);
}

/** The place `km` away from `from`, setting off at `bearing` degrees (0 north, 90 east). */
export function destination(
  from: GeoPoint,
  bearing: number,
  km: number,
): GeoPoint {
  const d = km / EARTH_KM;
  const lat = from.lat * RAD;
  const lng = from.lng * RAD;
  const b = bearing * RAD;
  const lat2 = Math.asin(
    Math.sin(lat) * Math.cos(d) + Math.cos(lat) * Math.sin(d) * Math.cos(b),
  );
  const lng2 =
    lng +
    Math.atan2(
      Math.sin(b) * Math.sin(d) * Math.cos(lat),
      Math.cos(d) - Math.sin(lat) * Math.sin(lat2),
    );
  return { lat: lat2 / RAD, lng: wrapLng(lng2 / RAD) };
}

/** The place on the other side of the world: as far from `p` as anywhere can be. */
export function antipode(p: GeoPoint): GeoPoint {
  return { lat: -p.lat, lng: wrapLng(p.lng + 180) };
}
