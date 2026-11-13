/**
 * The career scene's cast (docs/CAREER_SCENE.md section 2): who stands where, in which
 * kit, and the sprite spots the scene needs every frame, read once from `~/art/characters`
 * so that a frame never allocates.
 */

import {
  HERO_LOOK,
  ballSpot,
  handsSpot,
  keeperHands,
  litKit,
  makeKit,
  type KeeperAnim,
  type Kit,
  type PlayerAnim,
} from "~/art/characters";
import { ballKidKit, type FetchAnim } from "~/art/characters/fetch";
import type { Era } from "~/art/era";
import type { CareerLayout } from "~/art/layout";
import type { Lighting } from "~/art/lighting";
import type { Mode } from "~/game";

/** The cast, by index. */
export const HERO = 0;
export const KEEPER = 1;
export const MATE_A = 2;
export const MATE_B = 3;
export const OPP_A = 4;
export const OPP_B = 5;
export const REF = 6;
/** Two more team-mates, only in the trophy lift. */
export const EXTRA_A = 7;
export const EXTRA_B = 8;
/**
 * The ball kid behind the goal, by the end's boards, at tiers 2 to 7: he throws back a ball that went over the bar or wide (career.ts, "The fetch").
 */
export const BALLKID = 9;
export const CAST = 10;

/** One person's pose this frame (reused, never allocated per frame). */
export interface Pose {
  on: boolean;
  /** "keeper" poses use the keeper's own animations. */
  keeper: boolean;
  anim: PlayerAnim;
  kanim: KeeperAnim;
  /** A fetch frame (`~/art/characters/fetch.ts`), drawn instead of `anim`; or null. */
  fetch: FetchAnim | null;
  frame: number;
  x: number;
  y: number;
  flip: boolean;
  /** Draw order: larger is nearer the camera. */
  depth: number;
}

export function newPose(): Pose {
  return {
    on: false,
    keeper: false,
    anim: "idle",
    kanim: "ready",
    fetch: null,
    frame: 0,
    x: 0,
    y: 0,
    flip: false,
    depth: 0,
  };
}

/** Where everyone stands while he juggles (section 2, offsets scaled to the stage). */
export interface Homes {
  x: Int32Array;
  y: Int32Array;
}

export function newHomes(): Homes {
  return { x: new Int32Array(CAST), y: new Int32Array(CAST) };
}

export function fillHomes(h: Homes, L: CareerLayout): void {
  // Across, offsets ride on the stage's scale; down, they are pixels.
  const k = L.stageScale;
  const at = (off: number): number => L.cx + Math.round(off * k);
  const gy = L.groundY;
  h.x[HERO] = L.heroX;
  h.y[HERO] = gy;
  h.x[KEEPER] = L.keeperX;
  h.y[KEEPER] = gy;
  h.x[MATE_A] = at(-52);
  h.y[MATE_A] = gy + 8;
  h.x[MATE_B] = at(-6);
  h.y[MATE_B] = gy - 10;
  h.x[OPP_A] = at(10);
  h.y[OPP_A] = gy + 10;
  h.x[OPP_B] = at(24);
  h.y[OPP_B] = gy - 8;
  h.x[REF] = at(-40);
  h.y[REF] = gy - 12;
  h.x[EXTRA_A] = L.heroX - Math.round(26 * k);
  h.y[EXTRA_A] = gy + 8;
  h.x[EXTRA_B] = L.heroX + Math.round(24 * k);
  h.y[EXTRA_B] = gy + 6;
  // behind the goal line, past the back of the net, just in front of the end's boards
  h.x[BALLKID] = Math.min(Math.round(endFrontX(L, gy)) - 10, L.w - 12);
  h.y[BALLKID] = gy;
}

/**
 * Where the front of the end behind the goal is on `row` (tiers 3 to 7: the end's boards,
 * `~/art/grounds/end.ts`): the line across the pitch 16 stage px behind
 * the goal line, leaning as the goal line does, towards the pitch's vanishing point
 * (`~/art/grounds/paint.ts`, `geoFor` and `across`).
 */
export function endFrontX(L: CareerLayout, row: number): number {
  const reach = Math.max(16, (L.goalX - L.cx) / 0.8);
  const vy = L.groundY - reach;
  const f0 = L.goalX + Math.round(16 * L.stageScale);
  return L.cx + ((f0 - L.cx) * (row - vy)) / (L.groundY - vy);
}

/** Everyone's kit for one tier and mode, graded for one light. */
export interface Kits {
  tier: number;
  light: Lighting | null;
  list: Kit[];
}

export function newKits(): Kits {
  return { tier: -1, light: null, list: [] };
}

