/**
 * The birds in the background beds. The long trill that slid down in pitch is gone: the
 * product owner heard it as something falling (2026-11-12). What is left is a run of quick
 * chirps or two slow whistled notes.
 */
import { describe, expect, test } from "vitest";

import { playAmbientEvent } from "./ambience";
import { Synth, Voice, mulberry32 } from "./dsp";
import { FakeAudioContext, FakeOscillator } from "./testing";

/** Every oscillator one bird made, for one seed. */
function birdOscillators(seed: number): FakeOscillator[] {
  const ctx = new FakeAudioContext();
  const dry = ctx.createGain() as unknown as AudioNode;
  const s = new Synth(ctx.asContext(), new Voice("bird", 0), mulberry32(seed));
  playAmbientEvent(s, "bird", { dry, wet: null }, 0);
  return ctx.nodes.filter(
    (node): node is FakeOscillator => node instanceof FakeOscillator,
  );
}

/** The longest stretch, in seconds, over which a tone's pitch glides down. */
function longestFall(osc: FakeOscillator): number {
  let longest = 0;
  const events = osc.frequency.events;
  for (let i = 1; i < events.length; i++) {
    const [, from, start] = events[i - 1];
    const [kind, to, end] = events[i];
    if ((kind === "exponential" || kind === "linear") && to < from) {
      longest = Math.max(longest, end - start);
    }
  }
  return longest;
}

const SEEDS = Array.from({ length: 400 }, (_, i) => i + 1);

describe("birds", () => {
  test("never a long trill: no fluttering square wave, no tone longer than a third of a second", () => {
    for (const seed of SEEDS) {
      for (const osc of birdOscillators(seed)) {
        expect(osc.type, `seed ${seed}`).not.toBe("square");
        const length = (osc.stoppedAt ?? 0) - (osc.startedAt ?? 0);
        expect(length, `seed ${seed}`).toBeLessThanOrEqual(0.35);
      }
    }
  });

  test("no tone slides down for longer than a quick chirp", () => {
    for (const seed of SEEDS) {
      for (const osc of birdOscillators(seed)) {
        expect(longestFall(osc), `seed ${seed}`).toBeLessThanOrEqual(0.08);
      }
    }
  });

  test("both kinds that are left still sing: runs of chirps and pairs of whistled notes", () => {
    let chirps = 0;
    let pairs = 0;
    for (const seed of SEEDS) {
      const tones = birdOscillators(seed).filter(
        (osc) => osc.frequency.value > 1000,
      );
      if (tones.length >= 3) chirps++;
      else if (tones.length === 2) pairs++;
    }
    // 70% chirps and 30% pairs, give or take what 400 birds show
    expect(chirps / SEEDS.length).toBeGreaterThan(0.6);
    expect(pairs / SEEDS.length).toBeGreaterThan(0.2);
    expect(chirps + pairs).toBe(SEEDS.length);
  });
});
