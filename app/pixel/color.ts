/**
 * Colours for the software framebuffer.
 *
 * A `Color` is one 32-bit number laid out as 0xAABBGGRR, so that the bytes of a
 * `Uint32Array` of colours are R, G, B, A in memory on little-endian machines (every
 * browser and Node target we care about). That makes
 * `new Uint8ClampedArray(surface.data.buffer)` valid `ImageData` with no conversion.
 *
 * Alpha is all or nothing: a colour is opaque (alpha 255) or it is `TRANSPARENT` (0).
 */

export type Color = number & { readonly __brand: "Color" };

/** The only non-opaque colour. Drawing with it is a no-op everywhere in the engine. */
export const TRANSPARENT = 0 as Color;

function byte(v: number): number {
  return v > 255 ? 255 : v > 0 ? Math.round(v) : 0;
}

/** Opaque colour from 0..255 channels (clamped and rounded). */
export function fromRgb(r: number, g: number, b: number): Color {
  return ((0xff000000 | (byte(b) << 16) | (byte(g) << 8) | byte(r)) >>>
    0) as Color;
}

/** Opaque colour from a 0xRRGGBB literal: `rgb(0xff8800)`. */
export function rgb(hex: number): Color {
  return ((0xff000000 |
    ((hex & 0xff) << 16) |
    (hex & 0xff00) |
    ((hex >>> 16) & 0xff)) >>>
    0) as Color;
}

/**
 * Opaque colour from a CSS-style hex string: `hex("#ff8800")`, `hex("ff8800")` or
 * `hex("#f80")`. An eight-digit string is accepted and its alpha ignored.
 * Throws on anything else, because a bad colour literal is a programming error.
 */
export function hex(css: string): Color {
  let s = css.trim();
  if (s.startsWith("#")) s = s.slice(1);
  if (/^[0-9a-f]{3}$/i.test(s)) {
    s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
  } else if (/^[0-9a-f]{8}$/i.test(s)) {
    s = s.slice(0, 6);
  } else if (!/^[0-9a-f]{6}$/i.test(s)) {
    throw new Error(`hex: "${css}" is not a hex colour like "#ff8800"`);
  }
  return rgb(parseInt(s, 16));
}

/** `[r, g, b]`, each 0..255. */
export function toRgb(c: Color): [number, number, number] {
  return [c & 0xff, (c >>> 8) & 0xff, (c >>> 16) & 0xff];
}

/** `"#rrggbb"` (alpha is not included: `TRANSPARENT` gives `"#000000"`). */
export function toHex(c: Color): string {
  const n = ((c & 0xff) << 16) | (c & 0xff00) | ((c >>> 16) & 0xff);
  return "#" + n.toString(16).padStart(6, "0");
}

/** Perceived brightness 0..1 (Rec. 709 weights on the gamma-encoded channels). */
export function luma(c: Color): number {
  return (
    (0.2126 * (c & 0xff) +
      0.7152 * ((c >>> 8) & 0xff) +
      0.0722 * ((c >>> 16) & 0xff)) /
    255
  );
}

// ---------------------------------------------------------------------------
// OKLab (Björn Ottosson, 2020). Used for mixing and shading because equal steps
// look equal, and hue does not drift the way it does in RGB or HSL.
// ---------------------------------------------------------------------------

