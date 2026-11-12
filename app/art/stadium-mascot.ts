/**
 * The club mascot: a friendly owl in a big costume, in the day's club shirt, out on the
 * lawn to the left of the stadium with a ball at his feet. Our own invention.
 *
 * He is drawn at the scale of the people around him: a walker in this aerial view is 5 px
 * tall and 3 wide, and he is a person in a costume, so 8 px tall (ear tufts to boots) and
 * 7 wide with his gloves: a little taller and much wider, not a giant. His ball is 2 x 2 so
 * that it can be seen at all.
 *
 * Idle, he bounces on his toes, waves, juggles a few touches and throws his arms up, on a
 * nine-second loop. Clicked, he does a trick, a different one each click in turn, each one
 * simple enough to read at this size:
 *
 *   0 juggle       right foot, left foot, right foot, head, and a trap
 *   1 flick        rolls it back and flicks it up over his own head, lands it in front
 *   2 spin         pops it up high, turns all the way round under it, and traps it
 *   3 tumble       hoofs it sky-high, topples onto his bottom, and it lands on his head
 *
 * then back to idle. The state is the poke history (MascotPokes); a frame is a pure
 * function of it and the time.
 *
 * Where he stands (`findMascotSpot`) is chosen once per size from the painted town: the
 * deepest open grass of the lawn left of the ball, clear of its paths, the road, the trees
 * and the captions. A phone has no open lawn: no mascot.
 */

import { Surface, toRgb, type Color } from "~/pixel";
import { menuLayout, type Zone } from "~/art/layout";
import type { Lighting } from "~/art/lighting";
import { P } from "~/art/palette";
import { clubOf } from "~/art/stadium-club";
import { groundAt } from "~/art/stadium-plan";
import { depthAtRow, scaleAt, type View } from "~/art/stadium-view";
import { HOME_PAGE } from "~/audio/mix";
import type { SoundCue } from "~/scenes/scene";

// ---------------------------------------------------------------------------
// Poses
// ---------------------------------------------------------------------------

/** A pose. Rows and columns are relative to the point between his boots. */
export interface Pose {
  /** Which way he shows: his front, his side (facing `face`), his back, or sat down. */
  kind: "front" | "side" | "back" | "sit";
  /** For a side view: 1 facing right, -1 facing left. */
  face: 1 | -1;
  /** How far his body is off the ground. */
  lift: number;
  /** His gloves: at his sides, out, up, the right one waving, or on the ground. */
  hands: "down" | "out" | "up" | "wave" | "ground";
  /** His boots: together, the right or left one up for a touch, or the right one kicking high. */
  feet: "stand" | "tapR" | "tapL" | "kick";
  /** The head's nod: -1 up (a header), 1 down. */
  hy: number;
  blink: boolean;
  /** Stars round his head: 0 none, 1 or 2 (two frames of them). */
  stars: 0 | 1 | 2;
}

const STAND: Pose = {
  kind: "front",
  face: 1,
  lift: 0,
  hands: "down",
  feet: "stand",
  hy: 0,
  blink: false,
  stars: 0,
};

const pose = (p: Partial<Pose>): Pose => ({ ...STAND, ...p });

/** The poses by name. */
const POSES = {
  stand: STAND,
  bounce: pose({ lift: 1 }),
  wave1: pose({ hands: "wave" }),
  wave2: pose({ hands: "wave", lift: 1 }),
  cheer: pose({ hands: "up", lift: 1 }),
  cheer2: pose({ hands: "up", lift: 2 }),
  blink: pose({ blink: true }),
  balance: pose({ hands: "out" }),
  tapR: pose({ hands: "out", feet: "tapR" }),
  tapL: pose({ hands: "out", feet: "tapL" }),
  headUp: pose({ hands: "out", lift: 1, hy: -1 }),
  lookUp: pose({ hands: "out", hy: -1 }),
  kick: pose({ hands: "out", feet: "kick", lift: 1 }),
  sideR: pose({ kind: "side", face: 1, hands: "out" }),
  sideL: pose({ kind: "side", face: -1, hands: "out" }),
  back: pose({ kind: "back", hands: "out" }),
  sideRUp: pose({ kind: "side", face: 1, hands: "out", lift: 1 }),
  sideLUp: pose({ kind: "side", face: -1, hands: "out", lift: 1 }),
  backUp: pose({ kind: "back", hands: "out", lift: 1 }),
  wobble: pose({ hands: "up", feet: "tapL" }),
  sit: pose({ kind: "sit", hands: "ground" }),
  sitBonk: pose({ kind: "sit", hands: "ground", hy: 1, blink: true }),
  sitDizzy1: pose({ kind: "sit", hands: "ground", stars: 1 }),
  sitDizzy2: pose({ kind: "sit", hands: "ground", stars: 2 }),
} satisfies Record<string, Pose>;

