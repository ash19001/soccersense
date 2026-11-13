import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  LEADERBOARD_KEY,
  Leaderboard,
  type LeaderboardBoard,
} from "./Leaderboard";
import { DEFAULT_SCALE, PixelScaleContext, pixelScale } from "./scale";

const LABELS = {
  heading: "TODAY'S TOP 10",
  tabs: "Today's leaderboards",
  rank: "#",
  name: "PLAYER",
  points: "PTS",
  you: "YOU",
  gap: "Rows left out",
  open: "Today's top 10",
  close: "Close the leaderboard",
  toggle: "Leaderboard",
  hide: "Hide the leaderboard",
  show: "Show the leaderboard",
};

function rows(names: string[], from = 1, you?: number) {
  return names.map((name, i) => ({
    rank: from + i,
    name,
    points: 600 - i * 10,
    you: i === you ? true : undefined,
  }));
}

const TEN = [
  "TopBinsTom",
  "NutmegNina",
  "Row Z Rita",
  "SundaySam",
  "ChipCal",
  "LobLou",
  "VolleyVic",
  "RondoRavi",
  "TifoTess",
  "ZonalZara",
];

/** HOME: the player 37th, under the ten. AWAY: the player 3rd, among them. */
const BOARDS: LeaderboardBoard[] = [
  {
    mode: "home",
    label: "HOME",
    caption: "Today's top 10, HOME",
    played: "1,284 played today",
    rows: rows(TEN),
    you: { rank: 37, name: "", points: 420, you: true },
    youSpoken: "You: 37th of 1,284",
  },
  {
    mode: "away",
    label: "AWAY",
    caption: "Today's top 10, AWAY",
    played: "640 played today",
    rows: rows([...TEN.slice(0, 9)].reverse(), 1, 2).map((r) =>
      r.you ? { ...r, name: "" } : r,
    ),
    you: null,
    youSpoken: "You: 3rd of 640",
  },
];

const MONITOR = pixelScale(1920, 1080);

function at(scale: typeof MONITOR, node: ReactNode) {
  return (
    <PixelScaleContext.Provider value={scale}>
      {node}
    </PixelScaleContext.Provider>
  );
}

