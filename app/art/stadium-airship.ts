/**
 * What carries the home screen's sign (the fact of the day): an airship over the town,
 * with the dot-matrix panel on its flank. In a picture taken from the air a board on posts makes no sense; an airship
 * floats in the same air as the camera (and the menu ball), is seen side-on like the sun
 * and the clouds, and leaves the pitch and the town clear.
 */

import {
  FONT_3x5,
  FONT_5x7,
  Surface,
  TRANSPARENT,
  shade,
  type Color,
} from "~/pixel";
import type { Zone } from "~/art/layout";
import { drawLedLine, drawLedPanel } from "~/art/led";
import type { Lighting } from "~/art/lighting";
import { P } from "~/art/palette";
import type { Pose } from "~/art/stadium-airship-poke";
import type { View } from "~/art/stadium-view";

export interface SignPlace {
  /** The LED panel (its housing), at rest. */
  panel: Zone;
  /** Half the envelope's length and height. */
  rx: number;
  ry: number;
  /** The envelope's centre, at rest. */
  x: number;
  y: number;
}

/**
 * Where the airship hangs for this view: beside the wordmark on a monitor, under it on a
 * phone. The panel is `menuLayout().scoreboard`; the envelope is built round it.
 */
export function signPlace(v: View): SignPlace {
  const panel = { ...v.sign };
  const roomy = panel.h >= 35;
  const rx = roomy ? 64 : Math.max(52, Math.min(60, Math.floor(v.w / 2) - 5));
  const ry = roomy ? 24 : 23;
  return {
    panel,
    rx,
    ry,
    x: panel.x + Math.floor(panel.w / 2) + (roomy ? 2 : 0),
    y: panel.y + Math.floor(panel.h / 2),
  };
}

/** Margins of the airship's own surface round the envelope. */
const PAD_X = 12;
const PAD_TOP = 9;
const PAD_BOTTOM = 10;

export interface Airship {
  layer: Surface;
  /** Where the layer goes when the airship is at rest. */
  x: number;
  y: number;
  place: SignPlace;
  /** Propeller hubs and navigation lights, relative to the layer. */
  props: { x: number; y: number }[];
  nose: { x: number; y: number };
  tail: { x: number; y: number };
  /** The envelope's centre, relative to the layer. */
  centre: { x: number; y: number };
  /** The gondola, relative to the layer. */
  gondola: { x: number; y: number; w: number; h: number };
  /** The pixels of the seams, relative to the layer: they go taut under stress. */
  seams: { x: number; y: number }[];
  /** The seam along the top of the envelope, painted only when it is stressed. */
  ridge: { x: number; y: number }[];
}

