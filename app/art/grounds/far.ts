/**
 * The far side of the career ground: everything above the far touchline. His street is
 * always there at the back (the terrace of houses with his red door, the chimneys, the
 * church spire, the trees, the street lamp); each tier builds in front of it.
 *
 *   tier 0  the hedge and railings, two mates
 *   tier 1  + a rope on stakes, the wooden changing hut, a corner flag, parents
 *   tier 2  + a fence of painted boards, a small covered stand, a tea hut, four poles
 *   tier 3  a main stand, his house in a gap, an open terrace, a scoreboard, pylons
 *   tier 4  a packed two-tier stand with boxes, a roof, a camera gantry, LED boards; the
 *           spire seen through a low corner
 *   tier 5  the same dressed for an international: flags, banners, scarves
 *   tier 6  the World Cup final at night: flashes, giant flags, beams
 *   tier 7  the same with fireworks
 *
 * Every painter draws in final colours: the street with `distant()`, the ground's own
 * structures with `p.S` (floodlit from tier 2), lamps and lit windows in raw colour.
 */

import { FAN } from "~/art/layout";
import { drawLedPanel } from "~/art/led";
import { P } from "~/art/palette";
import {
  FONT_3x5,
  Surface,
  TRANSPARENT,
  drawText,
  measureText,
  shade,
  type Color,
} from "~/pixel";
import type { Life } from "./life";
import { paintFan, type Watcher } from "./people";
import {
  CHIMNEY_H,
  HAIR,
  HEADS,
  HOUSE_W,
  ROOF_H,
  SKIN,
  TRAVELLING,
  WALL_H,
  across,
  crowdColors,
  crowdShirts,
  pick,
  inPocket,
  rnd,
  sx,
  type Paint,
} from "./paint";

const SMALL = { font: FONT_3x5 } as const;

/** How far back the street is (0 near, 1 the horizon). */
const STREET = 0.3;
const CHURCH = 0.42;
const TREES_FAR = 0.62;

// ---------------------------------------------------------------------------
// His street
// ---------------------------------------------------------------------------

const WALLS: readonly (readonly [Color, number])[] = [
  [P.brick, 40],
  [P.brickLight, 18],
  [P.brickDark, 16],
  [P.concreteLight, 14],
  [P.chalk, 12],
];

const DOORS: readonly (readonly [Color, number])[] = [
  [P.woodDark, 20],
  [P.night, 20],
  [P.awayDark, 14],
  [P.grassDeep, 14],
  [P.slate, 14],
  [P.gold, 6],
];

/** Which house this module is, counting from his (0). Every seventh is an alley with a tree. */
function isAlley(i: number): boolean {
  return ((i % 7) + 7) % 7 === 4;
}

/** The washing hangs in the alley three houses left of his. */
const WASHING_ALLEY = -3;

export function paintStreet(s: Surface, p: Paint, life: Life): void {
  const { g } = p;
  paintFarTrees(s, p);
  paintChurch(s, p);
  const i0 = Math.floor(-g.houseX / HOUSE_W) - 1;
  const i1 = Math.ceil((g.w - g.houseX) / HOUSE_W) + 1;
  for (let i = i0; i <= i1; i++) {
    const x = g.houseX + i * HOUSE_W;
    if (isAlley(i) || i === WASHING_ALLEY) paintAlley(s, p, life, x, i);
    else paintHouse(s, p, life, x, i);
  }
  paintStreetLamp(s, p);
}

/** A low line of trees far behind the street: the sky's horizon is never bare. */
function paintFarTrees(s: Surface, p: Paint): void {
  const { g, D } = p;
  const base = D(P.grassDark, TREES_FAR);
  const top = D(P.grass, TREES_FAR);
  const B = g.B;
  const CL = 9;
  for (let c = -1; c * CL < g.w + CL; c++) {
    const r = rnd(p, c, 0, 1);
    const hgt = 7 + Math.floor(r * 7);
    const x0 = c * CL - 2;
    for (let i = 0; i < CL + 3; i++) {
      const edge = Math.min(i, CL + 2 - i);
      const y = B - hgt + (edge === 0 ? 2 : edge === 1 ? 1 : 0);
      s.vline(x0 + i, y, B - y, base);
      s.px(x0 + i, y, top);
    }
  }
}

function paintChurch(s: Surface, p: Paint): void {
  const { g, D } = p;
  const B = g.B;
  const x = g.spireX;
  const stone = D(P.concreteLight, CHURCH);
  const stoneLo = D(P.concrete, CHURCH);
  const roof = D(P.slate, CHURCH);
  // the nave, mostly behind the roofs
  s.rect(x + 4, B - 21, 24, 21, stone);
  for (let i = 0; i < 5; i++)
    s.hline(x + 4 + i, B - 25 + i, 24 - 2 * i + 4, roof);
  // the tower
  s.rect(x - 4, B - 31, 9, 31, stone);
  s.vline(x + 4, B - 31, 31, stoneLo);
  s.rect(x - 1, B - 29, 3, 4, D(P.night, CHURCH));
  s.rect(x - 1, B - 23, 3, 3, D(P.chalk, CHURCH));
  s.px(x, B - 22, D(P.ink, CHURCH));
  s.hline(x - 5, B - 31, 11, D(P.steelHi, CHURCH));
  // the spire: lit side left, shaded side right
  const lit = D(P.steel, CHURCH);
  const dark = D(P.slate, CHURCH);
  for (let r = 0; r < 22; r++) {
    const half = Math.round(4 * (1 - r / 22));
    const y = B - 32 - r;
    s.hline(x - half, y, half + 1, lit);
    if (half > 0) s.hline(x + 1, y, half, dark);
  }
  s.vline(x, B - 57, 3, D(P.gold, CHURCH));
  s.hline(x - 1, B - 56, 3, D(P.gold, CHURCH));
}

