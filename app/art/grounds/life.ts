/**
 * The moving things of a career ground. A build of the static layer fills a `Life` with
 * what this tier has (smoke, flags, the crowd, the dog...), already in final colours, and
 * the frame loop draws them over the layer. Nothing here allocates while drawing.
 */

import type { Zone } from "~/art/layout";
import { drawLedLine } from "~/art/led";
import { P } from "~/art/palette";
import {
  FONT_3x5,
  Surface,
  TRANSPARENT,
  bayer4,
  drawSprite,
  hash2,
  type Color,
} from "~/pixel";
import {
  DOG,
  DOG_SIT,
  DOG_STAND,
  DOG_TROT,
  FanList,
  REST,
  drawFans,
  drawWatcher,
  poseFor,
  type Watcher,
} from "./people";
import type { CrowdMood } from "./types";

export interface Spot {
  x: number;
  y: number;
}

/** A flag on a pole: the pole's column, the top of the pole, the cloth hanging right. */
export interface Flag {
  x: number;
  top: number;
  poleH: number;
  w: number;
  h: number;
  a: Color;
  b: Color;
  pole: Color;
  phase: number;
}

/** A row of LED boards whose text crawls: the strip is pre-painted and scrolled. */
export interface Crawl {
  x0: number;
  x1: number;
  y: number;
  strip: Surface;
  /** Pixels a second. */
  speed: number;
}

export interface Washing {
  y: number;
  items: { x: number; w: number; h: number; c: Color; low: Color }[];
}

export interface DogPlan {
  roam: boolean;
  x0: number;
  x1: number;
  /** The row under its feet. */
  y: number;
  colors: Color[];
}

export interface GiantFlag {
  x0: number;
  x1: number;
  y: number;
  w: number;
  h: number;
  a: Color;
  b: Color;
  speed: number;
  /** Where along its run it is at t = 0, 0 to 1. */
  phase: number;
}

export class Life {
  readonly fans: FanList;
  watchers: Watcher[] = [];
  /** Watchers are hidden from this row down (they stand behind a fence). 0: never. */
  watcherClip = 0;
  /** A rope on stakes drawn in front of the watchers (tier 1). */
  rope: {
    y: number;
    x0: number;
    x1: number;
    step: number;
    rope: Color;
    stake: Color;
  } | null = null;
  smoke: Spot[] = [];
  smokeColors: [Color, Color] = [P.mist, P.steel];
  steam: Spot[] = [];
  flags: Flag[] = [];
  crawl: Crawl | null = null;
  washing: Washing | null = null;
  washingPosts: Color = P.wood;
  washingLine: Color = P.chalk;
  /** Birds perched on a rail or a roof edge, and their colour. */
  perched: Spot[] = [];
  perchColor: Color = P.night;
  dog: DogPlan | null = null;
  /** Camera flashes over the crowd: always (tier 6 and 7), or only when it roars. */
  flashes = 0;
  giant: GiantFlag[] = [];
  /** Searchlight beams from the roof (tiers 6 and 7). */
  beams: Spot[] = [];
  beamColor: Color = P.steelHi;
  /** Fireworks over the roof (tier 7): the band they burst in. */
  fireworks: Zone | null = null;
  ticker = false;
  scoreboard: { field: Zone; text: string } | null = null;

  constructor(fanCap: number) {
    this.fans = new FanList(fanCap);
  }
}

// ---------------------------------------------------------------------------
// In the sky, before the layer goes down
// ---------------------------------------------------------------------------

const BEAM_LEN = 120;

export function drawSkyLife(
  s: Surface,
  life: Life,
  t: number,
  seed: number,
): void {
  for (let i = 0; i < life.beams.length; i++) {
    const b = life.beams[i];
    // a slow sweep, each beam on its own phase, stepped at 10 a second
    const tt = Math.floor(t * 10) / 10;
    const ang = Math.sin(tt * 0.45 + i * 2.1) * 0.55 + (i - 1) * 0.25;
    const dx = Math.sin(ang);
    const dy = -Math.cos(ang);
    // a wedge: thin at the lamp, 7 px wide at its end, two coverages
    for (let j = 1; j < BEAM_LEN; j += 1) {
      const f = j / BEAM_LEN;
      const x = Math.round(b.x + dx * j);
      const y = Math.round(b.y + dy * j);
      if (y < 0) break;
      const half = Math.round(1 + f * 6);
      for (let q = -half; q <= half; q++) {
        const px = x + Math.round(-dy * q);
        const py = y + Math.round(dx * q);
        const level = Math.abs(q) <= half / 3 ? 0.5 : 0.25;
        if (bayer4(px, py) < level * (1 - f * 0.6))
          s.px(px, py, life.beamColor);
      }
    }
  }
  const fw = life.fireworks;
  if (fw) drawFireworks(s, fw, t, seed);
}

