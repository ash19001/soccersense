/**
 * Shots for the menu scene. Each builds a scene, feeds it the calls a page would and
 * returns the frame. `ctx.t` is the time since the start of whatever the shot shows; the
 * scene is advanced there in sixtieths of a second, as a browser would.
 *
 *   ./node_modules/.bin/tsx tools/snap.ts menu/home --time all --scale 2
 *   ./node_modules/.bin/tsx tools/snap.ts menu/home --size all --time night --scale 2
 *   ./node_modules/.bin/tsx tools/snap.ts menu/float --size 480x270 --strip 10 --dt 0.4 --scale 2    (one bob)
 *   ./node_modules/.bin/tsx tools/snap.ts menu/float --size 480x270 --t 8 --strip 10 --dt 0.3 --scale 2    (a deep breath)
 *   ./node_modules/.bin/tsx tools/snap.ts menu/hover menu/pressed menu/scores --scale 2
 *   ./node_modules/.bin/tsx tools/snap.ts menu/intro --size 480x270 --strip 10 --dt 0.1 --scale 1
 *   ./node_modules/.bin/tsx tools/snap.ts menu/kickoff-home --size 480x270 --strip 12 --dt 0.14 --scale 2
 *   ./node_modules/.bin/tsx tools/snap.ts menu/kickoff-away --size 480x270 --strip 12 --dt 0.14 --scale 2 --time night
 *   ./node_modules/.bin/tsx tools/snap.ts menu/kickoff-home --t 0.2 --strip 10 --dt 0.0167 --scale 2    (the strike)
 *   ./node_modules/.bin/tsx tools/snap.ts menu/kickoff-home --size 480x270 --t 0.6 --strip 10 --dt 0.0333 --crop 180,60,120,110 --scale 4    (the drop and the landing)
 *   ./node_modules/.bin/tsx tools/snap.ts menu/kickoff-away --size 480x270 --t 0.3 --strip 12 --dt 0.06 --crop 300,30,180,180 --scale 2    (over the town)
 *   ./node_modules/.bin/tsx tools/snap.ts menu/kickoff-away --size 130x281 --strip 12 --dt 0.1 --scale 2    (round the sign on a phone)
 *   ./node_modules/.bin/tsx tools/snap.ts menu/locked --strip 8 --dt 0.05 --scale 2
 *   ./node_modules/.bin/tsx tools/snap.ts menu/reduced --strip 4 --dt 0.06 --scale 2
 */

import { Surface, type ShotContext, type ShotMap } from "~/pixel";
import { ballSlotCenter, type BallSlot } from "~/art/ball";
import { menuLayout } from "~/art/layout";
import { lightingFor } from "~/art/lighting";
import { P } from "~/art/palette";
import { MenuScene, type MenuLabels } from "./menu";

const LABELS: MenuLabels = {
  home: "HOME",
  away: "AWAY",
  locked: "SOON",
  header: "TODAY'S STADIUM",
  tagline: "DAILY FOOTBALL TRIVIA",
};

const STADIUM = { name: "Anfield", city: "Liverpool", country: "England" };

const STEP = 1 / 60;

function make(ctx: ShotContext, intro = false): MenuScene {
  const scene = new MenuScene({
    seed: ctx.seed,
    stadium: STADIUM,
    labels: LABELS,
    intro,
  });
  scene.resize(ctx.w, ctx.h);
  scene.setLighting(lightingFor(ctx.sun));
  return scene;
}

function advance(scene: MenuScene, t: number): void {
  const n = Math.max(0, Math.round(t / STEP));
  for (let i = 0; i < n; i++) scene.update(STEP);
}

function frame(ctx: ShotContext, scene: MenuScene): Surface {
  const s = new Surface(ctx.w, ctx.h);
  scene.draw(s);
  return s;
}

/** The middle of a patch on the ball at rest. */
function patchAt(ctx: ShotContext, slot: BallSlot): { x: number; y: number } {
  const m = menuLayout(ctx.w, ctx.h);
  return ballSlotCenter(
    {
      cx: m.cx,
      cy: m.ballCy,
      r: m.ballR,
      yaw: 0,
      pitch: 0,
      hovered: null,
      pressed: null,
      chosen: null,
      t: 0,
    },
    slot,
  );
}

