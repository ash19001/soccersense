/**
 * The recordings of 2026-11-12: the claps inside every cheer and bed, AWAY's twinkle, HOME's
 * landing, the World Cup's horns and hum, and the distant fireworks 2 dB up.
 */
import { afterEach, describe, expect, test } from "vitest";

import type { SoundCue } from "~/scenes/scene";

import { AmbienceBed } from "./ambience";
import { type Takes, mulberry32 } from "./dsp";
import {
  HUM_RMS_DB,
  LEVELS,
  PEAK_DB,
  SoundEngine,
  type SoundEngineOptions,
  bedExtras,
  buildCue,
  createGraph,
  cueLevel,
  takeOf,
} from "./engine";
import { FIREWORKS } from "./mix";
import { PLACES, type Place, placeOf } from "./place";
import {
  FakeAudioContext,
  FakeBuffer,
  FakeBufferSource,
  FakeGain,
  FakeOscillator,
} from "./testing";

let disposers: (() => void)[] = [];
afterEach(() => {
  for (const dispose of disposers) dispose();
  disposers = [];
});

function setup(options: Partial<SoundEngineOptions> = {}) {
  const made: FakeAudioContext[] = [];
  const engine = new SoundEngine({
    createContext: () => {
      const ctx = new FakeAudioContext();
      made.push(ctx);
      return ctx.asContext();
    },
    timers: false,
    ...options,
  });
  disposers.push(() => engine.dispose());
  const ctx = (): FakeAudioContext => {
    const last = made.at(-1);
    if (!last) throw new Error("no context yet");
    return last;
  };
  return { engine, ctx };
}

/** Moves the fake clock on and lets the engine do its housekeeping. */
function wait(engine: SoundEngine, ctx: FakeAudioContext, seconds: number) {
  for (let t = 0; t < seconds; t += 0.25) {
    ctx.advance(0.25);
    engine.tick();
  }
}

/** Lets the promises of a recording's load and decode settle. */
async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

/** A fake file of `n` samples (told apart by length), every sample at `level`. */
function file(n: number, level = 0.5): FakeBuffer {
  const buffer = new FakeBuffer(1, n, 8000);
  buffer.getChannelData(0).fill(level);
  return buffer;
}

const asBuffer = (buffer: FakeBuffer) => buffer as unknown as AudioBuffer;

/** An engine with these files, each decoding to its own buffer, unlocked. */
function withFiles(lengths: Record<string, number>) {
  const names = Object.keys(lengths);
  const buffers = new Map(names.map((name) => [name, file(lengths[name])]));
  const made = setup({
    recordings: new Map(names.map((name) => [name, `/sounds/${name}.mp3`])),
    // The bytes say which file it was: as many as its place in the list.
    loadRecording: async (url) =>
      new ArrayBuffer(names.indexOf(url.slice("/sounds/".length, -4)) + 1),
  });
  made.engine.unlock();
  made.ctx().decodeAudioData = async (bytes: ArrayBuffer) =>
    buffers.get(names[bytes.byteLength - 1]) as FakeBuffer;
  const buffer = (name: string) => buffers.get(name) as FakeBuffer;
  return { ...made, buffer };
}

/** The buffer sources made from `from` on that play `buffer`. */
function sourcesOf(
  ctx: FakeAudioContext,
  buffer: FakeBuffer,
  from = 0,
): FakeBufferSource[] {
  return ctx.nodes
    .slice(from)
    .filter(
      (node): node is FakeBufferSource =>
        node instanceof FakeBufferSource && node.buffer === buffer,
    );
}

/** The gain a buffer source plays into. */
function gainOf(source: FakeBufferSource): number {
  return ([...source.outputs][0] as FakeGain).gain.value;
}

/** A bed made straight into a fake context. */
function bedAt(tier: number, extras: Parameters<typeof bedExtras>[1] | "none") {
  const ctx = new FakeAudioContext();
  const ambience = { venue: "stadium" as const, tier, crowd: 1, night: true };
  const bed = new AmbienceBed(
    ctx.asContext(),
    ctx.createGain() as unknown as AudioNode,
    null,
    ambience,
    mulberry32(3),
    null,
    1,
    extras === "none" ? {} : bedExtras(placeOf(ambience), extras),
  );
  return { ctx, bed };
}

