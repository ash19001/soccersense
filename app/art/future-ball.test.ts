import { describe, expect, it } from "vitest";
import { Surface, TRANSPARENT, mix, rgb } from "~/pixel";
import { drawBall, type BallState } from "./ball";
import { drawFutureBall, pixelate, type FutureBallState } from "./future-ball";
import { lightingFor } from "./lighting";
import { P } from "./palette";

const DAY = lightingFor({ elevation: 45, morning: false });
const NIGHT = lightingFor({ elevation: -30, morning: false });
/** The pose the menu's future ball comes to rest in. */
const REST = { yaw: 0.42, pitch: -0.38, roll: -0.18 };

function ball(over: Partial<FutureBallState> = {}): FutureBallState {
  return { cx: 100, cy: 100, r: 89, ...REST, ...over };
}

function render(state: FutureBallState, light = DAY, power = 2): Surface {
  const s = new Surface(200, 200);
  drawFutureBall(s, state, light, power);
  return s;
}

const count = (s: Surface, c: number): number =>
  s.data.filter((x) => x === c).length;

describe("the ball of the future", () => {
  it("covers exactly the menu ball's disc, with its ink outline, at any size", () => {
    for (const r of [12, 30.5, 44, 89, 98]) {
      const state = ball({ r });
      const future = render(state);
      const menu = new Surface(200, 200);
      const b: BallState = {
        ...state,
        hovered: null,
        pressed: null,
        chosen: null,
        t: 0,
      };
      drawBall(menu, b, {}, DAY);
      for (let i = 0; i < future.data.length; i++) {
        expect(future.data[i] === TRANSPARENT, `r ${r} at ${i}`).toBe(
          menu.data[i] === TRANSPARENT,
        );
      }
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
          expect(future.get(x, y)).toBe(ink);
        }
      }
      expect(ring).toBeGreaterThan(20);
    }
  });

  it("is gunmetal and black chrome panels in turn, lit from the top left", () => {
    const s = render(ball());
    expect(s.get(60, 60)).not.toBe(s.get(140, 140));
    // gunmetal's base band, and black chrome's bands: both show, plenty of each
    const gunmetal = count(s, DAY.lit(P.steel));
    const chromeTones = new Set(
      [
        mix(P.slate, P.steel, 0.25),
        mix(P.slate, P.nextgenDark, 0.2),
        mix(P.night, P.nextgenDark, 0.14),
        mix(P.night, P.ink, 0.45),
        mix(P.ink, P.nextgenDark, 0.06),
      ].map((c): number => DAY.lit(c)),
    );
    const chrome = s.data.filter((c) => chromeTones.has(c)).length;
    expect(gunmetal).toBeGreaterThan(1500);
    expect(chrome).toBeGreaterThan(300);
    // and nothing of the menu ball's white leather
    expect(count(s, DAY.lit(P.chalk))).toBe(0);
  });

  it("lights its seams in NEXT-GEN's magenta, raw, and brighter as it powers on", () => {
    const core = (power: number) =>
      [P.ink, P.nextgenDark, P.nextgenLight, P.white][power];
    // lit: a pale pink core with magenta round it, the same by day and by night
    const lit = render(ball(), DAY, 2);
    expect(count(lit, P.nextgenLight)).toBeGreaterThan(200);
    expect(count(lit, P.nextgen)).toBeGreaterThan(200);
    expect(count(render(ball(), NIGHT, 2), P.nextgenLight)).toBe(
      count(lit, P.nextgenLight),
    );
    // the flash: white cores; dim and dark: no magenta round them
    expect(count(render(ball(), DAY, 3), core(3))).toBeGreaterThan(200);
    expect(count(render(ball(), DAY, 1), P.nextgen)).toBeLessThan(
      count(lit, P.nextgen) / 4,
    );
    expect(count(render(ball(), DAY, 0), P.nextgenLight)).toBe(0);
  });

  it("has a stud on each crossing it shows, from r = 24", () => {
    // the studs' hearts, white when lit: on the crossing in front, (0, 0, 1) of the ball
    const front = render(ball({ yaw: 0, pitch: 0, roll: 0 }));
    expect(front.get(100, 100)).toBe(P.white);
    const small = render(ball({ r: 20, yaw: 0, pitch: 0, roll: 0 }));
    expect(small.get(100, 100)).not.toBe(P.white);
  });

  it("is a pure function of its inputs", () => {
    const a = render(ball({ yaw: 1.3, roll: -0.4 }), NIGHT, 3);
    render(ball({ r: 40 }));
    const b = render(ball({ yaw: 1.3, roll: -0.4 }), NIGHT, 3);
    expect(a.data).toEqual(b.data);
  });
});

describe("pixelate", () => {
  /** A picture of fine stripes, so squares show. */
  function stripes(): Surface {
    const s = new Surface(120, 120);
    for (let y = 0; y < 120; y++) {
      for (let x = 0; x < 120; x++) {
        s.px(x, y, (x + y) % 2 === 0 ? P.chalk : P.ink);
      }
    }
    return s;
  }

  it("redraws the disc in squares of one colour, leaving what is outside it", () => {
    const s = stripes();
    const before = s.data.slice();
    pixelate(s, 60, 60, 30, 6, 0, 0);
    // the square holding the middle (on the grid centred on it) is all one colour
    const c = s.get(60, 60);
    for (let y = 58; y < 64; y++) {
      for (let x = 58; x < 64; x++) {
        const k = s.get(x, y);
        // a spark is still a whole square of one colour
        expect(k).toBe(c);
      }
    }
    // far outside: untouched
    expect(s.get(2, 2)).toBe(before[2 * 120 + 2]);
    expect(s.get(117, 60)).toBe(before[60 * 120 + 117]);
  });

  it("does nothing with squares under 2 pixels", () => {
    const s = stripes();
    const before = s.data.slice();
    pixelate(s, 60, 60, 30, 1, 0, 0);
    expect(s.data).toEqual(before);
  });

  it("lights a few squares in the mode's colours, somewhere else each frame", () => {
    const marker = rgb(0x203040);
    const lit = (frame: number): number[] => {
      const s = new Surface(240, 240);
      s.clear(marker);
      pixelate(s, 120, 120, 100, 10, frame, 3);
      return Array.from(s.data).map((c, i) => (c !== marker ? i : -1));
    };
    const a = lit(4).filter((i) => i >= 0);
    const b = lit(5).filter((i) => i >= 0);
    expect(a.length).toBeGreaterThan(0);
    expect(a).toEqual(lit(4).filter((i) => i >= 0));
    expect(a).not.toEqual(b);
  });
});
