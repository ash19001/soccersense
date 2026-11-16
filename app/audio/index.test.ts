import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { SoundCue } from "~/scenes/scene";

import {
  SOUND_KEY,
  installClickSounds,
  playCue,
  resetSoundEngineForTests,
  soundEngine,
} from "./index";
import { resetSoundMutedForTests } from "./mute";
import { isSoundWaiting, resetSoundStartedForTests } from "./started";
import { FakeAudioContext } from "./testing";

/** Lets what was put off until after the press (a timer of no length) happen. */
function afterThePress(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
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
  localStorage.clear();
  document.body.innerHTML = "";
});

/** Presses `el` the way a mouse does: the gesture first, then the click. */
function press(el: Element): void {
  el.dispatchEvent(new Event("pointerdown", { bubbles: true }));
  el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

describe("playCue", () => {
  test("does nothing before the first gesture, plays after it, and nothing while off", () => {
    playCue({ kind: "score", shot: "golazo" });
    const engine = soundEngine();
    expect(engine?.debug().dropped.locked).toBe(1);
    expect(FakeAudioContext.made).toHaveLength(0);

    window.dispatchEvent(new Event("pointerdown"));
    playCue({ kind: "score", shot: "golazo" });
    expect(engine?.debug().played.score).toBe(1);

    localStorage.setItem(SOUND_KEY, "off");
    engine?.setMuted(true);
    playCue({ kind: "whistle" });
    expect(engine?.debug().dropped.muted).toBe(1);
  });
});

describe("the sound waiting for the page's first press", () => {
  test("it waits until a gesture has started the engine, and until that press has been handled", async () => {
    soundEngine();
    expect(isSoundWaiting()).toBe(true);
    await afterThePress();
    expect(isSoundWaiting()).toBe(true);
    window.dispatchEvent(new Event("pointerdown"));
    // whoever handles the same press next still finds it waiting
    expect(isSoundWaiting()).toBe(true);
    await afterThePress();
    expect(isSoundWaiting()).toBe(false);
  });

  test("switched off, a gesture starts nothing: it waits until the sound is switched on", async () => {
    localStorage.setItem(SOUND_KEY, "off");
    const engine = soundEngine();
    window.dispatchEvent(new Event("pointerdown"));
    await afterThePress();
    expect(isSoundWaiting()).toBe(true);
    engine?.setMuted(false);
    await afterThePress();
    expect(isSoundWaiting()).toBe(false);
  });

  test("an engine that has been disposed of says nothing", async () => {
    soundEngine();
    window.dispatchEvent(new Event("pointerdown"));
    resetSoundEngineForTests();
    await afterThePress();
    expect(isSoundWaiting()).toBe(true);
  });
});

describe("the click of the buttons", () => {
  test("every press of a button anywhere plays a click; disabled ones and the canvas do not", () => {
    document.body.innerHTML = `
      <button id="plain" type="button">Go</button>
      <button id="off" type="button" disabled>Off</button>
      <div id="role" role="button" tabindex="0"><span id="inner">Inner</span></div>
      <a id="link" class="ss-btn" href="#x">Link</a>
      <a id="text" href="#y">Text</a>
      <span id="dead" role="button" aria-disabled="true">Dead</span>
      <canvas id="stage"></canvas>
    `;
    const engine = soundEngine();
    window.dispatchEvent(new Event("pointerdown"));
    const clicks = () => engine?.debug().cues.click ?? 0;
    const at = (id: string) => {
      const el = document.getElementById(id);
      if (!el) throw new Error(id);
      return el;
    };

    press(at("plain"));
    expect(clicks()).toBe(1);
    // A disabled button has no click event at all; aria-disabled is skipped by hand.
    press(at("dead"));
    expect(clicks()).toBe(1);
    // Inside an element with role button: its press.
    press(at("inner"));
    expect(clicks()).toBe(2);
    press(at("link"));
    expect(clicks()).toBe(3);
    press(at("text"));
    press(at("stage"));
    expect(clicks()).toBe(3);
  });

  test("the listener comes off with its undo", () => {
    document.body.innerHTML = `<button id="b" type="button">B</button>`;
    const heard: SoundCue[] = [];
    const undo = installClickSounds(document, (cue) => heard.push(cue));
    const button = document.getElementById("b");
    if (!button) throw new Error("no button");
    press(button);
    expect(heard).toEqual([{ kind: "click" }]);
    undo();
    press(button);
    expect(heard).toHaveLength(1);
  });

  test("the press that switches the sound on is heard; the one that switches it off is not", () => {
    document.body.innerHTML = `<button id="b" type="button">B</button>`;
    const engine = soundEngine();
    window.dispatchEvent(new Event("pointerdown"));
    const button = document.getElementById("b");
    if (!button) throw new Error("no button");
    // As the sound switch does: its own handler runs before the document hears the click.
    button.addEventListener("click", () => engine?.setMuted(!engine.isMuted));
    press(button);
    expect(engine?.isMuted).toBe(true);
    expect(engine?.debug().played.click).toBeUndefined();
    press(button);
    expect(engine?.isMuted).toBe(false);
    expect(engine?.debug().played.click).toBe(1);
  });
});
