/**
 * The people of the career scene: the footballer (adult and youth) and the goalkeeper.
 *
 * Everyone faces right; `flipX` mirrors them inside their cell. `(x, y)` is the ground
 * point under the standing feet: the soles' outline is row y - 1 and the cell's left edge
 * is x - cellW / 2 (the adult's cell is 32 x 40, the bicycle's 48 x 56). Spots
 * (`ballSpot`, `handsSpot`, `keeperHands`) are offsets from (x, y); what a spot marks is
 * even-sized (the 6 x 6 ball, the 18-wide trophy, centred on it as `drawSprite` centres
 * them), so a flipped spot is `-dx`, the exact mirror of the pixels around it.
 *
 * The art is in `adult.ts` (the moves), `adult-shots.ts` (the shots), `youth.ts`,
 * `youth-shots.ts` and `keeper.ts`, drawn with `LEGEND` and coloured by `kitColors`.
 */

import { drawSprite, type Sprite, type Surface } from "~/pixel";
import type { Era } from "../era";
import * as LAYOUT from "../layout";
import { eraFrames } from "./era-frames";
import { ADULT } from "./adult";
import { ADULT_SHOTS, ADULT_SHOT_BALL } from "./adult-shots";
import { type ArtRecord, artText, figure } from "./figure";
import { KEEPER, KEEPER_GLOVES } from "./keeper";
import { kitColors, type Kit } from "./kit";
import { YOUTH } from "./youth";
import { YOUTH_SHOTS, YOUTH_SHOT_BALL } from "./youth-shots";

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

/**
 * The bicycle kick needs room over his head: anchor column 24 (youth 20), soles' outline
 * row 55 (youth 43).
 */
export const BICYCLE_CELL: Cell = { cellW: 48, cellH: 56 };
export const BICYCLE_YOUTH_CELL: Cell = { cellW: 40, cellH: 44 };
/** The keeper's sprawl is a full-length dive: anchor column 24, soles' outline row 39. */
export const SPRAWL_CELL: Cell = { cellW: 48, cellH: 40 };

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

/** An offset from (x, y), facing right; null where there is nothing to point at. */
export type Spot = { x: number; y: number } | null;
/** Spots by animation, one per frame. */
export type SpotTable<A extends string> = Partial<Record<A, readonly Spot[]>>;

/** The cell an animation is drawn in (most share the layout's `PLAYER` / `YOUTH` cell). */
export function playerCell(anim: PlayerAnim, youth = false): Cell {
  if (anim === "bicycle") return youth ? BICYCLE_YOUTH_CELL : BICYCLE_CELL;
  return youth ? LAYOUT.YOUTH : LAYOUT.PLAYER;
}

export function keeperCell(anim: KeeperAnim): Cell {
  return anim === "sprawl" ? SPRAWL_CELL : LAYOUT.KEEPER;
}

// The art: the moves and the shots, adult and youth.
const ADULT_ART: ArtRecord<PlayerAnim> = { ...ADULT, ...ADULT_SHOTS };
const YOUTH_ART: ArtRecord<PlayerAnim> = { ...YOUTH, ...YOUTH_SHOTS };

// The sprites, each built on first use, one set per era (the era's layer over the same art:
// era-frames.ts).
interface SpriteSet {
  adult: Partial<Record<PlayerAnim, Sprite>>;
  youth: Partial<Record<PlayerAnim, Sprite>>;
  keeper: Partial<Record<KeeperAnim, Sprite>>;
}
const sprites: Record<Era, SpriteSet> = {
  today: { adult: {}, youth: {}, keeper: {} },
  retro: { adult: {}, youth: {}, keeper: {} },
  nextgen: { adult: {}, youth: {}, keeper: {} },
};

/** The sprite behind an animation (for tests and sheets), in an era (today by default). */
export function playerSprite(
  anim: PlayerAnim,
  youth = false,
  era: Era = "today",
): Sprite {
  const set = sprites[era];
  const cache = youth ? set.youth : set.adult;
  let sp = cache[anim];
  if (sp === undefined) {
    const who = youth ? "youth" : "adult";
    const art = (youth ? YOUTH_ART : ADULT_ART)[anim];
    if (art === undefined) throw new Error(`people: no art for ${who} ${anim}`);
    const cell = playerCell(anim, youth);
    const text = eraFrames(era, who, anim, artText(art));
    sp = figure(text, cell.cellW, cell.cellH, `${who} ${anim}`);
    cache[anim] = sp;
  }
  return sp;
}

