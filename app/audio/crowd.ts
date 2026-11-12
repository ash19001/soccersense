/**
 * People: the building blocks of every crowd sound, shared by the cheers and the ambience.
 *
 * - A roar is pink noise shaped by the formants of a vowel: thousands of voices at once
 *   blur into a breathy "aah" or "ohh", which is what a crowd sounds like from inside it.
 * - Voices are a few sawtooth "throats" with their own pitch, vibrato and timing, through
 *   the same formants: the separate yells you pick out of the roar.
 * - Applause is the recorded take of people clapping, layered for a bigger crowd, or until
 *   it has loaded a buffer of separate synthesised hand claps, filtered.
 * - Fans whistle with their fingers.
 * - A chant is a few dozen people singing a short tune, not quite together.
 */

import { type Destination, Synth, clapsBuffer, curve, link } from "./dsp";
import { CLAPS } from "./mix";

/** Where a sound goes: straight out (`dry`), and a little of it into the room (`wet`). */
export interface Mix {
  dry: AudioNode;
  wet: AudioNode | null;
}

/** Formants of a vowel: [frequency in Hz, relative level]. */
export type Vowel = readonly (readonly [number, number])[];

export const VOWELS = {
  ah: [
    [750, 1],
    [1150, 0.6],
    [2500, 0.25],
  ],
  eh: [
    [550, 1],
    [1750, 0.5],
    [2500, 0.25],
  ],
  oh: [
    [500, 1],
    [850, 0.55],
    [2450, 0.15],
  ],
  oo: [
    [330, 1],
    [800, 0.35],
    [2300, 0.1],
  ],
  ee: [
    [300, 1],
    [2250, 0.35],
    [3000, 0.2],
  ],
} as const satisfies Record<string, Vowel>;

/**
 * A formant filter bank: whatever goes into the returned node comes out of `dest` shaped
 * like `vowel`. `shift` moves every formant (children and women: about 1.15).
 */
export function formants(
  s: Synth,
  vowel: Vowel,
  q: number,
  dest: Destination,
  { shift = 1, makeup = 1 }: { shift?: number; makeup?: number } = {},
): GainNode {
  const input = s.gain(1, null);
  for (const [frequency, level] of vowel) {
    const band = s.filter(
      "bandpass",
      frequency * shift,
      q,
      s.gain(level * makeup, dest),
    );
    link(input, band);
  }
  return input;
}

export interface RoarOptions {
  vowel: Vowel;
  /** The formants' Q: about 2 for a huge blurred crowd, 4 for a few dozen people. */
  q?: number;
  /** Low-pass cut-off: lower is further away. */
  bright?: number;
  /** How the roar wanders: times a second, and how deep (0 to 1). */
  flutterRate?: number;
  flutterDepth?: number;
}

/**
 * A crowd roar from `start` to `stop`. Its loudness is the returned gain, which starts at 0:
 * the caller draws its envelope on `level.gain`. At a level of 1 its RMS is about 0.2.
 */
export function roar(
  s: Synth,
  mix: Mix,
  start: number,
  stop: number,
  {
    vowel,
    q = 2.5,
    bright = 3000,
    flutterRate = 3,
    flutterDepth = 0.35,
  }: RoarOptions,
): GainNode {
  const lowpass = s.filter("lowpass", bright, 0.5, null);
  const out = s.flutter(flutterRate, flutterDepth, mix.dry, start, stop);
  if (mix.wet) link(out, mix.wet);
  const level = s.gain(0, out);
  link(lowpass, level);
  const shaped = formants(s, vowel, q, lowpass, { makeup: 2.2 + q * 0.5 });
  // Two noises a little apart, so the roar has no single grain to it.
  const noise = s.noise("pink", shaped, start, stop, s.rnd(0.94, 1.06));
  // And a little of the plain noise for body under the vowel.
  link(noise, s.filter("lowpass", bright * 0.4, 0.5, s.gain(0.25, lowpass)));
  return level;
}

export interface VoicesOptions {
  count: number;
  /** Pitch range in Hz (men about 110 to 220, women and children 200 to 450). */
  low: number;
  high: number;
  /** Each voice's pitch over its length: [fraction of the length, ratio to its pitch]. */
  contour: readonly (readonly [number, number])[];
  /** Each voice's length range in seconds. */
  length: readonly [number, number];
  /** The voices start this far apart at most. */
  spread: number;
  attack?: number;
  release?: number;
  /** Each voice's peak level (several together add up). */
  level: number;
  vowel: Vowel;
  q?: number;
  bright?: number;
  shift?: number;
}

