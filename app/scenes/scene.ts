/**
 * The scene contract: what the canvas host (`PixelStage` in `~/ui`) drives.
 *
 * A scene owns its animation state and paints one frame into a `Surface` at logical
 * resolution. It is pure TypeScript: no DOM, no clock reads, no unseeded randomness. Time
 * only moves when the host calls `update(dt)`, so the same calls always give the same
 * pixels, in the browser and in the snap tool alike.
 *
 * The host's frame is always, in this order: `resize` (when the size changed),
 * `setLighting` (when the light changed), `update(dt)`, `draw(surface)`.
 *
 * Scenes talk back through plain callbacks set by whoever created them (for example
 * `menu.onChoose = (mode) => ...`), never through React.
 */

import type { Lighting } from "~/art/lighting";
import type { Surface } from "~/pixel";

/** A pointer event in logical pixels (the surface's own coordinates, may be fractional). */
export interface PointerInfo {
  /**
   * `move` and `down` and `up` carry a position. `leave` means the pointer is gone (it left
   * the canvas, the touch ended or was cancelled): forget any hover or press.
   */
  type: "move" | "down" | "up" | "leave";
  x: number;
  y: number;
  /** True for a finger or a pen: there is no hover, and `up` should also clear the hover. */
  touch?: boolean;
}

export interface Scene {
  /** The logical size of the surface `draw` will be given. Called before the first frame. */
  resize(w: number, h: number): void;
  /** The light to paint under. Called before the first frame and whenever it changes. */
  setLighting(light: Lighting): void;
  /** Advance by `dt` seconds. Any `dt` is allowed, including 0 and large jumps. */
  update(dt: number): void;
  /** Paint the frame. Must cover every pixel of `s`. */
  draw(s: Surface): void;
  /** Pointer input, already converted to logical pixels. */
  pointer?(p: PointerInfo): void;
  /**
   * With reduced motion on, a scene drops shakes and flashes, slows its ambient loops and
   * shortens transitions to a plain cut. Called before the first frame and on change.
   */
  setReducedMotion?(on: boolean): void;
  /** What the mouse cursor should be right now. The host reads it after every pointer event. */
  cursor?(): "default" | "pointer";
}
