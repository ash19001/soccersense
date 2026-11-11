/**
 * Shots for the art foundations: palette, lighting and sky.
 *
 *   ./node_modules/.bin/tsx tools/snap.ts core/palette --scale 3
 *   ./node_modules/.bin/tsx tools/snap.ts core/lighting
 *   ./node_modules/.bin/tsx tools/snap.ts core/sky --time all
 *   ./node_modules/.bin/tsx tools/snap.ts core/sky-times
 *   ./node_modules/.bin/tsx tools/snap.ts core/sky-wide --scale 2
 *
 * And the working shots the foundations were tuned with. Add --morning (with any --sun)
 * to the sky rows for the sunrise side.
 *
 *   core/grades         HOME and AWAY on every ground, then every ramp under env and lit
 *   core/bodies         the sun at seven heights, the moon at seven phases
 *   core/clouds         every cloud shape in the current light
 *   core/sky-sweep      eleven skies from mid afternoon to night
 *   core/sky-suns       the sky at 70, 25, 10, 4, 2, 0, -2, -6 and -12 degrees
 *   core/sky-fine       twelve skies from +8 to -8 degrees: no jump between neighbours
 *   core/sky-seeds      six seeds in the current light
 *   core/layout-menu    the home screen's zones over the real sky
 *   core/layout-career  the career scene's shared lines over a stand-in ground
 */

import {
  FONT_3x5,
  Surface,
  drawSprite,
  drawText,
  hash2,
  rng,
  sprite,
  spriteColors,
  type Color,
  type ShotMap,
  type Sun,
} from "~/pixel";
import { careerLayout, menuLayout } from "./layout";
import { distant, lightingFor, skyFor, type Lighting } from "./lighting";
import { P, PALETTE_HEX, type PaletteName } from "./palette";
import { cloudSprite, drawSky } from "./sky";

const SMALL = { font: FONT_3x5 } as const;

// ---------------------------------------------------------------------------
// core/palette
// ---------------------------------------------------------------------------

const GROUPS: readonly (readonly [string, readonly PaletteName[]])[] = [
  ["NEUTRALS", ["ink", "night", "slate", "steel", "mist", "chalk", "white"]],
  ["GRASS", ["grassDeep", "grassDark", "grass", "grassLight", "grassHi"]],
  ["DAY SKY", ["skyTop", "skyMid", "skyLow", "haze"]],
  ["DUSK SKY", ["duskTop", "duskMid", "duskLow", "duskGlow"]],
  ["DAWN SKY", ["dawnTop", "dawnMid", "dawnLow", "dawnGlow"]],
  ["NIGHT SKY", ["nightTop", "nightMid", "nightLow", "nightGlow"]],
  ["CLOUDS", ["cloudShade", "cloud", "cloudLight"]],
  ["SUN AND MOON", ["sun", "moon", "moonShade"]],
  ["STRUCTURE", ["concreteDark", "concrete", "concreteLight", "steelHi"]],
  ["WARM BUILDINGS", ["brickDark", "brick", "brickLight", "woodDark", "wood"]],
  [
    "SKIN",
    ["skinAShade", "skinA", "skinBShade", "skinB", "skinCShade", "skinC"],
  ],
  ["HAIR", ["hairDark", "hairBrown", "hairBlond"]],
  ["HOME", ["homeDark", "home", "homeLight"]],
  ["AWAY", ["awayDark", "away", "awayLight"]],
  ["GOLD", ["goldDark", "gold", "goldLight"]],
  ["SCOREBOARD", ["ledOff", "amberDim", "amber", "ledGreen", "ledRed"]],
  [
    "GRADES",
    [
      "gradeWorldie",
      "gradeTopbins",
      "gradeGoal",
      "gradeOntarget",
      "gradeWide",
      "gradeTimeup",
    ],
  ],
];

function paletteCard(): Surface {
  const cellW = 56;
  const rowH = 38;
  const cols = 7;
  const s = new Surface(12 + cols * cellW, 6 + GROUPS.length * rowH);
  s.clear(P.ink);
  GROUPS.forEach(([title, names], row) => {
    const y = 5 + row * rowH;
    drawText(s, title, 6, y, P.chalk, SMALL);
    // A frame, so the darkest swatches still show their edges.
    s.frame(5, y + 7, names.length * cellW + 2, 12, P.steel);
    names.forEach((name, i) => {
      const x = 6 + i * cellW;
      // Swatches touch, so each colour is judged against its neighbours in the ramp.
      s.rect(x, y + 8, cellW, 10, P[name]);
      drawText(s, name, x, y + 21, P.mist, SMALL);
      drawText(s, PALETTE_HEX[name].slice(1), x, y + 28, P.steel, SMALL);
    });
  });
  return s;
}

