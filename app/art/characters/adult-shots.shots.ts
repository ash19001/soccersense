/**
 * Shots for the adult footballer's shots.
 *
 *   ./node_modules/.bin/tsx tools/snap.ts people/shots --scale 3
 *     (every shot, frame by frame, the ball at its spots)
 *   ./node_modules/.bin/tsx tools/snap.ts people/trivela --strip 9 --dt 0.1 --scale 4
 *     (every shot: people/tapin, toepoke, trivela, chip, power, finesse, bicycle)
 *   ./node_modules/.bin/tsx tools/snap.ts people/shots-kits --scale 3 --time all
 *     (the strike frames in four kits, lit by the time of day)
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
import { ADULT_SHOT_BALL, SHOT_POSES, paintPose } from "./adult-shots";
import { figure } from "./figure";
import { kitColors, litKit, makeKit, type Kit } from "./kit";
import {
  PLAYER_ANIMS,
  STRIKE_FRAME,
  drawPlayer,
  playerCell,
  type ShotAnim,
} from "./people";

const DAY = lightingFor({ elevation: 45, morning: false });

const SHOTS: readonly Exclude<ShotAnim, "kick">[] = [
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
// centres it).
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

const sprites = new Map<string, ReturnType<typeof figure>>();
function rig(anim: Exclude<ShotAnim, "kick">): ReturnType<typeof figure> {
  let sp = sprites.get(anim);
  if (sp === undefined) {
    const big = anim === "bicycle";
    const w = big ? 48 : 32;
    const h = big ? 56 : 40;
    const art = SHOT_POSES[anim].map((p) => paintPose(p, w, h)).join("\n\n");
    sp = figure(art, w, h, `rig ${anim}`);
    sprites.set(anim, sp);
  }
  return sp;
}

const BOTTOM = { anchor: "bottom-center" as const, flipX: false };

/** Every shot, frame by frame, with the ball at its spots. */
function sheet(ctx: ShotContext): Surface {
  const light = lightingFor(ctx.sun);
  const kit = litKit(makeKit("home"), light);
  const step = 44;
  const rowsH = SHOTS.map((a) => (a === "bicycle" ? 64 : 48) + 10);
  const s = new Surface(
    40 + 8 * (shotStep("bicycle") + 4),
    rowsH.reduce((a, b) => a + b, 0),
  );
  s.clear(light.lit(P.grass));
  let top = 0;
  SHOTS.forEach((anim, i) => {
    const big = anim === "bicycle";
    const rowH = rowsH[i];
    const st = big ? shotStep("bicycle") : step;
    const gy = top + rowH - 6;
    s.rect(0, gy, s.w, 2, light.lit(P.grassDark));
    label(s, anim, 2, top + 4);
    const info = PLAYER_ANIMS[anim];
    label(s, `${info.frames}@${info.fps}`, 2, top + 11);
    label(s, `S${STRIKE_FRAME[anim]}`, 2, top + 18);
    for (let f = 0; f < info.frames; f++) {
      const x = 40 + Math.floor(st / 2) + f * st;
      if (SHOT_POSES[anim].length > f)
        drawSprite(s, rig(anim), f, x, gy, kitColors(kit), BOTTOM);
      const b = ADULT_SHOT_BALL[anim]?.[f] ?? null;
      if (b !== null) ball(s, x + b.x, gy + b.y, light);
    }
    top += rowH;
    s.hline(0, top - 1, s.w, light.lit(P.grassDeep));
  });
  return s;
}

function shotStep(anim: ShotAnim): number {
  return playerCell(anim).cellW + 8;
}

/** One shot played over ctx.t through `drawPlayer` (the real dispatch, people.ts). */
function motion(anim: Exclude<ShotAnim, "kick">) {
  return (ctx: ShotContext): Surface => {
    const big = anim === "bicycle";
    const s = new Surface(big ? 140 : 120, big ? 80 : 60);
    const gy = s.h - 8;
    s.clear(P.grass);
    s.rect(0, gy, s.w, s.h - gy, P.grassDark);
    const info = PLAYER_ANIMS[anim];
    const tick = Math.floor(ctx.t * info.fps + 1e-6) % (info.frames + 3);
    const f = Math.min(tick, info.frames - 1);
    const x = big ? 56 : 40;
    drawPlayer(s, anim, f, x, gy, makeKit("home"));
    const strike = STRIKE_FRAME[anim];
    const spots = ADULT_SHOT_BALL[anim];
    const b = spots?.[f] ?? null;
    if (b !== null && tick <= strike) ball(s, x + b.x, gy + b.y, DAY);
    else if (tick > strike) {
      const st = spots?.[strike] ?? null;
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
const FLIGHT: Record<
  Exclude<ShotAnim, "kick">,
  readonly [number, number, number]
> = {
  tapin: [8, 0, 0],
  toepoke: [12, 0, 0],
  trivela: [14, -4, 0.4],
  chip: [8, -10, 2],
  power: [20, -2, 0],
  finesse: [12, -4, 0.6],
  bicycle: [16, 4, 0],
};

/** The strike frames in four kits (home, away, rival, referee), lit by the time of day. */
function kits(ctx: ShotContext): Surface {
  const light = lightingFor(ctx.sun);
  const bases = ["home", "away", "rival", "national-home"] as const;
  const s = new Surface(6 * 44 + 8, bases.length * 60);
  s.clear(light.lit(P.grass));
  bases.forEach((base, row) => {
    const gy = row * 60 + 54;
    s.rect(0, gy, s.w, 2, light.lit(P.grassDark));
    const kit: Kit = litKit(
      makeKit(base, { look: (row % 3) as 0 | 1 | 2 }),
      light,
    );
    SHOTS.slice(0, 6).forEach((anim, i) => {
      const x = 26 + i * 44;
      const f = STRIKE_FRAME[anim];
      if (SHOT_POSES[anim].length > f)
        drawSprite(s, rig(anim), f, x, gy, kitColors(kit), BOTTOM);
      const b = ADULT_SHOT_BALL[anim]?.[f] ?? null;
      if (b !== null) ball(s, x + b.x, gy + b.y, light);
    });
  });
  return s;
}

export const shots: ShotMap = {
  "people/shots": sheet,
  "people/shots-kits": kits,
  "people/tapin": motion("tapin"),
  "people/toepoke": motion("toepoke"),
  "people/trivela": motion("trivela"),
  "people/chip": motion("chip"),
  "people/power": motion("power"),
  "people/finesse": motion("finesse"),
  "people/bicycle": motion("bicycle"),
};
