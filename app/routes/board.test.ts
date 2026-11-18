// The page's leaderboard store (./board.ts) against the Worker's own code: only `fetch` is
// stood in for (worker/testing/site.ts), with a browser's cookie jar and a real SQLite.

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { mockBoards } from "~/data/leaderboard";
import { dayNumber, saveAccount } from "~/game";
import { deviceClock, setGameClock } from "~/ui/game-clock";
import { type TestSite, testSite } from "../../worker/testing/site";
import { accountStore, resetAccountStore } from "./account";
import { BOARD_REFRESH_MS, boardStore, resetBoardStore } from "./board";

const TODAY = dayNumber(new Date());

let site: TestSite;
let stop: () => void = () => {};

/** Lets the store's requests be answered. */
async function settle(): Promise<void> {
  for (let turn = 0; turn < 50; turn++) {
    await new Promise<void>((done) => setTimeout(done, 0));
    if (site.pending === 0 && turn > 3) break;
  }
}

const boardCalls = () =>
  site.calls.filter((call) => call.includes("/api/leaderboard"));

/** An account with a game of today's decided, on the board. */
async function onTheBoard(email: string, mode: string, total: number) {
  const db = site.env.DB;
  const account = await site.signIn(email);
  const row = await db
    .prepare("SELECT id FROM accounts WHERE email = ?")
    .bind(email)
    .first<{ id: string }>();
  await db
    .prepare(
      `INSERT INTO games (player_id, day, mode, source, idx, phase, turns, total, started_at,
         deadline, created_at, updated_at, finished_at, origin)
       VALUES (?, ?, ?, 'sample', 6, 'done', '[]', ?, 1, NULL, 1, 1, 1, 'server')`,
    )
    .bind(row?.id, TODAY, mode, total)
    .run();
  await db
    .prepare(
      `INSERT INTO board_tally (day, mode, total, players) VALUES (?, ?, ?, 1)
       ON CONFLICT (day, mode, total) DO UPDATE SET players = players + 1`,
    )
    .bind(TODAY, mode, total)
    .run();
  return account;
}

beforeEach(() => {
  window.localStorage.clear();
  resetAccountStore();
  resetBoardStore();
  site = testSite();
  vi.stubGlobal("fetch", site.fetch);
  // there is an API behind the page
  setGameClock({ ...deviceClock(), api: () => true });
});

afterEach(() => {
  stop();
  stop = () => {};
  vi.useRealTimers();
  site.close();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe("the day's boards", () => {
  test("nothing is asked for until a page watches a day", () => {
    expect(boardStore.read()).toEqual({ day: null, answer: null });
    expect(boardCalls()).toEqual([]);
  });

  test("watching a day asks the server for it, and anyone may", async () => {
    await onTheBoard("one@example.com", "home", 600);
    site.cookies.clear();
    stop = boardStore.watch(TODAY);
    await settle();
    expect(boardCalls()).toEqual(["GET /api/leaderboard"]);
    const { answer } = boardStore.read();
    expect(answer?.day).toBe(TODAY);
    expect(answer?.modes.home.count).toBe(1);
    expect(answer?.modes.home.top[0]).toMatchObject({
      rank: 1,
      name: "soccerfan1",
      points: 600,
    });
    // a player with no account: no place of their own
    expect(answer?.modes.home.you).toBeNull();
    // nothing kept about them, and no cookie
    expect(site.cookies.size).toBe(0);
  });

  test("a signed-in player on the board is told their place", async () => {
    await onTheBoard("one@example.com", "home", 600);
    site.cookies.clear();
    const me = await onTheBoard("two@example.com", "home", 300);
    saveAccount(me);
    stop = boardStore.watch(TODAY);
    await settle();
    expect(boardStore.read().answer?.modes.home.you).toEqual({
      rank: 2,
      points: 300,
    });
  });

  test("asked again every minute while the page is in view", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    stop = boardStore.watch(TODAY);
    await settle();
    await vi.advanceTimersByTimeAsync(BOARD_REFRESH_MS);
    await settle();
    expect(boardCalls().length).toBe(2);
  });

  test("and when who is signed in changes", async () => {
    stop = boardStore.watch(TODAY);
    await settle();
    await accountStore.sendLink("fan@example.com");
    await accountStore.enter(site.lastToken());
    await settle();
    expect(boardCalls().length).toBeGreaterThanOrEqual(2);
  });

  test("a server that cannot be reached leaves the boards shown as they were", async () => {
    stop = boardStore.watch(TODAY);
    await settle();
    const before = boardStore.read().answer;
    expect(before).not.toBeNull();
    site.down = true;
    boardStore.refresh();
    await settle();
    expect(boardStore.read().answer).toBe(before);
  });

  test("an answer for another day, or not a board at all, is not taken", async () => {
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(JSON.stringify({ day: TODAY - 1, modes: {} }), {
          status: 200,
        }),
    );
    stop = boardStore.watch(TODAY);
    await new Promise((done) => setTimeout(done, 10));
    expect(boardStore.read()).toEqual({ day: TODAY, answer: null });
  });

  test("with no API (development and the tests), the made-up boards", async () => {
    setGameClock(deviceClock());
    stop = boardStore.watch(5);
    expect(boardStore.read()).toEqual({ day: 5, answer: mockBoards(5) });
    expect(boardCalls()).toEqual([]);
  });
});
