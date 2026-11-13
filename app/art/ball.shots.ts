/**
 * Shots for the menu ball.
 *
 *   ./node_modules/.bin/tsx tools/snap.ts ball/menu --time all
 *   ./node_modules/.bin/tsx tools/snap.ts ball/menu --size all --scale 2
 *   ./node_modules/.bin/tsx tools/snap.ts ball/states --scale 3
 *   ./node_modules/.bin/tsx tools/snap.ts ball/rock --strip 8 --dt 0.625 --scale 2
 *   ./node_modules/.bin/tsx tools/snap.ts ball/sizes --scale 3
 *   ./node_modules/.bin/tsx tools/snap.ts ball/flight --strip 8 --dt 0.1 --scale 2
 *   ./node_modules/.bin/tsx tools/snap.ts ball/badge
 *   ./node_modules/.bin/tsx tools/snap.ts ball/shine --t 2 --strip 10 --dt 0.09 --scale 3
 *   ./node_modules/.bin/tsx tools/snap.ts ball/fit --scale 3
 *   ./node_modules/.bin/tsx tools/snap.ts ball/spin --strip 8 --dt 0.1 --scale 2
 *   ./node_modules/.bin/tsx tools/snap.ts ball/modes --scale 3
 *   ./node_modules/.bin/tsx tools/snap.ts ball/modes-fit --scale 3
 *
 * The `-big` sheets draw the balls at the home screen's radii on a monitor (74 to 120):
 *
 *   ./node_modules/.bin/tsx tools/snap.ts ball/menu-big --scale 1 --time all
 *   ./node_modules/.bin/tsx tools/snap.ts ball/modes-big --scale 1
 *   ./node_modules/.bin/tsx tools/snap.ts ball/fit-big --scale 1
 */

import {
  FONT_3x5,
  Surface,
  clamp,
  drawText,
  type ShotContext,
  type ShotMap,
} from "~/pixel";
import {
  ballShowPose,
  drawBall,
  drawBallShadow,
  type BallPatches,
  type BallState,
} from "./ball";
import { paintedFont } from "./lettering";
import { menuLayout } from "./layout";
import { lightingFor, type Lighting } from "./lighting";
import { MODE_COLORS, P } from "./palette";
import { drawSky } from "./sky";

const PATCHES: BallPatches = {
  left: { label: "HOME", icon: "home", accent: MODE_COLORS.home },
  right: { label: "AWAY", icon: "away", accent: MODE_COLORS.away },
  top: { label: "NEXT-GEN", icon: "nextgen", locked: true },
  bottom: { label: "RETRO", icon: "retro", locked: true },
  backRight: { label: "CLOSEST", icon: "pin", locked: true },
  backLeft: { label: "FURTHEST", icon: "globe", locked: true },
  rimLeft: { label: "GUESS WHO", icon: "shirt", locked: true },
  rimRight: { label: "SHOOTOUT", icon: "goal", locked: true },
};

/** RETRO and NEXT-GEN open (2026-11-13): four buttons, each framed in its mode's colour. */
const ERA: BallPatches = {
  ...PATCHES,
  top: { label: "NEXT-GEN", icon: "nextgen", accent: MODE_COLORS.nextgen },
  bottom: { label: "RETRO", icon: "retro", accent: MODE_COLORS.retro },
};

const ERA_SCORED: BallPatches = {
  ...ERA,
  left: { ...ERA.left, badge: "512" } as BallPatches["left"],
  bottom: { ...ERA.bottom, badge: "380" } as BallPatches["bottom"],
  top: { ...ERA.top, badge: "70" } as BallPatches["top"],
};

const SCORED: BallPatches = {
  ...PATCHES,
  left: { label: "HOME", icon: "home", accent: MODE_COLORS.home, badge: "512" },
};

function idle(cx: number, cy: number, r: number, t = 0): BallState {
  return {
    cx,
    cy,
    r,
    yaw: 0,
    pitch: 0,
    hovered: null,
    pressed: null,
    chosen: null,
    t,
  };
}

/** Sky above the horizon, plain grass below it. */
function backdrop(ctx: ShotContext, light: Lighting): Surface {
  const s = new Surface(ctx.w, ctx.h);
  const m = menuLayout(ctx.w, ctx.h);
  drawSky(s, {
    light,
    t: ctx.t,
    seed: ctx.seed,
    ...m.sky,
    horizonY: m.horizonY,
  });
  s.rect(0, m.horizonY, m.w, m.h - m.horizonY, light.lit(P.grass));
  return s;
}

