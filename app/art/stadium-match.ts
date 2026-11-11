/**
 * The match on the pitch: forty seconds of play, as a script, looping.
 *
 * Positions are in map units on the pitch (X towards the east goal, V towards the far
 * touchline, the centre spot at the origin; the pitch is 68 by 44 either side of it).
 * The home side (players 0 to 10, in the club's warm red-orange) attacks east; the away
 * side (11 to 21, in teal) attacks west; player 22 is the referee. 0 and 11 keep goal.
 *
 * The passage of play:
 *
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
 *   40   the away side kicks off again: the same instant as 0
 *
 * Everybody not on the ball keeps their place in a 4-4-2 that slides with the play.
 * Everything is a pure function of the time, and the loop closes exactly.
 */

export const MATCH_PERIOD = 40;
/** When in the loop the home side scores. */
export const GOAL_AT = 26;
export const PLAYERS = 23;
export const REFEREE = 22;
/** Half the pitch, in units. */
const HALF_X = 68;
const HALF_V = 44;

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

/** Where everybody stands for the kick-off (the away side takes it). */
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

const H = (n: number): number => n;
const A = (n: number): number => 11 + n;

const SCRIPT: readonly Beat[] = [
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
  { p: H(9), t0: 28.7, t1: 30.4, a: [46, 27], b: [44, 30], run: true, tail: 8 },
  {
    p: H(10),
    t0: 29.1,
    t1: 30.4,
    a: [49, 26],
    b: [47, 29],
    run: true,
    tail: 8,
  },
  { p: H(7), t0: 29.5, t1: 30.4, a: [42, 25], b: [42, 28], run: true, tail: 8 },
  { p: H(8), t0: 29.1, t1: 30.4, a: [45, 33], b: [45, 32], run: true, tail: 8 },
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
];

/** The beats that move the ball, in order. */
const BALL: readonly Beat[] = SCRIPT.filter((b) => !b.run);
/** Each player's beats, in order. */
const OF: readonly (readonly Beat[])[] = Array.from(
  { length: PLAYERS },
  (_, p) =>
    SCRIPT.filter((b) => b.p === p)
      .slice()
      .sort((x, y) => x.t0 - y.t0),
);

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

function wrap(t: number): number {
  const m = t % MATCH_PERIOD;
  return m < 0 ? m + MATCH_PERIOD : m;
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
}

export function makeMatchState(): MatchState {
  return {
    x: new Float32Array(PLAYERS),
    v: new Float32Array(PLAYERS),
    ballX: 0,
    ballV: 0,
    ballH: 0,
    cheer: 0,
    sinceGoal: -1,
  };
}

const spot = { X: 0, V: 0, H: 0 };

/** The ball is a stride in front of whoever has it, the way they are playing. */
function stride(e: Beat): number {
  return e.p < 0 ? 0 : e.p < 11 ? 1.7 : -1.7;
}

/** Where the ball is on the ground at loop time `t` (0..PERIOD), and how high. */
function ballAt(t: number): void {
  const n = BALL.length;
  for (let i = 0; i < n; i++) {
    const e = BALL[i];
    if (t >= e.t0 && t <= e.t1) {
      const u = e.t1 <= e.t0 ? 0 : (t - e.t0) / (e.t1 - e.t0);
      spot.X = e.a[0] + (e.b[0] - e.a[0]) * u + stride(e);
      spot.V = e.a[1] + (e.b[1] - e.a[1]) * u;
      spot.H = 0;
      return;
    }
    const next = BALL[(i + 1) % n];
    const until = i + 1 < n ? next.t0 : next.t0 + MATCH_PERIOD;
    if (t > e.t1 && t < until) {
      const u = (t - e.t1) / (until - e.t1);
      const from = e.b[0] + stride(e);
      spot.X = from + (next.a[0] + stride(next) - from) * u;
      spot.V = e.b[1] + (next.a[1] - e.b[1]) * u;
      spot.H = (next.loft ?? 0) * 4 * u * (1 - u);
      return;
    }
  }
  spot.X = BALL[0].a[0] + stride(BALL[0]);
  spot.V = BALL[0].a[1];
  spot.H = 0;
}

/** 1 while a side is lined up for the kick-off, 0 in open play. */
function lineUp(team: number, t: number): number {
  return team === 0
    ? 1 - ramp(t, 0.5, 3.5) + ramp(t, 30.5, 38.5)
    : 1 - ramp(t, 0.5, 3) + ramp(t, 27, 36);
}

const place = { X: 0, V: 0 };

