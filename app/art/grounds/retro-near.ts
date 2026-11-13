/**
 * RETRO's near side at the big grounds (tiers 4 to 7), on today's rows (near.ts): from the
 * near touchline down, close to the camera and seen from behind.
 *
 *   - the backs of the painted hoardings: planks on posts, braced;
 *   - a cinder running track with the trainers' bench (men in flat caps and overcoats, a
 *     bucket and sponge), ball boys in caps on upturned crates, a policeman in his helmet
 *     facing the crowd, the dog;
 *   - a low brick wall with a white coping, then the near crowd (people.ts dresses it);
 *   - tier 6: the cup on a draped table by the touchline.
 */

import { drawTrophy } from "~/art/characters";
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
import type { Life } from "./life";
import { grass } from "./near";
import { HAIR, SKIN, pick, sx, type Grade, type Paint } from "./paint";
import { RETRO, trimFor } from "./retro-high";

/** A sprite built on first use. */
function lazy(make: () => Sprite): () => Sprite {
  let made: Sprite | null = null;
  return () => (made ??= make());
}

/** The dog's colours (people.ts `DOG_LEGEND`), as near.ts has them. */
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

export function nearRetroStadium(s: Surface, p: Paint, life: Life): void {
  const { g, S, tier } = p;
  const N = g.N;
  const H = g.h;
  const R = RETRO;
  grass(s, p, S, N + 1, N + 4, 0.1);
  if (p.lamps) s.dither(0, N - 2, g.w, 4, P.nightGlow, 0.2);

  // the backs of the hoardings: planks on posts, braced, a shadow under them
  const by = N + 4;
  const bh = 16;
  s.rect(0, by, g.w, bh, S(R.timberDark));
  for (let y = by + 1; y < by + bh; y += 4) {
    s.hline(0, y, g.w, S(R.timber));
  }
  for (let x = 0; x < g.w; x += 3) {
    if (hash2(x, by, p.seed + 31) < 0.25)
      s.px(x, by + 2 + 4 * Math.floor(hash2(x, by + 1, p.seed) * 3), S(P.ink));
  }
  s.hline(0, by, g.w, S(R.timberLit));
  for (let x = (g.cx % 48) - 48; x < g.w; x += 48) {
    s.rect(x, by, 3, bh, S(R.timberDark));
    s.vline(x, by, bh, S(R.timberLit));
    s.line(x + 3, by + bh - 2, x + 12, by + 3, S(P.ink));
    s.line(x + 4, by + bh - 2, x + 13, by + 3, S(R.timber));
  }
  s.rect(0, by + bh, g.w, 2, S(P.ink));

  // the cinder track
  const ay = N + 22;
  const ab = ay + 26;
  // the same cinders as the small grounds' track (tiers 2 and 3), a touch redder
  const track = mix(mix(P.wood, P.concrete, 0.55), P.brick, 0.15);
  const cinder = S(track);
  const cinderLo = S(shade(track, -0.2));
  const cinderHi = S(shade(track, 0.18));
  s.rect(0, ay, g.w, ab - ay, cinder);
  for (let y = ay; y < ab; y++) {
    for (let x = (y * 3) % 4; x < g.w; x += 4) {
      const r = hash2(x, y, p.seed + 41);
      if (r < 0.22) s.px(x, y, cinderLo);
      else if (r > 0.86) s.px(x, y, cinderHi);
    }
  }
  // its chalked edge by the boards
  s.hline(0, ay, g.w, S(mix(P.chalk, P.brick, 0.25)));

  for (const off of [-62, -34]) trainersBench(s, p, sx(g, off), ay);
  // ball boys on upturned crates
  for (const off of [-72, 22]) ballBoy(s, p, sx(g, off), ay + 20, off < 0);
  // the policeman facing the crowd
  const px = sx(g, 46);
  policeman(s, p, px, ab - 1);
  life.dog = {
    roam: false,
    x0: px + 14,
    x1: 0,
    y: ab - 1,
    colors: dogColors(S),
  };

  // a low brick wall with a white coping, then the near crowd
  s.hline(0, ab, g.w, S(P.chalk));
  s.hline(0, ab + 1, g.w, S(R.creamShade));
  s.rect(0, ab + 2, g.w, 2, S(P.brick));
  for (let x = (g.cx % 6) - 6; x < g.w; x += 6) s.px(x, ab + 2, S(P.brickDark));
  s.hline(0, ab + 3, g.w, S(P.brickDark));
  s.rect(0, ab + 4, g.w, H - ab - 4, S(P.night));
  crowdBacks(s, p, ab + 4, H, 1, 0.25);
  if (tier === 6) cupOnTable(s, p);
}

