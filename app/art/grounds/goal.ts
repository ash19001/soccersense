/**
 * The goal (docs/CAREER_SCENE.md section 3), seen in profile and turned a little towards
 * the camera: the near post's columns `lineX + 2 .. lineX + 5`, its foot on row `gy + 4`
 * (its last pixel `gy + 3`); the far post's columns `lineX - 8 .. lineX - 5`, its foot
 * `gy - 6`. The crossbar joins their tops and the net falls away to the right. The back
 * layer is the far post and the far side's netting (drawn before the cast); the front layer
 * is the roof and back of the net, the near side's netting, the crossbar and the near post
 * (drawn after the ball), so a ball in the net is inside it and shows through the mesh.
 *
 * - Posts and crossbars are physical things (.snaps/detail2/DECISIONS.md 2): the full
 *   goal's 4 px posts with a lit face, a shaded side and a dark edge; the small goal's 2 px
 *   wonky post.
 * - The net's strings are 1 px, on a sparse diamond lattice with 8 px diamonds, so a ball in
 *   the net (6 x 6) shows through it. A shot pushes the back of the net out up to 10 px over
 *   16 rows either side.
 * - `barY = gy - 48` (full), `gy - 34` (small), `gy - 30` (jumpers); `depth` 22 / 16 / 0.
 */

import {
  TRANSPARENT,
  drawSprite,
  shade,
  sprite,
  type Color,
  type Sprite,
  type Surface,
} from "~/pixel";
import { P } from "~/art/palette";
import type { Geo, Grade } from "./paint";
import type { GroundGoal, NetBulge, Tier } from "./types";
import type { Era } from "~/art/era";
import { ngGoalBack, ngGoalColors, ngGoalFront } from "./nextgen-low";
import {
  arenaGoalBack,
  arenaGoalColors,
  arenaGoalFront,
  type ArenaGoal,
} from "./nextgen-high";
import {
  drawCapOnPile,
  drawRetroGoalBack,
  drawRetroGoalFront,
  retroGoalColors,
  type GoalGeometry,
} from "./goal-retro";

interface Shape {
  /** Height of a post (crossbar above its foot). */
  ph: number;
  /** How far the net runs back. */
  depth: number;
}

const SHAPES = {
  jumpers: { ph: 30, depth: 0 },
  small: { ph: 34, depth: 16 },
  full: { ph: 48, depth: 22 },
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
  /** The posts' dark edge. */
  postDark: Color;
  net: Color;
  netFar: Color;
  /** The shade under each string of the near netting and of the far side. */
  netShade: Color;
  netFarShade: Color;
  ground: Color;
  /** The jumpers, their lit folds and creases. */
  jumperA: Color;
  jumperAHi: Color;
  jumperShade: Color;
  jumperB: Color;
  jumperBHi: Color;
  jumperBLo: Color;
  /** The era it is drawn in (`~/art/era`). */
  era?: Era;
  /** Which goal is drawn: today's, or RETRO's of wood and rope (goal-retro.ts). */
  style?: "today" | "wood";
  /** RETRO's flat cap on the near pile of jackets (tier 0), lit and in shade. */
  cap?: readonly [Color, Color, Color];
  /** NEXT-GEN's arena goal, tiers 4 to 7 (nextgen-high.ts). */
  arena?: ArenaGoal;
}

export function goalColors(
  G: Grade,
  tier: Tier,
  era: Era = "today",
): GoalColors {
  // RETRO's wooden goal at every tier (tiers 4 to 7 take tier 2's and 3's as they are)
  if (era === "retro") {
    return {
      ...retroGoalColors(G, tier),
      era,
      style: "wood",
      cap: [G(P.slate), G(P.steel), G(P.night)],
    };
  }
  const dingy = tier === 1;
  const today: GoalColors = {
    post: G(dingy ? P.chalk : P.white),
    postShade: G(dingy ? P.mist : P.steelHi),
    net: G(dingy ? P.mist : P.chalk),
    netFar: G(dingy ? P.steel : P.mist),
    ground: G(P.grassDeep),
    jumperA: G(P.home),
    jumperB: G(P.night),
    jumperShade: G(shade(P.home, -0.35)),
    postDark: G(dingy ? P.steel : P.mist),
    jumperAHi: G(P.homeLight),
    jumperBHi: G(P.slate),
    jumperBLo: G(P.ink),
    netShade: G(dingy ? P.slate : P.steel),
    netFarShade: G(dingy ? P.night : P.slate),
  };
  // NEXT-GEN: slim posts and nets of light (nextgen-low.ts); the arena's tubes of light
  // from tier 4 (nextgen-high.ts)
  if (era === "nextgen") {
    const arena = tier >= 4 ? arenaGoalColors(G) : undefined;
    return { ...today, ...ngGoalColors(G), era, arena };
  }
  return today;
}

