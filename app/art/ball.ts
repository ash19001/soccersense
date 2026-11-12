/**
 * The menu ball: a classic black and white football that is also the menu.
 *
 *   drawBallShadow(s, state, groundY, light);   // first, on the grass
 *   drawBall(s, state, patches, light);         // then the ball
 *   ballSlotAt(state, x, y);                    // hit test, same panel lookup as the renderer
 *   ballSlotCenter(state, slot);                // where a patch is and how much it faces us
 *
 * Geometry. A real 32 panel ball projected on a sphere, so it can rock, spin and fly. The 12
 * pentagon centres are the corners of an icosahedron and the 20 hexagon centres are its face
 * centres. A point on the sphere belongs to the panel with the largest `dot(point, centre)`,
 * the pentagons' score divided by `PENTAGON_DEPTH`. That is a maximum over the faces of a
 * convex solid, so walking from a panel to any better neighbour always ends on the right
 * one: about seven dot products a pixel.
 *
 * Pose. Axes are the screen's: x right, y down, z towards the viewer. At yaw 0, pitch 0 two
 * neighbouring pentagons sit level either side of the middle (slots "left" and "right",
 * 31.7 degrees round) and two more sit 58.3 degrees above and below ("top", "bottom").
 * Two more slots are on the back, directly behind "right" and "left" ("backRight" and
 * "backLeft"): half a turn of yaw brings them round to where "left" and "right" were.
 * And two sit on the rim, out to the left and right and a little up ("rimLeft" and
 * "rimRight"): a quarter turn of yaw brings one round to the front.
 * `ballShowPose(slot)` is the pose that shows a slot.
 * Positive `yaw` turns the front of the ball to the right, positive `pitch` rolls it up and
 * away (a ball struck towards the stand), positive `roll` turns it clockwise.
 *
 * Look. Light from the top left. Padded leather panels in clean bands (chalk, then three
 * cooler steps), each shaded a little towards its own centre; stitched seams with a lit
 * lip; a crisp white glint; a 1 px ink outline. Every tone goes through `light.lit`: by day
 * the grass bounces a little light into the dark edge, and under floodlights the far rim
 * lights up white and a second glint appears.
 *
 * Buttons. A slot with an accent wears it as a coloured line round its pentagon, in its
 * icon and in a tab under its label, and every five seconds a bar of light crosses HOME and
 * then AWAY, so the two things to press say so before anything is hovered. Hold `t` still
 * to hold the shine still (it is off at t = 0).
 *
 * Sizes. Icons and words are flat and upright, ride on their pentagon and are masked to
 * it. What a button carries depends on the room it has when the ball is rocked as far as
 * the menu rocks it (0.12 rad): from r = 56 big icons and big words; from 44 the line sits
 * 2 px inside the pentagon; at 41 to 43 it moves out to the edge; at 37 to 40 it goes, to
 * leave "HOME" its 17 px; below 37 there are icons only and below 26 only the line. Both
 * buttons always make the same choice. The menu's ball is 36 to 60 px in radius.
 */

import {
  FONT_3x5,
  FONT_5x7,
  Surface,
  TRANSPARENT,
  clamp,
  drawText,
  measureText,
  sprite,
  type Color,
  type Sprite,
  type TextOptions,
} from "~/pixel";
import type { Lighting } from "./lighting";
import { P } from "./palette";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * The pentagons that can carry a patch. At yaw 0, pitch 0: "left" and "right" level either
 * side of the middle, "top" and "bottom" above and below them, and "backLeft" and
 * "backRight" on the back of the ball, directly behind "left" and "right" (as seen from
 * the front). Half a turn about the vertical brings "backRight" round to where "left" was
 * and "backLeft" to where "right" was. "rimLeft" and "rimRight" are on the rim, out to
 * the left and right and level with the top of "left" and "right", a quarter turn from the
 * middle: a drag to the right brings "rimLeft" round to the front, a drag to the left
 * "rimRight".
 */
export type BallSlot =
  | "left"
  | "right"
  | "top"
  | "bottom"
  | "backLeft"
  | "backRight"
  | "rimLeft"
  | "rimRight";

/** Every slot, in the order of `BallSlot`. */
export const BALL_SLOTS: readonly BallSlot[] = [
  "left",
  "right",
  "top",
  "bottom",
  "backLeft",
  "backRight",
  "rimLeft",
  "rimRight",
];

/**
 * A patch's picture. "home" a house, "away" an aeroplane, "forward" a fast-forward (the
 * future), "rewind" a rewind (the past), "pin" a map pin, "globe" a globe, "shirt" the
 * back of a shirt with its number, "goal" a goal with a ball on the spot, "lock" a padlock
 * alone, "none" nothing.
 */
export type BallIcon =
  | "home"
  | "away"
  | "forward"
  | "rewind"
  | "pin"
  | "globe"
  | "shirt"
  | "goal"
  | "lock"
  | "none";

export interface BallPatch {
  label: string;
  icon: BallIcon;
  accent?: { dark: Color; base: Color; light: Color };
  /**
   * A locked patch never takes a colour: it wears its picture with a padlock beside it, in
   * a quiet grey, and its word when it faces the viewer (on a dark tag when the word is
   * wider than the patch).
   */
  locked?: boolean;
  badge?: string;
}

export interface BallState {
  cx: number;
  cy: number;
  r: number;
  yaw: number;
  pitch: number;
  roll?: number;
  hovered: BallSlot | null;
  pressed: BallSlot | null;
  chosen: BallSlot | null;
  t: number;
}

export type BallPatches = Partial<Record<BallSlot, BallPatch>>;

// ---------------------------------------------------------------------------
// The solid: 32 panel centres and who touches whom. Built once.
// ---------------------------------------------------------------------------

const PHI = (1 + Math.sqrt(5)) / 2;
const FACES = 32;
const PENTAGONS = 12;
/**
 * How much further from the middle the pentagon faces sit than the hexagons. 1.0265 is the
 * true truncated icosahedron, whose side patches are 23 px wide at r = 44: too small for an
 * icon over the word HOME. At 1 they are 28 px, the black reads stronger at small sizes and
 * the four pentagons on the rim show as slivers, which is the ball everybody draws.
 */
const PENTAGON_DEPTH = 1.0;

const SLOTS = BALL_SLOTS;
const SLOT_COUNT = SLOTS.length;
const SLOT_INDEX: Readonly<Record<BallSlot, number>> = {
  left: 0,
  right: 1,
  top: 2,
  bottom: 3,
  backLeft: 4,
  backRight: 5,
  rimLeft: 6,
  rimRight: 7,
};
/** The pentagon each slot is (see the corners in `buildSolid`). */
const SLOT_FACE: readonly number[] = [0, 1, 2, 3, 10, 11, 4, 5];
/** The slot each panel is, or -1. */
const FACE_SLOT = new Int8Array(FACES).fill(-1);
SLOT_FACE.forEach((f, i) => (FACE_SLOT[f] = i));

/** Unit centres in ball space, three numbers a face. Pentagons first. */
const CENTRE = new Float64Array(FACES * 3);
/** Neighbours of each face (five for a pentagon, six for a hexagon). */
const NEIGHBOUR = new Int8Array(FACES * 6);
const NEIGHBOUR_COUNT = new Int8Array(FACES);

