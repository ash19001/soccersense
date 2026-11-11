import { act, render, renderHook } from "@testing-library/react";
import { StrictMode, useEffect } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { lightingFor } from "~/art/lighting";
import { moonPhase } from "~/lib/sun";
import { sunForDevice } from "~/lib/where";

import { type DeviceSky, useDeviceSky } from "./useDeviceSky";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/**
 * A moment to start the clock at: around midday UTC, and not within a few minutes of the
 * moon phase ticking over to its next hundredth (so "nothing changed" tests stay true).
 */
function safeStart(): Date {
  let at = Date.UTC(2026, 10, 11, 12, 0, 0);
  for (;;) {
    const hundredths = moonPhase(new Date(at)) * 100;
    const frac = hundredths - Math.floor(hundredths);
    if (Math.abs(frac - 0.5) > 0.1) return new Date(at);
    at += HOUR;
  }
}

function setSearch(search: string): void {
  window.history.replaceState(null, "", `/${search}`);
}

let visibility: DocumentVisibilityState;

function setVisibility(state: DocumentVisibilityState): void {
  visibility = state;
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

function advance(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

/** Every value the hook returned, render by render. */
function watch() {
  const seen: (DeviceSky | null)[] = [];
  const hook = renderHook(() => {
    const sky = useDeviceSky();
    seen.push(sky);
    return sky;
  });
  return { ...hook, seen };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(safeStart());
  visibility = "visible";
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => visibility,
  });
  setSearch("");
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  Reflect.deleteProperty(document, "visibilityState");
  setSearch("");
});

