/**
 * Time-of-day lighting (art bible section 3.2).
 *
 * Painters draw in daylight palette colours and pass everything through a `Lighting`:
 *
 * - `light.env(c)` for anything lit by the sky: backdrops, exteriors, the park.
 * - `light.lit(c)` for anything under floodlights when they are on: pitch, stands, players.
 * - Light sources themselves (lamps, LED text, lit windows) keep their raw palette colour.
 *
 * Both functions are memoised and bound, so they can go straight into `Surface.recolor`:
 * `layer.recolor(light.env)`.
 *
 * - `distant(light, c, depth)` is `env` for things far away: the colour sinks towards the
 *   low sky with depth, which is how backdrops keep their planes apart.
 * - `skyFor(light)` is every colour of the sky itself, for `drawSky` and for painters that
 *   want to match it (haze, reflections, weather).
 *
 * A grade is five numbers applied in OKLab: lightness is scaled (the darks less than the
 * lights), chroma is scaled, and a tint is added. The numbers are set at a few key sun
 * elevations and interpolated between them, so the light changes smoothly through the day.
 * The sky works the same way: eight key skies a side, blended between.
 */

import {
  TRANSPARENT,
  clamp,
  luma,
  mix,
  smoothstep,
  toOklab,
  type Color,
} from "~/pixel";
import type { Sun } from "~/pixel";
import { P } from "./palette";

export type { Sun } from "~/pixel";

export type Phase = "night" | "dawn" | "day" | "dusk";

export interface Lighting {
  /** The sun this lighting was made for (elevation rounded to half a degree). */
  sun: Sun;
  phase: Phase;
  /** Floodlights and street lights. */
  lightsOn: boolean;
  /** Grade a daylight colour for things lit by the sky. */
  env(c: Color): Color;
  /** Grade a daylight colour for things under floodlights. Equals `env` when they are off. */
  lit(c: Color): Color;
}

/** Day at or above this elevation, night below its negative, dawn or dusk between. */
const DAY_ELEVATION = 6;
/** Floodlights and street lights come on below this elevation. */
const LIGHTS_ON_BELOW = 4;
/** The floodlights reach full strength this many degrees below that. */
const FLOOD_FADE = 8;

// ---------------------------------------------------------------------------
// Grades
// ---------------------------------------------------------------------------

/**
 * A grade, applied in OKLab. Lightness L becomes L * (dark + (bright - dark) * L): `dark`
 * is how much of their light the darkest colours keep and `bright` how much the lightest
 * keep, so a night grade dims the highlights hard and the shadows gently, and nothing is
 * ever lifted above its daylight value or crushed to black. Chroma is scaled by `sat`,
 * then the tint (ta, tb) is added.
 */
interface Grade {
  dark: number;
  bright: number;
  sat: number;
  ta: number;
  tb: number;
}

const IDENTITY: Grade = { dark: 1, bright: 1, sat: 1, ta: 0, tb: 0 };

type GradeKey = readonly [elevation: number, grade: Grade];

// night: deep blue, dark, never black
const NIGHT_GRADE: Grade = {
  dark: 0.84,
  bright: 0.52,
  sat: 0.48,
  ta: -0.008,
  tb: -0.064,
};

/** Sunset side. Highest elevation first. */
const EVENING: readonly GradeKey[] = [
  [20, IDENTITY],
  // golden hour: warm, a touch dimmer
  [6, { dark: 0.99, bright: 0.96, sat: 1.0, ta: 0.012, tb: 0.015 }],
  // sunset: orange going to rose
  [0, { dark: 0.97, bright: 0.86, sat: 0.94, ta: 0.034, tb: 0.012 }],
  // dusk: rose-violet, dimmer
  [-6, { dark: 0.92, bright: 0.7, sat: 0.76, ta: 0.02, tb: -0.04 }],
  [-18, NIGHT_GRADE],
];

