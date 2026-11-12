/**
 * Interface-side copies of the two game unions the skin needs. They are structurally
 * identical to `Mode` and `Grade` in app/game/types.ts, so game values can be passed
 * straight in without app/ui importing the rules.
 */
export type UiMode = "home" | "away";

/** The six shots, best first, then no answer: the clock ran out, or a pass. */
export type UiGrade =
  | "worldie"
  | "golazo"
  | "trivela"
  | "toepoke"
  | "tapin"
  | "miss"
  | "timeup"
  | "skipped";

export const UI_GRADES: readonly UiGrade[] = [
  "worldie",
  "golazo",
  "trivela",
  "toepoke",
  "tapin",
  "miss",
  "timeup",
  "skipped",
];
