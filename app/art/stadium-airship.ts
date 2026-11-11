/**
 * What carries the matchday sign: an airship over the town, with the dot-matrix panel on
 * its flank. In a picture taken from the air a board on posts makes no sense; an airship
 * floats in the same air as the camera (and the menu ball), is seen side-on like the sun
 * and the clouds, and leaves the pitch and the town clear.
 */

import { FONT_3x5, FONT_5x7, Surface, type Color } from "~/pixel";
import type { Zone } from "~/art/layout";
import { drawLedLine, drawLedPanel } from "~/art/led";
import type { Lighting } from "~/art/lighting";
import { P } from "~/art/palette";
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
  for (const u of [-0.74, 0.8]) {
    const dx = Math.round(u * rx);
    const hh = half(dx);
    for (let dy = Math.round(-hh * 0.6); dy <= Math.round(hh * 0.3); dy++) {
      s.px(
        cx + dx + Math.round(Math.abs(dy / ry) ** 2 * (u < 0 ? 3 : -3)),
        cy + dy,
        seam,
      );
    }
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
  header: string;
  name: string;
  place: string;
}

/** The airship and the sign's three lines. */
export function drawAirship(
  s: Surface,
  ship: Airship,
  text: SignText,
  light: Lighting,
  t: number,
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
  const fx = z.x + dx + 3;
  const fy = z.y + dy;
  const fw = z.w - 6;
  const tall = z.h >= 35;
  drawLedLine(s, text.header, fx, fy + (tall ? 5 : 4), fw, {
    font: FONT_3x5,
    color: P.ledGreen,
    t,
  });
  drawLedLine(s, text.name, fx, fy + (tall ? 14 : 13), fw, {
    font: FONT_5x7,
    color: P.amber,
    t,
  });
  drawLedLine(s, text.place, fx, fy + (tall ? 25 : 24), fw, {
    font: FONT_3x5,
    color: P.chalk,
    t,
  });
}
