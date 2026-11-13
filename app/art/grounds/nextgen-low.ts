/**
 * NEXT-GEN's small grounds (tiers 0 to 3): the same park, pitch and grounds as HOME's, in the
 * future. The composition is HOME's to the pixel (the stage, the goal, where every stand,
 * hut, board and lamp stands); only the look changes.
 *
 *   all     the city behind: a far skyline of glass towers (its own layer, drawn behind the
 *           ground's, so hover traffic and drones pass between it and the street), his street
 *           of smart townhouses with roof gardens and solar trees, his door in his colour, a
 *           needle tower where the church spire stands, a light pole for the street lamp
 *   tier 0  a clipped hedge behind a glass rail with a light strip along its top
 *   tier 1  + a pod for the changing hut, a line of light on slim posts for the rope
 *   tier 2  + holographic boards, light masts, a light-framed covered stand, a kiosk pod
 *   tier 3  + a light-framed main stand and terrace, a holographic scoreboard, light masts
 *
 * Light is cool and electric: lamps, light strips and lit glass are raw palette colour
 * (`skyLow` with a `white` core, `skyMid` halos, `nextgen` accents), glows are stepped
 * pixel halos (bands of dither), never gradients. Everything else is graded as HOME's is:
 * the street with `distant()`, the park with `p.E`, the ground's structures with `p.S`.
 */

import { paintedFont } from "~/art/lettering";
import { drawLedPanel } from "~/art/led";
import { P } from "~/art/palette";
import {
  FONT_3x5,
  Surface,
  TRANSPARENT,
  drawText,
  hash2,
  measureText,
  mix,
  shade,
  type Color,
  type TextOptions,
} from "~/pixel";
import { aisles, crowdBacks, fanBlock } from "./crowd";
import { endFor } from "./end";
import { CHURCH, STREET, isAlley } from "./far-tables";
import type { Life } from "./life";
import {
  HAIR,
  HOUSE_W,
  SKIN,
  WALL_H,
  across,
  pick,
  rnd,
  sx,
  type Paint,
} from "./paint";
import { paintBack, type Watcher } from "./people";

// ---------------------------------------------------------------------------
// Light: the cool, electric palette of the future
// ---------------------------------------------------------------------------

/** A light strip or lit glass: its core, its body, its halo. Raw colours (light sources). */
export const NG = {
  hot: P.white,
  lit: P.skyLow,
  halo: P.skyMid,
  glow: P.nightGlow,
  accent: P.nextgen,
  accentLit: P.nextgenLight,
  accentLow: P.nextgenDark,
} as const;

/**
 * A stepped halo round a light at night: two dithered bands of the night ramp, then the
 * light's own halo colour close in. Nothing by day (a lamp does not glow in sunshine).
 */
export function halo(
  s: Surface,
  p: Paint,
  x: number,
  y: number,
  r: number,
  near: Color = NG.halo,
): void {
  if (!p.lamps) return;
  s.disc(x, y, r, NG.glow, 0.25);
  s.disc(x, y, r * 0.66, NG.glow, 0.5);
  s.disc(x, y, r * 0.38, near, 0.25);
}

/** A horizontal light strip `len` long: a hot core with the body colour every fourth pixel. */
export function strip(
  s: Surface,
  x: number,
  y: number,
  len: number,
  body: Color = NG.lit,
  hot: Color = NG.hot,
): void {
  for (let i = 0; i < len; i++) s.px(x + i, y, (x + i) % 4 === 0 ? body : hot);
}

/** A strip's glow on the rows either side of it at night: a dithered band of its halo. */
export function stripGlow(
  s: Surface,
  p: Paint,
  x: number,
  y: number,
  len: number,
  c: Color = NG.halo,
): void {
  if (!p.lamps) return;
  s.dither(x, y - 1, len, 1, c, 0.5);
  s.dither(x, y + 1, len, 1, c, 0.5);
  s.dither(x, y - 2, len, 1, NG.glow, 0.25);
  s.dither(x, y + 2, len, 1, NG.glow, 0.25);
}

// ---------------------------------------------------------------------------
// The city: the far skyline (its own layer) and his street (the ground's layer)
// ---------------------------------------------------------------------------

/** The hover traffic's lanes, rows above the street's foot, and the drones' band. */
const LANES = [60, 74] as const;
const DRONE_TOP = 150;
const DRONE_LOW = 84;

/**
 * His street in the future, and the city behind it. Called instead of `paintStreet`: the
 * townhouses stand on HOME's modules (his at `g.houseX`), the needle tower where the
 * spire stands, the light pole where the lamp stands.
 */
export function paintCity(s: Surface, p: Paint, life: Life): void {
  const { g } = p;
  const far = new Surface(g.w, Math.max(1, g.B));
  const lamps: number[] = [];
  skyline(far, p, lamps);
  needle(s, p, lamps);
  const i0 = Math.floor(-g.houseX / HOUSE_W) - 1;
  const i1 = Math.ceil((g.w - g.houseX) / HOUSE_W) + 1;
  for (let i = i0; i <= i1; i++) {
    const x = g.houseX + i * HOUSE_W;
    if (isAlley(i) || i === -3) solarGap(s, p, x, i);
    else townhouse(s, p, x, i, lamps);
  }
  lightPole(s, p, sx(g, -6), g.B - 52, g.F);
  life.movers.push(cityMovers(p, far, lamps));
}

/**
 * The skyline's three depths, back to front: a far haze of slim towers in clusters, close
 * to the sky's colour, flat (a lit edge, no windows by day); a middle row of clusters with
 * bands of glazing and crowns; a few lower towers in front, darker, lit on their left.
 * Open sky between the clusters. `lo`/`hi` its heights, `w` its widths, `n` towers in a
 * cluster, `gap` the open sky after one, `glaze` the rows between its bands of glazing (0:
 * none by day).
 */
const BANDS = [
  {
    depth: 0.86,
    lo: 56,
    hi: 104,
    w: [8, 16],
    n: [3, 5],
    gap: [26, 64],
    glaze: 0,
    salt: 11,
  },
  {
    depth: 0.6,
    lo: 44,
    hi: 82,
    w: [12, 20],
    n: [2, 4],
    gap: [44, 96],
    glaze: 6,
    salt: 23,
  },
  {
    depth: 0.36,
    lo: 38,
    hi: 54,
    w: [14, 22],
    n: [1, 2],
    gap: [110, 190],
    glaze: 4,
    salt: 37,
  },
] as const;

/** The landmark: a tower with a ring round its crown, left of the middle (`sx`). */
const RING_AT = -14;
const RING_H = 84;

/** The skyline: three depths of towers in clusters, the ring tower, sky round the needle. */
function skyline(s: Surface, p: Paint, lamps: number[]): void {
  const { g } = p;
  const B = g.B;
  const ringX = sx(g, RING_AT);
  // keep the sky open round the needle (on the street's layer) and the ring tower
  const clear = (x: number, w: number, near: boolean): boolean =>
    x + w > g.spireX - (near ? 14 : 22) && x < g.spireX + (near ? 16 : 24);
  const clearRing = (x: number, w: number): boolean =>
    x + w > ringX - 22 && x < ringX + 24;
  for (let b = 0; b < BANDS.length; b++) {
    const band = BANDS[b];
    const near = b === 2;
    let x = -6 - Math.floor(rnd(p, band.salt, 0, 41) * (band.gap[1] >> 1));
    for (let c = 0; x < g.w + 8; c++) {
      const n =
        band.n[0] +
        Math.floor(rnd(p, c, band.salt, 43) * (band.n[1] - band.n[0] + 1));
      // a cluster: tallest in its middle, stepping down to its sides
      const peak = band.lo + rnd(p, c, band.salt + 1, 43) * (band.hi - band.lo);
      for (let i = 0; i < n; i++) {
        const salt = c * 7 + i;
        const w =
          band.w[0] +
          2 *
            Math.floor(
              rnd(p, salt, band.salt + 2, 42) *
                ((band.w[1] - band.w[0]) / 2 + 1),
            );
        const off = n > 1 ? Math.abs(i - (n - 1) / 2) / ((n - 1) / 2) : 0;
        const jit = rnd(p, salt, band.salt + 3, 42);
        const h = Math.round(
          Math.max(band.lo * 0.8, peak * (1 - 0.32 * off) - jit * 10),
        );
        if (!clear(x, w, near) && (b === 0 || !clearRing(x, w))) {
          const style = Math.floor(rnd(p, salt, band.salt + 4, 42) * 5);
          tower(
            s,
            p,
            x,
            B - h,
            w,
            h,
            band.depth,
            style,
            salt + band.salt * 31,
            band.glaze,
            b,
            lamps,
          );
        }
        x += w + (rnd(p, salt, band.salt + 5, 42) < 0.5 ? 0 : 2);
      }
      x +=
        band.gap[0] +
        Math.floor(rnd(p, c, band.salt + 6, 43) * (band.gap[1] - band.gap[0]));
    }
    if (b === 0) ringTower(s, p, ringX, lamps);
  }
}
/**
 * One glass tower `w` wide from row `top` down to the street's foot, in skyline band `band`
 * (0 far, 1 middle, 2 near): a lit left face, a shaded right one, bands of glazing every
 * `glaze` rows (the sky's glint running across them by day, scattered lit windows at night;
 * the far band only its lit windows, and few), and a crown by `style`: 0 a roof garden, 1
 * an antenna with a red lamp, 2 a slanted roof with a light along it, 3 a rounded crown
 * with a ring of light, 4 a setback with a garden on its ledge (the far band: no gardens).
 */
function tower(
  s: Surface,
  p: Paint,
  x: number,
  top: number,
  w: number,
  h: number,
  depth: number,
  style: number,
  salt: number,
  glaze: number,
  band: number,
  lamps: number[],
): void {
  const d = (c: Color): Color => p.D(c, depth);
  const near = band === 2;
  const far = band === 0;
  const body = d(near ? P.slate : P.steel);
  const lit = d(near ? P.steelHi : P.mist);
  const dark = d(near ? P.night : P.slate);
  const glazing = d(near ? P.night : mix(P.slate, P.steel, 0.35));
  const glint = d(P.skyLow);
  const B = p.g.B;
  const edge = far ? 1 : 2;
  // a setback: the upper third is narrower, the ledge planted
  const set = style === 4 ? Math.max(4, (w >> 2) & ~1) : 0;
  const ledge = top + Math.floor(h / 3);
  const shape = (y: number): [number, number] =>
    y < ledge && set > 0 ? [x + set, w - 2 * set] : [x, w];
  // the crown's run for a rounded top: rows 0..3 inset 3, 2, 1, 1
  const round = [3, 2, 1, 1];
  const step = glaze > 0 ? glaze : 6;
  for (let y = top; y < B; y++) {
    let [x0, ww] = shape(y);
    if (style === 3 && y - top < 4) {
      const k = round[y - top];
      x0 += k;
      ww -= 2 * k;
    }
    if (style === 2) {
      // slanted: the roof falls to the right, one row every two columns
      const cut = Math.floor((y - top) * 2);
      if (cut < ww) ww = Math.max(1, Math.min(ww, cut + 2));
    }
    s.hline(x0, y, ww, body);
    for (let k = 0; k < edge; k++) {
      s.px(x0 + k, y, lit);
      s.px(x0 + ww - 1 - k, y, dark);
    }
    const r = (y - top) % step;
    if (r === 2 && y > top + 3 && y < B - 2 && (glaze > 0 || p.lamps)) {
      for (let xx = x0 + 3; xx < x0 + ww - 3; xx++) {
        if ((xx - x0) % 4 === 2) continue;
        let c = glaze > 0 ? glazing : TRANSPARENT;
        if (p.lamps) {
          const hh = hash2(xx >> 1, y, salt);
          if (hh < (far ? 0.06 : 0.1)) c = NG.lit;
          else if (hh < (far ? 0.08 : 0.15)) c = P.goldLight;
          else if (!far && hh < 0.2) c = d(P.steel);
        } else if ((xx + y + salt) % 29 < 3) c = glint;
        if (c !== TRANSPARENT) s.px(xx, y, c);
      }
    }
  }
  const [cx0, cw] = shape(top);
  if ((style === 0 || style === 4) && !far) {
    // a roof garden: clumps of green on the roof (and the setback's ledge)
    garden(s, p, cx0, top, cw, depth, salt);
    if (style === 4) {
      garden(s, p, x, ledge, set, depth, salt + 1);
      garden(s, p, x + w - set, ledge, set, depth, salt + 2);
    }
  } else if (style === 1) {
    // an antenna on a plinth, a red lamp at its tip that blinks (cityMovers)
    const ax = cx0 + (cw >> 1);
    s.rect(ax - 2, top - 2, 4, 2, dark);
    const mh = 8 + (salt % 3) * 4;
    s.vline(ax, top - 2 - mh, mh, lit);
    if (!far) s.vline(ax + 1, top - 2 - mh + 3, mh - 3, dark);
    lamps.push(ax, top - 3 - mh, salt % 7);
  } else if (style === 2) {
    // a light along the slant's edge at night
    if (p.lamps) {
      for (let k = 0; k < cw; k += 1) {
        const y = top + Math.max(0, Math.floor((k - 2) / 2));
        if (k % 3 !== 2) s.px(cx0 + k, y, NG.lit);
      }
    } else if (!far) {
      for (let k = 0; k < cw; k += 2)
        s.px(cx0 + k, top + Math.max(0, (k - 2) >> 1), lit);
    }
  } else if (style === 3) {
    // a ring of light under the rounded crown
    const ry = top + 5;
    if (p.lamps) strip(s, cx0 + 1, ry, cw - 2, NG.halo, NG.lit);
    else if (!far) s.hline(cx0 + 1, ry, cw - 2, lit);
  }
}

