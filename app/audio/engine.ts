/**
 * The sound engine: one AudioContext for the page, made in an idle moment after the page
 * loads and started on the first user gesture (browsers keep a page silent until one; see
 * `prepareStep`), and everything the scenes ask to be heard.
 *
 *   voices ─ trim (LEVELS) ─ effects ─┐
 *   beds ──────────────── ambience ───┼─ master ─ safety ─ speakers
 *   sends ─────────────── room (a small reverb) ─┘
 *
 * - `play(cue)` makes a voice for a cue (or plays its recording, docs/AUDIO.md) and frees it
 *   when it is over. Cues before the first gesture, while muted and while the tab is hidden
 *   are dropped, never queued: a sound late is worse than none. The crowd's voices (cheer,
 *   groan, ooh) are sized by the place the bed is (place.ts): a few mates in the park, a
 *   whole stadium at the final, and over the town's bed (the home screen) a stadium far
 *   across town; a firework there is a faint far pop, and a vuvuzela is dropped: the home
 *   page is calm. A vuvuzela is heard at the World Cup only (tiers 6 and 7). Too many of a
 *   kind at once (LIMITS) drops the new one as "busy", except for a player's result
 *   (`RESULT_KINDS`): the oldest of its kind fades out quickly to make room for it.
 * - Some voices and beds play recorded takes inside themselves (the claps in every cheer
 *   and bed, the World Cup's hum: `TAKE_RMS_DB`), synthesising their own until they load.
 * - `setAmbience(a)` sets the bed: a new place or night crossfades, a new crowd value ramps.
 * - The mute (remembered, see mute.ts) fades everything out and suspends the context. A
 *   hidden tab suspends it too: nothing plays while nobody is looking.
 * - `tick()` runs four times a second: it frees finished voices, lets the wind go when its
 *   cues stop and schedules the ambience's next events.
 *
 * Browser only. Nothing runs at import; `soundEngine()` in index.ts makes the shared one.
 */

import type { Ambience, ScoreShot, SoundCue } from "~/scenes/scene";

import {
  AmbienceBed,
  type AmbientEvent,
  type BedExtras,
  ambienceKey,
  playAmbientEvent,
} from "./ambience";
import { CLAPS_TAKE, type Mix, applause } from "./crowd";
import {
  Synth,
  type Take,
  type Takes,
  type NoiseColour,
  Voice,
  cachedBuffer,
  mulberry32,
  noiseBuffer,
} from "./dsp";
import {
  BEDS,
  BUSES,
  CLAPS,
  CROWD,
  FIREWORKS,
  LIMITS,
  NET,
  SOUNDS,
  type SoundMix,
  STINGS,
  VUVUZELA,
} from "./mix";
import { PLACES, type Place, crowdAt, placeOf } from "./place";
import { Recordings, levelTo, loudness } from "./recordings";
import { type OneShotCue, playOneShot } from "./voices";
import { Wind } from "./wind";

export type SoundKind = SoundCue["kind"];

/** Every sound by its kind, as mix.ts has it (the same objects, read as they are now). */
const SOUND: Readonly<Record<SoundKind, SoundMix>> = SOUNDS;

/**
 * A table whose every entry is read from mix.ts when it is asked for, so that a level
 * changed there (the sound board's sliders, in memory) is heard at once.
 */
function view<K extends string>(
  keys: readonly K[],
  get: (key: K) => number,
): Readonly<Record<K, number>> {
  const out = {} as Record<K, number>;
  for (const key of keys) {
    Object.defineProperty(out, key, { get: () => get(key), enumerable: true });
  }
  return out;
}

const KINDS = Object.keys(SOUNDS) as SoundKind[];
const SHOTS = Object.keys(STINGS) as ScoreShot[];

/**
 * How loud each kind is going into the effects bus (`SOUNDS[kind].level` in mix.ts). Set by
 * rendering every voice offline and measuring it (docs/AUDIO.md has the figures): a
 * worldie's eruption is the loudest thing in the game, a touch on the ball the quietest,
 * and nothing clips.
 */
export const LEVELS: Readonly<Record<SoundKind, number>> = view(
  KINDS,
  (kind) => SOUND[kind].level,
);

type PeakKind = Exclude<SoundKind, "wind" | "score">;

/**
 * The peak of each synthesised one-shot at the speakers, in dBFS, at full power or size and
 * in a stadium (`SOUNDS[kind].peakDb` in mix.ts). A recording that replaces a voice is
 * brought to the same peak, whatever level the file came at.
 */
export const PEAK_DB: Readonly<Record<PeakKind, number>> = view(
  KINDS.filter((kind): kind is PeakKind => SOUND[kind].peakDb !== undefined),
  (kind) => SOUND[kind].peakDb ?? 0,
);

/**
 * The recorded takes that voices and beds play inside themselves (dsp.ts, `Takes`), and the
 * RMS (dBFS) each is brought to at the voice's input, whatever its file's level:
 * - `claps`: the applause in every cheer and the beds' claps (`CLAPS.takeRmsDb`).
 * - `vuvuzela-crowd`: the World Cup's hum, at unit RMS (`VUVUZELA.humTakeRmsDb`, 0):
 *   `VUVUZELA.hum` sets its level.
 */
export const TAKE_RMS_DB: Readonly<Record<string, number>> = view(
  ["claps", "vuvuzela-crowd"],
  (name) => (name === "claps" ? CLAPS.takeRmsDb : VUVUZELA.humTakeRmsDb),
);

