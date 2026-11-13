import { createContext, useContext, useSyncExternalStore } from "react";

/**
 * Pixel scale for the whole game (docs/ART_BIBLE.md sections 2 and 7).
 *
 * How big things should be is decided in CSS pixels, because display scaling and browser
 * zoom exist to make things big enough for the person in front of the screen. What is then
 * drawn is snapped to the device: a logical pixel, a font pixel and a caption pixel are each
 * a whole number of DEVICE pixels, so every pixel on screen is the same size at any scaling
 * (Windows at 125% or 150%, browser zoom). `px`, `fp`, `cp` and `tx` are those sizes back in
 * CSS pixels, which makes them fractions at a fractional device pixel ratio: 3.2 CSS px at
 * 125% is exactly 4 device pixels. At ratios 1, 2 and 3 they are the whole numbers they
 * always were.
 *
 * The canvas has values of its own (`canvasW`, `canvasH`, `canvasDp`, `canvasPx`): its
 * pixels are half the size of the interface's logical pixels, rounded up to whole device
 * pixels (`canvasDpFor`), so it has about twice as many each way (960 x 540 at
 * 1920 x 1080, where the interface's logical canvas is 480 x 270).
 */
export interface PixelScale {
  /**
   * CSS pixels per logical (scene) pixel: `dp / dpr`. The target is 2 to 8; the device
   * decides the exact figure (3.2 at 125%, 2.4 at 125% for a target of 2).
   */
  px: number;
  /** The art bible's text unit: max(2, px - 1). Kept for canvas code; the skin uses `fp`. */
  tx: number;
  /**
   * CSS pixels per font pixel: a third of a logical pixel in whole CSS pixels (1 for a
   * target px of 2 to 4, 2 for 5 to 7, 3 for 8), then whole device pixels. Type sizes are
   * multiples of it.
   */
  fp: number;
  /**
   * CSS pixels per caption pixel: the font pixel of type that sits straight on the picture
   * of a wide screen (the menu captions on a monitor). Half a logical pixel, rounded up to
   * whole device pixels, and never less than `fp`.
   */
  cp: number;
  /** Logical canvas width that covers the viewport: ceil(device width / dp). */
  logicalW: number;
  /** Logical canvas height that covers the viewport: ceil(device height / dp). */
  logicalH: number;
  /** True when the viewport is at least as tall as it is wide. */
  portrait: boolean;
  /** The device pixel ratio this scale was made for. 1 at build time. */
  dpr: number;
  /** Device pixels per logical pixel: a whole number, at least 2. */
  dp: number;
  /**
   * The step to round layout to, in CSS pixels: the whole number of device pixels nearest
   * to one CSS pixel. Exactly 1 at ratios 1, 2 and 3; 0.8 at 125%.
   */
  snap: number;
  /**
   * The canvas's logical width: ceil(device width / canvasDp). About twice `logicalW` (960
   * at 1920 x 1080). The interface never uses it.
   */
  canvasW: number;
  /** The canvas's logical height: ceil(device height / canvasDp). */
  canvasH: number;
  /**
   * Device pixels per canvas pixel: `canvasDpFor(dp)`. A whole number, at least 1 (1 only
   * where `dp` is 2).
   */
  canvasDp: number;
  /** CSS pixels per canvas pixel: `canvasDp / dpr`. */
  canvasPx: number;
}

export const MIN_PX = 2;
export const MAX_PX = 8;
/** Portrait: px is round(cssWidth / 135), unless the height limit below is smaller. */
export const PORTRAIT_DIVISOR = 135;
/**
 * Portrait: the logical canvas is never shorter than this, so px is at most
 * floor(cssHeight / 220). It stops a wide, short screen from getting pixels so big that
 * the scene has no height left.
 */
export const PORTRAIT_MIN_LOGICAL_H = 220;
/** Landscape: px = round(cssHeight / 290). */
export const LANDSCAPE_DIVISOR = 290;
/**
 * The interface column is this many logical pixels wide (ui.css widens it to 405 font
 * pixels where that is more, and never past the screen).
 */
