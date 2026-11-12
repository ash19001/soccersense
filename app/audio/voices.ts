/**
 * The one-shot voices: one function per sound cue (all but `wind`, which lasts and lives in
 * wind.ts). Each builds its sound from `t` (context time) into `mix` through the synth `s`,
 * which writes down every node so the engine can free them once the sound is over.
 *
 * The crowd voices (cheer, groan, ooh) are sized by where they are heard (`Crowd`, from
 * place.ts): a few mates whooping in the park, a stand at a lower-league ground, a whole
 * stadium at the World Cup, and on the home page a stadium far across town.
 *
 * The levels here are the shape of each sound. How loud each kind is in the game is one
 * table, `LEVELS` in engine.ts, measured offline (docs/AUDIO.md).
 */

import type { ScoreShot, SoundCue } from "~/scenes/scene";

import { type Mix, VOWELS, applause, fanWhistle, roar, voices } from "./crowd";
import { Synth, ad, crackleBuffer, curve, glide, link } from "./dsp";
import { CROWD, STINGS } from "./mix";
import { type Crowd, DEFAULT_CROWD } from "./place";

export type OneShotCue = Exclude<SoundCue, { kind: "wind" }>;
export type OneShotKind = OneShotCue["kind"];

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

/** A send of `amount` from `node` into the room, if there is one. */
function send(s: Synth, node: AudioNode, mix: Mix, amount: number): void {
  if (mix.wet) link(node, s.gain(amount, mix.wet));
}

/** The same mix, panned. */
function panned(s: Synth, mix: Mix, pan: number): Mix {
  return { dry: s.pan(pan, mix.dry), wet: mix.wet };
}

/**
 * The same mix heard from far away: quieter, darker, and more of it is the room. `level` is
 * how much of it gets here, `bright` the low-pass that the distance is.
 */
function distant(s: Synth, mix: Mix, level: number, bright: number): Mix {
  const dry = s.gain(level, s.filter("lowpass", bright, 0.5, mix.dry));
  const wet = mix.wet ? s.gain(level * 1.6, mix.wet) : null;
  return { dry, wet };
}

// --- the ball ---------------------------------------------------------------------------------

/** A soft leather tap: a small hollow knock and a brush of leather. */
function touch(s: Synth, mix: Mix, t: number): void {
  const f = s.rnd(0.9, 1.12);
  const body = s.gain(0, mix.dry);
  const knock = s.osc("sine", 240 * f, body, t, t + 0.15);
  glide(knock.frequency, t, 250 * f, 120 * f, 0.05);
  ad(body.gain, t, 0.003, 0.5, 0.025);
  const leather = s.gain(0, s.filter("bandpass", 1500 * f, 1.2, mix.dry));
  s.noise("white", leather, t, t + 0.08);
  ad(leather.gain, t, 0.001, 1.6, 0.008);
  send(s, body, mix, 0.15);
}

/**
 * A ball struck: the deep thump of the boot through it, the hollow knock of its skin and
 * the slap of leather, all bigger and sharper with `power`; a hard one whooshes away.
 */
function kick(s: Synth, mix: Mix, t: number, power: number): void {
  const p = clamp01(power);
  const body = s.gain(0, mix.dry);
  const thump = s.osc("sine", 150, body, t, t + 0.6);
  glide(thump.frequency, t, 150 + 80 * p, 46, 0.08 + 0.04 * p);
  ad(body.gain, t, 0.002, 0.55 + 0.35 * p, 0.05 + 0.05 * p);

  const skin = s.gain(0, mix.dry);
  const knock = s.osc("triangle", 340, skin, t, t + 0.12);
  glide(knock.frequency, t, 360, 190, 0.035);
  ad(skin.gain, t, 0.001, 0.22 + 0.1 * p, 0.014);

  const band = s.filter("bandpass", 1700 + 1900 * p, 0.8, mix.dry);
  const slap = s.gain(0, s.filter("highpass", 800, 0.7, band));
  s.noise("white", slap, t, t + 0.12);
  ad(slap.gain, t, 0.0008, 1.6 + 2.6 * p, 0.009 + 0.007 * p);
  send(s, band, mix, 0.3);

  if (p > 0.35) {
    // The ball flying off.
    const air = s.gain(0, mix.dry);
    const whoosh = s.filter("bandpass", 2400, 1.1, air);
    s.noise("pink", whoosh, t + 0.02, t + 0.7);
    glide(whoosh.frequency, t + 0.02, 2600, 650, 0.5);
    curve(air.gain, t + 0.02, [
      [0.05, 1.4 * (p - 0.35)],
      [0.55, 0],
    ]);
  }
}

/**
 * A ball dropping onto turf from height (the fallback when there is no recording): the
 * dull thump of the ball's body falling in pitch, the hollow knock of its skin and a soft
 * brush of grass. `power` (0 to 1) makes it fuller; the small bounce after is about 0.35.
 */
function land(s: Synth, mix: Mix, t: number, power: number): void {
  const p = clamp01(power);
  const body = s.gain(0, mix.dry);
  const thump = s.osc("sine", 120, body, t, t + 0.4);
  glide(thump.frequency, t, 105 + 30 * p, 55, 0.09);
  ad(body.gain, t, 0.003, 0.9, 0.045 + 0.02 * p);
  const skin = s.gain(0, mix.dry);
  const knock = s.osc("triangle", 260, skin, t, t + 0.1);
  glide(knock.frequency, t, 280, 160, 0.04);
  ad(skin.gain, t, 0.002, 0.2, 0.012);
  const grass = s.gain(0, s.filter("bandpass", 1100, 0.8, mix.dry));
  s.noise("pink", grass, t, t + 0.15);
  ad(grass.gain, t, 0.002, 0.5 + 0.4 * p, 0.02);
  send(s, body, mix, 0.12);
}

