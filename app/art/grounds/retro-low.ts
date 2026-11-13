/**
 * RETRO's small grounds (tiers 0 to 3; .snaps/era-art/THEME.md): the early days of the
 * game. The composition is HOME's to the pixel (the stage, the goal line, the far and near
 * touchlines, where everyone stands); only the things on it are of their time:
 *
 *   his street  sooty brick terraces, a chimney on every party wall and smoke from most, a
 *               mill and its chimney stacks behind, a gas lamp with its ladder bar
 *   tier 0      the village green: a bandstand, old trees, a cobbled path, a cast-iron
 *               bench, a drinking fountain, a gas lamp, a penny-farthing and a hoop
 *   tier 1      + the pavilion's gable, leather bags, a jug, leather balls in a sack
 *   tier 2      timber lamp poles, a wooden stand under a gable, a tea hut of planks, the
 *               trainer's bench with his bucket and sponge, hand-painted boards
 *   tier 3      a wooden grandstand with a clock in its gable, a timber terrace, a
 *               hand-turned scoreboard, flagpoles; photographers with plate cameras
 *
 * Every painter keeps to the art bible: palette colours graded by the build's light (the
 * street with `distant()`, the park with `p.E`, the ground's own structures with `p.S`),
 * lamps and lit windows in raw colour, no outlines on backgrounds.
 */

import { P } from "~/art/palette";
import {
  FONT_3x5,
  drawText,
  hash2,
  measureText,
  mix,
  shade,
  type Color,
  type Surface,
} from "~/pixel";
import { STREET, WASHING_ALLEY, isAlley } from "./far-tables";
import type { Life, Mover } from "./life";
import {
  CHIMNEY_H,
  HAIR,
  HOUSE_W,
  ROOF_H,
  SKIN,
  WALL_H,
  pick,
  rnd,
  sx,
  type Paint,
} from "./paint";
import { paintBack } from "./people";

/** How far back the mill is (0 near, 1 the horizon): behind the church. */
const MILL = 0.5;
/** The railway viaduct, behind the mill and the church. */
const VIADUCT = 0.58;

/** The street's walls in RETRO: brick, most of it blackened by a century of coal smoke. */
export const RETRO_WALLS: readonly (readonly [Color, number])[] = [
  [P.brickDark, 44],
  [P.brick, 40],
  [P.brickLight, 6],
];

/** Front doors of the time, painted: bottle greens, maroons, black, brown, navy. */
export const RETRO_DOORS: readonly (readonly [Color, number])[] = [
  [P.grassDeep, 24],
  [P.brickDark, 20],
  [P.night, 18],
  [P.woodDark, 16],
  [P.slate, 10],
];

/** The shops in the terrace: house modules counted from his (0), and their trades. */
const SHOPS: readonly (readonly [number, string, Color, Color])[] = [
  [-2, "BAKER", P.grassDeep, P.gold],
  [2, "GROCER", P.brickDark, P.chalk],
  [-11, "DRAPER", P.night, P.gold],
  [11, "BARBER", P.grassDeep, P.chalk],
  [-20, "TEAS", P.brickDark, P.gold],
  [20, "COAL", P.night, P.chalk],
];

// ---------------------------------------------------------------------------
// His street (every tier): RETRO's own painter
// ---------------------------------------------------------------------------

/**
 * RETRO's street, behind every tier (far.ts `paintStreet` hands it over after the far
 * trees): a railway viaduct far behind with a steam train crossing it now and then, the
 * mill and its stacks, the church (`church`, today's), then the terrace: sooty brick, sash
 * windows of small panes in stone dressings, painted doors on whitened steps, shops with
 * painted fascias and striped blinds, blackened stacks on every party wall and plumes of
 * coal smoke from most, gas lamps along the pavement, the washing out in the alley, and the
 * gas lamp in front of the park where today's street lamp stands.
 */
export function paintRetroStreet(
  s: Surface,
  p: Paint,
  life: Life,
  church: () => void,
): void {
  const { g } = p;
  paintViaduct(s, p, life);
  paintMill(s, p, life);
  church();
  const i0 = Math.floor(-g.houseX / HOUSE_W) - 1;
  const i1 = Math.ceil((g.w - g.houseX) / HOUSE_W) + 1;
  const pots: number[] = [];
  for (let i = i0; i <= i1; i++) {
    const x = g.houseX + i * HOUSE_W;
    if (isAlley(i) || i === WASHING_ALLEY) retroAlley(s, p, life, x, i);
    else retroHouse(s, p, x, i, pots);
  }
  for (let i = i0; i <= i1; i++) {
    // gas lamps along the pavement, at every fourth party wall
    if (((i % 4) + 4) % 4 === 1) pavementLamp(s, p, g.houseX + i * HOUSE_W);
  }
  life.movers.push(housePlumes(p, s, pots));
  paintGasLamp(s, p, sx(g, -6), g.B - 52, g.F);
}

/**
 * One house of the terrace (HOUSE_W wide, today's footprint): sooty brick in courses, soot
 * thick under the gutter, stone lintels and sills, sash windows in dark frames with small
 * panes (gaslight at night), a painted four-panel door under an arched fanlight in a stone
 * surround, its step whitened; his door in his colour. Some are shops. A blackened stack on
 * every party wall; `pots` gathers the pots that smoke (x, y pairs).
 */
function retroHouse(
  s: Surface,
  p: Paint,
  x: number,
  i: number,
  pots: number[],
): void {
  const { g, D } = p;
  const B = g.B;
  const d = (c: Color): Color => D(c, STREET);
  const his = i === 0;
  const wallC = his ? P.brick : pick(RETRO_WALLS, rnd(p, i, 1, 3));
  const top = B - WALL_H;
  s.rect(x, top, HOUSE_W, WALL_H, d(wallC));
  const joint = d(shade(wallC, -0.16));
  for (let y = top + 2, row = 0; y < B; y += 3, row++) {
    for (let xx = x + 2 + (row & 1) * 3; xx < x + HOUSE_W - 1; xx += 6)
      s.px(xx, y, joint);
  }
  // soot: the party wall dark, a blackened band under the gutter
  s.vline(x, top, WALL_H, d(shade(wallC, -0.34)));
  s.vline(x + 1, top, WALL_H, d(shade(wallC, -0.16)));
  s.hline(x, top, HOUSE_W, d(shade(wallC, -0.4)));
  s.hline(x, top + 1, HOUSE_W, d(shade(wallC, -0.26)));
  for (let k = 3; k < HOUSE_W; k += 5) s.px(x + k, top + 2, joint);
  const stone = d(P.concreteLight);
  const stoneLo = d(P.concrete);
  const frame = d(P.woodDark);
  const night = p.lamps;
  const shop = SHOPS.find((sh) => sh[0] === i);
  if (shop) {
    retroShopFront(s, p, x, shop[1], shop[2], shop[3]);
  } else {
    // the door: a stone surround, an arched fanlight, four panels, a whitened step
    const doorC = his ? P.retro : pick(RETRO_DOORS, rnd(p, i, 2, 3));
    const hall = night && (his || rnd(p, i, 3, 3) < 0.4);
    s.rect(x + 4, B - 18, 10, 18, stone);
    s.vline(x + 13, B - 18, 18, stoneLo);
    s.hline(x + 4, B - 18, 10, d(P.chalk));
    const fan = hall ? P.gold : d(P.night);
    s.hline(x + 7, B - 17, 4, fan);
    s.rect(x + 6, B - 16, 6, 2, fan);
    s.hline(x + 6, B - 14, 6, stoneLo);
    s.rect(x + 6, B - 13, 6, 13, d(doorC));
    s.vline(x + 6, B - 13, 13, d(shade(doorC, 0.18)));
    const panel = d(shade(doorC, -0.3));
    s.vline(x + 8, B - 12, 4, panel);
    s.vline(x + 10, B - 12, 4, panel);
    s.vline(x + 8, B - 6, 4, panel);
    s.vline(x + 10, B - 6, 4, panel);
    s.px(x + 11, B - 7, d(P.gold));
    s.hline(x + 3, B - 1, 12, d(P.chalk));
    // the parlour window downstairs: a stone lintel, a sash of six panes, its sill
    s.rect(x + 17, B - 17, 12, 2, stone);
    s.hline(x + 17, B - 16, 12, stoneLo);
    sash(s, p, x + 18, B - 15, 10, 11, hall, frame);
    s.hline(x + 17, B - 4, 12, stone);
    s.hline(x + 18, B - 3, 10, d(shade(wallC, -0.3)));
  }
  // two sashes upstairs; at night some glow with gaslight, his always
  const upL = night && (his || rnd(p, i, 4, 3) < 0.35);
  const upR = night && rnd(p, i, 5, 3) < 0.3;
  for (const [wx, lit] of [
    [x + 5, upL],
    [x + 19, upR],
  ] as const) {
    s.rect(wx - 1, B - 32, 9, 2, stone);
    s.hline(wx - 1, B - 31, 9, stoneLo);
    sash(s, p, wx, B - 30, 7, 9, lit, frame);
    s.hline(wx - 1, B - 21, 9, stone);
    s.hline(wx, B - 20, 7, d(shade(wallC, -0.3)));
  }
  // the roof: dark slates in courses, a lit ridge, the gutter
  const roof = top - ROOF_H;
  s.rect(x, roof, HOUSE_W, ROOF_H, d(shade(P.slate, -0.1)));
  s.hline(x, roof, HOUSE_W, d(P.steel));
  s.hline(x, roof + 1, HOUSE_W, d(P.slate));
  for (let r = 3; r < ROOF_H - 2; r += 3) {
    const off = ((r / 3) & 1) * 2 + (i & 1);
    for (let k = 1 + off; k < HOUSE_W; k += 4)
      s.px(x + k, roof + r, d(P.night));
  }
  s.hline(x, top - 2, HOUSE_W, d(P.night));
  s.hline(x, top - 1, HOUSE_W, d(P.ink));
  // the stack on the party wall: blackened brick, three pots, most of them smoking
  const cx = x - 5;
  const cTop = roof - CHIMNEY_H;
  s.rect(cx, cTop, 10, CHIMNEY_H, d(P.brickDark));
  s.vline(cx, cTop, CHIMNEY_H, d(P.brick));
  s.hline(cx - 1, cTop, 12, d(shade(P.brickDark, -0.2)));
  s.hline(cx - 1, cTop + 1, 12, d(P.night));
  s.hline(cx + 1, cTop + 5, 9, d(shade(P.brickDark, -0.2)));
  for (const k of [0, 4, 8]) {
    const px = cx + k;
    s.rect(px, cTop - 4, 2, 4, d(P.brick));
    s.px(px, cTop - 3, d(P.brickLight));
    s.hline(px, cTop - 4, 2, d(P.ink));
  }
  const smokes = rnd(p, i, 6, 3) < 0.45 || (i >= -2 && i <= 1);
  if (smokes) {
    const k = Math.floor(rnd(p, i, 7, 3) * 3) * 4;
    pots.push(cx + k, cTop - 5);
  }
}

