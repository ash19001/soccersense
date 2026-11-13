/**
 * REFERENCE ART, not used by any screen. This was the home screen's first backdrop: the
 * stadium seen from inside. The home screen now shows the stadium from outside
 * (`stadium.ts`). It is kept because it is the look of this club's ground from within: the
 * career scene's big stadium should feel like the same place. Shots: inside/*.
 *
 * The stadium from inside: "the cauldron".
 *
 * Seen from the centre circle, looking along the halfway line at the main stand. A steep
 * three-tier stand fills the width (upper tier, a strip of boxes, lower tier) under a great
 * steel arch that springs from the floodlight towers, with smaller arches marching off to
 * the sides on wide screens. The scoreboard hangs from the great arch. Banners and big flags
 * dress the balcony, hoardings line the touchline, and the pitch runs from the stand to the
 * bottom of the canvas with the menu ball's centre circle on it.
 *
 * `InsideBackdrop` paints everything on the home screen except the ball, the logo and the DOM
 * captions. Everything that does not move is painted once per size, lighting or stadium
 * into three cached layers (night glows, the structure above the sky's own horizon, and the
 * opaque stand and pitch below it). A frame is the sky, three copies, then the moving
 * parts: pennants, birds, crowd shimmer and camera flashes, big flags, the scoreboard's
 * lamps (long lines scroll), and at night the lamp twinkle, flares, moths and red top lights.
 *
 * Light: the stand, crowd, pitch and arches take `light.lit`; the towers, pennants and
 * birds take `light.env`; lamps, lit windows, LED text and, once the lights are on, the
 * LED hoardings keep their raw palette colour.
 */

import {
  FONT_3x5,
  FONT_5x7,
  Surface,
  bayer4,
  clamp,
  drawText,
  hash2,
  measureText,
  mix,
  shade,
  type Color,
} from "~/pixel";
import {
  insideLayout as menuLayout,
  type InsideLayout as MenuLayout,
  type InsideSky as MenuSky,
} from "~/art/stadium-inside-layout";
import { drawLedLine, drawLedPanel } from "~/art/led";
import {
  lightingFor,
  skyFor,
  type Lighting,
  type SkySpec,
} from "~/art/lighting";
import { P } from "~/art/palette";
import { drawSky, sunPosition } from "~/art/sky";

/** This picture's own crowd: a fan 3 x 4 px, repeated every 4 px across and down. */
const FAN = { w: 3, h: 4, pitch: 4 } as const;

export interface InsideStadiumInfo {
  name: string;
  city: string;
  country: string;
}

// ---------------------------------------------------------------------------
// Layout numbers of this painter (everything else comes from menuLayout)
// ---------------------------------------------------------------------------

/** Advertising boards along the touchline: a top edge, five text rows, a base row. */
const BOARDS_H = 7;
/** The balcony wall of the upper tier. */
const PARAPET_H = 2;
/** The roof's front edge. */
const ROOF_H = 3;
/** The stand may rise this many rows above menuLayout's stand zone to fit whole fans. */
const STAND_RISE = 3;
/** The far touchline, in rows below the horizon. */
const TOUCHLINE_DY = 4;
/** The mowing stripes meet this far above the horizon, as a fraction of the height. */
const VANISH_UP = 0.045;
/** Width of a mowing stripe at the ball's contact row, in ball radii. */
const STRIPE_AT_BALL = 1;
/** How far the light stripe is from the dark one, in ramp steps (1 is a whole step). */
const STRIPE_STEP = 0.55;
/** A stripe thinner than this many rows (measured down the screen) is not drawn. */
const STRIPE_MELT = 2.2;
/** The centre circle: its half-width in ball radii, and how flat it lies. */
const CIRCLE_RX = 1.38;
const CIRCLE_SQUASH = 0.3;
/** A floodlight head: 4 x 3 lamps of 2 px with 1 px between, in a 1 px frame. */
const HEAD_W = 13;
const HEAD_H = 10;
/** Seconds between two waves round the crowd, and when the first one starts. */
const WAVE_EVERY = 19;
const WAVE_FIRST = 6;
/** Depth of an arch truss between its chords. */
const TRUSS = 4;
/** Clear pixels between one banner or big flag on the balcony and the next. */
const DRESS_GAP = 21;

const SMALL = { font: FONT_3x5 } as const;
const HEADER = "TODAY'S STADIUM";

interface Tower {
  /** Centre column of the mast. */
  x: number;
  /** Left column of the lamp head. */
  hx: number;
  /** Top row of the lamp head. */
  top: number;
  /** Half-width of the mast: 1 is a ladder, 2 a lattice. */
  half: number;
}

interface Arch {
  x0: number;
  x1: number;
  rise: number;
}

interface Geo {
  w: number;
  h: number;
  m: MenuLayout;
  /** Rows above this are sky with structure in front; rows from it down are opaque. */
  split: number;
  roofY: number;
  roofH: number;
  upperY: number;
  upperRows: number;
  parapetY: number;
  boxY: number;
  boxH: number;
  lowerY: number;
  lowerRows: number;
  boardsY: number;
  towers: Tower[];
  arches: Arch[];
}

