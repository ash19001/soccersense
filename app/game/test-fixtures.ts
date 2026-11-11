/** Small builders for the rule tests. Not part of the game: never import this from app code. */
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
): Answer {
  return {
    id: slug(name),
    name,
    aliases,
    place: `${name} place`,
    country: "Testland",
    lat,
    lng,
  };
}

export function question(
  id: string,
  answers: Answer[],
  mode: Mode = "home",
  measure: Measure = "birthplace",
): Question {
  return {
    id,
    mode,
    prompt: `Name something (${id})`,
    measure,
    measureLabel: "where it was born",
    asOf: "2026-11-10",
    answers,
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
 */
export function east(
  name: string,
  degrees: number,
  aliases: string[] = [],
): Answer {
  return answer(name, 0, degrees, aliases);
}
