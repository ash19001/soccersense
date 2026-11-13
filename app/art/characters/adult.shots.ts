/**
 * Shots for the adult player's moves.
 *
 *   ./node_modules/.bin/tsx tools/snap.ts people/sheet --scale 3
 *   ./node_modules/.bin/tsx tools/snap.ts people/sheet-away --scale 3 --time night
 *   ./node_modules/.bin/tsx tools/snap.ts people/kits --scale 3
 *   ./node_modules/.bin/tsx tools/snap.ts people/run --strip 8 --dt 0.1 --scale 4
 *     (every move: people/idle, run, kick, juggle, celebrate, dejected, lift, shrug, slide)
 *
 * Every sheet row is one animation's frames. The ball is drawn at `ballSpot` (a 6 x 6
 * stand-in, not the match ball), the trophy's place at `handsSpot` as a gold mark.
 */

import {
  FONT_3x5,
  Surface,
  drawText,
  frameAt,
  type ShotContext,
  type ShotMap,
} from "~/pixel";
import { lightingFor, type Lighting } from "../lighting";
import { P } from "../palette";
import { KIT_BASES, litKit, makeKit, type Kit, type KitBase } from "./kit";
import {
  PLAYER_ANIMS,
  PLAYER_ANIM_NAMES,
  ballSpot,
  drawPlayer,
  handsSpot,
  playerCell,
  type PlayerAnim,
} from "./people";

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

/** A 6 x 6 stand-in ball on its spot (cx, cy): columns cx - 3 to cx + 2, as drawSprite "center". */
function ball(s: Surface, cx: number, cy: number, light: Lighting): void {
  const x = cx - 3;
  const y = cy - 3;
  const w = light.lit(P.white);
  const m = light.lit(P.mist);
  const k = light.lit(P.ink);
  s.rect(x + 1, y, 4, 6, k);
  s.rect(x, y + 1, 6, 4, k);
  s.rect(x + 1, y + 1, 4, 4, w);
  s.rect(x + 3, y + 3, 2, 2, m);
  s.px(x + 2, y + 2, light.lit(P.slate));
}

function cast(ctx: ShotContext, base: KitBase): { kit: Kit; light: Lighting } {
  const light = lightingFor(ctx.sun);
  return { kit: litKit(makeKit(base), light), light };
}

function playerSheet(ctx: ShotContext, base: KitBase): Surface {
  const { kit, light } = cast(ctx, base);
  const step = 36;
  const heights = PLAYER_ANIM_NAMES.map((a) => playerCell(a).cellH + 10);
  const s = new Surface(
    LABEL_W +
      8 +
      Math.max(
        ...PLAYER_ANIM_NAMES.map(
          (a) =>
            PLAYER_ANIMS[a].frames * Math.max(step, playerCell(a).cellW + 4),
        ),
      ),
    heights.reduce((a, b) => a + b, 0),
  );
  let top = 0;
  PLAYER_ANIM_NAMES.forEach((anim, row) => {
    const rowH = heights[row];
    const gy = top + rowH - 4;
    grassRow(s, top, rowH, gy, light);
    const info = PLAYER_ANIMS[anim];
    label(s, anim, 2, gy - 14, light);
    label(s, `${info.frames}@${info.fps}`, 2, gy - 7, light);
    const cell = playerCell(anim);
    const w = Math.max(step, cell.cellW + 4);
    s.vline(LABEL_W, top, rowH, light.lit(P.grassDeep));
    for (let f = 0; f < info.frames; f++) {
      const x = LABEL_W + 4 + Math.floor(w / 2) + f * w;
      drawPlayer(s, anim, f, x, gy, kit);
      const b = ballSpot(anim, f);
      if (b !== null) ball(s, x + b.x, gy + b.y, light);
      const h = handsSpot(anim, f);
      if (h !== null) s.rect(x + h.x, gy + h.y - 1, 2, 2, light.lit(P.gold));
    }
    s.hline(0, top, s.w, light.lit(P.grassDeep));
    top += rowH;
  });
  return s;
}

function kitsSheet(ctx: ShotContext): Surface {
  const light = lightingFor(ctx.sun);
  const colW = 30;
  const rowH = 46;
  const s = new Surface(60 + 3 * colW, rowH * KIT_BASES.length);
  KIT_BASES.forEach((base, row) => {
    const top = row * rowH;
    const gy = top + rowH - 4;
    grassRow(s, top, rowH, gy, light);
    label(s, base, 2, gy - 8, light);
    for (let look = 0; look < 3; look++) {
      const kit = litKit(
        makeKit(base, { look: look as 0 | 1 | 2, variant: look + row }),
        light,
      );
      drawPlayer(s, "idle", 0, 74 + look * colW, gy, kit);
    }
  });
  return s;
}

/** Plays an animation over ctx.t; a one-shot holds its end a moment and repeats. */
function playFrame(t: number, anim: PlayerAnim): number {
  const info = PLAYER_ANIMS[anim];
  if (info.loop) return frameAt(t, info.fps, info.frames);
  return Math.min(
    Math.floor(t * info.fps) % (info.frames + 3),
    info.frames - 1,
  );
}

function motion(anim: PlayerAnim) {
  return (ctx: ShotContext): Surface => {
    const { kit, light } = cast(ctx, "home");
    const s = new Surface(72, 64);
    const gy = s.h - 8;
    grassRow(s, 0, s.h, gy, light);
    const f = playFrame(ctx.t, anim);
    const x = 30;
    drawPlayer(s, anim, f, x, gy, kit);
    const b = ballSpot(anim, f);
    if (b !== null) ball(s, x + b.x, gy + b.y, light);
    const h = handsSpot(anim, f);
    if (h !== null) s.rect(x + h.x, gy + h.y - 1, 2, 2, light.lit(P.gold));
    return s;
  };
}

const MOVES: readonly PlayerAnim[] = [
  "idle",
  "run",
  "kick",
  "juggle",
  "celebrate",
  "dejected",
  "lift",
  "shrug",
  "slide",
];

export const shots: ShotMap = {
  "people/sheet": (ctx) => playerSheet(ctx, "home"),
  "people/sheet-away": (ctx) => playerSheet(ctx, "away"),
  "people/sheet-rival": (ctx) => playerSheet(ctx, "rival"),
  "people/sheet-referee": (ctx) => playerSheet(ctx, "referee"),
  "people/kits": (ctx) => kitsSheet(ctx),
  ...Object.fromEntries(MOVES.map((a) => [`people/${a}`, motion(a)])),
};
