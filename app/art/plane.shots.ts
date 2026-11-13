/**
 * Sheets for the plane that tows the fact of the day across the home screen's sky
 * (stadium-plane.ts).
 *
 *   plane/close      the plane zoomed 4x by day and at night, both propeller frames, and the
 *                    head of its banner (rope, bridle, pole, the first words) zoomed 2x
 *   plane/home       the home picture during a pass (monitor 960 x 540), by day and at night
 *   plane/phone      the same on a phone (260 x 562)
 *
 *   ./node_modules/.bin/tsx tools/snap.ts plane/close --scale 2
 */

import { Surface, type ShotContext, type ShotMap } from "~/pixel";
import { lightingFor, type Lighting } from "~/art/lighting";
import { P } from "~/art/palette";
import { MenuBackdrop } from "~/art/stadium";
import { schemeForDay } from "~/art/stadium-club";
import {
  PLANE_FIRST,
  PLANE_SIZE,
  bannerWords,
  drawFlyby,
  drawPlane,
  paintBanner,
} from "~/art/stadium-plane";
import { factForDay } from "~/data/facts";

const DAY = lightingFor({ elevation: 40, morning: false });
const NIGHT = lightingFor({ elevation: -25, morning: false });

function zoom(out: Surface, src: Surface, ox: number, oy: number, k: number) {
  for (let j = 0; j < src.h; j++) {
    for (let i = 0; i < src.w; i++) {
      const c = src.get(i, j);
      if (c !== 0) out.rect(ox + i * k, oy + j * k, k, k, c as never);
    }
  }
}

function sky(light: Lighting): number {
  return light.lightsOn ? P.nightMid : P.skyMid;
}

function close(): Surface {
  const out = new Surface(520, 480);
  const fact = factForDay(1).text;
  [DAY, NIGHT].forEach((light, row) => {
    const y0 = row * 240;
    out.rect(0, y0, out.w, 240, sky(light) as never);
    for (const [i, t] of [0, 0.08333333333333333].entries()) {
      const s = new Surface(PLANE_SIZE.w + 6, PLANE_SIZE.h + 4);
      drawPlane(s, 3, 2, light, t);
      zoom(out, s, 4 + i * 172, y0 + 6, 4);
    }
    // the head of the train, as it flies
    const s = new Surface(255, 40);
    const banner = paintBanner(bannerWords("DID YOU KNOW?", fact), light);
    drawFlyby(s, banner, 20, light, PLANE_FIRST + 4.116666666666666);
    zoom(out, s, 4, y0 + 76, 2);
    const s2 = new Surface(255, 40);
    drawFlyby(s2, banner, 20, light, PLANE_FIRST + 8.333333333333334);
    zoom(out, s2, 4, y0 + 156, 2);
  });
  return out;
}

function home(ctx: ShotContext, w: number, h: number, at: number): Surface {
  const out = new Surface(w, h * 2 + 4);
  [DAY, NIGHT].forEach((light, row) => {
    const b = new MenuBackdrop({
      seed: ctx.seed,
      sign: { header: "DID YOU KNOW?", text: factForDay(ctx.seed).text },
    });
    b.resize(w, h);
    b.setLighting(light);
    b.setScheme(schemeForDay(ctx.seed).id);
    b.setBanner(bannerWords("DID YOU KNOW?", factForDay(ctx.seed).text));
    const s = new Surface(w, h);
    b.draw(s, PLANE_FIRST + at);
    out.blit(s, 0, row * (h + 4));
  });
  return out;
}

export const shots: ShotMap = {
  "plane/close": () => close(),
  "plane/home": (ctx) => home(ctx, 960, 540, 9),
  "plane/phone": (ctx) => home(ctx, 260, 562, 4),
};
