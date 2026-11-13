/**
 * NEXT-GEN's people and props (.snaps/era-art/THEME.md): the future's look, laid over
 * every frame of the cast's art, never a second copy of it.
 *
 * `nextgenFrames` works on the fill art (figure.ts's legend, before `figure()` outlines
 * it), frame by frame, and only rewrites cells, so every move and shot keeps its
 * silhouette and every spot stays where it was:
 * - a visor across the eyes: glass (era letter 7) from the eye to the front of the face,
 *   a shine (8) where the eye was, a strap (1) over the cheek behind it;
 * - glowing seams (5): the edge of the shirt's lit side where it meets its shaded panel,
 *   the shorts' side stripe and waistband; the trims (collar, cuffs, sock bands) burn
 *   white-hot (6);
 * - light-up soles (5): the boots' lowest row.
 * Era letters: 1 graded (`kit.eraColors[0]`), 5 to 8 lights (`kit.eraGlows`, raw).
 *
 * The kits (`nextgenKit`, called by `makeKit` for `era: "nextgen"`), the ball with glowing
 * panels and its light trail and the trophy of the future are here too. The referee is a
 * man in black with amber light (his kit here), the cast's visor over his eyes.
 */

import {
  TRANSPARENT,
  drawSprite,
  sprite,
  type Color,
  type Sprite,
  type Surface,
} from "~/pixel";
import type { Lighting } from "../lighting";
import { P } from "../palette";
import type { FrameWho } from "./era-frames";
import type { Kit, KitBase } from "./kit";

// ---------------------------------------------------------------------------
// The frame layer
// ---------------------------------------------------------------------------

/** The era letters NEXT-GEN writes (figure.ts `LEGEND`). */
export const NG = {
  /** The visor's strap over the cheek (graded). */
  strap: "1",
  /** The glow of seams, stripes and soles (a light). */
  glow: "5",
  /** The trims' white-hot glow (a light). */
  core: "6",
  /** The visor's glass (a light). */
  glass: "7",
  /** The visor's shine (a light). */
  shine: "8",
} as const;

const SKIN = new Set(["s", "S", "l", "m"]);
const SHIRT_LIT = new Set(["t", "U"]);
const SHIRT_ANY = new Set(["t", "T", "U", "r", "R"]);
const SHORTS = new Set(["p", "q"]);

type Grid = string[][];

function at(g: Grid, x: number, y: number): string {
  return g[y]?.[x] ?? ".";
}

/**
 * The eye: the topmost run of one or two `k` cells inside the face (skin either side),
 * and the row under it if the eye goes on there. Null when no face is turned to us.
 */
function findEye(
  g: Grid,
): { x0: number; x1: number; y0: number; y1: number } | null {
  for (let y = 0; y < g.length; y++) {
    const row = g[y];
    for (let x = 1; x < row.length - 1; x++) {
      if (row[x] !== "k") continue;
      let x1 = x;
      if (row[x + 1] === "k") x1 = x + 1;
      if (SKIN.has(row[x - 1]) && SKIN.has(at(g, x1 + 1, y))) {
        let y1 = y;
        const below = g[y + 1];
        if (below !== undefined) {
          for (let xx = x - 1; xx <= x1 + 1; xx++) {
            if (below[xx] === "k") y1 = y + 1;
          }
        }
        return { x0: x, x1, y0: y, y1 };
      }
      x = x1;
    }
  }
  return null;
}

/** The visor: glass from the eye forward to the face's edge, a strap behind it. */
function visor(g: Grid): void {
  const eye = findEye(g);
  if (eye === null) return;
  // He faces the side of the eye with less face before the edge.
  let right = 0;
  for (let x = eye.x1 + 1; SKIN.has(at(g, x, eye.y0)); x++) right++;
  let left = 0;
  for (let x = eye.x0 - 1; SKIN.has(at(g, x, eye.y0)); x--) left++;
  const dir = right <= left ? 1 : -1;
  const start = dir === 1 ? eye.x0 : eye.x1;
  for (let y = eye.y0; y <= eye.y1; y++) {
    for (let x = start; ; x += dir) {
      const c = at(g, x, y);
      if (c === "k" && x >= eye.x0 && x <= eye.x1) {
        g[y][x] = NG.shine;
        continue;
      }
      if (!SKIN.has(c)) break;
      g[y][x] = NG.glass;
    }
    let n = 0;
    for (let x = start - dir; ; x -= dir) {
      const c = at(g, x, y);
      if (c === "k" && n === 0 && x >= eye.x0 && x <= eye.x1) continue;
      if (!SKIN.has(c)) break;
      g[y][x] = n < 1 ? NG.glass : NG.strap;
      n++;
    }
  }
}