/**
 * The ball into the net (the fallback when there is no recording): a soft swish of the mesh
 * taking it, falling as the net gives, a rattle of the strings as it settles, and a dull
 * puff of the ball into the pocket. About 0.45 s.
 */
function net(s: Synth, mix: Mix, t: number): void {
  const swish = s.gain(0, mix.dry);
  const band = s.filter("bandpass", 2400, 0.9, swish);
  s.noise("pink", band, t, t + 0.5);
  glide(band.frequency, t, 2600, 1200, 0.35);
  curve(swish.gain, t, [
    [0.012, 1.3],
    [0.14, 0.8],
    [0.45, 0],
  ]);
  send(s, swish, mix, 0.15);
  // The strings rattling: high noise, shaken quickly.
  const rattle = s.gain(0, s.filter("highpass", 1400, 0.7, mix.dry));
  s.noise("white", s.flutter(26, 0.85, rattle, t, t + 0.45), t, t + 0.45);
  curve(rattle.gain, t, [
    [0.03, 0.35],
    [0.18, 0.25],
    [0.42, 0],
  ]);
  const puff = s.gain(0, s.filter("lowpass", 450, 0.7, mix.dry));
  s.noise("brown", puff, t, t + 0.2);
  ad(puff.gain, t, 0.004, 0.9, 0.03);
}

// --- the crowd ----------------------------------------------------------------------------------

/**
 * The crowd goes up, sized by who is there. `size` 0 is a ripple, 1 an eruption.
 * - Far (the home page): a stadium across town, a soft dark swell and nothing close.
 * - A few people (the park, Sunday league): mates whooping, a yell or two, a few claps.
 * - A crowd (non-league up to the World Cup): a roar that swells and falls away, voices
 *   yelling in it, applause, and at the top end fans whistling; bigger with the crowd.
 */
function cheer(
  s: Synth,
  mix: Mix,
  t: number,
  size: number,
  crowd: Crowd,
): void {
  const z = clamp01(size);
  if (crowd.far) return farCheer(s, mix, t, z);
  if (crowd.people < 0.2) return fewCheer(s, mix, t, z, crowd.people);
  return crowdCheer(s, mix, t, z, crowd.people);
}

/** A stadium across town going up: a dark, faint swell, about two to four seconds. */
function farCheer(s: Synth, mix: Mix, t: number, z: number): void {
  const far = distant(s, mix, CROWD.acrossTown, 900);
  const rise = 0.5 + 0.4 * z;
  const hold = 0.3 + 1.2 * z;
  const fall = 1.4 + 1.6 * z;
  const total = rise + hold + fall;
  const level = roar(s, far, t, t + total + 0.1, {
    vowel: VOWELS.ah,
    q: 2,
    bright: 700 + 300 * z,
    flutterRate: 2,
    flutterDepth: 0.25,
  });
  const peak = 0.4 + 0.6 * z;
  curve(level.gain, t, [
    [rise, peak],
    [rise + hold, peak * 0.85],
    [total, 0],
  ]);
}

/**
 * A few people: mates whooping "woo!" and yelling, and clapping. `people` from 0 (three or
 * four mates) to 0.2 (a touchline of parents and subs).
 */
function fewCheer(
  s: Synth,
  mix: Mix,
  t: number,
  z: number,
  people: number,
): void {
  const many = people / 0.2;
  const whoops = 2 + Math.round(2 * z + 2 * many);
  voices(s, mix, t, {
    count: whoops,
    low: 140,
    high: 240,
    contour: [
      [0, 0.95],
      [0.25, 1.65],
      [0.7, 1.55],
      [1, 1.2],
    ],
    length: [0.45, 0.8 + 0.3 * z],
    spread: 0.45,
    attack: 0.05,
    release: 0.2,
    level: 0.12,
    vowel: VOWELS.oo,
    q: 5,
    bright: 2800,
  });
  // "Yes!", "Get in!": a yell or two, and the parents' higher voices on a touchline.
  voices(s, mix, t + 0.1, {
    count: 1 + Math.round(z + 3 * many),
    low: many > 0.5 ? 150 : 130,
    high: many > 0.5 ? 330 : 200,
    contour: [
      [0, 1],
      [0.2, 1.3],
      [1, 0.85],
    ],
    length: [0.3, 0.6],
    spread: 0.6,
    attack: 0.03,
    release: 0.15,
    level: 0.11,
    vowel: s.pick([VOWELS.eh, VOWELS.ah]),
    q: 5,
    bright: 2600,
  });
  const claps = 1.6 + 1.2 * z;
  applause(
    s,
    mix,
    t + 0.3,
    [
      [0.2, 0.35 + 0.25 * z],
      [claps - 0.5, 0.3 + 0.2 * z],
      [claps, 0],
    ],
    5 + 6 * many,
  );
  if (z > 0.6) fanWhistle(s, mix, t + s.rnd(0.2, 0.6), 0.04);
}

/**
 * A crowd: a roar that swells and falls away, voices in it, applause and whistles. `people`
 * from 0.2 (a few hundred at a non-league ground) to 1 (a final). `size` 0 is a ripple
 * (about 1.5 s), 1 an eruption (about 5).
 */