function windowAt(
  s: Surface,
  p: Paint,
  x: number,
  y: number,
  w: number,
  h: number,
  lit: boolean,
): void {
  const { D } = p;
  if (lit) {
    s.rect(x, y, w, h, P.goldLight);
    s.hline(x, y + h - 1, w, P.gold);
  } else if (p.lamps) {
    s.rect(x, y, w, h, D(P.night, STREET));
  } else {
    s.rect(x, y, w, h, D(P.steel, STREET));
    s.px(x, y, D(P.mist, STREET));
  }
  s.hline(x, y + h, w, D(P.chalk, STREET));
}

function paintHouse(
  s: Surface,
  p: Paint,
  life: Life,
  x: number,
  i: number,
): void {
  const { g, D } = p;
  const B = g.B;
  const his = i === 0;
  const wallC = his ? P.brick : pick(WALLS, rnd(p, i, 1, 3));
  const wall = D(wallC, STREET);
  s.rect(x, B - WALL_H, HOUSE_W, WALL_H, wall);
  s.vline(x, B - WALL_H, WALL_H, D(shade(wallC, -0.3), STREET));
  s.hline(x, B - 9, HOUSE_W, D(shade(wallC, 0.2), STREET));
  // the door and its step
  const doorC = his ? P.home : pick(DOORS, rnd(p, i, 2, 3));
  s.rect(x + 2, B - 8, 5, 8, D(P.chalk, STREET));
  s.rect(x + 3, B - 7, 3, 7, D(doorC, STREET));
  s.px(x + 5, B - 4, D(P.gold, STREET));
  // the bay downstairs, two windows upstairs; at night some are lit, his always
  const night = p.lamps;
  windowAt(s, p, x + 9, B - 7, 5, 4, night && rnd(p, i, 3, 3) < 0.4);
  windowAt(s, p, x + 3, B - 15, 3, 4, night && (his || rnd(p, i, 4, 3) < 0.3));
  windowAt(s, p, x + 10, B - 15, 3, 4, night && rnd(p, i, 5, 3) < 0.25);
  if (his) {
    // a window box of flowers in his colour
    s.hline(x + 9, B - 2, 5, D(P.woodDark, STREET));
    s.px(x + 9, B - 3, D(P.home, STREET));
    s.px(x + 11, B - 3, D(P.homeLight, STREET));
    s.px(x + 13, B - 3, D(P.home, STREET));
  }
  // the roof: a ridge, slates, the gutter
  const top = B - WALL_H - ROOF_H;
  s.rect(x, top, HOUSE_W, ROOF_H, D(P.slate, STREET));
  s.hline(x, top, HOUSE_W, D(P.steel, STREET));
  s.hline(x, B - WALL_H - 1, HOUSE_W, D(P.night, STREET));
  for (let k = 1; k < HOUSE_W; k += 4)
    s.px(x + k + (i & 1), top + 2, D(P.concreteDark, STREET));
  // a chimney stack on every other party wall, straddling it
  if ((i & 1) === 0) {
    const cx = x - 2;
    const cTop = top - CHIMNEY_H;
    s.rect(cx, cTop, 4, CHIMNEY_H, D(P.brickDark, STREET));
    s.hline(cx - 1, cTop, 6, D(P.brick, STREET));
    s.px(cx, cTop - 1, D(P.brickLight, STREET));
    s.px(cx + 3, cTop - 1, D(P.brickLight, STREET));
    if (rnd(p, i, 6, 3) < 0.5 || i === 2)
      life.smoke.push({ x: cx, y: cTop - 2 });
  }
}

function paintAlley(
  s: Surface,
  p: Paint,
  life: Life,
  x: number,
  i: number,
): void {
  const { g, D } = p;
  const B = g.B;
  // a garden wall
  s.rect(x, B - 3, HOUSE_W, 3, D(P.brickDark, STREET));
  s.hline(x, B - 3, HOUSE_W, D(P.brick, STREET));
  if (i === WASHING_ALLEY) {
    const post = D(P.woodDark, STREET);
    s.vline(x + 1, B - 14, 11, post);
    s.vline(x + 14, B - 14, 11, post);
    s.hline(x + 1, B - 14, 14, D(P.mist, STREET));
    life.washingPosts = D(P.chalk, STREET);
    life.washing = {
      y: B - 14,
      items: [
        {
          x: x + 3,
          w: 3,
          h: 4,
          c: D(P.home, STREET),
          low: D(P.homeDark, STREET),
        },
        { x: x + 7, w: 4, h: 5, c: D(P.chalk, STREET), low: D(P.mist, STREET) },
        {
          x: x + 12,
          w: 2,
          h: 3,
          c: D(P.skyMid, STREET),
          low: D(P.steel, STREET),
        },
      ],
    };
    return;
  }
  // a tree over the wall
  const tx = x + 8;
  s.vline(tx, B - 10, 8, D(P.woodDark, STREET));
  s.disc(tx, B - 16, 6.5, D(P.grassDeep, STREET));
  s.disc(tx - 1, B - 18, 4.5, D(P.grassDark, STREET));
  s.disc(tx - 2, B - 19, 2, D(P.grass, STREET));
}

