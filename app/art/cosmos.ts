/**
 * Space, from the Moon to the edge of the observable universe (2026-11-19): FURTHEST's career
 * pulls back from the Earth a step a tier (~/scenes/map.ts). The product owner: "for
 * furthest, it should also start on the globe level but instead of zooming in (like
 * closest) it should zoom out to galaxy, universe, etc."
 *
 * Everything is placed in km on a flat sky with the Earth at its middle (x to the right, y
 * up): the Moon; the Sun with the planets on their orbits; the nearest stars round the Sun;
 * the Milky Way, the Sun 26,000 light years out from its middle; the Local Group (Andromeda,
 * Triangulum, the Magellanic Clouds); and the cosmic web out to the edge of the observable
 * universe. The distances and sizes are real and the directions made up (a flat picture of a
 * round sky, laid out to be wider than it is tall); what is too small to see is drawn a few
 * pixels big, and each thing only at the scales it can be seen at, so `drawCosmos` at any km
 * a pixel shows what is there. The Earth itself is the caller's (~/art/earth-zoom), but for
 * a dot when it is smaller than one. Pure, seeded.
 *
 * Dressed up to look the part (the product owner, 2026-11-19: "even though it may not be
 * realistic, can you add more details to furthest game mode when it goes into outer space"):
 * clouds of gas and more stars behind it all (./cosmos-sky.ts), the Sun in its corona, the
 * planets lit from the Sun with their bands, spots, caps and rings, the asteroid belt, the
 * Kuiper belt and the Oort cloud, comets, satellites, the stars' glows, the Milky Way's bar,
 * its pink star-forming knots and its star clusters, the galaxies' halos, the cosmic web's
 * clusters glowing and the young universe's gas inside its edge.
 */

import {
  type Color,
  FONT_3x5,
  Surface,
  bayer4,
  drawText,
  hash2,
  measureText,
} from "~/pixel";

import { GEO_KM, drawSpaceBackdrop } from "./cosmos-sky";
import { P } from "./palette";

/** Kilometres in an astronomical unit and in a light year. */
export const AU = 1.496e8;
export const LY = 9.4607e12;

/** What the sky's things are called (en.play.space). */
export interface CosmosLabels {
  moon: string;
  sun: string;
  mercury: string;
  venus: string;
  mars: string;
  jupiter: string;
  saturn: string;
  uranus: string;
  neptune: string;
  alphaCentauri: string;
  barnard: string;
  sirius: string;
  milkyWay: string;
  andromeda: string;
  triangulum: string;
  magellanic: string;
  universe: string;
  asteroidBelt: string;
  kuiperBelt: string;
  oortCloud: string;
}

type Name = keyof CosmosLabels;

/** A point on the sky: km from the Earth's middle, x to the right and y up. */
export interface Spot {
  x: number;
  y: number;
}

function polar(from: Spot, km: number, degrees: number): Spot {
  const a = (degrees * Math.PI) / 180;
  return { x: from.x + km * Math.cos(a), y: from.y + km * Math.sin(a) };
}

const EARTH: Spot = { x: 0, y: 0 };
const EARTH_RADIUS = 6371;

/** The Moon, to the right of the Earth and a little below it. */
export const MOON = polar(EARTH, 384400, -12);
const MOON_RADIUS = 1737;

/** The Sun: the Earth is on its orbit EARTH_ANGLE degrees round from the Sun's right. */
const EARTH_ANGLE = 12;
export const SUN = polar(EARTH, AU, EARTH_ANGLE + 180);
const SUN_RADIUS = 696000;

/** A round thing's colours: its night side, its shade, its day side and where it shines. */
interface Look {
  night: Color;
  shade: Color;
  base: Color;
  light: Color;
}

/** What is on a planet's day side at (nx, ny) on its face (-1 to 1, y down), if anything. */
type Markings = (nx: number, ny: number) => Color | null;

interface Planet {
  name: Name | null;
  /** Its orbit (km from the Sun), where on it (degrees), its radius (km). */
  orbit: number;
  angle: number;
  radius: number;
  look: Look;
  /**
   * How big it is drawn, to be made out: this many times an AU on the picture, up to `most`
   * pixels round (at k = 1); its own size if that is bigger.
   */
  size: number;
  most: number;
  markings?: Markings;
  rings?: "wide" | "thin";
}

/** Inside a spot on a face: (x, y), radii (rx, ry). */
function inSpot(
  nx: number,
  ny: number,
  x: number,
  y: number,
  rx: number,
  ry = rx,
): boolean {
  return ((nx - x) / rx) ** 2 + ((ny - y) / ry) ** 2 < 1;
}

const PLANETS: readonly Planet[] = [
  {
    name: "mercury",
    orbit: 0.387 * AU,
    angle: 160,
    radius: 2440,
    look: {
      night: P.concreteDark,
      shade: P.concrete,
      base: P.concreteLight,
      light: P.steelHi,
    },
    size: 0.012,
    most: 3.5,
    markings: (nx, ny) =>
      inSpot(nx, ny, -0.3, -0.2, 0.25) ||
      inSpot(nx, ny, 0.35, 0.3, 0.2) ||
      inSpot(nx, ny, 0.1, -0.6, 0.16) ||
      inSpot(nx, ny, -0.45, 0.45, 0.18)
        ? P.concrete
        : null,
  },
  {
    name: "venus",
    orbit: 0.723 * AU,
    angle: 200,
    radius: 6052,
    look: {
      night: P.retroDark,
      shade: P.retro,
      base: P.retroLight,
      light: P.goldLight,
    },
    size: 0.02,
    most: 4.5,
    // swirls of cloud
    markings: (nx, ny) =>
      Math.sin((ny + 0.35 * nx * nx) * 7) > 0.55 ? P.goldLight : null,
  },
  {
    name: null,
    orbit: AU,
    angle: EARTH_ANGLE,
    radius: EARTH_RADIUS,
    look: {
      night: P.furthestDark,
      shade: P.furthest,
      base: P.furthestLight,
      light: P.white,
    },
    size: 0.012,
    most: 2.5,
  },
  {
    name: "mars",
    orbit: 1.524 * AU,
    angle: -10,
    radius: 3390,
    look: {
      night: P.brickDark,
      shade: P.brick,
      base: P.brickLight,
      light: P.homeLight,
    },
    size: 0.016,
    most: 4.5,
    // its ice cap, and dark lands
    markings: (nx, ny) =>
      ny < -0.72
        ? P.white
        : inSpot(nx, ny, -0.15, 0.2, 0.32, 0.22) ||
            inSpot(nx, ny, 0.42, -0.12, 0.16)
          ? P.brick
          : null,
  },
  {
    name: "jupiter",
    orbit: 5.2 * AU,
    angle: 165,
    radius: 69911,
    look: {
      night: P.retroDark,
      shade: P.retro,
      base: P.retroLight,
      light: P.chalk,
    },
    size: 0.6,
    most: 5.5,
    // its bands, and the Great Red Spot
    markings: (nx, ny) =>
      inSpot(nx, ny, 0.3, 0.3, 0.24, 0.13)
        ? inSpot(nx, ny, 0.3, 0.3, 0.12, 0.06)
          ? P.brickLight
          : P.brick
        : ny < -0.62
          ? P.retro
          : ny < -0.38
            ? P.chalk
            : ny < -0.14
              ? P.brickLight
              : ny < 0.12
                ? P.chalk
                : ny < 0.4
                  ? P.brickLight
                  : ny < 0.64
                    ? P.retroLight
                    : P.retro,
  },
  {
    name: "saturn",
    orbit: 9.58 * AU,
    angle: 18,
    radius: 58232,
    look: {
      night: P.retroDark,
      shade: P.retro,
      base: P.goldLight,
      light: P.chalk,
    },
    size: 0.5,
    most: 5,
    markings: (_nx, ny) =>
      ny < -0.5
        ? P.retroLight
        : ny < -0.12
          ? P.goldLight
          : ny < 0.22
            ? P.retroLight
            : null,
    rings: "wide",
  },
  {
    name: "uranus",
    orbit: 19.2 * AU,
    angle: 192,
    radius: 25362,
    look: {
      night: P.awayDark,
      shade: P.away,
      base: P.awayLight,
      light: P.chalk,
    },
    size: 0.32,
    most: 4,
    rings: "thin",
  },
  {
    name: "neptune",
    orbit: 30.07 * AU,
    angle: 352,
    radius: 24622,
    look: {
      night: P.furthestDark,
      shade: P.furthest,
      base: P.furthestLight,
      light: P.chalk,
    },
    size: 0.32,
    most: 4,
    // its Great Dark Spot, and a streak of high cloud
    markings: (nx, ny) =>
      inSpot(nx, ny, -0.22, 0.22, 0.22, 0.14)
        ? P.furthestDark
        : Math.abs(ny + 0.38) < 0.07 && nx > -0.2 && nx < 0.45
          ? P.chalk
          : null,
  },
];

