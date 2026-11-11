/**
 * The goal (docs/CAREER_SCENE.md section 3), seen in profile and turned a little towards
 * the camera: the near post stands at (lineX + 1, groundY + 2), the far post at
 * (lineX - 3, groundY - 3), the crossbar joins their tops and the net falls away to the
 * right. The back layer is the far post and the far side's netting (drawn before the
 * cast); the front layer is the roof and back of the net, the near side's netting, the
 * crossbar and the near post (drawn after the ball), so a ball in the net is inside it and
 * shows through the mesh. The mesh is a sparse diamond lattice.
 */

import { P } from "~/art/palette";
import { shade, type Color, type Surface } from "~/pixel";
import type { Geo, Grade } from "./paint";
import type { GroundGoal, NetBulge, Tier } from "./types";

interface Shape {
  /** Height of a post (crossbar above its foot). */
  ph: number;
  /** How far the net runs back. */
  depth: number;
}

const SHAPES = {
  jumpers: { ph: 15, depth: 0 },
  small: { ph: 17, depth: 8 },
  full: { ph: 24, depth: 11 },
} as const satisfies Record<GroundGoal["kind"], Shape>;

export function goalKind(tier: Tier): GroundGoal["kind"] {
  return tier === 0 ? "jumpers" : tier === 1 ? "small" : "full";
}

export function goalFor(tier: Tier, g: Geo): GroundGoal {
  const kind = goalKind(tier);
  const sh = SHAPES[kind];
  return { kind, lineX: g.goalX, barY: g.gy - sh.ph, depth: sh.depth };
}

export interface GoalColors {
  post: Color;
  postShade: Color;
  net: Color;
  netFar: Color;
  ground: Color;
  jumperA: Color;
  jumperB: Color;
  jumperShade: Color;
}

export function goalColors(G: Grade, tier: Tier): GoalColors {
  const dingy = tier === 1;
  return {
    post: G(dingy ? P.chalk : P.white),
    postShade: G(dingy ? P.mist : P.steelHi),
    net: G(dingy ? P.mist : P.chalk),
    netFar: G(dingy ? P.steel : P.mist),
    ground: G(P.grassDeep),
    jumperA: G(P.home),
    jumperB: G(P.night),
    jumperShade: G(shade(P.home, -0.35)),
  };
}

/** The diamond lattice: a pixel of netting here? */
function mesh(x: number, y: number): boolean {
  return ((x + y) & 3) === 0 || ((x - y) & 3) === 0;
}

/** How far the back of the net is pushed out at row y. */
function push(y: number, bulge: NetBulge | null | undefined): number {
  if (!bulge || !(bulge.amount > 0)) return 0;
  const a = Math.min(1, bulge.amount);
  const f = 1 - Math.abs(y - bulge.y) / 8;
  return f > 0 ? Math.round(a * 5 * f) : 0;
}

/**
 * One side panel of the net, its post standing at (px, foot): from the roof's edge and the
 * post back to the back edge, which leans out to the right as it falls.
 */
function panel(
  s: Surface,
  px: number,
  foot: number,
  sh: Shape,
  sag: boolean,
  c: Color,
  edge: Color,
  bulge: NetBulge | null | undefined,
  diag: 1 | -1,
): void {
  const top = foot - sh.ph;
  const backTop = top + 5;
  const d = sh.depth;
  for (let y = top; y < foot; y++) {
    // under the roof's edge, which slopes down from the bar to the back; then down the
    // back edge, which leans out as it falls
    const back =
      y < backTop
        ? px + Math.round(((y - top) * (d - 3)) / 5)
        : px +
          d -
          3 +
          Math.round(((y - backTop) * 3) / Math.max(1, foot - 1 - backTop));
    const right = back + push(y, bulge);
    // one diagonal of the lattice per side: the two sides together make the diamonds
    for (let x = px + 1; x < right; x++)
      if (((x + diag * y) & 3) === 0) s.px(x, y, c);
    if (y >= backTop) s.px(right, y, edge);
  }
  // the roof edge
  const sagAt = sag ? 1 : 0;
  for (let i = 0; i <= d - 3; i++) {
    const y = top + Math.round((i * 5) / Math.max(1, d - 3));
    s.px(px + i, y + (i > 1 && i < d - 4 ? sagAt : 0), edge);
  }
}