type PoseName = keyof typeof POSES;

// ---------------------------------------------------------------------------
// The ball, the routines and the tricks
// ---------------------------------------------------------------------------

/**
 * The ball at a key moment: `x` across from between his feet (its left column), `h` its
 * underside's height off the ground; `arc` how high it is thrown over the flight to the
 * next key.
 */
interface BallKey {
  t: number;
  x: number;
  h: number;
  arc: number;
}

interface Cue {
  t: number;
  cue: SoundCue;
}

export interface Routine {
  name: string;
  /** Seconds. */
  dur: number;
  poses: readonly { t: number; p: PoseName }[];
  ball: readonly BallKey[];
  cues: readonly Cue[];
}

const b = (t: number, x: number, h: number, arc = 0): BallKey => ({
  t,
  x,
  h,
  arc,
});
// The levels and powers are mix.ts's (HOME_PAGE.mascotTouch, mascotFlick, mascotSwing).
const touch = (t: number): Cue => ({
  t,
  cue: { kind: "touch", level: HOME_PAGE.mascotTouch },
});
const kick = (t: number, power: number): Cue => ({
  t,
  cue: { kind: "kick", power },
});

/** Seconds a trick takes to bring the ball to his right foot before it starts. */
const READY = 0.25;
/** Where the ball rests: beside his right boot, clear of his glove. */
const REST_X = 4;
/** The ball on his head: its underside just over his ear tufts. */
const HEAD_H = 9;

/** The idle loop: bounce on his toes, wave, juggle, throw his arms up. */
const IDLE: Routine = (() => {
  const poses: { t: number; p: PoseName }[] = [];
  for (let i = 0; i < 8; i++)
    poses.push({ t: i * 0.25, p: i % 2 ? "bounce" : "stand" });
  for (let i = 0; i < 8; i++) {
    poses.push({ t: 2 + i * 0.25, p: i % 2 ? "wave2" : "wave1" });
  }
  poses.push(
    { t: 4, p: "stand" },
    { t: 4.05, p: "tapR" },
    { t: 4.2, p: "balance" },
    { t: 4.65, p: "tapL" },
    { t: 4.8, p: "balance" },
    { t: 5.25, p: "tapR" },
    { t: 5.4, p: "balance" },
    { t: 5.85, p: "tapR" },
    { t: 6.0, p: "stand" },
    { t: 7.4, p: "blink" },
    { t: 7.55, p: "stand" },
    { t: 7.9, p: "cheer" },
    { t: 8.15, p: "cheer2" },
    { t: 8.4, p: "cheer" },
    { t: 8.6, p: "stand" },
  );
  return {
    name: "IDLE",
    dur: 9,
    poses,
    ball: [
      b(0, REST_X, 0),
      b(4, REST_X, 0),
      b(4.1, 2, 2, 3),
      b(4.7, -3, 2, 3),
      b(5.3, 2, 2, 3),
      b(5.9, 2, 2, 2),
      b(6.25, REST_X, 0),
      b(9, REST_X, 0),
    ],
    cues: [],
  };
})();

