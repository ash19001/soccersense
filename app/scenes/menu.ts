/**
 * The menu scene: the home screen's moving picture.
 *
 * A football hangs in the air in front of a stadium in its town, under the player's own
 * sky, and an airship over the town carries the fact of the day.
 * It is the menu, not a ball on a pitch: it floats, and nothing in this scene knows of
 * any ground. Its black patches are the buttons: HOME on the left patch, AWAY on the
 * right, NEXT-GEN on the patch above and RETRO on the one below (each framed in its
 * mode's colour), and four locked patches round the back and the rim. Choosing a mode
 * strikes the ball where it hangs.
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
 * NEXT-GEN and RETRO are not struck: the ball changes era where it hangs. It spins really
 * fast, air streaming round it, becomes the ball of its era in the blur and slows to a stop
 * as that. RETRO goes back in time: an old brown leather ball, laced, which settles, heavier,
 * while the world round it fades to an old photograph (2026-11-13: "transform the football
 * into an olden brown leather football", "spinning really fast then by the time it stops
 * spinning it's the old leather ball"). NEXT-GEN goes into the future, the other way round:
 * it breaks up into big square pixels and comes back together as a sleek ball with light in
 * its seams, which powers on as it stops and lifts, light, while the world turns neon
 * (2026-11-14: "for next gen can we do it turns into a futuristic ball").
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
 * (resize, setLighting, setSign, setMoonPhase, target, setRoar, draw, airshipAt and
 * pokeAirship, which hand the airship the pointer, mascotAt and pokeMascot, which hand it
 * the mascot, and cuesBetween, what is heard of it) and
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
 *
 * Sound. The scene says what is to be heard through `onSound` (see "Sound" below): a soft
 * kick on a press of the ball (a pointer passing over it is silent), wind while it spins,
 * the strike and the flight, HOME's landing and its small bounce, AWAY's twinkle in the
 * sky, the transition as the iris starts to close, the airship's
 * squeak and pop, and the picture's own cues (`backdrop.cuesBetween`: the mascot, the
 * airship's landing, and the match far off, a faint cheer and distant rockets at its goal),
 * forwarded as they are. No horns: the home page is quiet under a distant murmur of the town.
 *
 * Wind is seen as well as heard: while the hand's turn moves the ball, streaks of air run
 * round it just outside its rim the way it turns (see "The wind round the spinning ball"),
 * and the struck ball leaves a rush of them behind it while it is still big.
 */

import {
  BALL_SLOTS,
  ballShowPose,
  ballSlotAt,
  ballSlotCenter,
  drawBall,
  type BallIcon,
  type BallPatch,
  type BallSlot,
  type BallState,
} from "~/art/ball";
import { menuLayout } from "~/art/layout";
import {
  drawFutureBall,
  pixelate,
  type FutureBallState,
} from "~/art/future-ball";
import { drawLeatherBall, type LeatherBallState } from "~/art/leather-ball";
import { lightingFor, type Lighting } from "~/art/lighting";
import { drawLogo, logoSize, type LogoOptions } from "~/art/logo";
import { drawFilmDamage, sepiaTone } from "~/art/old-film";
import { MODE_COLORS, P } from "~/art/palette";
import { drawScanGlitch, neonTone } from "~/art/neon-world";
import { MenuBackdrop, type MenuSign } from "~/art/stadium";
import { bannerWords } from "~/art/stadium-plane";
import { schemeForDay } from "~/art/stadium-club";
import { BEDS, HOME_PAGE } from "~/audio/mix";
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
import type {
  Ambience,
  PointerInfo,
  Scene,
  SceneCursor,
  SoundCue,
} from "./scene";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * The modes that can be played, each on its own patch of the ball: HOME on the left patch,
 * AWAY on the right, NEXT-GEN on the top patch and RETRO on the bottom one (both opened on
 * 2026-11-13).
 */
export const OPEN_MODES: readonly Mode[] = ["home", "away", "nextgen", "retro"];

/**
 * The modes that are not open yet. Each has a patch of its own on the ball: CLOSEST and
 * FURTHEST on the back, directly behind AWAY and HOME, so that half a turn of the ball
 * brings CLOSEST round to where HOME was and FURTHEST to where AWAY was, and GUESS WHO and
 * SHOOTOUT on the rim out past HOME and AWAY, a quarter turn round (a drag to the right
 * brings GUESS WHO to the front, a drag to the left SHOOTOUT).
 */
export type LockedMode = "closest" | "furthest" | "guesswho" | "shootout";

export const LOCKED_MODES: readonly LockedMode[] = [
  "closest",
  "furthest",
  "guesswho",
  "shootout",
];

/** Which patch each mode is on. */
export const MODE_SLOTS: Readonly<Record<Mode | LockedMode, BallSlot>> = {
  home: "left",
  away: "right",
  nextgen: "top",
  retro: "bottom",
  closest: "backRight",
  furthest: "backLeft",
  guesswho: "rimLeft",
  shootout: "rimRight",
};

/** Each open mode's picture on its patch. */
const MODE_ICONS: Readonly<Record<Mode, BallIcon>> = {
  home: "home",
  away: "away",
  nextgen: "nextgen",
  retro: "retro",
};

export interface MenuLabels {
  /** The word on the left patch, for example "HOME". */
  home: string;
  /** The word on the right patch, for example "AWAY". */
  away: string;
  /** The words on the top and bottom patches: "NEXT-GEN", "RETRO". */
  nextgen: string;
  retro: string;
  /** The words on the locked patches, for example "CLOSEST". */
  closest: string;
  furthest: string;
  guesswho: string;
  shootout: string;
  /** The first line of the airship's sign, over the fact, for example "DID YOU KNOW?". */
  header: string;
  /** Under the logo when there is room, for example "DAILY FOOTBALL TRIVIA". */
  tagline?: string;
}

export interface MenuSceneOptions {
  /** The day number: it seeds the picture and picks the stadium's club colours. */
  seed: number;
  /**
   * The fact of the day: on the plane's banner (and on the airship's sign when there are
   * no messages). Any case: both show capitals.
   */
  fact: string;
  /** The airship's sign's messages (`setSignMessages`). */
  messages?: readonly MenuSign[];
  labels: MenuLabels;
  /** Play the entrance. Default true. */
  intro?: boolean;
}

export type MenuPhase = "intro" | "idle" | "kickoff" | "done";

// ---------------------------------------------------------------------------
// Timing (seconds)
//
// Lengths in pixels (a radius, a gap, a hop, a shake, a speed in pixels a second, the
// press's DRAG and STILL) are logical canvas pixels. Fractions of the ball or the canvas
// need nothing.
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
const IN_FACING_R = 72;
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
const STILL = 1;

/**
 * The kick-off, from the moment a mode is chosen. The patch flashes until K_HIT, the ball
 * is struck and squashed until K_FLY, it flies for HOME_FLIGHT or AWAY_FLIGHT seconds, the
 * iris starts at K_IRIS, slows onto a ring at K_RING and goes straight on to shut, the
 * screen is ink at K_INK and the scene is "done" at K_END (see `irisRadius`).
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
const K_IRIS = K_FLY + AWAY_FLIGHT + 0.16;
const K_RING = K_IRIS + 0.44;
const K_INK = K_RING + 0.19;
const K_END = K_INK + 0.05;
/** With reduced motion the kick-off is a cut: the patch lights for this long, then ink. */
const K_REDUCED = 0.15;
/** The screen shake of the strike, one entry a thirtieth of a second. */
const SHAKE: readonly number[] = [4, -4, 2, -2];
/** HOME: the ground starts to roar this long before the ball is down, and is at full voice
 * ROAR_RAMP later, swelling a little every frame. */
const ROAR_LEAD = 0.05;
const ROAR_RAMP = 0.18;

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
const DRAG = 6;
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

// ---------------------------------------------------------------------------
// Sound
// ---------------------------------------------------------------------------

/** A press on the ball is heard at most once every PRESS_GAP seconds. */
const PRESS_GAP = 0.1;
/** Wind is heard while the ball turns faster than this share of SPIN_MAX. */
const WIND_MIN = 0.01;
/**
 * The struck ball's wind: WIND_STRIKE as it leaves the boot, falling to HOME_WIND_END of
 * that by the time HOME's ball is down and AWAY_WIND_END of it as AWAY's vanishes, after
 * which AWAY's dies away over WIND_TAIL seconds. The levels are mix.ts's (HOME_PAGE).
 */
const WIND_STRIKE = HOME_PAGE.strikeWind;
const HOME_WIND_END = HOME_PAGE.homeWindEnd;
const AWAY_WIND_END = HOME_PAGE.awayWindEnd;
const WIND_TAIL = 0.35;
/** The home screen's bed: a town, with a stadium in the distance (mix.ts, BEDS). */
const CROWD = BEDS.places.town.crowd;

