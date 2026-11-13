/**
 * Bitmap text. Two original fonts, drawn here as glyph sheets:
 *
 * - `FONT_5x7`: the main face. Capitals and digits are 7 px tall and up to 5 wide,
 *   lowercase has a 5 px x-height and descenders that hang 2 px below the baseline.
 *   Covers ASCII 32 to 126 and the middle dot.
 * - `FONT_3x5`: the small face for labels and tight scoreboards. Capitals, digits and
 *   the punctuation `. , : ; ! ? ' " - + / ( ) % & # * = < > _ | [ ]` and the middle dot;
 *   lowercase input is drawn as capitals.
 *
 * Both are proportional (I, 1, punctuation are narrower; M and W are wider in the small
 * face) with 1 px between letters.
 *
 * Text outside a font's character set is folded before drawing: accents are stripped
 * ("Bernabéu" draws as "Bernabeu"), letters that do not decompose are mapped by hand
 * (ø, ł, đ, ß, æ, œ, ı, ə and friends), curly quotes and long dashes become their ASCII
 * relatives, and invisible marks are dropped. Anything still unknown (Greek, Cyrillic,
 * emoji) draws as a small hollow box, so a missing character is visible, never silently
 * lost. So pass names exactly as they are spelt: there is no need to strip accents first.
 */

import { TRANSPARENT, type Color } from "./color";
import type { Surface } from "./surface";

export interface Glyph {
  /** Width in pixels. */
  readonly w: number;
  /**
   * One bit mask per row, top to bottom. Bit `x` (value `1 << x`) is the pixel in column `x`.
   * 16 bits for the painted fonts (`./font-painted.ts`), whose glyphs are up to 14 wide.
   */
  readonly rows: Uint8Array | Uint16Array;
}

export interface BitmapFont {
  readonly name: string;
  /** Rows in every glyph, descender rows included. */
  readonly height: number;
  /** Height of a capital letter: rows from the top of the glyph down to the baseline. */
  readonly capHeight: number;
  /** Distance from the top of one line to the top of the next, for multi-line text. */
  readonly lineHeight: number;
  /** Pixels between neighbouring glyphs. */
  readonly spacing: number;
  /** Width of the widest digit: the cell used when `tabular` is on. */
  readonly digitWidth: number;
  /** True when the font has no lowercase and draws it as capitals. */
  readonly upperOnly: boolean;
  /** Glyphs by character code. Holes are `undefined`. */
  readonly glyphs: ReadonlyArray<Glyph | undefined>;
  /** The hollow box drawn for characters the font does not have. */
  readonly missing: Glyph;
}

export interface TextOptions {
  /** Default `FONT_5x7`. */
  font?: BitmapFont;
  /** What `x` means: the left edge (default), the centre, or the right edge of the text. */
  align?: "left" | "center" | "right";
  /** A copy in this colour, 1 px down and right, drawn underneath. */
  shadow?: Color;
  /** A 1 px border in this colour all the way round every letter. */
  outline?: Color;
  /** Whole-number magnification. Default 1. */
  scale?: number;
  /** Extra pixels between letters, on top of the font's own spacing. Default 0. */
  spacing?: number;
  /** Give every digit the same width, so a changing number does not jiggle. */
  tabular?: boolean;
  /**
   * Dot-matrix look, for `scale` 2 and up: each font pixel is drawn one pixel smaller than
   * the scale, leaving a dark gap between the dots. At scale 2 with even `x` and `y` the
   * dots sit exactly on the grid that `surface.dither(x, y, w, h, dim, 0.25)` paints, which
   * is how to draw the unlit LEDs behind them.
   */
  dots?: boolean;
}

// ---------------------------------------------------------------------------
// Glyph sheets. Each sheet is [characters, art]. In the art, glyphs sit side by side
// separated by one space, '#' is ink and '.' is empty. Rows left off the bottom are empty.
// U+FFFD in a sheet is the "missing character" box.
// ---------------------------------------------------------------------------

type Sheet = readonly [chars: string, art: string];

