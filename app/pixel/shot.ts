/**
 * Shots: named, deterministic renders used to look at art without a browser.
 *
 * Any file named `*.shots.ts` under `app/` can export a `shots` map. The snap tool
 * (`./node_modules/.bin/tsx tools/snap.ts <id>`) finds them all and renders them to PNG.
 *
 * ```ts
 * export const shots: ShotMap = {
 *   "ball/idle": (ctx) => {
 *     const s = new Surface(ctx.w, ctx.h);
 *     // ... paint with ctx.t, ctx.seed, ctx.sun ...
 *     return s;
 *   },
 * };
 * ```
 */

import type { Surface } from "./surface";

/** Where the sun is. The lighting module turns this into colours. */
export interface Sun {
  /** Degrees above the horizon. Negative is below it. */
  elevation: number;
  /** True before solar noon (the sun is rising), false after it. */
  morning: boolean;
}

export interface ShotContext {
  /** Requested canvas size in logical pixels (`--w`, `--h`; default 130 x 281). */
  w: number;
  h: number;
  /** Time in seconds (`--t`, and advanced per frame by `--strip`). */
  t: number;
  /** Seed for anything random (`--seed`). */
  seed: number;
  /** Sun position (`--time` or `--sun`). */
  sun: Sun;
}

/**
 * A shot paints a new surface and returns it. Scenes normally return `ctx.w` x `ctx.h`;
 * sprite sheets and swatches may return any size. Same context, same pixels.
 */
export type Shot = (ctx: ShotContext) => Surface;

/** Shot id (for example "ball/idle") to shot. Ids are unique across the whole app. */
export type ShotMap = Record<string, Shot>;
