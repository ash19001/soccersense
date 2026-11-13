import { act, fireEvent, render } from "@testing-library/react";
import { type ReactNode, StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { lightingFor, type Lighting } from "~/art/lighting";
import { resetSoundEngineForTests, soundEngine } from "~/audio";
import { resetSoundMutedForTests } from "~/audio/mute";
import { FakeAudioContext } from "~/audio/testing";
import type { Surface } from "~/pixel";
import type { Ambience, PointerInfo, Scene, SoundCue } from "~/scenes/scene";

import { PixelRoot } from "./PixelRoot";
import { PixelStage, type PixelStageProps } from "./PixelStage";
import { PixelScaleContext, pixelScale, type PixelScale } from "./scale";

// --- the browser the host expects, faked -------------------------------------------------------

/** Animation frames that only run when the test says so. */
class Frames {
  private next = 1;
  readonly pending = new Map<number, FrameRequestCallback>();
  request = (callback: FrameRequestCallback): number => {
    const id = this.next++;
    this.pending.set(id, callback);
    return id;
  };
  cancel = (id: number): void => {
    this.pending.delete(id);
  };
  /** Run every frame that is waiting, as the browser would at time `now` (ms). */
  step(now: number): void {
    const due = [...this.pending.values()];
    this.pending.clear();
    act(() => {
      for (const callback of due) callback(now);
    });
  }
}

class FakeImageData {
  constructor(
    readonly data: Uint8ClampedArray,
    readonly width: number,
    readonly height: number,
  ) {}
}

interface FakeContext {
  putImageData: ReturnType<typeof vi.fn>;
  clearRect: ReturnType<typeof vi.fn>;
}

/** A `(prefers-reduced-motion: reduce)` query the test can flip. */
class FakeMedia {
  matches = false;
  readonly listeners = new Set<(event: MediaQueryListEvent) => void>();
  addEventListener = (
    _type: string,
    listener: (event: MediaQueryListEvent) => void,
  ) => {
    this.listeners.add(listener);
  };
  removeEventListener = (
    _type: string,
    listener: (event: MediaQueryListEvent) => void,
  ) => {
    this.listeners.delete(listener);
  };
  set(matches: boolean): void {
    this.matches = matches;
    act(() => {
      for (const listener of [...this.listeners]) {
        listener({ matches } as MediaQueryListEvent);
      }
    });
  }
}

let frames: Frames;
let context: FakeContext | null;
let media: FakeMedia;
let visibility: DocumentVisibilityState;

function setVisibility(state: DocumentVisibilityState): void {
  visibility = state;
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

beforeEach(() => {
  frames = new Frames();
  context = { putImageData: vi.fn(), clearRect: vi.fn() };
  media = new FakeMedia();
  visibility = "visible";
  vi.stubGlobal("requestAnimationFrame", frames.request);
  vi.stubGlobal("cancelAnimationFrame", frames.cancel);
  vi.stubGlobal("ImageData", FakeImageData);
  vi.stubGlobal("matchMedia", () => media);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () => context as unknown as CanvasRenderingContext2D,
  );
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => visibility,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Reflect.deleteProperty(document, "visibilityState");
});

// --- a scene that writes down what it is told ----------------------------------------------------

class Recorder implements Scene {
  readonly calls: string[] = [];
  readonly pointers: PointerInfo[] = [];
  readonly surfaces: Surface[] = [];
  cursorNow: "default" | "pointer" = "default";
  constructor(readonly name = "scene") {}
  resize(w: number, h: number): void {
    this.calls.push(`resize ${w}x${h}`);
  }
  setLighting(light: Lighting): void {
    this.calls.push(`light ${light.phase}`);
  }
  setReducedMotion(on: boolean): void {
    this.calls.push(`reduced ${on}`);
  }
  update(dt: number): void {
    this.calls.push(`update ${Number(dt.toFixed(4))}`);
  }
  draw(s: Surface): void {
    this.calls.push(`draw ${s.w}x${s.h}`);
    this.surfaces.push(s);
  }
  pointer(p: PointerInfo): void {
    this.pointers.push(p);
  }
  cursor(): "default" | "pointer" {
    return this.cursorNow;
  }
  /** The calls since the last time this was asked. */
  take(): string[] {
    return this.calls.splice(0);
  }
  updates(): number[] {
    return this.take()
      .filter((call) => call.startsWith("update "))
      .map((call) => Number(call.slice(7)));
  }
}

/**
 * The stage only reads the canvas's values from the scale, so its mechanics are checked on
 * a scale whose canvas is the interface's own logical canvas (a canvas pixel of `dp` device
 * pixels): these tests were written in its numbers. The real canvas (half the interface's
 * pixel, about twice as many each way) has its own tests here and in
 * `PixelStage-canvas.test.tsx`.
 */
function scaleOf(w: number, h: number, dpr = 1): PixelScale {
  const s = pixelScale(w, h, dpr);
  return {
    ...s,
    canvasW: s.logicalW,
    canvasH: s.logicalH,
    canvasDp: s.dp,
    canvasPx: s.px,
  };
}

const PHONE = scaleOf(390, 844); // px 3, 130 x 282
const DESKTOP = scaleOf(1440, 900); // px 3, 480 x 300
const DAY = lightingFor({ elevation: 40, morning: true });
const NIGHT = lightingFor({ elevation: -30, morning: false });

function stage(props: PixelStageProps, scale: PixelScale = PHONE): ReactNode {
  return (
    <PixelScaleContext value={scale}>
      <PixelStage {...props} />
    </PixelScaleContext>
  );
}

function canvasOf(container: HTMLElement): HTMLCanvasElement {
  const canvas = container.querySelector("canvas");
  if (!canvas) throw new Error("no canvas");
  return canvas;
}

// --- tests -----------------------------------------------------------------------------------------

describe("PixelStage: the canvas", () => {
  test("takes its size from the scale context", () => {
    const { container } = render(
      stage({ scene: null, light: null }, scaleOf(1000, 700)),
    );
    // px 2: ceil(1000 / 2) x ceil(700 / 2) logical, shown at exactly 2 CSS px each.
    const canvas = canvasOf(container);
    expect(canvas.width).toBe(500);
    expect(canvas.height).toBe(350);
    expect(canvas.style.width).toBe("1000px");
    expect(canvas.style.height).toBe("700px");
    expect(canvas.parentElement).toHaveClass("ss-stage");
  });

  test("is rounded up to whole logical pixels, so it can be larger than the screen", () => {
    const { container } = render(
      stage({ scene: null, light: null }, scaleOf(1366, 768)),
    );
    // px 3: 456 x 256 logical is 1368 x 768 CSS px, 2 px wider than the screen.
    const canvas = canvasOf(container);
    expect(canvas.width).toBe(456);
    expect(canvas.style.width).toBe("1368px");
    expect(canvas.style.getPropertyValue("--ss-stage-w")).toBe("1368px");
    expect(canvas.style.getPropertyValue("--ss-stage-h")).toBe("768px");
  });

  test("at a fractional device pixel ratio the canvas is still a whole number of device pixels per logical pixel", () => {
    // A 1920 x 1080 panel at 125%: 4 device pixels each, the same picture as at 100%.
    const at125 = scaleOf(1536, 864, 1.25);
    const { container, rerender } = render(
      stage({ scene: null, light: null }, at125),
    );
    const canvas = canvasOf(container);
    expect([canvas.width, canvas.height]).toEqual([480, 270]);
    expect(canvas.style.width).toBe("1536px");
    expect(canvas.style.height).toBe("864px");
    expect(canvas.style.getPropertyValue("--ss-stage-w")).toBe("1536px");

    // Browser zoom at 110%: 3 device pixels each, so the CSS size is a fraction.
    const at110 = scaleOf(1745, 982, 1.1);
    rerender(stage({ scene: null, light: null }, at110));
    expect([canvas.width, canvas.height]).toEqual([640, 361]);
    // (Read from the variables: this test environment shortens `style.width` to six
    // figures when it writes it out again. A browser keeps the number it was given.)
    expect(canvas.style.getPropertyValue("--ss-stage-w")).toBe("1745.45455px");
    expect(canvas.style.getPropertyValue("--ss-stage-h")).toBe("984.54546px");
    expect(Number.parseFloat(canvas.style.width)).toBeCloseTo(1745.45, 1);
  });

  test("the canvas is exactly logical size times dp in device pixels, at every ratio", () => {
    const { container, rerender } = render(stage({ scene: null, light: null }));
    const canvas = canvasOf(container);
    for (const dpr of [1, 1.1, 1.25, 1.5, 1.75, 2, 2.625, 3]) {
      for (const [w, h] of [
        [390, 844],
        [1097, 617],
        [1366, 768],
        [1707, 960],
        [1920, 1080],
      ] as const) {
        const scale = scaleOf(w, h, dpr);
        rerender(stage({ scene: null, light: null }, scale));
        expect([canvas.width, canvas.height]).toEqual([
          scale.logicalW,
          scale.logicalH,
        ]);
        const css = (name: string) =>
          Number.parseFloat(canvas.style.getPropertyValue(name));
        const deviceW = css("--ss-stage-w") * dpr;
        const deviceH = css("--ss-stage-h") * dpr;
        // Never a hair under (the browser would lose a 64th), and whole to the eye.
        expect(deviceW - scale.logicalW * scale.dp).toBeGreaterThanOrEqual(
          -1e-9,
        );
        expect(deviceW - scale.logicalW * scale.dp).toBeLessThan(1e-4);
        expect(deviceH - scale.logicalH * scale.dp).toBeGreaterThanOrEqual(
          -1e-9,
        );
        expect(deviceH - scale.logicalH * scale.dp).toBeLessThan(1e-4);
        // It covers the screen.
        expect(deviceW).toBeGreaterThanOrEqual(w * dpr - 1e-6);
        expect(deviceH).toBeGreaterThanOrEqual(h * dpr - 1e-6);
      }
    }
  });

  test("a device pixel ratio that changes without an event is caught on the next frame", () => {
    // The real scale store this time: a PixelRoot around the stage, as on a page, so the
    // canvas is the real one (half the interface's pixel, rounded up).
    vi.stubGlobal("innerWidth", 1440);
    vi.stubGlobal("innerHeight", 900);
    vi.stubGlobal("devicePixelRatio", 1);
    const scene = new Recorder();
    const { container } = render(
      <PixelRoot>
        <PixelStage scene={scene} light={DAY} />
      </PixelRoot>,
    );
    const canvas = canvasOf(container);
    frames.step(0);
    expect([canvas.width, canvas.height]).toEqual([720, 450]);
    expect(scene.take()).toContain("resize 720x450");

    // The window is dragged to a monitor at 125%. No resize, no media query: only the
    // number changes. The next frame sees it, and the scene is given its new size.
    vi.stubGlobal("devicePixelRatio", 1.25);
    frames.step(16);
    expect([canvas.width, canvas.height]).toEqual([900, 563]);
    expect(canvas.style.getPropertyValue("--ss-stage-w")).toBe("1440px");
    expect(canvas.style.getPropertyValue("--ss-stage-h")).toBe("900.8px");
    expect(scene.take()).toContain("resize 900x563");
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.getPropertyValue("--px")).toBe("3.2px");
  });

  test("is hidden from assistive technology and cannot take focus", () => {
    const { container } = render(stage({ scene: null, light: null }));
    const canvas = canvasOf(container);
    expect(canvas).toHaveAttribute("aria-hidden", "true");
    expect(canvas).not.toHaveAttribute("tabindex");
    expect(canvas.tabIndex).toBe(-1);
  });

  test("passes className to the stage element", () => {
    const { container } = render(
      stage({ scene: null, light: null, className: "extra" }),
    );
    expect(container.firstElementChild).toHaveClass("ss-stage", "extra");
  });

  test("at the real scale it is the canvas's own size: 960 x 540 at 1920 x 1080", () => {
    const scene = new Recorder();
    const { container } = render(
      stage({ scene, light: DAY }, pixelScale(1920, 1080)),
    );
    // A 1920 x 1080 monitor: 960 x 540 canvas pixels of 2 device pixels each.
    const canvas = canvasOf(container);
    expect(canvas.width).toBe(960);
    expect(canvas.height).toBe(540);
    expect(canvas.style.width).toBe("1920px");
    expect(canvas.style.height).toBe("1080px");
    frames.step(1000);
    expect(scene.take()[0]).toBe("resize 960x540");
  });

  test("renders at build time without a browser", () => {
    vi.unstubAllGlobals();
    const html = renderToString(stage({ scene: new Recorder(), light: DAY }));
    expect(html).toContain('width="130"');
    expect(html).toContain('height="282"');
    expect(html).toContain("width:390px");
  });
});

