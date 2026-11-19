/**
 * The career's ground at each tier, from above, in a little framed panel (2026-11-18): what
 * CLOSEST's and FURTHEST's maps show beside the place the footballer plays, while the map is
 * too far out to show the ground itself (~/scenes/map.ts). The same ladder as HOME's
 * (docs/GAME_DESIGN.md section 5.1), drawn small:
 *
 *   0 a park: grass, a path, trees, jumpers for goalposts, a bench
 *   1 a pitch with lines and little goals, a changing hut, a car
 *   2 one covered stand, a tea hut, four floodlight poles
 *   3 stands on three sides, an open terrace, a scoreboard, floodlights
 *   4 a full bowl: its roof ring, its crowd, the pitch
 *   5 the same in national colours: flags round it, a banner on the roof
 *   6 the final at night: a lit bowl, camera flashes, searchlights
 *   7 the trophy on the pitch, fireworks and confetti
 *
 * The crowd wears the mode's colours. BADGE_W x BADGE_H pixels at scale 1; `k` draws each
 * of them as a k x k square.
 */

import { type Color, Surface, hash2 } from "~/pixel";

import { P } from "./palette";

export const BADGE_W = 36;
export const BADGE_H = 26;

export interface BadgeColors {
  /** The frame's colour (the mode's). */
  frame: Color;
  /** The crowd's colours (the mode's). */
  dark: Color;
  base: Color;
  light: Color;
}

/** The badges, drawn once a tier and colours. */
const made = new Map<string, Surface>();

/** The ground at `tier` in its panel, its top left at (x, y), each pixel a k x k square. */
export function drawGroundBadge(
  s: Surface,
  x: number,
  y: number,
  tier: number,
  k: number,
  c: BadgeColors,
): void {
  const t = Math.max(0, Math.min(7, Math.round(tier)));
  const key = `${t}:${c.frame}:${c.dark}:${c.base}:${c.light}`;
  let badge = made.get(key);
  if (!badge) {
    badge = paint(t, c);
    made.set(key, badge);
  }
  const d = badge.data;
  for (let j = 0; j < BADGE_H; j++) {
    for (let i = 0; i < BADGE_W; i++) {
      s.rect(x + i * k, y + j * k, k, k, d[j * BADGE_W + i] as Color);
    }
  }
}

function paint(tier: number, c: BadgeColors): Surface {
  const b = new Surface(BADGE_W, BADGE_H);
  b.clear(P.ink);
  b.rect(1, 1, BADGE_W - 2, BADGE_H - 2, c.frame);
  b.rect(2, 2, BADGE_W - 4, BADGE_H - 4, P.ink);
  // the inside: 30 x 20 from (3, 3)
  const g = new Surface(30, 20);
  const night = tier >= 6;
  if (tier === 0) park(g);
  else if (tier <= 3) ground(g, tier, c);
  else bowl(g, tier, c, night);
  b.blit(g, 3, 3);
  return b;
}

/** Mown stripes, white lines and goals: a pitch in the box (x, y, w, h). */
function pitch(
  g: Surface,
  x: number,
  y: number,
  w: number,
  h: number,
  night = false,
): void {
  for (let i = 0; i < w; i++) {
    const even = Math.floor(i / 3) % 2 === 0;
    const col = night
      ? even
        ? P.grassLight
        : P.grass
      : even
        ? P.grass
        : P.grassLight;
    g.rect(x + i, y, 1, h, col);
  }
  const line = P.white;
  g.rect(x, y, w, 1, line);
  g.rect(x, y + h - 1, w, 1, line);
  g.rect(x, y, 1, h, line);
  g.rect(x + w - 1, y, 1, h, line);
  g.rect(x + Math.floor(w / 2), y, 1, h, line);
}

function crowdDots(
  g: Surface,
  x: number,
  y: number,
  w: number,
  h: number,
  c: BadgeColors,
  seed: number,
): void {
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const v = hash2(x + i, y + j, seed);
      g.px(x + i, y + j, v < 0.5 ? c.base : v < 0.8 ? c.light : c.dark);
    }
  }
}

function park(g: Surface): void {
  g.clear(P.grass);
  // a lighter lawn, the path across it
  g.rect(5, 4, 20, 12, P.grassLight);
  for (let i = 0; i < 30; i++) {
    const y = Math.round(17 - i * 0.36);
    g.px(i, y, P.chalk);
    g.px(i, y + 1, P.concreteLight);
  }
  // trees
  for (const [x, y] of [
    [3, 3],
    [26, 16],
    [25, 3],
    [10, 17],
  ]) {
    g.disc(x, y, 2, P.grassDeep);
    g.px(x - 1, y - 1, P.grassDark);
  }
  // jumpers for goalposts, the kids, the ball
  g.px(8, 7, P.home);
  g.px(8, 11, P.home);
  g.px(21, 7, P.away);
  g.px(21, 11, P.away);
  for (const [x, y] of [
    [12, 8],
    [17, 10],
    [15, 12],
    [11, 11],
  ]) {
    g.px(x, y, P.chalk);
  }
  g.px(14, 9, P.white);
  // a bench and a dog
  g.rect(1, 13, 3, 1, P.wood);
  g.px(19, 14, P.woodDark);
}

