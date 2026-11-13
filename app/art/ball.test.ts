import { describe, expect, it } from "vitest";
import { Surface, type Color } from "~/pixel";
import {
  BALL_SLOTS,
  ballShowPose,
  ballSlotAt,
  drawBall,
  drawBallShadow,
  type BallPatches,
  type BallSlot,
  type BallState,
} from "./ball";
import { ballIcons } from "./ball-icons";
import { lightingFor } from "./lighting";
import { MODE_COLORS, P } from "./palette";

const MENU: BallPatches = {
  left: { label: "HOME", icon: "home", accent: MODE_COLORS.home },
  right: { label: "AWAY", icon: "away", accent: MODE_COLORS.away },
  top: { label: "NEXT-GEN", icon: "nextgen", locked: true },
  bottom: { label: "RETRO", icon: "retro", locked: true },
  backRight: { label: "CLOSEST", icon: "pin", locked: true },
  backLeft: { label: "FURTHEST", icon: "globe", locked: true },
  rimLeft: { label: "GUESS WHO", icon: "shirt", locked: true },
  rimRight: { label: "SHOOTOUT", icon: "goal", locked: true },
};

const DAY = lightingFor({ elevation: 45, morning: false });

function ball(over: Partial<BallState> = {}): BallState {
  return {
    cx: 160,
    cy: 160,
    r: 88,
    yaw: 0,
    pitch: 0,
    hovered: null,
    pressed: null,
    chosen: null,
    t: 0,
    ...over,
  };
}

function render(state: BallState, patches = MENU): Surface {
  const s = new Surface(320, 320);
  drawBall(s, state, patches, DAY);
  return s;
}

function count(s: Surface, state: BallState, slot: BallSlot, c: Color): number {
  let n = 0;
  for (let y = 0; y < s.h; y++) {
    for (let x = 0; x < s.w; x++) {
      if (s.get(x, y) === c && ballSlotAt(state, x, y) === slot) n++;
    }
  }
  return n;
}

describe("the ball's pictures", () => {
  it("are all 19, and one colour", () => {
    const icons = ballIcons();
    const keys = Object.keys(icons) as (keyof typeof icons)[];
    expect(keys).toHaveLength(19);
    for (const k of keys) {
      expect(new Set(icons[k].frames[0]).size, k).toBeLessThanOrEqual(2);
    }
  });

  it("are built once", () => {
    expect(ballIcons()).toBe(ballIcons());
  });
});

