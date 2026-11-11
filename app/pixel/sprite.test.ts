import { describe, expect, test } from "vitest";

import { TRANSPARENT, rgb, type Color } from "./color";
import { drawSprite, frameCount, sprite, spriteColors } from "./sprite";
import { Surface } from "./surface";

const W = rgb(0xffffff);
const K = rgb(0x000000);
const R = rgb(0xff0000);

const BALL = sprite(
  `
.ww.
wwkw
wkww
.ww.
`,
  "wk",
);

// Two frames, deliberately lopsided so flips are detectable.
const FLAG = sprite(
  `

ab.
a..


a..
ab.

`,
  "ab",
);

function dump(s: Surface, key: [Color, string][]): string[] {
  const rows: string[] = [];
  for (let y = 0; y < s.h; y++) {
    let row = "";
    for (let x = 0; x < s.w; x++) {
      const c = s.get(x, y);
      row += c === TRANSPARENT ? "." : (key.find(([k]) => k === c)?.[1] ?? "?");
    }
    rows.push(row);
  }
  return rows;
}

const KEY: [Color, string][] = [
  [W, "w"],
  [K, "k"],
  [R, "r"],
];

describe("sprite parsing", () => {
  test("cells are 0 for transparent and legend index + 1 otherwise", () => {
    expect(BALL.w).toBe(4);
    expect(BALL.h).toBe(4);
    expect(BALL.frames).toHaveLength(1);
    expect(Array.from(BALL.frames[0])).toEqual([
      0, 1, 1, 0, 1, 1, 2, 1, 1, 2, 1, 1, 0, 1, 1, 0,
    ]);
  });

  test("blank lines split frames; leading, trailing and repeated blanks are ignored", () => {
    expect(frameCount(FLAG)).toBe(2);
    expect([FLAG.w, FLAG.h]).toEqual([3, 2]);
    expect(Array.from(FLAG.frames[0])).toEqual([1, 2, 0, 1, 0, 0]);
    expect(Array.from(FLAG.frames[1])).toEqual([1, 0, 0, 1, 2, 0]);
  });

  test("spaces inside a row are transparent, and Windows line endings are fine", () => {
    const s = sprite("a a\r\n.a.\r\n", "a");
    expect([s.w, s.h]).toEqual([3, 2]);
    expect(Array.from(s.frames[0])).toEqual([1, 0, 1, 0, 1, 0]);
  });

  test("an unknown character names the character, frame and row", () => {
    expect(() => sprite("ww\nww\n\nww\nwx\n", "wk")).toThrow(
      'sprite: unknown character "x" in frame 1, row 1 (the legend is "wk")',
    );
  });

  test("ragged rows and frames of different heights are errors", () => {
    expect(() => sprite("www\nww\n", "w")).toThrow(
      "sprite: frame 0, row 1 is 2 wide but the first row is 3",
    );
    expect(() => sprite("ww\nww\n\nww\nww\nww\n", "w")).toThrow(
      "sprite: frame 1 has 3 rows but frame 0 has 2",
    );
    expect(() => sprite("ww\nww\n\nwww\nwww\n", "w")).toThrow(
      "sprite: frame 1, row 0 is 3 wide but the first row is 2",
    );
  });

  test("empty art and bad legends are errors", () => {
    expect(() => sprite("\n  \n", "w")).toThrow("sprite: the art is empty");
    expect(() => sprite("ww", "w.")).toThrow(/always transparent/);
    expect(() => sprite("ww", "ww")).toThrow(/appears twice/);
  });
});

