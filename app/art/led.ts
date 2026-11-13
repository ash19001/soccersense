/**
 * Dot-matrix scoreboards (art bible section 7): a dark panel of unlit lamps in a housing,
 * and lines of lit text on it. A line too long for its window scrolls as a marquee.
 *
 *   const field = drawLedPanel(layer, x, y, w, h, { grade: light.env });  // once, cached
 *   drawLedLine(s, "DID YOU KNOW?", field.x + 2, field.y + 4, field.w - 4,
 *     { font: FONT_3x5, color: P.ledGreen });                             // every frame
 *   drawLedLine(s, fact, field.x + 2, field.y + 13, field.w - 4, { t });
 *
 * The panel and the text are light sources, so they are raw palette colour whatever the
 * time of day. Only the housing takes the scene's light, through `grade`.
 *
 * The panel is a real dot matrix (the lead's decision 1): a 4 px housing (`LED_FRAME`),
 * unlit lamps that are 1 px dots with a 1 px gap on the field's even offsets (the field's
 * own first and last row and column stay clear), and a line is a small face (`FONT_3x5`,
 * `FONT_5x7`) drawn as lamps on the same 2 px pitch (`drawLamps`: a hot lamp for each
 * pixel of the face, light between neighbouring lamps and a faint glow beside them), so
 * every lit lamp lands on an unlit one. An even offset from the field is a lamp; `speed`
 * and `gap` are given in lamps. A line that fits is placed, and a marquee moves, in whole
 * lamps.
 */

import {
  FONT_5x7,
  Surface,
  TRANSPARENT,
  drawText,
  luma,
  measureText,
  mix,
  type BitmapFont,
  type Color,
} from "~/pixel";
import type { Zone } from "~/art/layout";
import { P } from "~/art/palette";

/** The housing round the lamps: a 2 px bezel and a 2 px unlit margin. */
export const LED_FRAME = 4;

export interface LedPanelOptions {
  /** Grades the housing for the scene's light, for example `light.env`. Default: none. */
  grade?: (c: Color) => Color;
}

/** The field of lamps inside a panel drawn at the same rectangle. */
export function ledField(x: number, y: number, w: number, h: number): Zone {
  const frame = LED_FRAME;
  return {
    x: Math.round(x) + frame,
    y: Math.round(y) + frame,
    w: Math.max(0, Math.round(w) - frame * 2),
    h: Math.max(0, Math.round(h) - frame * 2),
  };
}

/**
 * Draw a scoreboard panel: the housing (lit from the top left), and inside it a dark field
 * with a lamp on every other pixel, so dim that only lit text reads. Returns the field,
 * which is where `drawLedLine` should put its text.
 */
export function drawLedPanel(
  s: Surface,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: LedPanelOptions = {},
): Zone {
  const X = Math.round(x);
  const Y = Math.round(y);
  const W = Math.round(w);
  const H = Math.round(h);
  const field = ledField(X, Y, W, H);
  if (W < 1 || H < 1) return field;
  const grade = opts.grade ?? ((c: Color): Color => c);

  drawHousing(s, X, Y, W, H, grade);
  s.rect(field.x, field.y, field.w, field.h, P.ink);
  // Unlit lamps: 1 px dots on the field's even offsets, clear of its edges.
  for (let yy = field.y + 2; yy < field.y + field.h - 1; yy += 2) {
    for (let xx = field.x + 2; xx < field.x + field.w - 1; xx += 2) {
      s.px(xx, yy, P.ledOff);
    }
  }
  return field;
}

/**
 * The housing, 4 px deep: a raised bezel two pixels wide (its outer edge catches
 * the light on the top and left; its inner lip is in shadow there and lit on the bottom
 * and right) round a two-pixel unlit margin.
 */
function drawHousing(
  s: Surface,
  X: number,
  Y: number,
  W: number,
  H: number,
  grade: (c: Color) => Color,
): void {
  s.rect(X, Y, W, H, P.ledOff);
  const slate = grade(P.slate);
  s.frame(X, Y, W, H, slate);
  s.hline(X, Y, W - 1, grade(P.steel));
  s.vline(X, Y, H - 1, grade(P.steel));
  if (W > 4 && H > 4) {
    s.frame(X + 1, Y + 1, W - 2, H - 2, slate);
    s.hline(X + 1, Y + 1, W - 3, grade(P.night));
    s.vline(X + 1, Y + 1, H - 3, grade(P.night));
    s.hline(X + 2, Y + H - 2, W - 3, grade(P.steel));
    s.vline(X + W - 2, Y + 2, H - 3, grade(P.steel));
  }
}

