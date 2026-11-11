import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, test, vi } from "vitest";

import {
  AnswerBar,
  Board,
  FullTimeCard,
  GameLayout,
  IconButton,
  LeagueTable,
  type LeagueEntry,
  LedNumber,
  MenuCaptions,
  PixelGlyph,
  RevealSheet,
  TierBar,
  TimerStrip,
  bitmapPath,
} from "./index";

/** The skin's stylesheet, as written (the test environment does not load CSS). */
const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "ui.css"),
  "utf8",
);
/** The page's own stylesheet, which loads the skin and sets the body and the focus ring. */
const appCss = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "..", "app.css"),
  "utf8",
);

const answerLabels = { input: "Your answer", shoot: "SHOOT", pass: "PASS" };
const tableLabels = {
  caption: "The table",
  rank: "#",
  answer: "ANSWER",
  distance: "DIST",
  points: "PTS",
  you: "YOU",
  gap: "Rows left out",
};

describe("Board", () => {
  const base = {
    mode: "home" as const,
    stadiumName: "ANFIELD",
    questionNumber: 3,
    questionCount: 7,
    results: ["goal" as const, "topbins" as const],
    total: 152,
    tierName: "SUNDAY LEAGUE",
    tierProgress: 0.69,
    question: "Name a club that has won the European Cup",
    instruction: "Closest to ANFIELD wins.",
    measureLine: "Measured by the home ground of the club.",
    secondsLeft: 22,
    secondsTotal: 30,
    labels: {
      mode: "HOME",
      questionOf: "Question 3 of 7",
      points: "PTS",
      timeLeft: "22 seconds left",
      board: "Scoreboard",
    },
  };

  test("shows the question, the instruction lines and the clock", () => {
    render(<Board {...base} />);
    const board = screen.getByRole("region", { name: "Scoreboard" });
    expect(board).toHaveAttribute("data-mode", "home");
    expect(
      within(board).getByRole("heading", { name: base.question }),
    ).toBeInTheDocument();
    expect(within(board).getByText(base.instruction)).toBeInTheDocument();
    expect(within(board).getByText(base.measureLine)).toBeInTheDocument();
    expect(
      within(board).getByRole("timer", { name: "22 seconds left" }),
    ).toBeInTheDocument();
    expect(
      within(board).getByRole("img", { name: "Question 3 of 7" }).children,
    ).toHaveLength(7);
  });

  test("compact keeps the question and the instruction, and drops the measure line and the clock", () => {
    render(<Board {...base} compact />);
    const board = screen.getByRole("region", { name: "Scoreboard" });
    expect(board).toHaveClass("ss-board--compact");
    expect(screen.getByText(base.question)).toBeInTheDocument();
    // What wins is still worth knowing while the table is on screen.
    expect(screen.getByText(base.instruction)).toBeInTheDocument();
    expect(screen.queryByText(base.measureLine)).not.toBeInTheDocument();
    expect(screen.queryByRole("timer")).not.toBeInTheDocument();
    // No lamp blinks once the answer is in.
    expect(board.querySelector('.ss-pip[data-state="current"]')).toBeNull();
  });

  test("the total is a three-digit display named by its points", () => {
    render(<Board {...base} total={7} />);
    expect(screen.getByRole("img", { name: "7 PTS" })).toBeInTheDocument();
  });
});

describe("TierBar", () => {
  test("is a progress bar that shows the whole name on the track and on the fill", () => {
    const { container, rerender } = render(
      <TierBar name="NON-LEAGUE" progress={0.37} />,
    );
    const bar = screen.getByRole("progressbar", { name: "NON-LEAGUE" });
    expect(bar).toHaveAttribute("aria-valuenow", "37");
    // Gold on the track and ink on the fill, so no letter is lost at the edge of the fill.
    const names = container.querySelectorAll(".ss-tier__name");
    expect(names).toHaveLength(2);
    expect(names[0]).toHaveTextContent("NON-LEAGUE");
    expect(names[1]).toHaveTextContent("NON-LEAGUE");
    expect(names[1]?.parentElement).toHaveClass("ss-tier__fill", "is-started");
    expect(
      (names[1]?.parentElement as HTMLElement).style.getPropertyValue("--p"),
    ).toBe("0.3700");

    rerender(<TierBar name="NON-LEAGUE" progress={7} />);
    expect(bar).toHaveAttribute("aria-valuenow", "100");
    rerender(<TierBar name="NON-LEAGUE" progress={Number.NaN} />);
    expect(bar).toHaveAttribute("aria-valuenow", "0");
    expect(container.querySelector(".ss-tier__fill")).not.toHaveClass(
      "is-started",
    );
  });
});