function crowdCheer(
  s: Synth,
  mix: Mix,
  t: number,
  z: number,
  people: number,
): void {
  const p = Math.max(0, Math.min(1, people));
  const few = 1 - p;
  const rise = 0.25 + 0.35 * z;
  const hold = (0.3 + 1.6 * z) * (0.6 + 0.4 * p);
  const fall = (1.1 + 2.2 * z) * (0.7 + 0.3 * p);
  const total = rise + hold + fall;
  const peak = (0.25 + 0.75 * z) * (0.5 + 0.5 * p);
  // Fewer people: the formants are narrower and the roar more ragged.
  const level = roar(s, mix, t, t + total + 0.1, {
    vowel: VOWELS.ah,
    q: 2 + 2 * few,
    bright: 2000 + 2200 * z,
    flutterRate: 4 + 2 * few,
    flutterDepth: 0.3 + 0.3 * few,
  });
  curve(level.gain, t, [
    [rise, peak],
    [rise + hold, peak * 0.85],
    [total, 0],
  ]);
  if (z > 0.4 && p > 0.6) {
    // A second, brighter roar a beat later: the far stands catching up.
    const far = roar(s, mix, t, t + total + 0.1, {
      vowel: VOWELS.eh,
      q: 2.5,
      bright: 3500,
      flutterRate: 5,
      flutterDepth: 0.4,
    });
    const farPeak = peak * 0.5 * (p - 0.4) * 1.6;
    curve(far.gain, t, [
      [0.15, 0],
      [rise + 0.2, farPeak],
      [rise + hold, farPeak * 0.9],
      [total * 0.9, 0],
    ]);
  }
  voices(s, mix, t, {
    count: 4 + Math.round(10 * z * (0.6 + 0.4 * p)),
    low: 150,
    high: 380,
    contour: [
      [0, 0.85],
      [0.15, 1.12],
      [0.6, 1.05],
      [1, 0.8],
    ],
    length: [0.6 + hold * 0.6, 1 + hold],
    spread: 0.25,
    attack: 0.1,
    release: 0.4,
    level: 0.07,
    vowel: VOWELS.eh,
    q: 5,
    bright: 3000,
  });
  applause(
    s,
    mix,
    t + 0.1,
    [
      [rise + 0.3, (0.3 + 0.9 * z) * (0.7 + 0.3 * p)],
      [rise + hold + 0.6, (0.25 + 0.75 * z) * (0.7 + 0.3 * p)],
      [total + 0.3, 0],
    ],
    14 + 31 * p,
  );
  const whistles = Math.round(Math.max(0, z - 0.45) * 6 * p);
  for (let i = 0; i < whistles; i++) {
    fanWhistle(s, mix, t + s.rnd(0.2, rise + hold), 0.05);
  }
}

/** A miss: the crowd's long falling "ohhh"; a few people's "ohh" in the park. */
function groan(s: Synth, mix: Mix, t: number, crowd: Crowd): void {
  const m = crowd.far ? distant(s, mix, CROWD.acrossTown, 900) : mix;
  const p = crowd.far ? 0.8 : crowd.people;
  if (p >= 0.2) {
    const level = roar(s, m, t, t + 2.4, {
      vowel: VOWELS.oh,
      q: 2.5 + 1.5 * (1 - p),
      bright: crowd.far ? 700 : 1800,
      flutterRate: 2.5,
      flutterDepth: 0.25,
    });
    const peak = 0.7 * (0.5 + 0.5 * p);
    curve(level.gain, t, [
      [0.18, peak],
      [0.7, peak * 0.8],
      [2.2, 0],
    ]);
  }
  if (crowd.far) return;
  voices(s, m, t, {
    count: p < 0.2 ? 3 + Math.round(15 * p) : 6 + Math.round(3 * p),
    low: 115,
    high: 230,
    contour: [
      [0, 1.12],
      [0.25, 1.05],
      [1, 0.72],
    ],
    length: [1.1, 1.8],
    spread: 0.15,
    attack: 0.08,
    release: 0.6,
    level: p < 0.2 ? 0.1 : 0.08,
    vowel: VOWELS.oh,
    bright: 2000,
  });
}

/** A near thing: a short gasp that rises, "ooh!". */
function ooh(s: Synth, mix: Mix, t: number, crowd: Crowd): void {
  const m = crowd.far ? distant(s, mix, CROWD.acrossTown, 900) : mix;
  const p = crowd.far ? 0.8 : crowd.people;
  if (p >= 0.2) {
    const level = roar(s, m, t, t + 1.1, {
      vowel: VOWELS.oo,
      q: 3,
      bright: crowd.far ? 700 : 1600,
      flutterRate: 3,
      flutterDepth: 0.2,
    });
    const peak = 0.6 * (0.5 + 0.5 * p);
    curve(level.gain, t, [
      [0.12, peak],
      [0.35, peak * 0.85],
      [1, 0],
    ]);
  }
  if (crowd.far) return;
  voices(s, m, t, {
    count: p < 0.2 ? 3 + Math.round(15 * p) : 5 + Math.round(3 * p),
    low: 140,
    high: 260,
    contour: [
      [0, 0.85],
      [0.6, 1.2],
      [1, 1.1],
    ],
    length: [0.6, 0.95],
    spread: 0.08,
    attack: 0.1,
    release: 0.25,
    level: p < 0.2 ? 0.1 : 0.08,
    vowel: VOWELS.oo,
    bright: 1800,
  });
}

