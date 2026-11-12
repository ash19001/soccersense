// The sound board at /dev/sound: every sound in the game, by group, with a button to play
// each through the real engine (so it sounds exactly as in the game), where it comes from
// (its file in public/sounds, or synthesised) and its levels as app/audio/mix.ts sets them.
// A slider beside each level tries another value at once, in memory only; "copy changes"
// gives the lines to paste into mix.ts to keep them. docs/AUDIO.md, "Changing the volumes".
//
// A development aid, not a page players are sent to. Its text is not game copy.

import { type ReactNode, useEffect, useRef, useState } from "react";

import { PLACES, type Place, TIER_PLACES, soundEngine } from "~/audio";
import type { SoundEngine } from "~/audio/engine";
import {
  type Knob,
  changedKnobs,
  changesText,
  formatValue,
  knob,
  resetKnobs,
  setKnob,
  sourceLines,
} from "~/audio/knobs";
import {
  BEDS,
  BED_EVENTS,
  BUSES,
  CLAPS,
  CROWD,
  FIREWORKS,
  GAME,
  HOME_PAGE,
  JUGGLE,
  LIMITS,
  NET,
  SOUNDS,
  STINGS,
  VUVUZELA,
} from "~/audio/mix";
import source from "~/audio/mix.ts?raw";
import { builtRecordings } from "~/audio/recordings";
import type { Grade } from "~/game/types";
import type { ScoreShot, SoundCue } from "~/scenes/scene";
import { Button, Panel, PixelRoot, SoundToggle } from "~/ui";
import type { Route } from "./+types/dev-sound";

export const meta: Route.MetaFunction = () => [
  { title: "Sound board · soccersense" },
  { name: "robots", content: "noindex" },
];

// --- what is on the board ------------------------------------------------------------------

/** One button: what it is called and what it does, run in its click handler. */
interface Play {
  label: string;
  run: (engine: SoundEngine) => void;
}

interface Row {
  id: string;
  name: string;
  /** Recordings that may play for it (names in public/sounds, without the extension). */
  files?: readonly string[];
  /** Said under the name. */
  note?: string;
  plays: Play[];
  /** Its levels in mix.ts, by path. */
  knobs: string[];
}

interface Section {
  id: string;
  title: string;
  about: string;
  rows: Row[];
}

/** Every recording of this build, by name. */
const FILES = builtRecordings();

const PLACE_NAME: Record<Place, string> = {
  town: "the home page's town",
  park: "tier 0: the park",
  sunday: "tier 1: Sunday league",
  nonleague: "tier 2: non-league",
  lower: "tier 3: the lower leagues",
  top: "tier 4: the top flight",
  international: "tier 5: internationals",
  final: "tier 6: the World Cup final",
  winners: "tier 7: the winners",
};

const SHOT_NAME: Record<Grade, string> = {
  worldie: "worldie",
  golazo: "golazo",
  trivela: "trivela",
  toepoke: "toe poke",
  tapin: "tap in",
  miss: "miss",
  timeup: "time up",
  skipped: "passed",
};

/** The beds' events, as the board names them. */
const EVENT_NAME: Record<keyof typeof BED_EVENTS, string> = {
  bird: "a bird",
  cricket: "crickets",
  car: "a car going by",
  dog: "a dog",
  children: "children playing",
  owl: "an owl",
  shout: "a shout from the touchline",
  mate: "a mate calling",
  parent: "a parent or a sub",
  coach: "the coach",
  claps: "a few people clapping",
  whistle: "the referee, far off",
  kick: "a ball kicked, far off",
  swell: "the roar swelling",
  chant: "a stand singing",
  terrace: "a terrace singing",
  celebrate: "the winners singing",
  drum: "a drum",
  whistles: "fans whistling",
  firework: "a far firework",
};

const SHOTS = Object.keys(STINGS) as ScoreShot[];
const GRADES = Object.keys(GAME.shots) as Grade[];

/** Plays `cue` as the game would, heard at `place` (default: a top-flight stadium). */
const cue = (
  label: string,
  make: () => SoundCue,
  place: Place = "top",
): Play => ({
  label,
  run: (engine) => engine.audition(make(), { place }),
});

