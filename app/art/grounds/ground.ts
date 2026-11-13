/**
 * The career ground (docs/CAREER_SCENE.md): the place the footballer plays, which grows
 * from a park into a World Cup stadium as his points go up.
 *
 * Everything that does not move is painted once per size, light, tier and mode into one
 * cached layer (sky holes left transparent) and copied each frame. A frame is the sky over
 * the rows where it shows, the layer, then the moving things the build listed in its
 * `Life` (smoke, washing, birds, the crowd's reactions, flags, LED boards, the watchers,
 * the dog), then the goal's back layer. `drawFront` adds the goal's front layer and, at
 * tier 7, the ticker tape. Drawing allocates nothing.
 */

import type { Mode } from "~/game/types";
import type { Era } from "~/art/era";
import { lightingFor, type Lighting } from "~/art/lighting";
import { drawSky, moonPosition, type SkyOptions } from "~/art/sky";
import { Surface, TRANSPARENT, type BlitOptions } from "~/pixel";
import {
  addCornerFlag,
  addMates,
  addParents,
  addRope,
  paintClubGround,
  paintHedge,
  paintHut,
  paintProperGround,
  paintStreet,
} from "./far";
import {
  drawGoalBack,
  drawGoalFront,
  goalColors,
  goalFor,
  type GoalColors,
} from "./goal";
import {
  Life,
  drawFarLife,
  drawNearLife,
  drawRope,
  drawSkyLife,
  drawTicker,
} from "./life";
import { paintEnd } from "./end";
import { geoFor, paintFor, type Geo, type Grade, type Paint } from "./paint";
import { paintNear } from "./near";
import { paintStadium } from "./stadium";
import { STAND } from "./stand";
import { drawGlowTape } from "./nextgen-high";
import { coolPool } from "./nextgen-low";
import { drawPaperTape } from "./retro-high";
import {
  paintPhotographers,
  paintPitch,
  paintPodium,
  podiumFor,
  poolOfLight,
} from "./pitch";
import type {
  CrowdMood,
  GroundGoal,
  GroundLabels,
  GroundPodium,
  NetBulge,
  Tier,
} from "./types";
import { mix, type Color } from "~/pixel";
import { P } from "~/art/palette";

/** Tiers 6 and 7 are always played at night: a clear sky with the sun well down. */
export const FINAL_NIGHT = lightingFor({ elevation: -20, morning: false });

export interface CareerGroundOptions {
  seed: number;
  mode: Mode;
  tier: Tier;
  labels?: GroundLabels;
  /** The era it is drawn in (`~/art/era`); "today" (HOME's and AWAY's look) by default. */
  era?: Era;
}

function clampTier(t: number): Tier {
  const n = Math.max(0, Math.min(7, Math.round(Number.isFinite(t) ? t : 0)));
  return n as Tier;
}

export class CareerGround {
  private seed: number;
  private mode: Mode;
  private tier: Tier;
  private labels: GroundLabels;
  /** The era it is drawn in, fixed for the ground's life (`~/art/era`). */
  private readonly era: Era;
  private w = 130;
  private h = 281;
  private playerLight: Lighting = lightingFor({
    elevation: 30,
    morning: false,
  });
  private mood: CrowdMood = "idle";
  private moodT = -1e9;

  private dirty = true;
  /** The picture on show, and one being built a slice a frame. */
  private built: Built | null = null;
  private job: Job | null = null;
  private layer: Surface | null = null;
  private geo: Geo = geoFor(130, 281);
  private life: Life = new Life(0);
  private colors: GoalColors | null = null;
  private skyRows = 0;
  private readonly skyBlit: BlitOptions = { sx: 0, sy: 0, sw: 0, sh: 0 };
  /** drawSky's options, reused every frame. */
  private readonly sky: SkyOptions = {
    light: FINAL_NIGHT,
    t: 0,
    seed: 0,
    horizonY: 0,
  };
  private goalNow: GroundGoal;
  private podiumNow: GroundPodium | null = null;

