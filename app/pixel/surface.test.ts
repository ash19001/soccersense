import { describe, expect, test } from "vitest";

import { TRANSPARENT, rgb, type Color } from "./color";
import { Surface, bayer4, type Point } from "./surface";

const RED = rgb(0xff0000);
const BLUE = rgb(0x0000ff);
const GREEN = rgb(0x00ff00);

/** The surface as rows of characters: '.' transparent, otherwise by `key`. */
function dump(s: Surface, key: [Color, string][] = [[RED, "#"]]): string[] {
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

function count(s: Surface, c: Color): number {
  let n = 0;
  for (const v of s.data) if (v === c) n++;
  return n;
}

describe("construction", () => {
  test("starts transparent, sizes are rounded and at least 1", () => {
    const s = new Surface(4.4, 2.6);
    expect([s.w, s.h, s.data.length]).toEqual([4, 3, 12]);
    expect(count(s, TRANSPARENT)).toBe(12);
    const tiny = new Surface(0, NaN);
    expect([tiny.w, tiny.h]).toEqual([1, 1]);
  });

  test("bytes is valid RGBA image data", () => {
    const s = new Surface(2, 1);
    s.px(1, 0, rgb(0x112233));
    expect(Array.from(s.bytes)).toEqual([0, 0, 0, 0, 0x11, 0x22, 0x33, 0xff]);
  });

  test("clone copies pixels and is independent", () => {
    const s = new Surface(3, 3);
    s.px(1, 1, RED);
    const copy = s.clone();
    s.clear();
    expect(copy.get(1, 1)).toBe(RED);
  });
});

describe("px, get, rect", () => {
  test("px rounds, clips, and ignores transparent", () => {
    const s = new Surface(4, 4);
    s.px(1.4, 1.6, RED);
    expect(s.get(1, 2)).toBe(RED);
    s.px(1, 2, TRANSPARENT);
    expect(s.get(1, 2)).toBe(RED);
    s.px(-1, 0, RED);
    s.px(4, 0, RED);
    s.px(0, 4, RED);
    s.px(NaN, 0, RED);
    expect(count(s, RED)).toBe(1);
    expect(s.get(-1, 0)).toBe(TRANSPARENT);
    expect(s.get(99, 99)).toBe(TRANSPARENT);
  });

  test("rect fills exactly its pixels", () => {
    const s = new Surface(6, 5);
    s.rect(1, 1, 3, 2, RED);
    expect(dump(s)).toEqual(["......", ".###..", ".###..", "......", "......"]);
  });

  test("rect is clipped to the surface", () => {
    const s = new Surface(4, 4);
    s.rect(-2, -2, 4, 4, RED);
    s.rect(3, 3, 100, 100, RED);
    expect(dump(s)).toEqual(["##..", "##..", "....", "...#"]);
  });

  test("a wide rect and a narrow rect agree (both fill paths)", () => {
    const s = new Surface(40, 3);
    s.rect(2, 0, 30, 1, RED);
    s.rect(2, 2, 5, 1, RED);
    expect(dump(s)[0]).toBe(".." + "#".repeat(30) + "........");
    expect(dump(s)[2]).toBe("..#####" + ".".repeat(33));
  });

  test("erase punches a hole", () => {
    const s = new Surface(4, 1);
    s.clear(RED);
    s.erase(1, 0, 2, 1);
    expect(dump(s)).toEqual(["#..#"]);
  });

  test("frame is a 1 px outline inside its bounds", () => {
    const s = new Surface(5, 4);
    s.frame(0, 0, 5, 4, RED);
    expect(dump(s)).toEqual(["#####", "#...#", "#...#", "#####"]);
    const small = new Surface(3, 3);
    small.frame(0, 0, 1, 1, RED);
    small.frame(1, 1, 2, 2, RED);
    expect(dump(small)).toEqual(["#..", ".##", ".##"]);
  });

  test("hline and vline", () => {
    const s = new Surface(5, 5);
    s.hline(1, 0, 3, RED);
    s.vline(0, 1, 3, RED);
    s.hline(3, 4, 99, RED);
    expect(dump(s)).toEqual([".###.", "#....", "#....", "#....", "...##"]);
  });
});

describe("odd input never throws and draws nothing", () => {
  test("negative sizes, zero sizes, NaN, infinities, far outside", () => {
    const s = new Surface(8, 8);
    const src = new Surface(3, 3);
    src.clear(RED);
    const values = [NaN, Infinity, -Infinity, -5, 0, 1e9, -1e9, 2.5];
    expect(() => {
      for (const a of values) {
        for (const b of values) {
          s.px(a, b, RED);
          s.get(a, b);
          s.rect(a, b, b, a, RED);
          s.rect(100, 100, a, b, RED);
          s.erase(a, 100, b, a);
          s.frame(a, b, b, a, RED);
          s.hline(a, b, a, RED);
          s.vline(a, b, b, RED);
          s.line(a, b, 100, 100, RED);
          s.line(100, 100, a, b, RED);
          s.disc(100, 100, a, RED);
          s.disc(a, b, 2, RED);
          s.circle(a, b, a, RED);
          s.ellipse(a, b, b, a, RED, true);
          s.ellipse(a, 100, 3, b, RED);
          s.poly(
            [
              [a, b],
              [100, 100],
              [100, 200],
            ],
            RED,
          );
          s.polyline(
            [
              [a, 100],
              [100, b],
            ],
            RED,
            true,
          );
          s.blit(src, a, b);
          s.blit(src, 100, 100, { sx: a, sy: b, sw: b, sh: a, flipX: true });
          s.copy(src, a, b);
          s.dither(a, b, b, a, RED, a);
          s.dither(100, 100, 5, 5, RED, b);
          s.bands(a, b, b, a, [RED, BLUE], { dither: a, stops: [b] });
          s.bands(100, 100, 5, 5, [RED, BLUE], { dither: b });
          s.shadeRect(a, 100, b, a, () => RED);
          s.clip(a, b, b, a);
          s.unclip();
        }
      }
      s.poly([], RED);
      s.polyline([], RED);
      s.bands(0, 0, 8, 8, []);
    }).not.toThrow();
  });

  test("shapes with a negative or NaN size leave the surface untouched", () => {
    const s = new Surface(8, 8);
    s.rect(2, 2, -3, 3, RED);
    s.rect(2, 2, 3, 0, RED);
    s.rect(NaN, 2, 3, 3, RED);
    s.frame(2, 2, 0, 5, RED);
    s.hline(2, 2, -4, RED);
    s.vline(2, 2, 0, RED);
    s.disc(4, 4, -1, RED);
    s.disc(4, NaN, 2, RED);
    s.ellipse(4, 4, 3, -1, RED, true);
    s.line(0, 0, NaN, 5, RED);
    s.dither(0, 0, 8, 8, RED, NaN);
    expect(count(s, TRANSPARENT)).toBe(64);
  });
});

describe("clip", () => {
  test("every primitive respects the clip rect", () => {
    const s = new Surface(12, 12);
    const src = new Surface(12, 12);
    src.clear(RED);
    s.clip(4, 5, 3, 2);
    s.rect(0, 0, 12, 12, RED);
    s.frame(0, 0, 12, 12, RED);
    s.hline(0, 5, 12, RED);
    s.vline(5, 0, 12, RED);
    s.line(0, 0, 11, 11, RED);
    s.disc(5, 5, 8, RED);
    s.circle(5, 5, 2, RED);
    s.ellipse(6, 6, 5, 3, RED, true);
    s.poly(
      [
        [0, 0],
        [11, 0],
        [5, 11],
      ],
      RED,
    );
    s.blit(src, 0, 0);
    s.copy(src, 0, 0);
    s.dither(0, 0, 12, 12, RED, 1);
    s.bands(0, 0, 12, 12, [RED, RED]);
    s.shadeRect(0, 0, 12, 12, () => RED);
    for (let y = 0; y < 12; y++) s.px(y, y, RED);
    s.unclip();
    expect(count(s, RED)).toBe(6);
    for (let y = 5; y < 7; y++) {
      for (let x = 4; x < 7; x++) expect(s.get(x, y)).toBe(RED);
    }
  });

  test("clip is intersected with the surface, and an empty clip blocks everything", () => {
    const s = new Surface(4, 4);
    s.clip(-10, -10, 12, 12);
    s.rect(0, 0, 4, 4, RED);
    expect(count(s, RED)).toBe(4);
    s.clip(2, 2, 0, 5);
    s.rect(0, 0, 4, 4, BLUE);
    expect(count(s, BLUE)).toBe(0);
    s.unclip();
    s.rect(0, 0, 4, 4, BLUE);
    expect(count(s, BLUE)).toBe(16);
  });

  test("clear ignores the clip rect", () => {
    const s = new Surface(4, 4);
    s.clip(0, 0, 1, 1);
    s.clear(RED);
    expect(count(s, RED)).toBe(16);
  });
});

describe("line", () => {
  test("includes both end points, in either direction", () => {
    const cases: [number, number, number, number][] = [
      [0, 0, 9, 0],
      [0, 0, 0, 9],
      [1, 2, 8, 7],
      [8, 1, 2, 9],
      [0, 9, 9, 6],
      [3, 3, 3, 3],
    ];
    for (const [x0, y0, x1, y1] of cases) {
      const a = new Surface(10, 10);
      a.line(x0, y0, x1, y1, RED);
      expect(a.get(x0, y0)).toBe(RED);
      expect(a.get(x1, y1)).toBe(RED);
      // One pixel per step along the longer axis.
      expect(count(a, RED)).toBe(
        Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) + 1,
      );
      const b = new Surface(10, 10);
      b.line(x1, y1, x0, y0, RED);
      expect(dump(b)).toEqual(dump(a));
    }
  });

  test("a 45 degree line is a clean diagonal", () => {
    const s = new Surface(4, 4);
    s.line(0, 3, 3, 0, RED);
    expect(dump(s)).toEqual(["...#", "..#.", ".#..", "#..."]);
  });

  test("mirrored lines are mirror images", () => {
    const left = new Surface(9, 5);
    const right = new Surface(9, 5);
    left.line(0, 0, 8, 4, RED);
    right.line(8, 0, 0, 4, RED);
    const mirrored = dump(right).map((row) => [...row].reverse().join(""));
    expect(mirrored).toEqual(dump(left));
    // A 2:1 slope gives even runs of two with the odd pixel in the middle.
    expect(dump(left)).toEqual([
      "##.......",
      "..##.....",
      "....#....",
      ".....##..",
      ".......##",
    ]);
  });

  test("a line far longer than the surface is clipped, not walked", () => {
    const s = new Surface(5, 5);
    s.line(-1e8, 2, 1e8, 2, RED);
    expect(dump(s)[2]).toBe("#####");
    expect(count(s, RED)).toBe(5);
  });
});