const BURST_COLORS: readonly Color[] = [
  P.gold,
  P.goldLight,
  P.homeLight,
  P.chalk,
  P.awayLight,
  P.ledGreen,
];

/** Bursts over the roof: one every 0.6 s, each lives 1.5 s; stepped at 12 a second. */
function drawFireworks(s: Surface, z: Zone, t: number, seed: number): void {
  const EVERY = 0.32;
  const LIFE = 1.6;
  const tt = Math.floor(t * 12) / 12;
  const newest = Math.floor(tt / EVERY);
  for (let n = newest; n > newest - Math.ceil(LIFE / EVERY) - 1; n--) {
    const age = tt - n * EVERY;
    if (age < 0 || age >= LIFE) continue;
    const bx = z.x + Math.floor(hash2(n, 1, seed) * z.w);
    const by = z.y + Math.floor(hash2(n, 2, seed) * z.h);
    const c = BURST_COLORS[Math.floor(hash2(n, 3, seed) * BURST_COLORS.length)];
    const c2 =
      BURST_COLORS[Math.floor(hash2(n, 4, seed) * BURST_COLORS.length)];
    const rise = 0.35;
    if (age < rise) {
      // the rocket going up
      const y = Math.round(by + (1 - age / rise) * 26);
      s.px(bx, y, P.goldLight);
      s.px(bx, y + 1, P.amber);
      s.px(bx, y + 2, P.amberDim);
      continue;
    }
    const a = (age - rise) / (LIFE - rise);
    const r = 2 + Math.round(Math.sqrt(a) * (10 + hash2(n, 5, seed) * 9));
    const drop = Math.round(a * a * 6);
    const spokes = 16;
    for (let k = 0; k < spokes; k++) {
      // late in its life a spark is there only some of the time
      if (
        a > 0.6 &&
        hash2(n * 31 + k, Math.floor(tt * 12), seed) < (a - 0.6) * 2.2
      ) {
        continue;
      }
      const ang = (k / spokes) * Math.PI * 2 + n;
      const x = Math.round(bx + Math.cos(ang) * r);
      const y = Math.round(by + Math.sin(ang) * r * 0.9) + drop;
      s.px(x, y, k % 2 === 0 ? c : c2);
      if (a < 0.45) {
        const xi = Math.round(bx + Math.cos(ang) * (r - 2));
        const yi = Math.round(by + Math.sin(ang) * (r - 2) * 0.9) + drop;
        s.px(xi, yi, c);
      }
    }
    if (a < 0.15) s.px(bx, by, P.white);
  }
}

// ---------------------------------------------------------------------------
// Over the layer
// ---------------------------------------------------------------------------

export function drawFarLife(
  s: Surface,
  life: Life,
  t: number,
  seed: number,
  mood: CrowdMood,
  since: number,
): void {
  drawSmoke(s, life, t);
  drawWashing(s, life, t);
  drawPerched(s, life, t, seed);
  drawFans(s, life.fans, mood, since, t);
  for (let i = 0; i < life.giant.length; i++) drawGiant(s, life.giant[i], t);
  drawFlashes(s, life, t, seed, mood, since);
  for (let i = 0; i < life.flags.length; i++) drawFlag(s, life.flags[i], t);
  if (life.crawl) drawCrawl(s, life.crawl, t);
  if (life.scoreboard) {
    const f = life.scoreboard.field;
    drawLedLine(s, life.scoreboard.text, f.x + 1, f.y + 1, f.w - 2, {
      font: FONT_3x5,
      color: P.amber,
      t,
      speed: 10,
    });
  }
  drawWatchers(s, life, t, mood, since);
}

function drawSmoke(s: Surface, life: Life, t: number): void {
  const [light, dark] = life.smokeColors;
  for (let i = 0; i < life.smoke.length; i++) {
    const c = life.smoke[i];
    for (let j = 0; j < 3; j++) {
      // stepped at 5 a second: whole pixels
      const a = (Math.floor(t * 5) / 5 / 4.2 + j / 3 + i * 0.37) % 1;
      const y = c.y - Math.round(a * 15);
      const x = c.x + Math.round(a * a * 7);
      const col = a < 0.5 ? light : dark;
      if (a < 0.25) {
        s.px(x, y, col);
      } else if (a < 0.7) {
        s.rect(x, y, 2, 2, col);
        s.px(x + 1, y, light);
      } else {
        s.px(x, y, col);
        s.px(x + 2, y - 1, col);
      }
    }
  }
  for (let i = 0; i < life.steam.length; i++) {
    const c = life.steam[i];
    for (let j = 0; j < 2; j++) {
      const a = (Math.floor(t * 5) / 5 / 2.4 + j / 2) % 1;
      const y = c.y - Math.round(a * 7);
      const x = c.x + (Math.floor(a * 6) % 2);
      s.px(x, y, light);
      if (a < 0.5) s.px(x, y - 1, light);
    }
  }
}

