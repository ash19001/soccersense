/**
 * The people of the career scene: the footballer (adult and youth) and the goalkeeper.
 *
 * Everyone faces right; `flipX` mirrors them inside their cell. `(x, y)` is the ground
 * point under the standing feet: the soles' outline is row y - 1 and the cell's left edge
 * is x - floor(cellW / 2). Spots (`ballSpot`, `handsSpot`, `keeperHands`) are offsets
 * from (x, y), and a flipped spot is `-dx - 1`, the exact mirror of the pixels.
 */

import { drawSprite, type Sprite, type Surface } from "~/pixel";
import { KEEPER, PLAYER, YOUTH } from "../layout";
import * as ADULT from "./adult";
import * as ADULT_SHOTS from "./adult-shots";
import { figure } from "./figure";
import * as KEEP from "./keeper";
import { kitColors, type Kit } from "./kit";
import * as KID from "./youth";
import * as KID_SHOTS from "./youth-shots";

export type PlayerAnim =
  | "idle"
  | "run"
  | "kick"
  | "juggle"
  | "celebrate"
  | "dejected"
  | "lift"
  | "shrug"
  | "slide"
  | ShotAnim;

/**
 * The shots, all one-shots. One per answer grade: "kick" (the miss: the scene sends the
 * ball wide), "tapin" (tap in), "toepoke" (toe poke), "trivela", "finesse" (golazo) and
 * "bicycle" (worldie). "power" (a rocket) and "chip" (a lob) are spares, for variety.
 */
export type ShotAnim =
  | "kick"
  | "tapin"
  | "toepoke"
  | "trivela"
  | "chip"
  | "power"
  | "finesse"
  | "bicycle";

export interface AnimInfo {
  readonly frames: number;
  readonly fps: number;
  readonly loop: boolean;
}

export const PLAYER_ANIMS: Readonly<Record<PlayerAnim, AnimInfo>> = {
  idle: { frames: 2, fps: 2, loop: true },
  run: { frames: 4, fps: 10, loop: true },
  kick: { frames: 5, fps: 10, loop: false },
  juggle: { frames: 8, fps: 7, loop: true },
  celebrate: { frames: 3, fps: 6, loop: true },
  dejected: { frames: 2, fps: 1.5, loop: true },
  lift: { frames: 2, fps: 3, loop: true },
  shrug: { frames: 2, fps: 2.5, loop: false },
  slide: { frames: 2, fps: 4, loop: true },
  tapin: { frames: 4, fps: 8, loop: false },
  toepoke: { frames: 5, fps: 10, loop: false },
  trivela: { frames: 6, fps: 10, loop: false },
  chip: { frames: 5, fps: 10, loop: false },
  power: { frames: 6, fps: 10, loop: false },
  finesse: { frames: 5, fps: 10, loop: false },
  bicycle: { frames: 8, fps: 10, loop: false },
};

export const PLAYER_ANIM_NAMES = Object.keys(PLAYER_ANIMS) as PlayerAnim[];

/** The frame of "kick" where the boot meets the ball. */
export const KICK_STRIKE_FRAME = 2;

/** The frame of each shot where his boot meets the ball (adult and youth alike). */
export const STRIKE_FRAME: Readonly<Record<ShotAnim, number>> = {
  kick: KICK_STRIKE_FRAME,
  tapin: 1,
  toepoke: 1,
  trivela: 2,
  chip: 2,
  power: 2,
  finesse: 2,
  bicycle: 4,
};

export const SHOT_ANIMS: readonly ShotAnim[] = [
  "kick",
  "tapin",
  "toepoke",
  "trivela",
  "chip",
  "power",
  "finesse",
  "bicycle",
];

/** A sprite cell. Anchor rule for every cell: left edge x - cellW / 2, soles outline on y - 1. */
export interface Cell {
  readonly cellW: number;
  readonly cellH: number;
}

/** The bicycle kick needs room over his head: anchor column 12 (youth 10). */
export const BICYCLE_CELL: Cell = { cellW: 24, cellH: 28 };
export const BICYCLE_YOUTH_CELL: Cell = { cellW: 20, cellH: 22 };
/** The keeper's sprawl is a full-length dive: anchor column 12. */
export const SPRAWL_CELL: Cell = { cellW: 24, cellH: 20 };

export type KeeperAnim =
  "ready" | "leap" | "smother" | "hold" | "beaten" | "stranded" | "sprawl";

export const KEEPER_ANIMS: Readonly<Record<KeeperAnim, AnimInfo>> = {
  ready: { frames: 2, fps: 2, loop: true },
  leap: { frames: 3, fps: 8, loop: false },
  smother: { frames: 2, fps: 8, loop: false },
  hold: { frames: 1, fps: 1, loop: true },
  beaten: { frames: 1, fps: 1, loop: true },
  stranded: { frames: 3, fps: 6, loop: false },
  sprawl: { frames: 3, fps: 8, loop: false },
};

