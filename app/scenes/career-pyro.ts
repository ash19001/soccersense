/**
 * The goal show: what goes off around the ground when he scores, sized by the ground and
 * by the shot (the product owner, 2026-11-17: "some pyro/flame machines going off and maybe
 * confetti ... You decide what makes sense for football").
 *
 *   tiers 0, 1   the park and the Sunday pitch have no machines: the cheer puts up the
 *                birds from behind the goal (`birds`)
 *   tiers 2, 3   a small ground's own pyro: fans here and there in the crowd light
 *                flares, each in their own time, and their smoke rolls up out of the
 *                stand (`flares`)
 *   tiers 4 to 7 a stadium's: flame jets along the far touchline, set off from the goal
 *                end outwards, and for a golazo or a worldie two confetti cannons (`jets`)
 *
 * The better the shot, the more of it: `size` runs from 0 (a tap in) to 1 (a worldie), as
 * the fireworks over the stand do (career-fx.ts), which this goes with at the stadium
 * tiers. RETRO's jets are torches on stakes that throw sparks and NEXT-GEN's are jets of
 * cool plasma with a bar of light at the head (the sparks and the head are in the eras' own
 * files); flares, smoke and confetti take the era's colours.
 *
 * Everything is a pure function of the time since the ball went in and a seed, in whole
 * pixels, stepped at 15 frames a second, and allocates nothing. Lights (flame, flare,
 * spark, beam) are raw palette colour; what the daylight falls on (the machines, the
 * smoke, the birds) is handed in already graded by the scene.
 */

import type { Era } from "~/art/era";
import { P } from "~/art/palette";
import { clamp, hash2, mix, type Color, type Surface } from "~/pixel";
import { drawNextgenJetHead } from "./career-fx-nextgen";
import { drawRetroJetSparks } from "./career-fx-retro";

export type PyroKind = "birds" | "flares" | "jets";

/** What a goal sets off at a tier. */
export function pyroKind(tier: number): PyroKind {
  return tier <= 1 ? "birds" : tier <= 3 ? "flares" : "jets";
}

/** The show is over this long after the ball went in. */
export const PYRO_SECONDS = 4.2;

/** A golazo's and a worldie's confetti: from this `size` up. */
export const CONFETTI_FROM = 0.6;

/** A goal's show, as the scene describes it each frame (one object, filled again). */
export interface Pyro {
  /** Seconds since the ball went in. */
  age: number;
  /** 0 (a tap in) to 1 (a worldie). */
  size: number;
  tier: number;
  era: Era;
  /** Different for each goal of a game, so no two shows are the same. */
  seed: number;
  /** The canvas width, and the stage's left and right. */
  w: number;
  x0: number;
  x1: number;
  /** The far touchline's row, the feet row and the goal line. */
  touchY: number;
  groundY: number;
  goalX: number;
  /** The mode's colour and its light step (confetti, NEXT-GEN's beams). */
  mode: Color;
  modeLight: Color;
  /** Graded by the light of the moment: a machine's body, its top edge and its nozzle. */
  rigDark: Color;
  rigTop: Color;
  rigHi: Color;
  /** Graded: smoke's lit top, its body and its shaded side. */
  smokeHi: Color;
  smoke: Color;
  smokeShade: Color;
  /** Graded by the sky's light: a bird's dark body and its pale wings. */
  bird: Color;
  birdWing: Color;
}

/** A blank show for a scene to keep and fill. */
export function newPyro(): Pyro {
  return {
    age: -1,
    size: 0,
    tier: 0,
    era: "today",
    seed: 0,
    w: 0,
    x0: 0,
    x1: 0,
    touchY: 0,
    groundY: 0,
    goalX: 0,
    mode: P.home,
    modeLight: P.homeLight,
    rigDark: P.night,
    rigTop: P.steel,
    rigHi: P.steelHi,
    smokeHi: P.white,
    smoke: P.steelHi,
    smokeShade: P.concreteLight,
    bird: P.steel,
    birdWing: P.steelHi,
  };
}

const FPS = 15;

