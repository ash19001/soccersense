/**
 * The soccersense wordmark, drawn at the top of the home screen over the sky.
 *
 * Custom block lettering, 24 px tall: 6 px stems and 4 px bars, chamfered corners and
 * filleted counters, a 1 px bevel (lit on the top and left, shaded on the bottom and right)
 * over two bands (a lit top, a darker foot). The O of SOCCER is the menu's ball, 26 px
 * across. Chalk faces sit on one solid ink plate, 2 px round every letter, with a hard 4 px
 * drop shadow, so the word reads over any sky from noon to midnight.
 *
 *   const opts = { maxWidth: 104, maxHeight: m.logo.h, t, tagline };
 *   const size = logoSize(opts);
 *   drawLogo(s, m.cx, Math.floor((m.logo.h - size.h) / 2), opts);
 *
 * Two layouts from the same letters: one line (264 x 34) when `maxWidth` has room for
 * it, otherwise SOCCER over SENSE (148 x 62). Sizes include the 4 px shadow, which hangs
 * off the right and the bottom; the letters themselves are centred on `cx`. The tagline
 * is an amber line on an ink strip fixed under the plate, 14 rows taller.
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
  type TextOptions,
} from "~/pixel";
import { paintedFont } from "./lettering";
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

/** Ink rows between the two lines of the stacked layout. */
const LINE_GAP = 4;
/** The drop shadow: this many pixels down and right. */
const SHADOW = 4;

interface Built {
  /** Size with the shadow. */
  w: number;
  h: number;
  /** Shadow, plate and faces, ready to blit. */
  art: Surface;
  /** One tone per pixel, for the glint. */
  tone: Uint8Array;
}

// Built once per layout, on first use.
const builtArt: { stacked?: Built; line?: Built } = {};

function built(stacked: boolean): Built {
  if (stacked) return (builtArt.stacked ??= build(["SOCCER", "SENSE"]));
  return (builtArt.line ??= build(["SOCCERSENSE"]));
}

const GLYPHS: Readonly<Record<string, Sprite>> = {
  S: sprite(
    `
...##############...
..################..
.##################.
####################
#######......#######
######........######
######..............
######..............
######..............
#######.............
##################..
.##################.
.##################.
..##################
.............#######
..............######
..............######
..............######
######........######
#######......#######
####################
.##################.
..################..
...##############...
`,
    "#",
  ),
  C: sprite(
    `
...##############...
..################..
.##################.
####################
#######......#######
######........######
######........######
######........######
######..............
######..............
######..............
######..............
######..............
######..............
######..............
######..............
######........######
######........######
######........######
#######......#######
####################
.##################.
..################..
...##############...
`,
    "#",
  ),
  E: sprite(
    `
##################
##################
##################
##################
#######...........
######............
######............
######............
######............
#######...........
##############....
##############....
##############....
##############....
#######...........
######............
######............
######............
######............
#######...........
##################
##################
##################
##################
`,
    "#",
  ),
  R: sprite(
    `
################....
#################...
##################..
###################.
#######......#######
######........######
######........######
######........######
######........######
#######......#######
###################.
##################..
#################...
################....
######..######......
######..######......
######...######.....
######....######....
######.....######...
######......######..
######.......######.
######........######
######........######
######........######
`,
    "#",
  ),
  N: sprite(
    `
########......######
########......######
#########.....######
#########.....######
##########....######
##########....######
###########...######
###########...######
###########...######
############..######
############..######
######.######.######
######.######.######
######..############
######..############
######...###########
######...###########
######...###########
######....##########
######....##########
######.....#########
######.....#########
######......########
######......########
`,
    "#",
  ),
};

/** The capitals' height, and the ball's diameter (it stands 2 px taller). */
const CAP_H = 24;
const BALL_D = 26;

// Tones: indices into TONE_COLORS (0 is nothing, 8 the ink plate).
const T_WHITE = 1;
const T_CHALK = 2;
const T_STEELHI = 3;
const T_PLATE = 8;
const TONE_COLORS: readonly Color[] = [
  P.ink,
  P.white,
  P.chalk,
  P.steelHi,
  P.mist,
  P.steel,
  P.slate,
  P.night,
  P.ink,
];
/** The glint lifts every tone one step up its ramp (white stays white). */
const GLINT_COLORS: readonly (Color | undefined)[] = [
  undefined,
  undefined,
  P.white,
  P.chalk,
  P.steelHi,
  P.mist,
  P.steel,
  P.slate,
  P.slate,
];

/**
 * The O: a letter first and a ball second. A disc 26 px
 * across (2 px taller than the capitals, on their baseline) in the capitals' chalk, lit on
 * its top left and a tone darker on its bottom right like their bands; its counter is the
 * ball's front pentagon, point up, dark and a little above the middle, where an O's hole is;
 * five seams run out from its corners to the neighbouring pentagons, which show only as
 * dark caps round the rim. Its ink outline is the plate's. As tones (TONE_COLORS).
 */
