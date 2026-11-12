// @vitest-environment node
//
// The site is prerendered: every route renders at build time, where there is no window, no
// document and no Web Audio. Importing the sound code there must do nothing at all.

import { describe, expect, test } from "vitest";

describe("sound at build time", () => {
  test("importing it touches nothing, and there is no engine", async () => {
    expect(typeof window).toBe("undefined");
    const audio = await import("./index");
    expect(audio.soundEngine()).toBeNull();
    expect(audio.isSoundMuted()).toBe(false);
    expect(audio.isSoundMutedOnServer()).toBe(false);
    expect(audio.loadSoundMuted()).toBe(false);
    expect(() => audio.setSoundMuted(true)).not.toThrow();
    const stop = audio.subscribeSoundMuted(() => {});
    stop();
  });
});
