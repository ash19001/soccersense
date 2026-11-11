import { describe, expect, test } from "vitest";

import { TRANSPARENT, rgb, type Color } from "./color";
import { Surface } from "./surface";
import {
  FONT_3x5,
  FONT_5x7,
  drawText,
  foldText,
  measureText,
  wrapText,
  type BitmapFont,
  type TextOptions,
} from "./text";

const INK = rgb(0x000000);
const RED = rgb(0xff0000);
const BLUE = rgb(0x0000ff);

/** Columns that contain ink of colour `c`: [first, last], or null if there is none. */
function inkSpan(s: Surface, c: Color): [number, number] | null {
  let first = -1;
  let last = -1;
  for (let x = 0; x < s.w; x++) {
    for (let y = 0; y < s.h; y++) {
      if (s.get(x, y) === c) {
        if (first < 0) first = x;
        last = x;
        break;
      }
    }
  }
  return first < 0 ? null : [first, last];
}

function rowsOf(s: Surface, c: Color): [number, number] | null {
  let first = -1;
  let last = -1;
  for (let y = 0; y < s.h; y++) {
    for (let x = 0; x < s.w; x++) {
      if (s.get(x, y) === c) {
        if (first < 0) first = y;
        last = y;
        break;
      }
    }
  }
  return first < 0 ? null : [first, last];
}

function glyphPicture(font: BitmapFont, ch: string): string {
  const g = font.glyphs[ch.charCodeAt(0)];
  if (g === undefined) return "";
  return Array.from(g.rows, (bits) => {
    let row = "";
    for (let x = 0; x < g.w; x++) row += bits & (1 << x) ? "#" : ".";
    return row;
  }).join("\n");
}

describe("fonts", () => {
  test("FONT_5x7 covers ASCII 32 to 126 and the middle dot", () => {
    for (let code = 32; code <= 126; code++) {
      expect(FONT_5x7.glyphs[code], String.fromCharCode(code)).toBeDefined();
    }
    expect(FONT_5x7.glyphs[0xb7]).toBeDefined();
    expect(FONT_5x7.height).toBe(9);
    expect(FONT_5x7.capHeight).toBe(7);
    expect(FONT_5x7.lineHeight).toBeGreaterThan(FONT_5x7.height);
  });

  test("FONT_3x5 has capitals, digits and its punctuation, and maps lowercase to capitals", () => {
    for (const ch of "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,:;!?'\"-+/()%&# ·") {
      expect(FONT_3x5.glyphs[ch.charCodeAt(0)], ch).toBeDefined();
    }
    expect(FONT_3x5.glyphs["a".charCodeAt(0)]).toBe(
      FONT_3x5.glyphs["A".charCodeAt(0)],
    );
    expect(FONT_3x5.upperOnly).toBe(true);
    expect(FONT_3x5.capHeight).toBe(5);
  });

  test("capitals and digits are full height and sit on the baseline", () => {
    for (const font of [FONT_5x7, FONT_3x5]) {
      for (const ch of "ABCDEFGHIJKLMNOPRSTUVWXYZ0123456789") {
        const g = font.glyphs[ch.charCodeAt(0)];
        expect(g, ch).toBeDefined();
        if (g === undefined) continue;
        expect(g.rows[0], `${font.name} ${ch} top`).not.toBe(0);
        expect(g.rows[font.capHeight - 1], `${font.name} ${ch} base`).not.toBe(
          0,
        );
        for (let r = font.capHeight; r < font.height; r++) {
          expect(g.rows[r], `${font.name} ${ch} below baseline`).toBe(0);
        }
      }
    }
  });

  test("descenders hang below the baseline", () => {
    for (const ch of "gjpqy") {
      const g = FONT_5x7.glyphs[ch.charCodeAt(0)];
      expect(g?.rows[7], ch).not.toBe(0);
    }
    for (const ch of "abcdefhiklmnorstuvwxz") {
      const g = FONT_5x7.glyphs[ch.charCodeAt(0)];
      expect(g?.rows[7], ch).toBe(0);
    }
  });

  test("narrow characters are narrow", () => {
    const w = (ch: string): number => measureText(ch);
    expect(w("W")).toBe(5);
    for (const ch of "I1il!.,:;'") expect(w(ch), ch).toBeLessThan(w("W"));
    expect(w("i")).toBe(1);
  });

  test("look-alikes are different glyphs", () => {
    const pairs: [string, string][] = [
      ["0", "O"],
      ["1", "I"],
      ["1", "l"],
      ["I", "l"],
      ["5", "S"],
      ["8", "B"],
      ["2", "Z"],
      ["0", "D"],
      ["6", "G"],
    ];
    for (const [a, b] of pairs) {
      expect(glyphPicture(FONT_5x7, a), `${a} vs ${b}`).not.toBe(
        glyphPicture(FONT_5x7, b),
      );
    }
    for (const [a, b] of pairs.filter(([a, b]) => a !== "l" && b !== "l")) {
      expect(glyphPicture(FONT_3x5, a), `small ${a} vs ${b}`).not.toBe(
        glyphPicture(FONT_3x5, b),
      );
    }
  });

  test("no two characters share a glyph", () => {
    for (const font of [FONT_5x7, FONT_3x5]) {
      const seen = new Map<string, string>();
      for (let code = 33; code <= 126; code++) {
        const ch = String.fromCharCode(code);
        if (font.upperOnly && ch >= "a" && ch <= "z") continue;
        const picture = glyphPicture(font, ch);
        if (picture === "") continue;
        expect(seen.get(picture), `${font.name}: ${ch}`).toBeUndefined();
        seen.set(picture, ch);
      }
    }
  });
});

