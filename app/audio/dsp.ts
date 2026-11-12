/**
 * The sound toolkit: noise, envelopes and a builder that keeps track of every node a sound
 * makes, so the engine can free it when it is over.
 *
 * Everything here works on a `BaseAudioContext`, so the same voices play live in an
 * `AudioContext` and render offline in an `OfflineAudioContext` (for measuring levels).
 * Nothing here runs at import: it is only called by the engine, in the browser, once it has
 * made a context.
 */

/** A seeded random source in [0, 1). The same seed gives the same sound. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- buffers made once per context ----------------------------------------------------------

const cache = new WeakMap<BaseAudioContext, Map<string, AudioBuffer>>();

/** A buffer made once per context and kept for its life. */
export function cachedBuffer(
  ctx: BaseAudioContext,
  key: string,
  make: () => AudioBuffer,
): AudioBuffer {
  let own = cache.get(ctx);
  if (!own) {
    own = new Map();
    cache.set(ctx, own);
  }
  let buffer = own.get(key);
  if (!buffer) {
    buffer = make();
    own.set(key, buffer);
  }
  return buffer;
}

/** Scales `data` so its RMS is `rms`. */
function normalise(data: Float32Array, rms: number): void {
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
  const now = Math.sqrt(sum / Math.max(1, data.length));
  if (now <= 0) return;
  const k = rms / now;
  for (let i = 0; i < data.length; i++) data[i] *= k;
}

export type NoiseColour = "white" | "pink" | "brown";

/**
 * Four seconds of noise, looped by whoever plays it, at an RMS of 0.25 whatever the colour:
 * white (hiss, slaps, clicks), pink (wind, crowds, the sweep: equal energy per octave),
 * brown (rumble, traffic, dust).
 */
