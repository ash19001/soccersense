// Where the home screen's icon buttons stand on a phone: how far in from the ends of the
// cards (ui.css section 26, `--ss-icon-in`). Pure: from the scale and the page's width.

import { menuLayout } from "~/art/layout";
import type { PixelScale } from "~/ui";

/**
 * At most this many logical pixels in from the cards' ends. The cards' frames show two
 * logical pixels of picture between them and the screen's side, so a button this far in
 * has four: 8 CSS px on a small phone, 12 on most.
 */
export const ICON_IN_U = 2;

/** And at least this many logical pixels of picture between a button and the ball. */
export const BALL_CLEAR_U = 2;

/** The interface column: 135 logical pixels, or 405 font pixels where that is wider. */
const COLUMN_U = 135;
const COLUMN_FP = 405;
/** The column's own margin at each side (ui.css section 16): three logical pixels. */
const COLUMN_PAD_U = 3;

/** The smallest touch target, as ui.css works it out: `--tap`. */
export function tapSize(scale: PixelScale): number {
  const pair = scale.snap * 2;
  const nudge = Number.isInteger(scale.dpr) ? 0 : scale.snap / 64;
  return Math.max(Math.ceil((44 - nudge) / pair - 1e-9) * pair, scale.px * 14);
}

/**
 * CSS px to set as `--ss-icon-in`: ICON_IN_U logical pixels, or fewer (as few as none)
 * where a stack of buttons would otherwise come closer than BALL_CLEAR_U to the ball. The
 * stacks stand at the sides of the ball's widest rows, and on the narrowest phones (360
 * wide at a ratio of 3) the ball is already as small as its words allow (layout.ts), so
 * there the buttons stay where the cards' ends put them.
 *
 * `viewW` is the page's width in CSS px. Without it (at build time) the page is taken to be
 * a canvas pixel narrower than the canvas, the least it can be (the canvas's size is the
 * page's rounded up to whole canvas pixels).
 *
 * Always a whole number of logical pixels, so the buttons stay on the interface's grid.
 */
export function menuIconInset(scale: PixelScale, viewW?: number): number {
  const u = scale.px;
  const cpx = scale.canvasPx;
  const view =
    viewW !== undefined && viewW > 0 ? viewW : (scale.canvasW - 1) * cpx;
  // The column, centred and rounded down to the grid (ui.css section 16).
  const column = Math.min(view, Math.max(COLUMN_U * u, COLUMN_FP * scale.fp));
  const colLeft = Math.max(
    0,
    Math.floor((view - column) / 2 / scale.snap + 1e-9) * scale.snap,
  );
  const colRight = view - column - colLeft;
  // The ball, on a canvas centred the same way (ui.css section 19): its centre is a whole
  // canvas pixel, half a pixel right of the canvas's middle when the canvas is odd.
  const lay = menuLayout(scale.canvasW, scale.canvasH);
  const off = lay.cx - scale.canvasW / 2;
  const ballRight = view / 2 - (lay.ballR + off) * cpx;
  const ballLeft = view / 2 - (lay.ballR - off) * cpx - scale.snap;
  const tap = tapSize(scale);
  // From each stack's inner side to the ball, before the stacks move in. The bell and
  // the heart stand a logical pixel further out than the cards' box (they are flush with
  // the cards' frames); the "?" stack is flush with the box.
  const left = ballLeft - (colLeft + (COLUMN_PAD_U - 1) * u + tap);
  const right = ballRight - (colRight + COLUMN_PAD_U * u + tap);
  const room = Math.min(left, right) - BALL_CLEAR_U * u;
  // A hundredth of a logical pixel of slack: CSS lengths at a fractional ratio are rounded
  // up in their fifth decimal place (scale.ts), which the ball's radius multiplies.
  const steps = Math.floor(room / u + 0.01);
  return Math.max(0, Math.min(ICON_IN_U, steps)) * u;
}