describe("LeagueTable", () => {
  const rows: LeagueEntry[] = [
    {
      rank: 1,
      name: "Liverpool",
      place: "Anfield, Liverpool",
      distance: "0 miles",
      points: 100,
    },
    { gap: true },
    {
      rank: 10,
      name: "Borussia Dortmund",
      place: "Westfalenstadion, Dortmund",
      distance: "487 miles",
      points: 61,
      you: true,
    },
    {
      rank: 23,
      name: "Steaua",
      place: "Bucharest",
      distance: "1,412 km",
      points: 0,
    },
  ];

  test("pins the first row, marks the best and the player's rows, and splits the distance", () => {
    render(<LeagueTable rows={rows} labels={tableLabels} />);
    const table = screen.getByRole("table", { name: "The table" });
    const body = within(table).getAllByRole("row").slice(1);
    expect(body).toHaveLength(4);
    expect(body[0]).toHaveClass("is-pinned", "is-best");
    expect(body[1]).toHaveClass("ss-table__gap");
    expect(body[2]).toHaveClass("is-you");
    expect(body[2]).not.toHaveClass("is-pinned");
    expect(within(body[2] as HTMLElement).getByText("YOU")).toBeInTheDocument();
    expect(within(body[3] as HTMLElement).getByText("1,412")).toHaveClass(
      "ss-table__num",
    );
    expect(within(body[3] as HTMLElement).getByText("km")).toHaveClass(
      "ss-table__unit",
    );
    // The scrolling box can take keyboard focus.
    expect(screen.getByRole("group", { name: "The table" })).toHaveAttribute(
      "tabindex",
      "0",
    );
  });

  test("pinFirst={false} leaves every row free to scroll", () => {
    const { container } = render(
      <LeagueTable rows={rows} labels={tableLabels} pinFirst={false} />,
    );
    expect(container.querySelector(".is-pinned")).toBeNull();
  });

  test("a gap in first place is never pinned", () => {
    const { container } = render(
      <LeagueTable rows={[{ gap: true }, ...rows]} labels={tableLabels} />,
    );
    expect(container.querySelector(".is-pinned")).toBeNull();
  });
});

describe("TimerStrip", () => {
  test("lights one segment per second left and turns red for the last five", () => {
    const { container, rerender } = render(
      <TimerStrip secondsLeft={17.2} secondsTotal={30} />,
    );
    expect(container.querySelectorAll(".ss-timer__seg")).toHaveLength(30);
    expect(container.querySelectorAll(".ss-timer__seg.is-on")).toHaveLength(18);
    expect(container.querySelector(".ss-timer--danger")).toBeNull();
    rerender(<TimerStrip secondsLeft={5} secondsTotal={30} />);
    expect(container.querySelectorAll(".ss-timer__seg.is-on")).toHaveLength(5);
    expect(container.querySelector(".ss-timer--danger")).not.toBeNull();
  });
});

