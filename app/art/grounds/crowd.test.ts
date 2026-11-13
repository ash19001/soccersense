import { describe, expect, it } from "vitest";
import { FAN } from "~/art/layout";
import { lightingFor } from "~/art/lighting";
import { P } from "~/art/palette";
import { Surface, TRANSPARENT, type Color } from "~/pixel";
import { CareerGround, CROWD_MOODS, type CrowdMood, type Tier } from "./index";
import {
  BACKS,
  CROWD_STYLES,
  FanList,
  crowdBack,
  drawDog,
  drawFan,
  drawSteward,
  drawWatcher,
  paintBack,
  paintFan,
  type FanLook,
  type Pose,
  type Watcher,
} from "./people";

const DAY = lightingFor({ elevation: 35, morning: false });
const POSES: readonly Pose[] = [0, 1, 2, 3, 4, 5];
const BG = 0x01020304 as Color;

/** The bounding box of every pixel that is not the background. */
function bounds(s: Surface): {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
} {
  let x0 = s.w;
  let y0 = s.h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < s.h; y++) {
    for (let x = 0; x < s.w; x++) {
      if (s.get(x, y) === BG) continue;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  }
  return { x0, y0, x1, y1 };
}

function blank(w = 64, h = 64): Surface {
  const s = new Surface(w, h);
  s.clear(BG);
  return s;
}

function fanLook(scarf: boolean): FanLook {
  return {
    head: P.skinB,
    body: P.home,
    hand: P.skinB,
    seat: P.slate,
    scarfA: scarf ? P.home : TRANSPARENT,
    scarfB: P.chalk,
    period: 9,
    offset: 3,
    withHero: true,
    hair: P.hairDark,
  };
}

function watcher(kid: boolean, scarf: boolean): Watcher {
  return {
    x: 30,
    y: 50,
    kid,
    hair: P.hairBrown,
    skin: P.skinA,
    coat: P.awayDark,
    coatLow: P.slate,
    legs: P.night,
    period: 9,
    offset: 0,
    withHero: true,
    scarfA: scarf ? P.home : TRANSPARENT,
    scarfB: P.chalk,
  };
}

describe("the fan", () => {
  it("is 6 x 8 on an 8 px pitch", () => {
    expect(FAN).toEqual({ w: 6, h: 8, pitch: 8 });
  });

  it("rests inside its 6 x 8 box, head on the top row, and is remembered", () => {
    for (const scarf of [false, true]) {
      const s = blank();
      const fans = new FanList(4);
      paintFan(s, fans, 20, 30, fanLook(scarf));
      expect(bounds(s)).toEqual({ x0: 20, y0: 30, x1: 25, y1: 37 });
      expect(fans.n).toBe(1);
      // the hair is over the middle four columns, the corners are the seat
      expect(s.get(21, 30)).not.toBe(P.slate);
      expect(s.get(20, 30)).toBe(P.slate);
    }
  });

  it("moves in every pose within its reach", () => {
    for (const pose of POSES) {
      for (const scarf of [false, true]) {
        const s = blank();
        const fans = new FanList(1);
        paintFan(s, fans, 20, 30, fanLook(scarf));
        drawFan(s, fans, 0, pose);
        const b = bounds(s);
        // arms and a scarf held up reach 4 px over the box and 2 px either side
        expect(b.x0).toBeGreaterThanOrEqual(18);
        expect(b.x1).toBeLessThanOrEqual(27);
        expect(b.y0).toBeGreaterThanOrEqual(26);
        expect(b.y1).toBe(37);
      }
    }
  });

  it("covers its resting self when it stands up (no pixels left behind)", () => {
    for (const pose of [1, 2, 4] as Pose[]) {
      const s = blank();
      const fans = new FanList(1);
      paintFan(s, fans, 20, 30, fanLook(true));
      drawFan(s, fans, 0, pose);
      // up 2 px: the two bottom rows are the seat
      for (let x = 20; x < 26; x++) {
        expect(s.get(x, 36)).toBe(P.slate);
        expect(s.get(x, 37)).toBe(P.slate);
      }
    }
  });

  it("draws the same pixels for the same inputs", () => {
    const a = blank();
    const b = blank();
    for (const s of [a, b]) {
      const fans = new FanList(6);
      for (const pose of POSES) {
        paintFan(s, fans, 4 + pose * 9, 20, fanLook(pose % 2 === 0));
        drawFan(s, fans, pose, pose);
      }
    }
    expect(Array.from(a.data)).toEqual(Array.from(b.data));
  });
});

