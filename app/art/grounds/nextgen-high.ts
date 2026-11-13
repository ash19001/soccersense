/**
 * NEXT-GEN's arena, tiers 4 to 7 (.snaps/era-art/THEME.md): the stadium of the future on
 * HOME's plan. The stands stand where HOME's do (`STAND`, `endFor`), only their look
 * changes: glass and light.
 *
 * - The side stand: a white canopy roof with a glass band and a light ribbon in NEXT-GEN's
 *   magenta along its fascia (a pulse of white chasing along it), cable-stayed masts with
 *   lamps on their tips, strip lights under the roof, a glass balcony with a cyan light
 *   line, a band of glass boxes lit cool at night, step lights in the aisles, and
 *   holographic boards along the far touchline (scanlined words crawling on dark glass).
 * - Camera drones hover over the stand and the goal, rotors blurring, a tally lamp blinking.
 * - The end behind the goal (end.ts's frame): the same roof and ribbon, holographic boards
 *   along its front, a glass walkway lit along its lip, strip lights; a glass concourse in
 *   the corner.
 * - Tier 5: holographic flags on the roof, LED banners over the balcony, light sticks
 *   waved in the lower tier. Tier 6 (the final, at night): a domed roof of ribs over the
 *   sky with lamps along them, lasers sweeping up from the roofs, giant flags. Tier 7: a
 *   drone light show over the roof (in place of fireworks) and glowing confetti (in place
 *   of ticker tape).
 * - The near side: the slim backs of the boards, smart turf with a grid, glass dugouts,
 *   ball kids on hover stools, a steward with a light band, a robot dog, a glass barrier
 *   lit along its rail, the near crowd; at tier 6 the trophy on a glass pedestal.
 * - Tier 7's podium: white glass steps lit along their tops, places in lamps.
 *
 * Light sources (ribbons, strip lights, lamps, holograms, lasers, drones' lamps) are raw
 * palette colours; the structure is graded with `p.S`. Glows are stepped pixel halos
 * (dither), never blends. Everything that moves is a `Mover` (life.ts), made once per
 * build; drawing allocates nothing.
 */

import { drawTrophy } from "~/art/characters";
import type { Zone } from "~/art/layout";
import { drawLamps, measureLamps } from "~/art/led";
import { P } from "~/art/palette";
import { moonPosition } from "~/art/sky";
import {
  FONT_3x5,
  FONT_5x7,
  Surface,
  TRANSPARENT,
  bayer4,
  drawSprite,
  drawText,
  sprite,
  type Sprite,
  hash2,
  measureText,
  mix,
  shade,
  type Color,
} from "~/pixel";
import { crowdBacks, fanBlock } from "./crowd";
import { endFor, endTopAt, END_PROFILE, type EndGeo } from "./end";
import type { Life } from "./life";
import { grass } from "./near";
import {
  HAIR,
  SKIN,
  crowdColors,
  crowdShirts,
  pick,
  rnd,
  sx,
  type Geo,
  type Grade,
  type Paint,
} from "./paint";
import { drawSteward, paintBack } from "./people";
import { podiumFor } from "./pitch";
import { STAND } from "./stand";
import type { NetBulge } from "./types";

// ---------------------------------------------------------------------------
// The far side
// ---------------------------------------------------------------------------

/** The roof's rows, down from its top: the canopy's lit edge, glass, the ribbon, the lip. */
const ROOF_GLASS = 1;
const ROOF_RIBBON = 6;
const ROOF_LIP = 8;
const ROOF_UNDER = 12;

/** The arena's far side (tiers 4 to 7): replaces `paintStadium` for NEXT-GEN. */
export function paintArena(s: Surface, p: Paint, life: Life): void {
  const { g, S } = p;
  const F = g.F;
  const st = STAND;
  const corner = Math.min(g.w, endFor(g).corner);

  arenaStand(s, p, life, 0, corner);
  // the stand's end: a slim glass wall, a light down its edge
  const endH = st.roofTop - st.boards;
  const top = F - st.roofTop;
  s.rect(corner - 4, top, 4, endH, S(P.slate));
  s.vline(corner - 4, top, endH, S(P.mist));
  s.vline(corner - 3, top, endH, S(P.steel));
  s.vline(corner - 1, top + ROOF_UNDER, endH - ROOF_UNDER, P.skyMid);
  if (p.lamps) {
    for (let y = top + 20; y < F - 24; y += 18)
      s.vline(corner - 2, y, 6, P.skyLow);
  }
  arenaBoards(s, p, life, corner);
  crown(s, p, corner);
  holoScreen(s, p, life, corner);
  ribbon(p, life, corner);
  drones(p, life);

  if (p.tier >= 5) dressArena(s, p, life, corner);
  if (p.tier >= 6) {
    // the dome's ribs at the final; at tier 7 the drone show has the sky to itself
    if (p.tier === 6) dome(s, p, corner);
    life.flashes = 10;
    const y = F - st.lowerTop + 4;
    const [a, b] = crowdColors(p, false);
    life.giant.push(
      {
        x0: 0,
        x1: corner,
        y,
        w: 68,
        h: 20,
        a: S(a),
        b: S(b),
        speed: 10,
        phase: 0.45,
      },
      {
        x0: 0,
        x1: corner,
        y: y + 18,
        w: 56,
        h: 18,
        a: S(b),
        b: S(a),
        speed: 6,
        phase: 0.1,
      },
    );
    // three lasers at the final; at tier 7 the drone show has the sky to itself
    if (p.tier === 6) {
      const bx = sx(g, 80);
      lasers(life, [
        [sx(g, -100), top],
        [sx(g, -32), top],
        [bx, endTopAt(endFor(g), bx, END_PROFILE.TOP)],
      ]);
    }
  }
  if (p.tier >= 7) {
    droneShow(life, {
      x: 12,
      y: Math.max(8, F - st.roofTop - 100),
      w: Math.max(1, g.w - 24),
      h: 60,
    });
  }
}

/** The side stand, from the left edge to `x1` (the corner). */
function arenaStand(
  s: Surface,
  p: Paint,
  life: Life,
  x0: number,
  x1: number,
): void {
  const { g, S } = p;
  const F = g.F;
  const st = STAND;
  const w = x1 - x0;
  if (w <= 0) return;
  const top = F - st.roofTop;

  // under the roof: dark glass
  s.rect(x0, F - st.upperTop - 4, w, 4, S(P.night));
  // the upper tier, in the roof's shade at the back
  s.rect(x0, F - st.upperTop, w, st.upperTop - st.balcony, S(P.night));
  fanBlock(s, p, life, {
    x0,
    x1,
    y: F - st.upperTop,
    rows: 6,
    seat: S(P.night),
    empty: 0,
    shadowRows: 2,
  });
  stepLights(s, p, x0, x1, F - st.upperTop + 8, F - st.balcony);

  // the balcony: a glass balustrade, a band of cyan light along its rail (by day and night:
  // it is one of the arena's lights that a phone, under the question board, still sees)
  const by = F - st.balcony;
  s.hline(x0, by, w, S(P.white));
  s.hline(x0, by + 1, w, P.white);
  s.hline(x0, by + 2, w, P.skyLow);
  s.hline(x0, by + 3, w, P.skyMid);

  // the boxes: a band of glass with slim mullions, people watching. Every box is lit
  // inside, cool white or cyan (glass rooms read as light by day too), and every third is a
  // screen of light in his magenta, scanlined
  const bx = F - st.boxes;
  s.rect(x0, bx, w, 10, S(P.night));
  s.hline(x0, bx, w, S(P.steelHi));
  const pitch = 12;
  const shirts = crowdShirts(p);
  const first = x0 + ((((g.cx - x0) % pitch) + pitch) % pitch) - pitch;
  for (let x = first; x < x1; x += pitch) {
    const r = rnd(p, x, 40, 41);
    const k = Math.round((x - g.cx) / pitch);
    const wy = bx + 1;
    if (((k % 3) + 3) % 3 === 1) {
      // a holo panel: magenta light, every other row a dimmer scanline, a bright edge
      s.rect(x, wy, 11, 7, P.nextgenDark);
      for (let yy = wy + 1; yy < wy + 7; yy += 2) s.hline(x, yy, 11, P.nextgen);
      s.hline(x, wy, 11, P.nextgenLight);
      s.hline(x + 3, wy + 3, 5, P.nextgenLight);
      s.vline(x + 11, wy, 7, S(P.steelHi));
      continue;
    }
    const lit = p.lamps ? r > 0.3 : r > 0.45;
    // day: the sky in the glass, darker below, or the room lit; night: lit rooms
    if (lit) {
      s.rect(x, wy, 11, 7, r < 0.65 ? P.haze : P.skyLow);
    } else {
      s.rect(x, wy, 11, 3, S(P.skyMid));
      s.rect(x, wy + 3, 11, 4, S(P.slate));
    }
    if (rnd(p, x, 42, 41) < 0.6) {
      const hx = x + 2 + Math.floor(rnd(p, x, 43, 41) * 5);
      const skin = S(pick(SKIN, rnd(p, x, 44, 41)));
      const hair = S(pick(HAIR, rnd(p, x, 45, 41)));
      const shirt = S(pick(shirts, rnd(p, x, 46, 41)));
      s.hline(hx, wy + 2, 2, hair);
      s.rect(hx, wy + 3, 2, 2, skin);
      s.px(hx - 1, wy + 3, hair);
      s.rect(hx - 1, wy + 5, 4, 2, shirt);
    }
    if (!lit) {
      // a glint of sky slanting across the glass
      for (let k = 0; k < 3; k++) s.px(x + 6 + k, wy + 2 - k, S(P.haze));
    }
    s.vline(x + 11, wy, 7, S(P.steelHi));
  }
  s.hline(x0, bx + 8, w, P.skyMid);
  s.hline(x0, bx + 9, w, S(P.night));
  s.hline(x0, F - st.lowerTop - 2, w, S(P.slate));
  s.hline(x0, F - st.lowerTop - 1, w, S(P.night));

  // the lower tier
  s.rect(x0, F - st.lowerTop, w, st.lowerTop - st.boards, S(P.concreteDark));
  fanBlock(s, p, life, {
    x0,
    x1,
    y: F - st.lowerTop,
    rows: 6,
    seat: S(P.concreteDark),
    empty: 0,
    shadowRows: 0,
  });
  stepLights(s, p, x0, x1, F - st.lowerTop, F - 16);
  // the lower tier's front: a strip of magenta light under the seat rows
  s.hline(x0, F - 16, w, P.nextgenLight);
  s.hline(x0, F - 15, w, P.nextgen);

  // the roof: a white canopy, a band of glass with the sky in it, the ribbon, the lip
  s.hline(x0, top, w, S(P.white));
  for (let y = top + ROOF_GLASS; y < top + ROOF_RIBBON; y++) {
    for (let x = x0; x < x1; x++) {
      const k = (((x - g.cx + (y - top) * 2) % 24) + 24) % 24;
      s.px(x, y, k < 3 ? S(P.haze) : y < top + 3 ? S(P.skyLow) : S(P.skyMid));
    }
  }
  for (let x = x0 + ((((g.cx - x0) % 24) + 24) % 24) - 24; x < x1; x += 24) {
    s.vline(x, top + ROOF_GLASS, ROOF_RIBBON - ROOF_GLASS, S(P.mist));
  }
  s.hline(x0, top + ROOF_RIBBON, w, P.nextgenLight);
  s.hline(x0, top + ROOF_RIBBON + 1, w, P.nextgen);
  s.hline(x0, top + ROOF_LIP, w, S(P.steelHi));
  s.hline(x0, top + ROOF_LIP + 1, w, S(P.mist));
  s.hline(x0, top + ROOF_LIP + 2, w, S(P.steel));
  s.hline(x0, top + ROOF_LIP + 3, w, S(P.slate));
  // its smooth underside, strip lights along it
  s.rect(x0, top + ROOF_UNDER, w, 4, S(P.night));
  for (let x = x0 + 4; x < x1; x += 16) {
    s.hline(x, top + ROOF_UNDER, 8, p.lamps ? P.skyLow : S(P.steel));
    if (p.lamps) s.dither(x - 1, top + ROOF_UNDER + 1, 10, 2, P.skyMid, 0.25);
  }
}