function drawWashing(s: Surface, life: Life, t: number): void {
  const w = life.washing;
  if (!w) return;
  const step = Math.floor(t * 2.5);
  for (let i = 0; i < w.items.length; i++) {
    const it = w.items[i];
    // the wind lifts the hem a pixel, one item after another
    const flap = (step + i) % 3;
    const h = flap === 2 ? it.h - 1 : it.h;
    s.rect(it.x, w.y + 1, it.w, h - 1, it.c);
    s.hline(it.x, w.y + h, it.w, it.low);
    if (flap === 1) s.px(it.x + it.w, w.y + h - 1, it.c);
    s.px(it.x, w.y, life.washingPosts);
  }
}

function drawPerched(s: Surface, life: Life, t: number, seed: number): void {
  const c = life.perchColor;
  for (let i = 0; i < life.perched.length; i++) {
    const b = life.perched[i];
    const beat = Math.floor(t * 2 + i * 3);
    const hop = hash2(beat, i, seed) < 0.12 ? 1 : 0;
    const peck = hash2(beat, i + 9, seed) < 0.3;
    const dx = Math.floor(hash2(Math.floor(t / 4), i, seed) * 3) - 1;
    const x = b.x + dx;
    const y = b.y - hop;
    s.rect(x, y - 2, 2, 2, c);
    s.px(peck ? x + 2 : x + 1, peck ? y - 1 : y - 3, c);
  }
}

function drawFlag(s: Surface, f: Flag, t: number): void {
  s.vline(f.x, f.top, f.poleH, f.pole);
  const frame = Math.floor(t * 3 + f.phase) % 3;
  const x = f.x + 1;
  for (let i = 0; i < f.w; i++) {
    // a ripple runs out along the cloth
    const dy = frame === 0 ? 0 : (i + frame) % 3 === 0 ? 1 : 0;
    const c = i < f.w / 2 ? f.a : f.b;
    s.vline(x + i, f.top + dy, f.h, c);
  }
}

function drawCrawl(s: Surface, c: Crawl, t: number): void {
  const sw = c.strip.w;
  if (sw <= 0) return;
  const off = Math.floor(t * c.speed) % sw;
  s.pushClip(c.x0, c.y, c.x1 - c.x0, c.strip.h);
  s.copy(c.strip, c.x0 - off, c.y);
  s.copy(c.strip, c.x0 - off + sw, c.y);
  if (c.x0 - off + 2 * sw < c.x1) s.copy(c.strip, c.x0 - off + 2 * sw, c.y);
  s.popClip();
}

function drawGiant(s: Surface, f: GiantFlag, t: number): void {
  const span = f.x1 - f.x0 + f.w;
  const x = f.x0 - f.w + (Math.floor(t * f.speed + f.phase * span) % span);
  const step = Math.floor(t * 4);
  s.pushClip(f.x0, 0, f.x1 - f.x0, s.h);
  for (let i = 0; i < f.w; i++) {
    // hands push it up in waves as it passes over heads
    const lift = (i + step) % 8 < 3 ? 1 : 0;
    const top = f.y - lift;
    const band = Math.floor((i * 3) / f.w);
    const c = band === 1 ? f.b : f.a;
    s.vline(x + i, top, f.h, c);
    if ((i + step) % 8 === 1) s.px(x + i, top, P.white);
  }
  s.popClip();
}

function drawFlashes(
  s: Surface,
  life: Life,
  t: number,
  seed: number,
  mood: CrowdMood,
  since: number,
): void {
  const fans = life.fans;
  if (fans.n === 0) return;
  let count = life.flashes;
  if (mood === "roar" || mood === "cheer" || mood === "party") {
    if (since >= 0 && since < 4) count += 14;
  }
  const tick = Math.floor(t * 10);
  for (let i = 0; i < count; i++) {
    const k = Math.floor(hash2(tick, i, seed + 5) * fans.n);
    const x = fans.x[k];
    const y = fans.y[k];
    s.px(x + 1, y, P.white);
    if (hash2(tick, i, seed + 6) < 0.3) {
      s.px(x, y, P.goldLight);
      s.px(x + 2, y, P.goldLight);
    }
  }
}

