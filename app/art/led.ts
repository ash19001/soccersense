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
 */

import {
  FONT_5x7,
  drawText,
  measureText,
  type BitmapFont,
  type Color,
  type Surface,
} from "~/pixel";
import type { Zone } from "~/art/layout";
import { P } from "~/art/palette";

/** The housing round the lamps: a 1 px frame and a 1 px unlit margin. */
export const LED_FRAME = 2;

export interface LedPanelOptions {
  /** Grades the housing for the scene's light, for example `light.env`. Default: none. */
  grade?: (c: Color) => Color;
}

/** The field of lamps inside a panel drawn at the same rectangle. */
export function ledField(x: number, y: number, w: number, h: number): Zone {
  return {
    x: Math.round(x) + LED_FRAME,
    y: Math.round(y) + LED_FRAME,
    w: Math.max(0, Math.round(w) - LED_FRAME * 2),
    h: Math.max(0, Math.round(h) - LED_FRAME * 2),
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

  s.rect(X, Y, W, H, P.ledOff);
  s.frame(X, Y, W, H, grade(P.slate));
  s.hline(X, Y, W, grade(P.steel));
  s.vline(X, Y, H, grade(P.steel));
  s.rect(field.x, field.y, field.w, field.h, P.ink);
  // Unlit lamps: every other pixel, with a clear row and column round the edge.
  for (let yy = field.y + 1; yy < field.y + field.h - 1; yy += 2) {
    for (let xx = field.x + 1; xx < field.x + field.w - 1; xx += 2) {
      s.px(xx, yy, P.ledOff);
    }
  }
  return field;
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
  /** Marquee speed in pixels a second. Default 14. */
  speed?: number;
  /** Seconds a marquee rests at its start before every lap. Default 2. */
  pause?: number;
  /** Blank pixels between the end of a marquee and its start coming round. Default 20. */
  gap?: number;
}

/**
 * Draw one line of lit text in the window that starts at (`x`, `y`) and is `width` wide
 * (`y` is the top of the capitals). A line that fits is placed by `align`. A longer one
 * starts flush left, rests for `pause` seconds so its beginning can be read, then runs
 * one whole lap to the left in whole pixels and is back where it began: no jump.
 * Nothing is drawn outside the window. Returns true when the line scrolls.
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
  const textOpts = { font };
  const tw = measureText(text, textOpts);

  s.pushClip(X, Y, W, font.height);
  if (tw <= W) {
    const align = opts.align ?? "center";
    const at =
      align === "left"
        ? X
        : align === "right"
          ? X + W - tw
          : X + Math.floor((W - tw) / 2);
    drawText(s, text, at, Y, color, textOpts);
    s.popClip();
    return false;
  }

  const speed = Math.max(1, opts.speed ?? 14);
  const pause = Math.max(0, opts.pause ?? 2);
  const lap = tw + Math.max(1, Math.round(opts.gap ?? 20));
  const period = pause + lap / speed;
  const t = Number.isFinite(opts.t) ? (opts.t as number) : 0;
  const tau = ((t % period) + period) % period;
  const off =
    tau < pause ? 0 : Math.min(lap, Math.floor((tau - pause) * speed));
  drawText(s, text, X - off, Y, color, textOpts);
  drawText(s, text, X - off + lap, Y, color, textOpts);
  s.popClip();
  return true;
}