function paintStreetLamp(s: Surface, p: Paint): void {
  const { g, D } = p;
  const x = sx(g, -6);
  const head = g.B - 26;
  s.vline(x, head + 1, g.F - head - 1, D(P.night, 0.15));
  s.hline(x, head, 4, D(P.night, 0.15));
  if (p.lamps) {
    s.disc(x + 3, head + 2, 6, P.amberDim, 0.25);
    s.disc(x + 3, head + 2, 3, P.amber, 0.25);
    s.rect(x + 2, head + 1, 3, 2, P.goldLight);
  } else {
    s.rect(x + 2, head + 1, 3, 2, D(P.mist, 0.15));
  }
}

// ---------------------------------------------------------------------------
// The park (tiers 0 and 1, and the hedge behind everything above)
// ---------------------------------------------------------------------------

export function paintHedge(
  s: Surface,
  p: Paint,
  railings: boolean,
  life: Life,
): void {
  const { g, E } = p;
  const F = g.F;
  const deep = E(P.grassDeep);
  const dark = E(P.grassDark);
  const leaf = E(P.grass);
  s.rect(0, F - 9, g.w, 9, deep);
  for (let c = 0; c * 4 < g.w + 4; c++) {
    const bump = rnd(p, c, 7, 5) < 0.5 ? 1 : 0;
    s.hline(c * 4, F - 10 + bump, 4, dark);
    s.hline(c * 4 + 1, F - 10 + bump - 1 + (c & 1), 2, dark);
    s.px(c * 4 + 1, F - 9 + bump, leaf);
    if (rnd(p, c, 8, 5) < 0.5) s.rect(c * 4 + 2, F - 6, 2, 2, dark);
  }
  if (!railings) return;
  const bar = E(P.night);
  const rail = E(P.slate);
  s.hline(0, F - 7, g.w, rail);
  s.hline(0, F - 2, g.w, rail);
  for (let x = 1; x < g.w; x += 3) {
    s.vline(x, F - 8, 7, bar);
    s.px(x, F - 9, E(P.steel));
  }
  // two sparrows on the rail
  life.perchColor = E(P.woodDark);
  life.perched.push({ x: sx(g, -36), y: F - 9 }, { x: sx(g, 30), y: F - 9 });
}

/** The two mates leaning on the railings at tier 0. */
export function addMates(p: Paint, life: Life): void {
  const { g, E } = p;
  life.watchers.push(
    watcher(p, sx(g, -58), g.F + 1, true, E(P.homeDark), 0),
    watcher(p, sx(g, -50), g.F + 1, true, E(P.awayDark), 1),
  );
}

function watcher(
  p: Paint,
  x: number,
  y: number,
  kid: boolean,
  coat: Color,
  n: number,
): Watcher {
  const { E } = p;
  const [a, b] = crowdColors(p, false);
  const away = p.mode === "away";
  const hostile = away && !inPocket(p, x, y - 10);
  return {
    x,
    y,
    kid,
    hair: E(pick(HAIR, rnd(p, n, 1, 11))),
    skin: E(pick(SKIN, rnd(p, n, 2, 11))),
    coat,
    coatLow: E(shade(P.slate, -0.1)),
    legs: E(rnd(p, n, 3, 11) < 0.5 ? P.night : P.slate),
    period: 9 + Math.floor(rnd(p, n, 4, 11) * 12),
    offset: Math.floor(rnd(p, n, 5, 11) * 200),
    withHero: !hostile,
    scarfA: rnd(p, n, 6, 11) < 0.4 ? E(a) : TRANSPARENT,
    scarfB: E(b),
  };
}

export function paintHut(s: Surface, p: Paint): void {
  const { g, E } = p;
  const F = g.F;
  const x = sx(g, -66);
  const w = 22;
  const plank = E(P.wood);
  const seam = E(P.woodDark);
  s.rect(x, F - 13, w, 13, plank);
  for (let i = 2; i < w; i += 3) s.vline(x + i, F - 12, 12, seam);
  s.vline(x + w - 1, F - 13, 13, E(shade(P.wood, -0.35)));
  // the felt roof, overhanging
  s.rect(x - 1, F - 16, w + 2, 3, E(P.slate));
  s.hline(x - 1, F - 16, w + 2, E(P.steel));
  // door and window
  s.rect(x + 3, F - 9, 4, 9, E(P.woodDark));
  s.px(x + 6, F - 5, E(P.gold));
  if (p.lamps) {
    s.rect(x + 13, F - 10, 5, 3, P.goldLight);
    s.disc(x + 15, F - 9, 5, P.amberDim, 0.25);
    s.rect(x + 13, F - 10, 5, 3, P.goldLight);
  } else {
    s.rect(x + 13, F - 10, 5, 3, E(P.steel));
    s.px(x + 13, F - 10, E(P.mist));
  }
  s.hline(x + 12, F - 7, 7, E(P.chalk));
}