/**
 * Separate voices yelling or groaning together. Returns the time the last one ends.
 */
export function voices(
  s: Synth,
  mix: Mix,
  start: number,
  {
    count,
    low,
    high,
    contour,
    length,
    spread,
    attack = 0.08,
    release = 0.3,
    level,
    vowel,
    q = 5,
    bright = 2800,
    shift = 1,
  }: VoicesOptions,
): number {
  const lowpass = s.filter("lowpass", bright, 0.6, mix.dry);
  if (mix.wet) link(lowpass, mix.wet);
  const bank = formants(s, vowel, q, lowpass, { shift, makeup: 1.6 });
  let end = start;
  for (let i = 0; i < count; i++) {
    const t = start + s.rnd(0, spread);
    const len = s.rnd(length[0], length[1]);
    const pitch = s.rnd(low, high);
    const env = s.gain(0, bank);
    const throat = s.osc("sawtooth", pitch, env, t, t + len + 0.05);
    throat.frequency.setValueAtTime(pitch * (contour[0]?.[1] ?? 1), t);
    for (const [at, ratio] of contour) {
      throat.frequency.linearRampToValueAtTime(pitch * ratio, t + at * len);
    }
    // Vibrato, a little different in every throat.
    const wobble = s.gain(pitch * s.rnd(0.008, 0.02), throat.frequency);
    s.osc("sine", s.rnd(4.5, 7), wobble, t, t + len + 0.05);
    const peak = level * s.rnd(0.6, 1);
    const a = Math.min(attack * s.rnd(0.7, 1.4), len * 0.4);
    const r = Math.min(release * s.rnd(0.7, 1.3), len * 0.6);
    curve(env.gain, t, [
      [a, peak],
      [len - r, peak * s.rnd(0.7, 1)],
      [len, 0],
    ]);
    end = Math.max(end, t + len + 0.05);
  }
  return end;
}

/** The recorded take of people clapping (public/sounds/claps.mp3), when there is one. */
export const CLAPS_TAKE = "claps";

/**
 * Applause from `start`: `perSecond` claps a second on each side (45 a whole stand, 14 a
 * few dozen hands, 6 a few mates). The envelope is `points` ([seconds after start, level]),
 * ending at 0.
 *
 * Recorded once the claps' take has loaded: as many layers of it as there are people (one
 * for a few mates, nine for a whole stand), each from its own place in the loop, a little
 * faster or slower and somewhere else across the stand, so it never sounds like a loop; at
 * the loudness of the synthesised claps, which play while it loads or if it is missing.
 */
export function applause(
  s: Synth,
  mix: Mix,
  start: number,
  points: readonly (readonly [number, number])[],
  perSecond: number,
): number {
  const env = s.gain(0, mix.dry);
  if (mix.wet) link(env, mix.wet);
  const end = curve(env.gain, start, points);
  const take = s.take(CLAPS_TAKE);
  if (take) {
    // The recorded take is a few people clapping, about ten claps a second in all: one
    // layer of it stands for CLAPS.perLayer (5) a second on each side (mix.ts).
    const layers = Math.max(
      1,
      Math.min(CLAPS.mostLayers, Math.round(perSecond / CLAPS.perLayer)),
    );
    // Uncorrelated layers add up in power: the same loudness however many there are, but
    // for the few-hands correction (`Take.few`).
    const each =
      (take.gain / Math.sqrt(layers)) * 10 ** (take.few / layers / 20);
    for (let i = 0; i < layers; i++) {
      const across =
        layers === 1 ? s.rnd(-0.3, 0.3) : -0.7 + (1.4 * i) / (layers - 1);
      const out = s.gain(each, s.pan(across + s.rnd(-0.1, 0.1), env));
      // Looped from a random place in it (see `Synth.buffer`).
      s.buffer(take.buffer, out, start, end + 0.05, {
        rate: s.rnd(0.96, 1.04),
      });
    }
    return end + 0.05;
  }
  const highpass = s.filter("highpass", 500, 0.5, env);
  const band = s.filter("bandpass", s.rnd(1300, 1700), 0.6, highpass);
  const claps = clapsBuffer(s.ctx, Math.max(1, Math.round(perSecond)));
  s.buffer(claps, band, start, end + 0.05, {
    rate: s.rnd(0.95, 1.05),
  });
  return end + 0.05;
}

/**
 * One fan whistling through their fingers: a wolf whistle (up, then up and down) or one
 * long note. Returns when it ends.
 */
