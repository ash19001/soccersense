import { describe, expect, it } from "vitest";

import { Surface } from "~/pixel";
import { menuLayout } from "~/art/layout";
import { lightingFor } from "~/art/lighting";
import { drawSky, moonPosition } from "~/art/sky";
import { MenuBackdrop, type MenuSign } from "~/art/stadium";
import { SIGN_PAUSE, airshipDrift, drawSignText } from "~/art/stadium-airship";
import { FACTS } from "~/data/facts";
import { ARRIVE, FALL, RETURN } from "~/art/stadium-airship-poke";
import { gOut, paintBowl } from "~/art/stadium-bowl";
import {
  EAST,
  HEADING_STEP,
  WEST,
  carSprite,
  headingAngle,
  mapHeading,
} from "~/art/stadium-cars";
import {
  CLEAR_ACROSS,
  CLEAR_ALONG,
  lapOf,
  planWalk,
  waitOf,
  walkAt,
} from "~/art/stadium-crossing";
import {
  FIREWORKS,
  carsOut,
  fireworksAt,
  makeLife,
  walkersOut,
} from "~/art/stadium-life";
import {
  GOAL_AT,
  MATCH_PERIOD,
  PLAYERS,
  makeMatchState,
  matchAt,
} from "~/art/stadium-match";
import {
  AISLE,
  BAND,
  BAYS_PER_ROW,
  GATE,
  bayX,
  rowDir,
  rowV,
  staticCar,
} from "~/art/stadium-parking";
import {
  CARS_UNTIL,
  CAR_HALF_LONG,
  CAR_HALF_WIDE,
  CYCLE,
  MARGIN,
  PERSON_HALF,
  ROAD_EAST,
  ROAD_WEST,
  ZEBRA,
  onZebra,
  peopleWindow,
  roadBusy,
  roadCars,
} from "~/art/stadium-road";
import { paintTown } from "~/art/stadium-town";
import {
  depthAtRow,
  makeView,
  project,
  projectRaw,
  scaleAt,
  sizeClass,
} from "~/art/stadium-view";
import { PLAZA_HALF, ROAD } from "~/art/stadium-plan";
import type { Lighting } from "~/art/lighting";
import { P } from "~/art/palette";

const NETS: MenuSign = {
  header: "Did you know?",
  text: "Goal nets were invented in 1889 by John Brodie, a Liverpool engineer who called them his proudest idea.",
};
const FLOODLIT: MenuSign = {
  header: "DID YOU KNOW?",
  text: "Bramall Lane in Sheffield staged the world's first floodlit football match, way back in 1878.",
};

/** The reference sizes: three phones, then monitors. */
const SIZES: readonly (readonly [number, number])[] = [
  [130, 281],
  [120, 222],
  [160, 300],
  [480, 270],
  [480, 300],
  [456, 256],
  [512, 288],
  [640, 360],
  [688, 288],
];

function make(w: number, h: number, elevation = 45, roar = 0): MenuBackdrop {
  const b = new MenuBackdrop({ seed: 3, sign: FLOODLIT });
  b.resize(w, h);
  b.setLighting(lightingFor({ elevation, morning: false }));
  b.setRoar(roar);
  return b;
}

function holes(s: Surface): number {
  let n = 0;
  for (let i = 0; i < s.data.length; i++) if (s.data[i] === 0) n++;
  return n;
}

function differing(a: Surface, b: Surface): number {
  let n = 0;
  for (let i = 0; i < a.data.length; i++) if (a.data[i] !== b.data[i]) n++;
  return n;
}

