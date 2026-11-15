/**
 * The game's clock: the time by the site's own server, not by the device, so turning the
 * phone's clock on (or back) does not open another day's game.
 *
 * Every HTTP response carries a `Date` header: the server's clock, to the second. One HEAD
 * request to the site's own address reads it (no backend: any static host sends it), and
 * from then on the time runs on `performance.now()`, which counts the same whatever the
 * device's clock is set to. It is read again whenever the tab comes back into view (a
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

/**
 * The server's time when its answer arrived at `receivedAt` (both ends on the monotonic
 * clock), or null if the answer has no readable `Date`. The header is the second the answer
 * was made, rounded down, somewhere between asking and hearing back: the middle of that
 * second, half the round trip ago. A cache that kept the answer adds its `Age`.
 */
export function serverTimeOf(
  answer: Answer,
  sentAt: number,
  receivedAt: number,
): number | null {
  const date = Date.parse(answer.headers.get("date") ?? "");
  if (!Number.isFinite(date)) return null;
  const age = Number(answer.headers.get("age") ?? 0);
  const kept = Number.isFinite(age) && age > 0 ? age * 1000 : 0;
  return date + 500 + kept + Math.max(0, receivedAt - sentAt) / 2;
}

/** The site's own favicon, with a query no cache has seen: a tiny answer, never a stale one. */
function freshUrl(): string {
  const base = import.meta.env.BASE_URL || "/";
  const tag = Math.random().toString(36).slice(2, 10);
  return new URL(`${base}favicon.svg?clock=${tag}`, window.location.href).href;
}

function headRequest(url: string, signal: AbortSignal): Promise<Answer> {
  return fetch(url, { method: "HEAD", cache: "no-store", signal });
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
    subscribe: () => () => {},
    check: () => {},
  };
}

let shared: GameClock | null = null;

/**
 * The page's one clock, made (and first asked) on first use. It asks again whenever the tab
 * comes back into view and when the connection comes back.
 */
export function gameClock(): GameClock {
  if (shared) return shared;
  const clock = serverClock();
  shared = clock;
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
