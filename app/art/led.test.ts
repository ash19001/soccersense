import { describe, expect, it } from "vitest";
import {
  FONT_3x5,
  FONT_5x7,
  Surface,
  TRANSPARENT,
  drawText,
  luma,
  measureText,
  mix,
} from "~/pixel";
import {
  LED_FRAME,
  drawLamps,
  drawLedLine,
  drawLedPanel,
  lampLook,
  ledField,
  ledLap,
  measureLamps,
} from "./led";
import { P } from "./palette";

/** Every pixel of `s` painted `c`, as [x, y]. */
function pixels(s: Surface, c: number): [number, number][] {
  const out: [number, number][] = [];
  for (let y = 0; y < s.h; y++) {
    for (let x = 0; x < s.w; x++) if (s.get(x, y) === c) out.push([x, y]);
  }
  return out;
}

describe("the LED panel", () => {
  it("a 4 px housing and 1 px lamps on the field's even offsets", () => {
    const s = new Surface(80, 40);
    const field = drawLedPanel(s, 0, 0, 80, 40);
    expect(LED_FRAME).toBe(4);
    expect(field).toEqual({ x: 4, y: 4, w: 72, h: 32 });
    expect(field).toEqual(ledField(0, 0, 80, 40));
    let lamps = 0;
    for (const [x, y] of pixels(s, P.ledOff)) {
      const inField =
        x >= field.x &&
        x < field.x + field.w &&
        y >= field.y &&
        y < field.y + field.h;
      if (!inField) continue;
      lamps++;
      expect((x - field.x) % 2).toBe(0);
      expect((y - field.y) % 2).toBe(0);
      // the field's own first row and column stay clear
      expect(x).toBeGreaterThan(field.x);
      expect(y).toBeGreaterThan(field.y);
    }
    expect(lamps).toBe(35 * 15);
  });
});

describe("drawLedLine", () => {
  const HOT = lampLook(P.amber).hot;

  it("lights only the panel's lamps: one hot lamp per pixel of the face", () => {
    for (const font of [FONT_3x5, FONT_5x7]) {
      for (const offset of [2, 4, 6]) {
        const s = new Surface(200, 40);
        const field = drawLedPanel(s, 0, 0, 200, 40);
        const lamps = new Set(pixels(s, P.ledOff).map(([x, y]) => `${x},${y}`));
        drawLedLine(s, "DID YOU KNOW?", field.x + offset, field.y + 2, 150, {
          font,
        });
        const hot = pixels(s, HOT);
        expect(hot.length).toBe(
          pixels(drawn("DID YOU KNOW?", font), P.amber).length,
        );
        for (const [x, y] of hot) expect(lamps.has(`${x},${y}`)).toBe(true);
      }
    }
  });

  it("joins neighbouring lamps with light and glows faintly beside them", () => {
    const s = new Surface(200, 40);
    const field = drawLedPanel(s, 0, 0, 200, 40);
    drawLedLine(s, "DID YOU KNOW?", field.x + 2, field.y + 2, 150);
    const look = lampLook(P.amber);
    expect(look.hot).not.toBe(P.amber);
    expect(look.glow).toBe(mix(P.ink, P.amber, 0.55));
    const hot = new Set(pixels(s, look.hot).map(([x, y]) => `${x},${y}`));
    const near = (x: number, y: number): number => {
      let n = 0;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        if (hot.has(`${x + dx},${y + dy}`)) n++;
      }
      return n;
    };
    const links = pixels(s, look.link);
    const glows = pixels(s, look.glow);
    expect(links.length).toBeGreaterThan(20);
    expect(glows.length).toBeGreaterThan(20);
    // a link sits between two lamps (or across a diagonal step), a glow beside one
    for (const [x, y] of glows) expect(near(x, y)).toBe(1);
    for (const [x, y] of links) {
      const diagonal =
        (hot.has(`${x - 1},${y - 1}`) && hot.has(`${x + 1},${y + 1}`)) ||
        (hot.has(`${x + 1},${y - 1}`) && hot.has(`${x - 1},${y + 1}`));
      expect(near(x, y) === 2 || diagonal).toBe(true);
    }
  });

  it("carries at least three quarters of the light of solid letters of the same size", () => {
    const light = (s: Surface): number => {
      let sum = 0;
      for (let y = 0; y < s.h; y++) {
        for (let x = 0; x < s.w; x++) {
          const c = s.get(x, y);
          if (c !== TRANSPARENT) sum += luma(c);
        }
      }
      return sum;
    };
    for (const font of [FONT_3x5, FONT_5x7]) {
      const solid = new Surface(300, 20);
      drawText(solid, "THE PENALTY KICK", 2, 2, P.amber, { font, scale: 2 });
      const lamps = new Surface(300, 20);
      drawLamps(lamps, "THE PENALTY KICK", 2, 2, P.amber, { font });
      expect(light(lamps)).toBeGreaterThan(0.75 * light(solid));
    }
  });

  it("measures twice the face's width and centres in whole lamps", () => {
    const text = "THE PENALTY KICK";
    const one = measureText(text, { font: FONT_5x7 });
    expect(measureLamps(text)).toBe(2 * one);
    const s = new Surface(400, 30);
    drawLedLine(s, text, 20, 4, 240, { font: FONT_5x7 });
    const b = pixels(s, HOT).map(([x]) => x);
    expect(Math.max(...b) - Math.min(...b) + 2).toBeLessThanOrEqual(2 * one);
    expect(one).toBeLessThan(120);
    // centred: the first lit lamp is an even way in from the window
    expect((Math.min(...b) - 20) % 2).toBe(0);
  });

  it("scrolls in whole lamps", () => {
    const fact =
      "THE PENALTY KICK WAS THE IDEA OF A GOALKEEPER FROM COUNTY ARMAGH";
    const first = (t: number): number => {
      const s = new Surface(400, 40);
      const scrolls = drawLedLine(s, fact, 0, 0, 200, {
        t,
        speed: 20,
        pause: 1,
        gap: 30,
      });
      expect(scrolls).toBe(true);
      // the left edge of the first glyph: the leftmost lit lamp of the line's start
      return Math.min(...pixels(s, HOT).map(([x]) => x));
    };
    for (const t of [0, 1.5, 2.25, 3.05, 4.4]) expect(first(t) % 2).toBe(0);
  });

  it("knows how long a marquee takes to go round", () => {
    const fact = "THE PENALTY KICK WAS THE IDEA OF A GOALKEEPER";
    const opts = { speed: 20, pause: 2.5, gap: 36 };
    const one = ledLap(fact, 100, opts);
    expect(one).toBeCloseTo(
      2.5 + (measureText(fact, { font: FONT_5x7 }) + 36) / 20,
    );
    expect(ledLap(fact, 200, opts)).toBeCloseTo(one);
    expect(ledLap("SHORT", 100, opts)).toBe(0);
  });

  it("draws nothing outside its window but for the glow's pixel above it and left of it", () => {
    const s = new Surface(100, 40);
    drawLedLine(s, "A VERY LONG LINE THAT SCROLLS", 20, 10, 40, { t: 3 });
    for (let y = 0; y < s.h; y++) {
      for (let x = 0; x < s.w; x++) {
        if (s.get(x, y) === TRANSPARENT) continue;
        expect(x >= 19 && x < 60 && y >= 9 && y < 10 + 14).toBe(true);
      }
    }
  });
});

/** The face's solid letters, for counting their pixels. */
function drawn(text: string, font: typeof FONT_5x7): Surface {
  const s = new Surface(200, 20);
  drawText(s, text, 0, 0, P.amber, { font });
  return s;
}