(function buildSolid(): void {
  // The menu pose: two neighbouring corners of the icosahedron level, either side of the
  // view axis (HOME and AWAY), and the two corners that finish their triangles above and
  // below (NEXT-GEN and RETRO). Then the four on the rim, the upper two of which carry
  // GUESS WHO and SHOOTOUT, and the four on the back, the last two of which (CLOSEST and
  // FURTHEST) are directly behind AWAY and HOME.
  const corners: readonly (readonly [number, number, number])[] = [
    [-1, 0, PHI],
    [1, 0, PHI],
    [0, -PHI, 1],
    [0, PHI, 1],
    [-PHI, -1, 0],
    [PHI, -1, 0],
    [-PHI, 1, 0],
    [PHI, 1, 0],
    [0, -PHI, -1],
    [0, PHI, -1],
    [-1, 0, -PHI],
    [1, 0, -PHI],
  ];
  const near = (a: number, b: number): boolean => {
    const dx = corners[a][0] - corners[b][0];
    const dy = corners[a][1] - corners[b][1];
    const dz = corners[a][2] - corners[b][2];
    return Math.abs(dx * dx + dy * dy + dz * dz - 4) < 1e-6;
  };
  const put = (i: number, x: number, y: number, z: number): void => {
    const n = Math.hypot(x, y, z);
    CENTRE[i * 3] = x / n;
    CENTRE[i * 3 + 1] = y / n;
    CENTRE[i * 3 + 2] = z / n;
  };
  const link = (a: number, b: number): void => {
    NEIGHBOUR[a * 6 + NEIGHBOUR_COUNT[a]++] = b;
    NEIGHBOUR[b * 6 + NEIGHBOUR_COUNT[b]++] = a;
  };

  for (let i = 0; i < PENTAGONS; i++) put(i, ...corners[i]);

  const triangles: (readonly [number, number, number])[] = [];
  for (let a = 0; a < PENTAGONS; a++) {
    for (let b = a + 1; b < PENTAGONS; b++) {
      if (!near(a, b)) continue;
      for (let c = b + 1; c < PENTAGONS; c++) {
        if (near(a, c) && near(b, c)) triangles.push([a, b, c]);
      }
    }
  }
  triangles.forEach((tri, n) => {
    const face = PENTAGONS + n;
    put(
      face,
      corners[tri[0]][0] + corners[tri[1]][0] + corners[tri[2]][0],
      corners[tri[0]][1] + corners[tri[1]][1] + corners[tri[2]][1],
      corners[tri[0]][2] + corners[tri[1]][2] + corners[tri[2]][2],
    );
    // A hexagon touches the three pentagons at its triangle's corners...
    for (const corner of tri) link(face, corner);
    // ...and the three hexagons whose triangles share an edge with it.
    for (let m = 0; m < n; m++) {
      let shared = 0;
      for (const corner of triangles[m]) if (tri.includes(corner)) shared++;
      if (shared === 2) link(face, PENTAGONS + m);
    }
  });
})();

// ---------------------------------------------------------------------------
// Light
// ---------------------------------------------------------------------------

function unit(x: number, y: number, z: number): [number, number, number] {
  const n = Math.hypot(x, y, z);
  return [x / n, y / n, z / n];
}

/** Towards the light: up, left and out of the screen. */
const [LX, LY, LZ] = unit(-0.52, -0.62, 0.58);
/**
 * The glint: two overlapping spots that follow the curve of the ball (a bean) and a dot
 * beyond its end, placed by eye so that at rest it sits whole inside the upper left panel.
 */
const [HX, HY, HZ] = unit(-0.5, -0.59, 0.64);
const [GX, GY, GZ] = unit(-0.38, -0.68, 0.64);
const [DX, DY, DZ] = unit(-0.66, -0.4, 0.64);
/** Under floodlights there is a second, smaller glint from the lights on the other side. */
const [FX, FY, FZ] = unit(0.52, -0.56, 0.65);
const GLINT_FLOOD = 0.9968;
/** cos of the glint's radii: the main spot, its core on a black panel, the tail, the dot. */
const GLINT_HALO = 0.9925;
const GLINT_CORE = 0.9975;
const GLINT_TAIL = 0.996;
const GLINT_DOT = 0.9986;

/** A stitch every this many pixels along a seam, counted from the seam's middle. */
const STITCH_EVERY = 3;
/** How much each panel's shading is pushed towards its own centre (the padded look). */
const DOME = 0.55;
// Leather by light: chalk, then steelHi, mist and steel. White is kept for the glint, the
// lit lips of the seams and the floodlit rim.
const LEATHER_STEPS = [0.37, -0.04, -0.58] as const;
// Black panels: slate where they face the light, night, ink in shadow. A black panel is
// shaded mostly by which way the whole panel faces and only a little across it, so each
// reads as one calm tone under its icon and label.
const BLACK_STEPS = [0.786, 0.167] as const;
const BLACK_FACE = 0.47;
/** The floodlit rim is on the side of the ball where the key light is weaker than this. */
const RIM_SIDE = -0.05;
/** The idle rock of the menu: labels are sized to stay inside their patch this far round. */
const ROCK = 0.12;
/** How far the top and bottom slots sit above and below the middle at rest (58.3 degrees). */
const TILT = Math.atan2(PHI, 1);
/** How far the rim slots sit above the middle once a quarter turn has brought them round
 * (31.7 degrees, as far round as "left" and "right" are at rest). */
const RIM_TILT = Math.atan2(1, PHI);
/** The slots whose pose shows them straight on, and their panels (1 for each). */
const FRONT_SLOTS: readonly BallSlot[] = [
  "top",
  "bottom",
  "rimLeft",
  "rimRight",
];
const FRONT_FACE = new Uint8Array(FACES);
for (const slot of FRONT_SLOTS) FRONT_FACE[SLOT_FACE[SLOT_INDEX[slot]]] = 1;

interface Tones {
  ink: Color;
  /** White leather, lightest first: white, chalk, steelHi, mist, steel. */
  leather: readonly Color[];
  seam: readonly Color[];
  stitch: readonly Color[];
  /** Black panels: slate, night, ink. */
  black: readonly Color[];
  /** The bar of light that crosses an idle button: its core, its soft edges. */
  shine: readonly Color[];
  /** The glint where it falls on a black panel: halo, core. */
  blackGlint: readonly Color[];
  /** A locked or plain panel under the pointer: light, base, dark. */
  lifted: readonly Color[];
  chalk: Color;
  mist: Color;
  /** The floodlit rim, on leather and on a black panel. */
  rimLeather: Color;
  rimBlack: Color;
  /** How far the floodlights are up: 0 off, 1 full. */
  flood: number;
}

const toneCache = new WeakMap<Lighting, Tones>();

function tonesFor(light: Lighting): Tones {
  const hit = toneCache.get(light);
  if (hit) return hit;
  const c = light.lit;
  const white = c(P.white);
  const chalk = c(P.chalk);
  const steelHi = c(P.steelHi);
  const mist = c(P.mist);
  const steel = c(P.steel);
  const slate = c(P.slate);
  const night = c(P.night);
  const ink = c(P.ink);
  const tones: Tones = {
    ink,
    leather: [white, chalk, steelHi, mist, steel],
    seam: [steelHi, mist, steel, steel, slate],
    stitch: [mist, steel, slate, slate, night],
    black: [slate, night, ink],
    shine: [steel, slate],
    blackGlint: [steel, mist],
    lifted: [steel, slate, night],
    chalk,
    mist,
    rimLeather: white,
    rimBlack: steel,
    // The floodlights fade up from 4 degrees to -4 (see lighting.ts).
    flood: light.lightsOn ? clamp((4 - light.sun.elevation) / 8, 0, 1) : 0,
  };
  toneCache.set(light, tones);
  return tones;
}

// ---------------------------------------------------------------------------
// Per-call scratch (the ball is redrawn every frame: nothing here allocates)
// ---------------------------------------------------------------------------

/** Rotated unit centres (view space). */
const VIEW = new Float64Array(FACES * 3);
/** The same, scaled so that one dot product gives the panel score. */
const SCORE = new Float64Array(FACES * 3);
/** dot(centre, light) for each panel: the pivot of the dome shading. */
const FACE_LIGHT = new Float64Array(FACES);

/** Panel of every pixel in the ball's box, with a 1 px border. */
let faceBuf = new Int8Array(0);
/** City-block distance to the nearest pixel of another panel (1 = on the edge). */
let edgeBuf = new Uint8Array(0);
/** 1 where a leather pixel is a seam. */
let seamBuf = new Uint8Array(0);
const OUTSIDE = -1;
const OUTLINE = -2;

interface Disc {
  /** Left and top of the box. */
  x0: number;
  y0: number;
  /** Pixels across. */
  d: number;
  /** The true centre (may fall between pixels) and radius. */
  tx: number;
  ty: number;
  rad: number;
}

const disc: Disc = { x0: 0, y0: 0, d: 0, tx: 0, ty: 0, rad: 0 };

/** The engine's circle convention: a radius r is round(2r) + 1 pixels across. */
function measure(state: BallState): boolean {
  const r = state.r;
  if (!(r >= 1) || !Number.isFinite(state.cx + state.cy + r) || r > 512) {
    return false;
  }
  const d = Math.round(2 * r) + 1;
  disc.d = d;
  disc.x0 = Math.round(state.cx - r);
  disc.y0 = Math.round(state.cy - r);
  disc.tx = disc.x0 + (d - 1) / 2;
  disc.ty = disc.y0 + (d - 1) / 2;
  disc.rad = d / 2;
  return true;
}

function finite(v: number | undefined): number {
  return v !== undefined && Number.isFinite(v) ? v : 0;
}

