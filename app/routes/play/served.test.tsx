// The game page with the site's server running the game: the page's own code (the screen,
// the referee, its requests) against the Worker's own (`handle`), with a real SQLite in
// memory behind it. Only `fetch` is stood in for: it hands each request to the Worker.
//
// The player here has no account, as every player has until there are accounts: the server
// stores nothing about them, and the game is the ticket the page keeps on the device.

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { createRoutesStub } from "react-router";
import {
  type MockInstance,
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

import { HOME_QUESTIONS } from "~/data";
import { MS_PER_DAY, PASS_AFTER_MS, QUESTION_MS, loadGame } from "~/game";
import type { Question } from "~/game";
import { strings } from "~/i18n";
import { CareerScene } from "~/scenes/career";
import { deviceClock, setGameClock } from "~/ui/game-clock";
import { resetArrivalFocus } from "~/ui/useArrivalFocus";
import { handle } from "../../../worker/app";
import type { Env } from "../../../worker/env";
import { type MemoryD1, memoryD1 } from "../../../worker/testing/d1";
import Play from "../play";
import {
  INTRO_LEAVE_MS,
  INTRO_MS,
  PROMOTION_PATIENCE_MS,
  SERVER_RETRY_MS,
  SHOT_PATIENCE_MS,
} from "./controller";
import { serverRuns } from "./Game";
import { liveKey, loadTicket } from "./progress";
import { ServerError, gameServer } from "./server";

const text = strings.play;
/** The game's eighth day, at noon. */
const NOON = "2026-11-17T12:00:00Z";
const DAY_KEY = "2026-11-17";

/** The Worker behind the page. */
interface Site {
  env: Env & { DB: MemoryD1 };
  /** Every request the page made: "POST /api/games/home/start". */
  calls: string[];
  /** While true, no request gets through. */
  down: boolean;
  /** Requests the Worker has not answered yet. */
  pending: number;
}

let site: Site;
let shots: MockInstance<CareerScene["playShot"]>;

function openSite(): Site {
  const DB = memoryD1();
  const made: Site = {
    env: { DB, ASSETS: { fetch: async () => new Response("the site") } },
    calls: [],
    down: false,
    pending: 0,
  };
  vi.stubGlobal("fetch", async (input: unknown, init: RequestInit = {}) => {
    const url = String(input);
    made.calls.push(`${init.method ?? "GET"} ${new URL(url).pathname}`);
    if (made.down) throw new TypeError("Failed to fetch");
    made.pending++;
    try {
      const response = await handle(
        new Request(url, {
          method: init.method ?? "GET",
          headers: new Headers(init.headers),
          ...(typeof init.body === "string" && { body: init.body }),
        }),
        made.env,
        // the server's clock at the moment the request reaches it
        Date.now(),
      );
      // the server gives a player with no account nothing to be known by
      expect(response.headers.get("set-cookie")).toBeNull();
      return response;
    } finally {
      made.pending--;
    }
  });
  return made;
}

/** The real event loop's next turn: the fake timers do not reach it. */
const realImmediate = globalThis.setImmediate;
const realTurn = () => new Promise<void>((done) => realImmediate(() => done()));

/**
 * Lets `ms` pass, with every request made meanwhile answered. The Worker seals its tickets
 * with Web Crypto, which answers on the real event loop, outside the fake timers: so this
 * waits for the Worker itself, however long the machine takes.
 */
async function wait(ms = 20): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
    for (let turn = 0; turn < 2000; turn++) {
      if (site.pending === 0) {
        // what the answer set going (a request of its own, perhaps)
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

/** The page says, on screen, that the server cannot be reached. */
const lost = () =>
  screen
    .queryAllByText(text.server.trouble)
    .some((line) => !line.classList.contains("ss-sr"));

/** Arrive, sit through the mode card, and be asked question 1. */
async function kickOff(): Promise<void> {
  page();
  await wait();
  expect(modeCard()).not.toBeNull();
  await wait(INTRO_MS + INTRO_LEAVE_MS);
  await wait();
}

function field(): HTMLInputElement {
  return screen.getByRole("textbox", { name: text.answer.input });
}

function type(typed: string): void {
  fireEvent.change(field(), { target: { value: typed } });
}

async function answer(typed: string): Promise<void> {
  type(typed);
  fireEvent.submit(field().closest("form") as HTMLFormElement);
  await wait();
}

/** The shot plays (there is no canvas here: the referee stops waiting for it). */
async function shotPlayed(): Promise<void> {
  await wait(SHOT_PATIENCE_MS);
}

/** NEXT QUESTION or FULL TIME, and any promotion it earned. */
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

function rowShots(): (string | null)[] {
  return [...document.querySelectorAll(".ss-table tbody tr")].map((row) =>
    row.getAttribute("data-grade"),
  );
}
const FIVE_SHOTS = ["worldie", "golazo", "trivela", "toepoke", "tapin"];

/** The game in the ticket the device is keeping for a day, as the server sealed it. */
function kept(dayKey = DAY_KEY): {
  day: number;
  index: number;
  phase: string;
  turns: unknown[];
} | null {
  const ticket = loadTicket(dayKey, "home");
  if (!ticket) return null;
  const body = ticket.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(atob(body)) as ReturnType<typeof kept>;
}

/** Everything the server's database has stored about games. */
const storedGames = async () =>
  (await site.env.DB.prepare("SELECT day FROM games").all()).results;

beforeEach(() => {
  resetArrivalFocus();
  window.localStorage.clear();
  vi.useFakeTimers({ now: new Date(NOON) });
  // There is an API behind this page: the server runs the game.
  setGameClock({ ...deviceClock(), api: () => true });
  shots = vi.spyOn(CareerScene.prototype, "playShot");
  site = openSite();
});

afterEach(() => {
  cleanup();
  site.env.DB.close();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

describe("a game the server runs", () => {
  test("a new game: the mode card at once, and question 1 asked for only as the card goes", async () => {
    page();
    await wait();
    // nothing to ask the server yet: there is no game on this device
    expect(modeCard()).not.toBeNull();
    expect(site.calls).toEqual([]);
    expect(asked(HOME_QUESTIONS[0])).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();

    await wait(INTRO_MS + INTRO_LEAVE_MS);
    await wait();
    expect(site.calls).toEqual(["POST /api/games/home/start"]);
    expect(modeCard()).toBeNull();
    expect(asked(HOME_QUESTIONS[0])).not.toBeNull();
    expect(asked(HOME_QUESTIONS[1])).toBeNull();
    // the game is the ticket, kept on the device from the first question
    expect(kept()).toMatchObject({ day: 8, index: 0, phase: "asking" });
  });

  test("a whole game: turned down, answered, passed, the whistle, full time, and kept for the menu", async () => {
    await kickOff();

    // Question 1: something the judge does not know, then the best answer.
    await answer("Qwertyuiop");
    expect(screen.getByText(text.answer.unknown)).toBeInTheDocument();
    expect(shots).not.toHaveBeenCalled();
    await answer(best(HOME_QUESTIONS[0]));
    expect(shots).toHaveBeenLastCalledWith("worldie", expect.any(Function));
    // the sheet waits for the shot
    expect(rowShots()).toEqual([]);
    await shotPlayed();
    expect(rowShots()).toEqual(FIVE_SHOTS);
    expect(
      screen.getByRole("rowheader", {
        name: new RegExp(best(HOME_QUESTIONS[0])),
      }),
    ).toBeInTheDocument();
    await next();

    // Question 2: PASS, once it is offered.
    expect(asked(HOME_QUESTIONS[1])).not.toBeNull();
    expect(screen.queryByRole("button", { name: text.answer.pass })).toBeNull();
    await wait(PASS_AFTER_MS);
    fireEvent.click(screen.getByRole("button", { name: text.answer.pass }));
    await wait();
    expect(shots).toHaveBeenLastCalledWith("skipped", expect.any(Function));
    await shotPlayed();
    expect(rowShots()).toEqual(FIVE_SHOTS);
    await next();

    // Question 3: typed but not sent when the clock runs out. It counts.
    expect(asked(HOME_QUESTIONS[2])).not.toBeNull();
    type(best(HOME_QUESTIONS[2]));
    await wait(QUESTION_MS);
    await wait();
    expect(shots).toHaveBeenLastCalledWith("worldie", expect.any(Function));
    await shotPlayed();
    await next();

    // Question 4: nothing typed at all. Time up.
    expect(asked(HOME_QUESTIONS[3])).not.toBeNull();
    await wait(QUESTION_MS);
    await wait();
    expect(shots).toHaveBeenLastCalledWith("timeup", expect.any(Function));
    await shotPlayed();
    await next();

    for (const index of [4, 5, 6]) {
      expect(asked(HOME_QUESTIONS[index])).not.toBeNull();
      await answer(best(HOME_QUESTIONS[index]));
      await shotPlayed();
      if (index < 6) await next();
    }
    await next();
    expect(document.querySelector(".ss-play-full")).not.toBeNull();
    expect(
      screen.getByRole("img", { name: text.fullTime.totalSpoken(500, 700) }),
    ).toBeInTheDocument();

    // Kept on the device as the menu, the review and SHARE read it: what was asked, and
    // each answer by name, with no list of answers to look anything up in.
    const game = loadGame(DAY_KEY, "home");
    expect(game?.total).toBe(500);
    expect(game?.prompts).toEqual(HOME_QUESTIONS.map((q) => q.prompt));
    expect(game?.turns.map((turn) => turn.name)).toEqual([
      best(HOME_QUESTIONS[0]),
      null,
      best(HOME_QUESTIONS[2]),
      null,
      best(HOME_QUESTIONS[4]),
      best(HOME_QUESTIONS[5]),
      best(HOME_QUESTIONS[6]),
    ]);
    expect(game?.turns.map((turn) => turn.grade)).toEqual([
      "worldie",
      "skipped",
      "worldie",
      "timeup",
      "worldie",
      "worldie",
      "worldie",
    ]);
    // the ticket has done its work: at full time it is gone from the device
    expect(window.localStorage.getItem(liveKey(DAY_KEY, "home"))).toBeNull();
    // and the server has stored nothing about the player or the game
    expect(await storedGames()).toEqual([]);
  });

  test("a finished game is shown again from the device, with the server not asked", async () => {
    await kickOff();
    for (let index = 0; index < 7; index++) {
      await answer(best(HOME_QUESTIONS[index]));
      await shotPlayed();
      await next();
    }
    expect(document.querySelector(".ss-play-full")).not.toBeNull();
    cleanup();
    site.calls.length = 0;

    page();
    await wait();
    expect(document.querySelector(".ss-play-full")).not.toBeNull();
    expect(
      screen.getByRole("img", { name: text.fullTime.totalSpoken(700, 700) }),
    ).toBeInTheDocument();
    expect(modeCard()).toBeNull();
    expect(site.calls).toEqual([]);

    // The device is all that remembers: one that has forgotten is offered the game anew.
    cleanup();
    window.localStorage.clear();
    page();
    await wait();
    expect(document.querySelector(".ss-play-full")).toBeNull();
    expect(modeCard()).not.toBeNull();
    expect(site.calls).toEqual([]);
  });

  test("coming back to a game in progress carries on from the ticket, with the clock still the server's", async () => {
    await kickOff();
    await answer(best(HOME_QUESTIONS[0]));
    cleanup();
    site.calls.length = 0;

    // back in the middle of the shot: straight to its reveal, no card, no shot again
    shots.mockClear();
    page();
    await wait();
    expect(site.calls).toEqual(["POST /api/games/home/look"]);
    expect(modeCard()).toBeNull();
    expect(rowShots()).toEqual(FIVE_SHOTS);
    expect(shots).not.toHaveBeenCalled();
    await next();
    expect(asked(HOME_QUESTIONS[1])).not.toBeNull();
    cleanup();

    // back with a question open: its clock has been running all the while
    await wait(10_000);
    page();
    await wait();
    expect(asked(HOME_QUESTIONS[1])).not.toBeNull();
    expect(
      screen.getByRole("button", { name: text.answer.pass }),
    ).toBeInTheDocument();
    cleanup();

    // back long after: the server calls time on it as it looks
    await wait(5 * 60_000);
    page();
    await wait();
    expect(rowShots()).toEqual(FIVE_SHOTS);
    expect(screen.getAllByText(text.yours.timeup).length).toBeGreaterThan(0);
    expect(kept()).toMatchObject({ index: 1, phase: "reveal" });
  });

  test("when the server cannot be reached the page says so and keeps asking, and the move is played once", async () => {
    site.down = true;
    page();
    await wait();
    // the card needs no server
    expect(modeCard()).not.toBeNull();
    expect(lost()).toBe(false);
    await wait(INTRO_MS + INTRO_LEAVE_MS);
    await wait();
    // question 1 cannot be fetched
    expect(lost()).toBe(true);
    expect(asked(HOME_QUESTIONS[0])).toBeNull();
    await wait(SERVER_RETRY_MS[0] + SERVER_RETRY_MS[1]);
    expect(site.calls.length).toBeGreaterThanOrEqual(3);

    site.down = false;
    await wait(SERVER_RETRY_MS[2]);
    await wait();
    expect(lost()).toBe(false);
    expect(asked(HOME_QUESTIONS[0])).not.toBeNull();

    // An answer that cannot be sent: the bar waits, the line says why.
    site.down = true;
    await answer(best(HOME_QUESTIONS[0]));
    expect(lost()).toBe(true);
    expect(field().readOnly).toBe(true);
    expect(shots).not.toHaveBeenCalled();
    await wait(SERVER_RETRY_MS[0] + SERVER_RETRY_MS[1]);

    site.down = false;
    await wait(SERVER_RETRY_MS[2]);
    await wait();
    expect(shots).toHaveBeenCalledTimes(1);
    expect(shots).toHaveBeenLastCalledWith("worldie", expect.any(Function));
    expect(kept()?.turns).toHaveLength(1);
    await shotPlayed();
    expect(rowShots()).toEqual(FIVE_SHOTS);

    // NEXT that cannot be sent: the button says it is trying, or, where a promotion has
    // played and the sheet has gone, the line does.
    site.down = true;
    fireEvent.click(screen.getByRole("button", { name: text.next }));
    await wait(PROMOTION_PATIENCE_MS);
    await wait();
    expect(
      lost() ||
        screen.queryByRole("button", { name: text.server.retrying }) !== null,
    ).toBe(true);
    expect(asked(HOME_QUESTIONS[1])).toBeNull();
    site.down = false;
    await wait(SERVER_RETRY_MS[4]);
    await wait();
    expect(asked(HOME_QUESTIONS[1])).not.toBeNull();
    expect(kept()).toMatchObject({ index: 1, phase: "asking" });
  });

  test("a ticket that has been meddled with is no game: the page starts a new one", async () => {
    await kickOff();
    await answer(best(HOME_QUESTIONS[0]));
    cleanup();
    // someone edits what the device keeps: a made-up game with every point already won
    const real = loadTicket(DAY_KEY, "home") ?? "";
    const [version, , mark] = real.split(".");
    const forged = btoa(
      JSON.stringify({ ...kept(), index: 6, phase: "done", total: 700 }),
    );
    window.localStorage.setItem(
      liveKey(DAY_KEY, "home"),
      JSON.stringify({ ticket: `${version}.${forged}.${mark}` }),
    );

    page();
    await wait();
    // the server will not take it up, and it is dropped
    expect(document.querySelector(".ss-play-full")).toBeNull();
    expect(modeCard()).not.toBeNull();
    expect(loadTicket(DAY_KEY, "home")).toBeNull();
    await wait(INTRO_MS + INTRO_LEAVE_MS);
    await wait();
    expect(asked(HOME_QUESTIONS[0])).not.toBeNull();
    expect(kept()).toMatchObject({ index: 0, turns: [] });
  });

  test("a game the server will no longer play (days old) gives way to a new one", async () => {
    await kickOff();
    await wait(QUESTION_MS);
    await wait();
    await shotPlayed();
    expect(rowShots()).toEqual(FIVE_SHOTS);
    // the page is left open on the reveal for two days (the date jumps: nothing on the
    // page is counting meanwhile)
    vi.setSystemTime(Date.now() + 2 * MS_PER_DAY);
    fireEvent.click(screen.getByRole("button", { name: text.next }));
    await wait(PROMOTION_PATIENCE_MS);
    await wait();
    if (modeCard()) {
      await wait(INTRO_MS + INTRO_LEAVE_MS);
      await wait();
    }
    expect(asked(HOME_QUESTIONS[0])).not.toBeNull();
    expect(loadTicket(DAY_KEY, "home")).toBeNull();
    expect(kept("2026-11-19")).toMatchObject({ day: 10, index: 0, turns: [] });
  });
});

describe("who runs the game", () => {
  test("in a production build, always the server", () => {
    expect(serverRuns(false, "", false)).toBe(true);
    expect(serverRuns(true, "?day=3&notimer=1", false)).toBe(true);
  });

  test("in development, the server when it is there and no debug switch asks for the page's own game", () => {
    expect(serverRuns(true, "", true)).toBe(true);
    expect(serverRuns(true, "?time=21:30", true)).toBe(true);
    expect(serverRuns(false, "", true)).toBe(false);
    for (const search of ["?day=3", "?stadium=anfield", "?notimer=1"]) {
      expect(serverRuns(true, search, true), search).toBe(false);
    }
  });
});

describe("the page's requests", () => {
  const answering = (status: number, body: unknown) =>
    gameServer({
      base: "http://localhost/api/games",
      request: async () =>
        new Response(typeof body === "string" ? body : JSON.stringify(body), {
          status,
        }),
    });

  const kindOf = async (asking: Promise<unknown>) => {
    try {
      await asking;
      return "answered";
    } catch (error) {
      return error instanceof ServerError ? error.kind : "threw something else";
    }
  };

  test("no game is an answer when looking, and the game's absence when moving", async () => {
    const none = { game: null, ticket: null };
    expect(await answering(200, none).look("home", "t1.a.b")).toBeNull();
    expect(await kindOf(answering(200, none).start("home"))).toBe("gone");
    expect(
      await kindOf(
        answering(404, { error: "no_game" }).next("home", "t1.a.b", 8, 0),
      ),
    ).toBe("gone");
    expect(
      await kindOf(answering(409, { error: "conflict" }).start("home")),
    ).toBe("gone");
  });

  test("anything that is not the API's answer is the server not reached", async () => {
    const cases: [string, ReturnType<typeof gameServer>][] = [
      ["a failing server", answering(500, { error: "server_error" })],
      ["a page where the API should be", answering(200, "<!doctype html>")],
      ["no API at all", answering(404, "Not found")],
      ["an API with no such address", answering(404, { error: "not_found" })],
      ["a game that is not one", answering(200, { game: { day: "today" } })],
      ["an answer with no game in it", answering(200, { ok: true })],
    ];
    for (const [what, server] of cases) {
      expect(await kindOf(server.start("home")), what).toBe("unreachable");
    }
    const offline = gameServer({
      base: "http://localhost/api/games",
      request: async () => {
        throw new TypeError("Failed to fetch");
      },
    });
    expect(
      await kindOf(offline.answer("home", "t1.a.b", 8, 0, "x", false)),
    ).toBe("unreachable");
  });

  test("a move carries the ticket, and says which day's game and which question it is about", async () => {
    const sent: { url: string; init: RequestInit }[] = [];
    const server = gameServer({
      base: "http://localhost/api/games",
      request: async (url, init) => {
        sent.push({ url, init });
        return new Response(JSON.stringify({ game: null, ticket: null }));
      },
    });
    await kindOf(server.answer("nextgen", "t1.a.b", 8, 2, "Arsenal", true));
    await kindOf(server.pass("home", null, 8, 3));
    await kindOf(server.start("away"));
    expect(sent[0].url).toBe("http://localhost/api/games/nextgen/answer");
    expect(sent[0].init.method).toBe("POST");
    expect(JSON.parse(String(sent[0].init.body))).toEqual({
      ticket: "t1.a.b",
      day: 8,
      index: 2,
      input: "Arsenal",
      whistle: true,
    });
    expect(sent[0].init.cache).toBe("no-store");
    // where the server keeps the game itself there is no ticket to send
    expect(JSON.parse(String(sent[1].init.body))).toEqual({ day: 8, index: 3 });
    // a new game is asked for with nothing
    expect(JSON.parse(String(sent[2].init.body))).toEqual({});
  });
});
