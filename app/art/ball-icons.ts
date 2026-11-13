/**
 * The menu ball's 19 one-colour pictures (`ball.ts` draws them on its patches): the extra
 * pixels go into the shapes (a stadium's bowl with its pennants and the pitch's markings, a
 * swept-wing aeroplane, a modern boot with its speed lines and an old high-laced one,
 * padlocks with a real shackle and keyhole, a
 * pin with its hole, a globe's meridians, a shirt's collar and its 7, a goal's net and the
 * ball on the spot). Strokes are 2 px where the picture needs its weight.
 *
 * Built on first use: `ballIcons()`.
 */

import { sprite, type Sprite } from "~/pixel";

export interface BallIcons {
  home: Sprite;
  away: Sprite;
  homeBig: Sprite;
  awayBig: Sprite;
  lock: Sprite;
  lockMid: Sprite;
  lockSmall: Sprite;
  nextgen: Sprite;
  retro: Sprite;
  pin: Sprite;
  globe: Sprite;
  shirt: Sprite;
  goal: Sprite;
  nextgenSmall: Sprite;
  retroSmall: Sprite;
  pinSmall: Sprite;
  globeSmall: Sprite;
  shirtSmall: Sprite;
  goalSmall: Sprite;
}

const W = "w";

/**
 * HOME: a stadium (the product owner, 2026-11-13: a stadium, not a house), the bowl from
 * above and in front. Its rim is an oval with the pitch inside and a gap all round it; under
 * the rim's front edge, a line of gap, then the bowl's outer wall. On this small one a
 * single pennant flies from the far rim (three were too crowded at this size, and read as a
 * crown) and the pitch is plain.
 */
const HOME = `
........wwww......
........wwwwww....
........wwww......
........w.........
........w.........
....wwwwwwwwww....
.wwwwwwwwwwwwwwww.
wwww..........wwww
www..wwwwwwww..www
www.wwwwwwwwww.www
www..wwwwwwww..www
.wwww........wwww.
w..wwwwwwwwwwww..w
ww..............ww
wwwwwwwwwwwwwwwwww
wwwwwwwwwwwwwwwwww
.wwwwwwwwwwwwwwww.
....wwwwwwwwww....
`;

/** The big HOME: the same stadium with three pennants, and the halfway line through the centre circle. */
const HOME_BIG = `
............www...........
............wwwww.........
.....www....www.....www...
.....wwwww..w.......wwwww.
.....www....w.......www...
.....w......w.......w.....
.....w......w.......w.....
.....w..wwwwwwwwww..w.....
....wwwwwwwwwwwwwwwwww....
..wwww..............wwww..
.www...wwwww..wwwww...www.
www...wwwww....wwwww...www
ww...wwwww.w..w.wwwww...ww
ww...wwwww.w..w.wwwww...ww
www..wwwwww....wwwwww..www
.www..wwwwww..wwwwww..www.
w.wwww..............wwww.w
ww..wwwwwwwwwwwwwwwwww..ww
wwww....wwwwwwwwww....wwww
wwwwwwww..........wwwwwwww
wwwwwwwwwwwwwwwwwwwwwwwwww
wwwwwwwwwwwwwwwwwwwwwwwwww
.wwwwwwwwwwwwwwwwwwwwwwww.
..wwwwwwwwwwwwwwwwwwwwww..
....wwwwwwwwwwwwwwwwww....
........wwwwwwwwww........
`;

const AWAY = `
...............ww.
..............wwww
.............wwwww
............wwwww.
...........wwwww..
..........wwwww...
..wwwwwwwwwwwww...
...wwwwwwwwwww....
........wwwwww....
.......wwwwwww....
......wwwwwwww....
.....wwwww.www....
..wwwwwwww.www....
...wwwww...www....
....www....www....
....www.....ww....
....ww............
....w.............
`;

