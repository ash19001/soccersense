/**
 * NEXT-GEN's big grounds (tiers 4 to 7) in the career scene, beside HOME's: the arena, its
 * goal, its effects, the promotion's close-up, the podium and the trophy lift.
 * `ctx.t` is the time since the call the shot is about, as in career.shots.ts.
 *
 *   ./node_modules/.bin/tsx tools/snap.ts career/nextgen-idle-t4 --w 960 --h 540 --scale 1
 *   ./node_modules/.bin/tsx tools/snap.ts career/nextgen-high --w 960 --h 540 --scale 1
 *   ./node_modules/.bin/tsx tools/snap.ts career/nextgen-promote-t4 --w 960 --h 540 --t 0.45 --scale 1
 *
 * Shots: `career/nextgen-idle-t4` .. `-t7`, `career/nextgen-golazo-t4` .. `-t7` (a goal and
 * its bursts of light, `ctx.t` from the shot), `career/nextgen-worldie-t6`,
 * `career/nextgen-promote-t4` (3 to 4), `-t5` (4 to 5), `career/nextgen-fulltime` (the
 * trophy lift), `career/nextgen-fulltime-t4`, and `career/nextgen-high` (a sheet: every
 * tier and state, HOME above NEXT-GEN, at `ctx.w` x `ctx.h` each).
 */

import type { Grade, Mode } from "~/game";
import { lightingFor } from "~/art/lighting";
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
  nextgen: {
    boards: ["SOCCERSENSE", "DRONE PIES", "HOLO SEATS", "SCAN TO CHEER"],
  },
};

function make(ctx: ShotContext, total: number, mode: Mode): CareerScene {
  const scene = new CareerScene({
    seed: ctx.seed,
    mode,
    total,
    labels: LABELS,
  });
  scene.resize(ctx.w, ctx.h);
  scene.setLighting(lightingFor(ctx.sun));
  scene.update(0);
  advance(scene, 1.2);
  return scene;
}

function advance(scene: CareerScene, t: number): void {
  const n = Math.max(0, Math.round(t / STEP));
  for (let i = 0; i < n; i++) scene.update(STEP);
}

function frame(ctx: ShotContext, scene: CareerScene): Surface {
  const s = new Surface(ctx.w, ctx.h);
  scene.draw(s);
  return s;
}

type Take = (ctx: ShotContext, mode: Mode) => Surface;

const idle =
  (tier: number): Take =>
  (ctx, mode) => {
    const scene = make(ctx, TOTALS[tier], mode);
    advance(scene, ctx.t);
    return frame(ctx, scene);
  };

const goal =
  (tier: number, grade: Grade, at?: number): Take =>
  (ctx, mode) => {
    const scene = make(ctx, TOTALS[tier], mode);
    scene.playShot(grade);
    advance(scene, at ?? ctx.t);
    return frame(ctx, scene);
  };

const promote =
  (from: number, to: number, at?: number): Take =>
  (ctx, mode) => {
    const scene = make(ctx, TOTALS[from], mode);
    scene.promote(TOTALS[to]);
    advance(scene, at ?? ctx.t);
    return frame(ctx, scene);
  };

const fulltime =
  (total: number, at?: number): Take =>
  (ctx, mode) => {
    const scene = make(ctx, Math.min(total, 600), mode);
    scene.showFullTime(total);
    advance(scene, at ?? ctx.t);
    return frame(ctx, scene);
  };

const shots: ShotMap = {};
for (let tier = 4; tier < 8; tier++) {
  shots[`career/nextgen-idle-t${tier}`] = (ctx) => idle(tier)(ctx, "nextgen");
  shots[`career/nextgen-golazo-t${tier}`] = (ctx) =>
    goal(tier, "golazo")(ctx, "nextgen");
}
shots["career/nextgen-worldie-t6"] = (ctx) =>
  goal(6, "worldie")(ctx, "nextgen");
shots["career/nextgen-promote-t4"] = (ctx) => promote(3, 4)(ctx, "nextgen");
shots["career/nextgen-promote-t5"] = (ctx) => promote(4, 5)(ctx, "nextgen");
shots["career/nextgen-fulltime"] = (ctx) => fulltime(680)(ctx, "nextgen");
shots["career/nextgen-fulltime-t4"] = (ctx) => fulltime(400)(ctx, "nextgen");

/** The sheet: each state, HOME on the left and NEXT-GEN on the right, labelled. */
/** The same take at night (the sun 30 degrees down): tiers 4 and 5 follow the player's sky. */
const night =
  (take: Take): Take =>
  (ctx, mode) =>
    take({ ...ctx, sun: { elevation: -30, morning: false } }, mode);

const SHEET: readonly [string, Take][] = [
  ["T4", idle(4)],
  ["T4 NIGHT", night(idle(4))],
  ["T5", idle(5)],
  ["T5 NIGHT", night(idle(5))],
  ["T6", idle(6)],
  ["T7 FULL TIME", fulltime(680, 2)],
  ["T4 GOLAZO", goal(4, "golazo", 1.9)],
  ["T5 GOLAZO NIGHT", night(goal(5, "golazo", 1.9))],
  ["T6 WORLDIE", goal(6, "worldie", 2.1)],
  ["PROMOTE 4 CLOSE-UP", promote(3, 4, 0.45)],
  ["PROMOTE 5 CLOSE-UP NIGHT", night(promote(4, 5, 0.6))],
  ["PROMOTE 5 CLEARING", promote(4, 5, 1.1)],
  ["T4 FULL TIME", fulltime(400, 1.5)],
];

shots["career/nextgen-high"] = (ctx) => {
  const gap = 2;
  const out = new Surface(ctx.w * 2 + gap, SHEET.length * (ctx.h + gap) - gap);
  out.clear(P.ink);
  SHEET.forEach(([name, take], i) => {
    const y = i * (ctx.h + gap);
    out.copy(take(ctx, "home"), 0, y);
    out.copy(take(ctx, "nextgen"), ctx.w + gap, y);
    for (const [x, m] of [
      [0, "HOME"],
      [ctx.w + gap, "NEXT-GEN"],
    ] as const) {
      drawText(out, `${m} ${name}`, x + 3, y + 3, P.white, {
        font: FONT_3x5,
        outline: P.ink,
      });
    }
  });
  return out;
};

export { shots };
