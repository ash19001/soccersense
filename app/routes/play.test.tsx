// The game page, /play/home and /play/away: a whole game with fake timers, coming back to a
// game after a reload, and the page at build time.

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { MemoryRouter, createRoutesStub } from "react-router";
import {
  type MockInstance,
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

import {
  buildShareText,
  loadGame,
  saveGame,
  createSession,
  reduce,
  type Session,
} from "~/game";
import { HOME_QUESTIONS, STADIUMS } from "~/data";
import { strings } from "~/i18n";
import { CareerScene } from "~/scenes/career";
import { resetArrivalFocus } from "~/ui/useArrivalFocus";
import Play, { meta } from "./play";
import { PROMOTION_PATIENCE_MS, SHOT_PATIENCE_MS } from "./play/controller";
import { liveKey } from "./play/progress";

const text = strings.play;
const DAY_KEY = "2026-11-10";

function Menu() {
  return <h1>{strings.siteName}</h1>;
}

type Entry = string | { pathname: string; search?: string; state?: unknown };

function site(at: Entry = { pathname: "/play/home", search: "?day=1" }) {
  const path = typeof at === "string" ? at : `${at.pathname}${at.search ?? ""}`;
  window.history.replaceState(null, "", path);
  const Stub = createRoutesStub([
    { path: "/", Component: Menu },
    { path: "/play/home", Component: Play },
    { path: "/play/away", Component: Play },
  ]);
  return render(<Stub initialEntries={[at]} />);
}

let shots: MockInstance<CareerScene["playShot"]>;
let promotions: MockInstance<CareerScene["promote"]>;

/** The scene of the game on screen: the last one asked to play anything. */
function scene(): CareerScene {
  const all = [
    ...shots.mock.contexts,
    ...promotions.mock.contexts,
  ] as CareerScene[];
  const last = all.at(-1);
  if (!last) throw new Error("no scene has played anything yet");
  return last;
}

/** Run the scene as the canvas host would. There is no canvas in the tests. */
function play(seconds: number): void {
  const s = scene();
  act(() => {
    for (let t = 0; t < seconds; t += 1 / 60) s.update(1 / 60);
  });
}

function wait(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function field(): HTMLInputElement {
  return screen.getByRole("textbox", { name: text.answer.input });
}

function answer(typed: string): void {
  const input = field();
  fireEvent.change(input, { target: { value: typed } });
  fireEvent.submit(input.closest("form") as HTMLFormElement);
}

function next(): void {
  fireEvent.click(
    screen.getByRole("button", {
      name: new RegExp(`^(${text.next}|${text.toFullTime})$`),
    }),
  );
}

function questionLamps(): string {
  return (
    screen
      .getByRole("img", { name: /^Question \d of 7$/ })
      .getAttribute("aria-label") ?? ""
  );
}

beforeEach(() => {
  resetArrivalFocus();
  window.localStorage.clear();
  vi.useFakeTimers({ now: new Date("2026-11-10T12:00:00Z") });
  shots = vi.spyOn(CareerScene.prototype, "playShot");
  promotions = vi.spyOn(CareerScene.prototype, "promote");
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

describe("the game page", () => {
  test("renders at build time with no browser to read: ink and the heading", () => {
    vi.stubGlobal("window", undefined);
    vi.stubGlobal("document", undefined);
    vi.stubGlobal("localStorage", undefined);
    vi.stubGlobal("navigator", undefined);
    let html: string;
    try {
      html = renderToString(
        <MemoryRouter initialEntries={["/play/away"]}>
          <Play />
        </MemoryRouter>,
      );
    } finally {
      vi.unstubAllGlobals();
    }
    expect(html).toContain(text.heading.away);
    expect(html).toContain("ss-game");
    expect(html).not.toContain("Anfield");
    expect(html).not.toContain(text.answer.shoot);

    const tags =
      meta({ location: { pathname: "/play/away" } } as Parameters<
        typeof meta
      >[0]) ?? [];
    expect(tags).toContainEqual({ title: text.title.away });
  });

  test("a whole HOME game: accepted, rejected, pass, time up, a promotion, full time, share, the other mode", async () => {
    site();
    expect(
      screen.getByRole("heading", { level: 1, name: text.heading.home }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(text.stadium("Anfield", "Liverpool", "England")),
    ).toBeInTheDocument();

    // Question 1. The field has the focus, the clock runs, no PASS yet.
    expect(
      screen.getByRole("heading", { name: HOME_QUESTIONS[0].prompt }),
    ).toBeInTheDocument();
    expect(screen.getByText(text.board.instruction.home)).toBeVisible();
    expect(screen.getByText(text.board.measure.home)).toBeInTheDocument();
    // Today's stadium is still the day's venue: the board names it.
    expect(screen.getByText("ANFIELD")).toBeInTheDocument();
    expect(document.activeElement).toBe(field());
    expect(screen.getByLabelText(text.board.timeLeft(30))).toBeInTheDocument();
    wait(3000);
    expect(screen.getByLabelText(text.board.timeLeft(27))).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: text.answer.pass })).toBeNull();

    // A misspelt answer the judge still knows, and the most common one: the clock stops
    // and the shot plays.
    answer("Manchestr United");
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(document.querySelector(".ss-board--compact")).not.toBeNull();
    expect(shots).toHaveBeenLastCalledWith("worldie", expect.any(Function));
    expect(scene().busy).toBe(true);
    // The board holds the old total until the shot has landed.
    expect(
      screen.getByLabelText(text.board.totalSpoken(0)),
    ).toBeInTheDocument();
    play(2.5);
    expect(
      screen.getByRole("heading", { name: text.grades.worldie }),
    ).toBeInTheDocument();
    expect(screen.getByText("+100")).toBeInTheDocument();
    expect(
      screen.getByText(text.sentence.home.crowd("Manchester United", "30%")),
    ).toBeInTheDocument();
    // The table: each answer's share of players, the most common first.
    expect(
      screen.getByRole("columnheader", { name: text.table.distance }),
    ).toBeInTheDocument();
    const firstRow = screen.getByRole("rowheader", {
      name: /Manchester United/,
    }).parentElement as HTMLElement;
    expect(firstRow).toHaveTextContent("30%");
    // Every Premier League winner is English: no country under the names.
    expect(firstRow).not.toHaveTextContent("England");
    expect(
      screen.getByRole("rowheader", { name: /Blackburn Rovers/ }).parentElement,
    ).toHaveTextContent("2%");
    expect(
      screen.getByLabelText(text.board.totalSpoken(100)),
    ).toBeInTheDocument();
    expect(document.activeElement).toHaveTextContent(text.next);

    // 100 points crossed the first line: the promotion plays before question 2.
    next();
    expect(promotions).toHaveBeenLastCalledWith(100, expect.any(Function));
    expect(
      screen.queryByRole("heading", { name: text.grades.worldie }),
    ).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(
      screen.getByText(text.promoted(text.tiers.sunday)),
    ).toBeInTheDocument();
    // No clock meanwhile: question 2's starts when the promotion is over.
    wait(1000);
    play(1.6);
    expect(questionLamps()).toBe("Question 2 of 7");
    expect(screen.getByLabelText(text.board.timeLeft(30))).toBeInTheDocument();
    expect(document.activeElement).toBe(field());

    // Not on the list: the bar says so, the clock runs on, as often as you like.
    answer("Bob Paisley");
    expect(screen.getByText(text.answer.unknown)).toBeInTheDocument();
    expect(field()).toHaveValue("Bob Paisley");
    answer("Bob Paisley");
    expect(screen.getByText(text.answer.unknown)).toBeInTheDocument();
    // The words go when the answer is changed.
    fireEvent.change(field(), { target: { value: "Bob" } });
    expect(screen.queryByText(text.answer.unknown)).toBeNull();
    // PASS after 8 seconds: 0 points, the "skipped" shot.
    wait(8000);
    fireEvent.click(screen.getByRole("button", { name: text.answer.pass }));
    expect(shots).toHaveBeenLastCalledWith("skipped", expect.any(Function));
    play(2.5);
    expect(
      screen.getByRole("heading", { name: text.grades.skipped }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(text.sentence.skipped.home("Sir Alex Ferguson", "28%")),
    ).toBeInTheDocument();
    // The managers come from all over: the country goes under each name.
    expect(
      screen.getByRole("rowheader", { name: /Sir Alex Ferguson/ })
        .parentElement,
    ).toHaveTextContent("Scotland");
    next();

    // Question 3: the clock runs out. Here the scene never reports back (the tab could be
    // hidden): the game moves on by itself.
    expect(questionLamps()).toBe("Question 3 of 7");
    wait(30_000);
    expect(shots).toHaveBeenLastCalledWith("timeup", expect.any(Function));
    expect(screen.queryByRole("textbox")).toBeNull();
    wait(SHOT_PATIENCE_MS);
    expect(
      screen.getByRole("heading", { name: text.grades.timeup }),
    ).toBeInTheDocument();
    next();

    // Question 4: a lonely answer is no good at HOME, and the reveal says so.
    answer("Simonsen");
    play(2.5);
    expect(
      screen.getByText(text.sentence.home.lonely("Allan Simonsen", "0.2%")),
    ).toBeInTheDocument();
    expect(screen.getByText("+3")).toBeInTheDocument();
    next();
    play(1.6);

    // Questions 5 to 7.
    for (const typed of ["Brazil", "Shearer", "Real Madrid"]) {
      answer(typed);
      play(2.5);
      next();
      play(1.6);
    }

    // Full time.
    expect(
      screen.getByRole("heading", { name: text.fullTime.heading }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(
      screen.getByRole("img", { name: text.fullTime.totalSpoken(391, 700) }),
    ).toBeInTheDocument();
    expect(screen.getByText(text.tiers.topflight)).toBeInTheDocument();
    expect(screen.getByText(text.fullTime.skipped)).toBeInTheDocument();
    expect(screen.getByText(text.fullTime.timeup)).toBeInTheDocument();
    expect(document.activeElement).toHaveTextContent(text.fullTime.share);
    const saved = loadGame(DAY_KEY, "home");
    expect(saved?.total).toBe(391);
    expect(saved?.turns.map((t) => t.grade)).toEqual([
      "worldie",
      "skipped",
      "timeup",
      "wide",
      "worldie",
      "topbins",
      "worldie",
    ]);
    expect(saved?.turns.map((t) => t.share)).toEqual([
      30,
      null,
      null,
      0.2,
      29,
      10,
      24,
    ]);
    expect(window.localStorage.getItem(liveKey(DAY_KEY, "home"))).toBeNull();

    // SHARE copies the summary and says so.
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: text.fullTime.share }),
      );
      await Promise.resolve();
    });
    expect(writeText).toHaveBeenCalledWith(
      buildShareText({
        dayNumber: 1,
        mode: "home",
        stadiumName: "Anfield",
        total: 391,
        tierName: text.tiers.topflight,
        grades: saved?.turns.map((t) => t.grade) ?? [],
      }),
    );
    expect(
      screen.getByRole("button", { name: text.fullTime.copied }),
    ).toBeInTheDocument();
    expect(screen.getByText(text.fullTime.copiedSpoken)).toBeInTheDocument();
    wait(3000);
    expect(
      screen.getByRole("button", { name: text.fullTime.share }),
    ).toBeInTheDocument();

    // PLAY AWAY starts the other mode, from its first question.
    fireEvent.click(
      screen.getByRole("button", { name: text.fullTime.other.away }),
    );
    expect(
      screen.getByRole("heading", { level: 1, name: text.heading.away }),
    ).toBeInTheDocument();
    expect(questionLamps()).toBe("Question 1 of 7");
    expect(screen.getByText(text.board.instruction.away)).toBeVisible();
    expect(screen.getByText(text.board.measure.away)).toBeInTheDocument();
  });

  test("a whole AWAY game: the most niche answer wins, and a deep cut is cheered", () => {
    site({ pathname: "/play/away", search: "?day=1" });
    expect(screen.getByText(text.board.instruction.away)).toBeVisible();

    // The fewest players said Chile: a worldie, and the reveal cheers the deep cut.
    answer("Chile");
    play(2.5);
    expect(
      screen.getByRole("heading", { name: text.grades.worldie }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(text.sentence.away.lonely("Chile", "0.9%")),
    ).toBeInTheDocument();
    // A country answer has no line under its name: it would only repeat itself.
    expect(
      screen.getByRole("rowheader", { name: "Chile" }).parentElement,
    ).toHaveTextContent("0.9%");
    next();
    play(1.6);

    // Question 2 is passed: the sentence names the deepest cut instead.
    wait(8000);
    fireEvent.click(screen.getByRole("button", { name: text.answer.pass }));
    play(2.5);
    expect(
      screen.getByText(
        text.sentence.skipped.away("Stadio Nazionale PNF", "0.2%"),
      ),
    ).toBeInTheDocument();
    next();
    play(1.6);

    for (const typed of ["Goethals", "Once Caldas", "Jerkovic", "Sudan"]) {
      answer(typed);
      play(2.5);
      next();
      play(1.6);
    }

    // The most common answer is the worst one AWAY.
    answer("Sevilla");
    play(2.5);
    expect(
      screen.getByRole("heading", { name: text.grades.wide }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(text.sentence.away.crowd("Sevilla", "16%")),
    ).toBeInTheDocument();
    next();

    expect(
      screen.getByRole("img", { name: text.fullTime.totalSpoken(500, 700) }),
    ).toBeInTheDocument();
    expect(loadGame(DAY_KEY, "away")?.turns.map((t) => t.grade)).toEqual([
      "worldie",
      "skipped",
      "worldie",
      "worldie",
      "worldie",
      "worldie",
      "wide",
    ]);
  });

  test("a clipboard that refuses says so", async () => {
    window.localStorage.setItem(
      `soccersense:v1:${DAY_KEY}:home`,
      JSON.stringify(finished()),
    );
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText: () => Promise.reject(new Error("no")) },
    });
    site({
      pathname: "/play/home",
      search: "?day=1",
      state: { fullTime: DAY_KEY },
    });
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: text.fullTime.share }),
      );
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(
      screen.getByRole("button", { name: text.fullTime.notCopied }),
    ).toBeInTheDocument();
  });

  test("MENU goes back to the ball, the query kept", () => {
    window.localStorage.setItem(
      `soccersense:v1:${DAY_KEY}:home`,
      JSON.stringify(finished()),
    );
    site({
      pathname: "/play/home",
      search: "?day=1",
      state: { fullTime: DAY_KEY },
    });
    fireEvent.click(screen.getByRole("button", { name: text.fullTime.menu }));
    expect(
      screen.getByRole("heading", { name: strings.siteName }),
    ).toBeInTheDocument();
  });

  test("a reload carries on where it was: the reveal, the promotion still to come, the clock", () => {
    site();
    answer("Man United");
    play(2.5);
    expect(
      screen.getByRole("heading", { name: text.grades.worldie }),
    ).toBeInTheDocument();

    // Reloaded on the reveal.
    cleanup();
    site();
    expect(
      screen.getByRole("heading", { name: text.grades.worldie }),
    ).toBeInTheDocument();
    next();
    // The promotion it earned has not been seen yet: it plays now.
    expect(promotions).toHaveBeenLastCalledWith(100, expect.any(Function));
    wait(PROMOTION_PATIENCE_MS);
    expect(questionLamps()).toBe("Question 2 of 7");

    // Reloaded 10 seconds into question 2: the clock has not been given back.
    wait(10_000);
    cleanup();
    site();
    expect(questionLamps()).toBe("Question 2 of 7");
    expect(screen.getByLabelText(text.board.timeLeft(20))).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: text.answer.pass }),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(text.board.totalSpoken(100)),
    ).toBeInTheDocument();

    // Left for longer than the clock: that question is a time-up when the game is back.
    cleanup();
    vi.setSystemTime(Date.now() + 60_000);
    site();
    expect(shots).toHaveBeenLastCalledWith("timeup", expect.any(Function));
  });

  test("a finished game shows its card again on a reload, and the way in from the menu starts afresh", () => {
    window.localStorage.setItem(
      `soccersense:v1:${DAY_KEY}:home`,
      JSON.stringify(finished()),
    );
    // A reload at full time: the history entry remembers it.
    site({
      pathname: "/play/home",
      search: "?day=1",
      state: { fullTime: DAY_KEY },
    });
    expect(
      screen.getByRole("heading", { name: text.fullTime.heading }),
    ).toBeInTheDocument();
    cleanup();

    // From the menu: a new game (the demo allows replays).
    site();
    expect(questionLamps()).toBe("Question 1 of 7");
    expect(
      screen.getByLabelText(text.board.totalSpoken(0)),
    ).toBeInTheDocument();
  });

  test("?notimer=1: the clock never runs out", () => {
    site({ pathname: "/play/home", search: "?day=1&notimer=1" });
    wait(120_000);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.getByLabelText(text.board.timeLeft(30))).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: text.answer.pass }),
    ).toBeInTheDocument();
  });

  test("leaving the page stops its clock and stops waiting for the scene", () => {
    site();
    cleanup();
    // The clock would have run out by now.
    wait(60_000);
    expect(shots).not.toHaveBeenCalled();
    window.localStorage.clear();

    site();
    answer("Arsenal");
    const saved = window.localStorage.getItem(liveKey(DAY_KEY, "home"));
    expect(saved).toContain('"phase":"resolving"');
    cleanup();
    // Nobody moves the game on to its reveal any more.
    wait(SHOT_PATIENCE_MS * 2);
    expect(window.localStorage.getItem(liveKey(DAY_KEY, "home"))).toBe(saved);
  });
});

/** A game played to the end: seven passes. */
function finished(): { total: number; turns: Session["turns"] } {
  let s = createSession({
    mode: "home",
    dayNumber: 1,
    stadium: STADIUMS[0],
    questions: HOME_QUESTIONS,
    now: 0,
  });
  for (let i = 0; i < 7; i++) {
    s = reduce(s, { type: "pass", now: s.startedAt + 9000 });
    s = reduce(s, { type: "resolved" });
    s = reduce(s, { type: "next", now: s.startedAt + 10_000 });
  }
  const done = { total: s.total, turns: s.turns };
  saveGame(DAY_KEY, "home", done, null);
  return done;
}