/** The parents behind the rope at tier 1 (and a few more on a monitor). */
export function addParents(p: Paint, life: Life): void {
  const { g, E } = p;
  const hutL = sx(g, -67);
  const hutR = sx(g, -42);
  const coats: readonly Color[] = [
    P.slate,
    P.awayDark,
    P.home,
    P.night,
    P.grassDeep,
    P.wood,
    P.steel,
    P.homeDark,
  ];
  let n = 0;
  for (let x = 6; x < g.w - 4; x += Math.max(7, Math.round(8 * g.k))) {
    if (x > hutL && x < hutR) continue;
    const r = rnd(p, x, 9, 13);
    if (r < 0.3) continue;
    const kid = rnd(p, x, 10, 13) < 0.25;
    const coat = E(coats[Math.floor(rnd(p, x, 11, 13) * coats.length)]);
    life.watchers.push(watcher(p, x + (n % 2), g.F - 1, kid, coat, n));
    n++;
  }
}

export function addRope(p: Paint, life: Life): void {
  const { g, E } = p;
  life.rope = {
    y: g.F - 4,
    x0: 0,
    x1: g.w,
    step: Math.max(10, Math.round(12 * g.k)),
    rope: E(P.chalk),
    stake: E(P.wood),
  };
}

/** The corner flag where the goal line meets the far touchline (tier 1 up). */
export function addCornerFlag(p: Paint, life: Life): void {
  const { g, S } = p;
  const x = across(g, g.goalX, g.F) - 1;
  life.flags.push({
    x,
    top: g.F - 9,
    poleH: 9,
    w: 3,
    h: 2,
    a: S(P.gold),
    b: S(P.goldDark),
    pole: S(P.chalk),
    phase: 0,
  });
}

// ---------------------------------------------------------------------------
// The crowd in a stand
// ---------------------------------------------------------------------------

interface Block {
  x0: number;
  x1: number;
  /** Top of the first row of fans. */
  y: number;
  rows: number;
  seat: Color;
  /** 0 a packed stand to 1 empty. */
  empty: number;
  /** The first row(s) sit back in shadow under a roof. */
  shadowRows: number;
}

function fanBlock(s: Surface, p: Paint, life: Life, b: Block): void {
  const { S } = p;
  const shirts = crowdShirts(p);
  const away = p.mode === "away";
  const scarfChance = p.tier >= 5 ? 0.3 : p.tier >= 3 ? 0.18 : 0.08;
  s.rect(b.x0, b.y, b.x1 - b.x0, b.rows * FAN.pitch, b.seat);
  for (let r = 0; r < b.rows; r++) {
    const y = b.y + r * FAN.pitch;
    const stagger = (r & 1) * 2;
    for (let x = b.x0 + stagger + 1; x + FAN.w <= b.x1; x += FAN.pitch) {
      const id = x * 7 + y * 131;
      if (rnd(p, x, y, 21) < b.empty) continue;
      const travelling = away && inPocket(p, x, y);
      const pair = rnd(p, x >> 3, y, 22) < 0.3;
      let body = pick(
        travelling ? TRAVELLING : shirts,
        pair ? rnd(p, x >> 3, y, 23) : rnd(p, x, y, 24),
      );
      let head = pick(HEADS, rnd(p, x, y, 25));
      if (r < b.shadowRows) {
        body = shade(body, -0.4);
        head = shade(head, -0.4);
      }
      const [ca, cb] = crowdColors(p, travelling);
      const scarf = rnd(p, x, y, 26) < scarfChance;
      paintFan(s, life.fans, x, y, {
        head: S(head),
        body: S(body),
        hand: S(pick(SKIN, rnd(p, x, y, 27))),
        seat: b.seat,
        scarfA: scarf ? S(ca) : TRANSPARENT,
        scarfB: S(cb),
        period: 9 + Math.floor(rnd(p, id, 1, 28) * 14),
        offset: Math.floor(rnd(p, id, 2, 28) * 250),
        withHero: !away || travelling,
      });
    }
  }
}

/** Light steps cutting a block of seats into sections. */
function aisles(
  s: Surface,
  p: Paint,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  every: number,
): void {
  const { S, g } = p;
  const a = S(P.concreteLight);
  const b = S(P.concrete);
  const start = g.cx + (((((x0 - g.cx) % every) + every) % every) - every);
  for (let x = start; x < x1; x += every) {
    if (x < x0 + 3 || x > x1 - 5) continue;
    for (let y = y0; y < y1; y++) s.hline(x, y, 2, (y - y0) % 2 === 0 ? a : b);
  }
}

// ---------------------------------------------------------------------------
// Boards along the far touchline
// ---------------------------------------------------------------------------

interface BoardLook {
  bg: Color;
  fg: Color;
}

const BOARD_LOOKS: readonly BoardLook[] = [
  { bg: P.home, fg: P.chalk },
  { bg: P.chalk, fg: P.night },
  { bg: P.gold, fg: P.night },
  { bg: P.grassDeep, fg: P.chalk },
  { bg: P.night, fg: P.gold },
  { bg: P.skyMid, fg: P.chalk },
];

