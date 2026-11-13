/**
 * The airship, popped: the burst, the fall, the crash and the pilot's parachute. A
 * cartoon: the sign and its gondola drop spinning and swinging with the empty envelope
 * trailing above them, and land in the park's pond with a splash, or on the grass with a
 * bounce and a puff of dust. The pilot jumps at the pop, floats down under a parachute and
 * waves: nobody is hurt. The wreck is cleared away before the new airship comes in.
 *
 * Where it lands (`findCrashSite`) is chosen once per size from the painted town: open
 * grass or water that nothing stands on, clear of the menu ball and the captions, as near
 * as there is to straight below the airship (water preferred: a splash is funnier).
 *
 * Everything is a function of the seconds since the pop (stadium-airship-poke.ts).
 */

import {
  FONT_5x7,
  Surface,
  bayer4,
  drawText,
  hash2,
  shade,
  toRgb,
  type Color,
} from "~/pixel";
import { menuLayout, type Zone } from "~/art/layout";
import { paintedFont } from "~/art/lettering";
import type { Lighting } from "~/art/lighting";
import { P } from "~/art/palette";
import {
  airshipDrift,
  drawSignText,
  warpBlit,
  type Airship,
  type SignText,
} from "~/art/stadium-airship";
import {
  FALL,
  POP_AT,
  type AirshipPokes,
  type Pose,
} from "~/art/stadium-airship-poke";
import { HR, wallPoint } from "~/art/stadium-bowl";
import { ROAD, WATER, WATER_HI, WATER_LO, groundAt } from "~/art/stadium-plan";
import { depthAtRow, project, scaleAt, type View } from "~/art/stadium-view";

/** The wreck is cleared away over this second, counted from the pop. */
const CLEAR_FROM = 8.6;
const CLEAR_FOR = 1;
/** The pilot lands this long after the pop. */
const PILOT_LANDS = 6;

export interface CrashSite {
  /** The screen point it lands on, and the ground's depth and scale there. */
  x: number;
  y: number;
  V: number;
  scale: number;
  water: boolean;
  /** Where the pilot comes down: grass beside it. */
  pilotX: number;
  pilotY: number;
}

const GRASS = new Set<number>([
  P.grass,
  P.grassLight,
  P.grassDark,
  P.grassDeep,
]);
const WET = new Set<number>([WATER, WATER_HI, WATER_LO]);

/**
 * Where the falling airship lands for this view: open grass or water that nothing stands
 * on, clear of the ball and the captions. `land` is the painted town (its first row is
 * screen row `landTop`) and `depth` its depth mask. `avoid`: places on screen the wreck
 * and the pilot keep well clear of (the mascot).
 */
