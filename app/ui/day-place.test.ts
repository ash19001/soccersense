/**
 * The day's place by the server (./day-place.ts): taken from `/api/today` for its day,
 * asked once, and nothing (the fixed list's, then) where the answer is no use.
 */
import { afterEach, describe, expect, test, vi } from "vitest";

import { PLACES } from "~/data/places";

import { PLACE_TIMEOUT_MS, dayPlace, forgetDayPlaces } from "./day-place";

const LAGOS = PLACES.find((p) => p.id === "lagos");

/** A server that answers `/api/today` with `body` (and `status`), counting its calls. */
function server(body: unknown, status = 200) {
  const calls: string[] = [];
  const fetcher = vi.fn(async (input: RequestInfo | URL) => {
    calls.push(String(input));
    return new Response(JSON.stringify(body), { status });
  });
  return { calls, fetcher: fetcher as unknown as typeof fetch };
}

afterEach(() => forgetDayPlaces());

describe("the day's place by the server", () => {
  test("the server's place for the day, asked once", async () => {
    const { calls, fetcher } = server({ day: 8, place: LAGOS });
    expect(await dayPlace(8, fetcher)).toEqual(LAGOS);
    expect(await dayPlace(8, fetcher)).toEqual(LAGOS);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatch(/\/api\/today$/);
  });

  test("nothing where the answer is no use, and asked again next time", async () => {
    for (const [body, status] of [
      // the server already on the next day (around midnight)
      [{ day: 9, place: LAGOS }, 200],
      // no API behind the page: the dev server's own page, or a 404
      ["<!doctype html>", 200],
      [{ error: "not_found" }, 404],
      // not a place
      [{ day: 8, place: { ...LAGOS, lat: 0 } }, 200],
      [{ day: 8 }, 200],
    ] as const) {
      const { calls, fetcher } = server(body, status);
      expect(await dayPlace(8, fetcher)).toBeNull();
      await dayPlace(8, fetcher);
      expect(calls).toHaveLength(2);
    }
  });

  test("a server that cannot be reached is nothing too", async () => {
    const fetcher = vi.fn(async () => {
      throw new TypeError("offline");
    }) as unknown as typeof fetch;
    expect(await dayPlace(8, fetcher)).toBeNull();
  });
});

describe("the page's clock has asked the same address already", () => {
  test("its answer says the place: the server is not asked a second time", async () => {
    const { calls, fetcher } = server({ day: 8, place: LAGOS });
    const told = () => Promise.resolve({ day: 8, place: LAGOS });
    expect(await dayPlace(8, fetcher, told)).toEqual(LAGOS);
    expect(calls).toEqual([]);
  });

  test("an answer with no place that can be used is nothing, and still not asked again", async () => {
    const { calls, fetcher } = server({ day: 8, place: LAGOS });
    const told = () => Promise.resolve({ day: 8, place: { name: "nowhere" } });
    expect(await dayPlace(8, fetcher, told)).toBeNull();
    expect(calls).toEqual([]);
  });

  test("where the clock's answer is no use, the server is asked as before", async () => {
    for (const heard of [
      // the clock has not asked (the tests' clock, say)
      null,
      // its request failed, or was not the API's
      Promise.resolve(null),
      Promise.resolve("<!doctype html>"),
      // the page has been open since yesterday: the clock's first answer is another day's
      Promise.resolve({ day: 7, place: LAGOS }),
    ]) {
      forgetDayPlaces();
      const { calls, fetcher } = server({ day: 8, place: LAGOS });
      expect(await dayPlace(8, fetcher, () => heard)).toEqual(LAGOS);
      expect(calls).toHaveLength(1);
    }
  });

  test("a clock still waiting for its answer does not hold the game up for longer than before", async () => {
    vi.useFakeTimers();
    try {
      const { calls, fetcher } = server({ day: 8, place: LAGOS });
      const place = dayPlace(8, fetcher, () => new Promise(() => {}));
      await vi.advanceTimersByTimeAsync(PLACE_TIMEOUT_MS);
      expect(await place).toBeNull();
      expect(calls).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });
});
