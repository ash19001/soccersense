/**
 * The youth footballer's shots (tap in, toe poke, trivela, chip, power, finesse,
 * bicycle): 20 x 28 in a 28 x 32 cell (the bicycle 40 x 44), facing right, drawn with
 * `LEGEND` (figure.ts).
 *
 * Anchor: column 14 is the ground point's x (the cell's left edge is x - 14); the boots'
 * lowest fill row is 30 and the soles' outline row 31 is the ground row y - 1. The bicycle:
 * anchor column 20, soles' fill row 42, outline row 43.
 *
 * How the frames are made. The same way as the adult's shots (the rig in
 * `adult-shots.ts`), traced pose for pose at the child's size: one head (the adult's heads
 * with two rows of hair taken out), one
 * shirt sheared along the line from the neck to the waist, limbs as strokes through their
 * joints coloured along their length (the shorts' leg, the bare knee, the sock's turnover,
 * the sock; the sleeve, the cuff, the forearm) and shaded away from the light at the top
 * left, boots as short strokes from heel to toe with a lit toecap. He is the adult's build
 * shortened: a big head for his body, a short shirt, short legs (`y` from the soles is 0.7 of
 * the adult's), and thinner limbs. The result is fill-only art: `figure()` adds the outline.
 *
 * Near and far, as the adult: he faces right, the near (kicking) leg and the far arm swing
 * forward; near limbs are lit and drawn last with a 1 px line where they cross, far limbs
 * are in shade and drawn first.
 *
 * Every frame is built once, on first use, so nothing here runs at load time.
 */

import { frames, mirror, type ArtRecord } from "./figure";
import type { ShotAnim } from "./people";
import { YOUTH_PARTS } from "./youth";

// ---------------------------------------------------------------------------
// The paint grid (A2's rig, at the child's size)
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
      throw new Error(`youth-shots: pixel outside the cell at ${x},${y}`);
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
 * The line a near limb leaves on what it crosses: that thing's own shade, or ink where it
 * is shaded already.
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
 * Lay a layer on the grid. With `edge`, where the layer crosses something already drawn,
 * the pixels it touches there become a line that keeps it in front (`CREASE` of what is
 * there, or `edge`). `edgeable` limits which of the layer's pixels draw that line.
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

/**
 * Which side of a stroke a pixel is on: -1 the lit edge (toward the top left), 1 the
 * shaded edge, 0 between. `s` is the distance along the stroke from its first point.
 */
type Ink = (s: number, side: -1 | 0 | 1) => string | null;

/**
 * Paint a stroke through `pts` with radius `r` (one per point, linear between): every
 * pixel whose centre is within the radius of the polyline.
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
// The boy
// ---------------------------------------------------------------------------

/** A leg: hip, knee, ankle, and the boot from heel to toe. */
export interface YouthLeg {
  readonly hip: Pt;
  readonly knee: Pt;
  readonly ankle: Pt;
  readonly heel: Pt;
  readonly toe: Pt;
}

/** An arm: shoulder, elbow, hand. */
export interface YouthArm {
  readonly shoulder: Pt;
  readonly elbow: Pt;
  readonly hand: Pt;
}

type HeadKind =
  "side" | "down" | "up" | "shout" | "bowed" | "sideL" | "upL" | "lie";

/** One frame of the rig. */
export interface YouthPose {
  /** The top of the shirt's middle (the base of the neck) and the waist's middle. */
  readonly neck: Pt;
  readonly waist: Pt;
  readonly head: HeadKind;
  /** The head part's top-left corner, if not the default place over the neck. */
  readonly headAt?: Pt;
  /** -1 when he faces left (his chest, collar and badge to the left); default 1. */
  readonly facing?: 1 | -1;
  readonly near: YouthLeg;
  readonly far: YouthLeg;
  readonly nearArm: YouthArm;
  readonly farArm: YouthArm;
  /**
   * How much the painter lengthens the arms (default `ARM_REACH`: the shots' poses were
   * set with short arms); 1 paints them exactly as given (the moves, youth.ts).
   */
  readonly reach?: number;
  /**
   * The hands in the glove letters (`g`, `G`), as the youth's moves have them, so the
   * child keeper wears his gloves on them (in every other kit they are bare hands).
   */
  readonly gloves?: boolean;
}

// Along a leg from the hip: the shorts' leg, the bare knee to just past the joint, the
// sock's turnover, the sock. Along an arm from the shoulder: the sleeve, the cuff, the
// forearm. All shorter than the adult's.
const SHORTS_LEG = 1.7;
const PAST_KNEE = 0.5;
const TURNOVER = 1.3;
const SLEEVE = 2.1;
const CUFF = 2.8;

