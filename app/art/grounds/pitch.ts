/**
 * The pitch (far touchline to near touchline), and what stands on it.
 *
 * The pitch grows up with the tiers: scruffy park grass with a worn goalmouth and daisies
 * (0), wobbly painted lines and mud (1), proper lines (2), faint stripes (3), perfect
 * stripes (4 up). Lines that run across the pitch lean towards the camera's column like
 * the goal's posts (`across`).
 *
 * - The grass's clusters sit on 8 x 6 cells: a dark tuft is five blades fanning from a
 *   base, a light pair is two leaning blades, a daisy has four white petals round a gold
 *   eye. The light patches keep a per-pixel checker.
 * - The lines are 1 px (.snaps/detail2/DECISIONS.md 2: markings stay 1 px); a dad's wobbly
 *   line at tier 1 wanders up to 2 px in 1 px steps.
 */

import { P } from "~/art/palette";
import {
  TRANSPARENT,
  bayer4,
  drawSprite,
  hash2,
  mix,
  shade,
  sprite,
  type Color,
  type Sprite,
  type Surface,
} from "~/pixel";
import {
  HAIR,
  across,
  pick,
  rnd,
  sx,
  type Geo,
  type Grade,
  type Paint,
} from "./paint";
import type { GroundPodium } from "./types";
import { paintArenaPhotographers, paintArenaPodium } from "./nextgen-high";
import { smartTurf } from "./nextgen-low";
import { paintRetroPhotographers, paintRetroPodium } from "./retro-pitch";

// ---------------------------------------------------------------------------
// The pitch
// ---------------------------------------------------------------------------

/**
 * Grass texture, as clusters: 0 plain, 1 a dark tuft, 2 a light blade pair,
 * 3 a lighter patch, 4 a daisy's petals, 5 a daisy's eye.
 */
export function tuft(
  x: number,
  y: number,
  seed: number,
  rough: number,
  patches: boolean,
): number {
  const cx = x >> 3;
  const cy = Math.floor(y / 6);
  const h = hash2(cx, cy, seed + 3);
  if (h < rough || h > 1 - rough * 0.35) {
    const ox = (cx << 3) + Math.floor(hash2(cx, cy, seed + 4) * 4);
    const oy = cy * 6 + 4;
    const dx = x - ox;
    const dy = oy - y;
    if (h < rough) {
      // a tuft: blades fanning out of a base, a small one in a third of the cells
      if (hash2(cx, cy, seed + 6) < 0.34) {
        if (
          (dy === 0 && dx >= 0 && dx <= 2) ||
          (dy === 1 && (dx === 0 || dx === 2))
        )
          return 1;
      } else if (
        (dy === 0 && dx >= 1 && dx <= 3) ||
        (dy === 1 && (dx === 1 || dx === 3)) ||
        (dy === 2 && (dx === 0 || dx === 4))
      ) {
        return 1;
      }
    } else if (h > 0.985 && patches) {
      // a daisy: four petals round its eye
      if (dx === 1 && dy === 1) return 5;
      if (
        (dy === 1 && (dx === 0 || dx === 2)) ||
        (dx === 1 && (dy === 0 || dy === 2))
      ) {
        return 4;
      }
    } else if (
      (dy === 0 && (dx === 0 || dx === 3)) ||
      (dy === 1 && (dx === 1 || dx === 4))
    ) {
      // two light blades, leaning the same way
      return 2;
    }
  }
  if (patches) {
    const px = Math.floor((x + (y & 1)) / 36);
    const py = Math.floor(y / 14);
    if (hash2(px, py, seed + 5) > 0.72 && (x + y) % 2 === 0) return 3;
  }
  return 0;
}

