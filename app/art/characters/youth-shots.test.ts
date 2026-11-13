import { describe, expect, it } from "vitest";
import { Surface, TRANSPARENT } from "~/pixel";
import { P } from "../palette";
import { LEGEND, artText } from "./figure";
import { makeKit } from "./kit";
import {
  PLAYER_ANIMS,
  STRIKE_FRAME,
  ballSpot,
  drawPlayer,
  playerCell,
  playerSprite,
  type ShotAnim,
} from "./people";
import {
  YOUTH_SHOTS,
  YOUTH_SHOT_BALL,
  YOUTH_SHOT_POSES,
  youthShotArt,
} from "./youth-shots";
import { YOUTH_BALL } from "./people";

type Shot = Exclude<ShotAnim, "kick">;
const SHOTS = Object.keys(YOUTH_SHOT_POSES) as Shot[];

/** The frames of a shot's art as rows of letters. */
function framesOf(anim: Shot): string[][] {
  return youthShotArt(anim)
    .split("\n\n")
    .map((f) => f.split("\n"));
}

const cell = (anim: Shot) => playerCell(anim, true);

// The ball (6 x 6 in a 1 px ink ring), centred on its spot.
const RING = [
  "..kkkk..",
  ".kwwwmk.",
  "kwwddwmk",
  "kwddddmk",
  "kwwddmmk",
  "kmmmmmdk",
  ".kmdmmk.",
  "..kkkk..",
];

/** The cells the ball covers, ring included, at a spot (cell coordinates). */
function ballCells(
  anim: Shot,
  spot: { x: number; y: number },
): [number, number][] {
  const { cellW, cellH } = cell(anim);
  const cx = Math.floor(cellW / 2) + spot.x;
  const cy = cellH + spot.y;
  const out: [number, number][] = [];
  RING.forEach((row, j) => {
    for (let i = 0; i < 8; i++) {
      if (row[i] !== ".") out.push([cx - 4 + i, cy - 4 + j]);
    }
  });
  return out;
}