const TO_LINEAR = new Float64Array(256);
for (let i = 0; i < 256; i++) {
  const v = i / 255;
  TO_LINEAR[i] = v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function fromLinear(v: number): number {
  const e = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  return e * 255;
}

// Scratch outputs, so the converters allocate nothing.
let oL = 0;
let oA = 0;
let oB = 0;
let linR = 0;
let linG = 0;
let linB = 0;

function labOf(c: Color): void {
  const r = TO_LINEAR[c & 0xff];
  const g = TO_LINEAR[(c >>> 8) & 0xff];
  const b = TO_LINEAR[(c >>> 16) & 0xff];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  oL = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  oA = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  oB = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
}

function linearOf(L: number, a: number, b: number): void {
  const l = L + 0.3963377774 * a + 0.2158037573 * b;
  const m = L - 0.1055613458 * a - 0.0638541728 * b;
  const s = L - 0.0894841775 * a - 1.291485548 * b;
  const l3 = l * l * l;
  const m3 = m * m * m;
  const s3 = s * s * s;
  linR = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  linG = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  linB = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3;
}

/** `[L, a, b]` in OKLab. L is 0 (black) to 1 (white). */
export function toOklab(c: Color): [number, number, number] {
  labOf(c);
  return [oL, oA, oB];
}

/** Opaque colour from OKLab. Channels that fall outside sRGB are clamped. */
export function fromOklab(L: number, a: number, b: number): Color {
  linearOf(L, a, b);
  return fromRgb(fromLinear(linR), fromLinear(linG), fromLinear(linB));
}

/**
 * Interpolate from `a` (t = 0) to `b` (t = 1) in OKLab. `t` is clamped, and the end points
 * are returned exactly. There is no alpha blending: if either colour is `TRANSPARENT`
 * the result snaps to whichever end is nearer.
 */
export function mix(a: Color, b: Color, t: number): Color {
  if (!(t > 0)) return a;
  if (t >= 1) return b;
  if (a === TRANSPARENT || b === TRANSPARENT) return t < 0.5 ? a : b;
  labOf(a);
  const L = oL;
  const A = oA;
  const B = oB;
  labOf(b);
  return fromOklab(L + (oL - L) * t, A + (oA - A) * t, B + (oB - B) * t);
}

const TAU = Math.PI * 2;
const SHADOW_HUE = (285 / 360) * TAU; // blue-purple
const LIGHT_HUE = (100 / 360) * TAU; // warm yellow
const MAX_HUE_TURN = (50 / 360) * TAU;
const SHADOW_L = 0.08;
const LIGHT_L = 0.985;
const GAMUT_EPS = 0.0005;

function inGamut(): boolean {
  return (
    linR >= -GAMUT_EPS &&
    linR <= 1 + GAMUT_EPS &&
    linG >= -GAMUT_EPS &&
    linG <= 1 + GAMUT_EPS &&
    linB >= -GAMUT_EPS &&
    linB <= 1 + GAMUT_EPS
  );
}

/**
 * A darker or lighter relative of `c` for building ramps the pixel-art way.
 *
 * `amount` runs from -1 to 1. Negative values darken and turn the hue towards
 * blue-purple; positive values lighten and turn the hue towards warm yellow. Greys pick up
 * a little of that tint instead of staying grey. `shade(c, 0)` returns `c` unchanged.
 * One step of a palette ramp is roughly an amount of 0.25.
 *
 * The result is always inside sRGB: chroma is reduced, never clipped per channel.
 */
export function shade(c: Color, amount: number): Color {
  if (c === TRANSPARENT || !(amount > 0 || amount < 0)) return c;
  const t = Math.min(1, Math.abs(amount));
  const darker = amount < 0;
  labOf(c);
  const chroma = Math.hypot(oA, oB);
  const targetHue = darker ? SHADOW_HUE : LIGHT_HUE;
  let hue = targetHue;
  if (chroma > 0.004) {
    hue = Math.atan2(oB, oA);
    // Shortest way round to the target hue, limited to MAX_HUE_TURN at full amount.
    let delta = (targetHue - hue) % TAU;
    if (delta > Math.PI) delta -= TAU;
    if (delta < -Math.PI) delta += TAU;
    const turn = MAX_HUE_TURN * t;
    hue += delta > turn ? turn : delta < -turn ? -turn : delta;
  }
  const L = oL + ((darker ? SHADOW_L : LIGHT_L) - oL) * t;
  // The turned colour, eased off a little, plus a touch of the target tint (which is what
  // stops greys staying grey).
  const keep = chroma * (1 - 0.25 * t);
  const tint = 0.035 * t;
  const a = keep * Math.cos(hue) + tint * Math.cos(targetHue);
  const b = keep * Math.sin(hue) + tint * Math.sin(targetHue);
  const C = Math.hypot(a, b);
  const ca = C > 0 ? a / C : 1;
  const sb = C > 0 ? b / C : 0;

  // Pull chroma in until the colour fits sRGB, keeping lightness and hue.
  linearOf(L, C * ca, C * sb);
  let k = 1;
  if (!inGamut()) {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 14; i++) {
      k = (lo + hi) / 2;
      linearOf(L, C * k * ca, C * k * sb);
      if (inGamut()) lo = k;
      else hi = k;
    }
    k = lo;
  }
  return fromOklab(L, C * k * ca, C * k * sb);
}
