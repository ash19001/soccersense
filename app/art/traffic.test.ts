/**
 * Package G: the home picture's cars, coaches and people (stadium-cars.ts,
 * stadium-people.ts), and the traffic's map rules holding on the canvas.
 */

import { describe, expect, it } from "vitest";
import { Surface, type Color } from "~/pixel";
import { lightingFor } from "~/art/lighting";
import { P } from "~/art/palette";
import {
  HEADINGS,
  HEADING_STEP,
  carLamps,
  carSprite,
  coachSprite,
  headingAngle,
  mapHeading,
} from "~/art/stadium-cars";
import { carGrid, coachGrid, slotOf } from "~/art/stadium-cars";
import { CARS, COACHES } from "~/art/stadium-cars-grids";
import { makeLife } from "~/art/stadium-life";
import { ROAD } from "~/art/stadium-plan";
import {
  BAYS_PER_ROW,
  bayX,
  rowDir,
  rowV,
  staticCar,
} from "~/art/stadium-parking";
import { AX, NEAR_H, drawDog, drawDuck } from "~/art/stadium-people";
import {
  CAR_HALF_LONG,
  CAR_HALF_WIDE,
  PERSON_HALF,
  ZEBRA,
  onZebra,
} from "~/art/stadium-road";
import { person, type CarLook, type Ink } from "~/art/stadium-things";
import { carLook, coachLook, paintTown, personLook } from "~/art/stadium-town";
import {
  depthAtRow,
  makeView,
  project,
  projectRaw,
  scaleAt,
  sizeClass,
} from "~/art/stadium-view";

const LOOK: CarLook = {
  b: P.home,
  l: P.homeLight,
  d: P.homeDark,
  g: P.night,
  k: P.ink,
};
const DAY = lightingFor({ elevation: 45, morning: false });

/** Every pixel a drawing writes, as "x,y" -> colour. */
function record(draw: (ink: Ink) => void): Map<string, Color> {
  const out = new Map<string, Color>();
  const ink: Ink = {
    px(x, y, c) {
      out.set(`${x},${y}`, c);
    },
    rect(x, y, w, h, c) {
      for (let j = 0; j < h; j++)
        for (let i = 0; i < w; i++) out.set(`${x + i},${y + j}`, c);
    },
  };
  draw(ink);
  return out;
}

function bounds(px: Map<string, Color>): {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
} {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const k of px.keys()) {
    const [x, y] = k.split(",").map(Number);
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  return { x0, x1, y0, y1 };
}

const LETTERS_CAR = new Set("blndfrgwkmyqHTYQ.");
const LETTERS_COACH = new Set("oijJsegfrwkmnyqHTYQ.");