// ---------------------------------------------------------------------------
// The flame jets (tiers 4 to 7)
// ---------------------------------------------------------------------------

/** A jet about every 52 px of touchline, from the stage's left to just short of the goal. */
const JET_GAP = 52;
/** The last jet stands this far short of the goal line (the end's boards start there). */
const JET_SHORT = 14;
/** A pulse: the flame up, held, and down; and from one pulse to the next. */
const JET_UP = 0.08;
const JET_DOWN = 0.14;
const JET_EVERY = 0.7;
/** Each jet goes this long after its neighbour nearer the goal: a wave down the line. */
const JET_STEP = 0.06;

/** How many jets stand along the touchline. */
export function jetCount(p: Pyro): number {
  const right = Math.min(p.x1, p.goalX - JET_SHORT);
  return Math.max(2, Math.round((right - Math.max(0, p.x0)) / JET_GAP));
}

/** Where the `i`th jet stands, counted from the left. */
export function jetX(p: Pyro, i: number): number {
  const left = Math.max(0, p.x0);
  const right = Math.min(p.x1, p.goalX - JET_SHORT);
  return left + Math.round(((i + 0.5) * (right - left)) / jetCount(p));
}

/** How many of them a goal fires (from the goal end): two for a tap in, all for a worldie. */
export function jetsLit(p: Pyro): number {
  const n = jetCount(p);
  return Math.min(n, Math.round(2 + clamp(p.size) * (n - 2)));
}

/** How many times they go: once for the small goals, three times for a worldie. */
export function jetPulses(size: number): number {
  return 1 + Math.round(clamp(size) * 2);
}

/**
 * A flame's full height, in px: half as tall again as a player (36) for a tap in, well
 * over twice his height for a worldie.
 */
export function jetHeight(size: number): number {
  return 52 + Math.round(clamp(size) * 34);
}

/**
 * How much of its height the `j`th jet from the goal has at `age`, 0 to 1: 0 between
 * pulses and when the show is over.
 */
export function jetLevel(p: Pyro, j: number): number {
  if (j >= jetsLit(p)) return 0;
  const z = clamp(p.size);
  const hold = 0.2 + 0.12 * z;
  const pulses = jetPulses(z);
  for (let k = 0; k < pulses; k++) {
    const a = p.age - (0.08 + j * JET_STEP + k * JET_EVERY);
    if (a < 0) return 0;
    if (a < JET_UP) return a / JET_UP;
    if (a < JET_UP + hold) return 1;
    if (a < JET_UP + hold + JET_DOWN) return 1 - (a - JET_UP - hold) / JET_DOWN;
  }
  return 0;
}

/**
 * The machines themselves, there whenever the ground has them (tiers 4 to 7), goal or no
 * goal: a low dark unit on the verge in front of the boards (a stake with a paper tube in
 * RETRO, a slim pad with a line of light in NEXT-GEN).
 */
export function drawPyroRig(s: Surface, p: Pyro): void {
  if (pyroKind(p.tier) !== "jets") return;
  const n = jetCount(p);
  const y = p.touchY;
  for (let i = 0; i < n; i++) {
    const x = jetX(p, i);
    if (p.era === "retro") {
      s.rect(x - 1, y - 4, 2, 6, p.rigDark);
      s.rect(x - 1, y - 6, 2, 2, p.rigHi);
    } else if (p.era === "nextgen") {
      s.rect(x - 4, y - 1, 8, 3, p.rigHi);
      s.rect(x - 4, y + 1, 8, 1, p.rigTop);
      s.rect(x - 2, y - 1, 4, 1, P.skyLow);
    } else {
      s.rect(x - 4, y - 2, 8, 4, p.rigDark);
      s.rect(x - 4, y - 2, 8, 1, p.rigTop);
      s.rect(x - 1, y - 3, 2, 1, p.rigHi);
    }
  }
}

/** A flame's colours, from its rim to its heart; the tip's are a step cooler. */
interface FlameColors {
  rim: Color;
  rimTip: Color;
  body: Color;
  bodyTip: Color;
  inner: Color;
  heart: Color;
}

