// A scene that can get its first picture ready in steps (`Scene.prepareStep`) is taken
// through them in short tasks before its first frame: nothing is drawn, and the pointer is
// not heard, until the last step is done.

import { act, fireEvent, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { lightingFor, type Lighting } from "~/art/lighting";
import type { Surface } from "~/pixel";
import type { PointerInfo, Scene } from "~/scenes/scene";

import * as fade from "./fade";
import { PixelStage, type PixelStageProps } from "./PixelStage";
import { PixelScaleContext, pixelScale } from "./scale";

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
  step(now: number): void {
    const due = [...this.pending.values()];
    this.pending.clear();
    act(() => {
      for (const callback of due) callback(now);
    });
  }
}

/** Messages on a channel that only arrive when the test says so: the stage's tasks. */
const posted: (() => void)[] = [];
class FakeChannel {
  port1: { onmessage: (() => void) | null; close(): void } = {
    onmessage: null,
    close: () => {},
  };
  port2 = {
    postMessage: (): void => {
      posted.push(() => this.port1.onmessage?.());
    },
  };
}
/** Runs the task that has waited longest. False if none waits. */
function runTask(): boolean {
  const task = posted.shift();
  if (!task) return false;
  act(task);
  return true;
}

class FakeImageData {
  constructor(
    readonly data: Uint8ClampedArray,
    readonly width: number,
    readonly height: number,
  ) {}
}

let frames: Frames;
/** The clock the stage reads: every step of the scene below takes 3 ms of it. */
let clock: number;
let visibility: DocumentVisibilityState;

