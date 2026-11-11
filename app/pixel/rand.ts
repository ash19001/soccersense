/**
 * Seeded randomness. Painters never call `Math.random()`: same seed, same pixels.
 */

/** A deterministic generator. Call it for the next value in 0..1 (1 excluded). */
export interface Rng {
  (): number;
  /** Whole number from `a` to `b`, both included. */
  int(a: number, b: number): number;
  /** Number from `a` up to (not including) `b`. */
  range(a: number, b: number): number;
  /** One item of a non-empty array. */
  pick<T>(items: readonly T[]): T;
  /** True with probability `p` (0 never, 1 always). */
  chance(p: number): boolean;
}

/**
 * A small fast generator (mulberry32). Two generators made with the same seed give the same
 * sequence. Any number is a valid seed; it is truncated to 32 bits.
 */
export function rng(seed: number): Rng {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let z = state;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
  const r = next as Rng;
  r.int = (a, b) => {
    const lo = Math.ceil(Math.min(a, b));
    const hi = Math.floor(Math.max(a, b));
    return lo + Math.floor(next() * (hi - lo + 1));
  };
  r.range = (a, b) => a + next() * (b - a);
  r.pick = (items) => items[Math.floor(next() * items.length)];
  r.chance = (p) => next() < p;
  return r;
}

/**
 * A stable value in 0..1 (1 excluded) for an integer cell. Use it for anything that must
 * not change between frames: which fan wears which colour, where the stars are, which
 * window is lit. `x` and `y` are truncated to 32-bit integers.
 */
export function hash2(x: number, y: number, seed = 0): number {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1);
  h ^= Math.imul(seed | 0, 0x9e3779b1) + 0x85ebca6b;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
