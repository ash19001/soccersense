import { afterEach, describe, expect, test, vi } from "vitest";

import type { Ambience, SoundCue } from "~/scenes/scene";

import { AMBIENT_EVENTS, AmbienceBed, ambienceKey } from "./ambience";
import { Synth, Voice, mulberry32 } from "./dsp";
import {
  LEVELS,
  NET_BY_SHOT,
  PEAK_DB,
  SCORE_PEAK_DB,
  SoundEngine,
  type SoundEngineOptions,
  buildCue,
  createGraph,
  cueLevel,
  recordingNames,
} from "./engine";
import { PLACES, type Place, crowdAt, placeOf } from "./place";
import { levelTo, loudness, recordingIndex } from "./recordings";
import {
  FakeAudioContext,
  FakeBuffer,
  FakeBufferSource,
  FakeFilter,
  FakeGain,
  FakeShaper,
  FakeSource,
} from "./testing";
import { SCORE_SHOTS, playOneShot } from "./voices";

/** One of every one-shot cue (the wind is continuous and has its own tests). */
const ONE_SHOTS: Exclude<SoundCue, { kind: "wind" }>[] = [
  { kind: "touch" },
  { kind: "kick", power: 0.6 },
  { kind: "net" },
  { kind: "cheer", size: 1 },
  { kind: "groan" },
  { kind: "ooh" },
  { kind: "whistle" },
  { kind: "squeak" },
  { kind: "pop" },
  { kind: "thud" },
  { kind: "splash" },
  { kind: "firework" },
  { kind: "firework", distant: true },
  { kind: "vuvuzela" },
  { kind: "sparkle" },
  { kind: "land", power: 1 },
  { kind: "sweep" },
  { kind: "click" },
  { kind: "transition", opening: false },
  { kind: "transition", opening: true },
  ...SCORE_SHOTS.map((shot) => ({ kind: "score", shot }) as const),
];

const VENUES: Ambience["venue"][] = ["town", "park", "ground", "stadium"];

/** How many cues of each kind there are in `cues`. */
function kindsOf(cues: readonly SoundCue[]): Record<string, number> {
  const kinds: Record<string, number> = {};
  for (const cue of cues) kinds[cue.kind] = (kinds[cue.kind] ?? 0) + 1;
  return kinds;
}

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
  const ctx = (): FakeAudioContext => {
    const last = made.at(-1);
    if (!last) throw new Error("no context yet");
    return last;
  };
  return { engine, made, ctx };
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

/** Builds one cue's sound straight into a fake context, as `place` hears it. */
function build(cue: Exclude<SoundCue, { kind: "wind" }>, place: Place = "top") {
  const ctx = new FakeAudioContext();
  const voice = new Voice(cue.kind, 0);
  playOneShot(
    new Synth(ctx.asContext(), voice, mulberry32(5)),
    cue,
    { dry: ctx.createGain() as unknown as AudioNode, wet: null },
    0,
    crowdAt(place),
  );
  return { ctx, voice };
}

let disposers: (() => void)[] = [];
afterEach(() => {
  for (const dispose of disposers) dispose();
  disposers = [];
});

function keep(engine: SoundEngine): SoundEngine {
  disposers.push(() => engine.dispose());
  return engine;
}

