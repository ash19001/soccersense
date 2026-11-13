/**
 * Shots for the youth footballer's shots.
 *
 *   ./node_modules/.bin/tsx tools/snap.ts people/youth-shots --scale 3
 *     (every shot, frame by frame: the youth with the ball at its spots, and the adult's
 *      frame below it for the style)
 *   ./node_modules/.bin/tsx tools/snap.ts people/youth-trivela --strip 9 --dt 0.1 --scale 4
 *     (every shot: people/youth-tapin, youth-toepoke, youth-trivela, youth-chip,
 *      youth-power, youth-finesse, youth-bicycle)
 *   ./node_modules/.bin/tsx tools/snap.ts people/youth-shots-kits --scale 3 --time all
 *     (the strike frames in four kits and as the child keeper's team, lit by the time)
 */

import {
  FONT_3x5,
  Surface,
  drawSprite,
  drawText,
  sprite,
  type Color,
  type ShotContext,
  type ShotMap,
} from "~/pixel";
import { lightingFor, type Lighting } from "../lighting";
import { P } from "../palette";
import { SHOT_POSES, paintPose } from "./adult-shots";
import { figure } from "./figure";
import { kitColors, litKit, makeKit, type Kit } from "./kit";
import {
  PLAYER_ANIMS,
  STRIKE_FRAME,
  drawPlayer,
  type ShotAnim,
} from "./people";
import {
  YOUTH_SHOT_BALL,
  YOUTH_SHOT_POSES,
  paintYouthPose,
} from "./youth-shots";

type Shot = Exclude<ShotAnim, "kick">;

const DAY = lightingFor({ elevation: 45, morning: false });

const SHOTS: readonly Shot[] = [
  "tapin",
  "toepoke",
  "trivela",
  "chip",
  "power",
  "finesse",
  "bicycle",
];

function label(s: Surface, text: string, x: number, y: number): void {
  drawText(s, text.toUpperCase(), x, y, P.chalk, { font: FONT_3x5 });
}

// A stand-in ball (6 x 6 in an ink ring, 8 x 8, centred on the spot as `drawMatchBall`
// centres it), as the adult's sheet draws it.
const BALL = sprite(
  `
..kkkk..
.kwwwmk.
kwwddwmk
kwddddmk
kwwddmmk
kmmmmmdk
.kmdmmk.
..kkkk..
`,
  "kwmd",
);

function ball(s: Surface, x: number, y: number, light: Lighting): void {
  const l = light.lit;
  const c: Color[] = [l(P.ink), l(P.white), l(P.mist), l(P.slate)];
  drawSprite(s, BALL, 0, x, y, c, { anchor: "center" });
}

// The rig's frames as sprites, straight from the poses (so the sheet works before the
// record is filled, and shows exactly what the record will hold).
const youthSprites = new Map<Shot, ReturnType<typeof figure>>();
function youthRig(anim: Shot): ReturnType<typeof figure> {
  let sp = youthSprites.get(anim);
  if (sp === undefined) {
    const big = anim === "bicycle";
    const w = big ? 40 : 28;
    const h = big ? 44 : 32;
    const art = YOUTH_SHOT_POSES[anim]
      .map((p) => paintYouthPose(p, w, h))
      .join("\n\n");
    sp = figure(art, w, h, `youth rig ${anim}`);
    youthSprites.set(anim, sp);
  }
  return sp;
}

const adultSprites = new Map<Shot, ReturnType<typeof figure>>();
function adultRig(anim: Shot): ReturnType<typeof figure> {
  let sp = adultSprites.get(anim);
  if (sp === undefined) {
    const big = anim === "bicycle";
    const w = big ? 48 : 32;
    const h = big ? 56 : 40;
    const art = SHOT_POSES[anim].map((p) => paintPose(p, w, h)).join("\n\n");
    sp = figure(art, w, h, `adult rig ${anim}`);
    adultSprites.set(anim, sp);
  }
  return sp;
}

const BOTTOM = { anchor: "bottom-center" as const, flipX: false };

/**
 * Every shot, a band each: the youth with the ball at its spots (top), and the adult's
 * frames (bottom) for the style.
 */
