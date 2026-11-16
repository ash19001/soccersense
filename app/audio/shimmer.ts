/**
 * The golden ball's shimmer: a quiet bed of glitter round the menu ball as the hand's
 * spinning nears the gold, and under a ball that is gold (the home page's easter egg). Like
 * the wind, it is one continuous voice that its cue keeps alive: every `shimmer` cue sets
 * how much of it is heard and schedules its own fade, which the next cue (a frame later)
 * cancels. When the cues stop (the ball is struck, the page is left) it dies away by itself
 * in about a second, and the engine frees it once it has been quiet for a while.
 *
 * It is a recording, looped (`shimmer.mp3`: tools/sounds.mjs); with no file at all, a high
 * hiss that swells and falls as the recording does. It comes in and goes slowly: a shimmer
 * that snapped on would be noticed, and this one is meant to be under everything.
 *
 * The take it is cut from is all between 6 and 9 kHz, which is squeaky to listen to for
 * long: the file is made at three quarters of its pitch and half its speed (tools/sounds.mjs:
 * 4.5 to 6.75 kHz, its swells three seconds apart), and played as it is.
 */

import { Synth, Voice } from "./dsp";
import { levelTo, loudness } from "./recordings";

/**
 * What the recording is levelled to (RMS), whatever level the file came at: the level of
 * the engine's own noise, so `SOUNDS.shimmer.level` means what the wind's does.
 */
const UNIT_RMS = 0.25;
/** It follows a new level with this time constant (seconds): never a jump. */
const RISE = 0.5;
/** Seconds it holds after a cue before it starts to fade, and the fade's time constant. */
const HOLD = 0.25;
const FALL = 0.45;
/** Seconds without a cue after which the engine frees it (the fade is long over). */
const IDLE = 4;
/** How long the sources are scheduled for. The engine frees the shimmer long before. */
const FOREVER = 3600;

export class Shimmer {
  readonly voice: Voice;
  private readonly level: GainNode;
  /** Context time of the last cue. */
  last = -Infinity;

  constructor(
    ctx: BaseAudioContext,
    out: AudioNode,
    rand: () => number,
    recorded: AudioBuffer | null = null,
  ) {
    const now = ctx.currentTime;
    this.voice = new Voice("shimmer", now);
    const s = new Synth(ctx, this.voice, rand);
    this.level = s.gain(0, out);
    if (recorded) {
      const even = s.gain(
        levelTo(loudness(recorded).rms, UNIT_RMS),
        this.level,
      );
      s.buffer(recorded, even, now, now + FOREVER);
      return;
    }
    // No file: white noise kept to the recording's band, swelling every three seconds.
    const swell = s.gain(0.7, this.level);
    s.osc("sine", 0.33, s.gain(0.3, swell.gain), now, now + FOREVER);
    const band = s.filter("bandpass", 6000, 1.2, swell);
    s.noise("white", s.filter("highpass", 3750, 0.7, band), now, now + FOREVER);
  }

  /** A cue: `level` (0 to 1) of the shimmer is heard now. */
  push(level: number, now: number): void {
    const v = Number.isFinite(level) ? Math.max(0, Math.min(1, level)) : 0;
    this.last = now;
    const gain = this.level.gain;
    gain.cancelScheduledValues(now);
    gain.setTargetAtTime(v, now, RISE);
    gain.setTargetAtTime(0, now + HOLD, FALL);
  }

  /** Quiet for long enough to be freed. */
  idle(now: number): boolean {
    return now - this.last > IDLE;
  }

  dispose(): void {
    this.voice.dispose();
  }
}