export function fanWhistle(
  s: Synth,
  mix: Mix,
  start: number,
  level: number,
): number {
  const pan = s.pan(s.rnd(-0.8, 0.8), mix.dry);
  if (mix.wet) link(pan, mix.wet);
  const env = s.gain(0, s.filter("lowpass", 4500, 0.5, pan));
  if (s.rand() < 0.5) {
    // Wolf whistle.
    const f = s.rnd(0.9, 1.1);
    const tone = s.osc("sine", 1200 * f, env, start, start + 0.85);
    const p = tone.frequency;
    p.setValueAtTime(1200 * f, start);
    p.exponentialRampToValueAtTime(2700 * f, start + 0.17);
    p.setValueAtTime(1500 * f, start + 0.3);
    p.exponentialRampToValueAtTime(3000 * f, start + 0.42);
    p.exponentialRampToValueAtTime(1300 * f, start + 0.8);
    curve(env.gain, start, [
      [0.03, level],
      [0.16, level],
      [0.2, 0],
      [0.3, 0],
      [0.33, level],
      [0.7, level * 0.8],
      [0.82, 0],
    ]);
    return start + 0.85;
  }
  const f = s.rnd(2500, 3200);
  const len = s.rnd(0.5, 1);
  const tone = s.osc("sine", f, env, start, start + len + 0.05);
  tone.frequency.setValueAtTime(f * 0.88, start);
  tone.frequency.exponentialRampToValueAtTime(f, start + 0.06);
  s.osc("sine", 5.5, s.gain(f * 0.012, tone.frequency), start, start + len);
  curve(env.gain, start, [
    [0.03, level],
    [len - 0.08, level * 0.85],
    [len, 0],
  ]);
  return start + len + 0.05;
}

/** Tunes for a chant, as [semitones from the root, beats]. Short, simple, our own. */
const TUNES: readonly (readonly (readonly [number, number])[])[] = [
  [
    [0, 1],
    [4, 1],
    [7, 2],
    [4, 1],
    [0, 3],
  ],
  [
    [0, 0.5],
    [2, 0.5],
    [4, 1],
    [4, 1],
    [5, 0.5],
    [4, 0.5],
    [2, 2],
  ],
  [
    [7, 1],
    [7, 1],
    [4, 1],
    [5, 1],
    [7, 2],
    [0, 2],
  ],
  [
    [0, 1],
    [0, 1],
    [-3, 1],
    [-3, 1],
    [0, 1],
    [2, 1],
    [0, 2],
  ],
];

/**
 * A stand singing a short tune, a little ragged, from `start`. Returns when it ends.
 */
export function chant(
  s: Synth,
  mix: Mix,
  start: number,
  level: number,
  { singers = 10, bright = 1600 }: { singers?: number; bright?: number } = {},
): number {
  const tune = s.pick(TUNES);
  const beat = s.rnd(0.36, 0.46);
  const root = s.rnd(140, 190);
  const vowel = s.pick([VOWELS.oh, VOWELS.ah]);
  const lowpass = s.filter("lowpass", bright, 0.6, mix.dry);
  if (mix.wet) link(lowpass, mix.wet);
  const bank = formants(s, vowel, 4, lowpass, { makeup: 1.6 });
  const total = tune.reduce((sum, [, beats]) => sum + beats, 0) * beat;
  const end = start + total + 0.4;
  for (let i = 0; i < singers; i++) {
    const octave = s.rand() < 0.2 ? 2 : 1;
    const out = s.gain(0, bank);
    const throat = s.osc("sawtooth", root, out, start, end);
    s.osc(
      "sine",
      s.rnd(4.5, 6.5),
      s.gain(root * 0.012, throat.frequency),
      start,
      end,
    );
    const late = s.rnd(-0.04, 0.06);
    const sharp = 2 ** (s.rnd(-25, 25) / 1200);
    const peak = level * s.rnd(0.6, 1);
    let t = start + Math.max(0, late);
    out.gain.setValueAtTime(0, start);
    for (const [step, beats] of tune) {
      const f = root * octave * sharp * 2 ** (step / 12);
      const len = beats * beat;
      // Nobody in a crowd is quite on the beat.
      const at = Math.max(start, t + s.rnd(-0.015, 0.03));
      throat.frequency.setTargetAtTime(f, at, 0.025);
      out.gain.setTargetAtTime(peak, at, 0.03);
      out.gain.setTargetAtTime(peak * 0.45, at + len * 0.8, 0.04);
      t += len;
    }
    out.gain.setTargetAtTime(0, t, 0.08);
  }
  return end;
}
