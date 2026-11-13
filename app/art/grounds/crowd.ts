/**
 * The crowds of the career ground (docs/ART_BIBLE.md section 5): blocks of seated fans in
 * the far stands, the aisles through them, and the near crowd seen from behind. The people
 * themselves are drawn by people.ts.
 */

import { FAN } from "~/art/layout";
import { P } from "~/art/palette";
import { TRANSPARENT, shade, type Color, type Surface } from "~/pixel";
import type { Life } from "./life";
import { retroDress } from "./retro-people";
import { neckScarf, retroNearDress } from "./retro-near-crowd";
import {
  HAIR,
  SKIN,
  TRAVELLING,
  crowdColors,
  crowdShirts,
  inPocket,
  pick,
  rnd,
  type Paint,
  type Weighted,
} from "./paint";
import { nextgenLights, type Lights } from "./nextgen-people";
import {
  BACKS,
  BACK_BOWLER,
  BACK_CAP,
  HAT_BOWLER,
  HAT_CAP,
  crowdBack,
  crowdScarf,
  paintFan,
} from "./people";

/** A block of seats: its place, and how many rows of fans it holds. */
export interface SeatBlock {
  x0: number;
  x1: number;
  y: number;
  rows: number;
  seat: Color;
  empty: number;
  shadowRows: number;
}

/**
 * A block of seated 6 x 8 fans on the 8 px pitch, `rows * 8` tall from `b.y`.
 * Every other row is staggered by half a seat. About one in ten at the small grounds
 * (one in twenty-five in a stadium) wears a bobble hat in the crowd's colours.
 */
export function fanBlock(s: Surface, p: Paint, life: Life, b: SeatBlock): void {
  const F = FAN;
  const st = fanStyle(p);
  s.rect(b.x0, b.y, b.x1 - b.x0, b.rows * F.pitch, b.seat);
  for (let r = 0; r < b.rows; r++) {
    const y = b.y + r * F.pitch;
    const stagger = (r & 1) * (F.pitch >> 1);
    for (let x = b.x0 + stagger + 2; x + F.w <= b.x1; x += F.pitch) {
      if (rnd(p, x, y, 21) < b.empty) continue;
      seatFan(s, p, life, st, x, y, b.seat, r < b.shadowRows);
    }
  }
}

/** How a stand's crowd dresses, worked out once per stand. */
export interface FanStyle {
  shirts: Weighted;
  away: boolean;
  scarfChance: number;
  hatChance: number;
}

/** The crowd's dress for this build (its tier and mode). */
export function fanStyle(p: Paint): FanStyle {
  return {
    shirts: crowdShirts(p),
    away: p.mode === "away",
    scarfChance: p.tier >= 5 ? 0.3 : p.tier >= 3 ? 0.18 : 0.08,
    hatChance: p.tier <= 3 ? 0.1 : 0.04,
  };
}

/**
 * One seated 6 x 8 fan, its box's top left at (x, y), dressed by the stand's
 * style and its place (the same place gives the same fan); `dim` sits it in a roof's
 * shadow. Painted into the layer at rest and added to the fans who react to the mood.
 */
export function seatFan(
  s: Surface,
  p: Paint,
  life: Life,
  st: FanStyle,
  x: number,
  y: number,
  seat: Color,
  dim: boolean,
): void {
  const { S } = p;
  const id = x * 7 + y * 131;
  const travelling = st.away && inPocket(p, x, y);
  // friends sit in twos and wear the same
  const pair = rnd(p, x >> 4, y, 22) < 0.3;
  let body = pick(
    travelling ? TRAVELLING : st.shirts,
    pair ? rnd(p, x >> 4, y, 23) : rnd(p, x, y, 24),
  );
  let skin = pick(SKIN, rnd(p, x, y, 27));
  const [ca, cb] = crowdColors(p, travelling);
  const hat = rnd(p, x, y, 29);
  let hair =
    hat < st.hatChance
      ? hat < st.hatChance / 2
        ? ca
        : cb
      : pick(HAIR, rnd(p, x, y, 25));
  // RETRO: overcoats, flat caps, bowlers and rattles (retro-people.ts)
  let look = 0;
  let rattle: Color = TRANSPARENT;
  if (p.era === "retro") {
    const d = retroDress(p, x, y, body, hair);
    body = d.body;
    hair = d.hair;
    look = d.hat;
    rattle = d.rattle;
  }
  if (dim) {
    body = shade(body, -0.4);
    skin = shade(skin, -0.4);
    hair = shade(hair, -0.4);
    if (rattle !== TRANSPARENT) rattle = shade(rattle, -0.4);
  }
  const scarf =
    rnd(p, x, y, 26) < st.scarfChance + (p.era === "retro" ? 0.12 : 0);
  paintFan(s, life.fans, x, y, {
    head: S(skin),
    body: S(body),
    hand: S(skin),
    seat,
    scarfA: scarf ? S(ca) : TRANSPARENT,
    scarfB: S(cb),
    period: 9 + Math.floor(rnd(p, id, 1, 28) * 14),
    offset: Math.floor(rnd(p, id, 2, 28) * 250),
    withHero: !st.away || travelling,
    hair: S(hair),
    hat: look,
    rattle: rattle === TRANSPARENT ? TRANSPARENT : S(rattle),
    ...(p.era === "nextgen"
      ? nextgenLights(lights, p.seed, x, y, p.light.lightsOn)
      : NO_LIGHTS),
  });
}

