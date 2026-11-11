/**
 * Engine test cards. Render with:
 *
 *   ./node_modules/.bin/tsx tools/snap.ts pixel/testcard
 *   ./node_modules/.bin/tsx tools/snap.ts pixel/fonts
 *   ./node_modules/.bin/tsx tools/snap.ts pixel/sprite --strip 2 --dt 0.25
 *
 * These return their own sizes and ignore `ctx.w` and `ctx.h`.
 *
 * The colours below are the art bible's v0 values, written out here because the engine
 * must not depend on `app/art`. Real painters take colours from the palette module.
 */

import {
  FONT_3x5,
  FONT_5x7,
  Surface,
  TRANSPARENT,
  drawSprite,
  drawText,
  frameAt,
  measureText,
  mix,
  rgb,
  shade,
  sprite,
  spriteColors,
  type Color,
  type Point,
  type ShotMap,
} from "~/pixel";

const INK = rgb(0x0f1220);
const NIGHT = rgb(0x1a2036);
const SLATE = rgb(0x2c3654);
const STEEL = rgb(0x56668a);
const MIST = rgb(0x9fb0cc);
const CHALK = rgb(0xf3eedd);
const WHITE = rgb(0xffffff);
const GRASS_DARK = rgb(0x23824a);
const GRASS = rgb(0x33a653);
const SKY_TOP = rgb(0x2f6fd0);
const SKY_MID = rgb(0x5aa6f0);
const SKY_LOW = rgb(0xa5dcf7);
const HAZE = rgb(0xe3f4f7);
const DUSK_TOP = rgb(0x2b2a66);
const DUSK_MID = rgb(0x8c3f7d);
const DUSK_LOW = rgb(0xf0774a);
const DUSK_GLOW = rgb(0xffcf6b);
const HOME = rgb(0xe8452c);
const AWAY = rgb(0x19a9bf);
const GOLD = rgb(0xffc928);
const LED_OFF = rgb(0x1c1f2b);
const AMBER_DIM = rgb(0x6b3f0e);
const AMBER = rgb(0xffb21f);
const SKIN = rgb(0xf2c6a0);
const HAIR = rgb(0x2a1c16);

const SMALL = { font: FONT_3x5 } as const;

/** A section heading in the small face. Returns the y just below it. */
function heading(s: Surface, text: string, x: number, y: number): number {
  drawText(s, text, x, y, MIST, SMALL);
  return y + 8;
}

function radiusLabel(r: number): string {
  return String(r).replace(/^0\./, ".");
}

