import { useState, useSyncExternalStore } from "react";

import { lightingFor, type Lighting } from "~/art/lighting";
import { moonPhase, type Sun } from "~/lib/sun";
import {
  type TimeOverride,
  parseTimeOverride,
  sunForDevice,
} from "~/lib/where";

/** The player's own sky, as the scenes need it. */
export interface DeviceSky {
  /** The sun the light was made for: elevation in half degrees, and morning or not. */
  sun: Sun;
  /** `lightingFor(sun)`: hand it to `PixelStage`. */
  light: Lighting;
  /** 0 new, 0.25 first quarter, 0.5 full, 0.75 last quarter, in steps of 0.01. */
  moonPhase: number;
}

/** How often the sky is worked out again. The sun moves a quarter of a degree a minute. */
const REFRESH_MS = 60_000;

/**
 * The sky for this device right now. Browser only: it reads the clock, the time zone and
 * the address bar (`?time=HH:MM` pins the clock, for looking at dusk at lunchtime).
 *
 * Returns `previous` itself when nothing has changed. The light is cached per half degree
 * of sun and the moon phase is rounded, so the sky is a new object every few minutes
 * while the sun climbs or sinks, and the very same object in between.
 */
function readDeviceSky(previous: DeviceSky | null): DeviceSky {
  const now = new Date();
  let override: TimeOverride | null = null;
  try {
    const time = new URLSearchParams(window.location.search).get("time");
    if (time !== null) override = parseTimeOverride(time);
  } catch {
    // No address to read: no override.
  }
  const light = lightingFor(sunForDevice(now, override));
  const phase = (Math.round(moonPhase(now) * 100) % 100) / 100;
  if (previous && previous.light === light && previous.moonPhase === phase) {
    return previous;
  }
  return { sun: light.sun, light, moonPhase: phase };
}

interface SkyStore {
  subscribe(onChange: () => void): () => void;
  read(): DeviceSky | null;
}

/** One per hook: nothing is worked out until React subscribes, which is after mounting. */
function createSkyStore(): SkyStore {
  let current: DeviceSky | null = null;
  return {
    subscribe(onChange) {
      const refresh = () => {
        const next = readDeviceSky(current);
        if (next === current) return;
        current = next;
        onChange();
      };
      // Only while someone is looking: a new light makes the page paint, and a scene can
      // take tens of milliseconds over one. A hidden tab catches up when it is shown.
      const whileVisible = () => {
        if (document.visibilityState !== "hidden") refresh();
      };
      const timer = window.setInterval(whileVisible, REFRESH_MS);
      document.addEventListener("visibilitychange", whileVisible);
      // The first value: React is told like any other change, and renders again with it.
      refresh();
      return () => {
        window.clearInterval(timer);
        document.removeEventListener("visibilitychange", whileVisible);
      };
    },
    read: () => current,
  };
}

function serverSky(): null {
  return null;
}

/**
 * The player's own sky: the sun for where their time zone says they are (no permission
 * prompt), the light that goes with it, and the moon's phase.
 *
 * `null` at build time and on the first render. After mounting it is worked out, then
 * again every minute while the tab is in view, and whenever it comes back into view. The
 * object keeps its identity while nothing has changed, so it is safe as an effect
 * dependency.
 */
export function useDeviceSky(): DeviceSky | null {
  const [store] = useState(createSkyStore);
  return useSyncExternalStore(store.subscribe, store.read, serverSky);
}
