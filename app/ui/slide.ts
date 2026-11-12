// Smooth slides that stay crisp. A thing that slides moves every frame on an eased curve, and
// each frame's position is rounded to whole device pixels before it is shown, so the pixel art
// and the text in it never land between pixels and never blur. No fades.
//
// The curve is a cubic from a position and a speed to a position at rest. From rest it is the
// ease-out cubic (it leaves quickly and settles gently). Turned round halfway (a second press),
// the new curve starts from where the thing is, at the speed it has, so it slows, stops and
// comes back without a jolt.

/** How long a slide takes, in milliseconds. */
export const SLIDE_MS = 300;

/** One frame at 60 Hz, in milliseconds: how far into a slide its first frame is. */
export const FRAME_MS = 1000 / 60;

/**
 * The most a slide's clock moves on in one frame (1/30 s). A frame the browser was late with
 * (the first press can start the sound, a busy moment) shows as a moment's wait, never a jump.
 */
export const MAX_STEP_MS = 1000 / 30;

/** `x` (CSS px) rounded to whole device pixels at ratio `dpr`. */
export function snapToDevice(x: number, dpr: number): number {
  const ratio = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
  const snapped = Math.round(x * ratio) / ratio;
  // Never -0: it would print as "-0px".
  return snapped === 0 ? 0 : snapped;
}

/** One slide: from `from` at speed `v0` (CSS px per ms) to rest at `to`, starting at `start`. */
export interface SlideCurve {
  from: number;
  to: number;
  v0: number;
  /** On the slide's own clock, in ms. */
  start: number;
  duration: number;
}

/**
 * A slide from `from` to `to`. With no `velocity` it starts from rest: the ease-out cubic,
 * whose starting speed is three times the average. A `velocity` (the speed the thing has, when
 * a slide is turned round) is kept, except that it never starts towards the target faster
 * than a fresh slide would: that would carry it past the target.
 */
export function slideCurve(
  from: number,
  to: number,
  start: number,
  duration: number = SLIDE_MS,
  velocity?: number,
): SlideCurve {
  const fresh = (3 * (to - from)) / duration;
  let v0 = velocity ?? fresh;
  if (fresh !== 0 && Math.sign(v0) === Math.sign(fresh)) {
    v0 = Math.sign(fresh) * Math.min(Math.abs(v0), Math.abs(fresh));
  }
  return { from, to, v0, start, duration };
}

/** Where the slide is at time `now`, how fast it is going (CSS px per ms), and whether it is over. */
export function sampleSlide(
  curve: SlideCurve,
  now: number,
): { x: number; v: number; done: boolean } {
  const { from, to, v0, start, duration } = curve;
  const s = Math.min(1, Math.max(0, (now - start) / duration));
  if (s >= 1) return { x: to, v: 0, done: true };
  const s2 = s * s;
  const s3 = s2 * s;
  // Cubic Hermite: from `from` at speed v0 to `to` at rest.
  const m = duration * v0;
  const x =
    (2 * s3 - 3 * s2 + 1) * from +
    (s3 - 2 * s2 + s) * m +
    (3 * s2 - 2 * s3) * to;
  const dx =
    (6 * s2 - 6 * s) * from + (3 * s2 - 4 * s + 1) * m + (6 * s - 6 * s2) * to;
  return { x, v: dx / duration, done: false };
}

export interface SliderOptions {
  /** Show the position: CSS px, already rounded to whole device pixels. */
  apply(x: number): void;
  /** The slide has come to rest (not called after `stop`). */
  end?(): void;
  duration?: number;
  /** Positions are kept within these (a turned-round slide carries on a little first). */
  bounds?: readonly [number, number];
  /** The device pixel ratio (default: the window's). */
  ratio?(): number;
  frame?(callback: (time: number) => void): number;
  cancelFrame?(id: number): void;
}

export interface Slider {
  /**
   * Slide to `to`: from `from` when still, or, while sliding, turned round from where it is.
   * `from` is shown at once, so the caller can change the resting state in the same frame.
   */
  to(to: number, from: number): void;
  /** Stop where it is, without calling `end`. */
  stop(): void;
  readonly moving: boolean;
  /** Where the slide will come to rest, while it is moving. */
  readonly target: number | null;
}

/**
 * A slide run on `requestAnimationFrame`: one position a frame, every frame, rounded to whole
 * device pixels. Its clock starts with its first frame, which is one 60 Hz frame into the
 * slide, and moves on by the time between frames, never more than `MAX_STEP_MS` at once.
 */
export function createSlider(options: SliderOptions): Slider {
  const duration = options.duration ?? SLIDE_MS;
  const ratio =
    options.ratio ??
    (() => (typeof window === "undefined" ? 1 : window.devicePixelRatio || 1));
  const frame =
    options.frame ?? ((callback) => window.requestAnimationFrame(callback));
  const cancelFrame =
    options.cancelFrame ?? ((id) => window.cancelAnimationFrame(id));

  let curve: SlideCurve | null = null;
  /** The slide's own clock (ms since the curve began), and the frame it was last moved on. */
  let elapsed = 0;
  let lastFrame: number | null = null;
  let id = 0;

  const show = (x: number) => {
    const [lo, hi] = options.bounds ?? [-Infinity, Infinity];
    options.apply(snapToDevice(Math.min(hi, Math.max(lo, x)), ratio()));
  };

  const tick = (time: number) => {
    id = 0;
    if (!curve) return;
    elapsed +=
      lastFrame === null
        ? FRAME_MS
        : Math.min(MAX_STEP_MS, Math.max(0, time - lastFrame));
    lastFrame = time;
    const at = sampleSlide(curve, elapsed);
    show(at.x);
    if (at.done) {
      curve = null;
      lastFrame = null;
      options.end?.();
      return;
    }
    id = frame(tick);
  };

  return {
    to(to, from) {
      if (curve && lastFrame !== null) {
        // Turned round: from what is on screen now, at the speed it has there.
        const at = sampleSlide(curve, elapsed);
        curve = slideCurve(at.x, to, 0, duration, at.v);
      } else {
        // From rest (or a slide that has not shown a frame yet, so has not moved).
        const start = curve ? curve.from : from;
        curve = slideCurve(start, to, 0, duration);
        show(start);
      }
      elapsed = 0;
      if (!id) id = frame(tick);
    },
    stop() {
      if (id) cancelFrame(id);
      id = 0;
      curve = null;
      lastFrame = null;
    },
    get moving() {
      return curve !== null;
    },
    get target() {
      return curve ? curve.to : null;
    },
  };
}

/** The user asks for reduced motion: every slide is instant. */
export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}
