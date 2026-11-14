/**
 * Shots for the ball of the future (NEXT-GEN's kick-off on the home screen).
 *
 *   ./node_modules/.bin/tsx tools/snap.ts ball/future --scale 2 --time all
 *   ./node_modules/.bin/tsx tools/snap.ts ball/future-power --scale 2 --time night
 *   ./node_modules/.bin/tsx tools/snap.ts ball/future-turn --scale 2 --time night
 */

import { FONT_3x5, Surface, drawText, type ShotContext } from "~/pixel";
import { drawBall, type BallPatches, type BallState } from "./ball";
import { drawFutureBall, pixelate, type FutureBallState } from "./future-ball";
import { paintedFont } from "./lettering";
import { lightingFor } from "./lighting";
import { MODE_COLORS, P } from "./palette";

const PATCHES: BallPatches = {
  left: { label: "HOME", icon: "home", accent: MODE_COLORS.home },
  right: { label: "AWAY", icon: "away", accent: MODE_COLORS.away },
  top: { label: "NEXT-GEN", icon: "nextgen", accent: MODE_COLORS.nextgen },
  bottom: { label: "RETRO", icon: "retro", accent: MODE_COLORS.retro },
};

interface Cell extends Partial<FutureBallState> {
  r: number;
  name: string;
}

function sheet(
  ctx: ShotContext,
  cells: readonly Cell[],
  draw: (s: Surface, ball: FutureBallState & BallState, n: number) => void,
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

/** The pose the menu's future ball comes to rest in. */
const REST = { yaw: 0.42, pitch: -0.38, roll: -0.18 };

/** The change in `ball/future-turn`: each cell's square size, and whether it is the new ball. */
const TURN: readonly { block: number; future: boolean }[] = [
  { block: 3, future: false },
  { block: 6, future: false },
  { block: 10, future: false },
  { block: 10, future: true },
  { block: 6, future: true },
  { block: 3, future: true },
  { block: 0, future: true },
];

export const shots = {
  "ball/future": (ctx: ShotContext) =>
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
      (s, ball) => drawFutureBall(s, ball, lightingFor(ctx.sun)),
    ),

  // Its seams at each power: dark, dim, lit, and the flash as it powers on.
  "ball/future-power": (ctx: ShotContext) =>
    sheet(
      ctx,
      [0, 1, 2, 3].map((p) => ({ r: 89, name: `POWER ${p}`, ...REST })),
      (s, ball, n) => drawFutureBall(s, ball, lightingFor(ctx.sun), n),
    ),

  // The menu ball turning into it as both spin: in squares, bigger, then the new ball in
  // squares, smaller.
  "ball/future-turn": (ctx: ShotContext) =>
    sheet(
      ctx,
      TURN.map((k) => ({
        r: 89,
        name: k.block > 0 ? `${k.block} PX` : "DONE",
      })),
      (s, ball, n) => {
        const light = lightingFor(ctx.sun);
        const spin = n * 1.3;
        const step = TURN[n];
        if (step.future) {
          drawFutureBall(
            s,
            { ...ball, ...REST, yaw: REST.yaw - (TURN.length - n) * 1.3 },
            light,
            1,
          );
        } else {
          const modern: BallState = { ...ball, yaw: spin, roll: -0.35 };
          drawBall(s, modern, PATCHES, light);
        }
        pixelate(s, ball.cx, ball.cy, ball.r, step.block, n, 7);
      },
    ),
};
