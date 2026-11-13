/**
 * The painted faces (./font-painted.ts), every glyph, under their twins (`FONT_3x5`,
 * `FONT_5x7`) drawn at scale 2 (the same text, measured the same):
 *
 *   ./node_modules/.bin/tsx tools/snap.ts pixel/fonts-painted --scale 2
 *
 * Returns its own size. The colours are the art bible's values written out, as in
 * ./pixel.shots.ts: the engine does not depend on `app/art`.
 */

import { font10x14, font6x10 } from "./font-painted";
import { FONT_3x5, FONT_5x7, drawText, type BitmapFont } from "./text";
import { Surface } from "./surface";
import { rgb } from "./color";
import type { ShotMap } from "./shot";

const INK = rgb(0x0f1220);
const SLATE = rgb(0x2c3654);
const CHALK = rgb(0xf3eedd);
const MIST = rgb(0x9fb0cc);
const AMBER = rgb(0xffb21f);
const HOME = rgb(0xe8452c);
const AWAY = rgb(0x19a9bf);
const NIGHT = rgb(0x1a2036);

const SMALL_ROWS = [
  "ABCDEFGHIJKLM",
  "NOPQRSTUVWXYZ",
  "0123456789",
  ".,:;!?'\"-+/()%&#·�*=<>_|[]",
];
const BIG_ROWS = [
  "ABCDEFGHIJKLM",
  "NOPQRSTUVWXYZ",
  "abcdefghijklm",
  "nopqrstuvwxyz",
  "0123456789",
  "!\"#$%&'()*+,-./",
  ":;<=>?@[\\]^_`{|}~·�",
];
const SMALL_WORDS = [
  "HOME AWAY NEXT-GEN RETRO CLOSEST FURTHEST",
  "GUESS WHO SHOOTOUT DAILY FOOTBALL TRIVIA",
  "HOMETOWN HERO 512 0-0 90+3 100%",
];
const BIG_WORDS = [
  "HOME AWAY 512 POP!",
  "Did you know? Bernabéu, Malmö, Łódź",
  "The penalty kick arrived in 1891.",
];

/** One face: its rows of glyphs, each line the small face at scale 2 over the twin. */
function face(
  s: Surface,
  y: number,
  rows: readonly string[],
  small: BitmapFont,
  twin: BitmapFont,
  words: readonly string[],
): number {
  for (const row of rows) {
    // space the glyphs so that the two lines line up glyph for glyph
    let x = 8;
    for (const ch of row) {
      drawText(s, ch, x, y, MIST, { font: small, scale: 2 });
      drawText(s, ch, x, y + small.lineHeight * 2 + 2, CHALK, { font: twin });
      x += Math.max(2 * (small.glyphs[ch.charCodeAt(0)]?.w ?? 4), 8) + 8;
    }
    y += small.lineHeight * 4 + 10;
  }
  for (const line of words) {
    drawText(s, line, 8, y, MIST, { font: small, scale: 2 });
    drawText(s, line, 8, y + small.lineHeight * 2 + 2, CHALK, { font: twin });
    y += small.lineHeight * 4 + 10;
  }
  return y;
}

function sheet(): Surface {
  const s = new Surface(560, 760);
  s.clear(INK);
  let y = face(s, 8, SMALL_ROWS, FONT_3x5, font6x10(), SMALL_WORDS);
  y = face(s, y + 8, BIG_ROWS, FONT_5x7, font10x14(), BIG_WORDS);
  // in use: outline, shadow, on colour, tabular digits
  y += 4;
  s.rect(8, y, 120, 28, HOME);
  drawText(s, "HOME", 68, y + 9, CHALK, { font: font6x10(), align: "center" });
  s.rect(136, y, 120, 28, AWAY);
  drawText(s, "AWAY", 196, y + 7, CHALK, {
    font: font10x14(),
    align: "center",
    shadow: NIGHT,
  });
  s.rect(264, y, 120, 28, SLATE);
  drawText(s, "POP!", 324, y + 7, AMBER, {
    font: font10x14(),
    align: "center",
    outline: INK,
  });
  drawText(s, "0123 1111 7890", 392, y + 9, CHALK, {
    font: font6x10(),
    tabular: true,
  });
  return s;
}

export const shots: ShotMap = {
  "pixel/fonts-painted": () => sheet(),
};