/** A row of painted boards on posts, words from the labels (plain stripes without). */
export function paintBoards(s: Surface, p: Paint, y: number, h: number): void {
  const { g, S } = p;
  const words = p.labels.boards ?? [];
  s.rect(0, y, g.w, h, S(P.woodDark));
  let x = -((g.w * 7) % 23);
  for (let i = 0; x < g.w; i++) {
    const look = BOARD_LOOKS[(i + p.seed) % BOARD_LOOKS.length];
    const word = words.length > 0 ? words[i % words.length].toUpperCase() : "";
    const bw = word ? measureText(word, SMALL) + 8 : 22 + (i % 3) * 6;
    s.rect(x, y, bw, h - 1, S(look.bg));
    s.hline(x, y, bw, S(shade(look.bg, 0.2)));
    if (word) {
      drawText(
        s,
        word,
        x + 4,
        y + Math.max(1, Math.floor((h - 6) / 2)),
        S(look.fg),
        SMALL,
      );
    } else {
      s.rect(x + 3, y + 2, bw - 6, Math.max(1, h - 5), S(look.fg));
      s.rect(x + 5, y + 3, bw - 10, Math.max(1, h - 7), S(look.bg));
    }
    s.vline(x + bw, y, h, S(P.woodDark));
    x += bw + 1;
  }
  s.hline(0, y + h - 1, g.w, S(shade(P.woodDark, -0.2)));
}

// ---------------------------------------------------------------------------
// Floodlights
// ---------------------------------------------------------------------------

function lampGlow(s: Surface, p: Paint, x: number, y: number, r: number): void {
  if (!p.flood) return;
  s.disc(x, y, r * 2, P.nightGlow, 0.25);
  s.disc(x, y, r * 1.2, P.mist, 0.25);
}

/** A thin pole with a small head of four lamps (tier 2). */
function paintPole(
  s: Surface,
  p: Paint,
  x: number,
  top: number,
  foot: number,
): void {
  const { S } = p;
  lampGlow(s, p, x, top + 1, 6);
  s.vline(x, top + 3, foot - top - 3, S(P.steel));
  s.rect(x - 2, top, 5, 3, S(P.slate));
  s.px(x - 1, top + 1, p.flood ? P.white : S(P.mist));
  s.px(x + 1, top + 1, p.flood ? P.white : S(P.mist));
}

/** A lattice pylon at a corner with a big head of lamps (tier 3). */
function paintPylon(
  s: Surface,
  p: Paint,
  x: number,
  top: number,
  foot: number,
): void {
  const { S } = p;
  const HW = 11;
  const HH = 8;
  lampGlow(s, p, x, top + 4, 9);
  const legL = S(P.concrete);
  const legR = S(P.concreteDark);
  const brace = S(P.concreteLight);
  for (let y = top + HH; y < foot; y++) {
    const r = (y - top) % 4;
    const cell = Math.floor((y - top) / 4);
    if (r === 0) s.hline(x - 1, y, 3, brace);
    else s.px(cell % 2 === 0 ? x - 2 + r : x + 2 - r, y, brace);
    s.px(x - 2, y, legL);
    s.px(x + 2, y, legR);
  }
  const hx = x - (HW >> 1);
  s.rect(hx, top, HW, HH, S(P.slate));
  s.hline(hx, top, HW, S(P.steel));
  for (let j = 0; j < 2; j++) {
    for (let i = 0; i < 3; i++) {
      const lx = hx + 1 + i * 4;
      const ly = top + 1 + j * 3;
      s.rect(lx, ly, 2, 2, p.flood ? P.white : S(P.mist));
      if (!p.flood) s.px(lx, ly, S(P.steelHi));
    }
  }
}

// ---------------------------------------------------------------------------
// Tier 2: the small ground
// ---------------------------------------------------------------------------

export function paintClubGround(s: Surface, p: Paint, life: Life): void {
  const { g, S, E } = p;
  const F = g.F;
  // four thin poles, then everything in front of them
  for (const off of [-52, -4, 40, 88])
    paintPole(s, p, sx(g, off), F - 60, F - 7);

  // the tea hut, steam from its pipe
  const tx = sx(g, 30);
  s.rect(tx, F - 12, 14, 12, S(P.chalk));
  for (let i = 2; i < 14; i += 3) s.vline(tx + i, F - 11, 11, S(P.mist));
  for (let i = 0; i < 16; i++) {
    s.vline(tx - 1 + i, F - 15, 3, S((i >> 1) % 2 === 0 ? P.home : P.chalk));
  }
  s.hline(tx - 1, F - 13, 16, S(P.homeDark));
  s.rect(tx + 3, F - 10, 8, 4, p.lamps ? P.goldLight : S(P.night));
  s.hline(tx + 2, F - 6, 10, S(P.wood));
  s.vline(tx + 11, F - 19, 4, S(P.steel));
  life.steam.push({ x: tx + 11, y: F - 20 });

  // the small covered stand
  const x0 = sx(g, -46);
  const x1 = sx(g, 26);
  s.rect(x0, F - 24, x1 - x0, 17, S(P.wood));
  for (let x = x0 + 2; x < x1; x += 3) s.vline(x, F - 24, 4, S(P.woodDark));
  fanBlock(s, p, life, {
    x0: x0 + 2,
    x1: x1 - 2,
    y: F - 20,
    rows: 3,
    seat: S(P.woodDark),
    empty: 0.22,
    shadowRows: 1,
  });
  // posts, ends and the roof with its fascia in his colour
  for (const x of [x0, x0 + 1, x1 - 2, x1 - 1])
    s.vline(x, F - 25, 18, S(P.wood));
  const mid = (x0 + x1) >> 1;
  s.vline(mid, F - 24, 17, S(P.steel));
  s.rect(x0 - 2, F - 28, x1 - x0 + 4, 3, S(P.home));
  s.hline(x0 - 2, F - 28, x1 - x0 + 4, S(P.homeLight));
  s.hline(x0 - 2, F - 25, x1 - x0 + 4, S(P.night));
  // pigeons on the roof
  life.perched.push({ x: x0 + 9, y: F - 28 }, { x: x1 - 14, y: F - 28 });
  life.perchColor = E(P.steel);

  // people standing behind the fence either side
  const coats: readonly Color[] = [P.slate, P.night, P.home, P.steel, P.wood];
  let n = 0;
  for (let x = 4; x < g.w - 3; x += 6) {
    if (x > x0 - 4 && x < x1 + 3) continue;
    if (x > tx - 4 && x < tx + 17) continue;
    if (rnd(p, x, 30, 31) < 0.4) continue;
    life.watchers.push(
      watcher(
        p,
        x,
        F - 2,
        rnd(p, x, 31, 31) < 0.15,
        E(coats[n % coats.length]),
        n + 40,
      ),
    );
    n++;
  }
  life.watcherClip = F - 7;
  paintBoards(s, p, F - 7, 7);
}