describe("disc and circle", () => {
  test("small discs have the documented shapes", () => {
    const shape = (r: number): string[] => {
      const d = Math.round(2 * r) + 1;
      const s = new Surface(d, d);
      s.disc(r, r, r, RED);
      return dump(s);
    };
    expect(shape(0)).toEqual(["#"]);
    expect(shape(0.5)).toEqual(["##", "##"]);
    expect(shape(1)).toEqual([".#.", "###", ".#."]);
    expect(shape(1.5)).toEqual([".##.", "####", "####", ".##."]);
    expect(shape(2)).toEqual([".###.", "#####", "#####", "#####", ".###."]);
    expect(shape(3)).toEqual([
      "..###..",
      ".#####.",
      "#######",
      "#######",
      "#######",
      ".#####.",
      "..###..",
    ]);
    expect(shape(4)[0]).toBe("...###...");
    expect(shape(4)[1]).toBe(".#######.");
  });

  test("whole radius centres on the pixel; half radius adds a column right and below", () => {
    const s = new Surface(12, 12);
    s.disc(5, 5, 2, RED);
    expect([s.get(3, 5), s.get(7, 5), s.get(2, 5), s.get(8, 5)]).toEqual([
      RED,
      RED,
      TRANSPARENT,
      TRANSPARENT,
    ]);
    const t = new Surface(12, 12);
    t.disc(5, 5, 1.5, RED);
    expect(dump(t)[5]).toBe("....####....");
    expect(dump(t)[3]).toBe("............");
    expect(dump(t)[4]).toBe(".....##.....");
    expect(dump(t)[7]).toBe(".....##.....");
    // The same disc, named by its true centre.
    const u = new Surface(12, 12);
    u.disc(5.5, 5.5, 1.5, RED);
    expect(dump(u)).toEqual(dump(t));
  });

  test("every disc from radius 0.5 to 8 is symmetric and fills its box", () => {
    for (let r = 0.5; r <= 8; r += 0.5) {
      const d = Math.round(2 * r) + 1;
      const s = new Surface(d, d);
      s.disc(r, r, r, RED);
      for (let y = 0; y < d; y++) {
        for (let x = 0; x < d; x++) {
          const c = s.get(x, y);
          expect(s.get(d - 1 - x, y)).toBe(c); // left-right
          expect(s.get(x, d - 1 - y)).toBe(c); // top-bottom
          expect(s.get(y, x)).toBe(c); // diagonal
        }
      }
      // It touches all four sides of its bounding box.
      const mid = Math.floor((d - 1) / 2);
      expect(s.get(0, mid)).toBe(RED);
      expect(s.get(d - 1, mid)).toBe(RED);
      expect(s.get(mid, 0)).toBe(RED);
      expect(s.get(mid, d - 1)).toBe(RED);
    }
  });

  test("circle is the edge of the disc", () => {
    for (let r = 0; r <= 8; r += 0.5) {
      const d = Math.round(2 * r) + 1;
      const fill = new Surface(d + 2, d + 2);
      const ring = new Surface(d + 2, d + 2);
      fill.disc(1 + r, 1 + r, r, RED);
      ring.circle(1 + r, 1 + r, r, RED);
      for (let y = 0; y < d + 2; y++) {
        for (let x = 0; x < d + 2; x++) {
          const inside = fill.get(x, y) === RED;
          const edge =
            inside &&
            (fill.get(x - 1, y) !== RED ||
              fill.get(x + 1, y) !== RED ||
              fill.get(x, y - 1) !== RED ||
              fill.get(x, y + 1) !== RED);
          expect(ring.get(x, y) === RED).toBe(edge);
        }
      }
    }
  });

  test("ellipse: equal radii is the disc, thin ones keep their size", () => {
    const a = new Surface(11, 11);
    const b = new Surface(11, 11);
    a.disc(5, 5, 4, RED);
    b.ellipse(5, 5, 4, 4, RED, true);
    expect(dump(b)).toEqual(dump(a));

    const shadow = new Surface(9, 3);
    shadow.ellipse(4, 1, 4, 1, RED, true);
    expect(dump(shadow)).toEqual([".#######.", "#########", ".#######."]);

    const outline = new Surface(9, 5);
    outline.ellipse(4, 2, 4, 2, RED);
    expect(dump(outline)).toEqual([
      "..#####..",
      "##.....##",
      "#.......#",
      "##.....##",
      "..#####..",
    ]);
    const tall = new Surface(3, 9);
    const wide = new Surface(9, 3);
    tall.ellipse(1, 4, 1, 4, RED, true);
    wide.ellipse(4, 1, 4, 1, RED, true);
    // Transposed shapes are transposes of each other.
    for (let y = 0; y < 9; y++) {
      for (let x = 0; x < 3; x++) expect(tall.get(x, y)).toBe(wide.get(y, x));
    }
  });
});

