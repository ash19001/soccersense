import { describe, expect, it } from "vitest";

import { FACTS } from "~/data/facts";
import { FONT_5x7, Surface, TRANSPARENT } from "~/pixel";
import { menuLayout } from "~/art/layout";
import { lightingFor } from "~/art/lighting";
import { paintAirship, signPlace } from "~/art/stadium-airship";
import {
  PLANE_DROP,
  PLANE_EVERY,
  PLANE_FIRST,
  PLANE_SIZE,
  PLANE_SPEED,
  bannerWords,
  drawFlyby,
  paintBanner,
  planeAt,
  planeBox,
  planeRoute,
  planeStill,
  trainLength,
} from "~/art/stadium-plane";
import { makeView } from "~/art/stadium-view";

const DAY = lightingFor({ elevation: 40, morning: false });
const NIGHT = lightingFor({ elevation: -25, morning: false });
const LONGEST = FACTS.reduce(
  (a, f) => (f.text.length > a.length ? f.text : a),
  "",
);

/** Monitors and phones (STEP1.md's table and ART_BIBLE 2.1's range). */
const SIZES = [
  [960, 540],
  [854, 480],
  [683, 384],
  [720, 450],
  [1280, 720],
  [1440, 720],
  [234, 507],
  [260, 563],
  [271, 601],
] as const;

function banner(text = bannerWords("DID YOU KNOW?", LONGEST), light = DAY) {
  return paintBanner(text, light);
}

describe("the plane's banner", () => {
  it("says DID YOU KNOW? and the fact, in capitals on one line", () => {
    expect(bannerWords("Did you know?", "  Goal nets\narrived in 1889. ")).toBe(
      "DID YOU KNOW? GOAL NETS ARRIVED IN 1889.",
    );
    expect(bannerWords("", "a fact")).toBe("A FACT");
  });

  it("has every character of every fact in its face", () => {
    const font = FONT_5x7;
    for (const fact of FACTS) {
      for (const ch of bannerWords("DID YOU KNOW?", fact.text)) {
        expect(
          font.glyphs[ch.charCodeAt(0)],
          `"${ch}" in ${fact.id}`,
        ).toBeDefined();
      }
    }
  });

  it("is as long as its words need, 13 px tall, and painted by day and at night", () => {
    const short = banner("DID YOU KNOW? A SHORT ONE.");
    const long = banner();
    expect(long.flat.w).toBeGreaterThan(short.flat.w * 3);
    expect(long.flat.h).toBe(13);
    // the main face's capitals, 6 px a letter: a 110-letter fact is about 660 px
    expect(long.flat.w).toBeLessThan(
      bannerWords("DID YOU KNOW?", LONGEST).length * 6 + 16,
    );
    for (const light of [DAY, NIGHT]) {
      const b = banner(undefined, light);
      // the cloth is whole: no holes, and its letters differ from it
      expect(b.flat.data.every((c) => c !== TRANSPARENT)).toBe(true);
      expect(new Set(b.flat.data).size).toBeGreaterThanOrEqual(4);
    }
  });
});

