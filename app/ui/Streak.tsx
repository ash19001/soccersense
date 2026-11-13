import { cx } from "./cx";
import { type Bitmap, type GlyphLayer, PixelGlyph } from "./PixelGlyph";

/**
 * The daily streak's flame, 9 x 12 font pixels: an outline in the club's dark red, a red
 * body, a gold heart and a pale core (o, r, g, y). Two frames, the tip leaning one way then
 * the other, so it flickers (ui.css section 25; still with reduced motion).
 */
export const FLAME: readonly Bitmap[] = [
  [
    "....o....",
    "....oo...",
    "...oro...",
    "...orro..",
    "..orrro..",
    "..orrgro.",
    ".orrggro.",
    ".orggyrro",
    "orggyygro",
    "orgyyygro",
    ".orgyygo.",
    "..ooooo..",
  ],
  [
    "...o.....",
    "...oo....",
    "...oro...",
    "..orro...",
    "..orrro..",
    ".orgrro..",
    ".orggrro.",
    ".orrgyrro",
    "orggyygro",
    "orgyyygro",
    ".orgyygo.",
    "..ooooo..",
  ],
];

const LAYERS: readonly GlyphLayer[] = [
  { char: "o", className: "ss-streak__o" },
  { char: "r", className: "ss-streak__r" },
  { char: "g", className: "ss-streak__g" },
  { char: "y", className: "ss-streak__y" },
];

/**
 * The burst round the flame when the streak has just gone up: three frames of sparks
 * flying out (17 x 17 font pixels round the flame's middle), gone in a quarter second.
 */
export const SPARKS: readonly Bitmap[] = [
  [
    ".................",
    ".................",
    ".................",
    "........#........",
    "........#........",
    ".....#.....#.....",
    ".................",
    ".................",
    "...##.......##...",
    ".................",
    ".................",
    ".....#.....#.....",
    "........#........",
    "........#........",
    ".................",
    ".................",
    ".................",
  ],
  [
    ".................",
    "........#........",
    "........#........",
    "...#.........#...",
    "....#.......#....",
    ".................",
    ".................",
    ".................",
    ".##...........##.",
    ".................",
    ".................",
    ".................",
    "....#.......#....",
    "...#.........#...",
    "........#........",
    "........#........",
    ".................",
  ],
  [
    "........#........",
    ".................",
    "..#...........#..",
    ".................",
    ".................",
    ".................",
    ".................",
    ".................",
    "#...............#",
    ".................",
    ".................",
    ".................",
    ".................",
    ".................",
    "..#...........#..",
    ".................",
    "........#........",
  ],
];

export interface StreakProps {
  /** Days in a row with a finished game. 0 shows a cold, grey flame. */
  days: number;
  /** What a screen reader hears: "Daily streak: 4 days in a row". */
  spoken: string;
  /** The tooltip. */
  title?: string;
  /** The streak has just gone up: a burst of sparks and a hop, once. */
  bump?: boolean;
  /** The words beside the flame (default: the number): "STREAK 4" on the full-time card. */
  text?: string;
  className?: string;
}

/** A small pixel flame and the number of days in a row: the daily streak. */
export function Streak({
  days,
  spoken,
  title,
  bump = false,
  text,
  className,
}: StreakProps) {
  return (
    <span
      className={cx("ss-streak", className)}
      data-cold={days <= 0 ? "" : undefined}
      data-bump={bump ? "" : undefined}
      title={title}
    >
      <span className="ss-streak__flame" aria-hidden="true">
        {FLAME.map((bitmap, i) => (
          <PixelGlyph
            key={i}
            bitmap={bitmap}
            layers={LAYERS}
            unit="fp"
            className="ss-streak__frame"
          />
        ))}
        {bump &&
          SPARKS.map((bitmap, i) => (
            <PixelGlyph
              key={`s${i}`}
              bitmap={bitmap}
              unit="fp"
              className="ss-streak__spark"
            />
          ))}
      </span>
      <span className="ss-streak__days" aria-hidden="true">
        {text ?? Math.max(0, Math.round(days))}
      </span>
      <span className="ss-sr">{spoken}</span>
    </span>
  );
}