describe("poly", () => {
  test("a rectangle given as a polygon includes its corners", () => {
    const s = new Surface(6, 5);
    s.poly(
      [
        [1, 1],
        [4, 1],
        [4, 3],
        [1, 3],
      ],
      RED,
    );
    expect(dump(s)).toEqual(["......", ".####.", ".####.", ".####.", "......"]);
  });

  test("a concave polygon leaves its notch empty", () => {
    const s = new Surface(9, 7);
    // A "U": the notch between the two arms must stay clear.
    s.poly(
      [
        [0, 0],
        [2, 0],
        [2, 4],
        [6, 4],
        [6, 0],
        [8, 0],
        [8, 6],
        [0, 6],
      ],
      RED,
    );
    expect(dump(s)).toEqual([
      "###...###",
      "###...###",
      "###...###",
      "###...###",
      "#########",
      "#########",
      "#########",
    ]);
  });

  test("the fill covers the outline", () => {
    const points: [number, number][] = [
      [10, 1],
      [12, 8],
      [19, 8],
      [13, 12],
      [16, 19],
      [10, 15],
      [4, 19],
      [7, 12],
      [1, 8],
      [8, 8],
    ];
    const fill = new Surface(21, 21);
    const outline = new Surface(21, 21);
    fill.poly(points, RED);
    outline.polyline(points, RED, true);
    for (let i = 0; i < outline.data.length; i++) {
      if (outline.data[i] === RED) expect(fill.data[i]).toBe(RED);
    }
    expect(count(fill, RED)).toBeGreaterThan(count(outline, RED));
    expect(fill.get(10, 10)).toBe(RED); // the middle
    expect(fill.get(2, 2)).toBe(TRANSPARENT); // between two points
  });

  test("polyline open and closed", () => {
    const s = new Surface(5, 5);
    const tri: [number, number][] = [
      [0, 0],
      [4, 0],
      [4, 4],
    ];
    s.polyline(tri, RED);
    expect(s.get(2, 2)).toBe(TRANSPARENT);
    s.polyline(tri, RED, true);
    expect(s.get(2, 2)).toBe(RED);
  });
});