function legInk(near: boolean, thigh: number): Ink {
  const shorts = Math.min(SHORTS_LEG, thigh - 1);
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

function paintLeg(g: Grid, leg: YouthLeg, near: boolean, edge?: string): void {
  const edgeable = new Set<number>();
  const limb = stroke(
    g,
    [leg.hip, leg.knee, leg.ankle],
    [1.55, 1.2, 1.05],
    legInk(
      near,
      Math.hypot(leg.knee[0] - leg.hip[0], leg.knee[1] - leg.hip[1]),
    ),
    SHORTS_LEG + 0.4,
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
 * How much longer an arm is than the joints a pose gives (the shots' poses were set with
 * short arms; the arm keeps its directions and reaches as far as his hanging arm).
 */
const ARM_REACH = 1.45;

/** The arm's joints with each segment of the pose's arm longer by `k`. */
function reach(arm: YouthArm, k: number): YouthArm {
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

/** Where the fist ends: a little past the hand, along the forearm. */
function fistTip(from: Pt, at: Pt): Pt {
  const dx = at[0] - from[0];
  const dy = at[1] - from[1];
  const len = Math.hypot(dx, dy) || 1;
  return [at[0] + (dx / len) * 0.8, at[1] + (dy / len) * 0.8];
}

/** True when the arm's pixels leave room for their outline inside the cell. */
function inside(g: Grid, arm: YouthArm): boolean {
  const r = 1.05;
  return [arm.elbow, arm.hand, fistTip(arm.elbow, arm.hand)].every(
    ([x, y]) => x > r && y > r && x + r < g.w - 1 && y + r < g.h - 1,
  );
}

/**
 * An arm, as long as the cell allows up to `most` times the pose's, ending in a fist a
 * little wider than the wrist and longer along the forearm than across it, its knuckles'
 * edge (away from the light) in shade.
 */
function paintArm(
  g: Grid,
  pose: YouthArm,
  near: boolean,
  edge?: string,
  most = ARM_REACH,
  gloves = false,
): void {
  const [lit, shade] = gloves ? ["g", "G"] : ["s", "S"];
  for (let k = most; ; k -= 0.1) {
    const arm = reach(pose, Math.max(1, k));
    if (k > 1 && !inside(g, arm)) continue;
    const edgeable = new Set<number>();
    const limb = stroke(
      g,
      [arm.shoulder, arm.elbow, arm.hand],
      [1.15, 1.0, 0.9],
      armInk(near),
      1.6,
      edgeable,
    );
    const fist = stroke(
      g,
      [arm.hand, fistTip(arm.elbow, arm.hand)],
      [0.95, 0.95],
      (_s, side) => (near && side !== 1 ? lit : shade),
    );
    for (const [i, ch] of fist) {
      limb.set(i, ch);
      edgeable.add(i);
    }
    lay(g, limb, edge, edgeable);
    return;
  }
}

/**
 * Paint the body as spans across the line from the neck to the waist, sheared rather than
 * turned (rows when he is more upright than flat, columns when he lies flat). `paint(u, v,
 * w, half)` gets the distance down the body `u`, the offset toward his chest `v` and toward
 * the shade `w`.
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

/**
 * The shirt: 10 wide at the shoulders narrowing to 9 at the waist, the collar at the front
 * of its top, a lit shoulder, the shaded side and hem, and a small badge on the chest.
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
    (u) => 4.5 - (0.5 * Math.max(0, u)) / len,
    (u, v, w, half) => {
      if (u < 0.5 && Math.abs(v) > half - 1) return null; // round shoulders
      if (u < 0.5 && v > -0.5 && v < 3) return "r"; // collar
      if (u < 1.5 && v > 1 && v < 3) return "r";
      if (u >= 2.5 && u < 3.5 && v > 1 && v < 3) return "r"; // badge
      if (w > half - 1.5 || u > len - 0.5) return "T";
      // the light on the shoulder: a line along its top and down the lit edge
      if (u >= 0.5 && u < 1.5 && w > -half + 0.5 && w < -1.5) return "U";
      if (u >= 0.5 && u < 3 && w < -half + 1) return "U";
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
    1 + 1.8 / len,
    () => 4.8,
    (_u, _v, w) => (w > 2.8 ? "q" : "p"),
  );
  lay(g, layer);
}

/**
 * The shorts' side stripe in the shirt's colour (it reads on every kit, white shorts
 * too): down the side of the near leg of the shorts, from the waistband to the hem.
 */
function paintStripe(g: Grid, leg: YouthLeg, waist: Pt): void {
  const [hx, hy] = leg.hip;
  const dx = leg.knee[0] - hx;
  const dy = leg.knee[1] - hy;
  const len = Math.hypot(dx, dy) || 1;
  const down = Math.min(SHORTS_LEG, len - 1) - 0.3;
  const top: Pt = [hx, Math.min(hy, waist[1] + 0.5)];
  const end: Pt = [hx + (dx / len) * down, hy + (dy / len) * down];
  for (const i of stroke(g, [top, end], [0.5, 0.5], () => "t").keys()) {
    const was = g.c[i];
    if (was === "p") g.c[i] = "t";
    else if (was === "q") g.c[i] = "T";
  }
}

// ---------------------------------------------------------------------------
// The heads: B1's (youth.ts, `YOUTH_PARTS`), so the boy has one face in his moves
// and his shots: 13 or 14 wide, 11 rows, the neck on the last. Facing left (the
// bicycle's first frames) they are mirrored with the hair's highlight kept on the top
// left, where the light is. Lying on his back in the air the head is A2's lying head at
// his size.
// ---------------------------------------------------------------------------

function rowsOf(art: string): string[] {
  return art
    .split("\n")
    .map((r) => r.trim())
    .filter((r) => r !== "");
}

/**
 * A head turned to face left: mirrored, its hair highlight (`H`) put back where it was
 * (the crown's top left, toward the light) wherever that is hair in the mirrored head.
 */
function facingLeft(head: readonly string[]): string[] {
  const m = mirror(head).map((r) => Array.from(r.replaceAll("H", "h")));
  head.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] === "H" && m[y][x] === "h") m[y][x] = "H";
    }
  });
  return m.map((r) => r.join(""));
}

