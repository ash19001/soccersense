/**
 * THE MIX: every number that makes a sound in the game louder or quieter, in one place.
 *
 * Hear every sound and try other levels at /dev/sound on the dev server (a slider beside
 * each number below changes it in memory at once, and "copy changes" gives the lines to
 * paste here). To keep a change, edit the number here and save: the dev server reloads.
 * docs/AUDIO.md, "Changing the volumes", says more.
 *
 * Two kinds of number:
 * - a gain, 0 to 1 (sometimes a little over): a multiplier. Higher is louder; 0.5 is about
 *   6 dB quieter than 1, 0.25 about 12 dB.
 * - dB (names ending in `Db`): decibels. Nearer 0 (or higher) is louder; every 6 dB is
 *   twice or half as loud in level, 10 dB about twice or half as loud to the ear.
 * The peak a recording is brought to (`peakDb`) is in dBFS: 0 is the loudest a speaker
 * can go, and nothing here goes past -4.4 (BUSES.safety).
 *
 * Pure data, no browser: the engine (engine.ts and the rest of app/audio) reads it when a
 * sound starts, and the scenes (career.ts, menu.ts) and the home page's picture (stadium.ts,
 * stadium-mascot.ts) import the powers and sizes they send. Keep one number to a line, as it
 * is: the sound board finds each line by its name.
 *
 * Not here, because they are the shape of a sound rather than its loudness: how each voice
 * is built (voices.ts, crowd.ts) and how often a bed's events come (the rates in
 * ambience.ts, `recipe`).
 */

import type { Grade } from "~/game/types";
import type { ScoreShot, SoundCue } from "~/scenes/scene";

import type { Place } from "./place";

/** One sound the game makes, as the engine plays it. */
export interface SoundMix {
  /** Gain into the effects bus, 0 to 1: higher is louder. Scales the synthesised voice. */
  level: number;
  /**
   * The peak (dBFS) a recording of it is brought to, whatever level the file came at: nearer
   * 0 is louder. Absent for the wind (levelled by its noise) and the stings (STINGS).
   */
  peakDb?: number;
  /** A recording at power 0 (the kick, the landing), a share of it at 1: higher is louder. */
  softest?: number;
  /** A recording at size 0 (the cheer), a share of it at size 1: higher is louder. */
  smallest?: number;
  /** The recording it plays, in public/sounds/ (null: synthesised, no file yet). */
  file: string | null;
  /** What plays without the file, or until it has loaded. */
  synth: string;
}

// ---------------------------------------------------------------------------------------------
// The master and the buses
// ---------------------------------------------------------------------------------------------

/**
 * Everything goes through these. voices -> effects -> master; beds -> ambience -> master;
 * a share of the crowd and the bangs -> room (a small reverb) -> master.
 */
export const BUSES = {
  /** Gain of everything at once, 0 to 1: higher is louder. Turn this to turn the game. */
  master: 0.8,
  /** Gain of every one-shot sound (the ball, the crowd, the stings...): higher is louder. */
  effects: 1,
  /** Gain of the background beds (each place's ambience): higher is louder. */
  ambience: 0.45,
  /** Gain of the reverb (the room the crowd and the bangs ring in): higher is wetter. */
  room: 0.25,
  /**
   * Where the safety starts to round off peaks, a sample value 0 to 0.98 (0.6 is -4.4
   * dBFS): higher lets more through untouched. Below it nothing is changed at all.
   */
  safety: 0.6,
};

// ---------------------------------------------------------------------------------------------
// Each sound
// ---------------------------------------------------------------------------------------------

/**
 * Each sound by its cue: `level` is the synthesised voice's gain (0 to 1, higher is louder),
 * `peakDb` the peak a recording is brought to (dBFS, nearer 0 is louder). A recording is
 * any file named after the cue in public/sounds/ (docs/AUDIO.md); `file` says which one
 * plays today.
 */
