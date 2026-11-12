/**
 * Sound (docs/AUDIO.md). Every sound is synthesised in the browser with the Web Audio API;
 * any of them can be replaced by a recording in public/sounds.
 *
 * Browser only: nothing here runs at import or at build time. `soundEngine()` makes the
 * page's one engine the first time it is asked for in the browser (PixelStage does, when it
 * gets a scene); the engine makes its AudioContext on the first user gesture. Making it also
 * installs the click of the buttons (`installClickSounds`).
 */

import type { SoundCue } from "~/scenes/scene";

import { SoundEngine } from "./engine";
import { isSoundMuted, loadSoundMuted, subscribeSoundMuted } from "./mute";
import { builtRecordings } from "./recordings";

export {
  BED_RMS_DB,
  LEVELS,
  PEAK_DB,
  SCORE_PEAK_DB,
  SoundEngine,
  recordingNames,
  type DropReason,
  type SoundDebug,
  type SoundEngineOptions,
  type SoundKind,
  type SoundLogEntry,
} from "./engine";
export {
  SOUND_KEY,
  isSoundMuted,
  isSoundMutedOnServer,
  loadSoundMuted,
  setSoundMuted,
  subscribeSoundMuted,
} from "./mute";
export { PLACES, TIER_PLACES, type Place, placeOf } from "./place";
export { recordingIndex } from "./recordings";

/** The development handle: `window.__soccersenseSound` (dev server only). */
export interface SoundDebugHandle {
  engine: SoundEngine;
  debug: SoundEngine["debug"];
  renderCue: typeof import("./offline").renderCue;
  renderMoment: typeof import("./offline").renderMoment;
  renderAmbience: typeof import("./offline").renderAmbience;
  renderAmbientEvent: typeof import("./offline").renderAmbientEvent;
}

declare global {
  interface Window {
    __soccersenseSound?: SoundDebugHandle;
  }
}

let shared: SoundEngine | null = null;
let unsubscribe: (() => void) | null = null;
let uninstallClicks: (() => void) | null = null;

/**
 * The page's sound engine, made on first use in the browser. Null at build time and where
 * the browser has no Web Audio.
 */
export function soundEngine(): SoundEngine | null {
  if (shared) return shared;
  if (typeof window === "undefined" || typeof document === "undefined") {
    return null;
  }
  const Context =
    window.AudioContext ??
    (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (typeof Context !== "function") return null;
  const engine = new SoundEngine({
    createContext: () => new Context({ latencyHint: "interactive" }),
    recordings: builtRecordings(),
  });
  engine.attach(window, document);
  engine.setMuted(loadSoundMuted());
  unsubscribe = subscribeSoundMuted(() => engine.setMuted(isSoundMuted()));
  shared = engine;
  uninstallClicks = installClickSounds(document, (cue) => engine.play(cue));
  prepareWhenIdle(engine);
  if (import.meta.env.DEV && import.meta.env.MODE !== "test") {
    void import("./offline").then(
      ({ renderCue, renderMoment, renderAmbience, renderAmbientEvent }) => {
        window.__soccersenseSound = {
          engine,
          debug: () => engine.debug(),
          renderCue,
          renderMoment,
          renderAmbience,
          renderAmbientEvent,
        };
      },
    );
  }
  return engine;
}

/**
 * Gets the engine ready (its context, graph and bed) one step per idle moment, so that the
 * first gesture only has to resume the context (see `SoundEngine.prepareStep`). Each step
 * waits for the browser to be idle, or at most two seconds.
 */
function prepareWhenIdle(engine: SoundEngine): void {
  const later = (fn: () => void) => {
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(fn, { timeout: 2000 });
    } else {
      window.setTimeout(fn, 200);
    }
  };
  const step = () => {
    if (shared === engine && engine.prepareStep()) later(step);
  };
  later(step);
}

/**
 * Plays a cue through the page's sound engine, for anyone who is not a scene (a scene calls
 * its `onSound`). It does nothing at build time, before the first gesture on the page, while
 * the sound is off and while the tab is hidden: those cues are dropped, never queued.
 */
export function playCue(cue: SoundCue): void {
  soundEngine()?.play(cue);
}

/** What counts as a button for the click (a link dressed as one included). */
const PRESSABLE = [
  "button",
  '[role="button"]',
  '[role="switch"]',
  '[role="tab"]',
  '[role="menuitem"]',
  "a.ss-btn",
  "summary",
  'input[type="button"]',
  'input[type="submit"]',
  'input[type="reset"]',
].join(",");

const CLICK: SoundCue = { kind: "click" };

/**
 * Plays `{ kind: "click" }` for every press of a button anywhere in `doc`, by mouse, finger
 * or keyboard (a press is a `click` event; Enter in a form presses its submit button). It
 * listens once on the document as the event bubbles out, so a button's own handler has run
 * first: switching the sound on is heard, switching it off is not. Disabled buttons do not
 * click; the canvas is not a button (its presses are the scenes' business). Returns the undo.
 */
export function installClickSounds(
  doc: Document,
  play: (cue: SoundCue) => void,
): () => void {
  const onClick = (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const pressed = target.closest(PRESSABLE);
    if (!pressed) return;
    if (pressed.matches(':disabled, [aria-disabled="true"]')) return;
    // The sound board's play buttons (/dev/sound): the sound is heard alone.
    if (pressed.closest("[data-no-click]")) return;
    play(CLICK);
  };
  doc.addEventListener("click", onClick);
  return () => doc.removeEventListener("click", onClick);
}

/** Tests only: dispose of the shared engine, so the next `soundEngine()` makes a new one. */
export function resetSoundEngineForTests(): void {
  unsubscribe?.();
  unsubscribe = null;
  uninstallClicks?.();
  uninstallClicks = null;
  shared?.dispose();
  shared = null;
}
