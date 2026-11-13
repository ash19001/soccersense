/**
 * Shared layout numbers (art bible section 5). If a number matters to more than one
 * painter, it lives here. Everything is in logical pixels and already rounded.
 *
 * Positions scale with the canvas. Sprites never do: they are drawn at the sizes below
 * (art bible section 5).
 */

/** A rectangle in logical pixels. */
export interface Zone {
  x: number;
  y: number;
  w: number;
  h: number;
}

// ---------------------------------------------------------------------------
// Sprite sizes
// ---------------------------------------------------------------------------

// A cell's anchor is column floor(cellW / 2), its soles' outline row cellH - 1.

/** Adult player: 24 x 36 drawn in a 32 x 40 cell (anchor column 16), anchored bottom-centre. */
export const PLAYER = { w: 24, h: 36, cellW: 32, cellH: 40 } as const;
/** Youth player (career tiers 0 and 1): 20 x 28 in a 28 x 32 cell (anchor column 14). */
export const YOUTH = { w: 20, h: 28, cellW: 28, cellH: 32 } as const;
/** The goalkeeper is adult size (gloves, and a kit colour nobody else in the scene wears). */
export const KEEPER = PLAYER;
/** The career match ball: 6 x 6 px plus a 2 px shadow, 3 spin frames. */
export const MATCH_BALL = { size: 6, shadow: 2 } as const;
/** A crowd fan: 6 x 8 px (head and body), repeated every 8 px across and down. */
export const FAN = { w: 6, h: 8, pitch: 8 } as const;
/** The trophy: a generic gold cup of about 18 x 24 px. */
export const TROPHY = { w: 18, h: 24 } as const;

// ---------------------------------------------------------------------------
// What the DOM interface covers, as fractions of the canvas height
// ---------------------------------------------------------------------------

/** The interface sits in a column this many logical px wide, centred on the screen. */
export const UI_COLUMN_W = 135;

export const COVER = {
  /** Home screen: the top band where the logo sits. Keep it clear sky. */
  menuLogo: 0.15,
  /** Home screen: the captions cover this much of the bottom. */
  menuCaptions: 0.1,
  /** Game screen while a question is being asked: the board covers this much of the top. */
  boardAsking: 0.3,
  /** Game screen once an answer is accepted: the board shrinks to this much of the top. */
  boardShrunk: 0.18,
  /** Game screen while asking: the answer bar covers this much of the bottom. */
  answerBar: 0.1,
  /** Game screen after an answer: the reveal sheet covers this much of the bottom. */
  revealSheet: 0.46,
} as const;

// ---------------------------------------------------------------------------
// Home screen
// ---------------------------------------------------------------------------

/**
 * How the sky fits the home screen. It has the names of `drawSky`'s options, so it can be
 * spread straight in: `drawSky(s, { light, t, seed, ...m.sky })`.
 */
export interface MenuSky {
  /**
   * The sky's horizon: the same row as the land's (`MenuLayout.horizonY`). The hills and
   * the city's skyline stand on it.
   */
  horizonY: number;
  /** The bottom of the logo zone: the sun and the moon stay below it. */
  clearTop: number;
  /**
   * The column the sun climbs and sets in: the middle of the screen, where the city's
   * roofs are low between its two clusters of towers.
   */
  sunX: number;
  /**
   * The moon, where all of it shows: nothing on the horizon and nothing that flies may
   * stand in front of part of it. Where the airship hangs beside the wordmark (a monitor,
   * 1366 x 768) it rides high on the right, level with the wordmark and above the city's
   * towers; on a phone it is in the corner of sky left of the stacked wordmark; on a tablet
   * right of the airship's tail. Where there is no such room it is behind the airship, all
   * of it.
   */
  moon: { x: number; y: number };
}

