/**
 * The moving things of a career ground. A build of the static layer fills a `Life` with
 * what this tier has (smoke, flags, the crowd, the dog...), already in final colours, and
 * the frame loop draws them over the layer. Nothing here allocates while drawing (the
 * shades are cached by colour).
 */

import type { Zone } from "~/art/layout";
import { drawLedLine } from "~/art/led";
import { P } from "~/art/palette";
import {
  FONT_3x5,
  Surface,
  TRANSPARENT,
  bayer4,
  hash2,
  shade,
  type Color,
} from "~/pixel";
import {
  DOG_SIT,
  DOG_STAND,
  DOG_TROT,
  FanList,
  REST,
  drawDog,
  drawFans,
  drawFlash,
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
  /** It moves this many pixels at a time (one lamp of an LED board: 2 px). Default 1. */
  step?: number;
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

/**
 * An era's own moving things (.snaps/era-art/THEME.md, "Grounds: movers"): `sky` is drawn
 * behind the layer, after the sky (it shows only through the layer's holes: things far
 * off, behind everything the ground built); `far` over the layer, after the watchers. Made
 * once per build; drawing must allocate nothing.
 */
export interface Mover {
  sky?(s: Surface, t: number): void;
  far?(s: Surface, t: number): void;
  /** Called once when the build is done, with the finished layer: what can be seen. */
  seen?(layer: Surface): void;
}

export class Life {
  readonly fans: FanList;
  /** An era's moving things (`Mover`); none for today's look. */
  movers: Mover[] = [];
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
  /** The scoreboard's field and words; `color` its lamps' (amber unless an era says). */
  scoreboard: { field: Zone; text: string; color?: Color } | null = null;

  constructor(fanCap: number) {
    this.fans = new FanList(fanCap);
  }
}

/** A colour's shade for the side away from the light, cached so drawing allocates nothing. */
const lows = new Map<Color, Color>();
function lo(c: Color): Color {
  let v = lows.get(c);
  if (v === undefined) {
    v = shade(c, -0.22);
    lows.set(c, v);
  }
  return v;
}

// ---------------------------------------------------------------------------
// In the sky: beams and fireworks
// ---------------------------------------------------------------------------

const BEAM_LEN = 240;

export function drawSkyLife(
  s: Surface,
  life: Life,
  t: number,
  seed: number,
): void {
  for (let i = 0; i < life.movers.length; i++) life.movers[i].sky?.(s, t);
  for (let i = 0; i < life.beams.length; i++) {
    const b = life.beams[i];
    const tt = Math.floor(t * 10) / 10;
    const ang = Math.sin(tt * 0.45 + i * 2.1) * 0.55 + (i - 1) * 0.25;
    const dx = Math.sin(ang);
    const dy = -Math.cos(ang);
    // a wedge in three bands, 6 px wide at the lamp and 38 at its end: a bright core (solid
    // near the lamp, thinning out along the beam), a dithered body, and a soft blue halo
    // round both, so it reads as a shaft of light and not a dotted line
    for (let j = 1; j < BEAM_LEN; j++) {
      const f = j / BEAM_LEN;
      const x = Math.round(b.x + dx * j);
      const y = Math.round(b.y + dy * j);
      if (y < 0) break;
      const half = 3 + f * 16;
      const reach = Math.ceil(half);
      for (let q = -reach; q <= reach; q++) {
        const px = x + Math.round(-dy * q);
        const py = y + Math.round(dx * q);
        const a = Math.abs(q) / half;
        if (a > 1) continue;
        const d = bayer4(px, py);
        if (a <= 0.3) {
          if (d < 1 - f * 0.85) s.px(px, py, life.beamColor);
          else s.px(px, py, P.nightGlow);
        } else if (a <= 0.65) {
          if (d < 0.5 * (1 - f * 0.7)) s.px(px, py, life.beamColor);
          else if (d < 0.75) s.px(px, py, P.nightGlow);
        } else if (d < 0.5 * (1 - f * 0.5)) {
          s.px(px, py, P.nightGlow);
        }
      }
    }
    // the lamp itself on the roof's edge
    s.px(b.x, b.y - 1, P.white);
    s.px(b.x + 1, b.y - 1, P.white);
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

/** The fainter colour each spark's tail fades to. */
const TAIL: ReadonlyMap<Color, Color> = new Map<Color, Color>([
  [P.gold, P.goldDark],
  [P.goldLight, P.gold],
  [P.homeLight, P.home],
  [P.chalk, P.mist],
  [P.awayLight, P.away],
  [P.ledGreen, P.grassLight],
]);

/**
 * Bursts over the roof (one every 0.32 s, each lives 1.6 s, stepped at 12 a second): a
 * rocket with a fading trail, 24 sparks with tails, an inner ring
 * of the second colour while it is young, a flash at its heart.
 */
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
      // the rocket going up, wobbling a little, its trail fading behind it
      const y = Math.round(by + (1 - age / rise) * 52);
      const wob = Math.floor(tt * 12) & 1;
      s.px(bx, y, P.white);
      s.px(bx, y + 1, P.goldLight);
      s.px(bx, y + 2, P.goldLight);
      s.px(bx + wob, y + 3, P.amber);
      s.px(bx, y + 4, P.amber);
      s.px(bx - wob, y + 6, P.amberDim);
      s.px(bx, y + 8, P.amberDim);
      continue;
    }
    const a = (age - rise) / (LIFE - rise);
    const r = 4 + Math.round(Math.sqrt(a) * (20 + hash2(n, 5, seed) * 18));
    const drop = Math.round(a * a * 12);
    const tail = a < 0.5 ? 3 : a < 0.75 ? 1 : 0;
    const spokes = 24;
    for (let k = 0; k < spokes; k++) {
      if (
        a > 0.6 &&
        hash2(n * 31 + k, Math.floor(tt * 12), seed) < (a - 0.6) * 2.2
      ) {
        continue;
      }
      const ang = (k / spokes) * Math.PI * 2 + n;
      const ca = Math.cos(ang);
      const sa = Math.sin(ang) * 0.9;
      const col = k % 2 === 0 ? c : c2;
      // the tail, then the spark at its head
      for (let q = tail; q >= 1; q--) {
        const rr = r - q * 2;
        s.px(
          Math.round(bx + ca * rr),
          Math.round(by + sa * rr) + drop,
          TAIL.get(col) ?? col,
        );
      }
      // a young spark is a 2 x 2 star, an old one a single fading pixel
      const hx = Math.round(bx + ca * r);
      const hy = Math.round(by + sa * r) + drop;
      s.px(hx, hy, col);
      if (a < 0.5) {
        s.px(hx + 1, hy, col);
        s.px(hx, hy + 1, col);
        s.px(hx + 1, hy + 1, TAIL.get(col) ?? col);
      }
      if (a < 0.45 && (k & 1) === 0) {
        const ri = Math.round(r * 0.55);
        s.px(Math.round(bx + ca * ri), Math.round(by + sa * ri) + drop, c2);
      }
    }
    if (a < 0.15) {
      s.px(bx, by, P.white);
      s.px(bx + 1, by, P.white);
      s.px(bx, by + 1, P.white);
      s.px(bx + 1, by + 1, P.white);
      s.px(bx - 1, by, P.goldLight);
      s.px(bx + 2, by + 1, P.goldLight);
      s.px(bx + 1, by - 1, P.goldLight);
      s.px(bx, by + 2, P.goldLight);
    }
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
    drawLedLine(s, life.scoreboard.text, f.x + 2, f.y + 2, f.w - 4, {
      font: FONT_3x5,
      color: life.scoreboard.color ?? P.amber,
      t,
      speed: 10,
    });
  }
  drawWatchers(s, life, t, mood, since);
  for (let i = 0; i < life.movers.length; i++) life.movers[i].far?.(s, t);
}