describe("drawText and measureText", () => {
  const samples = [
    "TODAY'S STADIUM",
    "ANFIELD",
    "Estadio Santiago Bernabéu",
    "TOP BINS! +87 PTS",
    "the quick brown fox jumps over the lazy dog",
    "0123456789",
    "il1",
    "",
    " ",
    "Ørjan Nyßen — Łódź",
    "☺?",
  ];
  const variants: TextOptions[] = [
    {},
    { font: FONT_3x5 },
    { scale: 2 },
    { spacing: 2 },
    { font: FONT_3x5, scale: 3, spacing: 1 },
    { tabular: true },
    { shadow: BLUE },
    { outline: BLUE },
  ];

  test("the returned width equals measureText and the inked columns", () => {
    for (const text of samples) {
      for (const opts of variants) {
        const s = new Surface(700, 40);
        const width = drawText(s, text, 10, 10, RED, opts);
        expect(width, `${text} ${JSON.stringify(opts)}`).toBe(
          measureText(text, opts),
        );
        const span = inkSpan(s, RED);
        const visible = text.trim() !== "";
        if (!visible) {
          expect(span).toBeNull();
        } else if (span !== null && text === text.trim() && !opts.tabular) {
          // Ink starts at x and ends at x + width - 1.
          expect(span).toEqual([10, 10 + width - 1]);
        }
      }
    }
  });

  test("known widths", () => {
    expect(measureText("A")).toBe(5);
    expect(measureText("AB")).toBe(11);
    expect(measureText("A B")).toBe(5 + 1 + 3 + 1 + 5);
    expect(measureText("AB", { spacing: 2 })).toBe(13);
    expect(measureText("AB", { scale: 3 })).toBe(33);
    expect(measureText("AB", { font: FONT_3x5 })).toBe(7);
    expect(measureText("ab", { font: FONT_3x5 })).toBe(7);
    expect(measureText("")).toBe(0);
  });

  test("capitals fill capHeight rows from y; descenders hang below", () => {
    const s = new Surface(40, 30);
    drawText(s, "H", 2, 5, RED);
    expect(rowsOf(s, RED)).toEqual([5, 11]);
    const t = new Surface(40, 30);
    drawText(t, "g", 2, 5, RED);
    expect(rowsOf(t, RED)).toEqual([7, 13]);
    const u = new Surface(40, 30);
    drawText(u, "H", 2, 5, RED, { font: FONT_3x5, scale: 2 });
    expect(rowsOf(u, RED)).toEqual([5, 14]);
  });

  test("align moves the text relative to x", () => {
    const width = measureText("GOAL");
    const left = new Surface(100, 12);
    drawText(left, "GOAL", 50, 1, RED);
    expect(inkSpan(left, RED)).toEqual([50, 50 + width - 1]);
    const right = new Surface(100, 12);
    drawText(right, "GOAL", 50, 1, RED, { align: "right" });
    expect(inkSpan(right, RED)).toEqual([50 - width, 49]);
    const center = new Surface(100, 12);
    drawText(center, "GOAL", 50, 1, RED, { align: "center" });
    expect(inkSpan(center, RED)).toEqual([
      50 - Math.floor(width / 2),
      50 - Math.floor(width / 2) + width - 1,
    ]);
  });

  test("shadow sits one pixel down and right, under the text", () => {
    const plain = new Surface(30, 14);
    drawText(plain, "Hi!", 2, 2, RED);
    const s = new Surface(30, 14);
    drawText(s, "Hi!", 2, 2, RED, { shadow: BLUE });
    for (let y = 0; y < 14; y++) {
      for (let x = 0; x < 30; x++) {
        const ink = plain.get(x, y) === RED;
        const under = plain.get(x - 1, y - 1) === RED;
        expect(s.get(x, y)).toBe(ink ? RED : under ? BLUE : TRANSPARENT);
      }
    }
  });

  test("outline surrounds every inked pixel on all eight sides", () => {
    const plain = new Surface(30, 14);
    drawText(plain, "Qj", 3, 3, RED);
    const s = new Surface(30, 14);
    drawText(s, "Qj", 3, 3, RED, { outline: INK });
    for (let y = 0; y < 14; y++) {
      for (let x = 0; x < 30; x++) {
        const ink = plain.get(x, y) === RED;
        let near = false;
        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            if (plain.get(x + ox, y + oy) === RED) near = true;
          }
        }
        expect(s.get(x, y)).toBe(ink ? RED : near ? INK : TRANSPARENT);
      }
    }
  });

  test("scale draws each font pixel as a block", () => {
    const one = new Surface(12, 12);
    const three = new Surface(36, 36);
    drawText(one, "R", 1, 1, RED);
    drawText(three, "R", 3, 3, RED, { scale: 3 });
    for (let y = 0; y < 36; y++) {
      for (let x = 0; x < 36; x++) {
        expect(three.get(x, y)).toBe(
          one.get(Math.floor(x / 3), Math.floor(y / 3)),
        );
      }
    }
  });

  test("tabular gives every digit the same width", () => {
    const opts = { tabular: true };
    expect(measureText("111", opts)).toBe(measureText("000", opts));
    expect(measureText("12:34", opts)).toBe(measureText("11:11", opts));
    expect(measureText("111")).toBeLessThan(measureText("000"));
  });

  test("new lines stack by lineHeight and the width is the widest line", () => {
    const s = new Surface(60, 40);
    const width = drawText(s, "H\nHHH\nH", 2, 3, RED);
    expect(width).toBe(measureText("HHH"));
    expect(measureText("H\nHHH\nH")).toBe(width);
    expect(rowsOf(s, RED)).toEqual([3, 3 + 2 * FONT_5x7.lineHeight + 6]);
    expect(s.get(2, 3 + FONT_5x7.lineHeight)).toBe(RED);
  });

  test("text respects the clip rect and never throws off-surface", () => {
    const s = new Surface(20, 10);
    s.clip(5, 2, 6, 4);
    drawText(s, "MMMM", 0, 0, RED, { outline: BLUE, shadow: INK });
    drawText(s, "MMMM", 0, 0, RED, { scale: 2 });
    s.unclip();
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 20; x++) {
        if (x < 5 || x >= 11 || y < 2 || y >= 6) {
          expect(s.get(x, y)).toBe(TRANSPARENT);
        }
      }
    }
    expect(() => {
      drawText(s, "off", -500, -500, RED);
      drawText(s, "off", 1e7, 3, RED, { scale: 4, outline: BLUE });
      drawText(s, "nan", NaN, 3, RED);
      drawText(s, "x", 3, 3, RED, { scale: NaN, spacing: NaN });
    }).not.toThrow();
  });
});