export function noiseBuffer(
  ctx: BaseAudioContext,
  colour: NoiseColour,
): AudioBuffer {
  return cachedBuffer(ctx, `noise:${colour}`, () => {
    const n = Math.floor(ctx.sampleRate * 4);
    const buffer = ctx.createBuffer(1, n, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    const rand = mulberry32(
      colour === "white" ? 11 : colour === "pink" ? 23 : 37,
    );
    if (colour === "white") {
      for (let i = 0; i < n; i++) data[i] = rand() * 2 - 1;
    } else if (colour === "pink") {
      // Paul Kellet's filter: within half a decibel of pink across the audible range.
      let b0 = 0,
        b1 = 0,
        b2 = 0,
        b3 = 0,
        b4 = 0,
        b5 = 0,
        b6 = 0;
      for (let i = 0; i < n; i++) {
        const w = rand() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.016898;
        data[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
        b6 = w * 0.115926;
      }
    } else {
      let last = 0;
      for (let i = 0; i < n; i++) {
        last = (last + 0.02 * (rand() * 2 - 1)) / 1.02;
        data[i] = last;
      }
    }
    normalise(data, 0.25);
    return buffer;
  });
}

/**
 * A slow wandering control signal between 0 and 1 (smooth random steps `rate` times a
 * second), eight seconds long and looped: the life in a crowd's roar, the gusts in a breeze.
 */
export function flutterBuffer(
  ctx: BaseAudioContext,
  rate: number,
): AudioBuffer {
  const key = `flutter:${rate.toFixed(2)}`;
  return cachedBuffer(ctx, key, () => {
    // A control signal needs no detail: a low sample rate keeps it small.
    const sr = 3000;
    const seconds = 8;
    const n = sr * seconds;
    const buffer = ctx.createBuffer(1, n, sr);
    const data = buffer.getChannelData(0);
    const rand = mulberry32(Math.round(rate * 1000) + 5);
    const steps = Math.max(2, Math.round(seconds * rate));
    const points = Array.from({ length: steps }, () => rand());
    for (let i = 0; i < n; i++) {
      const at = (i / n) * steps;
      const k = Math.floor(at);
      const a = points[k % steps];
      const b = points[(k + 1) % steps];
      const f = (1 - Math.cos((at - k) * Math.PI)) / 2;
      data[i] = a + (b - a) * f;
    }
    return buffer;
  });
}

/**
 * Applause: six seconds of separate hand claps (short bursts of noise, each with its own
 * loudness and decay), `perSecond` a second on each of two channels. Played through a
 * band-pass filter it is a crowd clapping.
 */
export function clapsBuffer(
  ctx: BaseAudioContext,
  perSecond: number,
): AudioBuffer {
  return cachedBuffer(ctx, `claps:${perSecond}`, () => {
    const sr = ctx.sampleRate;
    const n = Math.floor(sr * 6);
    const buffer = ctx.createBuffer(2, n, sr);
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      const rand = mulberry32(101 + channel * 7 + perSecond);
      const count = Math.round(perSecond * 6);
      for (let k = 0; k < count; k++) {
        const start = Math.floor(rand() * n);
        const amp = 0.25 + 0.75 * rand() * rand();
        const tau = (0.003 + 0.005 * rand()) * sr;
        const len = Math.min(n - start, Math.floor(tau * 6));
        // A clap is two or three quick reflections of the same slap.
        const echo = Math.floor((0.0015 + 0.002 * rand()) * sr);
        for (let j = 0; j < len; j++) {
          const env =
            Math.exp(-j / tau) +
            0.5 * (j > echo ? Math.exp(-(j - echo) / tau) : 0);
          data[start + j] += (rand() * 2 - 1) * amp * env;
        }
      }
      normalise(data, 0.2);
      // Round off the loudest claps, so one hand is never a spike over the rest.
      for (let i = 0; i < n; i++) data[i] = 0.6 * Math.tanh(data[i] / 0.6);
    }
    return buffer;
  });
}

/**
 * Crackle: two seconds of tiny sharp clicks, thick at first and thinning out, the tail of a
 * firework bursting.
 */
export function crackleBuffer(ctx: BaseAudioContext): AudioBuffer {
  return cachedBuffer(ctx, "crackle", () => {
    const sr = ctx.sampleRate;
    const n = Math.floor(sr * 2);
    const buffer = ctx.createBuffer(2, n, sr);
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      const rand = mulberry32(211 + channel);
      for (let k = 0; k < 160; k++) {
        // Bunched towards the start.
        const start = Math.floor(rand() * rand() * n);
        const amp = (0.3 + 0.7 * rand()) * (1 - start / n);
        const tau = (0.0004 + 0.0012 * rand()) * sr;
        const len = Math.min(n - start, Math.floor(tau * 6));
        for (let j = 0; j < len; j++) {
          data[start + j] += (rand() * 2 - 1) * amp * Math.exp(-j / tau);
        }
      }
      normalise(data, 0.12);
    }
    return buffer;
  });
}

// --- a voice: one sound and every node it made --------------------------------------------------

/** Where a node's output goes: another node, a parameter it moves, or nowhere yet. */
export type Destination = AudioNode | AudioParam | null;

/** Connects a node to a node or to a parameter. */
export function link(node: AudioNode, dest: AudioNode | AudioParam): void {
  if ("connect" in dest) node.connect(dest);
  else node.connect(dest);
}

/** One sound in flight. The engine frees it (`dispose`) once `end` has passed. */
export class Voice {
  readonly nodes: AudioNode[] = [];
  readonly sources: AudioScheduledSourceNode[] = [];
  /** When each of `sources` is to stop (context time), in the same order. */
  readonly stops: number[] = [];
  /**
   * The gains it leaves by, into the buses (the engine's buildCue sets them): `fadeOut`
   * ramps these to silence. Nothing inside a voice automates them.
   */
  readonly outs: GainNode[] = [];
  /** Context time at which the last of its sources stops. */
  end: number;
  disposed = false;
  /** Fading out to make room (`fadeOut`): on its way, no longer counted as playing. */
  fading = false;
  /** Its gain into the effects bus as it started, where it has one (for the engine's log). */
  level?: number;

