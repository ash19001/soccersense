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
 *   ./node_modules/.bin/tsx tools/snap.ts menu/kickoff-nextgen --size 960x540 --t 0.3 --strip 6 --dt 0.1 --scale 1
 *   ./node_modules/.bin/tsx tools/snap.ts menu/kickoff-nextgen --size 260x562 --t 0.3 --strip 8 --dt 0.1 --scale 1    (a phone)
 *   ./node_modules/.bin/tsx tools/snap.ts menu/kickoff-retro --size 960x540 --t 0.3 --strip 6 --dt 0.1 --scale 1
 *   ./node_modules/.bin/tsx tools/snap.ts menu/kickoff-retro --size 260x562 --t 0.3 --strip 8 --dt 0.1 --scale 1    (a phone)
 *   ./node_modules/.bin/tsx tools/snap.ts menu/kickoff-home --t 0.2 --strip 10 --dt 0.0167 --scale 2    (the strike)
 *   ./node_modules/.bin/tsx tools/snap.ts menu/kickoff-home --size 480x270 --t 0.6 --strip 10 --dt 0.0333 --crop 180,60,120,110 --scale 4    (the drop and the landing)
 *   ./node_modules/.bin/tsx tools/snap.ts menu/kickoff-away --size 480x270 --t 0.3 --strip 12 --dt 0.06 --crop 300,30,180,180 --scale 2    (over the town)
 *   ./node_modules/.bin/tsx tools/snap.ts menu/kickoff-away --size 130x281 --strip 12 --dt 0.1 --scale 2    (round the sign on a phone)
 *   ./node_modules/.bin/tsx tools/snap.ts menu/kickoff-home --size 480x270 --t 1.16 --strip 10 --dt 0.06 --scale 1    (the iris)
 *   ./node_modules/.bin/tsx tools/snap.ts menu/kickoff-away --size 480x270 --t 1.5 --strip 8 --dt 0.0333 --crop 385,25,60,60 --scale 5    (onto the ring and shut)
 *   ./node_modules/.bin/tsx tools/snap.ts menu/locked --strip 8 --dt 0.05 --scale 2
 *   ./node_modules/.bin/tsx tools/snap.ts menu/reduced --strip 4 --dt 0.06 --scale 2
 *   ./node_modules/.bin/tsx tools/snap.ts menu/drag --size 480x270 --strip 8 --dt 0.1 --scale 2    (turned by hand)
 *   ./node_modules/.bin/tsx tools/snap.ts menu/spin --size 480x270 --strip 12 --dt 0.25 --scale 2    (a flick, and home)
 *   ./node_modules/.bin/tsx tools/snap.ts menu/spin --size 480x270 --t 1.6 --strip 12 --dt 0.0833 --scale 2    (the settle)
 *   ./node_modules/.bin/tsx tools/snap.ts menu/wind --size 480x270 --strip 8 --dt 0.1 --scale 2    (the wind round it)
 *   ./node_modules/.bin/tsx tools/snap.ts menu/rest--size 480x270 --t 1 --scale 2    (the locked patches, shown)
 *   ./node_modules/.bin/tsx tools/snap.ts menu/half-turn --size 480x270 --t 1 --scale 2    (CLOSEST and FURTHEST)
 *   ./node_modules/.bin/tsx tools/snap.ts menu/half-turn --size 480x270 --strip 8 --dt 0.75 --scale 1    (the rest, and home)
 */

import { Surface, type ShotContext, type ShotMap } from "~/pixel";
import { ballShowPose, ballSlotCenter, type BallSlot } from "~/art/ball";
import { menuLayout } from "~/art/layout";
import { lightingFor } from "~/art/lighting";
import { P } from "~/art/palette";
import { MenuScene, type MenuLabels } from "./menu";

const LABELS: MenuLabels = {
  home: "HOME",
  away: "AWAY",
  nextgen: "NEXT-GEN",
  retro: "RETRO",
  closest: "CLOSEST",
  furthest: "FURTHEST",
  guesswho: "GUESS WHO",
  shootout: "SHOOTOUT",
  header: "DID YOU KNOW?",
  tagline: "DAILY FOOTBALL TRIVIA",
};

