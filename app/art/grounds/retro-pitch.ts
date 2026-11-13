/**
 * RETRO's things on the pitch: the press photographers behind the goal line (a trilby or a
 * flat cap, a box camera with its bellows, a flash dish held up), and the podium at tier 7
 * (three timber boxes, the places painted on their faces, bunting along the top step), on
 * today's spots (`paintPhotographers`, `podiumFor` in pitch.ts).
 */

import { P } from "~/art/palette";
import {
  TRANSPARENT,
  drawSprite,
  mix,
  shade,
  sprite,
  type Color,
  type Sprite,
  type Surface,
} from "~/pixel";
import type { GroundPodium } from "./types";
import type { Paint } from "./paint";
import { RETRO, trimFor } from "./retro-high";

/** A sprite built on first use. */
function lazy(make: () => Sprite): () => Sprite {
  let made: Sprite | null = null;
  return () => (made ??= make());
}

/** Fill a colour array for a sprite's legend from a map of its characters. */
function colorsFor(sp: Sprite, by: Readonly<Record<string, Color>>): Color[] {
  return Array.from(sp.legend, (k) => by[k] ?? TRANSPARENT);
}

/**
 * A press photographer crouched behind the goal line, side on, his box camera pointing
 * left at the goal and the flash dish held up in his other hand. 18 x 16: the figure spans
 * `x - 10 .. x + 7` and stands on row `y + 1` (as today's photographer).
 *
 * f the flash dish, F its shine, h hat, H its band, s skin, z skin's shade, c coat,
 * C its lit side, t trousers, e shoes, k the camera, K its lit top, b the bellows, l lens.
 */
const PRESSMAN = lazy(() =>
  sprite(
    `
    .............FF...
    ............fFff..
    ........hhh.ff.f..
    .......hhhhh..c...
    ......HHHHHHH.c...
    ........zsss..c...
    ..KKKK..sss..cc...
    .kkkkbbbbzcccccc..
    .lkkkbbbbcccCcccc.
    ..kkkbbbbcccCcccc.
    ..k.k....ccCcccc..
    ........tttttcc...
    .......tttttttt...
    ......tt...tttt...
    ......tt...ttt....
    .....eee...tttttee
    `,
    "fFhHszcCtekKbl",
  ),
);

/** RETRO's photographers behind the goal line, on today's two spots (tier 3 up). */
export function paintRetroPhotographers(
  s: Surface,
  p: Paint,
  spots: readonly (readonly [number, number])[],
): void {
  const { S } = p;
  const sp = PRESSMAN();
  for (let i = 0; i < spots.length; i++) {
    const [x, y] = spots[i];
    const hat = i === 0 ? mix(P.slate, P.wood, 0.35) : P.woodDark;
    const coat = i === 0 ? P.woodDark : P.slate;
    const cols = colorsFor(sp, {
      f: S(P.steel),
      F: S(P.steelHi),
      h: S(hat),
      H: S(P.ink),
      s: S(P.skinA),
      z: S(P.skinAShade),
      c: S(coat),
      C: S(shade(coat, 0.2)),
      t: S(P.slate),
      e: S(P.ink),
      k: S(P.ink),
      K: S(P.slate),
      b: S(P.night),
      l: S(P.steel),
    });
    s.hline(x - 5, y + 1, 14, S(P.grassDeep));
    drawSprite(s, sp, 0, x - 10, y + 1 - sp.h, cols);
  }
}

/** Painted place numbers, 4 x 5 (as today's podium cuts them): 1, 2, 3. */
const PLACES: readonly string[] = [
  ".#..##...#...#..###.",
  "###....#.##.#...####",
  "###....#.##....####.",
];

/**
 * RETRO's podium (tier 7): three timber boxes of planks, the winner's standing 4 and 5 rows
 * above the others so his step reads as raised, each with a lit top plank; a white cloth
 * over the winner's box with a fringe in the trim's colour. The places are painted on the
 * faces: in brick on a cream ground on the winner's, in cream on the bare timber of the
 * others, clear of everything that hangs.
 */
export function paintRetroPodium(s: Surface, p: Paint, pd: GroundPodium): void {
  const { g, S } = p;
  const R = RETRO;
  const T = trimFor(p.tier);
  const x0 = pd.x - pd.w / 2;
  const base = g.gy + 4;
  const digit = (dx: number, dy: number, place: number, c: Color): void => {
    const rows = PLACES[place - 1];
    for (let r = 0; r < 5; r++)
      for (let k = 0; k < 4; k++)
        if (rows[r * 4 + k] === "#") s.px(dx + k, dy + r, c);
  };
  const box = (x: number, top: number): void => {
    const h = base - top;
    s.rect(x, top, 20, h, S(R.timber));
    // planks: a seam every 3 rows under the top one, lit on the left, in shade on the right
    for (let y = top + 4; y < base; y += 3) s.hline(x, y, 20, S(R.timberDark));
    s.vline(x, top, h, S(R.timberLit));
    s.vline(x + 18, top + 2, h - 2, S(R.timberDark));
    s.vline(x + 19, top + 2, h - 2, S(shade(P.woodDark, -0.25)));
    // the lit top plank, its edge
    s.hline(x, top, 20, S(mix(R.timberLit, P.retroLight, 0.4)));
    s.hline(x, top + 1, 20, S(R.timberLit));
    s.hline(x + 1, top + 2, 18, S(R.timberDark));
  };
  // second and third, then the winner's over them in the middle
  box(x0, base - 10);
  digit(x0 + 7, base - 7, 2, S(R.cream));
  box(x0 + 40, base - 9);
  digit(x0 + 47, base - 6, 3, S(R.cream));
  box(x0 + 20, pd.top);
  // the cloth over the winner's box, a fringe in the trim's colour
  s.rect(x0 + 19, pd.top, 22, 3, S(P.chalk));
  s.hline(x0 + 19, pd.top, 22, S(P.white));
  s.vline(x0 + 40, pd.top + 1, 2, S(P.mist));
  for (let i = 0; i < 22; i++)
    s.px(x0 + 19 + i, pd.top + 3, S((i & 1) === 0 ? T.club : T.clubDark));
  // his place on a cream ground under the cloth
  const dy = base - 7;
  s.rect(x0 + 25, dy - 1, 10, 7, S(R.cream));
  s.hline(x0 + 25, dy + 5, 10, S(R.creamShade));
  s.vline(x0 + 34, dy - 1, 6, S(R.creamShade));
  digit(x0 + 28, dy, 1, S(T.clubDark));
  s.hline(x0, base, pd.w, S(P.grassDeep));
  s.hline(x0 + 2, base + 1, pd.w - 2, S(P.grassDeep));
}
