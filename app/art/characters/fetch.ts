/**
 * The fetch: the few frames the career scene needs to
 * bring the last shot's ball back to the hero between questions, when the answer did not
 * bring a promotion (`~/scenes/career.ts`, "The fetch").
 *
 * - The keeper (tiers 2 to 7), 24 x 36 in a 32 x 40 cell, anchor column 16, soles row 38:
 *   `keeperPick` (stooped over the ball, then rising with it), `keeperCarry` (walking with
 *   it held to his chest, four steps), `keeperRoll` (the underarm roll out: swung back, the
 *   release low in front, the follow-through).
 * - The ball kid (tiers 2 to 7, a youth in a sky-blue bib), 20 x 28 in a 28 x 32
 *   cell, anchor column 14, soles row 30: `kidPick` (stooped, then the ball to his chest)
 *   and `kidThrow` (both hands, over his head: behind it, over the top, let go).
 *
 * Everyone else the fetch uses has the frames already (run, kick, the keeper's ready).
 * Facing right, as every person; `flipX` mirrors. Fill only, outlined by `figure()`, in
 * `LEGEND`, coloured by `kitColors`. The keeper is painted on a copy of package C's
 * rig (keeper.ts: long sleeves to a dark cuff, the big gloves), the ball kid on B2's
 * youth rig (youth-shots.ts), so both are the same men as in every other frame.
 *
 * Every frame is built once, on first use.
 */

import { drawSprite, type Sprite, type Surface } from "~/pixel";
import type { Era } from "../era";
import { PARTS } from "./adult";
import { eraFrames } from "./era-frames";
import { nextgenBallKidKit } from "./nextgen";
import { retroBallKidKit } from "./retro";
import { figure, frames } from "./figure";
import { P } from "../palette";
import { kitColors, makeKit, type Kit } from "./kit";
import type { AnimInfo, Spot } from "./people";
import { paintYouthPose, type YouthPose } from "./youth-shots";

// ---------------------------------------------------------------------------
// The paint grid (after A2's rig)
// ---------------------------------------------------------------------------

type Pt = readonly [number, number];

class Grid {
  readonly c: string[];
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.c = new Array<string>(w * h).fill(".");
  }
  set(x: number, y: number, ch: string): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) {
      throw new Error(`fetch: pixel outside the cell at ${x},${y}`);
    }
    this.c[y * this.w + x] = ch;
  }
  text(): string {
    const out: string[] = [];
    for (let y = 0; y < this.h; y++) {
      out.push(this.c.slice(y * this.w, (y + 1) * this.w).join(""));
    }
    return out.join("\n");
  }
}

/** A layer's pixels before they are laid down: index -> letter. */
type Layer = Map<number, string>;

/** The line a near limb leaves on what it crosses: that thing's shade, or ink. */
const CREASE: Readonly<Record<string, string>> = {
  t: "T",
  U: "T",
  r: "R",
  p: "q",
  s: "S",
  l: "S",
  o: "O",
  g: "G",
  w: "G",
  h: "k",
  H: "h",
};

/**
 * Lay a layer on the grid. With `edge`, where it crosses something already drawn the
 * pixels it touches there become a line that keeps it in front (`CREASE`, or `edge`).
 */
function lay(
  g: Grid,
  layer: Layer,
  edge?: string,
  edgeable?: ReadonlySet<number>,
): void {
  if (edge !== undefined) {
    const marks: number[] = [];
    for (const i of layer.keys()) {
      if (edgeable !== undefined && !edgeable.has(i)) continue;
      const was = g.c[i];
      if (was === "." || was === ",") continue;
      const x = i % g.w;
      const y = (i - x) / g.w;
      for (const [nx, ny] of [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ] as const) {
        if (nx < 0 || ny < 0 || nx >= g.w || ny >= g.h) continue;
        const j = ny * g.w + nx;
        if (layer.has(j)) continue;
        const c = g.c[j];
        if (c !== "." && c !== ",") marks.push(j);
      }
    }
    for (const j of marks) g.c[j] = CREASE[g.c[j]] ?? edge;
  }
  for (const [i, ch] of layer) {
    const x = i % g.w;
    const y = (i - x) / g.w;
    g.set(x, y, ch);
  }
}

