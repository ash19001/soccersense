/**
 * Package T: the scenery's sprites (stadium-things.ts), the sky's (sky.ts), and the home
 * picture built a slice a frame after a change of light (stadium-town.ts `paintTown`,
 * `advanceTown`).
 */

import { describe, expect, it } from "vitest";
import { Surface, type Color } from "~/pixel";
import { menuLayout } from "~/art/layout";
import { lightingFor } from "~/art/lighting";
import { P } from "~/art/palette";
import { cloudSprite, drawSky, moonPosition } from "~/art/sky";
import { MenuBackdrop } from "~/art/stadium";
import { clubLight, DEFAULT_SCHEME } from "~/art/stadium-club";
import { NEAR_H } from "~/art/stadium-people";
import {
  advanceTown,
  paintTown,
  townPending,
  type Town,
} from "~/art/stadium-town";
import {
  bush,
  conifer,
  drawBin,
  drawBollard,
  drawChimney,
  drawDoor,
  drawFlag,
  drawLamp,
  drawParasol,
  drawPuff,
  drawTinyPlayer,
  drawWindow,
  lampHeight,
  tree,
  type LampLook,
  type TreeLook,
} from "~/art/stadium-things";
import { makeView } from "~/art/stadium-view";

const K: TreeLook = {
  dark: P.grassDeep,
  base: P.grassDark,
  light: P.grass,
  hi: P.grassLight,
};
const GROUND = P.concrete;

/** A grey square to stand things on, so shadows show and nothing is lost. */
function ground(w = 64, h = 64): Surface {
  const s = new Surface(w, h);
  s.clear(GROUND);
  return s;
}

/** The box of everything not the ground colour (or a darkened ground, a shadow). */
function box(
  s: Surface,
  ignore: readonly number[] = [],
): {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
} {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let y = 0; y < s.h; y++) {
    for (let x = 0; x < s.w; x++) {
      const c = s.get(x, y);
      if (c === GROUND || ignore.includes(c)) continue;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  }
  return { x0, y0, x1, y1 };
}

function colours(s: Surface): Set<number> {
  return new Set(s.data);
}

function same(a: Surface, b: Surface): boolean {
  if (a.w !== b.w || a.h !== b.h) return false;
  for (let i = 0; i < a.data.length; i++)
    if (a.data[i] !== b.data[i]) return false;
  return true;
}

/** The ground's shadow colour (stadium-things.ts darkens what is there). */
function shadowOf(): number {
  const s = ground(8, 8);
  tree(s, 2, 6, 1, K);
  return s.get(6, 6);
}

describe("scenery", () => {
  const shadow = shadowOf();
  const allowed = new Set<number>([
    GROUND,
    shadow,
    K.dark,
    K.base,
    K.light,
    K.hi,
  ]);

  it.each([0, 1, 2] as const)(
    "trees, conifers and bushes of class %i stand on row y - 1, in their own tones",
    (cls) => {
      for (const [name, draw] of [
        ["tree", (s: Surface) => tree(s, 30, 50, cls, K)],
        ["big tree", (s: Surface) => tree(s, 30, 50, cls, K, true)],
        ["conifer", (s: Surface) => conifer(s, 30, 50, cls, K)],
        ["bush", (s: Surface) => bush(s, 30, 50, cls, K)],
      ] as const) {
        const s = ground();
        draw(s);
        for (const c of colours(s)) {
          expect(allowed.has(c), `${name} ${cls}: ${c.toString(16)}`).toBe(
            true,
          );
        }
        // standing on the ground point's row above it
        expect(box(s, [shadow]).y1, `${name} ${cls}`).toBe(49);
      }
    },
  );

  it("draws the same tree in the same place every time", () => {
    const a = ground();
    const b = ground();
    tree(a, 30, 50, 2, K, true);
    tree(b, 30, 50, 2, K, true);
    expect(same(a, b)).toBe(true);
  });
});

describe("street lamps", () => {
  const look: LampLook = {
    post: P.steel,
    postShade: P.slate,
    cap: P.night,
    glow: P.goldLight,
    night: true,
  };

  it("stand two and a half times as tall as the people under them", () => {
    expect(lampHeight(2, true)).toBeGreaterThanOrEqual(2.5 * NEAR_H);
    expect(lampHeight(2, false)).toBeGreaterThanOrEqual(2.2 * NEAR_H);
    // the middle class: a person is 6 px (stadium-people.ts)
    expect(lampHeight(1, true)).toBeGreaterThanOrEqual(2.5 * 6);
    expect(lampHeight(1, false)).toBeGreaterThanOrEqual(2.2 * 6);
  });

  it.each([0, 1, 2] as const)(
    "of class %i stand on row y - 1 and reach their height, in their own colours",
    (cls) => {
      for (const tall of [true, false]) {
        for (const right of [true, false]) {
          const s = ground();
          drawLamp(s, 30, 60, cls, tall, look, right);
          const b = box(s);
          expect(b.y1).toBe(59);
          // the top of the post is the lamp's height above the ground (a lantern's cap
          // rises a little higher)
          expect(60 - b.y0).toBeGreaterThanOrEqual(lampHeight(cls, tall));
          expect(60 - b.y0).toBeLessThanOrEqual(lampHeight(cls, tall) + 6);
          const ok = new Set<Color>([
            GROUND,
            look.post,
            look.postShade,
            look.cap,
            look.glow,
          ]);
          for (const c of colours(s)) expect(ok.has(c as Color)).toBe(true);
          // the post is on columns 30 and 31 (two wide from the middle class on)
          expect(s.get(30, 57)).not.toBe(GROUND);
          if (cls > 0) expect(s.get(31, 57)).not.toBe(GROUND);
        }
      }
    },
  );
});

