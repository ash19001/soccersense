/**
 * The youth's moves and spots: the invariants people.test.ts pins for the adult, at the
 * youth's size, plus the child keeper's gloves and the spots' contact.
 */

import { describe, expect, it } from "vitest";
import { Surface, TRANSPARENT, type Color } from "~/pixel";
import { castSpots } from "~/scenes/career-cast";
import { LEGEND } from "./figure";
import { KIT_BASES, kitColors, makeKit, type Kit } from "./kit";
import {
  KICK_STRIKE_FRAME,
  PLAYER_ANIMS,
  ballSpot,
  drawPlayer,
  handsSpot,
  playerCell,
  playerSprite,
  type PlayerAnim,
} from "./people";
import { YOUTH } from "./youth";
import { YOUTH_SHOT_BALL } from "./youth-shots";
import { YOUTH_BALL, YOUTH_HANDS } from "./people";

const MOVES: readonly PlayerAnim[] = [
  "idle",
  "run",
  "kick",
  "juggle",
  "celebrate",
  "dejected",
  "lift",
  "shrug",
  "slide",
];

const KIT = makeKit("casual-home", { variant: 1 });
const X = 40;
const Y = 50;

function painted(s: Surface): [number, number][] {
  const out: [number, number][] = [];
  for (let y = 0; y < s.h; y++) {
    for (let x = 0; x < s.w; x++) {
      if (s.get(x, y) !== TRANSPARENT) out.push([x, y]);
    }
  }
  return out;
}

function drawn(
  anim: PlayerAnim,
  f: number,
  opts: { kit?: Kit; flipX?: boolean } = {},
) {
  const s = new Surface(80, 60);
  drawPlayer(s, anim, f, X, Y, opts.kit ?? KIT, {
    youth: true,
    flipX: opts.flipX,
  });
  const px = painted(s);
  return {
    s,
    count: px.length,
    x0: Math.min(...px.map(([x]) => x)),
    x1: Math.max(...px.map(([x]) => x)),
    y0: Math.min(...px.map(([, y]) => y)),
    y1: Math.max(...px.map(([, y]) => y)),
  };
}

function has(s: Surface, c: Color): boolean {
  return painted(s).some(([x, y]) => s.get(x, y) === c);
}

