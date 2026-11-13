/**
 * The fetch's frames (fetch.ts), each row beside the frames it sits between in the scene
 * (the keeper's hold and ready, the youth's idle and run). The ball is drawn where
 * `fetchBall` says he has it.
 *
 *   ./node_modules/.bin/tsx tools/snap.ts people/fetch-sheet --scale 3 --time all
 */

import {
  FONT_3x5,
  Surface,
  drawText,
  type ShotContext,
  type ShotMap,
} from "~/pixel";
import { lightingFor, type Lighting } from "../lighting";
import { P } from "../palette";
import {
  FETCH_ANIMS,
  FETCH_ANIM_NAMES,
  ballKidKit,
  drawFetch,
  fetchBall,
  type FetchAnim,
} from "./fetch";
import { litKit, makeKit } from "./kit";
import { drawKeeper, drawPlayer, keeperHands } from "./people";
import { drawBallRing, drawMatchBall } from "./props";

const LABEL_W = 46;
const STEP = 36;
const ROW_H = 50;

function ball(s: Surface, x: number, y: number, light: Lighting): void {
  drawBallRing(s, x, y, light.lit(P.ink));
  drawMatchBall(s, x, y, 0, light);
}

/** What each row starts with: the frame before it in the scene. */
const BEFORE: Readonly<Record<FetchAnim, string>> = {
  keeperPick: "ready",
  keeperCarry: "hold",
  keeperRoll: "hold",
  kidPick: "idle",
  kidThrow: "run",
};

function sheet(ctx: ShotContext): Surface {
  const light = lightingFor(ctx.sun);
  const keeper = litKit(makeKit("keeper", { look: 0 }), light);
  const kid = litKit(ballKidKit(), light);
  const s = new Surface(
    LABEL_W + STEP * 5 + 8,
    ROW_H * FETCH_ANIM_NAMES.length,
  );
  FETCH_ANIM_NAMES.forEach((anim, row) => {
    const top = row * ROW_H;
    const gy = top + ROW_H - 4;
    s.rect(0, top, s.w, ROW_H, light.lit(P.grass));
    s.rect(0, gy, s.w, top + ROW_H - gy, light.lit(P.grassDark));
    s.hline(0, top, s.w, light.lit(P.grassDeep));
    const info = FETCH_ANIMS[anim];
    const text = (t: string, y: number): void => {
      drawText(s, t.toUpperCase(), 2, y, light.lit(P.chalk), {
        font: FONT_3x5,
      });
    };
    text(anim.replace("keeper", "k ").replace("kid", "kid "), gy - 14);
    text(`${info.frames}@${info.fps}`, gy - 7);
    const kidRow = anim.startsWith("kid");
    const x0 = LABEL_W + STEP / 2;
    // the frame before, for scale and for the join
    if (kidRow) {
      drawPlayer(s, BEFORE[anim] === "run" ? "run" : "idle", 0, x0, gy, kid, {
        youth: true,
      });
    } else {
      const k = BEFORE[anim] === "hold" ? "hold" : "ready";
      drawKeeper(s, k, 0, x0, gy, keeper);
      const g = keeperHands("hold", 0);
      if (k === "hold" && g) ball(s, x0 + g.x, gy + g.y, light);
    }
    s.vline(LABEL_W + STEP, top, ROW_H, light.lit(P.grassDeep));
    for (let f = 0; f < info.frames; f++) {
      const x = LABEL_W + STEP + STEP / 2 + 4 + f * STEP;
      drawFetch(s, anim, f, x, gy, kidRow ? kid : keeper);
      const b = fetchBall(anim, f);
      if (b) ball(s, x + b.x, gy + b.y, light);
    }
  });
  return s;
}

export const shots: ShotMap = {
  "people/fetch-sheet": (ctx) => sheet(ctx),
};