/**
 * The World Cup's hum: at the final and the winners (tiers 6 and 7) the bed carries a
 * steady drone of vuvuzelas, low, at this RMS at the speakers (dBFS, at a crowd of 1 before
 * the crowd's swells lift it a little). Nowhere else. (`VUVUZELA.hum` in mix.ts.)
 */
export const HUM_RMS_DB: Readonly<Partial<Record<Place, number>>> =
  VUVUZELA.hum;

/**
 * The only places a vuvuzela is heard (the World Cup, tiers 6 and 7): a vuvuzela cue at any
 * other place is dropped as "calm". (With no bed asked for at all, a test page, it plays.)
 */
const HORN_PLACES: ReadonlySet<Place> = new Set<Place>(["final", "winners"]);

/**
 * The recordings to start loading as soon as a place's bed comes in, so the first time
 * each is wanted it is ready: the claps for every cheer and bed, the home page's landing and
 * twinkle, the World Cup's horns.
 */
const WARM: Readonly<Record<Place, readonly string[]>> = {
  town: ["sparkle", "land"],
  park: ["claps"],
  sunday: ["claps"],
  nonleague: ["claps"],
  lower: ["claps"],
  top: ["claps"],
  international: ["claps"],
  final: ["claps", "vuvuzela", "vuvuzela-crowd"],
  winners: ["claps", "vuvuzela", "vuvuzela-crowd"],
};

/**
 * The shots that go in, and how hard each takes the net (`NET` in mix.ts): every goal's
 * sting has the net under it (at this share of the net's level), a tap in barely rippling
 * it, a worldie or a golazo bulging it. A miss, or a shot not in this table, has no net.
 */
export const NET_BY_SHOT: Readonly<Partial<Record<ScoreShot, number>>> = NET;

/** The peak of each result sting, in dBFS: the better the shot, the bigger (`STINGS`). */
export const SCORE_PEAK_DB: Readonly<Record<ScoreShot, number>> = view(
  SHOTS,
  (shot) => STINGS[shot].peakDb,
);

/**
 * The RMS of each place's synthesised bed at the speakers, in dBFS, by day at a crowd of 1
 * (measured offline; `BEDS.places[place].rmsDb`). A recorded bed is brought to it; at
 * night `BEDS.nightDb` lower.
 */
export const BED_RMS_DB: Readonly<Record<Place, number>> = view(
  PLACES,
  (place) => BEDS.places[place].rmsDb,
);

/**
 * The names a recording for `cue` may have in public/sounds, most particular first: a
 * result sting by its shot (`score-worldie`), the iris by its way (`transition-open`, then
 * `transition`), a far firework (`firework-far`, then `firework`), a crowd voice by its
 * place (`cheer-park`, then `cheer`), anything else by its kind (`kick`).
 */
export function recordingNames(cue: SoundCue, place: Place): string[] {
  switch (cue.kind) {
    case "score":
      return [`score-${cue.shot}`];
    case "transition":
      return [`transition-${cue.opening ? "open" : "close"}`, "transition"];
    case "firework":
      return cue.distant === true || place === "town"
        ? ["firework-far", "firework"]
        : ["firework"];
    case "cheer":
    case "groan":
    case "ooh":
      return [`${cue.kind}-${place}`, cue.kind];
    default:
      return [cue.kind];
  }
}

/** The peak, in dBFS, that a recording for `cue` at `place` is brought to. */
function peakDbOf(cue: OneShotCue, place: Place): number {
  switch (cue.kind) {
    case "score":
      return SCORE_PEAK_DB[cue.shot] ?? SCORE_PEAK_DB.tapin;
    case "firework":
      return isFar(cue, place)
        ? PEAK_DB.firework + FIREWORKS.farDb + FIREWORKS.farLiftDb
        : PEAK_DB.firework;
    case "cheer":
    case "groan":
    case "ooh":
      // Smaller with fewer people, and faint from across town.
      return PEAK_DB[cue.kind] + CROWD.places[place].recordingDb;
    default:
      return PEAK_DB[cue.kind];
  }
}

function fromDb(db: number): number {
  return 10 ** (db / 20);
}

/** A firework far off: one sent as distant, or any over the town (the home page). */
function isFar(cue: OneShotCue, place: Place): boolean {
  return cue.kind === "firework" && (cue.distant === true || place === "town");
}

/** A recording as a take: with the gain that brings it to its `TAKE_RMS_DB`. */
export function takeOf(name: string, buffer: AudioBuffer): Take {
  return {
    buffer,
    gain: levelTo(loudness(buffer).rms, fromDb(TAKE_RMS_DB[name] ?? 0)),
    few: name === CLAPS_TAKE ? CLAPS.fewDb : 0,
  };
}

/** What a bed at `place` is given besides its recipe: the takes, and the hum's level. */
export function bedExtras(place: Place, takes: Takes | null): BedExtras {
  const db = HUM_RMS_DB[place];
  // The hum's source is at unit RMS (the take's, or the synthesised one's): this gain puts
  // it at HUM_RMS_DB at the speakers, through the ambience bus and the master.
  return {
    takes,
    hum: db === undefined ? 0 : fromDb(db) / (BUSES.ambience * BUSES.master),
  };
}

/**
 * Never heard over the town's bed (the home screen), whoever sends them: the product owner
 * wants the home page calm, and no horns. Dropped as "calm". (A cheer there is a far-off
 * ripple and a firework a faint pop: see voices.ts.)
 */
const NOT_IN_TOWN: ReadonlySet<SoundKind> = new Set<SoundKind>(["vuvuzela"]);