/** The Moon's colours. */
const MOON_LOOK: Look = {
  night: P.concreteDark,
  shade: P.moonShade,
  base: P.moon,
  light: P.white,
};

/** Belts of rocks and ice round the Sun, and the Oort cloud: a sphere of comets. */
interface Belt {
  name: Name;
  inner: number;
  outer: number;
  colours: readonly Color[];
  /** Rocks a pixel round its middle (a ring) or a pixel of it (the sphere), at most `most`. */
  density: number;
  most: number;
  sphere?: boolean;
  /** The faint glow it lies in. */
  haze: Color;
}

const BELTS: readonly Belt[] = [
  {
    name: "asteroidBelt",
    inner: 2.1 * AU,
    outer: 3.3 * AU,
    colours: [P.concrete, P.concreteLight, P.retroDark, P.concrete, P.steel],
    density: 1.2,
    most: 1600,
    haze: P.nightMid,
  },
  {
    name: "kuiperBelt",
    inner: 30 * AU,
    outer: 50 * AU,
    colours: [P.steel, P.slate, P.mist, P.awayDark, P.steel],
    density: 0.9,
    most: 2000,
    haze: P.nightMid,
  },
  {
    name: "oortCloud",
    inner: 2000 * AU,
    outer: 100000 * AU,
    colours: [P.slate, P.steel, P.slate, P.nightLow, P.steel],
    density: 0.06,
    most: 2600,
    sphere: true,
    haze: P.nightLow,
  },
];

/** Comets near the Sun, their tails blown away from it. */
const COMETS: readonly Spot[] = [
  polar(SUN, 0.55 * AU, 75),
  polar(SUN, 12 * AU, 250),
];

/** Where a planet is on the sky. */
function planetAt(p: Planet): Spot {
  return polar(SUN, p.orbit, p.angle);
}

interface Star {
  name: Name | null;
  /** Light years from the Sun, which way, its colour, and whether it is bright. */
  ly: number;
  angle: number;
  color: Color;
  bright: boolean;
  /** The colour of its glow, if it has one. */
  glow?: Color;
}

/** The nearest stars to the Sun. */
const STARS: readonly Star[] = [
  {
    name: "alphaCentauri",
    ly: 4.37,
    angle: 195,
    color: P.goldLight,
    bright: true,
    glow: P.goldDark,
  },
  // Proxima Centauri, Alpha Centauri's small red companion
  { name: null, ly: 4.24, angle: 199, color: P.brickLight, bright: false },
  {
    name: "barnard",
    ly: 5.96,
    angle: 24,
    color: P.brickLight,
    bright: false,
    glow: P.brickDark,
  },
  { name: null, ly: 7.86, angle: 148, color: P.brickLight, bright: false },
  { name: null, ly: 8.31, angle: 62, color: P.goldLight, bright: false },
  {
    name: "sirius",
    ly: 8.6,
    angle: -16,
    color: P.white,
    bright: true,
    glow: P.furthest,
  },
  { name: null, ly: 8.73, angle: 232, color: P.brickLight, bright: false },
  { name: null, ly: 9.7, angle: 290, color: P.brickLight, bright: false },
  { name: null, ly: 10.5, angle: 112, color: P.goldLight, bright: false },
  { name: null, ly: 11.4, angle: 168, color: P.goldLight, bright: false },
  { name: null, ly: 11.46, angle: -34, color: P.chalk, bright: true },
];

function starAt(st: Star): Spot {
  return polar(SUN, st.ly * LY, st.angle);
}

interface Galaxy {
  name: Name | null;
  at: Spot;
  /** Its radius (km), how flat it looks (1 face on), turned how far (degrees), its arms. */
  radius: number;
  tilt: number;
  turn: number;
  arms: number;
  seed: number;
}

/** The Milky Way's middle: the Sun is 26,000 light years out from it. */
export const MILKY_WAY = polar(SUN, 26000 * LY, 180);
const GALAXIES: readonly Galaxy[] = [
  {
    name: "milkyWay",
    at: MILKY_WAY,
    radius: 50000 * LY,
    tilt: 0.5,
    turn: -8,
    arms: 4,
    seed: 1,
  },
  {
    name: "andromeda",
    at: polar(MILKY_WAY, 2.5e6 * LY, 8),
    radius: 110000 * LY,
    tilt: 0.32,
    turn: 28,
    arms: 2,
    seed: 2,
  },
  {
    name: "triangulum",
    at: polar(MILKY_WAY, 2.73e6 * LY, -8),
    radius: 30000 * LY,
    tilt: 0.6,
    turn: -25,
    arms: 2,
    seed: 3,
  },
  {
    name: "magellanic",
    at: polar(MILKY_WAY, 160000 * LY, 245),
    radius: 7000 * LY,
    tilt: 0.7,
    turn: 30,
    arms: 0,
    seed: 4,
  },
  {
    // the Small Magellanic Cloud: the Large one's name covers both
    name: null,
    at: polar(MILKY_WAY, 200000 * LY, 262),
    radius: 3500 * LY,
    tilt: 0.7,
    turn: -20,
    arms: 0,
    seed: 5,
  },
];

