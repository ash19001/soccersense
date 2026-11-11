/**
 * Where the sun is, for any time and place. Pure maths, no DOM, no clock: the date is passed in.
 *
 * The equations are NOAA's solar position algorithm (the Global Monitoring Laboratory solar
 * calculator, itself from Meeus, "Astronomical Algorithms"). Good to a few hundredths of a
 * degree for the years this game will see, which is far more than a pixel sky needs.
 */

import type { LatLng } from "~/game/types";

/**
 * What the lighting module needs to know about the sun. Structurally identical to the `Sun` in
 * `app/art/lighting.ts` (used by `ShotContext` in `app/pixel/shot.ts`), so values pass straight
 * through.
 */
export interface Sun {
  /** Degrees above the horizon; negative when the sun is down. */
  elevation: number;
  /** True before local solar noon (the sun is in the eastern half of the sky). */
  morning: boolean;
}

export interface SunPosition extends Sun {
  /** Compass bearing of the sun in degrees, clockwise from north: 90 is east, 180 is south. */
  azimuth: number;
}

export interface SunTimes {
  /** Null when the sun does not rise that day (polar night) or never sets (polar day). */
  sunrise: Date | null;
  /** Null when the sun does not set that day (polar day) or never rises (polar night). */
  sunset: Date | null;
  /** When the sun is highest. */
  solarNoon: Date;
}

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;
/** Julian day of the Unix epoch, 1970-01-01T00:00Z. */
const JD_UNIX_EPOCH = 2440587.5;
/** Julian day of J2000.0, 2000-01-01T12:00 TT. */
const JD_J2000 = 2451545;
/**
 * Zenith angle of the sun's centre at sunrise and sunset: 90 degrees, plus 34' of refraction
 * at the horizon, plus the 16' radius of the disc (the top edge is what appears first).
 */
const SUNRISE_ZENITH = 90.833;

const sin = (deg: number) => Math.sin(deg * RAD);
const cos = (deg: number) => Math.cos(deg * RAD);
const tan = (deg: number) => Math.tan(deg * RAD);
const clampUnit = (x: number) => Math.max(-1, Math.min(1, x));
/** Wraps into 0 (inclusive) to `m` (exclusive), for negative numbers too. */
const mod = (x: number, m: number) => ((x % m) + m) % m;

/** The two things about the sun that depend only on the instant, not on where you stand. */
interface Ephemeris {
  /** Degrees north of the celestial equator. */
  declination: number;
  /** Equation of time: apparent solar time minus mean solar time, in minutes. */
  equationOfTime: number;
}