describe("the youth's moves", () => {
  it("are all drawn, with their frame counts, in the youth's cell and the legend", () => {
    for (const anim of MOVES) {
      expect(YOUTH[anim], anim).toBeDefined();
      const sp = playerSprite(anim, true);
      const cell = playerCell(anim, true);
      expect(sp.frames.length, anim).toBe(PLAYER_ANIMS[anim].frames);
      expect([sp.w, sp.h], anim).toEqual([28, 32]);
      expect([cell.cellW, cell.cellH]).toEqual([28, 32]);
      expect(sp.legend).toBe(LEGEND);
    }
  });

  it("every frame stays inside the 28 x 32 cell, both ways round", () => {
    for (const anim of MOVES) {
      for (let f = 0; f < PLAYER_ANIMS[anim].frames; f++) {
        for (const flipX of [false, true]) {
          const b = drawn(anim, f, { flipX });
          const tag = `${anim} ${f} ${flipX}`;
          expect(b.count, tag).toBeGreaterThan(150);
          expect(b.x0, tag).toBeGreaterThanOrEqual(X - 14);
          expect(b.x1, tag).toBeLessThan(X + 14);
          expect(b.y0, tag).toBeGreaterThanOrEqual(Y - 32);
          expect(b.y1, tag).toBeLessThan(Y);
        }
      }
    }
  });

  it("stands on the ground row y - 1, and is in the air on the celebration's jump", () => {
    const air: Partial<Record<PlayerAnim, number[]>> = {
      run: [1, 3],
      celebrate: [1],
    };
    for (const anim of MOVES) {
      for (let f = 0; f < PLAYER_ANIMS[anim].frames; f++) {
        if (air[anim]?.includes(f)) continue;
        expect(drawn(anim, f).y1, `${anim} ${f}`).toBe(Y - 1);
      }
    }
    expect(drawn("celebrate", 1).y1).toBeLessThan(Y - 2);
  });

  it("is 28 rows tall standing (the youth's 20 x 28), give or take his outline", () => {
    const two = drawn("idle", 0);
    const h2 = two.y1 - two.y0 + 1;
    expect(h2).toBeGreaterThanOrEqual(28 - 2);
    expect(h2).toBeLessThanOrEqual(28 + 2);
  });

  it("is outlined in the kit's outline colour and painted in kit colours only", () => {
    const soles = painted(drawn("idle", 0).s).filter(([, y]) => y === Y - 1);
    expect(soles.length).toBeGreaterThan(6);
    for (const base of KIT_BASES) {
      for (const look of [(KIT_BASES.indexOf(base) % 3) as 0 | 1 | 2]) {
        const kit = makeKit(base, { look, variant: look });
        const allowed = new Set<Color>(kitColors(kit));
        for (const anim of MOVES) {
          for (let f = 0; f < PLAYER_ANIMS[anim].frames; f++) {
            const { s } = drawn(anim, f, { kit });
            for (const [x, y] of painted(s)) {
              expect(allowed.has(s.get(x, y)), `${base} ${anim} ${f}`).toBe(
                true,
              );
            }
          }
        }
      }
    }
    const { s } = drawn("idle", 0);
    for (const [x, y] of painted(s).filter(([, y]) => y === Y - 1)) {
      expect(s.get(x, y)).toBe(KIT.outline);
    }
  });

  it("the child keeper wears his gloves on every frame but the bare-handed ones", () => {
    const keeper = makeKit("keeper", { look: 0, variant: 2 });
    const bare: Partial<Record<PlayerAnim, number[]>> = {
      kick: [0, 1, 2, 3, 4],
      juggle: [2],
      lift: [0, 1],
      slide: [0, 1],
    };
    let gloved = 0;
    for (const anim of MOVES) {
      for (let f = 0; f < PLAYER_ANIMS[anim].frames; f++) {
        const want = bare[anim]?.includes(f) !== true;
        const two = has(drawn(anim, f, { kit: keeper }).s, keeper.gloves);
        expect(two, `${anim} ${f}`).toBe(want);
        if (want) gloved++;
      }
    }
    expect(gloved).toBeGreaterThan(15);
  });

  it("frames of a move differ from each other", () => {
    for (const anim of MOVES) {
      const seen = new Set<string>();
      for (let f = 0; f < PLAYER_ANIMS[anim].frames; f++) {
        seen.add(drawn(anim, f).s.data.join());
      }
      const want =
        anim === "juggle" ? 5 : anim === "run" ? 4 : PLAYER_ANIMS[anim].frames;
      expect(seen.size, anim).toBeGreaterThanOrEqual(want);
    }
  });

  it("mirrors pixel for pixel and draws the same pixels for the same inputs", () => {
    for (const anim of MOVES) {
      for (let f = 0; f < PLAYER_ANIMS[anim].frames; f++) {
        const a = drawn(anim, f).s;
        const b = drawn(anim, f, { flipX: true }).s;
        for (let y = Y - 32; y < Y; y++) {
          for (let dx = -14; dx < 14; dx++) {
            expect(b.get(X - dx - 1, y)).toBe(a.get(X + dx, y));
          }
        }
        expect(drawn(anim, f).s.data.join()).toBe(a.data.join());
      }
    }
  });
});

