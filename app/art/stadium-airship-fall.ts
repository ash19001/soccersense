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
  toRgb,
  type Color,
} from "~/pixel";
import { menuLayout } from "~/art/layout";
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
 * screen row `landTop`) and `depth` its depth mask.
 */
export function findCrashSite(
  view: View,
  land: Surface,
  landTop: number,
  depth: Float32Array,
  seed: number,
  shipX: number,
): CrashSite {
  const { w, h, hy } = view;
  const m = menuLayout(w, h);
  // nothing nearer than the ground itself stands there (a tuft or a flower bed lying on
  // it is fine: its depth is the ground's)
  const open = (x: number, y: number, V: number): boolean =>
    x >= 0 && y >= 0 && x < w && y < h && depth[y * w + x] >= V - 1.5;
  type Spot = { x: number; y: number; V: number; s: number; water: boolean };
  const spots: Spot[] = [];
  const yIdeal = hy + (h - hy) * 0.3;
  // what the plan says is there, and what was painted there agreeing (the plaza's
  // paving is painted over the plan's grass, for one)
  const kind = (x: number, y: number): number => {
    if (x < 0 || y < 0 || x >= w || y >= h) return 0;
    const V = depthAtRow(view, y + 0.5);
    const s = scaleAt(view, V);
    const c = groundAt((x + 0.5 - view.cx) / s, V, s, seed).c as number;
    if (y < landTop) return 0;
    const [r, g, b] = toRgb(land.data[(y - landTop) * w + x] as Color);
    if (WET.has(c)) return b > r + 12 && b >= g ? 2 : 0;
    if (GRASS.has(c)) return g > r + 12 && g > b + 4 ? 1 : 0;
    return 0;
  };
  for (let y = hy + 6; y < h - 4; y += 2) {
    const V = depthAtRow(view, y + 0.5);
    if (V > 150) continue;
    for (let x = 6; x < w - 6; x += 2) {
      const bx = x - view.cx;
      const by = y - m.ballCy;
      if (bx * bx + by * by < (m.ballR + 10) ** 2) continue;
      if (y > m.caption.y - 6 && Math.abs(bx) < 80) continue;
      // well inside the grass (or the water), with nothing standing on it: room for the
      // wreck, which lies on it and stands a dozen pixels up from it
      let clear = true;
      for (let j = -12; j <= 2 && clear; j++) {
        for (let i = -10; i <= 10 && clear; i++) {
          if (!open(x + i, y + j, depthAtRow(view, y + j + 0.5))) clear = false;
        }
      }
      if (!clear) continue;
      const k = kind(x, y);
      if (k === 0) continue;
      let same = true;
      for (let j = -12; j <= 2 && same; j += 2) {
        for (let i = -10; i <= 10 && same; i += 4) {
          if (kind(x + i, y + j) !== k) same = false;
        }
      }
      if (!same) continue;
      spots.push({ x, y, V, s: scaleAt(view, V), water: k === 2 });
    }
  }
  const cost = (p: Spot): number =>
    Math.abs(p.x - shipX) + Math.abs(p.y - yIdeal) * 0.5 - (p.water ? 60 : 0);
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
    const dx = Math.abs(p.x - best.x);
    const c = Math.abs(dx - 14) + Math.abs(p.y - best.y) * 1.5;
    if (dx >= 8 && c < pilotCost) {
      pilot = p;
      pilotCost = c;
    }
  }
  const side = best.x < w / 2 ? 1 : -1;
  return {
    x: best.x,
    y: best.y,
    V: best.V,
    scale: best.s,
    water: best.water,
    pilotX: pilot && pilotCost < 40 ? pilot.x : best.x + side * 12,
    pilotY: pilot && pilotCost < 40 ? pilot.y : best.y + 2,
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
  const top = 15;
  const W = z.w + 8;
  const H = top + z.h + 14;
  const base = new Surface(W, H);
  const panelX = 4;
  const panelY = top;
  // the panel and its housing, lifted off the envelope
  base.blit(ship.layer, panelX - 1, panelY - 1, {
    sx: z.x - ship.x - 1,
    sy: z.y - ship.y - 1,
    sw: z.w + 2,
    sh: z.h + 2,
  });
  // the gondola, hung under it on two cables
  const g = ship.gondola;
  const gx = panelX + Math.floor(z.w / 2) - 9;
  const gy = panelY + z.h + 3;
  base.blit(ship.layer, gx, gy, { sx: g.x, sy: g.y, sw: g.w, sh: g.h });
  const cable = ship.layer.get(g.x + 2, g.y);
  base.vline(gx + 2, panelY + z.h + 1, 2, cable);
  base.vline(gx + 15, panelY + z.h + 1, 2, cable);
  return {
    base,
    work: new Surface(W, H),
    px: panelX + z.w / 2,
    py: panelY + z.h / 2,
    foot: gy + g.h - (panelY + z.h / 2),
    panelX,
    panelY,
    ragTop: 3,
  };
}