/**
 * The skyline's landmark, left of the middle where the board leaves it in view: a slim
 * tower with a halo of a ring round its crown (white by day, lit in light and magenta at
 * night), the ring's far half behind the shaft, its near half in front; a spire and a red
 * lamp on top.
 */
function ringTower(s: Surface, p: Paint, x: number, lamps: number[]): void {
  const B = p.g.B;
  const d = (c: Color): Color => p.D(c, 0.6);
  const top = B - RING_H;
  const ry = top + Math.round(RING_H * 0.2);
  if (p.lamps) halo(s, p, x, ry, 14);
  // the shaft: 10 wide, flaring to 14 at its foot
  for (let y = top; y < B; y++) {
    const f = (y - top) / RING_H;
    const half = f < 0.7 ? 5 : f < 0.85 ? 6 : 7;
    s.hline(x - half, y, half * 2, d(P.steel));
    s.px(x - half, y, d(P.steelHi));
    s.px(x - half + 1, y, d(P.mist));
    s.px(x + half - 1, y, d(P.slate));
    if ((y - top) % 5 === 2 && y > top + 4) {
      for (let k = -half + 3; k < half - 2; k += 2)
        s.px(x + k, y, p.lamps && hash2(k, y, 9) < 0.3 ? NG.lit : d(P.slate));
    }
  }
  // the crown: a rounded cap and a spire with a red lamp
  s.hline(x - 4, top - 1, 8, d(P.mist));
  s.hline(x - 3, top - 2, 6, d(P.mist));
  s.vline(x - 1, top - 16, 14, d(P.steelHi));
  s.vline(x, top - 12, 10, d(P.slate));
  lamps.push(x - 1, top - 17, 5);
  // the ring: an ellipse 40 x 10 round the shaft a fifth of the way down
  const RX = 20;
  const RY = 5;
  const ring = p.lamps ? NG.lit : d(P.white);
  const ringLo = p.lamps ? NG.accent : d(P.mist);
  for (let k = -RX; k <= RX; k++) {
    const e = Math.round(RY * Math.sqrt(Math.max(0, 1 - (k * k) / (RX * RX))));
    const inShaft = Math.abs(k) < 6;
    // the far half (above) is hidden by the shaft
    if (!inShaft) {
      s.px(x + k, ry - e, ringLo);
    }
    s.px(x + k, ry + e, ring);
    s.px(x + k, ry + e + 1, ringLo);
  }
}

/** A strip of roof garden on a roof `w` wide at row `y`: clumps of leaves, lit on the left. */
function garden(
  s: Surface,
  p: Paint,
  x: number,
  y: number,
  w: number,
  depth: number,
  salt: number,
): void {
  const deep = p.D(P.grassDeep, depth);
  const leaf = p.D(P.grassDark, depth);
  const hi = p.D(P.grass, depth);
  for (let i = 1; i < w - 1; i += 3) {
    const r = hash2(i, salt, 77);
    const hgt = r < 0.35 ? 3 : r < 0.75 ? 2 : 1;
    s.rect(x + i, y - hgt, 3, hgt, leaf);
    s.px(x + i, y - hgt, hi);
    s.px(x + i + 2, y - 1, deep);
  }
}

/** A townhouse's wall colours: white composite panels, pale stone, a warm render. */
const WALLS_NG: readonly Color[] = [
  P.chalk,
  P.concreteLight,
  P.steelHi,
  P.chalk,
  P.mist,
];

/**
 * A smart townhouse on HOME's module `i` (his at 0): two storeys of panels and glass, a
 * glass door in a lit frame (his in his colour), a ribbon window upstairs with a balcony
 * rail, a flat roof with a light strip on its parapet, and on the roof a garden, solar
 * panels or a small wind turbine.
 */
function townhouse(
  s: Surface,
  p: Paint,
  x: number,
  i: number,
  lamps: number[],
): void {
  const { g, D } = p;
  const B = g.B;
  const d = (c: Color): Color => D(c, STREET);
  const his = i === 0;
  const wallC = his
    ? P.chalk
    : WALLS_NG[Math.floor(rnd(p, i, 1, 3) * WALLS_NG.length)];
  const wall = d(wallC);
  const wallLo = d(shade(wallC, -0.16));
  const wallDk = d(shade(wallC, -0.32));
  const glass = d(P.slate);
  const glassHi = d(P.skyLow);
  const frame = d(P.night);
  const night = p.lamps;
  s.rect(x, B - WALL_H, HOUSE_W, WALL_H, wall);
  // panel seams: a joint every 8 rows and two upright seams
  for (let y = B - WALL_H + 7; y < B - 2; y += 9)
    s.hline(x + 2, y, HOUSE_W - 3, wallLo);
  s.vline(x + 15, B - WALL_H, WALL_H - 18, wallLo);
  // the party wall's shade on the left, the lit edge of the next
  s.vline(x, B - WALL_H, WALL_H, wallDk);
  s.vline(x + 1, B - WALL_H, WALL_H, wallLo);
  // the ground floor: a glass door in a lit frame and a wide window
  const hall = night && (his || rnd(p, i, 3, 3) < 0.45);
  const doorC = his ? P.nextgen : P.slate;
  s.rect(x + 4, B - 17, 10, 17, frame);
  s.rect(x + 5, B - 16, 8, 16, d(doorC));
  // the door's glass panel (lit from the hall at night) and its handle bar
  s.rect(x + 7, B - 14, 4, 10, hall ? (his ? P.nextgenLight : NG.lit) : glass);
  if (!hall) s.px(x + 7, B - 14, glassHi);
  s.vline(x + 12, B - 11, 4, d(P.steelHi));
  // a light strip over the door, his in his colour
  if (night) s.hline(x + 4, B - 18, 10, his ? P.nextgenLight : NG.lit);
  else s.hline(x + 4, B - 18, 10, d(his ? P.nextgen : P.steel));
  // the step
  s.hline(x + 3, B - 1, 12, d(P.concreteLight));
  // the wide window downstairs
  const downLit = night && (his || rnd(p, i, 4, 3) < 0.4);
  pane(s, p, x + 17, B - 15, 12, 10, downLit, rnd(p, i, 9, 3) < 0.5);
  s.hline(x + 16, B - 5, 14, wallDk);
  // upstairs: a ribbon window across the house, a glass balcony rail in front of it
  const upLit = night && (his || rnd(p, i, 5, 3) < 0.35);
  pane(s, p, x + 4, B - 30, HOUSE_W - 7, 7, upLit, his);
  s.hline(x + 3, B - 22, HOUSE_W - 5, wallDk);
  if (rnd(p, i, 6, 3) < 0.6 || his) {
    // the balcony: a slab and a glass rail with a lit top
    s.hline(x + 3, B - 21, HOUSE_W - 5, d(P.concreteLight));
    s.hline(x + 3, B - 20, HOUSE_W - 5, d(P.concrete));
    s.hline(x + 3, B - 25, HOUSE_W - 5, night ? NG.halo : d(P.steelHi));
    for (let k = 3; k < HOUSE_W - 3; k += 7)
      s.vline(x + k, B - 25, 4, d(P.steelHi));
    // a pot plant on it
    const px = x + 6 + Math.floor(rnd(p, i, 7, 3) * 18);
    s.rect(px, B - 24, 3, 3, d(P.grassDark));
    s.px(px + 1, B - 25, d(P.grass));
  }
  // the parapet, a light strip along it, then the roof
  const top = B - WALL_H;
  s.hline(x, top, HOUSE_W, d(P.concreteLight));
  s.hline(x, top + 1, HOUSE_W, wallDk);
  if (night)
    s.hline(x + 1, top + 1, HOUSE_W - 2, his ? P.nextgenLight : NG.lit);
  const kind = his ? 0 : Math.floor(rnd(p, i, 8, 3) * 3);
  if (kind === 0) {
    // a roof garden: a planter, shrubs, a small tree on every third
    s.rect(x + 1, top - 3, HOUSE_W - 2, 3, d(P.concrete));
    s.hline(x + 1, top - 3, HOUSE_W - 2, d(P.concreteLight));
    garden(s, p, x + 1, top - 3, HOUSE_W - 2, STREET, i * 13 + 5);
    if (((i % 3) + 3) % 3 === 0) {
      const tx = x + 20;
      s.vline(tx, top - 10, 7, d(P.woodDark));
      blob(s, tx, top - 13, 5, d(P.grassDeep), d(P.grassDark), d(P.grass));
    }
  } else if (kind === 1) {
    // solar panels on frames, tilted to the sky: dark glass, a grid of light lines
    for (const px of [x + 3, x + 17]) {
      for (let r = 0; r < 5; r++) {
        s.hline(px + r, top - 5 + r, 11, r === 0 ? d(P.steel) : d(P.night));
      }
      for (let r = 1; r < 5; r += 2) s.px(px + r + 4, top - 5 + r, d(P.skyMid));
      s.vline(px + 9, top - 1, 1, d(P.steel));
    }
  } else {
    // a glass dome over the stairwell (lit inside at night), a drone pad beside it with a
    // beacon on its mast
    const dx = x + 5;
    const rows = [6, 10, 12, 12, 12];
    const domeLit = night && rnd(p, i, 11, 3) < 0.5;
    for (let r = 0; r < rows.length; r++) {
      const ww = rows[r];
      const x0 = dx + ((12 - ww) >> 1);
      const y = top - rows.length + r;
      s.hline(x0, y, ww, domeLit ? NG.lit : d(P.steel));
      s.px(x0 + ww - 1, y, domeLit ? NG.halo : d(P.slate));
      if (!domeLit && r > 0) s.px(x0 + 1, y, d(P.skyLow));
    }
    if (!domeLit) s.hline(dx + 3, top - 5, 3, d(P.skyLow));
    s.hline(x + 20, top - 1, 9, d(P.concreteDark));
    s.hline(x + 21, top - 2, 7, d(P.concrete));
    s.px(x + 24, top - 2, night ? NG.lit : d(P.chalk));
    s.vline(x + 28, top - 8, 6, d(P.steel));
    if (rnd(p, i, 10, 3) < 0.6) lamps.push(x + 28, top - 9, i & 7);
  }
}

/**
 * A pane of glass: by day it shows the sky (a glint top left, a diagonal sheen), at night
 * dark or lit (a cool light, or a warm one at home: his house and `warm` ones).
 */
function pane(
  s: Surface,
  p: Paint,
  x: number,
  y: number,
  w: number,
  h: number,
  lit: boolean,
  warm: boolean,
): void {
  const d = (c: Color): Color => p.D(c, STREET);
  if (lit) {
    s.rect(x, y, w, h, warm ? P.goldLight : NG.lit);
    s.hline(x, y + h - 1, w, warm ? P.gold : NG.halo);
  } else if (p.lamps) {
    s.rect(x, y, w, h, d(P.night));
    s.px(x, y, d(P.slate));
  } else {
    s.rect(x, y, w, h, d(P.steel));
    for (let k = 0; k < h; k++) {
      const sx0 = x + 2 + k;
      if (sx0 < x + w - 1) s.px(sx0, y + h - 1 - k, d(P.skyLow));
    }
    s.px(x, y, d(P.skyLow));
    s.px(x + 1, y, d(P.skyLow));
    s.px(x, y + 1, d(P.skyLow));
  }
  s.frame(x - 1, y - 1, w + 2, h + 2, d(P.night));
}

/**
 * Glass over what is already painted in the rectangle: every colour there moved `amount`
 * of the way to the glass's `c` (one solid colour per colour behind, no alpha).
 */
export function tint(
  s: Surface,
  x: number,
  y: number,
  w: number,
  h: number,
  c: Color,
  amount: number,
): void {
  const seen = new Map<Color, Color>();
  for (let j = y; j < y + h; j++) {
    for (let i = x; i < x + w; i++) {
      const was = s.get(i, j);
      if (was === TRANSPARENT) continue;
      let v = seen.get(was);
      if (v === undefined) {
        v = mix(was, c, amount);
        seen.set(was, v);
      }
      s.px(i, j, v);
    }
  }
}