const SHEETS_5x7: readonly Sheet[] = [
  [
    "ABCDEFGHIJKLM",
    `
.###. ####. .###. ####. #### #### .###. #...# ### ...# #...# #... #...#
#...# #...# #...# #...# #... #... #...# #...# .#. ...# #..#. #... ##.##
#...# #...# #.... #...# #... #... #.... #...# .#. ...# #.#.. #... #.#.#
##### ####. #.... #...# ###. ###. #.### ##### .#. ...# ##... #... #.#.#
#...# #...# #.... #...# #... #... #...# #...# .#. #..# #.#.. #... #...#
#...# #...# #...# #...# #... #... #...# #...# .#. #..# #..#. #... #...#
#...# ####. .###. ####. #### #... .###. #...# ### .##. #...# #### #...#
`,
  ],
  [
    "NOPQRSTUVWXYZ",
    `
#...# .###. ####. .###. ####. .###. ##### #...# #...# #...# #...# #...# #####
##..# #...# #...# #...# #...# #...# ..#.. #...# #...# #...# #...# #...# ....#
#.#.# #...# #...# #...# #...# #.... ..#.. #...# #...# #...# .#.#. .#.#. ...#.
#.#.# #...# ####. #...# ####. .###. ..#.. #...# #...# #.#.# ..#.. ..#.. ..#..
#.#.# #...# #.... #.#.# #.#.. ....# ..#.. #...# .#.#. #.#.# .#.#. ..#.. .#...
#..## #...# #.... #..#. #..#. #...# ..#.. #...# .#.#. #.#.# #...# ..#.. #....
#...# .###. #.... .##.# #...# .###. ..#.. .###. ..#.. .#.#. #...# ..#.. #####
`,
  ],
  [
    "0123456789",
    `
.###. ..# .###. .###. ...#. ##### .###. ##### .###. .###.
#...# .## #...# #...# ..##. #.... #...# ....# #...# #...#
#..## #.# ....# ....# .#.#. ####. #.... ...#. #...# #...#
#.#.# ..# ...#. ..##. #..#. ....# ####. ..#.. .###. .####
##..# ..# ..#.. ....# ##### ....# #...# ..#.. #...# ....#
#...# ..# .#... #...# ...#. #...# #...# ..#.. #...# #...#
.###. ..# ##### .###. ...#. .###. .###. ..#.. .###. .###.
`,
  ],
  [
    "abcdefghijklm",
    `
.... #... .... ...# .... .## .... #... # .# #... #. .....
.... #... .... ...# .... #.. .... #... . .. #... #. .....
.##. ###. .### .### .##. ### .### ###. # .# #..# #. ##.#.
...# #..# #... #..# #..# #.. #..# #..# # .# #.#. #. #.#.#
.### #..# #... #..# #### #.. #..# #..# # .# ##.. #. #.#.#
#..# #..# #... #..# #... #.. #..# #..# # .# #.#. #. #.#.#
.### ###. .### .### .### #.. .### #..# # .# #..# .# #.#.#
.... .... .... .... .... ... ...# .... . .# .... .. .....
.... .... .... .... .... ... .##. .... . #. .... .. .....
`,
  ],
  [
    "nopqrstuvwxyz",
    `
.... .... .... .... ... .... ... .... ..... ..... ... .... ....
.... .... .... .... ... .... .#. .... ..... ..... ... .... ....
###. .##. ###. .### #.# .### ### #..# #...# #...# #.# #..# ####
#..# #..# #..# #..# ##. #... .#. #..# #...# #...# #.# #..# ..#.
#..# #..# #..# #..# #.. .##. .#. #..# .#.#. #.#.# .#. #..# .#..
#..# #..# #..# #..# #.. ...# .#. #..# .#.#. #.#.# #.# #..# #...
#..# .##. ###. .### #.. ###. ..# .### ..#.. .#.#. #.# .### ####
.... .... #... ...# ... .... ... .... ..... ..... ... ...# ....
.... .... #... ...# ... .... ... .... ..... ..... ... .##. ....
`,
  ],
  [
    "!\"#$%&'()*+,-./",
    `
# #.# .#.#. ..#.. ##..# .##.. # .# #. ..... ..... .. ... . ..#
# #.# .#.#. .#### ##..# #..#. # #. .# ..#.. ..#.. .. ... . ..#
# ... ##### #.#.. ...#. #.#.. . #. .# #.#.# ..#.. .. ... . .#.
# ... .#.#. .###. ..#.. .#... . #. .# .###. ##### .. ### . .#.
# ... ##### ..#.# .#... #.#.# . #. .# #.#.# ..#.. .. ... . .#.
. ... .#.#. ####. #..## #..#. . #. .# ..#.. ..#.. .. ... . #..
# ... .#.#. ..#.. #..## .##.# . .# #. ..... ..... .# ... # #..
. ... ..... ..... ..... ..... . .. .. ..... ..... #. ... . ...
`,
  ],
  [
    ":;<=>?@[\\]^_`{|}~·�",
    `
. .. ... .... ... .##. .###. ## #.. ## .#. .... #. ..# # #.. ..... . ....
. .. ..# .... #.. #..# #...# #. #.. .# #.# .... .# .#. # .#. ..... . ####
# .# .#. #### .#. ...# #.### #. .#. .# ... .... .. .#. # .#. .#... . #..#
. .. #.. .... ..# ..#. #.#.# #. .#. .# ... .... .. #.. # ..# #.#.# # #..#
. .. .#. #### .#. .#.. #.### #. .#. .# ... .... .. .#. # .#. ...#. . #..#
# .# ..# .... #.. .... #.... #. ..# .# ... .... .. .#. # .#. ..... . #..#
. #. ... .... ... .#.. .#### ## ..# ## ... .... .. ..# # #.. ..... . ####
. .. ... .... ... .... ..... .. ... .. ... #### .. ... # ... ..... . ....
`,
  ],
];

