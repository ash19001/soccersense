/**
 * The fact of the day on the home screen, towed across the sky: a little plane (propeller,
 * high wing, the pilot's head in the window, landing gear) flies by now and then from right
 * to left with a banner on a tow rope behind it that says "DID YOU KNOW? ..." and the fact,
 * in painted letters (docs/ART_BIBLE.md 2.1; the home picture draws it in stadium.ts).
 *
 * - **When**: the first pass starts PLANE_FIRST seconds after the page opens, then one every
 *   PLANE_EVERY seconds (about once a minute). A pass lasts as long as the whole train takes
 *   to cross the canvas at PLANE_SPEED.
 * - **Where** (`planeRoute`): where the airship hung until 2026-11-13 (PLANE_DROP under the
 *   wordmark's zone; the airship is now higher, in the top left), in front of the far city.
 *   Never in the wordmark's zone and never over the stadium's far stand: where the sky is
 *   short (1366 x 768, a phone) it comes down no further than just above the stand's roof,
 *   and where the airship hangs across its height (a phone) it flies under the airship's
 *   gondola. It is drawn before the airship, so where they meet it passes behind.
 * - **Reading**: the banner moves one canvas pixel a frame at 60 Hz (60 px a second), about
 *   ten letters a second in the big small face (`FONT_5x7`, capitals 7 px tall), so each
 *   letter is in the clear sky for several seconds; a long fact makes a long banner, never
 *   a smaller one.
 * - **Night**: the plane has navigation lamps (red on the near wing tip, white on the tail,
 *   a blinking red beacon) and the banner carries a row of little lamps along its top edge
 *   that light it, so its cloth and letters keep their floodlit colours.
 *
 * Pure: the clock and the text come in; no randomness.
 */

import {
  Surface,
  TRANSPARENT,
  drawSprite,
  drawText,
  measureText,
  shade,
  sprite,
  FONT_5x7,
  type Color,
} from "~/pixel";
import { menuLayout, type Zone } from "~/art/layout";
import type { Lighting } from "~/art/lighting";
import { P } from "~/art/palette";
import type { View } from "~/art/stadium-view";

/** Seconds after the page opens that the first pass starts. */
export const PLANE_FIRST = 6;
/** Seconds from the start of one pass to the start of the next. */
export const PLANE_EVERY = 70;
/** Pixels a second: a canvas pixel a frame. */
export const PLANE_SPEED = 60;

/**
 * The plane, facing left (it flies right to left), 36 x 16; its propeller is drawn in
 * front of the spinner (`PROP_X`). Outlined in ink like every interactive thing.
 *
 * k ink, Y lit top, y body, d shade, r stripe, R stripe's shade, w glass, W glint,
 * h the pilot's leather cap, g goggles, s skin, m steel, n tyre.
 */
const ROWS = [
  "..........kkkkkkkkkkkkkkkkkk........",
  ".........kYYYYYYYYYYYYYYYYYYk...kkk.",
  ".........kyyyyyyyyyyyyyyyyyyk..kYyk.",
  ".........kddddddddddddddddddk.kYyyk.",
  "....kkkkkkkkkkkkkkkkkkkkkkkkk.kYydk.",
  "...kYYYYkwWwwkwhhwwkmYYYYYYYYkYyydk.",
  "..kYyyyykwwwwkwggswkyymyyyyyyyyyydkk",
  ".kmyyyyykwwwwkwssswkyyyymyyyyyyyyyYk",
  ".kmrrrrrrrrrrrrrrrrrrrrrrmrrrrrrrrdk",
  ".kmRRRRRRRRRRRRRRRRRRRRRRRmRRRRkkkk.",
  "..kddddddddddddddddddddddddkkkk.....",
  "...kkkkkmkkkkkkkkkkkkkkkkkk.........",
  "........km..........................",
  "......kkmkk.........................",
  ".....knnmnnk........................",
  "......knnnk.........................",
];
const LEGEND = "kYydrRwWhgsmn";
const PLANE = sprite(ROWS.join("\n"), LEGEND);
/** The plane's size, and where things are on it. */
const PLANE_W = 36;
const PLANE_H = 16;
/** The spinner's middle row; the propeller turns in front of it. */
const PROP_Y = 7;
/** The tow hook under the tail, and the lamps. */
const HOOK = { x: 33, y: 10 };
const WING_TIP = { x: 10, y: 2 };
const TAIL_LAMP = { x: 35, y: 7 };
const BEACON = { x: 26, y: 4 };

/**
 * The banner's letters: the main face at its own size, capitals 7 px tall (they were the
 * painted face's 10 until the product owner asked for smaller facts on the plane).
 */
const BANNER_FONT = FONT_5x7;
/** The cloth round the letters: a 2 px hem and 1 px of clear cloth, top and bottom. */
const CLOTH_PAD = 3;
/** The rope from the tail hook to the bridle's ring, and the bridle. */
const ROPE = 30;
const BRIDLE = 10;
/** The spreader pole at the banner's leading edge. */
const POLE = 2;

/** One banner, painted flat for a light, with its folds in shade beside it. */
export interface Banner {
  text: string;
  light: Lighting;
  flat: Surface;
  folded: Surface;
}

