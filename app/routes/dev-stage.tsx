// The canvas host's test card at /dev/stage: a GameLayout with a PixelStage running a small
// scene that exists only to prove the host. Like /dev/ui it is a development aid.
//
//   ?time=HH:MM   pin the clock, to see the sky at another hour (read by useDeviceSky)
//   ?pause=1      hold the loop: the clock on the card stops
//   ?speed=<n>    multiply time (0.25 is slow motion, 4 is fast forward)
//   ?bench=1      time the host: the mean cost of a frame without the scene's own work
//
// The card also proves the units: the read-out gives the device pixel ratio and how many
// DEVICE pixels a logical pixel, a font pixel and a caption pixel are, and the plate at the
// bottom carries the same proof for the DOM (two checkerboards and the four faces).
//
//   node tools/shoot.mjs "http://localhost:5173/dev/stage?time=23:00" .snaps/stage.png --move 200,300
//
// What is on the card, and what each part proves, is listed in docs/API_UI.md.

import { useEffect, useLayoutEffect, useSyncExternalStore } from "react";

import type { Lighting } from "~/art/lighting";
import { P } from "~/art/palette";
import { drawSky } from "~/art/sky";
import { FONT_3x5, type Surface, drawText } from "~/pixel";
import type { PointerInfo, Scene } from "~/scenes/scene";
import {
  type Bitmap,
  GameLayout,
  Panel,
  PixelGlyph,
  PixelStage,
  useDeviceSky,
  usePixelRootScale,
} from "~/ui";
import type { Route } from "./+types/dev-stage";

export const meta: Route.MetaFunction = () => [
  { title: "Stage test card · soccersense" },
  { name: "robots", content: "noindex" },
];

// --- the test scene ---------------------------------------------------------------------------

/** Where the crispness patterns sit, relative to the horizon. Fixed, so shots can clip them. */
const CHECKER = { x: 6, dy: 6, size: 24 } as const;
const SWATCHES = [
  P.chalk,
  P.concrete,
  P.grass,
  P.home,
  P.away,
  P.gold,
] as const;

interface Marker {
  x: number;
  y: number;
  type: PointerInfo["type"];
  down: boolean;
  touch: boolean;
}

/**
 * A test card, not art. Everything on it is there to show one thing about the host:
 * the sky (the light arrives), the checkerboard and hairlines (one logical pixel is one
 * hard-edged block), the frame and the cross (where the surface sits on the screen), the
 * marker (pointer mapping) and the clock (the loop, pausing, time scale).
 */
class TestScene implements Scene {
  /** CSS pixels per logical pixel, for the read-out. The page sets it. */
  px = 0;
  /**
   * The device's side of the scale, for the read-out: the device pixel ratio, then device
   * pixels per logical pixel, per font pixel and per caption pixel. The page sets it.
   */
  device = "";
  /** The bench read-out. The page sets it. */
  bench = "";
  /** Set by the page under ?bench=1: the scene then times its own update and draw. */
  clock: (() => number) | null = null;
  /** Milliseconds spent in update and draw since the page last took the figure. */
  spent = 0;

  private w = 1;
  private h = 1;
  private light: Lighting | null = null;
  private reduced = false;
  private t = 0;
  private frames = 0;
  private marker: Marker | null = null;

  resize(w: number, h: number): void {
    this.w = w;
    this.h = h;
  }

  setLighting(light: Lighting): void {
    this.light = light;
  }

  setReducedMotion(on: boolean): void {
    this.reduced = on;
  }

  update(dt: number): void {
    const from = this.clock?.() ?? 0;
    this.t += dt;
    this.frames += 1;
    if (this.clock) this.spent += this.clock() - from;
  }

  pointer(p: PointerInfo): void {
    if (p.type === "leave") {
      this.marker = this.marker && {
        ...this.marker,
        type: "leave",
        down: false,
      };
      return;
    }
    const wasDown = this.marker?.down ?? false;
    this.marker = {
      x: p.x,
      y: p.y,
      type: p.type,
      down: p.type === "down" || (p.type === "move" && wasDown),
      touch: p.touch === true,
    };
  }

  cursor(): "default" | "pointer" {
    const m = this.marker;
    if (!m || m.type === "leave") return "default";
    const top = this.horizon() + CHECKER.dy;
    const over =
      m.x >= CHECKER.x &&
      m.x < CHECKER.x + CHECKER.size &&
      m.y >= top &&
      m.y < top + CHECKER.size;
    return over ? "pointer" : "default";
  }

