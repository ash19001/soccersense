/**
 * The sound board at /dev/sound: every sound and every level of mix.ts on one page, each
 * sound played through the real engine, each level tried live from a slider and copied out
 * as the lines to paste into mix.ts. Prerendered: nothing of the browser during render.
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { resetSoundEngineForTests, soundEngine } from "~/audio";
import { knobs, resetKnobs } from "~/audio/knobs";
import { SOUNDS } from "~/audio/mix";
import { resetSoundMutedForTests } from "~/audio/mute";
import { FakeAudioContext } from "~/audio/testing";

import DevSound from "./dev-sound";

beforeEach(() => {
  localStorage.clear();
  resetSoundMutedForTests();
  FakeAudioContext.made = [];
  vi.stubGlobal("AudioContext", FakeAudioContext);
});

afterEach(() => {
  resetSoundEngineForTests();
  resetSoundMutedForTests();
  resetKnobs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  localStorage.clear();
});

function page() {
  return render(
    <MemoryRouter>
      <DevSound />
    </MemoryRouter>,
  );
}

/** The row of a sound, by its name, in a group (its id). */
function row(name: string, group = "sounds"): HTMLElement {
  const section = document.getElementById(group);
  const heading = [...(section?.querySelectorAll("h3") ?? [])].find(
    (h) => h.textContent === name,
  );
  const found = heading?.closest<HTMLElement>(".dev-sound__row");
  if (!found) throw new Error(`no row for ${name} in ${group}`);
  return found;
}

function press(within: HTMLElement, label: string): void {
  const button = [...within.querySelectorAll("button")].find(
    (b) => b.textContent === label,
  );
  if (!button) throw new Error(`no ${label} button`);
  fireEvent.click(button);
}

describe("the sound board", () => {
  test("renders at build time without the browser's sound, and makes nothing", () => {
    const html = renderToString(
      <MemoryRouter>
        <DevSound />
      </MemoryRouter>,
    );
    expect(html).toContain("Sound board");
    expect(html).toContain("SOUNDS.touch.level".split(".").slice(1).join("."));
    expect(FakeAudioContext.made).toHaveLength(0);
  });

  test("lists every sound of the game and every level of mix.ts, each level once", () => {
    const { container } = page();
    const names = [...container.querySelectorAll(".dev-sound__name")].map(
      (h) => h.textContent,
    );
    for (const kind of Object.keys(SOUNDS)) {
      // the crowd, the stings, the fireworks and the horns have groups of their own
      if (
        ["cheer", "groan", "ooh", "score", "firework", "vuvuzela"].includes(
          kind,
        )
      )
        continue;
      expect(names, kind).toContain(kind);
    }
    for (const title of [
      "The crowd, by place",
      "The background beds, by place and career tier",
      "The result stings, by shot",
      "Fireworks, near and far",
      "The vuvuzela",
      "The claps",
      "The juggling",
    ]) {
      expect(
        screen.getByRole("heading", { level: 2, name: title }),
      ).toBeTruthy();
    }
    const shown = [...container.querySelectorAll("[data-path]")].map((el) =>
      el.getAttribute("data-path"),
    );
    expect([...shown].sort()).toEqual(
      knobs()
        .map((k) => k.path)
        .sort(),
    );
    expect(new Set(shown).size).toBe(shown.length);
  });

  test("says where each sound comes from: its file, or synthesised", () => {
    page();
    expect(row("touch").textContent).toContain(
      "touch-1.mp3, touch-2.mp3, touch-3.mp3",
    );
    expect(row("kick").textContent).toContain("kick.mp3");
    expect(row("whistle").textContent).toContain("synthesised");
  });

  test("plays through the real engine, with the level mix.ts gives, and a variant on its own", async () => {
    page();
    press(row("whistle"), "PLAY");
    const engine = soundEngine();
    expect(engine).not.toBeNull();
    let log = engine?.debug().log ?? [];
    expect(log.at(-1)).toMatchObject({
      kind: "whistle",
      result: "synth",
      gain: SOUNDS.whistle.level,
    });
    press(row("kick"), "SYNTH");
    log = engine?.debug().log ?? [];
    expect(log.at(-1)).toMatchObject({ kind: "kick", result: "synth" });
    // the board's play buttons do not click: the sound is heard alone
    expect(log.some((e) => e.kind === "click")).toBe(false);
  });

  test("a slider changes the level at once, the log shows it, and the changes copy as mix.ts's lines", async () => {
    vi.useFakeTimers();
    const write = vi.fn(async () => {});
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText: write },
    });
    page();
    const slider = screen.getByLabelText("whistle.level");
    fireEvent.change(slider, { target: { value: "0.3" } });
    expect(SOUNDS.whistle.level).toBe(0.3);
    press(row("whistle"), "PLAY");
    expect(soundEngine()?.debug().log.at(-1)).toMatchObject({
      kind: "whistle",
      gain: 0.3,
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(
      soundEngine()
        ?.debug()
        .log.some((e) => e.kind === "mix SOUNDS.whistle.level = 0.3"),
    ).toBe(true);
    const copy = screen.getByRole("button", { name: "COPY CHANGES (1)" });
    const lines = document.querySelector(".dev-sound__changes")?.textContent;
    expect(lines).toContain("SOUNDS.whistle.level (was 0.15)");
    expect(lines).toContain("    level: 0.3,");
    await act(async () => {
      fireEvent.click(copy);
    });
    expect(write).toHaveBeenCalledWith(lines);
    expect(document.querySelector(".dev-sound__copied")?.textContent).toContain(
      "Copied",
    );
    fireEvent.click(screen.getByRole("button", { name: "RESET" }));
    expect(SOUNDS.whistle.level).toBe(0.15);
    expect(
      screen.getByRole("button", { name: "COPY CHANGES (0)" }),
    ).toBeDisabled();
  });

  test("a bed starts and stops", () => {
    page();
    press(row("tier 6: the World Cup final", "beds"), "NIGHT");
    expect(soundEngine()?.debug().ambience).toBe("final:night");
    press(row("tier 6: the World Cup final", "beds"), "STOP");
    expect(soundEngine()?.debug().ambience).toBeNull();
  });
});
