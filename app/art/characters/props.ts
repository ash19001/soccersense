/**
 * Small props: the career match ball, the trophy and a dust puff.
 */

import {
  TRANSPARENT,
  drawSprite,
  sprite,
  type Color,
  type Surface,
} from "~/pixel";
import type { Lighting } from "../lighting";
import { P } from "../palette";

// The match ball: 3 x 3, lit from the top left, a dark panel that turns round it.
// w lit, m shade, d panel.
const BALL = sprite(
  `
mwm
wdw
mwd

mwd
wwm
dmm

mdm
wwd
mmm
`,
  "wmd",
);

const ballColors: Color[] = [TRANSPARENT, TRANSPARENT, TRANSPARENT];

/**
 * The match ball, 3 x 3, centred on (x, y). `frame` is the spin (3 frames; pass a running
 * counter). `gold` draws it in gold tones, for the best shot's trail.
 */
export function drawMatchBall(
  s: Surface,
  x: number,
  y: number,
  frame: number,
  light: Lighting,
  opts?: { gold?: boolean },
): void {
  const l = light.lit;
  if (opts?.gold === true) {
    ballColors[0] = l(P.goldLight);
    ballColors[1] = l(P.gold);
    ballColors[2] = l(P.goldDark);
  } else {
    ballColors[0] = l(P.white);
    ballColors[1] = l(P.mist);
    ballColors[2] = l(P.slate);
  }
  drawSprite(s, BALL, frame, x, y, ballColors, { anchor: "center" });
}

export const BALL_FRAMES = 3;

// The trophy: a generic two-handled gold cup on a dark plinth, 9 x 12.
// k ink, L gold light, g gold, d gold dark, b plinth, w the glint (frame 1 only).
const TROPHY = sprite(
  `
.kkkkkkk.
.kLLggdk.
kkLgggdkk
gkLgggdkg
dkLgggdkd
kkkLgddkk
...kgdk..
....kd...
...kgdk..
..kLggdk.
.kbbbbbbk
.kkkkkkk.

.kkkkkkk.
.kLwLgdk.
kkwwwgdkk
gkLwggdkg
dkLgggdkd
kkkLgddkk
...kgdk..
....kd...
...kgdk..
..kLggdk.
.kbbbbbbk
.kkkkkkk.
`,
  "kLgdbw",
);

const trophyColors: Color[] = new Array<Color>(6).fill(TRANSPARENT);

/**
 * The trophy, 9 x 12, standing on (x, y): its plinth's bottom row is y - 1 and its middle
 * column is x. `glint` adds a flash of light on the bowl.
 */
export function drawTrophy(
  s: Surface,
  x: number,
  y: number,
  light: Lighting,
  glint?: boolean,
): void {
  const l = light.lit;
  trophyColors[0] = l(P.ink);
  trophyColors[1] = l(P.goldLight);
  trophyColors[2] = l(P.gold);
  trophyColors[3] = l(P.goldDark);
  trophyColors[4] = l(P.woodDark);
  trophyColors[5] = P.white;
  drawSprite(s, TROPHY, glint === true ? 1 : 0, x, y, trophyColors, {
    anchor: "bottom-center",
  });
}

// The dust puff: 7 x 5, three frames from a kick of dirt to a drifting cloud.
const PUFF = sprite(
  `
.......
.......
.......
..c.c..
.ccccc.

.......
..c.c..
.ccccc.
ccc.ccc
.c...c.

..c....
.....c.
c..c...
......c
.c...c.
`,
  "c",
);

const puffColors: Color[] = [TRANSPARENT];

/** A dust puff (3 frames, about 7 x 5) standing on the ground point (x, y), in one colour. */
export function drawPuff(
  s: Surface,
  x: number,
  y: number,
  frame: number,
  color: Color,
): void {
  const f = Math.floor(frame);
  if (!(f >= 0 && f < 3)) return;
  puffColors[0] = color;
  drawSprite(s, PUFF, f, x, y, puffColors, { anchor: "bottom-center" });
}