/** The ball where the home screen puts it. */
function menu(
  ctx: ShotContext,
  over: Partial<BallState>,
  patches = PATCHES,
): Surface {
  const light = lightingFor(ctx.sun);
  const s = backdrop(ctx, light);
  const m = menuLayout(ctx.w, ctx.h);
  const ball = { ...idle(m.cx, m.ballCy, m.ballR, ctx.t), ...over };
  drawBallShadow(s, ball, m.ballCy + m.ballR - 1, light);
  drawBall(s, ball, patches, light);
  return s;
}

interface Cell extends Partial<BallState> {
  r: number;
  name: string;
  patches?: BallPatches;
}

/** Balls on grass, each with a caption, `perRow` to a row. */
function sheet(ctx: ShotContext, cells: readonly Cell[], perRow = 99): Surface {
  const light = lightingFor(ctx.sun);
  const gap = 8;
  const rows: Cell[][] = [];
  for (let i = 0; i < cells.length; i += perRow) {
    rows.push(cells.slice(i, i + perRow));
  }
  let w = 0;
  let h = 0;
  const tops: number[] = [];
  for (const row of rows) {
    tops.push(h);
    w = Math.max(
      w,
      row.reduce((sum, c) => sum + c.r * 2 + 1 + gap, gap),
    );
    h += Math.max(...row.map((c) => c.r)) * 2 + 1 + 30;
  }
  const s = new Surface(w, h);
  s.clear(light.lit(P.grass));
  rows.forEach((row, n) => {
    const ground = tops[n] + 8 + Math.max(...row.map((c) => c.r)) * 2;
    let x = gap;
    for (const c of row) {
      const state = { ...idle(x + c.r, ground - c.r, c.r, ctx.t), ...c };
      drawBallShadow(s, state, ground - 1, light);
      drawBall(s, state, c.patches ?? PATCHES, light);
      drawText(s, c.name, x + c.r, ground + 12, P.chalk, {
        font: FONT_3x5,
        align: "center",
      });
      x += c.r * 2 + 1 + gap;
    }
  });
  return s;
}

interface Cell extends Partial<BallState> {
  r: number;
  name: string;
  patches?: BallPatches;
}

/** Big balls (radius 74 to 120, the home screen's) on grass with captions, `perRow` to a row. */
function bigSheet(
  ctx: ShotContext,
  cells: readonly Cell[],
  perRow = 99,
): Surface {
  const light = lightingFor(ctx.sun);
  const gap = 16;
  const rows: Cell[][] = [];
  for (let i = 0; i < cells.length; i += perRow) {
    rows.push(cells.slice(i, i + perRow));
  }
  let w = 0;
  let h = 0;
  const tops: number[] = [];
  for (const row of rows) {
    tops.push(h);
    w = Math.max(
      w,
      row.reduce((sum, c) => sum + c.r * 2 + 1 + gap, gap),
    );
    h += Math.max(...row.map((c) => c.r)) * 2 + 1 + 52;
  }
  const s = new Surface(w, h);
  s.clear(light.lit(P.grass));
  const font = paintedFont(FONT_3x5);
  rows.forEach((row, n) => {
    const ground = tops[n] + 16 + Math.max(...row.map((c) => c.r)) * 2;
    let x = gap;
    for (const c of row) {
      const state: BallState = {
        cx: x + c.r,
        cy: ground - c.r,
        yaw: 0,
        pitch: 0,
        hovered: null,
        pressed: null,
        chosen: null,
        t: ctx.t,
        ...c,
      };
      drawBallShadow(s, state, ground - 2, light);
      drawBall(s, state, c.patches ?? PATCHES, light);
      drawText(s, c.name, x + c.r, ground + 20, P.chalk, {
        font,
        align: "center",
      });
      x += c.r * 2 + 1 + gap;
    }
  });
  return s;
}

