import { describe, expect, it } from "vitest";
import {
  BALL_WORDS_R,
  COVER,
  FAN,
  PLAYER,
  STAGE_UNITS,
  STAGE_W,
  STAGE_W_MAX,
  YOUTH,
  careerLayout,
  menuLayout,
} from "./layout";

function numbers(o: object): number[] {
  const out: number[] = [];
  for (const v of Object.values(o)) {
    if (typeof v === "number") out.push(v);
    else if (v && typeof v === "object") out.push(...numbers(v));
  }
  return out;
}

describe("sprite sizes", () => {
  it("match the art bible's metrics", () => {
    expect(PLAYER).toEqual({ w: 24, h: 36, cellW: 32, cellH: 40 });
    expect(YOUTH).toEqual({ w: 20, h: 28, cellW: 28, cellH: 32 });
    expect(FAN).toEqual({ w: 6, h: 8, pitch: 8 });
    expect(STAGE_W).toBe(260);
    expect(STAGE_UNITS).toBe(130);
  });
});

describe("careerLayout", () => {
  /**
   * Canvases the game gets (art bible 2.1, ui/scale.ts), monitors and phones. Not 683 x 384
   * (1366 x 768): its pitch is 64 px deep, under two players.
   */
  const CANVASES: readonly (readonly [number, number])[] = [
    [960, 540],
    [854, 480],
    [720, 450],
    [1440, 720],
    [260, 562],
    [260, 563],
    [234, 507],
    [271, 601],
    [390, 620],
  ];

  it("gives the art bible's numbers on the reference canvas", () => {
    const c = careerLayout(260, 562);
    expect(c.cx).toBe(130);
    expect(c.groundY).toBe(292);
    expect(c.stageLeft).toBe(0);
    expect(c.stageRight).toBe(260);
    expect(c.heroX).toBe(78);
    expect(c.goalX).toBe(218);
    expect(c.actionTop).toBe(174);
    expect(c.actionBottom).toBe(298);
    expect(c.keeperX).toBe(206);
    expect(c.farTouchY).toBe(274);
    expect(c.nearTouchY).toBe(359);
    expect(c.boardAskingY).toBe(169);
    expect(c.boardShrunkY).toBe(101);
    expect(c.answerBarY).toBe(506);
    expect(c.sheetY).toBe(303);
  });

  it("widens the stage on a monitor, centred", () => {
    const c = careerLayout(960, 540);
    expect(c.cx).toBe(480);
    expect(c.stageLeft).toBe(288);
    expect(c.stageRight).toBe(672);
    expect(c.stageScale).toBeCloseTo(384 / STAGE_UNITS, 6);
    expect(c.heroX).toBe(403);
    expect(c.goalX).toBe(610);
    expect(c.keeperX).toBe(598);
    expect(c.groundY).toBe(281);
    const big = careerLayout(1440, 720);
    expect(big.stageRight - big.stageLeft).toBe(STAGE_W_MAX);
  });

  it("keeps the 260 px stage on every phone", () => {
    for (const [w, h] of [
      [260, 562],
      [240, 444],
      [320, 600],
      [390, 620],
    ] as const) {
      const c = careerLayout(w, h);
      expect(c.stageRight - c.stageLeft).toBe(STAGE_W);
      expect(c.stageScale).toBe(2);
      expect(c.goalX - c.heroX).toBe(140);
      expect(c.keeperX).toBe(c.cx + 76);
    }
  });

  it.each(CANVASES)(
    "keeps the action in the visible band at %i x %i",
    (w, h) => {
      const c = careerLayout(w, h);
      // Every position is a whole pixel (the stage's scale is a ratio, not a position).
      const { stageScale, ...positions } = c;
      expect(stageScale).toBeGreaterThanOrEqual(2);
      for (const n of numbers(positions))
        expect(Number.isInteger(n)).toBe(true);
      // Feet on the ground line, inside the band every interface state leaves visible.
      expect(c.groundY).toBeLessThanOrEqual(c.actionBottom);
      expect(c.groundY - PLAYER.h).toBeGreaterThanOrEqual(c.actionTop);
      expect(c.actionTop).toBeGreaterThanOrEqual(
        Math.floor(h * COVER.boardAsking),
      );
      expect(c.actionBottom).toBeLessThanOrEqual(
        Math.ceil(h * (1 - COVER.revealSheet)),
      );
      // Far touchline behind the players, near touchline in front, both on the canvas.
      expect(c.farTouchY).toBeLessThan(c.groundY);
      expect(c.farTouchY).toBeGreaterThan(c.actionTop);
      expect(c.nearTouchY).toBeGreaterThan(c.groundY);
      expect(c.nearTouchY).toBeLessThan(h);
      // The interface edges, top to bottom. The band sits between the asking board and the
      // sheet. The near touchline is foreground: seen while asking, under the sheet after.
      expect(c.boardShrunkY).toBeLessThan(c.boardAskingY);
      expect(c.boardAskingY).toBeLessThanOrEqual(c.actionTop);
      expect(c.actionBottom).toBeLessThanOrEqual(c.sheetY);
      expect(c.sheetY).toBeLessThan(c.nearTouchY);
      expect(c.nearTouchY).toBeLessThan(c.answerBarY - 40);
      // A pitch with some depth to it: at least two players deep.
      expect(c.nearTouchY - c.farTouchY).toBeGreaterThanOrEqual(PLAYER.h * 2);
      // Left to right: hero, keeper, goal line.
      expect(c.stageLeft).toBeLessThan(c.heroX);
      expect(c.heroX).toBeLessThan(c.keeperX);
      expect(c.keeperX).toBeLessThan(c.goalX);
      expect(c.goalX).toBeLessThan(c.stageRight);
      expect(c.stageRight - c.stageLeft).toBeGreaterThanOrEqual(STAGE_W);
      expect(c.stageRight - c.stageLeft).toBeLessThanOrEqual(STAGE_W_MAX);
      // The goal's net (22 px deep) stays on the stage.
      expect(c.goalX + 22).toBeLessThan(c.stageRight);
    },
  );
});

describe("the menu ball", () => {
  it("takes 0.31 of a phone's width, but never less than its words need", () => {
    // Canvases of phones at a ratio of 3: 360, 375, 390 and 430 wide.
    expect(menuLayout(216, 480).ballR).toBe(BALL_WORDS_R);
    expect(menuLayout(225, 488).ballR).toBe(BALL_WORDS_R);
    expect(menuLayout(234, 507).ballR).toBe(BALL_WORDS_R);
    expect(menuLayout(258, 560).ballR).toBe(80);
    // 412 x 915 at 2.625.
    expect(menuLayout(271, 601).ballR).toBe(84);
  });

  it("is never larger than it was (0.34 of the width) nor taller than the height allows", () => {
    for (let w = 100; w <= 500; w += 7) {
      for (let h = 180; h <= 1000; h += 11) {
        const { ballR } = menuLayout(w, h);
        expect(ballR).toBeLessThanOrEqual(
          Math.round(Math.min(w * 0.34, h * 0.165)),
        );
        expect(ballR).toBeGreaterThanOrEqual(
          Math.min(Math.round(Math.min(w * 0.34, h * 0.165)), BALL_WORDS_R),
        );
      }
    }
  });

  it("is the same on a monitor, where the height decides it", () => {
    expect(menuLayout(960, 540).ballR).toBe(89);
    expect(menuLayout(683, 384).ballR).toBe(63);
    expect(menuLayout(480, 270).ballR).toBe(45);
  });
});
