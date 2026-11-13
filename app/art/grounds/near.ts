/**
 * The near side of the career ground: from the near touchline to the bottom of the
 * canvas, close to the camera and seen from behind. It is what the player looks at while
 * reading a question, so it has small, calm life (the dog) and plenty to look at.
 *
 *   tier 0  park grass, bikes, a picnic, the path with a bench, a bin and a lamp, a flower
 *           bed, shrubs
 *   tier 1  + the rope close to us, substitutes in big coats, kit bags, a flask
 *   tier 2  a rail of boards, a cinder track with two small dugouts, people on a grass bank
 *   tier 3  boards, real dugouts, a packed terrace of backs with crush barriers
 *   tier 4+ the backs of LED boards, ball kids, a steward, a moat wall and the near crowd;
 *           tier 6 the trophy on its plinth
 */

import { P } from "~/art/palette";
import {
  drawSprite,
  hash2,
  mix,
  shade,
  sprite,
  type Color,
  type Sprite,
  type Surface,
} from "~/pixel";
import { crowdBacks } from "./crowd";
import { nearRetroStadium } from "./retro-near";
import type { Life } from "./life";
import { HAIR, SKIN, pick, rnd, sx, type Grade, type Paint } from "./paint";
import { drawSteward, paintBack } from "./people";
import { tuft } from "./pitch";
import {
  lampLadder,
  paintCobbles,
  paintFountain,
  paintHoop,
  paintLowerGreen,
  paintPennyFarthing,
  paintPicnicHats,
  paintRetroSubs,
  paintTier1Kit,
  retroCart,
} from "./retro-low";
import { paintPlankBacks, paintTrainersBench } from "./retro-club";
import { paintArenaNear } from "./nextgen-high";
import { paintNearNG } from "./nextgen-low";

export function paintNear(s: Surface, p: Paint, life: Life): void {
  // NEXT-GEN's park and small grounds (nextgen-low.ts)
  if (p.era === "nextgen" && p.tier <= 3) paintNearNG(s, p, life, grass);
  else if (p.tier <= 1) nearPark(s, p, life);
  else if (p.tier <= 3) nearClub(s, p, life);
  // NEXT-GEN's arena (nextgen-high.ts)
  else if (p.era === "nextgen") paintArenaNear(s, p, life);
  // RETRO's big grounds (retro-near.ts)
  else if (p.era === "retro") nearRetroStadium(s, p, life);
  else nearStadium(s, p, life);
}

/** Near grass, rows [y0, y1): the pitch's clusters (daisies only in the park). */
export function grass(
  s: Surface,
  p: Paint,
  G: Grade,
  y0: number,
  y1: number,
  rough: number,
): void {
  const { g, seed } = p;
  const base = G(P.grass);
  const dark = G(P.grassDark);
  const light = G(P.grassLight);
  const patch = G(mix(P.grass, P.grassDark, 0.35));
  const park = p.tier <= 1;
  const daisy = park ? G(P.chalk) : base;
  const eye = park ? G(P.gold) : base;
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < g.w; x++) {
      const k = tuft(x, y, seed + 17, rough, true);
      s.px(
        x,
        y,
        k === 1
          ? dark
          : k === 2
            ? light
            : k === 3
              ? patch
              : k === 4
                ? daisy
                : k === 5
                  ? eye
                  : base,
      );
    }
  }
}

/** The dog's colours (people.ts `DOG_LEGEND`): browns, the white, the nose, lit and shaded. */
function dogColors(G: Grade): Color[] {
  return [
    G(P.woodDark),
    G(P.wood),
    G(P.chalk),
    G(P.ink),
    G(shade(P.wood, 0.25)),
    G(shade(P.chalk, -0.2)),
  ];
}

// ---------------------------------------------------------------------------
// Tiers 0 and 1: the park
// ---------------------------------------------------------------------------

