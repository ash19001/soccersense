import { describe, expect, it } from "vitest";
import { Surface, TRANSPARENT, mix, rgb } from "~/pixel";
import { drawBall, type BallState } from "./ball";
import { drawLeatherBall, type LeatherBallState } from "./leather-ball";
import { lightingFor } from "./lighting";
import { P } from "./palette";

const DAY = lightingFor({ elevation: 45, morning: false });
const NIGHT = lightingFor({ elevation: -30, morning: false });
/** The pose the menu's old ball comes to rest in: its lace towards us. */
const REST = { yaw: -0.32, pitch: 0.28, roll: 0.22 };

function ball(over: Partial<LeatherBallState> = {}): LeatherBallState {
  return { cx: 100, cy: 100, r: 89, ...REST, ...over };
}

function render(state: LeatherBallState, light = DAY): Surface {
  const s = new Surface(200, 200);
  drawLeatherBall(s, state, light);
  return s;
}

describe("the old leather ball", () => {
  it("covers exactly the menu ball's disc, with its ink outline, at any size", () => {
    for (const r of [12, 30.5, 44, 89, 120]) {
      const state = ball({ r: Math.min(r, 98) });
      const old = render(state);
      const menu = new Surface(200, 200);
      const b: BallState = {
        ...state,
        hovered: null,
        pressed: null,
        chosen: null,
        t: 0,
      };
      drawBall(menu, b, {}, DAY);
      for (let i = 0; i < old.data.length; i++) {
        expect(old.data[i] === TRANSPARENT, `r ${r} at ${i}`).toBe(
          menu.data[i] === TRANSPARENT,
        );
      }
      // the outline (the pixels that touch the outside) is the same ink ring
      const ink = DAY.lit(P.ink);
      let ring = 0;
      for (let y = 1; y < 199; y++) {
        for (let x = 1; x < 199; x++) {
          if (menu.get(x, y) === TRANSPARENT) continue;
          const edge =
            menu.get(x - 1, y) === TRANSPARENT ||
            menu.get(x + 1, y) === TRANSPARENT ||
            menu.get(x, y - 1) === TRANSPARENT ||
            menu.get(x, y + 1) === TRANSPARENT;
          if (!edge) continue;
          ring++;
          expect(menu.get(x, y)).toBe(ink);
          expect(old.get(x, y)).toBe(ink);
        }
      }
      expect(ring).toBeGreaterThan(20);
    }
  });

  it("is brown leather, lit from the top left", () => {
    const s = render(ball());
    const lit = s.get(60, 60);
    const shade = s.get(140, 140);
    expect(lit).not.toBe(shade);
    const brown = [
      mix(P.retro, P.wood, 0.35),
      mix(P.retro, P.wood, 0.68),
      P.wood,
      mix(P.wood, P.woodDark, 0.6),
      mix(P.woodDark, P.ink, 0.3),
    ].map((c): number => DAY.lit(c));
    let leather = 0;
    for (const c of s.data) if (brown.includes(c)) leather++;
    // most of a disc of radius 89 (about 25,000 pixels) is plain leather
    expect(leather).toBeGreaterThan(15000);
  });

  it("shows its lace when it faces us, and not when it is turned away", () => {
    const thong = DAY.lit(mix(P.retroLight, P.chalk, 0.3));
    const count = (s: Surface) => s.data.filter((c) => c === thong).length;
    expect(count(render(ball()))).toBeGreaterThan(60);
    expect(count(render(ball({ yaw: REST.yaw + Math.PI })))).toBe(0);
    // too small for the thong: none
    expect(count(render(ball({ r: 30 })))).toBe(0);
  });

  it("lights its far rim under floodlights only", () => {
    const rim = (light: typeof DAY) =>
      light.lit(mix(P.retro, P.retroLight, 0.4));
    const at = (light: typeof DAY) =>
      render(ball(), light).data.filter((c) => c === rim(light)).length;
    expect(at(NIGHT)).toBeGreaterThan(40);
    expect(at(DAY)).toBe(0);
  });

  it("draws only its cover's share of its pixels, in an ordered pattern, leaving the rest", () => {
    const marker = rgb(0xff00ff);
    const changed = (cover: number): boolean[] => {
      const s = new Surface(200, 200);
      s.clear(marker);
      drawLeatherBall(s, ball(), DAY, cover);
      return Array.from(s.data, (c) => c !== marker);
    };
    const all = changed(1).filter(Boolean).length;
    expect(changed(0).filter(Boolean).length).toBe(0);
    const half = changed(0.5);
    const n = half.filter(Boolean).length;
    expect(n).toBeGreaterThan(all * 0.45);
    expect(n).toBeLessThan(all * 0.55);
    // more of it as the cover grows, never a pixel lost
    const quarter = changed(0.25);
    for (let i = 0; i < quarter.length; i++) {
      if (quarter[i]) expect(half[i]).toBe(true);
    }
  });

  it("is a pure function of its inputs", () => {
    const a = render(ball({ yaw: 1.3, roll: -0.4 }), NIGHT);
    render(ball({ r: 40 }));
    const b = render(ball({ yaw: 1.3, roll: -0.4 }), NIGHT);
    expect(a.data).toEqual(b.data);
  });
});
