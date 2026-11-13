/**
 * The club mascot: a black cat with bright green eyes (the product owner: "mascot should
 * be a black cat with green eyes"), a person in a big costume in the day's club kit, out
 * on the lawn to the left of the stadium with a ball at his feet. Our own invention.
 *
 * He is drawn at the scale of the people around him, a little bigger: a walker in this
 * aerial view is 10 px tall and 6 wide, and he is 20 px tall (ear tips to boots) and 17
 * wide with his paws, not a giant; his tail curls out to his side, up to 21 wide. His ball
 * is 4 x 4, a little round ball with a patch and a shaded side; the shadows are 2 rows.
 *
 * His frame (`MascotFrame`: the poses, the ball's place and height, a hop, a nod, the
 * tail's sway) is in small units, drawn at `K` pixels each. Parts are little templates in
 * one legend, put together per pose: boots and socks, shorts, the shirt (a V collar in the
 * second colour and a badge in front, a number on the back), sleeves and black paws (down,
 * out, up, waving, on the grass), and the cat's head (pointed ears pink inside, big green
 * eyes with slit pupils and a glint, a pink nose on a lighter muzzle, whiskers), seen from
 * the front, the back or the side; his tail (`TAILS`), swaying three times a second, up
 * high when he cheers, up his back seen from behind, along the grass sat down; sat down;
 * with stars turning round his head after the ball lands on it. No outline, like the
 * people round him: the light comes from the top left (slate and steel on his fur's lit
 * side), the right side a tone darker. His eyes are drawn raw, like a lamp: a cat's eyes
 * catch any light going. At night (floodlights on) he is drawn in a layer of his own and
 * the fur on his edge is lit (`rimLight`): mist on his right, towards the floodlit
 * stadium, steel on his top, so a black cat never vanishes on the dark lawn.
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
 * Where he stands (`findMascotSpot`) is chosen once per size from the painted town: on the
 * lawn left of the ball, clear of its paths, the road, the trees and the captions. A phone
 * has no open lawn: no mascot.
 */

import { Surface, TRANSPARENT, type Color } from "~/pixel";
import { menuLayout, type Zone } from "~/art/layout";
import type { Lighting } from "~/art/lighting";
import { P } from "~/art/palette";
import { clubOf } from "~/art/stadium-club";
import { groundAt } from "~/art/stadium-plan";
import { depthAtRow, project, scaleAt, type View } from "~/art/stadium-view";
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
  /** His paws: at his sides, out, up, the right one waving, or on the ground. */
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

/** The poses by name (exported for the sheets). */
export const POSES = {
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
  /** His tail's sway, 0 to 2 (0 when left out); it goes up of itself when he cheers. */
  tail?: number;
}

/** The tail's sway, four steps a second: out, back, out, in. */
const SWAY = [0, 1, 0, 2] as const;
const SWAY_RATE = 3;

function swayAt(t: number): number {
  const i = Math.floor(t * SWAY_RATE) % SWAY.length;
  return SWAY[(i + SWAY.length) % SWAY.length];
}

function idleFrame(tau: number): MascotFrame {
  const u = ((tau % IDLE.dur) + IDLE.dur) % IDLE.dur;
  return { pose: poseIn(IDLE, u), ball: ballIn(IDLE, u) };
}

/** What he is doing at t. */
export function mascotFrame(pokes: MascotPokes, t: number): MascotFrame {
  const time = Number.isFinite(t) ? t : 0;
  const tail = swayAt(time);
  const on = pokes.active(time);
  if (!on) return { ...idleFrame(pokes.idleClock(time)), tail };
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
      tail,
    };
  }
  return {
    pose: poseIn(trick, on.since),
    ball: ballIn(trick, on.since),
    tail,
  };
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

/** His box on screen round the point between his feet: him, his ball, his hops. */
export const MASCOT_BOX = { left: 12, right: 15, up: 27, down: 4 } as const;