// ---------------------------------------------------------------------------
// core/grades: the ramps against each other, raw and under every light
// ---------------------------------------------------------------------------

type Ramp = readonly PaletteName[];

const HOME_RAMP: Ramp = ["homeDark", "home", "homeLight"];
const AWAY_RAMP: Ramp = ["awayDark", "away", "awayLight"];

/** A ramp as one chip: its tones side by side, dark to light, touching. */
function chip(
  s: Surface,
  x: number,
  y: number,
  names: Ramp,
  grade: (c: Color) => Color,
): void {
  names.forEach((name, i) => s.rect(x + i * 4, y, 4, 9, grade(P[name])));
}

/** HOME and AWAY laid on every ground they will be seen against, in raw palette colours. */
function modesOnGrounds(): Surface {
  const grounds: Ramp = [
    "grassDeep",
    "grassDark",
    "grass",
    "grassLight",
    "grassHi",
    "ink",
    "night",
    "nightTop",
    "nightMid",
    "nightLow",
    "ledOff",
    "slate",
    "chalk",
    "skyMid",
    "duskLow",
  ];
  const cell = 30;
  const s = new Surface(grounds.length * cell, 40);
  grounds.forEach((ground, i) => {
    const x = i * cell;
    s.rect(x, 0, cell, 40, P[ground]);
    chip(s, x + 9, 6, HOME_RAMP, (c) => c);
    chip(s, x + 9, 20, AWAY_RAMP, (c) => c);
    drawText(s, ground.slice(0, 7), x + 1, 33, P.steel, SMALL);
  });
  return s;
}

/** One strip of ramps on a striped pitch, all through one grade. */
function gradeStrip(grade: (c: Color) => Color, label: string): Surface {
  const ramps: readonly Ramp[] = [
    HOME_RAMP,
    AWAY_RAMP,
    ["goldDark", "gold", "goldLight"],
    ["skinAShade", "skinA"],
    ["skinBShade", "skinB"],
    ["skinCShade", "skinC"],
    ["hairDark", "hairBrown", "hairBlond"],
    ["ink", "slate", "steel"],
    ["mist", "chalk", "white"],
    ["concreteDark", "concrete", "concreteLight", "steelHi"],
    ["brickDark", "brick", "brickLight"],
    ["woodDark", "wood"],
    ["gradeTopbins", "gradeGoal", "gradeOntarget", "gradeWide"],
  ];
  let w = 6;
  for (const ramp of ramps) w += ramp.length * 4 + 5;
  const s = new Surface(w, 31);
  // A pitch: mown stripes, a touchline, the darker foreground.
  s.rect(0, 0, w, 31, grade(P.grass));
  for (let x = 0; x < w; x += 24) s.rect(x, 0, 12, 22, grade(P.grassLight));
  s.rect(0, 0, w, 2, grade(P.grassDark));
  s.rect(0, 4, w, 1, grade(P.chalk));
  s.rect(0, 22, w, 9, grade(P.grassDark));
  s.rect(0, 22, w, 1, grade(P.grassDeep));
  let x = 6;
  for (const ramp of ramps) {
    chip(s, x, 9, ramp, grade);
    x += ramp.length * 4 + 5;
  }
  drawText(s, label, 3, 24, P.chalk, SMALL);
  return s;
}

function gradesCard(): Surface {
  const rows: Surface[] = [modesOnGrounds()];
  for (const [label, sun] of SIX_SUNS) {
    const light = lightingFor(sun);
    rows.push(
      row(
        [
          gradeStrip(light.env, `${label} ENV`),
          gradeStrip(light.lit, `${label} LIT`),
        ],
        2,
      ),
    );
  }
  return column(rows, 2);
}

// ---------------------------------------------------------------------------
// Suns
// ---------------------------------------------------------------------------

