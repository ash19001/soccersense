/**
 * Ambience: the bed of sound under a scene. One `AmbienceBed` per place (place.ts: the home
 * page's town, then the eight career tiers from the park to the winners) and time of day: a
 * few continuous layers (air, distant traffic, a crowd's chatter or roar) and things that
 * happen now and then (a bird, a car going by, a dog, a shout, a song, a drum), each at its
 * own rate. The crowd value (0 to 1) scales everything people make.
 *
 * It is background, and quiet: a bed you can sit on for a whole game. No bed ever blows a
 * horn: the World Cup's beds (the final and the winners) carry the hum of a stadium of
 * vuvuzelas instead, a steady drone low under the crowd that swells a little with it (the
 * recorded swarm, `vuvuzela-crowd`, or a synthesised one until it has loaded). The crowd's
 * swells and the winners' far fireworks are kept small. The town (the
 * home screen) is calm: a distant stadium's low, steady murmur, a little traffic, birds by
 * day; no cheers, no roars, no swells.
 *
 *   town           the home page: a stadium's murmur across town, traffic, birds (crickets, an owl)
 *   park           tier 0, a kickabout: birds, a dog, children, mates calling, a ball kicked, cars
 *   sunday         tier 1: a handful of parents and subs shouting, the coach, a whistle far off
 *   nonleague      tier 2: a small crowd's chatter and the odd shout, a few claps
 *   lower          tier 3: a terrace singing in bursts over the chatter
 *   top            tier 4: a big crowd rising and falling, chants
 *   international  tier 5: bigger, with drums
 *   final          tier 6: the World Cup final: a huge crowd, drums, a great wash of sound, the hum
 *   winners        tier 7: the celebration: singing, clapping, whistles, far fireworks, the hum
 *
 * The engine makes a new bed when the place or the night changes and crossfades the two;
 * a change of crowd alone is a ramp on the same bed. It calls `schedule(until)` a little
 * ahead of time and `sweep(now)` to free what has finished.
 */

import type { Ambience } from "~/scenes/scene";

import {
  type Mix,
  type Vowel,
  VOWELS,
  applause,
  chant,
  fanWhistle,
  roar,
  voices,
} from "./crowd";
import {
  Synth,
  type Take,
  type Takes,
  Voice,
  ad,
  curve,
  glide,
  link,
} from "./dsp";
import { BEDS, BED_EVENTS, type BedMix } from "./mix";
import { type Place, placeOf } from "./place";
import { playOneShot } from "./voices";

/** What an event can reach on its bed. */
interface Bed {
  /** Everything that is not people. */
  mix: Mix;
  /** People: scaled by the crowd value. */
  crowd: Mix;
  /** The big crowd's roar, which a swell lifts. Null where there is none. */
  swell: GainNode | null;
}

interface EventSpec {
  name: string;
  /** How often, per minute, at this crowd value. */
  rate: (crowd: number) => number;
  play: (s: Synth, bed: Bed, t: number) => void;
}

// --- things that happen ----------------------------------------------------------------------------

/**
 * A small bird: a run of quick chirps, or two slow whistled notes. There is no long trill
 * sliding down any more: the product owner heard it as something falling (2026-11-12).
 */
function bird(s: Synth, bed: Bed, t: number): void {
  const out = s.pan(s.rnd(-0.9, 0.9), bed.mix.dry);
  const level = s.rnd(BED_EVENTS.bird.quietest, BED_EVENTS.bird.loudest);
  const kind = s.rand();
  if (kind < 0.7) {
    const notes = Math.floor(s.rnd(3, 7));
    const f = s.rnd(2600, 4400);
    const up = s.rand() < 0.6;
    let at = t;
    for (let i = 0; i < notes; i++) {
      const len = s.rnd(0.04, 0.08);
      const env = s.gain(0, out);
      const tone = s.osc("sine", f, env, at, at + len + 0.02);
      glide(tone.frequency, at, up ? f : f * 1.4, up ? f * 1.45 : f, len);
      curve(env.gain, at, [
        [0.01, level],
        [len, 0],
      ]);
      at += len + s.rnd(0.04, 0.09);
    }
  } else {
    let at = t;
    for (let i = 0; i < 2; i++) {
      const len = s.rnd(0.18, 0.3);
      const f = s.rnd(1800, 2800);
      const env = s.gain(0, out);
      const tone = s.osc("sine", f, env, at, at + len + 0.02);
      s.osc("sine", 7, s.gain(f * 0.02, tone.frequency), at, at + len);
      curve(env.gain, at, [
        [0.04, level],
        [len, 0],
      ]);
      at += len + s.rnd(0.1, 0.25);
    }
  }
}

