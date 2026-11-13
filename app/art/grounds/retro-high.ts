/**
 * RETRO's big grounds (tiers 4 to 7), the far side: a grand old grandstand of the early
 * game in place of today's two-tier stand, on the same rows (`STAND`) so everything that
 * reads them (the moon, the fireworks' band, the travelling pocket) still fits.
 *
 *   - a pitched corrugated-iron roof behind a cream timber fascia with a club stripe and a
 *     dagger-board valance; a pediment over the middle with a clock and the club's flag;
 *   - the upper tier: wooden benches under the roof, cast-iron columns holding it up;
 *   - the balcony: a criss-cross lattice in the club's colour between two cream rails, a
 *     newsreel platform hung from it (two cameramen cranking box cameras);
 *   - the paddock: a standing terrace with iron crush barriers, a brick wall in front;
 *   - painted wooden hoardings along the far touchline (the labels, in the painted font);
 *   - two iron lamp standards with clusters of bare bulbs, and bare bulbs under the roof,
 *     lit at night (the early game had no lattice pylons);
 *   - from tier 5: bunting, flags on the roof, banners on the balcony and a brass band in
 *     the upper tier; tier 6: searchlights and the crowd's flags; tier 7: fireworks of the
 *     era (gold and white willows, red stars) over the roof.
 *
 * The end behind the goal is `retro-end.ts`, the near side `retro-near.ts`. Everything is
 * painted once per build into the layer; what moves goes into the `Life` (flags, flashes,
 * the band's glints, the cameramen's cranks and the fireworks are `Mover`s that allocate
 * nothing when drawn).
 */

import { paintedFont } from "~/art/lettering";
import { P } from "~/art/palette";
import {
  FONT_3x5,
  TRANSPARENT,
  drawSprite,
  drawText,
  hash2,
  measureText,
  mix,
  shade,
  sprite,
  type Color,
  type Sprite,
  Surface,
  type TextOptions,
} from "~/pixel";
import { fanBlock } from "./crowd";
import { endFor, endRoofAt } from "./end";
import type { Life } from "./life";
import { crowdColors, rnd, sx, type Geo, type Paint } from "./paint";
import { STAND } from "./stand";

/** A sprite built on first use. */
function lazy(make: () => Sprite): () => Sprite {
  let made: Sprite | null = null;
  return () => (made ??= make());
}

/** Fill a colour array for a sprite's legend from a map of its characters. */
function colorsFor(sp: Sprite, by: Readonly<Record<string, Color>>): Color[] {
  return Array.from(sp.legend, (k) => by[k] ?? TRANSPARENT);
}

let painted: TextOptions | null = null;
/** Painted words: the small face's painted twin. */
export const paintText = (): TextOptions =>
  (painted ??= { font: paintedFont(FONT_3x5) });

/** Modulo that is never negative. */
function mod(a: number, n: number): number {
  return ((a % n) + n) % n;
}

/**
 * The era's colours for the structures, before the light: cream paint, timber, the club's
 * colour faded a touch by the years, iron.
 */
export const RETRO = {
  cream: mix(P.chalk, P.retroLight, 0.35),
  creamLit: P.chalk,
  creamShade: mix(P.mist, P.retroLight, 0.45),
  timber: P.wood,
  timberDark: P.woodDark,
  timberLit: mix(P.wood, P.retroLight, 0.35),
  club: mix(P.home, P.brick, 0.3),
  clubDark: mix(P.homeDark, P.brickDark, 0.35),
  clubLight: mix(P.homeLight, P.brickLight, 0.35),
  iron: mix(P.slate, P.grassDeep, 0.35),
  ironLit: mix(P.steel, P.grassDark, 0.3),
  ironDark: mix(P.night, P.grassDeep, 0.2),
  tin: mix(P.steel, P.wood, 0.18),
  tinLit: mix(P.mist, P.retroLight, 0.25),
  tinDark: mix(P.slate, P.woodDark, 0.25),
  cinder: mix(P.concreteDark, P.woodDark, 0.45),
  cinderLit: mix(P.concrete, P.wood, 0.4),
  bulb: P.goldLight,
  bulbHot: P.white,
} as const;

/** The stand's painted trim: the club's colour, its shade and its light. */
export interface Trim {
  club: Color;
  clubDark: Color;
  clubLight: Color;
}

const GOLD_TRIM: Trim = {
  club: P.retro,
  clubDark: P.retroDark,
  clubLight: P.retroLight,
};
const BRICK_TRIM: Trim = {
  club: P.brick,
  clubDark: P.brickDark,
  clubLight: P.brickLight,
};

/**
 * The trim follows the crowd (paint.ts `crowdColors`): his club's old gold to tier 4, the
 * nation's brick red from tier 5.
 */
export function trimFor(tier: number): Trim {
  return tier >= 5 ? BRICK_TRIM : GOLD_TRIM;
}

// ---------------------------------------------------------------------------
// The grandstand
// ---------------------------------------------------------------------------

/** Rows the pediment over the middle of the roof rises above its top. */
const GABLE_H = 26;
/** Its half width. */
const GABLE_HALF = 40;

/**
 * A surface that draws nothing and only notes the lowest point a mover draws at: where a
 * column of smoke starts (`x`, `y`). Used once per build.
 */
class SmokeProbe extends Surface {
  found = false;
  x = 0;
  y = 0;
  constructor() {
    super(1, 1);
  }
  reset(): void {
    this.found = false;
    this.y = -1e9;
  }
  private note(x: number, y: number): void {
    if (!this.found || y > this.y) {
      this.found = true;
      this.x = Math.round(x);
      this.y = Math.round(y);
    }
  }
  override px(x: number, y: number): void {
    this.note(x, y);
  }
  override hline(x: number, y: number): void {
    this.note(x, y);
  }
  override rect(x: number, y: number, _w: number, h: number): void {
    this.note(x, y + h - 1);
  }
  override disc(cx: number, cy: number, r: number): void {
    this.note(cx, cy + r);
  }
}

/** Where the pediment stands: over the middle of the far stand on the stage. */
function gableX(p: Paint): number {
  return sx(p.g, -14);
}

