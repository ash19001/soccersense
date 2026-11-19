/**
 * The match on the pitch: forty seconds of play at a time, each a script from a kick-off to
 * a goal and back to the centre spot, one after another in a seeded random order (the
 * product owner, 2026-11-15: "create at least 2 more variations with 1 of them being the
 * away team scoring ... randomly played").
 *
 * Positions are in map units on the pitch (X towards the east goal, V towards the far
 * touchline, the centre spot at the origin; the pitch is 68 by 44 either side of it).
 * The home side (players 0 to 10, in the club's warm red-orange) attacks east; the away
 * side (11 to 21, in teal) attacks west; player 22 is the referee. 0 and 11 keep goal.
 *
 * The plays (`SCRIPTS`), each kicked off by the away side:
 *
 *   THE LONG BALL (the home side scores at 26)
 *    0   the away side kicks off and plays it back
 *    4   their pass out wide is cut out by the home right midfielder
 *    6   the home side builds: inside, up to the striker, laid off, spread to the left wing
 *   11   the winger runs at the full back and crosses
 *   14.5 a header, and the keeper saves it (the crowd gasps)
 *   17   the away side breaks down their right
 *   21.7 the through ball is read by a home centre back, who hits it long
 *   24.4 the striker takes it on and shoots
 *   26   GOAL (the crowd erupts); the scorer wheels away, the others chase
 *   30   the ball is kicked back to the centre spot; everybody walks back
 *
 *   THE BREAK (the away side scores at 24.3)
 *    0   the away side kicks off and keeps it, back to a centre back, out to the near side
 *    9.9 the home left midfielder wins it; inside, and the striker runs at goal
 *   15.7 his shot is saved (a gasp); the keeper kicks it long
 *   19   it is flicked on, the away striker runs onto it and squares it
 *   24.3 GOAL for the away side (their end cheers, the rest is quiet); they slide to the
 *        far corner flag
 *   30   the ball is kicked back to the centre spot for the home side's kick-off
 *
 *   THE HEADER (the home side scores at 24)
 *    0   the away side kicks off, out to their far-side midfielder, who runs at the full
 *        back and is tackled
 *    7   the home side keeps it: back, switched long to the near side, up the line, into
 *        the striker and back
 *   18.4 through down the near line; the midfielder overlaps to the byline and crosses
 *   23.5 a striker heads it in at the far post; they celebrate by the near corner flag
 *   30   the ball is kicked back to the centre spot
 *
 * The same plays kicked off by the home side are their mirror images (`mirror`: each side
 * plays the other's part, from the other end): after a goal the side that let it in kicks
 * off, so the play after a home goal is one of the three, after an away goal one of their
 * mirrors. `playOf(seed, k)` picks the `k`th play: any of the three (or their mirrors) at
 * random, the seed's own order. Every play starts and ends with everybody lined up for a
 * kick-off (`lineUpFor`), the ball at the kicker's feet, so any play runs on from any.
 *
 * Everybody not on the ball keeps their place in a 4-4-2 that slides with the play.
 *
 * The script says where each player means to be; the players run there as people do
 * (`track`): no faster than a sprint (RUN units a second), speeding up and slowing down
 * over a few strides (PUSH), never standing on one another (ROOM), so nobody jumps
 * across the pitch when the shape slides after a long ball, the ball goes in or the
 * teams line up again. Each play's runs are worked out once, from the line-up, and the
 * hair they end from the next line-up spread over the play, and kept as a table (SAMPLES a
 * second) that `matchAt` reads between rows: a player's place is smooth in time, from one
 * play into the next included. Each player's `stride` says whether he stands (-1) or which
 * foot leads in his run (0, 1), changing once a stride's length of ground (STRIDE) and
 * only when he really moves.
 *
 * Everything is a pure function of the seed and the time.
 */

import { hash2 } from "~/pixel";

export const MATCH_PERIOD = 40;
export const PLAYERS = 23;
export const REFEREE = 22;
/** Half the pitch, in units. */
const HALF_X = 68;
const HALF_V = 44;

/** A side: 0 the home side, 1 the away side. */
export type Side = 0 | 1;

type XV = readonly [number, number];

/** The home side's shape in open play; the away side's is its mirror image. */
const SHAPE: readonly XV[] = [
  [-64, 0],
  [-36, -30],
  [-44, -10],
  [-44, 10],
  [-36, 30],
  [-8, -33],
  [-16, -9],
  [-14, 10],
  [-8, 33],
  [16, -8],
  [18, 9],
];
/** How far each line follows the ball up and down the pitch. */
const FOLLOW: readonly number[] = [
  0.04, 0.3, 0.26, 0.26, 0.3, 0.42, 0.4, 0.4, 0.42, 0.46, 0.46,
];

/** Where everybody stands for the away side's kick-off. */
const KICKOFF: readonly XV[] = [
  [-64, 0],
  [-34, -30],
  [-42, -10],
  [-42, 10],
  [-34, 30],
  [-14, -30],
  [-20, -8],
  [-20, 10],
  [-14, 30],
  [-14, -5],
  [-6, 17],
  [64, 0],
  [34, 30],
  [42, 10],
  [42, -10],
  [34, -30],
  [12, 32],
  [18, 8],
  [16, -9],
  [10, -30],
  [1, 0],
  [2, 8],
];

/** Player p of one side as the same player of the other (the referee is the referee). */
function swap(p: number): number {
  return p < 0 || p === REFEREE ? p : p < 11 ? p + 11 : p - 11;
}

