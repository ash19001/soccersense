/**
 * Shots for the match on the stadium's pitch (stadium-match.ts, drawn by stadium-life.ts).
 *
 *   match/strip        rows of consecutive frames (a fifteenth of a second apart) at the
 *                      first play's busy moments: the kick-off, the cross, the shot and the
 *                      goal, the scorer wheeling away, and its seam into the next play.
 *                      Each frame is a crop of the pitch round the ball, the same crop along
 *                      a row, so a player who jumps shows as a jump. --t is ignored; --w and
 *                      --h size the backdrop (960 x 540 by default).
 *   match/long-ball,   the same for each play (and match/break-mirrored etc. for the
 *   match/break,       mirror images, kicked off by the home side): its kick-off, its
 *   match/header       chances, the goal, the celebration, the walk back and the seam.
 *
 *   ./node_modules/.bin/tsx tools/snap.ts match/break --size 960x540 --scale 3
 */

import {
  FONT_3x5,
  Surface,
  drawText,
  type ShotContext,
  type ShotMap,
} from "~/pixel";
import { lightingFor } from "~/art/lighting";
import { P } from "~/art/palette";
import { MenuBackdrop } from "~/art/stadium";
import { schemeForDay } from "~/art/stadium-club";
import {
  MATCH_PERIOD,
  makeMatchState,
  matchAt,
  matchPlay,
} from "~/art/stadium-match";
import { project, type View } from "~/art/stadium-view";

/** The rows: a label and the second the row starts, in the play. */
type Moments = readonly (readonly [string, number])[];

const COLS = 8;
const STEP = 1 / 15;
const CW = 120;
const CH = 64;

/** A match seed whose `k`th play is `name`, and that `k` (searched: the order is seeded). */
function seedFor(name: string): { seed: number; k: number } {
  for (let k = 0; k < 6; k++) {
    for (let seed = 0; seed < 4000; seed++) {
      if (matchPlay(seed, k).name === name) return { seed, k };
    }
  }
  return { seed: 0, k: 0 };
}

function strip(
  ctx: ShotContext,
  matchSeed: number,
  start: number,
  moments: Moments,
): Surface {
  const w = ctx.w === 260 && ctx.h === 562 ? 960 : ctx.w;
  const h = ctx.w === 260 && ctx.h === 562 ? 540 : ctx.h;
  const b = new MenuBackdrop({
    seed: ctx.seed,
    sign: { header: "", text: "" },
    matchSeed,
  });
  b.resize(w, h);
  b.setLighting(lightingFor(ctx.sun));
  b.setScheme(schemeForDay(ctx.seed).id);
  b.mascotSpot();
  const view = (b as unknown as { view: View }).view;
  const game = makeMatchState();
  const out = new Surface(COLS * (CW + 2), moments.length * (CH + 2));
  out.clear(P.ink);
  const one = new Surface(w, h);
  moments.forEach(([label, at], row) => {
    const t0 = start + at;
    // the crop: round the ball, half way through the row
    matchAt(game, t0 + (COLS * STEP) / 2, matchSeed);
    const c = project(view, game.ballX, game.ballV);
    const sx = Math.round(c.x - CW / 2);
    const sy = Math.round(c.y - CH / 2 - 4);
    for (let i = 0; i < COLS; i++) {
      b.draw(one, t0 + i * STEP);
      out.blit(one, i * (CW + 2), row * (CH + 2), {
        sx,
        sy,
        sw: CW,
        sh: CH,
      });
    }
    const y = row * (CH + 2) + 1;
    out.rect(0, y - 1, label.length * 4 + 3, 7, P.ink);
    drawText(out, label, 1, y, P.chalk, { font: FONT_3x5 });
  });
  return out;
}

/** Each play's moments, by its name. */
const PLAYS: Record<string, Moments> = {
  "long ball": [
    ["KICK-OFF", 0.9],
    ["CROSS", 13.4],
    ["GOAL", 25.4],
    ["WHEEL", 28.6],
    ["BACK", 31.2],
    ["SEAM", MATCH_PERIOD - 0.25],
  ],
  break: [
    ["KICK-OFF", 0.9],
    ["TACKLE", 9.4],
    ["SAVE", 15.1],
    ["LONG", 18.4],
    ["GOAL", 23.2],
    ["CORNER", 26.4],
    ["SEAM", MATCH_PERIOD - 0.25],
  ],
  header: [
    ["KICK-OFF", 0.9],
    ["TACKLE", 5],
    ["SWITCH", 11],
    ["CROSS", 22.6],
    ["HEADER", 23.4],
    ["CORNER", 26.4],
    ["SEAM", MATCH_PERIOD - 0.25],
  ],
};

function playShot(name: string): ShotMap[string] {
  return (ctx) => {
    const { seed, k } = seedFor(name);
    const base = name.replace(" (mirrored)", "");
    return strip(ctx, seed, k * MATCH_PERIOD, PLAYS[base]);
  };
}

export const shots: ShotMap = {
  "match/strip": playShot("long ball"),
  "match/long-ball": playShot("long ball"),
  "match/break": playShot("break"),
  "match/header": playShot("header"),
  "match/long-ball-mirrored": playShot("long ball (mirrored)"),
  "match/break-mirrored": playShot("break (mirrored)"),
  "match/header-mirrored": playShot("header (mirrored)"),
};
