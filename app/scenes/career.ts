/**
 * The career scene: the picture behind the questions (docs/CAREER_SCENE.md).
 *
 * The footballer juggles in front of a goal on the ground of his tier (`~/art/grounds`),
 * with his team-mates, two opponents, the keeper and (from tier 2) the referee around him
 * (`~/art/characters`). Every answer is one of six shots, or none (`playShot`, section 4):
 * a worldie (the bicycle kick), a golazo (the curler), a trivela (the outside of the boot),
 * a toe poke, a tap in or a miss; time up and a pass strike nothing. Every promotion sweeps
 * a cloud of smoke over the ground; a hole opens in it onto a close-up of the ball driven
 * into the back of a net; when the smoke clears, the next ground is there (`promote`, section 5). Full time is a tableau: the
 * trophy lift at tier 7, the match ball held up below it.
 *
 * Sound: the scene says what is to be heard through `onSound` (the juggle's touches, the
 * kicks, the wind of a hard shot, the result's sting, the crowd, the referee, fireworks,
 * the World Cup's vuvuzelas, the promotion's sweep, the opening) and gives the bed of its
 * tier through `ambience()` (the World Cup's beds, tiers 6 and 7, hum with vuvuzelas).
 *
 * Timings the page relies on (held by `career.test.ts`):
 * - `playShot(grade, onDone)`: `SHOT_SECONDS` (2.4 s; 0.4 s with reduced motion), then
 *   `onDone` exactly once, called after `busy` has gone back to false. The picture plays
 *   on after it (the reaction ends, the ball is brought back to him, "The fetch", and he
 *   juggles again), but is free.
 * - `promote(total, onDone)`: `PROMOTION_SECONDS` (1.5 s; 0.25 s with reduced motion) if the
 *   tier changes, and `onDone` at once, synchronously, if it does not.
 * - A shot or promotion asked for while another plays finishes that one first (its
 *   `onDone`), then starts. `showFullTime` ends whatever plays.
 * - The scene starts on ink and an iris opens out of it over `ARRIVAL_SECONDS` (the home
 *   screen's kick-off ends on ink). The picture is built as soon as the scene has its size
 *   and light, before any time passes, and stays on ink for `OPEN_HOLD` frames more (the
 *   browser shows the frame after a long one late); then the iris opens, its clock moving
 *   at most `ARRIVAL_STEP` in any one frame.
 *
 * Time only moves in `update`; `draw` paints from the clocks and allocates nothing once
 * warm. Nothing here reads a clock, the DOM or `Math.random`.
 */

import {
  PLAYER_ANIMS,
  SHOT_ANIMS,
  STRIKE_FRAME,
  drawBallRing,
  drawKeeper,
  drawMatchBall,
  drawPlayer,
  drawPuff,
  drawTrophy,
  type KeeperAnim,
  type Kit,
  type PlayerAnim,
  type ShotAnim,
} from "~/art/characters";
import {
  FETCH_ANIM_NAMES,
  drawFetch,
  fetchBall as fetchSpot,
  type FetchAnim,
} from "~/art/characters/fetch";
import { NEXTGEN_TRAIL } from "~/art/characters/nextgen";
import {
  CareerGround,
  type CrowdMood,
  type NetBulge,
  type Tier,
} from "~/art/grounds";
import { STAND } from "~/art/grounds/stand";
import { eraOf, type Era } from "~/art/era";
import { careerLayout, type CareerLayout } from "~/art/layout";
import { type Lighting, lightingFor } from "~/art/lighting";
import { MODE_COLORS, P } from "~/art/palette";
import { BEDS, GAME, JUGGLE } from "~/audio/mix";
import { type Grade, type Mode, tierFor } from "~/game";
import {
  Surface,
  arc,
  clamp,
  easeInOutCubic,
  easeOutCubic,
  lerp,
} from "~/pixel";
import {
  BALLKID,
  CAST,
  EXTRA_A,
  EXTRA_B,
  HERO,
  KEEPER,
  MATE_A,
  MATE_B,
  OPP_A,
  OPP_B,
  REF,
  castSpots,
  endFrontX,
  ensureKits,
  fillHomes,
  newHomes,
  newKits,
  newPose,
  type Pose,
} from "./career-cast";
import {
  BUILD,
  buildColors,
  closeUpSize,
  drawBuild,
  drawConfetti,
  drawGoalFireworks,
  drawGoldBurst,
  drawIris,
  drawWhistle,
  fireworkStart,
  shadowRow,
  type BuildArea,
  type BuildColors,
} from "./career-fx";
import type { Ambience, Scene, ScoreShot, SoundCue } from "./scene";

/** Words the ground paints on its boards and banners (from `app/i18n`). */
export interface CareerLabels {
  boards?: readonly string[];
  banners?: readonly string[];
  /** NEXT-GEN's own words, over the ones above in that era. */
  nextgen?: { boards?: readonly string[]; banners?: readonly string[] };
}

export interface CareerSceneOptions {
  /** The day number: it seeds the picture. */
  seed: number;
  /**
   * The mode played. HOME tells the hometown hero's story and AWAY the journeyman's; RETRO
   * and NEXT-GEN tell the hometown hero's for now (their own look comes later), with their
   * own colour in the fireworks and the confetti.
   */
  mode: Mode;
  /** The running total to start at (a resumed game). Default 0. */
  total?: number;
  labels?: CareerLabels;
}

/** The modes the scene knows; anything else plays as HOME. */
const SCENE_MODES: readonly Mode[] = ["home", "away", "retro", "nextgen"];

function isMode(v: unknown): v is Mode {
  return (SCENE_MODES as readonly unknown[]).includes(v);
}

/** How long a shot takes, from the answer to the moment the reveal may come up. */
export const SHOT_SECONDS = 2.4;
/** How long a promotion takes when the tier changes. */
export const PROMOTION_SECONDS = 1.5;
/** The arrival: from ink to the whole picture (the home screen's closing, the other way). */
export const ARRIVAL_SECONDS = 0.63;
/** However long a frame was, the opening moves on at most this much in it. */
export const ARRIVAL_STEP = 1 / 30;
/**
 * Frames with time the picture stays on ink after it is built, before the opening starts:
 * the build is a long frame (the ground's layers, about 20 ms in Chrome at 480 x 270), and
 * the browser shows the frame after it late, so that one is ink too, not the opening's first.
 */
export const OPEN_HOLD = 2;
const SHOT_REDUCED_SECONDS = 0.4;
const PROMOTION_REDUCED_SECONDS = 0.25;
/**
 * The opening: out of nothing and slowing as it passes a ring round the stage (the hero,
 * the keeper, the goal) at this time, then on out past the corners, easing to the end. It
 * never stops on the ring: it passes it at `RING_SPEED` of its average speed from there.
 */
const ARRIVAL_RING = 0.19;
const RING_SPEED = 0.3;

// The beats of a shot, in seconds from `playShot` (CAREER_SCENE.md section 4).
/** The set: he stops juggling and the ball drops to his feet. */
const SET_END = 0.3;
/** Ground shots: his strike animation starts here (the boot meets the ball at 0.5). */
const KICK_AT = 0.3;
/** The tap in: he dribbles in from the set, round the keeper; then the tap in itself. */
const TAP_AT = 0.95;
/** He goes round the keeper on the near side: this many rows nearer the camera. */
const TAP_DY = 12;
/** The toe poke: a heavy touch at the set, he chases it, and lunges from here. */
const POKE_AT = 0.75;
/** The worldie: he hooks the ball out to team-mate A, who lofts it straight back. */
const BIKE_PASS = 0.4;
/** The cross reaches his chest: bicycle frame 0, his back to the goal. */
const BIKE_CROSS = 0.85;
/** How long a miss dragged wide rolls, from the strike until it stops. */
const WIDE_ROLL = 1.2;
/** When everyone heads back and he gets a new ball. */
const RETURN = SHOT_SECONDS + 0.6;
/** The flick from his feet back up into the juggle. */
const FLICK = 0.22;
/** How the net's bulge fades (the worldie's lasts longer). */
const BULGE_SECONDS = 0.4;
const BULGE_WORLDIE = 0.6;
/** How fast he runs back to his place, in pixels a second on the 130 px stage. */
const RUN_BACK = 70;
/** People caught away from their places by a new shot or full time get there over this. */
const CARRY = 0.3;
/** With reduced motion a shot shows its settled moment, still, until it is over. */
const REDUCED_VIEW = 2.3;
const REDUCED_HOLD = 1.8;
/**
 * The vuvuzelas' blast for a goal at the World Cup (tiers WORLD_CUP and up, never below),
 * this long after it goes in, as big as the cheer.
 */
const HORN_AFTER = 0.35;
const WORLD_CUP = 6;
/** Full time: the long whistle at once, the crowd this long after. */
const FULL_CHEER = 0.8;

// The fetch: the last shot's ball brought back to him between questions.
/** How the fetcher goes: the keeper (to it, picks it up, carries it to his place, rolls
 * it out), a youth (runs to it, dribbles it back, passes it), the ball kid (runs to it,
 * picks it up, throws it from there). */
const BY_KEEPER = 0;
const BY_FOOT = 1;
const BY_HAND = 2;
/** Their speeds, as parts of `RUN_BACK`: the keeper's jog into his net, his walk with the
 * ball, a youth's dribble. */
const JOG = 0.65;
const WALK = 0.5;
const DRIBBLE = 0.8;
/** The stoop and the rise with it (two frames at 6 a second). */
const PICK = 2 / 6;
/** A youth stepping round the ball to dribble it back the way he came. */
const TRAP = 0.18;
/** The ball at his feet a moment before the flick. */
const SETTLE = 0.1;
/** A skied miss comes down behind the goal: from landing to lying still. */
const SKY_SETTLE = 0.6;

/** Tiers 6 and 7 are always played at night, whatever the player's sky (the ground's). */
const DAY = lightingFor({ elevation: 40, morning: false });

/** The team-mates who jump round him at full time. */
const FULL_MATES = [MATE_A, MATE_B, EXTRA_A, EXTRA_B] as const;
/** The worldie's 4 px shake as it hits the net, a step every 0.04 s. */
const BIG_SHAKE = [4, -4, 2, -2, 0] as const;

/** How many people make the bed of sound at each tier (`ambience`), 0 to 1 (mix.ts, BEDS). */
const CROWD: readonly number[] = [
  BEDS.places.park.crowd,
  BEDS.places.sunday.crowd,
  BEDS.places.nonleague.crowd,
  BEDS.places.lower.crowd,
  BEDS.places.top.crowd,
  BEDS.places.international.crowd,
  BEDS.places.final.crowd,
  BEDS.places.winners.crowd,
];

// The cues that carry nothing that changes.
const TOUCH: SoundCue = { kind: "touch" };
/** The juggle while the player types: very quiet, every other touch (mix.ts, JUGGLE). */
const JUGGLE_TOUCH: SoundCue = { kind: "touch", level: JUGGLE.touch };
const GROAN: SoundCue = { kind: "groan" };
const OOH: SoundCue = { kind: "ooh" };
const WHISTLE: SoundCue = { kind: "whistle" };
const FULL_WHISTLE: SoundCue = { kind: "whistle", long: true };
const SWEEP: SoundCue = { kind: "sweep" };
const NET: SoundCue = { kind: "net" };
const FIREWORK: SoundCue = { kind: "firework", distant: true };
const OPENING: SoundCue = { kind: "transition", opening: true };

/** How each grade plays (section 4). */
interface Plan {
  /** His animation and when it starts; the boot meets the ball `STRIKE_FRAME` frames in. */
  anim: PlayerAnim;
  at: number;
  /** From the strike to the goal line (a miss: to out of view, or until it stops). */
  flight: number;
  mood: CrowdMood;
  goal: boolean;
  /** The net's bulge at its peak, 0 to 1. */
  bulge: number;
  /** Fireworks over the stand at tiers 4 to 7: how many and how big (0 to 1). */
  bursts: number;
  size: number;
  /** A 1 px shake and a puff of grass as he strikes it. */
  thump: boolean;
  /** Sound: the strike's power, the crowd's cheer and the wind of the flight, 0 to 1. */
  power: number;
  cheer: number;
  wind: number;
}

/** A grade's sounds, as mix.ts has them (GAME.shots): its kick, cheer and wind. */
const sounds = (grade: Grade): readonly [number, number, number] => {
  const shot = GAME.shots[grade];
  return [shot.kick, shot.cheer, shot.wind];
};

const plan = (
  anim: PlayerAnim,
  at: number,
  flight: number,
  mood: CrowdMood,
  sound: readonly [power: number, cheer: number, wind: number],
  bulge = 0,
  bursts = 0,
  size = 0,
  thump = true,
): Plan => ({
  anim,
  at,
  flight,
  mood,
  goal: bulge > 0,
  bulge,
  bursts,
  size,
  thump,
  power: sound[0],
  cheer: sound[1],
  wind: sound[2],
});

const PLANS: Readonly<Record<Grade, Plan>> = {
  worldie: plan("bicycle", BIKE_CROSS, 0.3, "roar", sounds("worldie"), 1, 7, 1),
  golazo: plan(
    "finesse",
    KICK_AT,
    0.62,
    "cheer",
    sounds("golazo"),
    0.8,
    5,
    0.65,
  ),
  trivela: plan(
    "trivela",
    KICK_AT,
    0.44,
    "cheer",
    sounds("trivela"),
    0.85,
    4,
    0.4,
  ),
  toepoke: plan(
    "toepoke",
    POKE_AT,
    0.27,
    "cheer",
    sounds("toepoke"),
    0.4,
    3,
    0.2,
    false,
  ),
  tapin: plan(
    "tapin",
    TAP_AT,
    0.55,
    "cheer",
    sounds("tapin"),
    0.3,
    2,
    0,
    false,
  ),
  miss: plan("kick", KICK_AT, 1.1, "groan", sounds("miss")),
  timeup: plan("kick", KICK_AT, 0, "hush", sounds("timeup"), 0, 0, 0, false),
  skipped: plan(
    "kick",
    KICK_AT,
    0.6,
    "idle",
    sounds("skipped"),
    0,
    0,
    0,
    false,
  ),
};

/** The light touches of each shot's build-up (the set's trap, the dribble, the chest). */
const TAP_TOUCHES: readonly number[] = [
  SET_END,
  SET_END + (TAP_AT - SET_END) / 3,
  SET_END + (2 * (TAP_AT - SET_END)) / 3,
];
const SET_TOUCH: readonly number[] = [SET_END];
const TOUCHES: Readonly<Record<Grade, readonly number[]>> = {
  worldie: [BIKE_CROSS],
  golazo: SET_TOUCH,
  trivela: SET_TOUCH,
  toepoke: SET_TOUCH,
  tapin: TAP_TOUCHES,
  miss: SET_TOUCH,
  timeup: SET_TOUCH,
  skipped: SET_TOUCH,
};

/** The result's sting, for the shots that have one. */
const SCORE: Readonly<Partial<Record<Grade, SoundCue>>> = (() => {
  const out: Partial<Record<Grade, SoundCue>> = {};
  const shots: ScoreShot[] = [
    "worldie",
    "golazo",
    "trivela",
    "toepoke",
    "tapin",
    "miss",
  ];
  for (const shot of shots) out[shot] = { kind: "score", shot };
  return out;
})();

