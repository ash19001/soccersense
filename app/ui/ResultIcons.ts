import type { Bitmap } from "./PixelGlyph";

/**
 * REVIEW's icon, 9 x 9 like the kit's others: a list of results, three bullets and their
 * lines (2026-11-13: an icon in place of the word). On a played mode's card.
 */
export const REVIEW_ICON: Bitmap = [
  "##.######",
  "##.######",
  ".........",
  "##.######",
  "##.######",
  ".........",
  "##.######",
  "##.######",
  ".........",
];

/**
 * SHARE's icon: an arrow rising out of a tray, the usual sign for sharing. On a played
 * mode's card and in its review, beside the close button.
 */
export const SHARE_ICON: Bitmap = [
  "....#....",
  "...###...",
  "..#####..",
  "....#....",
  "#...#...#",
  "#...#...#",
  "#.......#",
  "#.......#",
  "#########",
];

/**
 * SHARE's icon for a moment once it has worked (the share sheet took it, or the picture was
 * saved or the text copied): a tick, in green (2026-11-13: in place of words).
 */
export const TICK_ICON: Bitmap = [
  ".........",
  "........#",
  ".......##",
  "......##.",
  "#....##..",
  "##..##...",
  ".####....",
  "..##.....",
  ".........",
];