/** Paint the grass and lines from the far touchline to the near touchline with `G`. */
export function paintPitch(s: Surface, p: Paint, G: Grade): void {
  const { g, tier, seed } = p;
  const { F, N } = g;
  const base = G(P.grass);
  const dark = G(P.grassDark);
  const light = G(P.grassLight);
  const far = G(shade(P.grass, 0.1));
  const stripeA = base;
  const stripeB = G(mix(P.grass, P.grassLight, tier >= 4 ? 0.5 : 0.28));
  const SW = Math.max(16, Math.round(12 * g.k));
  const reach = g.gy - g.vy;
  const mud = G(mix(P.wood, P.grassDark, 0.35));
  const mudDark = G(mix(P.woodDark, P.grassDeep, 0.3));
  const daisy = G(P.chalk);
  const eye = G(P.gold);
  const patch = G(mix(P.grass, P.grassLight, 0.3));
  const rough = tier === 0 ? 0.5 : tier === 1 ? 0.38 : 0.22;
  for (let y = F; y <= N; y++) {
    const scale = reach / (y - g.vy);
    for (let x = 0; x < g.w; x++) {
      let c = y < F + 6 ? far : base;
      if (tier >= 3) {
        const xf = g.vx + (x - g.vx) * scale;
        const i = Math.floor((xf - g.goalX) / SW);
        c = (i & 1) === 1 ? stripeB : stripeA;
      } else {
        const k = tuft(x, y, seed, rough, tier === 0);
        if (k === 1) c = dark;
        else if (k === 2) c = light;
        else if (k === 3) c = patch;
        else if (k === 4) c = daisy;
        else if (k === 5) c = eye;
      }
      s.px(x, y, c);
    }
  }
  // NEXT-GEN's smart turf never wears: a grid of sensor studs instead (nextgen-low.ts)
  if (p.era === "nextgen" && tier <= 3) smartTurf(s, p, G);
  else if (tier <= 1) {
    // a worn goalmouth and a worn patch where he always stands
    wear(s, g.goalX - 18, g.gy, 16, 6, mud, mudDark, seed);
    wear(s, g.heroX, g.gy + 2, 12, 4, mud, mudDark, seed + 1);
    if (tier === 1)
      wear(s, sx(g, -110), (F + N) >> 1, 16, 6, mud, mudDark, seed + 2);
  }
  if (tier >= 1) paintLines(s, p, G);
}

/** Worn grass: a dithered edge, bare mud, stud marks scuffed into it. */
function wear(
  s: Surface,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  mud: Color,
  mudDark: Color,
  seed: number,
): void {
  s.ellipse(cx, cy, rx, ry, mud, true, 0.5);
  s.ellipse(cx, cy, rx - 4, Math.max(1, ry - 2), mud, true);
  s.hline(cx - 4, cy, 5, mudDark);
  s.hline(cx - 2, cy + 1, 4, mudDark);
  for (let k = 0; k < 5; k++) {
    const mx = cx - rx + 6 + Math.floor(hash2(k, 1, seed + 11) * (2 * rx - 12));
    const my = cy - ry + 2 + Math.floor(hash2(k, 2, seed + 11) * (2 * ry - 3));
    s.hline(mx, my, 2, mudDark);
  }
}

