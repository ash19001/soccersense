import { describe, expect, it } from "vitest";
import {
  COVER,
  FAN,
  PLAYER,
  STAGE_W,
  YOUTH,
  careerLayout,
  menuLayout,
  type Zone,
} from "./layout";
import { moonPosition } from "./sky";

const SIZES: readonly (readonly [number, number])[] = [
  [130, 281],
  [120, 222],
  [160, 300],
  [195, 310],
  [480, 270],
  [480, 300],
  [456, 256],
  [512, 288],
  [640, 360],
  [688, 288],
  [400, 250],
  [720, 360],
];

function numbers(o: object): number[] {
  const out: number[] = [];
  for (const v of Object.values(o)) {
    if (typeof v === "number") out.push(v);
    else if (v && typeof v === "object") out.push(...numbers(v));
  }
  return out;
}

function bottom(z: Zone): number {
  return z.y + z.h;
}

describe("sprite sizes", () => {
  it("match the art bible's metrics", () => {
    expect(PLAYER).toEqual({ w: 12, h: 18, cellW: 16, cellH: 20 });
    expect(YOUTH).toEqual({ w: 10, h: 14, cellW: 14, cellH: 16 });
    expect(FAN).toEqual({ w: 3, h: 4, pitch: 4 });
    expect(STAGE_W).toBe(130);
  });
});