// What the ball sends, at mix.ts's powers (HOME_PAGE).
const PRESS: SoundCue = { kind: "kick", power: HOME_PAGE.press };
const STRIKE: SoundCue = { kind: "kick", power: HOME_PAGE.strike };
/** HOME's ball dropping onto the centre spot, and its one small bounce. */
const LAND: SoundCue = { kind: "land", power: HOME_PAGE.land };
const LAND_HOP: SoundCue = { kind: "land", power: HOME_PAGE.hop };
/** AWAY's last twinkle. */
const SPARKLE: SoundCue = { kind: "sparkle" };
/** RETRO and NEXT-GEN: time turning, back or on (a whoosh as the ball whips up to speed). */
const TIME_TURN: SoundCue = { kind: "sweep" };
/**
 * AWAY's sparkle rises to its brightest SPARKLE_RISE seconds after it starts (the recording's
 * second, brighter chime), and the twinkle flares TWINKLE_FLARE seconds after the ball
 * vanishes (frame 2 of TWINKLE at 20 a second): it is sent early by the difference, so the
 * two meet. Its tail rings on under the iris's whoosh.
 */
const SPARKLE_RISE = 0.12;
const TWINKLE_FLARE = 0.1;
const CLOSING: SoundCue = { kind: "transition", opening: false };
const SQUEAK: SoundCue = { kind: "squeak" };
const POP: SoundCue = { kind: "pop" };

/**
 * What the hand has done to the ball. "still": nothing, the ball is the menu. "rest": it
 * has come to rest showing a locked patch, and is a menu there too.
 */
type Spin = "still" | "drag" | "coast" | "rest" | "home" | "snap";

// ---------------------------------------------------------------------------
// The wind round the spinning ball
// ---------------------------------------------------------------------------

/**
 * While the hand's turn moves, streaks of air go round the ball just outside its rim, the
 * way its near side turns: each is born at a point of the rim, runs along it and breaks up.
 * WIND_SLOTS of them at most: WIND_CALM at full speed, the rest only in the gust of a flick.
 */
const WIND_SLOTS = 18;
const WIND_CALM = 12;
/** How long a streak lives, and how long its tail lags its head (seconds). */
const WIND_LIFE = 0.36;
const WIND_LAG = 0.16;
/** The streaks run at this share of the rim's speed, and never faster than WIND_FAST px/s. */
const WIND_PACE = 0.45;
const WIND_FAST = 460;
/** They move on in steps, WIND_FPS a second. */
const WIND_FPS = 24;
/** Below this speed (a share of SPIN_MAX) there is no wind to see. */
const WIND_SHOW = 0.05;
/** A streak is born only where the rim's air is at least this share of its fastest. */
const WIND_WHERE = 0.4;
/** How far outside the rim they run: from WIND_GAP pixels, WIND_SPREAD more at most. */
const WIND_GAP = 6;
const WIND_SPREAD = 0.16;
/** The gust as the ball is flicked: GUST seconds of more streaks, and longer ones. */
const GUST = 0.35;
/**
 * The struck ball's rush of air, while it is big: a streak off its trailing side at each
 * of these offsets across its way (shares of its radius), as long as the way it came in the
 * last RUSH_BACK seconds and RUSH_MAX radii at most.
 */
const RUSH_LINES: readonly number[] = [-0.75, -0.35, 0.05, 0.45, 0.8];
const RUSH_BACK = 0.08;
const RUSH_MAX = 1.6;
/** Only while the ball is at least this share of its size: near, and fast. */
const RUSH_FROM = 0.35;

// ---------------------------------------------------------------------------
// The kick-off: where things go
// ---------------------------------------------------------------------------

/** Below this radius the ball is drawn as a few hand-placed pixels. */
const TINY_R = 9;

/**
 * There are two pictures. On a screen at least OPEN_W wide (a monitor) the stadium stands
 * in the middle of its town with open sky over
 * it and out to both sides. On a narrower one (a phone) the stadium is as wide as the
 * screen and the matchday sign hangs under the wordmark, right over it: the only open sky
 * is beside the wordmark. Each flight has its numbers for both.
 */
const OPEN_W = 400;

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
const HOME_HOP = 6;
const HOME_HOP_AT = 0.066;
const HOME_HOP_LEN = 0.134;
/** The thump of the landing, one entry a thirtieth of a second. */
const THUMP: readonly number[] = [2, -2];
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
const AWAY_CLEAR = 14;
const AWAY_EDGE = 12;
const AWAY_SWING = 1.6;
const AWAY_SWING_Y = 0.15;

/**
 * NEXT-GEN and RETRO: the ball changes era where it hangs, and is not struck (the product
 * owner, 2026-11-13: not shot anywhere, turned into an old brown leather ball; 2026-11-14:
 * "for next gen can we do it turns into a futuristic ball"). Its patch flashes as the
 * others' do, and then, all timed from K_HIT:
 *
 * - It spins really fast where it hangs ("spinning really fast then by the time it stops
 *   spinning it's the old leather ball"), on an axis leaning ERA_LEAN from the upright: up
 *   to ERA_RATE radians a second in ERA_SPIN_UP seconds, at that speed until ERA_FAST, then
 *   slowing evenly to a stop at ERA_SPIN, in the new ball's rest pose. Streaks of air run
 *   round it as round a ball spun by hand, as many as its speed brings.
 * - At full speed it becomes the ball of its era, all of it before it begins to slow, so it
 *   stops as that.
 * - As it stops a ring of light goes out from it (ERA_GLOW, a frame each ERA_GLOW_FPS-th of
 *   a second) and a twinkle is heard.
 * - From ERA_WORLD_AT, as it slows, the world round it changes era in ERA_WORLD's steps, one
 *   an ERA_FILM_FPS-th of a second; the ball keeps its colours.
 *
 * The iris then closes on the ball, onto a ring ERA_RING radii round it: the whole ball.
 */
const ERA_SPIN_UP = 0.08;
const ERA_FAST = 0.36;
const ERA_SPIN = 0.72;
const ERA_RATE = 40;
const ERA_LEAN = 0.35;
const ERA_GLOW: readonly number[] = [3, 7, 11];
const ERA_GLOW_FPS = 20;
const ERA_WORLD_AT = 0.5;
const ERA_WORLD: readonly number[] = [0.35, 0.7, 1];
const ERA_FILM_FPS = 15;
const ERA_RING = 1.15;

/**
 * RETRO goes back in time. It spins as above, and:
 *
 * - From RETRO_TURN_FROM to RETRO_TURN_TO it becomes the old ball: the old one's pixels come
 *   in over it in an ordered dissolve, a sixteenth more each step (`drawLeatherBall`'s
 *   cover). The old ball stops in RETRO_REST, its lace towards us on its lit side.
 * - Stopped, the heavy old ball sinks RETRO_SINK of its radius (RETRO_SINK_LEN seconds) and
 *   comes back up a little (RETRO_BOB of the sink, RETRO_BOB_LEN): a soft thump as it gives.
 * - Its ring of light is warm, and the world becomes an old photograph (`sepiaTone`), with
 *   a vignette and the scratches and dust of old film (`drawFilmDamage`).
 */
const RETRO_REST = { yaw: -0.32, pitch: 0.28, roll: 0.22 } as const;
const RETRO_TURN_FROM = 0.1;
const RETRO_TURN_TO = 0.34;
const RETRO_SINK = 0.05;
const RETRO_SINK_LEN = 0.1;
const RETRO_BOB = 0.4;
const RETRO_BOB_LEN = 0.14;

/**
 * NEXT-GEN goes into the future: RETRO's change the other way round. It spins the other
 * way, its axis leaning the other way, and:
 *
 * - From NEXT_REZ_AT it goes digital: it is drawn in big square pixels (`pixelate`),
 *   NEXT_REZ's share of its radius across (2 px at least), a step each NEXT_REZ_FPS-th of a
 *   second, bigger and bigger; at the biggest (step NEXT_REZ_SWAP) it is the ball of the
 *   future (`drawFutureBall`), in squares that get smaller again until it is whole, its
 *   seams dim.
 * - It stops in NEXT_REST and powers on: its seams flash white for NEXT_FLASH seconds, then
 *   are lit. Light as it is, it lifts NEXT_LIFT of its radius (NEXT_LIFT_LEN seconds) and
 *   settles back NEXT_BOB of that (NEXT_BOB_LEN), and hovers there.
 * - Its ring of light is magenta, and the world turns neon (`neonTone`): NEXT-GEN's
 *   magentas with scan lines, a scan bar going down it and glitches (`drawScanGlitch`).
 */
const NEXT_REST = { yaw: 0.42, pitch: -0.38, roll: -0.18 } as const;
const NEXT_REZ_AT = 0.1;
const NEXT_REZ: readonly number[] = [0.03, 0.06, 0.09, 0.115, 0.08, 0.05, 0.03];
const NEXT_REZ_SWAP = 3;
const NEXT_REZ_FPS = 30;
const NEXT_FLASH = 0.07;
const NEXT_LIFT = 0.06;
const NEXT_LIFT_LEN = 0.14;
const NEXT_BOB = 0.35;
const NEXT_BOB_LEN = 0.2;