/** Crickets at night: a few seconds of soft chirps, each three or four quick pulses. */
function cricket(s: Synth, bed: Bed, t: number): void {
  const out = s.pan(s.rnd(-0.8, 0.8), bed.mix.dry);
  const env = s.gain(0, out);
  const f = s.rnd(4300, 4900);
  const len = s.rnd(2, 4.5);
  s.osc("sine", f, env, t, t + len + 0.1);
  const level = s.rnd(BED_EVENTS.cricket.quietest, BED_EVENTS.cricket.loudest);
  const g = env.gain;
  g.setValueAtTime(0, t);
  for (let at = t; at < t + len; at += s.rnd(0.45, 0.6)) {
    for (let k = 0; k < 4; k++) {
      const p = at + k * 0.032;
      g.setTargetAtTime(level, p, 0.003);
      g.setTargetAtTime(0, p + 0.016, 0.004);
    }
  }
}

/** A car going by in the distance, left to right or back: a swell of road noise and engine. */
function carPass(s: Synth, bed: Bed, t: number): void {
  const len = s.rnd(4, 6);
  const from = s.rand() < 0.5 ? -0.8 : 0.8;
  const pan = s.pan(from, bed.mix.dry);
  if ("pan" in pan) {
    pan.pan.setValueAtTime(from, t);
    pan.pan.linearRampToValueAtTime(-from, t + len);
  }
  const env = s.gain(0, pan);
  curve(env.gain, t, [
    [len * 0.5, s.rnd(BED_EVENTS.car.quietest, BED_EVENTS.car.loudest)],
    [len, 0],
  ]);
  const road = s.filter("bandpass", 600, 0.7, env);
  s.noise("pink", road, t, t + len);
  road.frequency.setValueAtTime(650, t);
  road.frequency.linearRampToValueAtTime(420, t + len);
  const f = s.rnd(70, 110);
  const motor = s.osc(
    "sawtooth",
    f * 1.05,
    s.filter("lowpass", 320, 0.7, s.gain(0.08, env)),
    t,
    t + len,
  );
  // Higher as it comes, lower as it goes.
  motor.frequency.setValueAtTime(f * 1.05, t);
  motor.frequency.linearRampToValueAtTime(f * 0.93, t + len);
}

/** A dog somewhere: one to three barks. */
function dog(s: Synth, bed: Bed, t: number): void {
  const out = s.filter(
    "lowpass",
    1600,
    0.6,
    s.pan(s.rnd(-0.7, 0.7), bed.mix.dry),
  );
  const bank = s.gain(1, null);
  link(bank, s.filter("bandpass", 650, 2.5, s.gain(1.2, out)));
  link(bank, s.filter("bandpass", 1250, 3, s.gain(0.7, out)));
  const barks = Math.floor(s.rnd(1, 4));
  const f = s.rnd(280, 380);
  const level = s.rnd(BED_EVENTS.dog.quietest, BED_EVENTS.dog.loudest);
  let at = t;
  for (let i = 0; i < barks; i++) {
    const env = s.gain(0, bank);
    const throat = s.osc("sawtooth", f, env, at, at + 0.2);
    throat.frequency.setValueAtTime(f, at);
    throat.frequency.linearRampToValueAtTime(f * 1.2, at + 0.03);
    throat.frequency.exponentialRampToValueAtTime(f * 0.7, at + 0.15);
    ad(env.gain, at, 0.01, level, 0.045);
    at += s.rnd(0.3, 0.45);
  }
}

/** Children playing: a shout or a squeal or two. */
function children(s: Synth, bed: Bed, t: number): void {
  const out = s.pan(s.rnd(-0.8, 0.8), bed.mix.dry);
  const n = Math.floor(s.rnd(1, 4));
  for (let i = 0; i < n; i++) {
    voices(s, { dry: out, wet: bed.mix.wet }, t + i * s.rnd(0.3, 0.7), {
      count: 1,
      low: 320,
      high: 480,
      contour: s.pick([
        [
          [0, 1],
          [0.3, 1.3],
          [1, 0.9],
        ],
        [
          [0, 1.1],
          [1, 0.85],
        ],
      ]),
      length: [0.25, 0.6],
      spread: 0,
      attack: 0.04,
      release: 0.12,
      level: BED_EVENTS.children,
      vowel: s.pick([VOWELS.ee, VOWELS.eh, VOWELS.ah]),
      shift: 1.15,
      bright: 2600,
    });
  }
}

