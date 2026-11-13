/**
 * The far side's tables: the street's walls and doors, which modules are alleys, the boards'
 * colours, and how far back each part of the skyline is. Read by far.ts and by the end
 * behind the goal (end.ts).
 */

import { P } from "~/art/palette";
import type { Color } from "~/pixel";

/** How far back the street is (0 near, 1 the horizon). */
export const STREET = 0.3;
export const CHURCH = 0.42;
export const TREES_FAR = 0.62;

export const WALLS: readonly (readonly [Color, number])[] = [
  [P.brick, 40],
  [P.brickLight, 18],
  [P.brickDark, 16],
  [P.concreteLight, 14],
  [P.chalk, 12],
];

export const DOORS: readonly (readonly [Color, number])[] = [
  [P.woodDark, 20],
  [P.night, 20],
  [P.awayDark, 14],
  [P.grassDeep, 14],
  [P.slate, 14],
  [P.gold, 6],
];

/** Which house this module is, counting from his (0). Every seventh is an alley with a tree. */
export function isAlley(i: number): boolean {
  return ((i % 7) + 7) % 7 === 4;
}

/** The washing hangs in the alley three houses left of his. */
export const WASHING_ALLEY = -3;

export interface BoardLook {
  bg: Color;
  fg: Color;
}

/** The painted boards along the far touchline (tiers 2 and 3). */
export const BOARD_LOOKS: readonly BoardLook[] = [
  { bg: P.home, fg: P.chalk },
  { bg: P.chalk, fg: P.night },
  { bg: P.gold, fg: P.night },
  { bg: P.grassDeep, fg: P.chalk },
  { bg: P.night, fg: P.gold },
  { bg: P.skyMid, fg: P.chalk },
];
