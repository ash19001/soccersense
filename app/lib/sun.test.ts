import { describe, expect, it } from "vitest";

import type { LatLng } from "~/game/types";

import { moonPhase, sunAt, sunTimes } from "./sun";

const LONDON: LatLng = { lat: 51.5074, lng: -0.1278 };
const SYDNEY: LatLng = { lat: -33.8688, lng: 151.2093 };
const QUITO: LatLng = { lat: -0.1807, lng: -78.4678 };
const REYKJAVIK: LatLng = { lat: 64.1466, lng: -21.9426 };
const TROMSO: LatLng = { lat: 69.6492, lng: 18.9553 };
const NEW_YORK: LatLng = { lat: 40.7128, lng: -74.006 };

const utc = (iso: string) => new Date(`${iso}Z`);
const minutesBetween = (a: Date, b: Date) =>
  Math.abs(a.getTime() - b.getTime()) / 60_000;

/** Asserts a time is present and within `tolerance` minutes of the almanac value. */
function expectNear(actual: Date | null, iso: string, tolerance = 6) {
  expect(actual).not.toBeNull();
  expect(minutesBetween(actual as Date, utc(iso))).toBeLessThan(tolerance);
}

describe("sunAt", () => {
  it("matches the midsummer noon elevation in London", () => {
    const sun = sunAt(utc("2026-06-21T12:00:00"), LONDON);
    expect(sun.elevation).toBeGreaterThan(61.6);
    expect(sun.elevation).toBeLessThan(62.2);
  });

  it("matches the midwinter noon elevation in London", () => {
    const sun = sunAt(utc("2026-12-21T12:00:00"), LONDON);
    expect(sun.elevation).toBeGreaterThan(14.7);
    expect(sun.elevation).toBeLessThan(15.4);
  });

  it("puts the sun below the horizon at midnight, even in June", () => {
    const sun = sunAt(utc("2026-06-21T00:00:00"), LONDON);
    expect(sun.elevation).toBeLessThan(-10);
    expect(sun.elevation).toBeGreaterThan(-20);
  });

  it("puts the sun overhead in Quito at an equinox noon", () => {
    const day = utc("2026-03-20T12:00:00");
    const { solarNoon } = sunTimes(day, QUITO);
    expect(sunAt(solarNoon, QUITO).elevation).toBeGreaterThan(89);
    // and still very high at the clock time of local noon
    expect(sunAt(utc("2026-03-20T17:14:00"), QUITO).elevation).toBeGreaterThan(
      87,
    );
  });

  it("finds a low afternoon sun in the south-west over New York", () => {
    // 16:00 EST on 15 January. Worked by hand from the day's declination (-21.1) and
    // equation of time (-9.3 min): hour angle 58.7, elevation about 7.7, azimuth about 233.5.
    const sun = sunAt(utc("2026-01-15T21:00:00"), NEW_YORK);
    expect(sun.elevation).toBeGreaterThan(7.2);
    expect(sun.elevation).toBeLessThan(8.3);
    expect(sun.azimuth).toBeGreaterThan(232);
    expect(sun.azimuth).toBeLessThan(235);
    expect(sun.morning).toBe(false);
  });

  it("flips morning at solar noon", () => {
    const { solarNoon } = sunTimes(utc("2026-06-21T12:00:00"), LONDON);
    const before = new Date(solarNoon.getTime() - 2 * 60_000);
    const after = new Date(solarNoon.getTime() + 2 * 60_000);
    expect(sunAt(before, LONDON).morning).toBe(true);
    expect(sunAt(after, LONDON).morning).toBe(false);
    expect(sunAt(utc("2026-06-21T06:00:00"), LONDON).morning).toBe(true);
    expect(sunAt(utc("2026-06-21T18:00:00"), LONDON).morning).toBe(false);
    // After midnight the sun is already heading for the next noon.
    expect(sunAt(utc("2026-06-21T01:00:00"), LONDON).morning).toBe(true);
  });

  it("is highest at solar noon", () => {
    const { solarNoon } = sunTimes(utc("2026-09-10T12:00:00"), SYDNEY);
    const at = (minutes: number) =>
      sunAt(new Date(solarNoon.getTime() + minutes * 60_000), SYDNEY).elevation;
    expect(at(0)).toBeGreaterThan(at(-20));
    expect(at(0)).toBeGreaterThan(at(20));
  });

  it("measures azimuth clockwise from north", () => {
    // Northern summer: rises in the north-east, due south at noon, sets in the north-west.
    expect(sunAt(utc("2026-06-21T04:00:00"), LONDON).azimuth).toBeGreaterThan(
      45,
    );
    expect(sunAt(utc("2026-06-21T04:00:00"), LONDON).azimuth).toBeLessThan(70);
    const { solarNoon } = sunTimes(utc("2026-06-21T12:00:00"), LONDON);
    expect(sunAt(solarNoon, LONDON).azimuth).toBeCloseTo(180, 0);
    expect(sunAt(utc("2026-06-21T20:00:00"), LONDON).azimuth).toBeGreaterThan(
      290,
    );
    // South of the tropics the noon sun is due north.
    const sydneyNoon = sunTimes(utc("2026-06-21T03:00:00"), SYDNEY).solarNoon;
    const az = sunAt(sydneyNoon, SYDNEY).azimuth;
    expect(Math.min(az, 360 - az)).toBeLessThan(1);
  });

  it("stays finite at the poles and with the sun overhead", () => {
    for (const loc of [
      { lat: 90, lng: 0 },
      { lat: -90, lng: 0 },
      { lat: 0, lng: 0 },
      { lat: 23.44, lng: 180 },
    ]) {
      const sun = sunAt(utc("2026-06-21T12:00:00"), loc);
      expect(Number.isFinite(sun.elevation)).toBe(true);
      expect(Number.isFinite(sun.azimuth)).toBe(true);
      expect(sun.azimuth).toBeGreaterThanOrEqual(0);
      expect(sun.azimuth).toBeLessThan(360);
    }
    // Midsummer at the north pole: the sun sits at the declination all day.
    expect(
      sunAt(utc("2026-06-21T12:00:00"), { lat: 90, lng: 0 }).elevation,
    ).toBeCloseTo(23.47, 0);
  });
});