/** Which side of a stroke a pixel is on: -1 lit, 1 shaded, 0 between; `s` along it. */
type Ink = (s: number, side: -1 | 0 | 1) => string | null;

/**
 * A stroke through `pts` with radius `r` (one per point, linear between): every pixel
 * whose centre is within the radius of the polyline (pixel (x, y) is centred on (x, y)).
 */
function stroke(
  g: Grid,
  pts: readonly Pt[],
  r: readonly number[],
  ink: Ink,
  edgeFrom = 0,
  edgeable?: Set<number>,
): Layer {
  const layer: Layer = new Map();
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    cum.push(cum[i - 1] + Math.hypot(bx - ax, by - ay));
  }
  const rMax = Math.max(...r);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x0 = Math.floor(Math.min(...xs) - rMax);
  const x1 = Math.ceil(Math.max(...xs) + rMax);
  const y0 = Math.floor(Math.min(...ys) - rMax);
  const y1 = Math.ceil(Math.max(...ys) + rMax);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      let best = Infinity;
      let bs = 0;
      let bo = 0;
      let br = 0;
      for (let i = 1; i < pts.length; i++) {
        const [ax, ay] = pts[i - 1];
        const [bx, by] = pts[i];
        const dx = bx - ax;
        const dy = by - ay;
        const len2 = dx * dx + dy * dy;
        let t = len2 === 0 ? 0 : ((x - ax) * dx + (y - ay) * dy) / len2;
        t = Math.min(1, Math.max(0, t));
        const qx = ax + t * dx;
        const qy = ay + t * dy;
        const d = Math.hypot(x - qx, y - qy);
        const ri = r[i - 1] + (r[i] - r[i - 1]) * t;
        if (d - ri < best) {
          best = d - ri;
          bs = cum[i - 1] + t * Math.sqrt(len2);
          const len = Math.sqrt(len2) || 1;
          let nx = -dy / len;
          let ny = dx / len;
          if (nx + ny * 1.2 < 0) {
            nx = -nx;
            ny = -ny;
          }
          bo = (x - qx) * nx + (y - qy) * ny;
          br = ri;
        }
      }
      if (best > 1e-9) continue;
      const side = bo > br - 0.95 ? 1 : bo < -(br - 0.95) ? -1 : 0;
      const ch = ink(bs, side);
      if (ch === null) continue;
      layer.set(y * g.w + x, ch);
      if (bs >= edgeFrom) edgeable?.add(y * g.w + x);
    }
  }
  return layer;
}

// ---------------------------------------------------------------------------
// The keeper
// ---------------------------------------------------------------------------

interface Leg {
  readonly hip: Pt;
  readonly knee: Pt;
  readonly ankle: Pt;
  readonly heel: Pt;
  readonly toe: Pt;
}

interface Arm {
  readonly shoulder: Pt;
  readonly elbow: Pt;
  readonly hand: Pt;
}

type HeadKind = "side" | "down" | "up" | "bowed" | "sideL";

interface Pose {
  /** The top of the shirt's middle (the base of the neck) and the waist's middle. */
  readonly neck: Pt;
  readonly waist: Pt;
  readonly head: HeadKind;
  /** The head part's top-left corner, if not the default place over the neck. */
  readonly headAt?: Pt;
  /** -1 when he has turned to face left. */
  readonly facing?: 1 | -1;
  readonly near: Leg;
  readonly far: Leg;
  readonly nearArm: Arm;
  readonly farArm: Arm;
  /** The head goes on after the near arm (an arm behind the head is drawn first). */
  readonly headLast?: boolean;
}