/**
 * Chimney smoke: three puffs per chimney rising 30 px and drifting 14 px to the right as
 * they go, a 2 x 2 wisp at the pot, a growing round puff lit on its top left, then broken
 * wisps. The tea hut's steam: small puffs rising 14 px with a wiggle.
 */
export function drawSmoke(s: Surface, life: Life, t: number): void {
  const [light, dark] = life.smokeColors;
  const tt = Math.floor(t * 5) / 5;
  for (let i = 0; i < life.smoke.length; i++) {
    const c = life.smoke[i];
    for (let j = 0; j < 3; j++) {
      const a = (tt / 4.2 + j / 3 + i * 0.37) % 1;
      const y = c.y - Math.round(a * 30);
      const x = c.x + Math.round(a * a * 14);
      const col = a < 0.5 ? light : dark;
      if (a < 0.18) {
        s.rect(x, y - 1, 2, 2, light);
      } else if (a < 0.42) {
        // a small round puff
        s.hline(x + 1, y - 2, 2, light);
        s.rect(x, y - 1, 4, 2, col);
        s.px(x, y - 1, light);
        s.hline(x + 1, y + 1, 2, col);
      } else if (a < 0.72) {
        // grown: 6 wide, rounded, lit on its top left
        s.hline(x + 1, y - 3, 4, light);
        s.rect(x, y - 2, 6, 3, col);
        s.hline(x + 1, y + 1, 4, dark);
        s.hline(x, y - 2, 3, light);
        s.px(x, y - 1, light);
      } else {
        // breaking up into wisps
        s.rect(x, y - 1, 2, 2, col);
        s.hline(x + 4, y - 3, 2, col);
        s.px(x + 3, y + 1, col);
      }
    }
  }
  for (let i = 0; i < life.steam.length; i++) {
    const c = life.steam[i];
    for (let j = 0; j < 2; j++) {
      const a = (tt / 2.4 + j / 2) % 1;
      const y = c.y - Math.round(a * 14);
      const x = c.x + (Math.floor(a * 6) % 2);
      s.rect(x, y - 1, 2, 2, light);
      if (a < 0.5) {
        s.px(x + 1, y - 2, light);
        s.px(x, y - 3, light);
      }
    }
  }
}

