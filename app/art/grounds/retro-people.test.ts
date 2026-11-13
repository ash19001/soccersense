import { describe, expect, it } from "vitest";
import { P } from "~/art/palette";
import { Surface, TRANSPARENT } from "~/pixel";
import {
  BACK_BOWLER,
  BACK_CAP,
  FanList,
  HAT_BOWLER,
  HAT_CAP,
  RATTLE,
  crowdBack,
  drawFan,
  drawWatcher,
  paintFan,
  type FanLook,
  type Pose,
  type Watcher,
} from "./people";

const POSES: Pose[] = [0, 1, 2, 3, 4, 5];

function blank(): Surface {
  const s = new Surface(60, 60);
  s.clear(TRANSPARENT);
  return s;
}

function bounds(s: Surface): {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
} {
  let x0 = 1e9;
  let y0 = 1e9;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < s.h; y++) {
    for (let x = 0; x < s.w; x++) {
      if (s.get(x, y) === TRANSPARENT) continue;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  }
  return { x0, y0, x1, y1 };
}

function look(hat: number): FanLook {
  return {
    head: P.skinB,
    body: P.night,
    hand: P.skinB,
    seat: P.slate,
    scarfA: P.home,
    scarfB: P.chalk,
    period: 9,
    offset: 3,
    withHero: true,
    hair: P.steel,
    hat,
    rattle: P.wood,
  };
}

describe("RETRO's crowd", () => {
  it("seats a fan in a cap, a bowler or bare-headed, with or without a rattle, in today's box", () => {
    for (const hat of [HAT_CAP, HAT_BOWLER, HAT_CAP + RATTLE, RATTLE]) {
      const s = blank();
      const fans = new FanList(1);
      paintFan(s, fans, 20, 30, look(hat));
      // a bowler's crown is the one thing allowed over the box: its dome, a row above
      expect(bounds(s), `hat ${hat}`).toEqual({
        x0: 20,
        y0: (hat & 3) === HAT_BOWLER ? 29 : 30,
        x1: 25,
        y1: 37,
      });
      expect(fans.hat[0]).toBe(hat);
      for (const pose of POSES) {
        drawFan(s, fans, 0, pose);
        const b = bounds(s);
        expect(b.x0).toBeGreaterThanOrEqual(18);
        expect(b.x1).toBeLessThanOrEqual(27);
        expect(b.y0).toBeGreaterThanOrEqual(26);
        expect(b.y1).toBe(37);
      }
    }
  });

  it("puts the hat on the head and the rattle in a raised hand", () => {
    const cap = blank();
    paintFan(cap, null, 20, 30, look(HAT_CAP));
    // the peak over the brow, left of the face
    expect(cap.get(20, 31)).not.toBe(P.slate);
    const bare = blank();
    paintFan(bare, null, 20, 30, look(0));
    expect(bare.get(20, 31)).toBe(P.slate);
    const s = blank();
    const fans = new FanList(1);
    paintFan(s, fans, 20, 30, look(HAT_CAP + RATTLE));
    drawFan(s, fans, 0, 2);
    const found = s.data.includes(P.wood);
    expect(found).toBe(true);
  });

  it("draws the near crowd's caps and bowlers from behind in their 10 x 12 box", () => {
    for (const style of [BACK_CAP, BACK_BOWLER]) {
      const s = blank();
      crowdBack(
        s,
        10,
        10,
        style,
        P.hairDark,
        P.skinA,
        P.night,
        P.steel,
        P.slate,
      );
      const b = bounds(s);
      expect(b.x0).toBeGreaterThanOrEqual(10);
      expect(b.x1).toBeLessThanOrEqual(19);
      expect(b.y0).toBe(10);
      expect(b.y1).toBe(21);
      expect(s.data.includes(P.steel)).toBe(true);
    }
  });

  it("caps and bowlers the standing watchers, never a child", () => {
    const w: Watcher = {
      x: 30,
      y: 50,
      kid: false,
      hair: P.hairBrown,
      skin: P.skinA,
      coat: P.slate,
      coatLow: P.night,
      legs: P.night,
      period: 9,
      offset: 0,
      withHero: true,
      scarfA: TRANSPARENT,
      scarfB: P.chalk,
      hat: HAT_CAP,
      hatColor: P.steel,
    };
    const s = blank();
    drawWatcher(s, w, 0);
    expect(s.data.includes(P.steel)).toBe(true);
    const k = blank();
    drawWatcher(k, { ...w, kid: true }, 0);
    expect(k.data.includes(P.steel)).toBe(false);
  });
});
