/**
 * Shots for the people of the career scene.
 *
 *   ./node_modules/.bin/tsx tools/snap.ts people/sheet --scale 10
 *   ./node_modules/.bin/tsx tools/snap.ts people/youth-sheet --scale 10
 *   ./node_modules/.bin/tsx tools/snap.ts people/keeper-sheet --scale 10
 *   ./node_modules/.bin/tsx tools/snap.ts people/kits --scale 4
 *   ./node_modules/.bin/tsx tools/snap.ts people/props --scale 10 --time all
 *   ./node_modules/.bin/tsx tools/snap.ts people/in-context --scale 3 --time all
 *   ./node_modules/.bin/tsx tools/snap.ts people/park --scale 3
 *   ./node_modules/.bin/tsx tools/snap.ts people/kick --strip 8 --dt 0.1 --scale 6
 *     (also people/run, juggle, celebrate, lift, leap, smother, and the child in
 *      people/youth-run, youth-kick, youth-juggle)
 *
 * The keeper sheet draws the ball at keeperHands where he holds it (hold, smother 1)
 * and a red dot at keeperHands on the other frames.
 */

import {
  FONT_3x5,
  Surface,
  drawText,
  frameAt,
  type Color,
  type ShotContext,
  type ShotMap,
} from "~/pixel";
import { lightingFor, type Lighting } from "../lighting";
import { P } from "../palette";
import { KIT_BASES, litKit, makeKit, type Kit } from "./kit";
import {
  KEEPER_ANIMS,
  KEEPER_ANIM_NAMES,
  PLAYER_ANIMS,
  PLAYER_ANIM_NAMES,
  ballSpot,
  drawKeeper,
  drawPlayer,
  handsSpot,
  keeperHands,
  type KeeperAnim,
  type PlayerAnim,
} from "./people";
import { drawMatchBall, drawPuff, drawTrophy } from "./props";

const DAY = lightingFor({ elevation: 45, morning: false });

const LABEL_W = 46;
const STEP = 20;

function label(s: Surface, text: string, x: number, y: number): void {
  drawText(s, text.toUpperCase(), x, y, P.chalk, { font: FONT_3x5 });
}

/** A strip of grass with a darker ground line, for a sheet row. */
function grassRow(s: Surface, top: number, h: number, groundY: number): void {
  s.rect(0, top, s.w, h, P.grass);
  s.rect(0, groundY, s.w, top + h - groundY, P.grassDark);
}

function playerSheet(youth: boolean, kit: Kit): Surface {
  const rowH = youth ? 32 : 38;
  const s = new Surface(
    LABEL_W + 8 * STEP + 6,
    rowH * PLAYER_ANIM_NAMES.length,
  );
  PLAYER_ANIM_NAMES.forEach((anim, row) => {
    const top = row * rowH;
    const gy = top + rowH - 4;
    grassRow(s, top, rowH, gy);
    const info = PLAYER_ANIMS[anim];
    label(s, anim, 2, gy - 8);
    label(s, `${info.frames}@${info.fps}`, 2, gy - 1);
    for (let f = 0; f < info.frames; f++) {
      const x = LABEL_W + 8 + f * STEP;
      drawPlayer(s, anim, f, x, gy, kit, { youth });
      const b = ballSpot(anim, f, { youth });
      if (b !== null) drawMatchBall(s, x + b.x, gy + b.y, f, DAY);
      const h = handsSpot(anim, f, { youth });
      if (h !== null) drawTrophy(s, x + h.x, gy + h.y, DAY, f === 1);
    }
    s.hline(0, top, s.w, P.grassDeep);
  });
  return s;
}

function keeperSheet(): Surface {
  const rowH = 30;
  const kit = makeKit("keeper", { look: 2 });
  const s = new Surface(
    LABEL_W + 3 * STEP + 6,
    rowH * KEEPER_ANIM_NAMES.length,
  );
  KEEPER_ANIM_NAMES.forEach((anim, row) => {
    const top = row * rowH;
    const gy = top + rowH - 4;
    grassRow(s, top, rowH, gy);
    const info = KEEPER_ANIMS[anim];
    label(s, anim, 2, gy - 8);
    label(s, `${info.frames}@${info.fps}`, 2, gy - 1);
    for (let f = 0; f < info.frames; f++) {
      const x = LABEL_W + 8 + f * STEP;
      drawKeeper(s, anim, f, x, gy, kit);
      const g = keeperHands(anim, f);
      if (g !== null && (anim === "hold" || (anim === "smother" && f === 1)))
        drawMatchBall(s, x + g.x, gy + g.y, 0, DAY);
      else if (g !== null) s.px(x + g.x, gy + g.y, P.gradeWide);
    }
    s.hline(0, top, s.w, P.grassDeep);
  });
  return s;
}