export function findCrashSite(
  view: View,
  land: Surface,
  landTop: number,
  depth: Float32Array,
  seed: number,
  shipX: number,
  avoid: readonly Zone[] = [],
): CrashSite {
  const { w, h, hy } = view;
  const m = menuLayout(w, h);
  const near = (x0: number, y0: number, x1: number, y1: number): boolean =>
    avoid.some((z) => x0 < z.x + z.w && z.x < x1 && y0 < z.y + z.h && z.y < y1);
  // The ground's depth on each row, worked out once (it is asked for over and over).
  const rowV = new Float64Array(h);
  for (let y = 0; y < h; y++) rowV[y] = depthAtRow(view, y + 0.5);
  // Nothing nearer than the ground itself stands there (a tuft or a flower bed lying on
  // it is fine: its depth is the ground's). Counted into a summed-area table of the pixels
  // that are not open, so that "is all of this box open?" is four lookups, not 300.
  const blocked = new Int32Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let run = 0;
    for (let x = 0; x < w; x++) {
      if (!(depth[y * w + x] >= rowV[y] - 1.5)) run++;
      blocked[(y + 1) * (w + 1) + x + 1] = blocked[y * (w + 1) + x + 1] + run;
    }
  }
  /** Every pixel of the box from (x0, y0) to (x1, y1), inclusive, is on the canvas and open. */
  const allOpen = (x0: number, y0: number, x1: number, y1: number): boolean => {
    if (x0 < 0 || y0 < 0 || x1 >= w || y1 >= h) return false;
    const W = w + 1;
    return (
      blocked[(y1 + 1) * W + x1 + 1] -
        blocked[y0 * W + x1 + 1] -
        blocked[(y1 + 1) * W + x0] +
        blocked[y0 * W + x0] ===
      0
    );
  };
  type Spot = { x: number; y: number; V: number; s: number; water: boolean };
  const spots: Spot[] = [];
  const yIdeal = hy + (h - hy) * 0.3;
  // what the plan says is there, and what was painted there agreeing (the plaza's
  // paving is painted over the plan's grass, for one)
  const kind = (x: number, y: number): number => {
    if (x < 0 || y < 0 || x >= w || y >= h) return 0;
    const V = rowV[y];
    const s = scaleAt(view, V);
    const c = groundAt((x + 0.5 - view.cx) / s, V, s, seed).c as number;
    if (y < landTop) return 0;
    const [r, g, b] = toRgb(land.data[(y - landTop) * w + x] as Color);
    if (WET.has(c)) return b > r + 12 && b >= g ? 2 : 0;
    if (GRASS.has(c)) return g > r + 12 && g > b + 4 ? 1 : 0;
    return 0;
  };
  for (let y = hy + 12; y < h - 8; y += 4) {
    const V = y >= 0 ? rowV[y] : depthAtRow(view, y + 0.5);
    if (V > 150) continue;
    for (let x = 12; x < w - 12; x += 4) {
      const bx = x - view.cx;
      const by = y - m.ballCy;
      if (bx * bx + by * by < (m.ballR + 20) ** 2) continue;
      if (y > m.caption.y - 12 && Math.abs(bx) < 160) continue;
      // the wreck, its dust and its splash
      if (near(x - 32, y - 36, x + 34, y + 10)) continue;
      // well inside the grass (or the water), with nothing standing on it: room for the
      // wreck, which lies on it and stands a dozen pixels up from it
      if (!allOpen(x - 20, y - 24, x + 20, y + 4)) continue;
      const k = kind(x, y);
      if (k === 0) continue;
      let same = true;
      for (let j = -24; j <= 4 && same; j += 4) {
        for (let i = -20; i <= 20 && same; i += 8) {
          if (kind(x + i, y + j) !== k) same = false;
        }
      }
      if (!same) continue;
      spots.push({ x, y, V, s: scaleAt(view, V), water: k === 2 });
    }
  }
  const cost = (p: Spot): number =>
    Math.abs(p.x - shipX) + Math.abs(p.y - yIdeal) * 0.5 - (p.water ? 120 : 0);
  let best: Spot | null = null;
  for (const p of spots) if (!best || cost(p) < cost(best)) best = p;
  if (!best) {
    // No open grass in sight (a phone: the stadium fills it). It comes down behind the
    // stadium, on the allotments past North Road: the roof hides the landing and the dust
    // rises over it; the pilot floats down on to the roof.
    const V = ROAD.northV1 + 9;
    const s = scaleAt(view, V);
    const X = Math.max(-40, Math.min(40, (shipX - view.cx) / s));
    const at = project(view, X, V);
    const roof = wallPoint(-Math.PI / 2 + (X < 0 ? -0.25 : 0.25), 0.93);
    const r = project(view, roof.X, roof.V, HR);
    return {
      x: at.x,
      y: at.y,
      V,
      scale: s,
      water: false,
      pilotX: r.x,
      pilotY: r.y,
    };
  }
  // the pilot: grass beside it, a little way off
  let pilot: Spot | null = null;
  let pilotCost = Infinity;
  for (const p of spots) {
    if (p.water) continue;
    if (near(p.x - 12, p.y - 28, p.x + 14, p.y + 6)) continue;
    const dx = Math.abs(p.x - best.x);
    const c = Math.abs(dx - 28) + Math.abs(p.y - best.y) * 1.5;
    if (dx >= 16 && c < pilotCost) {
      pilot = p;
      pilotCost = c;
    }
  }
  let side = best.x < w / 2 ? 1 : -1;
  const pilotNear = (x: number, y: number): boolean =>
    near(x - 12, y - 28, x + 14, y + 6);
  if (pilotNear(best.x + side * 24, best.y + 4)) side = -side;
  return {
    x: best.x,
    y: best.y,
    V: best.V,
    scale: best.s,
    water: best.water,
    pilotX: pilot && pilotCost < 80 ? pilot.x : best.x + side * 24,
    pilotY: pilot && pilotCost < 80 ? pilot.y : best.y + 4,
  };
}