/** Where everybody stands for `side`'s kick-off: the home side's is the away side's mirror. */
function kickoffSpot(side: Side, p: number): XV {
  if (side === 1) return KICKOFF[p];
  const [x, v] = KICKOFF[swap(p)];
  return [-x, -v];
}

interface Beat {
  /** Who: a player, or -1 for the ball alone (in the net). */
  p: number;
  /** From when to when they have the ball (or, for a run, are at the place). */
  t0: number;
  t1: number;
  a: XV;
  b: XV;
  /** The ball arrives through the air this high (a cross, a long ball). */
  loft?: number;
  /** A run without the ball. */
  run?: boolean;
  /** Seconds to drift back into the shape afterwards (default 3.5). */
  tail?: number;
  /** Seconds to get there from the shape beforehand (default 3.2). */
  lead?: number;
}

/** The crowd's buzz as a chance builds: up from `from` to `to`, gone at `until`. */
interface Buzz {
  from: number;
  to: number;
  until: number;
  size: number;
}

/** A play: from a kick-off to a goal and the ball back on the centre spot. */
interface Script {
  name: string;
  /** Written for the other side and mirrored (`mirror`). */
  mirrored?: boolean;
  /** Who kicks off, and who scores. */
  kickoff: Side;
  scorer: Side;
  /** When the ball goes in. */
  goal: number;
  beats: readonly Beat[];
  /** The crowd's gasps (a save): from when, for how long, how big. */
  gasps: readonly (readonly [number, number, number])[];
  buzz: readonly Buzz[];
}

const H = (n: number): number => n;
const A = (n: number): number => 11 + n;

const LONG_BALL: Script = {
  name: "long ball",
  kickoff: 1,
  scorer: 0,
  goal: 26,
  beats: [
    { p: A(9), t0: 0, t1: 1, a: [1, 0], b: [1, 0] },
    { p: A(7), t0: 1.7, t1: 3, a: [15, -8], b: [13, -10] },
    { p: H(5), t0: 4, t1: 5.6, a: [3, -24], b: [14, -22] },
    { p: H(6), t0: 6.3, t1: 7.2, a: [12, -8], b: [16, -6] },
    { p: H(9), t0: 7.9, t1: 8.6, a: [32, -10], b: [31, -8] },
    { p: H(7), t0: 9.3, t1: 10.2, a: [27, 6], b: [31, 9] },
    { p: H(8), t0: 11.3, t1: 13.6, a: [40, 34], b: [58, 36] },
    { p: H(10), t0: 14.5, t1: 14.6, a: [56, 4], b: [57, 4], loft: 5 },
    { p: A(0), t0: 14.95, t1: 16.4, a: [66, 2], b: [64, 4] },
    { p: A(1), t0: 17.3, t1: 18.8, a: [44, 28], b: [30, 30] },
    { p: A(5), t0: 19.6, t1: 20.8, a: [9, 32], b: [-4, 29] },
    { p: H(3), t0: 21.7, t1: 22.8, a: [-32, 16], b: [-27, 13] },
    { p: H(9), t0: 24.4, t1: 25.6, a: [30, -4], b: [50, -2], loft: 7 },
    { p: -1, t0: 26, t1: 30, a: [70, -2], b: [70, -2] },
    { p: A(9), t0: 32, t1: 40, a: [1, 0], b: [1, 0], loft: 6 },
    // runs off the ball
    { p: A(8), t0: 4, t1: 4.5, a: [6, -29], b: [4, -27], run: true },
    { p: A(9), t0: 21.3, t1: 22, a: [-29, 12], b: [-33, 15], run: true },
    { p: A(2), t0: 13.9, t1: 14.6, a: [58, 7], b: [59, 6], run: true },
    { p: H(9), t0: 14.2, t1: 14.8, a: [60, -6], b: [62, -5], run: true },
    { p: A(3), t0: 25.2, t1: 25.8, a: [55, -6], b: [58, -5], run: true },
    // the scorer wheels away to the far touchline, the others chase
    {
      p: H(9),
      t0: 28.7,
      t1: 30.4,
      a: [46, 27],
      b: [44, 30],
      run: true,
      tail: 8,
    },
    {
      p: H(10),
      t0: 29.1,
      t1: 30.4,
      a: [49, 26],
      b: [47, 29],
      run: true,
      tail: 8,
    },
    {
      p: H(7),
      t0: 29.5,
      t1: 30.4,
      a: [42, 25],
      b: [42, 28],
      run: true,
      tail: 8,
    },
    {
      p: H(8),
      t0: 29.1,
      t1: 30.4,
      a: [45, 33],
      b: [45, 32],
      run: true,
      tail: 8,
    },
    {
      p: H(6),
      t0: 29.8,
      t1: 30.4,
      a: [40, 30],
      b: [41, 31],
      run: true,
      tail: 8,
      lead: 4.5,
    },
    {
      p: H(5),
      t0: 29.9,
      t1: 30.4,
      a: [46, 23],
      b: [45, 25],
      run: true,
      tail: 8,
      lead: 4.5,
    },
  ],
  gasps: [[14.95, 1.65, 0.42]],
  buzz: [
    { from: 12.6, to: 14.6, until: 14.95, size: 0.14 },
    { from: 24.4, to: 26, until: 26, size: 0.16 },
  ],
};

