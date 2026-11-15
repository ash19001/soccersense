/**
 * The stadium end's profile (end.ts), in stand pixels from its foot (the far end's size):
 * the boards' wall, the lower tier, the walkway, the upper tier, the dark under the roof,
 * the truss and the roof's fascia; a row of seats, and an aisle every so many rows of the
 * front. Its own module, with nothing to import, so the stands that share it (end.ts, the
 * corner's corner.ts, NEXT-GEN's nextgen-high.ts) can read it whatever order they load in.
 */
export const END_PROFILE = Object.freeze({
  WALL: 16,
  LOW: 16,
  WALK: 64,
  UP: 72,
  BACK: 120,
  UNDER: 124,
  FASCIA: 128,
  TOP: 140,
  /** A row of seats is 8 stand pixels, and a seat 8 px along the row. */
  ROW: 8,
  /** Aisles: one every this many rows of the front, 4 wide. */
  AISLE: 83,
});