describe("dither and bayer4", () => {
  test("level 0 paints nothing, level 1 paints everything", () => {
    const s = new Surface(8, 8);
    s.dither(0, 0, 8, 8, RED, 0);
    expect(count(s, RED)).toBe(0);
    s.dither(0, 0, 8, 8, RED, 1);
    expect(count(s, RED)).toBe(64);
  });

  test("coverage matches the level, and half is a checkerboard", () => {
    for (let n = 0; n <= 16; n++) {
      const s = new Surface(8, 8);
      s.dither(0, 0, 8, 8, RED, n / 16);
      expect(count(s, RED)).toBe(n * 4);
    }
    const s = new Surface(4, 4);
    s.dither(0, 0, 4, 4, RED, 0.5);
    expect(dump(s)).toEqual(["#.#.", ".#.#", "#.#.", ".#.#"]);
  });

  test("leaves the pixels it does not paint", () => {
    const s = new Surface(4, 4);
    s.clear(BLUE);
    s.dither(0, 0, 4, 4, RED, 0.25);
    expect(count(s, RED)).toBe(4);
    expect(count(s, BLUE)).toBe(12);
  });

  test("the pattern is anchored to the surface, so pieces line up", () => {
    const whole = new Surface(16, 12);
    const pieces = new Surface(16, 12);
    whole.dither(0, 0, 16, 12, RED, 0.375);
    pieces.dither(0, 0, 5, 12, RED, 0.375);
    pieces.dither(5, 0, 11, 7, RED, 0.375);
    pieces.dither(5, 7, 11, 5, RED, 0.375);
    expect(dump(pieces)).toEqual(dump(whole));
  });

  test("bayer4 agrees with dither and repeats every 4 pixels", () => {
    const s = new Surface(8, 8);
    s.dither(0, 0, 8, 8, RED, 0.3);
    const seen = new Set<number>();
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const threshold = bayer4(x, y);
        expect(threshold).toBeGreaterThan(0);
        expect(threshold).toBeLessThan(1);
        expect(s.get(x, y) === RED).toBe(threshold < 0.3);
        expect(bayer4(x - 4, y + 4)).toBe(threshold);
        seen.add(threshold);
      }
    }
    expect(seen.size).toBe(16);
  });
});

describe("bands", () => {
  const colors = [RED, GREEN, BLUE];

  test("cover the whole rectangle and nothing else", () => {
    for (const dither of [0, 1, 2, 5]) {
      const s = new Surface(20, 40);
      s.bands(3, 4, 13, 31, colors, { dither });
      for (let y = 0; y < 40; y++) {
        for (let x = 0; x < 20; x++) {
          const inside = x >= 3 && x < 16 && y >= 4 && y < 35;
          expect(s.get(x, y) !== TRANSPARENT).toBe(inside);
        }
      }
    }
  });

  test("first colour at the top, last at the bottom, equal heights by default", () => {
    const s = new Surface(4, 30);
    s.bands(0, 0, 4, 30, colors, { dither: 0 });
    expect(
      dump(s, [
        [RED, "r"],
        [GREEN, "g"],
        [BLUE, "b"],
      ])
        .map((r) => r[0])
        .join(""),
    ).toBe("r".repeat(10) + "g".repeat(10) + "b".repeat(10));
  });

  test("stops move the boundaries", () => {
    const s = new Surface(1, 20);
    s.bands(0, 0, 1, 20, colors, { dither: 0, stops: [0.1, 0.5] });
    expect(
      dump(s, [
        [RED, "r"],
        [GREEN, "g"],
        [BLUE, "b"],
      ]).join(""),
    ).toBe("rr" + "g".repeat(8) + "b".repeat(10));
  });

  test("dither touches only the rows next to each boundary", () => {
    const s = new Surface(8, 30);
    s.bands(0, 0, 8, 30, colors, { dither: 2 });
    for (let y = 0; y < 30; y++) {
      const band = colors[Math.floor(y / 10)];
      const nearBoundary = (y >= 8 && y < 12) || (y >= 18 && y < 22);
      let pure = true;
      for (let x = 0; x < 8; x++) if (s.get(x, y) !== band) pure = false;
      if (!nearBoundary) expect(pure).toBe(true);
    }
    // The two colours trade places across a boundary: more of the lower one as you go down.
    const lowerIn = (y: number): number => {
      let n = 0;
      for (let x = 0; x < 8; x++) if (s.get(x, y) === GREEN) n++;
      return n;
    };
    expect(lowerIn(7)).toBe(0);
    expect(lowerIn(8) + lowerIn(9)).toBeGreaterThan(0);
    expect(lowerIn(10) + lowerIn(11)).toBeGreaterThan(lowerIn(8) + lowerIn(9));
    expect(lowerIn(12)).toBe(8);
  });

  test("a transparent band leaves what was there", () => {
    const s = new Surface(8, 20);
    s.clear(GREEN);
    s.bands(0, 0, 8, 20, [TRANSPARENT, RED], { dither: 2 });
    expect(count(s, TRANSPARENT)).toBe(0);
    for (let x = 0; x < 8; x++) {
      expect(s.get(x, 0)).toBe(GREEN);
      expect(s.get(x, 19)).toBe(RED);
    }
    expect(count(s, GREEN) + count(s, RED)).toBe(160);
  });

  test("one colour is a plain fill", () => {
    const s = new Surface(3, 3);
    s.bands(0, 0, 3, 3, [RED]);
    expect(count(s, RED)).toBe(9);
  });
});