const BREAK: Script = {
  name: "break",
  kickoff: 1,
  scorer: 1,
  goal: 24.3,
  beats: [
    { p: A(9), t0: 0, t1: 1, a: [1, 0], b: [1, 0] },
    { p: A(6), t0: 1.8, t1: 3, a: [10, 3], b: [9, 5] },
    { p: A(3), t0: 4, t1: 5, a: [40, -10], b: [38, -12] },
    { p: A(4), t0: 6, t1: 7.6, a: [34, -30], b: [24, -32] },
    { p: A(8), t0: 8.5, t1: 9.6, a: [8, -33], b: [2, -31] },
    // the home left midfielder nicks it, and they go
    { p: H(5), t0: 9.9, t1: 11, a: [0, -30], b: [4, -27] },
    { p: H(6), t0: 11.8, t1: 12.7, a: [-4, -10], b: [0, -8] },
    { p: H(10), t0: 13.6, t1: 15, a: [18, 7], b: [30, 9] },
    // saved; the keeper bounces it and kicks it long
    { p: A(0), t0: 15.7, t1: 17.4, a: [64, 5], b: [61, 3] },
    { p: A(10), t0: 19, t1: 19.8, a: [-6, -12], b: [-8, -14], loft: 10 },
    { p: A(9), t0: 20.6, t1: 22, a: [-22, 2], b: [-36, 4] },
    { p: A(5), t0: 22.8, t1: 23.4, a: [-43, 18], b: [-48, 14] },
    { p: -1, t0: 24.3, t1: 28.3, a: [-70, -4], b: [-70, -4] },
    { p: H(9), t0: 30.3, t1: 40, a: [-1, 0], b: [-1, 0], loft: 6 },
    // runs off the ball
    { p: A(5), t0: 19, t1: 19.6, a: [-20, 28], b: [-24, 27], run: true },
    { p: H(2), t0: 21, t1: 22.6, a: [-30, 0], b: [-40, 4], run: true },
    { p: H(3), t0: 22.4, t1: 23.4, a: [-43, 12], b: [-45, 12], run: true },
    { p: H(0), t0: 23.2, t1: 24.2, a: [-62, 4], b: [-63, 8], run: true },
    { p: A(2), t0: 14.6, t1: 15.4, a: [42, 10], b: [44, 9], run: true },
    // the second away striker peels off to the far side after the kick-off
    { p: A(10), t0: 3.2, t1: 4, a: [-6, 14], b: [-9, 15], run: true },
    // the home strikers back for their kick-off, the second in his place first
    {
      p: H(10),
      t0: 27.4,
      t1: 28.4,
      a: [-4, -10],
      b: [-3, -9],
      run: true,
      tail: 10,
    },
    // the scorer slides to the far corner flag, two others pile on
    {
      p: A(5),
      t0: 26.2,
      t1: 28,
      a: [-55, 29],
      b: [-57, 33],
      run: true,
      tail: 8,
    },
    {
      p: A(9),
      t0: 26.8,
      t1: 28,
      a: [-52, 27],
      b: [-54, 31],
      run: true,
      tail: 8,
    },
    {
      p: A(10),
      t0: 27.4,
      t1: 28,
      a: [-50, 30],
      b: [-51, 33],
      run: true,
      tail: 8,
      lead: 4.5,
    },
  ],
  gasps: [[15.7, 1.65, 0.42]],
  buzz: [
    { from: 13.6, to: 15.4, until: 15.7, size: 0.14 },
    { from: 22, to: 24.3, until: 24.3, size: 0.1 },
  ],
};

const HEADER: Script = {
  name: "header",
  kickoff: 1,
  scorer: 0,
  goal: 24,
  beats: [
    { p: A(9), t0: 0, t1: 1, a: [1, 0], b: [1, 0] },
    { p: A(10), t0: 1.6, t1: 2.5, a: [3, 10], b: [1, 12] },
    { p: A(5), t0: 3.3, t1: 5.2, a: [-2, 32], b: [-14, 34] },
    // the home full back tackles, and they keep it
    { p: H(4), t0: 5.5, t1: 6.5, a: [-16, 32], b: [-14, 30] },
    { p: H(7), t0: 7.3, t1: 8.3, a: [-10, 12], b: [-8, 10] },
    { p: H(3), t0: 9.2, t1: 10, a: [-34, 10], b: [-33, 8] },
    { p: H(1), t0: 11.4, t1: 12.8, a: [-30, -30], b: [-20, -32], loft: 6 },
    { p: H(5), t0: 13.6, t1: 14.4, a: [-6, -33], b: [0, -34] },
    { p: H(9), t0: 15.3, t1: 16.1, a: [14, -14], b: [18, -11] },
    { p: H(6), t0: 16.8, t1: 17.6, a: [6, -8], b: [10, -6] },
    // through down the line, the overlap, the cross, the header
    { p: H(5), t0: 18.6, t1: 22, a: [24, -32], b: [50, -34] },
    { p: H(10), t0: 23.5, t1: 23.6, a: [60, 2], b: [61, 2], loft: 7 },
    { p: -1, t0: 24, t1: 28, a: [70, 6], b: [70, 6] },
    { p: A(9), t0: 30, t1: 40, a: [1, 0], b: [1, 0], loft: 6 },
    // runs off the ball
    { p: H(10), t0: 21, t1: 22, a: [48, 6], b: [54, 4], run: true },
    { p: H(9), t0: 22.4, t1: 23.4, a: [56, -6], b: [60, -5], run: true },
    { p: A(3), t0: 22.6, t1: 23.4, a: [58, -9], b: [61, -9], run: true },
    { p: A(2), t0: 23, t1: 23.6, a: [57, 6], b: [58, 5], run: true },
    { p: A(4), t0: 20, t1: 22.2, a: [40, -30], b: [47, -31], run: true },
    { p: A(0), t0: 23.4, t1: 24.2, a: [64, -3], b: [64, -6], run: true },
    // the scorer runs to the near corner flag, the others after him
    {
      p: H(10),
      t0: 26,
      t1: 27.8,
      a: [55, -26],
      b: [53, -30],
      run: true,
      tail: 8,
    },
    {
      p: H(5),
      t0: 26.2,
      t1: 27.8,
      a: [51, -32],
      b: [50, -34],
      run: true,
      tail: 8,
    },
    {
      p: H(9),
      t0: 26.8,
      t1: 27.8,
      a: [50, -25],
      b: [48, -28],
      run: true,
      tail: 8,
    },
    {
      p: H(6),
      t0: 27.4,
      t1: 27.8,
      a: [46, -29],
      b: [46, -32],
      run: true,
      tail: 8,
      lead: 4.5,
    },
  ],
  gasps: [],
  buzz: [{ from: 20.4, to: 23.5, until: 24, size: 0.16 }],
};

