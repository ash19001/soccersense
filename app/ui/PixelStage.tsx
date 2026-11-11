import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";

import type { Lighting } from "~/art/lighting";
import { Surface } from "~/pixel";
import type { PointerInfo, Scene } from "~/scenes/scene";

import { cx } from "./cx";
import {
  deviceToCss,
  noticeDevicePixelRatio,
  usePixelRootScale,
} from "./scale";

export interface PixelStageProps {
  /** The scene to run. `null`: a plain ink canvas, nothing runs. */
  scene: Scene | null;
  /** The light to paint under. `null` until the page knows it: nothing runs before then. */
  light: Lighting | null;
  /** Hold the loop. The last frame stays up, and no time passes for the scene. */
  paused?: boolean;
  /** Multiplies `dt`. Default 1. A development aid (slow motion, fast forward). */
  timeScale?: number;
  className?: string;
}

/** No frame is ever longer than this for the scene, however long the browser stalled. */
const MAX_DT = 0.1;
/**
 * A frame that told the scene something new (its first frame, a new size, a new light) and
 * took this long itself (in ms) was the scene building its picture. That is tens of
 * milliseconds, and it is not time the animation should then jump over: the next frame
 * counts from the end of this one. Ordinary frames are always counted in full, however
 * long they take: on a slow device that is the animation's real time, and discounting it
 * would turn the whole menu (and the kick-off the page waits for) into slow motion.
 */
const LONG_FRAME_MS = 34;
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/**
 * Everything the loop needs, kept in one object for the life of the component. It is only
 * read and written from effects, event handlers and animation frames, never during render.
 */
interface Stage {
  ctx: CanvasRenderingContext2D | null;
  /** The framebuffer, and the same memory wrapped as an ImageData. Rebuilt per size. */
  surface: Surface | null;
  image: ImageData | null;

  // The inputs, copied in after every render.
  scene: Scene | null;
  light: Lighting | null;
  w: number;
  h: number;
  timeScale: number;
  reduced: boolean;
  /** There is a scene and a light and `paused` is off: the loop runs while visible. */
  running: boolean;

  // What `told` (the scene that was last drawn) has been told so far.
  told: Scene | null;
  toldW: number;
  toldH: number;
  toldLight: Lighting | null;
  toldReduced: boolean | null;
  /**
   * The canvas was emptied (a new size) and has not been painted since: it happened while
   * the document was hidden.
   */
  blank: boolean;

  /** The pending animation frame, or 0 while the loop is stopped. */
  raf: number;
  /** True until the first frame after a start: that frame has dt 0. */
  fresh: boolean;
  last: number;
}

function newStage(): Stage {
  return {
    ctx: null,
    surface: null,
    image: null,
    scene: null,
    light: null,
    w: 0,
    h: 0,
    timeScale: 1,
    reduced: false,
    running: false,
    told: null,
    toldW: 0,
    toldH: 0,
    toldLight: null,
    toldReduced: null,
    blank: false,
    raf: 0,
    fresh: true,
    last: 0,
  };
}

/** The 2D context, or null where there is none (old browsers, the test environment). */
function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  if (typeof ImageData === "undefined") return null;
  try {
    return canvas.getContext("2d") ?? null;
  } catch {
    return null;
  }
}

/** True when drawing a frame now would tell the scene something new. */
function stale(st: Stage): boolean {
  return (
    st.blank ||
    st.told !== st.scene ||
    st.toldW !== st.w ||
    st.toldH !== st.h ||
    st.toldLight !== st.light ||
    st.toldReduced !== st.reduced
  );
}

/**
 * One frame, always in this order: `resize` (new scene or new size), `setLighting` (new
 * scene or new light), `setReducedMotion` (new scene or a change), `update(dt)`,
 * `draw(surface)`, then the surface goes to the canvas. A scene's first frame has `dt` 0.
 */
function renderFrame(st: Stage, dt: number): void {
  const { ctx, scene, light, w, h } = st;
  if (!ctx || !scene || !light) return;

  if (st.told !== scene) {
    st.told = scene;
    st.toldW = 0;
    st.toldH = 0;
    st.toldLight = null;
    st.toldReduced = null;
    // The time since the last frame belongs to the scene that was up then, not this one.
    dt = 0;
  }
  if (st.toldW !== w || st.toldH !== h) {
    st.toldW = w;
    st.toldH = h;
    scene.resize(w, h);
  }
  if (st.toldLight !== light) {
    st.toldLight = light;
    scene.setLighting(light);
  }
  if (st.toldReduced !== st.reduced) {
    st.toldReduced = st.reduced;
    scene.setReducedMotion?.(st.reduced);
  }

  scene.update(dt);

  let surface = st.surface;
  let image = st.image;
  if (!surface || !image || surface.w !== w || surface.h !== h) {
    surface = new Surface(w, h);
    // A Color is 0xAABBGGRR, so on a little-endian machine (every browser there is) the
    // surface's bytes are already R, G, B, A. ImageData keeps the array it is given: this
    // is a second view of the framebuffer, not a copy, and it is made once per size.
    image = new ImageData(surface.bytes, w, h);
    st.surface = surface;
    st.image = image;
  }
  scene.draw(surface);
  ctx.putImageData(image, 0, 0);
  st.blank = false;
}