describe("useDeviceSky", () => {
  test("is null at build time", () => {
    let seen: DeviceSky | null | undefined;
    function Probe() {
      seen = useDeviceSky();
      return <p>{seen ? "sky" : "none"}</p>;
    }
    expect(renderToString(<Probe />)).toContain("none");
    expect(seen).toBeNull();
  });

  test("is null on the first render, then the sky for this device now", () => {
    const { result, seen } = watch();
    expect(seen[0]).toBeNull();
    expect(seen).toHaveLength(2);

    const now = new Date();
    const sky = result.current;
    expect(sky).not.toBeNull();
    expect(sky?.light).toBe(lightingFor(sunForDevice(now)));
    expect(sky?.sun).toBe(sky?.light.sun);
    expect(sky?.moonPhase).toBeCloseTo(moonPhase(now), 2);
    // Rounded to a hundredth, and never 1.
    expect(Number.isInteger(Math.round((sky?.moonPhase ?? 0) * 100))).toBe(
      true,
    );
    expect(sky?.moonPhase).toBeGreaterThanOrEqual(0);
    expect(sky?.moonPhase).toBeLessThan(1);
  });

  test("honours ?time=HH:MM", () => {
    setSearch("?time=12:00");
    const noon = watch().result.current;
    setSearch("?time=00:00");
    const midnight = watch().result.current;
    setSearch("?stadium=anfield&time=7:05");
    const early = watch().result.current;

    const now = new Date();
    expect(noon?.light).toBe(
      lightingFor(sunForDevice(now, { hours: 12, minutes: 0 })),
    );
    expect(midnight?.light).toBe(
      lightingFor(sunForDevice(now, { hours: 0, minutes: 0 })),
    );
    expect(early?.light).toBe(
      lightingFor(sunForDevice(now, { hours: 7, minutes: 5 })),
    );
    // Wherever the test machine thinks it is, noon is brighter than midnight.
    expect(noon?.sun.elevation).toBeGreaterThan(midnight?.sun.elevation ?? 99);
    expect(noon?.light).not.toBe(midnight?.light);
  });

  test("ignores a time that is not a time", () => {
    const plain = watch().result.current;
    for (const search of [
      "?time=25:00",
      "?time=noon",
      "?time=",
      "?time=12:60",
    ]) {
      setSearch(search);
      expect(watch().result.current?.light).toBe(plain?.light);
    }
  });

  test("a pinned clock stays pinned as the minutes pass", () => {
    setSearch("?time=18:30");
    const { result, seen } = watch();
    const first = result.current;
    advance(10 * MINUTE);
    expect(result.current).toBe(first);
    // Not even a render: the store says nothing when nothing changed.
    expect(seen).toHaveLength(2);
  });

  test("keeps its identity while nothing has changed", () => {
    const { result, seen, rerender } = watch();
    const first = result.current;
    rerender();
    rerender();
    expect(result.current).toBe(first);
    // A refresh a few seconds later finds the same half degree of sun.
    vi.setSystemTime(Date.now() + 5000);
    setVisibility("hidden");
    setVisibility("visible");
    expect(result.current).toBe(first);
    expect(seen).toHaveLength(4); // the two renders at mount and the two rerenders
  });

  test("an effect that depends on it runs once per sky, not once per render", () => {
    const effect = vi.fn();
    function Probe({ n }: { n: number }) {
      const sky = useDeviceSky();
      useEffect(() => {
        if (sky) effect(sky);
      }, [sky]);
      return <p>{n}</p>;
    }
    const { rerender } = render(<Probe n={1} />);
    rerender(<Probe n={2} />);
    rerender(<Probe n={3} />);
    expect(effect).toHaveBeenCalledTimes(1);
  });

  test("refreshes every minute", () => {
    const { result } = watch();
    const first = result.current;
    // The clock only moves with the timers here, so a change proves the interval ran.
    advance(3 * HOUR);
    const later = result.current;
    expect(later).not.toBe(first);
    expect(later?.light).toBe(lightingFor(sunForDevice(new Date())));
    expect(later?.sun.elevation).not.toBe(first?.sun.elevation);
  });

  test("refreshes when the tab becomes visible again, not when it is hidden", () => {
    const { result } = watch();
    const first = result.current;
    // Six hours pass with the timers frozen, as in a background tab.
    vi.setSystemTime(Date.now() + 6 * HOUR);
    setVisibility("hidden");
    expect(result.current).toBe(first);
    setVisibility("visible");
    expect(result.current).not.toBe(first);
    expect(result.current?.light).toBe(lightingFor(sunForDevice(new Date())));
  });

  test("a hidden tab works nothing out, however many minutes pass", () => {
    const { result, seen } = watch();
    const first = result.current;
    const renders = seen.length;
    setVisibility("hidden");
    // Three hours of the interval firing in the background: the sun has moved a long way.
    advance(3 * HOUR);
    expect(result.current).toBe(first);
    expect(seen).toHaveLength(renders);
    // It catches up the moment the tab is shown.
    setVisibility("visible");
    expect(result.current).not.toBe(first);
    expect(result.current?.light).toBe(lightingFor(sunForDevice(new Date())));
  });

  test("unmounting stops the timer and the listener", () => {
    const added = vi.spyOn(document, "addEventListener");
    const removed = vi.spyOn(document, "removeEventListener");
    const { unmount } = watch();
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    const count = (spy: typeof added) =>
      spy.mock.calls.filter(([type]) => type === "visibilitychange").length;
    expect(count(added)).toBe(1);
    expect(count(removed)).toBe(1);
  });

  test("strict mode leaves one timer, one listener and one sky", () => {
    const added = vi.spyOn(document, "addEventListener");
    const removed = vi.spyOn(document, "removeEventListener");
    const seen = new Set<DeviceSky>();
    function Probe() {
      const sky = useDeviceSky();
      if (sky) seen.add(sky);
      return null;
    }
    const { unmount } = render(
      <StrictMode>
        <Probe />
      </StrictMode>,
    );
    const live = () =>
      added.mock.calls.filter(([type]) => type === "visibilitychange").length -
      removed.mock.calls.filter(([type]) => type === "visibilitychange").length;
    expect(vi.getTimerCount()).toBe(1);
    expect(live()).toBe(1);
    expect(seen.size).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    expect(live()).toBe(0);
  });

  test("two components each get a sky, and they agree on the light", () => {
    const a = watch().result.current;
    const b = watch().result.current;
    expect(a?.light).toBe(b?.light);
    expect(a?.moonPhase).toBe(b?.moonPhase);
  });
});