let heads: Record<HeadKind, readonly string[]> | undefined;

function headsOf(): Record<HeadKind, readonly string[]> {
  return (heads ??= {
    side: YOUTH_PARTS.HEAD,
    down: YOUTH_PARTS.HEAD_DOWN,
    up: YOUTH_PARTS.HEAD_UP,
    shout: YOUTH_PARTS.HEAD_SHOUT,
    bowed: YOUTH_PARTS.HEAD_BOWED,
    sideL: facingLeft(YOUTH_PARTS.HEAD),
    upL: facingLeft(YOUTH_PARTS.HEAD_UP),
    // On his back in the air, face up, the crown toward the goal (13 x 14, the neck at
    // the left of rows 8 and 9).
    lie: rowsOf(`
.............
...s.........
..msssssHhh..
.smsssmsHhhh.
.ssskkmsshhh.
ssssssmshhhhh
sssssssshhhhh
sssSmSshhhhhh
SSSSSShhhhhhh
SShhhhhhhhhhh
.hhhhhhhhhhhh
.hhhhhhhhhhh.
..hhhhhhhhhh.
...hhhhhhhh..
`),
  });
}

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
      const x = x0 + dx;
      const y = y0 + dy;
      if (x < 0 || y < 0 || x >= g.w || y >= g.h) {
        throw new Error(`youth-shots: pixel outside the cell at ${x},${y}`);
      }
      layer.set(y * g.w + x, ch);
    }
  });
  lay(g, layer);
}

/** Paint one frame of the rig into a `w` x `h` cell (28 x 32; the bicycle 40 x 44). */
export function paintYouthPose(pose: YouthPose, w = 28, h = 32): string {
  const g = new Grid(w, h);
  const facing = pose.facing ?? 1;
  paintArm(g, pose.farArm, false, undefined, pose.reach, pose.gloves);
  paintLeg(g, pose.far, false);
  paintTorso(g, pose.neck, pose.waist, facing);
  paintLeg(g, pose.near, true, "k");
  paintShorts(g, pose.neck, pose.waist, facing);
  paintStripe(g, pose.near, pose.waist);
  const head = headsOf()[pose.head];
  const at = pose.headAt ?? [
    // facing left, the mirror of facing right's place about the neck
    facing === 1
      ? Math.floor(pose.neck[0]) - 5
      : Math.ceil(pose.neck[0]) + 6 - head[0].length,
    Math.round(pose.neck[1]) - head.length,
  ];
  paintRows(g, head, at[0], at[1]);
  paintArm(g, pose.nearArm, true, "k", pose.reach, pose.gloves);
  return g.text();
}

// ---------------------------------------------------------------------------
// Poses (A2's, traced at his size; the strikes reach the same ball as the adult's)
// ---------------------------------------------------------------------------

function L(hip: Pt, knee: Pt, ankle: Pt, heel: Pt, toe: Pt): YouthLeg {
  return { hip, knee, ankle, heel, toe };
}

function A(shoulder: Pt, elbow: Pt, hand: Pt): YouthArm {
  return { shoulder, elbow, hand };
}