/** A round crown of leaves: deep, mid, a lit cap top left. */
function blob(
  s: Surface,
  cx: number,
  cy: number,
  r: number,
  deep: Color,
  mid: Color,
  lit: Color,
): void {
  s.disc(cx, cy, r, deep);
  s.disc(cx - 1, cy - 1, r - 1, mid);
  s.disc(cx - 2, cy - 2, Math.max(1, r - 3), lit);
}

/**
 * A gap in the street (HOME's alleys): a low glass wall and a solar tree, a trunk of steel
 * branching into a canopy of tilted panels, dark glass with a lit rim, lamps at night.
 */
function solarGap(s: Surface, p: Paint, x: number, i: number): void {
  const { g, D } = p;
  const B = g.B;
  const d = (c: Color): Color => D(c, STREET);
  // the glass wall with its lit coping
  s.rect(x, B - 6, HOUSE_W, 6, d(P.steel));
  s.hline(x, B - 7, HOUSE_W, d(P.steelHi));
  for (let k = 3; k < HOUSE_W; k += 8) s.vline(x + k, B - 6, 6, d(P.slate));
  if (p.lamps) s.hline(x, B - 7, HOUSE_W, NG.lit);
  solarTree(s, p, x + 16, B - 6, 26, (c) => d(c), i);
}

/**
 * A solar tree standing on `foot`, `h` tall: a steel trunk, two branches, three tilted
 * panels (dark glass, a grid, a lit top edge) and a lamp under the middle one at night.
 * `C` grades its colours (distant for the street, `p.E` in the park).
 */
export function solarTree(
  s: Surface,
  p: Paint,
  x: number,
  foot: number,
  h: number,
  C: (c: Color) => Color,
  salt: number,
): void {
  const trunk = C(P.steelHi);
  const trunkLo = C(P.steel);
  const top = foot - h;
  s.vline(x, top + 6, h - 6, trunk);
  s.vline(x + 1, top + 6, h - 6, trunkLo);
  s.hline(x - 1, foot - 1, 4, trunkLo);
  // branches up to the side panels
  const bl = top + Math.round(h * 0.42);
  for (let k = 0; k < 6; k++) {
    s.px(x - 1 - k, bl - (k >> 1), trunk);
    s.px(x + 2 + k, bl - (k >> 1), trunkLo);
  }
  const panelAt = (px: number, py: number, w: number, tilt: 1 | -1): void => {
    for (let r = 0; r < 4; r++) {
      const off = tilt === 1 ? r : 3 - r;
      s.hline(px + off, py + r, w, r === 0 ? C(P.mist) : C(P.night));
    }
    for (let k = 3; k < w; k += 4)
      s.px(px + k + (tilt === 1 ? 2 : 1), py + 2, C(P.skyMid));
    if (p.lamps) s.hline(px + (tilt === 1 ? 0 : 3), py, w, NG.lit);
  };
  panelAt(x - 13, bl - 7, 9, -1);
  panelAt(x + 5, bl - 7, 9, 1);
  panelAt(x - 5, top, 12, (salt & 1) === 0 ? 1 : -1);
  if (p.lamps) {
    halo(s, p, x + 1, top + 6, 8, NG.halo);
    s.hline(x - 1, top + 5, 4, NG.hot);
  }
}

/**
 * The needle tower where the church spire stands: a podium, a slim shaft lit on its left, a
 * saucer of an observation deck ringed with light, a mast with a red lamp at the top.
 * Its middle is between columns `x` and `x + 1` (the spire's).
 */
function needle(s: Surface, p: Paint, lamps: number[]): void {
  const { g, D } = p;
  const B = g.B;
  const x = g.spireX;
  const d = (c: Color): Color => D(c, CHURCH);
  const lit = d(P.steelHi);
  const mid = d(P.mist);
  const dark = d(P.steel);
  // the podium: a low glass hall on a plinth
  s.rect(x - 14, B - 16, 30, 16, mid);
  s.vline(x - 14, B - 16, 16, lit);
  s.vline(x + 15, B - 16, 16, dark);
  for (let k = x - 12; k < x + 14; k += 4) s.vline(k, B - 13, 10, d(P.slate));
  s.hline(x - 15, B - 17, 32, lit);
  // the shaft: 8 wide at the foot, 4 at the deck
  for (let y = B - 17; y > B - 92; y--) {
    const f = (B - 17 - y) / 75;
    const half = Math.round(4 - f * 2);
    s.hline(x - half + 1, y, half * 2, mid);
    s.px(x - half + 1, y, lit);
    s.px(x + half, y, dark);
    // a lift's track of light up its middle at night
    if (p.lamps && (y & 3) === 0) s.px(x, y, NG.lit);
  }
  // the deck: a saucer, its window band, a lit rim
  const dy = B - 98;
  s.rect(x - 9, dy - 2, 20, 2, lit);
  s.rect(x - 11, dy, 24, 4, mid);
  s.rect(x - 9, dy + 4, 20, 2, dark);
  s.hline(x - 6, dy + 6, 14, dark);
  for (let k = x - 10; k < x + 12; k++) {
    if ((k & 1) === 0) s.px(k, dy + 1, p.lamps ? NG.lit : d(P.slate));
  }
  s.hline(x - 11, dy + 3, 24, p.lamps ? NG.halo : lit);
  if (p.lamps) s.px(x - 11, dy + 1, P.goldLight);
  // the mast
  s.vline(x, dy - 22, 20, lit);
  s.vline(x + 1, dy - 18, 16, dark);
  s.rect(x - 1, dy - 8, 4, 2, mid);
  lamps.push(x, dy - 23, 3);
}

/**
 * A light pole (the street lamp's place and others): a slim pole lit on its left, a blade
 * reaching right with a light strip under it, a halo at night. The pole is `x`, `x + 1`.
 */
export function lightPole(
  s: Surface,
  p: Paint,
  x: number,
  head: number,
  foot: number,
  E: (c: Color) => Color = (c) => p.D(c, 0.15),
): void {
  s.vline(x, head + 2, foot - head - 2, E(P.steelHi));
  s.vline(x + 1, head + 2, foot - head - 2, E(P.steel));
  // the blade, tapering to its tip
  s.hline(x, head, 11, E(P.steelHi));
  s.hline(x, head + 1, 10, E(P.steel));
  s.px(x + 11, head, E(P.steel));
  halo(s, p, x + 6, head + 3, 12);
  if (p.lamps) {
    s.hline(x + 2, head + 2, 9, NG.hot);
    s.hline(x + 3, head + 3, 7, NG.lit);
  } else {
    s.hline(x + 2, head + 2, 9, E(P.skyLow));
  }
}

// ---------------------------------------------------------------------------
// The city's moving things: hover traffic, drones, blinking lamps
// ---------------------------------------------------------------------------

/** A hover car's colours: body, its shade. */
const CAR_COLORS: readonly Color[] = [
  P.chalk,
  P.steelHi,
  P.home,
  P.nextgen,
  P.gold,
  P.mist,
  P.away,
];

/**
 * Everything that moves over the city, made once per build: the far skyline is copied
 * first (behind the ground's layer, in the sky's turn), then cars glide along two lanes in
 * front of it, drones drift across the sky, and the antennas' lamps blink.
 */
function cityMovers(p: Paint, far: Surface, lampList: number[]) {
  const { g } = p;
  const B = g.B;
  const lamps = Int16Array.from(lampList);
  const D = (c: Color): Color => p.D(c, 0.4);
  // cars: x0, speed (signed), lane row, colour index
  const nCars = 2 + Math.round(g.w / 150);
  const cars = new Float32Array(nCars * 4);
  for (let i = 0; i < nCars; i++) {
    const lane = i & 1;
    const dir = lane === 0 ? 1 : -1;
    cars[i * 4] = rnd(p, i, 1, 91) * (g.w + 60);
    cars[i * 4 + 1] = dir * (22 + rnd(p, i, 2, 91) * 22);
    cars[i * 4 + 2] = B - LANES[lane] + (rnd(p, i, 3, 91) < 0.5 ? 0 : 2);
    cars[i * 4 + 3] = Math.floor(rnd(p, i, 4, 91) * CAR_COLORS.length);
  }
  const carBody = CAR_COLORS.map((c) => D(c));
  const carLow = CAR_COLORS.map((c) => D(shade(c, -0.3)));
  const glass = D(P.slate);
  const glassHi = D(P.skyLow);
  // drones: x0, speed, row, bob phase
  const nDrones = 2 + Math.round(g.w / 220);
  const drones = new Float32Array(nDrones * 4);
  for (let i = 0; i < nDrones; i++) {
    drones[i * 4] = rnd(p, i, 5, 92) * (g.w + 40);
    drones[i * 4 + 1] = (i & 1 ? -1 : 1) * (8 + rnd(p, i, 6, 92) * 10);
    const lo = Math.max(g.boardShrunkY + 8, B - DRONE_TOP);
    const span = Math.max(1, B - DRONE_LOW - lo);
    drones[i * 4 + 2] = lo + Math.floor(rnd(p, i, 7, 92) * span);
    drones[i * 4 + 3] = rnd(p, i, 8, 92) * 6;
  }
  const droneBody = p.D(P.night, 0.3);
  const droneArm = p.D(P.slate, 0.3);
  const rotor = p.D(P.mist, 0.3);
  const parcel = p.D(P.gold, 0.3);
  const parcelLo = p.D(P.goldDark, 0.3);
  const night = p.lamps;
  const W = g.w;

  const wrap = (x: number, span: number): number =>
    (((x % span) + span) % span) - 30;

  // the skyline's pixels the finished layer leaves in view, as runs (start, length) of
  // indexes shared by the skyline and the frame (both g.w wide, from row 0): behind a
  // stadium next to nothing is copied
  let runs: Int32Array | null = null;
  return {
    seen(layer: Surface): void {
      const fd = far.data;
      const ld = layer.data;
      const n = Math.min(fd.length, ld.length);
      const out: number[] = [];
      for (let i = 0; i < n; i++) {
        if (fd[i] === TRANSPARENT || ld[i] !== TRANSPARENT) continue;
        let j = i + 1;
        while (j < n && fd[j] !== TRANSPARENT && ld[j] === TRANSPARENT) j++;
        out.push(i, j - i);
        i = j;
      }
      runs = Int32Array.from(out);
    },
    sky(s: Surface, t: number): void {
      if (runs && s.w === W && s.h >= far.h) {
        const fd = far.data;
        const sd = s.data;
        for (let k = 0; k < runs.length; k += 2) {
          const end = runs[k] + runs[k + 1];
          for (let i = runs[k]; i < end; i++) sd[i] = fd[i];
        }
      } else s.blit(far, 0, 0);
      // the hover traffic
      for (let i = 0; i < nCars; i++) {
        const v = cars[i * 4 + 1];
        const x = Math.round(wrap(cars[i * 4] + v * t, W + 60));
        const y = cars[i * 4 + 2];
        const c = cars[i * 4 + 3];
        const right = v > 0;
        // canopy, body, its shade, the glow under it
        s.hline(x + 3, y, 4, glass);
        s.px(right ? x + 6 : x + 3, y, glassHi);
        s.hline(x + 1, y + 1, 8, carBody[c]);
        s.hline(x + 1, y + 2, 8, carLow[c]);
        s.px(right ? x + 9 : x, y + 1, NG.hot);
        s.px(right ? x : x + 9, y + 1, P.ledRed);
        for (let k = 2; k < 8; k += 2)
          s.px(x + k + (Math.floor(t * 8) & 1), y + 4, NG.halo);
        if (night) {
          s.px(right ? x + 10 : x - 1, y + 1, NG.lit);
          s.px(right ? x + 11 : x - 2, y + 1, NG.glow);
        }
      }
      // the drones, bobbing as they go
      const flick = Math.floor(t * 12) & 1;
      for (let i = 0; i < nDrones; i++) {
        const v = drones[i * 4 + 1];
        const x = Math.round(wrap(drones[i * 4] + v * t, W + 40));
        const ph = drones[i * 4 + 3];
        const y = drones[i * 4 + 2] + Math.round(Math.sin(t * 1.3 + ph) * 2);
        s.hline(x, y, 3 - flick, rotor);
        s.hline(x + 5 + flick, y, 3 - flick, rotor);
        s.px(x + 1, y + 1, droneArm);
        s.px(x + 6, y + 1, droneArm);
        s.hline(x + 2, y + 1, 4, droneBody);
        s.hline(x + 3, y + 2, 2, droneBody);
        const blink = Math.floor(t * 2 + ph) & 1;
        s.px(v > 0 ? x + 5 : x + 2, y + 1, blink ? P.ledGreen : P.ledRed);
        if (i === 0) {
          // the delivery drone with its parcel
          s.vline(x + 3, y + 3, 1, droneArm);
          s.rect(x + 2, y + 4, 4, 3, parcel);
          s.hline(x + 2, y + 6, 4, parcelLo);
        }
      }
      // the antennas' lamps
      for (let k = 0; k < lamps.length; k += 3) {
        const on = (Math.floor(t * 1.25 + lamps[k + 2] * 0.37) & 1) === 0;
        if (!on) continue;
        const lx = lamps[k];
        const ly = lamps[k + 1];
        s.px(lx, ly, P.ledRed);
        if (night) {
          s.px(lx - 1, ly, P.homeDark);
          s.px(lx + 1, ly, P.homeDark);
          s.px(lx, ly - 1, P.homeDark);
        }
      }
    },
  };
}

