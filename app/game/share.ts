import { MAX_TOTAL } from "./career";
import { rankingYear, ruleFor } from "./scoring";
import type { Session } from "./session";
import type { Grade, Mode } from "./types";

// ---------------------------------------------------------------------------
// The share image (docs/GAME_DESIGN.md 6.4): what the game says about each question. The
// words round it come from the interface text, and the picture is painted by
// `paintShareCard` in ~/art/share-card.
//
// The picture carries the result. The text that goes with it says none of it (the product
// owner, 2026-11-17: "it shouldn't say all that extra stuff because it's in the image"): it
// is two lines of the interface text, `shareText` in ~/routes/play/names.
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