export function paintRetroStadium(s: Surface, p: Paint, life: Life): void {
  const { g, S, E } = p;
  const F = g.F;
  const st = STAND;
  // the side stand stops at the corner, level with the goal line, as today's does
  const corner = Math.min(g.w, endFor(g).corner);

  // the town's chimneys hidden behind the grandstand and its pediment send up no smoke;
  // the mills' great stacks (the street's movers, all made before this) stand behind the
  // stadium, so their smoke rises behind it, in the sky, and never over the stands
  // (nor any whose smoke would first show over the pediment or its flag, so that neither
  // seems to smoke: the box from the flag's top down, over the pediment's width)
  const hidden = F - st.roofTop - GABLE_H - 4;
  const gx = gableX(p);
  const gable = (x: number, y: number): boolean =>
    Math.abs(x - gx) <= GABLE_HALF + 4 && y > F - st.roofTop - GABLE_H - 24;
  life.smoke = life.smoke.filter(
    (c) => c.x >= corner || (c.y + 6 < hidden && !gable(c.x, c.y + 6)),
  );
  // A column whose foot is hidden behind the pediment would rise out of its flag: such a
  // mover is found on its first frame (once the whole layer is painted, so the street's
  // own checks of which chimneys show see the stands) by drawing it into a probe that only
  // notes where its smoke starts, and then never drawn.
  const probe = new SmokeProbe();
  for (let i = 0; i < life.movers.length; i++) {
    const m = life.movers[i];
    const far = m.far;
    if (!far || m.sky) continue;
    let state = 0; // 0 not yet probed, 1 drawn, 2 hidden behind the pediment
    life.movers[i] = {
      sky: (o: Surface, t: number) => {
        if (state === 0) {
          probe.reset();
          for (let k = 0; k < 6; k++) far.call(m, probe, k * 0.37);
          const behind =
            probe.found && probe.x < corner && gable(probe.x, probe.y);
          state = behind ? 2 : 1;
        }
        if (state === 1) far.call(m, o, t);
      },
    };
  }
  grandstand(s, p, life, 0, corner);
  // the stand's end: a brick wall, lit on the left, a stair's slit windows
  const endH = st.roofTop - st.boards;
  const wy = F - st.roofTop;
  s.rect(corner - 4, wy, 4, endH, S(P.brick));
  s.vline(corner - 4, wy, endH, S(P.brickLight));
  s.vline(corner - 1, wy, endH, S(P.brickDark));
  for (let y = wy + 4; y < F - 16; y += 6) {
    s.px(corner - 3, y, S(P.brickDark));
    s.px(corner - 2, y + 3, S(P.brickDark));
  }
  for (let y = wy + 20; y < F - 24; y += 18) {
    s.vline(corner - 3, y, 5, p.lamps ? P.goldDark : S(P.night));
  }
  // a pigeon on the roof, and one on the pediment
  life.perched.push({ x: sx(g, -40), y: F - st.roofTop - 4 });
  life.perchColor = E(P.steel);

  paintHoardings(s, p, corner);
  if (p.tier >= 5) dressForTheCup(s, p, life, corner);
  if (p.tier >= 6) {
    life.flashes = 6;
    const y = F - st.lowerTop + 4;
    const [a, b] = crowdColors(p, false);
    life.giant.push({
      x0: 0,
      x1: corner,
      y,
      w: 60,
      h: 18,
      a: S(a),
      b: S(b),
      speed: 8,
      phase: 0.45,
    });
    // searchlights: drums on the roof beside the lamp standards' feet, and one on the end's
    // roof (retro-end.ts draws that drum, over the end)
    const top = F - st.roofTop;
    const bx = sx(g, 80);
    for (const x of [sx(g, -96) - 16, corner - 10]) {
      searchlightDrum(s, p, x, top - 3);
      life.beams.push({ x, y: top - 12 });
    }
    life.beams.push({ x: bx, y: endRoofAt(g, bx) - 9 });
    life.beamColor = P.chalk;
  }
  if (p.tier >= 7) {
    life.movers.push(
      retroFireworks(
        12,
        Math.max(8, F - st.roofTop - 100),
        Math.max(1, g.w - 24),
        60,
        p.seed,
      ),
    );
  }
}

/** The grandstand from column x0 to x1 (the far side, up to the corner). */
function grandstand(
  s: Surface,
  p: Paint,
  life: Life,
  x0: number,
  x1: number,
): void {
  const { g, S } = p;
  const F = g.F;
  const st = STAND;
  const w = x1 - x0;
  if (w <= 0) return;
  const top = F - st.roofTop;
  const R = RETRO;

  // the lamp standards behind the roof first, so the roof stands in front of their feet
  lampStandard(s, p, sx(g, -96), top);
  lampStandard(s, p, x1 - 36, top);

  // the roof's slope: corrugated iron rising back from the fascia (4 rows)
  for (let y = top - 4; y < top; y++) {
    const d = top - y;
    for (let x = x0; x < x1; x++) {
      const rib = mod(x - g.cx, 4);
      const c = rib === 0 ? R.tinLit : rib === 3 ? R.tinDark : R.tin;
      s.px(x, y, S(d === 4 ? R.tinDark : c));
    }
  }
  // under the roof: dark, the iron trusses' lattice against it
  s.rect(x0, F - st.upperTop - 4, w, 4, S(P.ink));
  // the upper tier: wooden benches, six rows of fans, the back in the roof's shadow
  const bench = S(mix(R.timberDark, P.night, 0.35));
  s.rect(x0, F - st.upperTop, w, st.upperTop - st.balcony, bench);
  const upper = { x0, x1, y: F - st.upperTop, rows: 4, seat: bench };
  fanBlock(s, p, life, { ...upper, empty: 0.03, shadowRows: 2 });
  // the front two rows, round the band's seats from tier 5
  const front = { ...upper, y: F - st.upperTop + 32, rows: 2 };
  const bx = p.tier >= 5 ? bandX(p) : x1;
  fanBlock(s, p, life, { ...front, x1: bx - 1, empty: 0.03, shadowRows: 0 });
  if (bx < x1) {
    fanBlock(s, p, life, {
      ...front,
      x0: bx - 1 + BAND_W,
      empty: 0.03,
      shadowRows: 0,
    });
  }
  woodenAisles(s, p, x0, x1, F - st.upperTop + 8, F - st.balcony);
  if (bx < x1) brassBand(s, p, life, bx, F - st.balcony - 16);

  // the cast-iron columns holding the roof up, through the upper tier to the balcony
  const colTop = F - st.upperTop - 4;
  for (let x = g.cx + mod(x0 - g.cx, 64) - 64 + 30; x < x1 - 6; x += 64) {
    if (x < x0 + 2) continue;
    column(s, p, x, colTop, F - st.balcony);
  }

  // the fascia: a lit edge, cream boards and their seams, the club stripe, its shade
  s.rect(x0, top, w, 12, S(R.cream));
  s.hline(x0, top, w, S(R.creamLit));
  for (let x = g.cx + mod(x0 - g.cx, 12) - 12; x < x1; x += 12) {
    s.vline(x, top + 1, 5, S(R.creamShade));
  }
  const T = trimFor(p.tier);
  s.rect(x0, top + 6, w, 2, S(T.club));
  s.hline(x0, top + 8, w, S(T.clubDark));
  s.hline(x0, top + 9, w, S(R.cream));
  s.hline(x0, top + 10, w, S(R.creamShade));
  s.hline(x0, top + 11, w, S(R.timberDark));
  // the dagger board hanging under it: pointed pickets over the dark
  for (let x = x0; x < x1; x++) {
    const k = mod(x - g.cx, 6);
    s.px(x, top + 12, S(k === 5 ? R.creamShade : R.cream));
    if (k >= 1 && k <= 4)
      s.px(x, top + 13, S(k === 4 ? R.creamShade : R.cream));
    if (k === 2 || k === 3)
      s.px(x, top + 14, S(k === 3 ? R.creamShade : R.cream));
  }
  if (p.flood) {
    // the roof's glow against the night, and bare bulbs on flexes under the dagger board
    s.dither(x0, top - 16, w, 12, P.nightGlow, 0.18);
    s.dither(x0, top - 6, w, 2, P.nightGlow, 0.4);
    for (let x = g.cx + mod(x0 - g.cx, 14) - 14 + 7; x < x1; x += 14) {
      s.px(x, top + 15, S(P.ink));
      s.px(x, top + 16, R.bulb);
      s.px(x + 1, top + 16, R.bulbHot);
      s.px(x, top + 17, R.bulb);
      s.px(x + 1, top + 17, R.bulb);
      s.px(x - 1, top + 17, P.goldDark);
      s.px(x + 2, top + 16, P.goldDark);
    }
  }

  pediment(s, p, life, gableX(p), top);
  // on a phone the end's roof is off the canvas: its scoreboard stands on this roof
  const sb = standScoreboardX(p);
  if (sb !== null) handScoreboard(s, p, sb, () => top - 4);

  // the balcony: a cream rail, a criss-cross lattice in the club's colour, a lower rail
  balcony(s, p, x0, x1, F - st.balcony);

  // the paddock: a standing terrace of cinders and timber, iron barriers across it
  const tread = S(R.cinder);
  s.rect(x0, F - st.lowerTop, w, st.lowerTop - st.boards, tread);
  fanBlock(s, p, life, {
    x0,
    x1,
    y: F - st.lowerTop,
    rows: 6,
    seat: tread,
    empty: 0.04,
    shadowRows: 0,
  });
  for (const h of [st.lowerTop - 17, st.lowerTop - 33]) {
    barrier(s, p, x0, x1, F - h);
  }
  // the brick wall along its front
  s.hline(x0, F - 16, w, S(P.brickLight));
  s.hline(x0, F - 15, w, S(P.brick));

  newsreel(s, p, life, gableX(p) - 22, F - st.balcony - 6, top + 16);
}