/** Today's: mostly yellow, so it stands off a crowd in red. */
const FLAME: FlameColors = {
  rim: P.amber,
  rimTip: P.ledRed,
  body: P.gold,
  bodyTip: P.amber,
  inner: P.goldLight,
  heart: P.white,
};

/** RETRO's torches: a dark red rim round the amber, so they stand off a crowd in gold. */
const FLAME_RETRO: FlameColors = {
  rim: P.brick,
  rimTip: P.brickDark,
  body: P.amber,
  bodyTip: P.brickLight,
  inner: P.goldLight,
  heart: P.white,
};

/** NEXT-GEN's plasma: sky light and white, so it stands off a crowd in magenta. */
const FLAME_NEXTGEN: FlameColors = {
  rim: P.skyMid,
  rimTip: P.away,
  body: P.skyLow,
  bodyTip: P.skyMid,
  inner: P.white,
  heart: P.white,
};

/**
 * One flame, `h` px tall, standing on (`x`, `baseY`): narrow at the nozzle, fattest a
 * third of the way up, a tip that leans and licks. From the outside in: a rim, the body,
 * a pale inside and the white-hot heart.
 */
function flame(
  s: Surface,
  x: number,
  baseY: number,
  h: number,
  frame: number,
  id: number,
  seed: number,
  c: FlameColors,
): void {
  if (h < 2) return;
  for (let r = 0; r < h; r++) {
    const u = r / h;
    const fat = u < 0.3 ? 2 + (4.5 * u) / 0.3 : 6.5 - (6 * (u - 0.3)) / 0.7;
    const lean = Math.round(Math.sin(frame * 1.9 + r * 0.3 + id) * 2.4 * u);
    let half = Math.round(fat);
    if (u > 0.2 && hash2(r + id * 53, frame, seed) < 0.3) half -= 1;
    if (half < 1) half = 1;
    const y = baseY - 1 - r;
    const cx = x + lean;
    s.rect(cx - half, y, half * 2, 1, u < 0.72 ? c.rim : c.rimTip);
    if (half >= 2)
      s.rect(cx - half + 1, y, half * 2 - 2, 1, u < 0.8 ? c.body : c.bodyTip);
    if (half >= 4 && u < 0.7)
      s.rect(cx - half + 2, y, half * 2 - 4, 1, c.inner);
    if (half >= 5 && u < 0.45)
      s.rect(cx - half + 4, y, half * 2 - 8, 1, c.heart);
  }
  // licks breaking off the tip
  const tip = baseY - 1 - h;
  for (let k = 0; k < 2; k++) {
    if (hash2(id * 7 + k, frame, seed) < 0.45) continue;
    const dx = Math.round((hash2(id + k, frame + 3, seed) - 0.5) * 8);
    const d = k === 0 ? 3 : 2;
    s.rect(x + dx, tip - 3 - k * 4, d, d, k === 0 ? c.rim : c.rimTip);
  }
}

function jets(s: Surface, p: Pyro): void {
  const n = jetCount(p);
  const frame = Math.floor(p.age * FPS);
  const full = jetHeight(p.size);
  for (let j = 0; j < n; j++) {
    const level = jetLevel(p, j);
    if (level <= 0) continue;
    const i = n - 1 - j;
    const x = jetX(p, i);
    const h = Math.round(full * level);
    if (p.era === "retro") {
      // a torch on its stake, throwing sparks
      const baseY = p.touchY - 6;
      flame(s, x, baseY, h, frame, i, p.seed, FLAME_RETRO);
      drawRetroJetSparks(s, x, baseY, h, frame, i, p.seed);
    } else if (p.era === "nextgen") {
      // a jet of plasma off its pad, a bar of light at its head
      const baseY = p.touchY - 1;
      flame(s, x, baseY, h, frame, i, p.seed, FLAME_NEXTGEN);
      drawNextgenJetHead(s, x, baseY - h, frame, p.modeLight);
    } else {
      flame(s, x, p.touchY - 3, h, frame, i, p.seed, FLAME);
    }
  }
}