describe("sound engine: before a gesture", () => {
  test("nothing is made and every cue is dropped until the first gesture", () => {
    const { engine, made } = setup();
    keep(engine);
    for (const cue of ONE_SHOTS) engine.play(cue);
    engine.play({ kind: "wind", speed: 1 });
    engine.setAmbience({ venue: "park", crowd: 1, night: false });
    expect(made).toHaveLength(0);
    const debug = engine.debug();
    expect(debug.state).toBe("none");
    expect(debug.dropped.locked).toBe(ONE_SHOTS.length + 1);
    expect(debug.made).toBe(0);
    expect(debug.ambience).toBeNull();
  });

  test("the first gesture on the page makes one context, and the bed asked for comes in", () => {
    const { engine, made } = setup();
    keep(engine).attach(window, document);
    engine.setAmbience({ venue: "park", crowd: 1, night: false });
    window.dispatchEvent(new KeyboardEvent("keydown"));
    window.dispatchEvent(new Event("pointerdown"));
    expect(made).toHaveLength(1);
    expect(engine.debug().state).toBe("running");
    expect(engine.debug().ambience).toBe("park");
    engine.play({ kind: "touch" });
    expect(engine.debug().played.touch).toBe(1);
  });

  test("a press is heard even while the context it has just made is still starting", async () => {
    let start: () => void = () => {};
    const made: FakeAudioContext[] = [];
    const { engine } = setup({
      createContext: () => {
        const fake = new FakeAudioContext();
        fake.state = "suspended";
        fake.resume = () =>
          new Promise<void>((resolve) => {
            start = () => {
              fake.state = "running";
              resolve();
            };
          });
        made.push(fake);
        return fake.asContext();
      },
    });
    keep(engine).unlock();
    expect(made[0].state).toBe("suspended");
    engine.play({ kind: "click" });
    expect(engine.debug().played.click).toBe(1);
    start();
    await settle();
    expect(made[0].state).toBe("running");
    // A context suspended for any other reason (a hidden tab) plays nothing.
    engine.setHidden(true);
    engine.play({ kind: "click" });
    expect(engine.debug().played.click).toBe(1);
  });

  test("idle steps make the context, the graph, the noise and the bed ahead of the gesture, silently", () => {
    const { engine, made, ctx } = setup();
    keep(engine);
    engine.setAmbience({ venue: "town", crowd: 0.8, night: false });
    let steps = 0;
    while (engine.prepareStep()) steps++;
    // One step each: the context, the graph, three noise buffers; the bed comes in the last.
    expect(steps).toBe(5);
    expect(made).toHaveLength(1);
    expect(engine.debug().ambience).toBe("town");
    // A context the browser lets run is held suspended: nothing is heard before a gesture.
    expect(ctx().suspends).toBe(1);
    expect(ctx().state).toBe("suspended");
    engine.play({ kind: "click" });
    expect(engine.debug().dropped.locked).toBe(1);
    expect(engine.prepareStep()).toBe(false);
    // The gesture only resumes it: no second context, no second bed.
    const beds = engine.debug().beds;
    engine.unlock();
    expect(made).toHaveLength(1);
    expect(ctx().resumes).toBe(1);
    expect(engine.debug().beds).toBe(beds);
    engine.play({ kind: "click" });
    expect(engine.debug().played.click).toBe(1);
  });

  test("no idle preparation while muted or hidden, or once the gesture has come", () => {
    const muted = setup();
    keep(muted.engine).setMuted(true);
    expect(muted.engine.prepareStep()).toBe(false);
    expect(muted.made).toHaveLength(0);
    const late = setup();
    keep(late.engine).unlock();
    expect(late.made).toHaveLength(1);
    expect(late.engine.prepareStep()).toBe(false);
    expect(late.made).toHaveLength(1);
  });

  test("a context the browser holds suspended is resumed on the next gesture", () => {
    const { engine, ctx } = setup();
    keep(engine).attach(window, document);
    window.dispatchEvent(new Event("pointerdown"));
    ctx().state = "suspended";
    engine.play({ kind: "touch" });
    expect(engine.debug().dropped.locked).toBe(1);
    window.dispatchEvent(new Event("click"));
    expect(ctx().resumes).toBeGreaterThan(0);
    expect(engine.debug().state).toBe("running");
  });

  test("after dispose, a gesture makes nothing and the context is closed", () => {
    const { engine, made } = setup();
    engine.attach(window, document);
    window.dispatchEvent(new Event("pointerdown"));
    engine.dispose();
    expect(made[0].closed).toBe(true);
    window.dispatchEvent(new Event("pointerdown"));
    expect(made).toHaveLength(1);
  });
});