describe("MenuBackdrop", () => {
  it("covers every pixel at any size from 1 x 1 to 900 x 400, in any light, roaring or not", () => {
    const sizes: [number, number][] = [
      [1, 1],
      [2, 3],
      [7, 40],
      [40, 7],
      [1, 400],
      [900, 1],
      [61, 59],
      [33, 400],
      [195, 310],
      [260, 260],
      [400, 250],
      [720, 360],
      [900, 100],
      [900, 400],
      ...SIZES.map(([w, h]): [number, number] => [w, h]),
    ];
    for (const [w, h] of sizes) {
      for (const elevation of [45, 2, -3, -30]) {
        const s = new Surface(w, h);
        const b = make(w, h, elevation, elevation === -30 ? 1 : 0);
        expect(() => b.draw(s, 27.3)).not.toThrow();
        expect(holes(s), `${w}x${h} sun ${elevation}`).toBe(0);
      }
    }
  }, 60_000);

  it("resizes itself to the surface it is given", () => {
    const b = make(480, 270);
    for (const [w, h] of [
      [130, 281],
      [5, 5],
      [480, 270],
    ]) {
      const s = new Surface(w, h);
      b.draw(s, 1);
      expect(holes(s)).toBe(0);
    }
  });

  it("is a pure function of its inputs and the time", () => {
    const a = new Surface(160, 300);
    const c = new Surface(160, 300);
    const one = make(160, 300, -10, 0.6);
    const two = make(160, 300, -10, 0.6);
    one.draw(a, 12.34);
    two.draw(c, 77);
    two.draw(c, 12.34);
    expect(differing(a, c)).toBe(0);
    const wide = new Surface(480, 270);
    const again = new Surface(480, 270);
    make(480, 270, 30).draw(wide, 26.5);
    make(480, 270, 30).draw(again, 26.5);
    expect(differing(wide, again)).toBe(0);
  });

  it("never throws at an odd time", () => {
    const s = new Surface(480, 270);
    const b = make(480, 270, -30, 0.5);
    for (const t of [
      0,
      -1,
      -12345.678,
      1e9,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      0.1 + 0.2,
    ]) {
      expect(() => b.draw(s, t)).not.toThrow();
      expect(holes(s)).toBe(0);
    }
  });

  it("takes odd inputs without throwing", () => {
    const b = new MenuBackdrop({ seed: Number.NaN, sign: NETS });
    b.resize(Number.NaN, -4);
    b.setRoar(Number.NaN);
    b.setMoonPhase(Number.NaN);
    b.setSign({ header: "", text: "" });
    const s = new Surface(64, 64);
    expect(() => b.draw(s, 2)).not.toThrow();
    expect(holes(s)).toBe(0);
  });

  it("shows nothing of the roar at 0, and something at 1", () => {
    const a = new Surface(130, 281);
    const c = new Surface(130, 281);
    const calm = make(130, 281);
    const loud = make(130, 281);
    loud.setRoar(1);
    loud.draw(c, 3);
    calm.draw(a, 3);
    expect(differing(a, c)).toBeGreaterThan(50);
    loud.setRoar(0);
    loud.draw(c, 3);
    expect(differing(a, c)).toBe(0);
  });

  it("moves", () => {
    const a = new Surface(480, 270);
    const c = new Surface(480, 270);
    const b = make(480, 270);
    b.draw(a, 0);
    b.draw(c, 1.5);
    expect(differing(a, c)).toBeGreaterThan(0);
  });

  it("puts every fact on the sign letter for letter, in capitals", () => {
    const b = make(480, 270);
    const z = menuLayout(480, 270).scoreboard;
    /** The lit lamps (amber and green) in the panel, relative to its corner. */
    const lit = (q: Surface, ox: number, oy: number): string[] => {
      const out: string[] = [];
      for (let y = 0; y < z.h; y++) {
        for (let x = 0; x < z.w; x++) {
          const c = q.get(ox + x, oy + y);
          if (c === P.amber || c === P.ledGreen) out.push(`${x},${y},${c}`);
        }
      }
      return out;
    };
    const s = new Surface(480, 270);
    for (const fact of FACTS) {
      b.setSign({ header: "Did you know?", text: fact.text });
      for (const t of [0, SIGN_PAUSE + 9.3]) {
        b.draw(s, t);
        const d = airshipDrift(t);
        const want = new Surface(z.w, z.h);
        drawSignText(
          want,
          { header: "DID YOU KNOW?", text: fact.text.toUpperCase() },
          0,
          0,
          z.w,
          z.h,
          t,
        );
        expect(lit(s, z.x + d.dx, z.y + d.dy), `${fact.id} at ${t}`).toEqual(
          lit(want, 0, 0),
        );
      }
    }
  }, 30_000);

  it("redraws the sign when the fact or the header changes", () => {
    for (const [w, h] of [
      [130, 281],
      [480, 270],
    ]) {
      const z = menuLayout(w, h).scoreboard;
      const inSign = (a: Surface, c: Surface): number => {
        let n = 0;
        for (let y = z.y - 2; y < z.y + z.h + 2; y++) {
          for (let x = z.x - 2; x < z.x + z.w + 2; x++) {
            if (a.get(x, y) !== c.get(x, y)) n++;
          }
        }
        return n;
      };
      const a = new Surface(w, h);
      const c = new Surface(w, h);
      const b = make(w, h);
      b.draw(a, 0);
      b.setSign(NETS);
      b.draw(c, 0);
      expect(inSign(a, c)).toBeGreaterThan(20);
      b.setSign({ ...NETS, header: "A fact" });
      b.draw(a, 0);
      expect(inSign(a, c)).toBeGreaterThan(20);
      // in any case, and with its spaces tidied: the sign is capitals on one line
      b.setSign({
        header: "a fact",
        text: ` ${NETS.text.toLowerCase()}
`,
      });
      b.draw(c, 0);
      expect(inSign(a, c)).toBe(0);
    }
  });

  it("puts the target on the centre spot, inside the surface, clear of the logo and the ball", () => {
    for (const [w, h] of SIZES) {
      const m = menuLayout(w, h);
      const at = make(w, h).target();
      expect(at).toEqual({ x: m.cx, y: m.spotY });
      expect(at.x).toBeGreaterThanOrEqual(0);
      expect(at.x).toBeLessThan(w);
      expect(at.y).toBeGreaterThan(m.logo.h);
      expect(at.y).toBeLessThan(m.ballCy - m.ballR);
    }
    for (const [w, h] of [
      [1, 1],
      [3, 300],
      [900, 2],
      [900, 400],
    ]) {
      const at = make(w, h).target();
      expect(at.x).toBeGreaterThanOrEqual(0);
      expect(at.x).toBeLessThanOrEqual(w);
      expect(at.y).toBeGreaterThanOrEqual(0);
      expect(at.y).toBeLessThanOrEqual(h);
    }
  });

  it("gives a target before the first draw", () => {
    const b = new MenuBackdrop({ seed: 1, sign: NETS });
    const at = b.target();
    expect(Number.isFinite(at.x + at.y)).toBe(true);
  });

  it("paints the bowl inside the layout's stadium zone", () => {
    for (const [w, h] of SIZES) {
      const m = menuLayout(w, h);
      const light = lightingFor({ elevation: 45, morning: false });
      const bowl = paintBowl(
        makeView(w, h),
        { lit: light.lit, env: light.env, lightsOn: false, sunny: true },
        1,
      );
      let x0 = w;
      let x1 = -1;
      let y0 = h;
      let y1 = -1;
      for (let y = 0; y < bowl.layer.h; y++) {
        for (let x = 0; x < bowl.layer.w; x++) {
          if (bowl.layer.data[y * bowl.layer.w + x] === 0) continue;
          const sx = bowl.x + x;
          const sy = bowl.y + y;
          if (sx < 0 || sx >= w || sy < 0 || sy >= h) continue;
          x0 = Math.min(x0, sx);
          x1 = Math.max(x1, sx);
          y0 = Math.min(y0, sy);
          y1 = Math.max(y1, sy);
        }
      }
      const where = `${w}x${h}`;
      expect(x0, where).toBeGreaterThanOrEqual(m.stand.x);
      expect(x1, where).toBeLessThan(m.stand.x + m.stand.w);
      expect(y0, where).toBeGreaterThanOrEqual(m.stand.y);
      expect(y1, where).toBeLessThan(m.stand.y + m.stand.h);
      // and the zone is a fair description of it: within a few pixels all round
      expect(y0 - m.stand.y, where).toBeLessThanOrEqual(6);
      expect(m.stand.y + m.stand.h - 1 - y1, where).toBeLessThanOrEqual(6);
    }
  });

  it("leaves the logo zone to the sky", () => {
    // By day there are no halos, so the rows of the logo zone hold only what the sky
    // painted: the same pixels whether or not the ground is roaring below.
    for (const [w, h] of SIZES) {
      const m = menuLayout(w, h);
      const a = new Surface(w, h);
      const c = new Surface(w, h);
      make(w, h, 45, 0).draw(a, 2);
      make(w, h, 45, 1).draw(c, 2);
      let n = 0;
      for (let i = 0; i < w * m.logo.h; i++) if (a.data[i] !== c.data[i]) n++;
      expect(n, `${w}x${h}`).toBe(0);
    }
  });

  it("shows the whole moon or none of it: nothing stands in front of part of it", () => {
    // The moon used to hang behind the television tower on a monitor (a thin crescent was
    // all but hidden) and half behind the airship on a phone. Now every pixel of its disc
    // is the sky's own, or the airship hides the disc and its glow together.
    for (const [w, h] of [
      ...SIZES,
      [192, 256],
      [422, 195],
      [860, 360],
    ] as const) {
      const m = menuLayout(w, h);
      const { x, y } = m.sky.moon;
      const r = moonPosition(w, m.horizonY).r;
      for (const phase of [0.5, 0.08, 0.92]) {
        const light = lightingFor({ elevation: -30, morning: false });
        const b = make(w, h, -30);
        b.setMoonPhase(phase);
        const full = new Surface(w, h);
        b.draw(full, 2);
        const sky = new Surface(w, h);
        drawSky(sky, { light, t: 2, seed: 3, ...m.sky, moonPhase: phase });
        let own = 0;
        let hidden = 0;
        let glowHidden = 0;
        let glow = 0;
        for (let dy = -r - 6; dy <= r + 6; dy++) {
          for (let dx = -r - 6; dx <= r + 6; dx++) {
            const px = x + dx;
            const py = y + dy;
            if (px < 0 || py < 0 || px >= w || py >= m.horizonY) continue;
            const d = dx * dx + dy * dy;
            const same = full.data[py * w + px] === sky.data[py * w + px];
            if (d <= r * r) {
              if (same) own++;
              else hidden++;
            } else if (d <= (r + 6) * (r + 6)) {
              glow++;
              if (!same) glowHidden++;
            }
          }
        }
        const where = `${w}x${h} phase ${phase}`;
        // all of the disc, or none of it
        expect(Math.min(own, hidden), where).toBe(0);
        // and when it is hidden, so is its glow: no halo peeping out from behind the airship
        if (hidden > 0) expect(glowHidden, where).toBe(glow);
        // on a monitor it always shows
        if (w > h) expect(hidden, where).toBe(0);
      }
    }
    // 36 full renders: about 6 s on a busy machine, over the default 5 s limit.
  }, 30_000);
});

