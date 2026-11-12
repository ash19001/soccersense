#!/usr/bin/env node
// Makes the game's recorded sounds (public/sounds/*.mp3) from the original recordings in
// sounds-src/, with ffmpeg. Every cut, filter and fade is written down here, so the edits can
// be redone and tuned: change a number, run it again, listen.
//
//   node tools/sounds.mjs            make every file
//   node tools/sounds.mjs kick net   make only these
//   node tools/sounds.mjs --check    make nothing; measure the files that are there
//
// Needs ffmpeg on the PATH (with libmp3lame). Nothing is written but the outputs: each cut is
// decoded into memory, measured, levelled and encoded straight into public/sounds.
//
// Every output is: cut from the source (start and end in seconds, sample-accurate), mono at
// 44.1 kHz, low rumble taken out (a high-pass), a 1 ms fade in (no click where the cut is),
// a fade at the end, brought to a peak of `peak` dBFS and encoded as mp3 at 160 kbps. The
// start is the first sample of the sound: any silence there would be a delay in the game.
// Levels in the game are set by the engine, whatever the file's (docs/AUDIO.md).
//
// Two kinds of file are not one cut but are built from several, for sounds that last:
// - a loop (`loop`): pieces of the source, filtered, joined end to start with short
//   equal-power crossfades, the last into the first, so it goes round without a seam;
// - a swarm (`swarm`): many copies of a few short pieces (the toots of one horn), each a
//   little higher or lower, louder or softer, laid at seeded random places round a loop of
//   `length` seconds (a copy that runs off the end carries on at the start, so this loops
//   without a seam too): a crowd of them at once. The same seed makes the same file.

import { execFileSync } from "node:child_process";
import { statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "sounds-src");
const OUT = join(ROOT, "public", "sounds");
const RATE = 44100;
const BITRATE = "160k";

/**
 * What each processed file is. `start` and `end` are in seconds in the source; `fadeIn`
 * (seconds, default 0.001) comes straight after the cut, then `filters` (ffmpeg filter
 * syntax: an echo repeats the faded attack), then `fadeOut`, [start, length] in the cut.
 */