/** What the fall is built from, painted once per size and light. */
export interface FallKit {
  /** The sign's housing and lamps with the gondola slung under it, and the pivot. */
  base: Surface;
  work: Surface;
  px: number;
  py: number;
  /** From the pivot to the gondola's floor. */
  foot: number;
  /** Where the panel sits on `base`, and the envelope rag's top. */
  panelX: number;
  panelY: number;
  ragTop: number;
}

export function buildFallKit(ship: Airship): FallKit {
  const z = ship.place.panel;
  const top = 30;
  const W = z.w + 16;
  const H = top + z.h + 28;
  const base = new Surface(W, H);
  const panelX = 8;
  const panelY = top;
  // the panel and its housing, lifted off the envelope
  base.blit(ship.layer, panelX - 2, panelY - 2, {
    sx: z.x - ship.x - 2,
    sy: z.y - ship.y - 2,
    sw: z.w + 4,
    sh: z.h + 4,
  });
  // the gondola, hung under it on two cables
  const g = ship.gondola;
  const gx = panelX + Math.floor(z.w / 2) - Math.floor(g.w / 2);
  const gy = panelY + z.h + 6;
  base.blit(ship.layer, gx, gy, { sx: g.x, sy: g.y, sw: g.w, sh: g.h });
  const cable = ship.layer.get(g.x + 4, g.y + 2 - 1);
  for (let i = 0; i < 2; i++) {
    base.vline(gx + 4 + i, panelY + z.h + 2, 4, cable);
    base.vline(gx + g.w - 6 + i, panelY + z.h + 2, 4, cable);
  }
  return {
    base,
    work: new Surface(W, H),
    px: panelX + z.w / 2,
    py: panelY + z.h / 2,
    foot: gy + g.h - (panelY + z.h / 2),
    panelX,
    panelY,
    ragTop: 6,
  };
}

function smooth(u: number): number {
  const v = Math.max(0, Math.min(1, u));
  return v * v * (3 - 2 * v);
}

/**
 * Where the pilot is (his boots: `x`, `y`) `since` seconds after the airship that burst at
 * `popT` let go of him: tumbling out of the gondola, then under his canopy (`open`) down to
 * the crash site's `pilotX`, `pilotY`, swaying a little, and landed there from PILOT_LANDS.
 * `side` is the way he drifts. Whole pixels.
 */
export function pilotAt(
  ship: Airship,
  site: CrashSite,
  popT: number,
  since: number,
): { x: number; y: number; side: number; open: boolean } {
  const drift = airshipDrift(popT);
  const gx = ship.x + ship.gondola.x + 4 + drift.dx;
  const gy = ship.y + ship.gondola.y + 12 + drift.dy;
  const side = site.pilotX >= gx ? 1 : -1;
  let x: number;
  let y: number;
  let open = false;
  if (since < 0.5) {
    const d = Math.max(0, since - 0.1);
    x = gx + side * d * 24;
    y = gy + 140 * d * d;
  } else if (since < PILOT_LANDS) {
    const u = (since - 0.5) / (PILOT_LANDS - 0.5);
    const ox = gx + side * 9.6;
    const oy = gy + 140 * 0.16;
    x = ox + (site.pilotX - ox) * smooth(u) + Math.sin(since * 2.6) * 4;
    y = oy + (site.pilotY - oy) * u;
    open = true;
  } else {
    x = site.pilotX;
    y = site.pilotY;
  }
  return { x: Math.round(x), y: Math.round(y), side, open };
}