function oTones(): Uint8Array {
  const d = BALL_D;
  const c = (d - 1) / 2;
  const r = d / 2;
  const NIGHT = TONE_COLORS.indexOf(P.night);
  const SLATE = TONE_COLORS.indexOf(P.slate);
  const MIST = TONE_COLORS.indexOf(P.mist);
  const STEEL = TONE_COLORS.indexOf(P.steel);
  const out = new Uint8Array(d * d);
  // the counter: the front pentagon
  const pc = { x: c, y: c - O_LIFT };
  const corners = [0, 1, 2, 3, 4].map((k) => {
    const a = -Math.PI / 2 + (k * 2 * Math.PI) / 5;
    return {
      x: pc.x + O_PENT * Math.cos(a),
      y: pc.y + O_PENT * Math.sin(a),
      a,
    };
  });
  const inPent = (x: number, y: number): boolean =>
    corners.every((p, i) => {
      const q = corners[(i + 1) % 5];
      return (q.x - p.x) * (y - p.y) - (q.y - p.y) * (x - p.x) >= 0;
    });
  // the neighbours beyond each corner, seen edge on at the rim
  const inCap = (x: number, y: number): boolean =>
    corners.some((p) => {
      const ux = Math.cos(p.a);
      const uy = Math.sin(p.a);
      const dx = x - (pc.x + ux * O_CAP_AT);
      const dy = y - (pc.y + uy * O_CAP_AT);
      const along = dx * ux + dy * uy;
      const across = dy * ux - dx * uy;
      return (along / O_CAP_DEEP) ** 2 + (across / O_CAP_WIDE) ** 2 <= 1;
    });
  for (let y = 0; y < d; y++) {
    for (let x = 0; x < d; x++) {
      if ((x - c) ** 2 + (y - c) ** 2 > r * r - 2) continue;
      const i = y * d + x;
      if (inPent(x, y)) {
        out[i] = NIGHT;
        continue;
      }
      // the neighbours at the rim a tone lighter, so the ball keeps its round edge on the plate
      if (inCap(x, y)) {
        out[i] = SLATE;
        continue;
      }
      // towards the light (top left): 1 at the lit rim, -1 at the shaded one
      const lit = -(x - c + (y - c)) / (r * Math.SQRT2);
      let t = T_CHALK;
      if (lit > 0.7) t = T_WHITE;
      else if (lit < -0.78) t = MIST;
      else if (lit < -0.42) t = T_STEELHI;
      // the capitals' foot band
      if (y >= d - 4 && t === T_CHALK) t = T_STEELHI;
      out[i] = t;
    }
  }
  // the seams, from each corner of the counter out to its neighbour
  for (const p of corners) {
    const ux = Math.cos(p.a);
    const uy = Math.sin(p.a);
    for (let k = 0.5; k < O_CAP_AT - O_PENT; k += 0.25) {
      const i = Math.round(p.y + uy * k) * d + Math.round(p.x + ux * k);
      const v = out[i];
      if (v === T_WHITE || v === T_CHALK) out[i] = MIST;
      else if (v === T_STEELHI || v === MIST) out[i] = STEEL;
    }
  }
  // the dark patches catch the light along their top-left edges
  const was = out.slice();
  for (let y = 1; y < d; y++) {
    for (let x = 1; x < d; x++) {
      const i = y * d + x;
      if (was[i] !== NIGHT || x + y > d - 2) continue;
      const lit = (v: number): boolean => v === T_WHITE || v === T_CHALK;
      if (lit(was[i - d]) || lit(was[i - 1])) out[i] = SLATE;
    }
  }
  return out;
}
/** The counter's size (the pentagon's corners from its middle), and how far above the middle. */
const O_PENT = 6.4;
const O_LIFT = 0.5;
/** Where the neighbouring pentagons sit (from the counter's middle), how deep and wide. */
const O_CAP_AT = 14.6;
const O_CAP_DEEP = 3.2;
const O_CAP_WIDE = 4.8;

