/**
 * The game's clock: the time by the site's own server, not by the device, so turning the
 * phone's clock on (or back) does not open another day's game.
 *
 * One request to the site's own API, `/api/today`, reads it: the Worker answers with
 * its clock to the millisecond in an `x-server-time` header (worker/http.ts). The page's
 * first look is a GET, whose body (the day, and the day's place) is kept for whoever wants
 * it (`clockToday`, ./day-place.ts), so opening a page asks that address once, not twice;
 * every later look is a HEAD, which the server answers without looking the place up. Where
 * there is no API to answer (the dev server alone, any static host), the answer still carries a
 * `Date` header, as every HTTP response does: the server's clock to the second, and that is
 * read instead. From then on the time runs on `performance.now()`, which counts the same
 * whatever the device's clock is set to. It is read again whenever the tab comes back into view (a
 * sleeping device may pause `performance.now()`), and a reading within `CLOCK_SLACK_MS` of
 * the running time leaves it as it is, so it never jitters.
 *
 * Browser only: call it from effects and handlers. The tests run on the device's clock
 * (`setGameClock(deviceClock())` in vitest.setup.ts).
 */

/** Whether the time is known: `checking` until the server is first heard from. */
export type ClockStatus = "checking" | "ready" | "failing";

export interface GameClock {
  /** Milliseconds since 1970 by the server, or null until it has been heard from. */
  now(): number | null;
  status(): ClockStatus;
  /**
   * The time came from the site's own API (its `x-server-time`): there is a Worker behind
   * this page, which can run the games too. False where only a `Date` header answered (the
   * dev server alone, a static host), and until the server has been heard from.
   */
  api(): boolean;
  /** Hear when the status changes or the time is put right. Returns the way to stop. */
  subscribe(onChange: () => void): () => void;
  /** Ask the server again (the tab came back into view, say). */
  check(): void;
}

/** A reading this close to the running time leaves it alone: `Date` is to the second. */
export const CLOCK_SLACK_MS = 2000;
/** A request with no answer by now has failed. */
export const CLOCK_TIMEOUT_MS = 5000;
/** The waits before asking again after a failure, the last one repeated. */
export const CLOCK_RETRY_MS: readonly number[] = [
  1000, 2000, 4000, 8000, 15000,
];

/** The parts of `fetch`'s answer the clock reads. */
interface Answer {
  headers: { get(name: string): string | null };
}

export interface ServerClockOptions {
  /** Asks `url` with a HEAD request. `fetch`, unless a test says otherwise. */
  request?: (url: string, signal: AbortSignal) => Promise<Answer>;
  /** A fresh address on the site for each request. */
  url?: () => string;
  /** A clock that never jumps: `performance.now()`. */
  monotonic?: () => number;
  /** The device's clock, used only when the server sends no `Date`. */
  device?: () => number;
  setTimer?: (run: () => void, ms: number) => unknown;
  clearTimer?: (timer: unknown) => void;
}

/** The API's header: the server's time in milliseconds since 1970 (worker/http.ts). */
export const SERVER_TIME_HEADER = "x-server-time";

/** The API's own time in an answer, if it carries one: thirteen digits, 2001 to 2286. */
function exactTime(answer: Answer): number | null {
  const exact = answer.headers.get(SERVER_TIME_HEADER);
  return exact !== null && /^\d{13}$/.test(exact.trim()) ? Number(exact) : null;
}

/**
 * The server's time when its answer arrived at `receivedAt` (both ends on the monotonic
 * clock), or null if the answer has no readable time.
 *
 * The API's `x-server-time` is the millisecond the answer was made, half the round trip
 * ago. Without it, `Date` is the second the answer was made, rounded down, somewhere between
 * asking and hearing back: the middle of that second, half the round trip ago; a cache that
 * kept the answer adds its `Age`.
 */