/** Plays `cue` with one recording (`touch-2`), or none (`false`: synthesised). */
const take = (
  label: string,
  make: () => SoundCue,
  recording: string | false,
  place: Place = "top",
): Play => ({
  label,
  run: (engine) => engine.audition(make(), { place, recording }),
});

/** Plays several cues, each `at` seconds after the press. */
const moment = (
  label: string,
  parts: readonly [at: number, make: () => SoundCue, place?: Place][],
): Play => ({
  label,
  run: (engine) => {
    for (const [at, make, place = "top"] of parts) {
      later(at, () => engine.audition(make(), { place }));
    }
  },
});

/** The wind, as a scene sends it: every frame, from `from` to `to` over `seconds`. */
const blow = (
  label: string,
  from: () => number,
  to: () => number,
  seconds: number,
): Play => ({
  label,
  run: (engine) => {
    const a = from();
    const b = to();
    for (let i = 0; i <= seconds * 60; i++) {
      const u = i / (seconds * 60);
      later(i / 60, () =>
        engine.play({ kind: "wind", speed: a + (b - a) * u }),
      );
    }
  },
});

/** Timers the board has started, so leaving the page stops them. */
const timers = new Set<ReturnType<typeof setTimeout>>();

function later(seconds: number, run: () => void): void {
  if (seconds <= 0) {
    run();
    return;
  }
  const id = setTimeout(() => {
    timers.delete(id);
    run();
  }, seconds * 1000);
  timers.add(id);
}

const has = (name: string): boolean => FILES.has(name);

/** A synthesised-voice button for a sound that has a recording. */
function synth(make: () => SoundCue, names: readonly string[]): Play[] {
  return names.some(has) ? [take("SYNTH", make, false)] : [];
}

const soundKnobs = (kind: keyof typeof SOUNDS): string[] =>
  Object.entries(SOUNDS[kind])
    .filter(([, v]) => typeof v === "number")
    .map(([k]) => `SOUNDS.${kind}.${k}`);

const keysOf = (group: string, node: object): string[] =>
  Object.entries(node)
    .filter(([, v]) => typeof v === "number")
    .map(([k]) => `${group}.${k}`);

function oneShot(
  kind: keyof typeof SOUNDS,
  plays: Play[],
  names: readonly string[] = [kind],
): Row {
  const make = (): SoundCue => {
    switch (kind) {
      case "kick":
        return { kind, power: 1 };
      case "land":
        return { kind, power: 1 };
      case "transition":
        return { kind, opening: false };
      default:
        return { kind } as SoundCue;
    }
  };
  return {
    id: kind,
    name: kind,
    files: names,
    note: SOUNDS[kind].synth,
    plays: [...plays, ...synth(make, names)],
    knobs: soundKnobs(kind),
  };
}

const bedOf = (place: Place, night: boolean) => {
  const tier = TIER_PLACES.indexOf(place);
  return {
    venue: place === "town" ? ("town" as const) : ("stadium" as const),
    tier: tier >= 0 ? tier : undefined,
    crowd: BEDS.places[place].crowd,
    night,
  };
};

const startBed = (label: string, place: Place, night: boolean): Play => ({
  label,
  run: (engine) => engine.setAmbience(bedOf(place, night)),
});

const STOP_BED: Play = {
  label: "STOP",
  run: (engine) => engine.setAmbience(null),
};