describe("sound engine: voices", () => {
  test("every cue makes a voice, and every voice is freed once it is over", () => {
    const { engine, ctx } = setup();
    keep(engine).unlock();
    const buses = new Set(ctx().connected());
    // A second apart, so no cap or gap drops any of them; then a burst of them at once.
    for (const cue of ONE_SHOTS) {
      engine.play(cue);
      wait(engine, ctx(), 4);
    }
    const debug = engine.debug();
    // Every goal's sting brings the net with it.
    const goals = SCORE_SHOTS.filter((shot) => NET_BY_SHOT[shot]).length;
    const kinds = kindsOf(ONE_SHOTS);
    expect(debug.played).toEqual({ ...kinds, net: kinds.net + goals });
    expect(debug.dropped).toEqual({});
    for (const cue of ONE_SHOTS.slice(0, 14)) engine.play(cue);
    expect(engine.liveVoices).toBeGreaterThan(10);
    expect(ctx().playing().length).toBeGreaterThan(10);

    // Every one-shot is over within ten seconds, and then nothing of it is left.
    wait(engine, ctx(), 10);
    expect(engine.liveVoices).toBe(0);
    expect(engine.debug().freed).toBe(engine.debug().made);
    expect(ctx().playing()).toEqual([]);
    expect(
      ctx()
        .connected()
        .filter((node) => !buses.has(node)),
    ).toEqual([]);
  });

  test("full time is three blasts, longer than one", () => {
    const { engine, ctx } = setup();
    keep(engine).unlock();
    const sources = () =>
      ctx().nodes.filter((node) => node instanceof FakeSource).length;
    engine.play({ kind: "whistle" });
    const short = sources();
    wait(engine, ctx(), 5);
    const before = sources();
    engine.play({ kind: "whistle", long: true });
    const long = sources() - before;
    expect(long).toBeGreaterThan(short);
    expect(engine.debug().played.whistle).toBe(2);
  });

  test("every one-shot's sources start at or after the cue and stop in time", () => {
    for (const cue of ONE_SHOTS) {
      const { engine, ctx } = setup();
      keep(engine).unlock();
      ctx().advance(3);
      engine.play(cue);
      const sources = ctx().nodes.filter(
        (node): node is FakeSource => node instanceof FakeSource,
      );
      for (const source of sources) {
        if (source.stoppedAt === null) continue; // the room's own sources, if any
        expect(source.startedAt, cue.kind).toBeGreaterThanOrEqual(3);
        expect(source.stoppedAt, cue.kind).toBeLessThan(3 + 10);
      }
    }
  });

  test("the same cue twice in one frame plays once; a crowd of cues is capped", () => {
    const { engine, ctx } = setup();
    keep(engine).unlock();
    engine.play({ kind: "touch" });
    engine.play({ kind: "touch" });
    expect(engine.debug().played.touch).toBe(1);
    expect(engine.debug().dropped.busy).toBe(1);
    // (a result's crowd is never capped: results.test.ts)
    for (let i = 0; i < 6; i++) {
      ctx().advance(0.15);
      engine.play({ kind: "firework" });
    }
    expect(engine.debug().played.firework).toBe(4);
  });

  test("the game page's opening is heard over the tail of the home page's closing", () => {
    const { engine, ctx } = setup();
    keep(engine).unlock();
    engine.play({ kind: "transition", opening: false });
    // the iris closes, the page changes and the game's iris opens about 0.8 s later
    ctx().advance(0.8);
    engine.play({ kind: "transition", opening: true });
    expect(engine.debug().played.transition).toBe(2);
    expect(engine.debug().dropped.busy).toBeUndefined();
  });

  test("a cue with a nonsense power, size or shot still plays, as the quietest", () => {
    const { engine } = setup();
    keep(engine).unlock();
    engine.play({ kind: "kick", power: Number.NaN });
    engine.play({ kind: "cheer", size: -4 });
    engine.play({ kind: "score", shot: "bicycle" as never });
    expect(engine.debug().played).toMatchObject({
      kick: 1,
      cheer: 1,
      score: 1,
    });
  });

  test("every kind has a level and a measured peak", () => {
    for (const cue of [...ONE_SHOTS, { kind: "wind" } as const]) {
      expect(LEVELS[cue.kind], cue.kind).toBeGreaterThan(0);
      expect(LEVELS[cue.kind], cue.kind).toBeLessThanOrEqual(1);
      if (cue.kind !== "wind" && cue.kind !== "score") {
        expect(PEAK_DB[cue.kind], cue.kind).toBeLessThan(-6);
      }
    }
    // The better the shot, the bigger its sting.
    expect(SCORE_PEAK_DB.worldie).toBeGreaterThan(SCORE_PEAK_DB.golazo);
    expect(SCORE_PEAK_DB.golazo).toBeGreaterThan(SCORE_PEAK_DB.trivela);
    expect(SCORE_PEAK_DB.trivela).toBeGreaterThan(SCORE_PEAK_DB.toepoke);
    // A click is the quietest thing there is.
    for (const [kind, peak] of Object.entries(PEAK_DB)) {
      if (kind !== "click") expect(peak, kind).toBeGreaterThan(PEAK_DB.click);
    }
  });

  test("every result sting is its own sound, and the bigger the shot the more there is to it", () => {
    const made: Record<string, number> = {};
    for (const shot of SCORE_SHOTS) {
      const { voice } = build({ kind: "score", shot });
      made[shot] = voice.sources.length;
      expect(voice.end, shot).toBeGreaterThan(0.2);
      expect(voice.end, shot).toBeLessThan(4.5);
    }
    expect(made.worldie).toBeGreaterThan(made.golazo);
    expect(made.golazo).toBeGreaterThan(made.tapin);
    expect(made.trivela).toBeGreaterThan(made.tapin);
    expect(made.miss).toBeGreaterThan(0);
    expect(new Set(Object.values(made)).size).toBeGreaterThan(3);
  });

  test("the iris falls as it closes and rises as it opens", () => {
    const sweepOf = (opening: boolean) => {
      const { ctx } = build({ kind: "transition", opening });
      const band = ctx.nodes.find(
        (node): node is FakeFilter =>
          node instanceof FakeFilter && node.type === "bandpass",
      );
      const events = band?.frequency.events ?? [];
      return [events[0]?.[1] ?? 0, events.at(-1)?.[1] ?? 0];
    };
    const [closeFrom, closeTo] = sweepOf(false);
    const [openFrom, openTo] = sweepOf(true);
    expect(closeTo).toBeLessThan(closeFrom);
    expect(openTo).toBeGreaterThan(openFrom);
  });

  test("the safety passes everything under -4.4 dBFS untouched and never reaches full scale", () => {
    const ctx = new FakeAudioContext();
    createGraph(ctx.asContext());
    const curve = ctx.nodes.find(
      (node): node is FakeShaper => node instanceof FakeShaper,
    )?.curve;
    expect(curve).toBeTruthy();
    if (!curve) return;
    // The curve reads -2 to 2 (a gain of 0.5 goes in front).
    const at = (x: number) =>
      curve[Math.round(((x / 2 + 1) / 2) * (curve.length - 1))];
    for (const x of [0, 0.1, 0.3, 0.5, 0.59, -0.4]) {
      expect(at(x)).toBeCloseTo(x, 2);
    }
    for (const y of curve) expect(Math.abs(y)).toBeLessThan(0.99);
    expect(at(1)).toBeGreaterThan(at(0.8));
    expect(at(2)).toBeGreaterThan(at(1));
  });

  test("a touch's level scales how loud it is (the juggle while typing is very quiet)", () => {
    // The trim each voice goes through on its way into the effects bus.
    const trimOf = (cue: Exclude<SoundCue, { kind: "wind" }>): number => {
      const ctx = new FakeAudioContext();
      const graph = createGraph(ctx.asContext());
      buildCue(ctx.asContext(), graph, cue, 0, mulberry32(1));
      const effects = graph.effects as unknown as FakeGain;
      const trim = ctx.nodes.find(
        (node): node is FakeGain =>
          node instanceof FakeGain && node.outputs.has(effects),
      );
      return trim?.gain.value ?? NaN;
    };
    expect(trimOf({ kind: "touch" })).toBeCloseTo(LEVELS.touch, 6);
    expect(trimOf({ kind: "touch", level: 1 })).toBeCloseTo(LEVELS.touch, 6);
    expect(trimOf({ kind: "touch", level: 0.15 })).toBeCloseTo(
      LEVELS.touch * 0.15,
      6,
    );
    expect(trimOf({ kind: "touch", level: 0 })).toBe(0);
    // out of range or not a number: kept to 0..1
    expect(trimOf({ kind: "touch", level: 4 })).toBeCloseTo(LEVELS.touch, 6);
    expect(trimOf({ kind: "touch", level: Number.NaN })).toBe(0);
    expect(cueLevel({ kind: "touch", level: 0.15 })).toBeCloseTo(0.15, 6);
    expect(cueLevel({ kind: "kick", power: 0.2 })).toBe(1);
  });
});

