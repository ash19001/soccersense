/**
 * The career scene: the picture behind the questions (docs/CAREER_SCENE.md).
 *
 * The footballer juggles in front of a goal on the ground of his tier (`~/art/grounds`),
 * with his team-mates, two opponents, the keeper and (from tier 2) the referee around him
 * (`~/art/characters`). Every answer is a shot (`playShot`, section 4), every promotion
 * builds the next ground around him in a cloud of builders' dust (`promote`, section 5),
 * and full time is a tableau: the trophy lift at tier 7, the match ball held up below it.
 *
 * Timings the page relies on (held by `career.test.ts`):
 * - `playShot(grade, onDone)`: `SHOT_SECONDS` (2.4 s; 0.4 s with reduced motion), then
 *   `onDone` exactly once, called after `busy` has gone back to false. The picture plays
 *   on after it (the reaction ends, he gets a new ball and juggles again), but is free.
 * - `promote(total, onDone)`: `PROMOTION_SECONDS` (1.5 s; 0.25 s with reduced motion) if the
 *   tier changes, and `onDone` at once, synchronously, if it does not.
 * - A shot or promotion asked for while another plays finishes that one first (its
 *   `onDone`), then starts. `showFullTime` ends whatever plays.
 * - The scene starts on ink and opens out over `ARRIVAL_SECONDS` (the home screen's
 *   kick-off ends on ink).
 *
 * Time only moves in `update`; `draw` paints from the clocks and allocates nothing once
 * warm. Nothing here reads a clock, the DOM or `Math.random`.
 */

import {
  KICK_STRIKE_FRAME,
  drawKeeper,
  drawMatchBall,
  drawPlayer,
  drawPuff,
  drawTrophy,
} from "~/art/characters";
import {
  CareerGround,
  type CrowdMood,
  type NetBulge,
  type Tier,
} from "~/art/grounds";
import { careerLayout, type CareerLayout } from "~/art/layout";
import { type Lighting, lightingFor } from "~/art/lighting";
import { MODE_COLORS, P } from "~/art/palette";
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
  CAST,
  EXTRA_A,
  EXTRA_B,
  HERO,
  HOLD,
  JUGGLE_X,
  JUGGLE_Y,
  KEEPER,
  KICK_DX,
  KICK_DY,
  KICK_LEFT_DX,
  LEAP_TOP,
  LIFT,
  MATE_A,
  MATE_B,
  OPP_A,
  OPP_B,
  REF,
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
  drawBuild,
  drawConfetti,
  drawGoalFireworks,
  drawGoldBurst,
  drawWhistle,
  shadowRow,
  type BuildArea,
  type BuildColors,
} from "./career-fx";
import type { Scene } from "./scene";

/** Words the ground paints on its boards and banners (from `app/i18n`). */
export interface CareerLabels {
  boards?: readonly string[];
  banners?: readonly string[];
}

export interface CareerSceneOptions {
  /** The day number: it seeds the picture. */
  seed: number;
  mode: Mode;
  /** The running total to start at (a resumed game). Default 0. */
  total?: number;
  labels?: CareerLabels;
}

/** How long a shot takes, from the answer to the moment the reveal may come up. */
export const SHOT_SECONDS = 2.4;
/** How long a promotion takes when the tier changes. */
export const PROMOTION_SECONDS = 1.5;
/** The arrival: from ink to the picture. */
export const ARRIVAL_SECONDS = 0.5;
const SHOT_REDUCED_SECONDS = 0.4;
const PROMOTION_REDUCED_SECONDS = 0.25;

// The beats of a shot, in seconds from `playShot` (CAREER_SCENE.md section 4).
/** The set: he stops juggling and the ball drops to his feet. */
const SET_END = 0.3;
/** The kick's wind-up starts; the strike is `KICK_STRIKE_FRAME` frames later at 10 fps. */
const KICK_AT = 0.3;
const STRIKE = KICK_AT + KICK_STRIKE_FRAME / 10;
/** How long the ball flies, by grade (to the line; `wide` to where it drops from view). */
const FLIGHT: Record<Grade, number> = {
  worldie: 0.42,
  topbins: 0.62,
  goal: 0.5,
  ontarget: 0.5,
  wide: 1.1,
  timeup: 0,
  skipped: 0.6,
};
/** When everyone heads back and he gets a new ball. */
const RETURN = SHOT_SECONDS + 0.6;
/** The flick from his feet back up into the juggle. */
const FLICK = 0.22;
/** How the net's bulge fades. */
const BULGE_SECONDS = 0.4;
/** The worldie's knee slide: the run, then the slide, from these times. */
const RUN_AT = 0.72;
const SLIDE_AT = 1.0;
const SLIDE_END = 1.55;
/** With reduced motion a shot shows this moment of itself, still, until it is over. */
const REDUCED_VIEW = 2.3;
const REDUCED_HOLD = 1.8;

/** Tiers 6 and 7 are always played at night, whatever the player's sky (the ground's). */
const DAY = lightingFor({ elevation: 40, morning: false });

/** The team-mates who jump round him at full time. */
const FULL_MATES = [MATE_A, MATE_B, EXTRA_A, EXTRA_B] as const;
/** The worldie's 2 px shake, a step every 0.04 s. */
const WORLDIE_SHAKE = [2, -2, 1, -1, 0] as const;

const GOLD = { gold: true } as const;

