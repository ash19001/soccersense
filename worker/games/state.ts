/**
 * A game the server runs, as it stands between two moves: everything that cannot be worked
 * out again. Where the game is, the turns decided so far (each with its answer's name,
 * share and points as they were), the total, and the current question's clock. The
 * questions are not in it: they are the day's (./questions.ts), matched to the turns by id.
 *
 * Who keeps it depends on who is playing (./play.ts): a player with no account keeps it
 * themselves, sealed (./ticket.ts); an account's is a row in the database (./store.ts).
 */

import type { ServedPhase } from "~/game/served";
import type { Turn } from "~/game/session";
import type { Mode } from "~/game/types";

import type { QuestionSource } from "../env";

export interface GameState {
  /** The game's day (`dayNumber`) and mode. */
  day: number;
  mode: Mode;
  /** Which questions it was started with: the sample, or the day's scheduled ones. */
  source: QuestionSource;
  /** The current question, 0-based. */
  index: number;
  phase: ServedPhase;
  turns: Turn[];
  total: number;
  /** The current question's clock, by the server's time. Null deadline unless asking. */
  startedAt: number;
  deadline: number | null;
  createdAt: number;
  updatedAt: number;
  /** When the last question was decided. Null until then. */
  finishedAt: number | null;
}
