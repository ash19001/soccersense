/**
 * RETRO's club grounds (tiers 2 and 3; .snaps/era-art/THEME.md, retro-low.ts for the park
 * and the street): timber lamp standards, gabled wooden stands, hand-painted boards, a
 * hand-turned scoreboard, the trainer's bench with his bucket and sponge, plank backs.
 * Called from far.ts, near.ts and end.ts where `p.era` is "retro"; today's look never
 * reaches this file. (RETRO's photographers are retro-pitch.ts's, every tier.)
 */

import { P } from "~/art/palette";
import { shade, type Color, type Surface } from "~/pixel";
import { sx, type Geo, type Paint } from "./paint";

/** Hand-painted boards on planks: sign-writers' colours, no shop-bought brights. */
export const RETRO_BOARD_LOOKS: readonly { bg: Color; fg: Color }[] = [
  { bg: P.slate, fg: P.chalk },
  { bg: P.woodDark, fg: P.chalk },
  { bg: P.brickDark, fg: P.chalk },
  { bg: P.grassDeep, fg: P.gold },
  { bg: P.night, fg: P.chalk },
  { bg: P.retroDark, fg: P.retroLight },
];

/**
 * A timber lamp standard (tier 2): a tall wooden pole, a cross-arm on two struts, and an
 * early arc lamp hung from each end, a cage round a globe; it glows at night like today's
 * poles. The pole is `x`, `x + 1`.
 */
export function paintTimberLamp(
  s: Surface,
  p: Paint,
  x: number,
  top: number,
  foot: number,
): void {
  const { S } = p;
  if (p.flood) {
    s.disc(x + 1, top + 9, 22, P.nightLow, 0.5);
    s.disc(x + 1, top + 9, 18, P.nightLow);
    s.disc(x + 1, top + 9, 13, P.nightGlow, 0.5);
    s.disc(x + 1, top + 9, 10, P.nightGlow);
  }
  s.vline(x, top, foot - top, S(P.wood));
  s.vline(x + 1, top, foot - top, S(P.woodDark));
  s.px(x, top - 1, S(shade(P.wood, 0.25)));
  // the cross-arm and its struts
  s.hline(x - 7, top + 3, 16, S(P.wood));
  s.hline(x - 7, top + 4, 16, S(P.woodDark));
  s.line(x - 5, top + 5, x - 1, top + 9, S(P.woodDark));
  s.line(x + 6, top + 5, x + 2, top + 9, S(P.woodDark));
  // the lamps hung from either end: a hood, a cage, the globe
  for (const lx of [x - 7, x + 8]) {
    s.vline(lx, top + 5, 2, S(P.night));
    s.hline(lx - 2, top + 7, 5, S(P.night));
    if (p.flood) {
      s.rect(lx - 1, top + 8, 3, 4, P.goldLight);
      s.px(lx, top + 9, P.white);
      s.px(lx, top + 10, P.white);
    } else {
      s.rect(lx - 1, top + 8, 3, 4, S(P.mist));
      s.px(lx - 1, top + 8, S(P.white));
    }
    s.px(lx - 2, top + 9, S(P.night));
    s.px(lx + 2, top + 9, S(P.night));
    s.px(lx, top + 12, S(P.night));
  }
}

/**
 * A pitched roof over a stand: corrugated iron sloping from `y` up `roofH` rows, and over
 * the middle a gable end of painted boards with bargeboards in his colour, a finial on its
 * point. `x0 .. x1` is the roof's span. Returns the gable's middle column.
 */
export function paintGable(
  s: Surface,
  p: Paint,
  x0: number,
  x1: number,
  y: number,
  peak: number,
  roofH: number,
): number {
  const { S } = p;
  const w = x1 - x0;
  // the roof: corrugations in slate, lit along each ridge of the iron
  s.rect(x0, y - roofH, w, roofH, S(P.slate));
  for (let x = x0 + 1; x < x1; x += 3) {
    s.vline(x, y - roofH + 1, roofH - 1, S(P.steel));
  }
  s.hline(x0, y - roofH, w, S(P.steelHi));
  s.hline(x0, y - 1, w, S(P.night));
  // the gable over the middle
  const cx = (x0 + x1) >> 1;
  const half = Math.min(Math.round(w * 0.22), peak * 2);
  for (let r = 0; r < peak; r++) {
    const hw = Math.round(half * (1 - r / peak));
    const yy = y - 1 - r;
    s.hline(cx - hw, yy, 2 * hw + 1, S(P.chalk));
    // the boards' seams
    if (r % 4 === 2) s.hline(cx - hw + 1, yy, 2 * hw - 1, S(P.mist));
    // the bargeboards in his colour, lit on the left slope, in shade on the right
    s.px(cx - hw - 1, yy, S(P.retro));
    s.px(cx - hw - 2, yy, S(P.retroLight));
    s.px(cx + hw + 1, yy, S(P.retroDark));
    s.px(cx + hw + 2, yy, S(P.retroDark));
  }
  s.hline(cx - half - 2, y - 1, 2 * half + 5, S(P.retroDark));
  const tip = y - 1 - peak;
  s.vline(cx, tip - 3, 3, S(P.woodDark));
  s.rect(cx - 1, tip - 5, 3, 2, S(P.gold));
  s.px(cx - 1, tip - 5, S(P.goldLight));
  return cx;
}

