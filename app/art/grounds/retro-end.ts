/**
 * RETRO's end behind the goal at the big grounds (tiers 4 to 7): the same slanted frame and
 * profile as today's stadium end (`end.ts`: its front along a line across the pitch, each row
 * up stepping back by `lean`, growing towards us), dressed in the early game's way:
 *
 *   - painted wooden hoardings along its front, a timber rail over them;
 *   - a standing terrace of cinders and timber steps, iron crush barriers across it;
 *   - a criss-cross lattice front to the covered upper section, wooden benches behind it;
 *   - cast-iron columns holding up a pitched tin roof behind a cream fascia with the club's
 *     stripe and a dagger-board valance (bare bulbs under it at night);
 *   - in the corner: cobbles behind a picket fence and a gas lamp; on the end's roof a
 *     hand-turned scoreboard, a boy on its ladder.
 */

import { P } from "~/art/palette";
import {
  Surface,
  TRANSPARENT,
  bayer4,
  drawText,
  measureText,
  mix,
  shade,
  type Color,
} from "~/pixel";
import { fanStyle, seatFan } from "./crowd";
import { endFor, endTopAt, nearTop, type EndGeo } from "./end";
import type { Life } from "./life";
import { rnd, sx, type Paint } from "./paint";
import {
  RETRO,
  endScoreboardX,
  handScoreboard,
  paintText,
  searchlightDrum,
  trimFor,
} from "./retro-high";

/** The end's profile in stand pixels from its foot: today's numbers (end.ts). */
const WALL = 16;
const LOW = 16;
const WALK = 64;
const UP = 72;
const BACK = 120;
const UNDER = 124;
const FASCIA = 128;
const TOP = 140;
const ROW = 8;
const AISLE = 83;

/** Paint RETRO's end into the layer (tiers 4 to 7), as `paintEnd` paints today's. */
export function paintRetroEnd(s: Surface, p: Paint, life: Life): void {
  const { g } = p;
  const e = endFor(g);
  const clipY = Math.min(g.h, nearTop(p));
  const { xA, y0, m, lean, grow } = e;
  // the town's chimneys hidden behind the end's roof send up no smoke
  const roofX = xA + lean * TOP;
  life.smoke = life.smoke.filter(
    (c) => c.x < roofX || c.y + 6 < endTopAt(e, c.x, TOP) - 2,
  );
  retroCorner(s, p, e);

  const boards = endBoards(p, e, clipY);
  const colour = endColors(p, boards);
  const back = p.S(RETRO.tinDark);
  const backEdge = p.S(RETRO.tin);
  const zMax = 1 + grow * Math.max(0, clipY - y0 + TOP * 2);
  const yTop = Math.max(0, Math.floor(y0 - TOP * zMax - 14));
  for (let Y = yTop; Y < clipY; Y++) {
    const xs = Y <= y0 ? xA + lean * (y0 - Y) : xA + m * (Y - y0);
    for (let X = Math.max(e.corner, Math.floor(xs)); X < g.w; X++) {
      const h = (X - xA - m * (Y - y0)) / (m + lean);
      const u = Y - y0 + h;
      if (u < 0 || h < 0) continue;
      const z = 1 + grow * u;
      const hu = h / z;
      if (hu >= TOP) {
        // over its top: the back of the roof's slope, down from the town's foot
        if (Y >= g.B) {
          s.px(X, Y, hu - TOP < 2 ? backEdge : back);
          continue;
        }
        if (p.flood && hu < TOP + 12 && bayer4(X, Y) < 0.18)
          s.px(X, Y, P.nightGlow);
        if (hu > TOP + 12 && Y < g.B - 14) break;
        continue;
      }
      s.px(X, Y, colour(hu, u, h, z, X, Y));
    }
  }

  // the fans, the back rows first: standing on the terrace, seated under the roof
  const st = fanStyle(p);
  const blocks = [
    {
      base: UP,
      rows: 6,
      seat: p.S(mix(RETRO.timberDark, P.night, 0.35)),
      dim: 4,
      empty: 0.03,
    },
    { base: LOW, rows: 6, seat: p.S(RETRO.cinder), dim: 99, empty: 0.05 },
  ];
  const pitch = 6 / m;
  for (const b of blocks) {
    for (let r = b.rows - 1; r >= 0; r--) {
      for (let i = 0; ; i++) {
        const u = 3 + i * pitch;
        const hb = (b.base + r * ROW) * (1 + grow * u);
        const x = Math.round(xA + m * u + lean * hb) - 3;
        const y = Math.round(y0 + u - hb) - 8;
        if (x >= g.w || y + 8 > clipY) break;
        const a = (u + 40) % AISLE;
        if (a > AISLE - 7 || a < 3) continue;
        if (rnd(p, x, y, 21) < b.empty) continue;
        seatFan(s, p, life, st, x, y, b.seat, r >= b.dim);
      }
    }
  }
  boardWords(s, p, e, boards, clipY);
  barriers(s, p, e, clipY);
  columns(s, p, e, clipY);
  scoreboard(s, p, e);
  // tiers 6 and 7: a searchlight drum on the roof under its beam (retro-high.ts)
  if (p.tier >= 6) {
    const bx = sx(g, 80);
    if (bx < g.w - 4) searchlightDrum(s, p, bx, endTopAt(e, bx, TOP));
  }
}

