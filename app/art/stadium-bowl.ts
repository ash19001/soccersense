/**
 * The stadium itself, seen from the air: a pale roof ring over a packed bowl, a warm
 * red-orange wall on the near side, the pitch in the middle.
 *
 * It is drawn the way the camera sees it (see stadium-view.ts), pixel by pixel, from a plan:
 *
 *   the pitch            68 x 44 units either side of the centre spot
 *   the stand's foot     a rounded rectangle, 82 x 57
 *   the outer wall       a fat oval, 138 x 98, HR units tall
 *   the stand            rises from the foot (1.5 units) to the wall (HS units)
 *   the roof             a flat ring at HR over the outer half of the stand
 *
 * For every pixel the painter asks, from the top down: is this the roof? the outer wall
 * under it? and if it is the hole in the roof, where does the line of sight land: on the
 * stand (the crowd), on the boards at its foot, on the surround or on the pitch. So the
 * far stand shows whole, the near one hides behind its own roof, and the wall wraps the
 * near side, exactly as from a drone. Textures are indexed in plan (seat rows, roof bays,
 * mown stripes), so they follow the curve of the bowl.
 */

import { Surface, hash2, luma, shade, type Color } from "~/pixel";
import { P } from "~/art/palette";
import { DEFAULT_SCHEME, type ClubScheme } from "~/art/stadium-club";
import { A, ZC, project, type View } from "~/art/stadium-view";

export const PITCH_X = 68;
export const PITCH_V = 44;
const IN_A = 82;
const IN_B = 57;
export const OUT_A = 138;
export const OUT_B = 98;
/** The roof plane, in units above the ground. */
export const HR = 15;
/** The back row. */
const HS = 12;
/** The stand's foot: the boards round the pitch. */
const HF = 1.6;
/** The roof covers the stand from here (0 the foot, 1 the wall) outwards. */
const ROOF_IN = 0.5;
/** The roof oversails the wall a little. */
const ROOF_OUT = 1.035;
/** Roof bays (and the wall's bays under them). */
export const BAYS = 48;
/** Seat rows from the foot to the wall. */
const ROWS = 9;
/** Seats round the whole bowl. */
const SEATS = 236;

/** 1 on the stand's foot, less inside it, more outside. */
function gIn(X: number, V: number): number {
  const a = X / IN_A;
  const b = V / IN_B;
  const a2 = a * a;
  const b2 = b * b;
  return Math.sqrt(Math.sqrt(a2 * a2 + b2 * b2));
}

/** 1 on the outer wall, less inside it, more outside. */
export function gOut(X: number, V: number): number {
  const a = Math.abs(X) / OUT_A;
  const b = Math.abs(V) / OUT_B;
  return Math.pow(a * a * Math.sqrt(a) + b * b * Math.sqrt(b), 0.4);
}

/** The point on the outer wall in the direction of bay angle `th` (radians, 0 east, north positive). */
export function wallPoint(th: number, out = 1): { X: number; V: number } {
  const c = Math.cos(th);
  const s = Math.sin(th);
  const g = gOut(c * OUT_A, s * OUT_B);
  return { X: (c * OUT_A * out) / g, V: (s * OUT_B * out) / g };
}

/** The ground in the stadium's cast shadow (down and to the right of it). */
export function inBowlShadow(X: number, V: number): boolean {
  return gOut(X - 9, V + 7) <= 1.02;
}

const ZONE_NONE = 0;
const ZONE_ROOF = 1;
const ZONE_WALL = 2;
const ZONE_STAND = 3;
const ZONE_BOARD = 4;
const ZONE_SURROUND = 5;
const ZONE_PITCH = 6;

export interface Bowl {
  /** Where the layer goes on screen. */
  x: number;
  y: number;
  layer: Surface;
  /** Every crowd pixel: its offset on screen (y * w + x) and what is painted there. */
  crowdAt: Int32Array;
  crowdColor: Uint32Array;
  /** The same pixels' brightest "arms up" colour, for the roar. */
  crowdUp: Uint32Array;
  /** 1 where the pixel is in the away end: they do not cheer the home side's goal. */
  crowdAway: Uint8Array;
  /** Lamps on the roof's inner edge (screen positions), lit at night. */
  rimLamps: { x: number; y: number }[];
  /** The centre spot. */
  spot: { x: number; y: number };
}

