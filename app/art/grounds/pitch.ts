/**
 * The pitch (far touchline to near touchline) and the near side (below the near
 * touchline to the bottom of the canvas).
 *
 * The pitch grows up with the tiers: scruffy park grass with a worn goalmouth and daisies
 * (0), wobbly painted lines and mud (1), proper lines (2), faint stripes (3), perfect
 * stripes (4 up). Lines that run across the pitch lean towards the camera's column like
 * the goal's posts (`across`).
 *
 */

import { P } from "~/art/palette";
import { bayer4, hash2, mix, shade, type Color, type Surface } from "~/pixel";
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

// ---------------------------------------------------------------------------
// The pitch
// ---------------------------------------------------------------------------

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
  const SW = Math.max(8, Math.round(12 * g.k));
  const reach = g.gy - g.vy;
  const mud = G(mix(P.wood, P.grassDark, 0.35));
  const mudDark = G(mix(P.woodDark, P.grassDeep, 0.3));
  const daisy = G(P.chalk);
  const patch = G(mix(P.grass, P.grassLight, 0.3));
  for (let y = F; y <= N; y++) {
    const scale = reach / (y - g.vy);
    for (let x = 0; x < g.w; x++) {
      let c = y < F + 3 ? far : base;
      if (tier >= 3) {
        const xf = g.vx + (x - g.vx) * scale;
        const i = Math.floor((xf - g.goalX) / SW);
        if ((i & 1) === 1) c = stripeB;
        else c = stripeA;
      } else {
        const rough = tier === 0 ? 0.5 : tier === 1 ? 0.38 : 0.22;
        const k = tuft(x, y, seed, rough, tier === 0);
        c =
          k === 1
            ? dark
            : k === 2
              ? light
              : k === 3
                ? patch
                : k === 4
                  ? daisy
                  : c;
      }
      s.px(x, y, c);
    }
  }
  if (tier <= 1) {
    // a worn goalmouth and a worn patch where he always stands
    wear(s, g.goalX - 9, g.gy, 8, 3, mud, mudDark);
    wear(s, g.heroX, g.gy + 1, 6, 2, mud, mudDark);
    if (tier === 1) wear(s, sx(g, -110), (F + N) >> 1, 8, 3, mud, mudDark);
  }
  if (tier >= 1) paintLines(s, p, G);
}

/**
 * Grass texture, as clusters rather than noise: 0 plain, 1 a dark tuft (a two-pixel dash
 * with a blade over its left end), 2 a light blade pair, 3 a lighter patch, 4 a daisy.
 */
export function tuft(
  x: number,
  y: number,
  seed: number,
  rough: number,
  patches: boolean,
): number {
  const cx = x >> 2;
  const cy = Math.floor(y / 3);
  const h = hash2(cx, cy, seed + 3);
  const ox = (cx << 2) + Math.floor(hash2(cx, cy, seed + 4) * 3);
  const oy = cy * 3 + 1;
  if (h < rough) {
    if (
      (y === oy && (x === ox || x === ox + 1)) ||
      (y === oy - 1 && x === ox)
    ) {
      return 1;
    }
  } else if (h > 1 - rough * 0.35) {
    if (y === oy && (x === ox || x === ox + 2))
      return h > 0.985 && patches ? 4 : 2;
  }
  if (patches) {
    const px = Math.floor((x + (y & 1)) / 18);
    const py = Math.floor(y / 7);
    if (hash2(px, py, seed + 5) > 0.72 && (x + y) % 2 === 0) return 3;
  }
  return 0;
}

function wear(
  s: Surface,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  mud: Color,
  mudDark: Color,
): void {
  s.ellipse(cx, cy, rx, ry, mud, true, 0.5);
  s.ellipse(cx, cy, rx - 2, Math.max(1, ry - 1), mud, true);
  s.hline(cx - 2, cy, 3, mudDark);
}

