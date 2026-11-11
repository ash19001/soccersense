import { describe, expect, it } from "vitest";

import {
  distanceKm,
  EARTH_RADIUS_KM,
  formatDistance,
  KM_PER_MILE,
  usesMiles,
} from "./geo";

const ANFIELD = { lat: 53.4308, lng: -2.9608 };

describe("distanceKm", () => {
  it("is zero between a point and itself", () => {
    expect(distanceKm(ANFIELD, ANFIELD)).toBe(0);
  });

  it("is symmetric", () => {
    const auckland = { lat: -36.8485, lng: 174.7633 };
    expect(distanceKm(ANFIELD, auckland)).toBe(distanceKm(auckland, ANFIELD));
  });

  it("measures one degree of the equator", () => {
    const d = distanceKm({ lat: 0, lng: 0 }, { lat: 0, lng: 1 });
    expect(d).toBeCloseTo((Math.PI * EARTH_RADIUS_KM) / 180, 9);
    expect(d).toBeCloseTo(111.195, 3);
  });

  it("measures half the globe between antipodes and between the poles", () => {
    const half = Math.PI * EARTH_RADIUS_KM;
    expect(distanceKm({ lat: 0, lng: 0 }, { lat: 0, lng: 180 })).toBeCloseTo(
      half,
      6,
    );
    expect(distanceKm({ lat: 90, lng: 0 }, { lat: -90, lng: 50 })).toBeCloseTo(
      half,
      6,
    );
    expect(
      distanceKm(
        { lat: 53.4308, lng: -2.9608 },
        { lat: -53.4308, lng: 177.0392 },
      ),
    ).toBeCloseTo(half, 6);
  });

  it("crosses the date line the short way", () => {
    const d = distanceKm({ lat: 0, lng: 179.5 }, { lat: 0, lng: -179.5 });
    expect(d).toBeCloseTo(111.195, 3);
  });

  it("is not rounded", () => {
    const d = distanceKm(ANFIELD, { lat: 53.4631, lng: -2.2913 });
    expect(Number.isInteger(d)).toBe(false);
  });

  it("agrees with well-known distances", () => {
    // London to Paris, usually quoted as 344 km.
    expect(
      distanceKm({ lat: 51.5074, lng: -0.1278 }, { lat: 48.8566, lng: 2.3522 }),
    ).toBeCloseTo(343.56, 1);
    // Anfield to Old Trafford: about 44 km. To central Auckland: about 18,160 km.
    expect(distanceKm(ANFIELD, { lat: 53.4631, lng: -2.2913 })).toBeCloseTo(
      44.5,
      0,
    );
    const auckland = distanceKm(ANFIELD, { lat: -36.8485, lng: 174.7633 });
    expect(auckland).toBeGreaterThan(18_100);
    expect(auckland).toBeLessThan(18_220);
  });
});

describe("usesMiles", () => {
  it.each([
    ["en-GB", true],
    ["en-US", true],
    ["en_US", true],
    ["en-gb", true],
    ["es-US", true],
    ["cy-GB", true],
    ["en-LR", true],
    ["my-MM", true],
    ["en-Latn-GB", true],
    ["en-GB-oxendict", true],
    ["en-US-u-hc-h12", true],
    ["en", true],
    ["EN", true],
    ["en-u-hc-h12", true],
    ["en-AU", false],
    ["en-CA", false],
    ["en-IE", false],
    ["en-NZ", false],
    ["en-001", false],
    ["fr", false],
    ["fr-FR", false],
    ["de-DE", false],
    ["es-419", false],
    ["zh-Hant-TW", false],
    ["sr-Latn-RS", false],
    ["my", false],
    ["de-u-co-phonebk", false],
    ["", false],
  ])("%s -> %s", (locale, expected) => {
    expect(usesMiles(locale)).toBe(expected);
  });
});

describe("formatDistance", () => {
  it("uses kilometres outside mile countries", () => {
    expect(formatDistance(5, "fr-FR")).toBe("5 km");
    expect(formatDistance(1, "de-DE")).toBe("1 km");
    expect(formatDistance(44.48, "en-AU")).toBe("44 km");
    expect(formatDistance(44.5, "en-AU")).toBe("45 km");
  });

  it("uses miles for en-GB, en-US and a bare en", () => {
    expect(formatDistance(5, "en-GB")).toBe("3 miles");
    expect(formatDistance(5, "en-US")).toBe("3 miles");
    expect(formatDistance(5, "en")).toBe("3 miles");
    expect(formatDistance(3.33, "en-GB")).toBe("2 miles");
  });

  it("says mile, not miles, for exactly one", () => {
    expect(formatDistance(KM_PER_MILE, "en-GB")).toBe("1 mile");
    expect(formatDistance(1, "en-GB")).toBe("1 mile");
    expect(formatDistance(2.4, "en-GB")).toBe("1 mile");
    expect(formatDistance(2.5, "en-GB")).toBe("2 miles");
  });

  it("adds thousands separators", () => {
    expect(formatDistance(11_589 * KM_PER_MILE, "en-GB")).toBe("11,589 miles");
    expect(formatDistance(18_163, "en-GB")).toBe("11,286 miles");
    expect(formatDistance(18_163, "fr-FR")).toBe("18,163 km");
    expect(formatDistance(999.4, "es-ES")).toBe("999 km");
    expect(formatDistance(1000, "es-ES")).toBe("1,000 km");
    expect(formatDistance(1_234_567, "es-ES")).toBe("1,234,567 km");
  });

  it("says under 1 below half a unit", () => {
    expect(formatDistance(0, "en-GB")).toBe("under 1 mile");
    expect(formatDistance(0.3, "en-GB")).toBe("under 1 mile");
    // 0.8 km is 0.497 miles; 0.81 km is 0.503 miles.
    expect(formatDistance(0.8, "en-GB")).toBe("under 1 mile");
    expect(formatDistance(0.81, "en-GB")).toBe("1 mile");
    expect(formatDistance(0, "fr-FR")).toBe("under 1 km");
    expect(formatDistance(0.49, "fr-FR")).toBe("under 1 km");
    expect(formatDistance(0.5, "fr-FR")).toBe("1 km");
  });

  it("treats nonsense as no distance at all", () => {
    expect(formatDistance(-4, "fr-FR")).toBe("under 1 km");
    expect(formatDistance(Number.NaN, "en-GB")).toBe("under 1 mile");
  });
});
