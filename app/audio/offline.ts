/**
 * Offline renders, for measuring: each voice and each bed rendered through the engine's own
 * buses and safety into an `OfflineAudioContext`, faster than real time, and measured.
 * Browser only (Node has no Web Audio). In development the page exposes these as
 * `window.__soccersenseSound.renderCue(cue)` and `.renderAmbience(ambience)`.
 *
 * Each takes `recorded` (default false: the synthesised voices alone, as the level tables
 * were measured): true plays the recordings in public/sounds where the game would, the
 * cue's own recording and the takes inside the voices and beds (the claps, the hum).
 */

import type { Ambience, SoundCue } from "~/scenes/scene";

import { AmbienceBed, type AmbientEvent, playAmbientEvent } from "./ambience";
import { Synth, type Takes, Voice, mulberry32 } from "./dsp";
import {
  LEVELS,
  bedExtras,
  buildCue,
  createGraph,
  recordingNames,
  takeOf,
} from "./engine";
import { type Place, TIER_PLACES, placeOf } from "./place";
import { builtRecordings } from "./recordings";
import { Wind } from "./wind";

export interface Measure {
  /** Length of the render, seconds. */
  seconds: number;
  /** The highest sample, and in dB below full scale. */
  peak: number;
  peakDb: number;
  /** The loudest 300 ms (RMS, dB): how loud it sounds at its loudest. */
  loudDb: number;
  /** RMS over the whole render, dB. */
  rmsDb: number;
  /** When it has died away (the last sample above -50 dB), seconds. */
  tail: number;
  /** Samples at or over full scale. */
  clipped: number;
}

const SAMPLE_RATE = 48000;

function db(value: number): number {
  return value > 0 ? Math.round(200 * Math.log10(value)) / 10 : -Infinity;
}

export function measure(buffer: AudioBuffer): Measure {
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) =>
    buffer.getChannelData(i),
  );
  const n = buffer.length;
  const window = Math.floor(buffer.sampleRate * 0.3);
  let peak = 0;
  let sum = 0;
  let clipped = 0;
  let last = 0;
  let loud = 0;
  let windowSum = 0;
  const squares = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let sq = 0;
    for (const data of channels) {
      const v = Math.abs(data[i]);
      if (v > peak) peak = v;
      if (v >= 1) clipped++;
      if (v > 0.00316) last = i;
      sq += data[i] * data[i];
    }
    sq /= channels.length;
    squares[i] = sq;
    sum += sq;
    windowSum += sq;
    if (i >= window) windowSum -= squares[i - window];
    if (i >= window - 1) loud = Math.max(loud, windowSum / window);
  }
  return {
    seconds: n / buffer.sampleRate,
    peak: Math.round(peak * 1000) / 1000,
    peakDb: db(peak),
    loudDb: db(Math.sqrt(Math.max(0, loud))),
    rmsDb: db(Math.sqrt(sum / Math.max(1, n))),
    tail: Math.round((last / buffer.sampleRate) * 100) / 100,
    clipped,
  };
}

/** The recordings of this build, decoded into `ctx`: every one, by name. */
async function decodeAll(
  ctx: BaseAudioContext,
): Promise<Map<string, AudioBuffer>> {
  const decoded = new Map<string, AudioBuffer>();
  await Promise.all(
    [...builtRecordings()].map(async ([name, url]) => {
      try {
        const bytes = await (await fetch(url)).arrayBuffer();
        decoded.set(name, await ctx.decodeAudioData(bytes));
      } catch {
        // Left out: the synthesised voice plays, as in the game.
      }
    }),
  );
  return decoded;
}

/** What a render plays besides the synthesised voices: nothing, or the recordings. */
interface Recorded {
  /** The recording for a cue at a place, as the engine picks it (a variant: its first). */
  cue: (cue: SoundCue, place: Place) => AudioBuffer | null;
  takes: Takes | null;
}

async function recordedFor(
  ctx: BaseAudioContext,
  recorded: boolean,
): Promise<Recorded> {
  if (!recorded) return { cue: () => null, takes: null };
  const decoded = await decodeAll(ctx);
  const find = (name: string) =>
    decoded.get(name) ?? decoded.get(`${name}-1`) ?? null;
  return {
    cue: (cue, place) => {
      for (const name of recordingNames(cue, place)) {
        const buffer = find(name);
        if (buffer) return buffer;
      }
      return null;
    },
    takes: (name) => {
      const buffer = find(name);
      return buffer ? takeOf(name, buffer) : null;
    },
  };
}