/** The tap in: the last stride, the side-foot push (**strike, frame 1**), step, upright. */
export const TAPIN: readonly YouthPose[] = [
  {
    neck: [13, 16],
    waist: [13, 21.5],
    head: "down",
    near: L([11.5, 23], [9.5, 25.5], [7.5, 28.5], [5.5, 29.5], [9, 29.5]),
    far: L([15, 23], [17, 25.5], [17.5, 28.5], [17, 29.5], [20, 29.5]),
    nearArm: A([17, 17], [18, 19], [19.5, 19]),
    farArm: A([9.5, 17], [8, 19], [6.5, 19]),
  },
  {
    neck: [14, 16],
    waist: [14, 21.5],
    head: "down",
    near: L([16, 23], [18, 25.5], [19.5, 28], [19.5, 29.5], [23, 29.5]),
    far: L([12.5, 23], [13, 25.5], [13, 28.5], [11.5, 29.5], [14.5, 29.5]),
    nearArm: A([11, 17], [9, 18.5], [8, 19]),
    farArm: A([17.5, 17], [18.5, 19], [19, 20.5]),
  },
  {
    neck: [14.5, 16],
    waist: [14, 21.5],
    head: "side",
    near: L([16.5, 23], [18.5, 25.5], [19.5, 28.5], [19, 29.5], [22.5, 29.5]),
    far: L([12, 23], [10.5, 25.5], [8, 28], [7, 29], [9, 29.5]),
    nearArm: A([11, 17], [9.5, 18.5], [8.5, 19]),
    farArm: A([17.5, 17], [19, 18.5], [19.5, 19]),
  },
  {
    neck: [13.5, 16],
    waist: [13.5, 21.5],
    head: "side",
    near: L([17, 23], [18, 26], [18, 28.5], [17, 29.5], [20.5, 29.5]),
    far: L([11.5, 23], [11.5, 26], [11.5, 28.5], [10, 29.5], [12.5, 29.5]),
    nearArm: A([16, 17], [16.5, 19], [16.5, 21.5]),
    farArm: A([10, 17], [9.5, 19], [9.5, 21]),
  },
];

/** The toe poke: lunge, the reach (**strike, frame 1**), lurch, hop, upright. */
export const TOEPOKE: readonly YouthPose[] = [
  {
    neck: [13, 16],
    waist: [13, 21.5],
    head: "down",
    near: L([15, 23], [17, 24], [18, 27], [17, 28], [20, 28]),
    far: L([11, 23], [8, 25.5], [6, 28.5], [5, 29.5], [8, 29.5]),
    nearArm: A([10, 17], [7.5, 18.5], [5.5, 18]),
    farArm: A([17, 17], [18.5, 18], [19, 18.5]),
  },
  {
    neck: [12, 18.5],
    waist: [12.5, 23.5],
    head: "down",
    near: L([15, 25], [18, 26.5], [20.5, 28], [20.5, 28.5], [23, 28.5]),
    far: L([10.5, 25], [8, 26.5], [6, 28.5], [4.5, 29.5], [7, 29.5]),
    nearArm: A([10, 19.5], [7, 18], [5, 16.5]),
    farArm: A([15.5, 19.5], [18, 20.5], [19.5, 21]),
  },
  {
    neck: [15, 18],
    waist: [13, 23],
    head: "shout",
    near: L([15, 24], [17, 26], [18.5, 28.5], [17, 29.5], [20, 29.5]),
    far: L([11, 24], [7, 25], [5.5, 26.5], [5, 25.5], [3.5, 27.5]),
    nearArm: A([11, 19], [9, 18], [7, 16]),
    farArm: A([17, 19.5], [19.5, 20], [21, 20.5]),
  },
  {
    neck: [13.5, 16],
    waist: [13.5, 21.5],
    head: "side",
    near: L([11.5, 23], [9, 25.5], [7, 27], [7, 27], [5, 28.5]),
    far: L([15.5, 23], [17.5, 25.5], [19, 28], [18, 29.5], [21, 29.5]),
    nearArm: A([10, 17], [7, 16.5], [4, 15.5]),
    farArm: A([17, 17.5], [19.5, 19], [22, 18.5]),
  },
  {
    neck: [13, 16],
    waist: [13, 21.5],
    head: "side",
    near: L([11, 23], [10.5, 26], [9, 28.5], [7, 29.5], [10, 29.5]),
    far: L([15.5, 23], [17.5, 26], [19, 28.5], [18.5, 29.5], [21, 29.5]),
    nearArm: A([9.5, 17], [7.5, 18], [7, 19]),
    farArm: A([16.5, 17], [18, 18.5], [19, 19]),
  },
];

