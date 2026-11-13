/**
 * The people of the career ground who are not the cast (docs/ART_BIBLE.md section 5): the
 * crowd in the stands (6 x 8 fans), the people standing to watch at the small grounds, the
 * people seen from behind on the near side, the near crowd, the steward and the dog.
 *
 * The crowd is painted at rest into the cached layer. Each frame only the fans that are
 * doing something (a bob, a jump, hands on heads, a scarf held up) are painted again over
 * it, so a still crowd costs nothing and a roaring one a few thousand pixels.
 *
 * Every sprite is parsed on first use (never at module load) and drawn with colours from a
 * scratch array, so drawing allocates nothing. Anchors:
 *
 * - fan: top-left of a 6 x 8 box at (x, y), the top of the head on row y;
 * - watcher: `x` is the left of the two middle columns, the box is `x - 4 .. x + 5`, feet on
 *   row `y - 1`; 28 tall, a child 22;
 * - back: left edge `x`, bottom row `y + 1`;
 * - near-crowd back: top-left (x, y) of a 10 x 12 person, on a 12 x 10 grid;
 * - steward: like a watcher, 10 x 30;
 * - dog: like a watcher, 18 x 12 (the box `x - 8 .. x + 9`).
 */

import { P } from "~/art/palette";
import {
  TRANSPARENT,
  drawSprite,
  shade,
  sprite,
  type Color,
  type Sprite,
  type Surface,
} from "~/pixel";
import { bandCrest, drawFanBand, drawFanCrest } from "./nextgen-people";
import type { CrowdMood } from "./types";

// ---------------------------------------------------------------------------
// Reactions
// ---------------------------------------------------------------------------

/** What one person is doing this frame. */
export const REST = 0;
export const BOB = 1; // up 2 px
export const JUMP = 2; // up 2 px, arms up
export const HANDS = 3; // hands on head
export const SCARF = 4; // up 2 px, a scarf held over the head
export const ARMS = 5; // arms up, feet down
export type Pose = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * The pose of one person, from the mood, the seconds since it was set, the scene time,
 * whether they want the hero to score, their own rhythm (`period` 9 to 22 half-seconds,
 * `offset`), and whether they have a scarf.
 */
export function poseFor(
  mood: CrowdMood,
  since: number,
  t: number,
  withHero: boolean,
  period: number,
  offset: number,
  scarf: boolean,
): Pose {
  // The other side's fans feel the opposite.
  let m = mood;
  if (!withHero) {
    if (m === "cheer" || m === "roar") m = "groan";
    else if (m === "groan") m = "cheer";
  }
  // Nobody reacts on the same frame: a ripple of a fifth of a second.
  const s = since - (offset % 5) * 0.05;
  const tick2 = Math.floor(t * 2);
  const tick8 = Math.floor(t * 8);
  const idleBob = (tick2 + offset) % period === 0 ? BOB : REST;
  const excited =
    (tick2 + offset) % Math.max(2, period >> 2) === 0 ? BOB : REST;
  if (s < 0) return idleBob;
  switch (m) {
    case "idle":
      return idleBob;
    case "hush":
      return REST;
    case "ooh":
      if (s < 1.9) return offset % 10 < 7 ? HANDS : BOB;
      return idleBob;
    case "groan":
      if (s < 2.2) return offset % 2 === 0 ? HANDS : REST;
      return idleBob;
    case "cheer":
      if (s < 2.6 + (offset % 7) * 0.12) {
        return ((tick8 + offset) >> 1) % 2 === 0 ? JUMP : ARMS;
      }
      if (s < 6) return scarf ? SCARF : excited;
      return idleBob;
    case "roar":
      if (s < 4.5 + (offset % 7) * 0.15) {
        if (scarf) return SCARF;
        return ((tick8 + offset) >> 1) % 2 === 0 ? JUMP : ARMS;
      }
      if (s < 9) return scarf ? SCARF : excited;
      return idleBob;
    case "party":
      if (scarf) return (tick2 + offset) % 4 === 0 ? ARMS : SCARF;
      return ((tick8 + offset) >> 1) % 3 === 0 ? ARMS : JUMP;
  }
}

/** Raised: a bob, a jump and a scarf held up lift the whole person 2 px. */
function lifted(pose: number): boolean {
  return pose === BOB || pose === JUMP || pose === SCARF;
}

function lazy(make: () => Sprite): () => Sprite {
  let made: Sprite | null = null;
  return () => (made ??= make());
}

/** Colours handed to `drawSprite`, refilled for every person (drawing allocates nothing). */
const ink: Color[] = [];

function fill(...colors: Color[]): Color[] {
  ink.length = 0;
  for (let i = 0; i < colors.length; i++) ink.push(colors[i]);
  return ink;
}

// ---------------------------------------------------------------------------
// The crowd: 6 x 8 fans
// ---------------------------------------------------------------------------

/*
 * A crowd fan is 6 x 8 px, repeated every 8 px across and down (`FAN` in `~/art/layout`).
 * The fan's box is `x .. x + 5`, `y .. y + 7` (the top of the head on row `y`). The head is
 * the middle four columns (`x + 1 .. x + 4`); the anchor columns are `x + 2` and `x + 3`.
 */

/**
 * One frame per pose (REST, BOB, JUMP, HANDS, SCARF, ARMS), 10 x 12: the fan's 6 x 8 box
 * is columns 2..7 and rows 4..11, so the frame's top left is (x - 2, y - 4). Raised arms
 * reach 4 px over the head and a scarf held up is 2 px wider each side.
 *
 * Every cell of the box that is not the fan is `S`, the seat: a moving fan is painted over
 * the layer's resting one, so it must cover all of it.
 *
 * h hair lit, H hair, F skin, f skin in shade, C body lit, B body, D body in shade,
 * A an arm (the body a little darker), L the lap, N the scarf round the neck in its
 * second colour (or a collar), n a collar, O the scarf's first colour (or the body), M its
 * second colour (or the body), S the seat.
 *
 * A scarf is worn round the neck (a striped band across the collar) with one end hanging
 * down the right of the chest, so it never reads as a tie on a pale shirt. Raised arms
 * (JUMP, ARMS) go up in a V and hands on the head (HANDS) put the elbows out and up, with
 * the seat showing between arm and head, so a packed block of them still reads as people.
 */
