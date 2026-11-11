import { describe, expect, it } from "vitest";

import { Surface } from "~/pixel";
import { menuLayout } from "~/art/layout";
import { lightingFor } from "~/art/lighting";
import { drawSky, moonPosition } from "~/art/sky";
import { MenuBackdrop, type MenuStadiumInfo } from "~/art/stadium";
import { paintBowl } from "~/art/stadium-bowl";
import {
  CLEAR_ACROSS,
  CLEAR_ALONG,
  lapOf,
  planWalk,
  waitOf,
  walkAt,
} from "~/art/stadium-crossing";
import { makeLife } from "~/art/stadium-life";
import {
  MATCH_PERIOD,
  PLAYERS,
  makeMatchState,
  matchAt,
} from "~/art/stadium-match";
import {
  AISLE,
  BAYS_PER_ROW,
  GATE,
  LIVE,
  LOT_TOP,
  ORDER,
  PERIOD,
  ROAD_EAST,
  ROAD_WEST,
  TICK,
  bayPlace,
  bayX,
  liveCars,
  parkedFrom,
  parkedUntil,
  roadBusy,
  roadCars,
  rowV,
  staticCar,
  type LiveCar,
} from "~/art/stadium-parking";
import { paintTown } from "~/art/stadium-town";
import { makeView } from "~/art/stadium-view";

