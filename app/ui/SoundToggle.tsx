import { useSyncExternalStore } from "react";

import {
  isSoundMuted,
  isSoundMutedOnServer,
  setSoundMuted,
  soundEngine,
  subscribeSoundMuted,
} from "~/audio";

import { cx } from "./cx";
import { type Bitmap, PixelGlyph } from "./PixelGlyph";

export interface SoundToggleLabels {
  /** The switch's name for screen readers ("Sound"). */
  label: string;
  /** The tooltip while the sound is on, and while it is off. */
  on: string;
  off: string;
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
 * The sound switch: a square speaker button in the kit's steel. A real switch for screen
 * readers ("Sound, on"), with the state in its tooltip. The choice is remembered (in
 * localStorage, by `~/audio`); the build-time page and the first render show it on, and it
 * follows the storage once the page is running. Turning the sound on is a gesture, so the
 * engine may start its audio there and then.
 */
export function SoundToggle({ labels, className }: SoundToggleProps) {
  const muted = useSyncExternalStore(
    subscribeSoundMuted,
    isSoundMuted,
    isSoundMutedOnServer,
  );
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!muted}
      aria-label={labels.label}
      title={muted ? labels.off : labels.on}
      className={cx(
        "ss-btn ss-btn--icon ss-btn--secondary ss-sound",
        className,
      )}
      data-muted={muted ? "" : undefined}
      onClick={() => {
        const engine = soundEngine();
        setSoundMuted(!muted);
        // Turning it on is the gesture the engine may start its audio on.
        if (muted) engine?.unlock();
      }}
    >
      <span className="ss-btn__label">
        <PixelGlyph bitmap={muted ? SPEAKER_OFF : SPEAKER_ON} />
      </span>
    </button>
  );
}
