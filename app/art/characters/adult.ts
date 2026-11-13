/**
 * The adult footballer (docs/ART_BIBLE.md 5): the moves, 24 x 36 in a 32 x 40 cell,
 * facing right. The shots are in `adult-shots.ts`.
 *
 * Fill only (`figure()` adds the 1 px ink outline), in the legend `LEGEND` (figure.ts).
 *
 * Anchor: column 16 is the ground point's x (the cell's left edge is x - 16); the boots'
 * soles are row 38 and their outline row 39 is the ground row y - 1. A flipped spot is
 * `-dx` (people.ts).
 *
 * The heads are drawn here by hand (five of them: side, down, up, shouting, bowed), and
 * every frame of every move is painted on the shots' rig (`paintPose`, adult-shots.ts):
 * the same head, shirt, shorts, limbs and hands as the shots, so the man who runs up is the
 * man who shoots. The near side of him (his right) is in full colour, the far arm and leg
 * in shade; the light comes from the top left.
 */

import { type ArtRecord, frames, rows } from "./figure";
import { type Arm, type Leg, type Pose, paintPose } from "./adult-shots";
import type { PlayerAnim, ShotAnim } from "./people";

// ---------------------------------------------------------------------------
// Parts
// ---------------------------------------------------------------------------

const HEAD = rows(`
...hhhhhhh....
.hhhHHHhhhhh..
hhHHhhhhhhhhh.
hHhhhhhhhhhhh.
hhhhhhhhhhsss.
hhhhhhhhlssss.
hhhhhhhsmmmss.
hhhhhhSSsskss.
hhhhhhSmssksss
hhhhhhSSssssss
.hhhhhSsssmms.
..hhhSSssss...
.....SSsss....
`);

/** Looking down at the ball at his feet. */
const HEAD_DOWN = rows(`
...hhhhhhhh...
.hhhHHHhhhhhh.
hhHHhhhhhhhhhh
hHhhhhhhhhhhhh
hhhhhhhhhhhhs.
hhhhhhhhhlsss.
hhhhhhhhmmmss.
hhhhhhSSsskss.
hhhhhhSmssksss
hhhhhhSSsssssS
.hhhhhSsssmss.
..hhhSSsssS...
.....SSsss....
`);

/** Looking up at the ball over his head. */
const HEAD_UP = rows(`
...hhhhhhhh.....
.hhhHHHhhhhhs...
hhHHhhhhhhsss...
hHhhhhhhhsmmms..
hhhhhhhhhsskss..
hhhhhhhSslskss..
hhhhhhSmssssssss
hhhhhhSSsssssss.
.hhhhhSSsssmmm..
..hhhhSSSssss...
....hhSSSss.....
.....SSsss......
.....SSss.......
`);

/** Shouting, eyes screwed up (the celebration). */
const HEAD_SHOUT = rows(`
...hhhhhhh....
.hhhHHHhhhhh..
hhHHhhhhhhhhh.
hHhhhhhhhhhhh.
hhhhhhhhhhsss.
hhhhhhhhlssss.
hhhhhhhsmmmss.
hhhhhhSSsskks.
hhhhhhSmssssss
hhhhhhSSsssmss
.hhhhhSsssmkk.
..hhhSSsssmm..
.....SSsss....
`);

/** Bowed: the crown to us, the face low and turned to the ground (dejected). */
const HEAD_BOWED = rows(`
....hhhhhhh....
..hhhHHHhhhh...
.hhHHhhhhhhhh..
hhHhhhhhhhhhhh.
hhhhhhhhhhhhhh.
hhhhhhhhhhhhhh.
hhhhhhhhhhhsss.
hhhhhhhhhsmmss.
.hhhhhSSssskks.
..hhhhSmsssssss
...hhhSSssssss.
.....SSssmmm...
.....SSsss.....
`);

// ---------------------------------------------------------------------------
// The moves painted on the shots' rig (adult-shots.ts): the same shirt, shorts, limbs
// and hands as the shots, with the arms at their full length (`reach: 1`). Joints are
// cell coordinates (column, row), facing right; soles on row 38 (the boot's lowest fill).
// ---------------------------------------------------------------------------

