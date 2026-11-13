/**
 * The stadium (tiers 4 to 7), the far side: a packed two-tier stand with boxes, a roof, a
 * camera gantry and LED boards along the far touchline; at tier 5 dressed for an
 * international (flags, banners, scarves); at tier 6 the World Cup final at night
 * (flashes, giant flags, beams); at tier 7 the same with fireworks. The near side is
 * near.ts's, the end behind the goal end.ts's, the photographers and the podium pitch.ts's.
 *
 * Heights are rows above the far touchline (`STAND`, stand.ts); horizontal places come
 * from the stage (`sx`), which scales with the canvas. The crowd's blocks of fans and
 * aisles are crowd.ts's.
 */

import { drawLamps } from "~/art/led";
import { ledText, paintedFont } from "~/art/lettering";
import { P } from "~/art/palette";
import {
  FONT_3x5,
  Surface,
  TRANSPARENT,
  drawSprite,
  drawText,
  measureText,
  mix,
  shade,
  sprite,
  type Color,
  type Sprite,
  type TextOptions,
} from "~/pixel";
import { aisles, fanBlock } from "./crowd";
import { endFlags, endFor, endRoofAt } from "./end";
import type { Life } from "./life";
import {
  HAIR,
  SKIN,
  crowdColors,
  crowdShirts,
  pick,
  rnd,
  sx,
  type Paint,
} from "./paint";
import { STAND } from "./stand";
import { paintRetroStadium } from "./retro-high";
import { paintArena } from "./nextgen-high";

/** A sprite built on first use. */
function lazy(make: () => Sprite): () => Sprite {
  let made: Sprite | null = null;
  return () => (made ??= make());
}

/** Fill a colour array for a sprite's legend from a map of its characters. */
function colorsFor(sp: Sprite, by: Readonly<Record<string, Color>>): Color[] {
  return Array.from(sp.legend, (k) => by[k] ?? TRANSPARENT);
}

// ---------------------------------------------------------------------------
// The far side: the big stand and the stadium
// ---------------------------------------------------------------------------

/**
 * Letters (.snaps/detail2/DECISIONS.md 1): lamps are the small font as lamps (`drawLamps`,
 * the same lettering as the airship's sign and the scoreboard: a hot lamp, light between
 * lamps, a faint glow beside them); painted words are the painted font (`paintedFont`).
 */
const led = (): TextOptions => ledText(FONT_3x5);
let painted: TextOptions | null = null;
const paint = (): TextOptions => (painted ??= { font: paintedFont(FONT_3x5) });

interface BoardLook {
  bg: Color;
  fg: Color;
}

/**
 * A camera operator on the gantry, side on, his eye to the viewfinder of a big broadcast
 * camera on a tripod, pointing right. 18 x 14, standing on the row under it.
 *
 * h hair, s skin, z skin's shade, j jacket, J its lit side, p trousers, e shoes,
 * k camera body, K its lit top, l lens, L the lens's glint, r the red tally lamp,
 * t tripod, n headphones.
 */
const OPERATOR = lazy(() =>
  sprite(
    `
    ..hhh.............
    .hhhhn.KKKKKKKr...
    .hhzsn.kkkkkkkklL.
    ..hzss.kkkkkkkkll.
    ..Jjzs.kkkkkkkkll.
    .JJjjjjkkkkkkk....
    .JJjjjjj.Ktt......
    .Jjjjjj..tKt......
    ..jjjj..t.t.t.....
    ..pp.p..t.t.t.....
    ..pp.pp.t..t.t....
    ..pp..p.t..t.t....
    ..pp..p.t..t..t...
    .eee..eet..t..t...
    `,
    "hszjJpekKlLrtn",
  ),
);