export function drawGoalBack(
  s: Surface,
  g: Geo,
  kind: GroundGoal["kind"],
  c: GoalColors,
): void {
  const fx = g.goalX - 3;
  const ffoot = g.gy - 3;
  if (kind === "jumpers") {
    jumpers(s, fx, ffoot, c.jumperB, c.jumperB, c.jumperShade);
    return;
  }
  const sh = SHAPES[kind];
  // the net's foot on the grass, from the far post back
  s.hline(fx + 1, ffoot - 1, sh.depth, c.ground);
  panel(s, fx, ffoot, sh, kind === "small", c.netFar, c.netFar, null, -1);
  // the far post
  s.vline(fx, ffoot - sh.ph, sh.ph, c.postShade);
  if (kind === "full") s.vline(fx - 1, ffoot - sh.ph, sh.ph, c.postShade);
}

export function drawGoalFront(
  s: Surface,
  g: Geo,
  kind: GroundGoal["kind"],
  c: GoalColors,
  bulge: NetBulge | null | undefined,
): void {
  const nx = g.goalX + 1;
  const nfoot = g.gy + 2;
  if (kind === "jumpers") {
    jumpers(s, nx, nfoot, c.jumperA, c.jumperB, c.jumperShade);
    return;
  }
  const sh = SHAPES[kind];
  const fx = g.goalX - 3;
  const ffoot = g.gy - 3;
  const ntop = nfoot - sh.ph;
  const ftop = ffoot - sh.ph;
  // the back of the net: between the two back edges, rows from the far back top to the foot
  const d = sh.depth;
  for (let y = ftop + 5; y < nfoot; y++) {
    const p = push(y, bulge);
    const t = (y - (ftop + 5)) / Math.max(1, nfoot - 1 - (ftop + 5));
    const x = Math.round(fx + d - 3 + t * 3 + (nx - fx) * t) + p;
    if (mesh(x, y) || y % 3 === 0) s.px(x, y, c.netFar);
  }
  // the roof of the net, between the crossbar and the back
  for (let y = ftop; y < ntop + 5; y++) {
    const a = Math.max(fx, fx + Math.round(((y - ftop) * (nx - fx)) / 5));
    const b = Math.min(nx + d - 3, a + d - 2);
    for (let x = a + 1; x < b; x++)
      if (((x - y) & 3) === 0) s.px(x, y, c.netFar);
  }
  // the near side's netting, then the frame
  panel(s, nx, nfoot, sh, kind === "small", c.net, c.net, bulge, 1);
  s.hline(nx + 1, nfoot - 1, d, c.ground);
  s.line(fx, ftop, nx, ntop, c.post);
  s.line(fx, ftop + 1, nx, ntop + 1, c.postShade);
  if (kind === "small") {
    // a wonky post: it leans a pixel at the top
    s.vline(nx, ntop + 6, sh.ph - 6, c.post);
    s.vline(nx + 1, ntop, 6, c.post);
    s.px(nx, ntop, c.post);
  } else {
    s.vline(nx, ntop, sh.ph, c.post);
    s.vline(nx + 1, ntop + 1, sh.ph - 1, c.postShade);
  }
}

/** A pile of jumpers: a lump 6 wide and 3 tall standing on (x, foot). */
function jumpers(
  s: Surface,
  x: number,
  foot: number,
  a: Color,
  b: Color,
  low: Color,
): void {
  s.hline(x - 3, foot - 1, 6, low);
  s.hline(x - 3, foot - 2, 6, a);
  s.hline(x - 2, foot - 3, 4, b);
  s.px(x + 1, foot - 3, a);
  s.px(x + 2, foot - 2, b);
}