/** The banner's words: the header and the fact, in capitals, on one line. */
export function bannerWords(header: string, fact: string): string {
  const line = (x: string): string =>
    x.replace(/\s+/g, " ").trim().toUpperCase();
  const h = line(header);
  const f = line(fact);
  return h === "" ? f : f === "" ? h : `${h} ${f}`;
}

/** The colours of the cloth and its letters in this light. */
function clothColors(light: Lighting): {
  cloth: Color;
  hem: Color;
  ink: Color;
  head: Color;
} {
  // At night the lamps along its top light the banner like a floodlit board.
  const g = light.lightsOn ? light.lit : light.env;
  return {
    cloth: g(P.chalk),
    hem: g(P.home),
    ink: g(P.night),
    head: g(P.homeDark),
  };
}

/**
 * Paint the banner for `text` in this light: the cloth with a hem top and bottom in the
 * club's red, the header (up to its "?") in red and the rest in ink, in `FONT_5x7`'s
 * capitals (7 px): 13 px of cloth.
 */
export function paintBanner(text: string, light: Lighting): Banner {
  const font = BANNER_FONT;
  const pad = CLOTH_PAD;
  const tw = measureText(text, { font });
  const w = tw + pad * 4;
  const h = font.capHeight + pad * 2;
  const flat = new Surface(Math.max(1, w), h);
  const c = clothColors(light);
  flat.rect(0, 0, w, h, c.cloth);
  flat.rect(0, 0, w, 2, c.hem);
  flat.rect(0, h - 2, w, 2, c.hem);
  // the header in red, the fact in ink
  const q = text.indexOf("?");
  const head = q >= 0 ? text.slice(0, q + 1) : "";
  const x0 = pad * 2;
  const y0 = pad;
  if (head !== "") {
    drawText(flat, head, x0, y0, c.head, { font });
    const rest = text.slice(q + 1);
    drawText(flat, rest, x0 + measureText(head, { font }), y0, c.ink, { font });
  } else {
    drawText(flat, text, x0, y0, c.ink, { font });
  }
  // the folds: the same cloth a tone darker, turned from the light
  const folded = new Surface(flat.w, flat.h);
  const darker = new Map<Color, Color>();
  for (let i = 0; i < flat.data.length; i++) {
    const v = flat.data[i] as Color;
    if (v === TRANSPARENT) continue;
    let d = darker.get(v);
    if (d === undefined) {
      d = shade(v, -0.1);
      darker.set(v, d);
    }
    folded.data[i] = d;
  }
  return { text, light, flat, folded };
}

/** The whole train's length: the plane, the rope and bridle, and the banner. */
export function trainLength(banner: Banner): number {
  return PLANE_W + ROPE + BRIDLE + banner.flat.w;
}

/**
 * How far under the wordmark's zone the plane flies, where there is room: the row the
 * airship's sign hung on until 2026-11-13 (48 px on a monitor, 46 on a phone).
 */
export const PLANE_DROP = 48;

/**
 * The rows the plane and its banner take round the row they fly along (the plane's
 * middle): the plane's top with its bob, and the banner's bottom with its bob and ripple.
 */
const ABOVE = Math.floor(PLANE_H / 2) + 1;
const BELOW = 12;

/**
 * The row the plane flies along (its middle), for a view whose airship covers `ship` at
 * rest (down to its gondola's keel): PLANE_DROP under the wordmark's zone, or under the
 * airship where it hangs across that row; never in the wordmark's zone, and its banner
 * never down over the stadium's far stand (4 px above its roof) or the ball.
 */
export function planeRoute(v: View, ship: Zone): number {
  const m = menuLayout(v.w, v.h);
  let y = v.logoH + PLANE_DROP;
  // the airship (and its drift) across that row: under its keel
  if (ship.y - 2 <= y + BELOW && ship.y + ship.h + 2 >= y - ABOVE) {
    y = ship.y + ship.h + 2 + ABOVE + 2;
  }
  const lowest = Math.min(m.stand.y, m.ballCy - m.ballR) - 4 - BELOW;
  return Math.max(v.logoH + ABOVE, Math.min(y, lowest));
}

/**
 * Where the plane's nose is at `t` on a canvas `w` wide (null between passes), for a
 * train `length` long.
 */
export function planeAt(t: number, w: number, length: number): number | null {
  if (!Number.isFinite(t) || t < PLANE_FIRST) return null;
  const since = (t - PLANE_FIRST) % PLANE_EVERY;
  const x = Math.round(w + 4 - since * PLANE_SPEED);
  return x + length < -4 ? null : x;
}

/**
 * The plane and its banner at `t`, the plane's middle on row `y`. Nothing between passes.
 */
export function drawFlyby(
  s: Surface,
  banner: Banner,
  y: number,
  light: Lighting,
  t: number,
): void {
  const x = planeAt(t, s.w, trainLength(banner));
  if (x === null) return;
  // a gentle bob, in whole pixels; the banner rides a moment behind
  const bob = (u: number): number =>
    Math.round(Math.sin((2 * Math.PI * u) / 3.1));
  const py = y - Math.floor(PLANE_H / 2) + bob(t);
  drawTowed(s, banner, x, y, light, t, bob);
  drawPlaneAt(s, x, py, light, t);
}