// Which of a shot's one-off sounds have been sent (`Story.sent`).
const S_HOOK = 1;
const S_CROSS = 2;
const S_STRIKE = 4;
const S_RESULT = 8;
const S_HORN = 16;
const S_BACK = 32;
const S_FLICK = 64;
const S_FETCH = 128;
const S_BOUNCE = 256;

interface Story {
  grade: Grade;
  plan: Plan;
  goal: boolean;
  /** Seconds since `playShot`. */
  st: number;
  reduced: boolean;
  onDone: (() => void) | undefined;
  called: boolean;
  /** When `onDone` is due. */
  cbAt: number;
  /** When the crowd reacts. */
  moodAt: number;
  moodSet: boolean;
  /** Where the ball was when the shot was asked for, from his feet. */
  fromDX: number;
  fromDY: number;
  /** The boot meets the ball, and how long it flies (`Plan.flight`, or the roll wide). */
  strike: number;
  flight: number;
  /** The ball arrives (at the line, past the post, at the team-mate). */
  ta: number;
  /** It hits the back of the net (goals with a net), or -1. */
  th: number;
  /** A miss dragged wide past the near post, rather than skied over the bar. */
  low: boolean;
  /** The keeper's leap for the golazo, and the size it was worked out for. */
  lift: number;
  liftFor: number;
  /** He is back in his place and the new ball starts its way to him. */
  deliverAt: number;
  deliverFor: number;
  /** The new ball is at his feet: the flick, then juggling again. */
  flickAt: number;
  end: number;
  /** With reduced motion: the settled moment shown. */
  still: number;
  /** Who brings the ball back to him, and when (a goal or a miss), or null. */
  fetch: Fetch | null;
  /** The set's hop when the ball comes from far off (a shot cut in on a fetch), in px. */
  hop: number;
  /** Sound: the one-off cues sent (`S_*`), the touches and fireworks heard so far. */
  sent: number;
  touched: number;
  fired: number;
}

interface Promotion {
  to: Tier;
  t: number;
  length: number;
  onDone: (() => void) | undefined;
  swapped: boolean;
  /** Heard: the sweep, the ball in the close-up hitting the net, the new ground's cheer. */
  swept: boolean;
  netted: boolean;
  cheered: boolean;
  area: BuildArea;
  colors: BuildColors | null;
}

/** The fetch's beats, in seconds from `playShot` (see "The fetch" below). */
interface Fetch {
  /** The fetcher (a cast index) and how he goes (`BY_*`). */
  who: number;
  how: number;
  /** How far out of his goal the keeper is as he sets off (the toe poke, the tap in). */
  out: number;
  /** The ball kid catches a skied miss over his head, where he stands, and throws it. */
  catch: boolean;
  /** Sets off; at the ball; has it; at the spot he lets it go from; lets it go. */
  go: number;
  reach: number;
  lift: number;
  ready: number;
  release: number;
  /** The ball's way to the hero's feet, and its arrival there. */
  flight: number;
  arrive: number;
  /** Back at his own place. */
  home: number;
}

/** Where a fetcher is and what he does this frame (`fetcher`), reused. */
interface FetchPose {
  on: boolean;
  x: number;
  y: number;
  flip: boolean;
  anim: PlayerAnim;
  /** A fetch frame, drawn instead of `anim`; or a keeper animation; or neither. */
  fetch: FetchAnim | null;
  kanim: KeeperAnim | null;
  frame: number;
}

/** A point, reused. */
interface Pt {
  x: number;
  y: number;
}

/** A ball this frame. */
interface Ball {
  on: boolean;
  x: number;
  y: number;
  /** The row of its shadow, or -1 for none. */
  sy: number;
  depth: number;
  spin: number;
}

const newBall = (): Ball => ({
  on: false,
  x: 0,
  y: 0,
  sy: -1,
  depth: 0,
  spin: 0,
});

const newFetchPose = (): FetchPose => ({
  on: false,
  x: 0,
  y: 0,
  flip: false,
  anim: "idle",
  fetch: null,
  kanim: null,
  frame: 0,
});

/** The balls, after the cast in the draw order. */
const SHOT = CAST;
const GIVEN = CAST + 1;
const HELD = CAST + 2;
const BALLS = 3;

/** Keep a tier in range. */
function tierOf(total: number): Tier {
  const t = tierFor(Number.isFinite(total) ? Math.max(0, total) : 0);
  return Math.max(0, Math.min(7, t)) as Tier;
}

/** A grade the scene knows; anything else plays as a pass. */
function gradeOf(shot: string): Grade {
  return Object.prototype.hasOwnProperty.call(PLANS, shot)
    ? (shot as Grade)
    : "skipped";
}

/** The fraction past the last whole number. */
const frac = (v: number): number => v - Math.floor(v);

/** A cubic from `p0` to `p1` over `u` 0 to 1, leaving at slope `m0` and arriving at `m1`. */
function hermite(
  u: number,
  p0: number,
  p1: number,
  m0: number,
  m1: number,
): number {
  const u2 = u * u;
  const u3 = u2 * u;
  return (
    (2 * u3 - 3 * u2 + 1) * p0 +
    (u3 - 2 * u2 + u) * m0 +
    (3 * u2 - 2 * u3) * p1 +
    (u3 - u2) * m1
  );
}

export class CareerScene implements Scene {
  /** Set by the host: what is to be heard (`docs/API_SCENES.md`, "Sound"). */
  onSound: ((cue: SoundCue) => void) | null = null;

  private readonly seed: number;
  /** The mode played: its colour is the fireworks' and the confetti's. */
  private readonly mode: Mode;
  /**
   * The journey the scene tells: AWAY's (the journeyman's grounds and kit) or HOME's (the
   * hometown hero's), which RETRO and NEXT-GEN share: their story and places are HOME's,
   * only their look (`era`) is their own.
   */
  private readonly journey: "home" | "away";
  /**
   * The era it is drawn in (`~/art/era`, .snaps/era-art/THEME.md): today's for HOME and AWAY,
   * RETRO's and NEXT-GEN's own. Handed to the ground, the kits and the props.
   */
  private readonly era: Era;
  /** The ball's options for `drawMatchBall`, plain and gold, in this era. */
  private readonly ballPlain: { gold: boolean; era: Era };
  private readonly ballGold: { gold: boolean; era: Era };
  private readonly ground: CareerGround;
  private w = 0;
  private h = 0;
  private L: CareerLayout = careerLayout(130, 281);
  private readonly homes = newHomes();
  private reduced = false;
  private light: Lighting | null = null;
  /** Scene time: everything ambient runs on it. */
  private t = 0;
  /** The opening's clock; it starts with the first update that has time in it. */
  private arrival = 0;
  /** The opening has been heard; the referee has started play. */
  private opened = false;
  /** Frames with time still to hold on ink after a build before the opening starts. */
  private hold = 0;
  private started = false;
  /** The picture needs preparing (its layers built) before the next frame. */
  private stale = true;
  /** The sprites have all been built once. */
  private warmed = 0;
  private tier: Tier;
  private story: Story | null = null;
  private promotion: Promotion | null = null;
  /** Seconds since full time, or -1; and whether its whistle and crowd have been heard. */
  private fullT = -1;
  private fullWhistle = false;
  private fullCheer = false;
  /** The juggle's clock (7 frames a second, 8 frames a loop, a touch every 2). */
  private jug = 1;
  /** The juggle's touches so far, and whether he was juggling last frame. */
  private touches = 0;
  private juggling = false;
  /** Misses so far: they are skied and dragged wide by turns. */
  private misses = 0;
  /** Where everyone stood when a shot or full time cut in, and how long ago (or -1). */
  private readonly fromX = new Int32Array(CAST);
  private readonly fromY = new Int32Array(CAST);
  private carry = -1;
  /** How long this carry takes (`CARRY`, or the fetcher's walk home after a fetch). */
  private carryFor = CARRY;
  /**
   * A shot cut in while a fetcher had the ball: he lets it go to the hero at once (this
   * pose, where he stood) for the first half of the carry, then goes back to his place.
   */
  private cutWho = -1;
  private readonly cutPose: FetchPose = newFetchPose();

  private readonly kits = newKits();
  private readonly poses: Pose[] = [];
  private readonly order = new Int8Array(CAST + BALLS);
  private readonly depths = new Float32Array(CAST + BALLS);
  private readonly balls: Ball[] = [];
  private readonly probe: Ball = newBall();
  /** The fetch's points (`fetchPoints`) and the fetcher's pose (`fetcher`), reused. */
  private readonly rest: Ball = newBall();
  private readonly fS: Pt = { x: 0, y: 0 };
  private readonly fP: Pt = { x: 0, y: 0 };
  private readonly fR: Pt = { x: 0, y: 0 };
  private readonly fB: Pt = { x: 0, y: 0 };
  private readonly fpose: FetchPose = newFetchPose();
  private readonly bulge: NetBulge = { y: 0, amount: 0 };
  private buffer: Surface | null = null;
  /** The flight's point (`fly`) and the runs' (`dribble`), reused. */
  private fx = 0;
  private frow = 0;
  private fh = 0;
  /** The options handed to the sprite painters, reused. */
  private readonly keeperOpts = { flipX: false };
  private readonly playerOpts = { flipX: false, youth: false };

  constructor(opts: CareerSceneOptions) {
    this.seed = Math.round(Number.isFinite(opts.seed) ? opts.seed : 0) | 0;
    this.mode = isMode(opts.mode) ? opts.mode : "home";
    this.journey = this.mode === "away" ? "away" : "home";
    this.era = eraOf(this.mode);
    this.ballPlain = { gold: false, era: this.era };
    this.ballGold = { gold: true, era: this.era };
    this.tier = tierOf(opts.total ?? 0);
    this.ground = new CareerGround({
      seed: this.seed,
      mode: this.journey,
      tier: this.tier,
      // NEXT-GEN's holographic boards have their own words
      labels:
        this.era === "nextgen" && opts.labels?.nextgen
          ? { ...opts.labels, ...opts.labels.nextgen }
          : opts.labels,
      era: this.era,
    });
    this.ground.setLighting(DAY);
    for (let i = 0; i < CAST; i++) this.poses.push(newPose());
    for (let i = 0; i < BALLS; i++) this.balls.push(newBall());
    fillHomes(this.homes, this.L);
  }

  // -------------------------------------------------------------------------
  // The API the page drives
  // -------------------------------------------------------------------------

  /** True while a shot (until its `onDone`) or a promotion is playing. */
  get busy(): boolean {
    return (
      (this.story !== null && !this.story.called) || this.promotion !== null
    );
  }

  /** Set the tier at once, with no transition (a resumed game). */
  setTotal(total: number): void {
    this.setTier(tierOf(total));
    this.fullT = -1;
  }

  playShot(shot: Grade, onDone?: () => void): void {
    const grade = gradeOf(shot);
    const p = PLANS[grade];
    // any sprite not built yet, now rather than in the middle of the shot
    while (this.warmed < WARM_COUNT && this.w > 0) this.warmStep();
    this.finishShot();
    this.finishPromotion();
    // the ball he has now, relative to his feet: the set brings it from there
    const b = this.probe;
    this.heroBall(b);
    const { KICK_DX, KICK_DY } = castSpots();
    const fromDX = b.on ? b.x - this.L.heroX : KICK_DX;
    const fromDY = b.on ? b.y - this.heroY() : KICK_DY;
    const prev = this.story;
    let cut = -1;
    let hop = 0;
    if (prev && prev.fetch && this.view(prev) < prev.flickAt) {
      // cut in on a fetch: the same ball comes to him from where it is now (above); if
      // the fetcher has it, he lets it go at once, and it hops if it has far to come
      const v = this.view(prev);
      const f = prev.fetch;
      if (v >= this.hasAt(f) && v < f.release) {
        cut = f.who;
        this.fetcher(prev, v, this.cutPose);
        this.letGo(prev, this.cutPose);
      }
      const far = Math.hypot(fromDX - KICK_DX, fromDY - KICK_DY);
      if (far > 24) hop = Math.min(28, Math.round(far * 0.08));
    }
    this.capture();
    this.cutWho = cut;
    this.story = null;
    this.fullT = -1;
    const reduced = this.reduced;
    const strike = p.at + strikeDelay(p.anim);
    const low = grade === "miss" && (this.misses++ & 1) === 1;
    const flight = low ? WIDE_ROLL : p.flight;
    let ta = strike + flight;
    if (grade === "timeup") ta = strike;
    else if (grade === "miss")
      ta = low ? strike + this.wideTime() : strike + flight * 0.72;
    const net = p.goal && this.ground.goal.kind !== "jumpers";
    const th = net ? ta + 0.05 : -1;
    // the new ball: how long until he is back in his place and it is at his feet
    const out = Math.abs(this.outDX(grade)) + Math.abs(this.outDY(grade));
    const back = out > 0 ? out / (RUN_BACK * this.L.stageScale) : 0;
    const deliverAt = RETURN + back;
    const deliverFor = grade === "timeup" ? 0.35 : 0.9;
    const flickAt = deliverAt + deliverFor;
    const settle = p.goal
      ? th >= 0
        ? th + 0.65
        : ta + 0.95
      : low
        ? strike + WIDE_ROLL + 0.05
        : REDUCED_VIEW;
    this.story = {
      grade,
      plan: p,
      goal: p.goal,
      st: 0,
      reduced,
      onDone,
      called: false,
      cbAt: reduced ? SHOT_REDUCED_SECONDS : SHOT_SECONDS,
      moodAt: reduced
        ? 0
        : grade === "timeup" || grade === "skipped"
          ? strike
          : ta + (net ? 0.05 : 0),
      moodSet: false,
      fromDX,
      fromDY,
      strike,
      flight,
      ta,
      th,
      low,
      lift: 0,
      liftFor: -1,
      deliverAt,
      deliverFor,
      flickAt,
      end: reduced ? SHOT_REDUCED_SECONDS + REDUCED_HOLD : flickAt + FLICK,
      still: Math.min(RETURN - 0.05, Math.max(REDUCED_VIEW, settle)),
      fetch: null,
      hop,
      sent: 0,
      touched: 0,
      fired: 0,
    };
    this.planFetch(this.story);
    this.applyMood(this.story);
  }

  promote(total: number, onDone?: () => void): void {
    this.finishShot();
    this.finishPromotion();
    const to = tierOf(total);
    if (to === this.tier) {
      onDone?.();
      return;
    }
    const L = this.L;
    const tall = 2 * [16, 18, 30, 48, 82, 82, 82, 82][to];
    const top = Math.max(4, L.farTouchY - tall);
    const bottom = L.groundY + 18;
    const p: Promotion = {
      to,
      t: 0,
      length: this.reduced ? PROMOTION_REDUCED_SECONDS : PROMOTION_SECONDS,
      onDone,
      swapped: false,
      swept: false,
      netted: false,
      cheered: false,
      area: {
        top,
        bottom,
        w: L.w,
        cx: L.cx,
        ...closeUpSize(L.w, L.actionTop, L.groundY),
      },
      colors: null,
    };
    this.promotion = p;
    if (this.reduced) this.swapTier(p);
    // the next ground is built a slice a frame under the smoke, not in the swap
    else this.ground.prepare(to);
  }