/** A blast of horns from the stands: a swarm of buzzing B flats, rising and falling. */
function vuvuzela(s: Synth, mix: Mix, t: number): void {
  const len = s.rnd(2.6, 3.6);
  const master = s.gain(0, mix.dry);
  send(s, master, mix, 0.5);
  curve(master.gain, t, [
    [0.6, 1],
    [len - 1.1, 0.9],
    [len, 0],
  ]);
  const tone = s.filter("lowpass", 2200, 0.7, master);
  const bore = s.filter("bandpass", 650, 1.2, s.gain(0.8, tone));
  const horns = s.gain(1, tone);
  link(horns, bore);
  const B_FLAT = 233.08;
  for (let i = 0; i < 7; i++) {
    const on = t + s.rnd(0, 0.7);
    const off = t + len - s.rnd(0, 0.9);
    // Most are close to B flat; now and then one is a semitone out.
    const cents = s.rand() < 0.15 ? s.pick([-100, 100]) : s.rnd(-30, 30);
    const f = B_FLAT * 2 ** (cents / 1200);
    const env = s.gain(0, horns);
    const reed = s.osc("sawtooth", f, env, on, off + 0.05);
    reed.frequency.setValueAtTime(f * 0.94, on);
    reed.frequency.exponentialRampToValueAtTime(f, on + 0.12);
    s.osc("sine", s.rnd(0.2, 0.6), s.gain(f * 0.006, reed.frequency), on, off);
    const dur = off - on;
    const lvl = 0.12 * s.rnd(0.7, 1);
    if (s.rand() < 0.4 && dur > 1.2) {
      // A breath in the middle.
      const gap = s.rnd(0.4, dur - 0.7);
      curve(env.gain, on, [
        [0.08, lvl],
        [gap, lvl],
        [gap + 0.06, 0],
        [gap + 0.3, 0],
        [gap + 0.38, lvl],
        [dur - 0.15, lvl],
        [dur, 0],
      ]);
    } else {
      curve(env.gain, on, [
        [0.08, lvl],
        [dur - 0.15, lvl * s.rnd(0.8, 1)],
        [dur, 0],
      ]);
    }
  }
}

// --- the referee --------------------------------------------------------------------------------

/** A pea whistle: a high note trilled by the pea. Full time is three blasts, the last long. */
function whistle(s: Synth, mix: Mix, t: number, long: boolean): void {
  const blasts: readonly (readonly [number, number])[] = long
    ? [
        [0, 0.22],
        [0.38, 0.22],
        [0.76, 0.95],
      ]
    : [[0, 0.34]];
  for (const [at, len] of blasts) {
    const t0 = t + at;
    const f = 2950 * s.rnd(0.98, 1.02);
    const out = s.gain(0, s.filter("lowpass", 6000, 0.5, mix.dry));
    send(s, out, mix, 0.35);
    const am = s.gain(0.65, out);
    const tone = s.osc("sine", f, am, t0, t0 + len + 0.05);
    s.osc("sine", f * 2, s.gain(0.1, am), t0, t0 + len + 0.05);
    const pea = s.osc("sine", s.rnd(26, 32), null, t0, t0 + len + 0.05);
    link(pea, s.gain(f * 0.04, tone.frequency));
    link(pea, s.gain(0.35, am.gain));
    const breath = s.gain(0.25, out);
    s.noise("white", s.filter("bandpass", f, 6, breath), t0, t0 + len + 0.05);
    curve(out.gain, t0, [
      [0.012, 1],
      [len - 0.03, 0.9],
      [len, 0],
    ]);
  }
}

// --- the airship and other things ----------------------------------------------------------------

/** A poke on the airship: a rubbery stretch. */
function squeak(s: Synth, mix: Mix, t: number): void {
  const len = s.rnd(0.18, 0.28);
  const out = s.gain(0, s.filter("bandpass", 1400, 1.5, mix.dry));
  const f0 = s.rnd(520, 680);
  const rubber = s.osc("sawtooth", f0, out, t, t + len + 0.05);
  rubber.frequency.setValueAtTime(f0, t);
  rubber.frequency.exponentialRampToValueAtTime(f0 * 1.7, t + len);
  // Stick and slip.
  s.osc(
    "square",
    s.rnd(20, 28),
    s.gain(f0 * 0.08, rubber.frequency),
    t,
    t + len,
  );
  curve(out.gain, t, [
    [0.02, 1],
    [len * 0.7, 0.8],
    [len, 0],
  ]);
  const boing = s.gain(0, mix.dry);
  const skin = s.osc("sine", 170, boing, t, t + 0.3);
  glide(skin.frequency, t, 170, 250, 0.2);
  ad(boing.gain, t, 0.01, 0.35, 0.06);
}

/** The airship bursts: a bang, a boom, the gas rushing out and the skin flapping. */
function pop(s: Synth, mix: Mix, t: number): void {
  const bang = s.gain(0, s.filter("lowpass", 3500, 0.5, mix.dry));
  s.noise("white", bang, t, t + 0.4);
  ad(bang.gain, t, 0.0005, 2.4, 0.035);
  send(s, bang, mix, 0.5);
  const body = s.gain(0, s.filter("lowpass", 380, 0.7, mix.dry));
  s.noise("brown", body, t, t + 0.9);
  ad(body.gain, t, 0.002, 2.6, 0.11);
  const boom = s.gain(0, mix.dry);
  const thump = s.osc("sine", 80, boom, t, t + 0.7);
  glide(thump.frequency, t, 80, 38, 0.2);
  ad(boom.gain, t, 0.002, 0.7, 0.09);
  const hiss = s.gain(0, s.filter("highpass", 2500, 0.5, mix.dry));
  s.noise("white", hiss, t + 0.02, t + 1.4);
  curve(hiss.gain, t + 0.02, [
    [0.06, 0.35],
    [1.3, 0],
  ]);
  for (let i = 0; i < 5; i++) {
    const at = t + 0.08 + i * s.rnd(0.07, 0.12);
    const flap = s.gain(0, s.filter("bandpass", s.rnd(300, 600), 1.2, mix.dry));
    s.noise("pink", flap, at, at + 0.15);
    ad(flap.gain, at, 0.003, 1.4 * (1 - i / 6), 0.02);
  }
}