describe("folding", () => {
  test("accents are stripped", () => {
    expect(foldText("Estadio Santiago Bernabéu")).toBe(
      "Estadio Santiago Bernabeu",
    );
    expect(foldText("Müller, Ibrahimović, Çalışkan")).toBe(
      "Muller, Ibrahimovic, Caliskan",
    );
    expect(foldText("São Paulo · Malmö · Besiktaş")).toBe(
      "Sao Paulo · Malmo · Besiktas",
    );
    // Already decomposed input (letter + combining accent) works too.
    expect(foldText("Bernabéu")).toBe("Bernabeu");
  });

  test("letters that do not decompose are mapped by hand", () => {
    expect(foldText("Ødegaard")).toBe("Odegaard");
    expect(foldText("Sørloth")).toBe("Sorloth");
    expect(foldText("Łódź")).toBe("Lodz");
    expect(foldText("Wojciech Szczęsny, Piłka")).toBe(
      "Wojciech Szczesny, Pilka",
    );
    expect(foldText("Đorđe")).toBe("Dorde");
    expect(foldText("Straße")).toBe("Strasse");
    expect(foldText("Ærø Œuvre hær cœur")).toBe("AEro OEuvre haer coeur");
    expect(foldText("ı")).toBe("i");
  });

  test("curly quotes and long dashes become ASCII", () => {
    expect(foldText("‘Today’s’ “stadium” – —")).toBe(
      "'Today's' \"stadium\" - -",
    );
  });

  test("the small font folds to capitals", () => {
    expect(foldText("Bernabéu straße", FONT_3x5)).toBe("BERNABEU STRASSE");
  });

  test("folded text draws the same pixels as its plain spelling", () => {
    const pairs: [string, string][] = [
      ["Estadio Santiago Bernabéu", "Estadio Santiago Bernabeu"],
      ["Łódź Ø ß æ", "Lodz O ss ae"],
      ["‘x’ —", "'x' -"],
    ];
    for (const [fancy, plain] of pairs) {
      for (const font of [FONT_5x7, FONT_3x5]) {
        const a = new Surface(200, 12);
        const b = new Surface(200, 12);
        expect(drawText(a, fancy, 1, 1, RED, { font })).toBe(
          drawText(b, plain, 1, 1, RED, { font }),
        );
        expect(Array.from(a.data)).toEqual(Array.from(b.data));
      }
    }
  });

  test("the middle dot has its own centred glyph", () => {
    const s = new Surface(5, 9);
    expect(drawText(s, "·", 1, 0, RED)).toBe(1);
    expect(rowsOf(s, RED)).toEqual([3, 3]);
    const small = new Surface(5, 9);
    drawText(small, "·", 1, 0, RED, { font: FONT_3x5 });
    expect(rowsOf(small, RED)).toEqual([2, 2]);
  });

  test("unknown characters draw as a hollow box, one per character", () => {
    for (const font of [FONT_5x7, FONT_3x5]) {
      const box = font.missing;
      expect(measureText("☺", { font })).toBe(box.w);
      // An astral character (one code point, two UTF-16 units) is still one box.
      expect(measureText("\u{1f600}", { font })).toBe(box.w);
      expect(measureText("☺☺", { font })).toBe(box.w * 2 + font.spacing);
      const s = new Surface(8, 9);
      drawText(s, "中", 1, 0, RED, { font });
      const rows = rowsOf(s, RED);
      const cols = inkSpan(s, RED);
      expect(rows).not.toBeNull();
      expect(cols).toEqual([1, box.w]);
      if (rows === null) continue;
      // Hollow: the middle of the box is empty.
      expect(s.get(2, Math.floor((rows[0] + rows[1]) / 2))).toBe(TRANSPARENT);
      expect(s.get(1, rows[0])).toBe(RED);
    }
    // In the small font, lowercase-only extras are unknown too.
    expect(measureText("@", { font: FONT_3x5 })).toBe(FONT_3x5.missing.w);
  });

  test("invisible marks draw nothing", () => {
    expect(measureText("a​b️")).toBe(measureText("ab"));
  });
});

