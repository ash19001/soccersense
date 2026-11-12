/**
 * Wind: the rush of air past something spinning or flying. It is one continuous voice that
 * the `wind` cue keeps alive: every cue sets its loudness and brightness from `speed`, and
 * schedules its own fade, which the next cue (a frame later) cancels. When the cues stop,
 * the wind dies away by itself within a quarter of a second, and the engine frees it once
 * it has been quiet for a while.
 */

import { Synth, Voice } from "./dsp";
import { levelTo, loudness } from "./recordings";

/** Loudness at full speed, before the engine's level for the kind. */
const FULL = 1;
/** Seconds the wind holds after a cue before it starts to fade. */
const HOLD = 0.12;
/** How long the sources are scheduled for. The engine frees the wind long before. */
const FOREVER = 3600;

export class Wind {
  readonly voice: Voice;
  private readonly level: GainNode;
  private readonly band: BiquadFilterNode;
  private readonly whistle: GainNode;
  private readonly whistleBand: BiquadFilterNode;
  private readonly lfo: OscillatorNode;
  /** Context time of the last cue. */
  last = -Infinity;

  constructor(
    ctx: BaseAudioContext,
    out: AudioNode,
    rand: () => number,
    recorded: AudioBuffer | null = null,
  ) {
    const now = ctx.currentTime;
    this.voice = new Voice("wind", now);
    const s = new Synth(ctx, this.voice, rand);
    this.level = s.gain(0, out);
    // A spinning ball comes round again and again: the rush beats with its turns.
    const beat = s.gain(0.75, this.level);
    this.lfo = s.osc("sine", 3, s.gain(0.25, beat.gain), now, now + FOREVER);
    this.band = s.filter("bandpass", 600, 0.8, beat);
    // At speed a narrower band sings over the rush.
    this.whistle = s.gain(0, beat);
    this.whistleBand = s.filter("bandpass", 1500, 5, this.whistle);
    const highpass = s.filter("highpass", 180, 0.6, this.band);
    highpass.connect(this.whistleBand);
    if (recorded) {
      // Levelled to the noise it stands in for (RMS 0.25), whatever level the file came at.
      const even = s.gain(levelTo(loudness(recorded).rms, 0.25), highpass);
      s.buffer(recorded, even, now, now + FOREVER);
    } else {
      s.noise("pink", highpass, now, now + FOREVER);
    }
  }

  /** A cue: the wind is at `speed` (0 to 1) now. */
  push(speed: number, now: number): void {
    const v = Number.isFinite(speed) ? Math.max(0, Math.min(1, speed)) : 0;
    this.last = now;
    const loud = FULL * v ** 1.2;
    const gain = this.level.gain;
    gain.cancelScheduledValues(now);
    gain.setTargetAtTime(loud, now, 0.05);
    gain.setTargetAtTime(0, now + HOLD, 0.08);
    this.band.frequency.setTargetAtTime(450 + 2600 * v ** 1.3, now, 0.08);
    this.whistleBand.frequency.setTargetAtTime(900 + 2400 * v, now, 0.1);
    this.whistle.gain.setTargetAtTime(0.6 * v * v, now, 0.1);
    this.lfo.frequency.setTargetAtTime(2 + 9 * v, now, 0.1);
  }

  /** Quiet for long enough to be freed. */
  idle(now: number): boolean {
    return now - this.last > 1.5;
  }

  dispose(): void {
    this.voice.dispose();
  }
}
