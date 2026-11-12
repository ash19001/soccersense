import { afterEach, describe, expect, test } from "vitest";

import type { SoundCue } from "~/scenes/scene";

import { SoundEngine } from "./engine";
import { Recordings, builtRecordings, variantPools } from "./recordings";
import { FakeAudioContext, FakeBuffer, FakeBufferSource } from "./testing";

let disposers: (() => void)[] = [];
afterEach(() => {
  for (const dispose of disposers) dispose();
  disposers = [];
});

/** Lets the promises of a recording's load and decode settle. */
async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

/**
 * A fake context whose decoded files can be told apart: each url's buffer is as many
 * samples long as the url has characters.
 */
function fakeFiles() {
  const ctx = new FakeAudioContext();
  ctx.decodeAudioData = async (bytes: ArrayBuffer) =>
    new FakeBuffer(1, bytes.byteLength, 8000);
  const load = async (url: string) => new ArrayBuffer(url.length);
  return { ctx, load };
}

describe("recordings: variants", () => {
  test("a name's numbered files are its variants, the plain one first, then by number", () => {
    const pools = variantPools([
      "touch-2",
      "touch-10",
      "touch-1",
      "touch",
      "cheer-park",
      "kick",
      "ambience-park-night",
    ]);
    expect(pools.get("touch")).toEqual([
      "touch",
      "touch-1",
      "touch-2",
      "touch-10",
    ]);
    expect(pools.get("touch-2")).toEqual(["touch-2"]);
    expect(pools.get("kick")).toEqual(["kick"]);
    // A place or a way is not a variant: only a number is.
    expect(pools.get("cheer")).toBeUndefined();
    expect(pools.get("cheer-park")).toEqual(["cheer-park"]);
    expect(pools.get("ambience-park")).toBeUndefined();
  });

  test("the variants take turns, round and round; one not loaded yet is passed over", async () => {
    const { ctx, load } = fakeFiles();
    const files = new Map([
      ["touch-1", "/s/touch-1.mp3"],
      ["touch-2", "/s/touch-22.mp3"],
      ["touch-3", "/s/touch-333.mp3"],
    ]);
    const recordings = new Recordings(files, load);
    const context = ctx.asContext();
    expect(recordings.has("touch")).toBe(true);
    expect(recordings.has("kick")).toBe(false);
    // The first time, nothing is ready: every variant starts loading.
    expect(recordings.next(context, "touch")).toBeNull();
    await settle();
    expect(recordings.loaded).toBe(3);
    const lengths = Array.from(
      { length: 7 },
      () => recordings.next(context, "touch")?.length,
    );
    expect(lengths).toEqual([
      "/s/touch-22.mp3".length,
      "/s/touch-333.mp3".length,
      "/s/touch-1.mp3".length,
      "/s/touch-22.mp3".length,
      "/s/touch-333.mp3".length,
      "/s/touch-1.mp3".length,
      "/s/touch-22.mp3".length,
    ]);
    // Asking for the name without taking a turn gives the first variant.
    expect(recordings.get(context, "touch")?.length).toBe(
      "/s/touch-1.mp3".length,
    );
  });

  test("a variant that cannot be read is left out of the turns", async () => {
    const ctx = new FakeAudioContext();
    const recordings = new Recordings(
      new Map([
        ["touch-1", "/a"],
        ["touch-2", "/b"],
      ]),
      async (url) => {
        if (url === "/a") throw new Error("404");
        return new ArrayBuffer(4);
      },
    );
    const context = ctx.asContext();
    recordings.next(context, "touch");
    await settle();
    expect(recordings.failed).toBe(1);
    for (let i = 0; i < 4; i++) {
      expect(recordings.next(context, "touch")).not.toBeNull();
    }
  });
});

describe("recordings: the files in public/sounds", () => {
  const built = builtRecordings();

  test("the build has the processed recordings, and none of the sources", () => {
    for (const name of [
      "kick",
      "touch-1",
      "touch-2",
      "touch-3",
      "click",
      "firework",
      "firework-far",
      "net",
      "land",
      "sparkle",
      "vuvuzela",
      "vuvuzela-crowd",
      "claps",
    ]) {
      expect(built.get(name), name).toBe(`/sounds/${name}.mp3`);
    }
    for (const name of built.keys()) expect(name).not.toMatch(/_/);
    // The originals stay in sounds-src: the raw clapping take is not played.
    expect(built.has("clapping")).toBe(false);
  });

  test("the engine plays them: kick, every touch in turn, click, firework near and far, the net, the twinkle, the landing", async () => {
    const ctx = new FakeAudioContext();
    ctx.decodeAudioData = async (bytes: ArrayBuffer) =>
      new FakeBuffer(1, bytes.byteLength, 8000);
    const urls = [...built.values()];
    const engine = new SoundEngine({
      createContext: () => ctx.asContext(),
      recordings: built,
      // Each file decodes to a buffer as long as its place in the list, to tell them apart.
      loadRecording: async (url) => new ArrayBuffer(urls.indexOf(url) + 1),
      timers: false,
    });
    disposers.push(() => engine.dispose());
    engine.unlock();
    engine.setAmbience({ venue: "stadium", crowd: 1, night: false, tier: 4 });

    const cues: SoundCue[] = [
      { kind: "kick", power: 1 },
      { kind: "touch" },
      { kind: "click" },
      { kind: "firework" },
      { kind: "firework", distant: true },
      { kind: "net" },
      { kind: "sparkle" },
      { kind: "land", power: 1 },
    ];
    // The first time each loads (the synthesised voice plays meanwhile).
    for (const cue of cues) {
      engine.play(cue);
      ctx.advance(1);
      engine.tick();
    }
    await settle();

    const heard: string[] = [];
    const play = (cue: SoundCue) => {
      ctx.advance(1);
      engine.tick();
      const before = ctx.nodes.length;
      engine.play(cue);
      expect(engine.debug().log.at(-1), cue.kind).toMatchObject({
        kind: cue.kind,
        result: "recording",
      });
      const source = ctx.nodes
        .slice(before)
        .find(
          (node): node is FakeBufferSource => node instanceof FakeBufferSource,
        );
      const address = urls[(source?.buffer?.length ?? 0) - 1];
      const name = [...built].find(([, url]) => url === address)?.[0];
      heard.push(name ?? "?");
    };
    for (const cue of cues) play(cue);
    play({ kind: "touch" });
    play({ kind: "touch" });
    play({ kind: "touch" });
    expect(heard).toEqual([
      "kick",
      // The first turn went while the files loaded.
      "touch-2",
      "click",
      "firework",
      "firework-far",
      "net",
      "sparkle",
      "land",
      "touch-3",
      "touch-1",
      "touch-2",
    ]);
    expect(engine.debug().recordings.failed).toBe(0);
  });
});
