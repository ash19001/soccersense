import type { LatLng } from "./types";

/** Mean Earth radius (IUGG), in kilometres. */
export const EARTH_RADIUS_KM = 6371.0088;

export const KM_PER_MILE = 1.609344;

const RAD = Math.PI / 180;

/** Great-circle distance in kilometres (haversine), unrounded. */
export function distanceKm(a: LatLng, b: LatLng): number {
  const lat1 = a.lat * RAD;
  const lat2 = b.lat * RAD;
  const dLat = lat2 - lat1;
  const dLng = (b.lng - a.lng) * RAD;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  // Rounding can push h a hair outside 0..1 for identical or antipodal points.
  return (
    2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))))
  );
}

/** Regions that put miles on their road signs. */
const MILE_REGIONS = new Set(["US", "GB", "LR", "MM"]);

/**
 * Whether distances should be shown in miles for a BCP 47 locale ("en-GB", "en_US",
 * "sr-Latn-RS"). Decided by the region subtag. A bare "en" has no region and is taken to be a
 * UK or US device, so it is true; every other locale without a region is false.
 */
export function usesMiles(locale: string): boolean {
  // A device can fail to report a locale at all: kilometres then.
  if (typeof locale !== "string") return false;
  const parts = locale.trim().split(/[-_]/);
  const language = (parts[0] ?? "").toLowerCase();
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    // Extensions and private use ("-u-", "-x-") end the language-script-region part.
    if (part.length === 1) break;
    if (/^[a-z]{2}$/i.test(part)) return MILE_REGIONS.has(part.toUpperCase());
    // A numeric region such as 001 (world) or 419 (Latin America).
    if (/^\d{3}$/.test(part)) return false;
  }
  return language === "en";
}

function group(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * A distance for display, in the locale's unit: "3 miles", "1 mile", "11,589 miles", "5 km".
 * Anything that would round to zero reads "under 1 mile" or "under 1 km".
 *
 * The number always uses a comma as the thousands separator: the interface is English only in
 * this iteration, and a fixed format keeps the function deterministic everywhere.
 */
export function formatDistance(km: number, locale: string): string {
  const miles = usesMiles(locale);
  const safeKm = Number.isFinite(km) ? Math.max(0, km) : 0;
  const value = miles ? safeKm / KM_PER_MILE : safeKm;
  if (value < 0.5) return miles ? "under 1 mile" : "under 1 km";
  const whole = Math.round(value);
  if (!miles) return `${group(whole)} km`;
  return whole === 1 ? "1 mile" : `${group(whole)} miles`;
}