const FAN_LEGEND = "hHFfCBDALNnOMS";

const FAN_ART = `
    ..........
    ..........
    ..........
    ..........
    ..ShHHHS..
    ..SFFFfS..
    ..SSFfSS..
    ..CONNOD..
    ..CBBBMD..
    ..ABBBOD..
    ..ABBBBD..
    ..LLLLLL..

    ..........
    ..........
    ...hHHH...
    ...FFFf...
    ..SSFfSS..
    ..CONNOD..
    ..CBBBMD..
    ..ABBBOD..
    ..ABBBBD..
    ..LLLLLL..
    ..SSSSSS..
    ..SSSSSS..

    .F......f.
    .A......D.
    .AShHHHSD.
    .ASFFFfSD.
    ..ASFfSD..
    ..CONNOD..
    ..CBBBMD..
    ..CBBBOD..
    ..CBBBBD..
    ..LLLLLL..
    ..SSSSSS..
    ..SSSSSS..

    ..........
    ..........
    ..........
    .A......D.
    .AAFHHfDD.
    .ASFFFfSD.
    ..ASFfSD..
    ..CONNOD..
    ..CBBBMD..
    ..CBBBOD..
    ..CBBBBD..
    ..LLLLLL..

    OOMMOOMMOO
    OOMMOOMMOO
    MF.hHHH.fM
    .A.FFFf.D.
    .ASSFfSSD.
    ..ABnnBD..
    ..CBBBBD..
    ..CBBBBD..
    ..CBBBBD..
    ..LLLLLL..
    ..SSSSSS..
    ..SSSSSS..

    ..........
    .F......f.
    .F......f.
    .A......D.
    .AShHHHSD.
    .ASFFFfSD.
    ..ASFfSD..
    ..CONNOD..
    ..CBBBMD..
    ..CBBBOD..
    ..CBBBBD..
    ..LLLLLL..
    `;

const fanArt = lazy(() => sprite(FAN_ART, FAN_LEGEND));

/**
 * RETRO's fans (.snaps/era-art/THEME.md) wear what the terraces wore: `hat` 0 bare-headed,
 * 1 a flat cap (its peak out over the brow on the left), 2 a bowler (its brim either side of
 * the forehead), the hat in the fan's hair colour; `+ RATTLE` puts a wooden rattle (`R`, the
 * last legend letter) in the raised hand of the cheering poses. The same frames as today's,
 * rewritten: a hatted fan covers the same cells as a bare one but for a brim or a peak.
 */
export const HAT_NONE = 0;
export const HAT_CAP = 1;
export const HAT_BOWLER = 2;
export const RATTLE = 4;
const RETRO_FAN_LEGEND = `${FAN_LEGEND}R`;

function hatted(art: string, look: number): string {
  const hat = look & 3;
  const rattle = (look & RATTLE) !== 0;
  return art
    .split(/\n\s*\n/)
    .map((block, frame) => {
      const rows = block
        .split("\n")
        .map((r) => r.trim())
        .filter((r) => r !== "")
        .map((r) => Array.from(r));
      const hairRow = rows.findIndex((r) => r.includes("h") || r.includes("H"));
      const face = rows[hairRow + 1];
      if (hairRow >= 0 && face !== undefined) {
        const f0 = face.indexOf("F");
        const side = (c: string | undefined): boolean => c === "S" || c === ".";
        if (hat === HAT_CAP && f0 > 0 && side(face[f0 - 1])) {
          face[f0 - 1] = "h";
          face[f0] = "H";
        }
        if (hat === HAT_BOWLER) {
          // a bowler is round and tall: its brim either side of the crown, a dome on top
          // (a cap is flat, its peak out to one side), so the two read apart at 6 x 8
          const hr = rows[hairRow];
          const isHair = (c: string | undefined): boolean =>
            c === "h" || c === "H";
          const h0 = hr.findIndex(isHair);
          let h1 = h0;
          while (isHair(hr[h1 + 1])) h1++;
          if (side(hr[h0 - 1])) hr[h0 - 1] = "H";
          if (side(hr[h1 + 1])) hr[h1 + 1] = "H";
          const above = rows[hairRow - 1];
          if (above !== undefined) {
            for (let x = h0 + 1; x < h1; x++) {
              if (above[x] === ".") above[x] = x === h0 + 1 ? "h" : "H";
            }
          }
        }
      }
      // the rattle: held up by the raised hand on the jump (2) and arms up (5), its
      // clacker a bar across the top of the handle
      if (rattle && (frame === 2 || frame === 5)) {
        const y = rows.findIndex((r) => r.includes("F"));
        if (y >= 0) {
          const x = rows[y].indexOf("F");
          rows[y][x] = "R";
          const top = y > 0 ? y - 1 : y;
          rows[top][x] = "R";
          for (const dx of [-1, 1]) {
            if (rows[top][x + dx] === ".") rows[top][x + dx] = "R";
          }
        }
      }
      return rows.map((r) => r.join("")).join("\n");
    })
    .join("\n\n");
}

const retroFanArt: (() => Sprite)[] = [];
for (let look = 0; look < 8; look++) {
  retroFanArt.push(lazy(() => sprite(hatted(FAN_ART, look), RETRO_FAN_LEGEND)));
}