const SHEETS_3x5: readonly Sheet[] = [
  [
    "ABCDEFGHIJKLM",
    `
.#. ##. .## ##. ### ### .## #.# # ..# #.# #.. #...#
#.# #.# #.. #.# #.. #.. #.. #.# # ..# #.# #.. ##.##
### ##. #.. #.# ##. ##. #.# ### # ..# ##. #.. #.#.#
#.# #.# #.. #.# #.. #.. #.# #.# # #.# #.# #.. #...#
#.# ##. .## ##. ### #.. .## #.# # .#. #.# ### #...#
`,
  ],
  [
    "NOPQRSTUVWXYZ",
    `
#..# .#. ##. .#. ##. .## ### #.# #...# #...# #.# #.# ###
##.# #.# #.# #.# #.# #.. .#. #.# #...# #...# #.# #.# ..#
#.## #.# ##. #.# ##. .#. .#. #.# .#.#. #.#.# .#. .#. .#.
#..# #.# #.. #.# #.# ..# .#. #.# .#.#. #.#.# #.# .#. #..
#..# .#. #.. .#. #.# ##. .#. ### ..#.. .#.#. #.# .#. ###
.... ... ... ..# ... ... ... ... ..... ..... ... ... ...
`,
  ],
  [
    "0123456789",
    `
### .#. ### ### #.# ### ### ### ### ###
#.# ##. ..# ..# #.# #.. #.. ..# #.# #.#
#.# .#. ### ### ### ### ### ..# ### ###
#.# .#. #.. ..# ..# ..# #.# .#. #.# ..#
### ### ### ### ..# ### ### .#. ### ###
`,
  ],
  [
    ".,:;!?'\"-+/()%&#·�",
    `
. .. . .. # ### # #.# ... ... ..# .# #. #.# .#.. .#.#. . ...
. .. # .# # ..# # #.# ... .#. ..# #. .# ..# #.#. ##### . ###
. .. . .. # .#. . ... ### ### .#. #. .# .#. .#.. .#.#. # #.#
. .. # .# . ... . ... ... .#. #.. #. .# #.. #.#. ##### . #.#
# .# . #. # .#. . ... ... ... #.. .# #. #.# .#.# .#.#. . ###
. #. . .. . ... . ... ... ... ... .. .. ... .... ..... . ...
`,
  ],
  [
    "*=<>_|[]",
    `
... ... ..# #.. ... # ## ##
#.# ### .#. .#. ... # #. .#
.#. ... #.. ..# ... # #. .#
#.# ### .#. .#. ... # #. .#
... ... ..# #.. ### # ## ##
... ... ... ... ... # .. ..
`,
  ],
];