const GOALS: ReadonlySet<Grade> = new Set(["worldie", "topbins", "goal"]);
const MOODS: Record<Grade, CrowdMood> = {
  worldie: "roar",
  topbins: "cheer",
  goal: "cheer",
  ontarget: "ooh",
  wide: "groan",
  timeup: "hush",
  skipped: "idle",
};

interface Story {
  grade: Grade;
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
  /** The ball arrives (at the line, the keeper, the team-mate). */
  ta: number;
  /** It hits the back of the net (goals with a net), or -1. */
  th: number;
  /** The keeper's leap for a top-corner goal, and the size it was worked out for. */
  lift: number;
  liftFor: number;
  /** He has run back (the worldie's slide) and the new ball starts its way to him. */
  deliverAt: number;
  deliverFor: number;
  /** The new ball is at his feet: the flick, then juggling again. */
  flickAt: number;
  end: number;
}

interface Promotion {
  to: Tier;
  t: number;
  length: number;
  onDone: (() => void) | undefined;
  swapped: boolean;
  thudded: boolean;
  area: BuildArea;
  colors: BuildColors | null;
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

/** Keep a tier in range. */
function tierOf(total: number): Tier {
  const t = tierFor(Number.isFinite(total) ? Math.max(0, total) : 0);
  return Math.max(0, Math.min(7, t)) as Tier;
}

export class CareerScene implements Scene {
  private readonly seed: number;
  private readonly mode: Mode;
  private readonly ground: CareerGround;
  private w = 0;
  private h = 0;
  private L: CareerLayout = careerLayout(130, 281);
  private readonly homes = newHomes();
  private reduced = false;
  /** Scene time: everything ambient runs on it. */
  private t = 0;
  private arrival = 0;
  private tier: Tier;
  private story: Story | null = null;
  private promotion: Promotion | null = null;
  /** Seconds since full time, or -1. */
  private fullT = -1;
  /** The juggle's clock (7 touches a second, 8 frames a loop). */
  private jug = 1;
  /** The last goal's ball, left lying: 0 none, 1 in the net, 2 out past the jumpers. */
  private rest = 0;

  private readonly kits = newKits();
  private readonly poses: Pose[] = [];
  private readonly order = new Int8Array(CAST + 3);
  private readonly depths = new Float32Array(CAST + 3);
  private readonly shot: Ball = newBall();
  private readonly given: Ball = newBall();
  private readonly held: Ball = newBall();
  private readonly probe: Ball = newBall();
  private readonly bulge: NetBulge = { y: 0, amount: 0 };
  private buffer: Surface | null = null;
  /** The options handed to the sprite painters, reused. */
  private readonly keeperOpts = { flipX: false };
  private readonly playerOpts = { flipX: false, youth: false };

  constructor(opts: CareerSceneOptions) {
    this.seed = Math.round(Number.isFinite(opts.seed) ? opts.seed : 0) | 0;
    this.mode = opts.mode === "away" ? "away" : "home";
    this.tier = tierOf(opts.total ?? 0);
    this.ground = new CareerGround({
      seed: this.seed,
      mode: this.mode,
      tier: this.tier,
      labels: opts.labels,
    });
    this.ground.setLighting(DAY);
    for (let i = 0; i < CAST; i++) this.poses.push(newPose());
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
    this.rest = 0;
  }

  playShot(grade: Grade, onDone?: () => void): void {
    this.finishShot();
    this.finishPromotion();
    // the ball he has now, relative to his feet: the set drops it from there
    const b = this.probe;
    this.heroBall(b);
    let fromDX = b.on ? b.x - this.L.heroX : JUGGLE_X[0];
    let fromDY = b.on ? b.y - this.heroY() : JUGGLE_Y[0];
    if (Math.abs(fromDX) > 24 || fromDY < -40 || fromDY > 8) {
      fromDX = KICK_DX;
      fromDY = KICK_DY;
    }
    this.story = null;
    this.fullT = -1;
    this.rest = 0;
    const reduced = this.reduced;
    const flight = FLIGHT[grade];
    const ta =
      grade === "timeup"
        ? STRIKE
        : grade === "wide"
          ? STRIKE + flight * 0.72
          : STRIKE + flight;
    const goal = GOALS.has(grade);
    const th = goal && this.ground.goal.kind !== "jumpers" ? ta + 0.05 : -1;
    // the new ball: how long until it is at his feet
    const back = grade === "worldie" ? this.slideBack() : 0;
    const deliverAt = RETURN + back;
    const deliverFor =
      grade === "timeup"
        ? 0.35
        : grade === "ontarget"
          ? 1.15
          : grade === "skipped"
            ? 0.9
            : 0.9;
    const flickAt = deliverAt + deliverFor;
    this.story = {
      grade,
      goal,
      st: 0,
      reduced,
      onDone,
      called: false,
      cbAt: reduced ? SHOT_REDUCED_SECONDS : SHOT_SECONDS,
      moodAt: reduced
        ? 0
        : grade === "timeup" || grade === "skipped"
          ? STRIKE
          : ta + (goal ? 0.05 : 0),
      moodSet: false,
      fromDX,
      fromDY,
      ta,
      th,
      lift: 0,
      liftFor: -1,
      deliverAt,
      deliverFor,
      flickAt,
      end: reduced ? SHOT_REDUCED_SECONDS + REDUCED_HOLD : flickAt + FLICK,
    };
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
    const tall = [16, 18, 30, 48, 82, 82, 82, 82][to];
    this.promotion = {
      to,
      t: 0,
      length: this.reduced ? PROMOTION_REDUCED_SECONDS : PROMOTION_SECONDS,
      onDone,
      swapped: false,
      thudded: false,
      area: {
        top: Math.max(2, L.farTouchY - tall),
        bottom: L.groundY + 9,
        w: L.w,
        cx: L.cx,
        k: L.stageScale,
      },
      colors: null,
    };
    if (this.reduced) this.swapTier(this.promotion);
  }