const SOUNDS = [
  {
    // The strike alone: the boot meets the ball at 84.5 ms and it is over in about 25 ms;
    // a short tail of the air after it. The rest of the take is wind on the microphone.
    out: "kick",
    src: "kick_ball.mp3",
    start: 0.084,
    end: 0.244,
    filters: ["highpass=f=50:p=2", "highpass=f=50:p=2"],
    fadeOut: [0.04, 0.12],
    peak: -1,
  },
  // Three bounces from the ten in the take, the cleanest and the most alike (a similar
  // attack and ring, the least noise before them), so the juggling has variety without one
  // tap sticking out. Each is the bounce and its ring, up to before the small second bounce.
  {
    out: "touch-1",
    src: "ball_sound.mp3",
    start: 1.9802,
    end: 2.1302,
    filters: ["highpass=f=60:p=2", "highpass=f=60:p=2"],
    fadeOut: [0.05, 0.1],
    peak: -1,
  },
  {
    out: "touch-2",
    src: "ball_sound.mp3",
    start: 9.0609,
    end: 9.2109,
    filters: ["highpass=f=60:p=2", "highpass=f=60:p=2"],
    fadeOut: [0.05, 0.1],
    peak: -1,
  },
  {
    out: "touch-3",
    src: "ball_sound.mp3",
    start: 10.406,
    end: 10.556,
    filters: ["highpass=f=60:p=2", "highpass=f=60:p=2"],
    fadeOut: [0.05, 0.1],
    peak: -1,
  },
  {
    // The click is a 5 ms blip at about 1.5 kHz, 25 ms into the file.
    out: "click",
    src: "button_click.mp3",
    start: 0.0252,
    end: 0.0452,
    filters: ["highpass=f=200:p=2"],
    fadeOut: [0.01, 0.01],
    peak: -1,
  },
  {
    // The bang and the first of its crackle; the long hiss after it is cut short.
    out: "firework",
    src: "firework_pop.mp3",
    start: 0.034,
    end: 0.634,
    filters: ["highpass=f=45:p=2"],
    fadeOut: [0.2, 0.4],
    peak: -1,
  },
  {
    // The same bang far away, for the background: the air takes the top off (a steep
    // low-pass), the attack is softened, and the sky gives back an echo or two. Quieter on
    // its own; in the game the engine sets its level (the firework's, less 19.5 dB).
    out: "firework-far",
    src: "firework_pop.mp3",
    start: 0.034,
    end: 1.034,
    filters: [
      "highpass=f=45:p=2",
      "lowpass=f=900:p=2",
      "lowpass=f=900:p=2",
      "aecho=in_gain=0.9:out_gain=0.8:delays=110|240:decays=0.3|0.15",
    ],
    fadeIn: 0.01,
    fadeOut: [0.3, 0.7],
    peak: -12,
  },
  {
    // From the shot into the net: the take is the kick (0.15 s), the ball into the net
    // (0.3315 s), the mesh rattling as it takes the ball, then the ball dropping and bouncing
    // (0.98 s on). This is the ball hitting the net and the rattle, up to before it drops.
    // The rumble under the whole take goes with a higher high-pass: the net is all mid and
    // treble.
    out: "net",
    src: "football_hits_net.mp3",
    start: 0.331,
    end: 0.831,
    filters: ["highpass=f=110:p=2", "highpass=f=110:p=2"],
    fadeOut: [0.25, 0.25],
    peak: -1,
  },
  {
    // HOME's ball dropping onto the stadium's centre spot. The first bounce of the take (the
    // ball dropped from height): the fullest and heaviest of the ten, the softest attack
    // for its body, and the least noise before it. The bounce and its ring with the small
    // second bounce in it; a gentle low-pass takes a little of the hard floor's slap off,
    // for turf.
    out: "land",
    src: "ball_sound.mp3",
    start: 0.5838,
    end: 0.8338,
    filters: ["highpass=f=45:p=2", "highpass=f=45:p=2", "lowpass=f=3000:p=1"],
    fadeOut: [0.1, 0.15],
    peak: -1,
  },
  {
    // AWAY's last twinkle in the sky. The take is two chimes (59.5 ms and 175 ms in) and a
    // long ringing tail; this is the chimes and the first of the tail, faded so that it is
    // gone soon after the iris's whoosh starts under it. The high-pass keeps it above the
    // whoosh, which falls from 2.6 kHz to 260 Hz: the two sit side by side.
    out: "sparkle",
    src: "star_sparkle.mp3",
    start: 0.0595,
    end: 1.0595,
    filters: ["highpass=f=900:p=2"],
    fadeOut: [0.3, 0.7],
    peak: -1,
  },
  {
    // A vuvuzela blast for a goal at the World Cup. The take is one horn blowing (233 Hz, a
    // B flat) and a room; this is its second, third and fourth toots, the last running on
    // into a softer note, and the room's ring after it. The first toot (0.05 s) is short and
    // bent up; the take's end is the room alone.
    out: "vuvuzela",
    src: "vuvuzela.mp3",
    start: 0.513,
    end: 2.75,
    filters: ["highpass=f=120:p=2", "highpass=f=120:p=2"],
    fadeOut: [1.7, 0.537],
    peak: -1,
  },
  {
    // The World Cup's hum in the bed (tiers 6 and 7): a stadium of horns. The take is one
    // horn, so the hum is a swarm of its four long toots, about 25 at once, each a little
    // sharp or flat (a few a semitone out), far off (a low-pass), in stereo, looped.
    out: "vuvuzela-crowd",
    src: "vuvuzela.mp3",
    swarm: {
      pieces: [
        [0.513, 0.79],
        [0.88, 1.17],
        [1.235, 1.69],
        [1.69, 2.2],
      ],
      length: 8,
      count: 520,
      cents: 45,
      odd: [0.12, 100],
      gain: [0.35, 1],
      edge: 0.05,
      seed: 2010,
    },
    filters: [
      "highpass=f=120:p=2",
      "highpass=f=120:p=2",
      "lowpass=f=1300:p=2",
      "lowpass=f=1300:p=2",
    ],
    channels: 2,
    bitrate: "128k",
    peak: -1,
  },
  {
    // Clapping, for every clap in the game: the beds' claps and the applause in a cheer. The
    // take is a few people clapping in a room, about ten claps a second, for 12 s, with a
    // low rumble under it (taken out). This is its two steadiest stretches looped; the
    // engine layers it (one take for a few mates, nine for a stand), each from its own
    // place and a little faster or slower, so it never sounds like a loop.
    out: "claps",
    src: "clapping.mp3",
    loop: {
      pieces: [
        [0.45, 3.4],
        [5.2, 11.6],
      ],
      crossfade: 0.25,
    },
    filters: ["highpass=f=100:p=2", "highpass=f=100:p=2"],
    bitrate: "128k",
    peak: -1,
  },
];

