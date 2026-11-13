import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { type ReactNode, useRef, useState } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, test, vi } from "vitest";

import { MenuCaptions } from "./MenuCaptions";
import { DEFAULT_SCALE, PixelScaleContext, pixelScale } from "./scale";
import {
  STATS_BAR_CELLS,
  Stats,
  StatsCard,
  type StatsCardProps,
  type StatsLabels,
} from "./Stats";

const LABELS: StatsLabels = {
  heading: "YOUR STATS",
  close: "Close",
  intro: "Your games on this device.",
  empty: "No games yet.",
  today: "TODAY",
  notPlayed: "Not played yet",
  shot: (n, shot, points) => `Question ${n}: ${shot}, ${points} points`,
  shots: "Today's answers",
  total: (total) => `${total} points`,
  played: "PLAYED",
  average: "AVERAGE",
  best: "BEST",
  bestDay: (day) => `DAY ${day}`,
  bestSpoken: (total, day) => `${total} points, on day ${day}`,
  tally: "Your answers so far",
  blank: "-",
  streak: "STREAK",
  days: (days) => `${days} DAYS`,
  streakBest: (days) => `BEST ${days}`,
  streakSpoken: (current, best) => `Streak: ${current}. Best: ${best}.`,
  disclaimer: "An independent fan game.",
};

const TALLY = [
  { grade: "worldie", label: "WORLDIE", count: 2, cells: 29 },
  { grade: "golazo", label: "GOLAZO", count: 1, cells: 14 },
  { grade: "trivela", label: "TRIVELA", count: 1, cells: 14 },
  { grade: "toepoke", label: "TOE POKE", count: 1, cells: 14 },
  { grade: "tapin", label: "TAP IN", count: 1, cells: 15 },
  { grade: "miss", label: "MISS", count: 1, cells: 14 },
  { grade: "timeup", label: "NO ANSWER", count: 0, cells: 0 },
] as const;

const CARD: Pick<StatsCardProps, "labels" | "modes" | "streak" | "empty"> = {
  labels: LABELS,
  empty: false,
  streak: { current: 2, best: 5 },
  modes: [
    {
      mode: "home",
      label: "HOME",
      today: null,
      played: 1,
      average: 380,
      best: { total: 380, day: 1 },
      tally: TALLY,
    },
    {
      mode: "away",
      label: "AWAY",
      today: {
        total: 330,
        title: "THIRD KIT COLLECTOR",
        shots: [
          { grade: "golazo", label: "GOLAZO", points: 80 },
          { grade: "skipped", label: "PASSED", points: 0 },
          { grade: "worldie", label: "WORLDIE", points: 100 },
          { grade: "trivela", label: "TRIVELA", points: 60 },
          { grade: "timeup", label: "TIME'S UP", points: 0 },
          { grade: "tapin", label: "TAP IN", points: 10 },
          { grade: "golazo", label: "GOLAZO", points: 80 },
        ],
      },
      played: 1,
      average: 330,
      best: { total: 330, day: 2 },
      tally: TALLY,
    },
  ],
};

const MONITOR = pixelScale(1920, 1080);

function at(scale: typeof MONITOR, node: ReactNode) {
  return <PixelScaleContext value={scale}>{node}</PixelScaleContext>;
}

/** The home screen's part: the stats button in the captions and the dialog it opens. */
function Host({ onClose }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement | null>(null);
  return (
    <>
      <MenuCaptions
        modes={[
          { mode: "home", label: "HOME", line: "Common" },
          { mode: "away", label: "AWAY", line: "Uncommon" },
        ]}
        howToPlay={{ label: "How to play", onClick: () => {} }}
        dayLabel="DAY 2"
        sound={false}
        stats={{ label: "Your stats", onClick: () => setOpen(true), open }}
        statsRef={button}
      />
      <Stats
        {...CARD}
        open={open}
        onClose={() => {
          onClose?.();
          setOpen(false);
        }}
        returnFocus={button}
      />
    </>
  );
}

