import { describe, expect, it } from "vitest";

import { CITIES } from "~/data/cities";
import { PLACES } from "~/data/places";
import { distanceKm } from "~/game/geo";

import { bearing, journeyFor } from "./map-journey";

describe("journeyFor (FURTHEST's career)", () => {
  // the product owner, 2026-11-18, from image demos of the stages: "sure do it"
  it("gives every day's place a stop a tier, each further from home, the final the furthest city", () => {
    for (const p of PLACES) {
      const stops = journeyFor({ lat: p.lat, lng: p.lng, name: p.name });
      expect(stops, p.name).toHaveLength(8);
      expect(stops[0]).toMatchObject({ name: p.name, km: 0, by: null });
      for (let t = 1; t <= 6; t++) {
        expect(stops[t].km, `${p.name} tier ${t}`).toBeGreaterThan(
          stops[t - 1].km,
        );
        expect(CITIES.some((c) => c.name === stops[t].name)).toBe(true);
      }
      // the final and the trophy: one place, as far from home as any city
      expect(stops[7]).toEqual(stops[6]);
      for (const c of CITIES) {
        expect(distanceKm(p, c)).toBeLessThanOrEqual(stops[6].km + 1e-6);
      }
    }
  });

  it("goes up the road first, then across a border, a continent and the world", () => {
    for (const p of PLACES) {
      const stops = journeyFor({ lat: p.lat, lng: p.lng, name: p.name });
      expect(stops[1].km, p.name).toBeLessThan(250);
      expect(stops[1].by).toBe("coach");
      expect(stops[2].km, p.name).toBeLessThan(1500);
      expect(stops[5].km, p.name).toBeGreaterThan(7000);
      expect(stops[6].km, p.name).toBeGreaterThan(14000);
      // a long way is flown
      for (let t = 2; t <= 6; t++) {
        const leg = distanceKm(stops[t - 1], stops[t]);
        if (leg > 2500) expect(stops[t].by, `${p.name} ${t}`).toBe("plane");
      }
    }
  });

  it("names every city once (a stop is known by its name)", () => {
    const names = CITIES.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("is the same journey every time for a place", () => {
    const p = { lat: 51.556, lng: -0.2796, name: "Wembley" };
    expect(journeyFor(p)).toEqual(journeyFor(p));
  });
});

describe("bearing", () => {
  it("is the way to go, in degrees from north", () => {
    const london = { lat: 51.5, lng: -0.12 };
    expect(bearing(london, { lat: 60, lng: -0.12 })).toBeCloseTo(0, 5);
    expect(bearing(london, { lat: 40, lng: -0.12 })).toBeCloseTo(180, 5);
    const east = bearing(london, { lat: 51.5, lng: 10 });
    expect(east).toBeGreaterThan(80);
    expect(east).toBeLessThan(90);
  });
});
