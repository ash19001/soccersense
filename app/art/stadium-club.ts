/**
 * The club's colours: the home-screen stadium wears a different club's colours each day.
 *
 * A scheme is two ramps, `main` (the outer walls, most of the crowd, the home side's
 * shirts, the flags, the airship's fins, the bunting and awnings round the town) and
 * `second` (the wall's trim band, the crowd's scarves and accents, the second flag, the
 * shorts), plus the away side's ramp, picked so it never clashes with the home colours.
 * The menu ball's HOME and AWAY colours never change: they are the modes'.
 *
 * It is a palette swap, as an old cartridge game swapped a kit: the stadium's painters
 * paint the club in the HOME ramp (`P.home`...) and the visitors in the AWAY ramp
 * (`P.away`...), as they always did, and `clubLight` wraps the lighting so that every
 * colour graded through `env` or `lit` comes out in the day's scheme. What is drawn raw
 * (lamps, fireworks, flares) asks `clubRaw(light)`; what needs the second colour asks
 * `clubOf(light)`.
 *
 * The product owner's rule: never a scheme of dark blue and white (it must never look like
 * the flag of Israel). To be safe no scheme pairs any blue with white at all, and blue is
 * never a main colour (the roof ring is pale: a blue bowl inside it would read as blue,
 * white, blue). A test holds every scheme to it.
 */

import { toOklab, type Color } from "~/pixel";
import type { Lighting } from "~/art/lighting";
import { CLUB, P } from "~/art/palette";

export interface Ramp {
  dark: Color;
  base: Color;
  light: Color;
}

export interface ClubScheme {
  /** A stable id, for `MenuBackdrop.setScheme`. */
  id: string;
  /** Its colours in words, for shots and tests: "RED AND WHITE". */
  name: string;
  /** The club's main colour: walls, most of the crowd, shirts, flags, bunting. */
  main: Ramp;
  /** The second colour: trims, scarves, the second flag, shorts. */
  second: Ramp;
  /** The visitors' ramp in the match, their end and their coaches: clear of the home colours. */
  away: Ramp;
  /** The home side's kit in the match: never white (the ball is the only white thing moving), never grass green. */
  kit: { shirt: Color; shorts: Color };
  /** The light tones for fireworks and ticker tape: the second colour, or gold when it is dark. */
  bright: Ramp;
  /** The fireworks' other colour: the main colour, or gold when it is dark. */
  spark: Ramp;
}

const ramp = (dark: Color, base: Color, light: Color): Ramp =>
  Object.freeze({ dark, base, light });

const RED = ramp(P.homeDark, P.home, P.homeLight);
const TEAL = ramp(P.awayDark, P.away, P.awayLight);
const GOLD = ramp(P.goldDark, P.gold, P.goldLight);
const CRIMSON = ramp(CLUB.crimsonDark, CLUB.crimson, CLUB.crimsonLight);
const CLARET = ramp(CLUB.claretDark, CLUB.claret, CLUB.claretLight);
const SKY = ramp(CLUB.skyBlueDark, CLUB.skyBlue, CLUB.skyBlueLight);
const CANARY = ramp(CLUB.canaryDark, CLUB.canary, CLUB.canaryLight);
const FOREST = ramp(CLUB.forestDark, CLUB.forest, CLUB.forestLight);
const EMERALD = ramp(CLUB.emeraldDark, CLUB.emerald, CLUB.emeraldLight);
const CHARCOAL = ramp(CLUB.charcoalDark, CLUB.charcoal, CLUB.charcoalLight);
const SNOW = ramp(CLUB.snowDark, CLUB.snow, CLUB.snowLight);
const TANGERINE = ramp(CLUB.tangerineDark, CLUB.tangerine, CLUB.tangerineLight);
const VIOLET = ramp(CLUB.violetDark, CLUB.violet, CLUB.violetLight);
const PINK = ramp(CLUB.pinkDark, CLUB.pink, CLUB.pinkLight);
const ROYAL = ramp(CLUB.royalDark, CLUB.royal, CLUB.royalLight);
const LILAC = ramp(CLUB.lilacDark, CLUB.lilac, CLUB.lilacLight);

/** The visitors' ramps, in order of preference: the first that stays clear is theirs. */
const AWAY_RAMPS: readonly Ramp[] = [TEAL, LILAC, TANGERINE, CRIMSON];