// ---------------------------------------------------------------------------
// Tier 3: a proper ground
// ---------------------------------------------------------------------------

export function paintProperGround(s: Surface, p: Paint, life: Life): void {
  const { g, S, E } = p;
  const F = g.F;
  paintPylon(s, p, sx(g, -62), F - 92, F - 30);
  paintPylon(s, p, sx(g, 68), F - 92, F - 26);

  // the open terrace, from the gap by his house to the right
  const tx0 = sx(g, 22);
  s.rect(tx0, F - 30, g.w - tx0, 23, S(P.concrete));
  s.hline(tx0, F - 30, g.w - tx0, S(P.concreteLight));
  fanBlock(s, p, life, {
    x0: tx0 + 2,
    x1: g.w,
    y: F - 27,
    rows: 5,
    seat: S(P.concreteDark),
    empty: 0.08,
    shadowRows: 0,
  });
  for (const y of [F - 20, F - 12]) {
    for (let x = tx0 + 4; x < g.w; x += 14) s.hline(x, y, 10, S(P.steel));
  }
  s.vline(tx0, F - 30, 23, S(P.concreteLight));
  s.vline(tx0 + 1, F - 30, 23, S(P.concrete));

  // the scoreboard on its legs above the terrace
  const bx = sx(g, 34);
  const legC = S(P.slate);
  s.vline(bx + 4, F - 36, 6, legC);
  s.vline(bx + 25, F - 36, 6, legC);
  const field = drawLedPanel(s, bx, F - 47, 30, 11, { grade: S });
  life.scoreboard = {
    field,
    text: (p.labels.boards?.[0] ?? "").toUpperCase(),
  };

  // the main stand, from the left edge to the gap
  const x1 = sx(g, 4);
  s.rect(0, F - 40, x1, 33, S(P.concrete));
  for (let x = 2; x < x1; x += 6)
    s.rect(x, F - 39, 3, 2, p.lamps ? P.gold : S(P.slate));
  fanBlock(s, p, life, {
    x0: 0,
    x1: x1 - 2,
    y: F - 36,
    rows: 7,
    seat: S(P.slate),
    empty: 0.04,
    shadowRows: 1,
  });
  aisles(s, p, 0, x1 - 2, F - 36, F - 8, 36);
  // the roof: a fascia in his colour, a dark underside, columns down to the front wall
  s.rect(0, F - 46, x1 + 2, 3, S(P.home));
  s.hline(0, F - 46, x1 + 2, S(P.homeLight));
  s.hline(0, F - 43, x1 + 2, S(P.night));
  s.hline(0, F - 42, x1 + 2, S(P.ink));
  if (p.flood) for (let x = 3; x < x1; x += 8) s.hline(x, F - 42, 2, P.white);
  for (let x = x1 - 4; x > 0; x -= 40) s.vline(x, F - 41, 33, S(P.steelHi));
  s.rect(x1 - 2, F - 46, 2, 39, S(P.concreteLight));
  s.hline(0, F - 8, x1, S(P.concreteLight));
  life.perched.push({ x: sx(g, -30), y: F - 46 }, { x: sx(g, -12), y: F - 46 });
  life.perchColor = E(P.steel);

  paintBoards(s, p, F - 7, 7);
}

// ---------------------------------------------------------------------------
// Tiers 4 to 7: the stadium
// ---------------------------------------------------------------------------