  draw(s: Surface): void {
    const from = this.clock?.() ?? 0;
    this.paint(s);
    if (this.clock) this.spent += this.clock() - from;
  }

  private horizon(): number {
    return Math.round(this.h * 0.3);
  }

  private paint(s: Surface): void {
    const light = this.light;
    if (!light) {
      s.clear(P.ink);
      return;
    }
    const { w, h } = this;
    const horizon = this.horizon();
    const cx = Math.floor(w / 2);
    const cy = Math.floor(h / 2);

    // The sky in the current light, and a ground lit by it.
    drawSky(s, { light, t: this.t, seed: 7, horizonY: horizon });
    s.rect(0, horizon, w, h - horizon, light.env(P.grassDark));

    // Colours under the sky (top row) and under the floodlights (bottom row).
    SWATCHES.forEach((c, i) => {
      s.rect(6 + i * 8, cy + 8, 7, 7, light.env(c));
      s.rect(6 + i * 8, cy + 16, 7, 7, light.lit(c));
    });

    // Crispness: a 1 px checkerboard, then hairlines, a diagonal and a dot grid on ink.
    const top = horizon + CHECKER.dy;
    for (let y = 0; y < CHECKER.size; y++) {
      for (let x = 0; x < CHECKER.size; x++) {
        s.px(CHECKER.x + x, top + y, (x + y) % 2 === 0 ? P.chalk : P.ink);
      }
    }
    const lx = CHECKER.x + CHECKER.size + 6;
    s.rect(lx, top, 22, CHECKER.size, P.ink);
    for (let i = 0; i < 5; i++) {
      s.vline(lx + 1 + i * 2, top + 1, 10, P.chalk);
      s.hline(lx + 12, top + 1 + i * 2, 9, P.chalk);
    }
    s.line(lx + 1, top + 13, lx + 10, top + 22, P.chalk);
    for (let y = 0; y < 10; y += 2) {
      for (let x = 0; x < 9; x += 2) s.px(lx + 12 + x, top + 13 + y, P.chalk);
    }

    // Placement: a cross on the centre column and row, a frame on the outer edge.
    s.vline(cx, 0, h, P.home);
    s.hline(0, cy, w, P.home);
    s.frame(0, 0, w, h, P.amber);

    // Read-outs.
    const big = { outline: P.ink, tabular: true };
    const small = { ...big, font: FONT_3x5 };
    const sun = light.sun.elevation.toFixed(1);
    drawText(s, `${w}x${h} PX ${this.px}`, 5, 5, P.chalk, big);
    drawText(s, `T ${this.t.toFixed(2)}`, 5, 15, P.gold, big);
    drawText(s, `${light.phase.toUpperCase()} SUN ${sun}`, 5, 25, P.chalk, big);
    const flags = [
      `F ${this.frames}`,
      light.lightsOn ? "LIGHTS" : "",
      this.reduced ? "REDUCED" : "",
    ];
    drawText(s, flags.filter(Boolean).join(" "), 5, 36, P.chalk, small);
    const m = this.marker;
    const where = m
      ? `PTR ${m.x.toFixed(1)},${m.y.toFixed(1)} ${m.type.toUpperCase()}${m.down ? " HELD" : ""}${m.touch ? " TOUCH" : ""}`
      : "PTR NONE";
    drawText(s, where, 5, 44, P.chalk, small);
    drawText(s, this.device, 5, 52, P.chalk, small);
    if (this.bench) drawText(s, this.bench, 5, 60, P.gold, small);

    // The marker: the white pixel is the logical pixel the pointer is in.
    if (m && m.type !== "leave") {
      const x = Math.floor(m.x);
      const y = Math.floor(m.y);
      const arm = m.touch ? P.gradeTopbins : P.gold;
      if (m.down) {
        s.rect(x - 4, y - 4, 9, 9, P.away);
        s.frame(x - 4, y - 4, 9, 9, P.ink);
      } else {
        s.hline(x - 5, y, 11, arm);
        s.vline(x, y - 5, 11, arm);
      }
      s.px(x, y, P.white);
    }
  }
}

/** One scene for the page: it holds no browser state, so it is safe to make at import. */
const scene = new TestScene();

