/**
 * The questions a day plays in a mode.
 *
 * With the `QUESTIONS` flag at `sample` (worker/env.ts) every day plays the seven built
 * into the game. At `scheduled` a day plays the seven approved for it (../questions/store),
 * and a day that does not have all seven approved plays the sample, so there is always a
 * game and never an unapproved question.
 *
 * The day's place goes with them: where CLOSEST and FURTHEST measure from. At `sample` it
 * is the fixed list's in turn (app/data/places.ts). At `scheduled` it is the place approved
 * for the day (../questions/places.ts), or the fixed list's if none is; and CLOSEST's and
 * FURTHEST's scheduled questions are played only with their day's approved place, since
 * they were chosen for it.
 *
 * A day's scheduled questions and place are remembered for a minute by each instance of the
 * Worker: every move of every game needs them, and they change only when the approval desk
 * changes them. So a change at the desk reaches the games within a minute.
 */

import { questionsFor } from "~/data";
import { PLACES, type Place } from "~/data/places";
import { stadiumForDay } from "~/game/day";
import { isDistanceRule, ruleFor } from "~/game/scoring";
import type { Mode, Question } from "~/game/types";

import { type D1, type Env, type QuestionSource, questionSource } from "../env";
import { approvedPlace } from "../questions/places";
import { scheduledFor } from "../questions/store";

export interface DayQuestions {
  /** Which they are: the sample, or the ones scheduled for the day. */
  source: QuestionSource;
  questions: readonly Question[];
  /** The day's place, where CLOSEST and FURTHEST measure from. */
  place: Place;
}

/** The fixed list's place for a day: the fallback. */
export function fixedPlace(day: number): Place {
  return stadiumForDay(day, PLACES) as Place;
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
    place: fixedPlace(day),
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

  const [scheduled, approved] = await Promise.all([
    scheduledFor(db, day, mode),
    approvedPlace(db, day),
  ]);
  const place = approved ?? sample.place;
  // CLOSEST's and FURTHEST's were chosen for the day's approved place: never another
  const playable =
    scheduled && (approved !== null || !isDistanceRule(ruleFor(mode)));
  const value: DayQuestions = playable
    ? { source: "scheduled", questions: scheduled, place }
    : { ...sample, place };
  // Only what is still fresh stays: other days' questions are not kept for ever.
  for (const [other, entry] of known) {
    if (!fresh(entry.at)) known.delete(other);
  }
  known.set(key, { at: now, value });
  return value;
}

/**
 * The day's place as the games play it (what `questionsOn` gives), for `/api/today`: the
 * page pins and names it. Remembered a minute, as the questions are.
 */
export async function placeOn(
  env: Pick<Env, "QUESTIONS">,
  db: D1 | undefined,
  day: number,
  now: number,
): Promise<Place> {
  if (!db || questionSource(env) !== "scheduled") return fixedPlace(day);
  return (await questionsOn(env, db, day, "closest", now)).place;
}
