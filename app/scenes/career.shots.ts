/**
 * Shots for the career scene. Each builds a scene, lets the arrival finish, feeds it the
 * calls the game page would and returns the frame. `ctx.t` is the time since the call
 * the shot is about (the shot, the promotion, full time); the scene is advanced there in
 * sixtieths of a second, as a browser would.
 *
 *   ./node_modules/.bin/tsx tools/snap.ts career/idle --size 960x540 --scale 1
 *   ./node_modules/.bin/tsx tools/snap.ts career/idle-t4 --size 960x540 --time night --scale 2
 *   ./node_modules/.bin/tsx tools/snap.ts career/shot-worldie --size 960x540 --strip 9 --dt 0.2 --crop 300,140,400,180 --scale 2
 *   ./node_modules/.bin/tsx tools/snap.ts career/shot-tapin-t0 --size 960x540 --strip 8 --dt 0.25 --crop 300,180,400,140 --scale 2
 *   ./node_modules/.bin/tsx tools/snap.ts career/arrival --size 960x540 --strip 8 --dt 0.08 --scale 1
 *   ./node_modules/.bin/tsx tools/snap.ts career/promote --size 960x540 --strip 8 --dt 0.2 --scale 1
 *   ./node_modules/.bin/tsx tools/snap.ts career/fulltime --size 960x540 --t 1 --scale 2
 *   ./node_modules/.bin/tsx tools/snap.ts career/after-goal --size 960x540 --strip 8 --dt 0.25 --crop 300,140,400,220 --scale 2
 *
 * Shots: `career/idle` (all eight tiers), `career/idle-t0` to `idle-t7`, `career/away`,
 * `career/shot-<grade>` (tier 4) and `career/shot-<grade>-t0` (the park) for all eight
 * grades (worldie, golazo, trivela, toepoke, tapin, miss, timeup, skipped), `career/shot-miss-wide`
 * (and `-t0`: the second miss of a game, dragged wide rather than skied), `career/after-<grade>`
 * (the same, from the call back on: the new ball and back to juggling), `career/arrival` (the
 * opening out of ink, `ctx.t` from the first frame), `career/interrupt` (a shot asked for in
 * the middle of the last one's reaction), `career/promote` (2 to 3), `promote-t0` (0 to 1),
 * `promote-t1` (1 to 2), `promote-t3` (3 to 4), `career/fulltime` (tier 7), `fulltime-t3`,
 * `fulltime-t0`, `career/reduced` (a worldie with reduced motion).
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
/** A total inside each tier. */
const TOTALS = [0, 100, 200, 300, 400, 500, 600, 680];
const GRADES: Grade[] = [
  "worldie",
  "golazo",
  "trivela",
  "toepoke",
  "tapin",
  "miss",
  "timeup",
  "skipped",
];

const LABELS = {
  boards: ["SOCCERSENSE", "HOT PIES", "TEA BAR", "COME ON THEN"],
  banners: ["HOMETOWN HERO", "ONE OF OUR OWN", "BRING IT HOME"],
};