export const SOUNDS = {
  touch: {
    /** Gain, 0 to 1: higher is louder. A light touch on the ball. */
    level: 0.15,
    /** Peak of the recording, dBFS: nearer 0 is louder. */
    peakDb: -22,
    file: "touch-1.mp3, touch-2.mp3, touch-3.mp3 (in turn)",
    synth: "a soft leather tap: a hollow knock and a brush of noise",
  },
  kick: {
    /** Gain, 0 to 1: higher is louder. Every strike; louder still with its power. */
    level: 0.19,
    /** Peak of the recording at full power, dBFS: nearer 0 is louder. */
    peakDb: -10.5,
    /** The recording at power 0, as a share of it at power 1, 0 to 1: higher is louder. */
    softest: 0.45,
    file: "kick.mp3",
    synth: "a boot's thump, the ball's knock and a slap of leather",
  },
  net: {
    /** Gain, 0 to 1: higher is louder. The ball into the net (NET: how hard, by shot). */
    level: 0.42,
    /** Peak of the recording, dBFS: nearer 0 is louder. */
    peakDb: -14.8,
    file: "net.mp3",
    synth: "a falling swish, a fluttering rattle and a dull puff",
  },
  wind: {
    /** Gain, 0 to 1: higher is louder. The rush past a spinning or flying ball. */
    level: 0.4,
    file: null,
    synth: "rushing pink noise that follows the ball's speed",
  },
  cheer: {
    /** Gain, 0 to 1: higher is louder. A goal's cheer (CROWD: how many people). */
    level: 0.4,
    /** Peak of a recording at full size in a top-flight stadium, dBFS: nearer 0 louder. */
    peakDb: -8.7,
    /** A recording at size 0, as a share of it at size 1, 0 to 1: higher is louder. */
    smallest: 0.35,
    file: null,
    synth: "mates whooping in the park, up to a stadium's roar and applause",
  },
  groan: {
    /** Gain, 0 to 1: higher is louder. A miss: the crowd's long "ohhh". */
    level: 0.4,
    /** Peak of a recording in a top-flight stadium, dBFS: nearer 0 is louder. */
    peakDb: -14.5,
    file: null,
    synth: "a crowd's long falling ohhh",
  },
  ooh: {
    /** Gain, 0 to 1: higher is louder. A near miss: a short gasp. */
    level: 0.5,
    /** Peak of a recording in a top-flight stadium, dBFS: nearer 0 is louder. */
    peakDb: -16.8,
    file: null,
    synth: "a short rising gasp",
  },
  whistle: {
    /** Gain, 0 to 1: higher is louder. The referee (time up, full time). */
    level: 0.15,
    /** Peak of the recording, dBFS: nearer 0 is louder. */
    peakDb: -16.8,
    file: null,
    synth: "a pea whistle; three blasts at full time",
  },
  squeak: {
    /** Gain, 0 to 1: higher is louder. The home page's mascot, squeezed. */
    level: 0.21,
    /** Peak of the recording, dBFS: nearer 0 is louder. */
    peakDb: -17,
    file: null,
    synth: "a rubbery stretch and a small boing",
  },
  pop: {
    /** Gain, 0 to 1: higher is louder. The home page's airship, popped. */
    level: 0.25,
    /** Peak of the recording, dBFS: nearer 0 is louder. */
    peakDb: -8.6,
    file: null,
    synth: "a bang, a boom and the gas rushing out",
  },
  thud: {
    /** Gain, 0 to 1: higher is louder. The airship coming down on the ground. */
    level: 0.18,
    /** Peak of the recording, dBFS: nearer 0 is louder. */
    peakDb: -10.9,
    file: null,
    synth: "a low thump, a rumble and a puff of dust",
  },
  splash: {
    /** Gain, 0 to 1: higher is louder. The airship coming down in the pond. */
    level: 0.27,
    /** Peak of the recording, dBFS: nearer 0 is louder. */
    peakDb: -12.9,
    file: null,
    synth: "a wash falling in pitch, and droplets",
  },
  firework: {
    /** Gain, 0 to 1: higher is louder. A near firework (FIREWORKS: the far ones). */
    level: 0.1,
    /** Peak of the recording, dBFS: nearer 0 is louder. */
    peakDb: -14.4,
    file: "firework.mp3 (near), firework-far.mp3 (far)",
    synth: "a rising whistle, a soft bang and crackling",
  },
  vuvuzela: {
    /** Gain, 0 to 1: higher is louder. A blast of horns for a World Cup goal. */
    level: 0.3,
    /** Peak of the recording at full size, dBFS: nearer 0 is louder. */
    peakDb: -14.1,
    file: "vuvuzela.mp3",
    synth: "a swarm of buzzing B flats",
  },
  sweep: {
    /** Gain, 0 to 1: higher is louder. A promotion's whoosh across the screen. */
    level: 0.22,
    /** Peak of the recording, dBFS: nearer 0 is louder. */
    peakDb: -13.4,
    file: null,
    synth: "a whoosh of wind and dust, left to right",
  },
  click: {
    /** Gain, 0 to 1: higher is louder. Every button. */
    level: 0.12,
    /** Peak of the recording, dBFS: nearer 0 is louder. */
    peakDb: -24.2,
    file: "click.mp3",
    synth: "a crisp tick and a short wooden tock",
  },
  transition: {
    /** Gain, 0 to 1: higher is louder. The iris between the home page and the game. */
    level: 0.3,
    /** Peak of the recording, dBFS: nearer 0 is louder. */
    peakDb: -18.7,
    file: null,
    synth: "a soft whoosh, falling as it closes and rising as it opens",
  },
  score: {
    /** Gain, 0 to 1: higher is louder. Every result sting (STINGS: each shot's own). */
    level: 0.4,
    file: null,
    synth: "a chip-tune sting, bigger the better the shot",
  },
  sparkle: {
    /** Gain, 0 to 1: higher is louder. AWAY's ball twinkling out in the sky. */
    level: 0.47,
    /** Peak of the recording, dBFS: nearer 0 is louder. */
    peakDb: -19,
    file: "sparkle.mp3",
    synth: "two bell-like chimes and a few high twinkles",
  },
  land: {
    /** Gain, 0 to 1: higher is louder. HOME's ball landing on the centre spot. */
    level: 0.28,
    /** Peak of the recording at full power, dBFS: nearer 0 is louder. */
    peakDb: -13,
    /** At power 0, as a share of power 1, 0 to 1: higher is louder (HOME_PAGE.hop). */
    softest: 0.15,
    file: "land.mp3",
    synth: "a dull thump falling in pitch, a knock and a brush of grass",
  },
} satisfies Record<SoundCue["kind"], SoundMix>;