export const COLUMN_LOGICAL_WIDTH = 135;
/**
 * The room the menu captions need when they lie in one row across a wide screen (ui.css
 * section 15b): 60 logical pixels of frames, gaps and margins, and 480 caption pixels of
 * words (the two lines, the two badges and a two-digit day). `isWide` asks for that much.
 */
export const WIDE_ROW_PX = 60;
export const WIDE_ROW_CP = 480;

/**
 * Device pixels per CANVAS pixel, from `dp`, the device pixels per logical pixel of the
 * interface: max(1, ceil(dp / 2)), half the size, rounded up to whole device pixels.
 *
 * So an even `dp` gives a canvas exactly twice the interface's logical canvas each way (dp
 * 4: 2 device pixels each, 960 x 540 at 1920 x 1080), and an odd one the next coarser whole
 * size, never finer: dp 3, 5, 7 and 9 give 2, 3, 4 and 5, a canvas 1.5, 1.67, 1.75 and 1.8
 * times the logical one. A canvas pixel is never one device pixel, except where the
 * interface's is two: there two would leave a canvas half as wide as the painters are made
 * for (everything twice as big on screen). Rounding up keeps the canvas inside the
 * painters' range (art bible section 2) and its pixels at least as chunky as asked.
 */
export function canvasDpFor(dp: number): number {
  return Math.max(1, Math.ceil(dp / 2));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** A device pixel ratio the rule can work with: a positive, finite number. */
function cleanRatio(dpr: number): number {
  return Number.isFinite(dpr) && dpr > 0 ? clamp(dpr, 0.2, 16) : 1;
}

/**
 * `devicePixels` device pixels as a length in CSS pixels. A fraction is rounded up in its
 * fifth decimal place, so that the browser, multiplying it back by the ratio, lands on the
 * whole device pixel or a hair above it, never a hair below (which it would round down to
 * the 64th of a pixel before). A whole number of CSS pixels stays exactly that.
 */
export function deviceToCss(devicePixels: number, dpr: number): number {
  return Math.ceil((devicePixels / cleanRatio(dpr)) * 1e5 - 1e-6) / 1e5;
}

/**
 * How many device pixels a viewport side of `css` CSS pixels is. At a whole ratio that is
 * exact. At a fractional one the browser reports whole CSS pixels (rounded down) unless it
 * is asked for the exact figure, so the answer is rounded up: the canvas must cover.
 */
function deviceSpan(css: number, dpr: number): number {
  if (Number.isInteger(dpr)) return Math.max(1, Math.floor(css)) * dpr;
  return Math.max(1, Math.ceil(css * dpr - 1e-3));
}

/**
 * Pure: the scale for a viewport of `cssWidth` x `cssHeight` CSS pixels on a screen with
 * `dpr` device pixels per CSS pixel (1 when left out, as at build time).
 *
 * The size things should be, in CSS pixels (art bible section 2):
 *   portrait   target = clamp(min(round(w / 135), floor(h / 220)), 2, 8)
 *   landscape  target = clamp(round(h / 290), 2, 8)
 * Then the device decides:
 *   dp = max(2, round(target * dpr))   device pixels per logical pixel
 *   px = dp / dpr                      the same in CSS pixels
 * and likewise the font pixel, max(1, round(max(1, round(target / 3)) * dpr)) device pixels.
 * The logical canvas is the device size divided by dp, rounded up.
 *
 * The canvas's own values (`canvasW`, `canvasH`, `canvasDp`, `canvasPx`) are worked out
 * the same way from `canvasDpFor(dp)`.
 *
 * The fallback in ui.css (section 1) is the CSS-pixel rule in CSS: change them together.
 */
export function pixelScale(
  cssWidth: number,
  cssHeight: number,
  dpr = 1,
): PixelScale {
  const ratio = cleanRatio(dpr);
  const w = Math.max(1, Math.floor(cssWidth));
  const h = Math.max(1, Math.floor(cssHeight));
  const portrait = h >= w;
  const target = portrait
    ? clamp(
        Math.min(
          Math.round(w / PORTRAIT_DIVISOR),
          Math.floor(h / PORTRAIT_MIN_LOGICAL_H),
        ),
        MIN_PX,
        MAX_PX,
      )
    : clamp(Math.round(h / LANDSCAPE_DIVISOR), MIN_PX, MAX_PX);
  const fontTarget = Math.max(1, Math.round(target / 3));
  const textTarget = Math.max(2, target - 1);

  // Whole device pixels for each unit.
  const dp = Math.max(2, Math.round(target * ratio));
  const fontDp = Math.max(1, Math.round(fontTarget * ratio));
  const textDp = Math.max(1, Math.round(textTarget * ratio));
  const captionDp = Math.max(fontDp, Math.ceil(dp / 2));
  const snapDp = Math.max(1, Math.round(ratio));
  const deviceW = deviceSpan(cssWidth, ratio);
  const deviceH = deviceSpan(cssHeight, ratio);
  const canvasDp = canvasDpFor(dp);

  return {
    px: deviceToCss(dp, ratio),
    tx: deviceToCss(textDp, ratio),
    fp: deviceToCss(fontDp, ratio),
    cp: deviceToCss(captionDp, ratio),
    logicalW: Math.ceil(deviceW / dp),
    logicalH: Math.ceil(deviceH / dp),
    portrait,
    dpr: ratio,
    dp,
    snap: deviceToCss(snapDp, ratio),
    canvasW: Math.ceil(deviceW / canvasDp),
    canvasH: Math.ceil(deviceH / canvasDp),
    canvasDp,
    canvasPx: deviceToCss(canvasDp, ratio),
  };
}

/**
 * True on a wide screen (a monitor, not a phone): landscape, with room for the menu
 * captions in one row. In logical pixels that is 60 plus 480 caption pixels: 300 where a
 * caption pixel is half a logical pixel (1920 x 1080), 380 where it is two thirds of one
 * (1366 x 768). `GameLayout` marks itself `data-wide` where this holds.
 */
export function isWide(scale: PixelScale): boolean {
  return (
    !scale.portrait &&
    scale.logicalW >= WIDE_ROW_PX + (WIDE_ROW_CP * scale.cp) / scale.px
  );
}

/**
 * The units as CSS variables, in CSS px, for `PixelRoot` to set. `--px`, `--fp`, `--cp` and
 * `--tx` are each a whole number of device pixels, so at a fractional device pixel ratio
 * they are fractions ("3.2px" at 125%). `--snap` is the step the skin rounds layout to, and
 * `--nudge` a 64th of it, which ui.css adds before it rounds so that a length already on
 * the grid is not knocked off it by the arithmetic. At ratios 1, 2 and 3 `--snap` is 1px
 * and `--nudge` is 0px: the same CSS as there always was.
 */
export function pixelVariables(scale: PixelScale): Record<string, string> {
  return {
    "--px": `${scale.px}px`,
    "--fp": `${scale.fp}px`,
    "--cp": `${scale.cp}px`,
    "--tx": `${scale.tx}px`,
    "--snap": `${scale.snap}px`,
    "--nudge": Number.isInteger(scale.dpr) ? "0px" : `${scale.snap / 64}px`,
  };
}

/**
 * What the server (and the first client render) uses: a 390 x 844 phone at ratio 1.
 * px 3, tx 2, fp 1, cp 2, logical 130 x 282.
 */
export const DEFAULT_SCALE: PixelScale = pixelScale(390, 844);

// --- browser store -------------------------------------------------------------------------
// One shared snapshot so every hook instance agrees. Read only from the functions below,
// which React calls on the client.

let snapshot: PixelScale = DEFAULT_SCALE;
let lastW = -1;
let lastH = -1;
let lastRatio = -1;

function isEditing(): boolean {
  const el = document.activeElement;
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    (el instanceof HTMLElement && el.isContentEditable)
  );
}