// ---------------------------------------------------------------------------
// The park's far edge (tiers 0 and 1; the hedge alone behind the grounds)
// ---------------------------------------------------------------------------

/**
 * A clipped hedge, square and level (a smart park's gardener is a machine), and at tiers 0
 * and 1 a glass rail in front of it on slim posts, a light strip along its top: called
 * instead of `paintHedge`, on the same rows.
 */
export function paintParkEdge(
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
  const hi = E(P.grassLight);
  s.rect(0, F - 20, g.w, 20, deep);
  // the level top: a lit edge, a band of leaf
  s.hline(0, F - 21, g.w, dark);
  s.hline(0, F - 20, g.w, leaf);
  s.rect(0, F - 19, g.w, 2, dark);
  for (let x = 0; x < g.w; x += 4) {
    s.px(x + 1, F - 20, hi);
    s.px(x + 3, F - 18, leaf);
  }
  // its face: a regular pattern of leaf clumps, darker towards the foot
  for (let y = F - 15; y < F - 1; y += 3) {
    for (let x = ((y * 3) & 7) - 8; x < g.w; x += 8) {
      const c = y < F - 9 ? dark : E(shade(P.grassDeep, -0.2));
      s.hline(x, y, 2, c);
      s.px(x + 1, y - 1, c);
    }
  }
  if (!railings) return;
  // the glass rail: the hedge seen through tinted panes, slim posts, a lit top rail
  tint(s, 0, F - 15, g.w, 11, E(P.skyLow), 0.3);
  const POST = 24;
  for (let x = (g.cx % POST) - POST; x < g.w; x += POST) {
    // a glint across each pane
    for (let k = 0; k < 6; k++) s.px(x + 6 + k, F - 6 - k, E(P.haze));
    s.vline(x, F - 17, 15, E(P.steelHi));
    s.vline(x + 1, F - 17, 15, E(P.steel));
  }
  s.hline(0, F - 4, g.w, E(P.steel));
  s.hline(0, F - 3, g.w, E(P.slate));
  if (p.lamps) {
    stripGlow(s, p, 0, F - 17, g.w);
    strip(s, 0, F - 17, g.w);
  } else {
    s.hline(0, F - 17, g.w, E(P.steelHi));
    s.hline(0, F - 16, g.w, E(P.steel));
  }
  // two sparrows on the rail: the future still has birds
  life.perchColor = E(P.woodDark);
  life.perched.push({ x: sx(g, -36), y: F - 18 }, { x: sx(g, 30), y: F - 18 });
}

// ---------------------------------------------------------------------------
// Tier 1: the pod
// ---------------------------------------------------------------------------

/**
 * The changing pod (tier 1, where HOME's hut stands): a white capsule with round ends that
 * hovers a hand's breadth over a plinth on a cushion of light, a band of his colour round
 * it, a curved window (lit at night), a door outlined in light, a holographic fixture list
 * beside the door, a solar panel on its back.
 */
export function paintPod(s: Surface, p: Paint): void {
  const { g, E } = p;
  const F = g.F;
  const x = sx(g, -66);
  const w = 44;
  const top = F - 33;
  const foot = F - 6;
  const shell = E(P.chalk);
  const shellHi = E(P.white);
  const shellLo = E(P.mist);
  const shellDk = E(P.steel);
  // the plinth and the cushion of light between it and the pod
  s.rect(x + 6, F - 4, w - 12, 4, E(P.slate));
  s.hline(x + 6, F - 4, w - 12, E(P.steel));
  s.hline(x + 4, F - 1, w - 8, E(P.night));
  if (p.lamps) {
    s.dither(x + 4, foot, w - 8, 2, NG.halo, 0.5);
    strip(s, x + 8, foot + 1, w - 16);
  } else {
    s.dither(x + 8, foot, w - 16, 1, E(P.skyLow), 0.5);
    s.hline(x + 8, foot + 1, w - 16, E(P.skyLow));
  }
  // the capsule, row by row: round ends, a radius of about 9
  const ROUND = [13, 10, 8, 6, 5, 4, 3, 2, 2, 1, 1, 1];
  const h = foot - top;
  for (let r = 0; r < h; r++) {
    const b = h - 1 - r;
    const k = r < ROUND.length ? ROUND[r] : b < 5 ? ROUND[b + 7] : 0;
    const x0 = x + k;
    const ww = w - 2 * k;
    const y = top + r;
    const body = b < 4 ? shellLo : shell;
    s.hline(x0, y, ww, body);
    s.px(x0, y, r < 6 ? shellHi : shellLo);
    s.px(x0 + ww - 1, y, shellDk);
    if (ww > 4) s.px(x0 + ww - 2, y, shellLo);
    if (r === 1) s.hline(x0 + 3, y, ww - 8, shellHi);
    if (r === 2) s.hline(x0 + 2, y, 6, shellHi);
  }
  // the underside's shade
  s.hline(x + 4, foot - 1, w - 8, shellDk);
  // a ring of light round its waist in the era's magenta, a pip of his colour on it
  s.hline(x + 1, top + 16, w - 2, NG.accent);
  s.hline(x + 1, top + 17, w - 2, NG.accentLow);
  if (p.lamps) s.dither(x + 1, top + 18, w - 2, 1, NG.accent, 0.25);
  s.hline(x + 34, top + 16, 3, NG.accentLit);
  // the curved window: dark glass, its glint; lit at night
  const wx = x + 21;
  const wy = top + 5;
  const WIN = [16, 18, 18, 18, 16];
  for (let r = 0; r < WIN.length; r++) {
    const ww = WIN[r];
    const x0 = wx + ((18 - ww) >> 1);
    if (p.lamps) s.hline(x0, wy + r, ww, r === 4 ? NG.halo : NG.lit);
    else s.hline(x0, wy + r, ww, E(P.slate));
  }
  if (p.lamps) {
    s.hline(wx + 2, wy + 1, 14, NG.hot);
  } else {
    s.hline(wx + 2, wy, 4, E(P.skyLow));
    s.px(wx + 1, wy + 1, E(P.skyLow));
    for (let k = 0; k < 4; k++) s.px(wx + 9 + k, wy + 3 - k, E(P.steel));
  }
  // the door: a sliding panel outlined in light
  const dx = x + 7;
  const dTop = top + 7;
  s.rect(dx, dTop, 9, foot - 1 - dTop, E(P.steelHi));
  s.vline(dx + 8, dTop, foot - 1 - dTop, shellLo);
  const line = p.lamps ? NG.lit : E(P.skyMid);
  s.hline(dx, dTop - 1, 9, line);
  s.vline(dx - 1, dTop, foot - 1 - dTop, line);
  s.vline(dx + 9, dTop, foot - 1 - dTop, line);
  s.vline(dx + 6, dTop + 9, 4, E(P.slate));
  // the holographic fixture list: a frame of light, rows of light, a fleck of his colour
  const nx = x + 24;
  const ny = top + 19;
  const holo = p.lamps ? NG.lit : E(P.skyMid);
  s.frame(nx, ny, 11, 7, holo);
  for (let y = ny + 2; y < ny + 6; y += 2) s.hline(nx + 2, y, 7, holo);
  s.px(nx + 2, ny + 2, E(P.nextgen));
  // the solar panel on its back
  for (let r = 0; r < 3; r++)
    s.hline(x + 24 + r, top - 2 + r, 12, r === 0 ? E(P.mist) : E(P.night));
  s.px(x + 29, top, E(P.skyMid));
  s.px(x + 33, top, E(P.skyMid));
}

/** Tier 1's rope on stakes in front of the parents: a line of light on slim steel posts. */
export function addLightLine(p: Paint, life: Life): void {
  const { g, E } = p;
  life.rope = {
    y: g.F - 8,
    x0: 0,
    x1: g.w,
    step: Math.max(20, Math.round(12 * g.k)),
    rope: NG.lit,
    stake: E(P.steel),
  };
}

/**
 * The corner flags (tier 1 up): a slim light post with a pennant in the era's magenta at
 * each end of the goal line.
 */
export function addCornerLights(p: Paint, life: Life): void {
  const { g, S } = p;
  const ends = [
    [across(g, g.goalX, g.F) - 2, g.F, 0],
    [across(g, g.goalX, g.N) - 2, g.N, 1],
  ] as const;
  for (const [x, y, phase] of ends) {
    if (x >= g.w - 2) continue;
    life.flags.push({
      x,
      top: y - 18,
      poleH: 18,
      w: 6,
      h: 4,
      a: NG.accent,
      b: NG.accentLow,
      pole: S(P.steelHi),
      phase,
    });
  }
}

// ---------------------------------------------------------------------------
// The goal: slim posts, nets of light
// ---------------------------------------------------------------------------

/** The goal's colours in this era (`goalColors` fills its fields with these). */
export interface NgGoalColors {
  post: Color;
  postShade: Color;
  postDark: Color;
  net: Color;
  netFar: Color;
  netShade: Color;
  netFarShade: Color;
  ground: Color;
  /** Tier 0's pylons (GoalColors' jumper slots): the cone, lit, shaded; the base, its top. */
  jumperA: Color;
  jumperAHi: Color;
  jumperShade: Color;
  jumperB: Color;
  jumperBHi: Color;
}

/** NEXT-GEN's goal colours, graded with `G` (posts) and raw (the light). */
export function ngGoalColors(G: (c: Color) => Color): NgGoalColors {
  return {
    post: NG.lit,
    postShade: G(P.steelHi),
    postDark: G(P.slate),
    net: NG.lit,
    netFar: NG.halo,
    netShade: G(P.steel),
    netFarShade: G(P.slate),
    ground: G(P.grassDeep),
    jumperA: G(P.chalk),
    jumperAHi: G(P.white),
    jumperShade: G(P.mist),
    jumperB: G(P.night),
    jumperBHi: G(P.steel),
  };
}

const NG_SHAPES = {
  jumpers: { ph: 30, depth: 0 },
  small: { ph: 34, depth: 16 },
  full: { ph: 48, depth: 22 },
} as const;
const ROOF = 10;
const LEAN = 6;
const MESH = 8;

type GoalKind = keyof typeof NG_SHAPES;
interface Bulge {
  y: number;
  amount: number;
}

function push(y: number, bulge: Bulge | null | undefined): number {
  if (!bulge || !(bulge.amount > 0)) return 0;
  const a = Math.min(1, bulge.amount);
  const f = 1 - Math.abs(y - bulge.y) / 16;
  return f > 0 ? Math.round(a * 10 * f) : 0;
}

/**
 * A side of the net: strings of light on the diamond lattice from the post back to the
 * back edge, and the roof's edge from the bar down to the back (HOME's geometry, goal.ts).
 * Each string is lit on the nodes of the lattice (`hot`) and its body between (`c`).
 */
function ngPanel(
  s: Surface,
  px: number,
  foot: number,
  ph: number,
  depth: number,
  c: Color,
  hot: Color,
  edge: Color,
  bulge: Bulge | null | undefined,
  diag: 1 | -1,
): void {
  const top = foot - ph;
  const backTop = top + ROOF;
  for (let y = top; y < foot; y++) {
    const back =
      y < backTop
        ? px + Math.round(((y - top) * (depth - LEAN)) / ROOF)
        : px +
          depth -
          LEAN +
          Math.round(((y - backTop) * LEAN) / Math.max(1, foot - 1 - backTop));
    const right = back + push(y, bulge);
    for (let x = px + 1; x < right; x++) {
      if (((x + diag * y) & (MESH - 1)) !== 0) continue;
      const node = ((x - diag * y) & (MESH - 1)) === 0;
      s.px(x, y, node ? hot : c);
    }
    if (y >= backTop) s.px(right, y, edge);
  }
  const n = depth - LEAN;
  for (let i = 0; i <= n; i++) {
    const y = top + Math.round((i * ROOF) / Math.max(1, n));
    s.px(px + i, y, edge);
  }
}

/** A slim post `ph` tall standing on `foot`: a strip of light up its face, steel behind. */
function slimPost(
  s: Surface,
  x: number,
  foot: number,
  ph: number,
  c: NgGoalColors,
  lit: boolean,
): void {
  const top = foot - ph;
  s.vline(x, top, ph, lit ? c.post : c.postShade);
  s.vline(x + 1, top, ph, c.postDark);
  s.px(x, top, NG.hot);
  // a cap and a foot plate
  s.hline(x - 1, foot - 1, 4, c.postDark);
}