// Along a leg: the shorts' leg, the bare knee, the sock's turnover, the sock.
const SHORTS_LEG = 2.2;
const PAST_KNEE = 0.6;
const TURNOVER = 1.6;

function legInk(near: boolean, thigh: number): Ink {
  const shorts = Math.min(SHORTS_LEG, thigh - 1.2);
  return (s, side) => {
    const sh = side === 1 || !near;
    if (s < shorts) return sh ? "q" : "p";
    if (s < thigh + PAST_KNEE) return sh ? "S" : side === -1 ? "l" : "s";
    if (s < thigh + TURNOVER) return sh ? "R" : "r";
    return sh ? "O" : "o";
  };
}

/** Long sleeves to a dark cuff at the wrist (the glove covers the hand). */
function armInk(near: boolean, len: number): Ink {
  return (s, side) => {
    const sh = side === 1 || !near;
    if (s < len - 1.7) return sh ? "T" : side === -1 && s < 3 ? "U" : "t";
    return sh ? "R" : "r";
  };
}

function bootInk(near: boolean, len: number): Ink {
  return (s, side) => {
    if (near && side === -1 && s > len * 0.45) return "B";
    return "b";
  };
}

function paintLeg(g: Grid, leg: Leg, near: boolean, edge?: string): void {
  const edgeable = new Set<number>();
  const limb = stroke(
    g,
    [leg.hip, leg.knee, leg.ankle],
    [1.7, 1.35, 1.15],
    legInk(
      near,
      Math.hypot(leg.knee[0] - leg.hip[0], leg.knee[1] - leg.hip[1]),
    ),
    SHORTS_LEG + 0.5,
    edgeable,
  );
  const len = Math.hypot(leg.toe[0] - leg.heel[0], leg.toe[1] - leg.heel[1]);
  const boot = stroke(g, [leg.heel, leg.toe], [0.95, 0.95], bootInk(near, len));
  for (const [i, ch] of boot) {
    limb.set(i, ch);
    edgeable.add(i);
  }
  lay(g, limb, edge, edgeable);
}

/**
 * A glove: 4 x 4 round the hand (a hand on a half pixel), lit palm on the top left, shade
 * down the bottom right; the far glove in shade with a lit edge.
 */
function glove(g: Grid, c: Pt, near: boolean): Layer {
  const layer: Layer = new Map();
  const r = 2.3;
  for (let y = Math.floor(c[1] - r); y <= Math.ceil(c[1] + r); y++) {
    for (let x = Math.floor(c[0] - r); x <= Math.ceil(c[0] + r); x++) {
      const ox = x - c[0];
      const oy = y - c[1];
      if (ox * ox + oy * oy > r * r + 0.3) continue;
      const lean = ox + oy * 1.2;
      let ch: string;
      if (near) ch = lean < -1.4 ? "w" : lean > 1.4 ? "G" : "g";
      else ch = lean < -1.4 ? "g" : "G";
      layer.set(y * g.w + x, ch);
    }
  }
  return layer;
}

function paintArm(g: Grid, arm: Arm, near: boolean, edge?: string): void {
  const edgeable = new Set<number>();
  const len =
    Math.hypot(arm.elbow[0] - arm.shoulder[0], arm.elbow[1] - arm.shoulder[1]) +
    Math.hypot(arm.hand[0] - arm.elbow[0], arm.hand[1] - arm.elbow[1]);
  const limb = stroke(
    g,
    [arm.shoulder, arm.elbow, arm.hand],
    [1.35, 1.1, 1.0],
    armInk(near, len),
    2,
    edgeable,
  );
  for (const [i, ch] of glove(g, arm.hand, near)) {
    limb.set(i, ch);
    edgeable.add(i);
  }
  lay(g, limb, edge, edgeable);
}

/**
 * The body as spans across the line from the neck to the waist, sheared rather than
 * turned: rows when he is more upright than flat, columns when he lies flat.
 */