  constructor(opts: CareerGroundOptions) {
    this.seed = Math.round(Number.isFinite(opts.seed) ? opts.seed : 0) | 0;
    this.mode = opts.mode === "away" ? "away" : "home";
    this.tier = clampTier(opts.tier);
    this.labels = opts.labels ?? {};
    this.era = opts.era ?? "today";
    this.goalNow = goalFor(this.tier, this.geo);
  }

  /** The goal of this tier at this size. */
  get goal(): GroundGoal {
    return this.goalNow;
  }

  /** The light actually in use: the player's sky, or night at tiers 6 and 7. */
  get light(): Lighting {
    return this.tier >= 6 ? FINAL_NIGHT : this.playerLight;
  }

  /** The podium the hero stands on at tier 7, or null below it. */
  get podium(): GroundPodium | null {
    return this.podiumNow;
  }

  resize(w: number, h: number): void {
    const W = Math.max(1, Math.round(Number.isFinite(w) ? w : 1));
    const H = Math.max(1, Math.round(Number.isFinite(h) ? h : 1));
    if (W === this.w && H === this.h && this.layer) return;
    this.w = W;
    this.h = H;
    this.geo = geoFor(W, H);
    this.job = null;
    this.built = null;
    this.goalNow = goalFor(this.tier, this.geo);
    this.podiumNow = this.tier === 7 ? podiumFor(this.geo) : null;
    this.dirty = true;
  }

  setLighting(light: Lighting): void {
    if (light === this.playerLight) return;
    const before = this.light;
    this.playerLight = light;
    if (this.light !== before) this.dirty = true;
  }

  setMode(mode: Mode): void {
    const m = mode === "away" ? "away" : "home";
    if (m === this.mode) return;
    this.mode = m;
    this.dirty = true;
  }

  setTier(tier: Tier): void {
    const t = clampTier(tier);
    if (t === this.tier) return;
    this.tier = t;
    this.goalNow = goalFor(t, this.geo);
    this.podiumNow = t === 7 ? podiumFor(this.geo) : null;
    this.dirty = true;
  }

  /** The crowd and the watchers react to `mood` from scene time `t`. */
  setMood(mood: CrowdMood, t: number): void {
    this.mood = mood;
    this.moodT = Number.isFinite(t) ? t : 0;
  }

  drawBack(s: Surface, t: number): void {
    this.ensure(s);
    const layer = this.layer;
    if (!layer) return;
    const time = Number.isFinite(t) ? t : 0;
    const g = this.geo;
    const since = time - this.moodT;
    if (this.skyRows > 0) {
      s.pushClip(0, 0, s.w, this.skyRows);
      const sky = this.sky;
      sky.light = this.light;
      sky.t = time;
      sky.seed = this.seed;
      sky.horizonY = g.B;
      sky.clearTop = g.boardShrunkY;
      sky.clouds = this.tier >= 6 ? 0.15 : 0.45;
      drawSky(s, sky);
      drawSkyLife(s, this.life, time, this.seed);
      s.popClip();
      this.skyBlit.sw = layer.w;
      this.skyBlit.sh = this.skyRows;
      s.blit(layer, 0, 0, this.skyBlit);
    }
    if (this.skyRows < s.h) {
      s.pushClip(0, this.skyRows, s.w, s.h - this.skyRows);
      s.copy(layer, 0, 0);
      s.popClip();
    }
    drawFarLife(s, this.life, time, this.seed, this.mood, since);
    drawNearLife(s, this.life, time, this.mood, since);
    if (this.colors) drawGoalBack(s, g, this.goalNow.kind, this.colors);
  }

  drawFront(s: Surface, t: number, bulge?: NetBulge | null): void {
    this.ensure(s);
    if (!this.layer || !this.colors) return;
    drawGoalFront(s, this.geo, this.goalNow.kind, this.colors, bulge);
    if (this.tier === 7) {
      const time = Number.isFinite(t) ? t : 0;
      // NEXT-GEN's glowing confetti (nextgen-high.ts) in place of the ticker tape
      if (this.era === "nextgen") drawGlowTape(s, time, this.seed);
      // RETRO's torn paper and streamers (retro-high.ts)
      else if (this.era === "retro") drawPaperTape(s, time, this.seed);
      else drawTicker(s, time, this.seed);
    }
  }

  // -------------------------------------------------------------------------