describe("the life's sprites", () => {
  it("flags fly from the top of their two-pixel pole, in their own colours", () => {
    for (const big of [true, false]) {
      for (let step = 0; step < 4; step++) {
        const s = ground();
        drawFlag(s, 20, 50, 20, big, step, P.home, P.chalk, P.steelHi, P.mist);
        const b = box(s);
        expect(b.y1).toBe(49);
        expect(b.x0).toBe(20);
        expect(b.x1).toBe(big ? 33 : 27);
        expect(b.y0).toBeGreaterThanOrEqual(29);
        expect(b.y0).toBeLessThanOrEqual(31);
        const ok = new Set<number>([
          GROUND,
          P.home,
          P.chalk,
          P.steelHi,
          P.mist,
        ]);
        for (const c of colours(s)) expect(ok.has(c)).toBe(true);
      }
    }
  });

  it("a tiny player is 2 x 6 on the pitch (2 x 3 small), its shadow to the right", () => {
    const s = ground();
    drawTinyPlayer(
      s,
      10,
      20,
      true,
      P.skinA,
      P.hairDark,
      P.home,
      P.night,
      P.grassDeep,
      0,
    );
    expect(box(s, [P.grassDeep])).toEqual({ x0: 10, y0: 15, x1: 11, y1: 20 });
    const t = ground();
    drawTinyPlayer(
      t,
      10,
      20,
      false,
      P.skinA,
      P.hairDark,
      P.home,
      P.night,
      P.grassDeep,
      0,
    );
    expect(box(t)).toEqual({ x0: 10, y0: 16, x1: 11, y1: 18 });
  });

  it("smoke puffs are 2 x 2, 4 x 4 and 6 x 4", () => {
    const sizes = [
      [2, 2],
      [4, 4],
      [6, 4],
    ];
    for (const size of [0, 1, 2] as const) {
      const s = ground();
      drawPuff(s, 10, 10, size, P.white);
      const b = box(s);
      expect([b.x1 - b.x0 + 1, b.y1 - b.y0 + 1]).toEqual(sizes[size]);
    }
  });

  it("the town's small parts keep to their boxes", () => {
    const s = ground();
    drawWindow(
      s,
      10,
      10,
      P.slate,
      P.chalk,
      P.mist,
      P.concreteLight,
      false,
      P.goldDark,
    );
    expect(box(s)).toEqual({ x0: 9, y0: 10, x1: 16, y1: 16 });
    const d = ground();
    drawDoor(d, 10, 30, P.woodDark, P.ink, P.slate, P.gold, P.concreteLight);
    expect(box(d)).toEqual({ x0: 9, y0: 22, x1: 14, y1: 29 });
    const c = ground();
    expect(
      drawChimney(c, 10, 30, P.brick, P.brickDark, P.brickLight, P.wood),
    ).toBe(20);
    expect(box(c)).toEqual({ x0: 9, y0: 20, x1: 14, y1: 31 });
    const b = ground();
    drawBin(b, 10, 30, P.grassDeep, P.grassDark, P.ink);
    expect(box(b)).toEqual({ x0: 10, y0: 26, x1: 11, y1: 29 });
    const p = ground();
    drawParasol(p, 30, 30, P.home, P.chalk, P.white, P.brickDark);
    const pb = box(p);
    expect(pb.x1 - pb.x0 + 1).toBe(17);
    const o = ground();
    drawBollard(o, 10, 30, P.slate, P.night, P.gold, P.goldLight);
    expect(box(o)).toEqual({ x0: 10, y0: 24, x1: 11, y1: 29 });
  });
});

