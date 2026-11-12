import { MAX_TOTAL } from "./career";
import type { Grade, Mode } from "./types";

/**
 * One symbol per grade for the share text, best shot first. Written as escapes so no editor
 * or formatter can mangle them. The stopwatch carries U+FE0F so that it is drawn as an emoji
 * like the rest: on its own, U+23F1 is a plain text glyph on many devices.
 */
export const GRADE_SYMBOLS: Record<Grade, string> = {
  worldie: "\u{1F31F}", // glowing star: the worldie
  golazo: "\u{1F3AF}", // bullseye: curled into the corner
  trivela: "\u{1F4A5}", // collision: bent in off the outside of the boot
  toepoke: "\u{1F308}", // rainbow: it somehow went in
  tapin: "\u26BD", // football: still a goal
  miss: "\u274C", // cross mark
  timeup: "\u23F1\uFE0F", // stopwatch
  skipped: "\u2796", // minus
};

export interface ShareInput {
  dayNumber: number;
  mode: Mode;
  /** "Anfield" */
  stadiumName: string;
  total: number;
  /** The career tier as shown on screen: "TOP FLIGHT" */
  tierName: string;
  /** The title the total earned, as shown on screen: "SEASON TICKET HOLDER". */
  title?: string;
  /** One per question, in order. */
  grades: readonly Grade[];
}

/**
 * The text copied by SHARE. Four lines (three with no title), no spoilers:
 *
 *     soccersense #12 · HOME · Anfield
 *     SEASON TICKET HOLDER
 *     512/700 · TOP FLIGHT
 *     (one symbol per question)
 */
export function buildShareText(input: ShareInput): string {
  const { dayNumber, mode, stadiumName, total, tierName, title, grades } =
    input;
  return [
    `soccersense #${dayNumber} · ${mode.toUpperCase()} · ${stadiumName}`,
    ...(title ? [title] : []),
    `${total}/${MAX_TOTAL} · ${tierName}`,
    grades.map((grade) => GRADE_SYMBOLS[grade]).join(""),
  ].join("\n");
}