describe("the youth shots", () => {
  it("are all drawn", () => {
    for (const anim of SHOTS) {
      expect(YOUTH_SHOTS[anim], anim).toBeDefined();
    }
  });

  it("have the animation's frames, in the youth's cell (the bicycle 40 x 44)", () => {
    for (const anim of SHOTS) {
      const { cellW, cellH } = cell(anim);
      expect([cellW, cellH]).toEqual(anim === "bicycle" ? [40, 44] : [28, 32]);
      const art = YOUTH_SHOTS[anim];
      expect(art).toBeDefined();
      const frames = artText(art!).split("\n\n");
      expect(frames.length, anim).toBe(PLAYER_ANIMS[anim].frames);
      for (const f of frames) {
        const rows = f.split("\n");
        expect(rows.length, anim).toBe(cellH);
        for (const r of rows) expect(r.length, anim).toBe(cellW);
      }
      const sp = playerSprite(anim, true);
      expect([sp.w, sp.h], anim).toEqual([cellW, cellH]);
      expect(sp.frames.length, anim).toBe(PLAYER_ANIMS[anim].frames);
    }
  });

  it("use only the legend's letters, and never the gloves' slot", () => {
    for (const anim of SHOTS) {
      for (const f of framesOf(anim)) {
        for (const ch of f.join("")) {
          if (ch === ".") continue;
          expect(LEGEND.includes(ch), `${anim} "${ch}"`).toBe(true);
          expect("gGw".includes(ch), `${anim} "${ch}"`).toBe(false);
        }
      }
    }
  });

  it("keep a free column and row round the fill for the outline", () => {
    for (const anim of SHOTS) {
      const { cellW, cellH } = cell(anim);
      framesOf(anim).forEach((rows, f) => {
        rows.forEach((row, y) => {
          for (let x = 0; x < cellW; x++) {
            if (row[x] === ".") continue;
            const edge =
              x === 0 || y === 0 || x === cellW - 1 || y === cellH - 1;
            expect(edge, `${anim} ${f} at ${x},${y}`).toBe(false);
          }
        });
      });
    }
  });

  it("stand on the soles' row (row cellH - 2) on every frame with a foot down, and never below", () => {
    // Off the ground: the power shot's follow-through, the bicycle in the air.
    const AIR: Partial<Record<Shot, readonly number[]>> = {
      power: [3],
      bicycle: [2, 3, 4, 5],
    };
    for (const anim of SHOTS) {
      const { cellH } = cell(anim);
      framesOf(anim).forEach((rows, f) => {
        let low = -1;
        rows.forEach((row, y) => {
          if (/[^.]/.test(row)) low = y;
        });
        expect(low, `${anim} ${f}`).toBeLessThanOrEqual(cellH - 2);
        if (!(AIR[anim] ?? []).includes(f)) {
          expect(low, `${anim} ${f}`).toBe(cellH - 2);
        }
      });
    }
  });

  it("are shorter than the adult's: the head's top on row 5 when he stands", () => {
    for (const anim of SHOTS) {
      if (anim === "bicycle") continue;
      const last = framesOf(anim).at(-1)!;
      const top = last.findIndex((row) => /[^.]/.test(row));
      expect(top, anim).toBe(5);
    }
  });

  it("are outlined in the kit's outline colour, both ways round", () => {
    const kit = makeKit("home");
    for (const anim of SHOTS) {
      const { cellW, cellH } = cell(anim);
      for (const flipX of [false, true]) {
        for (let f = 0; f < PLAYER_ANIMS[anim].frames; f++) {
          const s = new Surface(cellW + 4, cellH + 4);
          s.clear(TRANSPARENT);
          drawPlayer(s, anim, f, 2 + cellW / 2, 2 + cellH, kit, {
            youth: true,
            flipX,
          });
          let drawn = 0;
          for (let y = 0; y < s.h; y++) {
            for (let x = 0; x < s.w; x++) {
              const c = s.get(x, y);
              if (c === TRANSPARENT) continue;
              drawn++;
              const open = [
                [x - 1, y],
                [x + 1, y],
                [x, y - 1],
                [x, y + 1],
              ].some(([nx, ny]) => s.get(nx, ny) === TRANSPARENT);
              if (open) expect(c, `${anim} ${f} at ${x},${y}`).toBe(P.ink);
            }
          }
          expect(drawn, `${anim} ${f}`).toBeGreaterThan(150);
        }
      }
    }
  });

  it("put the boot exactly on the ball on the strike frame, and nothing on it before", () => {
    for (const anim of SHOTS) {
      const spots = YOUTH_SHOT_BALL[anim];
      expect(spots.length, anim).toBe(PLAYER_ANIMS[anim].frames);
      expect(spots[STRIKE_FRAME[anim]], anim).not.toBeNull();
      spots.forEach((s, f) => {
        expect(s === null, `${anim} ${f}`).toBe(f > STRIKE_FRAME[anim]);
      });
      const frames = framesOf(anim);
      spots.forEach((spot, f) => {
        if (spot === null) return;
        const rows = frames[f];
        const at = (x: number, y: number) => rows[y]?.[x] ?? ".";
        const ball = ballCells(anim, spot);
        const inBall = new Set(ball.map(([x, y]) => `${x},${y}`));
        let overlap = 0;
        let touch = 0;
        let boot = 0;
        for (const [x, y] of ball) {
          if (at(x, y) !== ".") overlap++;
          for (const [nx, ny] of [
            [x - 1, y],
            [x + 1, y],
            [x, y - 1],
            [x, y + 1],
          ]) {
            if (inBall.has(`${nx},${ny}`)) continue;
            const ch = at(nx, ny);
            if (ch === ".") continue;
            touch++;
            if (ch === "b" || ch === "B") boot++;
          }
        }
        expect(overlap, `${anim} ${f}: overlaps the ball`).toBe(0);
        if (f === STRIKE_FRAME[anim]) {
          expect(boot, `${anim} ${f}: the boot meets the ball`).toBeGreaterThan(
            0,
          );
          expect(touch, `${anim} ${f}: only the boot meets it`).toBe(boot);
        } else {
          expect(touch, `${anim} ${f}: nothing touches the ball yet`).toBe(0);
        }
      });
    }
  });

  it("rest the ball where the adult's kick does (the scene's ball)", () => {
    const kick = ballSpot("kick", 0);
    expect(kick).toEqual({ x: 14, y: -4 });
    for (const anim of SHOTS) {
      if (anim === "bicycle") continue;
      expect(YOUTH_SHOT_BALL[anim][0], anim).toEqual(kick);
    }
  });

  it("give the scene the spots the art was drawn to", () => {
    for (const anim of SHOTS) {
      expect(YOUTH_BALL[anim], anim).toBeDefined();
      YOUTH_SHOT_BALL[anim].forEach((s, f) => {
        const got = ballSpot(anim, f, { youth: true });
        expect(got, `${anim} ${f}`).toEqual(s);
        const flipped = ballSpot(anim, f, { youth: true, flipX: true });
        if (got === null) expect(flipped).toBeNull();
        else expect(flipped, `${anim} ${f}`).toEqual({ x: -got.x, y: got.y });
      });
    }
  });

  it("give every frame of a shot its own pose", () => {
    for (const anim of SHOTS) {
      const frames = framesOf(anim).map((f) => f.join("\n"));
      expect(new Set(frames).size, anim).toBe(frames.length);
    }
  });

  it("paint the same pixels every time", () => {
    for (const anim of SHOTS)
      expect(youthShotArt(anim)).toBe(youthShotArt(anim));
  });
});