// ---------------------------------------------------------------------------
// The fans' flares and their smoke (tiers 2 and 3)
// ---------------------------------------------------------------------------

/** How many flares a goal lights: two for a tap in, five for a worldie. */
export function flareCount(size: number): number {
  return 2 + Math.round(clamp(size) * 3);
}

/**
 * A flare's smoke is a plume of small puffs, one every `PUFF_EVERY` seconds while it
 * burns, each lasting about `PUFF_LIFE` (a little more or less, so the top of the plume
 * breaks up in clumps).
 */
const PUFF_LIFE = 1.2;
const PUFF_EVERY = 0.06;

/** Smoke where it leaves a flare, lit by it: red fire's, and NEXT-GEN's sky light's. */
const SMOKE_LIT = mix(P.ledRed, P.chalk, 0.5);

/** The most flares a goal lights (a worldie's). */
const MAX_FLARES = 5;

/**
 * A goal's flares: how many (`n`), where each is held up (`x`, `y`), when it is lit, in
 * seconds after the goal (`at`), and how long it burns (`burn`). One object, filled again
 * by `flarePlaces`.
 */
export interface FlarePlaces {
  n: number;
  x: Int16Array;
  y: Int16Array;
  at: Float32Array;
  burn: Float32Array;
}

const PLACES: FlarePlaces = {
  n: 0,
  x: new Int16Array(MAX_FLARES),
  y: new Int16Array(MAX_FLARES),
  at: new Float32Array(MAX_FLARES),
  burn: new Float32Array(MAX_FLARES),
};

/** The part of the far side where a crowd stands that could light one, by the tier. */
const BOX = { x0: 0, x1: 0, y0: 0, y1: 0 };

/**
 * Where the fans who might light a flare are, into `BOX`: the hands-up height over the
 * heads of the crowd behind the boards.
 *
 *   tier 2   the small covered stand: 0.16 to 0.68 of the stage, its two rows
 *   tier 3   the main stand, which runs from the canvas's left edge to just past the
 *            middle of the stage: from 0.4 of a stage left of the stage (never off the
 *            canvas) to its middle, the front rows and the middle of the stand (a
 *            flare in the top rows would send its whole plume through the roof)
 */
function crowdBox(p: Pyro): void {
  const w = p.x1 - p.x0;
  if (p.tier <= 2) {
    BOX.x0 = p.x0 + Math.round(w * 0.16);
    BOX.x1 = p.x0 + Math.round(w * 0.68);
    BOX.y0 = p.touchY - 36;
    BOX.y1 = p.touchY - 24;
  } else {
    BOX.x0 = Math.max(8, p.x0 - Math.round(w * 0.4));
    BOX.x1 = p.x0 + Math.round(w * 0.5);
    BOX.y0 = p.touchY - 54;
    BOX.y1 = p.touchY - 26;
  }
}

/**
 * A goal's flares (into the one `FlarePlaces`, returned): each lit by someone somewhere
 * in the crowd, and each in their own time. The places are picked by the goal's seed, so
 * no two goals have the same people; no two flares of a goal are close enough for their
 * plumes to be one. The first is lit as the ball goes in, the others any time in the next
 * second or so, and each burns for a little over a second.
 */
export function flarePlaces(p: Pyro): FlarePlaces {
  crowdBox(p);
  const n = Math.min(MAX_FLARES, flareCount(p.size));
  const f = PLACES;
  f.n = n;
  for (let i = 0; i < n; i++) {
    let x = 0;
    let y = 0;
    // a few tries for a place clear of the ones already picked; the last try stands
    for (let j = 0; j < 8; j++) {
      x =
        BOX.x0 + Math.round(hash2(i * 16 + j, 11, p.seed) * (BOX.x1 - BOX.x0));
      y =
        BOX.y0 + Math.round(hash2(i * 16 + j, 12, p.seed) * (BOX.y1 - BOX.y0));
      let clear = true;
      for (let k = 0; k < i; k++) {
        if (Math.abs(x - f.x[k]) < 24 && Math.abs(y - f.y[k]) < 22)
          clear = false;
      }
      if (clear) break;
    }
    f.x[i] = x;
    f.y[i] = y;
    // the first as the ball goes in; the others each somewhere in their own slice of
    // the next second or so, so chance never lights them as a volley
    f.at[i] =
      i === 0
        ? 0.1
        : 0.15 +
          ((i - 1 + 0.15 + 0.7 * hash2(i, 13, p.seed)) / Math.max(1, n - 1)) *
            1.15;
    f.burn[i] = 1.05 + hash2(i, 14, p.seed) * 0.55;
  }
  return f;
}