describe("the youth's spots", () => {
  const kid = { youth: true } as const;

  /** Pixels of `colors` in the 6 x 6 ball on the spot, or `r` px round it (r 1: its ring). */
  function near(
    s: Surface,
    spot: { x: number; y: number },
    colors: readonly Color[] | null,
    r = 1,
  ): number {
    let n = 0;
    for (let dy = -3 - r; dy <= 2 + r; dy++) {
      for (let dx = -3 - r; dx <= 2 + r; dx++) {
        const c = s.get(X + spot.x + dx, Y + spot.y + dy);
        if (c === TRANSPARENT) continue;
        if (colors === null || colors.includes(c)) n++;
      }
    }
    return n;
  }

  it("the table holds B2's shots as they are", () => {
    for (const [anim, list] of Object.entries(YOUTH_SHOT_BALL)) {
      expect(YOUTH_BALL[anim as PlayerAnim], anim).toEqual(list);
    }
  });

  it("the kick's ball rests where the adult's does, untouched until the near boot meets it", () => {
    for (let f = 0; f <= KICK_STRIKE_FRAME; f++) {
      expect(ballSpot("kick", f, kid)).toEqual({ x: 14, y: -4 });
      expect(ballSpot("kick", f, kid)).toEqual(ballSpot("kick", f));
    }
    expect(ballSpot("kick", 3, kid)).toBeNull();
    const spot = ballSpot("kick", KICK_STRIKE_FRAME, kid)!;
    expect(near(drawn("kick", 0).s, spot, null)).toBe(0);
    expect(near(drawn("kick", 1).s, spot, null)).toBe(0);
    const strike = drawn("kick", KICK_STRIKE_FRAME).s;
    expect(near(strike, spot, [KIT.boots])).toBeGreaterThan(0);
  });

  it("the juggle's ball is on his boot, knee and crown on the touches, and clear of him between", () => {
    const body = [KIT.boots, KIT.skin, KIT.hair];
    for (let f = 0; f < PLAYER_ANIMS.juggle.frames; f++) {
      const spot = ballSpot("juggle", f, kid)!;
      expect(spot, `${f}`).not.toBeNull();
      const { s } = drawn("juggle", f);
      if (f % 2 === 0) {
        expect(near(s, spot, body), `${f}`).toBeGreaterThan(0);
        // resting on him, not sunk into him: nothing of him inside the ball's middle
        expect(near(s, { x: spot.x, y: spot.y - 1 }, null, -2), `${f}`).toBe(0);
      } else {
        expect(near(s, spot, null, 0), `${f}`).toBe(0);
      }
    }
  });

  it("the lift's fists are on the row the held thing stands on, one each side of it", () => {
    for (let f = 0; f < PLAYER_ANIMS.lift.frames; f++) {
      const h = handsSpot("lift", f, kid)!;
      expect(h).toEqual(YOUTH_HANDS.lift![f]);
      const { s } = drawn("lift", f);
      const row = Y + h.y - 1;
      const skin = (x: number) =>
        [KIT.skin, KIT.skinShade].includes(s.get(x, row));
      let left = false;
      let right = false;
      for (let dx = -10; dx < 0; dx++) left ||= skin(X + h.x + dx);
      for (let dx = 1; dx <= 10; dx++) right ||= skin(X + h.x + dx);
      expect(left && right, `${f}`).toBe(true);
      // and nothing of him above that row between the fists (the thing has room)
      for (let y = Y - 32; y < row; y++) {
        for (let dx = -2; dx <= 2; dx++) {
          expect(s.get(X + h.x + dx, y)).toBe(TRANSPARENT);
        }
      }
    }
  });

  it("flipX mirrors the spots at -dx", () => {
    for (const anim of MOVES) {
      for (let f = 0; f < PLAYER_ANIMS[anim].frames; f++) {
        for (const get of [ballSpot, handsSpot]) {
          const a = get(anim, f, kid);
          const b = get(anim, f, { ...kid, flipX: true });
          if (a === null) expect(b).toBeNull();
          else expect(b).toEqual({ x: -a.x, y: a.y });
        }
      }
    }
  });

  it("the career cast reads them: the youth half of its juggle and lift", () => {
    const two = castSpots();
    for (let f = 0; f < 8; f++) {
      const s = ballSpot("juggle", f, kid)!;
      expect(two.JUGGLE_X[8 + f]).toBe(s.x);
      expect(two.JUGGLE_Y[8 + f]).toBe(s.y);
    }
    for (let f = 0; f < 2; f++) {
      const h = handsSpot("lift", f, kid)!;
      expect(two.LIFT[4 + f * 2]).toBe(h.x);
      expect(two.LIFT[4 + f * 2 + 1]).toBe(h.y);
    }
  });
});
