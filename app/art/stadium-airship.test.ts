import { describe, expect, it } from "vitest";

import { FACTS } from "~/data/facts";
import { FONT_5x7, Surface, measureText } from "~/pixel";
import { P } from "~/art/palette";
import {
  SIGN_GAP,
  SIGN_PAUSE,
  SIGN_SPEED,
  drawSignText,
  type SignText,
} from "~/art/stadium-airship";

/** The sign's panel as a monitor has it (menuLayout().scoreboard at 480 x 270), at (0, 0). */
const W = 92;
const H = 35;
/** The fact's window inside it: see drawSignText. */
const FX = 3;
const FW = W - 6;
const FY = 2 + Math.floor((H - 4 - 17) / 2) + 10;

const DAY_ONE: SignText = {
  header: "DID YOU KNOW?",
  text: FACTS[0].text.toUpperCase(),
};

function sign(text: SignText, signT: number, h = H): Surface {
  const s = new Surface(W, h);
  s.clear(P.ink);
  drawSignText(s, text, 0, 0, W, h, signT);
  return s;
}

/** The fact's window, as rows of colours. */
function window(s: Surface): number[][] {
  const rows: number[][] = [];
  for (let y = FY; y < FY + FONT_5x7.height; y++) {
    const row: number[] = [];
    for (let x = FX; x < FX + FW; x++) row.push(s.get(x, y));
    rows.push(row);
  }
  return rows;
}

/** The window moved `by` pixels to the left (negative: right), without the columns it uncovers. */
function shifted(rows: number[][], by: number): number[][] {
  return rows.map((row) =>
    by >= 0 ? row.slice(by) : row.slice(0, row.length + by),
  );
}

function cut(rows: number[][], by: number): number[][] {
  return rows.map((row) =>
    by >= 0 ? row.slice(0, row.length - by) : row.slice(-by),
  );
}

/** Seconds for the fact to go round once, the pause included. */
function lapOf(text: string): number {
  return (
    SIGN_PAUSE + (measureText(text, { font: FONT_5x7 }) + SIGN_GAP) / SIGN_SPEED
  );
}

describe("the fact of the day on the airship's sign", () => {
  it("has every character of every fact in the sign's fonts", () => {
    // an unknown character would draw as a box
    for (const fact of FACTS) {
      for (const ch of fact.text.toUpperCase()) {
        expect(
          FONT_5x7.glyphs[ch.charCodeAt(0)],
          `"${ch}" in ${fact.id}`,
        ).toBeDefined();
      }
    }
    expect(FACTS.length).toBe(60);
  });

  it("starts at the beginning of the fact and rests there", () => {
    const start = window(sign(DAY_ONE, 0));
    // the first letter, flush left in the window
    let first = -1;
    for (let x = 0; x < FW && first < 0; x++) {
      if (start.some((row) => row[x] === P.amber)) first = x;
    }
    expect(first).toBe(0);
    for (const t of [0.5, 1, SIGN_PAUSE - 0.01]) {
      expect(window(sign(DAY_ONE, t)), `at ${t}`).toEqual(start);
    }
  });

  it("then scrolls left in whole pixels at a steady speed", () => {
    const start = window(sign(DAY_ONE, 0));
    for (let n = 1; n <= 40; n++) {
      const t = SIGN_PAUSE + (n + 0.5) / SIGN_SPEED;
      expect(cut(window(sign(DAY_ONE, t)), n), `after ${n} px`).toEqual(
        shifted(start, n),
      );
    }
  });

  it("loops round seamlessly, with a gap between the end and the start", () => {
    const lap = lapOf(DAY_ONE.text);
    const start = window(sign(DAY_ONE, 0));
    // a pixel before the lap is done, the start is one pixel to the right of its place
    const last = window(sign(DAY_ONE, lap - 0.5 / SIGN_SPEED));
    expect(cut(last, -1)).toEqual(shifted(start, -1));
    // then it is back, and it rests again
    expect(window(sign(DAY_ONE, lap + 0.01))).toEqual(start);
    expect(window(sign(DAY_ONE, lap + SIGN_PAUSE - 0.01))).toEqual(start);
    expect(window(sign(DAY_ONE, 2 * lap + 0.01))).toEqual(start);
    // as the end goes by, the gap is blank: the window holds the end, then dark, then the start
    const tw = measureText(DAY_ONE.text, { font: FONT_5x7 });
    const atGap = window(
      sign(
        DAY_ONE,
        SIGN_PAUSE + (tw - Math.floor((FW - SIGN_GAP) / 2) + 0.5) / SIGN_SPEED,
      ),
    );
    const lit = (x: number) => atGap.some((row) => row[x] === P.amber);
    let darkRun = 0;
    let best = 0;
    for (let x = 0; x < FW; x++) {
      darkRun = lit(x) ? 0 : darkRun + 1;
      best = Math.max(best, darkRun);
    }
    expect(best).toBeGreaterThanOrEqual(SIGN_GAP - 1);
  });

  it("takes about 20 to 30 seconds to pass a whole fact", () => {
    const passes = FACTS.map(
      (f) => measureText(f.text.toUpperCase(), { font: FONT_5x7 }) / SIGN_SPEED,
    );
    expect(Math.max(...passes)).toBeLessThanOrEqual(30);
    expect(Math.max(...passes)).toBeGreaterThanOrEqual(20);
    // a lap, pause and gap included, never over half a minute and a bit
    for (const f of FACTS) expect(lapOf(f.text.toUpperCase())).toBeLessThan(33);
  });

  it("puts the header in green over the fact in amber, inside the panel, on a phone too", () => {
    for (const h of [35, 33]) {
      const s = sign(DAY_ONE, 0, h);
      const rows = (c: number): number[] => {
        const out: number[] = [];
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < W; x++) {
            if (s.get(x, y) === c) {
              out.push(y);
              break;
            }
          }
        }
        return out;
      };
      const green = rows(P.ledGreen);
      const amber = rows(P.amber);
      // capitals 5 rows tall in the small font, 7 in the big one
      expect(green.length).toBe(5);
      expect(amber.length).toBe(7);
      expect(Math.max(...green)).toBeLessThan(Math.min(...amber));
      // inside the lamp field, with as much room above as below (give or take a row)
      const above = Math.min(...green) - 2;
      const below = h - 2 - (Math.max(...amber) + 1);
      expect(above).toBeGreaterThanOrEqual(4);
      expect(Math.abs(above - below)).toBeLessThanOrEqual(1);
    }
  });

  it("is the same for the same clock", () => {
    for (const t of [0, 3.3, 17.25, 40]) {
      expect(window(sign(DAY_ONE, t))).toEqual(window(sign(DAY_ONE, t)));
    }
  });
});
