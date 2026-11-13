/**
 * The far side of the career ground: everything above the far touchline. His street is
 * always there at the back (the terrace of houses with his red door, the chimneys, the
 * church spire, the trees, the street lamp); each tier builds in front of it.
 *
 *   tier 0  the hedge and railings, two mates
 *   tier 1  + a rope on stakes, the wooden changing hut, a corner flag, parents
 *   tier 2  + a fence of painted boards, a small covered stand, a tea hut, four poles
 *   tier 3  a main stand, his house in a gap, an open terrace, a scoreboard, pylons
 *   tier 4+ the stadium (stadium.ts), the end behind the goal (end.ts)
 *
 * Every painter draws in final colours: the street with `distant()`, the ground's own
 * structures with `p.S` (floodlit from tier 2), lamps and lit windows in raw colour.
 */

import { paintedFont } from "~/art/lettering";
import { drawLedPanel } from "~/art/led";
import { P } from "~/art/palette";
import {
  FONT_3x5,
  TRANSPARENT,
  drawText,
  hash2,
  measureText,
  shade,
  type Color,
  type Surface,
  type TextOptions,
} from "~/pixel";
import { aisles, fanBlock } from "./crowd";
import { endFor } from "./end";
import {
  BOARD_LOOKS,
  CHURCH,
  DOORS,
  STREET,
  TREES_FAR,
  WALLS,
  WASHING_ALLEY,
  isAlley,
} from "./far-tables";
import type { Life } from "./life";
import {
  addCornerLights,
  addLightLine,
  paintCity,
  paintClubGroundNG,
  paintHoloBoards,
  paintParkEdge,
  paintPod,
  paintProperGroundNG,
} from "./nextgen-low";
import {
  CHIMNEY_H,
  HAIR,
  HOUSE_W,
  ROOF_H,
  SKIN,
  WALL_H,
  across,
  crowdColors,
  inPocket,
  pick,
  rnd,
  sx,
  type Paint,
} from "./paint";
import { nextgenCoat, nextgenWatcherLights } from "./nextgen-people";
import { retroCoat, retroWatcherHat } from "./retro-people";
import type { Watcher } from "./people";
import { paintBandstand, paintGreenTrees, paintRetroStreet } from "./retro-low";
import {
  RETRO_BOARD_LOOKS,
  paintGable,
  paintGableClock,
  paintHandScoreboard,
  paintTimberLamp,
  retroBoardX,
  retroTowerLamps,
} from "./retro-club";

/** Painted words (.snaps/detail2/DECISIONS.md 1): the painted small font. */
let painted: TextOptions | null = null;
const words = (): TextOptions => (painted ??= { font: paintedFont(FONT_3x5) });

// ---------------------------------------------------------------------------
// Leaves
// ---------------------------------------------------------------------------

/**
 * A round crown of leaves: a bumpy rim, the lit side top left, clumps of leaves in shade
 * bottom right and a few lit ones top left (clusters, never single noise).
 */
function canopy(
  s: Surface,
  cx: number,
  cy: number,
  r: number,
  deep: Color,
  mid: Color,
  lit: Color,
  salt: number,
): void {
  s.disc(cx, cy, r, deep);
  // the rim: lumps of leaves
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + salt;
    const bx = Math.round(cx + Math.cos(a) * r * 0.78);
    const by = Math.round(cy + Math.sin(a) * r * 0.72);
    s.disc(bx, by, Math.max(2, Math.round(r * 0.32)), deep);
  }
  s.disc(cx - Math.round(r * 0.18), cy - Math.round(r * 0.22), r * 0.68, mid);
  s.disc(cx - Math.round(r * 0.42), cy - Math.round(r * 0.5), r * 0.36, lit);
  // leaf clumps: a two-pixel dash and the pixel over its left end
  for (let y = cy - r + 2; y < cy + r - 1; y += 3) {
    for (let x = cx - r + 1 + ((y - cy) & 2); x < cx + r - 1; x += 4) {
      const h = hash2(x, y, salt * 97 + 11);
      if (h > 0.45) continue;
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy > (r - 2) * (r - 2)) continue;
      const upLeft = dx + dy < -r * 0.4;
      const c = upLeft ? (h < 0.2 ? lit : mid) : h < 0.25 ? deep : mid;
      s.px(x, y, c);
      s.px(x + 1, y, c);
      s.px(x, y - 1, c);
    }
  }
}

// ---------------------------------------------------------------------------
// His street
// ---------------------------------------------------------------------------

export function paintStreet(s: Surface, p: Paint, life: Life): void {
  if (p.era === "nextgen") return paintCity(s, p, life);
  const { g } = p;
  farTrees(s, p);
  // RETRO's own street: viaduct, mill, terraces, gas lamps (retro-low.ts)
  if (p.era === "retro")
    return paintRetroStreet(s, p, life, () => church(s, p));
  church(s, p);
  const i0 = Math.floor(-g.houseX / HOUSE_W) - 1;
  const i1 = Math.ceil((g.w - g.houseX) / HOUSE_W) + 1;
  for (let i = i0; i <= i1; i++) {
    const x = g.houseX + i * HOUSE_W;
    if (isAlley(i) || i === WASHING_ALLEY) alley(s, p, life, x, i);
    else house(s, p, life, x, i);
  }
  streetLamp(s, p);
}

/** A low line of trees far behind the street: rounded crowns, lit on their left. */
function farTrees(s: Surface, p: Paint): void {
  const { g, D } = p;
  const base = D(P.grassDark, TREES_FAR);
  const top = D(P.grass, TREES_FAR);
  const deep = D(P.grassDeep, TREES_FAR);
  const B = g.B;
  const CL = 18;
  const n = CL + 6;
  for (let c = -1; c * CL < g.w + CL; c++) {
    const r = rnd(p, c, 0, 1);
    const hgt = 14 + Math.floor(r * 7) * 2;
    const x0 = c * CL - 4;
    for (let i = 0; i < n; i++) {
      const edge = Math.min(i, n - 1 - i);
      const drop = edge === 0 ? 5 : edge === 1 ? 3 : edge === 2 ? 1 : 0;
      // a second, lower crown in the middle of the clump gives it a lumpy top
      const dip = i > 9 && i < 13 ? 1 : 0;
      const y = B - hgt + drop + dip;
      s.vline(x0 + i, y, B - y, base);
      s.px(x0 + i, y, top);
      if (i < n / 2 && edge > 1) s.px(x0 + i, y + 1, top);
      // the shaded underside of the crown on the right
      if (i > n / 2 && (i + c) % 3 === 0) s.px(x0 + i, y + 4, deep);
    }
    for (let k = 0; k < 3; k++) {
      const lx = x0 + 4 + Math.floor(rnd(p, c, 2 + k, 1) * (n - 8));
      const ly = B - Math.floor(hgt * (0.3 + rnd(p, c, 6 + k, 1) * 0.4));
      s.hline(lx, ly, 2, deep);
    }
  }
}

