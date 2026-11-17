/**
 * Shots for the goal show (career-pyro.ts): a goal at each kind of ground, in each era.
 * `ctx.t` is the time since the shot was asked for (the ball goes in 1.1 to 1.6 s later,
 * by the shot), the scene advanced there in sixtieths of a second.
 *
 *   ./node_modules/.bin/tsx tools/snap.ts career/pyro-worldie-t4 --size 960x540 --t 2 --scale 1
 *   ./node_modules/.bin/tsx tools/snap.ts career/pyro-golazo-t2 --size 960x540 --strip 6 --dt 0.3 --t 1.3 --scale 1
 *   ./node_modules/.bin/tsx tools/snap.ts career/pyro-retro-worldie-t4 --size 260x562 --t 2 --time night
 *
 * Shots: `career/pyro-<grade>-t<tier>` (HOME), `career/pyro-retro-...` and
 * `career/pyro-nextgen-...`, for a worldie, a golazo and a tap in at tiers 0, 1, 2, 3, 4
 * and 6.
 */

import type { Grade, Mode } from "~/game";
import { lightingFor } from "~/art/lighting";
import { Surface, type ShotContext, type ShotMap } from "~/pixel";
import { CareerScene } from "./career";

const STEP = 1 / 60;
/** A total inside each tier. */
const TOTALS = [0, 100, 200, 300, 400, 500, 600, 680];
const TIERS = [0, 1, 2, 3, 4, 6];
const GRADES: Grade[] = ["worldie", "golazo", "tapin"];
const MODES: Mode[] = ["home", "retro", "nextgen"];

const LABELS = {
  boards: ["SOCCERSENSE", "HOT PIES", "TEA BAR", "COME ON THEN"],
  banners: ["HOMETOWN HERO", "ONE OF OUR OWN", "BRING IT HOME"],
};

function goal(
  ctx: ShotContext,
  mode: Mode,
  tier: number,
  grade: Grade,
): Surface {
  const scene = new CareerScene({
    seed: ctx.seed,
    mode,
    total: TOTALS[tier],
    labels: LABELS,
  });
  scene.resize(ctx.w, ctx.h);
  scene.setLighting(lightingFor(ctx.sun));
  scene.update(0);
  const advance = (t: number) => {
    const n = Math.max(0, Math.round(t / STEP));
    for (let i = 0; i < n; i++) scene.update(STEP);
  };
  advance(1.2);
  scene.playShot(grade);
  advance(ctx.t);
  const s = new Surface(ctx.w, ctx.h);
  scene.draw(s);
  return s;
}

const shots: ShotMap = {};
for (const mode of MODES) {
  for (const tier of TIERS) {
    for (const grade of GRADES) {
      const era = mode === "home" ? "" : `${mode}-`;
      shots[`career/pyro-${era}${grade}-t${tier}`] = (ctx) =>
        goal(ctx, mode, tier, grade);
    }
  }
}

export { shots };