/** A dithered ellipse, only where `keep` allows. */
function blob(
  s: Surface,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  c: Color,
  level: number,
  keep: (x: number, y: number) => boolean,
): void {
  if (level <= 0 || rx <= 0 || ry <= 0) return;
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      if (x < 0 || y < 0 || x >= s.w || y >= s.h) continue;
      const u = (x - cx) / rx;
      const v = (y - cy) / ry;
      if (u * u + v * v > 1) continue;
      if (bayer4(x, y) >= level || !keep(x, y)) continue;
      s.data[y * s.w + x] = c;
    }
  }
}

/**
 * The envelope, empty: a rag fluttering on two tethers above the sign, drawn with its own
 * light: a lit top edge, the cloth, a shaded underside, folds where the wave turns, the
 * club's nose and band, the flopped fin with its hinge, and tethers of 2 px.
 */
function drawRag(
  s: Surface,
  kit: FallKit,
  ship: Airship,
  light: Lighting,
  flutter: number,
  t: number,
): void {
  const pw = ship.place.panel.w;
  const left = kit.panelX + 2;
  const right = kit.panelX + pw - 4;
  const span = right - left;
  const base = kit.panelY - 12;
  const white = light.env(P.white);
  const chalk = light.env(P.chalk);
  const mist = light.env(P.mist);
  const fold = light.env(P.concreteLight);
  const fin = light.env(P.home);
  const finLight = light.env(P.homeLight);
  const finDark = light.env(P.homeDark);
  let last = Number.NaN;
  for (let i = 0; i <= span; i++) {
    const u = i / span;
    const wave = Math.sin(Math.PI * 2 * (u * 1.4 - t * 2.2));
    const y =
      base - 6 + Math.round(flutter * 4.4 * wave * Math.sin(Math.PI * u));
    const thick = 4 + (Math.sin(Math.PI * u) > 0.5 ? 2 : 0);
    const club = u < 0.08 || (u > 0.72 && u < 0.76);
    // a fold where the cloth turns over (it climbs or drops two rows at once)
    const folded = Number.isFinite(last) && Math.abs(y - last) >= 2;
    last = y;
    for (let j = 0; j < thick; j++) {
      let c: Color;
      if (club) c = j === 0 ? finLight : j === thick - 1 ? finDark : fin;
      else if (j === 0) c = white;
      else if (j === thick - 1) c = mist;
      else c = folded ? fold : j === 1 ? white : chalk;
      s.px(left + i, y + j, c);
    }
  }
  // the tail fin, flopped, with its hinge
  const fy = base - 12 + Math.round(flutter * 2);
  s.rect(right - 4, fy, 4, 6, fin);
  s.rect(right - 4, fy, 4, 1, finLight);
  s.rect(right - 2, fy + 1, 1, 5, finDark);
  // the tethers to the sign's top corners
  const rope = light.env(P.steel);
  for (let i = 0; i < 2; i++) {
    s.line(left + 4 + i, base, kit.panelX + 2 + i, kit.panelY - 2, rope);
    s.line(right - 4 + i, base, kit.panelX + pw - 4 + i, kit.panelY - 2, rope);
  }
}

/** Bits of envelope flung out by the pop. */
const SHREDS = 18;

/**
 * The burst airship at `since` seconds after the pop: the burst, the fall, the crash, the
 * wreck and the pilot. `depth` is the town's depth mask (the wreck lies behind what stands
 * nearer than it).
 */