describe("sound engine: the wind", () => {
  test("is one voice kept alive by its cues, and is let go when they stop", () => {
    const { engine, ctx } = setup();
    keep(engine).unlock();
    for (let i = 0; i < 60; i++) {
      engine.play({ kind: "wind", speed: i / 60 });
      ctx().advance(1 / 60);
    }
    let debug = engine.debug();
    expect(debug.cues.wind).toBe(60);
    expect(debug.played.wind).toBe(1);
    expect(debug.wind).toBe(true);

    wait(engine, ctx(), 2);
    debug = engine.debug();
    expect(debug.wind).toBe(false);
    expect(debug.freed).toBe(debug.made);
    expect(ctx().playing()).toEqual([]);

    // A new spin is a new gust.
    engine.play({ kind: "wind", speed: 0.5 });
    expect(engine.debug().played.wind).toBe(2);
  });

  test("its loudness follows the speed, and it fades by itself after the last cue", () => {
    const { engine, ctx } = setup();
    keep(engine).unlock();
    engine.play({ kind: "wind", speed: 1 });
    const loud = targetsOfWind(ctx());
    expect(loud.at(-2)).toBeGreaterThan(0.5);
    expect(loud.at(-1)).toBe(0); // the fade the next cue would cancel
    ctx().advance(1 / 60);
    engine.play({ kind: "wind", speed: 0.2 });
    const soft = targetsOfWind(ctx());
    expect(soft.at(-2)).toBeLessThan(0.2);
  });
});

/** The targets set on the wind's level (the first gain the wind makes after its trim). */
function targetsOfWind(ctx: FakeAudioContext): number[] {
  for (const node of ctx.nodes) {
    const gain = (
      node as { gain?: { events: (readonly [string, ...number[]])[] } }
    ).gain;
    if (!gain) continue;
    const targets = gain.events.filter((event) => event[0] === "target");
    if (targets.length >= 2) return targets.map((event) => event[1]);
  }
  return [];
}

describe("sound engine: mute and the hidden tab", () => {
  test("muting fades out, frees everything and suspends; unmuting brings it back", () => {
    const { engine, ctx } = setup();
    keep(engine).unlock();
    engine.setAmbience({ venue: "stadium", crowd: 1, night: false });
    engine.play({ kind: "cheer", size: 1 });
    engine.setMuted(true);
    expect(engine.isMuted).toBe(true);
    expect(ctx().state).toBe("suspended");
    expect(ctx().playing()).toEqual([]);
    engine.play({ kind: "kick", power: 1 });
    expect(engine.debug().dropped.muted).toBe(1);
    expect(engine.debug().ambience).toBeNull();

    engine.setMuted(false);
    expect(ctx().state).toBe("running");
    expect(engine.debug().ambience).toBe("top");
    engine.play({ kind: "kick", power: 1 });
    expect(engine.debug().played.kick).toBe(1);
  });

  test("muted from the start, a gesture makes no context", () => {
    const { engine, made } = setup();
    keep(engine).setMuted(true);
    engine.unlock();
    expect(made).toHaveLength(0);
    engine.setMuted(false);
    expect(made).toHaveLength(1);
  });

  test("nothing plays while the tab is hidden", () => {
    const { engine, ctx } = setup();
    keep(engine).unlock();
    engine.setHidden(true);
    expect(ctx().state).toBe("suspended");
    engine.play({ kind: "touch" });
    engine.play({ kind: "wind", speed: 1 });
    expect(engine.debug().dropped.hidden).toBe(2);
    engine.setHidden(false);
    expect(ctx().state).toBe("running");
    engine.play({ kind: "touch" });
    expect(engine.debug().played.touch).toBe(1);
  });

  test("the page's visibility is followed once attached", () => {
    const { engine } = setup();
    let state: DocumentVisibilityState = "visible";
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => state,
    });
    try {
      keep(engine).attach(window, document);
      window.dispatchEvent(new Event("pointerdown"));
      state = "hidden";
      document.dispatchEvent(new Event("visibilitychange"));
      expect(engine.debug().hidden).toBe(true);
      state = "visible";
      document.dispatchEvent(new Event("visibilitychange"));
      expect(engine.debug().hidden).toBe(false);
    } finally {
      Reflect.deleteProperty(document, "visibilityState");
    }
  });
});