/**
 * A sash window `w` x `h`: its dark frame, glazing bars making small panes (three across
 * where there is room), the meeting rail across the middle. By day the glass is dark with
 * a glint, at night gaslight (`lit`) or the dark.
 */
function sash(
  s: Surface,
  p: Paint,
  x: number,
  y: number,
  w: number,
  h: number,
  lit: boolean,
  frame: Color,
): void {
  const d = (c: Color): Color => p.D(c, STREET);
  const glass = lit ? P.gold : p.lamps ? d(P.night) : d(P.slate);
  s.rect(x, y, w, h, glass);
  if (lit) s.hline(x + 1, y + 1, w - 2, P.goldLight);
  else if (!p.lamps) {
    s.px(x + 1, y + 1, d(P.steel));
    s.px(x + 1, y + (h >> 1) + 1, d(P.steel));
  }
  s.frame(x, y, w, h, frame);
  const mid = y + (h >> 1);
  s.hline(x, mid, w, frame);
  if (w >= 10) {
    s.vline(x + 3, y, h, frame);
    s.vline(x + w - 4, y, h, frame);
  } else {
    s.vline(x + (w >> 1), y, h, frame);
  }
}

/**
 * A shop front on the ground floor: a painted fascia with the trade in sign-writer's
 * letters, a striped canvas blind rolled out, a window of small panes over a panelled
 * stall riser, the door recessed at its side; a barber has his pole.
 */
function retroShopFront(
  s: Surface,
  p: Paint,
  x: number,
  trade: string,
  bg: Color,
  fg: Color,
): void {
  const { g, D } = p;
  const B = g.B;
  const d = (c: Color): Color => D(c, STREET);
  // the fascia: a moulded cornice over a painted board
  s.hline(x + 1, B - 22, HOUSE_W - 2, d(P.concreteLight));
  s.rect(x + 2, B - 21, HOUSE_W - 4, 7, d(bg));
  s.hline(x + 2, B - 15, HOUSE_W - 4, d(shade(bg, -0.3)));
  const tw = measureText(trade, { font: FONT_3x5 });
  drawText(s, trade, x + ((HOUSE_W - tw) >> 1), B - 20, d(fg), {
    font: FONT_3x5,
  });
  // the window: small panes in a dark frame, the goods behind, gaslit at night
  const wx = x + 3;
  const ww = 18;
  const lit = p.lamps;
  s.rect(wx, B - 13, ww, 9, lit ? P.gold : d(P.slate));
  if (lit) s.hline(wx + 1, B - 12, ww - 2, P.goldLight);
  else {
    // the goods on the shelves: a row of jars, loaves, bolts of cloth
    for (let k = 1; k < ww - 1; k += 3) s.rect(wx + k, B - 8, 2, 2, d(P.wood));
    s.px(wx + 1, B - 12, d(P.steel));
  }
  s.frame(wx, B - 13, ww, 9, d(P.woodDark));
  for (let k = 4; k < ww - 1; k += 4) s.vline(wx + k, B - 13, 9, d(P.woodDark));
  s.hline(wx, B - 10, ww, d(P.woodDark));
  // the stall riser: panelled, in the fascia's colour
  s.rect(wx, B - 4, ww, 4, d(bg));
  s.hline(wx, B - 4, ww, d(shade(bg, 0.2)));
  s.hline(wx + 1, B - 2, ww - 2, d(shade(bg, -0.3)));
  // the door, recessed: dark, a glazed top half, the step
  const dx = x + 23;
  s.rect(dx, B - 13, 6, 13, d(shade(bg, -0.2)));
  s.rect(dx + 1, B - 12, 4, 5, lit ? P.goldDark : d(P.slate));
  s.hline(dx - 1, B - 1, 8, d(P.chalk));
  // the blind, rolled out over the window: canvas stripes, a scalloped hem
  for (let k = 0; k < ww + 2; k++) {
    const stripe = (k >> 1) % 2 === 0;
    const c = d(stripe ? P.chalk : bg);
    s.vline(wx - 1 + k, B - 14, 2, c);
    if ((k & 3) !== 3) s.px(wx - 1 + k, B - 12, c);
  }
  s.hline(wx - 1, B - 14, ww + 2, d(P.chalk));
  if (trade === "BARBER") {
    // the barber's pole by the door: red and white in a spiral, a gold ball on top
    const bx = x + HOUSE_W - 3;
    for (let y = B - 14; y < B - 4; y++) {
      s.px(bx, y, d((y >> 1) % 2 === 0 ? P.brick : P.chalk));
      s.px(bx + 1, y, d(((y + 1) >> 1) % 2 === 0 ? P.brick : P.chalk));
    }
    s.hline(bx, B - 15, 2, d(P.gold));
    s.hline(bx, B - 4, 2, d(P.night));
  }
}

/** The alleys: a garden wall; the washing out on its line in one; a tree over the others. */
function retroAlley(
  s: Surface,
  p: Paint,
  life: Life,
  x: number,
  i: number,
): void {
  const { g, D } = p;
  const B = g.B;
  const d = (c: Color): Color => D(c, STREET);
  s.rect(x, B - 6, HOUSE_W, 6, d(P.brickDark));
  s.hline(x, B - 7, HOUSE_W, d(P.concrete));
  s.hline(x, B - 6, HOUSE_W, d(P.brick));
  for (let k = 2; k < HOUSE_W; k += 6) s.px(x + k, B - 3, d(P.night));
  if (i === WASHING_ALLEY) {
    const post = d(P.woodDark);
    for (const px of [x + 2, x + 28]) {
      s.rect(px, B - 28, 2, 22, post);
      s.vline(px, B - 28, 22, d(P.wood));
    }
    s.hline(x + 2, B - 28, 28, d(P.mist));
    s.hline(x + 4, B - 27, 24, d(P.steel));
    life.washingPosts = d(P.woodDark);
    life.washingLine = d(P.steel);
    // his old gold shirt, a white sheet, a grey wool sock: never today's red
    life.washing = {
      y: B - 28,
      items: [
        { x: x + 5, w: 8, h: 9, c: d(P.retro), low: d(P.retroDark) },
        { x: x + 15, w: 7, h: 11, c: d(P.chalk), low: d(P.mist) },
        { x: x + 24, w: 3, h: 7, c: d(P.steel), low: d(P.slate) },
      ],
    };
    return;
  }
  // a gnarled tree over the wall
  const tx = x + 16;
  s.rect(tx, B - 20, 2, 14, d(P.woodDark));
  s.px(tx - 1, B - 7, d(P.woodDark));
  s.px(tx + 2, B - 7, d(P.woodDark));
  s.disc(tx, B - 30, 11, d(P.grassDeep));
  s.disc(tx - 2, B - 32, 8, d(P.grassDark));
  s.disc(tx - 4, B - 35, 4, d(P.grass));
}

/** A gas lamp on the pavement in front of the houses: a slim post, a lantern, its crown. */
function pavementLamp(s: Surface, p: Paint, x: number): void {
  const { g, D } = p;
  const B = g.B;
  const iron = D(P.night, STREET);
  const head = B - 27;
  s.vline(x, head + 5, B - head - 5, iron);
  s.hline(x - 2, head + 9, 5, iron);
  s.hline(x - 2, head - 1, 5, iron);
  s.px(x, head - 2, iron);
  if (p.lamps) {
    s.disc(x, head + 2, 5, P.amberDim, 0.25);
    s.rect(x - 1, head, 3, 4, P.goldLight);
    s.px(x, head + 1, P.white);
  } else {
    s.rect(x - 1, head, 3, 4, D(P.mist, STREET));
    s.px(x - 1, head, D(P.chalk, STREET));
  }
  s.hline(x - 1, head + 4, 3, iron);
}