describe("wrapText", () => {
  test("breaks at spaces and every line fits", () => {
    const text = "Name a player who has scored a Premier League goal";
    for (const opts of [{}, { font: FONT_3x5 }, { scale: 2 }]) {
      const max = 90;
      const lines = wrapText(text, max, opts);
      expect(lines.length).toBeGreaterThan(1);
      expect(lines.join(" ")).toBe(text);
      for (const line of lines) {
        expect(measureText(line, opts)).toBeLessThanOrEqual(max);
        expect(line).toBe(line.trim());
      }
    }
  });

  test("lines are as full as they can be", () => {
    const lines = wrapText("aa bb cc dd", measureText("aa bb"));
    expect(lines).toEqual(["aa bb", "cc dd"]);
  });

  test("short text is one line; an empty string is one empty line", () => {
    expect(wrapText("ANFIELD", 200)).toEqual(["ANFIELD"]);
    expect(wrapText("", 200)).toEqual([""]);
  });

  test("new lines are kept, extra spaces are dropped", () => {
    expect(wrapText("one\ntwo  three\n\nfour", 500)).toEqual([
      "one",
      "two three",
      "",
      "four",
    ]);
  });

  test("a word wider than the line is split", () => {
    const lines = wrapText("Borussia Mönchengladbach", 40);
    expect(lines.join("")).toBe("BorussiaMönchengladbach");
    for (const line of lines) expect(measureText(line)).toBeLessThanOrEqual(40);
    // Even an impossible width makes progress, one character per line.
    expect(wrapText("abc", 0)).toEqual(["a", "b", "c"]);
  });
});