// ---------------------------------------------------------------------------------------------
// The crowd, by place
// ---------------------------------------------------------------------------------------------

/**
 * The crowd's voices (cheer, groan, ooh) at each place: the home page's town, then the
 * career tiers from the park (tier 0) to the winners (tier 7).
 */
export const CROWD = {
  /**
   * How much of the crowd reaches the home page from the stadium across town, gain 0 to 1:
   * higher is louder. (The home picture's goal cheer: HOME_PAGE.pictureCheer.)
   */
  acrossTown: 0.18,
  places: {
    town: {
      /** How many people, 0 (a few mates) to 1 (a final): more is bigger and louder. */
      people: 0.8,
      /** A recording's level here against a top-flight stadium, dB: higher is louder. */
      recordingDb: -15.3,
    },
    park: {
      /** People, 0 to 1: more is bigger and louder (under 0.2: a few mates whooping). */
      people: 0,
      /** A recording's level here against a top-flight stadium, dB: higher is louder. */
      recordingDb: -8.6,
    },
    sunday: {
      /** People, 0 to 1: more is bigger and louder (under 0.2: a few mates whooping). */
      people: 0.12,
      /** A recording's level here against a top-flight stadium, dB: higher is louder. */
      recordingDb: -8.2,
    },
    nonleague: {
      /** People, 0 to 1: more is bigger and louder. */
      people: 0.32,
      /** A recording's level here against a top-flight stadium, dB: higher is louder. */
      recordingDb: -4.1,
    },
    lower: {
      /** People, 0 to 1: more is bigger and louder. */
      people: 0.5,
      /** A recording's level here against a top-flight stadium, dB: higher is louder. */
      recordingDb: -1.3,
    },
    top: {
      /** People, 0 to 1: more is bigger and louder. */
      people: 0.75,
      /** A recording's level here against a top-flight stadium, dB: higher is louder. */
      recordingDb: 0,
    },
    international: {
      /** People, 0 to 1: more is bigger and louder. */
      people: 0.86,
      /** A recording's level here against a top-flight stadium, dB: higher is louder. */
      recordingDb: 0.5,
    },
    final: {
      /** People, 0 to 1: more is bigger and louder. */
      people: 1,
      /** A recording's level here against a top-flight stadium, dB: higher is louder. */
      recordingDb: 1.1,
    },
    winners: {
      /** People, 0 to 1: more is bigger and louder. */
      people: 1,
      /** A recording's level here against a top-flight stadium, dB: higher is louder. */
      recordingDb: 1.1,
    },
  } satisfies Record<Place, { people: number; recordingDb: number }>,
};

// ---------------------------------------------------------------------------------------------
// The background beds, by place and career tier
// ---------------------------------------------------------------------------------------------

/** One place's bed: its continuous layers. Gains 0 to 1, higher is louder. */
export interface BedMix {
  /** The crowd value the scene asks for (0 to 1): it scales every person in the bed. */
  crowd: number;
  /** A recorded bed's average (RMS, dBFS) by day at crowd 1: nearer 0 is louder. */
  rmsDb: number;
  /** The air (soft pink noise), gain. */
  air: number;
  /** Distant traffic by day, and at night, gain. */
  trafficDay: number;
  trafficNight: number;
  /** The crowd's murmur or roar by day, and at night, gain (absent: no crowd layer). */
  murmurDay?: number;
  murmurNight?: number;
  /** The final's bright wash of sound over the roar, gain. */
  wash?: number;
}

