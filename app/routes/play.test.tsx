// The game page, /play/home and /play/away: the mode card before a new game, a whole game
// with fake timers, coming back to a game after a reload, and the page at build time.

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
import { type ClockStatus, deviceClock, setGameClock } from "~/ui/game-clock";
import { resetArrivalFocus } from "~/ui/useArrivalFocus";
import Play, { meta } from "./play";
import {
  INTRO_LEAVE_MS,
  INTRO_MS,
  PROMOTION_PATIENCE_MS,
  SHOT_PATIENCE_MS,
} from "./play/controller";
import { liveKey } from "./play/progress";

const text = strings.play;
const DAY_KEY = "2026-11-10";

function Menu() {
  return <h1>{strings.siteName}</h1>;
}

type Entry = string | { pathname: string; search?: string; state?: unknown };

/**
 * The page at `at`. A new game starts with the mode card, and most of these tests are
 * about what comes after it: the card is let run its course unless `card` says to keep it.
 */
function site(
  at: Entry = { pathname: "/play/home", search: "?day=1" },
  { card = false }: { card?: boolean } = {},
) {
  const path = typeof at === "string" ? at : `${at.pathname}${at.search ?? ""}`;
  window.history.replaceState(null, "", path);
  const Stub = createRoutesStub([
    { path: "/", Component: Menu },
    { path: "/play/home", Component: Play },
    { path: "/play/away", Component: Play },
  ]);
  const page = render(<Stub initialEntries={[at]} />);
  if (!card && modeCard()) pastCard();
  return page;
}

/** The mode card, while it is up. */
function modeCard(): HTMLElement | null {
  return document.querySelector(".ss-intro");
}

/** The mode card runs its course: nothing is pressed. */
function pastCard(): void {
  wait(INTRO_MS + INTRO_LEAVE_MS);
}

let shots: MockInstance<CareerScene["playShot"]>;
let promotions: MockInstance<CareerScene["promote"]>;
let holds: MockInstance<CareerScene["holdOpening"]>;
let opens: MockInstance<CareerScene["beginOpening"]>;

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

/** The table row of an answer on the reveal. */
function tableRow(name: RegExp): HTMLElement {
  return screen.getByRole("rowheader", { name }).parentElement as HTMLElement;
}

/** The shots of the reveal's rows, top to bottom. */
function rowShots(): (string | null)[] {
  return [...document.querySelectorAll(".ss-table tbody tr")].map((row) =>
    row.getAttribute("data-grade"),
  );
}

/** One row for each shot that scores, best first: every reveal's table. */
const FIVE_SHOTS = ["worldie", "golazo", "trivela", "toepoke", "tapin"];

/** The player's own answer above the table, there when it did not score. */
function yours(): HTMLElement | null {
  return document.querySelector(".ss-sheet__yours");
}

