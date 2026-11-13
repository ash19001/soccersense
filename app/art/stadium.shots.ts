/**
 * Shots for the home-screen stadium: the aerial backdrop (stadium.ts).
 *
 *   stadium/full       the backdrop alone
 *   stadium/composed   the home screen: backdrop, the real menu ball (floating) and the wordmark
 *
 * The sign carries the fact of the day whose number is --seed (day 1 by default).
 *   stadium/sign       a close crop of the sign on the airship (--strip to watch it scroll)
 *   stadium/roar       composed, with the ground erupting and a marker at target()
 *   stadium/captions   composed, with what the DOM covers blocked out
 *   stadium/airship    composed, eight frames left to right and down: a poke, a poke near
 *                      bursting, the pop, the fall (two), the crash, the pilot down, and the
 *                      new airship drifting in (the times are fixed; --t is ignored)
 *   stadium/zebra      a close crop of the zebra in front of the ball, no ball: use --strip
 *   stadium/cars       every car heading at each size, day and night lamps, and the coach
 *   stadium/mascot     the mascot close up (480 x 270): a row of idle frames, then a row
 *                      for each trick in turn (--t is ignored)
 *   stadium/schemes    the backdrop in every club scheme, 480 x 270 each, four to a row,
 *                      in the order the days take them (--seed N wears day N's)
 *   led/panel          the shared dot-matrix panel on its own, with every kind of line
 *
 *   ./node_modules/.bin/tsx tools/snap.ts stadium/composed --size 480x270 --time all --scale 3
 *   ./node_modules/.bin/tsx tools/snap.ts stadium/composed --size 480x270 --strip 8 --dt 1.5 --scale 2
 */

import {
  FONT_3x5,
  Surface,
  drawText,
  type ShotContext,
  type ShotMap,
} from "~/pixel";
import { drawBall, type BallPatches, type BallState } from "~/art/ball";
import { UI_COLUMN_W, menuLayout } from "~/art/layout";
import { drawLedLine, drawLedPanel } from "~/art/led";
import { lightingFor } from "~/art/lighting";
import { drawLogo, logoSize } from "~/art/logo";
import { MODE_COLORS, P } from "~/art/palette";
import { MenuBackdrop } from "~/art/stadium";
import { signPlace } from "~/art/stadium-airship";
import { SCHEMES, schemeForDay } from "~/art/stadium-club";
import { TRICKS } from "~/art/stadium-mascot";
import { factForDay } from "~/data/facts";
import {
  HEADINGS,
  carLamps,
  carSprite,
  coachLamps,
  coachSprite,
  headingAngle,
} from "~/art/stadium-cars";
import { ZEBRA } from "~/art/stadium-road";
import { makeView, project } from "~/art/stadium-view";

const PATCHES: BallPatches = {
  left: { label: "HOME", icon: "home", accent: MODE_COLORS.home },
  right: { label: "AWAY", icon: "away", accent: MODE_COLORS.away },
  top: { label: "SOON", icon: "lock", locked: true },
  bottom: { label: "SOON", icon: "lock", locked: true },
};

function scene(ctx: ShotContext): MenuBackdrop {
  const backdrop = new MenuBackdrop({
    seed: ctx.seed,
    sign: { header: "DID YOU KNOW?", text: factForDay(ctx.seed).text },
  });
  backdrop.resize(ctx.w, ctx.h);
  backdrop.setLighting(lightingFor(ctx.sun));
  backdrop.setScheme(schemeForDay(ctx.seed).id);
  return backdrop;
}

/** The home screen as the player sees it (docs/API_ART.md, "Putting the home screen together"). */
function composed(
  ctx: ShotContext,
  roar = 0,
  given?: MenuBackdrop,
): { s: Surface; backdrop: MenuBackdrop } {
  const s = new Surface(ctx.w, ctx.h);
  const light = lightingFor(ctx.sun);
  const backdrop = given ?? scene(ctx);
  backdrop.setRoar(roar);
  backdrop.draw(s, ctx.t);

  const m = menuLayout(s.w, s.h);
  const ball: BallState = {
    cx: m.cx,
    cy: m.ballCy + Math.round(2 * Math.sin((2 * Math.PI * ctx.t) / 4)),
    r: m.ballR,
    yaw: 0.12 * Math.sin((2 * Math.PI * ctx.t) / 5),
    pitch: 0,
    hovered: null,
    pressed: null,
    chosen: null,
    t: ctx.t,
  };
  // the ball floats: no shadow on the ground
  drawBall(s, ball, PATCHES, light);

  const opts = {
    maxWidth: Math.min(s.w - 26, 132),
    maxHeight: m.logo.h,
    t: ctx.t,
  };
  drawLogo(s, m.cx, Math.floor((m.logo.h - logoSize(opts).h) / 2), opts);
  return { s, backdrop };
}