  constructor(
    readonly kind: string,
    readonly start: number,
  ) {
    this.end = start;
  }

  /** Stops every source now and disconnects every node. Safe to call twice. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const source of this.sources) {
      try {
        source.stop();
      } catch {
        // Already stopped, or never started: nothing to do.
      }
    }
    for (const node of this.nodes) {
      try {
        node.disconnect();
      } catch {
        // Already disconnected.
      }
    }
    this.nodes.length = 0;
    this.sources.length = 0;
    this.stops.length = 0;
  }

  /**
   * Goes quickly, to make room: its outputs (`outs`) ramp from where they are to silence
   * over `seconds` from `now`, every source still due to play past then stops then (never
   * later than it would have), and its `end` comes forward to then, so the engine frees it
   * at its next housekeeping. Safe to call twice.
   */
  fadeOut(now: number, seconds: number): void {
    if (this.disposed || this.fading) return;
    this.fading = true;
    const gone = now + Math.max(0, seconds);
    for (const out of this.outs) {
      const gain = out.gain;
      const from = gain.value;
      gain.cancelScheduledValues(now);
      gain.setValueAtTime(from, now);
      gain.linearRampToValueAtTime(0, gone);
    }
    this.sources.forEach((source, i) => {
      if (this.stops[i] <= gone) return;
      try {
        source.stop(gone);
        this.stops[i] = gone;
      } catch {
        // Already stopped: nothing to do.
      }
    });
    this.end = Math.min(this.end, gone);
  }
}

/**
 * A recorded take that a voice or a bed plays inside itself (the claps in a cheer, the World
 * Cup's hum), and the gain that brings it to the level the voice expects (engine.ts,
 * `TAKE_RMS_DB`), whatever level the file came at.
 */
export interface Take {
  buffer: AudioBuffer;
  gain: number;
  /**
   * Played as layers (the claps: one for a few mates, nine for a stand), each layer at
   * `gain` over the square root of their number, and `few` dB over their number besides
   * (0 for none): the fewer the layers, the quieter, as the synthesised claps are.
   */
  few: number;
}

/**
 * The recorded takes by name (`claps`, `vuvuzela-crowd`): the next one to play, or null
 * while it loads, if it failed, or if there is no file (the voice synthesises its own).
 */
export type Takes = (name: string) => Take | null;

/**
 * Builds a voice: every node made through it is written down in the voice, and every
 * source's stop time moves the voice's end. `takes` (when the engine has recordings) gives
 * the recorded takes a voice may play in place of a synthesised layer.
 */
export class Synth {
  constructor(
    readonly ctx: BaseAudioContext,
    readonly voice: Voice,
    readonly rand: () => number,
    readonly takes: Takes | null = null,
  ) {}

  /** The recorded take `name`, if there is one ready. */
  take(name: string): Take | null {
    return this.takes?.(name) ?? null;
  }

  /** A random number in [a, b). */
  rnd(a: number, b: number): number {
    return a + (b - a) * this.rand();
  }

  pick<T>(list: readonly T[]): T {
    return list[
      Math.min(list.length - 1, Math.floor(this.rand() * list.length))
    ];
  }

  private keep<T extends AudioNode>(node: T, dest: Destination): T {
    this.voice.nodes.push(node);
    if (dest) link(node, dest);
    return node;
  }

  private source<T extends AudioScheduledSourceNode>(
    node: T,
    start: number,
    stop: number,
  ): T {
    this.voice.sources.push(node);
    this.voice.stops.push(Math.max(start + 0.01, stop));
    node.start(Math.max(0, start));
    node.stop(Math.max(start + 0.01, stop));
    this.voice.end = Math.max(this.voice.end, stop);
    return node;
  }

  gain(value: number, dest: Destination): GainNode {
    const node = this.keep(this.ctx.createGain(), dest);
    node.gain.value = value;
    return node;
  }