export interface BowlTones {
  /** Grade for what the floodlights reach: the pitch, the crowd, the wall. */
  lit(c: Color): Color;
  /** Grade for what only the sky lights: the roof. */
  env(c: Color): Color;
  lightsOn: boolean;
  /** The sun casts the roof's shadow into the bowl. */
  sunny: boolean;
  /** The day's club colours (stadium-club.ts): the second colour's trims and scarves. */
  club?: ClubScheme;
  /** The club's swap for colours drawn raw (the boards' lamps at night). */
  raw?: (c: Color) => Color;
}

/** The home crowd: mostly the club's main colour, scarves and shirts in its second. */
function fansHome(club: ClubScheme): readonly Color[] {
  return [
    P.home,
    P.home,
    P.home,
    P.home,
    P.homeLight,
    P.homeLight,
    P.homeDark,
    club.second.base,
    club.second.base,
    P.home,
    club.second.light,
    P.slate,
  ];
}
const FANS_AWAY: readonly Color[] = [
  P.away,
  P.away,
  P.away,
  P.awayLight,
  P.awayLight,
  P.chalk,
  P.awayDark,
  P.away,
];
const BOARDS: readonly Color[] = [
  P.chalk,
  P.chalk,
  P.gold,
  P.chalk,
  P.away,
  P.chalk,
  P.home,
  P.white,
];

