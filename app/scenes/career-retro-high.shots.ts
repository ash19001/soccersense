/**
 * RETRO's big grounds (tiers 4 to 7) in the career scene, beside HOME's: the grandstand, the
 * end, the near side, the goal, a goal's fireworks, the promotion's close-up of the ball in a
 * rope net, full time and the trophy lift.
 *
 *   ./node_modules/.bin/tsx tools/snap.ts career/retro-high-t4 --w 960 --h 540 --scale 1
 *   ./node_modules/.bin/tsx tools/snap.ts career/retro-high-sheet --w 960 --h 540 --scale 1
 *   ./node_modules/.bin/tsx tools/snap.ts career/retro-high-promote --w 960 --h 540 --t 0.4 --scale 1
 *
 * Shots: `career/retro-high-t4` to `-t7` (asking), `-goal-t4` to `-goal-t7` (a golazo
 * `ctx.t` after the call: about 2.1 shows the fireworks; a worldie at tier 6, 2.6), `-promote` (3 to 4, `ctx.t` after
 * NEXT: 0.4 the close-up, 1.1 the smoke clearing), `-promote5` (4 to 5), `-ft4`, `-ft7` (full
 * time), `-sheet` (every one of them, HOME on the left, RETRO on the right, by day and at
 * night).
 */

import type { Grade, Mode } from "~/game";
import { lightingFor, type Sun } from "~/art/lighting";
import { P } from "~/art/palette";
import {
  FONT_3x5,
  Surface,
  drawText,
  type ShotContext,
  type ShotMap,
} from "~/pixel";
import { CareerScene } from "./career";

const STEP = 1 / 60;
const TOTALS = [0, 100, 200, 300, 400, 500, 600, 680];
const LABELS = {
  boards: ["SOCCERSENSE", "HOT PIES", "TEA BAR", "COME ON THEN"],
  banners: ["HOMETOWN HERO", "ONE OF OUR OWN", "BRING IT HOME"],
};

const DAY: Sun = { elevation: 40, morning: false };
const NIGHT: Sun = { elevation: -30, morning: false };

function advance(scene: CareerScene, t: number): void {
  const n = Math.max(0, Math.round(t / STEP));
  for (let i = 0; i < n; i++) scene.update(STEP);
}

function make(
  ctx: ShotContext,
  total: number,
  mode: Mode,
  sun: Sun = ctx.sun,
): CareerScene {
  const scene = new CareerScene({
    seed: ctx.seed,
    mode,
    total,
    labels: LABELS,
  });
  scene.resize(ctx.w, ctx.h);
  scene.setLighting(lightingFor(sun));
  scene.update(0);
  advance(scene, 1.2);
  return scene;
}

function frame(ctx: ShotContext, scene: CareerScene): Surface {
  const s = new Surface(ctx.w, ctx.h);
  scene.draw(s);
  return s;
}

type Moment = (ctx: ShotContext, mode: Mode, sun: Sun) => Surface;

const idle =
  (tier: number): Moment =>
  (ctx, mode, sun) => {
    const scene = make(ctx, TOTALS[tier], mode, sun);
    advance(scene, ctx.t);
    return frame(ctx, scene);
  };

const goal =
  (tier: number, grade: Grade = "golazo"): Moment =>
  (ctx, mode, sun) => {
    const scene = make(ctx, TOTALS[tier], mode, sun);
    scene.playShot(grade);
    advance(scene, ctx.t);
    return frame(ctx, scene);
  };

const promote =
  (from: number, to: number): Moment =>
  (ctx, mode, sun) => {
    const scene = make(ctx, from, mode, sun);
    scene.promote(to);
    advance(scene, ctx.t);
    return frame(ctx, scene);
  };

const fullTime =
  (before: number, total: number): Moment =>
  (ctx, mode, sun) => {
    const scene = make(ctx, before, mode, sun);
    scene.showFullTime(total);
    advance(scene, ctx.t);
    return frame(ctx, scene);
  };

const MOMENTS: Record<string, Moment> = {
  t4: idle(4),
  t5: idle(5),
  t6: idle(6),
  t7: idle(7),
  "goal-t4": goal(4),
  "goal-t5": goal(5),
  "goal-t6": goal(6, "worldie"),
  "goal-t7": goal(7),
  promote: promote(300, 400),
  promote5: promote(400, 500),
  ft4: fullTime(400, 400),
  ft7: fullTime(600, 680),
};

/** The sheet's rows: a moment, the time into it, whether it has a night row too. */
const SHEET: readonly (readonly [string, number, boolean])[] = [
  ["t4", 0, true],
  ["t5", 0, true],
  ["t6", 0, false],
  ["ft7", 1.4, false],
  ["goal-t4", 2.1, true],
  ["goal-t6", 2.6, false],
  ["promote", 0.4, false],
  ["promote", 1.1, false],
  ["ft4", 1, true],
];

const shots: ShotMap = {};
for (const [name, moment] of Object.entries(MOMENTS)) {
  shots[`career/retro-high-${name}`] = (ctx) => moment(ctx, "retro", ctx.sun);
}
shots["career/retro-high-sheet"] = (ctx) => {
  const rows: [string, number, Sun, string][] = [];
  for (const [name, t, night] of SHEET) {
    rows.push([name, t, DAY, "day"]);
    if (night) rows.push([name, t, NIGHT, "night"]);
  }
  const out = new Surface(ctx.w * 2 + 2, rows.length * (ctx.h + 2));
  out.clear(P.ink);
  rows.forEach(([name, t, sun, when], i) => {
    const y = i * (ctx.h + 2);
    for (let c = 0; c < 2; c++) {
      const mode: Mode = c === 0 ? "home" : "retro";
      const s = MOMENTS[name]({ ...ctx, t }, mode, sun);
      const x = c * (ctx.w + 2);
      out.copy(s, x, y);
      drawText(
        out,
        `${mode.toUpperCase()} ${name.toUpperCase()} ${t} ${when.toUpperCase()}`,
        x + 3,
        y + 3,
        P.white,
        { font: FONT_3x5, outline: P.ink },
      );
    }
  });
  return out;
};

export { shots };
