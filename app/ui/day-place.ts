/**
 * The day's place by the site's server: where CLOSEST and FURTHEST measure from, drafted for
 * the day and approved (worker/questions/places.ts; the product owner, 2026-11-19: "i dont
 * want fixed places because eventually questions will get repetitive so it should also be
 * generated"). `/api/today` says it; where it says nothing usable (no API behind the page,
 * the dev server alone; the server already on another day; no answer in time) the page
 * keeps the fixed list's place (app/data/places.ts), as the server does then too.
 *
 * Browser only: call it from effects and handlers.
 */

import { type Place, checkPlace } from "~/data/places";

/** No answer by now: the fixed list's place is played. */
export const PLACE_TIMEOUT_MS = 3000;

const asked = new Map<number, Promise<Place | null>>();

/**
 * The server's place for `day`, or null. Asked once a day a page load (a failed ask is
 * tried again the next time).
 */
export function dayPlace(
  day: number,
  fetcher: typeof fetch = (input, init) => fetch(input, init),
): Promise<Place | null> {
  let kept = asked.get(day);
  if (!kept) {
    kept = ask(day, fetcher);
    asked.set(day, kept);
    void kept.then((place) => {
      if (!place) asked.delete(day);
    });
  }
  return kept;
}

/** For the tests: forget every answer. */
export function forgetDayPlaces(): void {
  asked.clear();
}

async function ask(day: number, fetcher: typeof fetch): Promise<Place | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PLACE_TIMEOUT_MS);
  try {
    const base = import.meta.env.BASE_URL || "/";
    const url = new URL(`${base}api/today`, window.location.href).href;
    const response = await fetcher(url, {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const answer = (await response.json()) as {
      day?: unknown;
      place?: unknown;
    };
    // around midnight the server can be a day on from the page: not this day's place
    if (answer.day !== day) return null;
    return checkPlace(answer.place).place;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