/** The fan's sprite: today's, or RETRO's with a hat and a rattle (`hat` > 0). */
function fanSprite(hat: number): Sprite {
  return hat > 0 ? retroFanArt[hat & 7]() : fanArt();
}

/** The colours of one fan, worked out once when the stand is painted. */
export interface FanColors {
  hair: Color;
  hairLit: Color;
  skin: Color;
  skinLow: Color;
  body: Color;
  lit: Color;
  dark: Color;
  arm: Color;
  low: Color;
  seat: Color;
  scarfA: Color;
  scarfB: Color;
}

/** A fan's derived tones (lit, in shade...) from the colours a stand picks. */
export function fanTones(
  out: FanColors,
  hair: Color,
  skin: Color,
  body: Color,
  seat: Color,
  scarfA: Color,
  scarfB: Color,
): FanColors {
  out.hair = hair;
  out.hairLit = shade(hair, 0.28);
  out.skin = skin;
  out.skinLow = shade(skin, -0.22);
  out.body = body;
  out.lit = shade(body, 0.16);
  out.dark = shade(body, -0.24);
  out.arm = shade(body, -0.1);
  out.low = shade(body, -0.3);
  out.seat = seat;
  out.scarfA = scarfA;
  out.scarfB = scarfB;
  return out;
}

/** Draw a fan in a pose, its box's top left at (x, y). */
export function drawFanAt(
  s: Surface,
  x: number,
  y: number,
  pose: number,
  hair: Color,
  hairLit: Color,
  skin: Color,
  skinLow: Color,
  lit: Color,
  body: Color,
  dark: Color,
  arm: Color,
  low: Color,
  seat: Color,
  scarfA: Color,
  scarfB: Color,
  band: Color = TRANSPARENT,
  visor: Color = TRANSPARENT,
  hat = 0,
  rattle: Color = TRANSPARENT,
): void {
  const scarf = scarfA !== TRANSPARENT;
  const collar = low;
  drawSprite(
    s,
    fanSprite(hat),
    pose,
    x - 2,
    y - 4,
    fill(
      hairLit,
      hair,
      skin,
      skinLow,
      lit,
      body,
      dark,
      arm,
      low,
      scarf ? scarfB : collar,
      collar,
      scarf ? scarfA : body,
      scarf ? scarfB : body,
      seat,
      rattle,
    ),
  );
  // NEXT-GEN's lights (nextgen-people.ts): a visor over the face, a glowing wristband
  if (visor !== TRANSPARENT) {
    const fy = y - 4 + FAN_FACE_ROW[pose];
    s.hline(x + 1, fy, 3, visor);
  }
  if (band !== TRANSPARENT) drawFanBand(s, x, y, pose, band, arm, skin);
}

/** The row of each pose's frame where the fan's face starts (its visor's row). */
const FAN_FACE_ROW: readonly number[] = [5, 3, 3, 5, 3, 5];

/** A camera flash on the fan at (x, y): a white 2 x 2 core, gold glints. */
export function drawFlash(
  s: Surface,
  x: number,
  y: number,
  bright: boolean,
): void {
  s.rect(x + 2, y + 1, 2, 2, P.white);
  if (bright) {
    s.px(x + 1, y + 1, P.goldLight);
    s.px(x + 4, y + 2, P.goldLight);
    s.px(x + 3, y, P.goldLight);
    s.px(x + 2, y + 3, P.goldLight);
  }
}

export class FanList {
  n = 0;
  readonly x: Int16Array;
  readonly y: Int16Array;
  readonly head: Uint32Array;
  readonly body: Uint32Array;
  readonly low: Uint32Array;
  /** What shows where the fan's feet were when they stand up. */
  readonly seat: Uint32Array;
  readonly hand: Uint32Array;
  /** A scarf's two colours (0 for none). */
  readonly scarfA: Uint32Array;
  readonly scarfB: Uint32Array;
  readonly period: Uint8Array;
  readonly offset: Uint8Array;
  /** 1 wants the hero to score. */
  readonly side: Uint8Array;
  // The hair and the tones the fan is drawn with (`head` and `hand` are both the skin).
  readonly hair: Uint32Array;
  readonly hairLit: Uint32Array;
  readonly skinLow: Uint32Array;
  readonly lit: Uint32Array;
  readonly dark: Uint32Array;
  readonly arm: Uint32Array;
  /** NEXT-GEN's lights: a wristband and a visor (0 for none), the band's halo at night. */
  readonly band: Uint32Array;
  readonly visor: Uint32Array;
  readonly halo: Uint32Array;
  /** RETRO's hat and rattle (`HAT_*` + `RATTLE`, 0 bare-headed) and the rattle's colour. */
  readonly hat: Uint8Array;
  readonly rattle: Uint32Array;

  constructor(cap: number) {
    this.x = new Int16Array(cap);
    this.y = new Int16Array(cap);
    this.head = new Uint32Array(cap);
    this.body = new Uint32Array(cap);
    this.low = new Uint32Array(cap);
    this.seat = new Uint32Array(cap);
    this.hand = new Uint32Array(cap);
    this.scarfA = new Uint32Array(cap);
    this.scarfB = new Uint32Array(cap);
    this.period = new Uint8Array(cap);
    this.offset = new Uint8Array(cap);
    this.side = new Uint8Array(cap);
    this.hair = new Uint32Array(cap);
    this.hairLit = new Uint32Array(cap);
    this.skinLow = new Uint32Array(cap);
    this.lit = new Uint32Array(cap);
    this.dark = new Uint32Array(cap);
    this.arm = new Uint32Array(cap);
    this.band = new Uint32Array(cap);
    this.visor = new Uint32Array(cap);
    this.halo = new Uint32Array(cap);
    this.hat = new Uint8Array(cap);
    this.rattle = new Uint32Array(cap);
  }