function geometry(w: number, h: number): Geo {
  const m = menuLayout(w, h);
  const hy = m.horizonY;
  const zone = hy - m.stand.y;
  const boxH = zone >= 36 ? 5 : 4;
  const fixed = BOARDS_H + PARAPET_H + ROOF_H + boxH;
  const rows = Math.max(2, Math.floor((zone + STAND_RISE - fixed) / FAN.pitch));
  const upperRows = Math.ceil(rows / 2);
  const lowerRows = rows - upperRows;
  let roofY = hy - fixed - rows * FAN.pitch;
  let roofH = ROOF_H;
  if (roofY > m.stand.y) {
    roofH += roofY - m.stand.y;
    roofY = m.stand.y;
  }
  const upperY = roofY + roofH;
  const parapetY = upperY + upperRows * FAN.pitch;
  const boxY = parapetY + PARAPET_H;
  const lowerY = boxY + boxH;
  const boardsY = lowerY + lowerRows * FAN.pitch;

  // Towers: a tall pair at the far left and right (they may enter the logo band), and on
  // wide screens shorter ones inside, kept clear of the sun's and the moon's columns.
  const half = Math.floor(m.w / 2);
  const sunOff = Math.abs(m.sky.sunX - m.cx);
  const sunR = clamp(Math.round(3 + m.w / 40), 6, 10);
  // On a phone the sun climbs the strip of sky beside the scoreboard, so the towers
  // stand at the very edge, half out of frame. With more room they step inside.
  const inset = half - 8;
  const outer = inset - sunOff >= sunR + 8 ? inset : Math.max(8, half - 2);
  const boardHalf = Math.ceil(m.scoreboard.w / 2);
  const tallTop = Math.round(m.h * 0.1);
  const shortTop = m.logo.h + 2;
  const offsets: number[] = [];
  const inner = sunOff - 26;
  if (inner >= boardHalf + 30 && outer - inner >= 70) offsets.push(inner);
  if (offsets.length > 0) {
    const gap = outer - inner;
    const n = Math.round(gap / 150);
    for (let i = 1; i < n; i++) {
      const off = Math.round(inner + (gap * i) / n);
      if (Math.abs(off - sunOff) > 26) offsets.push(off);
    }
  }
  offsets.push(outer);
  const towers: Tower[] = [];
  for (const off of offsets) {
    const top = off === outer ? tallTop : shortTop;
    // A tower in full view is a lattice with its head on top. One at the very edge of the
    // screen is a slim ladder whose head leans in over the pitch, so all of it shows.
    const edge = off > half - 8;
    const xl = m.cx - off;
    const xr = m.cx + off;
    const reach = Math.floor(HEAD_W / 2);
    towers.push(
      { x: xl, hx: edge ? 0 : xl - reach, top, half: edge ? 1 : 2 },
      { x: xr, hx: edge ? m.w - HEAD_W : xr - reach, top, half: edge ? 1 : 2 },
    );
  }
  towers.sort((a, b) => a.x - b.x);

  // Arches: the great one over the scoreboard, then a lower one in every bay.
  const arches: Arch[] = [];
  const first = offsets[0];
  arches.push({
    x0: m.cx - first,
    x1: m.cx + first,
    rise: roofY - (m.logo.h + 3),
  });
  for (let i = 1; i < offsets.length; i++) {
    const a = offsets[i - 1];
    const b = offsets[i];
    const rise = Math.min(14, Math.round((b - a) * 0.12));
    arches.push({ x0: m.cx + a, x1: m.cx + b, rise });
    arches.push({ x0: m.cx - b, x1: m.cx - a, rise });
  }

  return {
    w: m.w,
    h: m.h,
    m,
    split: m.sky.horizonY,
    roofY,
    roofH,
    upperY,
    upperRows,
    parapetY,
    boxY,
    boxH,
    lowerY,
    lowerRows,
    boardsY,
    towers,
    arches,
  };
}

/** The top chord of an arch at column x (a parabola: flat at the crown, steep at the feet). */
function archTop(a: Arch, baseY: number, x: number): number {
  const u = clamp((2 * (x - a.x0)) / (a.x1 - a.x0) - 1, -1, 1);
  return Math.round(baseY - a.rise * (1 - u * u));
}

// ---------------------------------------------------------------------------
// Colours
// ---------------------------------------------------------------------------

type Grade = (c: Color) => Color;

/**
 * A neutral matchday mix: nobody's colours, everybody's. Two fans in three wear something
 * plain, the rest bring the colour. Weights add up to 100.
 */
const SHIRTS: readonly (readonly [Color, number])[] = [
  [P.chalk, 18],
  [P.mist, 13],
  [P.steel, 13],
  [P.slate, 10],
  [P.concreteLight, 7],
  [P.concreteDark, 5],
  [P.home, 9],
  [P.homeDark, 3],
  [P.away, 8],
  [P.awayDark, 3],
  [P.gold, 6],
  [P.skyMid, 3],
  [P.brick, 2],
];

const HEADS: readonly (readonly [Color, number])[] = [
  [P.skinA, 44],
  [P.skinB, 28],
  [P.skinC, 16],
  [P.chalk, 4],
  [P.home, 3],
  [P.away, 3],
  [P.gold, 2],
];

function pick(table: readonly (readonly [Color, number])[], r: number): Color {
  let acc = 0;
  const target = r * 100;
  for (const [c, weight] of table) {
    acc += weight;
    if (target < acc) return c;
  }
  return table[0][0];
}

/** The sky band behind row y, for glows that have to sit in the sky. */
function bandAt(spec: SkySpec, y: number, skyH: number): Color {
  const f = y / Math.max(1, skyH);
  let i = 0;
  while (i < spec.stops.length && f >= spec.stops[i]) i++;
  return spec.bands[Math.min(i, spec.bands.length - 1)];
}

// ---------------------------------------------------------------------------
// Static painters. Each draws on a full-size surface in final (graded) colours.
// ---------------------------------------------------------------------------

interface Paint {
  g: Geo;
  light: Lighting;
  /** Under the floodlights (equals env while they are off). */
  L: Grade;
  /** Lit by the sky. */
  E: Grade;
  /** How far the floodlights have come up: 0 off, 1 full. */
  flood: number;
  seed: number;
}

function paintTower(s: Surface, p: Paint, tw: Tower): void {
  const { g, E } = p;
  const x = tw.x;
  const mastTop = tw.top + HEAD_H;
  const legL = E(P.concrete);
  const legR = E(P.concreteDark);
  const brace = E(P.concreteLight);
  if (tw.half === 1) {
    // a ladder: two legs and a rung every third row
    for (let y = mastTop; y < g.roofY; y++) {
      s.px(x - 1, y, legL);
      s.px(x + 1, y, legR);
      if ((y - mastTop) % 3 === 1) s.px(x, y, brace);
    }
  } else {
    // a lattice: two legs, a strut every fourth row and a diagonal that zigzags between
    for (let y = mastTop; y < g.roofY; y++) {
      const r = (y - mastTop) % 4;
      const cell = Math.floor((y - mastTop) / 4);
      if (r === 0) s.hline(x - 1, y, 3, brace);
      else s.px(cell % 2 === 0 ? x - 2 + r : x + 2 - r, y, brace);
      s.px(x - 2, y, legL);
      s.px(x + 2, y, legR);
    }
  }
  // head: a dark frame, tilted forward a touch by its lighter top edge
  const hx = tw.hx;
  s.rect(hx, tw.top, HEAD_W, HEAD_H, E(P.slate));
  s.hline(hx, tw.top, HEAD_W, E(P.steel));
  s.hline(hx, tw.top + HEAD_H - 1, HEAD_W, E(P.night));
  const on = p.light.lightsOn;
  for (let j = 0; j < 3; j++) {
    for (let i = 0; i < 4; i++) {
      const lx = hx + 1 + i * 3;
      const ly = tw.top + 1 + j * 3;
      if (on) {
        s.rect(lx, ly, 2, 2, P.white);
      } else {
        s.rect(lx, ly, 2, 2, E(P.mist));
        s.px(lx, ly, E(P.steelHi));
      }
    }
  }
}

