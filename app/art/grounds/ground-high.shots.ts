/**
 * Sheets of the goals, the big stand, the near side of the stadium, the podium, and the
 * life over a stadium (flags, beams, fireworks, ticker tape). Each draws a 960 x 540 ground
 * (whatever `--w`/`--h` say) and crops the part to look at; use `--scale 3` or `4` to
 * zoom.
 *
 *   ./node_modules/.bin/tsx tools/snap.ts ground-high/goal --scale 3
 *   ./node_modules/.bin/tsx tools/snap.ts ground-high/stand --time night --scale 2
 */

import { careerLayout } from "~/art/layout";
import { lightingFor } from "~/art/lighting";
import { P } from "~/art/palette";
import { Surface, type ShotContext, type ShotMap } from "~/pixel";
import { CareerGround } from "./ground";
import type { NetBulge, Tier } from "./types";

const W = 960;
const H = 540;

/** A 6 x 6 stand-in ball with its ink edge. */
function ball(s: Surface, x: number, y: number): void {
  s.rect(x + 1, y, 4, 6, P.ink);
  s.rect(x, y + 1, 6, 4, P.ink);
  s.rect(x + 1, y + 1, 4, 4, P.white);
  s.rect(x + 3, y + 3, 2, 2, P.mist);
}

function ground(
  ctx: ShotContext,
  tier: Tier,
  mode: "home" | "away" = "home",
): CareerGround {
  const g = new CareerGround({
    seed: ctx.seed,
    mode,
    tier,
    labels: {
      boards: ["Play daily", "Seven questions", "Home", "Away"],
      banners: ["Hometown hero", "Come on"],
    },
  });
  g.resize(W, H);
  g.setLighting(lightingFor(ctx.sun));
  return g;
}

function crop(s: Surface, x: number, y: number, w: number, h: number): Surface {
  const c = new Surface(w, h);
  c.copy(s, -x, -y);
  return c;
}

function grid(tiles: Surface[], cols: number, gap = 2): Surface {
  const tw = tiles[0].w;
  const th = tiles[0].h;
  const rows = Math.ceil(tiles.length / cols);
  const out = new Surface(
    cols * tw + (cols - 1) * gap,
    rows * th + (rows - 1) * gap,
  );
  out.clear(P.ink);
  tiles.forEach((t, i) =>
    out.copy(t, (i % cols) * (tw + gap), Math.floor(i / cols) * (th + gap)),
  );
  return out;
}

/** The whole ground at a tier (with the goal's front and ticker). */
function whole(
  ctx: ShotContext,
  tier: Tier,
  mode: "home" | "away" = "home",
): Surface {
  const s = new Surface(W, H);
  const gr = ground(ctx, tier, mode);
  gr.drawBack(s, ctx.t);
  gr.drawFront(s, ctx.t);
  return s;
}

export const shots: ShotMap = {
  "ground-high/goal": (ctx) => {
    const tiles: Surface[] = [];
    for (const tier of [0, 1, 2] as const) {
      for (const amount of [0, 0.5, 1]) {
        const s = new Surface(W, H);
        const gr = ground(ctx, tier);
        gr.drawBack(s, ctx.t);
        const gl = gr.goal;
        // the ball in the back of the net, under the bar
        const by = gl.barY + 12;
        const bx = gl.lineX + Math.max(4, gl.depth - 6);
        if (tier > 0) ball(s, bx, by);
        const bulge: NetBulge | null =
          amount > 0 ? { y: by + 3, amount } : null;
        gr.drawFront(s, ctx.t, bulge);
        tiles.push(crop(s, gl.lineX - 30, gl.barY - 14, 72, 72));
      }
    }
    return grid(tiles, 3);
  },
  "ground-high/stand": (ctx) => {
    const s = whole(ctx, 4);
    const c = careerLayout(W, H);
    return crop(s, 120, c.farTouchY - 160, 420, 170);
  },
  "ground-high/near": (ctx) => {
    const tiles: Surface[] = [];
    for (const tier of [4, 6] as const) {
      const s = whole(ctx, tier);
      const c = careerLayout(W, H);
      tiles.push(crop(s, 180, c.nearTouchY - 30, 520, H - c.nearTouchY + 30));
    }
    return grid(tiles, 1);
  },
  "ground-high/podium": (ctx) => {
    const s = whole(ctx, 7);
    const c = careerLayout(W, H);
    return crop(s, c.heroX - 60, c.groundY - 50, 260, 110);
  },
  "ground-high/dressed": (ctx) => {
    const tiles: Surface[] = [];
    for (const tier of [5, 6, 7] as const) {
      const s = whole(ctx, tier);
      const c = careerLayout(W, H);
      tiles.push(crop(s, 0, c.farTouchY - 220, 480, 230));
    }
    return grid(tiles, 1);
  },
  "ground-high/tier": (ctx) => whole(ctx, 4),
};
