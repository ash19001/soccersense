/**
 * Shots for RETRO's people and props (retro.ts, retro-props.ts), each frame today's (left)
 * beside RETRO's (right) so the layer can be checked against the art it is laid over.
 *
 *   ./node_modules/.bin/tsx tools/snap.ts people/retro-sheet --scale 3
 *   ./node_modules/.bin/tsx tools/snap.ts people/retro-youth --scale 3 --time night
 *   ./node_modules/.bin/tsx tools/snap.ts people/retro-keeper --scale 3
 *   ./node_modules/.bin/tsx tools/snap.ts people/retro-kits --scale 3
 *   ./node_modules/.bin/tsx tools/snap.ts people/retro-props --scale 4
 */

import {
  FONT_3x5,
  Surface,
  drawText,
  type ShotContext,
  type ShotMap,
} from "~/pixel";
import type { Era } from "../era";
import { lightingFor, type Lighting } from "../lighting";
import { P } from "../palette";
import {
  FETCH_ANIMS,
  FETCH_ANIM_NAMES,
  ballKidKit,
  drawFetch,
  fetchBall,
  fetchCell,
} from "./fetch";
import { KIT_BASES, litKit, makeKit, type Kit, type KitBase } from "./kit";
import {
  KEEPER_ANIMS,
  KEEPER_ANIM_NAMES,
  PLAYER_ANIMS,
  PLAYER_ANIM_NAMES,
  ballSpot,
  drawKeeper,
  drawPlayer,
  handsSpot,
  keeperCell,
  playerCell,
} from "./people";
import { drawBallRing, drawMatchBall, drawTrophy } from "./props";

const LABEL_W = 34;

function label(
  s: Surface,
  text: string,
  x: number,
  y: number,
  l: Lighting,
): void {
  drawText(s, text.toUpperCase(), x, y, l.lit(P.chalk), { font: FONT_3x5 });
}

function grassRow(
  s: Surface,
  top: number,
  h: number,
  gy: number,
  l: Lighting,
): void {
  s.rect(0, top, s.w, h, l.lit(P.grass));
  s.rect(0, gy, s.w, top + h - gy, l.lit(P.grassDark));
}

function ballAt(
  s: Surface,
  x: number,
  y: number,
  f: number,
  l: Lighting,
  era: Era,
): void {
  drawBallRing(s, x, y, l.lit(P.ink));
  drawMatchBall(s, x, y, f, l, { era });
}

/** One row per animation; each frame drawn today then RETRO. */
interface Row {
  name: string;
  frames: number;
  cellW: number;
  cellH: number;
  draw: (s: Surface, f: number, x: number, gy: number, era: Era) => void;
}

function sheet(ctx: ShotContext, rows: Row[]): Surface {
  const l = lightingFor(ctx.sun);
  const widths = rows.map((r) => r.frames * 2 * (r.cellW + 2) + r.frames * 6);
  const heights = rows.map((r) => r.cellH + 10);
  const s = new Surface(
    LABEL_W + 8 + Math.max(...widths),
    heights.reduce((a, b) => a + b, 0),
  );
  let top = 0;
  rows.forEach((r, i) => {
    const rowH = heights[i];
    const gy = top + rowH - 4;
    grassRow(s, top, rowH, gy, l);
    label(s, r.name, 2, gy - 8, l);
    s.vline(LABEL_W, top, rowH, l.lit(P.grassDeep));
    const w = r.cellW + 2;
    for (let f = 0; f < r.frames; f++) {
      const x0 = LABEL_W + 4 + f * (2 * w + 6) + (w >> 1);
      r.draw(s, f, x0, gy, "today");
      r.draw(s, f, x0 + w, gy, "retro");
    }
    s.hline(0, top, s.w, l.lit(P.grassDeep));
    top += rowH;
  });
  return s;
}

function kitOf(base: KitBase, era: Era, l: Lighting, look: 0 | 1 | 2 = 1): Kit {
  return litKit(makeKit(base, { look, variant: 1, era }), l);
}

function playerRows(ctx: ShotContext, base: KitBase, youth: boolean): Row[] {
  const l = lightingFor(ctx.sun);
  return PLAYER_ANIM_NAMES.map((anim) => {
    const cell = playerCell(anim, youth);
    return {
      name: anim,
      frames: PLAYER_ANIMS[anim].frames,
      cellW: cell.cellW,
      cellH: cell.cellH,
      draw: (s, f, x, gy, era) => {
        drawPlayer(s, anim, f, x, gy, kitOf(base, era, l), { youth });
        const b = ballSpot(anim, f, { youth });
        if (b !== null) ballAt(s, x + b.x, gy + b.y, f, l, era);
        const h = handsSpot(anim, f, { youth });
        if (h !== null) drawTrophy(s, x + h.x, gy + h.y, l, false, era);
      },
    };
  });
}

