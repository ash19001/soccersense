/**
 * NEXT-GEN's small grounds (tiers 0 to 3, `nextgen-low.ts`): the whole ground at the shot's
 * size with stand-in figures of the cast's sizes, and parts of the 960 x 540 picture to zoom
 * into. HOME's are `ground-low/*`.
 *
 *   ./node_modules/.bin/tsx tools/snap.ts ground-low/nextgen-t2 --w 960 --h 540 --scale 1
 *   ./node_modules/.bin/tsx tools/snap.ts ground-low/nextgen-street --time night --scale 2
 */

import { careerLayout } from "~/art/layout";
import { lightingFor } from "~/art/lighting";
import { P } from "~/art/palette";
import { Surface, type Color, type ShotContext, type ShotMap } from "~/pixel";
import { CareerGround } from "./ground";
import type { Tier } from "./types";

const LABELS = {
  boards: ["Play daily", "Seven questions", "Home", "Away"],
  banners: ["Hometown hero", "Come on"],
};

/** The whole NEXT-GEN ground at a tier, at w x h, at scene time t. */
function draw(ctx: ShotContext, tier: Tier, w: number, h: number): Surface {
  const s = new Surface(w, h);
  const g = new CareerGround({
    seed: ctx.seed,
    mode: "home",
    tier,
    labels: LABELS,
    era: "nextgen",
  });
  g.resize(w, h);
  g.setLighting(lightingFor(ctx.sun));
  g.drawBack(s, ctx.t);
  g.drawFront(s, ctx.t);
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
): Surface {
  const whole = draw(ctx, tier, 960, 540);
  const out = new Surface(w, h);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) out.px(i, j, whole.get(x + i, y + j));
  }
  return out;
}

/** Outlined stand-ins of the cast's sizes where the cast stands. */
function cast(s: Surface, tier: Tier): void {
  const c = careerLayout(s.w, s.h);
  const k = c.stageScale;
  const kid = tier <= 1;
  const w = kid ? 20 : 24;
  const h = kid ? 28 : 36;
  const at = (off: number): number => c.cx + Math.round(off * k);
  const people: [number, number, Color][] = [
    [at(-6), c.groundY - 10, P.home],
    [at(24), c.groundY - 8, P.duskMid],
    [c.keeperX, c.groundY, P.gold],
    [c.heroX, c.groundY, P.homeLight],
    [at(-52), c.groundY + 8, P.home],
    [at(10), c.groundY + 10, P.duskMid],
  ];
  people.sort((a, b) => a[1] - b[1]);
  for (const [x, y, col] of people) {
    const x0 = x - (w >> 1);
    s.rect(x0, y - h, w, h, P.ink);
    s.rect(x0 + 1, y - h + 1, w - 2, h - 2, col);
    s.rect(x0 + 6, y - h + 2, w - 12, 8, P.skinA);
  }
}

export const shots: ShotMap = {
  ...Object.fromEntries(
    ([0, 1, 2, 3] as const).map((tier) => [
      `ground-low/nextgen-t${tier}`,
      (ctx: ShotContext) => {
        const s = draw(ctx, tier, ctx.w, ctx.h);
        cast(s, tier);
        return s;
      },
    ]),
  ),
  /** The city: the skyline, the townhouses, the needle tower, the hedge and its rail. */
  "ground-low/nextgen-street": (ctx) => part(ctx, 0, 180, 60, 400, 210),
  /** The park's near side (tier 0). */
  "ground-low/nextgen-park": (ctx) => part(ctx, 0, 240, 300, 420, 140),
  /** Tier 1: the pod, the parents, the line of light, the subs. */
  "ground-low/nextgen-tier1-far": (ctx) => part(ctx, 1, 160, 190, 360, 90),
  "ground-low/nextgen-tier1-near": (ctx) => part(ctx, 1, 260, 340, 360, 90),
  /** Tier 2: the stand, the kiosk, the masts, the boards. */
  "ground-low/nextgen-club": (ctx) => part(ctx, 2, 300, 100, 360, 180),
  "ground-low/nextgen-club-near": (ctx) => part(ctx, 2, 240, 340, 400, 120),
  /** Tier 3: the main stand, the terrace, the scoreboard, the masts, the end. */
  "ground-low/nextgen-proper": (ctx) => part(ctx, 3, 280, 40, 520, 240),
  "ground-low/nextgen-proper-near": (ctx) => part(ctx, 3, 240, 340, 400, 140),
  /** The goal at tiers 0 to 2, close. */
  "ground-low/nextgen-goal0": (ctx) => part(ctx, 0, 560, 200, 160, 100),
  "ground-low/nextgen-goal1": (ctx) => part(ctx, 1, 560, 200, 160, 100),
  "ground-low/nextgen-goal2": (ctx) => part(ctx, 2, 560, 200, 160, 100),
};