/**
 * The trainers' bench seen from behind: a long timber bench, four men in flat caps and
 * overcoats, a bucket with the sponge and a leather bag at its end.
 */
function trainersBench(s: Surface, p: Paint, x: number, ay: number): void {
  const { S } = p;
  const R = RETRO;
  const W = 52;
  // the bench: a back rail and its legs
  s.hline(x, ay + 16, W, S(R.timberLit));
  s.hline(x, ay + 17, W, S(R.timber));
  s.hline(x, ay + 18, W, S(R.timberDark));
  for (const lx of [x + 2, x + W - 4])
    s.rect(lx, ay + 19, 2, 4, S(R.timberDark));
  // the men: heads, flat caps, coats' shoulders over the rail
  for (let i = 0; i < 4; i++) {
    const hx = x + 4 + i * 12 + (i === 2 ? 1 : 0);
    const r = hash2(x, i, 9);
    const coat = S(
      r < 0.33 ? P.slate : r < 0.66 ? mix(P.woodDark, P.night, 0.3) : P.steel,
    );
    const capC = S(r < 0.5 ? mix(P.slate, P.wood, 0.35) : P.hairDark);
    const skin = S(pick(SKIN, hash2(x, i, 10)));
    const hair = S(pick(HAIR, hash2(x, i, 11)));
    // shoulders and back of the coat
    s.rect(hx - 2, ay + 9, 10, 7, coat);
    s.hline(hx - 1, ay + 8, 8, coat);
    s.vline(hx + 7, ay + 9, 7, S(shade(P.slate, -0.3)));
    s.hline(hx + 1, ay + 8, 4, S(R.creamShade));
    // head, ears, the cap with its peak hidden in front
    s.rect(hx, ay + 3, 6, 5, hair);
    s.px(hx - 1, ay + 5, skin);
    s.px(hx + 6, ay + 5, skin);
    s.hline(hx + 1, ay + 7, 4, skin);
    s.rect(hx - 1, ay + 1, 8, 3, capC);
    s.hline(hx, ay, 6, capC);
    s.hline(hx, ay + 1, 3, S(shade(P.mist, -0.1)));
    s.hline(hx - 1, ay + 3, 8, S(shade(P.night, 0)));
  }
  // the bucket and sponge, the bag
  const bx = x + W + 2;
  s.rect(bx, ay + 16, 6, 7, S(P.steel));
  s.vline(bx, ay + 16, 7, S(P.mist));
  s.hline(bx, ay + 15, 6, S(P.steelHi));
  s.rect(bx + 1, ay + 13, 4, 2, S(P.gold));
  s.rect(x - 9, ay + 17, 7, 5, S(P.woodDark));
  s.hline(x - 8, ay + 16, 5, S(P.wood));
  s.px(x - 6, ay + 15, S(P.woodDark));
}

/** A ball boy in a cap and jersey on an upturned crate, from behind. */
function ballBoy(
  s: Surface,
  p: Paint,
  x: number,
  y: number,
  left: boolean,
): void {
  const { S } = p;
  const R = RETRO;
  // the crate
  s.rect(x, y, 10, 5, S(R.timber));
  s.hline(x, y, 10, S(R.timberLit));
  s.hline(x, y + 2, 10, S(R.timberDark));
  s.vline(x + 9, y, 5, S(R.timberDark));
  // the boy: jersey, head, cap
  const club = trimFor(p.tier).club;
  const jersey = S(left ? club : P.night);
  s.rect(x + 2, y - 8, 7, 8, jersey);
  s.vline(x + 8, y - 8, 8, S(shade(left ? club : P.night, -0.3)));
  s.hline(x + 3, y - 9, 5, jersey);
  const skin = S(left ? P.skinA : P.skinC);
  s.rect(x + 3, y - 14, 5, 5, S(left ? P.hairBrown : P.hairDark));
  s.px(x + 2, y - 12, skin);
  s.px(x + 8, y - 12, skin);
  s.rect(x + 2, y - 16, 7, 3, S(P.slate));
  s.hline(x + 3, y - 17, 5, S(P.slate));
  s.hline(x + 3, y - 16, 2, S(P.steel));
}

