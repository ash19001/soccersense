/**
 * A rough guess at where the player is, with no location permission prompt: the device's time
 * zone names a region, and the region has a principal city. That is close enough to paint the
 * right sky (day, dusk, night or dawn) behind the stadium.
 *
 * In this file a **UTC offset** is always minutes east of UTC, local time minus UTC: +60 for
 * Paris in winter, -300 for New York in winter. That is the opposite sign to
 * `Date.prototype.getTimezoneOffset()`.
 */

import type { LatLng } from "~/game/types";

import { sunAt, type Sun } from "./sun";
import { coordsForTimeZone } from "./tz-coords";

/** A clock time on the player's wall: the `?time=HH:MM` debug override. */
export interface TimeOverride {
  /** 0 to 23. */
  hours: number;
  /** 0 to 59. */
  minutes: number;
}

/** Used when the time zone is unknown: roughly where most players live, north or south. */
const FALLBACK_LATITUDE = 40;
const MS_PER_MINUTE = 60_000;

/**
 * Where the player probably is. Pure.
 *
 * Looks the IANA time zone name up in the table. When the name is missing or unknown, falls
 * back to the longitude the UTC offset implies (15 degrees per hour, east positive) at
 * latitude 40.
 *
 * @param timeZone IANA name such as "Europe/London", or undefined
 * @param utcOffsetMinutes minutes east of UTC (local minus UTC)
 */
export function guessLocation(
  timeZone: string | undefined,
  utcOffsetMinutes: number,
): LatLng {
  const known = timeZone ? coordsForTimeZone(timeZone) : null;
  if (known) return known;

  const offset = Number.isFinite(utcOffsetMinutes) ? utcOffsetMinutes : 0;
  // 15 degrees per hour is 1 degree per 4 minutes. UTC+14 would be 210 east: wrap it round.
  const lng = ((((offset / 4 + 180) % 360) + 360) % 360) - 180;
  return { lat: FALLBACK_LATITUDE, lng };
}

/**
 * The device's UTC offset at `at`, in minutes east of UTC. Zero if it cannot be read.
 * Reads the device's time zone settings, so the answer is only meaningful in the browser.
 */
function deviceUtcOffsetMinutes(at: Date): number {
  try {
    const offset = -at.getTimezoneOffset();
    return Number.isFinite(offset) ? offset : 0;
  } catch {
    return 0;
  }
}

/**
 * Where this device probably is, from its time zone setting.
 *
 * **Browser only.** It reads `Intl` and the device clock, so call it from an effect or an
 * event handler, never during render: at build time it would describe the build machine.
 * Never throws: if the time zone cannot be read it falls back to the UTC offset, then to
 * the Greenwich meridian.
 */
export function deviceLocationGuess(): LatLng {
  let timeZone: string | undefined;
  try {
    const zone: unknown = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (typeof zone === "string") timeZone = zone;
  } catch {
    timeZone = undefined;
  }
  try {
    return guessLocation(timeZone, deviceUtcOffsetMinutes(new Date()));
  } catch {
    return { lat: FALLBACK_LATITUDE, lng: 0 };
  }
}

/**
 * Reads a 24-hour clock time: "19:45", "07:05", "7:05". Returns null for anything else,
 * including times that do not exist ("24:00", "12:60").
 */
export function parseTimeOverride(text: string): TimeOverride | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(text.trim());
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (hours > 23 || minutes > 59) return null;
  return { hours, minutes };
}

/**
 * The instant that is `override` on the clock, on the same local calendar day as `now`.
 * Pure: the offset is passed in, so the device's own time zone plays no part.
 *
 * @param utcOffsetMinutes minutes east of UTC (local minus UTC), as for `guessLocation`
 */
export function withLocalTime(
  now: Date,
  override: TimeOverride,
  utcOffsetMinutes: number,
): Date {
  const offsetMs =
    (Number.isFinite(utcOffsetMinutes) ? utcOffsetMinutes : 0) * MS_PER_MINUTE;
  // Shift so the UTC fields read as local wall-clock time, set the clock, then shift back.
  const local = new Date(now.getTime() + offsetMs);
  local.setUTCHours(override.hours, override.minutes, 0, 0);
  return new Date(local.getTime() - offsetMs);
}

/**
 * The sun as this device's owner would see it: guesses the location from the time zone and
 * works out the sun's position for `now`, or for today at `override` on the local clock.
 *
 * **Browser only**, for the same reason as `deviceLocationGuess`. Never throws: if anything
 * goes wrong the answer is a plain mid-morning sun.
 */
export function sunForDevice(now: Date, override?: TimeOverride | null): Sun {
  try {
    const loc = deviceLocationGuess();
    const when = override
      ? withLocalTime(now, override, deviceUtcOffsetMinutes(now))
      : now;
    const { elevation, morning } = sunAt(when, loc);
    if (Number.isFinite(elevation)) return { elevation, morning };
  } catch {
    // fall through to the default
  }
  return { elevation: 40, morning: true };
}
