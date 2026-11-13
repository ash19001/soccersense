/**
 * RETRO's big grounds (tiers 4 to 7) without the cast: the whole ground at `ctx.w` x
 * `ctx.h`, and close crops of its parts at 960 x 540.
 *
 *   ./node_modules/.bin/tsx tools/snap.ts ground/retro-t4 --w 960 --h 540 --scale 1
 *   ./node_modules/.bin/tsx tools/snap.ts ground/retro-stand --time night --scale 2
 *
 * Shots: `ground/retro-t4` to `ground/retro-t7`, `ground/retro-stand` (the middle of the
 * grandstand), `ground/retro-end` (the corner and the end), `ground/retro-near` (the near
 * side), `ground/retro-goal` (the goal with a ball in the net, bulged).
 */

import { lightingFor } from "~/art/lighting";
import { Surface, type ShotContext, type ShotMap } from "~/pixel";
import { CareerGround } from "./ground";
import type { Tier } from "./types";

const LABELS = {
  boards: ["SOCCERSENSE", "HOT PIES", "TEA BAR", "COME ON THEN"],
  banners: ["HOMETOWN HERO", "ONE OF OUR OWN", "BRING IT HOME"],
};

function whole(ctx: ShotContext, tier: Tier, w = ctx.w, h = ctx.h): Surface {
  const g = new CareerGround({
    seed: ctx.seed,
    mode: "home",
    tier,
    labels: LABELS,
    era: "retro",
  });
  g.resize(w, h);
  g.setLighting(lightingFor(ctx.sun));
  const s = new Surface(w, h);
  g.drawBack(s, ctx.t);
  g.drawFront(s, ctx.t, ctx.t > 0 ? { y: g.goal.barY + 16, amount: 1 } : null);
  return s;
}

function crop(s: Surface, x: number, y: number, w: number, h: number): Surface {
  const c = new Surface(w, h);
  c.copy(s, -x, -y);
  return c;
}

const shots: ShotMap = {
  "ground/retro-stand": (ctx) =>
    crop(whole(ctx, 5, 960, 540), 240, 100, 360, 190),
  "ground/retro-end": (ctx) => crop(whole(ctx, 5, 960, 540), 560, 90, 400, 320),
  "ground/retro-near": (ctx) => crop(whole(ctx, 6, 960, 540), 0, 330, 960, 210),
  "ground/retro-goal": (ctx) =>
    crop(whole(ctx, 4, 960, 540), 560, 200, 140, 110),
};
for (const tier of [4, 5, 6, 7] as const) {
  shots[`ground/retro-t${tier}`] = (ctx) => whole(ctx, tier);
}

export { shots };