export function keeperSprite(anim: KeeperAnim, era: Era = "today"): Sprite {
  const set = sprites[era];
  let sp = set.keeper[anim];
  if (sp === undefined) {
    const art = KEEPER[anim];
    if (art === undefined) throw new Error(`people: no art for keeper ${anim}`);
    const cell = keeperCell(anim);
    const text = eraFrames(era, "keeper", anim, artText(art));
    sp = figure(text, cell.cellW, cell.cellH, `keeper ${anim}`);
    set.keeper[anim] = sp;
  }
  return sp;
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
  const sp = playerSprite(anim, opts?.youth === true, kit.era ?? "today");
  DRAW.flipX = opts?.flipX === true;
  const f = frameIndex(frame, info.frames, info.loop);
  drawSprite(s, sp, f, x, y, kitColors(kit), DRAW);
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
  const sp = keeperSprite(anim, kit.era ?? "today");
  DRAW.flipX = opts?.flipX === true;
  const f = frameIndex(frame, info.frames, info.loop);
  drawSprite(s, sp, f, x, y, kitColors(kit), DRAW);
}

// ---------------------------------------------------------------------------
// Spots
// ---------------------------------------------------------------------------

const p = (x: number, y: number): Spot => ({ x, y });

// The spots, measured on the art (the adult's 32 x 40 cell has its anchor at column 16: a
// spot's x is its column - 16, its y its row - 40; the youth's 28 x 32, column 14). The
// ball's spot is the centre of the 6 x 6 ball drawn with anchor "center": it covers
// columns dx - 3 to dx + 2 and rows dy - 3 to dy + 2, so (14, -4) is a ball resting on the
// grass (its bottom row on the soles' row, y - 2). On a touch the ring's bottom row lies on
// the top row of what he touches it with. The shots' spots are drawn with the shots
// (adult-shots.ts, youth-shots.ts; .snaps/detail2/A2-spots.md and B2-spots.md).

/** At rest on the grass in front of him, beside the planted far foot (the scene's `KICK_DX`). */
const REST = p(14, -4);

/** Where the adult's ball's centre is, frame by frame, as an offset from (x, y). */
const ADULT_BALL: SpotTable<PlayerAnim> = {
  ...ADULT_SHOT_BALL,
  // at rest in front of him, beside the planted far foot; the near toe meets it on 2
  kick: [REST, REST, REST, null, null],
  // on the near boot (0, 4), the knee (2), the forehead (6), and the top of each hop
  juggle: [
    p(8, -13),
    p(12, -24),
    p(8, -18),
    p(12, -32),
    p(8, -13),
    p(6, -44),
    p(2, -39),
    p(12, -24),
  ],
};

/** In the lift the trophy's foot sits on his hands' top row (drawTrophy is bottom-centre). */
const ADULT_HANDS: SpotTable<PlayerAnim> = {
  lift: [p(0, -34), p(0, -36)],
};

/** The youth's ball's centre, frame by frame. */
export const YOUTH_BALL: SpotTable<PlayerAnim> = {
  ...YOUTH_SHOT_BALL,
  // at rest beside the planted far foot; the near boot meets it on the strike (2)
  kick: [REST, REST, REST, null, null],
  // on the near boot (0, 4), the knee (2), the crown (6), and the top of each hop between
  juggle: [
    p(9, -9),
    p(11, -19),
    p(8, -13),
    p(11, -23),
    p(9, -9),
    p(5, -35),
    p(2, -31),
    p(11, -19),
  ],
};

/**
 * Between the youth's hands in the lift: the foot of what he holds (drawTrophy is
 * bottom-centre) on his fists' top row, between them.
 */
export const YOUTH_HANDS: SpotTable<PlayerAnim> = {
  lift: [p(-1, -28), p(-1, -29)],
};

/** One spot of a table: a copy, mirrored to `-dx` when flipped. */
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
  return flipX === true ? { x: -s.x, y: s.y } : { x: s.x, y: s.y };
}

/**
 * The ball's centre as an offset from (x, y) while he has it: the kick's first three
 * frames (the ball at rest in front of him, struck on `KICK_STRIKE_FRAME`), every juggle
 * frame (touches on frames 0, 2, 4 and 6 — foot, knee, foot, head — and the top of each
 * hop between) and every shot up to its strike. Null when he is not touching it.
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
  return spot(KEEPER_GLOVES, KEEPER_ANIMS[anim], anim, frame, opts?.flipX);
}
