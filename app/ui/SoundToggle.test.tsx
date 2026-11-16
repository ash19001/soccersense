import { act, fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { SOUND_KEY, resetSoundEngineForTests, soundEngine } from "~/audio";
import { resetSoundMutedForTests } from "~/audio/mute";
import { resetSoundStartedForTests } from "~/audio/started";
import { FakeAudioContext } from "~/audio/testing";
import { strings } from "~/i18n";

import { Board } from "./Board";
import { GameLayout } from "./GameLayout";
import { MenuCaptions } from "./MenuCaptions";
import { SoundToggle } from "./SoundToggle";

const labels = strings.sound;

/**
 * Lets what the engine puts off until after the press (saying that the sound has started)
 * happen, and the speaker draw again.
 */
async function afterThePress(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

/** A press as a mouse or a finger makes it: down, up, and the click a moment later. */
async function press(el: Element): Promise<void> {
  fireEvent.pointerDown(el);
  fireEvent.pointerUp(el);
  await afterThePress();
  fireEvent.click(el);
  await afterThePress();
}

beforeEach(() => {
  localStorage.clear();
  resetSoundMutedForTests();
  resetSoundStartedForTests();
  FakeAudioContext.made = [];
  vi.stubGlobal("AudioContext", FakeAudioContext);
});

afterEach(() => {
  resetSoundEngineForTests();
  resetSoundMutedForTests();
  resetSoundStartedForTests();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("SoundToggle", () => {
  test("is a switch named Sound, on by default, with its state in the tooltip", async () => {
    render(<SoundToggle labels={labels} />);
    const toggle = screen.getByRole("switch", { name: labels.label });
    expect(toggle.tagName).toBe("BUTTON");
    expect(toggle).toHaveAttribute("type", "button");
    expect(toggle).toHaveAttribute("aria-checked", "true");
    // once the sound has started (a press somewhere on the page)
    fireEvent.pointerDown(document.body);
    await afterThePress();
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(toggle).toHaveAttribute("title", labels.on);
  });

  // The product owner, 2026-11-16: "when link loads first time or refreshed then it appears
  // the sound is unmuted by the symbol but no sound appears until we mute and unmute". A
  // browser holds a page silent until its first press.
  test("on a page just opened it shows the sound waiting, until a press anywhere has started it", async () => {
    render(<SoundToggle labels={labels} />);
    const toggle = screen.getByRole("switch", { name: labels.label });
    // on, but nothing to hear yet: it says so, and its waves blink
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(toggle).toHaveAttribute("data-waiting");
    expect(toggle).toHaveAttribute("title", labels.waiting);
    expect(toggle.querySelector(".ss-sound__waves")).not.toBeNull();
    expect(soundEngine()?.debug().state).toBe("none");
    // time alone starts nothing
    await afterThePress();
    expect(toggle).toHaveAttribute("data-waiting");
    // a press anywhere does
    fireEvent.pointerDown(document.body);
    await afterThePress();
    expect(soundEngine()?.debug().state).toBe("running");
    expect(toggle).not.toHaveAttribute("data-waiting");
    expect(toggle).toHaveAttribute("title", labels.on);
    expect(toggle.querySelector(".ss-sound__waves")).toBeNull();
  });

  test("a press on it while it waits starts the sound and leaves it on; the next one switches it off", async () => {
    render(<SoundToggle labels={labels} />);
    const toggle = screen.getByRole("switch", { name: labels.label });
    expect(toggle).toHaveAttribute("data-waiting");
    await press(toggle);
    // heard, and still on: nothing was switched off, nothing remembered
    expect(soundEngine()?.debug().state).toBe("running");
    expect(soundEngine()?.isMuted).toBe(false);
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(toggle).not.toHaveAttribute("data-waiting");
    expect(toggle).toHaveAttribute("title", labels.on);
    expect(localStorage.getItem(SOUND_KEY)).toBeNull();
    // the next press is an ordinary one
    await press(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(soundEngine()?.isMuted).toBe(true);
    expect(localStorage.getItem(SOUND_KEY)).toBe("off");
  });

  test("the same by keyboard or a screen reader, whose press is a click alone", async () => {
    render(<SoundToggle labels={labels} />);
    const toggle = screen.getByRole("switch", { name: labels.label });
    fireEvent.click(toggle);
    await afterThePress();
    expect(soundEngine()?.debug().state).toBe("running");
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(toggle).not.toHaveAttribute("data-waiting");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "false");
  });

  test("a press begun on it and let go elsewhere does not swallow a later one", async () => {
    render(<SoundToggle labels={labels} />);
    const toggle = screen.getByRole("switch", { name: labels.label });
    // down on the speaker (which starts the sound), then away: no click
    fireEvent.pointerDown(toggle);
    await afterThePress();
    fireEvent.blur(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(toggle).not.toHaveAttribute("data-waiting");
    // later, a click alone switches it off as it should
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "false");
  });

  test("a press turns the sound off and on, remembered, and the engine follows", async () => {
    render(<SoundToggle labels={labels} />);
    const toggle = screen.getByRole("switch", { name: labels.label });
    // the sound has started (a press somewhere on the page)
    fireEvent.pointerDown(document.body);
    await afterThePress();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(toggle).toHaveAttribute("title", labels.off);
    expect(toggle).toHaveAttribute("data-muted");
    expect(localStorage.getItem(SOUND_KEY)).toBe("off");
    expect(soundEngine()?.isMuted).toBe(true);
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(localStorage.getItem(SOUND_KEY)).toBe("on");
    expect(soundEngine()?.isMuted).toBe(false);
  });

  test("a stored choice is shown once the page runs: off is off, not waiting", () => {
    localStorage.setItem(SOUND_KEY, "off");
    render(<SoundToggle labels={labels} />);
    const toggle = screen.getByRole("switch");
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(toggle).toHaveAttribute("title", labels.off);
    expect(toggle).not.toHaveAttribute("data-waiting");
  });

  test("turning the sound on is the gesture that starts it", async () => {
    localStorage.setItem(SOUND_KEY, "off");
    render(<SoundToggle labels={labels} />);
    act(() => {
      soundEngine();
    });
    expect(FakeAudioContext.made).toHaveLength(0);
    const toggle = screen.getByRole("switch");
    fireEvent.click(toggle);
    expect(FakeAudioContext.made).toHaveLength(1);
    expect(soundEngine()?.debug().state).toBe("running");
    await afterThePress();
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(toggle).toHaveAttribute("title", labels.on);
  });

  test("where there is no Web Audio there is nothing to wait for", async () => {
    vi.stubGlobal("AudioContext", undefined);
    render(<SoundToggle labels={labels} />);
    const toggle = screen.getByRole("switch");
    expect(toggle).not.toHaveAttribute("data-waiting");
    expect(toggle).toHaveAttribute("title", labels.on);
  });

  test("renders at build time as on and waiting, without reading the storage", () => {
    localStorage.setItem(SOUND_KEY, "off");
    const read = vi.spyOn(Storage.prototype, "getItem");
    const html = renderToString(<SoundToggle labels={labels} />);
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain(`title="${labels.waiting}"`);
    expect(html).toContain("data-waiting");
    expect(read).not.toHaveBeenCalled();
  });
});

describe("where the sound switch is: one per screen, never in the corner unless asked", () => {
  const board = (
    <Board
      mode="home"
      questionNumber={1}
      questionCount={7}
      results={[]}
      total={0}
      tierName="PARK"
      tierProgress={0}
      question="Name a club"
      instruction="Closest wins."
      measureLine="Measured by the ground."
      secondsLeft={30}
      secondsTotal={30}
      labels={{ mode: "HOME", questionOf: "1 of 7", points: "PTS" }}
    />
  );
  const captions = (
    <MenuCaptions
      modes={[
        { mode: "home", label: "HOME", line: "Most common wins" },
        { mode: "away", label: "AWAY", line: "Most uncommon wins" },
      ]}
      howToPlay={{ label: "How to play", onClick: () => {} }}
      dayLabel="DAY 2"
    />
  );

  test("home: beside the how-to-play button", () => {
    render(<GameLayout bottom={captions} />);
    const switches = screen.getAllByRole("switch", { name: labels.label });
    expect(switches).toHaveLength(1);
    const help = screen.getByRole("button", { name: "How to play" });
    expect(help.nextElementSibling).toBe(switches[0]);
  });

  test("the game: in the board's head, after the mode badge", () => {
    render(<GameLayout top={board} />);
    const switches = screen.getAllByRole("switch", { name: labels.label });
    expect(switches).toHaveLength(1);
    expect(switches[0].parentElement).toHaveClass("ss-board__head");
    expect(switches[0].previousElementSibling).toHaveTextContent("HOME");
  });

  test("a screen with neither has none, unless the layout is asked for one", () => {
    const { unmount } = render(<GameLayout />);
    expect(screen.queryByRole("switch")).toBeNull();
    unmount();
    render(<GameLayout sound />);
    expect(screen.getAllByRole("switch")).toHaveLength(1);
  });
});
