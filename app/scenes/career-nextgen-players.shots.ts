/**
 * NEXT-GEN's cast in the career scene (app/art/characters/nextgen.ts), beside HOME's: the
 * kits, visors and glowing gloves, the ball with its light trail, the trophy of the future.
 *
 *   ./node_modules/.bin/tsx tools/snap.ts career/nextgen-players-t4 --w 960 --h 540 --scale 1
 *   ./node_modules/.bin/tsx tools/snap.ts career/nextgen-players-shot-golazo --w 960 --h 540 --t 0.7 --scale 1
 *   ./node_modules/.bin/tsx tools/snap.ts career/nextgen-players-sheet --w 960 --h 540 --scale 1
 *
 * Shots: `career/nextgen-players-t0` to `-t7` (asking), `-shot-<grade>` (tier 4, `ctx.t`
 * after the call) and `-shot-<grade>-t0`, `-ft0`, `-ft4`, `-ft7` (full time), `-sheet` (the
 * cast's band of every tier and moment, HOME on the left and NEXT-GEN on the right, by day
 * and at night).
 */

import type { Grade, Mode } from "~/game";
import { careerLayout } from "~/art/layout";
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

const DAY: Sun = { elevation: 40, morning: false };
const NIGHT: Sun = { elevation: -30, morning: false };

function advance(scene: CareerScene, t: number): void {
  const n = Math.max(0, Math.round(t / STEP));
  for (let i = 0; i < n; i++) scene.update(STEP);
}

function make(
  w: number,
  h: number,
  seed: number,
  total: number,
  mode: Mode,
  sun: Sun,
) {
  const scene = new CareerScene({ seed, mode, total, labels: LABELS });
  scene.resize(w, h);
  scene.setLighting(lightingFor(sun));
  scene.update(0);
  advance(scene, 1.2);
  return scene;
}

/** A moment of the scene: asking at a tier, a shot `t` s on, or full time. */
interface Moment {
  tier: number;
  grade?: Grade;
  full?: number;
  t: number;
}

function render(
  w: number,
  h: number,
  seed: number,
  mode: Mode,
  sun: Sun,
  m: Moment,
): Surface {
  const scene = make(w, h, seed, TOTALS[m.tier], mode, sun);
  if (m.grade !== undefined) scene.playShot(m.grade);
  if (m.full !== undefined) scene.showFullTime(m.full);
  advance(scene, m.t);
  const s = new Surface(w, h);
  scene.draw(s);
  return s;
}

function one(ctx: ShotContext, m: Moment): Surface {
  return render(ctx.w, ctx.h, ctx.seed, "nextgen", ctx.sun, m);
}

/** The moments on the sheet. */
const SHEET: readonly (Moment & { name: string })[] = [
  ...TOTALS.slice(0, 7).map((_, tier) => ({ name: `T${tier}`, tier, t: 0.5 })),
  { name: "GOLAZO T4", tier: 4, grade: "golazo", t: 0.75 },
  { name: "WORLDIE T4", tier: 4, grade: "worldie", t: 1.45 },
  { name: "TOEPOKE T1", tier: 1, grade: "toepoke", t: 0.95 },
  { name: "MISS T2", tier: 2, grade: "miss", t: 2.2 },
  { name: "TIMEUP T3", tier: 3, grade: "timeup", t: 1.2 },
  { name: "FETCH T5", tier: 5, grade: "golazo", t: 3.6 },
  { name: "FT0", tier: 0, full: 40, t: 1 },
  { name: "FT4", tier: 4, full: 360, t: 1 },
  { name: "FT7", tier: 6, full: 680, t: 1.1 },
];

/** The cast's band: from left of team-mate A to past the back of the net. */
function band(
  w: number,
  h: number,
): { x: number; y: number; w: number; h: number } {
  const L = careerLayout(w, h);
  const x0 = Math.max(0, L.heroX - Math.round(70 * L.stageScale));
  const x1 = Math.min(w, L.goalX + Math.round(40 * L.stageScale));
  const y0 = Math.max(0, L.groundY - 90);
  const y1 = Math.min(h, L.groundY + 30);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

function sheet(ctx: ShotContext): Surface {
  const b = band(ctx.w, ctx.h);
  const cols = 4; // HOME day, NEXT-GEN day, HOME night, NEXT-GEN night
  const out = new Surface(cols * (b.w + 2), SHEET.length * (b.h + 2));
  out.clear(P.ink);
  SHEET.forEach((m, row) => {
    for (let c = 0; c < cols; c++) {
      const mode: Mode = c % 2 === 0 ? "home" : "nextgen";
      const sun = c < 2 ? DAY : NIGHT;
      const s = render(ctx.w, ctx.h, ctx.seed, mode, sun, m);
      const x = c * (b.w + 2);
      const y = row * (b.h + 2);
      out.blit(s, x, y, { sx: b.x, sy: b.y, sw: b.w, sh: b.h });
      drawText(out, `${m.name} ${mode.toUpperCase()}`, x + 3, y + 3, P.white, {
        font: FONT_3x5,
        outline: P.ink,
      });
    }
  });
  return out;
}

const shots: ShotMap = {
  "career/nextgen-players-sheet": sheet,
  "career/nextgen-players-ft0": (ctx) =>
    one(ctx, { tier: 0, full: 40, t: ctx.t }),
  "career/nextgen-players-ft4": (ctx) =>
    one(ctx, { tier: 4, full: 360, t: ctx.t }),
  "career/nextgen-players-ft7": (ctx) =>
    one(ctx, { tier: 6, full: 680, t: ctx.t }),
};
for (let tier = 0; tier < 8; tier++) {
  shots[`career/nextgen-players-t${tier}`] = (ctx) =>
    one(ctx, { tier, t: ctx.t });
}
for (const grade of GRADES) {
  shots[`career/nextgen-players-shot-${grade}`] = (ctx) =>
    one(ctx, { tier: 4, grade, t: ctx.t });
  shots[`career/nextgen-players-shot-${grade}-t0`] = (ctx) =>
    one(ctx, { tier: 0, grade, t: ctx.t });
}

export { shots };
