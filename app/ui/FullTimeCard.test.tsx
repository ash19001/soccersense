import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { FullTimeCard, type FullTimeCardProps } from "./FullTimeCard";

function card(over: Partial<FullTimeCardProps> = {}) {
  const props: FullTimeCardProps = {
    mode: "away",
    heading: "FULL TIME",
    total: 300,
    maxTotal: 700,
    careerTitle: "LOWER LEAGUES",
    results: [],
    shareLabel: "SHARE",
    onShare: vi.fn(),
    otherLabel: "PLAY HOME",
    otherMode: "home",
    onPlayOther: vi.fn(),
    menuLabel: "MENU",
    onMenu: vi.fn(),
    ...over,
  };
  render(<FullTimeCard {...props} />);
  return props;
}

describe("FullTimeCard's SHARE", () => {
  test("is a plain button until the picture is being made", () => {
    const props = card();
    const button = screen.getByRole("button", { name: "SHARE" });
    expect(button).not.toHaveAttribute("aria-busy");
    expect(button).not.toHaveAttribute("aria-disabled");
    fireEvent.click(button);
    expect(props.onShare).toHaveBeenCalledTimes(1);
  });

  test("while busy: says so, is marked busy, keeps the focus and ignores presses", () => {
    const props = card({ shareLabel: "MAKING", shareBusy: true });
    const button = screen.getByRole("button", { name: "MAKING" });
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveAttribute("aria-disabled", "true");
    // Not `disabled`: a disabled button would drop the focus.
    expect(button).not.toBeDisabled();
    button.focus();
    expect(document.activeElement).toBe(button);
    fireEvent.click(button);
    fireEvent.keyDown(button, { key: "Enter" });
    expect(props.onShare).not.toHaveBeenCalled();
  });
});