describe("sound engine: where the sound is", () => {
  test("over the town's bed no horn is heard; a cheer is far off and a firework a faint pop", () => {
    const { engine, ctx } = setup();
    keep(engine).unlock();
    engine.setAmbience({ venue: "town", crowd: 0.3, night: false });
    const before = ctx().nodes.length;
    engine.play({ kind: "cheer", size: 0.1 });
    // A cheer from across town is all under a low-pass at 900 Hz.
    const lowpasses = ctx()
      .nodes.slice(before)
      .filter(
        (node): node is FakeFilter =>
          node instanceof FakeFilter && node.type === "lowpass",
      );
    expect(Math.min(...lowpasses.map((f) => f.frequency.value))).toBeLessThan(
      1000,
    );
    engine.play({ kind: "firework", distant: true });
    engine.play({ kind: "vuvuzela" });
    engine.play({ kind: "touch" });
    engine.play({ kind: "kick", power: 1 });
    engine.play({ kind: "wind", speed: 0.8 });
    engine.play({ kind: "squeak" });
    const debug = engine.debug();
    expect(debug.dropped.calm).toBe(1);
    expect(debug.played).toEqual({
      cheer: 1,
      firework: 1,
      touch: 1,
      kick: 1,
      wind: 1,
      squeak: 1,
    });

    // In the game the horns are heard at the World Cup only (tiers 6 and 7).
    for (let tier = 0; tier <= 7; tier++) {
      ctx().advance(2);
      engine.setAmbience({ venue: "stadium", tier, crowd: 1, night: false });
      engine.play({ kind: "vuvuzela", size: 1 });
    }
    expect(engine.debug().played.vuvuzela).toBe(2);
    expect(engine.debug().dropped.calm).toBe(1 + 6);
  });

  test("a far firework is a smaller sound than a near one", () => {
    const near = build({ kind: "firework" }).voice.nodes.length;
    const far = build({ kind: "firework", distant: true }).voice.nodes.length;
    const town = build({ kind: "firework" }, "town").voice.nodes.length;
    expect(far).toBeLessThan(near);
    expect(town).toBe(far);
  });

  test("a cheer is the size of the crowd that is there: a few mates in the park, a stadium at the final", () => {
    const sizes: Record<string, number> = {};
    for (const place of PLACES) {
      sizes[place] = build(
        { kind: "cheer", size: 1 },
        place,
      ).voice.nodes.length;
    }
    expect(sizes.final).toBeGreaterThan(sizes.nonleague);
    expect(sizes.nonleague).toBeGreaterThan(sizes.park);
    expect(sizes.top).toBeGreaterThan(sizes.sunday);
  });

  test("the engine hears the cheer where the bed is", () => {
    const { engine, ctx } = setup();
    keep(engine).unlock();
    const made = () => ctx().nodes.length;
    engine.setAmbience({ venue: "park", tier: 0, crowd: 1, night: false });
    let before = made();
    engine.play({ kind: "cheer", size: 1 });
    const park = made() - before;
    ctx().advance(10);
    engine.setAmbience({ venue: "stadium", tier: 6, crowd: 1, night: true });
    before = made();
    engine.play({ kind: "cheer", size: 1 });
    const final = made() - before;
    expect(final).toBeGreaterThan(park);
  });
});