export const shots: ShotMap = {
  // Idle, no entrance.
  "menu/home": (ctx) => {
    const scene = make(ctx);
    advance(scene, ctx.t);
    return frame(ctx, scene);
  },

  // HOME hovered and AWAY hovered, side by side.
  "menu/hover": (ctx) => {
    const out = new Surface(ctx.w * 2 + 2, ctx.h);
    (["left", "right"] as const).forEach((slot, i) => {
      const scene = make(ctx);
      advance(scene, ctx.t);
      const p = patchAt(ctx, slot);
      scene.pointer({ type: "move", x: p.x, y: p.y });
      out.blit(frame(ctx, scene), i * (ctx.w + 2), 0);
    });
    return out;
  },

  "menu/pressed": (ctx) => {
    const scene = make(ctx);
    advance(scene, ctx.t);
    const p = patchAt(ctx, "left");
    scene.pointer({ type: "move", x: p.x, y: p.y });
    scene.pointer({ type: "down", x: p.x, y: p.y });
    return frame(ctx, scene);
  },

  // Both modes played today.
  "menu/scores": (ctx) => {
    const scene = make(ctx);
    scene.setScores({ home: 512, away: 87 });
    advance(scene, ctx.t);
    return frame(ctx, scene);
  },

  // The idle ball over time, close up, for a strip: --strip 10 --dt 0.4 is one whole bob,
  // --t 8 --strip 10 --dt 0.3 a deep breath. The gold ticks either side are the row of its
  // spot; the dotted lines are the rows just above and just below the ball when it is on
  // its spot, so a ball that has risen or sunk breaks one of them.
  "menu/float": (ctx) => {
    const scene = make(ctx);
    advance(scene, ctx.t);
    const m = menuLayout(ctx.w, ctx.h);
    const pad = m.ballR + 10;
    const out = new Surface(pad * 2 + 1, pad * 2 + 1);
    out.blit(frame(ctx, scene), pad - m.cx, pad - m.ballCy);
    out.hline(0, pad, 4, P.gold);
    out.hline(out.w - 4, pad, 4, P.gold);
    for (let x = 0; x < out.w; x += 4) {
      out.hline(x, pad - m.ballR - 1, 2, P.gold);
      out.hline(x, pad + m.ballR + 1, 2, P.gold);
    }
    return out;
  },

  // The entrance: --strip 10 --dt 0.1.
  "menu/intro": (ctx) => {
    const scene = make(ctx, true);
    advance(scene, ctx.t);
    return frame(ctx, scene);
  },

  // HOME chosen at t = 0: --strip 10 --dt 0.1, or --t 0.2 --strip 10 --dt 0.0167 for the
  // strike alone.
  "menu/kickoff-home": (ctx) => {
    const scene = make(ctx);
    scene.choose("home");
    advance(scene, ctx.t);
    return frame(ctx, scene);
  },

  "menu/kickoff-away": (ctx) => {
    const scene = make(ctx);
    scene.choose("away");
    advance(scene, ctx.t);
    return frame(ctx, scene);
  },

  // A locked patch pressed and released at t = 0: --strip 8 --dt 0.05.
  "menu/locked": (ctx) => {
    const scene = make(ctx);
    const p = patchAt(ctx, "top");
    scene.pointer({ type: "down", x: p.x, y: p.y, touch: true });
    scene.pointer({ type: "up", x: p.x, y: p.y, touch: true });
    advance(scene, ctx.t);
    return frame(ctx, scene);
  },

  // The HOME kick-off with reduced motion: a lit patch, then ink. --strip 4 --dt 0.06.
  "menu/reduced": (ctx) => {
    const scene = make(ctx);
    scene.setReducedMotion(true);
    scene.choose("home");
    advance(scene, ctx.t);
    return frame(ctx, scene);
  },
};