const SECTIONS: Section[] = [
  {
    id: "buses",
    title: "The master and the buses",
    about:
      "Everything goes through these: the one-shots through effects, the beds through ambience, a share of the crowd and the bangs through the room, then the master and the safety.",
    rows: [
      {
        id: "buses",
        name: "everything",
        plays: [
          moment("A GOAL", [
            [0, () => ({ kind: "kick", power: 1 })],
            [0.4, () => ({ kind: "score", shot: "worldie" })],
            [0.4, () => ({ kind: "cheer", size: 1 })],
          ]),
          startBed("STADIUM BED", "top", false),
          STOP_BED,
        ],
        knobs: keysOf("BUSES", BUSES),
      },
    ],
  },
  {
    id: "sounds",
    title: "Each sound",
    about:
      "Each sound by its cue: level is the synthesised voice's gain, peakDb the peak its recording is brought to. Heard in a top-flight stadium. The crowd, the fireworks, the horns and the stings have their own groups below.",
    rows: [
      oneShot(
        "touch",
        [
          cue("PLAY", () => ({ kind: "touch" })),
          ...["touch-1", "touch-2", "touch-3"]
            .filter(has)
            .map((name) =>
              take(name.toUpperCase(), () => ({ kind: "touch" }), name),
            ),
        ],
        ["touch-1", "touch-2", "touch-3"],
      ),
      oneShot("kick", [
        cue("SOFT", () => ({ kind: "kick", power: 0.3 })),
        cue("HARD", () => ({ kind: "kick", power: 1 })),
      ]),
      oneShot("net", [cue("PLAY", () => ({ kind: "net" }))]),
      oneShot("wind", [
        blow(
          "BREEZE",
          () => 0.4,
          () => 0.4,
          1.5,
        ),
        blow(
          "GALE",
          () => 1,
          () => 1,
          1.5,
        ),
      ]),
      oneShot("whistle", [
        cue("PLAY", () => ({ kind: "whistle" })),
        cue("FULL TIME", () => ({ kind: "whistle", long: true })),
      ]),
      oneShot("squeak", [cue("PLAY", () => ({ kind: "squeak" }), "town")]),
      oneShot("pop", [cue("PLAY", () => ({ kind: "pop" }), "town")]),
      oneShot("thud", [cue("PLAY", () => ({ kind: "thud" }), "town")]),
      oneShot("splash", [cue("PLAY", () => ({ kind: "splash" }), "town")]),
      oneShot("sweep", [cue("PLAY", () => ({ kind: "sweep" }))]),
      oneShot("click", [cue("PLAY", () => ({ kind: "click" }))]),
      oneShot(
        "transition",
        [
          cue("CLOSE", () => ({ kind: "transition", opening: false })),
          cue("OPEN", () => ({ kind: "transition", opening: true })),
        ],
        ["transition-close", "transition-open", "transition"],
      ),
      oneShot("sparkle", [cue("PLAY", () => ({ kind: "sparkle" }), "town")]),
      oneShot("land", [
        cue("LAND", () => ({ kind: "land", power: 1 }), "town"),
        cue("SOFTEST", () => ({ kind: "land", power: 0 }), "town"),
      ]),
    ],
  },
  {
    id: "crowd",
    title: "The crowd, by place",
    about:
      "The cheer, the groan and the ooh at each place: a few mates in the park up to a whole stadium at the final, and on the home page a stadium heard across town.",
    rows: [
      {
        id: "crowd-all",
        name: "every place",
        note: "the crowd's voices: synthesised (a recording would be cheer.mp3, or cheer-park.mp3 for one place)",
        plays: [],
        knobs: [
          ...soundKnobs("cheer"),
          ...soundKnobs("groan"),
          ...soundKnobs("ooh"),
          "CROWD.acrossTown",
        ],
      },
      ...PLACES.map((place): Row => ({
        id: `crowd-${place}`,
        name: PLACE_NAME[place],
        files: [`cheer-${place}`, `groan-${place}`, `ooh-${place}`],
        plays: [
          cue("CHEER", () => ({ kind: "cheer", size: 1 }), place),
          cue("SMALL", () => ({ kind: "cheer", size: 0.2 }), place),
          cue("GROAN", () => ({ kind: "groan" }), place),
          cue("OOH", () => ({ kind: "ooh" }), place),
        ],
        knobs: keysOf(`CROWD.places.${place}`, CROWD.places[place]),
      })),
    ],
  },
  {
    id: "beds",
    title: "The background beds, by place and career tier",
    about:
      "Each place's bed, as the game plays it with its crowd value: START plays it until STOP (another place crossfades). A change to one of its levels starts it again with the change.",
    rows: [
      {
        id: "beds-all",
        name: "every bed",
        plays: [STOP_BED],
        knobs: ["BEDS.nightDb", "BEDS.recordedQuietest"],
      },
      ...PLACES.map((place): Row => ({
        id: `bed-${place}`,
        name: PLACE_NAME[place],
        files: [`ambience-${place}`, `ambience-${place}-night`],
        plays: [
          startBed("DAY", place, false),
          startBed("NIGHT", place, true),
          STOP_BED,
        ],
        knobs: keysOf(`BEDS.places.${place}`, BEDS.places[place]),
      })),
    ],
  },
  {
    id: "events",
    title: "The beds' events",
    about:
      "What happens now and then in the beds, one at a time through the ambience bus (at a crowd of 1). Where there are two levels, each time picks one between them.",
    rows: (Object.keys(BED_EVENTS) as (keyof typeof BED_EVENTS)[]).map(
      (name): Row => {
        const value = BED_EVENTS[name];
        return {
          id: `event-${name}`,
          name: EVENT_NAME[name],
          // A swell lifts a bed's roar: it is heard only in a bed (the top flight and up).
          note:
            name === "swell"
              ? "the roar lifting: heard in a bed, the top flight and up"
              : undefined,
          plays:
            name === "swell"
              ? [startBed("TOP FLIGHT BED", "top", false), STOP_BED]
              : [
                  {
                    label: "PLAY",
                    run: (engine) => engine.auditionEvent(name),
                  },
                ],
          knobs:
            typeof value === "number"
              ? [`BED_EVENTS.${name}`]
              : keysOf(`BED_EVENTS.${name}`, value),
        };
      },
    ),
  },
  {
    id: "stings",
    title: "The result stings, by shot",
    about:
      "Each result's sting, with the net under it for a goal (as hard as NET says). gain is the synthesised sting against the others, peakDb a recording's peak (score-<shot>.mp3).",
    rows: [
      {
        id: "stings-all",
        name: "every sting",
        plays: [],
        knobs: soundKnobs("score"),
      },
      ...SHOTS.map((shot): Row => ({
        id: `sting-${shot}`,
        name: SHOT_NAME[shot],
        files: [`score-${shot}`],
        plays: [
          cue("PLAY", () => ({ kind: "score", shot })),
          cue("IN THE PARK", () => ({ kind: "score", shot }), "park"),
        ],
        knobs: [
          ...keysOf(`STINGS.${shot}`, STINGS[shot]),
          ...(NET[shot] === undefined ? [] : [`NET.${shot}`]),
        ],
      })),
    ],
  },
  {
    id: "fireworks",
    title: "Fireworks, near and far",
    about:
      "A near firework (the career's over the stand at tiers 4 and up are sent far), and a far one: the home page's and the career's. The winners' bed has its own far fireworks (the beds' events).",
    rows: [
      {
        id: "firework-near",
        name: "near",
        files: ["firework"],
        note: SOUNDS.firework.synth,
        plays: [
          cue("PLAY", () => ({ kind: "firework" })),
          take("SYNTH", () => ({ kind: "firework" }), false),
        ],
        knobs: soundKnobs("firework"),
      },
      {
        id: "firework-far",
        name: "far",
        files: ["firework-far"],
        note: "a faint hiss up, a muffled pop and a little crackle",
        plays: [
          cue("PLAY", () => ({ kind: "firework", distant: true })),
          cue("HOME PAGE", () => ({ kind: "firework" }), "town"),
          take("SYNTH", () => ({ kind: "firework", distant: true }), false),
        ],
        knobs: keysOf("FIREWORKS", FIREWORKS),
      },
    ],
  },
  {
    id: "vuvuzela",
    title: "The vuvuzela",
    about:
      "The World Cup's horns, at tiers 6 and 7 only (anywhere else a blast is dropped as calm): a goal's blast, as big as its cheer, and the beds' steady hum.",
    rows: [
      {
        id: "vuvuzela-blast",
        name: "a goal's blast",
        files: ["vuvuzela"],
        note: SOUNDS.vuvuzela.synth,
        plays: [
          cue("WORLDIE", () => ({ kind: "vuvuzela", size: 1 }), "final"),
          cue(
            "TAP IN",
            () => ({ kind: "vuvuzela", size: GAME.shots.tapin.cheer }),
            "final",
          ),
          take("SYNTH", () => ({ kind: "vuvuzela", size: 1 }), false, "final"),
        ],
        knobs: [...soundKnobs("vuvuzela"), "VUVUZELA.smallest"],
      },
      {
        id: "vuvuzela-hum",
        name: "the hum",
        files: ["vuvuzela-crowd"],
        note: "a stadium of horns under the bed (synthesised until the recording loads)",
        plays: [
          startBed("FINAL", "final", true),
          startBed("WINNERS", "winners", true),
          STOP_BED,
        ],
        knobs: [
          "VUVUZELA.humTakeRmsDb",
          ...keysOf("VUVUZELA.hum", VUVUZELA.hum),
        ],
      },
    ],
  },
  {
    id: "claps",
    title: "The claps",
    about:
      "Every clap in the game is claps.mp3 in layers, by the crowd: here alone, at a cheer's level, for a few mates up to a whole stand.",
    rows: [
      { layers: 1, name: "a few mates" },
      { layers: 3, name: "a touchline" },
      { layers: 6, name: "a ground" },
      { layers: 9, name: "a stand" },
    ].map(({ layers, name }, i): Row => ({
      id: `claps-${layers}`,
      name: `${name} (${layers} layer${layers === 1 ? "" : "s"})`,
      files: ["claps"],
      plays: [
        {
          label: "PLAY",
          run: (engine) => engine.auditionClaps(layers * CLAPS.perLayer),
        },
      ],
      knobs: i === 0 ? keysOf("CLAPS", CLAPS) : [],
    })),
  },
  {
    id: "home",
    title: "The home page",
    about:
      "What the home page's ball and picture send: the press, the kick-off, HOME's landing, the wind of the flight, the match far off and the mascot's tricks. Heard over the town.",
    rows: [
      {
        id: "home-press",
        name: "a press on the ball",
        plays: [
          cue("PLAY", () => ({ kind: "kick", power: HOME_PAGE.press }), "town"),
        ],
        knobs: ["HOME_PAGE.press"],
      },
      {
        id: "home-strike",
        name: "the kick-off",
        plays: [
          cue(
            "PLAY",
            () => ({ kind: "kick", power: HOME_PAGE.strike }),
            "town",
          ),
        ],
        knobs: ["HOME_PAGE.strike"],
      },
      {
        id: "home-land",
        name: "HOME's landing and its bounce",
        plays: [
          moment("PLAY", [
            [0, () => ({ kind: "land", power: HOME_PAGE.land }), "town"],
            [0.2, () => ({ kind: "land", power: HOME_PAGE.hop }), "town"],
          ]),
        ],
        knobs: ["HOME_PAGE.land", "HOME_PAGE.hop"],
      },
      {
        id: "home-wind",
        name: "the wind of the flight",
        plays: [
          blow(
            "HOME",
            () => HOME_PAGE.strikeWind,
            () => HOME_PAGE.strikeWind * HOME_PAGE.homeWindEnd,
            0.9,
          ),
          blow(
            "AWAY",
            () => HOME_PAGE.strikeWind,
            () => HOME_PAGE.strikeWind * HOME_PAGE.awayWindEnd,
            0.9,
          ),
        ],
        knobs: [
          "HOME_PAGE.strikeWind",
          "HOME_PAGE.homeWindEnd",
          "HOME_PAGE.awayWindEnd",
        ],
      },
      {
        id: "home-match",
        name: "the match far off: a goal",
        plays: [
          moment("PLAY", [
            [
              0,
              () => ({ kind: "cheer", size: HOME_PAGE.pictureCheer }),
              "town",
            ],
            [0.6, () => ({ kind: "firework", distant: true }), "town"],
            [1.1, () => ({ kind: "firework", distant: true }), "town"],
          ]),
        ],
        knobs: ["HOME_PAGE.pictureCheer"],
      },
      {
        id: "home-mascot",
        name: "the mascot's tricks: a touch, the flick, the swing and his bump",
        plays: [
          cue(
            "TOUCH",
            () => ({ kind: "touch", level: HOME_PAGE.mascotTouch }),
            "town",
          ),
          cue(
            "FLICK",
            () => ({ kind: "kick", power: HOME_PAGE.mascotFlick }),
            "town",
          ),
          moment("SWING", [
            [0, () => ({ kind: "kick", power: HOME_PAGE.mascotSwing }), "town"],
            [0.6, () => ({ kind: "thud" }), "town"],
          ]),
        ],
        knobs: [
          "HOME_PAGE.mascotTouch",
          "HOME_PAGE.mascotFlick",
          "HOME_PAGE.mascotSwing",
        ],
      },
    ],
  },
  {
    id: "game",
    title: "The game, shot by shot",
    about:
      "What the career scene sends for each shot: the strike's kick, the cheer as it goes in and the wind of the flight. Heard in a top-flight stadium.",
    rows: [
      ...GRADES.map((grade): Row => {
        const shot = () => GAME.shots[grade];
        const sting: [number, () => SoundCue][] = SHOTS.includes(
          grade as ScoreShot,
        )
          ? [[0.45, () => ({ kind: "score", shot: grade as ScoreShot })]]
          : [];
        return {
          id: `shot-${grade}`,
          name: SHOT_NAME[grade],
          plays: [
            cue("KICK", () => ({ kind: "kick", power: shot().kick })),
            cue("CHEER", () => ({ kind: "cheer", size: shot().cheer })),
            blow(
              "WIND",
              () => shot().wind,
              () => shot().wind * 0.65,
              0.45,
            ),
            moment("ALL", [
              [0, () => ({ kind: "kick", power: shot().kick })],
              ...sting,
              [0.45, () => ({ kind: "cheer", size: shot().cheer })],
            ]),
          ],
          knobs: keysOf(`GAME.shots.${grade}`, GAME.shots[grade]),
        };
      }),
      {
        id: "shot-rest",
        name: "the rest",
        plays: [
          cue("LOW MISS", () => ({ kind: "kick", power: GAME.lowMiss })),
          cue("HOOK", () => ({ kind: "kick", power: GAME.hook })),
          cue("CROSS", () => ({ kind: "kick", power: GAME.cross })),
          cue("KNOCK BACK", () => ({ kind: "kick", power: GAME.knockBack })),
          moment("FULL TIME", [
            [0, () => ({ kind: "whistle", long: true })],
            [0.8, () => ({ kind: "cheer", size: GAME.fullTimeCheer })],
          ]),
          cue(
            "WINNERS",
            () => ({ kind: "cheer", size: GAME.winnersCheer }),
            "winners",
          ),
        ],
        knobs: keysOf("GAME", GAME),
      },
    ],
  },
  {
    id: "juggle",
    title: "The juggling",
    about:
      "The player juggles while you type, a very quiet touch on every other one (1.75 a second).",
    rows: [
      {
        id: "juggle",
        name: "juggling",
        files: ["touch-1", "touch-2", "touch-3"],
        plays: [
          moment(
            "PLAY",
            [0, 1, 2, 3, 4, 5].map(
              (i) =>
                [
                  i / 1.75,
                  () => ({ kind: "touch", level: JUGGLE.touch }) as SoundCue,
                ] as const,
            ),
          ),
        ],
        knobs: keysOf("JUGGLE", JUGGLE),
      },
    ],
  },
  {
    id: "limits",
    title: "How many at once, and how soon again",
    about:
      "Busy sounds kept in check: a cue over its number at once, or sooner than its gap after the last one, is dropped. A result's sound (sting, net, cheer, groan, ooh, whistle, horn) is never dropped for too many at once: the oldest of its kind fades out to make room.",
    rows: [
      {
        id: "limits-voices",
        name: "all sounds",
        plays: [],
        knobs: ["LIMITS.voices"],
      },
      {
        id: "limits-result-fade",
        name: "a result making room (seconds)",
        plays: [],
        knobs: ["LIMITS.resultFade"],
      },
      {
        id: "limits-at-once",
        name: "at once",
        plays: [],
        knobs: keysOf("LIMITS.atOnce", LIMITS.atOnce),
      },
      {
        id: "limits-gap",
        name: "how soon again (seconds)",
        plays: [],
        knobs: keysOf("LIMITS.gap", LIMITS.gap),
      },
    ],
  },
];

