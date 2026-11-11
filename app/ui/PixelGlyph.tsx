import type { CSSProperties } from "react";

import { cx } from "./cx";

/** A tiny bitmap written as rows of characters. "." and " " are empty. */
export type Bitmap = readonly string[];

export interface GlyphLayer {
  /** Which character in the bitmap this layer paints. */
  char: string;
  /** Class that sets `fill`. Without one the layer uses the current text colour. */
  className?: string;
}

export interface PixelGlyphProps {
  bitmap: Bitmap;
  /** Layers, painted in order. Default: one layer for "#" in the current text colour. */
  layers?: readonly GlyphLayer[];
  /** Units from one bitmap cell to the next (default 1). */
  cell?: number;
  /**
   * Units of background left showing between cells (default 0). With a gap every cell is
   * drawn on its own, `cell - gap` units square: a dot matrix.
   */
  gap?: number;
  /** What a unit is: a logical pixel ("px", the default) or a font pixel ("fp"). */
  unit?: "px" | "fp";
  className?: string;
  /** Accessible name. Without it the glyph is decorative and hidden from screen readers. */
  label?: string;
}

/**
 * SVG path data for every cell of `bitmap` equal to `char`. Cells are `cell` units apart.
 * With `dot` equal to `cell` touching cells merge into one rectangle per run; with a
 * smaller `dot` every cell is drawn on its own, `dot` units square, from its top left.
 */
export function bitmapPath(
  bitmap: Bitmap,
  char: string,
  cell = 1,
  dot = cell,
): string {
  let d = "";
  for (let y = 0; y < bitmap.length; y++) {
    const row = bitmap[y] ?? "";
    let x = 0;
    while (x < row.length) {
      if (row[x] !== char) {
        x++;
        continue;
      }
      let run = 1;
      while (dot === cell && row[x + run] === char) run++;
      const w = (run - 1) * cell + dot;
      d += `M${x * cell} ${y * cell}h${w}v${dot}h${-w}z`;
      x += run;
    }
  }
  return d;
}

export function bitmapSize(bitmap: Bitmap): { w: number; h: number } {
  let w = 0;
  for (const row of bitmap) w = Math.max(w, row.length);
  return { w, h: bitmap.length };
}

const DEFAULT_LAYERS: readonly GlyphLayer[] = [{ char: "#" }];

/**
 * Pixel art from rectangles. The drawing is laid out in whole units and the element is
 * exactly that many --px (or --fp) wide and tall, so every edge lands on a CSS pixel at
 * any scale. Colour comes from CSS (currentColor by default).
 */
export function PixelGlyph({
  bitmap,
  layers = DEFAULT_LAYERS,
  cell = 1,
  gap = 0,
  unit = "px",
  className,
  label,
}: PixelGlyphProps) {
  const { w, h } = bitmapSize(bitmap);
  const dot = Math.max(1, cell - gap);
  // The last column and the last row end with a lamp, not with a gap.
  const width = Math.max(0, (w - 1) * cell + dot);
  const height = Math.max(0, (h - 1) * cell + dot);
  const style: CSSProperties = {
    width: `calc(var(--${unit}) * ${width})`,
    height: `calc(var(--${unit}) * ${height})`,
  };
  return (
    <svg
      className={cx("ss-glyph", className)}
      style={style}
      viewBox={`0 0 ${width} ${height}`}
      shapeRendering="crispEdges"
      focusable="false"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {layers.map((layer) => (
        <path
          key={layer.char}
          className={layer.className}
          d={bitmapPath(bitmap, layer.char, cell, dot)}
        />
      ))}
    </svg>
  );
}