/** Day 1's fact: the penalty kick. */
const FACT =
  "The penalty kick was the idea of William McCrum, a goalkeeper from County Armagh, and arrived in 1891.";

const STEP = 1 / 60;

function make(ctx: ShotContext, intro = false): MenuScene {
  const scene = new MenuScene({
    seed: ctx.seed,
    fact: FACT,
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

/** The ball close up, with its spot marked as in "menu/float". */
function closeUp(ctx: ShotContext, scene: MenuScene, room = 10): Surface {
  const m = menuLayout(ctx.w, ctx.h);
  const pad = m.ballR + room;
  const out = new Surface(pad * 2 + 1, pad * 2 + 1);
  out.blit(frame(ctx, scene), pad - m.cx, pad - m.ballCy);
  out.hline(0, pad, 4, P.gold);
  out.hline(out.w - 4, pad, 4, P.gold);
  return out;
}

/**
 * Press on HOME and drag down and to the right, a pixel a frame each way, for `t`
 * seconds; let go if `release`, and leave it for `after` seconds more.
 */
function dragged(
  ctx: ShotContext,
  t: number,
  speed: number,
  after: number,
): MenuScene {
  const scene = make(ctx);
  advance(scene, 1);
  const p = patchAt(ctx, "left");
  const n = Math.max(1, Math.round(t / STEP));
  scene.pointer({ type: "down", x: p.x, y: p.y });
  for (let i = 1; i <= n; i++) {
    scene.pointer({
      type: "move",
      x: p.x + i * speed,
      y: p.y + i * speed * 0.3,
    });
    scene.update(STEP);
  }
  if (after >= 0) {
    scene.pointer({ type: "up", x: p.x + n * speed, y: p.y + n * speed * 0.3 });
    scene.pointer({ type: "leave", x: 0, y: 0 });
    advance(scene, after);
  }
  return scene;
}

/**
 * Turn the ball by hand, slowly, until `slot` faces the viewer, hold it still and let go
 * (no flick): it comes to rest showing that patch. Then leave it for `after` seconds,
 * with the pointer on `hover` if one is given.
 */
function shown(
  ctx: ShotContext,
  slot: BallSlot,
  after: number,
  hover?: BallSlot,
): MenuScene {
  const scene = make(ctx);
  advance(scene, 1);
  const m = menuLayout(ctx.w, ctx.h);
  /** A drag across the middle, from `a` to `b` of the radius. */
  const across = (a: number, b: number) =>
    [
      { x: m.cx + Math.round(m.ballR * a), y: m.ballCy + 6 },
      { x: m.cx + Math.round(m.ballR * b), y: m.ballCy + 6 },
    ] as const;
  const drags =
    slot === "top" || slot === "bottom"
      ? [[patchAt(ctx, slot), { x: m.cx, y: m.ballCy }] as const]
      : slot === "rimLeft"
        ? [across(-0.9, 0.6)]
        : slot === "rimRight"
          ? [across(0.9, -0.6)]
          : // most of half a turn, and a little more
            [across(-0.85, 0.85), across(-0.4, 0.4)];
  for (const [from, to] of drags) {
    scene.pointer({ type: "down", x: from.x, y: from.y });
    for (let i = 1; i <= 20; i++) {
      scene.pointer({
        type: "move",
        x: from.x + ((to.x - from.x) * i) / 20,
        y: from.y + ((to.y - from.y) * i) / 20,
      });
      scene.update(STEP);
    }
    advance(scene, 1 / 3);
    scene.pointer({ type: "up", x: to.x, y: to.y });
    scene.pointer({ type: "leave", x: 0, y: 0 });
  }
  if (hover) {
    const at = ballSlotCenter(
      {
        cx: m.cx,
        cy: m.ballCy,
        r: m.ballR,
        ...ballShowPose(slot),
        hovered: null,
        pressed: null,
        chosen: null,
        t: 0,
      },
      hover,
    );
    advance(scene, Math.min(after, 0.8));
    scene.pointer({ type: "move", x: at.x, y: at.y });
    advance(scene, Math.max(0, after - 0.8));
  } else {
    advance(scene, after);
  }
  return scene;
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

  // NEXT-GEN: not struck; it spins really fast where it hangs the other way from RETRO,
  // breaks up into big square pixels and comes back together as the ball of the future,
  // stops as that, powers on and lifts, while the world turns neon.
  "menu/kickoff-nextgen": (ctx) => {
    const scene = make(ctx);
    scene.choose("nextgen");
    advance(scene, ctx.t);
    return frame(ctx, scene);
  },

  // RETRO: not struck; it spins really fast where it hangs, becomes an old leather ball in
  // the blur, stops as that and settles, while the world becomes an old photograph.
  "menu/kickoff-retro": (ctx) => {
    const scene = make(ctx);
    scene.choose("retro");
    advance(scene, ctx.t);
    return frame(ctx, scene);
  },

  // A locked patch (GUESS WHO, a quarter turn round) pressed and released at t = 0: the
  // ball says no. --strip 8 --dt 0.05.
  "menu/locked": (ctx) => {
    const scene = shown(ctx, "rimLeft", 0.5);
    const m = menuLayout(ctx.w, ctx.h);
    const p = ballSlotCenter(
      {
        cx: m.cx,
        cy: m.ballCy,
        r: m.ballR,
        ...ballShowPose("rimLeft"),
        hovered: null,
        pressed: null,
        chosen: null,
        t: 0,
      },
      "rimLeft",
    );
    scene.pointer({ type: "down", x: p.x, y: p.y, touch: true });
    scene.pointer({ type: "up", x: p.x, y: p.y, touch: true });
    advance(scene, ctx.t);
    return frame(ctx, scene);
  },

  // Held and dragged slowly right and a little down for `t` seconds (the pointer is
  // still down): --strip 8 --dt 0.1.
  // The ball at rest showing each locked patch, close up: NEXT-GEN, RETRO, half a turn
  // (CLOSEST where HOME was, FURTHEST where AWAY was), CLOSEST under the pointer, and a
  // quarter turn each way (GUESS WHO, and SHOOTOUT under the pointer).
  "menu/rest": (ctx) => {
    const cells = [
      shown(ctx, "top", ctx.t),
      shown(ctx, "bottom", ctx.t),
      shown(ctx, "backLeft", ctx.t),
      shown(ctx, "backLeft", ctx.t, "backRight"),
      shown(ctx, "rimLeft", ctx.t),
      shown(ctx, "rimRight", ctx.t, "rimRight"),
    ].map((scene) => closeUp(ctx, scene));
    const w = cells[0].w;
    const out = new Surface(w * 6 + 10, cells[0].h);
    cells.forEach((c, i) => out.blit(c, i * (w + 2), 0));
    return out;
  },

  // The whole screen after a quarter turn by hand to the right (GUESS WHO) or to the left
  // (SHOOTOUT): --t is the time since it was let go.
  "menu/guesswho": (ctx) => frame(ctx, shown(ctx, "rimLeft", ctx.t)),
  "menu/shootout": (ctx) => frame(ctx, shown(ctx, "rimRight", ctx.t)),

  // The whole screen after half a turn by hand: --t is the time since it was let go.
  "menu/half-turn": (ctx) => frame(ctx, shown(ctx, "backLeft", ctx.t)),

  "menu/drag": (ctx) =>
    closeUp(ctx, dragged(ctx, Math.max(STEP, ctx.t), 1.5, -1)),

  // Flicked right at t = 0 (a tenth of a second of a fast drag, let go while moving): it
  // spins, slows and comes home with a little settle. --strip 12 --dt 0.25.
  "menu/spin": (ctx) => closeUp(ctx, dragged(ctx, 0.1, 12, ctx.t)),

  // The wind round the ball: the same flick, with room round it for the streaks.
  // --strip 8 --dt 0.1 (and --time night).
  "menu/wind": (ctx) => closeUp(ctx, dragged(ctx, 0.1, 12, ctx.t), 22),

  // The wind of a slow drag, held: --t is how long it has been dragged.
  "menu/wind-drag": (ctx) =>
    closeUp(ctx, dragged(ctx, Math.max(STEP, ctx.t), 3, -1), 22),

  // The HOME kick-off with reduced motion: a lit patch, then ink. --strip 4 --dt 0.06.
  "menu/reduced": (ctx) => {
    const scene = make(ctx);
    scene.setReducedMotion(true);
    scene.choose("home");
    advance(scene, ctx.t);
    return frame(ctx, scene);
  },
};