describe("AnswerBar", () => {
  test("Enter and SHOOT submit the value; PASS appears only when allowed", () => {
    const onSubmit = vi.fn();
    const onPass = vi.fn();
    const { rerender } = render(
      <AnswerBar
        mode="away"
        value="Chris Wood"
        onChange={() => {}}
        onSubmit={onSubmit}
        onPass={onPass}
        labels={answerLabels}
      />,
    );
    const field = screen.getByLabelText("Your answer");
    expect(field).toHaveValue("Chris Wood");
    fireEvent.submit(field);
    fireEvent.click(screen.getByRole("button", { name: "SHOOT" }));
    expect(onSubmit).toHaveBeenCalledTimes(2);
    expect(onSubmit).toHaveBeenLastCalledWith("Chris Wood");
    expect(screen.queryByRole("button", { name: "PASS" })).toBeNull();

    rerender(
      <AnswerBar
        mode="away"
        value="Chris Wood"
        onChange={() => {}}
        onSubmit={onSubmit}
        onPass={onPass}
        canPass
        rejection="Not on the teamsheet. Try another."
        labels={answerLabels}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "PASS" }));
    expect(onPass).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Not on the teamsheet. Try another.",
    );
    expect(field).toHaveAttribute("aria-invalid", "true");
  });

  test("typing reports the new value, and nothing is submitted while busy", () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn();
    const { rerender } = render(
      <AnswerBar
        mode="home"
        value=""
        onChange={onChange}
        onSubmit={onSubmit}
        labels={answerLabels}
      />,
    );
    const field = screen.getByLabelText("Your answer");
    fireEvent.change(field, { target: { value: "Trent" } });
    expect(onChange).toHaveBeenCalledWith("Trent");
    rerender(
      <AnswerBar
        mode="home"
        value="Trent"
        onChange={onChange}
        onSubmit={onSubmit}
        busy
        labels={answerLabels}
      />,
    );
    fireEvent.submit(field);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "SHOOT" })).toBeDisabled();
  });
});

describe("RevealSheet", () => {
  test("shows the grade, the table with the YOU row, and the next button", () => {
    const onNext = vi.fn();
    render(
      <RevealSheet
        grade="goal"
        mode="home"
        gradeLabel="GOAL!"
        pointsLabel="+61"
        sentence="Hakan Çalhanoğlu was born in Mannheim: 540 miles from Anfield."
        rows={[
          {
            rank: 1,
            name: "Liverpool",
            place: "Anfield, Liverpool",
            distance: "0 miles",
            points: 100,
          },
          { gap: true },
          {
            rank: 10,
            name: "Hakan Çalhanoğlu",
            place: "Mannheim",
            distance: "540 miles",
            points: 61,
            you: true,
          },
        ]}
        tableLabels={tableLabels}
        nextLabel="NEXT QUESTION"
        onNext={onNext}
      />,
    );
    expect(screen.getByRole("heading", { name: "GOAL!" })).toBeInTheDocument();
    expect(screen.getByText("+61")).toBeInTheDocument();
    const table = screen.getByRole("table", { name: "The table" });
    const you = within(table).getByRole("row", { name: /Hakan Çalhanoğlu/ });
    expect(you).toHaveClass("is-you");
    expect(within(you).getByText("YOU")).toBeInTheDocument();
    expect(within(table).getByRole("row", { name: /Liverpool/ })).toHaveClass(
      "is-best",
    );
    expect(within(table).getByText("Rows left out")).toBeInTheDocument();
    // The summary is announced politely once the sheet is on screen.
    expect(screen.getByRole("status")).toHaveTextContent("GOAL!. +61.");
    const next = screen.getByRole("button", { name: "NEXT QUESTION" });
    expect(next).toHaveFocus();
    fireEvent.click(next);
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});

describe("FullTimeCard", () => {
  test("shows the score, the seven answers and three actions", () => {
    const onShare = vi.fn();
    const onPlayOther = vi.fn();
    const onMenu = vi.fn();
    render(
      <FullTimeCard
        mode="home"
        heading="FULL TIME"
        total={478}
        maxTotal={700}
        totalSpoken="478 out of 700"
        careerTitle="INTERNATIONAL"
        results={Array.from({ length: 7 }, (_, i) => ({
          grade: "goal" as const,
          points: 60 + i,
          answer: `Answer ${i + 1}`,
        }))}
        shareLabel="SHARE"
        onShare={onShare}
        otherLabel="PLAY AWAY"
        otherMode="away"
        onPlayOther={onPlayOther}
        menuLabel="MENU"
        onMenu={onMenu}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "FULL TIME" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "478 out of 700" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(7);
    fireEvent.click(screen.getByRole("button", { name: "SHARE" }));
    fireEvent.click(screen.getByRole("button", { name: "PLAY AWAY" }));
    fireEvent.click(screen.getByRole("button", { name: "MENU" }));
    expect(onShare).toHaveBeenCalledTimes(1);
    expect(onPlayOther).toHaveBeenCalledTimes(1);
    expect(onMenu).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "PLAY AWAY" })).toHaveAttribute(
      "data-mode",
      "away",
    );
  });
});

