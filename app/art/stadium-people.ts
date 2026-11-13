/**
 * The home picture's people (docs/ART_BIBLE.md 5; package G): the supporters, stewards and
 * passers-by stadium-things.ts `person` draws. A near person is 6 x 10: hair or a bobble
 * hat, a face lit from the left, the shirt's light and shade, hands, a scarf or a
 * steward's vest, trousers and shoes, a stride; seen from the front, or from the back when
 * they walk away up the screen; arms up when they jump for a goal. The middle class is
 * 2 x 6 and the far one 2 x 4.
 *
 * Five sizes (G2, traffic-steps.ts): so a person shrinks a step at a time as they walk
 * away, there are two more between the three size classes: 2 x 5 (a row of hair over the far
 * one's face) and 4 x 8 (the near one in small: hair, face, shoulders, hands at the sides,
 * a scarf or a vest, legs and shoes, a stride, the back, arms up). Far to near: 2 x 4,
 * 2 x 5, 2 x 6, 4 x 8, 6 x 10.
 *
 * Also here: the dog walker's dog, the ducks on the pond and the kickabout's ball. A look's
 * tones are chosen by stadium-town.ts `personLook`.
 *
 * Every sprite is a grid of letters with its bottom row on `y - 1` (the ground point is
 * the row below the feet) and column `AX` on x:
 *
 *   H hair (or the hat)  h its shade      B the bobble on a hat
 *   S skin               s skin in shade
 *   U shirt in light     T shirt          t shirt in shade
 *   C scarf              W a vest's reflective band
 *   L trousers           l their shade    K shoes
 *
 * Pure: no DOM, no clock.
 */

import type { Color } from "~/pixel";
import type { Ink, PersonLook } from "~/art/stadium-things";
import type { Step } from "~/art/traffic-steps";

/** The anchor column of the near person (6 wide: columns x - 2 to x + 3). */
export const AX = 2;
/** How tall the near person stands, without a bobble hat. */
export const NEAR_H = 10;

// ---------------------------------------------------------------------------
// The near class: a head (3 rows), a body (3) and legs (4), stacked
// ---------------------------------------------------------------------------

/** Heads seen from the front, by style: 0 short hair, 1 long hair, 2 a bobble hat. */
const HEAD_FRONT: readonly (readonly string[])[] = [
  [".hHHh.", ".SSSs.", "..Ss.."],
  [".hHHh.", "hSSSsh", "h.Ss.h"],
  ["..B...", ".HHHh.", ".SSSs.", "..Ss.."],
];
/** The same heads from behind. */
const HEAD_BACK: readonly (readonly string[])[] = [
  [".hHHh.", ".HHHh.", "..ss.."],
  [".hHHh.", "hHHHhh", "hHHHhh"],
  ["..B...", ".HHHh.", ".hhhh.", "..ss.."],
];

/** Bodies from the front, by style: 0 plain, 1 a scarf, 2 a steward's vest. */
const BODY_FRONT: readonly (readonly string[])[] = [
  ["UTTTTt", "UTTTtt", "STTTts"],
  ["UCCCCt", "UTCTtt", "STCTts"],
  ["UTTTTt", "UWWWWt", "STTTts"],
];
const BODY_BACK: readonly (readonly string[])[] = [
  ["UTTTTt", "UTTTtt", "STTTts"],
  ["UCCCCt", "UTTTtt", "STTTts"],
  ["UTTTTt", "UWWWWt", "STTTts"],
];
/** Arms up (a jump for a goal): the hands go up beside the head, the shirt narrows. */
const BODY_UP: readonly (readonly string[])[] = [
  ["UTTTTt", ".TTTt.", ".TTTt."],
  ["UCCCCt", ".TCTt.", ".TCTt."],
  ["UTTTTt", ".WWWW.", ".TTTt."],
];
/** The raised arms, drawn over the head's rows: [column, row from the top, letter]. */
const ARMS_UP: readonly (readonly [number, number, string])[] = [
  [0, 0, "S"],
  [5, 0, "s"],
  [0, 1, "U"],
  [5, 1, "t"],
  [0, 2, "U"],
  [5, 2, "t"],
];

/** Legs: standing (step 0) and striding (step 1). */
const LEGS: readonly (readonly string[])[] = [
  [".LLll.", ".LLll.", ".L..l.", "KK..KK"],
  [".LLll.", "..Ll..", "..Ll..", "..KK.."],
];

// ---------------------------------------------------------------------------
// The middle and far classes: two frames each
// ---------------------------------------------------------------------------