function testcard(): Surface {
  const s = new Surface(248, 428);
  s.clear(INK);
  const L = 6; // left margin
  let y = 5;

  // --- rect, frame, hline, vline, px ------------------------------------
  y = heading(s, "RECT  FRAME  HLINE  VLINE  PX", L, y);
  s.rect(L, y, 14, 10, HOME);
  s.rect(L + 16, y, 1, 10, HOME);
  s.rect(L + 19, y, 6, 1, HOME);
  s.rect(L + 19, y + 3, 2, 2, HOME);
  for (let i = 1; i <= 6; i++) {
    s.frame(L + 22 + i * (i + 3), y + 10 - i * 1.5, i * 2, i * 1.5 + 0.5, AWAY);
  }
  for (let i = 0; i < 6; i++) s.hline(L + 92, y + i * 2, 4 + i * 3, GOLD);
  for (let i = 0; i < 6; i++) s.vline(L + 118 + i * 2, y, 2 + i * 1.6, GOLD);
  for (let i = 0; i < 20; i++) {
    s.px(L + 136 + i * 2, y + ((i * 7) % 10), CHALK);
  }
  // Odd input must do nothing (and must not throw).
  s.rect(L + 200, y, -5, 5, HOME);
  s.rect(NaN, y, 5, 5, HOME);
  s.frame(L + 200, y, 0, 0, HOME);
  s.hline(L + 200, y, -3, HOME);
  s.disc(L + 200, y, -1, HOME);
  s.line(NaN, 0, 5, 5, HOME);
  y += 16;

  // --- discs and circles, radius 0.5 to 8 --------------------------------
  y = heading(s, "DISC  CIRCLE  BOTH   RADIUS .5 TO 8", L, y);
  {
    let x = L;
    for (let r = 0.5; r <= 8; r += 0.5) {
      const d = Math.round(2 * r) + 1;
      const label = radiusLabel(r);
      const cell = Math.max(d, measureText(label, SMALL));
      // Centre given as the true centre: whole for odd sizes, ending in .5 for even ones.
      const cx = x + (cell - d) / 2 + (d - 1) / 2;
      const base = y + 17; // every disc sits on this line
      s.disc(cx, base - 1 - (d - 1) / 2, r, CHALK);
      s.circle(cx, base + 20 - 1 - (d - 1) / 2, r, CHALK);
      s.disc(cx, base + 40 - 1 - (d - 1) / 2, r, HOME);
      s.circle(cx, base + 40 - 1 - (d - 1) / 2, r, GOLD);
      drawText(s, label, x + (cell >> 1), base + 43, STEEL, {
        font: FONT_3x5,
        align: "center",
      });
      x += cell + 3;
    }
  }
  y += 70;

  // --- ellipses ----------------------------------------------------------
  y = heading(s, "ELLIPSE  FILLED AND OUTLINE", L, y);
  {
    const shapes: [number, number][] = [
      [8, 3],
      [6, 2],
      [4, 1],
      [3.5, 1.5],
      [5, 0.5],
      [11, 4.5],
      [12, 2],
      [2, 6],
      [0.5, 5],
      [1.5, 6],
      [7, 6],
      [5, 5],
    ];
    let x = L;
    for (const [rx, ry] of shapes) {
      const wd = Math.round(2 * rx) + 1;
      const cx = x + rx;
      s.ellipse(cx, y + 6, rx, ry, CHALK, true);
      s.ellipse(cx, y + 21, rx, ry, AWAY);
      x += wd + 3;
    }
  }
  y += 32;

  // --- lines -------------------------------------------------------------
  const rowLines = y;
  y = heading(s, "LINE", L, y);
  {
    const cx = L + 16;
    const cy = y + 16;
    for (let a = 0; a < 24; a++) {
      const ang = (a / 24) * Math.PI * 2;
      s.line(
        cx + Math.cos(ang) * 4,
        cy + Math.sin(ang) * 4,
        cx + Math.cos(ang) * 16,
        cy + Math.sin(ang) * 16,
        a % 2 === 0 ? CHALK : MIST,
      );
    }
    // Shallow slopes should give clean, even runs. Each pair is a mirror image.
    const x = L + 40;
    s.line(x, y + 2, x + 24, y + 10, GOLD);
    s.line(x + 49, y + 2, x + 25, y + 10, GOLD);
    s.line(x, y + 14, x + 24, y + 20, HOME);
    s.line(x + 49, y + 14, x + 25, y + 20, HOME);
    s.line(x, y + 24, x + 24, y + 27, AWAY);
    s.line(x + 49, y + 24, x + 25, y + 27, AWAY);
    s.line(x, y + 32, x + 49, y + 32, CHALK);
  }

  // --- polygons ----------------------------------------------------------
  {
    const x = L + 100;
    let py = rowLines;
    py = heading(s, "POLY  CONCAVE", x, py);
    const star: [number, number][] = [];
    for (let i = 0; i < 10; i++) {
      const ang = -Math.PI / 2 + (i / 10) * Math.PI * 2;
      const r = i % 2 === 0 ? 16 : 6.5;
      star.push([x + 16 + Math.cos(ang) * r, py + 16 + Math.sin(ang) * r]);
    }
    s.poly(star, GOLD);
    const arrow: [number, number][] = [
      [x + 40, py + 10],
      [x + 56, py + 10],
      [x + 56, py + 2],
      [x + 70, py + 16],
      [x + 56, py + 30],
      [x + 56, py + 22],
      [x + 40, py + 22],
      [x + 46, py + 16],
    ];
    s.poly(arrow, HOME);
    s.polyline(arrow, CHALK, true);
    const zig: [number, number][] = [
      [x + 78, py + 30],
      [x + 84, py + 4],
      [x + 92, py + 24],
      [x + 100, py + 4],
      [x + 108, py + 30],
    ];
    s.polyline(zig, AWAY);
    const cup: [number, number][] = [
      [x + 114, py + 2],
      [x + 136, py + 2],
      [x + 136, py + 30],
      [x + 130, py + 30],
      [x + 130, py + 8],
      [x + 120, py + 8],
      [x + 120, py + 30],
      [x + 114, py + 30],
    ];
    s.poly(cup, GRASS);
  }
  y += 44;

  // --- dither ------------------------------------------------------------
  y = heading(s, "DITHER  0 TO 1 IN NINE STEPS", L, y);
  s.rect(L, y, 9 * 16, 16, SLATE);
  for (let i = 0; i < 9; i++) {
    s.dither(L + i * 16, y, 16, 16, GOLD, i / 8);
  }
  // Two dithers that meet must continue the same pattern.
  s.rect(L + 152, y, 40, 16, GRASS_DARK);
  s.dither(L + 152, y, 13, 16, GRASS, 0.5);
  s.dither(L + 165, y, 27, 7, GRASS, 0.5);
  s.dither(L + 165, y + 7, 27, 9, GRASS, 0.5);
  y += 22;

  // --- bands -------------------------------------------------------------
  y = heading(s, "BANDS  DITHER 2   HARD   STOPS + 3   FADE", L, y);
  const sky = [SKY_TOP, SKY_MID, SKY_LOW, HAZE];
  const dusk = [DUSK_TOP, DUSK_MID, DUSK_LOW, DUSK_GLOW];
  s.bands(L, y, 54, 44, sky);
  s.bands(L + 58, y, 54, 44, sky, { dither: 0 });
  s.bands(L + 116, y, 54, 44, dusk, { stops: [0.4, 0.7, 0.88], dither: 3 });
  s.bands(L + 174, y, 54, 44, [DUSK_TOP, DUSK_MID]);
  s.bands(L + 174, y + 14, 54, 30, [TRANSPARENT, DUSK_GLOW, HAZE], {
    stops: [0.5, 0.8],
    dither: 3,
  });
  y += 50;

  // --- blit, copy, clip, shadeRect ---------------------------------------
  const rowBlit = y;
  y = heading(s, "BLIT  FLIPS  PART", L, y);
  {
    // An unmistakably lopsided stamp: a flag on a pole with a dot.
    const stamp = new Surface(14, 14);
    stamp.vline(2, 1, 12, CHALK);
    stamp.poly(
      [
        [3, 1],
        [11, 4],
        [3, 7],
      ],
      HOME,
    );
    stamp.disc(10, 10, 2, GOLD);
    stamp.frame(0, 0, 14, 14, STEEL);
    stamp.erase(0, 0, 1, 1);
    s.rect(L, y, 86, 18, NIGHT);
    s.blit(stamp, L + 2, y + 2);
    s.blit(stamp, L + 18, y + 2, { flipX: true });
    s.blit(stamp, L + 34, y + 2, { flipY: true });
    s.blit(stamp, L + 50, y + 2, { flipX: true, flipY: true });
    s.blit(stamp, L + 68, y + 2, { sx: 2, sy: 0, sw: 10, sh: 8, flipX: true });
    s.blit(stamp, L + 68, y + 11, { sx: 7, sy: 7, sw: 7, sh: 7 });
  }
  {
    const x = L + 96;
    heading(s, "CLIP", x, rowBlit);
    s.frame(x, y, 42, 18, STEEL);
    s.clip(x + 1, y + 1, 40, 16);
    s.disc(x, y + 2, 9, AWAY);
    s.line(x - 10, y + 22, x + 60, y - 4, GOLD);
    s.ellipse(x + 40, y + 16, 9, 5, HOME, true);
    drawText(s, "CLIPPED TEXT", x + 8, y + 12, CHALK);
    s.dither(x - 5, y - 5, 60, 12, GRASS, 0.25);
    s.unclip();
  }
  {
    const x = L + 146;
    heading(s, "SHADERECT  COPY", x, rowBlit);
    s.shadeRect(x, y, 30, 18, (px, py) => {
      const d = Math.hypot(px - (x + 14.5), py - (y + 8.5));
      return d < 5
        ? GOLD
        : d < 8
          ? ((px + py) & 1) === 0
            ? GOLD
            : TRANSPARENT
          : TRANSPARENT;
    });
    const patch = new Surface(18, 18);
    patch.clear(GRASS_DARK);
    patch.rect(0, 0, 9, 9, GRASS);
    patch.rect(9, 9, 9, 9, GRASS);
    s.copy(patch, x + 36, y);
  }
  y += 24;

  // --- colour ------------------------------------------------------------
  y = heading(s, "SHADE -.75 TO +.75                MIX", L, y);
  const swatches = [HOME, AWAY, GRASS, GOLD, STEEL, SKY_MID];
  swatches.forEach((c, row) => {
    for (let i = 0; i < 7; i++) {
      s.rect(L + i * 12, y + row * 7, 12, 6, shade(c, (i - 3) * 0.25));
    }
    s.rect(L + 3 * 12 + 5, y + row * 7 + 5, 2, 1, INK); // marks the original
  });
  const pairs: [Color, Color][] = [
    [HOME, AWAY],
    [SKY_TOP, HAZE],
    [DUSK_TOP, DUSK_GLOW],
    [GRASS_DARK, GOLD],
    [INK, WHITE],
    [HOME, GRASS],
  ];
  pairs.forEach(([a, b], row) => {
    for (let i = 0; i < 9; i++) {
      s.rect(L + 100 + i * 12, y + row * 7, 12, 6, mix(a, b, i / 8));
    }
  });
  y += 6 * 7 + 4;

  // --- dithered shapes, outline, recolor, mask, cut -----------------------
  y = heading(
    s,
    "LEVEL .25 .5 .75   GLOW   BEAM   OUTLINE RECOLOR   MASK   CUT",
    L,
    y,
  );
  s.rect(L, y, 236, 44, NIGHT);
  // One disc at three dither levels, each on a soft ground shadow.
  [0.25, 0.5, 0.75].forEach((level, i) => {
    s.ellipse(L + 11 + i * 18, y + 36, 7, 2, INK, true, 0.5);
    s.disc(L + 11 + i * 18, y + 20, 7, GOLD, level);
  });
  // A glow is three stacked discs. A beam is a dithered polygon.
  s.disc(L + 76, y + 21, 17, GOLD, 0.125);
  s.disc(L + 76, y + 21, 11, GOLD, 0.25);
  s.disc(L + 76, y + 21, 6, GOLD, 0.5);
  s.disc(L + 76, y + 21, 2.5, WHITE);
  const beam: Point[] = [
    [L + 104, y + 4],
    [L + 109, y + 4],
    [L + 122, y + 43],
    [L + 98, y + 43],
  ];
  s.poly(beam, CHALK, 0.25);
  s.rect(L + 103, y + 1, 8, 3, CHALK);
  {
    // A shape built from parts on its own layer gets its ink outline in one call...
    const coach = new Surface(32, 18);
    coach.rect(2, 3, 28, 10, HOME);
    coach.rect(4, 5, 20, 4, SKY_LOW);
    coach.rect(26, 5, 3, 4, SKY_LOW);
    coach.disc(8, 13, 2.5, STEEL);
    coach.disc(24, 13, 2.5, STEEL);
    coach.outline(INK);
    s.rect(L + 128, y + 1, 36, 42, GRASS);
    s.blit(coach, L + 130, y + 3);
    // ...and recolor grades the whole layer afterwards (here: a night version).
    const dark = coach.clone();
    dark.recolor((c) => (c === INK ? c : shade(c, -0.45)));
    s.rect(L + 128, y + 22, 36, 21, GRASS_DARK);
    s.blit(dark, L + 130, y + 24);
  }
  {
    // mask: a crowd pattern kept only inside the stand's shape.
    const crowd = new Surface(40, 40);
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 10; col++) {
        const odd = (row * 7 + col * 3) % 5 === 0;
        crowd.rect(col * 4, row * 4 + 1, 3, 3, odd ? CHALK : HOME);
        crowd.px(col * 4 + 1, row * 4, SKIN);
      }
    }
    const stand = new Surface(40, 40);
    stand.poly(
      [
        [0, 39],
        [9, 3],
        [39, 10],
        [39, 39],
      ],
      WHITE,
    );
    crowd.mask(stand);
    s.blit(crowd, L + 170, y + 2);
  }
  {
    // cut: one disc bitten out of another.
    const moon = new Surface(17, 17);
    moon.disc(8, 8, 8, CHALK);
    const bite = new Surface(17, 17);
    bite.disc(8, 8, 8, WHITE);
    moon.cut(bite, 5, -3);
    s.blit(moon, L + 216, y + 5);
  }

  return s;
}

