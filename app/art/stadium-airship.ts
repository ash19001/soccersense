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
  wrapText,
  type BitmapFont,
  type Color,
} from "~/pixel";
import { AIRSHIP_SIZE, type Zone } from "~/art/layout";
import { drawLedLine, drawLedPanel, ledLap, measureLamps } from "~/art/led";
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
  /** Its size against the layout's sign zone: every length of the drawing is scaled by it. */
  size: number;
}

/**
 * Where the airship hangs for this view: high in the top left of the sky, beside the
 * wordmark on a monitor, under it on a phone. The panel is `menuLayout().scoreboard`
 * shrunk to `AIRSHIP_SIZE`; the envelope is built round it.
 */
export function signPlace(v: View): SignPlace {
  const panel = { ...v.sign };
  const roomy = panel.h >= 70;
  const rx = roomy
    ? 128
    : Math.max(104, Math.min(120, Math.floor(v.w / 2) - 10));
  const ry = roomy ? 48 : 46;
  const x = panel.x + Math.floor(panel.w / 2) + (roomy ? 4 : 0);
  const y = panel.y + Math.floor(panel.h / 2);

  // Smaller than the zone (the owner's wish), round the same centre and in the same
  // proportions; the panel keeps whole lamps (even sizes), and is never smaller than
  // "DID YOU KNOW?" over a big line needs (SIGN_MIN_W x SIGN_MIN_H: 2 px more each way
  // on a phone).
  const k = AIRSHIP_SIZE;
  const even = (n: number): number => 2 * Math.round((n * k) / 2);
  const w = Math.min(Math.max(SIGN_MIN_W, even(panel.w)), v.w - (v.w % 2));
  const h = Math.max(SIGN_MIN_H, even(panel.h));
  return {
    panel: {
      x: x - (roomy ? Math.round(4 * k) : 0) - Math.floor(w / 2),
      y: y - Math.floor(h / 2),
      w,
      h,
    },
    rx: Math.round(rx * k),
    ry: Math.round(ry * k),
    x,
    y,
    size: k,
  };
}

/** How big the airship is against the layout's sign zone (`~/art/layout`). */
export { AIRSHIP_SIZE };

/**
 * The panel's least height: its housing and margin (10 px) and 17 rows of lamps on the
 * 2 px pitch, a header in the small face over a line in the big one.
 */
export const SIGN_MIN_H = 44;
/**
 * The panel's least width: its housing and margins (12 px) and "DID YOU KNOW?", the
 * header the fact comes under, in the small face (100 px of lamps), so that never scrolls.
 */
export const SIGN_MIN_W = 112;

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

/** Margins of the layer round the envelope (then sized). */
const PAD_X = 24;
const PAD_TOP = 18;
const PAD_BOTTOM = 20;

/** The envelope's half-height at a place along it. */
function halfOf(rx: number, ry: number): (dx: number) => number {
  return (dx: number): number => {
    const u = dx / rx;
    if (u < -1 || u > 1) return -1;
    const n = u < 0 ? 2.5 : 2.1;
    const body = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(u), n)), 1 / n);
    const taper = u > 0.45 ? 1 - 0.34 * ((u - 0.45) / 0.55) ** 2 : 1;
    return ry * body * taper;
  };
}

