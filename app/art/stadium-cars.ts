/**
 * Cars and coaches seen from the air, pointing any way on screen.
 *
 * The picture is an aerial view, so a road or a bay that runs north on the map leans on
 * screen (towards the vanishing point above the stadium). A car is drawn along the way it
 * points on screen, from a set of HEADINGS hand-placed sprites: 0 points east (right),
 * a quarter of the set points up the screen, half points west. Only the headings from
 * east round to north (0 to 90 degrees) are drawn; the rest are those mirrored, or turned
 * round (the same outline with the windscreen at the other end, so the side towards the
 * camera stays in shade).
 *
 * A sprite is a grid of letters and a second grid of the lamps, the same size:
 *
 *   day    .  nothing            lamps  .  nothing
 *          b  body                      F  headlight, or the tail light turned round
 *          l  roof                      R  tail light, or the headlight turned round
 *          d  side in shade             H  headlight only     h  headlight turned round
 *          g  glass                     T  tail light only    t  tail light turned round
 *          k  tyre                      a  beam ahead          z  beam turned round
 *          f  glass at the front only (body when turned round)
 *          r  glass at the back only (glass when turned round)
 *
 * Coaches use the same grids with o roof, i roof highlight, s side, e stripe for the
 * body letters.
 *
 * Everything here is pure: headings are worked out from the camera (stadium-view.ts).
 */

import type { Color } from "~/pixel";
import { P } from "~/art/palette";
import type { CarLook, CoachLook, Ink } from "~/art/stadium-things";
import { projectRaw, type View } from "~/art/stadium-view";

/** How many ways a car can point on screen. */
export const HEADINGS = 24;
/** Degrees between neighbouring headings. */
export const HEADING_STEP = 360 / HEADINGS;
/** The heading pointing up the screen. */
const QUARTER = HEADINGS / 4;
const HALF = HEADINGS / 2;

/** Heading east, north (up the screen), west and south (down the screen). */
export const EAST = 0;
export const NORTH = QUARTER;
export const WEST = HALF;
export const SOUTH = QUARTER * 3;

/** The angle a heading stands for, degrees anticlockwise from east on screen. */
export function headingAngle(h: number): number {
  return (((h % HEADINGS) + HEADINGS) % HEADINGS) * HEADING_STEP;
}

/** The heading nearest a direction on screen: `dx` to the right, `dy` down. */
export function headingOf(dx: number, dy: number): number {
  if (dx === 0 && dy === 0) return EAST;
  const a = Math.atan2(-dy, dx) / ((2 * Math.PI) / HEADINGS);
  return ((Math.round(a) % HEADINGS) + HEADINGS) % HEADINGS;
}

/** The heading on screen of something at (X, V) on the ground moving by (dX, dV). */
export function groundHeading(
  view: View,
  X: number,
  V: number,
  dX: number,
  dV: number,
): number {
  const len = Math.hypot(dX, dV);
  if (len === 0) return EAST;
  const e = 0.5 / len;
  const a = projectRaw(view, X - dX * e, V - dV * e);
  const b = projectRaw(view, X + dX * e, V + dV * e);
  return headingOf(b.x - a.x, b.y - a.y);
}

/** The map's four ways: 0 east, 1 west, 2 north, 3 south, as (dX, dV). */
const MAP_DIRS: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** The heading on screen of something at (X, V) pointing one of the map's four ways. */
export function mapHeading(
  view: View,
  X: number,
  V: number,
  dir: number,
): number {
  const d = MAP_DIRS[((dir % 4) + 4) % 4];
  return groundHeading(view, X, V, d[0], d[1]);
}

interface Sprite {
  day: readonly string[];
  lamp: readonly string[];
  /** The ground point under the middle of the car, in the grid. */
  ax: number;
  ay: number;
}

function sprite(
  day: readonly string[],
  lamp: readonly string[],
  ax: number,
  ay: number,
): Sprite {
  return { day, lamp, ax, ay };
}

// ---- cars, nearest size (cls 2) --------------------------------------------------
// About 7 px long pointing east and 8 rows pointing north; the slanted ones in between.

