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
import { hash2, mix, shade, type Color, type Surface } from "~/pixel";
import type { Life } from "./life";
import { paintBack } from "./people";
import {
  HAIR,
  crowdColors,
  crowdShirts,
  pick,
  rnd,
  sx,
  type Grade,
  type Paint,
} from "./paint";
import { tuft } from "./pitch";

export function paintNear(s: Surface, p: Paint, life: Life): void {
  if (p.tier <= 1) nearPark(s, p, life);
  else if (p.tier <= 3) nearClub(s, p, life);
  else nearStadium(s, p, life);
}

function grass(
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
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < g.w; x++) {
      const k = tuft(x, y, seed + 17, rough, true);
      s.px(x, y, k === 1 ? dark : k === 2 ? light : k === 3 ? patch : base);
    }
  }
}

function dogColors(G: Grade): Color[] {
  return [G(P.woodDark), G(P.wood), G(P.chalk), G(P.ink)];
}

// ---------------------------------------------------------------------------
// Tiers 0 and 1: the park
// ---------------------------------------------------------------------------

function nearPark(s: Surface, p: Paint, life: Life): void {
  const { g, E, tier } = p;
  const N = g.N;
  const H = g.h;
  grass(s, p, E, N + 1, H, 0.45);

  // the path, gravel between kerbs
  const py = Math.min(H - 22, N + (tier === 1 ? 26 : 18));
  s.rect(0, py, g.w, 7, E(P.concreteLight));
  s.hline(0, py, g.w, E(P.steelHi));
  s.hline(0, py + 6, g.w, E(P.concrete));
  for (let x = 1; x < g.w; x += 5)
    s.px(x + ((x >> 2) % 3), py + 2 + ((x >> 1) % 3), E(P.concrete));

  // a bench from behind, a bin beside it
  const bx = sx(g, -40);
  s.rect(bx, py - 6, 18, 2, E(P.wood));
  s.hline(bx, py - 6, 18, E(shade(P.wood, 0.25)));
  s.rect(bx, py - 3, 18, 1, E(P.woodDark));
  s.vline(bx + 1, py - 4, 6, E(P.night));
  s.vline(bx + 16, py - 4, 6, E(P.night));
  const bin = bx + 22;
  s.rect(bin, py - 4, 5, 6, E(P.grassDeep));
  s.hline(bin - 1, py - 5, 7, E(P.night));
  s.vline(bin, py - 4, 6, E(P.grassDark));

  // an old lamp post on the path
  const lx = sx(g, 50);
  s.vline(lx, py - 30, 34, E(P.night));
  s.hline(lx - 1, py + 3, 3, E(P.night));
  s.hline(lx - 2, py - 31, 5, E(P.night));
  if (p.lamps) {
    s.disc(lx, py - 28, 5, P.amberDim, 0.25);
    s.disc(lx, py - 28, 3, P.amber, 0.25);
    // its pool on the gravel
    s.pushClip(0, py, g.w, 7);
    s.ellipse(lx, py + 3, 18, 4, p.light.lit(P.concreteLight), true, 0.5);
    s.ellipse(lx, py + 3, 9, 3, p.light.lit(P.concreteLight), true);
    s.popClip();
    s.rect(lx - 1, py - 30, 3, 3, P.goldLight);
  } else {
    s.rect(lx - 1, py - 30, 3, 3, E(P.mist));
  }
  s.px(lx, py - 33, E(P.night));

  // a flower bed below the path, then shrubs along the bottom
  const fy = py + 9;
  if (fy + 6 < H - 8) {
    s.rect(0, fy, g.w, 5, E(P.woodDark));
    s.hline(0, fy, g.w, E(P.wood));
    const blooms: readonly Color[] = [P.home, P.gold, P.chalk, P.homeLight];
    for (let x = 1; x < g.w; x += 3) {
      const r = rnd(p, x, 60, 61);
      if (r < 0.25) continue;
      const c = E(blooms[Math.floor(r * 40) % blooms.length]);
      s.vline(x, fy - 1, 2, E(P.grassDark));
      s.px(x, fy - 2, c);
      if (r > 0.7) s.px(x + 1, fy - 2, c);
    }
  }
  const deep = E(P.grassDeep);
  const dark = E(P.grassDark);
  for (let c = -1; c * 7 < g.w + 7; c++) {
    const r = rnd(p, c, 70, 71);
    const top = H - 9 - Math.floor(r * 5);
    s.rect(c * 7 - 1, top + 2, 9, H - top, deep);
    s.hline(c * 7, top + 1, 7, dark);
    s.hline(c * 7 + 1, top, 5, dark);
    s.px(c * 7 + 2, top + 1, E(P.grass));
    s.px(c * 7 + 4, top + 3, dark);
  }

  if (tier === 0) {
    // two bikes dropped on the grass
    for (const [off, col] of [
      [-64, P.home],
      [-54, P.awayDark],
    ] as const) {
      const x = sx(g, off);
      const y = N + 9 + (off === -54 ? 2 : 0);
      s.circle(x, y, 2, E(P.night));
      s.circle(x + 7, y, 2, E(P.night));
      s.line(x, y, x + 3, y - 2, E(col));
      s.line(x + 3, y - 2, x + 7, y, E(col));
      s.hline(x + 2, y - 3, 3, E(col));
      s.px(x + 6, y - 3, E(P.night));
    }
    // a picnic: a checked blanket and two people sitting on it, backs to us
    const px0 = sx(g, 14);
    const pyb = N + 11;
    for (let i = 0; i < 20; i++) {
      for (let j = 0; j < 4; j++) {
        s.px(px0 + i, pyb + j, E(((i >> 1) + j) % 2 === 0 ? P.home : P.chalk));
      }
    }
    paintBack(s, px0 + 3, pyb + 1, E(P.hairBrown), E(P.awayDark), false);
    paintBack(s, px0 + 11, pyb + 1, E(P.hairBlond), E(P.gold), false);
    s.rect(px0 + 18, pyb, 3, 3, E(P.wood));
    life.dog = {
      roam: true,
      x0: sx(g, -30),
      x1: sx(g, 6),
      y: N + 15,
      colors: dogColors(E),
    };
    return;
  }

  // tier 1: the rope close to us, substitutes in big coats, kit bags, a flask
  const step = 16;
  for (let x = 0; x < g.w; x++) {
    const m = x % step;
    s.px(x, N + 5 + (m > 4 && m < 12 ? 1 : 0), E(P.chalk));
  }
  for (let x = 0; x < g.w; x += step) {
    s.rect(x, N + 4, 2, 8, E(P.wood));
    s.px(x, N + 4, E(shade(P.wood, 0.3)));
  }
  const subs: readonly [number, Color][] = [
    [-52, P.home],
    [-42, P.slate],
    [-32, P.homeDark],
  ];
  for (let i = 0; i < subs.length; i++) {
    const [off, coat] = subs[i];
    paintBack(
      s,
      sx(g, off),
      N + 20 - (i % 2),
      E(pick(HAIR, rnd(p, i, 72, 73))),
      E(coat),
      true,
    );
  }
  const bag = sx(g, -14);
  s.rect(bag, N + 15, 9, 4, E(P.home));
  s.hline(bag, N + 15, 9, E(P.homeLight));
  s.hline(bag + 2, N + 14, 5, E(P.night));
  s.rect(bag + 11, N + 16, 8, 3, E(P.night));
  s.hline(bag + 11, N + 16, 8, E(P.slate));
  s.rect(sx(g, -20), N + 14, 2, 5, E(P.steel));
  s.px(sx(g, -20), N + 14, E(P.steelHi));
  // a bag of balls
  s.rect(sx(g, 6), N + 13, 6, 6, E(P.night));
  s.px(sx(g, 7), N + 14, E(P.chalk));
  s.px(sx(g, 9), N + 16, E(P.chalk));
  s.px(sx(g, 10), N + 13, E(P.chalk));
  life.dog = {
    roam: false,
    x0: sx(g, -61),
    x1: 0,
    y: N + 20,
    colors: dogColors(E),
  };
}

