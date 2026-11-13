/**
 * Shots for NEXT-GEN's people and props (nextgen.ts), each beside today's HOME.
 *
 *   ./node_modules/.bin/tsx tools/snap.ts people/nextgen-sheet --scale 3
 *   ./node_modules/.bin/tsx tools/snap.ts people/nextgen-youth-sheet --scale 3 --time night
 *   (and people/nextgen-kits, nextgen-keeper-sheet, nextgen-fetch-sheet, nextgen-props)
 *
 * A sheet row is one animation: its frames in today's HOME kit, then in NEXT-GEN's kits
 * (the hero's club kit, the national kit, the rivals, the referee).
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
import { FETCH_ANIMS, FETCH_ANIM_NAMES, ballKidKit, drawFetch } from "./fetch";
import { KIT_BASES, litKit, makeKit, type Kit, type KitBase } from "./kit";
import {
  KEEPER_ANIMS,
  KEEPER_ANIM_NAMES,
  PLAYER_ANIMS,
  PLAYER_ANIM_NAMES,
  drawKeeper,
  drawPlayer,
  keeperCell,
  playerCell,
} from "./people";
import { BALL_FRAMES, drawBallRing, drawMatchBall, drawTrophy } from "./props";

const LABEL_W = 34;

function label(
  s: Surface,
  text: string,
  x: number,
  y: number,
  light: Lighting,
) {
  drawText(s, text.toUpperCase(), x, y, light.lit(P.chalk), { font: FONT_3x5 });
}

function grassRow(s: Surface, top: number, h: number, gy: number, l: Lighting) {
  s.rect(0, top, s.w, h, l.lit(P.grass));
  s.rect(0, gy, s.w, top + h - gy, l.lit(P.grassDark));
  s.hline(0, top, s.w, l.lit(P.grassDeep));
}

type Who = "adult" | "youth" | "keeper" | "fetch";

interface Column {
  base: KitBase;
  era: Era;
}

const PLAYER_COLUMNS: readonly Column[] = [
  { base: "home", era: "today" },
  { base: "home", era: "nextgen" },
  { base: "national-home", era: "nextgen" },
  { base: "rival", era: "nextgen" },
];

const YOUTH_COLUMNS: readonly Column[] = [
  { base: "casual-home", era: "today" },
  { base: "casual-home", era: "nextgen" },
  { base: "home", era: "nextgen" },
  { base: "casual", era: "nextgen" },
  { base: "keeper", era: "nextgen" },
];

function kitFor(c: Column, i: number, light: Lighting): Kit {
  return litKit(
    makeKit(c.base, {
      era: c.era,
      look: ((i + 1) % 3) as 0 | 1 | 2,
      variant: i,
    }),
    light,
  );
}

function sheet(ctx: ShotContext, who: Who): Surface {
  const light = lightingFor(ctx.sun);
  const names: readonly string[] =
    who === "keeper"
      ? KEEPER_ANIM_NAMES
      : who === "fetch"
        ? FETCH_ANIM_NAMES
        : PLAYER_ANIM_NAMES;
  const youth = who === "youth";
  const cols: readonly Column[] =
    who === "youth"
      ? YOUTH_COLUMNS
      : who === "keeper"
        ? [
            { base: "keeper", era: "today" },
            { base: "keeper", era: "nextgen" },
          ]
        : PLAYER_COLUMNS;
  const info = (a: string) =>
    who === "keeper"
      ? KEEPER_ANIMS[a as keyof typeof KEEPER_ANIMS]
      : who === "fetch"
        ? FETCH_ANIMS[a as keyof typeof FETCH_ANIMS]
        : PLAYER_ANIMS[a as keyof typeof PLAYER_ANIMS];
  const cell = (a: string) =>
    who === "keeper"
      ? keeperCell(a as keyof typeof KEEPER_ANIMS)
      : who === "fetch"
        ? { cellW: 40, cellH: 44 }
        : playerCell(a as keyof typeof PLAYER_ANIMS, youth);
  const colW = (a: string) => info(a).frames * (cell(a).cellW + 2) + 6;
  const blockW = Math.max(...names.map(colW));
  const heights = names.map((a) => cell(a).cellH + 8);
  const fetchCols: readonly Kit[] = [
    litKit(makeKit("keeper", { look: 0 }), light),
    litKit(makeKit("keeper", { look: 0, era: "nextgen" }), light),
    litKit(ballKidKit(), light),
    litKit(ballKidKit("nextgen"), light),
  ];
  const ncols = who === "fetch" ? fetchCols.length : cols.length;
  const s = new Surface(
    LABEL_W + ncols * blockW,
    heights.reduce((a, b) => a + b, 0),
  );
  let top = 0;
  names.forEach((anim, row) => {
    const rowH = heights[row];
    const gy = top + rowH - 4;
    grassRow(s, top, rowH, gy, light);
    label(s, anim.slice(0, 8), 2, gy - 10, light);
    const c = cell(anim);
    for (let k = 0; k < ncols; k++) {
      const x0 = LABEL_W + k * blockW;
      s.vline(x0 - 2, top, rowH, light.lit(P.grassDeep));
      const kit =
        who === "fetch" ? fetchCols[k] : kitFor(cols[k], k + row, light);
      for (let f = 0; f < info(anim).frames; f++) {
        const x = x0 + Math.floor(c.cellW / 2) + f * (c.cellW + 2);
        if (who === "keeper") {
          drawKeeper(s, anim as never, f, x, gy, kit);
        } else if (who === "fetch") {
          drawFetch(s, anim as never, f, x, gy, kit);
        } else {
          drawPlayer(s, anim as never, f, x, gy, kit, { youth });
        }
      }
    }
    top += rowH;
  });
  return s;
}

/** Every kit base in NEXT-GEN, three looks each, beside today's. */
function kitsSheet(ctx: ShotContext): Surface {
  const light = lightingFor(ctx.sun);
  const colW = 28;
  const rowH = 46;
  const s = new Surface(60 + 7 * colW, rowH * KIT_BASES.length);
  KIT_BASES.forEach((base, row) => {
    const top = row * rowH;
    const gy = top + rowH - 4;
    grassRow(s, top, rowH, gy, light);
    label(s, base, 2, gy - 8, light);
    for (let i = 0; i < 7; i++) {
      const era: Era = i === 0 ? "today" : "nextgen";
      const look = (i % 3) as 0 | 1 | 2;
      const kit = litKit(makeKit(base, { look, variant: i + row, era }), light);
      drawPlayer(s, "idle", 0, 74 + i * colW, gy, kit, { youth: i >= 4 });
    }
  });
  return s;
}

