/**
 * The golden ball's fireworks: the show over the town as the menu's ball turns to gold (the
 * easter egg, scenes/menu.ts). Big rockets, one after another, each climbing on a thin
 * trail and opening into a burst of streaks that hangs, droops and twinkles out: gold ones,
 * and one in each mode's colour between them.
 *
 *   drawGoldShow(s, secondsSinceTheBallTurned, { top, floor, seed, night });
 *   GOLD_SHOW_LAUNCHES   // when each rocket goes up, for the sound
 *   GOLD_SHOW_LEN        // when the last spark is out
 *
 * A pure function of the time passed in: the same call gives the same pixels. Raw colours,
 * as every light in the sky. Nothing is drawn above `top` (the logo's sky).
 */

import { MODE_COLORS, P } from "~/art/palette";
import { type Color, type Surface, clamp, hash2, lerp } from "~/pixel";

/** When each rocket goes up, seconds after the ball turns. */
export const GOLD_SHOW_LAUNCHES: readonly number[] = [
  0.1, 0.45, 0.8, 1.3, 1.7, 2.2, 2.7, 3.2, 3.8, 4.4, 5.0,
];
/** Seconds a rocket climbs, and its burst lasts. */
const RISE = 0.4;
const BURST = 1.3;
/** The last spark is out by now (seconds after the ball turns). */
export const GOLD_SHOW_LEN =
  GOLD_SHOW_LAUNCHES[GOLD_SHOW_LAUNCHES.length - 1] + RISE + BURST;

/**
 * A burst is UNIT of the canvas's shorter side across its radius (UNIT_MIN to UNIT_MAX
 * pixels), SMALL to BIG times that; it has STREAKS streaks, and INNER more half way out.
 */
const UNIT = 0.11;
const UNIT_MIN = 14;
const UNIT_MAX = 64;
const SMALL = 0.75;
const BIG = 1.25;
const STREAKS = 28;
const INNER = 14;
/** They keep this share of the width clear at each side. */
const MARGIN = 0.08;

/** A burst's colours: its flash, its light, its body and its dark. */
type Tones = readonly [Color, Color, Color, Color];
const GOLD: Tones = [P.white, P.goldLight, P.gold, P.goldDark];
const tonesOf = (c: { dark: Color; base: Color; light: Color }): Tones => [
  P.white,
  c.light,
  c.base,
  c.dark,
];
/** Gold, and a mode's colour between: HOME, AWAY, NEXT-GEN. (RETRO's is a gold already.) */
const TONES: readonly Tones[] = [
  GOLD,
  tonesOf(MODE_COLORS.home),
  GOLD,
  tonesOf(MODE_COLORS.away),
  GOLD,
  tonesOf(MODE_COLORS.nextgen),
];

export interface GoldShowOptions {
  /** The first row the show may use: the bottom of the logo's sky. */
  top: number;
  /** The lowest row the middle of a burst may be on: about the far side of the stadium. */
  floor: number;
  /** The day's seed: where each rocket goes up. */
  seed: number;
  /** The floodlights are on: the bursts glow, in their light tones. */
  night: boolean;
}

/** The show at `t` seconds after the ball turned. Nothing before 0 or after GOLD_SHOW_LEN. */
export function drawGoldShow(
  s: Surface,
  t: number,
  opts: GoldShowOptions,
): void {
  if (!(t >= 0) || t >= GOLD_SHOW_LEN) return;
  const w = s.w;
  const h = s.h;
  const top = clamp(Math.round(opts.top), 0, h);
  const unit = clamp(Math.min(w, h) * UNIT, UNIT_MIN, UNIT_MAX);
  const count = GOLD_SHOW_LAUNCHES.length;
  const beat = Math.floor(t * 12);
  const night = opts.night;
  s.pushClip(0, top, w, h - top);
  for (let i = 0; i < count; i++) {
    const a = t - GOLD_SHOW_LAUNCHES[i];
    if (a < 0 || a >= RISE + BURST) continue;
    const r = unit * lerp(SMALL, BIG, hash2(i, 3, opts.seed));
    // across the width in strides, so two in a row are never side by side
    const lane = (i * 5) % count;
    const jitter = (hash2(i, 1, opts.seed) - 0.5) * 0.6;
    const x = Math.round(
      w * (MARGIN + ((lane + 0.5 + jitter) / count) * (1 - 2 * MARGIN)),
    );
    // its middle between the logo's sky and the stadium's far side
    const high = top + r * 0.7;
    const low = Math.max(high, opts.floor);
    const apex = Math.round(lerp(high, low, hash2(i, 2, opts.seed)));
    const tones = TONES[i % TONES.length];
    if (a < RISE) {
      // the climb slows as it goes: a spark on a thin trail
      const u = a / RISE;
      const y = apex + Math.round((1 - u * (2 - u)) * r * 1.6);
      s.rect(x, y, 2, 3, P.goldLight);
      s.rect(x, y + 3, 2, 3, P.gold);
      s.rect(x, y + 6, 1, 4, P.goldDark);
      continue;
    }
    const e = (a - RISE) / BURST;
    // it opens fast and hangs, drooping as it fades
    const grow = 1 - (1 - e) * (1 - e) * (1 - e);
    const droop = Math.round(e * e * r * 0.3);
    const cy = apex + droop;
    if (night && e < 0.5) {
      s.disc(
        x,
        cy,
        Math.round(r * grow * 0.95),
        tones[1],
        e < 0.2 ? 0.3 : 0.15,
      );
    }
    if (e < 0.14) s.disc(x, cy, e < 0.07 ? 4 : 2, P.white);
    // by night the light tones glow; by day, against a pale sky, the strong ones
    const head = night ? (e < 0.5 ? tones[1] : tones[2]) : tones[2];
    const tail = night ? tones[2] : tones[3];
    for (let ring = 0; ring < 2; ring++) {
      const n = ring === 0 ? STREAKS : INNER;
      const reach = r * grow * (ring === 0 ? 1 : 0.55);
      const turn = i * 0.7 + ring * 0.31;
      const long = e < 0.6 ? (ring === 0 ? 6 : 3) : 2;
      for (let j = 0; j < n; j++) {
        // the last of it twinkles out
        if (e > 0.6 && (j + beat + i) % 3 === 0) continue;
        if (e > 0.8 && (j + beat) % 2 === 0) continue;
        const an = (j / n) * Math.PI * 2 + turn;
        const c = Math.cos(an);
        const sn = Math.sin(an) * 0.92;
        // a streak from the middle outwards, bright at its head
        for (let q = long; q >= 1; q--) {
          const d = reach - q * 2.4;
          if (d < 3) continue;
          s.rect(x + Math.round(c * d), cy + Math.round(sn * d), 2, 2, tail);
        }
        if (reach < 3) continue;
        const hx = x + Math.round(c * reach);
        const hy = cy + Math.round(sn * reach);
        s.rect(hx, hy, 2, 2, head);
        if (e < 0.3) s.px(hx, hy, tones[0]);
      }
    }
  }
  s.popClip();
}