/** The Local Group's dwarf galaxies, round the Milky Way and Andromeda (unnamed). */
const DWARFS: readonly Galaxy[] = Array.from({ length: 26 }, (_, i) => ({
  name: null,
  at: polar(
    i % 2 === 0 ? MILKY_WAY : GALAXIES[1].at,
    (0.25 + 0.75 * hash2(i, 1, 61)) * 0.9e6 * LY,
    hash2(i, 2, 61) * 360,
  ),
  radius: (1500 + 4500 * hash2(i, 3, 61)) * LY,
  tilt: 0.6 + 0.4 * hash2(i, 4, 61),
  turn: hash2(i, 5, 61) * 180,
  arms: 0,
  seed: 10 + i,
}));

/** Half a galaxy's width and height on the sky, tilted and turned. */
function galaxyHalf(g: Galaxy): { w: number; h: number } {
  const a = (g.turn * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const R = g.radius;
  return {
    w: Math.hypot(R * c, R * g.tilt * s),
    h: Math.hypot(R * s, R * g.tilt * c),
  };
}

/** The edge of the observable universe, all round us. */
export const UNIVERSE_RADIUS = 46.5e9 * LY;
/** The cosmic web: a cluster of galaxies about every this far, joined by filaments. */
const WEB_CELL = 4e9 * LY;

/**
 * What FURTHEST's career shows at each tier from 1 (0 is the globe): the spots that must be
 * in the picture (the Earth always is). The Earth and the Moon; the inner planets; the whole
 * solar system; the nearest stars; the Milky Way; the Local Group; the observable universe.
 */
export function cosmosSpots(tier: number): Spot[] {
  const planets = (names: Name[]) =>
    PLANETS.filter((p) => p.name && names.includes(p.name)).map(planetAt);
  const galaxy = (g: Galaxy): Spot[] => {
    const half = galaxyHalf(g);
    return [
      { x: g.at.x - half.w, y: g.at.y },
      { x: g.at.x + half.w, y: g.at.y },
      { x: g.at.x, y: g.at.y - half.h },
      { x: g.at.x, y: g.at.y + half.h },
    ];
  };
  switch (tier) {
    case 1:
      return [MOON];
    case 2:
      return [SUN, ...planets(["mercury", "venus", "mars"])];
    case 3:
      return [SUN, ...planets(["jupiter", "saturn", "uranus", "neptune"])];
    case 4:
      return [SUN, ...STARS.filter((st) => st.name).map(starAt)];
    case 5:
      return galaxy(GALAXIES[0]);
    case 6:
      return [
        MILKY_WAY,
        GALAXIES[3].at,
        ...galaxy(GALAXIES[1]),
        GALAXIES[2].at,
      ];
    default: {
      const R = UNIVERSE_RADIUS;
      return [
        { x: -R, y: 0 },
        { x: R, y: 0 },
        { x: 0, y: -R },
        { x: 0, y: R },
      ];
    }
  }
}

interface WebNode {
  x: number;
  y: number;
  size: number;
}
let web: { nodes: WebNode[]; links: [number, number][] } | null = null;

/** The cosmic web, made once: clusters on a jittered grid, each joined to its nearest. */
function cosmicWeb(): { nodes: WebNode[]; links: [number, number][] } {
  if (web) return web;
  const nodes: WebNode[] = [];
  const n = Math.ceil(UNIVERSE_RADIUS / WEB_CELL);
  for (let j = -n; j <= n; j++) {
    for (let i = -n; i <= n; i++) {
      const x = (i - 0.35 + 0.7 * hash2(i, j, 41)) * WEB_CELL;
      const y = (j - 0.35 + 0.7 * hash2(i, j, 42)) * WEB_CELL;
      if (Math.hypot(x, y) > UNIVERSE_RADIUS * 0.97) continue;
      nodes.push({ x, y, size: hash2(i, j, 43) });
    }
  }
  const links: [number, number][] = [];
  const seen = new Set<string>();
  for (let a = 0; a < nodes.length; a++) {
    const near = nodes
      .map((q, b) => ({
        b,
        d: Math.hypot(q.x - nodes[a].x, q.y - nodes[a].y),
      }))
      .filter((q) => q.b !== a)
      .sort((p, q) => p.d - q.d)
      .slice(0, 2 + Math.floor(nodes[a].size * 2));
    for (const q of near) {
      const key = a < q.b ? `${a}-${q.b}` : `${q.b}-${a}`;
      if (seen.has(key)) continue;
      seen.add(key);
      links.push([a, q.b]);
    }
  }
  web = { nodes, links };
  return web;
}

export interface CosmosView {
  /** The Earth's middle on the picture, and km a pixel. */
  ex: number;
  ey: number;
  kpp: number;
  /** How big the words are (1, or 2 on a wide picture). */
  k: number;
  seed: number;
  labels?: CosmosLabels;
  /** A box no name may go over (the pin's plate and its badge). */
  keep?: { x: number; y: number; w: number; h: number };
  /** The glows worked out in squares of this many pixels (moving: cheaper), or 1. */
  block?: number;
}

/**
 * Space round the Earth at (`ex`, `ey`), `kpp` km a pixel: black, the stars far off, and
 * whatever of the sky's things is to be seen at this scale, named. Fills every pixel of `s`
 * (the Earth's own globe is drawn over it by the caller once it is bigger than a dot).
 */
export function drawCosmos(s: Surface, v: CosmosView): void {
  const w = s.w;
  const h = s.h;
  const diag = Math.hypot(w, h);
  const kpp = v.kpp;
  const across = w * kpp;
  const at = (p: Spot) => ({ x: v.ex + p.x / kpp, y: v.ey - p.y / kpp });
  // the gas of the young universe only inside its edge, once that is in the picture
  const edge = UNIVERSE_RADIUS / kpp;
  drawSpaceBackdrop(s, {
    ex: v.ex,
    ey: v.ey,
    kpp,
    seed: v.seed,
    block: v.block ?? 1,
    ...(edge < diag * 3 && { within: { x: v.ex, y: v.ey, r: edge } }),
  });
  const on = (x: number, y: number, m = 0) =>
    x >= -m && x < w + m && y >= -m && y < h + m;
  const k = v.k;
  const names: {
    x: number;
    y: number;
    r: number;
    text: string;
    centred: boolean;
  }[] = [];
  const name: Namer = (key, x, y, r, centred = false) => {
    const text = key && v.labels ? v.labels[key] : "";
    if (text && on(x, y)) names.push({ x, y, r, text, centred });
  };

  // the cosmic web, out to the edge of what can be seen
  if (across > 1e9 * LY) drawWeb(s, at, kpp, diag, name);

  // the galaxies, from a speck to the spiral, and nothing of one we are deep inside
  for (const g of [...DWARFS, ...GALAXIES]) {
    const c = at(g.at);
    // a little bigger than it is while it is small, to be made out
    const real = g.radius / kpp;
    const R = Math.max(real, Math.min(real * 2, 8 * k));
    if (R > diag * 6 || !on(c.x, c.y, R + 2)) continue;
    drawGalaxy(s, c.x, c.y, R, g, v.block ?? 1);
    const half = (galaxyHalf(g).w / g.radius) * R;
    if (R >= 2.5 && R < diag * 1.2) name(g.name, c.x, c.y, Math.max(2, half));
  }

  const sun = at(SUN);
  const earth = at(EARTH);

  // the belts round the Sun, and the Oort cloud round it all
  for (const b of BELTS) {
    if (b.sphere ? across > 60 * LY : across > 1.5 * LY) continue;
    drawBelt(s, b, sun, earth, kpp, diag, name);
  }

  // the nearest stars round the Sun, once they are apart
  if (across > 1.5 * LY && across < 600 * LY) {
    for (const st of STARS) {
      const p = at(starAt(st));
      if (!on(p.x, p.y, 3)) continue;
      drawStar(
        s,
        Math.round(p.x),
        Math.round(p.y),
        st.color,
        st.bright,
        k,
        st.glow,
      );
      name(st.name, p.x, p.y, 3 * k);
    }
    drawStar(
      s,
      Math.round(sun.x),
      Math.round(sun.y),
      P.sun,
      true,
      k,
      P.goldDark,
    );
    name("sun", sun.x, sun.y, 3 * k);
  }

  // the Sun, the planets on their orbits, comets
  const au = AU / kpp;
  if (au >= 3 && across < 1.5 * LY) {
    for (const pl of PLANETS) {
      const r = pl.orbit / kpp;
      if (r < 5 || r > diag * 4) continue;
      dottedRing(s, sun.x, sun.y, r, pl.name ? P.slate : P.steel, 3);
    }
    for (const c of COMETS) {
      const p = at(c);
      const far = Math.hypot(p.x - sun.x, p.y - sun.y);
      if (far < 24 || far > diag || !on(p.x, p.y, 40)) continue;
      const long = Math.max(10 * k, Math.min(far * 0.3, 40 * k));
      drawComet(s, p.x, p.y, (p.x - sun.x) / far, (p.y - sun.y) / far, long, k);
    }
    const sr = Math.min(
      diag,
      Math.max(SUN_RADIUS / kpp, clamp(au * 0.022, 1.5 * k, 3.5 * k)),
    );
    if (on(sun.x, sun.y, sr * 4 + 10 * k)) {
      drawSun(s, sun.x, sun.y, sr, k);
      name("sun", sun.x, sun.y, sr * 1.3 + k + 2);
    }
    for (const pl of PLANETS) {
      const orbit = pl.orbit / kpp;
      if (orbit < 5 || pl.name === null) continue;
      const p = at(planetAt(pl));
      const r = Math.max(
        pl.radius / kpp,
        Math.min(pl.size * au, pl.most * k),
        0.6,
      );
      if (!on(p.x, p.y, r * 2.4 + 2)) continue;
      if (pl.rings) drawRings(s, p.x, p.y, r, pl.rings, false);
      drawBody(s, p.x, p.y, r, pl.look, sun, pl.markings);
      if (pl.rings) drawRings(s, p.x, p.y, r, pl.rings, true);
      if (orbit >= 14)
        name(pl.name, p.x, p.y, pl.rings === "wide" ? r * 2.3 : r);
    }
  }

  // the Moon, on its orbit round the Earth; the satellites' ring (./cosmos-sky.ts)
  const moonOrbit = 384400 / kpp;
  if (moonOrbit >= 8 && moonOrbit < diag * 4) {
    dottedRing(s, earth.x, earth.y, moonOrbit, P.slate, 3);
    const geo = GEO_KM / kpp;
    if (geo >= 14 && EARTH_RADIUS / kpp < 30) {
      dottedRing(s, earth.x, earth.y, geo, P.nightLow, 2);
    }
    const m = at(MOON);
    const r = Math.max(3.5 * k, MOON_RADIUS / kpp);
    if (on(m.x, m.y, r + 2)) {
      drawBody(s, m.x, m.y, r, MOON_LOOK, sun, craters);
      name("moon", m.x, m.y, r);
    }
  }

  // the Earth, while it is smaller than a few pixels: a blue dot
  if (EARTH_RADIUS / kpp < 1.5 && on(earth.x, earth.y)) {
    const x = Math.round(earth.x);
    const y = Math.round(earth.y);
    s.rect(x - k, y - k, 2 * k, 2 * k, P.furthest);
    s.rect(x, y - k, k, k, P.grassLight);
  }

  // the names, beside their things: to the right, or the left if there is no room
  const opts = { font: FONT_3x5, scale: v.k } as const;
  const th = 5 * v.k;
  const keep = v.keep;
  const clear = (x: number, y: number, tw: number) =>
    x >= 2 &&
    x + tw <= w - 2 &&
    y >= 0 &&
    y + th <= h &&
    (!keep ||
      x + tw + 1 < keep.x ||
      x - 1 > keep.x + keep.w ||
      y + th + 1 < keep.y ||
      y - 1 > keep.y + keep.h);
  for (const n of names) {
    const tw = measureText(n.text, opts);
    const y = Math.round(n.y - th / 2);
    const right = Math.round(n.x + n.r + 3 * v.k);
    const left = Math.round(n.x - n.r - 3 * v.k - tw);
    const mid = Math.round(n.x - tw / 2);
    const x = n.centred
      ? clear(mid, y, tw)
        ? mid
        : null
      : clear(right, y, tw)
        ? right
        : clear(left, y, tw)
          ? left
          : null;
    if (x === null) continue;
    drawText(s, n.text, x, y, P.mist, { ...opts, outline: P.ink });
  }
}

/** Puts a name by a thing at (x, y), `r` pixels round: beside it, or centred on x. */
type Namer = (
  key: Name | null,
  x: number,
  y: number,
  r: number,
  centred?: boolean,
) => void;

/** The cosmic web: its filaments, its clusters, and the edge of the observable universe. */
function drawWeb(
  s: Surface,
  at: (p: Spot) => { x: number; y: number },
  kpp: number,
  diag: number,
  name: Namer,
): void {
  const w = s.w;
  const h = s.h;
  const on = (x: number, y: number) => x >= 0 && x < w && y >= 0 && y < h;
  const { nodes, links } = cosmicWeb();
  for (let l = 0; l < links.length; l++) {
    const [a, b] = links[l];
    const p = at(nodes[a]);
    const q = at(nodes[b]);
    const len = Math.hypot(q.x - p.x, q.y - p.y);
    if (len > diag * 4) continue;
    const steps = Math.max(1, Math.round(len));
    // where along it the picture is (with room for the filament's bow and jitter)
    const seen = within(
      p,
      q,
      -len * 0.13 - 2,
      -len * 0.13 - 2,
      w + len * 0.13 + 2,
      h + len * 0.13 + 2,
    );
    if (!seen) continue;
    const i0 = Math.max(0, Math.floor(seen[0] * steps));
    const i1 = Math.min(steps, Math.ceil(seen[1] * steps));
    for (let i = i0; i <= i1; i++) {
      if (hash2(l, i, 44) > 0.55) continue;
      const u = i / steps;
      const bow = Math.sin(u * Math.PI) * (hash2(l, 0, 45) - 0.5) * len * 0.25;
      const nx = -(q.y - p.y) / (len || 1);
      const ny = (q.x - p.x) / (len || 1);
      const jx = (hash2(l, i, 46) - 0.5) * 2;
      const jy = (hash2(l, i, 47) - 0.5) * 2;
      const x = Math.round(p.x + (q.x - p.x) * u + nx * bow + jx);
      const y = Math.round(p.y + (q.y - p.y) * u + ny * bow + jy);
      if (on(x, y)) s.px(x, y, hash2(l, i, 48) < 0.3 ? P.furthest : P.slate);
    }
  }
  const colors = [P.furthestLight, P.nextgenLight, P.mist, P.white];
  for (let i = 0; i < nodes.length; i++) {
    const p = at(nodes[i]);
    if (!on(p.x, p.y)) continue;
    const r = 1 + nodes[i].size * 2.5;
    // the cluster's glow
    if (nodes[i].size > 0.45) {
      s.disc(
        Math.round(p.x),
        Math.round(p.y),
        r * 1.8 + 1,
        i % 2 === 0 ? P.nextgenDark : P.furthestDark,
        0.25,
      );
    }
    for (let j = 0; j < 4 + Math.round(r * r * 3); j++) {
      const a = hash2(i, j, 49) * Math.PI * 2;
      const d = hash2(i, j, 50) ** 1.5 * r * 1.6;
      s.px(
        Math.round(p.x + Math.cos(a) * d),
        Math.round(p.y + Math.sin(a) * d),
        colors[j % colors.length],
      );
    }
  }
  // the edge of the observable universe: the first light, and a dotted line
  const c = at(EARTH);
  const R = UNIVERSE_RADIUS / kpp;
  if (R > diag * 3) return;
  const band = Math.max(2, R * 0.06);
  ringRows(c.x, c.y, R - band, R, w, h, (y, xa, xb) => {
    for (let x = xa; x <= xb; x++) {
      const d = R - Math.hypot(x + 0.5 - c.x, y + 0.5 - c.y);
      if (d < 0 || d > band) continue;
      if (bayer4(x, y) < 0.45 * (1 - d / band)) {
        s.px(x, y, d < band * 0.4 ? P.retroDark : P.brickDark);
      }
    }
  });
  dottedRing(s, c.x, c.y, R, P.furthestLight, 2);
  // its name under it, or inside its foot if there is no room under it
  const below = c.y + R + 8 <= s.h - 6 ? c.y + R + 8 : c.y + R - 10;
  if (R > 30) name("universe", c.x, below, 0, true);
}

/**
 * A near star: a white heart in its colour, longer rays if it is bright, and a glow round it
 * in `glow` if it has one (at `k`).
 */
function drawStar(
  s: Surface,
  x: number,
  y: number,
  c: Color,
  bright: boolean,
  k: number,
  glow?: Color,
): void {
  if (glow) {
    s.disc(x, y, 4 * k, glow, 0.25);
    s.disc(x, y, 2.5 * k, glow, 0.5);
  }
  const dot = (dx: number, dy: number, col: Color) =>
    s.rect(x + dx * k, y + dy * k, k, k, col);
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    dot(dx, dy, c);
    if (bright) dot(dx * 2, dy * 2, c);
  }
  dot(0, 0, P.white);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * The Sun, `r` pixels round: white hot in its middle, in a corona of stepped bands, gold to
 * a dark red, its rays out across them (at `k`).
 */
function drawSun(
  s: Surface,
  cx: number,
  cy: number,
  r: number,
  k: number,
): void {
  const x = Math.round(cx);
  const y = Math.round(cy);
  s.disc(x, y, r * 3.4 + 5 * k, P.brickDark, 0.25);
  s.disc(x, y, r * 2.5 + 3 * k, P.retroDark, 0.5);
  s.disc(x, y, r * 1.7 + 2 * k, P.goldDark);
  s.disc(x, y, r * 1.3 + k, P.gold);
  // its rays: four long, four short between them
  const ray = (dx: number, dy: number, long: number) => {
    for (let d = Math.ceil(r * 1.3 + k); d <= long; d++) {
      const u = d / long;
      if (u > 0.6 && d % 2 === 1) continue;
      s.px(
        x + dx * d,
        y + dy * d,
        u < 0.5 ? P.goldLight : u < 0.8 ? P.gold : P.goldDark,
      );
    }
  };
  const long = Math.round(r * 3.8 + 10 * k);
  const short = Math.round((r * 2.6 + 5 * k) / Math.SQRT2);
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    ray(dx, dy, long);
  }
  for (const [dx, dy] of [
    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1],
  ]) {
    ray(dx, dy, short);
  }
  s.disc(x, y, r, P.sun);
  if (r >= 3) s.disc(x, y, r * 0.55, P.white);
}

