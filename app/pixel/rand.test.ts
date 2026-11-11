import { describe, expect, test } from "vitest";

import {
  arc,
  clamp,
  easeInCubic,
  easeInOutCubic,
  easeOutBack,
  easeOutCubic,
  frameAt,
  invLerp,
  lerp,
  pingPong,
  remap,
  smoothstep,
  stepped,
  wave,
} from "./ease";
import { hash2, rng } from "./rand";

describe("rng", () => {
  test("the same seed gives the same sequence", () => {
    const a = rng(1234);
    const b = rng(1234);
    const first = Array.from({ length: 50 }, () => a());
    const second = Array.from({ length: 50 }, () => b());
    expect(second).toEqual(first);
    expect(new Set(first).size).toBe(50);
  });

  test("different seeds give different sequences", () => {
    expect(rng(1)()).not.toBe(rng(2)());
    expect(rng(0)()).not.toBe(rng(1)());
  });

  test("the sequence is pinned, so art does not change by accident", () => {
    const r = rng(42);
    expect([r(), r(), r()].map((v) => v.toFixed(6))).toEqual([
      "0.601104",
      "0.448291",
      "0.852466",
    ]);
  });

  test("values stay in 0..1 and are spread evenly", () => {
    const r = rng(7);
    let sum = 0;
    const buckets = new Array<number>(10).fill(0);
    for (let i = 0; i < 20000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      sum += v;
      buckets[Math.floor(v * 10)]++;
    }
    expect(sum / 20000).toBeCloseTo(0.5, 1);
    for (const n of buckets) expect(Math.abs(n - 2000)).toBeLessThan(250);
  });

  test("int includes both ends", () => {
    const r = rng(3);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) seen.add(r.int(2, 5));
    expect([...seen].sort()).toEqual([2, 3, 4, 5]);
    expect(rng(3).int(4, 4)).toBe(4);
    expect([5, 6, 7]).toContain(rng(3).int(7, 5));
  });

  test("range, pick and chance", () => {
    const r = rng(9);
    for (let i = 0; i < 200; i++) {
      const v = r.range(-2, 3);
      expect(v).toBeGreaterThanOrEqual(-2);
      expect(v).toBeLessThan(3);
    }
    const items = ["a", "b", "c"] as const;
    const picked = new Set<string>();
    for (let i = 0; i < 200; i++) picked.add(r.pick(items));
    expect(picked.size).toBe(3);
    expect(r.chance(0)).toBe(false);
    expect(r.chance(1)).toBe(true);
    let hits = 0;
    for (let i = 0; i < 4000; i++) if (r.chance(0.2)) hits++;
    expect(hits / 4000).toBeCloseTo(0.2, 1);
  });

  test("helpers draw from the same deterministic stream", () => {
    const a = rng(77);
    const b = rng(77);
    expect([
      a.int(0, 9),
      a.range(0, 1),
      a.pick([1, 2, 3]),
      a.chance(0.5),
    ]).toEqual([b.int(0, 9), b.range(0, 1), b.pick([1, 2, 3]), b.chance(0.5)]);
  });
});

describe("hash2", () => {
  test("is stable and in 0..1", () => {
    for (let y = -20; y < 20; y++) {
      for (let x = -20; x < 20; x++) {
        const v = hash2(x, y);
        expect(v).toBe(hash2(x, y));
        expect(v).toBe(hash2(x, y, 0));
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
      }
    }
  });

  test("neighbours, swapped coordinates and seeds all differ", () => {
    expect(hash2(1, 2)).not.toBe(hash2(2, 1));
    expect(hash2(0, 0)).not.toBe(hash2(1, 0));
    expect(hash2(0, 0)).not.toBe(hash2(0, 1));
    expect(hash2(5, 5, 1)).not.toBe(hash2(5, 5, 2));
  });

  test("is spread evenly over a grid", () => {
    let sum = 0;
    let low = 0;
    for (let y = 0; y < 100; y++) {
      for (let x = 0; x < 100; x++) {
        const v = hash2(x, y, 3);
        sum += v;
        if (v < 0.2) low++;
      }
    }
    expect(sum / 10000).toBeCloseTo(0.5, 1);
    expect(low / 10000).toBeCloseTo(0.2, 1);
  });
});