describe("sunTimes", () => {
  it("matches the almanac for London at midsummer", () => {
    const t = sunTimes(utc("2026-06-21T12:00:00"), LONDON);
    expectNear(t.sunrise, "2026-06-21T03:43:00");
    expectNear(t.sunset, "2026-06-21T20:21:00");
    expectNear(t.solarNoon, "2026-06-21T12:02:00");
  });

  it("matches the almanac for London at midwinter", () => {
    const t = sunTimes(utc("2026-12-21T12:00:00"), LONDON);
    expectNear(t.sunrise, "2026-12-21T08:04:00");
    expectNear(t.sunset, "2026-12-21T15:53:00");
  });

  it("matches the almanac for New York in March", () => {
    const t = sunTimes(utc("2026-03-10T12:00:00"), NEW_YORK);
    expectNear(t.sunrise, "2026-03-10T11:15:00", 3);
    expectNear(t.solarNoon, "2026-03-10T17:06:00", 3);
    expectNear(t.sunset, "2026-03-10T22:57:00", 3);
  });

  it("gives the same answer for any time in the same UTC day", () => {
    const a = sunTimes(utc("2026-06-21T00:00:00"), LONDON);
    const b = sunTimes(utc("2026-06-21T23:59:59"), LONDON);
    expect(a.sunrise?.getTime()).toBe(b.sunrise?.getTime());
    expect(a.sunset?.getTime()).toBe(b.sunset?.getTime());
    expect(a.solarNoon.getTime()).toBe(b.solarNoon.getTime());
  });

  it("lets a Sydney sunrise fall in the previous UTC day", () => {
    const t = sunTimes(utc("2026-12-21T02:00:00"), SYDNEY);
    expectNear(t.sunrise, "2026-12-20T18:41:00");
    expectNear(t.sunset, "2026-12-21T09:05:00");
    expect(t.solarNoon.toISOString().slice(0, 10)).toBe("2026-12-21");
  });

  it("puts the sun on the horizon at sunrise and sunset", () => {
    for (const loc of [LONDON, SYDNEY, QUITO, NEW_YORK]) {
      const t = sunTimes(utc("2026-04-10T12:00:00"), loc);
      for (const when of [t.sunrise, t.sunset]) {
        expect(when).not.toBeNull();
        // The top edge is on the horizon: the centre is half a degree down, as it appears.
        const elevation = sunAt(when as Date, loc).elevation;
        expect(elevation).toBeGreaterThan(-0.7);
        expect(elevation).toBeLessThan(-0.2);
      }
      expect(sunAt(t.sunrise as Date, loc).morning).toBe(true);
      expect(sunAt(t.sunset as Date, loc).morning).toBe(false);
    }
  });

  it("gives Reykjavik a very short December day", () => {
    const t = sunTimes(utc("2026-12-21T12:00:00"), REYKJAVIK);
    expectNear(t.sunrise, "2026-12-21T11:22:00", 10);
    expectNear(t.sunset, "2026-12-21T15:30:00", 10);
    const hours = minutesBetween(t.sunrise as Date, t.sunset as Date) / 60;
    expect(hours).toBeGreaterThan(3.5);
    expect(hours).toBeLessThan(4.75);
  });

  it("has no sunset in Tromso in late June", () => {
    const t = sunTimes(utc("2026-06-25T12:00:00"), TROMSO);
    expect(t.sunrise).toBeNull();
    expect(t.sunset).toBeNull();
    expect(Number.isFinite(t.solarNoon.getTime())).toBe(true);
    // Midnight sun: still up at local midnight.
    expect(sunAt(utc("2026-06-25T22:45:00"), TROMSO).elevation).toBeGreaterThan(
      0,
    );
  });

  it("has no sunrise in Tromso in late December", () => {
    const t = sunTimes(utc("2026-12-21T12:00:00"), TROMSO);
    expect(t.sunrise).toBeNull();
    expect(t.sunset).toBeNull();
    expect(sunAt(t.solarNoon, TROMSO).elevation).toBeLessThan(0);
  });
});

