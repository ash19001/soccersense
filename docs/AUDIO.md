# Sound (`~/audio`)

Every sound in the game is made in the browser with the Web Audio API, in code, the way the art
is drawn in code: no sound files, nothing to license, nothing to download. Each one is built
from layered noise, oscillators, filters, envelopes and pitch sweeps. Any of them can be
replaced by a recording (see "Replacing a sound with a recording" below), and the ball, the
net, the buttons, the fireworks, every clap, AWAY's twinkle, HOME's landing and the World
Cup's vuvuzelas are: see "The recordings in use".

## Changing the volumes

Every sound in the game, and every number that makes one louder or quieter, can be heard and
changed in two places.

**1. Hear them and try other levels: `/dev/sound`.** With the dev server running, open
`http://localhost:5173/dev/sound`. Every sound in the game is listed there by group, each with:

- **Play buttons.** They play the sound through the game's own engine, so it sounds exactly as in
  the game. Where a sound has several takes (the three touches) or a recording and a synthesised
  stand-in, each has its own button (`TOUCH-2`, `SYNTH`). The beds have `DAY`, `NIGHT` and
  `STOP`; the crowd plays at every place, the stings with the net under them. The first press
  wakes the sound (browsers keep a page silent until one).
- **Where it comes from**: its file in `public/sounds/` (amber), or "synthesised".
- **Its levels**, each with its comment from `mix.ts`, its value and a **slider**. Moving a slider
  changes that level at once, in memory only: press the sound's button to hear it. A changed
  level turns gold and says what it was. Nothing is saved: a reload is the file again.
- **COPY CHANGES** copies the lines to paste into `app/audio/mix.ts` (they are shown on the page
  too), for example:

  ```
  // app/audio/mix.ts: 1 change from /dev/sound
  // line 146: SOUNDS.whistle.level (was 0.15)
      level: 0.3,
  ```

  Each line goes over the line of that number. **RESET** puts every slider back; **STOP ALL**
  silences everything. The green log under the title is the engine's own: each sound as it
  plays ("recording" or "synth" and the gain it started at), each level changed, and a sound
  the game's limits held back (`dropped:busy`: too many of it still ringing, or too soon
  after the last; STOP ALL and press it again), or a result's oldest sound making room for a
  new one of its kind (`faded`). In the browser's console,
  `window.__soccersenseSound.debug()` gives the same log and more.

**2. Keep a change: `app/audio/mix.ts`.** It is one well-commented file of numbers and nothing
else, and the only place a volume is set. Change a number, save, and the dev server reloads the
page with it. Every line says what the number is, its unit and which way is louder:

- a **gain** is a multiplier, 0 to 1 (a few go a little over): higher is louder. Half the
  number is about 6 dB quieter, a quarter about 12 dB.
- a **dB** number (its name ends in `Db`) is decibels: higher (nearer 0) is louder. Every 6 dB
  is twice or half the level; about 10 dB sounds twice or half as loud. `peakDb` and `rmsDb`
  are dBFS, against the loudest a speaker can play (0).
- a **power**, **size** or **speed** (what the scenes send) is 0 to 1: higher is louder.

The groups in `mix.ts`, in its order:

