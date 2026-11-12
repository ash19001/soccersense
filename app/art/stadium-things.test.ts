import { afterEach, describe, expect, it } from "vitest";
import { Surface, rgb } from "~/pixel";
import {
  ShadowLog,
  logShadows,
  shadowBlob,
  shadowPoly,
} from "~/art/stadium-things";

const GRASS = rgb(0x3a5f2b);
const ROOF = rgb(0x8a3b2c);

function ground(): Surface {
  const s = new Surface(16, 8);
  s.clear(GRASS);
  return s;
}

afterEach(() => logShadows(null));

describe("shadowBlob through a depth mask", () => {
  it("darkens only where nothing nearer than the caster stands", () => {
    const s = ground();
    const depth = new Float32Array(s.w * s.h).fill(1e9);
    // a roof at depth 5 over the right half
    for (let y = 0; y < s.h; y++) {
      for (let x = 8; x < s.w; x++) {
        depth[y * s.w + x] = 5;
        s.data[y * s.w + x] = ROOF;
      }
    }
    // a car at depth 9, behind the roof: its shadow stays on the grass
    shadowBlob(s, 8, 4, 5, 1, depth, 9);
    for (let x = 0; x < s.w; x++) {
      const c = s.data[4 * s.w + x];
      if (x < 3) expect(c).toBe(GRASS);
      else if (x < 8) expect(c).not.toBe(GRASS);
      else expect(c).toBe(ROOF);
    }
    // a car at depth 2, in front of it: its shadow falls on the roof too
    const t = ground();
    t.rect(8, 0, 8, 8, ROOF);
    shadowBlob(t, 8, 4, 5, 1, depth, 2);
    for (let x = 3; x <= 13; x++) {
      expect(t.data[4 * t.w + x]).not.toBe(x < 8 ? GRASS : ROOF);
    }
  });

  it("darkens the same pixels as before on open ground", () => {
    const a = ground();
    const b = ground();
    const depth = new Float32Array(a.w * a.h).fill(1e9);
    shadowBlob(a, 7, 4, 4, 1);
    shadowBlob(b, 7, 4, 4, 1, depth, 3);
    expect(Array.from(b.data)).toEqual(Array.from(a.data));
    expect(Array.from(a.data).filter((c) => c !== GRASS).length).toBe(11);
  });
});

describe("ShadowLog", () => {
  it("tells ground only a shadow darkened from a thing painted over it", () => {
    const s = ground();
    const log = new ShadowLog(s);
    logShadows(log);
    const before = Uint32Array.from(s.data);
    log.now++;
    shadowBlob(s, 4, 4, 3, 1);
    shadowPoly(s, [
      [3, 2],
      [7, 2],
      [7, 6],
      [3, 6],
    ]);
    // a sprite stands on part of the shadow
    s.px(4, 4, ROOF);
    // a sprite painted, then a shadow over it in the same pass
    s.px(12, 4, ROOF);
    shadowBlob(s, 12, 4, 1, 0);
    let only = 0;
    for (let i = 0; i < s.data.length; i++) {
      if (s.data[i] === before[i]) continue;
      if (log.onlyShadow(i, before[i])) only++;
      else {
        expect([4 * s.w + 4, 4 * s.w + 12]).toContain(i);
      }
    }
    expect(only).toBeGreaterThan(10);
    // two shadows over one pixel are still only shadow
    expect(log.onlyShadow(4 * s.w + 5, GRASS)).toBe(true);
    // the next pass starts clean
    log.now++;
    expect(log.onlyShadow(4 * s.w + 5, s.data[4 * s.w + 5])).toBe(false);
  });

  it("notes nothing on another surface, nor once it is put away", () => {
    const s = ground();
    const other = ground();
    const log = new ShadowLog(s);
    logShadows(log);
    shadowBlob(other, 4, 4, 3, 1);
    expect(log.pass.every((p) => p === 0)).toBe(true);
    logShadows(null);
    shadowBlob(s, 4, 4, 3, 1);
    expect(log.pass.every((p) => p === 0)).toBe(true);
  });
});