const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWER = "abcdefghijklmnopqrstuvwxyz";
const DIGITS = "0123456789";
const PUNCT_A = "!\"#$%&'()*+,-./:;<=>?@";
const PUNCT_B = "[\\]^_`{|}~· ☺";
const SMALL_PUNCT = ".,:;!?'\"-+/()%&#*=<>_|[]· ☺";
// Names go in exactly as they are spelt. The fonts fold the accents away.
const NAMES_A = "Maracanã  Ødegaard  Łukasz  Çalhanoğlu";
const NAMES_B = "São Paulo  Atlético  İstanbul  Strauß  Þór";
const PANGRAM = "the quick brown fox jumps over the lazy dog";
const BERNABEU = "Estadio Santiago Bernabéu";
const SAMPLES = [
  "TODAY'S STADIUM",
  "ANFIELD",
  BERNABEU,
  "TOP BINS! +87 PTS",
  PANGRAM,
  DIGITS,
];

function fonts(): Surface {
  const s = new Surface(256, 504);
  s.clear(INK);
  const L = 6;
  let y = 5;

  // --- FONT_5x7 ----------------------------------------------------------
  y = heading(s, "FONT 5X7  FULL SET", L, y);
  for (const line of [UPPER, LOWER, DIGITS, PUNCT_A, PUNCT_B]) {
    drawText(s, line, L, y, CHALK);
    y += FONT_5x7.lineHeight;
  }
  y += 2;
  y = heading(s, "LOOK-ALIKES MUST DIFFER", L, y);
  drawText(
    s,
    "0O  1Il|  5S  8B  2Z  6G  D0  rn m  cl d  vy  ,.;:",
    L,
    y,
    CHALK,
  );
  y += 14;

  y = heading(s, "PLAIN", L, y);
  for (const line of SAMPLES) {
    drawText(s, line, L, y, CHALK);
    y += FONT_5x7.lineHeight;
  }
  y += 3;

  y = heading(s, "ACCENTS FOLD TO PLAIN LETTERS", L, y);
  drawText(s, NAMES_A, L, y, CHALK);
  y += FONT_5x7.lineHeight;
  drawText(s, NAMES_B, L, y, CHALK);
  y += FONT_5x7.lineHeight + 3;

  y = heading(s, "SHADOW", L, y);
  s.rect(0, y - 2, s.w, 3 * 10 + 4, LED_OFF);
  drawText(s, "TODAY'S STADIUM", L, y, AMBER, { shadow: AMBER_DIM });
  drawText(s, "TOP BINS! +87 PTS", 250, y, GOLD, {
    shadow: AMBER_DIM,
    align: "right",
  });
  y += 10;
  drawText(s, BERNABEU, L, y, AMBER, { shadow: AMBER_DIM });
  y += 10;
  drawText(s, PANGRAM, L, y, CHALK, { shadow: SLATE });
  y += 14;

  y = heading(s, "OUTLINE  AND  OUTLINE + SHADOW", L, y);
  s.bands(0, y - 2, s.w, 38, [GRASS, GRASS_DARK], { dither: 0, stops: [0.5] });
  drawText(s, "TODAY'S STADIUM", L + 1, y, WHITE, { outline: INK });
  drawText(s, "TOP BINS! +87 PTS", 249, y, GOLD, {
    outline: INK,
    align: "right",
  });
  y += 12;
  drawText(s, BERNABEU, L + 1, y, CHALK, { outline: INK });
  y += 12;
  drawText(s, PANGRAM, L + 1, y, WHITE, { outline: INK, shadow: GRASS_DARK });
  y += 18;

  y = heading(s, "SCALE 2", L, y);
  drawText(s, "ANFIELD", L, y, CHALK, { scale: 2 });
  drawText(s, "+87", 128, y, GOLD, { scale: 2, shadow: AMBER_DIM });
  drawText(s, "0-0", 180, y, AMBER, { scale: 2, outline: AMBER_DIM });
  y += 20;
  drawText(s, "Top bins!", L, y, HOME, {
    scale: 2,
    outline: CHALK,
    shadow: SLATE,
  });
  drawText(s, "12:30", 128, y, WHITE, { scale: 2, tabular: true });
  drawText(s, "11:11", 192, y, WHITE, { scale: 2, tabular: true });
  y += 24;

  // A dot-matrix board: unlit LEDs are a 0.25 dither, lit ones are text with `dots`.
  // Even coordinates put the lit dots exactly on the unlit grid.
  y = heading(s, "DOTS (SCALE 2) ON A .25 DITHER", L, y);
  y += y % 2;
  s.rect(L, y, 244, 22, LED_OFF);
  s.dither(L, y, 244, 22, AMBER_DIM, 0.25);
  drawText(s, "ANFIELD", L + 4, y + 4, AMBER, { scale: 2, dots: true });
  drawText(s, "2-0", L + 124, y + 4, AMBER, { scale: 2, dots: true });
  drawText(s, "FULL TIME 90:00", L + 240, y + 6, AMBER, {
    font: FONT_3x5,
    scale: 2,
    dots: true,
    align: "right",
    tabular: true,
  });
  y += 28;

  // --- FONT_3x5 ----------------------------------------------------------
  y = heading(s, "FONT 3X5  FULL SET (DRAWN IN ITSELF)", L, y);
  for (const line of [UPPER, DIGITS, SMALL_PUNCT]) {
    drawText(s, line, L, y, CHALK, SMALL);
    y += FONT_3x5.lineHeight;
  }
  drawText(
    s,
    "0O  1I  5S  8B  2Z  6G  D0  UV  MW  HN  QO  I!|",
    L,
    y,
    CHALK,
    SMALL,
  );
  y += FONT_3x5.lineHeight;
  drawText(s, NAMES_A, L, y, CHALK, SMALL);
  y += FONT_3x5.lineHeight;
  drawText(s, NAMES_B, L, y, CHALK, SMALL);
  y += 10;
  for (const line of SAMPLES) {
    drawText(s, line, L, y, CHALK, SMALL);
    y += FONT_3x5.lineHeight;
  }
  y += 2;
  s.rect(0, y - 2, s.w, 11, LED_OFF);
  drawText(s, "TODAY'S STADIUM", L, y, AMBER, {
    font: FONT_3x5,
    shadow: AMBER_DIM,
  });
  drawText(s, "TOP BINS! +87 PTS", 250, y, GOLD, {
    font: FONT_3x5,
    shadow: AMBER_DIM,
    align: "right",
  });
  y += 11;
  s.rect(0, y - 2, s.w, 11, GRASS);
  drawText(s, BERNABEU, L + 1, y, WHITE, { font: FONT_3x5, outline: INK });
  drawText(s, "TOP BINS! +87 PTS", 249, y, GOLD, {
    font: FONT_3x5,
    outline: INK,
    align: "right",
  });
  y += 13;
  drawText(s, "ANFIELD", L, y, CHALK, { font: FONT_3x5, scale: 2 });
  drawText(s, "+87 PTS", 80, y, GOLD, {
    font: FONT_3x5,
    scale: 2,
    shadow: AMBER_DIM,
  });
  drawText(s, "FULL TIME", 160, y, AMBER, {
    font: FONT_3x5,
    scale: 2,
    outline: AMBER_DIM,
  });

  return s;
}