const ANFIELD: MenuStadiumInfo = {
  name: "Anfield",
  city: "Liverpool",
  country: "England",
};
const BERNABEU: MenuStadiumInfo = {
  name: "Estadio Santiago Bernabéu",
  city: "Madrid",
  country: "Spain",
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
  const b = new MenuBackdrop({ seed: 3, stadium: BERNABEU });
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
    const b = new MenuBackdrop({ seed: Number.NaN, stadium: ANFIELD });
    b.resize(Number.NaN, -4);
    b.setRoar(Number.NaN);
    b.setMoonPhase(Number.NaN);
    b.setHeader("");
    b.setStadium({ name: "", city: "", country: "" });
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

  it("redraws the sign when the stadium or the header changes", () => {
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
      b.setStadium(ANFIELD);
      b.draw(c, 0);
      expect(inSign(a, c)).toBeGreaterThan(20);
      b.setHeader("Yesterday's stadium");
      b.draw(a, 0);
      expect(inSign(a, c)).toBeGreaterThan(20);
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
    const b = new MenuBackdrop({ seed: 1, stadium: ANFIELD });
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

describe("the car park's timetable", () => {
  /** Half a car, along and across, for a heading. */
  const halfX = (dir: number): number => (dir < 2 ? 2.2 : 1.0);
  const halfV = (dir: number): number => (dir < 2 ? 1.0 : 2.2);
  const REACH = 260;

  it("serves every live bay once a period, each on its own tick", () => {
    expect([...ORDER].sort((a, b) => a - b)).toEqual(LIVE.map((_, i) => i));
    expect(PERIOD).toBe(LIVE.length * TICK);
    const seen = new Set<string>();
    for (const [row, n] of LIVE) {
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(BAYS_PER_ROW);
      // the static painter leaves a live bay empty, whatever the seed
      for (let seed = 0; seed < 20; seed++) {
        expect(staticCar(0, row, n, seed)).toBe(false);
      }
      seen.add(`${row}/${n}`);
    }
    expect(seen.size).toBe(LIVE.length);
    for (let i = 0; i < LIVE.length; i++) {
      for (const visit of [-3, 0, 1, 40]) {
        // a car has left before the next one for the same bay finishes parking
        expect(parkedFrom(i, visit)).toBeLessThan(parkedUntil(i, visit));
        expect(parkedUntil(i, visit)).toBeLessThan(parkedFrom(i, visit + 1));
      }
    }
  });

  it("never puts two cars in one bay, and never drives one through another", () => {
    const cars: LiveCar[] = [];
    let closest = Infinity;
    for (let t = -PERIOD; t < PERIOD * 3; t += 0.04) {
      const n = liveCars(cars, t, 7, REACH);
      // one car at most in each live bay
      for (let i = 0; i < LIVE.length; i++) {
        const b = bayPlace(i);
        let inBay = 0;
        for (let a = 0; a < n; a++) {
          const c = cars[a];
          if (Math.abs(c.X - b.X) < 1.9 && Math.abs(c.V - b.V) < 2.4) inBay++;
        }
        expect(inBay, `bay ${i} at ${t.toFixed(2)}`).toBeLessThanOrEqual(1);
      }
      for (let a = 0; a < n; a++) {
        const A = cars[a];
        // parked means in its own bay
        if (A.state === 0) {
          const b = bayPlace(A.bay);
          expect(A.X).toBe(b.X);
          expect(A.V).toBe(b.V);
        } else if (A.V < LOT_TOP) {
          // moving inside the car park: in the gate's lanes, in the aisle, or in the
          // column of its own bay (never over a bay that holds somebody else's car)
          const own = bayPlace(A.bay);
          const inGate = A.X >= GATE.x0 && A.X <= GATE.x1;
          const inAisle =
            A.V <= AISLE.north + 0.01 && A.V >= AISLE.south - 0.01;
          const inOwn = Math.abs(A.X - own.X) < 0.01;
          expect(
            inGate || inAisle || inOwn,
            `car of bay ${A.bay} at ${t.toFixed(2)}`,
          ).toBe(true);
        }
        for (let b = a + 1; b < n; b++) {
          const B = cars[b];
          if (A.state === 0 && B.state === 0) continue;
          const gap = Math.max(
            Math.abs(A.X - B.X) - halfX(A.dir) - halfX(B.dir),
            Math.abs(A.V - B.V) - halfV(A.dir) - halfV(B.dir),
          );
          if (gap < closest) closest = gap;
        }
      }
    }
    // a car turning in at the foot of the gate's lane as another passes behind it on its
    // way out is the closest any two ever get: near, never touching
    expect(closest).toBeGreaterThan(0.1);
  });

  it("keeps the aisle and the gate clear of parked cars", () => {
    for (let seed = 0; seed < 5; seed++) {
      for (let band = 0; band < 7; band++) {
        for (let row = 0; row < 2; row++) {
          const V = rowV(band, row);
          // every row stands clear of the aisle in its band
          expect(Math.abs(V - (AISLE.mid - band * 22))).toBeGreaterThan(5);
          for (let n = 0; n < BAYS_PER_ROW; n++) {
            if (!staticCar(band, row, n, seed)) continue;
            if (band === 0 && row === 0) {
              // nothing in the lanes of the gate or under the gatehouse
              expect(bayX(n)).toBeGreaterThan(GATE.x1 + 5);
            }
          }
        }
      }
    }
  });

  it("slots the through traffic on Stadium Road between its own cars", () => {
    const cars: LiveCar[] = [];
    let closest = Infinity;
    for (let t = 0; t < PERIOD * 2; t += 0.05) {
      const n = liveCars(cars, t, 7, REACH);
      roadCars(t, 7, REACH, (rc) => {
        expect(rc.V === ROAD_EAST || rc.V === ROAD_WEST).toBe(true);
        const long = 2.2;
        for (let a = 0; a < n; a++) {
          const c = cars[a];
          const gap = Math.max(
            Math.abs(c.X - rc.X) - halfX(c.dir) - long,
            Math.abs(c.V - rc.V) - halfV(c.dir) - 1.0,
          );
          if (gap < closest) closest = gap;
        }
      });
    }
    // a car passing just clear of one waiting to pull out is the tightest
    expect(closest).toBeGreaterThan(0.3);
  });

  it("is the same again a period later, give or take the paint", () => {
    const a: LiveCar[] = [];
    const b: LiveCar[] = [];
    for (const t of [0.7, 3.3, 17.9, 44.7]) {
      const n = liveCars(a, t, 7, REACH);
      const m = liveCars(b, t + PERIOD, 7, REACH);
      expect(m).toBe(n);
      for (let i = 0; i < n; i++) {
        expect(b[i].X).toBeCloseTo(a[i].X, 6);
        expect(b[i].V).toBeCloseTo(a[i].V, 6);
        expect(b[i].dir).toBe(a[i].dir);
        expect(b[i].state).toBe(a[i].state);
      }
    }
  });
});

describe("giving way", () => {
  // Cars used to drive straight through the people on the zebra, either side of the menu
  // ball, and through the people walking from their cars past the gate.
  const REACH = 260;

  it("lets nobody on foot under a car, on Stadium Road, at the gate or in the aisle", () => {
    for (const [w, h] of [
      [480, 270],
      [130, 281],
    ] as const) {
      const view = makeView(w, h);
      const light = lightingFor({ elevation: 45, morning: false });
      const life = makeLife(view, light, 7, paintTown(view, light, 7));
      const cars: LiveCar[] = [];
      const moving: { X: number; V: number; ew: boolean; own: boolean }[] = [];
      let closest = Infinity;
      let waiting = 0;
      let onRoad = 0;
      let seen = 0;
      // twenty minutes: every lap of every walker against every slot's car many times
      for (let t = 0; t < 1200; t += 0.1) {
        moving.length = 0;
        roadCars(t, 7, REACH, (rc) => {
          moving.push({ X: rc.X, V: rc.V, ew: true, own: false });
        });
        const n = liveCars(cars, t, 7, REACH);
        for (let a = 0; a < n; a++) {
          const c = cars[a];
          if (c.state !== 0)
            moving.push({ X: c.X, V: c.V, ew: c.dir < 2, own: true });
        }
        life.people(t, (X, V, wait) => {
          seen++;
          if (wait) waiting++;
          if (V > ROAD_WEST - 1 && V < ROAD_EAST + 1) onRoad++;
          for (const c of moving) {
            // Half a car and half a person, along and across. The people from the cars
            // are planned against the timetable's cars everywhere; everybody else only
            // meets cars on the road and in the mouth of the gate.
            if (c.own && c.V < LOT_TOP - 5 && X < GATE.x1 + 3) continue;
            const gap = Math.max(
              Math.abs(X - c.X) - (c.ew ? 2.2 : 1.0) - 0.5,
              Math.abs(V - c.V) - (c.ew ? 1.0 : 2.2) - 0.5,
            );
            if (gap < closest) closest = gap;
          }
        });
      }
      const where = `${w}x${h}`;
      expect(seen, where).toBeGreaterThan(100_000);
      // people do cross, and people do wait at the kerb
      expect(onRoad, where).toBeGreaterThan(1000);
      expect(waiting, where).toBeGreaterThan(1000);
      // and nobody is ever touched
      expect(closest, where).toBeGreaterThan(0);
    }
  });

  it("is busy where a car is, and the same every tick", () => {
    const cars: LiveCar[] = [];
    for (let t = 0; t < PERIOD; t += 0.07) {
      // on top of every car on the road and of every car in the gate's lanes
      roadCars(t, 7, REACH, (rc) => {
        expect(roadBusy(rc.X, rc.V, t, CLEAR_ALONG, CLEAR_ACROSS)).toBe(true);
        expect(roadBusy(rc.X, rc.V, t + TICK * 7, 0.5, 0.5)).toBe(true);
      });
      const n = liveCars(cars, t, 7, REACH);
      for (let a = 0; a < n; a++) {
        const c = cars[a];
        const inGate =
          c.state === 1 &&
          c.dir >= 2 &&
          (c.X === GATE.inX || c.X === GATE.outX) &&
          c.V > AISLE.north + 0.5;
        if (inGate) {
          expect(
            roadBusy(c.X, c.V, t, CLEAR_ALONG, CLEAR_ACROSS),
            `gate at ${t.toFixed(2)}`,
          ).toBe(true);
        }
      }
    }
    // and the road is not always busy: there is a gap to cross in, in every tick
    for (const X of [-57, -40, 0, 14, 33, 45, 52]) {
      let free = 0;
      for (let t = 0; t < TICK; t += 0.05) {
        const west = roadBusy(X, ROAD_WEST, t, CLEAR_ALONG, CLEAR_ACROSS);
        const east = roadBusy(X, ROAD_EAST, t, CLEAR_ALONG, CLEAR_ACROSS);
        if (!west && !east) free++;
      }
      expect(free, `X ${X}`).toBeGreaterThan(20);
    }
  });

  it("plans a wait at the kerb, and a lap of whole ticks", () => {
    // straight across the road at X = 20, setting off at every moment of a tick
    const at = (d: number) => ({ X: 20, V: -130 + d });
    let waits = 0;
    for (let start = 0; start < TICK; start += 0.25) {
      for (const speed of [2.6, 3.3, 4]) {
        const stops = planWalk(at, 40, speed, start);
        expect(stops.length).toBeLessThanOrEqual(1);
        for (const s of stops) {
          // the kerb is short of the roadway, and nobody waits a whole tick
          expect(at(s.d).V).toBeLessThan(ROAD_WEST - CLEAR_ACROSS);
          expect(s.wait).toBeGreaterThan(0);
          expect(s.wait).toBeLessThan(TICK);
          waits++;
        }
        const lap = lapOf(40, speed, stops);
        expect(lap % TICK).toBe(0);
        expect(lap).toBeGreaterThanOrEqual(40 / speed + waitOf(stops));
        // walked through: stands still while waiting, never goes back, arrives
        const place = { d: 0, waiting: false };
        let last = 0;
        for (let tau = 0; tau <= lap; tau += 0.05) {
          walkAt(stops, speed, tau, place);
          expect(place.d).toBeGreaterThanOrEqual(last - 1e-9);
          if (place.waiting) expect(place.d).toBe(stops[0].d);
          const p = at(Math.min(place.d, 40));
          expect(
            roadBusy(p.X, p.V, start + tau, 2.7, 1.5),
            `start ${start} speed ${speed} tau ${tau.toFixed(2)}`,
          ).toBe(false);
          last = place.d;
        }
        expect(last).toBeGreaterThanOrEqual(40 - 0.3);
      }
    }
    expect(waits).toBeGreaterThan(10);
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
