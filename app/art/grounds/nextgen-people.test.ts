import { describe, expect, it } from "vitest";
import { P } from "~/art/palette";
import { Surface, TRANSPARENT, type Color } from "~/pixel";
import {
  bandCrest,
  drawFanBand,
  nextgenCoat,
  nextgenLights,
  nextgenWatcherLights,
  nextgenShirts,
  type Lights,
} from "./nextgen-people";

const MAGENTA = new Set<Color>([P.nextgen, P.nextgenLight]);

function share(
  table: ReturnType<typeof nextgenShirts>,
  of: Set<Color>,
): number {
  let all = 0;
  let mine = 0;
  for (const [c, w] of table) {
    all += w;
    if (of.has(c)) mine += w;
  }
  return mine / all;
}

describe("NEXT-GEN's crowd", () => {
  it("leads with magenta but mixes in cyan, white, silver and dark", () => {
    for (const tier of [2, 3, 4] as const) {
      const t = nextgenShirts(tier, 0.8);
      const m = share(t, MAGENTA);
      // magenta is the biggest single colour, yet well under half the crowd
      expect(m).toBeGreaterThan(0.12);
      expect(m).toBeLessThan(0.35);
      const colours = new Set(t.map(([c]) => c));
      for (const c of [P.white, P.night, P.steelHi, P.away]) {
        expect(colours.has(c)).toBe(true);
      }
    }
  });

  it("gives about a third a wristband and one in seven a visor, halos only at night", () => {
    const out: Lights = { band: TRANSPARENT, visor: TRANSPARENT };
    let bands = 0;
    let visors = 0;
    const n = 4000;
    for (let i = 0; i < n; i++) {
      nextgenLights(out, 7, (i % 80) * 8, Math.floor(i / 80) * 10, false);
      if (out.band !== TRANSPARENT) bands++;
      if (out.visor !== TRANSPARENT) visors++;
      expect(out.halo).toBe(TRANSPARENT);
      // a visor is never pink: it would vanish on a face
      expect(MAGENTA.has(out.visor)).toBe(false);
    }
    expect(bands / n).toBeGreaterThan(0.25);
    expect(bands / n).toBeLessThan(0.45);
    expect(visors / n).toBeGreaterThan(0.1);
    expect(visors / n).toBeLessThan(0.2);
    nextgenLights(out, 7, 0, 0, true);
    for (let x = 0; out.band === TRANSPARENT; x += 8) {
      nextgenLights(out, 7, x, 0, true);
    }
    expect(out.halo).not.toBe(TRANSPARENT);
  });

  it("draws a band as a 2 x 2 cluster, never a stray pixel", () => {
    for (const pose of [0, 1, 2, 3, 4, 5]) {
      const s = new Surface(40, 40);
      drawFanBand(s, 20, 20, pose, P.awayLight, P.slate, P.skinA);
      let n = 0;
      for (let y = 0; y < 40; y++) {
        for (let x = 0; x < 40; x++) {
          if (s.get(x, y) !== P.awayLight) continue;
          n++;
          // every lit pixel has a lit neighbour across and one up or down
          const across =
            s.get(x - 1, y) === P.awayLight || s.get(x + 1, y) === P.awayLight;
          const upDown =
            s.get(x, y - 1) === P.awayLight || s.get(x, y + 1) === P.awayLight;
          expect(across && upDown, `pose ${pose} at ${x},${y}`).toBe(true);
        }
      }
      expect(n % 4).toBe(0);
      expect(n).toBeGreaterThan(0);
    }
  });

  it("runs a light wave: each band crests one step in three, four steps a second", () => {
    let lit = 0;
    for (let k = 0; k < 12; k++) if (bandCrest(40, 20, k / 4)) lit++;
    expect(lit).toBe(4);
    // neighbours along the wave crest at different moments
    const a = [0, 1, 2].map((k) => bandCrest(0, 0, k / 4));
    const b = [0, 1, 2].map((k) => bandCrest(12, 0, k / 4));
    expect(a).not.toEqual(b);
  });
});

describe("NEXT-GEN's standing watchers", () => {
  const E = (c: Color): Color => c;
  it("wear his magenta for today's red and slim dark jackets for every other coat", () => {
    expect(nextgenCoat(E, P.home, 3)).toBe(P.nextgen);
    expect(nextgenCoat(E, P.homeDark, 3)).toBe(P.nextgenDark);
    const jackets = new Set<Color>([
      P.slate,
      P.night,
      P.steel,
      P.concreteLight,
    ]);
    for (const coat of [P.awayDark, P.wood, P.grassDark, P.ink]) {
      for (let n = 0; n < 10; n++)
        expect(jackets.has(nextgenCoat(E, coat, n))).toBe(true);
    }
  });
  it("all have a trim of light, and about half a visor or a wristband", () => {
    let lit = 0;
    for (let n = 0; n < 200; n++) {
      const l = nextgenWatcherLights(7, 40 + n * 13, n);
      expect([P.awayLight, P.white]).toContain(l.trim);
      if (l.visor !== TRANSPARENT || l.band !== TRANSPARENT) lit++;
    }
    expect(lit / 200).toBeGreaterThan(0.4);
    expect(lit / 200).toBeLessThan(0.85);
  });
});