/** Seams, trims, stripes and soles. */
function seams(g: Grid): void {
  const h = g.length;
  const w = g[0]?.length ?? 0;
  const out = g.map((r) => r.slice());
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = g[y][x];
      if (SHIRT_LIT.has(c) && at(g, x + 1, y) === "T") {
        // the shirt's lit side where it meets the shaded panel
        out[y][x] = NG.glow;
      } else if (c === "r") {
        // the trims: collar, cuffs, sock bands
        out[y][x] = NG.core;
      } else if (SHORTS.has(c) && SHIRT_ANY.has(at(g, x, y - 1))) {
        // the waistband: the shorts' top row under the shirt
        out[y][x] = NG.glow;
      } else if (c === "p" && at(g, x + 1, y) === "q") {
        // the shorts' side stripe, where their lit side meets the shade
        out[y][x] = NG.glow;
      } else if (c === "b" || c === "B") {
        // light-up soles: a boot cell with nothing under it
        const below = at(g, x, y + 1);
        if (below === "." || below === ",") out[y][x] = NG.glow;
      }
    }
  }
  for (let y = 0; y < h; y++) g[y] = out[y];
}

/**
 * NEXT-GEN's layer over an animation's frames (rows per frame, fill art): new frames of
 * the same size, the same cells filled.
 */
export function nextgenFrames(
  who: FrameWho,
  anim: string,
  frames: readonly (readonly string[])[],
): string[][] {
  void who;
  void anim;
  return frames.map((rows) => {
    const g: Grid = rows.map((r) => Array.from(r));
    seams(g);
    visor(g);
    return g.map((r) => r.join(""));
  });
}

// ---------------------------------------------------------------------------
// The kits
// ---------------------------------------------------------------------------

/** The lights of a kit: seams, trims, the visor's glass and its shine. */
interface Lights {
  glow: Color;
  core: Color;
  glass: Color;
  shine: Color;
}

function lights(glow: Color, glass: Color, core: Color = P.white): Lights {
  return { glow, core, glass, shine: P.white };
}

/** The park kids' light-up kit colours, by variant. */
const PARK_GLOWS: readonly Color[] = [
  P.awayLight,
  P.goldLight,
  P.ledGreen,
  P.nextgenLight,
];

/**
 * A kit in NEXT-GEN: sleek, with glowing seams, trims and soles and a visor. The hero's
 * side is the mode's electric magenta (its club kit) or white with magenta light (the
 * national kit); the rivals are a dark suit with cyan light; the keeper gold with green
 * gloves of light. `kit` is today's kit of the same base (skin, hair, park colours).
 */
