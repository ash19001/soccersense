import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { FullTimeCard } from "./FullTimeCard";
import { MenuCaptions } from "./MenuCaptions";
import { FLAME, SPARKS, Streak } from "./Streak";

describe("Streak", () => {
  test("a flame and the days, read out as words", () => {
    const { container } = render(
      <Streak
        days={4}
        spoken="Daily streak: 4 days in a row"
        title="Daily streak"
      />,
    );
    expect(screen.getByText("Daily streak: 4 days in a row")).toHaveClass(
      "ss-sr",
    );
    const root = container.querySelector(".ss-streak");
    expect(root).not.toHaveAttribute("data-cold");
    expect(root).not.toHaveAttribute("data-bump");
    expect(root).toHaveAttribute("title", "Daily streak");
    // the number and the flame are not read twice
    expect(container.querySelector(".ss-streak__days")).toHaveTextContent("4");
    expect(container.querySelector(".ss-streak__days")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(container.querySelectorAll(".ss-streak__frame")).toHaveLength(
      FLAME.length,
    );
    expect(container.querySelectorAll(".ss-streak__spark")).toHaveLength(0);
  });

  test("bumps with a burst of sparks when it has just gone up", () => {
    const { container } = render(<Streak days={5} spoken="x" bump />);
    expect(container.querySelector(".ss-streak")).toHaveAttribute("data-bump");
    expect(container.querySelectorAll(".ss-streak__spark")).toHaveLength(
      SPARKS.length,
    );
  });

  test("is cold at 0, and says its own words on the full-time card", () => {
    const { container } = render(<Streak days={0} spoken="x" />);
    expect(container.querySelector(".ss-streak")).toHaveAttribute("data-cold");
    render(<Streak days={4} spoken="y" text="STREAK 4" />);
    expect(screen.getByText("STREAK 4")).toBeInTheDocument();
  });

  test("its drawings are whole: every row of a frame as wide as the others", () => {
    for (const bitmap of [...FLAME, ...SPARKS]) {
      for (const row of bitmap) expect(row.length).toBe(bitmap[0].length);
    }
  });
});

describe("the streak in the captions and on the full-time card", () => {
  test("sits in the day plate after the day", () => {
    const { container } = render(
      <MenuCaptions
        modes={[
          { mode: "home", label: "HOME", line: "a" },
          { mode: "away", label: "AWAY", line: "b" },
        ]}
        howToPlay={{ label: "How to play", onClick: vi.fn() }}
        dayLabel="DAY 12"
        sound={false}
        streak={{ days: 3, spoken: "Daily streak: 3 days in a row" }}
      />,
    );
    const day = container.querySelector(".ss-menu__day");
    expect(day).toHaveTextContent("DAY 12");
    expect(day?.querySelector(".ss-streak")).not.toBeNull();
    expect(
      screen.getByText("Daily streak: 3 days in a row"),
    ).toBeInTheDocument();
  });

  test("the full-time card shows it under the title, and not at 0", () => {
    const base = {
      mode: "home" as const,
      heading: "FULL TIME",
      total: 300,
      maxTotal: 700,
      careerTitle: "LOWER LEAGUES",
      results: [],
      shareLabel: "SHARE",
      onShare: vi.fn(),
      otherLabel: "AWAY",
      otherMode: "away" as const,
      onPlayOther: vi.fn(),
      menuLabel: "MENU",
      onMenu: vi.fn(),
    };
    const { container, rerender } = render(
      <FullTimeCard
        {...base}
        streak={{
          days: 4,
          text: "STREAK 4",
          spoken: "Daily streak: 4 days in a row",
        }}
      />,
    );
    expect(container.querySelector(".ss-full__streak")).toHaveTextContent(
      "STREAK 4",
    );
    rerender(
      <FullTimeCard
        {...base}
        streak={{ days: 0, text: "STREAK 0", spoken: "x" }}
      />,
    );
    expect(container.querySelector(".ss-full__streak")).toBeNull();
  });
});