/** Paint the airship (everything but the lit text) for this light. */
export function paintAirship(place: SignPlace, light: Lighting): Airship {
  const { rx, ry } = place;
  // Every length of the drawing at the airship's size (`signPlace`: 7/8 of the layout's),
  // so it keeps its proportions; 1 and 2 px details stay as they are.
  const K = (n: number): number => Math.round(n * place.size);
  const padX = K(PAD_X);
  const padTop = K(PAD_TOP);
  const w = rx * 2 + 1 + padX * 2;
  const h = ry * 2 + 1 + padTop + K(PAD_BOTTOM);
  const s = new Surface(w, h);
  const cx = padX + rx;
  const cy = padTop + ry;
  const env = light.env;
  const night = light.lightsOn;
  const half = halfOf(rx, ry);
  const topAt = (dx: number): number => cy - Math.round(half(dx));
  const bottomAt = (dx: number): number => cy + Math.round(half(dx));

  // ---- tail fins first, so the envelope overlaps their roots ----------------------
  const fin = env(P.home);
  const finDark = env(P.homeDark);
  const finLight = env(P.homeLight);
  const FIN = K(30);
  const HINGE = K(20);
  for (let i = 0; i < FIN; i++) {
    const dx = rx - K(38) + i;
    const x = cx + dx;
    const up = Math.round(Math.min(i * 0.95, K(22)) + K(8));
    const t0 = topAt(dx) - up + K(6);
    s.rect(x, t0, 1, up, fin);
    // the leading edge catches the light: two pixels where it climbs, one where it is flat
    s.px(x, t0, finLight);
    if (i < K(23)) s.px(x, t0 + 1, finLight);
    // the rudder's hinge, and the elevator's under the envelope
    if (i === HINGE) s.rect(x, t0 + 2, 1, up - 2, finDark);
    const b0 = bottomAt(dx) - K(6);
    s.rect(x, b0, 1, up, finDark);
    if (i === HINGE) s.rect(x, b0, 1, up - 1, fin);
    // its lower edge, turned from the light
    s.px(x, b0 + up - 1, env(P.night));
  }
  // the little stabiliser across the tail's tip, edge on
  const capY = topAt(rx - K(8)) - K(18);
  s.rect(cx + rx - K(8), capY, K(12), 2, finLight);
  s.rect(cx + rx - K(8), capY + 1, K(12), 1, fin);

  // ---- the envelope: bands of light from the top down ----------------------------
  const tones: readonly Color[] = [
    env(P.white),
    env(P.chalk),
    env(P.steelHi),
    env(P.mist),
    env(P.concreteLight),
  ];
  const stops = [-0.62, -0.2, 0.34, 0.74];
  const turn = rx * 0.72;
  const bandAt = (dx: number, dy: number, hh: number): number => {
    const v = hh <= 0 ? 0 : dy / hh;
    let band = 0;
    while (band < stops.length && v > stops[band]) band++;
    // the nose and the tail turn away from the light a little
    if (dx > turn && band < 4) band++;
    return band;
  };
  for (let dx = -rx; dx <= rx; dx++) {
    const hh = half(dx);
    if (hh < 0) continue;
    const top = Math.round(-hh);
    const bottom = Math.round(hh);
    let above = -1;
    for (let dy = top; dy <= bottom; dy++) {
      const band = bandAt(dx, dy, hh);
      let c = tones[band];
      const x = cx + dx;
      const y = cy + dy;
      // where one band meets the next, a row (or a column) of both, chequered
      const odd = ((x + y) & 1) === 1;
      if (odd && above >= 0 && band !== above) c = tones[above];
      else if (odd && dx - 1 <= turn && dx > turn) {
        c = tones[bandAt(dx - 1, dy, half(dx - 1))];
      }
      above = band;
      s.px(x, y, c);
    }
  }
  // the nose cone and a band round the tail in the club's colour
  for (let dx = -rx; dx <= rx; dx++) {
    const hh = half(dx);
    if (hh < 0) continue;
    const nose = dx < -rx + K(14);
    const band = dx > rx - K(54) && dx < rx - K(46);
    if (!nose && !band) continue;
    for (let dy = Math.round(-hh); dy <= Math.round(hh); dy++) {
      const v = hh <= 0 ? 0 : dy / hh;
      let c = v < -0.45 ? finLight : v < 0.4 ? fin : finDark;
      // a lit rim along the cone's back edge and the band's front one
      if (
        (dx === -rx + K(14) - 1 || dx === rx - K(54) + 1) &&
        v > -0.75 &&
        v < 0.4
      ) {
        c = finLight;
      }
      s.px(cx + dx, cy + dy, c);
    }
  }
  // the mooring cap on the very nose
  for (let dx = -rx; dx < -rx + 3; dx++) {
    const hh = Math.min(3, Math.round(half(dx)));
    s.rect(cx + dx, cy - hh, 1, hh * 2 + 1, finDark);
  }
  s.px(cx - rx + 1, cy - 2, fin);

  // seams: the two the stress pulls taut (1 px, like every line drawn on a surface)
  const seam = env(P.mist);
  const seams: { x: number; y: number }[] = [];
  for (const u of [-0.74, 0.8]) {
    const dx = Math.round(u * rx);
    const hh = half(dx);
    for (let dy = Math.round(-hh * 0.6); dy <= Math.round(hh * 0.3); dy++) {
      const x =
        cx + dx + Math.round(Math.abs(dy / ry) ** 2 * K(u < 0 ? 6 : -6));
      s.px(x, cy + dy, seam);
      seams.push({ x, y: cy + dy });
    }
  }

  // the seam along the top, which only shows when the envelope is stretched taut
  const ridge: { x: number; y: number }[] = [];
  for (let dx = Math.round(-rx * 0.62); dx <= Math.round(rx * 0.6); dx++) {
    ridge.push({ x: cx + dx, y: cy - Math.round(half(dx)) + 4 });
  }

  // ---- the gondola, slung under the middle ----------------------------------------
  const gw = 2 * Math.round(K(36) / 2);
  const gy = cy + ry + 2;
  const gx = cx - gw / 2;
  const steel = env(P.steel);
  const slate = env(P.slate);
  // its struts, 2 px each
  s.rect(gx + 4, gy - 4, 2, 4, steel);
  s.rect(gx + gw - 6, gy - 4, 2, 4, steel);
  s.px(gx + 4, gy - 4, env(P.concreteLight));
  s.px(gx + gw - 6, gy - 4, env(P.concreteLight));
  // the cabin: a lit roof, the club's stripe, rounded corners, a keel
  s.rect(gx, gy, gw, 10, slate);
  s.rect(gx, gy, gw, 2, steel);
  s.rect(gx + 1, gy, K(12), 1, env(P.concreteLight));
  s.rect(gx, gy + 8, gw, 1, env(P.home));
  s.rect(gx + 2, gy + 10, gw - 4, 2, env(P.night));
  s.erase(gx, gy, 1, 1);
  s.erase(gx + gw - 1, gy, 1, 1);
  s.erase(gx, gy + 9, 1, 1);
  s.erase(gx + gw - 1, gy + 9, 1, 1);
  // the windscreen at the front (the nose is to the left), then four windows
  const glass = night ? P.goldLight : env(P.skyLow);
  const glassLow = night ? P.gold : env(P.skyMid);
  const glint = night ? P.white : env(P.white);
  const windows = Math.floor((gw - 6) / 6);
  for (let i = 0; i < windows; i++) {
    const wx = gx + 4 + i * 6;
    const wy = gy + 3;
    s.rect(wx, wy, 4, 4, glass);
    s.rect(wx, wy + 3, 4, 1, glassLow);
    s.px(wx, wy, glint);
  }
  // the windscreen leans back: its top front corner is the cabin's
  s.rect(gx + 1, gy + 3, 2, 3, glass);
  s.px(gx + 1, gy + 3, glint);
  s.px(gx + 1, gy + 6, glassLow);

  // ---- two engine pods on pylons ---------------------------------------------------
  const props: { x: number; y: number }[] = [];
  for (const ex of [cx + K(32), cx + K(60)]) {
    const ey = cy + Math.round(half(ex - cx)) + 2;
    s.rect(ex + 4, ey - 2, 4, 2, steel);
    s.rect(ex, ey, 12, 6, steel);
    s.rect(ex, ey, 12, 2, env(P.concreteLight));
    s.rect(ex + 1, ey, 6, 1, env(P.steelHi));
    s.rect(ex, ey + 5, 12, 1, slate);
    // rounded intake at the front, the exhaust behind
    s.erase(ex, ey, 1, 1);
    s.erase(ex, ey + 5, 1, 1);
    s.rect(ex, ey + 2, 1, 2, env(P.night));
    s.rect(ex + 11, ey + 2, 1, 2, slate);
    props.push({ x: ex + 12, y: ey + 2 });
  }

  // ---- the panel on the flank, in a 2 px housing ------------------------------------
  const px = place.panel.x - (place.x - rx - padX);
  const py = place.panel.y - (place.y - ry - padTop);
  const pw = place.panel.w;
  const ph = place.panel.h;
  s.rect(px - 2, py - 2, pw + 4, ph + 4, env(P.concreteDark));
  s.rect(px - 2, py - 2, pw + 4, 1, env(P.concrete));
  // bolts at its corners
  const bolt = env(P.steel);
  for (const [bx, by] of [
    [px - 1, py - 1],
    [px + pw, py - 1],
    [px - 1, py + ph],
    [px + pw, py + ph],
  ]) {
    s.px(bx, by, bolt);
  }
  drawLedPanel(s, px, py, pw, ph, { grade: env });

  return {
    layer: s,
    x: place.x - rx - padX,
    y: place.y - ry - padTop,
    place,
    props,
    nose: { x: cx - rx, y: cy },
    tail: { x: cx + rx - 4, y: capY - 2 },
    centre: { x: cx, y: cy },
    gondola: { x: gx, y: gy - 4, w: gw, h: 16 },
    seams,
    ridge,
  };
}

