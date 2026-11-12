/** Small builders for the rule tests. Not part of the game: never import this from app code. */
import { ruleFor } from "./scoring";
import { shotsFor } from "./shots";
import type { Answer, Measure, Mode, Question, Stadium } from "./types";

export function slug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function answer(
  name: string,
  lat = 0,
  lng = 0,
  aliases: string[] = [],
  popularity = 1,
): Answer {
  return {
    id: slug(name),
    name,
    aliases,
    place: `${name} place`,
    country: "Testland",
    lat,
    lng,
    popularity,
    // Filed for real by `question`, from the popularity under its mode's rule.
    shot: "miss",
  };
}

/** An answer that only matters for its popularity (a share of players, in percent). */
export function popular(
  name: string,
  popularity: number,
  aliases: string[] = [],
): Answer {
  return answer(name, 1, 1, aliases, popularity);
}

export function question(
  id: string,
  answers: Answer[],
  mode: Mode = "home",
  measure: Measure = "birthplace",
): Question {
  // The answers' shots, filed by the rule from their popularity, as the data is.
  const shots = shotsFor(
    answers.map((a) => a.popularity),
    ruleFor(mode),
  );
  return {
    id,
    mode,
    prompt: `Name something (${id})`,
    measure,
    measureLabel: "where it was born",
    asOf: "2026-11-10",
    answers: answers.map((a, i) => ({ ...a, shot: shots[i] })),
  };
}

export function stadium(id: string, lat = 0, lng = 0): Stadium {
  return {
    id,
    name: id.toUpperCase(),
    city: "Testville",
    country: "Testland",
    lat,
    lng,
  };
}

/** A pin on the equator at the prime meridian: one degree of longitude is 111 km. */
export const ORIGIN: Stadium = stadium("origin", 0, 0);

/**
 * Answers strung out along the equator, so that from ORIGIN `east("A", 3)` is 334 km away
 * (3 degrees at 111.195 km each).
 *
 * Their popularity falls as they get further away (`180 - degrees`), so under HOME
 * (`common`) and AWAY (`niche`) they rank exactly as they do under `closest` and
 * `furthest` from ORIGIN. The session tests lean on that.
 */
export function east(
  name: string,
  degrees: number,
  aliases: string[] = [],
): Answer {
  return answer(name, 0, degrees, aliases, 180 - degrees);
}