describe("Stadium Road and its zebra", () => {
  const REACH = 260;
  const SEED = 7;

  /** Whether a car's footprint at (X, V) with this heading overlaps the stripes. */
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

  it("never has a car and a person on the zebra at once, frame by frame for twenty minutes", () => {
    for (const [w, h] of [
      [480, 270],
      [130, 281],
    ] as const) {
      const view = makeView(w, h);
      const light = lightingFor({ elevation: 45, morning: false });
      const life = makeLife(view, light, SEED, paintTown(view, light, SEED));
      const where = `${w}x${h}`;
      const cars: { X: number; V: number }[] = [];
      let carFrames = 0;
      let peopleFrames = 0;
      let waiting = 0;
      let closest = Infinity;
      // 60 frames a second, as the scene draws them
      for (let f = 0; f < 1200 * 60; f++) {
        const t = f / 60;
        cars.length = 0;
        let carOn = false;
        life.cars(t, (X, V, heading) => {
          const dir = heading === EAST || heading === WEST ? 0 : 2;
          if (V > ZEBRA.v0 - 6 && V < ZEBRA.v1 + 6 && dir < 2) {
            cars.push({ X, V });
          }
          if (carOnZebra(X, V, dir)) carOn = true;
        });
        let personOn = false;
        life.people(t, (X, V, wait) => {
          if (wait) waiting++;
          if (onZebra(X, V)) personOn = true;
          for (const c of cars) {
            const gap = Math.max(
              Math.abs(X - c.X) - CAR_HALF_LONG - PERSON_HALF,
              Math.abs(V - c.V) - CAR_HALF_WIDE - PERSON_HALF,
            );
            if (gap < closest) closest = gap;
          }
        });
        if (carOn) carFrames++;
        if (personOn) peopleFrames++;
        if (carOn && personOn) {
          expect.fail(`${where}: a car and a person on the zebra at ${t}`);
        }
      }
      // both use it a good share of the time, and people wait their turn at the kerb
      expect(carFrames, where).toBeGreaterThan(1200 * 60 * 0.3);
      expect(peopleFrames, where).toBeGreaterThan(1200 * 60 * 0.1);
      expect(waiting, where).toBeGreaterThan(10_000);
      // and nobody is ever under a car anywhere on the road
      expect(closest, where).toBeGreaterThan(0);
    }
  }, 120_000);

  it("has nobody standing about on Stadium Road, on any day", () => {
    // The groups by the stadium's wall reach out as far as the road on most days; before
    // this was checked, the cars drove through people standing on the zebra.
    const light = lightingFor({ elevation: 45, morning: false });
    for (const [w, h] of [
      [480, 270],
      [130, 281],
    ] as const) {
      const view = makeView(w, h);
      for (let seed = 1; seed <= 30; seed++) {
        const life = makeLife(view, light, seed, paintTown(view, light, seed));
        let count = 0;
        life.standers((X, V) => {
          count++;
          const onRoad =
            V > ROAD.stadiumV0 - PERSON_HALF &&
            V < ROAD.stadiumV1 + PERSON_HALF;
          expect(onRoad, `${w}x${h} seed ${seed}: (${X}, ${V})`).toBe(false);
          expect(onZebra(X, V)).toBe(false);
        });
        expect(count).toBeGreaterThan(20);
      }
    }
  }, 60_000);

  it("keeps each lane to its timetable: whole windows, steady speed, never bumper to bumper", () => {
    for (let t = 0; t < CYCLE * 4; t += 0.05) {
      const west: number[] = [];
      const east: number[] = [];
      roadCars(t, SEED, REACH, (rc) => {
        expect(rc.V === ROAD_EAST || rc.V === ROAD_WEST).toBe(true);
        expect(Math.abs(rc.X)).toBeLessThanOrEqual(REACH + 1e-9);
        (rc.dir === 1 ? west : east).push(rc.X);
        // on the stripes only in the cars' window
        if (carOnZebra(rc.X, rc.V, rc.dir)) {
          const u = ((t % CYCLE) + CYCLE) % CYCLE;
          expect(u, `t ${t.toFixed(2)}`).toBeLessThan(CARS_UNTIL);
        }
      });
      for (const lane of [west, east]) {
        lane.sort((a, b) => a - b);
        for (let i = 1; i < lane.length; i++) {
          expect(lane[i] - lane[i - 1]).toBeGreaterThan(CAR_HALF_LONG * 2 + 4);
        }
      }
    }
    // the people's window is long enough to cross the stripes slowly, with time to spare
    expect(CYCLE - CARS_UNTIL - 2 * MARGIN).toBeGreaterThan(
      (ZEBRA.v1 - ZEBRA.v0 + 2 * PERSON_HALF) / 2.6 + 1.5,
    );
    expect(peopleWindow(CARS_UNTIL + MARGIN + 0.01)).toBe(true);
    expect(peopleWindow(CYCLE * 3 + 0.2)).toBe(false);
  });

  it("is busy where a car is, the same every cycle, and leaves gaps to cross in", () => {
    for (let t = 0; t < CYCLE; t += 0.07) {
      roadCars(t, SEED, REACH, (rc) => {
        expect(roadBusy(rc.X, rc.V, t, CLEAR_ALONG, CLEAR_ACROSS)).toBe(true);
        expect(roadBusy(rc.X, rc.V, t + CYCLE * 7, 0.5, 0.5)).toBe(true);
      });
    }
    for (const X of [-120, -57, -40, 0, 33, 52, 140]) {
      let free = 0;
      for (let t = 0; t < CYCLE; t += 0.05) {
        const west = roadBusy(X, ROAD_WEST, t, CLEAR_ALONG, CLEAR_ACROSS);
        const east = roadBusy(X, ROAD_EAST, t, CLEAR_ALONG, CLEAR_ACROSS);
        if (!west && !east) free++;
      }
      expect(free, `X ${X}`).toBeGreaterThan(100);
    }
  });

  it("plans a wait at the kerb of the zebra, and a lap of whole cycles", () => {
    // straight across the zebra at X = 20, setting off at every moment of a cycle
    const at = (d: number) => ({ X: 20, V: -130 + d });
    let waits = 0;
    for (let start = 0; start < CYCLE; start += 0.5) {
      for (const speed of [2.6, 3.3, 4]) {
        const stops = planWalk(at, 40, speed, start);
        expect(stops.length).toBeLessThanOrEqual(1);
        for (const s of stops) {
          // the kerb is short of the stripes, and nobody waits a whole cycle
          expect(at(s.d).V).toBeLessThan(ZEBRA.v0 - PERSON_HALF);
          expect(s.wait).toBeGreaterThan(0);
          expect(s.wait).toBeLessThan(CYCLE);
          waits++;
        }
        const lap = lapOf(40, speed, stops);
        expect(lap % CYCLE).toBe(0);
        expect(lap).toBeGreaterThanOrEqual(40 / speed + waitOf(stops));
        // walked through: stands still while waiting, never goes back, arrives, and is
        // on the stripes only in the people's window
        const place = { d: 0, waiting: false };
        let last = 0;
        for (let tau = 0; tau <= lap; tau += 0.05) {
          walkAt(stops, speed, tau, place);
          expect(place.d).toBeGreaterThanOrEqual(last - 1e-9);
          if (place.waiting) expect(place.d).toBe(stops[0].d);
          const p = at(Math.min(place.d, 40));
          if (onZebra(p.X, p.V)) expect(peopleWindow(start + tau)).toBe(true);
          last = place.d;
        }
        expect(last).toBeGreaterThanOrEqual(40 - 0.3);
      }
    }
    expect(waits).toBeGreaterThan(10);
  });

  it("has about a third fewer cars and people on the move, the most taken off the road and the plaza", () => {
    // Counted the same way at 480 x 270 before the product owner asked for a little less:
    // every car and walker in the picture, averaged over a minute of frames.
    const BEFORE = { cars: 86.97, road: 15.9, people: 83.68, plaza: 28.32 };
    const view = makeView(480, 270);
    const light = lightingFor({ elevation: 45, morning: false });
    const life = makeLife(view, light, 3, paintTown(view, light, 3));
    const seen = (X: number, V: number): boolean => {
      const p = project(view, X, V);
      return p.x >= 0 && p.x < view.w && p.y < view.h && p.y >= view.hy;
    };
    let cars = 0;
    let road = 0;
    let people = 0;
    let plaza = 0;
    let frames = 0;
    for (let t = 0; t < 60; t += 0.25) {
      frames++;
      life.cars(t, (X, V) => {
        if (!seen(X, V)) return;
        cars++;
        if (V < -100 && V > -125) road++;
      });
      life.people(t, (X, V) => {
        if (!seen(X, V)) return;
        people++;
        if (Math.abs(X) < 70 && V < -95) plaza++;
      });
    }
    const ratio = (n: number, before: number): number => n / frames / before;
    expect(ratio(cars, BEFORE.cars)).toBeGreaterThan(0.55);
    expect(ratio(cars, BEFORE.cars)).toBeLessThan(0.75);
    expect(ratio(people, BEFORE.people)).toBeGreaterThan(0.55);
    expect(ratio(people, BEFORE.people)).toBeLessThan(0.75);
    expect(ratio(road, BEFORE.road)).toBeLessThan(0.6);
    expect(ratio(plaza, BEFORE.plaza)).toBeLessThan(0.75);
  });

  it("parks the car park full for the day, leaving the gate's lane clear", () => {
    for (let seed = 0; seed < 5; seed++) {
      let parked = 0;
      let bays = 0;
      for (let band = 0; band < 7; band++) {
        for (let row = 0; row < 2; row++) {
          const V = rowV(band, row);
          // every row stands clear of the aisle in its band
          expect(Math.abs(V - (AISLE.mid - band * BAND))).toBeGreaterThan(5);
          for (let n = 0; n < BAYS_PER_ROW; n++) {
            bays++;
            if (!staticCar(band, row, n, seed)) continue;
            parked++;
            // nothing in the lanes of the gate or under the gatehouse
            if (band === 0 && row === 0) {
              expect(bayX(n)).toBeGreaterThan(GATE.x1 + 5);
            }
          }
        }
      }
      expect(parked / bays).toBeGreaterThan(0.85);
    }
  });
});

