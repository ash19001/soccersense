/**
 * Has the sound started on this page? A browser keeps a page silent until its first gesture
 * (a press or a key), on every load and every refresh, whatever the page asks for
 * (docs/AUDIO.md). Until then the sound is on only in name, and the speaker says so
 * (SoundToggle: it shows the sound waiting, and a press on it starts the sound rather than
 * switching it off).
 *
 * A tiny store for `useSyncExternalStore`, as mute.ts is. Waiting from the start, and at
 * build time; started once the engine's context is running after a gesture
 * (`markSoundStarted`, from `soundEngine()` in index.ts). It never goes back: a page that
 * has been heard once is not held again.
 */

let started = false;
const listeners = new Set<() => void>();

/** The snapshot: true until the sound has started on this page. */
export function isSoundWaiting(): boolean {
  return !started;
}

/** The snapshot at build time and while hydrating: no gesture yet, so waiting. */
export function isSoundWaitingOnServer(): boolean {
  return true;
}

export function subscribeSoundWaiting(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The sound has started (or there is none to wait for). Said once; later calls do nothing. */
export function markSoundStarted(): void {
  if (started) return;
  started = true;
  for (const listener of [...listeners]) listener();
}

/** Tests only: a new page, not heard yet. */
export function resetSoundStartedForTests(): void {
  started = false;
  listeners.clear();
}