/** Rows the roof of the net slopes down over, and how far its back edge leans out. */
const ROOF = 10;
const LEAN = 6;
/** The lattice's spacing. */
const MESH = 8;
/** The full goal's post and bar thickness, and the small goal's. */
const THICK = 4;
const THIN = 2;

/** The near post's left column and foot, the far post's right column and foot. */
function feet(g: Geo): {
  nx: number;
  nfoot: number;
  fx: number;
  ffoot: number;
} {
  return {
    nx: g.goalX + 2,
    nfoot: g.gy + 4,
    fx: g.goalX - 5,
    ffoot: g.gy - 6,
  };
}

/** Is there a string of the diamond lattice here? */
function mesh(x: number, y: number): boolean {
  return ((x + y) & (MESH - 1)) === 0 || ((x - y) & (MESH - 1)) === 0;
}

/** How far the back of the net is pushed out at row y: up to 10 px over 16 rows. */
function push(y: number, bulge: NetBulge | null | undefined): number {
  if (!bulge || !(bulge.amount > 0)) return 0;
  const a = Math.min(1, bulge.amount);
  const f = 1 - Math.abs(y - bulge.y) / 16;
  return f > 0 ? Math.round(a * 10 * f) : 0;
}

/**
 * One side panel of the net, its post's front column at `px`, standing on `foot`: one
 * diagonal of the lattice from the post back to the back edge (a 1 px string that leans out
 * as it falls), and the roof's edge sloping down from the bar.
 */
function panel(
  s: Surface,
  px: number,
  foot: number,
  sh: Shape,
  sag: boolean,
  c: Color,
  edge: Color,
  low: Color,
  bulge: NetBulge | null | undefined,
  diag: 1 | -1,
): void {
  const top = foot - sh.ph;
  const backTop = top + ROOF;
  const d = sh.depth;
  for (let y = top; y < foot; y++) {
    const back =
      y < backTop
        ? px + Math.round(((y - top) * (d - LEAN)) / ROOF)
        : px +
          d -
          LEAN +
          Math.round(((y - backTop) * LEAN) / Math.max(1, foot - 1 - backTop));
    const right = back + push(y, bulge);
    for (let x = px + 1; x < right; x++) {
      if (((x + diag * y) & (MESH - 1)) !== 0) continue;
      if (diag === 1) {
        // the near side: each 1 px string lit for most of a diamond's side and in shade
        // for the rest, like a twisted cord, so it reads on light and busy grounds alike
        // and a ball behind it still shows through
        s.px(x, y, (y & (MESH - 1)) < 5 ? c : low);
      } else {
        // the far side, in the net's shade: a 1 px string with its shade under it
        s.px(x, y, c);
        if (y + 1 < foot) s.px(x, y + 1, low);
      }
    }
    if (y >= backTop) s.px(right, y, edge);
  }
  // the roof's edge: a string from the bar down to the back, sagging in the middle when old
  const n = d - LEAN;
  for (let i = 0; i <= n; i++) {
    const y = top + Math.round((i * ROOF) / Math.max(1, n));
    const dip = sag && i > 2 && i < n - 2 ? (i > 4 && i < n - 4 ? 2 : 1) : 0;
    s.px(px + i, y + dip, edge);
    s.px(px + i, y + dip + 1, low);
  }
}

/** The net's foot on the grass: two rows, the pegged-down bottom of the net. */
function netFoot(
  s: Surface,
  x: number,
  foot: number,
  d: number,
  c: Color,
): void {
  s.hline(x, foot - 2, d, c);
  s.hline(x, foot - 1, d, c);
}

/** The goal's geometry, handed to an era's own goal (goal-retro.ts). */
function geometry(g: Geo, kind: GroundGoal["kind"]): GoalGeometry {
  const hit = geometries.get(kind);
  if (hit && hit.g === g) return hit.v;
  const sh = SHAPES[kind];
  const v: GoalGeometry = {
    ...feet(g),
    ph: sh.ph,
    depth: sh.depth,
    roof: ROOF,
    lean: LEAN,
    push,
  };
  geometries.set(kind, { g, v });
  return v;
}

/** The last geometry made for each kind of goal, so a frame allocates nothing. */
const geometries = new Map<GroundGoal["kind"], { g: Geo; v: GoalGeometry }>();

