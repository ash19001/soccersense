/**
 * The golden ball's sparkle: glints opening and closing here and there on its gold leather,
 * all the time, so that its shimmer is seen as well as heard (the product owner, 2026-11-16:
 * "add some sparkle effect on ball when its golden so the shimmer sound makes sense"). The
 * menu's easter egg (scenes/menu.ts) draws it over the ball it has just drawn.
 *
 *   drawGoldSparkle(s, { cx, cy, r, t, seed });   // the ball is on `s` already
 *
 * Each glint has a beat of its own: every GLINT_EVERY seconds, give or take GLINT_SWING of
 * that, it opens and closes at a new place, GLINT_FPS frames a second, small (GLINT_SMALL,
 * its arms' length frame by frame) or, one in GLINT_BIG, large (GLINT_LARGE). Its place is
 * looked for on the ball as it is drawn: gold leather under every pixel of it at its
 * biggest, never a panel, a panel's frame or what a panel carries, and not the ball's own
 * white glint. So it is right however the ball has been turned, in any light.
 *
 * A pure function of what is passed in: the same call on the same picture gives the same
 * pixels. Raw colours, as every light.
 */

import { P } from "~/art/palette";
import {
  TRANSPARENT,
  type Color,
  type Surface,
  clamp,
  hash2,
  lerp,
  toRgb,
} from "~/pixel";

/**
 * GLINTS glints on a ball of GLINT_FULL pixels' radius or more, fewer on a smaller one,
 * never under GLINTS_FEW; LIVELY times as many while the ball is being celebrated.
 */
const GLINTS = 10;
const GLINTS_FEW = 5;
const GLINT_FULL = 64;
const LIVELY = 1.5;
const GLINT_EVERY = 0.9;
const GLINT_SWING = 0.3;
const GLINT_FPS = 14;
const GLINT_SMALL: readonly number[] = [0, 1, 2, 3, 3, 2, 1, 0];
const GLINT_LARGE: readonly number[] = [0, 1, 3, 5, 6, 6, 5, 3, 1, 0];
const GLINT_BIG = 3;
/** A glint that is not large (the small ones at their longest, and the still ones). */
const SMALL_ARM = 3;
/**
 * A place is looked for GLINT_TRIES times at most, between GLINT_IN and GLINT_OUT of the
 * radius from the ball's middle. (No place: no glint, this time.)
 */
const GLINT_TRIES = 5;
const GLINT_IN = 0.1;
const GLINT_OUT = 0.9;
/**
 * With `still` (reduced motion) nothing opens or closes: this many stand on the leather,
 * each where it is for as long as the leather under it is clear (the menu's ball rocks very
 * slowly even then: a panel that comes under a glint moves it to its next place).
 */
const GLINTS_STILL = 4;

const TAU = Math.PI * 2;

export interface GoldSparkle {
  /** The ball: its middle and its radius, in pixels of `s`. */
  cx: number;
  cy: number;
  r: number;
  /** Seconds: the clock it sparkles by. */
  t: number;
  seed: number;
  /** The ball has just turned to gold and is being celebrated: more of them. */
  lively?: boolean;
  /** Reduced motion: a few glints that stand still, whatever `t`. */
  still?: boolean;
}

/**
 * Is this a pixel of the golden ball's leather (any tone of its gold, in any light)? Not
 * its white glint, a black panel, a panel's coloured frame or lettering, or nothing. Gold
 * is warm and has little blue in it: its green is at least 0.54 of its red (HOME's orange
 * has less) and its blue at most three quarters of its green (white and chalk have more).
 */
export function isGoldLeather(c: Color): boolean {
  if (c === TRANSPARENT) return false;
  const [r, g, b] = toRgb(c);
  return r >= 110 && g >= r * 0.54 && b <= g * 0.75;
}

/**
 * A glint on gold: a four-point star with arms `arm` pixels long (0: a point of light).
 * Fine rays, white for most of their length and pale gold at their ends, a heart three
 * pixels across from 3 up, and sparkles on the diagonals from 5. Gold is drawn close round
 * it, so that it shows on the palest of the leather as on the darkest.
 */