// ---------------------------------------------------------------------------
// In the air: propellers, lamps, the pilot at his window
// ---------------------------------------------------------------------------

/**
 * The propellers on `s` with the layer at (x, y): a spinner, and a blade of two columns
 * (its lit face and its shaded one) that flips between full length (10) and edge on (6).
 */
function drawProps(
  s: Surface,
  x: number,
  y: number,
  ship: Airship,
  light: Lighting,
  flip: boolean,
): void {
  const lit = light.env(P.steelHi);
  const dim = light.env(P.mist);
  const hub = light.env(P.concrete);
  for (const p of ship.props) {
    const X = x + p.x;
    const Y = y + p.y;
    if (flip) {
      s.rect(X + 1, Y - 4, 1, 10, lit);
      s.rect(X + 2, Y - 4, 1, 10, dim);
      s.px(X + 1, Y - 4, dim);
      s.px(X + 2, Y + 5, hub);
    } else {
      s.rect(X + 1, Y - 2, 1, 6, dim);
      s.rect(X + 2, Y - 2, 1, 6, lit);
      s.px(X + 2, Y + 3, dim);
    }
    s.rect(X, Y, 1, 2, hub);
    s.rect(X + 1, Y, 2, 2, hub);
    s.px(X + 1, Y, lit);
  }
}