/** Turn every panel centre into view space. */
function orient(yaw: number, pitch: number, roll: number): void {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const cr = Math.cos(roll);
  const sr = Math.sin(roll);
  for (let i = 0; i < FACES; i++) {
    const x = CENTRE[i * 3];
    const y = CENTRE[i * 3 + 1];
    const z = CENTRE[i * 3 + 2];
    // yaw about the vertical axis: the front turns to the right
    const x1 = x * cy + z * sy;
    const z1 = -x * sy + z * cy;
    // pitch about the horizontal axis: the front turns up
    const y2 = y * cp - z1 * sp;
    const z2 = y * sp + z1 * cp;
    // roll about the view axis: clockwise
    const x3 = x1 * cr - y2 * sr;
    const y3 = x1 * sr + y2 * cr;
    VIEW[i * 3] = x3;
    VIEW[i * 3 + 1] = y3;
    VIEW[i * 3 + 2] = z2;
    const k = i < PENTAGONS ? 1 / PENTAGON_DEPTH : 1;
    SCORE[i * 3] = x3 * k;
    SCORE[i * 3 + 1] = y3 * k;
    SCORE[i * 3 + 2] = z2 * k;
    FACE_LIGHT[i] = x3 * LX + y3 * LY + z2 * LZ;
  }
}

function orientTo(state: BallState): void {
  orient(finite(state.yaw), finite(state.pitch), finite(state.roll));
}

/** The panel under a view-space point, walking uphill from a guess. */
function panelAt(x: number, y: number, z: number, guess: number): number {
  let f = guess;
  let best = x * SCORE[f * 3] + y * SCORE[f * 3 + 1] + z * SCORE[f * 3 + 2];
  for (;;) {
    let moved = false;
    const base = f * 6;
    const count = NEIGHBOUR_COUNT[f];
    for (let n = 0; n < count; n++) {
      const g = NEIGHBOUR[base + n];
      const score =
        x * SCORE[g * 3] + y * SCORE[g * 3 + 1] + z * SCORE[g * 3 + 2];
      if (score > best) {
        best = score;
        f = g;
        moved = true;
      }
    }
    if (!moved) return f;
  }
}