function paintLines(s: Surface, p: Paint, G: Grade): void {
  const { g, tier, seed } = p;
  const { F, N, gy, k } = g;
  const c = tier === 1 ? G(mix(P.chalk, P.grass, 0.25)) : G(P.chalk);
  // the wobble of a line painted by a dad with a trolley
  const wob = (a: number, b: number): number =>
    tier === 1 && hash2(a >> 3, b, seed + 9) < 0.3 ? 1 : 0;
  for (let x = 0; x < g.w; x++) {
    s.px(x, F + wob(x, 1), c);
    s.px(x, N - wob(x, 2), c);
  }
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
  const sixTop = gy - 6;
  const sixBot = Math.min(N - 2, gy + 7);
  vertical(six, sixTop, sixBot);
  horizontal(six, g.goalX, sixTop);
  horizontal(six, g.goalX, sixBot);
  const box = g.goalX - Math.round(34 * k);
  const boxTop = F + 2;
  const boxBot = Math.min(N - 2, gy + 18);
  vertical(box, boxTop, boxBot);
  horizontal(box, g.goalX, boxTop);
  horizontal(box, g.goalX, boxBot);
  if (tier >= 2) {
    const spot = g.goalX - Math.round(23 * k);
    s.hline(across(g, spot, gy + 2), gy + 2, 2, c);
    // the D: the top of a flat ring outside the box
    const dy = gy + 2;
    const dx = across(g, box, dy);
    for (let a = -8; a <= 8; a++) {
      const yy = dy + a;
      if (yy <= F || yy >= N) continue;
      const bulge = Math.round(
        Math.sqrt(Math.max(0, 1 - (a / 9) ** 2)) * 5 * k,
      );
      s.px(dx - bulge, yy, c);
    }
  }
  // the halfway line and the centre circle (only a monitor has room for them)
  const half = sx(g, -112);
  if (across(g, half, N) > -30) {
    vertical(half, F, N);
    const my = (F + N) >> 1;
    s.ellipse(
      across(g, half, my),
      my,
      Math.round(22 * k),
      Math.round((N - F) * 0.32),
      c,
    );
    s.px(across(g, half, my), my, c);
  }
}

/**
 * At tiers 0 and 1 at night: the street lamp's warm pool over the stage. `warm` is the
 * same pitch painted in the pool's light; it is let through a dithered ellipse.
 */
export function poolOfLight(s: Surface, warm: Surface, p: Paint): void {
  const { g } = p;
  const cx = sx(g, 6);
  const cy = g.gy + 3;
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

// ---------------------------------------------------------------------------
// Things standing on the pitch
// ---------------------------------------------------------------------------

/** Photographers crouched behind the goal line, facing the goal (tier 3 up). */
export function paintPhotographers(s: Surface, p: Paint): void {
  const { g, S } = p;
  const spots: readonly [number, number][] = [
    [g.goalX + Math.round(17 * g.k), g.gy + 9],
    [g.goalX + Math.round(22 * g.k), g.N - 4],
  ];
  for (let i = 0; i < spots.length; i++) {
    const [x, y] = spots[i];
    const bib = S(i === 0 ? P.gold : P.homeLight);
    // crouched, side on, the lens pointing left at the goal
    s.rect(x - 1, y - 3, 4, 3, bib);
    s.rect(x - 1, y - 6, 3, 3, S(P.skinB));
    s.hline(x - 1, y - 6, 3, S(pick(HAIR, rnd(p, i, 3, 61))));
    s.rect(x - 4, y - 4, 3, 2, S(P.ink));
    s.px(x - 5, y - 4, S(P.steel));
    s.rect(x - 1, y, 5, 1, S(P.night));
    s.px(x + 3, y - 1, S(P.night));
  }
}

/** The podium near the centre at tier 7: the hero stands on its top step. */
export function podiumFor(g: Geo): GroundPodium {
  return { x: g.heroX, top: g.gy - 5, w: 30 };
}

export function paintPodium(s: Surface, p: Paint): void {
  const { g, S } = p;
  const pd = podiumFor(g);
  const x0 = pd.x - pd.w / 2;
  const base = g.gy + 2;
  // second and third either side, first in the middle
  s.rect(x0, base - 4, 10, 4, S(P.concreteLight));
  s.rect(x0 + 20, base - 3, 10, 3, S(P.concreteLight));
  s.rect(x0 + 10, pd.top, 10, base - pd.top, S(P.chalk));
  s.hline(x0 + 10, pd.top, 10, S(P.white));
  s.hline(x0, base - 4, 10, S(P.steelHi));
  s.hline(x0 + 20, base - 3, 10, S(P.steelHi));
  s.hline(x0 + 12, pd.top + 2, 6, S(P.gold));
  s.hline(x0, base, pd.w, S(P.grassDeep));
}