describe("drawSprite", () => {
  test("paints legend characters with the matching colours", () => {
    const s = new Surface(6, 6);
    drawSprite(s, BALL, 0, 1, 1, [W, K]);
    expect(dump(s, KEY)).toEqual([
      "......",
      "..ww..",
      ".wwkw.",
      ".wkww.",
      "..ww..",
      "......",
    ]);
  });

  test("leaves existing pixels under transparent cells", () => {
    const s = new Surface(4, 4);
    s.clear(R);
    drawSprite(s, BALL, 0, 0, 0, [W, K]);
    expect(dump(s, KEY)).toEqual(["rwwr", "wwkw", "wkww", "rwwr"]);
  });

  test("a transparent or missing colour skips that character", () => {
    const s = new Surface(4, 4);
    drawSprite(s, BALL, 0, 0, 0, [TRANSPARENT, K]);
    expect(dump(s, KEY)).toEqual(["....", "..k.", ".k..", "...."]);
    const t = new Surface(4, 4);
    drawSprite(t, BALL, 0, 0, 0, [W]);
    expect(dump(t, KEY)).toEqual([".ww.", "ww.w", "w.ww", ".ww."]);
  });

  test("the frame number wraps in both directions", () => {
    const draw = (frame: number): string[] => {
      const s = new Surface(3, 2);
      drawSprite(s, FLAG, frame, 0, 0, [W, K]);
      return dump(s, KEY);
    };
    expect(draw(0)).toEqual(["wk.", "w.."]);
    expect(draw(1)).toEqual(["w..", "wk."]);
    expect(draw(2)).toEqual(draw(0));
    expect(draw(7)).toEqual(draw(1));
    expect(draw(-1)).toEqual(draw(1));
    expect(draw(1.9)).toEqual(draw(1));
    expect(() => draw(NaN)).not.toThrow();
  });

  test("flipX and flipY mirror in place", () => {
    const draw = (flipX: boolean, flipY: boolean): string[] => {
      const s = new Surface(3, 2);
      drawSprite(s, FLAG, 0, 0, 0, [W, K], { flipX, flipY });
      return dump(s, KEY);
    };
    expect(draw(true, false)).toEqual([".kw", "..w"]);
    expect(draw(false, true)).toEqual(["w..", "wk."]);
    expect(draw(true, true)).toEqual(["..w", ".kw"]);
  });

  test("bottom-center: (x, y) is the pixel under the middle of the bottom row", () => {
    const s = new Surface(8, 8);
    drawSprite(s, BALL, 0, 4, 6, [W, K], { anchor: "bottom-center" });
    expect(dump(s, KEY)).toEqual([
      "........",
      "........",
      "...ww...",
      "..wwkw..",
      "..wkww..",
      "...ww...",
      "........",
      "........",
    ]);
    // An odd width centres exactly on x.
    const post = sprite("a\na\na", "a");
    const t = new Surface(5, 5);
    drawSprite(t, post, 0, 2, 4, [W], { anchor: "bottom-center" });
    expect(dump(t, KEY)).toEqual([".....", "..w..", "..w..", "..w..", "....."]);
  });

  test("scale magnifies by whole pixels, with either anchor", () => {
    const one = new Surface(4, 4);
    drawSprite(one, BALL, 0, 0, 0, [W, K], { flipX: true });
    const big = new Surface(12, 12);
    drawSprite(big, BALL, 0, 0, 0, [W, K], { scale: 3, flipX: true });
    for (let y = 0; y < 12; y++) {
      for (let x = 0; x < 12; x++) {
        expect(big.get(x, y)).toBe(
          one.get(Math.floor(x / 3), Math.floor(y / 3)),
        );
      }
    }
    const anchored = new Surface(12, 12);
    drawSprite(anchored, BALL, 0, 6, 10, [W, K], {
      scale: 2,
      anchor: "bottom-center",
    });
    expect(anchored.get(2, 9)).toBe(TRANSPARENT);
    expect(anchored.get(4, 9)).toBe(W);
    expect(anchored.get(7, 9)).toBe(W);
    expect(anchored.get(4, 10)).toBe(TRANSPARENT);
    expect(anchored.get(4, 1)).toBe(TRANSPARENT);
    expect(anchored.get(4, 2)).toBe(W);
  });

  test("clips at the surface edges and the clip rect without throwing", () => {
    const s = new Surface(4, 4);
    for (const [x, y] of [
      [-2, -2],
      [2, 2],
      [-100, 0],
      [0, 100],
      [NaN, 0],
    ]) {
      for (const scale of [1, 2]) {
        for (const flipX of [false, true]) {
          expect(() =>
            drawSprite(s, BALL, 0, x, y, [W, K], { scale, flipX }),
          ).not.toThrow();
        }
      }
    }
    const t = new Surface(6, 6);
    t.clip(2, 2, 2, 2);
    drawSprite(t, BALL, 0, 1, 1, [W, K]);
    t.unclip();
    expect(dump(t, KEY)).toEqual([
      "......",
      "......",
      "..wk..",
      "..kw..",
      "......",
      "......",
    ]);
    const edge = new Surface(4, 4);
    drawSprite(edge, BALL, 0, -2, -1, [W, K]);
    expect(dump(edge, KEY)).toEqual(["kw..", "ww..", "w...", "...."]);
  });
});

