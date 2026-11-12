import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  SOUND_KEY,
  isSoundMuted,
  loadSoundMuted,
  resetSoundMutedForTests,
  setSoundMuted,
  subscribeSoundMuted,
} from "./mute";

beforeEach(() => {
  localStorage.clear();
  resetSoundMutedForTests();
});

afterEach(() => {
  vi.restoreAllMocks();
  resetSoundMutedForTests();
  localStorage.clear();
});

describe("the mute", () => {
  test("is off on a first visit, and nothing is read until someone asks", () => {
    const read = vi.spyOn(Storage.prototype, "getItem");
    expect(isSoundMuted()).toBe(false);
    expect(read).not.toHaveBeenCalled();
    expect(loadSoundMuted()).toBe(false);
    expect(read).toHaveBeenCalledTimes(1);
    loadSoundMuted();
    expect(read).toHaveBeenCalledTimes(1);
  });

  test("is remembered: a new page starts muted", () => {
    setSoundMuted(true);
    expect(localStorage.getItem(SOUND_KEY)).toBe("off");
    resetSoundMutedForTests(); // a new page
    expect(isSoundMuted()).toBe(false);
    expect(loadSoundMuted()).toBe(true);
    setSoundMuted(false);
    expect(localStorage.getItem(SOUND_KEY)).toBe("on");
  });

  test("tells its subscribers, and a stored choice reaches the first one", () => {
    localStorage.setItem(SOUND_KEY, "off");
    const heard = vi.fn();
    const stop = subscribeSoundMuted(heard);
    expect(heard).toHaveBeenCalledTimes(1);
    expect(isSoundMuted()).toBe(true);
    setSoundMuted(false);
    setSoundMuted(false);
    expect(heard).toHaveBeenCalledTimes(2);
    stop();
    setSoundMuted(true);
    expect(heard).toHaveBeenCalledTimes(2);
  });

  test("follows another tab's change", () => {
    const heard = vi.fn();
    const stop = subscribeSoundMuted(heard);
    localStorage.setItem(SOUND_KEY, "off");
    window.dispatchEvent(new StorageEvent("storage", { key: SOUND_KEY }));
    expect(isSoundMuted()).toBe(true);
    expect(heard).toHaveBeenCalledTimes(1);
    stop();
  });

  test("a storage that throws is a choice for this page only", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("full");
    });
    expect(loadSoundMuted()).toBe(false);
    expect(() => setSoundMuted(true)).not.toThrow();
    expect(isSoundMuted()).toBe(true);
  });
});
