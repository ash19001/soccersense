/**
 * The day's place by the site's server: where CLOSEST and FURTHEST measure from, drafted for
 * the day and approved (worker/questions/places.ts; the product owner, 2026-11-19: "i dont
 * want fixed places because eventually questions will get repetitive so it should also be
 * generated"). `/api/today` says it; where it says nothing usable (no API behind the page,
 * the dev server alone; the server already on another day; no answer in time) the page
 * keeps the fixed list's place (app/data/places.ts), as the server does then too.
 *
 * The page's clock asks the same address as the page opens (./game-clock.ts), and its
 * answer says the place too: that answer is used where it is this day's, so opening a page
 * asks `/api/today` once, not twice (2026-11-19). Only where the clock's answer is no use
 * (it has not asked, it failed, or the day has changed since) is the server asked here.
 *
 * Browser only: call it from effects and handlers.
 */

import { type Place, checkPlace } from "~/data/places";

import { clockToday } from "./game-clock";

/** No answer by now: the fixed list's place is played. */
export const PLACE_TIMEOUT_MS = 3000;

const asked = new Map<number, Promise<Place | null>>();

/**
 * The server's place for `day`, or null. Asked once a day a page load (a failed ask is
 * tried again the next time). `told` is what the page's clock was told by the same address,
 * if it has asked.
 */
export function dayPlace(
  day: number,
  fetcher: typeof fetch = (input, init) => fetch(input, init),
  told: () => Promise<unknown> | null = clockToday,
): Promise<Place | null> {
  let kept = asked.get(day);
  if (!kept) {
    kept = ask(day, fetcher, told);
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

/**
 * The place an answer of `/api/today` gives for `day`: null where it has none that can be
 * used, and undefined where it is not an answer for this day at all (around midnight the
 * server can be a day on from the page; a page left open can be a day on from its clock's
 * first answer).
 */
function placeIn(answer: unknown, day: number): Place | null | undefined {
  if (typeof answer !== "object" || answer === null) return undefined;
  const said = answer as { day?: unknown; place?: unknown };
  if (said.day !== day) return undefined;
  return checkPlace(said.place).place;
}

const LATE = Symbol("late");

async function ask(
  day: number,
  fetcher: typeof fetch,
  told: () => Promise<unknown> | null,
): Promise<Place | null> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<typeof LATE>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve(LATE);
    }, PLACE_TIMEOUT_MS);
  });
  try {
    // What the clock was told, where it has asked: the same answer, already on its way.
    const heard = told();
    if (heard) {
      const said = await Promise.race([heard, late]);
      if (said === LATE) return null;
      const place = placeIn(said, day);
      if (place !== undefined) return place;
    }
    const base = import.meta.env.BASE_URL || "/";
    const url = new URL(`${base}api/today`, window.location.href).href;
    const response = await fetcher(url, {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return placeIn(await response.json(), day) ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