describe("the claps", () => {
  test("in a cheer they come from the recording once it has loaded, layered by the crowd", async () => {
    const { engine, ctx, buffer } = withFiles({ claps: 900 });
    const claps = buffer("claps");
    // A cheer while it loads (the park's bed has just asked for it): synthesised claps.
    engine.setAmbience({ venue: "park", tier: 0, crowd: 1, night: false });
    engine.play({ kind: "cheer", size: 1 });
    expect(sourcesOf(ctx(), claps)).toHaveLength(0);
    await settle();
    const layers: Record<number, number> = {};
    for (const tier of [0, 1, 2, 4, 6]) {
      wait(engine, ctx(), 10);
      engine.setAmbience({ venue: "stadium", tier, crowd: 1, night: false });
      const before = ctx().nodes.length;
      // Counted around the cheer alone: the bed's own claps (random, between cheers) are not it.
      const takesBefore = engine.debug().takes.claps ?? 0;
      engine.play({ kind: "cheer", size: 1 });
      expect(
        (engine.debug().takes.claps ?? 0) - takesBefore,
        `tier ${tier}`,
      ).toBe(1);
      const played = sourcesOf(ctx(), claps, before);
      layers[tier] = played.length;
      for (const source of played) {
        // Looped (from a random place in the take), a little faster or slower.
        expect(source.loop).toBe(true);
        expect(source.playbackRate.value).toBeGreaterThan(0.95);
        expect(source.playbackRate.value).toBeLessThan(1.05);
      }
    }
    // A few mates in the park: one take; a stand at the final: nine.
    expect(layers[0]).toBe(1);
    expect(layers[6]).toBe(9);
    expect(layers[4]).toBeGreaterThan(layers[2]);
    expect(layers[2]).toBeGreaterThan(layers[1]);
  });

  test("in the beds they come from the recording too, and are synthesised without it", () => {
    const claps = file(700);
    const take = takeOf("claps", asBuffer(claps));
    const heard = (takes: Takes | null) => {
      const { ctx, bed } = bedAt(7, takes);
      bed.schedule(300);
      expect(bed.started.claps).toBeGreaterThan(3);
      const n = sourcesOf(ctx, claps).length;
      bed.dispose();
      return n;
    };
    expect(heard((name) => (name === "claps" ? take : null))).toBeGreaterThan(
      3,
    );
    expect(heard(null)).toBe(0);
  });

  test("the take is brought to its level whatever the file's, and is quieter for fewer hands", () => {
    const quiet = takeOf("claps", asBuffer(file(100, 0.01)));
    const loud = takeOf("claps", asBuffer(file(100, 0.9)));
    expect(quiet.gain * 0.01).toBeCloseTo(loud.gain * 0.9, 6);
    expect(quiet.few).toBeLessThan(0);
    expect(takeOf("vuvuzela-crowd", asBuffer(file(10))).few).toBe(0);
  });
});

