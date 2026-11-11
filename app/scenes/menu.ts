/**
 * The menu scene: the home screen's moving picture.
 *
 * A football hangs in the air in front of a stadium in its town, under the player's own
 * sky, and an airship over the town carries the fact of the day.
 * It is the menu, not a ball on a pitch: it floats, and nothing in this scene knows of
 * any ground. Its black patches are the buttons: HOME on the left patch, AWAY on the
 * right, and two locked patches above and below. Choosing a mode strikes the ball where
 * it hangs.
 *
 * HOME goes home. The ball is driven up and into the picture, shrinking fast, climbs over
 * the stadium, hangs for a beat above its far side and drops onto the centre spot, a tiny
 * ball with a streak of red-orange behind it. It lands with a thump and a ripple, the
 * ground erupts, and the iris closes on the pitch with the ball lying on its spot.
 *
 * AWAY goes away. Struck the other way, the ball leaves low to the right, clear of the
 * stadium at once, and curls up over the town towards the horizon, a speck by the time it
 * crosses the roofs of the city into the sky. A last twinkle, and it is gone: no roar. The
 * iris closes on where it went.
 *
 *   const menu = new MenuScene({ seed, fact, labels });
 *   menu.onKickoff = (mode) => hideTheCaptions();
 *   menu.onChoose = (mode) => startTheGame(mode);
 *   // the host then drives resize, setLighting, update, draw and pointer
 *
 * Everything on screen is a function of the scene's own clocks, which only `update`
 * moves, so the same calls always give the same pixels. `draw` allocates nothing of its
 * own.
 *
 * The backdrop. The scene knows the stadium only through `MenuBackdrop`'s contract
 * (resize, setLighting, setSign, setMoonPhase, target, setRoar, draw, and
 * airshipAt and pokeAirship, which hand the airship the pointer) and
 * takes from `menuLayout` only `cx`, `ballR`, `ballCy` and `logo`. The kick-offs are
 * placed by the ball's own spot, the backdrop's `target()` (the centre spot of the pitch),
 * the logo zone (always clear sky) with the wordmark in it, which neither flight crosses,
 * and the width of the screen, which says whether the picture is a monitor's or a phone's.
 * The numbers that place them are the constants under "The kick-off: where things go".
 *
 * The scene draws the backdrop, the ball and the wordmark, and three lights: the star the
 * ball arrives out of, the light of the strike and the mark where the struck ball ends
 * (HOME's burst and ripple on the pitch, AWAY's twinkle in the sky).
 *
 * Phases: "intro" (the ball arrives and settles into its hover), "idle" (it hovers),
 * "kickoff" (flash, strike, flight, iris), "done" (ink until `reset`). With reduced motion
 * there is no entrance and no bob: the ball hangs still on its spot.
 *
 * Two things about input. A mode chosen (by `choose`) while the ball is still arriving is
 * taken at once but struck only when the ball has settled. And a pointer that keeps still
 * keeps the patch it is on while the ball breathes and rocks under it: the hover is only
 * looked at afresh when the pointer moves.
 *
 * The ball can be spun by hand: a press that moves more than a few pixels is a drag, which
 * turns it under the pointer, and a flick leaves it spinning until friction slows it and it
 * springs back into its pose. Meanwhile it is no menu: nothing hovers or chooses from the
 * pointer, and a mode chosen from the captions brings it round quickly before the strike.
 * The constants under "Spinning the ball by hand" give the feel.
 */

import {
  BALL_SLOTS,
  ballShowPose,
  ballSlotAt,
  ballSlotCenter,
  drawBall,
  type BallPatch,
  type BallSlot,
  type BallState,
} from "~/art/ball";
import { menuLayout } from "~/art/layout";
import { lightingFor, type Lighting } from "~/art/lighting";
import { drawLogo, logoSize, type LogoOptions } from "~/art/logo";
import { MODE_COLORS, P } from "~/art/palette";
import { MenuBackdrop } from "~/art/stadium";
import type { Mode } from "~/game";
import {
  Surface,
  TRANSPARENT,
  clamp,
  hash2,
  lerp,
  smoothstep,
  type Color,
} from "~/pixel";
import type { PointerInfo, Scene, SceneCursor } from "./scene";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * The modes that are not open yet. Each has a patch of its own on the ball: NEXT-GEN on
 * the top patch and RETRO on the bottom one, CLOSEST and FURTHEST on the back, directly
 * behind AWAY and HOME, so that half a turn of the ball brings CLOSEST round to where HOME
 * was and FURTHEST to where AWAY was.
 */
export type LockedMode = "nextgen" | "retro" | "closest" | "furthest";

export const LOCKED_MODES: readonly LockedMode[] = [
  "nextgen",
  "retro",
  "closest",
  "furthest",
];

/** Which patch each mode is on. */
export const MODE_SLOTS: Readonly<Record<Mode | LockedMode, BallSlot>> = {
  home: "left",
  away: "right",
  nextgen: "top",
  retro: "bottom",
  closest: "backRight",
  furthest: "backLeft",
};

export interface MenuLabels {
  /** The word on the left patch, for example "HOME". */
  home: string;
  /** The word on the right patch, for example "AWAY". */
  away: string;
  /** The words on the locked patches, for example "NEXT-GEN". */
  nextgen: string;
  retro: string;
  closest: string;
  furthest: string;
  /** The first line of the airship's sign, over the fact, for example "DID YOU KNOW?". */
  header: string;
  /** Under the logo when there is room, for example "DAILY FOOTBALL TRIVIA". */
  tagline?: string;
}

export interface MenuSceneOptions {
  seed: number;
  /** The fact of the day, on the airship's sign. Any case: the sign shows capitals. */
  fact: string;
  labels: MenuLabels;
  /** Play the entrance. Default true. */
  intro?: boolean;
}

export type MenuPhase = "intro" | "idle" | "kickoff" | "done";

// ---------------------------------------------------------------------------
// Timing (seconds)
// ---------------------------------------------------------------------------

const TAU = Math.PI * 2;

/** The idle rock: this much yaw each way, once every ROCK_PERIOD seconds. */
const ROCK = 0.12;
const ROCK_PERIOD = 5;
/** With reduced motion every ambient loop runs at this fraction of its speed. */
const REDUCED_SPEED = 0.25;
/** The longest step one `update` may take. A longer one is a stalled tab, not a frame. */
const MAX_DT = 600;

/**
 * The hover. The ball hangs in the air and breathes: it rises and sinks BOB of its radius
 * (a pixel or two, in whole pixels) once every BOB_PERIOD seconds, and nods NOD radians
 * as it goes, NOD_LAG of a period behind, so the panels trail the outline a little. The
 * rock keeps its own, longer period, so the three never fall into step.
 */
const BOB = 0.04;
const BOB_PERIOD = 4;
const NOD = 0.035;
const NOD_LAG = 0.25;

/**
 * Idle life: every third breath is a deep one. As the ball rises through its spot it
 * goes on up, DEEP ordinary breaths further, over DEEP_RISE seconds, and has sunk back
 * onto the bob DEEP_LEN seconds after it began: no start, no stop, nothing to push off.
 * The first is DEEP_FIRST seconds in, then one every DEEP_EVERY (both whole bobs, so it
 * always comes on the way up). The nod takes DEEP_NOD of it.
 */
const DEEP = 1.5;
const DEEP_EVERY = BOB_PERIOD * 3;
const DEEP_FIRST = BOB_PERIOD * 2;
const DEEP_RISE = 0.8;
const DEEP_LEN = 2.4;
const DEEP_NOD = 0.5;

/**
 * The entrance. The ball swells up out of a star IN_BELOW of its radius under its spot,
 * turning to face us, and rises as it grows, like a bubble coming up. It is full size
 * IN_SWELL seconds in, floats IN_OVER of its radius past where the hover has it and sinks
 * back onto the hover, which has it from INTRO_LEN on. It never grows past its size: what
 * a patch shows depends on the radius, and must not flicker.
 */
const INTRO_LEN = 0.88;
const IN_SWELL = 0.45;
const IN_BELOW = 0.3;
const IN_OVER = 0.08;
const IN_OVER_AT = 0.25;
/** How far round the ball is turned as it appears (radians of yaw), and the radius at
 * which it has come round to face us. */
const IN_TURN = -1.4;
const IN_FACING_R = 36;
/**
 * The star it comes out of: four points, behind the ball, whose arms keep just ahead of
 * the swelling ball. This long in ball radii, frame by frame at IN_STAR_FPS; the last frame
 * is only the tips.
 */
const IN_STAR: readonly number[] = [0.42, 0.72, 0.92, 1.02];
const IN_STAR_FPS = 20;

/** The "no" of a locked patch. */
const NO_LEN = 0.35;

/**
 * A spun ball that comes to rest with a locked patch facing the viewer turns to show it
 * (NEXT-GEN or RETRO straight on, or CLOSEST and FURTHEST where HOME and AWAY were) and
 * holds that pose for REST_HOLD seconds from when it stopped, long enough to read the
 * patch and press it, before it goes home. A press on a locked patch starts the wait
 * afresh, and it stands still while the pointer is on a patch or pressing the ball.
 */
const REST_HOLD = 4.5;

/**
 * A pointer that has moved no more than this (logical pixels: a hand's tremble, less than
 * one step of a sweep) since it was last on a patch is keeping still, and keeps that
 * patch: the ball breathes and rocks a few pixels under it, and neither the highlight nor
 * a press may be lost to that.
 */
const STILL = 0.5;

/**
 * The kick-off, from the moment a mode is chosen. The patch flashes until K_HIT, the ball
 * is struck and squashed until K_FLY, it flies for HOME_FLIGHT or AWAY_FLIGHT seconds, the
 * iris starts at K_IRIS, has closed to a ring by K_HOLD, shuts from K_SHUT, the screen is
 * ink at K_INK and the scene is "done" at K_END.
 */
const K_HIT = 0.22;
const K_FLY = K_HIT + 0.07;
/** The struck ball is pressed flat SQUASH of its radius deep for the first K_DEEP seconds,
 * and half as deep until it flies. */
const K_DEEP = 0.035;
const SQUASH = 0.09;
/** The light of the strike: frames a STRIKE_FPS-th of a second long. */
const STRIKE_FPS = 24;
const STRIKE_FRAMES = 6;
/** HOME's ball is in the air for less long than AWAY's, so that the ground has time to
 * erupt before the iris closes on it. */