function ffmpeg(args, input) {
  return execFileSync("ffmpeg", ["-hide_banner", "-v", "error", ...args], {
    input,
    maxBuffer: 1 << 28,
  });
}

function asFloats(bytes) {
  const copy = new Uint8Array(bytes);
  return new Float32Array(copy.buffer, 0, copy.length >> 2);
}

/** A piece of the source, `start` to `end` seconds, through `steps` (ffmpeg filters), mono. */
function cut(src, start, end, steps) {
  const chain = [
    `aresample=${RATE}`,
    "aformat=sample_fmts=flt:channel_layouts=mono",
    `atrim=start=${start}:end=${end}`,
    "asetpts=PTS-STARTPTS",
    ...steps,
    `atrim=end=${end - start}`,
  ];
  return asFloats(
    ffmpeg(["-i", join(SRC, src), "-af", chain.join(","), "-f", "f32le", "-"]),
  );
}

/** The cut, filtered and faded, as mono samples at RATE. */
function render(sound) {
  const [fadeAt, fadeLength] = sound.fadeOut;
  return cut(sound.src, sound.start, sound.end, [
    `afade=t=in:d=${sound.fadeIn ?? 0.001}`,
    ...sound.filters,
    `afade=t=out:st=${fadeAt}:d=${fadeLength}`,
  ]);
}

/**
 * A loop: each piece filtered (before the joins, so the filters leave no seam) and
 * `crossfade` seconds longer than its place in the loop; each piece's extra runs under the
 * start of the next one, the last's under the first's, out and in on an equal-power curve.
 */
function renderLoop(sound) {
  const { pieces, crossfade } = sound.loop;
  const x = Math.round(crossfade * RATE);
  const cuts = pieces.map(([a, b]) =>
    cut(sound.src, a, b + crossfade, sound.filters),
  );
  const total = cuts.reduce((sum, c) => sum + c.length - x, 0);
  const out = new Float32Array(total);
  let at = 0;
  for (const c of cuts) {
    const own = c.length - x;
    for (let i = 0; i < c.length; i++) {
      let k = 1;
      if (i < x) k = Math.sin(((i + 0.5) / x) * (Math.PI / 2));
      else if (i >= own) k = Math.cos(((i - own + 0.5) / x) * (Math.PI / 2));
      out[(at + i) % total] += c[i] * k;
    }
    at += own;
  }
  return [out];
}

/** A seeded random source in [0, 1) (the engine's mulberry32). */
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A swarm: `count` copies a channel of the pieces (filtered first, so the filters leave no
 * seam), each at a random place round `length` seconds, `cents` sharp or flat at most (a
 * share `odd[0]` of them `odd[1]` cents out instead), at a random gain in `gain`, faded in
 * and out over `edge` seconds. A copy past the end goes on at the start.
 */
function renderSwarm(sound) {
  const { pieces, length, count, cents, odd, gain, edge, seed } = sound.swarm;
  const toots = pieces.map(([a, b]) => cut(sound.src, a, b, sound.filters));
  const total = Math.round(length * RATE);
  const rand = seeded(seed);
  const e = Math.round(edge * RATE);
  return Array.from({ length: sound.channels ?? 1 }, () => {
    const out = new Float32Array(total);
    for (let n = 0; n < count; n++) {
      const toot = toots[Math.floor(rand() * toots.length)];
      const off =
        rand() < odd[0]
          ? odd[1] * (rand() < 0.5 ? -1 : 1)
          : (rand() * 2 - 1) * cents;
      const rate = 2 ** (off / 1200);
      const g = gain[0] + (gain[1] - gain[0]) * rand();
      const at = Math.floor(rand() * total);
      const len = Math.floor((toot.length - 1) / rate);
      for (let i = 0; i < len; i++) {
        // Read the toot `rate` times as fast (linear interpolation): higher or lower.
        const p = i * rate;
        const j = Math.floor(p);
        const v = toot[j] + (toot[j + 1] - toot[j]) * (p - j);
        const k = Math.min(1, i / e, (len - i) / e);
        out[(at + i) % total] += v * g * k;
      }
    }
    return out;
  });
}