function ground(g: Surface, tier: number, c: BadgeColors): void {
  g.clear(P.grassDark);
  if (tier === 1) {
    pitch(g, 6, 4, 18, 12);
    g.rect(5, 8, 1, 4, P.white);
    g.rect(24, 8, 1, 4, P.white);
    // the changing hut, a car, a few parents on the line
    g.rect(1, 1, 4, 3, P.wood);
    g.rect(1, 1, 4, 1, P.woodDark);
    g.rect(26, 16, 3, 2, P.home);
    for (const x of [9, 13, 18]) g.px(x, 17, P.chalk);
    return;
  }
  if (tier === 2) {
    pitch(g, 6, 5, 18, 11);
    // one covered stand along the top, its roof's shadow; a tea hut; four poles
    g.rect(8, 0, 14, 3, P.concreteLight);
    g.rect(8, 3, 14, 1, P.concrete);
    g.rect(25, 1, 3, 2, P.chalk);
    for (const [x, y] of [
      [4, 4],
      [25, 4],
      [4, 16],
      [25, 16],
    ]) {
      g.px(x, y, P.steelHi);
      g.px(x + 1, y + 1, P.grassDeep);
    }
    // the boards round the pitch
    for (let i = 6; i < 24; i += 2) g.px(i, 17, P.chalk);
    return;
  }
  // tier 3: stands on three sides and an open terrace
  pitch(g, 7, 5, 16, 10);
  g.rect(5, 0, 20, 3, P.concreteLight);
  crowdDots(g, 5, 3, 20, 1, c, 3);
  g.rect(0, 4, 4, 12, P.concrete);
  crowdDots(g, 4, 5, 2, 10, c, 4);
  g.rect(26, 4, 4, 12, P.concrete);
  crowdDots(g, 24, 5, 2, 10, c, 5);
  crowdDots(g, 8, 16, 14, 2, c, 6);
  g.rect(12, 18, 6, 2, P.ink);
  g.px(13, 18, P.amber);
  g.px(16, 18, P.amber);
  for (const [x, y] of [
    [0, 0],
    [28, 0],
    [0, 18],
    [28, 18],
  ]) {
    g.rect(x, y, 2, 2, P.steelHi);
  }
}

function bowl(g: Surface, tier: number, c: BadgeColors, night: boolean): void {
  // a city round it by day, so that a green crowd is not lost in the grass
  g.clear(night ? P.night : P.concrete);
  // the concourse round it, the roof ring, the crowd under it, the pitch
  g.ellipse(15, 10, 14, 9, night ? P.slate : P.concreteLight, true);
  g.ellipse(15, 10, 12, 8, night ? P.steelHi : P.white, true);
  if (!night) {
    // the roof lit from the top left: its far side bright, its near right in shade
    for (let j = 0; j < 20; j++) {
      for (let i = 0; i < 30; i++) {
        const dx = (i - 15) / 12;
        const dy = (j - 10) / 8;
        if (dx * dx + dy * dy <= 1 && dx + dy > 0.6) g.px(i, j, P.steelHi);
      }
    }
  }
  g.ellipse(15, 10, 9, 6, c.base, true);
  for (let j = 4; j < 17; j++) {
    for (let i = 6; i < 25; i++) {
      const dx = (i - 15) / 9;
      const dy = (j - 10) / 6;
      if (dx * dx + dy * dy <= 1) crowdDots(g, i, j, 1, 1, c, 7);
    }
  }
  // the pitch over the crowd's middle
  pitch(g, 9, 7, 13, 7, night);
  if (tier === 5) {
    // national colours: flags round it, a banner on the roof
    for (let a = 0; a < 360; a += 20) {
      const r = (a * Math.PI) / 180;
      const x = Math.round(15 + Math.cos(r) * 14);
      const y = Math.round(10 + Math.sin(r) * 9.4);
      g.px(x, y, (a / 20) % 2 === 0 ? P.home : P.white);
    }
    g.rect(10, 2, 11, 1, P.home);
    g.rect(10, 3, 11, 1, P.white);
  }
  if (night) {
    // camera flashes in the crowd; searchlights out of the roof
    for (let i = 0; i < 16; i++) {
      const a = hash2(i, 1, tier) * Math.PI * 2;
      const r = 0.82 + hash2(i, 2, tier) * 0.15;
      g.px(
        Math.round(15 + Math.cos(a) * 9 * r),
        Math.round(10 + Math.sin(a) * 6 * r),
        P.white,
      );
    }
    g.line(6, 4, 1, 0, P.goldLight);
    g.line(24, 4, 29, 0, P.goldLight);
  }
  if (tier === 7) {
    // the cup on the centre spot, fireworks, confetti
    g.rect(14, 8, 3, 2, P.gold);
    g.px(15, 10, P.goldDark);
    g.rect(14, 11, 3, 1, P.goldDark);
    for (const [x, y, col] of [
      [5, 4, P.gold],
      [25, 3, P.away],
      [15, 2, P.home],
    ] as const) {
      for (let a = 0; a < 360; a += 45) {
        const r = (a * Math.PI) / 180;
        g.px(
          Math.round(x + Math.cos(r) * 2.5),
          Math.round(y + Math.sin(r) * 2.5),
          col,
        );
      }
    }
    for (let i = 0; i < 24; i++) {
      const cols = [P.gold, P.home, P.white, P.away];
      g.px(
        Math.floor(hash2(i, 3, 7) * 30),
        Math.floor(hash2(i, 4, 7) * 20),
        cols[i % 4],
      );
    }
  }
}