describe("menuLayout", () => {
  it("gives the reference phone its numbers", () => {
    const m = menuLayout(130, 281);
    expect(m.cx).toBe(65);
    expect(m.horizonY).toBe(92);
    expect(m.spotY).toBe(116);
    expect(m.scale).toBeCloseTo(0.42, 2);
    expect(m.sky).toEqual({
      horizonY: 92,
      clearTop: 42,
      sunX: 65,
      moon: { x: 11, y: 12 },
    });
    expect(m.ballR).toBe(44);
    expect(m.ballCy).toBe(197);
    expect(m.logo).toEqual({ x: 0, y: 0, w: 130, h: 42 });
    expect(m.scoreboard).toEqual({ x: 20, y: 50, w: 90, h: 33 });
    expect(m.stand).toEqual({ x: 0, y: 98, w: 130, h: 47 });
    expect(m.pitch).toEqual({ x: 0, y: 145, w: 130, h: 136 });
    expect(m.caption).toEqual({ x: 0, y: 253, w: 130, h: 28 });
  });

  it("gives the reference monitor its numbers", () => {
    const m = menuLayout(480, 270);
    expect(m.cx).toBe(240);
    expect(m.ballR).toBe(Math.round(270 * 0.165));
    expect(m.ballCy).toBe(189);
    expect(m.horizonY).toBe(73);
    expect(m.spotY).toBe(129);
    expect(m.scale).toBeCloseTo(0.96, 5);
    expect(m.sky).toEqual({
      horizonY: 73,
      clearTop: 41,
      sunX: 240,
      moon: { x: 394, y: 28 },
    });
    expect(m.scoreboard).toEqual({ x: 34, y: 49, w: 92, h: 35 });
    expect(m.stand).toEqual({ x: 82, y: 87, w: 316, h: 108 });
    expect(m.pitch).toEqual({ x: 0, y: 195, w: 480, h: 75 });
    expect(m.caption).toEqual({ x: 0, y: 243, w: 480, h: 27 });
  });

  it.each(SIZES)("composes cleanly at %i x %i", (w, h) => {
    const m = menuLayout(w, h);
    const { scale, ...rest } = m;
    for (const n of numbers(rest)) expect(Number.isInteger(n)).toBe(true);
    expect(scale).toBeGreaterThan(0.3);
    expect(scale).toBeLessThan(1.6);
    const wide = w > h;

    // The top is sky: the horizon is between a quarter and a third of the way down, and
    // the sky's own horizon is the same row.
    expect(m.horizonY).toBeGreaterThanOrEqual(Math.floor(h * 0.25));
    expect(m.horizonY).toBeLessThanOrEqual(Math.ceil(h * 0.34));
    expect(m.sky.horizonY).toBe(m.horizonY);
    expect(m.sky.clearTop).toBe(bottom(m.logo));
    expect(bottom(m.logo)).toBeLessThan(m.horizonY);

    // Top to bottom: the logo zone, the horizon, the far edge of the stadium, the
    // centre spot, the top of the ball, the foot of the stadium's near wall.
    expect(m.stand.y).toBeGreaterThan(m.horizonY);
    expect(m.spotY).toBeGreaterThan(m.stand.y);
    expect(m.spotY).toBeLessThan(m.ballCy - m.ballR);
    // On a monitor the ball floats in front of the near side of the ground; on a phone
    // the ground is whole above it.
    if (w > h) expect(bottom(m.stand)).toBeGreaterThan(m.ballCy - m.ballR);
    // The pitch shows above the ball: at least a fifth of the stadium's height.
    expect(m.ballCy - m.ballR - m.stand.y).toBeGreaterThan(m.stand.h * 0.2);
    // The land in front of it runs from there to the bottom.
    expect(m.pitch.y).toBe(bottom(m.stand));
    expect(m.pitch.x).toBe(0);
    expect(m.pitch.w).toBe(w);
    expect(bottom(m.pitch)).toBe(h);
    expect(bottom(m.caption)).toBe(h);

    // The stadium is centred, whole on a monitor (about 60% of the width, more on the
    // narrowest) and as wide as a phone.
    expect(Math.abs(m.stand.x + m.stand.w / 2 - m.cx)).toBeLessThanOrEqual(1);
    if (wide) {
      expect(m.stand.x).toBeGreaterThan(0);
      expect(m.stand.x + m.stand.w).toBeLessThan(w);
      expect(m.stand.w).toBeGreaterThan(w * 0.45);
      expect(m.stand.w).toBeLessThan(w * 0.7);
    } else {
      expect(m.stand.x).toBe(0);
      expect(m.stand.w).toBe(w);
    }

    // The sign: a readable panel, on the canvas, under the logo zone and above the ball.
    const sign = m.scoreboard;
    expect(sign.w).toBeGreaterThanOrEqual(86);
    expect(sign.w).toBeLessThanOrEqual(96);
    expect(sign.h).toBeGreaterThanOrEqual(33);
    expect(sign.h).toBeLessThanOrEqual(37);
    expect(sign.x).toBeGreaterThanOrEqual(0);
    expect(sign.x + sign.w).toBeLessThanOrEqual(w);
    expect(sign.y).toBeGreaterThan(bottom(m.logo));
    expect(bottom(sign)).toBeLessThan(m.ballCy - m.ballR);
    if (wide) {
      // at the left on a monitor, clear of the one-line wordmark (132 wide) and the pitch
      expect(sign.x + sign.w).toBeLessThan(m.cx - 66);
    } else {
      expect(Math.abs(sign.x + sign.w / 2 - m.cx)).toBeLessThanOrEqual(1);
    }

    // The sun's column is the middle.
    expect(m.sky.sunX).toBe(m.cx);

    // The moon is whole, in the sky, on the canvas: never half behind something. Its disc
    // is the sky's (radius 6 to 9), and its glow reaches 6 px further.
    const moon = m.sky.moon;
    const r = moonPosition(w, m.horizonY).r;
    expect(moon.x - r).toBeGreaterThanOrEqual(0);
    expect(moon.x + r).toBeLessThan(w);
    expect(moon.y - r).toBeGreaterThanOrEqual(0);
    expect(moon.y + r).toBeLessThan(m.horizonY);
    // the airship's envelope: 64 px either side of the sign's middle on a monitor, at most
    // 60 elsewhere, 24 above and below, fins and propellers a little further
    const shipX = sign.x + sign.w / 2;
    const shipY = sign.y + sign.h / 2;
    const clearOfShip =
      Math.abs(moon.x - shipX) >= 64 + 6 + r ||
      Math.abs(moon.y - shipY) >= 36 + r;
    const behindShip =
      Math.abs(moon.x - shipX) <= 30 && Math.abs(moon.y - shipY) <= 4;
    expect(clearOfShip || behindShip).toBe(true);
    // the wordmark: 132 wide on one line, 74 when stacked (canvases under 158 wide)
    const wordmark = w - 26 >= 132 ? 66 : 37;
    if (!behindShip && moon.y - r < bottom(m.logo)) {
      expect(Math.abs(moon.x - m.cx) - r).toBeGreaterThan(wordmark + 2);
    }
    if (wide) {
      // on a monitor: upper right, beside the wordmark, and so high that no tower on the
      // horizon reaches it (the city's roofs stop 3 px short of the logo zone, and the
      // tallest aerial stands at most 6 px above its roof)
      expect(moon.x).toBeGreaterThan(m.cx + 66 + r + 6);
      expect(clearOfShip).toBe(true);
      expect(moon.y + r).toBeLessThan(bottom(m.logo) - 3);
    }

    // The ball floats in front of the lower middle, clear of the captions, and fits across.
    expect(m.ballCy - m.ballR).toBeGreaterThan(m.horizonY);
    expect(m.ballCy + m.ballR).toBeLessThanOrEqual(m.caption.y);
    expect(m.cx - m.ballR).toBeGreaterThanOrEqual(0);
    expect(m.cx + m.ballR).toBeLessThan(w);
  });

  it("rounds odd sizes and never returns NaN", () => {
    const { scale, ...rest } = menuLayout(130.4, 280.6);
    expect(Number.isFinite(scale)).toBe(true);
    for (const n of numbers(rest)) expect(Number.isInteger(n)).toBe(true);
    for (const [w, h] of [
      [0, 0],
      [1, 1],
      [900, 1],
      [1, 400],
      [900, 400],
    ]) {
      const m = menuLayout(w, h);
      for (const n of numbers(m)) expect(Number.isFinite(n)).toBe(true);
      for (const z of [m.logo, m.stand, m.pitch, m.caption]) {
        expect(z.w).toBeGreaterThanOrEqual(0);
        expect(z.h).toBeGreaterThanOrEqual(0);
        expect(z.x).toBeGreaterThanOrEqual(0);
        expect(z.y).toBeGreaterThanOrEqual(0);
        expect(z.x + z.w).toBeLessThanOrEqual(m.w);
        expect(z.y + z.h).toBeLessThanOrEqual(m.h);
      }
    }
  });
});