/** An owl: "hoo... hoo-hoo". */
function owl(s: Synth, bed: Bed, t: number): void {
  const out = s.pan(s.rnd(-0.6, 0.6), bed.mix.dry);
  const f = s.rnd(340, 400);
  for (const [at, len] of [
    [0, 0.4],
    [0.75, 0.18],
    [1.0, 0.45],
  ] as const) {
    const env = s.gain(0, out);
    const tone = s.osc("sine", f, env, t + at, t + at + len + 0.05);
    glide(tone.frequency, t + at, f * 1.03, f * 0.95, len);
    curve(env.gain, t + at, [
      [0.07, BED_EVENTS.owl.hoot],
      [len - 0.1, BED_EVENTS.owl.held],
      [len, 0],
    ]);
  }
}

/**
 * One voice calling out: one to `most` syllables, the last rising and falling, its pitch
 * from `low` to `high`.
 */
function yell(
  s: Synth,
  mix: Mix,
  t: number,
  low: number,
  high: number,
  level: number,
  most = 2,
): void {
  const out = s.pan(s.rnd(-0.7, 0.7), mix.dry);
  const syllables = 1 + Math.floor(s.rand() * most);
  const base = s.rnd(low, high);
  const vowel: Vowel = s.pick([VOWELS.oh, VOWELS.ah, VOWELS.eh]);
  let at = t;
  for (let i = 0; i < syllables; i++) {
    const last = i === syllables - 1;
    voices(s, { dry: out, wet: mix.wet }, at, {
      count: 1,
      low: base,
      high: base * 1.2,
      contour: last
        ? [
            [0, 1],
            [0.3, 1.25],
            [1, 0.85],
          ]
        : [
            [0, 1],
            [1, 1.05],
          ],
      length: last ? [0.35, 0.6] : [0.12, 0.2],
      spread: 0,
      attack: 0.03,
      release: last ? 0.2 : 0.04,
      level,
      vowel,
      bright: 2200,
    });
    at += s.rnd(0.18, 0.28);
  }
}

/** One voice from the touchline. */
function shout(s: Synth, bed: Bed, t: number): void {
  yell(s, bed.crowd, t, 110, 150, BED_EVENTS.shout);
}

/** A mate on the park calling for it: "Here!", "Yes!". */
function mate(s: Synth, bed: Bed, t: number): void {
  yell(
    s,
    { dry: bed.mix.dry, wet: bed.mix.wet },
    t,
    130,
    190,
    BED_EVENTS.mate,
    1,
  );
}

/** A parent or a sub on the touchline: a man or a woman. */
function parent(s: Synth, bed: Bed, t: number): void {
  const woman = s.rand() < 0.45;
  yell(
    s,
    bed.crowd,
    t,
    woman ? 200 : 115,
    woman ? 270 : 160,
    BED_EVENTS.parent,
  );
}

/** The coach: a gruff two or three syllables. */
function coach(s: Synth, bed: Bed, t: number): void {
  yell(s, bed.crowd, t, 98, 120, BED_EVENTS.coach, 3);
}

/** A few people clapping. */
function claps(s: Synth, bed: Bed, t: number): void {
  const len = s.rnd(1.5, 3);
  applause(
    s,
    bed.crowd,
    t,
    [
      [0.3, BED_EVENTS.claps.start],
      [len - 0.6, BED_EVENTS.claps.held],
      [len, 0],
    ],
    BED_EVENTS.claps.perSecond,
  );
}

/** The referee's whistle across the field, far off. */
function farWhistle(s: Synth, bed: Bed, t: number): void {
  const far = s.gain(
    BED_EVENTS.whistle,
    s.filter("lowpass", 3500, 0.5, bed.mix.dry),
  );
  playOneShot(s, { kind: "whistle" }, { dry: far, wet: bed.mix.wet }, t);
}

/** A ball kicked somewhere on the field. */
function farKick(s: Synth, bed: Bed, t: number): void {
  const far = s.gain(
    BED_EVENTS.kick,
    s.filter("lowpass", 2000, 0.5, bed.mix.dry),
  );
  playOneShot(
    s,
    { kind: "kick", power: s.rnd(0.2, 0.7) },
    { dry: far, wet: bed.mix.wet },
    t,
  );
}

