/**
 * Shots for the match on the stadium's pitch (stadium-match.ts, drawn by stadium-life.ts).
 *
 *   match/strip   rows of consecutive frames (a fifteenth of a second apart) at the
 *                 match's busy moments: the kick-off, the cross, the shot and the goal,
 *                 the scorer wheeling away, and the loop's seam. Each frame is a crop of
 *                 the pitch round the ball, the same crop along a row, so a player who
 *                 jumps shows as a jump. --t is ignored; --w and --h size the backdrop
 *                 (960 x 540 by default).
 *
 *   ./node_modules/.bin/tsx tools/snap.ts match/strip --size 960x540 --scale 3
 */

import { FONT_3x5, Surface, drawText, type ShotMap } from "~/pixel";
import { lightingFor } from "~/art/lighting";
import { P } from "~/art/palette";
import { MenuBackdrop } from "~/art/stadium";
import { schemeForDay } from "~/art/stadium-club";
import { MATCH_PERIOD, makeMatchState, matchAt } from "~/art/stadium-match";
import { project, type View } from "~/art/stadium-view";

/** The rows: a label and the second the row starts. */
const MOMENTS: readonly (readonly [string, number])[] = [
  ["KICK-OFF", 0.9],
  ["CROSS", 13.4],
  ["GOAL", 25.4],
  ["WHEEL", 28.6],
  ["BACK", 31.2],
  ["SEAM", MATCH_PERIOD - 0.25],
];
const COLS = 8;
const STEP = 1 / 15;
const CW = 120;
const CH = 64;

export const shots: ShotMap = {
  "match/strip": (ctx) => {
    const w = ctx.w === 260 && ctx.h === 562 ? 960 : ctx.w;
    const h = ctx.w === 260 && ctx.h === 562 ? 540 : ctx.h;
    const b = new MenuBackdrop({
      seed: ctx.seed,
      sign: { header: "", text: "" },
    });
    b.resize(w, h);
    b.setLighting(lightingFor(ctx.sun));
    b.setScheme(schemeForDay(ctx.seed).id);
    b.mascotSpot();
    const view = (b as unknown as { view: View }).view;
    const game = makeMatchState();
    const out = new Surface(COLS * (CW + 2), MOMENTS.length * (CH + 2));
    out.clear(P.ink);
    const one = new Surface(w, h);
    MOMENTS.forEach(([label, t0], row) => {
      // the crop: round the ball, half way through the row
      matchAt(game, t0 + (COLS * STEP) / 2);
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
  },
};
