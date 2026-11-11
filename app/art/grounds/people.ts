/**
 * The people of the career ground who are not the cast: the crowd in the stands (3 x 4
 * fans, art bible section 4), the people standing to watch at the small grounds, the
 * people seen from behind on the near side, and the dog.
 *
 * The crowd is painted at rest into the cached layer. Each frame only the fans that are
 * doing something (a bob, a jump, hands on heads, a scarf held up) are painted again over
 * it, so a still crowd costs nothing and a roaring one a few thousand pixels.
 */

import { FAN } from "~/art/layout";
import { P } from "~/art/palette";
import { TRANSPARENT, shade, sprite, type Color, type Sprite } from "~/pixel";
import type { Surface } from "~/pixel";
import type { CrowdMood } from "./types";

// ---------------------------------------------------------------------------
// Reactions
// ---------------------------------------------------------------------------

/** What one person is doing this frame. */
export const REST = 0;
export const BOB = 1; // up a pixel
export const JUMP = 2; // up a pixel, arms up
export const HANDS = 3; // hands on head
export const SCARF = 4; // up a pixel, a scarf held over the head
export const ARMS = 5; // arms up, feet down
export type Pose = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * The pose of one person, from the mood, the seconds since it was set, the scene time,
 * whether they want the hero to score, their own rhythm (`period` 9 to 22 half-seconds,
 * `offset`), and whether they have a scarf.
 */
export function poseFor(
  mood: CrowdMood,
  since: number,
  t: number,
  withHero: boolean,
  period: number,
  offset: number,
  scarf: boolean,
): Pose {
  // The other side's fans feel the opposite.
  let m = mood;
  if (!withHero) {
    if (m === "cheer" || m === "roar") m = "groan";
    else if (m === "groan") m = "cheer";
  }
  // Nobody reacts on the same frame: a ripple of a fifth of a second.
  const s = since - (offset % 5) * 0.05;
  const tick2 = Math.floor(t * 2);
  const tick8 = Math.floor(t * 8);
  const idleBob = (tick2 + offset) % period === 0 ? BOB : REST;
  const excited =
    (tick2 + offset) % Math.max(2, period >> 2) === 0 ? BOB : REST;
  if (s < 0) return idleBob;
  switch (m) {
    case "idle":
      return idleBob;
    case "hush":
      return REST;
    case "ooh":
      if (s < 1.9) return offset % 10 < 7 ? HANDS : BOB;
      return idleBob;
    case "groan":
      if (s < 2.2) return offset % 2 === 0 ? HANDS : REST;
      return idleBob;
    case "cheer":
      if (s < 2.6 + (offset % 7) * 0.12) {
        return ((tick8 + offset) >> 1) % 2 === 0 ? JUMP : ARMS;
      }
      if (s < 6) return scarf ? SCARF : excited;
      return idleBob;
    case "roar":
      if (s < 4.5 + (offset % 7) * 0.15) {
        if (scarf) return SCARF;
        return ((tick8 + offset) >> 1) % 2 === 0 ? JUMP : ARMS;
      }
      if (s < 9) return scarf ? SCARF : excited;
      return idleBob;
    case "party":
      if (scarf) return (tick2 + offset) % 4 === 0 ? ARMS : SCARF;
      return ((tick8 + offset) >> 1) % 3 === 0 ? ARMS : JUMP;
  }
}

// ---------------------------------------------------------------------------
// The crowd: 3 x 4 fans
// ---------------------------------------------------------------------------

export class FanList {
  n = 0;
  readonly x: Int16Array;
  readonly y: Int16Array;
  readonly head: Uint32Array;
  readonly body: Uint32Array;
  readonly low: Uint32Array;
  /** What shows where the fan's feet were when they stand up. */
  readonly seat: Uint32Array;
  readonly hand: Uint32Array;
  /** A scarf's two colours (0 for none). */
  readonly scarfA: Uint32Array;
  readonly scarfB: Uint32Array;
  readonly period: Uint8Array;
  readonly offset: Uint8Array;
  /** 1 wants the hero to score. */
  readonly side: Uint8Array;

  constructor(cap: number) {
    this.x = new Int16Array(cap);
    this.y = new Int16Array(cap);
    this.head = new Uint32Array(cap);
    this.body = new Uint32Array(cap);
    this.low = new Uint32Array(cap);
    this.seat = new Uint32Array(cap);
    this.hand = new Uint32Array(cap);
    this.scarfA = new Uint32Array(cap);
    this.scarfB = new Uint32Array(cap);
    this.period = new Uint8Array(cap);
    this.offset = new Uint8Array(cap);
    this.side = new Uint8Array(cap);
  }