describe("the vehicle drawings", () => {
  it("keeps every grid rectangular, in its own letters, the anchor inside", () => {
    for (const [set, letters] of [
      [CARS, LETTERS_CAR],
      [COACHES, LETTERS_COACH],
    ] as const) {
      expect(set.length).toBe(3);
      for (const cls of set) {
        expect(cls.length).toBe(set === CARS ? 7 : 14);
        for (const g of cls) {
          const w = g.day[0].length;
          for (const row of g.day) {
            expect(row.length).toBe(w);
            for (const ch of row) expect(letters.has(ch), ch).toBe(true);
          }
          expect(g.ax).toBeGreaterThanOrEqual(0);
          expect(g.ax).toBeLessThan(w);
          expect(g.ay).toBeGreaterThanOrEqual(0);
          expect(g.ay).toBeLessThan(g.day.length);
        }
      }
    }
  });

  it("draws a near car about 14 x 8 east, 8 wide north, a coach 34 long", () => {
    const east = carGrid(2, 0);
    expect(east.day[0].length).toBeGreaterThanOrEqual(13);
    expect(east.day[0].length).toBeLessThanOrEqual(16);
    expect(east.day.length).toBeGreaterThanOrEqual(8);
    expect(east.day.length).toBeLessThanOrEqual(10);
    expect(carGrid(2, 6).day[0].length).toBeLessThanOrEqual(10);
    expect(carGrid(1, 0).day[0].length).toBeLessThan(east.day[0].length);
    expect(carGrid(0, 0).day[0].length).toBeLessThan(
      carGrid(1, 0).day[0].length,
    );
    const coach = coachGrid(2, 0);
    expect(coach.day[0].length).toBeGreaterThanOrEqual(32);
    expect(coach.day[0].length).toBeLessThanOrEqual(36);
  });

  it("maps every heading to a drawn one, mirroring the other ten exactly", () => {
    for (let h = 0; h < HEADINGS; h++) {
      const { i, mirror } = slotOf(h);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(14);
      if (!mirror) continue;
      // the mirror of heading h is heading 12 - h: the same pixels, x flipped
      const twin = (((12 - h) % HEADINGS) + HEADINGS) % HEADINGS;
      for (const cls of [0, 1, 2] as const) {
        const a = record((ink) => carSprite(ink, 50, 50, cls, h, LOOK));
        const b = record((ink) => carSprite(ink, 50, 50, cls, twin, LOOK));
        expect(a.size).toBe(b.size);
        for (const [k, c] of b) {
          const [x, y] = k.split(",").map(Number);
          expect(a.get(`${100 - x},${y}`)).toBe(c);
        }
      }
    }
  });

  it("draws the same pixels for the same inputs, only in the look's colours", () => {
    const look = carLook((c) => c, 0, 0.6);
    const allowed = new Set<Color>(
      [look.b, look.l, look.d, look.g, look.k, look.n, look.w, look.m]
        .concat([look.y, look.q])
        .filter((c): c is Color => c !== undefined),
    );
    for (let h = 0; h < HEADINGS; h++) {
      for (const cls of [0, 1, 2] as const) {
        const a = record((ink) => carSprite(ink, 0, 0, cls, h, look));
        const b = record((ink) => carSprite(ink, 0, 0, cls, h, look));
        expect([...a]).toEqual([...b]);
        for (const c of a.values()) expect(allowed.has(c)).toBe(true);
      }
    }
  });

  it("lights the lamps only where the drawing has them, the beam ahead of a car on the move", () => {
    for (let h = 0; h < HEADINGS; h++) {
      const body = record((ink) => carSprite(ink, 0, 0, 2, h, LOOK));
      const lit = record((ink) => carLamps(ink, 0, 0, 2, h, 1));
      let heads = 0;
      let beam = 0;
      for (const [k, c] of lit) {
        if (c === P.goldLight) heads++;
        if (c === P.gold) {
          beam++;
          continue;
        }
        expect(body.has(k), `heading ${h} lamp ${k}`).toBe(true);
      }
      expect(heads).toBeGreaterThanOrEqual(1);
      expect(beam).toBeGreaterThanOrEqual(1);
      // the beam points the way the car does
      const a = (headingAngle(h) * Math.PI) / 180;
      for (const [k, c] of lit) {
        if (c !== P.gold) continue;
        const [x, y] = k.split(",").map(Number);
        expect(x * Math.cos(a) - y * Math.sin(a)).toBeGreaterThan(0);
      }
      // reversing: white tail lights, no beam
      const back = record((ink) => carLamps(ink, 0, 0, 2, h, 2));
      for (const c of back.values()) expect(c).not.toBe(P.gold);
    }
  });

  it("parks a coach east-west and north-south from the same drawings", () => {
    const k = coachLook((c) => c, 0, 1);
    const a = record((ink) => coachSprite(ink, 0, 0, 2, 0, k));
    const box = bounds(a);
    expect(box.x1 - box.x0 + 1).toBeGreaterThanOrEqual(32);
  });
});

describe("the people", () => {
  const look = (kind: number, r = 0.3) => personLook((c) => c, r, kind);

  it("stands a near person 6 wide and 10 tall (11 in a hat) on row y - 1", () => {
    for (let i = 0; i < 200; i++) {
      const k = look(i % 4, (i + 0.5) / 200);
      for (const step of [0, 1]) {
        for (const back of [false, true]) {
          const px = record((ink) => person(ink, 40, 40, 2, k, step, 0, back));
          const b = bounds(px);
          expect(b.y1).toBe(39);
          expect(b.x0).toBeGreaterThanOrEqual(40 - AX);
          expect(b.x1).toBeLessThanOrEqual(40 - AX + 5);
          expect(b.y1 - b.y0 + 1).toBe(NEAR_H + (k.head === 2 ? 1 : 0));
        }
      }
    }
  });

  it("shows the back of the head from behind, and the arms up in a jump", () => {
    const k = look(0);
    const front = record((ink) => person(ink, 40, 40, 2, k, 0, 0));
    const back = record((ink) => person(ink, 40, 40, 2, k, 0, 0, true));
    expect([...front]).not.toEqual([...back]);
    const faceFront = [...front.values()].filter((c) => c === k.skin).length;
    const faceBack = [...back.values()].filter((c) => c === k.skin).length;
    expect(faceBack).toBeLessThan(faceFront);
    const up = record((ink) => person(ink, 40, 40, 2, k, 0, 4));
    expect(bounds(up).y1).toBe(35);
    // hands above the shoulders
    expect(up.get(`${40 - AX},${bounds(up).y0}`)).toBeDefined();
  });

  it("draws the middle class 2 x 6 and the far one 2 x 4", () => {
    const k = look(0);
    const mid = bounds(record((ink) => person(ink, 10, 20, 1, k, 0)));
    expect([mid.x1 - mid.x0 + 1, mid.y1 - mid.y0 + 1, mid.y1]).toEqual([
      2, 6, 19,
    ]);
    const far = bounds(record((ink) => person(ink, 10, 20, 0, k, 0)));
    expect([far.x1 - far.x0 + 1, far.y1 - far.y0 + 1, far.y1]).toEqual([
      2, 4, 19,
    ]);
  });

  it("gives every look its shades, lights and styles", () => {
    const two = look(0);
    expect(two.shirtDark).toBeDefined();
    expect(two.head).toBeDefined();
    // stewards wear the vest, the red-haired a bobble hat
    for (let i = 0; i < 997; i++) {
      const k = look(2, (i + 0.5) / 997);
      expect(k.body).toBe(2);
      if (k.hair === P.home) expect(k.head).toBe(2);
    }
  });

  it("turns the dog and the ducks round by mirroring them", () => {
    const c = P.wood;
    const right = record((ink) =>
      drawDog(ink, 20, 20, true, false, 0, c, c, c),
    );
    const left = record((ink) => drawDog(ink, 20, 20, true, true, 0, c, c, c));
    expect(left.size).toBe(right.size);
    for (const k of right.keys()) {
      const [x, y] = k.split(",").map(Number);
      expect(left.has(`${40 - x},${y}`)).toBe(true);
    }
    expect(bounds(right).y1).toBe(19);
    const dr = record((ink) => drawDuck(ink, 20, 20, false, c, c, c, c));
    const dl = record((ink) => drawDuck(ink, 20, 20, true, c, c, c, c));
    expect(bounds(dr).x1 - bounds(dr).x0).toBe(bounds(dl).x1 - bounds(dl).x0);
    expect(bounds(dr).y1).toBe(20);
  });
});