/** Heights of the big stand above the far touchline. */
export const STAND = {
  roofTop: 71,
  upperTop: 63,
  balcony: 39,
  boxes: 37,
  lowerTop: 31,
  boards: 7,
} as const;

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
  const w = x1 - x0;
  if (w <= 0) return;
  // upper tier
  s.rect(x0, F - STAND.upperTop - 1, w, 2, S(P.night));
  fanBlock(s, p, life, {
    x0,
    x1,
    y: F - STAND.upperTop,
    rows: 6,
    seat: S(P.night),
    empty: 0,
    shadowRows: 2,
  });
  aisles(s, p, x0, x1, F - STAND.upperTop + 4, F - STAND.balcony, 48);
  // the balcony and a strip of boxes
  s.hline(x0, F - STAND.balcony, w, S(P.steelHi));
  s.hline(x0, F - STAND.balcony + 1, w, S(P.concrete));
  s.rect(x0, F - STAND.boxes, w, 5, S(P.ink));
  for (let x = x0 + ((g.cx - x0) % 6) - 6; x < x1; x += 6) {
    const r = rnd(p, x, 40, 41);
    const lit = p.lamps && r > 0.3;
    s.rect(
      x,
      F - STAND.boxes + 1,
      5,
      3,
      lit ? (r < 0.6 ? P.goldLight : P.gold) : S(r < 0.5 ? P.steel : P.slate),
    );
    if (!lit) s.px(x, F - STAND.boxes + 1, S(P.mist));
  }
  s.hline(x0, F - STAND.lowerTop - 1, w, S(P.concreteDark));
  // lower tier
  fanBlock(s, p, life, {
    x0,
    x1,
    y: F - STAND.lowerTop,
    rows: 6,
    seat: S(P.concreteDark),
    empty: 0,
    shadowRows: 0,
  });
  aisles(s, p, x0, x1, F - STAND.lowerTop, F - 8, 48);
  s.hline(x0, F - 8, w, S(P.concreteLight));
  // the roof
  const top = F - STAND.roofTop;
  s.rect(x0, top, w, 6, S(P.concreteLight));
  s.hline(x0, top, w, S(P.steelHi));
  s.hline(x0, top + 3, w, S(p.tier >= 5 ? P.chalk : P.home));
  s.hline(x0, top + 4, w, S(p.tier >= 5 ? P.home : P.homeDark));
  s.rect(x0, top + 6, w, 2, S(P.ink));
  if (p.flood) {
    s.dither(x0, top - 6, w, 6, P.nightGlow, 0.25);
    for (let x = x0 + 2; x < x1; x += 8) {
      s.hline(x, top + 6, 3, P.white);
      s.px(x + 1, top + 7, P.goldLight);
    }
  }
  if (gantry) {
    const gx = sx(g, -14) - 11;
    const gy = F - STAND.balcony - 3;
    s.vline(gx + 2, top + 8, gy - top - 8, S(P.steel));
    s.vline(gx + 19, top + 8, gy - top - 8, S(P.steel));
    s.rect(gx, gy, 22, 2, S(P.slate));
    s.hline(gx, gy, 22, S(P.steelHi));
    for (const cxm of [gx + 5, gx + 14]) {
      // an operator behind a camera
      s.px(cxm - 2, gy - 6, S(P.hairDark));
      s.rect(cxm - 3, gy - 5, 3, 3, S(P.night));
      s.rect(cxm, gy - 4, 4, 3, S(P.ink));
      s.px(cxm + 4, gy - 3, S(P.steel));
      s.vline(cxm + 1, gy - 1, 1, S(P.slate));
    }
  }
}

export function paintStadium(s: Surface, p: Paint, life: Life): void {
  const { g, S, E } = p;
  const F = g.F;
  const gapL = sx(g, 36);
  const gapR = sx(g, 68);

  // the low corner: one open tier, the street and the spire over it
  s.rect(gapL, F - 27, gapR - gapL, 20, S(P.concrete));
  s.hline(gapL, F - 27, gapR - gapL, S(P.concreteLight));
  fanBlock(s, p, life, {
    x0: gapL + 1,
    x1: gapR,
    y: F - 23,
    rows: 4,
    seat: S(P.concreteDark),
    empty: 0,
    shadowRows: 0,
  });
  s.hline(gapL, F - 8, gapR - gapL, S(P.concreteLight));

  bigStand(s, p, life, 0, gapL, true);
  bigStand(s, p, life, gapR, g.w, false);
  // the stands' ends: plain concrete walls
  s.rect(gapL - 2, F - STAND.roofTop, 2, STAND.roofTop - 7, S(P.concrete));
  s.vline(gapL - 1, F - STAND.roofTop, STAND.roofTop - 7, S(P.concreteDark));
  if (gapR < g.w) {
    s.rect(gapR, F - STAND.roofTop, 2, STAND.roofTop - 7, S(P.concreteLight));
  }
  // a pigeon on the roof
  life.perched.push({ x: sx(g, -40), y: F - STAND.roofTop });
  life.perchColor = E(P.steel);

  // LED boards: a dark strip whose words crawl
  paintLedBoards(s, p, life);

  if (p.tier >= 5) dressForNation(s, p, life, gapL, gapR);
  if (p.tier >= 6) {
    life.flashes = 10;
    const y = F - STAND.lowerTop + 2;
    const [a, b] = crowdColors(p, false);
    life.giant.push(
      {
        x0: 0,
        x1: gapL,
        y,
        w: 34,
        h: 10,
        a: S(a),
        b: S(b),
        speed: 5,
        phase: 0.45,
      },
      {
        x0: 0,
        x1: gapL,
        y: y + 9,
        w: 28,
        h: 9,
        a: S(b),
        b: S(a),
        speed: 3,
        phase: 0.1,
      },
    );
    if (gapR < g.w) {
      life.giant.push({
        x0: gapR,
        x1: g.w,
        y: y + 4,
        w: 30,
        h: 10,
        a: S(a),
        b: S(b),
        speed: 4,
        phase: 0.6,
      });
    }
    const top = F - STAND.roofTop;
    life.beams.push(
      { x: sx(g, -70), y: top },
      { x: sx(g, -8), y: top },
      { x: sx(g, 80), y: top },
    );
    life.beamColor = P.steelHi;
  }
  if (p.tier >= 7) {
    life.fireworks = {
      x: 6,
      y: Math.max(4, F - STAND.roofTop - 50),
      w: Math.max(1, g.w - 12),
      h: 30,
    };
  }
}

