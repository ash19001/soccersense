/**
 * Shots of the career grounds. Stand-in figures (plain outlined blocks: 12 x 18, or
 * 10 x 14 at tiers 0 and 1) and a 3 x 3 ball stand where the cast will.
 *
 *   ./node_modules/.bin/tsx tools/snap.ts ground/ladder --w 480 --h 270 --scale 1
 *   ./node_modules/.bin/tsx tools/snap.ts ground/tier4 --w 480 --h 270 --time night
 */

import type { Mode } from "~/game/types";
import { careerLayout } from "~/art/layout";
import { lightingFor } from "~/art/lighting";
import { P } from "~/art/palette";
import {
  FONT_3x5,
  Surface,
  drawText,
  type Color,
  type ShotContext,
  type ShotMap,
} from "~/pixel";
import { CareerGround } from "./ground";
import { CROWD_MOODS, GROUND_TIERS, type NetBulge, type Tier } from "./types";

function standIn(
  s: Surface,
  x: number,
  y: number,
  w: number,
  h: number,
  c: Color,
): void {
  const x0 = x - (w >> 1);
  s.rect(x0, y - h, w, h, P.ink);
  s.rect(x0 + 1, y - h + 1, w - 2, h - 2, c);
  s.rect(x0 + 3, y - h + 1, w - 6, 3, P.skinA);
}

function cast(
  s: Surface,
  ground: CareerGround,
  tier: Tier,
  light = ground.light,
): void {
  const c = careerLayout(s.w, s.h);
  const k = c.stageScale;
  const at = (off: number): number => c.cx + Math.round(off * k);
  const kid = tier <= 1;
  const w = kid ? 10 : 12;
  const h = kid ? 14 : 18;
  const mate = light.lit(P.home);
  const foe = light.lit(P.duskMid);
  const people: [number, number, Color][] = [
    [at(-6), c.groundY - 5, mate],
    [at(24), c.groundY - 4, foe],
    [c.keeperX, c.groundY, light.lit(P.gold)],
    [c.heroX, c.groundY, light.lit(P.homeLight)],
    [at(-52), c.groundY + 4, mate],
    [at(10), c.groundY + 5, foe],
  ];
  if (tier >= 2) people.unshift([at(-40), c.groundY - 6, light.lit(P.night)]);
  people.sort((a, b) => a[1] - b[1]);
  for (const [x, y, col] of people) standIn(s, x, y, w, h, col);
  // the ball at his feet
  s.rect(c.heroX + 6, c.groundY - 3, 3, 3, light.lit(P.white));
  s.px(c.heroX + 6, c.groundY - 1, P.ink);
  s.hline(c.heroX + 6, c.groundY, 3, light.lit(P.grassDeep));
}

function scene(
  ctx: ShotContext,
  tier: Tier,
  mode: Mode = "home",
  w = ctx.w,
  h = ctx.h,
): Surface {
  const s = new Surface(w, h);
  const ground = new CareerGround({
    seed: ctx.seed,
    mode,
    tier,
    labels: SAMPLE_LABELS,
  });
  ground.resize(w, h);
  ground.setLighting(lightingFor(ctx.sun));
  ground.drawBack(s, ctx.t);
  cast(s, ground, tier);
  ground.drawFront(s, ctx.t);
  return s;
}

/** Stand-in words: the scene passes its own from app/i18n. */
const SAMPLE_LABELS = {
  boards: ["SOCCERSENSE", "PLAY DAILY", "7 QUESTIONS", "HOME", "AWAY"],
  banners: ["COME ON", "WORLDIE!", "TOP BINS"],
};

function grid(tiles: Surface[], cols: number, gap = 2): Surface {
  const tw = tiles[0].w;
  const th = tiles[0].h;
  const rows = Math.ceil(tiles.length / cols);
  const out = new Surface(
    cols * tw + (cols - 1) * gap,
    rows * th + (rows - 1) * gap,
  );
  out.clear(P.ink);
  tiles.forEach((t, i) =>
    out.copy(t, (i % cols) * (tw + gap), Math.floor(i / cols) * (th + gap)),
  );
  return out;
}

function label(s: Surface, text: string): Surface {
  drawText(s, text, 3, 3, P.chalk, { font: FONT_3x5, outline: P.ink });
  return s;
}

export const shots: ShotMap = {
  ...Object.fromEntries(
    GROUND_TIERS.map((tier) => [
      `ground/tier${tier}`,
      (ctx: ShotContext) => scene(ctx, tier),
    ]),
  ),
  "ground/ladder": (ctx) =>
    grid(
      GROUND_TIERS.map((tier) => label(scene(ctx, tier), `TIER ${tier}`)),
      2,
    ),
  "ground/away": (ctx) => scene(ctx, 4, "away"),
  "ground/moods": (ctx) => {
    // the stand at tier 4 a moment after each mood was set
    const tiles = CROWD_MOODS.map((mood) => {
      const s = new Surface(ctx.w, ctx.h);
      const ground = new CareerGround({
        seed: ctx.seed,
        mode: "home",
        tier: 4,
      });
      ground.resize(ctx.w, ctx.h);
      ground.setLighting(lightingFor(ctx.sun));
      ground.setMood(mood, ctx.t);
      ground.drawBack(s, ctx.t + 0.7);
      ground.drawFront(s, ctx.t + 0.7);
      const c = careerLayout(ctx.w, ctx.h);
      const crop = new Surface(ctx.w, c.farTouchY - c.boardShrunkY + 4);
      crop.copy(s, 0, -c.boardShrunkY);
      return label(crop, mood.toUpperCase());
    });
    return grid(tiles, 1);
  },
  "ground/goal": (ctx) => {
    const tiles: Surface[] = [];
    for (const tier of [0, 1, 2] as const) {
      for (const amount of [0, 0.5, 1]) {
        const s = new Surface(ctx.w, ctx.h);
        const ground = new CareerGround({ seed: ctx.seed, mode: "home", tier });
        ground.resize(ctx.w, ctx.h);
        ground.setLighting(lightingFor(ctx.sun));
        ground.drawBack(s, ctx.t);
        const gl = ground.goal;
        // the ball in the back of the net, under the bar
        const by = gl.barY + 6;
        const bx = gl.lineX + Math.max(2, gl.depth - 3);
        s.rect(bx, by, 3, 3, P.white);
        s.px(bx + 2, by + 2, P.ink);
        const bulge: NetBulge | null =
          amount > 0 ? { y: by + 1, amount } : null;
        ground.drawFront(s, ctx.t, bulge);
        const crop = new Surface(44, 40);
        crop.copy(s, -(gl.lineX - 18), -(gl.barY - 10));
        tiles.push(crop);
      }
    }
    return grid(tiles, 3);
  },
  "ground/guides": (ctx) => {
    const s = scene(ctx, 4);
    const c = careerLayout(s.w, s.h);
    const mark = (y: number, col: Color): void => {
      for (let x = 0; x < s.w; x += 2) s.px(x, y, col);
    };
    mark(c.boardAskingY, P.ledRed);
    mark(c.boardShrunkY, P.amber);
    mark(c.answerBarY, P.ledRed);
    mark(c.sheetY, P.amber);
    mark(c.actionTop, P.ledGreen);
    mark(c.actionBottom, P.ledGreen);
    for (let y = 0; y < s.h; y += 2) {
      s.px(c.stageLeft, y, P.awayLight);
      s.px(c.stageRight - 1, y, P.awayLight);
    }
    return s;
  },
};