export function mascotZone(spot: { x: number; y: number }): Zone {
  const box = MASCOT_BOX;
  return {
    x: spot.x - box.left,
    y: spot.y - box.up,
    w: box.left + box.right + 1,
    h: box.up + box.down + 1,
  };
}

/**
 * Where he stands for this view (`depth`: the town's depth mask): open grass left of the
 * ball nearest his place on the map (HOME_X, HOME_V), clear of anything standing, of the
 * captions and of `clear` (the airship). `trodden` are the points on screen where people
 * walk (their feet): he keeps off their way too, if the lawn has room for that. Null when
 * there is no patch of open grass big enough for him and his tricks (a phone).
 */
export function findMascotSpot(
  view: View,
  depth: Float32Array,
  seed: number,
  clear: readonly Zone[] = [],
  trodden: readonly { x: number; y: number }[] = [],
): { x: number; y: number } | null {
  // nobody walking near him; else walkers only well behind him (he hides them as they
  // pass, as anyone would); else wherever there is lawn
  return (
    spotOnLawn(view, depth, seed, clear, trodden, BODY.up) ??
    spotOnLawn(view, depth, seed, clear, trodden, BEHIND) ??
    spotOnLawn(view, depth, seed, clear, [], 0)
  );
}

/**
 * His place on the map (X, V): on the lawn between the walkers' two ways, level with the
 * ball, in the corner the concourse and Stadium Road's lamps leave. He is sought round this
 * point, so he stands in the same place relative to the stadium and the lawn on any screen.
 */
const HOME_X = -126;
const HOME_V = -95.5;
/**
 * The parts of his box (round the point between his feet):
 * - FEET, his boots, his shadow and his ball at rest, must be on open lawn;
 * - all of MASCOT_BOX (his tricks overhead too), and MARGIN round it, must be clear
 *   of anything standing (trees, lamps, bushes, buildings: the depth mask);
 * - BODY, him, his paws, his ball at rest and his shadow, must be clear of the
 *   walkers' ways, so nobody walks through him. Where the lawn is too small for that
 *   (a 1.5 to 1.7 times canvas: 683 x 384, 854 x 480), walkers may pass behind his head,
 *   their feet at least BEHIND rows above his: he is drawn over them, as he should be.
 * What lies flat behind him (the concourse's paving) may show round his head, as it does
 * round anyone standing at the lawn's edge.
 */
const FEET = { left: 9, right: 14, up: 3, down: 3 } as const;
const MARGIN = 2;
const BODY = { left: 10, right: 15, up: 22, down: 2 } as const;
const BEHIND = 9;
/** A walker's figure round its feet (stadium-people.ts): 6 wide, 10 tall. */
const WALKER = { left: 2, right: 3, up: 10 } as const;
/** The most of extra room round him worth seeking, in pixels. */
const ROOMY = 6;

/** A summed-area table over a grid of 0 and 1: the count in any box in four reads. */
function areaCounter(
  grid: Uint8Array,
  gw: number,
  gh: number,
): (l: number, t: number, r: number, b: number) => number {
  const sw = gw + 1;
  const sat = new Int32Array(sw * (gh + 1));
  for (let j = 0; j < gh; j++) {
    let row = 0;
    for (let i = 0; i < gw; i++) {
      row += grid[j * gw + i];
      sat[(j + 1) * sw + i + 1] = sat[j * sw + i + 1] + row;
    }
  }
  // inclusive grid cells; anything off the grid counts as blocked
  return (l, t, r, b) => {
    if (l < 0 || t < 0 || r >= gw || b >= gh) return 1;
    return (
      sat[(b + 1) * sw + r + 1] -
      sat[t * sw + r + 1] -
      sat[(b + 1) * sw + l] +
      sat[t * sw + l]
    );
  };
}