describe("drawBall", () => {
  it("agrees with ballSlotAt pixel for pixel, in any pose and at any size", () => {
    const marker = MODE_COLORS.home.base;
    const flat = { dark: marker, base: marker, light: marker };
    let seen = 0;
    for (let n = 0; n < 10; n++) {
      const state = ball({
        r: 24 + ((n * 13) % 118) + (n % 2) * 0.5,
        yaw: n * 0.37,
        pitch: n * 0.53,
        roll: n * 0.11,
      });
      for (const slot of BALL_SLOTS) {
        const s = render(
          { ...state, hovered: slot },
          { [slot]: { label: "", icon: "none", accent: flat } },
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

  it("writes HOME and AWAY on every menu size, whole, at both ends of the rock", () => {
    // the menu's radii on a monitor
    for (const r of [74, 76, 80, 82, 86, 88, 90, 100, 112, 118]) {
      for (const slot of ["left", "right"] as const) {
        const rest = ball({ r });
        const words = count(render(rest), rest, slot, P.chalk);
        expect(words, `r ${r} ${slot}`).toBeGreaterThan(80);
        for (const yaw of [0.12, -0.12, 0.06]) {
          const state = ball({ r, yaw });
          expect(count(render(state), state, slot, P.chalk), `r ${r}`).toBe(
            words,
          );
        }
      }
    }
  });

  it("writes no words below a radius of 52, and big ones from 112", () => {
    const small = ball({ r: 48 });
    expect(count(render(small), small, "left", P.chalk)).toBe(0);
    const big = ball({ r: 118 });
    const mid = ball({ r: 100 });
    // the big words and icon carry more chalk than the small ones
    expect(count(render(big), big, "left", P.chalk)).toBeGreaterThan(
      count(render(mid), mid, "left", P.chalk) * 1.4,
    );
  });

  it("writes every locked patch's word where its pose shows it", () => {
    for (const slot of [
      "top",
      "bottom",
      "backLeft",
      "rimLeft",
      "rimRight",
    ] as const) {
      const state = ball({ r: 90, ...ballShowPose(slot) });
      const s = render(state);
      // the word and the picture are mist on a quiet patch
      let mist = 0;
      for (let i = 0; i < s.data.length; i++) if (s.data[i] === P.mist) mist++;
      expect(mist, slot).toBeGreaterThan(60);
    }
  });

  it("frames every open patch in its mode's colour, on the menu's sizes, and never a locked one", () => {
    const era: BallPatches = {
      ...MENU,
      top: { label: "NEXT-GEN", icon: "nextgen", accent: MODE_COLORS.nextgen },
      bottom: { label: "RETRO", icon: "retro", accent: MODE_COLORS.retro },
    };
    for (const r of [84, 88, 90]) {
      const state = ball({ r });
      const s = render(state, era);
      for (const [slot, mode] of [
        ["left", "home"],
        ["right", "away"],
        ["top", "nextgen"],
        ["bottom", "retro"],
      ] as const) {
        const ramp = MODE_COLORS[mode];
        const framed =
          count(s, state, slot, ramp.dark) +
          count(s, state, slot, ramp.base) +
          count(s, state, slot, ramp.light);
        expect(framed, `r ${r} ${slot}`).toBeGreaterThan(60);
      }
    }
    // turned to show CLOSEST and FURTHEST, the locked ones take no colour at all
    const turned = ball({ r: 90, ...ballShowPose("backLeft") });
    const s = render(turned, era);
    for (const slot of ["backLeft", "backRight"] as const) {
      for (const ramp of Object.values(MODE_COLORS)) {
        expect(count(s, turned, slot, ramp.base)).toBe(0);
        expect(count(s, turned, slot, ramp.light)).toBe(0);
      }
    }
  });

  it("writes NEXT-GEN and RETRO in their colours when their pose shows them, with no padlock", () => {
    const era: BallPatches = {
      ...MENU,
      top: { label: "NEXT-GEN", icon: "nextgen", accent: MODE_COLORS.nextgen },
      bottom: { label: "RETRO", icon: "retro", accent: MODE_COLORS.retro },
    };
    for (const [slot, mode] of [
      ["top", "nextgen"],
      ["bottom", "retro"],
    ] as const) {
      const state = ball({ r: 90, ...ballShowPose(slot) });
      const open = render(state, era);
      const shut = render(state, MENU);
      // the word and the picture in the mode's light colour, where the locked patch is mist
      let lit = 0;
      for (let i = 0; i < open.data.length; i++) {
        if (open.data[i] === MODE_COLORS[mode].light) lit++;
      }
      expect(lit, slot).toBeGreaterThan(60);
      expect(open.data).not.toEqual(shut.data);
    }
  });

  it("is a pure function of its inputs, at any size", () => {
    const state = ball({ yaw: 0.07, hovered: "left", t: 3.21 });
    const a = render(state).data.slice();
    const small = new Surface(160, 160);
    drawBall(small, { ...state, cx: 80, cy: 80, r: 44 }, MENU, DAY);
    expect(render(state).data).toEqual(a);
    const again = new Surface(160, 160);
    drawBall(again, { ...state, cx: 80, cy: 80, r: 44 }, MENU, DAY);
    expect(again.data).toEqual(small.data);
  });

  it("casts its shadow on the grass", () => {
    const s = new Surface(320, 320);
    drawBallShadow(s, ball(), 250, DAY);
    let n = 0;
    for (let i = 0; i < s.data.length; i++) if (s.data[i] !== 0) n++;
    expect(n).toBeGreaterThan(1000);
  });
});