describe("Leaderboard on a monitor", () => {
  test("is a panel named by its heading, with a tab per mode", () => {
    render(at(MONITOR, <Leaderboard boards={BOARDS} labels={LABELS} />));
    const panel = screen.getByRole("complementary", { name: LABELS.heading });
    expect(panel).toHaveClass("ss-panel", "ss-lb--docked");
    const tabs = within(panel).getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(["HOME", "AWAY"]);
    expect(screen.getByRole("tablist", { name: LABELS.tabs })).toBeVisible();
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(tabs[0]).toHaveAttribute("tabindex", "0");
    expect(tabs[1]).toHaveAttribute("tabindex", "-1");
    // The panel the selected tab controls is named by it.
    const tabpanel = screen.getByRole("tabpanel", { name: "HOME" });
    expect(tabs[0]).toHaveAttribute("aria-controls", tabpanel.id);
    expect(screen.queryByRole("button", { name: LABELS.open })).toBeNull();
  });

  test("shows a real table: a caption, column headings, a row per player", () => {
    render(at(MONITOR, <Leaderboard boards={BOARDS} labels={LABELS} />));
    const table = screen.getByRole("table", { name: "Today's top 10, HOME" });
    const heads = within(table).getAllByRole("columnheader");
    expect(heads.map((h) => h.textContent)).toEqual(["#", "PLAYER", "PTS"]);
    const first = within(table).getByRole("rowheader", { name: "TopBinsTom" });
    expect(first.closest("tr")).toHaveClass("is-best");
    expect(first.closest("tr")).toHaveTextContent("1TopBinsTom600");
    expect(screen.getByText("1,284 played today")).toBeVisible();
  });

  test("the player outside the ten is under it, after a gap, with their rank", () => {
    render(at(MONITOR, <Leaderboard boards={BOARDS} labels={LABELS} />));
    const table = screen.getByRole("table");
    // Ten players, the gap, the player: and the gap is read out.
    expect(within(table).getAllByRole("row")).toHaveLength(1 + 10 + 2);
    expect(within(table).getByText(LABELS.gap)).toHaveClass("ss-sr");
    const you = within(table).getByRole("rowheader", {
      name: "You: 37th of 1,284",
    });
    const row = you.closest("tr");
    expect(row).toHaveClass("is-you", "is-alone");
    expect(row).toHaveTextContent("37YOU");
    expect(row).toHaveTextContent("420");
  });

  test("the player inside the ten is highlighted at their place, with no gap", () => {
    render(
      at(
        MONITOR,
        <Leaderboard boards={BOARDS} labels={LABELS} initialMode="away" />,
      ),
    );
    const table = screen.getByRole("table", { name: "Today's top 10, AWAY" });
    expect(within(table).getAllByRole("row")).toHaveLength(1 + 9);
    expect(within(table).queryByText(LABELS.gap)).toBeNull();
    const you = within(table).getByRole("rowheader", {
      name: "You: 3rd of 640",
    });
    expect(you.closest("tr")).toHaveClass("is-you");
    expect(you.closest("tr")).not.toHaveClass("is-alone");
    expect(you.closest("tr")?.firstElementChild).toHaveTextContent("3");
  });

  test("a click or the arrow keys change the mode", () => {
    render(at(MONITOR, <Leaderboard boards={BOARDS} labels={LABELS} />));
    const [home, away] = screen.getAllByRole("tab");
    fireEvent.click(away!);
    expect(away).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("table")).toHaveAccessibleName(
      "Today's top 10, AWAY",
    );
    // From AWAY, right wraps round to HOME and takes the focus with it.
    away!.focus();
    fireEvent.keyDown(away!, { key: "ArrowRight" });
    expect(home).toHaveAttribute("aria-selected", "true");
    expect(home).toHaveFocus();
    fireEvent.keyDown(home!, { key: "End" });
    expect(away).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(away!, { key: "Home" });
    expect(home).toHaveFocus();
  });

  test("stowed (the kick-off), it is out of reach", () => {
    render(at(MONITOR, <Leaderboard boards={BOARDS} labels={LABELS} stowed />));
    const panel = document.querySelector(".ss-lb--docked");
    expect(panel).toHaveClass("is-stowed");
    expect(panel).toHaveAttribute("inert");
  });
});

/** Four modes, RETRO with the player's line and last seven days (2026-11-13). */
const WEEK_DAYS = ["FR", "SA", "SU", "MO", "TU", "WE", "TH"];
const FOUR: LeaderboardBoard[] = [
  ...BOARDS,
  {
    mode: "retro",
    label: "RETRO",
    caption: "Today's top 10, RETRO",
    played: "900 played today",
    rows: rows(TEN),
    you: { rank: 120, name: "", points: 300, you: true },
    youSpoken: "You: 120th of 900",
    mine: "You're 120th of 900",
    week: {
      heading: "LAST 7 DAYS",
      days: WEEK_DAYS.map((label, i) => ({
        label,
        total: i % 3 === 0 ? i * 100 : null,
        today: i === 6,
      })),
      spoken:
        "Your last 7 days of RETRO: Friday 0 points, Saturday not played, ...",
    },
  },
  {
    mode: "nextgen",
    label: "NEXT-GEN",
    caption: "Today's top 10, NEXT-GEN",
    played: "700 played today",
    rows: rows(TEN),
    mine: "700 played. Your turn!",
  },
];

