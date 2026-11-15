import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GameLayout } from "./GameLayout";

/** A visual viewport the test moves: an on-screen keyboard coming up or a page panned. */
class FakeViewport extends EventTarget {
  height: number;
  width = 390;
  offsetTop = 0;
  offsetLeft = 0;
  scale = 1;
  constructor(height: number) {
    super();
    this.height = height;
  }
  move(height: number, offsetTop = 0) {
    this.height = height;
    this.offsetTop = offsetTop;
    act(() => {
      this.dispatchEvent(new Event("resize"));
    });
  }
}

let vv: FakeViewport;

function windowHeight(height: number) {
  Object.defineProperty(window, "innerHeight", {
    value: height,
    configurable: true,
  });
}

/** The screen is a touch screen (or not): `(pointer: coarse)`. */
function touchScreen(coarse: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: coarse && query.includes("pointer: coarse"),
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
}

function layout() {
  render(
    <GameLayout
      top={<p>The question</p>}
      bottom={<input aria-label="Answer" />}
    />,
  );
  const root = document.querySelector<HTMLElement>(".ss-game");
  const field = document.querySelector<HTMLInputElement>("input");
  if (!root || !field) throw new Error("no layout");
  return { root, field };
}

/** Let the look that follows a focus change or a press happen. */
function frame() {
  act(() => {
    vi.advanceTimersToNextFrame();
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  windowHeight(844);
  vv = new FakeViewport(844);
  vi.stubGlobal("visualViewport", vv);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  windowHeight(768);
});

describe("GameLayout with an on-screen keyboard, mouse-first", () => {
  it("keeps the column inside the visual viewport", () => {
    touchScreen(false);
    const { root } = layout();
    expect(root.dataset.keyboard).toBeUndefined();
    vv.move(400, 300);
    expect(root.dataset.keyboard).toBe("open");
    expect(root.style.getPropertyValue("--ss-vv-h")).toBe("400px");
    expect(root.style.getPropertyValue("--ss-vv-top")).toBe("300px");
    vv.move(844);
    expect(root.dataset.keyboard).toBeUndefined();
    expect(root.style.getPropertyValue("--ss-vv-h")).toBe("");
  });

  it("is not open while the page is pinched in", () => {
    touchScreen(false);
    const { root } = layout();
    vv.scale = 2;
    vv.move(400);
    expect(root.dataset.keyboard).toBeUndefined();
  });
});

describe("GameLayout with an on-screen keyboard, on a touch screen", () => {
  it("never moves the column: only the board is told to come down", () => {
    touchScreen(true);
    const { root, field } = layout();
    act(() => field.focus());
    frame();
    // Focus alone (the field takes it by itself at each question) is no keyboard.
    expect(root.dataset.keyboard).toBeUndefined();
    vv.move(400, 300);
    expect(root.dataset.keyboard).toBe("open");
    expect(root.style.getPropertyValue("--ss-vv-h")).toBe("");
    expect(root.style.getPropertyValue("--ss-vv-top")).toBe("");
    // The keyboard is put away with the field still in focus.
    vv.move(844);
    expect(root.dataset.keyboard).toBeUndefined();
  });

  it("sees the keyboard where the browser shrinks the whole window with it", () => {
    touchScreen(true);
    const { root, field } = layout();
    act(() => field.focus());
    windowHeight(400);
    vv.move(400);
    expect(root.dataset.keyboard).toBe("open");
  });

  it("is not open when nothing is typed into", () => {
    touchScreen(true);
    const { root } = layout();
    vv.move(400);
    expect(root.dataset.keyboard).toBeUndefined();
  });

  it("takes a finger on the field as the keyboard, until the field is left", () => {
    touchScreen(true);
    const { root, field } = layout();
    act(() => field.focus());
    fireEvent.pointerDown(field);
    frame();
    // The viewport has said nothing (a browser whose numbers cannot be trusted).
    expect(root.dataset.keyboard).toBe("open");
    act(() => field.blur());
    frame();
    expect(root.dataset.keyboard).toBeUndefined();
  });

  it("stops taking a finger for it once the viewport has been seen to measure", () => {
    touchScreen(true);
    const { root, field } = layout();
    act(() => field.focus());
    vv.move(400);
    vv.move(844);
    expect(root.dataset.keyboard).toBeUndefined();
    fireEvent.pointerDown(field);
    frame();
    expect(root.dataset.keyboard).toBeUndefined();
    vv.move(400);
    expect(root.dataset.keyboard).toBe("open");
  });
});