export function nextgenKit(base: KitBase, kit: Kit, variant: number): Kit {
  const k: Kit = { ...kit, era: "nextgen" };
  let L: Lights;
  switch (base) {
    case "home":
      Object.assign(k, {
        shirt: P.nextgen,
        shirtShade: P.nextgenDark,
        trim: P.nextgenLight,
        shorts: P.night,
        socks: P.nextgen,
        boots: P.night,
      });
      // white-hot seams on the magenta (pink on magenta is lost), a cyan visor
      L = lights(P.white, P.awayLight, P.nextgenLight);
      break;
    case "casual-home":
      Object.assign(k, {
        shirt: P.nextgen,
        shirtShade: P.nextgenDark,
        trim: P.nextgenLight,
        boots: P.night,
      });
      L = lights(P.white, P.awayLight, P.nextgenLight);
      break;
    case "away":
      Object.assign(k, {
        shirt: P.away,
        shirtShade: P.awayDark,
        trim: P.awayLight,
        boots: P.night,
      });
      L = lights(P.awayLight, P.awayLight);
      break;
    case "casual-away":
      Object.assign(k, { trim: P.awayLight, boots: P.night });
      L = lights(P.awayLight, P.awayLight);
      break;
    case "casual": {
      const g = PARK_GLOWS[variant % PARK_GLOWS.length];
      Object.assign(k, { trim: g, boots: P.night });
      L = lights(g, g);
      break;
    }
    case "rival":
      Object.assign(k, {
        shirt: P.slate,
        shirtShade: P.night,
        trim: P.awayLight,
        shorts: P.night,
        socks: P.slate,
        boots: P.ink,
      });
      L = lights(P.awayLight, P.awayLight);
      break;
    case "keeper":
      Object.assign(k, {
        shirt: P.gold,
        shirtShade: P.goldDark,
        trim: P.goldLight,
        shorts: P.night,
        socks: P.gold,
        boots: P.night,
        gloves: P.ledGreen,
      });
      L = lights(P.goldLight, P.ledGreen);
      break;
    case "national-home":
      Object.assign(k, {
        shirt: P.chalk,
        shirtShade: P.mist,
        trim: P.nextgen,
        shorts: P.nextgenDark,
        socks: P.chalk,
        boots: P.night,
      });
      L = lights(P.nextgen, P.awayLight, P.nextgenLight);
      break;
    case "national-away":
      Object.assign(k, {
        shirt: P.chalk,
        shirtShade: P.mist,
        trim: P.away,
        shorts: P.awayDark,
        socks: P.chalk,
        boots: P.night,
      });
      L = lights(P.away, P.away, P.awayLight);
      break;
    case "referee":
      Object.assign(k, {
        shirt: P.night,
        shirtShade: P.ink,
        trim: P.amber,
        shorts: P.night,
        socks: P.night,
        boots: P.ink,
      });
      // the referee: black, seams of amber light, a cool lens over the eyes
      L = lights(P.amber, P.awayLight, P.goldLight);
      break;
  }
  k.eraColors = [P.night];
  k.eraGlows = [L.glow, L.core, L.glass, L.shine];
  return k;
}

/** The ball kid in NEXT-GEN: his sky-blue bib with white light. */
export function nextgenBallKidKit(kit: Kit): Kit {
  return {
    ...kit,
    shirt: P.skyMid,
    shirtShade: P.skyTop,
    trim: P.chalk,
    shorts: P.slate,
    socks: P.chalk,
    boots: P.night,
    eraColors: [P.night],
    eraGlows: [P.skyLow, P.white, P.skyLow, P.white],
  };
}

// ---------------------------------------------------------------------------
// The ball: glowing panels, and the light trail behind it
// ---------------------------------------------------------------------------

// 6 x 6 like today's ball, the same silhouette: a pearl-white shell lit from the top left
// (w lit, m shade, s deep shade) whose panels glow (g) round a hot core (c), rolling to
// the right over the three frames.
const BALL_ART = `
.wwww.
wwgwwm
wgcgwg
wwggwm
wwwwmm
.gmmm.

.wwww.
wwwwgm
wwwgcg
gwwwgm
gwwwmm
.mmgm.

.wgww.
wwwwwm
gcwwwg
gwwwwg
wwwwmm
.mmms.
`;

let ball: Sprite | undefined;
const ballColors: Color[] = [
  TRANSPARENT,
  TRANSPARENT,
  TRANSPARENT,
  TRANSPARENT,
  TRANSPARENT,
];
const CENTER = { anchor: "center" } as const;

/**
 * NEXT-GEN's match ball, 6 x 6 centred on (x, y) like today's (`drawMatchBall`): its
 * panels glow magenta (gold for the worldie). `frame` is the spin, 3 frames.
 */
export function drawNextgenBall(
  s: Surface,
  x: number,
  y: number,
  frame: number,
  light: Lighting,
  gold: boolean,
): void {
  const l = light.lit;
  const c = ballColors;
  c[0] = l(P.white);
  c[1] = l(P.mist);
  c[2] = l(P.steel);
  c[3] = gold ? P.gold : P.nextgen;
  c[4] = gold ? P.goldLight : P.nextgenLight;
  ball ??= sprite(BALL_ART, "wmsgc");
  drawSprite(s, ball, frame, x, y, c, CENTER);
}