/**
 * Each place's bed. `crowd` is what the scene sends (the home page 0.3; the career, by
 * tier); the rest are the bed's layers. A bed's events (birds, shouts, drums...) are in
 * BED_EVENTS. All of it goes through BUSES.ambience.
 */
export const BEDS = {
  /** A recorded bed at night against by day, dB: higher is louder. */
  nightDb: -2,
  /** A recorded bed at crowd 0, as a share of it at crowd 1, 0 to 1: higher is louder. */
  recordedQuietest: 0.5,
  places: {
    /** The home page: a stadium's murmur across town, traffic, birds. */
    town: {
      /** Crowd value the home page sends, 0 to 1: higher is louder. */
      crowd: 0.3,
      /** A recorded bed's RMS, dBFS: nearer 0 is louder. */
      rmsDb: -46,
      /** Air, gain 0 to 1: higher is louder. */
      air: 0.045,
      /** Traffic by day, gain 0 to 1: higher is louder. */
      trafficDay: 0.07,
      /** Traffic at night, gain 0 to 1: higher is louder. */
      trafficNight: 0.05,
      /** The far stadium's murmur by day, gain 0 to 1: higher is louder. */
      murmurDay: 0.06,
      /** The far stadium's murmur at night, gain 0 to 1: higher is louder. */
      murmurNight: 0.05,
    },
    /** Tier 0, the park: birds, a dog, children, mates calling. */
    park: {
      /** Crowd value at tier 0, 0 to 1: higher is louder. */
      crowd: 0.1,
      /** A recorded bed's RMS, dBFS: nearer 0 is louder. */
      rmsDb: -45.5,
      /** Air, gain 0 to 1: higher is louder. */
      air: 0.06,
      /** Traffic by day, gain 0 to 1: higher is louder. */
      trafficDay: 0.065,
      /** Traffic at night, gain 0 to 1: higher is louder. */
      trafficNight: 0.045,
    },
    /** Tier 1, Sunday league: parents and subs shouting, the coach. */
    sunday: {
      /** Crowd value at tier 1, 0 to 1: higher is louder. */
      crowd: 0.2,
      /** A recorded bed's RMS, dBFS: nearer 0 is louder. */
      rmsDb: -44.5,
      /** Air, gain 0 to 1: higher is louder. */
      air: 0.06,
      /** Traffic by day, gain 0 to 1: higher is louder. */
      trafficDay: 0.05,
      /** Traffic at night, gain 0 to 1: higher is louder. */
      trafficNight: 0.05,
    },
    /** Tier 2, non-league: a small crowd's chatter. */
    nonleague: {
      /** Crowd value at tier 2, 0 to 1: higher is louder. */
      crowd: 0.35,
      /** A recorded bed's RMS, dBFS: nearer 0 is louder. */
      rmsDb: -42.5,
      /** Air, gain 0 to 1: higher is louder. */
      air: 0.05,
      /** Traffic by day, gain 0 to 1: higher is louder. */
      trafficDay: 0.04,
      /** Traffic at night, gain 0 to 1: higher is louder. */
      trafficNight: 0.04,
      /** The chatter by day, gain 0 to 1: higher is louder. */
      murmurDay: 0.085,
      /** The chatter at night, gain 0 to 1: higher is louder. */
      murmurNight: 0.07,
    },
    /** Tier 3, the lower leagues: a terrace singing over the chatter. */
    lower: {
      /** Crowd value at tier 3, 0 to 1: higher is louder. */
      crowd: 0.5,
      /** A recorded bed's RMS, dBFS: nearer 0 is louder. */
      rmsDb: -40.5,
      /** Air, gain 0 to 1: higher is louder. */
      air: 0.04,
      /** Traffic by day, gain 0 to 1: higher is louder. */
      trafficDay: 0.02,
      /** Traffic at night, gain 0 to 1: higher is louder. */
      trafficNight: 0.02,
      /** The crowd by day, gain 0 to 1: higher is louder. */
      murmurDay: 0.095,
      /** The crowd at night, gain 0 to 1: higher is louder. */
      murmurNight: 0.08,
    },
    /** Tier 4, the top flight: a big crowd's roar. */
    top: {
      /** Crowd value at tier 4, 0 to 1: higher is louder. */
      crowd: 0.75,
      /** A recorded bed's RMS, dBFS: nearer 0 is louder. */
      rmsDb: -38.5,
      /** Air, gain 0 to 1: higher is louder. */
      air: 0.03,
      /** Traffic by day, gain 0 to 1: higher is louder. */
      trafficDay: 0,
      /** Traffic at night, gain 0 to 1: higher is louder. */
      trafficNight: 0,
      /** The roar by day, gain 0 to 1: higher is louder. */
      murmurDay: 0.11,
      /** The roar at night, gain 0 to 1: higher is louder. */
      murmurNight: 0.1,
    },
    /** Tier 5, internationals: bigger, with drums. */
    international: {
      /** Crowd value at tier 5, 0 to 1: higher is louder. */
      crowd: 0.85,
      /** A recorded bed's RMS, dBFS: nearer 0 is louder. */
      rmsDb: -37.5,
      /** Air, gain 0 to 1: higher is louder. */
      air: 0.03,
      /** Traffic by day, gain 0 to 1: higher is louder. */
      trafficDay: 0,
      /** Traffic at night, gain 0 to 1: higher is louder. */
      trafficNight: 0,
      /** The roar by day, gain 0 to 1: higher is louder. */
      murmurDay: 0.12,
      /** The roar at night, gain 0 to 1: higher is louder. */
      murmurNight: 0.11,
    },
    /** Tier 6, the World Cup final: a huge crowd, a bright wash, the hum (VUVUZELA). */
    final: {
      /** Crowd value at tier 6, 0 to 1: higher is louder. */
      crowd: 1,
      /** A recorded bed's RMS, dBFS: nearer 0 is louder. */
      rmsDb: -37,
      /** Air, gain 0 to 1: higher is louder. */
      air: 0.03,
      /** Traffic by day, gain 0 to 1: higher is louder. */
      trafficDay: 0,
      /** Traffic at night, gain 0 to 1: higher is louder. */
      trafficNight: 0,
      /** The roar by day, gain 0 to 1: higher is louder. */
      murmurDay: 0.12,
      /** The roar at night (the final is always at night), gain 0 to 1: higher is louder. */
      murmurNight: 0.12,
      /** The bright wash over the roar, gain 0 to 1: higher is louder. */
      wash: 0.05,
    },
    /** Tier 7, the winners: the whole ground singing, the hum (VUVUZELA). */
    winners: {
      /** Crowd value at tier 7, 0 to 1: higher is louder. */
      crowd: 1,
      /** A recorded bed's RMS, dBFS: nearer 0 is louder. */
      rmsDb: -37.5,
      /** Air, gain 0 to 1: higher is louder. */
      air: 0.03,
      /** Traffic by day, gain 0 to 1: higher is louder. */
      trafficDay: 0,
      /** Traffic at night, gain 0 to 1: higher is louder. */
      trafficNight: 0,
      /** The roar by day, gain 0 to 1: higher is louder. */
      murmurDay: 0.12,
      /** The roar at night (always at night), gain 0 to 1: higher is louder. */
      murmurNight: 0.12,
    },
  } satisfies Record<Place, BedMix>,
};