/** Paint the airship (everything but the lit text) for this light. */
export function paintAirship(place: SignPlace, light: Lighting): Airship {
  const { rx, ry } = place;
  const w = rx * 2 + 1 + PAD_X * 2;
  const h = ry * 2 + 1 + PAD_TOP + PAD_BOTTOM;
  const s = new Surface(w, h);
  const cx = PAD_X + rx;
  const cy = PAD_TOP + ry;
  const env = light.env;
  const night = light.lightsOn;

  // The envelope's half-height at a place along it: blunt nose (left), tapered tail.
  const half = (dx: number): number => {
    const u = dx / rx;
    if (u < -1 || u > 1) return -1;
    const n = u < 0 ? 2.5 : 2.1;
    const body = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(u), n)), 1 / n);
    const taper = u > 0.45 ? 1 - 0.34 * ((u - 0.45) / 0.55) ** 2 : 1;
    return ry * body * taper;
  };

  // tail fins first, so the envelope overlaps their roots
  const fin = env(P.home);
  const finDark = env(P.homeDark);
  const finLight = env(P.homeLight);
  for (let i = 0; i < 15; i++) {
    const x = cx + rx - 19 + i;
    const up = Math.round(Math.min(i * 0.95, 11) + 4);
    s.rect(x, cy - Math.round(half(rx - 19 + i)) - up + 3, 1, up, fin);
    s.px(x, cy - Math.round(half(rx - 19 + i)) - up + 3, finLight);
    s.rect(x, cy + Math.round(half(rx - 19 + i)) - 3, 1, up, finDark);
  }
  s.rect(cx + rx - 4, cy - Math.round(half(rx - 4)) - 9, 6, 1, finLight);

  // the envelope: bands of light from the top down
  const tones: readonly Color[] = [
    env(P.white),
    env(P.chalk),
    env(P.steelHi),
    env(P.mist),
    env(P.concreteLight),
  ];
  const stops = [-0.62, -0.2, 0.34, 0.74];
  for (let dx = -rx; dx <= rx; dx++) {
    const hh = half(dx);
    if (hh < 0) continue;
    const top = Math.round(-hh);
    const bottom = Math.round(hh);
    for (let dy = top; dy <= bottom; dy++) {
      const v = hh <= 0 ? 0 : dy / hh;
      let band = 0;
      while (band < stops.length && v > stops[band]) band++;
      // the nose and the tail turn away from the light a little
      if (dx > rx * 0.72 && band < 4) band++;
      s.px(cx + dx, cy + dy, tones[band]);
    }
  }
  // the nose cone and a band round the tail in the club's colour
  for (let dx = -rx; dx <= rx; dx++) {
    const hh = half(dx);
    if (hh < 0) continue;
    const nose = dx < -rx + 7;
    const band = dx > rx - 27 && dx < rx - 23;
    if (!nose && !band) continue;
    for (let dy = Math.round(-hh); dy <= Math.round(hh); dy++) {
      const v = hh <= 0 ? 0 : dy / hh;
      s.px(cx + dx, cy + dy, v < -0.45 ? finLight : v < 0.4 ? fin : finDark);
    }
  }
  // seams
  const seam = env(P.mist);
  const seams: { x: number; y: number }[] = [];
  for (const u of [-0.74, 0.8]) {
    const dx = Math.round(u * rx);
    const hh = half(dx);
    for (let dy = Math.round(-hh * 0.6); dy <= Math.round(hh * 0.3); dy++) {
      const x = cx + dx + Math.round(Math.abs(dy / ry) ** 2 * (u < 0 ? 3 : -3));
      s.px(x, cy + dy, seam);
      seams.push({ x, y: cy + dy });
    }
  }

  // the seam along the top, which only shows when the envelope is stretched taut
  const ridge: { x: number; y: number }[] = [];
  for (let dx = Math.round(-rx * 0.62); dx <= Math.round(rx * 0.6); dx++) {
    ridge.push({ x: cx + dx, y: cy - Math.round(half(dx)) + 2 });
  }

  // the gondola, slung under the middle, and two engine pods
  const gy = cy + ry + 1;
  const gx = cx - 9;
  s.rect(gx + 2, gy - 2, 1, 2, env(P.steel));
  s.rect(gx + 15, gy - 2, 1, 2, env(P.steel));
  s.rect(gx, gy, 18, 5, env(P.slate));
  s.rect(gx, gy, 18, 1, env(P.steel));
  s.rect(gx + 1, gy + 5, 16, 1, env(P.night));
  for (let i = 0; i < 5; i++) {
    s.rect(gx + 2 + i * 3, gy + 2, 2, 2, night ? P.goldLight : env(P.skyLow));
  }
  const props: { x: number; y: number }[] = [];
  for (const ex of [cx + 16, cx + 30]) {
    const ey = cy + Math.round(half(ex - cx)) + 1;
    s.rect(ex, ey, 6, 3, env(P.steel));
    s.rect(ex, ey, 6, 1, env(P.concreteLight));
    props.push({ x: ex + 6, y: ey + 1 });
  }

  // the panel on the flank
  const px = place.panel.x - (place.x - rx - PAD_X);
  const py = place.panel.y - (place.y - ry - PAD_TOP);
  s.rect(
    px - 1,
    py - 1,
    place.panel.w + 2,
    place.panel.h + 2,
    env(P.concreteDark),
  );
  drawLedPanel(s, px, py, place.panel.w, place.panel.h, { grade: env });

  return {
    layer: s,
    x: place.x - rx - PAD_X,
    y: place.y - ry - PAD_TOP,
    place,
    props,
    nose: { x: cx - rx, y: cy },
    tail: { x: cx + rx - 2, y: cy - Math.round(half(rx - 4)) - 10 },
    centre: { x: cx, y: cy },
    gondola: { x: gx, y: gy - 2, w: 18, h: 8 },
    seams,
    ridge,
  };
}