/** The ring the iris slows onto, in ball radii: HOME's shows the pitch and the
 * crowd round it, AWAY's a little sky (NEXT-GEN's and RETRO's: ERA_RING). */
const HOME_RING = 0.75;
const AWAY_RING = 0.22;

/** How long each mode's ball is in the air (NEXT-GEN's and RETRO's spin where they are). */
const FLIGHT: Readonly<Record<Mode, number>> = {
  home: HOME_FLIGHT,
  away: AWAY_FLIGHT,
  nextgen: ERA_SPIN,
  retro: ERA_SPIN,
};

/** NEXT-GEN and RETRO change era where they hang: they are not struck and do not fly. */
function isEra(mode: Mode): boolean {
  return mode === "nextgen" || mode === "retro";
}

/** The streak behind the ball once it is small: samples this many seconds apart. */
const TRAIL_GAP = 0.035;
const TRAIL_BELOW_R = 16;

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

/**
 * How open the iris is `kt` seconds into the kick-off: a radius in logical pixels, not yet
 * rounded, from `far` (beyond the farthest corner of the screen) down to `ring` and on to
 * 0. It closes from rest, quickest in the middle and slowing onto the ring, which it
 * reaches at K_RING with no speed left: the beat that shows where the ball went. It does
 * not stop there: it shuts at once, slowly at first and quicker to the end, to nothing at
 * K_INK. (A dead hold on the ring read as a stop-start.) A smooth function of time:
 * rounded only when drawn, it moves every frame.
 */
function irisRadius(kt: number, far: number, ring: number): number {
  if (kt < K_IRIS) return far;
  if (kt < K_RING) {
    const u = (kt - K_IRIS) / (K_RING - K_IRIS);
    return lerp(far, ring, u * u * (3 - 2 * u));
  }
  const u = clamp((kt - K_RING) / (K_INK - K_RING));
  return ring * (1 - u * u);
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
    // (the cross is five pixels wide, three of them core, and the diagonals two)
    const long = Math.round(size);
    const k = Math.round(size * 0.55 * Math.SQRT1_2);
    for (let w = -2; w <= 2; w++) {
      const c = Math.abs(w) < 2 ? core : rays;
      s.line(x - long, y + w, x + long, y + w, c);
      s.line(x + w, y - long, x + w, y + long, c);
    }
    for (let w = 0; w < 2; w++) {
      s.line(x - k + w, y - k, x + k + w, y + k, rays);
      s.line(x - k + w, y + k, x + k + w, y - k, rays);
    }
    s.disc(x, y, Math.max(2, Math.round(size * 0.3)), core);
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
    for (let i = 0; i < 4; i++) s.circle(x, y, r - i, light);
    // a hot core line runs round the middle of the ring
    s.circle(x, y, r - 1, core);
    s.disc(x, y, Math.max(2, Math.round(size * 0.2)), core);
    drawRays(s, x, y, size * 1.05, size * 1.45, core);
  } else if (frame === 2) {
    for (let i = 0; i < 2; i++) {
      s.circle(x, y, Math.round(size * 1.15) - i, light);
    }
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

    // a real little star, its arms tapering to a point round a white heart
    // two pixels across
    const arm = p < life * 0.5 ? 4 : 2;
    s.hline(px - arm, py, arm * 2 + 2, light);
    s.hline(px - arm + 1, py + 1, arm * 2, light);
    s.vline(px, py - arm, arm * 2 + 2, light);
    s.vline(px + 1, py - arm + 1, arm * 2, light);
    s.rect(px, py, 2, 2, core);
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
    const tip = 6;
    const from = a - tip + 1;
    s.hline(x - a, y, tip, tips);
    s.hline(x + from, y, tip, tips);
    s.vline(x, y - a, tip, tips);
    s.vline(x, y + from, tip, tips);
    const d = Math.round(arm * 0.78);
    s.rect(x - d, y - d, 2, 2, tips);
    s.rect(x + d - 2 + 1, y - d, 2, 2, tips);
    s.rect(x - d, y + d - 2 + 1, 2, 2, tips);
    s.rect(x + d - 2 + 1, y + d - 2 + 1, 2, 2, tips);
    return;
  }
  star(s, x, y, a, Math.max(2, Math.round(arm * 0.16)), tips);
  star(
    s,
    x,
    y,
    Math.round(arm * 0.8),
    Math.max(2, Math.round(arm * 0.1)),
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
  // a ring two pixels deep
  const steps = Math.max(8, Math.ceil(rx * 7));
  const dashes = Math.max(6, Math.round((rx / 2) * 0.45));
  // of each dash and its gap, this much is drawn
  const on = stage <= 0 ? 1 : stage === 1 ? 0.75 : stage === 2 ? 0.5 : 0.3;
  for (let j = 0; j < steps; j++) {
    const turn = j / steps;
    if ((turn * dashes) % 1 >= on) continue;
    const a = turn * TAU;
    for (let i = 0; i < 2; i++) {
      s.px(
        Math.round(x + Math.cos(a) * (rx - i)),
        Math.round(y + Math.sin(a) * (ry - i)),
        c,
      );
    }
  }
}

/** How long the arms of the twinkle are, frame by frame. */
const TWINKLE: readonly number[] = [1, 3, 6, 5, 3, 1];

/**
 * A four-point twinkle: it opens, flares and closes to a point. Its arms are twice
 * TWINKLE's (frame by frame) long: fine 1 px rays with a white core that runs most of their
 * length, a heart three pixels across and sparkles on the diagonals; by day the dark star
 * behind it.
 */
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
  const A = arm * 2;
  if (edge !== null && frame >= 0) {
    if (arm >= 3) {
      star(s, x, y, A + 1, arm >= 5 ? 3 : 2, edge);
    } else {
      s.rect(x - A - 2, y - 1, 2 * A + 5, 3, edge);
      s.rect(x - 1, y - A - 2, 3, 2 * A + 5, edge);
      if (arm === 1) s.rect(x - 2, y - 2, 5, 5, edge);
    }
  }
  if (arm >= 3) {
    const a = edge === null ? A : A - 2;
    s.hline(x - a, y, a * 2 + 1, tips);
    s.vline(x, y - a, a * 2 + 1, tips);
    s.hline(x - a + 3, y, a * 2 - 5, core);
    s.vline(x, y - a + 3, a * 2 - 5, core);
    s.rect(x - 1, y - 1, 3, 3, tips);
    s.hline(x - 1, y, 3, core);
    s.vline(x, y - 1, 3, core);
    for (let d = 2; d <= (arm >= 5 ? 4 : 3); d++) {
      s.px(x - d, y - d, tips);
      s.px(x + d, y - d, tips);
      s.px(x - d, y + d, tips);
      s.px(x + d, y + d, tips);
    }
    return;
  }
  if (arm === 1) {
    s.hline(x - 2, y, 5, tips);
    s.vline(x, y - 2, 5, tips);
  } else {
    // between winks: a speck with four points
    s.hline(x - 1, y, 3, tips);
    s.vline(x, y - 1, 3, tips);
  }
  s.px(x, y, core);
}

/**
 * NEXT-GEN's and RETRO's spin, `u` seconds after K_HIT: how fast it goes (radians a
 * second), up to ERA_RATE in ERA_SPIN_UP, held until ERA_FAST, then slowing evenly to
 * nothing at ERA_SPIN.
 */
function eraRate(u: number): number {
  if (!(u > 0) || u >= ERA_SPIN) return 0;
  if (u < ERA_SPIN_UP) return (ERA_RATE * u) / ERA_SPIN_UP;
  if (u < ERA_FAST) return ERA_RATE;
  return ERA_RATE * (1 - (u - ERA_FAST) / (ERA_SPIN - ERA_FAST));
}

/** How far the spin has turned the ball by `u` (radians): `eraRate` run up. */
function eraSpun(u: number): number {
  if (!(u > 0)) return 0;
  const up = ERA_SPIN_UP;
  if (u < up) return (0.5 * ERA_RATE * u * u) / up;
  const a1 = 0.5 * ERA_RATE * up;
  if (u < ERA_FAST) return a1 + ERA_RATE * (u - up);
  const a2 = a1 + ERA_RATE * (ERA_FAST - up);
  const len = ERA_SPIN - ERA_FAST;
  const d = Math.min(u, ERA_SPIN) - ERA_FAST;
  return a2 + ERA_RATE * (d - (d * d) / (2 * len));
}

/**
 * The ring of light as the new ball stops: frame `frame` of ERA_GLOW, a circle that many
 * pixels outside the ball, `hot` in the first frame and `light` after, a second one inside
 * it a step dimmer and an `edge` outside it for two frames. Raw colours: a light.
 */
function drawGlowRing(
  s: Surface,
  x: number,
  y: number,
  r: number,
  frame: number,
  hot: Color,
  light: Color,
  base: Color,
  edge: Color,
): void {
  if (frame < 0 || frame >= ERA_GLOW.length) return;
  const out = r + ERA_GLOW[frame];
  s.circle(x, y, out, frame === 0 ? hot : light);
  s.circle(x, y, out - 1, frame === 0 ? light : base);
  if (frame < 2) s.circle(x, y, out + 1, edge);
}

