import { afterEach, describe, expect, it, vi } from "vitest";

import { sunAt } from "./sun";
import {
  deviceLocationGuess,
  guessLocation,
  parseTimeOverride,
  sunForDevice,
  withLocalTime,
} from "./where";

/** Makes the device report a time zone name and an offset (minutes east of UTC). */
function fakeDevice(timeZone: string | undefined, utcOffsetMinutes: number) {
  vi.spyOn(Intl, "DateTimeFormat").mockImplementation(
    () =>
      ({
        resolvedOptions: () => ({ timeZone }),
      }) as unknown as Intl.DateTimeFormat,
  );
  // getTimezoneOffset has the opposite sign: minutes west of UTC. The "|| 0" avoids -0.
  vi.spyOn(Date.prototype, "getTimezoneOffset").mockReturnValue(
    -utcOffsetMinutes || 0,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("guessLocation", () => {
  it("uses the table when the zone is known", () => {
    const at = guessLocation("Europe/London", 0);
    expect(at.lat).toBeCloseTo(51.5, 1);
    expect(at.lng).toBeCloseTo(-0.1, 1);
    // A known zone wins over a misleading offset.
    expect(guessLocation("Asia/Tokyo", -300).lng).toBeCloseTo(139.7, 0);
  });

  it("falls back to 15 degrees per hour at latitude 40", () => {
    expect(guessLocation(undefined, 0)).toEqual({ lat: 40, lng: 0 });
    expect(guessLocation(undefined, 60)).toEqual({ lat: 40, lng: 15 });
    expect(guessLocation(undefined, -300)).toEqual({ lat: 40, lng: -75 });
    expect(guessLocation(undefined, 330)).toEqual({ lat: 40, lng: 82.5 });
    expect(guessLocation("", 120)).toEqual({ lat: 40, lng: 30 });
    expect(guessLocation("Mars/Olympus_Mons", -480)).toEqual({
      lat: 40,
      lng: -120,
    });
    expect(guessLocation("UTC", 0)).toEqual({ lat: 40, lng: 0 });
  });

  it("keeps the fallback longitude inside -180..180", () => {
    expect(guessLocation(undefined, 720).lng).toBe(-180);
    expect(guessLocation(undefined, -720).lng).toBe(-180);
    expect(guessLocation(undefined, 840).lng).toBe(-150); // UTC+14, Kiritimati
    expect(guessLocation(undefined, 780).lng).toBe(-165); // UTC+13
    expect(guessLocation(undefined, -660).lng).toBe(-165); // UTC-11
  });

  it("treats a broken offset as UTC", () => {
    expect(guessLocation(undefined, NaN)).toEqual({ lat: 40, lng: 0 });
    expect(guessLocation(undefined, Infinity)).toEqual({ lat: 40, lng: 0 });
  });
});

describe("deviceLocationGuess", () => {
  it("returns a real place on this machine", () => {
    const at = deviceLocationGuess();
    expect(Math.abs(at.lat)).toBeLessThanOrEqual(90);
    expect(Math.abs(at.lng)).toBeLessThanOrEqual(180);
  });

  it("reads the device time zone", () => {
    fakeDevice("Australia/Sydney", 660);
    const at = deviceLocationGuess();
    expect(at.lat).toBeCloseTo(-33.9, 1);
    expect(at.lng).toBeCloseTo(151.2, 1);
  });

  it("falls back to the offset when the zone is unknown or missing", () => {
    fakeDevice("Etc/GMT-9", 540);
    expect(deviceLocationGuess()).toEqual({ lat: 40, lng: 135 });
    fakeDevice(undefined, -180);
    expect(deviceLocationGuess()).toEqual({ lat: 40, lng: -45 });
  });

  it("never throws when Intl is broken", () => {
    vi.spyOn(Intl, "DateTimeFormat").mockImplementation(() => {
      throw new Error("no Intl here");
    });
    vi.spyOn(Date.prototype, "getTimezoneOffset").mockReturnValue(-120);
    expect(deviceLocationGuess()).toEqual({ lat: 40, lng: 30 });
  });

  it("never throws when the clock is broken too", () => {
    vi.spyOn(Intl, "DateTimeFormat").mockImplementation(() => {
      throw new Error("no Intl here");
    });
    vi.spyOn(Date.prototype, "getTimezoneOffset").mockImplementation(() => {
      throw new Error("no clock here");
    });
    expect(deviceLocationGuess()).toEqual({ lat: 40, lng: 0 });
  });
});

describe("parseTimeOverride", () => {
  it("reads HH:MM", () => {
    expect(parseTimeOverride("19:45")).toEqual({ hours: 19, minutes: 45 });
    expect(parseTimeOverride("00:00")).toEqual({ hours: 0, minutes: 0 });
    expect(parseTimeOverride("23:59")).toEqual({ hours: 23, minutes: 59 });
    expect(parseTimeOverride("07:05")).toEqual({ hours: 7, minutes: 5 });
  });

  it("allows a single-digit hour and surrounding space", () => {
    expect(parseTimeOverride("7:05")).toEqual({ hours: 7, minutes: 5 });
    expect(parseTimeOverride(" 21:30 ")).toEqual({ hours: 21, minutes: 30 });
  });

  it("rejects times that do not exist", () => {
    expect(parseTimeOverride("24:00")).toBeNull();
    expect(parseTimeOverride("12:60")).toBeNull();
    expect(parseTimeOverride("99:99")).toBeNull();
  });

  it("rejects everything else", () => {
    for (const text of [
      "",
      "noon",
      "12",
      "1230",
      "12:3",
      "12:345",
      "123:45",
      "12:30:00",
      "-1:30",
      "12.30",
      "12:30pm",
      "1e1:30",
      ":30",
      "12:",
    ]) {
      expect(parseTimeOverride(text), JSON.stringify(text)).toBeNull();
    }
  });
});

describe("withLocalTime", () => {
  const at = (iso: string) => new Date(`${iso}Z`);

  it("sets the clock on the same day at UTC", () => {
    expect(
      withLocalTime(at("2026-11-10T09:17:42"), { hours: 21, minutes: 30 }, 0),
    ).toEqual(at("2026-11-10T21:30:00"));
  });

  it("uses the local calendar day east of Greenwich", () => {
    // 22:00 UTC on the 10th is already 09:00 on the 11th in Sydney (UTC+11).
    expect(
      withLocalTime(at("2026-11-10T22:00:00"), { hours: 12, minutes: 0 }, 660),
    ).toEqual(at("2026-11-11T01:00:00"));
  });

  it("uses the local calendar day west of Greenwich", () => {
    // 03:00 UTC on the 10th is still 19:00 on the 9th in Los Angeles (UTC-8).
    expect(
      withLocalTime(at("2026-11-10T03:00:00"), { hours: 6, minutes: 15 }, -480),
    ).toEqual(at("2026-11-09T14:15:00"));
  });

  it("handles half-hour offsets", () => {
    // India is UTC+5:30: local noon is 06:30 UTC.
    expect(
      withLocalTime(at("2026-11-10T12:00:00"), { hours: 12, minutes: 0 }, 330),
    ).toEqual(at("2026-11-10T06:30:00"));
  });

  it("does not change the date passed in", () => {
    const now = at("2026-11-10T09:17:42");
    withLocalTime(now, { hours: 1, minutes: 2 }, 60);
    expect(now).toEqual(at("2026-11-10T09:17:42"));
  });
});

describe("sunForDevice", () => {
  const now = new Date("2026-06-21T12:00:00Z");

  it("matches sunAt for the guessed location", () => {
    fakeDevice("Europe/London", 60);
    const sun = sunForDevice(now);
    const expected = sunAt(now, { lat: 51.5, lng: -0.1 });
    expect(sun.elevation).toBeCloseTo(expected.elevation, 5);
    expect(sun.morning).toBe(expected.morning);
    expect(Object.keys(sun).sort()).toEqual(["elevation", "morning"]);
  });

  it("is day in London and night in Sydney at the same instant", () => {
    fakeDevice("Europe/London", 60);
    expect(sunForDevice(now).elevation).toBeGreaterThan(55);
    fakeDevice("Australia/Sydney", 600);
    expect(sunForDevice(now).elevation).toBeLessThan(-18);
  });

  it("applies a time override on the local clock", () => {
    fakeDevice("Europe/London", 60); // British Summer Time
    const midnight = sunForDevice(now, { hours: 0, minutes: 30 });
    const morning = sunForDevice(now, { hours: 9, minutes: 0 });
    const evening = sunForDevice(now, { hours: 20, minutes: 0 });
    expect(midnight.elevation).toBeLessThan(-10);
    expect(morning.elevation).toBeGreaterThan(30);
    expect(morning.morning).toBe(true);
    expect(evening.elevation).toBeGreaterThan(0);
    expect(evening.elevation).toBeLessThan(15);
    expect(evening.morning).toBe(false);
  });

  it("ignores a null override", () => {
    fakeDevice("Europe/London", 60);
    expect(sunForDevice(now, null)).toEqual(sunForDevice(now));
  });

  it("never throws, even with a broken device or a bad date", () => {
    vi.spyOn(Intl, "DateTimeFormat").mockImplementation(() => {
      throw new Error("no Intl here");
    });
    expect(Number.isFinite(sunForDevice(now).elevation)).toBe(true);
    const fallback = sunForDevice(new Date(NaN));
    expect(Number.isFinite(fallback.elevation)).toBe(true);
    expect(typeof fallback.morning).toBe("boolean");
  });
});