describe("Leaderboard with four modes", () => {
  test("has a tab for each, and RETRO's shows its own line, seven bars and the link", () => {
    const onStats = vi.fn();
    render(
      at(
        MONITOR,
        <Leaderboard
          boards={FOUR}
          labels={{ ...LABELS, more: "ALL STATS" }}
          initialMode="retro"
          onStats={onStats}
        />,
      ),
    );
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual([
      "HOME",
      "AWAY",
      "RETRO",
      "NEXT-GEN",
    ]);
    const panel = screen.getByRole("tabpanel", { name: "RETRO" });
    expect(panel).toHaveAttribute("data-mode", "retro");
    // the player's line takes the place of the count
    expect(within(panel).getByText("You're 120th of 900")).toHaveClass(
      "is-mine",
    );
    expect(within(panel).queryByText("900 played today")).toBeNull();
    // seven days, today last, the days not played empty; read out as one line
    const days = panel.querySelectorAll(".ss-lb__day");
    expect(days).toHaveLength(7);
    expect(days[6]).toHaveClass("is-today");
    expect([...days].map((d) => d.classList.contains("is-empty"))).toEqual([
      false,
      true,
      true,
      false,
      true,
      true,
      false,
    ]);
    expect([...days].map((d) => d.textContent)).toEqual(WEEK_DAYS);
    expect(panel.querySelector(".ss-lb__bars")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(within(panel).getByText(/Your last 7 days of RETRO/)).toHaveClass(
      "ss-sr",
    );
    // a bar's height is its share of 700
    const bar = days[3].querySelector<HTMLElement>(".ss-lb__bar");
    expect(bar?.style.getPropertyValue("--v")).toBe(String(300 / 700));
    fireEvent.click(within(panel).getByRole("button", { name: "ALL STATS" }));
    expect(onStats).toHaveBeenCalledTimes(1);
  });

  test("a mode not played shows the nudge, and no link without a way to the stats", () => {
    render(
      at(
        MONITOR,
        <Leaderboard boards={FOUR} labels={LABELS} initialMode="nextgen" />,
      ),
    );
    const panel = screen.getByRole("tabpanel", { name: "NEXT-GEN" });
    expect(within(panel).getByText("700 played. Your turn!")).toBeTruthy();
    expect(panel.querySelector(".ss-lb__week")).toBeNull();
    expect(within(panel).queryByRole("button")).toBeNull();
  });

  test("on a phone the link closes the sheet and opens the stats", () => {
    const onStats = vi.fn();
    render(
      at(
        DEFAULT_SCALE,
        <Leaderboard
          boards={FOUR}
          labels={{ ...LABELS, more: "ALL STATS" }}
          initialMode="retro"
          onStats={onStats}
        />,
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: LABELS.open }));
    const sheet = document.querySelector("dialog") as HTMLElement;
    expect(within(sheet).getAllByRole("tab")).toHaveLength(4);
    fireEvent.click(within(sheet).getByRole("button", { name: "ALL STATS" }));
    expect(onStats).toHaveBeenCalledTimes(1);
    expect(document.querySelector("dialog")).toBeNull();
  });
});

describe("Leaderboard on a monitor: sliding it away", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  const panel = () => document.querySelector(".ss-lb--docked");
  const body = () => document.querySelector(".ss-lb__body");

  test("is out on a first visit, with a tab that says so", () => {
    render(at(MONITOR, <Leaderboard boards={BOARDS} labels={LABELS} />));
    const tab = screen.getByRole("button", { name: LABELS.toggle });
    expect(tab).toHaveAttribute("aria-expanded", "true");
    expect(tab).toHaveAttribute("title", LABELS.hide);
    expect(tab).toHaveAttribute("aria-controls", body()?.id);
    expect(panel()).not.toHaveClass("is-collapsed");
    expect(body()).not.toHaveAttribute("inert");
    expect(tab.querySelectorAll("svg")).toHaveLength(2);
  });

  test("the tab slides it away and back, keeping the focus, and remembers", () => {
    render(at(MONITOR, <Leaderboard boards={BOARDS} labels={LABELS} />));
    const tab = screen.getByRole("button", { name: LABELS.toggle });
    tab.focus();
    fireEvent.click(tab);
    expect(tab).toHaveAttribute("aria-expanded", "false");
    expect(tab).toHaveAttribute("title", LABELS.show);
    expect(panel()).toHaveClass("is-collapsed");
    // The table is out of reach; the tab is not.
    expect(body()).toHaveAttribute("inert");
    expect(panel()).not.toHaveAttribute("inert");
    expect(tab).toHaveFocus();
    expect(window.localStorage.getItem(LEADERBOARD_KEY)).toBe("closed");

    fireEvent.click(tab);
    expect(tab).toHaveAttribute("aria-expanded", "true");
    expect(panel()).not.toHaveClass("is-collapsed");
    expect(body()).not.toHaveAttribute("inert");
    expect(tab).toHaveFocus();
    expect(window.localStorage.getItem(LEADERBOARD_KEY)).toBeNull();
  });

  test("a remembered choice comes back without a slide", () => {
    window.localStorage.setItem(LEADERBOARD_KEY, "closed");
    render(at(MONITOR, <Leaderboard boards={BOARDS} labels={LABELS} />));
    const tab = screen.getByRole("button", { name: LABELS.toggle });
    expect(tab).toHaveAttribute("aria-expanded", "false");
    expect(panel()).toHaveClass("is-collapsed");
    expect(panel()).not.toHaveAttribute("data-sliding");
    expect((panel() as HTMLElement).style.transform).toBe("");
  });

  test("nothing is read from storage while rendering", () => {
    window.localStorage.setItem(LEADERBOARD_KEY, "closed");
    const read = vi.spyOn(Storage.prototype, "getItem");
    const html = renderToString(
      at(MONITOR, <Leaderboard boards={BOARDS} labels={LABELS} />),
    );
    expect(read).not.toHaveBeenCalled();
    // The build-time page is the panel out.
    expect(html).toContain('aria-expanded="true"');
    expect(html).not.toContain("is-collapsed");
  });

  test("storage that throws leaves it out, and a press still works", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    render(at(MONITOR, <Leaderboard boards={BOARDS} labels={LABELS} />));
    const tab = screen.getByRole("button", { name: LABELS.toggle });
    expect(tab).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(tab);
    expect(tab).toHaveAttribute("aria-expanded", "false");
  });

  test("stowed, the tab goes too", () => {
    window.localStorage.setItem(LEADERBOARD_KEY, "closed");
    render(at(MONITOR, <Leaderboard boards={BOARDS} labels={LABELS} stowed />));
    expect(panel()).toHaveAttribute("inert");
    expect(panel()).toHaveClass("is-stowed", "is-collapsed");
  });

  test("on a phone there is no tab: the trophy and the sheet as before", () => {
    window.localStorage.setItem(LEADERBOARD_KEY, "closed");
    render(at(DEFAULT_SCALE, <Leaderboard boards={BOARDS} labels={LABELS} />));
    expect(screen.queryByRole("button", { name: LABELS.toggle })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: LABELS.open }));
    expect(document.querySelector("dialog.ss-lb--sheet")).not.toBeNull();
  });
});