/**
 * The things that happen now and then in the beds, each one's loudness (gain, higher is
 * louder). Where there are two, each time picks a level between them. How often each comes,
 * and at which places, is in ambience.ts (`recipe`).
 */
export const BED_EVENTS = {
  bird: {
    /** A bird's chirps, gain from: higher is louder. */
    quietest: 0.04,
    /** ...to: higher is louder. */
    loudest: 0.09,
  },
  cricket: {
    /** Crickets at night, gain from: higher is louder. */
    quietest: 0.015,
    /** ...to: higher is louder. */
    loudest: 0.03,
  },
  car: {
    /** A car going by, gain from: higher is louder. */
    quietest: 0.25,
    /** ...to: higher is louder. */
    loudest: 0.45,
  },
  dog: {
    /** A dog's barks, gain from: higher is louder. */
    quietest: 0.18,
    /** ...to: higher is louder. */
    loudest: 0.3,
  },
  /** Children playing in the park, gain: higher is louder. */
  children: 0.09,
  owl: {
    /** An owl's hoots at night, gain: higher is louder. */
    hoot: 0.05,
    /** ...as each hoot is held, gain: higher is louder. */
    held: 0.045,
  },
  /** One voice from the touchline (non-league, lower leagues), gain: higher is louder. */
  shout: 0.18,
  /** A mate in the park calling for it, gain: higher is louder. */
  mate: 0.1,
  /** A parent or a sub on a Sunday touchline, gain: higher is louder. */
  parent: 0.15,
  /** The Sunday coach, gain: higher is louder. */
  coach: 0.17,
  claps: {
    /** A few people clapping: as they start, gain: higher is louder. */
    start: 0.35,
    /** ...as they carry on, gain: higher is louder. */
    held: 0.28,
    /** How many claps a second on each side: more is a bigger, louder clap. */
    perSecond: 14,
  },
  /** The referee's whistle across the field, gain: higher is louder. */
  whistle: 0.05,
  /** A ball kicked somewhere on the field, gain: higher is louder. */
  kick: 0.1,
  swell: {
    /** A big crowd's roar lifting for a moment, times its level from: higher is bigger. */
    least: 1.15,
    /** ...to: higher is bigger. */
    most: 1.4,
  },
  /** A stand singing (top flight and up), gain: higher is louder. */
  chant: 0.03,
  /** A lower-league terrace singing, gain: higher is louder. */
  terrace: 0.032,
  /** The winners' whole ground singing, gain: higher is louder. */
  celebrate: 0.034,
  /** A drum in the stands, gain: higher is louder. */
  drum: 0.16,
  /** Fans whistling, gain: higher is louder. */
  whistles: 0.035,
  /** The winners' far fireworks, gain: higher is louder. */
  firework: 0.5,
};

