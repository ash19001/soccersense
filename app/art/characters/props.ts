/**
 * Small props: the career match ball 6 x 6 with its 2 px ink ring (a physical thing:
 * DECISIONS.md 2), the trophy 18 x 24 and the dust puff 14 x 10 (docs/ART_BIBLE.md 5),
 * lit from the top left (`light.lit`).
 *
 * Anchors (even sizes, so the middle falls between two pixels):
 * - the ball is drawn "center" on (x, y): its fill covers columns x - 3 .. x + 2 and rows
 *   y - 3 .. y + 2 (a ball spot is its centre, `people.ts`), the ring x - 5 .. x + 4;
 * - the trophy stands "bottom-center" on (x, y): columns x - 9 .. x + 8, plinth's last row
 *   y - 1;
 * - the puff stands "bottom-center" on (x, y): columns x - 7 .. x + 6, last row y - 1.
 *
 * Sprites are built on first use (nothing at load).
 */

import {
  TRANSPARENT,
  drawSprite,
  sprite,
  type Color,
  type Sprite,
  type Surface,
} from "~/pixel";
import type { Era } from "../era";
import type { Lighting } from "../lighting";
import { P } from "../palette";
import { drawNextgenBall, drawNextgenTrophy } from "./nextgen";
import { drawRetroBall, drawRetroTrophy } from "./retro-props";

// The match ball: 6 x 6, its corners left to the ring, lit from the top left; a dark
// panel rolls across it to the right over the three frames.
// w lit, m shade, s deep shade, d panel.
const BALL_ART = `
.wwww.
wwdwwm
wdddwd
wwddwm
wwwwmm
.dmmm.

.wwww.
wwwwdm
wwwddd
dwwwdm
dwwwmm
.mmdm.

.wdww.
wwwwwm
ddwwwd
dwwwwd
wwwwmm
.mmms.
`;

// The ring round it, 10 x 10 (2 px, round): drawn under the ball, "center" on the same point.
const RING_ART = `
...kkkk...
.kkkkkkkk.
.kk....kk.
kk......kk
kk......kk
kk......kk
kk......kk
.kk....kk.
.kkkkkkkk.
...kkkk...
`;

// The trophy: a generic two-handled cup on a wooden plinth, 18 x 24.
// k ink, L gold light, g gold, d gold dark, b plinth, w the glint (frame 1 only),
// W plinth's lit edge.
const TROPHY_ART = `
..kkkkkkkkkkkkkk..
.kLLLLLLLggggggdk.
.kddddddddddddddk.
.kkLLLLggggggddkk.
kkkLLLLgggggggdkkk
kgkLLLggggggggdkdk
kgkLLLggggggggdkdk
kgkLLLggggggggdkdk
kdkkLLgggggggddkdk
.kkkLLLgggggggdkk.
...kLLLggggggddk..
....kLLgggggddk...
.....kkLgggdkk....
.......kLgdk......
.......kLgdk......
......kLLggdk.....
.......kLgdk......
.......kLgdk......
.....kkLLgggdkk...
...kkLLLggggggdkk.
..kkkkkkkkkkkkkkk.
..kWWWWWWWWWWWWWk.
..kbbbbbbbbbbbbbk.
..kkkkkkkkkkkkkkk.

..kkkkkkkkkkkkkk..
.kLLLwLLLggggggdk.
.kddddddddddddddk.
.kkLLwLggggggddkk.
kkkLwwwLggggggdkkk
kgkLLwLgggggggdkdk
kgkLLLggggggggdkdk
kgkLLLggggggggdkdk
kdkkLLgggggggddkdk
.kkkLLLgggggggdkk.
...kLLLggggggddk..
....kLLgggggddk...
.....kkLgggdkk....
.......kLgdk......
.......kLgdk......
......kLLggdk.....
.......kLgdk......
.......kLgdk......
.....kkLLgggdkk...
...kkLLLggggggdkk.
..kkkkkkkkkkkkkkk.
..kWWWWWWWWWWWWWk.
..kbbbbbbbbbbbbbk.
..kkkkkkkkkkkkkkk.
`;

// The dust puff: 14 x 10, three frames from a kick of dirt to a drifting cloud.
const PUFF_ART = `
..............
..............
..............
..............
..............
..............
....cc..cc....
...cccc.ccc...
..cccccccccc..
...cccccccc...

..............
..............
..............
....cc...cc...
..cccccccccc..
.cccccccccccc.
ccccccc.cccccc
.ccccc...cccc.
..ccc.....cc..
...c.......c..

....c.........
...cc.....c...
..........cc..
cc...c........
c....cc.....c.
............cc
..cc..........
..c......cc...
.........c....
..............
`;