function build(lines: readonly string[]): Built {
  const gap = (a: string, b: string): number =>
    a === "O" || b === "O" ? 2 : 4;
  const lineGap = LINE_GAP;
  const shadow = SHADOW;
  const over = BALL_D - CAP_H;
  const widthOf = (ch: string): number => (ch === "O" ? BALL_D : GLYPHS[ch].w);
  const widths = lines.map((line) => {
    let w = 0;
    for (let i = 0; i < line.length; i++) {
      w += widthOf(line[i]) + (i > 0 ? gap(line[i - 1], line[i]) : 0);
    }
    return w;
  });
  const inner = Math.max(...widths);
  const w = inner + 4 + shadow;
  const h = over + lines.length * (CAP_H + lineGap) - lineGap + 4 + shadow;
  const tone = new Uint8Array(w * h);
  const plate = new Uint8Array(w * h);
  const ball = oTones();

  lines.forEach((line, row) => {
    const x0 = 2 + Math.floor((inner - widths[row]) / 2);
    const y0 = 2 + over + row * (CAP_H + lineGap);
    for (let j = -2; j <= CAP_H + 1; j++) {
      for (let i = 0; i < widths[row]; i++) plate[(y0 + j) * w + x0 + i] = 1;
    }
    let x = x0;
    for (let n = 0; n < line.length; n++) {
      const ch = line[n];
      if (n > 0) x += gap(line[n - 1], ch);
      if (ch === "O") {
        const y = y0 + CAP_H - BALL_D;
        for (let j = 0; j < BALL_D; j++) {
          for (let i = 0; i < BALL_D; i++) {
            const v = ball[j * BALL_D + i];
            if (v !== 0) tone[(y + j) * w + x + i] = v;
          }
        }
        x += BALL_D;
        continue;
      }
      const g = GLYPHS[ch];
      const cells = g.frames[0];
      const at = (i: number, j: number): boolean =>
        i >= 0 && j >= 0 && i < g.w && j < g.h && cells[j * g.w + i] !== 0;
      for (let j = 0; j < g.h; j++) {
        for (let i = 0; i < g.w; i++) {
          if (!at(i, j)) continue;
          // the bands, and a 1 px bevel round every edge
          let t = T_CHALK;
          if (j < 2) t = T_WHITE;
          else if (j >= CAP_H - 4) t = T_STEELHI;
          if (!at(i, j - 1) || !at(i - 1, j)) t = T_WHITE;
          if (!at(i, j + 1) || !at(i + 1, j)) t = T_STEELHI;
          if (j >= CAP_H - 4 && (!at(i, j + 1) || !at(i + 1, j))) {
            t = TONE_COLORS.indexOf(P.mist);
          }
          tone[(y0 + j) * w + x + i] = t;
        }
      }
      x += g.w;
    }
  });

  // The plate also follows every painted pixel, grown by two: the ink outline.
  let from = Uint8Array.from(tone, (v) => (v === 0 ? 0 : 1));
  for (let pass = 0; pass < 2; pass++) {
    const grown = from.slice();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const k = y * w + x;
        if (from[k] === 0) continue;
        if (x > 0) grown[k - 1] = 1;
        if (x < w - 1) grown[k + 1] = 1;
        if (y > 0) grown[k - w] = 1;
        if (y < h - 1) grown[k + w] = 1;
      }
    }
    from = grown;
  }
  for (let k = 0; k < w * h; k++) if (from[k] === 1) plate[k] = 1;

  const art = new Surface(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (plate[y * w + x] === 0) continue;
      if (tone[y * w + x] === 0) tone[y * w + x] = T_PLATE;
      for (let d = 0; d <= shadow; d++) art.px(x + d, y + d, P.ink);
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = tone[y * w + x];
      if (v !== 0) art.px(x, y, TONE_COLORS[v]);
    }
  }
  return { w, h, art, tone };
}

// ---------------------------------------------------------------------------
// The tagline: amber on an ink strip, like a scoreboard ticker, fixed under the plate
// ---------------------------------------------------------------------------

/** Ink columns either side of the tagline's text. */
const TAG_PAD = 4;
/** The strip: the text's 10 rows and two ink rows above and below. */
const TAG_H = 14;

let tagOptions: TextOptions | undefined;
/** The tagline's text options: the small painted face, made on first use. */
function tagOpts(): TextOptions {
  return (tagOptions ??= { font: paintedFont(FONT_3x5), align: "center" });
}

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
    const tw = measureText(opts.tagline, tagOpts()) + 2 * TAG_PAD + SHADOW;
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
const GLINT_W = 4;

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
  const shadow = SHADOW;
  const x0 = cx - Math.floor((art.w - shadow) / 2);

  s.blit(art.art, x0, top);

  if (p.tagline !== undefined) {
    const tag = tagOpts();
    const pad = TAG_PAD;
    const tagH = TAG_H;
    const tw = measureText(p.tagline, tag);
    const bw = tw + 2 * pad;
    const bx = cx - Math.floor(tw / 2) - pad;
    const by = top + art.h - shadow;
    for (let d = shadow; d >= 0; d--) s.rect(bx + d, by + d, bw, tagH, P.ink);
    drawText(s, p.tagline, cx, by + 2, P.amber, tag);
  }

  // The glint: a streak that lifts every tone it crosses one step up its ramp. It starts
  // wholly off the left edge and ends wholly off the right, leaning like a slash.
  const t = opts.t ?? 0;
  const phase = t >= GLINT_START ? (t - GLINT_START) % GLINT_PERIOD : Infinity;
  if (opts.reducedMotion !== true && phase < GLINT_TIME) {
    const glintW = GLINT_W;
    const glints = GLINT_COLORS;
    const steps = Math.round(GLINT_TIME * GLINT_FPS);
    const step = Math.min(steps - 1, Math.floor(phase * GLINT_FPS));
    const span = art.w + art.h + glintW;
    const g = Math.round((step / (steps - 1)) * span) - glintW;
    for (let y = 0; y < art.h; y++) {
      for (let k = 0; k < glintW; k++) {
        const x = g - y + k;
        if (x < 0 || x >= art.w) continue;
        const c = glints[art.tone[y * art.w + x]];
        if (c !== undefined) s.px(x0 + x, top + y, c);
      }
    }
  }
  return { w: p.w, h: p.h };
}
