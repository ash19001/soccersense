import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const cues = vi.hoisted(() => [] as unknown[]);
vi.mock("~/audio", () => ({
  playCue: (cue: unknown) => cues.push(cue),
}));

import {
  ARRIVAL_PATIENCE_MS,
  BAYER,
  FADE_MS,
  FADE_STEPS,
  arrivingThroughFade,
  fadeArrived,
  fadeLevel,
  fadeThrough,
  inked,
  resetFadeForTests,
} from "./fade";

/** The levels drawn, in order: what the overlay showed, frame by frame. */
let drawn: number[] = [];

/** A browser with a 2D canvas (the test DOM has none) and frames on the fake clock. */
function browser({ reduced = false } = {}) {
  vi.useFakeTimers();
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: reduced })),
  );
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) =>
    window.setTimeout(() => cb(performance.now()), 16),
  );
  vi.stubGlobal("cancelAnimationFrame", (id: number) =>
    window.clearTimeout(id),
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    function (this: HTMLCanvasElement) {
      return {
        createImageData: (w: number, h: number) => ({
          data: new Uint8ClampedArray(w * h * 4),
          width: w,
          height: h,
        }),
        putImageData: (image: { data: Uint8ClampedArray }) => {
          let ink = 0;
          for (let i = 3; i < image.data.length; i += 4) {
            if (image.data[i] === 255) ink++;
          }
          drawn.push(Math.round((ink / (image.data.length / 4)) * 16));
        },
      } as unknown as CanvasRenderingContext2D;
    } as unknown as typeof HTMLCanvasElement.prototype.getContext,
  );
}

const overlay = () => document.querySelector<HTMLCanvasElement>(".ss-fade");

beforeEach(() => {
  cues.length = 0;
  drawn = [];
});

afterEach(() => {
  resetFadeForTests();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the dither", () => {
  test("each level inks that many cells of every 4 x 4 block", () => {
    for (let level = 0; level <= FADE_STEPS; level++) {
      let ink = 0;
      for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 4; x++) if (inked(x, y, level)) ink++;
      }
      expect(ink).toBe(level);
    }
    // An ordered dither: every value once.
    expect(BAYER.flat().sort((a, b) => a - b)).toEqual(
      Array.from({ length: 16 }, (_, i) => i),
    );
  });

  test("a cell inked at one level stays inked at every higher one", () => {
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        let was = false;
        for (let level = 0; level <= FADE_STEPS; level++) {
          const now = inked(x, y, level);
          if (was) expect(now).toBe(true);
          was = now;
        }
      }
    }
  });

  test("each half goes through the steps in order and ends exactly", () => {
    const out = [0, 0.1, 0.25, 0.5, 0.75, 0.99, 1].map((t) =>
      fadeLevel(t, "out"),
    );
    expect(out).toEqual([...out].sort((a, b) => a - b));
    expect(fadeLevel(0, "out")).toBe(0);
    expect(fadeLevel(1, "out")).toBe(FADE_STEPS);
    expect(fadeLevel(0, "in")).toBe(FADE_STEPS);
    expect(fadeLevel(1, "in")).toBe(0);
    expect(fadeLevel(2, "out")).toBe(FADE_STEPS);
    expect(fadeLevel(Number.NaN, "in")).toBe(0);
    // Whole steps only.
    for (let t = 0; t <= 1; t += 0.01) {
      expect(Number.isInteger(fadeLevel(t, "out"))).toBe(true);
    }
  });
});

describe("fadeThrough", () => {
  test("under reduced motion it simply goes", () => {
    browser({ reduced: true });
    const go = vi.fn();
    expect(fadeThrough(go)).toBe(true);
    expect(go).toHaveBeenCalledTimes(1);
    expect(overlay()).toBeNull();
    expect(cues).toEqual([]);
    expect(arrivingThroughFade()).toBe(false);
  });

  test("with no canvas it simply goes", () => {
    browser();
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null);
    const go = vi.fn();
    fadeThrough(go);
    expect(go).toHaveBeenCalledTimes(1);
    expect(overlay()).toBeNull();
  });

  test("the ink comes, the page changes under it, the ink goes once the page is up", () => {
    browser();
    const go = vi.fn();
    expect(fadeThrough(go)).toBe(true);
    expect(overlay()).not.toBeNull();
    expect(overlay()?.getAttribute("aria-hidden")).toBe("true");
    expect(cues).toEqual([{ kind: "transition", opening: false }]);
    // Not before the screen is all ink.
    vi.advanceTimersByTime(FADE_MS - 60);
    expect(go).not.toHaveBeenCalled();
    expect(arrivingThroughFade()).toBe(true);
    // A second press does nothing: no double fade.
    expect(fadeThrough(vi.fn())).toBe(false);
    vi.advanceTimersByTime(200);
    expect(go).toHaveBeenCalledTimes(1);
    expect(drawn.at(-1)).toBe(FADE_STEPS);
    // The ink coming: every step, never back.
    expect(drawn).toEqual([...drawn].sort((a, b) => a - b));
    expect(drawn.length).toBeGreaterThanOrEqual(FADE_STEPS);
    expect(arrivingThroughFade()).toBe(true);

    // The next page is up: two frames, then the ink goes, with the iris opening.
    drawn = [];
    fadeArrived();
    vi.advanceTimersByTime(40);
    expect(cues).toEqual([
      { kind: "transition", opening: false },
      { kind: "transition", opening: true },
    ]);
    expect(overlay()?.hasAttribute("data-leaving")).toBe(true);
    expect(arrivingThroughFade()).toBe(false);
    vi.advanceTimersByTime(FADE_MS + 100);
    expect(drawn.at(-1)).toBe(0);
    expect(drawn).toEqual([...drawn].sort((a, b) => b - a));
    expect(overlay()).toBeNull();
    // And it can be used again.
    expect(fadeThrough(vi.fn())).toBe(true);
  });

  test("the ink goes by itself if the next page never says it is up", () => {
    browser();
    fadeThrough(vi.fn());
    vi.advanceTimersByTime(FADE_MS + 50);
    expect(overlay()).not.toBeNull();
    vi.advanceTimersByTime(ARRIVAL_PATIENCE_MS);
    expect(overlay()?.hasAttribute("data-leaving")).toBe(true);
    vi.advanceTimersByTime(FADE_MS + 100);
    expect(overlay()).toBeNull();
  });

  test("a navigation that fails brings the page back at once", async () => {
    browser();
    fadeThrough(() => Promise.reject(new Error("no")));
    vi.advanceTimersByTime(FADE_MS + 50);
    await vi.advanceTimersByTimeAsync(0);
    expect(overlay()?.hasAttribute("data-leaving")).toBe(true);
    vi.advanceTimersByTime(FADE_MS + 100);
    expect(overlay()).toBeNull();
  });

  test("fadeArrived does nothing when no fade is waiting", () => {
    browser();
    fadeArrived();
    vi.advanceTimersByTime(100);
    expect(overlay()).toBeNull();
    expect(cues).toEqual([]);
  });

  test("the overlay covers the screen in whole interface pixels", () => {
    browser();
    vi.stubGlobal("innerWidth", 1366);
    vi.stubGlobal("innerHeight", 768);
    vi.stubGlobal("devicePixelRatio", 1);
    fadeThrough(vi.fn());
    vi.advanceTimersByTime(20);
    const canvas = overlay();
    // 3 device pixels an interface pixel at 1366 x 768: 456 x 256 of them.
    expect([canvas?.width, canvas?.height]).toEqual([456, 256]);
    expect(canvas?.style.width).toBe("1368px");
    expect(canvas?.style.height).toBe("768px");
  });
});