/**
 * Where he stands: the nearest point to his place (HOME_X, HOME_V) with his
 * feet on open lawn, nothing standing in his box or round it, and no walker's way (`trodden`:
 * each a 6 x 10 figure over its feet) through him (FEET, MASCOT_BOX, BODY; walkers
 * whose feet are more than `near` rows above his pass behind him and count not); clear
 * of the captions, the ball and `clear`. A little extra room round him counts (up to
 * ROOMY). It never reads the painted colours, so the light cannot move him: the same spot
 * by day and at night.
 */
function spotOnLawn(
  view: View,
  depth: Float32Array,
  seed: number,
  clear: readonly Zone[],
  trodden: readonly { x: number; y: number }[],
  near: number,
): { x: number; y: number } | null {
  const { w, h, hy } = view;
  const m = menuLayout(w, h);
  const box = MASCOT_BOX;
  const gw = Math.min(w, m.cx - m.ballR - 12);
  const y0 = Math.max(0, hy);
  const y1 = Math.min(h, m.caption.y - 4);
  const gh = y1 - y0;
  if (gw <= 0 || gh <= 0) return null;
  // standing: something stands there (or the airship); bare: not open lawn underfoot
  const standing = new Uint8Array(gw * gh);
  const bare = new Uint8Array(gw * gh);
  for (let y = y0; y < y1; y++) {
    const V = depthAtRow(view, y + 0.5);
    const s = scaleAt(view, V);
    for (let x = 0; x < gw; x++) {
      const k = (y - y0) * gw + x;
      if (depth[y * w + x] < V - 1.5) {
        standing[k] = 1;
        bare[k] = 1;
      } else {
        const c = groundAt((x + 0.5 - view.cx) / s, V, s, seed).c as number;
        if (!GRASS_KINDS.has(c)) bare[k] = 1;
      }
    }
  }
  for (const z of clear) {
    for (let j = Math.max(y0, z.y); j < Math.min(y1, z.y + z.h); j++) {
      for (let i = Math.max(0, z.x); i < Math.min(gw, z.x + z.w); i++) {
        standing[(j - y0) * gw + i] = 1;
      }
    }
  }
  // feet: where walkers' feet tread (rows down to a figure's height below the lawn's last)
  const fh = gh + WALKER.up + 1;
  const feet = new Uint8Array(gw * fh);
  for (const p of trodden) {
    const px = Math.round(p.x);
    const py = Math.round(p.y);
    if (px >= 0 && px < gw && py >= y0 && py < y0 + fh) {
      feet[(py - y0) * gw + px] = 1;
    }
  }
  const standingIn = areaCounter(standing, gw, gh);
  const bareIn = areaCounter(bare, gw, gh);
  const feetIn = areaCounter(feet, gw, fh);
  const home = project(view, HOME_X, HOME_V);
  let best: { x: number; y: number } | null = null;
  let bestScore = -Infinity;
  for (let j = box.up + MARGIN; j < gh - box.down - MARGIN; j++) {
    for (let x = box.left + MARGIN; x < gw - box.right - MARGIN; x++) {
      if (
        bareIn(x - FEET.left, j - FEET.up, x + FEET.right, j + FEET.down) > 0
      ) {
        continue;
      }
      const l = x - box.left - MARGIN;
      const t = j - box.up - MARGIN;
      const r = x + box.right + MARGIN;
      const b = j + box.down + MARGIN;
      if (standingIn(l, t, r, b) > 0) continue;
      // a walker's figure meets his body when its feet are in this box (clipped to the grid)
      if (
        feetIn(
          Math.max(0, x - BODY.left - WALKER.right),
          Math.max(0, j - near),
          Math.min(gw - 1, x + BODY.right + WALKER.left),
          j + BODY.down + WALKER.up,
        ) > 0
      ) {
        continue;
      }
      // a little more room round him, a pixel at a time up to ROOMY
      let room = 0;
      while (
        room < ROOMY &&
        standingIn(l - room - 1, t - room - 1, r + room + 1, b + room + 1) === 0
      ) {
        room++;
      }
      const y = j + y0;
      const score =
        room * 2 - Math.abs(x - home.x) - Math.abs(y - home.y) * 1.5;
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

/** The frame's lengths (a hop, the ball's place and height, a nod) to pixels. */
export const K = 2.5;

/** A hop of the frame's 0, 1 or 2. */
const LIFT = [0, 3, 5] as const;

// ---------------------------------------------------------------------------
// The legend and the templates
// ---------------------------------------------------------------------------

/**
 * `.` nothing; fur `F` (night), `f` (ink, its shade), `h` (slate, lit fur), `H` (steel,
 * the sheen where the light falls on it); the eyes `e` (bright green), `E` (the slit, ink)
 * with a glint `W`; the nose `n` and the inside of the ears `p` (pink); whiskers `w`
 * (mist); the shirt `T`, `t` (its shade), `U` (its light), the badge `Y` (gold); the second
 * colour `R` (collar, number), `O` and `o` (shorts and their shade); boots `K` (ink), `k`
 * (slate). His paws are fur.
 */
const LEGEND = ".FfhHeEWnpwTtUYROoKk";

interface Tpl {
  w: number;
  h: number;
  cells: Uint8Array;
}

function tpl(rows: readonly string[]): Tpl {
  const h = rows.length;
  const w = rows[0].length;
  const cells = new Uint8Array(w * h);
  for (let j = 0; j < h; j++) {
    if (rows[j].length !== w) throw new Error(`mascot template row ${j}`);
    for (let i = 0; i < w; i++) {
      const k = LEGEND.indexOf(rows[j][i]);
      if (k < 0) throw new Error(`mascot template char ${rows[j][i]}`);
      cells[j * w + i] = k;
    }
  }
  return { w, h, cells };
}

/**
 * The cat's head from the front: 17 wide with the whiskers (the head 13), 10 tall: two
 * pointed ears pink inside, big green eyes with slit pupils, a pink nose on a lighter
 * muzzle, whiskers out either side. Column 8 is his middle.
 */
const HEAD = tpl([
  "...H.........f...",
  "...HH.......Ff...",
  "...HpF.....Fpf...",
  "...HhFFFFFFFFf...",
  "..hFFFFFFFFFFFf..",
  "..hFWEeFFFWEeFf..",
  "..hFeEeFFFeEeff..",
  "wwhFFFFhnhFFFffww",
  "..w.fFFhfhFFf.w..",
  ".....ffFFFff.....",
]);

/** The same, his eyes shut. */
const HEAD_BLINK = tpl([
  "...H.........f...",
  "...HH.......Ff...",
  "...HpF.....Fpf...",
  "...HhFFFFFFFFf...",
  "..hFFFFFFFFFFFf..",
  "..hFFFFFFFFFFFf..",
  "..hFHHHFFFHHHff..",
  "wwhFFFFhnhFFFffww",
  "..w.fFFhfhFFf.w..",
  ".....ffFFFff.....",
]);

/** From the back: all fur, the backs of his ears, lit on the crown, the nape in shade. */
const HEAD_BACK = tpl([
  "...H.........f...",
  "...HH.......Ff...",
  "...HhF.....FFf...",
  "...HhFFFFFFFFf...",
  "..HhFFFFFFFFFff..",
  "..hFFFFFFFFFFff..",
  "..hFFFFFFFFFfff..",
  ".wfFFFFFFFFFfffw.",
  "....fFFFFFFff....",
  ".....fffffff.....",
]);

/** From the side, facing right: 14 wide, his muzzle and whiskers past his face (column 6 is his middle). */
const HEAD_SIDE = tpl([
  "......H.......",
  "......HH......",
  ".....HpF......",
  "....HhFFFF....",
  "...hFFFFFFF...",
  "...hFFFFWEe...",
  "...fFFFFeEeF..",
  "...fFFFFFFhhnw",
  "....fFFFFfhfww",
  ".....ffFFff...",
]);

/** The shirt from the front: 11 wide, 5 tall; a V collar and a badge. */
const TORSO = tpl([
  "UTTTRRRTTtt",
  "UTTTTRTTTtt",
  "UTYTTTTTTtt",
  "UTTTTTTTTtt",
  "tTTTTTTTttt",
]);

/** From the back: a number in the second colour. */
const TORSO_BACK = tpl([
  "UTTTTTTTTtt",
  "UTTTTRRTTtt",
  "UTTTRRRTTtt",
  "UTTTTRRTTtt",
  "tTTTTRRTttt",
]);

/** From the side, facing right: 7 wide. */
const TORSO_SIDE = tpl(["UTTTTRt", "UTTTTTt", "UTTTTTt", "UTTTTTt", "tTTTTtt"]);

const SHORTS = tpl(["OOOOOOOOo", "OOOo.OOoo"]);
const SHORTS_SIDE = tpl(["OOOOOOo", ".OOOOo."]);

const SOCK_L = tpl(["TTT"]);
const SOCK_R = tpl(["Ttt"]);
const BOOT = tpl(["kKKK", "KKKK"]);

/** Side view feet, facing right: the far leg darker, the near boot's toe forward. */
const FEET_SIDE = tpl([".tt.TT..", "KKKkKKK.", "KKKKKKKK"]);

// Arms, his right (on the right of the picture, a tone darker) and his left (lit): the
// sleeve and a black paw, its knuckles catching the light.
const ARM_DOWN_R = tpl(["tt.", "tt.", "tt.", "hFf", "Fff", ".ff"]);
const ARM_DOWN_L = tpl([".TT", ".UT", ".UT", "HhF", "hFf", "ff."]);
const ARM_OUT_R = tpl([".hF", "tFf", ".ff"]);
const ARM_OUT_L = tpl(["Hh.", "hFT", "ff."]);
const ARM_UP_R = tpl([".hF", ".Ff", ".ff", ".tt", ".t.", "tt."]);
const ARM_UP_L = tpl(["Hh.", "hF.", "ff.", "UT.", ".T.", ".TT"]);
/** Side view: the near arm out in front, the far one behind him. */
const ARM_NEAR = tpl([".hF", "ThF", ".ff"]);
const ARM_FAR = tpl(["ff", "ff", "f."]);

/** Sat on the grass, boots out in front, paws on the grass: 17 wide, rows -6..0. */
const SIT = tpl([
  "...UTTTRRRTTtt...",
  "...UTTTTRTTTtt...",
  "...UTYTTTTTTtt...",
  "...tTTTTTTTTtt...",
  "....OOOOOOOOo....",
  ".Hh.kKKOOOoKKK.hF",
  "fFf.KKKK.KKKK.fff",
]);

// ---------------------------------------------------------------------------
// The tail
// ---------------------------------------------------------------------------

/**
 * A tail's middle line from its root (0, 0) to its tip, as moves from cell to cell: `l`
 * left, `r` right, `u` up, `q` up and left, `e` up and right. Each cell is drawn two
 * pixels wide (tail()).
 */
type TailLine = readonly (readonly [number, number])[];

function tailLine(moves: string): TailLine {
  const out: [number, number][] = [];
  let x = 0;
  let y = 0;
  for (const m of moves) {
    x += m === "l" || m === "q" ? -1 : m === "r" || m === "e" ? 1 : 0;
    y += m === "u" || m === "q" || m === "e" ? -1 : 0;
    out.push([x, y]);
  }
  return out;
}

/**
 * His tail standing, facing right (and from the front: out to the picture's left). It
 * comes out from behind his hip, low and out past his paw, then up, its tip curled out;
 * it sways through the first three, and goes up high (the last) when he cheers.
 */
const TAILS: readonly TailLine[] = [
  tailLine("lllqlquuuuq"),
  tailLine("llqllqluuuuq"),
  tailLine("llqqluuuuq"),
  tailLine("lqqquuuuuq"),
];

/** Sat down: along the grass and curling up, its tip moving. */
const TAILS_SIT: readonly TailLine[] = [
  tailLine("lllqque"),
  tailLine("llllquu"),
];

/** From the back: straight up the middle of his back, over the shirt, its tip curling. */
const TAILS_BACK: readonly TailLine[] = [
  tailLine("uuueuue"),
  tailLine("uuuquuq"),
];

// ---------------------------------------------------------------------------
// Colours
// ---------------------------------------------------------------------------

interface Inks {
  /** By legend index (0: none). */
  by: Color[];
  /** The fur's colours, for the night rim. */
  fur: Set<Color>;
  /** His edge where the floodlights catch it at night, and where the sky does. */
  rim: Color;
  rimTop: Color;
  ball: Color;
  ballShade: Color;
  ballPatch: Color;
  shadow: Color;
  star: Color;
  starCore: Color;
}

const inksFor = new WeakMap<Lighting, Inks>();

function inks(light: Lighting): Inks {
  let k = inksFor.get(light);
  if (!k) {
    const club = clubOf(light);
    // the floodlights reach the lawn beside the stadium at night
    const g = light.lit;
    const by: Color[] = [];
    const set = (ch: string, c: Color) => {
      by[LEGEND.indexOf(ch)] = c;
    };
    set(".", TRANSPARENT);
    set("F", g(P.night));
    set("f", P.ink);
    set("h", g(P.slate));
    set("H", g(P.steel));
    // a cat's eyes catch any light going: raw, like a lamp
    set("e", P.ledGreen);
    set("E", P.ink);
    set("W", P.white);
    set("n", g(P.skinAShade));
    set("p", g(P.skinAShade));
    set("w", g(P.mist));
    set("T", g(P.home));
    set("t", g(P.homeDark));
    set("U", g(P.homeLight));
    set("Y", g(P.gold));
    set("R", g(club.second.base));
    set("O", g(club.second.base));
    set("o", g(club.second.dark));
    set("K", P.ink);
    set("k", g(P.slate));
    k = {
      by,
      fur: new Set([by[1], by[2], by[3]]),
      rim: g(P.mist),
      rimTop: g(P.steel),
      ball: g(P.white),
      ballShade: g(P.mist),
      ballPatch: g(P.slate),
      shadow: g(P.grassDeep),
      star: P.goldLight,
      starCore: P.white,
    };
    inksFor.set(light, k);
  }
  return k;
}

/**
 * Put template `t` so that its cell (ax, ay) lands on (x, y), mirrored about that cell when
 * `flip`.
 */
function put(
  s: Surface,
  t: Tpl,
  ax: number,
  ay: number,
  x: number,
  y: number,
  k: Inks,
  flip = false,
): void {
  for (let j = 0; j < t.h; j++) {
    for (let i = 0; i < t.w; i++) {
      const c = t.cells[j * t.w + i];
      if (c === 0) continue;
      s.px(x + (flip ? ax - i : i - ax), y + j - ay, k.by[c]);
    }
  }
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

/** His head with its middle column on x and its lowest row on `bottom`. */
function head(s: Surface, x: number, bottom: number, p: Pose, k: Inks): void {
  if (p.kind === "side") {
    put(s, HEAD_SIDE, 6, 9, x, bottom, k, p.face < 0);
    return;
  }
  const t = p.kind === "back" ? HEAD_BACK : p.blink ? HEAD_BLINK : HEAD;
  put(s, t, 8, 9, x, bottom, k);
}

/** His tail along `line` from its root (x, y), the lit pixel on the left; `dir` -1 mirrors it. */
function tail(
  s: Surface,
  x: number,
  y: number,
  line: TailLine,
  dir: 1 | -1,
  k: Inks,
): void {
  const F = k.by[1];
  const f = k.by[2];
  const h = k.by[3];
  const n = line.length;
  for (let i = 0; i < n; i++) {
    const cx = x + line[i][0] * dir;
    const cy = y + line[i][1];
    // the tip is a single pixel; the rest two wide, lit on the left and dark underneath
    if (i === n - 1) {
      s.px(cx, cy, h);
      continue;
    }
    s.px(cx, cy, i < n - 3 ? F : h);
    s.px(cx + 1, cy, i < 2 ? f : F);
    // along the grass it shows its dark underside, clear of his boot at the root
    if (i > 1 && i < n - 4 && line[i + 1][1] === line[i][1]) {
      s.px(cx, cy + 1, f);
    }
  }
}

/** A star of five pixels round (cx, cy), its middle white. */
function star(s: Surface, cx: number, cy: number, k: Inks): void {
  s.px(cx, cy - 1, k.star);
  s.px(cx - 1, cy, k.star);
  s.px(cx + 1, cy, k.star);
  s.px(cx, cy + 1, k.star);
  s.px(cx, cy, k.starCore);
}

/** Where the stars are in their two frames, round his head. */
const STARS: readonly (readonly [number, number])[][] = [
  [
    [-8, -17],
    [5, -20],
    [10, -12],
  ],
  [
    [8, -15],
    [-5, -20],
    [-10, -12],
  ],
];

/** The layer he is drawn in before he goes on the picture, and where his feet are in it. */
const LAYER_W = 36;
const LAYER_H = 36;
const LAYER_X = 16;
const LAYER_Y = 31;
let layer: Surface | null = null;

/**
 * At night the floodlights, off to his right, catch his right-hand edge, and what is left
 * of the sky his top: a black cat must not vanish into the dark lawn. Fur on an edge (next
 * to nothing) is lit in the rim colours.
 */
function rimLight(s: Surface, k: Inks): void {
  const { w, h } = s;
  const d = s.data;
  const was = d.slice();
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const c = was[y * w + x] as Color;
      if (c === 0 || !k.fur.has(c)) continue;
      if (was[y * w + x + 1] === 0) d[y * w + x] = k.rim;
      else if (was[(y - 1) * w + x] === 0) d[y * w + x] = k.rimTop;
    }
  }
}

/** Draw him, his ball and their shadows, with his boots on row y about x. */
export function drawMascot(
  s: Surface,
  x: number,
  y: number,
  frame: MascotFrame,
  light: Lighting,
): void {
  const k = inks(light);
  const p = frame.pose;
  // his shadow on the grass, a little smaller when he is off the ground
  s.rect(x - 5, y + 1, 11, 1, k.shadow);
  s.rect(x - 3, y + 2, 8, 1, k.shadow);
  if (p.lift === 0 && p.kind !== "side") {
    s.rect(x - 7, y + 1, 15, 1, k.shadow);
    s.rect(x - 5, y + 2, 12, 1, k.shadow);
  }
  // him, in a layer of his own (so the night can light his edge), then onto the picture
  layer ??= new Surface(LAYER_W, LAYER_H);
  const l = layer;
  l.clear();
  const lx = LAYER_X;
  const ly = LAYER_Y;
  const hy = p.hy * 2;
  const sway = frame.tail ?? 0;
  if (p.kind === "sit") {
    tail(l, lx - 7, ly, TAILS_SIT[sway % 2], 1, k);
    put(l, SIT, 8, 6, lx, ly, k);
    head(l, lx, ly - 7 + hy, p, k);
  } else {
    const by = ly - LIFT[p.lift];
    const up = p.hands === "up" ? 3 : sway;
    if (p.kind === "side") {
      tail(l, lx - 3 * p.face, by - 3, TAILS[up], p.face, k);
      side(l, lx, by, p, k);
    } else if (p.kind === "back") {
      front(l, lx, by, p, k);
      tail(l, lx, by - 4, TAILS_BACK[sway % 2], 1, k);
    } else {
      tail(l, lx - 4, by - 2, TAILS[up], 1, k);
      front(l, lx, by, p, k);
    }
    head(l, lx, by - 10 + hy, p, k);
  }
  if (light.lightsOn) rimLight(l, k);
  s.blit(l, x - lx, y - ly);
  if (p.kind === "sit" && p.stars) {
    for (const [sx, sy] of STARS[p.stars - 1]) star(s, x + sx, y + sy, k);
  }
  drawBall(s, x, y, frame.ball, k);
}

/** His body from the front or the back, boots on row `by`. */
function front(s: Surface, x: number, by: number, p: Pose, k: Inks): void {
  // boots and socks: together, or one up for a touch, or the right one kicking high
  const tapL = p.feet === "tapL";
  const tapR = p.feet === "tapR";
  const kick = p.feet === "kick";
  if (tapL) put(s, BOOT, 0, 0, x - 6, by - 4, k);
  else {
    put(s, SOCK_L, 0, 0, x - 3, by - 2, k);
    put(s, BOOT, 0, 0, x - 4, by - 1, k);
  }
  if (tapR) put(s, BOOT, 0, 0, x + 3, by - 4, k);
  else if (kick) {
    s.rect(x + 2, by - 3, 2, 1, k.by[LEGEND.indexOf("t")]);
    put(s, BOOT, 0, 0, x + 4, by - 6, k);
  } else {
    put(s, SOCK_R, 0, 0, x + 1, by - 2, k);
    put(s, BOOT, 0, 0, x + 1, by - 1, k);
  }
  put(s, SHORTS, 4, 0, x, by - 4, k);
  put(s, p.kind === "back" ? TORSO_BACK : TORSO, 5, 0, x, by - 9, k);
  // arms: the right one waves while the left hangs
  const right = p.hands === "wave" ? "up" : p.hands;
  const left = p.hands === "wave" ? "down" : p.hands;
  if (right === "down") put(s, ARM_DOWN_R, 0, 0, x + 6, by - 9, k);
  else if (right === "out") put(s, ARM_OUT_R, 0, 0, x + 6, by - 10, k);
  else put(s, ARM_UP_R, 0, 0, x + 6, by - 14, k);
  if (left === "down") put(s, ARM_DOWN_L, 2, 0, x - 6, by - 9, k);
  else if (left === "out") put(s, ARM_OUT_L, 2, 0, x - 6, by - 10, k);
  else put(s, ARM_UP_L, 2, 0, x - 6, by - 14, k);
}

/** His body from the side, facing `p.face`, boots on row `by`. */
function side(s: Surface, x: number, by: number, p: Pose, k: Inks): void {
  const flip = p.face < 0;
  put(s, ARM_FAR, 1, 0, x - 5 * p.face, by - 10, k, flip);
  put(s, FEET_SIDE, 3, 2, x, by, k, flip);
  put(s, SHORTS_SIDE, 3, 0, x, by - 4, k, flip);
  put(s, TORSO_SIDE, 3, 0, x, by - 9, k, flip);
  put(s, ARM_NEAR, 0, 0, x + 4 * p.face, by - 10, k, flip);
}

/** His ball: 4 x 4, a patch, its lit and shaded sides. Legend `.`, `W`, `m`, `k`. */
const BALL = ".WW.WWWm" + "WkWm.mm.";

/** His ball, 4 x 4, at the frame's place and height times K, with its shadow when it flies. */
function drawBall(
  s: Surface,
  x: number,
  y: number,
  ball: { x: number; h: number },
  k: Inks,
): void {
  const bx = Math.round(x + ball.x * K);
  const bh = Math.round(ball.h * K);
  if (bh > 0) {
    s.rect(bx, y + 1, 4, 1, k.shadow);
    s.rect(bx + 1, y + 2, 2, 1, k.shadow);
  }
  const top = y - bh - 3;
  for (let j = 0; j < 4; j++) {
    for (let i = 0; i < 4; i++) {
      const ch = BALL[j * 4 + i];
      if (ch === ".") continue;
      const c = ch === "W" ? k.ball : ch === "m" ? k.ballShade : k.ballPatch;
      s.px(bx + i, top + j, c);
    }
  }
}