// A tiny footballer in two frames: striding and standing. Legend: o outline, h hair, s skin,
// k shirt, w shorts, b boots.
const KID = sprite(
  `
...oooo...
..ohhhho..
..ohssso..
..osssso..
...osso...
..okkkko..
.okkkkkko.
.oskkkkso.
.ookkkkoo.
..owwwwo..
..owoowo..
.oso..oso.
.obo..obbo
.ooo..oooo

...oooo...
..ohhhho..
..ohssso..
..osssso..
...osso...
..okkkko..
.okkkkkko.
.oskkkkso.
.ookkkkoo.
..owwwwo..
..owwwwo..
..osooso..
..oboobo..
..oooooo..
`,
  "ohskwb",
);

function spriteDemo(t: number): Surface {
  const s = new Surface(204, 92);
  s.clear(INK);
  const frame = frameAt(t, 4, KID.frames.length);
  // Kits by name with spriteColors, or by position as a plain array: both work.
  const home = spriteColors(KID, {
    o: INK,
    h: HAIR,
    s: SKIN,
    k: HOME,
    w: WHITE,
    b: CHALK,
  });
  const away = [INK, HAIR, SKIN, AWAY, WHITE, CHALK];
  // TRANSPARENT entries leave those parts out: here only the outline and boots are drawn.
  const ghost = [INK, TRANSPARENT, TRANSPARENT, TRANSPARENT, TRANSPARENT, INK];

  let y = heading(s, "TOP-LEFT  FLIPX   FRAMES 0 1 3    SCALE 2", 6, 5);
  // Top-left anchor: the gold pixel is (x, y); the sprite hangs down and right of it.
  s.rect(6, y, 192, 32, SKY_LOW);
  drawSprite(s, KID, frame, 10, y + 3, home);
  s.px(10, y + 3, GOLD);
  drawSprite(s, KID, frame, 26, y + 3, home, { flipX: true });
  s.px(26, y + 3, GOLD);
  drawSprite(s, KID, 0, 50, y + 3, away);
  drawSprite(s, KID, 1, 64, y + 3, away);
  drawSprite(s, KID, 3, 78, y + 3, away); // frame 3 of 2 wraps round to frame 1
  drawSprite(s, KID, frame, 112, y + 2, home, { scale: 2 });
  drawSprite(s, KID, frame, 140, y + 2, away, { scale: 2, flipX: true });
  drawSprite(s, KID, frame, 168, y + 2, ghost, { scale: 2 });
  y += 38;

  y = heading(s, "BOTTOM-CENTER  FLIPX  PARTS LEFT OUT  FLIPY   CENTER", 6, y);
  const ground = y + 20;
  s.rect(6, y, 192, 20, SKY_LOW);
  s.rect(6, ground, 192, 8, GRASS);
  s.hline(6, ground, 192, GRASS_DARK);
  // Bottom-centre anchor: the gold pixel is (x, y), in the ground row under the feet.
  const stand = (
    x: number,
    colors: Color[],
    flipX: boolean,
    flipY = false,
  ): void => {
    drawSprite(s, KID, frame, x, ground, colors, {
      anchor: "bottom-center",
      flipX,
      flipY,
    });
    s.px(x, ground, GOLD);
  };
  stand(18, home, false);
  stand(38, away, false);
  stand(58, home, true);
  stand(92, ghost, false);
  stand(126, away, false, true);
  // Centre anchor: the gold pixel is (x, y), the middle of the ball. Indented art is fine.
  const ball = sprite(
    `
      .www.
      wkwww
      wwwkw
      wwkww
      .www.
    `,
    "wk",
  );
  for (let i = 0; i < 3; i++) {
    const bx = 152 + i * 12;
    const by = ground - 4 - i * 5;
    drawSprite(s, ball, 0, bx, by, [WHITE, INK], {
      anchor: "center",
      flipX: i === 1,
      flipY: i === 2,
    });
    s.px(bx, by, GOLD);
  }
  // Clipping: half a sprite at the panel edge.
  s.clip(6, y, 192, 28);
  stand(198, home, false);
  s.unclip();
  return s;
}

export const shots: ShotMap = {
  "pixel/testcard": () => testcard(),
  "pixel/fonts": () => fonts(),
  "pixel/sprite": (ctx) => spriteDemo(ctx.t),
};