/** The big crowd's roar lifts for a few seconds and settles back: a little, it is background. */
function swell(s: Synth, bed: Bed, t: number): void {
  if (!bed.swell) return;
  const up = s.rnd(1, 1.8);
  const hold = s.rnd(0.8, 2.2);
  const g = bed.swell.gain;
  g.setTargetAtTime(
    s.rnd(BED_EVENTS.swell.least, BED_EVENTS.swell.most),
    t,
    up / 3,
  );
  g.setTargetAtTime(1, t + up + hold, 0.8);
  // The event is over when the swell has settled.
  s.voice.end = Math.max(s.voice.end, t + up + hold + 2.5);
}

/** A stand singing a short tune. */
function sing(s: Synth, bed: Bed, t: number): void {
  chant(s, bed.crowd, t, BED_EVENTS.chant, { singers: 12, bright: 1400 });
}

/** A lower-league terrace: a burst of song from one end, rougher and nearer. */
function terrace(s: Synth, bed: Bed, t: number): void {
  const end = s.pan(s.pick([-0.5, 0.5]), bed.crowd.dry);
  chant(s, { dry: end, wet: bed.crowd.wet }, t, BED_EVENTS.terrace, {
    singers: 9,
    bright: 1700,
  });
}

/** The winners' end: the whole ground singing, brighter. */
function celebrate(s: Synth, bed: Bed, t: number): void {
  chant(s, bed.crowd, t, BED_EVENTS.celebrate, {
    singers: 16,
    bright: 1800,
  });
}

/** A drum in the stands: a few deep beats. */
function drum(s: Synth, bed: Bed, t: number): void {
  const out = s.filter(
    "lowpass",
    900,
    0.6,
    s.pan(s.rnd(-0.5, 0.5), bed.crowd.dry),
  );
  if (bed.crowd.wet) link(out, s.gain(0.5, bed.crowd.wet));
  const beat = s.rnd(0.42, 0.5);
  const pattern = s.pick([
    [0, 1, 2, 2.5, 3],
    [0, 1, 1.5, 2, 3],
    [0, 0.5, 1, 2, 2.5, 3],
  ]);
  for (let round = 0; round < 2; round++) {
    for (const step of pattern) {
      const at = t + (round * 4 + step) * beat;
      const env = s.gain(0, out);
      const skin = s.osc("sine", 62, env, at, at + 0.45);
      glide(skin.frequency, at, 70, 44, 0.12);
      ad(env.gain, at, 0.003, BED_EVENTS.drum, 0.08);
    }
  }
}

function whistles(s: Synth, bed: Bed, t: number): void {
  fanWhistle(s, bed.crowd, t, BED_EVENTS.whistles);
}

/** A firework far off over the ground: a faint pop. */
function farFirework(s: Synth, bed: Bed, t: number): void {
  const far = s.gain(BED_EVENTS.firework, bed.mix.dry);
  playOneShot(
    s,
    { kind: "firework", distant: true },
    { dry: far, wet: bed.mix.wet },
    t,
  );
}

/** Every kind of event, by name: for measuring them one at a time (offline.ts). */
export const AMBIENT_EVENTS = {
  bird,
  cricket,
  car: carPass,
  dog,
  children,
  owl,
  shout,
  mate,
  parent,
  coach,
  claps,
  whistle: farWhistle,
  kick: farKick,
  swell,
  chant: sing,
  terrace,
  celebrate,
  drum,
  whistles,
  firework: farFirework,
} as const;

export type AmbientEvent = keyof typeof AMBIENT_EVENTS;

/** Plays one event on its own into `mix` at `t` (measuring only). */
export function playAmbientEvent(
  s: Synth,
  name: AmbientEvent,
  mix: Mix,
  t: number,
): void {
  AMBIENT_EVENTS[name](s, { mix, crowd: mix, swell: null }, t);
}

// --- the World Cup's hum ---------------------------------------------------------------------------

/** The recorded hum of a stadium of vuvuzelas (public/sounds/vuvuzela-crowd.mp3). */
export const HUM_TAKE = "vuvuzela-crowd";

/** The synthesised hum's gain that brings it to about unit RMS (measured offline). */
const HUM_SYNTH_NORM = 0.76;

/** Seconds the synthesised hum takes to hand over to the recording once it has loaded. */
const HUM_HANDOVER = 3;

/**
 * A stadium of vuvuzelas far off, synthesised: a dozen buzzing B flats (233 Hz) a little
 * sharp or flat, a few a semitone out, through the horn's bore and a low-pass of distance,
 * wandering slowly. About unit RMS, steady: nothing in it comes and goes.
 */