describe("ease", () => {
  test("clamp, lerp, invLerp, remap", () => {
    expect(clamp(1.5)).toBe(1);
    expect(clamp(-1)).toBe(0);
    expect(clamp(7, 2, 5)).toBe(5);
    expect(lerp(10, 20, 0.25)).toBe(12.5);
    expect(lerp(10, 20, 2)).toBe(30);
    expect(invLerp(10, 20, 15)).toBe(0.5);
    expect(invLerp(3, 3, 3)).toBe(0);
    expect(remap(5, 0, 10, 100, 200)).toBe(150);
    expect(remap(50, 0, 10, 100, 200)).toBe(200);
    expect(remap(-5, 0, 10, 100, 200)).toBe(100);
    expect(remap(2, 0, 10, 200, 100)).toBe(180);
  });

  test("easing curves start at 0, end at 1 and clamp outside", () => {
    for (const ease of [
      easeInCubic,
      easeOutCubic,
      easeInOutCubic,
      easeOutBack,
    ]) {
      expect(ease(0)).toBeCloseTo(0, 10);
      expect(ease(1)).toBeCloseTo(1, 10);
      expect(ease(-3)).toBeCloseTo(0, 10);
      expect(ease(3)).toBeCloseTo(1, 10);
    }
    expect(easeInCubic(0.5)).toBeLessThan(0.5);
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 10);
    expect(easeOutBack(0.7)).toBeGreaterThan(1); // the overshoot
    expect(smoothstep(2, 4, 1)).toBe(0);
    expect(smoothstep(2, 4, 3)).toBe(0.5);
    expect(smoothstep(2, 4, 9)).toBe(1);
  });

  test("pingPong is a triangle wave", () => {
    expect(pingPong(0)).toBe(0);
    expect(pingPong(0.25)).toBe(0.25);
    expect(pingPong(1)).toBe(1);
    expect(pingPong(1.5)).toBe(0.5);
    expect(pingPong(2)).toBe(0);
    expect(pingPong(-0.5)).toBe(0.5);
  });

  test("stepped quantises like CSS steps(n, end)", () => {
    expect(stepped(0, 4)).toBe(0);
    expect(stepped(0.24, 4)).toBe(0);
    expect(stepped(0.26, 4)).toBe(0.25);
    expect(stepped(0.99, 4)).toBe(0.75);
    expect(stepped(1, 4)).toBe(1);
    expect(stepped(0.5, 0)).toBe(0);
  });

  test("frameAt loops and never goes out of range", () => {
    expect(frameAt(0, 8, 4)).toBe(0);
    expect(frameAt(0.13, 8, 4)).toBe(1);
    expect(frameAt(0.5, 8, 4)).toBe(0);
    expect(frameAt(-0.01, 8, 4)).toBe(3);
    for (let t = -3; t < 3; t += 0.037) {
      const f = frameAt(t, 7, 3);
      expect([0, 1, 2]).toContain(f);
    }
  });

  test("wave is a sine from -1 to 1 with the given period", () => {
    expect(wave(0, 2)).toBeCloseTo(0, 10);
    expect(wave(0.5, 2)).toBeCloseTo(1, 10);
    expect(wave(1.5, 2)).toBeCloseTo(-1, 10);
    expect(wave(2, 2)).toBeCloseTo(0, 10);
    expect(wave(1, 0)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Added in review
// ---------------------------------------------------------------------------

describe("ease, odd input", () => {
  test("frameAt gives frame 0 for a clock or a count that is not a number", () => {
    for (const t of [NaN, Infinity, -Infinity]) {
      expect(frameAt(t, 8, 4)).toBe(0);
    }
    expect(frameAt(1, NaN, 4)).toBe(0);
    expect(frameAt(1, 8, NaN)).toBe(0);
    expect(frameAt(1, 8, 0)).toBe(0);
    expect(frameAt(1, 8, -3)).toBe(0);
    expect(frameAt(0.3, 10, 2.9)).toBe(1);
    expect(Object.is(frameAt(-0.01, 10, 4), 3)).toBe(true);
  });

  test("arc is a hop: 0, up to 1 in the middle, back to 0", () => {
    expect(arc(0)).toBe(0);
    expect(arc(0.5)).toBe(1);
    expect(arc(1)).toBe(0);
    expect(arc(0.25)).toBeCloseTo(0.75);
    expect(arc(0.25)).toBeCloseTo(arc(0.75));
    expect(arc(-2)).toBe(0);
    expect(arc(3)).toBe(0);
  });
});