  showFullTime(total: number): void {
    this.finishShot();
    this.finishPromotion();
    this.capture();
    this.story = null;
    this.setTier(tierOf(total));
    this.fullT = 0;
    this.fullWhistle = false;
    this.fullCheer = false;
    this.ground.setMood(this.tier === 7 ? "party" : "cheer", this.t);
  }

  // -------------------------------------------------------------------------
  // The scene contract
  // -------------------------------------------------------------------------

  resize(w: number, h: number): void {
    const W = Math.max(1, Math.round(Number.isFinite(w) ? w : 1));
    const H = Math.max(1, Math.round(Number.isFinite(h) ? h : 1));
    if (W !== this.w || H !== this.h) this.stale = true;
    this.w = W;
    this.h = H;
    this.L = careerLayout(W, H);
    fillHomes(this.homes, this.L);
    this.ground.resize(W, H);
    // built now, with the size and the light known, not in a frame that moves anything
    if (this.stale && this.light) this.prepare();
  }

  setLighting(light: Lighting): void {
    if (light !== this.light && !this.stale && this.light) {
      // the picture built: the sky moving on is no long frame. The next frame
      // regrades the kits; the ground relights a slice a frame after it (ground.ts).
      this.light = light;
      this.ground.setLighting(light);
      return;
    }
    if (light !== this.light) this.stale = true;
    this.light = light;
    this.ground.setLighting(light);
    if (this.stale) this.prepare();
  }

  setReducedMotion(on: boolean): void {
    this.reduced = on;
  }

  /** The bed of sound: the park at tiers 0 and 1, a ground at 2 and 3, then a stadium. */
  ambience(): Ambience {
    const tier = this.tier;
    return {
      venue: tier <= 1 ? "park" : tier <= 3 ? "ground" : "stadium",
      crowd: CROWD[tier],
      night: this.ground.light.phase === "night",
      tier,
    };
  }

  update(dt: number): void {
    const step = Number.isFinite(dt) && dt > 0 ? dt : 0;
    // A frame that has to build the picture is not part of the opening: its clock starts
    // on the frame after, and never takes more than a frame's step, so a stall in the
    // page's first frames shows as a moment's wait, never as a jump. (The picture is
    // normally built already, by `setLighting`.)
    const built = this.stale && this.prepare();
    this.t += step;
    if (!built && this.w > 0 && step > 0) {
      if (this.hold > 0 && this.arrival === 0) this.hold--;
      else this.open(step);
    }
    // the shots' sprites, a set a frame, once the opening is over
    if (this.arrival >= ARRIVAL_SECONDS) this.warmStep();
    if (this.fullT >= 0) {
      if (!this.fullWhistle) {
        this.fullWhistle = true;
        this.sound(FULL_WHISTLE);
      }
      this.fullT += step;
      if (!this.fullCheer && this.fullT >= FULL_CHEER) {
        this.fullCheer = true;
        this.cheer(this.tier === 7 ? GAME.winnersCheer : GAME.fullTimeCheer);
      }
    }
    if (this.carry >= 0) {
      this.carry += step;
      if (this.carry >= this.carryFor || this.reduced) {
        this.carry = -1;
        this.cutWho = -1;
      }
    }
    if (!this.story) this.jug += step * (this.reduced ? 0.5 : 1);

    const story = this.story;
    if (story) {
      story.st += step;
      this.applyMood(story);
      this.shotSounds(story);
      if (!story.called && story.st >= story.cbAt) this.callBack(story);
      if (this.story === story && story.st >= story.end) {
        // a fetcher not yet back at his place walks there from where he is
        if (story.fetch) this.trail();
        this.story = null;
        this.jug = story.reduced ? 0 : 1;
      }
    }

    // the juggle's touches: a very quiet tap on every other one (the player is typing)
    const juggling = !this.story && this.fullT < 0;
    const touches = Math.floor(this.jug * 3.5);
    if (
      juggling &&
      this.juggling &&
      touches !== this.touches &&
      (touches & 1) === 0
    )
      this.sound(JUGGLE_TOUCH);
    this.juggling = juggling;
    this.touches = touches;

    const p = this.promotion;
    if (p) {
      if (!p.swept) {
        p.swept = true;
        if (!this.reduced) this.sound(SWEEP);
      }
      p.t += step;
      if (!p.netted && p.t >= BUILD.hit) {
        p.netted = true;
        if (!this.reduced) this.sound(NET);
      }
      if (!p.swapped && p.t >= BUILD.swap) this.swapTier(p);
      if (!p.cheered && (p.t >= BUILD.cheer || this.reduced)) {
        p.cheered = true;
        this.ground.setMood("cheer", this.t);
        this.cheer(0.45);
      }
      if (p.t >= p.length) this.finishPromotion();
    }
  }

  draw(s: Surface): void {
    if (s.w !== this.w || s.h !== this.h) this.resize(s.w, s.h);
    const opening = !this.reduced && this.arrival < ARRIVAL_SECONDS;
    const r = opening ? Math.round(this.irisRadius()) : 0;
    if (opening && r < 1) {
      // shut: there is nothing to paint under it
      s.clear(P.ink);
      return;
    }
    const dx = this.shakeX();
    const dy = this.shakeY();
    if (dx === 0 && dy === 0) {
      this.paint(s);
    } else {
      const b = this.scratch(s.w, s.h);
      this.paint(b);
      s.copy(b, 0, 0);
      s.copy(b, dx, dy);
    }
    if (opening) {
      const L = this.L;
      drawIris(s, this.irisX(), L.groundY - 20, r, P.ink);
    }
  }

  // -------------------------------------------------------------------------
  // State changes
  // -------------------------------------------------------------------------

  private setTier(tier: Tier): void {
    if (tier !== this.tier) this.stale = true;
    this.tier = tier;
    this.ground.setTier(tier);
  }

  /** The opening moves on: heard as it starts, the referee's whistle as it ends. */
  private open(step: number): void {
    if (this.arrival >= ARRIVAL_SECONDS) return;
    if (!this.opened) {
      this.opened = true;
      this.sound(OPENING);
    }
    this.arrival += Math.min(step, ARRIVAL_STEP);
    if (this.arrival >= ARRIVAL_SECONDS && !this.started) {
      this.started = true;
      if (this.fullT < 0) this.sound(WHISTLE);
    }
  }

  private applyMood(story: Story): void {
    if (story.moodSet || story.st < story.moodAt) return;
    story.moodSet = true;
    this.ground.setMood(story.plan.mood, this.t);
  }

  private callBack(story: Story): void {
    if (story.called) return;
    story.called = true;
    if (story.st < story.cbAt) story.st = story.cbAt;
    this.applyMood(story);
    story.onDone?.();
  }

  /** End the shot now (its outcome stands) and call back; the picture plays on. */
  private finishShot(): void {
    const story = this.story;
    if (story && !story.called) this.callBack(story);
  }

  private swapTier(p: Promotion): void {
    if (p.swapped) return;
    p.swapped = true;
    this.setTier(p.to);
    // a fetch under the smoke: nothing to fetch on the new ground, his ball is at his feet
    if (this.story?.fetch) {
      this.story = null;
      this.jug = 1;
      this.carry = -1;
      this.cutWho = -1;
    }
  }

  private finishPromotion(): void {
    const p = this.promotion;
    if (!p) return;
    this.swapTier(p);
    this.promotion = null;
    p.onDone?.();
  }

  /** A surface the size of the canvas, kept for shakes and for preparing. */
  private scratch(w: number, h: number): Surface {
    let b = this.buffer;
    if (!b || b.w !== w || b.h !== h) b = this.buffer = new Surface(w, h);
    return b;
  }

  /**
   * Build everything a frame needs (the ground's layers for this size, light and tier, the
   * kits, the sprites of the picture as it stands) by painting a frame off screen. Called as
   * soon as the size and the light are known (and from `update` after a new tier), so the
   * frame that pays for it is never one the opening is counting. The sprites the shots use
   * are built later, a set a frame once the opening is over (`warmStep`), so this frame is
   * short too: a long one just before the opening holds its first frame. True if it did.
   */
  private prepare(): boolean {
    if (this.w < 1 || this.h < 1) return false;
    this.stale = false;
    // the browser presents the frames after a long one late: hold those on ink
    if (this.arrival === 0) this.hold = OPEN_HOLD;
    this.paint(this.scratch(this.w, this.h));
    return true;
  }

  /**
   * Build the next set of sprites a shot uses, rather than in the middle of one: each shot
   * move adult and youth, the reactions, the keeper's dives (`WARM_COUNT` sets in all).
   */
  private warmStep(): void {
    const i = this.warmed;
    if (i >= WARM_COUNT || this.w < 1) return;
    this.warmed++;
    const b = this.scratch(this.w, this.h);
    const kits = this.kitsNow();
    const S = SHOT_ANIMS.length * 2;
    if (i < S) {
      const opts = (i & 1) === 1 ? WARM_YOUTH : WARM_ADULT;
      drawPlayer(b, SHOT_ANIMS[i >> 1], 0, 20, 30, kits[HERO], opts);
    } else if (i < S + WARM_PLAYER.length) {
      drawPlayer(b, WARM_PLAYER[i - S], 0, 20, 30, kits[HERO], WARM_ADULT);
    } else if (i < S + WARM_PLAYER.length + KEEPER_WARM.length) {
      const k = KEEPER_WARM[i - S - WARM_PLAYER.length];
      drawKeeper(b, k, 0, 20, 30, kits[KEEPER], WARM_ADULT);
    } else {
      // the fetch's frames
      const j = i - S - WARM_PLAYER.length - KEEPER_WARM.length;
      drawFetch(b, FETCH_ANIM_NAMES[j], 0, 20, 30, kits[KEEPER]);
    }
  }

  private kitsNow(): readonly Kit[] {
    ensureKits(this.kits, this.tier, this.journey, this.ground.light, this.era);
    return this.kits.list;
  }

  /** Where everyone is right now: a new shot or full time moves them on from here. */
  private capture(): void {
    if (this.reduced) return;
    this.poseCast(this.L.heroX);
    for (let i = 0; i < CAST; i++) {
      this.fromX[i] = this.poses[i].x;
      this.fromY[i] = this.poses[i].y;
    }
    this.carry = 0;
    this.carryFor = CARRY;
    this.cutWho = -1;
  }

  /**
   * The end of a fetch: everyone where they are now, carried to their places, at a walk
   * for whoever has furthest to go (the fetcher, as a rule).
   */
  private trail(): void {
    if (this.reduced) return;
    this.capture();
    const H = this.homes;
    const v = RUN_BACK * this.L.stageScale * WALK;
    let far = 0;
    for (let i = 0; i < CAST; i++) {
      const d = Math.hypot(this.fromX[i] - H.x[i], this.fromY[i] - H.y[i]);
      if (d > far) far = d;
    }
    this.carryFor = Math.max(CARRY, far / v);
  }

  // -------------------------------------------------------------------------
  // Sound
  // -------------------------------------------------------------------------

  private sound(cue: SoundCue): void {
    this.onSound?.(cue);
  }

  private kick(power: number): void {
    this.onSound?.({ kind: "kick", power });
  }

  private cheer(size: number): void {
    this.onSound?.({ kind: "cheer", size });
  }

  /** True once, the first time `when` holds for this cue of the shot. */
  private due(story: Story, cue: number, when: boolean): boolean {
    if (!when || (story.sent & cue) !== 0) return false;
    story.sent |= cue;
    return true;
  }

  /**
   * A shot's sounds, as its moments come: the build-up's touches and passes, the strike,
   * the wind of a hard shot in flight, the result (its sting and the crowd), the World
   * Cup's horns for a goal, the fireworks, then the new ball. With reduced motion only the
   * strike, the result and the horns, at once.
   */
  private shotSounds(story: Story): void {
    const st = story.st;
    const p = story.plan;
    const g = story.grade;
    const reduced = story.reduced;
    if (!reduced) {
      const touches = TOUCHES[g];
      while (story.touched < touches.length && st >= touches[story.touched]) {
        story.touched++;
        this.sound(TOUCH);
      }
      if (g === "worldie") {
        // hooked out to A, and A's first-time cross back
        if (this.due(story, S_HOOK, st >= 0.03)) this.kick(GAME.hook);
        if (this.due(story, S_CROSS, st >= BIKE_PASS)) this.kick(GAME.cross);
      }
    }
    const power = g === "miss" && story.low ? GAME.lowMiss : p.power;
    if (power > 0 && this.due(story, S_STRIKE, reduced || st >= story.strike))
      this.kick(power);
    if (
      !reduced &&
      p.wind > 0 &&
      !story.low &&
      st >= story.strike &&
      st < story.ta
    ) {
      const v = (st - story.strike) / Math.max(0.01, story.ta - story.strike);
      this.onSound?.({ kind: "wind", speed: p.wind * (1 - 0.35 * v) });
    }
    const resultAt = g === "timeup" ? story.moodAt - 0.05 : story.moodAt;
    if (this.due(story, S_RESULT, st >= resultAt)) {
      const sting = SCORE[g];
      if (sting) this.sound(sting);
      if (story.goal) this.cheer(p.cheer);
      else if (g === "miss") this.sound(story.low ? OOH : GROAN);
      else if (g === "timeup") this.sound(WHISTLE);
    }
    const stadium = this.tier >= 4;
    // Decided at its moment, by the tier the goal was scored at: a promotion that takes the
    // scene to the World Cup while this shot plays on brings no late horn for it.
    if (
      story.goal &&
      this.due(
        story,
        S_HORN,
        st >= story.moodAt + (reduced ? 0 : HORN_AFTER),
      ) &&
      this.tier >= WORLD_CUP
    )
      this.sound({ kind: "vuvuzela", size: p.cheer });
    if (reduced) return;
    if (story.goal && stadium) {
      // each of the fireworks over the stand as it goes up (as `drawGoalFireworks` has it)
      const age = Math.floor((st - story.ta - 0.1) * 15) / 15;
      while (
        story.fired < p.bursts &&
        age >= fireworkStart(story.fired, p.size, this.seed)
      ) {
        story.fired++;
        this.sound(FIREWORK);
      }
    }
    if (g === "skipped" && this.due(story, S_BACK, st >= story.deliverAt + 0.2))
      this.kick(GAME.knockBack);
    const f = story.fetch;
    if (f) {
      // the fetch: the pass back (a kick), the roll out (a touch on the grass), the
      // throw's first bounce
      if (this.due(story, S_FETCH, st >= f.release)) {
        if (f.how === BY_FOOT) this.kick(GAME.knockBack);
        else if (f.how === BY_KEEPER) this.sound(TOUCH);
      }
      if (
        f.how === BY_HAND &&
        this.due(story, S_BOUNCE, st >= f.release + f.flight * 0.55)
      )
        this.sound(JUGGLE_TOUCH);
    }
    if (this.due(story, S_FLICK, st >= story.flickAt)) this.sound(JUGGLE_TOUCH);
  }