describe("careerLayout", () => {
  it("gives the art bible's numbers on the reference canvas", () => {
    const c = careerLayout(130, 281);
    expect(c.cx).toBe(65);
    expect(c.groundY).toBe(146);
    expect(c.stageLeft).toBe(0);
    expect(c.stageRight).toBe(130);
    expect(c.heroX).toBe(39);
    expect(c.goalX).toBe(109);
    expect(c.actionTop).toBe(87);
    expect(c.actionBottom).toBe(149);
    expect(c.keeperX).toBe(103);
    expect(c.farTouchY).toBe(137);
    expect(c.nearTouchY).toBe(180);
    expect(c.boardAskingY).toBe(84);
    expect(c.boardShrunkY).toBe(51);
    expect(c.answerBarY).toBe(253);
    expect(c.sheetY).toBe(152);
  });

  it("centres the 130 px stage on a wide canvas", () => {
    const c = careerLayout(480, 270);
    expect(c.cx).toBe(240);
    expect(c.stageLeft).toBe(175);
    expect(c.stageRight).toBe(305);
    expect(c.heroX).toBe(214);
    expect(c.goalX).toBe(284);
  });

  it.each(SIZES)("keeps the action in the visible band at %i x %i", (w, h) => {
    const c = careerLayout(w, h);
    for (const n of numbers(c)) expect(Number.isInteger(n)).toBe(true);
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
    expect(c.nearTouchY).toBeLessThan(c.answerBarY - 20);
    // A pitch with some depth to it: at least two players deep.
    expect(c.nearTouchY - c.farTouchY).toBeGreaterThanOrEqual(PLAYER.h * 2);
    // Left to right: hero, keeper, goal line.
    expect(c.stageLeft).toBeLessThan(c.heroX);
    expect(c.heroX).toBeLessThan(c.keeperX);
    expect(c.keeperX).toBeLessThan(c.goalX);
    expect(c.goalX).toBeLessThan(c.stageRight);
    expect(c.stageRight - c.stageLeft).toBe(STAGE_W);
  });
});