function paintLines(s: Surface, p: Paint, G: Grade): void {
  const { g, tier, seed } = p;
  const { F, N, gy, k } = g;
  // (NEXT-GEN's tier 1 is marked out by a machine: crisp and straight)
  const dad = tier === 1 && p.era !== "nextgen";
  const c = dad ? G(mix(P.chalk, P.grass, 0.25)) : G(P.chalk);
  // the wobble of a line painted by a dad with a trolley: 0 to 2 px, in 1 px steps
  const wob = (a: number, b: number): number =>
    !dad
      ? 0
      : (hash2(a >> 4, b, seed + 9) < 0.3 ? 1 : 0) +
        (hash2((a + 8) >> 4, b, seed + 9) < 0.3 ? 1 : 0);
  // the touchlines end at the goal line: the corner, beyond it only the grass behind the goal
  const endF = Math.min(g.w - 1, across(g, g.goalX, F));
  const endN = Math.min(g.w - 1, across(g, g.goalX, N));
  for (let x = 0; x <= endF; x++) s.px(x, F + wob(x, 1), c);
  for (let x = 0; x <= endN; x++) s.px(x, N - wob(x, 2), c);
  const vertical = (xFeet: number, y0: number, y1: number): void => {
    for (let y = y0; y <= y1; y++)
      s.px(across(g, xFeet, y) + wob(y, xFeet), y, c);
  };
  const horizontal = (xa: number, xb: number, y: number): void => {
    const a = across(g, xa, y);
    const b = across(g, xb, y);
    s.hline(Math.min(a, b), y, Math.abs(b - a) + 1, c);
  };
  // the goal line, the six-yard box and the penalty box
  vertical(g.goalX, F, N);
  const six = g.goalX - Math.round(12 * k);
  const sixTop = gy - 12;
  const sixBot = Math.min(N - 4, gy + 14);
  vertical(six, sixTop, sixBot);
  horizontal(six, g.goalX, sixTop);
  horizontal(six, g.goalX, sixBot);
  const box = g.goalX - Math.round(34 * k);
  const boxTop = F + 4;
  const boxBot = Math.min(N - 4, gy + 36);
  vertical(box, boxTop, boxBot);
  horizontal(box, g.goalX, boxTop);
  horizontal(box, g.goalX, boxBot);
  if (tier >= 2) {
    // the spot: a flat dab of paint
    const spot = g.goalX - Math.round(23 * k);
    const sx0 = across(g, spot, gy + 4);
    s.hline(sx0, gy + 4, 4, c);
    s.hline(sx0 + 1, gy + 5, 2, c);
    // the D: the top of a flat ring outside the box, joined row to row
    const dy = gy + 4;
    const dx = across(g, box, dy);
    let last = Number.NaN;
    for (let a = -16; a <= 16; a++) {
      const yy = dy + a;
      const bulge = Math.round(
        Math.sqrt(Math.max(0, 1 - (a / 18) ** 2)) * 5 * k,
      );
      const x = dx - bulge;
      if (yy > F && yy < N) {
        if (Number.isNaN(last) || Math.abs(x - last) <= 1) s.px(x, yy, c);
        else
          s.hline(
            Math.min(x, last + Math.sign(x - last)),
            yy,
            Math.abs(x - last),
            c,
          );
      }
      last = x;
    }
  }
  // the halfway line and the centre circle (only a monitor has room for them)
  const half = sx(g, -112);
  if (across(g, half, N) > -60) {
    vertical(half, F, N);
    const my = (F + N) >> 1;
    const hx = across(g, half, my);
    s.ellipse(hx, my, Math.round(22 * k), Math.round((N - F) * 0.32), c);
    s.rect(hx, my, 2, 2, c);
  }
}

/**
 * At tiers 0 and 1 at night: the street lamp's warm pool over the stage. `warm` is the
 * same pitch painted in the pool's light; it is let through a dithered ellipse.
 */
export function poolOfLight(s: Surface, warm: Surface, p: Paint): void {
  const { g } = p;
  const cx = sx(g, 6);
  const cy = g.gy + 6;
  const rx = Math.round(66 * g.k);
  const ry = Math.round((g.N - g.F) * 0.8);
  const y0 = Math.max(g.F, cy - ry);
  const y1 = Math.min(s.h - 1, cy + ry);
  for (let y = y0; y <= y1; y++) {
    for (let x = Math.max(0, cx - rx); x <= Math.min(s.w - 1, cx + rx); x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      const d = dx * dx + dy * dy;
      const level = d < 0.35 ? 1 : d < 0.6 ? 0.5 : d < 1 ? 0.25 : 0;
      if (level > 0 && bayer4(x, y) < level) s.px(x, y, warm.get(x, y));
    }
  }
}

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
// On the pitch: photographers and the podium
// ---------------------------------------------------------------------------

/**
 * A photographer crouched behind the goal line, side on, the long lens pointing left at
 * the goal. 18 x 14: the figure spans `x - 10 .. x + 7` and stands on row `y + 1`.
 *
 * h hair, s skin, z skin's shade, B bib, b its shade, j dark top, t trousers, e shoes,
 * k camera, K its lit top, l lens, L the lens's glint.
 */
const SNAPPER = lazy(() =>
  sprite(
    `
    .........hhh......
    ........hhhhh.....
    ........zshhhh....
    ..LKKKKKsshhh.....
    .llllllkkzjBBB....
    .lllllkkkjBBBBB...
    ..LkkkkkssjBBBBb..
    ........jjBBBBBb..
    .........jBBBBbb..
    ........tttttjjb..
    .......tttttttt...
    ......tt...tttt...
    ......tt...ttt....
    .....eee...tttttee
    `,
    "hszBbjtekKlL",
  ),
);

