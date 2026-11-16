import { useEffect, useRef, useSyncExternalStore } from "react";

import {
  isSoundMuted,
  isSoundMutedOnServer,
  isSoundWaiting,
  isSoundWaitingOnServer,
  markSoundStarted,
  setSoundMuted,
  soundEngine,
  subscribeSoundMuted,
  subscribeSoundWaiting,
} from "~/audio";

import { cx } from "./cx";
import { type Bitmap, type GlyphLayer, PixelGlyph } from "./PixelGlyph";

export interface SoundToggleLabels {
  /** The switch's name for screen readers ("Sound"). */
  label: string;
  /** The tooltip while the sound is on, and while it is off. */
  on: string;
  off: string;
  /** The tooltip while it is on but the browser has not let it start yet. */
  waiting: string;
}

export interface SoundToggleProps {
  labels: SoundToggleLabels;
  className?: string;
}

/** A speaker with two waves: sound on. 9 x 9 like the kit's other icons. */
export const SPEAKER_ON: Bitmap = [
  "...#.....",
  "..##...#.",
  "####.#..#",
  "####..#.#",
  "####..#.#",
  "####..#.#",
  "####.#..#",
  "..##...#.",
  "...#.....",
];

/** The speaker crossed out: sound off. */
export const SPEAKER_OFF: Bitmap = [
  "...#.....",
  "..##.....",
  "####.....",
  "####.#..#",
  "####..##.",
  "####..##.",
  "####.#..#",
  "..##.....",
  "...#.....",
];

/**
 * The sound is on, and waiting for the page's first press: the speaker with its waves
 * ("w"), which blink on and off (ui.css). With reduced motion the waves are left out and
 * two dots ("o") stand where they will be.
 */
export const SPEAKER_WAITING: Bitmap = [
  "...#.....",
  "..##...w.",
  "####.w..w",
  "####..w.w",
  "####.owow",
  "####..w.w",
  "####.w..w",
  "..##...w.",
  "...#.....",
];

const WAITING_LAYERS: readonly GlyphLayer[] = [
  { char: "#" },
  { char: "w", className: "ss-sound__waves" },
  { char: "o", className: "ss-sound__dots" },
];

/**
 * The sound switch: a square speaker button in the kit's steel. A real switch for screen
 * readers ("Sound, on"), with the state in its tooltip. The choice is remembered (in
 * localStorage, by `~/audio`); the build-time page and the first render show it on, and it
 * follows the storage once the page is running. Turning the sound on is a gesture, so the
 * engine may start its audio there and then.
 *
 * Waiting. A browser keeps a page silent until its first press or key, on every load and
 * refresh, so a page just opened has its sound on and nothing to hear (the product owner,
 * 2026-11-16: "it appears the sound is unmuted by the symbol but no sound appears until we
 * mute and unmute"). Until the engine says the sound has started (`isSoundWaiting`), the
 * speaker's waves blink on and off and its tooltip says why. A press
 * anywhere starts the sound; and a press on the speaker itself while it waits starts it too
 * and leaves it on, where it used to switch it off (so that it took a second press to hear
 * anything). Only a press that begins once the sound has started switches it off.
 */
export function SoundToggle({ labels, className }: SoundToggleProps) {
  const muted = useSyncExternalStore(
    subscribeSoundMuted,
    isSoundMuted,
    isSoundMutedOnServer,
  );
  const held = useSyncExternalStore(
    subscribeSoundWaiting,
    isSoundWaiting,
    isSoundWaitingOnServer,
  );
  const waiting = held && !muted;
  /**
   * The press now on the button began while the sound was waiting. (Its click comes later,
   * and by then the same press has started the sound.)
   */
  const starts = useRef(false);
  useEffect(() => {
    // The engine says when the sound has started. Where there is no Web Audio there is
    // nothing to wait for.
    if (!soundEngine()) markSoundStarted();
  }, []);
  const begin = () => {
    starts.current = !isSoundMuted() && isSoundWaiting();
  };
  const drop = () => {
    starts.current = false;
  };
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!muted}
      aria-label={labels.label}
      title={muted ? labels.off : waiting ? labels.waiting : labels.on}
      className={cx(
        "ss-btn ss-btn--icon ss-btn--secondary ss-sound",
        className,
      )}
      data-muted={muted ? "" : undefined}
      data-waiting={waiting ? "" : undefined}
      onPointerDown={begin}
      onKeyDown={begin}
      onPointerCancel={drop}
      onBlur={drop}
      onClick={() => {
        const engine = soundEngine();
        const starting = !muted && (starts.current || isSoundWaiting());
        starts.current = false;
        if (starting) {
          // The press that starts the sound: it stays on.
          engine?.unlock();
          return;
        }
        setSoundMuted(!muted);
        // Turning it on is the gesture the engine may start its audio on.
        if (muted) engine?.unlock();
      }}
    >
      <span className="ss-btn__label">
        {waiting ? (
          <PixelGlyph
            bitmap={SPEAKER_WAITING}
            layers={WAITING_LAYERS}
            unit="ip"
          />
        ) : (
          <PixelGlyph bitmap={muted ? SPEAKER_OFF : SPEAKER_ON} unit="ip" />
        )}
      </span>
    </button>
  );
}
