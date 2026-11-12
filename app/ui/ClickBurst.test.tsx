import { act, fireEvent, render } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  BURST_FRAMES,
  BURST_FRAME_MS,
  ClickBurst,
  MAX_BURSTS,
} from "./ClickBurst";

/** A `matchMedia` that answers `reduce` for the reduced-motion query. */
function motion(reduce: boolean) {
  return vi.fn((query: string) => ({
    matches: reduce && query.includes("reduce"),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }));
}

function press(x: number, y: number, init: Record<string, unknown> = {}) {
  fireEvent.pointerDown(document.body, {
    clientX: x,
    clientY: y,
    button: 0,
    isPrimary: true,
    pointerType: "mouse",
    ...init,
  });
}

const bursts = () => document.querySelectorAll(".ss-burst__at");

describe("ClickBurst", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("matchMedia", motion(false));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  test("draws nothing until a press", () => {
    render(<ClickBurst />);
    expect(document.querySelector(".ss-burst")).toBeNull();
  });

  test("over a modal dialog (in the top layer) the burst is drawn inside it, to be seen", () => {
    render(<ClickBurst />);
    const dialog = document.createElement("dialog");
    document.body.append(dialog);
    try {
      dialog.setAttribute("open", "");
      // The test DOM has no top layer: this one is modal.
      const matches = dialog.matches.bind(dialog);
      dialog.matches = (selector: string) =>
        selector === ":modal" || matches(selector);
      act(() => press(40, 60));
      expect(dialog.querySelector(".ss-burst__at")).not.toBeNull();
      dialog.remove();
      // With the dialog gone, the next press is drawn on the page again.
      act(() => press(50, 70));
      const layer = document.querySelector(".ss-burst");
      expect(layer?.closest("dialog")).toBeNull();
      expect(bursts()).toHaveLength(2);
    } finally {
      dialog.remove();
    }
  });

  test("a press makes a burst where the pointer is, out of the way of presses", () => {
    render(<ClickBurst />);
    act(() => press(120, 80));
    const layer = document.querySelector(".ss-burst");
    expect(layer).toHaveAttribute("aria-hidden", "true");
    expect(bursts()).toHaveLength(1);
    const at = bursts()[0] as HTMLElement;
    expect(at.style.left).toContain("120px");
    expect(at.style.top).toContain("80px");
    // Four frames, one after another.
    const frames = at.querySelectorAll<HTMLElement>(".ss-burst__frame");
    expect(frames).toHaveLength(BURST_FRAMES.length);
    expect([...frames].map((f) => f.style.animationDelay)).toEqual(
      BURST_FRAMES.map((_, i) => `${i * BURST_FRAME_MS}ms`),
    );
  });

  test("is gone again after its frames", () => {
    render(<ClickBurst />);
    act(() => press(10, 10));
    expect(bursts()).toHaveLength(1);
    act(() => vi.advanceTimersByTime(BURST_FRAME_MS * BURST_FRAMES.length));
    expect(bursts()).toHaveLength(1);
    act(() => vi.advanceTimersByTime(BURST_FRAME_MS * 2));
    expect(document.querySelector(".ss-burst")).toBeNull();
  });

  test("keeps only a few at once", () => {
    render(<ClickBurst />);
    act(() => {
      for (let i = 0; i < MAX_BURSTS + 3; i++) press(i * 10, 10);
    });
    expect(bursts()).toHaveLength(MAX_BURSTS);
    // The newest are the ones kept.
    expect((bursts()[MAX_BURSTS - 1] as HTMLElement).style.left).toContain(
      `${(MAX_BURSTS + 2) * 10}px`,
    );
  });

  test("a right click or a second finger makes none", () => {
    render(<ClickBurst />);
    act(() => press(10, 10, { button: 2 }));
    act(() => press(10, 10, { isPrimary: false, pointerType: "touch" }));
    expect(document.querySelector(".ss-burst")).toBeNull();
  });

  test("a tap makes one", () => {
    render(<ClickBurst />);
    act(() => press(30, 40, { pointerType: "touch", button: 0 }));
    expect(bursts()).toHaveLength(1);
  });

  test("nothing under reduced motion", () => {
    vi.stubGlobal("matchMedia", motion(true));
    render(<ClickBurst />);
    act(() => press(10, 10));
    expect(document.querySelector(".ss-burst")).toBeNull();
  });

  test("stops listening when it goes", () => {
    const { unmount } = render(<ClickBurst />);
    act(() => press(10, 10));
    unmount();
    // No timer left to set state on an unmounted component.
    expect(vi.getTimerCount()).toBe(0);
    press(10, 10);
    expect(document.querySelector(".ss-burst")).toBeNull();
  });

  test("renders nothing at build time", () => {
    expect(renderToString(<ClickBurst />)).toBe("");
  });
});

describe("the burst's drawing", () => {
  test("every frame is the same square, and the burst is symmetrical", () => {
    const size = BURST_FRAMES[0]!.length;
    for (const frame of BURST_FRAMES) {
      expect(frame).toHaveLength(size);
      for (const row of frame) expect(row).toHaveLength(size);
      // Without the shadow (a cell down and right), the colours mirror left to right.
      const colours = frame.slice(0, -1).map((row) => row.slice(0, -1));
      const plain = colours.map((row) => row.replace(/k/g, "."));
      expect(plain).toEqual(plain.map((row) => [...row].reverse().join("")));
    }
  });

  test("goes from a chalk plus to sparks that cool to dark gold", () => {
    const has = (i: number, char: string) =>
      BURST_FRAMES[i]!.some((row) => row.includes(char));
    expect(has(0, "c")).toBe(true);
    expect(has(1, "l")).toBe(true);
    expect(has(2, "g")).toBe(true);
    expect(has(3, "d")).toBe(true);
    expect(BURST_FRAMES.every((_, i) => has(i, "k"))).toBe(true);
  });
});