/**
 * The church behind the street: the nave, its roof and tall windows, a tower with
 * battlements, a louvred belfry and a clock, the spire's slates lit on the left, the cross.
 * The tower's middle is between columns `x` and `x + 1`.
 */
function church(s: Surface, p: Paint): void {
  const { g, D } = p;
  const B = g.B;
  const x = g.spireX;
  const d = (c: Color): Color => D(c, CHURCH);
  const stone = d(P.concreteLight);
  const stoneLo = d(P.concrete);
  const roof = d(P.slate);
  const dark = d(P.night);
  // the nave, mostly behind the roofs
  s.rect(x + 8, B - 42, 48, 42, stone);
  for (let y = B - 38; y < B; y += 6) s.hline(x + 9, y, 46, stoneLo);
  for (const wx of [x + 16, x + 28, x + 40]) {
    // a tall window with a pointed top
    const glass = p.lamps ? P.goldDark : dark;
    s.rect(wx, B - 34, 4, 10, glass);
    s.hline(wx + 1, B - 35, 2, glass);
    if (p.lamps) s.rect(wx + 1, B - 33, 2, 8, P.gold);
    s.hline(wx - 1, B - 24, 6, d(P.chalk));
  }
  for (let i = 0; i < 10; i++) s.hline(x + 8 + i, B - 50 + i, 56 - 2 * i, roof);
  s.hline(x + 8, B - 50, 56, d(P.steel));
  s.hline(x + 17, B - 41, 38, d(shade(P.slate, -0.2)));
  // the tower: lit face left, its shaded side right
  s.rect(x - 8, B - 62, 18, 62, stone);
  s.vline(x + 8, B - 62, 62, stoneLo);
  s.vline(x + 9, B - 62, 62, stoneLo);
  for (let y = B - 56; y < B; y += 7) s.hline(x - 7, y, 15, stoneLo);
  // the parapet, a pinnacle at each corner
  s.hline(x - 10, B - 62, 22, d(P.steelHi));
  s.hline(x - 10, B - 61, 22, stone);
  for (const px of [x - 10, x + 8]) {
    s.rect(px, B - 66, 4, 4, stone);
    s.vline(px + 3, B - 66, 4, stoneLo);
    s.hline(px + 1, B - 68, 2, stone);
    s.px(px + 1, B - 67, d(P.steelHi));
  }
  // the belfry: a louvred opening under a pointed arch
  s.rect(x - 2, B - 56, 6, 9, dark);
  s.hline(x - 1, B - 57, 4, dark);
  s.px(x, B - 58, dark);
  s.px(x + 1, B - 58, dark);
  for (let y = B - 54; y < B - 48; y += 2) s.hline(x - 2, y, 6, stoneLo);
  // the clock: a round face with its hands
  s.disc(x, B - 41, 3, d(P.chalk));
  s.disc(x + 1, B - 41, 3, d(P.chalk));
  s.vline(x, B - 43, 3, d(P.ink));
  s.hline(x + 1, B - 41, 2, d(P.ink));
  s.circle(x, B - 41, 3, stoneLo);
  // the spire: two slate faces, lit left, with courses of slates
  const lit = d(P.steel);
  const shut = d(P.slate);
  const course = d(shade(P.slate, -0.25));
  for (let r = 0; r < 44; r++) {
    const half = 2 * Math.round(4 * (1 - r / 44));
    const y = B - 63 - r;
    if (half > 0) {
      s.hline(x - half + 1, y, half, lit);
      s.hline(x + 1, y, half, shut);
      if (r % 6 === 3) s.hline(x + 1, y, half, course);
    } else {
      s.px(x, y, lit);
      s.px(x + 1, y, shut);
    }
  }
  // the cross
  const gold = d(P.gold);
  s.rect(x, B - 114, 2, 7, gold);
  s.rect(x - 2, B - 112, 6, 2, gold);
  s.px(x, B - 114, d(P.goldLight));
}

/**
 * A window: a lit one glows gold with its curtains drawn back, a dark one at night is
 * night-blue, by day the glass shows the sky with a glint top left and net curtains.
 * `bars` lists the glazing bars as columns from `x`; a sash rail runs across the middle.
 */
function windowAt(
  s: Surface,
  p: Paint,
  x: number,
  y: number,
  w: number,
  h: number,
  lit: boolean,
  bars: readonly number[],
  frame: Color,
): void {
  const { D } = p;
  if (lit) {
    s.rect(x, y, w, h, P.goldLight);
    s.hline(x, y + h - 1, w, P.gold);
    s.vline(x, y, h, P.gold);
    s.vline(x + w - 1, y, h, P.gold);
  } else if (p.lamps) {
    s.rect(x, y, w, h, D(P.night, STREET));
    s.px(x, y, D(P.slate, STREET));
  } else {
    s.rect(x, y, w, h, D(P.steel, STREET));
    s.px(x, y, D(P.skyLow, STREET));
    s.px(x + 1, y, D(P.skyLow, STREET));
    s.px(x, y + 1, D(P.skyLow, STREET));
  }
  for (const b of bars) s.vline(x + b, y, h, frame);
  s.hline(x, y + (h >> 1) - 1, w, frame);
}