export function drawDown(
  s: Surface,
  ship: Airship,
  kit: FallKit,
  site: CrashSite,
  text: SignText,
  light: Lighting,
  t: number,
  since: number,
  depth: Float32Array,
): void {
  const z = ship.place.panel;
  // the monitor's panel (70 tall), at the airship's size
  const roomy = z.h >= 70 * ship.place.size - 1;
  const popT = t - since;
  const drift = airshipDrift(popT);
  const ex = ship.x + ship.centre.x + drift.dx;
  const ey = ship.y + ship.centre.y + drift.dy;
  const { rx, ry } = ship.place;
  const reach = rx / 64;

  // ---- the fall and the wreck ----------------------------------------------
  const kEnd = Math.max(
    0.16,
    Math.min(0.55, (15 * site.scale) / Math.max(1, z.w + 4)),
  );
  const startX = z.x + z.w / 2 + drift.dx;
  const startY = z.y + z.h / 2 + drift.dy;
  const restY = site.y - kit.foot * kEnd;
  const clearing = since - CLEAR_FROM;
  if (clearing < CLEAR_FOR) {
    const w = kit.work;
    w.clear();
    w.blit(kit.base, 0, 0);
    const landed = since >= FALL;
    const g = since - FALL;
    drawRag(w, kit, ship, light, landed ? Math.max(0, 1 - g * 3) : 1, t);
    // the fact stands still at its start while it falls
    drawSignText(w, text, kit.panelX, kit.panelY, z.w, z.h, 0);
    let x: number;
    let y: number;
    let k: number;
    let angle: number;
    let spin = 1;
    if (!landed) {
      const u = since / FALL;
      x = startX + (site.x - startX) * smooth(u);
      y =
        startY +
        (restY - startY) * u * u -
        10 * reach * Math.sin(Math.PI * u) * (1 - u);
      k = 1 + (kEnd - 1) * Math.pow(u, 1.2);
      spin = Math.cos(Math.PI * 4 * u * u);
      angle = 0.5 * Math.sin(Math.PI * 2 * 1.4 * since) * (1 - u * 0.8);
    } else {
      x = site.x;
      y = restY;
      k = kEnd;
      const tilt = site.water ? 0.15 : -0.32;
      angle = tilt * Math.min(1, g / 0.45);
      if (!site.water && g < 0.45) {
        const v = g / 0.45;
        y -= Math.round(Math.max(6, 32 * kEnd) * 4 * v * (1 - v));
      }
      if (site.water) {
        // bobs, then sinks
        if (g < 0.4) y += Math.round(2 * Math.sin(g * 20));
        else y += ((g - 0.4) / 1.8) * (kit.base.h * kEnd + 8);
      }
    }
    const keepLanded = (X: number, Y: number): boolean => {
      if (depth[Y * s.w + X] < site.V - 0.5) return false;
      if (site.water && Y > site.y) return false;
      return clearing < 0 || bayer4(X, Y) >= clearing / CLEAR_FOR;
    };
    warpBlit(s, w, {
      px: kit.px,
      py: kit.py,
      x: Math.round(x),
      y: Math.round(y),
      angle,
      sx: k * spin,
      sy: k,
      back: light.env(P.concreteDark),
      // it falls into the town, so whatever stands nearer than where it lands hides it
      keep: keepLanded,
    });
  }

  // ---- the burst: over the falling sign --------------------------------------
  if (since < 0.1) {
    // the envelope swells white for an instant, and is gone
    const k = 1 + since * 2.5;
    warpBlit(s, ship.layer, {
      px: ship.centre.x,
      py: ship.centre.y,
      x: ex,
      y: ey,
      angle: 0,
      sx: k,
      sy: k,
      paint: since < 0.05 ? P.white : light.env(P.chalk),
    });
  }
  if (since < 0.2) {
    const r = rx * (0.35 + since * 4);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + 0.2;
      const inner = r * 0.45;
      const x0 = Math.round(ex + Math.cos(a) * inner);
      const y0 = Math.round(ey + Math.sin(a) * inner * 0.7);
      const x1 = Math.round(ex + Math.cos(a) * r);
      const y1 = Math.round(ey + Math.sin(a) * r * 0.7);
      const c = i % 2 === 0 ? P.white : P.goldLight;
      s.line(x0, y0, x1, y1, c);
      // a ray is 2 px thick at its root, thinning to its tip

      const steep = Math.abs(y1 - y0) > Math.abs(x1 - x0);
      s.line(x0 + (steep ? 1 : 0), y0 + (steep ? 0 : 1), x1, y1, c);
    }
    s.ellipse(ex, ey, r * 0.3, r * 0.2, P.white, true);
  }
  if (since < 2.2) {
    const tones = [
      light.env(P.white),
      light.env(P.chalk),
      light.env(P.home),
      light.env(P.mist),
    ];
    for (let i = 0; i < SHREDS; i++) {
      const a = (i / SHREDS) * Math.PI * 2 + hash2(i, 5, 1) * 0.3;
      const speed = (45 + 55 * hash2(i, 6, 1)) * reach;
      const x0 = ex + Math.cos(a) * rx * 0.8;
      const y0 = ey + Math.sin(a) * ry * 0.8;
      const drag = (1 - Math.exp(-since * 2.2)) / 2.2;
      const x = x0 + Math.cos(a) * speed * drag;
      const y =
        y0 +
        (Math.sin(a) * speed * 0.8 - 25 * reach) * drag +
        76 * since * since;
      if (y > s.h + 4) continue;
      const flip = Math.floor(since * 10 + i) % 2 === 0;
      const big = roomy && i % 3 === 0;

      const c = tones[i % tones.length];
      drawShred(s, Math.round(x), Math.round(y), flip, big, c);
    }
  }
  if (since < 0.8 && !(since > 0.55 && Math.floor(since * 20) % 2 === 0)) {
    const scale = roomy ? 2 : 1;
    drawText(
      s,
      "POP!",
      ex,
      Math.round(ey - 16 * scale - since * 28),
      P.goldLight,
      {
        font: paintedFont(FONT_5x7),
        align: "center",
        outline: P.ink,
        scale,
      },
    );
  }

  // ---- the crash ------------------------------------------------------------
  const g = since - FALL;
  const always = (X: number, Y: number): boolean =>
    depth[Y * s.w + X] >= site.V - 0.5;
  // the ground's scale, clamped, in pixels
  const sk = Math.max(1, Math.min(3.2, site.scale));
  if (g >= 0 && !site.water && g < 1.6) {
    const dust = light.env(P.concreteLight);
    const dusk = light.env(P.mist);
    for (let i = 0; i < 7; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const spread = (2 + g * 12 + i * 1.5) * sk;
      blob(
        s,
        site.x + side * spread * (0.4 + (i % 3) * 0.3),
        site.y - g * 4 * sk - (i % 3) * 2,
        (1.5 + g * 3) * sk,
        (1 + g * 2) * sk,
        i % 2 === 0 ? dust : dusk,
        0.85 * (1 - g / 1.6),
        always,
      );
    }
  }
  if (g >= 0 && site.water && g < 4) {
    const white = light.env(P.white);
    const spray = light.env(P.mist);
    if (g < 0.35) {
      const tall = Math.round(14 * sk * (1 - g / 0.35));
      drawSplashColumn(s, site.x, site.y, tall, white, spray);
    }
    if (g < 1.3) {
      for (let i = 0; i < 14; i++) {
        const vx = (hash2(i, 31, 2) - 0.5) * 34 * sk;
        const vy = -(35 + 35 * hash2(i, 32, 2)) * sk;
        const x = site.x + vx * g;
        const y = site.y + vy * g + 70 * sk * g * g;
        if (y > site.y + 2) continue;
        const c = i % 3 === 0 ? spray : white;
        // a drop is 2 x 2, or 1 x 2 as it falls
        s.rect(Math.round(x), Math.round(y), i % 2 ? 1 : 2, 2, c);
      }
    }
    for (let i = 0; i < 3; i++) {
      const age = g - i * 0.4;
      if (age < 0 || age > 1.8) continue;
      if (age > 1.2 && Math.floor(t * 12) % 2 === 0) continue;
      const r = (2 + age * 7) * sk;
      s.ellipse(site.x, site.y, r, Math.max(2, r * 0.35), white);
      // each ring has a fainter twin just inside it
      if (r > 6) {
        s.ellipse(site.x, site.y, r - 2, Math.max(1, r * 0.35 - 1), spray);
      }
    }
    if (g > 1.8) {
      for (let i = 0; i < 3; i++) {
        const age = (g - 1.8 + i * 0.37) % 1.1;
        const c = age < 0.9 ? white : spray;
        const bx = site.x + (i - 1) * 2;
        const by = Math.round(site.y - age * 10);

        // a bubble: a lit pixel over a shaded one
        s.px(bx, by, c);
        s.px(bx + 1, by, white);
        s.px(bx, by + 1, spray);
      }
    }
  }

  // ---- the pilot, under a parachute ---------------------------------------------
  if (since >= 0.1 && clearing < CLEAR_FOR * 0.5) {
    const { x, y, side, open } = pilotAt(ship, site, popT, since);

    const state = open ? "chute" : since >= PILOT_LANDS ? "landed" : "tumble";
    const wave = Math.floor(t * 4) % 2 === 0;
    drawPilot(s, x, y, state, side, roomy ? 3 : 2, light, wave);
    return;
  }
}