type Pt = readonly [number, number];
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
const rig = (poses: readonly Pose[]): string =>
  frames(poses.map((p) => paintPose({ reach: 1, ...p })));

/**
 * Run: two contacts (a long stride, the front heel down, the back foot on its toes, the
 * arms swinging opposite the legs with bent elbows) and two passing frames (up on one
 * straight leg, the other folded under him, the arms passing his sides).
 */
const RUN_POSES: readonly Pose[] = [
  {
    neck: [17, 19],
    waist: [15.5, 27],
    head: "side",
    near: L([17, 29], [21, 32], [23.5, 35.5], [22.5, 37.5], [26, 36.5]),
    far: L([14, 29], [11, 32.5], [7.5, 35], [6, 35.5], [8.5, 37.5]),
    nearArm: A([12.5, 20.5], [9.5, 23], [7.5, 20.5]),
    farArm: A([20, 20.5], [22.5, 23.5], [25, 21.5]),
  },
  {
    neck: [16.5, 17],
    waist: [15.5, 25],
    head: "side",
    near: L([16.5, 27], [17, 31.5], [16.5, 35.5], [14.5, 37.5], [18.5, 37.5]),
    far: L([14.5, 27], [16.5, 30.5], [12, 32], [11, 31], [9, 33.5]),
    nearArm: A([13, 18.5], [12, 22], [14.5, 24]),
    farArm: A([19.5, 18.5], [19, 22], [21.5, 23]),
  },
  {
    neck: [17, 19],
    waist: [15.5, 27],
    head: "side",
    near: L([14, 29], [11, 32.5], [7.5, 35], [6, 35.5], [8.5, 37.5]),
    far: L([17, 29], [21, 32], [23.5, 35.5], [22.5, 37.5], [26, 36.5]),
    nearArm: A([20, 20.5], [22.5, 23.5], [25, 21.5]),
    farArm: A([12.5, 20.5], [9.5, 23], [7.5, 20.5]),
  },
  {
    neck: [16.5, 17],
    waist: [15.5, 25],
    head: "side",
    near: L([16.5, 27], [18, 30.5], [13, 32], [12, 31], [10, 33.5]),
    far: L([14.5, 27], [16, 31.5], [16, 35.5], [14, 37.5], [18, 37.5]),
    nearArm: A([19.5, 18.5], [19, 22], [21.5, 23]),
    farArm: A([13, 18.5], [12, 22], [14.5, 24]),
  },
];

/**
 * The miss (and the skipped pass): the plant beside the ball, the near leg wound up
 * behind, the toe through the ball (**strike, frame 2**, the ball at (14, -4)), the
 * follow-through high, the landing.
 */
const KICK_POSES: readonly Pose[] = [
  {
    neck: [14.5, 19],
    waist: [14, 27],
    head: "down",
    far: L([15.5, 29], [18, 32.5], [19, 36], [18, 37.5], [22, 37.5]),
    near: L([12.5, 29], [9, 32], [6, 35.5], [4.5, 36], [7, 37.5]),
    nearArm: A([12, 20.5], [9, 23], [7, 24]),
    farArm: A([18.5, 20.5], [21.5, 21.5], [24, 20.5]),
  },
  {
    neck: [14, 19],
    waist: [14, 27],
    head: "down",
    far: L([15.5, 29], [18, 32.5], [19, 36], [18, 37.5], [22, 37.5]),
    near: L([12.5, 29], [9, 31.5], [5.5, 28], [5.5, 27.5], [3.5, 25]),
    nearArm: A([12, 20.5], [9, 22.5], [7.5, 24.5]),
    farArm: A([18.5, 20.5], [22, 19.5], [25, 17.5]),
  },
  {
    neck: [16.5, 20],
    waist: [14.5, 28],
    head: "down",
    far: L([13.5, 30], [14, 33], [14, 36], [12, 37.5], [16, 37.5]),
    near: L([16.5, 30], [20.5, 31.5], [23.5, 34], [23.5, 34.5], [27, 36]),
    nearArm: A([12.5, 21.5], [8.5, 21], [5.5, 20]),
    farArm: A([20, 21.5], [22.5, 24], [24.5, 25]),
  },
  {
    neck: [13.5, 17],
    waist: [14, 25],
    head: "side",
    far: L([13, 27], [12.5, 31], [12, 35], [10, 37.5], [14, 37.5]),
    near: L([16, 27], [20.5, 24.5], [24.5, 21], [25.5, 20], [28, 17]),
    nearArm: A([11, 18.5], [7.5, 19.5], [4.5, 17.5]),
    farArm: A([18.5, 18.5], [21, 20.5], [22.5, 22.5]),
  },
  {
    neck: [15.5, 19],
    waist: [15, 27],
    head: "side",
    far: L([13, 29], [10.5, 32], [7.5, 35], [6, 35.5], [8.5, 37.5]),
    near: L([17.5, 29], [20.5, 32], [22, 35.5], [21, 37.5], [25, 37.5]),
    nearArm: A([11.5, 20.5], [8.5, 22.5], [7, 24.5]),
    farArm: A([19.5, 20.5], [22, 22.5], [24, 22]),
  },
];