| group        | what it holds                                                                                                                                                                          |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BUSES`      | the master (everything at once), the effects bus (every one-shot), the ambience bus (every bed), the room (the reverb), and where the safety starts to round off peaks                 |
| `SOUNDS`     | each sound by its cue: `level` (the synthesised voice's gain), `peakDb` (the peak its recording is brought to), the recording it plays (`file`) and what plays without it (`synth`)    |
| `CROWD`      | the cheer, groan and ooh by place: how many people and a recording's level there against a top-flight stadium; how much of a stadium across town reaches the home page (`acrossTown`)  |
| `BEDS`       | each place's bed (the home page's town and the eight career tiers): the crowd value the scene sends, the air, the traffic and the murmur by day and at night, a recorded bed's average |
| `BED_EVENTS` | the beds' things that happen now and then (a bird, a dog, a shout, a drum, a far firework...): how loud each is                                                                        |
| `STINGS`     | each result's sting by shot: its gain against the others and a recording's peak                                                                                                        |
| `NET`        | how hard each goal takes the net, as a share of the net's level                                                                                                                        |
| `FIREWORKS`  | a far firework against a near one, and the 2 dB lift the far ones were given                                                                                                           |
| `VUVUZELA`   | a tap in's blast against a worldie's, and the World Cup beds' hum                                                                                                                      |
| `CLAPS`      | every clap in the game (the recording, in layers by the crowd): its level, how much quieter a few hands are, how many layers                                                           |
| `HOME_PAGE`  | what the home page sends: the press on the ball, the kick-off, HOME's landing and bounce, the wind of the flight, the far match's cheer, the mascot's touches and kicks                |
| `GAME`       | what the career sends for each shot (its kick, its cheer, its wind) and the rest (the worldie's build-up, a low miss, full time)                                                       |
| `JUGGLE`     | the juggling's touch while the player types                                                                                                                                            |
| `LIMITS`     | how many of a sound at once, how soon again, and how many sounds in all                                                                                                                |

Not in `mix.ts`, because they are the shape of a sound and not its loudness: how each voice is
built (`voices.ts`, `crowd.ts`) and how often each bed's events come (the rates in
`ambience.ts`, `recipe`). The mascot's touches and kicks are in `HOME_PAGE` too.

**Where each sound's file is.** The files the game plays are in `public/sounds/` (the table in
"The recordings in use" below). They are cut from the originals in `sounds-src/` by
`node tools/sounds.mjs`: each file has an entry there (`out`, the original `src`, the cut's
`start` and `end` in seconds, its `filters` and fades). To change a cut, change its numbers and
run it again for that file (`node tools/sounds.mjs land`), or with no name for every file;
`--check` measures what is there. It needs ffmpeg. A file's own level does not matter: the
engine brings every recording to its `peakDb` in `mix.ts` (the takes inside other sounds, the
claps and the hum, to their average). So to make a recorded sound louder, raise its `peakDb`,
not the file. A new sound in a file of its own needs no code at all: see "Replacing a sound
with a recording" below.

## How it fits together

```
scene ── onSound(cue) ──┐                 voices ─ trim (mix.ts) ─ effects ─┐
scene ── ambience() ────┤ PixelStage ──>  beds ─────────────── ambience ────┼─ master ─ safety
playCue(cue) ───────────┤ (the host)      sends ────────────── room ────────┘
button presses (click) ─┤
SoundToggle ── mute ────┘
```

- **Scenes** say what is to be heard and never touch audio: they call `this.onSound?.(cue)`
  and offer `ambience()` (the contract is in `docs/API_SCENES.md`).
- **`PixelStage`** (the canvas host) connects the scene it is given to the page's one engine:
  it sets `scene.onSound` and asks for `scene.ambience()` once a second. It undoes both when
  the scene changes or the page is left.
- **Anyone else** (a page, a component) calls `playCue(cue)` from `~/audio`. It does nothing at
  build time, before the first gesture, while muted or while the tab is hidden.
- **Every button clicks.** When the engine is made it installs one listener on the document
  (`installClickSounds`): every press of a `button`, an element with role `button`, `switch`,
  `tab` or `menuitem`, a link dressed as a button (`a.ss-btn`), a `summary` or an input button
  plays `{ kind: "click" }`, by mouse, finger or keyboard (Enter in the answer field presses
  its submit button, so it clicks too). It hears the click as it bubbles out, after the
  button's own handler: switching the sound on is heard, switching it off is not. Disabled
  buttons do not click. The canvas is not a button: its presses are the scenes' business.
- **The engine** (`app/audio/engine.ts`) starts one `AudioContext` on the first user gesture
  (a press, a key, a tap: browsers keep a page silent until one). It makes it beforehand, in
  idle moments after the page loads (`prepareStep`, one step an idle callback: the context,
  then its graph and room, then the three noise buffers, then the bed), held suspended, so the
  gesture only resumes it. Making a context alone holds Chrome's main thread for 15 to 160 ms,
  and done inside the first press it was one long frame in whatever the press set moving (the
  leaderboard's slide, the kick-off); now the first press's frames are all under 20 ms.
  Muted, or pressed before the idle steps are done, the gesture builds what is left, as before.
  A cue that comes before the gesture, while muted or while the tab is hidden is dropped,
  never queued: a sound late is worse than none. The first press is heard (a cue in the moment
  the context's start is under way is scheduled into it). Each cue becomes a voice that is
  freed once it has finished.
- **The safety** at the end is a soft clip, not a compressor: below -4.4 dBFS it does nothing
  at all, so every level is exactly the one designed and measured, and above it bends smoothly
  so nothing ever reaches full scale. (It replaced a `DynamicsCompressorNode`: Chrome's adds its
  own make-up gain once it has settled, and starts out attenuating, so short sounds measured
  offline from the first sample played about 10 dB louder in the game than their figures.)
- **The mute** (`SoundToggle`, the speaker button beside the "?" on the home screen and in the
  board's head in the game) is remembered in `localStorage` (`soccersense:v1:sound`, `"off"` or
  `"on"`). Muting fades out in a few hundredths of a second, frees everything and suspends the
  context. Reduced motion does not mute.
- **Where the sound is.** The engine knows the place of the bed it is playing (`place.ts`: the
  home page's town, then the eight career tiers) and the crowd voices follow it: a `cheer` is a
  few mates whooping and clapping in the park, a touchline of parents on a Sunday, a stand at a
  lower-league ground, a whole stadium at the final. Over the town's bed (the home screen) a
  cheer is a stadium heard across town and a `firework` is always a faint far pop. A
  `vuvuzela` is heard at the World Cup only (the final and the winners, tiers 6 and 7):
  anywhere else, the home page included, it is dropped as "calm", whoever sends it. No bed
  blows a horn; the World Cup's beds hum with a stadium of them, low and steady.

Browser only: nothing runs at import or at build time (`soundEngine()` is null there).

| file            | what is in it                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------------ |
| `index.ts`      | `soundEngine()`, `playCue()`, the click of the buttons, the debug handle                               |
| `mix.ts`        | every volume in the game: the one file to change a level in (see "Changing the volumes")               |
| `knobs.ts`      | the sound board's view of `mix.ts`: every number by its path, set in memory, the lines to paste back   |
| `engine.ts`     | the engine, the buses and the safety, reading `mix.ts` as each sound starts                            |
| `voices.ts`     | one function per one-shot cue, the result stings among them                                            |
| `place.ts`      | the places (town, then the career tiers) and the crowd at each                                         |
| `wind.ts`       | the wind: one continuous voice the `wind` cues keep alive                                              |
| `crowd.ts`      | crowds: roar (formant-filtered noise), voices, applause (the recorded claps, layered), chant, whistles |
| `ambience.ts`   | the beds: continuous layers and events now and then, per place                                         |
| `dsp.ts`        | the toolkit: noise buffers, envelopes, a builder that tracks every node                                |
| `recordings.ts` | recordings that replace voices, and their variants taking turns                                        |
| `mute.ts`       | the remembered mute                                                                                    |
| `offline.ts`    | renders a voice, a bed or a moment offline and measures it (development)                               |
| `testing.ts`    | a fake Web Audio for the tests                                                                         |

## The cues

| cue                      | what it sounds like                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `touch`                  | a soft leather tap: a small hollow knock gliding down and a brush of band-passed noise.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `kick` (power 0 to 1)    | the deep thump of the boot (a sine falling to 46 Hz), the hollow knock of the ball's skin and a slap of leather; bigger, brighter and sharper with power, and a hard one whooshes away.                                                                                                                                                                                                                                                                                                                                                                                 |
| `net`                    | the ball driven into the net: the mesh's swish as it takes the ball and the strings rattling as it settles, about half a second. The engine plays it under every goal's sting (see below); synthesised (the fallback): a falling swish of band-passed noise, a fluttering rattle and a dull puff.                                                                                                                                                                                                                                                                       |
| `wind` (speed 0 to 1)    | rushing pink noise through a band-pass whose loudness and brightness follow the speed, beating with the ball's turns; at speed a narrow band sings over it. Fades by itself when the cues stop.                                                                                                                                                                                                                                                                                                                                                                         |
| `cheer` (size 0 to 1)    | sized by the place. Park: three to six mates whooping "woo!" (rising formant voices), a yell, a few claps. Sunday league: more of them and parents' higher voices. Non-league up: a roar (formant-filtered noise on an "ah") that swells and falls, narrower and more ragged with fewer people, voices, applause from a few dozen hands to a whole stand, and at the top end a second brighter roar and fans whistling. Town: a dark, faint swell from across town. The claps are the recording (`claps.mp3`): one layer of it for a few mates, up to nine for a stand. |
| `groan`                  | the crowd's long falling "ohhh"; in the park a few people's "ohh".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `ooh`                    | a short rising gasp, sized the same way.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `whistle` (long)         | a referee's pea whistle: a 2.95 kHz note trilled by the pea. Long is full time: three blasts, the last long.                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `squeak`                 | a rubbery stretch, stick and slip, with a small boing.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `pop`                    | a bang, a boom, the gas rushing out and the skin flapping.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `thud`                   | a low thump, a rumble and a puff of dust.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `splash`                 | a wash that falls in pitch, and droplets after it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `firework` (distant)     | a rising whistle and hiss, a soft bang and crackling. Distant (and always over the town): a faint hiss up, a muffled pop and a little crackle, mostly the sky's echo.                                                                                                                                                                                                                                                                                                                                                                                                   |
| `vuvuzela` (size 0 to 1) | a blast of horns for a goal at the World Cup (tiers 6 and 7), with the cheer: recorded, one horn's three toots and a softer note (2.2 s); synthesised (the fallback), a swarm of buzzing sawtooth B flats (233 Hz), slightly detuned, rising and falling over about three seconds. `size` (the goal's: the cheer's size) scales it from 0.35 of its level (a tap in) to all of it (a worldie). Never in a bed, never on the home page, never below tier 6.                                                                                                              |
| `sweep`                  | the promotion's sweep: a whoosh of wind and dust passing from left to right.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `sparkle`                | AWAY's ball twinkling out in the sky: a star's sparkle, two bright chimes ringing away (recorded, 1 s); synthesised (the fallback), two bell-like chimes and a few high twinkles. Sent so that its brightest moment (0.12 s in) lands on the twinkle's flare, a moment before the iris's whoosh, which it rings on over; high-passed above the whoosh so that both are heard. Never for HOME.                                                                                                                                                                           |
| `land` (power 0 to 1)    | HOME's ball dropping onto the stadium's centre spot: a ball's fullest bounce, on turf (recorded, 0.25 s); synthesised (the fallback), a dull thump falling in pitch, a hollow knock and a brush of grass. Full as the ball lands, and again at 0.35 as its small bounce comes down 0.2 s later. Never for AWAY.                                                                                                                                                                                                                                                         |
| `click`                  | a button pressed: a crisp tick of high noise and a short wooden "tock" falling from 1.5 kHz, 40 ms.                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `transition` (opening)   | the iris between the home screen and the game: a soft whoosh of pink noise with a quiet tone under it. Closing it falls (2.6 kHz to 260 Hz, 0.75 s) and the light shuts with a soft low "doom"; opening it rises (240 Hz to 2.8 kHz, 0.9 s) and ends in a small shimmer.                                                                                                                                                                                                                                                                                                |
| `score` (shot)           | the sting for a result, in chip-tune voices (square and triangle waves under a soft low-pass), clearly bigger the better the shot: see below.                                                                                                                                                                                                                                                                                                                                                                                                                           |

The result stings, as the ball goes in or misses:

| shot      | the sting                                                                                                                                                                                                   | length |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `tapin`   | a basic little chime: two triangle notes up a fourth (G, C).                                                                                                                                                | 0.3 s  |
| `toepoke` | a scrappy prod of noise, then three quick square notes up (C, E, G) over a bass note.                                                                                                                       | 0.45 s |
| `trivela` | the ball curling in: a swish and a note that bends up (E to C), then a bright arpeggio to a high C with vibrato, a bass and a few twinkles.                                                                 | 0.9 s  |
| `golazo`  | a fanfare: three notes up to a held C major chord with vibrato, a timpani, a cymbal and twinkles.                                                                                                           | 1.1 s  |
| `worldie` | a proper triumphant flourish: a run up six notes, two stabs (A flat and B flat major) with timpani, then a big held C major chord, square and sawtooth like a brass section, a crash and a shower of stars. | 2.1 s  |
| `miss`    | a deflated "womp, womp, wommmp": three notes sagging down on a muted horn (a sawtooth through a resonant low-pass that opens and closes like a wah), the last one wobbling and sinking.                     | 1.25 s |

**The net under every goal.** When a `score` cue for a goal is played (every shot but `miss`),
the engine plays `net` at the same moment: the career scene sends the sting 0.05 s after the
ball reaches the goal, so the net is heard as the ball hits it, with no change to the scene.
How hard the net is hit follows the goal (`NET` in `mix.ts`): a worldie or a
golazo at the net's full level, a trivela at 0.85, a toe poke at 0.7, a tap in at 0.6 (it
barely ripples). Not in the park (tier 0): its goals are jumpers for posts and the ball runs
on to the hedge. A sting that is not played (muted, too soon after another) brings no net,
and neither does a miss or a shot the engine does not know. The net's file starts loading
with the first `kick`, so the first goal with a net already has it. A scene sends `net`
itself only for a ball that hits a net with no result: the promotion's close-up, where the
ball hits the net at `BUILD.hit` in `career-fx.ts`, 0.36 s after the `sweep` cue.

The engine keeps the busy ones in check: the same kind again within a few hundredths of a
second is dropped, and only so many of a kind play at once (two cheers, two stings, one
transition, three squeaks...). A player's result is never dropped for that (a goal that makes
no sound feels broken): for the result sounds (`RESULT_KINDS` in `engine.ts`: the sting, the net,
the cheer, the groan, the ooh, the whistle and the horns) the oldest of the kind still ringing
fades out over `LIMITS.resultFade` (0.3 s, a ramp to silence, then stopped and freed) and the new
one plays; the log shows it as `faded`. Everything else (clicks, squeaks, fireworks...) is still
dropped as `busy`. The gaps hold for results too: two results never come that close.

## The ambience

A scene's `ambience()` gives `{ venue, crowd, night, tier? }`. The place is the town for the
home page whatever else is said; otherwise the career `tier` (0 to 7) when there is one, and a
venue alone stands for a typical tier (park: the kickabout; ground: non-league; stadium: the top
flight). Each place and time of day is a bed of continuous layers and of events that come now
and then, each at its own rate. The crowd value (0 to 1) scales everything people make. A new
place or night crossfades over 2.5 s; a new crowd value ramps the same bed.

It is background, kept quiet: a bed to sit on for a whole game. The big crowds' swells lift
the roar by 1.5 to 3 dB, no more. No bed blows a horn: the World Cup's beds (the final and the
winners) carry the famous hum of a stadium of vuvuzelas instead, steady and low (an RMS of -50
dBFS, 13 dB under the bed), lifted a little with the crowd's swells. It is the recording
`vuvuzela-crowd.mp3`, looped from a random place; until that has loaded, a synthesised one
(a dozen buzzing B flats through a low-pass), which hands over to it over 3 s.

| place           | tier | the bed                                                                                                                                                   |
| --------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `town`          | -    | the home screen, calm: a distant stadium's low, nearly steady murmur, a little traffic, birds (crickets and an owl at night). No cheers, roars or swells. |
| `park`          | 0    | birds, a dog now and then, children, a mate calling "here!", a ball kicked, distant traffic                                                               |
| `sunday`        | 1    | a handful of parents and subs shouting (men and women), the coach, a few claps, the referee's whistle far off now and then, kicks, a dog                  |
| `nonleague`     | 2    | a small crowd's chatter and the odd shout, a few people clapping, the whistle far off                                                                     |
| `lower`         | 3    | a terrace singing in bursts from one end or the other, over the chatter; shouts, claps, whistles                                                          |
| `top`           | 4    | a big crowd's roar rising and falling, chants, clapping, whistling                                                                                        |
| `international` | 5    | bigger, with drums                                                                                                                                        |
| `final`         | 6    | the World Cup final: a huge crowd and over it a bright wash of sound, drums, chants, the hum of vuvuzelas                                                 |
| `winners`       | 7    | the celebration: the whole ground singing, clapping, whistles, drums, a far-off firework now and then, the hum of vuvuzelas                               |

At night the small places swap birds for crickets and the crowds are a little quieter.

## The levels

Measured by rendering each voice, bed and moment offline through the engine's own buses and
safety (48 kHz, `window.__soccersenseSound.renderCue(cue, seconds, seed, place)`,
`.renderAmbience(ambience)` and `.renderMoment(cues, place)` on the dev server). Peak is the
highest sample (dBFS); loud is the loudest 300 ms (RMS); a bed's figure is its RMS over 30 s.

| sound                       | peak          | loud                                |     | sound                  | peak          | loud          |
| --------------------------- | ------------- | ----------------------------------- | --- | ---------------------- | ------------- | ------------- |
| click                       | -24.2         | -47.9                               |     | sting: worldie         | -8.8          | -19.1         |
| touch                       | -22.1         | -40.8                               |     | sting: golazo          | -10.7         | -20.7         |
| kick, power 0.2 / 1         | -16.9 / -10.5 | -33.2 / -27.4                       |     | sting: trivela         | -14.0         | -22.2         |
| net                         | -14.8         | -29.8                               |     |                        |               |               |
| wind, speed 0.5 / 1         | -24.0 / -17.7 | -39.0 / -30.5                       |     | sting: toe poke        | -15.0         | -23.3         |
| transition, closing/opening | -18.7 / -20.0 | -30.6 / -31.0                       |     | sting: tap in          | -14.9         | -23.9         |
| whistle                     | -16.8         | -24.1                               |     | sting: miss            | -14.7         | -23.7         |
| squeak                      | -17.0         | -29.8                               |     | cheer 1: town (0.1)    | -24.0 (-31.4) | -35.6 (-43.3) |
| pop                         | -8.6          | -23.0                               |     | cheer 1: park          | -17.3         | -31.1         |
| thud                        | -10.9         | -26.1                               |     | cheer 1: Sunday league | -16.9         | -30.5         |
| splash                      | -12.9         | -26.4                               |     | cheer 1: non-league    | -12.8         | -24.3         |
| firework / distant          | -14.4 / -31.9 | -30.9 / -45.4                       |     | cheer 1: lower leagues | -10.0         | -22.7         |
| vuvuzela (size 1 / 0.2)     | -14.1 / -20.5 | -25.5 / -31.9                       |     | cheer 1: top flight    | -8.7          | -21.4         |
| sparkle                     | -19.0         | -31.3 (synth -30.2)                 |     |                        |               |               |
| land, power 1 / 0.35        | -13.0 / -20.0 | -30.7 / -37.7 (synth -26.5 / -34.3) |     |                        |               |               |
| sweep                       | -13.4         | -27.0                               |     | cheer 1: the final     | -7.6          | -19.3         |

| bed (crowd 1) | RMS by day | at night |
| ------------- | ---------- | -------- |
| town          | -46        | -48      |
| park          | -45.6      | -47      |
| Sunday league | -44.7      | -44.8    |
| non-league    | -42.7      | -43.7    |
| lower leagues | -40.5      | -41.7    |
| top flight    | -38.4      | -39.2    |
| international | -37.4      | -38      |
| the final     | -36.4      |          |
| the winners   | -37.3      |          |

(The final and the winners are 0.5 to 0.7 dB up on their figures before the hum; every other
bed is as it was, the recorded claps within 0.1 dB. The distant firework is 2 dB up on
2026-11-12, at the product owner's asking: `FIREWORKS.farLiftDb`. The recordings' figures
are the recorded cue's: a recording is brought to its kind's peak, `SOUNDS[kind].peakDb`.)

The loudest moment of the game, a worldie at the final (a full-power kick, the worldie sting,
an eruption, a firework and a blast of horns at once over the final's bed), peaks at -5.3 dBFS
(loud -16.7): under the safety's knee, so not even the safety touches it. With the net under
the worldie as well it still peaks at -4.8 to -5.1 (measured again for the net), and with the
recordings of 2026-11-12 (the recorded claps in the eruption, the recorded blast, the hum in
the bed) at -4.9 (loud -16.0). A tap in at the park
(a soft kick, the sting and the mates' cheer) peaks at -14.9. The home page's goal (a cheer of
0.1 and two far fireworks over the town's bed) peaks at -30.3: faint and far away. Each bed is
15 to 25 dB under the sounds of the game played over it.

To change how loud anything is, change its number in `app/audio/mix.ts` (try it first at
`/dev/sound`: "Changing the volumes" above) and measure again. Every level is there: each kind
into the effects bus (`SOUNDS[kind].level`) and the peak its recording is brought to
(`SOUNDS[kind].peakDb`), the stings' balance and peaks (`STINGS`), the net by shot (`NET`), the
crowd by place (`CROWD`), the beds (`BEDS`, `BED_EVENTS`), the distant fireworks (`FIREWORKS`),
a small goal's blast and the World Cup's hum (`VUVUZELA`), the recorded claps (`CLAPS`), the
buses (`BUSES`) and the limits (`LIMITS`). The engine still exports its old tables by their old
names for the tests and the debug handle (`LEVELS`, `PEAK_DB`, `SCORE_PEAK_DB`, `NET_BY_SHOT`,
`BED_RMS_DB`, `TAKE_RMS_DB`, `HUM_RMS_DB`): each reads `mix.ts` as it is asked. The levels were
moved there on 2026-11-12 without a number changing (every voice, bed and moment rendered
before and after, the same).

## Replacing a sound with a recording

Put a file in `public/sounds/` named after what it replaces and it plays instead. No code
changes. The engine looks for the most particular name first:

| file in `public/sounds/`                      | replaces                                                                                                                                                                                |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<cue>.mp3`                                   | a cue: `touch`, `kick`, `net`, `wind`, `cheer`, `groan`, `ooh`, `whistle`, `squeak`, `pop`, `thud`, `splash`, `firework`, `vuvuzela`, `sweep`, `click`, `transition`, `sparkle`, `land` |
| `claps.mp3`                                   | not a cue but a take inside them: every clap in the game (the applause in a cheer, the beds' claps), layered by the crowd. Brought to `CLAPS.takeRmsDb`, whatever its level             |
| `vuvuzela-crowd.mp3`                          | the World Cup's hum in the beds of tiers 6 and 7, looped (a take, at `VUVUZELA.hum`)                                                                                                    |
| `<name>-1.mp3`, `<name>-2.mp3`...             | variants of any of these names (`touch-1`, `touch-2`, `cheer-park-1`): they take turns, round and round, with `<name>.mp3` first if there is one                                        |
| `score-<shot>.mp3`                            | a result sting: `score-worldie`, `score-golazo`, `score-trivela`, `score-toepoke`, `score-tapin`, `score-miss`                                                                          |
| `transition-open.mp3`, `transition-close.mp3` | the iris one way (without them, `transition.mp3` plays both ways)                                                                                                                       |
| `firework-far.mp3`                            | a distant firework (without it, `firework.mp3` plays, faint)                                                                                                                            |
| `cheer-<place>.mp3` (also `groan-`, `ooh-`)   | the crowd at one place, `cheer-park` say (without it, `cheer.mp3` plays there, at that place's level)                                                                                   |
| `ambience-<place>.mp3`                        | a place's whole bed, looped: `town`, `park`, `sunday`, `nonleague`, `lower`, `top`, `international`, `final`, `winners`                                                                 |
| `ambience-<place>-night.mp3`                  | the same at night (without it, the day file plays at night too)                                                                                                                         |
| `ambience-<venue>.mp3`                        | stands in for any place at that venue without its own file: `park`, `ground`, `stadium`                                                                                                 |

- `.mp3` or `.ogg`; `.mp3` wins if both are there. Prefer `.mp3`: every browser plays it.
- **Levels are automatic.** A recording is brought to the level of the voice it replaces: a
  one-shot to the same peak (the table above; a crowd voice to its place's level), a bed to the
  same average, the wind to the noise it stands in for. A kick's power and a cheer's size still
  scale it. So a file can go in at whatever level it came.
- **Trim one-shots tight**: the sound should start at the first sample (any silence at the
  start is a delay), with a short fade at the end. A `wind` file is a steady rush of air,
  looped (the engine shapes its loudness and brightness). A bed is 30 to 90 seconds that loops
  without a click (the end flows into the start), with nothing in it that is recognisable
  when it comes round again.
- **Keep them small**: 44.1 or 48 kHz, mono for one-shots, 128 to 192 kbps. A one-shot is
  10 to 100 KB, a bed under 1.5 MB.
- **Check it**: on the dev server, `window.__soccersenseSound.debug()` in the console lists
  `recordings.found`, `loaded` and `failed`, and the log says `"recording"` for each cue that
  played one. A file that cannot be decoded is left alone and the synthesised voice plays.
- The list of files is fixed when the site is built (the dev server picks up a new file on its
  next reload), so the browser never asks for a file that is not there. A file is fetched the
  first time its sound is wanted; until it has loaded the synthesised voice plays.
- Known wart: the production build also writes an unused, hashed copy of each file under
  `assets/`. Players never download it; it only doubles the sounds' size on the host.
- **Takes** (`claps`, `vuvuzela-crowd`) are recordings that a synthesised voice or bed plays
  inside itself (`Takes` in `dsp.ts`, given by the engine). They load as soon as a bed that
  uses them comes in (`WARM` in `engine.ts`: the claps everywhere but the town; the home
  page's bed loads the twinkle and the landing, the World Cup's the horns and the hum);
  until then, or without the file, the voice synthesises its own. `debug().takes` counts
  them as they play.
- **Variants** keep a sound that comes again and again (the juggle's touches) from being one
  sample over and over: each cue plays the next variant (`touch-1`, `touch-2`, `touch-3`,
  `touch-1`...). The first time, all of them start loading; one not loaded yet (or that
  failed) is passed over for the next. A number on the end is what makes a variant: a place
  (`cheer-park`) or a way (`transition-open`) is not one. Each variant is levelled on its
  own, like any recording.

Remove the file and the synthesised voice is back.

## The recordings in use

The product owner supplied five recordings on 2026-11-12, and three more the same day
(`clapping.mp3`, `star_sparkle.mp3`, `vuvuzela.mp3`). The originals are kept, untouched,
in `sounds-src/` at the root (not served, not in the build); the files the game plays are cut
from them by `node tools/sounds.mjs`, which writes down every cut, filter and fade and remakes
every file (`node tools/sounds.mjs kick net` remakes some; `--check` measures what is there).
To tune one, change its numbers in the script and run it again. Credits and licences:
`public/sounds/CREDITS.md`.

Every processed file is mono, 44.1 kHz, mp3 at 160 kbps, with the low rumble taken out (a
high-pass), a 1 ms fade in, a fade at the end, and starts at the sound's first sample (under
1.5 ms before it is within 40 dB of its peak, as Chrome decodes it). In the game the engine
levels each to the voice it replaces, whatever the file's own level.

| file in `public/sounds/`       | from (`sounds-src/`)    | the cut (s in the source)                                           | what it is                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------ | ----------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `kick.mp3`                     | `kick_ball.mp3`         | 0.084 to 0.244                                                      | the strike (about 25 ms) and a short tail of air; every shot and, quieter, a press of the menu ball. High-pass 50 Hz (the take has wind on it).                                                                                                                                                                                                                                         |
| `touch-1.mp3` to `touch-3.mp3` | `ball_sound.mp3`        | 1.980, 9.061 and 10.406, 0.15 s each                                | three of the take's ten bounces, the cleanest and most alike: the bounce and its ring, before the small second bounce. High-pass 60 Hz.                                                                                                                                                                                                                                                 |
| `click.mp3`                    | `button_click.mp3`      | 0.0252 to 0.0452                                                    | the 5 ms blip (about 1.5 kHz) and its ring. High-pass 200 Hz.                                                                                                                                                                                                                                                                                                                           |
| `firework.mp3`                 | `firework_pop.mp3`      | 0.034 to 0.634                                                      | the bang and the first of its crackle; the long hiss after it is faded out from 0.2 s.                                                                                                                                                                                                                                                                                                  |
| `firework-far.mp3`             | `firework_pop.mp3`      | 0.034 to 1.034                                                      | the same bang far away, for the background: a steep 900 Hz low-pass, a 10 ms softened attack, two faint echoes (110 and 240 ms), at -12 dBFS.                                                                                                                                                                                                                                           |
| `net.mp3`                      | `football_hits_net.mp3` | 0.331 to 0.831                                                      | the ball into the net and the mesh rattling as it takes it; the kick before it (0.15 s) and the ball dropping after it (0.98 s) are cut. High-pass 110 Hz.                                                                                                                                                                                                                              |
| `land.mp3`                     | `ball_sound.mp3`        | 0.5838 to 0.8338                                                    | the take's first bounce, the ball dropped from height: the fullest and heaviest of the ten, the softest attack for its body, and the least noise before it; with its ring and the small second bounce in it. High-pass 45 Hz, a gentle 3 kHz low-pass (turf, not a hard floor).                                                                                                         |
| `sparkle.mp3`                  | `star_sparkle.mp3`      | 0.0595 to 1.0595                                                    | the two chimes (the second, brighter, 0.12 s in) and the first of the long ringing tail, faded from 0.3 s so it is gone soon after the iris's whoosh starts. High-pass 900 Hz, above the whoosh.                                                                                                                                                                                        |
| `vuvuzela.mp3`                 | `vuvuzela.mp3`          | 0.513 to 2.75                                                       | one horn's second, third and fourth toots (233 Hz, a B flat), the last running on into a softer note, and the room after it, faded from 1.7 s. The first toot is short and bent up. High-pass 120 Hz.                                                                                                                                                                                   |
| `vuvuzela-crowd.mp3`           | `vuvuzela.mp3`          | four toots: 0.513 to 0.79, 0.88 to 1.17, 1.235 to 1.69, 1.69 to 2.2 | the hum: the take is one horn, so this is a swarm of its toots, 520 copies a channel round an 8 s loop (about 25 at once), each up to 45 cents sharp or flat (12% of them a semitone out), at 0.35 to 1 of the level, far off (two 1.3 kHz low-passes), in stereo; a copy past the end carries on at the start, so it loops without a seam. Seeded: the same file every time. 128 kbps. |
| `claps.mp3`                    | `clapping.mp3`          | 0.45 to 3.4 and 5.2 to 11.6, looped                                 | a few people clapping in a room (about ten claps a second, no voices); its two steadiest stretches joined with 0.25 s equal-power crossfades, the end into the start. High-pass 100 Hz (a rumble under the take). 128 kbps.                                                                                                                                                             |

The loops (`claps`, `vuvuzela-crowd`) are built by `tools/sounds.mjs` from several cuts (its
`loop` and `swarm`): mono or stereo, 128 kbps; the engine levels them by their average, not
their peak. The claps are as loud as the synthesised claps they replace (their loudest
300 ms within 0.5 dB, measured for one to nine layers and in every cheer and bed), and
the hum is exactly at its `VUVUZELA.hum`, recorded or synthesised.

How they sit against the synthesised voices: the engine matches peaks, and these recordings
are sharper (more peak for their body) than the voices they replace, so at the same peak they
sound a little lighter: the touches about 7 dB under the synthesised touch in their loudest
300 ms, the click and the near firework about 5 to 6 dB, the kick about 3 dB, the far
firework and the net within 1 to 2 dB. Raise a kind's `peakDb` in `mix.ts` if one is too
quiet in play.

## Where to get recorded sounds, safely

Sound libraries are full of files with licences that do not allow what we would do with them.
Before downloading anything, check that the licence allows **commercial use** (the game may
earn money one day), allows **use inside a product that is published on the web** (every
file a website plays can be downloaded by its players), and allows **editing** (trimming,
fading, looping). Avoid anything marked **NC** (non-commercial) or **ND** (no derivatives).
Avoid recordings with words, real club chants, songs, stadium announcers or brand names in
them: a crowd singing a real song is someone's music, and the game copies no one. The same
goes for the stings: no jingle from another game.

Reliable sources with clear licences:

- **Freesound** (freesound.org). Free account to download. Every sound has its own licence,
  shown on its page. Use the search's licence filter **"Creative Commons 0"** (CC0: no
  conditions at all). **CC BY** is fine too, but then the author must be credited. Avoid
  **CC BY-NC** and the old **Sampling+** licence. Good for crowds, whistles, kicks, wind.
- **Kenney** (kenney.nl, "Assets", audio packs). Everything is **CC0**. Clean, short game
  sounds: impacts, interface clicks, pops, thuds, short jingles. Less on crowds.
- **Pixabay sound effects** (pixabay.com/sound-effects). The **Pixabay Content License**: free
  for commercial use, no credit needed. It does not allow selling or redistributing the
  sounds on their own (as a sound pack), which we do not do. Check each item's page for any
  extra note.
- **Mixkit** (mixkit.co/free-sound-effects). The **Mixkit Sound Effects Free License**: free for
  commercial use, no credit needed; again not to be redistributed on their own. Good for
  sports and crowd sounds.

Not usable here: the **BBC Sound Effects** archive (its RemArc licence is personal, educational
and research use only), and anything from a video or a game you did not make.

**Keep a credits file.** For every file that goes into `public/sounds/`, add a line to
`public/sounds/CREDITS.md`: the file name, the title of the original, its author, its page
(URL), its licence, and the date it was downloaded. Credit is required for CC BY and
appreciated for the rest, and the line is the proof of the licence if anyone ever asks. Keep a
copy of the licence page if the source has no stable one.

## Measuring and checking

- Unit tests (`app/audio/*.test.ts`, `app/ui/SoundToggle.test.tsx`, the sound part of
  `app/ui/PixelStage.test.tsx`) run against the fake Web Audio in `app/audio/testing.ts`: no
  sound before a gesture, the first press heard, every cue makes a voice and frees it, the
  stings differ by shot, the crowd follows the place, the mute is remembered, the host
  connects and disconnects, the buttons click, the town stays calm, no bed has a horn, the
  switch sits in one place per screen, nothing at build time. `knobs.test.ts` keeps `mix.ts`
  pure data (types its only imports), every number on a line of its own with its comment,
  its file names true to `public/sounds/`, and the lines it copies out right;
  `app/routes/dev-sound.test.tsx` checks the sound board (every sound and every level on it,
  played through the engine, a slider heard at once, the changes copied).
- The offline renders take a last argument `recorded` (default false): true plays the
  recordings where the game would, the cue's own and the takes inside voices and beds
  (`renderCue({ kind: "cheer", size: 1 }, 7, 1, "final", true)`).
- On the dev server, `window.__soccersenseSound` has `debug()` (what the engine has done:
  cues, voices made and freed, drops and why, the bed and its events, a log of the last 120
  things) and the offline renders `renderCue(cue, seconds, seed, place)`,
  `renderAmbience(ambience, seconds)`, `renderAmbientEvent(name)` and
  `renderMoment([[at, cue], ...], place)`, which return the levels above.