describe("the traffic on the canvas (960 x 540)", () => {
  it("parks each car along its bay and inside its lines", () => {
    const view = makeView(960, 540);
    let cars = 0;
    for (let band = 0; band < 3; band++) {
      for (let row = 0; row < 2; row++) {
        const V = rowV(band, row);
        for (let n = 0; n < BAYS_PER_ROW; n++) {
          if (!staticCar(band, row, n, 3)) continue;
          const X = bayX(n);
          const p = project(view, X, V);
          if (p.x < 0 || p.x >= view.w || p.y >= view.h) continue;
          const heading = mapHeading(view, X, V, rowDir(row));
          const left = X - 1.6;
          const right = X + 2.4;
          const where = `bay ${band}/${row}/${n}`;
          const ink: Ink = {
            px(x: number, y: number): void {
              const sc = scaleAt(view, depthAtRow(view, y + 0.5));
              const xl = view.cx + left * sc;
              const xr = view.cx + right * sc;
              expect(x, where).toBeGreaterThanOrEqual(Math.floor(xl));
              expect(x, where).toBeLessThanOrEqual(Math.ceil(xr));
            },
            rect(): void {},
          };
          carSprite(ink, p.x, p.y, sizeClass(p.s), heading, LOOK);
          cars++;
        }
      }
    }
    expect(cars).toBeGreaterThan(20);
  });

  it("keeps cars and people apart on the zebra, and every car pointing its way", () => {
    const view = makeView(960, 540);
    const life = makeLife(view, DAY, 7, paintTown(view, DAY, 7));
    const carOnZebra = (X: number, V: number, dir: number): boolean => {
      const hx = dir < 2 ? CAR_HALF_LONG : CAR_HALF_WIDE;
      const hv = dir < 2 ? CAR_HALF_WIDE : CAR_HALF_LONG;
      return (
        X + hx > ZEBRA.x0 &&
        X - hx < ZEBRA.x1 &&
        V + hv > ZEBRA.v0 &&
        V - hv < ZEBRA.v1
      );
    };
    let checked = 0;
    for (let f = 0; f < 240 * 20; f++) {
      const t = f / 20;
      let carOn = false;
      life.cars(t, (X, V, heading, fX, fV) => {
        const a = projectRaw(view, X - fX * 0.25, V - fV * 0.25);
        const b = projectRaw(view, X + fX * 0.25, V + fV * 0.25);
        const want = (Math.atan2(-(b.y - a.y), b.x - a.x) * 180) / Math.PI;
        const d = (((headingAngle(heading) - want) % 360) + 360) % 360;
        expect(Math.min(d, 360 - d)).toBeLessThanOrEqual(
          HEADING_STEP / 2 + 1e-6,
        );
        checked++;
        const dir = Math.abs(fX) > Math.abs(fV) ? 0 : 2;
        if (carOnZebra(X, V, dir)) carOn = true;
      });
      let personOn = false;
      life.people(t, (X, V) => {
        if (onZebra(X, V)) personOn = true;
      });
      expect(carOn && personOn, `t ${t}`).toBe(false);
    }
    expect(checked).toBeGreaterThan(1000);
    let standing = 0;
    life.standers((X, V) => {
      standing++;
      expect(onZebra(X, V)).toBe(false);
      const onRoad =
        V > ROAD.stadiumV0 - PERSON_HALF && V < ROAD.stadiumV1 + PERSON_HALF;
      expect(onRoad).toBe(false);
    });
    expect(standing).toBeGreaterThan(20);
  }, 120_000);

  it("draws the moving picture the same every time", () => {
    const view = makeView(960, 540);
    const night = lightingFor({ elevation: -30, morning: false });
    const a = new Surface(960, 540);
    const b = new Surface(960, 540);
    const town = paintTown(view, night, 3);
    makeLife(view, night, 3, town).draw(a, 21.3, 0.6);
    makeLife(view, night, 3, town).draw(b, 21.3, 0.6);
    expect(Buffer.from(a.data.buffer).equals(Buffer.from(b.data.buffer))).toBe(
      true,
    );
  }, 60_000);
});