describe("sound engine: ambience", () => {
  test("a bed per place and time of day; a crowd change ramps the same bed", () => {
    const { engine, ctx } = setup();
    keep(engine).unlock();
    const buses = new Set(ctx().connected());
    engine.setAmbience({ venue: "town", crowd: 0.3, night: false });
    engine.setAmbience({ venue: "town", crowd: 0.8, night: false });
    expect(engine.debug()).toMatchObject({ ambience: "town", beds: 1 });
    engine.setAmbience({ venue: "town", crowd: 0.8, night: true });
    expect(engine.debug()).toMatchObject({ ambience: "town:night", beds: 2 });
    engine.setAmbience({ venue: "stadium", crowd: 1, night: true });
    expect(engine.debug()).toMatchObject({
      ambience: "top:night",
      beds: 3,
    });
    // A new career tier is a new place: a new bed, crossfaded.
    engine.setAmbience({ venue: "stadium", tier: 6, crowd: 1, night: true });
    expect(engine.debug()).toMatchObject({
      ambience: "final:night",
      beds: 4,
    });

    // Everything of the beds is let go once it has faded out.
    engine.setAmbience(null);
    wait(engine, ctx(), 4);
    expect(engine.debug().ambience).toBeNull();
    expect(ctx().playing()).toEqual([]);
    expect(
      ctx()
        .connected()
        .filter((node) => !buses.has(node)),
    ).toEqual([]);
  });

  test("its events come along as time passes, and are freed when over", () => {
    const { engine, ctx } = setup();
    keep(engine).unlock();
    engine.setAmbience({ venue: "park", crowd: 1, night: false });
    wait(engine, ctx(), 60);
    const events = engine.debug().ambienceEvents;
    expect(events.bird).toBeGreaterThan(3);
    expect(engine.debug().live).toBeLessThan(40);
  });

  test("each career tier is its own place, and a venue alone stands for a typical one", () => {
    const tiers = [0, 1, 2, 3, 4, 5, 6, 7].map((tier) =>
      placeOf({ venue: "stadium", tier }),
    );
    expect(tiers).toEqual(PLACES.slice(1));
    expect(placeOf({ venue: "town", tier: 6 })).toBe("town");
    expect(placeOf({ venue: "park" })).toBe("park");
    expect(placeOf({ venue: "ground" })).toBe("nonleague");
    expect(placeOf({ venue: "stadium" })).toBe("top");
    expect(placeOf({ venue: "park", tier: 99 })).toBe("winners");
    expect(placeOf({ venue: "park", tier: Number.NaN })).toBe("park");
    expect(
      ambienceKey({ venue: "ground", tier: 3, crowd: 1, night: true }),
    ).toBe("lower:night");
  });

  test("no bed ever plays a horn, the town has no cheers, and each place sounds like itself", () => {
    expect(Object.keys(AMBIENT_EVENTS)).not.toContain("horn");
    expect(Object.keys(AMBIENT_EVENTS)).not.toContain("vuvuzela");
    const beds: Omit<Ambience, "crowd" | "night">[] = [
      ...VENUES.map((venue) => ({ venue })),
      ...[0, 1, 2, 3, 4, 5, 6, 7].map((tier) => ({
        venue: "stadium" as const,
        tier,
      })),
    ];
    const heard: Record<string, string[]> = {};
    for (const where of beds) {
      for (const night of [false, true]) {
        const ctx = new FakeAudioContext();
        const out = ctx.createGain();
        const bed = new AmbienceBed(
          ctx.asContext(),
          out as unknown as AudioNode,
          null,
          { ...where, crowd: 1, night },
          mulberry32(7),
        );
        bed.schedule(600);
        const names = Object.keys(bed.started);
        const label = `${bed.key}`;
        expect(names.length, label).toBeGreaterThan(0);
        expect(names, label).not.toContain("horn");
        if (where.venue === "town") {
          for (const name of names) {
            expect(["bird", "car", "cricket", "owl"], name).toContain(name);
          }
        }
        if (!night) heard[bed.place] = names;
        bed.dispose();
      }
    }
    expect(heard.park).toEqual(expect.arrayContaining(["dog", "children"]));
    expect(heard.sunday).toEqual(expect.arrayContaining(["parent", "coach"]));
    expect(heard.lower).toContain("terrace");
    expect(heard.top).toContain("swell");
    expect(heard.international).toContain("drum");
    expect(heard.final).toEqual(expect.arrayContaining(["drum", "chant"]));
    expect(heard.winners).toEqual(
      expect.arrayContaining(["celebrate", "firework"]),
    );
  });
});

