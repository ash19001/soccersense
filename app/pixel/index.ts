/** The pixel engine. Import everything from here: `import { Surface, rgb } from "~/pixel"`. */

export {
  TRANSPARENT,
  fromOklab,
  fromRgb,
  hex,
  luma,
  mix,
  rgb,
  shade,
  toHex,
  toOklab,
  toRgb,
  type Color,
} from "./color";
export {
  Surface,
  bayer4,
  type BandOptions,
  type BlitOptions,
  type Point,
} from "./surface";
export {
  FONT_3x5,
  FONT_5x7,
  drawText,
  foldText,
  measureText,
  wrapText,
  type BitmapFont,
  type Glyph,
  type TextOptions,
} from "./text";
export {
  drawSprite,
  frameCount,
  sprite,
  spriteColors,
  type Sprite,
  type SpriteOptions,
} from "./sprite";
export { hash2, rng, type Rng } from "./rand";
export {
  arc,
  clamp,
  easeInCubic,
  easeInOutCubic,
  easeOutBack,
  easeOutCubic,
  frameAt,
  invLerp,
  lerp,
  pingPong,
  remap,
  smoothstep,
  stepped,
  wave,
} from "./ease";
export type { Shot, ShotContext, ShotMap, Sun } from "./shot";