describe("blit and copy", () => {
  // A 3 x 2 stamp with a hole:  R G .
  //                             B . R
  const stamp = (): Surface => {
    const s = new Surface(3, 2);
    s.px(0, 0, RED);
    s.px(1, 0, GREEN);
    s.px(0, 1, BLUE);
    s.px(2, 1, RED);
    return s;
  };
  const key: [Color, string][] = [
    [RED, "r"],
    [GREEN, "g"],
    [BLUE, "b"],
    [rgb(0xffffff), "w"],
  ];

  test("blit skips transparent pixels", () => {
    const s = new Surface(5, 4);
    s.clear(rgb(0xffffff));
    s.blit(stamp(), 1, 1);
    expect(dump(s, key)).toEqual(["wwwww", "wrgww", "wbwrw", "wwwww"]);
  });

  test("flips mirror the stamp in place", () => {
    const flip = (flipX: boolean, flipY: boolean): string[] => {
      const s = new Surface(3, 2);
      s.blit(stamp(), 0, 0, { flipX, flipY });
      return dump(s, key);
    };
    expect(flip(false, false)).toEqual(["rg.", "b.r"]);
    expect(flip(true, false)).toEqual([".gr", "r.b"]);
    expect(flip(false, true)).toEqual(["b.r", "rg."]);
    expect(flip(true, true)).toEqual(["r.b", ".gr"]);
  });

  test("a source rectangle, with and without a flip", () => {
    const s = new Surface(2, 2);
    s.blit(stamp(), 0, 0, { sx: 1, sy: 0, sw: 2, sh: 2 });
    expect(dump(s, key)).toEqual(["g.", ".r"]);
    const f = new Surface(2, 2);
    f.blit(stamp(), 0, 0, { sx: 1, sy: 0, sw: 2, sh: 2, flipX: true });
    expect(dump(f, key)).toEqual([".g", "r."]);
  });

  test("blit clips at every edge, flipped or not", () => {
    for (const flipX of [false, true]) {
      for (const flipY of [false, true]) {
        const full = new Surface(9, 8);
        full.blit(stamp(), 3, 3, { flipX, flipY });
        for (const [dx, dy] of [
          [-1, 0],
          [-2, -1],
          [7, 0],
          [0, 7],
          [8, 7],
        ]) {
          const s = new Surface(9, 8);
          s.blit(stamp(), dx, dy, { flipX, flipY });
          for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 9; x++) {
              expect(s.get(x, y)).toBe(full.get(x - dx + 3, y - dy + 3));
            }
          }
        }
      }
    }
  });

  test("a source rectangle that hangs off the source is trimmed", () => {
    const s = new Surface(6, 6);
    s.blit(stamp(), 1, 1, { sx: -1, sy: -1, sw: 5, sh: 4 });
    expect(dump(s, key)).toEqual([
      "......",
      "......",
      "..rg..",
      "..b.r.",
      "......",
      "......",
    ]);
  });

  test("copy replaces everything, transparent pixels included", () => {
    const s = new Surface(5, 4);
    s.clear(rgb(0xffffff));
    s.copy(stamp(), 1, 1);
    expect(dump(s, key)).toEqual(["wwwww", "wrg.w", "wb.rw", "wwwww"]);
  });

  test("copy of a same-size surface, whole and offset", () => {
    const src = new Surface(4, 4);
    src.shadeRect(0, 0, 4, 4, (x, y) => ((x + y) & 1 ? RED : BLUE));
    const whole = new Surface(4, 4);
    whole.copy(src);
    expect(Array.from(whole.data)).toEqual(Array.from(src.data));
    const down = new Surface(4, 4);
    down.copy(src, 0, 2);
    expect(down.get(0, 0)).toBe(TRANSPARENT);
    expect(down.get(0, 2)).toBe(src.get(0, 0));
    expect(down.get(3, 3)).toBe(src.get(3, 1));
    const left = new Surface(4, 4);
    left.copy(src, -3, -1);
    expect(left.get(0, 0)).toBe(src.get(3, 1));
    expect(left.get(1, 0)).toBe(TRANSPARENT);
  });
});

describe("shadeRect", () => {
  test("calls once per clipped pixel with absolute coordinates", () => {
    const s = new Surface(6, 6);
    const seen: string[] = [];
    s.shadeRect(4, 4, 5, 5, (x, y) => {
      seen.push(`${x},${y}`);
      return x === 5 ? TRANSPARENT : RED;
    });
    expect(seen).toEqual(["4,4", "5,4", "4,5", "5,5"]);
    expect(s.get(4, 4)).toBe(RED);
    expect(s.get(5, 4)).toBe(TRANSPARENT);
  });
});

// ---------------------------------------------------------------------------
// Added in review
// ---------------------------------------------------------------------------

describe("construction limits", () => {
  test("an absurd size is a clear RangeError, not an allocation failure", () => {
    expect(() => new Surface(Infinity, 10)).toThrow(RangeError);
    expect(() => new Surface(10, 1e9)).toThrow(/too large/);
    expect(() => new Surface(16384, 1)).not.toThrow();
    expect(new Surface(NaN, -3).w).toBe(1);
  });
});

describe("pushClip and popClip", () => {
  test("pushClip narrows the current clip and popClip puts it back", () => {
    const s = new Surface(10, 10);
    s.clip(2, 2, 6, 6); // x and y 2..7
    s.pushClip(0, 4, 5, 10); // meets it at x 2..4, y 4..7
    s.rect(0, 0, 10, 10, RED);
    expect(count(s, RED)).toBe(3 * 4);
    expect(s.get(2, 4)).toBe(RED);
    expect(s.get(4, 7)).toBe(RED);
    expect(s.get(5, 4)).toBe(TRANSPARENT);
    expect(s.get(2, 3)).toBe(TRANSPARENT);
    s.popClip();
    s.rect(0, 0, 10, 10, BLUE);
    expect(count(s, BLUE)).toBe(36);
  });

  test("they nest, and a painter's push and pop leave the caller's clip alone", () => {
    const s = new Surface(8, 8);
    s.pushClip(1, 1, 6, 6);
    s.pushClip(3, 0, 10, 3);
    s.pushClip(0, 2, 5, 5);
    expect([s.clipX0, s.clipY0, s.clipX1, s.clipY1]).toEqual([3, 2, 5, 3]);
    s.popClip();
    expect([s.clipX0, s.clipY0, s.clipX1, s.clipY1]).toEqual([3, 1, 7, 3]);
    s.popClip();
    expect([s.clipX0, s.clipY0, s.clipX1, s.clipY1]).toEqual([1, 1, 7, 7]);
    s.popClip();
    expect([s.clipX0, s.clipY0, s.clipX1, s.clipY1]).toEqual([0, 0, 8, 8]);
  });

  test("a push that misses the current clip blocks everything until popped", () => {
    const s = new Surface(8, 8);
    s.clip(0, 0, 3, 3);
    s.pushClip(5, 5, 3, 3);
    s.rect(0, 0, 8, 8, RED);
    s.pushClip(NaN, 0, 4, 4);
    s.rect(0, 0, 8, 8, RED);
    s.popClip();
    expect(count(s, RED)).toBe(0);
    s.popClip();
    s.rect(0, 0, 8, 8, RED);
    expect(count(s, RED)).toBe(9);
  });

  test("a pop with nothing pushed removes the clip, and clip or unclip in between does not confuse it", () => {
    const s = new Surface(6, 6);
    s.clip(1, 1, 2, 2);
    s.popClip();
    expect([s.clipX0, s.clipY0, s.clipX1, s.clipY1]).toEqual([0, 0, 6, 6]);
    s.clip(1, 1, 2, 2);
    s.pushClip(0, 0, 6, 6);
    s.unclip();
    s.clip(4, 4, 1, 1);
    s.popClip();
    expect([s.clipX0, s.clipY0, s.clipX1, s.clipY1]).toEqual([1, 1, 3, 3]);
  });
});