function paintLedBoards(s: Surface, p: Paint, life: Life): void {
  const { g, S } = p;
  const y = g.F - 7;
  s.rect(0, y, g.w, 7, S(P.ink));
  s.hline(0, y, g.w, S(P.slate));
  s.hline(0, y + 6, g.w, S(P.night));
  const words = (p.labels.boards ?? []).map((w) => w.toUpperCase());
  // the strip: one lap of the words, each on its own colour
  const looks: readonly BoardLook[] = [
    { bg: P.ledOff, fg: P.amber },
    { bg: P.home, fg: P.chalk },
    { bg: P.ledOff, fg: P.ledGreen },
    { bg: P.chalk, fg: P.night },
    { bg: P.night, fg: P.gold },
  ];
  const parts = words.length > 0 ? words : ["", "", ""];
  let width = 0;
  const widths: number[] = [];
  for (const wd of parts) {
    const bw = Math.max(40, (wd ? measureText(wd, SMALL) : 0) + 16);
    widths.push(bw);
    width += bw;
  }
  // repeat the lap until it is wider than the screen, so a copy never shows a seam twice
  const laps = Math.max(1, Math.ceil(g.w / width));
  const strip = new Surface(width * laps, 5);
  let x = 0;
  for (let l = 0; l < laps; l++) {
    for (let i = 0; i < parts.length; i++) {
      const look = looks[(i + l) % looks.length];
      const lit = p.lamps;
      const bg = lit ? look.bg : S(look.bg);
      const fg = lit ? look.fg : S(look.fg);
      strip.rect(x, 0, widths[i], 5, bg);
      if (parts[i]) {
        drawText(
          strip,
          parts[i],
          x + Math.floor((widths[i] - measureText(parts[i], SMALL)) / 2),
          0,
          fg,
          SMALL,
        );
      } else {
        for (let k = 4; k < widths[i] - 4; k += 4)
          strip.rect(x + k, 1, 2, 3, fg);
      }
      strip.px(x + widths[i] - 1, 0, S(P.ink));
      strip.vline(x + widths[i] - 1, 0, 5, S(P.ink));
      x += widths[i];
    }
  }
  life.crawl = { x0: 0, x1: g.w, y: y + 1, strip, speed: 12 };
}

function dressForNation(
  s: Surface,
  p: Paint,
  life: Life,
  gapL: number,
  gapR: number,
): void {
  const { g, S } = p;
  const F = g.F;
  const [a, b] = crowdColors(p, false);
  const top = F - STAND.roofTop;
  // flags along the roof
  let n = 0;
  for (let x = 6; x < g.w; x += 26) {
    if (x > gapL - 6 && x < gapR + 2) continue;
    life.flags.push({
      x,
      top: top - 9,
      poleH: 9,
      w: 6,
      h: 4,
      a: S(n % 2 === 0 ? a : b),
      b: S(n % 2 === 0 ? b : a),
      pole: S(P.steelHi),
      phase: n,
    });
    n++;
  }
  // banners hung over the balcony, the labels painted on them
  const words = (p.labels.banners ?? []).map((w) => w.toUpperCase());
  const y = F - STAND.balcony;
  const looks: readonly BoardLook[] = [
    { bg: P.chalk, fg: P.homeDark },
    { bg: P.home, fg: P.chalk },
    { bg: P.night, fg: P.gold },
  ];
  let x = sx(g, -60);
  for (let i = 0; x < gapL - 12; i++) {
    const word = words.length > 0 ? words[i % words.length] : "";
    const bw = word ? measureText(word, SMALL) + 6 : 16;
    if (x + bw > gapL - 2) break;
    const look = looks[i % looks.length];
    s.rect(x, y, bw, 8, S(look.bg));
    s.hline(x, y + 7, bw, S(shade(look.bg, -0.3)));
    if (word) drawText(s, word, x + 3, y + 1, S(look.fg), SMALL);
    else s.rect(x, y + 3, bw, 2, S(look.fg));
    x += bw + 22;
  }
  // little flags waved in the lower tier
  for (let k = 0; k < Math.round(g.w / 30); k++) {
    const fx = Math.floor(rnd(p, k, 50, 51) * g.w);
    if (fx > gapL - 6 && fx < gapR + 2) continue;
    const fy = F - STAND.lowerTop + 4 + 4 * Math.floor(rnd(p, k, 52, 51) * 4);
    life.flags.push({
      x: fx,
      top: fy - 5,
      poleH: 5,
      w: 4,
      h: 3,
      a: S(a),
      b: S(b),
      pole: S(P.woodDark),
      phase: k,
    });
  }
}
