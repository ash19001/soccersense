import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { type ReactNode, useRef, useState } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, test, vi } from "vitest";

import { HowToPlay, HowToPlayCard, type HowToPlayCardProps } from "./HowToPlay";
import { DEFAULT_SCALE, PixelScaleContext, pixelScale } from "./scale";

const CARD: Pick<HowToPlayCardProps, "labels" | "shots" | "tiers"> = {
  labels: {
    heading: "HOW TO PLAY",
    close: "Close",
    intro: "7 questions a day.",
    shots: "POINTS",
    points: (points) => `${points} points`,
    career: "YOUR CAREER",
    step: (tier, from) => `${tier}, from ${from} points`,
  },
  shots: [
    { grade: "worldie", label: "WORLDIE", points: 100 },
    { grade: "golazo", label: "GOLAZO", points: 80 },
    { grade: "trivela", label: "TRIVELA", points: 60 },
    { grade: "toepoke", label: "TOE POKE", points: 30 },
    { grade: "tapin", label: "TAP IN", points: 10 },
    { grade: "miss", label: "MISS", points: 0 },
  ],
  tiers: [
    "PARK KICKABOUT",
    "SUNDAY LEAGUE",
    "NON-LEAGUE",
    "LOWER LEAGUES",
    "TOP FLIGHT",
    "INTERNATIONAL",
    "WORLD CUP FINAL",
    "WORLD CUP WINNER",
  ].map((name, i) => ({ name, from: i * 90 })),
};

const MONITOR = pixelScale(1920, 1080);

function at(scale: typeof MONITOR, node: ReactNode) {
  return <PixelScaleContext value={scale}>{node}</PixelScaleContext>;
}

/** The home screen's part: the "?" button and the dialog it opens. */
function Host({ onClose }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement | null>(null);
  return (
    <>
      <button ref={button} type="button" onClick={() => setOpen(true)}>
        ?
      </button>
      <button type="button">behind</button>
      <HowToPlay
        {...CARD}
        open={open}
        onClose={() => {
          onClose?.();
          setOpen(false);
        }}
        returnFocus={button}
      />
    </>
  );
}

function openIt(scale = DEFAULT_SCALE, onClose?: () => void) {
  render(at(scale, <Host onClose={onClose} />));
  const opener = screen.getByRole("button", { name: "?" });
  act(() => opener.focus());
  fireEvent.click(opener);
  const dialog = document.querySelector("dialog");
  if (!dialog) throw new Error("no dialog");
  return { opener, dialog };
}

/** A browser that animates, with no reduced motion asked for. */
function withMotion() {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    })),
  );
  // Frames on the (fake) clock.
  vi.stubGlobal("requestAnimationFrame", (draw: FrameRequestCallback) =>
    window.setTimeout(() => draw(performance.now()), 16),
  );
  vi.stubGlobal("cancelAnimationFrame", (id: number) =>
    window.clearTimeout(id),
  );
  const proto = Element.prototype as { getAnimations?: () => Animation[] };
  const had = "getAnimations" in proto;
  proto.getAnimations = () => [];
  return () => {
    if (!had) delete proto.getAnimations;
  };
}

/** Two frames: the dialog's first is drawn, and the card starts to rise. */
function rise() {
  act(() => {
    vi.advanceTimersByTime(40);
  });
}