/** The plays as written: each kicked off by the away side. */
const SCRIPTS: readonly Script[] = [LONG_BALL, BREAK, HEADER];

/** A play kicked off by the other side: everybody plays the other's part, at the other end. */
function mirror(s: Script): Script {
  return {
    ...s,
    name: `${s.name} (mirrored)`,
    mirrored: true,
    kickoff: s.kickoff === 0 ? 1 : 0,
    scorer: s.scorer === 0 ? 1 : 0,
    beats: s.beats.map((b) => ({
      ...b,
      p: swap(b.p),
      a: [-b.a[0], -b.a[1]],
      b: [-b.b[0], -b.b[1]],
    })),
  };
}

interface Play extends Script {
  /** The beats that move the ball, in order. */
  ball: readonly Beat[];
  /** Each player's beats, in order. */
  of: readonly (readonly Beat[])[];
  /** Its runs, worked out when first asked for. */
  table: Track | null;
  /** The same, part made: worked out a slice at a time (`matchSteps`). */
  making: Generator<void, Track, void> | null;
}

function compile(s: Script): Play {
  return {
    ...s,
    ball: s.beats.filter((b) => !b.run).sort((x, y) => x.t0 - y.t0),
    of: Array.from({ length: PLAYERS }, (_, p) =>
      s.beats.filter((b) => b.p === p).sort((x, y) => x.t0 - y.t0),
    ),
    table: null,
    making: null,
  };
}

/** The plays a side kicks off: [the home side's, the away side's]. */
const PLAYS: readonly (readonly Play[])[] = [
  SCRIPTS.map((s) => compile(mirror(s))),
  SCRIPTS.map((s) => compile(s)),
];

/** How many plays there are, written and mirrored. */
export const PLAY_COUNT = PLAYS[0].length + PLAYS[1].length;

/** Each seed's plays so far: the `k`th is PLAYS[side][i], kept as side * 16 + i. */
const ORDERS = new Map<number, number[]>();

/**
 * The `k`th play (from 0) for this seed: any of those the side that kicks off has but the
 * one just played (as written or mirrored), at random, the side that let in the last goal
 * kicking off (the away side the first).
 */
function playOf(seed: number, k: number): Play {
  const key = seed | 0;
  let order = ORDERS.get(key);
  if (!order) {
    if (ORDERS.size > 32) ORDERS.clear();
    order = [];
    ORDERS.set(key, order);
  }
  const n = Math.max(0, Math.floor(k));
  while (order.length <= n) {
    const j = order.length;
    let side: Side = 1;
    // (the play just played, written or mirrored, is not played again straight away)
    let skip = -1;
    if (j > 0) {
      const last = order[j - 1];
      const prev = PLAYS[last >> 4][last & 15];
      side = prev.scorer === 0 ? 1 : 0;
      skip = last & 15;
    }
    const count = PLAYS[side].length - (skip < 0 ? 0 : 1);
    let i = Math.min(count - 1, Math.floor(hash2(j, 7_717, key) * count));
    if (skip >= 0 && i >= skip) i++;
    order.push(side * 16 + i);
  }
  const at = order[n];
  return PLAYS[at >> 4][at & 15];
}

/**
 * Which play the `k`th is, for this seed: its name ("long ball", "break", "header", and
 * the same "(mirrored)"), who kicks it off, who scores and when (seconds into it).
 */
export function matchPlay(
  seed: number,
  k: number,
): { name: string; kickoff: Side; scorer: Side; goal: number } {
  const p = playOf(seed, k);
  return { name: p.name, kickoff: p.kickoff, scorer: p.scorer, goal: p.goal };
}

/** The goal of the play under way at scene time `t`: when it goes in (scene time), whose. */
export function matchGoalNear(
  seed: number,
  t: number,
): { at: number; by: Side } {
  const k = Math.floor((Number.isFinite(t) ? t : 0) / MATCH_PERIOD);
  const p = playOf(seed, k);
  return { at: Math.max(0, k) * MATCH_PERIOD + p.goal, by: p.scorer };
}

const TAIL = 3.5;
const LEAD = 3.2;
/** A gap between two beats of the same player shorter than this is run straight. */
const DIRECT = 5.5;

function smooth(u: number): number {
  const x = u <= 0 ? 0 : u >= 1 ? 1 : u;
  return x * x * (3 - 2 * x);
}

function ramp(t: number, a: number, b: number): number {
  return smooth((t - a) / (b - a));
}

/** A time within a play: clamped to it. */
function within(t: number): number {
  return t < 0 ? 0 : t > MATCH_PERIOD ? MATCH_PERIOD : t;
}

const TAU = Math.PI * 2;

