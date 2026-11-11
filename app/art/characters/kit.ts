/**
 * Kits: the colours a person is drawn in. Every slot is a palette colour; three more tones
 * (shorts, socks and glove shade) are derived when drawing.
 */

import { shade, type Color } from "~/pixel";
import type { Lighting } from "../lighting";
import { P } from "../palette";

export interface Kit {
  outline: Color;
  skin: Color;
  skinShade: Color;
  hair: Color;
  shirt: Color;
  shirtShade: Color;
  trim: Color;
  shorts: Color;
  socks: Color;
  boots: Color;
  gloves: Color;
}

export type KitBase =
  | "home"
  | "away"
  | "casual-home"
  | "casual-away"
  | "casual"
  | "rival"
  | "keeper"
  | "national-home"
  | "national-away"
  | "referee";

export const KIT_BASES: readonly KitBase[] = [
  "home",
  "away",
  "casual-home",
  "casual-away",
  "casual",
  "rival",
  "keeper",
  "national-home",
  "national-away",
  "referee",
];

type Look = 0 | 1 | 2;

/** The hero's skin and hair, at every tier. */
export const HERO_LOOK: Look = 1;

const LOOKS: readonly { skin: Color; skinShade: Color; hair: Color }[] = [
  { skin: P.skinA, skinShade: P.skinAShade, hair: P.hairBrown },
  { skin: P.skinB, skinShade: P.skinBShade, hair: P.hairDark },
  { skin: P.skinC, skinShade: P.skinCShade, hair: P.hairDark },
];

/** Tops for the other children in the park: never a mode colour, gold or green. */
const CASUAL_TOPS: readonly [Color, Color][] = [
  [P.skyMid, P.skyTop],
  [P.dawnMid, P.duskMid],
  [P.concreteLight, P.concrete],
  [P.brickLight, P.brick],
  [P.chalk, P.mist],
  [P.dawnLow, P.brickLight],
];
const CASUAL_SHORTS: readonly Color[] = [P.slate, P.steel, P.night, P.wood];

type Top = Pick<Kit, "shirt" | "shirtShade" | "trim">;
type Bottom = Pick<Kit, "shorts" | "socks" | "boots">;

function top(shirt: Color, shirtShade: Color, trim: Color): Top {
  return { shirt, shirtShade, trim };
}

function bottom(shorts: Color, socks: Color, boots: Color = P.night): Bottom {
  return { shorts, socks, boots };
}

/**
 * A kit for a base. Only "keeper" has gloves (lime); in every other kit the glove slot is
 * the bare hand (the skin). `look` picks one of three skin and hair combinations (default
 * `HERO_LOOK`); `variant` picks the top's colour for "casual" (and the shorts of every park
 * kit), so a row of children can all differ.
 */
export function makeKit(
  base: KitBase,
  opts?: { look?: Look; variant?: number },
): Kit {
  const look = LOOKS[opts?.look ?? HERO_LOOK] ?? LOOKS[HERO_LOOK];
  const v = Math.abs(Math.floor(opts?.variant ?? 0));
  const parkShorts = CASUAL_SHORTS[v % CASUAL_SHORTS.length];
  let t: Top;
  let b: Bottom;
  switch (base) {
    case "home":
      t = top(P.home, P.homeDark, P.chalk);
      b = bottom(P.chalk, P.home);
      break;
    case "away":
      t = top(P.away, P.awayDark, P.chalk);
      b = bottom(P.night, P.away);
      break;
    case "casual-home":
      t = top(P.home, P.homeDark, P.homeLight);
      b = bottom(parkShorts, P.chalk, P.slate);
      break;
    case "casual-away":
      t = top(P.away, P.awayDark, P.awayLight);
      b = bottom(parkShorts, P.chalk, P.slate);
      break;
    case "casual": {
      const [shirt, shirtShade] = CASUAL_TOPS[v % CASUAL_TOPS.length];
      t = top(shirt, shirtShade, shade(shirt, 0.3));
      b = bottom(parkShorts, P.chalk, P.slate);
      break;
    }
    case "rival":
      t = top(P.duskMid, P.duskTop, P.chalk);
      b = bottom(P.duskTop, P.duskMid);
      break;
    case "keeper":
      t = top(P.gold, P.goldDark, P.night);
      b = bottom(P.night, P.gold);
      break;
    case "national-home":
      t = top(P.chalk, P.mist, P.home);
      b = bottom(P.homeDark, P.chalk);
      break;
    case "national-away":
      t = top(P.chalk, P.mist, P.away);
      b = bottom(P.awayDark, P.chalk);
      break;
    case "referee":
      t = top(P.slate, P.night, P.mist);
      b = bottom(P.night, P.night, P.ink);
      break;
  }
  // Only the keeper wears gloves; everyone else's glove slot is a bare hand, so a child
  // in the keeper kit gets gloves on the youth frames without art of his own.
  const gloves = base === "keeper" ? P.grassHi : look.skin;
  return { outline: P.ink, ...look, ...t, ...b, gloves };
}

/** Every slot graded by `light.lit` (people are always lit as the pitch is). */
export function litKit(kit: Kit, light: Lighting): Kit {
  const l = light.lit;
  return {
    outline: l(kit.outline),
    skin: l(kit.skin),
    skinShade: l(kit.skinShade),
    hair: l(kit.hair),
    shirt: l(kit.shirt),
    shirtShade: l(kit.shirtShade),
    trim: l(kit.trim),
    shorts: l(kit.shorts),
    socks: l(kit.socks),
    boots: l(kit.boots),
    gloves: l(kit.gloves),
  };
}

const shades = new Map<Color, Color>();

/** One ramp step darker, cached (a kit is drawn many times a frame). */
export function darker(c: Color): Color {
  let d = shades.get(c);
  if (d === undefined) {
    if (shades.size > 1024) shades.clear();
    d = shade(c, -0.28);
    shades.set(c, d);
  }
  return d;
}

/** The kit as the colour array for the figure legend "khsStTrpqoObgG". Reuses one array. */
const scratch: Color[] = new Array<Color>(14);
export function kitColors(kit: Kit): readonly Color[] {
  scratch[0] = kit.outline;
  scratch[1] = kit.hair;
  scratch[2] = kit.skin;
  scratch[3] = kit.skinShade;
  scratch[4] = kit.shirt;
  scratch[5] = kit.shirtShade;
  scratch[6] = kit.trim;
  scratch[7] = kit.shorts;
  scratch[8] = darker(kit.shorts);
  scratch[9] = kit.socks;
  scratch[10] = darker(kit.socks);
  scratch[11] = kit.boots;
  scratch[12] = kit.gloves;
  // A bare hand on the far side is in skin shade, like the rest of the far arm.
  scratch[13] = kit.gloves === kit.skin ? kit.skinShade : darker(kit.gloves);
  return scratch;
}
