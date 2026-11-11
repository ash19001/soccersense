/**
 * The soccersense wordmark, drawn at the top of the home screen over the sky.
 *
 * Custom block lettering, 12 px tall: 3 px stems, 2 px bars, clipped corners. The O of
 * SOCCER is a little football. Chalk faces sit on one solid ink plate with a hard drop
 * shadow, so the word reads over any sky from noon to midnight.
 *
 *   const opts = { maxWidth: 104, maxHeight: m.logo.h, t, tagline };
 *   const size = logoSize(opts);
 *   drawLogo(s, m.cx, Math.floor((m.logo.h - size.h) / 2), opts);
 *
 * Two layouts from the same letters: one line (132 x 17) when `maxWidth` has room for
 * it, otherwise SOCCER over SENSE (74 x 31). Sizes include the 2 px shadow, which hangs
 * off the right and the bottom; the letters themselves are centred on `cx`. The tagline
 * is an amber line on an ink strip fixed under the plate, 7 rows taller.
 *
 * Everything is raw palette colour: the wordmark is interface, not scenery, so it is not
 * graded by the lighting.
 */

import {
  FONT_3x5,
  Surface,
  drawText,
  measureText,
  sprite,
  type Color,
  type Sprite,
} from "~/pixel";
import { P } from "./palette";

export interface LogoOptions {
  /** The widest the logo may be. Decides the layout: one line if it fits, else stacked. */
  maxWidth: number;
  /** The tallest it may be. Only used to decide whether the tagline has room. */
  maxHeight?: number;
  /** Seconds, for the glint. Default 0 (no glint showing). */
  t?: number;
  /** A small line under the wordmark, drawn only when it fits. */
  tagline?: string;
  /** No glint at all. */
  reducedMotion?: boolean;
}

// ---------------------------------------------------------------------------
// The letters
// ---------------------------------------------------------------------------

// '#' face, 's' the ball's shaded side, 'm' a seam, 'p' a patch.
const LEGEND = "#smp";
const CAP_H = 12;

const GLYPHS: Readonly<Record<string, Sprite>> = {
  S: sprite(
    `
.########.
##########
###....###
###.......
###.......
#########.
.#########
.......###
.......###
###....###
##########
.########.
`,
    LEGEND,
  ),
  // The ball: a pixel taller than the capitals, standing on their baseline.
  O: sprite(
    `
....#ppp#....
..####m####..
.#####m#####.
.#####p#####.
p###ppppp###p
pmm#ppppp#mmp
#####ppp####s
####m###m###s
###m#####m#ss
.#p#######ps.
.pp#######pp.
..p#####ssp..
....##sss....
`,
    LEGEND,
  ),
  C: sprite(
    `
.########.
##########
###....###
###....###
###.......
###.......
###.......
###.......
###....###
###....###
##########
.########.
`,
    LEGEND,
  ),
  E: sprite(
    `
#########
#########
###......
###......
###......
#######..
#######..
###......
###......
###......
#########
#########
`,
    LEGEND,
  ),
  R: sprite(
    `
########..
#########.
###....###
###....###
###....###
#########.
########..
###.###...
###..###..
###...###.
###....###
###....###
`,
    LEGEND,
  ),
  N: sprite(
    `
####...###
####...###
#####..###
#####..###
######.###
######.###
###.######
###.######
###..#####
###..#####
###...####
###...####
`,
    LEGEND,
  ),
};

/** Ink columns between two letters. The ball is round, so it sits a pixel closer. */
function gap(a: string, b: string): number {
  return a === "O" || b === "O" ? 1 : 2;
}
/** Ink rows between the two lines of the stacked layout. */
const LINE_GAP = 2;
/** The drop shadow: this many pixels down and right. */
const SHADOW = 2;
/** The top rows of each letter catch the light. */
const TOP_ROWS = 1;
/** The bottom rows of each letter are a tone darker: the light comes from above. */
const FOOT_ROWS = 2;

