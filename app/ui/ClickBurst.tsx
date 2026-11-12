import { type CSSProperties, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { type Bitmap, type GlyphLayer, PixelGlyph } from "./PixelGlyph";
import { pixelVariables, usePixelScale } from "./scale";

/**
 * The burst a press makes: a chalk plus where the pointer landed, then eight gold sparks
 * flying out, cooling from pale gold to dark gold, gone after four frames. Drawn in logical
 * pixels with a hard ink shadow, like everything else in the kit.
 */

/** How long one frame of the burst is on screen. Four frames: about a quarter second. */
export const BURST_FRAME_MS = 60;
/** The most bursts on screen at once: a fifth press takes the place of the oldest. */
export const MAX_BURSTS = 4;

/** Cells from the point to the edge of the drawing, which is twice this plus the shadow. */
const REACH = 8;
const GRID = REACH * 2 + 1;

/** A square of cells: its top left in cells from the point, its size, its colour. */
interface Cell {
  x: number;
  y: number;
  size: number;
  char: string;
}

const CARDINAL = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
] as const;
const DIAGONAL = [
  [1, -1],
  [1, 1],
  [-1, 1],
  [-1, -1],
] as const;

/**
 * A spark `size` cells square, `r` cells out from the point along (dx, dy), placed so the
 * eight sparks stand symmetrically round the point (which is a corner between four cells).
 */
function spark(dx: number, dy: number, r: number, size: number, char: string) {
  const along = (d: number) => (d > 0 ? r : d < 0 ? -r - size : -size / 2);
  return { x: along(dx), y: along(dy), size, char };
}

function ring(
  cardinal: { r: number; size: number },
  diagonal: { r: number; size: number },
  char: string,
): Cell[] {
  return [
    ...CARDINAL.map(([dx, dy]) =>
      spark(dx, dy, cardinal.r, cardinal.size, char),
    ),
    ...DIAGONAL.map(([dx, dy]) =>
      spark(dx, dy, diagonal.r, diagonal.size, char),
    ),
  ];
}

/** "c" chalk, "l" pale gold, "g" gold, "d" dark gold; "k" is the ink shadow. */
const FRAMES: readonly Cell[][] = [
  // The impact: a chunky plus.
  [
    { x: -1, y: -1, size: 2, char: "c" },
    { x: -1, y: -3, size: 2, char: "c" },
    { x: 1, y: -1, size: 2, char: "c" },
    { x: -1, y: 1, size: 2, char: "c" },
    { x: -3, y: -1, size: 2, char: "c" },
  ],
  ring({ r: 2, size: 2 }, { r: 1, size: 2 }, "l"),
  ring({ r: 4, size: 2 }, { r: 3, size: 1 }, "g"),
  ring({ r: 6, size: 2 }, { r: 4, size: 1 }, "d"),
];

/** One frame as a bitmap, the point at cell (REACH, REACH), its shadow a cell down and right. */
function draw(cells: readonly Cell[]): Bitmap {
  const grid = Array.from({ length: GRID }, () =>
    Array.from({ length: GRID }, () => "."),
  );
  const paint = (x: number, y: number, char: string, over: boolean) => {
    const row = grid[y];
    if (!row || x < 0 || x >= GRID) return;
    if (over || row[x] === ".") row[x] = char;
  };
  for (const pass of ["shadow", "colour"] as const) {
    for (const cell of cells) {
      for (let j = 0; j < cell.size; j++) {
        for (let i = 0; i < cell.size; i++) {
          const x = REACH + cell.x + i;
          const y = REACH + cell.y + j;
          if (pass === "shadow") paint(x + 1, y + 1, "k", false);
          else paint(x, y, cell.char, true);
        }
      }
    }
  }
  return grid.map((row) => row.join(""));
}

export const BURST_FRAMES: readonly Bitmap[] = FRAMES.map(draw);