describe("the sky", () => {
  const DAY = lightingFor({ elevation: 45, morning: false });
  const NIGHT = lightingFor({ elevation: -30, morning: false });

  it("the whole moon is on the home screen, where its layout puts it", () => {
    for (const [w, h] of [
      [960, 540],
      [854, 480],
      [260, 562],
      [234, 507],
    ]) {
      const m = menuLayout(w, h);
      const r = moonPosition(w, m.horizonY).r;
      expect(m.sky.moon.x - r).toBeGreaterThanOrEqual(0);
      expect(m.sky.moon.x + r).toBeLessThan(w);
      expect(m.sky.moon.y - r).toBeGreaterThanOrEqual(0);
    }
  });

  it("clouds are flat on their bottom row and about as wide as asked", () => {
    const tones = [P.white, P.white, P.cloud, P.cloudShade] as const;

    for (const width of [24, 36, 48, 64, 88]) {
      for (let seed = 1; seed < 8; seed++) {
        const c = cloudSprite(seed, width, [...tones] as never);
        expect(Math.abs(c.w - width)).toBeLessThanOrEqual(8);
        expect(c.h).toBeGreaterThanOrEqual(8);
        let first = -1;
        let last = -1;
        for (let x = 0; x < c.w; x++) {
          if (c.get(x, c.h - 1) !== 0) {
            if (first < 0) first = x;
            last = x;
          }
        }
        expect(last - first + 1).toBeGreaterThanOrEqual(c.w * 0.6);
      }
    }
  });

  it.each([
    [DAY, 960, 540],
    [NIGHT, 960, 540],
    [NIGHT, 260, 562],
  ] as const)(
    "fills every pixel down to the horizon, the same every time",
    (light, w, h) => {
      const draw = (): Surface => {
        const s = new Surface(w, h);
        drawSky(s, {
          light,
          t: 12.5,
          seed: 3,
          horizonY: Math.round(h * 0.3),
        });
        return s;
      };
      const a = draw();
      for (let y = 0; y < Math.round(h * 0.3); y++) {
        for (let x = 0; x < w; x++)
          if (a.get(x, y) === 0) throw new Error(`${x},${y}`);
      }
      expect(same(a, draw())).toBe(true);
    },
  );
});

describe("the home picture", () => {
  const light = (elevation: number) =>
    clubLight(lightingFor({ elevation, morning: false }), DEFAULT_SCHEME);

  function sameTown(a: Town, b: Town): boolean {
    return (
      same(a.land, b.land) &&
      same(a.skyline, b.skyline) &&
      same(a.bowl.layer, b.bowl.layer) &&
      a.depth.length === b.depth.length &&
      a.depth.every((v, i) => v === b.depth[i]) &&
      a.chimneys.length === b.chimneys.length &&
      a.bowl.crowdAt.length === b.bowl.crowdAt.length
    );
  }

  it("after a change of light keeps the last picture up and builds the new one a slice at a time", () => {
    const view = makeView(480, 270);
    const first = paintTown(view, light(30), 5);
    expect(townPending(first)).toBe(false);
    const land = first.land;
    const next = paintTown(view, light(29), 5);
    // at once: the last picture, still up
    expect(townPending(next)).toBe(true);
    expect(next.land).toBe(land);
    let slices = 0;
    while (townPending(next) && slices < 1000) {
      advanceTown(next);
      slices++;
    }
    expect(townPending(next)).toBe(false);
    // spread over many frames, not one
    expect(slices).toBeGreaterThanOrEqual(10);
    // the same picture as one painted at once (a new view of the same size is not deferred)
    const whole = paintTown(makeView(480, 270), light(29), 5);
    expect(townPending(whole)).toBe(false);
    expect(sameTown(next, whole)).toBe(true);
  }, 60_000);

  it("relights a slice at a time when the lamps come on too, to the same picture", () => {
    const view = makeView(480, 270);
    paintTown(view, light(30), 6);
    const night = paintTown(view, light(-30), 6);
    expect(townPending(night)).toBe(true);
    let slices = 0;
    while (townPending(night) && slices < 1000) {
      advanceTown(night);
      slices++;
    }
    expect(townPending(night)).toBe(false);
    expect(slices).toBeGreaterThanOrEqual(10);
    const whole = paintTown(makeView(480, 270), light(-30), 6);
    expect(townPending(whole)).toBe(false);
    expect(sameTown(night, whole)).toBe(true);
  }, 60_000);

  it.each([
    [960, 540],
    [1920, 1080],
    [260, 562],
  ])(
    "covers every pixel at %i x %i, by day and at night",
    (w, h) => {
      for (const elevation of [45, -30]) {
        const b = new MenuBackdrop({
          seed: 3,
          sign: { header: "DID YOU KNOW?", text: "A FACT" },
        });
        b.resize(w, h);
        b.setLighting(lightingFor({ elevation, morning: false }));
        const s = new Surface(w, h);
        b.draw(s, 27.3);
        let holes = 0;
        for (let i = 0; i < s.data.length; i++) if (s.data[i] === 0) holes++;
        expect(holes, `${w}x${h} sun ${elevation}`).toBe(0);
      }
    },
    120_000,
  );
});
