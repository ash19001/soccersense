import { describe, expect, it } from "vitest";
import { lightingFor } from "~/art/lighting";
import { P } from "~/art/palette";
import { Surface, TRANSPARENT } from "~/pixel";
import { endFor, endFrontAt, paintEnd } from "./end";
import { goalFor } from "./goal";
import { CareerGround } from "./ground";
import { Life } from "./life";
import { across, geoFor, paintFor } from "./paint";
import type { Tier } from "./types";

const DAY = lightingFor({ elevation: 35, morning: false });
const NIGHT = lightingFor({ elevation: -25, morning: false });
const SIZES = [
  [960, 540],
  [854, 480],
  [683, 384],
  [260, 563],
  [234, 507],
] as const;

describe("the end behind the goal", () => {
  it("starts at the corner level with the goal line, behind the net and the photographers", () => {
    for (const [w, h] of SIZES) {
      const g = geoFor(w, h);
      const e = endFor(g);
      expect(e.corner).toBe(across(g, g.goalX, g.F) + 2);
      // the net's back and both photographers stand clear of the end's front
      const goal = goalFor(4, g);
      // the net's foot runs back `depth` from the near post (lineX + 2)
      expect(endFrontAt(g, g.gy + 4)).toBeGreaterThan(
        goal.lineX + 2 + goal.depth,
      );
      // each photographer's feet (right edge `x + 7`) on the grass before the boards
      expect(endFrontAt(g, g.gy + 18)).toBeGreaterThan(
        g.goalX + Math.round(17 * g.k) + 7,
      );
      expect(endFrontAt(g, g.N - 8)).toBeGreaterThan(
        g.goalX + Math.round(22 * g.k) + 7,
      );
    }
  });

  it("stops the side stand at the corner: nothing of it past the goal line", () => {
    for (const [w, h] of SIZES) {
      const ground = new CareerGround({ seed: 2, mode: "home", tier: 4 });
      ground.resize(w, h);
      ground.setLighting(DAY);
      const s = new Surface(w, h);
      ground.drawBack(s, 0);
      const g = geoFor(w, h);
      const e = endFor(g);
      // in the corner, just over the far boards, the town shows, not the stand's seats
      const x = e.corner + 1;
      if (x < e.xA - 1) {
        const y = g.F - 20;
        const seats = [P_DARK, P_NIGHT];
        expect(seats).not.toContain(s.get(x, y));
      }
    }
  });

  it("seats its fans side by side without overlapping, at every stand tier and size", () => {
    for (const tier of [3, 4, 7] as const) {
      for (const [w, h] of SIZES) {
        const g = geoFor(w, h);
        const p = paintFor(g, NIGHT, tier as Tier, "home", 1, {});
        const s = new Surface(w, h);
        const life = new Life(4000);
        paintEnd(s, p, life);
        const f = life.fans;
        for (let a = 0; a < f.n; a++) {
          for (let b = a + 1; b < f.n; b++) {
            const apart =
              Math.abs(f.x[a] - f.x[b]) >= 6 || Math.abs(f.y[a] - f.y[b]) >= 8;
            if (!apart) throw new Error(`fans ${a} and ${b} overlap`);
          }
        }
        if (w >= 600) expect(f.n).toBeGreaterThan(100);
      }
    }
  });

  it("covers the canvas and gives the same pixels for the same inputs", () => {
    for (const tier of [3, 5] as const) {
      const draw = (): Surface => {
        const ground = new CareerGround({ seed: 4, mode: "away", tier });
        ground.resize(960, 540);
        ground.setLighting(NIGHT);
        const s = new Surface(960, 540);
        ground.drawBack(s, 1.5);
        ground.drawFront(s, 1.5);
        return s;
      };
      const a = draw();
      const b = draw();
      expect(a.data.includes(TRANSPARENT)).toBe(false);
      expect(
        Buffer.from(a.data.buffer).equals(Buffer.from(b.data.buffer)),
      ).toBe(true);
    }
  });
});

/** The stand's seat colours by day (graded as the stand paints them). */
const P_DARK = paintFor(geoFor(960, 540), DAY, 4, "home", 1, {}).S(
  P.concreteDark,
);
const P_NIGHT = paintFor(geoFor(960, 540), DAY, 4, "home", 1, {}).S(P.night);