/** The rope, the bridle and the rippling banner behind a plane whose nose is at x. */
function drawTowed(
  s: Surface,
  banner: Banner,
  x: number,
  y: number,
  light: Lighting,
  t: number,
  bob: (u: number) => number,
): void {
  const lag = 0.4;
  const hx = x + HOOK.x;
  const hy = y - Math.floor(PLANE_H / 2) + bob(t) + HOOK.y;
  const bh = banner.flat.h;
  const bx = hx + ROPE + BRIDLE;
  const by = y - Math.floor(bh / 2) + bob(t - lag) + 2;
  // the rope: a sagging line, 2 px thick (its lit top, its shade under it)
  const ringX = hx + ROPE;
  const ringY = by + Math.floor(bh / 2);
  const rope = light.env(P.steel);
  const ropeLit = light.env(P.mist);
  for (let i = 0; i <= ROPE; i++) {
    const u = i / ROPE;
    const ry = Math.round(hy + (ringY - hy) * u + 3 * Math.sin(Math.PI * u));
    s.px(hx + i, ry, ropeLit);
    s.px(hx + i, ry + 1, rope);
  }
  // the bridle: from the ring to the pole's ends
  s.line(ringX, ringY, bx - 1, by - 1, rope);
  s.line(ringX, ringY + 1, bx - 1, by + bh, rope);
  // the banner, a column at a time, rippling: a wave runs back along it
  const W = banner.flat.w;
  const x0 = Math.max(0, -bx);
  const x1 = Math.min(W, s.w - bx);
  for (let i = x0; i < x1; i++) {
    const phase = (2 * Math.PI * i) / 46 - t * 7;
    // the cloth hangs from the pole: still at its leading edge, freer behind
    const reach = Math.min(1, i / 40);
    const dy = Math.round(reach * Math.sin(phase));
    const turned = reach > 0.3 && Math.cos(phase) < -0.8;
    s.blit(turned ? banner.folded : banner.flat, bx + i, by + dy, {
      sx: i,
      sy: 0,
      sw: 1,
      sh: bh,
    });
  }
  // the pole at its leading edge, a little taller than the cloth
  const pole = light.env(P.woodDark);
  s.rect(bx - POLE, by - 1, POLE, bh + 2, pole);
  s.rect(bx - POLE, by - 1, 1, bh + 2, light.env(P.wood));
  // at night a row of little lamps along its top lights it
  if (light.lightsOn) {
    for (let i = 8; i < W - 4; i += 16) {
      const X = bx + i;
      if (X < -1 || X > s.w) continue;
      const phase = (2 * Math.PI * i) / 46 - t * 7;
      const dy = Math.round(Math.min(1, i / 40) * Math.sin(phase));
      s.px(X, by + dy - 1, P.goldLight);
      s.px(X + 1, by + dy - 1, P.gold);
    }
  }
}

/** The plane with its top left at (x, y), and its propeller turning. */
function drawPlaneAt(
  s: Surface,
  x: number,
  y: number,
  light: Lighting,
  t: number,
): void {
  const g = light.env;
  const night = light.lightsOn;
  drawSprite(s, PLANE, 0, x, y, [
    g(P.ink),
    g(P.goldLight),
    g(P.gold),
    g(P.goldDark),
    g(P.home),
    g(P.homeDark),
    // at night the cabin is lit: its windows are a light source, the pilot against them
    night ? P.goldDark : g(P.skyLow),
    night ? P.gold : g(P.white),
    g(P.woodDark),
    g(P.steelHi),
    g(P.skinA),
    g(P.steel),
    g(P.night),
  ]);
  // the propeller: a blade with a lit face and a shaded one, full length or edge on
  const lit = g(P.steelHi);
  const dim = g(P.mist);
  const px = x - 1;
  const py = y + PROP_Y;
  if (Math.floor(t * 12) % 2 === 0) {
    s.rect(px - 1, py - 6, 1, 13, lit);
    s.rect(px, py - 6, 1, 13, dim);
  } else {
    s.rect(px - 1, py - 2, 1, 5, dim);
    s.rect(px, py - 2, 1, 5, lit);
  }
  s.rect(px, py - 1, 2, 3, g(P.concrete));
  if (night) {
    s.rect(x + WING_TIP.x, y + WING_TIP.y, 2, 2, P.ledRed);
    s.px(x + TAIL_LAMP.x, y + TAIL_LAMP.y, P.white);
    if (Math.floor(t * 1.5) % 2 === 0) {
      s.rect(x + BEACON.x, y + BEACON.y - 1, 2, 1, P.ledRed);
    }
  }
}

/** The plane alone with its top left at (x, y), for sheets. */
export function drawPlane(
  s: Surface,
  x: number,
  y: number,
  light: Lighting,
  t: number,
): void {
  drawPlaneAt(s, x, y, light, t);
}

/** The plane's size. */
export const PLANE_SIZE = { w: PLANE_W, h: PLANE_H } as const;
