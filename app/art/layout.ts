/**
 * Shared layout numbers (art bible section 5). If a number matters to more than one
 * painter, it lives here. Everything is in logical pixels and already rounded.
 *
 * Positions scale with the canvas. Sprites never do.
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

/** Adult player: 12 x 18 drawn in a 16 x 20 cell, anchored bottom-centre. */
export const PLAYER = { w: 12, h: 18, cellW: 16, cellH: 20 } as const;
/** Youth player (career tiers 0 and 1): 10 x 14 in a 14 x 16 cell, anchored bottom-centre. */
export const YOUTH = { w: 10, h: 14, cellW: 14, cellH: 16 } as const;
/** The goalkeeper is adult size (gloves, and a kit colour nobody else in the scene wears). */
export const KEEPER = PLAYER;
/** The career match ball: 3 x 3 px plus a 1 px shadow, 2 or 3 spin frames. */
export const MATCH_BALL = { size: 3, shadow: 1 } as const;
/** A crowd fan: 3 x 4 px (head and body), repeated every 4 px across and down. */
export const FAN = { w: 3, h: 4, pitch: 4 } as const;
/** The trophy: a generic gold cup of about 9 x 12 px. */
export const TROPHY = { w: 9, h: 12 } as const;

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
   * stand in front of part of it. On a monitor it rides high on the right, level with the
   * wordmark and above the city's towers; on a phone it is in the corner of sky left of the
   * stacked wordmark; on a tablet beside the airship's tail. Where there is no such room it
   * is behind the airship, all of it.
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
   * drifts 2 px either way). Beside the wordmark's left end on a monitor, under the
   * wordmark on a phone. The field keeps the name of the scoreboard it used to be.
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
  const byHeight = (ballTop + 7 - 0.25 * H) / (23 + rise);
  const scale = Math.max(0.06, Math.min(4, Math.min(byWidth, byHeight)));
  const horizon = H * (0.325 - 0.055 * wideness);
  const spotY = Math.round(
    Math.max(
      1,
      Math.min(
        Math.max(1, H),
        ballTop + 7 - 23 * scale,
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

  // The sign: big enough for "TODAY'S STADIUM" in the small font, never wider than a
  // phone. On a monitor it hangs at the left, clear of the wordmark and the skyline.
  const roomy = W >= 400 && wide;
  const signW = roomy ? 92 : Math.max(1, Math.min(92, Math.max(86, W - 40), W));
  const signH = roomy ? 35 : 33;
  const hull = roomy ? 64 : Math.max(52, Math.min(60, Math.floor(W / 2) - 5));
  const signCx = roomy
    ? Math.min(
        Math.max(hull + 4, cx - 72 - hull),
        Math.max(hull + 4, Math.round(W * 0.17)),
      )
    : cx;
  const signCy = logoH + 1 + (roomy ? 24 : 23);

  // The moon, as the sky draws it: its radius, and the glow that reaches 6 px further.
  const moonR = Math.max(6, Math.min(9, Math.round(3 + W / 45)));
  const moonGlow = moonR + 6;
  let moon: { x: number; y: number };
  if (roomy) {
    // High on the right, beside the wordmark. The city's roofs stop 3 px short of the logo
    // zone and its tallest aerial stands at most 6 px above them: the moon's disc ends
    // above that, so no tower ever stands in front of it.
    moon = {
      x: Math.round(W * 0.82),
      y: Math.max(
        moonR + 1,
        Math.min(Math.round(logoH * 0.7), logoH - moonR - 4),
      ),
    };
  } else if (W - 26 < 132) {
    // the wordmark is stacked: the corner of sky left of its first line
    moon = { x: moonR + 5, y: moonR + 6 };
  } else if (W - (cx + hull + 6) >= 2 * moonGlow) {
    // beside the airship's tail
    moon = { x: W - moonGlow - 1, y: logoH + 12 };
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
      x: signCx - Math.floor(signW / 2) - (roomy ? 2 : 0),
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

/** The career stage is this wide, centred on the canvas. Wider canvases show more ground. */
export const STAGE_W = 130;

export interface CareerLayout {
  /** The canvas size this layout was made for. */
  w: number;
  h: number;
  /** The horizontal centre of the stage. */
  cx: number;
  /** The ground line: the row the players' feet stand on. round(H * 0.52). */
  groundY: number;
  /** Left edge of the 130 px stage (may be off-canvas on a narrow screen). */
  stageLeft: number;
  /** Right edge of the stage (first column past it). */
  stageRight: number;
  /** Where the hero rests: cx - 26. */
  heroX: number;
  /** The goal line, at the mouth of the goal: cx + 44. */
  goalX: number;
  /** Where the keeper stands, a few px in front of the goal line: cx + 38. */
  keeperX: number;
  /**
   * The far touchline: the pitch starts here, 9 px behind the players' feet, so stands
   * and backdrops get the rest of the action band.
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

/** Where things go in the career scene for a canvas of `w` x `h` logical pixels. */
export function careerLayout(w: number, h: number): CareerLayout {
  const W = Math.max(1, Math.round(w));
  const H = Math.max(1, Math.round(h));
  const cx = Math.round(W / 2);
  const groundY = Math.round(H * 0.52);
  const stageLeft = cx - STAGE_W / 2;
  return {
    w: W,
    h: H,
    cx,
    groundY,
    stageLeft,
    stageRight: stageLeft + STAGE_W,
    heroX: cx - 26,
    goalX: cx + 44,
    keeperX: cx + 38,
    farTouchY: groundY - 9,
    nearTouchY: groundY + Math.round(H * 0.12),
    actionTop: Math.round(H * 0.31),
    actionBottom: Math.round(H * 0.53),
    boardAskingY: Math.round(H * COVER.boardAsking),
    boardShrunkY: Math.round(H * COVER.boardShrunk),
    answerBarY: H - Math.round(H * COVER.answerBar),
    sheetY: H - Math.round(H * COVER.revealSheet),
  };
}