const SIX_SUNS: readonly (readonly [string, Sun])[] = [
  ["NIGHT", { elevation: -30, morning: false }],
  ["DAWN", { elevation: -3, morning: true }],
  ["MORNING", { elevation: 24, morning: true }],
  ["NOON", { elevation: 60, morning: false }],
  ["GOLDEN", { elevation: 6, morning: false }],
  ["DUSK", { elevation: -3, morning: false }],
];

// ---------------------------------------------------------------------------
// A simple skyline, so the sky can be judged as a backdrop
// ---------------------------------------------------------------------------

function skyline(
  s: Surface,
  light: Lighting,
  horizonY: number,
  seed: number,
): void {
  // The same slate at two distances: the far row sinks into the low sky.
  const far = distant(light, P.slate, 0.6);
  const near = distant(light, P.slate, 0.15);
  const r = rng(seed + 77);
  // Far rooftops.
  for (let x = -4; x < s.w;) {
    const bw = r.int(6, 13);
    const bh = r.int(3, 8);
    s.rect(x, horizonY - bh, bw, bh, far);
    if (r.chance(0.3)) s.rect(x + 1, horizonY - bh - 2, 2, 2, far);
    x += bw + r.int(0, 3);
  }
  // Nearer, darker blocks with the odd lit window.
  for (let x = -2; x < s.w;) {
    const bw = r.int(8, 18);
    const bh = r.int(2, 5);
    s.rect(x, horizonY - bh, bw, bh, near);
    if (light.lightsOn && bh >= 4 && hash2(x, 3, seed) < 0.6) {
      s.px(
        x + 2 + Math.floor(hash2(x, 9, seed) * (bw - 4)),
        horizonY - 3,
        P.gold,
      );
    }
    x += bw + r.int(1, 6);
  }
  s.rect(0, horizonY, s.w, s.h - horizonY, light.env(P.grassDark));
  s.rect(0, horizonY, s.w, 1, light.env(P.grassDeep));
}

function skyPanel(
  w: number,
  h: number,
  horizonY: number,
  sun: Sun,
  t: number,
  seed: number,
  label?: string,
): Surface {
  const s = new Surface(w, h);
  const light = lightingFor(sun);
  drawSky(s, { light, t, seed, horizonY });
  skyline(s, light, horizonY, seed);
  if (label) drawText(s, label, 3, h - 7, P.chalk, SMALL);
  return s;
}

// ---------------------------------------------------------------------------
// core/lighting: one small scene under six suns
// ---------------------------------------------------------------------------

const FIGURE = sprite(
  `
...hhhh...
..hhhhhh..
..hssssh..
..ssssss..
...sSSs...
..kkkkkk..
.kkkkkkkk.
.kKkkkkKk.
.sKkkkkKs.
.s.kkkk.s.
...wwww...
...wwWw...
...ss.ss..
...sS.sS..
...cc.cc..
...cc.cc..
..bbb.bbb.
`,
  "hsSkKwWcb",
);

function figure(
  layer: Surface,
  x: number,
  groundY: number,
  kit: Color,
  kitDark: Color,
  skin: Color,
  skinShade: Color,
  hair: Color,
): void {
  const cell = new Surface(12, 19);
  drawSprite(
    cell,
    FIGURE,
    0,
    1,
    1,
    spriteColors(FIGURE, {
      h: hair,
      s: skin,
      S: skinShade,
      k: kit,
      K: kitDark,
      w: P.chalk,
      W: P.mist,
      c: kit,
      b: P.ink,
    }),
  );
  cell.outline(P.ink);
  // A hard little shadow, falling to the bottom right.
  layer.rect(x - 3, groundY - 1, 10, 1, P.grassDeep);
  layer.rect(x - 1, groundY, 7, 1, P.grassDeep);
  layer.blit(cell, x - 6, groundY - 18);
}