/**
 * A policeman facing us: the tall custodian helmet with its badge, a dark tunic with silver
 * buttons and belt, his hands behind his back. 12 x 32, `x` his middle, feet on row `y`.
 *
 * h helmet, H its lit side, b badge, s skin, z skin's shade, m moustache, t tunic,
 * T its lit side, B buttons, l belt, p trousers, e boots.
 */
const BOBBY = lazy(() =>
  sprite(
    `
    .....hh.....
    ....Hhhh....
    ...Hhhhhh...
    ...Hhbhhh...
    ...Hhhhhh...
    ..hhhhhhhh..
    ...sssszz...
    ...sssssz...
    ...smmmmz...
    ....ssss....
    ...TttBtt...
    ..TTttttttt.
    .TTTtBtttttt
    .TTtttttttt.
    .TTttBtttttt
    .Tttttttttt.
    .Tttlllltttt
    .TttBtttttt.
    .Tttttttttt.
    ..TtBtttttt.
    ..Tttttttt..
    ..Tttttttt..
    ...ppp.ppp..
    ...ppp.ppp..
    ...ppp.ppp..
    ...ppp.ppp..
    ...ppp.ppp..
    ...ppp.ppp..
    ...ppp.ppp..
    ...ppp.ppp..
    ..eeee.eeee.
    ..eeee.eeee.
    `,
    "hHbszmtTBlpe",
  ),
);

function policeman(s: Surface, p: Paint, x: number, y: number): void {
  const { S } = p;
  const sp = BOBBY();
  const cols = [
    S(P.night),
    S(P.slate),
    S(P.steelHi),
    S(P.skinA),
    S(P.skinAShade),
    S(P.hairBrown),
    S(mix(P.night, P.slate, 0.4)),
    S(P.slate),
    S(P.steelHi),
    S(P.ink),
    S(P.night),
    S(P.ink),
  ];
  drawSprite(s, sp, 0, x - 6, y - sp.h, cols);
  s.hline(x - 5, y, 12, S(mix(P.brickDark, P.night, 0.4)));
}

/**
 * The cup on a table by the touchline (tier 6): a white cloth with the club's colour along
 * its hem over a timber table, RETRO's silver cup on its plinth on it (the one he lifts at
 * tier 7, `drawTrophy(..., "retro")`).
 */
function cupOnTable(s: Surface, p: Paint): void {
  const { g, S } = p;
  const R = RETRO;
  const x = sx(g, 4);
  const top = g.N + 12;
  // the table's legs, then the cloth over it, hanging to a fringe in the club's colour
  s.rect(x - 13, top + 4, 2, 18, S(R.timberDark));
  s.rect(x + 12, top + 4, 2, 18, S(R.timberDark));
  s.rect(x - 15, top, 30, 12, S(P.chalk));
  s.hline(x - 15, top, 30, S(P.white));
  s.vline(x + 14, top + 1, 11, S(P.mist));
  for (let i = 0; i < 30; i += 3)
    s.vline(x - 14 + i, top + 3, 8, S(R.creamShade));
  const T = trimFor(p.tier);
  s.hline(x - 15, top + 12, 30, S(T.club));
  s.hline(x - 15, top + 13, 30, S(T.clubDark));
  for (let i = 0; i < 30; i += 2) s.px(x - 15 + i, top + 14, S(T.club));
  s.hline(x - 16, top + 22, 33, S(mix(P.brickDark, P.night, 0.4)));
  drawTrophy(s, x, top, p.light, false, "retro");
}