function bigStand(
  s: Surface,
  p: Paint,
  life: Life,
  x0: number,
  x1: number,
  gantry: boolean,
): void {
  const { g, S } = p;
  const F = g.F;
  const st = STAND;
  const w = x1 - x0;
  if (w <= 0) return;

  // under the roof: a dark band with the roof's girders
  s.rect(x0, F - st.upperTop - 4, w, 4, S(P.night));
  // upper tier: six rows of D's fans (48 px), in the roof's shadow at the back
  s.rect(x0, F - st.upperTop, w, st.upperTop - st.balcony, S(P.night));
  fanBlock(s, p, life, {
    x0,
    x1,
    y: F - st.upperTop,
    rows: 6,
    seat: S(P.night),
    empty: 0,
    shadowRows: 2,
  });
  aisles(s, p, x0, x1, F - st.upperTop + 8, F - st.balcony, 96);

  // the balcony: a lit lip, its face, a shadow under it
  const by = F - st.balcony;
  s.hline(x0, by, w, S(P.steelHi));
  s.hline(x0, by + 1, w, S(P.concreteLight));
  s.hline(x0, by + 2, w, S(P.concrete));
  s.hline(x0, by + 3, w, S(P.concreteDark));

  // the strip of boxes: glass in frames, some lit at night, people watching from some
  const bx = F - st.boxes;
  s.rect(x0, bx, w, 10, S(P.ink));
  s.hline(x0, bx, w, S(P.night));
  const pitch = 12;
  const shirts = crowdShirts(p);
  for (
    let x = x0 + ((((g.cx - x0) % pitch) + pitch) % pitch) - pitch;
    x < x1;
    x += pitch
  ) {
    const r = rnd(p, x, 40, 41);
    const lit = p.lamps && r > 0.3;
    const wy = bx + 2;
    const glass = lit
      ? r < 0.6
        ? P.goldLight
        : P.gold
      : S(r < 0.5 ? P.steel : P.slate);
    s.rect(x, wy, 10, 6, glass);
    if (rnd(p, x, 42, 41) < 0.6) {
      // someone in the box: head and shoulders against the glass
      const hx = x + 2 + Math.floor(rnd(p, x, 43, 41) * 5);
      const skin = S(pick(SKIN, rnd(p, x, 44, 41)));
      const hair = S(pick(HAIR, rnd(p, x, 45, 41)));
      const shirt = S(pick(shirts, rnd(p, x, 46, 41)));
      s.hline(hx, wy + 1, 2, hair);
      s.rect(hx, wy + 2, 2, 2, skin);
      s.px(hx - 1, wy + 2, hair);
      s.rect(hx - 1, wy + 4, 4, 2, shirt);
      s.px(hx + 2, wy + 4, S(shade(pick(shirts, rnd(p, x, 46, 41)), -0.3)));
    }
    if (!lit) {
      // the sky's reflection across the glass, top left
      s.px(x, wy, S(P.mist));
      s.px(x + 1, wy, S(P.mist));
      s.px(x, wy + 1, S(P.mist));
    }
    // the frame between two boxes, and the sill
    s.vline(x + 10, wy - 1, 8, S(P.night));
    s.vline(x + 11, wy - 1, 8, S(P.slate));
    s.hline(x, wy + 6, 10, S(P.night));
  }
  s.hline(x0, F - st.lowerTop - 2, w, S(P.concreteDark));
  s.hline(x0, F - st.lowerTop - 1, w, S(P.concreteDark));

  // lower tier
  s.rect(x0, F - st.lowerTop, w, st.lowerTop - st.boards, S(P.concreteDark));
  fanBlock(s, p, life, {
    x0,
    x1,
    y: F - st.lowerTop,
    rows: 6,
    seat: S(P.concreteDark),
    empty: 0,
    shadowRows: 0,
  });
  aisles(s, p, x0, x1, F - st.lowerTop, F - 16, 96);
  s.hline(x0, F - 16, w, S(P.concreteLight));
  s.hline(x0, F - 15, w, S(P.concrete));

  // the roof: a lit edge, panel seams, the club's stripes, its shaded lip and underside
  const top = F - st.roofTop;
  s.rect(x0, top, w, 12, S(P.concreteLight));
  s.hline(x0, top, w, S(P.steelHi));
  for (let x = x0 + ((((g.cx - x0) % 24) + 24) % 24) - 24; x < x1; x += 24) {
    s.vline(x, top + 1, 5, S(P.concrete));
    s.px(x + 1, top + 1, S(P.steelHi));
  }
  const tA = S(p.tier >= 5 ? P.chalk : P.home);
  const tB = S(p.tier >= 5 ? P.home : P.homeDark);
  s.rect(x0, top + 6, w, 2, tA);
  s.rect(x0, top + 8, w, 2, tB);
  s.hline(x0, top + 10, w, S(P.concrete));
  s.hline(x0, top + 11, w, S(P.concreteDark));
  s.rect(x0, top + 12, w, 4, S(P.ink));
  // the truss under the roof: a zig-zag of steel against the dark
  for (let x = x0 - 1; x < x1; x++) {
    const k = (((x - g.cx) % 8) + 8) % 8;
    s.px(x, top + 12 + (k < 4 ? k : 7 - k), S(P.night));
  }
  if (p.flood) {
    // the roof glows against the night; a row of lamps under its lip
    s.dither(x0, top - 12, w, 12, P.nightGlow, 0.25);
    s.dither(x0, top - 4, w, 4, P.nightGlow, 0.5);
    for (let x = x0 + 4; x < x1; x += 16) {
      s.hline(x, top + 12, 6, S(P.steel));
      s.hline(x, top + 13, 6, P.white);
      s.hline(x + 1, top + 14, 4, P.goldLight);
      s.px(x + 2, top + 15, P.goldLight);
      s.px(x + 3, top + 15, P.goldLight);
    }
  }

  if (gantry) {
    const gx = sx(g, -14) - 22;
    const gy = F - st.balcony - 6;
    const strutTop = top + 16;
    // two struts down from the roof, lit on their left
    for (const cx of [gx + 4, gx + 38]) {
      s.vline(cx, strutTop, gy - strutTop, S(P.steelHi));
      s.vline(cx + 1, strutTop, gy - strutTop, S(P.steel));
    }
    // the operators behind their cameras
    const sp = OPERATOR();
    const cols = colorsFor(sp, {
      h: S(P.hairDark),
      s: S(P.skinB),
      z: S(P.skinBShade),
      j: S(P.slate),
      J: S(P.steel),
      p: S(P.night),
      e: S(P.ink),
      k: S(P.ink),
      K: S(P.steel),
      l: S(P.slate),
      L: S(P.steelHi),
      r: P.ledRed,
      t: S(P.mist),
      n: S(P.ink),
    });
    drawSprite(s, sp, 0, gx + 8, gy - sp.h, cols);
    drawSprite(s, sp, 0, gx + 24, gy - sp.h, cols);
    // the platform and its rail
    s.hline(gx, gy, 44, S(P.steelHi));
    s.rect(gx, gy + 1, 44, 2, S(P.slate));
    s.hline(gx, gy + 3, 44, S(P.night));
    s.hline(gx, gy - 7, 44, S(P.steel));
    for (let x = gx; x < gx + 44; x += 8) s.vline(x, gy - 6, 6, S(P.steel));
    s.vline(gx + 43, gy - 6, 6, S(P.steel));
  }
}

