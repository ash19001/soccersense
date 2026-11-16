import { describe, expect, it } from "vitest";
import { Surface, rgb } from "~/pixel";
import { GOLD_SHOW_LAUNCHES, GOLD_SHOW_LEN, drawGoldShow } from "./gold-show";

// The golden ball's fireworks: when there is anything, where it may be, and that it is a
// function of the time alone.

const FLAT = rgb(0x102030);
const SIZES: readonly (readonly [number, number])[] = [
  [960, 540],
  [683, 384],
  [260, 562],
];

function show(
  w: number,
  h: number,
  t: number,
  night = true,
  seed = 5,
): Surface {
  const s = new Surface(w, h);
  s.clear(FLAT);
  drawGoldShow(s, t, {
    top: Math.round(h * 0.15),
    floor: Math.round(h * 0.45),
    seed,
    night,
  });
  return s;
}

function lit(s: Surface): number {
  let n = 0;
  for (let i = 0; i < s.data.length; i++) if (s.data[i] !== FLAT) n++;
  return n;
}

describe("the golden ball's fireworks", () => {
  it("is nothing before the ball turns and nothing once the last spark is out", () => {
    for (const [w, h] of SIZES) {
      for (const t of [-1, Number.NaN, GOLD_SHOW_LEN, GOLD_SHOW_LEN + 10]) {
        expect(lit(show(w, h, t)), `${w} at ${t}`).toBe(0);
      }
    }
  });

  it("sends up every rocket, each opening into a burst, by day and by night", () => {
    for (const [w, h] of SIZES) {
      for (const night of [true, false]) {
        for (const launch of GOLD_SHOW_LAUNCHES) {
          // climbing: a spark on its trail
          expect(lit(show(w, h, launch + 0.2, night)), `${w}`).toBeGreaterThan(
            0,
          );
          // open: a burst of streaks
          expect(lit(show(w, h, launch + 0.9, night)), `${w}`).toBeGreaterThan(
            150,
          );
        }
      }
    }
  });

  it("never comes into the logo's sky, and covers every pixel it touches", () => {
    for (const [w, h] of SIZES) {
      const top = Math.round(h * 0.15);
      for (let t = 0; t < GOLD_SHOW_LEN; t += 0.11) {
        const s = show(w, h, t);
        for (let y = 0; y < top; y++) {
          for (let x = 0; x < w; x++) {
            if (s.get(x, y) !== FLAT)
              throw new Error(`${w}: ${x},${y} at ${t}`);
          }
        }
        expect(s.data.includes(0)).toBe(false);
      }
    }
  });

  it("is a pure function of the time, the seed and the light", () => {
    const [w, h] = SIZES[0];
    for (const t of [0.3, 1.4, 2.9, 5.6]) {
      expect(show(w, h, t).data).toEqual(show(w, h, t).data);
      expect(show(w, h, t, true, 6).data).not.toEqual(show(w, h, t).data);
    }
    // a burst glows by night, in its light tones (a climbing spark is the same by day)
    for (const t of [1.4, 2.9]) {
      expect(show(w, h, t, false).data).not.toEqual(show(w, h, t).data);
    }
  });
});