function bodySpans(
  g: Grid,
  neck: Pt,
  waist: Pt,
  facing: 1 | -1,
  t0: number,
  t1: number,
  half: (u: number) => number,
  paint: (u: number, v: number, w: number, half: number) => string | null,
): Layer {
  const layer: Layer = new Map();
  const ax = waist[0] - neck[0];
  const ay = waist[1] - neck[1];
  const len = Math.hypot(ax, ay);
  const upright = Math.abs(ay) >= Math.abs(ax);
  const chest = Math.sign(upright ? ay * facing : -ax * facing) || 1;
  const along = upright ? ay : ax;
  const a0 = upright ? neck[1] : neck[0];
  const first = Math.round(a0 + t0 * along);
  const last = Math.round(a0 + t1 * along);
  const step = last >= first ? 1 : -1;
  for (let i = first; step > 0 ? i <= last : i >= last; i += step) {
    const t = (i - a0) / along;
    const u = t * len;
    const c = upright ? neck[0] + t * ax : neck[1] + t * ay;
    const h = half(u);
    for (let o = Math.floor(c - h); o <= Math.ceil(c + h); o++) {
      const off = o - c;
      if (Math.abs(off) > h) continue;
      const ch = paint(u, off * chest, off, h);
      if (ch === null) continue;
      const x = upright ? o : i;
      const y = upright ? i : o;
      layer.set(y * g.w + x, ch);
    }
  }
  return layer;
}

/** The shirt: the collar at the front of its top, a lit shoulder, the shaded side, a badge. */
function paintTorso(g: Grid, neck: Pt, waist: Pt, facing: 1 | -1): void {
  const len = Math.hypot(waist[0] - neck[0], waist[1] - neck[1]);
  const layer = bodySpans(
    g,
    neck,
    waist,
    facing,
    0,
    1,
    (u) => 5 - (0.5 * Math.max(0, u)) / len,
    (u, v, w, half) => {
      if (u < 0.5 && Math.abs(v) > half - 1) return null;
      if (u < 0.5 && v > -0.5 && v < 3.5) return "r";
      if (u < 1.5 && v > 1.5 && v < 3.5) return "r";
      if (u >= 3.5 && u < 4.5 && v > 1 && v < 3.5) return "r";
      if (w > half - 1.5 || u > len - 0.5) return "T";
      if (u < 1.5 && w > -4.5 && w < -1.5) return "U";
      return "t";
    },
  );
  lay(g, layer);
}

function paintShorts(g: Grid, neck: Pt, waist: Pt, facing: 1 | -1): void {
  const len = Math.hypot(waist[0] - neck[0], waist[1] - neck[1]);
  const layer = bodySpans(
    g,
    neck,
    waist,
    facing,
    1,
    1 + 2.5 / len,
    () => 5.5,
    (_u, _v, w) => (w > 3.5 ? "q" : "p"),
  );
  lay(g, layer);
}

function rowsOf(art: string): string[] {
  return art
    .split("\n")
    .map((r) => r.trim())
    .filter((r) => r !== "");
}

// The heads: A1's (adult.ts), facing right; and turned to face left (A2's turn of the
// same head: the fringe catches the light, the ear is in shade).
const HEADS: Record<HeadKind, readonly string[]> = {
  side: PARTS.HEAD,
  down: PARTS.HEAD_DOWN,
  up: PARTS.HEAD_UP,
  bowed: PARTS.HEAD_BOWED,
  sideL: rowsOf(`
......hhhhhhh...
....hhHHhhhhhhh.
...hHHhhhhhhhhhh
...hhhhhhhhhhhhh
...ssshhhhhhhhhh
...ssssshhhhhhhh
...smmmsshhhhhhh
...sskssSShhhhhh
..ssskssmShhhhhh
.sssssssSShhhhhh
...mmssssShhhhh.
....sssssSShhh..
......sssSS.....
`),
};