const HOME_FLIGHT = 0.6;
const AWAY_FLIGHT = 0.68;
const K_IRIS = K_FLY + AWAY_FLIGHT + 0.17;
const K_HOLD = K_IRIS + 0.2;
const K_SHUT = K_HOLD + 0.1;
const K_INK = K_SHUT + 0.07;
const K_END = K_INK + 0.06;
/** With reduced motion the kick-off is a cut: the patch lights for this long, then ink. */
const K_REDUCED = 0.15;
/** The screen shake of the strike, one entry a thirtieth of a second. */
const SHAKE: readonly number[] = [2, -2, 1, -1];
/** HOME: the ground starts to roar this long before the ball is down, and is at full voice
 * ROAR_RAMP later. */
const ROAR_LEAD = 0.05;
const ROAR_RAMP = 0.18;
const ROAR_STEPS = 6;

/**
 * A ball time at which a chosen patch shows its mode's light colour and holds it (the
 * flash is white on even eighths of a second, the colour on odd ones) and no shine runs.
 */
const BALL_T_LIT = 0.125;

// ---------------------------------------------------------------------------
// Spinning the ball by hand
// ---------------------------------------------------------------------------

/**
 * A press on the ball that moves more than DRAG pixels (logical: 12 CSS pixels on the
 * reference monitor) is a drag and never a click, wherever it is let go.
 */
const DRAG = 3;
/**
 * While the pointer is within GRIP of the ball's radius from its middle, the point that
 * was grabbed stays under it: the ball turns about the axis that carries the one onto the
 * other. Nearer the rim, and off the ball, a drag of one radius turns it one radian, about
 * the axis across the drag.
 */
const GRIP = 0.92;
/** The hand's speed is measured over about this long (seconds), and is what a flick keeps. */
const SPIN_TAU = 0.05;
/** The fastest a flick spins it, in radians a second (a little over two turns). */
const SPIN_MAX = 14;
/**
 * Let go, it slows by FRICTION of its speed a second and by FRICTION_FLOOR radians a
 * second besides, and below SPIN_SLOW it heads home: a full flick lasts about 1.8 s.
 */
const FRICTION = 0.8;
const FRICTION_FLOOR = 1.5;
const SPIN_SLOW = 1.5;
/**
 * Home is the menu pose (HOME left, AWAY right), by the shortest way, on a spring with a
 * little overshoot: HOME_FREQ radians a second, HOME_DAMP of critical damping. With reduced
 * motion it is critically damped and a little quicker, and there is no overshoot.
 */
const HOME_FREQ = 7;
const HOME_DAMP = 0.6;
const HOME_FREQ_REDUCED = 9;
/** Home: within this many radians of the pose and turning slower than SETTLED_SPEED. */
const SETTLED = 0.012;
const SETTLED_SPEED = 0.15;
/** A mode chosen from the captions while the ball is turned: it is brought round in this long. */
const SNAP = 0.24;
/** The spin is worked out in steps no longer than this, and a step longer than SPIN_GIVE_UP
 * (a stalled tab) puts the ball straight home. */
const SPIN_STEP = 1 / 120;
const SPIN_GIVE_UP = 10;

/**
 * What the hand has done to the ball. "still": nothing, the ball is the menu. "rest": it
 * has come to rest showing a locked patch, and is a menu there too.
 */
type Spin = "still" | "drag" | "coast" | "rest" | "home" | "snap";

// ---------------------------------------------------------------------------
// The kick-off: where things go
// ---------------------------------------------------------------------------

/** Below this radius the ball is drawn as a few hand-placed pixels. */
const TINY_R = 4.5;

/**
 * There are two pictures. On a screen at least OPEN_W wide (a monitor) the stadium stands
 * in the middle of its town with open sky over it and out to both sides. On a narrower one
 * (a phone) the stadium is as wide as the screen and the matchday sign hangs under the
 * wordmark, right over it: the only open sky is beside the wordmark. Each flight has its
 * numbers for both.
 */
const OPEN_W = 200;

/**
 * HOME: the ball goes home. Struck from below, it is driven up and into the picture. It
 * climbs for HOME_UP of the flight to an apex above `backdrop.target()`, shrinking as a
 * thing does that goes away from us at a steady speed until it is HOME_FAR + 1 times as far
 * off: fast at first, down to HOME_APEX_R of its radius. It hangs there for HOME_HANG of
 * the flight and then falls away from us onto the target, faster and faster, HOME_END_R of
 * its radius when it lands (a few pixels: 7 across on a monitor, 5 on a phone).
 *
 * The apex is HOME_RISE_W of the width above the target, or HOME_RISE_H of the height if
 * that is less: over the far rim of the stadium, at the foot of the sky. On a phone it is
 * only HOME_RISE_TALL of the width, and the ball HOME_APEX_R_TALL there, because the sign
 * hangs just above the stadium. It is never so high that the ball would touch the wordmark.
 *
 * Down, the picture thumps, the ball bounces once (HOME_HOP pixels, from HOME_HOP_AT
 * seconds after it lands, for HOME_HOP_LEN) and lies still on the spot.
 */
const HOME_FAR = 7;
const HOME_APEX_R = 0.17;
const HOME_APEX_R_TALL = 0.12;
const HOME_END_R = 0.07;
const HOME_UP = 0.48;
const HOME_HANG = 0.07;
const HOME_RISE_W = 0.1;
const HOME_RISE_H = 0.178;
const HOME_RISE_TALL = 0.072;
const HOME_HOP = 3;
const HOME_HOP_AT = 0.066;
const HOME_HOP_LEN = 0.134;
/** The thump of the landing, one entry a thirtieth of a second. */
const THUMP: readonly number[] = [1, -1];
/**
 * The ripple that runs out over the pitch from where it landed: half this wide in ball
 * radii, frame by frame at RIPPLE_FPS (RIPPLE_TALL of that on a phone, where the pitch is
 * small), and RIPPLE_FLAT as tall as wide, as a circle on the ground is from up here.
 */
const RIPPLE: readonly number[] = [0.2, 0.42, 0.62, 0.78, 0.9];
const RIPPLE_FPS = 20;
const RIPPLE_TALL = 0.45;
const RIPPLE_FLAT = 0.42;

/**
 * AWAY: the ball goes away. Struck the other way, it leaves to the right, low, and curls
 * up and off into the distance.
 *
 * On a monitor it is last seen low in the sky, just over the roofs on the horizon and
 * right of the moon: AWAY_LOW_X of the way across, and AWAY_LOW_Y of the way down from
 * the logo zone to `backdrop.target()`. It gets there on a curl whose corner is
 * AWAY_LOW_OUT ball radii further right and only AWAY_LOW_UP of the way up, so that it is
 * clear of the stadium at once and spends the flight over the town; and it goes as a
 * thing does that ends AWAY_FAR + 1 times as far off as it began, a speck by then.
 *
 * On a phone the only open sky is beside the wordmark, and the sign hangs between it and
 * the ball. The ball is last seen AWAY_X to the right of the middle (in ball radii; at
 * least AWAY_X_WIDE and at most AWAY_X_MAX of the width) and AWAY_Y of the logo zone's
 * height down. It keeps AWAY_CLEAR pixels from the wordmark and AWAY_EDGE from the canvas
 * edge; where there is no such gap it goes just under the wordmark instead. To get there
 * without crossing the sign it goes round it: the corner of its curl is AWAY_SWING ball
 * radii beyond the right edge and AWAY_SWING_Y of the way up, so it flies out of the
 * picture in front of the stadium and comes back in at the top, small, beside the wordmark.
 */
const AWAY_FAR = 3.5;
const AWAY_LOW_X = 0.875;
const AWAY_LOW_Y = 0.125;
const AWAY_LOW_OUT = 2.2;
const AWAY_LOW_UP = 0.03;
const AWAY_X = 2.6;
const AWAY_X_WIDE = 0.33;
const AWAY_X_MAX = 0.4;
const AWAY_Y = 0.36;
const AWAY_CLEAR = 7;
const AWAY_EDGE = 6;
const AWAY_SWING = 1.6;
const AWAY_SWING_Y = 0.15;

/** The ring the iris closes to and holds, in ball radii: HOME's shows the pitch and the
 * crowd round it, AWAY's a little sky. */
const HOME_RING = 0.75;
const AWAY_RING = 0.22;

/** The streak behind the ball once it is small: samples this many seconds apart. */
const TRAIL_GAP = 0.035;
const TRAIL_BELOW_R = 8;

/**
 * How near a ball still is, `u` of the way through a flight straight away from us at a
 * steady speed that ends `far` + 1 times as far off as it began: 1 at the start, 0 at the
 * end. The size of a thing going away falls like this, fast at first, and so does what is
 * left of its way across the screen.
 */
function nearAt(u: number, far: number): number {
  const end = 1 / (1 + far);
  return (1 / (1 + far * u) - end) / (1 - end);
}

// ---------------------------------------------------------------------------
// Small painters
// ---------------------------------------------------------------------------

/** Move the whole picture `dy` rows down (up when negative), repeating the edge row. */
function shiftRows(s: Surface, dy: number): void {
  const { w, h, data } = s;
  if (dy === 0 || dy >= h || -dy >= h) return;
  if (dy > 0) {
    data.copyWithin(dy * w, 0, (h - dy) * w);
    for (let y = 0; y < dy; y++) data.copyWithin(y * w, dy * w, (dy + 1) * w);
  } else {
    const k = -dy;
    data.copyWithin(0, k * w, h * w);
    const from = (h - k - 1) * w;
    for (let y = h - k; y < h; y++) data.copyWithin(y * w, from, from + w);
  }
}

/** Move the whole picture `dx` columns right (left when negative), repeating the edge. */
function shiftCols(s: Surface, dx: number): void {
  const { w, h, data } = s;
  if (dx === 0 || dx >= w || -dx >= w) return;
  if (dx > 0) {
    data.copyWithin(dx, 0, w * h - dx);
    for (let y = 0; y < h; y++) {
      const row = y * w;
      data.fill(data[row + dx], row, row + dx);
    }
  } else {
    const k = -dx;
    data.copyWithin(0, k, w * h);
    for (let y = 0; y < h; y++) {
      const end = (y + 1) * w;
      data.fill(data[end - k - 1], end - k, end);
    }
  }
}