/**
 * A lamp standard rising behind the roof (`x` its left, as the pylons of today's stand
 * were): a cast-iron pole with collars and a ball finial, two cross-arms on curly
 * brackets, eight bare bulbs hung from them on flexes (lit at night, with a stepped
 * halo; plain glass by day). The early game's floodlights, not today's lattice pylons.
 */
function lampStandard(s: Surface, p: Paint, x: number, roofTop: number): void {
  const { E } = p;
  const cx = x + 6;
  const top = roofTop - 50;
  const lit = E(RETRO.ironLit);
  const iron = E(RETRO.iron);
  const dark = E(RETRO.ironDark);
  // the halo first, so the iron and the bulbs sit in it
  // (round stepped bands round the bulbs, never a box)
  if (p.flood) {
    s.disc(cx + 0.5, top + 8.5, 15.5, P.nightGlow, 0.25);
    s.disc(cx + 0.5, top + 8.5, 11.5, P.nightGlow, 0.5);
    s.disc(cx + 0.5, top + 8.5, 8.5, P.goldDark, 0.18);
  }
  // the pole: lit on the left, collars every 12 rows, a wider foot behind the roof
  s.vline(cx - 1, top + 4, roofTop - top - 4, lit);
  s.vline(cx, top + 1, roofTop - top - 1, iron);
  s.vline(cx + 1, top + 1, roofTop - top - 1, dark);
  for (let y = top + 20; y < roofTop - 2; y += 12) {
    s.hline(cx - 2, y, 5, dark);
    s.hline(cx - 2, y - 1, 2, lit);
  }
  s.rect(cx - 1, roofTop - 6, 4, 6, iron);
  s.vline(cx - 1, roofTop - 6, 6, lit);
  // the finial
  s.hline(cx, top - 1, 2, lit);
  s.px(cx, top - 2, lit);
  s.px(cx + 1, top - 2, iron);
  s.hline(cx, top, 2, dark);
  // two cross-arms, each on a curly bracket under it, four bulbs on flexes
  for (let k = 0; k < 2; k++) {
    const ay = top + 3 + k * 8;
    const half = 8 - k;
    s.hline(cx - half, ay, half * 2 + 2, lit);
    s.hline(cx - half, ay + 1, half * 2 + 2, dark);
    for (let i = 1; i < 4; i++) {
      s.px(cx - i, ay + 1 + i, iron);
      s.px(cx + 1 + i, ay + 1 + i, dark);
    }
    for (let i = 0; i < 4; i++) {
      const bx = cx - half + 1 + i * Math.round((half * 2 - 2) / 3);
      const by = ay + 2;
      s.px(bx, by, dark);
      if (p.flood) {
        s.px(bx, by + 1, RETRO.bulbHot);
        s.px(bx + 1, by + 1, RETRO.bulb);
        s.px(bx, by + 2, RETRO.bulb);
        s.px(bx + 1, by + 2, P.gold);
      } else {
        s.px(bx, by + 1, E(P.steelHi));
        s.px(bx + 1, by + 1, E(P.mist));
        s.px(bx, by + 2, E(P.mist));
        s.px(bx + 1, by + 2, E(P.steel));
      }
    }
  }
}

/**
 * A searchlight of the day on the roof: a drum on a yoke on a turntable, its lens up,
 * standing on row `foot` with its middle at `x` (the beam leaves its lens at `foot - 9`).
 */
export function searchlightDrum(
  s: Surface,
  p: Paint,
  x: number,
  foot: number,
): void {
  const { S } = p;
  const lit = S(RETRO.ironLit);
  const iron = S(RETRO.iron);
  const dark = S(RETRO.ironDark);
  // the turntable and the yoke's arms
  s.hline(x - 4, foot - 1, 10, lit);
  s.hline(x - 4, foot, 10, dark);
  s.vline(x - 4, foot - 6, 5, lit);
  s.vline(x + 5, foot - 6, 5, dark);
  // the drum: lit on the left, a band round it, the lens on top
  s.rect(x - 2, foot - 9, 6, 7, iron);
  s.vline(x - 2, foot - 9, 7, lit);
  s.vline(x + 3, foot - 9, 7, dark);
  s.hline(x - 2, foot - 5, 6, dark);
  s.px(x - 3, foot - 6, lit);
  s.px(x + 4, foot - 6, dark);
  s.hline(x - 2, foot - 10, 6, P.chalk);
  s.hline(x - 1, foot - 10, 4, P.white);
}

/** A cast-iron column 2 px wide with a bracket under the roof and a foot. */
function column(
  s: Surface,
  p: Paint,
  x: number,
  top: number,
  foot: number,
): void {
  const { S } = p;
  s.vline(x, top, foot - top, S(RETRO.ironLit));
  s.vline(x + 1, top, foot - top, S(RETRO.iron));
  // the bracket: two little arms out under the roof's beam
  for (let k = 0; k < 4; k++) {
    s.px(x - 1 - k, top + 3 - k, S(RETRO.ironLit));
    s.px(x + 2 + k, top + 3 - k, S(RETRO.iron));
  }
  s.hline(x - 1, top + 4, 4, S(RETRO.iron));
  // the foot on the balcony rail
  s.hline(x - 1, foot - 2, 4, S(RETRO.ironDark));
  s.hline(x - 1, foot - 1, 4, S(RETRO.ironDark));
}

/** Wooden steps cutting the upper tier into sections every 96 px. */
function woodenAisles(
  s: Surface,
  p: Paint,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
): void {
  const { S, g } = p;
  const nose = S(RETRO.timberLit);
  const tread = S(RETRO.timber);
  const riser = S(RETRO.timberDark);
  for (let x = g.cx + mod(x0 - g.cx, 96) - 96; x < x1; x += 96) {
    if (x < x0 + 6 || x > x1 - 10) continue;
    for (let y = y0; y < y1; y++) {
      const k = (y - y0) & 3;
      s.hline(x, y, 4, k === 0 ? nose : k === 1 ? tread : riser);
      s.px(x + 3, y, riser);
    }
  }
}

