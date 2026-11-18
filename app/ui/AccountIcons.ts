import type { Bitmap } from "./PixelGlyph";

/**
 * A head and shoulders: the phone's button for the player's name and account (MenuCaptions),
 * 9 x 9 like the kit's other icons.
 */
export const PERSON: Bitmap = [
  "...###...",
  "..#####..",
  "..#####..",
  "..#####..",
  "...###...",
  ".........",
  ".#######.",
  "#########",
  "#########",
];

/** A pencil, after the player's name on the monitor's plate: a press changes it. */
export const PENCIL: Bitmap = [
  ".......##",
  "......###",
  ".....###.",
  "....###..",
  "...###...",
  "..###....",
  ".###.....",
  ".##......",
  "#........",
];