/** The iris: everything further than `r` from (cx, cy) becomes `ink`. */
function iris(s: Surface, cx: number, cy: number, r: number, ink: Color): void {
  const { w, h, data } = s;
  if (!(r >= 0)) {
    data.fill(ink);
    return;
  }
  // the pixel circle with clean runs: inside when dx^2 + dy^2 <= r^2 + r
  const limit = r * r + r;
  for (let y = 0; y < h; y++) {
    const dy = y - cy;
    const row = y * w;
    const room = limit - dy * dy;
    if (room < 0) {
      data.fill(ink, row, row + w);
      continue;
    }
    const half = Math.floor(Math.sqrt(room));
    const x0 = cx - half;
    const x1 = cx + half + 1;
    if (x0 > 0) data.fill(ink, row, row + Math.min(w, x0));
    if (x1 < w) data.fill(ink, row + Math.max(0, x1), row + w);
  }
}

/** Unit vectors of the eight rays of a burst, clockwise from the right. */
const RAY_X: readonly number[] = [
  1,
  Math.SQRT1_2,
  0,
  -Math.SQRT1_2,
  -1,
  -Math.SQRT1_2,
  0,
  Math.SQRT1_2,
];
const RAY_Y: readonly number[] = [
  0,
  Math.SQRT1_2,
  1,
  Math.SQRT1_2,
  0,
  -Math.SQRT1_2,
  -1,
  -Math.SQRT1_2,
];

/** An impact: a star that bursts and breaks up, three frames. */
function drawBurst(
  s: Surface,
  x: number,
  y: number,
  frame: number,
  size: number,
  core: Color,
  rays: Color,
): void {
  if (frame < 0 || frame > 2) return;
  if (frame === 0) {
    const long = Math.round(size);
    const k = Math.round(size * 0.55 * Math.SQRT1_2);
    for (let w = -1; w <= 1; w++) {
      s.line(x - long, y + w, x + long, y + w, w === 0 ? core : rays);
      s.line(x + w, y - long, x + w, y + long, w === 0 ? core : rays);
    }
    s.line(x - k, y - k, x + k, y + k, rays);
    s.line(x - k, y + k, x + k, y - k, rays);
    s.disc(x, y, Math.max(1, Math.round(size * 0.3)), core);
    return;
  }
  if (frame === 1) drawRays(s, x, y, size * 0.7, size * 1.25, core);
  else drawRays(s, x, y, size * 1.25, size * 1.45, rays);
}

/** Eight rays round (x, y), each from `r0` out to `r1`. */
function drawRays(
  s: Surface,
  x: number,
  y: number,
  r0: number,
  r1: number,
  c: Color,
): void {
  for (let i = 0; i < 8; i++) {
    s.line(
      Math.round(x + RAY_X[i] * r0),
      Math.round(y + RAY_Y[i] * r0),
      Math.round(x + RAY_X[i] * r1),
      Math.round(y + RAY_Y[i] * r1),
      c,
    );
  }
}

/**
 * The light of the strike: a star where the boot met the ball, a ring that opens round
 * it and sparks thrown back the way the boot came. (`nx`, `ny`) points from the ball out
 * through the point of contact. `frame` counts from 0.
 */
function drawStrike(
  s: Surface,
  x: number,
  y: number,
  nx: number,
  ny: number,
  frame: number,
  size: number,
  seed: number,
  core: Color,
  light: Color,
  base: Color,
): void {
  if (frame < 0 || frame >= STRIKE_FRAMES) return;
  if (frame === 0) {
    // the flash: a glow, and a star over it
    s.disc(x, y, Math.round(size * 0.9), light, 0.5);
    s.disc(x, y, Math.round(size * 0.55), light);
    drawBurst(s, x, y, 0, size * 1.3, core, light);
    return;
  }
  // the ring: thick and bright, then wider and thinner, then in pieces
  if (frame === 1) {
    const r = Math.round(size * 0.8);
    // still glowing inside, and throwing its rays clear of the ring
    s.disc(x, y, r, light, 0.25);
    s.disc(x, y, Math.round(size * 0.45), light, 0.5);
    s.circle(x, y, r, light);
    s.circle(x, y, r - 1, light);
    s.disc(x, y, Math.max(1, Math.round(size * 0.2)), core);
    drawRays(s, x, y, size * 1.05, size * 1.45, core);
  } else if (frame === 2) {
    s.circle(x, y, Math.round(size * 1.15), light);
    drawRays(s, x, y, size * 1.4, size * 1.65, light);
  } else if (frame === 3) {
    const r = size * 1.4;
    const dashes = 10;
    const steps = Math.ceil(r * 0.9);
    for (let i = 0; i < dashes; i++) {
      for (let j = 0; j <= steps; j++) {
        const a = ((i + (j / steps) * 0.5) / dashes) * TAU;
        s.px(
          Math.round(x + Math.cos(a) * r),
          Math.round(y + Math.sin(a) * r),
          base,
        );
      }
    }
  }
  // sparks, thrown back the way the boot came in a wide fan: they fly fast, slow and go out
  const p = frame / (STRIKE_FRAMES - 1);
  const out = 1 - (1 - p) * (1 - p);
  const back = Math.atan2(ny, nx);
  const n = 7;
  for (let i = 0; i < n; i++) {
    const h1 = hash2(i, 11, seed);
    const h2 = hash2(i, 13, seed);
    const life = 0.7 + 0.3 * h1;
    if (p > life) continue;
    const ang = back + ((i + 0.5) / n - 0.5) * 2.7 + (h2 - 0.5) * 0.2;
    const d = size * (1.1 + 1.1 * h1) * out;
    const px = Math.round(x + Math.cos(ang) * d);
    const py = Math.round(y + Math.sin(ang) * d);
    // each a little four-point star with a white heart, smaller before it goes out
    const arm = p < life * 0.5 ? 2 : 1;
    s.hline(px - arm, py, arm * 2 + 1, light);
    s.vline(px, py - arm, arm * 2 + 1, light);
    s.px(px, py, core);
  }
}

/**
 * The star the ball arrives out of: four arms `arm` long in `tips`, with a heart of
 * `core`. The last frame is only the ends of its arms and four motes between them.
 */
function drawArrival(
  s: Surface,
  x: number,
  y: number,
  arm: number,
  last: boolean,
  core: Color,
  tips: Color,
): void {
  const a = Math.round(arm);
  if (a < 1) return;
  if (last) {
    const from = a - 2;
    s.hline(x - a, y, 3, tips);
    s.hline(x + from, y, 3, tips);
    s.vline(x, y - a, 3, tips);
    s.vline(x, y + from, 3, tips);
    const d = Math.round(arm * 0.78);
    s.px(x - d, y - d, tips);
    s.px(x + d, y - d, tips);
    s.px(x - d, y + d, tips);
    s.px(x + d, y + d, tips);
    return;
  }
  star(s, x, y, a, Math.max(1, Math.round(arm * 0.16)), tips);
  star(
    s,
    x,
    y,
    Math.round(arm * 0.8),
    Math.max(1, Math.round(arm * 0.1)),
    core,
  );
}

/** Room for the corners of a star, so that drawing one allocates nothing. */
const STAR_POINTS: [number, number][] = Array.from({ length: 8 }, () => [0, 0]);

/** A four-point star: arms `a` long, `k` across the waist between them. */
function star(
  s: Surface,
  x: number,
  y: number,
  a: number,
  k: number,
  c: Color,
): void {
  for (let i = 0; i < 4; i++) {
    const tip = STAR_POINTS[i * 2];
    const waist = STAR_POINTS[i * 2 + 1];
    // right, down, left, up, and the waists between them
    const ux = i === 0 ? 1 : i === 2 ? -1 : 0;
    const uy = i === 1 ? 1 : i === 3 ? -1 : 0;
    tip[0] = x + ux * a;
    tip[1] = y + uy * a;
    waist[0] = x + (ux - uy) * k;
    waist[1] = y + (ux + uy) * k;
  }
  s.poly(STAR_POINTS, c);
}

/**
 * A ripple on the ground: a ring `rx` by `ry` round (x, y), whole at `stage` 0 and in
 * shorter and shorter dashes after that.
 */
function drawRipple(
  s: Surface,
  x: number,
  y: number,
  rx: number,
  ry: number,
  stage: number,
  c: Color,
): void {
  const steps = Math.max(8, Math.ceil(rx * 7));
  const dashes = Math.max(6, Math.round(rx * 0.45));
  // of each dash and its gap, this much is drawn
  const on = stage <= 0 ? 1 : stage === 1 ? 0.75 : stage === 2 ? 0.5 : 0.3;
  for (let j = 0; j < steps; j++) {
    const turn = j / steps;
    if ((turn * dashes) % 1 >= on) continue;
    const a = turn * TAU;
    s.px(Math.round(x + Math.cos(a) * rx), Math.round(y + Math.sin(a) * ry), c);
  }
}

/** How long the arms of the twinkle are, frame by frame. */
const TWINKLE: readonly number[] = [1, 3, 6, 5, 3, 1];

/** A four-point twinkle: it opens, flares and closes to a point. */
function drawTwinkle(
  s: Surface,
  x: number,
  y: number,
  frame: number,
  core: Color,
  tips: Color,
  edge: Color | null,
): void {
  const arm = frame >= 0 && frame < TWINKLE.length ? TWINKLE[frame] : 0;
  if (edge !== null && frame >= 0) {
    // against a pale sky: a dark star behind it, no bigger than the twinkle is at night
    if (arm >= 3) {
      star(s, x, y, arm, arm >= 5 ? 2 : 1, edge);
    } else {
      s.hline(x - arm - 1, y, arm * 2 + 3, edge);
      s.vline(x, y - arm - 1, arm * 2 + 3, edge);
      if (arm === 1) s.rect(x - 1, y - 1, 3, 3, edge);
    }
  }
  if (arm >= 3) {
    const a = edge === null ? arm : arm - 1;
    s.hline(x - a, y, a * 2 + 1, tips);
    s.vline(x, y - a, a * 2 + 1, tips);
    s.hline(x - a + 2, y, a * 2 - 3, core);
    s.vline(x, y - a + 2, a * 2 - 3, core);
    for (let d = 1; d <= (a >= 5 ? 2 : 1); d++) {
      s.px(x - d, y - d, tips);
      s.px(x + d, y - d, tips);
      s.px(x - d, y + d, tips);
      s.px(x + d, y + d, tips);
    }
    return;
  }
  if (arm === 1) {
    s.hline(x - 1, y, 3, tips);
    s.vline(x, y - 1, 3, tips);
  }
  s.px(x, y, core);
}

