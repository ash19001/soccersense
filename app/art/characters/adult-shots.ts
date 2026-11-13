/**
 * The adult footballer's shots (tap in, toe poke, trivela, chip, power, finesse,
 * bicycle): 24 x 36 in a 32 x 40 cell (the bicycle 48 x 56, anchor column 24, soles'
 * outline row 55), facing right, drawn with `LEGEND` (figure.ts).
 *
 * How the frames are made. A shot is a run of strong poses, and every pose is the same man:
 * one head (adult.ts's hand-drawn heads, and three more angles for the bicycle), one shirt, one
 * pair of shorts, the same limbs. So each frame is painted from a small rig: the shirt is
 * sheared along the line from the neck to the waist (rows stay clean when he leans);
 * arms and legs are strokes through their joints (shoulder, elbow, hand; hip, knee,
 * ankle) two or three pixels thick, coloured along their length (sleeve, cuff, forearm;
 * the shorts' leg, bare knee, sock turnover, sock) and shaded on the side away from the
 * light (the top left); boots are short strokes from heel to toe with a lit toecap. The
 * result is fill-only art like every other frame: `figure()` adds the 1 px ink outline.
 *
 * Near and far. He faces right; the near side is the one toward us. Near limbs are lit
 * (`s`, `o`, `t`, `p`) and drawn last, with a 1 px ink line where they cross something
 * already drawn; far limbs are in shade (`S`, `O`, `T`, `q`) and drawn first. The
 * kicking leg is the near leg, and the arm opposite it (the far arm) swings forward.
 *
 * Every frame is built once, on first use (`ADULT_SHOTS` holds functions), so nothing
 * here runs at load time.
 */

import { PARTS } from "./adult";
import { frames, type ArtRecord } from "./figure";
import type { ShotAnim } from "./people";