const CAR2: readonly Sprite[] = [
  // 0: east (as the cars on Stadium Road have always been)
  sprite(
    ["bglllgb..", "bblllgb..", "ddddddd..", ".kdddk..."],
    [".........", "T......Ha", ".........", "........."],
    3,
    2,
  ),
  // 15
  sprite(
    [".......gb..", "....lllfb..", "..bgllldd..", "..brddd....", "..dd......."],
    ["...........", "........tHa", "...........", "zhT........", "..........."],
    5,
    3,
  ),
  // 30
  sprite(
    [
      "......fbb..",
      "....bbggb..",
      "...rlllfd..",
      "..bglbbd...",
      "..bbrdd....",
      "..ddd......",
    ],
    [
      "..........a",
      "........tH.",
      "...........",
      "...........",
      "..T........",
      "zh.........",
    ],
    5,
    4,
  ),
  // 45
  sprite(
    [
      "...........",
      "......bb...",
      ".....fgbb..",
      "....blggb..",
      "...blllfd..",
      "..brllbd...",
      "..bbgbd....",
      "..dbbd.....",
      "...dd......",
      "...........",
    ],
    [
      ".........a.",
      ".......tH..",
      "...........",
      "...........",
      "...........",
      "...........",
      "..T........",
      ".h.........",
      "z..........",
      "...........",
    ],
    5,
    5,
  ),
  // 60
  sprite(
    [
      "...........",
      ".....bbb...",
      ".....fgbb..",
      "....blggd..",
      "...blllb...",
      "...rllbd...",
      "..bbgrd....",
      "..dbbb.....",
      "...ddd.....",
      "...........",
    ],
    [
      "......a....",
      ".....F.F...",
      "...........",
      "...........",
      "...........",
      "...........",
      "...........",
      "...R.R.....",
      "...........",
      "....z......",
    ],
    5,
    5,
  ),
  // 75
  sprite(
    [
      ".....",
      ".bbbb",
      ".fggf",
      ".bllb",
      "bbllb",
      "bllb.",
      "rggr.",
      "bbbb.",
      "dddd.",
      ".....",
    ],
    [
      "..a..",
      ".F..F",
      ".....",
      ".....",
      ".....",
      ".....",
      ".....",
      ".....",
      "R..R.",
      ".z...",
    ],
    2,
    5,
  ),
  // 90: north
  sprite(
    [
      "....",
      "bbbb",
      "fggf",
      "bllb",
      "bllb",
      "rggr",
      "bbbb",
      "bbbb",
      "dddd",
      "....",
    ],
    [
      ".a..",
      "F..F",
      "....",
      "....",
      "....",
      "....",
      "....",
      "....",
      "R..R",
      ".z..",
    ],
    1,
    5,
  ),
];

// ---- cars, middle size (cls 1) ---------------------------------------------------

const CAR1: readonly Sprite[] = [
  // 0: east
  sprite(
    ["bllgb..", "bbbbb..", "ddddd.."],
    [".......", "T....Ha", "......."],
    2,
    2,
  ),
  // 15
  sprite(
    [".....gb..", "..rllbb..", "..bbbdd..", "..ddd...."],
    [".........", "......tHa", "zhT......", "........."],
    4,
    3,
  ),
  // 30
  sprite(
    [".....gb..", "...llbb..", "..rbbdd..", "..bdd....", "..d......"],
    ["........a", "......tH.", ".........", ".hT......", "z........"],
    4,
    3,
  ),
  // 45
  sprite(
    [
      "........",
      ".....b..",
      "....fbb.",
      "...rlgd.",
      "..bbgd..",
      "..dbd...",
      "...d....",
      "........",
    ],
    [
      ".......a",
      ".....tH.",
      "........",
      "........",
      "..T.....",
      ".h......",
      "z.......",
      "........",
    ],
    4,
    4,
  ),
  // 60
  sprite(
    [
      "......",
      "...bb.",
      "...fgb",
      "..rlgd",
      ".brgd.",
      ".dbb..",
      "..dd..",
      "......",
    ],
    [
      "....a.",
      "...FF.",
      "......",
      "......",
      "......",
      "..RR..",
      "......",
      "..z...",
    ],
    3,
    4,
  ),
  // 75
  sprite(
    ["......", "...bbb", "...fgf", "..bllb", "..rgr.", "..ddd.", "......"],
    ["....a.", "...F.F", "......", "......", "......", "..R.R.", "...z.."],
    3,
    4,
  ),
  // 90: north
  sprite(
    [".....", ".bbb.", ".fgf.", ".blb.", ".rgr.", ".ddd.", "....."],
    ["..a..", ".F.F.", ".....", ".....", ".....", ".R.R.", "..z.."],
    2,
    4,
  ),
];