/**
 * The ball when it is too small for its panels: a disc with an outline, one dark patch
 * and one pixel of the mode's colour that change places as it spins.
 */
function drawTinyBall(
  s: Surface,
  x: number,
  y: number,
  r: number,
  frame: number,
  ink: Color,
  white: Color,
  shade: Color,
  dark: Color,
  accent: Color,
): void {
  const cx = Math.round(x);
  const cy = Math.round(y);
  if (r < 1.5) {
    // a speck: no room for an outline
    s.disc(cx, cy, 1, ink);
    s.px(cx, cy, white);
    return;
  }
  s.disc(cx, cy, r, ink);
  s.disc(cx, cy, r - 1, white);
  const f = ((frame % 4) + 4) % 4;
  if (r < 2.5) {
    // 4 or 5 px across: one pixel of each, swapping sides
    if (f === 0) s.px(cx, cy, dark);
    else if (f === 1) s.px(cx, cy - 1 + (r > 1.5 ? 0 : 1), accent);
    else if (f === 2) s.px(cx + (r > 1.5 ? 1 : 0), cy, dark);
    else s.px(cx, cy + (r > 1.5 ? 1 : 0), accent);
    return;
  }
  // 6 to 9 px across: the shaded side, a dark patch that crosses, the colour following it
  const k = Math.round(r) - 2;
  s.px(cx + k, cy + k, shade);
  s.px(cx + k, cy + k - 1, shade);
  s.px(cx + k - 1, cy + k, shade);
  const oy = f === 0 ? -k : f === 1 ? -1 : f === 2 ? k - 1 : 0;
  if (f !== 3) s.rect(cx - 1, cy + oy, 2, 2, dark);
  const ay = f === 0 ? k - 1 : f === 1 ? -k : f === 2 ? -1 : 0;
  s.hline(cx - k, cy + ay, 2, accent);
}

// ---------------------------------------------------------------------------
// The scene
// ---------------------------------------------------------------------------

function slotOf(mode: Mode | null): BallSlot | null {
  return mode === "home" ? "left" : mode === "away" ? "right" : null;
}

function modeOf(slot: BallSlot | null): Mode | null {
  return slot === "left" ? "home" : slot === "right" ? "away" : null;
}

function lockedOf(slot: BallSlot | null): LockedMode | null {
  for (const mode of LOCKED_MODES) if (MODE_SLOTS[mode] === slot) return mode;
  return null;
}

function isMode(v: unknown): v is Mode {
  return v === "home" || v === "away";
}

function freshBall(): BallState {
  return {
    cx: 0,
    cy: 0,
    r: 0,
    yaw: 0,
    pitch: 0,
    roll: 0,
    hovered: null,
    pressed: null,
    chosen: null,
    t: 0,
  };
}

export class MenuScene implements Scene {
  /** The pointer's hover changed (null: it is over neither HOME nor AWAY). */
  onHover: ((mode: Mode | null) => void) | null = null;
  /** A mode was chosen and the transition starts now. */
  onKickoff: ((mode: Mode) => void) | null = null;
  /** The transition is over and the page moves on. Exactly once per kick-off. */
  onChoose: ((mode: Mode) => void) | null = null;
  /** A locked patch was pressed and released: which mode it is. */
  onLocked: ((mode: LockedMode) => void) | null = null;

  private readonly seed: number;
  private readonly backdrop: MenuBackdrop;
  /** The airship's sign: the header (from the labels) and the fact. */
  private header: string;
  private fact: string;
  private readonly patches: Record<BallSlot, BallPatch>;
  private readonly logo: LogoOptions = { maxWidth: 1, maxHeight: 1, t: 0 };
  private logoTop = 0;
  private light: Lighting = lightingFor({ elevation: 45, morning: false });
  private reduced = false;

  // The canvas, and the five numbers the scene takes from menuLayout.
  private w = 1;
  private h = 1;
  private cx = 0;
  /** The ball's radius and its spot: the row its centre hovers about. */
  private R = 0;
  private cy0 = 0;
  /** Room to draw the ball apart from the picture, for the frames it is pressed flat. */
  private pad = new Surface(1, 1);
  /** The bottom of the logo zone. */
  private logoH = 0;
  /** The wordmark as it is drawn: its width and the first row under it. */
  private logoW = 0;
  private logoBottom = 0;
  /** The picture is a monitor's: open sky over the stadium and out to the sides. */
  private open = false;
  /** HOME: how far above the target the ball's apex is, and its radius when it is down. */
  private rise = 0;
  private endR = 2;
  /** AWAY: where the ball is last seen. */
  private ax = 0;
  private ay = 0;
  /** `backdrop.target()` for this size: where the HOME ball comes down. */
  private tx = 0;
  private ty = 0;
  /** The backdrop has changed since the target was asked for and has not drawn yet. */
  private aimStale = true;
  /** What the backdrop was last told. */
  private roar = 0;

  /** Ambient time: the backdrop, the hover, the rock, the shine, the glint. */
  private clock = 0;
  /** The ambient time the kick-off began at: the struck ball hangs where it was then. */
  private kickClock = 0;

  private state: MenuPhase;
  /** Seconds into the entrance or the kick-off. */
  private phaseT = 0;
  private mode: Mode = "home";
  /** Seconds into a locked patch's "no", or -1. */
  private noT = -1;
  private noSlot: BallSlot | null = null;

  private pointerIn = false;
  private pointerX = 0;
  private pointerY = 0;
  /** The slot under the pointer, as of the last look. */
  private over: BallSlot | null = null;
  /** Where the pointer was when it was last seen on `over`, to the pixel. */
  private anchorX = 0;
  private anchorY = 0;
  /** A mode chosen while the ball was still arriving: it is struck when it has settled. */
  private queued: Mode | null = null;
  private pointerHover: Mode | null = null;
  private domHover: Mode | null = null;
  private pressed: BallSlot | null = null;
  /** What the pointer went down on, while it is down: the ball, the airship or nothing. */
  private press: "ball" | "ship" | null = null;
  private downX = 0;
  private downY = 0;
  /** Where the pointer was when the drag last turned the ball. */
  private handX = 0;
  private handY = 0;
  /** The pointer is over the ball's disc, or over the airship, as of the last look. */
  private overBall = false;
  private overShip = false;

  // The hand's turn of the ball: a rotation in view space, applied on top of the hover's
  // pose. `q*` is it as a unit quaternion, `w*` how fast it turns (radians a second),
  // `h*` how far the hand has turned it since the last `update`.
  private spin: Spin = "still";
  private qw = 1;
  private qx = 0;
  private qy = 0;
  private qz = 0;
  private wx = 0;
  private wy = 0;
  private wz = 0;
  private hx = 0;
  private hy = 0;
  private hz = 0;
  /** Bringing it round for a chosen mode: how far round it was, and for how long now. */
  private snapX = 0;
  private snapY = 0;
  private snapZ = 0;
  private snapT = 0;
  /**
   * The pose the spring in "home" and "rest" pulls the hand's turn towards, as a unit
   * quaternion: none for home, the pose that shows a locked patch for rest.
   */
  private pw = 1;
  private px = 0;
  private py = 0;
  private pz = 0;
  /** Seconds the ball has been at rest showing a locked patch. */
  private restT = 0;

  // What `compose` works out for the frame.
  private readonly ball: BallState = freshBall();
  private ballOn = true;
  /** The row of the hovering ball's centre: where a kick-off finds it. */
  private spotY = 0;
  /** How many pixels deep the struck ball is pressed flat. */
  private squash = 0;
  private spinFrame = 0;
  private shakeX = 0;
  private shakeY = 0;

  // What `hoverAt` works out: how far above its spot the ball is, and its nod.
  private lift = 0;
  private nod = 0;

  // What `flightAt` works out: the ball.
  private fx = 0;
  private fy = 0;
  private fr = 0;

  constructor(opts: MenuSceneOptions) {
    this.seed = opts.seed;
    this.fact = opts.fact;
    this.header = opts.labels.header;
    this.backdrop = new MenuBackdrop({
      seed: opts.seed,
      sign: { header: this.header, text: this.fact },
    });
    this.patches = {
      left: { label: "", icon: "home", accent: MODE_COLORS.home },
      right: { label: "", icon: "away", accent: MODE_COLORS.away },
      top: { label: "", icon: "forward", locked: true },
      bottom: { label: "", icon: "rewind", locked: true },
      backRight: { label: "", icon: "pin", locked: true },
      backLeft: { label: "", icon: "globe", locked: true },
    };
    this.state = opts.intro === false ? "idle" : "intro";
    this.setLabels(opts.labels);
  }

  /** Where the scene is: "intro", "idle", "kickoff" or "done". */
  get phase(): MenuPhase {
    return this.state;
  }

  // -------------------------------------------------------------------------
  // The Scene contract
  // -------------------------------------------------------------------------

  resize(w: number, h: number): void {
    const W = Math.max(1, Math.round(w) || 1);
    const H = Math.max(1, Math.round(h) || 1);
    if (W === this.w && H === this.h) return;
    this.w = W;
    this.h = H;
    const m = menuLayout(W, H);
    this.cx = m.cx;
    this.R = m.ballR;
    this.cy0 = m.ballCy;
    this.logoH = m.logo.h;
    this.open = W >= OPEN_W;
    this.rise = Math.max(
      4,
      Math.round(
        this.open
          ? Math.min(W * HOME_RISE_W, H * HOME_RISE_H)
          : W * HOME_RISE_TALL,
      ),
    );
    this.endR = this.open ? clamp(Math.round(this.R * HOME_END_R), 2, 4) : 2;
    const side = 2 * this.R + 5;
    if (this.pad.w !== side) this.pad = new Surface(side, side);
    this.backdrop.resize(W, H);
    this.aim();
    this.aimStale = true;
    this.layoutLogo();
    // the pointer's last position was in the old size's pixels
    if (this.spin === "drag") this.release();
    this.press = null;
    this.pressed = null;
    this.dropPointer();
  }

  setLighting(light: Lighting): void {
    if (light !== this.light) this.aimStale = true;
    this.light = light;
    this.backdrop.setLighting(light);
  }