function house(s: Surface, p: Paint, life: Life, x: number, i: number): void {
  const { g, D } = p;
  const B = g.B;
  const d = (c: Color): Color => D(c, STREET);
  const his = i === 0;
  const wallC = his ? P.brick : pick(WALLS, rnd(p, i, 1, 3));
  s.rect(x, B - WALL_H, HOUSE_W, WALL_H, d(wallC));
  if (wallC === P.brick || wallC === P.brickLight || wallC === P.brickDark) {
    // courses of bricks: a faint joint every six pixels, staggered row by row
    const joint = d(shade(wallC, -0.14));
    for (let y = B - WALL_H + 2, row = 0; y < B; y += 3, row++) {
      for (let xx = x + 2 + (row & 1) * 3; xx < x + HOUSE_W - 1; xx += 6)
        s.px(xx, y, joint);
    }
  }
  s.vline(x, B - WALL_H, WALL_H, d(shade(wallC, -0.3)));
  s.vline(x + 1, B - WALL_H, WALL_H, d(shade(wallC, -0.12)));
  // the string course between the floors, its shadow under it
  s.hline(x, B - 18, HOUSE_W, d(shade(wallC, 0.2)));
  s.hline(x + 2, B - 17, HOUSE_W - 2, d(shade(wallC, -0.1)));
  const chalk = d(P.chalk);
  // the door in its surround, a fanlight over it, a step
  const doorC = his ? P.home : pick(DOORS, rnd(p, i, 2, 3));
  const night = p.lamps;
  const hall = night && (his || rnd(p, i, 3, 3) < 0.4);
  s.rect(x + 4, B - 17, 10, 17, chalk);
  s.rect(x + 6, B - 16, 6, 2, hall ? P.goldLight : d(P.steel));
  s.rect(x + 6, B - 13, 6, 13, d(doorC));
  const panel = d(shade(doorC, -0.28));
  s.frame(x + 7, B - 12, 4, 4, panel);
  s.frame(x + 7, B - 6, 4, 4, panel);
  s.hline(x + 8, B - 8, 2, d(P.gold));
  s.px(x + 10, B - 9, d(P.goldLight));
  s.hline(x + 3, B - 1, 12, d(P.concreteLight));
  // the bay downstairs, two sash windows upstairs; at night some are lit, his always
  s.hline(x + 17, B - 15, 12, chalk);
  windowAt(s, p, x + 18, B - 14, 10, 8, hall, [3, 6], chalk);
  s.hline(x + 17, B - 6, 12, chalk);
  s.hline(x + 18, B - 5, 10, d(shade(wallC, -0.22)));
  const upL = night && (his || rnd(p, i, 4, 3) < 0.3);
  const upR = night && rnd(p, i, 5, 3) < 0.25;
  for (const [wx, lit] of [
    [x + 6, upL],
    [x + 20, upR],
  ] as const) {
    s.hline(wx - 1, B - 31, 8, chalk);
    windowAt(s, p, wx, B - 30, 6, 8, lit, [], chalk);
    s.hline(wx - 1, B - 22, 8, chalk);
    s.hline(wx, B - 21, 6, d(shade(wallC, -0.22)));
  }
  if (his) {
    // a window box of flowers in his colour
    s.rect(x + 18, B - 4, 10, 2, d(P.woodDark));
    s.hline(x + 18, B - 4, 10, d(P.wood));
    for (let k = 0; k < 10; k += 2) {
      const c = d(k % 4 === 0 ? P.home : P.homeLight);
      s.px(x + 18 + k, B - 6, c);
      s.px(x + 19 + k, B - 5, d(P.grassDark));
      s.px(x + 18 + k, B - 5, c);
    }
  }
  // the downpipe from the gutter at its right
  s.vline(x + HOUSE_W - 2, B - WALL_H, WALL_H - 1, d(P.concreteDark));
  s.hline(x + HOUSE_W - 3, B - WALL_H, 3, d(P.concreteDark));
  // the roof: a lit ridge, courses of slates, the gutter
  const top = B - WALL_H - ROOF_H;
  s.rect(x, top, HOUSE_W, ROOF_H, d(P.slate));
  s.hline(x, top, HOUSE_W, d(P.steel));
  s.hline(x, top + 1, HOUSE_W, d(shade(P.slate, 0.12)));
  for (let r = 3; r < ROOF_H - 2; r += 3) {
    const off = ((r / 3) & 1) * 2 + (i & 1);
    for (let k = 1 + off; k < HOUSE_W; k += 4)
      s.px(x + k, top + r, d(P.concreteDark));
  }
  s.hline(x, B - WALL_H - 2, HOUSE_W, d(P.concreteDark));
  s.hline(x, B - WALL_H - 1, HOUSE_W, d(P.night));
  // a chimney stack on every other party wall, straddling it, two pots on top
  if ((i & 1) === 0) {
    const cx = x - 4;
    const cTop = top - CHIMNEY_H;
    s.rect(cx, cTop, 8, CHIMNEY_H, d(P.brickDark));
    s.vline(cx, cTop, CHIMNEY_H, d(P.brick));
    s.hline(cx + 1, cTop + 4, 7, d(shade(P.brickDark, -0.2)));
    s.hline(cx - 1, cTop, 10, d(P.brick));
    s.hline(cx - 1, cTop + 1, 10, d(shade(P.brick, -0.15)));
    for (const px of [cx, cx + 5]) {
      s.rect(px, cTop - 3, 2, 3, d(P.brickLight));
      s.vline(px + 1, cTop - 2, 2, d(P.brick));
    }
    if (rnd(p, i, 6, 3) < 0.5 || i === 2)
      life.smoke.push({ x: cx, y: cTop - 4 });
  }
}

function alley(s: Surface, p: Paint, life: Life, x: number, i: number): void {
  const { g, D } = p;
  const B = g.B;
  const d = (c: Color): Color => D(c, STREET);
  // a garden wall with its coping
  s.rect(x, B - 6, HOUSE_W, 6, d(P.brickDark));
  s.hline(x, B - 7, HOUSE_W, d(P.concreteLight));
  s.hline(x, B - 6, HOUSE_W, d(P.brick));
  for (let k = 2; k < HOUSE_W; k += 6) s.px(x + k, B - 3, d(P.brick));
  if (i === WASHING_ALLEY) {
    const post = d(P.woodDark);
    for (const px of [x + 2, x + 28]) {
      s.rect(px, B - 28, 2, 22, post);
      s.vline(px, B - 28, 22, d(P.wood));
    }
    // the line: a cord, lit on top
    s.hline(x + 2, B - 28, 28, d(P.mist));
    s.hline(x + 4, B - 27, 24, d(P.steel));
    life.washingPosts = d(P.chalk);
    life.washingLine = d(P.steel);
    life.washing = {
      y: B - 28,
      items: [
        { x: x + 5, w: 8, h: 9, c: d(P.home), low: d(P.homeDark) },
        { x: x + 15, w: 7, h: 11, c: d(P.chalk), low: d(P.mist) },
        { x: x + 24, w: 3, h: 7, c: d(P.skyMid), low: d(P.steel) },
      ],
    };
    return;
  }
  // a tree over the wall
  const tx = x + 16;
  s.rect(tx, B - 20, 2, 14, d(P.woodDark));
  s.px(tx - 1, B - 7, d(P.woodDark));
  s.px(tx + 2, B - 7, d(P.woodDark));
  canopy(s, tx, B - 32, 12, d(P.grassDeep), d(P.grassDark), d(P.grass), i & 7);
}