/**
 * The washing: a shirt with its sleeves out, a towel with a stripe, a sock, each pegged
 * to the line. The wind lifts each hem 2 px in turn and flicks a corner out.
 */
export function drawWashing(s: Surface, life: Life, t: number): void {
  const w = life.washing;
  if (!w) return;
  const step = Math.floor(t * 2.5);
  const peg = life.washingPosts;
  for (let i = 0; i < w.items.length; i++) {
    const it = w.items[i];
    const flap = (step + i) % 3;
    const h = flap === 2 ? it.h - 2 : it.h;
    const y = w.y + 1;
    const kind = i % 3;
    if (kind === 0) {
      // a shirt: shoulders and sleeves, a collar, the body, its hem
      s.rect(it.x, y, it.w, 3, it.c);
      s.rect(it.x - 2, y + 1, 2, 3, it.c);
      s.rect(it.x + it.w, y + 1, 2, 3, it.c);
      s.px(it.x - 2, y + 3, it.low);
      s.px(it.x + it.w + 1, y + 3, it.low);
      s.rect(it.x + 1, y + 3, it.w - 2, h - 4, it.c);
      s.hline(it.x + 3, y, it.w - 6, it.low);
      s.vline(it.x + (it.w >> 1), y + 2, h - 4, it.low);
      s.hline(it.x + 1, y + h - 1, it.w - 2, it.low);
      if (flap === 1) s.px(it.x + it.w - 1, y + h - 2, it.c);
    } else if (kind === 1) {
      // a towel: a stripe near the hem, a corner lifting
      s.rect(it.x, y, it.w, h - 1, it.c);
      s.hline(it.x, y + h - 4, it.w, it.low);
      s.hline(it.x, y + h - 1, it.w, it.low);
      s.vline(it.x + it.w - 1, y + 1, h - 2, it.low);
      if (flap === 1) {
        s.px(it.x + it.w, y + h - 2, it.c);
        s.px(it.x + it.w, y + h - 3, it.c);
      }
    } else {
      // a sock: the leg, the heel, the foot turned out
      s.rect(it.x, y, 2, h - 2, it.c);
      s.hline(it.x, y + h - 2, it.w, it.c);
      s.hline(it.x, y + h - 1, it.w, it.low);
      s.px(it.x + 1, y, it.low);
    }
    // the pegs
    s.px(it.x, w.y, peg);
    s.px(it.x + Math.max(1, it.w - 1), w.y, peg);
  }
}

/** One pixel of a bird facing `dir` (1 right, -1 left) from its body's corner `x`. */
function bpx(
  s: Surface,
  x: number,
  dir: number,
  dx: number,
  y: number,
  c: Color,
): void {
  s.px(x + dir * dx, y, c);
}

/**
 * Birds perched on a rail or a roof edge: a sparrow or a pigeon 7 x 7, a round body with a
 * light breast, a head with a beak, a tail, feet on the row above `y`; each hops 2 px now
 * and then, pecks, and shuffles along.
 */