function nearPark(s: Surface, p: Paint, life: Life): void {
  const { g, E, tier } = p;
  const N = g.N;
  const H = g.h;
  grass(s, p, E, N + 1, H, 0.45);

  // the path: kerbs and gravel
  const py = Math.min(H - 44, N + (tier === 1 ? 52 : 36));
  s.rect(0, py, g.w, 14, E(P.concreteLight));
  s.hline(0, py, g.w, E(P.steelHi));
  s.hline(0, py + 12, g.w, E(P.concrete));
  s.hline(0, py + 13, g.w, E(shade(P.concrete, -0.15)));
  for (let x = (g.cx % 24) - 24; x < g.w; x += 24) {
    s.px(x, py + 1, E(P.concrete));
    s.px(x + 11, py + 12, E(P.concreteDark));
  }
  for (let y = py + 3; y < py + 11; y += 2) {
    for (let x = (y * 3) % 5; x < g.w; x += 5) {
      const h = rnd(p, x, y, 62);
      if (h < 0.45) continue;
      s.px(x, y, E(h < 0.8 ? P.concrete : P.steelHi));
    }
  }
  if (p.era === "retro") {
    paintCobbles(s, p, py);
    // a milk cart passing along the cobbles (retro-low.ts)
    life.movers.push(retroCart(p, py));
  }

  // a bench from behind: two slats on iron ends, a plaque; a bin beside it
  const bx = sx(g, -40);
  const wood = E(P.wood);
  const iron = E(P.night);
  s.hline(bx, py - 12, 36, E(shade(P.wood, 0.25)));
  s.hline(bx, py - 11, 36, wood);
  s.hline(bx, py - 9, 36, wood);
  s.hline(bx, py - 8, 36, E(shade(P.wood, -0.2)));
  s.rect(bx, py - 6, 36, 2, E(P.woodDark));
  s.hline(bx + 16, py - 11, 4, E(P.gold));
  for (const lx of [bx + 2, bx + 32]) {
    s.vline(lx, py - 13, 17, E(P.slate));
    s.vline(lx + 1, py - 13, 17, iron);
    s.px(lx - 1, py + 3, iron);
  }
  s.hline(bx + 2, py + 4, 32, E(P.concrete));
  const bin = bx + 44;
  if (p.era === "retro") {
    paintFountain(s, p, bin - 1, py);
  } else {
    s.rect(bin, py - 8, 10, 12, E(P.grassDeep));
    s.rect(bin, py - 8, 2, 12, E(P.grassDark));
    s.hline(bin, py - 3, 10, E(shade(P.grassDeep, -0.2)));
    s.hline(bin - 1, py - 10, 12, iron);
    s.hline(bin, py - 9, 10, E(P.slate));
    s.px(bin + 3, py - 11, E(P.chalk));
    s.px(bin + 4, py - 11, E(P.mist));
  }

  // an old lamp post on the path: a lantern, a cap, a finial
  const lx = sx(g, 50);
  s.vline(lx, py - 54, 61, E(P.slate));
  s.vline(lx + 1, py - 54, 61, iron);
  s.hline(lx - 2, py + 5, 6, iron);
  s.hline(lx - 1, py + 4, 4, iron);
  s.hline(lx - 1, py - 54, 4, iron);
  s.frame(lx - 2, py - 61, 6, 7, iron);
  s.hline(lx - 4, py - 62, 10, iron);
  s.hline(lx - 3, py - 63, 8, iron);
  s.rect(lx, py - 66, 2, 3, iron);
  if (p.era === "retro") lampLadder(s, p, lx, py - 48);
  if (p.lamps) {
    s.disc(lx + 1, py - 57, 10, P.amberDim, 0.25);
    s.disc(lx + 1, py - 57, 6, P.amber, 0.25);
    // its pool on the gravel
    s.pushClip(0, py, g.w, 14);
    s.ellipse(lx, py + 6, 36, 8, p.light.lit(P.concreteLight), true, 0.5);
    s.ellipse(lx, py + 6, 18, 6, p.light.lit(P.concreteLight), true);
    s.popClip();
    s.rect(lx - 1, py - 60, 4, 5, P.goldLight);
    s.rect(lx, py - 59, 2, 2, P.white);
  } else {
    s.rect(lx - 1, py - 60, 4, 5, E(P.mist));
    s.px(lx - 1, py - 60, E(P.white));
  }

  // a flower bed below the path, then shrubs along the bottom
  const fy = py + 18;
  if (fy + 12 < H - 16) {
    s.rect(0, fy, g.w, 10, E(P.woodDark));
    s.hline(0, fy, g.w, E(P.wood));
    for (let x = 3; x < g.w; x += 7) s.px(x, fy + 4 + (x % 3), E(P.wood));
    const blooms: readonly Color[] = [P.home, P.gold, P.chalk, P.homeLight];
    for (let x = 2; x < g.w; x += 6) {
      const r = rnd(p, x, 60, 61);
      if (r < 0.25) continue;
      const c = E(blooms[Math.floor(r * 40) % blooms.length]);
      const eye = E(c === E(P.gold) ? P.homeDark : P.goldLight);
      s.vline(x + 1, fy - 2, 4, E(P.grassDark));
      s.px(x, fy - 1, E(P.grass));
      s.px(x + 1, fy - 5, c);
      s.hline(x, fy - 4, 3, c);
      s.px(x + 1, fy - 4, eye);
      s.px(x + 1, fy - 3, c);
      if (r > 0.7) {
        s.vline(x + 3, fy - 4, 4, E(P.grassDark));
        s.hline(x + 3, fy - 6, 2, c);
        s.hline(x + 3, fy - 5, 2, c);
      }
    }
    // RETRO: a pond with a toy yacht and the keeper's board (retro-low.ts)
    if (p.era === "retro") paintLowerGreen(s, p, fy + 10, H - 16);
  }
  const deep = E(P.grassDeep);
  const dark = E(P.grassDark);
  const leaf = E(P.grass);
  for (let c = -1; c * 14 < g.w + 14; c++) {
    const r = rnd(p, c, 70, 71);
    const top = H - 18 - Math.floor(r * 5) * 2;
    const x = c * 14;
    // a rounded mound of leaves: the crown lit on its left, the body in shade
    for (let i = 0; i < 18; i++) {
      const e = Math.min(i, 17 - i);
      const drop = e === 0 ? 5 : e === 1 ? 3 : e === 2 ? 2 : e === 3 ? 1 : 0;
      const y = top + drop;
      s.vline(x - 2 + i, y, 4, dark);
      s.vline(x - 2 + i, y + 4, H - y - 4, deep);
      if (i > 2 && i < 9) s.px(x - 2 + i, y, leaf);
      if (i > 3 && i < 7) s.px(x - 2 + i, y + 1, leaf);
    }
    for (let k = 0; k < 4; k++) {
      const lx2 = x + 1 + Math.floor(rnd(p, c, 74 + k, 71) * 12);
      const ly2 = top + 6 + Math.floor(rnd(p, c, 78 + k, 71) * 8);
      s.hline(lx2, ly2, 2, dark);
      s.px(lx2, ly2 - 1, dark);
    }
  }

  if (tier === 0) {
    if (p.era === "retro") {
      // a penny-farthing laid down on the grass, a hoop and its stick (kept on screen)
      const pf = Math.max(sx(g, -62), 16);
      paintPennyFarthing(s, p, pf, N + 12);
      paintHoop(s, p, pf + Math.max(14, sx(g, -46) - sx(g, -62)), N + 25);
    } else {
      // two bikes dropped on the grass
      for (const [off, col] of [
        [-64, P.home],
        [-54, P.awayDark],
      ] as const) {
        bike(s, p, sx(g, off), N + 18 + (off === -54 ? 4 : 0), col);
      }
    }
    // a picnic: a checked blanket and two people sitting on it, backs to us
    const px0 = sx(g, 14);
    const pyb = N + 22;
    for (let i = 0; i < 40; i++) {
      for (let j = 0; j < 8; j++) {
        const on = ((i >> 2) + (j >> 1)) % 2 === 0;
        const rug = p.era === "retro" ? P.retro : P.home;
        s.px(px0 + i, pyb + j, E(on ? rug : P.chalk));
      }
    }
    s.hline(px0, pyb + 8, 40, E(P.grassDeep));
    // a hamper with its lid up a crack, a bottle
    s.rect(px0 + 34, pyb - 2, 9, 7, E(P.wood));
    s.hline(px0 + 34, pyb - 2, 9, E(shade(P.wood, 0.25)));
    s.hline(px0 + 34, pyb + 1, 9, E(P.woodDark));
    for (let k = 1; k < 9; k += 3)
      s.vline(px0 + 34 + k, pyb + 2, 3, E(P.woodDark));
    s.hline(px0 + 36, pyb - 4, 5, E(P.woodDark));
    s.px(px0 + 35, pyb - 3, E(P.woodDark));
    s.px(px0 + 41, pyb - 3, E(P.woodDark));
    s.rect(px0 + 30, pyb, 2, 5, E(P.grassDark));
    s.px(px0 + 30, pyb - 1, E(P.grassDark));
    s.px(px0 + 30, pyb + 1, E(P.mist));
    paintBack(
      s,
      px0 + 6,
      pyb + 2,
      E(P.hairBrown),
      E(p.era === "retro" ? P.night : P.awayDark),
      false,
      E(P.skinA),
    );
    paintBack(
      s,
      px0 + 22,
      pyb + 2,
      E(P.hairBlond),
      E(p.era === "retro" ? P.chalk : P.gold),
      false,
      E(P.skinB),
    );
    // RETRO: his boater, her parasol (retro-low.ts)
    if (p.era === "retro") paintPicnicHats(s, p, px0, pyb);
    life.dog = {
      roam: true,
      x0: sx(g, -30),
      x1: sx(g, 6),
      y: N + 30,
      colors: dogColors(E),
    };
    return;
  }

  // tier 1: the rope close to us, substitutes in big coats, kit bags, a flask
  const step = 32;
  const rope = E(P.chalk);
  const ropeLow = E(P.mist);
  for (let x = 0; x < g.w; x++) {
    const m = x % step;
    const sag = m > 9 && m < 23 ? 2 : m > 5 && m < 27 ? 1 : 0;
    s.px(x, N + 10 + sag, rope);
    s.px(x, N + 11 + sag, ropeLow);
  }
  for (let x = 0; x < g.w; x += step) {
    s.rect(x, N + 8, 4, 16, E(P.wood));
    s.vline(x, N + 8, 16, E(shade(P.wood, 0.3)));
    s.vline(x + 3, N + 9, 15, E(P.woodDark));
    s.hline(x, N + 8, 4, E(shade(P.wood, 0.4)));
    s.hline(x + 1, N + 23, 3, E(shade(P.woodDark, -0.2)));
    s.px(x + 4, N + 10, rope);
    s.px(x + 4, N + 11, ropeLow);
  }
  const subs: readonly [number, Color][] = [
    [-52, P.home],
    [-42, P.slate],
    [-32, P.homeDark],
  ];
  // RETRO's subs: old gold and brown overcoats, flat caps (retro-low.ts)
  if (p.era === "retro") paintRetroSubs(s, p);
  for (let i = 0; i < subs.length && p.era !== "retro"; i++) {
    const [off, coat] = subs[i];
    paintBack(
      s,
      sx(g, off),
      N + 40 - 2 * (i % 2),
      E(pick(HAIR, rnd(p, i, 72, 73))),
      E(coat),
      true,
      E(pick(SKIN, rnd(p, i, 74, 73))),
    );
  }
  if (p.era === "retro") {
    paintTier1Kit(s, p);
    life.dog = {
      roam: false,
      x0: sx(g, -61),
      x1: 0,
      y: N + 40,
      colors: dogColors(E),
    };
    return;
  }
  // a kit bag in his colour, a holdall, a flask, a net of balls
  const bag = sx(g, -14);
  s.rect(bag, N + 30, 18, 8, E(P.home));
  s.hline(bag, N + 30, 18, E(P.homeLight));
  s.vline(bag + 17, N + 31, 7, E(P.homeDark));
  s.hline(bag + 1, N + 37, 17, E(P.homeDark));
  s.hline(bag + 2, N + 32, 14, E(P.homeDark));
  s.hline(bag + 4, N + 28, 10, E(P.night));
  s.px(bag + 3, N + 29, E(P.night));
  s.px(bag + 14, N + 29, E(P.night));
  s.rect(bag + 4, N + 34, 4, 2, E(P.chalk));
  s.rect(bag + 22, N + 32, 16, 6, E(P.night));
  s.hline(bag + 22, N + 32, 16, E(P.slate));
  s.hline(bag + 25, N + 31, 10, E(P.slate));
  s.px(bag + 30, N + 34, E(P.steel));
  const fx = sx(g, -20);
  s.rect(fx, N + 28, 4, 10, E(P.steel));
  s.vline(fx, N + 29, 9, E(P.steelHi));
  s.vline(fx + 3, N + 29, 9, E(P.slate));
  s.rect(fx, N + 26, 4, 2, E(P.night));
  s.hline(fx, N + 31, 4, E(P.home));
  // a net of balls: three balls in a mesh bag, its drawstring knotted on top
  const nb = sx(g, 6);
  const ny = N + 26;
  const mesh = E(P.night);
  for (const [bxo, byo] of [
    [0, 6],
    [6, 6],
    [3, 1],
  ] as const) {
    const bx0 = nb + bxo;
    const by0 = ny + byo;
    s.rect(bx0 + 1, by0, 4, 6, E(P.chalk));
    s.rect(bx0, by0 + 1, 6, 4, E(P.chalk));
    s.hline(bx0 + 1, by0 + 5, 4, E(P.mist));
    s.vline(bx0 + 5, by0 + 2, 3, E(P.mist));
    s.rect(bx0 + 2, by0 + 2, 2, 2, E(P.slate));
    // the mesh over it
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
  life.dog = {
    roam: false,
    x0: sx(g, -61),
    x1: 0,
    y: N + 40,
    colors: dogColors(E),
  };
}

/** A bike lying in the grass, side on: tyres, rims, a diamond frame, saddle, bars. */
function bike(s: Surface, p: Paint, x: number, y: number, col: Color): void {
  const { E } = p;
  const tyre = E(P.night);
  const rim = E(P.steel);
  const frame = E(col);
  const lit = E(shade(col, 0.3));
  for (const wx of [x, x + 14]) {
    s.circle(wx, y, 4, tyre);
    s.circle(wx, y, 3, rim);
    s.px(wx, y, rim);
    s.px(wx, y - 2, rim);
    s.px(wx + 2, y, rim);
  }
  s.line(x, y, x + 6, y, frame);
  s.line(x + 6, y, x + 4, y - 6, frame);
  s.line(x, y, x + 4, y - 6, frame);
  s.line(x + 4, y - 6, x + 11, y - 6, lit);
  s.line(x + 6, y, x + 11, y - 6, frame);
  s.line(x + 11, y - 6, x + 14, y, frame);
  s.hline(x + 2, y - 8, 4, tyre);
  s.px(x + 4, y - 7, tyre);
  s.vline(x + 11, y - 9, 3, tyre);
  s.hline(x + 11, y - 9, 3, tyre);
  s.px(x + 6, y + 1, E(P.slate));
  s.px(x + 7, y + 1, E(P.slate));
}

// ---------------------------------------------------------------------------
// Tiers 2 and 3: a club's ground
// ---------------------------------------------------------------------------

/** The back of a row of boards on posts: plywood on a frame, braced, its shadow. */
function boardBacks(s: Surface, p: Paint, y: number, h: number): void {
  const { g, S } = p;
  const brace = S(P.concreteDark);
  s.rect(0, y, g.w, h, S(P.slate));
  s.hline(0, y, g.w, S(P.steel));
  s.hline(0, y + 1, g.w, S(shade(P.slate, 0.15)));
  s.hline(0, y + h - 3, g.w, brace);
  for (let x = (g.cx % 48) - 48; x < g.w; x += 48) {
    s.vline(x, y + 2, h - 2, brace);
    s.vline(x + 1, y + 2, h - 2, S(shade(P.slate, 0.1)));
    s.line(x + 2, y + h - 3, x + 10, y + 3, brace);
    s.line(x + 3, y + h - 3, x + 11, y + 3, brace);
    s.px(x + 24, y + 3, S(P.steel));
    s.px(x + 24, y + h - 5, S(P.steel));
  }
  s.hline(0, y + h, g.w, S(P.night));
  s.hline(0, y + h + 1, g.w, S(shade(P.night, 0.1)));
}

/**
 * A dugout from behind: the subs' heads over its back wall, a clear top, panels, its shadow;
 * the big one (tier 3) has a band in his colour.
 */
function dugout(
  s: Surface,
  p: Paint,
  x: number,
  y: number,
  w: number,
  big: boolean,
): void {
  const { S } = p;
  const h = big ? 24 : 18;
  for (let i = 6; i < w - 8; i += 10) {
    const hc = pick(HAIR, hash2(x, i, 5));
    const hair = S(hc);
    const hx = x + i;
    s.rect(hx + 1, y - 5, 4, 5, hair);
    s.hline(hx + 2, y - 6, 2, hair);
    s.vline(hx, y - 4, 4, hair);
    s.vline(hx + 5, y - 4, 4, S(shade(hc, -0.2)));
    s.px(hx + 2, y - 5, S(shade(hc, 0.3)));
    const skin = pick(SKIN, hash2(x, i, 6));
    s.px(hx - 1, y - 2, S(skin));
    s.px(hx + 6, y - 2, S(shade(skin, -0.2)));
  }
  s.rect(x, y, w, h, S(big ? P.slate : P.concreteDark));
  s.rect(x + 2, y + 2, w - 4, 4, S(big ? P.steel : P.skyLow));
  s.hline(x + 2, y + 2, w - 4, S(big ? P.steelHi : P.haze));
  s.px(x + 3, y + 3, S(P.white));
  s.hline(x, y, w, S(P.steelHi));
  s.vline(x, y, h, S(P.steel));
  s.vline(x + w - 1, y, h, S(P.night));
  for (let k = 12; k < w - 4; k += 12)
    s.vline(
      x + k,
      y + 7,
      h - 9,
      S(shade(big ? P.slate : P.concreteDark, -0.2)),
    );
  if (big) {
    s.hline(x + 1, y + h - 7, w - 2, S(P.home));
    s.hline(x + 1, y + h - 6, w - 2, S(P.homeDark));
  }
  s.hline(x, y + h - 2, w, S(P.night));
  s.hline(x, y + h - 1, w, S(P.night));
}

function nearClub(s: Surface, p: Paint, life: Life): void {
  const { g, S, tier } = p;
  const N = g.N;
  const H = g.h;
  grass(s, p, S, N + 1, N + 6, 0.2);
  const bh = tier === 2 ? 12 : 16;
  // RETRO (retro-club.ts): planks, cinders at both tiers, the trainer's bench, iron rails
  const retro = p.era === "retro";
  if (retro) paintPlankBacks(s, p, N + 1, bh);
  else boardBacks(s, p, N + 1, bh);
  // a track behind the boards: cinders at tier 2, a concrete apron at tier 3
  const ty = N + bh + 3;
  const tb = ty + 26;
  const track =
    tier === 2 || retro ? mix(P.wood, P.concrete, 0.55) : P.concrete;
  s.rect(0, ty, g.w, tb - ty, S(track));
  if (tier === 2 || retro) {
    for (let y = ty + 1; y < tb - 1; y += 2) {
      for (let x = (y * 5) % 7; x < g.w; x += 7) {
        const h = rnd(p, x, y, 64);
        if (h < 0.5) continue;
        s.px(x, y, S(shade(track, h < 0.8 ? -0.2 : 0.18)));
        if (h > 0.93) s.px(x + 1, y, S(shade(track, -0.2)));
      }
    }
  } else {
    for (let x = (g.cx % 64) - 64; x < g.w; x += 64)
      s.vline(x, ty, tb - ty, S(shade(track, -0.15)));
    for (let k = 0; k < g.w / 40; k++) {
      const x = Math.floor(rnd(p, k, 65, 66) * g.w);
      const y = ty + 3 + Math.floor(rnd(p, k, 67, 66) * (tb - ty - 6));
      s.hline(x, y, 3, S(shade(track, -0.12)));
      s.hline(x + 1, y + 1, 2, S(shade(track, -0.12)));
    }
  }
  s.hline(0, ty, g.w, S(shade(track, -0.25)));
  if (retro) {
    paintTrainersBench(s, p, sx(g, -60), ty + 7, tier === 2 ? 60 : 72);
  } else if (tier === 2) {
    dugout(s, p, sx(g, -54), ty + 6, 44, false);
    dugout(s, p, sx(g, -26), ty + 6, 44, false);
  } else {
    dugout(s, p, sx(g, -62), ty + 4, 60, true);
    dugout(s, p, sx(g, -24), ty + 4, 60, true);
  }
  life.dog = {
    roam: false,
    x0: sx(g, tier === 2 ? 14 : 24),
    x1: 0,
    y: tb - 1,
    colors: dogColors(S),
  };
  if (tier === 2) {
    // a grass bank with people standing on it, a low wall at the bottom
    grass(s, p, S, tb, H, 0.3);
    s.hline(0, tb, g.w, S(P.grassDeep));
    s.hline(0, tb + 1, g.w, S(mix(P.grassDeep, P.grassDark, 0.5)));
    crowdBacks(s, p, tb + 6, Math.min(H - 16, tb + 28), 0.55, 0.1);
    // the low wall at the bottom (RETRO: brick, a coping of stone)
    const wall = retro ? P.brick : P.concrete;
    const wallLo = retro ? P.brickDark : P.concreteDark;
    s.rect(0, H - 6, g.w, 6, S(wall));
    s.hline(0, H - 6, g.w, S(P.concreteLight));
    s.hline(0, H - 5, g.w, S(retro ? P.concrete : P.concreteLight));
    s.hline(0, H - 4, g.w, S(wallLo));
    for (let x = (g.cx % 24) - 24; x < g.w; x += 24)
      s.vline(x, H - 3, 3, S(wallLo));
    return;
  }
  // tier 3: a rail, then a packed terrace with crush barriers (RETRO: cinder steps edged
  // with timber, iron barriers painted dark)
  const rail = retro ? P.slate : P.steelHi;
  const railLo = retro ? P.night : P.steel;
  s.rect(
    0,
    tb,
    g.w,
    H - tb,
    S(retro ? mix(P.night, P.woodDark, 0.4) : P.concreteDark),
  );
  s.hline(0, tb, g.w, S(rail));
  s.hline(0, tb + 1, g.w, S(rail));
  s.hline(0, tb + 2, g.w, S(railLo));
  s.hline(0, tb + 3, g.w, S(retro ? P.ink : P.slate));
  crowdBacks(s, p, tb + 4, H, 0.85, 0.35);
  for (let y = tb + 34; y < H; y += 30) {
    for (let x = (g.cx % 80) - 80; x < g.w; x += 80) {
      s.hline(x + 8, y, 60, S(rail));
      s.hline(x + 8, y + 1, 60, S(railLo));
      for (const px of [x + 12, x + 62]) {
        s.vline(px, y + 2, 6, S(railLo));
        s.vline(px + 1, y + 2, 6, S(retro ? P.ink : P.slate));
      }
    }
  }
}

/** A sprite built on first use. */
function lazy(make: () => Sprite): () => Sprite {
  let made: Sprite | null = null;
  return () => (made ??= make());
}

// ---------------------------------------------------------------------------
// The near side of the stadium (tiers 4 to 7)
// ---------------------------------------------------------------------------

function nearStadium(s: Surface, p: Paint, life: Life): void {
  const { g, S, tier } = p;
  const N = g.N;
  const H = g.h;
  grass(s, p, S, N + 1, N + 4, 0.1);
  if (p.lamps) s.dither(0, N - 2, g.w, 4, P.nightGlow, 0.25);

  // the backs of the LED boards: a dark box on posts, braced
  const by = N + 4;
  const bh = 16;
  s.rect(0, by, g.w, bh, S(P.ink));
  s.hline(0, by, g.w, S(P.slate));
  s.hline(0, by + 1, g.w, S(P.night));
  for (let x = (g.cx % 48) - 48; x < g.w; x += 48) {
    s.vline(x, by + 2, bh - 2, S(P.night));
    s.vline(x + 1, by + 2, bh - 2, S(P.slate));
    s.line(x + 2, by + bh - 2, x + 10, by + 4, S(P.night));
    s.line(x + 3, by + bh - 2, x + 11, by + 4, S(P.night));
    // a cable running down to the ground
    s.vline(x + 20, by + 6, bh - 6, S(P.night));
  }
  s.rect(0, by + bh, g.w, 2, S(P.night));

  // the green apron behind the boards
  const ay = N + 22;
  const ab = ay + 26;
  s.rect(0, ay, g.w, ab - ay, S(P.grassDeep));
  s.hline(0, ay, g.w, S(P.grassDark));
  for (let x = 0; x < g.w; x += 3) {
    const r = hash2(x, ay, p.seed + 3);
    if (r < 0.3)
      s.px(x, ay + 2 + (Math.floor(r * 70) % (ab - ay - 3)), S(P.grassDark));
  }
  for (const off of [-62, -34]) modernDugout(s, p, sx(g, off), ay);
  // ball kids on stools, and the steward facing the crowd
  for (const off of [-72, 22]) {
    const kx = sx(g, off);
    s.rect(kx + 2, ay + 20, 8, 2, S(P.steel));
    s.vline(kx + 3, ay + 22, 3, S(P.slate));
    s.vline(kx + 8, ay + 22, 3, S(P.slate));
    const skin = S(off < 0 ? P.skinA : P.skinC);
    paintBack(s, kx, ay + 20, S(P.hairBrown), S(P.gold), false, skin);
  }
  const stx = sx(g, 46);
  // the steward, standing on the apron's last row like the dog, in a hi-vis jacket: a
  // fluorescent yellow-green that reads against the grass and the crowd
  drawSteward(
    s,
    stx,
    ab - 1,
    S(mix(P.gold, P.ledGreen, 0.3)),
    S(P.chalk),
    S(P.skinB),
    S(P.night),
    S(P.night),
  );
  life.dog = {
    roam: false,
    x0: stx + 14,
    x1: 0,
    y: ab - 1,
    colors: dogColors(S),
  };

  // a moat wall, then the near crowd
  s.hline(0, ab, g.w, S(P.steelHi));
  s.rect(0, ab + 1, g.w, 2, S(P.concreteLight));
  s.hline(0, ab + 3, g.w, S(P.concrete));
  s.rect(0, ab + 4, g.w, H - ab - 4, S(P.night));
  crowdBacks(s, p, ab + 4, H, 1, 0.25);
  // at tier 7 he has it in his hands
  if (tier === 6) paintTrophy(s, p);
}

/**
 * A modern dugout seen from behind: the subs' heads over the seat backs in the club's
 * colour, under a curved clear roof lit along its top edge.
 */
function modernDugout(s: Surface, p: Paint, x: number, ay: number): void {
  const { S } = p;
  const W = 52;
  // the shelter's back, the seats' backs, the subs' heads over them
  s.rect(x, ay + 8, W, 14, S(P.night));
  for (let i = 4; i < W - 6; i += 8) {
    const hc = pick(HAIR, hash2(x, i, 9));
    const hx = x + i;
    s.rect(hx + 1, ay + 2, 4, 6, S(hc));
    s.hline(hx + 2, ay + 1, 2, S(hc));
    s.vline(hx, ay + 3, 4, S(hc));
    s.vline(hx + 5, ay + 3, 4, S(shade(hc, -0.2)));
    s.px(hx + 2, ay + 2, S(shade(hc, 0.3)));
    s.px(hx - 1, ay + 5, S(P.skinA));
    s.px(hx + 6, ay + 5, S(P.skinAShade));
    // a tracksuit collar
    s.hline(hx, ay + 8, 6, S(P.home));
  }
  s.rect(x, ay + 9, W, 2, S(P.homeDark));
  for (let i = 3; i < W - 3; i += 8) s.hline(x + i, ay + 11, 6, S(P.home));
  // the shelter's back: panels with their seams, a kick plate along the bottom
  for (let i = 13; i < W - 4; i += 13) s.vline(x + i, ay + 13, 7, S(P.slate));
  s.hline(x + 1, ay + 19, W - 2, S(P.slate));
  s.hline(x, ay + 20, W, S(P.ink));
  s.hline(x, ay + 21, W, S(P.ink));
  // the clear roof: a shallow curve, lit along its top, its ends down to the ground
  for (let i = 0; i < W; i++) {
    const e = Math.min(i, W - 1 - i);
    const dy = e === 0 ? 3 : e === 1 ? 2 : e < 4 ? 1 : 0;
    s.px(x + i, ay + dy, S(P.skyLow));
    if (e >= 2) s.px(x + i, ay + dy + 1, S(P.mist));
  }
  s.vline(x, ay + 4, 18, S(P.skyLow));
  s.vline(x + W - 1, ay + 4, 18, S(P.mist));
}

/**
 * The trophy on its plinth by the touchline (tier 6): a generic gold cup, 18 x 24, on a
 * chalk plinth with a small plaque.
 *
 * G gold's light, g gold, d gold's dark, w a white glint.
 */
const CUP = lazy(() =>
  sprite(
    `
    ...dGGGGGGGGGGd...
    ...dgwGGGGGGggd...
    ..ddgwGGGGGgggdd..
    .dd.dgGGGGGggd.dd.
    .d..dgGGGGgggd..d.
    .d..dgGGGGgggd..d.
    .dd.dggGGggggd.dd.
    ..dddggGgggggddd..
    ....ddgggggggd....
    .....ddggggdd.....
    ......ddgggd......
    .......dGgd.......
    .......dGgd.......
    .......dGgd.......
    ......ddGggd......
    .....dgGGgggd.....
    ......ddggdd......
    .......dGgd.......
    .......dGgd.......
    ......dgGggd......
    ....dGGGGggggd....
    ...dgGGGGgggggd...
    ...dgggggggggdd...
    ...dddddddddddd...
    `,
    "Ggdw",
  ),
);

function paintTrophy(s: Surface, p: Paint): void {
  const { g, S } = p;
  const x = sx(g, 4);
  const top = g.N + 6;
  // the plinth: a chalk block lit on top, shaded on its right, on a steel base
  s.rect(x - 12, top, 26, 24, S(P.chalk));
  s.hline(x - 12, top, 26, S(P.white));
  s.hline(x - 12, top + 1, 26, S(P.white));
  s.vline(x + 12, top + 2, 22, S(P.mist));
  s.vline(x + 13, top + 2, 22, S(P.mist));
  s.vline(x - 12, top + 2, 22, S(P.white));
  s.rect(x - 14, top + 24, 30, 4, S(P.steel));
  s.hline(x - 14, top + 24, 30, S(P.steelHi));
  // a plaque on its face
  s.rect(x - 4, top + 9, 9, 5, S(P.goldDark));
  s.hline(x - 4, top + 9, 9, S(P.gold));
  s.hline(x - 2, top + 11, 5, S(P.goldLight));
  // the cup on it
  const sp = CUP();
  drawSprite(s, sp, 0, x - 8, top - sp.h, [
    S(P.goldLight),
    S(P.gold),
    S(P.goldDark),
    S(P.white),
  ]);
}