function ratioNow(): number {
  return cleanRatio(window.devicePixelRatio);
}

/**
 * The viewport side as exactly as the browser will say. `innerWidth` is a whole number of
 * CSS pixels; at a fractional ratio the real viewport is a fraction more (1920 device
 * pixels at 110% are 1745.45 CSS pixels), and the visual viewport reports that fraction.
 * It is only believed while it is the same measurement, to within the rounding: pinched in,
 * or with a keyboard up, it measures something else.
 */
function exactSide(inner: number, visual: number | undefined): number {
  return visual !== undefined && Math.abs(visual - inner) < 1 ? visual : inner;
}

function readScale(): PixelScale {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const ratio = ratioNow();
  const same = ratio === lastRatio;
  if (w === lastW && h === lastH && same) return snapshot;
  // An on-screen keyboard can shrink the layout height on some browsers. That must not
  // flip the orientation or change the pixel size under the player's thumbs.
  if (lastW === w && h < lastH && same && isEditing()) {
    return snapshot;
  }
  lastW = w;
  lastH = h;
  lastRatio = ratio;
  const vv = window.visualViewport;
  const pinch = vv?.scale ?? 1;
  const next = pixelScale(
    exactSide(w, vv ? vv.width * pinch : undefined),
    exactSide(h, vv ? vv.height * pinch : undefined),
    ratio,
  );
  if (
    next.px !== snapshot.px ||
    next.fp !== snapshot.fp ||
    next.dpr !== snapshot.dpr ||
    next.logicalW !== snapshot.logicalW ||
    next.logicalH !== snapshot.logicalH ||
    next.portrait !== snapshot.portrait ||
    next.canvasW !== snapshot.canvasW ||
    next.canvasH !== snapshot.canvasH
  ) {
    snapshot = next;
  }
  return snapshot;
}

