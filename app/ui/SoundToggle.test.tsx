import { act, fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { SOUND_KEY, resetSoundEngineForTests, soundEngine } from "~/audio";
import { resetSoundMutedForTests } from "~/audio/mute";
import { FakeAudioContext } from "~/audio/testing";
import { strings } from "~/i18n";

import { Board } from "./Board";
import { GameLayout } from "./GameLayout";
import { MenuCaptions } from "./MenuCaptions";
import { SoundToggle } from "./SoundToggle";

const labels = strings.sound;

beforeEach(() => {
  localStorage.clear();
  resetSoundMutedForTests();
  FakeAudioContext.made = [];
  vi.stubGlobal("AudioContext", FakeAudioContext);
});

afterEach(() => {
  resetSoundEngineForTests();
  resetSoundMutedForTests();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("SoundToggle", () => {
  test("is a switch named Sound, on by default, with its state in the tooltip", () => {
    render(<SoundToggle labels={labels} />);
    const toggle = screen.getByRole("switch", { name: labels.label });
    expect(toggle.tagName).toBe("BUTTON");
    expect(toggle).toHaveAttribute("type", "button");
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(toggle).toHaveAttribute("title", labels.on);
  });

  test("a press turns the sound off and on, remembered, and the engine follows", () => {
    render(<SoundToggle labels={labels} />);
    const toggle = screen.getByRole("switch", { name: labels.label });
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

  test("a stored choice is shown once the page runs", () => {
    localStorage.setItem(SOUND_KEY, "off");
    render(<SoundToggle labels={labels} />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
  });

  test("turning the sound on is the gesture that starts it", () => {
    localStorage.setItem(SOUND_KEY, "off");
    render(<SoundToggle labels={labels} />);
    act(() => {
      soundEngine();
    });
    expect(FakeAudioContext.made).toHaveLength(0);
    fireEvent.click(screen.getByRole("switch"));
    expect(FakeAudioContext.made).toHaveLength(1);
    expect(soundEngine()?.debug().state).toBe("running");
  });

  test("renders at build time as on, without reading the storage", () => {
    localStorage.setItem(SOUND_KEY, "off");
    const read = vi.spyOn(Storage.prototype, "getItem");
    const html = renderToString(<SoundToggle labels={labels} />);
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain(`title="${labels.on}"`);
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
