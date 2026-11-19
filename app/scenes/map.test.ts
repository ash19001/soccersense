/**
 * CLOSEST's and FURTHEST's map (./map.ts): the day's place and its name stay clear of the
 * board over the picture (setCeiling), and a long name wraps to fit a narrow picture; the
 * career's stages on the map, an answer's flight out and back, the promotions.
 */
import { describe, expect, it } from "vitest";

import { lightingFor } from "~/art/lighting";
import { P } from "~/art/palette";
import { formatDistance } from "~/game/geo";
import { FONT_5x7, Surface, measureText } from "~/pixel";

import { CLOSEST_ACROSS, MapScene, PIN_Y, plateLines } from "./map";
import { journeyFor } from "./map-journey";

const WEMBLEY = { lat: 51.556, lng: -0.2796, name: "Wembley" };

function make(w: number, h: number, name = WEMBLEY.name): MapScene {
  const map = new MapScene({
    seed: 1,
    mode: "closest",
    place: { ...WEMBLEY, name },
    distance: (km) => formatDistance(km, "en-GB"),
  });
  map.resize(w, h);
  map.setLighting(lightingFor({ elevation: 30, morning: true }));
  map.setReducedMotion(true);
  map.beginOpening();
  map.update(1);
  return map;
}

/** The top row of the pin's name plate, as drawn: its ink edge is the first ink over the pin. */
function plateTop(map: MapScene, w: number, h: number): number {
  const s = new Surface(w, h);
  map.update(0);
  map.draw(s);
  return (map as unknown as { plate: { y: number } }).plate.y;
}

describe("the map's pin and its name", () => {
  it("stands at PIN_Y with no board over the picture", () => {
    const [w, h] = [640, 310];
    const map = make(w, h);
    const top = plateTop(map, w, h);
    expect(top).toBeGreaterThan(0);
    expect(top).toBeLessThan(Math.round(h * PIN_Y));
  });

  it("comes down so that its name plate is clear of the board (setCeiling)", () => {
    const [w, h] = [640, 310];
    const map = make(w, h);
    const free = plateTop(map, w, h);
    // a board ending below where the plate was: the plate moves down under it
    const ceiling = free + 20;
    map.setCeiling(ceiling);
    expect(plateTop(map, w, h)).toBeGreaterThanOrEqual(ceiling);
    // a board well above it: back where it was
    map.setCeiling(0);
    expect(plateTop(map, w, h)).toBe(free);
    map.setCeiling(null);
    expect(plateTop(map, w, h)).toBe(free);
  });

  it("wraps a long name to the picture's width, words whole", () => {
    const name = "CAIRO INTERNATIONAL STADIUM";
    const room = 124;
    const lines = plateLines(name, room, 1);
    expect(lines.join(" ")).toBe(name);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(measureText(line, { font: FONT_5x7 })).toBeLessThanOrEqual(room);
    }
    // one line where it fits
    expect(plateLines("WEMBLEY", room, 1)).toEqual(["WEMBLEY"]);
  });
});

describe("the map's opening", () => {
  const [w, h] = [320, 180];
  /** How many of the picture's pixels are not the ink it waits on. */
  const lit = (map: MapScene): number => {
    const s = new Surface(w, h);
    map.draw(s);
    let n = 0;
    for (let i = 0; i < s.data.length; i++) if (s.data[i] !== P.ink) n++;
    return n;
  };
  const fresh = () => {
    const map = new MapScene({
      seed: 1,
      mode: "closest",
      place: WEMBLEY,
      distance: (km) => formatDistance(km, "en-GB"),
    });
    map.resize(w, h);
    map.setLighting(lightingFor({ elevation: 30, morning: true }));
    return map;
  };

  it("opens by itself: a game the page carries on with is not left on ink", () => {
    // 2026-11-18: coming back to a game under way, the map stayed black
    const map = fresh();
    for (let i = 0; i < 120; i++) map.update(1 / 60);
    // CLOSEST opens on the whole globe among stars: space is ink too
    expect(lit(map)).toBeGreaterThan(w * h * 0.2);
  });

  it("waits on ink while held (the mode card), and opens once let go", () => {
    const map = fresh();
    map.holdOpening();
    expect(map.waiting).toBe(true);
    for (let i = 0; i < 120; i++) map.update(1 / 60);
    expect(lit(map)).toBe(0);
    map.beginOpening();
    expect(map.waiting).toBe(false);
    for (let i = 0; i < 120; i++) map.update(1 / 60);
    // CLOSEST opens on the whole globe among stars: space is ink too
    expect(lit(map)).toBeGreaterThan(w * h * 0.2);
  });

  it("cannot be held once it has begun to open", () => {
    const map = fresh();
    map.update(0.1);
    map.holdOpening();
    expect(map.waiting).toBe(false);
  });
});