/** A clock in a gable: a white face, a dark ring, its hands at ten to two. (x, y) its middle. */
export function paintGableClock(
  s: Surface,
  p: Paint,
  x: number,
  y: number,
): void {
  const { S } = p;
  s.disc(x, y, 5, S(P.night));
  s.disc(x, y, 4, S(P.white));
  s.vline(x, y - 3, 4, S(P.ink));
  s.line(x, y, x + 2, y - 1, S(P.ink));
  s.line(x, y, x - 2, y - 2, S(P.ink));
}

/**
 * The hand-turned scoreboard (tier 3), on wooden legs at the corner: a black board in a
 * wooden frame under a little roof, the words of the first board painted along its top, and
 * two white number plates hung on hooks below, a ladder up its leg. `bx` its left, `top`
 * the board's top, `foot` where its legs stand.
 */
export function paintHandScoreboard(
  s: Surface,
  p: Paint,
  bx: number,
  top: number,
  foot: number,
  write: (text: string, x: number, y: number, c: Color, w: number) => void,
): void {
  const { S } = p;
  const W = 60;
  const H = 26;
  for (const lx of [bx + 8, bx + 50]) {
    s.vline(lx, top + H, foot - top - H, S(P.wood));
    s.vline(lx + 1, top + H, foot - top - H, S(P.woodDark));
  }
  // a ladder up the right leg
  s.vline(bx + 55, top + H, foot - top - H, S(P.woodDark));
  for (let y = top + H + 4; y < foot - 2; y += 5)
    s.hline(bx + 51, y, 4, S(P.wood));
  // the board: a wooden frame round black boards
  s.rect(bx, top, W, H, S(P.woodDark));
  s.hline(bx, top, W, S(P.wood));
  s.vline(bx, top, H, S(P.wood));
  s.rect(bx + 2, top + 2, W - 4, H - 4, S(P.night));
  s.hline(bx + 2, top + 10, W - 4, S(P.slate));
  // a little roof over it
  s.rect(bx - 2, top - 3, W + 4, 3, S(P.slate));
  s.hline(bx - 2, top - 3, W + 4, S(P.steel));
  const word = (p.labels.boards?.[0] ?? "").toUpperCase();
  if (word) {
    s.pushClip(bx + 2, top + 2, W - 4, 8);
    write(word, bx + 2, top + 2, S(P.chalk), W - 4);
    s.popClip();
  }
  // the number plates: white, with their figures
  const figs = ["2", "1"];
  for (let k = 0; k < 2; k++) {
    const nx = bx + 12 + k * 26;
    s.rect(nx, top + 12, 10, 12, S(P.chalk));
    s.hline(nx, top + 12, 10, S(P.white));
    s.vline(nx + 9, top + 13, 11, S(P.mist));
    s.px(nx + 4, top + 11, S(P.steel));
    s.px(nx + 5, top + 11, S(P.steel));
    write(figs[k], nx, top + 14, S(P.ink), 10);
  }
}

/**
 * Where the hand-turned scoreboard stands (tier 3): today's corner (`sx(g, 34)`), but kept
 * whole on screen on the narrowest phones (a painted board cut by the edge just looks
 * clipped, where today's scrolling lamps read as motion), and far enough in from the edge
 * that the end terrace's rake, highest at the edge, passes under its number plates.
 */
export function retroBoardX(g: Geo): number {
  return Math.min(sx(g, 34), g.w - 84);
}

/**
 * Tier 3's lamp towers where today's pylons stand: tall timber standards with their arc
 * lamps, which light the pitch at night (no pylons in RETRO).
 */
export function retroTowerLamps(s: Surface, p: Paint): void {
  const { g } = p;
  paintTimberLamp(s, p, sx(g, -62), g.F - 128, g.F - 60);
  paintTimberLamp(s, p, sx(g, 68), g.F - 128, g.F - 52);
}

