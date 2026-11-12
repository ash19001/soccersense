import { afterEach, describe, expect, test, vi } from "vitest";

import type { Ambience, SoundCue } from "~/scenes/scene";

import { Voice } from "./dsp";
import { RESULT_KINDS, SoundEngine } from "./engine";
import { LIMITS } from "./mix";
import { FakeAudioContext, type FakeParam, FakeSource } from "./testing";

/** The World Cup final's bed: every result sound is heard there, horns and net too. */
const FINAL: Ambience = { venue: "stadium", crowd: 1, night: false, tier: 6 };

function setup() {
  let made: FakeAudioContext | null = null;
  const engine = new SoundEngine({
    createContext: () => {
      made = new FakeAudioContext();
      return made.asContext();
    },
    timers: false,
  });
  disposers.push(() => engine.dispose());
  engine.setAmbience(FINAL);
  engine.unlock();
  const ctx = (): FakeAudioContext => {
    if (!made) throw new Error("no context yet");
    return made;
  };
  return { engine, ctx };
}

/** The engine's voices playing now (private: read for the tests only). */
function voicesOf(engine: SoundEngine, kind: string): Voice[] {
  const voices = (engine as unknown as { voices: Set<Voice> }).voices;
  return [...voices].filter((voice) => voice.kind === kind);
}

/** Moves the fake clock on by `seconds`, a housekeeping tick every quarter second. */
function wait(engine: SoundEngine, ctx: FakeAudioContext, seconds: number) {
  for (let t = 0; t < seconds; t += 0.25) {
    ctx.advance(Math.min(0.25, seconds - t));
    engine.tick();
  }
}

interface Fade {
  voice: Voice;
  now: number;
  seconds: number;
  /** Was it the oldest of its kind still playing (not already fading)? */
  oldest: boolean;
}

/** Watches every voice the engine fades out, checking it was the oldest of its kind. */
function watchFades(engine: SoundEngine): Fade[] {
  const fades: Fade[] = [];
  const original = Voice.prototype.fadeOut;
  const spy = vi.spyOn(Voice.prototype, "fadeOut").mockImplementation(function (
    this: Voice,
    now: number,
    seconds: number,
  ) {
    const others = voicesOf(engine, this.kind).filter(
      (voice) => voice !== this && !voice.fading,
    );
    fades.push({
      voice: this,
      now,
      seconds,
      oldest: others.every((voice) => voice.start >= this.start),
    });
    original.call(this, now, seconds);
  });
  disposers.push(() => spy.mockRestore());
  return fades;
}

/** The gain parameters a voice leaves by. */
function outParams(voice: Voice): FakeParam[] {
  return voice.outs.map((out) => out.gain as unknown as FakeParam);
}

let disposers: (() => void)[] = [];
afterEach(() => {
  for (const dispose of disposers.reverse()) dispose();
  disposers = [];
});