describe("Leaderboard on a phone", () => {
  test("is a trophy button until it is opened", () => {
    render(at(DEFAULT_SCALE, <Leaderboard boards={BOARDS} labels={LABELS} />));
    const trophy = screen.getByRole("button", { name: LABELS.open });
    expect(trophy).toHaveAttribute("aria-haspopup", "dialog");
    expect(trophy).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByRole("complementary")).toBeNull();
  });

  test("opens as a sheet, and closes back to the trophy", () => {
    render(at(DEFAULT_SCALE, <Leaderboard boards={BOARDS} labels={LABELS} />));
    const trophy = screen.getByRole("button", { name: LABELS.open });
    fireEvent.click(trophy);
    expect(trophy).toHaveAttribute("aria-expanded", "true");
    const sheet = document.querySelector("dialog.ss-lb--sheet");
    expect(sheet).not.toBeNull();
    expect(sheet).toHaveAttribute("open");
    expect(sheet).toHaveAccessibleName(LABELS.heading);
    expect(within(sheet as HTMLElement).getAllByRole("tab")).toHaveLength(2);
    expect(
      within(sheet as HTMLElement).getByRole("rowheader", {
        name: "You: 37th of 1,284",
      }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: LABELS.close }));
    expect(document.querySelector("dialog")).toBeNull();
    expect(trophy).toHaveFocus();
    expect(trophy).toHaveAttribute("aria-expanded", "false");
  });

  test("a kick-off closes the sheet and stows the trophy", () => {
    const { rerender } = render(
      at(DEFAULT_SCALE, <Leaderboard boards={BOARDS} labels={LABELS} />),
    );
    fireEvent.click(screen.getByRole("button", { name: LABELS.open }));
    expect(document.querySelector("dialog")).not.toBeNull();
    act(() => {
      rerender(
        at(
          DEFAULT_SCALE,
          <Leaderboard boards={BOARDS} labels={LABELS} stowed />,
        ),
      );
    });
    expect(document.querySelector("dialog")).toBeNull();
    const trophy = document.querySelector(".ss-lb-open");
    expect(trophy).toHaveClass("is-stowed");
    expect(trophy).toHaveAttribute("inert");
  });

  test("renders at build time as the trophy (the screen is not known yet)", () => {
    const html = renderToString(
      <Leaderboard boards={BOARDS} labels={LABELS} />,
    );
    expect(html).toContain("ss-lb-open");
    expect(html).not.toContain("<table");
  });
});