// --- the page ---------------------------------------------------------------------------------

function subscribeToNothing(): () => void {
  return () => {};
}

function readSearch(): string {
  return window.location.search;
}

function serverSearch(): null {
  return null;
}

/** Frames left out of the bench at the start, while the browser is still settling. */
const BENCH_WARM_UP = 30;

/**
 * Times every animation frame callback and takes off what the scene spent in update and
 * draw. What is left is the host: its bookkeeping and the copy to the canvas.
 */
function startBench(target: TestScene): () => void {
  const original = window.requestAnimationFrame;
  let frames = 0;
  let host = 0;
  let worst = 0;
  let inScene = 0;
  target.clock = () => performance.now();
  target.spent = 0;
  window.requestAnimationFrame = (callback) =>
    original.call(window, (now) => {
      const from = performance.now();
      callback(now);
      const whole = performance.now() - from;
      const sceneMs = target.spent;
      target.spent = 0;
      frames += 1;
      if (frames <= BENCH_WARM_UP) return;
      const n = frames - BENCH_WARM_UP;
      host += whole - sceneMs;
      inScene += sceneMs;
      worst = Math.max(worst, whole - sceneMs);
      if (n % 30 === 0) {
        target.bench = `HOST ${(host / n).toFixed(3)} MAX ${worst.toFixed(2)} SCENE ${(inScene / n).toFixed(2)} MS N ${n}`;
      }
    });
  return () => {
    window.requestAnimationFrame = original;
    target.clock = null;
    target.bench = "";
  };
}

/**
 * Tells the scene the scale for its read-out. It sits before the stage in the canvas slot:
 * layout effects run in tree order, so the number is there before the stage paints with it
 * (which matters under ?pause=1, when a frame is painted once and kept).
 */
function ScaleReadout() {
  const { px, fp, cp, dp, dpr } = usePixelRootScale();
  useLayoutEffect(() => {
    const device = (css: number) => Math.round(css * dpr);
    scene.px = px;
    scene.device = `DPR ${Number(dpr.toFixed(3))} DP ${dp} FP ${device(fp)} CP ${device(cp)}`;
  }, [px, fp, cp, dp, dpr]);
  return null;
}

/** An 8 x 8 checkerboard of single cells, for the plate: one cell is one unit. */
const CHECKER_BITMAP: Bitmap = Array.from({ length: 8 }, (_, y) =>
  y % 2 === 0 ? "#.#.#.#." : ".#.#.#.#",
);

export default function DevStage() {
  // The query string is only known in the browser. `null` is the build-time render.
  const search = useSyncExternalStore(
    subscribeToNothing,
    readSearch,
    serverSearch,
  );
  const params = new URLSearchParams(search ?? "");
  const paused = params.get("pause") === "1";
  const speedText = params.get("speed");
  const speed = speedText === null ? 1 : Number(speedText);
  const bench = params.get("bench") === "1";

  const sky = useDeviceSky();

  useEffect(() => {
    if (!bench) return;
    return startBench(scene);
  }, [bench]);

  return (
    <GameLayout
      canvas={
        <>
          <ScaleReadout />
          <PixelStage
            scene={scene}
            light={sky?.light ?? null}
            paused={paused}
            timeScale={speed}
          />
        </>
      }
      bottom={
        <Panel variant="plain" className="ss-t10">
          <p>
            /dev/stage: this plate is DOM, in the interface column. Everything
            else is the canvas.
          </p>
          {/* The DOM's own proof: a cell of each unit, and each face on its font pixel. */}
          <div
            className="flex flex-wrap items-end gap-x-[var(--u3)] gap-y-[var(--u)] pt-[var(--u2)]"
            data-proof="dom"
          >
            <span data-proof="px">
              <PixelGlyph bitmap={CHECKER_BITMAP} />
            </span>
            <span data-proof="fp">
              <PixelGlyph bitmap={CHECKER_BITMAP} unit="fp" />
            </span>
            <span className="ss-t10" data-proof="t10">
              Jersey 10
            </span>
            <span className="ss-t15" data-proof="t15">
              15
            </span>
            <span className="ss-t20" data-proof="t20">
              20
            </span>
            <span className="ss-t25" data-proof="t25">
              25
            </span>
          </div>
        </Panel>
      }
    />
  );
}