export interface MatchState {
  /** Players' places: x[i], v[i] for i in 0..22. */
  x: Float32Array;
  v: Float32Array;
  ballX: number;
  ballV: number;
  /** The ball's height off the grass, in units. */
  ballH: number;
  /** How loud the crowd is about it: 0 watching, 0.4 a gasp, 1 a goal. */
  cheer: number;
  /** Seconds since the goal went in, or -1. */
  sinceGoal: number;
  /** Whose goal it is while `sinceGoal` counts (0 home, 1 away), else -1. */
  goalBy: -1 | Side;
  /** Each player's legs: -1 standing, else which foot leads in his run (0 or 1). */
  stride: Int8Array;
}

export function makeMatchState(): MatchState {
  return {
    x: new Float32Array(PLAYERS),
    v: new Float32Array(PLAYERS),
    stride: new Int8Array(PLAYERS).fill(-1),
    ballX: 0,
    ballV: 0,
    ballH: 0,
    cheer: 0,
    sinceGoal: -1,
    goalBy: -1,
  };
}

const spot = { X: 0, V: 0, H: 0 };

/** The ball is a stride in front of whoever has it, the way they are playing. */
function stride(e: Beat): number {
  return e.p < 0 ? 0 : e.p < 11 ? 1.7 : -1.7;
}

/** Where the ball is on the ground at play time `t` (0..PERIOD), and how high. */
function ballAt(play: Play, t: number): void {
  const list = play.ball;
  const n = list.length;
  for (let i = 0; i < n; i++) {
    const e = list[i];
    if (t >= e.t0 && t <= e.t1) {
      const u = e.t1 <= e.t0 ? 0 : (t - e.t0) / (e.t1 - e.t0);
      spot.X = e.a[0] + (e.b[0] - e.a[0]) * u + stride(e);
      spot.V = e.a[1] + (e.b[1] - e.a[1]) * u;
      spot.H = 0;
      return;
    }
    if (i + 1 < n && t > e.t1 && t < list[i + 1].t0) {
      const next = list[i + 1];
      const u = (t - e.t1) / (next.t0 - e.t1);
      const from = e.b[0] + stride(e);
      spot.X = from + (next.a[0] + stride(next) - from) * u;
      spot.V = e.b[1] + (next.a[1] - e.b[1]) * u;
      spot.H = (next.loft ?? 0) * 4 * u * (1 - u);
      return;
    }
  }
  // before the first beat or after the last: with it
  const e = t < list[0].t0 ? list[0] : list[n - 1];
  const end = t < list[0].t0 ? e.a : e.b;
  spot.X = end[0] + stride(e);
  spot.V = end[1];
  spot.H = 0;
}

/** 1 while a side is lined up for a kick-off, 0 in open play. */
function lineUp(play: Play, team: Side, t: number): number {
  const g = play.goal;
  const scored = team === play.scorer;
  return (
    1 -
    ramp(t, 0.5, team === play.kickoff ? 3 : 3.5) +
    ramp(t, g + (scored ? 4.5 : 1), g + (scored ? 12.5 : 10))
  );
}

/** Where player p (not the referee) lines up at play time t: for its kick-off, then the next. */
function lineUpFor(play: Play, p: number, t: number): XV {
  const side: Side = t < play.goal ? play.kickoff : play.scorer === 0 ? 1 : 0;
  return kickoffSpot(side, p);
}

const place = { X: 0, V: 0 };

/** A player's place in the team's shape, with the ball at (bx, bv). */
function shapeAt(
  play: Play,
  p: number,
  t: number,
  bx: number,
  bv: number,
): void {
  if (p === REFEREE) {
    place.X = bx * 0.6 - 5;
    place.V = bv * 0.4 + 10;
    return;
  }
  const team: Side = p < 11 ? 0 : 1;
  const j = p % 11;
  const sign = team === 0 ? 1 : -1;
  const baseX = SHAPE[j][0] * sign;
  const baseV = SHAPE[j][1] * sign;
  const ko = lineUp(play, team, t);
  // jogging on the spot: whole cycles per play, so each play meets the next (in a mirrored
  // play each jogs as the player whose part he plays, mirrored, so it plays out as written)
  const idle = 1 - 0.8 * ko;
  const q = play.mirrored ? swap(p) : p;
  const flip = play.mirrored ? -1 : 1;
  const jx =
    Math.sin((TAU * (5 + (q % 4)) * t) / MATCH_PERIOD + q * 2.1) *
    1.3 *
    idle *
    flip;
  const jv =
    Math.cos((TAU * (4 + (q % 3)) * t) / MATCH_PERIOD + q * 1.7) *
    1.1 *
    idle *
    flip;
  const openX = baseX + FOLLOW[j] * bx + jx;
  const openV = baseV + (j === 0 ? 0.1 : 0.2) * (bv - baseV) + jv;
  const [kx, kv] = lineUpFor(play, p, t);
  place.X = openX + (kx - openX) * ko;
  place.V = openV + (kv - openV) * ko;
}