describe("MenuCaptions", () => {
  test("mode cards are buttons when onSelect is given", () => {
    const onSelect = vi.fn();
    const onHelp = vi.fn();
    render(
      <MenuCaptions
        modes={[
          { mode: "home", label: "HOME", line: "Closest to the stadium wins" },
          { mode: "away", label: "AWAY", line: "Furthest from it wins" },
        ]}
        onSelect={onSelect}
        howToPlay={{ label: "How to play", onClick: onHelp }}
        dayLabel="DAY 12"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /AWAY/ }));
    expect(onSelect).toHaveBeenCalledWith("away");
    fireEvent.click(screen.getByRole("button", { name: "How to play" }));
    expect(onHelp).toHaveBeenCalledTimes(1);
    expect(screen.getByText("DAY 12")).toBeInTheDocument();
  });

  test("a played mode shows its score, and reads it out in words", () => {
    render(
      <MenuCaptions
        modes={[
          {
            mode: "home",
            label: "HOME",
            line: "Closest to the stadium wins",
            score: 478,
            scoreSpoken: "Played today: 478 points",
          },
          { mode: "away", label: "AWAY", line: "Furthest from it wins" },
        ]}
        howToPlay={{ label: "How to play", onClick: () => {} }}
        dayLabel="DAY 12"
      />,
    );
    // Without onSelect the cards are plain captions.
    expect(screen.queryByRole("button", { name: /HOME/ })).toBeNull();
    const score = screen.getByText("478");
    expect(score).toHaveClass("ss-menu__score");
    expect(score).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("Played today: 478 points")).toHaveClass("ss-sr");
    expect(document.querySelectorAll(".ss-menu__score")).toHaveLength(1);
  });

  const twoModes = [
    { mode: "home", label: "HOME", line: "Closest to the stadium wins" },
    { mode: "away", label: "AWAY", line: "Furthest from it wins" },
  ] as const;
  const help = { label: "How to play", to: "/how-to-play" };

  function captions(props: Partial<Parameters<typeof MenuCaptions>[0]> = {}) {
    return (
      <MemoryRouter>
        <MenuCaptions
          modes={twoModes}
          onSelect={() => {}}
          howToPlay={help}
          dayLabel="DAY 12"
          {...props}
        />
      </MemoryRouter>
    );
  }

  test("onHover follows the mouse and the keyboard's focus, and only reports changes", () => {
    const onHover = vi.fn();
    render(captions({ onHover }));
    const home = screen.getByRole("button", { name: /HOME/ });
    const away = screen.getByRole("button", { name: /AWAY/ });

    fireEvent.pointerEnter(home, { pointerType: "mouse" });
    expect(onHover.mock.calls).toEqual([["home"]]);
    // Focus on the same card is no news. Focus on the other one loses to the mouse.
    act(() => home.focus());
    act(() => away.focus());
    expect(onHover.mock.calls).toEqual([["home"]]);
    // The mouse goes: the focused card is what is left.
    fireEvent.pointerLeave(home, { pointerType: "mouse" });
    expect(onHover.mock.calls).toEqual([["home"], ["away"]]);
    act(() => away.blur());
    expect(onHover.mock.calls).toEqual([["home"], ["away"], [null]]);
  });

  test("a finger does not hover", () => {
    const onHover = vi.fn();
    render(captions({ onHover }));
    const home = screen.getByRole("button", { name: /HOME/ });
    fireEvent.pointerEnter(home, { pointerType: "touch" });
    fireEvent.pointerLeave(home, { pointerType: "touch" });
    expect(onHover).not.toHaveBeenCalled();
  });

  test("lit marks one card, as buttons and as plain captions", () => {
    const { rerender } = render(captions({ lit: "away" }));
    expect(screen.getByRole("button", { name: /AWAY/ })).toHaveClass("is-lit");
    expect(screen.getByRole("button", { name: /HOME/ })).not.toHaveClass(
      "is-lit",
    );
    rerender(captions({ lit: "home", onSelect: undefined }));
    expect(document.querySelectorAll(".ss-menu__card.is-lit")).toHaveLength(1);
    expect(document.querySelector(".ss-menu__card.is-lit")).toHaveAttribute(
      "data-mode",
      "home",
    );
    rerender(captions({ lit: null }));
    expect(document.querySelector(".is-lit")).toBeNull();
  });

  test("a notice is a polite status that is always there, and a new key is a new node", () => {
    const { rerender } = render(captions());
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveClass("ss-menu__notice", "is-empty");
    expect(status).toHaveTextContent("");

    rerender(captions({ notice: "More modes soon.", noticeKey: 1 }));
    expect(screen.getByRole("status")).toBe(status);
    expect(status).not.toHaveClass("is-empty");
    const first = screen.getByText("More modes soon.");
    rerender(captions({ notice: "More modes soon.", noticeKey: 2 }));
    expect(screen.getByText("More modes soon.")).not.toBe(first);

    rerender(captions({ notice: null, noticeKey: 2 }));
    expect(status).toHaveClass("is-empty");
    expect(status).toHaveTextContent("");
  });

  test("stowed puts the whole block out of reach and lets go of any hover", () => {
    const onHover = vi.fn();
    const { rerender, container } = render(captions({ onHover }));
    const menu = container.querySelector(".ss-menu");
    expect(menu).not.toHaveClass("is-stowed");
    expect(menu).not.toHaveAttribute("inert");
    fireEvent.pointerEnter(screen.getByRole("button", { name: /HOME/ }), {
      pointerType: "mouse",
    });
    expect(onHover).toHaveBeenLastCalledWith("home");

    rerender(captions({ onHover, stowed: true }));
    expect(menu).toHaveClass("ss-menu", "is-stowed");
    expect(menu).toHaveAttribute("inert");
    expect(onHover).toHaveBeenLastCalledWith(null);
    expect(onHover).toHaveBeenCalledTimes(2);

    // Coming back, nothing is hovered until the pointer says so again.
    rerender(captions({ onHover, stowed: false }));
    expect(menu).not.toHaveAttribute("inert");
    expect(onHover).toHaveBeenCalledTimes(2);
  });

  test("the parts are where both layouts expect them: HOME then AWAY, then the day and the button", () => {
    const { container } = render(
      captions({
        modes: [
          { ...twoModes[0], score: 478, scoreSpoken: "Played today: 478" },
          twoModes[1],
        ],
      }),
    );
    const menu = container.querySelector(".ss-menu") as HTMLElement;
    // The notice first (it floats), then the cards, then what hangs off the row's ends.
    expect([...menu.children].map((el) => el.className)).toEqual([
      "ss-menu__notice is-empty",
      "ss-menu__modes",
      "ss-menu__side",
    ]);
    // The wide row mirrors the two cards by position: first child, last child.
    const cards = [...(menu.children[1] as HTMLElement).children];
    expect(cards.map((el) => el.getAttribute("data-mode"))).toEqual([
      "home",
      "away",
    ]);
    expect(cards.every((el) => el.classList.contains("ss-menu__card"))).toBe(
      true,
    );
    // In a card: the badge and the score together, then the line. The wide row reorders
    // them with `order`, so what is read out stays badge, score, line.
    const [top, line] = [...(cards[0] as HTMLElement).children];
    expect(top).toHaveClass("ss-menu__top");
    expect(top?.firstElementChild).toHaveClass("ss-badge");
    expect(top?.querySelector(".ss-menu__score")).toHaveTextContent("478");
    expect(line).toHaveClass("ss-menu__line");
    // The day is one piece of text, and the button comes after it.
    const side = [...(menu.children[2] as HTMLElement).children];
    expect(side[0]).toHaveClass("ss-menu__day");
    expect(side[0]?.childNodes).toHaveLength(1);
    expect(side[0]).toHaveTextContent("DAY 12");
    expect(side[1]).toHaveClass("ss-btn", "ss-btn--icon");
    expect(side).toHaveLength(2);
  });
});