/** The pokes of the airship shot: one, a pause, then quick ones until it bursts. */
const POKES = [1, 3.4, 3.6, 3.8, 4.0, 4.2, 4.4, 4.6];
/** Its frames: seconds after the poke at 1, and after the pop. */
const AFTER_POKE = [0.05, 0.05];
const AFTER_POP = [0.06, 0.9, 1.9, 3.0, 6.8, 12.2];

export const shots: ShotMap = {
  "stadium/full": (ctx) => {
    const s = new Surface(ctx.w, ctx.h);
    scene(ctx).draw(s, ctx.t);
    return s;
  },

  "stadium/composed": (ctx) => composed(ctx).s,

  "stadium/mascot": (ctx) => {
    const W = 480;
    const H = 270;
    const CW = 28;
    const CH = 30;
    const COLS = 12;
    const rows = TRICKS.length + 1;
    const out = new Surface(CW * COLS, CH * rows);
    const one = new Surface(W, H);
    for (let row = 0; row < rows; row++) {
      const backdrop = scene({ ...ctx, w: W, h: H });
      const spot = backdrop.mascotSpot();
      if (!spot) return out;
      // the tricks before this one, each played out in turn
      for (let k = 0; k < row - 1; k++) backdrop.pokeMascot(k * 10);
      const start = (row - 1) * 10;
      if (row > 0) backdrop.pokeMascot(start);
      const dur = row === 0 ? 9 : TRICKS[row - 1].dur;
      for (let i = 0; i < COLS; i++) {
        const t = row === 0 ? 0.3 + i * 0.75 : start + (i / (COLS - 1)) * dur;
        backdrop.draw(one, t);
        out.blit(one, i * CW, row * CH, {
          sx: spot.x - CW / 2,
          sy: spot.y - CH + 5,
          sw: CW,
          sh: CH,
        });
      }
      const label = row === 0 ? "IDLE" : TRICKS[row - 1].name;
      drawText(out, label, 1, row * CH + 1, P.ink, { font: FONT_3x5 });
    }
    return out;
  },

  "stadium/schemes": (ctx) => {
    const W = 480;
    const H = 270;
    const out = new Surface(W * 4, H * Math.ceil(SCHEMES.length / 4));
    const one = new Surface(W, H);
    const backdrop = scene({ ...ctx, w: W, h: H });
    SCHEMES.forEach((scheme, i) => {
      backdrop.setScheme(scheme.id);
      backdrop.draw(one, ctx.t);
      const x = (i % 4) * W;
      const y = Math.floor(i / 4) * H;
      out.blit(one, x, y);
      const label = `${i} ${scheme.name}`;
      out.rect(x, y + H - 9, label.length * 4 + 3, 9, P.ink);
      drawText(out, label, x + 2, y + H - 7, P.chalk, { font: FONT_3x5 });
    });
    return out;
  },

  "stadium/sign": (ctx) => {
    const { s } = composed(ctx);
    const b = signPlace(makeView(s.w, s.h)).panel;
    const pad = 10;
    const out = new Surface(b.w + pad * 2, b.h + pad * 2);
    out.blit(s, pad - b.x, pad - b.y);
    return out;
  },

  "stadium/roar": (ctx) => {
    const { s, backdrop } = composed(ctx, 1);
    const at = backdrop.target();
    // a small cross where the ball drops out of sight
    s.hline(at.x - 3, at.y, 7, P.ink);
    s.vline(at.x, at.y - 3, 7, P.ink);
    s.hline(at.x - 2, at.y, 5, P.ledGreen);
    s.vline(at.x, at.y - 2, 5, P.ledGreen);
    return s;
  },

  "stadium/captions": (ctx) => {
    const { s } = composed(ctx);
    const m = menuLayout(s.w, s.h);
    // the DOM captions: a column 135 px wide in the middle of the caption zone
    const cw = Math.min(UI_COLUMN_W, s.w);
    s.rect(m.cx - Math.floor(cw / 2), m.caption.y, cw, m.caption.h, P.ink);
    s.hline(0, m.logo.h - 1, s.w, P.ledRed);
    return s;
  },

  "stadium/airship": (ctx) => {
    const backdrop = scene(ctx);
    const sign = signPlace(makeView(ctx.w, ctx.h)).panel;
    const frames: number[] = [];
    let popAt = Number.NaN;
    let previous = 0;
    for (const t of POKES) {
      // poked on the top of the envelope, above the sign's left end, as a player would
      backdrop.airshipAt(sign.x + 12, sign.y - 4, t);
      const r = backdrop.pokeAirship(t);
      if (r === "pop") {
        popAt = t;
        break;
      }
      previous = t;
    }
    frames.push(POKES[0] + AFTER_POKE[0], previous + AFTER_POKE[1]);
    for (const d of AFTER_POP) frames.push(popAt + d);
    const cols = 4;
    const out = new Surface(ctx.w * cols, ctx.h * 2);
    for (let i = 0; i < frames.length; i++) {
      const { s } = composed({ ...ctx, t: frames[i] }, 0, backdrop);
      out.blit(s, (i % cols) * ctx.w, Math.floor(i / cols) * ctx.h);
    }
    return out;
  },

  "stadium/zebra": (ctx) => {
    const s = new Surface(ctx.w, ctx.h);
    scene(ctx).draw(s, ctx.t);
    const v = makeView(ctx.w, ctx.h);
    const a = project(v, ZEBRA.x0 - 14, ZEBRA.v1 + 6);
    const b = project(v, ZEBRA.x1 + 14, ZEBRA.v0 - 6);
    const x = Math.max(0, a.x);
    const y = Math.max(0, a.y - 8);
    const out = new Surface(
      Math.max(1, Math.min(ctx.w, b.x) - x),
      Math.max(1, Math.min(ctx.h, b.y + 4) - y),
    );
    out.blit(s, -x, -y);
    return out;
  },

  "stadium/cars": () => {
    // every heading, left to right from east anticlockwise; by day (nearest, middle, far)
    // then at night with the lamps; a grey tick under each shows the true direction
    const cell = 22;
    const s = new Surface(cell * HEADINGS + 4, cell * 7 + 4);
    s.clear(P.concrete);
    s.rect(0, cell * 3 + 2, s.w, s.h, P.night);
    const look = {
      b: P.home,
      l: P.homeLight,
      d: P.homeDark,
      g: P.night,
      k: P.ink,
    };
    const bus = {
      roof: P.steelHi,
      roofHi: P.white,
      side: P.mist,
      stripe: P.home,
      glass: P.slate,
      tyre: P.ink,
    };
    for (let hd = 0; hd < HEADINGS; hd++) {
      const x = 2 + hd * cell + cell / 2;
      const a = (headingAngle(hd) * Math.PI) / 180;
      for (let row = 0; row < 7; row++) {
        const y = 2 + row * cell + cell / 2;
        const tick = row < 3 ? P.concreteDark : P.slate;
        for (let d = 7; d < 10; d++) {
          s.px(
            Math.round(x + Math.cos(a) * d),
            Math.round(y - Math.sin(a) * d),
            tick,
          );
        }
        if (row === 6) {
          coachSprite(s, x, y, 2, hd, bus);
          coachLamps(s, x, y, 2, hd, 1);
          continue;
        }
        const cls = (2 - (row % 3)) as 0 | 1 | 2;
        carSprite(s, x, y, cls, hd, look);
        if (row >= 3) carLamps(s, x, y, cls, hd, 1);
      }
    }
    return s;
  },

  "led/panel": (ctx) => {
    const s = new Surface(100, 64);
    s.clear(P.slate);
    const f = drawLedPanel(s, 4, 4, 92, 37);
    const x = f.x + 2;
    const w = f.w - 4;
    drawLedLine(s, "DID YOU KNOW?", x, f.y + 4, w, {
      font: FONT_3x5,
      color: P.ledGreen,
    });
    drawLedLine(s, "JAPAN NATIONAL STADIUM", x, f.y + 13, w, { t: ctx.t });
    drawLedLine(s, "TOKYO, JAPAN", x, f.y + 24, w, {
      font: FONT_3x5,
      color: P.chalk,
    });
    // a small strip, left and right aligned
    const g = drawLedPanel(s, 4, 45, 92, 15);
    drawLedLine(s, "HOME", g.x + 2, g.y + 2, g.w - 4, {
      color: P.homeLight,
      align: "left",
    });
    drawLedLine(s, "540", g.x + 2, g.y + 2, g.w - 4, { align: "right" });
    return s;
  },
};