const AWAY_BIG = `
.......................ww.
......................wwww
.....................wwwww
....................wwwww.
...................wwwww..
..................wwwww...
.................wwwww....
................wwwww.....
..wwwwwwwwwwwwwwwwwww.....
...wwwwwwwwwwwwwwwww......
......wwwwwwwwwwwww.......
..........wwwwwwww........
..........wwwwwwww........
.........wwwwwwwww........
........wwwwwwwwww........
.......wwwwww.wwww........
......wwwwww..wwww........
.....wwwwww...wwww........
..wwwwwwwww...wwww........
...wwwwwww....wwww........
.....wwww.....wwww........
.....www.......www........
......ww.......ww.........
......ww........w.........
......w...................
..........................
`;

const LOCK = `
......wwwwww......
....wwwwwwwwww....
...www......www...
...ww........ww...
...ww........ww...
...ww........ww...
...ww........ww...
...ww........ww...
wwwwwwwwwwwwwwwwww
wwwwwwwwwwwwwwwwww
wwwwwwwwwwwwwwwwww
wwwwwww....wwwwwww
wwwwwww....wwwwwww
wwwwwwww..wwwwwwww
wwwwwwww..wwwwwwww
wwwwwwwwwwwwwwwwww
wwwwwwwwwwwwwwwwww
wwwwwwwwwwwwwwwwww
`;

const LOCK_MID = `
....wwwwww....
...wwwwwwww...
..www....www..
..ww......ww..
..ww......ww..
..ww......ww..
wwwwwwwwwwwwww
wwwwwwwwwwwwww
wwwwww..wwwwww
wwwwww..wwwwww
wwwwww..wwwwww
wwwwww..wwwwww
wwwwwwwwwwwwww
wwwwwwwwwwwwww
`;

const LOCK_SMALL = `
...wwww...
..wwwwww..
..ww..ww..
..ww..ww..
wwwwwwwwww
wwwwwwwwww
wwww..wwww
wwww..wwww
wwwwwwwwww
wwwwwwwwww
`;

/**
 * NEXT-GEN: a modern boot, low and sleek, its toe pointing on (to the right, the future),
 * with speed lines behind it (the product owner, 2026-11-13: football pictures, not a
 * fast-forward).
 */
const NEXTGEN = `
................
................
................
....ww..........
....www.ww......
ww..wwwwwwww....
....wwwwwwwwww..
www.wwwwwwwwwww.
....wwwwwwwwwwww
ww..wwwwwwwwwwww
....wwwwwwwwwwww
.....ww..ww..ww.
................
................
`;

/**
 * RETRO: an old leather boot, laced high over the ankle, on bar studs, its toe pointing
 * back (to the left, the past).
 */
const RETRO = `
................
...........wwww.
...........wwww.
..........w.www.
...........wwww.
..........w.www.
.........w.wwww.
......wwwwwwwww.
...wwwwwwwwwwww.
.wwwwwwwwwwwwww.
wwwwwwwwwwwwwwww
wwwwwwwwwwwwwwww
.ww..ww..ww..ww.
................
`;

/** The small NEXT-GEN: the boot alone, long and low (speed lines leave it too short to read). */
const NEXTGEN_SMALL = `
............
............
............
.ww.........
.www.ww.....
.wwwwwwww...
.wwwwwwwwww.
.wwwwwwwwwww
.wwwwwwwwwww
..ww..ww..ww
`;

const RETRO_SMALL = `
.......wwww.
.......wwww.
......w.www.
.......wwww.
.....w.wwww.
...wwwwwwww.
.wwwwwwwwww.
wwwwwwwwwwww
wwwwwwwwwwww
.ww..ww..ww.
`;

const PIN = `
....wwwwww....
..wwwwwwwwww..
.wwwwwwwwwwww.
.wwwww..wwwww.
wwwww....wwwww
wwwww....wwwww
wwwww....wwwww
wwwww....wwwww
.wwwww..wwwww.
.wwwwwwwwwwww.
..wwwwwwwwww..
...wwwwwwww...
....wwwwww....
.....wwww.....
......ww......
......ww......
`;

const PIN_SMALL = `
..wwwwww..
.wwwwwwww.
wwww..wwww
wwww..wwww
wwwwwwwwww
.wwwwwwww.
..wwwwww..
...wwww...
....ww....
....ww....
`;