/** How far the airship has drifted from its rest at time t: whole pixels. */
export function airshipDrift(t: number): { dx: number; dy: number } {
  return {
    dx: Math.round(2 * Math.sin((2 * Math.PI * t) / 31)),
    dy: Math.round(1.2 * Math.sin((2 * Math.PI * t) / 9)),
  };
}

export interface SignText {
  /** The first line, in green: capitals, short enough to fit. */
  header: string;
  /** The fact of the day, in amber: capitals. It scrolls. */
  text: string;
}

/**
 * The fact's marquee. It starts flush left and rests SIGN_PAUSE seconds so its beginning
 * can be read, then runs left at SIGN_SPEED pixels a second (one pixel every third frame
 * at 60 Hz) until it has gone and come round again after a blank SIGN_GAP pixels wide.
 * The longest fact (110 characters, 560 px) takes 28 s to pass, the shortest 17 s.
 */
export const SIGN_SPEED = 20;
export const SIGN_PAUSE = 2.5;
export const SIGN_GAP = 36;

/**
 * The airship and the sign. `signT` is the marquee's own clock (seconds since the fact
 * started at the left).
 */
export function drawAirship(
  s: Surface,
  ship: Airship,
  text: SignText,
  light: Lighting,
  t: number,
  signT: number,
): void {
  const { dx, dy } = airshipDrift(t);
  const x = ship.x + dx;
  const y = ship.y + dy;
  s.blit(ship.layer, x, y);
  // propellers: a blade that flips
  const blade = light.env(P.steelHi);
  const flip = Math.floor(t * 8) % 2 === 0;
  for (const p of ship.props) {
    if (flip) s.rect(x + p.x, y + p.y - 2, 1, 5, blade);
    else s.rect(x + p.x, y + p.y - 1, 1, 3, blade);
  }
  // navigation lights
  if (light.lightsOn) {
    if (Math.floor(t * 1.25) % 2 === 0) {
      s.px(x + ship.tail.x, y + ship.tail.y, P.ledRed);
    }
    s.px(x + ship.nose.x - 1, y + ship.nose.y, P.ledGreen);
  }
  const z = ship.place.panel;
  drawSignText(s, text, z.x + dx, z.y + dy, z.w, z.h, signT);
}

/**
 * The sign's two lines on a panel whose top left is (x, y), centred in its height: the
 * header in the small font, and under it the fact in the big one, scrolling by the
 * marquee's clock `signT`.
 */
export function drawSignText(
  s: Surface,
  text: SignText,
  x: number,
  y: number,
  w: number,
  h: number,
  signT: number,
): void {
  const fx = x + 3;
  const fw = w - 6;
  // the lamp field is h - 4 tall; the two lines and the gap between them are 17
  const top = y + 2 + Math.max(0, Math.floor((h - 4 - 17) / 2));
  drawLedLine(s, text.header, fx, top, fw, {
    font: FONT_3x5,
    color: P.ledGreen,
  });
  drawLedLine(s, text.text, fx, top + 10, fw, {
    font: FONT_5x7,
    color: P.amber,
    align: "left",
    t: signT,
    speed: SIGN_SPEED,
    pause: SIGN_PAUSE,
    gap: SIGN_GAP,
  });
}

