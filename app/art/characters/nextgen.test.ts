import { describe, expect, it } from "vitest";
import { Surface, TRANSPARENT } from "~/pixel";
import { lightingFor } from "../lighting";
import { P } from "../palette";
import { ADULT } from "./adult";
import { ADULT_SHOTS } from "./adult-shots";
import { eraFrames, type FrameWho } from "./era-frames";
import { FETCH_ANIM_NAMES, drawFetch, fetchSprite } from "./fetch";
import { artText, type FrameArt } from "./figure";
import { KEEPER } from "./keeper";
import { KIT_BASES, litKit, makeKit } from "./kit";
import { NEXTGEN_TRAIL, nextgenKit } from "./nextgen";
import {
  KEEPER_ANIM_NAMES,
  PLAYER_ANIM_NAMES,
  drawKeeper,
  drawPlayer,
  keeperSprite,
  playerSprite,
} from "./people";
import { drawMatchBall, drawTrophy } from "./props";
import { YOUTH } from "./youth";
import { YOUTH_SHOTS } from "./youth-shots";

const DAY = lightingFor({ elevation: 40, morning: false });
const NIGHT = lightingFor({ elevation: -30, morning: false });

const ARTS: [FrameWho, Partial<Record<string, FrameArt>>][] = [
  ["adult", { ...ADULT, ...ADULT_SHOTS }],
  ["youth", { ...YOUTH, ...YOUTH_SHOTS }],
  ["keeper", KEEPER],
];

/** Which cells of the fill art are filled ("." and "," are empty). */
function filled(art: string): string {
  return art.replace(/[^.,\n]/g, "#").replace(/,/g, ".");
}

/** The pixels a draw covers, as a string of 0/1. */
function coverage(draw: (s: Surface) => void, w = 80, h = 80): string {
  const s = new Surface(w, h);
  draw(s);
  let out = "";
  for (let i = 0; i < s.data.length; i++) out += s.data[i] === 0 ? "0" : "1";
  return out;
}

describe("NEXT-GEN's layer over the frames", () => {
  for (const [who, art] of ARTS) {
    it(`keeps every ${who} frame's silhouette and writes only era letters`, () => {
      for (const [anim, a] of Object.entries(art)) {
        if (a === undefined) continue;
        const today = artText(a);
        const ng = eraFrames("nextgen", who, anim, today);
        expect(filled(ng.trim())).toBe(
          filled(
            today
              .split("\n")
              .map((r) => r.trim())
              .join("\n")
              .replace(/\n{3,}/g, "\n\n")
              .trim(),
          ),
        );
        // the visor, the glows: only cells NEXT-GEN owns change, into its letters
        expect(ng).toMatch(/[5678]/);
      }
    });
  }

  it("puts a visor on every frame of the moves that shows a face", () => {
    for (const anim of ["idle", "run", "juggle", "kick"] as const) {
      const ng = eraFrames("nextgen", "adult", anim, artText(ADULT[anim]!));
      for (const frame of ng.split("\n\n")) expect(frame).toMatch(/7/);
    }
  });

  it("builds every sprite in NEXT-GEN, the same size as today's", () => {
    for (const anim of PLAYER_ANIM_NAMES) {
      for (const youth of [false, true]) {
        const a = playerSprite(anim, youth, "today");
        const b = playerSprite(anim, youth, "nextgen");
        expect([b.w, b.h, b.frames.length]).toEqual([
          a.w,
          a.h,
          a.frames.length,
        ]);
      }
    }
    for (const anim of KEEPER_ANIM_NAMES) {
      const a = keeperSprite(anim, "today");
      const b = keeperSprite(anim, "nextgen");
      expect([b.w, b.h, b.frames.length]).toEqual([a.w, a.h, a.frames.length]);
    }
    for (const anim of FETCH_ANIM_NAMES) {
      const a = fetchSprite(anim, "today");
      const b = fetchSprite(anim, "nextgen");
      expect([b.w, b.h, b.frames.length]).toEqual([a.w, a.h, a.frames.length]);
    }
  });

  it("draws every person over exactly the pixels today's does", () => {
    const home = litKit(makeKit("home"), DAY);
    const ng = litKit(makeKit("home", { era: "nextgen" }), DAY);
    const keeper = litKit(makeKit("keeper"), DAY);
    const ngKeeper = litKit(makeKit("keeper", { era: "nextgen" }), DAY);
    for (const anim of PLAYER_ANIM_NAMES) {
      for (const youth of [false, true]) {
        for (let f = 0; f < 8; f++) {
          expect(
            coverage((s) => drawPlayer(s, anim, f, 40, 70, ng, { youth })),
          ).toBe(
            coverage((s) => drawPlayer(s, anim, f, 40, 70, home, { youth })),
          );
        }
      }
    }
    for (const anim of KEEPER_ANIM_NAMES) {
      for (let f = 0; f < 3; f++) {
        expect(coverage((s) => drawKeeper(s, anim, f, 40, 70, ngKeeper))).toBe(
          coverage((s) => drawKeeper(s, anim, f, 40, 70, keeper)),
        );
      }
    }
    for (const anim of FETCH_ANIM_NAMES) {
      for (let f = 0; f < 4; f++) {
        expect(coverage((s) => drawFetch(s, anim, f, 40, 70, ngKeeper))).toBe(
          coverage((s) => drawFetch(s, anim, f, 40, 70, keeper)),
        );
      }
    }
  });
});

