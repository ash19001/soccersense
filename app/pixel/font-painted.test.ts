import { describe, expect, it } from "vitest";
import { FACTS as FACT_LIST } from "~/data/facts";
import { en } from "~/i18n/en";
import { font10x14, font6x10 } from "./font-painted";
import { Surface } from "./surface";
import {
  FONT_3x5,
  FONT_5x7,
  drawText,
  foldText,
  measureText,
  wrapText,
  type BitmapFont,
} from "./text";
import { rgb } from "./color";

const PAIRS: readonly (readonly [BitmapFont, BitmapFont])[] = [
  [font6x10(), FONT_3x5],
  [font10x14(), FONT_5x7],
];
const RED = rgb(0xff0000);
const FACTS: readonly string[] = FACT_LIST.map((f) => f.text);

/** Every string of the interface text, flattened. */
function strings(v: unknown, out: string[] = []): string[] {
  if (typeof v === "string") out.push(v);
  else if (v !== null && typeof v === "object") {
    for (const w of Object.values(v)) strings(w, out);
  }
  return out;
}

describe("the painted fonts", () => {
  it("are built once, lazily, and are the same object each time", () => {
    expect(font6x10()).toBe(font6x10());
    expect(font10x14()).toBe(font10x14());
  });

  it("have every metric of their twin, doubled", () => {
    for (const [two, one] of PAIRS) {
      expect(two.height).toBe(one.height * 2);
      expect(two.capHeight).toBe(one.capHeight * 2);
      expect(two.lineHeight).toBe(one.lineHeight * 2);
      expect(two.spacing).toBe(one.spacing * 2);
      expect(two.digitWidth).toBe(one.digitWidth * 2);
      expect(two.upperOnly).toBe(one.upperOnly);
      expect(two.missing.w).toBe(one.missing.w * 2);
    }
  });

  it("have exactly their twin's characters, each twice as wide", () => {
    for (const [two, one] of PAIRS) {
      for (let c = 0; c < one.glyphs.length; c++) {
        const a = one.glyphs[c];
        const b = two.glyphs[c];
        expect(b === undefined, `${two.name} ${c}`).toBe(a === undefined);
        if (a && b)
          expect(b.w, `${two.name} ${String.fromCharCode(c)}`).toBe(a.w * 2);
      }
    }
  });

  it("measure any text at exactly twice their twin's width", () => {
    const samples = [
      "HOME",
      "NEXT-GEN",
      "GUESS WHO",
      "Bernabéu, Malmö, Łódź, Straße",
      "0123456789 +-/%",
      "\u{1F600} Ωmega",
      ...FACTS.slice(0, 40),
    ];
    for (const [two, one] of PAIRS) {
      for (const text of samples) {
        for (const tabular of [false, true]) {
          expect(measureText(text, { font: two, tabular })).toBe(
            2 * measureText(text, { font: one, tabular }),
          );
        }
      }
      expect(wrapText(FACTS[0], 160, { font: two })).toEqual(
        wrapText(FACTS[0], 80, { font: one }),
      );
    }
  });

  it("draw capitals and digits from the top row to the baseline, and nothing below it", () => {
    for (const [font] of PAIRS) {
      for (const ch of "ABCDEFGHIJKLMNOPRSTUVWXYZ0123456789") {
        const g = font.glyphs[ch.charCodeAt(0)];
        expect(g, ch).toBeDefined();
        if (!g) continue;
        expect(g.rows[0], `${font.name} ${ch} top`).not.toBe(0);
        expect(g.rows[font.capHeight - 1], `${font.name} ${ch} base`).not.toBe(
          0,
        );
        for (let r = font.capHeight; r < font.height; r++) {
          expect(g.rows[r], `${font.name} ${ch} below`).toBe(0);
        }
        // no pixel outside the glyph's own width
        for (const bits of g.rows) expect(bits >> g.w).toBe(0);
      }
    }
  });

  it("keep a 2 px stroke: no capital has a pixel with no inked neighbour", () => {
    for (const [font] of PAIRS) {
      for (const ch of "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789") {
        const g = font.glyphs[ch.charCodeAt(0)];
        if (!g) continue;
        const on = (x: number, y: number): boolean =>
          x >= 0 && y >= 0 && y < g.rows.length && ((g.rows[y] >> x) & 1) === 1;
        for (let y = 0; y < g.rows.length; y++) {
          for (let x = 0; x < g.w; x++) {
            if (!on(x, y)) continue;
            const lonely =
              !on(x - 1, y) && !on(x + 1, y) && !on(x, y - 1) && !on(x, y + 1);
            expect(lonely, `${font.name} ${ch} at ${x},${y}`).toBe(false);
          }
        }
      }
    }
  });

  it("have every character of every fact and every label (no missing box)", () => {
    const texts = [...FACTS, ...strings(en)];
    for (const [font, twin] of PAIRS) {
      for (const text of texts) {
        // the same characters fall back to the box as the twin, and no others
        const folded = foldText(text, font);
        expect(folded).toBe(foldText(text, twin));
      }
    }
    const big = font10x14();
    for (const text of FACTS) {
      for (const ch of foldText(text, big)) {
        expect(
          big.glyphs[ch.charCodeAt(0)],
          `${ch} in "${text}"`,
        ).toBeDefined();
      }
    }
  });

  it("draw through drawText with outline and shadow, 1 px round the letters", () => {
    const s = new Surface(80, 30);
    const w = drawText(s, "HOME", 4, 4, RED, {
      font: font6x10(),
      outline: rgb(0x0000ff),
    });
    expect(w).toBe(measureText("HOME", { font: font6x10() }));
    // the outline reaches one pixel left of the H and one above it
    expect(s.get(3, 4)).toBe(rgb(0x0000ff));
    expect(s.get(4, 3)).toBe(rgb(0x0000ff));
    expect(s.get(4, 4)).toBe(RED);
    expect(s.get(2, 4)).not.toBe(rgb(0x0000ff));
  });
});