function synthHum(
  s: Synth,
  dest: AudioNode,
  start: number,
  stop: number,
): void {
  const out = s.flutter(0.35, 0.25, dest, start, stop);
  const tone = s.filter("lowpass", 1200, 0.6, out);
  const horns = s.gain(HUM_SYNTH_NORM, tone);
  link(horns, s.filter("bandpass", 650, 1.2, s.gain(0.6, tone)));
  const B_FLAT = 233.08;
  for (let i = 0; i < 12; i++) {
    const cents = s.rand() < 0.15 ? s.pick([-100, 100]) : s.rnd(-40, 40);
    const f = B_FLAT * 2 ** (cents / 1200);
    const reed = s.osc(
      "sawtooth",
      f,
      s.gain(s.rnd(0.5, 1), horns),
      start,
      stop,
    );
    s.osc(
      "sine",
      s.rnd(0.1, 0.5),
      s.gain(f * 0.005, reed.frequency),
      start,
      stop,
    );
  }
}

// --- the places -------------------------------------------------------------------------------------

/** A continuous crowd layer: a roar shaped like a vowel, at a crowd value of 1. */
interface Murmur {
  level: number;
  vowel: Vowel;
  q: number;
  bright: number;
  flutterRate: number;
  flutterDepth: number;
}

interface Recipe {
  air: number;
  traffic: number;
  /** The crowd's continuous layers (none in the park). */
  murmur: Murmur[];
  /** The swell event can lift the murmur. */
  swells: boolean;
  events: EventSpec[];
}

const at = (perMinute: number) => (): number => perMinute;
const people =
  (perMinute: number) =>
  (crowd: number): number =>
    perMinute * crowd;

/** A big crowd's roar, `level` loud. */
function bigCrowd(level: number, rate = 1.5, depth = 0.35): Murmur {
  return {
    level,
    vowel: VOWELS.ah,
    q: 2,
    bright: 2600,
    flutterRate: rate,
    flutterDepth: depth,
  };
}

/** Each place's layers, as mix.ts has them (BEDS.places). */
const LAYERS: Readonly<Record<Place, BedMix>> = BEDS.places;

/** A place's traffic now: by day or at night (mix.ts, BEDS). */
function traffic(place: Place, night: boolean): number {
  const bed = LAYERS[place];
  return night ? bed.trafficNight : bed.trafficDay;
}

/** A place's crowd layer now: by day or at night (mix.ts, BEDS). 0 where there is none. */
function murmur(place: Place, night: boolean): number {
  const bed = LAYERS[place];
  return (night ? bed.murmurNight : bed.murmurDay) ?? 0;
}