/** The navigation lamps at night: green on the nose, red on the tail (when it blinks on). */
function drawNavLights(
  s: Surface,
  x: number,
  y: number,
  ship: Airship,
  red: boolean,
): void {
  if (red) {
    s.rect(x + ship.tail.x, y + ship.tail.y, 2, 2, P.ledRed);
    s.px(x + ship.tail.x, y + ship.tail.y, P.white);
  }
  s.rect(x + ship.nose.x - 2, y + ship.nose.y - 1, 2, 2, P.ledGreen);
  s.px(x + ship.nose.x - 2, y + ship.nose.y - 1, P.white);
}

/** The pilot leaning out of the windscreen and waving (the airship is about to go). */
function drawPilotWave(
  s: Surface,
  ship: Airship,
  light: Lighting,
  up: boolean,
): void {
  const g = ship.gondola;
  const skin = light.env(P.skinB);
  const coat = light.env(P.home);
  const cap = light.env(P.woodDark);
  // his head in the front window
  const hx = g.x + 4;
  const hy = g.y + 7;
  s.rect(hx, hy, 3, 1, cap);
  s.rect(hx, hy + 1, 3, 2, skin);
  s.px(hx, hy + 1, cap);
  s.px(hx + 2, hy + 2, light.env(P.skinBShade));
  // his arm out of the windscreen, waving
  s.rect(g.x - 1, g.y + 9, 3, 2, coat);
  if (up) {
    s.rect(g.x - 2, g.y + 5, 1, 4, coat);
    s.rect(g.x - 3, g.y + 3, 2, 2, skin);
  } else {
    s.rect(g.x - 3, g.y + 8, 2, 2, coat);
    s.rect(g.x - 4, g.y + 6, 2, 2, skin);
  }
}

