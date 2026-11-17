// The tab icon: the drawing (tab-icon.ts), and the file the site serves
// (public/favicon.svg), which must hold exactly that drawing.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { TRANSPARENT, type Color } from "~/pixel";
import { type Picture, decodePng } from "../../tools/png";
import { P } from "./palette";
import {
  TAB_ICON_BALL_R,
  TAB_ICON_SIZE,
  drawTabIcon,
  drawTabIconBall,
  tabIconLetters,
} from "./tab-icon";

const SIZE = TAB_ICON_SIZE;
/** The letters' yellow: lit, plain and shaded, and the glint on each. */
const YELLOW: readonly Color[] = [P.goldLight, P.gold, P.goldDark, P.white];

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  n: number;
}

/** The rows and columns that hold pixels `keep` says yes to, and how many there are. */
function box(keep: (x: number, y: number) => boolean): Box {
  const b = { x0: SIZE, y0: SIZE, x1: -1, y1: -1, n: 0 };
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (!keep(x, y)) continue;
      b.x0 = Math.min(b.x0, x);
      b.y0 = Math.min(b.y0, y);
      b.x1 = Math.max(b.x1, x);
      b.y1 = Math.max(b.y1, y);
      b.n++;
    }
  }
  return b;
}

describe("the tab icon's drawing", () => {
  const icon = drawTabIcon();
  const ball = drawTabIconBall();
  const letters = tabIconLetters();
  /** Which letter's yellow a pixel is: 1, 2, or 0 (also off the picture). */
  const letter = (x: number, y: number): number =>
    x >= 0 && x < SIZE && y >= 0 && y < SIZE ? letters[y * SIZE + x] : 0;
  const first = box((x, y) => letter(x, y) === 1);
  const second = box((x, y) => letter(x, y) === 2);
  /** The lengths of the runs of letter `n` on row `y`, left to right. */
  const runsOn = (n: number, y: number): number[] => {
    const out: number[] = [];
    let run = 0;
    for (let x = 0; x <= SIZE; x++) {
      if (letter(x, y) === n) run++;
      else if (run > 0) {
        out.push(run);
        run = 0;
      }
    }
    return out;
  };

  it("is 32 x 32 and the same every time", () => {
    expect([icon.w, icon.h]).toEqual([32, 32]);
    expect(drawTabIcon().data).toEqual(icon.data);
  });

  it("has the home screen's ball behind the letters: round, and as big as the picture", () => {
    const b = box((x, y) => ball.get(x, y) !== TRANSPARENT);
    const across = Math.round(2 * TAB_ICON_BALL_R) + 1;
    expect(across).toBe(SIZE);
    expect([b.x1 - b.x0 + 1, b.y1 - b.y0 + 1]).toEqual([across, across]);
    // the menu's ball, nothing on its patches: leather, black panels and an ink outline,
    // and no colour of a mode
    const tones = new Set<Color>();
    for (let i = 0; i < ball.data.length; i++) tones.add(ball.data[i] as Color);
    expect(tones.has(P.ink)).toBe(true);
    expect(tones.has(P.chalk)).toBe(true);
    for (const c of [P.home, P.away, P.retro, P.nextgen, P.gold]) {
      expect(tones.has(c)).toBe(false);
    }
  });

  it("shows the ball wherever the letters are not, and more than half of it", () => {
    let shown = 0;
    let all = 0;
    let rim = 0;
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const under = ball.get(x, y);
        const c = icon.get(x, y);
        if (letter(x, y) !== 0) {
          // a letter's pixel is one of its yellows
          expect(YELLOW, `at ${x},${y}`).toContain(c);
        } else if (c !== under) {
          // anything else that is not the ball is the ink round a letter
          expect(c, `at ${x},${y}`).toBe(P.ink);
        }
        if (under === TRANSPARENT) continue;
        all++;
        if (letter(x, y) === 0 && c === under) shown++;
        // its outline is whole, every pixel of it
        const edge = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].some(([dx, dy]) => ball.get(x + dx, y + dy) === TRANSPARENT);
        if (edge) {
          rim++;
          expect(c, `rim at ${x},${y}`).toBe(under);
        }
      }
    }
    expect(shown / all).toBeGreaterThan(0.55);
    expect(rim).toBeGreaterThan(80);
    // and its black patches above and below the letters, on the picture's middle column
    const middle = SIZE / 2;
    expect(icon.get(middle, 2)).toBe(ball.get(middle, 2));
    expect(icon.get(middle, SIZE - 3)).toBe(ball.get(middle, SIZE - 3));
    expect(ball.get(middle, 2)).not.toBe(P.chalk);
  });

  it("stands two letters in the middle of the ball, each a little over half its height", () => {
    // 17 tall to the ball's 32: smaller than the ball (the product owner, of letters taller
    // than it: "make the SS smaller, I don't like it")
    expect(first.y1 - first.y0 + 1).toBe(17);
    expect(second.y1 - second.y0 + 1).toBe(17);
    // the pair is in the middle of the picture, both ways, with room all round
    const pair = box((x, y) => letter(x, y) !== 0);
    expect(
      Math.abs((pair.x0 + pair.x1) / 2 - (SIZE - 1) / 2),
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs((pair.y0 + pair.y1) / 2 - (SIZE - 1) / 2),
    ).toBeLessThanOrEqual(1);
    expect(pair.x0).toBeGreaterThanOrEqual(5);
    expect(pair.x1).toBeLessThanOrEqual(SIZE - 6);
    expect(pair.y0).toBeGreaterThanOrEqual(4);
    expect(pair.y1).toBeLessThanOrEqual(SIZE - 5);
  });

  it("stands them side by side on one line, not as a staircase, with ink between them", () => {
    // the product owner, of a second letter a step lower: "no don't staircase"
    expect(second.y0).toBe(first.y0);
    expect(second.y1).toBe(first.y1);
    // ten to the right: they touch at anything under that
    expect(second.x0 - first.x0).toBe(10);
    expect(second.x1 - first.x1).toBe(10);
    // both are whole
    expect(second.n).toBe(first.n);
    // a line of ink parts them: no pixel of one touches a pixel of the other, corners too
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const n = letter(x, y);
        if (n === 0) continue;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const m = letter(x + dx, y + dy);
            // its own yellow, or ink: never the other letter, never the ball
            if (m === n) continue;
            expect(m, `${x},${y}`).toBe(0);
            expect(icon.get(x + dx, y + dy), `${x},${y}`).toBe(P.ink);
          }
        }
      }
    }
  });

  it("is italic: the letters lean to the right as they rise", () => {
    // (the second letter; the first is the same)
    const mean = (y0: number, y1: number): number => {
      const b = box((x, y) => y >= y0 && y <= y1 && letter(x, y) === 2);
      return (b.x0 + b.x1) / 2;
    };
    const lean =
      mean(second.y0, second.y0 + 4) - mean(second.y1 - 4, second.y1);
    expect(lean).toBeGreaterThanOrEqual(2);
    expect(lean).toBeLessThanOrEqual(5);
  });

  it("draws round S's, not bolts: the flat of a curve at head and foot, and a stroke that doubles back", () => {
    // (the second letter; the first is checked against it below)
    // it begins and ends in the flat of a curve, three across or more, not in a point,
    // and is six across a row further in
    for (const [y, inner] of [
      [second.y0, second.y0 + 1],
      [second.y1, second.y1 - 1],
    ]) {
      const ends = runsOn(2, y);
      expect(ends, `row ${y}`).toHaveLength(1);
      expect(ends[0], `row ${y}`).toBeGreaterThanOrEqual(3);
      expect(runsOn(2, inner)[0], `row ${inner}`).toBeGreaterThanOrEqual(6);
    }
    // near the head and near the foot a row crosses it twice (the bowl and its hook),
    // which a zigzag of straight strokes never does
    for (const y of [second.y0 + 4, second.y1 - 4]) {
      expect(runsOn(2, y), `row ${y}`).toHaveLength(2);
    }
    // and its middle is one stroke
    expect(runsOn(2, Math.round((second.y0 + second.y1) / 2))).toHaveLength(1);
    // the first is the same letter, ten to the left
    let same = 0;
    for (let y = first.y0; y <= first.y1; y++) {
      for (let x = first.x0; x <= first.x1; x++) {
        if (letter(x, y) !== 1) continue;
        expect(letter(x + 10, y), `${x},${y}`).toBe(2);
        same++;
      }
    }
    expect(same).toBe(first.n);
  });

  it("lights the yellow from the top left: pale above and left, deep below and right, a glint on each", () => {
    const tally = (n: number): Record<string, number> => {
      const t = { pale: 0, plain: 0, deep: 0, glint: 0 };
      for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
          if (letter(x, y) !== n) continue;
          const c = icon.get(x, y);
          if (c === P.goldLight) t.pale++;
          else if (c === P.gold) t.plain++;
          else if (c === P.goldDark) t.deep++;
          else t.glint++;
        }
      }
      return t;
    };
    for (const n of [1, 2]) {
      const t = tally(n);
      expect(t.pale, `letter ${n}`).toBeGreaterThan(20);
      expect(t.plain, `letter ${n}`).toBeGreaterThan(20);
      expect(t.deep, `letter ${n}`).toBeGreaterThan(10);
      // two pixels of glint, on its second row
      expect(t.glint, `letter ${n}`).toBe(2);
    }
    for (const [n, b] of [
      [1, first],
      [2, second],
    ] as const) {
      const glint = box(
        (x, y) =>
          letter(x, y) === n && y === b.y0 + 1 && icon.get(x, y) === P.white,
      );
      expect(glint.n, `letter ${n}`).toBe(2);
    }
  });
});

