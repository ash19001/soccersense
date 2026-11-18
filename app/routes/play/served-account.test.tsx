// The game page for a player who is signed in: the page's own code against the Worker's
// own (`handle`), with a real SQLite in memory and a browser's cookie jar behind a stand-in
// for `fetch` (worker/testing/site.ts).
//
// An account's game is kept by the server, not on the device: it is asked for on arriving,
// it is the same on every device, and it cannot be started twice. (./served.test.tsx is the
// same page for a player with no account, who keeps their own game.)

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { HOME_QUESTIONS } from "~/data";
import { type Question, loadGame, saveAccount } from "~/game";
import { strings } from "~/i18n";
import { deviceClock, setGameClock } from "~/ui/game-clock";
import { resetArrivalFocus } from "~/ui/useArrivalFocus";
import { type TestSite, testSite } from "../../../worker/testing/site";
import Play from "../play";
import {
  INTRO_LEAVE_MS,
  INTRO_MS,
  PROMOTION_PATIENCE_MS,
  SHOT_PATIENCE_MS,
} from "./controller";
import { liveKey, loadTicket } from "./progress";

const text = strings.play;
/** The game's eighth day, at noon. */
const NOON = "2026-11-17T12:00:00Z";
const DAY_KEY = "2026-11-17";
const FAN = "fan@example.com";

let site: TestSite;

/** The real event loop's next turn: the fake timers do not reach it. */
const realImmediate = globalThis.setImmediate;
const realTurn = () => new Promise<void>((done) => realImmediate(() => done()));

/** Lets `ms` pass, with every request made meanwhile answered (see ./served.test.tsx). */
async function wait(ms = 20): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
    for (let turn = 0; turn < 2000; turn++) {
      if (site.pending === 0) {
        await vi.advanceTimersByTimeAsync(0);
        await realTurn();
        if (site.pending === 0) break;
      }
      await realTurn();
    }
    await vi.advanceTimersByTimeAsync(0);
  });
}

function page(): void {
  window.history.replaceState(null, "", "/play/home");
  const Stub = createRoutesStub([
    { path: "/", Component: () => <h1>{strings.siteName}</h1> },
    { path: "/play/home", Component: Play },
    { path: "/play/away", Component: Play },
  ]);
  render(<Stub initialEntries={["/play/home"]} />);
}

const modeCard = () => document.querySelector(".ss-intro");

const field = (): HTMLInputElement =>
  screen.getByRole("textbox", { name: text.answer.input });

async function answer(typed: string): Promise<void> {
  fireEvent.change(field(), { target: { value: typed } });
  fireEvent.submit(field().closest("form") as HTMLFormElement);
  await wait();
  // the shot plays (there is no canvas here: the referee stops waiting for it)
  await wait(SHOT_PATIENCE_MS);
}

async function next(): Promise<void> {
  fireEvent.click(
    screen.getByRole("button", {
      name: new RegExp(`^(${text.next}|${text.toFullTime})$`),
    }),
  );
  await wait(PROMOTION_PATIENCE_MS);
  await wait();
}

const asked = (question: Question) =>
  screen.queryByRole("heading", { name: question.prompt });

const best = (question: Question) =>
  question.answers.find((a) => a.shot === "worldie")?.name ??
  question.answers[0].name;

const sheetUp = () => document.querySelectorAll(".ss-table tbody tr").length;

/** The games the server's database holds: whose, and where each stands. */
const storedGames = async () =>
  (
    await site.env.DB.prepare(
      "SELECT a.email, g.day, g.mode, g.idx, g.phase FROM games g JOIN accounts a ON a.id = g.player_id",
    ).all()
  ).results;

const gameCalls = () => site.calls.filter((c) => c.includes("/api/games/"));

/** Signs this browser in, as the sign-in page leaves it: the cookie, and the device's note. */
async function signIn(email = FAN): Promise<void> {
  saveAccount(await site.signIn(email));
  site.calls.length = 0;
}

/** Arrive signed in with no game today, sit through the mode card, and be asked question 1. */
async function kickOff(): Promise<void> {
  page();
  await wait();
  await wait(INTRO_MS + INTRO_LEAVE_MS);
  await wait();
}

/** Another device: nothing of this one's, signed in to the same account. */
function anotherDevice(): void {
  cleanup();
  const note = window.localStorage.getItem("soccersense:v1:account");
  window.localStorage.clear();
  if (note !== null)
    window.localStorage.setItem("soccersense:v1:account", note);
  site.calls.length = 0;
}

beforeEach(() => {
  resetArrivalFocus();
  window.localStorage.clear();
  vi.useFakeTimers({ now: new Date(NOON) });
  // There is an API behind this page: the server runs the game.
  setGameClock({ ...deviceClock(), api: () => true });
  site = testSite();
  vi.stubGlobal("fetch", site.fetch);
});

afterEach(() => {
  cleanup();
  site.close();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  window.history.replaceState(null, "", "/");
});