/**
 * The trivela: the last stride, the plant with the near leg cocked behind, the outside of
 * the boot on the ball (**strike, frame 2**), the flick out and up, the landing, arms open.
 */
export const TRIVELA: readonly YouthPose[] = [
  {
    neck: [13, 16],
    waist: [12.5, 21.5],
    head: "down",
    near: L([10.5, 23], [7, 25.5], [5, 28], [4, 29.5], [6.5, 29.5]),
    far: L([15, 23], [15, 25.5], [15, 28.5], [13, 29.5], [16.5, 29.5]),
    nearArm: A([10, 17], [7.5, 18.5], [6, 18]),
    farArm: A([17, 17], [18.5, 19], [20, 18.5]),
  },
  {
    neck: [14.5, 16],
    waist: [14, 21.5],
    head: "down",
    near: L([11.5, 23], [7.5, 25], [5, 23.5], [5, 23.5], [3, 21.5]),
    far: L([16, 23], [15.5, 25.5], [15.5, 28.5], [13.5, 29.5], [17, 29.5]),
    nearArm: A([11, 17], [7.5, 18], [5, 16.5]),
    farArm: A([18, 17], [20, 18.5], [22, 18]),
  },
  {
    neck: [12, 16],
    waist: [12.5, 21.5],
    head: "down",
    near: L([15.5, 23], [18, 25], [20.5, 27], [21, 27.5], [23, 29.5]),
    far: L([12, 23], [14, 25.5], [14, 28.5], [12.5, 29.5], [16, 29.5]),
    nearArm: A([10, 17], [8, 18], [5.5, 16.5]),
    farArm: A([17.5, 17], [20, 18], [22, 16.5]),
  },
  {
    neck: [11, 16],
    waist: [11.5, 21.5],
    head: "side",
    near: L([14, 23], [18, 22], [21, 19], [22, 19], [24, 16.5]),
    far: L([10.5, 23], [11, 25.5], [12.5, 28.5], [11.5, 29.5], [15, 29.5]),
    nearArm: A([9, 17], [6.5, 15.5], [4, 13.5]),
    farArm: A([15, 17.5], [17, 18.5], [18.5, 19]),
  },
  {
    neck: [13, 16],
    waist: [13, 21.5],
    head: "side",
    near: L([16, 23], [18, 25.5], [19.5, 28.5], [18.5, 29.5], [21.5, 29.5]),
    far: L([11, 23], [7.5, 25], [5.5, 26], [5, 26], [3, 27]),
    nearArm: A([10, 17], [7, 15.5], [5, 14]),
    farArm: A([17, 17], [18.5, 19], [20, 18.5]),
  },
  {
    neck: [13, 16],
    waist: [13, 21.5],
    head: "side",
    near: L([11, 23], [9, 26], [9, 28.5], [7, 29.5], [10, 29.5]),
    far: L([15.5, 23], [17, 26], [18, 28.5], [17, 29.5], [20.5, 29.5]),
    nearArm: A([9.5, 17], [7, 18], [5, 17.5]),
    farArm: A([17, 17], [19, 18], [21, 17.5]),
  },
];

/**
 * The chip: the approach, the last stride, the foot stabbed under the ball (**strike,
 * frame 2**), leaning back watching it rise, the step down.
 */
export const CHIP: readonly YouthPose[] = [
  {
    neck: [13, 16],
    waist: [13, 21.5],
    head: "down",
    near: L([15.5, 23], [17.5, 25.5], [18, 28.5], [17, 29.5], [20.5, 29.5]),
    far: L([11, 23], [9, 25.5], [6, 28.5], [4, 29.5], [7, 29.5]),
    nearArm: A([9.5, 17], [7, 18.5], [5.5, 19.5]),
    farArm: A([17, 17], [19, 18], [20, 18]),
  },
  {
    neck: [11, 16],
    waist: [11.5, 21.5],
    head: "down",
    near: L([10, 23], [7, 25], [5.5, 26.5], [5, 28], [7, 28.5]),
    far: L([14, 23], [15.5, 25.5], [16.5, 28.5], [15, 29.5], [18, 29.5]),
    nearArm: A([9, 17], [6.5, 18.5], [4, 18]),
    farArm: A([16.5, 17], [18.5, 16.5], [19.5, 16.5]),
  },
  {
    neck: [14, 16],
    waist: [14, 21.5],
    head: "down",
    near: L([16, 23], [18, 25.5], [19.5, 28.5], [20.5, 29.5], [24, 30]),
    far: L([12.5, 23], [13, 25.5], [13, 28.5], [11, 29.5], [14, 29.5]),
    nearArm: A([10.5, 17], [8, 18], [6, 17]),
    farArm: A([18, 17], [20, 18], [22, 16.5]),
  },
  {
    neck: [11, 16],
    waist: [11.5, 21.5],
    head: "up",
    near: L([14.5, 23], [17.5, 24], [20.5, 25], [21, 26], [23, 24.5]),
    far: L([11, 23], [13, 25.5], [14.5, 28.5], [13, 29.5], [16, 29.5]),
    nearArm: A([9, 17], [6.5, 18], [4, 17.5]),
    farArm: A([16.5, 17], [18, 16.5], [19, 16.5]),
  },
  {
    neck: [13, 16],
    waist: [13, 21.5],
    head: "up",
    near: L([16, 23], [18, 25.5], [19.5, 28.5], [19, 29.5], [22, 29.5]),
    far: L([11, 23], [10, 26], [9.5, 28.5], [8, 29.5], [10.5, 29.5]),
    nearArm: A([9.5, 17], [7.5, 18.5], [7, 19.5]),
    farArm: A([17, 17], [18.5, 19], [20, 18.5]),
  },
];

