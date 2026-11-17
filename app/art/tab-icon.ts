/**
 * The tab icon: the home screen's football with SS standing in front of it.
 *
 *   drawTabIcon()       the picture, 32 x 32, on nothing
 *   drawTabIconBall()   its ball alone, as it is behind the letters
 *   tabIconLetters()    which letter's yellow each pixel is
 *
 * The product owner (2026-11-17): "a proper football then a big SS in the middle in front of
 * the ball (not within the football). Make the football look how it does on the home page
 * but smaller and obviously no icons/text. Then in front of it add a yellow electric font of
 * SS which is taller than the ball"; then "make the SS italic maybe and slightly smaller";
 * of letters taller than the ball, "make the SS smaller, I don't like it". A staircase was
 * tried at their suggestion ("so the SS can be closer together"), the second letter a step
 * down and in front of the first, and turned down for the letters side by side: "no don't
 * staircase. I was happy with this".
 *
 * The ball is the menu's own (`drawBall`), in its menu pose and by day, with nothing on its
 * patches, and it fills the picture: 32 pixels across. The letters stand in the middle of
 * it, side by side on one line, each 17 tall, a little over half its height, so the ball
 * shows all round them: its black patches above and below, its leather at either side.
 *
 * The letters are an electric yellow: the palette's gold, lit along the top and left of
 * every stroke and shaded along the bottom and right, with a glint on each, inside a line of
 * ink that keeps them off the white leather. They are italic, and they are round: each is
 * two ovals drawn with a round brush, all curve, with a hook at each end. They are
 * deliberately not drawn as jagged bolts of lightning: two of those side by side, leaning,
 * are the badge of the Nazi SS, and nothing here may look like it.
 *
 * Pure: no clock, no randomness. `tools/favicon.ts` writes `public/favicon.svg` from it
 * (`pnpm favicon`), and a test holds the file to this drawing.
 */

import { Surface, TRANSPARENT } from "~/pixel";
import { drawBall, type BallState } from "./ball";
import { lightingFor } from "./lighting";
import { P } from "./palette";

/** The picture is this many pixels square. */
export const TAB_ICON_SIZE = 32;
/** The ball's radius: 32 pixels across (the engine's circles are round(2r) + 1). */
export const TAB_ICON_BALL_R = 15.5;

/** An upright S's box, and how thick its stroke is. */
const LETTER_W = 9;
const LETTER_H = 17;
const STROKE = 3;
/** The italic: how far a letter leans to the right for every pixel it rises. */
const SLANT = 0.26;
/** How far short of level, in radians, each end of the S stops: its hooks. */
const HOOK = 0.55;
/**
 * From one letter's left edge to the next one's. They stand side by side on one line (the
 * product owner, of a staircase that brought them closer: "no don't staircase"), and at
 * anything under ten their yellows touch.
 */
const ADVANCE = 10;
/** The letters' top row: they stand in the middle of the picture, top to bottom. */
const LETTER_Y = Math.floor((TAB_ICON_SIZE - LETTER_H) / 2);

/** How far the top of a letter leans past its foot, in whole pixels. */
const LEAN = Math.ceil((LETTER_H - 1) * SLANT);
/** The two letters together, from the first's foot to the second's leaning head. */
const WORD_W = ADVANCE + LETTER_W + LEAN;

/**
 * An italic S as rows of "#" and ".", `LETTER_W + LEAN` across: two ovals, one on the
 * other, drawn with a round brush and leaned to the right. The stroke starts at the right
 * of the upper oval, above its middle, goes over its top and down its left side to the
 * join; then down the right side of the lower oval and round its foot, to stop at its left,
 * below its middle. Each oval is left open on the side the stroke does not reach: the S's
 * two bays.
 */