/** Every knob's comment and line in mix.ts. */
const LINES = sourceLines(source);

// --- the page ---------------------------------------------------------------------------------

/** The engine's state, for the strip at the top. */
interface Status {
  state: string;
  muted: boolean;
  bed: string | null;
  recordings: string;
  log: string[];
}

function readStatus(engine: SoundEngine): Status {
  const d = engine.debug();
  return {
    state: d.state,
    muted: d.muted,
    bed: d.ambience,
    recordings: `${d.recordings.loaded} of ${d.recordings.found.length} recordings loaded${d.recordings.failed ? `, ${d.recordings.failed} failed` : ""}`,
    log: d.log
      .slice(-6)
      .reverse()
      .map(
        (e) =>
          `${e.at ?? "-"}  ${e.kind}  ${e.result}${e.gain === undefined ? "" : `  gain ${e.gain}`}`,
      ),
  };
}

/** Where a row's sound comes from: its files in public/sounds, or synthesised. */
function sourceOf(row: Row): ReactNode {
  const found = (row.files ?? [])
    .map((name) => FILES.get(name))
    .filter((url): url is string => url !== undefined)
    .map((url) => url.slice(url.lastIndexOf("/") + 1));
  if (found.length === 0) {
    return row.files ? (
      <span className="dev-sound__synth">synthesised</span>
    ) : null;
  }
  return <span className="dev-sound__file">{found.join(", ")}</span>;
}