/**
 * The power shot: the long last stride, the near leg wound up behind, the laces through
 * the ball (**strike, frame 2**), the follow-through off the ground, the landing, upright.
 */
export const POWER: readonly YouthPose[] = [
  {
    neck: [12, 17.5],
    waist: [12, 22.5],
    head: "down",
    near: L([14.5, 24], [16.5, 26], [17, 28.5], [16, 29.5], [19.5, 29.5]),
    far: L([9.5, 24], [6.5, 26], [4, 28.5], [3, 29], [5.5, 29.5]),
    nearArm: A([9, 18.5], [6.5, 20], [5, 20.5]),
    farArm: A([16.5, 18.5], [18, 18], [19.5, 18]),
  },
  {
    neck: [11, 16],
    waist: [11.5, 21.5],
    head: "down",
    near: L([10, 23], [7, 24], [5, 21.5], [5, 21], [3, 19]),
    far: L([14, 23], [15.5, 25.5], [16.5, 28.5], [15, 29.5], [18, 29.5]),
    nearArm: A([9, 17.5], [7, 19], [6.5, 20]),
    farArm: A([17, 17], [19, 16.5], [20.5, 15]),
  },
  {
    neck: [15, 18],
    waist: [12.5, 23],
    head: "down",
    near: L([14.5, 24], [17.5, 25], [20, 26.5], [20, 27], [23, 28.5]),
    far: L([11, 24], [11.5, 26], [12, 28.5], [10, 29.5], [13, 29.5]),
    nearArm: A([11, 19], [8, 18], [5, 18]),
    farArm: A([17.5, 19.5], [19.5, 20.5], [21, 20.5]),
  },
  {
    neck: [10.5, 13],
    waist: [11, 19],
    head: "shout",
    near: L([14, 20], [17.5, 17.5], [21, 14.5], [22, 13], [24, 11]),
    far: L([10, 20], [9, 22.5], [7, 25], [5.5, 26], [8.5, 26.5]),
    nearArm: A([9, 14.5], [6.5, 15.5], [5, 15.5]),
    farArm: A([15, 14.5], [17, 15.5], [18, 15]),
  },
  {
    neck: [13.5, 17.5],
    waist: [13, 22.5],
    head: "side",
    near: L([17, 24], [19, 26], [19.5, 28.5], [18, 29.5], [21.5, 29.5]),
    far: L([11.5, 24], [9, 25], [6, 25], [5, 26], [4.5, 23.5]),
    nearArm: A([10.5, 18.5], [8, 20], [7, 20.5]),
    farArm: A([18, 18.5], [19.5, 18], [21, 18]),
  },
  {
    neck: [13, 16],
    waist: [13, 21.5],
    head: "side",
    near: L([16, 23], [18, 25.5], [19.5, 28.5], [19, 29.5], [22, 29.5]),
    far: L([10.5, 23], [9, 25.5], [7, 28.5], [5, 29.5], [8.5, 29.5]),
    nearArm: A([9.5, 17], [7.5, 18], [6.5, 18.5]),
    farArm: A([17, 17], [18.5, 19], [20, 18.5]),
  },
];

/**
 * The finesse, curled with the inside of the foot: the approach, the wind-up, the inside
 * of the boot round the ball (**strike, frame 2**), the leg wrapped across, the step.
 */