function keeperRows(ctx: ShotContext): Row[] {
  const l = lightingFor(ctx.sun);
  const keeper: Row[] = KEEPER_ANIM_NAMES.map((anim) => {
    const cell = keeperCell(anim);
    return {
      name: anim,
      frames: KEEPER_ANIMS[anim].frames,
      cellW: cell.cellW,
      cellH: cell.cellH,
      draw: (s, f, x, gy, era) =>
        drawKeeper(s, anim, f, x, gy, kitOf("keeper", era, l, 0)),
    };
  });
  const fetch: Row[] = FETCH_ANIM_NAMES.map((anim) => {
    const cell = fetchCell(anim);
    const kid = anim.startsWith("kid");
    return {
      name: anim,
      frames: FETCH_ANIMS[anim].frames,
      cellW: cell.cellW,
      cellH: cell.cellH,
      draw: (s, f, x, gy, era) => {
        const kit = kid
          ? litKit(ballKidKit(era), l)
          : kitOf("keeper", era, l, 0);
        drawFetch(s, anim, f, x, gy, kit);
        const b = fetchBall(anim, f);
        if (b !== null) ballAt(s, x + b.x, gy + b.y, f, l, era);
      },
    };
  });
  return [...keeper, ...fetch];
}

/** Every kit at idle in its three looks, today then RETRO; youth below. */
function kitsSheet(ctx: ShotContext): Surface {
  const l = lightingFor(ctx.sun);
  const colW = 28;
  const rowH = 46;
  const s = new Surface(64 + 6 * colW + 12, rowH * KIT_BASES.length);
  KIT_BASES.forEach((base, row) => {
    const top = row * rowH;
    const gy = top + rowH - 4;
    grassRow(s, top, rowH, gy, l);
    label(s, base, 2, gy - 8, l);
    (["today", "retro"] as const).forEach((era, e) => {
      for (let look = 0; look < 3; look++) {
        const kit = litKit(
          makeKit(base, { look: look as 0 | 1 | 2, variant: look + row, era }),
          l,
        );
        const x = 72 + e * (3 * colW + 12) + look * colW;
        drawPlayer(s, "idle", 0, x, gy, kit, {
          youth: look === 2 && base.startsWith("casual"),
        });
      }
    });
  });
  return s;
}

/** The balls' spin and the trophies, today and RETRO, plain and gold. */
function propsSheet(ctx: ShotContext): Surface {
  const l = lightingFor(ctx.sun);
  const s = new Surface(120, 70);
  grassRow(s, 0, s.h, 60, l);
  (["today", "retro"] as const).forEach((era, e) => {
    for (let f = 0; f < 3; f++) {
      const y = 10 + e * 14;
      drawBallRing(s, 10 + f * 12, y, l.lit(P.ink));
      drawMatchBall(s, 10 + f * 12, y, f, l, { era });
      drawBallRing(s, 50 + f * 12, y, l.lit(P.ink));
      drawMatchBall(s, 50 + f * 12, y, f, l, { era, gold: true });
    }
    drawTrophy(s, 30 + e * 44, 60, l, false, era);
    drawTrophy(s, 50 + e * 44, 60, l, true, era);
  });
  return s;
}

export const shots: ShotMap = {
  "people/retro-sheet": (ctx) => sheet(ctx, playerRows(ctx, "home", false)),
  "people/retro-sheet-rival": (ctx) =>
    sheet(ctx, playerRows(ctx, "rival", false)),
  "people/retro-sheet-referee": (ctx) =>
    sheet(ctx, playerRows(ctx, "referee", false)),
  "people/retro-sheet-national": (ctx) =>
    sheet(ctx, playerRows(ctx, "national-home", false)),
  "people/retro-youth": (ctx) =>
    sheet(ctx, playerRows(ctx, "casual-home", true)),
  "people/retro-keeper": (ctx) => sheet(ctx, keeperRows(ctx)),
  "people/retro-kits": (ctx) => kitsSheet(ctx),
  "people/retro-props": (ctx) => propsSheet(ctx),
};