/** Photographers crouched behind the goal line, facing the goal (tier 3 up). */
export function paintPhotographers(s: Surface, p: Paint): void {
  const { g, S } = p;
  const spots: readonly [number, number][] = [
    [g.goalX + Math.round(17 * g.k), g.gy + 18],
    [g.goalX + Math.round(22 * g.k), g.N - 8],
  ];
  // RETRO's press photographers (retro-pitch.ts)
  if (p.era === "retro") {
    paintRetroPhotographers(s, p, spots);
    return;
  }
  // NEXT-GEN's photographers and, from tier 4, a broadcast drone (nextgen-high.ts)
  if (p.era === "nextgen") {
    paintArenaPhotographers(s, p, spots);
    return;
  }
  const sp = SNAPPER();
  for (let i = 0; i < spots.length; i++) {
    const [x, y] = spots[i];
    const bibC = i === 0 ? P.gold : P.homeLight;
    const cols = colorsFor(sp, {
      h: S(pick(HAIR, rnd(p, i, 3, 61))),
      s: S(P.skinB),
      z: S(P.skinBShade),
      B: S(bibC),
      b: S(shade(bibC, -0.3)),
      j: S(P.night),
      t: S(P.slate),
      e: S(P.ink),
      k: S(P.ink),
      K: S(P.slate),
      l: S(P.steel),
      L: S(P.steelHi),
    });
    // a shadow on the grass, then the photographer
    s.hline(x - 5, y + 1, 14, S(P.grassDeep));
    drawSprite(s, sp, 0, x - 10, y + 1 - sp.h, cols);
  }
}

/** The podium near the centre at tier 7: the hero stands on its top step (`top`). */
export function podiumFor(g: Geo): GroundPodium {
  return { x: g.heroX, top: g.gy - 10, w: 60 };
}

/**
 * The podium's place numbers, 4 x 5, cut into the step's face (a shape of the podium, not
 * lettering): 1, 2, 3.
 */
const PLACES: readonly string[] = [
  // each 5 rows of 4: ".#.." "##.." ".#.." ".#.." "###."
  ".#..##...#...#..###.",
  "###....#.##.#...####",
  "###....#.##....####.",
];

export function paintPodium(s: Surface, p: Paint): void {
  // NEXT-GEN's podium of white glass and light (nextgen-high.ts)
  if (p.era === "nextgen") {
    paintArenaPodium(s, p);
    return;
  }
  // RETRO's podium of timber boxes (retro-pitch.ts)
  if (p.era === "retro") {
    paintRetroPodium(s, p, podiumFor(p.g));
    return;
  }
  const { g, S } = p;
  const pd = podiumFor(g);
  const x0 = pd.x - pd.w / 2;
  const base = g.gy + 4;
  const step = (
    x: number,
    top: number,
    place: number,
    face: Color,
    lit: Color,
  ): void => {
    const h = base - top;
    s.rect(x, top, 20, h, S(face));
    s.hline(x, top, 20, S(lit));
    s.hline(x, top + 1, 20, S(lit));
    s.vline(x + 18, top + 2, h - 2, S(P.mist));
    s.vline(x + 19, top + 2, h - 2, S(P.concrete));
    s.hline(x, top + 2, 18, S(P.gold));
    // its place cut in gold under the trim, middle of the face: every step has room
    const rows = PLACES[place - 1];
    const dx = x + 7;
    const dy = top + 4 + ((h - 10) >> 1);
    for (let r = 0; r < 5; r++)
      for (let c = 0; c < 4; c++)
        if (rows[r * 4 + c] === "#") s.px(dx + c, dy + r, S(P.goldDark));
  };
  // second and third a little lower than first, each tall enough for its number
  step(x0, base - 12, 2, P.concreteLight, P.steelHi);
  step(x0 + 40, base - 10, 3, P.concreteLight, P.steelHi);
  step(x0 + 20, pd.top, 1, P.chalk, P.white);
  s.hline(x0, base, pd.w, S(P.grassDeep));
  s.hline(x0 + 2, base + 1, pd.w - 2, S(P.grassDeep));
}