export function serverTimeOf(
  answer: Answer,
  sentAt: number,
  receivedAt: number,
): number | null {
  const trip = Math.max(0, receivedAt - sentAt) / 2;
  // a time, not a stray word
  const exact = exactTime(answer);
  if (exact !== null) return exact + trip;
  const date = Date.parse(answer.headers.get("date") ?? "");
  if (!Number.isFinite(date)) return null;
  const age = Number(answer.headers.get("age") ?? 0);
  const kept = Number.isFinite(age) && age > 0 ? age * 1000 : 0;
  return date + 500 + kept + trip;
}

/**
 * The API's day, with a query no cache has seen: a tiny answer, never a stale one. Where
 * nothing answers at that address the host's own answer (a 404, the dev server's page)
 * still has its `Date`.
 */
function freshUrl(): string {
  const base = import.meta.env.BASE_URL || "/";
  const tag = Math.random().toString(36).slice(2, 10);
  return new URL(`${base}api/today?clock=${tag}`, window.location.href).href;
}

function headRequest(url: string, signal: AbortSignal): Promise<Answer> {
  return fetch(url, { method: "HEAD", cache: "no-store", signal });
}

/**
 * The page's own clock's requests. The first is a GET: the same answer that carries the
 * time says the day and the day's place in its body, which is kept (`today`) for the page
 * that would otherwise ask the same address again as it opens (./day-place.ts). Every
 * later look at the clock is a HEAD, as before: the time alone.
 *
 * To know before `QUESTIONS` (wrangler.jsonc) is switched to "scheduled": the server then
 * looks the day's place up in the database for a GET (worker/app.ts, `todaysPlace`), so
 * the clock's first answer waits for that lookup on every page, HOME's, AWAY's, RETRO's and
 * NEXT-GEN's too, which never show the place (about one database round trip; the clock
 * then reads half of it behind, inside its slack). If that is ever felt, make the first
 * look a HEAD on the pages that do not want the place: `dayPlace` already asks by itself
 * where the clock kept nothing.
 */
export function clockRequests(
  fetcher: typeof fetch = (input, init) => fetch(input, init),
): {
  request(url: string, signal: AbortSignal): Promise<Answer>;
  /** What the first answer's body said, or null: not asked yet, or not usable. */
  today(): Promise<unknown> | null;
} {
  let first = true;
  let today: Promise<unknown> | null = null;
  return {
    request(url, signal) {
      if (!first) {
        return fetcher(url, { method: "HEAD", cache: "no-store", signal });
      }
      first = false;
      const answer = fetcher(url, { cache: "no-store", signal });
      // The clock reads only the headers: the body is read from a copy.
      today = answer
        .then((response) => (response.ok ? response.clone().json() : null))
        .catch(() => null);
      return answer;
    },
    today: () => today,
  };
}