function hidden(): boolean {
  return document.visibilityState === "hidden";
}

/**
 * One frame outside the loop, with no time passing: the repaint after a change that the
 * loop is not running to pick up. A scene that throws here must not take the page down
 * with it (this runs inside React's commit, where an error unmounts everything up to the
 * error page): the error is reported as the loop's would be, and the page carries on with
 * the picture it had.
 */
function repaint(st: Stage): void {
  try {
    renderFrame(st, 0);
  } catch (error) {
    if (typeof window.reportError === "function") {
      window.reportError(error);
    } else {
      window.setTimeout(() => {
        throw error;
      });
    }
  }
}

/**
 * The canvas host. It goes in `GameLayout`'s `canvas` slot, fills it, and drives one
 * `Scene`: it owns the frame loop, the framebuffer and the pointer mapping.
 *
 * The canvas's backing store is exactly `logicalW` x `logicalH` (from the nearest
 * `PixelRoot`), shown at exactly `dp` device pixels per logical pixel (`px` CSS pixels,
 * which is a fraction at a fractional device pixel ratio) with nearest-neighbour scaling:
 * every logical pixel is the same whole block of device pixels at any display scaling or
 * zoom. Placement is in ui.css (section 19): the less than one logical pixel by which the
 * canvas is larger than the screen is split between the two sides in whole device pixels,
 * so the middle of the scene is the middle of the screen.
 *
 * The loop runs on `requestAnimationFrame` while there is a scene and a light, `paused` is
 * off and the document is visible. While it is paused, a change of scene, light or size
 * still repaints one frame with `dt` 0, so what is on screen is never out of date. While
 * the document is hidden nothing is painted at all: nobody is looking, and a new light can
 * cost the scene tens of milliseconds. Whatever changed meanwhile is painted when the
 * document is shown again.
 */
