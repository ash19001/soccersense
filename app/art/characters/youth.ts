/**
 * The youth footballer (tiers 0 and 1, docs/ART_BIBLE.md 5): the moves, 20 x 28 in a
 * 28 x 32 cell, facing right. The shots are in `youth-shots.ts`, the spots in
 * `people.ts`.
 *
 * Fill only (`figure()` adds the 1 px ink outline), in the legend `LEGEND` (figure.ts),
 * the same as the adult's (adult.ts).
 *
 * Anchor: column 14 is the ground point's x (the cell's left edge is x - 14); the boots'
 * soles are row 30 and their outline row 31 is the ground row y - 1.
 *
 * The heads are drawn here, and every move is the adult's pose (adult.ts) at his size,
 * painted on his shots' rig
 * (`paintYouthPose`, youth-shots.ts), so moves and shots share one shirt, limbs and
 * fists: a bigger head for his body (11 rows of 26), a short shirt, short legs. The fists
 * are in the glove letters (`g`, `G`) but on a few frames (`BARE`), so the child keeper
 * of tiers 0 and 1 wears his gloves through that slot (in every other kit the glove slot
 * is the bare hand). The near side of him (his right) is in full colour, the far
 * arm and leg in shade; light from the top left.
 */

import { ADULT_MOVE_POSES, type MoveAnim } from "./adult";
import type { Arm, Leg, Pose } from "./adult-shots";
import { type ArtRecord, frames, rows } from "./figure";
import type { PlayerAnim } from "./people";
import {
  type YouthArm,
  type YouthLeg,
  type YouthPose,
  paintYouthPose,
} from "./youth-shots";

// ---------------------------------------------------------------------------
// Heads: 13 or 14 wide, 11 rows (hair top on part row 0, the neck on row 10), face to
// the right. In the standing frames `HEAD` sits at cell (8, 5).
// ---------------------------------------------------------------------------

const HEAD = rows(`
...hhhhhh....
.hhHHHhhhhh..
hHHhhhhhhhhh.
hhhhhhhhhhss.
hhhhhhhhlsss.
hhhhhhhssmms.
hhhhhhSSssks.
hhhhhhSmsskss
.hhhhhSSssss.
..hhhhSssmms.
....hSSsss...
`);

/** Looking down at the ball at his feet. */
const HEAD_DOWN = rows(`
...hhhhhhh...
.hhHHHhhhhhh.
hHHhhhhhhhhhh
hhhhhhhhhhhs.
hhhhhhhhhlss.
hhhhhhhhsmms.
hhhhhhSSssks.
hhhhhhSmssksS
.hhhhhSSsssS.
..hhhSSssms..
....hSSss....
`);

/** Looking up at the ball over his head. */
const HEAD_UP = rows(`
...hhhhhhh....
.hhHHHhhhhs...
hHHhhhhhhsss..
hhhhhhhhsmms..
hhhhhhSSsskss.
hhhhhhSmssksss
hhhhhhSSssssss
.hhhhhSSssmmm.
..hhhhSSssss..
....hhSSss....
.....SSss.....
`);

/** Shouting, eyes screwed up (the celebration). */
const HEAD_SHOUT = rows(`
...hhhhhh....
.hhHHHhhhhh..
hHHhhhhhhhhh.
hhhhhhhhhhss.
hhhhhhhhlsss.
hhhhhhhssmms.
hhhhhhSSskks.
hhhhhhSmsssss
.hhhhhSSssmk.
..hhhhSssmkk.
....hSSssmm..
`);

/** Bowed: the crown to us, the face low and turned to the ground (dejected). */
const HEAD_BOWED = rows(`
....hhhhhh....
..hhHHHhhhh...
.hHHhhhhhhhh..
hhHhhhhhhhhhh.
hhhhhhhhhhhhh.
hhhhhhhhhhhhh.
hhhhhhhhhhsss.
.hhhhhSShsmms.
..hhhhSmsskks.
...hhhSSsssS..
.....SSsmm....
`);

// ---------------------------------------------------------------------------
// The moves: the adult's (adult.ts, painted on the rig) at the boy's size
// ---------------------------------------------------------------------------

type Pt = readonly [number, number];

// The adult's cell (32 x 40, anchor column 16, soles row 38) to the boy's (28 x 32,
// anchor column 14, soles row 30): a little narrower, and 0.7 of the height from the soles,
// as his shots are traced from the adult's.
const mx = (x: number): number => 14 + (x - 16) * 0.8;
const my = (y: number): number => 30 - (38 - y) * 0.7;
const pt = ([x, y]: Pt): Pt => [mx(x), my(y)];