  // -------------------------------------------------------------------------
  // Where things are
  // -------------------------------------------------------------------------

  private youth(): boolean {
    return this.tier <= 1;
  }

  /** The row his feet are on: the podium's top at tier 7, else the feet row. */
  private heroY(): number {
    const pd = this.ground.podium;
    return pd ? pd.top : this.L.groundY;
  }

  /** The opening iris's centre: between him and the goal, the middle of the stage. */
  private irisX(): number {
    return Math.round((this.L.heroX + this.L.goalX) / 2);
  }

  /**
   * How open the iris is: a radius in pixels, not yet rounded. Out of nothing, quick at
   * first and slowing as it passes a ring round the stage (half the hero-to-goal distance
   * plus 18 px) at `ARRIVAL_RING`, never stopping there, then on out past the farthest
   * corner, easing to the end at `ARRIVAL_SECONDS`: the home screen's closing played the
   * other way, without its stop on the ring. Two cubics that meet at the ring with the
   * same speed, so it changes every frame and never jerks.
   */
  private irisRadius(): number {
    const L = this.L;
    const cx = this.irisX();
    const cy = L.groundY - 20;
    const ring = Math.round((L.goalX - L.heroX) / 2) + 36;
    const far = Math.max(
      ring,
      Math.ceil(Math.hypot(Math.max(cx, L.w - cx), Math.max(cy, L.h - cy))) + 2,
    );
    const a = this.arrival;
    if (a <= 0) return 0;
    const out = ARRIVAL_SECONDS - ARRIVAL_RING;
    // its speed as it passes the ring, in pixels a second
    const pass = (RING_SPEED * (far - ring)) / out;
    if (a < ARRIVAL_RING) {
      return hermite(
        a / ARRIVAL_RING,
        0,
        ring,
        1.6 * ring,
        pass * ARRIVAL_RING,
      );
    }
    const u = clamp((a - ARRIVAL_RING) / out);
    return hermite(u, ring, far, pass * out, 0);
  }

  /** The golazo's knee slide: how far towards the near corner. */
  private slideDX(): number {
    return Math.round(18 * this.L.stageScale);
  }

  /** Where he taps it in from: just past where the keeper went down. */
  private tapX(): number {
    return this.L.keeperX - Math.round(8 * this.L.stageScale);
  }

  /** Where he lunges for the toe poke, the keeper rushing out at him. */
  private pokeX(): number {
    return this.L.keeperX - Math.round(41 * this.L.stageScale);
  }

  /** Where his reaction leaves him, from his place, when everyone heads back. */
  private outDX(g: Grade): number {
    if (g === "golazo") return this.slideDX();
    if (g === "tapin") return this.tapX() - this.L.heroX;
    if (g === "toepoke") return this.pokeX() + 4 - this.L.heroX;
    return 0;
  }

  private outDY(g: Grade): number {
    return g === "golazo" ? 10 : g === "tapin" ? TAP_DY : 0;
  }

  /** How far off his line the keeper comes (negative: towards the shooter). */
  private keeperOut(g: Grade): number {
    const k = this.L.stageScale;
    if (g === "toepoke") return -Math.round(16 * k);
    if (g === "tapin") return -Math.round(14 * k);
    return 0;
  }

  /** Where a miss dragged wide comes to rest, by the near touchline past the goal. */
  private wideEndX(): number {
    const L = this.L;
    return Math.min(
      this.ground.goal.lineX + Math.round(18 * L.stageScale),
      L.w - 6,
    );
  }

  private wideEndRow(): number {
    const L = this.L;
    return Math.min(L.nearTouchY - 6, L.groundY + 24);
  }

  /** Where a goal past the jumpers runs to, towards the hedge (on screen). */
  private hedgeX(story: Story): number {
    const L = this.L;
    const x = this.ground.goal.lineX + Math.round(26 * L.stageScale);
    return story.fetch ? Math.min(x, L.w - 10) : x;
  }

  /**
   * A skied miss comes down here, behind the goal: on the grass in front of the
   * far side, or (tiers 3 to 7) off the boards of the end behind the goal, at their foot.
   */
  private landX(): number {
    const L = this.L;
    const x =
      this.tier >= 3
        ? Math.round(endFrontX(L, this.landRow())) - 10
        : this.ground.goal.lineX + Math.round(22 * L.stageScale);
    return Math.min(x, L.w - 18);
  }

  private landRow(): number {
    const L = this.L;
    return this.tier >= 3 ? L.groundY - 6 : L.farTouchY + 6;
  }

  /** After it lands it rolls on this far (back off the end's boards, tiers 3 to 7). */
  private landRoll(): number {
    return this.tier >= 3 ? -6 : 8;
  }

  /** How long after the strike a miss dragged wide passes the goal line. */
  private wideTime(): number {
    const sx = this.L.heroX + castSpots().KICK_DX;
    const span = this.wideEndX() - sx;
    const line = this.ground.goal.lineX + 2;
    const f = span > 0 ? clamp((line - sx) / span) : 1;
    return WIDE_ROLL * (1 - Math.sqrt(1 - f));
  }

  /** The time a shot is drawn at (with reduced motion, its settled moment). */
  private view(story: Story): number {
    if (!story.reduced) return story.st;
    return story.st < story.end ? story.still : story.end;
  }

  /** The ball the hero is playing with right now, wherever it is. */
  private heroBall(b: Ball): void {
    const story = this.story;
    if (story) {
      const v = this.view(story);
      if (story.fetch && !story.reduced) this.fetchBall(story, v, b);
      else if (v >= story.deliverAt && !story.reduced)
        this.givenBall(story, v, b);
      else this.shotBall(story, v, b);
      return;
    }
    if (this.fullT >= 0) {
      b.on = false;
      return;
    }
    this.juggleBall(b);
  }

  /** The juggled ball: through every spot of the juggle, on a curve between touches. */
  private juggleBall(b: Ball): void {
    const youth = this.youth();
    const f = this.jug * 7;
    const fi = Math.floor(f);
    const i = ((fi % 8) + 8) % 8;
    const even = i & 6;
    const s = (i - even + (f - fi)) / 2;
    const o = youth ? 8 : 0;
    const { JUGGLE_X, JUGGLE_Y } = castSpots();
    const ax = JUGGLE_X[o + even];
    const ay = JUGGLE_Y[o + even];
    const mx = JUGGLE_X[o + even + 1];
    const my = JUGGLE_Y[o + even + 1];
    const bx = JUGGLE_X[o + ((even + 2) & 7)];
    const by = JUGGLE_Y[o + ((even + 2) & 7)];
    const ka = (1 - s) * (1 - 2 * s);
    const km = 4 * s * (1 - s);
    const kb = s * (2 * s - 1);
    const x = ax * ka + mx * km + bx * kb;
    const y = ay * ka + my * km + by * kb;
    const hy = this.heroY();
    b.on = true;
    b.x = this.L.heroX + Math.round(x);
    b.y = hy + Math.round(y);
    b.sy = hy;
    b.depth = hy + 0.5;
    b.spin = Math.floor(this.jug * 9);
  }

  /**
   * A goal's flight at `v` (0 at the strike, 1 on the goal line): its x, the row of its
   * shadow and its height over that row, into `fx`, `frow`, `fh`.
   */
  private fly(story: Story, v: number): void {
    const L = this.L;
    const gy = L.groundY;
    const goal = this.ground.goal;
    const lx = goal.lineX + 2;
    const top = Math.max(8, gy - goal.barY - 10);
    const hy = this.heroY();
    const { KICK_DX, BIKE_X, BIKE_Y } = castSpots();
    const x0 = L.heroX + KICK_DX;
    switch (story.grade) {
      case "worldie": {
        // flat and a little downhill from over his head into the top corner
        const o = this.youth() ? 9 : 4;
        this.fx = lerp(L.heroX + BIKE_X[o], lx, v);
        this.frow = lerp(hy, gy - 4, v);
        this.fh = lerp(-BIKE_Y[o] - 4, top, v);
        return;
      }
      case "golazo":
        // bent out towards the camera and back in, rising under the bar at the far post
        this.fx = lerp(x0, lx, v * (1.15 - 0.15 * v));
        this.frow = lerp(hy, gy - 4, v) + 8 * arc(v);
        this.fh = top * (1.9 * v - 0.9 * v * v);
        return;
      case "toepoke": {
        // scuffed along the grass past the keeper's gloves, a pixel's bobble now and then
        const tx = this.pokeX() + KICK_DX;
        this.fx = lerp(tx, lx, v);
        this.frow = lerp(hy, gy + 2, v);
        this.fh = v > 0.15 && (Math.floor(v * 7) & 1) === 1 ? 2 : 0;
        return;
      }
      case "tapin": {
        // rolled in along the grass at walking pace
        const tx = this.tapX() + KICK_DX;
        this.fx = lerp(tx, lx, v * (1.3 - 0.3 * v));
        this.frow = lerp(hy, gy, v);
        this.fh = 0;
        return;
      }
      default:
        // the trivela, off the outside of the boot: up quickly, flattening and dipping
        // late into the near corner, its shadow swinging away from the camera and back
        this.fx = lerp(x0, lx, v * (0.9 + 0.1 * v));
        this.frow = lerp(hy, gy + 2, v) - 8 * arc(v);
        this.fh = top * v * (1.25 - 0.45 * v - 0.55 * v * v);
        return;
    }
  }

  /** The tap in's run in (`u` 0 to 1): his x and row into `fx`, `frow`. */
  private dribble(u: number): void {
    const e = u * u * (3 - 2 * u);
    this.fx = this.L.heroX + (this.tapX() - this.L.heroX) * e;
    this.frow = this.heroY() + TAP_DY * e;
  }

  /** The shot's ball at `st` (section 4, by grade). */
  private shotBall(story: Story, st: number, b: Ball): void {
    const L = this.L;
    const gy = L.groundY;
    const hx = L.heroX;
    const hy = this.heroY();
    const g = story.grade;
    // the ball's centre over its shadow's row: its radius
    const R = 4;
    b.on = true;
    b.sy = hy;
    b.depth = hy + 0.5;
    b.spin = Math.floor(st * 18);
    if (g === "worldie" && st < story.strike) {
      this.bicycleBall(story, st, b);
      return;
    }
    const left = g === "skipped";
    const { KICK_DX, KICK_DY, KICK_LEFT_DX } = castSpots();
    const sx = hx + (left ? KICK_LEFT_DX : KICK_DX);
    const sy = hy + KICK_DY;
    if (st < SET_END) {
      // the set: it drops to his feet
      const u = st / SET_END;
      b.x = Math.round(lerp(hx + story.fromDX, sx, u));
      b.y = Math.round(lerp(hy + story.fromDY, sy, u * u) - story.hop * arc(u));
      return;
    }
    b.x = sx;
    b.y = sy;
    if (g === "tapin" && st < story.strike) {
      // the run in: pushed ahead of him a touch at a time
      const u = clamp((st - SET_END) / (TAP_AT - SET_END));
      this.dribble(u);
      const row = Math.round(this.frow);
      const push = Math.round(6 * Math.sin(Math.PI * frac(u * 3)));
      b.x = Math.round(this.fx) + KICK_DX + push;
      b.y = row - R;
      b.sy = row;
      b.depth = row + 0.5;
      b.spin = Math.floor(st * 12);
      return;
    }
    if (g === "toepoke" && st < story.strike) {
      // a heavy touch: knocked on ahead of him, slowing, to where he stretches for it
      const u = clamp((st - SET_END) / (story.strike - SET_END));
      const e = 1 - (1 - u) * (1 - u);
      b.x = Math.round(sx + (this.pokeX() - hx) * e);
      b.spin = Math.floor(st * 14);
      return;
    }
    if (st < story.strike) {
      b.spin = 0;
      return;
    }
    const goal = this.ground.goal;
    const lx = goal.lineX;
    const v = story.flight > 0 ? (st - story.strike) / story.flight : 1;
    switch (g) {
      case "timeup": {
        const u = clamp((st - story.strike) / 0.45);
        b.x = sx + Math.round(8 * easeOutCubic(u));
        if (u >= 1) b.spin = 0;
        return;
      }
      case "skipped": {
        const ax = this.homes.x[MATE_A] + KICK_DX;
        const ay = this.homes.y[MATE_A];
        const u = clamp(v);
        const e = 1 - (1 - u) * (1 - u);
        const row = Math.round(lerp(hy, ay, e));
        b.x = Math.round(lerp(sx, ax, e));
        b.y = row + KICK_DY;
        b.sy = row;
        b.depth = row + 0.5;
        if (u >= 1) b.spin = 0;
        return;
      }
      case "miss": {
        if (story.low) {
          // dragged wide: along the grass, outside the near post, rolling to a stop
          const u = clamp(v);
          const e = 1 - (1 - u) * (1 - u);
          const row = Math.round(lerp(hy, this.wideEndRow(), e));
          b.x = Math.round(lerp(sx, this.wideEndX(), e));
          b.y = row - R;
          b.sy = row;
          b.depth = row + 0.5;
          b.spin = u >= 1 ? 0 : Math.floor(st * 18 * (1 - u));
          return;
        }
        if (story.fetch) {
          this.skiedDown(story, st, b, sx, sy);
          return;
        }
        // skied: over the bar and away, gone behind the far side as it comes down
        const ex = Math.min(lx + Math.round(24 * L.stageScale), L.w - 8);
        const ey = L.farTouchY - 12;
        const peak = Math.max(L.actionTop - 4, L.boardShrunkY + 16);
        const lift = Math.max(0, (sy + ey) / 2 - peak);
        const u = clamp(v);
        b.x = Math.round(lerp(sx, ex, u));
        b.y = Math.round(lerp(sy, ey, u) - arc(u) * lift);
        const row = Math.round(lerp(hy, L.farTouchY, u));
        b.sy = row >= L.farTouchY && u < 1 ? row : -1;
        b.depth = row + 0.5;
        if (u >= 1 || (u > 0.5 && b.y >= L.farTouchY - 20)) b.on = false;
        return;
      }
      default:
        break;
    }
    // the goals: in flight
    if (v < 1) {
      this.fly(story, v);
      const row = Math.round(this.frow);
      b.x = Math.round(this.fx);
      b.y = Math.round(this.frow - R - this.fh);
      b.sy = row;
      b.depth = row + 0.5;
      return;
    }
    this.fly(story, 1);
    const lineRow = this.frow;
    const lineH = this.fh;
    const lineY = Math.round(lineRow - R - lineH);
    const one = 2;
    if (goal.kind === "jumpers") {
      // no net: it runs on towards the hedge
      const u = clamp((st - story.ta) / 0.9);
      const e = easeOutCubic(u);
      const row = Math.round(lerp(lineRow, L.farTouchY + 8, e));
      const h =
        lineH * (1 - u) * (1 - u) * (1 - u) +
        (lineH > R ? 6 : one) * arc(clamp((u - 0.3) / 0.3)) +
        one * arc(clamp((u - 0.6) / 0.15));
      b.x = Math.round(lerp(lx + one, this.hedgeX(story), e));
      b.y = Math.round(row - R - h);
      b.sy = row;
      b.depth = row + 0.5;
      if (u >= 1) b.spin = 0;
      return;
    }
    // into the net: to the back of it, held there by the bulge, then down to the floor
    const backX = this.backX();
    const th = story.th;
    b.depth = gy - 0.5;
    b.sy = gy;
    if (st < th) {
      const u = (st - story.ta) / (th - story.ta);
      b.x = Math.round(lerp(lx + one, backX, u));
      b.y = lineY;
      return;
    }
    const since = st - th;
    b.x = backX + Math.round(6 * this.bulgeAmount(story, st));
    if (since < 0.12) {
      b.y = lineY;
    } else if (since < 0.45) {
      const q = (since - 0.12) / 0.33;
      b.y = Math.round(lerp(lineY, gy - R, q * q));
    } else {
      const bounce = lineY < gy - 8 ? R : 0;
      b.y = gy - R - Math.round(arc(clamp((since - 0.45) / 0.16)) * bounce);
      if (since > 0.61) b.spin = 0;
    }
  }