describe("PixelStage: the frame", () => {
  test("resize, setLighting and setReducedMotion come before the first update, in that order", () => {
    const scene = new Recorder();
    render(stage({ scene, light: DAY }));
    expect(scene.calls).toEqual([]);
    expect(frames.pending.size).toBe(1);

    frames.step(1000);
    expect(scene.take()).toEqual([
      "resize 130x282",
      "light day",
      "reduced false",
      "update 0",
      "draw 130x282",
    ]);
    expect(context?.putImageData).toHaveBeenCalledTimes(1);

    // After that a frame is only update and draw.
    frames.step(1016);
    expect(scene.take()).toEqual(["update 0.016", "draw 130x282"]);
  });

  test("dt starts at 0, is the real time between frames, and is never more than 0.1 s", () => {
    const scene = new Recorder();
    render(stage({ scene, light: DAY }));
    frames.step(5000);
    frames.step(5020);
    frames.step(5070);
    frames.step(9000); // the browser stalled for four seconds
    frames.step(8990); // a clock that went backwards
    expect(scene.updates()).toEqual([0, 0.02, 0.05, 0.1, 0]);
  });

  test("timeScale multiplies dt after the clamp", () => {
    const scene = new Recorder();
    const { rerender } = render(stage({ scene, light: DAY, timeScale: 4 }));
    frames.step(0);
    frames.step(50);
    frames.step(1000);
    expect(scene.updates()).toEqual([0, 0.2, 0.4]);

    rerender(stage({ scene, light: DAY, timeScale: 0.5 }));
    frames.step(1040);
    expect(scene.updates()).toEqual([0.02]);
    // Changing the speed does not restart the loop.
    expect(frames.pending.size).toBe(1);

    // Nonsense falls back to 1.
    rerender(stage({ scene, light: DAY, timeScale: Number.NaN }));
    frames.step(1080);
    expect(scene.updates()).toEqual([0.04]);
  });

  test("the surface is wrapped in one ImageData per size, not copied", () => {
    const scene = new Recorder();
    const { rerender } = render(stage({ scene, light: DAY }));
    frames.step(0);
    frames.step(16);
    frames.step(32);
    const put = context?.putImageData;
    expect(put).toHaveBeenCalledTimes(3);
    const first = put?.mock.calls[0]?.[0] as FakeImageData;
    expect(put?.mock.calls[2]?.[0]).toBe(first);
    expect(put?.mock.calls[0]?.slice(1)).toEqual([0, 0]);
    expect(first.width).toBe(130);
    expect(first.height).toBe(282);
    // The same memory as the surface the scene drew into.
    expect(scene.surfaces[0]).toBe(scene.surfaces[2]);
    expect(first.data.buffer).toBe(scene.surfaces[0]?.data.buffer);
    expect(first.data.length).toBe(130 * 282 * 4);

    rerender(stage({ scene, light: DAY }, DESKTOP));
    frames.step(48);
    const last = put?.mock.calls.at(-1)?.[0] as FakeImageData;
    expect(last).not.toBe(first);
    expect(last.width).toBe(480);
    expect(last.data.buffer).toBe(scene.surfaces.at(-1)?.data.buffer);
  });

  test("a new logical size reaches the scene before its next update", () => {
    const scene = new Recorder();
    const { container, rerender } = render(stage({ scene, light: DAY }));
    frames.step(0);
    scene.take();

    rerender(stage({ scene, light: DAY }, DESKTOP));
    // Resizing a canvas empties it, so it is repainted at once, with no time passing.
    expect(scene.take()).toEqual([
      "resize 480x300",
      "update 0",
      "draw 480x300",
    ]);
    expect(canvasOf(container).width).toBe(480);
    frames.step(16);
    expect(scene.take()).toEqual(["update 0.016", "draw 480x300"]);
    expect(frames.pending.size).toBe(1);
  });

  test("a new light reaches the scene once, before the next update", () => {
    const scene = new Recorder();
    const { rerender } = render(stage({ scene, light: DAY }));
    frames.step(0);
    scene.take();

    rerender(stage({ scene, light: NIGHT }));
    frames.step(16);
    frames.step(32);
    expect(scene.take()).toEqual([
      "light night",
      "update 0.016",
      "draw 130x282",
      "update 0.016",
      "draw 130x282",
    ]);
  });

  test("a scene swap gives the new scene its size, light and motion before its first update", () => {
    const a = new Recorder("a");
    const b = new Recorder("b");
    media.matches = true;
    const { rerender } = render(stage({ scene: a, light: NIGHT }));
    frames.step(0);
    frames.step(16);
    a.take();

    rerender(stage({ scene: b, light: NIGHT }));
    frames.step(40);
    expect(a.take()).toEqual([]);
    expect(b.take()).toEqual([
      "resize 130x282",
      "light night",
      "reduced true",
      "update 0",
      "draw 130x282",
    ]);
    frames.step(56);
    expect(b.take()).toEqual(["update 0.016", "draw 130x282"]);
    expect(frames.pending.size).toBe(1);

    // And back: a scene that returns is told everything again.
    rerender(stage({ scene: a, light: NIGHT }));
    frames.step(72);
    expect(a.take().slice(0, 3)).toEqual([
      "resize 130x282",
      "light night",
      "reduced true",
    ]);
  });

  test("reduced motion is read from the media query, live", () => {
    const scene = new Recorder();
    render(stage({ scene, light: DAY }));
    frames.step(0);
    scene.take();

    media.set(true);
    frames.step(16);
    expect(scene.take()).toEqual([
      "reduced true",
      "update 0.016",
      "draw 130x282",
    ]);
    media.set(false);
    frames.step(32);
    expect(scene.take()[0]).toBe("reduced false");
  });

  test("a scene without the optional methods runs", () => {
    const calls: string[] = [];
    const bare: Scene = {
      resize: () => calls.push("resize"),
      setLighting: () => calls.push("light"),
      update: () => calls.push("update"),
      draw: () => calls.push("draw"),
    };
    const { container } = render(stage({ scene: bare, light: DAY }));
    frames.step(0);
    expect(calls).toEqual(["resize", "light", "update", "draw"]);
    const canvas = canvasOf(container);
    expect(() =>
      fireEvent.pointerMove(canvas, { isPrimary: true, clientX: 5 }),
    ).not.toThrow();
    expect(canvas.style.cursor).toBe("");
  });
});

