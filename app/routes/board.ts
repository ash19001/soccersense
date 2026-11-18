// The day's leaderboards, for the home screen (GET /api/leaderboard, worker/games/board.ts).
// One store for the page, for `useSyncExternalStore`: nothing is fetched until a page
// watches a day, which is after mounting. Browser only.
//
// While the home screen shows a day it keeps that day's boards fresh: at once, every
// minute while the tab is in view, when the tab comes back into view, and when who is
// signed in changes (their own place is part of the answer). Asking costs nothing to a
// player with no account: the answer is the same for everyone, and what they would have
// placed is worked out here from it (`rankFor`, ~/game/board).
//
// In development with no API behind the dev server (and in the tests) the boards are made
// up (`mockBoards`, app/data/leaderboard.ts). Never in a production build: that path is
// behind `import.meta.env.DEV`, and the build leaves it out.

import { mockBoards } from "~/data/leaderboard";
import { type BoardAnswer, isBoardAnswer } from "~/game";
import { gameClock } from "~/ui";

import { accountStore } from "./account";

/** Made-up boards where there is no API: development and the tests only. */
const MOCK_BOARDS: boolean = import.meta.env.DEV;

/** How often the boards are asked for again while the tab is in view. */
export const BOARD_REFRESH_MS = 60_000;
/** A request with no answer by now has failed. */
export const BOARD_TIMEOUT_MS = 10_000;

export interface BoardState {
  /** The day being shown, or null before a page watches one. */
  day: number | null;
  /** That day's boards, once they have arrived. */
  answer: BoardAnswer | null;
}

const NONE: BoardState = { day: null, answer: null };

let state: BoardState = NONE;
let asking = 0;
const listeners = new Set<() => void>();

function set(next: BoardState): void {
  state = next;
  for (const listener of [...listeners]) listener();
}

function api(day: number): string {
  const base = import.meta.env.BASE_URL || "/";
  return new URL(`${base}api/leaderboard?day=${day}`, window.location.href)
    .href;
}

/** Asks for the day's boards now. An answer that comes after the day changed is dropped. */
async function pull(day: number): Promise<void> {
  if (MOCK_BOARDS && !gameClock().api()) {
    if (state.day === day) set({ day, answer: mockBoards(day) });
    return;
  }
  const token = ++asking;
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), BOARD_TIMEOUT_MS);
  try {
    const response = await fetch(api(day), {
      cache: "no-store",
      credentials: "same-origin",
      signal: stop.signal,
    });
    const said: unknown = await response.json().catch(() => null);
    if (token !== asking || state.day !== day) return;
    if (response.ok && isBoardAnswer(said) && said.day === day) {
      set({ day, answer: said });
    }
    // Otherwise the boards shown stay as they were, and the next minute asks again.
  } catch {
    // Not reached: the same.
  } finally {
    clearTimeout(timer);
  }
}

export const boardStore = {
  subscribe(onChange: () => void): () => void {
    listeners.add(onChange);
    return () => {
      listeners.delete(onChange);
    };
  },
  read: (): BoardState => state,
  /** At build time there are no boards. */
  server: (): BoardState => NONE,

  /**
   * Shows `day`'s boards and keeps them fresh until the returned function is called: now,
   * every minute while the tab is in view, when it comes back into view, when the game's
   * clock first answers (in development: whether there is an API at all), and when who is
   * signed in changes.
   */
  watch(day: number): () => void {
    if (state.day !== day) set({ day, answer: null });
    const again = () => {
      if (document.visibilityState !== "hidden") void pull(day);
    };
    void pull(day);
    const timer = window.setInterval(again, BOARD_REFRESH_MS);
    document.addEventListener("visibilitychange", again);
    const stopClock = gameClock().subscribe(again);
    let signedIn = accountStore.read().account?.email ?? null;
    let synced = accountStore.read().synced;
    const stopAccount = accountStore.subscribe(() => {
      const now = accountStore.read();
      const who = now.account?.email ?? null;
      if (who === signedIn && now.synced === synced) return;
      signedIn = who;
      synced = now.synced;
      void pull(day);
    });
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", again);
      stopClock();
      stopAccount();
    };
  },

  /** Asks again now (after a change the page knows of). */
  refresh(): void {
    if (state.day !== null) void pull(state.day);
  },
};

/** For the tests: as if the page had just been opened. */
export function resetBoardStore(): void {
  state = NONE;
  asking = 0;
  listeners.clear();
}
