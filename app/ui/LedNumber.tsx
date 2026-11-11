import type { CSSProperties } from "react";

import { LED_BLANK, LED_FONT } from "./bitmaps";
import { cx } from "./cx";
import { type Bitmap, type GlyphLayer, PixelGlyph } from "./PixelGlyph";

export type LedSize = "sm" | "lg";
export type LedTone = "amber" | "red" | "green" | "gold" | "chalk";

export interface LedNumberProps {
  /** Digits and any of "/ + - :" and spaces. Numbers are rounded. */
  value: number | string;
  /** Pad on the left with blank cells up to this many characters. */
  digits?: number;
  /**
   * sm: lamps 3 font pixels square, a digit is 19 x 27 (the board total, the clock).
   * lg: lamps 5 font pixels square, a digit is 29 x 41, in a deeper window (full time).
   */
  size?: LedSize;
  tone?: LedTone;
  /** Draw only the lamps, without the dark display window around them. */
  bare?: boolean;
  /** Accessible name. Defaults to the value. Pass "" to hide it from screen readers. */
  label?: string;
  className?: string;
}

/** Font pixels from one lamp to the next. The lamp is one less: a hairline between lamps. */
const PITCH: Record<LedSize, number> = { sm: 4, lg: 6 };

const LAYERS: readonly GlyphLayer[] = [
  { char: ".", className: "ss-led__ghost" },
  { char: "#", className: "ss-led__lit" },
];

/** Joins the characters into one bitmap, with a one-lamp gap between them. */
function compose(text: string): Bitmap {
  const rows: string[] = ["", "", "", "", "", "", ""];
  Array.from(text).forEach((ch, i) => {
    const glyph = LED_FONT[ch] ?? LED_BLANK;
    for (let y = 0; y < 7; y++) {
      rows[y] += (i > 0 ? "." : "") + (glyph[y] ?? ".....");
    }
  });
  return rows;
}

/**
 * A dot-matrix display: every lamp is its own square with a hairline between it and the
 * next. Lit lamps burn in the colour of the tone; the unlit ones are only just visible.
 * It is sized in font pixels, like the type around it.
 */
export function LedNumber({
  value,
  digits = 0,
  size = "sm",
  tone = "amber",
  bare = false,
  label,
  className,
}: LedNumberProps) {
  const raw = typeof value === "number" ? String(Math.round(value)) : value;
  const text = raw.padStart(digits, " ");
  const name = label ?? raw;
  const bitmap = compose(text);
  const pitch = PITCH[size];
  // The width of the lamps in font pixels, for CSS that has to place them (ui.css centres
  // the full-time score on a whole pixel with it).
  const columns = bitmap[0]?.length ?? 0;
  const style = {
    "--led-w": Math.max(0, columns * pitch - 1),
  } as CSSProperties;
  return (
    <span
      className={cx(
        "ss-led",
        `ss-led--${size}`,
        tone !== "amber" && `ss-led--${tone}`,
        bare && "ss-led--bare",
        className,
      )}
      style={style}
      role={name ? "img" : undefined}
      aria-label={name || undefined}
      aria-hidden={name ? undefined : true}
    >
      <PixelGlyph
        bitmap={bitmap}
        layers={LAYERS}
        cell={pitch}
        gap={1}
        unit="fp"
      />
    </span>
  );
}
