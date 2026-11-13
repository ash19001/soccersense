/**
 * The big stand's heights at tiers 4 to 7, as rows above the far touchline `g.F`.
 *
 * Both tiers of fans have six rows: six rows on the crowd's 8 px pitch are 48 px.
 *
 * Read by the stand itself (stadium.ts), by the travelling fans' pocket (`paint.ts`), by the
 * moon over a stadium (`ground.ts`) and by the fireworks band (`career.ts`).
 */

export interface Stand {
  /** Top of the roof. */
  roofTop: number;
  /** Top of the upper tier's first row of fans. */
  upperTop: number;
  /** The balcony's lit lip (the bottom of the upper tier). */
  balcony: number;
  /** Top of the strip of boxes. */
  boxes: number;
  /** Top of the lower tier's first row of fans. */
  lowerTop: number;
  /** Height of the LED boards along the far touchline. */
  boards: number;
}

/** The big stand's heights above the far touchline. */
export const STAND: Readonly<Stand> = Object.freeze({
  roofTop: 142,
  upperTop: 126,
  balcony: 78,
  boxes: 74,
  lowerTop: 62,
  boards: 14,
});