/**
 * Celebrate: the crouch before the jump (knees bent over the toes, leaning in, both fists
 * pulled down: "yes!"), in the air with both fists punched up and the heels kicked up
 * behind (the boots 6 rows up), landed with the arms still up. The shouting head.
 */
const CELEBRATE_POSES: readonly Pose[] = [
  {
    neck: [18, 22.5],
    waist: [15, 30],
    head: "shout",
    near: L([17, 31.5], [21.5, 33], [20, 36], [19, 37.5], [23, 37.5]),
    far: L([13, 31.5], [16, 33.5], [12.5, 36], [10.5, 37.5], [14.5, 37.5]),
    nearArm: A([14, 24], [10.5, 26.5], [7.5, 27.5]),
    farArm: A([19, 24], [15.5, 26.5], [12, 27]),
  },
  {
    neck: [15.5, 15],
    waist: [15.5, 23],
    head: "shout",
    near: L([17.5, 25], [20.5, 28.5], [17, 30], [16, 29.5], [14, 31.5]),
    far: L([14, 25], [15, 28.5], [10.5, 29.5], [9.5, 28.5], [7.5, 30.5]),
    nearArm: A([19.5, 16.5], [24.5, 12.5], [26.5, 6]),
    farArm: A([11.5, 16.5], [8.5, 11], [6, 5]),
  },
  {
    neck: [15.5, 18],
    waist: [15.5, 26],
    head: "shout",
    near: L([18, 28], [19.5, 32], [20, 35.5], [19, 37.5], [23, 37.5]),
    far: L([13, 28], [12, 32], [11.5, 35.5], [10, 37.5], [14, 37.5]),
    nearArm: A([19.5, 19.5], [24.5, 15.5], [26.5, 9]),
    farArm: A([11.5, 19.5], [8.5, 14], [6, 8]),
  },
];

/**
 * Dejected: the head bowed, hands on his hips, elbows out; the second frame sags a row
 * (a long breath out).
 */
const DEJECTED_POSES: readonly Pose[] = [0, 1].map((d): Pose => ({
  neck: [15.5, 20 + d],
  waist: [15, 27.5 + d],
  head: "bowed",
  headAt: [10, 8 + d],
  near: L(
    [17.5, 29.5 + d],
    [18, 33 + d * 0.5],
    [18, 36],
    [17, 37.5],
    [21, 37.5],
  ),
  far: L(
    [12.5, 29.5 + d],
    [12, 33 + d * 0.5],
    [12, 36],
    [10.5, 37.5],
    [14.5, 37.5],
  ),
  nearArm: A([19, 21.5 + d], [22.5, 24.5 + d], [19.5, 27.5 + d]),
  farArm: A([11.5, 21.5 + d], [8, 24.5 + d], [11, 27.5 + d]),
}));

