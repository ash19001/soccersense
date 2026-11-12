import { act, render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { STOW_ATTR, stowDistance, useStowSlide } from "./useStowSlide";

/** Two things that leave at the kick-off, like the captions and the phone's trophy. */
function Both({ stowed }: { stowed: boolean }) {
  const a = useRef<HTMLDivElement | null>(null);
  const b = useRef<HTMLButtonElement | null>(null);
  useStowSlide(a, stowed);
  useStowSlide(b, stowed);
  return (
    <>
      <div ref={a} data-stow="" className={stowed ? "is-stowed" : ""}>
        captions
      </div>
      <button ref={b} data-stow="" type="button">
        trophy
      </button>
    </>
  );
}

function tops(map: Record<string, number>) {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      const top = map[this.textContent ?? ""] ?? 0;
      return {
        top,
        left: 0,
        right: 0,
        bottom: top,
        width: 0,
        height: 0,
        x: 0,
        y: top,
        toJSON() {},
      } as DOMRect;
    },
  );
}

function motion(reduce: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: reduce && query.includes("reduce"),
      addEventListener() {},
      removeEventListener() {},
    })),
  );
}

const shift = (el: Element) =>
  Number(
    /translateY\((-?[\d.]+)px\)/.exec((el as HTMLElement).style.transform)?.[1],
  );

describe("useStowSlide", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("requestAnimationFrame", (draw: FrameRequestCallback) =>
      window.setTimeout(() => draw(performance.now()), 16),
    );
    vi.stubGlobal("cancelAnimationFrame", (id: number) =>
      window.clearTimeout(id),
    );
    vi.stubGlobal("innerHeight", 800);
    vi.stubGlobal("devicePixelRatio", 3);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test("the distance takes the highest of them just off the bottom of the screen", () => {
    tops({ captions: 700, trophy: 640 });
    render(<Both stowed={false} />);
    expect(STOW_ATTR).toBe("data-stow");
    expect(stowDistance(document)).toBe(160);
  });

  test("at the kick-off they slide down together, every frame, on whole device pixels, then rest hidden", () => {
    motion(false);
    tops({ captions: 700, trophy: 640 });
    const { rerender, getByText } = render(<Both stowed={false} />);
    const captions = getByText("captions");
    const trophy = getByText("trophy");
    rerender(<Both stowed />);
    expect(captions).toHaveAttribute("data-sliding");
    expect(trophy).toHaveAttribute("data-sliding");
    const seen: number[] = [];
    for (let i = 0; i < 30 && captions.hasAttribute("data-sliding"); i++) {
      act(() => {
        vi.advanceTimersByTime(16);
      });
      if (captions.hasAttribute("data-sliding")) {
        seen.push(shift(captions));
        // Together: the same distance at the same moment.
        expect(shift(trophy)).toBe(shift(captions));
      }
    }
    expect(seen.length).toBeGreaterThan(10);
    for (let i = 1; i < seen.length; i++) {
      expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1]);
      // Whole device pixels (the test DOM keeps a few decimals of a transform).
      expect(Math.abs(seen[i] * 3 - Math.round(seen[i] * 3))).toBeLessThan(
        0.01,
      );
    }
    expect(seen.at(-1)).toBeLessThanOrEqual(160);
    // At rest the class holds it: no slide left on the element.
    expect(captions).not.toHaveAttribute("data-sliding");
    expect(captions.style.transform).toBe("");
    // Back is instant.
    rerender(<Both stowed={false} />);
    expect(captions.style.transform).toBe("");
  });

  test("under reduced motion they are simply gone", () => {
    motion(true);
    tops({ captions: 700, trophy: 640 });
    const { rerender, getByText } = render(<Both stowed={false} />);
    rerender(<Both stowed />);
    expect(getByText("captions")).not.toHaveAttribute("data-sliding");
    expect(getByText("captions").style.transform).toBe("");
  });
});