/** Paint the stadium for this view. Colours are final (already graded). */
export function paintBowl(view: View, tones: BowlTones, seed: number): Bowl {
  const { k, cx, yc } = view;
  const club = tones.club ?? DEFAULT_SCHEME;
  const raw = tones.raw ?? ((c: Color): Color => c);
  const FANS_HOME = fansHome(club);
  // The screen box: the roof's far edge to the wall's foot, the widest part either side.
  const top = Math.floor(project(view, 0, OUT_B * ROOF_OUT, HR).y) - 1;
  const bottom = Math.ceil(project(view, 0, -OUT_B, 0).y) + 2;
  const half =
    Math.ceil(OUT_A * ROOF_OUT * project(view, 0, -OUT_B * 0.6).s) + 3;
  const x0 = cx - half;
  const w = Math.max(1, half * 2 + 1);
  const h = Math.max(1, bottom - top + 1);
  const layer = new Surface(w, h);
  const n = w * h;
  const zone = new Uint8Array(n);
  const rho = new Float32Array(n);
  const ang = new Float32Array(n);
  const hgt = new Float32Array(n);
  const shadow = new Uint8Array(n);
  const px = new Float32Array(n);
  const pv = new Float32Array(n);

  const kA = k * A;
  // Unproject a pixel onto the plane H units up.
  let uX = 0;
  let uV = 0;
  const unproject = (sx: number, sy: number, H: number): boolean => {
    const m = (sy - yc + kA) / (k * (A - H));
    if (m <= 0.05) return false;
    uX = (sx - cx) / (k * m);
    uV = ZC / m - ZC;
    return true;
  };
  // The stand's height over a point of the plan (0 on the floor of the bowl).
  let sRho = 0;
  const standHeight = (X: number, V: number): number => {
    const gi = gIn(X, V);
    if (gi <= 1) {
      sRho = -1;
      return 0;
    }
    const go = gOut(X, V);
    sRho = go >= 1 ? 1 : (gi - 1) / (gi - 1 + (1 - go));
    return HF + sRho * (HS - HF);
  };

  for (let j = 0; j < h; j++) {
    const sy = top + j;
    for (let i = 0; i < w; i++) {
      const sx = x0 + i;
      const at = j * w + i;
      if (!unproject(sx, sy, HR)) continue;
      const go = gOut(uX, uV);
      if (go > ROOF_OUT) {
        // Outside the roof: the outer wall, if the ground under this pixel is inside it.
        if (!unproject(sx, sy, 0)) continue;
        if (gOut(uX, uV) > 1) continue;
        let lo = 0;
        let hi = HR;
        for (let it = 0; it < 7; it++) {
          const mid = (lo + hi) / 2;
          unproject(sx, sy, mid);
          if (gOut(uX, uV) <= 1) lo = mid;
          else hi = mid;
        }
        unproject(sx, sy, lo);
        zone[at] = ZONE_WALL;
        hgt[at] = lo;
        ang[at] = Math.atan2(uV / OUT_B, uX / OUT_A);
        continue;
      }
      const gi = gIn(uX, uV);
      const r = gi <= 1 ? 0 : go >= 1 ? 1 : (gi - 1) / (gi - 1 + (1 - go));
      if (r >= ROOF_IN) {
        zone[at] = ZONE_ROOF;
        rho[at] = go >= 1 ? 1.01 : r;
        ang[at] = Math.atan2(uV / OUT_B, uX / OUT_A);
        continue;
      }
      // Through the hole in the roof: find where the line of sight lands.
      let lo = 0;
      let hi = HR;
      for (let it = 0; it < 8; it++) {
        const mid = (lo + hi) / 2;
        unproject(sx, sy, mid);
        if (standHeight(uX, uV) >= mid) lo = mid;
        else hi = mid;
      }
      unproject(sx, sy, lo);
      const sh = standHeight(uX, uV);
      px[at] = uX;
      pv[at] = uV;
      hgt[at] = lo;
      if (sRho < 0) {
        zone[at] =
          Math.abs(uX) <= PITCH_X && Math.abs(uV) <= PITCH_V
            ? ZONE_PITCH
            : ZONE_SURROUND;
      } else if (lo < sh - 0.35 && sRho < 0.12) {
        // Below the first row: the boards at the stand's foot.
        zone[at] = ZONE_BOARD;
        ang[at] = Math.atan2(uV / IN_B, uX / IN_A);
      } else {
        zone[at] = ZONE_STAND;
        rho[at] = sRho;
        ang[at] = Math.atan2(uV / OUT_B, uX / OUT_A);
      }
      if (tones.sunny) {
        // The roof's shadow: step towards the sun, up to the roof plane.
        const up = HR - lo;
        const qx = uX - up * 0.62;
        const qv = uV + up * 0.5;
        const g2 = gOut(qx, qv);
        if (g2 <= ROOF_OUT) {
          const i2 = gIn(qx, qv);
          const r2 = i2 <= 1 ? 0 : g2 >= 1 ? 1 : (i2 - 1) / (i2 - 1 + (1 - g2));
          if (r2 >= ROOF_IN) shadow[at] = 1;
        } else {
          shadow[at] = 1;
        }
      }
    }
  }

  // ---- colour ---------------------------------------------------------------
  const { lit, env } = tones;
  const TWO_PI = Math.PI * 2;
  const bayOf = (a: number): number =>
    Math.floor(((a + Math.PI) / TWO_PI) * BAYS + 0.5) % BAYS;
  const roofTone = (a: number): Color => {
    // Lit from the top left: the far left of the ring is brightest, the near right dullest.
    const d = -Math.cos(a) * 0.7 + Math.sin(a) * 0.7;
    return d > 0.35 ? P.white : d > -0.5 ? P.chalk : P.steelHi;
  };
  const crowdAt: number[] = [];
  const crowdColor: number[] = [];
  const crowdUp: number[] = [];
  const crowdAway: number[] = [];
  const rimLamps: { x: number; y: number }[] = [];
  const data = layer.data;
  const dark = new Map<Color, Color>();
  // A shaded colour is no longer one of the palette's, so `lit` cannot swap it into the
  // day's club colours: the swap comes first (else the crowd under the roof stays red).
  const shaded = (c: Color): Color => {
    let o = dark.get(c);
    if (o === undefined) {
      o = shade(raw(c), -0.3);
      dark.set(c, o);
    }
    return o;
  };

  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const at = j * w + i;
      const z = zone[at];
      if (z === ZONE_NONE) continue;
      const a = ang[at];
      const right = i + 1 < w ? at + 1 : at;
      const below = j + 1 < h ? at + w : at;
      let c: Color;
      if (z === ZONE_ROOF) {
        const r = rho[at];
        const bay = bayOf(a);
        const steep = Math.abs(Math.sin(a)) > 0.5;
        const edge =
          (zone[right] === ZONE_ROOF && bayOf(ang[right]) !== bay && steep) ||
          (zone[below] === ZONE_ROOF && bayOf(ang[below]) !== bay && !steep);
        const inner = zone[below] !== ZONE_ROOF && zone[below] !== ZONE_NONE;
        const innerUp =
          j > 0 && zone[at - w] !== ZONE_ROOF && zone[at - w] !== ZONE_NONE;
        const lip = r < ROOF_IN + 0.07;
        if (r > 1) {
          // the oversailing rim
          // at night a band of light runs round it: the roof ring glows
          c = tones.lightsOn
            ? P.steelHi
            : env(Math.sin(a) > -0.2 || Math.cos(a) < -0.5 ? P.white : P.mist);
        } else if (lip || inner || innerUp) {
          // the inner edge carries the floodlights
          c = tones.lightsOn ? P.chalk : env(P.concreteLight);
          if (tones.lightsOn && (i + j) % 2 === 0 && (inner || innerUp)) {
            rimLamps.push({ x: x0 + i, y: top + j });
          }
        } else {
          const ring =
            zone[below] === ZONE_ROOF &&
            rho[below] > 0 &&
            r < 0.76 !== rho[below] < 0.76;
          c = env(edge || ring ? P.mist : roofTone(a));
          if (tones.lightsOn) {
            // With the lights on the roof is a ring of light, as a lit stadium is from the
            // air: the floodlights glow up through its inner half, and the band round the
            // rim lights the outer half. It never gets darker than that glow, so as the
            // evening falls the roof sinks to it and stays.
            const inside = r < 0.76;
            const glow = edge
              ? inside
                ? P.steel
                : P.slate
              : ring
                ? P.steelHi
                : inside
                  ? P.mist
                  : P.steel;
            if (luma(glow) > luma(c)) c = glow;
          }
        }
      } else if (z === ZONE_WALL) {
        const hh = hgt[at];
        const bay = bayOf(a);
        const pillar =
          zone[right] === ZONE_WALL && bayOf(ang[right]) !== bay && hh < 12;
        const facing = Math.cos(a);
        const body =
          facing < -0.42 ? P.homeLight : facing < 0.5 ? P.home : P.homeDark;
        if (hh >= 12.4) c = lit(P.homeDark);
        else if (pillar) c = lit(facing < 0.5 ? P.chalk : P.steelHi);
        else if (hh < 3.4) {
          // the foot: concrete, with a gate in every third bay
          const frac = (((a + Math.PI) / TWO_PI) * BAYS + 0.5) % 1;
          const gate = bay % 3 === 1 && frac > 0.22 && frac < 0.78 && hh < 2.7;
          c = gate
            ? tones.lightsOn
              ? P.goldLight
              : lit(P.slate)
            : lit(facing < 0.5 ? P.concreteLight : P.concrete);
        } else if (hh < 4.4) c = lit(club.second.base);
        else if (hh > 7.3 && hh < 9.6) {
          // the ribbon of glass round the concourse
          c = tones.lightsOn
            ? hash2(bay, 3, seed) < 0.8
              ? P.gold
              : P.amberDim
            : lit(hash2(bay, 5, seed) < 0.3 ? P.steel : P.slate);
        } else c = lit(body);
      } else if (z === ZONE_STAND) {
        const r = rho[at];
        const row = Math.min(ROWS - 1, Math.floor(r * ROWS));
        const turn = (a + Math.PI) / TWO_PI;
        const seat = Math.floor(turn * SEATS);
        const bay = Math.floor(turn * 24);
        const steep = Math.abs(Math.sin(a)) > 0.5;
        const aisle =
          (steep &&
            zone[right] === ZONE_STAND &&
            Math.floor(((ang[right] + Math.PI) / TWO_PI) * 24) !== bay) ||
          (!steep &&
            zone[below] === ZONE_STAND &&
            Math.floor(((ang[below] + Math.PI) / TWO_PI) * 24) !== bay);
        // The away end: a pocket high in the far right corner, with a gap beside it.
        const deg = (a * 180) / Math.PI;
        const awayEnd = deg > 22 && deg < 50 && r > 0.3;
        const gap =
          (deg > 19 && deg <= 22 && r > 0.3) ||
          (deg >= 50 && deg < 53 && r > 0.3);
        let fan: Color;
        if (r > 0.4 && r < 0.47) fan = P.concreteLight;
        else if (aisle) fan = P.concrete;
        else if (gap) fan = P.homeDark;
        else {
          const hsh = hash2(seat, row, seed);
          const list = awayEnd ? FANS_AWAY : FANS_HOME;
          fan = list[Math.floor(hsh * list.length) % list.length];
        }
        const base = shadow[at] ? shaded(fan) : fan;
        c = lit(base);
        if (fan !== P.concreteLight && fan !== P.concrete) {
          crowdAt.push((top + j) * view.w + (x0 + i));
          crowdColor.push(c);
          crowdAway.push(awayEnd ? 1 : 0);
          crowdUp.push(
            lit(
              awayEnd
                ? hash2(seat, row, seed + 9) < 0.5
                  ? P.awayLight
                  : P.white
                : hash2(seat, row, seed + 9) < 0.4
                  ? club.second.light
                  : hash2(seat, row, seed + 9) < 0.7
                    ? P.homeLight
                    : P.white,
            ),
          );
        }
      } else if (z === ZONE_BOARD) {
        const cell = Math.floor(((a + Math.PI) / TWO_PI) * 56);
        const b = BOARDS[Math.floor(hash2(cell, 1, seed) * BOARDS.length)];
        c = tones.lightsOn ? raw(b) : lit(b);
      } else if (z === ZONE_SURROUND) {
        c = lit(shadow[at] ? P.grassDeep : P.grassDark);
      } else {
        const stripe = Math.floor((px[at] + PITCH_X) / ((PITCH_X * 2) / 12));
        const g = stripe % 2 === 0 ? P.grass : P.grassLight;
        c = lit(shadow[at] ? (stripe % 2 === 0 ? P.grassDark : P.grass) : g);
      }
      data[at] = c;
    }
  }

  const bowl: Bowl = {
    x: x0,
    y: top,
    layer,
    crowdAt: Int32Array.from(crowdAt),
    crowdColor: Uint32Array.from(crowdColor),
    crowdUp: Uint32Array.from(crowdUp),
    crowdAway: Uint8Array.from(crowdAway),
    rimLamps,
    spot: project(view, 0, 0),
  };
  paintMarkings(view, bowl, tones);
  return bowl;
}