function paintArch(s: Surface, p: Paint, a: Arch, hangers: boolean): void {
  const { g, L } = p;
  const base = g.roofY;
  // The arches are lit up at night, like the stand: they glow against the dark sky.
  const top = L(P.steelHi);
  const chord = L(P.steel);
  const web = L(P.concrete);
  const under = L(P.concreteDark);
  const inner: Arch = {
    x0: a.x0 + TRUSS,
    x1: a.x1 - TRUSS,
    rise: a.rise - TRUSS,
  };
  const xa = Math.max(a.x0, -2);
  const xb = Math.min(a.x1, g.w + 2);
  // webbing: a zigzag between the chords
  const cell = 6;
  const start = a.x0 + ((((g.m.cx - a.x0) % cell) + cell) % cell);
  for (let x = start - cell; x < xb; x += cell) {
    if (x + cell < xa) continue;
    const m0 = x + cell / 2;
    if (x >= inner.x0 && m0 <= inner.x1) {
      s.line(x, archTop(a, base, x), m0, archTop(inner, base, m0), web);
    }
    if (m0 >= inner.x0 && x + cell <= inner.x1) {
      s.line(
        m0,
        archTop(inner, base, m0),
        x + cell,
        archTop(a, base, x + cell),
        web,
      );
    }
  }
  if (hangers) {
    const hang = L(P.concrete);
    for (let x = g.m.cx % 12; x < xb; x += 12) {
      if (x <= inner.x0 + 4 || x >= inner.x1 - 4) continue;
      const y0 = archTop(inner, base, x) + 1;
      s.vline(x, y0, base - y0, hang);
    }
  }
  // chords last, so they stay clean
  let prevT = archTop(a, base, xa);
  let prevB = archTop(inner, base, Math.max(xa, inner.x0));
  for (let x = xa; x <= xb; x++) {
    const yt = archTop(a, base, x);
    s.line(x - 1, prevT, x, yt, top);
    s.px(x, yt + 1, chord);
    prevT = yt;
    if (x >= inner.x0 && x <= inner.x1) {
      const yb = archTop(inner, base, x);
      s.line(x - 1, prevB, x, yb, under);
      prevB = yb;
    }
  }
}

interface FanList {
  n: number;
  x: Int16Array;
  y: Int16Array;
  head: Uint32Array;
  body: Uint32Array;
  /** Bob period in half-second ticks, and the offset inside it. */
  period: Uint8Array;
  offset: Uint8Array;
}

function paintTier(
  s: Surface,
  p: Paint,
  y0: number,
  rows: number,
  rowBase: number,
  upper: boolean,
  fans: FanList,
): void {
  const { g, L, seed } = p;
  const cx = g.m.cx;
  const halfW = Math.max(40, g.w / 2);
  // empty seats and the gaps between shoulders: deep shade up under the roof, plain
  // concrete down in the light, so the lower tier is a calmer pattern
  s.rect(0, y0, g.w, rows * FAN.pitch, L(upper ? P.night : P.concreteDark));
  for (let r = 0; r < rows; r++) {
    const y = y0 + r * FAN.pitch;
    const row = rowBase + r;
    const stagger = (row & 1) * 2;
    const dark = upper && r === 0;
    const i0 = -Math.ceil((cx + 4) / FAN.pitch);
    const i1 = Math.ceil((g.w - cx + 4) / FAN.pitch);
    for (let i = i0; i <= i1; i++) {
      const x = cx + i * FAN.pitch + stagger - 1;
      // friends sit together: now and then a pair shares a colour
      const paired = hash2(i >> 1, row, seed + 7) < 0.3;
      const rBody = paired
        ? hash2(i >> 1, row, seed + 11)
        : hash2(i, row, seed + 13);
      let body = pick(SHIRTS, rBody);
      // Everyone's stadium, but the warm shirts lean to HOME's side of the ball and the
      // teal ones to AWAY's: the further out, the more of them have changed ends.
      const side = clamp((x - cx) / halfW, -1, 1);
      const swap = hash2(i, row, seed + 19) < Math.abs(side) * 0.5;
      if (swap && side > 0) {
        if (body === P.home) body = P.away;
        else if (body === P.homeDark) body = P.awayDark;
      } else if (swap && side < 0) {
        if (body === P.away) body = P.home;
        else if (body === P.awayDark) body = P.homeDark;
      }
      let head = pick(HEADS, hash2(i, row, seed + 17));
      if (upper) {
        // the upper tier sits back under the roof: deep shade on its top row, a lighter
        // one on the rest, so the lower tier is the one that catches the light
        const sh = dark ? -0.45 : -0.18;
        body = shade(body, sh);
        head = shade(head, sh);
      }
      const cBody = L(body);
      const cHead = L(head);
      s.px(x + 1, y, cHead);
      s.rect(x, y + 1, FAN.w, 2, cBody);
      s.hline(x, y + 3, FAN.w, L(shade(body, -0.3)));
      // (the row under the roof stays seated: there is no room to stand)
      if (!dark && fans.n < fans.x.length) {
        const k = fans.n++;
        fans.x[k] = x;
        fans.y[k] = y;
        fans.head[k] = cHead;
        fans.body[k] = cBody;
        fans.period[k] = 9 + Math.floor(hash2(i, row, seed + 23) * 14);
        fans.offset[k] = Math.floor(hash2(i, row, seed + 29) * 23);
      }
    }
  }
}

interface Banner {
  text: string;
  bg: Color;
  fg: Color;
  /** 0 words, 1 halves, 2 hoops. */
  kind: 0 | 1 | 2;
  alt: Color;
}

const BANNERS: readonly Banner[] = [
  { text: "TOP BINS", bg: P.chalk, fg: P.homeDark, kind: 0, alt: P.home },
  { text: "WORLDIE!", bg: P.night, fg: P.gold, kind: 0, alt: P.gold },
  { text: "ON TARGET", bg: P.awayDark, fg: P.chalk, kind: 0, alt: P.chalk },
  { text: "", bg: P.chalk, fg: P.away, kind: 2, alt: P.awayDark },
  { text: "GOAL!", bg: P.gold, fg: P.night, kind: 0, alt: P.night },
  { text: "FULL TIME", bg: P.homeDark, fg: P.chalk, kind: 0, alt: P.chalk },
  { text: "", bg: P.home, fg: P.gold, kind: 1, alt: P.gold },
];

function paintBanner(
  s: Surface,
  p: Paint,
  b: Banner,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const { L } = p;
  s.rect(x, y, w, h, L(b.bg));
  if (b.kind === 0) {
    drawText(s, b.text, x + Math.floor(w / 2), y + 1, L(b.fg), {
      font: FONT_3x5,
      align: "center",
    });
  } else if (b.kind === 1) {
    s.rect(x + Math.floor(w / 2), y, w - Math.floor(w / 2), h, L(b.alt));
  } else {
    s.rect(x, y + 2, w, h - 4, L(b.alt));
  }
  // the cloth sags: a shaded hem, when there is a row to spare under the words
  if (h >= 7) s.hline(x, y + h - 1, w, L(shade(b.bg, -0.3)));
}

function bannerWidth(b: Banner): number {
  return b.kind === 0 ? measureText(b.text, SMALL) + 4 : 14;
}

/** Width of a big flag with its pole. */
const FLAG_W = 13;

interface Dressing {
  x: number;
  /** A banner on the balcony, or (when absent) a big flag on a pole. */
  banner?: Banner;
  n: number;
}

/**
 * Banners and big flags take turns along the balcony, working outwards from the halfway
 * line, so they never cover each other. The left starts with a flag, the right with a
 * banner.
 */