/** Sunrise side: cooler and pinker than the evening. */
const MORNING: readonly GradeKey[] = [
  [20, IDENTITY],
  [6, { dark: 0.99, bright: 0.97, sat: 0.98, ta: 0.011, tb: 0.008 }],
  [0, { dark: 0.97, bright: 0.89, sat: 0.9, ta: 0.03, tb: -0.008 }],
  [-6, { dark: 0.92, bright: 0.73, sat: 0.76, ta: 0.014, tb: -0.05 }],
  [-18, NIGHT_GRADE],
];

/** Floodlights at full strength: bright, slightly cool, crisp (deeper darks). */
const FLOOD: Grade = {
  dark: 0.9,
  bright: 1.02,
  sat: 1.04,
  ta: -0.004,
  tb: -0.012,
};

function lerpGrade(a: Grade, b: Grade, t: number): Grade {
  if (t <= 0) return a;
  if (t >= 1) return b;
  return {
    dark: a.dark + (b.dark - a.dark) * t,
    bright: a.bright + (b.bright - a.bright) * t,
    sat: a.sat + (b.sat - a.sat) * t,
    ta: a.ta + (b.ta - a.ta) * t,
    tb: a.tb + (b.tb - a.tb) * t,
  };
}

/** Piecewise-linear lookup in a key table sorted from high elevation to low. */
function gradeAt(keys: readonly GradeKey[], elevation: number): Grade {
  if (elevation >= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [lo, loGrade] = keys[i];
    if (elevation >= lo) {
      const [hi, hiGrade] = keys[i - 1];
      return lerpGrade(loGrade, hiGrade, (elevation - lo) / (hi - lo));
    }
  }
  return keys[keys.length - 1][1];
}

// OKLab to sRGB (Björn Ottosson), kept here so a grade can pull chroma in until the colour
// fits the gamut instead of letting each channel clip, which would turn the hue.
function gamma(v: number): number {
  const e = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  return Math.round(clamp(e, 0, 1) * 255);
}

const EPS = 0.0008;
let linR = 0;
let linG = 0;
let linB = 0;

/** Sets linR, linG, linB for the colour with its chroma scaled by k. True if it is in gamut. */
function toLinear(L: number, a: number, b: number, k: number): boolean {
  const l = L + (0.3963377774 * a + 0.2158037573 * b) * k;
  const m = L - (0.1055613458 * a + 0.0638541728 * b) * k;
  const s = L - (0.0894841775 * a + 1.291485548 * b) * k;
  const l3 = l * l * l;
  const m3 = m * m * m;
  const s3 = s * s * s;
  linR = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  linG = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  linB = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3;
  return (
    linR >= -EPS &&
    linR <= 1 + EPS &&
    linG >= -EPS &&
    linG <= 1 + EPS &&
    linB >= -EPS &&
    linB <= 1 + EPS
  );
}

function fitOklab(L: number, a: number, b: number): Color {
  if (!toLinear(L, a, b, 1)) {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 12; i++) {
      const k = (lo + hi) / 2;
      if (toLinear(L, a, b, k)) lo = k;
      else hi = k;
    }
    toLinear(L, a, b, lo);
  }
  const packed =
    (0xff000000 | (gamma(linB) << 16) | (gamma(linG) << 8) | gamma(linR)) >>> 0;
  return packed as Color;
}

function applyGrade(grade: Grade, c: Color): Color {
  if (c === TRANSPARENT) return c;
  const [L, a, b] = toOklab(c);
  const outL = clamp(L * (grade.dark + (grade.bright - grade.dark) * L), 0, 1);
  // The tint is carried by the light, so darker surfaces pick up less of it.
  const carry = 0.35 + 0.65 * outL;
  return fitOklab(
    outL,
    a * grade.sat + grade.ta * carry,
    b * grade.sat + grade.tb * carry,
  );
}