/** The pitch's lines, the goals and the dugouts: drawn as lines so they stay crisp. */
function paintMarkings(view: View, bowl: Bowl, tones: BowlTones): void {
  const s = bowl.layer;
  const line = tones.lit(P.white);
  const at = (X: number, V: number, H = 0): [number, number] => {
    const p = project(view, X, V, H);
    return [p.x - bowl.x, p.y - bowl.y];
  };
  const seg = (X0: number, V0: number, X1: number, V1: number): void => {
    const a = at(X0, V0);
    const b = at(X1, V1);
    s.line(a[0], a[1], b[0], b[1], line);
  };
  const box = (X0: number, V0: number, X1: number, V1: number): void => {
    seg(X0, V0, X1, V0);
    seg(X1, V0, X1, V1);
    seg(X1, V1, X0, V1);
    seg(X0, V1, X0, V0);
  };
  box(-PITCH_X, -PITCH_V, PITCH_X, PITCH_V);
  seg(0, -PITCH_V, 0, PITCH_V);
  if (view.k >= 0.34) {
    // the centre circle
    let prev = at(12, 0);
    for (let i = 1; i <= 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const p = at(Math.cos(a) * 12, Math.sin(a) * 12);
      s.line(prev[0], prev[1], p[0], p[1], line);
      prev = p;
    }
    for (const side of [-1, 1]) {
      const gx = side * PITCH_X;
      box(gx, -26, gx - side * 21, 26);
      if (view.k >= 0.7) box(gx, -12, gx - side * 7, 12);
    }
  }
  const spot = at(0, 0);
  s.px(spot[0], spot[1], line);
  // the goals: two posts and a bar, a little net behind
  for (const side of [-1, 1]) {
    const gx = side * PITCH_X;
    const p0 = at(gx, -5, 0);
    const p1 = at(gx, 5, 0);
    const t0 = at(gx, -5, 3.2);
    const t1 = at(gx, 5, 3.2);
    const b0 = at(gx + side * 3, -5, 0);
    const b1 = at(gx + side * 3, 5, 0);
    const net = tones.lit(P.steelHi);
    s.line(b0[0], b0[1], b1[0], b1[1], net);
    s.line(t0[0], t0[1], t1[0], t1[1], tones.lit(P.white));
    s.line(p0[0], p0[1], t0[0], t0[1], tones.lit(P.white));
    s.line(p1[0], p1[1], t1[0], t1[1], tones.lit(P.white));
  }
}