/**
 * The sounds of a player's result, as the career scene sends them: the sting (`score`) and
 * the net the engine puts under it, the crowd's `cheer` for a goal (and a promotion's, and
 * full time's), the `groan` or `ooh` for a miss, the `whistle` for time up (and full time)
 * and the World Cup's `vuvuzela`. A goal that makes no sound feels broken, so none of these
 * is ever dropped for having too many of its kind at once (LIMITS.atOnce): the oldest of its
 * kind still playing fades out over LIMITS.resultFade to make room, and the new one plays.
 * Every other kind (clicks, squeaks, fireworks...) is dropped as "busy", as before. The
 * gaps (LIMITS.gap) hold for every kind: no two results come within a fraction of a second.
 */
export const RESULT_KINDS: ReadonlySet<SoundKind> = new Set<SoundKind>([
  "score",
  "net",
  "cheer",
  "groan",
  "ooh",
  "whistle",
  "vuvuzela",
]);

/** How far ahead the ambience's events are scheduled (seconds). */
const LOOKAHEAD = 1.5;
/** The housekeeping interval (ms). */
const TICK_MS = 250;

/** The noise buffers made ahead of the first gesture (prepareStep), one an idle moment. */
const PREPARED_NOISE: readonly NoiseColour[] = ["white", "pink", "brown"];
const LOG_SIZE = 120;

/** The buses every voice and bed plays into. */
export interface Graph {
  master: GainNode;
  effects: GainNode;
  ambience: GainNode;
  /** The reverb's input. */
  room: AudioNode;
  /** The reverb's return into the master (BUSES.room), where there is a reverb. */
  wet?: GainNode;
  /** The safety's soft clip (BUSES.safety), where there is one. */
  safety?: WaveShaperNode;
}

/** A small room: a second and a half of darkening noise, for the crowd and the bangs. */
function roomImpulse(ctx: BaseAudioContext): AudioBuffer {
  return cachedBuffer(ctx, "room", () => {
    const sr = ctx.sampleRate;
    const n = Math.floor(sr * 1.6);
    const buffer = ctx.createBuffer(2, n, sr);
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      const rand = mulberry32(300 + channel);
      let smooth = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const k = 0.2 + 0.75 * Math.min(1, t / 1.2);
        smooth += (1 - k) * (rand() * 2 - 1 - smooth);
        const onset = t < 0.01 ? t / 0.01 : 1;
        data[i] = smooth * Math.exp(-t / 0.3) * onset;
      }
    }
    return buffer;
  });
}

/**
 * The safety's curve: straight (unity gain) up to BUSES.safety (a sample value, 0.6 is
 * -4.4 dBFS), then bending smoothly towards 0.98. It reads input from -2 to 2 (a gain of
 * 0.5 goes in front, and each point of the curve is the output for twice its input), so
 * even two eruptions at once come out under full scale.
 */
function safetyCurve(): Float32Array<ArrayBuffer> {
  const safe = BUSES.safety;
  const n = 4096;
  const curve = new Float32Array(new ArrayBuffer(n * 4));
  const room = 0.98 - safe;
  for (let i = 0; i < n; i++) {
    const x = ((i / (n - 1)) * 2 - 1) * 2;
    const a = Math.abs(x);
    const y = a <= safe ? a : safe + room * Math.tanh((a - safe) / room);
    curve[i] = Math.sign(x) * y;
  }
  return curve;
}

/**
 * The buses, the room and the safety, into `ctx.destination`. The safety is a soft clip, not
 * a compressor: it does nothing at all below -4.4 dBFS, so every level is exactly the one
 * designed and measured (Chrome's compressor adds its own make-up gain once it has settled,
 * which put the short sounds 10 dB above their measures), and nothing ever reaches full
 * scale. The loudest moment of the game peaks under it. The buses' gains are BUSES in
 * mix.ts.
 */
export function createGraph(ctx: BaseAudioContext): Graph {
  const master = ctx.createGain();
  master.gain.value = BUSES.master;
  let safety: WaveShaperNode | undefined;
  if (typeof ctx.createWaveShaper === "function") {
    const into = ctx.createGain();
    into.gain.value = 0.5;
    safety = ctx.createWaveShaper();
    safety.curve = safetyCurve();
    safety.oversample = "2x";
    master.connect(into);
    into.connect(safety);
    safety.connect(ctx.destination);
  } else {
    master.connect(ctx.destination);
  }
  const effects = ctx.createGain();
  effects.gain.value = BUSES.effects;
  effects.connect(master);
  const ambience = ctx.createGain();
  ambience.gain.value = BUSES.ambience;
  ambience.connect(master);
  let room: AudioNode = ctx.createGain();
  let wet: GainNode | undefined;
  if (typeof ctx.createConvolver === "function") {
    const convolver = ctx.createConvolver();
    convolver.buffer = roomImpulse(ctx);
    wet = ctx.createGain();
    wet.gain.value = BUSES.room;
    convolver.connect(wet);
    wet.connect(master);
    room = convolver;
  }
  return { master, effects, ambience, room, wet, safety };
}

/** For a recording: how loud this cue is, from its power or size (and `cueLevel`). */
function scaleOf(cue: SoundCue): number {
  if (cue.kind === "kick") {
    const softest = SOUNDS.kick.softest;
    return softest + (1 - softest) * clamp01(cue.power);
  }
  if (cue.kind === "cheer") {
    const smallest = SOUNDS.cheer.smallest;
    return smallest + (1 - smallest) * clamp01(cue.size);
  }
  return cueLevel(cue);
}