// ---------------------------------------------------------------------------
// Added in review
// ---------------------------------------------------------------------------

describe("glyph fixes", () => {
  test("lowercase c is open on the right, so it cannot be read as an o", () => {
    expect(glyphPicture(FONT_5x7, "c").split("\n").slice(2, 7)).toEqual([
      ".###",
      "#...",
      "#...",
      "#...",
      ".###",
    ]);
    let different = 0;
    const c = FONT_5x7.glyphs[99];
    const o = FONT_5x7.glyphs[111];
    if (c === undefined || o === undefined) throw new Error("missing glyph");
    for (let r = 0; r < FONT_5x7.height; r++) {
      for (let x = 0; x < 4; x++) {
        if (((c.rows[r] ^ o.rows[r]) >> x) & 1) different++;
      }
    }
    expect(different).toBeGreaterThanOrEqual(4);
  });

  test("the small face has the extra punctuation, and its bar is not its I", () => {
    for (const ch of "*=<>_|[]") {
      expect(FONT_3x5.glyphs[ch.charCodeAt(0)]).toBeDefined();
      expect(foldText(ch, FONT_3x5)).toBe(ch);
    }
    expect(glyphPicture(FONT_3x5, "|")).not.toBe(glyphPicture(FONT_3x5, "I"));
    expect(glyphPicture(FONT_3x5, "*")).not.toBe(glyphPicture(FONT_3x5, "X"));
    expect(glyphPicture(FONT_3x5, "[")).not.toBe(glyphPicture(FONT_3x5, "("));
  });
});