// ---------------------------------------------------------------------------
// Tiers 2 and 3: a club's ground
// ---------------------------------------------------------------------------

/** The back of a row of boards on posts. */
function boardBacks(
  s: Surface,
  p: Paint,
  y: number,
  h: number,
  led: boolean,
): void {
  const { g, S } = p;
  s.rect(0, y, g.w, h, S(led ? P.ink : P.slate));
  s.hline(0, y, g.w, S(led ? P.slate : P.steel));
  for (let x = (g.cx % 24) - 24; x < g.w; x += 24) {
    s.vline(x, y + 1, h - 1, S(led ? P.night : P.concreteDark));
    s.line(x + 1, y + h - 1, x + 5, y + 2, S(led ? P.night : P.concreteDark));
  }
  s.hline(0, y + h, g.w, S(P.night));
}

function dugout(
  s: Surface,
  p: Paint,
  x: number,
  y: number,
  w: number,
  big: boolean,
): void {
  const { S } = p;
  const h = big ? 12 : 9;
  // the subs' heads over its back wall, then the shelter from behind
  for (let i = 3; i < w - 3; i += 5) {
    s.rect(x + i, y - 2, 3, 3, S(pick(HAIR, hash2(x, i, 5))));
  }
  s.rect(x, y, w, h, S(big ? P.slate : P.concreteDark));
  s.rect(x + 1, y + 1, w - 2, 2, S(big ? P.steel : P.skyLow));
  s.hline(x, y, w, S(P.steelHi));
  s.vline(x, y, h, S(P.steel));
  s.vline(x + w - 1, y, h, S(P.night));
  s.hline(x, y + h - 1, w, S(P.night));
}