/** A small scene under one sun: sky, backdrop graded by `env`, pitch and players by `lit`. */
function vignette(sun: Sun, label: string, t: number, seed: number): Surface {
  const w = 110;
  const h = 124;
  const horizonY = 72;
  const light = lightingFor(sun);
  const s = new Surface(w, h);
  drawSky(s, { light, t, seed, horizonY, clouds: 0.35 });

  const lampX = 98;
  const lampY = horizonY - 50;
  // The lamps' glow goes down first, so the lamp head stays crisp on top of it.
  if (light.lightsOn) {
    s.disc(lampX, lampY, 11, P.steelHi, 0.25);
    s.disc(lampX, lampY, 8, P.white, 0.5);
  }

  // Backdrop, painted in daylight colours and graded by the sky.
  const back = new Surface(w, h);
  // concrete wall: light top edge, shade along the foot, joints
  back.rect(0, horizonY - 13, 34, 13, P.concrete);
  back.rect(0, horizonY - 13, 34, 2, P.concreteLight);
  back.rect(0, horizonY - 3, 34, 3, P.concreteDark);
  for (let x = 10; x < 34; x += 11) {
    back.vline(x, horizonY - 11, 8, P.concreteDark);
  }
  // tree: three tones of leaf, lit from the top left
  back.rect(43, horizonY - 12, 3, 12, P.wood);
  back.vline(45, horizonY - 12, 12, P.woodDark);
  back.disc(44, horizonY - 21, 10, P.grassDeep);
  back.disc(43, horizonY - 22, 9, P.grassDark);
  back.disc(41, horizonY - 24, 6, P.grass);
  back.disc(39, horizonY - 26, 3, P.grassLight);
  // brick house
  const hx = 60;
  const hy = horizonY - 21;
  back.rect(hx, hy, 28, 21, P.brick);
  for (let y = hy + 2; y < horizonY; y += 3) {
    back.hline(hx, y, 28, P.brickDark);
  }
  back.rect(hx + 21, hy, 7, 21, P.brickDark);
  back.rect(hx, hy, 2, 21, P.brickLight);
  back.rect(hx + 19, hy - 14, 4, 8, P.brickDark);
  back.poly(
    [
      [hx - 3, hy],
      [hx + 5, hy - 9],
      [hx + 23, hy - 9],
      [hx + 30, hy],
    ],
    P.slate,
  );
  back.hline(hx + 5, hy - 9, 19, P.steel);
  back.rect(hx + 13, horizonY - 10, 5, 10, P.woodDark);
  back.px(hx + 16, horizonY - 5, P.gold);
  back.rect(hx + 3, hy + 5, 7, 7, P.chalk);
  back.rect(hx + 4, hy + 6, 5, 5, P.night);
  // floodlight: pole and lamp head
  back.rect(lampX - 1, lampY, 2, 50, P.concreteLight);
  back.vline(lampX, lampY, 50, P.concrete);
  back.rect(lampX - 7, lampY - 4, 14, 8, P.concreteDark);
  back.recolor(light.env);
  s.blit(back, 0, 0);

  // Light sources keep their raw colour: the lit window and the lamps.
  if (light.lightsOn) {
    s.rect(hx + 4, hy + 6, 5, 5, P.gold);
    s.rect(hx + 4, hy + 6, 5, 2, P.goldLight);
  }
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 2; j++) {
      const c = light.lightsOn ? P.white : light.env(P.steelHi);
      s.rect(lampX - 6 + i * 4, lampY - 3 + j * 3, 3, 2, c);
    }
  }

  // Pitch and players, graded by the floodlights when they are on.
  const pitch = new Surface(w, h);
  pitch.rect(0, horizonY, w, h - horizonY, P.grass);
  for (let x = 0; x < w; x += 28) {
    pitch.rect(x, horizonY, 14, h - horizonY, P.grassLight);
  }
  pitch.rect(0, horizonY, w, 2, P.grassDark);
  pitch.rect(0, horizonY + 6, w, 1, P.chalk);
  pitch.rect(0, h - 15, w, 15, P.grassDark);
  pitch.rect(0, h - 15, w, 1, P.grassDeep);
  figure(
    pitch,
    22,
    horizonY + 27,
    P.home,
    P.homeDark,
    P.skinA,
    P.skinAShade,
    P.hairBlond,
  );
  figure(
    pitch,
    52,
    horizonY + 31,
    P.away,
    P.awayDark,
    P.skinB,
    P.skinBShade,
    P.hairDark,
  );
  figure(
    pitch,
    82,
    horizonY + 27,
    P.gold,
    P.goldDark,
    P.skinC,
    P.skinCShade,
    P.hairBrown,
  );
  pitch.recolor(light.lit);
  s.blit(pitch, 0, 0);

  drawText(s, label, 3, h - 7, P.chalk, SMALL);
  return s;
}

