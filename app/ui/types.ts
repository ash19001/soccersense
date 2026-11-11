/**
 * Interface-side copies of the two game unions the skin needs. They are structurally
 * identical to `Mode` and `Grade` in app/game/types.ts, so game values can be passed
 * straight in without app/ui importing the rules.
 */
export type UiMode = "home" | "away";

export type UiGrade =
  "worldie" | "topbins" | "goal" | "ontarget" | "wide" | "timeup" | "skipped";

export const UI_GRADES: readonly UiGrade[] = [
  "worldie",
  "topbins",
  "goal",
  "ontarget",
  "wide",
  "timeup",
  "skipped",
];
