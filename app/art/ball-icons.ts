/**
 * The menu ball's 19 one-colour pictures (`ball.ts` draws them on its patches): the extra
 * pixels go into the shapes (a pitched roof with a chimney and a
 * round gable window, a swept-wing aeroplane, padlocks with a real shackle and keyhole, a
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
  forward: Sprite;
  rewind: Sprite;
  pin: Sprite;
  globe: Sprite;
  shirt: Sprite;
  goal: Sprite;
  forwardSmall: Sprite;
  rewindSmall: Sprite;
  pinSmall: Sprite;
  globeSmall: Sprite;
  shirtSmall: Sprite;
  goalSmall: Sprite;
}

const W = "w";

/** The same art, mirrored left to right (rewind from fast-forward). */
function mirror(art: string): string {
  return art
    .split("\n")
    .map((row) => Array.from(row).reverse().join(""))
    .join("\n");
}

const HOME = `
........ww........
.......wwww.ww....
......wwwwwwww....
.....wwwwwwwww....
....wwwwwwwwww....
...wwwww..wwwww...
..wwwwww..wwwwww..
.wwwwwwwwwwwwwwww.
wwwwwwwwwwwwwwwwww
..wwwwwwwwwwwwww..
..wwwwwwwwwwwwww..
..wwwwwwwwwwwwww..
..wwwww....wwwww..
..wwwww....wwwww..
..wwwww....wwwww..
..wwwww....wwwww..
..wwwww....wwwww..
..wwwww....wwwww..
`;

const HOME_BIG = `
............ww............
...........wwww...........
..........wwwwww..www.....
.........wwwwwwww.www.....
........wwwwwwwwwwwww.....
.......wwwwwwwwwwwwww.....
......wwwwwwwwwwwwwww.....
.....wwwwwwwwwwwwwwww.....
....wwwwwwww..wwwwwwww....
...wwwwwwwww..wwwwwwwww...
..wwwwwwwwwwwwwwwwwwwwww..
.wwwwwwwwwwwwwwwwwwwwwwww.
wwwwwwwwwwwwwwwwwwwwwwwwww
...wwwwwwwwwwwwwwwwwwww...
...wwwwwwwwwwwwwwwwwwww...
...wwwwwwwwwwwwwwwwwwww...
...ww...wwwwwwwwww...ww...
...ww...www....www...ww...
...ww...www....www...ww...
...wwwwwwww....wwwwwwww...
...wwwwwwww....wwwwwwww...
...wwwwwwww..w.wwwwwwww...
...wwwwwwww....wwwwwwww...
...wwwwwwww....wwwwwwww...
...wwwwwwww....wwwwwwww...
...wwwwwwww....wwwwwwww...
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

const FORWARD = `
w.......w.......
ww......ww......
www.....www.....
wwww....wwww....
wwwww...wwwww...
wwwwww..wwwwww..
wwwwwwwwwwwwwww.
wwwwwwwwwwwwwww.
wwwwww..wwwwww..
wwwww...wwwww...
wwww....wwww....
www.....www.....
ww......ww......
w.......w.......
`;

const FORWARD_SMALL = `
w.....w.....
ww....ww....
www...www...
wwww..wwww..
wwwwwwwwwww.
wwwwwwwwwww.
wwww..wwww..
www...www...
ww....ww....
w.....w.....
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
    forward: sprite(FORWARD, W),
    rewind: sprite(mirror(FORWARD), W),
    pin: sprite(PIN, W),
    globe: sprite(GLOBE, W),
    shirt: sprite(SHIRT, W),
    goal: sprite(goalArt(), W),
    forwardSmall: sprite(FORWARD_SMALL, W),
    rewindSmall: sprite(mirror(FORWARD_SMALL), W),
    pinSmall: sprite(PIN_SMALL, W),
    globeSmall: sprite(GLOBE_SMALL, W),
    shirtSmall: sprite(SHIRT_SMALL, W),
    goalSmall: sprite(GOAL_SMALL, W),
  });
}
