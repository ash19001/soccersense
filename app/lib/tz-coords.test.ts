import { describe, expect, it } from "vitest";

import { TIME_ZONE_COUNT, coordsForTimeZone } from "./tz-coords";

/** Asserts a zone resolves to within `tolerance` degrees of a known city. */
function expectAt(tz: string, lat: number, lng: number, tolerance = 0.3) {
  const at = coordsForTimeZone(tz);
  expect(at, tz).not.toBeNull();
  expect(Math.abs((at?.lat ?? NaN) - lat), `${tz} lat`).toBeLessThan(tolerance);
  expect(Math.abs((at?.lng ?? NaN) - lng), `${tz} lng`).toBeLessThan(tolerance);
}

describe("coordsForTimeZone", () => {
  it("finds the principal city of common zones", () => {
    expectAt("Europe/London", 51.5, -0.1);
    expectAt("America/New_York", 40.7, -74.0);
    expectAt("Asia/Kolkata", 22.5, 88.4);
    expectAt("Australia/Sydney", -33.9, 151.2);
    expectAt("Asia/Tokyo", 35.7, 139.7);
    expectAt("America/Los_Angeles", 34.1, -118.2);
    expectAt("America/Sao_Paulo", -23.5, -46.6);
    expectAt("Africa/Lagos", 6.5, 3.4);
    expectAt("Pacific/Auckland", -36.9, 174.8);
  });

  it("keeps the own coordinates of zones that share a clock with a neighbour", () => {
    // These are links to Berlin and Brussels in the tz database, but browsers report them.
    expectAt("Europe/Stockholm", 59.3, 18.1);
    expectAt("Europe/Oslo", 59.9, 10.8);
    expectAt("Europe/Amsterdam", 52.4, 4.9);
    expectAt("Atlantic/Reykjavik", 64.2, -21.9);
  });

  it("resolves old names to the same place as the new ones", () => {
    expect(coordsForTimeZone("Asia/Calcutta")).toEqual(
      coordsForTimeZone("Asia/Kolkata"),
    );
    expect(coordsForTimeZone("Europe/Kiev")).toEqual(
      coordsForTimeZone("Europe/Kyiv"),
    );
    expect(coordsForTimeZone("Asia/Saigon")).toEqual(
      coordsForTimeZone("Asia/Ho_Chi_Minh"),
    );
    expect(coordsForTimeZone("America/Buenos_Aires")).toEqual(
      coordsForTimeZone("America/Argentina/Buenos_Aires"),
    );
    expect(coordsForTimeZone("US/Pacific")).toEqual(
      coordsForTimeZone("America/Los_Angeles"),
    );
    expect(coordsForTimeZone("GB")).toEqual(coordsForTimeZone("Europe/London"));
    // An old name whose link target is a merged zone far away still lands at home.
    expectAt("Iceland", 64.2, -21.9);
  });

  it("handles three-part names", () => {
    expectAt("America/Argentina/Buenos_Aires", -34.6, -58.4);
    expectAt("America/Indiana/Indianapolis", 39.8, -86.2);
  });

  it("ignores case and surrounding space", () => {
    expect(coordsForTimeZone(" europe/london ")).toEqual(
      coordsForTimeZone("Europe/London"),
    );
  });

  it("returns null for zones with no place on the map", () => {
    expect(coordsForTimeZone("Mars/Olympus_Mons")).toBeNull();
    expect(coordsForTimeZone("UTC")).toBeNull();
    expect(coordsForTimeZone("Etc/GMT-5")).toBeNull();
    expect(coordsForTimeZone("Europe")).toBeNull();
    expect(coordsForTimeZone("Europe/")).toBeNull();
    expect(coordsForTimeZone("")).toBeNull();
  });

  it("returns a fresh object each time", () => {
    const a = coordsForTimeZone("Europe/London");
    const b = coordsForTimeZone("Europe/London");
    expect(a).not.toBe(b);
    if (a) a.lat = 0;
    expect(coordsForTimeZone("Europe/London")?.lat).toBeCloseTo(51.5, 1);
  });

  it("covers the whole tz database with sane coordinates", () => {
    expect(TIME_ZONE_COUNT).toBeGreaterThan(450);
    const everyZone = Intl.supportedValuesOf("timeZone");
    expect(everyZone.length).toBeGreaterThan(300);
    const missing = everyZone.filter(
      (tz) => !tz.startsWith("Etc/") && coordsForTimeZone(tz) === null,
    );
    // Only clock-only names (UTC, GMT and the like) may be absent.
    expect(missing.filter((tz) => tz.includes("/"))).toEqual([]);
    for (const tz of everyZone) {
      const at = coordsForTimeZone(tz);
      if (!at) continue;
      expect(Math.abs(at.lat), tz).toBeLessThanOrEqual(90);
      expect(Math.abs(at.lng), tz).toBeLessThanOrEqual(180);
    }
  });
});