/** An adult pose at the boy's size: his heads, his rig. */
function boy(a: Pose, tweak?: Partial<YouthPose>): YouthPose {
  const leg = (l: Leg): YouthLeg => ({
    hip: pt(l.hip),
    knee: pt(l.knee),
    ankle: pt(l.ankle),
    heel: pt(l.heel),
    toe: pt(l.toe),
  });
  const arm = (r: Arm): YouthArm => ({
    shoulder: pt(r.shoulder),
    elbow: pt(r.elbow),
    hand: pt(r.hand),
  });
  // a head the adult moved off its place over the neck moves as far, at his size
  const headAt: Pt | undefined =
    a.headAt === undefined
      ? undefined
      : [
          Math.floor(mx(a.neck[0])) -
            5 +
            Math.round((a.headAt[0] - (Math.floor(a.neck[0]) - 5)) * 0.8),
          Math.round(my(a.neck[1])) -
            11 +
            Math.round((a.headAt[1] - (Math.round(a.neck[1]) - 13)) * 0.7),
        ];
  return {
    neck: pt(a.neck),
    waist: pt(a.waist),
    head: a.head as YouthPose["head"],
    headAt,
    near: leg(a.near),
    far: leg(a.far),
    nearArm: arm(a.nearArm),
    farArm: arm(a.farArm),
    reach: 1,
    ...tweak,
  };
}

const L = (hip: Pt, knee: Pt, ankle: Pt, heel: Pt, toe: Pt): YouthLeg => ({
  hip,
  knee,
  ankle,
  heel,
  toe,
});

/**
 * The boy's poses, move by move: the adult's at his size, with the touches put back on
 * the ball where his shorter legs would miss it (the kick's strike, the juggle's foot and
 * knee).
 */
function poses(anim: MoveAnim): readonly YouthPose[] {
  const adult = ADULT_MOVE_POSES[anim];
  if (anim === "kick") {
    return adult.map((a, f) =>
      f === 2
        ? boy(a, {
            near: L([14, 24], [17.5, 25], [20, 27], [20, 27.5], [23.5, 28.5]),
          })
        : boy(a),
    );
  }
  if (anim === "juggle") {
    return adult.map((a, f) =>
      f === 0 || f === 4
        ? boy(a, {
            near: L(
              [15.5, 23],
              [18, 23],
              [20.5, 25.5],
              [19.5, 26.5],
              [24.5, 26],
            ),
            farArm: {
              shoulder: [16, 17.5],
              elbow: [15, 20.5],
              hand: [16.5, 22.5],
            },
          })
        : f === 2
          ? boy(a, {
              near: L(
                [15.5, 23.5],
                [20.5, 21.5],
                [20.5, 25.5],
                [19.5, 26.5],
                [23, 26.5],
              ),
            })
          : boy(a),
    );
  }
  if (anim === "celebrate") {
    // the fists punched up over his head, wide of his face
    return adult.map((a, f) => {
      const b = boy(a);
      if (f === 0) return b;
      const d = f === 1 ? 0 : 2;
      return {
        ...b,
        nearArm: {
          shoulder: b.nearArm.shoulder,
          elbow: [21.5, 11 + d],
          hand: [22.5, 4.5 + d],
        },
        farArm: {
          shoulder: b.farArm.shoulder,
          elbow: [7, 11 + d],
          hand: [5.5, 4.5 + d],
        },
      };
    });
  }
  if (anim === "lift") {
    // his arms are short for his head: the fists go right up, clear of his hair
    return adult.map((a, f) => {
      const b = boy(a);
      const up = f;
      return {
        ...b,
        nearArm: {
          shoulder: b.nearArm.shoulder,
          elbow: [21, 12 - up],
          hand: [20, 4 - up],
        },
        farArm: {
          shoulder: b.farArm.shoulder,
          elbow: [5.5, 13 - up],
          hand: [9, 4 - up],
        },
      };
    });
  }
  return adult.map((a) => boy(a));
}

/**
 * The frames whose hands are bare even on the child keeper (the glove letters are left
 * out); on every other frame his fists are in the glove letters, so he wears his gloves
 * there (in every other kit the glove letters are bare hands). The same frames as the boy
 * of the first art (a 10 x 14 sprite) had.
 */
const BARE: Readonly<Partial<Record<MoveAnim, readonly number[]>>> = {
  kick: [0, 1, 2, 3, 4],
  juggle: [2],
  lift: [0, 1],
  slide: [0, 1],
};

function gloved(anim: MoveAnim, f: number): boolean {
  return BARE[anim]?.includes(f) !== true;
}

const move = (anim: MoveAnim) => (): string =>
  frames(
    poses(anim).map((p, f) =>
      paintYouthPose({ ...p, gloves: gloved(anim, f) }),
    ),
  );

export const YOUTH: ArtRecord<PlayerAnim> = Object.fromEntries(
  (Object.keys(ADULT_MOVE_POSES) as MoveAnim[]).map((anim) => [
    anim,
    move(anim),
  ]),
);

/** The boy's heads, for his shots (youth-shots.ts) to share. */
export const YOUTH_PARTS = {
  HEAD,
  HEAD_DOWN,
  HEAD_UP,
  HEAD_SHOUT,
  HEAD_BOWED,
} as const;