/** A marker pylon's rows from its tip down: each row's width (centred on the pylon). */
const PYLON = [2, 2, 4, 4, 4, 6, 6, 6, 8, 8, 10] as const;

/**
 * Tier 0: the smart park's pop-up goal, two marker pylons where HOME's jumper piles lie
 * (the same 16 px footprint, lower than the rail behind): a white cone with a band of the
 * era's magenta light and a lit tip, on a dark base with a strip of light round its foot
 * that grounds it on the turf (a stepped glow on the grass at night), its shadow to the
 * right. `x` is the left of its two middle columns, `foot` the shadow's row + 1.
 */
function goalPylon(s: Surface, x: number, foot: number, c: NgGoalColors): void {
  const night = isNight(c);
  const by = foot - 3;
  if (night) {
    // the glow on the grass round its foot: two dithered bands
    s.dither(x - 9, by - 1, 20, 4, NG.glow, 0.5);
    s.dither(x - 6, by, 14, 3, NG.halo, 0.25);
  }
  // the shadow, falling to the right
  s.hline(x - 4, foot - 1, 13, c.ground);
  // the base: a dark puck, its lit top, a strip of light round its foot
  s.hline(x - 5, by, 12, c.jumperBHi);
  s.px(x - 5, by, c.jumperAHi);
  s.hline(x - 5, by + 1, 12, NG.lit);
  s.px(x - 5, by + 1, c.jumperB);
  s.px(x + 6, by + 1, c.jumperB);
  if (night) s.hline(x - 3, by + 1, 8, NG.hot);
  // the cone: lit on its left, shaded on its right, a band of magenta light, a lit tip
  for (let r = 0; r < PYLON.length; r++) {
    const w = PYLON[r];
    const y = by - PYLON.length + r;
    const x0 = x + 1 - (w >> 1);
    const band = r === 4 || r === 5;
    s.hline(x0, y, w, band ? NG.accent : c.jumperA);
    s.px(x0, y, band ? NG.accentLit : c.jumperAHi);
    if (w > 2) s.px(x0 + w - 1, y, band ? NG.accentLow : c.jumperShade);
  }
  s.hline(x, by - PYLON.length, 2, NG.hot);
  s.px(x + 1, by - PYLON.length + 1, NG.lit);
}

/** Night, for the goal's colours: the white of its pylons graded dark (no glow by day). */
function isNight(c: NgGoalColors): boolean {
  const v = c.jumperA;
  return ((v & 0xff) + ((v >> 8) & 0xff) + ((v >> 16) & 0xff)) / 3 < 120;
}

/** The goal's back layer in this era (drawn before the cast): see `drawGoalBack`. */
export function ngGoalBack(
  s: Surface,
  goalX: number,
  gy: number,
  kind: GoalKind,
  c: NgGoalColors,
): void {
  const fx = goalX - 5;
  const ffoot = gy - 6;
  if (kind === "jumpers") {
    goalPylon(s, goalX - 7, ffoot, c);
    return;
  }
  const sh = NG_SHAPES[kind];
  // the net's foot: a line of light pegged to the turf
  s.hline(fx + 1, ffoot - 1, sh.depth, c.netFarShade);
  ngPanel(
    s,
    fx,
    ffoot,
    sh.ph,
    sh.depth,
    c.netShade,
    c.netFar,
    c.netFar,
    null,
    -1,
  );
  slimPost(s, fx - 2, ffoot, sh.ph, c, false);
}

/** The goal's front layer in this era (drawn after the ball): see `drawGoalFront`. */
export function ngGoalFront(
  s: Surface,
  goalX: number,
  gy: number,
  kind: GoalKind,
  c: NgGoalColors,
  bulge: Bulge | null | undefined,
): void {
  const nx = goalX + 2;
  const nfoot = gy + 4;
  const fx = goalX - 5;
  const ffoot = gy - 6;
  if (kind === "jumpers") {
    goalPylon(s, goalX + 1, nfoot, c);
    return;
  }
  const sh = NG_SHAPES[kind];
  const d = sh.depth;
  const ntop = nfoot - sh.ph;
  const ftop = ffoot - sh.ph;
  // the back of the net: a string of light down its back edge, the lattice across it
  for (let y = ftop + ROOF; y < nfoot; y++) {
    const pb = push(y, bulge);
    const t = (y - (ftop + ROOF)) / Math.max(1, nfoot - 1 - (ftop + ROOF));
    const x = Math.round(fx + d - LEAN + t * LEAN + (nx - fx) * t) + pb;
    if (
      ((x + y) & (MESH - 1)) === 0 ||
      ((x - y) & (MESH - 1)) === 0 ||
      y % 6 === 0
    )
      s.px(x, y, c.netFar);
  }
  // the roof of the net
  for (let y = ftop; y < ntop + ROOF; y++) {
    const a = Math.max(fx, fx + Math.round(((y - ftop) * (nx - fx)) / ROOF));
    const b = Math.min(nx + d - LEAN, a + d - LEAN + 1);
    for (let x = a + 1; x < b; x++) {
      if (((x - y) & (MESH - 1)) !== 0) continue;
      s.px(x, y, c.netFar);
    }
  }
  ngPanel(s, nx, nfoot, sh.ph, d, c.netShade, c.net, c.net, bulge, 1);
  s.hline(nx + 1, nfoot - 1, d, c.netFar);
  // the crossbar: a slim bar from the far post's top to the near's, its light on top
  const x0 = fx - 2;
  const steps = Math.max(Math.abs(nx - x0), Math.abs(ntop - ftop));
  for (let i = 0; i <= steps; i++) {
    const bx = Math.round(x0 + ((nx - x0) * i) / steps);
    const by = Math.round(ftop + ((ntop - ftop) * i) / steps);
    s.hline(bx, by, 2, c.post);
    s.hline(bx, by + 1, 2, c.postDark);
  }
  slimPost(s, nx, nfoot, sh.ph, c, true);
}

// ---------------------------------------------------------------------------
// Boards: holograms on dark glass
// ---------------------------------------------------------------------------

/** A holographic board's light (raw: it is a display) and its dimmed scanline. */
const HOLO_LOOKS: readonly (readonly [Color, Color])[] = [
  [P.skyLow, P.skyMid],
  [P.nextgenLight, P.nextgen],
  [P.goldLight, P.gold],
  [P.white, P.skyLow],
  [P.ledGreen, P.gradeTrivela],
];

/** How fast the holographic boards crawl, pixels a second (one pixel at a time). */
const HOLO_SPEED = 12;

/**
 * A row of holographic boards along the far touchline (tiers 2 and 3, the painted boards'
 * place): panes of dark glass on a slim rail, each with a lit top edge and its word in
 * light, scanlined (every third row of the light dimmed). Words from the labels; without
 * them a frame of light and a band. Called instead of `paintBoards`. With a `life` the
 * panes crawl along the rail (a mover), as HOME's LED boards do higher up: one lap of them
 * is painted once into a strip and copied, a pixel at a time, onto just the pixels of the
 * boards that the finished picture leaves in view (not the corner flag's pole in front).
 */
export function paintHoloBoards(
  s: Surface,
  p: Paint,
  y: number,
  h: number,
  life?: Life,
): void {
  const { g, S } = p;
  const list = p.labels.boards ?? [];
  const opts = holoWords();
  const glass = S(P.night);
  const glassHi = S(P.slate);
  const rows = h - 2;
  s.rect(0, y, g.w, h, S(P.slate));
  // one lap of boards: every word in every look once
  const n = list.length > 0 ? list.length : 3;
  let laps = HOLO_LOOKS.length;
  while (laps % n !== 0) laps += HOLO_LOOKS.length;
  const widths: number[] = [];
  let SW = 0;
  for (let i = 0; i < laps; i++) {
    const word = list.length > 0 ? list[i % list.length].toUpperCase() : "";
    const bw = word ? measureText(word, opts) + 16 : 44 + (i % 3) * 12;
    widths.push(bw);
    SW += bw + 2;
  }
  const strip = new Surface(SW, rows);
  let x = 0;
  for (let i = 0; i < laps; i++) {
    const [fg, dim] = HOLO_LOOKS[(i + p.seed) % HOLO_LOOKS.length];
    const word = list.length > 0 ? list[i % list.length].toUpperCase() : "";
    const bw = widths[i];
    strip.rect(x, 0, bw + 2, rows, S(P.slate));
    strip.rect(x, 0, bw, rows, glass);
    strip.hline(x, 0, bw, fg);
    strip.hline(x, 1, bw, glassHi);
    if (word) {
      drawText(strip, word, x + 8, Math.max(2, (rows - 10) >> 1) + 1, fg, opts);
    } else {
      strip.frame(x + 6, 4, bw - 12, Math.max(1, h - 9), fg);
      strip.rect(x + 10, 6, bw - 20, Math.max(1, h - 13), dim);
    }
    // the scanlines: every third row of the light dimmed
    for (let yy = 2; yy < rows; yy++) {
      if (yy % 3 !== 1) continue;
      for (let xx = x; xx < x + bw; xx++) {
        if (strip.get(xx, yy) === fg) strip.px(xx, yy, dim);
      }
    }
    // a sheen across the glass
    for (let k = 0; k < 4; k++) strip.px(x + bw - 8 + k, h - 4 - k, glassHi);
    strip.vline(x + bw, 0, rows, S(P.steelHi));
    strip.vline(x + bw + 1, 0, rows, S(P.steel));
    x += bw + 2;
  }
  const x0 = -((g.w * 7) % 46);
  for (let xx = x0; xx < g.w; xx += SW) s.blit(strip, xx, y);
  s.hline(0, y + h - 2, g.w, S(P.steel));
  s.hline(0, y + h - 1, g.w, S(P.slate));
  if (p.flood) s.dither(0, y + h, g.w, 1, NG.halo, 0.25);
  if (life) life.movers.push(holoCrawl(s, life, strip, x0, y));
}

/**
 * The holographic boards' crawl (see `paintHoloBoards`): `ref` is the rail as painted (the
 * strip from `x0` at row `y`); when the build is done, the pixels where the layer still
 * shows it, less any flag in front, are the ones that move.
 */
function holoCrawl(
  ref: Surface,
  life: Life,
  strip: Surface,
  x0: number,
  y: number,
) {
  const W = ref.w;
  const rows = strip.h;
  const SW = strip.w;
  const was = ref.data.slice(y * W, (y + rows) * W);
  let at: Int32Array | null = null;
  let col: Int32Array | null = null;
  return {
    seen(layer: Surface): void {
      if (layer.w !== W) return;
      const ats: number[] = [];
      const cols: number[] = [];
      for (let r = 0; r < rows; r++) {
        for (let x = 0; x < W; x++) {
          const i = (y + r) * W + x;
          if (layer.data[i] !== was[r * W + x]) continue;
          const flag = life.flags.some(
            (f) =>
              x >= f.x - 1 &&
              x <= f.x + f.w + 2 &&
              y + r >= f.top - 1 &&
              y + r < f.top + f.poleH,
          );
          if (flag) continue;
          ats.push(i);
          cols.push(r * SW + ((((x - x0) % SW) + SW) % SW));
        }
      }
      at = Int32Array.from(ats);
      col = Int32Array.from(cols);
    },
    far(s: Surface, t: number): void {
      if (!at || !col || s.w !== W) return;
      const off = Math.floor(Math.max(0, t) * HOLO_SPEED) % SW;
      const sd = s.data;
      const st = strip.data;
      for (let k = 0; k < at.length; k++) {
        const c = col[k];
        const x = c % SW;
        const r = c - x;
        const xx = x + off;
        sd[at[k]] = st[r + (xx >= SW ? xx - SW : xx)];
      }
    },
  };
}

let holoFont: TextOptions | null = null;
const holoWords = (): TextOptions =>
  (holoFont ??= { font: paintedFont(FONT_3x5) });

// ---------------------------------------------------------------------------
// Floodlights of the future: light masts
// ---------------------------------------------------------------------------

/** A floodlight's glow on the night sky: stepped bands of the night ramp round its head. */
function mastGlow(s: Surface, p: Paint, x: number, y: number, r: number): void {
  if (!p.flood) return;
  s.disc(x, y, r * 2, P.nightLow, 0.5);
  s.disc(x, y, r * 1.8, P.nightLow);
  s.disc(x, y, r * 1.4, P.nightGlow, 0.5);
  s.disc(x, y, r * 1.2, P.nightGlow);
  s.disc(x, y, r * 0.75, NG.halo, 0.25);
}

/**
 * A slim light mast (tier 2, the thin poles' place): a white pole, a tall narrow head of
 * lamps, a ring of light a third of the way up. The pole is `x`, `x + 1`.
 */