const LAYERS: readonly GlyphLayer[] = [
  { char: "k", className: "ss-burst__k" },
  { char: "c", className: "ss-burst__c" },
  { char: "l", className: "ss-burst__l" },
  { char: "g", className: "ss-burst__g" },
  { char: "d", className: "ss-burst__d" },
];

/** How long a burst is kept after it starts: its frames, and a frame to spare. */
const BURST_LIFE_MS = BURST_FRAME_MS * (FRAMES.length + 1);

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

interface Burst {
  id: number;
  /** The point in CSS px, on a whole device pixel. */
  x: number;
  y: number;
}

/**
 * The modal dialog on top, if one is open (the how-to-play pop-up, the leaderboard's phone
 * sheet). It is in the browser's top layer, above everything else on the page whatever its
 * z-index, so the burst is drawn inside it to be seen.
 */
function topModal(): HTMLElement | null {
  const open = document.querySelectorAll<HTMLDialogElement>("dialog[open]");
  for (let i = open.length - 1; i >= 0; i--) {
    const dialog = open[i];
    try {
      if (dialog.matches(":modal")) return dialog;
    } catch {
      // No :modal (an old browser, the test DOM): an open dialog is the best guess.
      return dialog;
    }
  }
  return null;
}

function reducedMotion(): boolean {
  try {
    return window.matchMedia?.(REDUCED_MOTION).matches ?? false;
  } catch {
    return false;
  }
}

/** A CSS length onto the nearest whole device pixel. */
function onDevicePixel(css: number): number {
  const ratio = window.devicePixelRatio || 1;
  return Math.round(css * ratio) / ratio;
}

/**
 * A small pixel burst wherever the mouse is pressed or the screen is tapped, anywhere in the
 * app. Mount it once, at the root. It draws nothing at build time and nothing until the
 * first press; it never takes a press (no pointer events), and it does nothing under
 * reduced motion.
 */
export function ClickBurst() {
  const scale = usePixelScale();
  const [bursts, setBursts] = useState<readonly Burst[]>([]);
  /** Where the layer is drawn: inside the modal dialog on top at the last press, if any. */
  const [host, setHost] = useState<HTMLElement | null>(null);
  const next = useRef(0);

  useEffect(() => {
    const timers = new Set<number>();
    const onPointerDown = (event: PointerEvent) => {
      if (event.isPrimary === false) return;
      // The main button only: a right click opens a menu, not a burst.
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (reducedMotion()) return;
      const burst: Burst = {
        id: next.current++,
        x: onDevicePixel(event.clientX ?? 0),
        y: onDevicePixel(event.clientY ?? 0),
      };
      setHost(topModal());
      setBursts((list) => [...list, burst].slice(-MAX_BURSTS));
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        setBursts((list) => list.filter((b) => b.id !== burst.id));
      }, BURST_LIFE_MS);
      timers.add(timer);
    };
    // The capture phase on the window: first to hear it, whatever stops it further down.
    window.addEventListener("pointerdown", onPointerDown, {
      capture: true,
      passive: true,
    });
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, {
        capture: true,
      });
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, []);

  if (bursts.length === 0) return null;

  const style = pixelVariables(scale) as CSSProperties;
  const layer = (
    <div className="ss-burst" style={style} aria-hidden="true">
      {bursts.map((burst) => (
        <div
          key={burst.id}
          className="ss-burst__at"
          style={{
            left: `calc(${burst.x}px - var(--px) * ${REACH})`,
            top: `calc(${burst.y}px - var(--px) * ${REACH})`,
          }}
        >
          {BURST_FRAMES.map((frame, i) => (
            <div
              key={i}
              className="ss-burst__frame"
              style={{ animationDelay: `${i * BURST_FRAME_MS}ms` }}
            >
              <PixelGlyph bitmap={frame} layers={LAYERS} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
  // Inside the modal dialog on top (while it is still there), so the burst shows over it.
  return host?.isConnected ? createPortal(layer, host) : layer;
}