describe("a signed-in player's game", () => {
  test("the server is asked for it on arriving; with none, the mode card and a new game it keeps", async () => {
    await signIn();
    page();
    await wait();
    // asked at once, with no ticket: the server may have a game from another device
    expect(gameCalls()).toEqual(["POST /api/games/home/look"]);
    expect(modeCard()).not.toBeNull();
    await wait(INTRO_MS + INTRO_LEAVE_MS);
    await wait();
    expect(gameCalls()).toEqual([
      "POST /api/games/home/look",
      "POST /api/games/home/start",
    ]);
    expect(asked(HOME_QUESTIONS[0])).not.toBeNull();
    // the game is the account's row in the database, and no ticket is kept on the device
    expect(await storedGames()).toEqual([
      { email: FAN, day: 8, mode: "home", idx: 0, phase: "asking" },
    ]);
    expect(loadTicket(DAY_KEY, "home")).toBeNull();
    expect(window.localStorage.getItem(liveKey(DAY_KEY, "home"))).toBeNull();
  });

  test("a reload carries on from the server's copy", async () => {
    await signIn();
    await kickOff();
    await answer(best(HOME_QUESTIONS[0]));
    expect(sheetUp()).toBe(5);

    cleanup();
    site.calls.length = 0;
    page();
    await wait();
    expect(gameCalls()).toEqual(["POST /api/games/home/look"]);
    // straight back at the reveal: no mode card, no second game
    expect(modeCard()).toBeNull();
    expect(sheetUp()).toBe(5);
    expect(await storedGames()).toEqual([
      { email: FAN, day: 8, mode: "home", idx: 0, phase: "reveal" },
    ]);
  });

  test("another device signed in to the account has the same game, where it stands", async () => {
    await signIn();
    await kickOff();
    await answer(best(HOME_QUESTIONS[0]));
    await next();
    expect(asked(HOME_QUESTIONS[1])).not.toBeNull();

    anotherDevice();
    page();
    await wait();
    expect(modeCard()).toBeNull();
    expect(asked(HOME_QUESTIONS[1])).not.toBeNull();
    expect(asked(HOME_QUESTIONS[0])).toBeNull();
    expect((await storedGames()).length).toBe(1);
  });

  test("a game finished on one device is full time on another, and kept there for the menu", async () => {
    await signIn();
    await kickOff();
    for (const question of HOME_QUESTIONS) {
      await answer(best(question));
      await next();
    }
    expect(loadGame(DAY_KEY, "home")?.total).toBe(700);
    // the server is told the card is up
    await wait();
    expect(await storedGames()).toEqual([
      { email: FAN, day: 8, mode: "home", idx: 6, phase: "done" },
    ]);

    anotherDevice();
    expect(loadGame(DAY_KEY, "home")).toBeNull();
    page();
    await wait();
    expect(gameCalls()).toEqual(["POST /api/games/home/look"]);
    expect(modeCard()).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    // the full-time card, and the game kept on this device now for its menu
    expect(loadGame(DAY_KEY, "home")?.total).toBe(700);
    expect((await storedGames()).length).toBe(1);
  });

  test("a ticket left on the device from before signing in is dropped for the account's game", async () => {
    // a game in progress with no account: its ticket is on the device
    await kickOff();
    expect(loadTicket(DAY_KEY, "home")).not.toBeNull();
    expect(await storedGames()).toEqual([]);
    cleanup();

    await signIn();
    page();
    await wait();
    // the server has no game of the account's: a new one, kept by the server
    expect(modeCard()).not.toBeNull();
    await wait(INTRO_MS + INTRO_LEAVE_MS);
    await wait();
    expect(asked(HOME_QUESTIONS[0])).not.toBeNull();
    expect(loadTicket(DAY_KEY, "home")).toBeNull();
    expect(await storedGames()).toEqual([
      { email: FAN, day: 8, mode: "home", idx: 0, phase: "asking" },
    ]);
  });

  test("a note that is out of date: the server knows nobody, and the player keeps their own game", async () => {
    await signIn();
    // signed out everywhere since: the device still has its note
    await site.env.DB.prepare("DELETE FROM sessions").run();
    page();
    await wait();
    expect(gameCalls()).toEqual(["POST /api/games/home/look"]);
    expect(modeCard()).not.toBeNull();
    await wait(INTRO_MS + INTRO_LEAVE_MS);
    await wait();
    expect(asked(HOME_QUESTIONS[0])).not.toBeNull();
    // a ticket, as for any player with no account, and nothing in the database
    expect(loadTicket(DAY_KEY, "home")).not.toBeNull();
    expect(await storedGames()).toEqual([]);
  });

  test("two accounts on the same day each have their own game", async () => {
    await signIn();
    await kickOff();
    await answer(best(HOME_QUESTIONS[0]));
    cleanup();
    window.localStorage.clear();
    site.cookies.clear();

    await signIn("other@example.com");
    await kickOff();
    expect(asked(HOME_QUESTIONS[0])).not.toBeNull();
    expect(sheetUp()).toBe(0);
    expect(
      (await storedGames()).map((game) => [game.email, game.phase]).sort(),
    ).toEqual([
      [FAN, "reveal"],
      ["other@example.com", "asking"],
    ]);
  });
});
