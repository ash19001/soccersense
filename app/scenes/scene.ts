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

/**
 * A CSS cursor for the canvas: "grab" over something that can be turned or dragged,
 * "grabbing" while it is.
 */
export type SceneCursor = "default" | "pointer" | "grab" | "grabbing";

/**
 * Something a scene wants heard. Scenes call `this.onSound?.(cue)` when it happens; the
 * canvas host plays it through the sound engine (`~/audio`). Scenes never touch audio.
 */
export type SoundCue =
  | { kind: "touch"; level?: number } // a light touch on a ball: the pointer touching the menu ball, a juggle, a trap (level 0 to 1, default 1: how loud; the idle juggle is 0.15)
  | { kind: "kick"; power: number } // a ball struck: 0 a prod, 1 a rocket
  | { kind: "wind"; speed: number } // air rushing past something spinning or flying, 0 to 1; send it every frame while it lasts
  | { kind: "cheer"; size: number } // the crowd goes up: 0 a ripple, 1 an eruption
  | { kind: "groan" } // a miss
  | { kind: "ooh" } // a near thing
  | { kind: "whistle"; long?: boolean } // the referee (long: full time)
  | { kind: "squeak" } // a poke on the airship
  | { kind: "pop" } // the airship bursts
  | { kind: "thud" } // something heavy lands
  | { kind: "splash" }
  | { kind: "firework"; distant?: boolean } // a rocket going up and bursting (distant: a faint pop far away)
  | { kind: "vuvuzela"; size?: number } // a blast of horns from the crowd, World Cup only (tiers 6 and 7; size 0 to 1, default 1: how big, by the goal)
  | { kind: "sparkle" } // a star's twinkle: AWAY's ball vanishing into the sky
  | { kind: "land"; power?: number } // a ball dropping onto turf from height: HOME's landing (power 0 to 1, default 1; its small bounce is softer)
  | { kind: "sweep" } // the promotion's sweep of smoke
  | { kind: "click" } // a button pressed: crisp and short
  | { kind: "transition"; opening: boolean } // the iris between home and game: closing on home, opening on the game page
  | { kind: "score"; shot: ScoreShot } // the sting for a result, as the ball goes in or misses (a goal's brings the net with it)
  | { kind: "net" }; // a ball driven into the net: the mesh's swish and rattle

/** The shots a result sting can be for, best to worst. */
export type ScoreShot =
  "worldie" | "golazo" | "trivela" | "toepoke" | "tapin" | "miss";

/** The bed of sound under a scene, polled by the host about once a second. */
export interface Ambience {
  venue: "town" | "park" | "ground" | "stadium";
  /** 0 to 1: how many people are making it. */
  crowd: number;
  night: boolean;
  /**
   * 0 to 7, the career tier, when the scene is the career: 0 park kickabout, 1 Sunday league,
   * 2 non-league, 3 lower leagues, 4 top flight, 5 international, 6 the World Cup final,
   * 7 the winners. Absent elsewhere (the home page's town).
   */
  tier?: number;
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
  cursor?(): SceneCursor;
  /**
   * Set by the host: call it with a cue when something audible happens. It may be null or
   * unset (the snap tool, tests), so always call it as `this.onSound?.(cue)`.
   */
  onSound?: ((cue: SoundCue) => void) | null;
  /** The bed of sound under the scene right now. The host polls it about once a second. */
  ambience?(): Ambience;
}