/**
 * Renders one cue as the engine plays it at `place` (the wind: two seconds of cues at 60 a
 * second).
 */
export async function renderCue(
  cue: SoundCue,
  seconds = 6,
  seed = 1,
  place: Place = "top",
  recorded = false,
): Promise<Measure> {
  const ctx = new OfflineAudioContext(
    2,
    Math.ceil(SAMPLE_RATE * seconds),
    SAMPLE_RATE,
  );
  const graph = createGraph(ctx);
  const extra = await recordedFor(ctx, recorded);
  if (cue.kind === "wind") {
    const trim = ctx.createGain();
    trim.gain.value = LEVELS.wind;
    trim.connect(graph.effects);
    const wind = new Wind(ctx, trim, mulberry32(seed));
    for (let t = 0; t < 2; t += 1 / 60) wind.push(cue.speed, t);
  } else {
    buildCue(
      ctx,
      graph,
      cue,
      0.01,
      mulberry32(seed),
      extra.cue(cue, place),
      place,
      1,
      extra.takes,
    );
  }
  return measure(await ctx.startRendering());
}

/**
 * Renders several cues together, each at its own time (seconds), over the bed of `place`
 * at a crowd of 1: the loudest moments of the game, to check that nothing clips.
 */
export async function renderMoment(
  cues: readonly (readonly [number, Exclude<SoundCue, { kind: "wind" }>])[],
  place: Place = "final",
  seconds = 6,
  seed = 1,
  recorded = false,
): Promise<Measure> {
  const ctx = new OfflineAudioContext(
    2,
    Math.ceil(SAMPLE_RATE * seconds),
    SAMPLE_RATE,
  );
  const graph = createGraph(ctx);
  const rand = mulberry32(seed);
  const tier = TIER_PLACES.indexOf(place);
  const extra = await recordedFor(ctx, recorded);
  const bed = new AmbienceBed(
    ctx,
    graph.ambience,
    graph.room,
    {
      venue: place === "town" ? "town" : "stadium",
      tier: tier >= 0 ? tier : undefined,
      crowd: 1,
      night: place === "final",
    },
    rand,
    null,
    1,
    bedExtras(place, extra.takes),
  );
  bed.schedule(seconds);
  for (const [at, cue] of cues) {
    buildCue(
      ctx,
      graph,
      cue,
      at,
      rand,
      extra.cue(cue, place),
      place,
      1,
      extra.takes,
    );
  }
  return measure(await ctx.startRendering());
}

/**
 * Renders a bed with every event it would start in that time (or, with `events` false, only
 * its continuous layers).
 */
export async function renderAmbience(
  ambience: Ambience,
  seconds = 30,
  seed = 1,
  events = true,
  recorded = false,
): Promise<Measure & { events: Record<string, number> }> {
  const ctx = new OfflineAudioContext(
    2,
    Math.ceil(SAMPLE_RATE * seconds),
    SAMPLE_RATE,
  );
  const graph = createGraph(ctx);
  const extra = await recordedFor(ctx, recorded);
  const bed = new AmbienceBed(
    ctx,
    graph.ambience,
    graph.room,
    ambience,
    mulberry32(seed),
    null,
    1,
    bedExtras(placeOf(ambience), extra.takes),
  );
  if (events) bed.schedule(seconds);
  const result = measure(await ctx.startRendering());
  return { ...result, events: { ...bed.started } };
}

/** Renders one kind of ambient event on its own, through the ambience bus. */
export async function renderAmbientEvent(
  name: AmbientEvent,
  seconds = 8,
  seed = 1,
  recorded = false,
): Promise<Measure> {
  const ctx = new OfflineAudioContext(
    2,
    Math.ceil(SAMPLE_RATE * seconds),
    SAMPLE_RATE,
  );
  const graph = createGraph(ctx);
  const voice = new Voice(name, 0);
  const extra = await recordedFor(ctx, recorded);
  const s = new Synth(ctx, voice, mulberry32(seed), extra.takes);
  playAmbientEvent(s, name, { dry: graph.ambience, wet: graph.room }, 0.05);
  return measure(await ctx.startRendering());
}