describe("Leaderboard: the slides", () => {
  const FRAME = 1000 / 60;
  let queue: FrameRequestCallback[] = [];
  let clock = 0;
  const saved = {
    raf: window.requestAnimationFrame,
    caf: window.cancelAnimationFrame,
    matchMedia: window.matchMedia,
  };

  beforeEach(() => {
    window.localStorage.clear();
    queue = [];
    clock = 0;
    window.requestAnimationFrame = (callback) => {
      queue.push(callback);
      return queue.length;
    };
    window.cancelAnimationFrame = () => {
      queue = [];
    };
    Object.defineProperty(window, "devicePixelRatio", {
      value: 1.25,
      configurable: true,
    });
    // The lengths ui.css registers, as the browser would give them.
    const real = window.getComputedStyle.bind(window);
    vi.spyOn(window, "getComputedStyle").mockImplementation((el, pseudo) => {
      const style = real(el, pseudo);
      if (!el.classList.contains("ss-lb--docked")) return style;
      return new Proxy(style, {
        get(target, key) {
          if (key === "getPropertyValue") {
            return (name: string) =>
              name === "--ss-lb-shift"
                ? "300px"
                : name === "--ss-lb-stow"
                  ? "400px"
                  : target.getPropertyValue(name);
          }
          const value: unknown = Reflect.get(target, key);
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
    });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(
      new DOMRect(0, 444, 390, 400),
    );
  });

  afterEach(() => {
    window.requestAnimationFrame = saved.raf;
    window.cancelAnimationFrame = saved.caf;
    window.matchMedia = saved.matchMedia;
    Reflect.deleteProperty(window, "devicePixelRatio");
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  /** One frame of the display. */
  const step = () => {
    clock += FRAME;
    const due = queue;
    queue = [];
    act(() => {
      for (const callback of due) callback(clock);
    });
  };
  const panel = () => document.querySelector(".ss-lb--docked") as HTMLElement;
  const sheet = () => document.querySelector("dialog");
  const offset = (el: HTMLElement | null, axis: "X" | "Y") => {
    const found = new RegExp(`translate${axis}\\((-?[\\d.]+)px\\)`).exec(
      el?.style.transform ?? "",
    );
    return found ? Number(found[1]) : null;
  };
  /** Every frame's position until the slide is over. */
  const run = (el: () => HTMLElement | null, axis: "X" | "Y") => {
    const seen: number[] = [];
    for (let i = 0; i < 60 && queue.length > 0; i++) {
      step();
      const x = offset(el(), axis);
      if (x !== null) seen.push(x);
    }
    return seen;
  };
  const onDevicePixels = (xs: number[]) =>
    xs.every((x) => Math.abs(x * 1.25 - Math.round(x * 1.25)) < 1e-9);

  test("the tab slides the panel every frame, eased, on whole device pixels", () => {
    render(at(MONITOR, <Leaderboard boards={BOARDS} labels={LABELS} />));
    const tab = screen.getByRole("button", { name: LABELS.toggle });
    tab.focus();
    fireEvent.click(tab);
    expect(panel()).toHaveClass("is-collapsed");
    expect(panel()).toHaveAttribute("data-sliding");
    expect(offset(panel(), "X")).toBe(0);
    const out = run(panel, "X");
    // 0.3 s at 60 frames a second (the last is the class's resting state).
    expect(out.length).toBe(17);
    expect(onDevicePixels(out)).toBe(true);
    for (let i = 1; i < out.length; i++) {
      expect(out[i]!).toBeGreaterThanOrEqual(out[i - 1]!);
    }
    // Quick to leave, gentle to settle.
    expect(out[0]!).toBeGreaterThan(40);
    expect(300 - out[14]!).toBeLessThan(2);
    // At rest the class holds it: nothing is left on the element.
    expect(panel().style.transform).toBe("");
    expect(panel()).not.toHaveAttribute("data-sliding");
    expect(tab).toHaveFocus();

    fireEvent.click(tab);
    expect(offset(panel(), "X")).toBe(300);
    const back = run(panel, "X");
    expect(back.length).toBe(17);
    expect(back[0]!).toBeLessThan(260);
    expect(panel().style.transform).toBe("");
  });

  test("a second press halfway turns it round from where it is", () => {
    render(at(MONITOR, <Leaderboard boards={BOARDS} labels={LABELS} />));
    const tab = screen.getByRole("button", { name: LABELS.toggle });
    fireEvent.click(tab);
    const out: number[] = [];
    for (let i = 0; i < 6; i++) {
      step();
      out.push(offset(panel(), "X")!);
    }
    const there = out.at(-1)!;
    const speed = there - out.at(-2)!;
    expect(there).toBeGreaterThan(150);
    fireEvent.click(tab);
    expect(tab).toHaveAttribute("aria-expanded", "true");
    // No jump: the frame on screen is where the way back starts.
    expect(offset(panel(), "X")).toBe(there);
    const back = run(panel, "X");
    // It carries on a little, slower each frame, then comes back.
    expect(back[0]! - there).toBeGreaterThan(0);
    expect(back[0]! - there).toBeLessThan(speed);
    expect(back[1]! - back[0]!).toBeLessThan(back[0]! - there);
    expect(Math.max(...back)).toBeLessThan(300);
    expect(onDevicePixels(back)).toBe(true);
    expect(panel().style.transform).toBe("");
    expect(panel()).not.toHaveClass("is-collapsed");
  });

  test("under reduced motion, and for a remembered choice, there is no slide", () => {
    window.matchMedia = ((query: string) => ({
      matches: query.includes("reduce"),
    })) as unknown as typeof window.matchMedia;
    const { unmount } = render(
      at(MONITOR, <Leaderboard boards={BOARDS} labels={LABELS} />),
    );
    fireEvent.click(screen.getByRole("button", { name: LABELS.toggle }));
    expect(panel()).toHaveClass("is-collapsed");
    expect(panel()).not.toHaveAttribute("data-sliding");
    expect(queue).toHaveLength(0);
    unmount();

    window.matchMedia = saved.matchMedia;
    render(at(MONITOR, <Leaderboard boards={BOARDS} labels={LABELS} />));
    expect(panel()).toHaveClass("is-collapsed");
    expect(panel()).not.toHaveAttribute("data-sliding");
    expect(queue).toHaveLength(0);
  });

  test("the kick-off slides it off, the tab too", () => {
    const { rerender } = render(
      at(MONITOR, <Leaderboard boards={BOARDS} labels={LABELS} />),
    );
    rerender(
      at(MONITOR, <Leaderboard boards={BOARDS} labels={LABELS} stowed />),
    );
    expect(panel()).toHaveClass("is-stowed");
    expect(panel()).toHaveAttribute("data-sliding");
    const off = run(panel, "X");
    expect(off.at(-1)).toBe(400);
    expect(onDevicePixels(off)).toBe(true);
    expect(panel()).not.toHaveAttribute("data-sliding");
  });

  test("on a phone the sheet rises, and goes down again before it closes", () => {
    render(at(DEFAULT_SCALE, <Leaderboard boards={BOARDS} labels={LABELS} />));
    const trophy = screen.getByRole("button", { name: LABELS.open });
    fireEvent.click(trophy);
    // Below the screen before the first paint: its height and the ink line under it.
    expect(offset(sheet(), "Y")).toBe(404);
    const up = run(sheet, "Y");
    expect(onDevicePixels(up)).toBe(true);
    expect(up.at(-1)).toBe(0);
    expect(sheet()?.style.transform).toBe("");

    fireEvent.click(screen.getByRole("button", { name: LABELS.close }));
    expect(sheet()).not.toBeNull();
    const down = run(sheet, "Y");
    expect(down.length).toBeGreaterThan(10);
    expect(onDevicePixels(down)).toBe(true);
    expect(sheet()).toBeNull();
    expect(trophy).toHaveFocus();

    // Escape goes down the same way.
    fireEvent.click(trophy);
    run(sheet, "Y");
    const escape = new Event("cancel", { cancelable: true });
    act(() => {
      sheet()?.dispatchEvent(escape);
    });
    expect(escape.defaultPrevented).toBe(true);
    expect(sheet()).not.toBeNull();
    run(sheet, "Y");
    expect(sheet()).toBeNull();
  });
});
