import { LAMP } from "./bitmaps";
import { cx } from "./cx";
import { type GlyphLayer, PixelGlyph } from "./PixelGlyph";
import type { UiGrade } from "./types";

const LAMP_LAYERS: readonly GlyphLayer[] = [
  { char: "o", className: "ss-pip__rim" },
  { char: "c", className: "ss-pip__lamp" },
  { char: "h", className: "ss-pip__glint" },
];

export type PipState = "done" | "current" | "todo";

export interface PipProps {
  /** The grade that lights the lamp. `null` is an unlit lamp. */
  grade: UiGrade | null;
  /** "current" blinks. Defaults to "done" with a grade and "todo" without. */
  state?: PipState;
  className?: string;
}

/** One result lamp. */
export function Pip({ grade, state, className }: PipProps) {
  const resolved: PipState = state ?? (grade ? "done" : "todo");
  return (
    <span
      className={cx("ss-pip", className)}
      data-grade={grade ?? undefined}
      data-state={resolved}
    >
      <PixelGlyph bitmap={LAMP} layers={LAMP_LAYERS} />
    </span>
  );
}

export interface PipsProps {
  /** One entry per question: the grade once answered, `null` before. */
  results: ReadonlyArray<UiGrade | null>;
  /** Index of the question being asked (blinks). `null` for none. */
  current?: number | null;
  /** Accessible name for the whole row, for example "Question 3 of 7". */
  label?: string;
  className?: string;
}

/** The row of result lights: coloured by grade, the current one blinking. */
export function Pips({ results, current = null, label, className }: PipsProps) {
  return (
    <span
      className={cx("ss-pips", className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {results.map((grade, i) => (
        <Pip
          key={i}
          grade={grade}
          state={grade ? "done" : i === current ? "current" : "todo"}
        />
      ))}
    </span>
  );
}
