/**
 * RETRO's small grounds (tiers 0 to 3, .snaps/era-art/THEME.md): the village green and its
 * bandstand, the Victorian street behind, the rope nets on square wooden posts, the club's
 * wooden stands. Each beside HOME's where a pair helps.
 *
 *   ./node_modules/.bin/tsx tools/snap.ts ground-low/retro-tier0 --w 960 --h 540 --scale 1
 *   ./node_modules/.bin/tsx tools/snap.ts "ground-low/retro-*" --time night --scale 1
 *
 * `ground-low/retro-tier0` .. `retro-tier3` draw the whole ground at the shot's own size,
 * with no cast; `ground-low/retro-pair<n>` is HOME's above RETRO's at 960 x 540 (or the
 * shot's size); the parts are rectangles of the 960 x 540 picture.
 */

import type { Era } from "~/art/era";
import { lightingFor } from "~/art/lighting";
import { Surface, type ShotContext, type ShotMap } from "~/pixel";
import { CareerGround } from "./ground";
import type { Tier } from "./types";

const LABELS = {
  boards: ["SOCCERSENSE", "HOT PIES", "TEA BAR", "COME ON THEN"],
  banners: ["HOMETOWN HERO", "ONE OF OUR OWN"],
};

/** The whole ground at a tier, at w x h, with a ball in the net when `bulge` is given. */
function draw(
  ctx: ShotContext,
  tier: Tier,
  w: number,
  h: number,
  era: Era,
  bulge = 0,
): Surface {
  const s = new Surface(w, h);
  const g = new CareerGround({
    seed: ctx.seed,
    mode: "home",
    tier,
    labels: LABELS,
    era,
  });
  g.resize(w, h);
  g.setLighting(lightingFor(ctx.sun));
  g.drawBack(s, ctx.t);
  const b = bulge > 0 ? { y: g.goal.barY + 12, amount: bulge } : null;
  g.drawFront(s, ctx.t, b);
  return s;
}

/** A rectangle (x, y, w, h) of the 960 x 540 picture. */
function part(
  ctx: ShotContext,
  tier: Tier,
  x: number,
  y: number,
  w: number,
  h: number,
  era: Era = "retro",
): Surface {
  const whole = draw(ctx, tier, 960, 540, era);
  const out = new Surface(w, h);
  out.copy(whole, -x, -y);
  return out;
}

/** HOME's above RETRO's, 4 px apart. */
function pair(ctx: ShotContext, tier: Tier): Surface {
  const w = ctx.w;
  const h = ctx.h;
  const out = new Surface(w, h * 2 + 4);
  out.copy(draw(ctx, tier, w, h, "today"), 0, 0);
  out.copy(draw(ctx, tier, w, h, "retro"), 0, h + 4);
  return out;
}

export const shots: ShotMap = {
  ...Object.fromEntries(
    ([0, 1, 2, 3] as const).map((tier) => [
      `ground-low/retro-tier${tier}`,
      (ctx: ShotContext) => draw(ctx, tier, ctx.w, ctx.h, "retro"),
    ]),
  ),
  ...Object.fromEntries(
    ([0, 1, 2, 3] as const).map((tier) => [
      `ground-low/retro-pair${tier}`,
      (ctx: ShotContext) => pair(ctx, tier),
    ]),
  ),
  /** Tiers 0 to 3 side by side at the shot's size (default a phone), RETRO's under HOME's. */
  "ground-low/retro-row": (ctx) => {
    const w = ctx.w;
    const h = ctx.h;
    const out = new Surface(4 * (w + 4), 2 * (h + 4));
    for (let tier = 0; tier < 4; tier++) {
      out.copy(draw(ctx, tier as Tier, w, h, "today"), tier * (w + 4), 0);
      out.copy(draw(ctx, tier as Tier, w, h, "retro"), tier * (w + 4), h + 4);
    }
    return out;
  },
  /** The goals of tiers 0 to 3 in RETRO, close up: no ball, then a ball's bulge. */
  "ground-low/retro-goals": (ctx) => {
    const out = new Surface(4 * 120, 2 * 90);
    for (let tier = 0; tier < 4; tier++) {
      for (let k = 0; k < 2; k++) {
        const whole = draw(ctx, tier as Tier, 960, 540, "retro", k);
        out.pushClip(tier * 120, k * 90, 120, 90);
        out.copy(whole, tier * 120 - 550, k * 90 - 200);
        out.popClip();
      }
    }
    return out;
  },
  /** His street, the church and the mill (tier 0). */
  "ground-low/retro-street": (ctx) => part(ctx, 0, 180, 100, 420, 170),
  /** The bandstand, the old trees, the green (tier 0). */
  "ground-low/retro-green": (ctx) => part(ctx, 0, 0, 120, 480, 170),
  /** The park's near side: the cobbled path, the bench, the gas lamp, the picnic. */
  "ground-low/retro-park": (ctx) => part(ctx, 0, 200, 300, 480, 150),
  "ground-low/retro-tier1-near": (ctx) => part(ctx, 1, 240, 320, 420, 120),
  "ground-low/retro-club": (ctx) => part(ctx, 2, 200, 100, 480, 200),
  "ground-low/retro-club-near": (ctx) => part(ctx, 2, 200, 330, 480, 140),
  "ground-low/retro-proper": (ctx) => part(ctx, 3, 0, 40, 960, 260),
  "ground-low/retro-proper-near": (ctx) => part(ctx, 3, 200, 330, 480, 160),
};
