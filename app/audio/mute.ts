/**
 * Sound on or off, remembered in localStorage. A tiny store for `useSyncExternalStore`:
 * the snapshot is a plain variable (sound on until the storage has been read), and the
 * storage is read the first time anyone subscribes or asks for it from an effect or a
 * handler, never during a render and never at build time. Another tab's change is
 * followed through the `storage` event.
 */

export const SOUND_KEY = "soccersense:v1:sound";

let muted = false;
let loaded = false;
const listeners = new Set<() => void>();

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function read(): boolean {
  try {
    return storage()?.getItem(SOUND_KEY) === "off";
  } catch {
    return false;
  }
}

function notify(): void {
  for (const listener of [...listeners]) listener();
}

/** Reads the storage once. Browser only: call it from an effect or a handler. */
export function loadSoundMuted(): boolean {
  if (!loaded) {
    loaded = true;
    muted = read();
  }
  return muted;
}

/** The snapshot: true when the player has turned the sound off. */
export function isSoundMuted(): boolean {
  return muted;
}

/** The snapshot at build time and while hydrating: sound on. */
export function isSoundMutedOnServer(): boolean {
  return false;
}

function onStorage(event: StorageEvent): void {
  if (event.key !== SOUND_KEY && event.key !== null) return;
  const next = read();
  if (next === muted) return;
  muted = next;
  notify();
}

export function subscribeSoundMuted(listener: () => void): () => void {
  const before = muted;
  loadSoundMuted();
  listeners.add(listener);
  if (listeners.size === 1 && typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }
  if (muted !== before) listener();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}

/** Turns the sound off (true) or on, and remembers it. */
export function setSoundMuted(on: boolean): void {
  loadSoundMuted();
  if (on === muted) return;
  muted = on;
  try {
    storage()?.setItem(SOUND_KEY, on ? "off" : "on");
  } catch {
    // Storage full or blocked: the choice holds for this page.
  }
  notify();
}

/** Tests only: forget what was read, as a new page would. */
export function resetSoundMutedForTests(): void {
  muted = false;
  loaded = false;
  listeners.clear();
  if (typeof window !== "undefined") {
    window.removeEventListener("storage", onStorage);
  }
}
