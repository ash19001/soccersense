import { describe, expect, it } from "vitest";
import { Surface, TRANSPARENT, type Color } from "~/pixel";
import {
  ballSlotAt,
  ballSlotCenter,
  drawBall,
  drawBallShadow,
  type BallPatches,
  type BallSlot,
  type BallState,
} from "./ball";
import { lightingFor } from "./lighting";
import { MODE_COLORS, P } from "./palette";

const SLOTS: readonly BallSlot[] = ["left", "right", "top", "bottom"];

const MENU: BallPatches = {
  left: { label: "HOME", icon: "home", accent: MODE_COLORS.home },
  right: { label: "AWAY", icon: "away", accent: MODE_COLORS.away },
  top: { label: "SOON", icon: "lock", locked: true },
  bottom: { label: "SOON", icon: "lock", locked: true },
};

// Above 20 degrees the lighting grade is the identity: pixels are raw palette colours.
const DAY = lightingFor({ elevation: 45, morning: false });
const NIGHT = lightingFor({ elevation: -30, morning: false });

function ball(over: Partial<BallState> = {}): BallState {
  return {
    cx: 80,
    cy: 80,
    r: 44,
    yaw: 0,
    pitch: 0,
    hovered: null,
    pressed: null,
    chosen: null,
    t: 0,
    ...over,
  };
}

function render(state: BallState, patches = MENU, light = DAY): Surface {
  const s = new Surface(160, 160);
  drawBall(s, state, patches, light);
  return s;
}

/** How many pixels of `slot`'s pentagon are painted `c`. */
function count(s: Surface, state: BallState, slot: BallSlot, c: Color): number {
  let n = 0;
  for (let y = 0; y < s.h; y++) {
    for (let x = 0; x < s.w; x++) {
      if (s.get(x, y) === c && ballSlotAt(state, x, y) === slot) n++;
    }
  }
  return n;
}

describe("the menu pose", () => {
  it("puts HOME and AWAY level, 31.7 degrees either side of the middle", () => {
    const state = ball();
    const left = ballSlotCenter(state, "left");
    const right = ballSlotCenter(state, "right");
    expect(left.y).toBe(state.cy);
    expect(right.y).toBe(state.cy);
    expect(state.cx - left.x).toBe(right.x - state.cx);
    expect(left.x).toBeLessThan(state.cx - 15);
    expect(left.facing).toBeCloseTo(Math.cos((31.717 * Math.PI) / 180), 3);
    expect(right.facing).toBeCloseTo(left.facing, 9);
  });

  it("puts the locked slots 58.3 degrees above and below it", () => {
    const state = ball();
    const top = ballSlotCenter(state, "top");
    const bottom = ballSlotCenter(state, "bottom");
    expect(top.x).toBe(state.cx);
    expect(bottom.x).toBe(state.cx);
    expect(state.cy - top.y).toBe(bottom.y - state.cy);
    expect(top.y).toBeLessThan(state.cy - 30);
    expect(top.facing).toBeCloseTo(Math.cos((58.283 * Math.PI) / 180), 3);
    expect(bottom.facing).toBeCloseTo(top.facing, 9);
  });

  it("faces the side slots at the viewer more than the top and bottom ones", () => {
    for (const yaw of [0, 0.12, -0.12]) {
      const state = ball({ yaw });
      const side = Math.min(
        ballSlotCenter(state, "left").facing,
        ballSlotCenter(state, "right").facing,
      );
      const squashed = Math.max(
        ballSlotCenter(state, "top").facing,
        ballSlotCenter(state, "bottom").facing,
      );
      expect(side).toBeGreaterThan(0.75);
      expect(squashed).toBeLessThan(0.6);
      expect(squashed).toBeGreaterThan(0.35);
    }
  });

  it("turns the front to the right with positive yaw, and away on the back", () => {
    expect(ballSlotCenter(ball({ yaw: 0.12 }), "left").x).toBeGreaterThan(
      ballSlotCenter(ball(), "left").x,
    );
    expect(ballSlotCenter(ball({ yaw: -0.12 }), "right").x).toBeLessThan(
      ballSlotCenter(ball(), "right").x,
    );
    expect(ballSlotCenter(ball({ pitch: 0.3 }), "top").y).toBeLessThan(
      ballSlotCenter(ball(), "top").y,
    );
    const behind = ball({ yaw: Math.PI });
    for (const slot of ["left", "right"] as const) {
      const c = ballSlotCenter(behind, slot);
      expect(c.facing).toBeLessThan(0);
      expect(ballSlotAt(behind, c.x, c.y)).not.toBe(slot);
    }
  });
});

