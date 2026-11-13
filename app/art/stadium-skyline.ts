/**
 * The city on the horizon, behind the town: the business district's towers to the right
 * of the middle, the old town with its cathedral and tower blocks to the left, cranes, a
 * television tower, low roofs between them (so a low sun sets between the two clusters).
 *
 * It is far enough away to be nearly flat: two planes of silhouettes standing on the
 * horizon, each building a face and a shaded right side, faded towards the sky. At night
 * the windows are lit and the tallest carry a red light.
 */

import { Surface, hash2, type Color } from "~/pixel";
import { distant, type Lighting } from "~/art/lighting";
import { P } from "~/art/palette";
import type { View } from "~/art/stadium-view";

type Kind =
  | "slab"
  | "step"
  | "spire"
  | "slant"
  | "crown"
  | "block"
  | "dome"
  | "church"
  | "needle"
  | "crane"
  | "gas";

interface Building {
  /** Left edge, in units from the middle of the screen. */
  x: number;
  w: number;
  h: number;
  kind: Kind;
  /** A red light on top at night. */
  beacon?: boolean;
  /** A crane's jib points left. */
  left?: boolean;
}

/** The front plane, left to right. Units are pixels on the reference monitor. */
const CITY: readonly Building[] = [
  // the old town
  { x: -143, w: 7, h: 11, kind: "block" },
  { x: -128, w: 6, h: 9, kind: "slab" },
  { x: -112, w: 3, h: 15, kind: "church" },
  { x: -98, w: 7, h: 12, kind: "block" },
  { x: -88, w: 7, h: 15, kind: "block" },
  { x: -74, w: 17, h: 8, kind: "dome" },
  { x: -52, w: 6, h: 11, kind: "slab" },
  { x: -43, w: 8, h: 14, kind: "step" },
  { x: -31, w: 1, h: 18, kind: "crane" },
  { x: -24, w: 7, h: 9, kind: "slab" },
  // the business district
  { x: 19, w: 7, h: 10, kind: "slab" },
  { x: 27, w: 8, h: 15, kind: "step" },
  { x: 36, w: 7, h: 20, kind: "slant" },
  { x: 44, w: 9, h: 26, kind: "spire", beacon: true },
  { x: 54, w: 6, h: 16, kind: "slab" },
  { x: 61, w: 10, h: 22, kind: "crown", beacon: true },
  { x: 72, w: 6, h: 13, kind: "slab" },
  { x: 79, w: 8, h: 18, kind: "step" },
  { x: 88, w: 7, h: 12, kind: "slant" },
  { x: 99, w: 1, h: 20, kind: "crane", left: true, beacon: true },
  { x: 103, w: 8, h: 9, kind: "slab" },
  // the east end
  { x: 152, w: 7, h: 12, kind: "block" },
  { x: 168, w: 3, h: 27, kind: "needle", beacon: true },
  { x: 180, w: 12, h: 7, kind: "gas" },
  { x: 200, w: 6, h: 10, kind: "slab" },
  { x: 214, w: 7, h: 13, kind: "block" },
];

/**
 * Paint the city on rows above `view.hy` of `s` (a full-size surface). Returns where its
 * red lights are, for the painter of things that blink.
 */