/**
 * The ball when it is too small for its panels, 2 to 18 px across: a speck with a white
 * heart; from 6 px an outlined ball with its shaded side (a crescent at the
 * bottom right), a dark panel that crosses it as it spins and a stripe of the mode's
 * colour following it.
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
  if (r < 3) {
    // a speck: an ink dot with a white heart
    s.disc(cx, cy, r < 2 ? 1 : 1.5, ink);
    s.px(cx, cy, white);
    if (r >= 2) s.px(cx + 1, cy, white);
    return;
  }
  s.disc(cx, cy, r, ink);
  s.disc(cx, cy, r - 1, white);
  // the shaded side: the white pixels far enough to the bottom right
  const reach = Math.ceil(r);
  const edge = (r - 1) * (r < 5 ? 0.7 : 0.62);
  for (let dy = -reach; dy <= reach; dy++) {
    for (let dx = -reach; dx <= reach; dx++) {
      const px = cx + dx;
      const py = cy + dy;
      if (px < s.clipX0 || px >= s.clipX1 || py < s.clipY0 || py >= s.clipY1) {
        continue;
      }
      if (s.data[py * s.w + px] !== white) continue;
      if ((dx + dy) * Math.SQRT1_2 >= edge) s.px(px, py, shade);
    }
  }
  const f = ((frame % 4) + 4) % 4;
  const k = Math.max(1, Math.round(r) - 3);
  if (r < 5) {
    // 6 to 9 px across: a 2 x 2 panel and two pixels of colour, swapping places
    const oy = f === 0 ? -k : f === 1 ? -1 : f === 2 ? k - 1 : 0;
    if (f !== 3) s.rect(cx - 1, cy + oy, 2, 2, dark);
    const ay = f === 0 ? k : f === 1 ? -k : f === 2 ? -1 : 0;
    s.hline(cx - 1, cy + ay, 2, accent);
    return;
  }
  // 10 to 18 px across: a rounded panel three across, the colour a stripe of three
  const oy = f === 0 ? -k : f === 1 ? -1 : f === 2 ? k - 2 : 0;
  if (f !== 3) {
    s.hline(cx - 1, cy + oy, 3, dark);
    s.rect(cx - 2, cy + oy + 1, 4, 2, dark);
    s.hline(cx - 1, cy + oy + 3, 2, dark);
  }
  const ay = f === 0 ? k : f === 1 ? -k + 1 : f === 2 ? -2 : 1;
  s.hline(cx - k + 1, cy + ay, 3, accent);
}

// ---------------------------------------------------------------------------
// The scene
// ---------------------------------------------------------------------------

/**
 * A streak of air: the arc of the circle of radius `rho` round (cx, cy) from angle `a0`
 * (its tail) to `a1` (its head), a pixel at a time. Bright at the head, airier down to the
 * tail; `broken`, it is breaking up: every other pixel, and the head gone dim.
 */
function drawArc(
  s: Surface,
  cx: number,
  cy: number,
  rho: number,
  a0: number,
  a1: number,
  broken: boolean,
  head: Color,
  body: Color,
  tail: Color,
): void {
  const span = a1 - a0;
  const steps = Math.ceil((Math.abs(span) * rho) / 0.7);
  if (!(steps >= 1) || steps > 4000) return;
  // the streak 2 px thick and its head 4; broken up, it is every other pair of pixels
  let lx = Number.NaN;
  let ly = Number.NaN;
  let n = 0;
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const a = a0 + span * f;
    const x = Math.round(cx + rho * Math.cos(a));
    const y = Math.round(cy + rho * Math.sin(a));
    if (x === lx && y === ly) continue;
    lx = x;
    ly = y;
    n++;
    if (broken && Math.floor(n / 2) % 2 === 0) continue;
    const c = f >= 0.7 ? (broken ? body : head) : f >= 0.35 ? body : tail;
    s.px(x, y, c);
    // the head is four pixels thick and the rest two, thickened outwards
    const isHead = !broken && f >= 0.7;
    const extra = isHead ? 3 : 1;
    if (extra > 0) {
      const a2 = Math.atan2(y - cy, x - cx);
      const ex = Math.cos(a2);
      const ey = Math.sin(a2);
      const sx = Math.abs(ex) >= Math.abs(ey) ? Math.sign(ex) : 0;
      const sy = Math.abs(ey) > Math.abs(ex) ? Math.sign(ey) : 0;
      for (let e = 1; e <= extra; e++) {
        s.px(x + sx * e, y + sy * e, isHead ? (e < 2 ? head : body) : c);
      }
    }
  }
}

function slotOf(mode: Mode | null): BallSlot | null {
  return mode === null || !isMode(mode) ? null : MODE_SLOTS[mode];
}

function modeOf(slot: BallSlot | null): Mode | null {
  for (const mode of OPEN_MODES) if (MODE_SLOTS[mode] === slot) return mode;
  return null;
}

function lockedOf(slot: BallSlot | null): LockedMode | null {
  for (const mode of LOCKED_MODES) if (MODE_SLOTS[mode] === slot) return mode;
  return null;
}