describe("sound engine: recordings", () => {
  test("the index names each file in public/sounds; mp3 wins over ogg", () => {
    const index = recordingIndex(
      [
        "/public/sounds/kick.ogg",
        "/public/sounds/kick.mp3",
        "/public/sounds/ambience-park-night.ogg",
        "/public/sounds/README.txt",
        "/public/sounds/Cheer.mp3",
      ],
      "/base",
    );
    expect(Object.fromEntries(index)).toEqual({
      kick: "/base/sounds/kick.mp3",
      "ambience-park-night": "/base/sounds/ambience-park-night.ogg",
      cheer: "/base/sounds/Cheer.mp3",
    });
  });

  test("a recording is looked for by its most particular name first", () => {
    expect(recordingNames({ kind: "score", shot: "worldie" }, "top")).toEqual([
      "score-worldie",
    ]);
    expect(
      recordingNames({ kind: "transition", opening: true }, "town"),
    ).toEqual(["transition-open", "transition"]);
    expect(recordingNames({ kind: "firework" }, "town")).toEqual([
      "firework-far",
      "firework",
    ]);
    expect(recordingNames({ kind: "firework" }, "final")).toEqual(["firework"]);
    expect(recordingNames({ kind: "cheer", size: 1 }, "park")).toEqual([
      "cheer-park",
      "cheer",
    ]);
    expect(recordingNames({ kind: "kick", power: 1 }, "park")).toEqual([
      "kick",
    ]);
    expect(recordingNames({ kind: "net" }, "final")).toEqual(["net"]);
  });

  test("a recording is loaded on first use and then replaces the voice", async () => {
    const load = vi.fn(async () => new ArrayBuffer(16));
    const { engine, ctx } = setup({
      recordings: new Map([["kick", "/sounds/kick.mp3"]]),
      loadRecording: load,
    });
    keep(engine).unlock();
    engine.play({ kind: "touch" });
    expect(load).not.toHaveBeenCalled();
    engine.play({ kind: "kick", power: 1 });
    expect(load).toHaveBeenCalledWith("/sounds/kick.mp3");
    expect(engine.debug().log.at(-1)).toMatchObject({
      kind: "kick",
      result: "synth",
    });
    await settle();
    expect(engine.debug().recordings.loaded).toBe(1);
    ctx().advance(1);
    engine.play({ kind: "kick", power: 1 });
    expect(engine.debug().log.at(-1)).toMatchObject({
      kind: "kick",
      result: "recording",
    });
    const played = ctx().nodes.filter(
      (node): node is FakeBufferSource =>
        node instanceof FakeBufferSource &&
        node.buffer?.length === ctx().sampleRate &&
        node.buffer.numberOfChannels === 2,
    );
    expect(played).toHaveLength(1);
    expect(played[0].loop).toBe(false);
    expect(load).toHaveBeenCalledTimes(1);
  });

  test("a worldie's recording replaces the worldie's sting and no other", async () => {
    const { engine, ctx } = setup({
      recordings: new Map([["score-worldie", "/sounds/score-worldie.mp3"]]),
      loadRecording: async () => new ArrayBuffer(16),
    });
    keep(engine).unlock();
    engine.play({ kind: "score", shot: "worldie" });
    await settle();
    ctx().advance(1);
    // (The sting's line in the log: the net comes after it.)
    const sting = () =>
      engine
        .debug()
        .log.filter((entry) => entry.kind === "score")
        .at(-1);
    engine.play({ kind: "score", shot: "worldie" });
    expect(sting()).toMatchObject({ result: "recording" });
    wait(engine, ctx(), 5);
    engine.play({ kind: "score", shot: "tapin" });
    expect(sting()).toMatchObject({ result: "synth" });
  });

  test("a recording is levelled to the voice it replaces, whatever level it came at", async () => {
    for (const level of [0.05, 0.5, 1]) {
      const { engine, ctx } = setup({
        recordings: new Map([["kick", "/sounds/kick.mp3"]]),
        loadRecording: async () => new ArrayBuffer(16),
      });
      keep(engine).unlock();
      const file = new FakeBuffer(1, 800, 8000);
      file.getChannelData(0).fill(-level);
      ctx().decodeAudioData = async () => file;
      engine.play({ kind: "kick", power: 1 });
      await settle();
      ctx().advance(1);
      engine.play({ kind: "kick", power: 1 });
      const source = ctx().nodes.find(
        (node): node is FakeBufferSource =>
          node instanceof FakeBufferSource && node.buffer === file,
      );
      const trim = [...(source?.outputs ?? [])][0] as FakeGain | undefined;
      // At the speakers (after the master's 0.8): the synthesised kick's peak.
      const peak = level * (trim?.gain.value ?? 0) * 0.8;
      expect(20 * Math.log10(peak)).toBeCloseTo(PEAK_DB.kick, 5);
    }
    expect(
      loudness(new FakeBuffer(1, 10, 8000) as unknown as AudioBuffer),
    ).toEqual({
      peak: 0,
      rms: 0,
    });
    expect(levelTo(0, 0.5)).toBe(1);
  });

  test("a recording that cannot be read leaves the synthesised voice, for good", async () => {
    const load = vi.fn(async () => {
      throw new Error("404");
    });
    const { engine, ctx } = setup({
      recordings: new Map([["pop", "/sounds/pop.mp3"]]),
      loadRecording: load,
    });
    keep(engine).unlock();
    engine.play({ kind: "pop" });
    await settle();
    wait(engine, ctx(), 5);
    engine.play({ kind: "pop" });
    expect(engine.debug().recordings.failed).toBe(1);
    expect(engine.debug().log.at(-1)).toMatchObject({
      kind: "pop",
      result: "synth",
    });
    expect(load).toHaveBeenCalledTimes(1);
  });

  test("a place's recording takes over its bed once it has loaded; a venue's stands in", async () => {
    const { engine, ctx } = setup({
      recordings: new Map([["ambience-park", "/sounds/ambience-park.mp3"]]),
      loadRecording: async () => new ArrayBuffer(16),
    });
    keep(engine).unlock();
    engine.setAmbience({ venue: "park", tier: 1, crowd: 1, night: true });
    expect(engine.debug().log.at(-1)).toMatchObject({
      kind: "ambience:sunday:night",
      result: "synth",
    });
    await settle();
    wait(engine, ctx(), 0.25);
    expect(engine.debug().beds).toBe(2);
    expect(engine.debug().log.at(-1)).toMatchObject({
      kind: "ambience:sunday:night",
      result: "recording",
    });
  });
});

