// The mode card (ModeIntro): what it shows, and what sends it off.

import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { strings } from "~/i18n";
import { ModeIntro } from "./ModeIntro";
import type { UiMode } from "./types";

const MODES: readonly UiMode[] = ["home", "away", "retro", "nextgen"];

function card(): HTMLElement {
  return document.querySelector(".ss-intro") as HTMLElement;
}

afterEach(cleanup);

describe("ModeIntro", () => {
  it("shows the mode's name over its line, in the mode's colour, and is only looked at", () => {
    render(
      <ModeIntro
        mode="away"
        name="AWAY"
        line="GIVE THE MOST UNCOMMON ANSWER"
        emphasis="MOST UNCOMMON"
      />,
    );
    expect(card()).toHaveAttribute("data-mode", "away");
    expect(card()).toHaveAttribute("aria-hidden", "true");
    expect(card()).not.toHaveAttribute("data-leaving");
    expect(card().querySelector(".ss-intro__name")).toHaveTextContent("AWAY");
    // The whole line reads as written, with the words that set the mode apart in a span.
    const line = card().querySelector(".ss-intro__line");
    expect(line?.textContent).toBe("GIVE THE MOST UNCOMMON ANSWER");
    expect(line?.querySelector(".ss-intro__key")?.textContent).toBe(
      "MOST UNCOMMON",
    );
    // A rule above the words and one below.
    expect(card().querySelectorAll(".ss-intro__rule")).toHaveLength(2);
    // Nothing in it can be tabbed to or pressed.
    expect(card().querySelector("button, a, input, [tabindex]")).toBeNull();
  });

  it("leaves the line all one colour without the words to pick out, or when they are not in it", () => {
    const { rerender } = render(
      <ModeIntro mode="home" name="HOME" line="GIVE THE MOST COMMON ANSWER" />,
    );
    expect(card().querySelector(".ss-intro__key")).toBeNull();
    expect(card().querySelector(".ss-intro__line")?.textContent).toBe(
      "GIVE THE MOST COMMON ANSWER",
    );
    rerender(
      <ModeIntro
        mode="home"
        name="HOME"
        line="GIVE THE MOST COMMON ANSWER"
        emphasis="OLDEST"
      />,
    );
    expect(card().querySelector(".ss-intro__key")).toBeNull();
    expect(card().querySelector(".ss-intro__line")?.textContent).toBe(
      "GIVE THE MOST COMMON ANSWER",
    );
  });

  it("says when it is on its way out", () => {
    render(<ModeIntro mode="retro" name="RETRO" line="LINE" leaving />);
    expect(card()).toHaveAttribute("data-leaving");
  });

  it("is sent off by a press anywhere on the page, or Enter, Space or Escape", () => {
    const onSkip = vi.fn();
    render(<ModeIntro mode="home" name="HOME" line="LINE" onSkip={onSkip} />);
    fireEvent.pointerDown(document.body);
    expect(onSkip).toHaveBeenCalledTimes(1);
    fireEvent.pointerDown(document.body, { pointerType: "touch" });
    expect(onSkip).toHaveBeenCalledTimes(2);
    for (const key of ["Enter", " ", "Escape"]) {
      fireEvent.keyDown(window, { key });
    }
    expect(onSkip).toHaveBeenCalledTimes(5);
  });

  it("is not sent off by a letter, a key held down from the page before, or another mouse button", () => {
    const onSkip = vi.fn();
    render(<ModeIntro mode="home" name="HOME" line="LINE" onSkip={onSkip} />);
    fireEvent.keyDown(window, { key: "a" });
    fireEvent.keyDown(window, { key: "Tab" });
    fireEvent.keyDown(window, { key: "Enter", repeat: true });
    fireEvent.pointerDown(document.body, { pointerType: "mouse", button: 2 });
    expect(onSkip).not.toHaveBeenCalled();
  });

  it("calls the newest onSkip, and listens to nothing once it has gone or without one", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender, unmount } = render(
      <ModeIntro mode="home" name="HOME" line="LINE" onSkip={first} />,
    );
    rerender(<ModeIntro mode="home" name="HOME" line="LINE" onSkip={second} />);
    fireEvent.pointerDown(document.body);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    unmount();
    fireEvent.pointerDown(document.body);
    fireEvent.keyDown(window, { key: "Enter" });
    expect(second).toHaveBeenCalledTimes(1);

    const add = vi.spyOn(window, "addEventListener");
    try {
      render(<ModeIntro mode="home" name="HOME" line="LINE" />);
      const heard = add.mock.calls.map(([type]) => type);
      expect(heard).not.toContain("pointerdown");
      expect(heard).not.toContain("keydown");
    } finally {
      add.mockRestore();
    }
  });
});

describe("the mode cards' words", () => {
  const words = strings.play.intro;

  it.each(MODES)(
    "%s: the words picked out are in its line, letter for letter",
    (mode) => {
      expect(words.line[mode]).toContain(words.key[mode]);
      expect(words.key[mode].length).toBeLessThan(words.line[mode].length);
    },
  );

  it.each(MODES)(
    "%s: what is read out names the mode and says the same thing",
    (mode) => {
      const spoken = words.spoken[mode];
      expect(spoken.startsWith(`${strings.home.modes[mode].label}. `)).toBe(
        true,
      );
      expect(spoken.toUpperCase()).toContain(words.line[mode]);
    },
  );

  it("tells the four modes apart", () => {
    expect(new Set(MODES.map((mode) => words.line[mode])).size).toBe(4);
    expect(new Set(MODES.map((mode) => words.key[mode])).size).toBe(4);
  });
});