type Colour = (
  hu: number,
  u: number,
  h: number,
  z: number,
  x: number,
  y: number,
) => Color;

/**
 * The hoardings along the end's front, seen at a slant: hand-lettered boards (the labels in
 * the painted font, chalk on dark timber or brick on cream) and now and then a board of
 * plain varnished planks. From `u0` to `u1` along the front (rows of the foot line).
 */
interface EndBoard {
  u0: number;
  u1: number;
  /** 0: cream with brick letters, 1: dark timber with chalk letters, 2: plain planks. */
  look: number;
  word: string;
}

/** Margin each side of a board's word, in `u`. */
const BOARD_PAD = 4;

function endBoards(p: Paint, e: EndGeo, clipY: number): EndBoard[] {
  const words = (p.labels.boards ?? []).map((w) => w.toUpperCase());
  const out: EndBoard[] = [];
  // as far along as the end shows above the near side
  const uMax = clipY - e.y0 + 4;
  let u = 0;
  for (let i = 0, n = 0; u < uMax; i++) {
    const plain = words.length === 0 || i % 3 === 2;
    const word = plain ? "" : words[n % words.length];
    const len = word
      ? measureText(word, paintText()) / e.m + BOARD_PAD * 2
      : 22;
    out.push({ u0: u, u1: u + len, look: plain ? 2 : n & 1, word });
    if (!plain) n++;
    u += len;
  }
  return out;
}

/** The board at `u` along the end's front (boards are few: a short walk). */
function boardAt(boards: readonly EndBoard[], u: number): EndBoard | null {
  for (let i = 0; i < boards.length; i++) {
    if (u < boards[i].u1) return boards[i];
  }
  return null;
}

/** RETRO's end, part by part from its foot up to the roof's lit edge. */
function endColors(p: Paint, boards: readonly EndBoard[]): Colour {
  const { S } = p;
  const R = RETRO;
  const T = trimFor(p.tier);
  // the boards' grounds: cream, dark timber, varnished planks; each with a lit top row
  // and a shaded foot
  const bg = [S(R.cream), S(P.woodDark), S(R.timber)];
  const bgLo = [S(R.creamShade), S(shade(P.woodDark, -0.25)), S(R.timberDark)];
  const bgHi = [S(R.creamLit), S(R.timber), S(R.timberLit)];
  const c = {
    ink: S(P.ink),
    night: S(P.night),
    brick: S(P.brick),
    brickLit: S(P.brickLight),
    brickDark: S(P.brickDark),
    cream: S(R.cream),
    creamLit: S(R.creamLit),
    creamShade: S(R.creamShade),
    timber: S(R.timber),
    timberDark: S(R.timberDark),
    timberLit: S(R.timberLit),
    club: S(T.club),
    clubDark: S(T.clubDark),
    clubLight: S(T.clubLight),
    cinder: S(R.cinder),
    cinderLit: S(R.cinderLit),
    bench: S(mix(R.timberDark, P.night, 0.35)),
  };
  return (hu, u, h, z, x, y) => {
    // the far end's side, seen edge on: a brick screen
    if (u < 1.5 && hu < FASCIA) {
      if (hu < WALL) return c.timberDark;
      return (Math.floor(hu) & 3) === 0
        ? c.brickDark
        : u < 0.75
          ? c.brickLit
          : c.brick;
    }
    if (hu < WALL) {
      // the hoardings: a timber rail on top, a board per panel, a post between two
      // (their words are painted on after, square to the screen: `boardWords`)
      if (hu < 2) return c.ink;
      if (hu >= WALL - 1) return c.timberLit;
      if (hu >= WALL - 2) return c.timber;
      const b = boardAt(boards, u);
      if (!b) return c.timberDark;
      if (u - b.u0 < 1.2) return c.timberDark;
      const i = b.look;
      const row = hu - 2;
      if (row >= 11) return bgHi[i];
      if (row < 1) return bgLo[i];
      // planks: a seam every few rows
      if (i === 2 && (Math.floor(row) === 4 || Math.floor(row) === 8))
        return bgLo[i];
      return bg[i];
    }
    if (hu < WALK) {
      // the terrace: cinder treads with a timber nosing on each step
      const k = hu - LOW;
      const r = Math.floor(k / ROW);
      const hb = h - (h / z - k + r * ROW) * z;
      const a = (u + 40) % AISLE;
      if (a > AISLE - 4) {
        const st = Math.floor(hb) % 4;
        return st === 0 ? c.timberLit : st === 1 ? c.timber : c.timberDark;
      }
      return hb < 1 ? c.cinderLit : c.cinder;
    }
    if (hu < UP) {
      // the front of the covered section: a cream rail over a criss-cross lattice
      const d = UP - hu;
      if (d < 1) return c.creamLit;
      if (d < 2) return c.cream;
      if (d >= 7) return c.timberDark;
      const a = (((x + y) % 6) + 6) % 6;
      const b = (((x - y) % 6) + 6) % 6;
      return a === 0
        ? c.clubLight
        : a === 1
          ? c.club
          : b === 0
            ? c.clubDark
            : c.ink;
    }
    if (hu < BACK) {
      const k = hu - UP;
      const r = Math.floor(k / ROW);
      const hb = h - (h / z - k + r * ROW) * z;
      return hb < 1 ? c.timber : c.bench;
    }
    if (hu < UNDER) return c.night;
    if (hu < FASCIA) {
      // the dagger board under the fascia; a bare bulb now and then at night
      const along = u % 6;
      const d = hu - UNDER;
      if (p.flood && u % 14 < 1.2 && d >= 2)
        return d < 3 ? P.white : P.goldLight;
      if (d < 1) return c.cream;
      if (d < 2) return along > 0.7 && along < 5 ? c.cream : c.ink;
      if (d < 3) return along > 2 && along < 4 ? c.creamShade : c.ink;
      return c.ink;
    }
    // the fascia: a lit edge, cream boards and their seams, the club stripe, its shade
    const d = TOP - hu;
    if (d < 1) return c.creamLit;
    if (d < 6) return u % 12 < 0.7 ? c.creamShade : c.cream;
    if (d < 8) return c.club;
    if (d < 9) return c.clubDark;
    if (d < 10) return c.cream;
    if (d < 11) return c.creamShade;
    return c.timberDark;
  };
}