  update(dt: number): void {
    const d = dt > 0 ? Math.min(dt, MAX_DT) : 0;
    this.clock += d * (this.reduced ? REDUCED_SPEED : 1);
    if (this.noT >= 0) {
      this.noT += d;
      if (this.noT >= NO_LEN) this.noT = -1;
    }
    if (this.state === "intro") {
      this.phaseT += d;
      if (this.phaseT >= INTRO_LEN) {
        this.state = "idle";
        this.strikeQueued();
      }
    } else if (this.state === "kickoff") {
      this.phaseT += d;
      if (this.phaseT >= (this.reduced ? K_REDUCED : K_END)) {
        this.state = "done";
        const mode = this.mode;
        if (this.onChoose) this.onChoose(mode);
        return;
      }
    } else if (this.state === "idle" && this.spin !== "still") {
      // the hand's turn of the ball runs in real time, reduced motion or not
      this.stepSpin(d);
    }
    // the ball moves under a pointer that is keeping still
    if (this.pointerIn) this.refreshHover();
  }

  draw(s: Surface): void {
    if (s.w !== this.w || s.h !== this.h) this.resize(s.w, s.h);
    const kick = this.state === "kickoff";
    const kt = kick && !this.reduced ? this.phaseT : -1;
    if (this.state === "done" || kt >= K_INK) {
      s.clear(P.ink);
      return;
    }
    const cx = this.cx;
    const R = this.R;
    const home = this.mode === "home";
    const accent = MODE_COLORS[this.mode];
    // when the ball is down, or gone
    const land = K_FLY + (home ? HOME_FLIGHT : AWAY_FLIGHT);

    // HOME: the ground erupts as the ball drops in
    let roar = 0;
    if (home && kt >= land - ROAR_LEAD) {
      const u = (kt - (land - ROAR_LEAD)) / ROAR_RAMP;
      roar = Math.min(1, Math.ceil(u * ROAR_STEPS + 1e-9) / ROAR_STEPS);
    }
    this.setRoar(roar);
    this.backdrop.draw(s, this.clock);
    // the backdrop has now built whatever the last change made stale: ask again
    if (this.aimStale) this.aim();
    this.compose();

    if (
      kt >= K_FLY &&
      kt < land &&
      this.ballOn &&
      this.ball.r < TRAIL_BELOW_R
    ) {
      this.drawTrail(s, kt, accent.light, accent.base);
    }
    // HOME: the mark of the landing, under the ball
    if (home && kt >= land) {
      const k = this.open ? 1 : RIPPLE_TALL;
      const ring = Math.floor((kt - land) * RIPPLE_FPS);
      if (ring < RIPPLE.length) {
        const rx = RIPPLE[ring] * R * k;
        drawRipple(
          s,
          this.tx,
          this.ty,
          rx,
          rx * RIPPLE_FLAT,
          ring,
          ring === 0 ? P.white : ring < 3 ? P.goldLight : P.gold,
        );
      }
      const frame = Math.floor((kt - land) * 15);
      drawBurst(s, this.tx, this.ty, frame, 5, P.white, P.goldLight);
    }
    if (this.state === "intro") {
      const frame = Math.floor(this.phaseT * IN_STAR_FPS);
      if (frame < IN_STAR.length) {
        drawArrival(
          s,
          this.ball.cx,
          this.ball.cy,
          R * IN_STAR[frame],
          frame === IN_STAR.length - 1,
          P.white,
          P.gold,
        );
      }
    }
    if (this.ballOn) this.drawBallNow(s);

    // in front of the ball
    if (kt >= K_HIT) {
      // HOME is struck from in front and below, AWAY from below on HOME's side
      const reach = Math.round(R * Math.SQRT1_2);
      drawStrike(
        s,
        home ? cx : cx - reach,
        home ? this.spotY + R - 1 : this.spotY + reach,
        home ? 0 : -Math.SQRT1_2,
        home ? 1 : Math.SQRT1_2,
        Math.floor((kt - K_HIT) * STRIKE_FPS),
        Math.max(3, R * 0.4),
        this.seed,
        P.white,
        accent.light,
        accent.base,
      );
      if (!home && kt >= land) {
        // the last of it: a twinkle, which goes on winking in the closing iris
        const frame = Math.floor((kt - land) * 20);
        const wink = frame < TWINKLE.length ? frame : frame % 4 < 2 ? 0 : -1;
        // by day the sky behind it is pale, and it needs an edge to show
        const day = !this.light.lightsOn;
        drawTwinkle(
          s,
          this.ax,
          this.ay,
          wink,
          P.white,
          day ? accent.base : accent.light,
          day ? accent.dark : null,
        );
      }
    }

    this.logo.t = this.clock;
    drawLogo(s, cx, this.logoTop, this.logo);

    if (this.shakeY !== 0) shiftRows(s, this.shakeY);
    if (this.shakeX !== 0) shiftCols(s, this.shakeX);

    if (kt >= K_IRIS) {
      const fx = home ? this.tx : this.ax;
      const fy = home ? this.ty : this.ay;
      const hold = home
        ? Math.max(10, Math.round(R * HOME_RING))
        : Math.max(7, Math.round(R * AWAY_RING));
      const far =
        Math.ceil(
          Math.hypot(Math.max(fx, this.w - fx), Math.max(fy, this.h - fy)),
        ) + 1;
      let r: number;
      if (kt < K_HOLD) {
        const u = Math.floor((kt - K_IRIS) * 30) / ((K_HOLD - K_IRIS) * 30);
        r = Math.round(lerp(far, hold, clamp(u * (2 - u))));
      } else if (kt < K_SHUT) {
        r = hold;
      } else {
        const u = Math.floor((kt - K_SHUT) * 30) / ((K_INK - K_SHUT) * 30);
        r = Math.round(lerp(hold, 0, clamp(u))) - 1;
      }
      iris(s, fx, fy, r, P.ink);
    }
  }

  pointer(p: PointerInfo): void {
    if (this.state === "kickoff" || this.state === "done") return;
    if (this.queued !== null) return;
    if (p.type === "leave") {
      // a ball let go of as the pointer went keeps the spin the hand gave it
      if (this.spin === "drag") this.release();
      this.press = null;
      this.pressed = null;
      this.dropPointer();
      return;
    }
    this.pointerIn = true;
    this.pointerX = Number.isFinite(p.x) ? p.x : -1;
    this.pointerY = Number.isFinite(p.y) ? p.y : -1;
    if (p.type === "move") {
      this.follow();
      this.refreshHover();
      return;
    }
    if (p.type === "down") {
      // presses on the ball wait for the entrance to end; the airship takes them at once
      this.refreshHover();
      this.pressed = null;
      this.press = null;
      this.downX = this.pointerX;
      this.downY = this.pointerY;
      this.handX = this.pointerX;
      this.handY = this.pointerY;
      if (this.state === "idle" && this.overBall) {
        this.press = "ball";
        // a turning ball is caught: it is held, and a press on it never chooses
        if (this.isMenu()) this.pressed = this.over;
        else this.grab();
      } else if (this.overShip) {
        this.press = "ship";
      }
      return;
    }
    // up
    this.follow();
    this.refreshHover();
    const press = this.press;
    this.press = null;
    const slot = this.over;
    const onShip = this.overShip;
    const was = this.pressed;
    this.pressed = null;
    // a finger that has lifted is not hovering
    if (p.touch === true) this.dropPointer();
    if (this.spin === "drag") {
      this.release();
      return;
    }
    if (press === "ship") {
      // the same clock the backdrop is drawn with
      if (onShip) this.backdrop.pokeAirship(this.clock);
      return;
    }
    if (was === null || slot !== was || this.state !== "idle") return;
    const mode = modeOf(was);
    if (mode !== null) {
      // from a pose that shows another patch, the ball is brought round first
      this.choose(mode);
      return;
    }
    const locked = lockedOf(was);
    if (locked === null) return;
    this.noT = this.reduced ? -1 : 0;
    this.noSlot = was;
    this.restT = 0;
    if (this.onLocked) this.onLocked(locked);
  }

  setReducedMotion(on: boolean): void {
    this.reduced = on === true;
    this.logo.reducedMotion = this.reduced;
    if (this.reduced) {
      if (this.state === "intro") {
        this.state = "idle";
        this.strikeQueued();
      }
      this.noT = -1;
      // no momentum: a ball still turning comes to rest now
      if (this.spin === "coast") this.comeToRest();
    }
  }

  /**
   * "grabbing" while the ball is dragged; "pointer" over HOME or AWAY, over a locked patch
   * on a ball that is still or at rest, and over the airship; "grab" over the rest of the
   * ball (and all of it while it turns).
   */
  cursor(): SceneCursor {
    const live =
      (this.state === "intro" || this.state === "idle") && this.queued === null;
    if (!live) return "default";
    if (this.spin === "drag") return "grabbing";
    if (!this.pointerIn) return "default";
    if (this.pointerHover !== null) return "pointer";
    if (this.over !== null && this.state === "idle") return "pointer";
    if (this.overBall && this.state === "idle") return "grab";
    if (this.overShip) return "pointer";
    return "default";
  }

  // -------------------------------------------------------------------------
  // For the page
  // -------------------------------------------------------------------------

  /** A new fact for the airship's sign. */
  setFact(text: string): void {
    if (text === this.fact) return;
    this.fact = text;
    this.backdrop.setSign({ header: this.header, text });
  }

  setLabels(labels: MenuLabels): void {
    this.patches.left.label = labels.home;
    this.patches.right.label = labels.away;
    for (const mode of LOCKED_MODES) {
      this.patches[MODE_SLOTS[mode]].label = labels[mode];
    }
    if (labels.header !== this.header) {
      this.header = labels.header;
      this.backdrop.setSign({ header: this.header, text: this.fact });
    }
    if (labels.tagline === undefined || labels.tagline === "") {
      delete this.logo.tagline;
    } else {
      this.logo.tagline = labels.tagline;
    }
    this.layoutLogo();
  }

  /** Today's result per mode, shown as that patch's badge. `null` takes it off again. */
  setScores(scores: Partial<Record<Mode, number | null>>): void {
    this.setScore(this.patches.left, scores.home);
    this.setScore(this.patches.right, scores.away);
  }

  /** 0 new, 0.5 full. */
  setMoonPhase(phase: number): void {
    this.backdrop.setMoonPhase(phase);
  }

  /** Hover or keyboard focus coming from the DOM captions. */
  setHovered(mode: Mode | null): void {
    this.domHover = isMode(mode) ? mode : null;
  }