function openIt(scale = DEFAULT_SCALE, onClose?: () => void) {
  render(at(scale, <Host onClose={onClose} />));
  const opener = screen.getByRole("button", { name: "Your stats" });
  act(() => opener.focus());
  fireEvent.click(opener);
  const dialog = document.querySelector("dialog");
  if (!dialog) throw new Error("no dialog");
  return { opener, dialog };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("StatsCard", () => {
  test("shows today's result per mode, or that it is not played yet", () => {
    render(at(DEFAULT_SCALE, <StatsCard {...CARD} />));
    expect(
      screen.getByRole("heading", { level: 2, name: "YOUR STATS" }),
    ).toBeInTheDocument();
    const modes = screen
      .getAllByRole("heading", { level: 3 })
      .map((h) => h.textContent);
    expect(modes).toEqual(["HOME", "AWAY"]);
    const [home, away] =
      document.querySelectorAll<HTMLElement>(".ss-stats__mode");
    expect(home).toHaveAttribute("data-mode", "home");
    expect(within(home).getByText("Not played yet")).toBeInTheDocument();
    expect(within(away).getByText("THIRD KIT COLLECTOR")).toBeInTheDocument();
    expect(within(away).getByText("330 points")).toHaveClass("ss-sr");
    // The seven shots as tags in their colours, each read out with its question.
    const list = within(away).getByRole("list", { name: "Today's answers" });
    const tags = within(list).getAllByRole("listitem");
    expect(tags.map((t) => t.getAttribute("data-grade"))).toEqual([
      "golazo",
      "skipped",
      "worldie",
      "trivela",
      "timeup",
      "tapin",
      "golazo",
    ]);
    expect(tags[2]).toHaveTextContent("Question 3: WORLDIE, 100 points");
    expect(tags[2]).toHaveAttribute("title", "WORLDIE");
  });

  test("shows each mode over the history: played, average, best and its day, the tally", () => {
    render(at(DEFAULT_SCALE, <StatsCard {...CARD} />));
    const home = document.querySelector<HTMLElement>(".ss-stats__mode");
    if (!home) throw new Error("no mode");
    const terms = [...home.querySelectorAll("dt")].map((d) => d.textContent);
    expect(terms).toEqual(["PLAYED", "AVERAGE", "BEST"]);
    const values = [...home.querySelectorAll("dd")];
    expect(values[0]).toHaveTextContent("1");
    expect(values[1]).toHaveTextContent("380");
    expect(within(values[2]).getByText("380 points, on day 1")).toHaveClass(
      "ss-sr",
    );
    // The bar: whole cells in the shots' colours, nothing for what never happened.
    const cells = [...home.querySelectorAll<HTMLElement>(".ss-stats__cell")];
    expect(cells.map((c) => c.getAttribute("data-grade"))).toEqual([
      "worldie",
      "golazo",
      "trivela",
      "toepoke",
      "tapin",
      "miss",
    ]);
    expect(
      cells.reduce(
        (sum, c) => sum + Number(c.style.getPropertyValue("--cells")),
        0,
      ),
    ).toBe(STATS_BAR_CELLS);
    expect(home.querySelector(".ss-stats__bar")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    const tally = within(home).getByRole("list", {
      name: "Your answers so far",
    });
    const lines = within(tally).getAllByRole("listitem");
    expect(lines).toHaveLength(7);
    expect(lines[0]).toHaveTextContent("WORLDIE 2");
    expect(lines[6]).toHaveTextContent("NO ANSWER 0");
  });

  test("reads the streak out in words", () => {
    render(at(DEFAULT_SCALE, <StatsCard {...CARD} />));
    expect(screen.getByText("Streak: 2. Best: 5.")).toHaveClass("ss-sr");
    expect(screen.getByText("2 DAYS")).toHaveAttribute("aria-hidden", "true");
  });

  test("a first visit: only the line, the empty state and the small print", () => {
    render(at(DEFAULT_SCALE, <StatsCard {...CARD} empty />));
    expect(screen.getByText("No games yet.")).toBeInTheDocument();
    expect(document.querySelector(".ss-stats__mode")).toBeNull();
    expect(document.querySelector(".ss-stats__streak")).toBeNull();
    const legal = screen.getByText("An independent fan game.");
    expect(legal).toHaveClass("ss-legal");
    expect(document.querySelector(".ss-help__body")?.lastElementChild).toBe(
      legal,
    );
  });

  test("a mode with no games has no numbers to show", () => {
    const modes = [
      { ...CARD.modes[0], played: 0, average: null, best: null, tally: [] },
    ];
    render(at(DEFAULT_SCALE, <StatsCard {...CARD} modes={modes} />));
    const values = [...document.querySelectorAll("dd")];
    expect(values.map((v) => v.textContent)).toEqual(["0", "-", "-"]);
    expect(document.querySelector(".ss-stats__bar")).toBeNull();
  });

  test("is the rules' card, set wide on a monitor", () => {
    const { rerender } = render(at(DEFAULT_SCALE, <StatsCard {...CARD} />));
    const card = document.querySelector(".ss-stats");
    expect(card).toHaveClass("ss-help");
    expect(card).not.toHaveAttribute("data-wide");
    rerender(at(MONITOR, <StatsCard {...CARD} />));
    expect(document.querySelector(".ss-stats")).toHaveAttribute("data-wide");
  });

  test("renders at build time", () => {
    const html = renderToString(at(DEFAULT_SCALE, <StatsCard {...CARD} />));
    expect(html).toContain("YOUR STATS");
    expect(html).toContain("THIRD KIT COLLECTOR");
  });
});

describe("the stats button", () => {
  test("sits beside the ? in the captions, named for screen readers", () => {
    openIt();
    const side = document.querySelector(".ss-menu__side");
    expect(side).toHaveAttribute("data-stats");
    const button = screen.getByRole("button", { name: "Your stats" });
    expect(side?.lastElementChild).toBe(button);
    expect(button).toHaveAttribute("title", "Your stats");
    expect(button).toHaveAttribute("aria-haspopup", "dialog");
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(button.querySelector("svg")).not.toBeNull();
  });

  test("is not there unless asked for", () => {
    render(
      at(
        DEFAULT_SCALE,
        <MenuCaptions
          modes={[]}
          howToPlay={{ label: "How to play" }}
          dayLabel="DAY 2"
        />,
      ),
    );
    expect(document.querySelector(".ss-stats-btn")).toBeNull();
    expect(document.querySelector(".ss-menu__side")).not.toHaveAttribute(
      "data-stats",
    );
  });
});

describe("Stats", () => {
  test("is nothing while it is not open", () => {
    render(
      at(DEFAULT_SCALE, <Stats {...CARD} open={false} onClose={() => {}} />),
    );
    expect(document.querySelector("dialog")).toBeNull();
  });

  test("opens as a modal dialog named by its heading, the focus on its close button", () => {
    const { dialog } = openIt();
    expect(dialog).toHaveAttribute("open");
    expect(dialog).toHaveClass("ss-help-dialog");
    expect(dialog).toHaveAccessibleName("YOUR STATS");
    expect(dialog).toHaveAccessibleDescription("Your games on this device.");
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
  });

  test("a monitor gets the card in the middle over a dither", () => {
    const { dialog } = openIt(MONITOR);
    expect(dialog).toHaveAttribute("data-wide");
    expect(dialog.querySelector(".ss-help-dialog__dither")).not.toBeNull();
  });

  test("closes by its close button, and the focus goes back to the stats button", () => {
    const onClose = vi.fn();
    const { opener } = openIt(DEFAULT_SCALE, onClose);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(document.querySelector("dialog")).toBeNull();
    expect(opener).toHaveFocus();
    expect(opener).toHaveAttribute("aria-expanded", "false");
  });

  test("closes by Escape", () => {
    const onClose = vi.fn();
    const { opener } = openIt(DEFAULT_SCALE, onClose);
    fireEvent.keyDown(screen.getByRole("button", { name: "Close" }), {
      key: "Escape",
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(opener).toHaveFocus();
  });

  test("closes by a press outside the card, not by one on it", () => {
    const onClose = vi.fn();
    const { dialog } = openIt(DEFAULT_SCALE, onClose);
    const intro = screen.getByText("Your games on this device.");
    fireEvent.pointerDown(intro);
    fireEvent.click(intro);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.pointerDown(dialog);
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("keeps the focus inside: Tab goes round the dialog", () => {
    openIt();
    const close = screen.getByRole("button", { name: "Close" });
    expect(fireEvent.keyDown(close, { key: "Tab" })).toBe(false);
    expect(close).toHaveFocus();
    expect(fireEvent.keyDown(close, { key: "Tab", shiftKey: true })).toBe(
      false,
    );
    expect(close).toHaveFocus();
  });
});