export function PixelStage({
  scene,
  light,
  paused = false,
  timeScale = 1,
  className,
}: PixelStageProps) {
  const { px, dp, dpr, logicalW, logicalH } = usePixelRootScale();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<Stage | null>(null);

  const speed = Number.isFinite(timeScale) && timeScale >= 0 ? timeScale : 1;
  const running = scene !== null && light !== null && !paused;

  // 1. The context, and the things to listen to for as long as the canvas exists. A layout
  //    effect, and first, so the two below always find them ready.
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const st = (stageRef.current ??= newStage());
    st.ctx = context2d(canvas);

    const media =
      typeof window.matchMedia === "function"
        ? window.matchMedia(REDUCED_MOTION)
        : null;
    st.reduced = media?.matches ?? false;
    const onMotion = (event: MediaQueryListEvent) => {
      st.reduced = event.matches;
      // A running loop tells the scene on its next frame. A held one is repainted now.
      if (st.raf === 0 && !hidden() && stale(st)) repaint(st);
    };
    media?.addEventListener?.("change", onMotion);

    // A restored context comes back empty, and a held loop would leave it that way.
    const onRestored = () => {
      if (st.raf === 0 && !hidden()) repaint(st);
    };
    canvas.addEventListener("contextrestored", onRestored);

    // Shown again: what changed while nobody was looking is painted now, unless the loop
    // is about to start and paint it anyway (its listener is added after this one).
    const onShown = () => {
      if (!hidden() && !st.running && st.raf === 0 && stale(st)) repaint(st);
    };
    document.addEventListener("visibilitychange", onShown);

    return () => {
      media?.removeEventListener?.("change", onMotion);
      canvas.removeEventListener("contextrestored", onRestored);
      document.removeEventListener("visibilitychange", onShown);
    };
  }, []);

  // 2. Hand the loop its inputs. This runs before the browser paints, and React has just
  //    set the canvas's width and height, which empties it: so a change of size is
  //    repainted here and now, and so is any change the loop will not be running to pick up.
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const st = stageRef.current;
    if (!canvas || !st) return;

    const emptied =
      st.image !== null && (st.w !== logicalW || st.h !== logicalH);
    if (st.scene !== scene) canvas.style.cursor = "";
    st.scene = scene;
    st.light = light;
    st.w = logicalW;
    st.h = logicalH;
    st.timeScale = speed;
    st.running = running;
    if (!st.ctx) return;

    if (!scene) {
      // No scene: back to plain ink (the canvas is see-through, the slot behind it is ink).
      st.ctx.clearRect(0, 0, logicalW, logicalH);
      st.told = null;
      st.blank = false;
      return;
    }
    if (emptied) st.blank = true;
    // Hidden: nothing is painted. Whoever shows the document again paints it: the loop's
    // first frame, or `onShown` above when the loop is not to run.
    if (hidden()) return;
    if (st.blank || (!running && stale(st))) repaint(st);
  }, [scene, light, logicalW, logicalH, speed, running]);

  // 3. The loop. One effect owns it, so there is never more than one: its cleanup always
  //    cancels the pending frame before anything can start another.
  useEffect(() => {
    const st = stageRef.current;
    if (!running || !st || !st.ctx) return;

    // False once this effect is cleaned up or the document is hidden. A frame that is being
    // drawn at that moment (a scene callback can unmount the stage) asks for no more.
    let wanted = false;
    const tick = (now: number) => {
      // If the scene throws, the loop stays stopped: one error, not sixty a second.
      st.raf = 0;
      // A device pixel ratio that changed without a word (see scale.ts) is caught here: the
      // stage is re-rendered at the new scale before this frame is drawn.
      noticeDevicePixelRatio();
      const real = st.fresh
        ? 0
        : Math.min(MAX_DT, Math.max(0, (now - st.last) / 1000));
      st.fresh = false;
      st.last = now;
      const rebuilding = stale(st);
      const began = performance.now();
      renderFrame(st, real * st.timeScale);
      // A long frame that told the scene something new was the scene building its picture,
      // not the animation playing: the next frame counts from where this one ended, so that
      // an entrance that began in this frame is not a tenth of a second further on when it
      // is first seen.
      const took = performance.now() - began;
      if (rebuilding && took >= LONG_FRAME_MS) st.last = now + took;
      // The cursor can change under a pointer that does not move (a spun ball coming to
      // rest with a patch under it, the airship drifting in): it is read every frame too.
      const canvas = canvasRef.current;
      const cursor = st.scene?.cursor?.();
      if (canvas && cursor && canvas.style.cursor !== cursor) {
        canvas.style.cursor = cursor;
      }
      if (wanted && st.raf === 0) st.raf = window.requestAnimationFrame(tick);
    };
    const start = () => {
      wanted = true;
      if (st.raf !== 0) return;
      st.fresh = true;
      st.raf = window.requestAnimationFrame(tick);
    };
    const stop = () => {
      wanted = false;
      if (st.raf === 0) return;
      window.cancelAnimationFrame(st.raf);
      st.raf = 0;
    };
    const onVisibility = () => {
      if (hidden()) stop();
      else start();
    };

    document.addEventListener("visibilitychange", onVisibility);
    onVisibility();
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      stop();
    };
  }, [running]);

  const forward = (
    type: PointerInfo["type"],
    event: ReactPointerEvent<HTMLCanvasElement>,
  ) => {
    // One pointer at a time: a second finger never reaches the scene.
    if (!event.isPrimary) return;
    const pressing = type === "down" || type === "up";
    if (pressing && event.pointerType === "mouse" && event.button !== 0) return;

    const canvas = event.currentTarget;
    if (type === "down") {
      // So that `up` arrives even if the finger slides off the canvas.
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {
        // No capture (the pointer is already gone, or an old browser): carry on without.
      }
    }

    const st = stageRef.current;
    const target = st?.scene;
    // A scene hears nothing until it has been through a frame: it has no size before that.
    if (!st || !target || st.told !== target) return;

    if (target.pointer) {
      const rect = canvas.getBoundingClientRect();
      const perX = rect.width > 0 ? st.w / rect.width : 1 / px;
      const perY = rect.height > 0 ? st.h / rect.height : 1 / px;
      target.pointer({
        type,
        x: (event.clientX - rect.left) * perX,
        y: (event.clientY - rect.top) * perY,
        touch: event.pointerType !== "mouse",
      });
    }
    if (target.cursor) {
      const cursor = target.cursor();
      if (canvas.style.cursor !== cursor) canvas.style.cursor = cursor;
    }
  };

  // Exactly `dp` device pixels per logical pixel. In CSS pixels that is a fraction at a
  // fractional device pixel ratio: 480 logical pixels at 125% are 1536px, 361 at 110% are
  // 984.54546px. The device size is divided, not `logical * px` multiplied up, so the
  // rounding of `px` is not multiplied with it.
  const cssW = `${deviceToCss(logicalW * dp, dpr)}px`;
  const cssH = `${deviceToCss(logicalH * dp, dpr)}px`;
  const style = {
    width: cssW,
    height: cssH,
    "--ss-stage-w": cssW,
    "--ss-stage-h": cssH,
  } as CSSProperties;

  return (
    <div className={cx("ss-stage", className)}>
      <canvas
        ref={canvasRef}
        className="ss-stage__canvas"
        width={logicalW}
        height={logicalH}
        style={style}
        aria-hidden="true"
        onPointerMove={(event) => forward("move", event)}
        onPointerDown={(event) => forward("down", event)}
        onPointerUp={(event) => forward("up", event)}
        onPointerLeave={(event) => forward("leave", event)}
        onPointerCancel={(event) => forward("leave", event)}
      />
    </div>
  );
}