// ---------------------------------------------------------------------------------------------
// The result stings, by shot
// ---------------------------------------------------------------------------------------------

/**
 * Each result's sting: `gain` against the others (the synthesised sting, higher is louder)
 * and `peakDb`, the peak a recording (`score-<shot>.mp3`) is brought to (dBFS, nearer 0
 * is louder). All of them go through SOUNDS.score.level.
 */
export const STINGS = {
  worldie: {
    /** Gain against the others: higher is louder. */
    gain: 0.95,
    /** Peak of a recording, dBFS: nearer 0 is louder. */
    peakDb: -8.8,
  },
  golazo: {
    /** Gain against the others: higher is louder. */
    gain: 0.95,
    /** Peak of a recording, dBFS: nearer 0 is louder. */
    peakDb: -10.7,
  },
  trivela: {
    /** Gain against the others: higher is louder. */
    gain: 1.15,
    /** Peak of a recording, dBFS: nearer 0 is louder. */
    peakDb: -14,
  },
  toepoke: {
    /** Gain against the others: higher is louder. */
    gain: 1.2,
    /** Peak of a recording, dBFS: nearer 0 is louder. */
    peakDb: -15,
  },
  tapin: {
    /** Gain against the others: higher is louder. */
    gain: 0.85,
    /** Peak of a recording, dBFS: nearer 0 is louder. */
    peakDb: -14.9,
  },
  miss: {
    /** Gain against the others: higher is louder. */
    gain: 1.2,
    /** Peak of a recording, dBFS: nearer 0 is louder. */
    peakDb: -14.7,
  },
} satisfies Record<ScoreShot, { gain: number; peakDb: number }>;

// ---------------------------------------------------------------------------------------------
// The net, by shot
// ---------------------------------------------------------------------------------------------

/**
 * The net under each goal's sting, as a share of SOUNDS.net (0 to 1, higher is louder): a
 * tap in barely ripples it, a worldie bulges it. A miss has none, nor do the park's goals.
 */
export const NET: Partial<Record<ScoreShot, number>> = {
  /** Share of the net's level, 0 to 1: higher is louder. */
  worldie: 1,
  /** Share of the net's level, 0 to 1: higher is louder. */
  golazo: 1,
  /** Share of the net's level, 0 to 1: higher is louder. */
  trivela: 0.85,
  /** Share of the net's level, 0 to 1: higher is louder. */
  toepoke: 0.7,
  /** Share of the net's level, 0 to 1: higher is louder. */
  tapin: 0.6,
};

// ---------------------------------------------------------------------------------------------
// Fireworks, near and far
// ---------------------------------------------------------------------------------------------

/**
 * A near firework is SOUNDS.firework. A far one (the home page's, and the career's over the
 * stand) is quieter by `farDb` and raised again by `farLiftDb`, synthesised or recorded.
 * The winners' bed has its own far fireworks: BED_EVENTS.firework.
 */
export const FIREWORKS = {
  /** A far firework's peak against a near one's, dB: higher is louder. */
  farDb: -19.5,
  /** Added to the far ones (2026-11-12: "very slightly louder"), dB: higher is louder. */
  farLiftDb: 2,
};

// ---------------------------------------------------------------------------------------------
// The vuvuzela
// ---------------------------------------------------------------------------------------------

/**
 * The World Cup's horns (tiers 6 and 7 only: anywhere else a blast is dropped). A goal's
 * blast is SOUNDS.vuvuzela; the beds' steady hum is set here.
 */