describe("dithered shapes", () => {
  /** What a shape must look like at `level`: its solid pixels that the pattern keeps. */
  const expected = (solid: Surface, level: number): string[] => {
    const pattern = new Surface(solid.w, solid.h);
    pattern.dither(0, 0, solid.w, solid.h, RED, level);
    const out = new Surface(solid.w, solid.h);
    out.shadeRect(0, 0, solid.w, solid.h, (x, y) =>
      solid.get(x, y) !== TRANSPARENT && pattern.get(x, y) !== TRANSPARENT
        ? RED
        : TRANSPARENT,
    );
    return dump(out);
  };
  const star: Point[] = [
    [12, 1],
    [15, 9],
    [23, 9],
    [17, 14],
    [20, 22],
    [12, 17],
    [4, 22],
    [7, 14],
    [1, 9],
    [9, 9],
  ];
  const shapes: [string, (s: Surface, level?: number) => void][] = [
    ["disc", (s, level) => s.disc(12, 12, 9, RED, level)],
    ["half disc", (s, level) => s.disc(11, 12, 6.5, RED, level)],
    ["ellipse", (s, level) => s.ellipse(12, 12, 11, 4, RED, true, level)],
    [
      "ellipse outline",
      (s, level) => s.ellipse(12, 12, 9, 6, RED, false, level),
    ],
    ["poly", (s, level) => s.poly(star, RED, level)],
    [
      "thin poly",
      (s, level) =>
        s.poly(
          [
            [2, 2],
            [22, 20],
          ],
          RED,
          level,
        ),
    ],
  ];

  test.each(shapes)(
    "%s: level 1 or none is solid, 0 and NaN draw nothing",
    (_n, draw) => {
      const plain = new Surface(25, 25);
      draw(plain);
      const one = new Surface(25, 25);
      draw(one, 1);
      expect(dump(one)).toEqual(dump(plain));
      expect(count(plain, RED)).toBeGreaterThan(10);
      for (const level of [0, -1, NaN]) {
        const none = new Surface(25, 25);
        draw(none, level);
        expect(count(none, RED)).toBe(0);
      }
      const over = new Surface(25, 25);
      draw(over, 7);
      expect(dump(over)).toEqual(dump(plain));
    },
  );

  test.each(shapes)(
    "%s: a level keeps exactly the pattern's pixels of the solid shape",
    (_n, draw) => {
      const plain = new Surface(25, 25);
      draw(plain);
      for (const level of [0.125, 0.25, 0.5, 0.75]) {
        const s = new Surface(25, 25);
        draw(s, level);
        expect(dump(s)).toEqual(expected(plain, level));
      }
    },
  );

  test("the pattern stays put when the shape moves, so a moving shadow does not flicker", () => {
    const a = new Surface(30, 12);
    a.ellipse(10, 6, 6, 2, RED, true, 0.5);
    const b = new Surface(30, 12);
    b.ellipse(11, 6, 6, 2, RED, true, 0.5);
    for (let y = 0; y < 12; y++) {
      for (let x = 0; x < 30; x++) {
        // Wherever either is painted, the pixel is one of the pattern's "on" pixels.
        if (a.get(x, y) === RED || b.get(x, y) === RED) {
          expect(bayer4(x, y) < 0.5).toBe(true);
        }
      }
    }
  });

  test("dithered shapes respect the clip rect and leave what is underneath", () => {
    const s = new Surface(20, 20);
    s.clear(BLUE);
    s.clip(5, 5, 6, 6);
    s.disc(10, 10, 8, RED, 0.5);
    s.poly(
      [
        [0, 0],
        [19, 0],
        [19, 19],
        [0, 19],
      ],
      RED,
      0.5,
    );
    s.unclip();
    expect(count(s, RED)).toBe(18);
    expect(count(s, BLUE)).toBe(400 - 18);
  });
});

describe("band edges", () => {
  const key: [Color, string][] = [
    [RED, "r"],
    [GREEN, "g"],
    [BLUE, "b"],
  ];

  test("the default edge is one dot in four, two rows of checkerboard, one dot in four", () => {
    const s = new Surface(8, 20);
    s.bands(0, 0, 8, 20, [RED, GREEN]);
    expect(dump(s, key).slice(7, 13)).toEqual([
      "rrrrrrrr",
      "grrrgrrr",
      "rgrgrgrg",
      "grgrgrgr",
      "ggrgggrg",
      "gggggggg",
    ]);
  });

  test("dither 1 is the two dotted rows; dither 3 adds a sparser row outside", () => {
    const one = new Surface(8, 20);
    one.bands(0, 0, 8, 20, [RED, GREEN], { dither: 1 });
    expect(dump(one, key).slice(8, 12)).toEqual([
      "rrrrrrrr",
      "grrrgrrr",
      "ggrgggrg",
      "gggggggg",
    ]);
    const three = new Surface(16, 20);
    three.bands(0, 0, 16, 20, [RED, GREEN], { dither: 3 });
    const greens = dump(three, key).map((r) => r.split("g").length - 1);
    expect(greens.slice(6, 14)).toEqual([0, 2, 4, 8, 8, 12, 14, 16]);
  });

  test("an edge looks the same wherever it falls", () => {
    const picture = (y: number, x: number, dither: number): string[] => {
      const s = new Surface(24, 60);
      s.bands(x, y, 16, 37, [RED, GREEN, BLUE], { dither, stops: [0.3, 0.7] });
      return dump(s, key)
        .slice(y, y + 37)
        .map((r) => r.slice(x, x + 16));
    };
    for (const dither of [1, 2, 3, 4, 6]) {
      const first = picture(0, 0, dither);
      for (let y = 1; y < 9; y++) expect(picture(y, 0, dither)).toEqual(first);
      // Across, the pattern repeats every 8 pixels and is fixed to the surface.
      expect(picture(3, 8, dither)).toEqual(first);
    }
  });

  test("two calls side by side join up", () => {
    const whole = new Surface(21, 30);
    whole.bands(0, 0, 21, 30, [RED, GREEN, BLUE], { dither: 3 });
    const parts = new Surface(21, 30);
    parts.bands(0, 0, 5, 30, [RED, GREEN, BLUE], { dither: 3 });
    parts.bands(5, 0, 9, 30, [RED, GREEN, BLUE], { dither: 3 });
    parts.bands(14, 0, 7, 30, [RED, GREEN, BLUE], { dither: 3 });
    expect(dump(parts, key)).toEqual(dump(whole, key));
  });

  test("the two sides of a boundary mirror each other", () => {
    for (const dither of [1, 2, 3, 4, 5, 6, 8]) {
      const s = new Surface(8, 40);
      s.bands(0, 0, 8, 40, [RED, GREEN], { dither });
      for (let d = 0; d < dither; d++) {
        let lowerAbove = 0;
        let upperBelow = 0;
        for (let x = 0; x < 8; x++) {
          if (s.get(x, 19 - d) === GREEN) lowerAbove++;
          if (s.get(x, 20 + d) === RED) upperBelow++;
        }
        expect(lowerAbove).toBe(upperBelow);
        expect(lowerAbove).toBeGreaterThan(0);
        expect(lowerAbove).toBeLessThanOrEqual(4);
      }
      // Nothing beyond the zone.
      for (let x = 0; x < 8; x++) {
        expect(s.get(x, 19 - dither)).toBe(RED);
        expect(s.get(x, 20 + dither)).toBe(GREEN);
      }
    }
  });

  test("a huge height is clipped, not overflowed", () => {
    const s = new Surface(4, 10);
    s.bands(0, -5e9, 4, 1e10, [RED, GREEN], { dither: 0 });
    expect(count(s, GREEN)).toBe(40);
    s.bands(0, 0, 4, 1e10, [RED, GREEN]);
    expect(count(s, RED)).toBe(40);
  });
});

