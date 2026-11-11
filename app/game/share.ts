import { MAX_TOTAL } from "./career";
import type { Grade, Mode } from "./types";

/**
 * One symbol per grade for the share text. Written as escapes so no editor or formatter can
 * mangle them. The stopwatch carries U+FE0F so that it is drawn as an emoji like the rest:
 * on its own, U+23F1 is a plain text glyph on many devices.
 */
export const GRADE_SYMBOLS: Record<Grade, string> = {
  worldie: "\u{1F31F}", // glowing star
  topbins: "\u{1F3AF}", // bullseye
  goal: "\u26BD", // football
  ontarget: "\u{1F9E4}", // gloves
  wide: "\u274C", // cross mark
  timeup: "\u23F1\uFE0F", // stopwatch
  skipped: "\u2796", // minus
};

export interface ShareInput {
  dayNumber: number;
  mode: Mode;
  /** "Anfield" */
  stadiumName: string;
  total: number;
  /** The career title as shown on screen: "TOP FLIGHT" */
  tierName: string;
  /** One per question, in order. */
  grades: readonly Grade[];
}

/**
 * The text copied by SHARE. Three lines, no spoilers:
 *
 *     soccersense #12 · HOME · Anfield
 *     512/700 · TOP FLIGHT
 *     (one symbol per question)
 */
export function buildShareText(input: ShareInput): string {
  const { dayNumber, mode, stadiumName, total, tierName, grades } = input;
  return [
    `soccersense #${dayNumber} · ${mode.toUpperCase()} · ${stadiumName}`,
    `${total}/${MAX_TOTAL} · ${tierName}`,
    grades.map((grade) => GRADE_SYMBOLS[grade]).join(""),
  ].join("\n");
}