describe("sound engine: the net", () => {
  test("every goal's sting brings the net, at the same moment; a miss does not", () => {
    for (const shot of SCORE_SHOTS) {
      const { engine, ctx } = setup();
      keep(engine).unlock();
      ctx().advance(2);
      engine.play({ kind: "score", shot });
      const log = engine.debug().log;
      const sting = log.find((entry) => entry.kind === "score");
      const net = log.find((entry) => entry.kind === "net");
      expect(sting, shot).toMatchObject({ result: "synth" });
      if (shot === "miss") {
        expect(net, shot).toBeUndefined();
        expect(engine.debug().played.net, shot).toBeUndefined();
      } else {
        expect(net, shot).toMatchObject({ result: "synth", at: sting?.at });
        expect(engine.debug().played.net, shot).toBe(1);
      }
    }
  });

  test("in the park the goals are jumpers: no net; from Sunday league up there is one", () => {
    const nets = (ambience: Ambience | null) => {
      const { engine } = setup();
      keep(engine).unlock();
      engine.setAmbience(ambience);
      engine.play({ kind: "score", shot: "worldie" });
      return engine.debug().played.net ?? 0;
    };
    expect(nets({ venue: "park", tier: 0, crowd: 0.2, night: false })).toBe(0);
    expect(nets({ venue: "park", crowd: 0.2, night: false })).toBe(0);
    expect(nets({ venue: "park", tier: 1, crowd: 0.4, night: false })).toBe(1);
    expect(nets({ venue: "stadium", tier: 6, crowd: 1, night: true })).toBe(1);
    expect(nets(null)).toBe(1);
  });

  test("a sting that is not played (muted, locked, too soon) brings no net", () => {
    const { engine, ctx } = setup();
    keep(engine);
    engine.play({ kind: "score", shot: "worldie" }); // before a gesture
    engine.unlock();
    engine.play({ kind: "score", shot: "worldie" });
    engine.play({ kind: "score", shot: "golazo" }); // in the same frame: dropped
    expect(engine.debug().played).toEqual({ score: 1, net: 1 });
    wait(engine, ctx(), 5);
    engine.setMuted(true);
    engine.play({ kind: "score", shot: "golazo" });
    expect(engine.debug().played).toEqual({ score: 1, net: 1 });
    // a shot the engine does not know has its sting (as the quietest) and no net
    engine.setMuted(false);
    wait(engine, ctx(), 1);
    engine.play({ kind: "score", shot: "bicycle" as never });
    expect(engine.debug().played).toEqual({ score: 2, net: 1 });
  });

  test("the bigger the goal, the harder the net is hit; its recording plays when there is one", async () => {
    const netLevel = async (shot: "worldie" | "tapin") => {
      const { engine, ctx } = setup({
        recordings: new Map([["net", "/sounds/net.mp3"]]),
        loadRecording: async () => new ArrayBuffer(16),
      });
      keep(engine).unlock();
      const file = new FakeBuffer(1, 800, 8000);
      file.getChannelData(0).fill(0.5);
      ctx().decodeAudioData = async () => file;
      engine.play({ kind: "net" });
      await settle();
      wait(engine, ctx(), 1);
      engine.play({ kind: "score", shot });
      expect(engine.debug().log.at(-1)).toMatchObject({
        kind: "net",
        result: "recording",
      });
      const sources = ctx().nodes.filter(
        (node): node is FakeBufferSource =>
          node instanceof FakeBufferSource && node.buffer === file,
      );
      const trim = [...(sources.at(-1)?.outputs ?? [])][0] as
        FakeGain | undefined;
      return 0.5 * (trim?.gain.value ?? 0) * 0.8;
    };
    const worldie = await netLevel("worldie");
    const tapin = await netLevel("tapin");
    // A worldie's net is at the net's measured peak; a tap in's is quieter.
    expect(20 * Math.log10(worldie)).toBeCloseTo(PEAK_DB.net, 5);
    expect(tapin / worldie).toBeCloseTo(NET_BY_SHOT.tapin ?? 0, 5);
  });

  test("the net's file starts loading with the first kick, so the first goal has it", async () => {
    const load = vi.fn(async () => new ArrayBuffer(16));
    const { engine, ctx } = setup({
      recordings: new Map([["net", "/sounds/net.mp3"]]),
      loadRecording: load,
    });
    keep(engine).unlock();
    engine.play({ kind: "touch" });
    expect(load).not.toHaveBeenCalled();
    engine.play({ kind: "kick", power: 1 });
    expect(load).toHaveBeenCalledWith("/sounds/net.mp3");
    await settle();
    ctx().advance(1.5);
    engine.play({ kind: "score", shot: "tapin" });
    expect(engine.debug().log.at(-1)).toMatchObject({
      kind: "net",
      result: "recording",
    });
    expect(load).toHaveBeenCalledTimes(1);
  });

  test("the synthesised net is a short swish, over in half a second", () => {
    const { voice } = build({ kind: "net" });
    expect(voice.sources.length).toBeGreaterThan(2);
    expect(voice.end).toBeGreaterThan(0.3);
    expect(voice.end).toBeLessThan(0.7);
  });
});