/** The end of one of the card's animations (the test DOM's own event has no name). */
function animationEnd(el: Element, name: string) {
  const event = new Event("animationend", { bubbles: true });
  Object.defineProperty(event, "animationName", { value: name });
  fireEvent(el, event);
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("HowToPlayCard", () => {
  test("says it all: the line, the six shots in their colours, the career", () => {
    render(at(DEFAULT_SCALE, <HowToPlayCard {...CARD} />));
    expect(
      screen.getByRole("heading", { level: 2, name: "HOW TO PLAY" }),
    ).toBeInTheDocument();
    expect(screen.getByText("7 questions a day.")).toBeInTheDocument();
    expect(
      screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent),
    ).toEqual(["POINTS", "YOUR CAREER"]);
    // Nothing on the modes: each has its own rule on the home screen and the board.
    expect(document.querySelector(".ss-badge")).toBeNull();
    // The shots, best first, each in its grade's colour, the points read out as points.
    const shots = document.querySelectorAll(".ss-help__shot");
    expect([...shots].map((li) => li.getAttribute("data-grade"))).toEqual([
      "worldie",
      "golazo",
      "trivela",
      "toepoke",
      "tapin",
      "miss",
    ]);
    expect(shots[0]).toHaveTextContent("WORLDIE");
    expect(within(shots[0] as HTMLElement).getByText("100 points")).toHaveClass(
      "ss-sr",
    );
    // The ladder: a step a tier, the top one gold, each read out; the two ends named.
    const steps = screen
      .getAllByRole("listitem")
      .filter((li) => li.classList.contains("ss-help__step"));
    expect(steps).toHaveLength(8);
    expect(steps.at(-1)).toHaveClass("is-top");
    expect(steps[1]).toHaveTextContent("SUNDAY LEAGUE, from 90 points");
    const ends = document.querySelector(".ss-help__ends");
    expect(ends).toHaveAttribute("aria-hidden", "true");
    expect(ends).toHaveTextContent("PARK KICKABOUT");
    expect(ends).toHaveTextContent("WORLD CUP WINNER");
    // And no more words than that.
    expect(document.querySelectorAll(".ss-help__body p")).toHaveLength(2);
  });

  test("lies down on a wide screen, in caption pixels", () => {
    const { rerender } = render(at(DEFAULT_SCALE, <HowToPlayCard {...CARD} />));
    expect(document.querySelector(".ss-help")).not.toHaveAttribute("data-wide");
    rerender(at(MONITOR, <HowToPlayCard {...CARD} />));
    expect(document.querySelector(".ss-help")).toHaveAttribute("data-wide");
  });

  test("on a page of its own the heading is the page's, and can take the focus", () => {
    let heading: HTMLHeadingElement | null = null;
    render(
      at(
        DEFAULT_SCALE,
        <HowToPlayCard
          {...CARD}
          headingLevel={1}
          headingRef={(el) => {
            heading = el;
          }}
        />,
      ),
    );
    const h1 = screen.getByRole("heading", { level: 1, name: "HOW TO PLAY" });
    expect(h1).toBe(heading);
    expect(h1).toHaveAttribute("tabindex", "-1");
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(2);
  });

  test("has the small print at its foot when given it", () => {
    const legal = "An independent fan game.";
    render(
      at(
        MONITOR,
        <HowToPlayCard
          {...CARD}
          labels={{ ...CARD.labels, disclaimer: legal }}
        />,
      ),
    );
    const small = screen.getByText(legal);
    expect(small).toHaveClass("ss-legal");
    // Last in the card's body, after the career.
    expect(document.querySelector(".ss-help__body")?.lastElementChild).toBe(
      small,
    );
  });

  test("renders at build time", () => {
    const html = renderToString(at(DEFAULT_SCALE, <HowToPlayCard {...CARD} />));
    expect(html).toContain("HOW TO PLAY");
    expect(html).toContain("TOE POKE");
  });
});