// ---------------------------------------------------------------------------
// Added in review
// ---------------------------------------------------------------------------

describe("indented art", () => {
  test("indentation shared by every row is ignored", () => {
    const indented = sprite(
      `
        .ww.
        wwkw
        wkww
        .ww.
      `,
      "wk",
    );
    expect(indented.w).toBe(4);
    expect(indented.h).toBe(4);
    expect(Array.from(indented.frames[0])).toEqual(Array.from(BALL.frames[0]));
  });

  test("only the shared part goes: deeper rows keep their extra spaces as transparent pixels", () => {
    const sp = sprite(
      `
      a..
       a.
        a

      aaa
      aaa
      aaa
      `,
      "a",
    );
    expect(sp.w).toBe(3);
    expect(sp.frames.length).toBe(2);
    expect(Array.from(sp.frames[0])).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  });

  test("a tab in the art is an error, because its width is anyone's guess", () => {
    expect(() => sprite("\ta\n\ta", "a")).toThrow(/tab/);
  });

  test("the sprite remembers its legend", () => {
    expect(BALL.legend).toBe("wk");
  });
});

describe("spriteColors", () => {
  test("puts named colours in legend order", () => {
    expect(spriteColors(BALL, { k: K, w: W })).toEqual([W, K]);
  });

  test("a legend character that is left out is not drawn", () => {
    const colors = spriteColors(BALL, { w: W });
    expect(colors).toEqual([W, TRANSPARENT]);
    const s = new Surface(4, 4);
    drawSprite(s, BALL, 0, 0, 0, colors);
    expect(dump(s, KEY)).toEqual([".ww.", "ww.w", "w.ww", ".ww."]);
  });

  test("a key that is not in the legend is an error", () => {
    expect(() => spriteColors(BALL, { w: W, x: R })).toThrow(/"x".*"wk"/);
  });
});

