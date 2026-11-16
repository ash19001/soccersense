import { describe, expect, it } from "vitest";
import { FONT_3x5, Surface, measureText, type Color } from "~/pixel";
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
import { paintedFont } from "./lettering";
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
/** The ball's ink by day: its outline, and the plate every word stands on. */
const INK = DAY.lit(P.ink);

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

  it("keeps a played HOME's and AWAY's word, with the score where the picture was", () => {
    const played: BallPatches = {
      ...MENU,
      left: { ...MENU.left!, badge: "512" },
      right: { ...MENU.right!, badge: "411" },
    };
    for (const r of [74, 90, 112, 118]) {
      const state = ball({ r });
      const open = render(state);
      const scored = render(state, played);
      for (const slot of ["left", "right"] as const) {
        // the whole word, as before the mode was played (it is chalk; the score is not)
        const words = count(open, state, slot, P.chalk);
        expect(words, `r ${r} ${slot}`).toBeGreaterThan(80);
        expect(count(scored, state, slot, P.chalk), `r ${r} ${slot}`).toBe(
          words,
        );
      }
      // and the score in place of the picture
      expect(scored.data).not.toEqual(open.data);
    }
    // Too small a ball for words: the picture and the score, as before.
    const small = ball({ r: 60 });
    expect(count(render(small, played), small, "left", P.chalk)).toBe(0);
    expect(render(small, played).data).not.toEqual(render(small).data);
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

  it("puts what a patch carries in the middle of what the patch shows", () => {
    // The four open patches, all played: a score on each (narrow, so the side ones can go
    // all the way to centred). What a score adds is found by drawing without it.
    const open: BallPatches = {
      ...MENU,
      left: { label: "HOME", icon: "home", accent: MODE_COLORS.home },
      right: { label: "AWAY", icon: "away", accent: MODE_COLORS.away },
      top: { label: "", icon: "nextgen", accent: MODE_COLORS.nextgen },
      bottom: { label: "", icon: "retro", accent: MODE_COLORS.retro },
    };
    const scored: BallPatches = {
      ...open,
      left: { ...open.left!, badge: "350" },
      right: { ...open.right!, badge: "411" },
      top: { ...open.top!, badge: "70" },
      bottom: { ...open.bottom!, badge: "380" },
    };
    for (const r of [60, 74, 90]) {
      const state = ball({ r });
      const bare: BallPatches = {
        ...open,
        left: { ...open.left!, icon: "none", label: "" },
        right: { ...open.right!, icon: "none", label: "" },
        top: { ...open.top!, icon: "none" },
        bottom: { ...open.bottom!, icon: "none" },
      };
      const a = render(state, scored);
      const b = render(state, bare);
      for (const slot of ["left", "right", "top", "bottom"] as const) {
        // HOME's and AWAY's words stand on a dark plate, from the radius at which they
        // carry words: where it lies (the word's box, four pixels wider each side and two
        // taller), found from the word's chalk.
        const plate = { x0: 320, y0: 320, x1: -1, y1: -1 };
        if (r >= 74 && (slot === "left" || slot === "right")) {
          for (let y = 0; y < 320; y++) {
            for (let x = 0; x < 320; x++) {
              if (a.get(x, y) !== P.chalk) continue;
              if (ballSlotAt(state, x, y) !== slot) continue;
              plate.x0 = Math.min(plate.x0, x - 4);
              plate.y0 = Math.min(plate.y0, y - 2);
              plate.x1 = Math.max(plate.x1, x + 4);
              plate.y1 = Math.max(plate.y1, y + 2);
            }
          }
        }
        let px = 0;
        let py = 0;
        let pn = 0;
        let cx = 0;
        let cy = 0;
        let cn = 0;
        for (let y = 0; y < 320; y++) {
          for (let x = 0; x < 320; x++) {
            if (ballSlotAt(state, x, y) !== slot) continue;
            px += x;
            py += y;
            pn++;
            // (its picture, its score and its word. Not the plate the word stands on, which
            // lies under the word alone and would weigh the pair down)
            if (a.get(x, y) === b.get(x, y)) continue;
            if (
              a.get(x, y) === INK &&
              x >= plate.x0 &&
              x <= plate.x1 &&
              y >= plate.y0 &&
              y <= plate.y1
            ) {
              continue;
            }
            cx += x;
            cy += y;
            cn++;
          }
        }
        expect(cn, `${slot} at r ${r} carries something`).toBeGreaterThan(0);
        // Within three pixels of the middle, each way (the pair is placed in whole coarse
        // units of two pixels, and the letters are not symmetrical).
        expect(
          Math.abs(cx / cn - px / pn),
          `${slot} across, r ${r}`,
        ).toBeLessThanOrEqual(3);
        expect(
          Math.abs(cy / cn - py / pn),
          `${slot} down, r ${r}`,
        ).toBeLessThanOrEqual(3);
      }
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

  it("the golden ball: the same ball, its leather a ramp of gold and its patches as ever", () => {
    for (const r of [44, 88, 120]) {
      const state = ball({ r, yaw: 0.05 });
      const plain = render(state);
      const gold = render({ ...state, gold: true });
      const lit = DAY.lit;
      const golds = new Set<Color>([
        lit(P.goldLight),
        lit(P.gold),
        lit(P.goldDark),
      ]);
      const whites = new Set<Color>([lit(P.chalk), lit(P.steelHi)]);
      // counted, and looked at once at the end: a ball is a lot of pixels
      let leather = 0;
      let left = 0;
      let shape = 0;
      let onPatch = 0;
      let notGold = 0;
      for (let y = 0; y < plain.h; y++) {
        for (let x = 0; x < plain.w; x++) {
          const a = plain.get(x, y);
          const b = gold.get(x, y);
          if ((a === 0) !== (b === 0)) shape++;
          if (a === b) {
            // white that stayed white: only the words and pictures on the patches
            if (whites.has(a) && ballSlotAt(state, x, y) === null) left++;
            continue;
          }
          if (ballSlotAt(state, x, y) !== null) onPatch++;
          if (whites.has(a)) {
            leather++;
            if (!golds.has(b)) notGold++;
          }
        }
      }
      // the same silhouette, and never a pixel of a patch changed
      expect(shape, `${r}`).toBe(0);
      expect(onPatch, `${r}`).toBe(0);
      // most of the ball is leather, and all of that is gold now
      expect(leather, `${r}`).toBeGreaterThan(r * r);
      expect(notGold, `${r}`).toBe(0);
      expect(left, `${r}`).toBeLessThan(leather * 0.03);
    }
  });

  describe("NEXT-GEN's and RETRO's name tags", () => {
    /** The menu's ball with RETRO and NEXT-GEN open, as the home screen draws it. */
    const ERA: BallPatches = {
      ...MENU,
      top: { label: "NEXT-GEN", icon: "nextgen", accent: MODE_COLORS.nextgen },
      bottom: { label: "RETRO", icon: "retro", accent: MODE_COLORS.retro },
    };
    /** The same with no words for the two: so no tags, and all else alike. */
    const BARE: BallPatches = {
      ...ERA,
      top: { ...ERA.top!, label: "" },
      bottom: { ...ERA.bottom!, label: "" },
    };
    const WORDS = { top: "NEXT-GEN", bottom: "RETRO" } as const;
    const TAGGED = ["top", "bottom"] as const;
    /** A tag: the small face's ten rows and two round them, four pixels either side. */
    const tagWidth = (word: string): number =>
      measureText(word, { font: paintedFont(FONT_3x5) }) + 8;

    /**
     * Where a slot's tag is pressed but its patch is not: the tag's own ground, as the
     * hit test has it. Its bounding box, and how many pixels.
     */
    function tagGround(
      state: BallState,
      slot: BallSlot,
      patches = ERA,
    ): { x0: number; y0: number; x1: number; y1: number; n: number } {
      const box = { x0: 1e9, y0: 1e9, x1: -1, y1: -1, n: 0 };
      // (looked for where a tag can be: the middle of the ball's own half, top or bottom;
      // the whole picture is 100,000 pixels and this is asked for many poses)
      const top = slot === "top";
      for (let y = top ? 40 : 160; y < (top ? 160 : 280); y++) {
        for (let x = 80; x < 240; x++) {
          if (ballSlotAt(state, x, y, patches) !== slot) continue;
          if (ballSlotAt(state, x, y) === slot) continue;
          box.x0 = Math.min(box.x0, x);
          box.y0 = Math.min(box.y0, y);
          box.x1 = Math.max(box.x1, x);
          box.y1 = Math.max(box.y1, y);
          box.n++;
        }
      }
      return box;
    }

    it("hang from their squashed patches on every menu size, each as wide as its word, towards the middle", () => {
      for (const r of [74, 76, 80, 86, 88, 90, 100, 112, 118]) {
        const state = ball({ r });
        const tagged = render(state, ERA);
        const bare = render(state, BARE);
        for (const slot of TAGGED) {
          const box = tagGround(state, slot);
          const label = `r ${r} ${slot}`;
          expect(box.n, label).toBeGreaterThan(300);
          // as wide as its word and the padding, about the ball's middle
          expect(box.x1 - box.x0 + 1, label).toBe(tagWidth(WORDS[slot]));
          expect(
            Math.abs((box.x0 + box.x1) / 2 - 160),
            label,
          ).toBeLessThanOrEqual(1);
          // on the middle's side of its patch: NEXT-GEN's below it, RETRO's above
          const middle = (box.y0 + box.y1) / 2;
          if (slot === "top") {
            expect(middle, label).toBeLessThan(160 - r * 0.4);
            expect(middle, label).toBeGreaterThan(160 - r * 0.64);
          } else {
            expect(middle, label).toBeGreaterThan(160 + r * 0.4);
            expect(middle, label).toBeLessThan(160 + r * 0.64);
          }
          // drawn there: a dark plate with the word in the mode's colour
          let plate = 0;
          let word = 0;
          const colour = DAY.lit(
            MODE_COLORS[slot === "top" ? "nextgen" : "retro"].base,
          );
          for (let y = box.y0; y <= box.y1; y++) {
            for (let x = box.x0; x <= box.x1; x++) {
              if (tagged.get(x, y) === bare.get(x, y)) continue;
              if (tagged.get(x, y) === colour) word++;
              else plate++;
            }
          }
          expect(word, label).toBeGreaterThan(WORDS[slot].length * 20);
          expect(plate, label).toBeGreaterThan(word);
        }
      }
    });

    it("are their buttons: every pixel a tag paints is pressed as its slot, and nothing else of the ball changes", () => {
      for (const r of [74, 88, 112]) {
        const state = ball({ r });
        const tagged = render(state, ERA);
        const bare = render(state, BARE);
        let painted = 0;
        for (let y = 0; y < 320; y++) {
          for (let x = 0; x < 320; x++) {
            if (tagged.get(x, y) === bare.get(x, y)) continue;
            painted++;
            const slot = ballSlotAt(state, x, y, ERA);
            expect(
              slot === "top" || slot === "bottom",
              `r ${r} at ${x},${y}`,
            ).toBe(true);
          }
        }
        expect(painted, `r ${r}`).toBeGreaterThan(900);
      }
      // without the patches the hit test is the pentagons alone, as it always was
      const state = ball();
      const box = tagGround(state, "top");
      const x = Math.round((box.x0 + box.x1) / 2);
      const y = Math.round((box.y0 + box.y1) / 2);
      expect(ballSlotAt(state, x, y, ERA)).toBe("top");
      expect(ballSlotAt(state, x, y)).toBeNull();
    });

    it("ride the ball through the rock and the nod, and never touch HOME or AWAY", () => {
      for (const r of [74, 88, 112]) {
        const rest = tagGround(ball({ r }), "top").n;
        // the corners of the idle motion, and each of the two alone
        for (const [yaw, pitch] of [
          [-0.12, -0.065],
          [-0.12, 0.065],
          [0.12, -0.065],
          [0.12, 0.065],
          [0.12, 0],
          [0, 0.065],
        ]) {
          const state = ball({ r, yaw, pitch });
          const label = `r ${r} yaw ${yaw} pitch ${pitch}`;
          const tagged = render(state, ERA);
          const bare = render(state, BARE);
          let painted = 0;
          for (let i = 0; i < tagged.data.length; i++) {
            if (tagged.data[i] === bare.data[i]) continue;
            painted++;
            const under = ballSlotAt(state, i % 320, Math.floor(i / 320));
            expect(under === "left" || under === "right", label).toBe(false);
          }
          // both are there, whole, at every end of it: nothing comes and goes
          expect(painted, label).toBeGreaterThan(900);
          const boxes = {
            top: tagGround(state, "top"),
            bottom: tagGround(state, "bottom"),
          };
          for (const slot of TAGGED) {
            const box = boxes[slot];
            expect(box.x1 - box.x0 + 1, label).toBe(tagWidth(WORDS[slot]));
          }
          expect(boxes.top.n, label).toBeGreaterThan(rest * 0.85);
          // it follows the rock: to the right when the front turns right
          const at = (boxes.top.x0 + boxes.top.x1) / 2;
          if (yaw > 0) expect(at, label).toBeGreaterThan(162);
          if (yaw < 0) expect(at, label).toBeLessThan(158);
        }
      }
    });

    it("are in their button's state: the mode's colour under the pointer, dark when pressed, flashing when chosen", () => {
      const lit = DAY.lit(MODE_COLORS.nextgen.base);
      const dark = DAY.lit(MODE_COLORS.nextgen.dark);
      const tally = (state: BallState, c: Color): number => {
        const box = tagGround(state, "top");
        const s = render(state, ERA);
        let n = 0;
        for (let y = box.y0; y <= box.y1; y++) {
          for (let x = box.x0; x <= box.x1; x++) {
            // (below the patch's own edge: the tag alone)
            if (ballSlotAt(state, x, y) === null && s.get(x, y) === c) n++;
          }
        }
        return n;
      };
      const rest = ball();
      const word = tally(rest, lit);
      expect(word).toBeGreaterThan(150);
      // under the pointer the plate is the mode's colour and the word chalk
      expect(tally(ball({ hovered: "top" }), lit)).toBeGreaterThan(word * 2);
      expect(tally(ball({ hovered: "top" }), P.chalk)).toBeGreaterThan(150);
      // pressed: the dark tone
      expect(tally(ball({ pressed: "top" }), dark)).toBeGreaterThan(word * 2);
      // chosen: it flashes with its patch, white then the light tone, the word dark
      expect(tally(ball({ chosen: "top", t: 0 }), P.white)).toBeGreaterThan(
        word * 2,
      );
      expect(
        tally(ball({ chosen: "top", t: 0.13 }), MODE_COLORS.nextgen.light),
      ).toBeGreaterThan(word * 2);
      expect(
        tally(ball({ chosen: "top", t: 0 }), MODE_COLORS.nextgen.dark),
      ).toBeGreaterThan(150);
      // and the other button's tag is as it was
      expect(render(ball({ hovered: "bottom" }), ERA).data).not.toEqual(
        render(rest, ERA).data,
      );
    });

    it("are not there where they should not be: no words, a locked button, a patch shown straight on, a ball turned away", () => {
      const none = (
        state: BallState,
        patches: BallPatches,
        why: string,
      ): void => {
        for (const slot of TAGGED) {
          expect(tagGround(state, slot, patches).n, `${why} ${slot}`).toBe(0);
        }
      };
      // too small a ball for HOME and AWAY to carry their words: the four say the same
      for (const r of [48, 60, 66, 72]) {
        const state = ball({ r });
        none(state, ERA, `r ${r}`);
        expect(render(state, ERA).data, `r ${r}`).toEqual(
          render(state, BARE).data,
        );
      }
      // a locked button has no tag: its word waits for its pose
      none(ball(), MENU, "locked");
      // shown straight on, the patch carries its word itself
      for (const slot of TAGGED) {
        none(ball({ r: 90, ...ballShowPose(slot) }), ERA, `shown ${slot}`);
      }
      // a ball turned or thrown is no menu
      none(ball({ yaw: 1.2 }), ERA, "turned");
      none(ball({ yaw: Math.PI }), ERA, "back");
      none(ball({ pitch: 0.9 }), ERA, "rolled");
      none(ball({ roll: Math.PI / 2 }), ERA, "on its side");
      // no word, no tag
      none(ball(), BARE, "bare");
    });

    it("say which mode a played button is: the score on the patch, the name on its tag", () => {
      const played: BallPatches = {
        ...ERA,
        top: { ...ERA.top!, badge: "70" },
        bottom: { ...ERA.bottom!, badge: "380" },
      };
      const state = ball();
      for (const slot of TAGGED) {
        const open = tagGround(state, slot);
        const scored = tagGround(state, slot, played);
        expect(scored).toEqual(open);
      }
      // the patches differ (a score for a picture); the tags' own ground does not
      const a = render(state, ERA);
      const b = render(state, played);
      expect(a.data).not.toEqual(b.data);
      const box = tagGround(state, "top");
      for (let y = box.y0 + 4; y <= box.y1; y++) {
        for (let x = box.x0; x <= box.x1; x++) {
          expect(b.get(x, y)).toBe(a.get(x, y));
        }
      }
    });
  });

  describe("the plate under a word", () => {
    const ERA: BallPatches = {
      ...MENU,
      top: { label: "NEXT-GEN", icon: "nextgen", accent: MODE_COLORS.nextgen },
      bottom: { label: "RETRO", icon: "retro", accent: MODE_COLORS.retro },
    };

    /**
     * The box of a word on a slot's patch: the lowest ten rows that hold pixels of `c` (the
     * word is the last thing on its patch, under its picture), and the columns they span.
     */
    function wordBox(
      s: Surface,
      state: BallState,
      slot: BallSlot,
      c: Color,
    ): { x0: number; y0: number; x1: number; y1: number } {
      let y1 = -1;
      for (let y = 319; y >= 0 && y1 < 0; y--) {
        for (let x = 0; x < 320; x++) {
          if (s.get(x, y) === c && ballSlotAt(state, x, y) === slot) {
            y1 = y;
            break;
          }
        }
      }
      expect(y1, `${slot} has a word`).toBeGreaterThan(0);
      const y0 = y1 - 9;
      let x0 = 320;
      let x1 = -1;
      for (let y = y0; y <= y1; y++) {
        for (let x = 0; x < 320; x++) {
          if (s.get(x, y) !== c || ballSlotAt(state, x, y) !== slot) continue;
          x0 = Math.min(x0, x);
          x1 = Math.max(x1, x);
        }
      }
      return { x0, y0, x1, y1 };
    }

    /** How many pixels of the box, and of the two rows above and below it, are not `ok`. */
    function strays(
      s: Surface,
      box: { x0: number; y0: number; x1: number; y1: number },
      ok: readonly Color[],
    ): number {
      let n = 0;
      for (let y = box.y0 - 2; y <= box.y1 + 2; y++) {
        for (let x = box.x0; x <= box.x1; x++) {
          if (!ok.includes(s.get(x, y))) n++;
        }
      }
      return n;
    }

    it("HOME's and AWAY's words stand on a dark plate at rest, on every menu size, as the name tags' do", () => {
      for (const r of [74, 76, 80, 86, 88, 90, 100, 112, 118]) {
        const state = ball({ r });
        const s = render(state, ERA);
        for (const slot of ["left", "right"] as const) {
          const box = wordBox(s, state, slot, P.chalk);
          const label = `r ${r} ${slot}`;
          // the word, wide enough to be one (HOME and AWAY are four letters)
          expect(box.x1 - box.x0 + 1, label).toBeGreaterThanOrEqual(28);
          // nothing under or between its letters but the plate, with two rows of it above
          // and below: not the patch's own slate and night
          expect(strays(s, box, [P.chalk, INK]), label).toBe(0);
        }
      }
    });

    it("keeps the plate inside the patch: the frame is whole and nothing lands on the leather", () => {
      // without the words there is no plate: what the words add is chalk and ink, on the
      // patches alone, and never on a pixel of a frame
      const bare: BallPatches = {
        ...ERA,
        left: { ...ERA.left!, label: "" },
        right: { ...ERA.right!, label: "" },
        top: { ...ERA.top!, label: "" },
        bottom: { ...ERA.bottom!, label: "" },
      };
      const frame = new Set<Color>();
      for (const mode of ["home", "away"] as const) {
        for (const c of Object.values(MODE_COLORS[mode])) frame.add(DAY.lit(c));
      }
      for (const r of [88, 112]) {
        const state = ball({ r });
        const worded = render(state, {
          ...bare,
          left: ERA.left,
          right: ERA.right,
        });
        const plain = render(state, bare);
        let plate = 0;
        for (let i = 0; i < worded.data.length; i++) {
          if (worded.data[i] !== INK || plain.data[i] === INK) continue;
          const slot = ballSlotAt(state, i % 320, Math.floor(i / 320));
          expect(slot === "left" || slot === "right", `r ${r}`).toBe(true);
          plate++;
        }
        expect(plate, `r ${r}`).toBeGreaterThan(300);
      }
      // the frame as it is with the words: every pixel of it still in a frame colour where
      // the plate's rows cross it
      const state = ball({ r: 88 });
      const s = render(state, ERA);
      for (const slot of ["left", "right"] as const) {
        const box = wordBox(s, state, slot, P.chalk);
        let edge = 0;
        for (let y = box.y0; y <= box.y1; y++) {
          let first = -1;
          let last = -1;
          for (let x = 0; x < 320; x++) {
            if (ballSlotAt(state, x, y) !== slot) continue;
            if (first < 0) first = x;
            last = x;
          }
          // the patch's own first and last pixel on each of the word's rows: its frame
          for (const x of [first, last]) {
            expect(frame.has(s.get(x, y)), `${slot} frame at ${x},${y}`).toBe(
              true,
            );
            edge++;
          }
        }
        expect(edge).toBe(20);
      }
    });

    it("has no plate under the pointer, pressed or chosen: the patch is one colour then, as a name tag is", () => {
      const rest = ball();
      const box = wordBox(render(rest, ERA), rest, "left", P.chalk);
      const inked = (state: BallState): number => {
        const s = render(state, ERA);
        let n = 0;
        for (let y = box.y0 - 2; y <= box.y1 + 2; y++) {
          for (let x = box.x0; x <= box.x1; x++) if (s.get(x, y) === INK) n++;
        }
        return n;
      };
      expect(inked(rest)).toBeGreaterThan(150);
      expect(inked(ball({ hovered: "left" }))).toBe(0);
      expect(inked(ball({ chosen: "left", t: 0 }))).toBe(0);
      // (pressed, the word goes down two pixels with its patch: no ink round it either)
      expect(inked(ball({ pressed: "left" }))).toBe(0);
      // and the other button keeps its plate meanwhile
      const away = wordBox(render(rest, ERA), rest, "right", P.chalk);
      expect(
        strays(render(ball({ hovered: "left" }), ERA), away, [P.chalk, INK]),
      ).toBe(0);
    });

    it("a played button's word keeps its plate, and its score has none", () => {
      const played: BallPatches = {
        ...ERA,
        left: { ...ERA.left!, badge: "512" },
      };
      const state = ball();
      const s = render(state, played);
      const box = wordBox(s, state, "left", P.chalk);
      expect(strays(s, box, [P.chalk, INK])).toBe(0);
      // the same word in the same place as before it was played
      expect(box).toEqual(wordBox(render(state, ERA), state, "left", P.chalk));
    });

    it("RETRO's word stands on a plate when the ball is turned to show it, open or locked", () => {
      const state = ball({ r: 90, ...ballShowPose("bottom") });
      // open: what the word adds to its patch is the word, in the mode's light colour, and
      // the plate under it, no wider or taller than a name tag's
      const open = render(state, ERA);
      const wordless = render(state, {
        ...ERA,
        bottom: { ...ERA.bottom!, label: "" },
      });
      const light = DAY.lit(MODE_COLORS.retro.light);
      const box = { x0: 320, y0: 320, x1: -1, y1: -1 };
      let word = 0;
      let plate = 0;
      for (let i = 0; i < open.data.length; i++) {
        if (open.data[i] === wordless.data[i]) continue;
        const x = i % 320;
        const y = Math.floor(i / 320);
        expect(ballSlotAt(state, x, y), `at ${x},${y}`).toBe("bottom");
        expect([light, INK]).toContain(open.data[i]);
        if (open.data[i] === INK) plate++;
        else word++;
        box.x0 = Math.min(box.x0, x);
        box.y0 = Math.min(box.y0, y);
        box.x1 = Math.max(box.x1, x);
        box.y1 = Math.max(box.y1, y);
      }
      expect(word).toBeGreaterThan(100);
      expect(plate).toBeGreaterThan(300);
      // RETRO in the small face is 38 across and 10 tall: 4 either side, 2 above and below
      expect(box.x1 - box.x0 + 1).toBe(46);
      expect(box.y1 - box.y0 + 1).toBe(14);
      // locked: the word in mist, the last thing on its patch
      const shut = render(state, MENU);
      const b = wordBox(shut, state, "bottom", P.mist);
      expect(b.x1 - b.x0 + 1).toBeGreaterThanOrEqual(34);
      expect(strays(shut, b, [P.mist, INK])).toBe(0);
    });
  });

  it("casts its shadow on the grass", () => {
    const s = new Surface(320, 320);
    drawBallShadow(s, ball(), 250, DAY);
    let n = 0;
    for (let i = 0; i < s.data.length; i++) if (s.data[i] !== 0) n++;
    expect(n).toBeGreaterThan(1000);
  });
});