/**
 * A round thing `r` pixels round, lit from the Sun at `sun`: its day side, a band of shade,
 * its night side, a glint where the Sun is full on it, and its `markings` by day.
 */
function drawBody(
  s: Surface,
  cx: number,
  cy: number,
  r: number,
  look: Look,
  sun: { x: number; y: number },
  markings?: Markings,
): void {
  const x = Math.round(cx);
  const y = Math.round(cy);
  // the light: from the Sun's side, and a little from in front
  const sx = sun.x - cx;
  const sy = sun.y - cy;
  const len = Math.hypot(sx, sy) || 1;
  const lz = 0.45;
  const n = Math.hypot(0.9, lz);
  const lx = ((sx / len) * 0.9) / n;
  const ly = ((sy / len) * 0.9) / n;
  const lzn = lz / n;
  if (r < 1.2) {
    s.px(x, y, look.base);
    return;
  }
  if (r < 2.5) {
    s.disc(x, y, r, look.shade);
    s.px(
      x + Math.sign(Math.round(lx * 1.4)),
      y + Math.sign(Math.round(ly * 1.4)),
      look.base,
    );
    return;
  }
  const R = Math.ceil(r);
  for (let dy = -R; dy <= R; dy++) {
    for (let dx = -R; dx <= R; dx++) {
      const nx = dx / r;
      const ny = dy / r;
      const q = nx * nx + ny * ny;
      if (q > 1) continue;
      const nz = Math.sqrt(1 - q);
      const lit = nx * lx + ny * ly + nz * lzn;
      const c =
        lit < 0
          ? look.night
          : lit < 0.28
            ? look.shade
            : (markings?.(nx, ny) ?? (lit > 0.85 ? look.light : look.base));
      s.px(x + dx, y + dy, c);
    }
  }
}