/** The clock by the server's `Date` (see the top of this file). */
export function serverClock(options: ServerClockOptions = {}): GameClock {
  const request = options.request ?? headRequest;
  const url = options.url ?? freshUrl;
  const monotonic = options.monotonic ?? (() => performance.now());
  const device = options.device ?? (() => Date.now());
  const setTimer =
    options.setTimer ?? ((run: () => void, ms: number) => setTimeout(run, ms));
  const clearTimer =
    options.clearTimer ??
    ((timer: unknown) => clearTimeout(timer as ReturnType<typeof setTimeout>));

  /** The server's time at `at` on the monotonic clock, once heard. */
  let base: { time: number; at: number } | null = null;
  let current: ClockStatus = "checking";
  /** The last answer was the API's own. */
  let fromApi = false;
  let asking = false;
  let failures = 0;
  let retry: unknown = null;
  const listeners = new Set<() => void>();

  const now = (): number | null =>
    base === null ? null : base.time + (monotonic() - base.at);

  const tell = () => {
    for (const listener of [...listeners]) listener();
  };

  const settle = (time: number, at: number) => {
    failures = 0;
    const running = now();
    const moved =
      running === null ||
      Math.abs(running + (at - monotonic()) - time) > CLOCK_SLACK_MS;
    if (moved) base = { time, at };
    const was = current;
    current = "ready";
    if (moved || was !== "ready") tell();
  };

  const fail = () => {
    const wait =
      CLOCK_RETRY_MS[Math.min(failures, CLOCK_RETRY_MS.length - 1)] ?? 15000;
    failures++;
    // Once the time is known it runs on by itself: a failed check changes nothing.
    if (current === "checking") {
      current = "failing";
      tell();
    }
    if (base === null && retry === null) {
      retry = setTimer(() => {
        retry = null;
        check();
      }, wait);
    }
  };

  const check = () => {
    if (asking) return;
    if (retry !== null) {
      clearTimer(retry);
      retry = null;
    }
    asking = true;
    const controller = new AbortController();
    const timeout = setTimer(() => controller.abort(), CLOCK_TIMEOUT_MS);
    const sentAt = monotonic();
    let answer: Promise<Answer>;
    try {
      answer = request(url(), controller.signal);
    } catch (error) {
      answer = Promise.reject(error);
    }
    answer.then(
      (heard) => {
        clearTimer(timeout);
        asking = false;
        const receivedAt = monotonic();
        const time = serverTimeOf(heard, sentAt, receivedAt);
        fromApi = exactTime(heard) !== null;
        // A server that sends no `Date` leaves the device's clock as the only one there is.
        settle(time ?? device(), receivedAt);
      },
      () => {
        clearTimer(timeout);
        asking = false;
        fail();
      },
    );
  };

  return {
    now,
    status: () => current,
    api: () => fromApi,
    subscribe(onChange) {
      listeners.add(onChange);
      return () => {
        listeners.delete(onChange);
      };
    },
    check,
  };
}

/** The device's own clock, always ready: for the tests, and for nothing else. */
export function deviceClock(
  device: () => number = () => Date.now(),
): GameClock {
  return {
    now: device,
    status: () => "ready",
    api: () => false,
    subscribe: () => () => {},
    check: () => {},
  };
}

let shared: GameClock | null = null;
/** The body of the page's clock's first answer (`clockRequests`), once it has asked. */
let sharedToday: (() => Promise<unknown> | null) | null = null;

/**
 * What `/api/today` said when the page's clock first asked it: `{ day, place, ... }`
 * (worker/app.ts, `TodayAnswer`), unchecked. Null where the clock has not asked (or is not
 * the server's: the tests), and resolving to null where the answer was no use.
 */
export function clockToday(): Promise<unknown> | null {
  return sharedToday?.() ?? null;
}

/**
 * The page's one clock, made (and first asked) on first use. It asks again whenever the tab
 * comes back into view and when the connection comes back.
 */
export function gameClock(): GameClock {
  if (shared) return shared;
  const asks = clockRequests();
  const clock = serverClock({ request: asks.request });
  shared = clock;
  sharedToday = asks.today;
  const again = () => {
    if (document.visibilityState !== "hidden") clock.check();
  };
  document.addEventListener("visibilitychange", again);
  window.addEventListener("online", again);
  clock.check();
  return clock;
}

/** Use this clock from now on (the tests' device clock). Null goes back to the server's. */
export function setGameClock(clock: GameClock | null): void {
  shared = clock;
  sharedToday = null;
}

/** The query switches that change the game itself: the day, the stadium, the timer. */
const GAME_SWITCHES = ["day", "stadium", "notimer"];

/**
 * The address's query as the game may read it: in a production build, without `?day=`,
 * `?stadium=` and `?notimer=` (another day's game, another stadium, no clock). They work in
 * development only. The switches that change only the picture (`?time=`, `?speed=`) stay.
 */
export function gameSearch(
  search: string,
  debug: boolean = import.meta.env.DEV,
): string {
  if (debug) return search;
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search);
  } catch {
    return "";
  }
  for (const key of GAME_SWITCHES) params.delete(key);
  const rest = params.toString();
  return rest ? `?${rest}` : "";
}
