/**
 * The share image: a finished game on one portrait card, painted in software with the
 * game's own engine, for SHARE on the full-time card (docs/GAME_DESIGN.md 6.4,
 * docs/API_UI.md "Sharing").
 *
 *   const card = paintShareCard(picture);         // 360 x 450, one canvas pixel each
 *   const png = scaleSurface(card, SHARE_CARD.scale); // 1080 x 1350, 3 x 3 device pixels each
 *
 * From the top: the wordmark on a night sky; the mode's badge in its colour, the day and
 * the day's stadium; the seven questions, one row each (the question shortened to fit,
 * the answer or "no answer", in RETRO and NEXT-GEN the answer's year in the mode's light
 * colour, the shot as its grade-coloured tag, the points); the total on
 * a dot-matrix display, the title it earned in the mode's light colour and the career
 * tier (or PERFECT GAME); the site's name on a strip of pitch at the foot.
 *
 * The lettering is the painted faces (`font6x10`, `font10x14`). Every word comes in
 * `picture`; the painter has no text of its own (the "..." of a shortened line aside). Pure:
 * no DOM, no clock.
 */

import {
  FONT_5x7,
  Surface,
  drawText,
  font10x14,
  font6x10,
  hash2,
  measureText,
  mix,
  type Color,
  type TextOptions,
} from "~/pixel";
import type { Grade, Mode } from "~/game/types";
// Pure data (the full-time card's dot-matrix characters), so the score reads the same.
import { LED_BLANK, LED_FONT } from "~/ui/bitmaps";
import { drawLogo, logoSize } from "./logo";
import { GRADE_COLORS, MODE_COLORS, P } from "./palette";

/** The card's size in its own pixels, and the whole-number scale it is shared at. */
export const SHARE_CARD = Object.freeze({ w: 360, h: 450, scale: 3 });

/** One question's row, worded. */
export interface ShareCardLine {
  /** The question, already shortened by the words ("Club that won the Premier League"). */
  prompt: string;
  /** The answer given, or null for no answer (a pass, a time-up). */
  answer: string | null;
  /**
   * RETRO and NEXT-GEN: the year the answer was ranked by ("1889"), in the mode's light
   * colour: before the tag, or at the end of the question's line when the answer would not
   * be whole beside it (`yearPlace`). Left out in HOME and AWAY, and with no answer.
   */
  year?: string;
  grade: Grade;
  points: number;
  /** The tag's word: the shot ("TRIVELA"), or "PASSED", "TIME'S UP". */
  tag: string;
}

/** What the card says, every word from the interface text. */
export interface ShareCardPicture {
  mode: Mode;
  /** The badge: "HOME". */
  modeLabel: string;
  /** "DAY 12" */
  dayLabel: string;
  /** "Anfield", on the right of the badge's line. Left out when it does not fit. */
  stadium?: string;
  lines: readonly ShareCardLine[];
  /** In an answer's place after a pass or a time-up: "no answer". */
  noAnswer: string;
  total: number;
  /** 700 */
  maxTotal: number;
  /** The title the total earned: "SEASON TICKET HOLDER". */
  title: string;
  /** The career tier: "TOP FLIGHT". */
  tier?: string;
  /** "PERFECT GAME", only on a perfect score: a gold plate in the tier's place. */
  perfect?: string;
  /** The site's name, at the foot: "soccersense". */
  site: string;
  /** The day number, for the stars (any whole number). */
  seed?: number;
}

// ---------------------------------------------------------------------------
// Layout, in the card's pixels
// ---------------------------------------------------------------------------

