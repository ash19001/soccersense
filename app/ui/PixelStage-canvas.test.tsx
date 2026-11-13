import { act, fireEvent, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { lightingFor, type Lighting } from "~/art/lighting";
import type { Surface } from "~/pixel";
import type { PointerInfo, Scene } from "~/scenes/scene";

import { PixelStage, type PixelStageProps } from "./PixelStage";
import { PixelScaleContext, pixelScale, type PixelScale } from "./scale";

// The browser the host expects, faked as in PixelStage.test.tsx.
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

let frames: Frames;

beforeEach(() => {
  frames = new Frames();
  vi.stubGlobal("requestAnimationFrame", frames.request);
  vi.stubGlobal("cancelAnimationFrame", frames.cancel);
  vi.stubGlobal("ImageData", FakeImageData);
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () =>
      ({
        putImageData: vi.fn(),
        clearRect: vi.fn(),
      }) as unknown as CanvasRenderingContext2D,
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** A scene that writes down what it is told. */
class Recorder implements Scene {
  readonly calls: string[] = [];
  readonly pointers: PointerInfo[] = [];
  resize(w: number, h: number): void {
    this.calls.push(`resize ${w}x${h}`);
  }
  setLighting(light: Lighting): void {
    this.calls.push(`light ${light.phase}`);
  }
  update(): void {
    this.calls.push("update");
  }
  draw(s: Surface): void {
    this.calls.push(`draw ${s.w}x${s.h}`);
  }
  pointer(p: PointerInfo): void {
    this.pointers.push({ ...p });
  }
  take(): string[] {
    return this.calls.splice(0);
  }
}

const DAY = lightingFor({ elevation: 40, morning: true });

function stage(props: PixelStageProps, scale: PixelScale): ReactNode {
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

describe("PixelStage on the real canvas", () => {
  test("the canvas is the scale's canvas: twice the pixels, half the size each", () => {
    const scale = pixelScale(1920, 1080, 1);
    const { container } = render(stage({ scene: null, light: null }, scale));
    const canvas = canvasOf(container);
    expect([canvas.width, canvas.height]).toEqual([960, 540]);
    // the whole screen on the page
    expect(canvas.style.width).toBe("1920px");
    expect(canvas.style.height).toBe("1080px");
    expect(canvas.style.getPropertyValue("--ss-stage-px")).toBe("2px");
  });

  test("at a fractional ratio the canvas is whole device pixels too", () => {
    const scale = pixelScale(1536, 864, 1.25);
    const { container } = render(stage({ scene: null, light: null }, scale));
    const canvas = canvasOf(container);
    expect([canvas.width, canvas.height]).toEqual([960, 540]);
    // 960 canvas pixels of 2 device pixels at 1.25: 1536 CSS pixels
    expect(canvas.style.width).toBe("1536px");
    expect(canvas.style.getPropertyValue("--ss-stage-px")).toBe("1.6px");
  });

  test("the scene is told the canvas's size before it hears anything, and draws at it", () => {
    const scene = new Recorder();
    render(stage({ scene, light: DAY }, pixelScale(1920, 1080, 1)));
    frames.step(0);
    expect(scene.take()).toEqual([
      "resize 960x540",
      "light day",
      "update",
      "draw 960x540",
    ]);
  });

  test("the pointer lands on the same place in the picture", () => {
    const scene = new Recorder();
    const scale = pixelScale(1920, 1080, 1);
    const { container } = render(stage({ scene, light: DAY }, scale));
    frames.step(0);
    const canvas = canvasOf(container);
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 1920,
      bottom: 1080,
      width: 1920,
      height: 1080,
      toJSON: () => ({}),
    });
    fireEvent.pointerMove(canvas, {
      clientX: 960,
      clientY: 756,
      isPrimary: true,
      pointerType: "mouse",
    });
    const p = scene.pointers.at(-1);
    // the same point of the screen: the middle, 70% of the way down
    expect(p?.x).toBe(scale.canvasW / 2);
    expect(p?.y).toBeCloseTo(scale.canvasH * 0.7, 6);
  });
});
