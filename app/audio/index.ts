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
import { markSoundStarted } from "./started";

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
export {
  isSoundWaiting,
  isSoundWaitingOnServer,
  markSoundStarted,
  subscribeSoundWaiting,
} from "./started";
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
let stopPreparing: (() => void) | null = null;

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
    // The speaker stops showing the sound waiting (started.ts), but only once the press
    // that started it has been handled everywhere: a press on the speaker itself asks
    // whether the sound was still waiting when it came (SoundToggle).
    onStarted: () => {
      window.setTimeout(() => {
        if (shared === engine) markSoundStarted();
      }, 0);
    },
  });
  engine.attach(window, document);
  engine.setMuted(loadSoundMuted());
  unsubscribe = subscribeSoundMuted(() => engine.setMuted(isSoundMuted()));
  shared = engine;
  uninstallClicks = installClickSounds(document, (cue) => engine.play(cue));
  stopPreparing = prepareWhenIdle(engine);
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
 * The engine starts getting ready by itself this long after it is made (ms), if no pointer
 * has moved before: about when the ball has made its entrance. Getting ready holds the
 * main thread for a tenth of a second and more in all (the context alone 15 to 160 ms, in
 * one piece; about three times that on a slow phone). Begun at once, as it was until
 * 2026-11-19, that fell in the middle of the entrance. Much later is worse: a finger gives
 * no sign before it presses, and a press that comes before the engine is ready makes the
 * context in the press, about 0.3 s of the visit's first tap on a slow phone. (Five
 * seconds after the page had loaded was tried the same day: it took the work out of this
 * machine's Lighthouse run, but Google's own run never counted it, no task of it reaches
 * 50 ms there, and most first taps on a phone would have paid for it.)
 */
export const PREPARE_AFTER_MS = 2000;
/** A sign that somebody is there, before any press: the first one may not be far off. */
const PREPARE_SIGNS = ["pointermove", "wheel"] as const;

/**
 * Gets the engine ready (its context, graph and bed) one step per idle moment, so that the
 * first gesture only has to resume the context (see `SoundEngine.prepareStep`). Each step
 * waits for the browser to be idle, or at most two seconds. It starts at the first sign of
 * somebody there (a pointer moving), or PREPARE_AFTER_MS after the engine is made. A tab
 * that is out of view when a step is due (the engine makes nothing there) starts again,
 * the same way, when it is shown. Returns the undo.
 */
function prepareWhenIdle(engine: SoundEngine): () => void {
  const later = (fn: () => void) => {
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(fn, { timeout: 2000 });
    } else {
      window.setTimeout(fn, 200);
    }
  };
  let timer = 0;
  function disarm(): void {
    window.clearTimeout(timer);
    for (const sign of PREPARE_SIGNS) {
      window.removeEventListener(sign, begin, { capture: true });
    }
    document.removeEventListener("visibilitychange", shown);
  }
  function arm(): void {
    for (const sign of PREPARE_SIGNS) {
      window.addEventListener(sign, begin, { capture: true, passive: true });
    }
    timer = window.setTimeout(begin, PREPARE_AFTER_MS);
  }
  function begin(): void {
    disarm();
    later(step);
  }
  function step(): void {
    if (shared !== engine) return;
    if (document.visibilityState === "hidden") {
      // Nobody is looking: wait for the tab to be shown (its picture starts then, too).
      document.addEventListener("visibilitychange", shown);
      return;
    }
    if (engine.prepareStep()) later(step);
  }
  function shown(): void {
    if (document.visibilityState === "hidden") return;
    document.removeEventListener("visibilitychange", shown);
    arm();
  }
  arm();
  return disarm;
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
  stopPreparing?.();
  stopPreparing = null;
  shared?.dispose();
  shared = null;
}