/**
 * The near crowd from behind: rows of heads and shoulders packed into [y0, y1). Each row
 * is nearer than the one above it, so it is painted later. `share` of the places are
 * taken.
 */
function crowdBacks(
  s: Surface,
  p: Paint,
  y0: number,
  y1: number,
  share: number,
  dim: number,
): void {
  const { g, S } = p;
  const shirts = crowdShirts(p);
  const scarves = p.tier >= 5 ? 0.18 : p.tier >= 3 ? 0.06 : 0;
  for (let y = y0 + 2, r = 0; y < y1 + 3; y += 5, r++) {
    for (let x = (r & 1) * 3 - 3; x < g.w; x += 6) {
      if (rnd(p, x, y, 92) > share) continue;
      // in the shade of the near stand: calmer than the lit crowd across the pitch
      // (the travelling fans are across the pitch, in the far stand)
      const shirt = shade(pick(shirts, rnd(p, x, y, 90)), -dim);
      const hair = shade(pick(HAIR, rnd(p, x, y, 91)), -dim * 0.5);
      s.rect(x + 1, y, 3, 3, S(hair));
      s.px(x + 2, y, S(shade(hair, 0.3)));
      s.rect(x, y + 3, 5, 3, S(shirt));
      s.px(x, y + 3, S(shade(shirt, 0.2)));
      s.vline(x + 4, y + 3, 3, S(shade(shirt, -0.3)));
      if (rnd(p, x, y, 93) < scarves) {
        // a scarf held up over the head
        const [a, b] = crowdColors(p, false);
        for (let i = -1; i < 6; i++)
          s.px(x + i, y - 2, S((i & 1) === 0 ? a : b));
        s.px(x - 1, y - 1, S(P.skinA));
        s.px(x + 5, y - 1, S(P.skinA));
      }
    }
  }
}

function nearClub(s: Surface, p: Paint, life: Life): void {
  const { g, S, tier } = p;
  const N = g.N;
  const H = g.h;
  grass(s, p, S, N + 1, N + 3, 0.2);
  const bh = tier === 2 ? 6 : 8;
  boardBacks(s, p, N + 1, bh, false);
  // a track behind the boards: cinders at tier 2, a concrete apron at tier 3
  const ty = N + bh + 2;
  const tb = ty + 13;
  const track = tier === 2 ? mix(P.wood, P.concrete, 0.55) : P.concrete;
  s.rect(0, ty, g.w, tb - ty, S(track));
  for (let x = 2; x < g.w; x += 7)
    s.px(x + ((x >> 3) % 3), ty + 2 + ((x >> 2) % 7), S(shade(track, -0.2)));
  if (tier === 2) {
    dugout(s, p, sx(g, -54), ty + 3, 22, false);
    dugout(s, p, sx(g, -26), ty + 3, 22, false);
  } else {
    dugout(s, p, sx(g, -62), ty + 2, 30, true);
    dugout(s, p, sx(g, -24), ty + 2, 30, true);
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
    crowdBacks(s, p, tb + 3, Math.min(H - 8, tb + 14), 0.55, 0.1);
    s.rect(0, H - 3, g.w, 3, S(P.concrete));
    s.hline(0, H - 3, g.w, S(P.concreteLight));
    return;
  }
  // tier 3: a rail, then a packed terrace with crush barriers
  s.rect(0, tb, g.w, H - tb, S(P.concreteDark));
  s.hline(0, tb, g.w, S(P.steelHi));
  s.hline(0, tb + 1, g.w, S(P.steel));
  crowdBacks(s, p, tb + 2, H, 0.85, 0.35);
  for (let y = tb + 17; y < H; y += 15) {
    for (let x = (g.cx % 40) - 40; x < g.w; x += 40) {
      s.hline(x + 4, y, 30, S(P.steelHi));
      s.vline(x + 6, y + 1, 3, S(P.steel));
      s.vline(x + 31, y + 1, 3, S(P.steel));
    }
  }
}