/** Distance in OKLab: about 0.1 is a near thing, 0.2 plainly different. */
export function colorDistance(a: Color, b: Color): number {
  const [l1, a1, b1] = toOklab(a);
  const [l2, a2, b2] = toOklab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

/** How far apart the visitors must be from every home colour. */
export const AWAY_CLEAR = 0.15;

interface Spec {
  id: string;
  name: string;
  main: Ramp;
  second: Ramp;
  shirt?: Color;
  shorts?: Color;
}

function isLight(c: Color): boolean {
  return toOklab(c)[0] > 0.8;
}

function build(spec: Spec): ClubScheme {
  const shirt = spec.shirt ?? spec.main.base;
  const shorts =
    spec.shorts ??
    (isLight(spec.second.dark) ? spec.main.dark : spec.second.dark);
  const home = [spec.main.base, spec.main.light, spec.second.base, shirt];
  const away =
    AWAY_RAMPS.find((r) =>
      home.every(
        (c) =>
          colorDistance(c, r.base) >= AWAY_CLEAR &&
          colorDistance(c, r.light) >= AWAY_CLEAR,
      ),
    ) ?? TEAL;
  const bright = toOklab(spec.second.base)[0] < 0.5 ? GOLD : spec.second;
  const spark = toOklab(spec.main.base)[0] < 0.5 ? GOLD : spec.main;
  return Object.freeze({
    id: spec.id,
    name: spec.name,
    main: spec.main,
    second: spec.second,
    away,
    kit: Object.freeze({ shirt, shorts }),
    bright,
    spark,
  });
}

/**
 * Every scheme, in the order the days take them (one a day, round and round). Neighbours
 * differ in character, and the first is the stadium as it always was: red and white.
 */
export const SCHEMES: readonly ClubScheme[] = Object.freeze(
  (
    [
      { id: "redwhite", name: "RED AND WHITE", main: RED, second: SNOW },
      { id: "purplegold", name: "PURPLE AND GOLD", main: VIOLET, second: GOLD },
      {
        id: "yellowgreen",
        name: "YELLOW AND GREEN",
        main: CANARY,
        second: FOREST,
      },
      {
        id: "blackwhite",
        name: "BLACK AND WHITE",
        main: CHARCOAL,
        second: SNOW,
        shirt: CHARCOAL.light,
        shorts: CHARCOAL.dark,
      },
      {
        id: "claretsky",
        name: "CLARET AND SKY BLUE",
        main: CLARET,
        second: SKY,
        shirt: CLARET.light,
      },
      {
        id: "orangeblack",
        name: "ORANGE AND BLACK",
        main: TANGERINE,
        second: CHARCOAL,
      },
      {
        id: "greenwhite",
        name: "GREEN AND WHITE",
        main: EMERALD,
        second: SNOW,
        shirt: EMERALD.dark,
        shorts: CHARCOAL.base,
      },
      { id: "pinkblack", name: "PINK AND BLACK", main: PINK, second: CHARCOAL },
      {
        id: "whitered",
        name: "WHITE AND RED",
        main: SNOW,
        second: CRIMSON,
        shirt: CRIMSON.base,
      },
      {
        id: "yellowblue",
        name: "YELLOW AND BLUE",
        main: CANARY,
        second: ROYAL,
      },
      {
        id: "redblack",
        name: "RED AND BLACK",
        main: CRIMSON,
        second: CHARCOAL,
      },
      {
        id: "purplewhite",
        name: "PURPLE AND WHITE",
        main: VIOLET,
        second: SNOW,
      },
    ] satisfies Spec[]
  ).map(build),
);

/** The stadium as it always was: red and white. */
export const DEFAULT_SCHEME: ClubScheme = SCHEMES[0];

/** The scheme with this id, or the default. */
export function schemeById(id: string): ClubScheme {
  return SCHEMES.find((s) => s.id === id) ?? DEFAULT_SCHEME;
}

/**
 * The day's colours, from the game's day number (`dayNumber` in app/game/day.ts): one
 * scheme a day, all twelve every twelve days, never the same two days running.
 */
export function schemeForDay(day: number): ClubScheme {
  const d = Number.isFinite(day) ? Math.floor(day) : 0;
  const n = SCHEMES.length;
  return SCHEMES[((d % n) + n) % n];
}

// ---------------------------------------------------------------------------
// The swap
// ---------------------------------------------------------------------------

/** The palette colour each painted colour becomes in a scheme. */
function swapOf(scheme: ClubScheme): Map<Color, Color> {
  const m = new Map<Color, Color>();
  const put = (from: Ramp, to: Ramp): void => {
    if (from.dark !== to.dark) m.set(from.dark, to.dark);
    if (from.base !== to.base) m.set(from.base, to.base);
    if (from.light !== to.light) m.set(from.light, to.light);
  };
  put(RED, scheme.main);
  put(TEAL, scheme.away);
  return m;
}

const swaps = new WeakMap<ClubScheme, (c: Color) => Color>();
const clubs = new WeakMap<Lighting, ClubScheme>();
const raws = new WeakMap<Lighting, (c: Color) => Color>();
const wrapped = new WeakMap<Lighting, Map<string, Lighting>>();

function rawSwap(scheme: ClubScheme): (c: Color) => Color {
  let fn = swaps.get(scheme);
  if (!fn) {
    const m = swapOf(scheme);
    fn = m.size === 0 ? (c) => c : (c) => m.get(c) ?? c;
    swaps.set(scheme, fn);
  }
  return fn;
}

/**
 * The lighting `light` in the colours of `scheme`: its `env` and `lit` grade the HOME ramp
 * as the club's main colour and the AWAY ramp as the visitors'. Cached: the same light and
 * scheme give the very same object.
 */
export function clubLight(light: Lighting, scheme: ClubScheme): Lighting {
  if (clubs.get(light) === scheme) return light;
  let byId = wrapped.get(light);
  if (!byId) {
    byId = new Map();
    wrapped.set(light, byId);
  }
  const known = byId.get(scheme.id);
  if (known) return known;
  const swap = rawSwap(scheme);
  const env = light.env;
  const lit = light.lit;
  const out: Lighting = Object.freeze({
    sun: light.sun,
    phase: light.phase,
    lightsOn: light.lightsOn,
    env: (c: Color) => env(swap(c)),
    lit: lit === env ? (c: Color) => env(swap(c)) : (c: Color) => lit(swap(c)),
  });
  clubs.set(out, scheme);
  raws.set(out, swap);
  byId.set(scheme.id, out);
  return out;
}

/** The scheme a lighting was wrapped in (the default for a plain lighting). */
export function clubOf(light: Lighting): ClubScheme {
  return clubs.get(light) ?? DEFAULT_SCHEME;
}

/** The swap for colours drawn raw, unlit (fireworks, flares, lamps): the identity for a plain lighting. */
export function clubRaw(light: Lighting): (c: Color) => Color {
  return raws.get(light) ?? rawSwap(DEFAULT_SCHEME);
}