  get cap(): number {
    return this.x.length;
  }
}

export interface FanLook {
  head: Color;
  body: Color;
  hand: Color;
  seat: Color;
  scarfA: Color;
  scarfB: Color;
  period: number;
  offset: number;
  withHero: boolean;
}

/** Paint a fan at rest with the top of their head at (x + 1, y), and remember them. */
export function paintFan(
  s: Surface,
  fans: FanList | null,
  x: number,
  y: number,
  f: FanLook,
): void {
  const low = shade(f.body, -0.3);
  s.px(x + 1, y, f.head);
  s.rect(x, y + 1, FAN.w, 2, f.body);
  s.hline(x, y + 3, FAN.w, low);
  if (fans && fans.n < fans.cap) {
    const k = fans.n++;
    fans.x[k] = x;
    fans.y[k] = y;
    fans.head[k] = f.head;
    fans.body[k] = f.body;
    fans.low[k] = low;
    fans.seat[k] = f.seat;
    fans.hand[k] = f.hand;
    fans.scarfA[k] = f.scarfA;
    fans.scarfB[k] = f.scarfB;
    fans.period[k] = f.period;
    fans.offset[k] = f.offset;
    fans.side[k] = f.withHero ? 1 : 0;
  }
}

/** Paint the fans who are doing something this frame over the layer's resting crowd. */
export function drawFans(
  s: Surface,
  fans: FanList,
  mood: CrowdMood,
  since: number,
  t: number,
): void {
  const n = fans.n;
  for (let k = 0; k < n; k++) {
    const pose = poseFor(
      mood,
      since,
      t,
      fans.side[k] === 1,
      fans.period[k],
      fans.offset[k],
      fans.scarfA[k] !== 0,
    );
    if (pose === REST) continue;
    const x = fans.x[k];
    const y = fans.y[k];
    const body = fans.body[k] as Color;
    const hand = fans.hand[k] as Color;
    if (pose === HANDS) {
      s.px(x, y, hand);
      s.px(x + 2, y, hand);
      continue;
    }
    if (pose === ARMS) {
      s.px(x, y - 1, hand);
      s.px(x + 2, y - 1, hand);
      s.px(x, y, body);
      s.px(x + 2, y, body);
      continue;
    }
    // up a pixel: the seat shows under them
    s.px(x + 1, y - 1, fans.head[k] as Color);
    s.rect(x, y, FAN.w, 2, body);
    s.hline(x, y + 2, FAN.w, fans.low[k] as Color);
    s.hline(x, y + 3, FAN.w, fans.seat[k] as Color);
    if (pose === JUMP) {
      s.px(x, y - 2, hand);
      s.px(x + 2, y - 2, hand);
      s.px(x, y - 1, body);
      s.px(x + 2, y - 1, body);
    } else if (pose === SCARF) {
      const a = fans.scarfA[k] as Color;
      const b = fans.scarfB[k] as Color;
      // held up at arm's length, a stripe of each colour
      s.px(x - 1, y - 2, a);
      s.px(x, y - 2, b);
      s.px(x + 1, y - 2, a);
      s.px(x + 2, y - 2, b);
      s.px(x + 3, y - 2, a);
      s.px(x - 1, y - 1, hand);
      s.px(x + 3, y - 1, hand);
    }
  }
}

// ---------------------------------------------------------------------------
// People standing to watch (tiers 0 to 2), seen from the front across the pitch
// ---------------------------------------------------------------------------

export interface Watcher {
  /** The middle column and the row under their feet. */
  x: number;
  y: number;
  kid: boolean;
  hair: Color;
  skin: Color;
  coat: Color;
  coatLow: Color;
  legs: Color;
  period: number;
  offset: number;
  withHero: boolean;
  /** A scarf in two colours (for `roar` and `party`), or TRANSPARENT for none. */
  scarfA: Color;
  scarfB: Color;
}

/**
 * A person standing facing us: 5 wide, 14 tall (a child 5 x 11). Feet on the row above `y`.
 */