/** What the reveal says, with the shares as the page formats them. */
const crowd = text.sentence.picked.crowd;
const lonely = text.sentence.picked.lonely;

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
  holds = vi.spyOn(CareerScene.prototype, "holdOpening");
  opens = vi.spyOn(CareerScene.prototype, "beginOpening");
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
    // The board does not name the day's stadium (it is only read out, above).
    expect(screen.queryByText("ANFIELD")).toBeNull();
    expect(document.querySelector(".ss-board")).not.toHaveTextContent(
      /anfield/i,
    );
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
    // The most common answer: a worldie.
    expect(
      screen.getByRole("heading", { name: text.grades.worldie }),
    ).toBeInTheDocument();
    expect(screen.getByText("+100")).toBeInTheDocument();
    expect(
      screen.getByText(
        text.sentence.home.worldie("Manchester United", crowd("30%")),
      ),
    ).toBeInTheDocument();
    // The table: one answer for each shot that scores, the player's in its own shot's row,
    // each with its share of players and its shot.
    expect(
      screen.getByRole("columnheader", { name: text.table.distance }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: text.table.shot }),
    ).toBeInTheDocument();
    const firstRow = tableRow(/Manchester United/);
    expect(firstRow).toHaveTextContent("30%");
    expect(firstRow).toHaveTextContent(text.shots.worldie);
    expect(firstRow).toHaveAttribute("data-grade", "worldie");
    expect(firstRow).toHaveClass("is-you", "is-best");
    // Every Premier League winner is English: no country under the names.
    expect(firstRow).not.toHaveTextContent("England");
    // The other shots: the answer most players picked in each.
    expect(tableRow(/Manchester City/)).toHaveTextContent(text.shots.golazo);
    expect(tableRow(/Liverpool/)).toHaveTextContent(text.shots.trivela);
    expect(tableRow(/Liverpool/)).toHaveTextContent("17%");
    expect(tableRow(/Chelsea/)).toHaveTextContent(text.shots.toepoke);
    const last = tableRow(/Leicester City/);
    expect(last).toHaveTextContent("4%");
    expect(last).toHaveTextContent(text.shots.tapin);
    expect(last).toHaveTextContent(/10$/);
    expect(rowShots()).toEqual(FIVE_SHOTS);
    // No miss, and no other answers: Arsenal shares the trivelas with Liverpool.
    expect(screen.queryByRole("rowheader", { name: /Blackburn/ })).toBeNull();
    expect(screen.queryByRole("rowheader", { name: /Arsenal/ })).toBeNull();
    expect(yours()).toBeNull();
    expect(
      screen.getByRole("table", { name: text.table.caption }),
    ).toBeInTheDocument();
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
    // No answer: five rows, none of them the player's, and the 0 above them.
    expect(rowShots()).toEqual(FIVE_SHOTS);
    expect(document.querySelector(".ss-table tr.is-you")).toBeNull();
    expect(yours()).toHaveTextContent(text.yours.none);
    expect(yours()).toHaveTextContent(text.yours.skipped);
    expect(yours()).toHaveTextContent(/0$/);
    expect(
      screen.getByText(text.yours.spokenNone(text.yours.skipped, 0)),
    ).toHaveClass("ss-sr");
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
    expect(rowShots()).toEqual(FIVE_SHOTS);
    expect(yours()).toHaveTextContent(text.yours.timeup);
    next();

    // Question 4: a lonely answer is no good at HOME: a miss, with no points to show.
    answer("Simonsen");
    expect(shots).toHaveBeenLastCalledWith("miss", expect.any(Function));
    play(2.5);
    expect(
      screen.getByRole("heading", { name: text.grades.miss }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        text.sentence.home.miss("Allan Simonsen", lonely("0.2%")),
      ),
    ).toBeInTheDocument();
    expect(document.querySelector(".ss-sheet__points")).toBeNull();
    // A miss is not a row: the answer and its 0 stand above the five, in the miss colour.
    expect(
      screen.queryByRole("rowheader", { name: /Allan Simonsen/ }),
    ).toBeNull();
    expect(rowShots()).toEqual(FIVE_SHOTS);
    expect(document.querySelector(".ss-table tr.is-you")).toBeNull();
    expect(yours()).toHaveAttribute("data-grade", "miss");
    expect(yours()).toHaveTextContent(
      `${text.table.you}Allan Simonsen0.2%${text.shots.miss}0`,
    );
    expect(
      screen.getByText(
        text.yours.spoken("Allan Simonsen", "0.2%", text.shots.miss, 0),
      ),
    ).toHaveClass("ss-sr");
    next();

    // Question 5: England have won it, but few say them first: a tap-in.
    answer("England");
    expect(shots).toHaveBeenLastCalledWith("tapin", expect.any(Function));
    play(2.5);
    expect(
      screen.getByRole("heading", { name: text.grades.tapin }),
    ).toBeInTheDocument();
    expect(screen.getByText("+10")).toBeInTheDocument();
    expect(
      screen.getByText(text.sentence.home.tapin("England", crowd("5%"))),
    ).toBeInTheDocument();
    next();

    // Question 6: Shearer, near the top of the crowd's list: a golazo.
    answer("Shearer");
    play(2.5);
    expect(
      screen.getByRole("heading", { name: text.grades.golazo }),
    ).toBeInTheDocument();
    expect(screen.getByText("+80")).toBeInTheDocument();
    expect(
      screen.getByText(text.sentence.home.golazo("Alan Shearer", crowd("10%"))),
    ).toBeInTheDocument();
    next();
    play(1.6);

    // Question 7: Chelsea, a solid crowd pick: a trivela.
    answer("Chelsea");
    play(2.5);
    expect(
      screen.getByRole("heading", { name: text.grades.trivela }),
    ).toBeInTheDocument();
    expect(screen.getByText("+60")).toBeInTheDocument();
    expect(
      screen.getByText(text.sentence.home.trivela("Chelsea", crowd("4%"))),
    ).toBeInTheDocument();
    next();
    play(1.6);

    // Full time: 100 + 0 + 0 + 0 + 10 + 80 + 60.
    expect(
      screen.getByRole("heading", { name: text.fullTime.heading }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(
      screen.getByRole("img", { name: text.fullTime.totalSpoken(250, 700) }),
    ).toBeInTheDocument();
    expect(screen.getByText(text.tiers.nonleague)).toBeInTheDocument();
    // 250 in HOME earns the title from 220 up, shown big with the total.
    expect(document.querySelector(".ss-full__title")).toHaveTextContent(
      `${text.fullTime.titleSpoken}: ${text.titles.home.piequeue}`,
    );
    expect(
      screen.getByText(
        text.fullTime.spoken(
          250,
          700,
          text.titles.home.piequeue,
          text.tiers.nonleague,
        ),
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(text.fullTime.skipped)).toBeInTheDocument();
    expect(screen.getByText(text.fullTime.timeup)).toBeInTheDocument();
    // The board and its sound switch have gone, but the crowd plays on: one switch remains.
    expect(screen.getAllByRole("switch")).toHaveLength(1);
    // Each answer with its shot: the card's list, in the shot's colour.
    const card = document.querySelector(".ss-full__list") as HTMLElement;
    expect(
      [...card.querySelectorAll(".ss-full__row")].map((row) =>
        row.getAttribute("data-grade"),
      ),
    ).toEqual([
      "worldie",
      "skipped",
      "timeup",
      "miss",
      "tapin",
      "golazo",
      "trivela",
    ]);
    expect(
      [...card.querySelectorAll(".ss-full__shot")].map((s) => s.textContent),
    ).toEqual([
      text.shots.worldie,
      text.shots.miss,
      text.shots.tapin,
      text.shots.golazo,
      text.shots.trivela,
    ]);
    expect(document.activeElement).toHaveTextContent(text.fullTime.share);
    const saved = loadGame(DAY_KEY, "home");
    expect(saved?.total).toBe(250);
    expect(saved?.turns.map((t) => t.grade)).toEqual([
      "worldie",
      "skipped",
      "timeup",
      "miss",
      "tapin",
      "golazo",
      "trivela",
    ]);
    expect(saved?.turns.map((t) => t.points)).toEqual([
      100, 0, 0, 0, 10, 80, 60,
    ]);
    expect(saved?.turns.map((t) => t.share)).toEqual([
      30,
      null,
      null,
      0.2,
      5,
      10,
      4,
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
        total: 250,
        tierName: text.tiers.nonleague,
        title: text.titles.home.piequeue,
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

    // AWAY ("Play AWAY" to a screen reader) starts the other mode, from its first question.
    fireEvent.click(
      screen.getByRole("button", {
        name: text.fullTime.otherSpoken(text.fullTime.other.away),
      }),
    );
    expect(
      screen.getByRole("heading", { level: 1, name: text.heading.away }),
    ).toBeInTheDocument();
    // Its mode card first, then its first question.
    expect(modeCard()).toHaveAttribute("data-mode", "away");
    expect(modeCard()).toHaveTextContent(text.intro.line.away);
    expect(screen.queryByRole("textbox")).toBeNull();
    pastCard();
    expect(modeCard()).toBeNull();
    expect(questionLamps()).toBe("Question 1 of 7");
    expect(screen.getByText(text.board.instruction.away)).toBeVisible();
    expect(screen.getByText(text.board.measure.away)).toBeInTheDocument();
  });

  test("a new game starts with the mode card: no board, no clock, the scene waiting on ink; then question 1", () => {
    site(undefined, { card: true });
    const card = modeCard();
    expect(card).toHaveAttribute("data-mode", "home");
    expect(card).toHaveTextContent(strings.home.modes.home.label);
    expect(card).toHaveTextContent(text.intro.line.home);
    // The words that tell the mode from the others are picked out.
    expect(card?.querySelector(".ss-intro__key")).toHaveTextContent(
      text.intro.key.home,
    );
    // It is only looked at; the page reads its words out.
    expect(card).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText(text.intro.spoken.home)).toHaveAttribute(
      "role",
      "status",
    );
    // Nothing of the game yet: no board, no field, nothing kept, the scene held on ink.
    expect(document.querySelector(".ss-board")).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(window.localStorage.getItem(liveKey(DAY_KEY, "home"))).toBeNull();
    expect(holds).toHaveBeenCalledTimes(1);
    expect(opens).not.toHaveBeenCalled();

    // It stays up for INTRO_MS, then takes INTRO_LEAVE_MS to go.
    wait(INTRO_MS - 1);
    expect(modeCard()).not.toHaveAttribute("data-leaving");
    wait(1);
    expect(modeCard()).toHaveAttribute("data-leaving");
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(opens).not.toHaveBeenCalled();
    wait(INTRO_LEAVE_MS);

    // Gone: the scene opens, and question 1 is asked with the whole of its clock.
    expect(modeCard()).toBeNull();
    expect(opens).toHaveBeenCalledTimes(1);
    expect(questionLamps()).toBe("Question 1 of 7");
    expect(screen.getByLabelText(text.board.timeLeft(30))).toBeInTheDocument();
    expect(document.activeElement).toBe(field());
    expect(screen.queryByText(text.intro.spoken.home)).toBeNull();
    const live = window.localStorage.getItem(liveKey(DAY_KEY, "home"));
    expect(JSON.parse(live ?? "{}")).toMatchObject({
      phase: "asking",
      index: 0,
      startedAt: Date.now(),
      deadline: Date.now() + 30_000,
    });
    wait(3000);
    expect(screen.getByLabelText(text.board.timeLeft(27))).toBeInTheDocument();
  });

  test("a press anywhere sends the mode card off at once, and so do Enter, Space and Escape", () => {
    site(undefined, { card: true });
    wait(300);
    fireEvent.pointerDown(document.body);
    expect(modeCard()).toHaveAttribute("data-leaving");
    // A second press changes nothing: it goes once.
    fireEvent.pointerDown(document.body);
    wait(INTRO_LEAVE_MS - 1);
    expect(modeCard()).not.toBeNull();
    wait(1);
    expect(modeCard()).toBeNull();
    expect(opens).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText(text.board.timeLeft(30))).toBeInTheDocument();
    // The card's own time is not waited for as well: the clock is question 1's alone.
    wait(INTRO_MS);
    expect(opens).toHaveBeenCalledTimes(1);
    expect(questionLamps()).toBe("Question 1 of 7");

    for (const key of ["Enter", " ", "Escape"]) {
      cleanup();
      window.localStorage.clear();
      site(undefined, { card: true });
      fireEvent.keyDown(window, { key });
      expect(modeCard()).toHaveAttribute("data-leaving");
    }
  });

  test("the mode card stays for a letter typed ahead, a key still held down and a right click", () => {
    site(undefined, { card: true });
    fireEvent.keyDown(window, { key: "a" });
    // Enter held down from PLAY AWAY on the card before: not a press on this page.
    fireEvent.keyDown(window, { key: "Enter", repeat: true });
    fireEvent.pointerDown(document.body, { pointerType: "mouse", button: 2 });
    expect(modeCard()).not.toHaveAttribute("data-leaving");
  });

  test("the mode card is for a new game only: a reload under it starts again, a game carried on has none", () => {
    site(undefined, { card: true });
    wait(1000);
    // Reloaded while the card is up: nothing was kept, so the same new game, card and all.
    cleanup();
    site(undefined, { card: true });
    expect(modeCard()).not.toBeNull();
    wait(INTRO_MS + INTRO_LEAVE_MS);
    expect(questionLamps()).toBe("Question 1 of 7");

    // Reloaded 5 seconds into question 1: straight back in, the clock not given back.
    wait(5000);
    cleanup();
    holds.mockClear();
    site(undefined, { card: true });
    expect(modeCard()).toBeNull();
    expect(holds).not.toHaveBeenCalled();
    expect(screen.getByLabelText(text.board.timeLeft(25))).toBeInTheDocument();

    // And a finished game shows its full-time card, not the mode's.
    cleanup();
    window.localStorage.clear();
    window.localStorage.setItem(
      `soccersense:v1:${DAY_KEY}:home`,
      JSON.stringify(finished()),
    );
    site(undefined, { card: true });
    expect(modeCard()).toBeNull();
    expect(
      screen.getByRole("heading", { name: text.fullTime.heading }),
    ).toBeInTheDocument();
  });

  test("leaving the page while the mode card is up starts nothing", () => {
    site(undefined, { card: true });
    cleanup();
    wait(INTRO_MS + INTRO_LEAVE_MS + 60_000);
    expect(opens).not.toHaveBeenCalled();
    expect(shots).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(liveKey(DAY_KEY, "home"))).toBeNull();
  });

  test("a whole AWAY game: the most uncommon answer wins, and every shot is played", () => {
    site({ pathname: "/play/away", search: "?day=1" });
    expect(screen.getByText(text.board.instruction.away)).toBeVisible();

    // The fewest players said Chile: a worldie, and the reveal cheers the deep cut.
    answer("Chile");
    expect(shots).toHaveBeenLastCalledWith("worldie", expect.any(Function));
    play(2.5);
    expect(
      screen.getByRole("heading", { name: text.grades.worldie }),
    ).toBeInTheDocument();
    expect(screen.getByText("+100")).toBeInTheDocument();
    expect(
      screen.getByText(text.sentence.away.worldie("Chile", lonely("0.9%"))),
    ).toBeInTheDocument();
    // A country answer has no line under its name: it would only repeat itself.
    expect(tableRow(/^Chile/)).toHaveTextContent("0.9%");
    // AWAY's table runs the other way: Chile, the rarest, on top and the player's; Brazil,
    // the most common, is a miss and not shown.
    const rows = [...document.querySelectorAll(".ss-table tbody tr")];
    expect(rows[0]).toHaveTextContent("Chile");
    expect(rows[0]).toHaveClass("is-you");
    expect(rowShots()).toEqual(FIVE_SHOTS);
    expect(screen.queryByRole("rowheader", { name: /^Brazil/ })).toBeNull();
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

    // One answer of each shot, best to worst.
    const played: [string, string, string, string, string][] = [
      ["Capello", "Fabio Capello", "golazo", "+80", "1%"],
      ["Racing Club", "Racing Club", "trivela", "+60", "1.5%"],
      ["Schillaci", "Salvatore Schillaci", "toepoke", "+30", "2.1%"],
      ["Ghana", "Ghana", "tapin", "+10", "9%"],
    ];
    for (const [typed, name, grade, gained, share] of played) {
      answer(typed);
      expect(shots).toHaveBeenLastCalledWith(grade, expect.any(Function));
      play(2.5);
      const shot = grade as "golazo" | "trivela" | "toepoke" | "tapin";
      expect(
        screen.getByRole("heading", { name: text.grades[shot] }),
      ).toBeInTheDocument();
      expect(screen.getByText(gained)).toBeInTheDocument();
      const said = parseFloat(share) < 2 ? lonely(share) : crowd(share);
      expect(
        screen.getByText(text.sentence.away[shot](name, said)),
      ).toBeInTheDocument();
      expect(tableRow(new RegExp(name))).toHaveTextContent(text.shots[shot]);
      expect(tableRow(new RegExp(name))).toHaveClass("is-you");
      expect(rowShots()).toEqual(FIVE_SHOTS);
      expect(yours()).toBeNull();
      next();
      play(1.6);
    }

    // The most common answer is the worst one AWAY: a miss.
    answer("Sevilla");
    expect(shots).toHaveBeenLastCalledWith("miss", expect.any(Function));
    play(2.5);
    expect(
      screen.getByRole("heading", { name: text.grades.miss }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(text.sentence.away.miss("Sevilla", crowd("16%"))),
    ).toBeInTheDocument();
    expect(document.querySelector(".ss-sheet__points")).toBeNull();
    expect(rowShots()).toEqual(FIVE_SHOTS);
    expect(yours()).toHaveTextContent("Sevilla");
    expect(yours()).toHaveTextContent("16%");
    next();

    // 100 + 0 + 80 + 60 + 30 + 10 + 0.
    expect(
      screen.getByRole("img", { name: text.fullTime.totalSpoken(280, 700) }),
    ).toBeInTheDocument();
    expect(screen.getByText(text.tiers.lower)).toBeInTheDocument();
    expect(document.querySelector(".ss-full__title")).toHaveTextContent(
      text.titles.away.retroshirt,
    );
    expect(loadGame(DAY_KEY, "away")?.turns.map((t) => t.grade)).toEqual([
      "worldie",
      "skipped",
      "golazo",
      "trivela",
      "toepoke",
      "tapin",
      "miss",
    ]);
    expect(
      [...document.querySelectorAll(".ss-pip")].map((pip) =>
        pip.getAttribute("data-grade"),
      ),
    ).toEqual([
      "worldie",
      "skipped",
      "golazo",
      "trivela",
      "toepoke",
      "tapin",
      "miss",
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

  test("an answer typed but not sent when the clock runs out counts as sent", () => {
    site();
    // Question 1: typed, Enter never pressed.
    fireEvent.change(field(), { target: { value: "Man United" } });
    wait(30_000);
    expect(shots).toHaveBeenLastCalledWith("worldie", expect.any(Function));
    play(2.5);
    expect(
      screen.getByRole("heading", { name: text.grades.worldie }),
    ).toBeInTheDocument();
    expect(screen.getByText("+100")).toBeInTheDocument();
    next();
    wait(PROMOTION_PATIENCE_MS);

    // Question 2: what is left typed is one the judge does not know: a time-up.
    expect(questionLamps()).toBe("Question 2 of 7");
    fireEvent.change(field(), { target: { value: "Bob" } });
    wait(30_000);
    expect(shots).toHaveBeenLastCalledWith("timeup", expect.any(Function));
    play(2.5);
    next();

    // Question 3: what was typed on question 2 is not carried over.
    expect(questionLamps()).toBe("Question 3 of 7");
    expect(field()).toHaveValue("");
    wait(30_000);
    expect(shots).toHaveBeenLastCalledWith("timeup", expect.any(Function));
  });

  test("a mode is played once a day: its finished game shows its card again, however the page is reached", () => {
    window.localStorage.setItem(
      `soccersense:v1:${DAY_KEY}:home`,
      JSON.stringify(finished()),
    );
    // A reload at full time.
    site({
      pathname: "/play/home",
      search: "?day=1",
      state: { fullTime: DAY_KEY },
    });
    expect(
      screen.getByRole("heading", { name: text.fullTime.heading }),
    ).toBeInTheDocument();
    cleanup();

    // The way in from the menu, or the address typed: still no new game today.
    site();
    expect(
      screen.getByRole("heading", { name: text.fullTime.heading }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
    cleanup();

    // Another day is another game.
    site({ pathname: "/play/home", search: "?day=2" });
    expect(questionLamps()).toBe("Question 1 of 7");
  });

  test("the day is the site's server's: a phone set a day on still opens today's game", () => {
    window.localStorage.setItem(
      `soccersense:v1:${DAY_KEY}:home`,
      JSON.stringify(finished()),
    );
    // The phone says tomorrow; the server says today, day 1, played.
    vi.setSystemTime(new Date("2026-11-11T12:00:00Z"));
    setGameClock(deviceClock(() => Date.UTC(2026, 10, 10, 12)));
    site({ pathname: "/play/home", search: "" });
    expect(
      screen.getByRole("heading", { name: text.fullTime.heading }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  test("no game until the server has said what day it is, and a line while it cannot", () => {
    let now: number | null = null;
    let status: ClockStatus = "checking";
    const listeners = new Set<() => void>();
    const tell = () => listeners.forEach((listener) => listener());
    setGameClock({
      now: () => now,
      status: () => status,
      subscribe: (listener) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
      check: () => {},
    });
    site();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByText(text.clock.failing)).toBeNull();

    act(() => {
      status = "failing";
      tell();
    });
    expect(screen.getByText(text.clock.failing)).toHaveAttribute(
      "role",
      "status",
    );
    expect(screen.queryByRole("textbox")).toBeNull();

    act(() => {
      status = "ready";
      now = Date.now();
      tell();
    });
    // The day is known: a new game, so its mode card first.
    expect(modeCard()).not.toBeNull();
    pastCard();
    expect(questionLamps()).toBe("Question 1 of 7");
    expect(screen.queryByText(text.clock.failing)).toBeNull();
  });

  test("?day= is for development: a production build plays today's game", () => {
    window.localStorage.setItem(
      `soccersense:v1:${DAY_KEY}:home`,
      JSON.stringify(finished()),
    );
    vi.stubEnv("DEV", false);
    try {
      site({ pathname: "/play/home", search: "?day=2&notimer=1" });
      expect(
        screen.getByRole("heading", { name: text.fullTime.heading }),
      ).toBeInTheDocument();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  test("full time offers the next mode not played today, and none once all four are", () => {
    const game = JSON.stringify(finished());
    const save = (mode: string): void =>
      window.localStorage.setItem(`soccersense:v1:${DAY_KEY}:${mode}`, game);
    const offered = (): (string | null)[] =>
      (["home", "away", "retro", "nextgen"] as const).map((mode) => {
        const name = text.fullTime.otherSpoken(text.fullTime.other[mode]);
        return screen.queryByRole("button", { name }) ? mode : null;
      });
    const full = { pathname: "/play/home", search: "?day=1" };

    // HOME and AWAY played: on past AWAY to RETRO
    save("home");
    save("away");
    site(full);
    expect(offered()).toEqual([null, null, "retro", null]);
    cleanup();

    // and past RETRO and NEXT-GEN too: none left, SHARE and MENU only
    save("retro");
    save("nextgen");
    site(full);
    expect(offered()).toEqual([null, null, null, null]);
    expect(
      screen.getByRole("button", { name: text.fullTime.share }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: text.fullTime.menu }),
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