/** Make the tier's kits again if the tier or the light changed. */
export function ensureKits(
  kits: Kits,
  tier: number,
  mode: Mode,
  light: Lighting,
  era: Era = "today",
): void {
  if (kits.tier === tier && kits.light === light) return;
  kits.tier = tier;
  kits.light = light;
  const home = mode === "home";
  const park = tier === 0;
  const national = tier >= 5;
  const team = park
    ? null
    : national
      ? home
        ? "national-home"
        : "national-away"
      : home
        ? "home"
        : "away";
  const heroKit = team ?? (home ? "casual-home" : "casual-away");
  const mate = (look: 0 | 1 | 2, variant: number): Kit =>
    team
      ? makeKit(team, { look, era })
      : makeKit("casual", { look, variant, era });
  const foe = (look: 0 | 1 | 2, variant: number): Kit =>
    park
      ? makeKit("casual", { look, variant, era })
      : makeKit("rival", { look, era });
  const raw: Kit[] = [];
  raw[HERO] = makeKit(heroKit, { look: HERO_LOOK, variant: 1, era });
  raw[KEEPER] = makeKit("keeper", { look: 0, variant: 2, era });
  raw[MATE_A] = mate(0, 0);
  raw[MATE_B] = mate(2, 3);
  raw[OPP_A] = foe(2, 4);
  raw[OPP_B] = foe(0, 5);
  raw[REF] = makeKit("referee", { look: 0, era });
  raw[EXTRA_A] = mate(2, 1);
  raw[EXTRA_B] = mate(0, 2);
  raw[BALLKID] = ballKidKit(era);
  kits.list = raw.map((k) => litKit(k, light));
}

// ---------------------------------------------------------------------------
// Spots, read once
// ---------------------------------------------------------------------------

/**
 * The sprite spots the scene needs every frame, read from `~/art/characters` on first use
 * (`castSpots()`).
 */
export interface CastSpots {
  /** The ball's centre while he juggles: x and y offsets, adult then youth, 8 frames each. */
  readonly JUGGLE_X: Int8Array;
  readonly JUGGLE_Y: Int8Array;
  /** The ball at rest in front of him for the kick, facing right (and its x facing left). */
  readonly KICK_DX: number;
  readonly KICK_DY: number;
  readonly KICK_LEFT_DX: number;
  /** Between his hands in the lift, frames 0 and 1: adult x, y then youth x, y. */
  readonly LIFT: Int8Array;
  /**
   * The bicycle kick's ball while he has it, frames 0 (on his chest, his back to the goal)
   * to 4 (the strike, over his head): adult x then youth x, and the same for y.
   */
  readonly BIKE_X: Int8Array;
  readonly BIKE_Y: Int8Array;
  /** The keeper's gloves, facing left as he always does. */
  readonly HOLD: { x: number; y: number };
  readonly LEAP_TOP: { x: number; y: number };
  readonly SMOTHER: { x: number; y: number };
  /** Stranded off his line, reaching up and back for the chip. */
  readonly STRANDED_UP: { x: number; y: number };
}

function readSpots(): CastSpots {
  const at = (x: number, y: number) => ({ x, y });
  const JUGGLE_X = new Int8Array(16);
  const JUGGLE_Y = new Int8Array(16);
  for (let i = 0; i < 16; i++) {
    const s = ballSpot("juggle", i & 7, { youth: i >= 8 });
    JUGGLE_X[i] = s?.x ?? 8;
    JUGGLE_Y[i] = s?.y ?? -14;
  }
  const KICK = ballSpot("kick", 0) ?? at(14, -4);
  const KICK_LEFT = ballSpot("kick", 0, { flipX: true }) ?? at(-14, -4);
  const LIFT = new Int8Array(8);
  for (let f = 0; f < 2; f++) {
    const a = handsSpot("lift", f) ?? at(0, -34);
    const y = handsSpot("lift", f, { youth: true }) ?? at(0, -26);
    LIFT[f * 2] = a.x;
    LIFT[f * 2 + 1] = a.y;
    LIFT[4 + f * 2] = y.x;
    LIFT[4 + f * 2 + 1] = y.y;
  }
  const BIKE_X = new Int8Array(10);
  const BIKE_Y = new Int8Array(10);
  for (let f = 0; f < 5; f++) {
    const a = ballSpot("bicycle", f) ?? at(14, -46);
    const y = ballSpot("bicycle", f, { youth: true }) ?? at(8, -36);
    BIKE_X[f] = a.x;
    BIKE_Y[f] = a.y;
    BIKE_X[5 + f] = y.x;
    BIKE_Y[5 + f] = y.y;
  }
  const hands = (anim: KeeperAnim, f: number): { x: number; y: number } =>
    keeperHands(anim, f, { flipX: true }) ?? at(-8, -18);
  return {
    JUGGLE_X,
    JUGGLE_Y,
    KICK_DX: KICK.x,
    KICK_DY: KICK.y,
    KICK_LEFT_DX: KICK_LEFT.x,
    LIFT,
    BIKE_X,
    BIKE_Y,
    HOLD: hands("hold", 0),
    LEAP_TOP: hands("leap", 1),
    SMOTHER: hands("smother", 1),
    STRANDED_UP: hands("stranded", 1),
  };
}

let spots: CastSpots | null = null;

/** The cast's spots, read on first use. */
export function castSpots(): CastSpots {
  return (spots ??= readSpots());
}