function make(
  ctx: ShotContext,
  total: number,
  mode: Mode = "home",
  reduced = false,
): CareerScene {
  const scene = new CareerScene({
    seed: ctx.seed,
    mode,
    total,
    labels: LABELS,
  });
  scene.resize(ctx.w, ctx.h);
  scene.setLighting(lightingFor(ctx.sun));
  scene.setReducedMotion(reduced);
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

function idle(ctx: ShotContext, tier: number, mode: Mode = "home"): Surface {
  const scene = make(ctx, TOTALS[tier], mode);
  advance(scene, ctx.t);
  return frame(ctx, scene);
}

function shot(
  ctx: ShotContext,
  grade: Grade,
  total: number,
  from = 0,
  before: Grade[] = [],
): Surface {
  const scene = make(ctx, total);
  for (const g of before) {
    scene.playShot(g);
    advance(scene, 6);
  }
  scene.playShot(grade);
  advance(scene, from + ctx.t);
  return frame(ctx, scene);
}

const shots: ShotMap = {
  "career/idle": (ctx) => {
    // all eight tiers, two across, labelled
    const out = new Surface(ctx.w * 2 + 2, ctx.h * 4 + 6);
    out.clear(P.ink);
    for (let tier = 0; tier < 8; tier++) {
      const s = idle(ctx, tier);
      const x = (tier & 1) * (ctx.w + 2);
      const y = (tier >> 1) * (ctx.h + 2);
      out.copy(s, x, y);
      drawText(out, `TIER ${tier}`, x + 3, y + 3, P.white, {
        font: FONT_3x5,
        outline: P.ink,
      });
    }
    return out;
  },
  "career/away": (ctx) => idle(ctx, 4, "away"),
  "career/arrival": (ctx) => {
    // no head start: the frame the page sees `ctx.t` after its first
    const scene = new CareerScene({
      seed: ctx.seed,
      mode: "home",
      total: 400,
      labels: LABELS,
    });
    scene.resize(ctx.w, ctx.h);
    scene.setLighting(lightingFor(ctx.sun));
    scene.update(0);
    advance(scene, ctx.t);
    return frame(ctx, scene);
  },
  "career/interrupt": (ctx) => {
    // a golazo, and a toe poke asked for while he is still on his knees in the corner
    const scene = make(ctx, 400);
    scene.playShot("golazo");
    advance(scene, 2.8);
    scene.playShot("toepoke");
    advance(scene, ctx.t);
    return frame(ctx, scene);
  },
  "career/promote": (ctx) => {
    const scene = make(ctx, 200);
    scene.promote(300);
    advance(scene, ctx.t);
    return frame(ctx, scene);
  },
  "career/promote-t0": (ctx) => {
    const scene = make(ctx, 0);
    scene.promote(100);
    advance(scene, ctx.t);
    return frame(ctx, scene);
  },
  "career/promote-t1": (ctx) => {
    const scene = make(ctx, 100);
    scene.promote(200);
    advance(scene, ctx.t);
    return frame(ctx, scene);
  },
  "career/promote-t3": (ctx) => {
    const scene = make(ctx, 300);
    scene.promote(400);
    advance(scene, ctx.t);
    return frame(ctx, scene);
  },
  "career/fulltime": (ctx) => {
    const scene = make(ctx, 600);
    scene.showFullTime(680);
    advance(scene, ctx.t);
    return frame(ctx, scene);
  },
  "career/fulltime-t3": (ctx) => {
    const scene = make(ctx, 300);
    scene.showFullTime(300);
    advance(scene, ctx.t);
    return frame(ctx, scene);
  },
  "career/fulltime-t0": (ctx) => {
    const scene = make(ctx, 0);
    scene.showFullTime(40);
    advance(scene, ctx.t);
    return frame(ctx, scene);
  },
  "career/reduced": (ctx) => {
    const scene = make(ctx, 400, "home", true);
    scene.playShot("worldie");
    advance(scene, ctx.t);
    return frame(ctx, scene);
  },
};

for (let tier = 0; tier < 8; tier++) {
  shots[`career/idle-t${tier}`] = (ctx) => idle(ctx, tier);
}
for (const grade of GRADES) {
  shots[`career/shot-${grade}`] = (ctx) => shot(ctx, grade, 400);
  shots[`career/shot-${grade}-t0`] = (ctx) => shot(ctx, grade, 0);
  shots[`career/after-${grade}`] = (ctx) => shot(ctx, grade, 400, 2.4);
}
shots["career/shot-miss-wide"] = (ctx) => shot(ctx, "miss", 400, 0, ["miss"]);
shots["career/shot-miss-wide-t0"] = (ctx) => shot(ctx, "miss", 0, 0, ["miss"]);
// The fetch (`--w 960 --h 540`): from 1.4 s after the shot, the last
// ball brought back to him, at every tier. `career/fetch-<grade>-t<tier>` for the goals
// and the skied miss, `career/fetch-wide-t<tier>` for a miss dragged wide.
for (let tier = 0; tier < 8; tier++) {
  for (const grade of GRADES) {
    shots[`career/fetch-${grade}-t${tier}`] = (ctx) =>
      shot(ctx, grade, TOTALS[tier], 1.4);
  }
  shots[`career/fetch-wide-t${tier}`] = (ctx) =>
    shot(ctx, "miss", TOTALS[tier], 1.4, ["miss"]);
}

export { shots };