describe("a surface drawn onto itself", () => {
  const picture = (): Surface => {
    const s = new Surface(6, 4);
    s.rect(0, 0, 2, 4, RED);
    s.rect(2, 1, 2, 2, BLUE);
    s.px(5, 3, GREEN);
    return s;
  };
  const key: [Color, string][] = [
    [RED, "r"],
    [GREEN, "g"],
    [BLUE, "b"],
  ];

  test("copy scrolls the picture in any direction", () => {
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [2, 1],
      [-3, -2],
    ]) {
      const s = picture();
      s.copy(s, dx, dy);
      const want = picture();
      want.copy(picture(), dx, dy);
      expect(dump(s, key)).toEqual(dump(want, key));
    }
    const still = picture();
    still.copy(still);
    expect(dump(still, key)).toEqual(dump(picture(), key));
  });

  test("blit reads the picture as it was", () => {
    for (const opts of [{}, { flipX: true }, { flipY: true, sx: 1, sw: 4 }]) {
      const s = picture();
      s.blit(s, 1, 1, opts);
      const want = picture();
      want.blit(picture(), 1, 1, opts);
      expect(dump(s, key)).toEqual(dump(want, key));
    }
  });
});

describe("recolor", () => {
  test("maps every colour, calling the function once per distinct colour", () => {
    const s = new Surface(6, 4);
    s.rect(0, 0, 6, 2, RED);
    s.rect(1, 1, 2, 2, BLUE);
    const seen: Color[] = [];
    s.recolor((c) => {
      seen.push(c);
      return c === RED ? GREEN : c;
    });
    expect(seen.sort()).toEqual([RED, BLUE].sort());
    expect(count(s, RED)).toBe(0);
    expect(count(s, GREEN)).toBe(10);
    expect(count(s, BLUE)).toBe(4);
    expect(count(s, TRANSPARENT)).toBe(10);
  });

  test("returning TRANSPARENT erases; transparent pixels are never passed in", () => {
    const s = new Surface(4, 4);
    s.rect(0, 0, 2, 4, RED);
    s.recolor((c) => {
      expect(c).not.toBe(TRANSPARENT);
      return TRANSPARENT;
    });
    expect(count(s, TRANSPARENT)).toBe(16);
  });

  test("a rectangle and the clip rect limit it", () => {
    const s = new Surface(6, 6);
    s.clear(RED);
    s.recolor(() => BLUE, 1, 1, 3, 3);
    expect(count(s, BLUE)).toBe(9);
    s.clip(0, 0, 2, 2);
    s.recolor(() => GREEN);
    s.recolor(() => GREEN, NaN, 0, 3, 3);
    s.recolor(() => GREEN, 0, 0, -3, 3);
    s.unclip();
    expect(count(s, GREEN)).toBe(4);
    expect(s.get(1, 1)).toBe(GREEN);
    expect(s.get(2, 2)).toBe(BLUE);
  });

  test("a second call starts fresh", () => {
    const s = new Surface(2, 1);
    s.clear(RED);
    s.recolor(() => BLUE);
    s.clear(RED);
    s.recolor(() => GREEN);
    expect(count(s, GREEN)).toBe(2);
  });
});

describe("outline", () => {
  test("paints the transparent pixels that touch a painted one", () => {
    const s = new Surface(7, 6);
    s.rect(2, 2, 3, 2, RED);
    s.outline(BLUE);
    expect(
      dump(s, [
        [RED, "#"],
        [BLUE, "o"],
      ]),
    ).toEqual([
      ".......",
      "..ooo..",
      ".o###o.",
      ".o###o.",
      "..ooo..",
      ".......",
    ]);
  });

  test("corners fills the diagonals too", () => {
    const s = new Surface(5, 5);
    s.px(2, 2, RED);
    s.outline(BLUE, true);
    expect(
      dump(s, [
        [RED, "#"],
        [BLUE, "o"],
      ]),
    ).toEqual([".....", ".ooo.", ".o#o.", ".ooo.", "....."]);
  });

  test("it does not grow from its own pixels, wrap round the edges, or leave the clip", () => {
    const s = new Surface(4, 3);
    s.px(3, 0, RED);
    s.outline(BLUE, true);
    // (0, 1) is next to (3, 0) in memory, but not on the surface.
    expect(
      dump(s, [
        [RED, "#"],
        [BLUE, "o"],
      ]),
    ).toEqual(["..o#", "..oo", "...."]);
    s.outline(BLUE, true);
    expect(
      dump(s, [
        [RED, "#"],
        [BLUE, "o"],
      ]),
    ).toEqual([".oo#", ".ooo", ".ooo"]);
    const t = new Surface(5, 5);
    t.px(2, 2, RED);
    t.clip(0, 0, 5, 2);
    t.outline(BLUE);
    t.outline(TRANSPARENT);
    t.unclip();
    expect(count(t, BLUE)).toBe(1);
    expect(t.get(2, 1)).toBe(BLUE);
  });
});