export const KEEPER_ANIM_NAMES = Object.keys(KEEPER_ANIMS) as KeeperAnim[];

type Spot = { x: number; y: number } | null;
type SpotTable<A extends string> = Partial<Record<A, readonly Spot[]>>;

const ART_KEY: Record<PlayerAnim, string> = {
  idle: "IDLE",
  run: "RUN",
  kick: "KICK",
  juggle: "JUGGLE",
  celebrate: "CELEBRATE",
  dejected: "DEJECTED",
  lift: "LIFT",
  shrug: "SHRUG",
  slide: "SLIDE",
  tapin: "TAPIN",
  toepoke: "TOEPOKE",
  trivela: "TRIVELA",
  chip: "CHIP",
  power: "POWER",
  finesse: "FINESSE",
  bicycle: "BICYCLE",
};

/** The cell an animation is drawn in (most share the layout's `PLAYER` / `YOUTH` cell). */
export function playerCell(anim: PlayerAnim, youth = false): Cell {
  if (anim === "bicycle") return youth ? BICYCLE_YOUTH_CELL : BICYCLE_CELL;
  return youth ? YOUTH : PLAYER;
}

export function keeperCell(anim: KeeperAnim): Cell {
  return anim === "sprawl" ? SPRAWL_CELL : KEEPER;
}

const ADULT_ART: Record<string, unknown> = { ...ADULT, ...ADULT_SHOTS };
const KID_ART: Record<string, unknown> = { ...KID, ...KID_SHOTS };

const artOf = (set: Record<string, unknown>, prefix: string, key: string) => {
  const v = set[`${prefix}_${key}`];
  if (typeof v !== "string") throw new Error(`people: no art ${prefix}_${key}`);
  return v;
};

// Built once per animation, on first use.
const adultSprites: Partial<Record<PlayerAnim, Sprite>> = {};
const youthSprites: Partial<Record<PlayerAnim, Sprite>> = {};
const keeperSprites: Partial<Record<KeeperAnim, Sprite>> = {};

function playerSpriteOf(anim: PlayerAnim, youth: boolean): Sprite {
  const cache = youth ? youthSprites : adultSprites;
  const cell = playerCell(anim, youth);
  return (cache[anim] ??= figure(
    youth
      ? artOf(KID_ART, "YOUTH", ART_KEY[anim])
      : artOf(ADULT_ART, "ADULT", ART_KEY[anim]),
    cell.cellW,
    cell.cellH,
    `${youth ? "youth" : "adult"} ${anim}`,
  ));
}

function keeperSpriteOf(anim: KeeperAnim): Sprite {
  const cell = keeperCell(anim);
  return (keeperSprites[anim] ??= figure(
    artOf(KEEP, "KEEPER", anim.toUpperCase()),
    cell.cellW,
    cell.cellH,
    `keeper ${anim}`,
  ));
}

/** The sprite behind an animation (for tests and sheets). */
export function playerSprite(anim: PlayerAnim, youth = false): Sprite {
  return playerSpriteOf(anim, youth);
}

export function keeperSprite(anim: KeeperAnim): Sprite {
  return keeperSpriteOf(anim);
}

function frameIndex(frame: number, count: number, loop: boolean): number {
  const f = Math.floor(frame);
  if (!Number.isFinite(f)) return 0;
  if (loop) return ((f % count) + count) % count;
  return Math.min(Math.max(f, 0), count - 1);
}

const DRAW = { flipX: false, anchor: "bottom-center" as const };

/**
 * Draw the footballer (or anyone in his build: team-mates, opponents, the referee, a child
 * in goal). `frame` is a running counter: looping animations wrap, the others hold their
 * last frame. Youth is the child sprite of tiers 0 and 1.
 */
export function drawPlayer(
  s: Surface,
  anim: PlayerAnim,
  frame: number,
  x: number,
  y: number,
  kit: Kit,
  opts?: { flipX?: boolean; youth?: boolean },
): void {
  const info = PLAYER_ANIMS[anim];
  const sp = playerSpriteOf(anim, opts?.youth === true);
  DRAW.flipX = opts?.flipX === true;
  drawSprite(
    s,
    sp,
    frameIndex(frame, info.frames, info.loop),
    x,
    y,
    kitColors(kit),
    DRAW,
  );
}

/** Draw the goalkeeper. Same rules as `drawPlayer`; adult build, gloves on. */
export function drawKeeper(
  s: Surface,
  anim: KeeperAnim,
  frame: number,
  x: number,
  y: number,
  kit: Kit,
  opts?: { flipX?: boolean },
): void {
  const info = KEEPER_ANIMS[anim];
  DRAW.flipX = opts?.flipX === true;
  drawSprite(
    s,
    keeperSpriteOf(anim),
    frameIndex(frame, info.frames, info.loop),
    x,
    y,
    kitColors(kit),
    DRAW,
  );
}