export const FINESSE: readonly YouthPose[] = [
  {
    neck: [12, 16],
    waist: [12.5, 21.5],
    head: "down",
    near: L([15.5, 23], [17.5, 25.5], [18, 28.5], [17, 29.5], [20.5, 29.5]),
    far: L([11, 23], [9, 25.5], [6, 28.5], [4, 29.5], [7, 29.5]),
    nearArm: A([9, 17], [7, 18], [5, 18]),
    farArm: A([17, 17], [18.5, 18], [19.5, 18]),
  },
  {
    neck: [10.5, 16],
    waist: [11, 21.5],
    head: "down",
    near: L([9, 23], [6, 25], [4.5, 26.5], [4.5, 27.5], [7, 28.5]),
    far: L([13.5, 23], [16, 25.5], [17.5, 28.5], [16, 29.5], [19, 29.5]),
    nearArm: A([8.5, 17], [5.5, 16.5], [3.5, 15.5]),
    farArm: A([15.5, 17], [18.5, 17], [20.5, 16.5]),
  },
  {
    neck: [12, 16],
    waist: [12.5, 21.5],
    head: "down",
    near: L([16, 23], [19, 25], [21, 27], [21, 27.5], [23, 29.5]),
    far: L([12.5, 23], [14, 25.5], [14.5, 28.5], [12.5, 29.5], [16, 29.5]),
    nearArm: A([10, 17], [7.5, 15.5], [6, 14.5]),
    farArm: A([18, 17], [20, 18], [22, 16.5]),
  },
  {
    neck: [13, 16],
    waist: [13, 21.5],
    head: "side",
    near: L([15, 23.5], [18.5, 23.5], [21.5, 24.5], [22, 25.5], [24, 26.5]),
    far: L([11.5, 23], [11.5, 25.5], [11.5, 28.5], [10, 29.5], [13, 29.5]),
    nearArm: A([9.5, 17], [6.5, 18], [4, 17.5]),
    farArm: A([17, 17], [20, 18], [23, 17.5]),
  },
  {
    neck: [13, 16],
    waist: [13, 21.5],
    head: "side",
    near: L([15, 23], [18, 25.5], [20, 28], [20.5, 28.5], [23, 29.5]),
    far: L([11, 23], [11.5, 25.5], [11.5, 28.5], [10, 29.5], [13, 29.5]),
    nearArm: A([9.5, 17], [7.5, 18], [6.5, 18.5]),
    farArm: A([17, 17], [19.5, 18.5], [22.5, 18]),
  },
];

/**
 * The bicycle kick (the worldie at tiers 0 and 1), in its own 40 x 44 cell: anchor column
 * 20, soles row 42, their outline row 43 on y - 1. His back to the goal: he looks up at the
 * ball, crouches, throws himself back, lies flat in the air, the near leg scissors over
 * onto the ball (**strike, frame 4**), he falls, lands on his back, sits up.
 */
