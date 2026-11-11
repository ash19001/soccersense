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
  paintStadium,
  paintStreet,
  STAND,
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
import { geoFor, paintFor, type Geo, type Grade, type Paint } from "./paint";
import { paintNear } from "./near";
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
  private w = 130;
  private h = 281;
  private playerLight: Lighting = lightingFor({
    elevation: 30,
    morning: false,
  });
  private mood: CrowdMood = "idle";
  private moodT = -1e9;

  private dirty = true;
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
    if (this.tier === 7) drawTicker(s, Number.isFinite(t) ? t : 0, this.seed);
  }

  // -------------------------------------------------------------------------

  private ensure(s: Surface): void {
    if (s.w !== this.w || s.h !== this.h) this.resize(s.w, s.h);
    if (this.dirty || !this.layer) this.build();
  }

  private build(): void {
    this.dirty = false;
    const g = this.geo;
    const tier = this.tier;
    const light = this.light;
    const p = paintFor(g, light, tier, this.mode, this.seed, this.labels);
    const layer =
      this.layer && this.layer.w === g.w && this.layer.h === g.h
        ? this.layer
        : new Surface(g.w, g.h);
    layer.clear();
    const cap = Math.ceil(
      (g.w / 4 + 4) * (tier >= 4 ? 34 : tier >= 2 ? 16 : 1),
    );
    const life = new Life(cap);

    // the far side, back to front
    paintStreet(layer, p, life);
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
    if (tier === 2) paintClubGround(layer, p, life);
    if (tier === 3) paintProperGround(layer, p, life);
    if (tier >= 4) paintStadium(layer, p, life);

    // the pitch, things on it, the near side
    const G: Grade = tier <= 1 ? p.E : p.S;
    paintPitch(layer, p, G);
    if (tier >= 3) paintPhotographers(layer, p);
    if (tier === 7) paintPodium(layer, p);
    paintNear(layer, p, life);
    if (tier <= 1 && p.lamps) {
      // the lamp's warm pool: the same pitch and near side in its light, let through
      const warmGrade = warmFor(light);
      const warm = new Surface(g.w, g.h);
      const wp: Paint = { ...p, E: warmGrade, S: warmGrade };
      paintPitch(warm, wp, warmGrade);
      paintNear(warm, wp, new Life(0));
      poolOfLight(layer, warm, p);
    }

    // smoke only rises from chimneys still in view, washing only where it shows
    life.smoke = life.smoke.filter(
      (c) =>
        layer.get(c.x, c.y) === TRANSPARENT &&
        layer.get(c.x + 1, c.y + 3) !== TRANSPARENT,
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
    this.skyRows = rows;
    // over a stadium the moon rides clear above its roof and flags, on the right
    if (tier >= 4) {
      const r = moonPosition(g.w, g.B, g.boardShrunkY).r;
      const roof = g.F - STAND.roofTop - 12;
      this.sky.moon = {
        x: Math.round(g.w * 0.86),
        y: Math.max(r + 2, roof - r - 2),
      };
    } else {
      this.sky.moon = undefined;
    }
    this.layer = layer;
    this.life = life;
    this.colors = goalColors(G, tier);
    this.goalNow = goalFor(tier, g);
    this.podiumNow = tier === 7 ? podiumFor(g) : null;
  }
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