// ---- cars, far (cls 0): a few pixels ---------------------------------------------

const CAR0: readonly Sprite[] = [
  sprite(["lll.", "ddd."], ["T..H", "...."], 1, 1),
  sprite(["...ll.", ".lldd.", ".dd..."], ["....F.", ".R....", "......"], 2, 2),
  sprite(
    ["....l", "..lld", "lld..", "dd..."],
    ["....F", ".....", "R....", "....."],
    2,
    2,
  ),
  sprite(["..l", ".ld", "ld.", "d.."], ["..F", "...", "R..", "..."], 1, 2),
  sprite(["..l", ".ll", "ld.", "d.."], ["..F", "...", "R..", "..."], 1, 2),
  sprite([".l", "ll", "dd"], [".F", "..", "RR"], 0, 2),
  sprite(["ll", "ll", "dd"], ["FF", "..", "RR"], 0, 2),
];

const CARS: readonly (readonly Sprite[])[] = [CAR0, CAR1, CAR2];

/** Which drawn sprite a heading uses, and whether it is mirrored and turned round. */
interface Pick {
  i: number;
  mirror: boolean;
  back: boolean;
}

const pickOut: Pick = { i: 0, mirror: false, back: false };
function pick(heading: number): Pick {
  let h = ((Math.round(heading) % HEADINGS) + HEADINGS) % HEADINGS;
  pickOut.back = h > HALF;
  if (pickOut.back) h -= HALF;
  pickOut.mirror = h > QUARTER;
  pickOut.i = pickOut.mirror ? HALF - h : h;
  return pickOut;
}

type Paint = (ch: string, back: boolean) => Color | null;

/** Draws a sprite's day pixels with `paint` choosing each letter's colour. */
function stamp(
  s: Ink,
  sp: Sprite,
  x: number,
  y: number,
  mirror: boolean,
  back: boolean,
  paint: Paint,
): void {
  for (let r = 0; r < sp.day.length; r++) {
    const row = sp.day[r];
    for (let c = 0; c < row.length; c++) {
      const ch = row.charCodeAt(c);
      if (ch === 46) continue; // "."
      const col = paint(row[c], back);
      if (col === null) continue;
      const dx = mirror ? sp.ax - c : c - sp.ax;
      s.px(x + dx, y + r - sp.ay, col);
    }
  }
}

const carPaint = (k: CarLook): Paint => {
  return (ch, back) => {
    switch (ch) {
      case "b":
        return k.b;
      case "l":
        return k.l;
      case "d":
        return k.d;
      case "g":
        return k.g;
      case "k":
        return k.k;
      case "f":
        return back ? k.b : k.g;
      case "r":
        return back ? k.g : k.b;
      default:
        return null;
    }
  };
};

/**
 * A car from above with its ground point at (x, y), pointing `heading` on screen
 * (0 east, HEADINGS / 4 up the screen).
 */
export function carSprite(
  s: Ink,
  x: number,
  y: number,
  cls: 0 | 1 | 2,
  heading: number,
  k: CarLook,
): void {
  const p = pick(heading);
  stamp(s, CARS[cls][p.i], x, y, p.mirror, p.back, carPaint(k));
}

/**
 * A car's lamps at night: headlights (and a beam ahead when it is driving and not far
 * away) and tail lights, white while it reverses (`state` 2).
 */
export function carLamps(
  s: Ink,
  x: number,
  y: number,
  cls: 0 | 1 | 2,
  heading: number,
  state: 1 | 2,
): void {
  const p = pick(heading);
  lamps(
    s,
    CARS[cls][p.i],
    x,
    y,
    p.mirror,
    p.back,
    cls > 0 && state === 1,
    state === 2,
  );
}

function lamps(
  s: Ink,
  sp: Sprite,
  x: number,
  y: number,
  mirror: boolean,
  back: boolean,
  beam: boolean,
  reversing: boolean,
): void {
  const tail = reversing ? P.white : P.ledRed;
  for (let r = 0; r < sp.lamp.length; r++) {
    const row = sp.lamp[r];
    for (let c = 0; c < row.length; c++) {
      const ch = row[c];
      if (ch === ".") continue;
      let col: Color | null = null;
      switch (ch) {
        case "F":
          col = back ? tail : P.goldLight;
          break;
        case "R":
          col = back ? P.goldLight : tail;
          break;
        case "H":
          col = back ? null : P.goldLight;
          break;
        case "h":
          col = back ? P.goldLight : null;
          break;
        case "T":
          col = back ? null : tail;
          break;
        case "t":
          col = back ? tail : null;
          break;
        case "a":
          col = !back && beam ? P.gold : null;
          break;
        case "z":
          col = back && beam ? P.gold : null;
          break;
      }
      if (col === null) continue;
      const dx = mirror ? sp.ax - c : c - sp.ax;
      s.px(x + dx, y + r - sp.ay, col);
    }
  }
}

