/**
 * Small maths helpers for animation. Everything is a pure function of its arguments.
 * The easing curves clamp `t` to 0..1 so callers can pass raw progress.
 */

/** Limit `v` to `lo`..`hi` (0..1 by default). */
export function clamp(v: number, lo = 0, hi = 1): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** From `a` (t = 0) to `b` (t = 1). Not clamped. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Where `v` sits between `a` (0) and `b` (1). Not clamped. Returns 0 if `a` equals `b`. */
export function invLerp(a: number, b: number, v: number): number {
  return a === b ? 0 : (v - a) / (b - a);
}

/**
 * Map `v` from the range `inA..inB` onto `outA..outB`, **clamped** to the output range.
 * For the unclamped version write `lerp(outA, outB, invLerp(inA, inB, v))`.
 */
export function remap(
  v: number,
  inA: number,
  inB: number,
  outA: number,
  outB: number,
): number {
  return lerp(outA, outB, clamp(invLerp(inA, inB, v)));
}

/** 0 below `edge0`, 1 above `edge1`, a smooth S-curve between. */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp(invLerp(edge0, edge1, x));
  return t * t * (3 - 2 * t);
}

/** Starts slowly, ends fast. */
export function easeInCubic(t: number): number {
  t = clamp(t);
  return t * t * t;
}

/** Starts fast, settles gently. */
export function easeOutCubic(t: number): number {
  const u = 1 - clamp(t);
  return 1 - u * u * u;
}

/** Slow at both ends. */
export function easeInOutCubic(t: number): number {
  t = clamp(t);
  if (t < 0.5) return 4 * t * t * t;
  const u = -2 * t + 2;
  return 1 - (u * u * u) / 2;
}

/** Overshoots to about 1.1, then settles on 1. Good for pop-ups. */
export function easeOutBack(t: number): number {
  const u = clamp(t) - 1;
  const c = 1.70158;
  return 1 + (c + 1) * u * u * u + c * u * u;
}

/**
 * The height of a hop or a lobbed ball: 0 at t = 0, up to 1 at t = 0.5, back to 0 at
 * t = 1 (a parabola). `t` is clamped. `y - Math.round(arc(t) * 12)` is a 12 px jump.
 */
export function arc(t: number): number {
  t = clamp(t);
  return 4 * t * (1 - t);
}

/** Triangle wave: 0 at t = 0, 1 at t = 1, back to 0 at t = 2, and so on. */
export function pingPong(t: number): number {
  const m = ((t % 2) + 2) % 2;
  return m <= 1 ? m : 2 - m;
}

/**
 * Quantise progress `t` (0..1) into `steps` equal jumps, like CSS `steps(n, end)`:
 * with 4 steps the result is 0, 0.25, 0.5 or 0.75, and 1 only when `t` reaches 1.
 */
export function stepped(t: number, steps: number): number {
  const n = Math.max(1, Math.floor(steps));
  return Math.floor(clamp(t) * n) / n;
}

/**
 * The frame to show at time `t` (seconds) for a loop of `count` frames played at `fps`.
 * Always a whole number from 0 to `count - 1`, for negative `t` too (and 0 if anything
 * is NaN or infinite, so a bad clock shows the first frame, never nothing).
 */
export function frameAt(t: number, fps: number, count: number): number {
  const n = Math.max(1, Math.floor(count) || 1);
  const f = Math.floor(t * fps) % n;
  if (!(f === f)) return 0;
  return f < 0 ? f + n : f;
}

/**
 * A sine wave from -1 to 1 that repeats every `period` seconds. It is 0 at t = 0 and
 * rising. For a whole-pixel bob write `Math.round(wave(t, 2) * 2)`.
 */
export function wave(t: number, period: number): number {
  return period === 0 ? 0 : Math.sin((t / period) * Math.PI * 2);
}
