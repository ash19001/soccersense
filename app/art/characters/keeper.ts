/**
 * The goalkeeper: 24 x 36 in a 32 x 40 cell (the sprawl 48 x 40, anchor
 * column 24), facing right, drawn with `LEGEND` (figure.ts), gloves in `g`/`G`/`w`.
 * Package C (wave 2).
 *
 * Anchor: column 16 (the sprawl 24) is the ground point's x; the boots' soles are row 38
 * and their outline row 39 is the ground row y - 1. Spots are offsets from (x, y), facing
 * right (a flipped spot is `-dx`: `people.ts`).
 *
 * How the frames are made: the same small rig as the hero's shots (A2's, in
 * `adult-shots.ts`), so the keeper is one style with everyone else. The shirt is
 * sheared along the line from the neck to the waist; arms and legs are strokes through
 * their joints, coloured along their length and shaded on the side away from the light
 * (the top left). The keeper's own: long sleeves to a dark cuff, and big gloves (a lit
 * palm `w`, the glove `g`, its shade `G`), the far glove in shade. A1's heads
 * (`PARTS`) give him the hero's build of face; the shirt's collar and badge are the
 * kit's trim. Fill only, as every frame: `figure()` adds the 1 px ink outline.
 *
 * Near and far, as in the shots: he faces right, the near side is toward us. Far limbs are
 * drawn first in shade, near limbs last with a 1 px line where they cross the body.
 *
 * Every frame is built once, on first use (`KEEPER` holds functions).
 */

import { PARTS } from "./adult";
import { type ArtRecord, frames } from "./figure";
import type { KeeperAnim, SpotTable } from "./people";

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
      throw new Error(`keeper: pixel outside the cell at ${x},${y}`);
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
      // the light on the shoulder: a line along its top and down the lit edge
      if (u >= 0.5 && u < 1.5 && w > -half + 0.5 && w < -1.5) return "U";
      if (u >= 0.5 && u < 3.5 && w < -half + 1) return "U";
      return "t";
    },
  );
  lay(g, layer);
}

/**
 * The shorts' side stripe in the shirt's colour, as the players' (adult-shots.ts):
 * down the side of the near leg of the shorts, from the waistband to the hem.
 */
