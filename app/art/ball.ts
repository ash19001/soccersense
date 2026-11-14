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
 * Buttons. A slot with an accent wears it as a coloured line round its pentagon and in its
 * icon, and every five seconds a bar of light crosses HOME and
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
  type Color,
  type Sprite,
  type TextOptions,
} from "~/pixel";
import { ballIcons } from "./ball-icons";
import { paintedFont } from "./lettering";
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
 * A patch's picture. "home" a stadium, "away" an aeroplane, "nextgen" a fast-forward (the
 * future), "retro" a rewind (the past), "pin" a map pin, "globe" a globe, "shirt" the
 * back of a shirt with its number, "goal" a goal with a ball on the spot, "lock" a padlock
 * alone, "none" nothing.
 */
export type BallIcon =
  | "home"
  | "away"
  | "nextgen"
  | "retro"
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

// Many of the ball's choices are made in coarse units of two canvas pixels (a radius, a
// distance in from a panel's edge, a block of text's half height), so that they fall on
// even rows and columns: `rs`, `te`, `minE`, `halfRows`.

/**
 * Half of `rows` (a height) in whole coarse units: the coarse rows halved and rounded
 * down, then doubled, so that a block of text sits on even rows.
 */
function halfRows(rows: number): number {
  return ((rows / 2) >> 1) * 2;
}

/** The radius in coarse units (two pixels each): the sizes below are judged on it. */
function rs(): number {
  return disc.rad / 2;
}

/** The coarse edge distance (1 on the edge) that a distance in pixels lies in. */
function te(edge: number): number {
  return (edge + 1) >> 1;
}

/**
 * The least distance in pixels from a panel's edge for what keeps `e` coarse units in: a
 * clearance of e - 1 coarse units is 2e - 2 pixels, less the half pixel that the panel's
 * own outline loses to rounding (so HOME on the smallest menu ball just fits), and never on
 * the line, which lies at coarse distances 1 or 2 (`te`).
 */
function minE(e: number): number {
  return Math.max(1, 2 * e - 2);
}

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

/**
 * Fill `faceBuf`, `edgeBuf` and `seamBuf` for the current disc and orientation: all of it,
 * or only the disc's rows `from` to `to` (exclusive) for a measurement that reads a few
 * rows (`roomFor`). A band's own first and last rows border on nothing, so only the rows at
 * least `BAND_MARGIN` inside it are as a full rasterisation has them (as far as `freeRun`
 * reads them: panel, outline and edge distances up to `BAND_MARGIN - 2`).
 */