  /**
   * Start the kick-off from the DOM. False if it cannot start now.
   *
   * While the ball is still arriving the choice is taken at once (`onKickoff` says so, the
   * patch shows pressed, and nothing else can be chosen) but the ball is struck only when
   * it has settled: a ball that jumped to its size to be kicked would be a cut.
   */
  choose(mode: Mode): boolean {
    if (!isMode(mode)) return false;
    if (this.state === "kickoff" || this.state === "done") return false;
    if (this.queued !== null) return false;
    const turned = this.state === "idle" && this.spin !== "still";
    if (turned && this.reduced) {
      // no tween with reduced motion: the ball is simply back in its pose
      this.settle();
      this.press = null;
    } else if (this.state === "intro" || turned) {
      // the ball is still arriving, or turned by the hand: it is brought round first
      if (turned) this.startSnap();
      this.queued = mode;
      this.press = null;
      this.pressed = null;
      this.pointerIn = false;
      this.over = null;
      const hovering = this.pointerHover !== null;
      this.pointerHover = null;
      if (this.onKickoff) this.onKickoff(mode);
      if (hovering && this.onHover) this.onHover(null);
      return true;
    }
    this.kickOff(mode);
    return true;
  }

  /** Back to idle with no entrance: the page is shown again. */
  reset(): void {
    this.state = "idle";
    this.phaseT = 0;
    this.noT = -1;
    this.queued = null;
    this.press = null;
    this.pressed = null;
    this.settle();
    this.roar = 0;
    this.backdrop.setRoar(0);
    this.dropPointer();
  }

  // -------------------------------------------------------------------------
  // Input
  // -------------------------------------------------------------------------

  /**
   * Look under the pointer: which slot it is over, and which mode that hovers. Tells
   * `onHover` when the mode changed.
   */
  private refreshHover(): void {
    let slot: BallSlot | null = null;
    let onBall = false;
    let onShip = false;
    if (this.pointerIn && (this.state === "intro" || this.state === "idle")) {
      this.compose();
      const b = this.ball;
      if (this.ballOn) {
        const dx = this.pointerX - b.cx;
        const dy = this.pointerY - b.cy;
        onBall = dx * dx + dy * dy <= (b.r + 0.5) * (b.r + 0.5);
      }
      // a turning ball is no menu: no patch hovers on it
      if (this.ballOn && this.isMenu()) {
        slot = ballSlotAt(b, this.pointerX, this.pointerY);
        if (slot !== null) {
          this.anchorX = this.pointerX;
          this.anchorY = this.pointerY;
        } else if (
          this.state === "idle" &&
          this.over !== null &&
          Math.abs(this.pointerX - this.anchorX) <= STILL &&
          Math.abs(this.pointerY - this.anchorY) <= STILL
        ) {
          // the ball has breathed or rocked out from under a pointer that kept still
          slot = this.over;
        }
      }
      // the ball is in front of the airship, and takes what is meant for it
      if (!onBall && slot === null) {
        onShip = this.backdrop.airshipAt(
          this.pointerX,
          this.pointerY,
          this.clock,
        );
      }
    }
    this.overBall = onBall || slot !== null;
    this.overShip = onShip;
    this.over = slot;
    const next = modeOf(slot);
    if (next === this.pointerHover) return;
    this.pointerHover = next;
    if (this.onHover) this.onHover(next);
  }

  /** The pointer is gone. */
  private dropPointer(): void {
    this.pointerIn = false;
    this.over = null;
    this.overBall = false;
    this.overShip = false;
    if (this.pointerHover === null) return;
    this.pointerHover = null;
    if (this.onHover) this.onHover(null);
  }

  /** The ball has settled: strike it, if a mode was chosen while it was arriving. */
  private strikeQueued(): void {
    const mode = this.queued;
    if (mode === null) return;
    this.queued = null;
    // `onKickoff` has been told already
    this.kickOff(mode, true);
  }

  private kickOff(mode: Mode, told = false): void {
    this.state = "kickoff";
    this.phaseT = 0;
    this.kickClock = this.clock;
    this.mode = mode;
    this.noT = -1;
    this.press = null;
    this.pressed = null;
    this.pointerIn = false;
    this.over = null;
    this.overBall = false;
    this.overShip = false;
    // the ball is struck in its pose (it is there already: this only makes sure)
    this.spin = "still";
    this.resetTurn();
    this.aim();
    const hovering = this.pointerHover !== null;
    this.pointerHover = null;
    if (!told && this.onKickoff) this.onKickoff(mode);
    if (hovering && this.onHover) this.onHover(null);
  }

  // -------------------------------------------------------------------------
  // The hand's turn of the ball
  // -------------------------------------------------------------------------

  /** A pointer that is down has moved: a press becomes a drag, a drag turns the ball. */
  private follow(): void {
    const far =
      Math.abs(this.pointerX - this.downX) > DRAG ||
      Math.abs(this.pointerY - this.downY) > DRAG;
    if (this.press === "ship") {
      if (far) this.press = null;
      return;
    }
    if (this.press !== "ball") return;
    if (this.isMenu()) {
      if (!far) return;
      // a drag from now on: it turns the ball from where it was pressed
      this.grab();
    }
    if (this.spin !== "drag") return;
    this.compose();
    this.handTurn(this.handX, this.handY, this.pointerX, this.pointerY);
    this.handX = this.pointerX;
    this.handY = this.pointerY;
  }

  /** The hand has the ball: it turns only as the pointer turns it. */
  private grab(): void {
    this.spin = "drag";
    this.pressed = null;
    this.noT = -1;
    this.wx = this.wy = this.wz = 0;
    this.hx = this.hy = this.hz = 0;
  }

  /** The hand lets go: the ball keeps the spin it had, or (no momentum) heads home. */
  private release(): void {
    this.hx = this.hy = this.hz = 0;
    const speed = Math.hypot(this.wx, this.wy, this.wz);
    if (this.reduced || !(speed >= SPIN_SLOW)) {
      if (this.reduced || !Number.isFinite(speed))
        this.wx = this.wy = this.wz = 0;
      this.comeToRest();
      return;
    }
    if (speed > SPIN_MAX) {
      const k = SPIN_MAX / speed;
      this.wx *= k;
      this.wy *= k;
      this.wz *= k;
    }
    this.spin = "coast";
  }

  /** The ball is the menu again, exactly in its pose. */
  private settle(): void {
    this.spin = "still";
    this.resetTurn();
  }

  private resetTurn(): void {
    this.qw = 1;
    this.qx = this.qy = this.qz = 0;
    this.wx = this.wy = this.wz = 0;
    this.hx = this.hy = this.hz = 0;
    this.poseHome();
  }

  /** The ball is the menu: still, or at rest showing a locked patch. */
  private isMenu(): boolean {
    return this.spin === "still" || this.spin === "rest";
  }

  /** The spring pulls towards the menu pose. */
  private poseHome(): void {
    this.pw = 1;
    this.px = this.py = this.pz = 0;
  }

  /**
   * The hand has let the ball go, or its spin has run down: it goes home, unless a locked
   * patch faces the viewer more than HOME, AWAY and every other patch, in which case it
   * turns to show that patch and rests there (see REST_HOLD).
   */
  private comeToRest(): void {
    this.compose();
    let best: BallSlot = "left";
    let most = -Infinity;
    for (const slot of BALL_SLOTS) {
      const facing = ballSlotCenter(this.ball, slot).facing;
      if (facing > most) {
        most = facing;
        best = slot;
      }
    }
    if (lockedOf(best) === null) {
      this.poseHome();
      this.spin = "home";
      return;
    }
    // the shown pose as a quaternion: pitch after yaw, like the hover
    const pose = ballShowPose(best);
    const cy = Math.cos(pose.yaw / 2);
    const sy = Math.sin(pose.yaw / 2);
    const cp = Math.cos(pose.pitch / 2);
    const sp = Math.sin(pose.pitch / 2);
    this.pw = cp * cy;
    this.px = sp * cy;
    this.py = cp * sy;
    this.pz = sp * sy;
    this.restT = 0;
    this.spin = "rest";
  }

  /** A mode is chosen while the ball is turned: bring it round to its pose, quickly. */
  private startSnap(): void {
    this.poseHome();
    this.turnAngle();
    this.snapX = this.ex;
    this.snapY = this.ey;
    this.snapZ = this.ez;
    this.snapT = 0;
    this.wx = this.wy = this.wz = 0;
    this.spin = "snap";
  }

  // What `turnAngle` works out: how far the ball is from its pose, as a rotation vector
  // (radians, view space), and that angle.
  private ex = 0;
  private ey = 0;
  private ez = 0;
  private eAngle = 0;

  /**
   * How far the hand's turn is from the pose the spring pulls towards (no turn at all, but
   * at rest the pose that shows a locked patch), as a rotation vector, the shortest way.
   */
  private turnAngle(): void {
    const { qw, qx, qy, qz, pw, px, py, pz } = this;
    // the turn times the pose's inverse: what carries the pose to where the ball is
    const w = qw * pw + qx * px + qy * py + qz * pz;
    const x = -qw * px + qx * pw - qy * pz + qz * py;
    const y = -qw * py + qx * pz + qy * pw - qz * px;
    const z = -qw * pz - qx * py + qy * px + qz * pw;
    const s = Math.hypot(x, y, z);
    const sign = w < 0 ? -1 : 1;
    const angle = 2 * Math.atan2(s, Math.abs(w));
    const k = s > 1e-12 ? (sign * angle) / s : 0;
    this.ex = x * k;
    this.ey = y * k;
    this.ez = z * k;
    this.eAngle = angle;
  }