function paintRows(
  g: Grid,
  rows: readonly string[],
  x0: number,
  y0: number,
): void {
  const layer: Layer = new Map();
  rows.forEach((line, dy) => {
    for (let dx = 0; dx < line.length; dx++) {
      const ch = line[dx];
      if (ch === ".") continue;
      layer.set((y0 + dy) * g.w + x0 + dx, ch);
      if (x0 + dx < 0 || x0 + dx >= g.w || y0 + dy < 0 || y0 + dy >= g.h) {
        throw new Error(
          `fetch: head outside the cell at ${x0 + dx},${y0 + dy}`,
        );
      }
    }
  });
  lay(g, layer);
}

/** Paint one frame of the rig into a `w` x `h` cell. */
function paintPose(pose: Pose, w = 32, h = 40): string {
  const g = new Grid(w, h);
  const facing = pose.facing ?? 1;
  paintArm(g, pose.farArm, false);
  paintLeg(g, pose.far, false);
  paintTorso(g, pose.neck, pose.waist, facing);
  paintLeg(g, pose.near, true, "k");
  paintShorts(g, pose.neck, pose.waist, facing);
  const head = HEADS[pose.head];
  const at = pose.headAt ?? [
    facing === 1 ? Math.floor(pose.neck[0]) - 5 : Math.ceil(pose.neck[0]) - 10,
    Math.round(pose.neck[1]) - 13,
  ];
  if (pose.headLast !== true) paintRows(g, head, at[0], at[1]);
  paintArm(g, pose.nearArm, true, "k");
  if (pose.headLast === true) paintRows(g, head, at[0], at[1]);
  return g.text();
}

const L = (hip: Pt, knee: Pt, ankle: Pt, heel: Pt, toe: Pt): Leg => ({
  hip,
  knee,
  ankle,
  heel,
  toe,
});
const A = (shoulder: Pt, elbow: Pt, hand: Pt): Arm => ({
  shoulder,
  elbow,
  hand,
});

// ---------------------------------------------------------------------------
// The keeper's fetch (cell 32 x 40, anchor column 16, soles row 38; the ball's centre is
// its spot: a ball on the grass is row 36, spot y -4)
// ---------------------------------------------------------------------------

/** Stooped over the ball at his toes, a glove behind it and one on top; up with it. */
const KEEPER_PICK: readonly Pose[] = [
  {
    neck: [18.5, 24.5],
    waist: [9.5, 26.5],
    head: "down",
    headAt: [13, 16],
    near: L([10.5, 28.5], [13.5, 33], [12.5, 36.5], [11, 37.5], [15, 37.5]),
    far: L([8.5, 28.5], [8.5, 33], [7.5, 36.5], [6, 37.5], [10, 37.5]),
    nearArm: A([18, 26.5], [19.5, 31], [20.5, 35]),
    farArm: A([16, 25.5], [20.5, 28.5], [24, 32]),
    headLast: true,
  },
  {
    neck: [17, 21],
    waist: [14, 28.5],
    head: "down",
    near: L([16, 30], [19.5, 33.5], [18.5, 36.5], [17.5, 37.5], [21.5, 37.5]),
    far: L([12, 30], [10, 33.5], [10.5, 36.5], [9, 37.5], [13, 37.5]),
    nearArm: A([19.5, 22.5], [20, 27.5], [23, 30.5]),
    farArm: A([13.5, 22.5], [18.5, 24.5], [23.5, 23.5]),
  },
];