export function paintSkyline(
  s: Surface,
  view: View,
  light: Lighting,
  seed: number,
): { x: number; y: number }[] {
  const { hy, cx, w, k } = view;
  const beacons: { x: number; y: number }[] = [];
  if (hy < 6) return beacons;
  // Whole pixels at every size: buildings are sized from a unit, never scaled as pictures,
  // and a choice made on the unit is made on half of it (`u1`).
  const u = Math.max(0.84, Math.min(3, k));
  const u1 = u / 2;
  const night = light.lightsOn;
  const px = (n: number): number => Math.max(2, Math.round(n * u));
  const tall = (n: number): number =>
    Math.max(4, Math.min(hy - view.logoH - 6, Math.round(n * u)));

  // ---- the back plane: a run of roofs, paler --------------------------------
  // In a low light the city is a dark shape against the glow; by day it is pale with haze.
  const low = light.sun.elevation < 6;
  const dBack = night ? 0.5 : low ? 0.62 : 0.86;
  const dFront = night ? 0.25 : low ? 0.38 : 0.62;
  const backFace = distant(light, night ? P.slate : P.steel, dBack);
  const backSide = distant(light, night ? P.night : P.slate, dBack);
  let x = Math.round(cx - 250 * u);
  let i = 0;
  while (x < cx + 250 * u && i < 400) {
    const r = hash2(i, 801, seed);
    const r2 = hash2(i, 802, seed);
    const mid = (x - cx) / u;
    // taller behind the two clusters, low where the sun goes down
    const lift =
      Math.max(0, 1 - Math.abs(mid - 62) / 60) * 9 +
      Math.max(0, 1 - Math.abs(mid + 70) / 62) * 5;
    const bw = px(3 + r * 5);
    const bh = Math.max(
      2,
      Math.round((2.5 + r2 * 4 + lift * (0.5 + r2 * 0.5)) * u),
    );
    if (x + bw > 0 && x < w) {
      s.rect(x, hy - bh, bw, bh, backFace);
      if (bw >= 6)
        s.rect(
          x + bw - Math.max(1, Math.floor(bw / 3)),
          hy - bh,
          Math.max(1, Math.floor(bw / 3)),
          bh,
          backSide,
        );
      if (night && bh >= 6) {
        for (let wy = hy - bh + 1; wy < hy - 1; wy += 2) {
          for (let wx = x; wx < x + bw; wx += 2) {
            if (hash2(wx, wy, seed + 5) < 0.22) s.px(wx, wy, P.amberDim);
          }
        }
      }
    }
    x += bw + (r2 < 0.2 ? px(2) : 0);
    i++;
  }

  // ---- the front plane ------------------------------------------------------
  const face = distant(light, night ? P.slate : P.steel, dFront);
  const side = distant(light, night ? P.night : P.slate, dFront);
  const glass = distant(light, P.mist, dFront);
  const stone = distant(light, night ? P.concreteDark : P.concrete, dFront);
  const stoneSide = distant(light, night ? P.night : P.concreteDark, dFront);
  const frame = distant(light, night ? P.night : P.slate, dFront - 0.12);
  const crane = distant(light, night ? P.brickDark : P.brick, dFront - 0.12);

  const body = (
    bx: number,
    top: number,
    bw: number,
    bh: number,
    a: Color,
    b: Color,
    key: number,
    windows: boolean,
  ): void => {
    if (bw <= 0 || bh <= 0) return;
    s.rect(bx, top, bw, bh, a);
    const sw = bw >= 6 ? Math.max(2, Math.floor(bw / 3)) : 0;
    if (sw > 0) s.rect(bx + bw - sw, top, sw, bh, b);
    if (!windows || bw < 6) return;
    if (night) {
      for (let wy = top + 1; wy < top + bh - 1; wy += 2) {
        for (let wx = bx + 1; wx < bx + bw - 1; wx += 2) {
          const r = hash2(wx + key * 31, wy, seed);
          if (r < 0.4)
            s.px(wx, wy, r < 0.08 ? P.goldLight : r < 0.27 ? P.gold : P.amber);
        }
      }
    } else if (bh >= 16 && bw - sw >= 6) {
      // floors of glass on the lit face (finer: a floor every 2 px, and the
      // glass divided into panes by a frame every 3 px)
      for (let wy = top + 4; wy < top + bh - 2; wy += 2) {
        s.rect(bx + 2, wy, bw - sw - 2, 1, glass);

        for (let wx = bx + 4; wx < bx + bw - sw - 1; wx += 3) s.px(wx, wy, a);
      }
    }
  };

  for (let n = 0; n < CITY.length; n++) {
    const b = CITY[n];
    const bx = Math.round(cx + b.x * u);
    const bw = px(b.w);
    const bh = tall(b.h);
    if (bx > w + 24 || bx + bw < -24) continue;
    const top = hy - bh;
    let peak = top;
    switch (b.kind) {
      case "slab": {
        body(bx, top, bw, bh, face, side, n, true);
        if (n % 2 === 0 && bw >= 8) {
          s.rect(bx + 2, top - 2, Math.max(2, Math.floor(bw / 3)), 2, side);
        }
        break;
      }
      case "block": {
        // a tower block: pale concrete, a lift house on the roof
        body(bx, top, bw, bh, stone, stoneSide, n, true);
        if (bw >= 8)
          s.rect(bx + Math.floor(bw / 2) - 2, top - 2, 4, 2, stoneSide);
        break;
      }
      case "step": {
        const inset = Math.max(2, Math.round(bw / 4));
        const upper = Math.max(2, Math.round(bh * 0.28));
        body(bx, top + upper, bw, bh - upper, face, side, n, true);
        body(bx + inset, top, bw - inset * 2, upper, face, side, n + 50, false);
        if (u1 >= 0.7) {
          s.rect(bx + Math.floor(bw / 2), top - 6, 2, 6, frame);
          peak = top - 6;
        }
        break;
      }
      case "slant": {
        // the roof falls to the right, a row at a time
        const fall = Math.max(2, Math.min(8, bw - 4));
        body(bx, top + fall, bw, bh - fall, face, side, n, true);
        const sw = bw >= 6 ? Math.max(2, Math.floor(bw / 3)) : 0;
        for (let j = 0; j < bw; j++) {
          const drop = Math.round((j / Math.max(1, bw - 1)) * fall);
          s.rect(
            bx + j,
            top + drop,
            1,
            fall - drop,
            j >= bw - sw ? side : face,
          );
        }
        break;
      }
      case "spire": {
        const crownH = Math.max(4, Math.round(bh * 0.2));
        body(bx, top + crownH, bw, bh - crownH, face, side, n, true);
        // setbacks up to a point, then a mast
        let cw = bw - 4;
        let cyy = top + crownH - 1;
        while (cw > 0 && cyy >= top) {
          s.rect(
            bx + Math.floor((bw - cw) / 2),
            cyy,
            cw,
            1,
            cw > 4 ? face : side,
          );
          if ((top + crownH - 1 - cyy) % 2 === 1 || cw <= 6) cw -= 2;
          cyy--;
        }
        const mast = Math.max(4, Math.round(4 * u));
        s.rect(bx + Math.floor(bw / 2) - 1, top - mast, 2, mast + 1, frame);
        peak = top - mast;
        break;
      }
      case "crown": {
        body(bx, top, bw, bh, face, side, n, true);
        // plant on the roof and two masts
        s.rect(bx + 2, top - 2, bw - 4, 2, side);
        if (u1 >= 0.7) {
          s.rect(bx + 4, top - 8, 2, 6, frame);
          s.rect(bx + bw - 6, top - 6, 2, 4, frame);
          peak = top - 8;
        } else {
          peak = top - 2;
        }
        break;
      }
      case "dome": {
        // the cathedral: a nave, a drum and a dome with a lantern, a west tower
        body(bx, top, bw, bh, stone, stoneSide, n, false);
        const r = Math.max(4, Math.round(bw * 0.24));
        const dcx = bx + Math.round(bw * 0.58);
        for (let j = 0; j <= r; j++) {
          const half = Math.round(Math.sqrt(Math.max(0, r * r - j * j)));
          s.rect(dcx - half, top - 1 - j, half + 1, 1, stone);
          if (half > 0) s.rect(dcx + 1, top - 1 - j, half, 1, stoneSide);
        }
        s.rect(dcx, top - r - 6, 2, 4, frame);
        const tw = Math.max(4, Math.round(bw * 0.2));
        const th = Math.max(4, Math.round(bh * 0.75));
        body(bx, top - th, tw, th, stone, stoneSide, n, false);
        if (night) {
          s.rect(dcx - 2, top - 2, 2, 2, P.gold);
          s.rect(bx + 4, top + 4, 2, 2, P.amber);
          if (bw > 20) s.rect(bx + bw - 8, top + 4, 2, 2, P.amber);
        }
        peak = top - r - 6;
        break;
      }
      case "church": {
        const base = Math.max(4, Math.round(bh * 0.45));
        body(bx, hy - base, bw, base, stone, stoneSide, n, false);
        const mid = bx + Math.floor(bw / 2);
        for (let y = top; y < hy - base; y++) {
          const half = Math.round(
            (((y - top) / Math.max(1, hy - base - top)) * (bw - 1)) / 2,
          );
          s.rect(mid - half, y, half + 1, 1, stone);
          if (half > 0) s.rect(mid + 1, y, half, 1, stoneSide);
        }
        break;
      }
      case "needle": {
        // the television tower: a shaft, a pod two thirds of the way up, an aerial
        const shaft = (u1 >= 0.9 ? 2 : 1) * 2;
        s.rect(bx, top, shaft, bh, stone);
        if (shaft >= 2) s.rect(bx + shaft / 2, top, shaft / 2, bh, stoneSide);
        const py = top + Math.round(bh * 0.3);
        const pw = Math.max(2, Math.round(2.4 * u));
        s.rect(bx - pw, py, pw * 2 + shaft, 2, stone);
        s.rect(bx - pw + 2, py + 2, pw * 2 + shaft - 4, 2, stoneSide);
        s.rect(
          bx - pw + 2,
          py - 2,
          pw * 2 + shaft - 4,
          2,
          night ? P.gold : glass,
        );
        s.rect(bx, top - Math.round(4 * u), 2, Math.round(4 * u), frame);
        peak = top - Math.round(4 * u);
        break;
      }
      case "crane": {
        // a tower crane: mast, jib, counter-jib, the cab where they meet
        const dir = b.left ? -1 : 1;
        const jib = Math.max(6, Math.round(11 * u));
        const back = Math.max(2, Math.round(4 * u));
        s.rect(bx, top, 2, bh, crane);
        const x0 = dir > 0 ? bx - back : bx - jib;
        s.rect(x0, top + 2, jib + back + 2, 2, crane);
        s.rect(bx, top - 2, 2, 2, crane);

        // a lattice: the mast and the jib are open frames
        for (let y = top + 4; y < hy - 1; y += 3) s.px(bx + (y % 2), y, frame);
        for (let j = 1; j < jib + back + 2; j += 3)
          s.px(x0 + j, top + 3, frame);

        if (u1 >= 0.7) {
          s.rect(bx + dir * 2, top, 2, 2, crane);
          s.rect(bx - dir * back, top + 4, 2, 2, frame);
          s.rect(bx + dir * Math.round(jib * 0.7), top + 4, 1, 4, frame);
          s.rect(bx + dir * Math.round(jib * 0.7) - 1, top + 8, 3, 1, frame);
        }
        peak = top - 2;
        break;
      }
      case "gas": {
        // the gasholder: a drum in a frame of posts
        const drum = Math.max(2, bh - Math.max(2, Math.round(2 * u)));
        s.rect(bx, hy - drum, bw, drum, stoneSide);
        s.rect(bx, hy - drum, Math.ceil(bw * 0.6), drum, stone);
        const posts = bw >= 18 ? 4 : 3;
        for (let j = 0; j < posts; j++) {
          s.rect(
            bx + Math.round((j * (bw - 2)) / (posts - 1)),
            top,
            2,
            bh,
            frame,
          );
        }
        s.rect(bx, top, bw, 2, frame);
        // a girder halfway up joins the posts
        s.rect(bx, top + Math.round(bh / 2), bw, 1, frame);
        break;
      }
    }
    if (b.beacon && peak - 1 > view.logoH)
      beacons.push({
        x:
          bx +
          (b.kind === "crown"
            ? 4
            : b.kind === "crane" || b.kind === "needle"
              ? 0
              : Math.floor(bw / 2)),
        y: peak - 1,
      });
  }
  return beacons;
}
