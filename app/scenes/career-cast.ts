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
export const CAST = 9;

/** One person's pose this frame (reused, never allocated per frame). */
export interface Pose {
  on: boolean;
  /** "keeper" poses use the keeper's own animations. */
  keeper: boolean;
  anim: PlayerAnim;
  kanim: KeeperAnim;
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
  const k = L.stageScale;
  const at = (off: number): number => L.cx + Math.round(off * k);
  const gy = L.groundY;
  h.x[HERO] = L.heroX;
  h.y[HERO] = gy;
  h.x[KEEPER] = L.keeperX;
  h.y[KEEPER] = gy;
  h.x[MATE_A] = at(-52);
  h.y[MATE_A] = gy + 4;
  h.x[MATE_B] = at(-6);
  h.y[MATE_B] = gy - 5;
  h.x[OPP_A] = at(10);
  h.y[OPP_A] = gy + 5;
  h.x[OPP_B] = at(24);
  h.y[OPP_B] = gy - 4;
  h.x[REF] = at(-40);
  h.y[REF] = gy - 6;
  h.x[EXTRA_A] = L.heroX - Math.round(26 * k);
  h.y[EXTRA_A] = gy + 4;
  h.x[EXTRA_B] = L.heroX + Math.round(24 * k);
  h.y[EXTRA_B] = gy + 3;
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
    team ? makeKit(team, { look }) : makeKit("casual", { look, variant });
  const foe = (look: 0 | 1 | 2, variant: number): Kit =>
    park ? makeKit("casual", { look, variant }) : makeKit("rival", { look });
  const raw: Kit[] = [];
  raw[HERO] = makeKit(heroKit, { look: HERO_LOOK, variant: 1 });
  raw[KEEPER] = makeKit("keeper", { look: 0, variant: 2 });
  raw[MATE_A] = mate(0, 0);
  raw[MATE_B] = mate(2, 3);
  raw[OPP_A] = foe(2, 4);
  raw[OPP_B] = foe(0, 5);
  raw[REF] = makeKit("referee", { look: 0 });
  raw[EXTRA_A] = mate(2, 1);
  raw[EXTRA_B] = mate(0, 2);
  kits.list = raw.map((k) => litKit(k, light));
}

// ---------------------------------------------------------------------------
// Spots, read once
// ---------------------------------------------------------------------------

/** The ball's centre while he juggles: x and y offsets, adult then youth, 8 frames each. */
export const JUGGLE_X = new Int8Array(16);
export const JUGGLE_Y = new Int8Array(16);
for (let i = 0; i < 16; i++) {
  const s = ballSpot("juggle", i & 7, { youth: i >= 8 });
  JUGGLE_X[i] = s?.x ?? 4;
  JUGGLE_Y[i] = s?.y ?? -7;
}

/** The ball at rest in front of him for the kick, facing right. */
const KICK = ballSpot("kick", 0) ?? { x: 7, y: -2 };
export const KICK_DX = KICK.x;
export const KICK_DY = KICK.y;
const KICK_LEFT = ballSpot("kick", 0, { flipX: true }) ?? { x: -8, y: -2 };
export const KICK_LEFT_DX = KICK_LEFT.x;

/** Between his hands in the lift, frames 0 and 1: adult x, y then youth x, y. */
export const LIFT = new Int8Array(8);
for (let f = 0; f < 2; f++) {
  const a = handsSpot("lift", f) ?? { x: 0, y: -17 };
  const y = handsSpot("lift", f, { youth: true }) ?? { x: 0, y: -13 };
  LIFT[f * 2] = a.x;
  LIFT[f * 2 + 1] = a.y;
  LIFT[4 + f * 2] = y.x;
  LIFT[4 + f * 2 + 1] = y.y;
}

/** The keeper's gloves, facing left as he always does. */
const hands = (anim: KeeperAnim, f: number): { x: number; y: number } =>
  keeperHands(anim, f, { flipX: true }) ?? { x: -4, y: -9 };
export const HOLD = hands("hold", 0);
export const LEAP_TOP = hands("leap", 1);
export const SMOTHER = hands("smother", 1);