function dressing(g: Geo): Dressing[] {
  const out: Dressing[] = [];
  const cx = g.m.cx;
  let n = 0;
  for (const side of [-1, 1]) {
    let edge = 10;
    let turn = side < 0 ? 1 : 0;
    let k = side < 0 ? 4 : 0;
    while (edge < g.w / 2) {
      const banner = turn % 2 === 0 ? BANNERS[k++ % BANNERS.length] : undefined;
      const bw = banner ? bannerWidth(banner) : FLAG_W;
      out.push({ x: side > 0 ? cx + edge : cx - edge - bw, banner, n: n++ });
      edge += bw + DRESS_GAP;
      turn++;
    }
  }
  return out;
}

function paintStand(s: Surface, p: Paint, fans: FanList): void {
  const { g, L, light, seed } = p;
  const w = g.w;
  const cx = g.m.cx;

  // roof: a bright front edge, a fascia, a dark underside
  s.rect(0, g.roofY, w, g.roofH, L(P.concreteLight));
  s.hline(0, g.roofY, w, L(P.steelHi));
  s.hline(0, g.roofY + g.roofH - 1, w, L(P.concreteDark));
  if (light.lightsOn) {
    // a string of lamps under the roof's edge
    for (let x = (cx % 8) - 8; x < w; x += 8) {
      s.hline(x, g.roofY + g.roofH - 1, 2, P.white);
    }
  }

  // the two crowd tiers
  paintTier(s, p, g.upperY, g.upperRows, 0, true, fans);
  paintTier(s, p, g.lowerY, g.lowerRows, 8, false, fans);

  // stairs: light steps cutting the tiers into blocks
  const step = L(P.concrete);
  const stepHi = L(P.concreteLight);
  for (let off = 16; off < w / 2 + 2; off += 32) {
    for (const x of [cx - off - 1, cx + off - 1]) {
      for (let y = g.lowerY; y < g.boardsY; y++) {
        s.hline(x, y, 2, (y - g.lowerY) % 2 === 0 ? stepHi : step);
      }
    }
  }
  for (let off = 32; off < w / 2 + 2; off += 32) {
    for (const x of [cx - off - 1, cx + off - 1]) {
      for (let y = g.upperY + 2; y < g.parapetY; y++) {
        s.hline(x, y, 2, (y - g.upperY) % 2 === 0 ? step : L(P.concreteDark));
      }
    }
  }

  // balcony wall
  s.hline(0, g.parapetY, w, L(P.steelHi));
  s.hline(0, g.parapetY + 1, w, L(P.concrete));

  // the box tier: a shadow under the balcony, a run of windows, a sill
  s.rect(0, g.boxY, w, g.boxH, L(P.ink));
  s.hline(0, g.boxY + g.boxH - 1, w, L(P.concreteDark));
  const winH = g.boxH - 2;
  const on = light.lightsOn;
  for (let i = -Math.ceil(cx / 6) - 1; i <= Math.ceil((w - cx) / 6); i++) {
    const x = cx + i * 6 - 2;
    const r = hash2(i, 3, seed + 31);
    let glass: Color;
    const lit = on && r >= 0.36;
    if (lit) {
      glass = r < 0.6 ? P.goldLight : P.gold;
    } else {
      glass = r < 0.5 ? L(P.steel) : L(P.slate);
    }
    s.rect(x, g.boxY + 1, 5, winH, glass);
    if (lit) s.hline(x, g.boxY + winH, 5, P.amber);
    else s.px(x, g.boxY + 1, L(P.mist));
  }

  // banners over the balcony, hanging down across the boxes
  const bh = PARAPET_H + g.boxH;
  for (const d of dressing(g)) {
    if (d.banner) {
      paintBanner(s, p, d.banner, d.x, g.parapetY, bannerWidth(d.banner), bh);
    }
  }

  // players' tunnel, on the halfway line
  const tw = 12;
  const th = Math.min(g.lowerRows * FAN.pitch - 2, 8);
  const tx = cx - tw / 2;
  const ty = g.boardsY - th;
  s.rect(tx - 1, ty - 1, tw + 2, th + 1, L(P.concreteLight));
  s.rect(tx, ty, tw, th, L(P.ink));
  s.rect(tx + 2, ty + 2, tw - 4, th - 2, L(P.night));
  s.hline(tx - 1, ty - 1, tw + 2, L(P.steelHi));
}

interface Hoarding {
  parts: readonly (readonly [string, Color])[];
  bg: Color;
}

const HOARD_CENTRE: Hoarding = {
  parts: [
    ["SOCCER", P.chalk],
    ["SENSE", P.gold],
  ],
  bg: P.night,
};
const HOARD_HOME: Hoarding = { parts: [["HOME", P.chalk]], bg: P.home };
const HOARD_AWAY: Hoarding = { parts: [["AWAY", P.chalk]], bg: P.awayDark };
const HOARD_SEVEN: Hoarding = { parts: [["7 QUESTIONS", P.night]], bg: P.gold };
const HOARD_DAILY: Hoarding = { parts: [["PLAY DAILY", P.night]], bg: P.chalk };
const HOARD_RIGHT = [HOARD_AWAY, HOARD_SEVEN, HOARD_DAILY, HOARD_CENTRE];
const HOARD_LEFT = [HOARD_HOME, HOARD_DAILY, HOARD_SEVEN, HOARD_CENTRE];

function hoardingWidth(b: Hoarding): number {
  let tw = 0;
  for (const [text] of b.parts) tw += measureText(text, SMALL) + 1;
  return tw - 1 + 8;
}

function paintHoarding(s: Surface, p: Paint, b: Hoarding, x: number): void {
  const { g, L, light } = p;
  // LED boards: they keep their own colour once the lights are on
  const G: Grade = light.lightsOn ? (c) => c : L;
  const w = hoardingWidth(b);
  const y = g.boardsY;
  s.rect(x, y, w, BOARDS_H, G(b.bg));
  s.hline(x, y, w, G(shade(b.bg, 0.25)));
  s.hline(x, y + BOARDS_H - 1, w, G(shade(b.bg, -0.25)));
  let tx = x + 4;
  for (const [text, c] of b.parts) {
    tx += drawText(s, text, tx, y + 1, G(c), SMALL) + 1;
  }
  s.vline(x + w, y, BOARDS_H, L(P.ink));
}

function paintHoardings(s: Surface, p: Paint): void {
  const { g, L } = p;
  s.rect(0, g.boardsY, g.w, BOARDS_H, L(P.ink));
  const cw = hoardingWidth(HOARD_CENTRE);
  const x0 = g.m.cx - Math.floor(cw / 2);
  paintHoarding(s, p, HOARD_CENTRE, x0);
  s.vline(x0 - 1, g.boardsY, BOARDS_H, L(P.ink));
  let x = x0 + cw + 1;
  for (let i = 0; x < g.w; i++) {
    const b = HOARD_RIGHT[i % HOARD_RIGHT.length];
    paintHoarding(s, p, b, x);
    x += hoardingWidth(b) + 1;
  }
  x = x0 - 1;
  for (let i = 0; x > 0; i++) {
    const b = HOARD_LEFT[i % HOARD_LEFT.length];
    x -= hoardingWidth(b) + 1;
    paintHoarding(s, p, b, x);
  }
}

