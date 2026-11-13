/**
 * Shots for the youth player's moves.
 *
 *   ./node_modules/.bin/tsx tools/snap.ts people/youth-sheet --scale 3
 *   ./node_modules/.bin/tsx tools/snap.ts people/youth-sheet-club --scale 3 --time night
 *   ./node_modules/.bin/tsx tools/snap.ts people/youth-keeper --scale 3
 *   ./node_modules/.bin/tsx tools/snap.ts people/youth-kits --scale 3
 *   ./node_modules/.bin/tsx tools/snap.ts people/youth-run --strip 8 --dt 0.1 --scale 4
 *     (every move: people/youth-idle, youth-run, youth-kick, youth-juggle,
 *      youth-celebrate, youth-dejected, youth-lift, youth-shrug, youth-slide)
 *
 * Every sheet row is one animation's frames, then the adult's frame 0 for scale. The ball
 * is drawn at `ballSpot` (a 6 x 6 stand-in in its 1 px ink ring, not the match ball), the
 * lift's spot as a gold mark on the row the trophy's foot stands on.
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
import { litKit, makeKit, type KitBase } from "./kit";
import {
  PLAYER_ANIMS,
  ballSpot,
  drawPlayer,
  handsSpot,
  type PlayerAnim,
} from "./people";

const LABEL_W = 34;

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

/** The child keeper's frames (career.ts poseChildKeeper), and his run off his line. */
const KEEPER_MOVES: readonly PlayerAnim[] = [
  "idle",
  "run",
  "celebrate",
  "dejected",
  "shrug",
];

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

/** A 6 x 6 stand-in ball on its spot (cx, cy): columns cx - 3 to cx + 2, in a 1 px ring. */
function ball(s: Surface, cx: number, cy: number, light: Lighting): void {
  const x = cx - 3;
  const y = cy - 3;
  const k = light.lit(P.ink);
  s.rect(x, y - 1, 6, 8, k);
  s.rect(x - 1, y, 8, 6, k);
  s.rect(x, y, 6, 6, light.lit(P.white));
  s.rect(x + 3, y + 3, 3, 3, light.lit(P.mist));
  s.rect(x + 2, y + 2, 2, 2, light.lit(P.slate));
}

function marks(
  s: Surface,
  anim: PlayerAnim,
  f: number,
  x: number,
  gy: number,
  light: Lighting,
): void {
  const b = ballSpot(anim, f, { youth: true });
  if (b !== null) ball(s, x + b.x, gy + b.y, light);
  const h = handsSpot(anim, f, { youth: true });
  if (h !== null) s.rect(x + h.x - 3, gy + h.y - 1, 6, 1, light.lit(P.gold));
}

function sheet(
  ctx: ShotContext,
  base: KitBase,
  anims: readonly PlayerAnim[],
): Surface {
  const light = lightingFor(ctx.sun);
  const kit = litKit(makeKit(base, { variant: 1 }), light);
  const adult = litKit(
    makeKit(base === "casual-home" ? "home" : base, { variant: 1 }),
    light,
  );
  const w = 32;
  const rowH = 44;
  const most = Math.max(...anims.map((a) => PLAYER_ANIMS[a].frames));
  const s = new Surface(LABEL_W + (most + 2) * w + 8, rowH * anims.length);
  anims.forEach((anim, row) => {
    const top = row * rowH;
    const gy = top + rowH - 4;
    grassRow(s, top, rowH, gy, light);
    const info = PLAYER_ANIMS[anim];
    label(s, anim, 2, gy - 14, light);
    label(s, `${info.frames}@${info.fps}`, 2, gy - 7, light);
    s.vline(LABEL_W, top, rowH, light.lit(P.grassDeep));
    for (let f = 0; f < info.frames; f++) {
      const x = LABEL_W + 4 + Math.floor(w / 2) + f * w;
      drawPlayer(s, anim, f, x, gy, kit, { youth: true });
      marks(s, anim, f, x, gy, light);
    }
    // the adult's frame 0, for scale
    const xa = LABEL_W + 4 + Math.floor(w / 2) + (most + 1) * w;
    s.vline(xa - Math.floor(w / 2) - 2, top, rowH, light.lit(P.grassDeep));
    drawPlayer(s, anim, 0, xa, gy, adult);
    s.hline(0, top, s.w, light.lit(P.grassDeep));
  });
  return s;
}

/** The tier 0 and 1 kits and the three looks, standing. */
function kitsSheet(ctx: ShotContext): Surface {
  const light = lightingFor(ctx.sun);
  const bases: readonly KitBase[] = [
    "casual-home",
    "casual-away",
    "casual",
    "home",
    "away",
    "rival",
    "keeper",
  ];
  const colW = 26;
  const rowH = 40;
  const s = new Surface(60 + 3 * colW, rowH * bases.length);
  bases.forEach((base, row) => {
    const top = row * rowH;
    const gy = top + rowH - 4;
    grassRow(s, top, rowH, gy, light);
    label(s, base, 2, gy - 8, light);
    for (let look = 0; look < 3; look++) {
      const kit = litKit(
        makeKit(base, { look: look as 0 | 1 | 2, variant: look + row }),
        light,
      );
      drawPlayer(s, "idle", 0, 70 + look * colW, gy, kit, { youth: true });
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
    const light = lightingFor(ctx.sun);
    const kit = litKit(makeKit("casual-home", { variant: 1 }), light);
    const s = new Surface(64, 56);
    const gy = s.h - 8;
    grassRow(s, 0, s.h, gy, light);
    const f = playFrame(ctx.t, anim);
    const x = 26;
    drawPlayer(s, anim, f, x, gy, kit, { youth: true });
    marks(s, anim, f, x, gy, light);
    return s;
  };
}

export const shots: ShotMap = {
  "people/youth-sheet": (ctx) => sheet(ctx, "casual-home", MOVES),
  "people/youth-sheet-club": (ctx) => sheet(ctx, "home", MOVES),
  "people/youth-sheet-rival": (ctx) => sheet(ctx, "rival", MOVES),
  "people/youth-keeper": (ctx) => sheet(ctx, "keeper", KEEPER_MOVES),
  "people/youth-kits": (ctx) => kitsSheet(ctx),
  ...Object.fromEntries(MOVES.map((a) => [`people/youth-${a}`, motion(a)])),
};
