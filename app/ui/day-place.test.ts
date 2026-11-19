/**
 * The day's place by the server (./day-place.ts): taken from `/api/today` for its day,
 * asked once, and nothing (the fixed list's, then) where the answer is no use.
 */
import { afterEach, describe, expect, test, vi } from "vitest";

import { PLACES } from "~/data/places";

import { dayPlace, forgetDayPlaces } from "./day-place";

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
