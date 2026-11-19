import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";

import type { Lighting } from "~/art/lighting";
import { soundEngine } from "~/audio";
import { Surface } from "~/pixel";
import {
  FLOATING_MAX,
  type FloatingSprite,
  type PointerInfo,
  type Scene,
  type SoundCue,
} from "~/scenes/scene";

import { cx } from "./cx";
import { arrivingThroughFade } from "./fade";
import { useLive } from "./live";
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
/**
 * How long one task of getting a scene's first picture ready runs (ms) before the page
 * gets its turn again (`Scene.prepareStep`). The scene's steps are a few milliseconds each, so
 * a task is about this long: short enough that a phone four times slower than the machine
 * it was measured on has next to no task of 50 ms. (Three of the stadium's steps are not
 * cut up and are longer: the life of the town, the mascot's place and the landings, 10 to
 * 30 ms each on that machine.)
 */
const PREPARE_SLICE_MS = 4;
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
/** How often the scene's ambience is asked for (ms). The engine crossfades changes. */
const AMBIENCE_POLL_MS = 1000;
/** The floating sprites' canvases, bottom first (Scene.floating). */
const FLOATS: readonly number[] = Array.from(
  { length: FLOATING_MAX },
  (_, i) => i,
);

/**
 * Everything the loop needs, kept in one object for the life of the component. It is only
 * read and written from effects, event handlers and animation frames, never during render.
 */
interface Stage {
  ctx: CanvasRenderingContext2D | null;
  /** The framebuffer, and the same memory wrapped as an ImageData. Rebuilt per size. */
  surface: Surface | null;
  image: ImageData | null;
  /**
   * The canvases over the first, one for each of the scene's floating sprites
   * (`Scene.floating`), bottom first. Empty where there is no 2D context, and then the
   * scene is never told it can float anything.
   */
  floats: FloatSlot[];
  /** Device pixels per logical pixel, and the device pixel ratio: where the sprite goes. */
  dp: number;
  dpr: number;

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

  /** The scene whose last frame is on the canvas: only that one hears the pointer. */
  shown: Scene | null;
  /**
   * The scene whose first picture is ready: taken through `Scene.prepareStep` to the end, or
   * drawn. Any other scene that has a `prepareStep` is taken through it before its first frame.
   */
  ready: Scene | null;
  /** A task of `Scene.prepareStep` is waiting its turn: the loop has no frame pending meanwhile. */
  preparing: boolean;

  /** The pending animation frame, or 0 while the loop is stopped. */
  raf: number;
  /** True until the first frame after a start: that frame has dt 0. */
  fresh: boolean;
  last: number;
}

/**
 * One floating sprite's canvas and context; the sprite's surface wrapped as an ImageData,
 * made again for another surface; the size its canvas was last given (`size`: logical size
 * and scale); its place, in device pixels; and whether it is showing.
 */
interface FloatSlot {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  surface: Surface | null;
  image: ImageData | null;
  size: string;
  x: number;
  y: number;
  shown: boolean;
}

function newStage(): Stage {
  return {
    ctx: null,
    surface: null,
    image: null,
    floats: [],
    dp: 1,
    dpr: 1,
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
    shown: null,
    ready: null,
    preparing: false,
    raf: 0,
    fresh: true,
    last: 0,
  };
}

/** The browser's own way to post a task with a priority, where it has one. */
interface TaskScheduler {
  postTask(
    task: () => void,
    options: { priority: "user-blocking" | "user-visible" | "background" },
  ): Promise<unknown>;
}