/**
 * The trainer's bench seen from behind (tiers 2 and 3, where today has dugouts): a long
 * wooden bench with a slatted back, the men on it shown by their heads over the back in
 * flat caps and a bowler, a bucket with its sponge and a wicker basket beside it. (x, y)
 * is the bench's top left, `w` its length.
 */
export function paintTrainersBench(
  s: Surface,
  p: Paint,
  x: number,
  y: number,
  w: number,
): void {
  const { S } = p;
  // the heads first, behind the back: flat caps and a bowler, the ears either side
  for (let i = 6, n = 0; i < w - 8; i += 11, n++) {
    const hx = x + i;
    const skin = n % 3 === 1 ? P.skinB : P.skinA;
    s.px(hx - 1, y - 3, S(skin));
    s.px(hx + 6, y - 3, S(shade(skin, -0.2)));
    s.rect(hx, y - 4, 6, 4, S(P.hairBrown));
    if (n % 3 === 2) {
      // a bowler: a round crown and a narrow brim
      s.rect(hx, y - 9, 6, 4, S(P.night));
      s.hline(hx + 1, y - 10, 4, S(P.night));
      s.px(hx + 1, y - 9, S(P.slate));
      s.hline(hx - 1, y - 5, 8, S(P.ink));
    } else {
      // a flat cap: a low crown, its peak out of sight in front
      const cap = n % 3 === 0 ? P.wood : P.steel;
      s.hline(hx + 1, y - 7, 4, S(shade(cap, 0.2)));
      s.rect(hx, y - 6, 6, 2, S(cap));
      s.hline(hx, y - 5, 6, S(shade(cap, -0.25)));
    }
    // a coat collar
    s.hline(hx, y, 6, S(P.slate));
  }
  // the bench's back: three slats on posts, its shadow on the cinders
  s.rect(x, y + 1, w, 2, S(P.wood));
  s.hline(x, y + 1, w, S(shade(P.wood, 0.25)));
  s.rect(x, y + 5, w, 2, S(P.wood));
  s.hline(x, y + 6, w, S(P.woodDark));
  s.rect(x, y + 9, w, 2, S(P.woodDark));
  for (const px of [x, x + w - 3, x + (w >> 1)]) {
    s.rect(px, y, 3, 16, S(P.woodDark));
    s.vline(px, y, 16, S(P.wood));
  }
  s.hline(x - 2, y + 16, w + 4, S(shade(P.concrete, -0.3)));
  // the bucket and its sponge, a wicker basket
  const bx = x + w + 6;
  s.rect(bx, y + 7, 8, 9, S(P.steel));
  s.vline(bx, y + 7, 9, S(P.steelHi));
  s.vline(bx + 7, y + 8, 8, S(P.slate));
  s.hline(bx - 1, y + 6, 10, S(P.steelHi));
  s.rect(bx + 2, y + 4, 4, 3, S(P.gold));
  s.px(bx + 2, y + 4, S(P.goldLight));
  s.line(bx, y + 6, bx + 3, y + 2, S(P.slate));
  s.line(bx + 7, y + 6, bx + 4, y + 2, S(P.slate));
  const kx = bx + 14;
  s.rect(kx, y + 8, 14, 8, S(P.wood));
  for (let k = 1; k < 14; k += 2) s.vline(kx + k, y + 9, 7, S(P.woodDark));
  s.hline(kx, y + 8, 14, S(shade(P.wood, 0.3)));
  s.hline(kx + 3, y + 5, 8, S(P.woodDark));
  s.px(kx + 2, y + 6, S(P.woodDark));
  s.px(kx + 11, y + 6, S(P.woodDark));
}

/** The back of a row of boards from the near side, in RETRO: planks on a timber frame. */
export function paintPlankBacks(
  s: Surface,
  p: Paint,
  y: number,
  h: number,
): void {
  const { g, S } = p;
  s.rect(0, y, g.w, h, S(P.wood));
  s.hline(0, y, g.w, S(shade(P.wood, 0.25)));
  for (let yy = y + 4; yy < y + h - 2; yy += 4)
    s.hline(0, yy, g.w, S(P.woodDark));
  for (let x = (g.cx % 48) - 48; x < g.w; x += 48) {
    s.rect(x, y + 1, 3, h - 1, S(P.woodDark));
    s.vline(x, y + 1, h - 1, S(shade(P.wood, 0.1)));
    s.line(x + 3, y + h - 2, x + 11, y + 3, S(P.woodDark));
    s.line(x + 4, y + h - 2, x + 12, y + 3, S(P.woodDark));
  }
  s.hline(0, y + h - 1, g.w, S(P.woodDark));
  s.hline(0, y + h, g.w, S(P.night));
  s.hline(0, y + h + 1, g.w, S(shade(P.night, 0.1)));
}