/** The balcony at row `by` (its rail) down 16 rows to the paddock's back. */
function balcony(
  s: Surface,
  p: Paint,
  x0: number,
  x1: number,
  by: number,
): void {
  const { S, g } = p;
  const R = RETRO;
  const w = x1 - x0;
  // the top rail: lit, cream, its shade
  s.hline(x0, by, w, S(R.creamLit));
  s.hline(x0, by + 1, w, S(R.cream));
  s.hline(x0, by + 2, w, S(R.creamShade));
  // the lattice: two diagonals in the club's colour on the dark behind it
  const back = S(P.ink);
  const T = trimFor(p.tier);
  const a = S(T.club);
  const b = S(T.clubDark);
  const hi = S(T.clubLight);
  for (let y = by + 3; y < by + 13; y++) {
    for (let x = x0; x < x1; x++) {
      const u = mod(x - g.cx + (y - by), 8);
      const v = mod(x - g.cx - (y - by), 8);
      s.px(x, y, u === 0 ? hi : u === 1 ? a : v === 0 ? b : back);
    }
  }
  // the stiles between the panels, every 32 px
  for (let x = g.cx + mod(x0 - g.cx, 32) - 32 + 4; x < x1; x += 32) {
    if (x < x0) continue;
    s.vline(x, by + 3, 10, S(R.cream));
    s.vline(x + 1, by + 3, 10, S(R.creamShade));
  }
  // the lower rail and its shadow on the paddock
  s.hline(x0, by + 13, w, S(R.cream));
  s.hline(x0, by + 14, w, S(R.timberDark));
  s.hline(x0, by + 15, w, S(P.ink));
}

/** A crush barrier across the paddock at row y: a lit iron rail on posts, with gaps. */
function barrier(
  s: Surface,
  p: Paint,
  x0: number,
  x1: number,
  y: number,
): void {
  const { S, g } = p;
  const hi = S(RETRO.ironLit);
  const lo = S(RETRO.ironDark);
  for (let x = x0; x < x1; x++) {
    const k = mod(x - g.cx + Math.round(y * 0.7), 40);
    if (k >= 34) continue;
    s.px(x, y, hi);
    s.px(x, y + 1, lo);
    if (k === 0 || k === 33 || k === 17) s.vline(x, y + 2, 4, lo);
  }
}

/**
 * The pediment over the middle of the roof: a cream gable with a lit and a shaded slope,
 * a timber trim, a clock (a quarter past two: half an hour to kick off), a finial and the
 * club's flag on top.
 */
function pediment(
  s: Surface,
  p: Paint,
  life: Life,
  cx: number,
  top: number,
): void {
  const { S } = p;
  const R = RETRO;
  const H = GABLE_H;
  const half = GABLE_HALF;
  for (let r = 0; r < H; r++) {
    const y = top - H + r;
    const hw = Math.round((half * (r + 1)) / H);
    for (let x = cx - hw; x <= cx + hw; x++) {
      const edge = hw - Math.abs(x - cx);
      let c: Color;
      if (edge < 2) c = x < cx ? R.creamLit : R.timberDark;
      else if (edge < 4) c = R.timber;
      else c = x < cx ? R.cream : mix(R.cream, R.creamShade, 0.5);
      s.px(x, y, S(c));
    }
  }
  // the cornice along its foot
  s.hline(cx - half - 2, top - 2, half * 2 + 5, S(R.creamLit));
  s.hline(cx - half - 2, top - 1, half * 2 + 5, S(R.timberDark));
  // the clock: a timber ring, a cream face, hands at a quarter past two
  const cy = top - 11;
  s.disc(cx, cy, 7, S(R.timberDark));
  s.disc(cx, cy, 6, S(R.timber));
  s.disc(cx, cy, 5, S(P.chalk));
  s.px(cx - 1, cy - 1, S(P.white));
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    s.px(
      Math.round(cx + Math.sin(a) * 4.4),
      Math.round(cy - Math.cos(a) * 4.4),
      S(k % 3 === 0 ? P.ink : P.mist),
    );
  }
  s.vline(cx, cy - 3, 4, S(P.ink));
  s.hline(cx, cy, 3, S(P.ink));
  s.px(cx + 1, cy - 1, S(P.ink));
  // the finial and the flag on its pole
  s.vline(cx, top - H - 2, 3, S(R.timberDark));
  const [a, b] = crowdColors(p, false);
  life.flags.push({
    x: cx,
    top: top - H - 20,
    poleH: 18,
    w: 14,
    h: 9,
    a: S(a),
    b: S(b),
    pole: S(R.timber),
    phase: 1,
  });
  life.perched.push({ x: cx - half + 6, y: top - 6 });
}

/**
 * A newsreel cameraman, side on, cranking a wooden box camera on a tripod, pointing
 * right. 16 x 14, standing on the row under it. The crank's handle is a mover's.
 *
 * h his flat cap, H its peak, s skin, z skin's shade, j jacket, J its lit side, p trousers,
 * e boots, k the camera's box, K its lit top, m the film magazines, l the lens, L its glint,
 * c the crank's axle, t the tripod.
 */
const CAMERAMAN = lazy(() =>
  sprite(
    `
    ..hhh.........mm
    .hhhhHH.....mmmm
    ..hzs....KKKKKmm
    ..zss...kkkkkkkL
    ..Jjjjjjkkkkkkkl
    .JJjjj..ckkkkkkl
    .JJjjj...kkkkk..
    .Jjjjj....tKt...
    ..jjjj....t.t...
    ..pp.p...t..t...
    ..pp.p...t...t..
    ..pp..p..t...t..
    ..pp..p.t.....t.
    .eee..ee.t....t.
    `,
    "hHszjJpekKmlLct",
  ),
);

/** The press box's width. */
const BOX_W = 44;

/**
 * The newsreel's press box hung under the roof in front of the upper tier: a timber floor
 * and rail, a cream back wall under a little tin roof (so the men read against it), two
 * cameramen cranking away.
 */