export interface Warp {
  /** The pivot in the source, and where it lands in the destination. */
  px: number;
  py: number;
  x: number;
  y: number;
  /** Turned this far (radians, clockwise on screen) and scaled (a negative sx mirrors). */
  angle: number;
  sx: number;
  sy: number;
  /** Mirrored (sx < 0): the back, drawn in this one colour. */
  back?: Color;
  /** Everything drawn in this one colour (a flash). */
  paint?: Color;
  /** A dent pushed in towards the pivot: depth in source pixels, centre and radius. */
  dent?: { depth: number; x: number; y: number; r: number };
  /** Only where this says yes (destination pixels). */
  keep?: (x: number, y: number) => boolean;
}

const darker = new Map<Color, Color>();
function crease(c: Color): Color {
  let d = darker.get(c);
  if (d === undefined) {
    d = shade(c, -0.22);
    if (darker.size > 512) darker.clear();
    darker.set(c, d);
  }
  return d;
}

/**
 * Draw `src` turned, scaled and dented round a pivot, nearest pixel (it stays pixel art:
 * no blending). Transparent pixels are skipped.
 */
export function warpBlit(dst: Surface, src: Surface, wp: Warp): void {
  const ax = Math.abs(wp.sx);
  const ay = Math.abs(wp.sy);
  if (!(ax > 0.01) || !(ay > 0.01)) {
    // edge on: one column
    if (ax <= 0.01 && wp.back !== undefined) {
      const top = Math.round(wp.y - wp.py * ay);
      const len = Math.round(src.h * ay);
      dst.rect(Math.round(wp.x), top, 1, Math.max(1, len), wp.back);
    }
    return;
  }
  const cos = Math.cos(wp.angle);
  const sin = Math.sin(wp.angle);
  // the source's corners, to bound the destination
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [u, v] of [
    [-wp.px, -wp.py],
    [src.w - wp.px, -wp.py],
    [-wp.px, src.h - wp.py],
    [src.w - wp.px, src.h - wp.py],
  ]) {
    const a = u * wp.sx;
    const b = v * wp.sy;
    const X = wp.x + a * cos - b * sin;
    const Y = wp.y + a * sin + b * cos;
    x0 = Math.min(x0, X);
    y0 = Math.min(y0, Y);
    x1 = Math.max(x1, X);
    y1 = Math.max(y1, Y);
  }
  const bx0 = Math.max(0, Math.floor(x0) - 1);
  const by0 = Math.max(0, Math.floor(y0) - 1);
  const bx1 = Math.min(dst.w - 1, Math.ceil(x1) + 1);
  const by1 = Math.min(dst.h - 1, Math.ceil(y1) + 1);
  const dent = wp.dent;
  const data = src.data;
  for (let Y = by0; Y <= by1; Y++) {
    for (let X = bx0; X <= bx1; X++) {
      if (wp.keep && !wp.keep(X, Y)) continue;
      const u = X + 0.5 - wp.x;
      const v = Y + 0.5 - wp.y;
      let sx = (u * cos + v * sin) / wp.sx;
      let sy = (-u * sin + v * cos) / wp.sy;
      let shadeIt = false;
      if (dent && dent.depth !== 0) {
        const d = Math.hypot(sx - dent.x, sy - dent.y);
        if (d < dent.r) {
          const f = (1 - (d / dent.r) ** 2) ** 2;
          const n = Math.hypot(dent.x, dent.y) || 1;
          // pushed in towards the middle: sample from further out
          sx += (dent.x / n) * dent.depth * f;
          sy += (dent.y / n) * dent.depth * f;
          shadeIt = dent.depth > 0 && f > 0.35;
        }
      }
      const ix = Math.floor(sx + wp.px);
      const iy = Math.floor(sy + wp.py);
      if (ix < 0 || iy < 0 || ix >= src.w || iy >= src.h) continue;
      const c = data[iy * src.w + ix] as Color;
      if (c === TRANSPARENT) continue;
      dst.data[Y * dst.w + X] =
        wp.paint !== undefined
          ? wp.paint
          : wp.sx < 0 && wp.back !== undefined
            ? wp.back
            : shadeIt
              ? crease(c)
              : c;
    }
  }
}