/** The street lamp left of the stage: a post, a curled arm and a lantern. */
function streetLamp(s: Surface, p: Paint): void {
  const { g, D } = p;
  const x = sx(g, -6);
  const head = g.B - 52;
  const iron = D(P.night, 0.15);
  const ironLit = D(P.slate, 0.15);
  s.vline(x, head + 2, g.F - head - 2, ironLit);
  s.vline(x + 1, head + 2, g.F - head - 2, iron);
  // the arm, curled where it meets the post
  s.hline(x, head, 8, iron);
  s.hline(x + 2, head + 1, 2, iron);
  s.px(x + 2, head + 2, iron);
  s.px(x + 7, head + 1, iron);
  // the lantern: a hood, the glass, a finial under it
  s.hline(x + 4, head + 2, 7, iron);
  s.hline(x + 5, head + 6, 5, iron);
  s.px(x + 7, head + 7, iron);
  if (p.lamps) {
    s.disc(x + 7, head + 4, 12, P.amberDim, 0.25);
    s.disc(x + 7, head + 4, 6, P.amber, 0.25);
    s.rect(x + 5, head + 3, 5, 3, P.goldLight);
    s.px(x + 7, head + 4, P.white);
  } else {
    s.rect(x + 5, head + 3, 5, 3, D(P.mist, 0.15));
    s.px(x + 5, head + 3, D(P.white, 0.15));
  }
}

// ---------------------------------------------------------------------------
// The park
// ---------------------------------------------------------------------------

/** The hedge along the far side, and at tiers 0 and 1 the railings in front of it. */
export function paintHedge(
  s: Surface,
  p: Paint,
  railings: boolean,
  life: Life,
): void {
  if (p.era === "nextgen") return paintParkEdge(s, p, railings, life);
  const { g, E } = p;
  const F = g.F;
  const deep = E(P.grassDeep);
  const dark = E(P.grassDark);
  const leaf = E(P.grass);
  s.rect(0, F - 18, g.w, 18, deep);
  // the top: rounded lumps of leaves, lit on their left
  for (let c = 0; c * 8 < g.w + 8; c++) {
    const r = rnd(p, c, 7, 5);
    const bump = r < 0.5 ? 2 : r < 0.8 ? 1 : 0;
    const x = c * 8;
    const y = F - 20 + bump;
    s.hline(x + 1, y - 1, 6, dark);
    s.hline(x, y, 8, dark);
    s.rect(x, y + 1, 8, 2, dark);
    if (rnd(p, c, 8, 5) < 0.6) s.hline(x + 1 + ((c * 3) & 3), y - 2, 3, dark);
    s.px(x + 2, y, leaf);
    s.px(x + 3, y, leaf);
    s.px(x + 1, y + 1, leaf);
    s.px(x + 3, y + 2, deep);
    s.px(x + 6, y + 2, deep);
  }
  // clumps of leaves down its face, darker towards the foot
  for (let y = F - 15; y < F - 1; y += 3) {
    for (let x = ((y >> 1) & 3) - 4; x < g.w; x += 8) {
      const h = rnd(p, x, y, 6);
      if (h < 0.4) continue;
      const c =
        y < F - 10 ? dark : h < 0.7 ? dark : E(shade(P.grassDeep, -0.2));
      s.hline(x, y, 2, c);
      s.px(x + 1, y - 1, c);
    }
  }
  if (!railings) return;
  const bar = E(P.night);
  const barLit = E(P.slate);
  const rail = E(P.slate);
  const tip = E(P.steel);
  s.hline(0, F - 15, g.w, E(P.steel));
  s.hline(0, F - 14, g.w, rail);
  s.hline(0, F - 5, g.w, E(P.steel));
  s.hline(0, F - 4, g.w, rail);
  for (let x = 2; x < g.w; x += 6) {
    s.vline(x, F - 16, 14, barLit);
    s.vline(x + 1, F - 16, 14, bar);
    // a spear head on each bar
    s.hline(x, F - 17, 2, tip);
    s.px(x, F - 18, tip);
  }
  // two sparrows on the rail
  life.perchColor = E(P.woodDark);
  life.perched.push({ x: sx(g, -36), y: F - 18 }, { x: sx(g, 30), y: F - 18 });
  if (p.era === "retro") {
    // the village green: its bandstand and old trees
    paintGreenTrees(s, p);
    paintBandstand(s, p);
  }
}