function letterS(): string[] {
  const half = STROKE / 2;
  const rx = LETTER_W / 2 - half;
  const ry = (LETTER_H - STROKE) / 4;
  const cx = LETTER_W / 2;
  const upper = half + ry;
  const lower = upper + 2 * ry;
  const w = LETTER_W + LEAN;
  const cells = Array.from({ length: LETTER_H }, () =>
    Array.from({ length: w }, () => "."),
  );
  const dab = (ux: number, py: number): void => {
    // the lean: the higher, the further right
    const px = ux + (LETTER_H - py) * SLANT;
    for (let y = 0; y < LETTER_H; y++) {
      for (let x = 0; x < w; x++) {
        const dx = x + 0.5 - px;
        const dy = y + 0.5 - py;
        if (dx * dx + dy * dy <= half * half + 0.01) cells[y][x] = "#";
      }
    }
  };
  const sweep = Math.PI * 1.5 - HOOK;
  const STEPS = 400;
  for (let i = 0; i <= STEPS; i++) {
    const u = i / STEPS;
    // the upper oval: from its end at the right, over the top and the left, to its foot
    const a = -HOOK - u * sweep;
    dab(cx + rx * Math.cos(a), upper + ry * Math.sin(a));
    // the lower oval: from its top, round the right and the foot, to its end at the left
    const b = -Math.PI / 2 + u * sweep;
    dab(cx + rx * Math.cos(b), lower + ry * Math.sin(b));
  }
  return cells.map((row) => row.join(""));
}

/** The ball alone: the home screen's, by day, in its menu pose, nothing on its patches. */
export function drawTabIconBall(): Surface {
  const s = new Surface(TAB_ICON_SIZE, TAB_ICON_SIZE);
  s.clear(TRANSPARENT);
  const middle = (TAB_ICON_SIZE - 1) / 2;
  const state: BallState = {
    cx: middle,
    cy: middle,
    r: TAB_ICON_BALL_R,
    yaw: 0,
    pitch: 0,
    hovered: null,
    pressed: null,
    chosen: null,
    t: 0,
  };
  drawBall(s, state, {}, lightingFor({ elevation: 45, morning: false }));
  return s;
}

/** Where one letter's yellow is (the first is 0, the second 1): a byte a pixel. */
function letterMask(n: number): Uint8Array {
  const size = TAB_ICON_SIZE;
  const mask = new Uint8Array(size * size);
  const x0 = Math.floor((size - WORD_W) / 2);
  letterS().forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const x = x0 + n * ADVANCE + i;
      const y = LETTER_Y + j;
      if (row[i] === "#" && x >= 0 && x < size && y >= 0 && y < size) {
        mask[y * size + x] = 1;
      }
    }
  });
  return mask;
}

/**
 * One letter on the picture, over whatever is there: a line of ink round it, corners and
 * all, then its yellow, lit along the top and the left of every stroke and shaded along the
 * bottom and the right, and a glint where the light catches the top of it.
 */
function drawLetter(s: Surface, n: number): void {
  const size = TAB_ICON_SIZE;
  const mask = letterMask(n);
  const on = (x: number, y: number): boolean =>
    x >= 0 && x < size && y >= 0 && y < size && mask[y * size + x] === 1;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (on(x, y)) {
        const lit = !on(x, y - 1) || !on(x - 1, y);
        const shaded = !on(x, y + 1) || !on(x + 1, y);
        s.px(x, y, lit ? P.goldLight : shaded ? P.goldDark : P.gold);
        continue;
      }
      let near = false;
      for (let dy = -1; dy <= 1 && !near; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (on(x + dx, y + dy)) {
            near = true;
            break;
          }
        }
      }
      if (near) s.px(x, y, P.ink);
    }
  }
  // the glint: the first of its yellow on its second row, and the pixel after
  const y = LETTER_Y + 1;
  for (let x = 0; x < size; x++) {
    if (!on(x, y)) continue;
    s.px(x, y, P.white);
    if (on(x + 1, y)) s.px(x + 1, y, P.white);
    break;
  }
}

/**
 * Which letter's yellow each pixel of the icon is: 1 the first, 2 the second, 0 neither.
 * The two never meet: `ADVANCE` keeps a line of ink between them.
 */
export function tabIconLetters(): Uint8Array {
  const first = letterMask(0);
  const second = letterMask(1);
  return first.map((on, i) => (second[i] === 1 ? 2 : on));
}

/** The tab icon, 32 x 32, on a surface that is transparent everywhere else. */
export function drawTabIcon(): Surface {
  const s = drawTabIconBall();
  drawLetter(s, 0);
  drawLetter(s, 1);
  return s;
}