describe("PixelStage: when the loop runs", () => {
  test("nothing runs without a scene", () => {
    render(stage({ scene: null, light: DAY }));
    expect(frames.pending.size).toBe(0);
    expect(context?.putImageData).not.toHaveBeenCalled();
  });

  test("nothing runs before there is a light, and it starts when one arrives", () => {
    const scene = new Recorder();
    const { rerender } = render(stage({ scene, light: null }));
    expect(frames.pending.size).toBe(0);
    expect(scene.calls).toEqual([]);

    rerender(stage({ scene, light: DAY }));
    expect(frames.pending.size).toBe(1);
    frames.step(700);
    expect(scene.take()).toEqual([
      "resize 130x282",
      "light day",
      "reduced false",
      "update 0",
      "draw 130x282",
    ]);
  });

  test("taking the scene away stops the loop and clears the canvas", () => {
    const scene = new Recorder();
    const { rerender } = render(stage({ scene, light: DAY }));
    frames.step(0);
    rerender(stage({ scene: null, light: DAY }));
    expect(frames.pending.size).toBe(0);
    expect(context?.clearRect).toHaveBeenCalledWith(0, 0, 130, 282);
  });

  test("paused holds the loop, and resuming starts with dt 0", () => {
    const scene = new Recorder();
    const { rerender } = render(stage({ scene, light: DAY }));
    frames.step(0);
    frames.step(16);
    scene.take();

    rerender(stage({ scene, light: DAY, paused: true }));
    expect(frames.pending.size).toBe(0);
    frames.step(5000);
    expect(scene.take()).toEqual([]);

    rerender(stage({ scene, light: DAY, paused: false }));
    expect(frames.pending.size).toBe(1);
    frames.step(9000);
    frames.step(9016);
    expect(scene.updates()).toEqual([0, 0.016]);
  });

  test("paused from the start paints one still frame", () => {
    const scene = new Recorder();
    render(stage({ scene, light: DAY, paused: true }));
    expect(frames.pending.size).toBe(0);
    expect(scene.take()).toEqual([
      "resize 130x282",
      "light day",
      "reduced false",
      "update 0",
      "draw 130x282",
    ]);
    expect(context?.putImageData).toHaveBeenCalledTimes(1);
  });

  test("while paused, a new light or scene is painted once with no time passing", () => {
    const a = new Recorder("a");
    const b = new Recorder("b");
    const { rerender } = render(stage({ scene: a, light: DAY, paused: true }));
    a.take();

    rerender(stage({ scene: a, light: NIGHT, paused: true }));
    expect(a.take()).toEqual(["light night", "update 0", "draw 130x282"]);
    // The same props again paint nothing.
    rerender(stage({ scene: a, light: NIGHT, paused: true }));
    expect(a.take()).toEqual([]);

    rerender(stage({ scene: b, light: NIGHT, paused: true }));
    expect(b.take()).toEqual([
      "resize 130x282",
      "light night",
      "reduced false",
      "update 0",
      "draw 130x282",
    ]);
    media.set(true);
    expect(b.take()).toEqual(["reduced true", "update 0", "draw 130x282"]);
    expect(frames.pending.size).toBe(0);
  });

  test("a hidden document stops the loop, and coming back starts with dt 0", () => {
    const scene = new Recorder();
    render(stage({ scene, light: DAY }));
    frames.step(0);
    frames.step(16);
    scene.take();

    setVisibility("hidden");
    expect(frames.pending.size).toBe(0);
    setVisibility("hidden");
    expect(frames.pending.size).toBe(0);

    setVisibility("visible");
    setVisibility("visible");
    expect(frames.pending.size).toBe(1);
    frames.step(60000);
    frames.step(60016);
    expect(scene.updates()).toEqual([0, 0.016]);
  });

  test("mounted in a hidden document it waits, and paused wins over visible", () => {
    visibility = "hidden";
    const scene = new Recorder();
    const { rerender } = render(stage({ scene, light: DAY }));
    expect(frames.pending.size).toBe(0);

    rerender(stage({ scene, light: DAY, paused: true }));
    setVisibility("visible");
    expect(frames.pending.size).toBe(0);
  });

  test("a hidden document is never painted: what changed is painted when it is shown", () => {
    const scene = new Recorder();
    const { rerender } = render(stage({ scene, light: DAY }));
    frames.step(0);
    frames.step(16);
    scene.take();

    // A new light arrives in a background tab (the sky's clock, a new day).
    setVisibility("hidden");
    rerender(stage({ scene, light: NIGHT }));
    expect(scene.take()).toEqual([]);
    expect(context?.putImageData).toHaveBeenCalledTimes(2);
    expect(frames.pending.size).toBe(0);

    // Shown again: the loop's first frame tells the scene, once, with no time passing.
    setVisibility("visible");
    expect(scene.take()).toEqual([]);
    frames.step(90000);
    expect(scene.take()).toEqual(["light night", "update 0", "draw 130x282"]);
  });

  test("a paused stage that changed while hidden is painted once when it is shown", () => {
    const scene = new Recorder();
    const { rerender } = render(stage({ scene, light: DAY, paused: true }));
    scene.take();

    setVisibility("hidden");
    rerender(stage({ scene, light: NIGHT, paused: true }));
    // A new size empties the canvas: that too waits.
    rerender(stage({ scene, light: NIGHT, paused: true }, DESKTOP));
    expect(scene.take()).toEqual([]);

    setVisibility("visible");
    expect(scene.take()).toEqual([
      "resize 480x300",
      "light night",
      "update 0",
      "draw 480x300",
    ]);
    // Nothing more to say: hiding and showing again paints nothing.
    setVisibility("hidden");
    setVisibility("visible");
    expect(scene.take()).toEqual([]);
    expect(frames.pending.size).toBe(0);
  });

  test("mounted hidden and paused, it paints its still frame when it is first shown", () => {
    visibility = "hidden";
    const scene = new Recorder();
    render(stage({ scene, light: DAY, paused: true }));
    expect(scene.take()).toEqual([]);
    setVisibility("visible");
    expect(scene.take()).toEqual([
      "resize 130x282",
      "light day",
      "reduced false",
      "update 0",
      "draw 130x282",
    ]);
  });

  test("a frame that took long is not time the animation then jumps over", () => {
    // The scene builds its picture in its first frame: 120 ms of work.
    let clock = 5000;
    vi.spyOn(performance, "now").mockImplementation(() => clock);
    const scene = new Recorder();
    let cost = 120;
    const draw = scene.draw.bind(scene);
    scene.draw = (s) => {
      clock += cost;
      draw(s);
    };
    render(stage({ scene, light: DAY }));
    frames.step(1000);
    // The browser's next frame comes 126 ms after the first began, 6 ms after it ended.
    cost = 2;
    frames.step(1126);
    // An ordinary frame is counted in full.
    frames.step(1142.5);
    expect(scene.updates()).toEqual([0, 0.006, 0.0165]);

    // A stall that was not the scene's own work (the browser's) is still clamped, as ever.
    frames.step(9000);
    expect(scene.updates()).toEqual([0.1]);
  });

  test("on a slow device every ordinary frame is counted in full, however long it took", () => {
    // Every frame costs 40 ms: the browser manages one every 50 ms. That is the animation's
    // real time, not a picture being built, and the menu must not run at a fifth of its
    // speed (the page's patience with the kick-off would run out before the scene's end).
    let clock = 5000;
    vi.spyOn(performance, "now").mockImplementation(() => clock);
    const scene = new Recorder();
    const draw = scene.draw.bind(scene);
    scene.draw = (s) => {
      clock += 40;
      draw(s);
    };
    const { rerender } = render(stage({ scene, light: DAY }));
    frames.step(1000);
    frames.step(1050);
    frames.step(1100);
    frames.step(1150);
    expect(scene.updates()).toEqual([0, 0.01, 0.05, 0.05]);

    // A new light is a picture to build again: that one frame is not jumped over.
    rerender(stage({ scene, light: NIGHT }));
    frames.step(1200);
    frames.step(1250);
    expect(scene.updates()).toEqual([0.05, 0.01]);
  });

  test("unmounting cancels the frame and removes every listener", () => {
    const added = vi.spyOn(document, "addEventListener");
    const removed = vi.spyOn(document, "removeEventListener");
    const scene = new Recorder();
    const { unmount } = render(stage({ scene, light: DAY }));
    frames.step(0);
    scene.take();
    expect(frames.pending.size).toBe(1);
    expect(media.listeners.size).toBe(1);

    unmount();
    expect(frames.pending.size).toBe(0);
    expect(media.listeners.size).toBe(0);
    // Two listeners: the loop's, and the one that repaints a held stage when it is shown.
    const listeners = (spy: typeof added) =>
      spy.mock.calls
        .filter(([type]) => type === "visibilitychange")
        .map(([, listener]) => listener);
    expect(listeners(added)).toHaveLength(2);
    expect(new Set(listeners(removed))).toEqual(new Set(listeners(added)));
    expect(listeners(removed)).toHaveLength(2);

    // Nothing is left that could still reach the scene.
    setVisibility("hidden");
    setVisibility("visible");
    media.set(true);
    frames.step(100);
    expect(frames.pending.size).toBe(0);
    expect(scene.take()).toEqual([]);
  });

  test("strict mode leaves exactly one loop and one set of listeners", () => {
    const added = vi.spyOn(document, "addEventListener");
    const removed = vi.spyOn(document, "removeEventListener");
    const scene = new Recorder();
    const { unmount } = render(
      <StrictMode>{stage({ scene, light: DAY })}</StrictMode>,
    );
    expect(frames.pending.size).toBe(1);
    expect(media.listeners.size).toBe(1);
    const live = () =>
      added.mock.calls.filter(([type]) => type === "visibilitychange").length -
      removed.mock.calls.filter(([type]) => type === "visibilitychange").length;
    expect(live()).toBe(2);

    frames.step(0);
    frames.step(16);
    frames.step(32);
    expect(frames.pending.size).toBe(1);
    expect(scene.updates()).toEqual([0, 0.016, 0.016]);
    expect(
      scene.calls.filter((call) => call.startsWith("resize")),
    ).toHaveLength(0);

    unmount();
    expect(frames.pending.size).toBe(0);
    expect(media.listeners.size).toBe(0);
    expect(live()).toBe(0);
  });

  test("a scene that throws stops the loop instead of throwing sixty times a second", () => {
    const scene = new Recorder();
    scene.update = () => {
      throw new Error("broken scene");
    };
    render(stage({ scene, light: DAY }));
    const [callback] = [...frames.pending.values()];
    frames.pending.clear();
    expect(() => callback?.(0)).toThrow("broken scene");
    expect(frames.pending.size).toBe(0);
  });

  test("a scene that throws while a held stage is repainted is reported, and the page stands", () => {
    const report = vi.fn();
    vi.stubGlobal("reportError", report);
    const scene = new Recorder();
    const { rerender, container } = render(
      stage({ scene, light: DAY, paused: true }),
    );
    scene.take();
    const broken = new Error("broken scene");
    scene.draw = () => {
      throw broken;
    };

    // This repaint runs inside React's commit: an error thrown there would unmount the page.
    expect(() =>
      rerender(stage({ scene, light: NIGHT, paused: true })),
    ).not.toThrow();
    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith(broken);
    expect(canvasOf(container)).toBeInTheDocument();
    // One error, not one per render: the scene has been told all there is to tell.
    rerender(stage({ scene, light: NIGHT, paused: true }));
    expect(report).toHaveBeenCalledTimes(1);
  });

  test("a scene that unmounts the stage from inside a frame leaves no loop behind", () => {
    const scene = new Recorder();
    const { unmount } = render(stage({ scene, light: DAY }));
    frames.step(0);
    scene.update = () => unmount();
    frames.step(16);
    expect(frames.pending.size).toBe(0);
  });

  test("with no 2D context nothing runs and nothing throws", () => {
    context = null;
    const scene = new Recorder();
    const { container, rerender, unmount } = render(
      stage({ scene, light: DAY }),
    );
    expect(frames.pending.size).toBe(0);
    rerender(stage({ scene, light: NIGHT, paused: true }, DESKTOP));
    rerender(stage({ scene: null, light: NIGHT }, DESKTOP));
    setVisibility("hidden");
    setVisibility("visible");
    media.set(true);
    fireEvent.pointerDown(canvasOf(container), { isPrimary: true });
    expect(scene.calls).toEqual([]);
    expect(scene.pointers).toEqual([]);
    expect(frames.pending.size).toBe(0);
    expect(() => unmount()).not.toThrow();
  });

  test("a getContext that throws is treated as no context", () => {
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockImplementation(() => {
      throw new Error("not implemented");
    });
    const scene = new Recorder();
    expect(() => render(stage({ scene, light: DAY }))).not.toThrow();
    expect(frames.pending.size).toBe(0);
  });
});

