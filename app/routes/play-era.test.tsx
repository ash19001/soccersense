// The era pages, /play/retro and /play/next-gen: a whole RETRO game with fake timers (every
// kind of result, the year column, full time, share, the other mode), NEXT-GEN's reveal,
// and both pages at build time.

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

import { buildShareText, loadGame, playPath } from "~/game";
import { strings } from "~/i18n";
import { CareerScene } from "~/scenes/career";
import { resetArrivalFocus } from "~/ui/useArrivalFocus";
import Play, { meta } from "./play";

const text = strings.play;
const DAY_KEY = "2026-11-10";

function Menu() {
  return <h1>{strings.siteName}</h1>;
}

function site(pathname: string, search = "?day=1") {
  window.history.replaceState(null, "", `${pathname}${search}`);
  const Stub = createRoutesStub([
    { path: "/", Component: Menu },
    { path: "/play/retro", Component: Play },
    { path: "/play/next-gen", Component: Play },
    { path: "/play/nextgen", Component: Play },
  ]);
  return render(<Stub initialEntries={[{ pathname, search }]} />);
}

let shots: MockInstance<CareerScene["playShot"]>;
let promotions: MockInstance<CareerScene["promote"]>;

function scene(): CareerScene {
  const all = [
    ...shots.mock.contexts,
    ...promotions.mock.contexts,
  ] as CareerScene[];
  const last = all.at(-1);
  if (!last) throw new Error("no scene has played anything yet");
  return last;
}

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