describe("NEXT-GEN's kits", () => {
  it("leaves today's kits as they were", () => {
    for (const base of KIT_BASES) {
      const k = makeKit(base);
      expect(k.era).toBeUndefined();
      expect(k.eraGlows).toBeUndefined();
      expect(makeKit(base, { era: "today" })).toEqual(k);
    }
  });

  it("gives every base its era, a visor strap and four lights", () => {
    for (const base of KIT_BASES) {
      const k = makeKit(base, { era: "nextgen", variant: 3 });
      expect(k.era).toBe("nextgen");
      expect(k.eraColors).toHaveLength(1);
      expect(k.eraGlows).toHaveLength(4);
      for (const c of k.eraGlows ?? []) expect(c).not.toBe(TRANSPARENT);
      // the same skin and hair as today's
      const t = makeKit(base, { variant: 3 });
      expect([k.skin, k.hair]).toEqual([t.skin, t.hair]);
      expect(nextgenKit(base, t, 3)).toEqual(k);
    }
  });

  it("keeps the lights raw at night and grades the rest", () => {
    const k = makeKit("rival", { era: "nextgen" });
    const lit = litKit(k, NIGHT);
    expect(lit.eraGlows).toEqual(k.eraGlows);
    expect(lit.era).toBe("nextgen");
  });

  it("dresses the sides apart: hero magenta, rivals dark, keeper gold", () => {
    const hero = makeKit("home", { era: "nextgen" });
    const rival = makeKit("rival", { era: "nextgen" });
    const keeper = makeKit("keeper", { era: "nextgen" });
    expect(hero.shirt).toBe(P.nextgen);
    expect(rival.shirt).not.toBe(hero.shirt);
    expect(keeper.shirt).toBe(P.gold);
    expect(keeper.gloves).toBe(P.ledGreen);
  });
});

describe("NEXT-GEN's props", () => {
  it("draws the ball over the same 6 x 6 as today's, every spin frame", () => {
    for (let f = 0; f < 3; f++) {
      for (const gold of [false, true]) {
        expect(
          coverage((s) =>
            drawMatchBall(s, 20, 20, f, DAY, { gold, era: "nextgen" }),
          ),
        ).toBe(coverage((s) => drawMatchBall(s, 20, 20, f, DAY, { gold })));
      }
    }
  });

  it("stands the trophy in today's 18 x 24 box, its flare over the rim by night", () => {
    for (const light of [DAY, NIGHT]) {
      for (const glint of [false, true]) {
        const s = new Surface(40, 40);
        drawTrophy(s, 20, 30, light, glint, "nextgen");
        for (let y = 0; y < 40; y++) {
          for (let x = 0; x < 40; x++) {
            if (s.get(x, y) === TRANSPARENT) continue;
            if (y < 6) {
              // the flare: by night only, 3 rows over the light line
              expect(light).toBe(NIGHT);
              expect(y).toBeGreaterThanOrEqual(3);
              expect(Math.abs(x - 19.5)).toBeLessThanOrEqual(2);
              continue;
            }
            expect(x).toBeGreaterThanOrEqual(11);
            expect(x).toBeLessThanOrEqual(28);
            expect(y).toBeLessThanOrEqual(29);
          }
        }
      }
    }
    const s = new Surface(40, 40);
    drawTrophy(s, 20, 30, NIGHT, false, "nextgen");
    expect(s.get(19, 5)).toBe(P.white);
  });

  it("makes the trophy a gold cup, never the ball's white and magenta", () => {
    const s = new Surface(40, 40);
    drawTrophy(s, 20, 30, NIGHT, false, "nextgen");
    const seen = new Set<number>();
    for (let i = 0; i < s.data.length; i++) seen.add(s.data[i]);
    // gold (lit), a line of cyan light; no magenta outside the plinth's ring
    expect(seen.has(NIGHT.lit(P.gold))).toBe(true);
    expect(seen.has(P.awayLight)).toBe(true);
    for (let y = 6; y < 26; y++) {
      for (let x = 11; x <= 28; x++) {
        expect(s.get(x, y)).not.toBe(P.nextgen);
        expect(s.get(x, y)).not.toBe(P.nextgenLight);
      }
    }
  });

  it("draws the referee as a man in black with a visor, like the cast", () => {
    const kit = makeKit("referee", { era: "nextgen" });
    expect(kit.shirt).toBe(P.night);
    expect(kit.eraGlows?.[2]).toBe(P.awayLight);
  });

  it("has a trail of light that fades from white", () => {
    expect(NEXTGEN_TRAIL[0]).toBe(P.white);
    expect(NEXTGEN_TRAIL.length).toBeGreaterThan(3);
  });
});
