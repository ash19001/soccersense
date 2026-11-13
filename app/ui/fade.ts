// A fade through black between two pages, in the game's pixels: an ordered dither of ink
// grows over the picture in whole interface pixels (a 4 x 4 Bayer pattern, sixteen steps,
// not an opacity ramp), the next page is shown while the screen is all ink, and the dither
// shrinks away off it. With the iris's sound: closing as the ink comes, opening as it goes.
//
//   fadeThrough(() => navigate("/"));   // on the way out (the full-time card's MENU)
//   useFadeArrival(ready);               // on the page arrived at, once its picture is up
//
// Browser only (handlers and effects): nothing runs at import or at build time. The
// overlay is a canvas of its own on `document.body`, outside React, so it lives through the
// change of page. Under reduced motion (or with no canvas) there is no fade: `go` runs at
// once. Pages arrived at any other way (the back button, a link, a visit) are untouched.

import { useEffect } from "react";

import { playCue } from "~/audio";

import { pixelScale } from "./scale";
import { MAX_STEP_MS, prefersReducedMotion } from "./slide";

/** How long each half takes, in milliseconds: the ink coming, and the ink going. */
export const FADE_MS = 350;

/**
 * The page arrived at says when its picture is up (`useFadeArrival`). If it never does
 * (it failed, or it is a page that does not say), the ink goes anyway after this long.
 */
export const ARRIVAL_PATIENCE_MS = 2500;

/** The 4 x 4 ordered dither: a cell is ink at level `n` (of 16) when its value is under n. */
export const BAYER: readonly (readonly number[])[] = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

/** How many steps from the picture to all ink. */
export const FADE_STEPS = 16;

/** The palette's ink, where the stylesheet cannot be read. */
const INK_FALLBACK: readonly [number, number, number] = [0x0f, 0x12, 0x20];

/**
 * The step (0: the picture, 16: all ink) at `t` (0 to 1) of a half: the ink coming in
 * (`out`) or going (`in`). Each half shows every step, in whole steps, ending exactly on
 * all ink or on the picture.
 */
export function fadeLevel(t: number, way: "out" | "in"): number {
  const s = Math.min(1, Math.max(0, Number.isFinite(t) ? t : 1));
  const level = Math.ceil(s * FADE_STEPS);
  return way === "out" ? level : FADE_STEPS - level;
}

/** Whether the cell at (x, y) is ink at `level`. */
export function inked(x: number, y: number, level: number): boolean {
  return BAYER[y & 3][x & 3] < level;
}

type Phase = "idle" | "out" | "black" | "in";

interface Fade {
  phase: Phase;
  canvas: HTMLCanvasElement | null;
  raf: number;
  timer: number;
  /** The level drawn last, and for what size: nothing is redrawn that has not changed. */
  drawn: string;
}

const fade: Fade = { phase: "idle", canvas: null, raf: 0, timer: 0, drawn: "" };

/** The ink colour, from the stylesheet's palette. */
function inkRgb(): readonly [number, number, number] {
  try {
    const hex = getComputedStyle(document.documentElement)
      .getPropertyValue("--c-ink")
      .trim();
    const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
    if (m) return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
  } catch {
    // The fallback below.
  }
  return INK_FALLBACK;
}

/**
 * Draws `level` on the overlay: one canvas pixel per interface pixel (`dp` device pixels,
 * as the picture's), from the top left corner, shown with hard edges.
 */
function draw(level: number): void {
  const canvas = fade.canvas;
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const cssW = window.innerWidth;
  const cssH = window.innerHeight;
  const { dp } = pixelScale(cssW, cssH, dpr);
  const w = Math.max(1, Math.ceil((cssW * dpr) / dp));
  const h = Math.max(1, Math.ceil((cssH * dpr) / dp));
  const key = `${level} ${w} ${h} ${dp} ${dpr}`;
  if (key === fade.drawn) return;
  fade.drawn = key;
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  canvas.style.width = `${(w * dp) / dpr}px`;
  canvas.style.height = `${(h * dp) / dpr}px`;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const image = ctx.createImageData(w, h);
  const [r, g, b] = inkRgb();
  const data = image.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!inked(x, y, level)) continue;
      const i = (y * w + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
}