/** The Moon's craters. */
const craters: Markings = (nx, ny) => {
  for (let i = 0; i < 6; i++) {
    const a = hash2(i, 1, 9) * Math.PI * 2;
    const d = hash2(i, 2, 9) * 0.6;
    if (
      inSpot(
        nx,
        ny,
        Math.cos(a) * d,
        Math.sin(a) * d,
        0.16 + 0.1 * hash2(i, 3, 9),
      )
    ) {
      return P.moonShade;
    }
  }
  return null;
};

/**
 * A planet's rings round (cx, cy), the planet `r` round: Saturn's wide and flat with a gap,
 * Uranus's thin and on end. The far half (`front` false) goes before the planet, the near
 * half after it.
 */
function drawRings(
  s: Surface,
  cx: number,
  cy: number,
  r: number,
  kind: "wide" | "thin",
  front: boolean,
): void {
  const x = Math.round(cx);
  const y = Math.round(cy);
  const wide = kind === "wide";
  const outer = wide ? r * 2.25 + 0.5 : r * 1.75 + 0.5;
  const inner = wide ? r * 1.3 : r * 1.5;
  const gap = r * 1.8;
  const gapHalf = r >= 3 ? Math.max(0.5, r * 0.08) : 0;
  // Saturn's lie flat, a little tipped to us; Uranus's stand on end
  const sx = wide ? 1 : 0.3;
  const sy = wide ? 0.32 : 1;
  const ex = Math.ceil(outer * sx);
  const ey = Math.ceil(outer * sy);
  for (let dy = -ey; dy <= ey; dy++) {
    for (let dx = -ex; dx <= ex; dx++) {
      // the near half: below the middle (Saturn), to the left (Uranus)
      const near = wide ? dy > 0 : dx < 0;
      if (near !== front) continue;
      const q = Math.hypot(dx / sx, dy / sy);
      if (q < inner || q > outer) continue;
      if (wide && Math.abs(q - gap) < gapHalf) continue;
      s.px(
        x + dx,
        y + dy,
        wide ? (q < gap ? P.retroLight : P.chalk) : P.steelHi,
      );
    }
  }
}

