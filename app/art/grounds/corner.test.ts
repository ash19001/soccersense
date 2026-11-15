/**
 * The corner stand at an international (tiers 5 to 7): the seats sweep round from the side
 * stand into the end, in every era, instead of the gap to the town of tiers 3 and 4.
 */

import { describe, expect, it } from "vitest";
import { lightingFor } from "~/art/lighting";
import { Surface, TRANSPARENT } from "~/pixel";
import { FAN_CLEAR, cornerColumns, cornerRowAt, cornerStart } from "./corner";
import { endFor, paintEnd } from "./end";
import { END_PROFILE } from "./end-profile";
import { Life } from "./life";
import { geoFor, paintFor, type Paint } from "./paint";
import { paintStadium } from "./stadium";
import type { Tier } from "./types";

const DAY = lightingFor({ elevation: 35, morning: false });
const NIGHT = lightingFor({ elevation: -25, morning: false });
const SIZES = [
  [960, 540],
  [854, 480],
  [683, 384],
  [260, 563],
  [234, 507],
] as const;
const ERAS = ["today", "retro", "nextgen"] as const;

/** The far side and the end alone (no town behind them), and the paint they were made with. */
function stands(
  w: number,
  h: number,
  tier: Tier,
  era: (typeof ERAS)[number],
  light = DAY,
): { s: Surface; p: Paint; life: Life } {
  const p = paintFor(geoFor(w, h), light, tier, "home", 3, {}, era);
  const s = new Surface(w, h);
  const life = new Life(6000);
  paintStadium(s, p, life);
  paintEnd(s, p, life);
  return { s, p, life };
}

/** The pixels left empty in the corner, from its roof's top down to the far touchline. */
function gaps(s: Surface, p: Paint): number {
  const [x0, x1] = cornerColumns(p);
  let n = 0;
  for (let x = x0; x < x1; x++) {
    const top = Math.ceil(cornerRowAt(p, x, END_PROFILE.TOP));
    for (let y = Math.max(0, top); y < p.g.F; y++) {
      if (s.get(x, y) === TRANSPARENT) n++;
    }
  }
  return n;
}

describe("the corner stand", { timeout: 60_000 }, () => {
  it("closes the corner from the international up, in every era and at every size", () => {
    for (const era of ERAS) {
      for (const [w, h] of SIZES) {
        const at = `${era} ${w}x${h}`;
        // the top flight keeps its gap to the town
        expect(
          gaps(stands(w, h, 4, era).s, stands(w, h, 4, era).p),
          at,
        ).toBeGreaterThan(100);
        for (const tier of [5, 6, 7] as const) {
          const { s, p } = stands(w, h, tier, era, tier >= 6 ? NIGHT : DAY);
          expect(gaps(s, p), `${at} tier ${tier}`).toBe(0);
        }
      }
    }
  });

  it("curves round from the side stand's roof into the end's: level, then on in its line", () => {
    const T = END_PROFILE.TOP;
    for (const [w, h] of SIZES) {
      const p = paintFor(geoFor(w, h), DAY, 5, "home", 3, {});
      const e = endFor(p.g);
      const [x0, x1] = cornerColumns(p);
      // it leaves the side stand at its roof's top row, level
      expect(Math.round(cornerRowAt(p, x0 - 1, T))).toBe(p.g.F - 142);
      expect(
        Math.abs(cornerRowAt(p, x0 + 1, T) - cornerRowAt(p, x0, T)),
      ).toBeLessThan(0.1);
      // and comes down round the bend all the way (it turns towards us), never back up
      for (let x = x0; x < x1; x++) {
        expect(cornerRowAt(p, x, T)).toBeGreaterThanOrEqual(
          cornerRowAt(p, x - 1, T) - 1e-9,
        );
      }
      // where it hands on to the end, it is on the end's roof and running in its line
      const start = cornerStart(p);
      expect(start).not.toBeNull();
      const u = start!(T);
      const z = 1 + e.grow * u;
      const bx = e.xA + e.m * u + e.lean * T * z;
      const by = e.y0 + u - T * z;
      const at = (x: number): number => cornerRowAt(p, x - 0.5, T);
      expect(Math.abs(at(bx) - by), `${w}x${h}`).toBeLessThan(0.01);
      const slope = (1 - T * e.grow) / (e.m + e.lean * T * e.grow);
      expect(Math.abs(at(bx) - at(bx - 1) - slope)).toBeLessThan(0.05);
      expect(Math.abs(at(bx + 1) - at(bx) - slope)).toBeLessThan(1e-6);
    }
  });

  it("keeps its rows one above the other all the way round, never crossing", () => {
    const T = END_PROFILE.TOP;
    for (const [w, h] of SIZES) {
      const p = paintFor(geoFor(w, h), DAY, 5, "home", 3, {});
      const [x0, x1] = cornerColumns(p);
      for (let x = x0; x < x1; x++) {
        // the boards' foot closes up on the touchline where the end takes over
        for (let k = 0; k < T; k++) {
          const below = cornerRowAt(p, x, k);
          const above = cornerRowAt(p, x, k + 1);
          if (k >= END_PROFILE.WALL) {
            expect(below - above, `${w}x${h} x ${x} row ${k}`).toBeGreaterThan(
              0.2,
            );
          } else expect(above).toBeLessThanOrEqual(below + 1e-9);
        }
      }
      // and every row is the end's before it would come below the far touchline, where
      // the pitch is painted over it
      const e = endFor(p.g);
      const start = cornerStart(p)!;
      for (let k = 0; k <= T; k++) {
        const u = start(k);
        expect(e.y0 + u - k * (1 + e.grow * u)).toBeLessThanOrEqual(
          p.g.F + 1e-9,
        );
      }
    }
  });

  it("seats its fans side by side, a fan in front hiding no more than the foot of one behind", () => {
    for (const era of ERAS) {
      for (const [w, h] of SIZES) {
        const { life } = stands(w, h, 6, era, NIGHT);
        const f = life.fans;
        const [x0, x1] = cornerColumns(
          paintFor(geoFor(w, h), NIGHT, 6, "home", 3, {}),
        );
        // the fans in and beside the corner: those of the corner, the side's last, the end's first
        const near: number[] = [];
        for (let i = 0; i < f.n; i++) {
          if (f.x[i] > x0 - 12 && f.x[i] < x1 + 12) near.push(i);
        }
        expect(near.length, `${era} ${w}x${h}`).toBeGreaterThan(20);
        for (let a = 0; a < near.length; a++) {
          for (let b = a + 1; b < near.length; b++) {
            const i = near[a];
            const j = near[b];
            const apart =
              Math.abs(f.x[i] - f.x[j]) >= 6 ||
              Math.abs(f.y[i] - f.y[j]) >= FAN_CLEAR;
            if (!apart) {
              throw new Error(
                `${era} ${w}x${h}: fans at ${f.x[i]},${f.y[i]} and ${f.x[j]},${f.y[j]} overlap`,
              );
            }
          }
        }
      }
    }
  });

  it("gives the same pixels for the same inputs", () => {
    const a = stands(960, 540, 7, "today", NIGHT).s;
    const b = stands(960, 540, 7, "today", NIGHT).s;
    expect(Buffer.from(a.data.buffer).equals(Buffer.from(b.data.buffer))).toBe(
      true,
    );
  });
});