describe("folding real names", () => {
  test("stadium and player names fold to plain letters in both fonts", () => {
    const names: [string, string][] = [
      ["Maracanã", "Maracana"],
      ["Santiago Bernabéu", "Santiago Bernabeu"],
      ["Ødegaard", "Odegaard"],
      ["Łukasz Fabiański", "Lukasz Fabianski"],
      ["Çalhanoğlu", "Calhanoglu"],
      ["São Paulo", "Sao Paulo"],
      ["Atlético", "Atletico"],
      ["İstanbul Başakşehir", "Istanbul Basaksehir"],
      ["Qarabağ Əliyev", "Qarabag Eliyev"],
      ["Þór Ðæmi Strauß", "Thor Daemi Strauss"],
      ["Dvořák Šešelj Žižka Đoković", "Dvorak Seselj Zizka Dokovic"],
    ];
    for (const [name, plain] of names) {
      expect(foldText(name)).toBe(plain);
      expect(foldText(name, FONT_3x5)).toBe(plain.toUpperCase());
      expect(foldText(name.normalize("NFD"))).toBe(plain);
      expect(measureText(name)).toBe(measureText(plain));
      expect(measureText(name, { font: FONT_3x5 })).toBe(
        measureText(plain, { font: FONT_3x5 }),
      );
      // Every character has a real glyph: nothing falls back to the box.
      for (const font of [FONT_5x7, FONT_3x5]) {
        for (const ch of foldText(name, font)) {
          expect(font.glyphs[ch.charCodeAt(0)]).toBeDefined();
        }
      }
    }
  });

  test("ligatures, odd spaces and fractions are unpacked; soft hyphens vanish", () => {
    const ch = (code: number): string => String.fromCodePoint(code);
    expect(foldText(ch(0xfb01) + "nal")).toBe("final"); // fi ligature
    expect(
      foldText("A" + ch(0xa0) + "B" + ch(0x2009) + "C" + ch(0x202f) + "D"),
    ).toBe("A B C D");
    expect(foldText(ch(0xff21) + ch(0xff11))).toBe("A1"); // full-width forms
    expect(foldText(ch(0xbd))).toBe("1/2");
    expect(foldText("co" + ch(0xad) + "op")).toBe("coop");
    expect(measureText("co" + ch(0xad) + "op")).toBe(measureText("coop"));
    expect(foldText("a" + ch(0x200e) + ch(0x2060) + "b")).toBe("ab");
    expect(foldText(ch(0x2039) + "x" + ch(0x203a) + " " + ch(0x2015))).toBe(
      "'x' -",
    );
  });
});

describe("outline and shadow, checked against the slow definition", () => {
  const OUT = rgb(0x00ff00);
  const SHADOW = rgb(0x0000ff);

  /** Where plain text puts ink, as a set of "x,y" for a given offset. */
  function inked(
    text: string,
    opts: TextOptions,
    x: number,
    y: number,
  ): Set<string> {
    const s = new Surface(120, 40);
    drawText(s, text, x, y, RED, {
      ...opts,
      outline: undefined,
      shadow: undefined,
    });
    const out = new Set<string>();
    for (let py = 0; py < s.h; py++) {
      for (let px = 0; px < s.w; px++) {
        if (s.get(px, py) === RED) out.add(`${px},${py}`);
      }
    }
    return out;
  }

  test.each([
    ["5x7", {}],
    ["5x7 scale 2", { scale: 2 }],
    ["3x5", { font: FONT_3x5 }],
    ["3x5 scale 3", { font: FONT_3x5, scale: 3 }],
    ["centred, spaced", { align: "center", spacing: 1 }],
  ] as [string, TextOptions][])("%s", (_name, opts) => {
    const k = opts.scale ?? 1;
    const text = "Agjy 10!";
    const x = opts.align === "center" ? 45 : 8;
    const y = 8;
    const fill = inked(text, opts, x, y);
    const outline = new Set<string>();
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        for (const p of inked(text, opts, x + ox * k, y + oy * k))
          outline.add(p);
      }
    }
    const shadow = new Set<string>();
    for (const p of outline) {
      const [px, py] = p.split(",").map(Number);
      shadow.add(`${px + k},${py + k}`);
    }

    const both = new Surface(120, 40);
    drawText(both, text, x, y, RED, { ...opts, outline: OUT, shadow: SHADOW });
    const only = new Surface(120, 40);
    drawText(only, text, x, y, RED, { ...opts, outline: OUT });
    for (let py = 0; py < both.h; py++) {
      for (let px = 0; px < both.w; px++) {
        const p = `${px},${py}`;
        const wantOnly = fill.has(p) ? RED : outline.has(p) ? OUT : TRANSPARENT;
        const wantBoth =
          wantOnly !== TRANSPARENT
            ? wantOnly
            : shadow.has(p)
              ? SHADOW
              : TRANSPARENT;
        expect(only.get(px, py)).toBe(wantOnly);
        expect(both.get(px, py)).toBe(wantBoth);
      }
    }
  });
});