/** A player's place in the team's shape, with the ball at (bx, bv). */
function shapeAt(p: number, t: number, bx: number, bv: number): void {
  if (p === REFEREE) {
    place.X = bx * 0.6 - 5;
    place.V = bv * 0.4 + 10;
    return;
  }
  const team = p < 11 ? 0 : 1;
  const j = p % 11;
  const sign = team === 0 ? 1 : -1;
  const baseX = SHAPE[j][0] * sign;
  const baseV = SHAPE[j][1] * sign;
  const ko = lineUp(team, t);
  // jogging on the spot: whole cycles per loop, so the loop closes
  const idle = 1 - 0.8 * ko;
  const jx =
    Math.sin((TAU * (5 + (p % 4)) * t) / MATCH_PERIOD + p * 2.1) * 1.3 * idle;
  const jv =
    Math.cos((TAU * (4 + (p % 3)) * t) / MATCH_PERIOD + p * 1.7) * 1.1 * idle;
  const openX = baseX + FOLLOW[j] * bx + jx;
  const openV = baseV + (j === 0 ? 0.1 : 0.2) * (bv - baseV) + jv;
  place.X = openX + (KICKOFF[p][0] - openX) * ko;
  place.V = openV + (KICKOFF[p][1] - openV) * ko;
}

function playerAt(p: number, t: number, bx: number, bv: number): void {
  shapeAt(p, t, bx, bv);
  const list = OF[p];
  const n = list.length;
  if (n === 0) return;
  // the beat before (or at) t and the one after, round the loop
  let prev = list[n - 1];
  let prevEnd = prev.t1 - MATCH_PERIOD;
  let next = list[0];
  let nextStart = next.t0;
  let found = false;
  for (let i = 0; i < n; i++) {
    const e = list[i];
    if (t >= e.t0 && t <= e.t1) {
      const u = e.t1 <= e.t0 ? 0 : (t - e.t0) / (e.t1 - e.t0);
      place.X = e.a[0] + (e.b[0] - e.a[0]) * u;
      place.V = e.a[1] + (e.b[1] - e.a[1]) * u;
      return;
    }
    if (e.t1 < t) {
      prev = e;
      prevEnd = e.t1;
    } else if (!found) {
      next = e;
      nextStart = e.t0;
      found = true;
    }
  }
  if (!found) {
    next = list[0];
    nextStart = next.t0 + MATCH_PERIOD;
  }
  const gap = nextStart - prevEnd;
  const tail = prev.tail ?? TAIL;
  const lead = next.lead ?? LEAD;
  if (gap <= Math.max(DIRECT, tail + lead)) {
    const u = smooth((t - prevEnd) / gap);
    place.X = prev.b[0] + (next.a[0] - prev.b[0]) * u;
    place.V = prev.b[1] + (next.a[1] - prev.b[1]) * u;
    return;
  }
  const out = 1 - (t - prevEnd) / tail;
  const into = 1 - (nextStart - t) / lead;
  if (out > 0) {
    const w = smooth(out);
    place.X += (prev.b[0] - place.X) * w;
    place.V += (prev.b[1] - place.V) * w;
  } else if (into > 0) {
    const w = smooth(into);
    place.X += (next.a[0] - place.X) * w;
    place.V += (next.a[1] - place.V) * w;
  }
}

/** The whole match at time `t` (any number: it loops every MATCH_PERIOD seconds). */
export function matchAt(state: MatchState, time: number): MatchState {
  const t = wrap(Number.isFinite(time) ? time : 0);
  ballAt(t);
  const bx = spot.X;
  const bv = spot.V;
  const bh = spot.H;
  // the shape follows where the ball was a moment ago, so a long pass does not jerk it
  ballAt(wrap(t - 0.9));
  const sx = (bx + spot.X) / 2;
  const sv = (bv + spot.V) / 2;
  // the referee trails the play: where the ball has been over the last four seconds
  let rx = 0;
  let rv = 0;
  for (let i = 0; i < 4; i++) {
    ballAt(wrap(t - 0.5 - i));
    rx += spot.X / 4;
    rv += spot.V / 4;
  }
  for (let p = 0; p < PLAYERS; p++) {
    if (p === REFEREE) playerAt(p, t, rx, rv);
    else playerAt(p, t, sx, sv);
    state.x[p] = Math.max(-HALF_X - 3, Math.min(HALF_X + 3, place.X));
    state.v[p] = Math.max(-HALF_V + 1, Math.min(HALF_V - 1, place.V));
  }
  state.ballX = bx;
  state.ballV = bv;
  state.ballH = bh;
  const gasp = t >= 14.95 && t < 16.6 ? 0.42 * (1 - (t - 14.95) / 1.65) : 0;
  const buzz = Math.max(
    ramp(t, 12.6, 14.6) * (t < 14.95 ? 0.14 : 0),
    ramp(t, 24.4, 26) * (t < 26 ? 0.16 : 0),
  );
  const goal = t >= GOAL_AT ? 1 - ramp(t, 29.5, 34) : 0;
  state.cheer = Math.max(gasp, buzz, goal);
  state.sinceGoal = t >= GOAL_AT && t < 34 ? t - GOAL_AT : -1;
  return state;
}