function recipe(place: Place, night: boolean): Recipe {
  // Birds by day, crickets by night, wherever there is grass and sky.
  const wildlife = (day: number, dark: number): EventSpec =>
    night
      ? { name: "cricket", rate: at(dark), play: cricket }
      : { name: "bird", rate: at(day), play: bird };
  switch (place) {
    // The home screen: calm enough to sit on for minutes. The stadium's murmur is low, dark
    // and nearly steady (a slow, shallow drift, never a swell); nothing in it cheers.
    case "town":
      return {
        air: LAYERS.town.air,
        traffic: traffic(place, night),
        murmur: [
          {
            level: murmur(place, night),
            vowel: VOWELS.ah,
            q: 2,
            bright: 440,
            flutterRate: 0.12,
            flutterDepth: 0.18,
          },
        ],
        swells: false,
        events: night
          ? [
              { name: "cricket", rate: at(8), play: cricket },
              { name: "car", rate: at(0.8), play: carPass },
              { name: "owl", rate: at(0.2), play: owl },
            ]
          : [
              { name: "bird", rate: at(6), play: bird },
              { name: "car", rate: at(1.2), play: carPass },
            ],
      };
    case "park":
      return {
        air: LAYERS.park.air,
        traffic: traffic(place, night),
        murmur: [],
        swells: false,
        events: night
          ? [
              { name: "cricket", rate: at(14), play: cricket },
              { name: "owl", rate: at(0.6), play: owl },
              { name: "car", rate: at(0.6), play: carPass },
              { name: "dog", rate: at(0.2), play: dog },
              { name: "mate", rate: people(1), play: mate },
            ]
          : [
              { name: "bird", rate: at(12), play: bird },
              { name: "dog", rate: at(0.8), play: dog },
              { name: "children", rate: at(2), play: children },
              { name: "car", rate: at(0.8), play: carPass },
              { name: "kick", rate: at(1.5), play: farKick },
              { name: "mate", rate: people(1.5), play: mate },
            ],
      };
    case "sunday":
      return {
        air: LAYERS.sunday.air,
        traffic: traffic(place, night),
        murmur: [],
        swells: false,
        events: [
          { name: "parent", rate: people(7), play: parent },
          { name: "coach", rate: people(1.5), play: coach },
          { name: "claps", rate: people(0.6), play: claps },
          { name: "whistle", rate: at(0.9), play: farWhistle },
          { name: "kick", rate: at(3), play: farKick },
          { name: "car", rate: at(0.5), play: carPass },
          { name: "dog", rate: at(0.3), play: dog },
          wildlife(6, 6),
        ],
      };
    case "nonleague":
      return {
        air: LAYERS.nonleague.air,
        traffic: traffic(place, night),
        murmur: [
          {
            level: murmur(place, night),
            vowel: VOWELS.eh,
            q: 4,
            bright: 2200,
            flutterRate: 5,
            flutterDepth: 0.6,
          },
        ],
        swells: false,
        events: [
          { name: "shout", rate: people(night ? 4 : 5), play: shout },
          { name: "claps", rate: people(0.8), play: claps },
          { name: "whistle", rate: at(0.5), play: farWhistle },
          { name: "kick", rate: at(2), play: farKick },
          wildlife(3, 3),
        ],
      };
    case "lower":
      return {
        air: LAYERS.lower.air,
        traffic: traffic(place, night),
        murmur: [
          {
            level: murmur(place, night),
            vowel: VOWELS.ah,
            q: 3,
            bright: 2400,
            flutterRate: 3,
            flutterDepth: 0.45,
          },
        ],
        swells: false,
        events: [
          { name: "terrace", rate: people(2.2), play: terrace },
          { name: "shout", rate: people(3), play: shout },
          { name: "claps", rate: people(1), play: claps },
          { name: "whistles", rate: people(0.6), play: whistles },
          { name: "whistle", rate: at(0.3), play: farWhistle },
        ],
      };
    case "top":
      return {
        air: LAYERS.top.air,
        traffic: traffic(place, night),
        murmur: [bigCrowd(murmur(place, night))],
        swells: true,
        events: [
          { name: "swell", rate: at(2), play: swell },
          { name: "chant", rate: people(night ? 1.8 : 1.2), play: sing },
          { name: "claps", rate: people(1), play: claps },
          { name: "whistles", rate: people(1), play: whistles },
        ],
      };
    case "international":
      return {
        air: LAYERS.international.air,
        traffic: traffic(place, night),
        murmur: [bigCrowd(murmur(place, night))],
        swells: true,
        events: [
          { name: "swell", rate: at(2.2), play: swell },
          { name: "chant", rate: people(1.4), play: sing },
          { name: "drum", rate: people(1.6), play: drum },
          { name: "claps", rate: people(1), play: claps },
          { name: "whistles", rate: people(1.2), play: whistles },
        ],
      };
    // The World Cup final: a huge crowd, and over it a bright wash of sound.
    case "final":
      return {
        air: LAYERS.final.air,
        traffic: traffic(place, night),
        murmur: [
          bigCrowd(murmur(place, night)),
          {
            level: LAYERS.final.wash ?? 0,
            vowel: VOWELS.eh,
            q: 2.5,
            bright: 3800,
            flutterRate: 0.7,
            flutterDepth: 0.3,
          },
        ],
        swells: true,
        events: [
          { name: "swell", rate: at(2.5), play: swell },
          { name: "chant", rate: people(1.8), play: sing },
          { name: "drum", rate: people(2.4), play: drum },
          { name: "claps", rate: people(1.2), play: claps },
          { name: "whistles", rate: people(1.5), play: whistles },
        ],
      };
    case "winners":
      return {
        air: LAYERS.winners.air,
        traffic: traffic(place, night),
        murmur: [bigCrowd(murmur(place, night), 2.5, 0.4)],
        swells: true,
        events: [
          { name: "swell", rate: at(3), play: swell },
          { name: "celebrate", rate: people(3), play: celebrate },
          { name: "drum", rate: people(2), play: drum },
          { name: "claps", rate: people(2), play: claps },
          { name: "whistles", rate: people(2.5), play: whistles },
          { name: "firework", rate: at(2.5), play: farFirework },
        ],
      };
  }
}

/** The key of a bed: a new one is made when it changes. */
export function ambienceKey(ambience: Ambience): string {
  return `${placeOf(ambience)}${ambience.night ? ":night" : ""}`;
}

