/**
 * Shots for the home-screen stadium: the aerial backdrop (stadium.ts).
 *
 *   stadium/full       the backdrop alone
 *   stadium/composed   the home screen: backdrop, the real menu ball (floating) and the wordmark
 *   stadium/long-name  composed, with a name too long for the sign (it scrolls)
 *   stadium/sign       a close crop of the sign on the airship
 *   stadium/roar       composed, with the ground erupting and a marker at target()
 *   stadium/captions   composed, with what the DOM covers blocked out
 *   led/panel          the shared dot-matrix panel on its own, with every kind of line
 *
 *   ./node_modules/.bin/tsx tools/snap.ts stadium/composed --size 480x270 --time all --scale 3
 *   ./node_modules/.bin/tsx tools/snap.ts stadium/composed --size 480x270 --strip 8 --dt 1.5 --scale 2
 */

import { FONT_3x5, Surface, type ShotContext, type ShotMap } from "~/pixel";
import { drawBall, type BallPatches, type BallState } from "~/art/ball";
import { UI_COLUMN_W, menuLayout } from "~/art/layout";
import { drawLedLine, drawLedPanel } from "~/art/led";
import { lightingFor } from "~/art/lighting";
import { drawLogo, logoSize } from "~/art/logo";
import { MODE_COLORS, P } from "~/art/palette";
import { MenuBackdrop, type MenuStadiumInfo } from "~/art/stadium";

const ANFIELD: MenuStadiumInfo = {
  name: "Anfield",
  city: "Liverpool",
  country: "England",
};

const BERNABEU: MenuStadiumInfo = {
  name: "Estadio Santiago Bernabéu",
  city: "Madrid",
  country: "Spain",
};

const PATCHES: BallPatches = {
  left: { label: "HOME", icon: "home", accent: MODE_COLORS.home },
  right: { label: "AWAY", icon: "away", accent: MODE_COLORS.away },
  top: { label: "SOON", icon: "lock", locked: true },
  bottom: { label: "SOON", icon: "lock", locked: true },
};

function scene(ctx: ShotContext, stadium: MenuStadiumInfo): MenuBackdrop {
  const backdrop = new MenuBackdrop({ seed: ctx.seed, stadium });
  backdrop.resize(ctx.w, ctx.h);
  backdrop.setLighting(lightingFor(ctx.sun));
  return backdrop;
}

/** The home screen as the player sees it (docs/API_ART.md, "Putting the home screen together"). */
function composed(
  ctx: ShotContext,
  stadium: MenuStadiumInfo,
  roar = 0,
): { s: Surface; backdrop: MenuBackdrop } {
  const s = new Surface(ctx.w, ctx.h);
  const light = lightingFor(ctx.sun);
  const backdrop = scene(ctx, stadium);
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

export const shots: ShotMap = {
  "stadium/full": (ctx) => {
    const s = new Surface(ctx.w, ctx.h);
    scene(ctx, ANFIELD).draw(s, ctx.t);
    return s;
  },

  "stadium/composed": (ctx) => composed(ctx, ANFIELD).s,

  "stadium/long-name": (ctx) => composed(ctx, BERNABEU).s,

  "stadium/sign": (ctx) => {
    const { s } = composed(ctx, ANFIELD);
    const b = menuLayout(s.w, s.h).scoreboard;
    const pad = 10;
    const out = new Surface(b.w + pad * 2, b.h + pad * 2);
    out.blit(s, pad - b.x, pad - b.y);
    return out;
  },

  "stadium/roar": (ctx) => {
    const { s, backdrop } = composed(ctx, ANFIELD, 1);
    const at = backdrop.target();
    // a small cross where the ball drops out of sight
    s.hline(at.x - 3, at.y, 7, P.ink);
    s.vline(at.x, at.y - 3, 7, P.ink);
    s.hline(at.x - 2, at.y, 5, P.ledGreen);
    s.vline(at.x, at.y - 2, 5, P.ledGreen);
    return s;
  },

  "stadium/captions": (ctx) => {
    const { s } = composed(ctx, ANFIELD);
    const m = menuLayout(s.w, s.h);
    // the DOM captions: a column 135 px wide in the middle of the caption zone
    const cw = Math.min(UI_COLUMN_W, s.w);
    s.rect(m.cx - Math.floor(cw / 2), m.caption.y, cw, m.caption.h, P.ink);
    s.hline(0, m.logo.h - 1, s.w, P.ledRed);
    return s;
  },

  "led/panel": (ctx) => {
    const s = new Surface(100, 64);
    s.clear(P.slate);
    const f = drawLedPanel(s, 4, 4, 92, 37);
    const x = f.x + 2;
    const w = f.w - 4;
    drawLedLine(s, "TODAY'S STADIUM", x, f.y + 4, w, {
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
