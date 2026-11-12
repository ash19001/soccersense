import { describe, expect, it } from "vitest";
import { Surface, rgb, type Color } from "~/pixel";
import { lightingFor } from "~/art/lighting";
import { makeLife } from "~/art/stadium-life";
import { shadowBlob } from "~/art/stadium-things";
import { paintTown } from "~/art/stadium-town";
import { makeView, project, sizeClass } from "~/art/stadium-view";

/** A colour nothing in the town is painted: the whole land, so a shadow on it stands out. */
const FIELD = rgb(0x3a5f2b);
/** The field in a car's shadow. */
const SHADED = ((): Color => {
  const one = new Surface(1, 1);
  one.clear(FIELD);
  shadowBlob(one, 0, 0, 1, 1);
  return one.data[0] as Color;
})();

describe("the shadows of moving things", () => {
  // Late in the afternoon there are no cloud shadows to tell apart from a car's; at night
  // the traffic has its lamps on.
  const LIGHTS = [
    ["afternoon", lightingFor({ elevation: 4, morning: false })],
    ["night", lightingFor({ elevation: -30, morning: false })],
  ] as const;

  it("never darken a tree, a roof or anything else that stands nearer, and still fall on open ground", () => {
    for (const [w, h, seed] of [
      [480, 270, 1],
      [640, 360, 1],
      [640, 360, 7],
      [130, 281, 2],
    ] as const) {
      const view = makeView(w, h);
      for (const [when, light] of LIGHTS) {
        const where = `${w}x${h} seed ${seed} ${when}`;
        const town = paintTown(view, light, seed);
        const life = makeLife(view, light, seed, town);
        const s = new Surface(w, h);
        const cars: { x: number; y: number; V: number; cls: number }[] = [];
        let shaded = 0;
        let open = 0;
        let openShown = 0;
        // ten minutes, every half second (the routes repeat in a few minutes)
        for (let t = 0; t < 600; t += 0.5) {
          s.clear(FIELD);
          life.draw(s, t, 0);
          cars.length = 0;
          life.cars(t, (X, V) => {
            const p = project(view, X, V);
            cars.push({ x: p.x, y: p.y, V, cls: sizeClass(p.s) });
          });
          for (const c of cars) {
            // a shadow lies within (-4..6, 0..5) of its car's ground point
            const x0 = Math.max(0, c.x - 4);
            const x1 = Math.min(w - 1, c.x + 6);
            const y0 = Math.max(0, c.y);
            const y1 = Math.min(h - 1, c.y + 5);
            let bare = true;
            let n = 0;
            for (let y = y0; y <= y1; y++) {
              for (let x = x0; x <= x1; x++) {
                const i = y * w + x;
                if (town.depth[i] < 1e8) bare = false;
                if (s.data[i] !== SHADED) continue;
                n++;
                // whatever car casts it stands no further away than what is there
                const ok = cars.some(
                  (o) =>
                    o.V <= town.depth[i] &&
                    x >= o.x - 4 &&
                    x <= o.x + 6 &&
                    y >= o.y &&
                    y <= o.y + 5,
                );
                if (!ok) {
                  expect.fail(
                    `${where} t ${t}: a shadow on (${x}, ${y}) over something at ${town.depth[i].toFixed(1)}, nearer than the car at ${c.V.toFixed(1)}`,
                  );
                }
              }
            }
            shaded += n;
            if (bare && c.cls === 2 && c.x > 6 && c.x < w - 8 && c.y < h - 6) {
              open++;
              if (n >= 3) openShown++;
            }
          }
        }
        // the near cars on open ground keep their shadows (a coach has none, and a car
        // just behind another covers some)
        if (w >= 480) {
          expect(shaded, where).toBeGreaterThan(1000);
          expect(open, where).toBeGreaterThan(200);
          expect(openShown / open, where).toBeGreaterThan(0.8);
        }
      }
    }
  }, 240_000);
});