function newsreel(
  s: Surface,
  p: Paint,
  life: Life,
  gx: number,
  gy: number,
  strutTop: number,
): void {
  const { S } = p;
  const R = RETRO;
  const W = BOX_W;
  // two iron rods down from the roof
  for (const cx of [gx + 4, gx + W - 6]) {
    s.vline(cx, strutTop, gy - strutTop, S(R.ironLit));
    s.vline(cx + 1, strutTop, gy - strutTop, S(R.iron));
  }
  // the back wall: cream boards, their seams, a shadow under the roof
  const wy = gy - 19;
  s.rect(gx + 1, wy, W - 2, 19, S(R.cream));
  for (let x = gx + 4; x < gx + W - 2; x += 5)
    s.vline(x, wy + 2, 17, S(R.creamShade));
  s.hline(gx + 1, wy + 2, W - 2, S(R.creamShade));
  // its tin roof, lit on top
  s.hline(gx - 1, wy - 1, W + 2, S(R.tinLit));
  s.hline(gx - 1, wy, W + 2, S(R.tin));
  s.hline(gx, wy + 1, W, S(R.tinDark));
  const sp = CAMERAMAN();
  const cols = colorsFor(sp, {
    h: S(mix(P.slate, P.woodDark, 0.4)),
    H: S(P.night),
    s: S(P.skinA),
    z: S(P.skinAShade),
    j: S(P.woodDark),
    J: S(P.wood),
    p: S(P.slate),
    e: S(P.ink),
    k: S(P.ink),
    K: S(P.slate),
    m: S(P.night),
    l: S(P.ink),
    L: S(P.steelHi),
    c: S(P.steelHi),
    t: S(R.timberDark),
  });
  const ys = gy - sp.h;
  drawSprite(s, sp, 0, gx + 6, ys, cols);
  drawSprite(s, sp, 0, gx + 23, ys, cols);
  // the floor: planks; the rail in front of their legs
  s.hline(gx, gy, W, S(R.timberLit));
  s.rect(gx, gy + 1, W, 2, S(R.timber));
  s.hline(gx, gy + 3, W, S(R.timberDark));
  s.hline(gx, gy - 7, W, S(R.timberLit));
  s.hline(gx, gy - 6, W, S(R.timberDark));
  for (let x = gx; x < gx + W; x += 11) s.vline(x, gy - 5, 5, S(R.timber));
  s.vline(gx + W - 1, gy - 5, 5, S(R.timber));
  // the cranks turn: an arm and its knob round the axle, four steps, each man on his own
  // beat (the knob white, so the turning shows at 1x)
  const lit = S(P.steelHi);
  const knob = S(P.white);
  const ax = [gx + 6 + 8, gx + 23 + 8];
  const ay = ys + 5;
  // the arm's middle and its knob for each step, from the axle
  const ARM = [-1, -1, -1, 0, -1, 1, 0, 1];
  const KNOB = [-2, -2, -3, 0, -2, 2, -1, 0];
  life.movers.push({
    far(o: Surface, t: number): void {
      for (let i = 0; i < 2; i++) {
        const k = ((Math.floor(t * 8) + i * 2) & 3) * 2;
        o.px(ax[i] + ARM[k], ay + ARM[k + 1], lit);
        o.px(ax[i] + KNOB[k], ay + KNOB[k + 1], knob);
      }
    },
  });
}

// ---------------------------------------------------------------------------
// The hand-turned scoreboard (on the end's roof, or the grandstand's on a phone)
// ---------------------------------------------------------------------------

/** The scoreboard's width. */
const SCORE_W = 40;

/**
 * Where the scoreboard on the end's roof stands (its left column), or null where the end's
 * roof is off the canvas (a phone): there it stands on the grandstand's roof instead
 * (`standScoreboardX`).
 */
export function endScoreboardX(g: Geo): number | null {
  const e = endFor(g);
  // the end's roof starts `lean * 140` (its top) right of its foot
  const x = Math.round(e.xA + e.lean * 140) + 16;
  return x + SCORE_W > g.w - 2 ? null : x;
}

/** Where it stands on the grandstand's roof, left of the pediment, or null. */
export function standScoreboardX(p: Paint): number | null {
  if (endScoreboardX(p.g) !== null) return null;
  // its ladder on its right, clear of the pediment's cornice
  const x = gableX(p) - GABLE_HALF - 2 - 6 - SCORE_W;
  return x >= 1 ? x : null;
}

/**
 * A hand-turned scoreboard standing on a roof from column `x` (`roofAt` the roof's row in
 * a column): a timber board on two legs, HOME and AWAY plates as painted numbers (the
 * labels have none; its digits are a plain scoreline), a boy on the ladder at its side
 * hanging a number.
 */
export function handScoreboard(
  s: Surface,
  p: Paint,
  x: number,
  roofAt: (x: number) => number,
): void {
  const { S } = p;
  const R = RETRO;
  const T = trimFor(p.tier);
  const W = SCORE_W;
  const roof = roofAt(x + W - 6);
  const H = 24;
  const top = roof - H - 6;
  // the legs down to the roof, braced
  for (let i = 0; i < 2; i++) {
    const lx = x + 6 + i * (W - 14);
    const foot = roofAt(lx);
    s.vline(lx, top + H, foot - top - H + 1, S(R.timberDark));
    s.vline(lx + 1, top + H, foot - top - H + 1, S(R.timber));
  }
  // the board: a frame, two dark panels for the plates, a cream header band
  s.rect(x, top, W, H, S(R.timberDark));
  s.hline(x, top, W, S(R.timberLit));
  s.vline(x, top, H, S(R.timberLit));
  s.rect(x + 2, top + 2, W - 4, 4, S(R.cream));
  s.hline(x + 2, top + 5, W - 4, S(R.creamShade));
  for (let k = 0; k < 4; k++) s.px(x + 6 + k * 9, top + 3, S(T.club));
  const plate = (px: number, digit: string): void => {
    s.rect(px, top + 8, 9, 13, S(P.night));
    s.rect(px + 1, top + 9, 7, 11, S(P.chalk));
    s.hline(px + 1, top + 19, 7, S(P.mist));
    drawText(s, digit, px + 3, top + 12, S(P.ink), { font: FONT_3x5 });
  };
  plate(x + 6, "2");
  plate(x + 25, "1");
  // a dash between the two scores
  s.hline(x + 18, top + 14, 4, S(P.chalk));
  s.hline(x + 18, top + 15, 4, S(R.creamShade));
  // the boy on the ladder at its right, cap and jersey, a number plate in his hand
  const lx = x + W + 2;
  for (let y = top + 4; y < roof; y += 3) s.hline(lx, y, 4, S(R.timberLit));
  s.vline(lx, top + 2, roof - top - 2, S(R.timber));
  s.vline(lx + 3, top + 2, roof - top - 2, S(R.timberDark));
  const by = top + 8;
  s.hline(lx, by - 1, 3, S(P.night));
  s.px(lx - 1, by - 1, S(P.night));
  s.rect(lx, by, 3, 2, S(P.skinA));
  s.rect(lx, by + 2, 3, 4, S(T.club));
  s.rect(lx - 3, by + 2, 3, 4, S(P.chalk));
  s.vline(lx, by + 6, 3, S(P.slate));
  s.vline(lx + 2, by + 6, 3, S(P.slate));
}

// ---------------------------------------------------------------------------
// Painted hoardings along the far touchline
// ---------------------------------------------------------------------------

interface Look {
  bg: Color;
  fg: Color;
}

/** The hoardings' looks: enamel and paint of the day, the club's in the stand's trim. */
const HOARDINGS_GOLD: readonly Look[] = [
  { bg: RETRO.cream, fg: P.retroDark },
  { bg: P.retro, fg: P.night },
  { bg: P.grassDeep, fg: RETRO.cream },
  { bg: P.woodDark, fg: P.gold },
  { bg: P.retroLight, fg: P.ink },
  { bg: P.night, fg: P.retroLight },
];
const HOARDINGS_BRICK: readonly Look[] = [
  { bg: RETRO.cream, fg: P.brickDark },
  { bg: P.brick, fg: P.chalk },
  { bg: P.grassDeep, fg: RETRO.cream },
  { bg: P.woodDark, fg: P.gold },
  { bg: P.retroLight, fg: P.ink },
  { bg: P.night, fg: P.retroLight },
];

/** The far side's hoardings at a tier. */
export function hoardingsFor(tier: number): readonly Look[] {
  return tier >= 5 ? HOARDINGS_BRICK : HOARDINGS_GOLD;
}

/**
 * Painted boards on a timber rail, each its own panel: the labels in the painted font (or a
 * painted band without them), plank seams, a post between two boards, weathered specks.
 */