export function drawPerched(
  s: Surface,
  life: Life,
  t: number,
  seed: number,
): void {
  const c = life.perchColor;
  const lit = shade(c, 0.28);
  const low = shade(c, -0.3);
  for (let i = 0; i < life.perched.length; i++) {
    const b = life.perched[i];
    const beat = Math.floor(t * 2 + i * 3);
    const hop = hash2(beat, i, seed) < 0.12 ? 2 : 0;
    const peck = hash2(beat, i + 9, seed) < 0.3;
    const dx = Math.floor(hash2(Math.floor(t / 4), i, seed) * 5) - 2;
    const dir = (i & 1) === 0 ? 1 : -1;
    const x = b.x + dx;
    const y = b.y - hop;
    // the body
    for (let k = 0; k < 4; k++) bpx(s, x, dir, k, y - 4, c);
    for (let k = -1; k < 4; k++) bpx(s, x, dir, k, y - 3, c);
    for (let k = 0; k < 4; k++) bpx(s, x, dir, k, y - 2, k >= 2 ? lit : c);
    bpx(s, x, dir, 1, y - 4, lit);
    // the tail, the feet
    bpx(s, x, dir, -2, y - 3, low);
    bpx(s, x, dir, -2, y - 4, low);
    bpx(s, x, dir, 1, y - 1, low);
    bpx(s, x, dir, 3, y - 1, low);
    if (peck) {
      // head down at the ground in front
      bpx(s, x, dir, 4, y - 3, c);
      bpx(s, x, dir, 4, y - 2, c);
      bpx(s, x, dir, 5, y - 2, c);
      bpx(s, x, dir, 6, y - 1, low);
    } else {
      bpx(s, x, dir, 2, y - 6, c);
      bpx(s, x, dir, 3, y - 6, c);
      bpx(s, x, dir, 2, y - 5, c);
      bpx(s, x, dir, 3, y - 5, c);
      bpx(s, x, dir, 4, y - 5, c);
      bpx(s, x, dir, 5, y - 5, low);
      bpx(s, x, dir, 3, y - 6, low);
    }
  }
}

/**
 * A flag on a pole 2 px thick: a gold finial, the cloth hanging right with a ripple that
 * runs out along it (3 frames, 3 a second), its troughs in shade.
 */
function drawFlag(s: Surface, f: Flag, t: number): void {
  s.vline(f.x, f.top, f.poleH, f.pole);
  s.vline(f.x + 1, f.top, f.poleH, lo(f.pole));
  s.px(f.x, f.top - 1, P.goldLight);
  s.px(f.x + 1, f.top - 1, P.gold);
  const frame = Math.floor(t * 3 + f.phase) % 3;
  const x = f.x + 2;
  for (let i = 0; i < f.w; i++) {
    // a wave of 6 columns, moving out by 2 a frame; still at the hoist
    const k = (((i - frame * 2) % 6) + 6) % 6;
    const dy = i < 2 ? 0 : k < 2 ? 0 : k < 4 ? 1 : k < 5 ? 2 : 1;
    const c = i < f.w / 2 ? f.a : f.b;
    s.vline(x + i, f.top + dy, f.h, dy === 2 ? lo(c) : c);
  }
}

/** A colour's lit side, cached like `lo`. */
const his = new Map<Color, Color>();
function hi(c: Color): Color {
  let v = his.get(c);
  if (v === undefined) {
    v = shade(c, 0.14);
    his.set(c, v);
  }
  return v;
}

/**
 * A giant flag passed over heads: three bands along it, lifted in waves by the hands under
 * it (16-column waves, 2 px high, 4 steps a second). The cloth billows: its folds run on a
 * slant from each lifted crest down and back (lit on the crest, shaded in the hollow behind
 * it), so they read as cloth moving and not as stripes; a white glint along each crest and
 * a hem in shade along its foot.
 */
function drawGiant(s: Surface, f: GiantFlag, t: number): void {
  const span = f.x1 - f.x0 + f.w;
  const x = f.x0 - f.w + (Math.floor(t * f.speed + f.phase * span) % span);
  const step = Math.floor(t * 4) * 2;
  s.pushClip(f.x0, 0, f.x1 - f.x0, s.h);
  for (let i = 0; i < f.w; i++) {
    const k = (i + step) % 16;
    const lift = k < 5 ? 2 : k < 7 || k > 14 ? 1 : 0;
    const top = f.y - lift;
    const band = Math.floor((i * 3) / f.w);
    const c = band === 1 ? f.b : f.a;
    for (let r = 0; r < f.h; r++) {
      // the fold at this pixel: the crest's place, slanting back half a column a row
      const kk = (((i + step - Math.floor(r / 3)) % 16) + 16) % 16;
      const tone = kk < 3 ? hi(c) : kk >= 9 && kk < 12 ? lo(c) : c;
      s.px(x + i, top + r, r === f.h - 1 ? lo(c) : tone);
    }
    if (k === 1 || k === 2) s.px(x + i, top, P.white);
  }
  s.popClip();
}