  /**
   * Build the picture for `tier` ahead of time: a promotion asks for the next tier's as it
   * starts, and it is built a slice a frame under the smoke, so the frame that swaps the
   * tier in only has to show it.
   */
  prepare(tier: number): void {
    const t = clampTier(tier);
    const light = this.lightFor(t);
    const job = this.job;
    if (
      job &&
      job.tier === t &&
      job.mode === this.mode &&
      job.light === light
    ) {
      return;
    }
    if (this.layer && !this.dirty && this.shown(t, this.mode, light)) return;
    this.job = this.startJob(t, light, new Surface(this.geo.w, this.geo.h));
  }

  private ensure(s: Surface): void {
    if (s.w !== this.w || s.h !== this.h) this.resize(s.w, s.h);
    const job = this.job;
    if (!this.dirty && this.layer) {
      // a picture prepared ahead (the next tier during a promotion): a slice a frame
      if (job && !job.built) this.step(job);
      return;
    }
    const tier = this.tier;
    const light = this.light;
    const mode = this.mode;
    const layer = this.layer;
    if (job && job.tier === tier && job.mode === mode && job.light === light) {
      if (layer && !job.built && this.shown(tier, mode, null)) {
        // relit: the last picture stays until the new one is done
        this.step(job);
        if (!job.built) return;
      }
      this.apply(finish(job));
      return;
    }
    if (layer && this.shown(tier, mode, null)) {
      // a change of light only (the sky moving on): built a slice a frame, so the step is
      // never a long frame (the home picture does the same, stadium-town.ts). The
      // first slice waits for the next frame: this one regrades the players' kits.
      this.job = this.startJob(tier, light, new Surface(layer.w, layer.h));
      return;
    }
    // everything else (the first picture, a new size, tier or mode) is built at once
    this.job = null;
    const g = this.geo;
    const reuse = layer && layer.w === g.w && layer.h === g.h ? layer : null;
    this.apply(
      finish(this.startJob(tier, light, reuse ?? new Surface(g.w, g.h))),
    );
  }

  /** The light a tier is played in. */
  private lightFor(tier: Tier): Lighting {
    return tier >= 6 ? FINAL_NIGHT : this.playerLight;
  }

  /** Whether the layer on show is of this tier and mode (and light, unless null). */
  private shown(tier: Tier, mode: Mode, light: Lighting | null): boolean {
    const b = this.built;
    return (
      b !== null &&
      b.tier === tier &&
      b.mode === mode &&
      (light === null || b.light === light)
    );
  }

  private startJob(tier: Tier, light: Lighting, layer: Surface): Job {
    const mode = this.mode;
    return {
      tier,
      mode,
      light,
      steps: this.buildSteps(tier, light, mode, layer),
      built: null,
    };
  }

  private step(job: Job): void {
    const r = job.steps.next();
    if (r.done) job.built = r.value;
  }

  private apply(b: Built): void {
    if (this.job?.built === b) this.job = null;
    this.dirty = false;
    this.built = b;
    this.layer = b.layer;
    this.life = b.life;
    this.skyRows = b.skyRows;
    this.sky.moon = b.moon;
    this.colors = b.colors;
    this.goalNow = b.goal;
    this.podiumNow = b.podium;
  }