export function paintStadium(s: Surface, p: Paint, life: Life): void {
  // RETRO's grand old stadium (retro-high.ts)
  if (p.era === "retro") {
    paintRetroStadium(s, p, life);
    return;
  }
  // NEXT-GEN's arena of glass and light (nextgen-high.ts)
  if (p.era === "nextgen") {
    paintArena(s, p, life);
    return;
  }
  const { g, S, E } = p;
  const F = g.F;
  const st = STAND;
  // the side stand stops at the corner, level with the goal line; the end behind the goal
  // (end.ts) wraps round from there towards us
  const corner = Math.min(g.w, endFor(g).corner);

  bigStand(s, p, life, 0, corner, true);
  // the stand's end: a plain concrete wall, lit on the left, a stair's slit windows
  const endH = st.roofTop - st.boards;
  s.rect(corner - 4, F - st.roofTop, 4, endH, S(P.concrete));
  s.vline(corner - 4, F - st.roofTop, endH, S(P.concreteLight));
  s.vline(corner - 1, F - st.roofTop, endH, S(P.concreteDark));
  for (let y = F - st.roofTop + 20; y < F - 24; y += 18) {
    s.vline(corner - 3, y, 5, p.lamps ? P.goldDark : S(P.slate));
  }
  // a pigeon on the roof
  life.perched.push({ x: sx(g, -40), y: F - st.roofTop });
  life.perchColor = E(P.steel);

  paintLedBoards(s, p, life, corner);

  if (p.tier >= 5) dressForNation(s, p, life, corner);
  if (p.tier >= 6) {
    life.flashes = 10;
    const y = F - st.lowerTop + 4;
    const [a, b] = crowdColors(p, false);
    life.giant.push(
      {
        x0: 0,
        x1: corner,
        y,
        w: 68,
        h: 20,
        a: S(a),
        b: S(b),
        speed: 10,
        phase: 0.45,
      },
      {
        x0: 0,
        x1: corner,
        y: y + 18,
        w: 56,
        h: 18,
        a: S(b),
        b: S(a),
        speed: 6,
        phase: 0.1,
      },
    );
    const top = F - st.roofTop;
    const bx = sx(g, 80);
    life.beams.push(
      { x: sx(g, -70), y: top },
      { x: sx(g, -8), y: top },
      // the third from the end's roof
      { x: bx, y: endRoofAt(g, bx) },
    );
    life.beamColor = P.steelHi;
  }
  if (p.tier >= 7) {
    life.fireworks = {
      x: 12,
      y: Math.max(8, F - st.roofTop - 100),
      w: Math.max(1, g.w - 24),
      h: 60,
    };
  }
}