describe("the World Cup's hum", () => {
  /** Sawtooths about the vuvuzela's B flat (233 Hz), playing from the start. */
  const reeds = (ctx: FakeAudioContext) =>
    ctx.nodes.filter(
      (node) =>
        node instanceof FakeOscillator &&
        node.type === "sawtooth" &&
        Math.abs(node.frequency.value - 233) < 20 &&
        node.startedAt === 0,
    ).length;

  test("is in the beds of tiers 6 and 7 only, synthesised until the recording is there", () => {
    for (const place of PLACES) {
      const hum = bedExtras(place, null).hum ?? 0;
      if (place === "final" || place === "winners") {
        expect(hum, place).toBeGreaterThan(0);
        expect(HUM_RMS_DB[place], place).toBeLessThan(-45);
      } else expect(hum, place).toBe(0);
    }
    for (let tier = 0; tier <= 7; tier++) {
      const { ctx, bed } = bedAt(tier, null);
      if (tier >= 6) expect(reeds(ctx), `tier ${tier}`).toBeGreaterThan(5);
      else expect(reeds(ctx), `tier ${tier}`).toBe(0);
      bed.dispose();
    }
    // A bed without the engine's extras (a test, an old caller) has none.
    expect(reeds(bedAt(6, "none").ctx)).toBe(0);
  });

  test("takes over from the synthesised one once it has loaded, looped", async () => {
    const { engine, ctx, buffer } = withFiles({ "vuvuzela-crowd": 1200 });
    const hum = buffer("vuvuzela-crowd");
    engine.setAmbience({ venue: "stadium", tier: 6, crowd: 1, night: true });
    expect(sourcesOf(ctx(), hum)).toHaveLength(0);
    expect(reeds(ctx())).toBeGreaterThan(5);
    await settle();
    wait(engine, ctx(), 0.5);
    const recorded = sourcesOf(ctx(), hum);
    expect(recorded).toHaveLength(1);
    expect(recorded[0].loop).toBe(true);
    expect(engine.debug().takes["vuvuzela-crowd"]).toBe(1);
    // The synthesised hum fades out under it and is let go.
    const sounding = () =>
      ctx()
        .playing()
        .filter((node) => node instanceof FakeOscillator).length;
    const during = sounding();
    wait(engine, ctx(), 4);
    expect(sounding()).toBeLessThan(during - 5);
    // A bed made after it has loaded starts with the recording.
    engine.setAmbience({ venue: "stadium", tier: 7, crowd: 1, night: true });
    expect(sourcesOf(ctx(), hum)).toHaveLength(2);
    // No other place has it.
    wait(engine, ctx(), 4);
    engine.setAmbience({ venue: "stadium", tier: 5, crowd: 1, night: true });
    expect(sourcesOf(ctx(), hum)).toHaveLength(2);
  });
});

describe("the twinkle, the landing and the horns", () => {
  test("play their recordings once loaded, and are synthesised without them", async () => {
    const { engine, ctx, buffer } = withFiles({
      sparkle: 300,
      land: 400,
      vuvuzela: 500,
    });
    engine.play({ kind: "land", power: 1 });
    expect(engine.debug().log.at(-1)).toMatchObject({
      kind: "land",
      result: "synth",
    });
    // The home page's bed has the twinkle and the landing loaded before they are wanted,
    // the World Cup's the horns.
    engine.setAmbience({ venue: "town", crowd: 0.3, night: false });
    await settle();
    const cues: [SoundCue, string, number?][] = [
      [{ kind: "sparkle" }, "sparkle"],
      [{ kind: "land", power: 1 }, "land"],
      [{ kind: "land", power: 0.35 }, "land"],
      [{ kind: "vuvuzela", size: 1 }, "vuvuzela", 6],
      [{ kind: "vuvuzela", size: 0.2 }, "vuvuzela", 7],
    ];
    const gains: number[] = [];
    for (const [cue, name, tier] of cues) {
      wait(engine, ctx(), 4);
      if (tier !== undefined) {
        engine.setAmbience({ venue: "stadium", tier, crowd: 1, night: true });
        await settle();
      }
      const before = ctx().nodes.length;
      engine.play(cue);
      expect(engine.debug().log.at(-1), name).toMatchObject({
        kind: cue.kind,
        result: "recording",
      });
      const [source] = sourcesOf(ctx(), buffer(name), before);
      expect(source, name).toBeDefined();
      expect(source.loop, name).toBe(false);
      gains.push(gainOf(source));
    }
    // The landing's small bounce is softer, and so is a tap in's blast (but heard).
    expect(gains[2]).toBeLessThan(gains[1] * 0.6);
    expect(gains[4]).toBeLessThan(gains[3] * 0.6);
    expect(gains[4]).toBeGreaterThan(gains[3] * 0.3);
    expect(engine.debug().recordings.failed).toBe(0);
  });

  test("a vuvuzela is never heard below the World Cup or on the home page, whoever sends it", () => {
    const { engine, ctx } = setup();
    engine.unlock();
    const heard: string[] = [];
    const places = [
      { venue: "town" as const },
      ...[0, 1, 2, 3, 4, 5, 6, 7].map((tier) => ({
        venue: "stadium" as const,
        tier,
      })),
    ];
    for (const where of places) {
      ctx().advance(2);
      engine.setAmbience({ ...where, crowd: 1, night: true });
      const before = engine.debug().played.vuvuzela ?? 0;
      engine.play({ kind: "vuvuzela", size: 1 });
      if ((engine.debug().played.vuvuzela ?? 0) > before) {
        heard.push(placeOf(where));
      }
    }
    expect(heard).toEqual(["final", "winners"]);
    expect(engine.debug().dropped.calm).toBe(7);
  });
});

