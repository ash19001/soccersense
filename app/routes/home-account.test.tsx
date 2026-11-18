// The home screen and the player's account: the page's own code against the Worker's own
// (`handle`), with a real SQLite in memory and a browser's cookie jar behind a stand-in for
// `fetch` (worker/testing/site.ts).
//
// The tests' screen is a phone's: the name and account are one button at the top of the
// bell's column, and the account's card has the name and CHANGE. (A monitor's plate, the
// name beside SIGN IN, is MenuCaptions' own test.)

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  type HistoryGame,
  NICKNAME_KEY,
  dayKeyFor,
  dayNumber,
  loadAccount,
  loadGame,
  saveAccount,
  saveGame,
} from "~/game";
import { strings } from "~/i18n";
import { deviceClock, setGameClock } from "~/ui/game-clock";
import { importGames } from "../../worker/games/store";
import { type TestSite, testSite } from "../../worker/testing/site";
import { resetAccountStore } from "./account";
import { resetBoardStore } from "./board";
import Home from "./home";

const names = strings.nickname;
const words = strings.account;
const FAN = "fan@example.com";
const TODAY = dayNumber(new Date());

let site: TestSite;

function mount(day = 1): void {
  window.history.replaceState(null, "", `/?day=${day}`);
  const Stub = createRoutesStub([
    { path: "/", Component: Home },
    { path: "/terms", Component: () => <h1>the terms</h1> },
    { path: "/privacy", Component: () => <h1>the privacy notice</h1> },
  ]);
  render(<Stub initialEntries={["/"]} />);
}

/** Lets the page's requests be answered. */
async function settle(): Promise<void> {
  await act(async () => {
    for (let turn = 0; turn < 200; turn++) {
      await new Promise<void>((done) => setTimeout(done, 0));
      if (site.pending === 0 && turn > 3) break;
    }
  });
}

const accountCalls = () =>
  site.calls.filter((call) => call.includes("/api/account"));

const nickname = () => window.localStorage.getItem(NICKNAME_KEY) ?? "";

/** The bottom left's button: the account's card. */
function accountButton(): HTMLElement {
  return screen.getByRole("button", { name: words.menu.phone(nickname()) });
}

function openAccount(): HTMLElement {
  fireEvent.click(accountButton());
  return screen.getByRole("dialog", {
    name: new RegExp(`^(${words.heading}|${words.headingIn})$`),
  });
}

/** The name's card, from CHANGE on the account's. */
function openName(): HTMLElement {
  const card = openAccount();
  fireEvent.click(
    within(card).getByRole("button", {
      name: words.changeSpoken(nickname()),
    }),
  );
  return screen.getByRole("dialog", { name: names.heading });
}

/** A whole game of a day, as a device keeps it: seven turns of `points` each. */
function game(day: number, mode: HistoryGame["mode"], points = 80) {
  const turns = Array.from({ length: 7 }, (_, i) => ({
    questionId: `q${i}`,
    input: "x",
    answerId: "a",
    grade: "golazo" as const,
    points,
    km: null,
    share: null,
    rank: 2,
    msLeft: 1000,
    name: "An answer",
    year: null,
  }));
  return { day, mode, total: points * 7, turns, prompts: null };
}

const accountId = async () =>
  (
    await site.env.DB.prepare("SELECT id FROM accounts").first<{
      id: string;
    }>()
  )?.id ?? "";

beforeEach(() => {
  window.localStorage.clear();
  resetAccountStore();
  resetBoardStore();
  site = testSite();
  vi.stubGlobal("fetch", site.fetch);
});

afterEach(() => {
  cleanup();
  site.close();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  window.history.replaceState(null, "", "/");
});

describe("a player with no account", () => {
  test("the home screen asks the server nothing about accounts, and no cookie is set", async () => {
    mount();
    await settle();
    expect(accountCalls()).toEqual([]);
    expect(site.cookies.size).toBe(0);
    expect(loadAccount()).toBeNull();
  });

  test("the bottom left opens the sign-in card, which asks which ways in there are", async () => {
    mount();
    await settle();
    const card = openAccount();
    expect(card).toHaveAccessibleName(words.heading);
    expect(within(card).getByRole("status")).toHaveTextContent(words.checking);
    await settle();
    expect(accountCalls()).toEqual(["GET /api/account"]);
    // the player's name is on it
    expect(within(card).getByText(nickname())).toBeInTheDocument();
    // email is switched on here; Google has no key, so it is not offered
    const field = within(card).getByRole("textbox", { name: words.email });
    expect(within(card).queryByRole("link", { name: words.google })).toBeNull();

    // an address that is not one is turned down before anything is sent
    fireEvent.change(field, { target: { value: "fan" } });
    fireEvent.click(within(card).getByRole("button", { name: words.send }));
    await settle();
    expect(
      within(card).getByText(words.problems.bad_email),
    ).toBeInTheDocument();
    expect(accountCalls()).toEqual(["GET /api/account"]);

    // a real one: the link is sent
    fireEvent.change(field, { target: { value: FAN } });
    fireEvent.click(within(card).getByRole("button", { name: words.send }));
    await settle();
    expect(within(card).getByRole("status")).toHaveTextContent(words.sent(FAN));
    expect(site.links).toHaveLength(1);
    // still nobody signed in: that is the link's to do
    expect(site.cookies.size).toBe(0);
  });

  test("a new name is kept on the device; the server is not asked to keep it", async () => {
    mount();
    await settle();
    const card = openName();
    fireEvent.change(within(card).getByRole("textbox", { name: names.field }), {
      target: { value: "Top Bins" },
    });
    fireEvent.click(within(card).getByRole("button", { name: names.save }));
    await settle();
    expect(window.localStorage.getItem(NICKNAME_KEY)).toBe("Top Bins");
    expect(accountCalls().filter((call) => call.startsWith("POST"))).toEqual(
      [],
    );
    // the focus goes back to the button that opened the account's card
    expect(document.activeElement).toBe(accountButton());
  });

  test("the card links the terms and the privacy notice", async () => {
    mount();
    await settle();
    const card = openAccount();
    fireEvent.click(within(card).getByRole("link", { name: words.privacy }));
    await settle();
    expect(
      screen.getByRole("heading", { name: "the privacy notice" }),
    ).toBeInTheDocument();
  });
});