  get cap(): number {
    return this.x.length;
  }
}

export interface FanLook {
  head: Color;
  body: Color;
  hand: Color;
  seat: Color;
  scarfA: Color;
  scarfB: Color;
  period: number;
  offset: number;
  withHero: boolean;
  /** The hair (or a hat) over the face; `head` is the face's skin. */
  hair?: Color;
  /**
   * NEXT-GEN's lights (nextgen-people.ts): a glowing wristband and a visor, raw, and the
   * band's halo at night. A remembered fan's band is drawn each frame (`drawFans`), not
   * into the layer, so it can be held up and catch the light wave.
   */
  band?: Color;
  visor?: Color;
  halo?: Color;
  /** RETRO's hat (`HAT_*`, + `RATTLE`) in the hair's colour, and the rattle's wood. */
  hat?: number;
  rattle?: Color;
}

const tones: FanColors = {
  hair: 0 as Color,
  hairLit: 0 as Color,
  skin: 0 as Color,
  skinLow: 0 as Color,
  body: 0 as Color,
  lit: 0 as Color,
  dark: 0 as Color,
  arm: 0 as Color,
  low: 0 as Color,
  seat: 0 as Color,
  scarfA: 0 as Color,
  scarfB: 0 as Color,
};

/**
 * Paint a fan at rest with the top of their head on row `y` (the box `x .. x + 5`), and
 * remember them.
 */
export function paintFan(
  s: Surface,
  fans: FanList | null,
  x: number,
  y: number,
  f: FanLook,
): void {
  const c = fanTones(
    tones,
    f.hair ?? shade(f.head, -0.45),
    f.head,
    f.body,
    f.seat,
    f.scarfA,
    f.scarfB,
  );
  const kept = fans !== null && fans.n < fans.cap;
  drawFanAt(
    s,
    x,
    y,
    REST,
    c.hair,
    c.hairLit,
    c.skin,
    c.skinLow,
    c.lit,
    c.body,
    c.dark,
    c.arm,
    c.low,
    c.seat,
    c.scarfA,
    c.scarfB,
    kept ? TRANSPARENT : (f.band ?? TRANSPARENT),
    f.visor ?? TRANSPARENT,
    f.hat ?? 0,
    f.rattle ?? TRANSPARENT,
  );
  if (fans && kept) {
    const k = fans.n++;
    fans.x[k] = x;
    fans.y[k] = y;
    fans.head[k] = c.skin;
    fans.body[k] = c.body;
    fans.low[k] = c.low;
    fans.seat[k] = c.seat;
    fans.hand[k] = c.skin;
    fans.scarfA[k] = c.scarfA;
    fans.scarfB[k] = c.scarfB;
    fans.period[k] = f.period;
    fans.offset[k] = f.offset;
    fans.side[k] = f.withHero ? 1 : 0;
    fans.hair[k] = c.hair;
    fans.hairLit[k] = c.hairLit;
    fans.skinLow[k] = c.skinLow;
    fans.lit[k] = c.lit;
    fans.dark[k] = c.dark;
    fans.arm[k] = c.arm;
    fans.band[k] = f.band ?? TRANSPARENT;
    fans.visor[k] = f.visor ?? TRANSPARENT;
    fans.halo[k] = f.halo ?? TRANSPARENT;
    fans.hat[k] = f.hat ?? 0;
    fans.rattle[k] = f.rattle ?? TRANSPARENT;
  }
}

/** Paint the fans who are doing something this frame over the layer's resting crowd. */
export function drawFans(
  s: Surface,
  fans: FanList,
  mood: CrowdMood,
  since: number,
  t: number,
): void {
  const n = fans.n;
  for (let k = 0; k < n; k++) {
    const pose = poseFor(
      mood,
      since,
      t,
      fans.side[k] === 1,
      fans.period[k],
      fans.offset[k],
      fans.scarfA[k] !== 0,
    );
    const band = fans.band[k] as Color;
    if (pose !== REST) drawFan(s, fans, k, pose);
    if (band === TRANSPARENT) continue;
    // NEXT-GEN: a seated fan's band of light, held up (drawFan drew a posed one's)
    const x = fans.x[k];
    const y = fans.y[k];
    if (pose === REST) {
      drawFanBand(
        s,
        x,
        y,
        pose,
        band,
        fans.arm[k] as Color,
        fans.hand[k] as Color,
      );
    }
    if (bandCrest(x, y, t)) drawFanCrest(s, x, y, pose, fans.halo[k] as Color);
  }
}

/**
 * Paint fan `k` of the list in a pose over the layer's resting crowd (`drawFans` does it
 * for every fan doing something; the sheets call it for one).
 */
export function drawFan(
  s: Surface,
  fans: FanList,
  k: number,
  pose: Pose,
): void {
  const x = fans.x[k];
  const y = fans.y[k];
  const body = fans.body[k] as Color;
  const hand = fans.hand[k] as Color;
  drawFanAt(
    s,
    x,
    y,
    pose,
    fans.hair[k] as Color,
    fans.hairLit[k] as Color,
    hand,
    fans.skinLow[k] as Color,
    fans.lit[k] as Color,
    body,
    fans.dark[k] as Color,
    fans.arm[k] as Color,
    fans.low[k] as Color,
    fans.seat[k] as Color,
    fans.scarfA[k] as Color,
    fans.scarfB[k] as Color,
    fans.band[k] as Color,
    fans.visor[k] as Color,
    fans.hat[k],
    fans.rattle[k] as Color,
  );
}

// ---------------------------------------------------------------------------
// People standing to watch (tiers 0 to 2), facing us
// ---------------------------------------------------------------------------