function smooth(u: number): number {
  const v = Math.max(0, Math.min(1, u));
  return v * v * (3 - 2 * v);
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

/** The envelope, empty: a rag fluttering on two tethers above the sign. */
function drawRag(
  s: Surface,
  kit: FallKit,
  ship: Airship,
  light: Lighting,
  flutter: number,
  t: number,
): void {
  const z = ship.place.panel;
  const left = kit.panelX + 1;
  const right = kit.panelX + z.w - 2;
  const span = right - left;
  const base = kit.panelY - 6;
  const tones = [light.env(P.white), light.env(P.chalk), light.env(P.mist)];
  const fin = light.env(P.home);
  for (let i = 0; i <= span; i++) {
    const u = i / span;
    const wave = Math.sin(Math.PI * 2 * (u * 1.4 - t * 2.2));
    const y =
      base - 3 + Math.round(flutter * 2.2 * wave * Math.sin(Math.PI * u));
    const thick = 2 + (Math.sin(Math.PI * u) > 0.5 ? 1 : 0);
    for (let j = 0; j < thick; j++) {
      const c = u < 0.08 || (u > 0.72 && u < 0.76) ? fin : tones[j];
      s.px(left + i, y + j, c);
    }
  }
  // the tail fin, flopped
  s.rect(right - 2, base - 6 + Math.round(flutter), 2, 3, fin);
  // the tethers to the sign's top corners
  const rope = light.env(P.steel);
  s.line(left + 2, base, kit.panelX + 1, kit.panelY - 1, rope);
  s.line(right - 2, base, kit.panelX + z.w - 2, kit.panelY - 1, rope);
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
  const roomy = z.h >= 35;
  const popT = t - since;
  const drift = airshipDrift(popT);
  const ex = ship.x + ship.centre.x + drift.dx;
  const ey = ship.y + ship.centre.y + drift.dy;
  const { rx, ry } = ship.place;
  const reach = rx / 64;

  // ---- the fall and the wreck ----------------------------------------------
  const kEnd = Math.max(
    0.16,
    Math.min(0.55, (15 * site.scale) / Math.max(1, z.w + 2)),
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
        y -= Math.round(Math.max(3, 16 * kEnd) * 4 * v * (1 - v));
      }
      if (site.water) {
        // bobs, then sinks
        if (g < 0.4) y += Math.round(Math.sin(g * 20));
        else y += ((g - 0.4) / 1.8) * (kit.base.h * kEnd + 4);
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
      s.line(
        Math.round(ex + Math.cos(a) * inner),
        Math.round(ey + Math.sin(a) * inner * 0.7),
        Math.round(ex + Math.cos(a) * r),
        Math.round(ey + Math.sin(a) * r * 0.7),
        i % 2 === 0 ? P.white : P.goldLight,
      );
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
        38 * since * since;
      if (y > s.h + 2) continue;
      const flip = Math.floor(since * 10 + i) % 2 === 0;
      const big = roomy && i % 3 === 0;
      s.rect(
        Math.round(x),
        Math.round(y),
        flip ? (big ? 3 : 2) : 1,
        flip ? 1 : big ? 3 : 2,
        tones[i % tones.length],
      );
    }
  }
  if (since < 0.8 && !(since > 0.55 && Math.floor(since * 20) % 2 === 0)) {
    const scale = roomy ? 2 : 1;
    drawText(
      s,
      "POP!",
      ex,
      Math.round(ey - 8 * scale - since * 14),
      P.goldLight,
      {
        font: FONT_5x7,
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
  const sk = Math.max(0.5, Math.min(1.6, site.scale));
  if (g >= 0 && !site.water && g < 1.6) {
    const dust = light.env(P.concreteLight);
    const dusk = light.env(P.mist);
    for (let i = 0; i < 7; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const spread = (2 + g * 12 + i * 1.5) * sk;
      blob(
        s,
        site.x + side * spread * (0.4 + (i % 3) * 0.3),
        site.y - g * 4 * sk - (i % 3),
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
      s.rect(site.x - 1, site.y - tall, 3, tall, white);
    }
    if (g < 1.3) {
      for (let i = 0; i < 14; i++) {
        const vx = (hash2(i, 31, 2) - 0.5) * 34 * sk;
        const vy = -(35 + 35 * hash2(i, 32, 2)) * sk;
        const x = site.x + vx * g;
        const y = site.y + vy * g + 70 * sk * g * g;
        if (y > site.y + 1) continue;
        s.px(Math.round(x), Math.round(y), i % 3 === 0 ? spray : white);
      }
    }
    for (let i = 0; i < 3; i++) {
      const age = g - i * 0.4;
      if (age < 0 || age > 1.8) continue;
      if (age > 1.2 && Math.floor(t * 12) % 2 === 0) continue;
      const r = (2 + age * 7) * sk;
      s.ellipse(site.x, site.y, r, Math.max(1, r * 0.35), white);
    }
    if (g > 1.8) {
      for (let i = 0; i < 3; i++) {
        const age = (g - 1.8 + i * 0.37) % 1.1;
        s.px(
          site.x + i - 1,
          Math.round(site.y - age * 5),
          age < 0.9 ? white : spray,
        );
      }
    }
  }

  // ---- the pilot, under a parachute ---------------------------------------------
  if (since >= 0.1 && clearing < CLEAR_FOR * 0.5) {
    const gx = ship.x + ship.gondola.x + 2 + drift.dx;
    const gy = ship.y + ship.gondola.y + 6 + drift.dy;
    const side = site.pilotX >= gx ? 1 : -1;
    let x: number;
    let y: number;
    let open = false;
    if (since < 0.5) {
      const d = since - 0.1;
      x = gx + side * d * 12;
      y = gy + 70 * d * d;
    } else if (since < PILOT_LANDS) {
      const u = (since - 0.5) / (PILOT_LANDS - 0.5);
      const ox = gx + side * 4.8;
      const oy = gy + 70 * 0.16;
      x = ox + (site.pilotX - ox) * smooth(u) + Math.sin(since * 2.6) * 2;
      y = oy + (site.pilotY - oy) * u;
      open = true;
    } else {
      x = site.pilotX;
      y = site.pilotY;
    }
    x = Math.round(x);
    y = Math.round(y);
    const skin = light.env(P.skinA);
    const coat = light.env(P.home);
    const legs = light.env(P.slate);
    const silk = light.env(P.white);
    const silk2 = light.env(P.homeLight);
    const landed = since >= PILOT_LANDS;
    s.px(x, y - 2, skin);
    s.px(x, y - 1, coat);
    s.px(x, y, legs);
    if (open) {
      const wide = roomy ? 3 : 2;
      for (let i = -wide; i <= wide; i++) {
        s.px(x + i, y - 7, i % 2 === 0 ? silk : silk2);
        if (Math.abs(i) < wide) s.px(x + i, y - 8, i % 2 === 0 ? silk2 : silk);
      }
      const rope = light.env(P.steel);
      s.line(x - wide, y - 6, x, y - 3, rope);
      s.line(x + wide, y - 6, x, y - 3, rope);
    } else if (landed) {
      // the canopy down beside them, and a wave: all well
      for (let i = 2; i < 6; i++)
        s.px(x + side * i, y, i % 2 === 0 ? silk : silk2);
      const up = Math.floor(t * 4) % 2 === 0;
      s.px(x - side, y - (up ? 3 : 2), skin);
    } else {
      // tumbling out, arms up
      s.px(x - 1, y - 3, skin);
      s.px(x + 1, y - 3, skin);
    }
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
  const x0 = ship.x + ship.tail.x - 4 + dx + pose.dx;
  const y0 = ship.y + ship.centre.y + dy + pose.dy - 2;
  const gas = light.env(P.chalk);
  const thin = light.env(P.mist);
  pokes.recent(t, 1.5, (p) => {
    if (pokes.stress(p.t) / POP_AT < 0.45) return;
    const age = t - p.t;
    const r = 1 + age * 2.5;
    const x = Math.round(x0 + age * 9);
    const y = Math.round(y0 - age * 6);
    s.disc(
      x,
      y,
      r,
      age < 0.6 ? gas : thin,
      age < 0.5 ? 1 : age < 1 ? 0.5 : 0.25,
    );
  });
}