export interface MenuLayout {
  /** The canvas size this layout was made for. */
  w: number;
  h: number;
  /** The horizontal centre. Everything on the home screen is composed around it. */
  cx: number;
  /**
   * The horizon of the aerial picture: only sky above it, the town from here down. It is
   * between a quarter and a third of the way down the screen.
   */
  horizonY: number;
  /** Everything `drawSky` needs to fit the sky to this screen. */
  sky: MenuSky;
  /** Radius of the menu ball: round(min(W * 0.34, H * 0.165)). */
  ballR: number;
  /**
   * Centre of the menu ball: (cx, ballCy), with ballCy = round(H * 0.70). The ball floats
   * in front of the picture; the scene bobs it by a pixel or two.
   */
  ballCy: number;
  /** The top 15% of the canvas, full width. The logo sits here: keep it clear sky. */
  logo: Zone;
  /**
   * The matchday sign: the LED panel on the airship's flank, where it rests (the airship
   * drifts 2 px either way), at full size: the airship draws it at `AIRSHIP_SIZE` of this
   * round the same centre (`signPlace`). High in the top left of the sky: beside the
   * wordmark's left end where the airship has room there (a monitor, 1366 x 768), else
   * just under the wordmark (a phone). The field keeps the name of the scoreboard it used
   * to be.
   */
  scoreboard: Zone;
  /**
   * The stadium: the box round the bowl on screen, from the far edge of its roof to the
   * foot of its near wall (clipped to the canvas). The field keeps its old name.
   */
  stand: Zone;
  /**
   * The land in front of the stadium: full width, from the foot of the near wall to the
   * bottom (Stadium Road, the plaza, the pub, the car park). The field keeps its old name.
   */
  pitch: Zone;
  /** The bottom 10% of the canvas. The captions cover the middle 135 px of it. */
  caption: Zone;
  /**
   * The aerial camera's scale: screen pixels per map unit at the centre spot (1 on the
   * reference monitor, about 0.43 on a phone). Not a whole number.
   */
  scale: number;
  /** The row of the centre spot of the pitch; its column is `cx`. */
  spotY: number;
}

/** The home screen's aerial camera, as far as the layout needs it (see stadium-view.ts). */
export const MENU_CAMERA = {
  /** The visible horizon is this many map units above the centre spot. */
  horizonRise: 58,
  /** Half the widest the stadium gets on screen, in map units. */
  stadiumHalf: 150,
  /** The bowl's box round the centre spot, in map units: half its width, up, down. */
  bowlHalf: 165,
  bowlUp: 44,
  bowlDown: 69,
} as const;

/**
 * How big the airship is against its full-size drawing (the layout's sign zone and hull):
 * `signPlace` (stadium-airship.ts) shrinks the panel and the envelope round the same
 * centre, and the painter scales every length of its drawing by it, so it keeps its
 * proportions. 7/8 until 2026-11-13; the product owner then asked for it "even smaller
 * and top left".
 */
export const AIRSHIP_SIZE = 0.64;
/** Past the envelope's ends: the nose lamp or the tail's stabiliser, and the drift. */
const AIRSHIP_REACH = 8;
/** The envelope's top at rest when it hangs beside the wordmark. */
const AIRSHIP_TOP = 12;
/** The gap it keeps from the wordmark's widest. */
const AIRSHIP_CLEAR = 16;

function unit(x: number): number {
  return x <= 0 ? 0 : x >= 1 ? 1 : x;
}