/** Something heavy lands: a low thump, a rumble and a puff of dust. */
function thud(s: Synth, mix: Mix, t: number): void {
  const boom = s.gain(0, mix.dry);
  const thump = s.osc("sine", 85, boom, t, t + 0.9);
  glide(thump.frequency, t, 85, 36, 0.22);
  ad(boom.gain, t, 0.003, 0.9, 0.11);
  const rumble = s.gain(0, s.filter("lowpass", 260, 0.7, mix.dry));
  s.noise("brown", rumble, t, t + 0.9);
  ad(rumble.gain, t, 0.002, 2.6, 0.12);
  const contact = s.gain(0, s.filter("bandpass", 900, 1, mix.dry));
  s.noise("white", contact, t, t + 0.1);
  ad(contact.gain, t, 0.001, 1.2, 0.012);
  const dust = s.gain(0, s.filter("bandpass", 1200, 0.8, mix.dry));
  s.noise("pink", dust, t, t + 0.7);
  curve(dust.gain, t, [
    [0.05, 0.25],
    [0.6, 0],
  ]);
  send(s, boom, mix, 0.2);
}

/** Into the water: a wash that falls in pitch, and droplets after it. */
function splash(s: Synth, mix: Mix, t: number): void {
  const wash = s.gain(0, mix.dry);
  const band = s.filter("bandpass", 2600, 0.9, wash);
  s.noise("white", band, t, t + 0.9);
  glide(band.frequency, t, 3200, 700, 0.55);
  curve(wash.gain, t, [
    [0.008, 1.8],
    [0.12, 1],
    [0.8, 0],
  ]);
  const body = s.gain(0, s.filter("lowpass", 700, 0.7, mix.dry));
  s.noise("pink", body, t, t + 0.6);
  curve(body.gain, t, [
    [0.01, 1.2],
    [0.5, 0],
  ]);
  send(s, wash, mix, 0.3);
  for (let i = 0; i < 8; i++) {
    const at = t + s.rnd(0.06, 0.75);
    const f = s.rnd(700, 1400);
    const drop = s.gain(0, mix.dry);
    const tone = s.osc("sine", f, drop, at, at + 0.08);
    glide(tone.frequency, at, f, f * 2.2, 0.03);
    ad(drop.gain, at, 0.002, s.rnd(0.06, 0.14), 0.015);
  }
}

/** A rocket: a rising whistle and hiss, a soft bang (not near), and crackling. */
function firework(s: Synth, mix: Mix, t: number): void {
  const m = panned(s, mix, s.rnd(-0.5, 0.5));
  const climb = 0.9 + s.rnd(-0.1, 0.15);
  const rise = s.gain(0, m.dry);
  const tone = s.osc("sine", 700, rise, t, t + climb);
  glide(tone.frequency, t, s.rnd(600, 800), s.rnd(2000, 2600), climb);
  s.osc("sine", 9, s.gain(40, tone.frequency), t, t + climb);
  curve(rise.gain, t, [
    [0.1, 0.1],
    [climb - 0.05, 0.13],
    [climb, 0],
  ]);
  const trail = s.gain(0, s.filter("highpass", 3000, 0.5, m.dry));
  s.noise("white", trail, t, t + climb);
  curve(trail.gain, t, [
    [0.1, 0.16],
    [climb, 0],
  ]);
  const b = t + climb + 0.04;
  const bang = s.gain(0, s.filter("lowpass", 1200, 0.5, m.dry));
  s.noise("white", bang, b, b + 0.6);
  ad(bang.gain, b, 0.002, 1.1, 0.06);
  send(s, bang, m, 0.6);
  const boom = s.gain(0, m.dry);
  const low = s.osc("sine", 60, boom, b, b + 1.2);
  glide(low.frequency, b, 60, 35, 0.3);
  ad(boom.gain, b, 0.004, 0.45, 0.18);
  const rumble = s.gain(0, s.filter("lowpass", 200, 0.7, m.dry));
  s.noise("brown", rumble, b, b + 2.5);
  ad(rumble.gain, b, 0.01, 1.3, 0.35);
  const crackle = s.gain(0, s.filter("highpass", 1500, 0.5, m.dry));
  send(s, crackle, m, 0.5);
  const c = b + 0.15;
  s.buffer(crackleBuffer(s.ctx), crackle, c, c + 1.8, { loop: false });
  curve(crackle.gain, c, [
    [0.02, 1.2],
    [1.7, 0],
  ]);
}

/**
 * A firework far away: a faint hiss going up, a soft muffled pop and a little crackle, most
 * of it the sky's echo.
 */
function farFirework(s: Synth, mix: Mix, t: number): void {
  const m = distant(s, panned(s, mix, s.rnd(-0.8, 0.8)), 0.5, 1400);
  const climb = s.rnd(0.6, 0.9);
  const trail = s.gain(0, s.filter("bandpass", 2600, 0.8, m.dry));
  s.noise("white", trail, t, t + climb);
  curve(trail.gain, t, [
    [0.15, 0.08],
    [climb, 0],
  ]);
  const b = t + climb;
  const bang = s.gain(0, s.filter("lowpass", 900, 0.5, m.dry));
  s.noise("white", bang, b, b + 0.4);
  ad(bang.gain, b, 0.002, 1.3, 0.035);
  send(s, bang, m, 1);
  const boom = s.gain(0, m.dry);
  const low = s.osc("sine", 75, boom, b, b + 0.7);
  glide(low.frequency, b, 75, 42, 0.18);
  ad(boom.gain, b, 0.004, 0.3, 0.1);
  const crackle = s.gain(0, s.filter("lowpass", 3000, 0.5, m.dry));
  send(s, crackle, m, 0.6);
  const c = b + 0.12;
  s.buffer(crackleBuffer(s.ctx), crackle, c, c + 1.3, { loop: false });
  curve(crackle.gain, c, [
    [0.02, 0.5],
    [1.2, 0],
  ]);
}

/**
 * A star's twinkle (the fallback when there is no recording): two bright chimes, the second
 * higher and brighter 0.12 s after the first, ringing away with a few high twinkles over
 * them, all high (above the iris's whoosh, which plays under its tail). About 0.8 s.
 */
