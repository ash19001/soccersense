/**
 * RETRO's props (.snaps/era-art/THEME.md): the old brown leather ball, laced, and the trophy
 * of the early days, a gilt lidded cup with ear handles on a wooden plinth. Same sizes,
 * anchors and frames as today's (props.ts): the ball 6 x 6 "center" (its ink ring is
 * `drawBallRing`, unchanged), three spin frames; the trophy 18 x 24 "bottom-center", the
 * glint on frame 1. Lit by `light.lit` as the cast is. Sprites are built on first use.
 */

import {
  TRANSPARENT,
  drawSprite,
  mix,
  sprite,
  type Color,
  type Sprite,
  type Surface,
} from "~/pixel";
import type { Lighting } from "../lighting";
import { P } from "../palette";

// The leather ball: w lit, m leather, s shade, d the lace lit, e the lace in shade. The lace
// is a short chalk row across the panel (a laced slit, not a cross), rolling to the right
// into the shade and coming round again from the left.
const BALL_ART = `
.wwwm.
wwwwmm
wdddms
wwwmms
wmmmss
.msss.

.wwwm.
wwwwmm
wwwees
wwwmms
wmmmss
.msss.

.wwwm.
wwwwmm
ddwmms
wwwmms
wmmmss
.msss.
`;

// The cup, gilt (the cups of the day were gilded, and gold holds over the chalk and brick
// crowd at the lift): k ink, L gilt lit, g gilt, d gilt shade, b plinth, W plinth's lit
// edge, w the glint (frame 1 only).
const TROPHY_ROWS = [
  "........kk........",
  ".......kLgk.......",
  "........kk........",
  ".....kkkkkkkk.....",
  "....kLLLgggggk....",
  "...kkkkkkkkkkkk...",
  "...kLLLggggggdk...",
  ".kkkLLLggggggdkkk.",
  "kk.kLLLggggggdk.kk",
  "k..kLLLggggggdk..k",
  "kk.kLLLggggggdk.kk",
  ".kkkLLggggggddkkk.",
  "...kkLLggggddkk...",
  "....kkLLgggdkk....",
  "......kLggdk......",
  ".......kgdk.......",
  ".......kLdk.......",
  "......kLggdk......",
  ".....kLLggddk.....",
  "...kkkkkkkkkkkk...",
  "..kWWWWWWWWWWWWk..",
  "..kbbbbbbbbbbbbk..",
  "..kbbbbbbbbbbbbk..",
  "..kkkkkkkkkkkkkk..",
];

function trophyArt(): string {
  const glint = TROPHY_ROWS.map((r, y) => {
    if (y === 7 || y === 9) return r.slice(0, 5) + "w" + r.slice(6);
    if (y === 8) return r.slice(0, 4) + "www" + r.slice(7);
    if (y === 4) return r.slice(0, 6) + "w" + r.slice(7);
    return r;
  });
  for (const r of TROPHY_ROWS) {
    if (r.length !== 18) throw new Error(`retro trophy: row "${r}" not 18`);
  }
  return `${TROPHY_ROWS.join("\n")}\n\n${glint.join("\n")}`;
}

/** The leather's lit tone, as the promotion's close-up ball's (career-fx-retro.ts). */
const LEATHER = mix(P.retro, P.wood, 0.45);
/** The lace where it turns into the shade. */
const LACE_SHADE = mix(P.chalk, P.wood, 0.35);

let ball: Sprite | undefined;
let trophy: Sprite | undefined;

const ballColors: Color[] = new Array<Color>(5).fill(TRANSPARENT);
const trophyColors: Color[] = new Array<Color>(7).fill(TRANSPARENT);
const CENTER = { anchor: "center" } as const;
const BOTTOM = { anchor: "bottom-center" } as const;

/** The old leather ball, 6 x 6 centred on (x, y); `frame` 0 to 2 is the spin. */
export function drawRetroBall(
  s: Surface,
  x: number,
  y: number,
  frame: number,
  light: Lighting,
  gold: boolean,
): void {
  const l = light.lit;
  const c = ballColors;
  if (gold) {
    // the worldie: the same brown leather, gilded where the light catches it (the lit
    // face and the lace), so it stays his old ball and only the trail is all gold
    c[0] = l(P.gold);
    c[1] = l(P.wood);
    c[2] = l(P.woodDark);
    c[3] = l(P.goldLight);
    c[4] = l(P.goldDark);
  } else {
    // the close-up's leather (career-fx-retro.ts): its leather, its shade, its deep
    c[0] = l(LEATHER);
    c[1] = l(P.wood);
    c[2] = l(P.woodDark);
    c[3] = l(P.chalk);
    c[4] = l(LACE_SHADE);
  }
  ball ??= sprite(BALL_ART, "wmsde");
  drawSprite(s, ball, frame, x, y, c, CENTER);
}

/** The cup of the early days, 18 x 24 standing on (x, y), as `drawTrophy`. */
export function drawRetroTrophy(
  s: Surface,
  x: number,
  y: number,
  light: Lighting,
  glint: boolean,
): void {
  const l = light.lit;
  trophyColors[0] = l(P.ink);
  trophyColors[1] = l(P.goldLight);
  trophyColors[2] = l(P.gold);
  trophyColors[3] = l(P.goldDark);
  trophyColors[4] = l(P.woodDark);
  trophyColors[5] = P.white;
  trophyColors[6] = l(P.wood);
  trophy ??= sprite(trophyArt(), "kLgdbwW");
  drawSprite(s, trophy, glint ? 1 : 0, x, y, trophyColors, BOTTOM);
}