/** Where things go on the home screen for a canvas of `w` x `h` logical pixels. */
export function menuLayout(w: number, h: number): MenuLayout {
  const W = Math.max(1, Math.round(w));
  const H = Math.max(1, Math.round(h));
  const cx = Math.round(W / 2);
  const logoH = Math.round(H * COVER.menuLogo);
  const captionH = Math.round(H * COVER.menuCaptions);
  const ballR = Math.round(Math.min(W * 0.34, H * 0.165));
  const ballCy = Math.round(H * 0.7);

  // The camera. 0 on a phone, 1 on a monitor, smooth between.
  const ratio = unit((W / H - 0.9) / 0.55);
  const wideness = ratio * ratio * (3 - 2 * ratio);
  const wide = wideness > 0.5;
  const rise = MENU_CAMERA.horizonRise;
  const ballTop = ballCy - ballR;
  // The stadium takes 60% of a monitor's width and all of a phone's...
  const byWidth = (W * (0.97 - 0.37 * wideness)) / 2 / MENU_CAMERA.stadiumHalf;
  // ...but the pitch must show above the ball with the horizon no more than a third of
  // the way down, which bounds it on a very wide, short screen.
  const byHeight = (ballTop + 14 - 0.25 * H) / (23 + rise);
  const scale = Math.max(0.12, Math.min(8, Math.min(byWidth, byHeight)));
  const horizon = H * (0.325 - 0.055 * wideness);
  const spotY = Math.round(
    Math.max(
      1,
      Math.min(
        Math.max(1, H),
        ballTop + 14 - 23 * scale,
        horizon + rise * scale,
      ),
    ),
  );
  const horizonY = Math.max(0, Math.min(H, Math.round(spotY - rise * scale)));

  // The stadium's box and the land in front of it.
  const bowlX0 = Math.max(0, cx - Math.round(MENU_CAMERA.bowlHalf * scale));
  const bowlX1 = Math.min(W, cx + Math.round(MENU_CAMERA.bowlHalf * scale));
  const bowlY0 = Math.max(
    0,
    Math.min(H, spotY - Math.round(MENU_CAMERA.bowlUp * scale)),
  );
  const bowlY1 = Math.max(
    bowlY0,
    Math.min(H, spotY + Math.round(MENU_CAMERA.bowlDown * scale)),
  );

  // The sign: a header in the small font over a line in the big one (stadium-airship.ts).
  // These are the airship's full-size numbers; it is drawn at AIRSHIP_SIZE of them round
  // the same centre (`signPlace`), and placed here by that size. It hangs high in the top
  // left of the sky: beside the wordmark where there is room for it there (a monitor,
  // 1366 x 768), else just under the wordmark (a phone), and always clear of the edge.
  const roomy = W >= 800 && wide;
  const signW = roomy
    ? 184
    : Math.max(1, Math.min(184, Math.max(172, W - 80), W));
  const signH = roomy ? 70 : 66;
  const hull = roomy
    ? 128
    : Math.max(104, Math.min(120, Math.floor(W / 2) - 10));
  const rx = Math.round(hull * AIRSHIP_SIZE);
  const ry = Math.round((roomy ? 48 : 46) * AIRSHIP_SIZE);
  // from its nose lamp to its tail's stabiliser, and its drift (2 px) and lurches
  const reach = rx + AIRSHIP_REACH;
  const edge = Math.max(8, Math.min(24, Math.round(W * 0.04)));
  const wordmarkLeft = cx - Math.ceil(Math.min(W - 52, 264) / 2);
  const beside = edge + 2 * reach + AIRSHIP_CLEAR <= wordmarkLeft;
  const signCx = Math.min(cx, edge + reach);
  const signCy = beside ? AIRSHIP_TOP + ry : logoH + 4 + ry;

  // The moon, as the sky draws it: its radius, and the glow that reaches 6 px further.
  const moonR = Math.max(12, Math.min(18, Math.round(6 + W / 45)));
  const moonGlow = moonR + 12;
  let moon: { x: number; y: number };
  if (roomy || beside) {
    // High on the right, beside the wordmark. The city's roofs stop 3 px short of the logo
    // zone and its tallest aerial stands at most 6 px above them: the moon's disc ends
    // above that, so no tower ever stands in front of it.
    moon = {
      x: Math.round(W * 0.82),
      y: Math.max(
        moonR + 2,
        Math.min(Math.round(logoH * 0.7), logoH - moonR - 8),
      ),
    };
  } else if (W - 52 < 264) {
    // the wordmark is stacked: the corner of sky left of its first line
    moon = { x: moonR + 10, y: moonR + 12 };
  } else if (W - (signCx + reach + 12) >= 2 * moonGlow) {
    // beside the airship's tail
    moon = { x: W - moonGlow - 2, y: logoH + 24 };
  } else {
    // nowhere it would show whole: behind the airship
    moon = { x: cx, y: signCy };
  }

  return {
    w: W,
    h: H,
    cx,
    horizonY,
    sky: {
      horizonY,
      clearTop: logoH,
      sunX: cx,
      moon,
    },
    ballR,
    ballCy,
    logo: { x: 0, y: 0, w: W, h: logoH },
    scoreboard: {
      x: signCx - Math.floor(signW / 2) - (roomy ? 4 : 0),
      y: signCy - Math.floor(signH / 2),
      w: signW,
      h: signH,
    },
    stand: { x: bowlX0, y: bowlY0, w: bowlX1 - bowlX0, h: bowlY1 - bowlY0 },
    pitch: { x: 0, y: bowlY1, w: W, h: H - bowlY1 },
    caption: { x: 0, y: H - captionH, w: W, h: captionH },
    scale,
    spotY,
  };
}

// ---------------------------------------------------------------------------
// Career scene
// ---------------------------------------------------------------------------