function paintHoardings(s: Surface, p: Paint, x1: number): void {
  const { g, S } = p;
  const bh = STAND.boards;
  const y = g.F - bh;
  const words = (p.labels.boards ?? []).map((w) => w.toUpperCase());
  const parts = words.length > 0 ? words : ["", "", ""];
  let x = mod(g.cx - 40, 2) - 30;
  for (let i = 0; x < x1; i++) {
    const word = parts[i % parts.length];
    let bw = Math.max(80, (word ? measureText(word, paintText()) : 0) + 24);
    bw += bw & 1;
    const looks = hoardingsFor(p.tier);
    const look = looks[i % looks.length];
    const bg = S(look.bg);
    const fg = S(look.fg);
    const lo = S(shade(look.bg, -0.18));
    const hi = S(shade(look.bg, 0.12));
    s.rect(x, y, bw, bh, bg);
    s.hline(x, y, bw, S(RETRO.timberDark));
    s.hline(x, y + 1, bw, hi);
    s.hline(x, y + bh - 2, bw, lo);
    s.hline(x, y + bh - 1, bw, S(P.ink));
    // the planks' seams, faint, where the words leave room
    for (let k = 4; k < bw - 2; k += 3) {
      if (hash2(x + k, y, p.seed + 61) < 0.35) s.px(x + k, y + 3, lo);
      if (hash2(x + k, y + 1, p.seed + 61) < 0.35) s.px(x + k, y + 11, lo);
    }
    if (word) {
      const tx = x + Math.floor((bw - measureText(word, paintText())) / 2);
      drawText(s, word, tx, y + 2, fg, paintText());
    } else {
      s.rect(x + 8, y + 5, bw - 16, 4, fg);
    }
    // the post between two boards
    s.vline(x + bw - 2, y, bh, S(RETRO.timber));
    s.vline(x + bw - 1, y, bh, S(RETRO.timberDark));
    x += bw;
  }
}

// ---------------------------------------------------------------------------
// Dressed for the cup (tiers 5 to 7): bunting, flags, banners and the band
// ---------------------------------------------------------------------------

/** Bunting colours, round and round: the club's, cream, gold, the nation's ink. */
function buntingColors(p: Paint): Color[] {
  const [a, b] = crowdColors(p, false);
  return [p.S(a), p.S(b), p.S(P.gold), p.S(P.brickDark), p.S(P.skyMid)];
}

/**
 * A string of bunting from x0 to x1 hanging from row `y`, sagging `sag` rows in the
 * middle of each `span`: little pennants 3 wide and 4 tall on a 5 px pitch.
 */
export function bunting(
  s: Surface,
  x0: number,
  x1: number,
  y: number,
  span: number,
  sag: number,
  colors: readonly Color[],
  line: Color,
  phase = 0,
): void {
  let n = phase;
  for (let x = x0; x < x1; x++) {
    const u = mod(x - x0, span) / span;
    const dy = Math.round(4 * sag * u * (1 - u));
    s.px(x, y + dy, line);
    if (mod(x - x0, 5) === 1) {
      const c = colors[mod(n++, colors.length)];
      const lo = shade(c, -0.25);
      s.hline(x, y + dy + 1, 3, c);
      s.hline(x, y + dy + 2, 3, c);
      s.px(x + 2, y + dy + 2, lo);
      s.px(x + 1, y + dy + 3, c);
      s.px(x + 1, y + dy + 4, lo);
    }
  }
}

function dressForTheCup(
  s: Surface,
  p: Paint,
  life: Life,
  corner: number,
): void {
  const { g, S } = p;
  const F = g.F;
  const st = STAND;
  const [a, b] = crowdColors(p, false);
  const top = F - st.roofTop;
  const gx = gableX(p);
  const sb = standScoreboardX(p);
  // flags along the roof, clear of the pediment and the pylons
  let n = 0;
  for (let x = 12; x < corner - 12; x += 52) {
    if (Math.abs(x - gx) < GABLE_HALF + 8) continue;
    // (the lamp standards, and the searchlights beside them from tier 6)
    const l = x - (sx(g, -96) + 6);
    const r = x - (corner - 30);
    if ((l > -40 && l < 14) || (r > -14 && r < 30)) continue;
    // (and the scoreboard, where it stands on this roof)
    if (sb !== null && x > sb - 8 && x < sb + SCORE_W + 10) continue;
    life.flags.push({
      x,
      top: top - 22,
      poleH: 18,
      w: 12,
      h: 8,
      a: S(n % 2 === 0 ? a : b),
      b: S(n % 2 === 0 ? b : a),
      pole: S(RETRO.timber),
      phase: n,
    });
    n++;
  }
  // bunting along the fascia, in swags under the dagger board, and down the pediment
  const cols = buntingColors(p);
  bunting(s, 0, corner, top + 16, 48, 6, cols, S(P.chalk));
  for (let i = 0; i < 2; i++) {
    const dir = i === 0 ? -1 : 1;
    let k = 0;
    for (let r = 2; r < GABLE_H - 2; r += 5) {
      const hw = Math.round((GABLE_HALF * (r + 1)) / GABLE_H);
      const x = gx + dir * hw;
      const y = top - GABLE_H + r;
      const c = cols[mod(k++ + i, cols.length)];
      s.hline(x - 1, y + 1, 3, c);
      s.px(x, y + 2, c);
    }
  }
  // banners hung over the balcony, the labels painted on them
  const words = (p.labels.banners ?? []).map((w) => w.toUpperCase());
  const by = F - st.balcony;
  const looks: readonly Look[] = [
    { bg: P.chalk, fg: P.brickDark },
    { bg: P.brick, fg: P.chalk },
    { bg: P.night, fg: P.gold },
  ];
  let x = sx(g, -60);
  for (let i = 0; x < corner - 24; i++) {
    const word = words.length > 0 ? words[i % words.length] : "";
    const bw = word ? measureText(word, paintText()) + 12 : 32;
    if (x + bw > corner - 8) break;
    clothBanner(s, p, x, by, bw, looks[i % looks.length], word);
    x += bw + 44;
  }
  // little flags waved in the paddock
  for (let k = 0; k < Math.round(g.w / 60); k++) {
    const fx = Math.floor(rnd(p, k, 50, 51) * g.w);
    if (fx > corner - 14) continue;
    const fy = F - st.lowerTop + 8 + 8 * Math.floor(rnd(p, k, 52, 51) * 4);
    life.flags.push({
      x: fx,
      top: fy - 10,
      poleH: 10,
      w: 8,
      h: 6,
      a: S(a),
      b: S(b),
      pole: S(P.woodDark),
      phase: k,
    });
  }
}

/** A painted cloth banner 16 px tall tied to the balcony rail. */
function clothBanner(
  s: Surface,
  p: Paint,
  x: number,
  y: number,
  bw: number,
  look: Look,
  word: string,
): void {
  const { S } = p;
  const bg = S(look.bg);
  const lo = S(shade(look.bg, -0.3));
  const hi = S(shade(look.bg, 0.15));
  s.rect(x, y, bw, 16, bg);
  s.hline(x, y, bw, hi);
  s.hline(x, y + 14, bw, lo);
  s.hline(x + 3, y + 15, bw - 6, lo);
  for (let k = 0; k < 4; k++) {
    s.px(x + 2 + (k >> 1), y + 2 + k, lo);
    s.px(x + bw - 3 - (k >> 1), y + 2 + k, lo);
  }
  s.px(x + 1, y - 1, S(P.chalk));
  s.px(x + bw - 2, y - 1, S(P.chalk));
  s.px(x + 1, y + 1, S(P.ink));
  s.px(x + bw - 2, y + 1, S(P.ink));
  if (word) drawText(s, word, x + 6, y + 3, S(look.fg), paintText());
  else s.rect(x + 4, y + 6, bw - 8, 4, S(look.fg));
}