function paintStripe(g: Grid, leg: Leg, waist: Pt): void {
  const [hx, hy] = leg.hip;
  const dx = leg.knee[0] - hx;
  const dy = leg.knee[1] - hy;
  const len = Math.hypot(dx, dy) || 1;
  const down = Math.min(SHORTS_LEG, len - 1.2) - 0.4;
  const top: Pt = [hx, Math.min(hy, waist[1] + 0.5)];
  const end: Pt = [hx + (dx / len) * down, hy + (dy / len) * down];
  for (const i of stroke(g, [top, end], [0.5, 0.5], () => "t").keys()) {
    const was = g.c[i];
    if (was === "p") g.c[i] = "t";
    else if (was === "q") g.c[i] = "T";
  }
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
          `keeper: head outside the cell at ${x0 + dx},${y0 + dy}`,
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
  paintStripe(g, pose.near, pose.waist);
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
// Poses (cell coordinates: 32 x 40, anchor column 16, soles row 38; the sprawl 48 x 40,
// anchor column 24)
// ---------------------------------------------------------------------------

/** Ready: crouched on bent knees, weight forward, both gloves up in front at the waist. */
const READY: readonly Pose[] = [
  {
    neck: [16.5, 22.5],
    waist: [14, 29.5],
    head: "side",
    near: L([16.5, 31.5], [21, 33.5], [21, 36], [20, 37.5], [24, 37.5]),
    far: L([12, 31.5], [8, 33.5], [8.5, 36], [7, 37.5], [11, 37.5]),
    nearArm: A([19.5, 24], [20, 28.5], [24, 28]),
    farArm: A([13, 24], [18.5, 27], [25, 24]),
  },
  {
    neck: [16.5, 23.5],
    waist: [14, 30.5],
    head: "side",
    near: L([16.5, 32], [21, 33.5], [21, 36], [20, 37.5], [24, 37.5]),
    far: L([12, 32], [8, 33.5], [8.5, 36], [7, 37.5], [11, 37.5]),
    nearArm: A([19.5, 25], [20, 29.5], [24, 29]),
    farArm: A([13, 25], [18.5, 28], [25, 25]),
  },
];

/** The leap for the top corner: gathered, then up and back with both arms at full stretch. */
const LEAP: readonly Pose[] = [
  {
    neck: [17, 23],
    waist: [15, 30],
    head: "side",
    near: L([16.5, 32], [20.5, 34], [19, 36.5], [18, 37.5], [22, 37.5]),
    far: L([13, 32], [9.5, 34.5], [10.5, 36.5], [9, 37.5], [13, 37.5]),
    nearArm: A([19, 24.5], [14, 28], [7, 27]),
    farArm: A([13, 24.5], [8.5, 26], [4.5, 24.5]),
  },
  {
    neck: [14.5, 15.5],
    waist: [17.5, 23],
    head: "up",
    headAt: [10, 3],
    near: L([18.5, 25], [21.5, 30], [23.5, 34], [22.5, 35.5], [26, 36.5]),
    far: L([15.5, 25], [12, 29], [15, 32.5], [14, 34], [17.5, 34]),
    nearArm: A([12, 17], [7.5, 12.5], [4, 8]),
    farArm: A([15.5, 16.5], [10.5, 11], [7, 5]),
  },
  {
    neck: [14, 15.5],
    waist: [18, 22.5],
    head: "up",
    headAt: [10, 3],
    near: L([18.5, 24.5], [22, 29], [24.5, 33], [23.5, 34.5], [27, 35.5]),
    far: L([15.5, 24.5], [11.5, 28], [14.5, 31.5], [13.5, 33], [17, 33]),
    nearArm: A([11.5, 17], [6.5, 13], [3, 9]),
    farArm: A([15, 16.5], [9.5, 11.5], [5, 6]),
  },
];

/** Down at the shooter's feet: crouched forward and reaching, then flat on the ball. */
const SMOTHER: readonly Pose[] = [
  {
    neck: [19, 24],
    waist: [12.5, 30],
    head: "down",
    headAt: [15, 12],
    near: L([13.5, 32], [18, 34.5], [14.5, 36.5], [13, 37.5], [17, 37.5]),
    far: L([10.5, 31.5], [7, 34], [4.5, 36.5], [3, 37.5], [6.5, 37.5]),
    nearArm: A([20, 25.5], [23, 29.5], [26.5, 31]),
    farArm: A([17, 25], [21.5, 27.5], [25.5, 28]),
  },
  {
    neck: [17, 32],
    waist: [8, 32.5],
    head: "side",
    headAt: [12, 23],
    near: L([6.5, 34], [3, 36], [3.5, 31.5], [2.5, 30], [4.5, 28.5]),
    far: L([6.5, 32], [2.5, 31], [5, 27.5], [4.5, 26], [6.5, 25]),
    nearArm: A([16, 34], [21, 36], [27, 35]),
    farArm: A([16.5, 31], [21, 32.5], [27, 31]),
    headLast: true,
  },
];

/** The ball held to his chest. */
const HOLD: readonly Pose[] = [
  {
    neck: [14.5, 18],
    waist: [14.5, 26],
    head: "side",
    near: L([16.5, 28], [17.5, 32], [17.5, 35.5], [16.5, 37.5], [20.5, 37.5]),
    far: L([12, 28], [11.5, 32], [11.5, 35.5], [10, 37.5], [14, 37.5]),
    nearArm: A([18.5, 19.5], [19, 25], [22, 26]),
    farArm: A([11, 19.5], [16, 21], [22, 18]),
  },
];

/** Beaten: down on his knees, sat back on his heels, head bowed, gloves on the grass. */
const BEATEN: readonly Pose[] = [
  {
    neck: [15.5, 24],
    waist: [15, 31.5],
    head: "bowed",
    headAt: [10, 12],
    near: L([17, 33], [21, 36.5], [14, 37], [12.5, 35.5], [9.5, 37.5]),
    far: L([13, 33], [17, 36.5], [10, 37], [8.5, 35.5], [5.5, 37.5]),
    nearArm: A([19.5, 25.5], [21.5, 30], [23.5, 34.5]),
    farArm: A([11.5, 25.5], [9.5, 30], [8.5, 34]),
  },
];

/** Caught off his line: arms spread, reaching up and back, then turned to watch it in. */
const STRANDED: readonly Pose[] = [
  {
    neck: [15, 18.5],
    waist: [15, 26.5],
    head: "side",
    near: L([17, 28.5], [19, 32], [19.5, 35.5], [18.5, 37.5], [22.5, 37.5]),
    far: L([12.5, 28.5], [10.5, 32], [10, 35.5], [8.5, 37.5], [12.5, 37.5]),
    nearArm: A([19.5, 20], [22.5, 23.5], [25, 26]),
    farArm: A([10.5, 20], [7.5, 23.5], [5, 26]),
  },
  {
    neck: [14, 17],
    waist: [16, 25.5],
    head: "up",
    near: L([16, 27.5], [12.5, 31.5], [9, 34.5], [6.5, 36.5], [10, 37.5]),
    far: L([18, 27.5], [20, 31.5], [20, 35.5], [19, 37.5], [23, 37.5]),
    nearArm: A([12.5, 18.5], [8, 12.5], [4.5, 6.5]),
    farArm: A([18, 18.5], [21.5, 21], [24.5, 22.5]),
    headLast: true,
  },
  {
    neck: [16, 19],
    waist: [16, 27],
    head: "sideL",
    facing: -1,
    near: L([14, 29], [13, 32.5], [13, 35.5], [14.5, 37.5], [10.5, 37.5]),
    far: L([18, 29], [19, 32.5], [19.5, 35.5], [21, 37.5], [17, 37.5]),
    nearArm: A([11.5, 20.5], [9, 24], [7.5, 27.5]),
    farArm: A([20.5, 20.5], [22, 24.5], [23, 28]),
  },
];

/** A full-length dive low to his left (toward his goal): the push, in the air, down. */
const SPRAWL: readonly Pose[] = [
  {
    neck: [16.5, 24],
    waist: [24.5, 29],
    head: "sideL",
    facing: -1,
    near: L([25.5, 31], [29.5, 33.5], [33, 36], [34.5, 35.5], [32.5, 37.5]),
    far: L([24.5, 30.5], [20.5, 32], [22.5, 35.5], [24.5, 36.5], [21, 37.5]),
    nearArm: A([16, 26], [10, 26.5], [4.5, 25.5]),
    farArm: A([17.5, 24.5], [11.5, 21], [6, 18.5]),
  },
  {
    neck: [14, 26],
    waist: [25, 27],
    head: "sideL",
    facing: -1,
    headAt: [3, 14],
    near: L([27, 28], [33, 28.5], [38.5, 28], [40, 26.5], [41.5, 30]),
    far: L([26, 26], [31, 23.5], [36, 21.5], [37.5, 20], [39, 23]),
    nearArm: A([14, 28], [9.5, 28.5], [5, 28.5]),
    farArm: A([14, 25.5], [9.5, 25], [5.5, 25]),
  },
  {
    neck: [14, 31],
    waist: [25, 32],
    head: "sideL",
    facing: -1,
    headAt: [3, 20],
    near: L([27, 33], [33, 34], [38.5, 34.5], [40, 32.5], [41.5, 36.5]),
    far: L([26, 31], [31, 29], [36, 28], [37.5, 26.5], [39, 29.5]),
    nearArm: A([14, 33], [9.5, 34], [5, 34]),
    farArm: A([14, 30.5], [9.5, 30.5], [5.5, 30.5]),
  },
];

const draw =
  (poses: readonly Pose[], w = 32): (() => string) =>
  () =>
    frames(poses.map((p) => paintPose(p, w)));

export const KEEPER: ArtRecord<KeeperAnim> = {
  ready: draw(READY),
  leap: draw(LEAP),
  smother: draw(SMOTHER),
  hold: draw(HOLD),
  beaten: draw(BEATEN),
  stranded: draw(STRANDED),
  sprawl: draw(SPRAWL, 48),
};

const p = (x: number, y: number) => ({ x, y });

/** Where his gloves are (their middle), frame by frame, facing right. */
export const KEEPER_GLOVES: SpotTable<KeeperAnim> = {
  ready: [p(8, -16), p(9, -15)],
  leap: [p(-11, -14), p(-9, -35), p(-11, -35)],
  smother: [p(10, -10), p(11, -7)],
  hold: [p(6, -18)],
  beaten: [null],
  stranded: [p(9, -14), p(-11, -33), p(7, -12)],
  sprawl: [p(-20, -15), p(-19, -13), p(-19, -8)],
};