function rasterise(from = 0, to = disc.d, c0 = 0, c1 = disc.d): void {
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
  const j0 = Math.max(0, from);
  const j1 = Math.min(d, to);
  // only the band's rows and the one either side are read (a band of rows is all that
  // `freeRun` reads after a partial rasterisation)
  if (j0 === 0 && j1 === d) faceBuf.fill(OUTSIDE, 0, size);
  else
    faceBuf.fill(
      OUTSIDE,
      Math.max(0, j0) * stride,
      Math.min(size, (j1 + 2) * stride),
    );
  const i0 = Math.max(0, c0);
  const i1 = Math.min(d, c1);

  let rowGuess = 0;
  for (let j = j0; j < j1; j++) {
    const dy = j - half;
    let guess = rowGuess;
    let first = true;
    const row = (j + 1) * stride + 1;
    for (let i = i0; i < i1; i++) {
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
  for (let j = j0; j < j1; j++) {
    const row = (j + 1) * stride + 1;
    for (let i = i0; i < i1; i++) {
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
  for (let j = j0; j < j1; j++) {
    const row = (j + 1) * stride + 1;
    for (let i = i0; i < i1; i++) {
      if (edgeBuf[row + i] === 1) faceBuf[row + i] = OUTLINE;
    }
  }

  // Distance to the nearest other panel, city-block, capped: two chamfer sweeps. The
  // first also marks the seams. A seam is drawn on one side only, in the panel with the
  // lower number, so it is a single pixel wide whichever way it runs.
  for (let j = j0; j < j1; j++) {
    const row = (j + 1) * stride + 1;
    for (let i = i0; i < i1; i++) {
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
  for (let j = j1 - 1; j >= j0; j--) {
    const row = (j + 1) * stride + 1;
    for (let i = i1 - 1; i >= i0; i--) {
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

// The pictures are drawn in ball-icons.ts.

/** A locked patch's picture, full size or squashed, or null for "lock" and "none". */
function pictureFor(patch: BallPatch, small: boolean): Sprite | null {
  const I = ballIcons();
  switch (patch.icon) {
    case "nextgen":
      return small ? I.nextgenSmall : I.nextgen;
    case "retro":
      return small ? I.retroSmall : I.retro;
    case "pin":
      return small ? I.pinSmall : I.pin;
    case "globe":
      return small ? I.globeSmall : I.globe;
    case "shirt":
      return small ? I.shirtSmall : I.shirt;
    case "goal":
      return small ? I.goalSmall : I.goal;
    case "home":
    case "away":
      return small ? null : iconFor(patch, false);
    default:
      return null;
  }
}

function iconFor(patch: BallPatch, big: boolean): Sprite | null {
  const I = ballIcons();
  switch (patch.icon) {
    case "home":
      return big ? I.homeBig : I.home;
    case "away":
      return big ? I.awayBig : I.away;
    case "nextgen":
      return I.nextgen;
    case "retro":
      return I.retro;
    case "pin":
      return I.pin;
    case "globe":
      return I.globe;
    case "shirt":
      return I.shirt;
    case "goal":
      return I.goal;
    case "lock":
      return I.lock;
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
/** Projected centre of each panel, in pixels (see `SLOT_FACE` for the slots). */
const panelX = new Int32Array(FACES);
const panelY = new Int32Array(FACES);
/**
 * Where each panel's contents (picture, word, score) hang: the middle of what the panel
 * shows. Its centre on the sphere lies further out than that, the more so the further the
 * panel faces away (NEXT-GEN's and RETRO's, far round the ball, by 5 pixels at r = 90), and
 * contents put there sat off the middle, out towards the rim (2026-11-13).
 */
const markX = new Int32Array(FACES);
const markY = new Int32Array(FACES);
/**
 * The middle of what a panel shows is this share of the way from the ball's centre to the
 * panel's projected centre: the mean of the panel's pixels, measured, at every size and for
 * the side, top and bottom patches alike (0.93 to 0.95).
 */
const MARK_SHARE = 0.94;

/** Where panel `f`'s contents hang, for the orientation set last (see `markX`). */
function markOf(f: number): [number, number] {
  return [
    Math.round(disc.tx + VIEW[f * 3] * disc.rad * MARK_SHARE),
    Math.round(disc.ty + VIEW[f * 3 + 1] * disc.rad * MARK_SHARE),
  ];
}
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
/**
 * How much room the border leaves the words, in coarse units: 2 (a border three pixels
 * deep, the words at least six in), 1 (two deep, the words four in) or 0 (one deep, the
 * words two in). Text and plates are kept `minE(ringAt + 2)` from the pentagon's edge.
 */
let ringAt = 2;
/**
 * The border of an open patch (a button with an accent): a frame in its mode's colour
 * round the very edge of its pentagon, this many pixels deep (3, 2 or 1, by `ringAt`).
 * Three deep, its outer pixel is the mode's dark tone, so the frame reads against the
 * white leather outside it as well as against the black patch inside it.
 */
let borderW = 3;
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
    // as `markOf`, with no array made every frame
    markX[i] = Math.round(disc.tx + VIEW[i * 3] * disc.rad * MARK_SHARE);
    markY[i] = Math.round(disc.ty + VIEW[i * 3 + 1] * disc.rad * MARK_SHARE);
  }
  for (let i = 0; i < SLOT_COUNT; i++) {
    const slot = SLOTS[i];
    const patch = patches[slot];
    const accent = accentOf(patch);
    const o = i * 5;
    slotShine[i] = NO_SHINE;
    slotMode[i] = PLAIN;
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
      if (Number.isFinite(state.t) && rs() >= 20) {
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

/** Rows between a side patch's picture and its word. */
const ICON_GAP = 2;

/**
 * Top row of a block of text `h` rows tall on a side patch centred on row `cy`: on the
 * pentagon's widest rows, where a word fits best, with the picture above. That leaves the
 * pair high on the patch, so it is moved down (`sideShift`) as far as what is written
 * still fits, at most until the two are centred on the patch (2026-11-13).
 */
function textTop(cy: number, h: number): number {
  return cy + 4 - halfRows(h);
}

/**
 * How far below `textTop` the text goes to centre it and a picture `icon` rows tall over
 * it on the patch: in whole coarse units (even rows), never up.
 */
function centredShift(h: number, icon: number): number {
  const centred = -halfRows(icon + ICON_GAP + h) + icon + ICON_GAP;
  const shift = centred - (4 - halfRows(h));
  return Math.max(0, Math.min(SHIFT_MAX, (shift >> 1) * 2));
}

/** The furthest a side patch's pair is ever moved down (the big picture over small text). */
const SHIFT_MAX = 10;

/** This frame's shift of the side patches' pairs (`chooseLayout`), rows, even. */
let sideShift = 0;

/** The side patches' pictures' height, small or big (HOME's and AWAY's are the same). */
function sideIconRows(big: boolean): number {
  const I = ballIcons();
  return big
    ? Math.max(I.homeBig.h, I.awayBig.h)
    : Math.max(I.home.h, I.away.h);
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
/** The side room again, the text moved down 2, 4, ... SHIFT_MAX rows (`roomAt`). */
const ROOM_SHIFTED = 11;
/** A played side patch's score in its picture's place, over its word (`roomScoreAt`). */
const ROOM_SCORE = ROOM_SHIFTED + (SHIFT_MAX / 2) * 6;
const ROOM_SIZE = ROOM_SCORE + (SHIFT_MAX / 2 + 1) * 3 * 4;
/** The menu's deepest nod, give or take: the squashed room is measured that far each way. */
const SQUASH_NOD = 0.065;

/** Index into a room table: the line's place (0 none, 1 edge, 2 inset), rows of text
 * (10 or 14), and how far below `textTop` the text is (0 to SHIFT_MAX, even). */
function roomAt(ring: number, rows: number, shift = 0): number {
  const at = ring * 2 + (rows > 10 ? 1 : 0);
  return shift <= 0 ? at : ROOM_SHIFTED + ((shift >> 1) - 1) * 6 + at;
}

/**
 * Index into a room table: the width free for a played side patch's score in the place of
 * its picture (`scoreTop`), by the line's place, the score's rows (10 or 14), the word's
 * rows under it (10 or 14), and how far below `textTop` the word is.
 */
function roomScoreAt(
  ring: number,
  scoreRows: number,
  labelRows: number,
  shift: number,
): number {
  return (
    ROOM_SCORE +
    ((shift >> 1) * 3 + ring) * 4 +
    (scoreRows > 10 ? 2 : 0) +
    (labelRows > 10 ? 1 : 0)
  );
}

/**
 * Top row of a played side patch's score: in the middle of where its picture would be,
 * over its word, whose top row is `labelTop` (the picture is `icon` rows tall). So the
 * word stays where it was before the mode was played, and the picture becomes the score
 * (2026-11-13: the patch says what it is and how it went, score over word).
 */
function scoreTop(labelTop: number, icon: number, scoreRows: number): number {
  return labelTop - ICON_GAP - icon + halfRows(icon - scoreRows);
}

/**
 * Rasterise only the band of rows that a measurement of screen rows `top` to `top + rows`
 * reads, with `BAND_MARGIN` rows to spare each side: the same pixels there as a whole
 * rasterisation, for a fraction of the work (the room is measured on about 25 poses for
 * every new size, and in the entrance the ball has a new size every frame).
 */
function rasteriseRows(
  top: number,
  rows: number,
  f = -1,
  x = 0,
  edge = BAND_MARGIN,
): void {
  // A measurement of panel `f` reads edge distances only up to `edge` (its least distance
  // in from the panel's edge): the band needs no more than that to spare (a
  // band's own edge can make a distance no smaller than its distance from it), which is
  // most of the entrance's work saved.
  const margin = f < 0 ? BAND_MARGIN * 2 : Math.max(1, edge + 1);
  const from = top - disc.y0 - margin;
  const to = top - disc.y0 + rows + margin;
  if (f < 0) {
    rasterise(from, to);
    return;
  }
  // Only panel `f`'s columns round `x` are read (`freeRun` keeps to the panel): find how far
  // the panel reaches on these rows and rasterise that much, `margin` columns to spare each
  // side, the same pixels there as a whole rasterisation (a quarter to half of the work:
  // the entrance asks for a new room table every frame).
  const d = disc.d;
  const half = (d - 1) / 2;
  const rad = disc.rad;
  const inv = 1 / rad;
  const ix = x - disc.x0;
  let lo = d;
  let hi = -1;
  const inside = (i: number, dy: number): boolean => {
    const dx = i - half;
    return i >= 0 && i < d && dx * dx + dy * dy <= rad * rad;
  };
  const faceOf = (i: number, dy: number): number => {
    const nx = (i - half) * inv;
    const ny = dy * inv;
    return panelAt(nx, ny, Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny)), f);
  };
  for (
    let j = Math.max(0, top - disc.y0);
    j < Math.min(d, top - disc.y0 + rows);
    j++
  ) {
    const dy = j - half;
    if (!inside(ix, dy) || faceOf(ix, dy) !== f) continue;
    // in steps of four: the run of the panel through x ends within three pixels of the
    // last step that found it, so the window is never short of it (at most 3 px long)
    let a = ix;
    while (inside(a - 4, dy) && faceOf(a - 4, dy) === f) a -= 4;
    let b = ix;
    while (inside(b + 4, dy) && faceOf(b + 4, dy) === f) b += 4;
    if (a - 3 < lo) lo = a - 3;
    if (b + 3 > hi) hi = b + 3;
  }
  if (hi < lo) {
    // the panel is not under x on any of these rows: nothing is free there
    rasterise(from, from);
    return;
  }
  rasterise(from, to, lo - margin, hi + margin + 1);
}

/** See `rasterise`: two more than the deepest edge distance `freeRun` asks for (4). */
const BAND_MARGIN = 6;

function roomFor(): Int16Array {
  const d = disc.d;
  // one table per size and level
  const key = d * 2 + 1;
  let room = roomCache.get(key);
  if (room) return room;
  room = new Int16Array(ROOM_SIZE);
  const rowsS = 10;
  const rowsB = 14;
  const lockedRow = LOCKED_ROW * 2;
  const lockedGap = LOCKED_GAP * 2;
  const squashedRow = SQUASHED_ROW * 2;
  const lockedEdge = minE(LOCKED_EDGE);
  if (rs() >= ICON_MIN_R) {
    orient(ROCK, 0, 0);
    // The far patch is the tight one; the ball is symmetrical, so one end is enough. The
    // text is measured at its place on the widest rows and at each step down from there.
    const [x, y] = markOf(1);
    const topS = textTop(y, rowsS);
    const topB = textTop(y, rowsB);
    // a played patch's score, in its picture's place over the word
    const icon = sideIconRows(rs() >= BIG_ICON_R);
    const from = Math.min(topS, topB) - ICON_GAP - icon;
    rasteriseRows(
      from,
      Math.max(topS + rowsS, topB + rowsB) + SHIFT_MAX - from,
      1,
      x,
      minE(4),
    );
    for (let shift = 0; shift <= SHIFT_MAX; shift += 2) {
      for (let ring = 0; ring <= 2; ring++) {
        const edge = minE(ring + 2);
        room[roomAt(ring, rowsS, shift)] = freeRun(
          1,
          x,
          topS + shift,
          rowsS,
          edge,
        );
        room[roomAt(ring, rowsB, shift)] = freeRun(
          1,
          x,
          topB + shift,
          rowsB,
          edge,
        );
        for (const scoreRows of [rowsS, rowsB]) {
          for (const [labelTop, labelRows] of [
            [topS, rowsS],
            [topB, rowsB],
          ]) {
            room[roomScoreAt(ring, scoreRows, labelRows, shift)] = freeRun(
              1,
              x,
              scoreTop(labelTop + shift, icon, scoreRows),
              scoreRows,
              edge,
            );
          }
        }
      }
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
        const [sx, sy] = markOf(1);
        const top = lockedTop(sy);
        rasteriseRows(top, lockedRow + lockedGap + rowsS, 1, sx, lockedEdge);
        mark = Math.min(mark, freeRun(1, sx, top, lockedRow, lockedEdge));
        word = Math.min(
          word,
          freeRun(1, sx, top + lockedRow + lockedGap, rowsS, lockedEdge),
        );
        for (const f of [2, 3]) {
          const [px, py] = markOf(f);
          rasteriseRows(
            py - halfRows(squashedRow),
            squashedRow,
            f,
            px,
            lockedEdge,
          );
          const run = freeRun(
            f,
            px,
            py - halfRows(squashedRow),
            squashedRow,
            lockedEdge,
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
            const [px, py] = markOf(f);
            const top = lockedTop(py);
            rasteriseRows(
              top,
              lockedRow + lockedGap + rowsS,
              f,
              px,
              lockedEdge,
            );
            frontMark = Math.min(
              frontMark,
              freeRun(f, px, top, lockedRow, lockedEdge),
            );
            frontWord = Math.min(
              frontWord,
              freeRun(f, px, top + lockedRow + lockedGap, rowsS, lockedEdge),
            );
          }
        }
      }
    }
    room[ROOM_MARK_FRONT] = frontMark;
    room[ROOM_WORD_FRONT] = frontWord;
  }
  if (roomCache.size > 400) roomCache.clear();
  roomCache.set(key, room);
  return room;
}

interface LabelFonts {
  SMALL: TextOptions;
  SMALL_DIGITS: TextOptions;
  BIG: TextOptions;
  BIG_DIGITS: TextOptions;
}

let fonts: LabelFonts | undefined;

/** The labels' faces: the painted ones (~/art/lettering), made on first use. */
function labelFonts(): LabelFonts {
  if (fonts === undefined) {
    const small = paintedFont(FONT_3x5);
    const big = paintedFont(FONT_5x7);
    fonts = {
      SMALL: { font: small },
      SMALL_DIGITS: { font: small, tabular: true },
      BIG: { font: big },
      BIG_DIGITS: { font: big, tabular: true },
    };
  }
  return fonts;
}

/**
 * How far down the side patches' pairs go this frame (`textTop`): the same for both, so
 * they stay level, and as far towards centred as what each writes still fits, in the font
 * and with the line where `chooseLayout` put them (a score is narrower than a word, and
 * goes further). The fonts are chosen as before, on the widest rows.
 */
function sideShiftFor(patches: BallPatches, room: Int16Array): number {
  if (labelOpts === null || rs() < ICON_MIN_R) return 0;
  const F = labelFonts();
  const icon = sideIconRows(bigIcons);
  let best = SHIFT_MAX;
  for (let i = 0; i < SLOT_COUNT; i++) {
    const patch = patches[SLOTS[i]];
    if (!patch || !accentOf(patch) || FRONT_FACE[SLOT_FACE[i]] === 1) continue;
    let text = patch.label;
    let opts: TextOptions | null = labelOpts;
    const labelRows = labelOpts === F.BIG ? 14 : 10;
    // a played patch's score over its word, in the small figures at least
    let scoreW = -1;
    if (hasBadge(patch)) {
      const badge = patch.badge as string;
      if (scoreOver(badge, labelRows, 0) !== null) {
        scoreW = measureText(badge, F.SMALL_DIGITS);
      } else {
        // the figures `drawContent` will pick, in the word's place
        text = badge;
        opts =
          bigIcons && badgeFits(text, F.BIG_DIGITS, 14)
            ? F.BIG_DIGITS
            : badgeFits(text, F.SMALL_DIGITS, 10)
              ? F.SMALL_DIGITS
              : null;
      }
    }
    if (opts === null || text === "") continue;
    const rows = opts === F.BIG || opts === F.BIG_DIGITS ? 14 : 10;
    const w = measureText(text, opts);
    let shift = 0;
    while (
      shift + 2 <= centredShift(rows, icon) &&
      w <= room[roomAt(ringAt, rows, shift + 2)] &&
      scoreW <= room[roomScoreAt(ringAt, 10, rows, shift + 2)]
    ) {
      shift += 2;
    }
    best = Math.min(best, shift);
  }
  return best;
}

/**
 * The figures a played side patch's score is written in, in its picture's place over its
 * word (`labelRows` tall, `shift` below `textTop`), or null if neither size fits there.
 */
function scoreOver(
  text: string,
  labelRows: number,
  shift: number,
): TextOptions | null {
  if (!playedWords || labelOpts === null || rs() < ICON_MIN_R) return null;
  const F = labelFonts();
  const room = roomFor();
  if (
    bigIcons &&
    measureText(text, F.BIG_DIGITS) <=
      room[roomScoreAt(ringAt, 14, labelRows, shift)]
  ) {
    return F.BIG_DIGITS;
  }
  if (
    measureText(text, F.SMALL_DIGITS) <=
    room[roomScoreAt(ringAt, 10, labelRows, shift)]
  ) {
    return F.SMALL_DIGITS;
  }
  return null;
}

/**
 * Pick the line's place and the label font for this frame (see `ringAt`). Words matter
 * more than the line: on a small ball the line moves out to the pentagon's edge, and on
 * a smaller one still it goes, to leave the label room.
 */
function chooseLayout(patches: BallPatches, room: Int16Array): void {
  const F = labelFonts();
  // The widest label in each font, of every side button and of the ones not played yet,
  // and the widest score in small figures.
  let small = 0;
  let big = 0;
  let openSmall = 0;
  let openBig = 0;
  let score = 0;
  for (let i = 0; i < SLOT_COUNT; i++) {
    const patch = patches[SLOTS[i]];
    // the side buttons (a locked patch has its own layout: see `drawLocked`; so do the
    // buttons on the top and the bottom: see `drawFront`)
    if (!patch || !accentOf(patch) || FRONT_FACE[SLOT_FACE[i]] === 1) continue;
    const played = hasBadge(patch);
    if (played) {
      score = Math.max(
        score,
        measureText(patch.badge as string, F.SMALL_DIGITS),
      );
    }
    if (patch.label !== "") {
      const s = measureText(patch.label, F.SMALL);
      const b = measureText(patch.label, F.BIG);
      small = Math.max(small, s);
      big = Math.max(big, b);
      if (!played) {
        openSmall = Math.max(openSmall, s);
        openBig = Math.max(openBig, b);
      }
    }
  }
  bigIcons = rs() >= BIG_ICON_R;
  // A played button keeps its word, with the score over it (`drawContent`), where the
  // words fit; where they do not, it shows its picture and score, as before 2026-11-13.
  pickWords(small, big, score, room);
  playedWords = labelOpts !== null;
  if (!playedWords && score > 0) pickWords(openSmall, openBig, score, room);
  sideShift = sideShiftFor(patches, room);
  inkEdge = Math.max(2, ringAt + 1);
  borderW = ringAt + 1;
}

/**
 * Whether the played side buttons write their words this frame, their scores over them
 * (`chooseLayout`).
 */
let playedWords = false;

/** The label font and the line's place for words this wide (see `chooseLayout`). */
function pickWords(
  small: number,
  big: number,
  score: number,
  room: Int16Array,
): void {
  const F = labelFonts();
  const rowsS = 10;
  const rowsB = 14;
  labelOpts = F.SMALL;
  ringAt = 2;
  if (rs() < ICON_MIN_R) {
    // Too small for anything but the line, which then sits on the edge.
    labelOpts = null;
    ringAt = 1;
  } else if (bigIcons && big <= room[roomAt(2, rowsB)]) {
    labelOpts = F.BIG;
  } else {
    // Step the line out, and then off, until the words and the scores fit. If a score
    // never does, the words alone decide (the score is then left off: see `drawContent`).
    let ring = 2;
    while (
      ring >= 0 &&
      (small > room[roomAt(ring, rowsS)] || score > room[roomAt(ring, rowsS)])
    ) {
      ring--;
    }
    if (ring < 0) {
      ring = 2;
      while (ring >= 0 && small > room[roomAt(ring, rowsS)]) ring--;
    }
    if (ring < 0) labelOpts = null;
    else ringAt = ring;
  }
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
  // Detail comes in with size (art bible: no dither or fuss on anything small). Sizes are
  // judged in coarse units (`r1`).
  const r1 = rs();
  const dome = r1 >= 20 ? DOME : 0.25;
  const stitched = r1 >= 30;
  const bevel = r1 >= 30;
  const glintDot = r1 >= 30 ? GLINT_DOT : 2;
  const glintFlood = tones.flood > 0.6 && r1 >= 20 ? GLINT_FLOOD : 2;
  // The grass's bounce light: the outer 2 px of the darkest band.
  const bounce = r1 >= 20 ? Math.sqrt(1 - (1 - 4.4 / rad) ** 2) : 0;
  // Floodlights behind the ball catch its far edge: a crisp rim just inside the outline,
  // one to three pixels wide as the lights come up and the ball gets bigger.
  const flood = tones.flood;
  const rimW =
    flood <= 0.25
      ? 0
      : ((flood < 0.6 ? 1 : 2) + (r1 >= 40 ? 1 : 0) - (r1 < 20 ? 1 : 0)) * 2;
  // The seams are grooves one pixel fine, and the stitches on them are dashes two pixels
  // long.
  const stitchEvery = STITCH_EVERY * 2;
  const stitchLong = 2;
  // The bar of light that crosses an idle button: its half-width and its core's.
  const shineHalf = 4;
  const shineCore = 2;
  const rimIn = rimW > 0 ? (rad - 1 - rimW) * inv : 2;
  const rimIn2 = rimIn * rimIn;
  // A patch is banded on the diagonal through its centre: clean 45 degree steps.
  const bandHalf = Math.max(2, Math.round(rad * 0.13));
  const fillLight = Math.round(rad * 0.29);
  const fillDark = Math.round(rad * 0.3);
  const ring = ringAt;
  const border = borderW;

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
            if (((n % stitchEvery) + stitchEvery) % stitchEvery < stitchLong) {
              c = stitch[band];
            }
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
        // in coarse units: the line and the lips are two pixels wide
        const edge = te(edgeBuf[k]);
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
            const lit = shine >= -shineHalf && shine <= shineHalf;
            const px1 = edgeBuf[k];
            if (px1 <= border) {
              // the frame: lit on the side that faces the light, its outer pixel dark when
              // it is three deep
              c = (
                lit
                  ? slotColor[o + 3]
                  : border >= 3 && px1 === 1
                    ? slotColor[o + 2]
                    : diag < -bandHalf
                      ? slotColor[o]
                      : diag > bandHalf * 2
                        ? slotColor[o + 2]
                        : slotColor[o + 1]
              ) as Color;
            } else if (lit && edge > ring) {
              // The bar: a bright core with a softer pixel either side.
              c = shineTones[shine >= -shineCore && shine <= shineCore ? 0 : 1];
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
const STAMP_W = 128;
const STAMP_H = 18;
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
  minEdge = minE(inkEdge),
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
  minEdge = minE(inkEdge),
): void {
  const d = disc.d;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const v = stamp.data[j * stamp.w + i];
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

/** Whether a badge fits as bare figures in a font `rows` tall. */
function badgeFits(text: string, opts: TextOptions, rows: number): boolean {
  return measureText(text, opts) <= roomFor()[roomAt(ringAt, rows)];
}

function drawContent(
  s: Surface,
  i: number,
  patch: BallPatch,
  tones: Tones,
): void {
  const f = SLOT_FACE[i];
  const facing = VIEW[f * 3 + 2];
  if (facing < FACING_MIN || rs() < 20) return;
  const accent = accentOf(patch);
  if (!accent) {
    drawLocked(s, i, f, patch, tones, facing);
    return;
  }
  if (FRONT_FACE[f] === 1) {
    // a button on the top or the bottom (NEXT-GEN, RETRO): laid out like a locked patch
    drawFront(s, i, f, patch, tones, facing, accent);
    return;
  }
  const mode = slotMode[i];
  const o = i * 5;
  const cx = markX[f];
  const cy = markY[f] + (mode === PRESSED ? 2 : 0);
  const ink: Color = mode === CHOSEN ? accent.dark : tones.chalk;

  const icon =
    rs() >= ICON_MIN_R && facing >= FACING_ICON
      ? iconFor(patch, bigIcons)
      : null;
  // The icon of an idle button wears its colour.
  const iconInk = mode === NORMAL ? (slotColor[o] as Color) : ink;
  const F = labelFonts();
  // A badge is news (today's score): bare figures in the button's colour, as NEXT-GEN's
  // and RETRO's are (no plate: the product owner, 2026-11-13, so that all four scores look
  // alike). It takes the picture's place over the word, so the patch still says which mode
  // it is (2026-11-13); where it cannot, it takes the word's place under the picture, and
  // shows whenever it fits there by itself.
  let text = patch.label;
  let opts = labelOpts;
  let score: TextOptions | null = null;
  if (hasBadge(patch)) {
    if (icon && labelOpts !== null && text !== "") {
      const rows = labelOpts === F.BIG ? 14 : 10;
      score = scoreOver(
        patch.badge as string,
        rows,
        Math.min(sideShift, centredShift(rows, icon.h)),
      );
    }
    if (score === null) {
      text = patch.badge as string;
      opts = F.BIG_DIGITS;
      if (!bigIcons || !badgeFits(text, opts, 14)) {
        opts = F.SMALL_DIGITS;
        if (!badgeFits(text, opts, 10)) opts = null;
      }
    }
  }
  if (opts === null || text === "" || facing < FACING_LABEL) {
    if (icon) {
      plotSprite(s, icon, cx - (icon.w >> 1), cy - (icon.h >> 1), f, iconInk);
    }
    return;
  }

  // The label sits on the pentagon's widest rows (it only just fits), centred in what
  // the panel has free there this frame, with the icon above. (There was a tab under it, a
  // bar in the button's colour: gone 2026-11-13, as NEXT-GEN's and RETRO's never had one.)
  const w = Math.min(stamp.w - 8, measureText(text, opts));
  const h = (opts === F.BIG || opts === F.BIG_DIGITS ? 7 : 5) * 2;
  const top = icon
    ? textTop(cy, h) + Math.min(sideShift, centredShift(h, icon.h))
    : cy - halfRows(h);
  const free = freeRun(f, cx, top, h, minE(ringAt + 2));
  const left = free > 0 ? runLo + ((free - w) >> 1) : cx - (w >> 1);
  const mid = left + (w >> 1);
  const figures = opts === F.BIG_DIGITS || opts === F.SMALL_DIGITS;

  stamp.erase(0, 0, stamp.w, stamp.h);
  drawText(stamp, text, 0, 0, figures && mode === NORMAL ? iconInk : ink, opts);
  plotStamp(s, w, h, left, top, f);
  if (!icon) return;
  if (score === null) {
    plotSprite(
      s,
      icon,
      mid - (icon.w >> 1),
      top - ICON_GAP - icon.h,
      f,
      iconInk,
    );
    return;
  }
  // The score where the picture was: over the word's middle, kept inside what the patch
  // has free on its rows.
  const sw = measureText(patch.badge as string, score);
  const sh = (score === F.BIG_DIGITS ? 7 : 5) * 2;
  const sTop = scoreTop(top, icon.h, sh);
  const sFree = freeRun(f, cx, sTop, sh, minE(ringAt + 2));
  let sLeft = mid - (sw >> 1);
  if (sFree >= sw) {
    sLeft = Math.max(runLo, Math.min(runLo + sFree - sw, sLeft));
  }
  stamp.erase(0, 0, stamp.w, stamp.h);
  drawText(stamp, patch.badge as string, 0, 0, iconInk, score);
  plotStamp(s, sw, sh, sLeft, sTop, f);
}

/**
 * A plate (a word's tag) on the stamp, `w` by `h`, with clipped corners: a 45
 * degree chamfer of two pixels.
 */
function plateShape(w: number, h: number, c: Color): void {
  stamp.rect(2, 0, w - 4, h, c);
  stamp.rect(1, 1, w - 2, h - 2, c);
  stamp.rect(0, 2, w, h - 4, c);
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
  return cy + 2 - halfRows((LOCKED_ROW + LOCKED_GAP + 5) * 2);
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
  const rad = rs();
  if (rad < 26) return;
  const room = roomFor();
  const I = ballIcons();
  const F = labelFonts();
  const edge = minE(LOCKED_EDGE);
  const rowsS = 10;
  const ink = slotMode[i] === LIFTED ? tones.chalk : tones.mist;
  const cx = markX[f];
  const cy = markY[f];
  // facing the viewer: the full-size picture and room for the word; squashed far round
  // (the top and bottom of the menu pose, which nods either side of FACING_ICON), the small
  // one, whatever the facing, so that it never comes and goes as the ball breathes
  const facingUs = facing >= FACING_LABEL;
  // (a squashed patch has five rows to spare at the deepest nod: the small padlock)
  const lock = rad >= 40 && facingUs ? I.lockMid : I.lockSmall;
  let pic = rad >= 30 ? pictureFor(patch, !facingUs) : null;
  // The picture and its padlock side by side, or the padlock alone.
  const markW = (sp: Sprite | null): number =>
    sp ? sp.w + 2 + I.lockSmall.w : lock.w;
  // (the top, bottom and rim patches are measured where they rest, straight on; the back
  // ones in a side place, where CLOSEST and FURTHEST rest)
  const front = FRONT_FACE[f] === 1;
  const markRoom = front ? ROOM_MARK_FRONT : ROOM_MARK;
  if (pic && markW(pic) > room[facingUs ? markRoom : ROOM_SQUASHED]) {
    pic = null;
  }
  const aw = markW(pic);
  const ah = !pic ? lock.h : (facingUs ? LOCKED_ROW : SQUASHED_ROW) * 2;

  const word = patch.label !== "" && facingUs ? patch.label : "";
  if (word !== "" && pic) {
    const tw = Math.min(stamp.w - 8, measureText(word, F.SMALL));
    const top = lockedTop(cy);
    const run = freeRun(f, cx, top, ah, edge);
    const left = run >= aw ? runLo + ((run - aw) >> 1) : cx - (aw >> 1);
    plotLockedMark(s, pic, lock, left, top, ah, f, ink);
    const ty = top + ah + LOCKED_GAP * 2;
    stamp.erase(0, 0, stamp.w, stamp.h);
    if (tw <= room[front ? ROOM_WORD_FRONT : ROOM_WORD]) {
      const free = freeRun(f, cx, ty, rowsS, edge);
      const x = free >= tw ? runLo + ((free - tw) >> 1) : cx - (tw >> 1);
      drawText(stamp, word, 0, 0, ink, F.SMALL);
      plotStamp(s, tw, rowsS, x, ty, f, edge);
      return;
    }
    // the tag: centred under the picture, and moved in as far as it must be to lie whole
    // inside the ball's outline; with no room for it, there is no word
    const w = tw + 8;
    const far = Math.max(
      Math.abs(ty - 2 - disc.ty),
      Math.abs(ty + rowsS - disc.ty),
    );
    const half = Math.sqrt(Math.max(0, disc.rad * disc.rad - far * far)) - 4;
    const lo = Math.ceil(disc.tx - half);
    const hi = Math.floor(disc.tx + half) - w + 1;
    if (lo <= hi) {
      const x = clamp(left + (aw >> 1) - (w >> 1), lo, hi);
      plateShape(w, 14, tones.ink);
      drawText(stamp, word, 4, 2, ink, F.SMALL);
      plotStamp(s, w, 14, x, ty - 2, -1, 1);
    }
    return;
  }
  plotLockedMark(s, pic, lock, cx - (aw >> 1), cy - (ah >> 1), ah, f, ink);
}

/**
 * A button on the top or the bottom of the ball (NEXT-GEN, RETRO): framed like HOME and
 * AWAY, but laid out like a locked patch, with no padlock and in its mode's colour. In the
 * menu pose it is squashed far round the ball and carries its small picture (or today's
 * score, when that fits); shown straight on, its full picture with its word (or the score)
 * under it. As for a locked patch, what it carries is decided by the radius alone, never by
 * this frame's pixels.
 */
function drawFront(
  s: Surface,
  i: number,
  f: number,
  patch: BallPatch,
  tones: Tones,
  facing: number,
  accent: NonNullable<BallPatch["accent"]>,
): void {
  const rad = rs();
  if (rad < 26) return;
  const room = roomFor();
  const F = labelFonts();
  const mode = slotMode[i];
  const o = i * 5;
  // clear of the frame
  const edge = Math.max(minE(LOCKED_EDGE), borderW + 1);
  const rowsS = 10;
  const ink: Color =
    mode === NORMAL
      ? (slotColor[o] as Color)
      : mode === CHOSEN
        ? accent.dark
        : tones.chalk;
  const cx = markX[f];
  const cy = markY[f] + (mode === PRESSED ? 2 : 0);
  const facingUs = facing >= FACING_LABEL;
  const badge = hasBadge(patch) ? (patch.badge as string) : "";
  let pic = rad >= 30 ? pictureFor(patch, !facingUs) : null;
  if (pic && pic.w > room[facingUs ? ROOM_MARK_FRONT : ROOM_SQUASHED]) {
    pic = null;
  }

  if (!facingUs) {
    // squashed: today's score if it fits the picture's row, else the small picture
    if (badge !== "") {
      const tw = measureText(badge, F.SMALL_DIGITS);
      if (tw <= room[ROOM_SQUASHED]) {
        stamp.erase(0, 0, stamp.w, stamp.h);
        drawText(stamp, badge, 0, 0, ink, F.SMALL_DIGITS);
        plotStamp(s, tw, rowsS, cx - (tw >> 1), cy - (rowsS >> 1), f, edge);
        return;
      }
    }
    if (pic) {
      plotSprite(s, pic, cx - (pic.w >> 1), cy - (pic.h >> 1), f, ink, edge);
    }
    return;
  }

  // straight on: the picture, and under it the word or the score
  const ah = LOCKED_ROW * 2;
  const top = lockedTop(cy);
  if (pic) {
    const run = freeRun(f, cx, top, ah, edge);
    const left =
      run >= pic.w ? runLo + ((run - pic.w) >> 1) : cx - (pic.w >> 1);
    plotSprite(s, pic, left, top + ah - pic.h, f, ink, edge);
  }
  const word = badge !== "" ? badge : patch.label;
  if (word === "") return;
  const opts = badge !== "" ? F.SMALL_DIGITS : F.SMALL;
  const ty = top + ah + LOCKED_GAP * 2;
  const tw = Math.min(stamp.w - 8, measureText(word, opts));
  stamp.erase(0, 0, stamp.w, stamp.h);
  if (tw <= room[ROOM_WORD_FRONT]) {
    const free = freeRun(f, cx, ty, rowsS, edge);
    const x = free >= tw ? runLo + ((free - tw) >> 1) : cx - (tw >> 1);
    drawText(stamp, word, 0, 0, ink, opts);
    plotStamp(s, tw, rowsS, x, ty, f, edge);
    return;
  }
  // wider than the patch: on a dark tag across the seams, whole inside the ball
  const w = tw + 8;
  const far = Math.max(
    Math.abs(ty - 2 - disc.ty),
    Math.abs(ty + rowsS - disc.ty),
  );
  const half = Math.sqrt(Math.max(0, disc.rad * disc.rad - far * far)) - 4;
  const lo = Math.ceil(disc.tx - half);
  const hi = Math.floor(disc.tx + half) - w + 1;
  if (lo > hi) return;
  const x = clamp(cx - (w >> 1), lo, hi);
  plateShape(w, 14, tones.ink);
  drawText(stamp, word, 4, 2, ink, opts);
  plotStamp(s, w, 14, x, ty - 2, -1, 1);
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
  const edge = minE(LOCKED_EDGE);
  if (!pic) {
    plotSprite(s, lock, x, y, f, ink, edge);
    return;
  }
  const small = ballIcons().lockSmall;
  plotSprite(s, pic, x, y + h - pic.h, f, ink, edge);
  plotSprite(s, small, x + pic.w + 2, y + h - small.h, f, ink, edge);
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
  const k = clamp(1 - height / (r * 4 + 48), 0.3, 1);
  const rx = r * 0.9 * k;
  const ry = Math.max(2, r * 0.2 * k);
  const y = Math.round(groundY);
  const soft = light.lit(P.grassDark);
  const deep = light.lit(P.grassDeep);
  // Daylight throws the shadow to the right. Floodlights stand all round the pitch, so
  // at night it sits under the ball, with a fainter one thrown out to each side.
  const flood = tonesFor(light).flood;
  const x = Math.round(state.cx + (r * 0.16 + height * 0.3) * (1 - flood));
  if (r < 20) {
    s.ellipse(x, y, rx, ry, deep, true, k > 0.6 ? 1 : 0.5);
    return;
  }
  if (flood > 0.5) {
    const off = Math.round(r * 0.28 * k);
    s.ellipse(x - off, y, rx * 0.9, ry * 0.8, soft, true, 0.5);
    s.ellipse(x + off, y, rx * 0.9, ry * 0.8, soft, true, 0.5);
  } else {
    s.ellipse(x, y, rx + 8, ry + 4, soft, true, 0.25);
    s.ellipse(x, y, rx + 4, ry + 2, soft, true, 0.5);
  }
  s.ellipse(x, y, rx, ry, soft, true, k > 0.6 ? 1 : 0.5);
  if (k > 0.6) {
    s.ellipse(x - 2, y, rx * 0.8, ry * 0.72, deep, true, 0.5);
    s.ellipse(x - 4, y, rx * 0.6, ry * 0.5, deep, true);
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