/** Walking with it held to his chest (his hold, stepping): stride, pass, stride, pass. */
const KEEPER_CARRY: readonly Pose[] = [
  {
    neck: [14.5, 18.5],
    waist: [14.5, 26.5],
    head: "side",
    near: L([16.5, 28.5], [19, 32], [21, 35.5], [20.5, 37.5], [24.5, 37.5]),
    far: L([12, 28.5], [10.5, 32], [8, 35], [6.5, 36.5], [10, 37.5]),
    nearArm: A([18.5, 20], [19, 25.5], [22, 26.5]),
    farArm: A([11, 20], [16, 21.5], [22, 18.5]),
  },
  {
    neck: [14.5, 18],
    waist: [14.5, 26],
    head: "side",
    near: L([16, 28], [16.5, 32], [16, 35.5], [15, 37.5], [19, 37.5]),
    far: L([13, 28], [14.5, 31.5], [13, 34.5], [12, 36], [15.5, 36.5]),
    nearArm: A([18.5, 19.5], [19, 25], [22, 26]),
    farArm: A([11, 19.5], [16, 21], [22, 18]),
  },
  {
    neck: [14.5, 18.5],
    waist: [14.5, 26.5],
    head: "side",
    near: L([16, 28.5], [14, 32], [11.5, 35], [10, 36.5], [13.5, 37.5]),
    far: L([12.5, 28.5], [15.5, 32], [17.5, 35.5], [17, 37.5], [21, 37.5]),
    nearArm: A([18.5, 20], [19, 25.5], [22, 26.5]),
    farArm: A([11, 20], [16, 21.5], [22, 18.5]),
  },
  {
    neck: [14.5, 18],
    waist: [14.5, 26],
    head: "side",
    near: L([16, 28], [17, 31.5], [15.5, 34.5], [14.5, 36], [18, 36.5]),
    far: L([12.5, 28], [12.5, 32], [12.5, 35.5], [11, 37.5], [15, 37.5]),
    nearArm: A([18.5, 19.5], [19, 25], [22, 26]),
    farArm: A([11, 19.5], [16, 21], [22, 18]),
  },
];

/**
 * The roll out, bowled underarm: the ball swung back past his hip on a step; down into
 * the lunge, let go low in front of him (**release, frame 1**); the follow-through.
 */
const KEEPER_ROLL: readonly Pose[] = [
  {
    neck: [16.5, 21],
    waist: [14.5, 28.5],
    head: "side",
    near: L([16, 30], [13.5, 33.5], [11, 36], [9.5, 37.5], [13.5, 37.5]),
    far: L([13, 30], [17.5, 33], [20, 35.5], [19.5, 37.5], [23.5, 37.5]),
    nearArm: A([17, 22.5], [13.5, 26.5], [9.5, 28.5]),
    farArm: A([14, 22], [18.5, 24], [22.5, 23]),
  },
  {
    neck: [19.5, 24.5],
    waist: [13.5, 29.5],
    head: "down",
    headAt: [14, 12],
    near: L([14, 31.5], [10.5, 35], [6, 36.5], [4, 35.5], [5, 37.5]),
    far: L([13, 31.5], [18.5, 33], [19.5, 36.5], [18.5, 37.5], [22.5, 37.5]),
    nearArm: A([20, 26], [22, 30.5], [22.5, 34.5]),
    farArm: A([17.5, 25.5], [14, 28.5], [10, 29]),
  },
  {
    neck: [17.5, 22],
    waist: [14, 29],
    head: "side",
    near: L([15, 30.5], [12, 34], [8, 36], [6.5, 36], [8, 37.5]),
    far: L([13, 30.5], [18, 33], [19, 36.5], [18, 37.5], [22, 37.5]),
    nearArm: A([19.5, 23.5], [23, 25.5], [27, 25]),
    farArm: A([15.5, 23], [12, 26], [9, 28]),
  },
];

// ---------------------------------------------------------------------------
// The ball kid (cell 28 x 32, anchor column 14, soles row 30)
// ---------------------------------------------------------------------------

const YL = (
  hip: Pt,
  knee: Pt,
  ankle: Pt,
  heel: Pt,
  toe: Pt,
): YouthPose["near"] => ({ hip, knee, ankle, heel, toe });
const YA = (shoulder: Pt, elbow: Pt, hand: Pt): YouthPose["nearArm"] => ({
  shoulder,
  elbow,
  hand,
});

