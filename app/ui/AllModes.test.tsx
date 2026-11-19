import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { strings } from "~/i18n";

import { AllModes, type AllModesEntry } from "./AllModes";
import { allLines } from "./MenuCaptions";

const words = strings.home.allModes;

const MODES: AllModesEntry[] = [
  { mode: "home", label: "HOME", line: "The most common answer wins" },
  {
    mode: "closest",
    label: "CLOSEST",
    line: "The answer nearest today's place wins",
    score: 560,
    spoken: words.spoken("CLOSEST", 560),
  },
  { mode: "furthest", label: "FURTHEST", line: "The furthest wins" },
];

function mount() {
  const onClose = vi.fn();
  const onChoose = vi.fn();
  const onReview = vi.fn();
  const calls: string[] = [];
  onClose.mockImplementation(() => calls.push("close"));
  onChoose.mockImplementation((mode: string) => calls.push(`choose ${mode}`));
  onReview.mockImplementation((mode: string) => calls.push(`review ${mode}`));
  render(
    <AllModes
      labels={words}
      modes={MODES}
      open
      onClose={onClose}
      onChoose={onChoose}
      onReview={onReview}
    />,
  );
  return { onClose, onChoose, onReview, calls };
}

describe("AllModes", () => {
  it("lists every mode it is given, each a button with its badge and line", () => {
    mount();
    const dialog = screen.getByRole("dialog", { name: words.heading });
    const rows = within(dialog)
      .getAllByRole("button")
      .filter((b) => b.classList.contains("ss-modes__mode"));
    expect(rows.map((b) => b.getAttribute("data-mode"))).toEqual([
      "home",
      "closest",
      "furthest",
    ]);
    expect(rows[0]).toHaveTextContent("HOME");
    expect(rows[0]).toHaveTextContent("The most common answer wins");
  });

  it("a mode not played: the card goes, then the mode is started", () => {
    const { calls } = mount();
    fireEvent.click(screen.getByRole("button", { name: /FURTHEST/ }));
    expect(calls).toEqual(["close", "choose furthest"]);
  });

  it("a mode played today shows its score and REVIEW, and opens its review", () => {
    const { calls } = mount();
    const played = screen.getByRole("button", {
      name: words.spoken("CLOSEST", 560),
    });
    expect(played).toHaveTextContent("560");
    expect(played).toHaveTextContent(words.review);
    fireEvent.click(played);
    expect(calls).toEqual(["close", "review closest"]);
  });

  it("closed with its own button: nothing is started", () => {
    const { calls } = mount();
    fireEvent.click(screen.getByRole("button", { name: words.close }));
    expect(calls).toEqual(["close"]);
  });
});

describe("the All modes button's name (allLines)", () => {
  it("is its first word, the icon before it, over the rest", () => {
    expect(allLines("All modes")).toEqual(["All", "modes"]);
    expect(allLines("Every game mode")).toEqual(["Every", "game mode"]);
    expect(allLines(" Modes ")).toEqual(["Modes"]);
  });
});