function lightMast(
  s: Surface,
  p: Paint,
  x: number,
  top: number,
  foot: number,
): void {
  const { S } = p;
  mastGlow(s, p, x + 1, top + 7, 12);
  s.vline(x, top + 14, foot - top - 14, S(P.steelHi));
  s.vline(x + 1, top + 14, foot - top - 14, S(P.steel));
  // the head: a narrow blade of lamps, 6 x 14
  s.rect(x - 2, top, 6, 14, S(P.slate));
  s.vline(x - 2, top, 14, S(P.steel));
  s.vline(x + 3, top, 14, S(P.night));
  s.hline(x - 2, top - 1, 6, S(P.steelHi));
  for (let y = top + 1; y < top + 13; y += 3) {
    if (p.flood) {
      s.hline(x - 1, y, 4, NG.hot);
      s.hline(x - 1, y + 1, 4, NG.lit);
    } else {
      s.hline(x - 1, y, 4, S(P.mist));
      s.px(x - 1, y, S(P.steelHi));
    }
  }
  // the ring of light a third of the way up
  const ry = foot - Math.round((foot - top) * 0.36);
  s.hline(x - 1, ry, 4, p.lamps ? NG.lit : S(P.skyLow));
  s.hline(x - 1, ry + 1, 4, S(P.steel));
}

/**
 * A tall light tower at a corner (tier 3, the pylons' place): a tapering white needle with
 * a light running up it, a wide head of lamps on a bracket, a lit rim. The middle is
 * between `x` and `x + 1`.
 */