/**
 * The pitch: mowing stripes that fan out from a point just above the horizon, the far
 * touchline, the halfway line coming straight at the viewer and the centre circle round
 * the spot the ball stands on. One stripe is centred on the halfway line, so the ball
 * sits in the middle of a calm, symmetric fan. Under the lights the pitch is a pool of
 * light whose near corners fall away through two darker pairs of greens.
 */
function paintPitch(s: Surface, p: Paint): void {
  const { g, L, light } = p;
  const { cx, horizonY: hy, ballCy, ballR } = g.m;
  const w = g.w;
  const h = g.h;
  const ph = Math.max(1, h - hy);
  // [the darker stripe, the lighter one, the two melted together far off to the sides]
  const pair = (a: Color, b: Color): readonly [Color, Color, Color] => [
    L(a),
    L(mix(a, b, STRIPE_STEP)),
    L(mix(a, b, STRIPE_STEP / 2)),
  ];
  const tones = [
    pair(P.grass, P.grassLight),
    pair(P.grassDark, P.grass),
    pair(P.grassDeep, P.grassDark),
  ];
  const vy = hy - Math.max(8, Math.round(h * VANISH_UP));
  const touchY = hy + TOUCHLINE_DY;
  const contactY = ballCy + ballR;
  // a stripe is as wide as (rows below the vanishing point) x k
  const k = (ballR * STRIPE_AT_BALL) / Math.max(1, contactY - vy);

  const pool = clamp((2 - light.sun.elevation) / 8, 0, 1);
  const pooled = pool > 0.3;
  const py = hy + ph * 0.26;
  const prx = Math.max(w * 0.6, 84);
  const pry = ph * 0.8;
  const first = 0.78 + (1 - pool) * 0.25;
  const bandW = 0.2;
  const soft = 0.3;

  s.shadeRect(0, hy, w, ph, (x, y) => {
    if (y <= touchY) return tones[0][0];
    let zone = 0;
    if (pooled) {
      const qx = (x - cx) / prx;
      const qy = (y - py) / pry;
      const f = (Math.sqrt(qx * qx + qy * qy) - first) / bandW;
      if (f > -soft) {
        const whole = Math.floor(f + soft);
        const frac = f + soft - whole;
        const up = frac >= soft || bayer4(x, y) < frac / soft;
        zone = clamp(whole + (up ? 1 : 0), 0, 2);
      }
    }
    const dy = y - vy;
    const n = Math.floor((x - cx) / (dy * k) + 0.5);
    // Far out to the sides the stripes lie almost flat, thinner than a couple of rows:
    // there they melt into one tone before they can turn into a herringbone.
    if (dy < STRIPE_MELT * Math.abs(n)) return tones[zone][2];
    return tones[zone][n & 1];
  });

  // the stand's shadow at the foot of the boards, then the far touchline
  const dark = L(P.grassDark);
  const chalk = L(P.chalk);
  s.rect(0, hy, w, 2, dark);
  s.dither(0, hy + 2, w, 1, dark, 0.5);
  s.hline(0, touchY, w, chalk);

  // halfway line: straight at the viewer, widening as it comes
  const widen = hy + Math.round((contactY - hy) * 0.42);
  for (let y = touchY + 1; y < h; y++) {
    const half = y < widen ? 0 : 1;
    s.hline(cx - half, y, 1 + half * 2, chalk);
  }

  // centre circle round the ball's contact point: 1 px on the far side, 2 px near
  const cy = contactY - 1;
  const rx = Math.min(Math.round(ballR * CIRCLE_RX), cx - 2);
  const ry = Math.max(3, Math.round(rx * CIRCLE_SQUASH));
  const orx = rx + 0.5;
  const ory = ry + 0.5;
  const irx = rx - 1.5;
  const iry = ry - 1;
  for (
    let y = Math.max(hy, cy - ry - 1);
    y <= Math.min(h - 1, cy + ry + 1);
    y++
  ) {
    const oy = (y - cy) / ory;
    const iy = (y - (cy - 0.5)) / iry;
    for (
      let x = Math.max(0, cx - rx - 1);
      x <= Math.min(w - 1, cx + rx + 1);
      x++
    ) {
      const ox = (x - cx) / orx;
      if (ox * ox + oy * oy > 1) continue;
      const ix = (x - cx) / irx;
      if (ix * ix + iy * iy <= 1) continue;
      s.px(x, y, chalk);
    }
  }
}

function paintBoardHousing(s: Surface, p: Paint): void {
  const { g, L, E } = p;
  const b = g.m.scoreboard;
  // hangers from the great arch
  const arch = g.arches[0];
  const inner: Arch = {
    x0: arch.x0 + TRUSS,
    x1: arch.x1 - TRUSS,
    rise: arch.rise - TRUSS,
  };
  for (const x of [b.x + 7, b.x + b.w - 9]) {
    const y0 = archTop(inner, g.roofY, x);
    s.rect(x, y0, 2, b.y - y0, E(P.concreteDark));
    s.vline(x, y0, b.y - y0, E(P.concrete));
  }
  // a hard shadow where the board hangs in front of the stand
  const sy = Math.max(b.y + 1, g.roofY);
  s.vline(b.x + b.w, sy, b.y + b.h + 1 - sy, L(P.ink));
  s.hline(b.x + 1, b.y + b.h, b.w, L(P.ink));
  drawLedPanel(s, b.x, b.y, b.w, b.h, { grade: E });
}