function crowdOf(ambience: Ambience): number {
  return Number.isFinite(ambience.crowd)
    ? Math.max(0, Math.min(1, ambience.crowd))
    : 0;
}

/** Seconds a bed takes to come in or go. */
export const CROSSFADE = 2.5;

/** What a bed is given besides its recipe (engine.ts, `bedExtras`). */
export interface BedExtras {
  /** The recorded takes its events and layers may play (the claps, the hum). */
  takes?: Takes | null;
  /** The World Cup's hum: the gain of its unit-RMS source, or 0 for none (everywhere else). */
  hum?: number;
}

export class AmbienceBed {
  readonly key: string;
  readonly place: Place;
  readonly ambience: Ambience;
  private readonly ctx: BaseAudioContext;
  private readonly rand: () => number;
  /** The bed's own continuous layers. */
  private readonly base: Voice;
  /** The crossfade. */
  private readonly out: GainNode;
  private readonly crowdLevel: GainNode;
  private readonly bed: Bed;
  private readonly events: { spec: EventSpec; next: number }[];
  private readonly live = new Set<Voice>();
  private crowd: number;
  /** The bed is a recording. */
  private readonly recorded: boolean;
  /** Context time after which a fading bed is silent, or Infinity while it plays. */
  private goneAt = Infinity;
  /** How many events this bed has started, by name (for the debug view). */
  readonly started: Record<string, number> = {};
  private readonly takes: Takes | null;
  /** The hum's level, or null where there is none. */
  private humLevel: GainNode | null = null;
  /** The synthesised hum, until the recording takes over (then let go). */
  private humSynth: Voice | null = null;
  private humSynthOut: GainNode | null = null;
  /** The recorded hum is playing. */
  private humRecorded = false;
  /** When the synthesised hum can be let go, once handed over. */
  private humGoneAt = Infinity;

  constructor(
    ctx: BaseAudioContext,
    dest: AudioNode,
    wet: AudioNode | null,
    ambience: Ambience,
    rand: () => number,
    recorded: AudioBuffer | null = null,
    /** The recording's level (the engine evens it out to the synthesised bed's). */
    recordedGain = 1,
    { takes = null, hum = 0 }: BedExtras = {},
  ) {
    this.ctx = ctx;
    this.rand = rand;
    this.takes = takes;
    this.ambience = ambience;
    this.place = placeOf(ambience);
    this.key = ambienceKey(ambience);
    this.crowd = crowdOf(ambience);
    this.recorded = recorded !== null;
    const now = ctx.currentTime;
    this.base = new Voice(`ambience:${this.key}`, now);
    const s = new Synth(ctx, this.base, rand);
    const forever = now + 3600;

    this.out = s.gain(0, dest);
    this.out.gain.setValueAtTime(0, now);
    this.out.gain.linearRampToValueAtTime(1, now + CROSSFADE);
    this.crowdLevel = s.gain(this.crowdGain(this.crowd), this.out);
    const wetSend = wet ? s.gain(1, wet) : null;
    this.bed = {
      mix: { dry: this.out, wet: wetSend },
      crowd: { dry: this.crowdLevel, wet: wetSend },
      swell: null,
    };

    if (recorded) {
      // A recording replaces the whole bed: looped, levelled, and a little quieter with a
      // smaller crowd (it has the air and the traffic in it too).
      s.buffer(recorded, s.gain(recordedGain, this.crowdLevel), now, forever);
      this.events = [];
      return;
    }

    const r = recipe(this.place, ambience.night);
    if (r.air > 0) {
      const air = s.gain(r.air, this.out);
      s.noise(
        "pink",
        s.filter("lowpass", 900, 0.5, s.flutter(0.3, 0.5, air, now, forever)),
        now,
        forever,
      );
    }
    if (r.traffic > 0) {
      const road = s.gain(r.traffic, this.out);
      s.noise(
        "brown",
        s.filter("lowpass", 320, 0.5, s.flutter(0.15, 0.5, road, now, forever)),
        now,
        forever,
      );
    }
    if (r.murmur.length > 0) {
      const swell = s.gain(1, this.crowdLevel);
      for (const m of r.murmur) {
        const level = roar(s, { dry: swell, wet: wetSend }, now, forever, m);
        level.gain.value = m.level;
      }
      if (r.swells) this.bed.swell = swell;
      if (hum > 0) {
        // Under the roar, and lifted with it by the crowd's swells.
        this.humLevel = s.gain(hum, swell);
        const take = takes?.(HUM_TAKE) ?? null;
        if (take) this.recordHum(take, now, 0);
        else {
          this.humSynth = new Voice(`ambience:${this.key}:hum`, now);
          const hs = new Synth(ctx, this.humSynth, rand);
          this.humSynthOut = hs.gain(1, this.humLevel);
          synthHum(hs, this.humSynthOut, now, forever);
        }
      }
    }
    // Each kind of event starts at a random point in its first interval, so they do not
    // all go off together when the bed comes in.
    this.events = r.events.map((spec) => ({
      spec,
      next: now + 0.5 + this.interval(spec) * this.rand(),
    }));
  }