function playerAt(
  play: Play,
  p: number,
  t: number,
  bx: number,
  bv: number,
): void {
  shapeAt(play, p, t, bx, bv);
  const list = play.of[p];
  const n = list.length;
  if (n === 0) return;
  // the beat before (or at) t and the one after, within the play
  let prev: Beat | null = null;
  let next: Beat | null = null;
  for (let i = 0; i < n; i++) {
    const e = list[i];
    if (t >= e.t0 && t <= e.t1) {
      const u = e.t1 <= e.t0 ? 0 : (t - e.t0) / (e.t1 - e.t0);
      place.X = e.a[0] + (e.b[0] - e.a[0]) * u;
      place.V = e.a[1] + (e.b[1] - e.a[1]) * u;
      return;
    }
    if (e.t1 < t) prev = e;
    else if (!next) next = e;
  }
  if (prev && next) {
    const gap = next.t0 - prev.t1;
    const tail = prev.tail ?? TAIL;
    const lead = next.lead ?? LEAD;
    if (gap <= Math.max(DIRECT, tail + lead)) {
      const u = smooth((t - prev.t1) / gap);
      place.X = prev.b[0] + (next.a[0] - prev.b[0]) * u;
      place.V = prev.b[1] + (next.a[1] - prev.b[1]) * u;
      return;
    }
  }
  const out = prev ? 1 - (t - prev.t1) / (prev.tail ?? TAIL) : 0;
  const into = next ? 1 - (next.t0 - t) / (next.lead ?? LEAD) : 0;
  if (prev && out > 0) {
    const w = smooth(out);
    place.X += (prev.b[0] - place.X) * w;
    place.V += (prev.b[1] - place.V) * w;
  } else if (next && into > 0) {
    const w = smooth(into);
    place.X += (next.a[0] - place.X) * w;
    place.V += (next.a[1] - place.V) * w;
  }
}

/** Where the script puts every player at play time `t` (0..PERIOD), into `xs`, `vs`. */
function scriptAt(
  play: Play,
  t: number,
  xs: Float64Array,
  vs: Float64Array,
): void {
  ballAt(play, t);
  const bx = spot.X;
  const bv = spot.V;
  // the shape follows where the ball was a moment ago, so a long pass does not jerk it
  // (a shot takes as long, or the ball stopping dead in the net stops everybody a stride)
  ballAt(play, within(t - 0.9));
  const sx = (bx + spot.X) / 2;
  const sv = (bv + spot.V) / 2;
  // the referee trails the play: where the ball has been over the last four seconds
  let rx = 0;
  let rv = 0;
  for (let i = 0; i < 4; i++) {
    ballAt(play, within(t - 0.5 - i));
    rx += spot.X / 4;
    rv += spot.V / 4;
  }
  for (let p = 0; p < PLAYERS; p++) {
    if (p === REFEREE) playerAt(play, p, t, rx, rv);
    else playerAt(play, p, t, sx, sv);
    xs[p] = Math.max(-HALF_X - 3, Math.min(HALF_X + 3, place.X));
    vs[p] = Math.max(-HALF_V + 1, Math.min(HALF_V - 1, place.V));
  }
}

/**
 * Where everybody stands, still, for `side`'s kick-off: where every play kicked off by
 * that side starts, and every play that ends with it ends. The referee waits a little
 * behind the ball, on the far side of it.
 */
function lineUpState(side: Side, xs: Float64Array, vs: Float64Array): void {
  for (let p = 0; p < PLAYERS; p++) {
    if (p === REFEREE) {
      const ball = side === 1 ? 1 - 1.7 : -1 + 1.7;
      xs[p] = ball * 0.6 - 5;
      vs[p] = 10;
      continue;
    }
    const [x, v] = kickoffSpot(side, p);
    xs[p] = x;
    vs[p] = v;
  }
}

/** Is player p on the ball or on a scripted run at play time t (or about to be)? */
function onBeat(play: Play, p: number, t: number): boolean {
  for (const e of play.of[p]) if (t >= e.t0 - 0.3 && t <= e.t1) return true;
  return false;
}

// ---------------------------------------------------------------------------
// The runs: the script's places, run as people run them
// ---------------------------------------------------------------------------

/** Rows of the table a second. */
const SAMPLES = 30;
/** Steps of the run worked out per row. */
const SUB = 1;
/** A sprint, in units a second (a unit is about three quarters of a metre). */
const RUN = 11;
/** The referee's best pace. */
const REF_RUN = 8;
/** How fast a player picks up or loses pace, in units a second each second. */
const PUSH = 34;
/** Seconds to close a gap to where he means to be, on top of keeping up with it. */
const CATCH = 0.3;
/** How close two players may come: across (X) and up the pitch (V), in units. */
const ROOM_X = 1.7;
const ROOM_V = 3.6;
/** Slower than this (units a second, over a fifth of a second) a player stands. */
const STILL = 2.4;
/** The ground a stride covers, in units, before the other foot leads. */
const STRIDE = 1.5;

interface Track {
  /** Row r, player p: x at [r * PLAYERS + p]; one row more than the play, its end. */
  x: Float32Array;
  v: Float32Array;
  /** The ground each has covered at a run since the play began, at each row. */
  d: Float32Array;
  /** Each player's stride, so a whole number of pairs of them fills the play. */
  stride: Float32Array;
}

/**
 * Work a play's runs out (once): from the line-up for its kick-off, at rest, to the
 * line-up for the next, the hair it ends from it spread over the play.
 */
function track(play: Play): Track {
  if (play.table) return play.table;
  // whatever `matchSteps` has worked out of it already is kept: the rest is done now
  const steps = play.making ?? trackSteps(play);
  let r = steps.next();
  while (!r.done) r = steps.next();
  return r.value;
}

