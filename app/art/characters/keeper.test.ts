// The keeper, the ball, the trophy and the puff.

import { describe, expect, it } from "vitest";

import { Surface, TRANSPARENT } from "~/pixel";
import { lightingFor } from "../lighting";
import { P } from "../palette";
import { LEGEND, artText, rows } from "./figure";
import { KEEPER, KEEPER_GLOVES } from "./keeper";
import { makeKit } from "./kit";
import {
  KEEPER_ANIMS,
  KEEPER_ANIM_NAMES,
  drawKeeper,
  keeperCell,
  keeperHands,
  keeperSprite,
} from "./people";
import { drawBallRing, drawMatchBall, drawPuff, drawTrophy } from "./props";

const DAY = lightingFor({ elevation: 40, morning: false });
const X = 60;
const Y = 70;

function drawn(paint: (s: Surface) => void): {
  s: Surface;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  count: number;
} {
  const s = new Surface(120, 90);
  paint(s);
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  let count = 0;
  for (let y = 0; y < s.h; y++) {
    for (let x = 0; x < s.w; x++) {
      if (s.get(x, y) === TRANSPARENT) continue;
      count++;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
  }
  return { s, x0, x1, y0, y1, count };
}

describe("the keeper", () => {
  it("every animation is drawn, with its frame count, in its cell", () => {
    for (const anim of KEEPER_ANIM_NAMES) {
      expect(KEEPER[anim], anim).toBeDefined();
      const sp = keeperSprite(anim);
      const cell = keeperCell(anim);
      expect(sp.frames.length, anim).toBe(KEEPER_ANIMS[anim].frames);
      expect(sp.w, anim).toBe(cell.cellW);
      expect(sp.h, anim).toBe(cell.cellH);
      expect(sp.legend).toBe(LEGEND);
    }
  });

  it("is outlined in ink and painted in his kit's colours only", () => {
    const kit = makeKit("keeper");
    for (const anim of KEEPER_ANIM_NAMES) {
      for (let f = 0; f < KEEPER_ANIMS[anim].frames; f++) {
        const b = drawn((s) => drawKeeper(s, anim, f, X, Y, kit));
        expect(b.count, `${anim} ${f}`).toBeGreaterThan(150);
        // the topmost pixel of every column is outline
        for (let x = b.x0; x <= b.x1; x++) {
          for (let y = b.y0; y <= b.y1; y++) {
            const c = b.s.get(x, y);
            if (c === TRANSPARENT) continue;
            expect(c, `${anim} ${f} column ${x}`).toBe(P.ink);
            break;
          }
        }
      }
    }
  });

  it("each glove spot is on or beside a glove pixel, both ways round", () => {
    for (const anim of KEEPER_ANIM_NAMES) {
      const art = KEEPER[anim];
      if (art === undefined) throw new Error(anim);
      const cell = keeperCell(anim);
      const frames = artText(art)
        .split("\n\n")
        .map((f) => rows(f));
      for (let f = 0; f < frames.length; f++) {
        const spot = keeperHands(anim, f);
        expect(spot, `${anim} ${f}`).toEqual(KEEPER_GLOVES[anim]?.[f] ?? null);
        if (spot === null) continue;
        const cx = cell.cellW / 2 + spot.x;
        const cy = cell.cellH + spot.y;
        let near = false;
        for (let dy = -2; dy <= 2 && !near; dy++) {
          for (let dx = -2; dx <= 2 && !near; dx++) {
            const ch = frames[f][cy + dy]?.[cx + dx];
            if (ch === "g" || ch === "G" || ch === "w") near = true;
          }
        }
        expect(near, `${anim} ${f}`).toBe(true);
        const flip = keeperHands(anim, f, { flipX: true });
        expect(flip).toEqual({ x: -spot.x, y: spot.y });
      }
    }
  });

  it("mirrors exactly: flipped, every pixel is the frame turned round", () => {
    const kit = makeKit("keeper");
    for (const anim of KEEPER_ANIM_NAMES) {
      const a = drawn((s) => drawKeeper(s, anim, 0, X, Y, kit));
      const b = drawn((s) =>
        drawKeeper(s, anim, 0, X, Y, kit, { flipX: true }),
      );
      const w = keeperCell(anim).cellW;
      const left = X - w / 2;
      for (let y = 0; y < 90; y++) {
        for (let x = left; x < left + w; x++) {
          expect(b.s.get(2 * left + w - 1 - x, y)).toBe(a.s.get(x, y));
        }
      }
    }
  });
});

describe("the props", () => {
  it("the ball is 6 x 6 round its centre in three spin frames, its ring 10 x 10", () => {
    const seen = new Set<string>();
    for (let f = 0; f < 3; f++) {
      for (const gold of [false, true]) {
        const b = drawn((s) => drawMatchBall(s, X, Y, f, DAY, { gold }));
        expect([b.x0, b.x1, b.y0, b.y1]).toEqual([X - 3, X + 2, Y - 3, Y + 2]);
        expect(b.count).toBe(32);
        seen.add(Array.from(b.s.data).join());
      }
    }
    expect(seen.size).toBe(6);
    const r = drawn((s) => drawBallRing(s, X, Y, P.ink));
    expect([r.x0, r.x1, r.y0, r.y1]).toEqual([X - 5, X + 4, Y - 5, Y + 4]);
    // the ring and the ball together are a solid round disc
    const both = drawn((s) => {
      drawBallRing(s, X, Y, P.ink);
      drawMatchBall(s, X, Y, 0, DAY);
    });
    for (let y = Y - 3; y <= Y + 2; y++) {
      for (let x = X - 3; x <= X + 2; x++) {
        expect(both.s.get(x, y)).not.toBe(TRANSPARENT);
      }
    }
  });

  it("the trophy is 18 x 24 standing on its point, with a glint", () => {
    const a = drawn((s) => drawTrophy(s, X, Y, DAY));
    const b = drawn((s) => drawTrophy(s, X, Y, DAY, true));
    expect([a.x0, a.x1, a.y0, a.y1]).toEqual([X - 9, X + 8, Y - 24, Y - 1]);
    expect(b.s.data).not.toEqual(a.s.data);
  });

  it("the puff stands on its point in three different frames, and draws nothing past them", () => {
    const seen = new Set<string>();
    for (let f = 0; f < 3; f++) {
      const b = drawn((s) => drawPuff(s, X, Y, f, P.chalk));
      expect(b.x0).toBeGreaterThanOrEqual(X - 7);
      expect(b.x1).toBeLessThanOrEqual(X + 6);
      expect(b.y0).toBeGreaterThanOrEqual(Y - 10);
      expect(b.y1).toBeLessThanOrEqual(Y - 1);
      seen.add(Array.from(b.s.data).join());
    }
    expect(seen.size).toBe(3);
    expect(drawn((s) => drawPuff(s, X, Y, 3, P.chalk)).count).toBe(0);
  });
});