describe("the plane's passes", () => {
  it("comes first soon after the page opens, then about once a minute", () => {
    expect(PLANE_FIRST).toBeLessThanOrEqual(10);
    expect(PLANE_EVERY).toBeGreaterThanOrEqual(50);
    expect(PLANE_EVERY).toBeLessThanOrEqual(80);

    const len = trainLength(banner());
    expect(planeAt(0, 960, len)).toBeNull();
    expect(planeAt(PLANE_FIRST - 0.1, 960, len)).toBeNull();
    const start = planeAt(PLANE_FIRST, 960, len);
    expect(start).not.toBeNull();
    expect(start as number).toBeGreaterThanOrEqual(960);
    // a canvas pixel a frame at 60 Hz
    expect(planeAt(PLANE_FIRST + 1, 960, len)).toBe((start as number) - 60);
    // the same pass again a period later
    expect(planeAt(PLANE_FIRST + PLANE_EVERY + 3, 960, len)).toBe(
      planeAt(PLANE_FIRST + 3, 960, len),
    );
    expect(planeAt(Number.NaN, 960, len)).toBeNull();
  });

  it("is gone before the next pass even with the longest fact on the widest canvas", () => {
    const len = trainLength(banner());
    for (const w of [234, 960, 1440]) {
      expect(
        planeAt(PLANE_FIRST + PLANE_EVERY - 0.5, w, len),
        `${w}`,
      ).toBeNull();
      // and the whole banner is on screen at some point of a pass
      expect(planeAt(PLANE_FIRST + (w + len) / 60 - 1, w, len)).not.toBeNull();
    }
  });

  it("flies clear of the wordmark's zone, the airship, the far stand and the ball, at every size", () => {
    for (const [w, h] of SIZES) {
      const v = makeView(w, h);
      const m = menuLayout(w, h);
      const ship = paintAirship(signPlace(v), DAY);
      const box = {
        x: ship.x,
        y: ship.y,
        w: ship.layer.w,
        h: ship.gondola.y + ship.gondola.h,
      };
      const y = planeRoute(v, box);
      // the plane (16 tall round y, bobbing a pixel) and the banner (13 tall, a little
      // lower, bobbing and rippling a pixel)
      const top = y - Math.floor(PLANE_SIZE.h / 2) - 1;
      const bottom = y + 10;
      expect(top, `${w}x${h}`).toBeGreaterThanOrEqual(m.logo.h);
      expect(bottom, `${w}x${h}`).toBeLessThan(m.ballCy - m.ballR);
      // never down over the stadium's far stand
      expect(bottom, `${w}x${h}`).toBeLessThan(m.stand.y - 2);
      // where the airship's envelope and sign are, the plane is above or below them
      const p = signPlace(v);
      const under = top > p.y + p.ry + 2;
      const over = bottom < p.y - p.ry - 2;
      const beside = p.x + p.rx + 8 < 0;
      expect(under || over || beside, `${w}x${h}`).toBe(true);
      // on a monitor, where the airship hung until it moved to the top left
      if (w >= 800) expect(y, `${w}x${h}`).toBe(m.logo.h + PLANE_DROP);
    }
  });

  it("draws nothing between passes, the same pixels for the same time, and moves", () => {
    const b = banner();
    const blank = new Surface(960, 120);
    drawFlyby(blank, b, 60, DAY, 2);
    expect(blank.data.every((c) => c === TRANSPARENT)).toBe(true);
    const a = new Surface(960, 120);
    const c = new Surface(960, 120);
    drawFlyby(a, b, 60, DAY, PLANE_FIRST + 8);
    drawFlyby(c, b, 60, DAY, PLANE_FIRST + 8);
    expect(a.data).toEqual(c.data);
    expect(a.data.some((p) => p !== TRANSPARENT)).toBe(true);
    const later = new Surface(960, 120);
    drawFlyby(later, b, 60, DAY, PLANE_FIRST + 8.5);
    expect(later.data).not.toEqual(a.data);
  });
});

describe("the plane's own box (for what might meet it)", () => {
  const W = 960;
  const H = 300;
  const ROW = 120;
  const b = banner();
  const length = trainLength(b);

  it("is where the plane is drawn, and nothing between passes", () => {
    expect(planeBox(PLANE_FIRST - 1, W, length, ROW)).toBeNull();
    const pass = (W + length + 8) / PLANE_SPEED;
    expect(planeBox(PLANE_FIRST + pass + 1, W, length, ROW)).toBeNull();
    for (const dt of [0.5, 2, 9]) {
      const box = planeBox(PLANE_FIRST + dt, W, length, ROW);
      expect(box).not.toBeNull();
      if (!box) continue;
      // the plane's own size, its nose where the pass has it, on its row (a pixel of bob)
      expect(box.w).toBe(PLANE_SIZE.w);
      expect(box.h).toBe(PLANE_SIZE.h);
      expect(box.x).toBe(planeAt(PLANE_FIRST + dt, W, length));
      expect(Math.abs(box.y + box.h / 2 - ROW)).toBeLessThanOrEqual(1);
      // and that is where it is drawn
      const s = new Surface(W, H);
      drawFlyby(s, b, ROW, DAY, PLANE_FIRST + dt);
      let inside = 0;
      for (let y = box.y; y < box.y + box.h; y++) {
        for (let x = Math.max(0, box.x); x < Math.min(W, box.x + box.w); x++) {
          if (s.data[y * W + x] !== TRANSPARENT) inside++;
        }
      }
      expect(inside, `${dt}`).toBeGreaterThan(150);
    }
  });

  it("has a still plane for the fall: the plane with its propeller stopped, once for each light", () => {
    const still = planeStill(DAY);
    expect(still.w).toBe(PLANE_SIZE.w + 2);
    expect(still.h).toBe(PLANE_SIZE.h);
    expect(planeStill(DAY)).toBe(still);
    expect(planeStill(NIGHT)).not.toBe(still);
    let n = 0;
    for (let i = 0; i < still.data.length; i++) {
      if (still.data[i] !== TRANSPARENT) n++;
    }
    expect(n).toBeGreaterThan(250);
  });
});