/**
 * The boards' words, painted in screen pixels (the font never scaled): each letter upright,
 * as a sign-writer paints it, stepping down the slanted board one letter at a time, in the
 * middle of the board as it grows towards us.
 */
function boardWords(
  s: Surface,
  p: Paint,
  e: EndGeo,
  boards: readonly EndBoard[],
  clipY: number,
): void {
  const { S, g } = p;
  const fg = [S(P.brickDark), S(P.chalk)];
  for (const b of boards) {
    if (!b.word) continue;
    const col = fg[b.look];
    let ox = 0;
    for (let i = 0; i < b.word.length; i++) {
      const ch = b.word[i];
      const glyph = wordGlyphs(ch);
      const cw = measureText(b.word.slice(0, i + 1), paintText()) - ox;
      if (ch !== " ") {
        // the letter's middle column on the board, and the board's middle row there
        const u = b.u0 + BOARD_PAD + (ox + glyph.w / 2) / e.m;
        const z = 1 + e.grow * u;
        const h = Math.round(9 * z);
        const x0 = Math.round(e.xA + e.m * u + e.lean * h - glyph.w / 2);
        const y0 = Math.round(e.y0 + u - h - 4);
        for (let cy = 0; cy < glyph.h; cy++) {
          for (let cx = 0; cx < glyph.w; cx++) {
            if (glyph.get(cx, cy) === TRANSPARENT) continue;
            const x = x0 + cx;
            const y = y0 + cy;
            if (x < e.corner || x >= g.w || y >= clipY) continue;
            s.px(x, y, col);
          }
        }
      }
      ox += cw;
    }
  }
}

/** A letter or word in the painted font, as a mask (cached: the labels are few). */
const glyphCache = new Map<string, Surface>();
function wordGlyphs(word: string): Surface {
  let m = glyphCache.get(word);
  if (!m) {
    const w = measureText(word, paintText());
    m = new Surface(Math.max(1, w), 9);
    drawText(m, word, 0, 0, P.ink, paintText());
    glyphCache.set(word, m);
  }
  return m;
}

/** Where a point `hs` stand pixels up the end, `u` rows along its front, is. */
function at(e: EndGeo, u: number, hs: number): [number, number] {
  const h = hs * (1 + e.grow * u);
  return [Math.round(e.xA + e.m * u + e.lean * h), Math.round(e.y0 + u - h)];
}