function drawCrawl(s: Surface, c: Crawl, t: number): void {
  const sw = c.strip.w;
  if (sw <= 0) return;
  const step = c.step ?? 1;
  const off = (Math.floor((t * c.speed) / step) * step) % sw;
  s.pushClip(c.x0, c.y, c.x1 - c.x0, c.strip.h);
  s.copy(c.strip, c.x0 - off, c.y);
  s.copy(c.strip, c.x0 - off + sw, c.y);
  if (c.x0 - off + 2 * sw < c.x1) s.copy(c.strip, c.x0 - off + 2 * sw, c.y);
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
    // a 2 x 2 flash at the face, gold glints round it
    drawFlash(s, x, y, hash2(tick, i, seed + 6) < 0.3);
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

/**
 * A rope on stakes: a 2 px rope lit on top, sagging 2 px between stakes 2 px
 * wide and 10 tall, lit on their left, with a knot where the rope meets each one.
 */
export function drawRope(
  s: Surface,
  x0: number,
  x1: number,
  y: number,
  step: number,
  rope: Color,
  stake: Color,
): void {
  const ropeLow = shade(rope, -0.28);
  const stakeLit = shade(stake, 0.25);
  const stakeLow = shade(stake, -0.3);
  for (let x = x0; x < x1; x++) {
    const m = (((x - x0) % step) + step) % step;
    const q = m / step;
    const sag = q > 0.22 && q < 0.78 ? 2 : q > 0.1 && q < 0.9 ? 1 : 0;
    s.px(x, y + sag, rope);
    s.px(x, y + sag + 1, ropeLow);
  }
  for (let x = x0; x < x1; x += step) {
    s.vline(x, y - 2, 10, stakeLit);
    s.vline(x + 1, y - 2, 10, stake);
    s.px(x + 1, y + 7, stakeLow);
    s.hline(x, y - 3, 2, stakeLit);
    s.px(x + 2, y, rope);
    s.px(x + 2, y + 1, ropeLow);
  }
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
  // the 18 x 12 dog (people.ts)
  const hop = happy && Math.floor(t * 6) % 2 === 0 ? 4 : 0;
  if (!d.roam) {
    const wag = Math.floor(t * 4) % 2;
    drawDog(s, DOG_SIT + wag, d.x0, d.y - hop, d.colors, false);
    return;
  }
  // trot one way, sit and look about, trot back, sit again
  const L = Math.max(1, d.x1 - d.x0);
  const v = 18;
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
  drawDog(s, frame, x, d.y - hop, d.colors, flip);
}

// ---------------------------------------------------------------------------
// In front of everything: ticker tape
// ---------------------------------------------------------------------------

const TAPE: readonly Color[] = [P.chalk, P.gold, P.home, P.white, P.goldLight];
const TAPE_LO: readonly Color[] = [
  P.mist,
  P.goldDark,
  P.homeDark,
  P.chalk,
  P.gold,
];

/**
 * Ticker tape: about one piece for every 1040 px of the canvas, falling at 18 to 38 px a second and swaying 4 px, each a strip 4 px long that
 * tumbles through four frames (flat, turning, edge on, turning back) with its underside in
 * shade.
 */
export function drawTicker(s: Surface, t: number, seed: number): void {
  const n = Math.round((s.w * s.h) / 1040);
  const tt = Math.floor(t * 10) / 10;
  for (let i = 0; i < n; i++) {
    const x0 = hash2(i, 1, seed) * s.w;
    const speed = 18 + hash2(i, 2, seed) * 20;
    const y =
      Math.floor((hash2(i, 3, seed) * (s.h + 40) + tt * speed) % (s.h + 40)) -
      20;
    const sway = Math.round(Math.sin(tt * 2 + i) * 4);
    const x = Math.floor(x0) + sway;
    const c = TAPE[i % TAPE.length];
    const d = TAPE_LO[i % TAPE.length];
    switch ((Math.floor(tt * 5) + i) % 4) {
      case 0:
        s.hline(x, y, 3, c);
        s.px(x + 3, y, d);
        break;
      case 1:
        s.px(x, y, c);
        s.px(x + 1, y + 1, c);
        s.px(x + 2, y + 2, d);
        break;
      case 2:
        s.hline(x + 1, y, 2, d);
        break;
      default:
        s.px(x + 2, y, d);
        s.px(x + 1, y + 1, c);
        s.px(x, y + 2, c);
    }
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