/** Puffs of gas from the tail, one for each hard poke in the last second and a half. */
export function drawPuffs(
  s: Surface,
  ship: Airship,
  pokes: AirshipPokes,
  pose: Pose,
  light: Lighting,
  t: number,
): void {
  if (pose.stress < 0.4) return;
  const { dx, dy } = airshipDrift(t);
  const x0 = ship.x + ship.tail.x - 8 + dx + pose.dx;
  const y0 = ship.y + ship.centre.y + dy + pose.dy - 4;
  const gas = light.env(P.chalk);
  const thin = light.env(P.mist);
  const lit = light.env(P.white);
  pokes.recent(t, 1.5, (p) => {
    if (pokes.stress(p.t) / POP_AT < 0.45) return;
    const age = t - p.t;
    const r = (1 + age * 2.5) * 2;
    const x = Math.round(x0 + age * 18);
    const y = Math.round(y0 - age * 12);
    const level = age < 0.5 ? 1 : age < 1 ? 0.5 : 0.25;
    s.disc(x, y, r, age < 0.6 ? gas : thin, level);
    // a fresh puff catches the light on its upper left
    if (age < 0.6 && r >= 3) {
      s.disc(x - 1, y - 1, r * 0.45, lit, level);
    }
  });
}

// ---------------------------------------------------------------------------
// The fall: the pilot and his parachute, shreds, the splash
// ---------------------------------------------------------------------------