describe("HowToPlay", () => {
  test("with no intro there is no line under the heading and no description", () => {
    const labels = { ...CARD.labels, intro: undefined };
    render(
      at(
        DEFAULT_SCALE,
        <HowToPlay {...CARD} labels={labels} open onClose={() => {}} />,
      ),
    );
    const dialog = document.querySelector("dialog");
    expect(dialog).not.toHaveAttribute("aria-describedby");
    expect(dialog?.querySelector(".ss-help__intro")).toBeNull();
    // The rest is all there.
    expect(screen.getByText("TOE POKE")).toBeInTheDocument();
  });

  test("is nothing while it is not open", () => {
    render(
      at(
        DEFAULT_SCALE,
        <HowToPlay {...CARD} open={false} onClose={() => {}} />,
      ),
    );
    expect(document.querySelector("dialog")).toBeNull();
  });

  test("opens as a modal dialog named by its heading, the focus on its close button", () => {
    const { dialog } = openIt();
    expect(dialog).toHaveAttribute("open");
    expect(dialog).toHaveClass("ss-help-dialog");
    expect(dialog).toHaveAccessibleName("HOW TO PLAY");
    expect(dialog).toHaveAccessibleDescription("7 questions a day.");
    expect(dialog.querySelector(".ss-help")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
  });

  test("a monitor gets the card in the middle; a phone the whole screen", () => {
    expect(openIt(MONITOR).dialog).toHaveAttribute("data-wide");
  });

  test("closes by its close button, and the focus goes back to the ? button", () => {
    const onClose = vi.fn();
    const { opener } = openIt(DEFAULT_SCALE, onClose);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(document.querySelector("dialog")).toBeNull();
    expect(opener).toHaveFocus();
  });

  test("closes by Escape", () => {
    const onClose = vi.fn();
    const { opener, dialog } = openIt(DEFAULT_SCALE, onClose);
    fireEvent.keyDown(screen.getByRole("button", { name: "Close" }), {
      key: "Escape",
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(dialog.isConnected).toBe(false);
    expect(opener).toHaveFocus();
  });

  test("the browser's own close request (cancel) plays the way out instead", () => {
    const onClose = vi.fn();
    const { dialog } = openIt(DEFAULT_SCALE, onClose);
    const cancel = new Event("cancel", { cancelable: true });
    act(() => {
      dialog.dispatchEvent(cancel);
    });
    expect(cancel.defaultPrevented).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("closes by a press outside the card, not by one on it", () => {
    const onClose = vi.fn();
    const { dialog } = openIt(DEFAULT_SCALE, onClose);
    const intro = screen.getByText("7 questions a day.");
    fireEvent.pointerDown(intro);
    fireEvent.click(intro);
    // A press that starts on the card and ends outside it (selecting text) is not one.
    fireEvent.pointerDown(intro);
    fireEvent.click(dialog);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.pointerDown(dialog);
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("keeps the focus inside: Tab goes round the dialog", () => {
    openIt();
    const close = screen.getByRole("button", { name: "Close" });
    const tab = fireEvent.keyDown(close, { key: "Tab" });
    expect(tab).toBe(false);
    expect(close).toHaveFocus();
    const back = fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
    expect(back).toBe(false);
    expect(close).toHaveFocus();
  });

  test("with motion a monitor's card drops away first, then asks to be closed", () => {
    const undo = withMotion();
    try {
      vi.useFakeTimers();
      const onClose = vi.fn();
      const { dialog } = openIt(MONITOR, onClose);
      // Below the screen until its first frame is drawn, then rising.
      expect(dialog).toHaveClass("is-waiting");
      rise();
      expect(dialog).toHaveClass("is-rising");
      fireEvent.click(screen.getByRole("button", { name: "Close" }));
      expect(dialog).toHaveClass("is-leaving");
      expect(onClose).not.toHaveBeenCalled();
      // A second request while it is leaving changes nothing.
      fireEvent.keyDown(dialog, { key: "Escape" });
      const card = dialog.querySelector(".ss-help") as HTMLElement;
      animationEnd(card, "ss-help-in");
      expect(onClose).not.toHaveBeenCalled();
      animationEnd(card, "ss-help-out");
      expect(onClose).toHaveBeenCalledTimes(1);
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    } finally {
      undo();
    }
  });

  test("with motion, it closes anyway if the way out never reports its end", () => {
    const undo = withMotion();
    try {
      vi.useFakeTimers();
      const onClose = vi.fn();
      openIt(MONITOR, onClose);
      rise();
      fireEvent.click(screen.getByRole("button", { name: "Close" }));
      expect(onClose).not.toHaveBeenCalled();
      act(() => {
        vi.advanceTimersByTime(400);
      });
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(document.querySelector("dialog")).toBeNull();
    } finally {
      undo();
    }
  });

  test("with motion a phone's sheet slides up from below the screen and back down, then closes", () => {
    const undo = withMotion();
    try {
      vi.useFakeTimers();
      const onClose = vi.fn();
      const { dialog } = openIt(DEFAULT_SCALE, onClose);
      expect(dialog).not.toHaveAttribute("data-wide");
      const card = dialog.querySelector(".ss-help") as HTMLElement;
      // Two frames below the screen, then it starts from just under it, on a whole pixel.
      rise();
      const shift = () =>
        Number(/translateY\((-?[\d.]+)px\)/.exec(card.style.transform)?.[1]);
      const ys = [shift()];
      for (let i = 0; i < 30 && card.style.transform; i++) {
        act(() => {
          vi.advanceTimersByTime(16);
        });
        if (card.style.transform) ys.push(shift());
      }
      expect(ys[0]).toBeGreaterThan(0);
      // Up all the way, a little less each frame, and at rest it carries no slide.
      for (let i = 1; i < ys.length; i++) {
        expect(ys[i]).toBeLessThanOrEqual(ys[i - 1]);
      }
      expect(ys.length).toBeGreaterThan(10);
      expect(card.style.transform).toBe("");
      // Closed: down it goes, and only once it is gone is the page told.
      fireEvent.click(screen.getByRole("button", { name: "Close" }));
      act(() => {
        vi.advanceTimersByTime(16 * 3);
      });
      expect(shift()).toBeGreaterThan(0);
      expect(onClose).not.toHaveBeenCalled();
      act(() => {
        vi.advanceTimersByTime(330);
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    } finally {
      undo();
    }
  });

  test("with motion, closed before it has started to rise, it goes at once", () => {
    const undo = withMotion();
    try {
      vi.useFakeTimers();
      const onClose = vi.fn();
      openIt(DEFAULT_SCALE, onClose);
      fireEvent.keyDown(screen.getByRole("button", { name: "Close" }), {
        key: "Escape",
      });
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(document.querySelector("dialog")).toBeNull();
    } finally {
      undo();
    }
  });

  test("reduced motion: it closes at once", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: true,
        addEventListener() {},
        removeEventListener() {},
      })),
    );
    const onClose = vi.fn();
    openIt(DEFAULT_SCALE, onClose);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