describe("ballSlotAt", () => {
  it("finds each slot at its own centre", () => {
    const state = ball();
    for (const slot of SLOTS) {
      const c = ballSlotCenter(state, slot);
      expect(ballSlotAt(state, c.x, c.y)).toBe(slot);
    }
  });

  it("stays right at both ends of the idle rock", () => {
    for (const yaw of [0.12, -0.12]) {
      for (const r of [37, 44, 51]) {
        const state = ball({ yaw, r });
        for (const slot of SLOTS) {
          const c = ballSlotCenter(state, slot);
          expect(ballSlotAt(state, c.x, c.y)).toBe(slot);
        }
      }
    }
  });

  it("is null outside the disc and on the white leather", () => {
    const state = ball();
    const { cx, cy, r } = state;
    expect(ballSlotAt(state, cx + r + 1, cy)).toBeNull();
    expect(ballSlotAt(state, cx - r - 1, cy)).toBeNull();
    expect(ballSlotAt(state, cx, cy - r - 1)).toBeNull();
    expect(ballSlotAt(state, cx + r, cy + r)).toBeNull();
    expect(ballSlotAt(state, cx - 34, cy - 34)).toBeNull();
    expect(ballSlotAt(state, -1000, 5000)).toBeNull();
    expect(ballSlotAt(state, NaN, cy)).toBeNull();
    // The very middle is the seam between two white panels.
    expect(ballSlotAt(state, cx, cy)).toBeNull();
    expect(ballSlotAt(state, cx, cy - 14)).toBeNull();
    expect(ballSlotAt(ball({ r: NaN }), cx, cy)).toBeNull();
    expect(ballSlotAt(ball({ r: 0 }), cx, cy)).toBeNull();
  });

  it("agrees with the renderer pixel for pixel, in any pose and at any size", () => {
    // A hovered slot fills with its accent: paint one flat marker and every marker pixel
    // must hit-test to that slot.
    const marker = MODE_COLORS.home.base;
    const flat = { dark: marker, base: marker, light: marker };
    let seen = 0;
    for (let n = 0; n < 24; n++) {
      const state = ball({
        r: 12 + ((n * 7) % 59) + (n % 2) * 0.5,
        yaw: n * 0.37,
        pitch: n * 0.53,
        roll: n * 0.11,
      });
      for (const slot of SLOTS) {
        const s = render(
          { ...state, hovered: slot },
          {
            [slot]: { label: "", icon: "none", accent: flat },
          },
        );
        for (let y = 0; y < s.h; y++) {
          for (let x = 0; x < s.w; x++) {
            if (s.get(x, y) !== marker) continue;
            seen++;
            expect(ballSlotAt(state, x, y)).toBe(slot);
          }
        }
      }
    }
    expect(seen).toBeGreaterThan(5000);
  });
});