describe("PixelStage: the pointer", () => {
  /** A 130 x 282 canvas at px 3, hanging one CSS pixel off the left and two off the top. */
  function mounted(scene: Scene) {
    const { container } = render(stage({ scene, light: DAY }));
    const canvas = canvasOf(container);
    canvas.getBoundingClientRect = () =>
      ({
        left: -1,
        top: -2,
        width: 390,
        height: 846,
        right: 389,
        bottom: 844,
        x: -1,
        y: -2,
      }) as DOMRect;
    canvas.setPointerCapture = vi.fn();
    frames.step(0);
    return canvas;
  }

  test("events arrive in logical pixels, fractions and all", () => {
    const scene = new Recorder();
    const canvas = mounted(scene);
    const mouse = { isPrimary: true, pointerType: "mouse", pointerId: 1 };

    fireEvent.pointerMove(canvas, { ...mouse, clientX: 149, clientY: 28 });
    fireEvent.pointerDown(canvas, { ...mouse, clientX: 150, clientY: 30 });
    fireEvent.pointerUp(canvas, { ...mouse, clientX: 388, clientY: 843 });
    const near = (n: number): unknown => expect.closeTo(n, 9);
    expect(scene.pointers).toEqual([
      { type: "move", x: near(50), y: near(10), touch: false },
      { type: "down", x: near(151 / 3), y: near(32 / 3), touch: false },
      { type: "up", x: near(389 / 3), y: near(845 / 3), touch: false },
    ]);
    // The last one is inside the last logical pixel: (129, 281).
    const last = scene.pointers[2];
    expect(Math.floor(last?.x ?? 0)).toBe(129);
    expect(Math.floor(last?.y ?? 0)).toBe(281);
  });

  test("a fractional scale maps the pointer to the same logical pixels", () => {
    // 125%: the canvas is 480 x 270 logical in 1536 x 864 CSS px, 3.2 CSS px each.
    const scene = new Recorder();
    const { container } = render(
      stage({ scene, light: DAY }, scaleOf(1536, 864, 1.25)),
    );
    const canvas = canvasOf(container);
    canvas.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 1536, height: 864 }) as DOMRect;
    frames.step(0);
    const mouse = { isPrimary: true, pointerType: "mouse", pointerId: 1 };
    fireEvent.pointerMove(canvas, { ...mouse, clientX: 33.6, clientY: 8 });
    fireEvent.pointerMove(canvas, {
      ...mouse,
      clientX: 1535.9,
      clientY: 863.9,
    });
    const near = (n: number): unknown => expect.closeTo(n, 9);
    expect(scene.pointers[0]).toEqual({
      type: "move",
      x: near(10.5),
      y: near(2.5),
      touch: false,
    });
    expect(Math.floor(scene.pointers[1]?.x ?? 0)).toBe(479);
    expect(Math.floor(scene.pointers[1]?.y ?? 0)).toBe(269);
  });

  test("leaving and cancelling both arrive as leave", () => {
    const scene = new Recorder();
    const canvas = mounted(scene);
    const init = { isPrimary: true, pointerType: "mouse", clientX: 2 };
    fireEvent.pointerLeave(canvas, init);
    fireEvent.pointerCancel(canvas, init);
    expect(scene.pointers.map((p) => p.type)).toEqual(["leave", "leave"]);
  });

  test("touch is true for anything that is not a mouse", () => {
    const scene = new Recorder();
    const canvas = mounted(scene);
    for (const pointerType of ["touch", "pen", "mouse", ""]) {
      fireEvent.pointerMove(canvas, { isPrimary: true, pointerType });
    }
    expect(scene.pointers.map((p) => p.touch)).toEqual([
      true,
      true,
      false,
      true,
    ]);
  });

  test("down captures the pointer, and a failed capture is not an error", () => {
    const scene = new Recorder();
    const canvas = mounted(scene);
    fireEvent.pointerDown(canvas, { isPrimary: true, pointerId: 7 });
    expect(canvas.setPointerCapture).toHaveBeenCalledWith(7);

    canvas.setPointerCapture = () => {
      throw new DOMException("no such pointer", "NotFoundError");
    };
    expect(() =>
      fireEvent.pointerDown(canvas, { isPrimary: true, pointerId: 8 }),
    ).not.toThrow();
    expect(scene.pointers.map((p) => p.type)).toEqual(["down", "down"]);
  });

  test("a second finger and the other mouse buttons never reach the scene", () => {
    const scene = new Recorder();
    const canvas = mounted(scene);
    fireEvent.pointerDown(canvas, { isPrimary: false, pointerType: "touch" });
    fireEvent.pointerDown(canvas, {
      isPrimary: true,
      pointerType: "mouse",
      button: 2,
    });
    fireEvent.pointerUp(canvas, {
      isPrimary: true,
      pointerType: "mouse",
      button: 2,
    });
    expect(scene.pointers).toEqual([]);
    expect(canvas.setPointerCapture).not.toHaveBeenCalled();
  });

  test("the cursor follows scene.cursor() after every pointer event", () => {
    const scene = new Recorder();
    const canvas = mounted(scene);
    scene.cursorNow = "pointer";
    fireEvent.pointerMove(canvas, { isPrimary: true, pointerType: "mouse" });
    expect(canvas.style.cursor).toBe("pointer");
    scene.cursorNow = "default";
    fireEvent.pointerLeave(canvas, { isPrimary: true, pointerType: "mouse" });
    expect(canvas.style.cursor).toBe("default");
  });

  test("the cursor follows scene.cursor() between pointer events too, frame by frame", () => {
    // A spun ball comes to rest under a mouse that does not move: the cursor must change
    // with it, not wait for the mouse.
    const scene = new Recorder();
    const canvas = mounted(scene);
    fireEvent.pointerMove(canvas, { isPrimary: true, pointerType: "mouse" });
    scene.cursorNow = "pointer";
    frames.step(16);
    expect(canvas.style.cursor).toBe("pointer");
    scene.cursorNow = "default";
    frames.step(32);
    expect(canvas.style.cursor).toBe("default");
  });

  test("a scene hears no pointer before its first frame", () => {
    const a = new Recorder("a");
    const b = new Recorder("b");
    const { container, rerender } = render(stage({ scene: a, light: null }));
    const canvas = canvasOf(container);
    fireEvent.pointerMove(canvas, { isPrimary: true });
    expect(a.pointers).toEqual([]);

    rerender(stage({ scene: a, light: DAY }));
    frames.step(0);
    a.cursorNow = "pointer";
    fireEvent.pointerMove(canvas, { isPrimary: true });
    expect(a.pointers).toHaveLength(1);
    expect(canvas.style.cursor).toBe("pointer");

    // The next scene starts with the default cursor and hears nothing until it has a size.
    rerender(stage({ scene: b, light: DAY }));
    expect(canvas.style.cursor).toBe("");
    fireEvent.pointerMove(canvas, { isPrimary: true });
    expect(b.pointers).toEqual([]);
    frames.step(16);
    fireEvent.pointerMove(canvas, { isPrimary: true });
    expect(b.pointers).toHaveLength(1);
    expect(a.pointers).toHaveLength(1);
  });
});