export function drawGlint(s: Surface, x: number, y: number, arm: number): void {
  const core = P.white;
  const tips = P.goldLight;
  const edge = P.gold;
  if (arm <= 0) {
    s.px(x, y, core);
    return;
  }
  if (arm >= 2) {
    s.rect(x - arm - 1, y - 1, 2 * arm + 3, 3, edge);
    s.rect(x - 1, y - arm - 1, 3, 2 * arm + 3, edge);
    if (arm >= 3) s.rect(x - 2, y - 2, 5, 5, edge);
  }
  s.hline(x - arm, y, 2 * arm + 1, tips);
  s.vline(x, y - arm, 2 * arm + 1, tips);
  const white = arm >= 4 ? arm - 2 : arm - 1;
  s.hline(x - white, y, 2 * white + 1, core);
  s.vline(x, y - white, 2 * white + 1, core);
  if (arm >= 3) s.rect(x - 1, y - 1, 3, 3, core);
  if (arm >= 5) {
    for (let d = 2; d <= 3; d++) {
      s.px(x - d, y - d, tips);
      s.px(x + d, y - d, tips);
      s.px(x - d, y + d, tips);
      s.px(x + d, y + d, tips);
    }
  }
}

/**
 * Draws the sparkle of this moment over the golden ball on `s`, and says how many glints
 * it drew. Nothing on a ball that is not gold (there is no leather to find).
 */
export function drawGoldSparkle(s: Surface, o: GoldSparkle): number {
  const { cx, cy, r, seed } = o;
  if (!(r > 0) || !Number.isFinite(o.t)) return 0;
  const gold = (x: number, y: number): boolean => isGoldLeather(s.get(x, y));
  /**
   * Gold under every pixel a glint with arms `reach` long paints at (x, y) (`drawGlint`):
   * its two bars, three pixels thick with the gold round them, its heart and its sparkles.
   */
  const fits = (x: number, y: number, reach: number): boolean => {
    const far = reach + 1;
    for (let d = -far; d <= far; d++) {
      for (let w = -1; w <= 1; w++) {
        if (!gold(x + d, y + w) || !gold(x + w, y + d)) return false;
      }
    }
    // the heart's five by five, and the sparkles on the diagonals
    for (let j = -2; j <= 2; j++) {
      for (let i = -2; i <= 2; i++) {
        if (!gold(x + i, y + j)) return false;
      }
    }
    return (
      gold(x - 3, y - 3) &&
      gold(x + 3, y - 3) &&
      gold(x - 3, y + 3) &&
      gold(x + 3, y + 3)
    );
  };
  /** The place of glint `i` in its `n`th life, for arms `reach` long: null if none is found. */
  const place = (
    i: number,
    n: number,
    reach: number,
  ): { x: number; y: number } | null => {
    for (let k = 0; k < GLINT_TRIES; k++) {
      const a = hash2(i * GLINT_TRIES + k, n, seed + 11) * TAU;
      // (the root spreads them evenly over the ball's face)
      const d =
        r *
        lerp(
          GLINT_IN,
          GLINT_OUT,
          Math.sqrt(hash2(i * GLINT_TRIES + k, n, seed + 12)),
        );
      const x = Math.round(cx + Math.cos(a) * d);
      const y = Math.round(cy + Math.sin(a) * d);
      if (fits(x, y, reach)) return { x, y };
    }
    return null;
  };
  // Where each is put is settled before any is drawn, so that one glint's light is not
  // taken for something other than leather by the next.
  const lit: { x: number; y: number; arm: number }[] = [];
  if (o.still === true) {
    for (let i = 0; i < GLINTS_STILL; i++) {
      const at = place(i, 0, SMALL_ARM);
      if (at) lit.push({ x: at.x, y: at.y, arm: SMALL_ARM });
    }
  } else {
    const few = clamp(
      Math.round((GLINTS * r) / GLINT_FULL),
      GLINTS_FEW,
      GLINTS,
    );
    const count = o.lively === true ? Math.round(few * LIVELY) : few;
    for (let i = 0; i < count; i++) {
      const every =
        GLINT_EVERY * (1 + (hash2(i, 1, seed + 13) - 0.5) * 2 * GLINT_SWING);
      const lap = o.t / every + hash2(i, 2, seed + 13);
      const n = Math.floor(lap);
      const large = Math.floor(hash2(i, n, seed + 14) * GLINT_BIG) === 0;
      const sizes = large ? GLINT_LARGE : GLINT_SMALL;
      const frame = Math.floor((lap - n) * every * GLINT_FPS);
      if (frame < 0 || frame >= sizes.length) continue;
      const at = place(i, n, large ? Math.max(...GLINT_LARGE) : SMALL_ARM);
      if (at) lit.push({ x: at.x, y: at.y, arm: sizes[frame] });
    }
  }
  for (const g of lit) drawGlint(s, g.x, g.y, g.arm);
  return lit.length;
}