// ---- coaches -------------------------------------------------------------------
// The east-west and north-south coaches are hand-placed; the slanted ones are sheared
// from them (a coach is a long box, so a sheared column or row is how it would be drawn
// by hand), shortened to the length it shows at that angle.

const COACH_EW: readonly Sprite[] = [
  sprite(
    ["oooooo..", "oooooo..", "eeeeee.."],
    ["........", "T......H", "........"],
    3,
    2,
  ),
  sprite(
    [
      "oiiiiiiiiio..",
      "ooogooogooo..",
      "ooooooooooo..",
      "ggggggggggg..",
      "eeeeeeeeeee..",
    ],
    [
      ".............",
      ".............",
      "T..........Ha",
      ".............",
      ".............",
    ],
    5,
    3,
  ),
  sprite(
    [
      "oiiiiiiiiiiiiiiio..",
      "ooooggoooooggoooo..",
      "ooooooooooooooooo..",
      "ooooooooooooooooo..",
      "ggggggggggggggggg..",
      "sssssssssssssssss..",
      "eeeeeeeeeeeeeeeee..",
      "...k.........k.....",
    ],
    [
      "...................",
      "...................",
      "...................",
      "T................Ha",
      "...................",
      "...................",
      "...................",
      "...................",
    ],
    8,
    4,
  ),
];

const COACH_NS: readonly Sprite[] = [
  sprite(
    ["..", "oo", "oo", "oo", "oo", "ee"],
    ["FF", "..", "..", "..", "..", "RR"],
    0,
    4,
  ),
  sprite(
    [
      "....",
      "ffff",
      "iooo",
      "iooo",
      "iooo",
      "iooo",
      "iooo",
      "iooo",
      "rrrr",
      "eeee",
    ],
    [
      "F..F",
      "....",
      "....",
      "....",
      "....",
      "....",
      "....",
      "....",
      "....",
      "R..R",
    ],
    1,
    6,
  ),
  sprite(
    [
      "......",
      "iooooo",
      "iffffo",
      "iooooo",
      "iooooo",
      "iooooo",
      "ioggoo",
      "ioggoo",
      "iooooo",
      "iooooo",
      "iooooo",
      "iooooo",
      "irrrro",
      "iooooo",
      "ssssss",
      "eeeeee",
    ],
    [
      ".F..F.",
      "......",
      "......",
      "......",
      "......",
      "......",
      "......",
      "......",
      "......",
      "......",
      "......",
      "......",
      "......",
      "......",
      "......",
      ".R..R.",
    ],
    2,
    9,
  ),
];

/** A sprite from a list of lettered pixels, the anchor given in the same coordinates. */
function fromPixels(
  day: { x: number; y: number; ch: string }[],
  lamp: { x: number; y: number; ch: string }[],
  ax: number,
  ay: number,
): Sprite {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of [...day, ...lamp]) {
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x);
    y1 = Math.max(y1, p.y);
  }
  const grid = (list: typeof day): string[] => {
    const rows: string[][] = [];
    for (let y = y0; y <= y1; y++) rows.push(new Array(x1 - x0 + 1).fill("."));
    for (const p of list) rows[p.y - y0][p.x - x0] = p.ch;
    return rows.map((r) => r.join(""));
  };
  return sprite(grid(day), grid(lamp), ax - x0, ay - y0);
}

/**
 * An east-west sprite slanted up to the right: `n` of its body's columns (`bodyW` wide),
 * each lifted so the front end stands `rise` rows above the back.
 */