export type PilotState = "tumble" | "chute" | "landed";

/**
 * The pilot with his boots on row y and his left column at x: 2 wide and 6 tall (a cap,
 * his face, a coat in the club's colour, trousers, boots). Tumbling he throws both arms up;
 * under the canopy he hangs from its rigging; landed, his canopy lies beside him (`side`)
 * and he waves. `wide` is half the canopy's width in pairs of pixels (3 on a monitor, 2 on
 * a phone).
 */
export function drawPilot(
  s: Surface,
  x: number,
  y: number,
  state: PilotState,
  side: number,
  wide: number,
  light: Lighting,
  wave: boolean,
): void {
  const skin = light.env(P.skinA);
  const coat = light.env(P.home);
  const coatLit = light.env(P.homeLight);
  const legs = light.env(P.slate);
  const cap = light.env(P.woodDark);
  const silk = light.env(P.white);
  const silk2 = light.env(P.homeLight);
  const silkShade = light.env(P.chalk);
  const silk2Shade = light.env(P.home);
  if (state === "chute") {
    // the canopy: gores in two colours, a lit crown, a scalloped hem in shade
    const r = wide * 2 + 1;
    const top = y - 17;
    const rows = [r - 5, r - 3, r - 1, r, r];
    for (let j = 0; j < rows.length; j++) {
      const hw = rows[j];
      for (let i = -hw; i <= hw + 1; i++) {
        const gore = Math.floor((i + 32) / 2) % 2 === 0;
        let c = gore ? silk : silk2;
        if (j === rows.length - 1) {
          c = gore ? silkShade : silk2Shade;
          if (((i + 32) & 1) === 1 && Math.abs(i) > 1) continue;
        }
        if (j === 0 && i < 0) c = gore ? silk : silk;
        s.px(x + i, top + j, c);
      }
    }
    // the rigging, a pair of lines each side down to his hands on the risers
    const rope = light.env(P.steel);
    const hem = top + rows.length - 1;
    s.line(x - r, hem, x - 1, y - 5, rope);
    s.line(x - r + 2, hem, x - 1, y - 5, rope);
    s.line(x + r + 1, hem, x + 2, y - 5, rope);
    s.line(x + r - 1, hem, x + 2, y - 5, rope);
    pilotBody(s, x, y, cap, skin, coat, coatLit, legs, light);
    s.rect(x - 1, y - 4, 1, 2, coat);
    s.rect(x + 2, y - 4, 1, 2, coat);
    s.px(x - 1, y - 5, skin);
    s.px(x + 2, y - 5, skin);
    return;
  }
  pilotBody(s, x, y, cap, skin, coat, coatLit, legs, light);
  if (state === "landed") {
    // the canopy down beside him in a heap, and a wave: all well
    const x0 = side > 0 ? x + 4 : x - 11;
    for (let i = 0; i < 9; i++) {
      const gore = Math.floor(i / 2) % 2 === 0;
      s.px(x0 + i, y, gore ? silkShade : silk2Shade);
      if (i > 0 && i < 8) s.px(x0 + i, y - 1, gore ? silk : silk2);
      if (i > 2 && i < 6) s.px(x0 + i, y - 2, gore ? silk : silk2);
    }
    const hx = side > 0 ? x - 1 : x + 2;
    s.px(hx, y - 3, coat);
    s.rect(hx, wave ? y - 6 : y - 5, 1, 2, skin);
    return;
  }
  // tumbling out, arms up
  s.rect(x - 1, y - 4, 1, 2, coat);
  s.rect(x + 2, y - 4, 1, 2, coat);
  s.px(x - 1, y - 5, skin);
  s.px(x + 2, y - 5, skin);
}