/**
 * The airship shaken about by a poke, stressed, or drifting in (`Pose`). `work` is a
 * scratch surface the size of the airship's layer; `signT` is the marquee's clock.
 */
export function drawAirshipPosed(
  s: Surface,
  ship: Airship,
  text: SignText,
  light: Lighting,
  t: number,
  pose: Pose,
  work: Surface,
  signT: number,
): void {
  const { dx, dy } = airshipDrift(t);
  work.clear();
  work.blit(ship.layer, 0, 0);
  const blade = light.env(P.steelHi);
  const flip = Math.floor(t * (8 + pose.stress * 10)) % 2 === 0;
  for (const p of ship.props) {
    if (flip) work.rect(p.x, p.y - 2, 1, 5, blade);
    else work.rect(p.x, p.y - 1, 1, 3, blade);
  }
  if (light.lightsOn) {
    if (Math.floor(t * (1.25 + pose.stress * 4)) % 2 === 0) {
      work.px(ship.tail.x, ship.tail.y, P.ledRed);
    }
    work.px(ship.nose.x - 1, ship.nose.y, P.ledGreen);
  }
  const z = ship.place.panel;
  if (!pose.flicker) {
    drawSignText(work, text, z.x - ship.x, z.y - ship.y, z.w, z.h, signT);
  }
  // under stress the seams go taut: pale, then stitched in red
  if (pose.stress > 0.3) {
    const hard = pose.stress > 0.6;
    const taut = light.env(P.mist);
    const red = light.env(P.homeLight);
    for (let i = 0; i < ship.seams.length; i++) {
      const q = ship.seams[i];
      work.px(q.x, q.y, hard && i % 2 === 0 ? red : taut);
    }
    // the top seam shows, then strains: stitches pulling apart in red
    for (let i = 0; i < ship.ridge.length; i++) {
      const q = ship.ridge[i];
      if (work.get(q.x, q.y) === TRANSPARENT) continue;
      const stitch = hard && i % 3 === 0;
      work.px(q.x, q.y, stitch ? red : taut);
      if (stitch && pose.stress > 0.8) work.px(q.x, q.y + 1, red);
    }
  }
  // and the pilot waves out of the gondola's front window
  if (pose.stress > 0.5) {
    const g = ship.gondola;
    const up = Math.floor(t * 5) % 2 === 0;
    const skin = light.env(P.skinB);
    work.px(g.x + 2, g.y + 4, skin);
    work.px(g.x - 1, g.y + (up ? 1 : 3), skin);
    work.px(g.x, g.y + 3, light.env(P.home));
  }
  const c = ship.centre;
  warpBlit(s, work, {
    px: c.x,
    py: c.y,
    x: ship.x + c.x + dx + pose.dx,
    y: ship.y + c.y + dy + pose.dy,
    angle: pose.angle,
    sx: pose.sx,
    sy: pose.sy,
    dent:
      pose.dent !== 0
        ? { depth: pose.dent, x: pose.dentX, y: pose.dentY, r: pose.dentR }
        : undefined,
  });
}

/**
 * Whether (x, y) is on the airship drawn at rest pushed by (ox, oy): anything it paints
 * (envelope, fins, gondola, sign), give or take a pixel, or its propellers.
 */
export function airshipHit(
  ship: Airship,
  x: number,
  y: number,
  ox: number,
  oy: number,
): boolean {
  const lx = Math.floor(x) - ship.x - ox;
  const ly = Math.floor(y) - ship.y - oy;
  const L = ship.layer;
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const X = lx + i;
      const Y = ly + j;
      if (X < 0 || Y < 0 || X >= L.w || Y >= L.h) continue;
      if (L.data[Y * L.w + X] !== TRANSPARENT) return true;
    }
  }
  for (const p of ship.props) {
    if (Math.abs(lx - p.x) <= 1 && Math.abs(ly - p.y) <= 3) return true;
  }
  return false;
}