/** The wooden changing hut (tier 1): planks, a felt roof, a door, a window, a notice. */
export function paintHut(s: Surface, p: Paint): void {
  if (p.era === "nextgen") return paintPod(s, p);
  const { g, E } = p;
  const F = g.F;
  const x = sx(g, -66);
  const w = 44;
  const plank = E(P.wood);
  const seam = E(P.woodDark);
  const lit = E(shade(P.wood, 0.18));
  s.rect(x, F - 26, w, 26, plank);
  for (let i = 4; i < w; i += 6) {
    s.vline(x + i, F - 25, 25, seam);
    s.vline(x + i + 1, F - 25, 25, lit);
  }
  s.vline(x + w - 2, F - 26, 26, E(shade(P.wood, -0.35)));
  s.vline(x + w - 1, F - 26, 26, E(shade(P.wood, -0.35)));
  s.hline(x, F - 1, w, E(shade(P.wood, -0.25)));
  // the felt roof, overhanging, its shadow on the planks
  s.rect(x - 2, F - 32, w + 4, 6, E(P.slate));
  s.hline(x - 2, F - 32, w + 4, E(P.steel));
  s.hline(x - 1, F - 31, w + 2, E(shade(P.slate, 0.12)));
  s.hline(x - 2, F - 27, w + 4, E(P.night));
  s.hline(x, F - 26, w, E(shade(P.wood, -0.3)));
  // RETRO: a pavilion's roof of corrugated iron, a gable over its middle
  if (p.era === "retro") paintGable(s, p, x - 2, x + w + 2, F - 26, 16, 6);
  // the door: boards, a latch
  s.rect(x + 6, F - 19, 8, 19, E(P.woodDark));
  s.vline(x + 6, F - 19, 19, E(shade(P.woodDark, 0.2)));
  s.vline(x + 9, F - 18, 18, E(shade(P.woodDark, -0.25)));
  s.hline(x + 7, F - 13, 6, E(shade(P.woodDark, -0.25)));
  s.px(x + 12, F - 10, E(P.gold));
  s.px(x + 12, F - 9, E(P.goldDark));
  // a notice pinned up beside it: the fixture list
  s.rect(x + 17, F - 20, 6, 7, E(P.chalk));
  for (let y = F - 18; y < F - 14; y += 2) s.hline(x + 18, y, 4, E(P.mist));
  s.px(x + 19, F - 20, E(P.home));
  // the window: frame, a cross bar, the sill
  s.rect(x + 26, F - 21, 12, 8, E(P.chalk));
  if (p.lamps) {
    s.disc(x + 31, F - 17, 10, P.amberDim, 0.25);
    s.rect(x + 27, F - 20, 10, 6, P.goldLight);
    s.hline(x + 27, F - 15, 10, P.gold);
  } else {
    s.rect(x + 27, F - 20, 10, 6, E(P.steel));
    s.px(x + 27, F - 20, E(P.mist));
    s.px(x + 28, F - 20, E(P.mist));
    s.px(x + 27, F - 19, E(P.mist));
  }
  s.vline(x + 32, F - 20, 6, E(P.chalk));
  s.hline(x + 27, F - 18, 10, E(P.chalk));
  s.hline(x + 24, F - 13, 16, E(P.chalk));
  s.hline(x + 25, F - 12, 14, E(shade(P.wood, -0.3)));
}

// ---------------------------------------------------------------------------
// Boards along the far touchline
// ---------------------------------------------------------------------------

/** A row of painted boards on posts, words from the labels (plain stripes without). */
export function paintBoards(s: Surface, p: Paint, y: number, h: number): void {
  if (p.era === "nextgen") return paintHoloBoards(s, p, y, h);
  const { g, S } = p;
  const list = p.labels.boards ?? [];
  const opts = words();
  s.rect(0, y, g.w, h, S(P.woodDark));
  let x = -((g.w * 7) % 46);
  const looks = p.era === "retro" ? RETRO_BOARD_LOOKS : BOARD_LOOKS;
  for (let i = 0; x < g.w; i++) {
    const look = looks[(i + p.seed) % looks.length];
    const word = list.length > 0 ? list[i % list.length].toUpperCase() : "";
    const bw = word ? measureText(word, opts) + 16 : 44 + (i % 3) * 12;
    const bg = S(look.bg);
    const fg = S(look.fg);
    s.rect(x, y, bw, h - 2, bg);
    s.hline(x, y, bw, S(shade(look.bg, 0.2)));
    s.hline(x, y + h - 3, bw, S(shade(look.bg, -0.15)));
    if (word) {
      drawText(s, word, x + 8, y + Math.max(1, (h - 2 - 10) >> 1), fg, opts);
    } else {
      // a painted panel: a frame and a band in the board's second colour
      s.rect(x + 6, y + 3, bw - 12, Math.max(1, h - 8), fg);
      s.rect(x + 10, y + 5, bw - 20, Math.max(1, h - 12), bg);
    }
    // bolts at the corners
    const bolt = S(shade(look.bg, -0.3));
    s.px(x + 2, y + 2, bolt);
    s.px(x + bw - 3, y + 2, bolt);
    s.vline(x + bw, y, h, S(P.woodDark));
    s.vline(x + bw + 1, y, h, S(shade(P.woodDark, -0.2)));
    x += bw + 2;
  }
  s.hline(0, y + h - 2, g.w, S(shade(P.woodDark, -0.2)));
  s.hline(0, y + h - 1, g.w, S(shade(P.woodDark, -0.35)));
}

// ---------------------------------------------------------------------------
// Floodlights
// ---------------------------------------------------------------------------

/**
 * A floodlight's glow on the night sky: three flat bands of the night ramp (ART_BIBLE 4:
 * large glows are bands), each dithered only on its edge, brightest round the lamps.
 */
function lampGlow(s: Surface, p: Paint, x: number, y: number, r: number): void {
  if (!p.flood) return;
  s.disc(x, y, r * 2, P.nightLow, 0.5);
  s.disc(x, y, r * 1.8, P.nightLow);
  s.disc(x, y, r * 1.45, P.nightGlow, 0.5);
  s.disc(x, y, r * 1.25, P.nightGlow);
  s.disc(x, y, r * 0.8, P.steel, 0.5);
}

/** A thin pole with a small head of four lamps (tier 2). The pole is `x`, `x + 1`. */
function pole(
  s: Surface,
  p: Paint,
  x: number,
  top: number,
  foot: number,
): void {
  const { S } = p;
  lampGlow(s, p, x + 1, top + 3, 12);
  s.vline(x, top + 7, foot - top - 7, S(P.steel));
  s.vline(x + 1, top + 7, foot - top - 7, S(P.slate));
  // a bracket under the head
  s.hline(x - 1, top + 7, 4, S(P.slate));
  // the head: a frame of four lamps, lit edge on top
  s.rect(x - 4, top, 10, 7, S(P.slate));
  s.hline(x - 4, top, 10, S(P.steel));
  s.hline(x - 4, top + 6, 10, S(P.night));
  for (const lx of [x - 3, x + 3]) {
    for (const ly of [top + 1, top + 4]) {
      if (p.flood) {
        s.rect(lx, ly, 2, 2, P.white);
        s.px(lx + 1, ly + 1, P.goldLight);
      } else {
        s.rect(lx, ly, 2, 2, S(P.mist));
        s.px(lx, ly, S(P.steelHi));
      }
    }
  }
}