describe("PixelStage: sound", () => {
  /** A scene that makes sounds and has a bed of its own. */
  class Noisy extends Recorder {
    onSound: ((cue: SoundCue) => void) | null = null;
    bed: Ambience = { venue: "stadium", crowd: 1, night: false };
    ambience(): Ambience {
      return this.bed;
    }
  }

  beforeEach(() => {
    localStorage.clear();
    resetSoundMutedForTests();
    vi.stubGlobal("AudioContext", FakeAudioContext);
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  });

  afterEach(() => {
    resetSoundEngineForTests();
    resetSoundMutedForTests();
    vi.useRealTimers();
    localStorage.clear();
  });

  function gesture(): void {
    window.dispatchEvent(new Event("pointerdown"));
  }

  test("the scene's cues reach the engine, and its bed is asked for once a second", () => {
    const a = new Noisy("a");
    render(stage({ scene: a, light: DAY }));
    expect(a.onSound).toBeTypeOf("function");
    const engine = soundEngine();
    if (!engine) throw new Error("no engine");

    // Nothing before the first gesture.
    a.onSound?.({ kind: "touch" });
    expect(engine.debug()).toMatchObject({ state: "none", ambience: null });
    expect(engine.debug().dropped.locked).toBe(1);

    gesture();
    expect(engine.debug().ambience).toBe("top");
    a.onSound?.({ kind: "kick", power: 1 });
    expect(engine.debug().played.kick).toBe(1);

    a.bed = { venue: "park", crowd: 0.5, night: true };
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(engine.debug().ambience).toBe("park:night");
  });

  test("a new scene takes the sound over, and unmounting lets it go", () => {
    const a = new Noisy("a");
    const b = new Noisy("b");
    b.bed = { venue: "ground", crowd: 0.6, night: false };
    const { rerender, unmount } = render(stage({ scene: a, light: DAY }));
    gesture();
    rerender(stage({ scene: b, light: DAY }));
    expect(a.onSound).toBeNull();
    expect(b.onSound).toBeTypeOf("function");
    const engine = soundEngine();
    expect(engine?.debug().ambience).toBe("nonleague");

    unmount();
    expect(b.onSound).toBeNull();
    expect(engine?.debug().ambience).toBeNull();
    // The poll has stopped: the bed does not come back.
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(engine?.debug().ambience).toBeNull();
  });

  test("a scene with no bed of its own is heard over silence", () => {
    const a = new Recorder("plain") as Recorder & Pick<Scene, "onSound">;
    render(stage({ scene: a, light: DAY }));
    gesture();
    expect(a.onSound).toBeTypeOf("function");
    a.onSound?.({ kind: "whistle", long: true });
    expect(soundEngine()?.debug()).toMatchObject({
      ambience: null,
      played: { whistle: 1 },
    });
  });

  test("reduced motion does not mute; a hidden tab is silent", () => {
    const a = new Noisy("a");
    render(stage({ scene: a, light: DAY }));
    gesture();
    media.set(true);
    a.onSound?.({ kind: "touch" });
    const engine = soundEngine();
    expect(engine?.isMuted).toBe(false);
    expect(engine?.debug().played.touch).toBe(1);

    setVisibility("hidden");
    a.onSound?.({ kind: "kick", power: 0.4 });
    expect(engine?.debug().dropped.hidden).toBe(1);
    setVisibility("visible");
    a.onSound?.({ kind: "kick", power: 0.4 });
    expect(engine?.debug().played.kick).toBe(1);
  });

  test("without Web Audio the stage runs as before, in silence", () => {
    vi.stubGlobal("AudioContext", undefined);
    const a = new Noisy("a");
    render(stage({ scene: a, light: DAY }));
    frames.step(0);
    frames.step(16);
    expect(a.onSound).toBeNull();
    expect(a.updates()).toEqual([0, 0.016]);
  });
});