  /** Move the hand's turn on by `d` seconds. Only "coast", "home" and "snap" move by time. */
  private stepSpin(d: number): void {
    if (this.spin === "drag") {
      // the speed of the hand, smoothed: what a flick leaves the ball with
      if (d > 0) {
        const k = 1 - Math.exp(-d / SPIN_TAU);
        this.wx += (this.hx / d - this.wx) * k;
        this.wy += (this.hy / d - this.wy) * k;
        this.wz += (this.hz / d - this.wz) * k;
      }
      this.hx = this.hy = this.hz = 0;
      return;
    }
    if (!(d > 0)) return;
    if (this.spin === "snap") {
      this.snapT += d;
      const u = clamp(this.snapT / SNAP);
      if (u >= 1) {
        this.settle();
        this.strikeQueued();
        return;
      }
      // fast at first and easing in: what is left of the way, as a turn
      const left = (1 - u) * (1 - u) * (1 - u);
      this.qw = 1;
      this.qx = this.qy = this.qz = 0;
      this.turn(this.snapX * left, this.snapY * left, this.snapZ * left);
      return;
    }
    if (d > SPIN_GIVE_UP) {
      this.settle();
      return;
    }
    if (this.spin === "rest") {
      // the wait stands still while the pointer is on a patch or pressing the ball
      if (this.over === null && this.press !== "ball") this.restT += d;
      if (this.restT >= REST_HOLD) {
        this.poseHome();
        this.spin = "home";
      }
    }
    const freq = this.reduced ? HOME_FREQ_REDUCED : HOME_FREQ;
    const stiff = freq * freq;
    const damp = 2 * (this.reduced ? 1 : HOME_DAMP) * freq;
    let left = d;
    while (left > 0 && this.spin !== "still") {
      const h = Math.min(SPIN_STEP, left);
      left -= h;
      if (this.spin === "coast") {
        const speed = Math.hypot(this.wx, this.wy, this.wz);
        const next = speed - (FRICTION_FLOOR + FRICTION * speed) * h;
        if (!(next > SPIN_SLOW)) {
          this.comeToRest();
        } else {
          const k = next / speed;
          this.wx *= k;
          this.wy *= k;
          this.wz *= k;
        }
      } else {
        // home or rest: a spring towards the pose, by the shortest way
        this.turnAngle();
        this.wx += (-stiff * this.ex - damp * this.wx) * h;
        this.wy += (-stiff * this.ey - damp * this.wy) * h;
        this.wz += (-stiff * this.ez - damp * this.wz) * h;
        if (
          this.eAngle < SETTLED &&
          Math.hypot(this.wx, this.wy, this.wz) < SETTLED_SPEED
        ) {
          if (this.spin === "home") {
            this.settle();
            return;
          }
          // at rest: held exactly in the pose
          this.qw = this.pw;
          this.qx = this.px;
          this.qy = this.py;
          this.qz = this.pz;
          this.wx = this.wy = this.wz = 0;
          continue;
        }
      }
      this.turn(this.wx * h, this.wy * h, this.wz * h);
    }
  }

  /** Turn the ball further by the rotation vector (x, y, z): radians, view space. */
  private turn(x: number, y: number, z: number): void {
    const a = Math.hypot(x, y, z);
    if (!(a > 1e-12) || !Number.isFinite(a)) return;
    const s = Math.sin(a / 2) / a;
    const dw = Math.cos(a / 2);
    const dx = x * s;
    const dy = y * s;
    const dz = z * s;
    const { qw, qx, qy, qz } = this;
    // the new turn, then the old: q = d q
    let w = dw * qw - dx * qx - dy * qy - dz * qz;
    let i = dw * qx + dx * qw + dy * qz - dz * qy;
    let j = dw * qy - dx * qz + dy * qw + dz * qx;
    let k = dw * qz + dx * qy - dy * qx + dz * qw;
    const n = Math.hypot(w, i, j, k);
    w /= n;
    i /= n;
    j /= n;
    k /= n;
    this.qw = w;
    this.qx = i;
    this.qy = j;
    this.qz = k;
  }

  /**
   * The hand moved from (x0, y0) to (x1, y1) holding the ball: turn it so that the point
   * that was under the pointer is under it still, and count the turn towards its speed.
   */
  private handTurn(x0: number, y0: number, x1: number, y1: number): void {
    const b = this.ball;
    const r = Math.max(1, b.r);
    const ux = (x0 - b.cx) / r;
    const uy = (y0 - b.cy) / r;
    const vx = (x1 - b.cx) / r;
    const vy = (y1 - b.cy) / r;
    const d0 = ux * ux + uy * uy;
    const d1 = vx * vx + vy * vy;
    let rx: number;
    let ry: number;
    let rz: number;
    if (d0 <= GRIP * GRIP && d1 <= GRIP * GRIP) {
      // from the one point on the ball to the other
      const uz = Math.sqrt(1 - d0);
      const vz = Math.sqrt(1 - d1);
      const cx = uy * vz - uz * vy;
      const cy = uz * vx - ux * vz;
      const cz = ux * vy - uy * vx;
      const sin = Math.hypot(cx, cy, cz);
      if (!(sin > 1e-12)) return;
      const k = Math.atan2(sin, ux * vx + uy * vy + uz * vz) / sin;
      rx = cx * k;
      ry = cy * k;
      rz = cz * k;
    } else {
      // a radian a radius, about the axis across the drag
      rx = -(vy - uy);
      ry = vx - ux;
      rz = 0;
    }
    if (!Number.isFinite(rx + ry + rz)) return;
    this.turn(rx, ry, rz);
    this.hx += rx;
    this.hy += ry;
    this.hz += rz;
  }

  /**
   * Put the hand's turn on the ball: its pose becomes the turn after the hover's (the rock
   * and the nod), given back as yaw, pitch and roll in `drawBall`'s order (yaw, then pitch,
   * then roll).
   */
  private applyTurn(b: BallState): void {
    // the hover's pose: pitch after yaw, no roll
    const cy = Math.cos(b.yaw / 2);
    const sy = Math.sin(b.yaw / 2);
    const cp = Math.cos(b.pitch / 2);
    const sp = Math.sin(b.pitch / 2);
    const aw = cp * cy;
    const ax = sp * cy;
    const ay = cp * sy;
    const az = sp * sy;
    const { qw, qx, qy, qz } = this;
    const w = qw * aw - qx * ax - qy * ay - qz * az;
    const x = qw * ax + qx * aw + qy * az - qz * ay;
    const y = qw * ay - qx * az + qy * aw + qz * ax;
    const z = qw * az + qx * ay - qy * ax + qz * aw;
    // the rotation's matrix, the entries that are needed
    const m00 = 1 - 2 * (y * y + z * z);
    const m01 = 2 * (x * y - w * z);
    const m02 = 2 * (x * z + w * y);
    const m11 = 1 - 2 * (x * x + z * z);
    const m20 = 2 * (x * z - w * y);
    const m21 = 2 * (y * z + w * x);
    const m22 = 1 - 2 * (x * x + y * y);
    // it is roll(r) pitch(p) yaw(y): m21 = sin p, m20 = -cos p sin y, m22 = cos p cos y,
    // m01 = -sin r cos p, m11 = cos r cos p
    const sinP = clamp(m21, -1, 1);
    b.pitch = Math.asin(sinP);
    if (Math.abs(sinP) < 1 - 1e-12) {
      b.yaw = Math.atan2(-m20, m22);
      b.roll = Math.atan2(-m01, m11);
    } else {
      // straight up or down: yaw and roll are one turn, so give it all to yaw
      b.yaw = Math.atan2(m02, m00);
      b.roll = 0;
    }
  }

  private setScore(patch: BallPatch, score: number | null | undefined): void {
    if (score === undefined) return;
    if (score === null || !Number.isFinite(score)) delete patch.badge;
    else patch.badge = String(Math.round(score));
  }

  private setRoar(amount: number): void {
    if (amount === this.roar) return;
    this.roar = amount;
    this.backdrop.setRoar(amount);
  }

  // -------------------------------------------------------------------------
  // Layout
  // -------------------------------------------------------------------------

  private layoutLogo(): void {
    this.logo.maxWidth = Math.min(this.w - 26, 132);
    this.logo.maxHeight = this.logoH;
    const size = logoSize(this.logo);
    this.logoTop = Math.max(0, Math.floor((this.logoH - size.h) / 2));
    this.logoW = size.w;
    this.logoBottom = this.logoTop + size.h;
    this.aimAway();
  }

  /**
   * AWAY: where the ball is last seen. On a monitor, low in the sky out to the right; on a
   * phone, in the open sky beside the wordmark, or just under it.
   */
  private aimAway(): void {
    const reach = Math.max(this.R * AWAY_X, this.w * AWAY_X_WIDE);
    const want = this.cx + Math.round(Math.min(this.w * AWAY_X_MAX, reach));
    const clear = this.cx + Math.ceil(this.logoW / 2) + AWAY_CLEAR;
    const last = Math.max(0, this.w - 1 - AWAY_EDGE);
    if (this.open) {
      // low in the sky, far out to the right, over the roofs on the horizon
      this.ax = Math.min(Math.round(this.w * AWAY_LOW_X), last);
      const below = Math.max(0, this.ty - this.logoH);
      this.ay = Math.min(
        this.logoH + Math.max(4, Math.round(below * AWAY_LOW_Y)),
        Math.max(0, this.h - 1),
      );
    } else if (clear <= last) {
      this.ax = clamp(want, clear, last);
      this.ay = Math.round(this.logoH * AWAY_Y);
    } else {
      this.ax = Math.min(want, last);
      this.ay = Math.min(this.logoBottom + AWAY_CLEAR, Math.max(0, this.h - 1));
    }
  }

  /** Ask the backdrop where a ball struck at the stadium comes down. */
  private aim(): void {
    const t = this.backdrop.target();
    const x = Number.isFinite(t.x) ? Math.round(t.x) : this.cx;
    const y = Number.isFinite(t.y) ? Math.round(t.y) : 0;
    this.tx = clamp(x, 0, this.w - 1);
    this.ty = clamp(y, 0, this.h - 1);
    this.aimStale = false;
    this.aimAway();
  }

  // -------------------------------------------------------------------------
  // The frame
  // -------------------------------------------------------------------------

  /**
   * How far through a breath the ball is at ambient time `t`: 1 at the top of an ordinary
   * one, -1 at the bottom, and past 1 in a deep one, of which it takes the share `deep`.
   */
  private breathAt(t: number, deep: number): number {
    let b = Math.sin((TAU * t) / BOB_PERIOD);
    const lap = (t - DEEP_FIRST) % DEEP_EVERY;
    if (lap > 0 && lap < DEEP_LEN) {
      const u =
        lap < DEEP_RISE
          ? lap / DEEP_RISE
          : 1 - (lap - DEEP_RISE) / (DEEP_LEN - DEEP_RISE);
      b += deep * DEEP * smoothstep(0, 1, u);
    }
    return b;
  }

  /**
   * The hover at ambient time `t`: leaves in `lift` how far above its spot the ball is
   * (pixels, not yet whole) and in `nod` its pitch. With reduced motion it hangs still.
   */
  private hoverAt(t: number): void {
    this.lift = 0;
    this.nod = 0;
    if (this.reduced) return;
    this.lift = Math.max(1, Math.round(this.R * BOB)) * this.breathAt(t, 1);
    this.nod = NOD * this.breathAt(t - NOD_LAG * BOB_PERIOD, DEEP_NOD);
  }

