/**
 * The airship's fall (package H): the pilot tumbling, under his canopy, and landed, with
 * the wreck (seed 1).
 *
 *   airship/pilot   a crop of the picture's lower left, where he comes down for seed 1
 *
 *   ./node_modules/.bin/tsx tools/snap.ts airship/pilot --scale 2
 */

import { Surface, type ShotContext, type ShotMap } from "~/pixel";
import { lightingFor } from "~/art/lighting";
import { MenuBackdrop } from "~/art/stadium";
import { signPlace } from "~/art/stadium-airship";
import { schemeForDay } from "~/art/stadium-club";
import { makeView } from "~/art/stadium-view";
import { factForDay } from "~/data/facts";

function backdrop(ctx: ShotContext, w: number, h: number): MenuBackdrop {
  const b = new MenuBackdrop({
    seed: ctx.seed,
    sign: { header: "DID YOU KNOW?", text: factForDay(ctx.seed).text },
  });
  b.resize(w, h);
  b.setLighting(lightingFor(ctx.sun));
  b.setScheme(schemeForDay(ctx.seed).id);
  return b;
}

/** One frame of the home picture. */
function frame(b: MenuBackdrop, w: number, h: number, t: number): Surface {
  const s = new Surface(w, h);
  b.draw(s, t);
  return s;
}

/** The pokes: one, a pause, then quick ones until it bursts (as stadium/airship). */
const POKES = [1, 3.4, 3.6, 3.8, 4.0, 4.2, 4.4, 4.6];
const AFTER_POP = [0.06, 0.9, 1.9, 3.0, 6.8, 12.2];

/** A backdrop whose airship has been poked until it burst, and the time it burst. */
function poked(
  ctx: ShotContext,
  w: number,
  h: number,
): { b: MenuBackdrop; pop: number } {
  const b = backdrop(ctx, w, h);
  const sign = signPlace(makeView(w, h)).panel;
  let pop = Number.NaN;
  for (const t of POKES) {
    // on the envelope above the sign's left end
    b.airshipAt(sign.x + 12, sign.y - 4, t);
    if (b.pokeAirship(t) === "pop") {
      pop = t;
      break;
    }
  }
  return { b, pop };
}

export const shots: ShotMap = {
  "airship/pilot": (ctx) => {
    const C = { x: 20, y: 230, w: 150, h: 200 };
    const { b, pop } = poked(ctx, 960, 540);
    // (the first frame after the pop, and back: the times this sheet has always used)
    const from = pop + AFTER_POP[0] - AFTER_POP[0];
    const at = [0.3, 2.0, 4.0, 5.5, 7.0];
    const out = new Surface(C.w * at.length, C.h);
    at.forEach((d, i) => {
      const s = frame(b, 960, 540, from + d);
      out.blit(s, i * C.w, 0, { sx: C.x, sy: C.y, sw: C.w, sh: C.h });
    });
    return out;
  },
};