export const VUVUZELA = {
  /** A tap in's blast (size 0) as a share of a worldie's (size 1), 0 to 1: higher louder. */
  smallest: 0.35,
  /** The hum's recording is brought to this average first (dBFS): leave it at 0. */
  humTakeRmsDb: 0,
  hum: {
    /** The hum's average under the final's bed, dBFS: nearer 0 is louder. */
    final: -50,
    /** The hum's average under the winners' bed, dBFS: nearer 0 is louder. */
    winners: -50,
  } satisfies Partial<Record<Place, number>>,
};

// ---------------------------------------------------------------------------------------------
// The claps
// ---------------------------------------------------------------------------------------------

/**
 * Every clap in the game (the applause in a cheer, the beds' claps) is claps.mp3, layered
 * by the crowd: one layer for a few mates, up to `mostLayers` for a stand.
 */
export const CLAPS = {
  /** The recording's average, as one layer, dBFS: nearer 0 is louder. */
  takeRmsDb: -21,
  /** A few hands quieter than a stand: dB over the layers, lower is quieter few. */
  fewDb: -4.2,
  /** Claps a second (each side) that one layer stands for: lower is more layers. */
  perLayer: 5,
  /** Never more layers than this: more is a bigger, denser stand. */
  mostLayers: 9,
};

// ---------------------------------------------------------------------------------------------
// The home page
// ---------------------------------------------------------------------------------------------

/** What the home page's ball and picture send (menu.ts, art/stadium.ts). */
export const HOME_PAGE = {
  /** A press on the ball: a soft kick, power 0 to 1, higher is louder. */
  press: 0.3,
  /** The kick-off's strike, power 0 to 1: higher is louder. */
  strike: 1,
  /** HOME's ball landing on the centre spot, power 0 to 1: higher is louder. */
  land: 1,
  /** ...and its small bounce 0.2 s later, power 0 to 1: higher is louder. */
  hop: 0.35,
  /** The struck ball's wind as it leaves the boot, speed 0 to 1: higher is louder. */
  strikeWind: 0.9,
  /** HOME's wind as it lands, a share of the strike's, 0 to 1: higher is louder. */
  homeWindEnd: 0.4,
  /** AWAY's wind as it vanishes, a share of the strike's, 0 to 1: higher is louder. */
  awayWindEnd: 0.25,
  /** The picture's match far off: its goal's cheer, size 0 to 1, higher is louder. */
  pictureCheer: 0.1,
  /** The mascot's touches on his ball (his tricks), level 0 to 1: higher is louder. */
  mascotTouch: 1,
  /** The mascot's flick of the ball up to his head, power 0 to 1: higher is louder. */
  mascotFlick: 0.25,
  /** The mascot's big swing before his tumble, power 0 to 1: higher is louder. */
  mascotSwing: 0.9,
};

// ---------------------------------------------------------------------------------------------
// The game: each shot
// ---------------------------------------------------------------------------------------------

/** What the career scene sends for one shot (career.ts). */
export interface ShotMix {
  /** The strike's kick, power 0 to 1 (0: none): higher is louder. */
  kick: number;
  /** The crowd's cheer as it goes in, size 0 to 1 (0: none): higher is bigger. */
  cheer: number;
  /** The wind of the ball's flight, speed 0 to 1 (0: none): higher is louder. */
  wind: number;
}

/**
 * The game's shots (career.ts). A goal at the World Cup also blows the horns, as big as
 * its cheer. The result's sting is STINGS.
 */