/** How far the airship has drifted from its rest at time t: whole pixels. */
export function airshipDrift(t: number): { dx: number; dy: number } {
  return {
    dx: Math.round(4 * Math.sin((2 * Math.PI * t) / 31)),
    dy: Math.round(2.4 * Math.sin((2 * Math.PI * t) / 9)),
  };
}

/** One message on the sign: a header in green over a line in amber, capitals. */
export interface SignText {
  /** The first line, in the small font, in green: short enough to fit. */
  header: string;
  /**
   * Under it, in amber: in the big font when it fits, else in the small one (on two lines
   * if need be), else in the big one as a marquee (the fact of the day did that).
   */
  text: string;
}

/**
 * A line that is too long for the sign runs as a marquee. It starts flush left and rests
 * SIGN_PAUSE seconds so its beginning can be read, then runs left at SIGN_SPEED lamps a
 * second (a lamp every third frame at 60 Hz) until it has gone and come round again after
 * a blank SIGN_GAP lamps wide.
 */
export const SIGN_SPEED = 20;
export const SIGN_PAUSE = 2.5;
export const SIGN_GAP = 36;
/**
 * With several messages the sign shows each for SIGN_HOLD seconds (or until its marquee
 * has gone round once, if that is longer), then rolls it up out of the panel and the next
 * one up into it, a lamp at a time, in SIGN_ROLL seconds: an LED sign's change, not a fade.
 */
export const SIGN_HOLD = 4;
export const SIGN_ROLL = 0.6;

/** The amber line, as it is drawn. */
interface SignLine {
  text: string;
  font: BitmapFont;
}

const MARQUEE = {
  font: FONT_5x7,
  speed: SIGN_SPEED,
  pause: SIGN_PAUSE,
  gap: SIGN_GAP,
} as const;

/** A message as it sits on the sign. */
interface SignLayout {
  lines: SignLine[];
  /** Rows of lamps it takes, the header and the gaps included. */
  rows: number;
  /** Seconds it wants to be shown. */
  hold: number;
}

/** Each message laid out once per panel width (they are drawn every frame). */
const layouts = new WeakMap<SignText, { key: string; layout: SignLayout }>();

/** The header's marquee, when it is too long for the panel: the small face, the same pace. */
const HEADER = { ...MARQUEE, font: FONT_3x5 } as const;

/** Rows of lamps a panel `h` tall has: its housing and margins take 10 px. */
function lampRows(h: number): number {
  return Math.floor((h - 10) / 2);
}

/**
 * How a message sits on a panel `w` wide and `h` tall (the lamps' window is `w - 12`):
 * its amber text in the big font if it fits, else in the small one, on one line or two
 * (if the panel is tall enough for two), else in the big one scrolling; how many rows of
 * lamps it takes; and how long it wants to be shown. A header too long for the window
 * scrolls too, in step with the line under it.
 */
function layoutSign(m: SignText, w: number, h: number): SignLayout {
  const key = `${w}x${h}/${m.header}/${m.text}`;
  const hit = layouts.get(m);
  if (hit?.key === key) return hit.layout;
  const layout = layOut(m, w, h);
  layouts.set(m, { key, layout });
  return layout;
}

/** Rows of lamps a message takes: the header (5) and a gap, then its lines. */
function rowsOf(header: string, lines: readonly SignLine[]): number {
  const big = lines[0].font === FONT_5x7;
  const head = header === "" ? 0 : big ? 10 : 9;
  return head + (big ? 7 : lines.length * 5 + (lines.length - 1) * 2);
}

function layOut(m: SignText, w: number, h: number): SignLayout {
  const fw = w - 12;
  let lines: SignLine[];
  if (measureLamps(m.text, FONT_5x7) <= fw) {
    lines = [{ text: m.text, font: FONT_5x7 }];
  } else if (measureLamps(m.text, FONT_3x5) <= fw) {
    lines = [{ text: m.text, font: FONT_3x5 }];
  } else {
    const two = wrapText(m.text, Math.floor(fw / 2), { font: FONT_3x5 });
    const small = two.map((text) => ({ text, font: FONT_3x5 }));
    lines =
      two.length === 2 &&
      two.every((l) => measureLamps(l, FONT_3x5) <= fw) &&
      rowsOf(m.header, small) <= lampRows(h)
        ? small
        : [{ text: m.text, font: FONT_5x7 }];
  }
  const big = lines[0].font === FONT_5x7;
  const lap = Math.max(
    ledLap(m.header, fw, HEADER),
    big ? ledLap(m.text, fw, MARQUEE) : 0,
  );
  return {
    lines,
    rows: rowsOf(m.header, lines),
    hold: Math.max(SIGN_HOLD, lap > 0 ? lap + 0.5 : 0),
  };
}