/** The frame: two pixels each of lit concrete, steel and an ink seam. */
const FRAME = 6;
/** The content's left and right edge. */
const PAD_X = 12;
/** The sky behind the wordmark, from the top of the plate. */
const SKY_H = 44;
/** The badge's line. */
const META_Y = 56;
const BADGE_H = 15;
/** The rows. */
const ROWS_Y = 76;
const ROW_H = 35;
const ROW_GAP = 2;
/** Inside a row: the grade bar, the text's left edge, the right margin. */
const BAR_W = 3;
const ROW_TEXT_X = 9;
const ROW_RIGHT = 6;
/** The question's line and the answer's, from the row's top (tops of the capitals). */
const PROMPT_Y = 4;
const ANSWER_Y = 17;
/** The question's number has this much room, the prompt starts after it. */
const NUMBER_W = 13;
/** The tag: padding each side, height. */
const TAG_PAD = 3;
const TAG_H = 14;
/** The points' column: room for "100" in the big face, then a gap before the tag. */
const POINTS_W = 30;
const POINTS_GAP = 6;
const TAG_GAP = 6;
/** Between a year and the tag after it. */
const YEAR_GAP = 5;
/** The score's display: a lamp every this many pixels (one less across, a hairline between). */
const LED_PITCH = 4;
/** The lamps' rows (the full-time card's 5 x 7 characters) and the window round them. */
const LED_ROWS = 7;
const LED_PAD = 3;
/** The title: the small face doubled, unless it does not fit. */
const TITLE_SCALE = 2;
/** The pitch at the foot. */
const FOOT_H = 26;
const STRIPE_W = 20;

const ELLIPSIS = "...";

// ---------------------------------------------------------------------------

function small(): TextOptions {
  return { font: font6x10() };
}

function big(): TextOptions {
  return { font: font10x14() };
}

/**
 * `text` cut at a word so that it and "..." fit in `maxW` (at a letter when one word is
 * too long on its own). Returns the text unchanged when it fits.
 */
export function fitText(text: string, maxW: number, opts: TextOptions): string {
  if (measureText(text, opts) <= maxW) return text;
  const words = text.split(" ");
  while (words.length > 1) {
    words.pop();
    const cut = words.join(" ").replace(/[\s,.;:–-]+$/u, "");
    if (measureText(cut + ELLIPSIS, opts) <= maxW) return cut + ELLIPSIS;
  }
  let word = words[0] ?? "";
  while (word.length > 0 && measureText(word + ELLIPSIS, opts) > maxW) {
    word = word.slice(0, -1);
  }
  return word.length > 0 ? word + ELLIPSIS : "";
}

/** The answer's line: the big face if it fits, the small one if that does, else shortened. */
export function answerFace(
  text: string,
  maxW: number,
): { text: string; opts: TextOptions } {
  if (measureText(text, big()) <= maxW) return { text, opts: big() };
  if (measureText(text, small()) <= maxW) return { text, opts: small() };
  return { text: fitText(text, maxW, small()), opts: small() };
}

/** The room for a row's question, after its number. */
export function promptRoom(): number {
  return SHARE_CARD.w - PAD_X * 2 - ROW_TEXT_X - ROW_RIGHT - NUMBER_W;
}

/** The room for a row's answer, beside a tag with this word and the points (and a year). */
export function answerRoom(tag: string, year?: string): number {
  const tagW = measureText(tag, small()) + TAG_PAD * 2;
  const yearW = year ? measureText(year, small()) + YEAR_GAP : 0;
  return (
    SHARE_CARD.w -
    PAD_X * 2 -
    ROW_TEXT_X -
    ROW_RIGHT -
    POINTS_W -
    POINTS_GAP -
    tagW -
    yearW -
    TAG_GAP
  );
}

/**
 * Where a row's year goes: `beside` the answer, before the tag, when the answer is still
 * whole there (in either face); else `above`, at the end of the question's line, so the
 * answer keeps the whole room (two answers in the demo: the longest club names).
 */
export function yearPlace(
  answer: string,
  tag: string,
  year: string,
): "beside" | "above" {
  return answerFace(answer, answerRoom(tag, year)).text === answer
    ? "beside"
    : "above";
}

/** Paint the share image at its own size (`SHARE_CARD.w` x `SHARE_CARD.h`). */
export function paintShareCard(picture: ShareCardPicture): Surface {
  const { w: W, h: H } = SHARE_CARD;
  const s = new Surface(W, H);
  s.clear(P.ink);
  paintFrame(s);
  paintSky(s, picture.seed ?? 0);
  paintLogo(s);
  paintMeta(s, picture);
  const rowsBottom = paintRows(s, picture);
  paintFoot(s, picture.site);
  paintScore(s, picture, rowsBottom, H - FRAME - FOOT_H);
  return s;
}