/** The overlay, over everything on the page; null where there is no 2D canvas. */
function makeCanvas(): HTMLCanvasElement | null {
  try {
    const canvas = document.createElement("canvas");
    if (!canvas.getContext("2d")) return null;
    canvas.className = "ss-fade";
    canvas.setAttribute("aria-hidden", "true");
    document.body.append(canvas);
    return canvas;
  } catch {
    return null;
  }
}

function stopClock(): void {
  window.cancelAnimationFrame(fade.raf);
  window.clearTimeout(fade.timer);
  fade.raf = 0;
  fade.timer = 0;
}

/** Runs one half: every frame, the clock moving at most `MAX_STEP_MS` a frame. */
function run(way: "out" | "in", done: () => void): void {
  let elapsed = 0;
  let last: number | null = null;
  const frame = (now: number) => {
    // The first frame is the half's first step: a long frame is a wait, never a jump.
    elapsed += last === null ? 1000 / 60 : Math.min(MAX_STEP_MS, now - last);
    last = now;
    const t = elapsed / FADE_MS;
    draw(fadeLevel(t, way));
    if (t >= 1) {
      fade.raf = 0;
      done();
      return;
    }
    fade.raf = window.requestAnimationFrame(frame);
  };
  fade.raf = window.requestAnimationFrame(frame);
}

function finish(): void {
  stopClock();
  fade.canvas?.remove();
  fade.canvas = null;
  fade.drawn = "";
  fade.phase = "idle";
}

/** The ink goes: the dither shrinks off the new page, with the iris opening. */
function fadeIn(): void {
  if (fade.phase !== "black") return;
  stopClock();
  fade.phase = "in";
  // The page is the player's again: presses go through what is left of the ink.
  fade.canvas?.setAttribute("data-leaving", "");
  playCue({ kind: "transition", opening: true });
  run("in", finish);
}

/**
 * Leave this page through black: the ink comes over it (`FADE_MS`, with the iris's closing
 * sound), then `go()` (a navigation) runs while the screen is all ink, and the ink goes
 * once the next page says it is ready (`useFadeArrival`), or after
 * `ARRIVAL_PATIENCE_MS`. Returns false, and does nothing, while a fade is already on (no
 * double fade). Under reduced motion, or with no canvas, `go()` runs at once.
 */
export function fadeThrough(go: () => unknown): boolean {
  if (fade.phase !== "idle") return false;
  const leave = () => {
    try {
      // A navigation that fails leaves the page where it is: show it again.
      void Promise.resolve(go()).catch(fadeIn);
    } catch {
      fadeIn();
    }
  };
  if (prefersReducedMotion()) {
    go();
    return true;
  }
  const canvas = makeCanvas();
  if (!canvas) {
    go();
    return true;
  }
  fade.canvas = canvas;
  fade.phase = "out";
  playCue({ kind: "transition", opening: false });
  run("out", () => {
    fade.phase = "black";
    fade.timer = window.setTimeout(fadeIn, ARRIVAL_PATIENCE_MS);
    leave();
  });
  return true;
}

/** True while a page is being arrived at through the fade (the screen is still ink). */
export function arrivingThroughFade(): boolean {
  return fade.phase === "out" || fade.phase === "black";
}

/**
 * The page arrived at through the fade has its picture up: the ink goes after the next two
 * frames (the first of them is the picture's first, often a long one), so it is seen from
 * its first step. Does nothing if no fade is waiting.
 */
export function fadeArrived(): void {
  if (fade.phase !== "black") return;
  window.clearTimeout(fade.timer);
  fade.raf = window.requestAnimationFrame(() => {
    fade.raf = window.requestAnimationFrame(() => {
      fade.raf = 0;
      fadeIn();
    });
  });
}

/** For a page that can be arrived at through the fade: call it with true once its picture is up. */
export function useFadeArrival(ready: boolean): void {
  useEffect(() => {
    if (ready) fadeArrived();
  }, [ready]);
}

/** Tests only: no fade on, the overlay gone. */
export function resetFadeForTests(): void {
  finish();
}
