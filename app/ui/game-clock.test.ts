import { describe, expect, test } from "vitest";

import { SERVER_TIME_HEADER as WORKER_TIME_HEADER } from "../../worker/http";
import {
  CLOCK_RETRY_MS,
  CLOCK_SLACK_MS,
  CLOCK_TIMEOUT_MS,
  SERVER_TIME_HEADER,
  clockRequests,
  deviceClock,
  gameSearch,
  serverClock,
  serverTimeOf,
} from "./game-clock";

/** A server answer with these headers. */
function answer(headers: Record<string, string>) {
  return {
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
  };
}

const NOON = Date.UTC(2026, 10, 15, 12, 0, 0);
const HTTP_NOON = new Date(NOON).toUTCString();

/**
 * A server clock run by hand: its requests wait until answered, its monotonic clock and
 * timers move only when told.
 */
function harness() {
  let mono = 1000;
  let device = NOON + 3 * 86_400_000; // the phone says three days on
  const pending: {
    resolve: (a: ReturnType<typeof answer>) => void;
    reject: (e: unknown) => void;
    signal: AbortSignal;
  }[] = [];
  const timers = new Map<number, { at: number; run: () => void }>();
  let nextTimer = 1;
  const clock = serverClock({
    request: (_url, signal) =>
      new Promise((resolve, reject) => {
        pending.push({ resolve, reject, signal });
        signal.addEventListener("abort", () => reject(new Error("aborted")));
      }),
    url: () => "https://example.test/favicon.svg?clock=x",
    monotonic: () => mono,
    device: () => device,
    setTimer: (run, ms) => {
      const id = nextTimer++;
      timers.set(id, { at: mono + ms, run });
      return id;
    },
    clearTimer: (id) => {
      timers.delete(id as number);
    },
  });
  let told = 0;
  clock.subscribe(() => told++);
  return {
    clock,
    pending,
    told: () => told,
    /** Move the monotonic clock on, running any timers that come due. */
    pass(ms: number) {
      mono += ms;
      for (const [id, timer] of [...timers]) {
        if (timer.at <= mono) {
          timers.delete(id);
          timer.run();
        }
      }
    },
    setDevice(ms: number) {
      device = ms;
    },
    timers: () => timers.size,
  };
}