/**
 * The aisles: glass steps every 96 px, 4 wide, a lamp on every other nosing (cyan at
 * night, unlit grey by day).
 */
function stepLights(
  s: Surface,
  p: Paint,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
): void {
  const { S, g } = p;
  const every = 96;
  const start = g.cx + (((((x0 - g.cx) % every) + every) % every) - every);
  const tread = S(P.steel);
  const riser = S(P.slate);
  const nose = S(P.mist);
  const lamp = p.lamps ? P.skyLow : S(P.steelHi);
  for (let x = start; x < x1; x += every) {
    if (x < x0 + 6 || x > x1 - 10) continue;
    for (let y = y0; y < y1; y++) {
      const k = (y - y0) & 3;
      s.hline(x, y, 4, k === 0 ? nose : k === 1 ? tread : riser);
      if (k === 0 && ((y - y0) & 7) === 0) {
        s.px(x, y, lamp);
        s.px(x + 3, y, lamp);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Holographic boards along the far touchline
// ---------------------------------------------------------------------------

interface HoloLook {
  bg: Color;
  fg: Color;
}

/**
 * Words of light on dark glass: cyan, chalk, pale teal, pale gold, and one in magenta. The
 * glass is always dark (ink or night), so the light reads by day and night.
 */
export const HOLO_LOOKS: readonly HoloLook[] = [
  { bg: P.ink, fg: P.skyLow },
  { bg: P.night, fg: P.chalk },
  { bg: P.ink, fg: P.awayLight },
  { bg: P.night, fg: P.goldLight },
  { bg: P.ink, fg: P.nextgenLight },
];

/** A colour's scanline (every other row of a hologram): halfway to its panel. */
const scan = new Map<string, Color>();
function scanOf(fg: Color, bg: Color): Color {
  const key = `${fg}:${bg}`;
  let v = scan.get(key);
  if (v === undefined) {
    v = mix(fg, bg, 0.45);
    scan.set(key, v);
  }
  return v;
}

/**
 * The boards: a dark glass frame 14 px tall, a cyan emitter along its foot, holding a strip
 * 10 px tall that crawls one lamp (2 px) at a time, as HOME's LED boards do: each board's
 * words as lamps of light (`drawLamps`, the small font) in chalk, cyan, teal or pale gold
 * on dark glass with a faint grid. A scanline sweeps down the glass (a mover), a pixel row
 * at a time, so the boards read as projected light, not paint.
 */
function arenaBoards(s: Surface, p: Paint, life: Life, x1: number): void {
  const { g, S } = p;
  const bh = STAND.boards;
  const y = g.F - bh;
  s.rect(0, y, x1, bh, S(P.ink));
  s.hline(0, y, x1, S(P.steelHi));
  s.hline(0, y + 1, x1, S(P.night));
  s.hline(0, y + bh - 1, x1, P.skyMid);
  const words = (p.labels.boards ?? []).map((w) => w.toUpperCase());
  const parts = words.length > 0 ? words : ["", "", ""];
  const sh = 10;
  let width = 0;
  const widths: number[] = [];
  for (const wd of parts) {
    let bw = Math.max(80, (wd ? measureLamps(wd, FONT_3x5) : 0) + 32);
    bw += bw & 1;
    widths.push(bw);
    width += bw;
  }
  const laps = Math.max(1, Math.ceil(g.w / width));
  const strip = new Surface(width * laps, sh);
  let x = 0;
  for (let l = 0; l < laps; l++) {
    for (let i = 0; i < parts.length; i++) {
      const look = HOLO_LOOKS[(i + l) % HOLO_LOOKS.length];
      const bw = widths[i];
      strip.rect(x, 0, bw, sh, look.bg);
      // the glass's faint grid of unlit lamps
      strip.dither(x, 0, bw - 2, sh, mix(look.bg, look.fg, 0.2), 0.25);
      if (parts[i]) {
        let tx = x + Math.floor((bw - measureLamps(parts[i], FONT_3x5)) / 2);
        tx -= tx & 1;
        drawLamps(strip, parts[i], tx, 0, look.fg, {
          font: FONT_3x5,
          bg: look.bg,
        });
      } else {
        for (let k = 8; k < bw - 8; k += 8) {
          for (let yy = 2; yy < 8; yy += 2)
            for (let xx = 0; xx < 4; xx += 2) strip.px(x + k + xx, yy, look.fg);
        }
      }
      strip.vline(x + bw - 2, 0, sh, P.ink);
      strip.vline(x + bw - 1, 0, sh, S(P.slate));
      x += bw;
    }
  }
  life.crawl = { x0: 0, x1, y: y + 2, strip, speed: 24, step: 2 };
  // the scanline: one row of the glass a step lighter, sweeping down every 1.6 s
  const glass = [P.ink, P.night];
  const lit = glass.map((c) => mix(c, P.skyMid, 0.4));
  const y0 = y + 2;
  life.movers.push({
    far(sf: Surface, t: number): void {
      const row = Math.floor(((t % 1.6) / 1.6) * (sh + 4));
      if (row >= sh) return;
      const yy = y0 + row;
      for (let xx = 0; xx < x1; xx++) {
        const c = sf.get(xx, yy);
        if (c === glass[0]) sf.px(xx, yy, lit[0]);
        else if (c === glass[1]) sf.px(xx, yy, lit[1]);
      }
    },
  });
}

// ---------------------------------------------------------------------------
// The roofs' crown of glass vaults, the holographic screen, the ribbon, the drones
// ---------------------------------------------------------------------------

/** The glass vaults over the roofs: one every `VAULT` px from the stage's middle, `VAULT_H` tall. */
const VAULT = 96;
const VAULT_H = 18;

/** The vault's height over column `x` of the side roof (0 at the pillars between vaults). */
function vaultAt(g: Geo, x: number): number {
  const v = ((((x - g.cx) % VAULT) + VAULT) % VAULT) / VAULT;
  return Math.round(VAULT_H * Math.sqrt(Math.sin(Math.PI * v)));
}

/**
 * A crown of glass vaults along the roofs: each a rounded arch of glass on a diagrid of
 * slim ribs, its rim a cyan light, a magenta lamp on each pillar between two. By day the
 * glass shows the sky through it, sparkling; at night it glows violet. Along the end's roof
 * the vaults open out as the end comes towards us.
 */
function crown(s: Surface, p: Paint, corner: number): void {
  const { g, S } = p;
  const top = g.F - STAND.roofTop;
  const night = p.lamps;
  const rib = S(night ? P.steel : P.steelHi);
  const rim = S(P.white);
  const sheen = S(P.haze);
  const column = (x: number, yr: number, h: number, v: number): void => {
    if (h <= 1) {
      // a pillar between two vaults, a lamp on it
      s.px(x, yr - 1, S(P.steelHi));
      s.px(x, yr - 2, P.nextgenLight);
      return;
    }
    s.px(x, yr - h, P.skyLow);
    s.px(x, yr - h + 1, rim);
    for (let y = yr - h + 2; y < yr; y++) {
      if (((x + y) & 7) === 0 || ((x - y) & 7) === 0) s.px(x, y, rib);
      else if (night) {
        // lit from inside: a violet glow, thicker low down
        if (bayer4(x, y) < (y > yr - 6 ? 0.5 : 0.25)) s.px(x, y, P.nextgenDark);
      } else if (v < 0.42 && v > 0.08 && y < yr - h + 4) {
        // the sky's sheen on the glass, on the side towards the light
        s.px(x, y, sheen);
      }
    }
  };
  const vOf = (x: number): number =>
    ((((x - g.cx) % VAULT) + VAULT) % VAULT) / VAULT;
  for (let x = 0; x < corner - 4; x++) column(x, top, vaultAt(g, x), vOf(x));
  const e = endFor(g);
  const T = END_PROFILE.TOP;
  const start = Math.ceil(e.xA + e.lean * T) + 2;
  for (let x = Math.max(start, corner); x < g.w; x++) {
    const u = Math.max(
      0,
      (x - e.xA - e.lean * T) / (e.m + e.lean * T * e.grow),
    );
    const z = 1 + e.grow * u;
    const v = (u / 34) % 1;
    const h = Math.round(z * VAULT_H * 0.8 * Math.sqrt(Math.sin(Math.PI * v)));
    column(x, endTopAt(e, x, T), h, v);
  }
}

/**
 * A hologram over the side stand, left of the board (monitors only; not at tier 7, whose
 * sky is the drone show's), carried by two camera drones on tethers: rows of teal light
 * with a pixel of sky between them (no solid field, so it reads as projected light in the
 * world, not a panel of the interface), the first board's words in white light outlined in
 * teal, corner brackets, a magenta bar; a bright line sweeps down it. It keeps to the far
 * left, ending short of a sixth of the width: the question board (DOM, over the canvas)
 * starts about a sixth of the way in at 1920 x 1080 and 1536 x 864.
 */
function holoScreen(s: Surface, p: Paint, life: Life, corner: number): void {
  const { g, S } = p;
  if (g.w < 560 || p.tier >= 7) return;
  const top = g.F - STAND.roofTop;
  const W = Math.min(156, Math.max(96, Math.round(g.w * 0.15) - 2));
  const H = 30;
  const x0 = 12;
  const y0 = top - VAULT_H - 14 - H;
  if (y0 < 16 || x0 + W > corner - 8) return;
  // the field: scanlines of teal light, every fourth a brighter one, sky between them
  for (let y = y0 + 1; y < y0 + H - 1; y += 2) {
    s.hline(x0 + 1, y, W - 2, (y - y0) % 8 === 1 ? P.away : P.awayDark);
  }
  const word = ((p.labels.boards ?? [])[0] ?? "").toUpperCase();
  if (word) {
    let scale = 2;
    if (measureText(word, { font: FONT_5x7, scale }) > W - 12) scale = 1;
    const o = { font: FONT_5x7, scale, outline: P.awayDark };
    const tw = measureText(word, o);
    const tmp = new Surface(tw + 4, 7 * scale + 4);
    drawText(tmp, word, 1, 1, P.white, o);
    const tx = x0 + ((W - tw) >> 1) - 1;
    const ty = y0 + ((H - 7 * scale) >> 1) - 3;
    for (let y = 0; y < tmp.h; y++) {
      for (let x = 0; x < tmp.w; x++) {
        const c = tmp.get(x, y);
        if (c === TRANSPARENT) continue;
        s.px(tx + x, ty + y, c === P.white && (y & 1) === 1 ? P.skyLow : c);
      }
    }
  }
  s.hline(x0 + 40, y0 + H - 4, W - 80, P.nextgenLight);
  const b = P.skyLow;
  for (const [cx, cy, dx, dy] of [
    [x0, y0, 1, 1],
    [x0 + W - 1, y0, -1, 1],
    [x0, y0 + H - 1, 1, -1],
    [x0 + W - 1, y0 + H - 1, -1, -1],
  ] as const) {
    for (let k = 0; k < 6; k++) s.px(cx + dx * k, cy, b);
    for (let k = 1; k < 5; k++) s.px(cx, cy + dy * k, b);
  }
  // the two drones that carry it, hovering a little over its top corners, on tethers
  const dxs = [x0 + 14, x0 + W - 15];
  const dy = y0 - 14;
  const c: DroneColors = {
    rotor: S(P.mist),
    arm: S(P.steel),
    top: S(P.steelHi),
    body: S(P.slate),
    leg: S(P.night),
  };
  life.movers.push({
    far(sf: Surface, t: number): void {
      // a bright line sweeping down the screen, 2.4 s a pass
      const k = Math.floor(((t % 2.4) / 2.4) * (H + 10)) - 5;
      if (k >= 1 && k < H - 1) {
        for (let x = x0 + 2; x < x0 + W - 2; x += 2) sf.px(x, y0 + k, P.white);
      }
      for (let i = 0; i < 2; i++) {
        const bob = Math.floor(t * 2 + i) & 1;
        const x = dxs[i];
        const y = dy + bob;
        for (let yy = y + 6; yy < y0; yy += 2) sf.px(x, yy, c.top);
        const blink = Math.floor(t * 1.5 + i) % 3 === 0;
        drawDrone(sf, x, y, Math.floor(t * 12 + i) & 1, blink, c);
      }
    },
  });
}

/**
 * The ribbon of light along the roofs (the side stand's fascia, then the end's as it steps
 * down towards us): a pulse of white running along it, one every 56 px, 30 px a second.
 */
function ribbon(p: Paint, life: Life, corner: number): void {
  const { g } = p;
  const e = endFor(g);
  const top = g.F - STAND.roofTop + ROOF_RIBBON;
  const xs: number[] = [];
  const ys: number[] = [];
  for (let x = 0; x < corner - 4; x++) {
    xs.push(x);
    ys.push(top);
  }
  const T = END_PROFILE.TOP;
  const start = Math.ceil(e.xA + e.lean * T) + 2;
  for (let x = Math.max(start, corner); x < g.w; x++) {
    const y = endTopAt(e, x, T - ROOF_RIBBON - 0.5);
    if (y < 0) continue;
    xs.push(x);
    ys.push(y);
  }
  const X = Int16Array.from(xs);
  const Y = Int16Array.from(ys);
  life.movers.push({
    far(s: Surface, t: number): void {
      const off = Math.floor(t * 30);
      for (let i = 0; i < X.length; i++) {
        const k = (((i - off) % 56) + 56) % 56;
        if (k > 5) continue;
        s.px(X[i], Y[i], k > 1 ? P.white : P.nextgenLight);
      }
    },
  });
}

interface Drone {
  x: number;
  y: number;
  range: number;
  speed: number;
  phase: number;
}

/** Where the camera drones hover: over the stand, one over the goal. */
function drones(p: Paint, life: Life): void {
  const { g, S } = p;
  const F = g.F;
  const list: Drone[] = [
    { x: sx(g, -58), y: F - 104, range: 16, speed: 0.5, phase: 0 },
    { x: sx(g, 6), y: F - 152, range: 22, speed: 0.33, phase: 2 },
    {
      x: g.goalX + Math.round(6 * g.k),
      y: F - 92,
      range: 6,
      speed: 0.7,
      phase: 4,
    },
  ];
  if (p.tier >= 5) {
    list.push({ x: sx(g, -96), y: F - 170, range: 14, speed: 0.4, phase: 1 });
  }
  // two broadcast drones low over the pitch, where a phone sees them under the question
  // board: one over the edge of the box, one behind the goal line in the photographers'
  // place (it films the goal), each with a ring of light
  const low: Drone[] = [
    {
      x: g.goalX - Math.round(44 * g.k),
      y: g.gy - 74,
      range: 10,
      speed: 0.45,
      phase: 3,
    },
    {
      // over the first photographer's spot (pitch.ts), a little in, so a phone sees it whole
      x: g.goalX + Math.round(17 * g.k) - 4,
      y: g.gy + 2,
      range: 2,
      speed: 0.9,
      phase: 5,
    },
  ];
  const ln = low.length;
  const lxs = Float32Array.from(low, (d) => d.x);
  const lys = Int16Array.from(low, (d) => d.y);
  const lrange = Float32Array.from(low, (d) => d.range);
  const lspeed = Float32Array.from(low, (d) => d.speed);
  const lphase = Float32Array.from(low, (d) => d.phase);
  const shadow = S(P.grassDeep);
  const shadowY = g.gy + 19;
  const n = list.length;
  const xs = Float32Array.from(list, (d) => d.x);
  const ys = Int16Array.from(list, (d) => d.y);
  const range = Float32Array.from(list, (d) => d.range);
  const speed = Float32Array.from(list, (d) => d.speed);
  const phase = Float32Array.from(list, (d) => d.phase);
  const c: DroneColors = {
    rotor: S(P.mist),
    arm: S(P.steel),
    top: S(P.steelHi),
    body: S(P.slate),
    leg: S(P.night),
    shell: S(P.white),
  };
  life.movers.push({
    far(s: Surface, t: number): void {
      const tt = Math.floor(t * 8) / 8;
      for (let i = 0; i < n; i++) {
        const x = Math.round(
          xs[i] + Math.sin(tt * speed[i] + phase[i]) * range[i],
        );
        const y = ys[i] + (Math.floor(t * 2 + phase[i]) & 1);
        const blink = Math.floor(t * 1.5 + phase[i]) % 3 === 0;
        drawDrone(s, x, y, Math.floor(t * 12 + i) & 1, blink, c);
      }
      for (let i = 0; i < ln; i++) {
        const x = Math.round(
          lxs[i] + Math.sin(tt * lspeed[i] + lphase[i]) * lrange[i],
        );
        const y = lys[i] + (Math.floor(t * 2 + lphase[i]) & 1);
        // the goal's drone hovers over the grass: its shadow under it
        if (i === 1) s.hline(x - 4, shadowY, 9, shadow);
        const blink = Math.floor(t * 1.5 + lphase[i]) % 3 === 0;
        drawBigDrone(s, x, y, Math.floor(t * 12 + i) & 1, blink, i === 1, c);
      }
    },
  });
}

/**
 * A broadcast drone, 23 x 10, its middle column `x`, its top row `y`: two rotors spinning as
 * discs of light (two frames), a white shell with an ink outline so it stands off a busy
 * crowd, a ring of cyan light round its waist, a camera under it with a lens of light
 * (facing left, at the goal, when `left`), a tally lamp blinking.
 */
export function drawBigDrone(
  s: Surface,
  x: number,
  y: number,
  frame: number,
  blink: boolean,
  left: boolean,
  c: DroneColors,
): void {
  // the rotors: a disc of light each, the blades' blur turning in it
  for (const r of [x - 8, x + 8]) {
    s.hline(r - 3, y, 7, P.skyMid);
    if (frame === 0) s.hline(r - 2, y, 2, P.white);
    else s.hline(r + 1, y, 2, P.white);
    s.px(r, y + 1, c.arm);
  }
  s.hline(x - 8, y + 2, 3, c.arm);
  s.hline(x + 6, y + 2, 3, c.arm);
  // the shell, outlined in ink
  s.hline(x - 4, y + 1, 9, P.ink);
  s.vline(x - 5, y + 2, 5, P.ink);
  s.vline(x + 5, y + 2, 5, P.ink);
  s.hline(x - 4, y + 7, 9, P.ink);
  s.hline(x - 4, y + 2, 9, c.shell ?? c.top);
  s.hline(x - 4, y + 3, 9, c.top);
  s.hline(x - 4, y + 4, 9, P.skyLow);
  s.px(x - 4, y + 4, P.white);
  s.px(x - 3, y + 4, P.white);
  s.hline(x - 4, y + 5, 9, c.top);
  s.hline(x - 4, y + 6, 9, c.rotor);
  s.px(x - 3, y + 2, P.white);
  s.px(x + 3, y + 3, blink ? P.ledRed : c.top);
  // the camera under it, its lens of light towards what it films
  const cx = left ? x - 3 : x - 1;
  s.rect(cx - 1, y + 7, 5, 3, P.ink);
  s.hline(cx, y + 8, 3, c.body);
  s.px(left ? cx : cx + 2, y + 8, P.skyLow);
  s.px(left ? cx - 1 : cx + 3, y + 8, P.white);
}

interface DroneColors {
  rotor: Color;
  arm: Color;
  top: Color;
  body: Color;
  leg: Color;
  /** The broadcast drone's white shell. */
  shell?: Color;
}

/**
 * A camera drone, 13 x 6, its middle column `x`, its top row `y`: two rotors blurring
 * (two frames), the arms, a body lit on top, the camera's cyan lens, a tally lamp.
 */
export function drawDrone(
  s: Surface,
  x: number,
  y: number,
  frame: number,
  blink: boolean,
  c: DroneColors,
): void {
  if (frame === 0) {
    s.hline(x - 6, y, 4, c.rotor);
    s.hline(x + 3, y, 4, c.rotor);
  } else {
    s.hline(x - 5, y, 2, c.rotor);
    s.hline(x + 4, y, 2, c.rotor);
    s.px(x - 7, y, c.rotor);
    s.px(x + 7, y, c.rotor);
  }
  s.px(x - 4, y + 1, c.arm);
  s.px(x + 4, y + 1, c.arm);
  s.hline(x - 4, y + 2, 2, c.arm);
  s.hline(x + 3, y + 2, 2, c.arm);
  s.hline(x - 2, y + 2, 5, c.top);
  s.hline(x - 2, y + 3, 5, c.body);
  s.hline(x - 1, y + 4, 3, c.body);
  s.px(x - 1, y + 4, P.skyLow);
  s.px(x, y + 4, P.white);
  s.px(x + 2, y + 3, blink ? P.ledRed : c.body);
  s.px(x - 2, y + 5, c.leg);
  s.px(x + 2, y + 5, c.leg);
}

// ---------------------------------------------------------------------------
// Tier 5 up: holographic flags, LED banners, light sticks
// ---------------------------------------------------------------------------

function dressArena(s: Surface, p: Paint, life: Life, corner: number): void {
  const { g, S } = p;
  const F = g.F;
  const st = STAND;
  const [a, b] = crowdColors(p, false);
  const top = F - st.roofTop;
  // holographic flags on slim emitters: on the side roof's pillars between the vaults, and
  // stepping down the end's roof
  const fx: number[] = [];
  const fy: number[] = [];
  const first = g.cx - VAULT * Math.ceil(g.cx / VAULT);
  for (let x = first; x < corner - 16; x += VAULT) {
    if (x < 12) continue;
    fx.push(x);
    fy.push(top - 24);
  }
  const e = endFor(g);
  const T = END_PROFILE.TOP;
  for (let x = Math.ceil(e.xA + e.lean * T) + 14; x < g.w; x += 52) {
    fx.push(x);
    fy.push(endTopAt(e, x, T) - 24);
  }
  for (let i = 0; i < fx.length; i++) {
    s.vline(fx[i], fy[i], 22, S(P.steelHi));
    s.px(fx[i], fy[i] - 1, P.skyLow);
  }
  holoFlags(life, Int16Array.from(fx), Int16Array.from(fy), a, b);

  // LED banners over the balcony
  const words = (p.labels.banners ?? []).map((w) => w.toUpperCase());
  const y = F - st.balcony;
  let x = sx(g, -60);
  for (let i = 0; x < corner - 24; i++) {
    const word = words.length > 0 ? words[i % words.length] : "";
    const bw = word ? measureLamps(word, FONT_3x5) + 14 : 32;
    if (x + bw > corner - 8) break;
    ledBanner(s, p, x, y, bw, i, word);
    x += bw + 44;
  }

  // light sticks waved in the lower tier
  const n = Math.round(g.w / 40);
  const lx: number[] = [];
  const ly: number[] = [];
  for (let k = 0; k < n; k++) {
    const sx0 = Math.floor(rnd(p, k, 50, 51) * g.w);
    if (sx0 > corner - 14) continue;
    lx.push(sx0);
    ly.push(F - st.lowerTop + 2 + 8 * Math.floor(rnd(p, k, 52, 51) * 5));
  }
  const LX = Int16Array.from(lx);
  const LY = Int16Array.from(ly);
  life.movers.push({
    far(sf: Surface, t: number): void {
      const beat = Math.floor(t * 2.5);
      for (let i = 0; i < LX.length; i++) {
        const c = i % 2 === 0 ? P.skyLow : P.nextgenLight;
        const lean = ((beat + i) % 4) - 1; // -1, 0, 1, 2 (2 is upright)
        const d = lean === 2 ? 0 : lean;
        sf.px(LX[i] + d, LY[i], P.white);
        sf.px(LX[i] + d, LY[i] + 1, c);
        sf.px(LX[i], LY[i] + 2, c);
        sf.px(LX[i], LY[i] + 3, c);
      }
    },
  });
}

/**
 * Flags of light, 12 x 8, beside each emitter's top: rippling like cloth (the same wave
 * as a real flag's), every other row a dim scanline, a glitch now and then that shifts a
 * band of it a pixel.
 */
function holoFlags(
  life: Life,
  xs: Int16Array,
  ys: Int16Array,
  a: Color,
  b: Color,
): void {
  const aDim = scanOf(a, P.nextgenDark);
  const bDim = scanOf(b, P.nextgenDark);
  life.movers.push({
    far(s: Surface, t: number): void {
      const frame = Math.floor(t * 3);
      for (let f = 0; f < xs.length; f++) {
        const x0 = xs[f] + 2;
        const top = ys[f];
        const glitch = hash2(f, Math.floor(t * 4), 77) < 0.04;
        for (let i = 0; i < 12; i++) {
          const k = (((i - ((frame + f) % 3) * 2) % 6) + 6) % 6;
          const dy = i < 2 ? 0 : k < 2 ? 0 : k < 4 ? 1 : k < 5 ? 2 : 1;
          const first = i < 6 === (f % 2 === 0);
          for (let r = 0; r < 8; r++) {
            const gx = glitch && r >= 3 && r < 5 ? 1 : 0;
            const c = first ? (r & 1 ? aDim : a) : r & 1 ? bDim : b;
            s.px(x0 + i + gx, top + dy + r, c);
          }
        }
      }
    },
  });
}

/** An LED banner hung over the balcony rail: dark glass, words in lamps, a lit hem. */
function ledBanner(
  s: Surface,
  p: Paint,
  x: number,
  y: number,
  bw: number,
  i: number,
  word: string,
): void {
  const { S } = p;
  const look = HOLO_LOOKS[i % HOLO_LOOKS.length];
  s.rect(x, y, bw, 16, look.bg);
  s.hline(x, y, bw, S(P.steelHi));
  s.hline(x, y + 15, bw, look.fg);
  s.vline(x, y + 1, 14, S(P.slate));
  s.vline(x + bw - 1, y + 1, 14, S(P.slate));
  if (word) {
    let tx = x + Math.floor((bw - measureLamps(word, FONT_3x5)) / 2);
    tx -= tx & 1;
    drawLamps(s, word, tx, y + 3, look.fg, { font: FONT_3x5, bg: look.bg });
  } else {
    for (let k = x + 4; k < x + bw - 4; k += 2) s.px(k, y + 8, look.fg);
  }
}

// ---------------------------------------------------------------------------
// Tier 6 up: the dome, lasers; tier 7: the drone light show
// ---------------------------------------------------------------------------

/**
 * The dome over the final's arena: slim ribs rising from the roofs and fanning out over
 * the sky (none straight up the middle, where one read as a pole), lamps along them after
 * dark. The sky shows between them; no rings across them, so the sky stays quiet.
 */
function dome(s: Surface, p: Paint, corner: number): void {
  const { g, S } = p;
  const e = endFor(g);
  const T = END_PROFILE.TOP;
  const top = g.F - STAND.roofTop;
  const moon = moonPosition(g.w, g.B, g.boardShrunkY);
  const mx = Math.round(g.w * 0.86);
  const my = Math.max(moon.r + 4, top - 24 - moon.r - 4);
  const mr = moon.r + 4;
  const rib = S(P.steel);
  const ribLit = S(P.mist);
  const clear = (x: number, y: number): boolean =>
    (x - mx) * (x - mx) + (y - my) * (y - my) > mr * mr &&
    s.get(x, y) === TRANSPARENT;
  const roofAt = (x: number): number =>
    x < corner ? top - 1 : endTopAt(e, x, T) - 1;
  const endStart = Math.ceil(e.xA + e.lean * T) + 2;
  const step = 112;
  for (let b = g.cx - step * 8; b < g.w + step; b += step) {
    if (b < 4 || b > g.w - 4 || b === g.cx) continue;
    if (b >= corner - 8 && b < endStart + 8) continue;
    const yb = roofAt(b);
    if (yb < 8) continue;
    const xt = g.cx + (b - g.cx) * 1.9;
    for (let y = yb; y >= 0; y--) {
      const u = (yb - y) / yb;
      const x = Math.round(b + (xt - b) * u * u);
      if (clear(x, y)) s.px(x, y, rib);
      if (clear(x - 1, y)) s.px(x - 1, y, ribLit);
      if (p.lamps && (yb - y) % 22 === 11 && clear(x + 1, y)) {
        s.px(x + 1, y, P.skyLow);
        s.px(x, y, P.white);
      }
    }
  }
}

/** Lasers from emitters on the roofs, sweeping, drawn in the sky behind the stands. */
function lasers(life: Life, at: readonly (readonly [number, number])[]): void {
  const X = Int16Array.from(at, (a) => a[0]);
  const Y = Int16Array.from(at, (a) => a[1]);
  const core = [P.nextgenLight, P.skyLow, P.white, P.ledGreen, P.nextgenLight];
  const glow = [P.nextgen, P.skyMid, P.skyMid, P.grassDark, P.nextgen];
  const n = X.length;
  life.movers.push({
    sky(s: Surface, t: number): void {
      const tt = Math.floor(t * 10) / 10;
      for (let i = 0; i < n; i++) {
        const ang =
          Math.sin(tt * 0.5 + i * 2.1) * 0.5 + (i - (n - 1) / 2) * 0.32;
        const dx = Math.sin(ang);
        const dy = -Math.cos(ang);
        const c = core[i % core.length];
        const h = glow[i % glow.length];
        for (let j = 2; j < 320; j++) {
          const x = Math.round(X[i] + dx * j);
          const y = Math.round(Y[i] + dy * j);
          if (y < 0) break;
          if (j > 200 && (j & 1) === 1) continue;
          s.px(x, y, c);
          s.px(x - 1, y, h);
          s.px(x + 1, y, h);
          if (j < 140 && bayer4(x, y) < 0.25) {
            s.px(x - 2, y, h);
            s.px(x + 2, y, h);
          }
        }
        s.px(X[i], Y[i] - 1, P.white);
        s.px(X[i] + 1, Y[i] - 1, c);
      }
    },
  });
}

/** Drones per group in the light show. */
const SHOW_N = 32;

/**
 * The drone light show (tier 7): groups of drones over the roof, each drone a point of
 * light with a stepped halo, flying between shapes every 3 s (a ring, a star, a wave, a
 * football), the shapes' colours turning with them.
 */
function droneShow(life: Life, z: Zone): void {
  const groups = Math.max(1, Math.min(4, Math.round(z.w / 260)));
  const cx = new Float32Array(groups);
  for (let k = 0; k < groups; k++) cx[k] = z.x + ((k + 0.5) / groups) * z.w;
  const cy = z.y + z.h / 2;
  const R = Math.max(14, Math.min(z.h * 0.5, z.w / groups / 3));
  const cores = [P.skyLow, P.nextgenLight, P.white, P.ledGreen];
  const halos = [P.skyMid, P.nextgenDark, P.mist, P.grassDark];
  const SHAPES = 4;
  const HOLD = 3;
  const MOVE = 0.9;
  life.movers.push({
    sky(s: Surface, t: number): void {
      const tt = Math.floor(t * 12) / 12;
      for (let k = 0; k < groups; k++) {
        const cyc = tt / HOLD + k * 1.5;
        const n = Math.floor(cyc);
        const into = (cyc - n) * HOLD;
        const v = into < HOLD - MOVE ? 0 : (into - (HOLD - MOVE)) / MOVE;
        const e = v * v * (3 - 2 * v);
        const a = n % SHAPES;
        const b = (n + 1) % SHAPES;
        const ca = cores[(n + k) % cores.length];
        const cb = cores[(n + k + 1) % cores.length];
        const core = e < 0.5 ? ca : cb;
        const halo = halos[cores.indexOf(core)];
        for (let i = 0; i < SHOW_N; i++) {
          shapeAt(a, i, R, tt);
          const ax = sx0;
          const ay = sy0;
          shapeAt(b, i, R, tt);
          const x = Math.round(cx[k] + ax + (sx0 - ax) * e);
          const y = Math.round(cy + ay + (sy0 - ay) * e);
          // a point of light: its glow a plus round a bright core, twinkling
          const tw = hash2(i, Math.floor(t * 6), k + 9) < 0.1;
          s.px(x - 1, y, tw ? halo : core);
          s.px(x + 1, y, tw ? halo : core);
          s.px(x, y - 1, halo);
          s.px(x, y + 1, halo);
          s.px(x, y, P.white);
        }
      }
    },
  });
}

/** `shapeAt` writes the point here (no allocation). */
let sx0 = 0;
let sy0 = 0;

/** The `i`th drone's place in shape `shape`, radius `R`, round (0, 0). */
function shapeAt(shape: number, i: number, R: number, t: number): void {
  const f = i / SHOW_N;
  if (shape === 0) {
    // a ring
    const ang = f * Math.PI * 2 + t * 0.4;
    sx0 = Math.cos(ang) * R;
    sy0 = Math.sin(ang) * R;
  } else if (shape === 1) {
    // a five-pointed star, along its edges
    const edge = Math.floor(f * 10);
    const u = f * 10 - edge;
    const r0 = edge % 2 === 0 ? R : R * 0.42;
    const r1 = edge % 2 === 0 ? R * 0.42 : R;
    const a0 = (edge / 10) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((edge + 1) / 10) * Math.PI * 2 - Math.PI / 2;
    sx0 = Math.cos(a0) * r0 * (1 - u) + Math.cos(a1) * r1 * u;
    sy0 = Math.sin(a0) * r0 * (1 - u) + Math.sin(a1) * r1 * u;
  } else if (shape === 2) {
    // a wave across
    sx0 = (f - 0.5) * R * 2.8;
    sy0 = Math.sin(f * Math.PI * 4 + t * 3) * R * 0.35;
  } else {
    // a football: its outline, and a pentagon in its middle
    if (i < 18) {
      const ang = (i / 18) * Math.PI * 2;
      sx0 = Math.cos(ang) * R;
      sy0 = Math.sin(ang) * R;
    } else {
      const q = i - 18;
      const corner = Math.floor(q / 2);
      const u = (q % 2) * 0.5;
      const a0 = (corner / 5) * Math.PI * 2 - Math.PI / 2;
      const a1 = ((corner + 1) / 5) * Math.PI * 2 - Math.PI / 2;
      const r = R * 0.38;
      sx0 = (Math.cos(a0) * (1 - u) + Math.cos(a1) * u) * r;
      sy0 = (Math.sin(a0) * (1 - u) + Math.sin(a1) * u) * r;
    }
  }
}

// ---------------------------------------------------------------------------
// Glowing confetti (tier 7, in front of everything): in place of ticker tape
// ---------------------------------------------------------------------------

const GLOW: readonly Color[] = [
  P.nextgenLight,
  P.skyLow,
  P.white,
  P.ledGreen,
  P.goldLight,
];
const GLOW_HALO: readonly Color[] = [
  P.nextgen,
  P.skyMid,
  P.mist,
  P.grassLight,
  P.gold,
];

/**
 * Glowing confetti over the whole picture: about one piece for every 1040 px, falling at
 * 18 to 38 px a second and swaying 4 px; each a bright 2 x 2 chip with a pixel of its glow
 * trailing above it, tumbling to an edge-on sliver and back.
 */
export function drawGlowTape(s: Surface, t: number, seed: number): void {
  const n = Math.round((s.w * s.h) / 1040);
  const tt = Math.floor(t * 10) / 10;
  for (let i = 0; i < n; i++) {
    const x0 = hash2(i, 1, seed) * s.w;
    const speed = 18 + hash2(i, 2, seed) * 20;
    const y =
      Math.floor((hash2(i, 3, seed) * (s.h + 40) + tt * speed) % (s.h + 40)) -
      20;
    const x = Math.floor(x0) + Math.round(Math.sin(tt * 2 + i) * 4);
    const c = GLOW[i % GLOW.length];
    const h = GLOW_HALO[i % GLOW.length];
    switch ((Math.floor(tt * 5) + i) % 4) {
      case 0:
        s.rect(x, y, 2, 2, c);
        s.px(x, y - 1, h);
        break;
      case 1:
        s.px(x, y, c);
        s.px(x + 1, y + 1, c);
        s.px(x + 1, y, h);
        break;
      case 2:
        s.hline(x, y, 2, h);
        break;
      default:
        s.px(x + 1, y, c);
        s.px(x, y + 1, c);
        s.px(x, y, h);
    }
  }
}

// ---------------------------------------------------------------------------
// The end behind the goal: colours along its profile, and the corner
// ---------------------------------------------------------------------------

export type EndColour = (
  hu: number,
  u: number,
  h: number,
  z: number,
  x: number,
  y: number,
) => Color;

/** The arena's end, part by part from its foot up to the roof's lit edge (end.ts's frame). */
export function arenaEndColors(p: Paint): EndColour {
  const { S } = p;
  const { WALL, LOW, WALK, UP, BACK, UNDER, FASCIA, TOP, ROW, AISLE } =
    END_PROFILE;
  const lamps = p.lamps;
  const bg = HOLO_LOOKS.map((l) => l.bg);
  const fg = HOLO_LOOKS.map((l) => l.fg);
  const dim = HOLO_LOOKS.map((l) => scanOf(l.fg, l.bg));
  const c = {
    white: S(P.white),
    hi: S(P.steelHi),
    mist: S(P.mist),
    steel: S(P.steel),
    slate: S(P.slate),
    night: S(P.night),
    ink: S(P.ink),
    haze: S(P.haze),
    glass: S(P.skyLow),
    glassLow: S(P.skyMid),
    low: S(P.concreteDark),
    noseLow: S(P.steel),
    noseUp: S(mix(P.night, P.slate, 0.6)),
  };
  const seats = (
    k: number,
    h: number,
    z: number,
    u: number,
    seat: Color,
    nose: Color,
  ): Color => {
    const r = Math.floor(k / ROW);
    const hb = h - (h / z - k + r * ROW) * z;
    const a = (u + 40) % AISLE;
    if (a > AISLE - 4) {
      const st = Math.floor(hb) % 4;
      if (st === 0)
        return lamps && Math.floor(hb) % 8 === 0 ? P.skyLow : c.mist;
      return st === 1 ? c.steel : c.slate;
    }
    return hb < 1 ? nose : seat;
  };
  const BW = 26;
  return (hu, u, h, z, x, y) => {
    // the far end's side, seen edge on: a glass screen with a light down it
    if (u < 1.5 && hu < FASCIA)
      return hu < WALL ? c.slate : u < 0.75 ? c.hi : P.skyMid;
    if (hu < WALL) {
      if (hu < 1) return c.ink;
      if (hu < 2) return P.skyMid;
      if (hu >= WALL - 1) return c.mist;
      if (hu >= WALL - 2) return c.night;
      // holographic panels: scanlined blocks of light along the middle
      const k = Math.floor(u / BW);
      const i =
        ((k % HOLO_LOOKS.length) + HOLO_LOOKS.length) % HOLO_LOOKS.length;
      const along = u - k * BW;
      if (along < 1) return P.ink;
      const row = Math.floor(hu - 2);
      if (row >= 3 && row < 10 && along > 4 && along < BW - 3) {
        if (Math.floor((along - 4) / 4) % 3 !== 2)
          return row & 1 ? dim[i] : fg[i];
      }
      return bg[i];
    }
    if (hu < WALK) return seats(hu - LOW, h, z, u, c.low, c.noseLow);
    if (hu < UP) {
      // the walkway between the tiers: a glass lip lit along its rail
      const d = UP - hu;
      return d < 1 ? c.white : d < 2 ? P.skyLow : d < 4 ? c.slate : c.night;
    }
    if (hu < BACK) return seats(hu - UP, h, z, u, c.night, c.noseUp);
    if (hu < UNDER) return c.night;
    if (hu < FASCIA) {
      // under the roof: strip lights
      const along = u % 14;
      if (along < 6 && hu < UNDER + 1.5) return lamps ? P.skyLow : c.steel;
      return c.night;
    }
    // the roof's fascia: a white edge, glass with the sky in it, the ribbon, the lip
    const d = TOP - hu;
    if (d < 1) return c.white;
    if (d < 6) {
      if (u % 21 < 1) return c.mist;
      const k = (((x + y * 2) % 24) + 24) % 24;
      return k < 3 ? c.haze : d < 3 ? c.glass : c.glassLow;
    }
    if (d < 7) return P.nextgenLight;
    if (d < 8) return P.nextgen;
    if (d < 9) return c.hi;
    if (d < 10) return c.mist;
    if (d < 11) return c.steel;
    return c.slate;
  };
}

/**
 * The corner between the side stand and the end, at the foot of the gap: a glass
 * concourse, its rail lit cyan, a lamp over the gate (rows `B` to `F`).
 */
export function paintArenaCorner(s: Surface, p: Paint, e: EndGeo): void {
  const { g, S } = p;
  const { xA, y0, m, lean } = e;
  const floor = S(P.steel);
  const floorDark = S(P.slate);
  const glass = S(P.skyMid);
  const post = S(P.mist);
  for (let Y = g.B; Y < g.F; Y++) {
    const xs = Y <= y0 ? xA + lean * (y0 - Y) : xA + m * (Y - y0);
    for (let X = e.corner; X < Math.ceil(xs) && X < g.w; X++) {
      const d = Y - g.B;
      let c = d < 2 ? floorDark : d < 3 ? floor : floorDark;
      if (d >= 3) {
        if (d === 4) c = P.skyLow;
        else if (d === 5) c = post;
        else if (d > 5 && (X - e.corner) % 8 === 0) c = post;
        else if (d > 5 && d < 9) c = glass;
        else if (d > 5) c = d > 12 ? floorDark : floor;
      }
      s.px(X, Y, c);
    }
  }
  if (p.lamps) {
    const lx = e.corner + 6;
    if (lx < g.w) {
      s.px(lx, g.B + 1, P.skyLow);
      s.px(lx + 1, g.B + 1, P.white);
    }
  }
}

// ---------------------------------------------------------------------------
// The near side (tiers 4 to 7)
// ---------------------------------------------------------------------------

/** The arena's near side: replaces the stadium's in near.ts for NEXT-GEN. */
export function paintArenaNear(s: Surface, p: Paint, life: Life): void {
  const { g, S, tier } = p;
  const N = g.N;
  const H = g.h;
  grass(s, p, S, N + 1, N + 4, 0.1);
  if (p.lamps) s.dither(0, N - 2, g.w, 4, P.nightGlow, 0.25);

  // the slim backs of the boards: dark glass on slim posts, a status lamp on each
  const by = N + 4;
  const bh = 16;
  s.rect(0, by, g.w, bh, S(P.night));
  // a strip of cyan light along the track's edge, on the boards' tops
  s.hline(0, by, g.w, P.skyLow);
  s.hline(0, by + 1, g.w, S(P.slate));
  s.hline(0, by + bh - 3, g.w, S(P.slate));
  for (let x = (g.cx % 48) - 48; x < g.w; x += 48) {
    s.vline(x, by + 2, bh - 2, S(P.ink));
    s.vline(x + 1, by + 2, bh - 2, S(P.steel));
    s.hline(x + 20, by + 6, 2, P.skyLow);
  }
  s.rect(0, by + bh, g.w, 2, S(P.ink));
  // their light spilling under them, dotted
  for (let x = 0; x < g.w; x += 2) s.px(x, by + bh - 2, P.skyMid);

  // the apron: smart turf, a faint grid in it
  const ay = N + 22;
  const ab = ay + 26;
  s.rect(0, ay, g.w, ab - ay, S(P.grassDeep));
  s.hline(0, ay, g.w, S(P.grassDark));
  for (let y = ay + 3; y < ab; y += 6) {
    for (let x = (g.cx % 8) - 8; x < g.w; x += 8) s.px(x, y, S(P.grassDark));
  }
  for (let x = 0; x < g.w; x += 3) {
    const r = hash2(x, ay, p.seed + 3);
    if (r < 0.2)
      s.px(x, ay + 2 + (Math.floor(r * 70) % (ab - ay - 3)), S(P.grassDark));
  }
  for (const off of [-62, -34]) glassDugout(s, p, sx(g, off), ay);
  // ball kids on hover stools
  for (const off of [-72, 22]) {
    const kx = sx(g, off);
    s.rect(kx + 2, ay + 20, 8, 2, S(P.white));
    s.hline(kx + 2, ay + 21, 8, S(P.mist));
    s.hline(kx + 3, ay + 22, 6, P.skyLow);
    s.dither(kx + 2, ay + 23, 8, 2, P.skyMid, 0.5);
    ballKid(s, p, kx, ay + 20, S(off < 0 ? P.skinA : P.skinC));
  }
  // the steward, a light band on his dark jacket, and his robot dog
  const stx = sx(g, 46);
  drawSteward(
    s,
    stx,
    ab - 1,
    S(P.slate),
    P.skyLow,
    S(P.skinB),
    S(P.night),
    S(P.night),
  );
  life.dog = {
    roam: false,
    x0: stx + 14,
    x1: 0,
    y: ab - 1,
    colors: robotDog(S),
  };

  // a glass barrier lit along its rail, then the near crowd
  s.hline(0, ab, g.w, P.skyLow);
  s.hline(0, ab + 1, g.w, S(P.haze));
  s.hline(0, ab + 2, g.w, S(P.skyMid));
  s.hline(0, ab + 3, g.w, S(P.slate));
  s.rect(0, ab + 4, g.w, H - ab - 4, S(P.night));
  crowdBacks(s, p, ab + 4, H, 1, 0.25);
  if (tier === 6) paintPedestal(s, p);
}

/**
 * NEXT-GEN's photographer crouched behind the goal line (today's pose, pitch.ts): a dark
 * jacket with a seam of light down it, a visor of light across his eyes, a camera whose
 * lens glows. h hair, s skin, z skin shade, v visor, B jacket, b its shade, g the seam,
 * j sleeve, t trousers, e shoes, k camera, K its top, l lens barrel, L the lens's light.
 */
const SNAPPER_NG = `
.........hhh......
........hhhhh.....
........vvhhhh....
..LKKKKKsshhh.....
.llllllkkzjgBB....
.lllllkkkjBgBBB...
..LkkkkkssjBBgBb..
........jjBBBgBb..
.........jBBBBgb..
........tttttjjb..
.......tttttttt...
......tt...tttt...
......tt...ttt....
.....eee...tttttee
`;
let snapperNg: Sprite | null = null;

/**
 * NEXT-GEN's photographers (pitch.ts hands them over, tiers 3 to 7), at today's spots: the
 * first, behind the goal line, is a broadcast drone from tier 4 (a mover, `drones`), the
 * other a photographer in a dark jacket trimmed with light and a visor.
 */
export function paintArenaPhotographers(
  s: Surface,
  p: Paint,
  spots: readonly (readonly [number, number])[],
): void {
  const { S } = p;
  snapperNg ??= sprite(SNAPPER_NG, "hszvBbgjtekKlL");
  const sp = snapperNg;
  for (let i = 0; i < spots.length; i++) {
    if (i === 0 && p.tier >= 4) continue;
    const [x, y] = spots[i];
    const jacket = i === 0 ? P.night : P.slate;
    const cols = [
      S(pick(HAIR, rnd(p, i, 3, 61))),
      S(P.skinB),
      S(P.skinBShade),
      P.skyLow,
      S(jacket),
      S(shade(jacket, -0.3)),
      i === 0 ? P.skyLow : P.nextgenLight,
      S(P.night),
      S(P.ink),
      S(P.ink),
      S(P.ink),
      S(P.slate),
      S(P.steel),
      P.skyLow,
    ];
    s.hline(x - 5, y + 1, 14, S(P.grassDeep));
    drawSprite(s, sp, 0, x - 10, y + 1 - sp.h, cols);
  }
}

/**
 * A ball kid seen from behind on his hover stool: NEXT-GEN's dark bib with trims of light
 * on its shoulders and sides, and the band of his visor round the back of his head.
 */
function ballKid(
  s: Surface,
  p: Paint,
  kx: number,
  y: number,
  skin: Color,
): void {
  const { S } = p;
  paintBack(s, kx, y, S(P.hairBrown), S(P.slate), false, skin);
  const top = y - 18;
  s.hline(kx + 2, top + 4, 8, P.skyLow);
  s.px(kx + 9, top + 4, P.skyMid);
  s.hline(kx + 1, top + 8, 3, P.skyLow);
  s.hline(kx + 8, top + 8, 3, P.skyLow);
  s.vline(kx + 2, top + 14, 5, P.skyLow);
  s.vline(kx + 9, top + 14, 5, P.skyMid);
}

/** A robot dog: brushed steel, a cyan eye (the dog's legend "kbwnlm"). */
function robotDog(S: Grade): Color[] {
  return [
    S(P.slate),
    S(P.steel),
    S(P.steelHi),
    P.skyLow,
    S(P.mist),
    S(P.concreteLight),
  ];
}

/**
 * A glass dugout seen from behind: the subs' heads over the seat backs in NEXT-GEN's
 * magenta, under a clear canopy lit cyan along its edge; a light along its kick plate.
 */
function glassDugout(s: Surface, p: Paint, x: number, ay: number): void {
  const { S } = p;
  const W = 52;
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
    s.hline(hx, ay + 8, 6, S(P.nextgen));
  }
  s.rect(x, ay + 9, W, 2, S(P.nextgenDark));
  for (let i = 3; i < W - 3; i += 8) s.hline(x + i, ay + 11, 6, S(P.nextgen));
  // the back: smoked glass, one seam, the kick plate lit
  s.rect(x, ay + 13, W, 7, S(P.slate));
  for (let k = 0; k < 4; k++) s.px(x + 8 + k, ay + 17 - k, S(P.steel));
  s.vline(x + (W >> 1), ay + 13, 7, S(P.night));
  s.hline(x, ay + 20, W, P.nextgenLight);
  s.hline(x, ay + 21, W, S(P.ink));
  // the canopy: a smooth curve, lit along its top, its ends down to the ground
  for (let i = 0; i < W; i++) {
    const e = Math.min(i, W - 1 - i);
    const dy = e === 0 ? 4 : e === 1 ? 2 : e < 4 ? 1 : 0;
    s.px(x + i, ay + dy, P.skyLow);
    if (e >= 2) s.px(x + i, ay + dy + 1, S(P.haze));
  }
  s.vline(x, ay + 5, 17, P.skyLow);
  s.vline(x + W - 1, ay + 5, 17, S(P.skyMid));
}

/**
 * The trophy on a pedestal of white glass by the touchline (tier 6), where HOME's white
 * plinth stands: a lit face, a shaded side and an ink edge so it stands off the dark track,
 * a chalk top with a ring of cyan light round the cup's foot, a band of magenta light
 * across its middle, and a stepped ring of light round its foot.
 */
function paintPedestal(s: Surface, p: Paint): void {
  const { g, S } = p;
  const x = sx(g, 4);
  const top = g.N + 6;
  const h = 24;
  // the ring of light round its foot: a stepped pool on the track, its glow only after dark
  if (p.lamps) s.dither(x - 16, top + h + 2, 34, 3, P.skyMid, 0.25);
  s.hline(x - 14, top + h + 2, 30, P.skyMid);
  s.hline(x - 13, top + h + 1, 28, P.skyLow);
  // the body: white glass, lit on the left, an ink edge all round
  s.rect(x - 11, top - 1, 24, h + 2, S(P.ink));
  s.rect(x - 10, top, 22, h, S(P.steelHi));
  s.vline(x - 10, top, h, S(P.white));
  s.vline(x + 9, top, h, S(P.concreteLight));
  s.vline(x + 10, top, h, S(P.mist));
  s.vline(x + 11, top, h, S(P.steel));
  // a glint slanting down the glass
  for (let k = 0; k < 6; k++) s.px(x - 6 + (k >> 1), top + 5 + k, S(P.white));
  // a band of light across it, in his colour, its seam dark
  s.hline(x - 10, top + 13, 22, P.nextgen);
  s.hline(x - 10, top + 14, 22, P.nextgenLight);
  s.hline(x - 10, top + 15, 22, S(P.concreteLight));
  // the top: a chalk edge, the ring of light round the cup's foot
  s.hline(x - 10, top, 22, S(P.chalk));
  s.hline(x - 7, top + 1, 16, P.skyLow);
  if (p.lamps) s.dither(x - 8, top - 3, 18, 3, P.skyMid, 0.25);
  drawTrophy(s, x, top, p.light, false, "nextgen");
}

// ---------------------------------------------------------------------------
// The arena's goal (tiers 4 to 7): HOME's frame, as tubes of light
// ---------------------------------------------------------------------------

/** The arena goal's colours (`goalColors` puts them in `GoalColors.arena` from tier 4). */
export interface ArenaGoal {
  /** The tubes: a white face, a cyan core, a lit steel side, an ink backing. */
  face: Color;
  core: Color;
  side: Color;
  back: Color;
  /** The far post, in the net's shade. */
  farFace: Color;
  farSide: Color;
  /** The near netting's strings, lit and in shade; the far side and back, and its shade. */
  net: Color;
  netLow: Color;
  netFar: Color;
  netFarLow: Color;
  ground: Color;
  /** Its glow, beside the tubes on the side away from the light: only after dark. */
  halo: Color;
  haloLow: Color;
  night: boolean;
}

/** The arena goal's colours, graded with `G` (the structure) or raw (the light). */
export function arenaGoalColors(G: (c: Color) => Color): ArenaGoal {
  return {
    face: P.white,
    core: P.awayLight,
    side: G(P.steelHi),
    back: G(P.ink),
    farFace: G(P.steelHi),
    farSide: G(P.steel),
    net: P.awayLight,
    netLow: P.away,
    netFar: P.away,
    netFarLow: G(P.awayDark),
    ground: G(P.grassDeep),
    halo: P.away,
    haloLow: P.awayDark,
    // the light grades the structure after dark (and at dusk and dawn): the glow shows then
    night: G(P.slate) !== P.slate,
  };
}

/** HOME's full goal (goal.ts): post height, net depth, the roof's rows, its lean, the mesh. */
const AG = { ph: 48, depth: 22, roof: 10, lean: 6, mesh: 8 } as const;

function agPush(y: number, bulge: NetBulge | null | undefined): number {
  if (!bulge || !(bulge.amount > 0)) return 0;
  const a = Math.min(1, bulge.amount);
  const f = 1 - Math.abs(y - bulge.y) / 16;
  return f > 0 ? Math.round(a * 10 * f) : 0;
}

/**
 * A side of the net on HOME's lattice: one diagonal of 1 px strings from the post back to
 * the back edge, the roof's edge sloping down from the bar. The near side's strings are lit
 * for most of a diamond's side and in shade for the rest; the far side's have their shade
 * under them.
 */
function agPanel(
  s: Surface,
  px: number,
  foot: number,
  c: Color,
  low: Color,
  bulge: NetBulge | null | undefined,
  diag: 1 | -1,
): void {
  const { ph, depth: d, roof, lean, mesh } = AG;
  const top = foot - ph;
  const backTop = top + roof;
  for (let y = top; y < foot; y++) {
    const back =
      y < backTop
        ? px + Math.round(((y - top) * (d - lean)) / roof)
        : px +
          d -
          lean +
          Math.round(((y - backTop) * lean) / Math.max(1, foot - 1 - backTop));
    const right = back + agPush(y, bulge);
    for (let x = px + 1; x < right; x++) {
      if (((x + diag * y) & (mesh - 1)) !== 0) continue;
      if (diag === 1) s.px(x, y, (y & (mesh - 1)) < 5 ? c : low);
      else {
        s.px(x, y, c);
        if (y + 1 < foot) s.px(x, y + 1, low);
      }
    }
    if (y >= backTop) s.px(right, y, c);
  }
  const n = d - lean;
  for (let i = 0; i <= n; i++) {
    const y = top + Math.round((i * roof) / Math.max(1, n));
    s.px(px + i, y, c);
    s.px(px + i, y + 1, low);
  }
}

/**
 * A post standing on `foot`, its face column `x`: an ink line either side, then a face, a
 * core of light, a side; a white glint on its top; after dark a stepped glow beside it.
 */
function agPost(
  s: Surface,
  x: number,
  foot: number,
  face: Color,
  side: Color,
  c: ArenaGoal,
): void {
  const top = foot - AG.ph;
  const h = AG.ph;
  if (c.night) {
    for (let y = top; y < foot; y++) {
      if (bayer4(x + 4, y) < 0.5) s.px(x + 4, y, c.halo);
      if (bayer4(x + 5, y) < 0.25) s.px(x + 5, y, c.haloLow);
      if (bayer4(x - 2, y) < 0.25) s.px(x - 2, y, c.haloLow);
    }
  }
  s.vline(x - 1, top, h, c.back);
  s.vline(x, top, h, face);
  s.vline(x + 1, top, h, c.core);
  s.vline(x + 2, top, h, side);
  s.vline(x + 3, top, h, c.back);
  s.px(x + 1, top, P.white);
  // its foot: a plate on the turf, lit along its front
  s.hline(x - 2, foot - 1, 7, c.back);
  s.hline(x - 1, foot - 1, 4, c.core);
}

/** The arena goal's back layer (drawn before the cast): the far netting and the far post. */
export function arenaGoalBack(
  s: Surface,
  goalX: number,
  gy: number,
  c: ArenaGoal,
): void {
  const fx = goalX - 5;
  const ffoot = gy - 6;
  s.hline(fx + 1, ffoot - 2, AG.depth, c.ground);
  s.hline(fx + 1, ffoot - 1, AG.depth, c.netFarLow);
  agPanel(s, fx, ffoot, c.netFar, c.netFarLow, null, -1);
  agPost(s, fx - 3, ffoot, c.farFace, c.farSide, c);
}

/**
 * The arena goal's front layer (drawn after the ball): the back and roof of the net, the
 * near netting with a line of light along its foot, the crossbar and the near post, each a
 * tube of light on HOME's 4 px frame (a white face, a cyan core, a lit side, ink behind).
 */
export function arenaGoalFront(
  s: Surface,
  goalX: number,
  gy: number,
  c: ArenaGoal,
  bulge: NetBulge | null | undefined,
): void {
  const { ph, depth: d, roof, lean, mesh } = AG;
  const nx = goalX + 2;
  const nfoot = gy + 4;
  const fx = goalX - 5;
  const ffoot = gy - 6;
  const ntop = nfoot - ph;
  const ftop = ffoot - ph;
  // the back of the net
  for (let y = ftop + roof; y < nfoot; y++) {
    const t = (y - (ftop + roof)) / Math.max(1, nfoot - 1 - (ftop + roof));
    const x =
      Math.round(fx + d - lean + t * lean + (nx - fx) * t) + agPush(y, bulge);
    if (((x + y) & (mesh - 1)) === 0 || ((x - y) & (mesh - 1)) === 0) {
      s.px(x, y, c.netFar);
    } else if (y % 6 === 0) s.px(x, y, c.netFarLow);
  }
  // the roof of the net
  for (let y = ftop; y < ntop + roof; y++) {
    const a = Math.max(fx, fx + Math.round(((y - ftop) * (nx - fx)) / roof));
    const b = Math.min(nx + d - lean, a + d - lean + 1);
    for (let x = a + 1; x < b; x++) {
      if (((x - y) & (mesh - 1)) !== 0) continue;
      s.px(x, y, c.netFar);
      s.px(x - 1, y + 1, c.netFarLow);
    }
  }
  agPanel(s, nx, nfoot, c.net, c.netLow, bulge, 1);
  s.hline(nx + 1, nfoot - 2, d, c.ground);
  s.hline(nx + 1, nfoot - 1, d, c.net);
  // the crossbar: an ink line over it, the tube, ink under it; its glow over it after dark
  const x0 = fx - 3;
  const steps = Math.max(Math.abs(nx - x0), Math.abs(ntop - ftop));
  for (let i = 0; i <= steps; i++) {
    const bx = Math.round(x0 + ((nx - x0) * i) / steps);
    const by = Math.round(ftop + ((ntop - ftop) * i) / steps);
    if (c.night) {
      for (let k = 0; k < 4; k++) {
        if (bayer4(bx + k, by - 2) < 0.5) s.px(bx + k, by - 2, c.halo);
        if (bayer4(bx + k, by - 3) < 0.25) s.px(bx + k, by - 3, c.haloLow);
      }
    }
    s.hline(bx - 1, by - 1, 6, c.back);
  }
  for (let i = 0; i <= steps; i++) {
    const bx = Math.round(x0 + ((nx - x0) * i) / steps);
    const by = Math.round(ftop + ((ntop - ftop) * i) / steps);
    s.hline(bx, by, 4, c.face);
    s.hline(bx, by + 1, 4, c.core);
    s.hline(bx, by + 2, 4, c.side);
    s.hline(bx, by + 3, 4, c.back);
  }
  agPost(s, nx, nfoot, c.face, c.side, c);
  // the corner where the bar meets the post
  s.px(nx + 3, ntop, c.side);
  s.px(nx + 3, ntop + 1, c.side);
  s.px(nx + 4, ntop, c.back);
}

// ---------------------------------------------------------------------------
// The podium (tier 7)
// ---------------------------------------------------------------------------

/** The podium's places, 3 x 5 (a shape, not lettering): 1, 2, 3. */
const PLACES: readonly string[] = [
  ".#.##..#..#.###",
  "##...#.#.#..###",
  "##...#.#...###.",
];

/**
 * The podium: three white glass steps where HOME's are (`podiumFor`), each lit cyan along
 * its top edge, its place in magenta lamps on its face, a light where it meets the grass.
 */
export function paintArenaPodium(s: Surface, p: Paint): void {
  const { g, S } = p;
  const pd = podiumFor(g);
  const x0 = pd.x - pd.w / 2;
  const base = g.gy + 4;
  const step = (x: number, top: number, place: number): void => {
    const h = base - top;
    s.rect(x, top, 20, h, S(P.steelHi));
    s.hline(x, top, 20, S(P.white));
    s.hline(x, top + 1, 20, P.skyLow);
    s.vline(x, top + 2, h - 2, S(P.white));
    s.vline(x + 18, top + 2, h - 2, S(P.mist));
    s.vline(x + 19, top + 2, h - 2, S(P.steel));
    for (let k = 0; k < 4; k++) s.px(x + 3 + k, top + 3 + k, S(P.white));
    const rows = PLACES[place - 1];
    const dx = x + 8;
    const dy = top + 4 + ((h - 10) >> 1);
    for (let r = 0; r < 5; r++)
      for (let c = 0; c < 3; c++)
        if (rows[r * 3 + c] === "#") s.px(dx + c, dy + r, P.nextgen);
  };
  step(x0, base - 12, 2);
  step(x0 + 40, base - 10, 3);
  step(x0 + 20, pd.top, 1);
  s.hline(x0, base, pd.w, P.skyMid);
  s.dither(x0 - 2, base + 1, pd.w + 4, 2, P.skyMid, 0.25);
}