/**
 * A lattice pylon at a corner (tier 3): two legs, cross bracing, a walkway under a big head
 * of six lamps. The middle is between `x` and `x + 1`.
 */
function pylon(
  s: Surface,
  p: Paint,
  x: number,
  top: number,
  foot: number,
): void {
  const { S } = p;
  const HWD = 22;
  const HHT = 16;
  lampGlow(s, p, x + 1, top + 8, 18);
  const legL = S(P.concrete);
  const legR = S(P.concreteDark);
  const brace = S(P.concreteLight);
  for (let y = top + HHT; y < foot; y++) {
    const r = (y - top - HHT) % 8;
    if (r === 0) s.hline(x - 2, y, 6, brace);
    else {
      // an X in each bay of the lattice
      s.px(x - 3 + Math.round((r * 6) / 8), y, brace);
      s.px(x + 4 - Math.round((r * 6) / 8), y, legR);
    }
    s.px(x - 4, y, brace);
    s.px(x - 3, y, legL);
    s.px(x + 4, y, legR);
    s.px(x + 5, y, legR);
  }
  // the walkway under the head, with its rail
  s.hline(x - 12, top + HHT, 26, S(P.steel));
  s.hline(x - 12, top + HHT + 1, 26, S(P.slate));
  for (let k = 0; k < 26; k += 5)
    s.vline(x - 12 + k, top + HHT - 3, 3, S(P.steel));
  const hx = x - 10;
  s.rect(hx, top, HWD, HHT - 3, S(P.slate));
  s.hline(hx, top, HWD, S(P.steel));
  s.vline(hx, top, HHT - 3, S(P.steel));
  s.vline(hx + HWD - 1, top, HHT - 3, S(P.night));
  for (let j = 0; j < 2; j++) {
    for (let i = 0; i < 3; i++) {
      const lx = hx + 2 + i * 7;
      const ly = top + 2 + j * 5;
      if (p.flood) {
        s.rect(lx, ly, 4, 4, P.white);
        s.hline(lx + 1, ly + 3, 3, P.goldLight);
        s.px(lx + 3, ly + 2, P.goldLight);
      } else {
        s.rect(lx, ly, 4, 4, S(P.mist));
        s.px(lx, ly, S(P.steelHi));
        s.px(lx + 1, ly, S(P.steelHi));
        s.px(lx, ly + 1, S(P.steelHi));
        s.hline(lx, ly + 3, 4, S(P.steel));
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Tier 2: the small ground
// ---------------------------------------------------------------------------

export function paintClubGround(s: Surface, p: Paint, life: Life): void {
  if (p.era === "nextgen") return paintClubGroundNG(s, p, life, watcher);
  const { g, S, E } = p;
  const F = g.F;
  // RETRO (retro-club.ts): timber lamp standards, a tea hut of bare planks, a gabled roof
  const retro = p.era === "retro";
  // four thin poles, then everything in front of them
  for (const off of [-52, -4, 40, 88]) {
    if (retro) paintTimberLamp(s, p, sx(g, off), F - 112, F - 14);
    else pole(s, p, sx(g, off), F - 120, F - 14);
  }

  // the tea hut: boards, a striped awning with a scalloped edge, the hatch, steam
  const tx = sx(g, 30);
  s.rect(tx, F - 24, 28, 24, S(retro ? P.wood : P.chalk));
  for (let i = 4; i < 28; i += 6)
    s.vline(tx + i, F - 22, 22, S(retro ? P.woodDark : P.mist));
  s.vline(tx + 27, F - 24, 24, S(retro ? P.woodDark : P.mist));
  // (RETRO: a canvas awning in his old gold, never today's red)
  const awn = retro ? P.retro : P.home;
  s.hline(tx - 2, F - 26, 32, S(retro ? P.retroDark : P.homeDark));
  for (let i = 0; i < 32; i++) {
    const red = (i >> 2) % 2 === 0;
    s.vline(tx - 2 + i, F - 31, 5, S(red ? awn : P.chalk));
    if ((i & 3) === 1 || (i & 3) === 2)
      s.px(tx - 2 + i, F - 26, S(red ? awn : P.chalk));
  }
  s.hline(tx - 2, F - 31, 32, S(retro ? P.retroLight : P.homeLight));
  // the hatch: the tea lady behind the counter
  const hatch = p.lamps ? P.goldLight : S(P.night);
  s.rect(tx + 5, F - 21, 17, 9, hatch);
  const lady = p.lamps ? P.goldDark : S(P.slate);
  s.rect(tx + 11, F - 18, 4, 4, p.lamps ? P.gold : S(P.skinA));
  s.hline(tx + 11, F - 19, 4, lady);
  s.rect(tx + 10, F - 14, 6, 2, lady);
  s.rect(tx + 3, F - 12, 21, 2, S(P.wood));
  s.hline(tx + 3, F - 12, 21, S(shade(P.wood, 0.25)));
  // a tea urn on the counter
  s.rect(tx + 18, F - 15, 3, 3, S(P.steelHi));
  s.px(tx + 20, F - 15, S(P.steel));
  // the chimney pipe and its steam
  s.rect(tx + 22, F - 38, 2, 7, S(P.steel));
  s.px(tx + 22, F - 38, S(P.steelHi));
  life.steam.push({ x: tx + 22, y: F - 40 });

  // the small covered stand
  const x0 = sx(g, -46);
  const x1 = sx(g, 26);
  const w = x1 - x0;
  s.rect(x0, F - 48, w, 34, S(P.wood));
  for (let x = x0 + 4; x < x1; x += 6) {
    s.vline(x, F - 48, 8, S(P.woodDark));
    s.vline(x + 1, F - 48, 8, S(shade(P.wood, 0.15)));
  }
  fanBlock(s, p, life, {
    x0: x0 + 4,
    x1: x1 - 4,
    y: F - 40,
    rows: 3,
    seat: S(P.woodDark),
    empty: 0.22,
    shadowRows: 1,
  });
  s.hline(x0, F - 16, w, S(shade(P.wood, -0.3)));
  s.hline(x0, F - 15, w, S(P.woodDark));
  // posts at the ends, a steel column in the middle
  for (const x of [x0, x1 - 4]) {
    s.rect(x, F - 50, 4, 36, S(P.wood));
    s.vline(x, F - 50, 36, S(shade(P.wood, 0.2)));
    s.vline(x + 3, F - 50, 36, S(P.woodDark));
  }
  const mid = (x0 + x1) >> 1;
  s.vline(mid, F - 48, 34, S(retro ? P.wood : P.steelHi));
  s.vline(mid + 1, F - 48, 34, S(retro ? P.woodDark : P.steel));
  if (retro) {
    // a pitched roof of corrugated iron, a gable over the middle
    paintGable(s, p, x0 - 4, x1 + 4, F - 50, 16, 6);
    s.hline(x0 - 4, F - 50, w + 8, S(P.night));
    s.hline(x0 - 4, F - 49, w + 8, S(P.night));
  } else {
    // the roof and its fascia in his colour
    s.rect(x0 - 4, F - 56, w + 8, 6, S(P.home));
    s.hline(x0 - 4, F - 56, w + 8, S(P.homeLight));
    s.hline(x0 - 4, F - 51, w + 8, S(P.homeDark));
    s.hline(x0 - 4, F - 50, w + 8, S(P.night));
    s.hline(x0 - 4, F - 49, w + 8, S(P.night));
  }
  // pigeons on the roof
  life.perched.push({ x: x0 + 18, y: F - 56 }, { x: x1 - 28, y: F - 56 });
  life.perchColor = E(P.steel);

  // people standing behind the fence either side
  const coats: readonly Color[] = [P.slate, P.night, P.home, P.steel, P.wood];
  let n = 0;
  for (let x = 8; x < g.w - 6; x += 12) {
    if (x > x0 - 8 && x < x1 + 6) continue;
    if (x > tx - 8 && x < tx + 34) continue;
    if (rnd(p, x >> 1, 30, 31) < 0.4) continue;
    life.watchers.push(
      watcher(
        p,
        x,
        F - 4,
        rnd(p, x >> 1, 31, 31) < 0.15,
        E(coats[n % coats.length]),
        n + 40,
      ),
    );
    n++;
  }
  life.watcherClip = F - 14;
  paintBoards(s, p, F - 14, 14);
}

// ---------------------------------------------------------------------------
// Tier 3: a proper ground
// ---------------------------------------------------------------------------

export function paintProperGround(s: Surface, p: Paint, life: Life): void {
  if (p.era === "nextgen") return paintProperGroundNG(s, p, life);
  const { g, S, E } = p;
  const F = g.F;
  // RETRO (retro-club.ts): no pylons; a timber terrace, a hand-turned scoreboard, a wooden
  // grandstand under a gable with a clock
  const retro = p.era === "retro";
  const lit = retro ? P.wood : P.concreteLight;
  const mid = retro ? P.woodDark : P.concrete;
  const low = retro ? shade(P.woodDark, -0.25) : P.concreteDark;
  if (!retro) {
    pylon(s, p, sx(g, -62), F - 184, F - 60);
    pylon(s, p, sx(g, 68), F - 184, F - 52);
  } else retroTowerLamps(s, p);

  // the scoreboard on its legs in the corner, down to the ground behind the terrace
  // (RETRO's painted board kept whole on the narrowest phones: retro-club.ts)
  const bx = retro ? retroBoardX(g) : sx(g, 34);
  for (const lx of [bx + 8, bx + 50]) {
    s.vline(lx, F - 72, 58, S(retro ? P.wood : P.steel));
    s.vline(lx + 1, F - 72, 58, S(retro ? P.woodDark : P.slate));
  }

  // the open terrace, from the gap by his house to the corner at the goal line (the end
  // behind the goal, end.ts, wraps round from there)
  const tx0 = sx(g, 22);
  const tx1 = Math.max(tx0 + 8, Math.min(g.w, endFor(g).corner));
  const tw = tx1 - tx0;
  s.rect(tx0, F - 60, tw, 46, S(mid));
  s.hline(tx0, F - 60, tw, S(lit));
  s.hline(tx0, F - 59, tw, S(lit));
  fanBlock(s, p, life, {
    x0: tx0 + 4,
    x1: tx1 - 4,
    y: F - 54,
    rows: 5,
    seat: S(low),
    empty: 0.08,
    shadowRows: 0,
  });
  // crush barriers across it, on posts (RETRO: wooden rails)
  const rail = retro ? shade(P.wood, 0.3) : P.steelHi;
  const railLo = retro ? P.woodDark : P.steel;
  for (const y of [F - 40, F - 24]) {
    for (let x = tx0 + 8; x + 20 < tx1 - 4; x += 28) {
      s.hline(x, y, 20, S(rail));
      s.hline(x, y + 1, 20, S(railLo));
      s.vline(x + 2, y + 2, 4, S(railLo));
      s.vline(x + 17, y + 2, 4, S(railLo));
    }
  }
  s.hline(tx0, F - 16, tw, S(lit));
  s.rect(tx0, F - 60, 2, 46, S(lit));
  s.rect(tx0 + 2, F - 60, 2, 46, S(mid));
  // its end at the corner: a wall, lit on the left
  s.rect(tx1 - 4, F - 62, 4, 48, S(mid));
  s.vline(tx1 - 4, F - 62, 48, S(lit));
  s.vline(tx1 - 1, F - 62, 48, S(low));

  // the scoreboard over it
  if (retro) {
    const opts = words();
    paintHandScoreboard(s, p, bx, F - 90, F - 60, (text, x, y, c, w) => {
      // centred in the width it is given; the plain small font when the painted one is
      // too wide for it (and clipped to it by the board)
      const o = measureText(text, opts) <= w ? opts : { font: FONT_3x5 };
      const tw = measureText(text, o);
      drawText(s, text, x + Math.max(0, (w - tw) >> 1), y + 1, c, o);
    });
  } else {
    s.hline(bx + 6, F - 66, 48, S(P.slate));
    const field = drawLedPanel(s, bx, F - 94, 60, 22, { grade: S });
    life.scoreboard = {
      field,
      text: (p.labels.boards?.[0] ?? "").toUpperCase(),
    };
  }

  // the main stand, from the left edge to the gap
  const x1 = sx(g, 4);
  s.rect(0, F - 80, x1, 66, S(retro ? P.woodDark : P.concrete));
  for (let x = 4; x < x1; x += 12) {
    // the windows of the bar at the back
    s.rect(x, F - 78, 6, 4, p.lamps ? P.gold : S(P.slate));
    if (p.lamps) s.hline(x, F - 75, 6, P.goldDark);
    else s.px(x, F - 78, S(P.steel));
  }
  fanBlock(s, p, life, {
    x0: 0,
    x1: x1 - 4,
    y: F - 72,
    rows: 7,
    seat: S(P.slate),
    empty: 0.04,
    shadowRows: 1,
  });
  aisles(s, p, 0, x1 - 4, F - 72, F - 16, 72);
  // the roof: a fascia in his colour, a dark underside, columns down to the front wall
  if (retro) {
    // a pitched roof of corrugated iron, the gable over the middle with its clock
    const cx = paintGable(s, p, 0, x1 + 4, F - 86, 34, 8);
    paintGableClock(s, p, cx, F - 101);
  } else {
    s.rect(0, F - 92, x1 + 4, 6, S(P.home));
    s.hline(0, F - 92, x1 + 4, S(P.homeLight));
  }
  s.hline(0, F - 87, x1 + 4, S(retro ? P.retroDark : P.homeDark));
  s.hline(0, F - 86, x1 + 4, S(P.night));
  s.hline(0, F - 85, x1 + 4, S(P.night));
  s.rect(0, F - 84, x1 + 4, 2, S(P.ink));
  if (p.flood) {
    for (let x = 6; x < x1; x += 16) {
      s.hline(x, F - 84, 4, P.white);
      s.hline(x + 1, F - 83, 2, P.goldLight);
    }
  }
  for (let x = x1 - 8; x > 0; x -= 80) {
    s.vline(x, F - 82, 66, S(retro ? shade(P.wood, 0.2) : P.steelHi));
    s.vline(x + 1, F - 82, 66, S(retro ? P.woodDark : P.steel));
  }
  s.rect(x1 - 4, F - 92, 4, 78, S(lit));
  s.vline(x1 - 1, F - 92, 78, S(mid));
  s.hline(0, F - 16, x1, S(lit));
  s.hline(0, F - 15, x1, S(mid));
  life.perched.push({ x: sx(g, -30), y: F - 92 }, { x: sx(g, -12), y: F - 92 });
  life.perchColor = E(P.steel);

  paintBoards(s, p, F - 14, 14);
}

// ---------------------------------------------------------------------------
// The people watching, the rope and the corner flags
// ---------------------------------------------------------------------------

/** The two mates leaning on the railings at tier 0. */
export function addMates(p: Paint, life: Life): void {
  const { g, E } = p;
  life.watchers.push(
    watcher(p, sx(g, -58), g.F + 2, true, E(P.homeDark), 0),
    watcher(p, sx(g, -50), g.F + 2, true, E(P.awayDark), 1),
  );
}

export function watcher(
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
  const hostile = away && !inPocket(p, x, y - 20);
  return {
    x,
    y,
    kid,
    hair: E(pick(HAIR, rnd(p, n, 1, 11))),
    skin: E(pick(SKIN, rnd(p, n, 2, 11))),
    // NEXT-GEN: the hero's magenta where today's picks wear his red; RETRO his old gold
    coat:
      p.era === "nextgen"
        ? nextgenCoat(E, coat, n)
        : p.era === "retro"
          ? retroCoat(E, coat)
          : coat,
    coatLow: E(shade(P.slate, -0.1)),
    legs: E(rnd(p, n, 3, 11) < 0.5 ? P.night : P.slate),
    period: 9 + Math.floor(rnd(p, n, 4, 11) * 12),
    offset: Math.floor(rnd(p, n, 5, 11) * 200),
    withHero: !hostile,
    scarfA: rnd(p, n, 6, 11) < 0.4 ? E(a) : TRANSPARENT,
    scarfB: E(b),
    // NEXT-GEN: glowing wristbands, visors and a jacket trimmed with light (nextgen-people.ts)
    ...(p.era === "nextgen" ? nextgenWatcherLights(p.seed, x, n) : {}),
    // RETRO: flat caps and bowlers (retro-people.ts)
    ...(p.era === "retro" ? retroWatcherHat(p, n) : {}),
  };
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
  const step = Math.max(14, Math.round(8 * g.k));
  for (let x = 12; x < g.w - 8; x += step) {
    if (x > hutL && x < hutR) continue;
    const r = rnd(p, x, 9, 13);
    if (r < 0.3) continue;
    const kid = rnd(p, x, 10, 13) < 0.25;
    const coat = E(coats[Math.floor(rnd(p, x, 11, 13) * coats.length)]);
    life.watchers.push(watcher(p, x + 2 * (n % 2), g.F - 2, kid, coat, n));
    n++;
  }
}

export function addRope(p: Paint, life: Life): void {
  if (p.era === "nextgen") return addLightLine(p, life);
  const { g, E } = p;
  life.rope = {
    y: g.F - 8,
    x0: 0,
    x1: g.w,
    step: Math.max(20, Math.round(12 * g.k)),
    rope: E(P.chalk),
    stake: E(P.wood),
  };
}

/** The corner flag where the goal line meets the far touchline (tier 1 up). */
export function addCornerFlag(p: Paint, life: Life): void {
  if (p.era === "nextgen") return addCornerLights(p, life);
  const { g, S } = p;
  const x = across(g, g.goalX, g.F) - 2;
  life.flags.push({
    x,
    top: g.F - 18,
    poleH: 18,
    w: 6,
    h: 4,
    a: S(P.gold),
    b: S(P.goldDark),
    pole: S(P.chalk),
    phase: 0,
  });
  // the near corner's flag too, where the goal line meets the near touchline
  const xn = across(g, g.goalX, g.N) - 2;
  if (xn < g.w - 2) {
    life.flags.push({
      x: xn,
      top: g.N - 18,
      poleH: 18,
      w: 6,
      h: 4,
      a: S(P.gold),
      b: S(P.goldDark),
      pole: S(P.chalk),
      phase: 1,
    });
  }
}