function taskScheduler(): TaskScheduler | null {
  const found = (window as { scheduler?: Partial<TaskScheduler> }).scheduler;
  return typeof found?.postTask === "function"
    ? (found as TaskScheduler)
    : null;
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

/**
 * A development aid: `?float=off` on the page's address leaves the floating canvases out,
 * so that the scene draws everything into the picture as before (to compare the menu ball's
 * and the airship's movement, 2026-11-14). Read once, when the stage is made. Nothing in a
 * production build.
 */
function floatsOff(): boolean {
  if (!import.meta.env.DEV) return false;
  try {
    return new URLSearchParams(window.location.search).get("float") === "off";
  } catch {
    return false;
  }
}

/**
 * True when drawing a frame now would show something new: the scene has something to be
 * told, or has been told it all (while its first picture was got ready) but never drawn.
 */
function stale(st: Stage): boolean {
  return (
    st.blank ||
    st.told !== st.scene ||
    st.shown !== st.scene ||
    st.toldW !== st.w ||
    st.toldH !== st.h ||
    st.toldLight !== st.light ||
    st.toldReduced !== st.reduced
  );
}

/**
 * Tells the scene whatever is new to it, always in this order: `setFloating` (a new
 * scene), `resize` (new scene or new size), `setLighting` (new scene or new light),
 * `setReducedMotion` (new scene or a change). True if the scene itself was new.
 */
function tell(st: Stage, scene: Scene, light: Lighting): boolean {
  const { w, h } = st;
  let fresh = false;
  if (st.told !== scene) {
    st.told = scene;
    st.toldW = 0;
    st.toldH = 0;
    st.toldLight = null;
    st.toldReduced = null;
    fresh = true;
    scene.setFloating?.(st.floats.length > 0);
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
  return fresh;
}

/**
 * One frame, always in this order: what is new to the scene (`tell`), `update(dt)`,
 * `draw(surface)`, then the surface goes to the canvas. A scene's first frame has `dt` 0.
 */
function renderFrame(st: Stage, dt: number): void {
  const { ctx, scene, light, w, h } = st;
  if (!ctx || !scene || !light) return;
  // The time since the last frame belongs to the scene that was up then, not a new one.
  if (tell(st, scene, light)) dt = 0;

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
  const sprites = st.floats.length > 0 ? scene.floating?.() : undefined;
  for (let i = 0; i < st.floats.length; i++) {
    showFloating(st, st.floats[i], sprites?.[i] ?? null);
  }
  st.blank = false;
  st.shown = scene;
  st.ready = scene;
}

/**
 * A floating sprite on its canvas: shown at its place rounded to whole device pixels (the
 * canvases share their top left, which is on a device pixel), at the same scale as the
 * picture; the canvas hidden when there is none.
 */
function showFloating(
  st: Stage,
  slot: FloatSlot,
  sprite: FloatingSprite | null,
): void {
  const { canvas, ctx } = slot;
  if (!sprite || !(sprite.surface.w > 0 && sprite.surface.h > 0)) {
    if (slot.shown) {
      canvas.style.visibility = "hidden";
      slot.shown = false;
    }
    return;
  }
  const { surface } = sprite;
  const size = `${surface.w}x${surface.h}@${st.dp}/${st.dpr}`;
  if (slot.surface !== surface || slot.size !== size) {
    if (slot.size !== size) {
      // a new size empties the canvas: it is painted again just below
      canvas.width = surface.w;
      canvas.height = surface.h;
      canvas.style.width = `${deviceToCss(surface.w * st.dp, st.dpr)}px`;
      canvas.style.height = `${deviceToCss(surface.h * st.dp, st.dpr)}px`;
      slot.size = size;
    }
    slot.surface = surface;
    slot.image = new ImageData(surface.bytes, surface.w, surface.h);
  }
  if (slot.image) ctx.putImageData(slot.image, 0, 0);
  const x = Math.round(sprite.x * st.dp);
  const y = Math.round(sprite.y * st.dp);
  if (x !== slot.x || y !== slot.y) {
    canvas.style.transform = `translate(${deviceToCss(x, st.dpr)}px, ${deviceToCss(y, st.dpr)}px)`;
    slot.x = x;
    slot.y = y;
  }
  if (!slot.shown) {
    canvas.style.visibility = "visible";
    slot.shown = true;
  }
}

function hidden(): boolean {
  return document.visibilityState === "hidden";
}

/**
 * Connects a scene to the page's sound engine: its cues are played, and its ambience is
 * asked for once a second. Returns the undo. With no Web Audio it does nothing.
 */
function connectSound(scene: Scene): (() => void) | undefined {
  const engine = soundEngine();
  if (!engine) return undefined;
  const hear = (cue: SoundCue) => engine.play(cue);
  scene.onSound = hear;
  const poll = () => engine.setAmbience(scene.ambience?.() ?? null);
  poll();
  const timer = window.setInterval(poll, AMBIENCE_POLL_MS);
  return () => {
    window.clearInterval(timer);
    if (scene.onSound === hear) scene.onSound = null;
    engine.setAmbience(null);
  };
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
 * The canvas's backing store is exactly `canvasW` x `canvasH` (from the nearest
 * `PixelRoot`), shown at exactly `canvasDp` device pixels per logical pixel (`canvasPx` CSS
 * pixels, which is a fraction at a fractional device pixel ratio) with nearest-neighbour
 * scaling: every logical pixel is the same whole block of device pixels at any display
 * scaling or zoom. The canvas's pixels are half the interface's, rounded up to whole device
 * pixels, and there are about twice as many each way (`canvasDpFor`: 960 x 540 at
 * 1920 x 1080). Placement is in ui.css (section 19): the less than one logical pixel by which the
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
  // The canvas's own size and pixel (half the interface's: see scale.ts).
  const {
    canvasPx: px,
    canvasDp: dp,
    dpr,
    canvasW: logicalW,
    canvasH: logicalH,
  } = usePixelRootScale();
  const live = useLive();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const floatRefs = useRef<(HTMLCanvasElement | null)[]>([]);
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
    st.floats = [];
    if (st.ctx && !floatsOff()) {
      for (const float of floatRefs.current) {
        const ctx = float ? context2d(float) : null;
        if (!float || !ctx) {
          st.floats = [];
          break;
        }
        st.floats.push({
          canvas: float,
          ctx,
          surface: null,
          image: null,
          size: "",
          x: Number.NaN,
          y: Number.NaN,
          shown: false,
        });
      }
    }

    const media =
      typeof window.matchMedia === "function"
        ? window.matchMedia(REDUCED_MOTION)
        : null;
    st.reduced = media?.matches ?? false;
    const onMotion = (event: MediaQueryListEvent) => {
      st.reduced = event.matches;
      // A running loop tells the scene on its next frame. A held one is repainted now.
      // (A scene still getting its first picture ready is told with its first frame.)
      if (st.raf === 0 && !st.preparing && !hidden() && stale(st)) repaint(st);
    };
    media?.addEventListener?.("change", onMotion);

    // A restored context comes back empty, and a held loop would leave it that way.
    const onRestored = () => {
      if (st.raf === 0 && !st.preparing && !hidden()) repaint(st);
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
    st.dp = dp;
    st.dpr = dpr;
    st.timeScale = speed;
    st.running = running;
    if (!st.ctx) return;

    if (!scene) {
      // No scene: back to plain ink (the canvas is see-through, the slot behind it is ink).
      st.ctx.clearRect(0, 0, logicalW, logicalH);
      for (const slot of st.floats) showFloating(st, slot, null);
      st.told = null;
      st.shown = null;
      st.ready = null;
      st.blank = false;
      return;
    }
    if (emptied) st.blank = true;
    // Hidden: nothing is painted. Whoever shows the document again paints it: the loop's
    // first frame, or `onShown` above when the loop is not to run.
    if (hidden()) return;
    if (st.blank || (!running && stale(st))) repaint(st);
  }, [scene, light, logicalW, logicalH, dp, dpr, speed, running]);

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
      // (a scene's first frame after `prepareStep` too: `stale` counts a scene not drawn yet)
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
    // A scene that can paint its first picture in steps (`Scene.prepareStep`: the menu's is
    // hundreds of milliseconds of work on a large screen) is taken through them before
    // its first frame is asked for, in tasks of PREPARE_SLICE_MS, one after another: the
    // page hears the player in between and paints what it has (its captions, the
    // leaderboard), instead of standing still until the picture is up. (With the priority
    // below, Chromium lets a frame through about every tenth of a second while the tasks
    // run, not after each one: measured 2026-11-19, 4 frames in a build of a third of a
    // second.) The canvas shows nothing
    // meanwhile, as it did while the one long frame was drawn. Not when the page is
    // arrived at through the fade: the screen is ink then, and the ink goes two frames
    // after the page says its picture is up (fade.ts), so the first frame paints it whole.
    let posted = false;
    let channel: MessageChannel | null = null;
    const prepare = () => {
      posted = false;
      // stopped meanwhile (hidden, or this effect cleaned up): `start` begins again
      if (!wanted) return;
      st.preparing = false;
      const { scene, light } = st;
      let more = false;
      if (scene?.prepareStep && light && st.ready !== scene) {
        const began = performance.now();
        try {
          tell(st, scene, light);
          do {
            more = scene.prepareStep();
          } while (more && performance.now() - began < PREPARE_SLICE_MS);
        } catch {
          // Its first frame builds the picture again from the start (the scene drops a
          // build that threw) and meets the same error, which is reported as the loop's are.
          more = false;
        }
        if (!more) st.ready = scene;
      }
      if (more) later();
      else if (st.raf === 0) st.raf = window.requestAnimationFrame(tick);
    };
    /**
     * The next task of `prepare`, with no delay. Where the browser takes a priority it goes
     * ahead of the page's ordinary tasks (a script that has just arrived, an answer from
     * the server): those waited for the picture when it was one long frame, and still do.
     * Without it, on a slow phone the ads' scripts got in first and the picture came half
     * a second later than it used to. A press is not an ordinary task and gets in between;
     * the painting of a frame waits its turn, a tenth of a second at most (Chromium's own
     * limit), which nobody sees: nothing on the page moves until the picture is up.
     */
    const later = () => {
      posted = true;
      st.preparing = true;
      const tasks = taskScheduler();
      if (tasks) {
        tasks.postTask(prepare, { priority: "user-blocking" }).catch(() => {});
      } else if (typeof MessageChannel === "function") {
        if (!channel) {
          channel = new MessageChannel();
          channel.port1.onmessage = prepare;
        }
        channel.port2.postMessage(null);
      } else {
        window.setTimeout(prepare, 0);
      }
    };
    const start = () => {
      wanted = true;
      if (st.raf !== 0 || posted) return;
      st.fresh = true;
      const scene = st.scene;
      if (scene?.prepareStep && st.ready !== scene && !arrivingThroughFade()) {
        later();
      } else {
        st.raf = window.requestAnimationFrame(tick);
      }
    };
    const stop = () => {
      wanted = false;
      st.preparing = false;
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
      channel?.port1.close();
    };
  }, [running]);

  // 4. Sound. The scene's cues go to the page's sound engine, and its ambience is asked for
  //    once a second. Undone when the scene changes or the stage goes. The engine itself
  //    keeps quiet while the tab is hidden, before the first gesture and while muted;
  //    reduced motion does not mute.
  useEffect(() => (scene ? connectSound(scene) : undefined), [scene]);

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
    // A scene hears nothing until it has been through a frame: it has no size before
    // that, or (while its first picture is got ready) no picture to be pointed at.
    if (!st || !target || st.shown !== target) return;

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
  // In the build-time HTML the canvas is the size of a phone nobody has measured (the
  // default scale), and empty. It is kept out of sight until the page is live, when it gets
  // its real size and its first picture in one go: an empty canvas that is seen to change
  // size counts as the page jumping about (layout shift), although nothing shows.
  const style = {
    width: cssW,
    height: cssH,
    "--ss-stage-w": cssW,
    "--ss-stage-h": cssH,
    "--ss-stage-px": `${px}px`,
    visibility: live ? undefined : "hidden",
  } as CSSProperties;
  // The floating sprite's canvas takes the same top left (ui.css, from the same variables);
  // its size, its place and whether it shows are set as it is painted.
  const floatStyle = {
    "--ss-stage-w": cssW,
    "--ss-stage-h": cssH,
    "--ss-stage-px": `${px}px`,
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
      {FLOATS.map((i) => (
        <canvas
          key={i}
          ref={(el) => {
            floatRefs.current[i] = el;
          }}
          className="ss-stage__canvas ss-stage__float"
          style={floatStyle}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}