let ball: Sprite | undefined;
let ring: Sprite | undefined;
let trophy: Sprite | undefined;
let puff: Sprite | undefined;

// Every trophy row is 18 wide; a template slip is caught here, not as a crooked cup.
function checkTrophy(art: string): string {
  for (const line of art.split("\n")) {
    const r = line.trim();
    if (r !== "" && r.length !== 18) {
      throw new Error(`trophy: row "${r}" is ${r.length} wide`);
    }
  }
  return art;
}

const ballColors: Color[] = [
  TRANSPARENT,
  TRANSPARENT,
  TRANSPARENT,
  TRANSPARENT,
];
const CENTER = { anchor: "center" } as const;

/**
 * The match ball, 6 x 6, centred on (x, y): columns x - 3 .. x + 2, rows y - 3 .. y + 2.
 * `frame` is the spin (3 frames; pass a running counter). `gold` draws it in gold tones,
 * for the best shot's trail. Its ink ring is `drawBallRing`.
 */
export function drawMatchBall(
  s: Surface,
  x: number,
  y: number,
  frame: number,
  light: Lighting,
  opts?: { gold?: boolean; era?: Era },
): void {
  const l = light.lit;
  const c = ballColors;
  if (opts?.era === "retro") {
    drawRetroBall(s, x, y, spin(frame), light, opts.gold === true);
    return;
  }
  if (opts?.era === "nextgen") {
    drawNextgenBall(s, x, y, spin(frame), light, opts.gold === true);
    return;
  }
  if (opts?.gold === true) {
    c[0] = l(P.goldLight);
    c[1] = l(P.gold);
    c[2] = l(P.goldDark);
    c[3] = l(P.goldDark);
  } else {
    c[0] = l(P.white);
    c[1] = l(P.mist);
    c[2] = l(P.steel);
    c[3] = l(P.slate);
  }
  ball ??= sprite(BALL_ART, "wmsd");
  drawSprite(s, ball, spin(frame), x, y, c, CENTER);
}

export const BALL_FRAMES = 3;

function spin(frame: number): number {
  const f = Math.floor(frame);
  return Number.isFinite(f) ? ((f % 3) + 3) % 3 : 0;
}

const ringColors: Color[] = [TRANSPARENT];

/**
 * The ball's ink outline (art bible section 4), drawn before the ball on the same centre:
 * a round 2 px ring round the 6 x 6 ball (10 x 10: x - 5 .. x + 4).
 */
export function drawBallRing(
  s: Surface,
  x: number,
  y: number,
  ink: Color,
): void {
  ringColors[0] = ink;
  ring ??= sprite(RING_ART, "k");
  drawSprite(s, ring, 0, x, y, ringColors, CENTER);
}

const trophyColors: Color[] = new Array<Color>(7).fill(TRANSPARENT);

/**
 * The trophy, 18 x 24, standing on (x, y): its plinth's bottom row is y - 1 and it covers
 * columns x - 9 .. x + 8. `glint` adds a flash of light on the bowl.
 */
export function drawTrophy(
  s: Surface,
  x: number,
  y: number,
  light: Lighting,
  glint?: boolean,
  era?: Era,
): void {
  if (era === "retro") {
    drawRetroTrophy(s, x, y, light, glint === true);
    return;
  }
  if (era === "nextgen") {
    drawNextgenTrophy(s, x, y, light, glint === true);
    return;
  }
  const l = light.lit;
  trophyColors[0] = l(P.ink);
  trophyColors[1] = l(P.goldLight);
  trophyColors[2] = l(P.gold);
  trophyColors[3] = l(P.goldDark);
  trophyColors[4] = l(P.woodDark);
  trophyColors[5] = P.white;
  trophyColors[6] = l(P.wood);
  trophy ??= sprite(checkTrophy(TROPHY_ART), "kLgdbwW");
  drawSprite(s, trophy, glint === true ? 1 : 0, x, y, trophyColors, {
    anchor: "bottom-center",
  });
}

const puffColors: Color[] = [TRANSPARENT];

/**
 * A dust puff (3 frames, about 14 x 10) standing on the ground point (x, y), in one
 * colour.
 */
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
  puff ??= sprite(PUFF_ART, "c");
  drawSprite(s, puff, f, x, y, puffColors, {
    anchor: "bottom-center",
  });
}