describe("a player signed in", () => {
  beforeEach(async () => {
    saveAccount(await site.signIn(FAN));
    site.calls.length = 0;
  });

  test("the home screen asks who is signed in, and their nickname is the account's", async () => {
    window.localStorage.setItem(NICKNAME_KEY, "soccerfan4821");
    mount();
    await settle();
    expect(accountCalls()).toEqual([
      "GET /api/account",
      "POST /api/account/history",
    ]);
    expect(nickname()).toBe("soccerfan1");
    const card = openAccount();
    expect(card).toHaveAccessibleName(words.headingIn);
    expect(within(card).getByText(FAN)).toBeInTheDocument();
    expect(within(card).getByText("soccerfan1")).toBeInTheDocument();
  });

  test("a new name is the server's to give: kept there, then here", async () => {
    mount();
    await settle();
    const card = openName();
    fireEvent.change(within(card).getByRole("textbox", { name: names.field }), {
      target: { value: "Top Bins" },
    });
    fireEvent.click(within(card).getByRole("button", { name: names.save }));
    await settle();
    expect(screen.queryByRole("dialog", { name: names.heading })).toBeNull();
    expect(nickname()).toBe("Top Bins");
    expect(loadAccount()?.nickname).toBe("Top Bins");
    expect(
      (
        await site.env.DB.prepare("SELECT nickname FROM accounts").all<{
          nickname: string;
        }>()
      ).results,
    ).toEqual([{ nickname: "Top Bins" }]);
  });

  test("a name somebody has, or one kept back, says so and the card stays up", async () => {
    // somebody else has "Top Bins"
    const jar = new Map(site.cookies);
    site.cookies.clear();
    await site.signIn("other@example.com");
    await site.fetch("http://localhost:3000/api/account/name", {
      method: "POST",
      body: JSON.stringify({ nickname: "Top Bins" }),
    });
    site.cookies.clear();
    for (const [name, value] of jar) site.cookies.set(name, value);

    mount();
    await settle();
    const card = openName();
    const field = within(card).getByRole("textbox", { name: names.field });
    const save = () =>
      fireEvent.click(within(card).getByRole("button", { name: names.save }));

    fireEvent.change(field, { target: { value: "top bins" } });
    save();
    await settle();
    expect(within(card).getByText(names.taken)).toBeInTheDocument();

    fireEvent.change(field, { target: { value: "soccerfan99" } });
    save();
    await settle();
    expect(within(card).getByText(names.reserved)).toBeInTheDocument();
    expect(nickname()).toBe("soccerfan1");
  });

  test("SIGN OUT signs the device out", async () => {
    mount();
    await settle();
    const card = openAccount();
    await settle();
    fireEvent.click(within(card).getByRole("button", { name: words.leave }));
    await settle();
    // signed out: the card offers the way back in
    expect(
      within(card).getByRole("textbox", { name: words.email }),
    ).toBeInTheDocument();
    expect(site.cookies.size).toBe(0);
    expect(loadAccount()).toBeNull();
    expect(
      (await site.env.DB.prepare("SELECT id FROM sessions").all()).results,
    ).toEqual([]);
  });

  test("DELETE ACCOUNT asks, then deletes it from the server", async () => {
    const id = await accountId();
    await importGames(site.env.DB, id, [game(TODAY, "away")], Date.now());
    mount();
    await settle();
    const card = openAccount();
    await settle();
    fireEvent.click(within(card).getByRole("button", { name: words.remove }));
    expect(within(card).getByText(words.removeAsk)).toBeInTheDocument();
    fireEvent.click(
      within(card).getByRole("button", { name: words.removeYes }),
    );
    await settle();
    expect(within(card).getByRole("status")).toHaveTextContent(words.removed);
    expect(card).toHaveAccessibleName(words.heading);
    expect(loadAccount()).toBeNull();
    expect(site.cookies.size).toBe(0);
    for (const table of ["accounts", "sessions", "games"]) {
      expect(
        (await site.env.DB.prepare(`SELECT * FROM ${table}`).all()).results,
      ).toEqual([]);
    }
    // this device keeps its own copy of the games
    expect(loadGame(dayKeyFor(TODAY), "away")?.total).toBe(560);
  });
});

