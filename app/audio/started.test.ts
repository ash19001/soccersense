import { afterEach, describe, expect, test, vi } from "vitest";

import {
  isSoundWaiting,
  isSoundWaitingOnServer,
  markSoundStarted,
  resetSoundStartedForTests,
  subscribeSoundWaiting,
} from "./started";

afterEach(() => {
  resetSoundStartedForTests();
});

describe("has the sound started on this page", () => {
  test("waiting until it is said to have started; told once, and never waiting again", () => {
    expect(isSoundWaiting()).toBe(true);
    const told = vi.fn();
    subscribeSoundWaiting(told);
    markSoundStarted();
    expect(isSoundWaiting()).toBe(false);
    expect(told).toHaveBeenCalledTimes(1);
    markSoundStarted();
    expect(isSoundWaiting()).toBe(false);
    expect(told).toHaveBeenCalledTimes(1);
  });

  test("a listener taken off is not told", () => {
    const told = vi.fn();
    const off = subscribeSoundWaiting(told);
    off();
    markSoundStarted();
    expect(told).not.toHaveBeenCalled();
  });

  test("at build time, and while a page hydrates, it is waiting", () => {
    markSoundStarted();
    expect(isSoundWaitingOnServer()).toBe(true);
  });
});