/**
 * Whether a message fits a panel `w` wide and `h` tall (default: tall enough for any) as
 * it is, with no line scrolling.
 */
export function signFits(m: SignText, w: number, h = 70): boolean {
  const fw = w - 12;
  const { lines, rows } = layoutSign(m, w, h);
  return (
    rows <= lampRows(h) &&
    measureLamps(m.header, FONT_3x5) <= fw &&
    lines.every((l) => measureLamps(l.text, l.font) <= fw)
  );
}

/**
 * Whether a message shows whole on a panel `w` x `h`: every line of it in the panel's
 * height, a line too long for its width scrolling through it.
 */
export function signShows(m: SignText, w: number, h: number): boolean {
  return layoutSign(m, w, h).rows <= lampRows(h);
}

/**
 * Which message is up at `signT` on a panel `w` x `h`, as a pure function of the clock:
 * its index, the seconds it has been up, and how far the roll to the next has gone (0 at
 * rest, up to 1).
 */
export function signAt(
  messages: readonly SignText[],
  w: number,
  h: number,
  signT: number,
): { index: number; since: number; roll: number } {
  const n = messages.length;
  const t = Number.isFinite(signT) ? Math.max(0, signT) : 0;
  if (n <= 1) return { index: 0, since: t, roll: 0 };
  const holds = messages.map((m) => layoutSign(m, w, h).hold);
  const period = holds.reduce((a, b) => a + b + SIGN_ROLL, 0);
  let tau = t % period;
  for (let i = 0; i < n; i++) {
    if (tau < holds[i]) return { index: i, since: tau, roll: 0 };
    tau -= holds[i];
    if (tau < SIGN_ROLL) {
      return { index: i, since: holds[i] + tau, roll: tau / SIGN_ROLL };
    }
    tau -= SIGN_ROLL;
  }
  return { index: 0, since: 0, roll: 0 };
}

/**
 * The sign's messages on a panel whose top left is (x, y), by the sign's clock `signT`:
 * one at a time, each rolled up and out by the next (`signAt`). One message is simply shown.
 */
export function drawSignBoard(
  s: Surface,
  messages: readonly SignText[],
  x: number,
  y: number,
  w: number,
  h: number,
  signT: number,
): void {
  if (messages.length === 0) return;
  const at = signAt(messages, w, h, signT);
  if (at.roll <= 0) {
    drawSignText(s, messages[at.index], x, y, w, h, at.since);
    return;
  }
  // the roll: both in the field, moving up a whole lamp at a time
  const frame = 4;
  const lamp = 2;
  const travel = Math.floor((h - 2 * frame) / lamp);
  const up = Math.min(travel, Math.floor(at.roll * travel)) * lamp;
  const next = messages[(at.index + 1) % messages.length];
  s.pushClip(x + frame, y + frame, w - 2 * frame, h - 2 * frame);
  drawSignText(s, messages[at.index], x, y - up, w, h, 0);
  drawSignText(s, next, x, y - up + travel * lamp, w, h, 0);
  s.popClip();
}

/** One message or several. */
function asMessages(text: SignText | readonly SignText[]): readonly SignText[] {
  return "header" in text ? [text] : (text as readonly SignText[]);
}

/**
 * The airship and the sign. `signT` is the sign's own clock (seconds since its first
 * message came up).
 */