interface FontSpec {
  name: string;
  height: number;
  capHeight: number;
  lineHeight: number;
  spacing: number;
  spaceWidth: number;
  upperOnly: boolean;
}

const MISSING_KEY = 0xfffd;
const TABLE_SIZE = 0xb8; // ASCII plus Latin-1 up to the middle dot

function buildFont(spec: FontSpec, sheets: readonly Sheet[]): BitmapFont {
  const glyphs: (Glyph | undefined)[] = new Array<Glyph | undefined>(
    TABLE_SIZE,
  ).fill(undefined);
  let missing: Glyph | undefined;
  for (const [chars, art] of sheets) {
    const keys = Array.from(chars);
    const lines = art.split("\n").filter((l) => l.trim() !== "");
    if (lines.length > spec.height) {
      throw new Error(`${spec.name}: sheet "${chars}" has too many rows`);
    }
    const cells = lines.map((l) => l.trim().split(" "));
    for (let k = 0; k < keys.length; k++) {
      const w = cells[0][k]?.length ?? 0;
      const rows = new Uint8Array(spec.height);
      for (let r = 0; r < cells.length; r++) {
        const cell = cells[r][k];
        if (
          cell === undefined ||
          cell.length !== w ||
          cells[r].length !== keys.length
        ) {
          throw new Error(
            `${spec.name}: glyph "${keys[k]}" is malformed on row ${r} of sheet "${chars}"`,
          );
        }
        let bits = 0;
        for (let x = 0; x < w; x++) if (cell[x] === "#") bits |= 1 << x;
        rows[r] = bits;
      }
      const code = keys[k].codePointAt(0) ?? 0;
      if (code === MISSING_KEY) missing = { w, rows };
      else glyphs[code] = { w, rows };
    }
  }
  if (missing === undefined) throw new Error(`${spec.name}: no missing glyph`);
  glyphs[32] = { w: spec.spaceWidth, rows: new Uint8Array(spec.height) };
  if (spec.upperOnly) {
    for (let code = 97; code <= 122; code++) glyphs[code] = glyphs[code - 32];
  }
  let digitWidth = 0;
  for (let code = 48; code <= 57; code++) {
    digitWidth = Math.max(digitWidth, glyphs[code]?.w ?? 0);
  }
  return {
    name: spec.name,
    height: spec.height,
    capHeight: spec.capHeight,
    lineHeight: spec.lineHeight,
    spacing: spec.spacing,
    digitWidth,
    upperOnly: spec.upperOnly,
    glyphs,
    missing,
  };
}

/** The main face: capitals 7 px tall, lowercase with descenders, full ASCII. */
export const FONT_5x7: BitmapFont = buildFont(
  {
    name: "FONT_5x7",
    height: 9,
    capHeight: 7,
    lineHeight: 10,
    spacing: 1,
    spaceWidth: 3,
    upperOnly: false,
  },
  SHEETS_5x7,
);

/** The small face: capitals 5 px tall, digits and basic punctuation. Caps only. */
export const FONT_3x5: BitmapFont = buildFont(
  {
    name: "FONT_3x5",
    height: 6,
    capHeight: 5,
    lineHeight: 7,
    spacing: 1,
    spaceWidth: 2,
    upperOnly: true,
  },
  SHEETS_3x5,
);

// ---------------------------------------------------------------------------
// Folding: turning any character into ones the fonts have.
// ---------------------------------------------------------------------------