/** Let the promise callbacks run. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("serverTimeOf", () => {
  test("is the middle of the Date header's second, half the round trip ago", () => {
    const time = serverTimeOf(answer({ date: HTTP_NOON }), 100, 300);
    expect(time).toBe(NOON + 500 + 100);
  });

  test("adds the Age a cache kept the answer for", () => {
    const time = serverTimeOf(answer({ date: HTTP_NOON, age: "30" }), 100, 100);
    expect(time).toBe(NOON + 500 + 30_000);
  });

  test("is null with no Date, or one that cannot be read", () => {
    expect(serverTimeOf(answer({}), 0, 0)).toBeNull();
    expect(serverTimeOf(answer({ date: "yesterday" }), 0, 0)).toBeNull();
  });

  test("takes the API's exact time over the Date header: the millisecond, half the round trip ago", () => {
    // the Worker's answer (worker/http.ts): no half-second guess, and no Age
    const exact = NOON + 437;
    const time = serverTimeOf(
      answer({
        "x-server-time": String(exact),
        date: HTTP_NOON,
        age: "30",
      }),
      100,
      300,
    );
    expect(time).toBe(exact + 100);
  });

  test("an x-server-time that is not a time is passed over for the Date", () => {
    for (const odd of ["", "soon", "12", "1794913534933.5", "-1794913534933"]) {
      const time = serverTimeOf(
        answer({ "x-server-time": odd, date: HTTP_NOON }),
        0,
        0,
      );
      expect(time, odd).toBe(NOON + 500);
    }
    expect(serverTimeOf(answer({ "x-server-time": "later" }), 0, 0)).toBeNull();
  });

  test("the clock's header is the Worker's header", () => {
    expect(SERVER_TIME_HEADER).toBe(WORKER_TIME_HEADER);
  });
});

describe("serverClock", () => {
  test("knows nothing until the server answers, then runs on the monotonic clock", async () => {
    const h = harness();
    expect(h.clock.now()).toBeNull();
    expect(h.clock.status()).toBe("checking");
    h.clock.check();
    h.pending[0].resolve(answer({ date: HTTP_NOON }));
    await settle();
    expect(h.clock.status()).toBe("ready");
    expect(h.told()).toBe(1);
    const first = h.clock.now();
    expect(first).toBe(NOON + 500);
    // The phone's clock goes on a day, and back a week: the game's does not move.
    h.setDevice(NOON + 86_400_000);
    h.setDevice(NOON - 7 * 86_400_000);
    h.pass(60_000);
    expect(h.clock.now()).toBe(NOON + 500 + 60_000);
  });

  test("a reading within the slack leaves the time alone; a bigger one puts it right", async () => {
    const h = harness();
    h.clock.check();
    h.pending[0].resolve(answer({ date: HTTP_NOON }));
    await settle();
    h.pass(10_000);
    // Rounded to the second, the server says much the same: nothing changes.
    h.clock.check();
    h.pending[1].resolve(
      answer({ date: new Date(NOON + 10_000).toUTCString() }),
    );
    await settle();
    expect(h.clock.now()).toBe(NOON + 500 + 10_000);
    expect(h.told()).toBe(1);
    // The device slept and its monotonic clock stopped: the server says an hour on.
    h.clock.check();
    const later = NOON + 10_000 + 3_600_000;
    h.pending[2].resolve(answer({ date: new Date(later).toUTCString() }));
    await settle();
    expect(h.clock.now()).toBe(later + 500);
    expect(h.told()).toBe(2);
    expect(CLOCK_SLACK_MS).toBeGreaterThan(1000);
  });

  test("a failed request says so, and asks again after a wait", async () => {
    const h = harness();
    h.clock.check();
    h.pending[0].reject(new TypeError("Failed to fetch"));
    await settle();
    expect(h.clock.status()).toBe("failing");
    expect(h.clock.now()).toBeNull();
    h.pass(CLOCK_RETRY_MS[0] - 1);
    expect(h.pending).toHaveLength(1);
    h.pass(1);
    expect(h.pending).toHaveLength(2);
    h.pending[1].resolve(answer({ date: HTTP_NOON }));
    await settle();
    expect(h.clock.status()).toBe("ready");
    expect(h.timers()).toBe(0);
  });

  test("a request with no answer gives up after the timeout", async () => {
    const h = harness();
    h.clock.check();
    h.pass(CLOCK_TIMEOUT_MS);
    await settle();
    expect(h.pending[0].signal.aborted).toBe(true);
    expect(h.clock.status()).toBe("failing");
  });

  test("once the time is known, a failed check changes nothing", async () => {
    const h = harness();
    h.clock.check();
    h.pending[0].resolve(answer({ date: HTTP_NOON }));
    await settle();
    h.clock.check();
    h.pending[1].reject(new TypeError("offline"));
    await settle();
    expect(h.clock.status()).toBe("ready");
    expect(h.clock.now()).toBe(NOON + 500);
    expect(h.timers()).toBe(0);
  });

  test("one request at a time", () => {
    const h = harness();
    h.clock.check();
    h.clock.check();
    expect(h.pending).toHaveLength(1);
  });

  test("says whether the site's API answered: a Worker that can run the games too", async () => {
    const h = harness();
    expect(h.clock.api()).toBe(false);
    h.clock.check();
    h.pending[0].resolve(answer({ date: HTTP_NOON }));
    await settle();
    // only a Date header: the dev server alone, a static host
    expect(h.clock.api()).toBe(false);
    h.clock.check();
    h.pending[1].resolve(
      answer({ date: HTTP_NOON, "x-server-time": String(NOON) }),
    );
    await settle();
    expect(h.clock.api()).toBe(true);
    expect(deviceClock().api()).toBe(false);
  });

  test("a server that sends no Date leaves the device's clock", async () => {
    const h = harness();
    h.clock.check();
    h.pending[0].resolve(answer({}));
    await settle();
    expect(h.clock.status()).toBe("ready");
    expect(h.clock.now()).toBe(NOON + 3 * 86_400_000);
  });
});

describe("the page's clock's requests", () => {
  /** A site that answers `/api/today`, and what it was asked. */
  function site(body: unknown, status = 200) {
    const asked: { url: string; method: string }[] = [];
    const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      asked.push({ url: String(input), method });
      return new Response(method === "HEAD" ? null : JSON.stringify(body), {
        status,
        headers: { "x-server-time": String(NOON) },
      });
    }) as typeof fetch;
    return { asked, fetcher };
  }
  const signal = () => new AbortController().signal;

  test("the first look is a GET, and its body is kept: the day and its place come with the time", async () => {
    const { asked, fetcher } = site({ day: 8, place: { id: "lagos" } });
    const asks = clockRequests(fetcher);
    // nothing to say before the clock has asked
    expect(asks.today()).toBeNull();
    const heard = await asks.request(
      "https://example.test/api/today",
      signal(),
    );
    // the clock still reads the time from the same answer
    expect(serverTimeOf(heard, 0, 0)).toBe(NOON);
    expect(asked).toEqual([
      { url: "https://example.test/api/today", method: "GET" },
    ]);
    expect(await asks.today()).toEqual({ day: 8, place: { id: "lagos" } });
  });

  test("every later look is a HEAD: the time alone, and the kept body stays the first one", async () => {
    const { asked, fetcher } = site({ day: 8 });
    const asks = clockRequests(fetcher);
    await asks.request("https://example.test/api/today", signal());
    await asks.request("https://example.test/api/today", signal());
    await asks.request("https://example.test/api/today", signal());
    expect(asked.map((ask) => ask.method)).toEqual(["GET", "HEAD", "HEAD"]);
    expect(await asks.today()).toEqual({ day: 8 });
  });

  test("an answer that is not the API's, or a request that fails, keeps nothing", async () => {
    const refused = clockRequests(site({ error: "not_found" }, 404).fetcher);
    await refused.request("https://example.test/api/today", signal());
    expect(await refused.today()).toBeNull();

    // no API behind the page: the host's own page comes back
    const page = clockRequests(
      (async () =>
        new Response("<!doctype html>", { status: 200 })) as typeof fetch,
    );
    await page.request("https://example.test/api/today", signal());
    expect(await page.today()).toBeNull();

    const offline = clockRequests((async () => {
      throw new TypeError("offline");
    }) as typeof fetch);
    await expect(
      offline.request("https://example.test/api/today", signal()),
    ).rejects.toThrow("offline");
    expect(await offline.today()).toBeNull();
  });
});

test("the device clock is always ready", () => {
  const clock = deviceClock(() => 42);
  expect(clock.status()).toBe("ready");
  expect(clock.now()).toBe(42);
});

describe("gameSearch", () => {
  test("a production build drops the switches that change the game", () => {
    expect(gameSearch("?day=3", false)).toBe("");
    expect(gameSearch("?day=3&stadium=anfield&notimer=1", false)).toBe("");
    expect(gameSearch("?day=3&time=21:30&speed=2", false)).toBe(
      "?time=21%3A30&speed=2",
    );
    expect(gameSearch("", false)).toBe("");
  });

  test("development keeps every switch", () => {
    expect(gameSearch("?day=3&notimer=1", true)).toBe("?day=3&notimer=1");
  });
});