export function drawWatcher(s: Surface, w: Watcher, pose: Pose): void {
  const lift = pose === BOB || pose === JUMP || pose === SCARF ? 1 : 0;
  const x = w.x - 2;
  const top = w.y - (w.kid ? 11 : 14) - lift;
  const legsH = w.kid ? 3 : 4;
  const coatH = w.kid ? 5 : 7;
  // head
  s.hline(x + 1, top, 3, w.hair);
  s.rect(x + 1, top + 1, 3, 2, w.skin);
  // coat, arms down its sides
  const c0 = top + 3;
  s.rect(x, c0, 5, coatH - 1, w.coat);
  s.hline(x + 1, c0 + coatH - 1, 3, w.coatLow);
  // legs and shoes
  const l0 = c0 + coatH;
  for (let i = 0; i < legsH; i++) {
    s.px(x + 1, l0 + i, w.legs);
    s.px(x + 3, l0 + i, w.legs);
  }
  if (lift === 0) {
    s.px(x + 1, l0 + legsH - 1, P.ink);
    s.px(x + 3, l0 + legsH - 1, P.ink);
  }
  // arms
  if (pose === JUMP || pose === ARMS) {
    s.vline(x, top - 1, 4, w.coat);
    s.vline(x + 4, top - 1, 4, w.coat);
    s.px(x, top - 2, w.skin);
    s.px(x + 4, top - 2, w.skin);
    s.px(x, c0 + 1, w.coatLow);
    s.px(x + 4, c0 + 1, w.coatLow);
  } else if (pose === HANDS) {
    s.px(x, top + 1, w.skin);
    s.px(x + 4, top + 1, w.skin);
    s.vline(x, top + 2, 2, w.coat);
    s.vline(x + 4, top + 2, 2, w.coat);
  } else if (pose === SCARF && w.scarfA !== TRANSPARENT) {
    for (let i = -1; i <= 5; i++) {
      s.px(x + i, top - 2, (i & 1) === 0 ? w.scarfA : w.scarfB);
    }
    s.vline(x - 1, top - 1, 3, w.coat);
    s.vline(x + 5, top - 1, 3, w.coat);
  } else {
    s.px(x, c0 + coatH - 2, w.skin);
    s.px(x + 4, c0 + coatH - 2, w.skin);
  }
}

// ---------------------------------------------------------------------------
// People seen from behind on the near side
// ---------------------------------------------------------------------------

/**
 * Someone standing or sitting with their back to us, bottom row at `y`: a head of hair and
 * the back of a coat. `big` is a substitute's long coat.
 */
export function paintBack(
  s: Surface,
  x: number,
  y: number,
  hair: Color,
  coat: Color,
  big: boolean,
): void {
  const cw = big ? 8 : 6;
  const ch = big ? 9 : 6;
  const top = y - ch - 4 + 1;
  s.rect(x + (cw - 4) / 2, top, 4, 4, hair);
  s.hline(x + (cw - 4) / 2 + 1, top, 2, shade(hair, 0.25));
  s.rect(x, top + 4, cw, ch, coat);
  s.vline(x, top + 5, ch - 1, shade(coat, 0.2));
  s.vline(x + cw - 1, top + 5, ch - 1, shade(coat, -0.3));
  s.hline(x + 1, top + 4, cw - 2, shade(coat, 0.15));
  if (big) {
    // a hood folded down and the coat's hem
    s.hline(x + 2, top + 5, cw - 4, shade(coat, -0.2));
    s.hline(x, y, cw, shade(coat, -0.35));
  }
}

// ---------------------------------------------------------------------------
// The dog
// ---------------------------------------------------------------------------

/** The dog: brown with a white chest, 9 x 6. Frames: stand, trot a, trot b, sit, sit wag. */
export const DOG: Sprite = sprite(
  `
......kk.
......bbn
k.....bwb
.bbbbbbw.
.bbbbbb..
.b.b..b.b

......kk.
......bbn
.k....bwb
.bbbbbbw.
.bbbbbb..
b..b.b..b

......kk.
......bbn
k.....bwb
.bbbbbbw.
.bbbbbb..
..bb..bb.

......kk.
......bbn
......bwb
.....bbw.
k...bbbb.
.bbbbbbb.

......kk.
......bbn
......bwb
.....bbw.
....bbbb.
kbbbbbbb.
`,
  "kbwn",
);

export const DOG_STAND = 0;
export const DOG_TROT = 1;
export const DOG_SIT = 3;