const MIDDLE: readonly (readonly string[])[] = [
  ["Hh", "Ss", "UT", "Tt", "Ll", "Ll"],
  ["Hh", "Ss", "UT", "Tt", "Ll", ".l"],
];
const MIDDLE_BACK: readonly (readonly string[])[] = [
  ["Hh", "Hh", "UT", "Tt", "Ll", "Ll"],
  ["Hh", "Hh", "UT", "Tt", "Ll", ".l"],
];
const FAR: readonly string[] = ["Ss", "UT", "Tt", "Ll"];
const FAR_BACK: readonly string[] = ["Hh", "UT", "Tt", "Ll"];

// ---------------------------------------------------------------------------
// The in-between steps (package G2): a person shrinks in five steps
// (traffic-steps.ts): far 2 x 4, then 2 x 5, middle 2 x 6, then 4 x 8, near 6 x 10.
// ---------------------------------------------------------------------------

/** Step 1, 2 x 5: the far one with a row of hair over the face, two frames. */
const STEP1: readonly (readonly string[])[] = [
  ["Hh", "Ss", "UT", "Tt", "Ll"],
  ["Hh", "Ss", "UT", "Tt", "L."],
];
const STEP1_BACK: readonly (readonly string[])[] = [
  ["Hh", "Hh", "UT", "Tt", "Ll"],
  ["Hh", "Hh", "UT", "Tt", "L."],
];

/** The anchor column of step 3 (4 wide: columns x - 1 to x + 2, the near one's middle). */
const AX3 = 1;
/** Step 3, 4 x 8 (9 in a hat): heads of 2 rows, by style as the near one's. */
const HEAD3_FRONT: readonly (readonly string[])[] = [
  [".Hh.", ".Ss."],
  ["hHHh", "hSsh"],
  [".B..", ".Hh.", ".Ss."],
];
const HEAD3_BACK: readonly (readonly string[])[] = [
  [".Hh.", ".Hh."],
  ["hHHh", "hHHh"],
  [".B..", ".Hh.", ".hh."],
];
/** Bodies of 3 rows (shoulders, chest, hands at the sides), by style. */
const BODY3_FRONT: readonly (readonly string[])[] = [
  ["UTTt", "UTtt", "STts"],
  ["UCCt", "UTCt", "STts"],
  ["UTTt", "UWWt", "STts"],
];
const BODY3_BACK: readonly (readonly string[])[] = [
  ["UTTt", "UTtt", "STts"],
  ["UCCt", "UTtt", "STts"],
  ["UTTt", "UWWt", "STts"],
];
const BODY3_UP: readonly (readonly string[])[] = [
  ["UTTt", ".Tt.", ".Tt."],
  ["UCCt", ".TC.", ".Tt."],
  ["UTTt", ".WW.", ".Tt."],
];
/** The raised arms over the head's two rows: [column, row from the top, letter]. */
const ARMS3_UP: readonly (readonly [number, number, string])[] = [
  [0, 0, "S"],
  [3, 0, "s"],
  [0, 1, "U"],
  [3, 1, "t"],
];
/**
 * Legs of 3 rows: standing straight (step 0: those standing about use it, and at 4 px
 * wide feet apart read as bow legs), and mid-stride, feet apart (step 1).
 */
const LEGS3: readonly (readonly string[])[] = [
  [".Ll.", ".Ll.", ".KK."],
  [".Ll.", "L..l", "K..K"],
];

function colourOf(ch: number, k: PersonLook): Color | null {
  switch (ch) {
    case 72: // H
      return k.hair;
    case 104: // h
      return k.hairDark ?? k.hair;
    case 66: // B
      return k.bobble ?? k.hair;
    case 83: // S
      return k.skin;
    case 115: // s
      return k.skinDark ?? k.skin;
    case 84: // T
      return k.shirt;
    case 116: // t
      return k.shirtDark ?? k.shirt;
    case 85: // U
      return k.shirtLight ?? k.shirt;
    case 67: // C
      return k.scarf ?? k.shirt;
    case 87: // W
      return k.band ?? k.shirt;
    case 76: // L
      return k.legs;
    case 108: // l
      return k.legsDark ?? k.legs;
    case 75: // K
      return k.shoe ?? k.legsDark ?? k.legs;
    default:
      return null;
  }
}

/** Draws `rows` with their top row on `top` and column `ax` on x. */
function stamp(
  s: Ink,
  x: number,
  top: number,
  ax: number,
  rows: readonly string[],
  k: PersonLook,
): void {
  for (let j = 0; j < rows.length; j++) {
    const row = rows[j];
    for (let i = 0; i < row.length; i++) {
      const c = colourOf(row.charCodeAt(i), k);
      if (c !== null) s.px(x + i - ax, top + j, c);
    }
  }
}