/** The ball's spin (today, NEXT-GEN, NEXT-GEN gold) and the trophies, both frames. */
function propsSheet(ctx: ShotContext): Surface {
  const light = lightingFor(ctx.sun);
  const s = new Surface(150, 60);
  s.clear(light.lit(P.grass));
  const rows: { era: Era; gold: boolean }[] = [
    { era: "today", gold: false },
    { era: "nextgen", gold: false },
    { era: "nextgen", gold: true },
  ];
  rows.forEach((r, j) => {
    for (let f = 0; f < BALL_FRAMES; f++) {
      const x = 10 + f * 14;
      const y = 10 + j * 14;
      drawBallRing(s, x, y, light.lit(P.ink));
      drawMatchBall(s, x, y, f, light, { gold: r.gold, era: r.era });
    }
  });
  drawTrophy(s, 70, 30, light, false);
  drawTrophy(s, 92, 30, light, true);
  drawTrophy(s, 114, 30, light, false, "nextgen");
  drawTrophy(s, 136, 30, light, true, "nextgen");
  drawTrophy(s, 114, 58, light, false, "nextgen");
  return s;
}

export const shots: ShotMap = {
  "people/nextgen-sheet": (ctx) => sheet(ctx, "adult"),
  "people/nextgen-youth-sheet": (ctx) => sheet(ctx, "youth"),
  "people/nextgen-keeper-sheet": (ctx) => sheet(ctx, "keeper"),
  "people/nextgen-fetch-sheet": (ctx) => sheet(ctx, "fetch"),
  "people/nextgen-kits": (ctx) => kitsSheet(ctx),
  "people/nextgen-props": (ctx) => propsSheet(ctx),
};