/** Lift: the trophy held up on his hands (its foot on their top row), the head back. */
const LIFT_POSES: readonly Pose[] = [
  {
    neck: [16, 19],
    waist: [15.5, 26.5],
    head: "up",
    headAt: [7, 6],
    near: L([18, 28.5], [19, 32], [19, 35.5], [18, 37.5], [22, 37.5]),
    far: L([13, 28.5], [12.5, 32], [12.5, 35.5], [11, 37.5], [15, 37.5]),
    nearArm: A([19.5, 20.5], [23.5, 14], [22.5, 5.5]),
    farArm: A([12, 20.5], [4.5, 15], [9.5, 5.5]),
  },
  {
    neck: [16, 17],
    waist: [15.5, 24.5],
    head: "up",
    headAt: [7, 4],
    near: L([18, 26.5], [19, 30.5], [19, 34.5], [18.5, 36], [21, 37.5]),
    far: L([13, 26.5], [12.5, 30.5], [12.5, 34.5], [12, 36], [14.5, 37.5]),
    nearArm: A([19.5, 18.5], [23.5, 12], [22.5, 3.5]),
    farArm: A([12, 18.5], [4.5, 13], [9.5, 3.5]),
  },
];

/** Shrug: shoulders up, both palms up and out; then the arms drop, palms still out. */
const SHRUG_POSES: readonly Pose[] = [
  {
    neck: [15.5, 19],
    waist: [15.5, 26],
    head: "side",
    headAt: [10, 7],
    near: L([18, 28], [19, 32], [19, 35.5], [18, 37.5], [22, 37.5]),
    far: L([13, 28], [12.5, 32], [12.5, 35.5], [11, 37.5], [15, 37.5]),
    nearArm: A([19.5, 19.5], [21, 24], [25.5, 22.5]),
    farArm: A([11.5, 19.5], [9, 24], [5, 22.5]),
  },
  {
    neck: [15.5, 18],
    waist: [15.5, 26],
    head: "side",
    near: L([18, 28], [19, 32], [19, 35.5], [18, 37.5], [22, 37.5]),
    far: L([13, 28], [12.5, 32], [12.5, 35.5], [11, 37.5], [15, 37.5]),
    nearArm: A([19.5, 20], [21, 24], [23.5, 27.5]),
    farArm: A([11.5, 20], [9.5, 24], [7, 27.5]),
  },
];

/**
 * The knee slide: on his knees, the shins flat on the grass behind him. Arms flung wide
 * at the sky, shouting up at it; then both fists pumped down, leaning in, roaring.
 */
const SLIDE_POSES: readonly Pose[] = [
  {
    neck: [14.5, 22],
    waist: [15.5, 29.5],
    head: "up",
    near: L([17.5, 31], [20, 36.5], [14, 37], [12.5, 36.5], [9, 37.5]),
    far: L([14, 31], [17, 36.5], [11, 37], [9.5, 36.5], [6, 37.5]),
    nearArm: A([18.5, 23.5], [23, 21], [27, 16.5]),
    farArm: A([10.5, 23.5], [6.5, 20.5], [4, 16]),
  },
  {
    neck: [16.5, 23],
    waist: [15.5, 30.5],
    head: "shout",
    near: L([17.5, 32], [20, 36.5], [14, 37], [12.5, 36.5], [9, 37.5]),
    far: L([14, 32], [17, 36.5], [11, 37], [9.5, 36.5], [6, 37.5]),
    nearArm: A([20.5, 24.5], [23, 28.5], [24.5, 24.5]),
    farArm: A([12, 24.5], [8.5, 27.5], [7.5, 23.5]),
  },
];

/** Standing: the feet apart, arms hanging; the second frame breathes out (a row lower). */
const IDLE_POSES: readonly Pose[] = [0, 1].map((d): Pose => ({
  neck: [15.5, 18 + d],
  waist: [15.5, 26 + d * 0.5],
  head: "side",
  near: L([18, 28], [19, 32], [19, 35.5], [18, 37.5], [22, 37.5]),
  far: L([13, 28], [12.5, 32], [12.5, 35.5], [11, 37.5], [15, 37.5]),
  nearArm: A([19.5, 19.5 + d], [20.5, 23.5 + d], [20.5, 27 + d]),
  farArm: A([11.5, 19.5 + d], [10.5, 23.5 + d], [10.5, 27 + d]),
}));

