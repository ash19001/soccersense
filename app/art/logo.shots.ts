/**
 * Shots for the wordmark.
 *
 *   ./node_modules/.bin/tsx tools/snap.ts logo/stacked logo/line --scale 8
 *   ./node_modules/.bin/tsx tools/snap.ts logo/tagline --scale 8
 *   ./node_modules/.bin/tsx tools/snap.ts logo/on-skies --scale 3
 *   ./node_modules/.bin/tsx tools/snap.ts logo/menu --size all --time all --scale 2
 *   ./node_modules/.bin/tsx tools/snap.ts logo/glint --strip 8 --dt 0.4
 */

import { Surface, type ShotMap, type Sun } from "~/pixel";
import { menuLayout } from "./layout";
import { lightingFor } from "./lighting";
import { drawLogo, logoSize, type LogoOptions } from "./logo";
import { P } from "./palette";
import { drawSky } from "./sky";

const TAGLINE = "DAILY FOOTBALL TRIVIA";
const STACKED: LogoOptions = { maxWidth: 104 };
const LINE: LogoOptions = { maxWidth: 200 };

/** The logo alone on mid-sky blue, with a small margin. */
function plain(opts: LogoOptions): Surface {
  const size = logoSize(opts);
  const s = new Surface(size.w + 8, size.h + 8);
  s.clear(P.skyMid);
  drawLogo(s, Math.round(s.w / 2), 4, opts);
  return s;
}

/** The logo where the home screen puts it: centred in the logo zone. */
function onMenu(s: Surface, w: number, h: number, t: number): void {
  const m = menuLayout(w, h);
  const opts: LogoOptions = {
    maxWidth: w > h ? 200 : Math.min(104, w - 16),
    maxHeight: m.logo.h - 2,
    t,
    tagline: TAGLINE,
  };
  const size = logoSize(opts);
  drawLogo(s, m.cx, Math.floor((m.logo.h - size.h) / 2), opts);
}

// Night, dawn, morning, noon, golden hour, dusk.
const SKIES: readonly Sun[] = [
  { elevation: -30, morning: false },
  { elevation: -3, morning: true },
  { elevation: 14, morning: true },
  { elevation: 60, morning: false },
  { elevation: 6, morning: false },
  { elevation: -3, morning: false },
];

export const shots: ShotMap = {
  "logo/stacked": () => plain(STACKED),
  "logo/line": () => plain(LINE),
  "logo/tagline": () => {
    const a = plain({ ...STACKED, tagline: TAGLINE });
    const b = plain({ ...LINE, tagline: TAGLINE });
    const s = new Surface(Math.max(a.w, b.w), a.h + b.h + 2);
    s.clear(P.skyMid);
    s.copy(a, Math.floor((s.w - a.w) / 2), 0);
    s.copy(b, Math.floor((s.w - b.w) / 2), a.h + 2);
    return s;
  },
  "logo/on-skies": (ctx) => {
    const W = 130;
    const H = 281;
    const m = menuLayout(W, H);
    const s = new Surface(SKIES.length * (W + 1) - 1, m.sky.horizonY);
    s.clear(P.ink);
    SKIES.forEach((sun, i) => {
      const cell = new Surface(W, m.sky.horizonY);
      drawSky(cell, {
        light: lightingFor(sun),
        t: ctx.t,
        seed: ctx.seed + i,
        ...m.sky,
      });
      onMenu(cell, W, H, ctx.t);
      s.copy(cell, i * (W + 1), 0);
    });
    return s;
  },
  "logo/menu": (ctx) => {
    const m = menuLayout(ctx.w, ctx.h);
    const s = new Surface(ctx.w, m.sky.horizonY);
    drawSky(s, {
      light: lightingFor(ctx.sun),
      t: ctx.t,
      seed: ctx.seed,
      ...m.sky,
    });
    onMenu(s, ctx.w, ctx.h, ctx.t);
    return s;
  },
  "logo/glint": (ctx) => plain({ ...STACKED, t: ctx.t }),
  "logo/glint-line": (ctx) => {
    const opts = { maxWidth: 400, t: ctx.t };
    const size = logoSize(opts);
    const s = new Surface(size.w + 16, size.h + 16);
    s.clear(P.skyMid);
    drawLogo(s, Math.round(s.w / 2), 8, opts);
    return s;
  },
};