  /**
   * The worldie's ball until the strike: hooked out to team-mate A, lofted straight back
   * by him to the hero's chest, then on him through frames 0 to 4 (chested up, the top,
   * dropping, over his head at his boot).
   */
  private bicycleBall(story: Story, st: number, b: Ball): void {
    const L = this.L;
    const hx = L.heroX;
    const hy = this.heroY();
    const o = this.youth() ? 5 : 0;
    const { KICK_DX, BIKE_X, BIKE_Y } = castSpots();
    const ax = this.homes.x[MATE_A] + KICK_DX;
    const arow = this.homes.y[MATE_A];
    const R = 4;
    if (st < BIKE_CROSS) {
      let x0: number;
      let x1: number;
      let r0: number;
      let r1: number;
      let h0: number;
      let h1: number;
      let loft: number;
      let u: number;
      if (st < BIKE_PASS) {
        // out to A: from wherever it was, a loop down to his feet
        u = st / BIKE_PASS;
        x0 = hx + story.fromDX;
        x1 = ax;
        r0 = hy;
        r1 = arow;
        h0 = -story.fromDY - R;
        h1 = 0;
        loft = 16;
      } else {
        // A's first-time cross, lofted back to his chest
        u = (st - BIKE_PASS) / (BIKE_CROSS - BIKE_PASS);
        x0 = ax;
        x1 = hx + BIKE_X[o];
        r0 = arow;
        r1 = hy;
        h0 = 0;
        h1 = -BIKE_Y[o] - R;
        loft = 44;
      }
      const row = lerp(r0, r1, u);
      b.x = Math.round(lerp(x0, x1, u));
      b.y = Math.round(row - R - lerp(h0, h1, u) - loft * arc(u));
      b.sy = Math.round(row);
      b.depth = row + 0.5;
      return;
    }
    // on him: between this frame's spot and the next
    const f = Math.min(4, (st - BIKE_CROSS) * 10);
    const i = Math.min(3, Math.floor(f));
    const q = f - i;
    b.x = Math.round(hx + lerp(BIKE_X[o + i], BIKE_X[o + i + 1], q));
    b.y = Math.round(hy + lerp(BIKE_Y[o + i], BIKE_Y[o + i + 1], q));
    b.spin = Math.floor(st * 10);
  }

  /** The new ball on its way to his feet (after the shot), then the flick up. */
  private givenBall(story: Story, st: number, b: Ball): void {
    const L = this.L;
    const hx = L.heroX;
    const hy = this.heroY();
    const { KICK_DX, KICK_DY, JUGGLE_X, JUGGLE_Y } = castSpots();
    const fx = hx + KICK_DX;
    const fy = hy + KICK_DY;
    b.on = true;
    b.sy = hy;
    b.depth = hy + 0.5;
    b.spin = Math.floor(st * 16);
    if (st >= story.flickAt) {
      // the flick: from his foot up to the top of the juggle's last hop
      const u = clamp((st - story.flickAt) / FLICK);
      const o = this.youth() ? 15 : 7;
      const e = easeOutCubic(u);
      b.x = Math.round(lerp(fx, hx + JUGGLE_X[o], u));
      b.y = Math.round(lerp(fy, hy + JUGGLE_Y[o], e));
      return;
    }
    const u = clamp((st - story.deliverAt) / story.deliverFor);
    const g = story.grade;
    let x0: number;
    let row0: number;
    let h = 0;
    let e = easeOutCubic(u);
    if (g === "timeup") {
      x0 = fx + 8;
      row0 = hy;
    } else if (g === "skipped") {
      // team-mate A knocks it back: his kick, then it rolls
      const strike = 0.2;
      x0 = this.homes.x[MATE_A] + KICK_DX;
      row0 = this.homes.y[MATE_A];
      const w = clamp(
        (u * story.deliverFor - strike) / (story.deliverFor - strike),
      );
      e = 1 - (1 - w) * (1 - w);
    } else {
      // thrown on from the near side, a bounce, then rolling to his feet
      x0 = hx - Math.round(16 * L.stageScale);
      row0 = L.h + 12;
      h = 24 * arc(clamp(u / 0.45)) + 6 * arc(clamp((u - 0.45) / 0.2));
    }
    const row = Math.round(lerp(row0, hy, e));
    b.x = Math.round(lerp(x0, fx, e));
    b.y = Math.round(row - 4 - h);
    b.sy = row;
    b.depth = row + 0.5;
    if (u >= 1) b.spin = 0;
  }

  // -------------------------------------------------------------------------
  // The fetch
  //
  // A goal or a miss that brings no promotion leaves the ball somewhere: in the net,
  // past the jumpers, behind the goal, out wide. Rather than a new ball, that one is
  // brought back to his feet before he juggles again: at tiers 0 and 1 a youth runs after
  // it and passes it back (the child keeper for a goal, team-mate B for a miss); at tiers
  // 2 to 7 the keeper picks a goal out of his net, carries it to his place and rolls it
  // out to him, and a ball kid behind the goal catches a miss skied over the bar, or picks
  // up one dragged wide, and throws it back. It is all in
  // `Story.fetch`, planned as the shot starts; a promotion ends it (the smoke covers the
  // change of ground), and a shot cut in on it takes the ball from where it is.
  // -------------------------------------------------------------------------

  /** Who fetches a shot's ball, and the beats of it (none for a pass or time up). */
  private planFetch(s: Story): void {
    if (s.reduced || (!s.goal && s.grade !== "miss")) return;
    const tier = this.tier;
    const youth = tier <= 1;
    let who = KEEPER;
    let how = BY_KEEPER;
    if (s.goal) {
      if (youth) how = BY_FOOT;
    } else if (youth) {
      who = MATE_B;
      how = BY_FOOT;
    } else {
      who = BALLKID;
      how = BY_HAND;
    }
    const f: Fetch = {
      who,
      how,
      out: who === KEEPER ? this.keeperOut(s.grade) : 0,
      catch: how === BY_HAND && !s.low,
      go: 0,
      reach: 0,
      lift: 0,
      ready: 0,
      release: 0,
      flight: 0,
      arrive: 0,
      home: 0,
    };
    s.fetch = f;
    this.fetchPoints(s, f);
    const S = this.fS;
    const P = this.fP;
    const R = this.fR;
    const B = this.fB;
    const L = this.L;
    const v = RUN_BACK * L.stageScale;
    // when the ball lies still
    const still = s.goal
      ? s.th >= 0
        ? s.th + 0.62
        : s.ta + 0.9
      : s.low
        ? s.strike + WIDE_ROLL
        : s.strike + s.flight + SKY_SETTLE;
    // after his reaction (a keeper beaten, a team-mate's head in his hands), timed to
    // reach the ball as it stops if it is still on its way
    const react = s.ta + (s.goal ? (how === BY_KEEPER ? 0.7 : 0.5) : 0.3);
    const run =
      Math.hypot(P.x - S.x, P.y - S.y) /
      (v * (s.goal && how === BY_KEEPER ? JOG : 1));
    f.go = Math.max(react, still - run);
    f.reach = f.go + run;
    f.lift = f.reach + (how === BY_FOOT ? TRAP : PICK);
    if (f.catch) {
      // hands up as it drops to him, and it is his; a breath before the throw
      f.lift = s.strike + s.flight;
      f.go = f.reach = f.lift - 0.3;
    }
    const carry =
      Math.hypot(R.x - P.x, R.y - P.y) /
      (v * (how === BY_KEEPER ? WALK : DRIBBLE));
    f.ready = f.lift + carry;
    const windup =
      how === BY_KEEPER
        ? 1 / 8
        : how === BY_HAND
          ? f.catch
            ? 0.4
            : 2 / 8
          : 0.2;
    const { KICK_DX, KICK_DY } = castSpots();
    const far = Math.hypot(
      L.heroX + KICK_DX - B.x,
      this.heroY() + KICK_DY - B.y,
    );
    f.flight =
      how === BY_HAND
        ? 0.45 + far / (4 * v)
        : how === BY_KEEPER
          ? 0.3 + far / (2.2 * v)
          : 0.25 + far / (2.6 * v);
    // never there before he is back in his place
    f.release = Math.max(f.ready + windup, s.deliverAt + 0.25 - f.flight);
    f.arrive = f.release + f.flight;
    const H = this.homes;
    const back =
      how === BY_FOOT
        ? Math.hypot(H.x[who] - R.x, H.y[who] - R.y) / v
        : how === BY_HAND
          ? Math.hypot(H.x[who] - P.x, H.y[who] - P.y) / (v * WALK)
          : 0;
    f.home = f.release + 0.3 + back;
    s.flickAt = f.arrive + SETTLE;
    s.end = s.flickAt + FLICK;
  }

  /** From when the fetcher has the ball (it moves with him). */
  private hasAt(f: Fetch): number {
    return f.how === BY_FOOT || f.catch ? f.lift : f.reach + PICK / 2;
  }

  /** Where the shot's ball comes to rest, to be fetched, into `b`. */
  private restSpot(story: Story, b: Ball): void {
    const L = this.L;
    const R = 4;
    let row: number;
    if (story.goal && this.ground.goal.kind !== "jumpers") {
      row = L.groundY;
      b.x = this.backX();
      b.y = row - R;
      b.sy = row;
      b.depth = row - 0.5;
      return;
    }
    if (story.goal) {
      b.x = this.hedgeX(story);
      row = L.farTouchY + 8;
    } else if (story.low) {
      b.x = this.wideEndX();
      row = this.wideEndRow();
    } else {
      b.x = this.landX() + this.landRoll();
      row = this.landRow();
    }
    b.y = row - R;
    b.sy = row;
    b.depth = row + 0.5;
  }

  /**
   * The fetch's points for the layout of the moment: the ball at rest (`rest`), where the
   * fetcher sets off from (`fS`), where he stands to pick it up or take it (`fP`), where he
   * lets it go from (`fR`) and the ball's centre as it leaves him (`fB`).
   */
  private fetchPoints(s: Story, f: Fetch): void {
    const H = this.homes;
    const B = this.rest;
    const S = this.fS;
    S.x = H.x[f.who] + f.out;
    S.y = H.y[f.who];
    if (f.catch) {
      // the ball kid's catch: in his hands over his head, facing the pitch, where he stands
      const c = fetchSpot("kidThrow", 1);
      const left = this.L.heroX < S.x;
      B.x = S.x + (c ? (left ? -c.x : c.x) : 0);
      B.y = S.y + (c ? c.y : 0);
      B.sy = S.y;
      B.depth = S.y + 0.05;
    } else {
      this.restSpot(s, B);
    }
    const dir = B.x >= S.x ? 1 : -1;
    const { KICK_DX, KICK_DY, KICK_LEFT_DX } = castSpots();
    const pick =
      f.how === BY_KEEPER
        ? fetchSpot("keeperPick", 0)
        : f.how === BY_HAND
          ? fetchSpot("kidPick", 0)
          : null;
    const P = this.fP;
    P.x = f.catch ? S.x : B.x - dir * (pick ? pick.x : KICK_DX);
    P.y = f.catch ? S.y : B.sy;
    const R = this.fR;
    if (f.how === BY_HAND) {
      R.x = P.x;
      R.y = P.y;
    } else if (f.who === KEEPER) {
      R.x = H.x[KEEPER];
      R.y = H.y[KEEPER];
    } else {
      // team-mate B brings it half way back, then passes
      R.x = Math.round(lerp(P.x, H.x[f.who], 0.55));
      R.y = Math.round(lerp(P.y, H.y[f.who], 0.55));
    }
    const left = this.L.heroX < R.x;
    const Q = this.fB;
    if (f.how === BY_FOOT) {
      Q.x = R.x + (left ? KICK_LEFT_DX : KICK_DX);
      Q.y = R.y + KICK_DY;
    } else {
      const sp = fetchSpot(f.how === BY_KEEPER ? "keeperRoll" : "kidThrow", 1);
      Q.x = R.x + (sp ? (left ? -sp.x : sp.x) : 0);
      Q.y = R.y + (sp ? sp.y : 0);
    }
  }