/** The light trail behind a struck NEXT-GEN ball, nearest first (raw: it is light). */
export const NEXTGEN_TRAIL: readonly Color[] = [
  P.white,
  P.nextgenLight,
  P.nextgenLight,
  P.nextgen,
  P.nextgen,
  P.nextgenDark,
  P.nextgenDark,
];

// ---------------------------------------------------------------------------
// The trophy of the future
// ---------------------------------------------------------------------------

// 18 x 24 like today's: a tall, narrow cup of the future with angular wing handles, a
// line of light (cyan round a white-hot core) running down its bowl into the stem, a ring
// of light on the stem, on a dark glass plinth ringed with the mode's magenta. Gold, so it
// says "cup" at 1x; no white-and-magenta pair, so it never reads as the ball.
// k ink, L gold light, g gold, d gold dark, b plinth, W the plinth's ring of light,
// c the light line, C its white core, w the glint (frame 1).
const TROPHY_ART = `
..kkkkkkkkkkkkkk..
.kkLLLLLcCggggdkk.
kLkdddddcCdddddkdk
kLkgLLggcCggggdkdk
kLkgLLggcCggggdkdk
kLLkgLggcCgggdkddk
kLLLkgLgcCggdkdddk
.kkkkgLgcCggdkkkk.
.....kgLcCgdk.....
......kLcCdk......
.......kcCk.......
.......kLdk.......
.......kLdk.......
......kLccdk......
.......kLdk.......
.......kLdk.......
.......kLdk.......
......kLLgdk......
....kkLLLggdkk....
..kkLLLgggggddkk..
.kkkkkkkkkkkkkkkk.
.kWWWWWWWWWWWWWWk.
.kbbbbbbbbbbbbbbk.
.kkkkkkkkkkkkkkkk.

..kkkkkkkkkkkkkk..
.kkLLLLLcCggggdkk.
kLkdddddcCdddddkdk
kwkgwLggcCggggdkdk
kLkgwwggcCggggdkdk
kLLkgwggcCgggdkddk
kLLLkgLgcCggdkdddk
.kkkkgLgcCggdkkkk.
.....kgLcCgdk.....
......kLcCdk......
.......kcCk.......
.......kLdk.......
.......kLdk.......
......kLccdk......
.......kLdk.......
.......kLdk.......
.......kLdk.......
......kLLgdk......
....kkLLLggdkk....
..kkLLLgggggddkk..
.kkkkkkkkkkkkkkkk.
.kWWWWWWWWWWWWWWk.
.kbbbbbbbbbbbbbbk.
.kkkkkkkkkkkkkkkk.
`;

let trophy: Sprite | undefined;
const trophyColors: Color[] = new Array<Color>(9).fill(TRANSPARENT);

/**
 * The trophy of the future, 18 x 24 standing on (x, y) like today's (`drawTrophy`): its
 * light line and the plinth's ring are lights, the gold and the plinth are lit as the
 * pitch is.
 */
export function drawNextgenTrophy(
  s: Surface,
  x: number,
  y: number,
  light: Lighting,
  glint: boolean,
): void {
  const l = light.lit;
  const c = trophyColors;
  c[0] = l(P.ink);
  c[1] = l(P.goldLight);
  c[2] = l(P.gold);
  c[3] = l(P.goldDark);
  c[4] = l(P.night);
  c[5] = P.nextgen;
  c[6] = P.awayLight;
  c[7] = P.white;
  c[8] = P.white;
  trophy ??= sprite(TROPHY_ART, "kLgdbWcCw");
  drawSprite(s, trophy, glint ? 1 : 0, x, y, c, { anchor: "bottom-center" });
  if (light.lightsOn) {
    // by night its line of light shines up out of the bowl: a stepped flare over the rim
    // in the line's own colours, white-hot at the rim, so it holds against a bright crowd
    const cx = x - 1;
    const top = y - 24;
    s.hline(cx - 1, top - 1, 4, P.awayLight);
    s.hline(cx, top - 1, 2, P.white);
    s.hline(cx, top - 2, 2, P.awayLight);
    s.hline(cx, top - 3, 2, P.away);
  }
}
