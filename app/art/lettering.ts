/**
 * Words in the picture (docs/ART_BIBLE.md 2.1, and the lead's decision 1):
 *
 * - **Painted words** (the menu ball's labels, the wordmark's tagline, painted boards,
 *   banners, "POP!") take `paintedFont(face)`: the painted twin of a small face
 *   (`FONT_3x5` -> `font6x10()`, `FONT_5x7` -> `font10x14()`), which measures exactly
 *   twice the small one.
 *
 *     drawText(s, "HOMETOWN HERO", x, y, c, { font: paintedFont(FONT_3x5) });
 *
 * - **Lit lamps** (LED boards, scoreboards, the airship's sign) keep the small faces:
 *   `drawLedLine` and `drawLamps` (~/art/led) draw each pixel of the face as a lamp on a
 *   2 px pitch, hot, with light between lamps and a faint glow beside them. `ledText()`
 *   gives the small face at `scale: 2` with `dots: true`: the same lamps' places and width,
 *   for measuring.
 *
 * Pure.
 */

import {
  FONT_3x5,
  FONT_5x7,
  font10x14,
  font6x10,
  type BitmapFont,
  type TextOptions,
} from "~/pixel";

/**
 * The face to paint words in for a small face: its painted twin (the two small faces have
 * one each; any other face is returned as it is).
 */
export function paintedFont(font: BitmapFont = FONT_5x7): BitmapFont {
  if (font === FONT_3x5) return font6x10();
  if (font === FONT_5x7) return font10x14();
  return font;
}

/**
 * Options for text made of lit lamps in a small `font`: the font at `scale: 2` with
 * `dots: true` (each lamp a 1 px dot with a 1 px gap). Put it on even offsets from a lamp
 * field to sit on the panel's unlit lamps.
 */
export function ledText(font: BitmapFont = FONT_5x7): TextOptions {
  let opts = ledCache.get(font);
  if (opts === undefined) {
    opts = { font, scale: 2, dots: true };
    ledCache.set(font, opts);
  }
  return opts;
}

// One frozen set of options per face, so drawing allocates nothing.
const ledCache = new WeakMap<BitmapFont, Readonly<TextOptions>>();