describe("dots", () => {
  test("at scale 2 each font pixel is one dot, on every second row and column", () => {
    const plain = new Surface(40, 12);
    drawText(plain, "A0", 2, 2, RED);
    const led = new Surface(80, 24);
    const width = drawText(led, "A0", 4, 4, RED, { scale: 2, dots: true });
    expect(width).toBe(measureText("A0", { scale: 2 }));
    for (let y = 0; y < 24; y++) {
      for (let x = 0; x < 80; x++) {
        const onGrid = x % 2 === 0 && y % 2 === 0;
        const want = onGrid && plain.get(x / 2, y / 2) === RED;
        expect(led.get(x, y) === RED).toBe(want);
      }
    }
  });

  test("at scale 3 the dots are 2 x 2, and at scale 1 the option changes nothing", () => {
    const s = new Surface(12, 30);
    drawText(s, ".", 0, 0, RED, { scale: 3, dots: true });
    let n = 0;
    for (const v of s.data) if (v === RED) n++;
    expect(n).toBe(4);
    const a = new Surface(30, 12);
    drawText(a, "Ag", 1, 1, RED, { dots: true });
    const b = new Surface(30, 12);
    drawText(b, "Ag", 1, 1, RED);
    expect(Array.from(a.data)).toEqual(Array.from(b.data));
  });
});

describe("odd text input", () => {
  test("empty strings, lone new lines and unknown characters are harmless", () => {
    const s = new Surface(30, 30);
    expect(drawText(s, "", 5, 5, RED)).toBe(0);
    expect(drawText(s, "\n\n", 5, 5, RED, { outline: BLUE, shadow: INK })).toBe(
      0,
    );
    expect(measureText("")).toBe(0);
    for (const v of s.data) expect(v).toBe(TRANSPARENT);
    // One box per unknown character, whatever it is made of.
    const box = FONT_5x7.missing.w;
    const emoji = String.fromCodePoint(0x1f600);
    expect(measureText(emoji)).toBe(box);
    expect(measureText(emoji + emoji)).toBe(box * 2 + FONT_5x7.spacing);
    expect(measureText(String.fromCodePoint(0x6771))).toBe(box);
    expect(drawText(s, "x", NaN, 5, RED)).toBe(measureText("x"));
    expect(
      drawText(s, "x", 5, Infinity, RED, { scale: NaN, spacing: NaN }),
    ).toBe(measureText("x"));
    for (const v of s.data) expect(v).toBe(TRANSPARENT);
  });

  test("wrapText with a useless width still ends", () => {
    expect(wrapText("ab cd", 0)).toEqual(["a", "b", "c", "d"]);
    expect(wrapText("ab cd", -10)).toEqual(["a", "b", "c", "d"]);
    expect(wrapText("ab cd", NaN)).toEqual(["ab", "cd"]);
    expect(wrapText("ab cd", Infinity)).toEqual(["ab cd"]);
  });
});