  showFullTime(total: number): void {
    this.finishShot();
    this.finishPromotion();
    this.story = null;
    this.rest = 0;
    this.setTier(tierOf(total));
    this.fullT = 0;
    this.ground.setMood(this.tier === 7 ? "party" : "cheer", this.t);
  }

  // -------------------------------------------------------------------------
  // The scene contract
  // -------------------------------------------------------------------------

  resize(w: number, h: number): void {
    const W = Math.max(1, Math.round(Number.isFinite(w) ? w : 1));
    const H = Math.max(1, Math.round(Number.isFinite(h) ? h : 1));
    this.w = W;
    this.h = H;
    this.L = careerLayout(W, H);
    fillHomes(this.homes, this.L);
    this.ground.resize(W, H);
  }

  setLighting(light: Lighting): void {
    this.ground.setLighting(light);
  }

  setReducedMotion(on: boolean): void {
    this.reduced = on;
  }

  update(dt: number): void {
    const step = Number.isFinite(dt) && dt > 0 ? dt : 0;
    this.t += step;
    this.arrival += step;
    if (this.fullT >= 0) this.fullT += step;
    if (!this.story) this.jug += step * (this.reduced ? 0.5 : 1);

    const story = this.story;
    if (story) {
      story.st += step;
      this.applyMood(story);
      if (!story.called && story.st >= story.cbAt) this.callBack(story);
      if (this.story === story && story.st >= story.end) {
        this.story = null;
        this.jug = story.reduced ? 0 : 1;
        if (story.goal) this.rest = this.ground.goal.kind === "jumpers" ? 2 : 1;
      }
    }

    const p = this.promotion;
    if (p) {
      p.t += step;
      if (!p.swapped && p.t >= BUILD.swap) this.swapTier(p);
      if (!p.thudded && p.t >= BUILD.thud && !this.reduced) {
        p.thudded = true;
        this.ground.setMood("cheer", this.t);
      }
      if (p.t >= p.length) this.finishPromotion();
    }
  }

  draw(s: Surface): void {
    if (s.w !== this.w || s.h !== this.h) this.resize(s.w, s.h);
    const dx = this.shakeX();
    const dy = this.shakeY();
    if (dx === 0 && dy === 0) {
      this.paint(s);
    } else {
      let b = this.buffer;
      if (!b || b.w !== s.w || b.h !== s.h)
        b = this.buffer = new Surface(s.w, s.h);
      this.paint(b);
      s.copy(b, 0, 0);
      s.copy(b, dx, dy);
    }
    // the arrival: the picture opens out from the middle in steps, over ink
    if (!this.reduced && this.arrival < ARRIVAL_SECONDS) {
      const w = s.w;
      const stepOpen = Math.floor((this.arrival / ARRIVAL_SECONDS) * 6) / 6;
      const open = Math.round((w / 2) * stepOpen);
      const left = Math.round(w / 2) - open;
      s.rect(0, 0, left, s.h, P.ink);
      s.rect(left + open * 2, 0, w - left - open * 2, s.h, P.ink);
    }
  }

  // -------------------------------------------------------------------------
  // State changes
  // -------------------------------------------------------------------------

  private setTier(tier: Tier): void {
    this.tier = tier;
    this.ground.setTier(tier);
  }

  private applyMood(story: Story): void {
    if (story.moodSet || story.st < story.moodAt) return;
    story.moodSet = true;
    this.ground.setMood(MOODS[story.grade], this.t);
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
    this.rest = 0;
  }