  /** The fetcher at `st`: where he is and what he does (`o.on` false before he sets off). */
  private fetcher(s: Story, st: number, o: FetchPose): void {
    const f = s.fetch;
    o.on = false;
    if (!f || st < f.go) return;
    this.fetchPoints(s, f);
    const S = this.fS;
    const P = this.fP;
    const R = this.fR;
    const B = this.rest;
    o.on = true;
    o.fetch = null;
    o.kanim = null;
    o.anim = "idle";
    o.frame = 0;
    const toward = (
      ax: number,
      ay: number,
      bx: number,
      by: number,
      u: number,
    ): void => {
      o.x = Math.round(lerp(ax, bx, u));
      o.y = Math.round(lerp(ay, by, u));
    };
    if (st < f.reach) {
      // on his way to it
      toward(S.x, S.y, P.x, P.y, clamp((st - f.go) / (f.reach - f.go)));
      o.anim = "run";
      o.frame = Math.floor(st * (f.how === BY_KEEPER && s.goal ? 8 : 10));
      o.flip = P.x < S.x;
      return;
    }
    const facing = B.x < P.x;
    const toHero = this.L.heroX < R.x;
    const after = st - f.release;
    if (f.how === BY_FOOT) {
      // round the ball, to dribble it back with it at his other foot
      const { KICK_DX, KICK_LEFT_DX } = castSpots();
      const back = R.x < B.x;
      const dx = B.x - (back ? KICK_LEFT_DX : KICK_DX);
      if (st < f.lift) {
        toward(P.x, P.y, dx, P.y, clamp((st - f.reach) / (f.lift - f.reach)));
        o.anim = dx === P.x ? "idle" : "run";
        o.frame = Math.floor(st * 10);
        o.flip = dx === P.x ? facing : dx < P.x;
        return;
      }
      if (st < f.ready) {
        toward(dx, P.y, R.x, R.y, clamp((st - f.lift) / (f.ready - f.lift)));
        o.anim = "run";
        o.frame = Math.floor(st * 10);
        o.flip = R.x < P.x;
        return;
      }
      if (after < 0.3) {
        // the pass: kick frames 0 and 1 before it, the strike on 2
        toward(R.x, R.y, R.x, R.y, 0);
        o.flip = toHero;
        const k = st - (f.release - 0.2);
        if (k >= 0) {
          o.anim = "kick";
          o.frame = Math.min(4, Math.floor(k * 10));
        }
        return;
      }
      this.fetcherHome(f, st, R, o);
      return;
    }
    if (f.catch && after < -2 / 8) {
      // hands up for it as it drops, then it is in them
      toward(P.x, P.y, P.x, P.y, 0);
      o.fetch = "kidThrow";
      o.frame = 1;
      o.flip = toHero;
      return;
    }
    if (st < f.lift) {
      // stooped over it, then up with it
      toward(P.x, P.y, P.x, P.y, 0);
      o.fetch = f.how === BY_KEEPER ? "keeperPick" : "kidPick";
      o.frame = st < f.reach + PICK / 2 ? 0 : 1;
      o.flip = facing;
      return;
    }
    if (f.how === BY_KEEPER) {
      if (st < f.ready) {
        // carried back to his place
        toward(P.x, P.y, R.x, R.y, clamp((st - f.lift) / (f.ready - f.lift)));
        o.fetch = "keeperCarry";
        o.frame = Math.floor((st - f.lift) * 8);
        o.flip = R.x < P.x;
        return;
      }
      toward(R.x, R.y, R.x, R.y, 0);
      o.flip = toHero;
      if (after < -1 / 8) {
        // waiting for him to be back in his place, the ball held
        o.fetch = "keeperCarry";
        o.frame = 1;
      } else if (after < 0.45) {
        o.fetch = "keeperRoll";
        o.frame = after < 0 ? 0 : after < 1 / 8 ? 1 : 2;
      } else {
        o.kanim = "ready";
        o.frame = Math.floor(this.t * 1.2);
      }
      return;
    }
    // the ball kid: throws it from where he picked it up, then walks back
    toward(P.x, P.y, P.x, P.y, 0);
    o.flip = this.L.heroX < P.x;
    if (after < -2 / 8) {
      o.fetch = "kidPick";
      o.frame = 1;
    } else if (after < 0.3) {
      o.fetch = "kidThrow";
      o.frame = after < -1 / 8 ? 0 : after < 0 ? 1 : 2;
    } else {
      this.fetcherHome(f, st, P, o);
    }
  }

  /** After he has let it go: back from `from` to his place (at a walk), then at ease. */
  private fetcherHome(f: Fetch, st: number, from: Pt, o: FetchPose): void {
    const H = this.homes;
    const hx = H.x[f.who];
    const hy = H.y[f.who];
    const t0 = f.release + 0.3;
    if (st < f.home && f.home > t0) {
      const u = clamp((st - t0) / (f.home - t0));
      o.x = Math.round(lerp(from.x, hx, u));
      o.y = Math.round(lerp(from.y, hy, u));
      o.anim = "run";
      o.frame = Math.floor(st * (f.how === BY_HAND ? 8 : 10));
      o.flip = hx < from.x;
      return;
    }
    o.x = hx;
    o.y = hy;
    o.anim = "idle";
    o.frame = Math.floor((this.t + f.who * 0.37) * 2);
    // at his place he faces as he always does: the ball kid and the keeper the pitch
    o.flip = f.who === BALLKID || f.who === KEEPER;
  }

  /** A fetcher cut off by the next shot lets the ball go at once: his release frame. */
  private letGo(s: Story, o: FetchPose): void {
    const f = s.fetch;
    if (!f) return;
    o.flip = this.L.heroX < o.x;
    o.kanim = null;
    if (f.how === BY_KEEPER) {
      o.fetch = "keeperRoll";
      o.frame = 2;
    } else if (f.how === BY_HAND) {
      o.fetch = "kidThrow";
      o.frame = 2;
    } else {
      o.fetch = null;
      o.anim = "kick";
      o.frame = 3;
    }
  }

  /** The fetcher's pose over whatever his part in the shot had him do. */
  private poseFetch(story: Story, st: number): void {
    const f = story.fetch;
    const o = this.fpose;
    this.fetcher(story, st, o);
    if (!f || !o.on) return;
    const p = this.poses[f.who];
    p.x = o.x;
    p.y = o.y;
    p.depth = o.y;
    p.flip = o.flip;
    p.anim = o.anim;
    p.fetch = o.fetch;
    p.frame = o.frame;
    p.keeper = o.kanim !== null;
    if (o.kanim !== null) p.kanim = o.kanim;
  }

  /**
   * The one ball of a fetched shot: the shot until the fetcher has it, then with him (in
   * his hands, or dribbled at his feet), then on its way to the hero's feet (rolled or
   * passed along the grass, or thrown, bouncing), then the flick up into the juggle.
   */
  private fetchBall(story: Story, st: number, b: Ball): void {
    const f = story.fetch;
    if (!f || st < this.hasAt(f)) {
      this.shotBall(story, st, b);
      return;
    }
    const L = this.L;
    const R = 4;
    const hx = L.heroX;
    const hy = this.heroY();
    const { KICK_DX, KICK_DY, KICK_LEFT_DX, JUGGLE_X, JUGGLE_Y } = castSpots();
    const fx = hx + KICK_DX;
    const fy = hy + KICK_DY;
    b.on = true;
    if (st < f.release) {
      const o = this.fpose;
      this.fetcher(story, st, o);
      if (o.fetch !== null) {
        const sp = fetchSpot(o.fetch, o.frame);
        b.x = o.x + (sp ? (o.flip ? -sp.x : sp.x) : 0);
        b.y = o.y + (sp ? sp.y : -R);
        b.sy = -1;
        b.depth = o.y + 0.05;
        b.spin = 0;
        return;
      }
      // at a youth's feet: pushed on ahead of him as he dribbles, then still for the pass
      let push = 0;
      b.spin = 0;
      if (st < f.ready) {
        const u = clamp((st - f.lift) / (f.ready - f.lift));
        push = Math.round(6 * Math.sin(Math.PI * frac(u * 3)));
        b.spin = Math.floor(st * 12);
      }
      b.x = o.x + (o.flip ? KICK_LEFT_DX - push : KICK_DX + push);
      b.y = o.y + KICK_DY;
      b.sy = o.y;
      b.depth = o.y + 0.5;
      return;
    }
    b.sy = hy;
    b.depth = hy + 0.5;
    if (st >= story.flickAt) {
      // the flick: from his foot up to the top of the juggle's last hop
      const u = clamp((st - story.flickAt) / FLICK);
      const o = this.youth() ? 15 : 7;
      b.x = Math.round(lerp(fx, hx + JUGGLE_X[o], u));
      b.y = Math.round(lerp(fy, hy + JUGGLE_Y[o], easeOutCubic(u)));
      b.spin = Math.floor(st * 16);
      return;
    }
    if (st >= f.arrive) {
      b.x = fx;
      b.y = fy;
      b.spin = 0;
      return;
    }
    this.fetchPoints(story, f);
    const Q = this.fB;
    const u = clamp((st - f.release) / f.flight);
    b.spin = Math.floor(st * 16 * (1 - 0.6 * u));
    if (f.how === BY_HAND) {
      // thrown: up from his hands, down two thirds of the way there, a hop, a roll
      const from = this.fP.y;
      const e = u * (1.35 - 0.35 * u);
      const row = lerp(from, hy, e);
      const h0 = from - R - Q.y;
      let h = 0;
      if (u < 0.55) {
        const a = u / 0.55;
        h = h0 * (1 - a) + 24 * arc(a);
      } else if (u < 0.8) {
        h = 8 * arc((u - 0.55) / 0.25);
      }
      b.x = Math.round(lerp(Q.x, fx, e));
      b.y = Math.round(row - R - h);
      b.sy = Math.round(row);
      b.depth = row + 0.5;
      return;
    }
    // rolled or passed along the grass, slowing as it comes
    const e = 1 - (1 - u) * (1 - u);
    const row = lerp(Q.y + R, hy, e);
    b.x = Math.round(lerp(Q.x, fx, e));
    b.y = Math.round(row - R);
    b.sy = Math.round(row);
    b.depth = row + 0.5;
  }

  /**
   * A skied miss to be fetched: over the bar, down behind the goal in front of
   * the far side (in sight), a bounce and a hop, rolling on a little to lie still.
   */
  private skiedDown(
    story: Story,
    st: number,
    b: Ball,
    sx: number,
    sy: number,
  ): void {
    const L = this.L;
    const R = 4;
    const hy = this.heroY();
    const f = story.fetch;
    let ex = this.landX();
    let erow = this.landRow();
    let ey = erow - R;
    if (f?.catch) {
      // into the ball kid's hands
      this.fetchPoints(story, f);
      ex = this.rest.x;
      ey = this.rest.y;
      erow = this.rest.sy;
    }
    const peak = Math.max(L.actionTop - 4, L.boardShrunkY + 16);
    const lift = Math.max(0, (sy + ey) / 2 - peak);
    const v = story.flight > 0 ? (st - story.strike) / story.flight : 1;
    if (v < 1) {
      const u = clamp(v);
      const row = Math.round(lerp(hy, erow, u));
      b.x = Math.round(lerp(sx, ex, u));
      b.y = Math.round(lerp(sy, ey, u) - arc(u) * lift);
      b.sy = row;
      b.depth = row + 0.5;
      return;
    }
    if (f?.catch) {
      b.x = ex;
      b.y = ey;
      b.sy = -1;
      b.depth = erow + 0.05;
      return;
    }
    const a = st - story.strike - story.flight;
    const roll = easeOutCubic(clamp(a / SKY_SETTLE));
    b.x = ex + Math.round(this.landRoll() * roll);
    b.y =
      ey -
      Math.round(12 * arc(clamp(a / 0.3)) + 4 * arc(clamp((a - 0.3) / 0.16)));
    b.sy = erow;
    b.depth = erow + 0.5;
    b.spin = a >= SKY_SETTLE ? 0 : Math.floor(st * 12);
  }

  /** Where a ball in the net comes to rest: at the back of it, inside the back post. */
  private backX(): number {
    const goal = this.ground.goal;
    return goal.lineX + Math.max(6, goal.depth - 6);
  }

  /** The net's bulge after a goal, 0 to 1. */
  private bulgeAmount(story: Story, st: number): number {
    if (story.th < 0 || st < story.th) return 0;
    const fade = story.grade === "worldie" ? BULGE_WORLDIE : BULGE_SECONDS;
    return story.plan.bulge * clamp(1 - (st - story.th) / fade);
  }

  // -------------------------------------------------------------------------
  // The cast
  // -------------------------------------------------------------------------

  /** Everyone's pose for this frame. `ballX` is where they look. */
  private poseCast(ballX: number): void {
    const t = this.t;
    const tier = this.tier;
    const youth = tier <= 1;
    const H = this.homes;
    // how far past someone the ball must be before he turns to watch it
    const look = 6;
    const kid = tier >= 2;
    for (let i = 0; i < CAST; i++) {
      const p = this.poses[i];
      p.on = i !== REF || tier >= 2;
      if (i === EXTRA_A || i === EXTRA_B) p.on = false;
      if (i === BALLKID) p.on = kid;
      p.keeper = i === KEEPER && !youth;
      p.anim = "idle";
      p.kanim = "ready";
      p.fetch = null;
      // breathing, each to his own beat
      p.frame = Math.floor((t + i * 0.37) * 2);
      p.x = H.x[i];
      p.y = H.y[i];
      // facing: team-mates and the referee face the goal, opponents him (and the ball kid
      // the pitch); all watch the ball
      const right = !(
        i === OPP_A ||
        i === OPP_B ||
        i === KEEPER ||
        i === BALLKID
      );
      p.flip = !right;
      if (i !== KEEPER && i !== HERO) {
        if (right && ballX < p.x - look) p.flip = true;
        if (!right && ballX > p.x + look) p.flip = false;
      }
      p.depth = p.y;
    }
    const hero = this.poses[HERO];
    hero.y = this.heroY();
    hero.depth = hero.y + 0.4;
    const story = this.story;
    if (this.fullT >= 0) {
      this.poseFullTime();
    } else if (!story) {
      hero.anim = "juggle";
      hero.frame = Math.floor(this.jug * 7);
    } else {
      this.poseStory(story, this.view(story));
    }
    if (this.carry >= 0) this.carryOn();
  }

  /**
   * Those caught away from where they now belong run there (`CARRY` seconds, or the walk
   * home after a fetch). A fetcher cut off with the ball lets it go first (`cutWho`).
   */
  private carryOn(): void {
    const all = clamp(this.carry / this.carryFor);
    const k = this.L.stageScale;
    for (let i = 0; i < CAST; i++) {
      const p = this.poses[i];
      if (!p.on) continue;
      let u = all;
      if (i === this.cutWho) {
        if (all < 0.5) {
          const c = this.cutPose;
          p.x = this.fromX[i];
          p.y = this.fromY[i];
          p.depth = p.y;
          p.flip = c.flip;
          p.anim = c.anim;
          p.fetch = c.fetch;
          p.keeper = c.kanim !== null;
          if (c.kanim !== null) p.kanim = c.kanim;
          p.frame = c.frame;
          continue;
        }
        u = (all - 0.5) * 2;
      }
      const e = u * u * (3 - 2 * u);
      const dx = p.x - this.fromX[i];
      const dy = p.y - this.fromY[i];
      if (dx === 0 && dy === 0) continue;
      p.x = Math.round(this.fromX[i] + dx * e);
      p.y = Math.round(this.fromY[i] + dy * e);
      p.depth = p.y + (i === HERO ? 0.4 : 0);
      if (Math.abs(dx) + Math.abs(dy) > 3 * k && u < 1) {
        p.fetch = null;
        if (p.keeper) {
          p.kanim = "ready";
          p.frame = Math.floor(this.t * 8);
        } else {
          p.anim = "run";
          p.frame = Math.floor(this.t * 10);
          p.flip = dx < 0;
        }
      }
    }
  }

  private poseStory(story: Story, st: number): void {
    const P0 = this.poses;
    const hero = P0[HERO];
    const hx = hero.x;
    const hy = hero.y;
    this.poseHero(story, st, hero);
    if (story.flickAt <= st && !story.reduced) {
      hero.anim = "juggle";
      hero.frame = 0;
      hero.flip = false;
      hero.x = hx;
      hero.y = hy;
    }
    hero.depth = hero.y + 0.4;
    if (this.youth()) this.poseChildKeeper(story, st, P0[KEEPER]);
    else this.poseKeeper(story, st, P0[KEEPER]);
    this.poseOthers(story, st);
    if (story.fetch && !story.reduced) this.poseFetch(story, st);
  }