describe("drawBall", () => {
  it("is a pure function of its inputs", () => {
    const state = ball({ yaw: 0.07, hovered: "left", t: 3.21 });
    expect(render(state).data).toEqual(render({ ...state }).data);
    // Drawing another ball in between must not leak into the next one.
    const before = render(state).data.slice();
    render(ball({ r: 20, pitch: 2, chosen: "right" }), MENU, NIGHT);
    expect(render(state).data).toEqual(before);
  });

  it("paints exactly the engine's disc, with an ink outline", () => {
    for (const r of [8, 12, 16.5, 37, 44, 70]) {
      const state = ball({ r });
      const s = render(state);
      const disc = new Surface(160, 160);
      disc.disc(state.cx, state.cy, r, P.white);
      const ring = new Surface(160, 160);
      ring.circle(state.cx, state.cy, r, P.white);
      for (let i = 0; i < s.data.length; i++) {
        expect(s.data[i] !== TRANSPARENT).toBe(disc.data[i] !== TRANSPARENT);
        if (ring.data[i] !== TRANSPARENT) expect(s.data[i]).toBe(P.ink);
      }
    }
  });

  it("uses only palette colours", () => {
    const palette = new Set<number>(Object.values(P));
    const states: Partial<BallState>[] = [
      {},
      { hovered: "left", yaw: 0.12 },
      { pressed: "right", hovered: "right" },
      { chosen: "left", t: 0.13 },
      { hovered: "top", r: 59, t: 2.2 },
      { r: 16, pitch: 1 },
    ];
    for (const over of states) {
      for (const c of new Set(render(ball(over)).data)) {
        if (c !== TRANSPARENT) expect(palette.has(c)).toBe(true);
      }
    }
  });

  it("respects the clip rect and survives being off the surface", () => {
    const s = new Surface(160, 160);
    s.clip(60, 70, 30, 20);
    drawBall(s, ball({ hovered: "left" }), MENU, DAY);
    s.unclip();
    let painted = 0;
    for (let y = 0; y < s.h; y++) {
      for (let x = 0; x < s.w; x++) {
        if (s.get(x, y) === TRANSPARENT) continue;
        painted++;
        expect(x >= 60 && x < 90 && y >= 70 && y < 90).toBe(true);
      }
    }
    expect(painted).toBe(30 * 20);
    const small = new Surface(40, 40);
    for (const cx of [-300, -10, 20, 45, 400]) {
      drawBall(small, ball({ cx, cy: 15, pitch: 2, roll: 3 }), MENU, NIGHT);
    }
  });

  it("does not throw on odd input, and draws nothing without a radius", () => {
    const s = new Surface(160, 160);
    for (const r of [NaN, 0, 0.4, -5, Infinity]) {
      drawBall(s, ball({ r }), MENU, DAY);
      drawBallShadow(s, ball({ r }), 120, DAY);
      expect(ballSlotCenter(ball({ r }), "top").facing).toBe(0);
    }
    drawBall(s, ball({ cx: NaN }), MENU, DAY);
    expect(s.data.every((c) => c === TRANSPARENT)).toBe(true);
    drawBall(s, ball({ r: 1 }), MENU, DAY);
    drawBall(s, ball({ r: 3, roll: 9 }), {}, NIGHT);
    drawBall(
      s,
      ball({ yaw: NaN, pitch: Infinity, roll: NaN, t: NaN, chosen: "left" }),
      {
        left: { label: "A VERY LONG LABEL INDEED", icon: "none" },
        right: { label: "", icon: "lock", badge: "12345678901234567890123" },
        top: { label: "X", icon: "none", accent: MODE_COLORS.home },
        bottom: { label: "", icon: "home", badge: "9" },
      },
      DAY,
    );
  });

  it("writes HOME and AWAY on every menu size, whole, at both ends of the rock", () => {
    // Words are masked to their own pentagon, so a label that did not fit would lose
    // pixels as the ball turns. 37 is the smallest menu ball (120 x 222).
    for (const r of [37, 38, 40, 41, 43, 44, 45, 50, 56, 59]) {
      for (const slot of ["left", "right"] as const) {
        const rest = ball({ r });
        const words = count(render(rest), rest, slot, P.chalk);
        expect(words).toBeGreaterThan(30);
        for (const yaw of [0.12, -0.12, 0.06]) {
          const state = ball({ r, yaw });
          expect(count(render(state), state, slot, P.chalk)).toBe(words);
        }
      }
    }
  });

  it("drops the words, then the icons, as the ball gets small", () => {
    const tiny = ball({ r: 24 });
    const s = render(tiny);
    expect(count(s, tiny, "left", P.chalk)).toBe(0);
    expect(count(s, tiny, "left", MODE_COLORS.home.light)).toBeGreaterThan(0);
    const mid = ball({ r: 32 });
    expect(count(render(mid), mid, "left", P.chalk)).toBe(0);
  });

  it("shows HOME warm and AWAY teal before anything is hovered", () => {
    for (const r of [16, 37, 44]) {
      const state = ball({ r });
      const s = render(state);
      const { home, away } = MODE_COLORS;
      const warm =
        count(s, state, "left", home.base) +
        count(s, state, "left", home.light);
      const teal =
        count(s, state, "right", away.base) +
        count(s, state, "right", away.light);
      expect(warm).toBeGreaterThan(12);
      expect(teal).toBeGreaterThan(12);
      expect(count(s, state, "right", home.base)).toBe(0);
    }
  });

  it("gives every state its own look", () => {
    const { home } = MODE_COLORS;
    const idle = ball();
    const hover = ball({ hovered: "left" });
    const press = ball({ hovered: "left", pressed: "left" });
    const area = count(render(hover), hover, "left", home.base);
    expect(area).toBeGreaterThan(200);
    expect(count(render(idle), idle, "left", home.base)).toBeLessThan(area / 4);
    expect(count(render(press), press, "left", home.dark)).toBeGreaterThan(300);
  });

  it("pushes a pressed slot's content one pixel down", () => {
    // With no icon the only chalk on an idle or a pressed patch is its label.
    const words: BallPatches = {
      left: { label: "HOME", icon: "none", accent: MODE_COLORS.home },
    };
    const rows = (state: BallState): number[] => {
      const s = render(state, words);
      const out: number[] = [];
      for (let y = 0; y < s.h; y++) {
        for (let x = 0; x < s.w; x++) {
          if (s.get(x, y) === P.chalk && ballSlotAt(state, x, y) === "left") {
            out.push(y);
          }
        }
      }
      return out;
    };
    const up = rows(ball());
    const down = rows(ball({ hovered: "left", pressed: "left" }));
    expect(up.length).toBeGreaterThan(30);
    expect(down).toEqual(up.map((y) => y + 1));
  });

  it("never colours a locked slot: hover only lifts it", () => {
    const patches: BallPatches = {
      ...MENU,
      top: {
        label: "SOON",
        icon: "lock",
        locked: true,
        accent: MODE_COLORS.home,
      },
    };
    const state = ball({ hovered: "top" });
    const s = render(state, patches);
    for (const c of Object.values(MODE_COLORS.home)) {
      expect(count(s, state, "top", c)).toBe(0);
    }
    expect(count(s, state, "top", P.steel)).toBeGreaterThan(
      count(render(ball(), patches), ball(), "top", P.steel),
    );
  });

  it("flashes a chosen slot on a stepped 8 Hz cycle", () => {
    const at = (t: number): Surface => render(ball({ chosen: "right", t }));
    expect(at(0.01).data).toEqual(at(0.12).data);
    expect(at(0.01).data).not.toEqual(at(0.13).data);
    expect(at(0.01).data).toEqual(at(0.26).data);
    const on = ball({ chosen: "right", t: 0.01 });
    const off = ball({ chosen: "right", t: 0.13 });
    expect(count(render(on), on, "right", P.white)).toBeGreaterThan(300);
    expect(
      count(render(off), off, "right", MODE_COLORS.away.light),
    ).toBeGreaterThan(300);
  });

  it("shows a badge instead of the label", () => {
    const scored: BallPatches = {
      ...MENU,
      left: { ...MENU.left!, badge: "512" },
    };
    const state = ball();
    const plain = render(state);
    const badge = render(state, scored);
    expect(badge.data).not.toEqual(plain.data);
    // The plate is chalk with dark digits: more chalk than the word HOME, and some red.
    expect(count(badge, state, "left", P.chalk)).toBeGreaterThan(
      count(plain, state, "left", P.chalk),
    );
    expect(count(badge, state, "left", MODE_COLORS.home.dark)).toBeGreaterThan(
      count(plain, state, "left", MODE_COLORS.home.dark),
    );
    // The other button is untouched.
    expect(count(badge, state, "right", P.chalk)).toBe(
      count(plain, state, "right", P.chalk),
    );
  });

  it("holds still at t = 0 and shines across HOME and then AWAY", () => {
    const still = render(ball()).data;
    expect(render(ball({ t: 5 })).data).toEqual(still);
    expect(render(ball({ t: 1.5 })).data).toEqual(still);
    const lit = (t: number, slot: BallSlot): boolean => {
      const state = ball({ t });
      return count(render(state), state, slot, P.white) > 0;
    };
    expect(lit(2.2, "left")).toBe(true);
    expect(lit(2.2, "right")).toBe(false);
    expect(lit(2.7, "right")).toBe(true);
    expect(lit(2.7, "left")).toBe(false);
  });

  it("lights the far rim under floodlights", () => {
    const state = ball();
    const white = (s: Surface): number => {
      let n = 0;
      for (let y = state.cy; y < s.h; y++) {
        for (let x = state.cx; x < s.w; x++) {
          if (s.get(x, y) === NIGHT.lit(P.white)) n++;
        }
      }
      return n;
    };
    expect(white(render(state, MENU, NIGHT))).toBeGreaterThan(60);
    expect(render(state, MENU, NIGHT).data).not.toEqual(render(state).data);
  });
});