describe("moonPhase", () => {
  // Eclipses pin the phase exactly: a solar eclipse is a new moon, a lunar one a full moon.
  const distance = (a: number, b: number) => {
    const d = Math.abs(a - b) % 1;
    return Math.min(d, 1 - d);
  };

  it("is new at the solar eclipses of 2024-04-08 and 2026-08-12", () => {
    expect(distance(moonPhase(utc("2024-04-08T18:21:00")), 0)).toBeLessThan(
      0.05,
    );
    expect(distance(moonPhase(utc("2026-08-12T17:37:00")), 0)).toBeLessThan(
      0.05,
    );
  });

  it("is full at the lunar eclipses of 2025-09-07 and 2026-03-03", () => {
    expect(distance(moonPhase(utc("2025-09-07T18:09:00")), 0.5)).toBeLessThan(
      0.05,
    );
    expect(distance(moonPhase(utc("2026-03-03T11:38:00")), 0.5)).toBeLessThan(
      0.05,
    );
  });

  it("waxes: a week after new it is near first quarter, three weeks after near last", () => {
    expect(distance(moonPhase(utc("2026-08-20T00:00:00")), 0.25)).toBeLessThan(
      0.05,
    );
    expect(distance(moonPhase(utc("2026-09-03T18:00:00")), 0.75)).toBeLessThan(
      0.05,
    );
  });

  it("stays in 0..1, including before the reference epoch", () => {
    for (const iso of [
      "1969-07-20T20:17:00",
      "2000-01-06T18:14:00",
      "2026-11-10T00:00:00",
      "2100-01-01T00:00:00",
    ]) {
      const phase = moonPhase(utc(iso));
      expect(phase).toBeGreaterThanOrEqual(0);
      expect(phase).toBeLessThan(1);
    }
  });
});
