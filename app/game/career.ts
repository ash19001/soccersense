/** Stable ids for the eight career tiers. Display names live in the interface text. */
export type TierId =
  | "park"
  | "sunday"
  | "nonleague"
  | "lower"
  | "topflight"
  | "international"
  | "final"
  | "winner";

export interface Tier {
  /** 0 to 7. */
  tier: number;
  /** The running total at which this tier is reached. */
  from: number;
  id: TierId;
}

/** Points per promotion. */
export const TIER_STEP = 90;

export const TIERS: readonly Tier[] = [
  { tier: 0, from: 0, id: "park" },
  { tier: 1, from: 90, id: "sunday" },
  { tier: 2, from: 180, id: "nonleague" },
  { tier: 3, from: 270, id: "lower" },
  { tier: 4, from: 360, id: "topflight" },
  { tier: 5, from: 450, id: "international" },
  { tier: 6, from: 540, id: "final" },
  { tier: 7, from: 630, id: "winner" },
];

export const TOP_TIER = TIERS.length - 1;

/** Seven questions at 100 points each. */
export const MAX_TOTAL = 700;

export interface Career {
  /** 0 to 7. */
  tier: number;
  /** The tier's stable id, the key for its display name. */
  id: TierId;
  /** Where this tier starts. */
  from: number;
  /** Where the next tier starts, or null at the top. */
  next: number | null;
  /** 0 to 1 of the way from `from` to `next`. 1 at the top tier. */
  progress: number;
}

/** The tier number (0 to 7) for a running total. Anything that is not a number is tier 0. */
export function tierFor(total: number): number {
  let tier = 0;
  for (const t of TIERS) {
    if (total >= t.from) tier = t.tier;
  }
  return tier;
}

/** Where a running total puts the footballer, and how close the next promotion is. */
export function careerFor(total: number): Career {
  const tier = tierFor(total);
  const { from, id } = TIERS[tier];
  if (tier === TOP_TIER) return { tier, id, from, next: null, progress: 1 };
  const next = TIERS[tier + 1].from;
  const part = (total - from) / (next - from);
  const progress = Number.isFinite(part) ? Math.min(1, Math.max(0, part)) : 0;
  return { tier, id, from, next, progress };
}

/**
 * Each tier newly reached when the total goes from `before` to `after`, in order. Empty when
 * no threshold was crossed. A 100 point answer from 85 gives [1, 2].
 */
export function tiersCrossed(before: number, after: number): number[] {
  const crossed: number[] = [];
  for (let t = tierFor(before) + 1; t <= tierFor(after); t++) crossed.push(t);
  return crossed;
}

/** A perfect game: every answer the best one. */
export function isPerfect(total: number): boolean {
  return total >= MAX_TOTAL;
}