export interface LedLineOptions {
  /** Default `FONT_5x7`. */
  font?: BitmapFont;
  /** The lit lamps. Raw palette colour. Default `amber`. */
  color?: Color;
  /** Seconds. Drives the marquee of a line that is too wide. Default 0 (its resting place). */
  t?: number;
  /** Where a line that fits sits in its window. Default "center". */
  align?: "left" | "center" | "right";
  /** Marquee speed in lamps a second (a lamp is 2 px). Default 14. */
  speed?: number;
  /** Seconds a marquee rests at its start before every lap. Default 2. */
  pause?: number;
  /**
   * Blank lamps (2 px each) between the end of a marquee and its start coming round.
   * Default 20.
   */
  gap?: number;
}

/**
 * The colours of lit lamps, for lamps of `color` on a field of `bg`:
 *
 * - `hot`, the lamp itself, half way from its colour to the light end of the warm ramp
 *   (`goldLight`: highlights lean yellow), so each lamp is a bright point;
 * - `link`, the light between two neighbouring lit lamps (and across a diagonal step): the
 *   colour itself, so a stroke is a line of hot lamps joined by light;
 * - `glow`, the faint light a lamp throws into the dark gaps beside it where no lamp is lit:
 *   55% of the way from the field to the colour.
 *
 * Together a stroke one lamp wide is three pixels wide (glow, lamp, glow) with the panel's
 * unlit lamps still showing round it, and a line carries about four fifths of the light of
 * solid letters at the same size (two fifths with bare dots and a dim glow). Dark
 * words on a light board are paint, not light: their lamps are not made hotter.
 */
export interface LampLook {
  hot: Color;
  link: Color;
  glow: Color;
}

/** How far a lamp's glow is from the field towards its colour. */
const GLOW_MIX = 0.55;
/** How far a lit lamp is from its colour towards `goldLight`. */
const HOT_MIX = 0.5;

const looks = new Map<string, LampLook>();

/** The lamps' colours for text of `color` on a field of `bg` (default `ink`), cached. */
export function lampLook(color: Color, bg: Color = P.ink): LampLook {
  const key = `${color}/${bg}`;
  let look = looks.get(key);
  if (look === undefined) {
    const light = luma(color) > luma(bg);
    look = {
      hot: light ? mix(color, P.goldLight, HOT_MIX) : color,
      link: color,
      glow: mix(bg, color, GLOW_MIX),
    };
    if (looks.size > 64) looks.clear();
    looks.set(key, look);
  }
  return look;
}

/** One number per face, for the cache's keys. */
const faceIds = new WeakMap<BitmapFont, number>();
let nextFace = 1;
function faceId(font: BitmapFont): number {
  let id = faceIds.get(font);
  if (id === undefined) {
    id = nextFace++;
    faceIds.set(font, id);
  }
  return id;
}

/** Words already turned into lamps: one layer per face, colours and text. */
const layers = new Map<string, Surface>();
const LAYERS_KEPT = 48;

/**
 * `text` in `font` as lamps, on a layer whose pixel (1, 1) is the first
 * lamp: each pixel of the face is a lamp on a 2 px pitch (the lamp, then a gap right of it
 * and one under it), coloured by `look`. The layer reaches one pixel past the lamps all
 * round, for the glow.
 */
function lampLayer(text: string, font: BitmapFont, look: LampLook): Surface {
  const key = `${faceId(font)}/${look.hot}/${look.link}/${look.glow}/${text}`;
  const hit = layers.get(key);
  if (hit) return hit;
  const tw = measureText(text, { font });
  const fh = font.height;
  const mask = new Surface(tw + 2, fh + 2);
  drawText(mask, text, 1, 1, P.white, { font });
  const on = (i: number, j: number): boolean =>
    mask.data[(j + 1) * mask.w + i + 1] !== TRANSPARENT;
  const out = new Surface(tw * 2 + 1, fh * 2 + 1);
  for (let j = -1; j < fh; j++) {
    for (let i = -1; i < tw; i++) {
      const a = on(i, j);
      const b = on(i + 1, j);
      const c = on(i, j + 1);
      const d = on(i + 1, j + 1);
      const X = 2 * i + 1;
      const Y = 2 * j + 1;
      if (a) out.px(X, Y, look.hot);
      // the gap right of it and the one under it: light between two lamps, a glow
      // beside one
      if (j >= 0 && (a || b)) out.px(X + 1, Y, a && b ? look.link : look.glow);
      if (i >= 0 && (a || c)) out.px(X, Y + 1, a && c ? look.link : look.glow);
      // the gap between four: lit where a stroke steps diagonally through it
      if ((a && d) || (b && c)) out.px(X + 1, Y + 1, look.link);
    }
  }
  if (layers.size >= LAYERS_KEPT) layers.clear();
  layers.set(key, out);
  return out;
}

