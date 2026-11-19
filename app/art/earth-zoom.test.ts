import { describe, expect, it } from "vitest";

import { Surface } from "~/pixel";

import { type EarthView, drawEarthZoom, drynessAt } from "./earth-zoom";
import { lightingFor } from "./lighting";
import { P } from "./palette";
import { EARTH_KM, type GeoPoint } from "./world-map";

const DAY = lightingFor({ elevation: 45, morning: false });
const NIGHT = lightingFor({ elevation: -30, morning: false });
const EMPTY = P.white;
const LONDON: GeoPoint = { lat: 51.5, lng: -0.12 };

/** The ground round `place` from `kpp` km a pixel, the Earth in the middle of the picture. */
function view(
  kpp: number,
  place: GeoPoint = LONDON,
  light = DAY,
  w = 240,
  h = 135,
): Surface {
  const s = new Surface(w, h);
  s.clear(EMPTY);
  const v: EarthView = { place, seed: 7, light };
  drawEarthZoom(s, w / 2, h / 2, EARTH_KM / kpp, place, v);
  return s;
}

function share(s: Surface, colors: readonly number[]): number {
  let n = 0;
  for (const c of s.data) if (colors.includes(c)) n++;
  return n / s.data.length;
}

const e = DAY.env;
const TOWN = [
  P.concreteDark,
  P.concrete,
  P.concreteLight,
  P.steelHi,
  P.brick,
  P.brickLight,
  P.brickDark,
].map((c) => e(c));
const GREENS = [P.grassDeep, P.grassDark, P.grass, P.grassLight, P.grassHi].map(
  (c) => e(c),
);
const LIGHTS = [P.amber, P.amberDim];

describe("drawEarthZoom", () => {
  it("fills the whole picture, close up or far off", () => {
    for (const kpp of [0.004, 0.03, 0.2, 2, 20]) {
      expect(share(view(kpp), [EMPTY]), `${kpp} km a pixel`).toBe(0);
    }
  });

  it("is the streets round the place close up, its town among fields further off, and the country further still", () => {
    // the product owner, 2026-11-18: "it should feel like a place within that globe so
    // maybe there should be stages and cities/fields around as it zooms out"
    const street = view(0.004);
    expect(share(street, TOWN)).toBeGreaterThan(0.6);
    expect(share(street, [e(P.concreteDark)])).toBeGreaterThan(0.1);
    // a town some 30 km across: its region from 60 km
    const region = view(0.25);
    expect(share(region, TOWN)).toBeGreaterThan(0.03);
    expect(share(region, GREENS)).toBeGreaterThan(0.3);
    const country = view(2);
    expect(share(country, TOWN)).toBeLessThan(0.05);
  });

  it("is a globe among stars from far off, with its rim and the sea", () => {
    const s = view(120);
    expect(share(s, [P.ink])).toBeGreaterThan(0.3);
    expect(share(s, [e(P.furthestDark)])).toBeGreaterThan(0.05);
    expect(share(s, [e(P.skyLow)])).toBeGreaterThan(0);
    // the corners are space
    expect(s.get(0, 0)).not.toBe(e(P.furthestDark));
  });

  it("puts the sea where the sea is", () => {
    // round Rio: the land inland to the north west, the Atlantic to the south east
    const rio = { lat: -22.9, lng: -43.2 };
    const s = new Surface(240, 135);
    drawEarthZoom(s, 120, 67, EARTH_KM / 3, rio, {
      place: rio,
      seed: 7,
      light: DAY,
    });
    const sea = e(P.furthestDark);
    const seaIn = (x0: number, y0: number, x1: number, y1: number): number => {
      let n = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) if (s.get(x, y) === sea) n++;
      }
      return n / ((x1 - x0) * (y1 - y0));
    };
    expect(seaIn(160, 90, 240, 135)).toBeGreaterThan(0.9);
    expect(seaIn(0, 0, 60, 40)).toBeLessThan(0.1);
  });

  it("is lit at night: its streets and windows, and towns further off; not by day", () => {
    expect(share(view(0.004, LONDON, NIGHT), LIGHTS)).toBeGreaterThan(0.03);
    expect(share(view(0.03, LONDON, NIGHT), LIGHTS)).toBeGreaterThan(0.02);
    for (const kpp of [0.004, 0.03, 0.5]) {
      expect(share(view(kpp), LIGHTS), `${kpp}`).toBe(0);
    }
  });

  it("is dry round a desert's place, and the fields round it too", () => {
    const doha = { lat: 25.3, lng: 51.5 };
    const dry = [P.retro, P.retroLight, P.wood].map((c) => e(c));
    expect(share(view(0.25, doha), dry)).toBeGreaterThan(0.2);
    expect(share(view(3, doha), dry)).toBeGreaterThan(0.3);
    // and green round Rio, not sand
    expect(share(view(3, { lat: -22.9, lng: -43.2 }), dry)).toBeLessThan(0.05);
  });

  it("draws the same picture for the same view (seeded)", () => {
    for (const kpp of [0.004, 0.1, 5]) {
      expect(Array.from(view(kpp).data)).toEqual(Array.from(view(kpp).data));
    }
  });
});

