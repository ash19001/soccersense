/**
 * The layout the inside view of the stadium (`stadium-inside.ts`) was composed with: a frozen
 * copy of what `menuLayout` was when that view was the home screen's backdrop. The home
 * screen now shows the stadium from outside and `menuLayout` describes that picture; these
 * numbers only keep the inside view rendering as it was.
 */

import { COVER, type Zone } from "~/art/layout";

/**
 * How the sky fits the home screen. It has the names of `drawSky`'s options, so it can be
 * spread straight in: `drawSky(s, { light, t, seed, ...m.sky })`.
 */
export interface InsideSky {
  /**
   * The sky's own horizon: a few rows below the top of the stand. The stand hides the sky
   * from there down, so the whole gradient (and the sunset's glow) stays in view above
   * the roof. If the stand leaves gaps at its sides, fill them with `skyFor(light).glow`.
   */
  horizonY: number;
  /** The bottom of the logo zone: the sun and the moon stay below it. */
  clearTop: number;
  /**
   * The column the evening sun climbs and sets in: the open sky to the right of the
   * scoreboard. The morning sun uses its mirror image on the left.
   */
  sunX: number;
  /** The moon: at the left, in the strip between the logo zone and the scoreboard. */
  moon: { x: number; y: number };
}

export interface InsideLayout {
  /** The canvas size this layout was made for. */
  w: number;
  h: number;
  /** The horizontal centre. Everything on the home screen is composed around it. */
  cx: number;
  /** The far edge of the pitch: where the stand meets the grass. round(H * 0.44). */
  horizonY: number;
  /** Everything `drawSky` needs to fit the sky to this screen. */
  sky: InsideSky;
  /** Radius of the menu ball: round(min(W * 0.34, H * 0.165)). */
  ballR: number;
  /** Centre of the menu ball: (cx, ballCy), with ballCy = round(H * 0.70). */
  ballCy: number;
  /** The top 15% of the canvas, full width. The logo sits here: keep it clear sky. */
  logo: Zone;
  /**
   * The stadium scoreboard: centred, from about 0.20 H to 0.33 H, at most 96 wide, and
   * always leaving 20 px of open sky either side of it.
   */
  scoreboard: Zone;
  /** The stand: full width, from about 0.30 H down to the horizon. */
  stand: Zone;
  /** The pitch: full width, from the horizon to the bottom of the canvas. */
  pitch: Zone;
  /** The bottom 10% of the canvas, covered by the captions. Put nothing important here. */
  caption: Zone;
}

/** Where things go in the inside view for a canvas of `w` x `h` logical pixels. */
export function insideLayout(w: number, h: number): InsideLayout {
  const W = Math.max(1, Math.round(w));
  const H = Math.max(1, Math.round(h));
  const cx = Math.round(W / 2);
  const horizonY = Math.round(H * 0.44);

  const logoH = Math.round(H * COVER.menuLogo);
  const boardTop = Math.round(H * 0.2);
  const boardBottom = Math.round(H * 0.33);
  // Wide enough for "TODAY'S STADIUM" in the small font, never wider than a phone, and
  // always with a strip of sky either side for the sun to climb.
  const boardW = Math.max(1, Math.min(96, W - 40));
  const boardX = cx - Math.floor(boardW / 2);
  const standTop = Math.round(H * 0.3);
  const captionH = Math.round(H * COVER.menuCaptions);
  // The middle of the sky to the right of the scoreboard, but never out by the far edge
  // of a wide screen.
  const boardRight = boardX + boardW;
  const sunX = Math.min(
    Math.round((boardRight + W) / 2),
    cx + Math.max(Math.round(W * 0.26), Math.floor(boardW / 2) + 14),
  );

  return {
    w: W,
    h: H,
    cx,
    horizonY,
    sky: {
      horizonY: standTop + 4,
      clearTop: logoH,
      sunX,
      moon: { x: Math.round(W * 0.2), y: Math.round(H * 0.175) },
    },
    ballR: Math.round(Math.min(W * 0.34, H * 0.165)),
    ballCy: Math.round(H * 0.7),
    logo: { x: 0, y: 0, w: W, h: logoH },
    scoreboard: {
      x: boardX,
      y: boardTop,
      w: boardW,
      h: boardBottom - boardTop,
    },
    stand: { x: 0, y: standTop, w: W, h: horizonY - standTop },
    pitch: { x: 0, y: horizonY, w: W, h: H - horizonY },
    caption: { x: 0, y: H - captionH, w: W, h: captionH },
  };
}