describe("public/favicon.svg", () => {
  const svg = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "..",
      "public",
      "favicon.svg",
    ),
    "utf8",
  );

  /** The PNG in the file, decoded: its size and its pixels as R, G, B, A bytes. */
  function picture(): Picture {
    const data = /href="data:image\/png;base64,([A-Za-z0-9+/=]+)"/.exec(
      svg,
    )?.[1];
    expect(data).toBeDefined();
    return decodePng(Buffer.from(data ?? "", "base64"));
  }

  it("is an SVG, 32 x 32, that holds one picture and nothing else", () => {
    const body = svg.slice(svg.indexOf("<svg"));
    expect(body).toContain('viewBox="0 0 32 32"');
    const tags = [...body.matchAll(/<([a-zA-Z]+)/g)].map((m) => m[1]);
    expect(tags).toEqual(["svg", "image"]);
    expect(body).toContain(
      '<image width="32" height="32" href="data:image/png;base64,',
    );
    // nothing fetched from anywhere: a picture inside a picture may not load one
    expect(body).not.toMatch(/https?:\/\/(?!www\.w3\.org\/2000\/svg)/);
  });

  it("holds exactly the drawing, every pixel of it four times across and down", () => {
    const { w, h, rgba } = picture();
    const icon = drawTabIcon();
    expect([w, h]).toEqual([SIZE * 4, SIZE * 4]);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const c = icon.get(x >> 2, y >> 2);
        const o = (y * w + x) * 4;
        const want =
          c === TRANSPARENT
            ? [0, 0, 0, 0]
            : [c & 0xff, (c >>> 8) & 0xff, (c >>> 16) & 0xff, 255];
        expect([rgba[o], rgba[o + 1], rgba[o + 2], rgba[o + 3]]).toEqual(want);
      }
    }
  });
});