describe("sound engine: a player's results are never dropped as busy", () => {
  test("the result kinds are the career scene's result sounds", () => {
    expect([...RESULT_KINDS].sort()).toEqual(
      ["cheer", "groan", "net", "ooh", "score", "vuvuzela", "whistle"].sort(),
    );
    // each is limited at once, so each one's steal is the only way past the limit
    for (const kind of RESULT_KINDS) {
      expect(LIMITS.atOnce[kind], kind).toBeGreaterThan(0);
    }
    expect(LIMITS.resultFade).toBeGreaterThan(0);
    expect(LIMITS.resultFade).toBeLessThanOrEqual(0.5);
  });

  test("a fast run of goals with promotions plays every result's cues; the oldest of each kind fades and stops", () => {
    const { engine, ctx } = setup();
    const fades = watchFades(engine);
    const sent: Record<string, number> = {};
    const send = (cue: SoundCue) => {
      sent[cue.kind] = (sent[cue.kind] ?? 0) + 1;
      engine.play(cue);
    };
    // Seven goals 1.25 s apart (a real one takes 2.4 s to play, and the reveal and the
    // typing come between), each answered while the last one's crowd still rings: the
    // sting and its net, the cheer, the horns a moment later; after every other goal a
    // promotion's sweep, net and cheer.
    for (let goal = 0; goal < 7; goal++) {
      send({ kind: "score", shot: "worldie" });
      sent.net = (sent.net ?? 0) + 1; // the net under the sting
      send({ kind: "cheer", size: 1 });
      wait(engine, ctx(), 0.25);
      send({ kind: "vuvuzela", size: 1 });
      wait(engine, ctx(), 0.25);
      if (goal % 2 === 1) {
        send({ kind: "sweep" });
        wait(engine, ctx(), 0.25);
        send({ kind: "net" });
        send({ kind: "cheer", size: 0.45 });
        wait(engine, ctx(), 0.5);
      } else {
        wait(engine, ctx(), 0.75);
      }
    }
    const debug = engine.debug();
    for (const kind of ["score", "net", "cheer", "vuvuzela", "sweep"]) {
      expect(debug.played[kind] ?? 0, kind).toBe(sent[kind]);
    }
    expect(debug.dropped.busy).toBeUndefined();
    expect(
      debug.log.filter((entry) => entry.result === "dropped:busy"),
    ).toEqual([]);

    // The cheers and the horns outlast a goal: the oldest made room for each new one.
    expect(debug.faded.cheer).toBeGreaterThan(0);
    expect(debug.faded.vuvuzela).toBeGreaterThan(0);
    expect(fades.length).toBe(
      Object.values(debug.faded).reduce((a, b) => a + b, 0),
    );
    expect(debug.log.filter((entry) => entry.result === "faded").length).toBe(
      fades.length,
    );
    for (const fade of fades) {
      const { voice, now } = fade;
      const gone = now + LIMITS.resultFade;
      expect(RESULT_KINDS.has(voice.kind as never), voice.kind).toBe(true);
      expect(fade.oldest, voice.kind).toBe(true);
      expect(fade.seconds).toBe(LIMITS.resultFade);
      // a quick ramp from where it was to silence...
      expect(voice.outs.length).toBeGreaterThan(0);
      for (const param of outParams(voice)) {
        expect(param.events.slice(-3)).toEqual([
          ["cancel", now],
          ["set", expect.any(Number), now],
          ["linear", 0, gone],
        ]);
      }
      // ...then stopped and freed
      expect(voice.end).toBeLessThanOrEqual(gone + 1e-9);
      expect(voice.disposed).toBe(true);
    }
    // never more of a kind playing than its limit, not counting those fading out
    for (const kind of RESULT_KINDS) {
      const playing = voicesOf(engine, kind).filter((voice) => !voice.fading);
      expect(playing.length, kind).toBeLessThanOrEqual(
        LIMITS.atOnce[kind] ?? Infinity,
      );
    }
  });

  test("a faded voice's sources stop when its fade ends, never later than they would have", () => {
    const { engine, ctx } = setup();
    const fades = watchFades(engine);
    engine.play({ kind: "cheer", size: 1 });
    const sourcesOf = (voice: Voice) =>
      voice.sources as unknown as FakeSource[];
    const [first] = voicesOf(engine, "cheer");
    const before = sourcesOf(first).map((source) => source.stoppedAt ?? 0);
    wait(engine, ctx(), 0.5);
    engine.play({ kind: "cheer", size: 1 });
    wait(engine, ctx(), 0.5);
    expect(fades).toEqual([]);
    engine.play({ kind: "cheer", size: 1 });
    expect(fades.map((fade) => fade.voice)).toEqual([first]);
    const gone = ctx().currentTime + LIMITS.resultFade;
    sourcesOf(first).forEach((source, i) => {
      expect(source.stoppedAt).toBeLessThanOrEqual(Math.min(before[i], gone));
    });
    // the two newest play on untouched, at their own level
    const [second, third] = voicesOf(engine, "cheer").filter(
      (voice) => voice !== first,
    );
    for (const voice of [second, third]) {
      expect(voice.fading).toBe(false);
      for (const param of outParams(voice)) {
        expect(param.events.some((event) => event[0] === "linear")).toBe(false);
      }
    }
    expect(third.level).toBe(first.level);
    // freed at the first housekeeping after its fade
    expect(first.disposed).toBe(false);
    wait(engine, ctx(), 0.5);
    expect(first.disposed).toBe(true);
    expect(voicesOf(engine, "cheer")).not.toContain(first);
  });

  test("a run of misses and time ups plays every groan, ooh and whistle", () => {
    const { engine, ctx } = setup();
    const misses: SoundCue[] = [
      { kind: "groan" },
      { kind: "ooh" },
      { kind: "groan" },
      { kind: "whistle" },
      { kind: "ooh" },
      { kind: "groan" },
      { kind: "whistle" },
    ];
    for (const cue of misses) {
      engine.play({ kind: "score", shot: "miss" });
      engine.play(cue);
      wait(engine, ctx(), 0.5);
    }
    const debug = engine.debug();
    expect(debug.played).toMatchObject({
      score: 7,
      groan: 3,
      ooh: 2,
      whistle: 2,
    });
    expect(debug.dropped.busy).toBeUndefined();
  });

  test("a burst of anything else still drops as busy, as before", () => {
    const { engine, ctx } = setup();
    const fades = watchFades(engine);
    // just past each kind's gap, so only its number at once holds it back
    const bursts: [SoundCue, number][] = [
      [{ kind: "click" }, 0.0625],
      [{ kind: "squeak" }, 0.125],
      [{ kind: "firework" }, 0.125],
      [{ kind: "sweep" }, 0.125],
      [{ kind: "sparkle" }, 0.375],
    ];
    for (const [cue, step] of bursts) {
      const max = LIMITS.atOnce[cue.kind] ?? 0;
      const before = engine.debug();
      for (let i = 0; i < max + 3; i++) {
        engine.play(cue);
        ctx().advance(step);
      }
      const after = engine.debug();
      expect(after.played[cue.kind] ?? 0, cue.kind).toBe(
        (before.played[cue.kind] ?? 0) + max,
      );
      expect(after.dropped.busy ?? 0, cue.kind).toBe(
        (before.dropped.busy ?? 0) + 3,
      );
      wait(engine, ctx(), 10);
    }
    expect(fades).toEqual([]);
    expect(engine.debug().faded).toEqual({});
  });

  test("a result too soon after the same one (its gap) is still dropped: two results never come so close", () => {
    const { engine } = setup();
    engine.play({ kind: "score", shot: "golazo" });
    engine.play({ kind: "score", shot: "golazo" });
    expect(engine.debug().played.score).toBe(1);
    expect(engine.debug().dropped.busy).toBe(1);
  });
});