/** Plays an animation over ctx.t; a one-shot animation holds its end a moment and repeats. */
function playFrame(
  t: number,
  fps: number,
  frames: number,
  loop: boolean,
): number {
  if (loop) return frameAt(t, fps, frames);
  const cycle = frames + 3;
  return Math.min(Math.floor(t * fps) % cycle, frames - 1);
}

function motion(anim: PlayerAnim, youth = false) {
  return (ctx: ShotContext): Surface => {
    const s = new Surface(56, youth ? 40 : 48);
    const gy = s.h - 6;
    grassRow(s, 0, s.h, gy);
    const info = PLAYER_ANIMS[anim];
    const f = playFrame(ctx.t, info.fps, info.frames, info.loop);
    const x = 20;
    const kit = makeKit(youth ? "casual-home" : "home");
    drawPlayer(s, anim, f, x, gy, kit, { youth });
    const b = ballSpot(anim, f, { youth });
    if (b !== null)
      drawMatchBall(s, x + b.x, gy + b.y, Math.floor(ctx.t * 12), DAY);
    else if (anim === "kick") {
      // After the strike the ball is away to the right.
      const since = (Math.floor(ctx.t * info.fps) % (info.frames + 3)) - 2;
      drawMatchBall(s, x + 8 + since * 7, gy - 2 - since, since, DAY);
    }
    const h = handsSpot(anim, f, { youth });
    if (h !== null) drawTrophy(s, x + h.x, gy + h.y, DAY, f === 1);
    return s;
  };
}

function keeperMotion(anim: KeeperAnim) {
  return (ctx: ShotContext): Surface => {
    const s = new Surface(48, 48);
    const gy = s.h - 6;
    grassRow(s, 0, s.h, gy);
    const info = KEEPER_ANIMS[anim];
    const f = playFrame(ctx.t, info.fps, info.frames, info.loop);
    drawKeeper(s, anim, f, 26, gy, makeKit("keeper", { look: 2 }));
    return s;
  };
}

function kitsSheet(): Surface {
  const colW = 18;
  const rowH = 24;
  const s = new Surface(58 + 6 * colW, rowH * KIT_BASES.length);
  KIT_BASES.forEach((base, row) => {
    const top = row * rowH;
    const gy = top + rowH - 3;
    grassRow(s, top, rowH, gy);
    label(s, base, 2, gy - 6);
    for (let look = 0; look < 3; look++) {
      const kit = makeKit(base, {
        look: look as 0 | 1 | 2,
        variant: look + row,
      });
      drawPlayer(s, "idle", 0, 66 + look * colW, gy, kit);
      drawPlayer(s, "idle", 0, 66 + (look + 3) * colW, gy, kit, {
        youth: true,
      });
    }
  });
  return s;
}

function propsSheet(ctx: ShotContext): Surface {
  const light = lightingFor(ctx.sun);
  const s = new Surface(96, 28);
  s.clear(light.lit(P.grass));
  s.rect(0, 22, s.w, 6, light.lit(P.grassDark));
  for (let f = 0; f < 3; f++) {
    drawMatchBall(s, 4 + f * 6, 19, f, light);
    drawMatchBall(s, 4 + f * 6, 13, f, light, { gold: true });
  }
  drawTrophy(s, 30, 22, light);
  drawTrophy(s, 42, 22, light, true);
  for (let f = 0; f < 3; f++)
    drawPuff(s, 58 + f * 10, 22, f, light.lit(P.chalk));
  for (let f = 0; f < 3; f++)
    drawPuff(s, 58 + f * 10, 12, f, light.lit(P.woodDark));
  return s;
}

/** A plain strip of pitch for the context shots (the real grounds are not mine). */
function pitchStrip(
  s: Surface,
  light: Lighting,
  gy: number,
  park: boolean,
): void {
  const env = light.env;
  const lit = light.lit;
  s.rect(0, 0, s.w, gy - 14, park ? env(P.grassDeep) : lit(P.concreteDark));
  if (!park) {
    for (let y = 2; y < gy - 18; y += 4) {
      for (let x = (y / 4) % 2 === 0 ? 0 : 2; x < s.w; x += 4) {
        const c = (x * 7 + y * 3) % 5 === 0 ? P.chalk : P.home;
        s.rect(x, y, 3, 2, lit(c));
        s.px(x + 1, y - 1, lit(P.skinB));
      }
    }
  }
  const grass = park ? env : lit;
  for (let y = gy - 14; y < s.h; y++) {
    const band = Math.floor((y - (gy - 14)) / 6) % 2 === 0;
    s.hline(0, y, s.w, grass(band ? P.grass : P.grassLight));
  }
  if (!park) s.hline(0, gy - 13, s.w, lit(P.chalk));
}