// ---------------------------------------------------------------------------
// Tiers 4 to 7: the stadium
// ---------------------------------------------------------------------------

function nearStadium(s: Surface, p: Paint, life: Life): void {
  const { g, S, tier } = p;
  const N = g.N;
  const H = g.h;
  grass(s, p, S, N + 1, N + 2, 0.1);
  boardBacks(s, p, N + 2, 8, true);
  if (p.lamps) s.dither(0, N - 1, g.w, 2, P.nightGlow, 0.25);
  // the green apron behind the boards
  const ay = N + 11;
  const ab = ay + 13;
  s.rect(0, ay, g.w, ab - ay, S(P.grassDeep));
  s.hline(0, ay, g.w, S(P.grassDark));
  for (const off of [-62, -34]) {
    const x = sx(g, off);
    // modern dugouts: a row of heads under a curved clear roof
    for (let i = 2; i < 24; i += 4) {
      s.rect(x + i, ay + 1, 3, 3, S(pick(HAIR, hash2(x, i, 9))));
    }
    s.rect(x, ay + 4, 26, 7, S(P.night));
    s.hline(x + 1, ay, 24, S(P.skyLow));
    s.px(x, ay + 1, S(P.skyLow));
    s.px(x + 25, ay + 1, S(P.skyLow));
    s.hline(x, ay + 4, 26, S(P.homeDark));
  }
  // ball kids on stools, and a steward facing the crowd
  for (const off of [-72, 22])
    paintBack(s, sx(g, off), ay + 10, S(P.hairBrown), S(P.gold), false);
  const st = sx(g, 46);
  s.rect(st - 2, ab - 13, 5, 9, S(P.goldLight));
  s.hline(st - 2, ab - 10, 5, S(P.chalk));
  s.rect(st - 1, ab - 16, 3, 3, S(P.skinB));
  s.hline(st - 1, ab - 16, 3, S(P.night));
  s.vline(st - 1, ab - 4, 3, S(P.night));
  s.vline(st + 1, ab - 4, 3, S(P.night));
  life.dog = {
    roam: false,
    x0: st + 7,
    x1: 0,
    y: ab - 1,
    colors: dogColors(S),
  };

  // a moat wall, then the near crowd
  s.rect(0, ab, g.w, 2, S(P.concreteLight));
  s.rect(0, ab + 2, g.w, H - ab - 2, S(P.night));
  crowdBacks(s, p, ab + 2, H, 1, 0.25);
  // at tier 7 he has it in his hands
  if (tier === 6) paintTrophy(s, p);
}

/** The trophy on its plinth by the touchline (tier 6): a generic gold cup. */
function paintTrophy(s: Surface, p: Paint): void {
  const { g, S } = p;
  const x = sx(g, 4);
  const top = g.N + 3;
  s.rect(x - 6, top, 13, 12, S(P.chalk));
  s.hline(x - 6, top, 13, S(P.white));
  s.vline(x + 6, top + 1, 11, S(P.mist));
  s.rect(x - 7, top + 12, 15, 2, S(P.steel));
  // a base, a stem, a bowl, two handles
  const y = top - 12;
  s.rect(x - 3, y + 10, 7, 2, S(P.goldDark));
  s.rect(x - 1, y + 7, 3, 3, S(P.gold));
  s.rect(x - 3, y + 1, 7, 6, S(P.gold));
  s.rect(x - 2, y, 5, 1, S(P.goldLight));
  s.vline(x - 2, y + 2, 4, S(P.goldLight));
  s.vline(x + 3, y + 1, 6, S(P.goldDark));
  s.px(x - 4, y + 2, S(P.gold));
  s.px(x - 4, y + 3, S(P.goldDark));
  s.px(x + 4, y + 2, S(P.gold));
  s.px(x + 4, y + 3, S(P.goldDark));
  s.px(x - 1, y + 3, S(P.white));
}
