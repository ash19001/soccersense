/**
 * The size steps of the home picture's traffic and people (package G2).
 *
 * A car, a coach or a person on foot is drawn in five sizes and shrinks a step at a time
 * as it gets further away: steps 0, 2 and 4 are the three size classes (`sizeClass`,
 * stadium-view.ts), steps 1 and 3 lie between them. A car is 6, 8, 10, 12 and 14 px long
 * pointing east; a person 4, 5, 6, 8 and 10 px tall.
 *
 * The step follows the scale: the class boundaries stay where `sizeClass` has them (1.48
 * and 2.84 pixels a unit), and the two new ones split the middle class in three, where the
 * drawn length is closest to the length the projection asks for (a car about 4.6 units
 * long), so the size changes by a pixel or two at a time, evenly.
 *
 * Pure: no DOM, no clock.
 */

/** A size step: 0 the furthest, 4 the nearest. */
export type Step = 0 | 1 | 2 | 3 | 4;

/** The scale (pixels a unit) where each step after the first begins. */
export const STEP_AT: readonly number[] = [1.48, 1.934, 2.386, 2.84];

/** The size step for something at `s` pixels per map unit. */
export function sizeStep(s: number): Step {
  return s < STEP_AT[0]
    ? 0
    : s < STEP_AT[1]
      ? 1
      : s < STEP_AT[2]
        ? 2
        : s < STEP_AT[3]
          ? 3
          : 4;
}

/** The step a caller's size class stands for, when it gives no scale. */
export function stepOfClass(cls: 0 | 1 | 2): Step {
  return cls === 0 ? 0 : cls === 1 ? 2 : 4;
}