/**
 * A cue's own loudness, on top of its kind's level: a touch's `level` (0 to 1, default 1;
 * the juggle while the player types is JUGGLE.touch, very quiet), a vuvuzela's `size` (by
 * the goal, from VUVUZELA.smallest) and a landing's `power` (its small bounce is softer,
 * from SOUNDS.land.softest). Everything else is 1.
 */
export function cueLevel(cue: SoundCue): number {
  if (cue.kind === "touch" && cue.level !== undefined)
    return clamp01(cue.level);
  if (cue.kind === "vuvuzela" && cue.size !== undefined) {
    const smallest = VUVUZELA.smallest;
    return smallest + (1 - smallest) * clamp01(cue.size);
  }
  if (cue.kind === "land" && cue.power !== undefined) {
    const softest = SOUNDS.land.softest;
    return softest + (1 - softest) * clamp01(cue.power);
  }
  return 1;
}

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

/**
 * Builds one cue's sound into `graph` at time `t`, the way the engine plays it at `place`,
 * and returns its voice. Shared with the offline renders, so what is measured is what is
 * played. `scale` (0 to 1) makes it quieter still: the net under a small goal. `takes`
 * are the recorded takes a synthesised voice plays inside itself (a cheer's claps).
 */
export function buildCue(
  ctx: BaseAudioContext,
  graph: Graph,
  cue: OneShotCue,
  t: number,
  rand: () => number,
  recorded: AudioBuffer | null = null,
  place: Place = "top",
  scale = 1,
  takes: Takes | null = null,
): Voice {
  const voice = new Voice(cue.kind, t);
  const s = new Synth(ctx, voice, rand, takes);
  const lift = isFar(cue, place) ? fromDb(FIREWORKS.farLiftDb) : 1;
  const level = LEVELS[cue.kind] * cueLevel(cue) * scale * lift;
  const trim = s.gain(level, graph.effects);
  if (recorded) {
    const { peak } = loudness(recorded);
    const target = fromDb(peakDbOf(cue, place));
    trim.gain.value =
      levelTo(peak * BUSES.master, target) * scaleOf(cue) * scale;
    s.buffer(recorded, trim, t, t + recorded.duration, { loop: false });
    voice.outs.push(trim);
    voice.level = trim.gain.value;
    return voice;
  }
  const wet = s.gain(level, graph.room);
  voice.outs.push(trim, wet);
  const mix: Mix = { dry: trim, wet };
  playOneShot(s, cue, mix, t, crowdAt(place));
  voice.level = level;
  return voice;
}

export type DropReason = "locked" | "muted" | "hidden" | "busy" | "calm";

export interface SoundLogEntry {
  /** Context time in seconds, or null before there is a context. */
  at: number | null;
  kind: string;
  /**
   * "synth", "recording", "note" (mute, unmute, a level changed), "faded" (a result's
   * oldest of its kind, fading out to make room for a new one: RESULT_KINDS), or why it was
   * dropped.
   */
  result: "synth" | "recording" | "note" | "faded" | `dropped:${DropReason}`;
  /** A voice's gain into the effects bus as it started (its level, power and size). */
  gain?: number;
}

/**
 * The sound board's way of playing a cue (/dev/sound): as the game would, but heard at
 * `place` whatever the bed, and with a chosen recording (`touch-2`) or none (`false`: the
 * synthesised voice).
 */
export interface Audition {
  place?: Place;
  recording?: string | false;
}

/** What the engine has done: for the debug handle and the tests. */
export interface SoundDebug {
  state: AudioContextState | "none";
  muted: boolean;
  hidden: boolean;
  /** Cues received, by kind (wind: every frame of it). */
  cues: Record<string, number>;
  /** Voices made, by kind (wind: each gust). */
  played: Record<string, number>;
  /** Cues dropped, by reason. */
  dropped: Record<string, number>;
  /** Voices faded out to make room for a result's new one, by kind (RESULT_KINDS). */
  faded: Record<string, number>;
  live: number;
  made: number;
  freed: number;
  wind: boolean;
  ambience: string | null;
  /** The ambience's events so far, by name. */
  ambienceEvents: Record<string, number>;
  beds: number;
  recordings: { found: string[]; loaded: number; failed: number };
  /** Recorded takes played inside voices and beds, by name (the claps, the hum). */
  takes: Record<string, number>;
  log: SoundLogEntry[];
}

export interface SoundEngineOptions {
  /** Makes the context, on the first gesture. Null where there is no Web Audio. */
  createContext: () => AudioContext | null;
  /** Recordings by name (see recordings.ts). Default: none. */
  recordings?: ReadonlyMap<string, string>;
  /** How a recording's bytes are fetched. Default: `fetch`. */
  loadRecording?: (url: string) => Promise<ArrayBuffer>;
  seed?: number;
  /** Run the housekeeping timer (default true). Tests call `tick` themselves. */
  timers?: boolean;
}