/**
 * Calls `onChange` whenever the device pixel ratio changes: browser zoom, or the window
 * dragged to a monitor with another scaling. A `resolution` media query only says when the
 * ratio stops being the one it was made for, so a new one is made after every change.
 */
function watchRatio(onChange: () => void): () => void {
  if (typeof window.matchMedia !== "function") return () => {};
  let query: MediaQueryList | null = null;
  const changed = () => {
    arm();
    onChange();
  };
  const arm = () => {
    query?.removeEventListener?.("change", changed);
    query = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    query.addEventListener?.("change", changed);
  };
  arm();
  return () => {
    query?.removeEventListener?.("change", changed);
    query = null;
  };
}

/** Everyone who is listening to the store, so `noticeDevicePixelRatio` can tell them. */
const subscribers = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  subscribers.add(onChange);
  window.addEventListener("resize", onChange);
  window.addEventListener("orientationchange", onChange);
  // The keyboard closing fires no window resize where it only moved the visual viewport,
  // but a blur can let a postponed measurement through.
  window.addEventListener("focusout", onChange);
  const stopWatching = watchRatio(onChange);
  return () => {
    subscribers.delete(onChange);
    window.removeEventListener("resize", onChange);
    window.removeEventListener("orientationchange", onChange);
    window.removeEventListener("focusout", onChange);
    stopWatching();
  };
}

/**
 * For code that already runs every frame (the canvas stage calls this once a frame): if the
 * device pixel ratio is no longer the one the scale was made for, the store is told now.
 * Browsers announce a new ratio with a resize or through the media query above, but not
 * every one does every time (DevTools changing only the ratio fires neither), and a
 * pixel-art canvas at the wrong ratio is the one thing that must not be left standing.
 * It costs one comparison, and does nothing while nobody uses the store.
 */
export function noticeDevicePixelRatio(): void {
  if (subscribers.size === 0 || lastRatio === -1) return;
  if (ratioNow() === lastRatio) return;
  for (const tell of [...subscribers]) tell();
}

function serverScale(): PixelScale {
  return DEFAULT_SCALE;
}

/**
 * The scale for the current window. Safe during server rendering (returns DEFAULT_SCALE,
 * which is also the first client render) and follows the window live: resize, orientation
 * change, and a change of device pixel ratio (browser zoom, another monitor).
 */
export function usePixelScale(): PixelScale {
  return useSyncExternalStore(subscribe, readScale, serverScale);
}

/** Set by PixelRoot so descendants (the canvas stage) share the exact same numbers. */
export const PixelScaleContext = createContext<PixelScale>(DEFAULT_SCALE);

/** The scale of the nearest PixelRoot (DEFAULT_SCALE outside one). */
export function usePixelRootScale(): PixelScale {
  return useContext(PixelScaleContext);
}
