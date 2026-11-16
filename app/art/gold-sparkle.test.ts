import { describe, expect, it } from "vitest";

import { Surface, TRANSPARENT, mix, type Color } from "~/pixel";
import { drawGlint, drawGoldSparkle, isGoldLeather } from "~/art/gold-sparkle";
import { lightingFor } from "~/art/lighting";
import { MODE_COLORS, P } from "~/art/palette";

// The golden ball's sparkle (the product owner, 2026-11-16: "add some sparkle effect on
// ball when its golden so the shimmer sound makes sense").

const W = 220;
const H = 220;
const CX = 110;
const CY = 110;
const R = 90;
/** A panel of the ball: black, with a frame in HOME's colour and chalk lettering in it. */
const PANEL = { x: 36, y: 86, w: 52, h: 44 } as const;
/** The ball's own white glint, up and to the left. */
const SHINE = { x: 72, y: 46, r: 9 } as const;

/** A golden ball, simply: a disc of gold in three tones, a panel, and its white glint. */
function ball(r = R): Surface {
  const s = new Surface(W, H);
  s.disc(CX, CY, r, P.goldDark);
  s.disc(CX - 3, CY - 3, r - 6, P.gold);
  s.disc(CX - 14, CY - 14, Math.round(r * 0.6), P.goldLight);
  if (r === R) {
    s.rect(PANEL.x, PANEL.y, PANEL.w, PANEL.h, MODE_COLORS.home.base);
    s.rect(PANEL.x + 1, PANEL.y + 1, PANEL.w - 2, PANEL.h - 2, P.ink);
    s.rect(PANEL.x + 8, PANEL.y + 16, 36, 9, P.chalk);
    s.disc(SHINE.x, SHINE.y, SHINE.r, P.white);
  }
  return s;
}

/** The pixels of `b` that are not those of `a`. */
function changed(a: Surface, b: Surface): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (a.data[y * W + x] !== b.data[y * W + x]) out.push({ x, y });
    }
  }
  return out;
}

const at = (t: number, more = {}) => ({
  cx: CX,
  cy: CY,
  r: R,
  t,
  seed: 7,
  ...more,
});

describe("what counts as the golden ball's leather", () => {
  it("is every tone of its gold in any light, and nothing else on the ball", () => {
    const lights = [45, 4, -30].map((elevation) =>
      lightingFor({ elevation, morning: false }),
    );
    const deep = mix(P.goldDark, P.retroDark, 0.55);
    for (const light of lights) {
      for (const tone of [
        P.goldLight,
        P.gold,
        mix(P.gold, P.goldDark, 0.5),
        P.goldDark,
        deep,
      ]) {
        expect(isGoldLeather(light.lit(tone))).toBe(true);
      }
      // its own white glint, its panels, their lettering
      for (const other of [P.white, P.chalk, P.ink, P.mist, P.slate]) {
        expect(isGoldLeather(light.lit(other))).toBe(false);
      }
    }
    // the panels' frames and pictures: HOME, AWAY and NEXT-GEN in all their tones
    for (const mode of ["home", "away", "nextgen"] as const) {
      const c = MODE_COLORS[mode];
      for (const tone of [c.base, c.light, c.dark]) {
        expect(isGoldLeather(tone), mode).toBe(false);
      }
    }
    expect(isGoldLeather(TRANSPARENT)).toBe(false);
    expect(isGoldLeather(P.grass)).toBe(false);
  });
});

describe("a glint", () => {
  /** What a glint with arms `arm` long paints on nothing, round (20, 20). */
  function glint(arm: number): { n: number; span: number; s: Surface } {
    const s = new Surface(41, 41);
    drawGlint(s, 20, 20, arm);
    let n = 0;
    let span = 0;
    for (let y = 0; y < 41; y++) {
      for (let x = 0; x < 41; x++) {
        if (s.get(x, y) === TRANSPARENT) continue;
        n++;
        span = Math.max(span, Math.abs(x - 20), Math.abs(y - 20));
      }
    }
    return { n, span, s };
  }

  it("is a point of light, then a star that grows with its arms, white at its heart", () => {
    expect(glint(0).n).toBe(1);
    let last = 1;
    for (const arm of [1, 2, 3, 5, 6]) {
      const g = glint(arm);
      expect(g.n).toBeGreaterThan(last);
      last = g.n;
      // its rays, and from 2 the gold drawn close round them
      expect(g.span).toBe(arm >= 2 ? arm + 1 : arm);
      expect(g.s.get(20, 20)).toBe(P.white);
      // the same on every side
      for (let d = 1; d <= arm + 1; d++) {
        const right = g.s.get(20 + d, 20);
        expect(g.s.get(20 - d, 20)).toBe(right);
        expect(g.s.get(20, 20 - d)).toBe(right);
        expect(g.s.get(20, 20 + d)).toBe(right);
      }
    }
    // the ends of a long ray are pale gold, and gold is beyond them
    const big = glint(6).s;
    expect(big.get(26, 20)).toBe(P.goldLight);
    expect(big.get(27, 20)).toBe(P.gold);
  });
});

