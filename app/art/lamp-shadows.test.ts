import { describe, expect, it } from "vitest";
import { Surface } from "~/pixel";
import { lightingFor } from "~/art/lighting";
import { personLampShadow, vehicleLampShadow } from "~/art/lamp-shadows";
import { EAST } from "~/art/stadium-cars";
import { paintTown, type LampPool, type Town } from "~/art/stadium-town";
import { makeView } from "~/art/stadium-view";

// The street lamps' shadows (lamp-shadows.ts): only in a lit pool, away from
// the lamp, as long as the caster stands far out, and never over anything but bare ground.

const W = 960;
const H = 540;
const NIGHT = lightingFor({ elevation: -30, morning: false });
const DAY = lightingFor({ elevation: 45, morning: false });

function frame(town: Town): Surface {
  const s = new Surface(W, H);
  s.copy(town.land, 0, town.top);
  return s;
}

/** The pixels `cast` changed on a fresh frame, as [x, y]. */
function changed(town: Town, cast: (s: Surface) => void): [number, number][] {
  const s = frame(town);
  const before = s.data.slice();
  cast(s);
  const out: [number, number][] = [];
  for (let i = 0; i < before.length; i++) {
    if (s.data[i] !== before[i]) out.push([i % W, Math.floor(i / W)]);
  }
  return out;
}

/** A big pool on bare ground: by the plaza's west edge, south of Stadium Road. */
function poolOf(town: Town): LampPool {
  const pools = town.pools.filter(
    (p) => Math.abs(p.x - 321) < 30 && Math.abs(p.y - 444) < 20,
  );
  expect(pools.length).toBeGreaterThan(0);
  return pools[0];
}

describe("the street lamps' shadows", { timeout: 60_000 }, () => {
  it("are noted only with the lamps lit", () => {
    expect(paintTown(makeView(W, H), DAY, 1).pools).toEqual([]);
    expect(paintTown(makeView(W, H), NIGHT, 1).pools.length).toBeGreaterThan(
      40,
    );
  });

  it("fall away from the lamp, longer the further out, and only in its pool", () => {
    const town = paintTown(makeView(W, H), NIGHT, 1);
    const pl = poolOf(town);
    // right under the lamp: none; outside the pool: none
    expect(
      changed(town, (s) =>
        personLampShadow(s, town, Math.round(pl.x), Math.round(pl.y), 4),
      ),
    ).toEqual([]);
    expect(
      changed(town, (s) =>
        personLampShadow(
          s,
          town,
          Math.round(pl.x - pl.rx - 4),
          Math.round(pl.y),
          4,
        ),
      ),
    ).toEqual([]);
    // left of the lamp: to the left of the feet; right of it: to the right
    const reach = (k: number): [number, number][] => {
      const x = Math.round(pl.x + k * pl.rx);
      const y = Math.round(pl.y);
      return changed(town, (s) => personLampShadow(s, town, x, y, 4));
    };
    const left = reach(-0.5);
    const right = reach(0.5);
    expect(left.length).toBeGreaterThan(2);
    expect(right.length).toBeGreaterThan(2);
    expect(left.every(([x]) => x < pl.x - 0.5 * pl.rx)).toBe(true);
    expect(right.every(([x]) => x > pl.x + 0.5 * pl.rx - 1)).toBe(true);
    // a little further out, a longer shadow
    expect(reach(-0.3).length).toBeLessThan(left.length);
    // every shadow pixel inside the pool, and darker than the lit ground it falls on
    const s = frame(town);
    personLampShadow(
      s,
      town,
      Math.round(pl.x - 0.5 * pl.rx),
      Math.round(pl.y),
      4,
    );
    for (const [x, y] of left) {
      expect(
        ((x - pl.x) / pl.rx) ** 2 + ((y - pl.y) / pl.ry) ** 2,
      ).toBeLessThan(1);
      const lum = (c: number): number =>
        (c & 0xff) + ((c >>> 8) & 0xff) + ((c >>> 16) & 0xff);
      const lit = town.land.data[(y - town.top) * W + x];
      expect(lum(s.data[y * W + x])).toBeLessThan(lum(lit));
    }
  });

  it("never darken what is already drawn there, and cars throw them too", () => {
    const town = paintTown(makeView(W, H), NIGHT, 1);
    const pl = poolOf(town);
    const x = Math.round(pl.x - 0.5 * pl.rx);
    const y = Math.round(pl.y);
    const s = frame(town);
    // a sprite already standing where the shadow would fall
    for (let i = x - 12; i < x; i++) s.px(i, y, 0xff00ff00 as never);
    const before = s.data.slice();
    personLampShadow(s, town, x, y, 4);
    for (let i = x - 12; i < x; i++)
      expect(s.data[y * W + i]).toBe(before[y * W + i]);
    expect(
      changed(town, (f) => vehicleLampShadow(f, town, x, y, false, 4, EAST))
        .length,
    ).toBeGreaterThan(4);
  });
});