/** What the camera sees (private): its middle, km a pixel, and its middle's row. */
interface Cam {
  lat: number;
  lng: number;
  kpp: number;
  ay: number;
}
const camOf = (map: MapScene): Cam => (map as unknown as { cam: Cam }).cam;
const placed = (map: MapScene, p: { lat: number; lng: number }) =>
  (
    map as unknown as {
      project(q: { lat: number; lng: number }): {
        x: number;
        y: number;
        seen: boolean;
      };
    }
  ).project(p);

function career(mode: "closest" | "furthest", w = 480, h = 270): MapScene {
  const map = new MapScene({
    seed: 3,
    mode,
    place: WEMBLEY,
    distance: (km) => formatDistance(km, "en-GB"),
  });
  map.resize(w, h);
  map.setLighting(lightingFor({ elevation: 30, morning: true }));
  map.beginOpening();
  map.update(1);
  return map;
}

describe("the career on the map", () => {
  // the product owner, 2026-11-18, from image demos of the stages: "sure do it"
  it("CLOSEST closes in on the day's place a step a tier, the place in the middle", () => {
    const map = career("closest");
    let last = Infinity;
    for (let tier = 0; tier < 8; tier++) {
      map.setTotal(tier * 90);
      const cam = camOf(map);
      expect(cam.kpp, `tier ${tier}`).toBeLessThan(last);
      last = cam.kpp;
      if (tier > 0) expect(cam.kpp * 480).toBeCloseTo(CLOSEST_ACROSS[tier], 6);
      const pin = placed(map, WEMBLEY);
      expect(pin.seen).toBe(true);
      expect(pin.x).toBeCloseTo(240, 0);
    }
  });

  it("FURTHEST holds home and the newest stop, each further away, on the picture", () => {
    const map = career("furthest");
    const stops = journeyFor(WEMBLEY);
    for (let tier = 1; tier <= 5; tier++) {
      map.setTotal(tier * 90);
      for (const p of [WEMBLEY, stops[tier]]) {
        const q = placed(map, p);
        expect(q.seen, `tier ${tier}`).toBe(true);
        expect(q.x).toBeGreaterThan(0);
        expect(q.x).toBeLessThan(480);
        expect(q.y).toBeGreaterThan(0);
        expect(q.y).toBeLessThan(270);
      }
    }
    // the final, on the far side of the world, in sight
    map.setTotal(560);
    expect(placed(map, stops[6]).seen).toBe(true);
  });

  it("plays the final and the trophy at night, whatever the sky", () => {
    const map = career("closest");
    map.setTotal(450);
    expect(map.ambience().night).toBe(false);
    map.setTotal(560);
    expect(map.ambience().night).toBe(true);
  });

  it("flies out to a far answer, the landing above the reveal's sheet, and back home on the next question", () => {
    const map = career("closest");
    map.setTotal(460);
    const home = { ...camOf(map) };
    const rosario = { lat: -32.947, lng: -60.639 };
    let done = 0;
    map.playShot("toepoke", () => done++, { ...rosario, km: 11083 });
    for (let i = 0; i < 200 && done === 0; i++) map.update(1 / 60);
    expect(done).toBe(1);
    const q = placed(map, rosario);
    expect(q.seen).toBe(true);
    expect(q.y).toBeLessThanOrEqual(270 * 0.52);
    expect(camOf(map).kpp).toBeGreaterThan(home.kpp * 1000);
    map.ask();
    for (let i = 0; i < 120; i++) map.update(1 / 60);
    expect(camOf(map).kpp).toBeCloseTo(home.kpp, 9);
  });

  it("goes in for a near answer, only as far out as it must", () => {
    const map = career("closest");
    map.setTotal(0);
    const globe = camOf(map).kpp;
    let done = false;
    map.playShot("worldie", () => (done = true), {
      lat: 51.5093,
      lng: -0.2321,
      km: 6,
    });
    for (let i = 0; i < 200 && !done; i++) map.update(1 / 60);
    expect(camOf(map).kpp).toBeLessThan(globe / 100);
  });

  it("promotes: the camera moves to the next tier's view and the page is told when it is done", () => {
    for (const mode of ["closest", "furthest"] as const) {
      const map = career(mode);
      map.setTotal(185);
      const before = { ...camOf(map) };
      let done = 0;
      map.promote(275, () => done++);
      map.update(0.5);
      expect(done, mode).toBe(0);
      for (let i = 0; i < 300 && done === 0; i++) map.update(1 / 60);
      expect(done, mode).toBe(1);
      expect(camOf(map).kpp).not.toBeCloseTo(before.kpp, 9);
      // with reduced motion: at once
      const quick = career(mode);
      quick.setReducedMotion(true);
      quick.setTotal(185);
      let now = 0;
      quick.promote(275, () => now++);
      expect(now).toBe(1);
    }
  });

  it("draws a whole picture at every tier, still and moving", () => {
    for (const mode of ["closest", "furthest"] as const) {
      const map = career(mode, 320, 180);
      for (let tier = 0; tier < 8; tier++) {
        map.setTotal(tier * 90);
        const s = new Surface(320, 180);
        s.clear(P.white);
        map.update(1 / 60);
        map.draw(s);
        let white = 0;
        for (const c of s.data) if (c === P.white) white++;
        expect(white, `${mode} tier ${tier}`).toBeLessThan(320 * 180 * 0.05);
      }
    }
  });
});