describe("drawBallShadow", () => {
  it("lies on the ground under the ball, in the grass's own shades", () => {
    for (const light of [DAY, NIGHT]) {
      const s = new Surface(160, 160);
      const state = ball({ cy: 70 });
      drawBallShadow(s, state, 113, light);
      const shades = new Set<number>([
        TRANSPARENT,
        light.lit(P.grassDark),
        light.lit(P.grassDeep),
      ]);
      let painted = 0;
      for (let y = 0; y < s.h; y++) {
        for (let x = 0; x < s.w; x++) {
          const c = s.get(x, y);
          expect(shades.has(c)).toBe(true);
          if (c === TRANSPARENT) continue;
          painted++;
          expect(Math.abs(y - 113)).toBeLessThan(14);
        }
      }
      expect(painted).toBeGreaterThan(400);
    }
  });

  it("shrinks as the ball leaves the ground", () => {
    const area = (cy: number): number => {
      const s = new Surface(160, 200);
      drawBallShadow(s, ball({ cy, r: 30 }), 190, DAY);
      return s.data.reduce((n, c) => n + (c === TRANSPARENT ? 0 : 1), 0);
    };
    expect(area(159)).toBeGreaterThan(area(100));
    expect(area(100)).toBeGreaterThan(area(40));
    expect(area(40)).toBeGreaterThan(0);
  });
});