function peakOf(channels) {
  let peak = 0;
  for (const samples of channels) {
    for (const v of samples) peak = Math.max(peak, Math.abs(v));
  }
  return peak;
}

function make(sound) {
  const channels = sound.loop
    ? renderLoop(sound)
    : sound.swarm
      ? renderSwarm(sound)
      : [render(sound)];
  const gain = 10 ** (sound.peak / 20) / Math.max(peakOf(channels), 1e-9);
  // Interleaved, levelled.
  const n = channels[0].length;
  const levelled = new Float32Array(n * channels.length);
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < channels.length; c++) {
      levelled[i * channels.length + c] = channels[c][i] * gain;
    }
  }
  ffmpeg(
    [
      "-y",
      "-f",
      "f32le",
      "-ar",
      String(RATE),
      "-ac",
      String(channels.length),
      "-i",
      "-",
      "-c:a",
      "libmp3lame",
      "-b:a",
      sound.bitrate ?? BITRATE,
      "-map_metadata",
      "-1",
      "-id3v2_version",
      "0",
      "-write_id3v1",
      "0",
      join(OUT, `${sound.out}.mp3`),
    ],
    Buffer.from(levelled.buffer),
  );
}

const db = (v) => 20 * Math.log10(Math.max(v, 1e-9));

/** Measures a processed file as a browser would decode it. */
function measure(name) {
  const file = join(OUT, `${name}.mp3`);
  const x = asFloats(
    ffmpeg(["-i", file, "-ac", "1", "-ar", String(RATE), "-f", "f32le", "-"]),
  );
  const peak = peakOf([x]);
  // Silence at the start: until the first sample within 40 dB of the peak.
  let lead = 0;
  while (lead < x.length && Math.abs(x[lead]) < peak / 100) lead++;
  // Loud: the loudest 300 ms (RMS; silence past the end counts), as docs/AUDIO.md measures
  // the synthesised voices.
  const w = Math.round(0.3 * RATE);
  let sum = 0;
  let loud = 0;
  for (let i = 0; i < x.length; i++) {
    sum += x[i] * x[i];
    if (i >= w) sum -= x[i - w] * x[i - w];
    loud = Math.max(loud, sum / w);
  }
  return {
    name,
    seconds: +(x.length / RATE).toFixed(3),
    peakDb: +db(peak).toFixed(1),
    loudDb: +db(Math.sqrt(Math.max(loud, 0))).toFixed(1),
    leadMs: +((lead / RATE) * 1000).toFixed(2),
    kb: +(statSync(file).size / 1024).toFixed(1),
  };
}

const args = process.argv.slice(2);
const check = args.includes("--check");
const only = args.filter((a) => !a.startsWith("--"));
const chosen = SOUNDS.filter((s) => only.length === 0 || only.includes(s.out));
if (only.length > 0 && chosen.length !== only.length) {
  const known = SOUNDS.map((s) => s.out).join(", ");
  console.error(`Unknown sound. Known: ${known}`);
  process.exit(1);
}
for (const sound of chosen) {
  if (!check) make(sound);
  const m = measure(sound.out);
  const from = sound.loop
    ? `loop of ${sound.loop.pieces.map(([a, b]) => `${a}-${b}`).join(", ")} s`
    : sound.swarm
      ? `swarm of ${sound.swarm.pieces.map(([a, b]) => `${a}-${b}`).join(", ")} s`
      : `${sound.start}-${sound.end} s`;
  console.log(
    `${m.name.padEnd(15)} ${String(m.seconds).padStart(6)} s  peak ${String(m.peakDb).padStart(5)} dBFS  loud ${String(m.loudDb).padStart(5)} dBFS  lead ${String(m.leadMs).padStart(5)} ms  ${String(m.kb).padStart(5)} KB   ${sound.src} ${from}`,
  );
}