export const GAME = {
  shots: {
    worldie: {
      /** The bicycle kick, power 0 to 1: higher is louder. */
      kick: 1,
      /** The cheer, size 0 to 1: higher is bigger. */
      cheer: 1,
      /** The wind, speed 0 to 1: higher is louder. */
      wind: 1,
    },
    golazo: {
      /** The kick, power 0 to 1: higher is louder. */
      kick: 0.75,
      /** The cheer, size 0 to 1: higher is bigger. */
      cheer: 0.8,
      /** The wind, speed 0 to 1: higher is louder. */
      wind: 0.6,
    },
    trivela: {
      /** The kick, power 0 to 1: higher is louder. */
      kick: 0.85,
      /** The cheer, size 0 to 1: higher is bigger. */
      cheer: 0.6,
      /** The wind, speed 0 to 1: higher is louder. */
      wind: 0.75,
    },
    toepoke: {
      /** The kick, power 0 to 1: higher is louder. */
      kick: 0.35,
      /** The cheer, size 0 to 1: higher is bigger. */
      cheer: 0.4,
      /** The wind, speed 0 to 1: higher is louder. */
      wind: 0,
    },
    tapin: {
      /** The kick, power 0 to 1: higher is louder. */
      kick: 0.2,
      /** The cheer, size 0 to 1: higher is bigger. */
      cheer: 0.2,
      /** The wind, speed 0 to 1: higher is louder. */
      wind: 0,
    },
    miss: {
      /** The kick (a miss over the bar; dragged wide: `lowMiss`), power 0 to 1. */
      kick: 0.8,
      /** No cheer (the crowd groans), size 0 to 1. */
      cheer: 0,
      /** The wind, speed 0 to 1: higher is louder. */
      wind: 0.55,
    },
    timeup: {
      /** No kick: time ran out, power 0 to 1. */
      kick: 0,
      /** No cheer, size 0 to 1. */
      cheer: 0,
      /** No wind, speed 0 to 1. */
      wind: 0,
    },
    skipped: {
      /** A soft tap away, power 0 to 1: higher is louder. */
      kick: 0.15,
      /** No cheer, size 0 to 1. */
      cheer: 0,
      /** No wind, speed 0 to 1. */
      wind: 0,
    },
  } satisfies Record<Grade, ShotMix>,
  /** A miss dragged wide along the ground, power 0 to 1: higher is louder. */
  lowMiss: 0.6,
  /** The worldie's build-up: hooked out to a team-mate, power 0 to 1: higher is louder. */
  hook: 0.2,
  /** ...and his cross back, power 0 to 1: higher is louder. */
  cross: 0.35,
  /** A skipped question: the ball knocked back, power 0 to 1: higher is louder. */
  knockBack: 0.15,
  /** Full time: the crowd's cheer, size 0 to 1: higher is bigger. */
  fullTimeCheer: 0.5,
  /** Full time as World Cup winners, size 0 to 1: higher is bigger. */
  winnersCheer: 0.9,
};

// ---------------------------------------------------------------------------------------------
// The juggling
// ---------------------------------------------------------------------------------------------

/** The player juggling the ball while you type (career.ts), on every other touch. */
export const JUGGLE = {
  /** Each touch, a share of SOUNDS.touch, 0 to 1: higher is louder (very quiet now). */
  touch: 0.15,
};

// ---------------------------------------------------------------------------------------------
// How many at once, and how soon again
// ---------------------------------------------------------------------------------------------

/**
 * Busy sounds kept in check: a cue over `atOnce` of its kind playing, or `gap` seconds or
 * less after the last one, is dropped. Kinds not listed have no limit. A player's result
 * (the sting, the net, the crowd's cheer, groan or ooh, the whistle, the horns: engine.ts,
 * `RESULT_KINDS`) is never dropped for too many at once: the oldest of its kind fades out
 * over `resultFade` to make room, and the new one plays.
 */
export const LIMITS = {
  /** Never more voices than this at once, all kinds: the oldest goes. */
  voices: 32,
  /** Seconds a result's oldest sound takes to fade out to make room: shorter cuts sooner. */
  resultFade: 0.3,
  atOnce: {
    /** Clicks at once: more lets more overlap (louder in a burst). */
    click: 4,
    /** Irises at once (two: the game's opening over the home page's closing). */
    transition: 2,
    /** Stings at once. */
    score: 2,
    /** Nets at once. */
    net: 2,
    /** Cheers at once. */
    cheer: 2,
    /** Groans at once. */
    groan: 1,
    /** Oohs at once. */
    ooh: 1,
    /** Whistles at once. */
    whistle: 1,
    /** Squeaks at once. */
    squeak: 3,
    /** Pops at once. */
    pop: 1,
    /** Thuds at once. */
    thud: 3,
    /** Splashes at once. */
    splash: 2,
    /** Fireworks at once. */
    firework: 4,
    /** Horn blasts at once. */
    vuvuzela: 2,
    /** Sweeps at once. */
    sweep: 2,
    /** Sparkles at once. */
    sparkle: 1,
    /** Landings at once. */
    land: 2,
  } as Partial<Record<SoundCue["kind"], number>>,
  gap: {
    /** Seconds before another click: longer drops more. */
    click: 0.03,
    /** Seconds before another iris. */
    transition: 0.3,
    /** Seconds before another sting. */
    score: 0.2,
    /** Seconds before another net. */
    net: 0.2,
    /** Seconds before another touch. */
    touch: 0.06,
    /** Seconds before another kick. */
    kick: 0.04,
    /** Seconds before another squeak. */
    squeak: 0.08,
    /** Seconds before another cheer. */
    cheer: 0.3,
    /** Seconds before another firework. */
    firework: 0.12,
    /** Seconds before another horn blast. */
    vuvuzela: 1,
    /** Seconds before another sparkle. */
    sparkle: 0.3,
    /** Seconds before another landing. */
    land: 0.08,
  } as Partial<Record<SoundCue["kind"], number>>,
};