/**
 * The gas lamp by the park, where today's street lamp stands: a fluted cast-iron post on a
 * plinth, the lamplighter's ladder bar, a collar, then the lantern itself (four panes,
 * wider at the top, a mantle inside) under a crown with a finial. The post is `x`, `x + 1`.
 */
export function paintGasLamp(
  s: Surface,
  p: Paint,
  x: number,
  head: number,
  foot: number,
): void {
  const { D } = p;
  const iron = D(P.night, 0.15);
  const ironLit = D(P.slate, 0.15);
  const ironHi = D(P.steel, 0.15);
  // the post: lit left, a flute down it, swelling at the plinth
  s.vline(x, head + 10, foot - head - 10, ironLit);
  s.vline(x + 1, head + 10, foot - head - 10, iron);
  s.rect(x - 1, foot - 8, 4, 8, iron);
  s.vline(x - 1, foot - 8, 8, ironLit);
  s.hline(x - 2, foot - 9, 6, ironHi);
  // the ladder bar
  s.hline(x - 4, head + 13, 10, ironLit);
  s.hline(x - 4, head + 14, 10, iron);
  s.px(x - 4, head + 12, iron);
  s.px(x + 5, head + 12, iron);
  // the collar and the lantern's foot
  s.hline(x - 1, head + 9, 4, ironLit);
  s.hline(x - 2, head + 8, 6, iron);
  // the lantern: wider at the top, its frame in iron, four panes of glass
  const rows: readonly (readonly [number, number])[] = [
    [-3, 8],
    [-3, 8],
    [-2, 6],
    [-2, 6],
    [-2, 6],
    [-1, 4],
  ];
  for (let r = 0; r < rows.length; r++) {
    const [o, w] = rows[r];
    const y = head + 2 + r;
    if (p.lamps) {
      s.hline(x + o, y, w, r < 4 ? P.goldLight : P.gold);
    } else {
      s.hline(x + o, y, w, D(P.mist, 0.15));
      if (r < 2) s.px(x + o + 1, y, D(P.white, 0.15));
    }
    s.px(x + o, y, iron);
    s.px(x + o + w - 1, y, iron);
  }
  s.vline(x, head + 2, 6, iron);
  if (p.lamps) {
    s.disc(x + 1, head + 4, 14, P.amberDim, 0.25);
    s.disc(x + 1, head + 4, 8, P.amber, 0.25);
    s.rect(x - 2, head + 3, 2, 3, P.white);
  }
  // the crown: a cap wider than the lantern, a dome, a finial
  s.hline(x - 4, head + 1, 10, iron);
  s.hline(x - 3, head, 8, ironLit);
  s.hline(x - 2, head - 1, 6, iron);
  s.hline(x - 1, head - 2, 4, iron);
  s.px(x - 1, head - 1, ironHi);
  s.vline(x, head - 5, 3, iron);
  s.vline(x + 1, head - 5, 3, iron);
  s.px(x, head - 5, ironHi);
}

/**
 * The house chimneys' coal smoke: from each smoking pot a plume of round puffs, each at
 * least 3 px, that rise and lean away right on the wind, grow in steps (3, 5, 7 px), then
 * shrink away (5 px) and are gone: never loose specks. Puffs from a stack hidden behind a
 * stand are not drawn (checked once against the layer, as ground.ts does for today's).
 */
