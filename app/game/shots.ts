/**
 * The six shots an answer can be, what each is worth, and the rule that files answers under
 * them. Every answer in a question's list is one of the six (stored in the data as
 * `Answer.shot`, for the question's own mode); a player's points are their answer's shot.
 * See docs/GAME_DESIGN.md section 4 and docs/data-notes/shots.md.
 */
import type { Grade, Rule, Shot } from "./types";

/** The six shots, best first. */
export const SHOT_ORDER: readonly Shot[] = [
  "worldie",
  "golazo",
  "trivela",
  "toepoke",
  "tapin",
  "miss",
];

/** The points each grade is worth: the six shots, and 0 for no answer. */
export const SHOT_POINTS: Readonly<Record<Grade, number>> = {
  worldie: 100,
  golazo: 80,
  trivela: 60,
  toepoke: 30,
  tapin: 10,
  miss: 0,
  timeup: 0,
  skipped: 0,
};

/** Whether a grade is one of the six shots (not "timeup" or "skipped"). */
export function isShot(grade: Grade): grade is Shot {
  return grade !== "timeup" && grade !== "skipped";
}

/** Whether a grade is a goal: every shot but a miss. */
export function isGoal(grade: Grade): boolean {
  return isShot(grade) && grade !== "miss";
}

/** 0 for the best shot (a worldie) to 5 for a miss; 6 for no answer. */
export function shotIndex(grade: Grade): number {
  return isShot(grade) ? SHOT_ORDER.indexOf(grade) : SHOT_ORDER.length;
}

/**
 * The bands of standing (0 best, 1 worst; see `standings`) each shot covers, best first:
 * a standing up to `upTo` and above the band before.
 */
export const SHOT_BANDS: readonly { shot: Shot; upTo: number }[] = [
  { shot: "worldie", upTo: 0.1 },
  { shot: "golazo", upTo: 0.25 },
  { shot: "trivela", upTo: 0.42 },
  { shot: "toepoke", upTo: 0.58 },
  { shot: "tapin", upTo: 0.8 },
  { shot: "miss", upTo: 1 },
];

/** The shot for a standing from 0 (the best answer) to 1 (the worst). */
export function shotForStanding(standing: number): Shot {
  for (const band of SHOT_BANDS) {
    if (standing <= band.upTo + 1e-9) return band.shot;
  }
  return "miss";
}

/** Whether a higher value is better under the rule. */
function higherIsBetter(rule: Rule): boolean {
  return rule === "common" || rule === "furthest" || rule === "newest";
}

/**
 * Where each answer stands in its question, from 0 (the best) to 1 (the worst), under a rule:
 * the mean of two things, so that both the order and the size of the gaps count.
 *
 * - **Place**: of the answers that are not tied with it, the share that are better: 0 for
 *   the best, 1 for the worst (`better / (better + worse)`, as a league table counts).
 * - **Gap**: how far the answer is from the best, as a fraction of the way to the worst. For
 *   `common` and `niche` the gap is measured in ratios of shares, on a log scale, so that 30%
 *   against 15% is as far apart as 2% against 1%. For `oldest` and `newest` it is measured
 *   in years, for `closest` and `furthest` in kilometres.
 *
 * `values` are, per answer: its share of players in percent for `common` and `niche` (shares
 * tie to a tenth of a percent, as in the table; a backend turns its counts into shares
 * first), its year for `oldest` (its first) and `newest` (its last), its distance in whole
 * kilometres for `closest` and `furthest`. Equal years and equal distances tie: the same
 * standing, so the same shot. A share under 0.05% counts as the smallest share in the list,
 * or 0.1%. One answer, or all tied, all stand at 0.
 */
export function standings(values: readonly number[], rule: Rule): number[] {
  const n = values.length;
  if (n === 0) return [];
  const up = higherIsBetter(rule);
  const byShare = rule === "common" || rule === "niche";
  let v = [...values];
  let m = v;
  if (byShare) {
    v = values.map((share) => Math.round(share * 10) / 10);
    const positive = v.filter((share) => share > 0);
    const floor = positive.length > 0 ? Math.min(...positive) : 0.1;
    m = v.map((share) => Math.log(Math.max(share, floor)));
  }
  const best = up ? Math.max(...m) : Math.min(...m);
  const worst = up ? Math.min(...m) : Math.max(...m);
  const span = Math.abs(worst - best);
  return v.map((value, i) => {
    let better = 0;
    let worse = 0;
    for (const other of v) {
      if (other === value) continue;
      if (up === other > value) better++;
      else worse++;
    }
    const place = better + worse > 0 ? better / (better + worse) : 0;
    const gap = span > 0 ? Math.abs(m[i] - best) / span : 0;
    return (place + gap) / 2;
  });
}

/**
 * The shot of each answer under a rule, from its share or count of players (`common`,
 * `niche`), its year (`oldest`, `newest`) or its distance (`closest`, `furthest`):
 * `shotForStanding` of its standing. The
 * best answer is always a worldie and, when anything is worse, the worst is a miss. A
 * better value never gets a worse shot. This is the rule that filed the sample answers
 * (before a look by eye; docs/data-notes/shots.md) and the one a backend runs on real counts.
 */
export function shotsFor(values: readonly number[], rule: Rule): Shot[] {
  return standings(values, rule).map(shotForStanding);
}
