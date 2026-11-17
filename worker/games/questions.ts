/**
 * The questions a day plays in a mode.
 *
 * With the `QUESTIONS` flag at `sample` (worker/env.ts) every day plays the seven built
 * into the game. At `scheduled` a day plays the seven approved for it (../questions/store),
 * and a day that does not have all seven approved plays the sample, so there is always a
 * game and never an unapproved question.
 *
 * A day's scheduled questions are remembered for a minute by each instance of the Worker:
 * every move of every game needs them, and they change only when the approval desk changes
 * them. So a change at the desk reaches the games within a minute.
 */

import { questionsFor } from "~/data";
import type { Mode, Question } from "~/game/types";

import { type D1, type Env, type QuestionSource, questionSource } from "../env";
import { scheduledFor } from "../questions/store";

export interface DayQuestions {
  /** Which they are: the sample, or the ones scheduled for the day. */
  source: QuestionSource;
  questions: readonly Question[];
}

/** How long an instance remembers a day's scheduled questions. */
export const QUESTIONS_KEPT_MS = 60_000;

const kept = new WeakMap<
  D1,
  Map<string, { at: number; value: DayQuestions }>
>();

export async function questionsOn(
  env: Pick<Env, "QUESTIONS">,
  db: D1,
  day: number,
  mode: Mode,
  now: number,
): Promise<DayQuestions> {
  const sample: DayQuestions = {
    source: "sample",
    questions: questionsFor(mode),
  };
  if (questionSource(env) !== "scheduled") return sample;

  let known = kept.get(db);
  if (!known) {
    known = new Map();
    kept.set(db, known);
  }
  const fresh = (at: number) => now >= at && now - at < QUESTIONS_KEPT_MS;
  const key = `${day}:${mode}`;
  const found = known.get(key);
  if (found && fresh(found.at)) return found.value;

  const scheduled = await scheduledFor(db, day, mode);
  const value: DayQuestions = scheduled
    ? { source: "scheduled", questions: scheduled }
    : sample;
  // Only what is still fresh stays: other days' questions are not kept for ever.
  for (const [other, entry] of known) {
    if (!fresh(entry.at)) known.delete(other);
  }
  known.set(key, { at: now, value });
  return value;
}