/**
 * h hair lit, H hair, F skin, f skin in shade, E eyes, C coat lit, B coat, D coat in
 * shade, n collar, N scarf at the neck (or the coat), M its second colour (or the coat),
 * L the coat's hem, G legs, g legs in shade, K shoes.
 *
 * Frame 0 has the arms down the sides, frame 1 has them raised (the overlays add them).
 */
const WATCHER_LEGEND = "hHFfECBDnNMLGgK";

const adultArt = lazy(() =>
  sprite(
    `
    ...hHHH...
    ..hHHHHH..
    ..HFFFFH..
    ..FEFFEf..
    ..FFFFFf..
    ...FFFf...
    .CCnFfnBD.
    CBCBNMBBDD
    CBCBMBBBDD
    CBCBNBBBDD
    CBCBMBBBDD
    CBCBBBBBDD
    CBCBBBBBDD
    CBCBBBBBDD
    CBCBBBBBDD
    CBCBBBBBDD
    FFCBBBBBff
    FfCBBBBBff
    ..CBBBBB..
    ..LLLLLL..
    ..Gg..Gg..
    ..Gg..Gg..
    ..Gg..Gg..
    ..Gg..Gg..
    ..Gg..Gg..
    ..Gg..Gg..
    ..KK..KK..
    .KKK..KKK.

    ...hHHH...
    ..hHHHHH..
    ..HFFFFH..
    ..FEFFEf..
    ..FFFFFf..
    ...FFFf...
    .CCnFfnBD.
    .DCBNMBBD.
    .CCBMBBBD.
    .CCBNBBBD.
    .CCBMBBBD.
    ..CBBBBBD.
    ..CBBBBB..
    ..CBBBBB..
    ..CBBBBB..
    ..CBBBBB..
    ..CBBBBB..
    ..CBBBBB..
    ..CBBBBB..
    ..LLLLLL..
    ..Gg..Gg..
    ..Gg..Gg..
    ..Gg..Gg..
    ..Gg..Gg..
    ..Gg..Gg..
    ..Gg..Gg..
    ..KK..KK..
    .KKK..KKK.
    `,
    WATCHER_LEGEND,
  ),
);

const kidArt = lazy(() =>
  sprite(
    `
    ...hHHH...
    ..hHHHHH..
    ..HFFFFH..
    ..FEFFEf..
    ..FFFFFf..
    ...FFFf...
    .CCnFfnBD.
    CBCBNMBBDD
    CBCBMBBBDD
    CBCBNBBBDD
    CBCBBBBBDD
    CBCBBBBBDD
    FFCBBBBBff
    FfCBBBBBff
    ..CBBBBB..
    ..LLLLLL..
    ..Gg..Gg..
    ..Gg..Gg..
    ..Gg..Gg..
    ..Gg..Gg..
    ..KK..KK..
    .KKK..KKK.

    ...hHHH...
    ..hHHHHH..
    ..HFFFFH..
    ..FEFFEf..
    ..FFFFFf..
    ...FFFf...
    .CCnFfnBD.
    .DCBNMBBD.
    .CCBMBBBD.
    .CCBNBBBD.
    ..CBBBBBD.
    ..CBBBBB..
    ..CBBBBB..
    ..CBBBBB..
    ..CBBBBB..
    ..LLLLLL..
    ..Gg..Gg..
    ..Gg..Gg..
    ..Gg..Gg..
    ..Gg..Gg..
    ..KK..KK..
    .KKK..KKK.
    `,
    WATCHER_LEGEND,
  ),
);

/**
 * The arms of a watcher who is not standing still, 14 x 11, laid over the body: the
 * body's box is columns 2..11 and its head starts on row 4. Frames: arms up (a jump, both
 * arms), hands on the head, a scarf held up over the head.
 */
const ARMS_LEGEND = "FfCBDNM";
const ARMS_UP = 0;
const ARMS_HANDS = 1;
const ARMS_SCARF = 2;

const armsArt = lazy(() =>
  sprite(
    `
    ..FF......ff..
    ..FF......ff..
    ..CB......BD..
    ..CB......BD..
    ..CB......BD..
    ..CB......BD..
    ..CB......BD..
    ..CB......BD..
    ..CB......BD..
    ..CB......BD..
    ..CC......DD..

    ..............
    ..............
    ..............
    ..............
    ..............
    ...F......f...
    ..FF......ff..
    ..CF......fD..
    ..CB......BD..
    ..CB......BD..
    ..CC......DD..

    NNMMNNMMNNMMNN
    NNMMNNMMNNMMNN
    MFF........ffM
    .CB........BD.
    .CB........BD.
    .CB........BD.
    ..CB......BD..
    ..CB......BD..
    ..CB......BD..
    ..CB......BD..
    ..CC......DD..
    `,
    ARMS_LEGEND,
  ),
);

export interface Watcher {
  /** The middle column and the row under their feet. */
  x: number;
  y: number;
  kid: boolean;
  hair: Color;
  skin: Color;
  coat: Color;
  coatLow: Color;
  legs: Color;
  period: number;
  offset: number;
  withHero: boolean;
  /** A scarf in two colours (for `roar` and `party`), or TRANSPARENT for none. */
  scarfA: Color;
  scarfB: Color;
  /** NEXT-GEN's lights (nextgen-people.ts): glowing wristbands and a visor, raw. */
  band?: Color;
  visor?: Color;
  /** NEXT-GEN's trim of light on the jacket: its hem and its zip (raw). */
  trim?: Color;
  /** RETRO's hat (`HAT_CAP`, `HAT_BOWLER`; adults only) in `hatColor` (retro-people.ts). */
  hat?: number;
  hatColor?: Color;
}