  filter(
    type: BiquadFilterType,
    frequency: number,
    q: number,
    dest: Destination,
  ): BiquadFilterNode {
    const node = this.keep(this.ctx.createBiquadFilter(), dest);
    node.type = type;
    node.frequency.value = frequency;
    node.Q.value = q;
    return node;
  }

  /** A stereo position (-1 left to 1 right), or a plain pass-through where there is none. */
  pan(value: number, dest: Destination): StereoPannerNode | GainNode {
    if (typeof this.ctx.createStereoPanner !== "function") {
      return this.gain(1, dest);
    }
    const node = this.keep(this.ctx.createStereoPanner(), dest);
    node.pan.value = Math.max(-1, Math.min(1, value));
    return node;
  }

  osc(
    type: OscillatorType,
    frequency: number,
    dest: Destination,
    start: number,
    stop: number,
  ): OscillatorNode {
    const node = this.keep(this.ctx.createOscillator(), dest);
    node.type = type;
    node.frequency.value = frequency;
    return this.source(node, start, stop);
  }

  /** A buffer, looped or not, from a random place in it when looped. */
  buffer(
    buffer: AudioBuffer,
    dest: Destination,
    start: number,
    stop: number,
    { loop = true, rate = 1 }: { loop?: boolean; rate?: number } = {},
  ): AudioBufferSourceNode {
    const node = this.keep(this.ctx.createBufferSource(), dest);
    node.buffer = buffer;
    node.loop = loop;
    node.playbackRate.value = rate;
    const offset = loop ? this.rand() * buffer.duration : 0;
    this.voice.sources.push(node);
    this.voice.stops.push(Math.max(start + 0.01, stop));
    node.start(Math.max(0, start), offset);
    node.stop(Math.max(start + 0.01, stop));
    this.voice.end = Math.max(this.voice.end, stop);
    return node;
  }

  noise(
    colour: NoiseColour,
    dest: Destination,
    start: number,
    stop: number,
    rate = 1,
  ): AudioBufferSourceNode {
    return this.buffer(noiseBuffer(this.ctx, colour), dest, start, stop, {
      rate,
    });
  }

  /**
   * A wandering gain: `1 - depth` at least, 1 at most, wandering `rate` times a second.
   * Whatever goes through it comes alive.
   */
  flutter(
    rate: number,
    depth: number,
    dest: Destination,
    start: number,
    stop: number,
  ): GainNode {
    const node = this.gain(1 - depth, dest);
    const amount = this.gain(depth, node.gain);
    this.buffer(flutterBuffer(this.ctx, rate), amount, start, stop);
    return node;
  }
}

// --- envelopes ------------------------------------------------------------------------------------

/**
 * Up to `peak` in `attack` seconds, then an exponential fall with time constant `tau`.
 * Returns the time by which it is silent (seven time constants: under -60 dB).
 */
export function ad(
  param: AudioParam,
  start: number,
  attack: number,
  peak: number,
  tau: number,
): number {
  param.setValueAtTime(0, start);
  param.linearRampToValueAtTime(peak, start + attack);
  param.setTargetAtTime(0, start + attack, tau);
  return start + attack + tau * 7;
}

/** A straight-line curve through `[time after start, value]` points, from 0 at `start`. */
export function curve(
  param: AudioParam,
  start: number,
  points: readonly (readonly [number, number])[],
): number {
  param.setValueAtTime(0, start);
  let end = start;
  for (const [t, v] of points) {
    end = start + t;
    param.linearRampToValueAtTime(v, end);
  }
  return end;
}

/** An exponential glide of a frequency from `from` to `to` over `time` seconds. */
export function glide(
  param: AudioParam,
  start: number,
  from: number,
  to: number,
  time: number,
): void {
  param.setValueAtTime(from, start);
  param.exponentialRampToValueAtTime(Math.max(1, to), start + time);
}