export const shots: ShotMap = {
  "ball/menu": (ctx) => menu(ctx, {}),

  "ball/states": (ctx) =>
    sheet(ctx, [
      { r: 44, name: "IDLE" },
      { r: 44, name: "HOME HOVERED", hovered: "left" },
      { r: 44, name: "AWAY HOVERED", hovered: "right" },
      { r: 44, name: "HOME PRESSED", hovered: "left", pressed: "left" },
      { r: 44, name: "AWAY CHOSEN", chosen: "right" },
      { r: 44, name: "LOCKED HOVERED", hovered: "top" },
    ]),

  // The idle rock: --strip 8 --dt 0.625 shows one cycle.
  "ball/rock": (ctx) =>
    menu(ctx, { yaw: 0.12 * Math.sin((2 * Math.PI * ctx.t) / 5) }),

  "ball/sizes": (ctx) =>
    sheet(
      ctx,
      [16, 24, 32, 44, 51, 64].map((r) => ({ r, name: `R ${r}` })),
    ),

  // The states again on the two small layouts: r 37 (no line) and r 41 (line on the edge).
  "ball/states-small": (ctx) =>
    sheet(
      ctx,
      [37, 41].flatMap((r): Cell[] => [
        { r, name: `R ${r} IDLE` },
        { r, name: "HOME HOVERED", hovered: "left" },
        { r, name: "AWAY PRESSED", hovered: "right", pressed: "right" },
        { r, name: "HOME CHOSEN", chosen: "left" },
        { r, name: "AWAY HOVERED, SCORED", hovered: "right", patches: SCORED },
      ]),
      5,
    ),

  // The kick-off: --strip 8 --dt 0.1 shows the 0.8 seconds.
  "ball/flight": (ctx) => {
    const light = lightingFor(ctx.sun);
    const s = backdrop(ctx, light);
    const m = menuLayout(ctx.w, ctx.h);
    const u = clamp(ctx.t / 0.8, 0, 1);
    const e = 1 - (1 - u) * (1 - u);
    const r = m.ballR + (8 - m.ballR) * e;
    // Struck up and away towards the stadium: it comes down on the centre spot.
    const rest = m.ballCy + m.ballR - 1;
    const ground = Math.round(rest + (m.spotY - rest) * e);
    const lift = Math.round(e * m.h * 0.11 + 4 * u * (1 - u) * m.h * 0.05);
    const ball: BallState = {
      ...idle(m.cx, ground - r - lift, r, ctx.t),
      pitch: u * 9,
      chosen: "left",
    };
    drawBallShadow(s, ball, ground, light);
    drawBall(s, ball, PATCHES, light);
    return s;
  },

  "ball/badge": (ctx) => menu(ctx, {}, SCORED),

  // The idle shine: --t 2 --strip 10 --dt 0.09 shows it cross HOME and then AWAY.
  "ball/shine": (ctx) => sheet(ctx, [{ r: 44, name: "SHINE" }]),

  // The radii the home screen really uses, each at both ends of the idle rock, with and
  // without a score: labels and badges must stay inside their patches.
  "ball/fit": (ctx) =>
    sheet(
      ctx,
      [-0.12, 0.12].flatMap((yaw) =>
        [37, 41, 44, 47, 51, 59].map((r) => ({
          r,
          yaw,
          name: `R ${r}`,
          patches: yaw < 0 ? PATCHES : SCORED,
        })),
      ),
      6,
    ),

  // Every patch in the pose that shows it: the menu pose, half a turn (CLOSEST and
  // FURTHEST), NEXT-GEN, RETRO, GUESS WHO and SHOOTOUT straight on, and a locked patch
  // under the pointer.
  "ball/modes": (ctx) =>
    sheet(
      ctx,
      [
        { r: 45, name: "MENU" },
        { r: 45, name: "HALF TURN", ...ballShowPose("backLeft") },
        { r: 45, name: "NEXT-GEN", ...ballShowPose("top") },
        { r: 45, name: "RETRO", ...ballShowPose("bottom") },
        {
          r: 45,
          name: "CLOSEST HOVERED",
          ...ballShowPose("backRight"),
          hovered: "backRight",
        },
        {
          r: 45,
          name: "RETRO HOVERED",
          ...ballShowPose("bottom"),
          hovered: "bottom",
        },
        { r: 45, name: "GUESS WHO", ...ballShowPose("rimLeft") },
        { r: 45, name: "SHOOTOUT", ...ballShowPose("rimRight") },
        {
          r: 45,
          name: "SHOOTOUT HOVERED",
          ...ballShowPose("rimRight"),
          hovered: "rimRight",
        },
      ],
      3,
    ),

  // The shown poses at the radii the home screen uses, at both ends of the rock.
  "ball/modes-fit": (ctx) =>
    sheet(
      ctx,
      (["backLeft", "top", "bottom", "rimLeft", "rimRight"] as const).flatMap(
        (slot) =>
          [37, 45, 51, 59].map((r, n) => {
            const pose = ballShowPose(slot);
            return {
              r,
              name: `R ${r}`,
              ...pose,
              yaw: pose.yaw + (n % 2 === 0 ? -0.12 : 0.12),
            };
          }),
      ),
      4,
    ),

  // GUESS WHO and SHOOTOUT on the menu's ball, big, straight on.
  "ball/rim": (ctx) =>
    sheet(
      ctx,
      [
        { r: 52, name: "GUESS WHO", ...ballShowPose("rimLeft") },
        { r: 52, name: "SHOOTOUT", ...ballShowPose("rimRight") },
      ],
      2,
    ),

  // A slow turn about each axis, to check the solid and the masking.
  "ball/spin": (ctx) =>
    sheet(ctx, [
      { r: 44, name: "YAW", yaw: ctx.t * 2 },
      { r: 44, name: "PITCH", pitch: ctx.t * 2 },
      { r: 44, name: "ROLL", roll: ctx.t * 2 },
    ]),

  "ball/menu-big": (ctx) =>
    bigSheet(ctx, [
      { r: 118, name: "R 118" },
      { r: 89, name: "R 89", hovered: "right" },
      { r: 89, name: "SCORED", patches: SCORED },
    ]),

  "ball/states-big": (ctx) =>
    bigSheet(
      ctx,
      [
        { r: 90, name: "HOVER", hovered: "left" },
        { r: 90, name: "PRESSED", pressed: "left" },
        { r: 90, name: "CHOSEN", chosen: "right", t: 0.125 },
      ],
      3,
    ),

  "ball/modes-big": (ctx) =>
    bigSheet(
      ctx,
      [
        { r: 90, name: "HALF TURN", ...ballShowPose("backLeft") },
        { r: 90, name: "NEXT-GEN", ...ballShowPose("top") },
        { r: 90, name: "RETRO", ...ballShowPose("bottom"), hovered: "bottom" },
        { r: 90, name: "GUESS WHO", ...ballShowPose("rimLeft") },
        { r: 90, name: "SHOOTOUT", ...ballShowPose("rimRight") },
        {
          r: 90,
          name: "CLOSEST",
          ...ballShowPose("backRight"),
          hovered: "backRight",
        },
      ],
      3,
    ),

  "ball/fit-big": (ctx) =>
    bigSheet(
      ctx,
      [-0.12, 0.12].flatMap((yaw) =>
        [74, 82, 88, 94, 102, 118].map((r) => ({
          r,
          yaw,
          name: `R ${r}`,
          patches: yaw < 0 ? PATCHES : SCORED,
        })),
      ),
      6,
    ),

  // The four open patches: the menu pose, NEXT-GEN and RETRO straight on, their states,
  // and today's scores on them.
  "ball/era": (ctx) =>
    bigSheet(
      ctx,
      [
        { r: 89, name: "MENU", patches: ERA },
        { r: 89, name: "NEXT-GEN", ...ballShowPose("top"), patches: ERA },
        { r: 89, name: "RETRO", ...ballShowPose("bottom"), patches: ERA },
        { r: 84, name: "HOVER RETRO", hovered: "bottom", patches: ERA },
        {
          r: 84,
          name: "CHOSEN NEXT-GEN",
          chosen: "top",
          t: 0.125,
          patches: ERA,
        },
        { r: 84, name: "SCORED", patches: ERA_SCORED },
        {
          r: 88,
          name: "RETRO SCORED",
          ...ballShowPose("bottom"),
          patches: ERA_SCORED,
        },
        { r: 88, name: "ROCKED", yaw: 0.12, pitch: 0.06, patches: ERA },
        { r: 88, name: "PRESSED TOP", pressed: "top", patches: ERA },
      ],
      3,
    ),

  "ball/sizes-big": (ctx) =>
    bigSheet(ctx, [
      { r: 60, name: "60" },
      { r: 50, name: "50" },
      { r: 40, name: "40" },
      { r: 30, name: "30" },
      { r: 20, name: "20" },
      { r: 12, name: "12" },
    ]),
};
