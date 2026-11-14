/**
 * Shots for the old leather ball (RETRO's kick-off on the home screen).
 *
 *   ./node_modules/.bin/tsx tools/snap.ts ball/leather --scale 2 --time all
 *   ./node_modules/.bin/tsx tools/snap.ts ball/leather-turn --scale 2 --time night
 */

import { FONT_3x5, Surface, drawText, type ShotContext } from "~/pixel";
import { drawBall, type BallPatches, type BallState } from "./ball";
import { drawLeatherBall, type LeatherBallState } from "./leather-ball";
import { paintedFont } from "./lettering";
import { lightingFor } from "./lighting";
import { MODE_COLORS, P } from "./palette";

const PATCHES: BallPatches = {
  left: { label: "HOME", icon: "home", accent: MODE_COLORS.home },
  right: { label: "AWAY", icon: "away", accent: MODE_COLORS.away },
  top: { label: "NEXT-GEN", icon: "nextgen", accent: MODE_COLORS.nextgen },
  bottom: { label: "RETRO", icon: "retro", accent: MODE_COLORS.retro },
};

interface Cell extends Partial<LeatherBallState> {
  r: number;
  name: string;
}

function sheet(
  ctx: ShotContext,
  cells: readonly Cell[],
  draw: (s: Surface, ball: LeatherBallState & BallState, n: number) => void,
): Surface {
  const light = lightingFor(ctx.sun);
  const gap = 14;
  const h = Math.max(...cells.map((c) => c.r)) * 2 + 1 + 40;
  const w = cells.reduce((sum, c) => sum + c.r * 2 + 1 + gap, gap);
  const s = new Surface(w, h);
  s.clear(light.env(P.slate));
  const font = paintedFont(FONT_3x5);
  let x = gap;
  cells.forEach((c, n) => {
    const ball = {
      cx: x + c.r,
      cy: 14 + Math.max(...cells.map((k) => k.r)),
      yaw: 0,
      pitch: 0,
      roll: 0,
      hovered: null,
      pressed: null,
      chosen: null,
      t: 0,
      ...c,
    };
    draw(s, ball, n);
    drawText(s, c.name, x + c.r, h - 14, P.chalk, { font, align: "center" });
    x += c.r * 2 + 1 + gap;
  });
  return s;
}

/** The dissolve's steps in `ball/leather-turn`. */
const COVERS: readonly number[] = [0.125, 0.375, 0.625, 0.875, 1];

/** The pose the menu's leather ball comes to rest in (the lace towards us). */
const REST = { yaw: -0.32, pitch: 0.28, roll: 0.22 };

export const shots = {
  "ball/leather": (ctx: ShotContext) =>
    sheet(
      ctx,
      [
        { r: 89, name: "REST 89", ...REST },
        { r: 120, name: "REST 120", ...REST },
        { r: 89, name: "FRONT", yaw: 0, pitch: 0, roll: 0 },
        { r: 89, name: "TURNED", yaw: 0.9, pitch: -0.4, roll: 0.6 },
        { r: 60, name: "60", ...REST },
        { r: 30, name: "30", ...REST },
        { r: 16, name: "16", ...REST },
      ],
      (s, ball) => drawLeatherBall(s, ball, lightingFor(ctx.sun)),
    ),

  // The menu ball turning into it as both spin: the old one's cover at a few steps.
  "ball/leather-turn": (ctx: ShotContext) =>
    sheet(
      ctx,
      COVERS.map((k) => ({ r: 89, name: `${Math.round(k * 16)}/16` })),
      (s, ball, n) => {
        const light = lightingFor(ctx.sun);
        const spin = n * 1.3;
        const modern: BallState = { ...ball, yaw: -spin, roll: 0.35 };
        drawBall(s, modern, PATCHES, light);
        const old = {
          ...ball,
          ...REST,
          yaw: REST.yaw + (COVERS.length - n) * 1.3,
        };
        drawLeatherBall(s, old, light, COVERS[n]);
      },
    ),
};