function count(table: Record<string, number>, key: string): void {
  table[key] = (table[key] ?? 0) + 1;
}

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private graph: Graph | null = null;
  private muted = false;
  private hidden = false;
  private gestured = false;
  /** How many of PREPARED_NOISE prepareStep has made. */
  private preparedNoise = 0;
  /**
   * A resume asked for on a gesture is under way. A context that a gesture has just made or
   * woken is still "suspended" for a moment; cues in that moment are played (they start
   * when it does), so the first press on the page is heard.
   */
  private resuming = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private suspendTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly voices = new Set<Voice>();
  private wind: Wind | null = null;
  private bed: AmbienceBed | null = null;
  private bedRecorded = false;
  private readonly fading: AmbienceBed[] = [];
  private wanted: Ambience | null = null;
  private readonly lastAt = new Map<string, number>();
  private readonly rand: () => number;
  private readonly recordings: Recordings;
  private detachListeners: (() => void) | null = null;
  private readonly stats = {
    cues: {} as Record<string, number>,
    played: {} as Record<string, number>,
    dropped: {} as Record<string, number>,
    faded: {} as Record<string, number>,
    made: 0,
    freed: 0,
    ambienceEvents: {} as Record<string, number>,
    beds: 0,
    takes: {} as Record<string, number>,
    log: [] as SoundLogEntry[],
  };

  constructor(private readonly options: SoundEngineOptions) {
    this.rand = mulberry32(options.seed ?? 0x5eed);
    this.recordings = new Recordings(
      options.recordings ?? new Map(),
      options.loadRecording,
    );
  }

  // --- the page --------------------------------------------------------------------------------

  /**
   * Listens for the first gesture (and every one after, to resume a context the browser
   * suspended) and for the tab being hidden. Returns nothing; `dispose` undoes it.
   */
  attach(target: Window, doc: Document): void {
    this.detachListeners?.();
    const gesture = () => this.unlock();
    const kinds = ["pointerdown", "pointerup", "keydown", "touchend", "click"];
    for (const kind of kinds) {
      target.addEventListener(kind, gesture, { capture: true, passive: true });
    }
    const visibility = () => this.setHidden(doc.visibilityState === "hidden");
    doc.addEventListener("visibilitychange", visibility);
    this.hidden = doc.visibilityState === "hidden";
    this.detachListeners = () => {
      for (const kind of kinds) {
        target.removeEventListener(kind, gesture, { capture: true });
      }
      doc.removeEventListener("visibilitychange", visibility);
    };
  }

  /** A user gesture: the context may be made and started now. */
  unlock(): void {
    this.gestured = true;
    this.wake();
  }

  /**
   * One step of getting ready before the first gesture, for an idle moment: true while
   * there is more to do. Making a context holds the main thread for 15 to 160 ms in Chrome,
   * and the room and the bed's buffers for tens more; done inside the first press, that was
   * one long frame in whatever the press set moving (a slide, the kick-off). So the context
   * is made here, then the graph, then the bed, each in its own idle moment, and the
   * gesture only resumes the context. Until the gesture it stays suspended (suspended at
   * once where the browser would let it run): nothing is heard before a gesture. Muted or
   * hidden it waits; the gesture then builds whatever is left, as before.
   */
  prepareStep(): boolean {
    if (this.gestured || this.muted || this.hidden) return false;
    if (!this.ctx) {
      const ctx = this.makeContext();
      if (!ctx) return false;
      this.ctx = ctx;
      if (ctx.state === "running") ctx.suspend().catch(() => {});
      return true;
    }
    if (!this.graph) {
      this.graph = createGraph(this.ctx);
      return true;
    }
    // The noise every voice is cut from (the first click alone made the white: 8 ms).
    const colour = PREPARED_NOISE.at(this.preparedNoise);
    if (colour) {
      this.preparedNoise++;
      noiseBuffer(this.ctx, colour);
      return true;
    }
    if (!this.bed) this.applyAmbience();
    return false;
  }

  private makeContext(): AudioContext | null {
    try {
      return this.options.createContext();
    } catch {
      return null;
    }
  }

  private wake(): void {
    if (!this.gestured || this.muted || this.hidden) return;
    if (!this.ctx) {
      const ctx = this.makeContext();
      if (!ctx) return;
      this.ctx = ctx;
    }
    if (!this.graph) {
      this.graph = createGraph(this.ctx);
      this.applyAmbience();
    } else if (!this.bed) {
      this.applyAmbience();
    }
    if (this.ctx.state !== "running" && this.ctx.state !== "closed") {
      this.resuming = true;
      const ctx = this.ctx;
      ctx.resume().then(
        () => {
          if (this.ctx === ctx) this.resuming = false;
        },
        () => {
          // Not allowed yet: the next gesture tries again.
          if (this.ctx === ctx) this.resuming = false;
        },
      );
    }
    this.startTimer();
  }

  private startTimer(): void {
    if (this.timer !== null || this.options.timers === false) return;
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  setMuted(on: boolean): void {
    if (on === this.muted) return;
    this.muted = on;
    this.record(on ? "mute" : "unmute", "note");
    const ctx = this.ctx;
    const graph = this.graph;
    if (this.suspendTimer !== null) {
      clearTimeout(this.suspendTimer);
      this.suspendTimer = null;
    }
    if (on) this.resuming = false;
    if (!ctx || !graph) {
      if (!on) this.wake();
      return;
    }
    const now = ctx.currentTime;
    const gain = graph.master.gain;
    gain.cancelScheduledValues(now);
    if (on) {
      gain.setTargetAtTime(0, now, 0.03);
      // Faded: let everything go and stop the clock.
      const settle = () => {
        this.suspendTimer = null;
        if (!this.muted) return;
        this.silence();
        ctx.suspend().catch(() => {});
      };
      if (this.options.timers === false) settle();
      else this.suspendTimer = setTimeout(settle, 200);
    } else {
      gain.setTargetAtTime(BUSES.master, now, 0.05);
      this.wake();
      this.applyAmbience();
    }
  }

  get isMuted(): boolean {
    return this.muted;
  }

  setHidden(hidden: boolean): void {
    if (hidden === this.hidden) return;
    this.hidden = hidden;
    const ctx = this.ctx;
    if (!ctx) return;
    if (hidden) {
      this.resuming = false;
      if (ctx.state === "running") ctx.suspend().catch(() => {});
    } else {
      this.wake();
    }
  }

  // --- what the scenes ask for -------------------------------------------------------------------

  play(cue: SoundCue): void {
    this.playWith(cue);
  }

  /**
   * The sound board (/dev/sound): plays `cue` exactly as `play` does, but heard at
   * `audition.place` whatever the bed, and with the recording it names (or none).
   */
  audition(cue: SoundCue, audition: Audition = {}): void {
    this.playWith(cue, audition);
  }

  private playWith(cue: SoundCue, audition?: Audition): void {
    const made = this.playCue(cue, 1, audition);
    // A goal: the ball hits the net as the sting starts, so the net is heard with it. Not in
    // the park (tier 0): its goals are jumpers for posts, and the ball runs on to the hedge.
    const place = audition?.place ?? this.place();
    if (made && cue.kind === "score" && place !== "park") {
      const net = NET_BY_SHOT[cue.shot];
      if (net !== undefined) {
        this.playCue(
          { kind: "net" },
          net,
          audition && { place: audition.place },
        );
      }
    }
  }

  /** Plays one cue at `scale` of its level; true if a voice was made for it. */
  private playCue(cue: SoundCue, scale: number, audition?: Audition): boolean {
    const kind = cue.kind;
    count(this.stats.cues, kind);
    const place = audition?.place ?? this.place();
    // Somewhere asked for: a bed, or the sound board's place.
    const placed = audition?.place !== undefined || this.wanted !== null;
    if (placed && place === "town" && NOT_IN_TOWN.has(kind)) {
      return this.drop(kind, "calm");
    }
    if (kind === "vuvuzela" && placed && !HORN_PLACES.has(place)) {
      return this.drop(kind, "calm");
    }
    if (this.muted) return this.drop(kind, "muted");
    if (this.hidden) return this.drop(kind, "hidden");
    const ctx = this.ctx;
    const graph = this.graph;
    const starting = ctx?.state === "suspended" && this.resuming;
    if (!ctx || !graph || (ctx.state !== "running" && !starting)) {
      return this.drop(kind, "locked");
    }
    const now = ctx.currentTime;

    if (cue.kind === "wind") {
      if (!this.wind) {
        const trim = ctx.createGain();
        trim.gain.value = LEVELS.wind;
        trim.connect(graph.effects);
        this.wind = new Wind(
          ctx,
          trim,
          this.rand,
          this.recordings.get(ctx, "wind"),
        );
        this.wind.voice.nodes.push(trim);
        count(this.stats.played, "wind");
        this.stats.made++;
        this.record("wind", "synth", trim.gain.value);
      }
      this.wind.push(cue.speed, now);
      return false;
    }

    const gap = LIMITS.gap[kind] ?? 0;
    if (now - (this.lastAt.get(kind) ?? -Infinity) < gap) {
      return this.drop(kind, "busy");
    }
    const max = LIMITS.atOnce[kind];
    if (max !== undefined) {
      // Those on their way out (faded to make room) no longer count.
      const live: Voice[] = [];
      for (const voice of this.voices) {
        if (voice.kind === kind && !voice.fading) live.push(voice);
      }
      if (live.length >= max) {
        if (!RESULT_KINDS.has(kind)) return this.drop(kind, "busy");
        // A result is never dropped: the oldest of its kind make room.
        const room = Math.max(0, Math.floor(max) - 1);
        for (const old of live.slice(0, live.length - room)) {
          this.fadeOut(old, now);
        }
      }
    }
    if (this.voices.size >= LIMITS.voices) {
      const oldest = this.voices.values().next().value;
      if (oldest) this.free(oldest);
    }
    this.lastAt.set(kind, now);
    const chosen = audition?.recording;
    const recorded =
      chosen === false
        ? null
        : typeof chosen === "string"
          ? this.recordings.get(ctx, chosen)
          : this.recording(ctx, recordingNames(cue, place), true);
    const voice = buildCue(
      ctx,
      graph,
      cue,
      now + 0.005,
      this.rand,
      recorded,
      place,
      scale,
      this.takes(ctx),
    );
    this.voices.add(voice);
    this.stats.made++;
    count(this.stats.played, kind);
    this.record(kind, recorded ? "recording" : "synth", voice.level);
    // Every shot is struck a second or two before it goes in: the net's file starts loading
    // with the first kick, so the first goal already has it.
    if (kind === "kick") this.recording(ctx, ["net"]);
    return true;
  }

  /** Where the cues are heard: the place of the bed asked for, or a stadium. */
  private place(): Place {
    return this.wanted ? placeOf(this.wanted) : "top";
  }

  /**
   * The first of `names` that has a recording, once it has loaded; null until then. A name
   * with variants (`touch-1`, `touch-2`...) gives the next of them each time when `turn` is
   * set (a cue being played); a bed only looks, so asks without it.
   */
  private recording(
    ctx: BaseAudioContext,
    names: readonly string[],
    turn = false,
  ) {
    for (const name of names) {
      if (this.recordings.has(name)) {
        return turn
          ? this.recordings.next(ctx, name)
          : this.recordings.get(ctx, name);
      }
    }
    return null;
  }

  /**
   * The recorded takes for voices and beds to play inside themselves (the claps, the hum):
   * the next of each once it has loaded (variants take turns), levelled by TAKE_RMS_DB.
   */
  private takes(ctx: BaseAudioContext): Takes {
    return (name) => {
      const buffer = this.recording(ctx, [name], true);
      if (!buffer) return null;
      count(this.stats.takes, name);
      return takeOf(name, buffer);
    };
  }

  setAmbience(ambience: Ambience | null): void {
    this.wanted = ambience ? { ...ambience } : null;
    this.applyAmbience();
  }

  /**
   * A recording of the bed for `ambience`: by its place (`ambience-final-night`, then
   * `ambience-final`), then by its venue (`ambience-stadium-night`, `ambience-stadium`).
   */
  private bedRecording(ambience: Ambience): AudioBuffer | null {
    const ctx = this.ctx;
    if (!ctx) return null;
    const names: string[] = [];
    for (const where of new Set([placeOf(ambience), ambience.venue])) {
      if (ambience.night) names.push(`ambience-${where}-night`);
      names.push(`ambience-${where}`);
    }
    return this.recording(ctx, names);
  }

  private applyAmbience(): void {
    const ctx = this.ctx;
    const graph = this.graph;
    if (!ctx || !graph) return;
    const now = ctx.currentTime;
    const want = this.muted ? null : this.wanted;
    if (want && this.bed && this.bed.key === ambienceKey(want)) {
      this.bed.setCrowd(want, now);
      return;
    }
    this.retireBed(now);
    if (!want) return;
    const place = placeOf(want);
    for (const name of WARM[place]) this.recordings.warm(ctx, name);
    const recorded = this.bedRecording(want);
    const gain = recorded
      ? levelTo(
          loudness(recorded).rms * BUSES.ambience * BUSES.master,
          fromDb(BED_RMS_DB[place] + (want.night ? BEDS.nightDb : 0)),
        )
      : 1;
    this.bed = new AmbienceBed(
      ctx,
      graph.ambience,
      graph.room,
      want,
      this.rand,
      recorded,
      gain,
      bedExtras(place, this.takes(ctx)),
    );
    this.bedRecorded = recorded !== null;
    this.bed.schedule(now + LOOKAHEAD);
    this.stats.beds++;
    this.record(`ambience:${this.bed.key}`, recorded ? "recording" : "synth");
  }

  private retireBed(now: number): void {
    if (!this.bed) return;
    this.bed.fadeOut(now);
    this.fading.push(this.bed);
    this.bed = null;
  }

  // --- housekeeping -------------------------------------------------------------------------------

  /** Frees what has finished and schedules the ambience. Runs four times a second. */
  tick(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    for (const voice of this.voices) {
      if (now > voice.end + 0.05) this.free(voice);
    }
    if (this.wind?.idle(now)) {
      this.wind.dispose();
      this.wind = null;
      this.stats.freed++;
    }
    const bed = this.bed;
    if (bed) {
      // A recording that has finished loading takes over from the synthesised bed.
      if (!this.bedRecorded && this.bedRecording(bed.ambience)) {
        this.retireBed(now);
        this.applyAmbience();
      } else {
        bed.schedule(now + LOOKAHEAD);
        bed.sweep(now);
        this.collect(bed);
      }
    }
    for (let i = this.fading.length - 1; i >= 0; i--) {
      const old = this.fading[i];
      old.sweep(now);
      if (old.gone(now)) {
        this.collect(old);
        old.dispose();
        this.fading.splice(i, 1);
      }
    }
  }

  /** Adds a bed's event counts to the stats (once per event). */
  private collect(bed: AmbienceBed): void {
    for (const [name, n] of Object.entries(bed.started)) {
      this.stats.ambienceEvents[name] =
        (this.stats.ambienceEvents[name] ?? 0) + n;
      bed.started[name] = 0;
    }
  }

  private free(voice: Voice): void {
    voice.dispose();
    this.voices.delete(voice);
    this.stats.freed++;
  }

  /**
   * A result's voice making room for a newer one of its kind (RESULT_KINDS): it fades out
   * over LIMITS.resultFade and stops, and the housekeeping frees it. One already over (not
   * yet freed) is simply freed.
   */
  private fadeOut(voice: Voice, now: number): void {
    if (now >= voice.end) {
      this.free(voice);
      return;
    }
    count(this.stats.faded, voice.kind);
    this.record(voice.kind, "faded");
    voice.fadeOut(now, LIMITS.resultFade);
  }

  /** Lets every voice, the wind and the beds go at once. */
  private silence(): void {
    for (const voice of [...this.voices]) this.free(voice);
    if (this.wind) {
      this.wind.dispose();
      this.wind = null;
      this.stats.freed++;
    }
    if (this.bed) {
      this.collect(this.bed);
      this.bed.dispose();
      this.bed = null;
    }
    for (const old of this.fading) {
      this.collect(old);
      old.dispose();
    }
    this.fading.length = 0;
  }

  /** Notes a cue dropped, and why. False: no voice was made. */
  private drop(kind: string, reason: DropReason): false {
    count(this.stats.dropped, reason);
    // The wind comes every frame: one line per gust is enough.
    if (kind === "wind" && this.stats.log.at(-1)?.kind === "wind") return false;
    this.record(kind, `dropped:${reason}`);
    return false;
  }

  private record(
    kind: string,
    result: SoundLogEntry["result"],
    gain?: number,
  ): void {
    const log = this.stats.log;
    const entry: SoundLogEntry = {
      at: this.ctx ? Math.round(this.ctx.currentTime * 1000) / 1000 : null,
      kind,
      result,
    };
    if (gain !== undefined) entry.gain = Number(gain.toPrecision(4));
    log.push(entry);
    if (log.length > LOG_SIZE) log.splice(0, log.length - LOG_SIZE);
  }

  debug(): SoundDebug {
    if (this.bed) this.collect(this.bed);
    return {
      state: this.ctx?.state ?? "none",
      muted: this.muted,
      hidden: this.hidden,
      cues: { ...this.stats.cues },
      played: { ...this.stats.played },
      dropped: { ...this.stats.dropped },
      faded: { ...this.stats.faded },
      live: this.voices.size + (this.bed?.playing ?? 0),
      made: this.stats.made,
      freed: this.stats.freed,
      wind: this.wind !== null,
      ambience: this.bed?.key ?? null,
      ambienceEvents: { ...this.stats.ambienceEvents },
      beds: this.stats.beds,
      recordings: {
        found: [...(this.options.recordings?.keys() ?? [])],
        loaded: this.recordings.loaded,
        failed: this.recordings.failed,
      },
      takes: { ...this.stats.takes },
      log: this.stats.log.map((entry) => ({ ...entry })),
    };
  }

  // --- the sound board (/dev/sound) -------------------------------------------------------------

  /**
   * A level in mix.ts was changed in memory (`what`, for the log): the buses and the safety
   * take it at once, and the bed playing, if any, is made again (crossfading) with it. The
   * one-shots read mix.ts as they start, so they need nothing.
   */
  applyMix(what: string): void {
    this.record(what, "note");
    const ctx = this.ctx;
    const graph = this.graph;
    if (!ctx || !graph) return;
    const now = ctx.currentTime;
    if (!this.muted) {
      graph.master.gain.cancelScheduledValues(now);
      graph.master.gain.setValueAtTime(BUSES.master, now);
    }
    graph.effects.gain.value = BUSES.effects;
    graph.ambience.gain.value = BUSES.ambience;
    if (graph.wet) graph.wet.gain.value = BUSES.room;
    if (graph.safety) graph.safety.curve = safetyCurve();
    if (this.bed) {
      this.retireBed(now);
      this.applyAmbience();
    }
  }

  /**
   * The context and buses if a sound can be heard now; null (and the drop logged) if not.
   * For the sound board's own sounds below, which are not cues.
   */
  private ready(kind: string): { ctx: AudioContext; graph: Graph } | null {
    count(this.stats.cues, kind);
    if (this.muted) return this.drop(kind, "muted") || null;
    if (this.hidden) return this.drop(kind, "hidden") || null;
    const ctx = this.ctx;
    const graph = this.graph;
    const starting = ctx?.state === "suspended" && this.resuming;
    // A context made ahead of the gesture (prepareStep) stays silent until it.
    if (
      !this.gestured ||
      !ctx ||
      !graph ||
      (ctx.state !== "running" && !starting)
    ) {
      return this.drop(kind, "locked") || null;
    }
    return { ctx, graph };
  }

  /** A voice the sound board made: kept until it ends, counted and logged. */
  private keep(voice: Voice, recorded: boolean, gain: number): void {
    this.voices.add(voice);
    this.stats.made++;
    count(this.stats.played, voice.kind);
    this.record(voice.kind, recorded ? "recording" : "synth", gain);
  }

  /**
   * The sound board: claps alone, as in a cheer (at the cheer's level), `perSecond` a
   * second on each side: the recording in as many layers as that stands for
   * (`CLAPS.perLayer` each, at most `CLAPS.mostLayers`), or the synthesised claps until
   * it has loaded.
   */
  auditionClaps(perSecond: number): void {
    const live = this.ready("claps");
    if (!live) return;
    const { ctx, graph } = live;
    const t = ctx.currentTime + 0.005;
    const voice = new Voice("claps", t);
    const before = this.stats.takes[CLAPS_TAKE] ?? 0;
    const s = new Synth(ctx, voice, this.rand, this.takes(ctx));
    const level = LEVELS.cheer;
    const mix: Mix = {
      dry: s.gain(level, graph.effects),
      wet: s.gain(level, graph.room),
    };
    applause(
      s,
      mix,
      t,
      [
        [0.2, 0.6],
        [2.4, 0.5],
        [3, 0],
      ],
      perSecond,
    );
    this.keep(voice, (this.stats.takes[CLAPS_TAKE] ?? 0) > before, level);
  }

  /**
   * The sound board: one of the beds' events on its own (a bird, a shout, a drum...),
   * through the ambience bus at a crowd of 1, as the offline render measures it.
   */
  auditionEvent(name: AmbientEvent): void {
    const live = this.ready(`ambience:${name}`);
    if (!live) return;
    const { ctx, graph } = live;
    const t = ctx.currentTime + 0.005;
    const voice = new Voice(`ambience:${name}`, t);
    const s = new Synth(ctx, voice, this.rand, this.takes(ctx));
    playAmbientEvent(s, name, { dry: graph.ambience, wet: graph.room }, t);
    this.keep(voice, false, BUSES.ambience);
  }

  /**
   * The sound board: everything stops at once (every voice, the wind and the bed), and the
   * next sound of any kind may start at once (the limits count from here).
   */
  stopAll(): void {
    this.wanted = null;
    this.silence();
    this.lastAt.clear();
    this.record("stop all", "note");
  }

  /** Starts loading every recording now (the sound board lists them all). */
  warmAll(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    for (const name of this.options.recordings?.keys() ?? []) {
      this.recordings.warm(ctx, name);
    }
  }

  /** Voices playing now (not the wind or the ambience). */
  get liveVoices(): number {
    return this.voices.size;
  }

  /** Stops everything, closes the context and removes every listener. */
  dispose(): void {
    this.detachListeners?.();
    this.detachListeners = null;
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    if (this.suspendTimer !== null) clearTimeout(this.suspendTimer);
    this.suspendTimer = null;
    this.silence();
    this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.graph = null;
  }
}