describe("the levels", () => {
  test("the distant fireworks are 2 dB louder, synthesised or recorded", async () => {
    expect(FIREWORKS.farLiftDb).toBe(2);
    expect(FIREWORKS.farDb).toBe(-19.5);
    // The synthesised voice's trim: the first gain it makes, into the effects bus.
    const trim = (cue: Exclude<SoundCue, { kind: "wind" }>, place: Place) => {
      const ctx = new FakeAudioContext();
      const graph = createGraph(ctx.asContext());
      const from = ctx.nodes.length;
      buildCue(ctx.asContext(), graph, cue, 0, mulberry32(1), null, place);
      const first = ctx.nodes
        .slice(from)
        .find((node): node is FakeGain => node instanceof FakeGain);
      return first?.gain.value ?? 0;
    };
    const lift = 10 ** (2 / 20);
    expect(trim({ kind: "firework", distant: true }, "top")).toBeCloseTo(
      LEVELS.firework * lift,
      6,
    );
    expect(trim({ kind: "firework" }, "town")).toBeCloseTo(
      LEVELS.firework * lift,
      6,
    );
    expect(trim({ kind: "firework" }, "top")).toBeCloseTo(LEVELS.firework, 6);
    // A recording of a far firework: brought to the far peak, 2 dB up.
    const { engine, ctx } = setup({
      recordings: new Map([["firework-far", "/sounds/firework-far.mp3"]]),
      loadRecording: async () => new ArrayBuffer(16),
    });
    engine.unlock();
    const far = file(800, 0.25);
    ctx().decodeAudioData = async () => far;
    engine.play({ kind: "firework", distant: true });
    await settle();
    ctx().advance(1);
    engine.play({ kind: "firework", distant: true });
    const [source] = sourcesOf(ctx(), far);
    // At the speakers, after the master's 0.8.
    expect(20 * Math.log10(0.25 * gainOf(source) * 0.8)).toBeCloseTo(
      PEAK_DB.firework + FIREWORKS.farDb + FIREWORKS.farLiftDb,
      5,
    );
  });

  test("nothing else changed level", () => {
    expect(LEVELS).toMatchObject({
      touch: 0.15,
      kick: 0.19,
      net: 0.42,
      wind: 0.4,
      cheer: 0.4,
      groan: 0.4,
      ooh: 0.5,
      whistle: 0.15,
      squeak: 0.21,
      pop: 0.25,
      thud: 0.18,
      splash: 0.27,
      firework: 0.1,
      vuvuzela: 0.3,
      sweep: 0.22,
      click: 0.12,
      transition: 0.3,
      score: 0.4,
    });
    expect(PEAK_DB).toMatchObject({
      touch: -22,
      kick: -10.5,
      net: -14.8,
      cheer: -8.7,
      groan: -14.5,
      ooh: -16.8,
      whistle: -16.8,
      squeak: -17,
      pop: -8.6,
      thud: -10.9,
      splash: -12.9,
      firework: -14.4,
      vuvuzela: -14.1,
      sweep: -13.4,
      click: -24.2,
      transition: -18.7,
    });
    // A blast or a landing without a size or power is at its full level.
    expect(cueLevel({ kind: "vuvuzela" })).toBe(1);
    expect(cueLevel({ kind: "land" })).toBe(1);
    expect(cueLevel({ kind: "sparkle" })).toBe(1);
  });
});