function memo(grade: Grade): (c: Color) => Color {
  if (grade === IDENTITY) return (c) => c;
  const cache = new Map<Color, Color>();
  return (c) => {
    let out = cache.get(c);
    if (out === undefined) {
      out = applyGrade(grade, c);
      cache.set(c, out);
    }
    return out;
  };
}

// ---------------------------------------------------------------------------
// lightingFor
// ---------------------------------------------------------------------------

const lightings = new Map<number, Lighting>();

function phaseOf(elevation: number, morning: boolean): Phase {
  if (elevation >= DAY_ELEVATION) return "day";
  if (elevation < -DAY_ELEVATION) return "night";
  return morning ? "dawn" : "dusk";
}

/**
 * The lighting for a sun position. Elevation is rounded to half a degree and the result is
 * cached, so calling this every frame is free and equal suns give the very same object.
 */
export function lightingFor(sun: Sun): Lighting {
  const raw = Number.isFinite(sun.elevation) ? sun.elevation : 90;
  const steps = Math.round(clamp(raw, -90, 90) * 2);
  const morning = sun.morning === true;
  const key = steps * 2 + (morning ? 1 : 0);
  const cached = lightings.get(key);
  if (cached) return cached;

  const elevation = steps / 2;
  const lightsOn = elevation < LIGHTS_ON_BELOW;
  const envGrade = gradeAt(morning ? MORNING : EVENING, elevation);
  const env = memo(envGrade);
  // Floodlights fade up against the failing daylight: nothing at the moment they come on,
  // everything once the sky is dark.
  const flood = lightsOn
    ? clamp((LIGHTS_ON_BELOW - elevation) / FLOOD_FADE, 0, 1)
    : 0;
  const lit = flood > 0 ? memo(lerpGrade(envGrade, FLOOD, flood)) : env;

  const light: Lighting = Object.freeze({
    sun: Object.freeze({ elevation, morning }),
    phase: phaseOf(elevation, morning),
    lightsOn,
    env,
    lit,
  });
  lightings.set(key, light);
  return light;
}

// ---------------------------------------------------------------------------
// skyFor
// ---------------------------------------------------------------------------

/**
 * The four tones of a cloud, by position: the 1 px edge along its top, its upper mass, the
 * scalloped belly under that, and the flat line of its base. By day that runs light to
 * shade. At dusk and dawn the belly and base are the brightest parts, because the low sun
 * lights clouds from below.
 */
export type CloudTones = readonly [
  rim: Color,
  top: Color,
  mid: Color,
  under: Color,
];

/** Everything the sky painter needs for one sun position. All colours are final. */
export interface SkySpec {
  /** Seven flat band colours, zenith first, horizon last. */
  bands: readonly Color[];
  /** The six band boundaries as fractions of the sky height. Bands thin towards the horizon. */
  stops: readonly number[];
  /** The sun's disc. */
  sunDisc: Color;
  /** The sun's glow, inner ring then outer haze. `drawSky` blends both into the sky behind. */
  sunHalo: readonly Color[];
  /** The lit face of the moon. `drawSky` fades it into the sky behind by `moonVisibility`. */
  moon: Color;
  /** Craters and the moon's shaded limb. */
  moonShade: Color;
  /** The moon's faint halo. */
  moonHalo: Color;
  /** 0 hidden, 1 fully out. The moon appears a little before the stars. */
  moonVisibility: number;
  /** 0 no stars, 1 every star. */
  stars: number;
  /** Star colours: bright, medium, dim, and a warm one for the odd bright star. */
  starColors: readonly Color[];
  /** The big clouds high in the sky. */
  cloudNear: CloudTones;
  /** The small clouds low over the horizon. */
  cloudFar: CloudTones;
  /** The lightest cloud tone, for painters that draw their own weather. */
  cloudLight: Color;
  /** The darkest cloud tone. */
  cloudShade: Color;
  /** The colour of the glow on the horizon (the last band). */
  glow: Color;
  /** How far the bands arch up over the sun: 0 flat (day, night), 1 the full sunset. */
  glowStrength: number;
  /** Birds are out. */
  birds: boolean;
}