describe("drawEarthZoom's hooks (FURTHEST's town from above)", () => {
  it("draws what `near` knows where it knows it, and its own ground elsewhere", () => {
    const s = new Surface(240, 135);
    drawEarthZoom(s, 120, 67, EARTH_KM / 0.004, LONDON, {
      place: LONDON,
      seed: 7,
      light: DAY,
      near: (east, north) =>
        Math.abs(east) < 0.1 && Math.abs(north) < 0.1 ? P.home : undefined,
    });
    expect(s.get(120, 67)).toBe(P.home);
    expect(s.get(5, 5)).not.toBe(P.home);
  });

  it("draws the towns in `town`'s look, but keeps their parks", () => {
    const s = new Surface(240, 135);
    drawEarthZoom(s, 120, 67, EARTH_KM / 0.03, LONDON, {
      place: LONDON,
      seed: 7,
      light: DAY,
      town: () => P.gold,
    });
    expect(share(s, [P.gold])).toBeGreaterThan(0.4);
    expect(share(s, [e(P.grass)])).toBeGreaterThan(0.01);
  });

  it("draws a mosaic of `block` pixels, its squares lined up on the Earth's middle", () => {
    const s = new Surface(240, 135);
    drawEarthZoom(s, 121, 67, EARTH_KM / 0.03, LONDON, {
      place: LONDON,
      seed: 7,
      light: DAY,
      block: 5,
    });
    // the square whose corner is the middle: one colour
    for (let y = 67; y < 72; y++) {
      for (let x = 121; x < 126; x++) expect(s.get(x, y)).toBe(s.get(121, 67));
    }
    // and the picture is squares of five throughout
    let ragged = 0;
    for (let y = 2; y < 130; y += 5) {
      for (let x = 1; x < 235; x += 5) {
        for (let k = 1; k < 5; k++) {
          if (s.get(x + k, y) !== s.get(x, y)) ragged++;
        }
      }
    }
    expect(ragged).toBe(0);
  });
});

describe("drynessAt", () => {
  it("is sand in the deserts, dry at their edges, and not dry elsewhere", () => {
    expect(drynessAt(23, 10, 7)).toBeGreaterThan(0.5); // the Sahara
    expect(drynessAt(-25, 132, 7)).toBeGreaterThan(0.5); // the middle of Australia
    expect(drynessAt(-23.5, -69.5, 7)).toBeGreaterThan(0.15); // the Atacama
    expect(drynessAt(51.5, -0.12, 7)).toBeLessThan(0.15); // London
    expect(drynessAt(-22.9, -43.2, 7)).toBeLessThan(0.15); // Rio
    expect(drynessAt(-3, -60, 7)).toBeLessThan(0.15); // the Amazon
  });
});