export function drawGoalBack(
  s: Surface,
  g: Geo,
  kind: GroundGoal["kind"],
  c: GoalColors,
): void {
  if (c.era === "nextgen") {
    if (c.arena && kind === "full") {
      return arenaGoalBack(s, g.goalX, g.gy, c.arena);
    }
    return ngGoalBack(s, g.goalX, g.gy, kind, c);
  }
  const { fx, ffoot } = feet(g);
  if (kind === "jumpers") {
    // the far pile: a dark jumper under a red one
    drawJumpers(
      s,
      g.goalX - 14,
      ffoot,
      darkJumper(c),
      redJumper(c),
      c.ground,
      c.net,
    );
    return;
  }
  if (c.style === "wood") {
    drawRetroGoalBack(s, geometry(g, kind), kind === "small", c);
    return;
  }
  const sh = SHAPES[kind];
  netFoot(s, fx + 1, ffoot, sh.depth, c.ground);
  panel(
    s,
    fx,
    ffoot,
    sh,
    kind === "small",
    c.netFar,
    c.netFar,
    c.netFarShade,
    null,
    -1,
  );
  // the far post, in the shade of the net's far side
  const top = ffoot - sh.ph;
  if (kind === "small") {
    s.vline(fx - 1, top, sh.ph, c.postShade);
    s.vline(fx, top, sh.ph, c.postDark);
    return;
  }
  s.rect(fx - 3, top, 3, sh.ph, c.postShade);
  s.vline(fx, top + 1, sh.ph - 1, c.postDark);
  s.px(fx - 3, top, c.postDark);
}

export function drawGoalFront(
  s: Surface,
  g: Geo,
  kind: GroundGoal["kind"],
  c: GoalColors,
  bulge: NetBulge | null | undefined,
): void {
  if (c.era === "nextgen") {
    if (c.arena && kind === "full") {
      return arenaGoalFront(s, g.goalX, g.gy, c.arena, bulge);
    }
    return ngGoalFront(s, g.goalX, g.gy, kind, c, bulge);
  }
  const { nx, nfoot, fx, ffoot } = feet(g);
  if (kind === "jumpers") {
    // the near pile: a red jumper under a dark one
    drawJumpers(
      s,
      g.goalX - 6,
      nfoot,
      redJumper(c),
      darkJumper(c),
      c.ground,
      c.net,
    );
    // RETRO: a flat cap dropped on top of it
    if (c.cap) drawCapOnPile(s, g.goalX - 3, nfoot - 11, ...c.cap);
    return;
  }
  if (c.style === "wood") {
    drawRetroGoalFront(s, geometry(g, kind), kind === "small", c, bulge);
    return;
  }
  const sh = SHAPES[kind];
  const d = sh.depth;
  const ntop = nfoot - sh.ph;
  const ftop = ffoot - sh.ph;
  // the back of the net: between the two back edges, from the far back top to the foot
  for (let y = ftop + ROOF; y < nfoot; y++) {
    const p = push(y, bulge);
    const t = (y - (ftop + ROOF)) / Math.max(1, nfoot - 1 - (ftop + ROOF));
    const x = Math.round(fx + d - LEAN + t * LEAN + (nx - fx) * t) + p;
    if (mesh(x, y) || y % 6 === 0) s.px(x, y, c.netFar);
  }
  // the roof of the net, between the crossbar and the back, in the bar's shade
  for (let y = ftop; y < ntop + ROOF; y++) {
    const a = Math.max(fx, fx + Math.round(((y - ftop) * (nx - fx)) / ROOF));
    const b = Math.min(nx + d - LEAN, a + d - LEAN + 1);
    for (let x = a + 1; x < b; x++) {
      if (((x - y) & (MESH - 1)) !== 0) continue;
      s.px(x, y, c.netFar);
      s.px(x - 1, y + 1, c.netFarShade);
    }
  }
  // the near side's netting, its foot, then the frame
  panel(s, nx, nfoot, sh, kind === "small", c.net, c.net, c.netShade, bulge, 1);
  netFoot(s, nx + 1, nfoot, d, c.ground);
  if (kind === "small") smallFrame(s, nx, ntop, fx, ftop, sh.ph, c);
  else fullFrame(s, nx, ntop, fx, ftop, sh.ph, c);
}

/**
 * The full goal's frame: a square bar 4 px thick swept from the far post's top to the near
 * post's, lit on top and to the left, shaded underneath; then the near post, a lit face, a
 * shaded side and a dark edge, with a glint where the light catches it.
 */
