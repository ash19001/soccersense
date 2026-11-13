import { MAX_TOTAL } from "./career";
import { rankingYear, ruleFor } from "./scoring";
import type { Session } from "./session";
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
  /**
   * The mode's name as shown on screen: "NEXT-GEN". Left out, the mode's id in capitals
   * ("HOME", "AWAY", "RETRO"; "NEXTGEN" for NEXT-GEN, so pass it).
   */
  modeLabel?: string;
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
 *
 * The same in every mode: RETRO and NEXT-GEN say no more (the years would be spoilers).
 */
export function buildShareText(input: ShareInput): string {
  const { dayNumber, mode, stadiumName, total, tierName, title, grades } =
    input;
  const label = input.modeLabel ?? mode.toUpperCase();
  return [
    `soccersense #${dayNumber} · ${label} · ${stadiumName}`,
    ...(title ? [title] : []),
    `${total}/${MAX_TOTAL} · ${tierName}`,
    grades.map((grade) => GRADE_SYMBOLS[grade]).join(""),
  ].join("\n");
}

// ---------------------------------------------------------------------------
// The share image (docs/GAME_DESIGN.md 6.4): what the game says about each question. The
// words round it come from the interface text, and the picture is painted by
// `paintShareCard` in ~/art/share-card.
// ---------------------------------------------------------------------------

/** One question on the share image. */
export interface ShareCardRow {
  /** The question as it was asked: "Name a club that has won the Premier League". */
  prompt: string;
  /** The name of the answer given, or null after a pass or a time-up. */
  answer: string | null;
  /**
   * RETRO and NEXT-GEN: the year the answer was ranked by (its first in RETRO, its last in
   * NEXT-GEN), shown beside it in place of the share. Null with no answer, and in HOME and
   * AWAY.
   */
  year: number | null;
  grade: Grade;
  points: number;
}

/** Everything the share image says about a finished game, in the game's own terms. */
export interface ShareCard {
  dayNumber: number;
  mode: Mode;
  /** "Anfield" */
  stadiumName: string;
  total: number;
  /** 700 */
  maxTotal: number;
  /** One per question decided, in order. */
  rows: ShareCardRow[];
}

/** The share image's content for a game: one row per question decided. */
export function shareCardFor(session: Session): ShareCard {
  const rule = ruleFor(session.mode);
  return {
    dayNumber: session.dayNumber,
    mode: session.mode,
    stadiumName: session.stadium.name,
    total: session.total,
    maxTotal: MAX_TOTAL,
    rows: session.turns.map((turn, index) => {
      const question = session.questions[index];
      const answer =
        turn.answerId === null
          ? undefined
          : question?.answers.find((a) => a.id === turn.answerId);
      return {
        prompt: question?.prompt ?? "",
        answer: answer?.name ?? null,
        year: answer ? rankingYear(answer, rule) : null,
        grade: turn.grade,
        points: turn.points,
      };
    }),
  };
}
