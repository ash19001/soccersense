/**
 * The career ground's public types (docs/CAREER_SCENE.md section 7).
 */

/** The career tier: 0 a kickabout in the park to 7 lifting the World Cup. */
export type Tier = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** The tiers, in order. */
export const GROUND_TIERS: readonly Tier[] = Object.freeze([
  0, 1, 2, 3, 4, 5, 6, 7,
]);

/**
 * How the people watching feel. The scene sets it when a shot lands: `cheer` and `roar`
 * for a goal, `ooh` for a save or a near miss, `groan` for a miss, `hush` when time runs
 * out, `party` for the ending, `idle` otherwise.
 */
export type CrowdMood =
  "idle" | "hush" | "ooh" | "groan" | "cheer" | "roar" | "party";

export const CROWD_MOODS: readonly CrowdMood[] = Object.freeze([
  "idle",
  "hush",
  "ooh",
  "groan",
  "cheer",
  "roar",
  "party",
]);

/** Where the goal is, so the scene can aim at it. */
export interface GroundGoal {
  /** Jumpers for goalposts (tier 0), a small wonky goal (tier 1), a full goal (2 to 7). */
  kind: "jumpers" | "small" | "full";
  /** The goal line at the feet row (`careerLayout().goalX`). */
  lineX: number;
  /** The underside of the crossbar at the goal line (for jumpers: the height that counts). */
  barY: number;
  /** How far the net runs to the right of the line (0 for jumpers). */
  depth: number;
}

/** The net pushed out to the right at row `y`, by `amount` from 0 (none) to 1 (the most). */
export interface NetBulge {
  y: number;
  amount: number;
}

/** Words painted on the ground's boards and banners, given by the caller (from app/i18n). */
export interface GroundLabels {
  boards?: readonly string[];
  banners?: readonly string[];
}

/** Where the podium is at tier 7: the hero stands with his feet on `(x, top)`. */
export interface GroundPodium {
  /** The middle of the top step. */
  x: number;
  /** The row his feet stand on. */
  top: number;
  /** The podium's whole width. */
  w: number;
}