describe("anchors and flips", () => {
  const ODD = sprite(
    `
ab.
a..
a.b
`,
    "ab",
  );
  const AB: [Color, string][] = [
    [W, "a"],
    [K, "b"],
  ];

  test("center: (x, y) is the middle pixel of an odd-sized sprite", () => {
    const s = new Surface(7, 7);
    drawSprite(s, ODD, 0, 3, 3, [W, K], { anchor: "center" });
    expect(dump(s, AB)).toEqual([
      ".......",
      ".......",
      "..ab...",
      "..a....",
      "..a.b..",
      ".......",
      ".......",
    ]);
  });

  test("center on an even size puts the extra column and row before the anchor, like bottom-center", () => {
    const s = new Surface(8, 8);
    drawSprite(s, BALL, 0, 4, 4, [W, K], { anchor: "center" });
    expect(dump(s, KEY).slice(2, 6)).toEqual([
      "...ww...",
      "..wwkw..",
      "..wkww..",
      "...ww...",
    ]);
    const t = new Surface(8, 8);
    drawSprite(t, BALL, 0, 4, 6, [W, K], { anchor: "bottom-center" });
    expect(dump(t, KEY)).toEqual(dump(s, KEY));
  });

  test("a flip mirrors the sprite inside the same box, with every anchor and scale", () => {
    for (const anchor of ["top-left", "bottom-center", "center"] as const) {
      for (const scale of [1, 2, 3]) {
        for (const sp of [ODD, BALL]) {
          const plain = new Surface(24, 24);
          drawSprite(plain, sp, 0, 12, 12, [W, K], { anchor, scale });
          const flipX = new Surface(24, 24);
          drawSprite(flipX, sp, 0, 12, 12, [W, K], {
            anchor,
            scale,
            flipX: true,
          });
          const flipY = new Surface(24, 24);
          drawSprite(flipY, sp, 0, 12, 12, [W, K], {
            anchor,
            scale,
            flipY: true,
          });
          // The box, worked out from the anchor rule.
          const bw = sp.w * scale;
          const bh = sp.h * scale;
          const left = anchor === "top-left" ? 12 : 12 - Math.floor(bw / 2);
          const top =
            anchor === "top-left"
              ? 12
              : anchor === "center"
                ? 12 - Math.floor(bh / 2)
                : 12 - bh;
          for (let y = 0; y < 24; y++) {
            for (let x = 0; x < 24; x++) {
              const inBox =
                x >= left && x < left + bw && y >= top && y < top + bh;
              if (!inBox) {
                expect(plain.get(x, y)).toBe(TRANSPARENT);
                expect(flipX.get(x, y)).toBe(TRANSPARENT);
                expect(flipY.get(x, y)).toBe(TRANSPARENT);
                continue;
              }
              expect(flipX.get(x, y)).toBe(plain.get(2 * left + bw - 1 - x, y));
              expect(flipY.get(x, y)).toBe(plain.get(x, 2 * top + bh - 1 - y));
            }
          }
        }
      }
    }
  });
});

describe("odd sprite input", () => {
  test("frame numbers of every kind", () => {
    const s = new Surface(4, 4);
    for (const frame of [NaN, Infinity, -Infinity]) {
      drawSprite(s, BALL, frame, 0, 0, [W, K]);
    }
    expect(dump(s, KEY)).toEqual(["....", "....", "....", "...."]);
    for (const frame of [0, 1, -1, 7, 0.9, -0.1, 1e9, -1e9]) {
      const t = new Surface(4, 4);
      drawSprite(t, BALL, frame, 0, 0, [W, K]);
      expect(dump(t, KEY)).toEqual([".ww.", "wwkw", "wkww", ".ww."]);
    }
  });

  test("a huge scale or position draws only what is on the surface, quickly", () => {
    const s = new Surface(10, 10);
    const start = performance.now();
    drawSprite(s, BALL, 0, 0, 0, [W, K], { scale: 1e7 });
    drawSprite(s, BALL, 0, -1e9, 5, [W, K], { scale: 1000 });
    drawSprite(s, BALL, 0, 1e15, 1e15, [W, K], { scale: 3 });
    drawSprite(s, BALL, 0, NaN, 0, [W, K], { scale: 3 });
    drawSprite(s, BALL, 0, 0, 0, [W, K], { scale: -4, anchor: "center" });
    expect(performance.now() - start).toBeLessThan(200);
    // Scale 1e7 from (0, 0): the top left cell is transparent, so nothing shows; then the
    // scale -4 draw falls back to scale 1, centred on (0, 0).
    expect(dump(s, KEY).slice(0, 3)).toEqual([
      "ww........",
      "w.........",
      "..........",
    ]);
  });

  test("colours that are too few, too many or reused", () => {
    const s = new Surface(4, 4);
    drawSprite(s, BALL, 0, 0, 0, []);
    expect(dump(s, KEY)).toEqual(["....", "....", "....", "...."]);
    drawSprite(s, BALL, 0, 0, 0, [R, R, W, K]);
    expect(dump(s, KEY)).toEqual([".rr.", "rrrr", "rrrr", ".rr."]);
    // A long colour list must not leak into the next sprite's missing entries.
    const t = new Surface(4, 4);
    drawSprite(t, BALL, 0, 0, 0, [W]);
    expect(dump(t, KEY)).toEqual([".ww.", "ww.w", "w.ww", ".ww."]);
  });
});