/** `track`'s work, in slices of a few milliseconds. */
function* trackSteps(play: Play): Generator<void, Track, void> {
  const rows = MATCH_PERIOD * SAMPLES;
  const dt = 1 / (SAMPLES * SUB);
  const x = new Float64Array(PLAYERS);
  const v = new Float64Array(PLAYERS);
  const vx = new Float64Array(PLAYERS);
  const vv = new Float64Array(PLAYERS);
  const tx = new Float64Array(PLAYERS);
  const tv = new Float64Array(PLAYERS);
  const px = new Float64Array(PLAYERS);
  const pv = new Float64Array(PLAYERS);
  const pinned = new Uint8Array(PLAYERS);
  lineUpState(play.kickoff, x, v);
  scriptAt(play, 0, px, pv);
  const outX = new Float32Array((rows + 1) * PLAYERS);
  const outV = new Float32Array((rows + 1) * PLAYERS);
  for (let r = 0; r < rows; r++) {
    // a second of the play a slice
    if (r > 0 && r % SAMPLES === 0) yield;
    for (let p = 0; p < PLAYERS; p++) {
      outX[r * PLAYERS + p] = x[p];
      outV[r * PLAYERS + p] = v[p];
    }
    for (let k = 0; k < SUB; k++) {
      const lt = (r * SUB + k + 1) * dt;
      scriptAt(play, lt, tx, tv);
      for (let p = 0; p < PLAYERS; p++) {
        pinned[p] = onBeat(play, p, lt) ? 1 : 0;
        // keep up with where he means to be, and close the gap
        let wx = (tx[p] - px[p]) / dt + (tx[p] - x[p]) / CATCH;
        let wv = (tv[p] - pv[p]) / dt + (tv[p] - v[p]) / CATCH;
        const top = p === REFEREE ? REF_RUN : RUN;
        const want = Math.sqrt(wx * wx + wv * wv);
        if (want > top) {
          wx *= top / want;
          wv *= top / want;
        }
        // pick up or lose pace over a few strides
        let ax = wx - vx[p];
        let av = wv - vv[p];
        const a = Math.sqrt(ax * ax + av * av);
        if (a > PUSH * dt) {
          ax *= (PUSH * dt) / a;
          av *= (PUSH * dt) / a;
        }
        vx[p] += ax;
        vv[p] += av;
        x[p] += vx[p] * dt;
        v[p] += vv[p] * dt;
        px[p] = tx[p];
        pv[p] = tv[p];
      }
      // room: two players too close step apart (one on the ball keeps his line); in a
      // mirrored play in the order of the parts they play, so it plays out as written
      for (let a = 0; a < PLAYERS; a++) {
        const i = play.mirrored ? swap(a) : a;
        for (let b = a + 1; b < PLAYERS; b++) {
          const j = play.mirrored ? swap(b) : b;
          const ex = x[j] - x[i];
          if (ex >= ROOM_X || ex <= -ROOM_X) continue;
          const dx = ex / ROOM_X;
          const dv = (v[j] - v[i]) / ROOM_V;
          const d2 = dx * dx + dv * dv;
          if (d2 >= 1) continue;
          const d = Math.sqrt(d2);
          const ux = d > 1e-6 ? dx / d : a % 2 ? 1 : -1;
          const uv = d > 1e-6 ? dv / d : 0;
          const gap = 1 - d;
          const wi = pinned[i] === pinned[j] ? 0.5 : pinned[i] ? 0 : 1;
          const wj = 1 - wi;
          x[i] -= ux * gap * ROOM_X * wi;
          v[i] -= uv * gap * ROOM_V * wi;
          x[j] += ux * gap * ROOM_X * wj;
          v[j] += uv * gap * ROOM_V * wj;
        }
      }
    }
  }
  yield;
  // the play ends a hair from the next line-up: spread the difference over it
  const endX = new Float64Array(PLAYERS);
  const endV = new Float64Array(PLAYERS);
  lineUpState(play.scorer === 0 ? 1 : 0, endX, endV);
  for (let p = 0; p < PLAYERS; p++) {
    const ex = x[p] - endX[p];
    const ev = v[p] - endV[p];
    for (let r = 0; r < rows; r++) {
      outX[r * PLAYERS + p] -= (ex * r) / rows;
      outV[r * PLAYERS + p] -= (ev * r) / rows;
    }
    outX[rows * PLAYERS + p] = endX[p];
    outV[rows * PLAYERS + p] = endV[p];
  }
  // the ground each covers at a run, and his stride, so that the play holds whole pairs
  const d = new Float32Array((rows + 1) * PLAYERS);
  const strideOf = new Float32Array(PLAYERS);
  for (let p = 0; p < PLAYERS; p++) {
    let sum = 0;
    for (let r = 1; r <= rows; r++) {
      if (paceAt(outX, outV, r - 1, p, rows) >= STILL) {
        sum += Math.hypot(
          outX[r * PLAYERS + p] - outX[(r - 1) * PLAYERS + p],
          outV[r * PLAYERS + p] - outV[(r - 1) * PLAYERS + p],
        );
      }
      d[r * PLAYERS + p] = sum;
    }
    const pairs = Math.max(1, Math.round(sum / (2 * STRIDE)));
    strideOf[p] = sum > 0 ? sum / (2 * pairs) : STRIDE;
  }
  const table: Track = { x: outX, v: outV, d, stride: strideOf };
  play.table = table;
  play.making = null;
  return table;
}

/**
 * Player p's pace about row r: units a second, over a tenth of a second either side
 * (within the play: at its ends everybody is lined up and still).
 */
function paceAt(
  xs: Float32Array,
  vs: Float32Array,
  r: number,
  p: number,
  rows: number,
): number {
  const h = SAMPLES / 10;
  const a = Math.max(0, r - h);
  const b = Math.min(rows, r + h);
  if (b <= a) return 0;
  const span = (b - a) / SAMPLES;
  return (
    Math.hypot(
      xs[b * PLAYERS + p] - xs[a * PLAYERS + p],
      vs[b * PLAYERS + p] - vs[a * PLAYERS + p],
    ) / span
  );
}

const at = { X: 0, V: 0 };