/**
 * The lamps of a line on the score's display: the full-time card's own 5 x 7 characters
 * (`LED_FONT`), a blank lamp between them. `on[row][column]`.
 */
function ledLamps(text: string): { w: number; on: boolean[][] } {
  const on: boolean[][] = Array.from({ length: LED_ROWS }, () => []);
  Array.from(text).forEach((ch, i) => {
    const glyph = LED_FONT[ch] ?? LED_BLANK;
    for (let y = 0; y < LED_ROWS; y++) {
      if (i > 0) on[y].push(false);
      for (const cell of glyph[y] ?? ".....") on[y].push(cell === "#");
    }
  });
  return { w: on[0].length, on };
}

/** A copy `k` times bigger, every pixel a `k` x `k` block: the card as it is shared. */
export function scaleSurface(src: Surface, k: number): Surface {
  const n = Math.max(1, Math.round(k) || 1);
  const out = new Surface(src.w * n, src.h * n);
  const from = src.data;
  const to = out.data;
  const ow = out.w;
  for (let y = 0; y < src.h; y++) {
    const row = y * n * ow;
    for (let x = 0; x < src.w; x++) {
      const v = from[y * src.w + x];
      const at = row + x * n;
      for (let i = 0; i < n; i++) to[at + i] = v;
    }
    for (let j = 1; j < n; j++) {
      to.copyWithin(row + j * ow, row, row + ow);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// The parts
// ---------------------------------------------------------------------------

/** The board's frame: lit concrete, steel, an ink seam, then the night plate; four bolts. */
function paintFrame(s: Surface): void {
  const { w: W, h: H } = s;
  s.rect(0, 0, W, H, P.concreteDark);
  s.rect(0, 0, W - 2, 2, P.concrete);
  s.rect(0, 0, 2, H - 2, P.concrete);
  s.rect(2, 2, W - 4, H - 4, P.steel);
  s.rect(4, 4, W - 8, H - 8, P.ink);
  s.rect(FRAME, FRAME, W - FRAME * 2, H - FRAME * 2, P.night);
  for (const [x, y] of [
    [2, 2],
    [W - 4, 2],
    [2, H - 4],
    [W - 4, H - 4],
  ] as const) {
    s.rect(x, y, 2, 2, P.steelHi);
  }
}

/** A night sky behind the wordmark, a few stars in it, an ink rule under it. */
function paintSky(s: Surface, seed: number): void {
  const x = FRAME;
  const w = s.w - FRAME * 2;
  s.bands(x, FRAME, w, SKY_H, [P.nightTop, P.nightMid, P.nightLow], {
    dither: 2,
  });
  for (let y = FRAME + 1; y < FRAME + SKY_H - 6; y++) {
    for (let xx = x + 1; xx < x + w - 1; xx++) {
      const r = hash2(xx, y, seed);
      if (r < 0.006) s.px(xx, y, r < 0.002 ? P.chalk : P.mist);
    }
  }
  s.rect(x, FRAME + SKY_H, w, 2, P.ink);
}

/** The wordmark, one line, centred in the sky. */
function paintLogo(s: Surface): void {
  const opts = { maxWidth: s.w - PAD_X * 2 };
  const size = logoSize(opts);
  const top = FRAME + Math.max(0, Math.floor((SKY_H - size.h) / 2));
  drawLogo(s, Math.floor(s.w / 2), top, opts);
}

/** The mode's badge, the day beside it, the stadium on the right. */
function paintMeta(s: Surface, picture: ShareCardPicture): void {
  const ramp = MODE_COLORS[picture.mode];
  const label = small();
  const bw = measureText(picture.modeLabel, label) + 10;
  const x = PAD_X;
  const y = META_Y;
  // The badge: the mode's colour, a darker lip under it, ink letters (like the board's).
  s.rect(x - 1, y - 1, bw + 2, BADGE_H + 2, P.ink);
  s.rect(x, y, bw, BADGE_H, ramp.base);
  s.rect(x, y + BADGE_H - 2, bw, 2, ramp.dark);
  drawText(s, picture.modeLabel, x + 5, y + 2, P.ink, label);
  const dayX = x + bw + 8;
  const dayW = drawText(s, picture.dayLabel, dayX, y + 2, P.chalk, label);
  if (picture.stadium) {
    const room = s.w - PAD_X - (dayX + dayW + 12);
    const name = fitText(picture.stadium, room, big());
    if (name !== "" && !name.endsWith(ELLIPSIS)) {
      drawText(s, name, s.w - PAD_X, y, P.mist, { ...big(), align: "right" });
    }
  }
}

/** The seven questions. Returns the bottom of the last row. */
function paintRows(s: Surface, picture: ShareCardPicture): number {
  const x = PAD_X;
  const w = s.w - PAD_X * 2;
  let y = ROWS_Y;
  picture.lines.forEach((line, i) => {
    paintRow(s, picture, line, i + 1, x, y, w);
    y += ROW_H + ROW_GAP;
  });
  return y - ROW_GAP;
}

function paintRow(
  s: Surface,
  picture: ShareCardPicture,
  line: ShareCardLine,
  n: number,
  x: number,
  y: number,
  w: number,
): void {
  const grade = GRADE_COLORS[line.grade];
  const best = line.grade === "worldie";
  const none = line.answer === null;
  s.rect(x, y, w, ROW_H, P.ink);
  s.rect(x, y, BAR_W, ROW_H, grade);

  const left = x + ROW_TEXT_X;
  const right = x + w - ROW_RIGHT;
  const label = small();

  // RETRO and NEXT-GEN: the answer's year, beside the answer or, for a long one, above.
  const said = none ? picture.noAnswer : (line.answer ?? "");
  const year = none ? undefined : line.year;
  const place = year ? yearPlace(said, line.tag, year) : null;
  const yearColor = MODE_COLORS[picture.mode].light;

  // The question: its number in amber, then the question as far as it goes.
  drawText(s, String(n), left, y + PROMPT_Y, P.amber, label);
  const promptX = left + NUMBER_W;
  let room = promptRoom();
  if (year && place === "above") {
    drawText(s, year, right, y + PROMPT_Y, yearColor, {
      ...label,
      align: "right",
    });
    room -= measureText(year, label) + YEAR_GAP;
  }
  const prompt = fitText(line.prompt, room, label);
  drawText(s, prompt, promptX, y + PROMPT_Y, P.mist, label);

  // The points, right-aligned in the big face.
  const points = String(Math.round(line.points));
  const pointsColor = best ? P.gold : P.amber;
  drawText(s, points, right, y + ANSWER_Y, pointsColor, {
    ...big(),
    align: "right",
  });

  // The tag: ink letters on the grade's colour, standing on the answer's line.
  const tagW = measureText(line.tag, label) + TAG_PAD * 2;
  const tagX = right - POINTS_W - POINTS_GAP - tagW;
  const tagY = y + ANSWER_Y;
  s.rect(tagX, tagY, tagW, TAG_H, grade);
  s.rect(tagX, tagY + TAG_H - 1, tagW, 1, mix(grade, P.ink, 0.35));
  drawText(s, line.tag, tagX + TAG_PAD, tagY + 2, P.ink, label);

  // The year beside the answer: before the tag, on the small face's line.
  if (year && place === "beside") {
    drawText(s, year, tagX - YEAR_GAP, tagY + 2, yearColor, {
      ...label,
      align: "right",
    });
  }

  // The answer, in the room that is left.
  const face = answerFace(
    said,
    answerRoom(line.tag, place === "beside" ? year : undefined),
  );
  const color: Color = none ? P.mist : best ? P.gold : P.chalk;
  // The small face's capitals are 10 high: sit them on the big face's baseline.
  const drop = face.opts.font === font6x10() ? 4 : 0;
  drawText(s, face.text, left, y + ANSWER_Y + drop, color, face.opts);
}

/** The total on a dot-matrix display, the title under it, then the tier (or PERFECT GAME). */
function paintScore(
  s: Surface,
  picture: ShareCardPicture,
  top: number,
  bottom: number,
): void {
  const perfect = picture.perfect !== undefined;
  const score = `${Math.round(picture.total)}/${Math.round(picture.maxTotal)}`;
  const lamps = ledLamps(score);
  const ledW = lamps.w * LED_PITCH + LED_PAD * 2 - 1;
  const ledH = LED_ROWS * LED_PITCH + LED_PAD * 2 - 1;

  // The title: the small face doubled if it fits, else the big face.
  let titleOpts: TextOptions = { font: font6x10(), scale: TITLE_SCALE };
  const titleRoom = s.w - PAD_X * 2;
  if (measureText(picture.title, titleOpts) > titleRoom) titleOpts = big();
  const titleFont = titleOpts.font ?? FONT_5x7;
  const titleH = titleFont.capHeight * (titleOpts.scale ?? 1);

  const under = perfect ? picture.perfect : picture.tier;
  const underH = under ? (perfect ? TAG_H : font6x10().capHeight) : 0;

  // Spread what is left evenly round the three.
  const used = ledH + titleH + underH;
  const parts = under ? 4 : 3;
  const gap = Math.max(4, Math.floor((bottom - top - used) / parts));
  let y = top + gap;

  // The display, as the full-time card's: in a steel housing, an ink window with a lamp
  // every few pixels and a hairline between them; the unlit ones only just show.
  const ledX = Math.floor((s.w - ledW) / 2);
  s.rect(ledX - 2, y - 2, ledW + 4, ledH + 4, P.slate);
  s.rect(ledX - 2, y - 2, ledW + 3, 1, P.steel);
  s.rect(ledX - 2, y - 2, 1, ledH + 3, P.steel);
  s.rect(ledX, y, ledW, ledH, P.ink);
  const lit = perfect ? P.gold : P.amber;
  const lamp = LED_PITCH - 1;
  for (let ly = 0; ly < LED_ROWS; ly++) {
    for (let lx = 0; lx < lamps.w; lx++) {
      const on = lamps.on[ly][lx];
      const lxp = ledX + LED_PAD + lx * LED_PITCH;
      const lyp = y + LED_PAD + ly * LED_PITCH;
      s.rect(lxp, lyp, lamp, lamp, on ? lit : P.ledOff);
      // A lit lamp's glint in its top left corner.
      if (on) s.px(lxp, lyp, mix(lit, P.white, 0.45));
    }
  }
  y += ledH + gap;

  // The title, big, in the mode's light colour, on an ink shadow.
  const light = MODE_COLORS[picture.mode].light;
  drawText(s, picture.title, s.w / 2, y, light, {
    ...titleOpts,
    align: "center",
    shadow: P.ink,
  });
  y += titleH + gap;

  if (!under) return;
  const label = small();
  if (perfect) {
    const pw = measureText(under, label) + 12;
    const px = Math.floor((s.w - pw) / 2);
    s.rect(px - 1, y - 1, pw + 2, TAG_H + 2, P.ink);
    s.rect(px, y, pw, TAG_H, P.gold);
    s.rect(px, y + TAG_H - 2, pw, 2, P.goldDark);
    drawText(s, under, px + 6, y + 2, P.ink, label);
  } else {
    drawText(s, under, s.w / 2, y, P.gold, { ...label, align: "center" });
  }
}

/** A strip of pitch at the foot, a chalk touchline along it, the site's name on it. */
function paintFoot(s: Surface, site: string): void {
  const x = FRAME;
  const w = s.w - FRAME * 2;
  const y = s.h - FRAME - FOOT_H;
  for (let sx = 0; sx < w; sx += STRIPE_W) {
    const stripe = Math.floor(sx / STRIPE_W) % 2 === 0 ? P.grass : P.grassDark;
    s.rect(x + sx, y, Math.min(STRIPE_W, w - sx), FOOT_H, stripe);
  }
  s.rect(x, y, w, 2, P.ink);
  s.rect(x, y + 4, w, 2, P.chalk);
  const opts = big();
  drawText(s, site, s.w / 2, y + 10, P.chalk, {
    ...opts,
    align: "center",
    outline: P.ink,
  });
}