// What each pixel of the built logo is, as stored in `Built.tone`.
const NONE = 0;
const FACE = 1;
const FOOT = 2;
const TOP = 3;
const BALL_WHITE = 4;
const BALL_SHADE = 5;
const SEAM = 6;
const PATCH = 7;
const PLATE = 8;

/** Glyph cell value (legend index + 1) to tone, for the ball. */
const BALL_TONES = [NONE, BALL_WHITE, BALL_SHADE, SEAM, PATCH];

const TONE_COLORS: readonly Color[] = [
  P.ink,
  P.chalk,
  P.steelHi,
  P.white,
  P.white,
  P.mist,
  P.mist,
  P.slate,
  P.ink,
];

/** What the glint turns each tone into: one step up its ramp. `undefined`: no change. */
const GLINT_COLORS: readonly (Color | undefined)[] = [
  undefined,
  P.white,
  P.chalk,
  undefined,
  undefined,
  P.white,
  undefined,
  undefined,
  P.slate,
];

interface Built {
  /** Size with the shadow. */
  w: number;
  h: number;
  /** Shadow, plate and faces, ready to blit. */
  art: Surface;
  /** One tone per pixel, for the glint. */
  tone: Uint8Array;
}

function build(lines: readonly string[]): Built {
  let over = 0;
  const widths = lines.map((line) => {
    let w = 0;
    for (let i = 0; i < line.length; i++) {
      const g = GLYPHS[line[i]];
      w += g.w + (i > 0 ? gap(line[i - 1], line[i]) : 0);
      over = Math.max(over, g.h - CAP_H);
    }
    return w;
  });
  const inner = Math.max(...widths);
  const w = inner + 2 + SHADOW;
  const h = over + lines.length * (CAP_H + LINE_GAP) - LINE_GAP + 2 + SHADOW;
  const tone = new Uint8Array(w * h);
  const plate = new Uint8Array(w * h);

  lines.forEach((line, row) => {
    const x0 = 1 + Math.floor((inner - widths[row]) / 2);
    const y0 = 1 + over + row * (CAP_H + LINE_GAP);
    // One solid slab behind the row and a pixel above and below it, so no sky shows
    // inside or between letters and the plate's edges run straight.
    for (let j = -1; j <= CAP_H; j++) {
      for (let i = 0; i < widths[row]; i++) plate[(y0 + j) * w + x0 + i] = 1;
    }
    let x = x0;
    for (let n = 0; n < line.length; n++) {
      const ch = line[n];
      const g = GLYPHS[ch];
      const cells = g.frames[0];
      if (n > 0) x += gap(line[n - 1], ch);
      const y = y0 + CAP_H - g.h;
      for (let j = 0; j < g.h; j++) {
        for (let i = 0; i < g.w; i++) {
          const v = cells[j * g.w + i];
          if (v === 0) continue;
          let t = FACE;
          if (ch === "O") t = BALL_TONES[v];
          else if (j < TOP_ROWS) t = TOP;
          else if (j >= CAP_H - FOOT_ROWS) t = FOOT;
          tone[(y + j) * w + x + i] = t;
        }
      }
      x += g.w;
    }
  });

  // The plate also follows every painted pixel, grown by one: the ink outline.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (tone[y * w + x] === NONE) continue;
      plate[y * w + x] = 1;
      if (x > 0) plate[y * w + x - 1] = 1;
      if (x < w - 1) plate[y * w + x + 1] = 1;
      if (y > 0) plate[(y - 1) * w + x] = 1;
      if (y < h - 1) plate[(y + 1) * w + x] = 1;
    }
  }

  const art = new Surface(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (plate[y * w + x] === 0) continue;
      if (tone[y * w + x] === NONE) tone[y * w + x] = PLATE;
      for (let d = 0; d <= SHADOW; d++) art.px(x + d, y + d, P.ink);
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = tone[y * w + x];
      if (v !== NONE) art.px(x, y, TONE_COLORS[v]);
    }
  }
  return { w, h, art, tone };
}

let stackedArt: Built | undefined;
let lineArt: Built | undefined;

function built(stacked: boolean): Built {
  if (stacked) return (stackedArt ??= build(["SOCCER", "SENSE"]));
  return (lineArt ??= build(["SOCCERSENSE"]));
}

