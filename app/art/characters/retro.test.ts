import { describe, expect, it } from "vitest";
import { lightingFor } from "~/art/lighting";
import { P } from "~/art/palette";
import { Surface, TRANSPARENT } from "~/pixel";
import { artText } from "./figure";
import { ADULT } from "./adult";
import { ADULT_SHOTS } from "./adult-shots";
import { YOUTH } from "./youth";
import { YOUTH_SHOTS } from "./youth-shots";
import { KEEPER } from "./keeper";
import { eraFrames, type FrameWho } from "./era-frames";
import { FETCH_ANIM_NAMES, ballKidKit, fetchSprite } from "./fetch";
import { KIT_BASES, litKit, makeKit } from "./kit";
import {
  KEEPER_ANIM_NAMES,
  PLAYER_ANIM_NAMES,
  keeperSprite,
  playerSprite,
} from "./people";
import { drawBallRing, drawMatchBall, drawTrophy } from "./props";

const DAY = lightingFor({ elevation: 40, morning: false });

/** Fill art split into frames of rows. */
function framesOf(art: string): string[][] {
  return art
    .split(/\n\s*\n/)
    .map((b) =>
      b
        .split("\n")
        .map((r) => r.trim())
        .filter((r) => r !== ""),
    )
    .filter((f) => f.length > 0);
}

const filled = (c: string | undefined): boolean =>
  c !== undefined && c !== "." && c !== ",";

/** Every animation's fill art, by whose. */
function everyArt(): [FrameWho, string, string][] {
  const out: [FrameWho, string, string][] = [];
  const adult = { ...ADULT, ...ADULT_SHOTS } as Record<
    string,
    Parameters<typeof artText>[0]
  >;
  const youth = { ...YOUTH, ...YOUTH_SHOTS } as Record<
    string,
    Parameters<typeof artText>[0]
  >;
  for (const a of PLAYER_ANIM_NAMES) {
    out.push(["adult", a, artText(adult[a])]);
    out.push(["youth", a, artText(youth[a])]);
  }
  for (const a of KEEPER_ANIM_NAMES) {
    const art = KEEPER[a];
    if (art !== undefined) out.push(["keeper", a, artText(art)]);
  }
  return out;
}

describe("RETRO's layer over the people's frames", () => {
  it("keeps every frame's size and feet, adds at most the cap's peak, changes the look", () => {
    for (const [who, anim, art] of everyArt()) {
      const before = framesOf(art);
      const after = framesOf(eraFrames("retro", who, anim, art));
      expect(after.length, `${who} ${anim}`).toBe(before.length);
      let changed = 0;
      before.forEach((rows, f) => {
        const out = after[f];
        expect(out.length).toBe(rows.length);
        let added = 0;
        let lowB = -1;
        let lowA = -1;
        rows.forEach((row, y) => {
          expect(out[y].length).toBe(row.length);
          for (let x = 0; x < row.length; x++) {
            if (filled(out[y][x]) && !filled(row[x])) added++;
            if (out[y][x] !== row[x]) changed++;
            if (filled(row[x])) lowB = y;
            if (filled(out[y][x])) lowA = y;
          }
        });
        // only the keeper's cap may reach a cell past the head; nothing else grows
        expect(added, `${who} ${anim} ${f}`).toBeLessThanOrEqual(
          who === "keeper" ? 1 : 0,
        );
        // the soles stay on their row: every spot and anchor holds
        expect(lowA, `${who} ${anim} ${f}`).toBe(lowB);
      });
      expect(changed, `${who} ${anim}`).toBeGreaterThan(0);
    }
  });

  it("builds every sprite in RETRO, the same size and frames as today's", () => {
    for (const anim of PLAYER_ANIM_NAMES) {
      for (const youth of [false, true]) {
        const a = playerSprite(anim, youth);
        const b = playerSprite(anim, youth, "retro");
        expect([b.w, b.h, b.frames.length]).toEqual([
          a.w,
          a.h,
          a.frames.length,
        ]);
      }
    }
    for (const anim of KEEPER_ANIM_NAMES) {
      const a = keeperSprite(anim);
      const b = keeperSprite(anim, "retro");
      expect([b.w, b.h, b.frames.length]).toEqual([a.w, a.h, a.frames.length]);
    }
    for (const anim of FETCH_ANIM_NAMES) {
      const a = fetchSprite(anim);
      const b = fetchSprite(anim, "retro");
      expect([b.w, b.h, b.frames.length]).toEqual([a.w, a.h, a.frames.length]);
    }
  });

  it("leaves today's art and kits exactly as they were", () => {
    for (const [who, anim, art] of everyArt()) {
      expect(eraFrames("today", who, anim, art)).toBe(art);
    }
    for (const base of KIT_BASES) {
      expect(makeKit(base, { look: 2, variant: 3, era: "today" })).toEqual(
        makeKit(base, { look: 2, variant: 3 }),
      );
    }
    expect(ballKidKit("today")).toEqual(ballKidKit());
  });

  it("fills every era slot of a RETRO kit, graded by litKit", () => {
    for (const base of KIT_BASES) {
      const k = makeKit(base, { era: "retro" });
      expect(k.era).toBe("retro");
      expect(k.eraColors?.length).toBe(8);
      for (const c of k.eraColors ?? []) expect(c).not.toBe(TRANSPARENT);
      const lit = litKit(k, DAY);
      expect(lit.era).toBe("retro");
      expect(lit.eraColors).toEqual(k.eraColors?.map((c) => DAY.lit(c)));
    }
    expect(ballKidKit("retro").era).toBe("retro");
  });

  it("gives the keeper a kit colour nobody else in RETRO wears", () => {
    const keeper = makeKit("keeper", { era: "retro" }).shirt;
    for (const base of KIT_BASES) {
      if (base === "keeper") continue;
      expect(makeKit(base, { era: "retro", variant: 0 }).shirt, base).not.toBe(
        keeper,
      );
    }
  });
});

describe("RETRO's props", () => {
  function box(draw: (s: Surface) => void): number[] {
    const s = new Surface(40, 40);
    s.clear(TRANSPARENT);
    draw(s);
    let x0 = 99;
    let y0 = 99;
    let x1 = -1;
    let y1 = -1;
    for (let y = 0; y < 40; y++) {
      for (let x = 0; x < 40; x++) {
        if (s.get(x, y) === TRANSPARENT) continue;
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
    }
    return [x0, y0, x1, y1];
  }

  it("draws the leather ball on today's 6 x 6 footprint in all three spins", () => {
    for (let f = 0; f < 3; f++) {
      for (const gold of [false, true]) {
        const a = box((s) => drawMatchBall(s, 20, 20, f, DAY, { gold }));
        const b = box((s) =>
          drawMatchBall(s, 20, 20, f, DAY, { gold, era: "retro" }),
        );
        expect(b).toEqual(a);
      }
    }
    const ring = box((s) => drawBallRing(s, 20, 20, P.ink));
    expect(ring).toEqual([15, 15, 24, 24]);
  });

  it("stands the cup where today's trophy stands", () => {
    for (const glint of [false, true]) {
      const a = box((s) => drawTrophy(s, 20, 30, DAY, glint));
      const b = box((s) => drawTrophy(s, 20, 30, DAY, glint, "retro"));
      expect(b).toEqual(a);
    }
  });
});