/**
 * A person standing on (x, y), at size step `size` (traffic-steps.ts: 0 far, 2 the middle
 * class, 4 near): stadium-things.ts `person`. `step` 0 or 1 swaps the
 * stride, `up` lifts them that many pixels (a jump: the two nearest sizes throw their
 * arms up), `back` shows them from behind (walking away up the screen).
 */
export function drawPerson(
  s: Ink,
  x: number,
  y: number,
  size: Step,
  k: PersonLook,
  step: number,
  up: number,
  back: boolean,
): void {
  const b = y - up;
  if (size === 0) {
    const rows = back ? FAR_BACK : FAR;
    stamp(s, x, b - rows.length, 0, rows, k);
    return;
  }
  const f = step ? 1 : 0;
  if (size === 1 || size === 2) {
    const rows = (
      size === 1 ? (back ? STEP1_BACK : STEP1) : back ? MIDDLE_BACK : MIDDLE
    )[f];
    stamp(s, x, b - rows.length, 0, rows, k);
    return;
  }
  const near = size === 4;
  const ax = near ? AX : AX3;
  const legs = (near ? LEGS : LEGS3)[f];
  const style = k.body ?? 0;
  const cheer = up > 0;
  const body = (
    near
      ? cheer
        ? BODY_UP
        : back
          ? BODY_BACK
          : BODY_FRONT
      : cheer
        ? BODY3_UP
        : back
          ? BODY3_BACK
          : BODY3_FRONT
  )[style];
  const head = (
    near ? (back ? HEAD_BACK : HEAD_FRONT) : back ? HEAD3_BACK : HEAD3_FRONT
  )[k.head ?? 0];
  const legTop = b - legs.length;
  const bodyTop = legTop - body.length;
  const headTop = bodyTop - head.length;
  stamp(s, x, legTop, ax, legs, k);
  stamp(s, x, bodyTop, ax, body, k);
  stamp(s, x, headTop, ax, head, k);
  if (cheer) {
    const arms = near ? ARMS_UP : ARMS3_UP;
    const rise = near ? 3 : 2;
    for (const [c, r, ch] of arms) {
      const col = colourOf(ch.charCodeAt(0), k);
      if (col !== null) s.px(x + c - ax, bodyTop - rise + r, col);
    }
  }
}

// ---------------------------------------------------------------------------
// The looks
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// The park: the dog, the ducks, the ball
// ---------------------------------------------------------------------------

/** The dog from the side facing right, standing and trotting: W coat, D shade, K nose. */
const DOG: readonly (readonly string[])[] = [
  ["...WK", "DWWWW", ".D.D."],
  ["...WK", "DWWWW", "D...D"],
];

/**
 * The dog walker's dog, standing on (x, y), facing right unless `left`. The far class is
 * a two-pixel dog. `step` swaps its legs.
 */
export function drawDog(
  s: Ink,
  x: number,
  y: number,
  near: boolean,
  left: boolean,
  step: number,
  coat: Color,
  shade: Color,
  nose: Color,
): void {
  if (!near) {
    s.px(x, y - 1, coat);
    s.px(left ? x + 1 : x - 1, y - 1, shade);
    return;
  }
  const g = DOG[step ? 1 : 0];
  const top = y - g.length;
  for (let j = 0; j < g.length; j++) {
    const row = g[j];
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      const c =
        ch === "W" ? coat : ch === "D" ? shade : ch === "K" ? nose : null;
      if (c === null) continue;
      // the anchor is the middle column; facing left mirrors about it
      s.px(left ? x + 2 - i : x + i - 2, top + j, c);
    }
  }
}

/** A duck on the water facing right: B body, D its shade, H head, Y beak. */
const DUCK: readonly string[] = ["..HY", "BBD."];

/** A duck on (x, y) (its waterline on row y), facing right unless `left`. */
export function drawDuck(
  s: Ink,
  x: number,
  y: number,
  left: boolean,
  body: Color,
  shade: Color,
  head: Color,
  beak: Color,
): void {
  for (let j = 0; j < DUCK.length; j++) {
    const row = DUCK[j];
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      const c =
        ch === "B"
          ? body
          : ch === "D"
            ? shade
            : ch === "H"
              ? head
              : ch === "Y"
                ? beak
                : null;
      if (c === null) continue;
      s.px(left ? x + 1 - i : x + i - 2, y - 1 + j, c);
    }
  }
}

/** The kickabout's ball: 2 x 2, lit at the top left, its top left on (x, y). */
export function drawParkBall(
  s: Ink,
  x: number,
  y: number,
  c: Color,
  shade: Color,
): void {
  s.px(x, y, c);
  s.px(x + 1, y, c);
  s.px(x, y + 1, c);
  s.px(x + 1, y + 1, shade);
}