const FOLD: Record<string, string> = {
  ø: "o", // o with stroke
  Ø: "O",
  ł: "l", // l with stroke
  Ł: "L",
  đ: "d", // d with stroke
  Đ: "D",
  ð: "d", // eth
  Ð: "D",
  ħ: "h", // h with stroke
  Ħ: "H",
  ŧ: "t", // t with stroke
  Ŧ: "T",
  ß: "ss", // sharp s
  ẞ: "SS",
  æ: "ae",
  Æ: "AE",
  œ: "oe",
  Œ: "OE",
  ı: "i", // dotless i
  ə: "e", // schwa
  Ə: "E",
  ŋ: "n", // eng
  Ŋ: "N",
  ĸ: "k", // kra
  þ: "th", // thorn
  Þ: "Th",
  "\u2018": "'", // curly single quotes
  "\u2019": "'",
  "\u201a": "'",
  "\u201b": "'",
  "\u2032": "'", // prime
  "\u00b4": "'", // acute accent on its own
  "\u02bb": "'", // okina
  "\u02bc": "'", // modifier apostrophe
  "\u201c": '"', // curly double quotes
  "\u201d": '"',
  "\u201e": '"',
  "\u2033": '"', // double prime
  "\u00ab": '"', // guillemets
  "\u00bb": '"',
  "\u2039": "'",
  "\u203a": "'",
  "\u2010": "-", // hyphens and dashes
  "\u2011": "-",
  "\u2012": "-",
  "\u2013": "-",
  "\u2014": "-",
  "\u2015": "-",
  "\u2212": "-", // minus
  "\u2026": "...", // ellipsis
  "\u2022": "\u00b7", // bullet
  "\u2219": "\u00b7",
  "\u30fb": "\u00b7",
  "\u00d7": "x", // multiplication sign
  "\u2044": "/", // fraction slash
  "\u2215": "/",
  "\t": " ",
};

const COMBINING = /[\u0300-\u036f]/g;
const foldCache = new Map<number, string>();

/** What one code point becomes. May be empty (invisible marks) or several characters. */
function foldCodePoint(cp: number): string {
  const cached = foldCache.get(cp);
  if (cached !== undefined) return cached;
  const ch = String.fromCodePoint(cp);
  let out = FOLD[ch];
  if (out === undefined) {
    if (
      (cp >= 0x300 && cp <= 0x36f) || // combining accents
      (cp >= 0x200b && cp <= 0x200f) || // zero-width space, joiners, direction marks
      (cp >= 0x2060 && cp <= 0x2064) || // word joiner and friends
      (cp >= 0xfe00 && cp <= 0xfe0f) || // variation selectors
      cp === 0xad || // soft hyphen
      cp === 0xfeff ||
      cp < 32 ||
      (cp >= 0x7f && cp < 0xa0)
    ) {
      out = "";
    } else {
      // Compatibility decomposition splits accents off letters and also unpacks
      // ligatures, full-width forms, no-break and thin spaces, fractions and the like.
      const base = ch.normalize("NFKD").replace(COMBINING, "");
      const pieces = Array.from(base, (b) => FOLD[b] ?? b);
      // Keep the decomposition only if it got us to Latin letters. Otherwise (Korean
      // syllables, for one, split into three parts) keep the character: one box each.
      const latin = pieces.every((b) => (b.codePointAt(0) ?? 0) < 0x250);
      out = base === ch || !latin ? ch : pieces.join("");
    }
  }
  foldCache.set(cp, out);
  return out;
}

/**
 * The text as a font will draw it: accents stripped, special letters mapped, and for a
 * caps-only font everything in capitals. Characters the font still lacks are kept as they
 * are (they draw as the hollow box).
 */