// The skin is CSS, which this environment does not lay out. These read the stylesheet
// itself, for the two things that must not quietly go: rounding to the device, and the
// monitor layout of the menu captions.
describe("ui.css", () => {
  /** The arguments of every `round(...)` in `text`, split at top-level commas. */
  function rounds(text: string): string[][] {
    const found: string[][] = [];
    let at = text.indexOf("round(");
    while (at !== -1) {
      const args: string[] = [];
      let depth = 0;
      let from = at + 6;
      let end = from;
      for (; end < text.length; end++) {
        const ch = text[end];
        if (ch === "(") depth++;
        else if (ch === ")") {
          if (depth === 0) break;
          depth--;
        } else if (ch === "," && depth === 0) {
          args.push(text.slice(from, end));
          from = end + 1;
        }
      }
      args.push(text.slice(from, end));
      found.push(args.map((arg) => arg.replace(/\s+/g, " ").trim()));
      at = text.indexOf("round(", at + 6);
    }
    return found;
  }

  // Without comments, without the `@supports (width: round(...))` tests, and without the
  // fallback for pages that have no PixelRoot (CSS cannot know the device pixel ratio).
  const rules = css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/@supports \([^{]*\{/g, "@supports {");
  const skin = rules.slice(rules.indexOf("--u: var(--px)"));

  test("nothing is rounded to a bare CSS pixel: the step is the device's", () => {
    const steps = rounds(skin).map((args) => args.at(-1));
    expect(steps.length).toBeGreaterThan(12);
    for (const step of steps) {
      expect(["var(--snap)", "var(--px)", "calc(var(--snap) * 2)"]).toContain(
        step,
      );
    }
  });

  test("what is rounded to the snap is nudged first, so a whole pixel stays whole", () => {
    for (const args of rounds(skin)) {
      if (args.at(-1) === "var(--px)" && !args[1]?.includes("--nudge"))
        continue;
      const [strategy, value] = args;
      expect(["down", "up"]).toContain(strategy);
      expect(value).toContain(
        strategy === "down" ? "+ var(--nudge)" : "- var(--nudge)",
      );
    }
  });

  test("no bare pixel lengths outside the fallback, the touch target and what is hidden", () => {
    const lengths = [...skin.matchAll(/(?<![\w.-])(\d*\.?\d+)px/g)].map(
      (m) => m[0],
    );
    // 44px and 2px are the CSS-pixel sizes the touch target and the focus ring start
    // from, twice each (before and after rounding to the device). 1px and -1px are the
    // boxes that only screen readers see. 0px is nothing at any ratio.
    const allowed = new Set(["44px", "2px", "1px", "0px"]);
    expect(lengths.filter((l) => !allowed.has(l))).toEqual([]);
    expect(lengths.filter((l) => l === "44px")).toHaveLength(2);
    expect(lengths.filter((l) => l === "2px")).toHaveLength(2);
  });

  test("the menu captions have a layout for a wide screen, in caption pixels", () => {
    const wide = skin.slice(skin.indexOf(".ss-game[data-wide] .ss-menu {"));
    expect(wide.length).toBeGreaterThan(100);
    const first = wide.slice(0, wide.indexOf("}"));
    expect(first).toContain("--fp: var(--cp);");
    expect(first).toContain(
      "grid-template-columns: repeat(2, minmax(0, 1fr));",
    );
    // The units that follow the font pixel are worked out again inside the captions.
    expect(rules).toMatch(/:root,\s*\.ss-root,\s*\.ss-menu \{[^}]*--fs-10:/);
    // The row is centred on the same whole pixel as the canvas.
    expect(wide).toContain(
      "right: calc(100% - round(down, calc(50% + var(--nudge)), var(--snap)) * 2);",
    );
  });

  test("the wide row is a whole number of logical pixels tall, so its top edge is on the picture's grid", () => {
    // 13 caption pixels and 8 logical pixels is 58 CSS px on a 1920 x 1080 monitor: 14 and
    // a half logical pixels, which put the row's top edge half way down a pixel of the
    // picture it lies on.
    const wide = skin.slice(skin.indexOf(".ss-game[data-wide] .ss-menu {"));
    const at = wide.search(/--ss-row:\s*round\(/);
    expect(at).toBeGreaterThan(-1);
    const [args] = rounds(wide.slice(at));
    expect(args).toEqual([
      "up",
      "calc( max(var(--tap), calc(var(--fp) * 13 + var(--px) * 8)) - var(--nudge) )",
      "var(--px)",
    ]);
  });

  test("no animation goes on filling after it has ended", () => {
    // `both` or `forwards` keeps the element in a compositing layer of its own for as
    // long as it is on screen, and in such a layer text with no background of its own (the
    // reveal sheet's sentence) is drawn without sub-pixel anti-aliasing.
    const animations = [...rules.matchAll(/animation:\s*([^;]+);/g)].map(
      (m) => m[1],
    );
    expect(animations.length).toBeGreaterThan(4);
    for (const animation of animations) {
      expect(animation).not.toMatch(/\b(both|forwards)\b/);
    }
    expect(rules).toMatch(/animation:\s*ss-rise [^;]*\bbackwards;/);
  });

  test("the page's focus ring is the kit's, in whole device pixels", () => {
    const page = appCss.replace(/\/\*[\s\S]*?\*\//g, "");
    const ring = page.slice(page.indexOf(":focus-visible"));
    expect(ring.slice(0, ring.indexOf("}"))).toContain("outline: var(--ring,");
    // --ring is rounded to the device where the skin declares it.
    expect(skin.replace(/\s+/g, " ")).toContain(
      "--ring: max(round(up, calc(2px - var(--nudge)), var(--snap)), var(--px));",
    );
  });

  test("a heading that takes the focus on arrival shows no ring", () => {
    expect(rules.replace(/\s+/g, " ")).toContain(
      '.ss-root [tabindex="-1"]:focus, .ss-page [tabindex="-1"]:focus { outline: none; }',
    );
  });
});

describe("GameLayout and LedNumber", () => {
  test("GameLayout sets the pixel variables and places the three slots", () => {
    const { container } = render(
      <GameLayout
        canvas={<canvas data-testid="stage" />}
        top={<p>top</p>}
        bottom={<p>bottom</p>}
      >
        <p>middle</p>
      </GameLayout>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveClass("ss-root", "ss-game");
    expect(root.style.getPropertyValue("--px")).toMatch(/^\d+px$/);
    expect(root.style.getPropertyValue("--fp")).toMatch(/^\d+px$/);
    expect(root.style.getPropertyValue("--tx")).toMatch(/^\d+px$/);
    expect(root.style.getPropertyValue("--cp")).toMatch(/^\d+px$/);
    // At a whole device pixel ratio the skin rounds to one CSS pixel, with no nudge.
    expect(root.style.getPropertyValue("--snap")).toBe("1px");
    expect(root.style.getPropertyValue("--nudge")).toBe("0px");
    expect(root).toHaveAttribute("data-orientation");
    expect(screen.getByTestId("stage").parentElement).toHaveClass(
      "ss-game__canvas",
    );
    expect(screen.getByText("top").parentElement).toHaveClass("ss-game__top");
    expect(screen.getByText("bottom").parentElement).toHaveClass(
      "ss-game__bottom",
    );
  });

  describe("on a device", () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    function layoutIn(
      width: number,
      height: number,
      dpr: number,
      contained = false,
    ): HTMLElement {
      vi.stubGlobal("innerWidth", width);
      vi.stubGlobal("innerHeight", height);
      vi.stubGlobal("devicePixelRatio", dpr);
      const { container } = render(<GameLayout contained={contained} />);
      return container.firstElementChild as HTMLElement;
    }

    test("the units are whole device pixels: fractions of a CSS pixel at 125%", () => {
      const root = layoutIn(1536, 864, 1.25);
      expect(root.style.getPropertyValue("--px")).toBe("3.2px");
      expect(root.style.getPropertyValue("--fp")).toBe("0.8px");
      expect(root.style.getPropertyValue("--cp")).toBe("1.6px");
      expect(root.style.getPropertyValue("--snap")).toBe("0.8px");
      expect(root.style.getPropertyValue("--nudge")).toBe("0.0125px");
      expect(root).toHaveAttribute("data-orientation", "landscape");
    });

    test("it is live in a browser and not in the build-time HTML, which is a phone's", () => {
      const root = layoutIn(1920, 1080, 1.25);
      expect(root).toHaveAttribute("data-live");
      cleanup();
      // The same window, rendered the way the build does: no ratio, no width, no promises.
      const html = renderToString(<GameLayout bottom={<p>captions</p>} />);
      expect(html).not.toContain("data-live");
      expect(html).not.toContain("data-wide");
      expect(html).toContain("--px:3px");
      expect(html).toContain("--snap:1px");
      expect(html).toContain('data-orientation="portrait"');
      // The stylesheet holds the menu captions back on a landscape screen until then.
      expect(css).toMatch(
        /@media \(orientation: landscape\) \{\s*\.ss-game:not\(\[data-live\]\) \.ss-menu \{\s*visibility: hidden;/,
      );
    });

    test("a monitor is marked wide, at any display scaling", () => {
      expect(layoutIn(1920, 1080, 1)).toHaveAttribute("data-wide");
      cleanup();
      expect(layoutIn(1366, 768, 1)).toHaveAttribute("data-wide");
      cleanup();
      expect(layoutIn(1280, 720, 1.5)).toHaveAttribute("data-wide");
    });

    test("a phone is not wide, nor a contained layout, nor a window with no room for the row", () => {
      expect(layoutIn(390, 844, 3)).not.toHaveAttribute("data-wide");
      cleanup();
      expect(layoutIn(768, 1024, 2)).not.toHaveAttribute("data-wide");
      cleanup();
      expect(layoutIn(1920, 1080, 1, true)).not.toHaveAttribute("data-wide");
      cleanup();
      expect(layoutIn(900, 800, 1)).not.toHaveAttribute("data-wide");
    });
  });

  test("LedNumber is one image named by its value", () => {
    render(<LedNumber value={347} digits={4} />);
    expect(screen.getByRole("img", { name: "347" })).toBeInTheDocument();
  });

  test("LedNumber is sized in font pixels: lamps of 3 (sm) or 5 (lg) with a hairline between", () => {
    const { container, rerender } = render(<LedNumber value="22" />);
    const led = container.firstElementChild as HTMLElement;
    const svg = led.querySelector("svg") as SVGSVGElement;
    // Two digits: 11 lamps across and 7 down, 4 font pixels apart, no gap after the last.
    expect(svg.getAttribute("viewBox")).toBe("0 0 43 27");
    expect(svg.style.width).toBe("calc(var(--fp) * 43)");
    expect(svg.style.height).toBe("calc(var(--fp) * 27)");
    expect(led.style.getPropertyValue("--led-w")).toBe("43");
    // Lit and unlit lamps are separate layers, and every lamp is its own square.
    expect(svg.querySelector(".ss-led__lit")?.getAttribute("d")).toContain(
      "h3v3h-3z",
    );
    expect(svg.querySelector(".ss-led__ghost")).not.toBeNull();

    rerender(<LedNumber value="22" size="lg" tone="gold" bare label="" />);
    expect(led).toHaveClass("ss-led--lg", "ss-led--gold", "ss-led--bare");
    expect(led).toHaveAttribute("aria-hidden", "true");
    expect(led.querySelector("svg")?.getAttribute("viewBox")).toBe("0 0 65 41");
  });
});

describe("PixelGlyph", () => {
  test("bitmapPath merges touching cells, or draws each one on its own", () => {
    expect(bitmapPath(["##.#"], "#")).toBe("M0 0h2v1h-2zM3 0h1v1h-1z");
    expect(bitmapPath(["##"], "#", 4, 3)).toBe("M0 0h3v3h-3zM4 0h3v3h-3z");
    expect(bitmapPath([".."], "#")).toBe("");
  });

  test("is as many logical pixels as its bitmap, and hidden unless it is named", () => {
    const { container, rerender } = render(
      <PixelGlyph bitmap={["#.#", ".#."]} />,
    );
    const svg = container.querySelector("svg") as SVGSVGElement;
    expect(svg.getAttribute("viewBox")).toBe("0 0 3 2");
    expect(svg.style.width).toBe("calc(var(--px) * 3)");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    rerender(<PixelGlyph bitmap={["#.#", ".#."]} cell={2} label="tick" />);
    expect(screen.getByRole("img", { name: "tick" })).toBe(svg);
    expect(svg.getAttribute("viewBox")).toBe("0 0 6 4");
  });
});

describe("IconButton", () => {
  test("is named by its label, as a button or as a link", () => {
    const onClick = vi.fn();
    render(<IconButton icon="share" label="Share" onClick={onClick} />);
    const button = screen.getByRole("button", { name: "Share" });
    expect(button).toHaveClass("ss-btn", "ss-btn--icon", "ss-btn--secondary");
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