/** One key sky: what it looks like at one sun elevation. */
interface SkyKey {
  e: number;
  bands: readonly Color[];
  sun: Color;
  halo: readonly [Color, Color];
  near: CloudTones;
  far: CloudTones;
  glowStrength: number;
  /** Band boundaries. Default: `STOPS`. */
  stops?: readonly number[];
}

const BAND_COUNT = 7;

/** Day and night: the upper sky is wide and the bands crowd down towards the horizon. */
const STOPS: readonly number[] = Object.freeze([
  0.27, 0.47, 0.63, 0.76, 0.86, 0.94,
]);

/** Sunset and sunrise: the colour climbs higher up the sky. Still thinner towards the horizon. */
const TWILIGHT_STOPS: readonly number[] = Object.freeze([
  0.2, 0.38, 0.54, 0.68, 0.8, 0.91,
]);

function labDistance(a: Color, b: Color): number {
  const [l1, a1, b1] = toOklab(a);
  const [l2, a2, b2] = toOklab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

/**
 * Seven bands through the given anchors, zenith first. Every anchor is a band. The bands
 * left over go one at a time to whichever stretch between two anchors has the biggest step
 * left, so the steps from band to band come out as even as the anchors allow.
 */
function ramp(...anchors: Color[]): Color[] {
  const gaps = anchors.length - 1;
  const length: number[] = [];
  const extra: number[] = [];
  for (let i = 0; i < gaps; i++) {
    length.push(labDistance(anchors[i], anchors[i + 1]));
    extra.push(0);
  }
  for (let n = anchors.length; n < BAND_COUNT; n++) {
    let best = 0;
    for (let i = 1; i < gaps; i++) {
      if (length[i] / (extra[i] + 1) > length[best] / (extra[best] + 1)) {
        best = i;
      }
    }
    extra[best]++;
  }
  const out: Color[] = [];
  for (let i = 0; i < gaps; i++) {
    out.push(anchors[i]);
    for (let j = 1; j <= extra[i]; j++) {
      out.push(mix(anchors[i], anchors[i + 1], j / (extra[i] + 1)));
    }
  }
  out.push(anchors[gaps]);
  return out;
}

/** Cloud tones pulled towards a sky colour: far clouds are fainter. */
function faded(tones: CloudTones, sky: Color, amount: number): CloudTones {
  return [
    mix(tones[0], sky, amount),
    mix(tones[1], sky, amount),
    mix(tones[2], sky, amount),
    mix(tones[3], sky, amount),
  ];
}

const DAY_CLOUD: CloudTones = [
  P.cloudLight,
  P.cloudLight,
  P.cloud,
  P.cloudShade,
];

const NIGHT_KEY: SkyKey = {
  e: -18,
  bands: ramp(P.nightTop, P.nightMid, P.nightLow, P.nightGlow),
  sun: P.duskLow,
  halo: [P.nightGlow, P.nightLow],
  // Moonlit: a pale rim, a top a little lighter than the sky, a dark belly.
  near: [
    P.steel,
    mix(P.nightLow, P.nightGlow, 0.55),
    P.nightLow,
    mix(P.nightMid, P.nightLow, 0.45),
  ],
  // Silhouettes against the paler horizon.
  far: [
    mix(P.nightLow, P.nightGlow, 0.3),
    mix(P.nightMid, P.nightLow, 0.6),
    mix(P.nightMid, P.nightLow, 0.25),
    P.nightMid,
  ],
  glowStrength: 0,
};

const DAY_KEY: SkyKey = {
  e: 20,
  bands: ramp(P.skyTop, P.skyMid, P.skyLow, P.haze),
  sun: P.sun,
  halo: [P.haze, P.skyLow],
  near: DAY_CLOUD,
  far: faded(DAY_CLOUD, P.skyLow, 0.4),
  glowStrength: 0,
};

/** The four anchors of the low-sun sky on one side of the day. */
function lowSun(morning: boolean): [Color, Color, Color, Color] {
  return morning
    ? [P.dawnTop, P.dawnMid, P.dawnLow, P.dawnGlow]
    : [P.duskTop, P.duskMid, P.duskLow, P.duskGlow];
}

/**
 * Late afternoon (and mid morning): still a blue sky, but the horizon has gone from cool
 * haze to warm cream by way of a pale blush. Without this key, and without the blush, day
 * blue would fade into gold through grey-green.
 */
function paleKey(morning: boolean): SkyKey {
  const warm = morning ? P.dawnGlow : mix(P.dawnGlow, P.duskGlow, 0.35);
  const bands = ramp(
    mix(P.skyTop, morning ? P.dawnTop : P.duskTop, 0.12),
    mix(P.skyMid, P.dawnMid, 0.06),
    mix(P.skyLow, P.dawnMid, 0.1),
    mix(P.haze, P.dawnMid, 0.2),
    mix(P.haze, warm, 0.8),
  );
  const near: CloudTones = [
    P.white,
    P.white,
    mix(P.cloud, warm, 0.3),
    mix(P.cloudShade, P.dawnMid, 0.25),
  ];
  return {
    e: 12,
    bands,
    sun: P.sun,
    halo: [mix(P.white, warm, 0.5), warm],
    near,
    far: faded(near, bands[4], 0.4),
    glowStrength: 0.3,
  };
}

/** Golden hour: blue above, a rose band, then peach and pale gold around a low sun. */
function goldenKey(morning: boolean): SkyKey {
  const rose = mix(mix(P.dawnMid, P.dawnLow, 0.5), P.haze, 0.2);
  const low = morning
    ? mix(P.dawnLow, P.dawnGlow, 0.35)
    : mix(P.dawnLow, P.duskGlow, 0.35);
  const glow = morning
    ? mix(P.dawnGlow, P.white, 0.15)
    : mix(P.duskGlow, P.goldLight, 0.6);
  const bands = ramp(
    mix(P.skyTop, morning ? P.dawnTop : P.duskTop, 0.3),
    mix(P.skyMid, P.dawnMid, morning ? 0.2 : 0.26),
    rose,
    low,
    glow,
  );
  // Tops still catch the sun, bellies have gone to shade.
  const near: CloudTones = morning
    ? [
        P.white,
        mix(P.white, P.dawnGlow, 0.5),
        mix(P.dawnLow, P.dawnMid, 0.3),
        mix(P.dawnMid, P.cloudShade, 0.45),
      ]
    : [
        P.dawnGlow,
        P.dawnGlow,
        mix(P.dawnLow, P.dawnMid, 0.3),
        mix(P.dawnMid, P.cloudShade, 0.35),
      ];
  return {
    e: 6,
    bands,
    sun: morning ? P.white : P.sun,
    halo: morning ? [P.dawnGlow, P.dawnLow] : [P.goldLight, P.duskGlow],
    near,
    // Low clouds are already half in silhouette: soft mauve against the peach.
    far: [
      mix(P.dawnMid, low, 0.55),
      mix(P.dawnMid, low, 0.55),
      mix(P.dawnMid, low, 0.3),
      mix(low, glow, 0.5),
    ],
    glowStrength: 0.6,
  };
}

/** The sun on the horizon. */
function sunsetKey(morning: boolean): SkyKey {
  const [top, mid, low, glow] = lowSun(morning);
  const bands = ramp(
    mix(top, P.skyTop, 0.35),
    mix(mid, P.skyMid, 0.3),
    mix(low, glow, 0.3),
    mix(glow, P.goldLight, 0.25),
  );
  return {
    e: 0,
    stops: TWILIGHT_STOPS,
    bands,
    sun: P.sun,
    halo: [P.goldLight, glow],
    // High clouds catch the last sun on their bellies.
    near: [
      mix(P.dawnMid, glow, 0.45),
      mix(P.dawnMid, glow, 0.2),
      mix(P.dawnMid, low, 0.75),
      mix(glow, P.goldLight, 0.3),
    ],
    far: [
      mix(mid, top, 0.25),
      mix(mid, top, 0.25),
      mix(mid, low, 0.3),
      mix(low, glow, 0.5),
    ],
    glowStrength: 1,
  };
}

/** The art bible's dusk and dawn skies: the sun just under the horizon. */
function twilightKey(morning: boolean): SkyKey {
  const [top, mid, low, glow] = lowSun(morning);
  // Lighter than the band behind it, on either side of the day.
  const cloudTop = morning
    ? mix(P.dawnMid, P.dawnGlow, 0.45)
    : mix(P.duskMid, P.dawnMid, 0.6);
  return {
    e: -3,
    stops: TWILIGHT_STOPS,
    bands: ramp(top, mid, low, glow),
    sun: P.goldLight,
    halo: [glow, low],
    // The sun is under the horizon: tops have gone to dusk, bellies burn.
    near: [cloudTop, cloudTop, mix(mid, low, 0.8), mix(low, glow, 0.75)],
    // Low clouds are dark shapes against the glow, with an ember edge underneath.
    far: [
      mix(top, mid, 0.5),
      mix(top, mid, 0.5),
      mix(top, mid, 0.85),
      mix(mid, low, 0.6),
    ],
    glowStrength: 0.9,
  };
}

/** Afterglow: the same colours, sunk into the thin bands along the horizon. */
function afterglowKey(morning: boolean): SkyKey {
  const [top, mid, low, glow] = lowSun(morning);
  const deep = mix(top, P.nightMid, 0.4);
  return {
    e: -6,
    bands: ramp(
      deep,
      mix(top, mid, 0.3),
      mix(mid, low, 0.25),
      mix(low, mid, 0.12),
      mix(low, glow, 0.5),
    ),
    sun: low,
    halo: [low, mid],
    near: [
      mix(top, mid, 0.5),
      mix(top, mid, 0.5),
      mix(mid, low, 0.3),
      mix(low, glow, 0.2),
    ],
    far: [deep, deep, mix(deep, mid, 0.4), mix(mid, low, 0.5)],
    glowStrength: 0.7,
  };
}

/** Blue hour: night above, one ember line left on the horizon. */
function blueHourKey(morning: boolean): SkyKey {
  const [top, mid, low] = lowSun(morning);
  const dark = mix(P.nightMid, top, 0.4);
  return {
    e: -9,
    bands: ramp(
      dark,
      mix(P.nightLow, top, 0.6),
      mix(top, mid, 0.5),
      mix(mid, low, 0.45),
    ),
    sun: low,
    halo: [low, mid],
    // A last ember under the high clouds.
    near: [
      mix(mid, P.steel, 0.4),
      mix(top, mid, 0.35),
      mix(top, mid, 0.6),
      mix(mid, low, 0.3),
    ],
    far: [dark, dark, mix(dark, mid, 0.25), mix(mid, low, 0.25)],
    glowStrength: 0.5,
  };
}

function skyKeys(morning: boolean): readonly SkyKey[] {
  return [
    DAY_KEY,
    paleKey(morning),
    goldenKey(morning),
    sunsetKey(morning),
    twilightKey(morning),
    afterglowKey(morning),
    blueHourKey(morning),
    NIGHT_KEY,
  ];
}

const SKY_EVENING = skyKeys(false);
const SKY_MORNING = skyKeys(true);

function bracket(
  keys: readonly SkyKey[],
  elevation: number,
): [SkyKey, SkyKey, number] {
  if (elevation >= keys[0].e) return [keys[0], keys[0], 0];
  for (let i = 1; i < keys.length; i++) {
    if (elevation >= keys[i].e) {
      const hi = keys[i - 1];
      const lo = keys[i];
      return [lo, hi, (elevation - lo.e) / (hi.e - lo.e)];
    }
  }
  const last = keys[keys.length - 1];
  return [last, last, 0];
}

function mixTones(a: CloudTones, b: CloudTones, t: number): CloudTones {
  return Object.freeze([
    mix(a[0], b[0], t),
    mix(a[1], b[1], t),
    mix(a[2], b[2], t),
    mix(a[3], b[3], t),
  ]) as CloudTones;
}

const skies = new WeakMap<Lighting, SkySpec>();

/** The sky's colours for a lighting. Cached per `Lighting` object. */
export function skyFor(light: Lighting): SkySpec {
  const cached = skies.get(light);
  if (cached) return cached;

  const { elevation, morning } = light.sun;
  const [a, b, t] = bracket(morning ? SKY_MORNING : SKY_EVENING, elevation);
  const bands = a.bands.map((c, i) => mix(c, b.bands[i], t));

  // The moon fades up out of the sky as the sun goes down, and the stars follow it.
  const moonVisibility = smoothstep(-3, -9, elevation);
  const stars = clamp((-4 - elevation) / 12, 0, 1);
  const cloudNear = mixTones(a.near, b.near, t);
  const cloudFar = mixTones(a.far, b.far, t);
  const byLight = [...cloudNear].sort((x, y) => luma(x) - luma(y));

  const spec: SkySpec = Object.freeze({
    bands: Object.freeze(bands),
    stops: Object.freeze(
      STOPS.map((_, i) => {
        const from = (a.stops ?? STOPS)[i];
        const to = (b.stops ?? STOPS)[i];
        return from + (to - from) * t;
      }),
    ),
    sunDisc: mix(a.sun, b.sun, t),
    sunHalo: Object.freeze([
      mix(a.halo[0], b.halo[0], t),
      mix(a.halo[1], b.halo[1], t),
    ]),
    moon: P.moon,
    moonShade: P.moonShade,
    moonHalo: P.steel,
    moonVisibility,
    stars,
    starColors: Object.freeze([
      P.white,
      P.mist,
      P.steel,
      mix(P.white, P.goldLight, 0.6),
    ]),
    cloudNear,
    cloudFar,
    cloudLight: byLight[byLight.length - 1],
    cloudShade: byLight[0],
    glow: bands[bands.length - 1],
    glowStrength: a.glowStrength + (b.glowStrength - a.glowStrength) * t,
    birds: elevation >= 2,
  });
  skies.set(light, spec);
  return spec;
}

// ---------------------------------------------------------------------------
// Distance
// ---------------------------------------------------------------------------

const DEPTH_STEPS = 8;
/** How much of the sky the far horizon takes on. Never all of it: shapes must still read. */
const DEPTH_REACH = 0.75;
const distances = new WeakMap<Lighting, Map<number, Color>>();

/**
 * A daylight colour as it looks from far away in this light (art bible: depth by value).
 * It is graded by the sky like `env`, then pulled towards the colour of the low sky, so
 * far planes lose contrast and sink towards the horizon. `depth` 0 is right here (plain
 * `env`), 1 is the far horizon. Depth moves in eight steps and results are cached.
 */
export function distant(light: Lighting, c: Color, depth: number): Color {
  if (c === TRANSPARENT) return c;
  const step = Math.round(
    clamp(Number.isFinite(depth) ? depth : 0) * DEPTH_STEPS,
  );
  const near = light.env(c);
  if (step === 0) return near;
  let cache = distances.get(light);
  if (!cache) {
    cache = new Map();
    distances.set(light, cache);
  }
  const key = c * (DEPTH_STEPS + 1) + step;
  let out = cache.get(key);
  if (out === undefined) {
    const sky = skyFor(light).bands[BAND_COUNT - 2];
    out = mix(near, sky, (step / DEPTH_STEPS) * DEPTH_REACH);
    cache.set(key, out);
  }
  return out;
}