/** The tricks, in the order the clicks take them. */
export const TRICKS: readonly Routine[] = [
  {
    name: "JUGGLE",
    dur: 3.4,
    poses: [
      { t: 0, p: "stand" },
      { t: 0.3, p: "tapR" },
      { t: 0.45, p: "balance" },
      { t: 0.8, p: "tapL" },
      { t: 0.95, p: "balance" },
      { t: 1.3, p: "tapR" },
      { t: 1.45, p: "lookUp" },
      { t: 1.95, p: "headUp" },
      { t: 2.1, p: "balance" },
      { t: 2.55, p: "tapR" },
      { t: 2.7, p: "stand" },
      { t: 2.95, p: "cheer" },
      { t: 3.15, p: "cheer2" },
      { t: 3.3, p: "stand" },
    ],
    ball: [
      b(READY, REST_X, 0),
      b(0.35, 2, 2, 4),
      b(0.85, -3, 2, 4),
      b(1.35, 2, 2, 6),
      b(2.0, 0, HEAD_H, 4),
      b(2.6, 2, 2, 2),
      b(2.8, REST_X, 0),
      b(3.4, REST_X, 0),
    ],
    cues: [touch(0.35), touch(0.85), touch(1.35), touch(2.0), touch(2.6)],
  },
  {
    name: "FLICK",
    dur: 2.9,
    poses: [
      { t: 0, p: "stand" },
      { t: 0.3, p: "tapR" },
      { t: 0.5, p: "stand" },
      { t: 0.6, p: "tapL" },
      { t: 0.75, p: "lookUp" },
      { t: 1.35, p: "tapR" },
      { t: 1.5, p: "balance" },
      { t: 1.8, p: "cheer" },
      { t: 2.0, p: "cheer2" },
      { t: 2.2, p: "cheer" },
      { t: 2.4, p: "stand" },
    ],
    ball: [
      b(READY, REST_X, 0),
      // rolled back behind his left boot, then flicked up over his head
      b(0.6, -3, 0),
      b(0.7, -3, 2, 12),
      b(1.4, 2, 2, 1),
      b(1.6, 4, 0),
      b(2.0, REST_X, 0),
      b(2.9, REST_X, 0),
    ],
    cues: [touch(0.3), kick(0.7, HOME_PAGE.mascotFlick), touch(1.4)],
  },
  {
    name: "SPIN",
    dur: 3.0,
    poses: [
      { t: 0, p: "stand" },
      { t: 0.3, p: "tapR" },
      { t: 0.45, p: "lookUp" },
      // all the way round under it, and round again
      { t: 0.6, p: "sideRUp" },
      { t: 0.72, p: "backUp" },
      { t: 0.84, p: "sideLUp" },
      { t: 0.96, p: "headUp" },
      { t: 1.08, p: "sideRUp" },
      { t: 1.2, p: "backUp" },
      { t: 1.32, p: "sideLUp" },
      { t: 1.44, p: "lookUp" },
      { t: 1.6, p: "tapR" },
      { t: 1.75, p: "balance" },
      { t: 2.0, p: "cheer" },
      { t: 2.2, p: "cheer2" },
      { t: 2.4, p: "cheer" },
      { t: 2.6, p: "stand" },
    ],
    ball: [
      b(READY, REST_X, 0),
      b(0.35, 2, 2, 12),
      b(1.65, 2, 2, 2),
      b(1.9, REST_X, 0),
      b(3.0, REST_X, 0),
    ],
    cues: [touch(0.35), touch(1.65)],
  },
  {
    name: "TUMBLE",
    dur: 4.2,
    poses: [
      { t: 0, p: "stand" },
      { t: 0.3, p: "kick" },
      { t: 0.5, p: "wobble" },
      { t: 0.7, p: "balance" },
      { t: 0.85, p: "wobble" },
      { t: 1.0, p: "sit" },
      { t: 2.2, p: "sitBonk" },
      { t: 2.45, p: "sitDizzy1" },
      { t: 2.65, p: "sitDizzy2" },
      { t: 2.85, p: "sitDizzy1" },
      { t: 3.05, p: "sitDizzy2" },
      { t: 3.3, p: "stand" },
      { t: 3.45, p: "blink" },
      { t: 3.6, p: "cheer" },
      { t: 3.8, p: "cheer2" },
      { t: 4.0, p: "stand" },
    ],
    ball: [
      b(READY, REST_X, 0),
      b(0.35, 2, 1, 0),
      // hoofed sky-high, and back down on his head
      b(0.4, 2, 1, 16),
      b(2.25, 0, 5, 2),
      b(2.7, 6, 0, 2),
      b(3.0, 5, 0),
      b(3.6, REST_X, 0),
      b(4.2, REST_X, 0),
    ],
    cues: [
      kick(0.4, HOME_PAGE.mascotSwing),
      { t: 1.0, cue: { kind: "thud" } },
      touch(2.25),
      touch(2.7),
    ],
  },
];

function poseIn(r: Routine, u: number): Pose {
  let name: PoseName = r.poses[0].p;
  for (const k of r.poses) {
    if (k.t <= u) name = k.p;
    else break;
  }
  return POSES[name];
}

