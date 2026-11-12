/**
 * Recordings that replace synthesised voices. Put a file in `public/sounds/` named after
 * what it replaces and it plays instead, with no code to change:
 *
 *   public/sounds/kick.mp3            a cue (any `SoundCue` kind: touch, kick, wind, cheer...)
 *   public/sounds/ambience-park.mp3   a venue's bed, looped (town, park, ground, stadium)
 *   public/sounds/ambience-park-night.mp3   the same at night (falls back to the day one)
 *   public/sounds/touch-1.mp3, touch-2.mp3  variants: they take turns for `touch`
 *
 * `.mp3` or `.ogg` (`.mp3` wins if both are there). Which files exist is known when the site
 * is built (the list below is filled in by Vite from the folder), so the browser never asks
 * for a file that is not there. A file is fetched and decoded the first time its sound is
 * wanted; the synthesised voice plays until it is ready, and for good if it cannot be read.
 *
 * A recording is levelled to the voice it replaces (see `loudness`, and `PEAK_DB` and
 * `BED_RMS_DB` in engine.ts): a one-shot to the same peak, a bed to the same average, the
 * wind to the noise it stands in for. A kick's power and a cheer's size still scale it.
 */

/** Every sound file in public/sounds, found at build time. The importers are never called. */
const FOUND = import.meta.glob("/public/sounds/*.{mp3,ogg}", {
  query: "?url",
  import: "default",
});

/**
 * The address of each file by name ("kick", "ambience-park"), from paths like
 * "/public/sounds/kick.mp3". `.mp3` wins over `.ogg`. `base` is the site's base URL.
 */
export function recordingIndex(
  paths: readonly string[],
  base = "/",
): Map<string, string> {
  const index = new Map<string, string>();
  const root = base.endsWith("/") ? base : `${base}/`;
  for (const path of [...paths].sort()) {
    const match = /\/sounds\/([a-z0-9-]+)\.(mp3|ogg)$/i.exec(path);
    if (!match) continue;
    const [, name, ext] = match;
    const key = name.toLowerCase();
    if (index.has(key) && ext.toLowerCase() === "ogg") continue;
    index.set(key, `${root}sounds/${name}.${ext}`);
  }
  return index;
}

/** The recordings this build has. */
export function builtRecordings(): Map<string, string> {
  return recordingIndex(Object.keys(FOUND), import.meta.env.BASE_URL);
}

export interface Loudness {
  /** The highest sample, over every channel (linear). */
  peak: number;
  /** The RMS over every channel (linear). */
  rms: number;
}

const loudnessOf = new WeakMap<AudioBuffer, Loudness>();

/**
 * How loud a recording is, worked out once per buffer. The engine levels every recording to
 * the voice it replaces with it, so a file can be dropped in at whatever level it came.
 */
export function loudness(buffer: AudioBuffer): Loudness {
  const known = loudnessOf.get(buffer);
  if (known) return known;
  let peak = 0;
  let sum = 0;
  const n = buffer.length;
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < n; i++) {
      const v = data[i];
      const a = v < 0 ? -v : v;
      if (a > peak) peak = a;
      sum += v * v;
    }
  }
  const found = {
    peak,
    rms: Math.sqrt(sum / Math.max(1, n * buffer.numberOfChannels)),
  };
  loudnessOf.set(buffer, found);
  return found;
}

/** The gain that takes a level of `from` to `to` (both linear); 1 for a silent file. */
export function levelTo(from: number, to: number): number {
  return from > 1e-5 ? to / from : 1;
}

/** A variant's name: a name and a number, `touch-2`. */
const VARIANT = /^(.+)-(\d+)$/;

/**
 * The files that can play for each name: `touch.mp3` and its numbered variants
 * (`touch-1.mp3`, `touch-2.mp3`...) all play for `touch`, the plain one first and then the
 * variants by number. A name with no file and no variants is not in the map.
 */
export function variantPools(
  names: Iterable<string>,
): Map<string, readonly string[]> {
  const pools = new Map<string, string[]>();
  const add = (base: string, name: string) => {
    const pool = pools.get(base);
    if (pool) pool.push(name);
    else pools.set(base, [name]);
  };
  for (const name of names) {
    add(name, name);
    const match = VARIANT.exec(name);
    if (match) add(match[1], name);
  }
  const order = (name: string) => {
    const match = VARIANT.exec(name);
    return match ? Number(match[2]) : -1;
  };
  for (const [base, pool] of pools) {
    pool.sort((a, b) =>
      a === base
        ? -1
        : b === base
          ? 1
          : order(a) - order(b) || (a < b ? -1 : 1),
    );
  }
  return pools;
}

type Loader = (url: string) => Promise<ArrayBuffer>;

const fetchBytes: Loader = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.arrayBuffer();
};

/**
 * The decoded recordings for one context, loaded on first use. `get` never waits: it
 * returns the buffer once it is ready, and null until then (and for good after a failure).
 */
export class Recordings {
  private readonly buffers = new Map<
    string,
    AudioBuffer | "loading" | "failed"
  >();
  /** How many have loaded and failed (for the debug view). */
  loaded = 0;
  failed = 0;
  private readonly pools: Map<string, readonly string[]>;
  /** How many times each name has been played: the next variant to play. */
  private readonly turns = new Map<string, number>();

  constructor(
    private readonly files: ReadonlyMap<string, string>,
    private readonly load: Loader = fetchBytes,
  ) {
    this.pools = variantPools(files.keys());
  }

  /** There is a file for `name`, or variants of it. */
  has(name: string): boolean {
    return this.pools.has(name);
  }

  /**
   * The recording to play for `name` this time: its variants in turn (`touch-1`, `touch-2`,
   * `touch-3`, `touch-1`...), so a run of the same sound is never one sample over and over.
   * The first time, every variant starts loading. One that is not loaded yet is passed over
   * for the next one that is; null while none is.
   */
  next(ctx: BaseAudioContext, name: string): AudioBuffer | null {
    const pool = this.pools.get(name);
    if (!pool) return null;
    const turn = this.turns.get(name) ?? 0;
    this.turns.set(name, turn + 1);
    let found: AudioBuffer | null = null;
    for (let i = 0; i < pool.length; i++) {
      const buffer = this.get(ctx, pool[(turn + i) % pool.length]);
      found ??= buffer;
    }
    return found;
  }

  get(ctx: BaseAudioContext, name: string): AudioBuffer | null {
    if (!this.files.has(name)) {
      // Only variants: the first of them.
      const first = this.pools.get(name)?.[0];
      return first && first !== name ? this.get(ctx, first) : null;
    }
    const state = this.buffers.get(name);
    if (typeof state === "string") return null;
    if (state) return state;
    const url = this.files.get(name);
    if (!url) return null;
    this.buffers.set(name, "loading");
    this.load(url)
      .then((bytes) => ctx.decodeAudioData(bytes))
      .then(
        (buffer) => {
          this.buffers.set(name, buffer);
          this.loaded++;
        },
        () => {
          this.buffers.set(name, "failed");
          this.failed++;
        },
      );
    return null;
  }

  /** Starts loading `name` now, so it is ready when first wanted. */
  warm(ctx: BaseAudioContext, name: string): void {
    this.get(ctx, name);
  }
}