/**
 * A puff of smoke `r` px in radius, as the promotion's smoke is drawn (career-fx.ts): its
 * shade a pixel down and to the right, its body, and from 5 px a lit patch up and to the
 * left. Always solid: smoke thins by its puffs going, never by dither (a dithered puff
 * shows as a dotted square).
 */
function puff(
  s: Surface,
  x: number,
  y: number,
  r: number,
  hi: Color,
  body: Color,
  shade: Color,
): void {
  if (r < 1) return;
  if (r < 3) {
    s.disc(x, y, r, body);
    return;
  }
  // the shade shows down the right and under it, two px on the big ones
  const d = r >= 6 ? 2 : 1;
  s.disc(x + d, y + d, r, shade);
  s.disc(x, y, r - 1, body);
  if (r >= 5) {
    const o = Math.round(r / 3);
    s.disc(x - o, y - o, r - 4, hi);
  }
}

function flares(s: Surface, p: Pyro): void {
  const places = flarePlaces(p);
  const m = places.n;
  const tt = Math.floor(p.age * FPS) / FPS;
  const frame = Math.floor(p.age * FPS);
  // red fire today and in RETRO (a Bengal light), sky light in NEXT-GEN
  const halo = p.era === "nextgen" ? P.skyLow : P.ledRed;
  const glow = p.era === "nextgen" ? P.white : P.goldLight;
  const cool = p.era === "nextgen";
  const hi = cool ? P.white : p.smokeHi;
  const body = cool ? P.skyLow : p.smoke;
  const shade = cool ? P.skyMid : p.smokeShade;
  // The smoke first, so the lights sit on it. A plume a flare: the oldest puffs (the
  // highest and biggest) first, the new ones over their feet, so it reads as one column
  // that widens as it climbs and leans with the wind, in shade down its right side.
  for (let i = 0; i < m; i++) {
    const fx = places.x[i];
    const fy = places.y[i];
    const lit = places.at[i];
    const puffs = Math.floor(places.burn[i] / PUFF_EVERY);
    for (let k = 0; k < puffs; k++) {
      const a = tt - (lit + 0.05 + k * PUFF_EVERY);
      const life = PUFF_LIFE + (hash2(k, 40 + i, p.seed) - 0.5) * 0.5;
      if (a < 0 || a >= life) continue;
      const u = a / life;
      // ragged at the top: the higher, the more of them have already gone
      if (u > 0.45 && hash2(k, 70 + i, p.seed) < (u - 0.45) * 0.9) continue;
      // it swells as it rises, and shrinks away at the end
      let r = 2 + 5.5 * Math.sqrt(u) + (hash2(k, 50 + i, p.seed) - 0.5) * 3;
      if (u > 0.7) r *= 1 - ((u - 0.7) / 0.3) * 0.75;
      // up, slowing; over with the wind, faster the higher; and each a little off the
      // line, so the column's sides are lumps and not a wall
      const x =
        fx +
        1 +
        Math.round(
          18 * Math.pow(a, 1.6) +
            Math.sin(a * 5 + k * 0.9 + i) * 2.5 * a +
            (hash2(k, 60 + i, p.seed) - 0.5) * 7 * u,
        );
      const y =
        fy -
        5 -
        Math.round(
          56 * a - 10 * a * a + (hash2(k, 80 + i, p.seed) - 0.5) * 4 * u,
        );
      if (a < 0.16) {
        // just out of the flare: lit by it
        puff(
          s,
          x,
          y,
          Math.round(r),
          cool ? P.white : P.chalk,
          cool ? P.white : SMOKE_LIT,
          cool ? P.skyLow : P.ledRed,
        );
      } else {
        puff(s, x, y, Math.round(r), hi, body, shade);
      }
    }
  }
  for (let i = 0; i < m; i++) {
    const a = tt - places.at[i];
    if (a < 0 || a >= places.burn[i]) continue;
    const fx = places.x[i];
    const fy = places.y[i];
    // the light: a white-hot heart in a pale glow in the flare's colour, breathing: on
    // the big beat four rays stand off it
    if ((frame + i) % 2 === 0) {
      s.rect(fx - 3, fy - 1, 8, 4, halo);
      s.rect(fx - 1, fy - 3, 4, 8, halo);
      s.rect(fx - 2, fy - 2, 6, 6, halo);
      s.rect(fx - 2, fy, 6, 2, glow);
      s.rect(fx, fy - 2, 2, 6, glow);
      s.rect(fx - 6, fy, 2, 2, halo);
      s.rect(fx + 6, fy, 2, 2, halo);
      s.rect(fx, fy - 6, 2, 2, halo);
    } else {
      s.rect(fx - 2, fy - 1, 6, 4, halo);
      s.rect(fx - 1, fy - 2, 4, 6, halo);
      s.rect(fx - 1, fy, 4, 2, glow);
      s.rect(fx, fy - 1, 2, 4, glow);
    }
    s.rect(fx, fy, 2, 2, P.white);
    // sparks dripping from it
    for (let k = 0; k < 3; k++) {
      const q = ((frame + k * 3 + i * 5) % 8) / 8;
      const dx = (k - 1) * 2 + (q > 0.5 ? k - 1 : 0);
      s.rect(
        fx + dx,
        fy + 4 + Math.round(q * 9),
        1,
        2,
        q < 0.5 ? P.goldLight : P.amber,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// The birds (tiers 0 and 1)
// ---------------------------------------------------------------------------

/** How many birds a goal puts up: four for a tap in, twelve for a worldie. */
export function birdCount(size: number): number {
  return 4 + Math.round(clamp(size) * 8);
}

function birds(s: Surface, p: Pyro): void {
  const n = birdCount(p.size);
  for (let i = 0; i < n; i++) {
    const a = p.age - (0.04 + hash2(i, 21, p.seed) * 0.3);
    if (a < 0 || a >= PYRO_SECONDS) continue;
    // up from the top of whatever stands behind the goal, most of them back over the pitch
    const from = p.goalX + Math.round((hash2(i, 22, p.seed) * 2 - 0.9) * 44);
    const dir = hash2(i, 23, p.seed) < 0.72 ? -1 : 1;
    const vx = dir * (34 + hash2(i, 24, p.seed) * 40);
    const vy = 78 + hash2(i, 25, p.seed) * 44;
    const x = Math.round(from + vx * a + Math.sin(a * 5 + i) * 2);
    const y = Math.round(
      p.touchY - 8 - hash2(i, 26, p.seed) * 6 - vy * a - 14 * a * a,
    );
    if (y < -3 || x < -4 || x > p.w + 4) continue;
    const beat = (Math.floor(a * 10) + i) % 4;
    const wing = beat === 0 ? -1 : beat === 2 ? 1 : 0;
    if (a < 1.5) {
      // near: a dark body between two pale wings five px long, thick at the shoulder,
      // that beat up, level, down, level
      for (let d = 1; d <= 5; d++) {
        const o = wing * (d <= 2 ? 1 : d <= 4 ? 2 : 3);
        const thick = d <= 3 ? 2 : 1;
        s.rect(x - 1 - d, y + o, 1, thick, p.birdWing);
        s.rect(x + 1 + d, y + o, 1, thick, p.birdWing);
      }
      s.rect(x - 1, y, 3, 2, p.bird);
      s.px(x + (dir < 0 ? -2 : 2), y, p.bird);
    } else if (a < 2.4) {
      // further off: a small pale v on a dark dot that opens and closes
      s.rect(x - 3, y + wing, 2, 1, p.birdWing);
      s.rect(x + 2, y + wing, 2, 1, p.birdWing);
      s.rect(x - 1, y, 3, 1, p.bird);
    } else {
      // far away: a dash
      s.rect(x - 1, y, 3, 1, p.birdWing);
    }
  }
}

// ---------------------------------------------------------------------------
// The confetti cannons (tiers 4 to 7, a golazo and a worldie)
// ---------------------------------------------------------------------------

const PAPER: Color[] = [
  P.gold,
  P.goldLight,
  P.chalk,
  P.home,
  P.homeLight,
  P.white,
];

/** When each of the two cannons goes, in seconds after the goal. */
const CANNON_AT: readonly number[] = [0.12, 0.3];

/** How many pieces each cannon throws. */
export function cannonPieces(size: number): number {
  return Math.round(26 + 40 * clamp(size));
}

function cannons(s: Surface, p: Pyro): void {
  const z = clamp(p.size);
  if (z < CONFETTI_FROM) return;
  if (p.era === "retro") {
    PAPER[0] = P.chalk;
    PAPER[1] = P.retroLight;
    PAPER[2] = P.white;
  } else if (p.era === "nextgen") {
    PAPER[0] = P.white;
    PAPER[1] = P.skyLow;
    PAPER[2] = P.awayLight;
  } else {
    PAPER[0] = P.gold;
    PAPER[1] = P.goldLight;
    PAPER[2] = P.chalk;
  }
  PAPER[3] = p.mode;
  PAPER[4] = p.modeLight;
  const n = cannonPieces(z);
  const span = p.x1 - p.x0;
  for (let c = 0; c < 2; c++) {
    const ox = p.goalX - 22 - Math.round(c * span * 0.24);
    const oy = p.touchY - 2;
    const t = p.age - CANNON_AT[c];
    if (t < 0) continue;
    for (let k = 0; k < n; k++) {
      const id = c * 97 + k;
      const up = 0.45 + hash2(id, 31, p.seed) * 0.25;
      const top = (50 + hash2(id, 32, p.seed) * 60) * (0.75 + 0.25 * z);
      const fan = (hash2(id, 33, p.seed) - 0.62) * 150;
      const land = p.groundY + 4 + hash2(id, 35, p.seed) * 44;
      const fall = Math.max(
        44 + hash2(id, 34, p.seed) * 30,
        (land - (oy - top)) / 2.6,
      );
      let y: number;
      if (t < up) {
        const q = 1 - t / up;
        y = oy - top * (1 - q * q);
      } else {
        y = oy - top + (t - up) * fall;
      }
      // it lands on the grass and is gone
      if (y > land) continue;
      const out = fan * (1 - Math.exp(-2.4 * t));
      const sway =
        Math.sin(t * (2 + hash2(id, 36, p.seed)) + k) * 3 * Math.min(1, t / up);
      const x = Math.round(ox + out + sway);
      const yy = Math.round(y);
      const col = PAPER[id % PAPER.length];
      const turn = (Math.floor(t * 8) + id) % 4;
      if (turn === 0) s.rect(x, yy, 2, 4, col);
      else if (turn === 1) s.rect(x, yy, 4, 2, col);
      else if (turn === 2) s.rect(x, yy, 3, 3, col);
      else s.rect(x, yy + 1, 4, 1, col);
    }
  }
}

// ---------------------------------------------------------------------------
// The show
// ---------------------------------------------------------------------------

/**
 * What goes off behind the players (drawn after the ground's back layer, before the cast):
 * the birds, or the flares and their smoke, or the flame jets.
 */
export function drawPyroBack(s: Surface, p: Pyro): void {
  if (!(p.age >= 0) || p.age >= PYRO_SECONDS) return;
  const kind = pyroKind(p.tier);
  if (kind === "birds") birds(s, p);
  else if (kind === "flares") flares(s, p);
  else jets(s, p);
}

/** What comes down in front of everything: the cannons' confetti. */
export function drawPyroFront(s: Surface, p: Pyro): void {
  if (!(p.age >= 0) || p.age >= PYRO_SECONDS) return;
  if (pyroKind(p.tier) === "jets") cannons(s, p);
}