/**
 * A belt of rocks round the Sun (or the Oort cloud: a sphere of them), while it is big
 * enough to be made out and not far bigger than the picture; named where its middle is in
 * the picture furthest from the Earth.
 */
function drawBelt(
  s: Surface,
  b: Belt,
  sun: { x: number; y: number },
  earth: { x: number; y: number },
  kpp: number,
  diag: number,
  name: Namer,
): void {
  const inner = b.inner / kpp;
  const outer = b.outer / kpp;
  const mid = b.sphere ? outer * 0.8 : (inner + outer) / 2;
  if (mid < 14 || inner > diag * 3) return;
  const n = Math.min(
    b.most,
    Math.round(
      b.sphere
        ? Math.PI * outer * outer * b.density
        : 2 * Math.PI * mid * b.density,
    ),
  );
  // the glow it lies in: thickest along its middle (the Oort cloud's only while it is
  // small in the picture: over much of it, a dither is a screen door)
  const glow = !b.sphere || outer < diag * 0.35;
  const from = b.sphere ? 0 : inner;
  if (glow) {
    // solid along its middle, dithered towards its edges: how much, out to each radius
    const span = outer - from;
    const steps = (
      b.sphere
        ? [
            [outer * 0.25, 0.15],
            [outer * 0.75, 0.2],
            [outer, 0.15],
          ]
        : [
            [from + span * 0.125, 0.2],
            [from + span * 0.275, 0.5],
            [from + span * 0.725, 1],
            [from + span * 0.875, 0.5],
            [outer, 0.2],
          ]
    ).map(([r, level]) => [r * r, level]);
    const data = s.data;
    const w = s.w;
    ringRows(sun.x, sun.y, from, outer, w, s.h, (y, xa, xb) => {
      const dy = y + 0.5 - sun.y;
      for (let x = xa; x <= xb; x++) {
        const dx = x + 0.5 - sun.x;
        const d2 = dx * dx + dy * dy;
        let level = 0;
        for (const [r2, l] of steps) {
          if (d2 <= r2) {
            level = l;
            break;
          }
        }
        if (bayer4(x, y) < level) data[y * w + x] = b.haze;
      }
    });
  }
  const seed = b.sphere ? 83 : b.inner > 10 * AU ? 82 : 81;
  for (let i = 0; i < n; i++) {
    const a = hash2(i, 1, seed) * Math.PI * 2;
    const f = hash2(i, 2, seed);
    // a sphere seen from outside: thicker towards its edge
    const d = b.sphere
      ? outer * (0.12 + 0.88 * f ** 0.4)
      : inner + (outer - inner) * (0.5 + (f - 0.5) * Math.abs(f - 0.5) * 2);
    const x = Math.round(sun.x + Math.cos(a) * d);
    const y = Math.round(sun.y + Math.sin(a) * d);
    const c = b.colours[Math.floor(hash2(i, 3, seed) * b.colours.length)];
    s.px(x, y, c);
    // a few bigger rocks, close up
    if (!b.sphere && mid > 200 && hash2(i, 4, seed) < 0.15) s.px(x + 1, y, c);
  }
  // its name, on its middle where that is in the picture, as far from the Earth as can be
  let best: { x: number; y: number } | null = null;
  let bestD = -1;
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    const x = sun.x + Math.cos(a) * mid;
    const y = sun.y + Math.sin(a) * mid;
    if (x < 20 || y < 12 || x > s.w - 20 || y > s.h - 12) continue;
    const dd = Math.hypot(x - earth.x, y - earth.y);
    if (dd > bestD) {
      bestD = dd;
      best = { x, y };
    }
  }
  if (best && mid < diag) name(b.name, best.x, best.y, 2);
}

/**
 * A comet at (cx, cy), its tails `long` pixels out along (dx, dy), away from the Sun: the
 * dust tail gold, curving and spreading; the gas tail blue and straight; its head white.
 */
function drawComet(
  s: Surface,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
  long: number,
  k: number,
): void {
  const nx = -dy;
  const ny = dx;
  for (let i = 1; i <= long; i++) {
    const u = i / long;
    const bend = u * u * long * 0.22;
    const spread = 0.5 + u * 3 * k;
    const mx = cx + dx * i * 0.95 + nx * bend;
    const my = cy + dy * i * 0.95 + ny * bend;
    for (let j = -Math.ceil(spread); j <= Math.ceil(spread); j++) {
      const x = Math.round(mx + nx * j);
      const y = Math.round(my + ny * j);
      const level = (1 - u) * (1 - Math.abs(j) / (spread + 1)) * 1.3;
      if (bayer4(x, y) >= level) continue;
      s.px(x, y, u < 0.3 ? P.goldLight : u < 0.6 ? P.retroLight : P.retroDark);
    }
  }
  for (let i = 1; i <= long * 1.15; i++) {
    const u = i / (long * 1.15);
    if (u > 0.55 && i % 2 === 1) continue;
    s.px(
      Math.round(cx + dx * i),
      Math.round(cy + dy * i),
      u < 0.25 ? P.white : u < 0.6 ? P.awayLight : P.furthest,
    );
  }
  s.disc(Math.round(cx), Math.round(cy), 1.5 * k, P.awayLight);
  s.rect(Math.round(cx), Math.round(cy), k, k, P.white);
}

