/**
 * NEXT-GEN's crowd (.snaps/era-art/THEME.md): the same people as today's (people.ts), led
 * by the hero's electric magenta instead of HOME's red but mixed with violet, slate, white,
 * cyan and silver, about a third holding up a wristband of light (a light wave runs across
 * them), a visor of light over some faces and headsets of light on the near crowd's heads.
 * The lights are drawn raw (art bible 3.2: light sources), their halos only by night.
 *
 * Everything here is chosen per person from the build's seed and their place (`hash2`),
 * like the rest of the crowd, and handed to people.ts's painters as plain colours.
 */

import { P } from "~/art/palette";
import { TRANSPARENT, hash2, type Color, type Surface } from "~/pixel";
import type { Tier } from "./types";

type Weighted = readonly (readonly [Color, number])[];

const NEUTRAL: Weighted = [
  [P.night, 14],
  [P.slate, 16],
  [P.steel, 10],
  [P.mist, 8],
  [P.chalk, 6],
  [P.awayDark, 4],
];

/**
 * The crowd's shirts in NEXT-GEN: the hero's magenta leads where today's crowd wears red,
 * but a step down (about half of the colours, much of it the deep violet), with cyan,
 * white, silver and dark among them, so the crowd is not a flat wall of pink and the
 * hero in magenta stands out in front of it. From tier 5 the nation's white with magenta.
 */
export function nextgenShirts(tier: Tier, share: number): Weighted {
  if (tier >= 5) {
    return [
      [P.chalk, 30],
      [P.white, 4],
      [P.nextgen, 16],
      [P.nextgenDark, 10],
      [P.mist, 6],
      [P.steelHi, 3],
      [P.steel, 4],
      [P.slate, 7],
      [P.night, 4],
      [P.away, 3],
      [P.awayLight, 2],
    ];
  }
  return [
    ...NEUTRAL.map(([c, w]) => [c, w * (1 - share)] as const),
    [P.nextgen, 16 * share],
    [P.nextgenDark, 14 * share],
    [P.nextgenLight, 3 * share],
    [P.chalk, 8 * share],
    [P.white, 3 * share],
    [P.night, 6 * share],
    [P.slate, 7 * share],
    [P.mist, 4 * share],
    [P.steelHi, 3 * share],
    [P.away, 2 * share],
    [P.awayLight, 1 * share],
  ];
}

/** Scarves and flags: the crowd's two colours in NEXT-GEN. */
export function nextgenColors(tier: Tier): [Color, Color] {
  return tier >= 5 ? [P.chalk, P.nextgen] : [P.nextgen, P.chalk];
}

/** The wristbands' lights, most of them the hero's. */
const BANDS: Weighted = [
  [P.nextgenLight, 40],
  [P.awayLight, 22],
  [P.white, 16],
  [P.ledGreen, 11],
  [P.goldLight, 11],
];

/** A visor's glass: cyan mostly, some white (never pink: it vanishes on a face). */
const VISORS: readonly Color[] = [
  P.awayLight,
  P.awayLight,
  P.awayLight,
  P.white,
];

/** The halo a band's light throws at night (art bible 10.4: halos only in the dark). */
function haloOf(band: Color): Color {
  if (band === P.nextgenLight) return P.nextgen;
  if (band === P.awayLight) return P.away;
  if (band === P.goldLight) return P.gold;
  return P.skyMid;
}

function pick(table: Weighted, r: number): Color {
  let total = 0;
  for (const [, w] of table) total += w;
  let acc = 0;
  const target = r * total;
  for (const [c, w] of table) {
    acc += w;
    if (target < acc) return c;
  }
  return table[table.length - 1][0];
}

/**
 * A person's lights in NEXT-GEN: a wristband and a visor, either TRANSPARENT for none, and
 * the band's halo at night (TRANSPARENT by day).
 */
export interface Lights {
  band: Color;
  visor: Color;
  halo?: Color;
}

/**
 * The lights of the person at (x, y) of a build seeded `seed`: about one in three wears a
 * glowing wristband (a seated fan holds it up), about one in seven a visor. `dark` gives
 * the band its halo (the floodlights are on). `out` is filled and returned.
 */
export function nextgenLights(
  out: Lights,
  seed: number,
  x: number,
  y: number,
  dark = false,
): Lights {
  const s = (seed * 131 + 977) | 0;
  out.band =
    hash2(x, y, s) < 0.34 ? pick(BANDS, hash2(x, y, s + 1)) : TRANSPARENT;
  out.visor =
    hash2(x, y, s + 2) < 0.15
      ? VISORS[Math.floor(hash2(x, y, s + 3) * VISORS.length) % VISORS.length]
      : TRANSPARENT;
  out.halo = dark && out.band !== TRANSPARENT ? haloOf(out.band) : TRANSPARENT;
  return out;
}

// ---------------------------------------------------------------------------
// The fans' wristbands of light (drawn each frame by people.ts's drawFans)
// ---------------------------------------------------------------------------