function fullFrame(
  s: Surface,
  nx: number,
  ntop: number,
  fx: number,
  ftop: number,
  ph: number,
  c: GoalColors,
): void {
  // the crossbar: the post's square section swept from the far top (fx - 3) to the near
  const x0 = fx - (THICK - 1);
  const steps = Math.max(Math.abs(nx - x0), Math.abs(ntop - ftop));
  for (let i = 0; i <= steps; i++) {
    const bx = Math.round(x0 + ((nx - x0) * i) / steps);
    const by = Math.round(ftop + ((ntop - ftop) * i) / steps);
    s.hline(bx, by, THICK, c.post);
    s.hline(bx, by + 1, THICK, c.post);
    s.hline(bx, by + 2, THICK, c.postShade);
    s.hline(bx, by + 3, THICK, c.postDark);
  }
  // the near post
  s.rect(nx, ntop, 2, ph, c.post);
  s.vline(nx + 2, ntop + 1, ph - 1, c.postShade);
  s.vline(nx + 3, ntop + 2, ph - 2, c.postDark);
  // the corner where bar meets post, rounded on the outside
  s.px(nx + 3, ntop, c.postShade);
  s.px(nx + 3, ntop + 1, c.postShade);
}

/**
 * The small goal's frame (tier 1): a thin bar that sags, and a wonky near post 2 px thick
 * leaning out a pixel at a time towards its top.
 */
function smallFrame(
  s: Surface,
  nx: number,
  ntop: number,
  fx: number,
  ftop: number,
  ph: number,
  c: GoalColors,
): void {
  const steps = Math.max(Math.abs(nx + 2 - fx), Math.abs(ntop - ftop));
  for (let i = 0; i <= steps; i++) {
    const bx = Math.round(fx - 1 + ((nx + 2 - (fx - 1)) * i) / steps);
    const by = Math.round(ftop + ((ntop - ftop) * i) / steps);
    s.hline(bx, by, THIN, c.post);
    s.hline(bx, by + 1, THIN, c.postShade);
  }
  // the post, bottom up: straight for its lower part, then a pixel right, then another
  const low = ph - 12;
  s.vline(nx, ntop + 12, low, c.post);
  s.vline(nx + 1, ntop + 12, low, c.postShade);
  s.vline(nx + 1, ntop + 6, 6, c.post);
  s.vline(nx + 2, ntop + 6, 6, c.postShade);
  s.vline(nx + 2, ntop + 2, 4, c.post);
  s.vline(nx + 3, ntop + 2, 4, c.postShade);
  // weathered: a scuff of bare wood low down, where it has been kicked
  s.px(nx, ntop + ph - 5, c.postDark);
  s.px(nx, ntop + ph - 9, c.postDark);
}

// ---------------------------------------------------------------------------
// Jumpers for goalposts (tier 0)
// ---------------------------------------------------------------------------

/**
 * A pile of jumpers, 16 x 9, big enough to read as clothes and not a lump: one bunched on
 * top of the other, the bottom one's sleeves splayed out on the grass either side, the top
 * one's sleeve hanging down its front, a shadow on the grass.
 * `A` is the bottom jumper and `B` the one on top, with their lit folds (`a`, `b`) and
 * creases (`k`, `n`), the top one's collar `c`; `s` is the shadow on the grass.
 */
let jumpers: Sprite | null = null;
function jumperSprite(): Sprite {
  return (jumpers ??= sprite(
    `
    ......bbbb......
    ....bbBccBBb....
    ...bBBBBBBBBn...
    ..aBBnBBBBnBBa..
    .aAAnnBBBBnnAAa.
    aAAAAAnBBnAAAAAk
    AAkAAAABBAAAAkAa
    aAk.kAAnnAAk.kAA
    .ss.sssssssss.s.
    `,
    "AaBbknsc",
  ));
}

const jumperColors: Color[] = Array.from({ length: 8 }, () => TRANSPARENT);

/** A pile with its left column at `x0`, its shadow on row `foot - 1`. */
function drawJumpers(
  s: Surface,
  x0: number,
  foot: number,
  a: readonly [Color, Color, Color],
  b: readonly [Color, Color, Color],
  shadow: Color,
  collar: Color,
): void {
  const colors = jumperColors;
  colors[0] = a[0];
  colors[1] = a[1];
  colors[2] = b[0];
  colors[3] = b[1];
  colors[4] = a[2];
  colors[5] = b[2];
  colors[6] = shadow;
  colors[7] = collar;
  drawSprite(s, jumperSprite(), 0, x0, foot - 9, colors);
}

function redJumper(c: GoalColors): [Color, Color, Color] {
  return [c.jumperA, c.jumperAHi, c.jumperShade];
}

function darkJumper(c: GoalColors): [Color, Color, Color] {
  return [c.jumperB, c.jumperBHi, c.jumperBLo];
}