  /**
   * The recorded hum, looped from a random place, fading in over `fade` seconds (0: at
   * once, and the bed's own crossfade brings it in).
   */
  private recordHum(take: Take, now: number, fade: number): void {
    if (!this.humLevel) return;
    this.humRecorded = true;
    const s = new Synth(this.ctx, this.base, this.rand);
    const g = s.gain(fade > 0 ? 0 : take.gain, this.humLevel);
    if (fade > 0) {
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(take.gain, now + fade);
    }
    s.buffer(take.buffer, g, now, now + 3600);
  }

  /** The synthesised hum hands over to the recording once it has loaded. */
  private handOverHum(now: number): void {
    if (this.humRecorded || !this.humSynthOut) return;
    const take = this.takes?.(HUM_TAKE) ?? null;
    if (!take) return;
    this.recordHum(take, now, HUM_HANDOVER);
    const g = this.humSynthOut.gain;
    g.setValueAtTime(1, now);
    g.linearRampToValueAtTime(0, now + HUM_HANDOVER);
    this.humGoneAt = now + HUM_HANDOVER + 0.1;
  }

  /** Seconds until the next of `spec`, around its mean, or a while if it is off. */
  private interval(spec: EventSpec): number {
    const rate = spec.rate(this.crowd);
    if (!(rate > 0)) return 5;
    return (60 / rate) * (0.4 + 1.2 * this.rand());
  }

  /** The crowd value changed: the people in the bed follow it over a second or so. */
  setCrowd(ambience: Ambience, now: number): void {
    const crowd = crowdOf(ambience);
    if (crowd === this.crowd) return;
    this.crowd = crowd;
    this.crowdLevel.gain.setTargetAtTime(this.crowdGain(crowd), now, 0.4);
  }

  /**
   * The people's level: the crowd value, or for a recording from BEDS.recordedQuietest
   * (0.5) at crowd 0 to 1 at crowd 1.
   */
  private crowdGain(crowd: number): number {
    const quietest = BEDS.recordedQuietest;
    return this.recorded ? quietest + (1 - quietest) * crowd : crowd;
  }

  /** Starts every event due before `until`. */
  schedule(until: number): void {
    if (this.goneAt !== Infinity) return;
    this.handOverHum(this.ctx.currentTime);
    for (const event of this.events) {
      while (event.next <= until) {
        const t = event.next;
        event.next = t + this.interval(event.spec);
        if (!(event.spec.rate(this.crowd) > 0)) continue;
        const voice = new Voice(`ambience:${event.spec.name}`, t);
        event.spec.play(
          new Synth(this.ctx, voice, this.rand, this.takes),
          this.bed,
          t,
        );
        this.live.add(voice);
        this.started[event.spec.name] =
          (this.started[event.spec.name] ?? 0) + 1;
      }
    }
  }

  /** Frees the events that have finished. Returns how many. */
  sweep(now: number): number {
    let freed = 0;
    if (this.humSynth && now >= this.humGoneAt) {
      this.humSynth.dispose();
      this.humSynth = null;
      this.humSynthOut = null;
      freed++;
    }
    for (const voice of this.live) {
      if (now > voice.end + 0.1) {
        voice.dispose();
        this.live.delete(voice);
        freed++;
      }
    }
    return freed;
  }

  /** Events playing now. */
  get playing(): number {
    return this.live.size;
  }

  fadeOut(now: number, time = CROSSFADE): void {
    if (this.goneAt !== Infinity) return;
    const g = this.out.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0, now + time);
    this.goneAt = now + time + 0.1;
  }

  /** Faded out completely. */
  gone(now: number): boolean {
    return now >= this.goneAt;
  }

  dispose(): void {
    for (const voice of this.live) voice.dispose();
    this.live.clear();
    this.humSynth?.dispose();
    this.humSynth = null;
    this.base.dispose();
  }
}