export function foldText(text: string, font: BitmapFont = FONT_5x7): string {
  let out = "";
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    const piece =
      code < TABLE_SIZE && font.glyphs[code] !== undefined
        ? ch
        : foldCodePoint(code);
    out += font.upperOnly ? piece.toUpperCase() : piece;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Layout and drawing
// ---------------------------------------------------------------------------

// One line of laid-out glyphs, reused between calls so drawing allocates nothing.
const lineGlyphs: Glyph[] = [];
const lineX: number[] = [];
let lineCount = 0;

/** Lay out one line into the scratch arrays. Returns its width in unscaled pixels. */
function layout(text: string, font: BitmapFont, opts?: TextOptions): number {
  const glyphs = font.glyphs;
  const extra = Math.round(opts?.spacing ?? 0) || 0;
  const step = font.spacing + extra;
  const cell = opts?.tabular === true ? font.digitWidth : 0;
  let pen = 0;
  let n = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    let g = code < TABLE_SIZE ? glyphs[code] : undefined;
    if (g !== undefined) {
      if (cell > 0 && code >= 48 && code <= 57 && g.w < cell) {
        // Centre a narrow digit in the common digit cell.
        lineGlyphs[n] = g;
        lineX[n++] = pen + ((cell - g.w) >> 1);
        pen += cell + step;
      } else {
        lineGlyphs[n] = g;
        lineX[n++] = pen;
        pen += g.w + step;
      }
      continue;
    }
    // Slow path: a character outside the table.
    const cp = text.codePointAt(i) ?? code;
    if (cp > 0xffff) i++;
    const folded = foldCodePoint(cp);
    for (let k = 0; k < folded.length; k++) {
      const fc = folded.charCodeAt(k);
      g = (fc < TABLE_SIZE ? glyphs[fc] : undefined) ?? font.missing;
      if (fc >= 0xd800 && fc <= 0xdbff) k++; // one box per astral character
      lineGlyphs[n] = g;
      lineX[n++] = pen;
      pen += g.w + step;
    }
  }
  lineCount = n;
  return n === 0 ? 0 : pen - step;
}

// Outline masks: each glyph grown by one pixel in all eight directions, so an outline is
// one pass instead of eight. Row r of a mask is one row above row r of its glyph, and bit
// x is one column to the left of the glyph's bit x. Built on first use.
const fatCache = new WeakMap<Glyph, Uint16Array>();

function fatRows(g: Glyph): Uint16Array {
  let fat = fatCache.get(g);
  if (fat === undefined) {
    const rows = g.rows;
    fat = new Uint16Array(rows.length + 2);
    for (let r = 0; r < rows.length; r++) {
      const wide = rows[r] | (rows[r] << 1) | (rows[r] << 2);
      fat[r] |= wide;
      fat[r + 1] |= wide;
      fat[r + 2] |= wide;
    }
    fatCache.set(g, fat);
  }
  return fat;
}

/**
 * Paint the laid-out line with its left edge at (x, y). With `fat` it paints the outline
 * masks instead, whose top left is one font pixel up and left of the glyphs', so the
 * caller passes `x - scale, y - scale` to wrap the text. `block` is the size each font
 * pixel is drawn at (the scale, or less for the dot-matrix look).
 */
function paint(
  s: Surface,
  x: number,
  y: number,
  c: Color,
  height: number,
  scale: number,
  fat: boolean,
  block: number,
): void {
  const data = s.data;
  const W = s.w;
  const cx0 = s.clipX0;
  const cy0 = s.clipY0;
  const cx1 = s.clipX1;
  const cy1 = s.clipY1;
  const grow = fat ? 2 : 0;
  if (y >= cy1 || y + (height + grow) * scale <= cy0) return;
  for (let i = 0; i < lineCount; i++) {
    const g = lineGlyphs[i];
    const gx = x + lineX[i] * scale;
    if (gx >= cx1 || gx + (g.w + grow) * scale <= cx0) continue;
    const rows = fat ? fatRows(g) : g.rows;
    const count = rows.length;
    for (let r = 0; r < count; r++) {
      let bits = rows[r];
      if (bits === 0) continue;
      if (scale === 1) {
        const yy = y + r;
        if (yy < cy0 || yy >= cy1) continue;
        const base = yy * W + gx;
        for (let col = 0; bits !== 0; col++, bits >>>= 1) {
          if ((bits & 1) !== 0) {
            const xx = gx + col;
            if (xx >= cx0 && xx < cx1) data[base + col] = c;
          }
        }
      } else if (block !== scale) {
        // Dot-matrix: one small block per font pixel.
        for (let col = 0; bits !== 0; col++, bits >>>= 1) {
          if ((bits & 1) !== 0) {
            s.rect(gx + col * scale, y + r * scale, block, block, c);
          }
        }
      } else {
        // Magnified: one rectangle per run of font pixels.
        const py = y + r * scale;
        if (py >= cy1 || py + scale <= cy0) continue;
        let col = 0;
        while (bits !== 0) {
          if ((bits & 1) === 0) {
            col++;
            bits >>>= 1;
            continue;
          }
          let run = 0;
          do {
            run++;
            bits >>>= 1;
          } while ((bits & 1) !== 0);
          s.rect(gx + col * scale, py, run * scale, scale, c);
          col += run;
        }
      }
    }
  }
}