describe("a signed-in player's streak, stats and scores are the account's", () => {
  test("games played on another device are brought here: today's score shows", async () => {
    saveAccount(await site.signIn(FAN));
    const id = await accountId();
    await importGames(
      site.env.DB,
      id,
      [game(TODAY, "home"), game(TODAY - 1, "home", 60)],
      Date.now(),
    );
    expect(loadGame(dayKeyFor(TODAY), "home")).toBeNull();
    mount(TODAY);
    await settle();
    expect(loadGame(dayKeyFor(TODAY), "home")?.total).toBe(560);
    expect(loadGame(dayKeyFor(TODAY - 1), "home")?.total).toBe(420);
    // the HOME card shows today's score, as for a game played here
    expect(screen.getByText(strings.home.played(560))).toBeInTheDocument();
  });

  test("games this device played before signing in go to the account, for its streak and stats", async () => {
    const { total, turns } = game(TODAY - 2, "retro", 30);
    saveGame(dayKeyFor(TODAY - 2), "retro", { total, turns });
    saveAccount(await site.signIn(FAN));
    mount();
    await settle();
    expect(
      (
        await site.env.DB.prepare(
          "SELECT day, mode, total, origin FROM games",
        ).all()
      ).results,
    ).toEqual([
      { day: TODAY - 2, mode: "retro", total: 210, origin: "device" },
    ]);
  });
});

describe("today's leaderboard, from the server", () => {
  const board = strings.home.leaderboard;

  /** An account with a game of today's in HOME decided through the server. */
  async function onTheBoard(email: string, total: number) {
    const db = site.env.DB;
    const account = await site.signIn(email);
    const row = await db
      .prepare("SELECT id FROM accounts WHERE email = ?")
      .bind(email)
      .first<{ id: string }>();
    await db
      .prepare(
        `INSERT INTO games (player_id, day, mode, source, idx, phase, turns, total,
           started_at, deadline, created_at, updated_at, finished_at, origin)
         VALUES (?, ?, 'home', 'sample', 6, 'done', '[]', ?, 1, NULL, 1, 1, 1, 'server')`,
      )
      .bind(row?.id, TODAY, total)
      .run();
    await db
      .prepare(
        `INSERT INTO board_tally (day, mode, total, players) VALUES (?, 'home', ?, 1)
         ON CONFLICT (day, mode, total) DO UPDATE SET players = players + 1`,
      )
      .bind(TODAY, total)
      .run();
    return account;
  }

  function openBoard(): HTMLElement {
    fireEvent.click(screen.getByRole("button", { name: board.open }));
    return screen.getByRole("dialog", { name: board.heading });
  }

  beforeEach(() => {
    // there is an API behind the page
    setGameClock({ ...deviceClock(), api: () => true });
  });

  test("nobody yet: the table says so", async () => {
    mount(TODAY);
    await settle();
    const sheet = openBoard();
    expect(within(sheet).getByText(board.empty)).toBeInTheDocument();
    expect(within(sheet).getByText(board.nudge(0))).toBeInTheDocument();
  });

  test("a signed-in player on the board has their row and their place", async () => {
    await onTheBoard("top@example.com", 700);
    site.cookies.clear();
    const me = await onTheBoard(FAN, 560);
    saveAccount(me);
    const { total, turns } = game(TODAY, "home");
    saveGame(dayKeyFor(TODAY), "home", { total, turns });
    mount(TODAY);
    await settle();
    const sheet = openBoard();
    const table = within(sheet).getByRole("table");
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent(/^1.*soccerfan1.*700$/);
    expect(rows[0]).not.toHaveClass("is-you");
    expect(rows[1]).toHaveTextContent(/soccerfan2.*560$/);
    expect(rows[1]).toHaveClass("is-you");
    expect(within(sheet).getByText(board.mine(2, 2))).toBeInTheDocument();
  });

  test("a player with no account who has played is told where they would have placed", async () => {
    await onTheBoard("top@example.com", 700);
    await onTheBoard("mid@example.com", 400);
    site.cookies.clear();
    const { total, turns } = game(TODAY, "home", 90);
    saveGame(dayKeyFor(TODAY), "home", { total, turns });
    site.calls.length = 0;
    mount(TODAY);
    await settle();
    const sheet = openBoard();
    // 630: between the two, them counted in
    expect(within(sheet).getByText(board.wouldBe(2, 3))).toBeInTheDocument();
    // and not put on the board
    const rows = within(within(sheet).getByRole("table")).getAllByRole("row");
    expect(rows).toHaveLength(3);
    expect(sheet.querySelector(".is-you")).toBeNull();
    expect(site.calls.filter((call) => call.startsWith("POST"))).toEqual([]);
  });
});