describe("the match", () => {
  it("returns to its start: the loop closes exactly", () => {
    const a = matchAt(makeMatchState(), 0);
    for (const t of [MATCH_PERIOD, -MATCH_PERIOD, MATCH_PERIOD * 7]) {
      const b = matchAt(makeMatchState(), t);
      for (let i = 0; i < PLAYERS; i++) {
        expect(b.x[i]).toBeCloseTo(a.x[i], 4);
        expect(b.v[i]).toBeCloseTo(a.v[i], 4);
      }
      expect(b.ballX).toBeCloseTo(a.ballX, 4);
      expect(b.ballV).toBeCloseTo(a.ballV, 4);
      expect(b.ballH).toBeCloseTo(a.ballH, 4);
    }
    // and across the seam nothing jumps
    const before = matchAt(makeMatchState(), MATCH_PERIOD - 1 / 8);
    for (let i = 0; i < PLAYERS; i++) {
      expect(
        Math.hypot(before.x[i] - a.x[i], before.v[i] - a.v[i]),
      ).toBeLessThan(2);
    }
  });

  it("moves everybody a step at a time, and keeps them on the pitch", () => {
    const now = makeMatchState();
    const next = makeMatchState();
    let fastest = 0;
    let ballFastest = 0;
    for (let step = 0; step < MATCH_PERIOD * 8; step++) {
      matchAt(now, step / 8);
      matchAt(next, (step + 1) / 8);
      for (let i = 0; i < PLAYERS; i++) {
        expect(Math.abs(now.x[i])).toBeLessThanOrEqual(71);
        expect(Math.abs(now.v[i])).toBeLessThanOrEqual(43);
        const d = Math.hypot(next.x[i] - now.x[i], next.v[i] - now.v[i]);
        if (d > fastest) fastest = d;
      }
      expect(now.ballH).toBeGreaterThanOrEqual(0);
      expect(Math.abs(now.ballX)).toBeLessThanOrEqual(72);
      expect(Math.abs(now.ballV)).toBeLessThanOrEqual(44);
      expect(now.cheer).toBeGreaterThanOrEqual(0);
      expect(now.cheer).toBeLessThanOrEqual(1);
      const bd = Math.hypot(next.ballX - now.ballX, next.ballV - now.ballV);
      if (bd > ballFastest) ballFastest = bd;
    }
    // an eighth of a second: a sprint is under three units, a shot under ten
    expect(fastest).toBeLessThan(3);
    expect(ballFastest).toBeLessThan(10);
  });

  it("has a save and a goal in it, and the crowd reacts to both", () => {
    const m = makeMatchState();
    expect(matchAt(m, 5).cheer).toBe(0);
    expect(matchAt(m, 15.2).cheer).toBeGreaterThan(0.2);
    expect(matchAt(m, 15.2).cheer).toBeLessThan(0.5);
    expect(matchAt(m, 27).cheer).toBe(1);
    expect(matchAt(m, 27).sinceGoal).toBeCloseTo(1, 5);
    expect(matchAt(m, 27).ballX).toBeGreaterThan(68);
    expect(matchAt(m, 39).cheer).toBe(0);
    expect(matchAt(m, 39).sinceGoal).toBe(-1);
  });

  it("takes any time at all", () => {
    const m = makeMatchState();
    for (const t of [Number.NaN, Infinity, -Infinity, -0.001, 1e12]) {
      matchAt(m, t);
      for (let i = 0; i < PLAYERS; i++) {
        expect(Number.isFinite(m.x[i] + m.v[i])).toBe(true);
      }
      expect(Number.isFinite(m.ballX + m.ballV + m.ballH)).toBe(true);
    }
  });
});