function isMode(v: unknown): v is Mode {
  return (OPEN_MODES as readonly unknown[]).includes(v);
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
  /** The pointer's hover changed (null: it is over no open mode's patch). */
  onHover: ((mode: Mode | null) => void) | null = null;
  /** A mode was chosen and the transition starts now. */
  onKickoff: ((mode: Mode) => void) | null = null;
  /** The transition is over and the page moves on. Exactly once per kick-off. */
  onChoose: ((mode: Mode) => void) | null = null;
  /** A locked patch was pressed and released: which mode it is. */
  onLocked: ((mode: LockedMode) => void) | null = null;
  /**
   * The patch of a mode played today (one with a score, `setScores`) was pressed and
   * released. A mode is played once a day, so there is no kick-off: the page shows the
   * day's game again instead.
   */
  onReview: ((mode: Mode) => void) | null = null;
  /** Something to be heard (the Scene contract): set by the host. */
  onSound: ((cue: SoundCue) => void) | null = null;

  private readonly seed: number;
  private readonly backdrop: MenuBackdrop;
  /** The airship's sign: the header (from the labels) and the fact. */
  private header: string;
  private fact: string;
  /** The plane tows the fact across the sky (the page turns it off on a phone). */
  private planeOn = true;
  private readonly patches: Record<BallSlot, BallPatch>;
  private readonly logo: LogoOptions = { maxWidth: 1, maxHeight: 1, t: 0 };
  private logoTop = 0;
  private light: Lighting = lightingFor({ elevation: 45, morning: false });
  /**
   * For one frame after a change of light the ball keeps the last light, so the
   * sky, the ball and the picture under it are each redrawn in a frame of their own.
   */
  private ballLight: Lighting | null = null;
  private drawn = false;
  private reduced = false;

  // The canvas, and the five numbers the scene takes from menuLayout.
  private w = 1;
  private h = 1;
  /** Whether `resize` has laid the scene out yet. */
  private sized = false;
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
  /**
   * NEXT-GEN and RETRO: how fast the ball is spinning as it changes era (radians a second,
   * for the streaks of air; negative the other way).
   */
  private spinRate = 0;
  /**
   * RETRO: the old ball this frame (its pose, from the rest pose and what is left of the
   * spin) and how much of it covers the menu ball (`oldCover`, 0 to 1: the dissolve).
   */
  private readonly oldBall: LeatherBallState = {
    cx: 0,
    cy: 0,
    r: 1,
    yaw: 0,
    pitch: 0,
    roll: 0,
  };
  private oldCover = 0;
  /**
   * NEXT-GEN: the ball of the future this frame (its pose, as the old ball's), whether it is
   * drawn instead of the menu ball (`newOn`), its seams' power (0 to 3), and the squares the
   * ball is drawn in as it goes digital (`rezBlock` pixels across, 0 for none, in the
   * change's frame `rezFrame`).
   */
  private readonly newBall: FutureBallState = {
    cx: 0,
    cy: 0,
    r: 1,
    yaw: 0,
    pitch: 0,
    roll: 0,
  };
  private newOn = false;
  private newPower = 2;
  private rezBlock = 0;
  private rezFrame = 0;
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
  /** Real time, reduced motion or not: what the sounds are timed by. */
  private realT = 0;
  /** When a press on the ball was last heard. */
  private lastPress = -Infinity;
  /** When the hand last flicked the ball (real time): the gust of wind round it. */
  private flickT = -Infinity;
  /** The iris's sound has been sent for this kick-off. */
  private closing = false;

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
  /** What the pointer went down on, while it is down: the ball, the airship, the mascot or
   * nothing. */
  private press: "ball" | "ship" | "mascot" | null = null;
  private downX = 0;
  private downY = 0;
  /** Where the pointer was when the drag last turned the ball. */
  private handX = 0;
  private handY = 0;
  /** The pointer is over the ball's disc, the airship or the mascot, as of the last look. */
  private overBall = false;
  private overShip = false;
  private overMascot = false;

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
    // A plane tows the fact across the sky, and the sign shows the messages.
    this.backdrop.setBanner(bannerWords(this.header, this.fact));
    if (opts.messages) this.backdrop.setMessages(opts.messages);
    // The stadium wears the day's club colours (the seed is the day number).
    this.backdrop.setScheme(schemeForDay(opts.seed).id);
    this.patches = {
      left: { label: "", icon: "home", accent: MODE_COLORS.home },
      right: { label: "", icon: "away", accent: MODE_COLORS.away },
      top: { label: "", icon: "nextgen", accent: MODE_COLORS.nextgen },
      bottom: { label: "", icon: "retro", accent: MODE_COLORS.retro },
      backRight: { label: "", icon: "pin", locked: true },
      backLeft: { label: "", icon: "globe", locked: true },
      rimLeft: { label: "", icon: "shirt", locked: true },
      rimRight: { label: "", icon: "goal", locked: true },
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
    if (this.sized && W === this.w && H === this.h) return;
    this.w = W;
    this.h = H;
    this.sized = true;
    const m = menuLayout(W, H);
    this.cx = m.cx;
    this.R = m.ballR;
    this.cy0 = m.ballCy;
    this.logoH = m.logo.h;
    this.open = W >= OPEN_W;
    this.rise = Math.max(
      8,
      Math.round(
        this.open
          ? Math.min(W * HOME_RISE_W, H * HOME_RISE_H)
          : W * HOME_RISE_TALL,
      ),
    );
    this.endR = this.open ? clamp(Math.round(this.R * HOME_END_R), 4, 8) : 4;
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
    if (light !== this.light) {
      this.aimStale = true;
      if (this.drawn && true) this.ballLight ??= this.light;
    }
    this.light = light;
    this.backdrop.setLighting(light);
  }

  update(dt: number): void {
    const d = dt > 0 ? Math.min(dt, MAX_DT) : 0;
    this.realT += d;
    const was = this.clock;
    this.clock += d * (this.reduced ? REDUCED_SPEED : 1);
    // what is heard of the picture, on the clock it is drawn with
    if (this.onSound && this.state !== "done" && this.clock > was) {
      for (const cue of this.backdrop.cuesBetween(was, this.clock)) {
        this.onSound(cue);
      }
    }
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
      const before = this.phaseT;
      this.phaseT += d;
      this.kickSounds(before, this.phaseT);
      if (this.phaseT >= (this.reduced ? K_REDUCED : K_END)) {
        this.state = "done";
        const mode = this.mode;
        if (this.onChoose) this.onChoose(mode);
        return;
      }
    } else if (this.state === "idle" && this.spin !== "still") {
      // the hand's turn of the ball runs in real time, reduced motion or not
      this.stepSpin(d);
      const speed = this.spinSpeed();
      if (speed > WIND_MIN) this.sound({ kind: "wind", speed });
    }
    // the ball moves under a pointer that is keeping still
    if (this.pointerIn) this.refreshHover();
  }

  draw(s: Surface): void {
    if (!this.sized || s.w !== this.w || s.h !== this.h) {
      this.resize(s.w, s.h);
    }
    this.drawn = true;
    const kick = this.state === "kickoff";
    const kt = kick && !this.reduced ? this.phaseT : -1;
    if (this.state === "done" || kt >= K_INK) {
      s.clear(P.ink);
      return;
    }
    const cx = this.cx;
    const R = this.R;
    const mode = this.mode;
    const home = mode === "home";
    const accent = MODE_COLORS[mode];
    // when the ball is down, or gone
    const land = K_FLY + FLIGHT[mode];

    // HOME: the ground erupts as the ball drops in
    let roar = 0;
    if (home && kt >= land - ROAR_LEAD) {
      const u = (kt - (land - ROAR_LEAD)) / ROAR_RAMP;
      // swelling fast and settling at full voice
      const k = 1 - clamp(u);
      roar = 1 - k * k;
    }
    this.setRoar(roar);
    this.backdrop.draw(s, this.clock);
    // the backdrop has now built whatever the last change made stale: ask again
    if (this.aimStale) this.aim();
    this.compose();

    const era = isEra(mode);
    if (!era && kt >= K_FLY && kt < land && this.ballOn) {
      if (this.ball.r < TRAIL_BELOW_R) {
        this.drawTrail(s, kt, accent.light, accent.base);
      } else if (this.ball.r >= this.R * RUSH_FROM) {
        this.drawRush(s, kt);
      }
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
      drawBurst(s, this.tx, this.ty, frame, 10, P.white, P.goldLight);
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
    // the air the turning ball drags round with it, just outside its rim
    if (this.state === "idle") this.drawWind(s);
    else if (era && kt >= K_HIT) this.drawEraWind(s);
    if (this.ballOn) this.drawBallNow(s);
    // NEXT-GEN: going digital, in big square pixels
    if (this.rezBlock > 0) {
      const b = this.ball;
      pixelate(s, b.cx, b.cy, b.r, this.rezBlock, this.rezFrame, this.seed);
    }

    // in front of the ball (NEXT-GEN's and RETRO's are not struck)
    if (kt >= K_HIT && !era) {
      // HOME is struck from in front and below, AWAY from below on HOME's side
      const reach = Math.round(R * Math.SQRT1_2);
      const sx = mode === "away" ? cx - reach : cx;
      const sy = mode === "home" ? this.spotY + R - 1 : this.spotY + reach;
      drawStrike(
        s,
        sx,
        sy,
        mode === "away" ? -Math.SQRT1_2 : 0,
        mode === "home" ? 1 : Math.SQRT1_2,
        Math.floor((kt - K_HIT) * STRIKE_FPS),
        Math.max(6, R * 0.4),
        this.seed,
        P.white,
        accent.light,
        accent.base,
      );
      if (mode === "away" && kt >= land) {
        const x = this.ax;
        const y = this.ay;
        // the last of it: a twinkle, which goes on winking in the closing iris
        const frame = Math.floor((kt - land) * 20);
        const wink =
          frame < 0
            ? -2
            : frame < TWINKLE.length
              ? frame
              : frame % 4 < 2
                ? 0
                : -1;
        // by day the sky behind it is pale, and it needs an edge to show
        const day = !this.light.lightsOn;
        if (wink > -2) {
          drawTwinkle(
            s,
            x,
            y,
            wink,
            P.white,
            day ? accent.base : accent.light,
            day ? accent.dark : null,
          );
        }
      }
    }

    this.logo.t = this.clock;
    drawLogo(s, cx, this.logoTop, this.logo);

    if (this.shakeY !== 0) shiftRows(s, this.shakeY);
    if (this.shakeX !== 0) shiftCols(s, this.shakeX);

    // RETRO: the world an old photograph round the old ball, its ring of light, and the
    // scratches and dust of old film over it all; NEXT-GEN: the world neon round the ball
    // of the future, its ring of light, and the screen's scan bar and glitches
    if (mode === "retro" && kt >= K_HIT) this.drawOldTimes(s, kt - K_HIT);
    if (mode === "nextgen" && kt >= K_HIT) this.drawNewTimes(s, kt - K_HIT);

    if (kt >= K_IRIS) {
      const fx = this.irisX();
      const fy = this.irisY();
      const hold = home
        ? Math.max(20, Math.round(R * HOME_RING))
        : era
          ? Math.round(R * ERA_RING)
          : Math.max(14, Math.round(R * AWAY_RING));
      const far =
        Math.ceil(
          Math.hypot(Math.max(fx, this.w - fx), Math.max(fy, this.h - fy)),
        ) + 1;
      // whole pixels only now; under one pixel it is shut
      const r = Math.round(irisRadius(kt, far, hold));
      iris(s, fx, fy, r >= 1 ? r : -1, P.ink);
    }
  }

  /**
   * Where the iris closes: where the ball came down, or went (NEXT-GEN's and RETRO's, where
   * it is).
   */
  private irisX(): number {
    const m = this.mode;
    return m === "home" ? this.tx : m === "away" ? this.ax : this.ball.cx;
  }

  private irisY(): number {
    const m = this.mode;
    return m === "home" ? this.ty : m === "away" ? this.ay : this.ball.cy;
  }

  /**
   * RETRO, `u` seconds after K_HIT: the world fades to an old photograph round the old
   * ball (in ERA_WORLD's steps), the ring of warm light goes out from the ball as it stops
   * spinning, and the frame has old film's scratches and dust.
   */
  private drawOldTimes(s: Surface, u: number): void {
    const b = this.ball;
    if (u >= ERA_WORLD_AT) {
      const step = Math.floor((u - ERA_WORLD_AT) * ERA_FILM_FPS);
      const level = ERA_WORLD[Math.min(step, ERA_WORLD.length - 1)];
      sepiaTone(s, level, b);
    }
    if (u >= ERA_SPIN) {
      const frame = Math.floor((u - ERA_SPIN) * ERA_GLOW_FPS);
      const r = Math.round(b.r);
      drawGlowRing(
        s,
        b.cx,
        b.cy,
        r,
        frame,
        P.white,
        P.goldLight,
        P.retroLight,
        P.retro,
      );
    }
    if (u >= ERA_WORLD_AT) {
      const frame = Math.floor((u - ERA_WORLD_AT) * ERA_FILM_FPS);
      drawFilmDamage(s, frame, this.seed);
    }
  }

  /**
   * NEXT-GEN, `u` seconds after K_HIT: the world turns neon round the ball of the future
   * (in ERA_WORLD's steps), the ring of magenta light goes out from the ball as it stops
   * spinning and powers on, and the screen has its scan bar and glitches.
   */
  private drawNewTimes(s: Surface, u: number): void {
    const b = this.ball;
    if (u >= ERA_WORLD_AT) {
      const step = Math.floor((u - ERA_WORLD_AT) * ERA_FILM_FPS);
      const level = ERA_WORLD[Math.min(step, ERA_WORLD.length - 1)];
      neonTone(s, level, b);
    }
    if (u >= ERA_SPIN) {
      const frame = Math.floor((u - ERA_SPIN) * ERA_GLOW_FPS);
      const r = Math.round(b.r);
      drawGlowRing(
        s,
        b.cx,
        b.cy,
        r,
        frame,
        P.white,
        P.nextgenLight,
        P.nextgen,
        P.nextgenDark,
      );
    }
    if (u >= ERA_WORLD_AT) {
      const frame = Math.floor((u - ERA_WORLD_AT) * ERA_FILM_FPS);
      drawScanGlitch(s, frame, this.seed);
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
      // silent: only a press on the ball is heard
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
        this.pressBall();
        // a turning ball is caught: it is held, and a press on it never chooses
        if (this.isMenu()) this.pressed = this.over;
        else this.grab();
      } else if (this.overShip) {
        this.press = "ship";
      } else if (this.overMascot) {
        this.press = "mascot";
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
    const onMascot = this.overMascot;
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
      if (!onShip) return;
      const poke = this.backdrop.pokeAirship(this.clock);
      if (poke === "wobble") this.sound(SQUEAK);
      else if (poke === "pop") this.sound(POP);
      return;
    }
    if (press === "mascot") {
      // he does a trick (his touches are the picture's own cues)
      if (onMascot) this.backdrop.pokeMascot(this.clock);
      return;
    }
    if (was === null || slot !== was || this.state !== "idle") return;
    const mode = modeOf(was);
    if (mode !== null && this.played(mode)) {
      if (this.onReview) this.onReview(mode);
      return;
    }
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
    if (this.overShip || this.overMascot) return "pointer";
    return "default";
  }

  /** A town with a stadium in the distance, by day or by night. */
  ambience(): Ambience {
    return {
      venue: "town",
      crowd: CROWD,
      night: this.light.phase === "night",
    };
  }

  // -------------------------------------------------------------------------
  // For the page
  // -------------------------------------------------------------------------

  /** A new fact: on the plane's banner (and, with no messages, the sign). */
  setFact(text: string): void {
    if (text === this.fact) return;
    this.fact = text;
    this.backdrop.setSign({ header: this.header, text });
    this.backdrop.setBanner(this.planeOn ? bannerWords(this.header, text) : "");
  }

  /**
   * Whether the plane flies with the fact on its banner: on (the default) on a large
   * screen; off on a phone, whose sky is crowded enough with the wordmark and the airship.
   * Off takes it out of the sky at once, mid-pass or not.
   */
  setPlane(on: boolean): void {
    if (on === this.planeOn) return;
    this.planeOn = on;
    this.backdrop.setBanner(on ? bannerWords(this.header, this.fact) : "");
  }

  /**
   * What the airship's sign says, one message after another: the player's day
   * (today's totals, their place, the streak, how many played), words from the page.
   * None: the fact.
   */
  setSignMessages(messages: readonly MenuSign[]): void {
    this.backdrop.setMessages(messages);
  }

  setLabels(labels: MenuLabels): void {
    for (const mode of OPEN_MODES) {
      const patch = this.patches[MODE_SLOTS[mode]];
      patch.label = labels[mode];
      patch.icon = MODE_ICONS[mode];
    }
    for (const mode of LOCKED_MODES) {
      this.patches[MODE_SLOTS[mode]].label = labels[mode];
    }
    if (labels.header !== this.header) {
      this.header = labels.header;
      this.backdrop.setSign({ header: this.header, text: this.fact });
      this.backdrop.setBanner(bannerWords(this.header, this.fact));
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
    for (const mode of OPEN_MODES) {
      this.setScore(this.patches[MODE_SLOTS[mode]], scores[mode]);
    }
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
   * Start the kick-off from the DOM. False if it cannot start now, or ever today: a mode
   * played today (one with a score) is not played again.
   *
   * While the ball is still arriving the choice is taken at once (`onKickoff` says so, the
   * patch shows pressed, and nothing else can be chosen) but the ball is struck only when
   * it has settled: a ball that jumped to its size to be kicked would be a cut.
   */
  choose(mode: Mode): boolean {
    if (!isMode(mode)) return false;
    // played today: once a day (`onReview` is what its patch does)
    if (this.played(mode)) return false;
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
    let onMascot = false;
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
        onMascot =
          !onShip &&
          this.backdrop.mascotAt(this.pointerX, this.pointerY, this.clock);
      }
    }
    this.overBall = onBall || slot !== null;
    this.overShip = onShip;
    this.overMascot = onMascot;
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
    this.overMascot = false;
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
    this.closing = false;
    this.kickClock = this.clock;
    this.mode = mode;
    this.noT = -1;
    this.press = null;
    this.pressed = null;
    this.pointerIn = false;
    this.over = null;
    this.overBall = false;
    this.overShip = false;
    this.overMascot = false;
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
  // Sound
  // -------------------------------------------------------------------------

  private sound(cue: SoundCue): void {
    if (this.onSound) this.onSound(cue);
  }

  /**
   * The pointer pressed the ball (a click, or the start of a drag): a soft kick, unless one
   * was heard a moment ago. A pointer that only passes over it is not heard.
   */
  private pressBall(): void {
    if (this.realT - this.lastPress < PRESS_GAP) return;
    this.lastPress = this.realT;
    this.sound(PRESS);
  }

  /**
   * How fast the hand's turn of the ball is going: 0 at rest, 1 at the hardest flick. A
   * ball brought round for a chosen mode turns as fast as its tween.
   */
  private spinSpeed(): number {
    this.omega();
    const w = Math.hypot(this.ox, this.oy, this.oz);
    return Number.isFinite(w) ? clamp(w / SPIN_MAX) : 0;
  }

  // What `omega` works out: how the hand's turn is turning the ball now, as an angular
  // velocity in view space (radians a second; x right, y down, z towards the viewer).
  private ox = 0;
  private oy = 0;
  private oz = 0;

  /** The ball's angular velocity now: the hand's, or the snap's tween's. */
  private omega(): void {
    this.ox = this.oy = this.oz = 0;
    if (this.spin === "still") return;
    if (this.spin === "snap") {
      // what is left of the way is (1 - u)^3 of it, going back
      const u = clamp(this.snapT / SNAP);
      const k = (-3 * (1 - u) * (1 - u)) / SNAP;
      this.ox = this.snapX * k;
      this.oy = this.snapY * k;
      this.oz = this.snapZ * k;
      return;
    }
    this.ox = this.wx;
    this.oy = this.wy;
    this.oz = this.wz;
  }

  /**
   * The kick-off's sounds for the step from `before` to `after` seconds into it: the
   * strike, the wind of the flight, falling as HOME's ball drops in and dying away after
   * AWAY's vanishes, HOME's landing (a thump as it drops onto the spot and a softer one as
   * its bounce comes down) or AWAY's sparkle as it twinkles out, and the transition as the
   * iris starts to close. NEXT-GEN and RETRO are not struck: time turning is a whoosh,
   * their spin is wind as strong as it is fast, and the new ball stops with a twinkle (as
   * the ball of the future powers on); RETRO's heavy old ball settles with HOME's soft
   * thump. No cheer and no horns. Each is heard once, however
   * long the step. With reduced motion there is no flight, and so no landing and no
   * twinkle.
   */
  private kickSounds(before: number, after: number): void {
    const at = (t: number): boolean => before <= t && t < after;
    const mode = this.mode;
    if (this.reduced) {
      // a cut: the strike as it starts, and the page closing on it
      if (at(0)) {
        this.sound(STRIKE);
        this.closeSound();
      }
      return;
    }
    if (at(K_IRIS)) this.closeSound();
    if (isEra(mode)) {
      if (at(K_HIT)) this.sound(TIME_TURN);
      if (at(K_HIT + ERA_SPIN)) this.sound(SPARKLE);
      if (mode === "retro" && at(K_HIT + ERA_SPIN + RETRO_SINK_LEN)) {
        this.sound(LAND_HOP);
      }
      // the wind of the spin, as fast as it spins
      const rate = eraRate(after - K_HIT);
      if (rate > 0) {
        this.sound({ kind: "wind", speed: (WIND_STRIKE * rate) / ERA_RATE });
      }
      return;
    }
    if (at(K_HIT)) this.sound(STRIKE);
    const len = FLIGHT[mode];
    const land = K_FLY + len;
    if (mode === "home") {
      if (at(land)) this.sound(LAND);
      if (at(land + HOME_HOP_AT + HOME_HOP_LEN)) this.sound(LAND_HOP);
    } else if (at(land + TWINKLE_FLARE - SPARKLE_RISE)) {
      this.sound(SPARKLE);
    }
    let speed = 0;
    if (after >= K_FLY && after < land) {
      const u = (after - K_FLY) / len;
      speed =
        WIND_STRIKE *
        lerp(1, mode === "home" ? HOME_WIND_END : AWAY_WIND_END, u);
    } else if (mode === "away" && after >= land && after < land + WIND_TAIL) {
      speed = WIND_STRIKE * AWAY_WIND_END * (1 - (after - land) / WIND_TAIL);
    }
    if (speed > 0) this.sound({ kind: "wind", speed });
  }

  /** The iris starts to close on the home page: heard once a kick-off. */
  private closeSound(): void {
    if (this.closing) return;
    this.closing = true;
    this.sound(CLOSING);
  }

  // -------------------------------------------------------------------------
  // The hand's turn of the ball
  // -------------------------------------------------------------------------

  /** A pointer that is down has moved: a press becomes a drag, a drag turns the ball. */
  private follow(): void {
    const far =
      Math.abs(this.pointerX - this.downX) > DRAG ||
      Math.abs(this.pointerY - this.downY) > DRAG;
    if (this.press === "ship" || this.press === "mascot") {
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
    this.flickT = this.realT;
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

  /** The mode has been played today: its patch shows a score. */
  private played(mode: Mode): boolean {
    return this.patches[MODE_SLOTS[mode]].badge !== undefined;
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
    this.logo.maxWidth = Math.min(this.w - 52, 264);
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
        this.logoH + Math.max(8, Math.round(below * AWAY_LOW_Y)),
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
    this.lift = Math.max(2, Math.round(this.R * BOB)) * this.breathAt(t, 1);
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
    this.oldCover = 0;
    this.spinRate = 0;
    this.newOn = false;
    this.newPower = 2;
    this.rezBlock = 0;

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
        Math.max(2, R * IN_OVER) * over * over - R * IN_BELOW * k * k;
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
        b.cx = cx + Math.round(swing * Math.max(4, R * 0.09));
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
      if (!this.reduced && isEra(this.mode)) {
        // not struck: it changes era where it hangs
        if (kt < K_FLY) b.t = kt;
        if (this.mode === "retro") this.composeRetro(kt - K_HIT);
        else this.composeNext(kt - K_HIT);
      } else if (!this.reduced) {
        if (kt < K_FLY) b.t = kt;
        if (kt >= K_HIT) {
          const f = Math.floor((kt - K_HIT) * 30);
          const shake = f < SHAKE.length ? SHAKE[f] : 0;
          // AWAY is hit sideways and the picture jumps from side to side; the others are hit
          // up or down and it jumps up and down
          if (this.mode === "away") this.shakeX = shake;
          else this.shakeY = shake;
        }
        if (kt >= K_HIT && kt < K_FLY) {
          // pressed flat against the boot, and springing back already
          const deep = Math.max(2, Math.round(R * SQUASH));
          this.squash = kt < K_HIT + K_DEEP ? deep : Math.max(2, deep >> 1);
          // and it gives a pixel, away from the boot
          b.cy -= 2;
          if (this.mode === "away") b.cx += 2;
        } else if (kt >= K_FLY) {
          const mode = this.mode;
          const len = FLIGHT[mode];
          const after = kt - K_FLY - len;
          this.flightAt(clamp((kt - K_FLY) / len));
          if (after >= 0) {
            if (mode === "home") {
              // down: the picture jumps, and the ball bounces once and lies still
              const f = Math.floor(after * 30);
              if (f < THUMP.length) this.shakeY = THUMP[f];
              const hop = clamp((after - HOME_HOP_AT) / HOME_HOP_LEN);
              this.fy -= Math.round(HOME_HOP * Math.sin(Math.PI * hop));
            } else {
              // AWAY's is gone
              this.ballOn = false;
            }
          }
          // spin in steps
          const air = mode === "home" ? Math.min(kt - K_FLY, len) : kt - K_FLY;
          const turn = Math.floor(air * 30) / 30;
          this.spinFrame = Math.floor(air * 14);
          b.r = Math.round(this.fr * 2) / 2;
          b.cx = Math.round(this.fx);
          b.cy = Math.round(this.fy);
          if (mode === "home") {
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
   * RETRO, `u` seconds after K_HIT (nothing before it): the fast spin of both balls (in
   * whole thirtieths of a second, like the other balls' turns), the old one's pose, how
   * much of it covers the menu ball, and the heavy ball's settle.
   */
  private composeRetro(u: number): void {
    if (u < 0) return;
    const b = this.ball;
    const us = Math.floor(u * 30) / 30;
    const spun = eraSpun(us);
    const left = eraSpun(ERA_SPIN) - spun;
    this.spinRate = eraRate(u);
    // the menu ball spins on its leaning axis, the lean coming in as it gets going
    b.yaw -= spun;
    b.roll = ERA_LEAN * clamp(us / ERA_SPIN_UP);
    // the old ball spins the same way and stops in its rest pose
    const o = this.oldBall;
    o.yaw = RETRO_REST.yaw + left;
    o.pitch = RETRO_REST.pitch;
    o.roll = RETRO_REST.roll;
    // at full speed it becomes the old ball, a sixteenth a step
    this.oldCover =
      Math.floor(
        clamp((us - RETRO_TURN_FROM) / (RETRO_TURN_TO - RETRO_TURN_FROM)) * 16,
      ) / 16;
    // stopped, the heavy old ball sinks a little and gives
    const after = u - ERA_SPIN;
    if (after > 0) {
      const sink = Math.max(2, Math.round(this.R * RETRO_SINK));
      let dy: number;
      if (after < RETRO_SINK_LEN) {
        const k = after / RETRO_SINK_LEN;
        dy = sink * k * k;
      } else {
        const k = clamp((after - RETRO_SINK_LEN) / RETRO_BOB_LEN);
        dy = sink * (1 - RETRO_BOB * Math.sin(Math.PI * k));
      }
      b.cy += Math.round(dy);
    }
    o.cx = b.cx;
    o.cy = b.cy;
    o.r = b.r;
  }

  /**
   * NEXT-GEN, `u` seconds after K_HIT (nothing before it): RETRO's spin the other way
   * round, the ball of the future's pose, the squares the ball is drawn in as it goes
   * digital and which ball it is, its seams' power, and the light ball's lift.
   */
  private composeNext(u: number): void {
    if (u < 0) return;
    const b = this.ball;
    const us = Math.floor(u * 30) / 30;
    const spun = eraSpun(us);
    const left = eraSpun(ERA_SPIN) - spun;
    this.spinRate = -eraRate(u);
    // the menu ball spins the other way on an axis leaning the other way
    b.yaw += spun;
    b.roll = -ERA_LEAN * clamp(us / ERA_SPIN_UP);
    // the new ball spins the same way and stops in its rest pose
    const n = this.newBall;
    n.yaw = NEXT_REST.yaw - left;
    n.pitch = NEXT_REST.pitch;
    n.roll = NEXT_REST.roll;
    // at full speed it goes digital: in squares, bigger and bigger, then the new ball in
    // squares, smaller and smaller
    const step = Math.floor((u - NEXT_REZ_AT) * NEXT_REZ_FPS);
    this.rezFrame = step;
    this.rezBlock =
      step >= 0 && step < NEXT_REZ.length
        ? Math.max(2, Math.round(this.R * NEXT_REZ[step]))
        : 0;
    this.newOn = step >= NEXT_REZ_SWAP;
    // its seams dim while it spins, a flash as it stops, then lit
    const after = u - ERA_SPIN;
    this.newPower = after < 0 ? 1 : after < NEXT_FLASH ? 3 : 2;
    // stopped, the light new ball lifts, settles back a little and hovers there
    if (after > 0) {
      const lift = Math.max(2, Math.round(this.R * NEXT_LIFT));
      let dy: number;
      if (after < NEXT_LIFT_LEN) {
        const k = 1 - after / NEXT_LIFT_LEN;
        dy = lift * (1 - k * k);
      } else {
        const k = clamp((after - NEXT_LIFT_LEN) / NEXT_BOB_LEN);
        dy = lift * (1 - (NEXT_BOB * (1 - Math.cos(Math.PI * k))) / 2);
      }
      b.cy -= Math.round(dy);
    }
    n.cx = b.cx;
    n.cy = b.cy;
    n.r = b.r;
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
        ty - 4,
        Math.max(this.logoBottom + rApex + 4, ty - this.rise),
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
      this.fr = lerp(2, R, near);
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
      const u = (kt - i * TRAIL_GAP - K_FLY) / FLIGHT[this.mode];
      if (u <= 0) return;
      this.flightAt(clamp(u));
      const x = Math.round(this.fx);
      const y = Math.round(this.fy);
      s.line(px, py, x, y, i === 1 ? near : far);
      // four pixels thick next to the ball, two at its tail, the thick part with a pale
      // edge
      const steep = Math.abs(y - py) > Math.abs(x - px);
      const thick = i === 1 ? 4 : 2;
      for (let o = 1; o < thick; o++) {
        s.line(
          px + (steep ? o : 0),
          py + (steep ? 0 : o),
          x + (steep ? o : 0),
          y + (steep ? 0 : o),
          i === 1 && o === 3 ? far : i === 1 ? near : far,
        );
      }
      px = x;
      py = y;
    }
  }

  /**
   * The wind round the ball while the hand's turn moves it: streaks just outside the rim,
   * running the way the rim's air goes. At a point of the rim at angle `a` (screen, y down)
   * that is the roll plus the near side's motion carried round to there: `R (oz - oy sin a
   * - ox cos a)` pixels a second, clockwise when positive. More of them and longer the
   * faster it turns, a gust of them as it is flicked, none at all with reduced motion.
   * They never come into the logo's sky, and the ball covers the rest of each.
   */
  private drawWind(s: Surface): void {
    if (this.reduced || this.spin === "still" || !this.ballOn) return;
    const speed = this.spinSpeed();
    const since = this.realT - this.flickT;
    const gust = since >= 0 && since < GUST ? 1 - since / GUST : 0;
    this.drawStreaks(s, this.ox, this.oy, this.oz, speed, gust);
  }

  /**
   * NEXT-GEN's and RETRO's spin has the hand's wind round it: its angular velocity in view
   * space is its rate about its leaning axis (the upright, leant ERA_LEAN one way or the
   * other), the streaks as many as its share of the hand's hardest flick, and a gust while it
   * is at full speed.
   */
  private drawEraWind(s: Surface): void {
    const rate = this.spinRate;
    if (this.reduced || !(Math.abs(rate) > 0) || !this.ballOn) return;
    const lean = this.ball.roll ?? 0;
    const gust = Math.abs(rate) >= ERA_RATE ? 1 : 0;
    this.drawStreaks(
      s,
      -Math.sin(lean) * rate,
      Math.cos(lean) * rate,
      0,
      clamp(Math.abs(rate) / SPIN_MAX),
      gust,
    );
  }

  /**
   * Streaks of air round the ball turning at (`ox`, `oy`, `oz`) radians a second in view
   * space, `speed` (0 to 1) of the hand's hardest flick, with `gust` (0 to 1) more.
   */
  private drawStreaks(
    s: Surface,
    ox: number,
    oy: number,
    oz: number,
    speed: number,
    gust: number,
  ): void {
    if (!(speed > WIND_SHOW)) return;
    const b = this.ball;
    const R = b.r;
    const across = Math.hypot(ox, oy);
    const fastest = R * (Math.abs(oz) + across);
    if (!(fastest > 0) || !Number.isFinite(fastest)) return;
    // how many: the calm ones fade out one by one as it slows, the gust's on top
    const count =
      ((speed - WIND_SHOW) / (1 - WIND_SHOW)) * WIND_CALM +
      gust * (WIND_SLOTS - WIND_CALM);
    const lag = WIND_LAG * (1 + gust * 0.6);
    const t = Math.floor(this.realT * WIND_FPS) / WIND_FPS;
    const day = !this.light.lightsOn;
    const head = P.white;
    const body = day ? P.skyMid : P.skyLow;
    const tail = day ? P.skyLow : P.mist;
    const spread = Math.max(4, Math.round(R * WIND_SPREAD));
    s.pushClip(0, this.logoH, s.w, s.h - this.logoH);
    for (let k = 0; k < WIND_SLOTS; k++) {
      const strength = clamp(count - k);
      if (strength <= 0) break;
      // each slot lives its lives out of step with the others
      const life = t / WIND_LIFE + ((k * 0.618) % 1);
      const n = Math.floor(life);
      const age = (life - n) * WIND_LIFE;
      // born at the best of three points of the rim
      let a = 0;
      let v = 0;
      for (let j = 0; j < 3; j++) {
        const aj = hash2(k * 3 + j, n, this.seed) * TAU;
        const vj = R * (oz - oy * Math.sin(aj) - ox * Math.cos(aj));
        if (Math.abs(vj) > Math.abs(v)) {
          a = aj;
          v = vj;
        }
      }
      if (Math.abs(v) < WIND_WHERE * fastest) continue;
      const rho =
        R + WIND_GAP + Math.floor(hash2(k, n, this.seed + 1) * spread);
      const pace =
        Math.sign(v) * Math.min(Math.abs(v) * WIND_PACE, WIND_FAST) * strength;
      const a1 = a + (pace * age) / rho;
      const a0 = a + (pace * Math.max(0, age - lag)) / rho;
      // the last third of its life it breaks up
      const broken = age > WIND_LIFE * 0.66;
      drawArc(s, b.cx, b.cy, rho, a0, a1, broken, head, body, tail);
    }
    s.popClip();
  }

  /**
   * The air the struck ball leaves behind while it is still big: RUSH_LINES straight
   * streaks off its trailing side, the way it has come, in the wind's colours. (A far ball
   * has `drawTrail` instead.)
   */
  private drawRush(s: Surface, kt: number): void {
    const b = this.ball;
    const x = b.cx;
    const y = b.cy;
    const r = b.r;
    const len = FLIGHT[this.mode];
    const u = (kt - K_FLY) / len;
    const back = (kt - RUSH_BACK - K_FLY) / len;
    if (!(u > 0)) return;
    this.flightAt(clamp(back));
    let dx = x - this.fx;
    let dy = y - this.fy;
    this.flightAt(clamp(u));
    const d = Math.hypot(dx, dy);
    if (!(d >= 4)) return;
    dx /= d;
    dy /= d;
    const day = !this.light.lightsOn;
    const near = P.white;
    const far = day ? P.skyMid : P.skyLow;
    // as long as the way it came in the last RUSH_BACK seconds, at most RUSH_MAX radii
    const long = Math.min(d, r * RUSH_MAX);
    s.pushClip(0, this.logoH, s.w, s.h - this.logoH);
    for (let i = 0; i < RUSH_LINES.length; i++) {
      const o = RUSH_LINES[i];
      // from the rim on the trailing side, across the way it goes by `o` of its radius
      const along = Math.sqrt(1 - o * o) * r;
      const x0 = Math.round(x - dx * along - dy * o * r);
      const y0 = Math.round(y - dy * along + dx * o * r);
      const l = long * (i % 2 === 0 ? 1 - Math.abs(o) * 0.4 : 0.6);
      const xm = Math.round(x0 - dx * l * 0.4);
      const ym = Math.round(y0 - dy * l * 0.4);
      const x1 = Math.round(x0 - dx * l);
      const y1 = Math.round(y0 - dy * l);

      // twice as thick: a pale edge on the far side of each streak
      const ox = Math.abs(dx) > Math.abs(dy) ? 0 : 1;
      const oy = 1 - ox;
      s.line(xm + ox, ym + oy, x1 + ox, y1 + oy, far);
      s.line(x0 + ox, y0 + oy, xm + ox, ym + oy, far);

      s.line(xm, ym, x1, y1, far);
      s.line(x0, y0, xm, ym, near);
    }
    s.popClip();
  }

  private drawBallNow(s: Surface): void {
    const b = this.ball;
    const light = this.ballLight ?? this.light;
    this.ballLight = null;
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
    if (this.newOn) {
      // NEXT-GEN: the ball of the future
      drawFutureBall(s, this.newBall, light, this.newPower);
      return;
    }
    if (this.oldCover >= 1) {
      // RETRO: the old ball, all of it
      drawLeatherBall(s, this.oldBall, light);
      return;
    }
    if (this.squash <= 0) {
      drawBall(s, b, this.patches, light);
      // RETRO: becoming the old ball as it spins, its pixels coming in over the menu ball
      if (this.oldCover > 0) {
        drawLeatherBall(s, this.oldBall, light, this.oldCover);
      }
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
    // (NEXT-GEN's and RETRO's are not struck.)
    const mode = this.mode;
    const level = mode === "home";
    const reach = this.R - this.squash;
    const edge = level ? reach : Math.round(reach * Math.SQRT2);
    const ink = light.lit(P.ink);
    const data = pad.data;
    for (let j = 0; j < side; j++) {
      for (let i = 0; i < side; i++) {
        const k = mode === "home" ? j - mid : j - i;
        const at = j * side + i;
        if (k < edge || data[at] === TRANSPARENT) continue;
        data[at] = k === edge ? ink : TRANSPARENT;
      }
    }
    s.blit(pad, x - mid, y - mid);
  }
}