/** Bent over the ball at his feet, both hands to it; up with it held to his chest. */
const KID_PICK: readonly YouthPose[] = [
  {
    neck: [17.5, 20],
    waist: [12, 22.5],
    head: "down",
    headAt: [14, 11],
    near: YL([14, 24], [18, 25.5], [16.5, 28.5], [15.5, 29.5], [19, 29.5]),
    far: YL([11, 24], [8.5, 26.5], [9, 28.5], [7.5, 29.5], [11, 29.5]),
    nearArm: YA([18, 21], [19.5, 24], [19.5, 27]),
    farArm: YA([16, 20.5], [19.5, 23], [23.5, 25]),
  },
  {
    neck: [13.5, 16],
    waist: [13.5, 21.5],
    head: "down",
    near: YL([15.5, 23], [16.5, 26], [16.5, 28.5], [15.5, 29.5], [19, 29.5]),
    far: YL([11.5, 23], [11.5, 26], [11.5, 28.5], [10, 29.5], [12.5, 29.5]),
    nearArm: YA([16, 17], [16.5, 20.5], [18.5, 21.5]),
    farArm: YA([11, 17], [15, 17.5], [19.5, 15]),
  },
];

/**
 * The throw, both hands, as a throw-in: the ball behind his head, leaning back; over the
 * top; let go (**release, frame 2**), arms following it.
 */
const KID_THROW: readonly YouthPose[] = [
  {
    neck: [11.5, 16.5],
    waist: [14, 22],
    head: "up",
    near: YL([15, 23.5], [17.5, 26], [18.5, 28.5], [17.5, 29.5], [21, 29.5]),
    far: YL([12, 23.5], [10.5, 26], [8.5, 28.5], [7, 29.5], [10.5, 29.5]),
    nearArm: YA([13.5, 17.5], [10.5, 12], [7.5, 8]),
    farArm: YA([10.5, 17.5], [8, 12.5], [5.5, 8.5]),
  },
  {
    neck: [14.5, 16],
    waist: [13.5, 21.5],
    head: "side",
    near: YL([15, 23], [17.5, 26], [18.5, 28.5], [17.5, 29.5], [21, 29.5]),
    far: YL([12, 23], [10.5, 26], [8.5, 28.5], [7, 29.5], [10.5, 29.5]),
    nearArm: YA([16.5, 17], [18, 11.5], [18.5, 6.5]),
    farArm: YA([13.5, 17], [15, 11.5], [16, 6.5]),
  },
  {
    neck: [16, 16.5],
    waist: [13.5, 22],
    head: "side",
    near: YL([15.5, 23.5], [18, 26], [18.5, 28.5], [17.5, 29.5], [21, 29.5]),
    far: YL([12, 23.5], [10.5, 26], [8.5, 28.5], [7, 29.5], [10.5, 29.5]),
    nearArm: YA([18, 18], [21.5, 18.5], [25, 18.5]),
    farArm: YA([15, 17.5], [19, 17], [23, 16.5]),
  },
];

// ---------------------------------------------------------------------------
// The animations, their sprites and the ball's spots
// ---------------------------------------------------------------------------

export type FetchAnim =
  "keeperPick" | "keeperCarry" | "keeperRoll" | "kidPick" | "kidThrow";

export const FETCH_ANIMS: Readonly<Record<FetchAnim, AnimInfo>> = {
  keeperPick: { frames: 2, fps: 6, loop: false },
  keeperCarry: { frames: 4, fps: 8, loop: true },
  keeperRoll: { frames: 3, fps: 8, loop: false },
  kidPick: { frames: 2, fps: 6, loop: false },
  kidThrow: { frames: 3, fps: 8, loop: false },
};

export const FETCH_ANIM_NAMES = Object.keys(FETCH_ANIMS) as FetchAnim[];

/** The youth's 28 x 32 cell, or the adult's 32 x 40. */
export function fetchCell(anim: FetchAnim): { cellW: number; cellH: number } {
  return anim.startsWith("kid")
    ? { cellW: 28, cellH: 32 }
    : { cellW: 32, cellH: 40 };
}