// The fan frames' geometry (people.ts FAN_ART, poses REST 0, BOB 1, JUMP 2, HANDS 3,
// SCARF 4, ARMS 5), in the frame's own cells (the frame's top left is the box's
// (x - 2, y - 4)): the hair's row, and each raised pose's wrists (col, row).
const HAIR_ROW: readonly number[] = [4, 2, 2, 4, 2, 4];
const WRISTS: readonly (readonly number[])[] = [
  [],
  [],
  [1, 1, 8, 1],
  [1, 3, 8, 3],
  [1, 3, 8, 3],
  [1, 3, 8, 3],
];

/** Which side a seated fan holds the light up on: 0 left, 1 right (by place). */
function liftSide(x: number, y: number): number {
  return ((x >> 3) + (y >> 2)) & 1;
}

/**
 * NEXT-GEN's wristband of light on the fan whose box's top left is (x, y), in `pose`: a
 * 2 x 2 cluster on the wrist. Seated (at rest or bobbing) the fan holds one arm up beside
 * the head with the light on it, the fist above; with the arms up it is on each wrist.
 * `arm` and `hand` are the fan's sleeve and skin.
 */
export function drawFanBand(
  s: Surface,
  x: number,
  y: number,
  pose: number,
  band: Color,
  arm: Color,
  hand: Color,
): void {
  const ox = x - 2;
  const oy = y - 4;
  const w = WRISTS[pose];
  if (w.length === 0) {
    const top = oy + HAIR_ROW[pose];
    const col = liftSide(x, y) === 0 ? 1 : 8;
    s.vline(ox + col, top + 1, 3, arm);
    s.px(ox + col, top - 2, hand);
    s.rect(ox + (col === 1 ? 0 : 8), top - 1, 2, 2, band);
    return;
  }
  for (let i = 0; i < w.length; i += 2) {
    s.rect(ox + (w[i] === 1 ? 0 : 8), oy + w[i + 1], 2, 2, band);
  }
}

/**
 * The crest of the light wave over the crowd: true when the band at (x, y) burns brightest
 * at scene time `t`. The crest steps across the stands (4 steps a second, art bible 6),
 * one place in three lit at a time, rows a little behind each other.
 */
export function bandCrest(x: number, y: number, t: number): boolean {
  const k = Math.floor(t * 4) - Math.floor((x + (y >> 1)) / 12);
  return ((k % 3) + 3) % 3 === 0;
}

/**
 * A band at the crest of the wave: a white-hot pixel in the top left of each 2 x 2 and, at
 * night, a stepped halo of one pixel round it in `halo` (TRANSPARENT by day).
 */
export function drawFanCrest(
  s: Surface,
  x: number,
  y: number,
  pose: number,
  halo: Color,
): void {
  const ox = x - 2;
  const oy = y - 4;
  const w = WRISTS[pose];
  if (w.length === 0) {
    const top = oy + HAIR_ROW[pose];
    const bx = ox + (liftSide(x, y) === 0 ? 0 : 8);
    crest(s, bx, top - 1, halo);
    return;
  }
  for (let i = 0; i < w.length; i += 2) {
    crest(s, ox + (w[i] === 1 ? 0 : 8), oy + w[i + 1], halo);
  }
}

function crest(s: Surface, bx: number, by: number, halo: Color): void {
  if (halo !== TRANSPARENT) {
    s.hline(bx, by - 1, 2, halo);
    s.hline(bx, by + 2, 2, halo);
    s.vline(bx - 1, by, 2, halo);
    s.vline(bx + 2, by, 2, halo);
  }
  s.px(bx, by, P.white);
}

/**
 * A standing watcher's coat in NEXT-GEN: today's picks wear HOME's red here and there (the
 * hero's colour today); in NEXT-GEN the hero's colour is magenta, so those are his. Every
 * other pick (today's trench coats and anoraks) becomes a slim jacket of the future in
 * slate, night, steel or pale panel grey, chosen by the watcher's number `n`. `E` is
 * the ground's grade, `coat` the graded pick.
 */
export function nextgenCoat(E: (c: Color) => Color, coat: Color, n = 0): Color {
  if (coat === E(P.home) || coat === E(P.homeLight)) return E(P.nextgen);
  if (coat === E(P.homeDark)) return E(P.nextgenDark);
  return E(JACKETS[((n % JACKETS.length) + JACKETS.length) % JACKETS.length]);
}

/** NEXT-GEN's slim jackets for the standing watchers. */
const JACKETS: readonly Color[] = [
  P.slate,
  P.night,
  P.steel,
  P.slate,
  P.concreteLight,
];

/**
 * A standing watcher's lights in NEXT-GEN (raw): the crowd's wristband (`nextgenLights`),
 * a visor on about half of them (they stand close, so more than the crowd's one in seven)
 * and a trim of light on the jacket's hem and zip, cyan or white.
 */
export function nextgenWatcherLights(
  seed: number,
  x: number,
  n: number,
): { band: Color; visor: Color; trim: Color } {
  const l = nextgenLights(
    { band: TRANSPARENT, visor: TRANSPARENT },
    seed,
    x,
    n + 500,
  );
  const visor =
    l.visor !== TRANSPARENT
      ? l.visor
      : hash2(x, n, seed + 41) < 0.4
        ? VISORS[n % VISORS.length]
        : TRANSPARENT;
  return { band: l.band, visor, trim: n % 3 === 2 ? P.white : P.awayLight };
}