  /** Him: the set, his shot, the reaction, back to his place. */
  private poseHero(story: Story, st: number, hero: Pose): void {
    const g = story.grade;
    const hx = hero.x;
    const hy = hero.y;
    const ta = story.ta;
    hero.anim = "idle";
    hero.frame = Math.floor(st * 2);
    if (st >= RETURN) {
      this.runBack(story, st, hero);
      return;
    }
    switch (g) {
      case "skipped":
        this.poseSkip(st, hero);
        return;
      case "worldie":
        if (st < 0.32) {
          // the hook out to A, then he turns his back to the goal for the cross
          hero.anim = "kick";
          hero.flip = true;
          hero.frame = st < 0.1 ? 2 : st < 0.2 ? 3 : 4;
        } else if (st < BIKE_CROSS) {
          hero.flip = true;
          hero.frame = 0;
        } else if (st < ta + 0.2) {
          hero.anim = "bicycle";
          hero.frame = Math.min(7, Math.floor((st - BIKE_CROSS) * 10));
        } else {
          hero.anim = "celebrate";
          hero.frame = Math.floor((st - ta - 0.2) * 6);
        }
        return;
      case "tapin":
        if (st < SET_END) {
          hero.frame = 0;
        } else if (st < TAP_AT) {
          this.dribble((st - SET_END) / (TAP_AT - SET_END));
          hero.anim = "run";
          hero.frame = Math.floor(st * 10);
          hero.x = Math.round(this.fx);
          hero.y = Math.round(this.frow);
        } else {
          hero.x = this.tapX();
          hero.y = hy + TAP_DY;
          hero.anim = "tapin";
          hero.frame = Math.min(3, Math.floor((st - TAP_AT) * 8));
          if (st >= ta + 0.1 && st < ta + 0.9) {
            // a modest goal: he points to whoever set him up
            hero.anim = "finesse";
            hero.frame = 4;
          } else if (st >= ta + 0.9) {
            hero.anim = "idle";
            hero.frame = Math.floor(st * 2);
          }
        }
        return;
      case "toepoke":
        this.posePoke(story, st, hero);
        return;
      default:
        break;
    }
    // the set: he stops and steps back
    if (st < KICK_AT) {
      hero.frame = 0;
      if (st > 0.12) hero.x = hx - 4;
      return;
    }
    if (g === "timeup") {
      hero.anim = st < 0.75 ? "idle" : "dejected";
      hero.frame = st < 0.75 ? 0 : Math.floor((st - 0.75) * 1.5);
      return;
    }
    // the strike, stepping into it, then the last frame held
    const anim = story.plan.anim;
    const info = PLAYER_ANIMS[anim];
    const f = Math.floor((st - story.plan.at) * info.fps);
    hero.anim = anim;
    hero.frame = Math.min(f, info.frames - 1);
    hero.x = hx - (f === 0 ? 4 : f === 1 ? 2 : 0);
    switch (g) {
      case "golazo": {
        // off to the near corner and a knee slide
        const run0 = ta + 0.1;
        const slide0 = ta + 0.35;
        const D = this.slideDX();
        const down = 10;
        if (st >= run0 && st < slide0) {
          const u = (st - run0) / (slide0 - run0);
          hero.anim = "run";
          hero.frame = Math.floor(st * 10);
          hero.x = hx + Math.round(u * 0.45 * D);
          hero.y = hy + Math.round(u * 0.4 * down);
        } else if (st >= slide0) {
          const u = easeOutCubic(clamp((st - slide0) / 0.55));
          hero.anim = "slide";
          hero.frame = Math.floor((st - slide0) * 4);
          hero.x = hx + Math.round((0.45 + 0.55 * u) * D);
          hero.y = hy + Math.round((0.4 + 0.6 * u) * down);
        }
        return;
      }
      case "trivela": {
        // the flick of the follow-through held a moment, then arms open: he stands
        // there and lets it come to him (a cool one)
        const k = st - story.plan.at;
        if (k >= 0.3) hero.frame = k < 0.5 ? 3 : k < 0.6 ? 4 : 5;
        return;
      }
      case "miss":
        if (st >= ta && st < ta + 0.7) {
          // hands to his head
          hero.anim = "lift";
          hero.frame = 0;
        } else if (st >= ta + 0.7) {
          hero.anim = "dejected";
          hero.frame = Math.floor((st - ta - 0.7) * 1.5);
        }
        return;
      default:
        return;
    }
  }

  /**
   * The toe poke: a heavy touch at the set runs away from him, he chases it, stretches
   * and pokes it with his toe as the keeper comes out at him; a stumble, then a fist pump.
   */
  private posePoke(story: Story, st: number, hero: Pose): void {
    const hx = hero.x;
    if (st < SET_END) {
      hero.frame = 0;
      return;
    }
    const px = this.pokeX();
    if (st < POKE_AT) {
      const u = (st - SET_END) / (POKE_AT - SET_END);
      hero.anim = "run";
      hero.frame = Math.floor(st * 12);
      hero.x = Math.round(hx + (px - hx) * u * u * (3 - 2 * u));
      return;
    }
    const f = Math.floor((st - POKE_AT) * PLAYER_ANIMS.toepoke.fps);
    hero.anim = "toepoke";
    hero.frame = Math.min(4, f);
    // the stumble carries him on a pixel or two
    hero.x = px + (f >= 3 ? 4 : f >= 2 ? 2 : 0);
    const ta = story.ta;
    if (st >= ta + 0.15) {
      hero.anim = "celebrate";
      hero.frame = (Math.floor((st - ta - 0.15) * 4) & 1) * 2;
    }
  }

  /** The pass: he turns and side-foots it to A, then shrugs and faces the goal again. */
  private poseSkip(st: number, hero: Pose): void {
    const hx = hero.x;
    const left = st >= 0.12 && st < 1.85;
    hero.flip = left;
    const dir = left ? -1 : 1;
    if (st < KICK_AT) {
      hero.frame = 0;
      if (st > 0.12) hero.x = hx - 4 * dir;
    } else if (st < KICK_AT + 0.45) {
      const f = Math.floor((st - KICK_AT) * 10);
      hero.anim = "kick";
      hero.frame = f;
      hero.x = hx - dir * (f === 0 ? 4 : f === 1 ? 2 : 0);
    } else if (st < KICK_AT + 0.5) {
      hero.anim = "kick";
      hero.frame = 4;
    } else if (st >= 1.05 && st < 1.85) {
      hero.anim = "shrug";
      hero.frame = Math.floor((st - 1.05) * 2.5);
    }
  }

  /** From `RETURN`: back from wherever his reaction took him, for the new ball. */
  private runBack(story: Story, st: number, hero: Pose): void {
    const ox = this.outDX(story.grade);
    const oy = this.outDY(story.grade);
    if (ox === 0 && oy === 0) return;
    const back = Math.max(0.01, story.deliverAt - RETURN);
    const u = clamp((st - RETURN) / back);
    hero.x += Math.round((1 - u) * ox);
    hero.y += Math.round((1 - u) * oy);
    if (u < 1) {
      hero.anim = "run";
      hero.frame = Math.floor(st * 10);
      hero.flip = ox > 0;
    }
  }

  /**
   * The keeper off his line and back (toe poke, tap in): out over `o0` to `o1`, back after
   * the reaction. Moves him; true while he is on the move.
   */
  private keeperAway(
    story: Story,
    st: number,
    keeper: Pose,
    o0: number,
    o1: number,
  ): boolean {
    const out = this.keeperOut(story.grade);
    if (out === 0) return false;
    const go = clamp((st - o0) / (o1 - o0));
    const back = clamp((st - RETURN - 0.3) / 0.6);
    const e = go * go * (3 - 2 * go) * (1 - back * back * (3 - 2 * back));
    keeper.x = this.homes.x[KEEPER] + Math.round(out * e);
    return (go > 0 && go < 1) || (back > 0 && back < 1);
  }

  private poseKeeper(story: Story, st: number, keeper: Pose): void {
    const g = story.grade;
    const ta = story.ta;
    keeper.keeper = true;
    const set = (anim: KeeperAnim, frame: number): void => {
      keeper.kanim = anim;
      keeper.frame = frame;
    };
    switch (g) {
      case "worldie":
        // frozen to the spot, then down on his knees
        if (st >= story.strike && st < ta + 0.25) set("ready", 0);
        else if (st >= ta + 0.25 && st < RETURN + 0.5) set("beaten", 0);
        return;
      case "golazo": {
        // the leap at full stretch, a pixel short of it
        const tl = ta - 0.3;
        if (st < tl || st >= RETURN + 0.5) return;
        if (st < tl + 0.08) {
          set("leap", 0);
        } else if (st < tl + 0.5) {
          set("leap", st < tl + 0.2 ? 1 : 2);
          const u = (st - tl - 0.08) / 0.42;
          keeper.y -= Math.round(arc(u) * this.keeperLift(story));
        } else if (st < tl + 0.62) {
          set("ready", 0);
        } else {
          set("beaten", 0);
        }
        return;
      }
      case "trivela":
        // a beat late: the dive goes where the ball was heading, and it bends away
        if (st < ta - 0.13 || st >= RETURN + 0.5) return;
        if (st < ta - 0.05) set("sprawl", 0);
        else if (st < ta + 0.06) set("sprawl", 1);
        else if (st < ta + 0.75) set("sprawl", 2);
        else set("beaten", 0);
        return;
      case "toepoke":
        // rushing out to close him down, diving at it a beat late, beaten on the ground
        if (this.keeperAway(story, st, keeper, SET_END + 0.05, story.strike)) {
          set(st < RETURN ? "stranded" : "ready", 0);
          if (st >= RETURN) keeper.frame = Math.floor(st * 8);
          return;
        }
        if (st < story.strike || st >= RETURN + 0.3) return;
        if (st < story.strike + 0.06) set("stranded", 0);
        else if (st < story.strike + 0.16) set("smother", 0);
        else if (st < ta + 0.4) set("smother", 1);
        else set("beaten", 0);
        return;
      case "tapin":
        // out to meet him, down at his feet, and he walks round him
        if (this.keeperAway(story, st, keeper, 0.3, 0.58)) {
          set("ready", Math.floor(st * 8));
          return;
        }
        if (st < 0.58 || st >= RETURN + 0.3) return;
        if (st < 0.68) set("smother", 0);
        else if (st < ta + 0.35) set("smother", 1);
        else set("beaten", 0);
        return;
      default:
        // nothing to do: he watches it go, relaxed
        keeper.frame = Math.floor(this.t * 1.2);
        return;
    }
  }

  /** The child keeper of tiers 0 and 1 (the youth frames): no dives of his own. */
  private poseChildKeeper(story: Story, st: number, keeper: Pose): void {
    const g = story.grade;
    const ta = story.ta;
    if (g === "toepoke" || g === "tapin") {
      const o0 = g === "toepoke" ? SET_END + 0.05 : 0.3;
      const o1 = g === "toepoke" ? story.strike : 0.58;
      if (this.keeperAway(story, st, keeper, o0, o1)) {
        keeper.anim = "run";
        keeper.frame = Math.floor(st * 10);
        keeper.flip = st < RETURN;
        return;
      }
      if (st >= o1 && st < ta + 0.3) {
        // arms out, stranded
        keeper.anim = "shrug";
        keeper.frame = Math.floor((st - o1) * 2.5);
        return;
      }
    }
    if (story.goal && st >= ta + 0.3 && st < RETURN + 0.3) {
      keeper.anim = "dejected";
      keeper.frame = Math.floor((st - ta) * 1.5);
    } else if (!story.goal) {
      keeper.frame = Math.floor(this.t * 1.2);
    }
  }

  /** Team-mates and opponents. */
  private poseOthers(story: Story, st: number): void {
    const g = story.grade;
    const ta = story.ta;
    const P0 = this.poses;
    const k = this.L.stageScale;
    const mA = P0[MATE_A];
    const mB = P0[MATE_B];
    if (g === "worldie" && st >= 0.2 && st < 0.7) {
      // A volleys the cross back first time
      mA.anim = "kick";
      mA.flip = false;
      mA.frame = Math.floor((st - 0.2) * 10);
    }
    if (story.goal) {
      for (let j = 0; j < 2; j++) {
        const m = j === 0 ? mA : mB;
        const who = j === 0 ? MATE_A : MATE_B;
        const at = ta + 0.2 + j * 0.12;
        if (st < at) continue;
        if (
          g === "worldie" ||
          ((g === "golazo" || g === "trivela") && j === 1)
        ) {
          // they run to him and jump around him (the worldie: both, mobbing him; the
          // golazo: B to his knee slide in the corner; the trivela: B to where he stands)
          const slide = g === "golazo";
          const ex =
            this.homes.x[HERO] +
            (slide ? this.slideDX() : 0) +
            (j === 0 ? -1 : 1) * Math.round(9 * k);
          const ey = this.homes.y[HERO] + (slide ? 4 : j === 0 ? 6 : -4);
          const go = clamp((st - at) / 0.45);
          const home = clamp((st - RETURN) / 0.45);
          const p = easeInOutCubic(go * (1 - home));
          m.x = Math.round(lerp(this.homes.x[who], ex, p));
          m.y = Math.round(lerp(this.homes.y[who], ey, p));
          m.depth = m.y;
          if ((go > 0 && go < 1) || (home > 0 && home < 1)) {
            m.anim = "run";
            m.frame = Math.floor(st * 10);
            const toward = ex < this.homes.x[who];
            m.flip = home > 0 ? !toward : toward;
          } else if (home <= 0) {
            m.anim = "celebrate";
            m.frame = Math.floor((st - at) * 6);
            m.flip = j === 1;
          }
        } else if (st < (g === "tapin" ? ta + 1.0 : RETURN + 0.4)) {
          m.anim = "celebrate";
          m.frame = Math.floor((st - at) * 6);
        }
      }
      for (let j = 0; j < 2; j++) {
        const o = j === 0 ? P0[OPP_A] : P0[OPP_B];
        if (st >= ta + 0.35 + j * 0.1 && st < RETURN + 0.8) {
          o.anim = "dejected";
          o.frame = Math.floor((st - ta) * 1.5);
        }
      }
    } else if (g === "miss") {
      if (st >= ta + 0.15 && st < RETURN) {
        mA.anim = "dejected";
        mB.anim = "dejected";
        mA.frame = mB.frame = Math.floor(st * 1.5);
      }
      for (let j = 0; j < 2; j++) {
        const o = j === 0 ? P0[OPP_A] : P0[OPP_B];
        const at = ta + 0.1 + j * 0.15;
        if (st >= at && st < at + 1.0) {
          o.anim = "celebrate";
          o.frame = Math.floor((st - at) * 6);
        }
      }
    } else if (g === "skipped") {
      // A takes the pass, then knocks a ball back to him
      mA.flip = false;
      if (st >= story.deliverAt && st < story.deliverAt + 0.5) {
        mA.anim = "kick";
        mA.frame = Math.floor((st - story.deliverAt) * 10);
      }
    }
  }

  /** How high the keeper leaps for the golazo: his gloves a pixel short of it. */
  private keeperLift(story: Story): number {
    const L = this.L;
    // worked out once per shot and size
    const key = L.w * 10000 + L.h;
    if (story.liftFor === key) return story.lift;
    const { LEAP_TOP } = castSpots();
    const gx = L.keeperX + LEAP_TOP.x;
    const gloves = L.groundY + LEAP_TOP.y;
    // where the ball is as it passes his gloves
    const b = this.probe;
    let by = gloves;
    for (let i = 0; i <= 24; i++) {
      this.shotBall(story, story.strike + (story.flight * i) / 24, b);
      by = b.y;
      if (b.x >= gx) break;
    }
    story.lift = clamp(gloves - (by + 6), 0, 16);
    story.liftFor = key;
    return story.lift;
  }