const GLOBE = `
......wwwwww......
...wwwwwwwwwwww...
..www..wwww..www..
.ww...w.ww.w...ww.
.ww..w..ww..w..ww.
ww...w..ww..w...ww
wwwwwwwwwwwwwwwwww
wwwwwwwwwwwwwwwwww
ww...w..ww..w...ww
.ww..w..ww..w..ww.
.ww...w.ww.w...ww.
..www..wwww..www..
...wwwwwwwwwwww...
......wwwwww......
`;

const GLOBE_SMALL = `
..wwwwww..
.ww.ww.ww.
ww..ww..ww
ww..ww..ww
wwwwwwwwww
wwwwwwwwww
ww..ww..ww
ww..ww..ww
.ww.ww.ww.
..wwwwww..
`;

const SHIRT = `
..wwwwww..wwwwww..
.wwwwwwwwwwwwwwww.
wwwwwwwwwwwwwwwwww
wwwwww......wwwwww
wwwwww......wwwwww
..wwwwwwww..wwww..
..wwwwwwww..wwww..
..wwwwwww..wwwww..
..wwwwwww..wwwww..
..wwwwww..wwwwww..
..wwwwww..wwwwww..
..wwwwww..wwwwww..
..wwwwww..wwwwww..
..wwwwwwwwwwwwww..
..wwwwwwwwwwwwww..
..wwwwwwwwwwwwww..
`;

const SHIRT_SMALL = `
www....www
wwwwwwwwww
wwwwwwwwww
..wwwwww..
..ww..ww..
..ww..ww..
..ww..ww..
..wwwwww..
..wwwwww..
..wwwwww..
`;

/** The goal: a 2 px frame, a diamond net 3 px apart, and the ball on the spot. */
function goalArt(): string {
  const rows: string[] = [];
  for (let y = 0; y < 16; y++) {
    let r = "";
    for (let x = 0; x < 18; x++) {
      const frame = y < 2 || ((x < 2 || x > 15) && y < 10);
      const net =
        y >= 2 &&
        y < 8 &&
        x >= 2 &&
        x <= 15 &&
        ((x + y) % 3 === 0 || (x - y + 30) % 3 === 0);
      r += frame || net ? W : ".";
    }
    rows.push(r);
  }
  const ball = [
    ".......wwww.......",
    "......wwwwww......",
    "......ww..ww......",
    "......ww..ww......",
    "......wwwwww......",
    ".......wwww.......",
  ];
  for (let i = 0; i < ball.length; i++) rows[10 + i] = ball[i];
  return "\n" + rows.join("\n") + "\n";
}

const GOAL_SMALL = `
wwwwwwwwww
wwwwwwwwww
ww.w.w.www
www.w.w.ww
ww.w.w.www
ww......ww
ww......ww
....ww....
...wwww...
....ww....
`;

let made: BallIcons | undefined;

/** The ball's 19 pictures, built on first use. */
export function ballIcons(): BallIcons {
  return (made ??= {
    home: sprite(HOME, W),
    away: sprite(AWAY, W),
    homeBig: sprite(HOME_BIG, W),
    awayBig: sprite(AWAY_BIG, W),
    lock: sprite(LOCK, W),
    lockMid: sprite(LOCK_MID, W),
    lockSmall: sprite(LOCK_SMALL, W),
    nextgen: sprite(NEXTGEN, W),
    retro: sprite(RETRO, W),
    pin: sprite(PIN, W),
    globe: sprite(GLOBE, W),
    shirt: sprite(SHIRT, W),
    goal: sprite(goalArt(), W),
    nextgenSmall: sprite(NEXTGEN_SMALL, W),
    retroSmall: sprite(RETRO_SMALL, W),
    pinSmall: sprite(PIN_SMALL, W),
    globeSmall: sprite(GLOBE_SMALL, W),
    shirtSmall: sprite(SHIRT_SMALL, W),
    goalSmall: sprite(GOAL_SMALL, W),
  });
}