function answer(typed: string): void {
  const input = screen.getByRole("textbox", { name: text.answer.input });
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

function tableRow(name: RegExp): HTMLElement {
  return screen.getByRole("rowheader", { name }).parentElement as HTMLElement;
}

/** The reveal's rows: [shot, name, the third column], top to bottom. */
function rows(): [string | null, string, string][] {
  return [...document.querySelectorAll(".ss-table tbody tr")].map((row) => [
    row.getAttribute("data-grade"),
    row.querySelector(".ss-table__name")?.textContent ?? "",
    row.querySelector(".ss-table__num")?.textContent ?? "",
  ]);
}

function yours(): HTMLElement | null {
  return document.querySelector(".ss-sheet__yours");
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

describe("the era pages", () => {
  test.each([
    ["/play/retro", "retro"],
    ["/play/next-gen", "nextgen"],
  ] as const)(
    "%s renders at build time, with its own title and description",
    (path, mode) => {
      vi.stubGlobal("window", undefined);
      vi.stubGlobal("document", undefined);
      vi.stubGlobal("localStorage", undefined);
      vi.stubGlobal("navigator", undefined);
      let html: string;
      try {
        html = renderToString(
          <MemoryRouter initialEntries={[path]}>
            <Play />
          </MemoryRouter>,
        );
      } finally {
        vi.unstubAllGlobals();
      }
      expect(html).toContain(text.heading[mode]);
      expect(html).toContain("ss-game");
      const tags =
        meta({ location: { pathname: path } } as Parameters<typeof meta>[0]) ??
        [];
      expect(tags).toContainEqual({ title: text.title[mode] });
      expect(tags).toContainEqual({
        name: "description",
        content: text.description[mode],
      });
      expect(playPath(mode)).toBe(path);
    },
  );

  test("a whole RETRO game: the oldest answer wins, every kind of result, the year in the share's place", async () => {
    site("/play/retro");
    const board = document.querySelector(".ss-board");
    expect(board).toHaveAttribute("data-mode", "retro");
    expect(board?.querySelector(".ss-badge")).toHaveTextContent("RETRO");
    expect(screen.getByText(text.board.instruction.retro)).toBeVisible();
    expect(screen.getByText(text.board.measure.retro)).toBeInTheDocument();

    // The first champions of England: a worldie, and the column says when they first did it.
    answer("Preston");
    expect(shots).toHaveBeenLastCalledWith("worldie", expect.any(Function));
    play(2.5);
    expect(
      screen.getByRole("heading", { name: text.grades.worldie }),
    ).toBeInTheDocument();
    expect(screen.getByText("+100")).toBeInTheDocument();
    expect(
      screen.getByText(
        text.sentence.retro.worldie("Preston North End", "1889"),
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: text.table.year.retro }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("columnheader", { name: text.table.distance }),
    ).toBeNull();
    expect(document.querySelector(".ss-sheet")).toHaveAttribute(
      "data-mode",
      "retro",
    );
    // One answer for each shot that scores, each the oldest of its shot; no shares.
    expect(rows()).toEqual([
      ["worldie", "Preston North End", "1889"],
      ["golazo", "Sheffield United", "1898"],
      ["trivela", "Blackburn Rovers", "1912"],
      ["toepoke", "Arsenal", "1931"],
      ["tapin", "Tottenham Hotspur", "1951"],
    ]);
    expect(tableRow(/^Preston North End/)).toHaveClass("is-you");
    expect(document.querySelector(".ss-sheet")?.textContent).not.toMatch(/%/);
    next();
    play(1.6);

    // A pass: the sentence names the oldest answer and its year.
    wait(8000);
    fireEvent.click(screen.getByRole("button", { name: text.answer.pass }));
    play(2.5);
    expect(
      screen.getByText(text.sentence.skipped.retro("Genoa", "1898")),
    ).toBeInTheDocument();
    expect(yours()).toHaveTextContent(text.yours.none);
    next();
    play(1.6);

    // A club with many cups counts its first: the player's answer takes its shot's row.
    const played: [string, string, string, string, string][] = [
      ["Blackburn Rovers", "Blackburn Rovers", "golazo", "+80", "1884"],
      ["Germany", "Germany", "trivela", "+60", "1988"],
      ["France", "France", "toepoke", "+30", "1984"],
      ["Beckenbauer", "Franz Beckenbauer", "tapin", "+10", "1990"],
    ];
    for (const [typed, name, grade, gained, year] of played) {
      answer(typed);
      expect(shots).toHaveBeenLastCalledWith(grade, expect.any(Function));
      play(2.5);
      const shot = grade as "golazo" | "trivela" | "toepoke" | "tapin";
      expect(screen.getByText(gained)).toBeInTheDocument();
      expect(
        screen.getByText(text.sentence.retro[shot](name, year)),
      ).toBeInTheDocument();
      const row = tableRow(new RegExp(`^${name}`));
      expect(row).toHaveClass("is-you");
      expect(row).toHaveTextContent(year);
      expect(row).toHaveAttribute("data-grade", shot);
      expect(rows().map((r) => r[0])).toEqual([
        "worldie",
        "golazo",
        "trivela",
        "toepoke",
        "tapin",
      ]);
      expect(yours()).toBeNull();
      next();
      play(1.6);
    }

    // A recent winner is a right answer but a miss: the year stands on the player's line.
    answer("Brazil");
    expect(shots).toHaveBeenLastCalledWith("miss", expect.any(Function));
    play(2.5);
    expect(
      screen.getByText(text.sentence.retro.miss("Brazil", "2016")),
    ).toBeInTheDocument();
    expect(yours()).toHaveTextContent("Brazil");
    expect(yours()).toHaveTextContent("2016");
    expect(yours()).toHaveTextContent(text.shots.miss);
    expect(
      screen.getByText(
        text.yours.spokenYear.retro("Brazil", "2016", text.shots.miss, 0),
      ),
    ).toBeInTheDocument();
    next();

    // Full time: 100 + 0 + 80 + 60 + 30 + 10 + 0, the RETRO title on the RETRO card.
    expect(
      screen.getByRole("img", { name: text.fullTime.totalSpoken(280, 700) }),
    ).toBeInTheDocument();
    expect(document.querySelector(".ss-full")).toHaveAttribute(
      "data-mode",
      "retro",
    );
    expect(document.querySelector(".ss-full__title")).toHaveTextContent(
      text.titles.retro.leather,
    );
    const saved = loadGame(DAY_KEY, "retro");
    expect(saved?.total).toBe(280);
    expect(saved?.turns.map((t) => t.grade)).toEqual([
      "worldie",
      "skipped",
      "golazo",
      "trivela",
      "toepoke",
      "tapin",
      "miss",
    ]);

    // SHARE: the summary, under RETRO's own name.
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
        mode: "retro",
        modeLabel: "RETRO",
        stadiumName: "Anfield",
        total: 280,
        tierName: text.tiers.lower,
        title: text.titles.retro.leather,
        grades: saved?.turns.map((t) => t.grade) ?? [],
      }),
    );

    // The other mode of the pair is NEXT-GEN, at its own address.
    fireEvent.click(
      screen.getByRole("button", {
        name: text.fullTime.otherSpoken(text.fullTime.other.nextgen),
      }),
    );
    expect(
      screen.getByRole("heading", { level: 1, name: text.heading.nextgen }),
    ).toBeInTheDocument();
    expect(screen.getByText(text.board.instruction.nextgen)).toBeVisible();
    expect(document.querySelector(".ss-board")).toHaveAttribute(
      "data-mode",
      "nextgen",
    );
  });

  test("NEXT-GEN: the most recent answer wins, the column says when it last happened, and a time-up names the newest", () => {
    site("/play/next-gen");
    expect(screen.getByText(text.board.instruction.nextgen)).toBeVisible();
    expect(screen.getByText(text.board.measure.nextgen)).toBeInTheDocument();
    expect(document.querySelector(".ss-badge")).toHaveTextContent("NEXT-GEN");

    // Werder Bremen: four titles, counted by the latest (2004).
    answer("Werder Bremen");
    expect(shots).toHaveBeenLastCalledWith("trivela", expect.any(Function));
    play(2.5);
    expect(
      screen.getByText(text.sentence.nextgen.trivela("Werder Bremen", "2004")),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: text.table.year.nextgen }),
    ).toBeInTheDocument();
    expect(rows()).toEqual([
      ["worldie", "Bayern Munich", "2026"],
      ["golazo", "Borussia Dortmund", "2012"],
      ["trivela", "Werder Bremen", "2004"],
      ["toepoke", "1. FC Kaiserslautern", "1998"],
      ["tapin", "Hamburg", "1983"],
    ]);
    next();
    play(1.6);

    // The clock runs out: the sentence names the most recent champion.
    wait(30_000);
    play(2.5);
    expect(
      screen.getByText(
        text.sentence.timeup.nextgen("Paris Saint-Germain", "2026"),
      ),
    ).toBeInTheDocument();
  });

  test("NEXT-GEN's own id as an address plays NEXT-GEN too", () => {
    site("/play/nextgen");
    expect(
      screen.getByRole("heading", { level: 1, name: text.heading.nextgen }),
    ).toBeInTheDocument();
  });
});