function housePlumes(p: Paint, layer: Surface, pots: number[]): Mover {
  const n = pots.length >> 1;
  const xs = Int16Array.from({ length: n }, (_, k) => pots[2 * k]);
  const ys = Int16Array.from({ length: n }, (_, k) => pots[2 * k + 1]);
  const salt = Float32Array.from({ length: n }, (_, k) =>
    hash2(xs[k], ys[k], p.seed + 5),
  );
  const shown = new Uint8Array(n);
  let checked = false;
  // a pot still in view keeps its colour (a stand in front of it has its own)
  const pot = p.D(P.brick, STREET);
  const lit = p.D(P.mist, 0.25);
  const body = p.D(P.concreteLight, 0.3);
  const low = p.D(P.steel, 0.25);
  // a few puffs a plume, far enough apart to read as puffs and not as one grey streak
  const PUFFS = 5;
  return {
    far(s: Surface, t: number): void {
      if (!checked) {
        checked = true;
        for (let k = 0; k < n; k++) {
          shown[k] = layer.get(xs[k] + 1, ys[k] + 3) === pot ? 1 : 0;
        }
      }
      const tt = Math.floor(t * 5) / 5;
      for (let k = 0; k < n; k++) {
        if (shown[k] === 0) continue;
        // the oldest (highest) puffs first, so the newer ones overlap them
        const base = (tt / (4.6 + salt[k] * 2) + salt[k]) % (1 / PUFFS);
        for (let j = PUFFS - 1; j >= 0; j--) {
          const a = base + j / PUFFS;
          // up first, then leaning away on the wind, wavering a little
          const sway = Math.round(Math.sin(a * 7 + salt[k] * 20) * 1.5);
          const x = xs[k] + 1 + Math.round(a * a * 18) + sway;
          const y = ys[k] - Math.round(a * 30);
          // out of the pot small, then 2, 3, back to 2 and gone: never a last loose speck
          if (a >= 0.9) continue;
          const r = a < 0.12 ? 1 : a < 0.35 ? 2 : a < 0.72 ? 3 : 2;
          s.disc(x + 1, y + 1, r, low);
          s.disc(x, y, r, a < 0.3 ? low : body);
          if (r >= 2) s.disc(x - 1, y - 1, r - 1, a < 0.3 ? body : lit);
        }
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Behind the street: the railway viaduct and its train
// ---------------------------------------------------------------------------

/**
 * A brick railway viaduct far behind the town, its arches showing over the roofs, a coped
 * parapet along the top; a steam train crosses it now and then (a sky mover, so it passes
 * behind the mill, the church and the stacks).
 */
function paintViaduct(s: Surface, p: Paint, life: Life): void {
  const { g } = p;
  const d = (c: Color): Color => p.D(c, VIADUCT);
  const deck = g.B - 62;
  const brick = d(P.brick);
  const lo = d(P.brickDark);
  const ARCH = 22;
  s.rect(0, deck, g.w, g.B - 40 - deck, brick);
  s.hline(0, deck - 2, g.w, d(P.concreteLight));
  s.hline(0, deck - 1, g.w, d(P.concrete));
  s.hline(0, deck, g.w, lo);
  for (let x = (g.cx % ARCH) - ARCH; x < g.w; x += ARCH) {
    // an arch: a round head over a tall opening, its pier lit on the left
    const ox = x + 4;
    const rows: readonly (readonly [number, number])[] = [
      [6, 6],
      [3, 12],
      [2, 14],
      [1, 16],
    ];
    for (let r = 0; r < rows.length; r++) {
      s.erase(ox + rows[r][0], deck + 4 + r, rows[r][1], 1);
    }
    s.erase(ox + 1, deck + 8, 16, g.B - 40 - deck - 8);
    s.vline(ox, deck + 6, g.B - 40 - deck - 6, lo);
    s.hline(ox + 6, deck + 3, 6, lo);
    s.vline(x + 1, deck + 1, g.B - 40 - deck, d(shade(P.brick, 0.15)));
  }
  life.movers.push(steamTrain(p, deck - 3));
}

/**
 * A steam train on the viaduct: a green engine with its tender, three maroon carriages
 * (gaslit windows at night), crossing left to right and gone for a while; its smoke left
 * behind in puffs that rise and spread. `rail` is the row the wheels run on (hidden by
 * the parapet).
 */
function steamTrain(p: Paint, rail: number): Mover {
  const { g } = p;
  const d = (c: Color): Color => p.D(c, VIADUCT);
  const engine = d(P.grassDeep);
  const engineLit = d(P.grassDark);
  const black = d(P.night);
  const iron = d(P.slate);
  const coach = d(P.brickDark);
  const coachLit = d(P.brick);
  const roof = d(P.slate);
  const win = p.lamps ? P.gold : d(P.mist);
  const steam = d(P.chalk);
  const steamLo = d(P.mist);
  const LEN = 3 * 20 + 30;
  const SPEED = 26;
  const run = (g.w + LEN + 40) / SPEED;
  const period = run + 20;
  const start = hash2(g.w, rail, p.seed + 9) * period;
  const front = (t: number): number =>
    Math.round(((t + start) % period) * SPEED) - 20;
  const y = rail;
  return {
    sky(s: Surface, t: number): void {
      const tt = Math.floor(t * 10) / 10;
      const fx = front(tt);
      if (fx - LEN > g.w + 20) return;
      // the smoke left behind: puffs from the chimney, rising and spreading
      for (let k = 7; k >= 0; k--) {
        const te = Math.floor(tt * 3) / 3 - k / 3;
        const age = tt - te;
        const ex = front(te);
        if (ex > fx || ex < 0) continue;
        const px = ex - 6 - Math.round(age * 3);
        const py = y - 14 - Math.round(age * 4);
        const r = Math.min(3, 1 + Math.floor(age * 1.2));
        s.disc(px + 1, py + 1, r, steamLo);
        s.disc(px, py, r, steam);
      }
      // the engine (its front at fx): the boiler, smokebox, chimney, dome, cab, tender
      const e = fx - 30;
      s.rect(e + 12, y - 9, 14, 6, engine);
      s.hline(e + 12, y - 9, 14, engineLit);
      s.vline(e + 17, y - 9, 6, black);
      s.vline(e + 22, y - 9, 6, black);
      s.rect(e + 26, y - 9, 3, 7, black);
      s.rect(e + 25, y - 13, 2, 4, black);
      s.hline(e + 24, y - 13, 4, iron);
      s.rect(e + 19, y - 11, 3, 2, engineLit);
      s.rect(e + 6, y - 13, 7, 11, engine);
      s.hline(e + 5, y - 14, 9, black);
      s.rect(e + 8, y - 11, 3, 3, win);
      s.rect(e, y - 9, 6, 7, black);
      s.hline(e, y - 9, 6, iron);
      s.rect(e + 12, y - 3, 17, 2, black);
      for (const wx of [e + 14, e + 19, e + 24]) {
        s.disc(wx, y - 2, 2, black);
        s.px(wx, y - 2, iron);
      }
      s.hline(e + 28, y - 4, 2, d(P.brick));
      // the carriages behind it
      for (let c = 0; c < 3; c++) {
        const cx = e - 20 * (c + 1);
        s.rect(cx, y - 10, 18, 8, coach);
        s.hline(cx, y - 10, 18, coachLit);
        s.hline(cx, y - 11, 18, roof);
        s.hline(cx + 1, y - 12, 16, roof);
        for (let k = 2; k < 17; k += 4) s.rect(cx + k, y - 8, 2, 2, win);
        s.hline(cx, y - 2, 18, black);
        s.disc(cx + 3, y - 1, 1, black);
        s.disc(cx + 14, y - 1, 1, black);
        s.hline(cx + 18, y - 5, 2, black);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Behind the street: the mill and its chimney stacks
// ---------------------------------------------------------------------------

/**
 * The mill behind the terraces (its upper floors and parapet show over the roofs) and two
 * brick chimney stacks, tall and tapering, with a corbelled cap; the near one smokes.
 */
export function paintMill(s: Surface, p: Paint, life: Life): void {
  const { g } = p;
  const B = g.B;
  const d = (c: Color): Color => p.D(c, MILL);
  // the mill: a long brick block, four floors of tall round-headed windows of small
  // panes in stone sills, a stone cornice
  const x0 = sx(g, -74);
  const x1 = sx(g, -18);
  const top = B - 82;
  const wall = d(P.brickDark);
  s.rect(x0, top, x1 - x0, B - top, wall);
  s.vline(x0, top, B - top, d(P.brick));
  s.vline(x1 - 1, top, B - top, d(shade(P.brickDark, -0.2)));
  const glass = p.lamps ? P.goldDark : d(P.slate);
  const bar = p.lamps ? d(P.woodDark) : d(P.steel);
  const sill = d(P.concrete);
  // piers between every three bays, lit on their left; the bays between them
  const BAY = 8;
  for (let y = top + 5, floor = 0; y < B - 6; y += 12, floor++) {
    // a string course under each floor
    s.hline(x0, y + 10, x1 - x0, d(shade(P.brickDark, -0.14)));
    for (let x = x0 + 4, bay = 0; x + 6 < x1; x += BAY, bay++) {
      if (bay % 4 === 3) continue;
      const lit = p.lamps && hash2(bay, floor, p.seed + 41) < 0.45;
      const c = lit ? P.gold : glass;
      // a round head, then the glazing: panes three high, two across
      s.hline(x + 1, y, 3, c);
      s.rect(x, y + 1, 5, 7, c);
      s.vline(x + 2, y + 1, 7, lit ? P.goldDark : bar);
      s.hline(x, y + 3, 5, lit ? P.goldDark : bar);
      s.hline(x, y + 5, 5, lit ? P.goldDark : bar);
      if (!lit && !p.lamps) s.px(x, y + 1, d(P.mist));
      s.hline(x - 1, y + 8, 7, sill);
    }
  }
  for (let x = x0 + 4 + 3 * BAY; x < x1 - 4; x += 4 * BAY) {
    s.rect(x, top, 6, B - top, wall);
    s.vline(x, top, B - top, d(P.brick));
    s.vline(x + 5, top, B - top, d(shade(P.brickDark, -0.18)));
  }
  s.rect(x0 - 1, top - 3, x1 - x0 + 2, 3, d(P.concrete));
  s.hline(x0 - 1, top - 3, x1 - x0 + 2, d(P.concreteLight));
  // a water tank on the roof at its right end, on legs
  const tx = x1 - 16;
  s.rect(tx, top - 12, 10, 7, d(P.slate));
  s.hline(tx, top - 12, 10, d(P.steel));
  s.vline(tx + 1, top - 5, 2, d(P.slate));
  s.vline(tx + 8, top - 5, 2, d(P.slate));

  // the chimney stacks: the near one beside the mill, a far one away to the right
  stack(s, p, life, x1 + 6, B - 112, B, 0.5, true);
  stack(s, p, life, sx(g, 112), B - 96, B, 0.64, true);
}

/**
 * A mill chimney: 9 px at its foot tapering to 6, brick lit on its left, bands of darker
 * courses, a corbelled cap. `x` is its left column at the foot.
 */
function stack(
  s: Surface,
  p: Paint,
  life: Life,
  x: number,
  top: number,
  foot: number,
  depth: number,
  smoke: boolean,
): void {
  const d = (c: Color): Color => p.D(c, depth);
  const lit = d(P.brick);
  const body = d(P.brickDark);
  const shut = d(shade(P.brickDark, -0.22));
  const band = d(shade(P.brickDark, -0.12));
  const h = foot - top;
  for (let y = top + 4; y < foot; y++) {
    const taper = Math.round(((foot - y) / h) * 3);
    const l = x + (taper >> 1);
    const w = 9 - taper;
    s.hline(l, y, w, body);
    s.px(l, y, lit);
    s.px(l + 1, y, lit);
    s.px(l + w - 1, y, shut);
    if ((y - top) % 14 === 6) s.hline(l, y, w, band);
  }
  // the cap: a corbelled band wider than the shaft, lit on top
  const l = x + 1;
  s.rect(l - 1, top, 9, 4, d(P.brick));
  s.hline(l - 1, top, 9, d(P.brickLight));
  s.hline(l - 1, top + 3, 9, shut);
  s.px(l + 7, top + 1, shut);
  s.px(l + 7, top + 2, shut);
  if (smoke) {
    life.movers.push(millSmoke(p, l + 3, top - 1, depth));
  }
}

/**
 * A mill chimney's smoke: big round puffs of coal smoke that climb a little, then lie over
 * on the wind and sink, drifting away right in a long plume down towards the roofs (so its
 * far half shows under the question board while it asks), lit on their top left, then
 * shrinking away in steps. Stepped at 5 frames a second like the houses' smoke.
 */
function millSmoke(p: Paint, x: number, y: number, depth: number): Mover {
  // how far below the cap the plume ends: just over the terrace's chimney pots
  const sink = Math.max(0, p.g.B - 74 - y);
  const light = p.D(P.chalk, depth);
  const body = p.D(P.concreteLight, depth);
  const dark = p.D(P.concrete, depth);
  const salt = (x * 7 + y) % 13;
  const N = 14;
  return {
    far(s: Surface, t: number): void {
      const tt = Math.floor(t * 5) / 5;
      // the oldest (farthest) puffs first, so the newer ones overlap them
      const phase = tt / 11 + salt * 0.07;
      const base = phase % (1 / N);
      const born = Math.floor(phase * N);
      for (let k = N - 1; k >= 0; k--) {
        const a = base + k / N;
        if (a <= 0 || a >= 1) continue;
        // each puff its own size and place across the plume, kept for its life (its id
        // follows it as k steps on), so the plume is lumpy and never a string of beads
        const id = born - k;
        const jr = hash2(id, salt, 77);
        const jy = Math.round((hash2(id, salt, 78) - 0.5) * 5);
        // up out of the stack, then beaten down by the wind onto the town: the plume lies
        // over and sinks towards the roofs, so its far end shows under the question board
        const lift =
          a < 0.18 ? (a / 0.18) * 9 : 9 - ((a - 0.18) / 0.82) * (9 + sink);
        const px = x + Math.round(a * 96);
        const py =
          y -
          Math.round(lift) +
          Math.round(Math.sin(a * 9) * 2) +
          (a > 0.1 ? jy : 0);
        const grow =
          2 +
          Math.round(a * 7) +
          (a > 0.25 ? (jr < 0.3 ? -1 : jr > 0.7 ? 1 : 0) : 0);
        const r = a > 0.9 ? 2 : a > 0.8 ? 4 : grow;
        if (a > 0.8) {
          // shrinking away in steps: a smaller puff, then a last small one
          s.disc(px + 1, py + 1, r, dark);
          s.disc(px, py, r, body);
          continue;
        }
        // a round puff: its shadow under it on the right, its body, its lit top left
        s.disc(px + 1, py + 1, r, dark);
        s.disc(px, py, r, body);
        if (r > 2) {
          s.disc(
            px - Math.round(r * 0.35),
            py - Math.round(r * 0.35),
            r - 2,
            light,
          );
          s.disc(px, py, r - 2, body);
          s.disc(
            px - Math.round(r * 0.45),
            py - Math.round(r * 0.45),
            Math.max(0, r - 4),
            light,
          );
        }
      }
    },
  };
}

// ---------------------------------------------------------------------------
// The village green (tiers 0 and 1): the bandstand and the old trees
// ---------------------------------------------------------------------------

/**
 * The green's bandstand off the left of the stage (on a monitor), standing on the grass at
 * the far touchline in front of the hedge: a brick plinth, a white railing, slender iron
 * columns with brackets, a fretwork frieze and a striped ogee roof under a gold finial.
 */
export function paintBandstand(s: Surface, p: Paint): void {
  const { g, E } = p;
  const x = sx(g, -100);
  if (x + 40 < 0) return;
  const F = g.F + 2;
  const brick = E(P.brick);
  const brickLo = E(P.brickDark);
  const stone = E(P.concreteLight);
  const iron = E(P.chalk);
  const ironLo = E(P.mist);
  const ironDeep = E(P.steel);
  // the plinth: courses of brick, a stone coping, the steps up in front
  s.rect(x - 30, F - 9, 60, 9, brick);
  for (let y = F - 7, row = 0; y < F; y += 3, row++) {
    for (let k = (row & 1) * 3; k < 60; k += 6) s.px(x - 30 + k, y, brickLo);
  }
  s.vline(x + 28, F - 9, 9, brickLo);
  s.vline(x + 29, F - 9, 9, brickLo);
  s.hline(x - 31, F - 10, 62, stone);
  s.hline(x - 31, F - 9, 62, E(P.concrete));
  s.rect(x - 9, F - 5, 18, 5, stone);
  s.hline(x - 9, F - 3, 18, E(P.concrete));
  s.hline(x - 7, F - 6, 14, E(P.steelHi));
  // the back columns, seen through the front: thin and in shade
  for (const off of [-21, -7, 7, 21]) s.vline(x + off, F - 44, 34, ironDeep);
  // the railing round the deck: a top rail, a bottom rail, balusters
  s.hline(x - 29, F - 18, 58, iron);
  s.hline(x - 29, F - 17, 58, ironLo);
  s.hline(x - 29, F - 12, 58, iron);
  s.hline(x - 29, F - 11, 58, ironLo);
  for (let k = 1; k < 58; k += 3) {
    s.vline(x - 29 + k, F - 16, 4, (k & 1) === 1 ? ironLo : iron);
  }
  // the front columns with a bracket at each top
  for (const off of [-28, -14, 0, 14, 27]) {
    const cx = x + off;
    s.vline(cx, F - 45, 35, iron);
    s.vline(cx + 1, F - 45, 35, ironLo);
    s.hline(cx - 1, F - 11, 4, iron);
    // the bracket: a little arch of fretwork either side
    s.px(cx - 1, F - 45, iron);
    s.px(cx - 2, F - 45, iron);
    s.px(cx - 1, F - 44, iron);
    s.px(cx + 2, F - 45, ironLo);
    s.px(cx + 3, F - 45, ironLo);
    s.px(cx + 2, F - 44, ironLo);
  }
  // the frieze: a fascia in park green, a white band, a scalloped edge under it
  s.hline(x - 31, F - 50, 62, E(P.grassDeep));
  s.rect(x - 31, F - 49, 62, 3, iron);
  s.hline(x - 31, F - 47, 62, ironLo);
  for (let k = 0; k < 62; k += 4) {
    s.hline(x - 30 + k, F - 46, 2, iron);
  }
  // at night, lanterns hung under the frieze between the columns
  if (p.lamps) {
    for (const off of [-21, -7, 7, 21]) {
      s.disc(x + off, F - 41, 4, P.amberDim, 0.25);
      s.vline(x + off, F - 45, 2, ironDeep);
      s.rect(x + off - 1, F - 43, 2, 3, P.goldLight);
      s.px(x + off - 1, F - 43, P.white);
    }
  }
  // the roof: an ogee bell, eaves wide, rising to a point; segments in park green and cream
  const RH = 24;
  const half = 35;
  for (let r = 0; r < RH; r++) {
    const f = 1 - r / RH;
    const hw = Math.max(0, Math.round(half * Math.pow(f, 1.9)));
    const y = F - 51 - r;
    for (let dx = -hw; dx <= hw; dx++) {
      const seg = Math.floor(((dx + hw + 0.5) / (2 * hw + 1)) * 6);
      const red = seg % 2 === 0;
      const left = dx < 0;
      const c = red
        ? left
          ? E(P.grassDark)
          : E(P.grassDeep)
        : left
          ? E(P.chalk)
          : E(P.mist);
      s.px(x + dx, y, c);
    }
    // the lit edge on the left of the bell
    if (hw > 0) s.px(x - hw, y, E(P.grass));
  }
  // the eaves' lip, dark under it
  s.hline(x - half, F - 51, 2 * half + 1, E(P.grassDeep));
  s.hline(x - half + 1, F - 50, 2 * half - 1, E(P.night));
  // the finial: a gold rod, a ball and a little vane
  const tip = F - 51 - RH;
  s.vline(x, tip - 7, 8, E(P.goldDark));
  s.px(x - 1, tip - 7, E(P.gold));
  s.rect(x - 1, tip - 9, 3, 2, E(P.gold));
  s.px(x - 1, tip - 9, E(P.goldLight));
  s.hline(x + 1, tip - 12, 4, E(P.gold));
  s.hline(x + 1, tip - 11, 3, E(P.goldDark));
  s.vline(x, tip - 13, 4, E(P.goldDark));
}

/**
 * An old tree standing on the green: a thick trunk flaring into roots and forking into
 * limbs, under one broad crown made of lumps but lit as a single mass (its shade under it
 * and on its right, its lit top left), with leaf clumps over it and a gap or two where the
 * limbs show. `x` is the trunk's middle, `foot` the row it stands on.
 */
export function paintOldTree(
  s: Surface,
  p: Paint,
  x: number,
  foot: number,
  size: number,
  salt: number,
): void {
  const { E } = p;
  const bark = E(P.woodDark);
  const barkLit = E(P.wood);
  const barkLo = E(shade(P.woodDark, -0.3));
  const R = Math.round(24 * size);
  const trunkTop = foot - Math.round(34 * size);
  const cy = trunkTop - Math.round(R * 0.55);
  const lumps: readonly [number, number, number][] = [
    [-1.3, 0.28, 0.52],
    [1.35, 0.22, 0.54],
    [-0.65, -0.32, 0.66],
    [0.62, -0.38, 0.64],
    [0.0, 0.02, 0.84],
    [-0.1, -0.62, 0.55],
  ];
  const at = (i: number, k: number): number => {
    const [ox, oy, rr] = lumps[i];
    return k === 0
      ? x + Math.round(ox * R)
      : k === 1
        ? cy + Math.round(oy * R)
        : Math.round(rr * R);
  };
  // the crown's mass in shade, a little lower and right: its underside
  const deep = E(P.grassDeep);
  const mid = E(P.grassDark);
  const lit = E(P.grass);
  const hi = E(P.grassLight);
  for (let i = 0; i < lumps.length; i++)
    s.disc(at(i, 0), at(i, 1), at(i, 2), deep);
  // the trunk: 8 wide, flaring at the roots, lit on its left, furrowed
  for (let y = trunkTop; y < foot; y++) {
    const flare = foot - y < 4 ? 4 - (foot - y) : 0;
    const l = x - 4 - flare;
    const w = 8 + flare * 2;
    s.hline(l, y, w, bark);
    s.px(l, y, barkLit);
    s.px(l + 1, y, barkLit);
    s.px(l + w - 1, y, barkLo);
    if ((y + salt) % 5 === 0) s.px(x - 1, y, barkLo);
    if ((y + salt) % 7 === 2) s.px(x + 2, y, barkLo);
  }
  // the crown in its own light: the middle tone over the upper left of each lump, then
  // the lit tone over the upper left of the upper lumps, leaving the shade under and right
  for (let i = 0; i < lumps.length; i++) {
    const r = at(i, 2);
    s.disc(
      at(i, 0) - Math.round(r * 0.12),
      at(i, 1) - Math.round(r * 0.18),
      r * 0.82,
      mid,
    );
  }
  // the limbs: two forks up and out under the leaves, a stub of a lost bough
  for (let k = 0; k < 12; k++) {
    s.hline(x - 4 - Math.round(k * 1.1), trunkTop - k, 4, bark);
    s.px(x - 4 - Math.round(k * 1.1), trunkTop - k, barkLit);
    s.hline(x + 1 + Math.round(k * 0.9), trunkTop - k, 3, barkLo);
  }
  s.hline(x + 4, trunkTop + 6, 4, bark);
  s.px(x + 7, trunkTop + 5, barkLo);
  for (let i = 0; i < lumps.length; i++) {
    if (lumps[i][1] > 0.1) continue;
    const r = at(i, 2);
    s.disc(
      at(i, 0) - Math.round(r * 0.32),
      at(i, 1) - Math.round(r * 0.38),
      r * 0.45,
      lit,
    );
  }
  // gaps in the leaves where the limbs show through
  s.rect(x - 9, cy + Math.round(R * 0.35), 3, 2, deep);
  s.hline(x - 10, cy + Math.round(R * 0.35) + 1, 2, bark);
  s.rect(x + 8, cy + Math.round(R * 0.2), 3, 2, deep);
  s.hline(x + 9, cy + Math.round(R * 0.2) + 1, 2, bark);
  // leaf clumps: a dash and the pixel over its left end, lit up and left, dark down right
  const top = cy - R - 2;
  for (let y = top; y < trunkTop + 2; y += 3) {
    for (let xx = x - 2 * R + ((y >> 1) & 3); xx < x + 2 * R; xx += 4) {
      const c0 = s.get(xx, y);
      if (c0 !== deep && c0 !== mid && c0 !== lit) continue;
      if (s.get(xx + 1, y) !== c0 || s.get(xx, y - 1) !== c0) continue;
      const h = hash2(xx, y, salt * 53 + 7);
      if (h > 0.55) continue;
      const c =
        c0 === lit
          ? h < 0.2
            ? hi
            : mid
          : c0 === mid
            ? h < 0.3
              ? lit
              : deep
            : mid;
      s.px(xx, y, c);
      s.px(xx + 1, y, c);
      s.px(xx, y - 1, c);
    }
  }
}

/** The green's two old trees, off the stage on a monitor. */
export function paintGreenTrees(s: Surface, p: Paint): void {
  const { g } = p;
  paintOldTree(s, p, sx(g, 86), g.F + 3, 1.15, 3);
  paintOldTree(s, p, sx(g, -150), g.F + 2, 1, 7);
}

// ---------------------------------------------------------------------------
// The park's near side (tiers 0 and 1)
// ---------------------------------------------------------------------------

/**
 * The path as cobbles (setts) between its kerbs, rows `py + 2 .. py + 11`: stones 5 x 3
 * in courses, each lit along its top left and shaded along its foot, the joints dark.
 */
export function paintCobbles(s: Surface, p: Paint, py: number): void {
  const { g, E } = p;
  const joint = E(P.concreteDark);
  const stone = E(P.concrete);
  const lit = E(P.concreteLight);
  const lo = E(shade(P.concrete, -0.15));
  s.rect(0, py + 1, g.w, 11, joint);
  for (let row = 0; row < 3; row++) {
    const y = py + 2 + row * 3 + (row > 0 ? row - 1 : 0) * 0;
    const off = (row & 1) * 3 - 6;
    for (let x = off; x < g.w; x += 6) {
      const r = hash2(x, row, p.seed + 63);
      const c = r < 0.18 ? E(P.steel) : r < 0.3 ? lo : stone;
      s.hline(x + 1, y, 4, c);
      s.rect(x, y + 1, 5, 2, c);
      s.hline(x + 1, y, 3, lit);
      s.px(x, y + 1, lit);
      s.hline(x + 1, y + 2, 4, lo);
    }
  }
  // a gutter of flat stones along the far kerb
  s.hline(0, py + 11, g.w, E(P.concrete));
}

/**
 * A drinking fountain beside the bench: a granite pedestal, a basin on a fluted column, a
 * domed cap with a ball on top, a cup on its chain. `x` is its left column, `py` the path.
 */
export function paintFountain(
  s: Surface,
  p: Paint,
  x: number,
  py: number,
): void {
  const { E } = p;
  const lit = E(P.concreteLight);
  const mid = E(P.concrete);
  const lo = E(P.concreteDark);
  const iron = E(P.grassDeep);
  // the step and the pedestal
  s.rect(x - 1, py + 1, 14, 3, mid);
  s.hline(x - 1, py + 1, 14, lit);
  s.rect(x + 2, py - 10, 8, 11, mid);
  s.vline(x + 2, py - 10, 11, lit);
  s.vline(x + 9, py - 10, 11, lo);
  s.vline(x + 5, py - 8, 8, lo);
  // the basin, lit on its rim
  s.rect(x, py - 14, 12, 4, mid);
  s.hline(x, py - 14, 12, lit);
  s.hline(x + 1, py - 11, 10, lo);
  s.hline(x + 2, py - 13, 8, E(P.skyMid));
  // the cap: a little dome on a neck, a ball on top
  s.rect(x + 4, py - 18, 4, 4, iron);
  s.vline(x + 4, py - 18, 4, E(P.grassDark));
  s.hline(x + 3, py - 19, 6, iron);
  s.hline(x + 4, py - 20, 4, iron);
  s.px(x + 4, py - 20, E(P.grassDark));
  s.rect(x + 5, py - 22, 2, 2, E(P.gold));
  // the cup on its chain, hanging from the basin
  s.px(x + 11, py - 10, E(P.steel));
  s.px(x + 12, py - 9, E(P.steel));
  s.rect(x + 12, py - 8, 2, 2, E(P.steelHi));
}

/**
 * A penny-farthing standing on the grass, side on, propped on its little wheel: a big wheel
 * (radius 13) with a thick black tyre, a bright rim and spokes, the little wheel behind,
 * the curved backbone, a leather saddle and the handlebar; its shadow on the grass.
 * (x, y) is the big wheel's hub.
 */
export function paintPennyFarthing(
  s: Surface,
  p: Paint,
  x: number,
  y: number,
): void {
  const { E } = p;
  const tyre = E(P.night);
  const rim = E(P.steelHi);
  const spoke = E(P.mist);
  const frame = E(P.slate);
  const frameLit = E(P.steel);
  const R = 13;
  // the shadow under both wheels
  s.hline(x - 9, y + R + 1, 2 * R + 16, E(P.grassDark));
  s.circle(x, y, R, tyre);
  s.circle(x, y, R - 1, tyre);
  s.circle(x, y, R - 2, rim);
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2 + 0.13;
    s.line(
      x,
      y,
      x + Math.round(Math.cos(a) * (R - 3)),
      y + Math.round(Math.sin(a) * (R - 3)),
      spoke,
    );
  }
  s.rect(x - 1, y - 1, 3, 3, frame);
  s.px(x - 1, y - 1, frameLit);
  // the little wheel behind, standing on the same grass
  const lx = x + R + 10;
  const ly = y + R - 4;
  s.circle(lx, ly, 4, tyre);
  s.circle(lx, ly, 3, rim);
  s.px(lx, ly, frame);
  // the backbone: from the head over the big wheel, curving down its back to the little one
  const pts: readonly [number, number][] = [
    [x + 1, y - R - 2],
    [x + 6, y - R - 1],
    [x + 12, y - R + 3],
    [x + R + 3, y - 3],
    [x + R + 6, y + 2],
    [lx, ly],
  ];
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    s.line(ax, ay, bx, by, frame);
    s.line(ax, ay - 1, bx, by - 1, frameLit);
  }
  // the fork down to the hub
  s.line(x + 1, y - R - 2, x, y, frame);
  // the saddle and the handlebar
  s.hline(x + 3, y - R - 4, 5, E(P.woodDark));
  s.hline(x + 4, y - R - 5, 3, E(P.wood));
  s.hline(x - 4, y - R - 3, 6, frame);
  s.px(x - 4, y - R - 4, E(P.woodDark));
  s.px(x - 4, y - R - 2, E(P.woodDark));
}

/**
 * The picnic's two in RETRO (near.ts draws them from behind, a gent in a dark coat and a
 * lady in a cream blouse, on a green tartan rug): his straw boater with its dark band, her
 * hair up in a bun under a lace parasol held over her shoulder. `x0` the rug's left, `yb`
 * its top row (near.ts `px0`, `pyb`).
 */
export function paintPicnicHats(
  s: Surface,
  p: Paint,
  x0: number,
  yb: number,
): void {
  const { E } = p;
  // the gent (paintBack at x0 + 6: his head's top row is yb - 16, its columns 2..9)
  const gx = x0 + 6;
  const top = yb - 16;
  const straw = E(mix(P.gold, P.chalk, 0.45));
  const strawLit = E(mix(P.goldLight, P.chalk, 0.6));
  const strawLo = E(mix(P.goldDark, P.wood, 0.5));
  s.hline(gx + 3, top - 2, 6, strawLit);
  s.rect(gx + 3, top - 1, 6, 2, straw);
  s.px(gx + 8, top, strawLo);
  s.hline(gx + 3, top + 1, 6, E(P.night));
  s.hline(gx + 1, top + 2, 10, straw);
  s.hline(gx + 1, top + 2, 3, strawLit);
  s.hline(gx + 2, top + 3, 8, strawLo);
  // the lady (at x0 + 22): her hair up in a bun, then the parasol over her right shoulder
  const lx = x0 + 22;
  const hair = E(P.hairBlond);
  s.rect(lx + 5, top - 2, 3, 2, hair);
  s.px(lx + 5, top - 2, E(shade(P.hairBlond, 0.25)));
  const lace = E(P.chalk);
  const laceLo = E(P.mist);
  const cx = lx + 13;
  const cy = top - 9;
  // the canopy: a shallow dome, ribs in shade, a scalloped hem, a tip
  const rows: readonly (readonly [number, number])[] = [
    [-2, 5],
    [-5, 11],
    [-7, 15],
    [-8, 17],
  ];
  for (let r = 0; r < rows.length; r++) {
    const [o, w] = rows[r];
    s.hline(cx + o, cy + r, w, lace);
    s.px(cx + o + w - 1, cy + r, laceLo);
    if (r > 0) s.px(cx + o, cy + r, E(P.white));
  }
  for (let k = -8; k <= 8; k += 2) s.px(cx + k, cy + 4, lace);
  for (const k of [-4, 0, 4]) s.vline(cx + k, cy + 1, 3, laceLo);
  s.vline(cx, cy - 2, 2, E(P.woodDark));
  // the handle down to her shoulder
  s.line(cx, cy + 4, lx + 9, top + 9, E(P.woodDark));
}

/**
 * The green below the flower bed (tiers 0 and 1; HOME leaves it bare), its rows `top` to
 * `foot` (the shrubs' top), laid out across the middle of that band: an ornamental pond in a
 * stone kerb off to the left (on a monitor) with ducks and a toy yacht; an old gent in his
 * bowler on a park bench, seen from behind, a nanny's perambulator beside him, near the
 * middle (on a phone too); the park keeper's board, KEEP OFF THE GRASS, off to the right.
 * Nothing when there is no room.
 */
export function paintLowerGreen(
  s: Surface,
  p: Paint,
  top: number,
  foot: number,
): void {
  const { g, E } = p;
  if (foot - top < 34) return;
  const y = top + Math.min(Math.round((foot - top) * 0.42), 40);
  // the pond: a stone kerb, the water in two tones, glints, ducks, the yacht
  const px = sx(g, -112);
  if (px + 46 > 0) {
    s.ellipse(px, y, 42, 11, E(P.concreteLight), true);
    s.ellipse(px, y + 1, 40, 9, E(P.concrete), true);
    s.ellipse(px, y + 1, 38, 8, E(P.skyMid), true);
    s.ellipse(px - 4, y - 1, 30, 4, E(P.skyLow), true);
    s.hline(px - 22, y + 5, 10, E(P.skyLow));
    s.hline(px + 10, y + 6, 14, E(shade(P.skyMid, -0.15)));
    for (const [dx, dy] of [
      [-24, 1],
      [-15, 4],
    ] as const) {
      const x = px + dx;
      const yy = y + dy;
      s.rect(x, yy, 5, 2, E(P.wood));
      s.hline(x, yy, 4, E(shade(P.wood, 0.2)));
      s.rect(x + 4, yy - 2, 2, 2, E(P.grassDeep));
      s.px(x + 6, yy - 1, E(P.gold));
      s.hline(x - 1, yy + 2, 7, E(P.skyLow));
    }
    const bx = px + 12;
    s.hline(bx - 5, y + 2, 11, E(P.brickDark));
    s.hline(bx - 4, y + 3, 9, E(shade(P.brickDark, -0.3)));
    s.vline(bx, y - 11, 13, E(P.woodDark));
    for (let r = 0; r < 10; r++) {
      s.hline(bx + 1, y - 10 + r, Math.min(r + 1, 6), E(P.chalk));
      if (r > 2) {
        const w = Math.min(r - 2, 4);
        s.hline(bx - w, y - 10 + r, w, E(P.mist));
      }
    }
    s.hline(bx, y - 12, 3, E(P.retro));
  }
  // the gent on his bench, from behind, and the perambulator beside it
  const bx = sx(g, -12);
  if (bx < g.w && bx + 64 > 0) {
    const wood = E(P.wood);
    const iron = E(P.night);
    s.hline(bx - 2, y + 1, 62, E(P.grassDeep));
    // the gent first, cut off at the seat, so the bench's back comes over him
    const gx = bx + 8;
    const gy = y - 6;
    s.pushClip(0, 0, g.w, y - 7);
    paintBack(s, gx, gy, E(P.mist), E(P.night), true, E(P.skinA));
    s.popClip();
    // his bowler: a round crown, a narrow curled brim
    const ht = gy + 2 - 26;
    const hat = E(P.night);
    s.hline(gx + 6, ht - 2, 4, E(P.slate));
    s.rect(gx + 5, ht - 1, 6, 2, hat);
    s.px(gx + 6, ht - 1, E(P.slate));
    s.hline(gx + 3, ht + 1, 10, hat);
    s.px(gx + 3, ht, hat);
    s.px(gx + 12, ht, hat);
    // the bench: two slats of its back on iron ends, the seat rail
    s.hline(bx, y - 12, 30, E(shade(P.wood, 0.25)));
    s.hline(bx, y - 11, 30, wood);
    s.hline(bx, y - 9, 30, wood);
    s.hline(bx, y - 8, 30, E(shade(P.wood, -0.2)));
    s.rect(bx, y - 6, 30, 2, E(P.woodDark));
    for (const lx of [bx + 2, bx + 26]) {
      s.vline(lx, y - 13, 14, E(P.slate));
      s.vline(lx + 1, y - 13, 14, iron);
    }
    // the perambulator: a deep black body on C-springs, its hood up, a blanket, big
    // spoked wheels, the handle bar back towards us
    const cx = bx + 38;
    const body = E(P.night);
    const lit = E(P.slate);
    for (const wx of [cx + 3, cx + 13]) {
      s.circle(wx, y - 4, 4, iron);
      s.hline(wx - 2, y - 4, 5, E(P.steel));
      s.vline(wx, y - 6, 5, E(P.steel));
    }
    s.vline(cx + 5, y - 9, 2, E(P.steel));
    s.vline(cx + 11, y - 9, 2, E(P.steel));
    s.rect(cx, y - 15, 17, 6, body);
    s.hline(cx, y - 15, 17, lit);
    s.hline(cx + 1, y - 10, 15, E(shade(P.night, -0.3)));
    s.hline(cx + 3, y - 13, 12, E(P.retroDark));
    s.hline(cx + 7, y - 16, 9, E(P.chalk));
    for (let r = 0; r < 6; r++) {
      s.hline(cx, y - 16 - r, 7 - r, body);
      s.px(cx + 6 - r, y - 16 - r, lit);
    }
    s.line(cx + 16, y - 15, cx + 21, y - 21, iron);
    s.hline(cx + 20, y - 22, 4, E(P.chalk));
  }
  // the keeper's board: a post, a painted board in green, chalk letters
  const kx = sx(g, 104);
  if (kx - 40 < g.w) {
    const text = "KEEP OFF THE GRASS";
    const tw = measureText(text, { font: FONT_3x5 });
    const bw = tw + 6;
    const bx = kx - (bw >> 1);
    s.vline(kx, y - 6, 16, E(P.woodDark));
    s.vline(kx - 1, y - 6, 16, E(P.wood));
    s.rect(bx, y - 15, bw, 9, E(P.grassDeep));
    s.hline(bx, y - 15, bw, E(P.grassDark));
    s.hline(bx, y - 7, bw, E(shade(P.grassDeep, -0.3)));
    drawText(s, text, bx + 3, y - 13, E(P.chalk), { font: FONT_3x5 });
    s.hline(kx - 3, y + 9, 6, E(P.grassDeep));
  }
}

/**
 * A milk cart passing along the cobbled path (tiers 0 and 1, a mover drawn over the layer):
 * a brown horse at a walk (legs stepping, its tail swinging), a green cart on a spoked
 * wheel that turns, three churns on it, the milkman on the box in his cap and dark coat,
 * a lantern lit at night. It crosses the park left to right and is gone a while. `py` is
 * the path's top row (near.ts).
 */
export function retroCart(p: Paint, py: number): Mover {
  const { g, E } = p;
  const ground = py + 10;
  const horse = E(P.wood);
  const horseLit = E(shade(P.wood, 0.22));
  const horseLo = E(P.woodDark);
  const hoof = E(P.night);
  const cart = E(P.grassDeep);
  const cartLit = E(P.grassDark);
  const lining = E(P.gold);
  const wheel = E(P.woodDark);
  const spoke = E(P.wood);
  const churn = E(P.steelHi);
  const churnLo = E(P.steel);
  const coat = E(P.night);
  const coatLit = E(P.slate);
  const skin = E(P.skinA);
  const cap = E(P.slate);
  const shadow = E(P.concreteDark);
  const lamp = p.lamps ? P.goldLight : E(P.mist);
  const LEN = 40;
  const SPEED = 14;
  const span = g.w + LEN + 60;
  const period = span / SPEED + 14;
  const start = hash2(g.w, py, p.seed + 21) * period;
  return {
    far(s: Surface, t: number): void {
      const tt = Math.floor(t * 8) / 8;
      const x = Math.round(((tt + start) % period) * SPEED) - LEN - 20;
      if (x > g.w + 4) return;
      const step = Math.floor(tt * 4) & 1;
      // (x, ground) is the cart's back corner on the cobbles; the horse in front of it
      s.hline(x + 2, ground + 1, LEN - 4, shadow);
      // the cart: a box in green, lined in gold, on its wheel
      s.rect(x, ground - 12, 17, 5, cart);
      s.hline(x, ground - 12, 17, cartLit);
      s.hline(x + 1, ground - 10, 15, lining);
      s.hline(x, ground - 8, 17, E(shade(P.grassDeep, -0.3)));
      // the churns on it, lids lit
      for (const k of [1, 5, 9]) {
        s.rect(x + k, ground - 17, 3, 5, churn);
        s.vline(x + k + 2, ground - 17, 5, churnLo);
        s.hline(x + k, ground - 18, 3, churnLo);
        s.px(x + k, ground - 17, E(P.white));
      }
      // the milkman on the box, reins in his hands
      s.rect(x + 13, ground - 19, 4, 7, coat);
      s.vline(x + 13, ground - 19, 7, coatLit);
      s.rect(x + 14, ground - 22, 3, 3, skin);
      s.hline(x + 13, ground - 23, 4, cap);
      s.hline(x + 14, ground - 23, 4, cap);
      s.px(x + 17, ground - 22, cap);
      s.line(x + 17, ground - 16, x + 34, ground - 15, coat);
      // the lantern on the cart's front corner
      s.rect(x + 17, ground - 14, 2, 2, lamp);
      if (p.lamps) s.disc(x + 17, ground - 13, 4, P.amberDim, 0.25);
      // the wheel: a dark rim, spokes turning, the hub
      const wx = x + 8;
      const wy = ground - 5;
      s.circle(wx, wy, 5, wheel);
      if (step === 0) {
        s.hline(wx - 3, wy, 7, spoke);
        s.vline(wx, wy - 3, 7, spoke);
      } else {
        s.line(wx - 2, wy - 2, wx + 2, wy + 2, spoke);
        s.line(wx - 2, wy + 2, wx + 2, wy - 2, spoke);
      }
      s.px(wx, wy, wheel);
      // the shafts to the horse
      s.hline(x + 16, ground - 9, 8, horseLo);
      // the horse: body, legs stepping, neck and head up, mane, tail
      const b = x + 22;
      s.rect(b, ground - 13, 13, 6, horse);
      s.hline(b + 1, ground - 13, 11, horseLit);
      s.hline(b, ground - 8, 13, horseLo);
      for (const [lx, phase] of [
        [b + 1, 0],
        [b + 3, 1],
        [b + 10, 1],
        [b + 12, 0],
      ] as const) {
        const fwd = (phase ^ step) === 1 ? 1 : 0;
        s.vline(lx, ground - 7, 4, horseLo);
        s.vline(lx + fwd, ground - 3, 3, horseLo);
        s.px(lx + fwd, ground - 1, hoof);
      }
      // the collar, the neck rising to the head, the mane along it
      s.rect(b + 11, ground - 17, 3, 5, horse);
      s.rect(b + 12, ground - 19, 3, 3, horse);
      s.rect(b + 14, ground - 19, 4, 3, horse);
      s.hline(b + 14, ground - 19, 3, horseLit);
      s.px(b + 17, ground - 17, hoof);
      s.px(b + 12, ground - 20, horseLo);
      s.vline(b + 11, ground - 18, 6, horseLo);
      s.vline(b + 10, ground - 13, 4, E(P.night));
      s.px(b + 15, ground - 18, hoof);
      // the tail, swinging
      s.vline(b - 1, ground - 12, 4, horseLo);
      s.px(b - 2 + step, ground - 8, horseLo);
    },
  };
}

/**
 * Tier 1's substitutes on the near side, backs to us, in RETRO: heavy overcoats in his
 * club's old gold and brown (never today's red hooded jackets), flat caps of tweed. Today's
 * places (`paintBack`'s long coat, near.ts's spots).
 */
export function paintRetroSubs(s: Surface, p: Paint): void {
  const { g, E } = p;
  const N = g.N;
  const subs: readonly (readonly [number, Color, Color])[] = [
    [-52, P.retro, P.woodDark],
    [-42, P.retroDark, P.steel],
    [-32, P.retro, P.wood],
  ];
  for (let i = 0; i < subs.length; i++) {
    const [off, coat, cap] = subs[i];
    const x = sx(g, off);
    const y = N + 40 - 2 * (i % 2);
    paintBack(
      s,
      x,
      y,
      E(pick(HAIR, rnd(p, i, 72, 73))),
      E(coat),
      true,
      E(pick(SKIN, rnd(p, i, 74, 73))),
    );
    // the flat cap over the back of the head (the sprite is 16 x 26, its head at 4..11)
    const top = y + 2 - 26;
    const c = E(cap);
    const lit = E(shade(cap, 0.22));
    const lo = E(shade(cap, -0.3));
    s.hline(x + 6, top, 4, lit);
    s.hline(x + 5, top + 1, 6, c);
    s.px(x + 5, top + 1, lit);
    s.hline(x + 4, top + 2, 8, c);
    s.px(x + 4, top + 2, lit);
    s.px(x + 11, top + 2, lo);
    s.hline(x + 4, top + 3, 8, lo);
    // a turned-up collar where today's hood folds down
    s.hline(x + 5, top + 8, 6, E(shade(coat, -0.15)));
  }
}

/** A wooden hoop and its stick, dropped on the grass: (x, y) the hoop's middle. */
export function paintHoop(s: Surface, p: Paint, x: number, y: number): void {
  const { E } = p;
  s.ellipse(x, y, 6, 2, E(P.woodDark));
  s.ellipse(x, y - 1, 6, 2, E(P.wood));
  s.line(x - 4, y + 4, x + 9, y + 1, E(P.woodDark));
  s.px(x - 4, y + 3, E(P.wood));
}

/** A ladder bar across a lamp post (the lamplighter's), at row y; the post is x, x + 1. */
export function lampLadder(s: Surface, p: Paint, x: number, y: number): void {
  const { E } = p;
  s.hline(x - 3, y, 8, E(P.slate));
  s.hline(x - 3, y + 1, 8, E(P.night));
}

/**
 * Tier 1's things on the grass by the rope, in RETRO: a leather Gladstone bag, an enamel
 * jug, and three brown leather balls in a string bag, its drawstring knotted on top.
 */
export function paintTier1Kit(s: Surface, p: Paint): void {
  const { g, E } = p;
  const N = g.N;
  const leather = E(P.wood);
  const leatherLo = E(P.woodDark);
  const leatherLit = E(shade(P.wood, 0.25));
  // the Gladstone bag: a box with a rounded top, a clasp and a handle
  const bag = sx(g, -14);
  s.rect(bag, N + 30, 18, 8, leather);
  s.hline(bag + 1, N + 29, 16, leather);
  s.hline(bag + 1, N + 29, 16, leatherLit);
  s.vline(bag + 17, N + 30, 8, leatherLo);
  s.hline(bag, N + 37, 18, leatherLo);
  s.hline(bag + 1, N + 31, 16, leatherLo);
  s.rect(bag + 8, N + 31, 2, 2, E(P.gold));
  s.hline(bag + 6, N + 27, 6, leatherLo);
  s.px(bag + 5, N + 28, leatherLo);
  s.px(bag + 12, N + 28, leatherLo);
  // a second, a big holdall of canvas, its straps
  s.rect(bag + 22, N + 32, 16, 6, E(P.concrete));
  s.hline(bag + 22, N + 32, 16, E(P.concreteLight));
  s.vline(bag + 26, N + 32, 6, leatherLo);
  s.vline(bag + 33, N + 32, 6, leatherLo);
  s.hline(bag + 25, N + 31, 10, leatherLo);
  // the enamel jug: white with a blue rim, a handle
  const fx = sx(g, -20);
  s.rect(fx, N + 29, 4, 9, E(P.chalk));
  s.vline(fx, N + 29, 9, E(P.white));
  s.vline(fx + 3, N + 30, 8, E(P.mist));
  s.hline(fx, N + 28, 4, E(P.skyMid));
  s.px(fx - 1, N + 28, E(P.skyMid));
  s.vline(fx + 4, N + 30, 4, E(P.mist));
  s.px(fx + 5, N + 31, E(P.mist));
  s.px(fx + 5, N + 32, E(P.mist));
  // the string bag of leather balls
  const nb = sx(g, 6);
  const ny = N + 26;
  const mesh = E(P.chalk);
  for (const [bxo, byo] of [
    [0, 6],
    [6, 6],
    [3, 1],
  ] as const) {
    const bx0 = nb + bxo;
    const by0 = ny + byo;
    s.rect(bx0 + 1, by0, 4, 6, leather);
    s.rect(bx0, by0 + 1, 6, 4, leather);
    s.hline(bx0 + 1, by0 + 5, 4, leatherLo);
    s.vline(bx0 + 5, by0 + 2, 3, leatherLo);
    s.px(bx0 + 1, by0 + 1, leatherLit);
    s.px(bx0 + 2, by0 + 1, leatherLit);
    // the lacing across the top
    s.px(bx0 + 3, by0 + 2, leatherLo);
    s.px(bx0 + 3, by0 + 3, leatherLo);
    for (let j = 0; j < 6; j++) {
      for (let i = 0; i < 6; i++) {
        const corner = (i === 0 || i === 5) && (j === 0 || j === 5);
        if (((i + j) & 3) === 1 && !corner) s.px(bx0 + i, by0 + j, mesh);
      }
    }
  }
  s.vline(nb + 6, ny - 2, 3, mesh);
  s.hline(nb + 5, ny - 2, 3, mesh);
  s.hline(nb, ny + 12, 12, E(P.grassDeep));
}