  /** The picture of `tier` in `light`, painted into `layer`, in slices of a few ms each. */
  private *buildSteps(
    tier: Tier,
    light: Lighting,
    mode: Mode,
    layer: Surface,
  ): Generator<void, Built, void> {
    const g = this.geo;
    const p = paintFor(g, light, tier, mode, this.seed, this.labels, this.era);
    layer.clear();
    const cap = Math.ceil(
      (g.w / 4 + 4) * (tier >= 4 ? 34 : tier >= 2 ? 16 : 1),
    );
    const life = new Life(cap);

    // the far side, back to front
    paintStreet(layer, p, life);
    yield;
    paintHedge(layer, p, tier <= 1, life);
    if (tier === 0) addMates(p, life);
    if (tier === 1) {
      paintHut(layer, p);
      addParents(p, life);
      addRope(p, life);
      const r = life.rope;
      if (r) drawRope(layer, r.x0, r.x1, r.y, r.step, r.rope, r.stake);
    }
    if (tier >= 1) addCornerFlag(p, life);
    yield;
    if (tier === 2) paintClubGround(layer, p, life);
    if (tier === 3) paintProperGround(layer, p, life);
    if (tier >= 4) paintStadium(layer, p, life);
    yield;

    // the pitch, things on it, the near side
    const G: Grade = tier <= 1 ? p.E : p.S;
    paintPitch(layer, p, G);
    if (tier >= 3) paintPhotographers(layer, p);
    if (tier === 7) paintPodium(layer, p);
    yield;
    paintNear(layer, p, life);
    yield;
    // the end behind the goal, wrapping round from the far corner (tiers 3-7)
    if (tier >= 3) {
      paintEnd(layer, p, life);
      yield;
    }
    if (tier <= 1 && p.lamps) {
      // the lamp's warm pool: the same pitch and near side in its light, let through
      // (NEXT-GEN's lamp is cool: nextgen-low.ts)
      const warmGrade =
        this.era === "nextgen" ? coolPool(light) : warmFor(light);
      const warm = new Surface(g.w, g.h);
      const wp: Paint = { ...p, E: warmGrade, S: warmGrade };
      paintPitch(warm, wp, warmGrade);
      yield;
      paintNear(warm, wp, new Life(0));
      yield;
      poolOfLight(layer, warm, p);
      yield;
    }

    // smoke only rises from chimneys still in view, washing only where it shows
    life.smoke = life.smoke.filter(
      (c) =>
        layer.get(c.x, c.y) === TRANSPARENT &&
        layer.get(c.x + 2, c.y + 6) !== TRANSPARENT,
    );
    if (tier >= 2) life.washing = null;
    life.smokeColors = [p.D(P.mist, 0.2), p.D(P.steel, 0.2)];

    // the sky shows down to the last row with a hole in the layer
    let rows = 0;
    const data = layer.data;
    for (let y = g.h - 1; y >= 0 && rows === 0; y--) {
      const o = y * g.w;
      for (let x = 0; x < g.w; x++) {
        if (data[o + x] === TRANSPARENT) {
          rows = y + 1;
          break;
        }
      }
    }
    // an era's movers learn what of them the finished layer leaves in view (none today)
    for (const m of life.movers) m.seen?.(layer);
    // over a stadium the moon rides clear above its roof and flags, on the right
    let moon: Built["moon"];
    if (tier >= 4) {
      const r = moonPosition(g.w, g.B, g.boardShrunkY).r;
      const roof = g.F - STAND.roofTop - 24;
      moon = {
        x: Math.round(g.w * 0.86),
        y: Math.max(r + 4, roof - r - 4),
      };
    }
    return {
      tier,
      mode,
      light,
      layer,
      life,
      skyRows: rows,
      moon,
      colors: goalColors(G, tier, this.era),
      goal: goalFor(tier, g),
      podium: tier === 7 ? podiumFor(g) : null,
    };
  }
}

/** A finished picture of one tier, mode and light. */
interface Built {
  tier: Tier;
  mode: Mode;
  light: Lighting;
  layer: Surface;
  life: Life;
  skyRows: number;
  moon: SkyOptions["moon"];
  colors: GoalColors;
  goal: GroundGoal;
  podium: GroundPodium | null;
}

/** A picture being built a slice a frame, and the result once it is done. */
interface Job {
  tier: Tier;
  mode: Mode;
  light: Lighting;
  steps: Generator<void, Built, void>;
  built: Built | null;
}

/** Run a job's remaining slices now. */
function finish(job: Job): Built {
  if (job.built) return job.built;
  let r = job.steps.next();
  while (!r.done) r = job.steps.next();
  job.built = r.value;
  return r.value;
}

/** The street lamp's pool: between the sky's light and the floodlit grade, warmed. */
function warmFor(light: Lighting): Grade {
  const cache = new Map<Color, Color>();
  return (c) => {
    const hit = cache.get(c);
    if (hit !== undefined) return hit;
    const v = mix(mix(light.env(c), light.lit(c), 0.6), P.amber, 0.1);
    cache.set(c, v);
    return v;
  };
}
