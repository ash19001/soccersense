/**
 * Shots for the club mascot, the black cat on the lawn (stadium-mascot.ts).
 *
 *   mascot/sheet   on the real home picture (960 x 540 unless --w and --h say otherwise):
 *                  a row of his idle loop, then a row for each trick in turn, by day and
 *                  then at night (--time is ignored; --t is ignored)
 *   mascot/poses   every pose on its own, on the lawn by day and at night, with his tail
 *                  in each sway
 *
 *   ./node_modules/.bin/tsx tools/snap.ts mascot/sheet --scale 4
 */

import { FONT_3x5, Surface, drawText, type ShotMap } from "~/pixel";
import { lightingFor } from "~/art/lighting";
import { P } from "~/art/palette";
import { MenuBackdrop } from "~/art/stadium";
import { clubLight, schemeForDay } from "~/art/stadium-club";
import { POSES, TRICKS, drawMascot } from "~/art/stadium-mascot";

const CW = 40;
const CH = 40;
const COLS = 12;
const SUNS = [
  { elevation: 45, morning: false },
  { elevation: -30, morning: false },
] as const;

export const shots: ShotMap = {
  "mascot/sheet": (ctx) => {
    const w = ctx.w === 260 && ctx.h === 562 ? 960 : ctx.w;
    const h = ctx.w === 260 && ctx.h === 562 ? 540 : ctx.h;
    const rows = TRICKS.length + 1;
    const out = new Surface(COLS * (CW + 1), SUNS.length * rows * (CH + 1));
    out.clear(P.ink);
    const one = new Surface(w, h);
    SUNS.forEach((sun, n) => {
      for (let row = 0; row < rows; row++) {
        const b = new MenuBackdrop({
          seed: ctx.seed,
          sign: { header: "", text: "" },
        });
        b.resize(w, h);
        b.setLighting(lightingFor(sun));
        b.setScheme(schemeForDay(ctx.seed).id);
        const spot = b.mascotSpot();
        if (!spot) return;
        // the tricks before this one, each played out in turn
        for (let k = 0; k < row - 1; k++) b.pokeMascot(k * 10);
        const start = (row - 1) * 10;
        if (row > 0) b.pokeMascot(start);
        const dur = row === 0 ? 9 : TRICKS[row - 1].dur;
        const y0 = (n * rows + row) * (CH + 1);
        for (let i = 0; i < COLS; i++) {
          const t = row === 0 ? 0.3 + i * 0.75 : start + (i / (COLS - 1)) * dur;
          b.draw(one, t);
          out.blit(one, i * (CW + 1), y0, {
            sx: spot.x - CW / 2,
            sy: spot.y - CH + 6,
            sw: CW,
            sh: CH,
          });
        }
        const label = row === 0 ? "IDLE" : TRICKS[row - 1].name;
        drawText(out, label, 1, y0 + 1, P.chalk, { font: FONT_3x5 });
      }
    });
    return out;
  },

  "mascot/poses": (ctx) => {
    const names = Object.keys(POSES) as (keyof typeof POSES)[];
    const cw = 30;
    const ch = 32;
    const out = new Surface(names.length * cw, SUNS.length * 3 * ch);
    SUNS.forEach((sun, n) => {
      const light = clubLight(lightingFor(sun), schemeForDay(ctx.seed));
      const grass = light.env(P.grass);
      for (let sway = 0; sway < 3; sway++) {
        const y0 = (n * 3 + sway) * ch;
        out.rect(0, y0, out.w, ch, grass);
        names.forEach((name, i) => {
          drawMascot(
            out,
            i * cw + cw / 2,
            y0 + ch - 5,
            { pose: POSES[name], ball: { x: 4, h: 0 }, tail: sway },
            light,
          );
        });
      }
    });
    return out;
  },
};