// ---------------------------------------------------------------------------
// Spots
// ---------------------------------------------------------------------------

const p = (x: number, y: number): Spot => ({ x, y });

/** Where the ball's centre is, frame by frame, as an offset from (x, y). */
const ADULT_BALL: SpotTable<PlayerAnim> = {
  kick: [p(7, -2), p(7, -2), p(7, -2), null, null],
  juggle: [
    p(4, -7),
    p(6, -12),
    p(4, -11),
    p(6, -16),
    p(4, -7),
    p(3, -22),
    p(1, -20),
    p(6, -12),
  ],
  tapin: [p(7, -2), p(7, -2), null, null],
  toepoke: [p(7, -2), p(7, -2), null, null, null],
  trivela: [p(7, -2), p(7, -2), p(7, -2), null, null, null],
  chip: [p(7, -2), p(7, -2), p(7, -2), null, null],
  power: [p(7, -2), p(7, -2), p(7, -2), null, null, null],
  finesse: [p(7, -2), p(7, -2), p(7, -2), null, null],
  bicycle: [
    p(-5, -10),
    p(-3, -22),
    p(1, -26),
    p(4, -25),
    p(7, -23),
    null,
    null,
    null,
  ],
};

const YOUTH_BALL: SpotTable<PlayerAnim> = {
  kick: [p(7, -2), p(7, -2), p(7, -2), null, null],
  juggle: [
    p(4, -6),
    p(5, -10),
    p(3, -9),
    p(5, -13),
    p(4, -6),
    p(3, -18),
    p(1, -17),
    p(5, -9),
  ],
  tapin: [p(7, -2), p(7, -2), null, null],
  toepoke: [p(7, -2), p(7, -2), null, null, null],
  trivela: [p(7, -2), p(7, -2), p(7, -2), null, null, null],
  chip: [p(7, -2), p(7, -2), p(7, -2), null, null],
  power: [p(7, -2), p(7, -2), p(7, -2), null, null, null],
  finesse: [p(7, -2), p(7, -2), p(7, -2), null, null],
  bicycle: [
    p(-5, -7),
    p(-3, -17),
    p(0, -20),
    p(3, -19),
    p(4, -18),
    null,
    null,
    null,
  ],
};

const ADULT_HANDS: SpotTable<PlayerAnim> = { lift: [p(0, -17), p(0, -18)] };
const YOUTH_HANDS: SpotTable<PlayerAnim> = { lift: [p(0, -13), p(0, -14)] };

const KEEPER_HANDS: SpotTable<KeeperAnim> = KEEP.KEEPER_GLOVES;

function spot<A extends string>(
  table: SpotTable<A>,
  info: AnimInfo,
  anim: A,
  frame: number,
  flipX: boolean | undefined,
): Spot {
  const list = table[anim];
  if (list === undefined) return null;
  const s = list[frameIndex(frame, info.frames, info.loop)] ?? null;
  if (s === null) return null;
  return flipX === true ? { x: -s.x - 1, y: s.y } : { x: s.x, y: s.y };
}

/**
 * The ball's centre as an offset from (x, y) while he has it: the kick's first three
 * frames (the ball at rest in front of him, struck on `KICK_STRIKE_FRAME`) and every
 * juggle frame (touches on frames 0, 2, 4 and 6 — foot, knee, foot, head — and the top
 * of each hop between). Null when he is not touching it.
 */
export function ballSpot(
  anim: PlayerAnim,
  frame: number,
  opts?: { flipX?: boolean; youth?: boolean },
): Spot {
  const table = opts?.youth === true ? YOUTH_BALL : ADULT_BALL;
  return spot(table, PLAYER_ANIMS[anim], anim, frame, opts?.flipX);
}

/**
 * For "lift": the point between his hands, where the trophy stands:
 * `drawTrophy(s, x + h.x, y + h.y, light)`. Null for every other animation.
 */
export function handsSpot(
  anim: PlayerAnim,
  frame: number,
  opts?: { flipX?: boolean; youth?: boolean },
): Spot {
  const table = opts?.youth === true ? YOUTH_HANDS : ADULT_HANDS;
  return spot(table, PLAYER_ANIMS[anim], anim, frame, opts?.flipX);
}

/** Where the keeper's gloves are (their middle), for saves. Null when they hold nothing. */
export function keeperHands(
  anim: KeeperAnim,
  frame: number,
  opts?: { flipX?: boolean },
): Spot {
  return spot(KEEPER_HANDS, KEEPER_ANIMS[anim], anim, frame, opts?.flipX);
}