// ---------------------------------------------------------------------------
// The paint grid
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
  get(x: number, y: number): string {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return ".";
    return this.c[y * this.w + x];
  }
  set(x: number, y: number, ch: string): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) {
      throw new Error(`adult-shots: pixel outside the cell at ${x},${y}`);
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

/**
 * The line a near limb leaves on what it crosses: that thing's own shade (a shirt's
 * shade on the shirt, the shorts' on the shorts), or ink where it is shaded already.
 */
const CREASE: Readonly<Record<string, string>> = {
  t: "T",
  U: "T",
  r: "R",
  p: "q",
  s: "S",
  l: "S",
  o: "O",
  h: "k",
  H: "h",
};

/**
 * Lay a layer on the grid. With `edge`, where the layer crosses something already drawn
 * (a near arm over the shirt, the near leg over the far one), the pixels it touches there
 * become a line that keeps the near limb in front: `CREASE` of what is there, or `edge`
 * (ink) where that is shaded already. `edgeable` (default: every pixel) limits which of
 * the layer's pixels draw that line (not the top of a thigh, which grows out of the
 * shorts).
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
      if (was === "." || was === ",") continue; // only where it crosses
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

// ---------------------------------------------------------------------------
// Strokes: limbs through their joints
// ---------------------------------------------------------------------------

/**
 * Which side of a stroke a pixel is on: -1 the lit edge (toward the top left), 1 the
 * shaded edge, 0 between. `s` is the distance along the stroke from its first point.
 */
type Ink = (s: number, side: -1 | 0 | 1) => string | null;

/**
 * Paint a stroke through `pts` with radius `r` (one per point, linear between): every
 * pixel whose centre is within the radius of the polyline. Pixel (x, y) has its centre at
 * (x, y), so a joint on a whole number makes an odd width and one on a half an even width.
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
          // The shaded side's normal points down and to the right.
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
// The man
// ---------------------------------------------------------------------------

/** A leg: hip, knee, ankle, and the boot from heel to toe. */
export interface Leg {
  readonly hip: Pt;
  readonly knee: Pt;
  readonly ankle: Pt;
  readonly heel: Pt;
  readonly toe: Pt;
}

/** An arm: shoulder, elbow, hand. */
export interface Arm {
  readonly shoulder: Pt;
  readonly elbow: Pt;
  readonly hand: Pt;
}

type HeadKind =
  "side" | "down" | "up" | "shout" | "bowed" | "sideL" | "upL" | "lie";

/** One frame of the rig. */
export interface Pose {
  /** The top of the shirt's middle (the base of the neck) and the waist's middle. */
  readonly neck: Pt;
  readonly waist: Pt;
  readonly head: HeadKind;
  /** The head part's top-left corner, if not the default place over the neck. */
  readonly headAt?: Pt;
  /** -1 when he faces left (his chest, collar and badge to the left); default 1. */
  readonly facing?: 1 | -1;
  readonly near: Leg;
  readonly far: Leg;
  readonly nearArm: Arm;
  readonly farArm: Arm;
  /**
   * How much the painter lengthens the arms (default `ARM_REACH`: the shots' poses were
   * set with short arms); 1 paints them exactly as given (the moves, adult.ts).
   */
  readonly reach?: number;
}

// Along a leg: the shorts' leg (from the hip), then the bare knee up to just past the
// knee joint, the sock's turnover, the sock (measured from the knee, so a stretched leg
// shows more thigh, not a sock over its knee). Along an arm from the shoulder: the
// sleeve, the cuff, the forearm.
const SHORTS_LEG = 2.2;
const PAST_KNEE = 0.6;
const TURNOVER = 1.6;
const SLEEVE = 2.6;
const CUFF = 3.4;

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

function armInk(near: boolean): Ink {
  return (s, side) => {
    const sh = side === 1 || !near;
    if (s < SLEEVE) return sh ? "T" : "t";
    if (s < CUFF) return sh ? "R" : "r";
    return sh ? "S" : "s";
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
 * How much longer an arm is than the joints a pose gives (the poses were set with short
 * arms; the arm keeps its directions and reaches as far as the idle's hanging arm).
 */
const ARM_REACH = 1.5;

/** The arm's joints at full length: each segment of the pose's arm, longer by `ARM_REACH`. */
function reach(arm: Arm, k = ARM_REACH): Arm {
  const [sx, sy] = arm.shoulder;
  const ex = sx + (arm.elbow[0] - sx) * k;
  const ey = sy + (arm.elbow[1] - sy) * k;
  return {
    shoulder: arm.shoulder,
    elbow: [ex, ey],
    hand: [
      ex + (arm.hand[0] - arm.elbow[0]) * k,
      ey + (arm.hand[1] - arm.elbow[1]) * k,
    ],
  };
}

/**
 * A hand: a fist a little wider than the wrist, longer along the forearm than across it,
 * with its knuckles' edge (the side away from the light) in shade.
 */
function fist(
  g: Grid,
  from: Pt,
  at: Pt,
  near: boolean,
  hi = "s",
  lo = "S",
): Layer {
  const dx = at[0] - from[0];
  const dy = at[1] - from[1];
  const len = Math.hypot(dx, dy) || 1;
  const tip: Pt = [at[0] + (dx / len) * 0.9, at[1] + (dy / len) * 0.9];
  return stroke(g, [at, tip], [1.05, 1.05], (_s, side) =>
    near && side !== 1 ? hi : lo,
  );
}

function paintArm(
  g: Grid,
  pose: Arm,
  near: boolean,
  edge?: string,
  most = ARM_REACH,
): void {
  // As long as the cell allows (its outline must stay inside it).
  for (let k = most; ; k -= 0.1) {
    const arm = reach(pose, Math.max(1, k));
    const edgeable = new Set<number>();
    const limb = stroke(
      g,
      [arm.shoulder, arm.elbow, arm.hand],
      [1.3, 1.05, 0.95],
      armInk(near),
      2,
      edgeable,
    );
    for (const [i, ch] of fist(g, arm.elbow, arm.hand, near)) {
      limb.set(i, ch);
      edgeable.add(i);
    }
    if (k > 1 && !inside(g, arm)) continue;
    lay(g, limb, edge, edgeable);
    return;
  }
}

/** True when the arm's pixels leave room for their outline inside the cell. */
function inside(g: Grid, arm: Arm): boolean {
  const [ex, ey] = arm.elbow;
  const [hx, hy] = arm.hand;
  const len = Math.hypot(hx - ex, hy - ey) || 1;
  const tip: Pt = [hx + ((hx - ex) / len) * 0.9, hy + ((hy - ey) / len) * 0.9];
  const r = 1.1;
  return [arm.elbow, arm.hand, tip].every(
    ([x, y]) => x > r && y > r && x + r < g.w - 1 && y + r < g.h - 1,
  );
}

/**
 * Paint the body as spans across the line from the neck to the waist, sheared rather than
 * turned (so a leaning shirt keeps clean rows): rows when he is more upright than flat,
 * columns when he lies flat (the bicycle). The line runs on past the waist for `t` above
 * 1. `paint(u, v, w, half)` gets the distance down the body `u`, the offset toward his
 * chest `v` and toward the shade `w` (away from the light at the top left).
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
  // Along the span, which way is his chest (he faces right: the chest is to the right of
  // the line down his body) and which way is the shade (right, or down when he lies).
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

/**
 * The shirt: 10 wide at the shoulders, 9 at the waist, with the collar at the front of its
 * top, a lit shoulder, the shaded side and hem, and a small badge on the chest.
 */
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
      if (u < 0.5 && Math.abs(v) > half - 1) return null; // round shoulders
      if (u < 0.5 && v > -0.5 && v < 3.5) return "r"; // collar
      if (u < 1.5 && v > 1.5 && v < 3.5) return "r";
      if (u >= 3.5 && u < 4.5 && v > 1 && v < 3.5) return "r"; // badge
      if (w > half - 1.5 || u > len - 0.5) return "T";
      // the light on the shoulder: a line along its top and down the lit edge
      if (u >= 0.5 && u < 1.5 && w > -half + 0.5 && w < -1.5) return "U";
      if (u >= 0.5 && u < 3.5 && w < -half + 1) return "U";
      return "t";
    },
  );
  lay(g, layer);
}

/** The shorts: a band below the waist, shaded on the side away from the light. */
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

/**
 * The shorts' side stripe in the shirt's colour (it reads on every kit, white shorts
 * too): down the side of the near leg of the shorts, from the waistband to the hem.
 */
function paintStripe(g: Grid, leg: Leg, waist: Pt): void {
  const [hx, hy] = leg.hip;
  const dx = leg.knee[0] - hx;
  const dy = leg.knee[1] - hy;
  const len = Math.hypot(dx, dy) || 1;
  const down = Math.min(SHORTS_LEG, len - 1.2) - 0.4;
  const top: Pt = [hx, Math.min(hy, waist[1] + 0.5)];
  const end: Pt = [hx + (dx / len) * down, hy + (dy / len) * down];
  const layer = stroke(g, [top, end], [0.5, 0.5], () => "t");
  for (const [i, ch] of layer) {
    const was = g.c[i];
    if (was === "p") g.c[i] = ch;
    else if (was === "q") g.c[i] = "T";
  }
}

// The heads: facing right, A1's (adult.ts), so the hero has one face in every frame
// (16 wide, 13 rows; the base of the neck is under columns 5 to 9). Read on first use, so
// adult.ts may import this file (its moves are painted on the same rig).
let heads: Record<HeadKind, readonly string[]> | undefined;
const headsOf = (): Record<HeadKind, readonly string[]> =>
  (heads ??= {
    side: PARTS.HEAD,
    down: PARTS.HEAD_DOWN,
    up: PARTS.HEAD_UP,
    shout: PARTS.HEAD_SHOUT,
    bowed: PARTS.HEAD_BOWED,
    // Facing left (the bicycle's first frames, his back to the goal): the same head turned
    // round, the light still from the top left (the fringe catches it, the ear is in shade).
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
    upL: rowsOf(`
.....shhhhhh....
...sssshhHHhhh..
..ssmmsshHHhhhh.
...ssksshhhhhhhh
.sssskssShhhhhhh
.SssssssSShhhhhh
..mmssssmShhhhhh
...sssssSShhhhhh
....sssSShhhhhh.
.....sSSShhhhh..
......sSSShh....
.......ssSS.....
.......ssSS.....
`),
    // On his back in the air, face up, the crown toward the goal (13 x 16, the neck at the
    // left of rows 9 and 10).
    lie: rowsOf(`
.............
...s.........
...ss........
..msssssHhh..
.smsssmsHhhh.
.ssskkmsshhh.
ssssssmshhhhh
sssssssshhhhh
sssSmSshhhhhh
SSSSSShhhhhhh
SShhhhhhhhhhh
.hhhhhhhhhhhh
.hhhhhhhhhhhh
.hhhhhhhhhhh.
..hhhhhhhhhh.
...hhhhhhhh..
`),
  });

function rowsOf(art: string): string[] {
  return art
    .split("\n")
    .map((r) => r.trim())
    .filter((r) => r !== "");
}

function paintRows(
  g: Grid,
  rows: readonly string[],
  x0: number,
  y0: number,
  edge?: string,
): void {
  const layer: Layer = new Map();
  rows.forEach((line, dy) => {
    for (let dx = 0; dx < line.length; dx++) {
      const ch = line[dx];
      if (ch === ".") continue;
      const x = x0 + dx;
      const y = y0 + dy;
      if (x < 0 || y < 0 || x >= g.w || y >= g.h) {
        throw new Error(`adult-shots: pixel outside the cell at ${x},${y}`);
      }
      layer.set(y * g.w + x, ch);
    }
  });
  lay(g, layer, edge);
}

/** Paint one frame of the rig into a `w` x `h` cell. */
export function paintPose(pose: Pose, w = 32, h = 40): string {
  const g = new Grid(w, h);
  const facing = pose.facing ?? 1;
  paintArm(g, pose.farArm, false, undefined, pose.reach);
  paintLeg(g, pose.far, false);
  paintTorso(g, pose.neck, pose.waist, facing);
  paintLeg(g, pose.near, true, "k");
  paintShorts(g, pose.neck, pose.waist, facing);
  paintStripe(g, pose.near, pose.waist);
  const head = headsOf()[pose.head];
  const at = pose.headAt ?? [
    facing === 1 ? Math.floor(pose.neck[0]) - 5 : Math.ceil(pose.neck[0]) - 10,
    Math.round(pose.neck[1]) - 13,
  ];
  paintRows(g, head, at[0], at[1]);
  paintArm(g, pose.nearArm, true, "k", pose.reach);
  return g.text();
}

// ---------------------------------------------------------------------------
// Poses
// ---------------------------------------------------------------------------

/** A leg from its joints: hip, knee, ankle, heel, toe. */
function L(hip: Pt, knee: Pt, ankle: Pt, heel: Pt, toe: Pt): Leg {
  return { hip, knee, ankle, heel, toe };
}

/** An arm from its joints: shoulder, elbow, hand. */
function A(shoulder: Pt, elbow: Pt, hand: Pt): Arm {
  return { shoulder, elbow, hand };
}

/**
 * The tap in: the last stride, the side-foot push (**strike, frame 1**: the far foot
 * planted beside the ball, the near foot's inside against it), the step through, upright.
 */
export const TAPIN: readonly Pose[] = [
  {
    neck: [14.5, 18],
    waist: [14.5, 26],
    head: "down",
    near: L([13, 28], [10.5, 31.5], [8, 35.5], [5.5, 37.5], [9.5, 37.5]),
    far: L([17.5, 28], [20, 31.5], [20.5, 35.5], [19.5, 37.5], [23.5, 37.5]),
    nearArm: A([19.5, 19.5], [21, 22], [23, 22]),
    farArm: A([10.5, 19.5], [8.5, 22], [6.5, 22]),
  },
  {
    neck: [14.5, 18],
    waist: [14.5, 26],
    head: "down",
    near: L([17, 28], [20, 31.5], [21, 35], [21.5, 37], [25, 37.5]),
    far: L([13, 28], [13.5, 31.5], [13.5, 35.5], [11.5, 37.5], [15.5, 37.5]),
    nearArm: A([11, 19.5], [8.5, 21.5], [7, 22.5]),
    farArm: A([19, 19.5], [20.5, 22.5], [21, 24.5]),
  },
  {
    neck: [16.5, 18],
    waist: [16, 26],
    head: "side",
    near: L([19, 28], [21.5, 31.5], [23, 35.5], [22, 37.5], [26.5, 37.5]),
    far: L([13.5, 28], [11.5, 31.5], [8.5, 35], [7, 36.5], [10, 37.5]),
    nearArm: A([12.5, 19.5], [10.5, 21.5], [9, 22.5]),
    farArm: A([20.5, 19.5], [22, 21.5], [23, 22.5]),
  },
  {
    neck: [15.5, 18],
    waist: [15.5, 26],
    head: "side",
    near: L([20, 28], [21, 32], [21, 36], [20, 37.5], [24, 37.5]),
    far: L([13, 28], [13, 32], [13, 36], [11, 37.5], [14, 37.5]),
    nearArm: A([18.5, 19.5], [19, 22.5], [19, 26]),
    farArm: A([11, 19.5], [10.5, 22.5], [10.5, 25]),
  },
];

/**
 * The toe poke: a lunging stride, the reach (**strike, frame 1**: low, the far leg far
 * back, the near leg straight out with the toe on the ball, the near arm flung up), the
 * lurch forward on one foot, a stumbling hop, upright again.
 */
export const TOEPOKE: readonly Pose[] = [
  {
    neck: [14.5, 18],
    waist: [14.5, 26],
    head: "down",
    near: L([17, 28], [20, 29.5], [21, 33.5], [20, 35], [23.5, 35]),
    far: L([12, 28], [8.5, 31.5], [6, 35.5], [4.5, 37.5], [8.5, 37.5]),
    nearArm: A([11, 19.5], [8, 21.5], [5.5, 21]),
    farArm: A([19.5, 19.5], [21.5, 20.5], [22.5, 21.5]),
  },
  {
    neck: [12.5, 21.5],
    waist: [13, 29],
    head: "down",
    near: L([16, 30.5], [19.5, 32.5], [22.5, 34.5], [22, 35.5], [25, 36.5]),
    far: L([10.5, 31], [7.5, 33], [4.5, 35.5], [3, 37.5], [6, 37.5]),
    nearArm: A([9.5, 23], [6, 21], [3.5, 19]),
    farArm: A([16.5, 23], [19.5, 24.5], [21.5, 25]),
  },
  {
    neck: [17.5, 21],
    waist: [15, 28],
    head: "shout",
    near: L([17, 29.5], [20, 32.5], [21.5, 35.5], [19.5, 37.5], [23.5, 37.5]),
    far: L([12, 29.5], [7.5, 30.5], [5.5, 33], [5, 31.5], [3, 34.5]),
    nearArm: A([12.5, 22.5], [9.5, 20.5], [7, 18]),
    farArm: A([20, 23], [23, 24], [25, 24.5]),
  },
  {
    neck: [15.5, 18],
    waist: [15.5, 26],
    head: "side",
    near: L([13, 28], [10, 31.5], [7, 33.5], [7, 34], [4.5, 35.5]),
    far: L([18, 28], [20.5, 31.5], [22, 35], [21, 37.5], [25, 37.5]),
    nearArm: A([11, 19.5], [7, 19], [3.5, 17.5]),
    farArm: A([20, 20], [23, 22], [26, 21.5]),
  },
  {
    neck: [14.5, 18],
    waist: [14.5, 26],
    head: "side",
    near: L([12.5, 28], [11.5, 32], [10, 36], [7.5, 37.5], [11, 37.5]),
    far: L([18, 28], [20.5, 32], [22, 36], [21.5, 37.5], [25, 37.5]),
    nearArm: A([10.5, 19.5], [8, 21], [7, 22.5]),
    farArm: A([19, 19.5], [21, 21.5], [22.5, 22]),
  },
];

/**
 * The trivela, struck with the outside of the boot: the last stride, the plant with the
 * near leg cocked behind, the leg swung across with the foot turned in, toe down, the
 * outside of the boot on the ball (**strike, frame 2**), the leg flicked out and up with
 * the back arm high, the landing, arms open.
 */
export const TRIVELA: readonly Pose[] = [
  {
    neck: [14.5, 18],
    waist: [14, 26],
    head: "down",
    near: L([11.5, 28], [7.5, 31.5], [4.5, 35], [3.5, 37], [6.5, 37.5]),
    far: L([17, 28], [17.5, 31.5], [17.5, 35.5], [15, 37.5], [19, 37.5]),
    nearArm: A([11, 19.5], [8, 21.5], [6, 21]),
    farArm: A([19.5, 19.5], [21.5, 22], [23.5, 21.5]),
  },
  {
    neck: [16.5, 18],
    waist: [16, 26],
    head: "down",
    near: L([13, 28], [8, 31], [4.5, 28.5], [4.5, 28.5], [2.5, 25.5]),
    far: L([18.5, 28], [18, 31.5], [18, 35.5], [15.5, 37.5], [20, 37.5]),
    nearArm: A([12, 19.5], [8, 21], [4.5, 19]),
    farArm: A([21, 19.5], [23.5, 21.5], [26, 21]),
  },
  {
    neck: [12.5, 18],
    waist: [13, 26],
    head: "down",
    near: L([17, 28], [20.5, 31.5], [23, 34.5], [23, 35], [25, 37]),
    far: L([12.5, 28], [14.5, 31.5], [15, 35.5], [13, 37.5], [17, 37.5]),
    nearArm: A([10, 19.5], [7, 21], [4, 18.5]),
    farArm: A([19, 19.5], [22, 20.5], [24.5, 19]),
  },
  {
    neck: [12, 18],
    waist: [13, 26],
    head: "side",
    near: L([16, 28], [21, 26.5], [25, 22.5], [26, 22], [28.5, 19]),
    far: L([11.5, 28], [12.5, 31.5], [14, 35.5], [13, 37.5], [17, 37.5]),
    nearArm: A([10, 19.5], [6.5, 17], [3.5, 14.5]),
    farArm: A([17, 20], [19.5, 21.5], [21.5, 22.5]),
  },
  {
    neck: [14.5, 18],
    waist: [15, 26],
    head: "side",
    near: L([18.5, 28], [21, 31.5], [23, 35.5], [21.5, 37.5], [25.5, 37.5]),
    far: L([12.5, 28], [8, 30.5], [5.5, 32.5], [5, 32], [2.5, 33.5]),
    nearArm: A([11, 19.5], [7.5, 17.5], [5, 15]),
    farArm: A([19.5, 19.5], [21.5, 22], [23.5, 21.5]),
  },
  {
    neck: [14.5, 18],
    waist: [14.5, 26],
    head: "side",
    near: L([12, 28], [10, 32], [9.5, 36], [7.5, 37.5], [11, 37.5]),
    far: L([18, 28], [20, 32], [21, 36], [20, 37.5], [24, 37.5]),
    nearArm: A([10.5, 19.5], [7.5, 21], [5, 20]),
    farArm: A([20, 19.5], [22.5, 21], [25, 20]),
  },
];

/**
 * The chip: the approach, the last stride, the foot stabbed under the ball (**strike,
 * frame 2**), the leaning-back follow-through watching it rise, the step down.
 */
export const CHIP: readonly Pose[] = [
  {
    neck: [14.5, 18],
    waist: [14.5, 26],
    head: "down",
    far: L([12, 28], [9.5, 31.5], [6, 35.5], [3.5, 37.5], [7, 37.5]),
    near: L([18, 28], [20.5, 31.5], [21, 35.5], [20, 37.5], [24, 37.5]),
    nearArm: A([10.5, 19.5], [7.5, 21.5], [5.5, 23]),
    farArm: A([20, 19.5], [22, 20.5], [23.5, 21]),
  },
  {
    neck: [12.5, 18],
    waist: [13, 26],
    head: "down",
    near: L([11, 28], [7.5, 31], [5.5, 33], [4.5, 35], [7.5, 35.5]),
    far: L([16, 28], [18, 31.5], [19, 35.5], [17, 37.5], [21, 37.5]),
    nearArm: A([10, 19.5], [6.5, 21.5], [3.5, 21]),
    farArm: A([19, 19.5], [21.5, 19], [23, 18.5]),
  },
  {
    neck: [14.5, 18],
    waist: [14.5, 26],
    head: "down",
    near: L([17, 28], [20, 31.5], [21.5, 35.5], [22, 37.5], [25.5, 38]),
    far: L([13, 28], [13.5, 31.5], [13.5, 35.5], [11, 37.5], [15, 37.5]),
    nearArm: A([10.5, 19.5], [7.5, 20.5], [5, 19.5]),
    farArm: A([20, 19.5], [22.5, 20.5], [24.5, 19]),
  },
  {
    neck: [12.5, 18],
    waist: [13, 26],
    head: "up",
    near: L([16.5, 28], [20.5, 29.5], [24, 30.5], [24.5, 32], [27, 30]),
    far: L([12.5, 28], [15, 31.5], [16.5, 35.5], [14.5, 37.5], [18.5, 37.5]),
    nearArm: A([10, 19.5], [6.5, 21], [3.5, 20]),
    farArm: A([19, 19.5], [21, 19], [22.5, 18.5]),
  },
  {
    neck: [14.5, 18],
    waist: [14.5, 26],
    head: "up",
    far: L([12, 28], [11, 32], [10.5, 36], [8.5, 37.5], [11.5, 37.5]),
    near: L([18.5, 28], [21, 31.5], [23, 35.5], [22, 37.5], [26, 37.5]),
    nearArm: A([10.5, 19.5], [8, 21.5], [7, 23]),
    farArm: A([19.5, 19.5], [21.5, 22], [23.5, 21.5]),
  },
];

/**
 * The power shot, a rocket: the long last stride, the near leg wound right up behind, the
 * laces through the ball low over it (**strike, frame 2**), the follow-through that lifts
 * him off the ground, the landing on the kicking foot, upright.
 */
export const POWER: readonly Pose[] = [
  {
    neck: [13.5, 20],
    waist: [13.5, 27.5],
    head: "down",
    far: L([10.5, 29.5], [6.5, 32], [3.5, 35.5], [2.5, 36.5], [5.5, 37.5]),
    near: L([16.5, 29.5], [19, 32.5], [19.5, 36], [18.5, 37.5], [23, 37.5]),
    nearArm: A([9.5, 21.5], [6.5, 23.5], [5, 24.5]),
    farArm: A([19, 21.5], [21, 21], [23, 20.5]),
  },
  {
    neck: [12.5, 18],
    waist: [13, 26],
    head: "down",
    near: L([11, 28], [7.5, 29.5], [4.5, 25.5], [4.5, 25], [2.5, 22.5]),
    far: L([16, 28], [18, 31.5], [19, 35.5], [17, 37.5], [21, 37.5]),
    nearArm: A([10, 20], [7.5, 22], [6.5, 23.5]),
    farArm: A([19.5, 19.5], [22, 18.5], [24, 16.5]),
  },
  {
    neck: [17, 21],
    waist: [14, 28],
    head: "down",
    near: L([16.5, 29.5], [20.5, 31], [23, 33.5], [22, 33.5], [25, 36]),
    far: L([12, 29.5], [13, 32.5], [13.5, 35.5], [11, 37.5], [15, 37.5]),
    nearArm: A([12.5, 22], [8.5, 21], [5, 20.5]),
    farArm: A([20.5, 23], [23, 24.5], [25, 24.5]),
  },
  {
    neck: [11.5, 14],
    waist: [12.5, 22],
    head: "shout",
    near: L([16, 24], [20.5, 20], [24.5, 16], [26, 14], [28.5, 10.5]),
    far: L([11, 24], [10, 27.5], [7.5, 31], [5.5, 32.5], [9, 33]),
    nearArm: A([9.5, 15.5], [6.5, 17], [4.5, 17.5]),
    farArm: A([17.5, 16], [19.5, 17.5], [21, 16.5]),
  },
  {
    neck: [15.5, 20],
    waist: [15, 27.5],
    head: "side",
    near: L([19.5, 29.5], [22, 32.5], [23, 36], [21, 37.5], [25.5, 37.5]),
    far: L([13, 29.5], [9.5, 31], [6, 31], [5, 32], [4, 29]),
    nearArm: A([11.5, 21.5], [8.5, 23.5], [7, 24.5]),
    farArm: A([21, 21.5], [23, 21], [25, 20.5]),
  },
  {
    neck: [14.5, 18],
    waist: [14.5, 26],
    head: "side",
    far: L([11.5, 28], [9.5, 31.5], [7.5, 35.5], [5, 37.5], [9, 37.5]),
    near: L([18.5, 28], [21, 31.5], [23, 35.5], [22, 37.5], [26, 37.5]),
    nearArm: A([10.5, 19.5], [8, 21], [6.5, 21.5]),
    farArm: A([19.5, 19.5], [21.5, 22], [23.5, 21.5]),
  },
];

/**
 * The finesse, curled into the far corner with the inside of the foot (the golazo): the
 * approach, the wind-up leaning away, the inside of the boot round the ball (**strike,
 * frame 2**), the leg wrapped across in the follow-through with the arms wide, the step.
 */
export const FINESSE: readonly Pose[] = [
  {
    neck: [13.5, 18],
    waist: [14, 26],
    head: "down",
    far: L([12, 28], [9.5, 31.5], [6, 35.5], [3.5, 37.5], [7, 37.5]),
    near: L([18, 28], [20.5, 31.5], [21, 35.5], [20, 37.5], [24, 37.5]),
    nearArm: A([10, 19.5], [7, 20.5], [5, 21]),
    farArm: A([19.5, 19.5], [21.5, 20.5], [23, 21]),
  },
  {
    neck: [11.5, 18],
    waist: [12.5, 26],
    head: "down",
    near: L([9.5, 28], [6, 31], [4, 33], [4, 34.5], [7, 35.5]),
    far: L([15.5, 28], [18.5, 31.5], [20.5, 35.5], [18.5, 37.5], [22.5, 37.5]),
    nearArm: A([9, 19.5], [5.5, 18.5], [3, 17]),
    farArm: A([18, 19.5], [21.5, 19.5], [24, 18.5]),
  },
  {
    neck: [12.5, 18],
    waist: [13, 26],
    head: "down",
    near: L([17, 28], [21, 30.5], [23.5, 33.5], [23.5, 34.5], [25, 37.5]),
    far: L([13, 28], [14.5, 31.5], [15.5, 35.5], [13, 37.5], [17, 37.5]),
    nearArm: A([10, 19.5], [6.5, 17.5], [4.5, 15.5]),
    farArm: A([20, 19.5], [22.5, 20.5], [24.5, 19]),
  },
  {
    neck: [14.5, 18],
    waist: [14.5, 26],
    head: "side",
    near: L([17, 28.5], [21.5, 29], [25.5, 30], [26, 31.5], [28.5, 33]),
    far: L([13, 28], [13, 31.5], [13, 35.5], [11, 37.5], [15, 37.5]),
    nearArm: A([10.5, 19.5], [6.5, 21], [3.5, 20]),
    farArm: A([20, 19.5], [23.5, 21], [27, 20]),
  },
  {
    neck: [14.5, 18],
    waist: [14.5, 26],
    head: "side",
    near: L([17.5, 28], [21, 31.5], [23.5, 35], [24, 36], [27, 37.5]),
    far: L([12.5, 28], [13, 31.5], [13, 35.5], [11, 37.5], [15, 37.5]),
    nearArm: A([10.5, 19.5], [8, 21], [6.5, 21.5]),
    farArm: A([20, 19.5], [23, 21.5], [26.5, 21]),
  },
];

/**
 * The bicycle kick (the worldie), in its own 48 x 56 cell: anchor column 24, soles row 54,
 * their outline row 55 on the ground row y - 1. His back to the goal (facing left), the
 * ball dropping in front of him: he looks up at it, crouches, throws himself back with the
 * far leg swinging up, lies flat in the air, the near leg scissors up over his head onto
 * the ball (**strike, frame 4**), he falls with an arm down, lands on his back, sits up.
 */
export const BICYCLE: readonly Pose[] = [
  {
    facing: -1,
    neck: [25.5, 34],
    waist: [25.5, 42],
    head: "upL",
    near: L([22.5, 44], [22, 48], [22, 52], [23, 53.5], [19, 53.5]),
    far: L([28.5, 44], [29, 48], [29, 52], [30, 53.5], [27, 53.5]),
    nearArm: A([20.5, 35.5], [19.5, 38.5], [18, 40]),
    farArm: A([31, 35.5], [33, 37.5], [34.5, 37]),
  },
  {
    facing: -1,
    neck: [25.5, 38],
    waist: [26, 44.5],
    head: "upL",
    near: L([22.5, 46], [20, 48.5], [21.5, 52], [22.5, 53.5], [18.5, 53.5]),
    far: L([29, 46], [30.5, 48.5], [29.5, 52], [31, 53.5], [27, 53.5]),
    nearArm: A([21, 39.5], [20, 42], [21, 44.5]),
    farArm: A([31, 39.5], [34, 41], [36.5, 41.5]),
  },
  {
    facing: -1,
    neck: [32.5, 33],
    waist: [27.5, 40.5],
    head: "upL",
    headAt: [27, 19],
    far: L([24.5, 42], [20, 39.5], [15.5, 36], [15.5, 35.5], [12, 32.5]),
    near: L([28, 43.5], [26.5, 47.5], [27, 51], [26, 52], [29.5, 53]),
    farArm: A([29.5, 34], [27, 31], [25, 28.5]),
    nearArm: A([35, 35], [38, 36.5], [41, 36.5]),
  },
  {
    facing: -1,
    neck: [32.5, 29],
    waist: [23.5, 29],
    head: "lie",
    headAt: [33, 20],
    far: L([22.5, 26.5], [21.5, 22], [21.5, 17.5], [20.5, 15.5], [24.5, 14.5]),
    near: L([22.5, 31.5], [17.5, 32], [14.5, 35], [14.5, 36.5], [12, 37.5]),
    farArm: A([30.5, 26], [32.5, 23], [34, 20.5]),
    nearArm: A([30.5, 32.5], [32, 35.5], [34.5, 38.5]),
  },
  {
    facing: -1,
    neck: [32.5, 31],
    waist: [23.5, 31],
    head: "lie",
    headAt: [33, 22],
    near: L([22.5, 28.5], [24, 23.5], [27, 19], [27.5, 19.5], [31, 16]),
    far: L([22.5, 33.5], [17.5, 34], [14, 37.5], [13, 38.5], [10.5, 39.5]),
    farArm: A([30.5, 28], [33, 25.5], [34.5, 23]),
    nearArm: A([30.5, 34], [32.5, 37.5], [35, 40.5]),
  },
  // 5: falling, head first: the body at a slant, the near hand reaching down to break the
  // fall, the legs still scissoring over him.
  {
    facing: -1,
    reach: 1,
    neck: [32.5, 43],
    waist: [26.5, 36.5],
    head: "lie",
    headAt: [33, 36],
    near: L([27.5, 34.5], [26, 28.5], [29, 23], [29.5, 22.5], [32, 20]),
    far: L([24.5, 37], [19.5, 33.5], [15.5, 30], [15, 29.5], [12.5, 31.5]),
    nearArm: A([30, 45.5], [30.5, 49.5], [32.5, 53]),
    farArm: A([33, 40], [36.5, 35.5], [40, 33]),
  },
  // 6: down on his back, the near knee up, a fist punched at the sky.
  {
    facing: -1,
    reach: 1,
    neck: [33, 48.5],
    waist: [24, 48.5],
    head: "lie",
    headAt: [34, 39],
    near: L([23.5, 46.5], [19, 41.5], [15.5, 47], [15.5, 51], [12, 53.5]),
    far: L([23.5, 51], [17.5, 52.5], [11.5, 53], [11, 53.5], [8.5, 51]),
    farArm: A([31, 44.5], [35, 41.5], [39.5, 41]),
    nearArm: A([30.5, 50], [28, 45], [29, 40]),
  },
  // 7: sat up facing the goal, leaning back on the far hand, pointing at it, shouting.
  {
    reach: 1,
    neck: [20.5, 42.5],
    waist: [22, 50.5],
    head: "shout",
    near: L([24, 51], [28.5, 47], [31.5, 51.5], [31, 53.5], [35, 53.5]),
    far: L([21, 52.5], [27.5, 53], [34.5, 53], [35, 53.5], [38, 51]),
    nearArm: A([23.5, 44], [28, 43.5], [32.5, 42]),
    farArm: A([17, 44], [14.5, 48.5], [14, 53]),
  },
];

type Shot = Exclude<ShotAnim, "kick">;

/** Every shot's poses (the art is painted from them). */
export const SHOT_POSES: Readonly<Record<Shot, readonly Pose[]>> = {
  tapin: TAPIN,
  toepoke: TOEPOKE,
  trivela: TRIVELA,
  chip: CHIP,
  power: POWER,
  finesse: FINESSE,
  bicycle: BICYCLE,
};

type Spot = { readonly x: number; readonly y: number } | null;
const at = (x: number, y: number): Spot => ({ x, y });
const REST = at(14, -4);

/**
 * Where the ball's centre is, frame by frame, as an offset from (x, y) (the ground point;
 * a spot's x is its column - 16, its y its row - 40; the bicycle's column - 24 and row -
 * 56), for package C's 6 x 6 ball in its ink ring, centred as `drawMatchBall` centres it
 * (its fill is x - 3 .. x + 2, y - 3 .. y + 2). At rest the ring's bottom is on the soles'
 * outline row (y - 1). On the strike frame the boot's fill touches the ring.
 * people.ts's `ballSpot` reads them (.snaps/detail2/A2-spots.md).
 */
export const ADULT_SHOT_BALL: Readonly<Record<Shot, readonly Spot[]>> = {
  tapin: [REST, REST, null, null],
  toepoke: [REST, REST, null, null, null],
  trivela: [REST, REST, REST, null, null, null],
  chip: [REST, REST, REST, null, null],
  power: [REST, REST, REST, null, null, null],
  finesse: [REST, REST, REST, null, null],
  bicycle: [
    at(-10, -20),
    at(-6, -44),
    at(2, -52),
    at(6, -48),
    at(10, -43),
    null,
    null,
    null,
  ],
};

/** Every pose of a shot painted, as `figure()` reads frames (32 x 40; the bicycle 48 x 56). */
export function shotArt(anim: Shot): string {
  const big = anim === "bicycle";
  return frames(
    SHOT_POSES[anim].map((p) => paintPose(p, big ? 48 : 32, big ? 56 : 40)),
  );
}

/** The shots' art for `people.ts`, each built on first use. */
export const ADULT_SHOTS: ArtRecord<ShotAnim> = {
  tapin: () => shotArt("tapin"),
  toepoke: () => shotArt("toepoke"),
  trivela: () => shotArt("trivela"),
  chip: () => shotArt("chip"),
  power: () => shotArt("power"),
  finesse: () => shotArt("finesse"),
  bicycle: () => shotArt("bicycle"),
};