describe("poking the airship", () => {
  /** Poke every `gap` seconds from `from`; the results. */
  const pokeRun = (
    b: MenuBackdrop,
    from: number,
    gap: number,
    n: number,
  ): string[] => {
    const out: string[] = [];
    for (let i = 0; i < n; i++) out.push(b.pokeAirship(from + i * gap));
    return out;
  };
  const fresh = (w = 480, h = 270): MenuBackdrop => make(w, h);
  const signZone = (s: Surface): number[] => {
    const z = menuLayout(s.w, s.h).scoreboard;
    const out: number[] = [];
    for (let y = z.y; y < z.y + z.h; y++) {
      for (let x = z.x; x < z.x + z.w; x++) out.push(s.get(x, y));
    }
    return out;
  };

  it("never pops under slow, occasional clicks", () => {
    for (const gap of [1, 1.5, 3]) {
      const r = pokeRun(fresh(), 5, gap, 200);
      expect(
        r.every((x) => x === "wobble"),
        `every ${gap} s`,
      ).toBe(true);
    }
  });

  it("pops on about the fifth or sixth quick click", () => {
    for (const gap of [0.12, 0.2, 0.3, 0.4]) {
      const r = pokeRun(fresh(), 5, gap, 10);
      const at = r.indexOf("pop") + 1;
      expect(at, `every ${gap} s`).toBeGreaterThanOrEqual(5);
      expect(at, `every ${gap} s`).toBeLessThanOrEqual(6);
    }
    // stress relaxes: a pause in the middle starts it nearly afresh
    const b = fresh();
    pokeRun(b, 5, 0.2, 4);
    expect(pokeRun(b, 20, 0.2, 4)).toEqual(Array(4).fill("wobble"));
  });

  it("has nothing to click while it falls, lies wrecked or is gone, then comes back", () => {
    const b = fresh();
    const r = pokeRun(b, 5, 0.2, 10);
    const pop = 5 + r.indexOf("pop") * 0.2;
    for (const d of [0, 0.3, FALL / 2, FALL + 0.5, RETURN - 0.01]) {
      expect(b.pokeAirship(pop + d), `${d} s after`).toBe("none");
      expect(b.airshipAt(100, 60, pop + d)).toBe(false);
    }
    // gone: the sign is not where it was
    const untouched = fresh();
    const s = new Surface(480, 270);
    const u = new Surface(480, 270);
    b.draw(s, pop + 5);
    untouched.draw(u, pop + 5);
    expect(signZone(s)).not.toEqual(signZone(u));
    // back in its place, and exactly as it was, once the new one has drifted in: all but
    // the fact, which starts again from the left (see "carries the same fact")
    const back = pop + RETURN + ARRIVE + 0.5;
    b.draw(s, back);
    untouched.draw(u, back);
    const z = menuLayout(480, 270).scoreboard;
    const d = airshipDrift(back);
    let off = 0;
    for (let y = 0; y < 270; y++) {
      for (let x = 0; x < 480; x++) {
        const inField =
          x >= z.x + 2 + d.dx &&
          x < z.x + z.w - 2 + d.dx &&
          y >= z.y + 2 + d.dy &&
          y < z.y + z.h - 2 + d.dy;
        if (!inField && s.get(x, y) !== u.get(x, y)) off++;
      }
    }
    expect(off).toBe(0);
    expect(differing(s, u)).toBeGreaterThan(0);
    // and it can be poked again (while drifting in, too)
    expect(b.pokeAirship(pop + RETURN + 0.5)).toBe("wobble");
  });

  it("is under the pointer on its sign and envelope, and not on the sky beside it", () => {
    for (const [w, h] of SIZES) {
      const b = fresh(w, h);
      const z = menuLayout(w, h).scoreboard;
      const where = `${w}x${h}`;
      for (const t of [0, 3.7, 11]) {
        expect(b.airshipAt(z.x + z.w / 2, z.y + z.h / 2, t), where).toBe(true);
        expect(b.airshipAt(z.x + 3, z.y + 3, t), where).toBe(true);
        // well above it, and beyond its tail
        expect(b.airshipAt(z.x + z.w / 2, z.y - 32, t), where).toBe(false);
        expect(b.airshipAt(z.x + z.w + 40, z.y + z.h / 2, t), where).toBe(
          false,
        );
      }
      expect(b.airshipAt(Number.NaN, 0, 0)).toBe(false);
    }
    expect(new MenuBackdrop({ seed: 1, sign: NETS }).airshipAt(5, 5, 0)).toBe(
      false,
    );
  });

  it("keeps its stress through a change of size and of light", () => {
    const b = fresh();
    const s = new Surface(480, 270);
    b.draw(s, 5);
    expect(pokeRun(b, 5, 0.2, 4)).toEqual(Array(4).fill("wobble"));
    b.resize(130, 281);
    b.draw(new Surface(130, 281), 5.65);
    b.setLighting(lightingFor({ elevation: -30, morning: false }));
    b.resize(480, 270);
    b.draw(s, 5.7);
    // the stress is still there: two more quick ones and it goes
    expect(pokeRun(b, 5.8, 0.2, 2)).toContain("pop");
    // and it stays down whatever the size
    b.resize(640, 360);
    expect(b.pokeAirship(7)).toBe("none");
  });

  it("draws the same pixels for the same pokes and the same clock", () => {
    const pokes = [1, 1.2, 1.4, 4, 4.1, 4.2, 4.3, 4.4, 4.5];
    const a = fresh();
    const b = fresh();
    for (const t of pokes) {
      expect(a.pokeAirship(t)).toBe(b.pokeAirship(t));
    }
    const sa = new Surface(480, 270);
    const sb = new Surface(480, 270);
    let moved = 0;
    for (const t of [1.05, 1.5, 4.25, 4.6, 5.5, 7.5, 9, 13, 15.5, 20]) {
      a.draw(sa, t);
      b.draw(sb, t);
      expect(differing(sa, sb), `t ${t}`).toBe(0);
      // drawn again, out of order: the same
      b.draw(sb, 1.05);
      b.draw(sb, t);
      expect(differing(sa, sb), `again at ${t}`).toBe(0);
      const u = new Surface(480, 270);
      fresh().draw(u, t);
      if (differing(sa, u) > 0) moved++;
    }
    // and the pokes showed: most of those frames differ from an airship left alone
    expect(moved).toBeGreaterThan(6);
  }, 30_000);

  it("carries the same fact on the new airship, from its start", () => {
    for (const [w, h] of [
      [480, 270],
      [130, 281],
    ] as const) {
      const b = fresh(w, h);
      const z = menuLayout(w, h).scoreboard;
      /** The sign's lamp field at t, wherever the drift has taken it. */
      const field = (t: number): number[] => {
        const s = new Surface(w, h);
        b.draw(s, t);
        const d = airshipDrift(t);
        const out: number[] = [];
        for (let y = z.y + 2; y < z.y + z.h - 2; y++) {
          for (let x = z.x + 2; x < z.x + z.w - 2; x++) {
            out.push(s.get(x + d.dx, y + d.dy));
          }
        }
        return out;
      };
      // the page opens on the start of the fact, which rests, then scrolls
      const start = field(0);
      const later = field(SIGN_PAUSE + 3);
      expect(field(SIGN_PAUSE - 0.1)).toEqual(start);
      expect(later).not.toEqual(start);
      // popped at about 21 s: the new airship is in its place 14.5 s later
      const r = pokeRun(b, 20, 0.15, 8);
      expect(r).toContain("pop");
      const home = 20 + r.indexOf("pop") * 0.15 + RETURN + ARRIVE;
      expect(field(home + 0.01)).toEqual(start);
      expect(field(home + SIGN_PAUSE - 0.1)).toEqual(start);
      expect(field(home + SIGN_PAUSE + 3)).toEqual(later);
    }
  }, 30_000);

  it("draws every frame of a pop and a fall, at every size, without holes", () => {
    for (const [w, h] of [
      [130, 281],
      [120, 222],
      [160, 300],
      [480, 270],
      [688, 288],
    ] as const) {
      const b = fresh(w, h);
      const r = pokeRun(b, 1, 0.15, 8);
      const pop = 1 + r.indexOf("pop") * 0.15;
      const s = new Surface(w, h);
      for (let d = 0; d < RETURN + ARRIVE + 1; d += 0.37) {
        b.draw(s, pop + d);
        expect(holes(s), `${w}x${h} at ${d.toFixed(2)}`).toBe(0);
      }
    }
  }, 30_000);
});