function scaleOf(opts?: TextOptions): number {
  const k = Math.round(opts?.scale ?? 1);
  return k >= 1 ? k : 1;
}

function drawLine(
  s: Surface,
  text: string,
  x: number,
  y: number,
  c: Color,
  font: BitmapFont,
  scale: number,
  opts?: TextOptions,
): number {
  const width = layout(text, font, opts) * scale;
  if (width === 0 || !Number.isFinite(x + y)) return width;
  const align = opts?.align;
  if (align === "center") x -= width >> 1;
  else if (align === "right") x -= width;
  const h = font.height;
  const block = opts?.dots === true && scale > 1 ? scale - 1 : scale;
  const shadow = opts?.shadow ?? TRANSPARENT;
  const outline = opts?.outline ?? TRANSPARENT;
  if (shadow !== TRANSPARENT) {
    if (outline !== TRANSPARENT) {
      // The shadow of the outlined shape: the outline mask, one font pixel down and right.
      paint(s, x, y, shadow, h, scale, true, block);
    } else {
      paint(s, x + scale, y + scale, shadow, h, scale, false, block);
    }
  }
  if (outline !== TRANSPARENT) {
    paint(s, x - scale, y - scale, outline, h, scale, true, block);
  }
  if (c !== TRANSPARENT) paint(s, x, y, c, h, scale, false, block);
  return width;
}

/**
 * Draw text and return its width in pixels.
 *
 * `y` is the top of the capitals. Capitals and digits fill `font.capHeight` rows from
 * there; descenders hang below. `x` is the left edge, or the centre or right edge with
 * `align`. A right edge is exclusive: text right-aligned to x = 100 ends on pixel 99.
 *
 * The returned width is that of the letters alone (shadow and outline add a pixel around
 * them without changing it) and always equals `measureText` with the same options.
 * A "\n" starts a new line `font.lineHeight` further down; the width is then the widest line.
 */
export function drawText(
  s: Surface,
  text: string,
  x: number,
  y: number,
  c: Color,
  opts?: TextOptions,
): number {
  const font = opts?.font ?? FONT_5x7;
  const scale = scaleOf(opts);
  x = Math.round(x);
  y = Math.round(y);
  if (text.indexOf("\n") < 0) {
    return drawLine(s, text, x, y, c, font, scale, opts);
  }
  let widest = 0;
  let top = y;
  for (const line of text.split("\n")) {
    const w = drawLine(s, line, x, top, c, font, scale, opts);
    if (w > widest) widest = w;
    top += font.lineHeight * scale;
  }
  return widest;
}

/** The width `drawText` would report for the same text and options. */
export function measureText(text: string, opts?: TextOptions): number {
  const font = opts?.font ?? FONT_5x7;
  const scale = scaleOf(opts);
  if (text.indexOf("\n") < 0) return layout(text, font, opts) * scale;
  let widest = 0;
  for (const line of text.split("\n")) {
    const w = layout(line, font, opts) * scale;
    if (w > widest) widest = w;
  }
  return widest;
}

/**
 * Break text into lines no wider than `maxWidth` pixels. Lines break at spaces; a single
 * word that is too wide is split across lines. Existing "\n" are kept as line breaks.
 * Draw the result with `drawText(s, lines.join("\n"), ...)` or one line at a time.
 */
export function wrapText(
  text: string,
  maxWidth: number,
  opts?: TextOptions,
): string[] {
  const out: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(" ")) {
      if (word === "") continue;
      const candidate = line === "" ? word : line + " " + word;
      if (measureText(candidate, opts) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line !== "") out.push(line);
      line = "";
      // The word starts a new line. If it still does not fit, split it.
      for (const ch of word) {
        if (line !== "" && measureText(line + ch, opts) > maxWidth) {
          out.push(line);
          line = "";
        }
        line += ch;
      }
    }
    out.push(line);
  }
  return out;
}
