/**
 * RETRO's small grounds (tiers 0 to 3) in the career scene, beside HOME's: the village green
 * and its bandstand, the Sunday league's rope and pavilion, the club ground's wooden stand,
 * the lower league's grandstand; goals into the rope nets, a promotion's smoke, full time.
 *
 *   ./node_modules/.bin/tsx tools/snap.ts career/retro-low-t0 --w 960 --h 540 --scale 1
 *   ./node_modules/.bin/tsx tools/snap.ts career/retro-low-sheet --w 960 --h 540 --scale 1
 *
 * Shots: `career/retro-low-t0` to `-t3` (asking), `-goal-t0` to `-goal-t3` (a golazo,
 * `ctx.t` after the call: 1.3 shows the ball in the net), `-promote1` (0 to 1) and
 * `-promote3` (2 to 3) (`ctx.t` after NEXT: 0.4 the close-up, 1.1 the smoke clearing),
 * `-ft0`, `-ft3` (full time), `-sheet` (each of them, HOME on the left and RETRO on the
 * right, by day and at night; at `--w 960 --h 540` it is .snaps/era-art/retro-low.png).
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
const TOTALS = [0, 100, 200, 300];
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
  sun: Sun,
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
  (total: number): Moment =>
  (ctx, mode, sun) => {
    const scene = make(ctx, total, mode, sun);
    scene.showFullTime(total);
    advance(scene, ctx.t);
    return frame(ctx, scene);
  };

const MOMENTS: Record<string, Moment> = {
  t0: idle(0),
  t1: idle(1),
  t2: idle(2),
  t3: idle(3),
  "goal-t0": goal(0),
  "goal-t1": goal(1),
  "goal-t2": goal(2),
  "goal-t3": goal(3),
  promote1: promote(0, 100),
  promote3: promote(200, 300),
  ft0: fullTime(40),
  ft3: fullTime(300),
};

/** The sheet's rows: a moment, the time into it, whether it has a night row too. */
const SHEET: readonly (readonly [string, number, boolean])[] = [
  ["t0", 0, true],
  ["t1", 0, true],
  ["t2", 0, true],
  ["t3", 0, true],
  ["goal-t1", 1.3, false],
  ["goal-t2", 1.3, true],
  ["goal-t3", 1.3, false],
  ["promote1", 0.4, false],
  ["promote3", 1.1, false],
  ["ft0", 1, false],
  ["ft3", 1, true],
];

const shots: ShotMap = {};
for (const [name, moment] of Object.entries(MOMENTS)) {
  shots[`career/retro-low-${name}`] = (ctx) => moment(ctx, "retro", ctx.sun);
}
shots["career/retro-low-sheet"] = (ctx) => {
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
      const label = `${mode.toUpperCase()} ${name.toUpperCase()} ${t} ${when.toUpperCase()}`;
      out.rect(x + 2, y + 2, label.length * 4 + 3, 8, P.ink);
      drawText(out, label, x + 4, y + 3, P.chalk, { font: FONT_3x5 });
    }
  });
  return out;
};

export { shots };