/** Degrees between two directions, 0 to 180. */
function apart(a: number, b: number): number {
  const d = (((a - b) % 360) + 360) % 360;
  return d > 180 ? 360 - d : d;
}

type View = ReturnType<typeof makeView>;

/** The direction on screen, degrees anticlockwise from east, of (dX, dV) at (X, V). */
function screenAngle(
  view: View,
  X: number,
  V: number,
  dX: number,
  dV: number,
): number {
  const a = projectRaw(view, X - dX * 0.25, V - dV * 0.25);
  const b = projectRaw(view, X + dX * 0.25, V + dV * 0.25);
  return (Math.atan2(-(b.y - a.y), b.x - a.x) * 180) / Math.PI;
}

function lifeFor(w: number, h: number, light: Lighting, seed = 3) {
  const view = makeView(w, h);
  return {
    view,
    life: makeLife(view, light, seed, paintTown(view, light, seed)),
  };
}

const DAY = lightingFor({ elevation: 45, morning: false });
const DUSK = lightingFor({ elevation: -3, morning: false });
const NIGHT = lightingFor({ elevation: -30, morning: false });

describe("cars that point the way they go", () => {
  it("draws every moving car, bus and coach within half a step of its way on screen", () => {
    for (const [w, h] of [
      [480, 270],
      [130, 281],
      [640, 360],
    ] as const) {
      const { view, life } = lifeFor(w, h, DAY);
      let checked = 0;
      let slanted = 0;
      const coachHeadings = new Set<number>();
      // a few minutes, so the away coach comes, turns into its bay and backs out
      for (let t = 0; t < 300; t += 0.25) {
        life.cars(t, (X, V, heading, fX, fV) => {
          const want = screenAngle(view, X, V, fX, fV);
          const err = apart(headingAngle(heading), want);
          expect(
            err,
            `${w}x${h} t ${t} at ${X.toFixed(1)},${V.toFixed(1)}`,
          ).toBeLessThanOrEqual(HEADING_STEP / 2 + 1e-6);
          checked++;
          if (heading !== EAST && heading !== WEST) slanted++;
          if (Math.abs(X + 190) < 16 && Math.abs(V - 60) < 8) {
            coachHeadings.add(heading);
          }
        });
      }
      expect(checked).toBeGreaterThan(1000);
      expect(slanted).toBeGreaterThan(300);
      // the coach turns into its bay through the headings from up the road to west
      expect(coachHeadings.size, `${w}x${h}`).toBeGreaterThanOrEqual(4);
    }
  });

  it("parks each car along its bay and inside its lines", () => {
    const view = makeView(480, 270);
    let cars = 0;
    for (let band = 0; band < 3; band++) {
      for (let row = 0; row < 2; row++) {
        const V = rowV(band, row);
        for (let n = 0; n < BAYS_PER_ROW; n++) {
          if (!staticCar(band, row, n, 3)) continue;
          const X = bayX(n);
          const p = project(view, X, V);
          if (p.x < 0 || p.x >= view.w || p.y >= view.h) continue;
          // the bay's lines run north on the map: the car points along them
          const heading = mapHeading(view, X, V, rowDir(row));
          const line = screenAngle(view, X, V, 0, row === 0 ? -1 : 1);
          expect(apart(headingAngle(heading), line)).toBeLessThanOrEqual(
            HEADING_STEP / 2 + 1e-6,
          );
          // every pixel of it between the painted lines either side (X = 62.4 + 4k)
          const left = X - 1.6;
          const right = X + 2.4;
          const where = `bay ${band}/${row}/${n}`;
          const ink = {
            px(x: number, y: number): void {
              const sc = scaleAt(view, depthAtRow(view, y + 0.5));
              const xl = view.cx + left * sc;
              const xr = view.cx + right * sc;
              expect(x, where).toBeGreaterThanOrEqual(Math.floor(xl));
              expect(x, where).toBeLessThanOrEqual(Math.ceil(xr));
            },
            rect(): void {},
          };
          carSprite(ink, p.x, p.y, sizeClass(p.s), heading, {
            b: P.home,
            l: P.homeLight,
            d: P.homeDark,
            g: P.night,
            k: P.ink,
          });
          cars++;
        }
      }
    }
    expect(cars).toBeGreaterThan(20);
  });
});

