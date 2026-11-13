/**
 * Shots for the keeper, the ball, the trophy and the puff.
 *
 *   ./node_modules/.bin/tsx tools/snap.ts people/props --scale 4 --time all
 *   ./node_modules/.bin/tsx tools/snap.ts people/keeper-sheet --scale 3
 *   ./node_modules/.bin/tsx tools/snap.ts people/keeper-sheet --scale 3 --time night
 *   ./node_modules/.bin/tsx tools/snap.ts people/leap --strip 6 --dt 0.125 --scale 4
 *     (every keeper move: people/ready, leap, smother, hold, beaten, stranded, sprawl)
 *
 * Every row is one animation's frames. The ball is drawn where `keeperHands` says he holds
 * it (hold, smother 1), a red mark at his gloves' spot on the other frames.
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
import { litKit, makeKit } from "./kit";
import {
  KEEPER_ANIMS,
  KEEPER_ANIM_NAMES,
  drawKeeper,
  keeperCell,
  keeperHands,
  type KeeperAnim,
} from "./people";
import { drawBallRing, drawMatchBall, drawPuff, drawTrophy } from "./props";

const LABEL_W = 34;

function label(
  s: Surface,
  text: string,
  x: number,
  y: number,
  light: Lighting,
): void {
  drawText(s, text.toUpperCase(), x, y, light.lit(P.chalk), { font: FONT_3x5 });
}

function grassRow(
  s: Surface,
  top: number,
  h: number,
  gy: number,
  light: Lighting,
): void {
  s.rect(0, top, s.w, h, light.lit(P.grass));
  s.rect(0, gy, s.w, top + h - gy, light.lit(P.grassDark));
}

/** The match ball in its ring, as the career scene draws it. */
function ball(
  s: Surface,
  x: number,
  y: number,
  f: number,
  light: Lighting,
  gold = false,
): void {
  drawBallRing(s, x, y, light.lit(P.ink));
  drawMatchBall(s, x, y, f, light, gold ? { gold: true } : undefined);
}

function propsSheet(ctx: ShotContext): Surface {
  const light = lightingFor(ctx.sun);
  const s = new Surface(160, 44);
  const gy = 38;
  grassRow(s, 0, s.h, gy, light);
  for (let f = 0; f < 3; f++) {
    ball(s, 8 + f * 13, gy - 5, f, light);
    ball(s, 8 + f * 13, gy - 18, f, light, true);
  }
  drawTrophy(s, 60, gy, light);
  drawTrophy(s, 82, gy, light, true);
  for (let f = 0; f < 3; f++) {
    drawPuff(s, 108 + f * 18, gy, f, light.lit(P.grassHi));
    drawPuff(s, 108 + f * 18, gy - 14, f, light.lit(P.woodDark));
  }
  return s;
}

const KEEPER_KIT = makeKit("keeper", { look: 0 });

function keeperSheet(ctx: ShotContext): Surface {
  const light = lightingFor(ctx.sun);
  const kit = litKit(KEEPER_KIT, light);
  const step = 40;
  const rowH = 50;
  const s = new Surface(LABEL_W + 8 + 3 * 52, rowH * KEEPER_ANIM_NAMES.length);
  KEEPER_ANIM_NAMES.forEach((anim, row) => {
    const top = row * rowH;
    const gy = top + rowH - 4;
    grassRow(s, top, rowH, gy, light);
    const info = KEEPER_ANIMS[anim];
    label(s, anim, 2, gy - 14, light);
    label(s, `${info.frames}@${info.fps}`, 2, gy - 7, light);
    const w = Math.max(step, keeperCell(anim).cellW + 4);
    s.vline(LABEL_W, top, rowH, light.lit(P.grassDeep));
    for (let f = 0; f < info.frames; f++) {
      const x = LABEL_W + 4 + Math.floor(w / 2) + f * w;
      drawKeeper(s, anim, f, x, gy, kit);
      const g = keeperHands(anim, f);
      if (g === null) continue;
      if ((anim === "hold" && f === 0) || (anim === "smother" && f === 1)) {
        ball(s, x + g.x, gy + g.y, 0, light);
      } else {
        s.rect(x + g.x - 1, gy + g.y - 1, 2, 2, light.lit(P.ledRed));
      }
    }
    s.hline(0, top, s.w, light.lit(P.grassDeep));
  });
  return s;
}

/** Plays an animation over ctx.t; a one-shot holds its end a moment and repeats. */
function playFrame(t: number, anim: KeeperAnim): number {
  const info = KEEPER_ANIMS[anim];
  const n = Math.floor(t * info.fps);
  if (info.loop) return n % info.frames;
  return Math.min(n % (info.frames + 3), info.frames - 1);
}

function motion(anim: KeeperAnim) {
  return (ctx: ShotContext): Surface => {
    const light = lightingFor(ctx.sun);
    const kit = litKit(KEEPER_KIT, light);
    const s = new Surface(72, 52);
    const gy = s.h - 6;
    grassRow(s, 0, s.h, gy, light);
    const f = playFrame(ctx.t, anim);
    drawKeeper(s, anim, f, 36, gy, kit, { flipX: true });
    return s;
  };
}

export const shots: ShotMap = {
  "people/props": (ctx) => propsSheet(ctx),
  "people/keeper-sheet": (ctx) => keeperSheet(ctx),
  ...Object.fromEntries(
    KEEPER_ANIM_NAMES.map((a) => [`people/${a}`, motion(a)]),
  ),
};