export interface LampOptions {
  /** The face, one lamp a pixel. Default `FONT_5x7`. */
  font?: BitmapFont;
  /** The field the lamps are on, for their glow. Default `ink`. */
  bg?: Color;
}

/**
 * Draw `text` as lit lamps with the first lamp at (x, y) (the top left of the capitals),
 * and return its width. A lamp is a hot point on every other pixel with its light round it
 * (`LampLook`): put it on even offsets from a lamp field so the lamps land on the panel's
 * unlit ones. Its glow reaches one pixel left of and above (x, y), and one past the last
 * lamp.
 */
export function drawLamps(
  s: Surface,
  text: string,
  x: number,
  y: number,
  color: Color,
  opts: LampOptions = {},
): number {
  const font = opts.font ?? FONT_5x7;
  if (text === "") return 0;
  const layer = lampLayer(text, font, lampLook(color, opts.bg ?? P.ink));
  s.blit(layer, Math.round(x) - 1, Math.round(y) - 1);
  return layer.w - 1;
}

/** The width `drawLamps` gives `text` in `font`. */
export function measureLamps(
  text: string,
  font: BitmapFont = FONT_5x7,
): number {
  return measureText(text, { font }) * 2;
}

/**
 * Draw one line of lit text in the window that starts at (`x`, `y`) and is `width` wide
 * (`y` is the top of the capitals). A line that fits is placed by `align`. A longer one
 * starts flush left, rests for `pause` seconds so its beginning can be read, then runs
 * one whole lap to the left in whole lamps and is back where it began: no jump. Nothing is
 * drawn outside the window, but for the lamps' glow, one pixel left of it and above it
 * (`drawLamps`). Returns true when the line scrolls.
 */
export function drawLedLine(
  s: Surface,
  text: string,
  x: number,
  y: number,
  width: number,
  opts: LedLineOptions = {},
): boolean {
  const font = opts.font ?? FONT_5x7;
  const color = opts.color ?? P.amber;
  const X = Math.round(x);
  const Y = Math.round(y);
  const W = Math.round(width);
  if (W < 1 || text === "") return false;
  // a lamp is two pixels: the lamp and its gap
  const lamp = 2;
  const lampOpts: LampOptions = { font };
  const tw = measureLamps(text, font);
  const edge = lamp - 1;

  s.pushClip(X - edge, Y - edge, W + edge, font.height * lamp + edge);
  if (tw <= W) {
    const align = opts.align ?? "center";
    const spare = Math.floor((W - tw) / lamp);
    const at =
      align === "left"
        ? X
        : align === "right"
          ? X + spare * lamp
          : X + Math.floor(spare / 2) * lamp;
    drawLamps(s, text, at, Y, color, lampOpts);
    s.popClip();
    return false;
  }

  const speed = Math.max(1, opts.speed ?? 14) * lamp;
  const pause = Math.max(0, opts.pause ?? 2);
  const lap = tw + Math.max(1, Math.round(opts.gap ?? 20)) * lamp;
  const period = pause + lap / speed;
  const t = Number.isFinite(opts.t) ? (opts.t as number) : 0;
  const tau = ((t % period) + period) % period;
  const off =
    tau < pause
      ? 0
      : Math.min(lap, Math.floor(((tau - pause) * speed) / lamp) * lamp);
  drawLamps(s, text, X - off, Y, color, lampOpts);
  drawLamps(s, text, X - off + lap, Y, color, lampOpts);
  s.popClip();
  return true;
}

/**
 * How long a line that `drawLedLine` scrolls takes to go once round (its pause and one
 * lap), in seconds; 0 for a line that fits its window.
 */
export function ledLap(
  text: string,
  width: number,
  opts: Pick<LedLineOptions, "font" | "speed" | "pause" | "gap"> = {},
): number {
  const font = opts.font ?? FONT_5x7;
  const lamp = 2;
  const tw = measureLamps(text, font);
  if (tw <= Math.round(width)) return 0;
  const speed = Math.max(1, opts.speed ?? 14) * lamp;
  const lap = tw + Math.max(1, Math.round(opts.gap ?? 20)) * lamp;
  return Math.max(0, opts.pause ?? 2) + lap / speed;
}