/** A person standing facing us: 10 x 28 (a child 10 x 22), feet on row `y - 1`. */
export function drawWatcher(s: Surface, w: Watcher, pose: Pose): void {
  const art = w.kid ? kidArt() : adultArt();
  const lift = lifted(pose) ? 2 : 0;
  const x = w.x - 4;
  const top = w.y - art.h - lift;
  const scarf = w.scarfA !== TRANSPARENT;
  const up = pose === JUMP || pose === ARMS;
  const holding = pose === SCARF && scarf;
  const raised = up || pose === HANDS || holding;
  const hairLit = shade(w.hair, 0.28);
  const skinLow = shade(w.skin, -0.22);
  const eye = shade(w.skin, -0.62);
  const lit = shade(w.coat, 0.16);
  const dark = shade(w.coat, -0.24);
  const collar = shade(w.coat, -0.32);
  const legsLow = shade(w.legs, -0.25);
  // the scarf round the neck, unless it is held up
  const neckA = scarf && !holding ? w.scarfA : w.coat;
  const neckB = scarf && !holding ? w.scarfB : w.coat;
  drawSprite(
    s,
    art,
    raised ? 1 : 0,
    x,
    top,
    fill(
      hairLit,
      w.hair,
      w.skin,
      skinLow,
      eye,
      lit,
      w.coat,
      dark,
      collar,
      neckA,
      neckB,
      w.coatLow,
      w.legs,
      legsLow,
      P.ink,
    ),
  );
  // RETRO's hat over the hair: a flat cap with its peak over the brow, or a bowler
  if (!w.kid && w.hat !== undefined && w.hatColor !== undefined) {
    const c = w.hatColor;
    const d = shade(c, -0.25);
    if (w.hat === HAT_CAP) {
      s.hline(x + 3, top, 4, c);
      s.hline(x + 2, top + 1, 6, c);
      s.hline(x + 1, top + 2, 8, d);
    } else if (w.hat === HAT_BOWLER) {
      s.hline(x + 3, top - 1, 4, c);
      s.hline(x + 2, top, 6, c);
      s.hline(x + 1, top + 1, 8, d);
    }
  }
  // NEXT-GEN's visor across the eyes
  if (w.visor !== undefined && w.visor !== TRANSPARENT) {
    s.hline(x + 2, top + 3, 6, w.visor);
  }
  // NEXT-GEN's jacket trimmed with light: the hem and a zip up to the collar or scarf
  if (w.trim !== undefined && w.trim !== TRANSPARENT) {
    const hem = top + (w.kid ? 15 : 19);
    const zip = top + (scarf && !holding ? (w.kid ? 10 : 11) : 7);
    s.hline(x + 2, hem, 6, w.trim);
    s.vline(x + 5, zip, hem - zip, w.trim);
  }
  const band = w.band ?? TRANSPARENT;
  if (!raised) {
    // NEXT-GEN's wristbands, just over the hands at his sides
    if (band !== TRANSPARENT) {
      const wy = top + (w.kid ? 11 : 15);
      s.hline(x, wy, 2, band);
      s.hline(x + 8, wy, 2, band);
    }
    return;
  }
  drawSprite(
    s,
    armsArt(),
    up ? ARMS_UP : pose === HANDS ? ARMS_HANDS : ARMS_SCARF,
    x - 2,
    top - 4,
    fill(w.skin, skinLow, lit, w.coat, dark, w.scarfA, w.scarfB),
  );
  if (band !== TRANSPARENT) {
    // under the raised hands
    const dx = holding ? -1 : 0;
    const wy = top + (up ? -2 : holding ? -1 : 4);
    s.hline(x + dx, wy, 2, band);
    s.hline(x + 8 - dx, wy, 2, band);
  }
}

// ---------------------------------------------------------------------------
// People seen from behind on the near side
// ---------------------------------------------------------------------------

/**
 * h hair lit, H hair, d hair in shade, e an ear, E an ear in shade, F the neck, f the neck
 * in shade, T the coat's shoulders, C coat lit, B coat, D coat in shade, A a fold, n the
 * collar, K the hood folded down, k inside the hood, L the hem.
 *
 * Frame 0 is someone in a jacket (12 x 20), frame 1 a substitute's long coat (16 x 26).
 */
const BACK_LEGEND = "hHdeEFfTCBDAnKkL";

const backSmall = lazy(() =>
  sprite(
    `
    ....hHHH....
    ...hHHHHH...
    ..hHHHHHHH..
    ..HHHHHHHd..
    ..HHHHHHHd..
    .eHHHHHHHdE.
    ..dHHHHHdd..
    ...dFFFfd...
    .TTTnnnnTTT.
    CTTTTTTTTTTD
    CCBBBBBBBBDD
    CCBBBBBBBBDD
    CCBBBBBBBBDD
    CCBBBBBBBBDD
    CCABBBBBBADD
    CCABBBBBBADD
    CCABBBBBBADD
    CCABBBBBBADD
    CCABBBBBBADD
    CCBBBBBBBBDD
    `,
    BACK_LEGEND,
  ),
);

const backBig = lazy(() =>
  sprite(
    `
    ......hHHH......
    .....hHHHHH.....
    ....hHHHHHHH....
    ....HHHHHHHd....
    ....HHHHHHHd....
    ...eHHHHHHHdE...
    ....dHHHHHdd....
    .....dFFFfd.....
    ..TTKKKKKKKKTT..
    .TTTKkkkkkkKTTT.
    CTTTTKKKKKKTTTTD
    CCBBBBBBBBBBBBDD
    CCBBBBBBBBBBBBDD
    CCBBBBBBBBBBBBDD
    CCBBBBBBBBBBBBDD
    CCBBBBBBBBBBBBDD
    CCABBBBBBBBBBADD
    CCABBBBBBBBBBADD
    CCABBBBBBBBBBADD
    CCABBBBBBBBBBADD
    CCABBBBBBBBBBADD
    CCABBBBBBBBBBADD
    CCABBBBBBBBBBADD
    CCABBBBBBBBBBADD
    CCABBBBBBBBBBADD
    LLLLLLLLLLLLLLLL
    `,
    BACK_LEGEND,
  ),
);