describe("the map in focus", () => {
  // the product owner, 2026-11-19: "it should only be blurry on transition but after it
  // should always be focus, however, ive noticed sometimes it goes blurry when i answer but
  // it hasnt transitioned"
  const [w, h] = [320, 180];
  /** A map at a tier with its town from above built and its view sharp. */
  const settled = (mode: "closest" | "furthest", total: number) => {
    const map = career(mode, w, h);
    map.setTotal(total);
    const s = new Surface(w, h);
    for (let i = 0; i < 200; i++) map.update(1 / 60);
    for (let i = 0; i < 20; i++) {
      map.update(1 / 60);
      map.draw(s);
    }
    return { map, s };
  };
  const frame = (map: MapScene): Uint32Array => {
    const s = new Surface(w, h);
    map.update(1 / 60);
    map.draw(s);
    return Uint32Array.from(s.data);
  };
  /** The share of pixels two frames have the same, rows `dy` apart. */
  const alike = (a: Uint32Array, b: Uint32Array, dy = 0): number => {
    let same = 0;
    let all = 0;
    for (let y = Math.max(0, dy); y < Math.min(h, h + dy); y++) {
      for (let x = 0; x < w; x++) {
        all++;
        if (a[(y - dy) * w + x] === b[y * w + x]) same++;
      }
    }
    return same / all;
  };

  it("stays sharp for a new question when the camera is already home", () => {
    for (const mode of ["closest", "furthest"] as const) {
      const { map } = settled(mode, 460);
      const before = frame(map);
      map.ask();
      expect((map as unknown as { move: unknown }).move, mode).toBeNull();
      // the pin pulses; everything else is the same picture
      expect(alike(before, frame(map)), mode).toBeGreaterThan(0.97);
    }
  });

  it("stays still and sharp for an answer it can already see", () => {
    // CLOSEST at its city (20 km across): an answer 7 km east of the pin is in sight
    const { map } = settled("closest", 370);
    const before = frame(map);
    let done = false;
    map.playShot("golazo", () => (done = true), {
      lat: 51.556,
      lng: -0.179,
      km: 7,
    });
    expect((map as unknown as { move: unknown }).move).toBeNull();
    for (let i = 0; i < 200 && !done; i++) frame(map);
    // the ground is the same picture (the ball, its trail and the counter come and go)
    expect(alike(before, frame(map))).toBeGreaterThan(0.95);
  });

  it("keeps the sharp picture while a new light is drawn, then shows it", () => {
    const { map } = settled("closest", 460);
    const before = frame(map);
    map.setLighting(lightingFor({ elevation: -30, morning: false }));
    expect(alike(before, frame(map))).toBeGreaterThan(0.97);
    for (let i = 0; i < 20; i++) frame(map);
    expect(alike(before, frame(map))).toBeLessThan(0.9);
  });

  it("moves the picture with the pin as it eases under the board, not blurring it", () => {
    const { map } = settled("closest", 460);
    const before = frame(map);
    const ay = camOf(map).ay;
    map.setCeiling(Math.round(h * 0.4));
    for (let i = 0; i < 5; i++) {
      const now = frame(map);
      const dy = Math.round(camOf(map).ay) - Math.round(ay);
      expect(alike(before, now, dy)).toBeGreaterThan(0.9);
    }
  });
});