// ---------------------------------------------------------------------------

function row(panels: readonly Surface[], gap: number): Surface {
  const w = panels.reduce((sum, p) => sum + p.w, 0) + gap * (panels.length - 1);
  const h = Math.max(...panels.map((p) => p.h));
  const s = new Surface(w, h);
  s.clear(P.ink);
  let x = 0;
  for (const p of panels) {
    s.copy(p, x, 0);
    x += p.w + gap;
  }
  return s;
}

function column(panels: readonly Surface[], gap: number): Surface {
  const w = Math.max(...panels.map((p) => p.w));
  const h = panels.reduce((sum, p) => sum + p.h, 0) + gap * (panels.length - 1);
  const s = new Surface(w, h);
  s.clear(P.ink);
  let y = 0;
  for (const p of panels) {
    s.copy(p, 0, y);
    y += p.h + gap;
  }
  return s;
}

export const shots: ShotMap = {
  "core/clouds": (ctx) => cloudSheet(ctx.sun, ctx.seed),

  "core/layout-menu": (ctx) =>
    menuGuide(ctx.w, ctx.h, ctx.sun, ctx.t, ctx.seed),

  "core/layout-career": (ctx) =>
    careerGuide(ctx.w, ctx.h, ctx.sun, ctx.t, ctx.seed),

  "core/sky-sweep": (ctx) => skySweep(ctx.sun.morning, ctx.t, ctx.seed),

  "core/sky-suns": (ctx) =>
    skyRow(
      [70, 25, 10, 4, 2, 0, -2, -6, -12],
      130,
      ctx.sun.morning,
      ctx.t,
      ctx.seed,
    ),

  "core/sky-fine": (ctx) =>
    skyRow(
      Array.from({ length: 12 }, (_, i) => 8 - (16 * i) / 11),
      84,
      ctx.sun.morning,
      ctx.t,
      ctx.seed,
    ),

  // Six different skies in the current light: how the clouds and stars compose by seed.
  "core/sky-seeds": (ctx) => {
    const { horizonY } = menuLayout(ctx.w, ctx.h);
    return row(
      [0, 1, 2, 3, 4, 5].map((i) =>
        skyPanel(
          ctx.w,
          horizonY + 12,
          horizonY,
          ctx.sun,
          ctx.t,
          ctx.seed + i,
          `SEED ${ctx.seed + i}`,
        ),
      ),
      1,
    );
  },

  "core/palette": () => paletteCard(),

  "core/bodies": (ctx) => bodiesSheet(ctx.t, ctx.seed),

  "core/grades": () => gradesCard(),

  "core/lighting": (ctx) =>
    row(
      SIX_SUNS.map(([label, sun]) => vignette(sun, label, ctx.t, ctx.seed)),
      2,
    ),

  "core/sky": (ctx) => {
    const { horizonY } = menuLayout(ctx.w, ctx.h);
    return skyPanel(ctx.w, ctx.h, horizonY, ctx.sun, ctx.t, ctx.seed);
  },

  "core/sky-times": (ctx) => {
    const { horizonY } = menuLayout(130, 281);
    return row(
      SIX_SUNS.map(([label, sun]) =>
        skyPanel(130, horizonY + 12, horizonY, sun, ctx.t, ctx.seed, label),
      ),
      2,
    );
  },

  "core/sky-wide": (ctx) => {
    const { horizonY } = menuLayout(480, 270);
    return column(
      SIX_SUNS.map(([label, sun]) =>
        skyPanel(480, horizonY + 12, horizonY, sun, ctx.t, ctx.seed, label),
      ),
      2,
    );
  },
};

function cloudSheet(sun: Sun, seed: number): Surface {
  const light = lightingFor(sun);
  const spec = skyFor(light);
  const s = new Surface(250, 150);
  s.clear(spec.bands[2]);
  s.rect(0, 100, 250, 50, spec.bands[4]);
  const r = rng(seed + 5);
  let x = 4;
  let y = 22;
  for (let i = 0; i < 16; i++) {
    const far = i >= 9;
    const width = far ? 12 + (i - 9) * 2 : 24 + Math.round(i * 2.5);
    const c = cloudSprite(
      r.int(0, 1 << 30),
      width,
      far ? spec.cloudFar : spec.cloudNear,
    );
    if (x + c.w > 246) {
      x = 4;
      y += far ? 22 : 26;
    }
    if (far && y < 100) {
      x = 4;
      y = 124;
    }
    s.blit(c, x, y - c.h + 1);
    x += c.w + 6;
  }
  return s;
}