function twinkle(s: Synth, mix: Mix, t: number): void {
  const out = s.filter("highpass", 900, 0.5, mix.dry);
  send(s, out, mix, 0.4);
  for (const [at, n, level] of [
    [0, E6, 0.1],
    [0.12, B6, 0.16],
  ] as const) {
    for (const [ratio, share] of [
      [1, 1],
      [2.76, 0.35],
      [5.4, 0.15],
    ] as const) {
      // A struck bell's partials: the note, and two higher, quieter ones ringing less long.
      const env = s.gain(0, out);
      s.osc("sine", note(n) * ratio, env, t + at, t + at + 0.9);
      ad(env.gain, t + at, 0.002, level * share, 0.18 / ratio ** 0.5);
    }
  }
  sparkle(s, out, t + 0.16, 0.45, 5, 0.05);
}

/** The promotion's sweep of smoke: a whoosh of wind and dust passing from left to right. */
function sweep(s: Synth, mix: Mix, t: number): void {
  const len = 1.5;
  const pan = s.pan(-0.7, mix.dry);
  if ("pan" in pan) {
    pan.pan.setValueAtTime(-0.7, t);
    pan.pan.linearRampToValueAtTime(0.7, t + len);
  }
  send(s, pan, mix, 0.3);
  const air = s.gain(0, pan);
  const band = s.filter("bandpass", 300, 1.3, air);
  s.noise("pink", band, t, t + len + 0.1);
  band.frequency.setValueAtTime(300, t);
  band.frequency.exponentialRampToValueAtTime(2400, t + 0.55);
  band.frequency.exponentialRampToValueAtTime(500, t + len);
  curve(air.gain, t, [
    [0.45, 2.2],
    [0.75, 1.8],
    [len, 0],
  ]);
  const dust = s.gain(0, s.filter("lowpass", 350, 0.7, pan));
  s.noise("brown", dust, t, t + len + 0.25);
  curve(dust.gain, t, [
    [0.4, 1.4],
    [len + 0.2, 0],
  ]);
  const grit = s.gain(0, s.filter("highpass", 4000, 0.5, pan));
  s.noise("white", grit, t, t + 1.3);
  curve(grit.gain, t, [
    [0.5, 0.12],
    [1.2, 0],
  ]);
}

// --- the interface --------------------------------------------------------------------------------

/** A button pressed: a crisp little tick and a short wooden "tock", 40 ms. */
function click(s: Synth, mix: Mix, t: number): void {
  const f = s.rnd(0.97, 1.03);
  const tick = s.gain(0, s.filter("highpass", 2500, 0.7, mix.dry));
  s.noise("white", tick, t, t + 0.03);
  ad(tick.gain, t, 0.0005, 0.9, 0.003);
  const body = s.gain(0, mix.dry);
  const tock = s.osc("triangle", 1500 * f, body, t, t + 0.06);
  glide(tock.frequency, t, 1500 * f, 950 * f, 0.025);
  ad(body.gain, t, 0.001, 0.5, 0.01);
}

/**
 * The iris between the home screen and the game: a soft whoosh of air. Closing, it falls
 * and the light shuts with a soft low "doom"; opening, it rises and ends in a little shimmer.
 */
function transition(s: Synth, mix: Mix, t: number, opening: boolean): void {
  const len = opening ? 0.9 : 0.75;
  const air = s.gain(0, mix.dry);
  send(s, air, mix, 0.3);
  const band = s.filter("bandpass", 1000, 1.4, air);
  s.noise("pink", band, t, t + len + 0.05);
  const [from, to] = opening ? [240, 2800] : [2600, 260];
  band.frequency.setValueAtTime(from, t);
  band.frequency.exponentialRampToValueAtTime(to, t + len);
  curve(
    air.gain,
    t,
    opening
      ? [
          [len * 0.6, 1.5],
          [len * 0.85, 1.1],
          [len, 0],
        ]
      : [
          [len * 0.2, 1.5],
          [len * 0.7, 1.2],
          [len, 0],
        ],
  );
  // A soft tone under the air, moving the same way.
  const hum = s.gain(0, mix.dry);
  const tone = s.osc("sine", 300, hum, t, t + len + 0.05);
  glide(tone.frequency, t, opening ? 180 : 520, opening ? 620 : 150, len);
  curve(hum.gain, t, [
    [len * 0.4, 0.1],
    [len, 0],
  ]);
  if (opening) {
    const shine = s.gain(0, s.filter("highpass", 5000, 0.5, mix.dry));
    send(s, shine, mix, 0.5);
    s.noise("white", shine, t + len * 0.6, t + len + 0.4);
    curve(shine.gain, t + len * 0.6, [
      [0.15, 0.12],
      [0.7, 0],
    ]);
  } else {
    const shut = t + len - 0.06;
    const boom = s.gain(0, mix.dry);
    const low = s.osc("sine", 100, boom, shut, shut + 0.5);
    glide(low.frequency, shut, 100, 48, 0.16);
    ad(boom.gain, shut, 0.006, 0.45, 0.07);
    send(s, boom, mix, 0.2);
  }
}

// --- the result stings ------------------------------------------------------------------------------

/** The frequency `n` semitones from A4 (440 Hz). */
function note(n: number): number {
  return 440 * 2 ** (n / 12);
}

// Semitones from A4 of the notes the stings use: C major, with the A flat, B flat and E flat
// of the worldie's run-in (and the twinkle's B).
const C4 = -9,
  G3 = -14,
  C3 = -21,
  F3 = -16,
  E4 = -5,
  F4 = -4,
  FS4 = -3,
  G4 = -2,
  C5 = 3,
  E5 = 7,
  G5 = 10,
  AB5 = 11,
  BB5 = 13,
  C6 = 15,
  D6 = 17,
  EB6 = 18,
  E6 = 19,
  F6 = 20,
  G6 = 22,
  B6 = 26,
  C7 = 27,
  E7 = 31,
  G7 = 34;