/**
 * A bandsman in the stand, 6 x 8 like the fans around him: a white-topped peaked cap, a
 * red tunic with gold buttons, his instrument. Frames: cornet, tuba, trombone, the bass
 * drum's drummer, the bandmaster with his baton.
 *
 * c the cap's white top, k its peak and band, s skin, t tunic, T its lit side, B buttons,
 * g brass, G brass lit, d drum, D its rim.
 */
const BANDSMAN = lazy(() =>
  sprite(
    `
    .ccc..
    .kkk..
    .ss...
    TtsGGg
    TBTt..
    tTBt..
    tttt..
    .tt...

    .ccc..
    .kkkGG
    .ssGgG
    TtGggG
    TBgggg
    tTGgg.
    tttt..
    .tt...

    .ccc..
    .kkk..
    .ssGGg
    TtsG.g
    TBTGgg
    tTBt..
    tttt..
    .tt...

    .ccc..
    .kkk..
    .ss...
    TDDDD.
    TdddDs
    tdddD.
    tDDD..
    .tt...

    .ccc.G
    .kkk.g
    .ss.s.
    TtTs..
    TBTt..
    tTBt..
    tttt..
    .tt...
    `,
    "ckstTBgGdD",
  ),
);

/** The rows the band sits in: the upper tier's front two, from `bandX` for `BAND_W`. */
const BAND_W = 58;

/** Where the band sits in the upper tier (tiers 5 to 7): its left column. */
function bandX(p: Paint): number {
  // clear of the press box (newsreel) beside it on a narrow stage
  return Math.min(sx(p.g, -50), gableX(p) - 22 - BAND_W - 2);
}

/**
 * A brass band in the front two rows of the upper tier, from column x, its top row y:
 * eleven men in red tunics and white caps, their brass glinting in turn (a mover), the
 * bass drum in the middle of the front row and the bandmaster at its end.
 */
function brassBand(
  s: Surface,
  p: Paint,
  life: Life,
  x: number,
  y: number,
): void {
  const { S } = p;
  const sp = BANDSMAN();
  const tunic = trimFor(p.tier).club;
  const cols = colorsFor(sp, {
    c: S(P.chalk),
    k: S(P.ink),
    s: S(P.skinA),
    t: S(shade(tunic, -0.15)),
    T: S(shade(tunic, 0.1)),
    B: S(P.gold),
    g: S(P.goldDark),
    G: S(P.gold),
    d: S(P.chalk),
    D: S(trimFor(p.tier).clubDark),
  });
  const glintX = new Int16Array(12);
  const glintY = new Int16Array(12);
  let n = 0;
  // their platform, so they read as a band and not as more crowd: a cream-painted shell
  // behind them (boards and their seams) under a valance in the trim's colours, a lit
  // riser between the two rows, the platform's edge at their feet
  const T = trimFor(p.tier);
  const R = RETRO;
  s.rect(x - 1, y, BAND_W, 16, S(R.cream));
  for (let xx = x + 2; xx < x + BAND_W - 2; xx += 4)
    s.vline(xx, y + 3, 13, S(R.creamShade));
  s.hline(x - 1, y, BAND_W, S(T.clubDark));
  for (let i = 0; i < BAND_W; i++) {
    const c = S((i >> 1) & 1 ? T.club : R.cream);
    s.px(x - 1 + i, y + 1, c);
    if ((i & 3) !== 3)
      s.px(x - 1 + i, y + 2, (i >> 1) & 1 ? c : S(R.creamShade));
  }
  s.hline(x - 1, y + 8, BAND_W, S(R.timberLit));
  s.vline(x - 1, y, 16, S(R.timberDark));
  s.vline(x - 2 + BAND_W, y, 16, S(R.timberDark));
  for (let r = 0; r < 2; r++) {
    const yy = y + r * 8;
    const stagger = (r & 1) * 4;
    for (let i = 0; i < 6; i++) {
      const xx = x + stagger + i * 8;
      if (r === 1 && i === 5) break;
      const kind = r === 1 && i === 2 ? 3 : (i + r * 2) % 3;
      drawSprite(s, sp, kind, xx, yy, cols);
      if (kind !== 3 && n < 12) {
        glintX[n] = xx + (kind === 1 ? 4 : 4);
        glintY[n] = yy + (kind === 1 ? 1 : 3);
        n++;
      }
    }
  }
  // the bandmaster at the end of the front row, his baton up
  drawSprite(s, sp, 4, x + 4 + 5 * 8, y + 8, cols);
  const hot = P.goldLight;
  const white = P.white;
  const count = n;
  life.movers.push({
    far(o: Surface, t: number): void {
      // two horns catch the light at a time, a new pair three times a second: a white
      // point with a cross of hot gold round it
      const step = Math.floor(t * 3);
      for (let j = 0; j < 2; j++) {
        const k = (step * 5 + j * 7) % Math.max(1, count);
        const gx = glintX[k];
        const gy = glintY[k];
        o.px(gx, gy, white);
        o.px(gx - 1, gy, hot);
        o.px(gx + 1, gy, hot);
        o.px(gx, gy - 1, hot);
        o.px(gx, gy + 1, hot);
      }
    },
  });
}

// ---------------------------------------------------------------------------
// Fireworks of the era (tier 7): willows and stars over the roof
// ---------------------------------------------------------------------------

/** Burst colours of the day: gold, white, the club's red and a pale green star. */
const OLD_BURSTS: readonly Color[] = [
  P.gold,
  P.goldLight,
  P.chalk,
  P.homeLight,
  P.gold,
  P.retroLight,
];

/** The fainter colour each spark's tail fades to. */
const OLD_TAIL: ReadonlyMap<Color, Color> = new Map<Color, Color>([
  [P.gold, P.goldDark],
  [P.goldLight, P.gold],
  [P.chalk, P.retroLight],
  [P.homeLight, P.home],
  [P.retroLight, P.retro],
]);

/**
 * A mover of fireworks of the early days over the zone (x, y, w, h): a rocket on its
 * stick every 0.42 s, bursting into a willow of gold sparks that droop on long tails, a
 * crackle of white at its heart. Stepped at 12 a second; allocates nothing.
 */
export function retroFireworks(
  zx: number,
  zy: number,
  zw: number,
  zh: number,
  seed: number,
): { sky(s: Surface, t: number): void } {
  return {
    sky(s: Surface, t: number): void {
      drawOldBursts(s, t, zx, zy, zw, zh, seed, 0.42, 1.9, 1);
    },
  };
}

/**
 * Old-style bursts: rockets every `every` seconds living `life`, `scale` their size.
 * Shared by the tier 7 sky and (through career-fx) a goal's fireworks.
 */