/** Where player p has run to at play time t (0..PERIOD), into `at`. */
function trackedAt(tr: Track, p: number, t: number): void {
  const rows = MATCH_PERIOD * SAMPLES;
  const f = Math.max(0, Math.min(within(t) * SAMPLES, rows - 1e-6));
  const r = Math.floor(f);
  const u = f - r;
  const a = r * PLAYERS + p;
  const b = a + PLAYERS;
  at.X = tr.x[a] + (tr.x[b] - tr.x[a]) * u;
  at.V = tr.v[a] + (tr.v[b] - tr.v[a]) * u;
}

/** Where a beat's ball is at time t: at the feet of whoever has it, as he really runs. */
function beatBall(tr: Track, e: Beat, t: number): void {
  if (e.p < 0) {
    at.X = e.a[0];
    at.V = e.a[1];
  } else trackedAt(tr, e.p, t);
  at.X += stride(e);
}

/**
 * The ball as the script plays it (`ballAt`), but at the feet of the players where they
 * have really run to: a pass goes from where the passer is to where the taker is.
 */
function ballOnTrack(play: Play, tr: Track, t: number): void {
  const list = play.ball;
  const n = list.length;
  for (let i = 0; i < n; i++) {
    const e = list[i];
    if (t >= e.t0 && t <= e.t1) {
      beatBall(tr, e, t);
      spot.X = at.X;
      spot.V = at.V;
      spot.H = 0;
      return;
    }
    if (i + 1 < n && t > e.t1 && t < list[i + 1].t0) {
      const next = list[i + 1];
      const u = (t - e.t1) / (next.t0 - e.t1);
      beatBall(tr, e, e.t1);
      const fx = at.X;
      const fv = at.V;
      beatBall(tr, next, next.t0);
      spot.X = fx + (at.X - fx) * u;
      spot.V = fv + (at.V - fv) * u;
      spot.H = (next.loft ?? 0) * 4 * u * (1 - u);
      return;
    }
  }
  const e = t < list[0].t0 ? list[0] : list[n - 1];
  beatBall(tr, e, t);
  spot.X = at.X;
  spot.V = at.V;
  spot.H = 0;
}

/**
 * The whole match at time `time` (any number of seconds from the start; a play every
 * MATCH_PERIOD seconds, in `seed`'s order).
 */
export function matchAt(state: MatchState, time: number, seed = 0): MatchState {
  const T = Number.isFinite(time) && time > 0 ? time : 0;
  const k = Math.floor(T / MATCH_PERIOD);
  return fill(state, playOf(seed, k), T - k * MATCH_PERIOD);
}

/**
 * The runs of the play on at `time`, worked out a slice at a time (each `next()` a few
 * milliseconds) ahead of the first `matchAt` that needs them, which otherwise works them
 * out in one go: tens of milliseconds, once a play. `matchAt` gives the same either way.
 */
export function* matchSteps(
  time: number,
  seed = 0,
): Generator<void, void, void> {
  const T = Number.isFinite(time) && time > 0 ? time : 0;
  const play = playOf(seed, Math.floor(T / MATCH_PERIOD));
  if (play.table) return;
  play.making ??= trackSteps(play);
  const steps = play.making;
  while (!steps.next().done) yield;
}

/**
 * One play on its own, at play time `t` (0 to MATCH_PERIOD): the `i`th of those `side`
 * kicks off (`playsFor`), for the tests and the shots.
 */
export function playAt(
  state: MatchState,
  side: Side,
  i: number,
  t: number,
): MatchState {
  return fill(state, PLAYS[side][i], within(Number.isFinite(t) ? t : 0));
}

/** The plays `side` kicks off: their names, who scores, and when. */
export function playsFor(
  side: Side,
): readonly { name: string; scorer: Side; goal: number }[] {
  return PLAYS[side].map((p) => ({
    name: p.name,
    scorer: p.scorer,
    goal: p.goal,
  }));
}

function fill(state: MatchState, play: Play, t: number): MatchState {
  const tr = track(play);
  const rows = MATCH_PERIOD * SAMPLES;
  const f = Math.min(t * SAMPLES, rows - 1e-6);
  const r = Math.floor(f);
  const u = f - r;
  const near = u < 0.5 ? r : r + 1;
  for (let p = 0; p < PLAYERS; p++) {
    const a = r * PLAYERS + p;
    const b = a + PLAYERS;
    state.x[p] = tr.x[a] + (tr.x[b] - tr.x[a]) * u;
    state.v[p] = tr.v[a] + (tr.v[b] - tr.v[a]) * u;
    if (paceAt(tr.x, tr.v, near, p, rows) < STILL) state.stride[p] = -1;
    else {
      const d = tr.d[a] + (tr.d[b] - tr.d[a]) * u;
      state.stride[p] = Math.floor(d / tr.stride[p]) % 2;
    }
  }
  ballOnTrack(play, tr, t);
  state.ballX = spot.X;
  state.ballV = spot.V;
  state.ballH = spot.H;
  let cheer = 0;
  for (const [t0, len, size] of play.gasps) {
    if (t >= t0 && t < t0 + len)
      cheer = Math.max(cheer, size * (1 - (t - t0) / len));
  }
  for (const z of play.buzz) {
    if (t < z.until) cheer = Math.max(cheer, ramp(t, z.from, z.to) * z.size);
  }
  // an away goal: their end's cheer, not the whole ground's
  const g = play.goal;
  const loud = play.scorer === 0 ? 1 : 0.7;
  if (t >= g) cheer = Math.max(cheer, loud * (1 - ramp(t, g + 3.5, g + 8)));
  state.cheer = cheer;
  const scored = t >= g && t < g + 8;
  state.sinceGoal = scored ? t - g : -1;
  state.goalBy = scored ? play.scorer : -1;
  return state;
}