function ballIn(r: Routine, u: number): { x: number; h: number } {
  const keys = r.ball;
  if (u <= keys[0].t) return { x: keys[0].x, h: keys[0].h };
  for (let i = 0; i + 1 < keys.length; i++) {
    const a = keys[i];
    const c = keys[i + 1];
    if (u < c.t) {
      const v = (u - a.t) / (c.t - a.t);
      return {
        x: a.x + (c.x - a.x) * v,
        h: a.h + (c.h - a.h) * v + 4 * a.arc * v * (1 - v),
      };
    }
  }
  const last = keys[keys.length - 1];
  return { x: last.x, h: last.h };
}

// ---------------------------------------------------------------------------
// The poke history
// ---------------------------------------------------------------------------

/** How many tricks are remembered (the cycle of tricks goes on from the count). */
const KEEP = 16;

export class MascotPokes {
  /** When each remembered trick started, and which it was. */
  private starts: { t: number; trick: number }[] = [];
  private count = 0;

  /** The trick playing at t, if any. */
  active(t: number): { trick: number; since: number } | null {
    for (let i = this.starts.length - 1; i >= 0; i--) {
      const s = this.starts[i];
      if (s.t > t) continue;
      const since = t - s.t;
      return since < TRICKS[s.trick].dur ? { trick: s.trick, since } : null;
    }
    return null;
  }

  /** A click on him at time t: a trick, or "busy" while one plays. */
  poke(t: number): "trick" | "busy" {
    if (!Number.isFinite(t)) return "busy";
    if (this.active(t)) return "busy";
    const last = this.starts[this.starts.length - 1];
    if (last && t < last.t) return "busy";
    this.starts.push({ t, trick: this.count % TRICKS.length });
    this.count++;
    if (this.starts.length > KEEP) this.starts.shift();
    return "trick";
  }

  /** The seconds into the idle loop at t: it starts again when a trick ends. */
  idleClock(t: number): number {
    for (let i = this.starts.length - 1; i >= 0; i--) {
      const s = this.starts[i];
      const end = s.t + TRICKS[s.trick].dur;
      if (end <= t) return t - end;
    }
    return t;
  }

  /** Every remembered trick's start, oldest first. */
  each(fn: (start: number, trick: number) => void): void {
    for (const s of this.starts) fn(s.t, s.trick);
  }
}

export interface MascotFrame {
  pose: Pose;
  /** The ball: across from between his feet, and its underside's height. */
  ball: { x: number; h: number };
}

function idleFrame(tau: number): MascotFrame {
  const u = ((tau % IDLE.dur) + IDLE.dur) % IDLE.dur;
  return { pose: poseIn(IDLE, u), ball: ballIn(IDLE, u) };
}

/** What he is doing at t. */
export function mascotFrame(pokes: MascotPokes, t: number): MascotFrame {
  const time = Number.isFinite(t) ? t : 0;
  const on = pokes.active(time);
  if (!on) return idleFrame(pokes.idleClock(time));
  const trick = TRICKS[on.trick];
  if (on.since < READY) {
    // the ball comes to his right foot from wherever it was
    const from = idleFrame(pokes.idleClock(time - on.since)).ball;
    const v = on.since / READY;
    return {
      pose: POSES.stand,
      ball: {
        x: from.x + (REST_X - from.x) * v,
        h: from.h * (1 - v),
      },
    };
  }
  return { pose: poseIn(trick, on.since), ball: ballIn(trick, on.since) };
}

/** The sounds of his tricks in the span (t0, t1]: touches, kicks and the bump of his tumble. */
export function mascotCues(
  pokes: MascotPokes,
  t0: number,
  t1: number,
  out: SoundCue[],
): void {
  pokes.each((start, i) => {
    for (const c of TRICKS[i].cues) {
      const at = start + c.t;
      if (at > t0 && at <= t1) out.push(c.cue);
    }
  });
}

// ---------------------------------------------------------------------------
// Where he stands
// ---------------------------------------------------------------------------

const GRASS_KINDS = new Set<number>([
  P.grass,
  P.grassLight,
  P.grassDark,
  P.grassDeep,
]);

/** His box on screen around the point between his feet: him and his ball, a little generous for clicks. */
export const MASCOT_BOX = { left: 5, right: 6, up: 11, down: 2 } as const;

export function mascotZone(spot: { x: number; y: number }): Zone {
  return {
    x: spot.x - MASCOT_BOX.left,
    y: spot.y - MASCOT_BOX.up,
    w: MASCOT_BOX.left + MASCOT_BOX.right + 1,
    h: MASCOT_BOX.up + MASCOT_BOX.down + 1,
  };
}