const ART: Readonly<Record<FetchAnim, () => string>> = {
  keeperPick: () => frames(KEEPER_PICK.map((q) => paintPose(q))),
  keeperCarry: () => frames(KEEPER_CARRY.map((q) => paintPose(q))),
  keeperRoll: () => frames(KEEPER_ROLL.map((q) => paintPose(q))),
  kidPick: () => frames(KID_PICK.map((q) => paintYouthPose(q))),
  kidThrow: () => frames(KID_THROW.map((q) => paintYouthPose(q))),
};

const sprites: Record<Era, Partial<Record<FetchAnim, Sprite>>> = {
  today: {},
  retro: {},
  nextgen: {},
};

/** The sprite of a fetch animation in an era (built on first use; today by default). */
export function fetchSprite(anim: FetchAnim, era: Era = "today"): Sprite {
  const cache = sprites[era];
  let sp = cache[anim];
  if (sp === undefined) {
    const cell = fetchCell(anim);
    const text = eraFrames(era, "fetch", anim, ART[anim]());
    sp = figure(text, cell.cellW, cell.cellH, `fetch ${anim}`);
    cache[anim] = sp;
  }
  return sp;
}

function frameOf(anim: FetchAnim, frame: number): number {
  const info = FETCH_ANIMS[anim];
  const f = Math.floor(frame);
  if (!Number.isFinite(f)) return 0;
  if (info.loop) return ((f % info.frames) + info.frames) % info.frames;
  return Math.min(Math.max(f, 0), info.frames - 1);
}

const DRAW = { flipX: false, anchor: "bottom-center" as const };

/** Draw a fetch frame: `(x, y)` is the ground point under his feet, as `drawPlayer`. */
export function drawFetch(
  s: Surface,
  anim: FetchAnim,
  frame: number,
  x: number,
  y: number,
  kit: Kit,
  opts?: { flipX?: boolean },
): void {
  DRAW.flipX = opts?.flipX === true;
  drawSprite(
    s,
    fetchSprite(anim, kit.era ?? "today"),
    frameOf(anim, frame),
    x,
    y,
    kitColors(kit),
    DRAW,
  );
}

/**
 * The ball kid's kit: a sky-blue bib with white trim and socks, slate shorts, brown hair,
 * the first skin. Not the gold of the near side's seated ball kids (the stadium's): he
 * stands a stride from the keeper, who is in gold at every tier, and must not read as a
 * second keeper.
 */
export function ballKidKit(era: Era = "today"): Kit {
  if (era === "retro")
    return retroBallKidKit(makeKit("casual", { look: 0, era }));
  if (era === "nextgen")
    return nextgenBallKidKit(makeKit("casual", { look: 0, era }));
  return {
    ...makeKit("casual", { look: 0, era }),
    shirt: P.skyMid,
    shirtShade: P.skyTop,
    trim: P.chalk,
    shorts: P.slate,
    socks: P.chalk,
    boots: P.night,
  };
}

const at = (x: number, y: number) => ({ x, y });

/**
 * Where the ball's centre is, frame by frame, facing right (the 6 x 6 ball centred on it:
 * a flipped spot is `-x`). Null where he no longer has it.
 */
const BALL: Readonly<Record<FetchAnim, readonly Spot[]>> = {
  keeperPick: [at(9, -4), at(7, -11)],
  keeperCarry: [at(6, -17), at(6, -18), at(6, -17), at(6, -18)],
  keeperRoll: [at(-7, -9), at(8, -4), null],
  kidPick: [at(8, -4), at(5, -13)],
  kidThrow: [at(-8, -26), at(3, -29), null],
};

/**
 * The ball's spot in a fetch frame, facing right (flipped, it is `-x`), or null once it
 * has gone. The table's own object: read it, never change it.
 */
export function fetchBall(anim: FetchAnim, frame: number): Spot {
  return BALL[anim][frameOf(anim, frame)] ?? null;
}