function ephemeris(ms: number): Ephemeris {
  // Julian centuries since J2000.0
  const t = (ms / MS_PER_DAY + JD_UNIX_EPOCH - JD_J2000) / 36525;

  const meanLongitude = mod(280.46646 + t * (36000.76983 + t * 0.0003032), 360);
  const meanAnomaly = 357.52911 + t * (35999.05029 - 0.0001537 * t);
  const eccentricity = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
  const equationOfCentre =
    sin(meanAnomaly) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    sin(2 * meanAnomaly) * (0.019993 - 0.000101 * t) +
    sin(3 * meanAnomaly) * 0.000289;
  const trueLongitude = meanLongitude + equationOfCentre;

  // Nutation and aberration, to get the apparent longitude and the true obliquity.
  const omega = 125.04 - 1934.136 * t;
  const apparentLongitude = trueLongitude - 0.00569 - 0.00478 * sin(omega);
  const meanObliquity =
    23 +
    (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
  const obliquity = meanObliquity + 0.00256 * cos(omega);

  const declination =
    Math.asin(clampUnit(sin(obliquity) * sin(apparentLongitude))) * DEG;

  const y = tan(obliquity / 2) ** 2;
  const equationOfTime =
    4 *
    DEG *
    (y * sin(2 * meanLongitude) -
      2 * eccentricity * sin(meanAnomaly) +
      4 * eccentricity * y * sin(meanAnomaly) * cos(2 * meanLongitude) -
      0.5 * y * y * sin(4 * meanLongitude) -
      1.25 * eccentricity * eccentricity * sin(2 * meanAnomaly));

  return { declination, equationOfTime };
}

/**
 * How much the atmosphere lifts the sun, in degrees, for a true (airless) elevation.
 * NOAA's piecewise fit: about 0.57 degrees on the horizon, next to nothing overhead.
 */
function refraction(elevation: number): number {
  if (elevation > 85) return 0;
  const te = tan(elevation);
  let arcSeconds: number;
  if (elevation > 5) {
    arcSeconds = 58.1 / te - 0.07 / te ** 3 + 0.000086 / te ** 5;
  } else if (elevation > -0.575) {
    arcSeconds =
      1735 +
      elevation *
        (-518.2 +
          elevation * (103.4 + elevation * (-12.79 + elevation * 0.711)));
  } else {
    arcSeconds = -20.772 / te;
  }
  return arcSeconds / 3600;
}

/** Start of the UTC day containing `ms`, in ms since the epoch. */
function utcMidnight(ms: number): number {
  return Math.floor(ms / MS_PER_DAY) * MS_PER_DAY;
}

/**
 * The sun's position in the sky at `date`, seen from `loc`.
 *
 * - `elevation`: degrees above the horizon as it appears (refraction included). Negative at
 *   night: about -6 is the end of civil twilight, -18 is full dark.
 * - `azimuth`: degrees clockwise from north.
 * - `morning`: true before local solar noon.
 *
 * An invalid date gives NaN angles rather than throwing.
 */
export function sunAt(date: Date, loc: LatLng): SunPosition {
  const ms = date.getTime();
  const { declination, equationOfTime } = ephemeris(ms);

  // True solar time in minutes: noon (720) is when the sun crosses the meridian.
  const utcMinutes = (ms - utcMidnight(ms)) / MS_PER_MINUTE;
  const solarMinutes = mod(utcMinutes + equationOfTime + 4 * loc.lng, 1440);
  // Hour angle: 0 at solar noon, negative in the morning, 15 degrees per hour.
  const hourAngle = solarMinutes / 4 - 180;

  const lat = Math.max(-90, Math.min(90, loc.lat));
  const cosZenith = clampUnit(
    sin(lat) * sin(declination) + cos(lat) * cos(declination) * cos(hourAngle),
  );
  const zenith = Math.acos(cosZenith) * DEG;
  const trueElevation = 90 - zenith;

  // Azimuth from the horizontal components. atan2 stays well behaved at the poles and with
  // the sun overhead, where the textbook acos form divides by zero.
  const east = -cos(declination) * sin(hourAngle);
  const north =
    cos(lat) * sin(declination) - sin(lat) * cos(declination) * cos(hourAngle);
  const azimuth = mod(Math.atan2(east, north) * DEG, 360);

  return {
    elevation: trueElevation + refraction(trueElevation),
    azimuth,
    morning: hourAngle < 0,
  };
}

/**
 * Sunrise, solar noon and sunset for the UTC day containing `date`.
 *
 * `solarNoon` is that day's solar noon (within a quarter of an hour of the day's edges at the
 * date line, where it can just spill over). Sunrise and sunset are the ones either side of it, so east or west of Greenwich they can land in the neighbouring UTC day:
 * a Sydney summer sunrise is around 18:40 UTC on the day before. Both are null when the sun
 * stays up (polar day) or stays down (polar night); `sunAt` tells you which.
 *
 * Sunrise and sunset mean the top edge of the sun on a sea-level horizon, the almanac
 * convention. Good to about a minute outside the polar circles.
 */
export function sunTimes(date: Date, loc: LatLng): SunTimes {
  const day = utcMidnight(date.getTime());
  const lat = Math.max(-89.9, Math.min(89.9, loc.lat));
  // The table and callers keep longitude in -180..180, which puts solar noon inside the day.
  const lng = mod(loc.lng + 180, 360) - 180;

  /** Hour angle of sunrise in degrees for a declination, or null if the sun never crosses. */
  const horizonAngle = (declination: number): number | null => {
    const x =
      cos(SUNRISE_ZENITH) / (cos(lat) * cos(declination)) -
      tan(lat) * tan(declination);
    return x > 1 || x < -1 ? null : Math.acos(x) * DEG;
  };

  /**
   * The instant the sun is `side` times its horizon angle from the meridian: -1 sunrise,
   * 0 noon, +1 sunset. The declination and equation of time drift through the day, so start
   * from their values at 12:00 UTC and re-evaluate at each estimate until it settles.
   */
  const solve = (side: -1 | 0 | 1): number | null => {
    let ms = day + MS_PER_DAY / 2;
    for (let pass = 0; pass < 4; pass++) {
      const { declination, equationOfTime } = ephemeris(ms);
      let angle = 0;
      if (side !== 0) {
        const h = horizonAngle(declination);
        if (h === null) return null;
        angle = side * h;
      }
      const minutes = 720 - 4 * lng - equationOfTime + 4 * angle;
      ms = day + minutes * MS_PER_MINUTE;
    }
    return ms;
  };

  const noon = solve(0) as number;
  const rise = solve(-1);
  const set = solve(1);
  // Right at the edge of polar day or night one end can fail to converge. Then the sun is
  // only grazing the horizon, and "no sunrise or sunset" is the honest answer for both.
  const crosses = rise !== null && set !== null;
  return {
    sunrise: crosses ? new Date(rise) : null,
    sunset: crosses ? new Date(set) : null,
    solarNoon: new Date(noon),
  };
}

/** Mean length of a lunar month (new moon to new moon) in days. */
const SYNODIC_MONTH = 29.530588853;
/** A reference new moon: 2000-01-06T18:14Z. */
const NEW_MOON_EPOCH_MS = Date.UTC(2000, 0, 6, 18, 14);

/**
 * The moon's phase as a fraction of the lunar month: 0 new, 0.25 first quarter, 0.5 full,
 * 0.75 last quarter, never quite reaching 1. Uses the mean month, so it can be up to about
 * 14 hours (0.02) out: fine for choosing which moon sprite to draw.
 */
export function moonPhase(date: Date): number {
  const days = (date.getTime() - NEW_MOON_EPOCH_MS) / MS_PER_DAY;
  const phase = mod(days / SYNODIC_MONTH, 1);
  // mod can round up to exactly 1 for a tiny negative input.
  return phase >= 1 ? 0 : phase;
}