// ---------------------------------------------------------------------------
// The tagline: amber on an ink strip, like a scoreboard ticker, fixed under the plate
// ---------------------------------------------------------------------------

const TAG = { font: FONT_3x5, align: "center" } as const;
/** Ink columns either side of the tagline's text. */
const TAG_PAD = 2;
/** The strip: the text's 5 rows and one ink row above and below. */
const TAG_H = 7;

interface Plan {
  art: Built;
  stacked: boolean;
  w: number;
  h: number;
  tagline: string | undefined;
}

function plan(opts: LogoOptions): Plan {
  const stacked = built(false).w > opts.maxWidth;
  const art = built(stacked);
  let w = art.w;
  let h = art.h;
  let tagline: string | undefined;
  if (opts.tagline !== undefined && opts.tagline !== "") {
    const tw = measureText(opts.tagline, TAG) + 2 * TAG_PAD + SHADOW;
    const th = art.h + TAG_H;
    if (tw <= opts.maxWidth && th <= (opts.maxHeight ?? Infinity)) {
      tagline = opts.tagline;
      w = Math.max(w, tw);
      h = th;
    }
  }
  return { art, stacked, w, h, tagline };
}

/** The size `drawLogo` will draw at with the same options, and which layout it picks. */
export function logoSize(opts: LogoOptions): {
  w: number;
  h: number;
  stacked: boolean;
} {
  const p = plan(opts);
  return { w: p.w, h: p.h, stacked: p.stacked };
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

/** A streak of light crosses the plate once every this many seconds. */
const GLINT_PERIOD = 6;
/** The first crossing starts this many seconds in. */
const GLINT_START = 2;
/** Seconds one crossing takes. */
const GLINT_TIME = 0.9;
/** Steps per second: the streak moves in whole jumps. */
const GLINT_FPS = 20;
/** The streak is this many pixels wide. */
const GLINT_W = 2;

/**
 * Draw the wordmark centred on column `cx` with its top row at `top`. Returns the size it
 * drew at (the same as `logoSize`).
 */
export function drawLogo(
  s: Surface,
  cx: number,
  top: number,
  opts: LogoOptions,
): { w: number; h: number } {
  const p = plan(opts);
  const { art } = p;
  cx = Math.round(cx);
  top = Math.round(top);
  // The faces are centred, the shadow hangs off to the right.
  const x0 = cx - Math.floor((art.w - SHADOW) / 2);

  s.blit(art.art, x0, top);

  if (p.tagline !== undefined) {
    const tw = measureText(p.tagline, TAG);
    const bw = tw + 2 * TAG_PAD;
    const bx = cx - Math.floor(tw / 2) - TAG_PAD;
    const by = top + art.h - SHADOW;
    for (let d = SHADOW; d >= 0; d--) s.rect(bx + d, by + d, bw, TAG_H, P.ink);
    drawText(s, p.tagline, cx, by + 1, P.amber, TAG);
  }

  // The glint: a streak that lifts every tone it crosses one step up its ramp. It starts
  // wholly off the left edge and ends wholly off the right, leaning like a slash.
  const t = opts.t ?? 0;
  const phase = t >= GLINT_START ? (t - GLINT_START) % GLINT_PERIOD : Infinity;
  if (opts.reducedMotion !== true && phase < GLINT_TIME) {
    const steps = Math.round(GLINT_TIME * GLINT_FPS);
    const step = Math.min(steps - 1, Math.floor(phase * GLINT_FPS));
    const span = art.w + art.h + GLINT_W;
    const g = Math.round((step / (steps - 1)) * span) - GLINT_W;
    for (let y = 0; y < art.h; y++) {
      for (let k = 0; k < GLINT_W; k++) {
        const x = g - y + k;
        if (x < 0 || x >= art.w) continue;
        const c = GLINT_COLORS[art.tone[y * art.w + x]];
        if (c !== undefined) s.px(x0 + x, top + y, c);
      }
    }
  }
  return { w: p.w, h: p.h };
}