/** The sun at seven heights and the moon at seven phases, with no clouds in the way. */
function bodiesSheet(t: number, seed: number): Surface {
  const w = 44;
  const h = 60;
  const suns = [70, 30, 12, 6, 2, 0, -1.5].map((elevation) => {
    const s = new Surface(w, h);
    const light = lightingFor({ elevation, morning: false });
    drawSky(s, { light, t, seed, horizonY: h, clouds: 0, sunX: 22 });
    drawText(s, String(elevation), 2, h - 7, P.ink, SMALL);
    return s;
  });
  const moons = [0.08, 0.25, 0.4, 0.5, 0.6, 0.75, 0.92].map((moonPhase) => {
    const s = new Surface(w, h);
    const light = lightingFor({ elevation: -30, morning: false });
    drawSky(s, {
      light,
      t,
      seed,
      horizonY: h,
      clouds: 0,
      moonPhase,
      moon: { x: 22, y: 26 },
    });
    drawText(s, String(moonPhase), 2, h - 7, P.mist, SMALL);
    return s;
  });
  return column([row(suns, 1), row(moons, 1)], 1);
}

/** A row of skies at the given elevations, each exactly what core/sky draws at that width. */
function skyRow(
  elevations: readonly number[],
  w: number,
  morning: boolean,
  t: number,
  seed: number,
): Surface {
  const { horizonY } = menuLayout(130, 281);
  return row(
    elevations.map((elevation) =>
      skyPanel(
        w,
        horizonY + 12,
        horizonY,
        { elevation, morning },
        t,
        seed,
        String(Math.round(elevation * 2) / 2),
      ),
    ),
    1,
  );
}

/** The evening (or, with --morning, the morning) as a row of skies, sun going down. */
function skySweep(morning: boolean, t: number, seed: number): Surface {
  const { horizonY } = menuLayout(130, 281);
  const elevations = [30, 12, 6, 3, 0, -2, -4, -6, -9, -12, -18];
  return row(
    elevations.map((elevation) =>
      skyPanel(
        100,
        horizonY + 12,
        horizonY,
        { elevation, morning },
        t,
        seed,
        String(elevation),
      ),
    ),
    1,
  );
}

/** The home screen's zones over the real sky: what the sky has to work around. */
function menuGuide(
  w: number,
  h: number,
  sun: Sun,
  t: number,
  seed: number,
): Surface {
  const m = menuLayout(w, h);
  const light = lightingFor(sun);
  const s = new Surface(w, h);
  drawSky(s, { light, t, seed, ...m.sky });
  // the land from the horizon down, and the ground in front of the stadium
  s.rect(0, m.horizonY, m.w, m.h - m.horizonY, light.env(P.grass));
  s.rect(
    m.pitch.x,
    m.pitch.y,
    m.pitch.w,
    m.pitch.h,
    light.env(P.concreteLight),
  );
  // the stadium: its box, a plain bowl in it, a cross on the centre spot
  const z = m.stand;
  s.ellipse(
    z.x + Math.floor(z.w / 2),
    z.y + Math.floor(z.h / 2),
    z.w / 2,
    z.h / 2,
    light.env(P.steelHi),
    true,
  );
  s.frame(z.x, z.y, z.w, z.h, light.env(P.home));
  s.hline(m.cx - 3, m.spotY, 7, P.ink);
  s.vline(m.cx, m.spotY - 3, 7, P.ink);
  // the sign (the field is still called scoreboard)
  const b = m.scoreboard;
  s.rect(b.x, b.y, b.w, b.h, P.ledOff);
  s.frame(b.x, b.y, b.w, b.h, light.env(P.concrete));
  drawText(s, "TODAY'S STADIUM", b.x + Math.floor(b.w / 2), b.y + 5, P.amber, {
    font: FONT_3x5,
    align: "center",
  });
  // the ball, floating
  s.disc(m.cx, m.ballCy, m.ballR, P.ink);
  s.disc(m.cx, m.ballCy, m.ballR - 1, light.lit(P.chalk));
  // what the interface covers
  s.dither(m.caption.x, m.caption.y, m.caption.w, m.caption.h, P.ink, 0.5);
  s.frame(m.logo.x, m.logo.y, m.logo.w, m.logo.h, P.gold);
  drawText(s, "LOGO ZONE", m.cx, m.logo.y + 3, P.gold, {
    font: FONT_3x5,
    align: "center",
  });
  return s;
}