  private poseFullTime(): void {
    const ft = this.fullT;
    const P0 = this.poses;
    const L = this.L;
    const k = L.stageScale;
    const hero = P0[HERO];
    const pd = this.ground.podium;
    hero.anim = "lift";
    hero.frame = Math.floor(ft * 3);
    hero.flip = false;
    for (let j = 0; j < FULL_MATES.length; j++) {
      const m = P0[FULL_MATES[j]];
      m.anim = "celebrate";
      m.frame = Math.floor((ft + j * 0.17) * 6);
    }
    P0[OPP_A].anim = "dejected";
    P0[OPP_B].anim = "dejected";
    P0[OPP_A].frame = P0[OPP_B].frame = Math.floor(ft * 1.5);
    if (pd) {
      // the trophy lift on the podium, everyone round him
      hero.x = pd.x;
      hero.y = pd.top;
      hero.depth = L.groundY + 4;
      const x0 = pd.x - (pd.w >> 1);
      const a = P0[MATE_A];
      const b = P0[MATE_B];
      a.x = x0 + 10;
      a.y = L.groundY - 4;
      a.flip = false;
      b.x = x0 + pd.w - 10;
      b.y = L.groundY - 2;
      b.flip = true;
      a.depth = a.y;
      b.depth = b.y;
      P0[EXTRA_A].on = true;
      P0[EXTRA_B].on = true;
      P0[EXTRA_B].flip = true;
      const keeper = P0[KEEPER];
      if (keeper.keeper) keeper.kanim = "beaten";
    } else {
      // the match ball held up, his team-mates round him
      const a = P0[MATE_A];
      const b = P0[MATE_B];
      a.x = L.heroX - Math.round(13 * k);
      a.y = L.groundY + 6;
      a.flip = false;
      b.x = L.heroX + Math.round(13 * k);
      b.y = L.groundY - 6;
      b.flip = true;
      a.depth = a.y;
      b.depth = b.y;
    }
  }

  // -------------------------------------------------------------------------
  // Painting
  // -------------------------------------------------------------------------

  private shakeX(): number {
    if (this.reduced) return 0;
    const story = this.story;
    if (story && story.grade === "worldie") {
      const a = story.st - (story.th >= 0 ? story.th : story.ta);
      if (a >= 0 && a < 0.2)
        return BIG_SHAKE[Math.min(4, Math.floor(a / 0.04))];
    }
    return 0;
  }

  /** The thump of a strike and the promotion's jolt: 2 px. */
  private shakeY(): number {
    if (this.reduced) return 0;
    const one = 2;
    const story = this.story;
    if (story && story.plan.thump) {
      const a = story.st - story.strike;
      if (a >= 0 && a < 0.06) return one;
    }
    const p = this.promotion;
    if (p) {
      // the jolt as the ball in the close-up hits the net
      const a = p.t - BUILD.hit;
      if (a >= 0 && a < 0.12) return Math.floor(a / 0.04) % 2 === 0 ? one : 0;
    }
    return 0;
  }

  private paint(s: Surface): void {
    const ground = this.ground;
    const L = this.L;
    const t = this.t;
    const light = ground.light;
    const kits = this.kitsNow();
    const { LIFT } = castSpots();
    ground.drawBack(s, t);

    const story = this.story;
    const st = story ? this.view(story) : 0;
    const motion = story !== null && !story.reduced;

    // fireworks over the stand for a goal, at the stadium tiers
    if (story && motion && story.goal && this.tier >= 4) {
      drawGoalFireworks(
        s,
        st - story.ta - 0.1,
        story.plan.bursts,
        story.plan.size,
        L.stageLeft - Math.round(30 * L.stageScale),
        L.stageRight + Math.round(30 * L.stageScale),
        L.farTouchY - STAND.roofTop,
        this.seed,
        MODE_COLORS[this.mode].light,
        this.era,
      );
    }

    // the balls: the shot's, the new one on its way, the juggled one, the ones left lying
    const B = this.balls;
    const shot = B[SHOT - CAST];
    const given = B[GIVEN - CAST];
    const held = B[HELD - CAST];
    for (let i = 0; i < BALLS; i++) B[i].on = false;
    if (story) {
      if (motion && story.fetch) {
        // one ball, the shot's, fetched back to him
        this.fetchBall(story, st, shot);
      } else if (motion && st >= story.deliverAt) {
        this.givenBall(story, st, given);
        if (story.goal || story.low) this.shotBall(story, st, shot);
      } else {
        this.shotBall(story, st, shot);
      }
    } else if (this.fullT < 0) {
      this.juggleBall(given);
    }
    const look = given.on ? given.x : shot.on ? shot.x : L.heroX;
    this.poseCast(look);

    // the match ball held up at full time (below the top tier)
    if (this.fullT >= 0 && !ground.podium) {
      const hero = this.poses[HERO];
      const f = hero.frame & 1;
      const o = this.youth() ? 4 : 0;
      held.on = true;
      held.x = hero.x + LIFT[o + f * 2];
      held.y = hero.y + LIFT[o + f * 2 + 1] - 4;
      held.sy = -1;
      held.depth = hero.depth + 0.05;
      held.spin = 0;
    }

    // shadows on the grass first, under everyone
    for (let i = 0; i < CAST; i++) {
      const p = this.poses[i];
      if (!p.on) continue;
      const small = (this.youth() && !p.keeper) || i === BALLKID;
      const half = small ? 6 : 8;
      const lifted = p.keeper && p.kanim === "leap";
      if (!lifted || p.y === this.homes.y[i])
        shadowRow(s, p.x - half, p.x + half - 1, p.y, 2);
      else shadowRow(s, p.x - half + 2, p.x + half - 3, this.homes.y[i], 2);
    }
    // under a ball (6 wide), on the rows of its ring's foot
    for (let i = 0; i < BALLS; i++) {
      const b = B[i];
      if (b.on && b.sy >= 0) shadowRow(s, b.x - 3, b.x + 2, b.sy - 1, 2);
    }

    // a miss dragged wide passes outside the near post: drawn over the goal, not in it
    const late =
      story !== null && story.low && shot.on && shot.sy > L.groundY + 4;

    // the people and the balls, far to near
    const n = this.sortCast(late);
    for (let j = 0; j < n; j++) {
      const i = this.order[j];
      if (i >= CAST) {
        this.paintBall(s, B[i - CAST], story, st);
        continue;
      }
      const p = this.poses[i];
      if (p.fetch !== null) {
        this.keeperOpts.flipX = p.flip;
        drawFetch(s, p.fetch, p.frame, p.x, p.y, kits[i], this.keeperOpts);
      } else if (p.keeper) {
        this.keeperOpts.flipX = p.flip;
        drawKeeper(s, p.kanim, p.frame, p.x, p.y, kits[i], this.keeperOpts);
      } else {
        this.playerOpts.flipX = p.flip;
        this.playerOpts.youth = i === BALLKID || (this.youth() && i !== REF);
        drawPlayer(s, p.anim, p.frame, p.x, p.y, kits[i], this.playerOpts);
      }
      if (i === HERO && this.fullT >= 0 && ground.podium) {
        const f = p.frame & 1;
        const glint = this.fullT % 1.4 < 0.12;
        drawTrophy(
          s,
          p.x + LIFT[f * 2],
          p.y + LIFT[f * 2 + 1],
          light,
          glint,
          this.era,
        );
      }
    }

    // puffs of grass: at his standing foot as he strikes it (at his toe for the toe
    // poke), where he lands from the worldie, under the keeper as his dive lands
    if (story && motion) {
      const grass = (this.tier <= 1 ? light.env : light.lit)(P.grassHi);
      const hy = this.heroY();
      const a = st - story.strike;
      const g = story.grade;
      if (story.plan.thump && g !== "worldie" && a >= 0 && a < 0.3) {
        const left = g === "skipped";
        const x = L.heroX + (left ? 4 : -4);
        drawPuff(s, x, hy, Math.floor(a * 10), grass);
      }
      if (g === "toepoke" && a >= 0 && a < 0.3)
        drawPuff(s, this.pokeX() + 12, hy, Math.floor(a * 10), grass);
      if (g === "worldie") {
        const land = st - (BIKE_CROSS + 0.55);
        if (land >= 0 && land < 0.3)
          drawPuff(s, L.heroX - 8, hy, Math.floor(land * 10), grass);
      }
      if (g === "trivela" && !this.youth()) {
        const k = this.poses[KEEPER];
        const down = st - (story.ta + 0.06);
        if (down >= 0 && down < 0.3)
          drawPuff(s, k.x + 8, k.y, Math.floor(down * 10), grass);
      }
    }

    // the goal's front layer: a ball in the net shows through the mesh
    const bulge = this.bulge;
    bulge.amount = story ? this.bulgeAmount(story, st) : 0;
    bulge.y = shot.y;
    ground.drawFront(s, t, bulge.amount > 0 ? bulge : null);
    if (late) this.paintBall(s, shot, story, st);

    if (story && motion) {
      // the worldie's gold burst where it hits
      if (story.grade === "worldie") {
        const hit = story.th >= 0 ? story.th : story.ta;
        if (st >= hit && st < hit + 0.45) {
          const b = this.probe;
          this.shotBall(story, hit, b);
          drawGoldBurst(s, b.x, b.y, st - hit);
        }
      }
      // time up: the whistle
      if (
        story.grade === "timeup" &&
        st >= story.strike - 0.05 &&
        st < story.strike + 1.4
      ) {
        const ref = this.tier >= 2 ? this.poses[REF] : this.poses[HERO];
        // the top of his cell (the youth's or the adult's), less a pixel
        const tall = this.youth() ? 32 : 40;
        drawWhistle(
          s,
          ref.x,
          ref.y - tall + 2,
          st - story.strike + 0.05,
          light.lit(P.ink),
          light.lit(P.chalk),
          light.lit(P.steel),
          light.lit(P.slate),
        );
      }
    }

    // the trophy lift's confetti
    if (this.fullT >= 0 && this.tier === 7 && !this.reduced) {
      const ramp = MODE_COLORS[this.mode];
      drawConfetti(
        s,
        this.fullT,
        0,
        L.w,
        0,
        L.groundY + 24,
        this.seed,
        ramp.base,
        ramp.light,
        this.era,
      );
    }

    // a promotion: the smoke, and in it the close-up of the ball at the back of the net
    const p = this.promotion;
    if (p && !this.reduced) {
      if (!p.colors)
        p.colors = buildColors(p.to <= 1 ? light.env : light.lit, this.era);
      drawBuild(s, p.t, p.area, p.colors, this.seed);
    }
  }

  private paintBall(
    s: Surface,
    b: Ball,
    story: Story | null,
    st: number,
  ): void {
    if (!b.on) return;
    const light = this.ground.light;
    let gold = false;
    // the worldie's gold trail behind it in flight: a streak, brightest nearest it
    if (
      b === this.balls[SHOT - CAST] &&
      story &&
      story.grade === "worldie" &&
      !story.reduced
    ) {
      const v = (st - story.strike) / story.flight;
      if (v > 0 && v < 1.12) {
        gold = true;
        const q = this.probe;
        let px = b.x;
        let py = b.y;
        for (let j = 1; j <= 7; j++) {
          this.shotBall(story, Math.max(story.strike, st - j * 0.02), q);
          const c = j <= 2 ? P.goldLight : j <= 5 ? P.gold : P.goldDark;
          // a line 2 px thick, and a second under it near the ball, centred on the
          // ball's middle rows
          s.line(px, py - 1, q.x, q.y - 1, c);
          s.line(px, py, q.x, q.y, c);
          if (j <= 4) {
            const c2 = j <= 2 ? P.gold : P.goldDark;
            s.line(px, py + 1, q.x, q.y + 1, c2);
            s.line(px, py + 2, q.x, q.y + 2, c2);
          }
          px = q.x;
          py = q.y;
        }
      }
    } else if (
      // NEXT-GEN: every struck ball leaves a trail of light behind it in flight
      this.era === "nextgen" &&
      b === this.balls[SHOT - CAST] &&
      story &&
      !story.reduced &&
      story.grade !== "timeup" &&
      story.grade !== "skipped"
    ) {
      const v = (st - story.strike) / story.flight;
      if (v > 0 && v < 1) {
        const q = this.probe;
        let px = b.x;
        let py = b.y;
        for (let j = 1; j <= NEXTGEN_TRAIL.length; j++) {
          this.shotBall(story, Math.max(story.strike, st - j * 0.02), q);
          const c = NEXTGEN_TRAIL[j - 1];
          s.line(px, py, q.x, q.y, c);
          if (j <= 3) s.line(px, py - 1, q.x, q.y - 1, c);
          px = q.x;
          py = q.y;
        }
      }
    }
    // the ink outline every ball and character has (art bible section 4)
    drawBallRing(s, b.x, b.y, light.lit(P.ink));
    drawMatchBall(
      s,
      b.x,
      b.y,
      b.spin,
      light,
      gold ? this.ballGold : this.ballPlain,
    );
  }

  /** Far to near: people and balls by their depth (`order` gets the indices). */
  private sortCast(late: boolean): number {
    let n = 0;
    for (let i = 0; i < CAST; i++) {
      const p = this.poses[i];
      if (p.on) n = this.insert(n, i, p.depth);
    }
    for (let i = 0; i < BALLS; i++) {
      const b = this.balls[i];
      if (!b.on || (late && i === SHOT - CAST)) continue;
      n = this.insert(n, CAST + i, b.depth);
    }
    return n;
  }

  /** Insert `i` at depth `d` into the first `n` of the order; returns the new count. */
  private insert(n: number, i: number, d: number): number {
    const order = this.order;
    const depths = this.depths;
    let j = n;
    while (j > 0 && depths[j - 1] > d) {
      depths[j] = depths[j - 1];
      order[j] = order[j - 1];
      j--;
    }
    depths[j] = d;
    order[j] = i;
    return n + 1;
  }
}

/** Seconds from the start of a shot animation to the frame where the boot meets the ball. */
function strikeDelay(anim: PlayerAnim): number {
  const f = Object.prototype.hasOwnProperty.call(STRIKE_FRAME, anim)
    ? STRIKE_FRAME[anim as ShotAnim]
    : 0;
  return f / PLAYER_ANIMS[anim].fps;
}

/** The keeper's animations, built once before the first shot needs them. */
const KEEPER_WARM: readonly KeeperAnim[] = [
  "ready",
  "leap",
  "smother",
  "beaten",
  "stranded",
  "sprawl",
];
/** His reactions, built the same way. */
const WARM_PLAYER: readonly PlayerAnim[] = [
  "run",
  "celebrate",
  "dejected",
  "lift",
  "slide",
];
const WARM_COUNT =
  SHOT_ANIMS.length * 2 +
  WARM_PLAYER.length +
  KEEPER_WARM.length +
  FETCH_ANIM_NAMES.length;
const WARM_ADULT = { flipX: false, youth: false } as const;
const WARM_YOUTH = { flipX: false, youth: true } as const;