function KnobControl({
  path,
  onChange,
}: {
  path: string;
  onChange: (path: string, value: number) => void;
}) {
  const k = knob(path) as Knob;
  const doc = LINES.get(path)?.doc ?? "";
  const id = `knob-${path.replace(/\W/g, "-")}`;
  const changed = k.value !== k.initial;
  return (
    <div
      className="dev-sound__knob"
      data-path={path}
      data-changed={changed || undefined}
    >
      <label htmlFor={id} className="dev-sound__knob-name">
        {path.split(".").slice(1).join(".")}
      </label>
      <input
        id={id}
        type="range"
        className="dev-sound__slider"
        min={k.min}
        max={k.max}
        step={k.step}
        value={k.value}
        onChange={(event) => onChange(path, Number(event.currentTarget.value))}
      />
      <output htmlFor={id} className="dev-sound__value">
        {formatValue(k.value, k.step)}{" "}
        {k.unit === "share" || k.unit === "gain" ? "" : k.unit}
        {changed && (
          <span className="dev-sound__was">
            {" "}
            was {formatValue(k.initial, k.step)}
          </span>
        )}
      </output>
      {doc && <p className="dev-sound__doc">{doc}</p>}
    </div>
  );
}

export default function DevSound() {
  const [, setVersion] = useState(0);
  const [status, setStatus] = useState<Status | null>(null);
  const [copied, setCopied] = useState<"" | "copied" | "failed">("");
  const pending = useRef<{
    what: string;
    timer: ReturnType<typeof setTimeout> | null;
  }>({
    what: "",
    timer: null,
  });

  // The engine, once the page is in the browser (never during render: the page is
  // prerendered). Its context is made on the first press, as in the game.
  useEffect(() => {
    const engine = soundEngine();
    if (!engine) return;
    const warm = () => engine.warmAll();
    window.addEventListener("pointerup", warm);
    window.addEventListener("keyup", warm);
    const poll = setInterval(() => setStatus(readStatus(engine)), 400);
    const waiting = pending.current;
    return () => {
      window.removeEventListener("pointerup", warm);
      window.removeEventListener("keyup", warm);
      clearInterval(poll);
      if (waiting.timer !== null) clearTimeout(waiting.timer);
      for (const id of timers) clearTimeout(id);
      timers.clear();
      engine.setAmbience(null);
    };
  }, []);

  const play = (p: Play) => {
    const engine = soundEngine();
    if (engine) p.run(engine);
  };

  const change = (path: string, value: number) => {
    if (!setKnob(path, value)) return;
    setCopied("");
    setVersion((v) => v + 1);
    // Heard at once (every sound reads mix.ts as it starts); the buses and the bed take it
    // a moment after the slider stops, and the log notes it.
    const wait = pending.current;
    wait.what = `mix ${path} = ${value}`;
    if (wait.timer !== null) clearTimeout(wait.timer);
    wait.timer = setTimeout(() => {
      wait.timer = null;
      soundEngine()?.applyMix(wait.what);
    }, 250);
  };

  const reset = () => {
    resetKnobs();
    setCopied("");
    setVersion((v) => v + 1);
    soundEngine()?.applyMix("mix reset to mix.ts");
  };

  const changed = changedKnobs();
  const text = changesText(source, changed);

  const copy = () => {
    if (!navigator.clipboard) {
      setCopied("failed");
      return;
    }
    navigator.clipboard.writeText(text).then(
      () => setCopied("copied"),
      () => setCopied("failed"),
    );
  };

  return (
    <PixelRoot className="dev-sound">
      <header className="dev-sound__head">
        <div className="dev-sound__title">
          <h1 className="ss-t20">Sound board</h1>
          <SoundToggle
            labels={{ label: "Sound", on: "Sound on", off: "Sound off" }}
          />
        </div>
        <p>
          Every sound in the game. Play it as the game does; slide a level to
          hear another at once (in memory only); copy the changes and paste them
          into <code>app/audio/mix.ts</code> to keep them. The dev server
          reloads on save.
        </p>
        <p>
          The game&apos;s limits hold here too: a sound pressed while too many
          of its kind still ring, or too soon after the last, is logged{" "}
          <code>dropped:busy</code>. STOP ALL and press it again.
        </p>
        <nav className="dev-sound__nav" aria-label="Groups">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`}>
              {s.title}
            </a>
          ))}
        </nav>
        <Panel className="dev-sound__status" variant="plain">
          <p>
            {status === null
              ? "Starting."
              : status.state === "none"
                ? "Press any PLAY to wake the sound."
                : `Sound: ${status.muted ? "OFF (the speaker above)" : status.state}. ${status.recordings}. Bed: ${status.bed ?? "none"}.`}
          </p>
          <pre
            className="dev-sound__log"
            aria-label="The engine's log, newest first"
          >
            {status?.log.join("\n") || " "}
          </pre>
        </Panel>
        <div className="dev-sound__actions">
          <Button
            variant="primary"
            onClick={copy}
            disabled={changed.length === 0}
          >
            {`COPY CHANGES (${changed.length})`}
          </Button>
          <Button onClick={reset} disabled={changed.length === 0}>
            RESET
          </Button>
          <Button
            variant="ghost"
            data-no-click=""
            onClick={() => {
              for (const id of timers) clearTimeout(id);
              timers.clear();
              soundEngine()?.stopAll();
            }}
          >
            STOP ALL
          </Button>
          {copied && (
            <span className="dev-sound__copied" role="status">
              {copied === "copied"
                ? "Copied: paste into app/audio/mix.ts."
                : "Could not copy: select the lines below."}
            </span>
          )}
        </div>
        {text && <pre className="dev-sound__changes">{text}</pre>}
      </header>

      <div className="dev-sound__groups">
        {SECTIONS.map((section) => (
          <Panel
            as="section"
            key={section.id}
            id={section.id}
            className="dev-sound__group"
          >
            <h2 className="ss-t15 dev-sound__group-title">{section.title}</h2>
            <p className="dev-sound__about">{section.about}</p>
            {section.rows.map((row) => (
              <div key={row.id} className="dev-sound__row">
                <div className="dev-sound__row-head">
                  <h3 className="dev-sound__name">{row.name}</h3>
                  {sourceOf(row)}
                </div>
                {row.note && <p className="dev-sound__note">{row.note}</p>}
                {row.plays.length > 0 && (
                  <div className="dev-sound__plays" data-no-click="">
                    {row.plays.map((p) => (
                      <Button key={p.label} onClick={() => play(p)}>
                        {p.label}
                      </Button>
                    ))}
                  </div>
                )}
                {row.knobs.map((path) => (
                  <KnobControl key={path} path={path} onChange={change} />
                ))}
              </div>
            ))}
          </Panel>
        ))}
      </div>
    </PixelRoot>
  );
}