interface Blip {
  wave?: OscillatorType;
  level?: number;
  attack?: number;
  release?: number;
  /** Vibrato depth (a fraction of the pitch), from a tenth of a second in. */
  vibrato?: number;
  /** Starts this ratio off the note and slides onto it in 50 ms. */
  bend?: number;
  /** Where the level sits at the end of the note, as a fraction of its peak. */
  sustain?: number;
}

/** One note of a chip tune: a tone with a small envelope. Returns its oscillator. */
function blip(
  s: Synth,
  dest: AudioNode,
  t: number,
  n: number,
  len: number,
  {
    wave = "square",
    level = 0.2,
    attack = 0.004,
    release = 0.05,
    vibrato = 0,
    bend = 1,
    sustain = 0.7,
  }: Blip = {},
): OscillatorNode {
  const f = note(n);
  const env = s.gain(0, dest);
  const tone = s.osc(wave, f, env, t, t + len + release + 0.02);
  if (bend !== 1) glide(tone.frequency, t, f * bend, f, 0.05);
  if (vibrato > 0 && len > 0.15) {
    s.osc("sine", 6, s.gain(f * vibrato, tone.frequency), t + 0.1, t + len);
  }
  curve(env.gain, t, [
    [attack, level],
    [len, level * sustain],
    [len + release, 0],
  ]);
  return tone;
}

/** A cymbal: bright noise that rings away over `tau` seconds. */
function cymbal(
  s: Synth,
  dest: AudioNode,
  t: number,
  level: number,
  tau: number,
): void {
  const env = s.gain(0, s.filter("highpass", 5500, 0.6, dest));
  s.noise("white", s.filter("peaking", 8000, 1, env), t, t + tau * 7);
  ad(env.gain, t, 0.002, level, tau);
}

/** A low drum hit: a timpani's boom. */
function timpani(s: Synth, dest: AudioNode, t: number, level: number): void {
  const env = s.gain(0, dest);
  const skin = s.osc("sine", 98, env, t, t + 0.9);
  glide(skin.frequency, t, 104, 82, 0.25);
  ad(env.gain, t, 0.004, level, 0.18);
}

/** A few high twinkles over the end of a sting. */
function sparkle(
  s: Synth,
  dest: AudioNode,
  t: number,
  span: number,
  count: number,
  level: number,
): void {
  for (let i = 0; i < count; i++) {
    const at = t + (span * i) / count + s.rnd(0, span / count / 2);
    blip(s, dest, at, s.pick([C7, E7, G7]), 0.04, {
      wave: "sine",
      level: level * s.rnd(0.6, 1),
      release: 0.12,
      sustain: 0.4,
    });
  }
}

/**
 * The sting for a result: retro, bright and short, and clearly a different size for every
 * shot. Into `chip`, a soft low-pass that keeps the square waves friendly.
 */