  /** Work out the ball and the shake for the current clocks. */
  private compose(): void {
    const b = this.ball;
    const cx = this.cx;
    const R = this.R;
    // a struck ball hangs where the kick-off found it
    this.hoverAt(this.state === "kickoff" ? this.kickClock : this.clock);
    this.spotY = this.cy0 - Math.round(this.lift);
    b.cx = cx;
    b.cy = this.spotY;
    b.r = R;
    b.yaw = ROCK * Math.sin((TAU * this.clock) / ROCK_PERIOD);
    b.pitch = this.nod;
    b.roll = 0;
    // a locked patch under the pointer lifts; HOME and AWAY light from the pointer or the DOM
    b.hovered =
      this.over !== null && modeOf(this.over) === null
        ? this.over
        : slotOf(this.pointerHover ?? this.domHover);
    // a press shows only while the pointer is still on its patch
    b.pressed =
      this.pressed !== null && this.over === this.pressed ? this.pressed : null;
    b.chosen = null;
    b.t = this.reduced ? 0 : this.clock;
    this.ballOn = true;
    this.squash = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this.spinFrame = 0;

    if (this.state === "intro") {
      const t = this.phaseT;
      // swelling fast and slowing, never past its size
      const k = 1 - clamp(t / IN_SWELL);
      b.r = Math.round(R * (1 - k * k * k) * 2) / 2;
      if (b.r < 1) this.ballOn = false;
      // up from below, past where the hover has it, and back onto the hover
      const v = clamp((t - IN_OVER_AT) / (INTRO_LEN - IN_OVER_AT));
      const over = Math.sin(Math.PI * v);
      const above =
        Math.max(1, R * IN_OVER) * over * over - R * IN_BELOW * k * k;
      b.cy = this.cy0 - Math.round(this.lift + above);
      // facing us by the time there is room for a word on a patch
      const side = 1 - clamp(b.r / Math.min(R, IN_FACING_R));
      b.yaw += IN_TURN * side * Math.sqrt(side);
      this.spinFrame = Math.floor(t * 14);
      // a mode chosen already: its patch is held down until the ball is struck
      if (this.queued !== null) {
        b.hovered = null;
        b.pressed = slotOf(this.queued);
      }
    } else if (this.state === "idle") {
      if (this.spin !== "still") {
        // turned by the hand, on top of the hover's pose. While it turns no patch hovers
        // or presses from the pointer, and a mode chosen meanwhile is held down while it
        // comes round; at rest it is a menu again.
        this.applyTurn(b);
        if (this.spin !== "rest") {
          b.hovered = this.queued !== null ? null : slotOf(this.domHover);
          b.pressed = slotOf(this.queued);
        }
      }
      if (this.isMenu() && this.noT >= 0) {
        // "no": the ball shakes its head, less each time
        const u = this.noT / NO_LEN;
        const swing = Math.sin(u * TAU * 3) * (1 - u);
        b.cx = cx + Math.round(swing * Math.max(2, R * 0.09));
        if (this.spin === "still") {
          b.yaw = clamp(b.yaw + swing * 0.1, -ROCK, ROCK);
        }
        if (u < 0.6 && b.pressed === null) b.pressed = this.noSlot;
      }
    } else if (this.state === "kickoff") {
      b.hovered = null;
      b.pressed = null;
      b.chosen = slotOf(this.mode);
      b.t = BALL_T_LIT;
      const kt = this.phaseT;
      if (!this.reduced) {
        if (kt < K_FLY) b.t = kt;
        if (kt >= K_HIT) {
          const f = Math.floor((kt - K_HIT) * 30);
          const shake = f < SHAKE.length ? SHAKE[f] : 0;
          // HOME is hit upwards and the picture jumps up and down, AWAY sideways
          if (this.mode === "home") this.shakeY = shake;
          else this.shakeX = shake;
        }
        if (kt >= K_HIT && kt < K_FLY) {
          // pressed flat against the boot, and springing back already
          const deep = Math.max(1, Math.round(R * SQUASH));
          this.squash = kt < K_HIT + K_DEEP ? deep : Math.max(1, deep >> 1);
          // and it gives a pixel
          b.cy -= 1;
          if (this.mode === "away") b.cx += 1;
        } else if (kt >= K_FLY) {
          const home = this.mode === "home";
          const len = home ? HOME_FLIGHT : AWAY_FLIGHT;
          const after = kt - K_FLY - len;
          this.flightAt(clamp((kt - K_FLY) / len));
          if (after >= 0) {
            if (home) {
              // down: the picture jumps, and the ball bounces once and lies still
              const f = Math.floor(after * 30);
              if (f < THUMP.length) this.shakeY = THUMP[f];
              const hop = clamp((after - HOME_HOP_AT) / HOME_HOP_LEN);
              this.fy -= Math.round(HOME_HOP * Math.sin(Math.PI * hop));
            } else {
              this.ballOn = false;
            }
          }
          // spin in steps: a retro ball turns a notch at a time
          const air = home ? Math.min(kt - K_FLY, len) : kt - K_FLY;
          const turn = Math.floor(air * 30) / 30;
          this.spinFrame = Math.floor(air * 14);
          b.r = Math.round(this.fr * 2) / 2;
          b.cx = Math.round(this.fx);
          b.cy = Math.round(this.fy);
          if (this.mode === "home") {
            b.pitch += turn * 11;
          } else {
            b.yaw = turn * -3;
            b.roll = turn * 9;
          }
        }
      }
    }
  }

  /**
   * The flight, `u` from 0 (struck, at `spotY`) to 1 (down, or gone). Leaves the ball in
   * `fx`, `fy` and `fr`.
   */
  private flightAt(u: number): void {
    const cx = this.cx;
    const R = this.R;
    const y0 = this.spotY;

    if (this.mode === "home") {
      const rEnd = this.endR;
      const tx = this.tx;
      const ty = Math.min(this.ty, y0);
      // straight into the picture: its size and its way across fall together
      const near = nearAt(Math.min(1, u / HOME_UP), HOME_FAR);
      // the apex: over the far side of the stadium, and the whole ball under the wordmark
      const rApex = Math.max(
        rEnd,
        R * (this.open ? HOME_APEX_R : HOME_APEX_R_TALL),
      );
      this.fr = lerp(rApex, R, near);
      this.fx = lerp(tx, cx, near);
      const peak = Math.min(
        ty - 2,
        Math.max(this.logoBottom + rApex + 2, ty - this.rise),
      );
      const fall = HOME_UP + HOME_HANG;
      if (u < HOME_UP) {
        // fast off the boot, slowing all the way up
        const k = 1 - u / HOME_UP;
        this.fy = lerp(y0, peak, 1 - k * k);
      } else if (u < fall) {
        this.fy = peak;
      } else {
        // and it falls away from us, into the bowl
        const k = (u - fall) / (1 - fall);
        this.fy = lerp(peak, ty, k * k);
        this.fr = lerp(rApex, rEnd, k * k);
        this.fx = tx;
      }
    } else {
      const ax = this.ax;
      const ay = this.ay;
      // the corner of the curl
      let kx: number;
      let ky: number;
      if (this.open) {
        kx = ax + R * AWAY_LOW_OUT;
        ky = lerp(y0, ay, AWAY_LOW_UP);
      } else {
        kx = this.w + R * AWAY_SWING;
        ky = lerp(y0, ay, AWAY_SWING_Y);
      }
      const near = this.open
        ? nearAt(u, AWAY_FAR)
        : (1 - u) * (1 - u) * (1 - u);
      const e = 1 - near;
      const a = near * near;
      const c = 2 * e * near;
      const d = e * e;
      this.fr = lerp(1, R, near);
      this.fx = a * cx + c * kx + d * ax;
      this.fy = a * y0 + c * ky + d * ay;
    }
  }

  /**
   * A short streak behind the far ball, in the mode's colour: where the ball was two
   * samples ago to where it was one sample ago, and from there to the ball.
   */
  private drawTrail(s: Surface, kt: number, near: Color, far: Color): void {
    let px = this.ball.cx;
    let py = this.ball.cy;
    for (let i = 1; i <= 2; i++) {
      const u =
        (kt - i * TRAIL_GAP - K_FLY) /
        (this.mode === "home" ? HOME_FLIGHT : AWAY_FLIGHT);
      if (u <= 0) return;
      this.flightAt(clamp(u));
      const x = Math.round(this.fx);
      const y = Math.round(this.fy);
      s.line(px, py, x, y, i === 1 ? near : far);
      // two pixels thick next to the ball, one at its tail
      if (i === 1) {
        const steep = Math.abs(y - py) > Math.abs(x - px);
        s.line(
          px + (steep ? 1 : 0),
          py + (steep ? 0 : 1),
          x + (steep ? 1 : 0),
          y + (steep ? 0 : 1),
          near,
        );
      }
      px = x;
      py = y;
    }
  }

  private drawBallNow(s: Surface): void {
    const b = this.ball;
    const light = this.light;
    if (b.r < TINY_R) {
      const lit = light.lit;
      drawTinyBall(
        s,
        b.cx,
        b.cy,
        b.r,
        this.spinFrame,
        lit(P.ink),
        lit(P.white),
        lit(P.mist),
        lit(P.slate),
        MODE_COLORS[this.mode].base,
      );
      return;
    }
    if (this.squash <= 0) {
      drawBall(s, b, this.patches, light);
      return;
    }
    // Struck in mid-air: the ball is pressed flat where the boot is. It is drawn apart
    // from the picture, cut off along the flat, given an ink edge there and put in place.
    const pad = this.pad;
    const side = pad.w;
    const mid = (side - 1) >> 1;
    const x = b.cx;
    const y = b.cy;
    pad.clear();
    b.cx = mid;
    b.cy = mid;
    drawBall(pad, b, this.patches, light);
    b.cx = x;
    b.cy = y;
    // HOME's flat is level, under the ball. AWAY's is a diagonal, below on HOME's side.
    const home = this.mode === "home";
    const reach = this.R - this.squash;
    const edge = home ? reach : Math.round(reach * Math.SQRT2);
    const ink = light.lit(P.ink);
    const data = pad.data;
    for (let j = 0; j < side; j++) {
      for (let i = 0; i < side; i++) {
        const k = home ? j - mid : j - i;
        const at = j * side + i;
        if (k < edge || data[at] === TRANSPARENT) continue;
        data[at] = k === edge ? ink : TRANSPARENT;
      }
    }
    s.blit(pad, x - mid, y - mid);
  }
}