/** The night glows that sit in the sky, behind the structure. */
function paintGlow(s: Surface, p: Paint): void {
  const { g, flood, light } = p;
  if (flood <= 0) return;
  const spec = skyFor(light);
  const skyH = g.split;
  const warm = P.haze;
  const cool = P.skyLow;
  // the bowl's own glow, rising off the roof: a solid band, then two dithered ones
  const reach = Math.round(2 + 2 * flood);
  for (let i = 1; i <= reach * 3; i++) {
    const y = g.roofY - i;
    if (y < 0) break;
    const level = i <= reach ? 1 : i <= reach * 2 ? 0.5 : 0.25;
    const c = mix(bandAt(spec, y, skyH), cool, 0.14 + 0.14 * flood);
    s.dither(0, y, g.w, 1, c, level);
  }
  for (const tw of g.towers) {
    const cx = tw.hx + Math.floor(HEAD_W / 2);
    const cy = tw.top + HEAD_H / 2;
    // beam: a cone falling behind the roof, leaning in a little
    const lean = Math.sign(g.m.cx - cx) * 8;
    const beamC = mix(bandAt(spec, cy + 20, skyH), cool, 0.36);
    s.poly(
      [
        [cx - 6, cy],
        [cx + 6, cy],
        [cx + lean + 13, g.split],
        [cx + lean - 13, g.split],
      ],
      beamC,
      0.25,
    );
    s.poly(
      [
        [cx - 3, cy],
        [cx + 3, cy],
        [cx + lean + 6, g.split],
        [cx + lean - 6, g.split],
      ],
      beamC,
      0.5,
    );
    // halo: three flat bands, dithered where they meet
    const scale = 0.55 + 0.45 * flood;
    const R = 19 * scale;
    for (let y = Math.round(cy - R); y <= cy + R; y++) {
      if (y < 0 || y >= g.split) continue;
      const band = bandAt(spec, y, skyH);
      const c1 = mix(band, warm, 0.14);
      const c2 = mix(band, warm, 0.3);
      const c3 = mix(band, warm, 0.5);
      for (let x = Math.round(cx - R); x <= cx + R; x++) {
        const d = Math.hypot(x - cx, (y - cy) * 1.2) / scale;
        if (d > 19) continue;
        const th = bayer4(x, y);
        let c: Color | null;
        if (d < 8.5) c = c3;
        else if (d < 10) c = th < 0.5 ? c3 : c2;
        else if (d < 12) c = c2;
        else if (d < 13.5) c = th < 0.5 ? c2 : c1;
        else if (d < 15.5) c = c1;
        else if (d < 17.5) c = th < 0.5 ? c1 : null;
        else c = th < 0.25 ? c1 : null;
        if (c !== null) s.px(x, y, c);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Moving parts
// ---------------------------------------------------------------------------

interface Cloth {
  x: number;
  y: number;
  w: number;
  h: number;
  amp: number;
  phase: number;
  a: Color;
  aShade: Color;
  b: Color;
  bShade: Color;
}

/**
 * A big flag on a pole at its left edge: two colours, top and bottom, with a ripple that
 * runs along it in four steps. The folds turning away take the shade.
 */
function drawCloth(s: Surface, f: Cloth, step: number): void {
  const upper = (f.h + 1) >> 1;
  for (let i = 0; i < f.w; i++) {
    // one wave is as long as the flag, so every level is a run of three or four columns
    const ph = i * 0.52 - (step + f.phase) * (Math.PI / 2);
    const off = i < 2 ? 0 : Math.round(Math.sin(ph) * f.amp);
    const dark = off > 0;
    const top = f.y + off;
    s.vline(f.x + i, top, upper, dark ? f.aShade : f.a);
    s.vline(f.x + i, top + upper, f.h - upper, dark ? f.bShade : f.b);
  }
}

interface Pennant {
  x: number;
  y: number;
  phase: number;
  c: Color;
  shade: Color;
}

/** How far each of a pennant's five columns hangs, in its four steps. */
const PENNANT_STEPS: readonly (readonly number[])[] = [
  [0, 0, 0, 0, 0],
  [0, 0, 0, 1, 1],
  [0, 0, 1, 1, 1],
  [0, 0, 0, 1, 1],
];

function drawPennant(s: Surface, f: Pennant, step: number): void {
  const offs = PENNANT_STEPS[(step + f.phase) & 3];
  for (let i = 0; i < 5; i++) {
    s.vline(f.x + i, f.y + offs[i], 3, offs[i] ? f.shade : f.c);
  }
}

/** Big flags, top and bottom colour. Nobody's national flag. */
const FLAG_PAIRS: readonly (readonly [Color, Color])[] = [
  [P.home, P.gold],
  [P.chalk, P.away],
  [P.gold, P.night],
  [P.away, P.chalk],
  [P.homeDark, P.chalk],
];

const PENNANT_COLORS: readonly Color[] = [
  P.home,
  P.away,
  P.gold,
  P.homeDark,
  P.awayDark,
];

// ---------------------------------------------------------------------------
// The backdrop
// ---------------------------------------------------------------------------

interface Line {
  text: string;
  y: number;
  color: Color;
  big: boolean;
}

export class InsideBackdrop {
  private readonly seed: number;
  private stadium: InsideStadiumInfo;
  private light: Lighting = lightingFor({ elevation: 45, morning: false });
  private w = 0;
  private h = 0;
  private dirty = true;

  private g: Geo = geometry(1, 1);
  private sky: MenuSky = this.g.m.sky;
  private glow: Surface | null = null;
  private upper: Surface = new Surface(1, 1);
  private ground: Surface = new Surface(1, 1);
  private fans: FanList = emptyFans(0);
  private cloths: Cloth[] = [];
  private pennants: Pennant[] = [];
  private lines: Line[] = [];
  /** Where birds sit on the great arch by day: the pixel they stand on. */
  private perches: { x: number; y: number }[] = [];
  private birdColor: Color = P.night;
  /** The scoreboard's first line, as the lamps show it. */
  private header: string = HEADER;
  /** The moon's phase for the sky, or undefined for the sky's own default. */
  private moonPhase: number | undefined = undefined;
  /** The crowd's celebration: where it started and how far it has spread (0: none). */
  private cheerX = 0;
  private cheerReach = 0;

  constructor(opts: {
    seed: number;
    stadium: InsideStadiumInfo;
    /** The scoreboard's first line. Default "TODAY'S STADIUM". */
    header?: string;
  }) {
    this.seed = opts.seed;
    this.stadium = opts.stadium;
    if (opts.header !== undefined) this.header = opts.header.toUpperCase();
  }

  resize(w: number, h: number): void {
    const W = Math.max(1, Math.round(w));
    const H = Math.max(1, Math.round(h));
    if (W === this.w && H === this.h) return;
    this.w = W;
    this.h = H;
    this.dirty = true;
  }

  setLighting(light: Lighting): void {
    if (light === this.light) return;
    this.light = light;
    this.dirty = true;
  }

  setStadium(stadium: InsideStadiumInfo): void {
    const old = this.stadium;
    if (
      old.name === stadium.name &&
      old.city === stadium.city &&
      old.country === stadium.country
    ) {
      return;
    }
    this.stadium = stadium;
    this.dirty = true;
  }

  /** The scoreboard's first line (drawn in capitals). */
  setHeader(header: string): void {
    const text = header.toUpperCase();
    if (text === this.header) return;
    this.header = text;
    // only the board's lines change: no cached layer holds them
    if (!this.dirty) this.layoutBoard();
  }

  /** The moon's phase: 0 new, 0.5 full. Passed straight to the sky. */
  setMoonPhase(phase: number): void {
    this.moonPhase = Number.isFinite(phase) ? phase : undefined;
  }

  /**
   * The crowd celebrates: every fan within `reach` pixels of column `x` is on his feet
   * and bouncing, arms up. Grow `reach` over a few frames and the cheer spreads out from
   * where it began. A reach of 0 (the default) is the everyday crowd.
   */
  setCheer(x: number, reach: number): void {
    this.cheerX = Number.isFinite(x) ? x : 0;
    this.cheerReach = reach > 0 ? reach : 0;
  }

  /**
   * Where a ball struck towards the ground comes down in it, for the current size. The menu
   * scene aims its HOME kick-off here. Part of the backdrop contract in docs/API_ART.md.
   */
  target(): { x: number; y: number } {
    const m = menuLayout(Math.max(1, this.w), Math.max(1, this.h));
    return { x: m.cx, y: m.horizonY - 12 };
  }

  /**
   * The ground erupts: 0 is an ordinary matchday, 1 is the whole place on its feet. The
   * scene ramps it up and down. Part of the backdrop contract in docs/API_ART.md.
   */
  setRoar(amount: number): void {
    const a = Number.isFinite(amount) ? Math.min(1, Math.max(0, amount)) : 0;
    this.setCheer(Math.round(this.w / 2), a * this.w);
  }

  /** Paint the whole backdrop. Covers every pixel of `s`. */
  draw(s: Surface, t: number): void {
    if (this.w !== s.w || this.h !== s.h) {
      this.resize(s.w, s.h);
    }
    if (this.dirty) this.rebuild();
    const g = this.g;
    const light = this.light;
    const time = Number.isFinite(t) ? t : 0;

    if (this.moonPhase === undefined) {
      drawSky(s, { light, t: time, seed: this.seed, ...this.sky });
    } else {
      drawSky(s, {
        light,
        t: time,
        seed: this.seed,
        ...this.sky,
        moonPhase: this.moonPhase,
      });
    }
    if (this.glow) s.blit(this.glow, 0, 0);
    s.blit(this.upper, 0, 0);
    s.copy(this.ground, 0, g.split);

    this.drawPennants(s, time);
    this.drawBirds(s, time);
    this.drawCrowd(s, time);
    this.drawCloths(s, time);
    this.drawBoard(s, time);
    this.drawLamps(s, time);
  }

  // -------------------------------------------------------------------------

  private rebuild(): void {
    this.dirty = false;
    const g = geometry(this.w, this.h);
    this.g = g;
    const light = this.light;
    const flood = light.lightsOn
      ? clamp((4 - light.sun.elevation) / 8, 0.15, 1)
      : 0;
    const p: Paint = {
      g,
      light,
      L: light.lit,
      E: light.env,
      flood,
      seed: this.seed,
    };

    const full = new Surface(g.w, g.h);
    for (const tw of g.towers) paintTower(full, p, tw);
    g.arches.forEach((a, i) => paintArch(full, p, a, i === 0));

    // pennant poles along the roof (the cloth is drawn each frame)
    this.pennants = [];
    const b = g.m.scoreboard;
    const pole = p.E(P.steelHi);
    const sun = sunPosition(
      light,
      g.w,
      g.m.sky.horizonY,
      g.m.sky.clearTop,
      g.m.sky.sunX,
    );
    for (let off = 9; off < g.w / 2; off += 22) {
      // in pairs, a pole each side of the halfway line, or not at all
      if (off < b.w / 2 + 12) continue;
      for (const side of [-1, 1]) {
        const x = g.m.cx + side * off;
        if (g.towers.some((tw) => Math.abs(tw.x - x) < 8)) continue;
        // not in front of a low sun
        if (Math.abs(x + 3 - sun.x) < sun.r + 4 && sun.y > g.roofY - 12)
          continue;
        full.vline(x, g.roofY - 7, 7, pole);
        const n = Math.floor(hash2(x, 5, this.seed) * PENNANT_COLORS.length);
        const c = PENNANT_COLORS[n];
        this.pennants.push({
          x: x + 1,
          y: g.roofY - 7,
          phase: Math.floor(hash2(x, 6, this.seed) * 4),
          c: p.E(c),
          shade: p.E(shade(c, -0.25)),
        });
      }
    }

    // birds on the crown of the great arch, while there is daylight
    this.perches = [];
    this.birdColor = p.E(P.night);
    if (skyFor(light).birds) {
      const crown = g.arches[0];
      for (const off of [-21, -15, 18, 27]) {
        const x = g.m.cx + off;
        const y = archTop(crown, g.roofY, x);
        if (x > crown.x0 + 8 && x < crown.x1 - 8 && y < b.y - 4) {
          this.perches.push({ x, y });
        }
      }
    }

    const cap = Math.ceil(g.w / FAN.pitch + 8) * (g.upperRows + g.lowerRows);
    const fans = emptyFans(cap);
    paintStand(full, p, fans);
    paintHoardings(full, p);
    paintPitch(full, p);
    paintBoardHousing(full, p);

    // The moon must not rest on the scoreboard's top edge: lift it clear if the logo
    // leaves room, otherwise sink it until it is plainly behind the board.
    const moon = { ...g.m.sky.moon };
    const moonR = clamp(Math.round(3 + g.w / 45), 6, 9);
    if (moon.x + moonR >= b.x && moon.x - moonR <= b.x + b.w) {
      const hidden = moon.y + moonR - b.y + 1;
      if (hidden > -2 && hidden < 4) {
        const lifted = b.y - moonR - 3;
        moon.y =
          lifted - moonR >= g.m.sky.clearTop - 3 ? lifted : b.y + 3 - moonR;
      }
    }
    this.sky = { ...g.m.sky, moon };

    // big flags held up out of the lower tier
    this.cloths = [];
    const mast = p.L(P.steelHi);
    for (const d of dressing(g)) {
      if (d.banner) continue;
      const n = d.n;
      const y = g.parapetY - 2 - (n % 2);
      full.vline(d.x, y, g.lowerY + 3 - y, mast);
      const [a, c] = FLAG_PAIRS[n % FLAG_PAIRS.length];
      this.cloths.push({
        x: d.x + 1,
        y,
        w: FLAG_W - 1,
        h: 7,
        amp: 1,
        phase: n,
        a: p.L(a),
        aShade: p.L(shade(a, -0.25)),
        b: p.L(c),
        bShade: p.L(shade(c, -0.25)),
      });
    }

    // keep only the fans nothing has been painted over
    let kept = 0;
    for (let i = 0; i < fans.n; i++) {
      const x = fans.x[i];
      const y = fans.y[i];
      if (
        full.get(x + 1, y) !== fans.head[i] ||
        full.get(x + 1, y - 1) === 0 ||
        full.get(x, y + 1) !== fans.body[i] ||
        full.get(x + 2, y + 1) !== fans.body[i]
      ) {
        continue;
      }
      fans.x[kept] = x;
      fans.y[kept] = y;
      fans.head[kept] = fans.head[i];
      fans.body[kept] = fans.body[i];
      fans.period[kept] = fans.period[i];
      fans.offset[kept] = fans.offset[i];
      kept++;
    }
    fans.n = kept;
    this.fans = fans;

    // split into the layer over the sky and the opaque layer under it
    this.upper = new Surface(g.w, g.split);
    this.upper.blit(full, 0, 0);
    this.ground = new Surface(g.w, g.h - g.split);
    this.ground.blit(full, 0, -g.split);

    if (flood > 0) {
      this.glow = new Surface(g.w, g.split);
      paintGlow(this.glow, p);
    } else {
      this.glow = null;
    }

    this.layoutBoard();
  }

  private layoutBoard(): void {
    const b = this.g.m.scoreboard;
    const st = this.stadium;
    const free = b.h - 4 - 17;
    const gap = Math.max(1, Math.floor(free / 4));
    const top = b.y + 2 + gap + Math.floor(Math.max(0, free - gap * 4) / 2);
    this.lines = [
      { text: this.header, y: top, color: P.ledGreen, big: false },
      {
        text: st.name.toUpperCase(),
        y: top + 5 + gap,
        color: P.amber,
        big: true,
      },
      {
        text: `${st.city}, ${st.country}`.toUpperCase(),
        y: top + 12 + gap * 2,
        color: P.chalk,
        big: false,
      },
    ];
  }

  private drawBoard(s: Surface, t: number): void {
    const b = this.g.m.scoreboard;
    const x0 = b.x + 4;
    const room = b.w - 8;
    for (const line of this.lines) {
      drawLedLine(s, line.text, x0, line.y, room, {
        font: line.big ? FONT_5x7 : FONT_3x5,
        color: line.color,
        t,
      });
    }
    // a status lamp on the housing, ticking once a second
    if (Math.floor(t * 2) % 2 === 0) s.px(b.x + b.w - 3, b.y + 1, P.ledRed);
  }

  private drawCrowd(s: Surface, t: number): void {
    const f = this.fans;
    const tick = Math.floor(t * 2);
    // now and then a wave runs round the ground, left to right
    const lap =
      (((t + WAVE_EVERY - WAVE_FIRST) % WAVE_EVERY) + WAVE_EVERY) % WAVE_EVERY;
    const front = Math.floor(lap * 12) * 6 - 12;
    // a celebration: everyone in reach is up and bouncing, in two groups that take turns
    const reach = this.cheerReach;
    const cheerX = this.cheerX;
    const beat = Math.floor(t * 6);
    for (let i = 0; i < f.n; i++) {
      const x = f.x[i];
      if (reach > 0 && Math.abs(x + 1 - cheerX) <= reach) {
        const y = f.y[i];
        const head = f.head[i] as Color;
        const jump = (beat + f.offset[i]) & 1;
        const body = f.body[i] as Color;
        s.hline(x, y, 3, body);
        if (jump === 1) {
          // off the ground, arms in the air
          s.hline(x, y - 1, 3, body);
          s.hline(x, y - 2, 3, head);
        } else {
          s.px(x + 1, y - 1, head);
        }
        continue;
      }
      const inWave = x <= front && x > front - 18;
      if (!inWave && (tick + f.offset[i]) % f.period[i] !== 0) continue;
      // up on his feet for half a second
      const y = f.y[i];
      const head = f.head[i] as Color;
      s.px(x + 1, y - 1, head);
      s.hline(x, y, 3, f.body[i] as Color);
      // and at the crest of the wave, arms in the air
      if (inWave && x > front - 6) {
        s.px(x, y - 1, head);
        s.px(x + 2, y - 1, head);
      }
    }
    if (this.light.lightsOn && f.n > 0) {
      // camera flashes: rare, one frame each
      const frame = Math.floor(t * 10);
      const slots = 1 + Math.floor(this.w / 160);
      for (let j = 0; j < slots; j++) {
        if (hash2(frame, j, this.seed + 41) > 0.1) continue;
        const k = Math.floor(hash2(frame, j, this.seed + 43) * f.n);
        const x = f.x[k] + 1;
        const y = f.y[k];
        s.px(x, y, P.white);
        s.px(x - 1, y, P.goldLight);
        s.px(x + 1, y, P.goldLight);
        s.px(x, y - 1, P.goldLight);
        s.px(x, y + 1, P.goldLight);
      }
    }
  }

  private drawCloths(s: Surface, t: number): void {
    const step = Math.floor(t * 4);
    for (const f of this.cloths) drawCloth(s, f, step);
  }

  private drawPennants(s: Surface, t: number): void {
    const step = Math.floor(t * 3);
    for (const f of this.pennants) drawPennant(s, f, step);
  }

  private drawBirds(s: Surface, t: number): void {
    const c = this.birdColor;
    this.perches.forEach((perch, i) => {
      // each bird looks the other way now and then, and one hops
      const beat = Math.floor(t / 1.5 + i * 0.37);
      const faceLeft = hash2(beat, i, this.seed + 61) < 0.5;
      const hop = hash2(Math.floor(t * 4), i, this.seed + 67) < 0.04 ? 1 : 0;
      const y = perch.y - 1 - hop;
      s.hline(perch.x, y, 2, c);
      s.px(faceLeft ? perch.x : perch.x + 1, y - 1, c);
      s.px(faceLeft ? perch.x + 2 : perch.x - 1, y, c);
    });
  }

  private drawLamps(s: Surface, t: number): void {
    const g = this.g;
    if (!this.light.lightsOn) return;
    const frame = Math.floor(t * 3);
    const blink = Math.floor(t) % 2 === 0;
    for (const tw of g.towers) {
      const hx = tw.hx;
      const mid = hx + Math.floor(HEAD_W / 2);
      // twinkle: one lamp in each head burns warm for a moment
      const k = Math.floor(hash2(frame, tw.x, this.seed + 51) * 12);
      const lx = hx + 1 + (k % 4) * 3;
      const ly = tw.top + 1 + Math.floor(k / 4) * 3;
      s.rect(lx, ly, 2, 2, P.goldLight);
      // a four-point flare that breathes
      const reach = 3 + ((frame + tw.x) & 1) * 2;
      const fy = tw.top + 3;
      s.hline(hx - reach, fy, reach, P.white);
      s.hline(hx + HEAD_W, fy, reach, P.white);
      s.vline(mid - 1, tw.top - reach + 1, reach - 1, P.white);
      s.vline(mid - 1, tw.top + HEAD_H, reach - 2, P.white);
      // a red light on top, for the planes
      if (blink) s.px(mid + 1, tw.top - 1, P.ledRed);
      // moths in the glare
      const beat = Math.floor(t * 8) / 8;
      for (let m = 0; m < 2; m++) {
        const a = beat * (1.9 + m * 0.7) + tw.x + m * 2.4;
        const mx = mid + Math.round(Math.sin(a) * (9 + m * 2));
        const my = tw.top + 4 + Math.round(Math.sin(a * 1.7 + m) * 6);
        s.px(mx, my, P.goldLight);
      }
    }
    // and one on the crown of the great arch
    const crown = g.arches[0];
    if (!blink) s.px(g.m.cx, g.roofY - crown.rise - 1, P.ledRed);
  }
}

function emptyFans(cap: number): FanList {
  return {
    n: 0,
    x: new Int16Array(cap),
    y: new Int16Array(cap),
    head: new Uint32Array(cap),
    body: new Uint32Array(cap),
    period: new Uint8Array(cap),
    offset: new Uint8Array(cap),
  };
}