export const BICYCLE: readonly YouthPose[] = [
  {
    facing: -1,
    neck: [21, 28],
    waist: [21, 33.5],
    head: "upL",
    near: L([19, 35], [18.5, 38], [18.5, 40.5], [19, 41.5], [16, 41.5]),
    far: L([23.5, 35], [24, 38], [24, 40.5], [25, 41.5], [22.5, 41.5]),
    nearArm: A([17, 29], [16.5, 31], [16.5, 32.5]),
    farArm: A([25.5, 29], [27, 30.5], [28.5, 30]),
  },
  {
    facing: -1,
    neck: [21, 31],
    waist: [21.5, 35.5],
    head: "upL",
    near: L([19, 36.5], [17, 38], [18, 40.5], [19, 41.5], [15.5, 41.5]),
    far: L([24, 36.5], [25, 38], [24.5, 40.5], [25.5, 41.5], [22.5, 41.5]),
    nearArm: A([17.5, 32], [17, 33.5], [17.5, 35.5]),
    farArm: A([25.5, 32], [28, 33], [30, 33.5]),
  },
  {
    facing: -1,
    neck: [27, 27.5],
    waist: [23, 32.5],
    head: "upL",
    headAt: [22, 16],
    far: L([20.5, 33.5], [17, 32], [13, 29.5], [13, 29], [10.5, 27]),
    near: L([23, 34.5], [22, 37.5], [22.5, 40], [21.5, 40.5], [24.5, 41.5]),
    farArm: A([24.5, 28], [22.5, 26], [21, 24]),
    nearArm: A([29, 28.5], [31, 30], [33.5, 30]),
  },
  {
    facing: -1,
    neck: [25, 24.5],
    waist: [17.5, 24.5],
    head: "lie",
    headAt: [25, 16],
    far: L([17, 23], [16, 19.5], [16, 16.5], [15, 15], [18.5, 14.5]),
    near: L([17, 26.5], [13, 26.5], [10.5, 28.5], [10.5, 30], [8.5, 30.5]),
    farArm: A([23, 22.5], [25, 20.5], [26, 18.5]),
    nearArm: A([23, 27], [24.5, 29], [26.5, 31]),
  },
  {
    facing: -1,
    neck: [26, 24],
    waist: [18.5, 24],
    head: "lie",
    headAt: [25, 16],
    near: L([18.5, 21.5], [20.5, 17], [22.5, 13.5], [23, 13.5], [25, 11]),
    far: L([18.5, 26.5], [14.5, 27], [11.5, 29.5], [10.5, 30], [8.5, 31]),
    nearArm: A([24, 28], [26, 30.5], [28, 32.5]),
    farArm: A([24, 22], [26, 20], [27.5, 18.5]),
  },
  // 5: falling, head first: the body at a slant, the near hand reaching down to break the
  // fall, the legs still scissoring over him.
  {
    facing: -1,
    reach: 1,
    neck: [25.5, 34],
    waist: [21, 29.5],
    head: "lie",
    headAt: [26, 26],
    near: L([21.5, 28], [20.5, 23.5], [23, 19.5], [23.5, 19], [25, 17.5]),
    far: L([19.5, 30], [15.5, 27], [12.5, 24.5], [12, 24.5], [10, 26]),
    nearArm: A([23.5, 36], [24, 39], [25.5, 41]),
    farArm: A([26, 32], [28.5, 28.5], [31.5, 27]),
  },
  // 6: down on his back, the near knee up, a fist punched at the sky.
  {
    facing: -1,
    reach: 1,
    neck: [25, 38],
    waist: [18, 38],
    head: "lie",
    headAt: [26, 29],
    near: L([17.5, 36.5], [14, 33], [11.5, 37], [11.5, 40], [8.5, 41.5]),
    far: L([17.5, 40], [13, 41], [8.5, 41.5], [8, 41.5], [6, 40]),
    farArm: A([23.5, 35], [26.5, 33], [30, 32.5]),
    nearArm: A([23, 39], [21, 35.5], [22, 32]),
  },
  // 7: sat up facing the goal, leaning back on the far hand, pointing at it, shouting.
  {
    reach: 1,
    neck: [17.5, 33],
    waist: [18.5, 39.5],
    head: "shout",
    near: L([20, 40], [23.5, 37], [26, 40], [25.5, 41.5], [28.5, 41.5]),
    far: L([17.5, 41], [22.5, 41.5], [28, 41.5], [28.5, 41.5], [31, 40]),
    nearArm: A([19.5, 35.5], [23, 36], [26.5, 35]),
    farArm: A([14.5, 35], [12.5, 38], [12, 41]),
  },
];

type Shot = Exclude<ShotAnim, "kick">;

/** Every shot's poses (the art is painted from them). */
export const YOUTH_SHOT_POSES: Readonly<Record<Shot, readonly YouthPose[]>> = {
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
 * Where the ball's centre is, frame by frame, as an offset from (x, y), facing right (a
 * spot's x is its column - 14, its y its row - 32; the bicycle's column - 20 and row - 44),
 * for the 6 x 6 ball in its ink ring, centred on it. At rest it is where the
 * adult's is (the scene starts every shot from the kick's ball). On the strike frame the
 * boot's fill touches the ring. `YOUTH_BALL` (people.ts) holds them
 * (.snaps/detail2/B2-spots.md); a test keeps the two equal.
 */
export const YOUTH_SHOT_BALL: Readonly<Record<Shot, readonly Spot[]>> = {
  tapin: [REST, REST, null, null],
  toepoke: [REST, REST, null, null, null],
  trivela: [REST, REST, REST, null, null, null],
  chip: [REST, REST, REST, null, null],
  power: [REST, REST, REST, null, null, null],
  finesse: [REST, REST, REST, null, null],
  bicycle: [
    at(-9, -13),
    at(-5, -33),
    at(1, -39),
    at(7, -37),
    at(9, -35),
    null,
    null,
    null,
  ],
};

/** Every pose of a shot painted, as `figure()` reads frames (28 x 32; the bicycle 40 x 44). */
export function youthShotArt(anim: Shot): string {
  const big = anim === "bicycle";
  return frames(
    YOUTH_SHOT_POSES[anim].map((p) =>
      paintYouthPose(p, big ? 40 : 28, big ? 44 : 32),
    ),
  );
}

/** The shots' art for `people.ts`, each built on first use. */
export const YOUTH_SHOTS: ArtRecord<ShotAnim> = {
  tapin: () => youthShotArt("tapin"),
  toepoke: () => youthShotArt("toepoke"),
  trivela: () => youthShotArt("trivela"),
  chip: () => youthShotArt("chip"),
  power: () => youthShotArt("power"),
  finesse: () => youthShotArt("finesse"),
  bicycle: () => youthShotArt("bicycle"),
};