describe("mask and cut", () => {
  const layer = (): Surface => {
    const s = new Surface(8, 6);
    s.clear(RED);
    return s;
  };
  const shape = (): Surface => {
    const s = new Surface(4, 3);
    s.rect(0, 0, 4, 3, BLUE);
    s.erase(1, 1, 2, 1);
    return s;
  };

  test("mask keeps what is under the shape and erases everything else", () => {
    const s = layer();
    s.mask(shape(), 2, 1);
    expect(dump(s)).toEqual([
      "........",
      "..####..",
      "..#..#..",
      "..####..",
      "........",
      "........",
    ]);
  });

  test("cut erases what is under the shape", () => {
    const s = layer();
    s.cut(shape(), 2, 1);
    expect(dump(s)).toEqual([
      "########",
      "##....##",
      "##.##.##",
      "##....##",
      "########",
      "########",
    ]);
  });

  test("the shape may hang off the layer, and the clip rect limits both", () => {
    const s = layer();
    s.mask(shape(), -2, -1);
    expect(dump(s).slice(0, 3)).toEqual([".#......", "##......", "........"]);
    const t = layer();
    t.clip(0, 0, 4, 6);
    t.mask(shape(), 2, 1);
    t.cut(shape(), 1, 0);
    t.unclip();
    expect(dump(t)).toEqual([
      "....####",
      "..######",
      "....####",
      "..######",
      "....####",
      "....####",
    ]);
  });

  test("odd positions do nothing, and a surface can be its own shape", () => {
    const s = layer();
    s.mask(shape(), NaN, 0);
    s.cut(shape(), 0, Infinity);
    expect(count(s, RED)).toBe(48);
    s.mask(s);
    expect(count(s, RED)).toBe(48);
    s.erase(0, 0, 8, 1);
    s.cut(s, 0, 1); // erases wherever the picture one row up is painted
    expect(dump(s)).toEqual([
      "........",
      "########",
      "........",
      "........",
      "........",
      "........",
    ]);
  });
});

describe("degenerate polygons and lines", () => {
  test("no points, one point, two points", () => {
    const s = new Surface(8, 8);
    s.poly([], RED);
    s.polyline([], RED);
    expect(count(s, RED)).toBe(0);
    s.poly([[3, 3]], RED);
    expect(count(s, RED)).toBe(1);
    s.poly(
      [
        [1, 1],
        [6, 1],
      ],
      BLUE,
    );
    expect(count(s, BLUE)).toBe(6);
  });

  test("repeated, collinear and zero-area points draw their outline and nothing else", () => {
    const same = new Surface(8, 8);
    same.poly(
      [
        [2, 2],
        [2, 2],
        [2, 2],
        [2, 2],
      ],
      RED,
    );
    expect(count(same, RED)).toBe(1);
    const flat = new Surface(8, 8);
    flat.poly(
      [
        [1, 4],
        [3, 4],
        [6, 4],
        [3, 4],
      ],
      RED,
    );
    expect(dump(flat)[4]).toBe(".######.");
    expect(count(flat, RED)).toBe(6);
    const diagonal = new Surface(8, 8);
    diagonal.poly(
      [
        [0, 0],
        [7, 7],
        [3, 3],
        [7, 7],
        [0, 0],
      ],
      RED,
    );
    expect(count(diagonal, RED)).toBe(8);
  });

  test("a bow tie fills both wings and the points may be given in either direction", () => {
    const bow: Point[] = [
      [0, 0],
      [8, 8],
      [8, 0],
      [0, 8],
    ];
    const a = new Surface(9, 9);
    a.poly(bow, RED);
    const b = new Surface(9, 9);
    b.poly([...bow].reverse(), RED);
    expect(dump(a)).toEqual(dump(b));
    expect(a.get(1, 4)).toBe(RED); // left wing
    expect(a.get(7, 4)).toBe(RED); // right wing
    expect(a.get(4, 1)).toBe(TRANSPARENT); // the notch above the knot
    expect(a.get(4, 7)).toBe(TRANSPARENT);
  });

  test("points far off the surface, NaN and fractions", () => {
    const s = new Surface(10, 10);
    s.poly(
      [
        [-1e9, -1e9],
        [1e9, -1e9],
        [1e9, 1e9],
        [-1e9, 1e9],
      ],
      RED,
    );
    expect(count(s, RED)).toBe(100);
    const t = new Surface(10, 10);
    t.poly(
      [
        [0, 0],
        [NaN, 5],
        [5, 5],
      ],
      RED,
    );
    t.polyline(
      [
        [0, 0],
        [Infinity, 5],
      ],
      RED,
    );
    t.line(0, 0, 5, NaN, RED);
    expect(count(t, RED)).toBe(0);
    t.poly(
      [
        [0.4, 0.4],
        [2.6, 0.4],
        [2.6, 1.5],
        [0.4, 1.5],
      ],
      RED,
    );
    expect(dump(t).slice(0, 3)).toEqual([
      "####......",
      "####......",
      "####......",
    ]);
  });

  test("a zero-length line is one pixel, and radius 0 and 0.5 are 1 and 4", () => {
    const s = new Surface(6, 6);
    s.line(2, 2, 2, 2, RED);
    expect(count(s, RED)).toBe(1);
    const t = new Surface(6, 6);
    t.disc(2, 2, 0, RED);
    t.circle(2, 2, 0, RED);
    expect(count(t, RED)).toBe(1);
    const u = new Surface(6, 6);
    u.disc(2, 2, 0.5, RED);
    expect(dump(u).slice(1, 5)).toEqual([
      "......",
      "..##..",
      "..##..",
      "......",
    ]);
    const v = new Surface(6, 6);
    v.circle(2, 2, 0.5, BLUE);
    v.ellipse(2, 2, 0, 0.5, RED, true);
    expect(count(v, BLUE)).toBe(2);
    expect(count(v, RED)).toBe(2);
    expect(v.get(2, 3)).toBe(RED);
  });
});