/** Fill `faceBuf`, `edgeBuf` and `seamBuf` for the current disc and orientation. */
function rasterise(): void {
  const d = disc.d;
  const stride = d + 2;
  const size = stride * stride;
  if (faceBuf.length < size) {
    faceBuf = new Int8Array(size);
    edgeBuf = new Uint8Array(size);
    seamBuf = new Uint8Array(size);
  }
  const rad = disc.rad;
  const rad2 = rad * rad;
  const inv = 1 / rad;
  const half = (d - 1) / 2;
  faceBuf.fill(OUTSIDE, 0, size);

  let rowGuess = 0;
  for (let j = 0; j < d; j++) {
    const dy = j - half;
    let guess = rowGuess;
    let first = true;
    const row = (j + 1) * stride + 1;
    for (let i = 0; i < d; i++) {
      const dx = i - half;
      const q = dx * dx + dy * dy;
      if (q > rad2) continue;
      const nx = dx * inv;
      const ny = dy * inv;
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      guess = panelAt(nx, ny, nz, guess);
      if (first) {
        rowGuess = guess;
        first = false;
      }
      faceBuf[row + i] = guess;
    }
  }

  // The outline is the engine's circle: the disc's pixels that touch the outside.
  // Marked in a second sweep so the test reads the untouched panel ids.
  for (let j = 0; j < d; j++) {
    const row = (j + 1) * stride + 1;
    for (let i = 0; i < d; i++) {
      const k = row + i;
      edgeBuf[k] =
        faceBuf[k] !== OUTSIDE &&
        (faceBuf[k - 1] === OUTSIDE ||
          faceBuf[k + 1] === OUTSIDE ||
          faceBuf[k - stride] === OUTSIDE ||
          faceBuf[k + stride] === OUTSIDE)
          ? 1
          : 0;
    }
  }
  for (let j = 0; j < d; j++) {
    const row = (j + 1) * stride + 1;
    for (let i = 0; i < d; i++) {
      if (edgeBuf[row + i] === 1) faceBuf[row + i] = OUTLINE;
    }
  }

  // Distance to the nearest other panel, city-block, capped: two chamfer sweeps. The
  // first also marks the seams. A seam is drawn on one side only, in the panel with the
  // lower number, so it is a single pixel wide whichever way it runs.
  for (let j = 0; j < d; j++) {
    const row = (j + 1) * stride + 1;
    for (let i = 0; i < d; i++) {
      const k = row + i;
      const f = faceBuf[k];
      seamBuf[k] = 0;
      if (f < 0) {
        edgeBuf[k] = 0;
        continue;
      }
      const a = faceBuf[k - 1];
      const b = faceBuf[k + 1];
      const c = faceBuf[k - stride];
      const e = faceBuf[k + stride];
      if (a !== f || b !== f || c !== f || e !== f) {
        edgeBuf[k] = 1;
        if (f >= PENTAGONS && (a > f || b > f || c > f || e > f)) {
          seamBuf[k] = 1;
        }
        continue;
      }
      const m =
        edgeBuf[k - 1] < edgeBuf[k - stride]
          ? edgeBuf[k - 1]
          : edgeBuf[k - stride];
      edgeBuf[k] = m >= 30 ? 31 : m + 1;
    }
  }
  for (let j = d - 1; j >= 0; j--) {
    const row = (j + 1) * stride + 1;
    for (let i = d - 1; i >= 0; i--) {
      const k = row + i;
      if (faceBuf[k] < 0) continue;
      const a = edgeBuf[k + 1];
      const b = edgeBuf[k + stride];
      const m = (a < b ? a : b) + 1;
      if (m < edgeBuf[k]) edgeBuf[k] = m;
    }
  }
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

const ICON_HOME = sprite(
  `
....w....
...www.w.
..wwwwww.
.wwwwwww.
wwwwwwwww
.wwwwwww.
.www.www.
.www.www.
.www.www.
`,
  "w",
);

const ICON_AWAY = sprite(
  `
.......ww
......www
.....www.
.wwwwww..
....www..
...wwww..
.wwww.w..
..ww..w..
..w......
`,
  "w",
);

const ICON_LOCK = sprite(
  `
..wwwww..
.ww...ww.
.w.....w.
.w.....w.
wwwwwwwww
wwww.wwww
wwww.wwww
wwwwwwwww
wwwwwwwww
`,
  "w",
);

const ICON_LOCK_SMALL = sprite(
  `
.www.
.w.w.
wwwww
ww.ww
wwwww
`,
  "w",
);

const ICON_LOCK_MID = sprite(
  `
..www..
.w...w.
.w...w.
wwwwwww
www.www
www.www
wwwwwww
`,
  "w",
);

const ICON_HOME_BIG = sprite(
  `
......w......
.....www.ww..
....wwwwwww..
...wwwwwwww..
..wwwwwwwww..
.wwwwwwwwwww.
wwwwwwwwwwwww
.wwwwwwwwwww.
.wwwwwwwwwww.
.wwww...wwww.
.wwww...wwww.
.wwww...wwww.
.wwww...wwww.
`,
  "w",
);

const ICON_AWAY_BIG = sprite(
  `
...........ww
..........www
.........www.
........www..
.wwwwwwwww...
...wwwwww....
.....wwww....
....wwwww....
...www.ww....
wwwww..ww....
..ww....w....
...w....w....
...w.........
`,
  "w",
);

// The pictures of the locked patches: one size only, as quiet as the patches they ride on.

const ICON_FORWARD = sprite(
  `
w...w...
ww..ww..
www.www.
wwwwwwww
www.www.
ww..ww..
w...w...
`,
  "w",
);

const ICON_REWIND = sprite(
  `
...w...w
..ww..ww
.www.www
wwwwwwww
.www.www
..ww..ww
...w...w
`,
  "w",
);

const ICON_PIN = sprite(
  `
.wwwww.
wwwwwww
ww...ww
ww...ww
wwwwwww
.wwwww.
..www..
...w...
`,
  "w",
);

const ICON_GLOBE = sprite(
  `
..wwwww..
.w..w..w.
w..w.w..w
wwwwwwwww
w..w.w..w
.w..w..w.
..wwwww..
`,
  "w",
);

/** GUESS WHO: the back of a shirt, its number cut out of it. */
const ICON_SHIRT = sprite(
  `
.www.www.
wwwwwwwww
www...www
.wwww.ww.
.wwww.ww.
.www.www.
.www.www.
.wwwwwww.
`,
  "w",
);

/** SHOOTOUT: a goal with its net, and the ball on the spot in front of it. */
const ICON_GOAL = sprite(
  `
wwwwwwwww
w.w.w.w.w
ww.w.w.ww
w.w.w.w.w
w.......w
....w....
...www...
....w....
`,
  "w",
);

// The same, small, for a locked patch squashed far round the ball (the top and bottom
// patches of the menu pose): five rows, beside the small padlock.

const ICON_FORWARD_SMALL = sprite(
  `
w..w..
ww.ww.
wwwwww
ww.ww.
w..w..
`,
  "w",
);

const ICON_REWIND_SMALL = sprite(
  `
..w..w
.ww.ww
wwwwww
.ww.ww
..w..w
`,
  "w",
);

const ICON_PIN_SMALL = sprite(
  `
.www.
ww.ww
wwwww
.www.
..w..
`,
  "w",
);

const ICON_GLOBE_SMALL = sprite(
  `
.www.
w.w.w
wwwww
w.w.w
.www.
`,
  "w",
);

const ICON_SHIRT_SMALL = sprite(
  `
ww.ww
wwwww
.w.w.
.www.
.www.
`,
  "w",
);

const ICON_GOAL_SMALL = sprite(
  `
wwwww
ww.ww
w.w.w
w...w
..w..
`,
  "w",
);

/** A locked patch's picture, full size or squashed, or null for "lock" and "none". */
function pictureFor(patch: BallPatch, small: boolean): Sprite | null {
  switch (patch.icon) {
    case "forward":
      return small ? ICON_FORWARD_SMALL : ICON_FORWARD;
    case "rewind":
      return small ? ICON_REWIND_SMALL : ICON_REWIND;
    case "pin":
      return small ? ICON_PIN_SMALL : ICON_PIN;
    case "globe":
      return small ? ICON_GLOBE_SMALL : ICON_GLOBE;
    case "shirt":
      return small ? ICON_SHIRT_SMALL : ICON_SHIRT;
    case "goal":
      return small ? ICON_GOAL_SMALL : ICON_GOAL;
    case "home":
    case "away":
      return small ? null : iconFor(patch, false);
    default:
      return null;
  }
}

function iconFor(patch: BallPatch, big: boolean): Sprite | null {
  switch (patch.icon) {
    case "home":
      return big ? ICON_HOME_BIG : ICON_HOME;
    case "away":
      return big ? ICON_AWAY_BIG : ICON_AWAY;
    case "forward":
      return ICON_FORWARD;
    case "rewind":
      return ICON_REWIND;
    case "pin":
      return ICON_PIN;
    case "globe":
      return ICON_GLOBE;
    case "shirt":
      return ICON_SHIRT;
    case "goal":
      return ICON_GOAL;
    case "lock":
      return ICON_LOCK;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Slots: what each of the four menu pentagons is doing this frame
// ---------------------------------------------------------------------------

const PLAIN = 0;
const NORMAL = 1;
const HOVER = 2;
const PRESSED = 3;
const CHOSEN = 4;
const LIFTED = 5;

const slotMode = new Int8Array(SLOT_COUNT);
/** Colours per slot: fill light, fill base, fill dark, edge, inner line. */
const slotColor = new Uint32Array(SLOT_COUNT * 5);
/** The dark ink for a score on its plate, per slot. */
const slotDeep = new Uint32Array(SLOT_COUNT);
/** Projected centre of each panel, in pixels (see `SLOT_FACE` for the slots). */
const panelX = new Int32Array(FACES);
const panelY = new Int32Array(FACES);
/**
 * Where the shine is on an idle patch this frame, as a diagonal offset from the patch
 * centre, or NO_SHINE.
 */
const slotShine = new Int32Array(SLOT_COUNT);
const NO_SHINE = 1 << 20;
/** The shine crosses HOME, then AWAY, once every this many seconds (the rock's period). */
const SHINE_PERIOD = 5;
const SHINE_START = 2;
const SHINE_GAP = 0.35;
const SHINE_TIME = 0.5;
const SHINE_STEPS = 8;

/** Below this the pentagon is too far round the ball to carry anything. */
const FACING_MIN = 0.35;
const FACING_ICON = 0.5;
const FACING_LABEL = 0.62;
/** A side pentagon has room for an icon from this radius up. */
const ICON_MIN_R = 26;

/** From this radius up the buttons carry the larger icons and, if they fit, larger words. */
const BIG_ICON_R = 56;

/**
 * This frame's layout, the same for both buttons (or one would say HOME beside a bare
 * aeroplane). Set by `chooseLayout`.
 */
/** Where the coloured line runs: 2 px in from the pentagon's edge, on it (1), or nowhere. */
let ringAt = 2;
/** How the labels are written, or null when there is no room for words. */
let labelOpts: TextOptions | null = null;
let bigIcons = false;
/** Icons and words keep this far in from the pentagon's edge (clear of the line). */
let inkEdge = 3;

function accentOf(patch: BallPatch | undefined): BallPatch["accent"] {
  return patch && patch.locked !== true ? patch.accent : undefined;
}

function hasBadge(patch: BallPatch): boolean {
  return patch.badge !== undefined && patch.badge !== "";
}

function prepareSlots(
  state: BallState,
  patches: BallPatches,
  light: Lighting,
  tones: Tones,
): void {
  for (let i = 0; i < FACES; i++) {
    panelX[i] = Math.round(disc.tx + VIEW[i * 3] * disc.rad);
    panelY[i] = Math.round(disc.ty + VIEW[i * 3 + 1] * disc.rad);
  }
  for (let i = 0; i < SLOT_COUNT; i++) {
    const slot = SLOTS[i];
    const patch = patches[slot];
    const accent = accentOf(patch);
    const o = i * 5;
    slotShine[i] = NO_SHINE;
    slotMode[i] = PLAIN;
    slotDeep[i] = tones.ink;
    if (!patch) continue;
    if (!accent) {
      // Locked, or a plain patch: it never takes a colour, hover only lifts it.
      if (state.hovered === slot || state.pressed === slot) {
        slotMode[i] = LIFTED;
        slotColor[o] = tones.lifted[0];
        slotColor[o + 1] = tones.lifted[1];
        slotColor[o + 2] = tones.lifted[2];
        slotColor[o + 3] = tones.black[1];
        slotColor[o + 4] = TRANSPARENT;
      }
      continue;
    }
    const dark = light.lit(accent.dark);
    const base = light.lit(accent.base);
    const lite = light.lit(accent.light);
    slotDeep[i] = state.chosen === slot ? accent.dark : dark;
    if (state.chosen === slot) {
      // A flash is a light source: raw colour, stepped at 8 Hz.
      const on = (Math.floor(finite(state.t) * 8) & 1) === 0;
      slotMode[i] = CHOSEN;
      const fill = on ? P.white : accent.light;
      slotColor[o] = fill;
      slotColor[o + 1] = fill;
      slotColor[o + 2] = fill;
      // The rim stays in the mode's colour, so the white frame still reads as its patch.
      slotColor[o + 3] = accent.base;
      slotColor[o + 4] = on ? accent.light : P.white;
    } else if (state.pressed === slot) {
      slotMode[i] = PRESSED;
      slotColor[o] = dark;
      slotColor[o + 1] = dark;
      slotColor[o + 2] = dark;
      slotColor[o + 3] = tones.ink;
      slotColor[o + 4] = TRANSPARENT;
    } else if (state.hovered === slot) {
      slotMode[i] = HOVER;
      slotColor[o] = lite;
      slotColor[o + 1] = base;
      slotColor[o + 2] = dark;
      slotColor[o + 3] = dark;
      slotColor[o + 4] = ringAt === 2 ? tones.chalk : TRANSPARENT;
    } else {
      slotMode[i] = NORMAL;
      slotColor[o] = lite;
      slotColor[o + 1] = base;
      slotColor[o + 2] = dark;
      slotColor[o + 3] = tones.leather[0];
      slotColor[o + 4] = base;
      // "Press me": every few seconds a bar of light crosses the patch, HOME and then
      // AWAY. Stepped, and nothing at t = 0.
      if (Number.isFinite(state.t) && disc.rad >= 20) {
        const phase =
          (((state.t % SHINE_PERIOD) + SHINE_PERIOD) % SHINE_PERIOD) -
          SHINE_START -
          i * SHINE_GAP;
        if (phase >= 0 && phase < SHINE_TIME) {
          const reach = disc.rad * 0.7;
          const step = Math.floor((phase / SHINE_TIME) * SHINE_STEPS);
          slotShine[i] = Math.round(
            -reach + ((step + 0.5) / SHINE_STEPS) * 2 * reach,
          );
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Room for words
// ---------------------------------------------------------------------------

/** Scratch result of `freeRun`: the first free column. */
let runLo = 0;

/**
 * The run of columns, around screen column `x`, that panel `f` has free on every one of
 * the rows y to y + h - 1: pixels at least `minEdge` in from the panel's edge. Sets
 * `runLo` and returns the width (0 when column x itself is not free on all of them).
 */
function freeRun(
  f: number,
  x: number,
  y: number,
  h: number,
  minEdge: number,
): number {
  const d = disc.d;
  const stride = d + 2;
  const i = x - disc.x0;
  runLo = x;
  if (i < 0 || i >= d) return 0;
  let lo = -1;
  let hi = d;
  for (let n = 0; n < h; n++) {
    const j = y + n - disc.y0;
    if (j < 0 || j >= d) return 0;
    const k = (j + 1) * stride + 1 + i;
    if (faceBuf[k] !== f || edgeBuf[k] < minEdge) return 0;
    let a = k;
    let b = k;
    while (faceBuf[a - 1] === f && edgeBuf[a - 1] >= minEdge) a--;
    while (faceBuf[b + 1] === f && edgeBuf[b + 1] >= minEdge) b++;
    if (i + (a - k) > lo) lo = i + (a - k);
    if (i + (b - k) < hi) hi = i + (b - k);
  }
  if (hi < lo) return 0;
  runLo = disc.x0 + lo;
  return hi - lo + 1;
}

/** Top row of a block of text `h` rows tall on a side patch centred on row `cy`. */
function textTop(cy: number, h: number): number {
  return cy + 2 - (h >> 1);
}

/**
 * Width free for text on a side patch at the far end of the idle rock, by rows of text
 * (5 or 7) and by where the coloured line is. Measured once per size on a real
 * rasterisation, so it cannot drift from the renderer.
 */
const roomCache = new Map<number, Int16Array>();

/** The rest of a room table: a locked patch's picture row and word, and its picture row
 * squashed far round (the top and bottom patches of the menu pose). */
const ROOM_MARK = 6;
const ROOM_WORD = 7;
const ROOM_SQUASHED = 8;
/** The picture row and word of the top or bottom patch, shown straight on. */
const ROOM_MARK_FRONT = 9;
const ROOM_WORD_FRONT = 10;
const ROOM_SIZE = 11;
/** The menu's deepest nod, give or take: the squashed room is measured that far each way. */
const SQUASH_NOD = 0.065;

/** Index into a room table: the line's place (0 none, 1 edge, 2 inset), rows of text. */
function roomAt(ring: number, rows: number): number {
  return ring * 2 + (rows > 5 ? 1 : 0);
}

function roomFor(): Int16Array {
  const d = disc.d;
  let room = roomCache.get(d);
  if (room) return room;
  room = new Int16Array(ROOM_SIZE);
  if (disc.rad >= ICON_MIN_R) {
    orient(ROCK, 0, 0);
    rasterise();
    // The far patch is the tight one; the ball is symmetrical, so one end is enough.
    const x = Math.round(disc.tx + VIEW[3] * disc.rad);
    const y = Math.round(disc.ty + VIEW[4] * disc.rad);
    for (let ring = 0; ring <= 2; ring++) {
      room[roomAt(ring, 5)] = freeRun(1, x, textTop(y, 5), 5, ring + 2);
      room[roomAt(ring, 7)] = freeRun(1, x, textTop(y, 7), 7, ring + 2);
    }
    // A locked patch in a side place (where CLOSEST and FURTHEST rest after half a turn):
    // its picture row, and its word under it. And the top and bottom patches of the menu
    // pose, squashed, measured as a run centred on the patch (the picture is placed so).
    // Both at either end of the rock and of a deep nod.
    let mark = 1 << 14;
    let word = 1 << 14;
    let squashed = 1 << 14;
    for (const yaw of [-ROCK, ROCK]) {
      for (const pitch of [-SQUASH_NOD, SQUASH_NOD]) {
        orient(yaw, pitch, 0);
        rasterise();
        const top = lockedTop(Math.round(disc.ty + VIEW[4] * disc.rad));
        const sx = Math.round(disc.tx + VIEW[3] * disc.rad);
        mark = Math.min(mark, freeRun(1, sx, top, LOCKED_ROW, LOCKED_EDGE));
        word = Math.min(
          word,
          freeRun(1, sx, top + LOCKED_ROW + LOCKED_GAP, 5, LOCKED_EDGE),
        );
        for (const f of [2, 3]) {
          const px = Math.round(disc.tx + VIEW[f * 3] * disc.rad);
          const py = Math.round(disc.ty + VIEW[f * 3 + 1] * disc.rad);
          const run = freeRun(
            f,
            px,
            py - (SQUASHED_ROW >> 1),
            SQUASHED_ROW,
            LOCKED_EDGE,
          );
          const half =
            run > 0 ? Math.min(px - runLo, runLo + run - 1 - px) : -1;
          squashed = Math.min(squashed, 2 * half + 1);
        }
      }
    }
    room[ROOM_MARK] = mark;
    room[ROOM_WORD] = word;
    room[ROOM_SQUASHED] = Math.max(0, squashed);
    // NEXT-GEN, RETRO, GUESS WHO and SHOOTOUT shown straight on (`ballShowPose`), rocked
    // and nodding. (Turned a quarter round, the hover's nod is a roll of GUESS WHO and
    // SHOOTOUT: they are measured rolled as well.)
    let frontMark = 1 << 14;
    let frontWord = 1 << 14;
    for (const slot of FRONT_SLOTS) {
      const f = SLOT_FACE[SLOT_INDEX[slot]];
      const pose = ballShowPose(slot);
      const rolls = pose.yaw === 0 ? [0] : [-SQUASH_NOD, SQUASH_NOD];
      for (const yaw of [-ROCK, ROCK]) {
        for (const nod of [-SQUASH_NOD, SQUASH_NOD]) {
          for (const roll of rolls) {
            orient(pose.yaw + yaw, pose.pitch + nod, roll);
            rasterise();
            const px = Math.round(disc.tx + VIEW[f * 3] * disc.rad);
            const top = lockedTop(
              Math.round(disc.ty + VIEW[f * 3 + 1] * disc.rad),
            );
            frontMark = Math.min(
              frontMark,
              freeRun(f, px, top, LOCKED_ROW, LOCKED_EDGE),
            );
            frontWord = Math.min(
              frontWord,
              freeRun(f, px, top + LOCKED_ROW + LOCKED_GAP, 5, LOCKED_EDGE),
            );
          }
        }
      }
    }
    room[ROOM_MARK_FRONT] = frontMark;
    room[ROOM_WORD_FRONT] = frontWord;
  }
  if (roomCache.size > 400) roomCache.clear();
  roomCache.set(d, room);
  return room;
}

const SMALL = { font: FONT_3x5 } as const;
const SMALL_DIGITS = { font: FONT_3x5, tabular: true } as const;
const BIG_DIGITS = { font: FONT_5x7, tabular: true } as const;
const BIG = { font: FONT_5x7 } as const;

/**
 * Pick the line's place and the label font for this frame (see `ringAt`). Words matter
 * more than the line: on a small ball the line moves out to the pentagon's edge, and on
 * a smaller one still it goes, to leave the label room.
 */
function chooseLayout(patches: BallPatches, room: Int16Array): void {
  // The widest label in each font, and the widest plate a score would need.
  let small = 0;
  let big = 0;
  let plate = 0;
  for (let i = 0; i < SLOT_COUNT; i++) {
    const patch = patches[SLOTS[i]];
    // the buttons (a locked patch has its own layout: see `drawLocked`)
    if (!patch || !accentOf(patch)) continue;
    if (hasBadge(patch)) {
      const w = measureText(patch.badge as string, SMALL_DIGITS) + 4;
      plate = Math.max(plate, w);
    } else if (patch.label !== "") {
      small = Math.max(small, measureText(patch.label, SMALL));
      big = Math.max(big, measureText(patch.label, BIG));
    }
  }
  bigIcons = disc.rad >= BIG_ICON_R;
  labelOpts = SMALL;
  ringAt = 2;
  if (disc.rad < ICON_MIN_R) {
    // Too small for anything but the line, which then sits on the edge.
    labelOpts = null;
    ringAt = 1;
  } else if (bigIcons && big <= room[roomAt(2, 7)]) {
    labelOpts = BIG;
  } else {
    // Step the line out, and then off, until the words and the plate fit. If the plate
    // never does, the words alone decide (the score is then written without one).
    let ring = 2;
    while (
      ring >= 0 &&
      (small > room[roomAt(ring, 5)] || plate > room[roomAt(ring, 7)])
    ) {
      ring--;
    }
    if (ring < 0) {
      ring = 2;
      while (ring >= 0 && small > room[roomAt(ring, 5)]) ring--;
    }
    if (ring < 0) labelOpts = null;
    else ringAt = ring;
  }
  inkEdge = Math.max(2, ringAt + 1);
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

/**
 * Draw the ball. `patches` says what each slot's pentagon carries. Colours go through
 * `light.lit`. Works for any radius from about 6 up, any rotation, and partly off-screen.
 */
export function drawBall(
  s: Surface,
  state: BallState,
  patches: BallPatches,
  light: Lighting,
): void {
  if (!measure(state)) return;
  const d = disc.d;
  const x0 = disc.x0;
  const y0 = disc.y0;
  if (
    x0 >= s.clipX1 ||
    y0 >= s.clipY1 ||
    x0 + d <= s.clipX0 ||
    y0 + d <= s.clipY0
  ) {
    return;
  }
  chooseLayout(patches, roomFor());
  orientTo(state);
  rasterise();
  const tones = tonesFor(light);
  prepareSlots(state, patches, light, tones);

  const stride = d + 2;
  const rad = disc.rad;
  const inv = 1 / rad;
  const half = (d - 1) / 2;
  const data = s.data;
  const sw = s.w;
  const iMin = Math.max(0, s.clipX0 - x0);
  const iMax = Math.min(d, s.clipX1 - x0);
  const jMin = Math.max(0, s.clipY0 - y0);
  const jMax = Math.min(d, s.clipY1 - y0);

  const leather = tones.leather;
  const seam = tones.seam;
  const stitch = tones.stitch;
  const black = tones.black;
  const shineTones = tones.shine;
  const blackGlint = tones.blackGlint;
  // Detail comes in with size (art bible: no dither or fuss on anything small).
  const dome = rad >= 20 ? DOME : 0.25;
  const stitched = rad >= 30;
  const bevel = rad >= 30;
  const glintDot = rad >= 30 ? GLINT_DOT : 2;
  const glintFlood = tones.flood > 0.6 && rad >= 20 ? GLINT_FLOOD : 2;
  // The grass's bounce light: the outer 2 px of the darkest band.
  const bounce = rad >= 20 ? Math.sqrt(1 - (1 - 2.2 / rad) ** 2) : 0;
  // Floodlights behind the ball catch its far edge: a crisp rim just inside the outline,
  // one to three pixels wide as the lights come up and the ball gets bigger.
  const flood = tones.flood;
  const rimW =
    flood <= 0.25
      ? 0
      : (flood < 0.6 ? 1 : 2) + (rad >= 40 ? 1 : 0) - (rad < 20 ? 1 : 0);
  const rimIn = rimW > 0 ? (rad - 1 - rimW) * inv : 2;
  const rimIn2 = rimIn * rimIn;
  // A patch is banded on the diagonal through its centre: clean 45 degree steps.
  const bandHalf = Math.max(2, Math.round(rad * 0.13));
  const fillLight = Math.round(rad * 0.29);
  const fillDark = Math.round(rad * 0.3);
  const ring = ringAt;

  for (let j = jMin; j < jMax; j++) {
    const dy = j - half;
    const ny = dy * inv;
    const row = (j + 1) * stride + 1;
    const py = y0 + j;
    const out = py * sw + x0;
    for (let i = iMin; i < iMax; i++) {
      const k = row + i;
      const f = faceBuf[k];
      if (f === OUTSIDE) continue;
      if (f === OUTLINE) {
        data[out + i] = tones.ink;
        continue;
      }
      const dx = i - half;
      const nx = dx * inv;
      const q = nx * nx + ny * ny;
      const nz = Math.sqrt(Math.max(0, 1 - q));
      const flat = nx * LX + ny * LY + nz * LZ;
      // The rim is a crescent: it tapers to a point at each end.
      const onRim =
        q > rimIn2 &&
        flat < RIM_SIDE &&
        (1 - Math.sqrt(q)) * rad - 1 <
          rimW * Math.min(1, 0.34 + (RIM_SIDE - flat) * 2.2);
      // (A panel that faces away shows only its near edge: it must not glow for that.)
      const fl = FACE_LIGHT[f];
      const l = flat * (1 + dome) - dome * (fl > 0 ? fl : 0);
      let spec = nx * HX + ny * HY + nz * HZ;
      if (
        spec < GLINT_HALO &&
        ny < 0 &&
        (nx * GX + ny * GY + nz * GZ >= GLINT_TAIL ||
          nx * DX + ny * DY + nz * DZ >= glintDot ||
          nx * FX + ny * FY + nz * FZ >= glintFlood)
      ) {
        spec = GLINT_HALO;
      }
      const px = x0 + i;
      let c: Color;

      if (f >= PENTAGONS) {
        // White leather.
        if (onRim) {
          data[out + i] = tones.rimLeather;
          continue;
        }
        let band: number;
        if (spec >= GLINT_HALO) band = 0;
        else if (l >= LEATHER_STEPS[0]) band = 1;
        else if (l >= LEATHER_STEPS[1]) band = 2;
        else if (l >= LEATHER_STEPS[2]) band = 3;
        else band = 4;
        // By day the grass throws a little light back up into the darkest edge.
        if (band === 4 && nz < bounce) band = 3;
        if (seamBuf[k] === 1) {
          c = seam[band];
          if (stitched) {
            // A stitch every few pixels, counted along the screen from the middle of the
            // seam, so the stitches are evenly spaced and ride with the ball.
            let other = faceBuf[k + 1];
            if (other <= f) other = faceBuf[k + stride];
            if (other <= f) other = faceBuf[k - 1];
            if (other <= f) other = faceBuf[k - stride];
            const ax = VIEW[f * 3];
            const ay = VIEW[f * 3 + 1];
            const az = VIEW[f * 3 + 2];
            const bx = VIEW[other * 3];
            const by = VIEW[other * 3 + 1];
            const bz = VIEW[other * 3 + 2];
            // The middle of the seam, and the way the seam runs there: m x (a - b).
            const mx = ax + bx;
            const my = ay + by;
            const mz = az + bz;
            const tx = my * (az - bz) - mz * (ay - by);
            const ty = mz * (ax - bx) - mx * (az - bz);
            const mid = rad / Math.sqrt(mx * mx + my * my + mz * mz);
            const n =
              Math.abs(tx) >= Math.abs(ty)
                ? px - Math.round(disc.tx + mx * mid)
                : py - Math.round(disc.ty + my * mid);
            if (n % STITCH_EVERY === 0) c = stitch[band];
          }
        } else {
          // The lip of a padded panel, just past a seam, catches the light where it
          // faces it: a bright line beside the dark one is what makes a seam a groove.
          if (
            bevel &&
            band > 0 &&
            band < 3 &&
            (seamBuf[k - 1] === 1 || seamBuf[k - stride] === 1) &&
            px - panelX[f] + (py - panelY[f]) < -bandHalf
          ) {
            band -= 1;
          }
          c = leather[band];
        }
      } else {
        // A black panel.
        if (onRim) {
          data[out + i] = tones.rimBlack;
          continue;
        }
        const si = FACE_SLOT[f];
        const mode = si >= 0 ? slotMode[si] : PLAIN;
        const edge = edgeBuf[k];
        const lb = BLACK_FACE * FACE_LIGHT[f] + (1 - BLACK_FACE) * flat;
        let tone = lb >= BLACK_STEPS[0] ? 0 : lb >= BLACK_STEPS[1] ? 1 : 2;
        if (mode === PLAIN || mode === NORMAL) {
          // A padded panel: its edge catches the light on the side that faces it.
          if (bevel && edge === 1 && tone > 0) {
            const diag = px - panelX[f] + (py - panelY[f]);
            if (diag < -bandHalf) tone -= 1;
          }
          c = black[tone];
          if (spec >= GLINT_CORE) c = blackGlint[1];
          else if (spec >= GLINT_HALO) c = blackGlint[0];
          if (mode === NORMAL) {
            const o = si * 5;
            const diag = px - panelX[f] + (py - panelY[f]);
            const shine = diag - slotShine[si];
            const lit = shine >= -2 && shine <= 2;
            if (edge === ring) {
              c = (
                lit
                  ? slotColor[o + 3]
                  : diag < -bandHalf
                    ? slotColor[o]
                    : diag > bandHalf * 2
                      ? slotColor[o + 2]
                      : slotColor[o + 1]
              ) as Color;
            } else if (lit && edge > ring) {
              // The bar: a bright core with a softer pixel either side.
              c = shineTones[shine >= -1 && shine <= 1 ? 0 : 1];
            }
          }
        } else {
          const o = si * 5;
          const diag = px - panelX[f] + (py - panelY[f]);
          const edgeColor = slotColor[o + 3];
          const inner = slotColor[o + 4];
          if (edge === 1 && edgeColor !== TRANSPARENT) c = edgeColor as Color;
          else if (edge === 2 && inner !== TRANSPARENT) c = inner as Color;
          else if (edge === 2 && mode === PRESSED && diag < -bandHalf) {
            // Pushed in: the lit side's lip now throws a shadow.
            c = edgeColor as Color;
          }
          // The light and dark bands stay in the corners, clear of the label.
          else if (diag < -fillLight) c = slotColor[o] as Color;
          else if (diag > fillDark) c = slotColor[o + 2] as Color;
          else c = slotColor[o + 1] as Color;
        }
      }
      data[out + i] = c;
    }
  }

  for (let i = 0; i < SLOT_COUNT; i++) {
    const patch = patches[SLOTS[i]];
    if (patch) drawContent(s, i, patch, tones);
  }
}

// ---------------------------------------------------------------------------
// Icons, labels and badges: flat, upright, riding on their pentagon, and masked to it so
// they turn out of sight with it.
// ---------------------------------------------------------------------------

/** A small surface that text is stamped into before it is masked onto a patch. */
const STAMP_W = 64;
const STAMP_H = 9;
const stamp = new Surface(STAMP_W, STAMP_H);

/** The index into the buffers of screen pixel (x, y) if it may be drawn on, else -1. */
function spot(
  s: Surface,
  x: number,
  y: number,
  f: number,
  minEdge: number,
): number {
  const i = x - disc.x0;
  const j = y - disc.y0;
  const d = disc.d;
  if (i < 0 || i >= d || j < 0 || j >= d) return -1;
  if (x < s.clipX0 || x >= s.clipX1 || y < s.clipY0 || y >= s.clipY1) return -1;
  const k = (j + 1) * (d + 2) + 1 + i;
  return faceBuf[k] === f && edgeBuf[k] >= minEdge ? k : -1;
}

/** A one-colour sprite with its top left at (x0, y0), only on its own panel. */
function plotSprite(
  s: Surface,
  sp: Sprite,
  x0: number,
  y0: number,
  f: number,
  c: Color,
  minEdge = inkEdge,
): void {
  const cells = sp.frames[0];
  for (let j = 0; j < sp.h; j++) {
    for (let i = 0; i < sp.w; i++) {
      if (cells[j * sp.w + i] === 0) continue;
      if (spot(s, x0 + i, y0 + j, f, minEdge) >= 0) {
        s.data[(y0 + j) * s.w + x0 + i] = c;
      }
    }
  }
}

/**
 * The top left w x h of the stamp at (x0, y0), only on panel `f` (at least `minEdge` in
 * from its edge), or with `f` -1 anywhere on the ball inside its outline.
 */
function plotStamp(
  s: Surface,
  w: number,
  h: number,
  x0: number,
  y0: number,
  f: number,
  minEdge = inkEdge,
): void {
  const d = disc.d;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const v = stamp.data[j * STAMP_W + i];
      if (v === TRANSPARENT) continue;
      const x = x0 + i;
      const y = y0 + j;
      if (f >= 0) {
        if (spot(s, x, y, f, minEdge) < 0) continue;
      } else {
        const a = x - disc.x0;
        const b = y - disc.y0;
        if (a < 0 || a >= d || b < 0 || b >= d) continue;
        if (x < s.clipX0 || x >= s.clipX1 || y < s.clipY0 || y >= s.clipY1) {
          continue;
        }
        if (faceBuf[(b + 1) * (d + 2) + 1 + a] < 0) continue;
      }
      s.data[y * s.w + x] = v;
    }
  }
}

/** How a badge fits in a font `rows` tall: 2 on a plate, 1 as bare figures, 0 not. */
function badgeFit(text: string, opts: TextOptions, rows: number): number {
  const room = roomFor();
  const w = measureText(text, opts);
  if (w + 4 <= room[roomAt(ringAt, 7)] - (rows > 5 ? 2 : 0)) return 2;
  return w <= room[roomAt(ringAt, rows)] ? 1 : 0;
}

function drawContent(
  s: Surface,
  i: number,
  patch: BallPatch,
  tones: Tones,
): void {
  const f = SLOT_FACE[i];
  const facing = VIEW[f * 3 + 2];
  const rad = disc.rad;
  if (facing < FACING_MIN || rad < 20) return;
  const accent = accentOf(patch);
  if (!accent) {
    drawLocked(s, i, f, patch, tones, facing);
    return;
  }
  const mode = slotMode[i];
  const o = i * 5;
  const cx = panelX[f];
  const cy = panelY[f] + (mode === PRESSED ? 1 : 0);
  const ink: Color = mode === CHOSEN ? accent.dark : tones.chalk;

  const icon =
    rad >= ICON_MIN_R && facing >= FACING_ICON
      ? iconFor(patch, bigIcons)
      : null;
  // The icon of an idle button wears its colour.
  const iconInk = mode === NORMAL ? (slotColor[o] as Color) : ink;
  const badge = hasBadge(patch);
  const text = badge ? (patch.badge as string) : patch.label;
  // A badge is news (today's score), so it shows whenever it fits by itself: on a plate
  // when there is room for one, as bare figures when there is not.
  let opts = labelOpts;
  let plate = false;
  if (badge) {
    opts = BIG_DIGITS;
    let fit = bigIcons ? badgeFit(text, opts, 7) : 0;
    if (fit === 0) {
      opts = SMALL_DIGITS;
      fit = badgeFit(text, opts, 5);
    }
    if (fit === 0) opts = null;
    plate = fit === 2;
  }
  if (opts === null || text === "" || facing < FACING_LABEL) {
    if (icon) {
      plotSprite(s, icon, cx - (icon.w >> 1), cy - (icon.h >> 1), f, iconInk);
    }
    return;
  }

  // The label sits on the pentagon's widest rows (it only just fits), centred in what
  // the panel has free there this frame, with the icon above and the tab below.
  const tw = Math.min(STAMP_W - 4, measureText(text, opts));
  const w = plate ? tw + 4 : tw;
  const h = (opts === BIG || opts === BIG_DIGITS ? 7 : 5) + (plate ? 2 : 0);
  const top = icon ? textTop(cy, h) : cy - (h >> 1);
  const free = freeRun(f, cx, top, h, ringAt + 2);
  const left = free > 0 ? runLo + ((free - w) >> 1) : cx - (w >> 1);
  const mid = left + (w >> 1);

  stamp.erase(0, 0, STAMP_W, STAMP_H);
  if (plate) {
    // A score: a chalk plate with dark digits, so it reads as a result, not a name.
    const paper = mode === CHOSEN ? P.white : tones.chalk;
    stamp.rect(1, 0, w - 2, h, paper);
    stamp.rect(0, 1, w, h - 2, paper);
    drawText(stamp, text, 2, 1, slotDeep[i] as Color, opts);
  } else {
    drawText(stamp, text, 0, 0, badge && mode === NORMAL ? iconInk : ink, opts);
  }
  plotStamp(s, w, h, left, top, f);
  if (!icon) return;
  plotSprite(s, icon, mid - (icon.w >> 1), top - 1 - icon.h, f, iconInk);
  if (!plate) {
    // The tab: a little bar in the button's colour.
    const tab =
      mode === NORMAL
        ? (slotColor[o + 1] as Color)
        : mode === CHOSEN
          ? accent.base
          : ink;
    const half = bigIcons ? 5 : 3;
    for (let y = top + h + 2; y < top + h + 4; y++) {
      for (let x = mid - half; x <= mid + half; x++) {
        if (spot(s, x, y, f, inkEdge) >= 0) s.data[y * s.w + x] = tab;
      }
    }
  }
}

/** The row a locked patch's picture and padlock stand in: as tall as the tallest picture. */
const LOCKED_ROW = 8;
/** The same for the small pictures of a squashed patch. */
const SQUASHED_ROW = 5;
/** Locked pictures and words keep this far in from the pentagon's edge (there is no line). */
const LOCKED_EDGE = 2;
/** Rows between the picture and the word on a locked patch. */
const LOCKED_GAP = 2;

/** The top of a locked patch's picture row, with its word under it, on a patch centred on cy. */
function lockedTop(cy: number): number {
  return cy + 1 - ((LOCKED_ROW + LOCKED_GAP + 5) >> 1);
}

/**
 * A locked patch, quiet: its picture with a small padlock at its foot, and under them its
 * word once the patch faces the viewer. A word wider than the patch is written on a dark
 * tag that may run over the seams onto the leather either side. Squashed far round the
 * ball, the patch keeps the picture and the padlock if they fit, and the padlock if not.
 * Below a radius of 30 it shows the padlock only, and below 26 nothing.
 *
 * What it carries is decided by the radius alone (the room measured once per size by
 * `roomFor`, at the far end of the idle rock), never by this frame's pixels, so that it
 * cannot flicker as the ball breathes and rocks.
 */
function drawLocked(
  s: Surface,
  i: number,
  f: number,
  patch: BallPatch,
  tones: Tones,
  facing: number,
): void {
  const rad = disc.rad;
  if (rad < 26) return;
  const room = roomFor();
  const ink = slotMode[i] === LIFTED ? tones.chalk : tones.mist;
  const cx = panelX[f];
  const cy = panelY[f];
  // facing the viewer: the full-size picture and room for the word; squashed far round
  // (the top and bottom of the menu pose, which nods either side of FACING_ICON), the small
  // one, whatever the facing, so that it never comes and goes as the ball breathes
  const facingUs = facing >= FACING_LABEL;
  // (a squashed patch has five rows to spare at the deepest nod: the small padlock)
  const lock = rad >= 40 && facingUs ? ICON_LOCK_MID : ICON_LOCK_SMALL;
  let pic = rad >= 30 ? pictureFor(patch, !facingUs) : null;
  // The picture and its padlock side by side, or the padlock alone.
  const markW = (sp: Sprite | null): number =>
    sp ? sp.w + 1 + ICON_LOCK_SMALL.w : lock.w;
  // (the top, bottom and rim patches are measured where they rest, straight on; the back
  // ones in a side place, where CLOSEST and FURTHEST rest)
  const front = FRONT_FACE[f] === 1;
  const markRoom = front ? ROOM_MARK_FRONT : ROOM_MARK;
  if (pic && markW(pic) > room[facingUs ? markRoom : ROOM_SQUASHED]) {
    pic = null;
  }
  const aw = markW(pic);
  const ah = !pic ? lock.h : facingUs ? LOCKED_ROW : SQUASHED_ROW;

  const word = patch.label !== "" && facingUs ? patch.label : "";
  if (word !== "" && pic) {
    const tw = Math.min(STAMP_W - 4, measureText(word, SMALL));
    const top = lockedTop(cy);
    const run = freeRun(f, cx, top, ah, LOCKED_EDGE);
    const left = run >= aw ? runLo + ((run - aw) >> 1) : cx - (aw >> 1);
    plotLockedMark(s, pic, lock, left, top, ah, f, ink);
    const ty = top + ah + LOCKED_GAP;
    stamp.erase(0, 0, STAMP_W, STAMP_H);
    if (tw <= room[front ? ROOM_WORD_FRONT : ROOM_WORD]) {
      const free = freeRun(f, cx, ty, 5, LOCKED_EDGE);
      const x = free >= tw ? runLo + ((free - tw) >> 1) : cx - (tw >> 1);
      drawText(stamp, word, 0, 0, ink, SMALL);
      plotStamp(s, tw, 5, x, ty, f, LOCKED_EDGE);
      return;
    }
    // the tag: centred under the picture, and moved in as far as it must be to lie whole
    // inside the ball's outline; with no room for it, there is no word
    const w = tw + 4;
    const far = Math.max(
      Math.abs(ty - 1 - disc.ty),
      Math.abs(ty + 5 - disc.ty),
    );
    const half = Math.sqrt(Math.max(0, disc.rad * disc.rad - far * far)) - 2;
    const lo = Math.ceil(disc.tx - half);
    const hi = Math.floor(disc.tx + half) - w + 1;
    if (lo <= hi) {
      const x = clamp(left + (aw >> 1) - (w >> 1), lo, hi);
      stamp.rect(1, 0, w - 2, 7, tones.ink);
      stamp.rect(0, 1, w, 5, tones.ink);
      drawText(stamp, word, 2, 1, ink, SMALL);
      plotStamp(s, w, 7, x, ty - 1, -1, 1);
    }
    return;
  }
  plotLockedMark(s, pic, lock, cx - (aw >> 1), cy - (ah >> 1), ah, f, ink);
}

/** A locked patch's picture with the small padlock at its foot, or the padlock alone. */
function plotLockedMark(
  s: Surface,
  pic: Sprite | null,
  lock: Sprite,
  x: number,
  y: number,
  h: number,
  f: number,
  ink: Color,
): void {
  if (!pic) {
    plotSprite(s, lock, x, y, f, ink, LOCKED_EDGE);
    return;
  }
  const small = ICON_LOCK_SMALL;
  plotSprite(s, pic, x, y + h - pic.h, f, ink, LOCKED_EDGE);
  plotSprite(s, small, x + pic.w + 1, y + h - small.h, f, ink, LOCKED_EDGE);
}

// ---------------------------------------------------------------------------
// Shadow
// ---------------------------------------------------------------------------

/**
 * The ball's shadow on the grass: soft, dithered, falling a little to the right. Draw it
 * before the ball. `groundY` is the row the ball rests on; the higher the ball is above
 * it, the smaller and fainter the shadow.
 */
export function drawBallShadow(
  s: Surface,
  state: BallState,
  groundY: number,
  light: Lighting,
): void {
  const r = state.r;
  if (!(r >= 1) || !Number.isFinite(state.cx + state.cy + r + groundY)) return;
  const height = Math.max(0, groundY - (state.cy + r));
  const k = clamp(1 - height / (r * 4 + 24), 0.3, 1);
  const rx = r * 0.9 * k;
  const ry = Math.max(1, r * 0.2 * k);
  const y = Math.round(groundY);
  const soft = light.lit(P.grassDark);
  const deep = light.lit(P.grassDeep);
  // Daylight throws the shadow to the right. Floodlights stand all round the pitch, so
  // at night it sits under the ball, with a fainter one thrown out to each side.
  const flood = tonesFor(light).flood;
  const x = Math.round(state.cx + (r * 0.16 + height * 0.3) * (1 - flood));
  if (r < 10) {
    s.ellipse(x, y, rx, ry, deep, true, k > 0.6 ? 1 : 0.5);
    return;
  }
  if (flood > 0.5) {
    const off = Math.round(r * 0.28 * k);
    s.ellipse(x - off, y, rx * 0.9, ry * 0.8, soft, true, 0.5);
    s.ellipse(x + off, y, rx * 0.9, ry * 0.8, soft, true, 0.5);
  } else {
    s.ellipse(x, y, rx + 4, ry + 2, soft, true, 0.25);
    s.ellipse(x, y, rx + 2, ry + 1, soft, true, 0.5);
  }
  s.ellipse(x, y, rx, ry, soft, true, k > 0.6 ? 1 : 0.5);
  if (k > 0.6) {
    s.ellipse(x - 1, y, rx * 0.8, ry * 0.72, deep, true, 0.5);
    s.ellipse(x - 2, y, rx * 0.6, ry * 0.5, deep, true);
  }
}

// ---------------------------------------------------------------------------
// Hit testing
// ---------------------------------------------------------------------------

/**
 * Which slot's pentagon is under this pixel, or null. Uses the same panel lookup as the
 * renderer, so what lights up is exactly what was pointed at.
 */
export function ballSlotAt(
  state: BallState,
  x: number,
  y: number,
): BallSlot | null {
  if (!measure(state)) return null;
  const dx = Math.round(x) - disc.tx;
  const dy = Math.round(y) - disc.ty;
  const rad = disc.rad;
  if (!(dx * dx + dy * dy <= rad * rad)) return null;
  orientTo(state);
  const nx = dx / rad;
  const ny = dy / rad;
  const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
  const f = panelAt(nx, ny, nz, 0);
  const i = FACE_SLOT[f];
  return i >= 0 ? SLOTS[i] : null;
}

/**
 * The pose that shows a slot: yaw 0, pitch 0 (the menu pose) for "left" and "right", half
 * a turn about the vertical for "backLeft" and "backRight" (which then sit where "right"
 * and "left" were), and "top", "bottom", "rimLeft" and "rimRight" turned to face the
 * viewer straight on (the rim ones by a quarter turn about the vertical and a tilt down).
 */
export function ballShowPose(slot: BallSlot): {
  yaw: number;
  pitch: number;
  roll: number;
} {
  switch (slot) {
    case "top":
      return { yaw: 0, pitch: -TILT, roll: 0 };
    case "bottom":
      return { yaw: 0, pitch: TILT, roll: 0 };
    case "backLeft":
    case "backRight":
      return { yaw: Math.PI, pitch: 0, roll: 0 };
    case "rimLeft":
      return { yaw: Math.PI / 2, pitch: -RIM_TILT, roll: 0 };
    case "rimRight":
      return { yaw: -Math.PI / 2, pitch: -RIM_TILT, roll: 0 };
    default:
      return { yaw: 0, pitch: 0, roll: 0 };
  }
}

/**
 * Where a slot's pentagon is on screen, and how much it faces the viewer (1 straight on,
 * 0 on the rim, negative on the back).
 */
export function ballSlotCenter(
  state: BallState,
  slot: BallSlot,
): { x: number; y: number; facing: number } {
  const i = SLOT_FACE[SLOT_INDEX[slot]];
  if (!measure(state)) return { x: state.cx, y: state.cy, facing: 0 };
  orientTo(state);
  return {
    x: Math.round(disc.tx + VIEW[i * 3] * disc.rad),
    y: Math.round(disc.ty + VIEW[i * 3 + 1] * disc.rad),
    facing: VIEW[i * 3 + 2],
  };
}