function shearColumns(
  base: Sprite,
  bodyW: number,
  n: number,
  rise: number,
): Sprite {
  const lift = (j: number): number => Math.round((rise * j) / (n - 1));
  const day: { x: number; y: number; ch: string }[] = [];
  const lamp: { x: number; y: number; ch: string }[] = [];
  const width = base.day[0].length;
  for (let j = 0; j < n + width - bodyW; j++) {
    const src = j < n ? Math.round((j * (bodyW - 1)) / (n - 1)) : bodyW + j - n;
    for (let r = 0; r < base.day.length; r++) {
      const d = base.day[r][src];
      const l = base.lamp[r][src];
      if (d !== ".") day.push({ x: j, y: r - lift(j), ch: d });
      if (l !== ".") lamp.push({ x: j, y: r - lift(j), ch: l });
    }
  }
  const mid = Math.round((n - 1) / 2);
  return fromPixels(day, lamp, mid, base.ay - lift(mid));
}

/**
 * A north-south sprite leant over to the right at the top: `n` of its rows, each moved
 * along so the top stands `shift` columns right of the bottom.
 */
function shearRows(base: Sprite, n: number, shift: number): Sprite {
  const h = base.day.length;
  // row 0 holds only lamps; the body is rows 1 to h - 1
  const along = (i: number): number =>
    Math.round((shift * (n - 1 - i)) / (n - 1));
  const day: { x: number; y: number; ch: string }[] = [];
  const lamp: { x: number; y: number; ch: string }[] = [];
  let ay = 0;
  let ax = base.ax;
  let best = Infinity;
  for (let i = -1; i < n; i++) {
    const src = i < 0 ? 0 : 1 + Math.round((i * (h - 2)) / (n - 1));
    const dx = i < 0 ? along(0) + 1 : along(i);
    if (i >= 0 && Math.abs(src - base.ay) < best) {
      best = Math.abs(src - base.ay);
      ay = i;
      ax = base.ax + dx;
    }
    const row = base.day[src];
    for (let c = 0; c < row.length; c++) {
      if (row[c] !== ".") day.push({ x: c + dx, y: i, ch: row[c] });
      const l = base.lamp[src][c];
      if (l !== ".") lamp.push({ x: c + dx, y: i, ch: l });
    }
  }
  return fromPixels(day, lamp, ax, ay);
}

/** The coaches at every drawn heading, far, middle and near. */
const COACHES: readonly (readonly Sprite[])[] = [
  [
    COACH_EW[0],
    shearColumns(COACH_EW[0], 6, 6, 1),
    shearColumns(COACH_EW[0], 6, 5, 2),
    shearColumns(COACH_EW[0], 6, 4, 3),
    shearRows(COACH_NS[0], 4, 2),
    shearRows(COACH_NS[0], 5, 1),
    COACH_NS[0],
  ],
  [
    COACH_EW[1],
    shearColumns(COACH_EW[1], 11, 11, 2),
    shearColumns(COACH_EW[1], 11, 10, 4),
    shearColumns(COACH_EW[1], 11, 8, 6),
    shearRows(COACH_NS[1], 7, 5),
    shearRows(COACH_NS[1], 8, 3),
    COACH_NS[1],
  ],
  [
    COACH_EW[2],
    shearColumns(COACH_EW[2], 17, 16, 4),
    shearColumns(COACH_EW[2], 17, 15, 7),
    shearColumns(COACH_EW[2], 17, 11, 8),
    shearRows(COACH_NS[2], 12, 8),
    shearRows(COACH_NS[2], 14, 4),
    COACH_NS[2],
  ],
];

const coachPaint = (k: CoachLook): Paint => {
  return (ch, back) => {
    switch (ch) {
      case "o":
        return k.roof;
      case "i":
        return k.roofHi;
      case "s":
        return k.side;
      case "e":
        return k.stripe;
      case "g":
        return k.glass;
      case "k":
        return k.tyre;
      case "f":
        return back ? k.roof : k.glass;
      case "r":
        return back ? k.glass : k.roof;
      default:
        return null;
    }
  };
};

/** A coach or a bus from above, its ground point at (x, y), pointing `heading`. */
export function coachSprite(
  s: Ink,
  x: number,
  y: number,
  cls: 0 | 1 | 2,
  heading: number,
  k: CoachLook,
): void {
  const p = pick(heading);
  stamp(s, COACHES[cls][p.i], x, y, p.mirror, p.back, coachPaint(k));
}

/** A coach's lamps at night (as `carLamps`; a coach shows no beam). */
export function coachLamps(
  s: Ink,
  x: number,
  y: number,
  cls: 0 | 1 | 2,
  heading: number,
  state: 1 | 2,
): void {
  const p = pick(heading);
  lamps(s, COACHES[cls][p.i], x, y, p.mirror, p.back, false, state === 2);
}