/** Open lawn he needs all round him (Chebyshev pixels), and how much more is worth seeking. */
const MIN_CLEAR = 7;
const ENOUGH_CLEAR = 16;

/**
 * Where he stands for this view: the deepest open grass left of the ball, as far as can be
 * from any path, road, tree or building (up to ENOUGH_CLEAR pixels; then nearest the middle
 * of the lawn), clear of the captions and of `clear` (the airship). `trodden` are the
 * points on screen where people walk (their feet): he keeps off their way too, if the lawn
 * has room for that. Null when there is no patch of open grass big enough for him and his
 * tricks (a phone).
 */
export function findMascotSpot(
  view: View,
  land: Surface,
  landTop: number,
  depth: Float32Array,
  seed: number,
  clear: readonly Zone[] = [],
  trodden: readonly { x: number; y: number }[] = [],
): { x: number; y: number } | null {
  return (
    spotIn(view, land, landTop, depth, seed, clear, trodden) ??
    (trodden.length > 0
      ? spotIn(view, land, landTop, depth, seed, clear, [])
      : null)
  );
}

function spotIn(
  view: View,
  land: Surface,
  landTop: number,
  depth: Float32Array,
  seed: number,
  clear: readonly Zone[],
  trodden: readonly { x: number; y: number }[],
): { x: number; y: number } | null {
  const { w, h, hy } = view;
  const m = menuLayout(w, h);
  const ballLeft = m.cx - m.ballR;
  const x0 = 0;
  const x1 = Math.min(w, ballLeft - 6);
  const y0 = Math.max(0, landTop, hy);
  const y1 = Math.min(h, m.caption.y - 2);
  const gw = x1 - x0;
  const gh = y1 - y0;
  if (gw <= 0 || gh <= 0) return null;
  // open lawn: grass on the plan, painted green, and nothing standing on it
  const dist = new Int16Array(gw * gh);
  for (let y = y0; y < y1; y++) {
    const V = depthAtRow(view, y + 0.5);
    const s = scaleAt(view, V);
    for (let x = x0; x < x1; x++) {
      let lawn = depth[y * w + x] >= V - 1.5;
      if (lawn) {
        const c = groundAt((x + 0.5 - view.cx) / s, V, s, seed).c as number;
        lawn = GRASS_KINDS.has(c);
      }
      if (lawn) {
        const [r, g, bl] = toRgb(land.data[(y - landTop) * w + x] as Color);
        lawn = g > r + 8 && g > bl;
      }
      dist[(y - y0) * gw + (x - x0)] = lawn ? 1000 : 0;
    }
  }
  // the ways people walk: a person is 3 wide and 5 tall over their feet
  for (const p of trodden) {
    for (let j = -5; j <= 0; j++) {
      for (let i = -1; i <= 1; i++) {
        const x = Math.round(p.x) + i - x0;
        const y = Math.round(p.y) + j - y0;
        if (x >= 0 && y >= 0 && x < gw && y < gh) dist[y * gw + x] = 0;
      }
    }
  }
  // how far each pixel is from anything that is not open lawn (the frame counts as not)
  const at = (i: number, j: number): number =>
    i < 0 || j < 0 || i >= gw || j >= gh ? 0 : dist[j * gw + i];
  for (let j = 0; j < gh; j++) {
    for (let i = 0; i < gw; i++) {
      const k = j * gw + i;
      if (dist[k] === 0) continue;
      dist[k] = Math.min(
        dist[k],
        at(i - 1, j) + 1,
        at(i - 1, j - 1) + 1,
        at(i, j - 1) + 1,
        at(i + 1, j - 1) + 1,
      );
    }
  }
  for (let j = gh - 1; j >= 0; j--) {
    for (let i = gw - 1; i >= 0; i--) {
      const k = j * gw + i;
      if (dist[k] === 0) continue;
      dist[k] = Math.min(
        dist[k],
        at(i + 1, j) + 1,
        at(i + 1, j + 1) + 1,
        at(i, j + 1) + 1,
        at(i - 1, j + 1) + 1,
      );
    }
  }
  const ideal = { x: Math.round(ballLeft * 0.4), y: m.ballCy };
  let best: { x: number; y: number } | null = null;
  let bestScore = -Infinity;
  for (let y = y0; y < y1 - MASCOT_BOX.down; y++) {
    for (let x = x0; x < x1 - MASCOT_BOX.right; x++) {
      // the clearance round his middle, which covers him, his shadow and his ball
      const d = at(x - x0, y - 4 - y0);
      if (d < MIN_CLEAR) continue;
      const zone = mascotZone({ x, y });
      if (
        clear.some(
          (z) =>
            zone.x < z.x + z.w &&
            z.x < zone.x + zone.w &&
            zone.y < z.y + z.h &&
            z.y < zone.y + zone.h,
        )
      ) {
        continue;
      }
      const score =
        Math.min(d, ENOUGH_CLEAR) * 10 -
        Math.abs(x - ideal.x) -
        Math.abs(y - ideal.y) * 1.5;
      if (score > bestScore) {
        best = { x, y };
        bestScore = score;
      }
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

interface Inks {
  feather: Color;
  featherDark: Color;
  face: Color;
  eye: Color;
  beak: Color;
  shirt: Color;
  shirtDark: Color;
  trim: Color;
  glove: Color;
  shorts: Color;
  boot: Color;
  ball: Color;
  ballShade: Color;
  shadow: Color;
  star: Color;
}

const inksFor = new WeakMap<Lighting, Inks>();

function inks(light: Lighting): Inks {
  let k = inksFor.get(light);
  if (!k) {
    const club = clubOf(light);
    // the floodlights reach the lawn beside the stadium at night
    const g = light.lit;
    k = {
      feather: g(P.wood),
      featherDark: g(P.woodDark),
      face: g(P.skinA),
      eye: P.ink,
      beak: g(P.gold),
      shirt: g(P.home),
      shirtDark: g(P.homeDark),
      trim: g(club.second.base),
      glove: g(P.chalk),
      shorts: g(club.second.base),
      boot: P.ink,
      ball: g(P.white),
      ballShade: g(P.mist),
      shadow: g(P.grassDeep),
      star: P.goldLight,
    };
    inksFor.set(light, k);
  }
  return k;
}

/** The work surface he is drawn on before he goes down: his feet at (CX, CY). */
const WORK_W = 13;
const WORK_H = 14;
const CX = 6;
const CY = 11;

/** A scratch surface for drawMascot, made once. */
export function mascotWork(): Surface {
  return new Surface(WORK_W, WORK_H);
}

/** His head, 5 wide, its top row at y: a brown crown and tufts, a pale face, eyes and beak. */
function head(s: Surface, x: number, y: number, p: Pose, k: Inks): void {
  const eye = p.blink ? k.featherDark : k.eye;
  if (p.kind === "side") {
    // in profile: 3 wide, one eye and the beak pointing the way he faces
    const f = p.face;
    s.px(x, y - 1, k.featherDark);
    s.rect(x - 1, y, 3, 1, k.feather);
    s.px(x - f, y + 1, k.feather);
    s.px(x, y + 1, k.face);
    s.px(x + f, y + 1, eye);
    s.px(x - f, y + 2, k.featherDark);
    s.px(x, y + 2, k.face);
    s.px(x + f, y + 2, k.face);
    s.px(x + 2 * f, y + 2, k.beak);
    return;
  }
  s.px(x - 2, y - 1, k.featherDark);
  s.px(x + 2, y - 1, k.featherDark);
  s.rect(x - 2, y, 5, 1, k.feather);
  s.px(x + 2, y, k.featherDark);
  if (p.kind === "back") {
    s.rect(x - 2, y + 1, 5, 2, k.feather);
    s.rect(x + 2, y + 1, 1, 2, k.featherDark);
    return;
  }
  s.rect(x - 2, y + 1, 5, 1, k.face);
  s.px(x - 1, y + 1, eye);
  s.px(x + 1, y + 1, eye);
  s.px(x - 2, y + 2, k.feather);
  s.px(x - 1, y + 2, k.face);
  s.px(x, y + 2, k.beak);
  s.px(x + 1, y + 2, k.face);
  s.px(x + 2, y + 2, k.featherDark);
}

/** Draw him onto `s` with the point between his boots at (ox, oy). */
function body(s: Surface, ox: number, oy: number, p: Pose, k: Inks): void {
  const glove = (x: number, y: number) => s.px(ox + x, oy + y, k.glove);
  const sleeve = (x: number, y: number, c: Color) => s.px(ox + x, oy + y, c);
  if (p.kind === "sit") {
    // sat on the grass, boots out in front, hands down beside him
    s.rect(ox - 2, oy - 2, 5, 2, k.shirt);
    s.rect(ox + 2, oy - 2, 1, 2, k.shirtDark);
    s.px(ox, oy - 2, k.trim);
    s.rect(ox - 1, oy, 3, 1, k.shorts);
    s.px(ox - 2, oy, k.boot);
    s.px(ox + 2, oy, k.boot);
    glove(-3, 0);
    glove(3, 0);
    head(s, ox, oy - 5 + p.hy, p, k);
    return;
  }
  const by = oy - p.lift;
  if (p.kind === "side") {
    const f = p.face;
    s.rect(ox - 1, by - 3, 3, 2, k.shirt);
    s.px(ox - f, by - 3, k.shirtDark);
    s.rect(ox - 1, by - 1, 3, 1, k.shorts);
    s.px(ox - 1, by, k.boot);
    s.px(ox + 1, by, k.boot);
    glove(-2 * f, -3 - p.lift);
    glove(2 * f, -3 - p.lift);
    head(s, ox, by - 6 + p.hy, p, k);
    return;
  }
  // the shirt: the club's colour, a collar (or on his back a number) in its second
  s.rect(ox - 2, by - 3, 5, 2, k.shirt);
  s.rect(ox + 2, by - 3, 1, 2, k.shirtDark);
  if (p.kind === "back") s.rect(ox, by - 3, 1, 2, k.trim);
  else s.px(ox, by - 3, k.trim);
  s.rect(ox - 1, by - 1, 3, 1, k.shorts);
  // boots
  const bootL: [number, number] = p.feet === "tapL" ? [-2, -1] : [-1, 0];
  const bootR: [number, number] =
    p.feet === "tapR" ? [2, -1] : p.feet === "kick" ? [2, -2] : [1, 0];
  s.px(ox + bootL[0], by + bootL[1], k.boot);
  s.px(ox + bootR[0], by + bootR[1], k.boot);
  // arms: a sleeve in the shirt's colour, a white glove
  const L = -1;
  const R = 1;
  for (const side of [L, R]) {
    const sl = side < 0 ? k.shirt : k.shirtDark;
    const hands = p.hands === "wave" ? (side === R ? "up" : "down") : p.hands;
    const x = 3 * side;
    if (hands === "down") {
      sleeve(x, -3 - p.lift, sl);
      glove(x, -2 - p.lift);
    } else if (hands === "out") {
      glove(x, -3 - p.lift);
    } else {
      sleeve(x, -4 - p.lift, sl);
      glove(x, -5 - p.lift);
    }
  }
  head(s, ox, by - 6 + p.hy, p, k);
}

/** Draw him, his ball and their shadows, with his boots on row y about x. `work` is a scratch surface. */
export function drawMascot(
  s: Surface,
  x: number,
  y: number,
  frame: MascotFrame,
  light: Lighting,
  work: Surface,
): void {
  const k = inks(light);
  const p = frame.pose;
  // his shadow on the grass, a little smaller when he is off the ground
  s.rect(x - 2, y + 1, 5, 1, k.shadow);
  if (p.lift === 0 && p.kind !== "side") s.rect(x - 3, y + 1, 7, 1, k.shadow);
  work.clear();
  body(work, CX, CY, p, k);
  if (p.stars) {
    // stars turning round his head
    const top = CY - 7;
    const a = p.stars === 1;
    work.px(CX + (a ? -3 : 3), top + (a ? 0 : 1), k.star);
    work.px(CX + (a ? 2 : -2), top - 1, k.star);
    work.px(CX + (a ? 4 : -4), top + 2, k.star);
  }
  s.blit(work, x - CX, y - CY);
  drawBall(s, x, y, frame.ball, k);
}

/** A 2 x 2 ball, with its shadow on the grass when it is in the air. */
function drawBall(
  s: Surface,
  x: number,
  y: number,
  ball: { x: number; h: number },
  k: Inks,
): void {
  const bx = Math.round(x + ball.x);
  const bh = Math.round(ball.h);
  if (bh > 0) s.rect(bx, y + 1, 2, 1, k.shadow);
  const top = y - bh - 1;
  s.rect(bx, top, 2, 2, k.ball);
  s.px(bx + 1, top + 1, k.ballShade);
}