export function drawOldBursts(
  s: Surface,
  t: number,
  zx: number,
  zy: number,
  zw: number,
  zh: number,
  seed: number,
  every: number,
  life: number,
  scale: number,
): void {
  const tt = Math.floor(t * 12) / 12;
  const newest = Math.floor(tt / every);
  for (let n = newest; n > newest - Math.ceil(life / every) - 1; n--) {
    const age = tt - n * every;
    if (age < 0 || age >= life) continue;
    const bx = zx + Math.floor(hash2(n, 1, seed) * zw);
    const by = zy + Math.floor(hash2(n, 2, seed) * zh);
    oldBurst(s, n, age, life, bx, by, seed, scale, 52);
  }
}

/** One rocket and its burst, `age` seconds after it went up. */
export function oldBurst(
  s: Surface,
  n: number,
  age: number,
  life: number,
  bx: number,
  by: number,
  seed: number,
  scale: number,
  climb: number,
  bold = false,
): void {
  const c =
    OLD_BURSTS[
      Math.floor(hash2(n, 3, seed) * OLD_BURSTS.length) % OLD_BURSTS.length
    ];
  const willow = hash2(n, 4, seed) < 0.6;
  const rise = 0.4;
  if (age < rise) {
    // the rocket going up on its stick, sparks spitting behind it
    const y = Math.round(by + (1 - age / rise) * climb);
    s.px(bx, y, P.goldLight);
    s.px(bx, y + 1, P.gold);
    s.px(bx, y + 2, P.amber);
    s.px(bx + 1, y + 3, P.woodDark);
    s.px(bx + 1, y + 4, P.woodDark);
    const wob = Math.floor(age * 24) & 1;
    s.px(bx - 1 + wob * 2, y + 5, P.amber);
    s.px(bx, y + 7, P.amberDim);
    return;
  }
  const a = (age - rise) / (life - rise);
  // bold (a goal's): the powder's smoke hangs where it burst, a grey puff that grows and
  // thins (it reads against a blue day sky, where sparks alone are faint)
  if (bold && a > 0.08) {
    const pr = 3 + a * 9 * scale;
    const dy = Math.round(-a * 4);
    s.disc(bx, by + dy, pr, P.steel, a < 0.6 ? 0.5 : 0.25);
    s.disc(bx - 1, by + dy - 1, pr * 0.6, P.mist, 0.25);
  }
  const spokes = willow ? 16 : 12;
  const rMax = (willow ? 22 : 16) * scale + hash2(n, 5, seed) * 8 * scale;
  const r = 3 + Math.sqrt(a) * rMax;
  // a willow droops hard as it goes; a star hangs
  const droop = (willow ? 26 : 10) * a * a * scale;
  const tail = willow ? (a < 0.7 ? 5 : 3) : a < 0.5 ? 2 : 0;
  const tailC = OLD_TAIL.get(c) ?? c;
  for (let k = 0; k < spokes; k++) {
    if (
      a > 0.55 &&
      hash2(n * 29 + k, Math.floor(age * 12), seed) < (a - 0.55) * 2
    ) {
      continue;
    }
    const ang = (k / spokes) * Math.PI * 2 + n * 0.7;
    const ca = Math.cos(ang);
    const sa = Math.sin(ang) * 0.85;
    for (let q = tail; q >= 1; q--) {
      const rr = r - q * 2;
      if (rr < 1) continue;
      // the tail hangs from the spark: it droops less the further back it is
      const dq = droop * (rr / Math.max(1, r)) * (rr / Math.max(1, r));
      s.px(
        Math.round(bx + ca * rr),
        Math.round(by + sa * rr + dq),
        q > 2 ? P.goldDark : tailC,
      );
    }
    const hx = Math.round(bx + ca * r);
    const hy = Math.round(by + sa * r + droop);
    s.px(hx, hy, c);
    if (a < 0.4) s.px(hx, hy + 1, tailC);
    // bold: a 2 px head on a burnt edge, so each spark stands out of a day sky
    if (bold) {
      s.px(hx + (ca < 0 ? -1 : 1), hy, c);
      s.px(hx, hy - 1, P.amberDim);
    }
  }
  // the crackle at its heart while it is young: white specks that wink
  if (a < 0.35) {
    for (let k = 0; k < 6; k++) {
      if (hash2(n, k + Math.floor(age * 12) * 7, seed) < 0.5) continue;
      const ox = Math.round((hash2(n, k + 40, seed) - 0.5) * r);
      const oy = Math.round((hash2(n, k + 50, seed) - 0.5) * r * 0.8);
      s.px(bx + ox, by + oy, P.white);
    }
  }
  if (a < 0.12) {
    s.px(bx, by, P.white);
    s.px(bx + 1, by, P.goldLight);
    s.px(bx, by + 1, P.goldLight);
  }
}

// ---------------------------------------------------------------------------
// Tier 7, in front of everything: torn paper and streamers (RETRO's ticker tape)
// ---------------------------------------------------------------------------

/** Scraps of newspaper and programme: newsprint, cream, a little pink of the racing pages. */
const PAPER: readonly Color[] = [P.chalk, RETRO.cream, P.white, P.retroLight];
const PAPER_LO: readonly Color[] = [P.mist, RETRO.creamShade, P.chalk, P.retro];
/** Paper streamers thrown from the stands: the club's colours and gold. */
const STREAMER: readonly Color[] = [P.brick, P.chalk, P.gold, P.brickLight];

/**
 * Torn paper over the whole canvas (about one scrap per 1300 px): scraps of newspaper 3 or
 * 4 px across with a line of print, tumbling through four frames as they fall at 14 to 30 px
 * a second; one in six is a paper streamer, a curling ribbon 1 px wide. Stepped at 10 a
 * second; allocates nothing.
 */
export function drawPaperTape(s: Surface, t: number, seed: number): void {
  const n = Math.round((s.w * s.h) / 1300);
  const tt = Math.floor(t * 10) / 10;
  const ink = P.steel;
  for (let i = 0; i < n; i++) {
    const x0 = hash2(i, 1, seed) * s.w;
    const speed = 14 + hash2(i, 2, seed) * 16;
    const y =
      Math.floor((hash2(i, 3, seed) * (s.h + 40) + tt * speed) % (s.h + 40)) -
      20;
    const sway = Math.round(Math.sin(tt * 1.6 + i) * 5);
    const x = Math.floor(x0) + sway;
    const turn = (Math.floor(tt * 4) + i) % 4;
    if (i % 6 === 0) {
      // a streamer: a ribbon curling as it falls
      const c = STREAMER[(i >> 1) % STREAMER.length];
      const lo = shade(c, -0.25);
      for (let k = 0; k < 9; k++) {
        const dx = Math.round(Math.sin((k + turn) * 0.9) * 2);
        s.px(x + dx, y - k, k % 3 === 2 ? lo : c);
      }
      continue;
    }
    const c = PAPER[i % PAPER.length];
    const d = PAPER_LO[i % PAPER.length];
    switch (turn) {
      case 0:
        // flat: a torn scrap with a line of print
        s.hline(x, y, 4, c);
        s.hline(x, y + 1, 4, c);
        s.hline(x + 1, y + 2, 3, d);
        s.hline(x + 1, y + 1, 2, ink);
        break;
      case 1:
        s.hline(x, y, 3, c);
        s.hline(x + 1, y + 1, 3, d);
        break;
      case 2:
        // edge on
        s.hline(x, y + 1, 4, d);
        break;
      default:
        s.hline(x + 1, y, 3, d);
        s.hline(x, y + 1, 3, c);
        s.px(x + 1, y + 1, ink);
    }
  }
}
