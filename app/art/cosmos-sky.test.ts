/**
 * Space's backdrop and life (./cosmos-sky.ts): every pixel filled the same way each time,
 * clouds covering about the same share of the sky at every scale and every day, and the life
 * over it drawn only on the backdrop, never on what is in front of it.
 */
import { describe, expect, it } from "vitest";

import { type Color, Surface } from "~/pixel";

import {
  GEO_KM,
  drawSpaceBackdrop,
  drawSpaceLife,
  sparkles,
} from "./cosmos-sky";
import { P } from "./palette";

const LY = 9.4607e12;
const [w, h] = [320, 180];

/** Every colour a cloud can be. */
const CLOUD: ReadonlySet<Color> = new Set([
  P.nightMid,
  P.duskTop,
  P.nextgenDark,
  P.duskMid,
  P.nightLow,
  P.awayDark,
  P.away,
  P.dawnMid,
  P.furthestDark,
  P.furthest,
  P.brickDark,
  P.brick,
]);

function backdrop(kpp: number, seed = 7): Surface {
  const s = new Surface(w, h);
  s.clear(P.white);
  drawSpaceBackdrop(s, { ex: w * 0.4, ey: h * 0.5, kpp, seed });
  return s;
}

const same = (a: Surface, b: Surface) =>
  Buffer.from(a.data.buffer).equals(Buffer.from(b.data.buffer));

describe("space's backdrop", () => {
  it("fills every pixel, the same each time", () => {
    for (const across of [1e6, 1e10, 50 * LY, 1e6 * LY]) {
      const a = backdrop(across / w);
      expect(same(a, backdrop(across / w))).toBe(true);
      let white = 0;
      for (const c of a.data) if (c === P.white) white++;
      // white only for stars: the page never shows through
      expect(white).toBeLessThan(w * h * 0.02);
    }
  });

  // the product owner, 2026-11-19: "just so it looks cool rather than black with a couple
  // dots and labels"; about as much of it every day, at every scale
  it("has clouds over about the same share of the sky at every scale and on every day", () => {
    // out between the galaxies, where the Milky Way's band is not across the sky
    for (const across of [1e6 * LY, 1e8 * LY, 1e10 * LY]) {
      for (const seed of [1, 7, 42, 2026]) {
        const s = backdrop(across / w, seed);
        let cloud = 0;
        for (const c of s.data) if (CLOUD.has(c as Color)) cloud++;
        const share = cloud / (w * h);
        expect(share, `${across} km, seed ${seed}`).toBeGreaterThan(0.3);
        expect(share, `${across} km, seed ${seed}`).toBeLessThan(0.55);
      }
    }
  });

  it("puts the Milky Way across the sky while the picture is inside it, not outside", () => {
    const tinted = (across: number) => {
      const s = backdrop(across / w, 3);
      let n = 0;
      for (const c of s.data) if (c !== P.ink) n++;
      return n / (w * h);
    };
    // its band and its crowd of stars, on top of the clouds
    expect(tinted(100 * LY)).toBeGreaterThan(tinted(1e6 * LY) + 0.05);
  });

  it("moves its clouds and nearer things with the camera, not its far stars", () => {
    const a = backdrop(1e10 / w);
    const b = backdrop(1.3e10 / w);
    expect(same(a, b)).toBe(false);
    // the big far stars stay where they are on the picture
    for (const sp of sparkles(w, h, 7)) {
      expect(a.get(sp.x, sp.y)).toBe(P.white);
      expect(b.get(sp.x, sp.y)).toBe(P.white);
    }
  });
});

describe("space's life", () => {
  /** A backdrop with a box in front of it (the stand-in for a name or the pin). */
  function scene(kpp: number): Surface {
    const s = backdrop(kpp);
    s.rect(100, 60, 120, 60, P.chalk);
    return s;
  }

  function copyOf(s: Surface): Surface {
    const c = new Surface(s.w, s.h);
    c.copy(s);
    return c;
  }

  const life = (s: Surface, kpp: number, t: number, reduced = false) =>
    drawSpaceLife(s, {
      ex: w * 0.4,
      ey: h * 0.5,
      kpp,
      k: 1,
      seed: 7,
      t,
      reduced,
    });

  it("twinkles and shoots stars over the backdrop, never over what is in front of it", () => {
    const kpp = (1e6 * LY) / w;
    const base = scene(kpp);
    let changed = 0;
    let over = 0;
    for (let t = 0; t < 30; t += 0.1) {
      const s = copyOf(base);
      life(s, kpp, t);
      for (let y = 60; y < 120; y++) {
        for (let x = 100; x < 220; x++) if (s.get(x, y) !== P.chalk) over++;
      }
      if (!same(s, base)) changed++;
    }
    expect(over).toBe(0);
    expect(changed).toBeGreaterThan(10);
  });

  it("with reduced motion, shoots no stars: only the big stars change", () => {
    const kpp = (1e6 * LY) / w;
    const base = scene(kpp);
    const near = sparkles(w, h, 7);
    const stray: string[] = [];
    for (let t = 0; t < 30; t += 0.1) {
      const s = copyOf(base);
      life(s, kpp, t, true);
      for (let i = 0; i < s.data.length; i++) {
        if (s.data[i] === base.data[i]) continue;
        const x = i % w;
        const y = Math.floor(i / w);
        const by = near.some(
          (sp) => Math.abs(sp.x - x) + Math.abs(sp.y - y) <= 3,
        );
        if (!by) stray.push(`${x},${y} at ${t.toFixed(1)} s`);
      }
    }
    expect(stray).toEqual([]);
  });

  it("sends satellites round the Earth, on their ring while it is small", () => {
    const kpp = GEO_KM / 50;
    const s = backdrop(kpp);
    const before = new Surface(w, h);
    before.copy(s);
    life(s, kpp, 1);
    let onRing = 0;
    for (let i = 0; i < s.data.length; i++) {
      if (s.data[i] === before.data[i]) continue;
      const d = Math.hypot((i % w) - w * 0.4, Math.floor(i / w) - h * 0.5);
      if (Math.abs(d - 50) <= 2) onRing++;
    }
    expect(onRing).toBeGreaterThan(8);
  });
});