function goal(s: Surface, light: Lighting, x: number, gy: number): void {
  const c = light.lit(P.chalk);
  const net = light.lit(P.mist);
  for (let i = 0; i < 24; i += 2) s.dither(x + 1, gy - 24 + i, 11, 1, net, 0.5);
  s.vline(x - 3, gy - 27, 24, c);
  s.hline(x - 3, gy - 27, 14, c);
  s.line(x + 10, gy - 27, x + 14, gy, net);
  s.vline(x + 1, gy - 24, 26, c);
  s.hline(x + 1, gy - 24, 3, c);
}

function inContext(ctx: ShotContext): Surface {
  const light = lightingFor(ctx.sun);
  const s = new Surface(480, 90);
  const gy = 60;
  const cx = 240;
  pitchStrip(s, light, gy, false);
  const k = (base: Parameters<typeof makeKit>[0], look: 0 | 1 | 2) =>
    litKit(makeKit(base, { look }), light);
  goal(s, light, cx + 44, gy);
  drawPlayer(s, "run", 1, cx + 24, gy - 4, k("rival", 2), { flipX: true });
  drawPlayer(s, "run", 3, cx - 6, gy - 5, k("home", 0));
  drawKeeper(s, "leap", 1, cx + 38, gy, k("keeper", 0), { flipX: true });
  drawPlayer(s, "kick", 2, cx - 26, gy, k("home", 1));
  const b = ballSpot("kick", 2);
  if (b !== null) drawMatchBall(s, cx - 26 + b.x, gy + b.y, 0, light);
  drawPuff(s, cx - 25, gy, 0, light.lit(P.grassHi));
  drawPlayer(s, "idle", 0, cx - 52, gy + 4, k("home", 2));
  drawPlayer(s, "run", 0, cx + 10, gy + 5, k("rival", 0), { flipX: true });
  return s;
}

function park(ctx: ShotContext): Surface {
  const light = lightingFor(ctx.sun);
  const s = new Surface(480, 90);
  const gy = 60;
  const cx = 240;
  pitchStrip(s, light, gy, true);
  const k = (
    base: Parameters<typeof makeKit>[0],
    look: 0 | 1 | 2,
    variant = 0,
  ) => litKit(makeKit(base, { look, variant }), light);
  // Two piles of jumpers for posts.
  const pile = (x: number, y: number, a: Color, b: Color) => {
    s.rect(x - 2, y - 2, 5, 2, light.env(a));
    s.rect(x - 1, y - 3, 3, 1, light.env(b));
    s.hline(x - 2, y, 5, light.env(P.grassDeep));
  };
  pile(cx + 45, gy + 2, P.skyTop, P.skyMid);
  pile(cx + 41, gy - 3, P.brick, P.brickLight);
  const gk = k("keeper", 0);
  drawPlayer(s, "idle", Math.floor(ctx.t * 2), cx + 38, gy, gk, {
    flipX: true,
    youth: true,
  });
  drawPlayer(s, "run", 2, cx + 10, gy + 5, k("casual", 2, 1), {
    flipX: true,
    youth: true,
  });
  drawPlayer(s, "idle", 1, cx - 6, gy - 5, k("casual", 0, 4), { youth: true });
  const f = frameAt(ctx.t, PLAYER_ANIMS.juggle.fps, 8);
  drawPlayer(s, "juggle", f, cx - 26, gy, k("casual-home", 1), { youth: true });
  const b = ballSpot("juggle", f, { youth: true });
  if (b !== null) drawMatchBall(s, cx - 26 + b.x, gy + b.y, f, light);
  drawPlayer(
    s,
    "celebrate",
    Math.floor(ctx.t * 6),
    cx - 52,
    gy + 4,
    k("casual", 2, 2),
    {
      youth: true,
    },
  );
  return s;
}

export const shots: ShotMap = {
  "people/sheet": () => playerSheet(false, makeKit("home")),
  "people/youth-sheet": () => playerSheet(true, makeKit("casual-home")),
  "people/keeper-sheet": () => keeperSheet(),
  "people/kits": () => kitsSheet(),
  "people/props": (ctx) => propsSheet(ctx),
  "people/in-context": (ctx) => inContext(ctx),
  "people/park": (ctx) => park(ctx),
  "people/run": motion("run"),
  "people/kick": motion("kick"),
  "people/juggle": motion("juggle"),
  "people/celebrate": motion("celebrate"),
  "people/lift": motion("lift"),
  "people/leap": keeperMotion("leap"),
  "people/smother": keeperMotion("smother"),
  "people/youth-run": motion("run", true),
  "people/youth-kick": motion("kick", true),
  "people/youth-juggle": motion("juggle", true),
};