// The juggle's standing legs and the arms out for balance (the near arm back, the far one
// forward), `d` rows lower.
const STAND = (d: number) => ({
  near: L([18, 28 + d], [19, 32], [19, 35.5], [18, 37.5], [22, 37.5]),
  far: L([13, 28 + d], [12.5, 32], [12.5, 35.5], [11, 37.5], [15, 37.5]),
  nearArm: A([12, 19.5 + d], [8.5, 21.5 + d], [5.5, 21 + d]),
  farArm: A([19, 19.5 + d], [22, 21.5 + d], [24.5, 20.5 + d]),
});

/** The near foot up under the ball (its centre at (8, -13)), on the far leg. */
const JUGGLE_FOOT: Pose = {
  neck: [15, 18],
  waist: [15, 26],
  head: "down",
  near: L([17.5, 28], [20.5, 28.5], [22, 30], [21, 30.5], [26, 30.5]),
  far: L([13.5, 28], [13.5, 32], [13.5, 35.5], [12, 37.5], [16, 37.5]),
  nearArm: A([12, 19.5], [8.5, 21.5], [5.5, 21]),
  farArm: A([18.5, 19.5], [21, 22], [23, 21.5]),
};

/**
 * Juggle: touches on frames 0, 2, 4 and 6 (foot, knee, foot, head) and the ball in the air
 * between (its spots in people.ts), the arms out for balance.
 */
const JUGGLE_POSES: readonly Pose[] = [
  JUGGLE_FOOT,
  { neck: [15.5, 18], waist: [15.5, 26], head: "side", ...STAND(0) },
  // the knee under it (its centre at (8, -18)), crouched on the standing leg
  {
    neck: [15, 20],
    waist: [15, 27.5],
    head: "down",
    near: L([17.5, 29], [23, 25.5], [22.5, 31], [21, 32.5], [25, 32.5]),
    far: L([13.5, 29.5], [15, 33], [14, 36], [12.5, 37.5], [16.5, 37.5]),
    nearArm: A([12, 21.5], [8.5, 23.5], [5.5, 23]),
    farArm: A([18.5, 21.5], [20, 25], [21.5, 27.5]),
  },
  { neck: [15.5, 18], waist: [15.5, 26], head: "side", ...STAND(0) },
  JUGGLE_FOOT,
  // looking up as it climbs
  { neck: [15.5, 18], waist: [15.5, 26], head: "up", ...STAND(0) },
  // up on his toes for the header (the ball's centre at (2, -39))
  {
    neck: [15.5, 17],
    waist: [15.5, 25],
    head: "up",
    headAt: [10, 4],
    near: L([18, 27], [19, 31], [19, 34.5], [18.5, 36], [21, 37.5]),
    far: L([13, 27], [12.5, 31], [12.5, 34.5], [12, 36], [14.5, 37.5]),
    nearArm: A([12, 18.5], [8.5, 20], [5.5, 19]),
    farArm: A([19, 18.5], [22, 20], [24.5, 19]),
  },
  { neck: [15.5, 18], waist: [15.5, 26], head: "side", ...STAND(0) },
];

// ---------------------------------------------------------------------------
// The moves
// ---------------------------------------------------------------------------

/** The moves' poses (the youth's moves, youth.ts, are these at his size). */
export type MoveAnim = Exclude<PlayerAnim, ShotAnim> | "kick";

export const ADULT_MOVE_POSES: Readonly<Record<MoveAnim, readonly Pose[]>> = {
  idle: IDLE_POSES,
  run: RUN_POSES,
  kick: KICK_POSES,
  juggle: JUGGLE_POSES,
  celebrate: CELEBRATE_POSES,
  dejected: DEJECTED_POSES,
  lift: LIFT_POSES,
  shrug: SHRUG_POSES,
  slide: SLIDE_POSES,
};

/** Each move painted on first use. */
export const ADULT: ArtRecord<PlayerAnim> = Object.fromEntries(
  (Object.keys(ADULT_MOVE_POSES) as MoveAnim[]).map((anim) => [
    anim,
    () => rig(ADULT_MOVE_POSES[anim]),
  ]),
);

/** The parts every adult frame is built from, for the shots to share. */
export const PARTS = {
  HEAD,
  HEAD_DOWN,
  HEAD_UP,
  HEAD_SHOUT,
  HEAD_BOWED,
} as const;