/**
 * The LED boards along the far touchline: a dark frame 14 px tall holding a pre-painted
 * strip 10 px tall that crawls one lamp (2 px) at a time. Each board is a dot matrix: the
 * words in the small font as lamps (`scale: 2, dots: true`), on a panel whose unlit
 * lamps show as a dim grid on the dark looks.
 */
function paintLedBoards(s: Surface, p: Paint, life: Life, x1: number): void {
  const { g, S } = p;
  const bh = STAND.boards;
  const y = g.F - bh;
  s.rect(0, y, x1, bh, S(P.ink));
  s.hline(0, y, x1, S(P.slate));
  s.hline(0, y + 1, x1, S(P.night));
  s.hline(0, y + bh - 1, x1, S(P.night));
  const words = (p.labels.boards ?? []).map((w) => w.toUpperCase());
  const looks: readonly BoardLook[] = [
    { bg: P.ledOff, fg: P.amber },
    { bg: P.home, fg: P.chalk },
    { bg: P.ledOff, fg: P.ledGreen },
    { bg: P.chalk, fg: P.night },
    { bg: P.night, fg: P.gold },
  ];
  const parts = words.length > 0 ? words : ["", "", ""];
  const sh = 10;
  let width = 0;
  const widths: number[] = [];
  for (const wd of parts) {
    let bw = Math.max(80, (wd ? measureText(wd, led()) : 0) + 32);
    bw += bw & 1;
    widths.push(bw);
    width += bw;
  }
  const laps = Math.max(1, Math.ceil(g.w / width));
  const strip = new Surface(width * laps, sh);
  let x = 0;
  for (let l = 0; l < laps; l++) {
    for (let i = 0; i < parts.length; i++) {
      const look = looks[(i + l) % looks.length];
      const lit = p.lamps;
      const bg = lit ? look.bg : S(look.bg);
      const fg = lit ? look.fg : S(look.fg);
      const bw = widths[i];
      strip.rect(x, 0, bw, sh, bg);
      const dark = look.bg === P.ledOff || look.bg === P.night;
      // the unlit lamps: a dim grid on the dark panels
      if (dark) strip.dither(x, 0, bw - 2, sh, mix(bg, fg, 0.22), 0.25);
      if (parts[i]) {
        let tx = x + Math.floor((bw - measureText(parts[i], led())) / 2);
        tx -= tx & 1;
        // lit lamps, their light between them and a faint glow on the panel
        drawLamps(strip, parts[i], tx, 0, fg, { font: FONT_3x5, bg });
      } else {
        // no words: blocks of lamps
        for (let k = 8; k < bw - 8; k += 8) {
          for (let yy = 2; yy < 8; yy += 2)
            for (let xx = 0; xx < 4; xx += 2) strip.px(x + k + xx, yy, fg);
        }
      }
      // the seam between two boards
      strip.vline(x + bw - 2, 0, sh, S(P.ink));
      strip.vline(x + bw - 1, 0, sh, S(P.night));
      x += bw;
    }
  }
  life.crawl = { x0: 0, x1, y: y + 2, strip, speed: 24, step: 2 };
}