export function drawAirship(
  s: Surface,
  ship: Airship,
  text: SignText | readonly SignText[],
  light: Lighting,
  t: number,
  signT: number,
): void {
  const { dx, dy } = airshipDrift(t);
  const x = ship.x + dx;
  const y = ship.y + dy;
  s.blit(ship.layer, x, y);
  const flip = Math.floor(t * 8) % 2 === 0;
  const messages = asMessages(text);

  drawProps(s, x, y, ship, light, flip);
  if (light.lightsOn) {
    drawNavLights(s, x, y, ship, Math.floor(t * 1.25) % 2 === 0);
  }
  const p = ship.place.panel;
  drawSignBoard(s, messages, p.x + dx, p.y + dy, p.w, p.h, signT);
}

/**
 * One message on a panel whose top left is (x, y), centred in its height: the header in
 * the small font, and under it the amber text (`layoutSign`), a marquee by the clock
 * `signT` if it is too long.
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
  // Every offset from the lamp field is even, so the lit lamps land on the panel's unlit
  // ones; the marquee's speed and gap are in lamps (drawLedLine).
  const fx = x + 6;
  const fw = w - 12;
  const { lines, rows } = layoutSign(text, w, h);
  // the lamps are on the field's even rows, clear of its first and last (lampRows)
  let top = y + 6 + Math.max(0, Math.floor((lampRows(h) - rows) / 2)) * 2;
  const big = lines[0].font === FONT_5x7;
  if (text.header !== "") {
    drawLedLine(s, text.header, fx, top, fw, {
      ...HEADER,
      color: P.ledGreen,
      t: signT,
    });
    top += (big ? 10 : 9) * 2;
  }
  for (const line of lines) {
    drawLedLine(s, line.text, fx, top, fw, {
      ...MARQUEE,
      font: line.font,
      color: P.amber,
      t: signT,
    });
    top += 14;
  }
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
  text: SignText | readonly SignText[],
  light: Lighting,
  t: number,
  pose: Pose,
  work: Surface,
  signT: number,
): void {
  const { dx, dy } = airshipDrift(t);
  work.clear();
  work.blit(ship.layer, 0, 0);
  const flip = Math.floor(t * (8 + pose.stress * 10)) % 2 === 0;
  drawProps(work, 0, 0, ship, light, flip);
  if (light.lightsOn) {
    const red = Math.floor(t * (1.25 + pose.stress * 4)) % 2 === 0;
    drawNavLights(work, 0, 0, ship, red);
  }
  const z = ship.place.panel;
  if (!pose.flicker) {
    const messages = asMessages(text);
    drawSignBoard(work, messages, z.x - ship.x, z.y - ship.y, z.w, z.h, signT);
  }
  // under stress the seams go taut: pale, then stitched in red (each stitch two pixels
  // long)
  if (pose.stress > 0.3) {
    const hard = pose.stress > 0.6;
    const taut = light.env(P.mist);
    const red = light.env(P.homeLight);
    const step = 2;
    for (let i = 0; i < ship.seams.length; i++) {
      const q = ship.seams[i];
      const stitch = hard && Math.floor(i / step) % 2 === 0;
      work.px(q.x, q.y, stitch ? red : taut);
    }
    // the top seam shows, then strains: stitches pulling apart in red
    for (let i = 0; i < ship.ridge.length; i++) {
      const q = ship.ridge[i];
      if (work.get(q.x, q.y) === TRANSPARENT) continue;
      const stitch = hard && Math.floor(i / step) % 3 === 0;
      work.px(q.x, q.y, stitch ? red : taut);
      if (stitch && pose.stress > 0.8) {
        work.rect(q.x, q.y + 1, 1, 2, red);
      }
    }
  }
  // and the pilot waves out of the gondola's front window
  if (pose.stress > 0.5) {
    drawPilotWave(work, ship, light, Math.floor(t * 5) % 2 === 0);
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
  const r = 2;
  for (let j = -r; j <= r; j++) {
    for (let i = -r; i <= r; i++) {
      const X = lx + i;
      const Y = ly + j;
      if (X < 0 || Y < 0 || X >= L.w || Y >= L.h) continue;
      if (L.data[Y * L.w + X] !== TRANSPARENT) return true;
    }
  }
  for (const p of ship.props) {
    if (Math.abs(lx - p.x) <= r && Math.abs(ly - p.y) <= 6) return true;
  }
  return false;
}