/** The pilot himself: a cap, his face, a coat lit on its left, trousers and boots. */
function pilotBody(
  s: Surface,
  x: number,
  y: number,
  cap: Color,
  skin: Color,
  coat: Color,
  coatLit: Color,
  legs: Color,
  light: Lighting,
): void {
  s.rect(x, y - 5, 2, 1, cap);
  s.rect(x, y - 4, 2, 1, skin);
  s.rect(x, y - 3, 2, 2, coat);
  s.px(x, y - 3, coatLit);
  s.rect(x, y - 1, 2, 1, legs);
  s.rect(x, y, 2, 1, light.env(P.ink));
}

/**
 * A shred of envelope: `flip` turns it edge on. 4 x 2 (big 6 x 2) or 2 x 4 (2 x 6), with its
 * shaded side a tone darker.
 */
export function drawShred(
  s: Surface,
  x: number,
  y: number,
  flip: boolean,
  big: boolean,
  c: Color,
): void {
  const long = big ? 6 : 4;
  const dark = shade(c, -0.22);
  if (flip) {
    s.rect(x, y, long, 1, c);
    s.rect(x + 1, y + 1, long - 1, 1, dark);
  } else {
    s.rect(x, y, 1, long, c);
    s.rect(x + 1, y + 1, 1, long - 1, dark);
  }
}

/** The column of water thrown up by the splash: 6 wide, `tall` high, a crown on top. */
export function drawSplashColumn(
  s: Surface,
  x: number,
  y: number,
  tall: number,
  white: Color,
  spray: Color,
): void {
  if (tall <= 0) return;
  s.rect(x - 2, y - tall, 6, tall, white);
  s.rect(x + 3, y - tall + 2, 1, Math.max(0, tall - 2), spray);
  // the crown splays out
  s.px(x - 3, y - tall, white);
  s.px(x + 4, y - tall, white);
  s.px(x - 4, y - tall - 1, spray);
  s.px(x + 5, y - tall - 1, spray);
  s.rect(x - 1, y - tall - 1, 4, 1, white);
}