describe("fewer people about at night", () => {
  const seen = (view: View, X: number, V: number): boolean => {
    const p = project(view, X, V);
    return p.x >= 0 && p.x < view.w && p.y < view.h && p.y >= view.hy;
  };

  it("has everybody out by day, fewer at dusk and about a third at night", () => {
    expect(walkersOut(DAY)).toBe(1);
    expect(carsOut(DAY)).toBe(1);
    const count = (light: Lighting): { people: number; cars: number } => {
      const { view, life } = lifeFor(480, 270, light);
      let people = 0;
      let cars = 0;
      let frames = 0;
      for (let t = 0; t < 240; t += 0.5) {
        frames++;
        life.people(t, (X, V) => {
          if (seen(view, X, V)) people++;
        });
        life.cars(t, (X, V) => {
          if (seen(view, X, V)) cars++;
        });
      }
      return { people: people / frames, cars: cars / frames };
    };
    const day = count(DAY);
    const dusk = count(DUSK);
    const night = count(NIGHT);
    expect(dusk.people).toBeLessThan(day.people * 0.85);
    expect(dusk.people).toBeGreaterThan(night.people * 1.3);
    expect(night.people / day.people).toBeGreaterThan(0.22);
    expect(night.people / day.people).toBeLessThan(0.48);
    // the traffic thins too, more gently
    expect(night.cars).toBeLessThan(day.cars * 0.85);
    expect(night.cars).toBeGreaterThan(day.cars * 0.45);
  });

  it("never has a walker appear or vanish in the middle of the picture", () => {
    // the ends of the walks: the edges, the turnstiles, and these doors
    const DOORS: readonly (readonly [number, number])[] = [
      [-PLAZA_HALF - 12, ROAD.stadiumV0 - 3], // the pub
      [222, 156], // the station
      [236, 156],
      [-200, 66], // the coaches
      [-198, -24],
      [PLAZA_HALF - 19, ROAD.stadiumV0 - 8.5], // beside the pie van's hatch
    ];
    for (const [w, h] of [
      [480, 270],
      [130, 281],
    ] as const) {
      for (const light of [NIGHT, DUSK]) {
        const { view, life } = lifeFor(w, h, light);
        const atEnd = (X: number, V: number): boolean => {
          if (!seen(view, X, V)) return true;
          const g = gOut(X, V);
          if (g > 0.98 && g < 1.12) return true;
          return DOORS.some(([dx, dv]) => Math.hypot(X - dx, V - dv) < 6);
        };
        let last = new Map<number, [number, number]>();
        let comings = 0;
        for (let f = 0; f < 4000; f++) {
          const t = f / 10;
          const now = new Map<number, [number, number]>();
          life.people(t, (X, V, _wait, who) => {
            now.set(who, [X, V]);
            if (f > 0 && !last.has(who)) {
              comings++;
              const at = `${X.toFixed(1)},${V.toFixed(1)}`;
              expect(atEnd(X, V), `${w}x${h} ${who} appears at ${at}`).toBe(
                true,
              );
            }
          });
          for (const [who, [X, V]] of last) {
            if (now.has(who)) continue;
            const at = `${X.toFixed(1)},${V.toFixed(1)}`;
            expect(atEnd(X, V), `${w}x${h} ${who} vanishes at ${at}`).toBe(
              true,
            );
          }
          last = now;
        }
        expect(comings).toBeGreaterThan(20);
      }
    }
  }, 60_000);
});