function sheet(ctx: ShotContext): Surface {
  const light = lightingFor(ctx.sun);
  const kit = litKit(makeKit("home"), light);
  const bandH = (a: Shot) => (a === "bicycle" ? 64 : 48);
  const rowsH = SHOTS.map((a) => bandH(a) * 2 + 6);
  const s = new Surface(
    40 + 8 * 56,
    rowsH.reduce((a, b) => a + b, 0),
  );
  s.clear(light.lit(P.grass));
  let top = 0;
  SHOTS.forEach((anim, i) => {
    const big = anim === "bicycle";
    const st = big ? 56 : 40;
    const b = bandH(anim);
    const g1 = top + b - 4;
    const g2 = top + 2 * b - 4;
    for (const g of [g1, g2]) s.rect(0, g, s.w, 2, light.lit(P.grassDark));
    label(s, anim, 2, top + 4);
    const info = PLAYER_ANIMS[anim];
    label(s, `${info.frames}@${info.fps}`, 2, top + 11);
    label(s, `S${STRIKE_FRAME[anim]}`, 2, top + 18);
    label(s, "ADULT", 2, g2 - 8);
    for (let f = 0; f < info.frames; f++) {
      const x = 40 + Math.floor(st / 2) + f * st;
      drawSprite(s, youthRig(anim), f, x, g1, kitColors(kit), BOTTOM);
      const sp = YOUTH_SHOT_BALL[anim][f] ?? null;
      if (sp !== null) ball(s, x + sp.x, g1 + sp.y, light);
      drawSprite(s, adultRig(anim), f, x, g2, kitColors(kit), BOTTOM);
    }
    top += rowsH[i];
    s.hline(0, top - 1, s.w, light.lit(P.grassDeep));
  });
  return s;
}

/** One shot played over ctx.t through `drawPlayer` (the real dispatch, people.ts). */
function motion(anim: Shot) {
  return (ctx: ShotContext): Surface => {
    const big = anim === "bicycle";
    const s = new Surface(big ? 120 : 100, big ? 64 : 48);
    const gy = s.h - 8;
    s.clear(P.grass);
    s.rect(0, gy, s.w, s.h - gy, P.grassDark);
    const info = PLAYER_ANIMS[anim];
    const tick = Math.floor(ctx.t * info.fps + 1e-6) % (info.frames + 3);
    const f = Math.min(tick, info.frames - 1);
    const x = big ? 50 : 34;
    drawPlayer(s, anim, f, x, gy, makeKit("home"), { youth: true });
    const strike = STRIKE_FRAME[anim];
    const spots = YOUTH_SHOT_BALL[anim];
    const b = spots[f] ?? null;
    if (b !== null && tick <= strike) ball(s, x + b.x, gy + b.y, DAY);
    else if (tick > strike) {
      const st = spots[strike] ?? null;
      const n = tick - strike;
      if (st !== null) {
        const [vx, vy, gr] = FLIGHT[anim];
        const by = Math.min(
          gy - 4,
          gy + st.y + vy * n + Math.round(gr * n * n),
        );
        ball(s, x + st.x + vx * n, by, DAY);
      }
    }
    return s;
  };
}

/** How the ball leaves each shot, per frame after the strike: [vx, vy, gravity]. */
const FLIGHT: Record<Shot, readonly [number, number, number]> = {
  tapin: [8, 0, 0],
  toepoke: [12, 0, 0],
  trivela: [14, -4, 0.4],
  chip: [8, -10, 2],
  power: [20, -2, 0],
  finesse: [12, -4, 0.6],
  bicycle: [16, 4, 0],
};

/**
 * The strike frames in four kits (home, away, rival, national), lit by the time of day,
 * and the bicycle's strike; at the end of each row the child keeper's kit (the gloves'
 * slot unused by the shots).
 */
function kits(ctx: ShotContext): Surface {
  const light = lightingFor(ctx.sun);
  const bases = ["home", "away", "rival", "national-home"] as const;
  const s = new Surface(6 * 36 + 52 + 8, bases.length * 56);
  s.clear(light.lit(P.grass));
  bases.forEach((base, row) => {
    const gy = row * 56 + 50;
    s.rect(0, gy, s.w, 2, light.lit(P.grassDark));
    const kit: Kit = litKit(
      makeKit(base, { look: (row % 3) as 0 | 1 | 2 }),
      light,
    );
    SHOTS.forEach((anim, i) => {
      const x = anim === "bicycle" ? 6 * 36 + 30 : 20 + i * 36;
      const f = STRIKE_FRAME[anim];
      drawSprite(s, youthRig(anim), f, x, gy, kitColors(kit), BOTTOM);
      const b = YOUTH_SHOT_BALL[anim][f] ?? null;
      if (b !== null) ball(s, x + b.x, gy + b.y, light);
    });
  });
  return s;
}

export const shots: ShotMap = {
  "people/youth-shots": sheet,
  "people/youth-shots-kits": kits,
  "people/youth-tapin": motion("tapin"),
  "people/youth-toepoke": motion("toepoke"),
  "people/youth-trivela": motion("trivela"),
  "people/youth-chip": motion("chip"),
  "people/youth-power": motion("power"),
  "people/youth-finesse": motion("finesse"),
  "people/youth-bicycle": motion("bicycle"),
};