function setVisibility(state: DocumentVisibilityState): void {
  visibility = state;
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

beforeEach(() => {
  frames = new Frames();
  posted.length = 0;
  clock = 1000;
  visibility = "visible";
  vi.stubGlobal("requestAnimationFrame", frames.request);
  vi.stubGlobal("cancelAnimationFrame", frames.cancel);
  vi.stubGlobal("MessageChannel", FakeChannel);
  vi.stubGlobal("ImageData", FakeImageData);
  vi.spyOn(performance, "now").mockImplementation(() => clock);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () =>
      ({
        putImageData: vi.fn(),
        clearRect: vi.fn(),
      }) as unknown as CanvasRenderingContext2D,
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

/** A scene whose first picture takes `steps` steps of 3 ms, and that writes down its calls. */
class Stepper implements Scene {
  readonly calls: string[] = [];
  constructor(private left: number) {}
  resize(w: number, h: number): void {
    this.calls.push(`resize ${w}x${h}`);
  }
  setLighting(light: Lighting): void {
    this.calls.push(`light ${light.phase}`);
  }
  prepareStep(): boolean {
    this.calls.push("step");
    clock += 3;
    this.left--;
    return this.left > 0;
  }
  update(dt: number): void {
    this.calls.push(`update ${dt}`);
  }
  draw(s: Surface): void {
    this.calls.push(`draw ${s.w}x${s.h}`);
  }
  pointer(p: PointerInfo): void {
    this.calls.push(`pointer ${p.type}`);
  }
  take(): string[] {
    return this.calls.splice(0);
  }
}

const SCALE = pixelScale(390, 844, 1);
const DAY = lightingFor({ elevation: 40, morning: true });
const SIZE = `${SCALE.canvasW}x${SCALE.canvasH}`;

function stage(props: PixelStageProps): ReactNode {
  return (
    <PixelScaleContext value={SCALE}>
      <PixelStage {...props} />
    </PixelScaleContext>
  );
}

describe("PixelStage: a scene that gets its first picture ready in steps", () => {
  test("is taken through them in tasks of a few milliseconds, then drawn", () => {
    const scene = new Stepper(5);
    render(stage({ scene, light: DAY }));
    // nothing yet: no frame is asked for, a task waits
    expect(scene.take()).toEqual([]);
    expect(frames.pending.size).toBe(0);
    expect(posted.length).toBe(1);

    // the first task tells the scene its size and light, then steps until 4 ms have gone
    expect(runTask()).toBe(true);
    expect(scene.take()).toEqual([
      `resize ${SIZE}`,
      "light day",
      "step",
      "step",
    ]);
    expect(frames.pending.size).toBe(0);

    expect(runTask()).toBe(true);
    expect(scene.take()).toEqual(["step", "step"]);
    expect(frames.pending.size).toBe(0);

    // the last step: now the first frame is asked for, and no more tasks
    expect(runTask()).toBe(true);
    expect(scene.take()).toEqual(["step"]);
    expect(posted.length).toBe(0);
    expect(frames.pending.size).toBe(1);

    // the first frame: told nothing twice, no time has passed, no more steps
    frames.step(5000);
    expect(scene.take()).toEqual(["update 0", `draw ${SIZE}`]);
    frames.step(5016);
    expect(scene.take()).toEqual(["update 0.016", `draw ${SIZE}`]);
    expect(posted.length).toBe(0);
  });

  test("hears no pointer until its first frame is drawn", () => {
    const scene = new Stepper(3);
    const { container } = render(stage({ scene, light: DAY }));
    const canvas = container.querySelector("canvas");
    if (!canvas) throw new Error("no canvas");
    runTask();
    fireEvent.pointerMove(canvas, { isPrimary: true, clientX: 5, clientY: 5 });
    expect(scene.take().filter((c) => c.startsWith("pointer"))).toEqual([]);
    while (runTask());
    frames.step(5000);
    scene.take();
    fireEvent.pointerMove(canvas, { isPrimary: true, clientX: 5, clientY: 5 });
    expect(scene.take()).toEqual(["pointer move"]);
  });

  test("stops while the document is hidden, and carries on when it is shown", () => {
    const scene = new Stepper(6);
    render(stage({ scene, light: DAY }));
    runTask();
    expect(scene.take().filter((c) => c === "step")).toHaveLength(2);
    setVisibility("hidden");
    // the task that was waiting does nothing, and asks for no other
    runTask();
    expect(scene.take()).toEqual([]);
    expect(posted.length).toBe(0);
    expect(frames.pending.size).toBe(0);
    setVisibility("visible");
    expect(posted.length).toBe(1);
    while (runTask());
    expect(scene.take()).toEqual(["step", "step", "step", "step"]);
    expect(frames.pending.size).toBe(1);
  });

  test("is not stepped when the page is arrived at through the fade: its first frame builds it", () => {
    vi.spyOn(fade, "arrivingThroughFade").mockReturnValue(true);
    const scene = new Stepper(5);
    render(stage({ scene, light: DAY }));
    expect(posted.length).toBe(0);
    expect(frames.pending.size).toBe(1);
    frames.step(5000);
    expect(scene.take()).toEqual([
      `resize ${SIZE}`,
      "light day",
      "update 0",
      `draw ${SIZE}`,
    ]);
  });

  test("a scene that throws in a step is drawn all the same", () => {
    const scene = new Stepper(5);
    scene.prepareStep = () => {
      throw new Error("no picture");
    };
    render(stage({ scene, light: DAY }));
    runTask();
    expect(posted.length).toBe(0);
    expect(frames.pending.size).toBe(1);
    frames.step(5000);
    expect(scene.take()).toContain(`draw ${SIZE}`);
  });

  test("where the browser takes a priority, its tasks go ahead of the page's ordinary ones", () => {
    const postTask = vi.fn(
      (task: () => void, options: { priority: string }): Promise<void> => {
        void options;
        posted.push(task);
        return Promise.resolve();
      },
    );
    vi.stubGlobal("scheduler", { postTask });
    const scene = new Stepper(3);
    render(stage({ scene, light: DAY }));
    expect(postTask).toHaveBeenCalledTimes(1);
    expect(postTask.mock.calls[0][1]).toEqual({ priority: "user-blocking" });
    while (runTask());
    expect(postTask).toHaveBeenCalledTimes(2);
    expect(scene.take().filter((c) => c === "step")).toHaveLength(3);
    expect(frames.pending.size).toBe(1);
  });

  test("paused while its picture is being got ready: a still frame is painted at once, not an empty canvas", () => {
    const scene = new Stepper(6);
    const { rerender } = render(stage({ scene, light: DAY }));
    runTask();
    expect(scene.take().filter((c) => c === "step")).toHaveLength(2);
    // (the scene has been told its size and light by now, but nothing of it is on the canvas)
    rerender(stage({ scene, light: DAY, paused: true }));
    const painted = scene.take();
    expect(painted.filter((c) => c.startsWith("draw"))).toEqual([
      `draw ${SIZE}`,
    ]);
    expect(painted).toContain("update 0");
    // the task that was waiting does nothing, and no frame is pending while paused
    while (runTask());
    expect(scene.take()).toEqual([]);
    expect(frames.pending.size).toBe(0);
    // let go again: the loop carries on with frames (the picture is up: no more steps)
    rerender(stage({ scene, light: DAY }));
    while (runTask());
    expect(scene.take().filter((c) => c === "step")).toEqual([]);
    expect(frames.pending.size).toBe(1);
  });
});