function lightTower(
  s: Surface,
  p: Paint,
  x: number,
  top: number,
  foot: number,
): void {
  const { S } = p;
  const HW = 22;
  const HH = 13;
  mastGlow(s, p, x + 1, top + 7, 18);
  for (let y = top + HH; y < foot; y++) {
    const f = (y - top - HH) / Math.max(1, foot - top - HH);
    const half = f < 0.4 ? 1 : f < 0.8 ? 2 : 3;
    s.hline(x + 1 - half, y, half * 2, S(P.mist));
    s.px(x + 1 - half, y, S(P.white));
    s.px(x + half, y, S(P.steel));
    if (p.lamps && (y & 3) === 0) s.px(x + 1, y, NG.lit);
  }
  // the bracket and the head, tilted down to the pitch: a lit rim, rows of lamps
  s.hline(x - 6, top + HH, 14, S(P.steel));
  s.hline(x - 6, top + HH + 1, 14, S(P.slate));
  const hx = x - 10;
  for (let r = 0; r < HH; r++) {
    const off = r >> 2;
    s.hline(hx + off, top + r, HW, S(P.slate));
    s.px(hx + off, top + r, S(P.steelHi));
    s.px(hx + off + HW - 1, top + r, S(P.night));
  }
  s.hline(hx, top - 1, HW, p.lamps ? NG.lit : S(P.skyLow));
  for (let j = 0; j < 2; j++) {
    for (let i = 0; i < 4; i++) {
      const lx = hx + 2 + i * 5 + j;
      const ly = top + 2 + j * 5;
      if (p.flood) {
        s.rect(lx, ly, 4, 3, NG.hot);
        s.hline(lx, ly + 2, 4, NG.lit);
      } else {
        s.rect(lx, ly, 4, 3, S(P.mist));
        s.hline(lx, ly, 2, S(P.steelHi));
        s.hline(lx, ly + 2, 4, S(P.steel));
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Tier 2: the small ground
// ---------------------------------------------------------------------------

type WatcherFn = (
  p: Paint,
  x: number,
  y: number,
  kid: boolean,
  coat: Color,
  n: number,
) => Watcher;

/**
 * Tier 2 (called instead of `paintClubGround`, everything in its places): four light masts,
 * a kiosk pod for the tea hut, a small light-framed stand with a glass roof, people standing
 * behind the boards either side, holographic boards.
 */
export function paintClubGroundNG(
  s: Surface,
  p: Paint,
  life: Life,
  watcher: WatcherFn,
): void {
  const { g, S, E } = p;
  const F = g.F;
  for (const off of [-52, -4, 40, 88])
    lightMast(s, p, sx(g, off), F - 120, F - 14);

  const tx = sx(g, 30);
  kiosk(s, p, tx, F);

  // the small stand: glass back wall, three rows, slim white frame, a glass roof
  const x0 = sx(g, -46);
  const x1 = sx(g, 26);
  const w = x1 - x0;
  s.rect(x0, F - 48, w, 34, S(P.slate));
  for (let x = x0 + 3; x < x1; x += 6) {
    s.vline(x, F - 48, 8, S(P.steel));
    if (p.lamps) s.px(x + 3, F - 46, NG.lit);
    else s.px(x + 2, F - 47, S(P.skyLow));
  }
  fanBlock(s, p, life, {
    x0: x0 + 4,
    x1: x1 - 4,
    y: F - 40,
    rows: 3,
    seat: S(P.night),
    empty: 0.22,
    shadowRows: 1,
  });
  // the front: a lit lip
  s.hline(x0, F - 16, w, S(P.steelHi));
  s.hline(x0, F - 15, w, p.flood ? NG.lit : S(P.mist));
  // the frame: slim white columns at the ends and the middle, a light up each face
  const mid = (x0 + x1) >> 1;
  for (const x of [x0, mid - 1, x1 - 3]) {
    s.rect(x, F - 50, 3, 36, S(P.chalk));
    s.vline(x, F - 50, 36, S(P.white));
    s.vline(x + 2, F - 50, 36, S(P.mist));
    s.vline(x + 1, F - 46, 30, p.lamps ? NG.lit : S(P.steelHi));
  }
  // the roof: a thin white blade, the magenta ribbon on its edge, its glass under it
  s.rect(x0 - 6, F - 57, w + 12, 3, S(P.chalk));
  s.hline(x0 - 6, F - 57, w + 12, S(P.white));
  s.hline(x0 - 6, F - 54, w + 12, NG.accent);
  s.hline(x0 - 6, F - 53, w + 12, NG.accentLow);
  tint(s, x0 - 4, F - 52, w + 8, 3, S(P.skyLow), 0.35);
  if (p.flood) {
    for (let x = x0 + 4; x < x1 - 4; x += 12) s.hline(x, F - 52, 5, NG.hot);
  }
  // pigeons on the roof
  life.perched.push({ x: x0 + 18, y: F - 57 }, { x: x1 - 28, y: F - 57 });
  life.perchColor = E(P.steel);

  // people standing behind the boards either side
  const coats: readonly Color[] = [
    P.slate,
    P.night,
    P.home,
    P.steel,
    P.nextgenDark,
  ];
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
  paintHoloBoards(s, p, F - 14, 14, life);
}

/**
 * The kiosk pod at `x` (28 wide, standing on the boards' row; the tea hut's place): a white
 * shell with a round top, a hatch lit cool at night with the server behind it, a counter in
 * his colour lit under its lip, a holographic cup over it.
 */
function kiosk(s: Surface, p: Paint, x: number, F: number): void {
  const { S } = p;
  const shell = S(P.chalk);
  const ROUND = [6, 4, 2, 1, 1];
  const top = F - 30;
  for (let r = 0; r < 30; r++) {
    const k = r < ROUND.length ? ROUND[r] : 0;
    s.hline(x + k, top + r, 28 - 2 * k, shell);
    s.px(x + k, top + r, S(P.white));
    s.px(x + 27 - k, top + r, S(P.steel));
    s.px(x + 26 - k, top + r, S(P.mist));
  }
  s.hline(x + 6, top + 1, 14, S(P.white));
  const lit = p.lamps;
  s.rect(x + 5, F - 22, 18, 10, lit ? NG.lit : S(P.night));
  if (lit) s.hline(x + 5, F - 22, 18, NG.hot);
  s.rect(x + 12, F - 19, 4, 4, lit ? NG.halo : S(P.skinB));
  s.hline(x + 12, F - 20, 4, lit ? P.nextgenDark : S(P.hairDark));
  s.rect(x + 11, F - 15, 6, 3, lit ? P.nextgenDark : S(P.nextgen));
  s.rect(x + 3, F - 12, 22, 2, S(P.nextgen));
  s.hline(x + 3, F - 12, 22, S(P.nextgenLight));
  s.hline(x + 3, F - 10, 22, lit ? NG.lit : S(P.steel));
  // the holographic cup over it
  const hx = x + 9;
  const hy = top - 12;
  const c = lit ? NG.lit : S(P.skyMid);
  halo(s, p, hx + 5, hy + 4, 8);
  s.vline(x + 13, top - 2, 2, S(P.steel));
  s.frame(hx, hy, 10, 9, c);
  s.rect(hx + 3, hy + 4, 4, 3, c);
  s.px(hx + 7, hy + 5, c);
  s.px(hx + 4, hy + 2, c);
  s.px(hx + 5, hy + 3, c);
}

// ---------------------------------------------------------------------------
// Tier 3: a proper ground
// ---------------------------------------------------------------------------

/**
 * Tier 3 (called instead of `paintProperGround`, in its places): two light towers, the
 * scoreboard a pane of dark glass framed in light on slim legs, an open terrace with glass
 * barriers lit along their rails, the main stand with a glass bar at its back, a white roof
 * with the magenta ribbon and strip lights under it, holographic boards.
 */
export function paintProperGroundNG(s: Surface, p: Paint, life: Life): void {
  const { g, S, E } = p;
  const F = g.F;
  lightTower(s, p, sx(g, -62), F - 184, F - 60);
  lightTower(s, p, sx(g, 68), F - 184, F - 52);

  // the scoreboard's slim legs, down behind the terrace
  const bx = sx(g, 34);
  for (const lx of [bx + 12, bx + 46]) {
    s.vline(lx, F - 72, 58, S(P.steelHi));
    s.vline(lx + 1, F - 72, 58, S(P.steel));
  }

  // the open terrace, from the gap to the corner (the end, end.ts, wraps round from there)
  const tx0 = sx(g, 22);
  const tx1 = Math.max(tx0 + 8, Math.min(g.w, endFor(g).corner));
  const tw = tx1 - tx0;
  s.rect(tx0, F - 60, tw, 46, S(P.concreteLight));
  s.hline(tx0, F - 60, tw, S(P.white));
  s.hline(tx0, F - 59, tw, S(P.steelHi));
  fanBlock(s, p, life, {
    x0: tx0 + 4,
    x1: tx1 - 4,
    y: F - 54,
    rows: 5,
    seat: S(P.steel),
    empty: 0.08,
    shadowRows: 0,
  });
  // glass barriers across it: a lit rail, the crowd through the glass
  for (const y of [F - 40, F - 24]) {
    for (let x = tx0 + 8; x + 20 < tx1 - 4; x += 28) {
      tint(s, x, y + 1, 20, 4, S(P.skyLow), 0.3);
      if (p.flood) strip(s, x, y, 20);
      else s.hline(x, y, 20, S(P.steelHi));
    }
  }
  s.hline(tx0, F - 16, tw, S(P.white));
  s.rect(tx0, F - 60, 2, 46, S(P.white));
  s.rect(tx0 + 2, F - 60, 2, 46, S(P.mist));
  // its end at the corner: a glass fin with a light up its edge
  s.rect(tx1 - 4, F - 62, 4, 48, S(P.steelHi));
  s.vline(tx1 - 4, F - 62, 48, S(P.white));
  s.vline(tx1 - 1, F - 62, 48, S(P.steel));
  s.vline(tx1 - 2, F - 58, 40, p.lamps ? NG.lit : S(P.skyLow));

  // the scoreboard: a pane of dark glass on its legs, framed in light
  const field = drawLedPanel(s, bx, F - 94, 60, 22, { grade: S });
  s.frame(bx, F - 94, 60, 22, S(P.night));
  s.frame(bx + 1, F - 93, 58, 20, S(P.ink));
  s.hline(bx, F - 95, 60, p.lamps ? NG.lit : S(P.skyLow));
  s.hline(bx + 2, F - 72, 56, S(P.slate));
  life.scoreboard = {
    field,
    text: (p.labels.boards?.[0] ?? "").toUpperCase(),
    color: NG.lit,
  };

  // the main stand, from the left edge to the gap
  const x1 = sx(g, 4);
  s.rect(0, F - 80, x1, 66, S(P.slate));
  // the glass bar at its back: a band lit cool at night
  s.rect(0, F - 79, x1, 5, p.lamps ? NG.lit : S(P.steel));
  for (let x = 6; x < x1; x += 10) s.vline(x, F - 79, 5, S(P.night));
  if (!p.lamps) {
    for (let x = 2; x < x1; x += 30) s.hline(x, F - 79, 3, S(P.skyLow));
  }
  fanBlock(s, p, life, {
    x0: 0,
    x1: x1 - 4,
    y: F - 72,
    rows: 7,
    seat: S(P.night),
    empty: 0.04,
    shadowRows: 1,
  });
  aisles(s, p, 0, x1 - 4, F - 72, F - 16, 72);
  // the roof: a white blade, the magenta ribbon, its underside, strip lights under it
  s.rect(0, F - 93, x1 + 6, 5, S(P.chalk));
  s.hline(0, F - 93, x1 + 6, S(P.white));
  s.hline(0, F - 89, x1 + 6, S(P.mist));
  s.hline(0, F - 88, x1 + 6, NG.accent);
  s.hline(0, F - 87, x1 + 6, NG.accentLow);
  s.rect(0, F - 86, x1 + 4, 4, S(P.night));
  for (let x = 6; x < x1; x += 16) {
    s.hline(x, F - 84, 6, p.flood ? NG.hot : S(P.steel));
    if (p.flood) s.hline(x + 1, F - 83, 4, NG.lit);
  }
  // slim white columns to the front
  for (let x = x1 - 8; x > 0; x -= 80) {
    s.vline(x, F - 82, 66, S(P.white));
    s.vline(x + 1, F - 82, 66, S(P.mist));
  }
  // its end at the gap: a glass fin with a light up its edge
  s.rect(x1 - 4, F - 93, 4, 79, S(P.steelHi));
  s.vline(x1 - 4, F - 93, 79, S(P.white));
  s.vline(x1 - 1, F - 93, 79, S(P.steel));
  s.vline(x1 - 2, F - 86, 66, p.lamps ? NG.lit : S(P.skyLow));
  s.hline(0, F - 16, x1, S(P.white));
  s.hline(0, F - 15, x1, p.flood ? NG.lit : S(P.mist));
  life.perched.push({ x: sx(g, -30), y: F - 93 }, { x: sx(g, -12), y: F - 93 });
  life.perchColor = E(P.steel);

  paintHoloBoards(s, p, F - 14, 14, life);
}

// ---------------------------------------------------------------------------
// The pitch: smart turf
// ---------------------------------------------------------------------------

/**
 * Smart turf (tiers 1 to 3): a row of sensor lights 2 x 1 just inside each touchline, a
 * regular dashed line (not loose studs), pale by day and cool at night; a pulse of light
 * runs along each row now and then (`turfChase`). Painted over `paintPitch`'s grass. The
 * park at tier 0 has no lines and no sensors.
 */
export function smartTurf(s: Surface, p: Paint, G: (c: Color) => Color): void {
  if (p.tier < 1) return;
  const off = p.lamps ? NG.halo : G(P.grassHi);
  const slot = G(P.grassDeep);
  const { rows, xs } = turfLights(p);
  for (const y of rows) {
    for (const x of xs) {
      s.hline(x, y, 2, off);
      s.hline(x, y + 1, 2, slot);
    }
  }
}

/** Where the sensor lights are: their rows and columns. */
function turfLights(p: Paint): { rows: number[]; xs: number[] } {
  const { g } = p;
  const step = Math.max(16, Math.round(8 * g.k));
  const xs: number[] = [];
  for (let x = (g.cx % step) - step; x < g.w; x += step) if (x >= 0) xs.push(x);
  return { rows: [g.F + 3, g.N - 4], xs };
}

/** The pulse along the sensor lights: three lamps lit, then a pause; opposite ways. */
function turfChase(p: Paint) {
  const { rows, xs } = turfLights(p);
  const n = xs.length;
  const X = Int16Array.from(xs);
  const lap = n + 24;
  return {
    far(s: Surface, t: number): void {
      const k = Math.floor(Math.max(0, t) * 10) % lap;
      for (let r = 0; r < rows.length; r++) {
        const y = rows[r];
        for (let j = 0; j < 3; j++) {
          const i = k - j;
          if (i < 0 || i >= n) continue;
          const x = X[r === 0 ? i : n - 1 - i];
          s.px(x, y, j === 0 ? NG.hot : NG.lit);
          s.px(x + 1, y, NG.lit);
        }
      }
    },
  };
}

/**
 * The street lamp's pool at night in the park (tiers 0 and 1) is cool: between the sky's
 * light and the floodlit grade, tinted towards the lamp's `skyLow`. Graded colours cached.
 */
export function coolPool(light: {
  env(c: Color): Color;
  lit(c: Color): Color;
}): (c: Color) => Color {
  const cache = new Map<Color, Color>();
  return (c) => {
    const hit = cache.get(c);
    if (hit !== undefined) return hit;
    const v = mix(mix(light.env(c), light.lit(c), 0.6), P.skyLow, 0.1);
    cache.set(c, v);
    return v;
  };
}

// ---------------------------------------------------------------------------
// The near side, tiers 0 to 3
// ---------------------------------------------------------------------------

/** The robot dog's colours (people.ts `DOG_LEGEND` order): plates, lit plates, a light. */
function robotDog(G: (c: Color) => Color): Color[] {
  return [G(P.steel), G(P.steelHi), G(P.chalk), NG.lit, G(P.white), G(P.mist)];
}

/**
 * The near side in this era at tiers 0 to 3 (called instead of `paintNear` there): the
 * park's (a smart path lit along its kerb, a light bench, a smart bin, a light pole, a
 * planter of flowers, the shrubs; at tier 0 hoverboards and a picnic, at tier 1 the line of
 * light, the subs, a hard case in his colour, a bottle, a net of glowing balls) or the
 * club's (the slim backs of the holographic boards, a track, glass dugouts, the bank or the
 * terrace behind a lit glass rail). A robot dog where the dog is.
 */
export function paintNearNG(
  s: Surface,
  p: Paint,
  life: Life,
  grass: (
    s: Surface,
    p: Paint,
    G: (c: Color) => Color,
    y0: number,
    y1: number,
    rough: number,
  ) => void,
): void {
  if (p.tier >= 1) life.movers.push(turfChase(p));
  if (p.tier <= 1) nearParkNG(s, p, life, grass);
  else nearClubNG(s, p, life, grass);
}

function nearParkNG(
  s: Surface,
  p: Paint,
  life: Life,
  grass: Parameters<typeof paintNearNG>[3],
): void {
  const { g, E, tier } = p;
  const N = g.N;
  const H = g.h;
  grass(s, p, E, N + 1, H, 0.3);

  // the smart path: pale composite slabs, a light strip along its near kerb
  const py = Math.min(H - 44, N + (tier === 1 ? 52 : 36));
  s.rect(0, py, g.w, 14, E(P.steelHi));
  s.hline(0, py, g.w, E(P.white));
  s.hline(0, py + 1, g.w, E(P.chalk));
  s.hline(0, py + 12, g.w, E(P.steel));
  s.hline(0, py + 13, g.w, E(P.slate));
  for (let x = (g.cx % 32) - 32; x < g.w; x += 32) {
    s.vline(x, py + 2, 10, E(P.mist));
    s.px(x + 1, py + 2, E(P.white));
  }
  if (p.lamps) {
    strip(s, 0, py + 11, g.w, NG.halo, NG.lit);
    s.dither(0, py + 10, g.w, 1, NG.halo, 0.25);
  } else {
    s.hline(0, py + 11, g.w, E(P.skyLow));
  }

  // a light bench from behind: a white slab on one pedestal, a light under it
  const bx = sx(g, -40);
  s.rect(bx, py - 12, 36, 4, E(P.chalk));
  s.hline(bx, py - 12, 36, E(P.white));
  s.hline(bx, py - 9, 36, E(P.mist));
  s.hline(bx + 1, py - 8, 34, E(P.steel));
  s.rect(bx + 14, py - 7, 8, 9, E(P.steelHi));
  s.vline(bx + 21, py - 7, 9, E(P.steel));
  if (p.lamps) {
    s.hline(bx + 2, py - 7, 32, NG.lit);
    s.dither(bx, py - 6, 36, 2, NG.halo, 0.5);
  }
  s.hline(bx + 10, py + 2, 16, E(P.mist));
  // a smart bin: a round-topped pod with a ring of green light
  const bin = bx + 44;
  s.rect(bin, py - 9, 10, 13, E(P.steelHi));
  s.hline(bin + 1, py - 10, 8, E(P.steelHi));
  s.vline(bin, py - 9, 13, E(P.white));
  s.vline(bin + 9, py - 9, 13, E(P.steel));
  s.hline(bin + 2, py - 7, 6, E(P.night));
  s.hline(bin, py - 4, 10, P.ledGreen);

  // a light pole on the path, its pool on the slabs at night
  const lx = sx(g, 50);
  s.vline(lx, py - 58, 65, E(P.steelHi));
  s.vline(lx + 1, py - 58, 65, E(P.steel));
  s.hline(lx - 2, py + 5, 6, E(P.slate));
  s.hline(lx - 1, py + 4, 4, E(P.steel));
  // the head: a ring of light round the pole's top
  s.rect(lx - 3, py - 64, 8, 6, E(P.chalk));
  s.vline(lx - 3, py - 64, 6, E(P.white));
  s.vline(lx + 4, py - 64, 6, E(P.steel));
  if (p.lamps) {
    halo(s, p, lx + 1, py - 60, 12);
    s.rect(lx - 3, py - 61, 8, 2, NG.hot);
    s.hline(lx - 4, py - 61, 10, NG.lit);
    s.pushClip(0, py, g.w, 14);
    s.ellipse(lx, py + 6, 30, 6, p.light.lit(P.steel), true, 0.5);
    s.ellipse(lx, py + 6, 14, 4, p.light.lit(P.mist), true);
    s.popClip();
  } else {
    s.hline(lx - 3, py - 61, 8, E(P.skyLow));
  }

  // a white planter of flowers below the path, then shrubs along the bottom
  const fy = py + 18;
  if (fy + 12 < H - 16) {
    s.rect(0, fy, g.w, 10, E(P.woodDark));
    s.hline(0, fy, g.w, E(P.chalk));
    s.hline(0, fy + 1, g.w, E(P.mist));
    const blooms: readonly Color[] = [
      P.nextgenLight,
      P.skyLow,
      P.chalk,
      P.nextgen,
    ];
    for (let x = 2; x < g.w; x += 6) {
      const r = rnd(p, x, 60, 61);
      if (r < 0.25) continue;
      const c = E(blooms[Math.floor(r * 40) % blooms.length]);
      s.vline(x + 1, fy - 2, 3, E(P.grassDark));
      s.px(x, fy - 1, E(P.grass));
      s.px(x + 1, fy - 5, c);
      s.hline(x, fy - 4, 3, c);
      s.px(x + 1, fy - 4, p.lamps ? NG.lit : E(P.goldLight));
      s.px(x + 1, fy - 3, c);
    }
  }
  const deep = E(P.grassDeep);
  const dark = E(P.grassDark);
  const leaf = E(P.grass);
  for (let c = -1; c * 14 < g.w + 14; c++) {
    // clipped mounds: domes of leaf, lit on the left
    const r = rnd(p, c, 70, 71);
    const top = H - 18 - Math.floor(r * 3) * 2;
    const x = c * 14;
    for (let i = 0; i < 18; i++) {
      const e = Math.min(i, 17 - i);
      const drop = e === 0 ? 4 : e === 1 ? 2 : e === 2 ? 1 : 0;
      const y = top + drop;
      s.vline(x - 2 + i, y, 3, dark);
      s.vline(x - 2 + i, y + 3, H - y - 3, deep);
      if (i > 2 && i < 9) s.px(x - 2 + i, y, leaf);
    }
  }

  if (tier === 0) {
    // two hoverboards left on the grass, their pads lit
    hoverboard(s, p, sx(g, -64), N + 18, P.away);
    hoverboard(s, p, sx(g, -54), N + 23, P.nextgen);
    // a picnic: a blanket in his colour, a cool box, two people sitting, backs to us
    const px0 = sx(g, 14);
    const pyb = N + 22;
    for (let i = 0; i < 40; i++) {
      for (let j = 0; j < 8; j++) {
        const on = ((i >> 2) + (j >> 1)) % 2 === 0;
        s.px(px0 + i, pyb + j, E(on ? P.nextgen : P.chalk));
      }
    }
    s.hline(px0, pyb + 8, 40, E(P.grassDeep));
    s.rect(px0 + 34, pyb - 2, 9, 7, E(P.chalk));
    s.hline(px0 + 34, pyb - 2, 9, E(P.white));
    s.vline(px0 + 42, pyb - 1, 6, E(P.mist));
    s.hline(px0 + 35, pyb + 1, 7, p.lamps ? NG.lit : E(P.skyMid));
    s.rect(px0 + 30, pyb, 2, 5, E(P.steelHi));
    s.px(px0 + 30, pyb - 1, E(P.steel));
    paintBack(
      s,
      px0 + 6,
      pyb + 2,
      E(P.hairBrown),
      E(P.awayDark),
      false,
      E(P.skinA),
    );
    paintBack(
      s,
      px0 + 22,
      pyb + 2,
      E(P.hairBlond),
      E(P.nextgen),
      false,
      E(P.skinB),
    );
    life.dog = {
      roam: true,
      x0: sx(g, -30),
      x1: sx(g, 6),
      y: N + 30,
      colors: robotDog(E),
    };
    return;
  }

  // tier 1: the line of light close to us on slim posts
  const step = 32;
  for (let x = 0; x < g.w; x++) {
    s.px(x, N + 10, (x & 3) === 0 ? NG.halo : NG.lit);
  }
  if (p.lamps) s.dither(0, N + 9, g.w, 3, NG.halo, 0.25);
  for (let x = 0; x < g.w; x += step) {
    s.rect(x, N + 8, 2, 16, E(P.steelHi));
    s.vline(x + 1, N + 8, 16, E(P.steel));
    s.px(x, N + 8, NG.hot);
    s.hline(x - 1, N + 23, 4, E(P.slate));
  }
  const subs: readonly [number, Color][] = [
    [-52, P.nextgen],
    [-42, P.slate],
    [-32, P.nextgenDark],
  ];
  for (let i = 0; i < subs.length; i++) {
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
  // a hard case in his colour with a light strip, a holdall, a smart bottle
  const bag = sx(g, -14);
  s.rect(bag, N + 30, 18, 8, E(P.nextgen));
  s.hline(bag, N + 30, 18, E(P.nextgenLight));
  s.vline(bag + 17, N + 31, 7, E(P.nextgenDark));
  s.hline(bag + 1, N + 37, 17, E(P.nextgenDark));
  s.hline(bag + 2, N + 33, 14, p.lamps ? NG.lit : E(P.chalk));
  s.hline(bag + 6, N + 29, 6, E(P.night));
  s.rect(bag + 22, N + 32, 16, 6, E(P.night));
  s.hline(bag + 22, N + 32, 16, E(P.slate));
  s.hline(bag + 25, N + 31, 10, E(P.slate));
  s.hline(bag + 24, N + 35, 12, E(P.nextgenDark));
  const fx = sx(g, -20);
  s.rect(fx, N + 28, 4, 10, E(P.steelHi));
  s.vline(fx, N + 29, 9, E(P.white));
  s.vline(fx + 3, N + 29, 9, E(P.steel));
  s.rect(fx, N + 26, 4, 2, E(P.slate));
  s.hline(fx, N + 31, 4, NG.lit);
  // a net of balls with glowing panels
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
    s.rect(bx0 + 2, by0 + 2, 2, 2, NG.halo);
    s.px(bx0 + 2, by0 + 2, NG.lit);
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
    colors: robotDog(E),
  };
}

/** A hoverboard lying on the grass, side on: a deck, its pads, a light under it. */
function hoverboard(
  s: Surface,
  p: Paint,
  x: number,
  y: number,
  col: Color,
): void {
  const { E } = p;
  s.hline(x + 1, y - 3, 14, E(shade(col, 0.25)));
  s.rect(x, y - 2, 16, 2, E(col));
  s.px(x, y - 3, E(col));
  s.px(x + 15, y - 3, E(col));
  s.hline(x + 1, y, 14, E(P.night));
  for (const px of [x + 2, x + 11]) s.hline(px, y + 1, 3, E(P.slate));
  if (p.lamps) {
    s.hline(x + 2, y + 2, 12, NG.lit);
    s.dither(x, y + 3, 16, 1, NG.halo, 0.5);
  } else {
    s.hline(x + 5, y + 1, 6, E(P.skyMid));
  }
  s.hline(x + 1, y + 3, 14, E(P.grassDeep));
}

/** The slim backs of a row of holographic boards: dark glass on posts, a cable. */
function holoBacks(s: Surface, p: Paint, y: number, h: number): void {
  const { g, S } = p;
  s.rect(0, y, g.w, h, S(P.night));
  s.hline(0, y, g.w, S(P.steel));
  s.hline(0, y + 1, g.w, S(P.slate));
  for (let x = (g.cx % 48) - 48; x < g.w; x += 48) {
    s.vline(x, y + 2, h - 2, S(P.steel));
    s.vline(x + 1, y + 2, h - 2, S(P.slate));
    s.vline(x + 24, y + 4, h - 4, S(P.ink));
    s.px(x + 24, y + 4, p.lamps ? NG.lit : S(P.steel));
  }
  s.hline(0, y + h - 2, g.w, S(P.slate));
  s.hline(0, y + h - 1, g.w, p.flood ? NG.halo : S(P.steel));
  s.hline(0, y + h, g.w, S(P.night));
  s.hline(0, y + h + 1, g.w, S(shade(P.night, 0.1)));
}

/**
 * A glass dugout from behind: the subs' heads over its back, a curved glass canopy, white
 * ends, a band of his colour (the big one, tier 3), a light along its foot.
 */
function glassDugout(
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
    const hx = x + i;
    s.rect(hx + 1, y - 5, 4, 5, S(hc));
    s.hline(hx + 2, y - 6, 2, S(hc));
    s.vline(hx, y - 4, 4, S(hc));
    s.vline(hx + 5, y - 4, 4, S(shade(hc, -0.2)));
    const skin = pick(SKIN, hash2(x, i, 6));
    s.px(hx - 1, y - 2, S(skin));
    s.px(hx + 6, y - 2, S(shade(skin, -0.2)));
  }
  // the canopy: a curve of tinted glass over the back
  tint(s, x, y - 7, w, 7, S(P.skyLow), 0.3);
  s.hline(x + 3, y - 8, w - 6, S(P.white));
  s.px(x + 2, y - 7, S(P.white));
  s.px(x + w - 3, y - 7, S(P.mist));
  // its back: white panels, a window band of glass
  s.rect(x, y, w, h, S(P.chalk));
  s.rect(x + 2, y + 2, w - 4, 4, S(P.slate));
  s.hline(x + 2, y + 2, w - 4, S(P.steel));
  s.px(x + 3, y + 3, S(P.skyLow));
  s.hline(x, y, w, S(P.white));
  s.vline(x, y, h, S(P.white));
  s.vline(x + w - 1, y, h, S(P.steel));
  for (let k = 12; k < w - 4; k += 12) s.vline(x + k, y + 7, h - 9, S(P.mist));
  if (big) {
    s.hline(x + 1, y + h - 7, w - 2, S(P.nextgen));
    s.hline(x + 1, y + h - 6, w - 2, S(P.nextgenDark));
  }
  s.hline(x, y + h - 2, w, p.lamps ? NG.lit : S(P.steel));
  s.hline(x, y + h - 1, w, S(P.night));
}

function nearClubNG(
  s: Surface,
  p: Paint,
  life: Life,
  grass: Parameters<typeof paintNearNG>[3],
): void {
  const { g, S, tier } = p;
  const N = g.N;
  const H = g.h;
  grass(s, p, S, N + 1, N + 6, 0.2);
  const bh = tier === 2 ? 12 : 16;
  holoBacks(s, p, N + 1, bh);
  // a track behind the boards: a dark rubber lane at tier 2, a pale apron at tier 3, its
  // edge lit
  const ty = N + bh + 3;
  const tb = ty + 26;
  const track = tier === 2 ? P.slate : P.concreteLight;
  s.rect(0, ty, g.w, tb - ty, S(track));
  if (tier === 2) {
    for (let y = ty + 6; y < tb - 2; y += 7) s.hline(0, y, g.w, S(P.steel));
  } else {
    for (let x = (g.cx % 64) - 64; x < g.w; x += 64)
      s.vline(x, ty, tb - ty, S(P.mist));
  }
  s.hline(0, ty, g.w, S(shade(track, -0.25)));
  s.hline(0, tb - 1, g.w, p.lamps ? NG.halo : S(P.steelHi));
  if (tier === 2) {
    glassDugout(s, p, sx(g, -54), ty + 6, 44, false);
    glassDugout(s, p, sx(g, -26), ty + 6, 44, false);
  } else {
    glassDugout(s, p, sx(g, -62), ty + 4, 60, true);
    glassDugout(s, p, sx(g, -24), ty + 4, 60, true);
  }
  life.dog = {
    roam: false,
    x0: sx(g, tier === 2 ? 14 : 24),
    x1: 0,
    y: tb - 1,
    colors: robotDog(S),
  };
  if (tier === 2) {
    // a grass bank with people standing on it, a lit glass rail at the bottom
    grass(s, p, S, tb, H, 0.3);
    s.hline(0, tb, g.w, S(P.grassDeep));
    s.hline(0, tb + 1, g.w, S(mix(P.grassDeep, P.grassDark, 0.5)));
    crowdBacks(s, p, tb + 6, Math.min(H - 16, tb + 28), 0.55, 0.1);
    tint(s, 0, H - 7, g.w, 7, S(P.skyLow), 0.3);
    s.hline(0, H - 8, g.w, p.lamps ? NG.lit : S(P.white));
    for (let x = (g.cx % 24) - 24; x < g.w; x += 24) {
      s.vline(x, H - 7, 7, S(P.steelHi));
    }
    return;
  }
  // tier 3: a lit glass rail, then a packed terrace with glass barriers
  s.rect(0, tb, g.w, H - tb, S(P.slate));
  if (p.lamps) strip(s, 0, tb, g.w);
  else s.hline(0, tb, g.w, S(P.white));
  s.hline(0, tb + 1, g.w, S(P.steelHi));
  s.hline(0, tb + 2, g.w, S(P.steel));
  s.hline(0, tb + 3, g.w, S(P.slate));
  crowdBacks(s, p, tb + 4, H, 0.85, 0.35);
  for (let y = tb + 34; y < H; y += 30) {
    for (let x = (g.cx % 80) - 80; x < g.w; x += 80) {
      tint(s, x + 8, y + 1, 60, 5, S(P.skyLow), 0.3);
      if (p.flood) strip(s, x + 8, y, 60);
      else s.hline(x + 8, y, 60, S(P.white));
      for (const px of [x + 12, x + 62]) s.vline(px, y + 1, 6, S(P.steelHi));
    }
  }
}

// ---------------------------------------------------------------------------
// Tier 3: the end behind the goal (end.ts's frame)
// ---------------------------------------------------------------------------

/** end.ts's `seats`: a row's nosing, its seat, the aisle's steps. */
type Seats = (
  k: number,
  h: number,
  z: number,
  u: number,
  seat: Color,
  nose: Color,
  c: { hi: Color; light: Color; mid: Color },
) => Color;

/** The terrace's profile in stand pixels (end.ts): its lip, the back of its steps, its top. */
interface TerraceProfile {
  low: number;
  back: number;
  top: number;
}

/**
 * Tier 3's terrace behind the goal in this era, part by part (end.ts calls it for every
 * pixel of the end, `u` along its front, `hu` up it): holographic boards on dark glass along
 * its wall, a lit lip, white steps whose nosings glow at night, a white back wall with a
 * light along its top.
 */
export function ngTerraceColors(
  p: Paint,
  seats: Seats,
  t: TerraceProfile,
): (hu: number, u: number, h: number, z: number) => Color {
  const { S } = p;
  const fg = HOLO_LOOKS.map((l) => l[0]);
  const dim = HOLO_LOOKS.map((l) => l[1]);
  const c = {
    ink: S(P.ink),
    glass: S(P.night),
    glassHi: S(P.slate),
    seam: S(P.steel),
    hi: S(P.white),
    light: S(P.chalk),
    mid: S(P.mist),
    seat: S(P.steel),
    nose: p.flood ? NG.halo : S(P.steelHi),
    lip: p.flood ? NG.lit : S(P.white),
    edge: p.flood ? NG.lit : S(P.white),
  };
  const BW = 30;
  return (hu, u, h, z) => {
    if (u < 1.5) return hu < 14 ? c.glass : c.light;
    if (hu < 14) {
      if (hu < 2) return c.ink;
      const k = Math.floor(u / BW);
      const i = (((k + p.seed) % fg.length) + fg.length) % fg.length;
      const along = u - k * BW;
      if (along < 1.5) return c.seam;
      const row = hu - 2;
      if (row >= 11) return fg[i];
      if (row >= 10) return c.glassHi;
      if (row >= 4 && row < 8 && along > 5 && along < BW - 4) {
        return Math.floor(row) === 6 ? dim[i] : fg[i];
      }
      return c.glass;
    }
    if (hu < t.low) return hu < t.low - 1 ? c.mid : c.lip;
    if (hu < t.back) return seats(hu - t.low, h, z, u, c.seat, c.nose, c);
    const d = t.top - hu;
    return d < 1 ? c.edge : d < 2 ? c.hi : c.mid;
  };
}

/** The terrace's barriers in this era: glass rails, lit along the top at night. */
export function ngBarrierColors(p: Paint): [Color, Color] {
  return [p.flood ? NG.lit : p.S(P.white), p.S(P.skyLow)];
}