describe("the golden ball's sparkle", () => {
  it("is there all the time, here and there, and only ever on the gold leather", () => {
    const base = ball();
    let frames = 0;
    let lit = 0;
    let glints = 0;
    let off = 0;
    const quarters = [0, 0, 0, 0];
    const pictures = new Set<string>();
    for (let t = 0; t < 6; t += 1 / 14) {
      const s = ball();
      const n = drawGoldSparkle(s, at(t));
      frames++;
      glints += n;
      const now = changed(base, s);
      if (now.length > 0) lit++;
      expect(n > 0).toBe(now.length > 0);
      for (const p of now) {
        // never on the panel, its frame or its lettering, the white glint, or off the ball
        if (!isGoldLeather(base.get(p.x, p.y) as Color)) off++;
        quarters[(p.x < CX ? 0 : 1) + (p.y < CY ? 0 : 2)]++;
      }
      pictures.add(now.map((p) => `${p.x},${p.y}`).join(";"));
    }
    expect(off).toBe(0);
    // nearly always something to see, a few at a time
    expect(lit / frames).toBeGreaterThan(0.95);
    expect(glints / frames).toBeGreaterThan(2.5);
    expect(glints / frames).toBeLessThan(9);
    // all over the ball, and never the same for long
    for (const q of quarters) expect(q).toBeGreaterThan(200);
    expect(pictures.size).toBeGreaterThan(frames * 0.8);
  });

  it("is a pure function of the clock and the seed", () => {
    for (const t of [0.3, 1.7, 4.05]) {
      const a = ball();
      const b = ball();
      drawGoldSparkle(a, at(t));
      drawGoldSparkle(b, at(t));
      expect(b.data).toEqual(a.data);
    }
    // another day's ball sparkles elsewhere
    let differ = 0;
    for (const t of [0.3, 1.7, 4.05]) {
      const a = ball();
      const b = ball();
      drawGoldSparkle(a, at(t));
      drawGoldSparkle(b, at(t, { seed: 8 }));
      if (changed(a, b).length > 0) differ++;
    }
    expect(differ).toBeGreaterThan(0);
  });

  it("has more of it while the ball is being celebrated, and less on a small ball", () => {
    let plain = 0;
    let lively = 0;
    let small = 0;
    for (let t = 0; t < 6; t += 1 / 14) {
      plain += drawGoldSparkle(ball(), at(t));
      lively += drawGoldSparkle(ball(), at(t, { lively: true }));
      small += drawGoldSparkle(ball(36), at(t, { r: 36 }));
    }
    expect(lively).toBeGreaterThan(plain * 1.2);
    expect(small).toBeLessThan(plain * 0.8);
    expect(small).toBeGreaterThan(0);
  });

  it("stands still with reduced motion: a few glints, the same whatever the time", () => {
    const base = ball();
    const first = ball();
    expect(drawGoldSparkle(first, at(0, { still: true }))).toBe(4);
    const lit = changed(base, first);
    expect(lit.length).toBeGreaterThan(60);
    for (const p of lit) {
      expect(isGoldLeather(base.get(p.x, p.y) as Color)).toBe(true);
    }
    for (const t of [0.4, 3, 77.7]) {
      const s = ball();
      drawGoldSparkle(s, at(t, { still: true }));
      expect(s.data).toEqual(first.data);
    }
  });

  it("is nothing on a ball that is not gold, or where there is no ball", () => {
    const white = new Surface(W, H);
    white.disc(CX, CY, R, P.white);
    const before = white.data.slice();
    for (let t = 0; t < 3; t += 0.25) {
      expect(drawGoldSparkle(white, at(t))).toBe(0);
      expect(drawGoldSparkle(white, at(t, { still: true }))).toBe(0);
    }
    expect(white.data).toEqual(before);
    const gold = ball();
    expect(drawGoldSparkle(gold, at(1, { r: 0 }))).toBe(0);
    expect(drawGoldSparkle(gold, at(Number.NaN))).toBe(0);
    expect(gold.data).toEqual(ball().data);
  });
});