/**
 * The career scene's shared lines over a stand-in ground: the sky, a blank stand, the
 * pitch between its touchlines, hero, keeper and goal. Gold lines are the action band,
 * dither is what the interface covers while a question is being asked, and the two mist
 * lines are where the board shrinks to and where the reveal sheet comes up to.
 */
function careerGuide(
  w: number,
  h: number,
  sun: Sun,
  t: number,
  seed: number,
): Surface {
  const c = careerLayout(w, h);
  const light = lightingFor(sun);
  const s = new Surface(w, h);
  drawSky(s, {
    light,
    t,
    seed,
    horizonY: c.farTouchY,
    clearTop: c.boardShrunkY,
  });
  // a blank stand behind the far touchline
  const standTop = c.actionTop + 8;
  s.rect(0, standTop, w, c.farTouchY - standTop, light.lit(P.concreteDark));
  s.rect(0, standTop, w, 2, light.lit(P.concreteLight));
  s.rect(0, c.farTouchY - 5, w, 5, light.lit(P.slate));

  const pitch = new Surface(w, h);
  pitch.rect(0, c.farTouchY, w, h - c.farTouchY, P.grass);
  for (let x = (c.cx % 32) - 32; x < w; x += 32) {
    pitch.rect(x, c.farTouchY, 16, c.nearTouchY - c.farTouchY, P.grassLight);
  }
  pitch.rect(0, c.farTouchY, w, 1, P.chalk);
  pitch.rect(0, c.nearTouchY, w, 1, P.chalk);
  pitch.rect(0, c.nearTouchY + 1, w, h - c.nearTouchY - 1, P.grassDark);
  pitch.rect(0, c.nearTouchY + 7, w, 1, P.grassDeep);
  // the goal, side on: near post, crossbar going back, the net behind
  const goalH = 24;
  pitch.dither(
    c.goalX + 1,
    c.groundY - goalH + 3,
    11,
    goalH - 3,
    P.chalk,
    0.25,
  );
  pitch.rect(c.goalX, c.groundY - goalH, 2, goalH, P.white);
  pitch.rect(c.goalX, c.groundY - goalH, 12, 2, P.white);
  pitch.line(
    c.goalX + 12,
    c.groundY - goalH + 1,
    c.goalX + 15,
    c.groundY - 1,
    P.mist,
  );
  figure(
    pitch,
    c.heroX,
    c.groundY,
    P.home,
    P.homeDark,
    P.skinA,
    P.skinAShade,
    P.hairBrown,
  );
  figure(
    pitch,
    c.keeperX,
    c.groundY,
    P.gradeTopbins,
    P.gradeGoal,
    P.skinB,
    P.skinBShade,
    P.hairDark,
  );
  pitch.recolor(light.lit);
  s.blit(pitch, 0, 0);

  // the band that every interface state leaves visible
  s.hline(0, c.actionTop, w, P.gold);
  s.hline(0, c.actionBottom, w, P.gold);
  drawText(s, "ACTION BAND", 2, c.actionTop + 2, P.gold, SMALL);
  // the stage
  s.vline(c.stageLeft, c.actionTop, c.actionBottom - c.actionTop, P.gold);
  s.vline(c.stageRight - 1, c.actionTop, c.actionBottom - c.actionTop, P.gold);
  // what the interface covers while asking, and where it moves to after an answer
  s.dither(0, 0, w, c.boardAskingY, P.ink, 0.5);
  s.dither(0, c.answerBarY, w, h - c.answerBarY, P.ink, 0.5);
  s.hline(0, c.boardShrunkY, w, P.mist);
  drawText(s, "BOARD SHRINKS TO", 2, c.boardShrunkY - 7, P.mist, SMALL);
  s.hline(0, c.sheetY, w, P.mist);
  drawText(s, "SHEET COMES UP TO", 2, c.sheetY + 3, P.mist, SMALL);
  return s;
}