describe("people standing to watch", () => {
  it("stand on row y - 1 inside a 10-wide box, 28 tall (a child 22)", () => {
    for (const kid of [false, true]) {
      const s = blank();
      drawWatcher(s, watcher(kid, true), 0);
      expect(bounds(s)).toEqual({
        x0: 26,
        y0: 50 - (kid ? 22 : 28),
        x1: 35,
        y1: 49,
      });
    }
  });

  it("reach no further than their poses allow", () => {
    for (const kid of [false, true]) {
      for (const pose of POSES) {
        for (const scarf of [false, true]) {
          const s = blank();
          drawWatcher(s, watcher(kid, scarf), pose);
          const b = bounds(s);
          const top = 50 - (kid ? 22 : 28);
          expect(b.x0).toBeGreaterThanOrEqual(24);
          expect(b.x1).toBeLessThanOrEqual(37);
          expect(b.y0).toBeGreaterThanOrEqual(top - 6);
          // raised 2 px on a bob, a jump or a scarf held up
          const lift = pose === 1 || pose === 2 || pose === 4 ? 2 : 0;
          expect(b.y1).toBe(49 - lift);
        }
      }
    }
  });
});

describe("backs, the near crowd, the steward and the dog", () => {
  it("backs sit with their bottom row on y + 1", () => {
    for (const big of [false, true]) {
      const s = blank();
      paintBack(s, 10, 40, P.hairDark, P.home, big, P.skinA);
      expect(bounds(s)).toEqual({
        x0: 10,
        y0: 41 - (big ? 26 : 20) + 1,
        x1: 10 + (big ? 16 : 12) - 1,
        y1: 41,
      });
    }
  });

  it("a near-crowd back fills its 10 x 12 box in every style", () => {
    for (let style = 0; style < CROWD_STYLES; style++) {
      const s = blank();
      crowdBack(s, 10, 10, style, P.hairDark, P.skinA, P.home, P.home, P.chalk);
      expect(bounds(s)).toEqual({
        x0: 10,
        y0: 10,
        x1: 10 + BACKS.w - 1,
        y1: 10 + BACKS.h - 1,
      });
    }
  });

  it("the steward is 10 x 30 standing on row y - 1", () => {
    const s = blank();
    drawSteward(s, 30, 50, P.goldLight, P.chalk, P.skinB, P.night, P.night);
    expect(bounds(s)).toEqual({ x0: 26, y0: 20, x1: 35, y1: 49 });
  });

  it("the dog is 18 x 12 in every frame and mirrors inside its box", () => {
    const colors = [P.woodDark, P.wood, P.chalk, P.ink, P.gold, P.mist];
    for (let f = 0; f < 5; f++) {
      const a = blank();
      const b = blank();
      drawDog(a, f, 30, 50, colors, false);
      drawDog(b, f, 30, 50, colors, true);
      const box = bounds(a);
      expect(box.x0).toBeGreaterThanOrEqual(22);
      expect(box.x1).toBeLessThanOrEqual(39);
      expect(box.y1).toBe(49);
      expect(box.y0).toBe(38);
      for (let y = 38; y < 50; y++) {
        for (let x = 22; x <= 39; x++) {
          expect(b.get(x, y)).toBe(a.get(22 + 39 - x, y));
        }
      }
    }
  });
});

function ground(
  tier: Tier,
  mood: CrowdMood | null,
  t: number,
  w = 960,
  h = 540,
): Surface {
  const g = new CareerGround({ seed: 5, mode: "home", tier });
  g.resize(w, h);
  g.setLighting(DAY);
  if (mood) g.setMood(mood, 1);
  const s = new Surface(w, h);
  g.drawBack(s, t);
  g.drawFront(s, t);
  return s;
}

function diff(a: Surface, b: Surface): number {
  let n = 0;
  for (let i = 0; i < a.data.length; i++) if (a.data[i] !== b.data[i]) n++;
  return n;
}

describe("the crowd", () => {
  it("reacts when the mood is set, and is still when hushed", () => {
    const idle = ground(4, null, 1.6);
    const cheer = ground(4, "cheer", 1.6);
    expect(diff(idle, cheer)).toBeGreaterThan(1200);
    const a = ground(4, "hush", 3);
    const b = ground(4, "hush", 3.5);
    // only the LED boards and the dog move
    expect(diff(a, b)).toBeLessThan(diff(idle, cheer) / 4);
  });

  it("draws every mood at every stadium tier, the same pixels each time", () => {
    for (const tier of [4, 5, 6, 7] as Tier[]) {
      for (const mood of CROWD_MOODS) {
        const a = ground(tier, mood, 2.2, 720, 450);
        const b = ground(tier, mood, 2.2, 720, 450);
        expect(diff(a, b)).toBe(0);
      }
    }
  });
});