describe("fireworks for the goal", () => {
  it("go up when the goal is scored, and at no other time", () => {
    for (let t = -80; t < 120; t += 0.05) {
      const since =
        (((t % MATCH_PERIOD) + MATCH_PERIOD) % MATCH_PERIOD) - GOAL_AT;
      const n = fireworksAt(t, true);
      if (since < 0 || since >= FIREWORKS) expect(n, `t ${t}`).toBe(0);
      if (since >= 0.25 && since < 3.5) expect(n, `t ${t}`).toBeGreaterThan(0);
      expect(fireworksAt(t)).toBeLessThanOrEqual(n);
    }
  });

  it("shows bursts over the stadium, clear of the logo, the same every time", () => {
    for (const light of [DAY, NIGHT]) {
      const { view, life } = lifeFor(480, 270, light);
      const frame = (t: number): Surface => {
        const s = new Surface(view.w, view.h);
        life.draw(s, t, 0);
        return s;
      };
      const before = frame(GOAL_AT - 2);
      const during = frame(GOAL_AT + 1.4);
      // the bursts are in the sky over the far stands: count changed pixels above it
      const rim = project(view, 0, 120, 0).y;
      let changed = 0;
      for (let y = 0; y < rim; y++) {
        for (let x = 0; x < view.w; x++) {
          const i = y * view.w + x;
          if (before.data[i] === during.data[i]) continue;
          changed++;
          // never in the logo's sky
          expect(y, `(${x}, ${y})`).toBeGreaterThanOrEqual(view.logoH);
        }
      }
      expect(changed).toBeGreaterThan(25);
      const again = lifeFor(480, 270, light).life;
      const twin = new Surface(view.w, view.h);
      again.draw(twin, GOAL_AT + 1.4, 0);
      expect(differing(during, twin)).toBe(0);
    }
  });
});