/**
 * Someone standing or sitting with their back to us: left edge `x`, bottom row `y + 1`; a
 * person in a jacket is 12 x 20, `big` a substitute's long coat (16 x 26). `skin` colours
 * the ears and the neck (hair-coloured when it is not given).
 */
export function paintBack(
  s: Surface,
  x: number,
  y: number,
  hair: Color,
  coat: Color,
  big: boolean,
  skin: Color = TRANSPARENT,
): void {
  const art = big ? backBig() : backSmall();
  const hairLow = shade(hair, -0.25);
  const ear = skin === TRANSPARENT ? hair : skin;
  const earLow = skin === TRANSPARENT ? hairLow : shade(skin, -0.22);
  drawSprite(
    s,
    art,
    0,
    x,
    y + 2 - art.h,
    fill(
      shade(hair, 0.25),
      hair,
      hairLow,
      ear,
      earLow,
      ear,
      earLow,
      shade(coat, 0.15),
      shade(coat, 0.2),
      coat,
      shade(coat, -0.3),
      shade(coat, -0.12),
      shade(coat, -0.32),
      shade(coat, -0.2),
      shade(coat, -0.4),
      shade(coat, -0.35),
    ),
  );
}

// ---------------------------------------------------------------------------
// The near crowd from behind: 10 x 12 people on a 12 x 10 grid
// ---------------------------------------------------------------------------

/** The near crowd's grid. */
export const BACKS = { w: 10, h: 12, dx: 12, dy: 10 } as const;

/**
 * Frames: short hair, long hair, shaved, a bobble hat; then RETRO's (`BACK_CAP`,
 * `BACK_BOWLER`, never picked by `% CROWD_STYLES`): a flat cap, a bowler with its brim.
 * h hair lit, H hair, d hair in shade, e ear, E ear in shade, F skin, f skin in shade,
 * g skin lit, T the shoulders, C shirt lit, B shirt, D shirt in shade, n collar,
 * N the hat, M its band and bobble.
 */
const CROWD_LEGEND = "hHdeEFfgTCBDnNM";
export const CROWD_STYLES = 4;
/** RETRO's near crowd from behind: a flat cap, a bowler (hatA the hat, hatB its shade). */
export const BACK_CAP = 4;
export const BACK_BOWLER = 5;

const crowdArt = lazy(() =>
  sprite(
    `
    ...hHHH...
    ..hHHHHH..
    ..HHHHHd..
    .eHHHHHdE.
    ..dHHHdd..
    ....Ff....
    .TTnnnnTT.
    CTTTTTTTTD
    CCBBBBBBDD
    CCBBBBBBDD
    CCBBBBBBDD
    CCBBBBBBDD

    ...hHHH...
    ..hHHHHH..
    ..HHHHHd..
    ..HHHHHd..
    ..HHHHHd..
    ..HHHHdd..
    .THHHHddT.
    CTHHHHddTD
    CCBdHdBBDD
    CCBBBBBBDD
    CCBBBBBBDD
    CCBBBBBBDD

    ...gFFF...
    ..gFFFFf..
    ..FFFFFf..
    .eFFFFFfE.
    ..fFFFff..
    ....Ff....
    .TTnnnnTT.
    CTTTTTTTTD
    CCBBBBBBDD
    CCBBBBBBDD
    CCBBBBBBDD
    CCBBBBBBDD

    ....MM....
    ..NNNNNN..
    ..MMMMMM..
    .eHHHHHdE.
    ..dHHHdd..
    ....Ff....
    .TTnnnnTT.
    CTTTTTTTTD
    CCBBBBBBDD
    CCBBBBBBDD
    CCBBBBBBDD
    CCBBBBBBDD

    ...NNNN...
    ..NNNNNN..
    ..NNNNNM..
    .eHHHHHdE.
    ..dHHHdd..
    ....Ff....
    .TTnnnnTT.
    CTTTTTTTTD
    CCBBBBBBDD
    CCBBBBBBDD
    CCBBBBBBDD
    CCBBBBBBDD

    ....NN....
    ...NNNNM..
    .MMMMMMMM.
    .eHHHHHdE.
    ..dHHHdd..
    ....Ff....
    .TTnnnnTT.
    CTTTTTTTTD
    CCBBBBBBDD
    CCBBBBBBDD
    CCBBBBBBDD
    CCBBBBBBDD
    `,
    CROWD_LEGEND,
  ),
);

/** One of the near crowd from behind, top left (x, y). */
export function crowdBack(
  s: Surface,
  x: number,
  y: number,
  style: number,
  hair: Color,
  skin: Color,
  shirt: Color,
  hatA: Color,
  hatB: Color,
  glow: Color = TRANSPARENT,
): void {
  // NEXT-GEN: a headset of light round the head (not under long hair)
  const earpieces = glow !== TRANSPARENT && style !== 1;
  drawSprite(
    s,
    crowdArt(),
    style,
    x,
    y,
    fill(
      shade(hair, 0.28),
      hair,
      shade(hair, -0.25),
      shade(skin, -0.1),
      shade(skin, -0.3),
      skin,
      shade(skin, -0.22),
      shade(skin, 0.2),
      shade(shirt, 0.1),
      shade(shirt, 0.2),
      shirt,
      shade(shirt, -0.3),
      shade(shirt, -0.38),
      hatA,
      hatB,
    ),
  );
  if (earpieces) {
    // a headset's band of light round the back of the head, ear to ear
    s.hline(x + 1, y + 3, 8, glow);
  }
}

/**
 * A scarf held up over a near-crowd head: stripes 2 px wide from `x - 2` to
 * `x + 11` on rows `y - 4` and `y - 3`, the hands under its ends.
 */