/**
 * The career stage is this wide on a phone, centred on the canvas. On a wider canvas it
 * grows with the width (`2 * round(W * 0.2)`: 384 at 960 x 540) up to `STAGE_W_MAX`, so on
 * a monitor the hero and the goal stand further apart. Beyond the stage, wide canvases show
 * more of the same ground.
 */
export const STAGE_W = 260;
/** The widest the career stage gets (a canvas of 1040 logical px or more). */
export const STAGE_W_MAX = 416;
/**
 * Horizontal offsets on the stage are written in 130ths of a phone's stage (the cast's
 * places in `docs/CAREER_SCENE.md`, the ground's dressing): `stageScale` is the stage's
 * width over this.
 */
export const STAGE_UNITS = 130;

export interface CareerLayout {
  /** The canvas size this layout was made for. */
  w: number;
  h: number;
  /** The horizontal centre of the stage. */
  cx: number;
  /** The ground line: the row the players' feet stand on. round(H * 0.52). */
  groundY: number;
  /**
   * Left edge of the stage: 260 px wide on a phone, wider on a monitor (384 at 960 x 540,
   * at most `STAGE_W_MAX`). May be off-canvas on a narrow screen.
   */
  stageLeft: number;
  /** Right edge of the stage (first column past it). */
  stageRight: number;
  /**
   * The stage's width over `STAGE_UNITS` (130): 2 on a phone, 384 / 130 (about 2.95) at
   * 960 x 540. Horizontal offsets written in those units (the cast's places in
   * `docs/CAREER_SCENE.md`, the ground's dressing) are multiplied by it and rounded.
   * Sprites never are.
   */
  stageScale: number;
  /** Where the hero rests: cx - round(26 * stageScale). */
  heroX: number;
  /** The goal line, at the mouth of the goal: cx + round(44 * stageScale). */
  goalX: number;
  /** Where the keeper stands, 12 px in front of the goal line: goalX - 12. */
  keeperX: number;
  /**
   * The far touchline: the pitch starts here, 18 px behind the players' feet,
   * so stands and backdrops get the rest of the action band.
   */
  farTouchY: number;
  /**
   * The near touchline: groundY + round(H * 0.12). Below it are boards, benches and
   * photographers. Only seen while a question is being asked.
   */
  nearTouchY: number;
  /** Top of the band that is visible in every interface state: round(H * 0.31). */
  actionTop: number;
  /** Bottom of that band: round(H * 0.53). Hero, goal, keeper and ball flight stay inside. */
  actionBottom: number;
  /** The board's bottom edge while a question is being asked: round(H * 0.30). */
  boardAskingY: number;
  /** The board's bottom edge once an answer is in: round(H * 0.18). Sky shows from here. */
  boardShrunkY: number;
  /** The top edge of the answer bar (while asking): H - round(H * 0.10). */
  answerBarY: number;
  /** The top edge of the reveal sheet (after an answer): H - round(H * 0.46). */
  sheetY: number;
}

/**
 * Where things go in the career scene for a canvas of `w` x `h` logical pixels.
 */
export function careerLayout(w: number, h: number): CareerLayout {
  const W = Math.max(1, Math.round(w));
  const H = Math.max(1, Math.round(h));
  const cx = Math.round(W / 2);
  const groundY = Math.round(H * 0.52);
  const stageW = Math.max(
    STAGE_W,
    Math.min(STAGE_W_MAX, 2 * Math.round(W * 0.2)),
  );
  const stageScale = stageW / STAGE_UNITS;
  const stageLeft = cx - stageW / 2;
  const goalX = cx + Math.round(44 * stageScale);
  return {
    w: W,
    h: H,
    cx,
    groundY,
    stageLeft,
    stageRight: stageLeft + stageW,
    stageScale,
    heroX: cx - Math.round(26 * stageScale),
    goalX,
    keeperX: goalX - 12,
    farTouchY: groundY - 18,
    nearTouchY: groundY + Math.round(H * 0.12),
    actionTop: Math.round(H * 0.31),
    actionBottom: Math.round(H * 0.53),
    boardAskingY: Math.round(H * COVER.boardAsking),
    boardShrunkY: Math.round(H * COVER.boardShrunk),
    answerBarY: H - Math.round(H * COVER.answerBar),
    sheetY: H - Math.round(H * COVER.revealSheet),
  };
}