function drawWatchers(
  s: Surface,
  life: Life,
  t: number,
  mood: CrowdMood,
  since: number,
): void {
  if (life.watchers.length === 0) return;
  if (life.watcherClip > 0) s.pushClip(0, 0, s.w, life.watcherClip);
  for (let i = 0; i < life.watchers.length; i++) {
    const w = life.watchers[i];
    const pose = poseFor(
      mood,
      since,
      t,
      w.withHero,
      w.period,
      w.offset,
      w.scarfA !== TRANSPARENT,
    );
    drawWatcher(s, w, pose);
  }
  if (life.watcherClip > 0) s.popClip();
  const r = life.rope;
  if (r) drawRope(s, r.x0, r.x1, r.y, r.step, r.rope, r.stake);
}

/** A rope on stakes: the stakes `step` apart, the rope sagging a pixel between them. */
export function drawRope(
  s: Surface,
  x0: number,
  x1: number,
  y: number,
  step: number,
  rope: Color,
  stake: Color,
): void {
  for (let x = x0; x < x1; x++) {
    const m = (((x - x0) % step) + step) % step;
    const sag = m > step / 4 && m < (step * 3) / 4 ? 1 : 0;
    s.px(x, y + sag, rope);
  }
  for (let x = x0; x < x1; x += step) s.vline(x, y - 1, 5, stake);
}

// ---------------------------------------------------------------------------
// The near side: the dog
// ---------------------------------------------------------------------------

export function drawNearLife(
  s: Surface,
  life: Life,
  t: number,
  mood: CrowdMood,
  since: number,
): void {
  const d = life.dog;
  if (!d) return;
  const happy =
    (mood === "cheer" || mood === "roar" || mood === "party") &&
    since >= 0 &&
    since < 3;
  const hop = happy && Math.floor(t * 6) % 2 === 0 ? 2 : 0;
  if (!d.roam) {
    const wag = Math.floor(t * 4) % 2;
    drawSprite(s, DOG, DOG_SIT + wag, d.x0, d.y - hop, d.colors, {
      anchor: "bottom-center",
    });
    return;
  }
  // trot one way, sit and look about, trot back, sit again
  const L = Math.max(1, d.x1 - d.x0);
  const v = 9;
  const walk = L / v;
  const sit = 3.5;
  const cycle = 2 * walk + 2 * sit;
  const ts = Math.floor(t * 8) / 8;
  const c = ((ts % cycle) + cycle) % cycle;
  let x: number;
  let frame: number;
  let flip = false;
  if (c < walk) {
    x = d.x0 + Math.round(c * v);
    frame = DOG_TROT + (Math.floor(ts * 6) % 2);
  } else if (c < walk + sit) {
    x = d.x1;
    frame = happy ? DOG_STAND : DOG_SIT + (Math.floor(ts * 4) % 2);
  } else if (c < 2 * walk + sit) {
    x = d.x1 - Math.round((c - walk - sit) * v);
    frame = DOG_TROT + (Math.floor(ts * 6) % 2);
    flip = true;
  } else {
    x = d.x0;
    frame = happy ? DOG_STAND : DOG_SIT + (Math.floor(ts * 4) % 2);
    flip = true;
  }
  drawSprite(s, DOG, frame, x, d.y - hop, d.colors, {
    anchor: "bottom-center",
    flipX: flip,
  });
}

// ---------------------------------------------------------------------------
// In front of everything: ticker tape
// ---------------------------------------------------------------------------

const TAPE: readonly Color[] = [P.chalk, P.gold, P.home, P.white, P.goldLight];

export function drawTicker(s: Surface, t: number, seed: number): void {
  const n = Math.round((s.w * s.h) / 260);
  const tt = Math.floor(t * 10) / 10;
  for (let i = 0; i < n; i++) {
    const x0 = hash2(i, 1, seed) * s.w;
    const speed = 9 + hash2(i, 2, seed) * 10;
    const y =
      Math.floor((hash2(i, 3, seed) * (s.h + 20) + tt * speed) % (s.h + 20)) -
      10;
    const sway = Math.round(Math.sin(tt * 2 + i) * 2);
    const x = Math.floor(x0) + sway;
    const c = TAPE[i % TAPE.length];
    if ((Math.floor(tt * 5) + i) % 2 === 0) s.hline(x, y, 2, c);
    else s.px(x, y, c);
  }
}

/** The fans in the list right now: for tests. */
export function activeFans(
  life: Life,
  mood: CrowdMood,
  since: number,
  t: number,
): number {
  let n = 0;
  const f = life.fans;
  for (let k = 0; k < f.n; k++) {
    if (
      poseFor(
        mood,
        since,
        t,
        f.side[k] === 1,
        f.period[k],
        f.offset[k],
        f.scarfA[k] !== 0,
      ) !== REST
    ) {
      n++;
    }
  }
  return n;
}