  private finishPromotion(): void {
    const p = this.promotion;
    if (!p) return;
    this.swapTier(p);
    this.promotion = null;
    p.onDone?.();
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

  /** The worldie's slide: how far, and how long the run back takes. */
  private slideDX(): number {
    return Math.round(18 * this.L.stageScale);
  }

  private slideBack(): number {
    return (this.slideDX() + 5) / (70 * this.L.stageScale);
  }

  /** The time a shot is drawn at (with reduced motion, its settled moment). */
  private view(story: Story): number {
    if (!story.reduced) return story.st;
    return story.st < story.end ? REDUCED_VIEW : story.end;
  }

  /** The ball the hero is playing with right now, wherever it is. */
  private heroBall(b: Ball): void {
    const story = this.story;
    if (story) {
      const v = this.view(story);
      if (v >= story.deliverAt && !story.reduced) this.givenBall(story, v, b);
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

  /** The shot's ball at `st` (section 4, by grade). */
  private shotBall(story: Story, st: number, b: Ball): void {
    const L = this.L;
    const gy = L.groundY;
    const hx = L.heroX;
    const hy = this.heroY();
    const g = story.grade;
    const left = g === "skipped";
    const sx = hx + (left ? KICK_LEFT_DX : KICK_DX);
    const sy = hy + KICK_DY;
    b.on = true;
    b.sy = hy;
    b.depth = hy + 0.5;
    b.spin = Math.floor(st * 18);
    if (st < SET_END) {
      // the set: it drops to his feet
      const u = st / SET_END;
      b.x = Math.round(lerp(hx + story.fromDX, sx, u));
      b.y = Math.round(lerp(hy + story.fromDY, sy, u * u));
      return;
    }
    b.x = sx;
    b.y = sy;
    if (st < STRIKE) {
      b.spin = 0;
      return;
    }
    const goal = this.ground.goal;
    const lx = goal.lineX;
    const flight = FLIGHT[g];
    const v = flight > 0 ? (st - STRIKE) / flight : 1;
    switch (g) {
      case "timeup": {
        const u = clamp((st - STRIKE) / 0.45);
        b.x = sx + Math.round(4 * easeOutCubic(u));
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
      case "ontarget": {
        const youth = this.youth();
        const kx = L.keeperX + (youth ? -5 : HOLD.x);
        const ky = gy + (youth ? -8 : HOLD.y);
        if (v < 1) {
          b.x = Math.round(lerp(sx, kx, v));
          b.y = Math.round(lerp(sy, ky, v) - arc(v) * 2);
          return;
        }
        // in his hands (the child holds it up over his head)
        if (youth) {
          const f = Math.floor((st - story.ta) * 3) & 1;
          b.x = L.keeperX - LIFT[4 + f * 2] - 1;
          b.y = gy + LIFT[5 + f * 2] - 2;
        } else {
          b.x = kx;
          b.y = ky;
        }
        b.sy = -1;
        b.depth = gy + 0.6;
        b.spin = 0;
        return;
      }
      case "wide": {
        const ex = Math.min(lx + Math.round(24 * L.stageScale), L.w - 4);
        const ey = L.farTouchY - 6;
        const peak = Math.max(L.actionTop - 2, L.boardShrunkY + 8);
        const lift = Math.max(0, (sy + ey) / 2 - peak);
        const u = clamp(v);
        b.x = Math.round(lerp(sx, ex, u));
        b.y = Math.round(lerp(sy, ey, u) - arc(u) * lift);
        const row = Math.round(lerp(hy, L.farTouchY, u));
        b.sy = row >= L.farTouchY && u < 1 ? row : -1;
        b.depth = row + 0.5;
        // over the bar and away: gone behind the far side as it comes down
        if (u >= 1 || (u > 0.5 && b.y >= L.farTouchY - 10)) b.on = false;
        return;
      }
      default:
        break;
    }
    // the goals
    const top = Math.max(4, gy - goal.barY - 5);
    if (v < 1) {
      let x: number;
      let h: number;
      if (g === "worldie") {
        x = lerp(sx, lx + 1, v);
        h = top * (0.75 * v + 0.25 * v * v);
      } else if (g === "topbins") {
        x = lerp(sx, lx + 1, v * (1.25 - 0.25 * v));
        h = top * (v + 3.2 * v * (1 - v));
      } else {
        x = lerp(sx, lx + 1, v);
        h = 1 - v;
      }
      b.x = Math.round(x);
      b.y = Math.round(hy - 2 - h);
      return;
    }
    const lineH = g === "goal" ? 0 : top;
    const lineY = gy - 2 - lineH;
    if (goal.kind === "jumpers") {
      // no net: it runs on towards the hedge
      const u = clamp((st - story.ta) / 0.9);
      const e = easeOutCubic(u);
      const row = Math.round(lerp(gy, L.farTouchY + 4, e));
      const h =
        lineH * (1 - u) * (1 - u) * (1 - u) +
        3 * arc(clamp((u - 0.3) / 0.3)) +
        arc(clamp((u - 0.6) / 0.15));
      b.x = Math.round(lerp(lx + 1, lx + Math.round(26 * L.stageScale), e));
      b.y = Math.round(row - 2 - h);
      b.sy = row;
      b.depth = row + 0.5;
      if (u >= 1) b.spin = 0;
      return;
    }
    // into the net: to the back of it, held there by the bulge, then down to the floor
    const backX = lx + Math.max(3, goal.depth - 3);
    const th = story.th;
    b.depth = gy - 0.5;
    if (st < th) {
      b.x = Math.round(lerp(lx + 1, backX, (st - story.ta) / (th - story.ta)));
      b.y = lineY;
      return;
    }
    const since = st - th;
    b.x = backX + Math.round(3 * this.bulgeAmount(story, st));
    if (since < 0.12) {
      b.y = lineY;
    } else if (since < 0.45) {
      const q = (since - 0.12) / 0.33;
      b.y = Math.round(lerp(lineY, gy - 2, q * q));
    } else {
      b.y = gy - 2 - Math.round(arc(clamp((since - 0.45) / 0.16)) * 2);
      if (since > 0.61) b.spin = 0;
    }
  }

  /** The new ball on its way to his feet (after the shot), then the flick up. */
  private givenBall(story: Story, st: number, b: Ball): void {
    const L = this.L;
    const hx = L.heroX;
    const hy = this.heroY();
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
      x0 = fx + 4;
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
    } else if (g === "ontarget") {
      // the keeper rolls it out: down from his hands, then along the grass
      const youth = this.youth();
      const kx = L.keeperX + (youth ? -5 : HOLD.x);
      const ky = L.groundY + (youth ? -8 : HOLD.y);
      const drop = 0.25 / story.deliverFor;
      if (u < drop) {
        const q = u / drop;
        b.x = Math.round(lerp(kx, kx - 6, q));
        b.y = Math.round(lerp(ky, L.groundY - 2, q * q));
        b.sy = L.groundY;
        return;
      }
      x0 = kx - 6;
      row0 = L.groundY;
      e = easeOutCubic((u - drop) / (1 - drop));
    } else {
      // thrown on from the near side, a bounce, then rolling to his feet
      x0 = hx - Math.round(16 * L.stageScale);
      row0 = L.h + 6;
      h = 12 * arc(clamp(u / 0.45)) + 3 * arc(clamp((u - 0.45) / 0.2));
    }
    const row = Math.round(lerp(row0, hy, e));
    b.x = Math.round(lerp(x0, fx, e));
    b.y = Math.round(row - 2 - h);
    b.sy = row;
    b.depth = row + 0.5;
    if (u >= 1) b.spin = 0;
  }

  /** The net's bulge after a goal, 0 to 1. */
  private bulgeAmount(story: Story, st: number): number {
    if (story.th < 0 || st < story.th) return 0;
    const peak =
      story.grade === "worldie" ? 1 : story.grade === "topbins" ? 0.8 : 0.65;
    return peak * clamp(1 - (st - story.th) / BULGE_SECONDS);
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
    for (let i = 0; i < CAST; i++) {
      const p = this.poses[i];
      p.on = i !== REF || tier >= 2;
      if (i === EXTRA_A || i === EXTRA_B) p.on = false;
      p.keeper = i === KEEPER && !youth;
      p.anim = "idle";
      p.kanim = "ready";
      // breathing, each to his own beat
      p.frame = Math.floor((t + i * 0.37) * 2);
      p.x = H.x[i];
      p.y = H.y[i];
      // facing: team-mates and the referee face the goal, opponents him; all watch the ball
      const right = i === OPP_A || i === OPP_B || i === KEEPER ? false : true;
      p.flip = !right;
      if (i !== KEEPER && i !== HERO) {
        if (right && ballX < p.x - 3) p.flip = true;
        if (!right && ballX > p.x + 3) p.flip = false;
      }
      p.depth = p.y;
    }
    const hero = this.poses[HERO];
    hero.y = this.heroY();
    hero.depth = hero.y + 0.4;
    if (this.fullT >= 0) {
      this.poseFullTime();
      return;
    }
    const story = this.story;
    if (!story) {
      hero.anim = "juggle";
      hero.frame = Math.floor(this.jug * 7);
      return;
    }
    this.poseStory(story, this.view(story));
  }

  private poseStory(story: Story, st: number): void {
    const g = story.grade;
    const ta = story.ta;
    const k = this.L.stageScale;
    const P0 = this.poses;
    const hero = P0[HERO];
    const keeper = P0[KEEPER];
    const youth = this.youth();
    const hx = hero.x;
    const hy = hero.y;

    // --- him: the set, the kick, the reaction, back for a new ball
    const left = g === "skipped" && st >= 0.12 && st < 1.85;
    hero.flip = left;
    const dir = left ? -1 : 1;
    if (st < KICK_AT) {
      hero.anim = "idle";
      hero.frame = 0;
      if (st > 0.12) hero.x = hx - 2 * dir;
    } else if (g === "timeup") {
      hero.anim = st < 0.75 ? "idle" : "dejected";
      hero.frame = st < 0.75 ? 0 : Math.floor((st - 0.75) * 1.5);
    } else if (st < KICK_AT + 0.45) {
      const f = Math.floor((st - KICK_AT) * 10);
      hero.anim = "kick";
      hero.frame = f;
      hero.x = hx - dir * (f === 0 ? 2 : f === 1 ? 1 : 0);
    } else {
      this.poseReaction(story, st, hero);
    }
    if (story.flickAt <= st && !story.reduced) {
      hero.anim = "juggle";
      hero.frame = 0;
      hero.flip = false;
      hero.x = hx;
      hero.y = hy;
    }

    // --- the keeper
    const relaxed = g === "timeup" || g === "skipped" || g === "wide";
    if (relaxed) keeper.frame = Math.floor(this.t * 1.2);
    if (youth) {
      if (story.goal && st >= ta + 0.3 && st < RETURN + 0.5) {
        keeper.anim = "dejected";
        keeper.frame = Math.floor((st - ta) * 1.5);
      } else if (g === "ontarget" && st >= ta && st < RETURN) {
        keeper.anim = "lift";
        keeper.frame = Math.floor((st - ta) * 3);
      }
    } else {
      this.poseKeeper(story, st, keeper);
    }

    // --- team-mates, opponents
    const mA = P0[MATE_A];
    const mB = P0[MATE_B];
    const oA = P0[OPP_A];
    const oB = P0[OPP_B];
    if (story.goal) {
      const mob = g === "worldie";
      for (let j = 0; j < 2; j++) {
        const m = j === 0 ? mA : mB;
        const at = ta + 0.2 + j * 0.12;
        if (st < at) continue;
        if (mob) {
          // they run to him on his knees and jump around him
          const ex =
            this.homes.x[HERO] +
            this.slideDX() +
            (j === 0 ? -Math.round(11 * k) : Math.round(8 * k));
          const ey = this.homes.y[HERO] + 5 + (j === 0 ? 3 : -3);
          const go = clamp((st - at) / 0.45);
          const home = clamp((st - RETURN) / 0.45);
          const p = go * (1 - home);
          m.x = Math.round(
            lerp(
              this.homes.x[j === 0 ? MATE_A : MATE_B],
              ex,
              easeInOutCubic(p),
            ),
          );
          m.y = Math.round(
            lerp(
              this.homes.y[j === 0 ? MATE_A : MATE_B],
              ey,
              easeInOutCubic(p),
            ),
          );
          m.depth = m.y;
          if ((go > 0 && go < 1) || (home > 0 && home < 1)) {
            m.anim = "run";
            m.frame = Math.floor(st * 10);
            m.flip = home > 0;
          } else if (home <= 0) {
            m.anim = "celebrate";
            m.frame = Math.floor((st - at) * 6);
            m.flip = j === 1;
          }
        } else if (st < RETURN + 0.4) {
          m.anim = "celebrate";
          m.frame = Math.floor((st - at) * 6);
        }
      }
      for (let j = 0; j < 2; j++) {
        const o = j === 0 ? oA : oB;
        if (st >= ta + 0.35 + j * 0.1 && st < RETURN + 0.8) {
          o.anim = "dejected";
          o.frame = Math.floor((st - ta) * 1.5);
        }
      }
    } else if (g === "ontarget") {
      if (st >= ta + 0.2 && st < RETURN) {
        mB.anim = "lift";
        mB.frame = 0;
      }
      if (st >= ta + 0.25 && st < ta + 1.0) {
        oB.anim = "celebrate";
        oB.frame = Math.floor((st - ta) * 6);
      }
    } else if (g === "wide") {
      if (st >= 1.3 && st < RETURN) {
        mA.anim = "dejected";
        mB.anim = "dejected";
        mA.frame = mB.frame = Math.floor(st * 1.5);
      }
      for (let j = 0; j < 2; j++) {
        const o = j === 0 ? oA : oB;
        const at = 1.2 + j * 0.15;
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

  /** His reaction, from the follow-through on. */
  private poseReaction(story: Story, st: number, hero: Pose): void {
    const g = story.grade;
    const ta = story.ta;
    const hx = this.homes.x[HERO];
    const hy = hero.y;
    hero.anim = "idle";
    hero.frame = Math.floor(st * 2);
    // the end of the kick
    if (st < KICK_AT + 0.5 && g !== "worldie") {
      hero.anim = "kick";
      hero.frame = 4;
    }
    switch (g) {
      case "worldie": {
        const D = this.slideDX();
        const dy = 5;
        if (st < RUN_AT) {
          hero.anim = "kick";
          hero.frame = 4;
        } else if (st < SLIDE_AT) {
          const u = (st - RUN_AT) / (SLIDE_AT - RUN_AT);
          hero.anim = "run";
          hero.frame = Math.floor(st * 10);
          hero.x = hx + Math.round(u * 0.45 * D);
          hero.y = hy + Math.round(u * 0.4 * dy);
        } else if (st < RETURN) {
          const u = easeOutCubic(
            clamp((st - SLIDE_AT) / (SLIDE_END - SLIDE_AT)),
          );
          hero.anim = "slide";
          hero.frame = Math.floor((st - SLIDE_AT) * 4);
          hero.x = hx + Math.round((0.45 + 0.55 * u) * D);
          hero.y = hy + Math.round((0.4 + 0.6 * u) * dy);
        } else {
          const back = Math.max(0.01, story.deliverAt - RETURN);
          const u = clamp((st - RETURN) / back);
          hero.x = hx + Math.round((1 - u) * D);
          hero.y = hy + Math.round((1 - u) * dy);
          if (u < 1) {
            hero.anim = "run";
            hero.frame = Math.floor(st * 10);
            hero.flip = true;
          }
        }
        hero.depth = hero.y + 0.4;
        return;
      }
      case "topbins":
        if (st >= ta + 0.08 && st < RETURN) {
          hero.anim = "celebrate";
          hero.frame = Math.floor((st - ta - 0.08) * 6);
        }
        return;
      case "goal":
        if (st >= ta + 0.08 && st < RETURN) {
          // a fist pump: crouch, arms up
          hero.anim = "celebrate";
          hero.frame = (Math.floor((st - ta - 0.08) * 4) & 1) * 2;
        }
        return;
      case "ontarget":
        if (st >= ta + 0.15 && st < RETURN) {
          // hands on his head
          hero.anim = "lift";
          hero.frame = 0;
        }
        return;
      case "wide":
        if (st >= 1.25 && st < RETURN) {
          hero.anim = "dejected";
          hero.frame = Math.floor((st - 1.25) * 1.5);
        }
        return;
      case "skipped":
        if (st >= 1.05 && st < 1.85) {
          hero.anim = "shrug";
          hero.frame = Math.floor((st - 1.05) * 2.5);
        }
        return;
      default:
        return;
    }
  }

  private poseKeeper(story: Story, st: number, keeper: Pose): void {
    const g = story.grade;
    const ta = story.ta;
    keeper.keeper = true;
    switch (g) {
      case "worldie":
        if (st >= STRIKE && st < ta + 0.25) {
          keeper.kanim = "ready";
          keeper.frame = 0;
        } else if (st >= ta + 0.25 && st < RETURN + 0.5) {
          keeper.kanim = "beaten";
        }
        return;
      case "topbins": {
        const tl = ta - 0.3;
        if (st < tl || st >= RETURN + 0.5) return;
        if (st < tl + 0.08) {
          keeper.kanim = "leap";
          keeper.frame = 0;
        } else if (st < tl + 0.5) {
          keeper.kanim = "leap";
          keeper.frame = st < tl + 0.2 ? 1 : 2;
          const u = (st - tl - 0.08) / 0.42;
          keeper.y -= Math.round(arc(u) * this.keeperLift(story));
        } else if (st < tl + 0.62) {
          keeper.kanim = "ready";
          keeper.frame = 0;
        } else {
          keeper.kanim = "beaten";
        }
        return;
      }
      case "goal":
        if (st >= ta - 0.05 && st < ta + 0.07) {
          keeper.kanim = "smother";
          keeper.frame = 0;
        } else if (st >= ta + 0.07 && st < ta + 0.6) {
          keeper.kanim = "smother";
          keeper.frame = 1;
        } else if (st >= ta + 0.6 && st < RETURN + 0.5) {
          keeper.kanim = "beaten";
        }
        return;
      case "ontarget":
        if (st >= ta - 0.12 && st < ta) {
          keeper.kanim = "leap";
          keeper.frame = 0;
        } else if (st >= ta && st < RETURN) {
          keeper.kanim = "hold";
          keeper.frame = 0;
        } else if (st >= RETURN && st < RETURN + 0.3) {
          keeper.kanim = "smother";
          keeper.frame = 0;
        }
        return;
      default:
        return;
    }
  }

  /** How high the keeper leaps for a top-corner goal: his gloves a pixel short of it. */
  private keeperLift(story: Story): number {
    const L = this.L;
    // worked out once per shot and size
    if (story.liftFor === L.w * 10000 + L.h) return story.lift;
    const gx = L.keeperX + LEAP_TOP.x;
    const gloves = L.groundY + LEAP_TOP.y;
    // where the ball is as it passes his gloves
    const b = this.probe;
    let by = gloves;
    for (let i = 0; i <= 24; i++) {
      this.shotBall(story, STRIKE + (FLIGHT[story.grade] * i) / 24, b);
      by = b.y;
      if (b.x >= gx) break;
    }
    story.lift = clamp(gloves - (by + 3), 0, 8);
    story.liftFor = L.w * 10000 + L.h;
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
      hero.depth = L.groundY + 2;
      const x0 = pd.x - (pd.w >> 1);
      const a = P0[MATE_A];
      const b = P0[MATE_B];
      a.x = x0 + 5;
      a.y = L.groundY - 2;
      a.flip = false;
      b.x = x0 + pd.w - 5;
      b.y = L.groundY - 1;
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
      a.y = L.groundY + 3;
      a.flip = false;
      b.x = L.heroX + Math.round(13 * k);
      b.y = L.groundY - 3;
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
    if (story && story.grade === "worldie" && story.th >= 0) {
      const a = story.st - story.th;
      if (a >= 0 && a < 0.2)
        return WORLDIE_SHAKE[Math.min(4, Math.floor(a / 0.04))];
    }
    return 0;
  }

  private shakeY(): number {
    if (this.reduced) return 0;
    const story = this.story;
    if (story && story.grade !== "timeup") {
      const a = story.st - STRIKE;
      if (a >= 0 && a < 0.06) return 1;
    }
    const p = this.promotion;
    if (p) {
      const a = p.t - BUILD.thud;
      if (a >= 0 && a < 0.12) return Math.floor(a / 0.04) % 2 === 0 ? 1 : 0;
    }
    return 0;
  }

  private paint(s: Surface): void {
    const ground = this.ground;
    const L = this.L;
    const t = this.t;
    const light = ground.light;
    ensureKits(this.kits, this.tier, this.mode, light);
    ground.drawBack(s, t);

    const story = this.story;
    const st = story ? this.view(story) : 0;

    // fireworks over the stand for a goal, at the stadium tiers
    if (story && story.goal && this.tier >= 4 && !this.reduced) {
      const big = story.grade === "worldie";
      drawGoalFireworks(
        s,
        st - story.ta - 0.1,
        big ? 6 : 3,
        big,
        L.stageLeft - Math.round(30 * L.stageScale),
        L.stageRight + Math.round(30 * L.stageScale),
        L.farTouchY - 71,
        this.seed,
        MODE_COLORS[this.mode].light,
      );
    }

    // the balls: the shot's, the new one on its way, or the juggled one
    const shot = this.shot;
    const given = this.given;
    const held = this.held;
    shot.on = false;
    given.on = false;
    held.on = false;
    if (story) {
      const delivering = !story.reduced && st >= story.deliverAt;
      if (delivering) {
        this.givenBall(story, st, given);
        if (story.goal) this.shotBall(story, st, shot);
      } else {
        this.shotBall(story, st, shot);
      }
    } else if (this.fullT < 0) {
      this.juggleBall(given);
    }
    if (!story && this.rest > 0) this.restBall(shot);
    const look = given.on ? given.x : shot.on ? shot.x : L.heroX;
    this.poseCast(look);

    // the match ball held up at full time (below the top tier)
    if (this.fullT >= 0 && !ground.podium) {
      const hero = this.poses[HERO];
      const f = hero.frame & 1;
      const o = this.youth() ? 4 : 0;
      held.on = true;
      held.x = hero.x + LIFT[o + f * 2];
      held.y = hero.y + LIFT[o + f * 2 + 1] - 2;
      held.sy = -1;
      held.depth = hero.depth + 0.05;
      held.spin = 0;
    }

    // shadows on the grass first, under everyone
    for (let i = 0; i < CAST; i++) {
      const p = this.poses[i];
      if (!p.on) continue;
      const small = this.youth() && !p.keeper;
      const half = small ? 3 : 4;
      const lifted = p.keeper && p.kanim === "leap";
      if (!lifted || p.y === this.homes.y[i])
        shadowRow(s, p.x - half, p.x + half - 1, p.y);
      else shadowRow(s, p.x - half + 1, p.x + half - 2, this.homes.y[i]);
    }
    if (shot.on && shot.sy >= 0) shadowRow(s, shot.x - 1, shot.x + 1, shot.sy);
    if (given.on && given.sy >= 0)
      shadowRow(s, given.x - 1, given.x + 1, given.sy);

    // the people and the balls, far to near
    const n = this.sortCast(shot, given, held);
    const kits = this.kits.list;
    for (let j = 0; j < n; j++) {
      const i = this.order[j];
      if (i >= CAST) {
        const b = i === CAST ? shot : i === CAST + 1 ? given : held;
        this.paintBall(s, b, story, st);
        continue;
      }
      const p = this.poses[i];
      if (p.keeper) {
        this.keeperOpts.flipX = p.flip;
        drawKeeper(s, p.kanim, p.frame, p.x, p.y, kits[i], this.keeperOpts);
      } else {
        this.playerOpts.flipX = p.flip;
        this.playerOpts.youth = this.youth() && i !== REF;
        drawPlayer(s, p.anim, p.frame, p.x, p.y, kits[i], this.playerOpts);
      }
      if (i === HERO && this.fullT >= 0 && ground.podium) {
        const f = p.frame & 1;
        const glint = this.fullT % 1.4 < 0.12;
        drawTrophy(s, p.x + LIFT[f * 2], p.y + LIFT[f * 2 + 1], light, glint);
      }
    }

    // the puff at his standing foot as he strikes it
    if (story && !story.reduced && story.grade !== "timeup") {
      const a = st - STRIKE;
      if (a >= 0 && a < 0.3) {
        const left = story.grade === "skipped";
        const grade = this.tier <= 1 ? light.env : light.lit;
        drawPuff(
          s,
          L.heroX + (left ? 2 : -2),
          this.heroY(),
          Math.floor(a * 10),
          grade(P.grassHi),
        );
      }
    }

    // the goal's front layer: a ball in the net shows through the mesh
    const bulge = this.bulge;
    bulge.amount = story ? this.bulgeAmount(story, st) : 0;
    bulge.y = shot.y;
    ground.drawFront(s, t, bulge.amount > 0 ? bulge : null);

    if (story && !story.reduced) {
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
        st >= STRIKE - 0.05 &&
        st < STRIKE + 1.4
      ) {
        const ref = this.tier >= 2 ? this.poses[REF] : this.poses[HERO];
        const tall = this.youth() ? 16 : 20;
        drawWhistle(
          s,
          ref.x,
          ref.y - tall + 1,
          st - STRIKE + 0.05,
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
        L.groundY + 12,
        this.seed,
        ramp.base,
        ramp.light,
      );
    }

    // a promotion: the builders' dust
    const p = this.promotion;
    if (p && !this.reduced) {
      if (!p.colors) p.colors = buildColors(p.to <= 1 ? light.env : light.lit);
      drawBuild(s, p.t, p.area, p.colors, this.seed);
    }
  }

  /** The last goal's ball where it came to rest. */
  private restBall(b: Ball): void {
    const L = this.L;
    const goal = this.ground.goal;
    b.on = true;
    b.spin = 0;
    if (this.rest === 2 || goal.kind === "jumpers") {
      const row = L.farTouchY + 4;
      b.x = goal.lineX + Math.round(26 * L.stageScale);
      b.y = row - 2;
      b.sy = row;
      b.depth = row + 0.5;
    } else {
      b.x = goal.lineX + Math.max(3, goal.depth - 3);
      b.y = L.groundY - 2;
      b.sy = L.groundY;
      b.depth = L.groundY - 0.5;
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
    // the worldie's gold trail behind it in flight: a streak, brightest nearest the ball
    if (
      b === this.shot &&
      story &&
      story.grade === "worldie" &&
      !story.reduced
    ) {
      const v = (st - STRIKE) / FLIGHT.worldie;
      if (v > 0 && v < 1.12) {
        gold = true;
        const q = this.probe;
        let px = b.x;
        let py = b.y;
        for (let j = 1; j <= 7; j++) {
          this.shotBall(story, Math.max(STRIKE, st - j * 0.02), q);
          const c = j <= 2 ? P.goldLight : j <= 5 ? P.gold : P.goldDark;
          s.line(px, py, q.x, q.y, c);
          if (j <= 4)
            s.line(px, py + 1, q.x, q.y + 1, j <= 2 ? P.gold : P.goldDark);
          px = q.x;
          py = q.y;
        }
      }
    }
    // the 1 px ink outline every ball and character has (art bible section 4)
    const ink = light.lit(P.ink);
    s.hline(b.x - 1, b.y - 2, 3, ink);
    s.hline(b.x - 1, b.y + 2, 3, ink);
    s.vline(b.x - 2, b.y - 1, 3, ink);
    s.vline(b.x + 2, b.y - 1, 3, ink);
    drawMatchBall(s, b.x, b.y, b.spin, light, gold ? GOLD : undefined);
  }

  /** Far to near: people and balls by their depth (`order` gets the indices). */
  private sortCast(shot: Ball, given: Ball, held: Ball): number {
    let n = 0;
    for (let i = 0; i < CAST; i++) {
      const p = this.poses[i];
      if (p.on) n = this.insert(n, i, p.depth);
    }
    if (shot.on) n = this.insert(n, CAST, shot.depth);
    if (given.on) n = this.insert(n, CAST + 1, given.depth);
    if (held.on) n = this.insert(n, CAST + 2, held.depth);
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