/** NEXT-GEN's lights for one person (reused) and today's none. */
const lights: Lights = { band: TRANSPARENT, visor: TRANSPARENT };
const NO_LIGHTS: Partial<Lights> = {};

/**
 * Light steps cutting a block of seats into sections every `every` px, each aisle 4 px
 * wide: steps two rows deep, lit on the left.
 */
export function aisles(
  s: Surface,
  p: Paint,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  every: number,
): void {
  const { S, g } = p;
  // RETRO's wooden grandstand (tier 3): steps of timber
  const wood = p.era === "retro" && p.tier <= 3;
  const a = S(wood ? P.wood : P.concreteLight);
  const b = S(wood ? P.woodDark : P.concrete);
  const edge = S(wood ? shade(P.woodDark, -0.25) : P.concreteDark);
  const nose = S(wood ? shade(P.wood, 0.3) : P.steelHi);
  const start = g.cx + (((((x0 - g.cx) % every) + every) % every) - every);
  for (let x = start; x < x1; x += every) {
    if (x < x0 + 6 || x > x1 - 10) continue;
    for (let y = y0; y < y1; y++) {
      const k = (y - y0) & 3;
      // the step's lit nosing, its tread, then the riser in shade
      s.hline(x, y, 4, k === 0 ? nose : k === 1 ? a : b);
      s.px(x + 3, y, k === 0 ? a : edge);
    }
  }
}

/**
 * The near crowd from behind, rows of 10 x 12 people on a 12 x 10 grid packed
 * into [y0, y1), each row nearer than the one above it. `share` of the places are taken.
 */
export function crowdBacks(
  s: Surface,
  p: Paint,
  y0: number,
  y1: number,
  share: number,
  dim: number,
): void {
  const { g, S } = p;
  const B = BACKS;
  const shirts = crowdShirts(p);
  const scarves = p.tier >= 5 ? 0.18 : p.tier >= 3 ? 0.06 : 0;
  const hats = p.tier <= 3 ? 0.12 : 0.05;
  const [a, b] = crowdColors(p, false);
  for (let y = y0 + 4, r = 0; y < y1 + 6; y += B.dy, r++) {
    for (let x = (r & 1) * (B.dx >> 1) - B.dx; x < g.w; x += B.dx) {
      if (rnd(p, x, y, 92) > share) continue;
      // in the shade of the near stand: calmer than the lit crowd across the pitch
      let shirt = S(shade(pick(shirts, rnd(p, x, y, 90)), -dim));
      const hair = S(shade(pick(HAIR, rnd(p, x, y, 91)), -dim * 0.5));
      const skin = S(shade(pick(SKIN, rnd(p, x, y, 94)), -dim * 0.6));
      const look = rnd(p, x, y, 95);
      // short hair mostly; long hair, shaved heads and bobble hats here and there
      let style =
        look < hats ? 3 : look < hats + 0.07 ? 2 : look < hats + 0.25 ? 1 : 0;
      let hatA = S(shade(look < hats / 2 ? a : b, -dim * 0.5));
      let hatB = S(shade(look < hats / 2 ? b : a, -dim * 0.5));
      // RETRO's near crowd from tier 3: lighter coats, caps that separate, scarves on the
      // collar (retro-near-crowd.ts, the RETRO big grounds polisher's)
      const near = p.era === "retro" && p.tier >= 3;
      if (near) {
        const d = retroNearDress(p, x, y);
        // (half the shade: pale coats must stay pale in front of the camera)
        shirt = S(shade(d.body, -dim * 0.5));
        style = d.style < 0 ? (style === 2 ? 2 : 0) : d.style;
        hatA = S(shade(d.hat, -dim * 0.5));
        hatB = S(shade(d.hatShade, -dim * 0.5));
      } else if (p.era === "retro") {
        // RETRO: overcoats, flat caps and bowlers (retro-people.ts)
        const d = retroDress(p, x, y, pick(shirts, rnd(p, x, y, 90)), hair);
        shirt = S(shade(d.body, -dim));
        const hat = d.hat & 3;
        style =
          hat === HAT_CAP ? BACK_CAP : hat === HAT_BOWLER ? BACK_BOWLER : 0;
        hatA = S(shade(d.hair, -dim * 0.5));
        hatB = S(shade(d.hair, -dim * 0.5 - 0.25));
      }
      // NEXT-GEN: earpieces of light on the heads in front of us
      const glow =
        p.era === "nextgen"
          ? nextgenLights(lights, p.seed, x, y).band
          : TRANSPARENT;
      crowdBack(s, x, y, style, hair, skin, shirt, hatA, hatB, glow);
      if (near && retroNearDress(p, x, y).scarf) {
        neckScarf(s, x, y, S(shade(a, -dim * 0.5)), S(shade(b, -dim * 0.5)));
      }
      if (rnd(p, x, y, 93) < (near ? scarves * 0.35 : scarves)) {
        // a scarf held up over the head
        crowdScarf(s, x, y, S(a), S(b), S(P.skinA));
      }
    }
  }
}
