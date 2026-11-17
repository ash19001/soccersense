/**
 * Shots for the inside view of the stadium (reference art, see stadium-inside.ts).
 *
 *   inside/full       the whole view, with a stand-in for the menu ball
 *   inside/long-line  the same with a line too long for the board (it scrolls)
 *   inside/board      a close crop of the scoreboard
 *   inside/composed   the view with the stand-in ball and the wordmark over it
 */

import { Surface, type ShotContext, type ShotMap } from "~/pixel";
import { insideLayout as menuLayout } from "~/art/stadium-inside-layout";
import { lightingFor } from "~/art/lighting";
import { drawLogo, logoSize } from "~/art/logo";
import { P } from "~/art/palette";
import { InsideBackdrop, type InsideBoardWords } from "~/art/stadium-inside";

const WORDS: InsideBoardWords = {
  title: "Kick-off",
  line: "7 questions",
};

const LONG: InsideBoardWords = {
  title: "A line too long for the board",
  line: "It scrolls",
};

function backdrop(ctx: ShotContext, words: InsideBoardWords): Surface {
  const s = new Surface(ctx.w, ctx.h);
  const scene = new InsideBackdrop({ seed: ctx.seed, words });
  scene.resize(s.w, s.h);
  scene.setLighting(lightingFor(ctx.sun));
  scene.draw(s, ctx.t);
  // the menu ball's stand-in
  const m = menuLayout(s.w, s.h);
  s.disc(m.cx, m.ballCy, m.ballR, P.ink);
  s.disc(m.cx, m.ballCy, m.ballR - 1, P.chalk);
  return s;
}

export const shots: ShotMap = {
  "inside/full": (ctx) => backdrop(ctx, WORDS),

  "inside/long-line": (ctx) => backdrop(ctx, LONG),

  "inside/board": (ctx) => {
    const full = backdrop(ctx, WORDS);
    const b = menuLayout(full.w, full.h).scoreboard;
    const pad = 10;
    const out = new Surface(b.w + pad * 2, b.h + pad * 2);
    out.blit(full, pad - b.x, pad - b.y);
    return out;
  },

  "inside/composed": (ctx) => {
    const s = backdrop(ctx, WORDS);
    const m = menuLayout(s.w, s.h);
    const opts = {
      maxWidth: Math.min(s.w - 26, 132),
      maxHeight: m.logo.h,
      t: ctx.t,
    };
    const size = logoSize(opts);
    drawLogo(s, m.cx, Math.floor((m.logo.h - size.h) / 2), opts);
    return s;
  },
};