/**
 * Dressed for an international (tiers 5 to 7): flags along the roof, banners with words
 * hung over the balcony, little flags waved in the lower tier.
 */
function dressForNation(
  s: Surface,
  p: Paint,
  life: Life,
  corner: number,
): void {
  const { g, S } = p;
  const F = g.F;
  const st = STAND;
  const [a, b] = crowdColors(p, false);
  const top = F - st.roofTop;
  // flags along the roof, and along the end's roof as it steps down towards us
  let n = 0;
  for (let x = 12; x < corner - 12; x += 52) {
    life.flags.push({
      x,
      top: top - 18,
      poleH: 18,
      w: 12,
      h: 8,
      a: S(n % 2 === 0 ? a : b),
      b: S(n % 2 === 0 ? b : a),
      pole: S(P.steelHi),
      phase: n,
    });
    n++;
  }
  endFlags(p, life, a, b);
  // banners hung over the balcony, tied at the corners, the labels painted on them
  const words = (p.labels.banners ?? []).map((w) => w.toUpperCase());
  const y = F - st.balcony;
  const looks: readonly BoardLook[] = [
    { bg: P.chalk, fg: P.homeDark },
    { bg: P.home, fg: P.chalk },
    { bg: P.night, fg: P.gold },
  ];
  let x = sx(g, -60);
  for (let i = 0; x < corner - 24; i++) {
    const word = words.length > 0 ? words[i % words.length] : "";
    const bw = word ? measureText(word, paint()) + 12 : 32;
    if (x + bw > corner - 8) break;
    const look = looks[i % looks.length];
    banner(s, p, x, y, bw, look, word);
    x += bw + 44;
  }
  // little flags waved in the lower tier
  for (let k = 0; k < Math.round(g.w / 60); k++) {
    const fx = Math.floor(rnd(p, k, 50, 51) * g.w);
    if (fx > corner - 14) continue;
    const fy = F - st.lowerTop + 8 + 8 * Math.floor(rnd(p, k, 52, 51) * 4);
    life.flags.push({
      x: fx,
      top: fy - 10,
      poleH: 10,
      w: 8,
      h: 6,
      a: S(a),
      b: S(b),
      pole: S(P.woodDark),
      phase: k,
    });
  }
}

/** A cloth banner 16 px tall hung from the balcony rail: hems, ties, a sag, the word. */
function banner(
  s: Surface,
  p: Paint,
  x: number,
  y: number,
  bw: number,
  look: BoardLook,
  word: string,
): void {
  const { S } = p;
  const bg = S(look.bg);
  const lo = S(shade(look.bg, -0.3));
  const hi = S(shade(look.bg, 0.15));
  s.rect(x, y, bw, 16, bg);
  // the top hem, lit; the bottom hem in shade, sagging a pixel between the ties
  s.hline(x, y, bw, hi);
  s.hline(x, y + 14, bw, lo);
  s.hline(x + 3, y + 15, bw - 6, lo);
  s.px(x, y + 15, lo);
  s.px(x + bw - 1, y + 15, lo);
  // creases where the ties pull the cloth at its top corners, in the margins clear of the
  // word; a sag shading the cloth along the bottom hem between the ties
  for (let k = 0; k < 4; k++) {
    s.px(x + 2 + (k >> 1), y + 2 + k, lo);
    s.px(x + bw - 3 - (k >> 1), y + 2 + k, lo);
  }
  for (let fx = x + 4; fx < x + bw - 4; fx += 2) s.px(fx, y + 13, lo);
  // the ties round the rail at each corner
  s.px(x + 1, y - 1, S(P.chalk));
  s.px(x + bw - 2, y - 1, S(P.chalk));
  s.px(x + 1, y + 1, S(P.ink));
  s.px(x + bw - 2, y + 1, S(P.ink));
  if (word) drawText(s, word, x + 6, y + 3, S(look.fg), paint());
  else s.rect(x + 4, y + 6, bw - 8, 4, S(look.fg));
}