/** How far out a galaxy's faint halo goes (in its radius). */
const HALO = 1.35;

/** The 4 x 4 dither's thresholds, by (y & 3) * 4 + (x & 3). */
const BAYER = Float32Array.from({ length: 16 }, (_, i) =>
  bayer4(i & 3, i >> 2),
);

/** Where a galaxy's glow is painted: a box of the picture (inclusive) round (cx, cy). */
interface GlowBox {
  xa: number;
  xb: number;
  ya: number;
  yb: number;
  cx: number;
  cy: number;
  R: number;
  g: Galaxy;
  b: number;
  cos: number;
  sin: number;
}

/**
 * A galaxy's glow into `out` (`ow` wide, its pixel (0, 0) at (ox, oy)), over a box: brightest
 * in the middle and along the arms, in dithered steps, worked out in squares of `b`; the haze
 * it sits in over its disc and out into its halo.
 */
function paintGlow(
  out: Uint32Array,
  ow: number,
  ox: number,
  oy: number,
  v: GlowBox,
): void {
  const { g, R, b, cos, sin } = v;
  const arms = g.arms;
  const night = P.nightLow;
  for (let sy = v.ya; sy <= v.yb; sy += b) {
    for (let sx = v.xa; sx <= v.xb; sx += b) {
      const dx = sx + b / 2 - v.cx;
      const dy = sy + b / 2 - v.cy;
      const lx = dx * cos + dy * sin;
      const ly = (-dx * sin + dy * cos) / g.tilt;
      const rho = Math.hypot(lx, ly) / R;
      if (rho >= HALO) continue;
      const ye = Math.min(sy + b, v.yb + 1);
      const xe = Math.min(sx + b, v.xb + 1);
      const haze = rho < 1 ? 0.35 : (0.35 * (HALO - rho)) / (HALO - 1);
      if (rho >= 1) {
        for (let y = sy; y < ye; y++) {
          const row = (y - oy) * ow - ox;
          const brow = (y & 3) << 2;
          for (let x = sx; x < xe; x++) {
            if (BAYER[brow | (x & 3)] < haze) out[row + x] = night;
          }
        }
        continue;
      }
      let arm: number;
      if (arms > 0) {
        const th = Math.atan2(ly, lx) - 2.7 * Math.log(1 + 5 * rho);
        const f = ((((th * arms) / (Math.PI * 2)) % 1) + 1) % 1;
        const a = 1 - 2 * Math.min(f, 1 - f);
        arm = a * a * a;
      } else {
        arm = 0.5 + 0.5 * hash2(Math.floor(lx / 3), Math.floor(ly / 3), g.seed);
      }
      const d =
        (1 - rho) * (1 - 0.1 * rho) * (0.22 + 0.7 * arm) +
        (rho < 0.16 ? (0.16 - rho) * 5 : 0);
      const c =
        rho < 0.06
          ? P.goldLight
          : rho < 0.13
            ? P.retroLight
            : d > 0.55
              ? P.mist
              : d > 0.3
                ? P.steel
                : P.slate;
      for (let y = sy; y < ye; y++) {
        const row = (y - oy) * ow - ox;
        const brow = (y & 3) << 2;
        for (let x = sx; x < xe; x++) {
          const t = BAYER[brow | (x & 3)];
          if (t < d) out[row + x] = c;
          else if (t < haze) out[row + x] = night;
        }
      }
    }
  }
}

/** Each galaxy's glow as last worked out (by its seed), and for what. */
const glows = new Map<number, { key: string; glow: Uint32Array }>();

/**
 * A galaxy's glow `R` round in squares of `b`, centred in a box `bw` and `bh` each side of
 * its middle (0: nothing there), kept while it is asked for at the same size.
 */
function glowFor(
  g: Galaxy,
  R: number,
  b: number,
  bw: number,
  bh: number,
  cos: number,
  sin: number,
): Uint32Array {
  const key = `${R}|${b}|${bw}|${bh}`;
  const kept = glows.get(g.seed);
  if (kept?.key === key) return kept.glow;
  const gw = bw * 2 + 1;
  const glow = new Uint32Array(gw * (bh * 2 + 1));
  paintGlow(glow, gw, -bw, -bh, {
    xa: -bw,
    xb: bw,
    ya: -bh,
    yb: bh,
    cx: 0,
    cy: 0,
    R,
    g,
    b,
    cos,
    sin,
  });
  glows.set(g.seed, { key, glow });
  return glow;
}

/**
 * A galaxy of radius R pixels round (cx, cy): a speck, a smudge, or a glow with its arms of
 * stars wound out from a bright middle.
 */