function score(s: Synth, mix: Mix, t: number, shot: ScoreShot): void {
  // Each sting's loudness against the others (`STINGS[shot].gain` in mix.ts, measured
  // offline): from a worldie, the loudest thing after a final's eruption, to a tap in.
  const out = s.gain(STINGS[shot]?.gain ?? 1, mix.dry);
  const chip = s.filter("lowpass", 4200, 0.5, out);
  send(s, chip, mix, 0.18);
  switch (shot) {
    // A tap in: two notes up, a little chime.
    case "tapin":
      blip(s, chip, t, G5, 0.07, { wave: "triangle", level: 0.5 });
      blip(s, chip, t, G5 + 12, 0.07, { level: 0.06 });
      blip(s, chip, t + 0.09, C6, 0.16, { wave: "triangle", level: 0.5 });
      blip(s, chip, t + 0.09, C6 + 12, 0.16, { level: 0.06 });
      return;
    // A toe poke: a scrappy little prod, then three quick notes up.
    case "toepoke": {
      const prod = s.gain(0, s.filter("bandpass", 1200, 1.2, chip));
      s.noise("white", prod, t, t + 0.04);
      ad(prod.gain, t, 0.001, 0.6, 0.008);
      const run = [C6, E6, G6];
      run.forEach((n, i) => {
        const last = i === run.length - 1;
        blip(s, chip, t + 0.04 + i * 0.065, n, last ? 0.2 : 0.055, {
          level: 0.14,
          sustain: 0.5,
        });
      });
      blip(s, chip, t + 0.04, C5, 0.33, { wave: "triangle", level: 0.3 });
      return;
    }
    // A trivela: the ball curling in, a note that bends up, then a bright arpeggio.
    case "trivela": {
      const curl = s.gain(0, s.filter("bandpass", 1500, 1.5, chip));
      s.noise("pink", s.filter("bandpass", 900, 2, curl), t, t + 0.35);
      curve(curl.gain, t, [
        [0.15, 0.6],
        [0.32, 0],
      ]);
      const bendy = blip(s, chip, t, G5, 0.2, { level: 0.13, sustain: 0.9 });
      bendy.frequency.setValueAtTime(note(E5), t);
      bendy.frequency.exponentialRampToValueAtTime(note(C6), t + 0.16);
      [E6, G6, C7].forEach((n, i) => {
        blip(s, chip, t + 0.22 + i * 0.07, n, i === 2 ? 0.32 : 0.06, {
          level: 0.13,
          vibrato: i === 2 ? 0.006 : 0,
        });
      });
      blip(s, chip, t + 0.22, C4, 0.5, { wave: "triangle", level: 0.35 });
      sparkle(s, chip, t + 0.5, 0.3, 3, 0.07);
      return;
    }
    // A golazo: a fanfare, up to a held chord with a cymbal under it.
    case "golazo": {
      [G5, C6, E6].forEach((n, i) => {
        blip(s, chip, t + i * 0.075, n, 0.06, { level: 0.14 });
      });
      const hit = t + 0.24;
      blip(s, chip, hit, G6, 0.6, { level: 0.14, vibrato: 0.007 });
      blip(s, chip, hit, E6, 0.6, { level: 0.09, vibrato: 0.005 });
      blip(s, chip, hit, C6, 0.6, { level: 0.08 });
      blip(s, chip, hit, C4, 0.7, { wave: "triangle", level: 0.4 });
      cymbal(s, chip, hit, 0.35, 0.25);
      timpani(s, out, hit, 0.4);
      sparkle(s, chip, hit + 0.3, 0.45, 4, 0.07);
      return;
    }
    // A worldie: a run up, two stabs, and a big held chord with drums, a crash and stars.
    case "worldie": {
      const run = [C5, E5, G5, C6, E6, G6];
      run.forEach((n, i) => {
        blip(s, chip, t + i * 0.05, n, 0.045, { level: 0.12 });
      });
      const stabs: readonly (readonly [number, readonly number[]])[] = [
        [0.34, [AB5, C6, EB6]],
        [0.52, [BB5, D6, F6]],
      ];
      for (const [at, chord] of stabs) {
        for (const n of chord) {
          blip(s, chip, t + at, n, 0.12, { level: 0.08, sustain: 0.8 });
        }
        blip(s, chip, t + at, chord[0] - 24, 0.14, {
          wave: "triangle",
          level: 0.38,
        });
        timpani(s, out, t + at, 0.35);
      }
      const big = t + 0.72;
      const hold = 1.05;
      for (const [n, level] of [
        [C6, 0.08],
        [E6, 0.08],
        [G6, 0.09],
        [C7, 0.07],
      ] as const) {
        blip(s, chip, big, n, hold, {
          level,
          vibrato: 0.006,
          release: 0.35,
          sustain: 0.6,
        });
        // A second voice a few cents off, for the width of a brass section.
        blip(s, chip, big, n + 0.08, hold, {
          wave: "sawtooth",
          level: level * 0.45,
          release: 0.35,
          sustain: 0.5,
        });
      }
      blip(s, chip, big, C3, hold, {
        wave: "triangle",
        level: 0.45,
        release: 0.3,
      });
      blip(s, chip, big, C4, hold * 0.6, { wave: "triangle", level: 0.2 });
      timpani(s, out, big, 0.55);
      cymbal(s, chip, big, 0.5, 0.45);
      sparkle(s, chip, big + 0.25, 0.9, 7, 0.08);
      return;
    }
    // A miss: a deflated "womp, womp, wommmp", three notes sagging down on a muted horn.
    case "miss": {
      const horn = s.filter("lowpass", 900, 4, s.gain(1, chip));
      const notes: readonly (readonly [number, number])[] = [
        [G4, 0.2],
        [FS4, 0.2],
        [F4, 0.62],
      ];
      let at = t;
      notes.forEach(([n, len], i) => {
        const last = i === notes.length - 1;
        const tone = blip(s, s.gain(1, horn), at, n, len, {
          wave: "sawtooth",
          level: 0.22,
          attack: 0.02,
          release: 0.1,
          sustain: last ? 0.5 : 0.8,
          vibrato: last ? 0.012 : 0,
        });
        if (last) {
          // Sagging off the end.
          tone.frequency.setValueAtTime(note(n), at + len * 0.4);
          tone.frequency.exponentialRampToValueAtTime(note(E4 - 0.5), at + len);
        }
        // The mute opening and closing: "wah".
        horn.frequency.setValueAtTime(500, at);
        horn.frequency.linearRampToValueAtTime(1300, at + 0.07);
        horn.frequency.linearRampToValueAtTime(600, at + len);
        at += len + 0.06;
      });
      blip(s, chip, t, G3, 0.2, { wave: "triangle", level: 0.25 });
      blip(s, chip, t + 0.52, F3, 0.55, { wave: "triangle", level: 0.25 });
      return;
    }
  }
}

/** Builds the sound for `cue` from time `t` into `mix`, as heard by `crowd`. */
export function playOneShot(
  s: Synth,
  cue: OneShotCue,
  mix: Mix,
  t: number,
  crowd: Crowd = DEFAULT_CROWD,
): void {
  switch (cue.kind) {
    case "touch":
      return touch(s, mix, t);
    case "kick":
      return kick(s, mix, t, cue.power);
    case "net":
      return net(s, mix, t);
    case "cheer":
      return cheer(s, mix, t, cue.size, crowd);
    case "groan":
      return groan(s, mix, t, crowd);
    case "ooh":
      return ooh(s, mix, t, crowd);
    case "whistle":
      return whistle(s, mix, t, cue.long === true);
    case "squeak":
      return squeak(s, mix, t);
    case "pop":
      return pop(s, mix, t);
    case "thud":
      return thud(s, mix, t);
    case "splash":
      return splash(s, mix, t);
    case "firework":
      return cue.distant === true || crowd.far
        ? farFirework(s, mix, t)
        : firework(s, mix, t);
    case "vuvuzela":
      return vuvuzela(s, mix, t);
    case "sparkle":
      return twinkle(s, mix, t);
    case "land":
      return land(s, mix, t, cue.power ?? 1);
    case "sweep":
      return sweep(s, mix, t);
    case "click":
      return click(s, mix, t);
    case "transition":
      return transition(s, mix, t, cue.opening === true);
    case "score":
      return score(s, mix, t, cue.shot);
  }
}

/** Every shot a result sting can be for, best first. */
export const SCORE_SHOTS: readonly ScoreShot[] = [
  "worldie",
  "golazo",
  "trivela",
  "toepoke",
  "tapin",
  "miss",
];