export function crowdScarf(
  s: Surface,
  x: number,
  y: number,
  a: Color,
  b: Color,
  hand: Color,
): void {
  for (let i = 0; i < 14; i++) {
    const c = ((i >> 1) & 1) === 0 ? a : b;
    s.px(x - 2 + i, y - 4, c);
    s.px(x - 2 + i, y - 3, c);
  }
  s.px(x - 2, y - 2, b);
  s.px(x + 11, y - 2, b);
  s.rect(x - 1, y - 2, 2, 2, hand);
  s.rect(x + 9, y - 2, 2, 2, hand);
}

// ---------------------------------------------------------------------------
// The steward (tiers 4 to 7), facing us
// ---------------------------------------------------------------------------

/**
 * H hair, F skin, f skin in shade, E eyes, V the hi-vis jacket, v its folds, w its
 * shaded side, R the reflective bands, r their lower edge, n collar, G trousers,
 * g trousers in shade, K shoes.
 */
const STEWARD_LEGEND = "HFfEVvwRrnGgK";

const stewardArt = lazy(() =>
  sprite(
    `
    ...HHHH...
    ..HHHHHH..
    ..HFFFFH..
    ..FEFFEf..
    ..FFFFFf..
    ...FFFf...
    .VVnFfnVv.
    VvVVnvVVvw
    VvVVVvVVvw
    VvVVVvVVvw
    VvVVVvVVvw
    RRRRRRRRRR
    rrrrrrrrrr
    VvVVVvVVvw
    VvVVVvVVvw
    VvVVVvVVvw
    RRRRRRRRRR
    rrrrrrrrrr
    VvVVVvVVvw
    VvVVVvVVvw
    FFVVVvVVff
    FfVVVvVVff
    ..VVVvVV..
    ..vvvvvv..
    ..Gg..Gg..
    ..Gg..Gg..
    ..Gg..Gg..
    ..Gg..Gg..
    ..KK..KK..
    .KKK..KKK.
    `,
    STEWARD_LEGEND,
  ),
);

/**
 * The steward: 10 x 30, `x` the left of the two middle columns, feet on row
 * `y - 1`. Colours already graded by the caller: the hi-vis jacket, the skin, the hair,
 * the trousers.
 */
export function drawSteward(
  s: Surface,
  x: number,
  y: number,
  vest: Color,
  band: Color,
  skin: Color,
  hair: Color,
  trousers: Color,
): void {
  const art = stewardArt();
  drawSprite(
    s,
    art,
    0,
    x - 4,
    y - art.h,
    fill(
      hair,
      skin,
      shade(skin, -0.22),
      shade(hair, -0.2),
      vest,
      shade(vest, -0.12),
      shade(vest, -0.24),
      band,
      shade(band, -0.22),
      shade(vest, -0.36),
      trousers,
      shade(trousers, -0.25),
      P.ink,
    ),
  );
}

// ---------------------------------------------------------------------------
// The dog: 18 x 12, facing right
// ---------------------------------------------------------------------------

/**
 * Frames: stand, trot a, trot b, sit, sit wag (`DOG_STAND`, `DOG_TROT`, `DOG_SIT`). Its colours are
 * `dogColors` (near.ts): k dark brown, b brown, w white, n nose and eye, l brown lit,
 * m white in shade.
 */
export const DOG_LEGEND = "kbwnlm";

export const dogArt = lazy(() =>
  sprite(
    `
    ............kk....
    ...........klbb...
    k..........lbbnbb.
    k..........bbbbbbn
    .k..........bbwww.
    ..k.........bwww..
    ..llllllllllbbww..
    ..bbbbbbbbbbbbbw..
    ..bbbbbbbbbbbbbb..
    ..bbkkkkkkkkbbb...
    ..bb.kk....kk.bb..
    ..bb.kk....kk.bb..

    ............kk....
    ...........klbb...
    ...........lbbnbb.
    ...........bbbbbbn
    k...........bbwww.
    .kk.........bwww..
    ..llllllllllbbww..
    ..bbbbbbbbbbbbbw..
    ..bbbbbbbbbbbbbb..
    ..bbkkkkkkkkbbb...
    .bb..kk....kk..bb.
    bb...kk....kk...bb

    ............kk....
    ...........klbb...
    ...........lbbnbb.
    k..........bbbbbbn
    .k..........bbwww.
    ..k.........bwww..
    ..llllllllllbbww..
    ..bbbbbbbbbbbbbw..
    ..bbbbbbbbbbbbbb..
    ..bbkkkkkkkkbbb...
    ...bbkk....kkbb...
    ....bkk....kkb....

    ............kk....
    ...........klbb...
    ...........lbbnbb.
    ...........bbbbbbn
    ............bbwww.
    ............bwww..
    ...........lbbww..
    ..........lbbbbw..
    ........llbbbbbw..
    .k....llbbbbkbbb..
    ..k..lbbbbbbkbb...
    ...kkbbbbbbbkbbb..

    ............kk....
    ...........klbb...
    ...........lbbnbb.
    ...........bbbbbbn
    ............bbwww.
    ............bwww..
    ...........lbbww..
    ..........lbbbbw..
    ........llbbbbbw..
    ......llbbbbkbbb..
    .....lbbbbbbkbb...
    kkkkkbbbbbbbkbbb..
    `,
    DOG_LEGEND,
  ),
);

/** The dog: `x` the left of its two middle columns, feet on row `y - 1`. */
export function drawDog(
  s: Surface,
  frame: number,
  x: number,
  y: number,
  colors: readonly Color[],
  flip: boolean,
): void {
  const art = dogArt();
  drawSprite(s, art, frame, x - 8, y - art.h, colors, { flipX: flip });
}

export const DOG_STAND = 0;
export const DOG_TROT = 1;
export const DOG_SIT = 3;