/** Crush barriers across the terrace on posts, over the fans. */
function barriers(s: Surface, p: Paint, e: EndGeo, clipY: number): void {
  const { S, g } = p;
  const hi = S(RETRO.ironLit);
  const lo = S(RETRO.ironDark);
  for (const hs of [LOW + 2 * ROW, LOW + 4 * ROW]) {
    for (let u = 2; u < g.h; u += 0.5) {
      const [x, y] = at(e, u, hs);
      if (x >= g.w || y + 2 > clipY) break;
      const seg = u % 24;
      if (seg > 17) continue;
      s.px(x, y, hi);
      s.px(x, y + 1, lo);
      if (seg < 0.5 || (seg >= 14 && seg < 14.5)) {
        for (let k = 2; k < 6; k++) s.px(x, y + k, lo);
      }
    }
  }
}

/** Cast-iron columns from the walkway's lattice up to the roof, over the seated fans. */
function columns(s: Surface, p: Paint, e: EndGeo, clipY: number): void {
  const { S, g } = p;
  const lit = S(RETRO.ironLit);
  const dark = S(RETRO.iron);
  for (let u = 22; u < g.h; u += 46) {
    const [bx, by] = at(e, u, UP);
    if (bx >= g.w || by > clipY) break;
    for (let hs = UP; hs < UNDER; hs += 0.5) {
      const [x, y] = at(e, u, hs);
      if (y >= clipY) continue;
      s.px(x, y, lit);
      s.px(x + 1, y, dark);
    }
    // the bracket under the roof
    const [tx, ty] = at(e, u, UNDER - 1);
    s.px(tx - 1, ty + 1, lit);
    s.px(tx + 2, ty + 1, dark);
  }
}

/**
 * The corner between the side stand and the end (rows `B` to `F`): cobbles behind a white
 * picket fence, a gas lamp on its post (lit at night).
 */
function retroCorner(s: Surface, p: Paint, e: EndGeo): void {
  const { g, S } = p;
  const { xA, y0, m, lean } = e;
  const cob = S(mix(P.concrete, P.wood, 0.25));
  const cobDark = S(mix(P.concreteDark, P.woodDark, 0.3));
  const cobLit = S(mix(P.concreteLight, P.retroLight, 0.3));
  const picket = S(RETRO.cream);
  const picketShade = S(RETRO.creamShade);
  let x1 = e.corner;
  for (let Y = g.B; Y < g.F; Y++) {
    const xs = Y <= y0 ? xA + lean * (y0 - Y) : xA + m * (Y - y0);
    const end = Math.min(g.w, Math.ceil(xs));
    x1 = Math.max(x1, end);
    for (let X = e.corner; X < end; X++) {
      const d = Y - g.B;
      // cobbles: rounded stones in rows, lit on their tops
      const row = d >> 1;
      const k = (((X + (row & 1) * 2) % 4) + 4) % 4;
      let c =
        (d & 1) === 0 ? (k === 0 ? cobDark : cobLit) : k === 3 ? cobDark : cob;
      if (d >= 4 && d < 13) {
        // the picket fence: pointed pales on two rails
        const pk = (((X - e.corner) % 4) + 4) % 4;
        if (pk === 1 || pk === 2) {
          if (d > 4 || pk === 1) c = pk === 1 ? picket : picketShade;
        } else if (d === 7 || d === 11) c = picketShade;
      }
      s.px(X, Y, c);
    }
  }
  // the gas lamp on its post, at the corner's left
  const lx = e.corner + 5;
  if (lx + 3 >= g.w) return;
  const top = g.B - 18;
  s.vline(lx + 1, top + 5, g.B + 6 - top - 5, S(RETRO.ironDark));
  s.hline(lx, g.B + 5, 3, S(RETRO.ironDark));
  s.px(lx, top + 6, S(RETRO.ironDark));
  s.px(lx + 2, top + 6, S(RETRO.ironDark));
  // the lantern: a little roof, glass, a base
  s.hline(lx, top, 3, S(RETRO.ironDark));
  s.hline(lx - 1, top + 1, 5, S(RETRO.ironDark));
  const glass = p.lamps ? P.goldLight : S(P.mist);
  const glass2 = p.lamps ? P.gold : S(P.steel);
  s.rect(lx - 1, top + 2, 5, 3, glass2);
  s.rect(lx, top + 2, 3, 2, glass);
  s.hline(lx - 1, top + 5, 5, S(RETRO.ironDark));
  if (p.lamps) {
    s.px(lx + 1, top + 2, P.white);
    s.disc(lx + 1, top + 3, 7, P.goldDark, 0.12);
  }
}

/** The hand-turned scoreboard on the end's roof, where the canvas shows it. */
function scoreboard(s: Surface, p: Paint, e: EndGeo): void {
  const x = endScoreboardX(p.g);
  if (x !== null) handScoreboard(s, p, x, (xx) => endTopAt(e, xx, TOP));
}