function drawGalaxy(
  s: Surface,
  cx: number,
  cy: number,
  R: number,
  g: Galaxy,
  block: number,
): void {
  const x0 = Math.round(cx);
  const y0 = Math.round(cy);
  if (R < 1) {
    s.px(x0, y0, P.chalk);
    return;
  }
  if (R < 3) {
    s.px(x0 + 1, y0, P.steel);
    s.px(x0 - 1, y0, P.steel);
    s.px(x0, y0, P.white);
    return;
  }
  const w = s.w;
  const h = s.h;
  const turn = (g.turn * Math.PI) / 180;
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  const arms = g.arms;
  const half = galaxyHalf(g);
  const hw = (half.w / g.radius) * R;
  const hh = (half.h / g.radius) * R;
  // the glow: brightest in the middle and along the arms, in dithered steps; a faint halo.
  // Still, worked out once for a size and kept while the galaxy stays that size (the picture
  // only sliding), unless it is far bigger than the picture; moving (in squares), its size
  // changes every frame: only what is in the picture, straight onto it
  // (in bigger squares while it is far bigger than the picture: its glow is smooth there)
  const b = Math.max(1, Math.round(block), Math.min(8, Math.floor(R / 250)));
  const bw = Math.ceil(hw * HALO) + 1;
  const bh = Math.ceil(hh * HALO) + 1;
  const gw = bw * 2 + 1;
  const gh = bh * 2 + 1;
  const data = s.data;
  if (block <= 1 && gw * gh <= w * h * 2) {
    const glow = glowFor(g, R, b, bw, bh, cos, sin);
    const ox = x0 - bw;
    const oy = y0 - bh;
    const xa = Math.max(0, ox);
    const xb = Math.min(w, ox + gw);
    for (let y = Math.max(0, oy); y < Math.min(h, oy + gh); y++) {
      const from = (y - oy) * gw - ox;
      const to = y * w;
      for (let x = xa; x < xb; x++) {
        const c = glow[from + x];
        if (c !== 0) data[to + x] = c;
      }
    }
  } else {
    paintGlow(data, w, 0, 0, {
      xa: Math.max(0, Math.floor(cx - hw * HALO - 1)),
      xb: Math.min(w - 1, Math.ceil(cx + hw * HALO + 1)),
      ya: Math.max(0, Math.floor(cy - hh * HALO - 1)),
      yb: Math.min(h - 1, Math.ceil(cy + hh * HALO + 1)),
      cx,
      cy,
      R,
      g,
      b,
      cos,
      sin,
    });
  }
  // its stars, young and blue along the arms, old and gold in the middle
  const put = (lx: number, ly: number, c: Color) => {
    const fy = ly * g.tilt;
    s.px(
      Math.round(cx + lx * cos - fy * sin),
      Math.round(cy + lx * sin + fy * cos),
      c,
    );
  };
  const stars = Math.min(6000, Math.round(R * R * 0.45 + 40));
  for (let i = 0; i < stars; i++) {
    const a = hash2(i, 1, g.seed);
    const b = hash2(i, 2, g.seed);
    const c = hash2(i, 3, g.seed);
    let r: number;
    let th: number;
    if (arms === 0) {
      r = R * Math.sqrt(a) * (0.5 + 0.5 * c);
      th = b * Math.PI * 2;
    } else if (arms >= 4 && i % 10 === 0) {
      // the Milky Way's bar, across its middle
      const bx = (a - 0.5) * R * 0.46;
      const by = (b - 0.5) * R * 0.12 * (1 - Math.abs(a - 0.5));
      r = Math.hypot(bx, by);
      th = Math.atan2(by, bx);
    } else if (i % 5 === 0) {
      r = R * 0.2 * Math.sqrt(a);
      th = b * Math.PI * 2;
    } else {
      r = R * (0.12 + 0.88 * a ** 0.8);
      th =
        ((i % arms) / arms) * Math.PI * 2 +
        2.7 * Math.log(1 + (5 * r) / R) +
        (b - 0.5) * (0.5 - (0.25 * r) / R);
    }
    const col =
      r < R * 0.2
        ? c < 0.5
          ? P.goldLight
          : P.white
        : c < 0.08
          ? P.nextgenLight
          : c < 0.5
            ? P.furthestLight
            : c < 0.8
              ? P.chalk
              : P.mist;
    put(r * Math.cos(th), r * Math.sin(th), col);
  }
  if (R >= 28 && arms > 0) {
    // pink knots where stars are being born, along the arms
    for (let j = 0; j < arms * 9; j++) {
      const r = R * (0.3 + 0.62 * hash2(j, 1, g.seed + 7));
      const th =
        ((j % arms) / arms) * Math.PI * 2 +
        2.7 * Math.log(1 + (5 * r) / R) +
        (hash2(j, 2, g.seed + 7) - 0.5) * 0.25;
      const fy = r * Math.sin(th) * g.tilt;
      const kx = Math.round(cx + r * Math.cos(th) * cos - fy * sin);
      const ky = Math.round(cy + r * Math.cos(th) * sin + fy * cos);
      s.px(kx, ky, P.nextgenLight);
      if (hash2(j, 3, g.seed + 7) < 0.6) {
        s.px(kx + 1, ky, P.nextgen);
        s.px(kx, ky + 1, P.nextgen);
      }
    }
    // old star clusters in a halo round it
    for (let j = 0; j < 12; j++) {
      const a = hash2(j, 4, g.seed + 7) * Math.PI * 2;
      const d = R * (0.35 + 0.85 * hash2(j, 5, g.seed + 7));
      const gx = Math.round(cx + Math.cos(a) * d);
      const gy = Math.round(cy + Math.sin(a) * d * 0.8);
      s.px(gx - 1, gy, P.retroLight);
      s.px(gx + 1, gy, P.retroLight);
      s.px(gx, gy - 1, P.retroLight);
      s.px(gx, gy + 1, P.retroLight);
      s.px(gx, gy, P.goldLight);
    }
  }
  s.px(x0, y0, P.white);
}

/**
 * Each row of the picture (`w` by `h`) that the ring round (cx, cy) from radius `r0` to `r1`
 * crosses, with the pixels it covers in it (one or two runs, xa to xb inclusive).
 */
function ringRows(
  cx: number,
  cy: number,
  r0: number,
  r1: number,
  w: number,
  h: number,
  each: (y: number, xa: number, xb: number) => void,
): void {
  const ya = Math.max(0, Math.floor(cy - r1));
  const yb = Math.min(h - 1, Math.ceil(cy + r1));
  for (let y = ya; y <= yb; y++) {
    const dy = y + 0.5 - cy;
    const outer = r1 * r1 - dy * dy;
    if (outer < 0) continue;
    const half = Math.sqrt(outer);
    const xa = Math.max(0, Math.floor(cx - half));
    const xb = Math.min(w - 1, Math.ceil(cx + half));
    if (xa > xb) continue;
    const inner = r0 > 0 ? r0 * r0 - dy * dy : -1;
    if (inner <= 0) {
      each(y, xa, xb);
      continue;
    }
    // round the hole in its middle
    const hole = Math.sqrt(inner);
    const ha = Math.floor(cx - hole);
    const hb = Math.ceil(cx + hole);
    if (ha >= xa) each(y, xa, Math.min(xb, ha));
    if (hb <= xb) each(y, Math.max(xa, hb), xb);
  }
}

/**
 * The stretch of the line from p to q (0 to 1 along it) inside the box from (x0, y0) to
 * (x1, y1), or null if none of it is.
 */
function within(
  p: { x: number; y: number },
  q: { x: number; y: number },
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): [number, number] | null {
  let t0 = 0;
  let t1 = 1;
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  for (const [step, room] of [
    [-dx, p.x - x0],
    [dx, x1 - p.x],
    [-dy, p.y - y0],
    [dy, y1 - p.y],
  ]) {
    if (step === 0) {
      if (room < 0) return null;
      continue;
    }
    const t = room / step;
    if (step < 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
    if (t0 > t1) return null;
  }
  return [t0, t1];
}

/** A circle of dots round (cx, cy), one every `gap` steps round it, on the picture. */
function dottedRing(
  s: Surface,
  cx: number,
  cy: number,
  r: number,
  c: Color,
  gap: number,
): void {
  const steps = Math.max(12, Math.round(r * 6));
  // only the part of a big ring that can be on the picture
  const w = s.w;
  const h = s.h;
  if (cx + r < 0 || cx - r >= w || cy + r < 0 || cy - r >= h) return;
  let i0 = 0;
  let i1 = steps;
  const diag = Math.hypot(w, h);
  if (r > diag) {
    // the arc towards the picture's middle, as wide as the picture can see of it
    const toward = Math.atan2(h / 2 - cy, w / 2 - cx);
    const half = Math.min(Math.PI, (diag / r) * 1.2);
    i0 = Math.floor((((toward - half) / (Math.PI * 2)) * steps) / gap) * gap;
    i1 = Math.ceil(((toward + half) / (Math.PI * 2)) * steps);
  }
  for (let i = i0; i < i1; i += gap) {
    const a = (i / steps) * Math.PI * 2;
    const x = Math.round(cx + Math.cos(a) * r);
    const y = Math.round(cy + Math.sin(a) * r);
    if (x >= 0 && x < w && y >= 0 && y < h) s.px(x, y, c);
  }
}
