# Scenes reference (`~/scenes`)

What exists in `app/scenes`, how the canvas host drives it, and what a page has to do with it.
A scene is the moving picture on the canvas: pure TypeScript, no DOM, no clock, no unseeded
randomness. Read `docs/API_ART.md` for what a scene draws with, and `docs/API_UI.md` ("The canvas
host") for `PixelStage`, which runs it in the browser. Each file's own header comment has the
fine detail.

Look at any of it without a browser:

```sh
./node_modules/.bin/tsx tools/snap.ts --list
./node_modules/.bin/tsx tools/snap.ts menu/kickoff-home --w 480 --h 270 --strip 12 --dt 0.14 --scale 2 --out .snaps/x.png
```

Shots: `menu/home`, `float`, `hover`, `pressed`, `locked`, `scores`, `intro`, `reduced`,
`kickoff-home`, `kickoff-away`, `kickoff-nextgen`, `kickoff-retro`, `drag`, `spin`, `rest` (each locked patch shown, close up),
`half-turn` (in `menu.shots.ts`).

## The scene contract (`~/scenes/scene`)

```ts
interface PointerInfo {
  type: "move" | "down" | "up" | "leave";
  x: number; // logical pixels, with fractions: Math.floor gives the pixel under the pointer
  y: number;
  touch?: boolean; // a finger or a pen: no hover, and `up` also ends the hover
}
interface Scene {
  resize(w: number, h: number): void; // the logical size of the surface `draw` will get
  setLighting(light: Lighting): void;
  update(dt: number): void; // seconds; any dt, 0 and large jumps included
  draw(s: Surface): void; // must cover every pixel of `s`
  pointer?(p: PointerInfo): void;
  setReducedMotion?(on: boolean): void;
  cursor?(): SceneCursor; // "default" | "pointer" | "grab" | "grabbing", set on the canvas as is
  onSound?: ((cue: SoundCue) => void) | null; // set by the host: call this.onSound?.(cue)
  ambience?(): Ambience; // the bed of sound under the scene, polled about once a second
}
```

**A frame** is always, in this order: `resize` (if the size changed), `setLighting` (if the light
changed), `setReducedMotion` (if that changed), `update(dt)`, `draw(surface)`. A scene new to its
host gets the first three before its first `update`.

What a scene must keep to:

- Time only moves in `update`. `draw` reads the scene's clocks and paints: the same calls give the
  same pixels, in the browser and in the snap tool.
- No DOM, no `Date`, no `Math.random`. Randomness is seeded (`~/pixel`).
- `draw` covers the whole surface, and allocates nothing: static layers are painted once per size
  and light into their own `Surface` and copied. The budget is 4 ms a frame at 480 x 270.
- It talks back through plain callbacks set by whoever made it (`menu.onChoose = ...`), never
  through React, and it never navigates, stores or fetches.
- With reduced motion on: no shakes or flashes, ambient loops slowed, transitions cut short.

What the host (`PixelStage`) promises a scene:

- The first `update` has `dt` 0. After that `dt` is the real time since the last frame, never more
  than 0.1 s, times the page's `timeScale`.
- A frame that told the scene something new (its first frame, a new size, a new light) and itself
  took 34 ms or more was the scene building its picture: it is not counted against the
  animation, and the next `dt` is measured from the end of that frame. An entrance that begins
  in the first frame is seen from its first step. Every other frame is counted in full however
  long it took: on a slow device that is the animation's real time.
- Nothing is called while the document is hidden, and the first frame after it is shown again has
  `dt` 0. Whatever changed meanwhile (a new light, a new size) arrives in that frame.
- While the page holds the loop (`paused`), a change of size, light or reduced motion is still
  painted, once, with `dt` 0.
- No pointer event before the scene's first frame. Only the primary pointer, and for a mouse only
  its main button. A tap is `down`, `up`, `leave`; a finger dragged away is `leave`.
- `cursor()` is read after every pointer event.
- If the scene throws in a frame, the loop stops (one error, not sixty a second) and the page
  stands. Hiding and showing the tab starts it again.

### Sound: `SoundCue` and `Ambience`

A scene never touches audio. It says what is to be heard, and the host plays it through the
sound engine (`~/audio`; what each cue sounds like and how to replace it with a recording is in
`docs/AUDIO.md`). The powers, sizes and levels a scene sends are not written in the scene: they
are in `app/audio/mix.ts` (pure data, the one file of every volume in the game), which the
scenes and the home page's picture import (`GAME`, `JUGGLE` and `BEDS` in the career,
`HOME_PAGE` and `BEDS.places.town` on the home page). Change them there, or try them first on
the sound board at `/dev/sound`.

```ts
type SoundCue =
  | { kind: "touch"; level?: number } // a light touch on a ball: the menu ball, a juggle, a trap (level 0 to 1, default 1)
  | { kind: "kick"; power: number } // a ball struck: 0 a prod, 1 a rocket
  | { kind: "wind"; speed: number } // air past something spinning or flying, 0 to 1; every frame while it lasts
  | { kind: "cheer"; size: number } // the crowd goes up: 0 a ripple, 1 an eruption
  | { kind: "groan" } // a miss
  | { kind: "ooh" } // a near thing
  | { kind: "whistle"; long?: boolean } // the referee (long: full time)
  | { kind: "squeak" } // a poke on the airship
  | { kind: "pop" } // the airship bursts
  | { kind: "thud" } // something heavy lands
  | { kind: "splash" }
  | { kind: "firework"; distant?: boolean } // a rocket going up and bursting (distant: a faint pop far away)
  | { kind: "vuvuzela"; size?: number } // a blast of horns, World Cup only (tiers 6 and 7; size 0 to 1, default 1: by the goal)
  | { kind: "sparkle" } // a star's twinkle: AWAY's ball vanishing into the sky
  | { kind: "land"; power?: number } // a ball dropping onto turf from height: HOME's landing (power 0 to 1, default 1)
  | { kind: "sweep" } // the promotion's sweep of smoke
  | { kind: "click" } // a button pressed: crisp and short
  | { kind: "transition"; opening: boolean } // the iris between home and game: closing on home, opening on the game page
  | { kind: "score"; shot: ScoreShot } // the sting for a result, as the ball goes in or misses (a goal's brings the net with it)
  | { kind: "net" }; // a ball driven into the net: the mesh's swish and rattle
type ScoreShot =
  "worldie" | "golazo" | "trivela" | "toepoke" | "tapin" | "miss";
interface Ambience {
  venue: "town" | "park" | "ground" | "stadium";
  crowd: number; // 0 to 1: how many people are making it
  night: boolean;
  tier?: number; // 0 to 7, the career tier (the career scene); absent elsewhere
}
```

- Call it as `this.onSound?.(cue)` at the moment it happens, from `update` or `pointer`. It is
  null in the snap tool and in tests, and before the host has the scene.
- `wind` is continuous: send it every frame while the air rushes, with the speed of that frame.
  When the cues stop the wind dies away by itself in a quarter of a second.
- Send a cue once per event, not every frame (`wind` aside). The engine drops repeats a few
  hundredths of a second apart and caps how many of a kind play at once, but a scene should not
  lean on that.
- `ambience()` is read about once a second and should be cheap. A new place or night
  crossfades; a new crowd value ramps. The career scene gives its `tier`: each tier is a bed
  of its own (0 the park's birds, dog and children, 1 a Sunday-league touchline, 2 a
  non-league crowd's chatter, 3 a terrace singing in bursts, 4 a top-flight crowd, 5 an
  international with drums, 6 the World Cup final, 7 the winners' celebration). Without a
  tier the venue stands for one (park 0, ground 2, stadium 4); `town` is the home page.
- The crowd voices follow the place of the bed: a `cheer` at tier 0 is a few mates whooping
  and clapping, at tier 6 a whole stadium (its `size` still scales it). Send the cheer the
  moment is worth; the engine sizes it to the place.
- `score` is the result's sting, sent as the ball goes in (or misses), next to the kick and
  the cheer: `worldie` a triumphant flourish down to `tapin` a basic chime, and `miss` a
  deflated "womp". A goal's sting brings the net with it (the engine plays `net` under every
  shot but a miss): do not send `net` for a shot as well. Send `net` alone for a ball that
  hits a net with no result, such as the promotion's close-up (`BUILD.hit`, 0.36 s after the
  `sweep` cue). `transition` is the iris: `opening: false` as it closes on the home
  screen, `opening: true` as the game page opens out of black.
- The vuvuzela is a deliberate moment (a goal at the World Cup, tiers 6 and 7, as big as its
  cheer), never background. Anywhere else the engine drops it whoever sends it. The home
  screen (`town`) is calm: there a `cheer` is heard as a stadium far across town and a
  `firework` as a faint far pop.
- Not a scene? A page or a component plays a cue with `playCue(cue)` from `~/audio`. Button
  presses click by themselves (the engine listens on the document); a scene sends `click`
  only for a press on the canvas that should sound like a button.
- What the host does: when it is given a scene it sets `scene.onSound` and polls
  `scene.ambience()`; when the scene changes or the page goes it sets `onSound` back to null
  and the bed fades out. A scene with no `ambience` plays over silence. Nothing is heard
  before the player's first gesture, while the sound is off or while the tab is hidden.
  Reduced motion does not mute.

## The menu scene (`~/scenes/menu`)

The home screen's picture: the aerial stadium (`MenuBackdrop`), the wordmark, and the football
that floats in front of them and is the menu. HOME (the most common answer wins) is its left
patch, AWAY (the most uncommon answer wins) its right, NEXT-GEN (the most recent answer wins)
its top patch and RETRO (the oldest answer wins) its bottom one: the four open modes (RETRO
and NEXT-GEN since 2026-11-13), each framed in its mode's colour. Four more patches are
locked modes: CLOSEST and FURTHEST on the back, directly behind AWAY and HOME, so that half a turn brings CLOSEST round to where HOME was and FURTHEST
to where AWAY was, and GUESS WHO and SHOOTOUT on the rim out past HOME and AWAY, a quarter turn
round (a drag to the right brings GUESS WHO to the front, a drag to the left SHOOTOUT). Which
pentagon each one is: `docs/API_ART.md`, the menu ball.

```ts
const OPEN_MODES: readonly Mode[]; // ["home", "away", "nextgen", "retro"]: Mode is all four
type LockedMode = "closest" | "furthest" | "guesswho" | "shootout"; // (was six: 2026-11-13)
const LOCKED_MODES: readonly LockedMode[];
const MODE_SLOTS: Record<Mode | LockedMode, BallSlot>; // home left, away right, nextgen top,
// retro bottom, closest backRight, furthest backLeft, guesswho rimLeft, shootout rimRight
interface MenuLabels {
  home: string;
  away: string;
  nextgen: string; // the patches' words: "NEXT-GEN", "RETRO", "CLOSEST", "FURTHEST"
  retro: string;
  closest: string;
  furthest: string;
  guesswho: string; // "GUESS WHO"
  shootout: string; // "SHOOTOUT"
  header: string; // "DID YOU KNOW?": the plane's banner, before the fact (and the sign's, with no messages)
  tagline?: string;
}
interface MenuSceneOptions {
  seed: number; // the day number: it seeds the town and its life, and picks the club colours (schemeForDay)
  fact: string; // the fact of the day (factForDay(day).text), any case: the plane's banner (and the sign, with no messages)
  messages?: readonly MenuSign[]; // the airship's sign's messages (setSignMessages)
  labels: MenuLabels; // the words painted on the canvas (strings.home.canvas)
  intro?: boolean; // play the entrance; default true
}
type MenuPhase = "intro" | "idle" | "kickoff" | "done";

class MenuScene implements Scene {
  constructor(opts: MenuSceneOptions);
  readonly phase: MenuPhase;

  // what it tells the page (set them; all start as null)
  onHover: ((mode: Mode | null) => void) | null; // the pointer's hover on the ball changed
  onKickoff: ((mode: Mode) => void) | null; // a mode was chosen: get the captions out of the way
  onChoose: ((mode: Mode) => void) | null; // the kick-off is over: move on. Once per kick-off
  onLocked: ((mode: LockedMode) => void) | null; // a locked patch was pressed and released
  onSound: ((cue: SoundCue) => void) | null; // the Scene contract: what is to be heard
  ambience(): Ambience; // { venue: "town", crowd: 0.3, night: the light's phase is "night" }

  // what the page tells it
  setFact(text: string): void; // a new fact on the banner (and the sign, with no messages); the same again does nothing
  setPlane(on: boolean): void; // the plane and its banner fly (default) or not: the home page turns it off on a phone
  setSignMessages(messages: readonly MenuSign[]): void; // the sign's messages, one after another (none: the fact)
  setLabels(labels: MenuLabels): void; // a new header goes to the sign too
  setScores(scores: Partial<Record<Mode, number | null>>): void; // a badge on the patch; null takes it off
  setMoonPhase(phase: number): void; // 0 new, 0.5 full
  setHovered(mode: Mode | null): void; // hover or keyboard focus on a DOM caption: lights the patch
  choose(mode: Mode): boolean; // start the kick-off from the DOM; false if it cannot start now
  reset(): void; // back to "idle" with no entrance, from any phase
}
```

It takes nothing from `~/art` but the backdrop contract (`MenuBackdrop`: `resize`, `setLighting`,
`setSign`, `setMessages`, `setBanner`, `setMoonPhase`, `target`, `setRoar`, `draw`, `airshipAt`, `pokeAirship`, `mascotAt`,
`pokeMascot`, `cuesBetween`), `menuLayout`'s `cx`,
`ballR`, `ballCy` and `logo`, the ball, the logo and the palette. A test holds it to that.

### Phases and timings

| phase     | how long                     | what happens                                                                                   | leaves by                    |
| --------- | ---------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------- |
| `intro`   | 0.88 s                       | the ball swells out of a star under its spot (full size at 0.45 s), floats past it and settles | time; reduced motion ends it |
| `idle`    | until a mode is chosen       | it hovers: a bob every 4 s (a deep breath every third), a nod, a rock every 5 s, a shine       | a patch, or `choose`         |
| `kickoff` | 1.81 s (0.15 s when reduced) | flash, strike, flight, iris (below). No input is taken                                         | time: `onChoose` fires       |
| `done`    | until `reset`                | plain ink                                                                                      | `reset`                      |

The kick-off, in seconds from the moment it starts. `onKickoff` fires at 0 and `onChoose` at 1.81.

| at   | HOME                                                                                           | AWAY                                                             |
| ---- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 0    | the chosen patch flashes in its mode's colour                                                  | the same                                                         |
| 0.22 | the strike: a star, a ring, sparks, the ball pressed flat, the picture shakes 2 px up and down | the same, struck from HOME's side, shaking sideways              |
| 0.29 | it flies up the middle, shrinking fast, to hang over the far rim at 0.58                       | it leaves low to the right and curls up over the town            |
| 0.84 | the ground starts to roar (`setRoar`, swelling every frame, full by 1.02)                      |                                                                  |
| 0.89 | it lands on the centre spot (`backdrop.target()`): a thump, a burst, a ripple, one bounce      |                                                                  |
| 0.97 |                                                                                                | gone, a speck over the skyline: a twinkle, which goes on winking |
| 1.13 | the iris starts to close on the centre spot, from beyond the farthest corner                   | the iris starts to close on the twinkle                          |
| 1.57 | slowed onto a ring (0.75 of the ball's radius), it goes straight on to shut, faster to the end | the same, on a ring of 0.22 of the radius: a little sky          |
| 1.76 | ink                                                                                            | ink                                                              |
| 1.81 | `done`, `onChoose("home")`                                                                     | `done`, `onChoose("away")`                                       |

The iris's radius is a smooth function of time (an ease in and out onto the ring, then an ease
in to nothing; `irisRadius` in `menu.ts`), rounded to whole pixels only when it is drawn, so it
moves every frame of the 0.63 s it takes, a pixel circle with clean runs at every radius, and
never takes more than about 8 % of the screen in a sixtieth of a second. It stops nowhere: the
ring is a slowing, not a hold (a dead hold read as a stop-start). The flights move every frame
too; only the ball's turning, the strike's light, the shakes and the marks are stepped.

On a canvas under 200 logical pixels wide (a phone) the flights are the phone picture's: HOME's
apex is lower, under the sign, and AWAY flies out over the right edge and comes back in small
beside the wordmark. The times are the same.

**NEXT-GEN and RETRO** (2026-11-13) keep the same clock (flash at 0, strike at 0.22, iris from
1.13, ink at 1.76, `onChoose` at 1.81) with flights of their own (constants `NEXT_*` and
`RETRO_*` in `menu.ts`; shots `menu/kickoff-nextgen`, `menu/kickoff-retro`):

| at   | NEXT-GEN: into the future                                                                                                                   | RETRO: back in time                                                                        |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 0.22 | struck from below on AWAY's side (sparks thrown down-right), the picture shakes up and down                                                 | chopped from above (sparks thrown up); the picture shakes; the tape starts to tear (below) |
| 0.29 | it lights up and climbs, faster and faster (the others slow), almost straight up then over                                                  | it drops away from us onto Stadium Road, left of the middle, shrinking, spinning backwards |
| 0.49 | a comet: a trail 0.16 s of its way long, as wide as the ball, white hot, then its colours                                                   | it bounces once on the road (a puff of light), and rolls back left, slowing                |
| 0.75 | out in a flare high beside the wordmark's right end (the airship is at its left): a ring and a cross of light, then a twinkle that winks on |                                                                                            |
| 0.97 |                                                                                                                                             | it stops in the old town at the left of the picture, small, and lies still                 |
| 1.13 | the iris closes on the flare, onto a ring of 0.22 of the ball's radius (a little sky)                                                       | the iris closes on the ball, onto a ring of 0.45 of its radius (the corner of the town)    |

RETRO's picture is a tape being rewound from the strike to the ink: three ghosts of the ball
(0.05, 0.1 and 0.15 s behind it, see-through balls of its colour, only their outline while big),
three bands of the screen torn sideways with a line of snow along their tops rolling up it, and
an old recorder's rewind sign (two arrows, white on an ink shadow, blinking) in the top right
corner. On a phone NEXT-GEN flies out of the left edge and back in small beside the wordmark
(AWAY's mirror image), and RETRO bounces further left and stops on the plaza at the left edge.

With reduced motion: no entrance (an `intro` ends at once), no bob, no nod, no shine on the
patches or the wordmark, no "no" shake, the rock and the town at a quarter of their speed, and
the kick-off is a cut: the patch lights for 0.15 s, then ink and `onChoose`.

### Input

- A patch is chosen by pressing and releasing on the same patch without moving more than 3 logical
  pixels (12 CSS px on the reference monitor). Further than that the press is a drag (below) and
  never chooses, wherever it is let go. A locked patch answers with a shake of the ball (0.35 s)
  and `onLocked(mode)`, and never chooses. The four open modes choose from any pose in which
  they are in view (their pentagon is under the pointer); from a pose other than the menu pose
  the ball is first brought round, as for `choose` mid-spin (below). (A spun ball that comes
  to rest with NEXT-GEN or RETRO facing the viewer goes home, as for HOME and AWAY.)
- A locked patch under the mouse lifts a step (it never takes a colour); `onHover` is only
  about the open modes, so it stays `null` there.
- Hover is the mouse's only: a finger lights nothing, and its `up` ends any hover. `onHover` fires
  only on a change, and with `null` when a kick-off starts.
- A pointer that keeps still keeps its patch while the ball bobs and rocks under it.
- Presses on the ball wait for the entrance: during `intro` a press does nothing. `choose(mode)`
  (the captions, the keyboard) is taken at once even then (`onKickoff` fires, nothing else can be
  chosen, the patch shows pressed) but the ball is only struck when it has settled, so `onChoose`
  can come up to 0.88 + 1.81 s after `onKickoff`.
- From `onKickoff` on, pointer input and `choose` are ignored (`choose` returns `false`) until
  `reset`.
- `cursor()` is `"pointer"` over HOME or AWAY while a choice can be made, over a locked patch on
  a ball that is still or at rest, and over the airship, `"grab"` over the rest of the ball (all
  of it while it turns), `"grabbing"` while it is dragged,
  otherwise `"default"`. The host reads it only after a pointer event: a ball that comes to rest
  under a mouse that keeps still shows `"grab"` until the mouse moves.

### Spinning the ball

Idle only (a ball still arriving cannot be grabbed). The hand's turn is a rotation applied on top
of the hover's pose; the bob, nod and rock go on under it.

- **Drag.** Press on the ball and move past 3 px: it turns under the pointer. Within 0.92 of the
  radius the grabbed point stays exactly under the pointer; nearer the rim and off the ball a drag
  of one radius turns it one radian about the axis across the drag. A drag that leaves the ball,
  or the canvas, keeps turning it until release. A `leave` lets go.
- **Flick.** Let go while moving and it keeps the hand's speed (smoothed over about 0.05 s, at
  most 14 rad/s, a bit over two turns a second), slowing by 0.8 of its speed a second plus
  1.5 rad/s a second. Below 1.5 rad/s it comes to rest (below), and so does a ball let go
  without speed.
- **Rest.** It looks at which patch faces the viewer most. HOME or AWAY: it heads home, a spring
  (7 rad/s, 0.6 of critical damping: a little overshoot) to the menu pose by the shortest way,
  and when it is within 0.012 rad of it it snaps exactly to it. A hard flick is home in about
  3.2 s, a gentle one in about 1.7 s, one let go without speed in about 1.1 s. A locked patch:
  the same spring takes it to the pose that shows that patch (`ballShowPose`: NEXT-GEN, RETRO,
  GUESS WHO or SHOOTOUT straight on, or half a turn for CLOSEST and FURTHEST, side by side where
  HOME and AWAY were; a turn of about 69 to 148 degrees about the vertical rests on GUESS WHO or
  SHOOTOUT, more than that on CLOSEST or FURTHEST)
  and holds it exactly there. It is a menu again: every patch in view hovers and can be pressed.
  After 4.5 s from when it stopped (about four seconds still) it heads home. A press on a locked
  patch starts the wait again; it stands still while the pointer is on a patch or pressing the
  ball. A press that moves is a drag, as from the menu pose.
- **Catch.** A press on a turning ball holds it (it is a drag at once) and never chooses.
- While dragged or turning (not at rest), no patch hovers or chooses from the pointer
  (`onHover(null)` when a drag starts); a hover set from the DOM still shows.
- **`choose(mode)` mid-spin** (or mid-drag) is taken at once: `onKickoff` fires, the patch shows
  pressed, the hand lets go, and the ball is brought round to its pose in 0.24 s (fast, easing
  in), then struck as usual. `onChoose` comes 0.24 + 1.81 s after `onKickoff`. With reduced
  motion it is put in its pose at once and struck.
- **Reduced motion.** A drag still turns it, but there is no momentum: let go, it comes to rest
  at once, critically damped (no overshoot): home in under a second, or showing a locked patch.
- A stalled step (over 10 s), `reset()` and a kick-off put it straight home.
- The page passes `className="touch-none"` to its `PixelStage`, so a finger dragging on the canvas
  never scrolls or zooms the page.

### The airship

The scene hands the backdrop's airship its pointer: `airshipAt(x, y, t)` decides the hover
(`"pointer"` cursor) and a click on it (press and release on it, no drag) calls
`pokeAirship(t)`, both with the scene's ambient clock, the one `draw` passes the backdrop. The ball
is in front of the airship and is looked at first: the airship never takes a press meant for the
ball, and a click on the airship does nothing else. Clicks are taken in the entrance and idle
alike.

The mascot on the lawn left of the stadium is handed the pointer the same way: `mascotAt(x, y, t)`
(`"pointer"` cursor; looked at after the ball and the airship) and a click on him (press and
release on him, no drag) calls `pokeMascot(t)` with the same clock: he does a trick. A click on
him does nothing else, and the scene sends no sound of its own for it: his touches and kicks are
the picture's cues (below). On a phone there is no lawn and `mascotAt` is always false.

The sign carries the fact (`setSign({ header: labels.header, text: fact })`, sent when either
changes). The scene knows nothing of the stadium: today's stadium is the game page's. The
fact's marquee runs on the ambient clock, so under reduced motion it scrolls slower too.

### Sound

Through the Scene contract's `onSound` (above); nothing is sent while it is null.

| when                                                                   | cue                                                                                                                                                     |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| a press on the ball (a click, or the start of a drag); hover is silent | `kick`, power 0.3 (`HOME_PAGE.press`), one per 0.1 s                                                                                                    |
| every frame the hand's turn is moving (drag, coast, spring, snap)      | `wind`, speed = angular speed / 14 rad/s, 0 to 1                                                                                                        |
| the strike (0.22 s into the kick-off; at once with reduced motion)     | `kick`, power 1                                                                                                                                         |
| every frame of the flight                                              | `wind`, 0.9 falling to 0.36 (HOME) or 0.23 (AWAY); NEXT-GEN's rising from 0.36 to 0.9; RETRO's falling to 0.36 as it drops, then to nothing as it rolls |
| HOME lands (0.89 s), and its bounce comes down (0.2 s later)           | `land`, power 1, then power 0.35; no cheer, no horns                                                                                                    |
| AWAY's twinkle (0.95 s: its brightest at the flare, 1.07 s)            | `sparkle`; its `wind` dies away over 0.35 s                                                                                                             |
| NEXT-GEN's flare (0.63 s, its brightest at 0.75 s)                     | `sparkle`; its `wind` dies away over 0.35 s                                                                                                             |
| RETRO bounces on the road (0.49 s), and comes to a stop (0.97 s)       | `land`, power 0.35; then `touch`, level 0.3                                                                                                             |
| the iris starts to close (1.13 s; at once with reduced motion)         | `transition`, opening false, once a kick-off                                                                                                            |
| a poke on the airship / the poke that bursts it                        | `squeak` / `pop` (nothing for `"none"`)                                                                                                                 |
| every frame but in `done`                                              | `backdrop.cuesBetween(last clock, clock)`, as they are                                                                                                  |

Neither `land` nor `sparkle` is sent with reduced motion (there is no flight). The numbers
(the powers and the wind's speeds) are `HOME_PAGE` in `app/audio/mix.ts`.

The scene itself sends no `cheer`, `firework` or `vuvuzela`. The picture's match is heard only
far off, as background: at its goal (26 s into each 40 s loop of the picture's clock) a
`cheer` of size 0.1 (`HOME_PAGE.pictureCheer`), and a `firework` with `distant: true` as each of the goal's rockets goes up
(none on a phone, where they have no room). Never a `vuvuzela` (a test plays a few minutes of
it to be sure).

Wind is also drawn: while the hand's turn moves the ball, pixel streaks of air (white heads,
`skyMid`/`skyLow` by day, `skyLow`/`mist` by night) run round it just outside its rim, the way
its rim's air goes, more and longer the faster it turns, a gust of them for 0.35 s after a
flick, none with reduced motion; never on the ball or in the logo's sky. The struck ball leaves
three to five straight streaks behind it while it is at least 0.35 of its size. Shots:
`menu/wind`, `menu/wind-drag`. Its ambience is `{ venue: "town", crowd: 0.3 }`,
a quiet distant murmur of the town.

### Cost (Chrome, 1920 x 1080, so 480 x 270 logical)

- A frame: 1.4 to 2.5 ms on average, 99th percentile 2.8 to 3.9 ms, worst 5 to 6 ms, 60 frames a
  second with none dropped.
- The first frame, and the first frame under a new light or at a new size, repaints the static
  picture: 120 to 180 ms on a page just loaded (the code is cold), 40 to 80 ms after that. The
  host does not count it against the animation (see above), but the main thread is busy for
  that long.
- The kick-off (measured in headless Chrome at 1920 x 1080@1, click to the page change, five
  runs): 109 frames, every one 16.5 to 17.0 ms apart, none dropped; the scene's own work 1.4 to
  1.8 ms a frame on average, 8 ms at worst. The page change comes 1.82 s after the click.
- `MenuBackdrop.draw` allocates about 140 KB a frame (cloud shadows, cars, walkers), which is
  where the worst frames come from. See "Known weak points" in `docs/API_ART.md`.

## What the page does with it (`app/routes/home.tsx`)

The page owns the scene, the host runs it, and the DOM captions are its second set of controls.

```tsx
const scene = new MenuScene({ seed: today.dayNumber, fact: factForDay(today.dayNumber).text, labels: strings.home.canvas, intro });
scene.onHover = (mode) => setLit(mode); // lights the DOM caption
scene.onKickoff = (mode) => setStowed(true); // the captions drop out of the way
scene.onChoose = (mode) => navigate(playPath(mode)); // /play/next-gen for NEXT-GEN
scene.onLocked = (mode) => showTheNotice(strings.home.soon[mode]); // 2.5 s, in the captions' live region
scene.setScores({ home: 478, away: null });

<GameLayout
  canvas={<PixelStage className="touch-none" scene={scene} light={sky?.light ?? null} />}
  bottom={<MenuCaptions onSelect={(mode) => scene.choose(mode)} onHover={(mode) => scene.setHovered(mode)} lit={lit} stowed={stowed} ... />}
/>;
```

The page must:

- Make the scene after mounting, never during render or at import: the day and the storage are
  not known at build time. One scene per day (the day seeds the picture); a new day is a new
  scene. Strict mode must still end up with one.
- Pass `intro: false` except the first time the home screen is shown after a page load.
- Give it the day's fact (`factForDay` from `app/data/facts.ts`, for the day `resolveToday`
  gives, so `?day=` chooses it) and put the same fact in the visually hidden line for screen
  readers (`strings.home.fact`: "Fact of the day: ...").
- Give it the sign's messages (`setSignMessages(signMessages(day, scores, streak))`, from
  `app/routes/home-sign.ts`), again whenever the scores or the streak change.
- Hand it the sky's `light` through `PixelStage`, and the moon's phase with `setMoonPhase`.
- Stow the captions on `onKickoff` (they are `inert` then) and leave the page on `onChoose`,
  exactly once however many times it is told.
- Move on by itself if `onChoose` never comes (no canvas to run the scene on): 6 s after
  `onKickoff`, longer in slow motion.
- Call `reset()` and bring the captions back if it is still there 8 s after it asked to leave (the
  mode's page could not be fetched): the scene is `done`, which is plain ink, and stays so until
  it is told.
- Leave the scene alone from `onKickoff` on when it looks at the day and the scores again
  (midnight, the tab coming back into view). The phase alone does not say it: a mode chosen
  during the entrance is still `intro` until the ball has settled.

The page must not:

- Call `resize`, `setLighting`, `setReducedMotion`, `update`, `draw` or `pointer`: those are the
  host's. (Tests run a scene by calling `update` themselves; there is no canvas there.)
- Keep any number about the picture (where the ball is, how big). The scene and `~/art/layout`
  own them; the DOM is placed by CSS from the same rules (ui.css section 15b).
- Give one scene to two hosts, or read the clock for it.
- Expect `onHover` to say what the keyboard's focus is on: that goes the other way, through
  `setHovered`.

## The career scene (`~/scenes/career`)

The picture behind the questions (`docs/CAREER_SCENE.md`): the ground of his tier
(`CareerGround`, `~/art/grounds`) with the cast on it (`~/art/characters`).

`mode` is any of the four open modes (2026-11-13). HOME tells the hometown hero's story and
AWAY the journeyman's. The scene works out two things from its mode, once, in the
constructor:

- **`journey`**: whose story it tells, and so where everyone stands, the kits' roles, the
  crowd's mood and the play. RETRO and NEXT-GEN tell the hometown hero's, as HOME does.
- **`era`** (`eraOf(mode)`, `~/art/era`; `docs/API_ART.md` "Eras"): how it looks. HOME and
  AWAY are `"today"`; RETRO is the early days of the game and NEXT-GEN the future
  (`docs/ART_BIBLE.md` section 10). The scene hands it to the ground
  (`new CareerGround({ ..., era })`), to the kits (`ensureKits(..., era)`, so every
  `drawPlayer`, `drawKeeper` and `drawFetch` picks the era's sprites), to the ball
  (`drawMatchBall(..., { gold, era })`, two option objects made once) and the trophy, and to
  the effects (`buildColors`, `drawGoalFireworks`, `drawConfetti`). In NEXT-GEN it also
  gives a struck shot a light trail and lays `labels.nextgen` over the board words. Both
  eras' referees are people drawn by `drawPlayer` in today's place (NEXT-GEN's was a drone
  until the polish).

So RETRO and NEXT-GEN play exactly as HOME, beat for beat and in the same places (the stage,
the goal, the cast's places, the shots, the fetch, the promotion and its close-up, full time
and the trophy lift); only the look changes. Their own colour is the hero's (`P.retro`,
`P.nextgen`). Anything else plays as HOME. The era's tests (`career-retro-*.test.ts`,
`career-nextgen-*.test.ts`) hold the cast to HOME's places. The API:

```ts
new CareerScene({ seed, mode, total?, labels?: CareerLabels });
scene.setTotal(total);               // the tier at once, nothing playing at full time
scene.playShot(grade, onDone?);      // grade: ~/game Grade (the six shots, "timeup", "skipped")
                                     // SHOT_SECONDS (2.4); 0.4 with reduced motion
scene.promote(total, onDone?);       // PROMOTION_SECONDS (1.5); 0.25 reduced; at once if the tier is the same
scene.showFullTime(total);           // the tableau; ends whatever plays
scene.busy;                          // a shot until its onDone, or a promotion
scene.onSound; scene.ambience();     // sound (below)
SHOT_SECONDS, PROMOTION_SECONDS, ARRIVAL_SECONDS (0.63), ARRIVAL_STEP (1/30), OPEN_HOLD (2)
```

It keeps every promise in "The career scene and the game page" below (held by
`career.test.ts`). The picture plays on after a shot's `onDone`: the reaction ends, the ball is
fetched back to him (the fetch) and he juggles again, without being `busy`. A shot or promotion asked for while one
plays finishes it first (the outcome stands, its `onDone` is called), then starts.

**Idle.** He does keepie-uppies at `heroX` (juggle, 7 fps); the ball goes through every
`ballSpot("juggle")` and on a curve between touches. The cast stands as section 2 says, x
offsets times `stageScale`: team-mates A and B, opponents A and B, the keeper 6 px in front of
the line, the referee from tier 2. Everyone breathes on his own beat and turns to watch the
ball. Youth sprites at tiers 0 and 1 (the keeper a child in gloves). Kits: park clothes at tier
0 (his top in the mode colour, everyone else `casual` variants), the mode kit 1 to 4, the
national kit from 5; opponents `rival` from tier 1. Everyone has a 1 px shadow (the grass
under him a step darker), and the ball an ink outline (art bible section 4: the ball's sprite
has none).

**The opening.** The scene starts on ink (the home screen's kick-off ends on ink) and an iris
opens out of it, centred between him and the goal a little above the feet row: out of nothing,
slowing as it passes a ring round the stage (half the hero-to-goal distance plus 18 px) at
0.19 s without stopping there, then on out past the farthest corner, easing to the end at
`ARRIVAL_SECONDS` (0.63, the home screen's closing played the other way). Two cubics that
meet at the ring with the same speed, its radius worked out every frame and rounded to whole
pixels only when drawn, in the same clean pixel circle as the closing iris (`drawIris` in
`career-fx.ts`). While it is shut the picture is not painted at all.

- The picture (the ground's layers for this size, light and tier, the kits, the sprites of the
  picture as it stands) is built by `prepare` as soon as the scene has its size and its light,
  in `resize` or `setLighting`, before the first `update` with time in it, by painting a frame
  off screen. The sprites the shots use are built later, one set a frame once the opening is
  over (`warmStep`; `playShot` builds any left at once), so the build is as short as it can be.
- The build is still the page's one long frame (15 to 18 ms in Chrome at 1920 x 1080), and the
  browser shows the frame after a long one late. So the scene holds on ink for `OPEN_HOLD` (2)
  frames with time after it, and the iris starts on the third. No update moves the opening's
  clock more than `ARRIVAL_STEP` (1/30 s), so a stall shows as a moment's wait, never a jump.
- Measured in Chrome at 1920 x 1080 @1 after a real kick-off from the home page, every frame
  the stage painted, four runs: every interval through the opening 16.4 to 16.9 ms, none over
  20 ms; the scene's work 0.2 to 2 ms a frame. (Before the hold and the late sprites the build
  was 20 to 22 ms and two runs in four had a 33 ms interval at the iris's first frames.)
- Heard: the `transition` (opening) as the iris starts, the referee's `whistle` as it is fully
  open (play starts). Reduced motion: no iris.

**A shot**, in seconds from `playShot` (each shot's own beats are in the table below):

| beat    | when     | what                                                                                                                                                |
| ------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| set     | 0 to 0.3 | he stops, steps back 2 px, the ball drops to his feet (from wherever it was); a soft touch                                                          |
| strike  | by shot  | his move from its start; the boot meets it at `STRIKE_FRAME`: golazo, trivela and miss 0.5, toe poke 0.85, tap in 1.075, worldie 1.25               |
| flight  | by shot  | trivela 0.44, golazo 0.62, toe poke 0.27, tap in 0.55, worldie 0.3; a miss 1.1 skied or a 1.2 s roll wide                                           |
| outcome | to 2.4   | the reaction, the crowd's `setMood` as the ball gets there (into a net: 0.05 s later); `onDone` at 2.4                                              |
| after   | 3.0 on   | everyone back (he runs back from his celebration); the ball comes back to him (a goal or a miss: the fetch, below), the flick up (0.22 s), juggling |

| grade     | build-up and the ball                                                                                                                                                                                                                                                                                                                                                 | the keeper (adult)                                                                                                                                        | him; the others                                                                                                              | mood    |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------- |
| `worldie` | the bicycle kick: hooked out to A (`kick` flipped, 0 to 0.4), A volleys a lofted cross back to his chest (A's `kick` 0.2 to 0.7, the cross 0.4 to 0.85); `bicycle` 0 to 7 from 0.85, the ball on its `ballSpot`s, the strike at 1.25; flat into the top corner in 0.3 s with a gold trail; at the back of the net at 1.6: gold burst, bulge 1 (for 0.6 s), 2 px shake | `ready` 0 frozen from the strike, `beaten` from 1.8                                                                                                       | sits up at 1.55 (a puff where he lands at 1.4), `celebrate` from 1.75; A and B run over (1.75, 1.87) and mob him             | `roar`  |
| `golazo`  | the curler, `finesse` from 0.3: the shadow bends out 4 rows towards the camera and back, the ball rising to just under the bar at the far post round the keeper's dive (line 1.12, net 1.17); bulge 0.8                                                                                                                                                               | `leap` 0 at 0.82, 1 and 2 lifted on an arc so his gloves are a pixel short, then `beaten`                                                                 | the point held to 1.22, a run (to 1.47) and a knee slide to the near corner (18 px x stageScale, 5 rows nearer); B runs over | `cheer` |
| `trivela` | `trivela` from 0.3, the outside of the boot at 0.5: up quickly, flattening and dipping late into the near corner, its shadow swinging away from the camera and back, bending away from the keeper (line 0.94); bulge 0.85                                                                                                                                             | a beat late: `sprawl` 0 at 0.81, 1 at 0.89 diving where it was heading, 2 at 1.0 with a puff as it bends past his glove, `beaten` from 1.69               | the flick of the follow-through held 0.6 to 0.8, then arms open (frame 5): a cool one; B runs over to him, A jumps           | `cheer` |
| `toepoke` | a heavy touch at the set knocks it on ahead; he chases it (`run` 0.3 to 0.75) to 41 px x stageScale before the keeper's place; `toepoke` from 0.75, the toe at 0.85 with a puff of turf; scuffed along the grass past the gloves, a 1 px bobble now and then (line 1.12); bulge 0.4                                                                                   | rushes out (16 px x stageScale, 0.35 to 0.85) `stranded`; `smother` 0 at 0.91, a beat late, 1 at 1.01 as it squeezes past; `beaten` from 1.52; back after | the stumble carries him 1 to 2 px on; a fist pump (`celebrate` 0 and 2) from 1.27                                            | `cheer` |
| `tapin`   | no set: he dribbles in (`run`, 0.3 to 0.95, three touches) round the keeper, 6 rows nearer the camera, to 8 px x stageScale before the keeper's place; `tapin` from 0.95, the prod at 1.075; walked in at walking pace past the keeper on the ground (line 1.63); bulge 0.3                                                                                           | rushes out 14 px x stageScale (0.3 to 0.58), `smother` 0 then 1 without the ball, `beaten` from 2.0; back to his line 3.3 to 3.9                          | points (`finesse` 4) 1.73 to 2.53; runs back from 3.0; team-mates one jump                                                   | `cheer` |
| `miss`    | `kick` from 0.3; the first miss of a game is skied over the bar and gone behind the far side (the hedge at 0; past the line 1.29); the second is dragged wide along the grass outside the near post (drawn over the goal; past it 1.15) and rolls to a stop by the near touchline (1.7)                                                                               | `ready`: he watches it go                                                                                                                                 | hands on his head (`lift` 0) as it goes past, 0.7 s, then `dejected`; mates slump, opponents celebrate                       | `groan` |
| `timeup`  | never struck: rolls 4 px off his foot; a whistle sign over the referee (him at 0/1)                                                                                                                                                                                                                                                                                   | `ready`, slower                                                                                                                                           | `dejected` (hands on hips)                                                                                                   | `hush`  |
| `skipped` | he turns and side-foots it to team-mate A, who knocks it back after                                                                                                                                                                                                                                                                                                   | `ready`, slower                                                                                                                                           | `shrug`, then faces the goal again                                                                                           | `idle`  |

- In the net the ball reaches the back, is held by the bulge and drops to the floor; at tier 0
  there is no net: it runs on towards the hedge. A skied miss comes down behind the goal, a
  miss dragged wide rolls to a stop by the near touchline. That same ball is then fetched
  back to him (the fetch, below): there is only ever one ball.
- The child keeper (tiers 0, 1, the youth frames) has no dives: for the toe poke and the tap in
  he runs out and holds his arms out (`shrug`), and he is `dejected` after every goal.
- Opponents slump after every goal. At tiers 4 to 7 every goal sets off small fireworks over
  the stand roof, more and bigger for the better shots (tap in 2, toe poke 3, trivela 4,
  golazo 5, worldie 7; `drawGoalFireworks` takes a size from 0 to 1).
- **The fetch** (`Story.fetch`, planned in `planFetch` as the shot starts; frames in
  `~/art/characters/fetch`): after a goal or a miss that brings no promotion, the shot's ball
  is brought back to his feet before he juggles again.
  - Tiers 0 and 1: a youth runs to it, steps round it, dribbles it back and passes it to him:
    the child keeper after a goal, team-mate B after a miss.
  - Tiers 2 to 7, a goal: the keeper jogs into his net after his reaction (0.7 s), picks the
    ball up (`keeperPick`), walks it back to his place (`keeperCarry`) and rolls it out to
    him underarm (`keeperRoll`).
  - Tiers 2 to 7, a miss: the ball kid behind the goal (a youth in a sky-blue bib) catches
    one skied over the bar as it drops, or runs to one dragged wide and picks it up
    (`kidPick`), and throws it back with both hands over his head (`kidThrow`), then walks
    back to his place.
  - The fetcher sets off after his reaction, timed to reach the ball as it stops if it is
    still moving, and never lets it go before he is in his place or so early that it reaches
    the hero before he is back from his own reaction. The ball settles at his feet for 0.1 s,
    then the flick up.
  - A promotion ends it: the smoke covers the change of ground and the ball is at his feet
    on the new one. Reduced motion has no fetch (the cut back to juggling).
- After a pass A knocks the ball back; after time up it is the same ball, drawn back to his
  foot.
- A shot (or full time) asked for during the last shot's reaction does not cut: everyone runs
  from where he is to where the new moment needs him over 0.3 s. If it comes during a fetch,
  the same ball comes to him for the set from where it is (a fetcher holding it lets it go
  at once, and it hops if it has far to come).
- Reduced motion: the shot is drawn still at its settled moment (the ball's final place, the
  reaction) from the call, the crowd reacts at once, `onDone` at 0.4 s, and 1.8 s later he is
  juggling again (a cut). No shake, puff, gold burst, fireworks, confetti or opening iris; the
  juggle runs at half speed.

**Sound.** What a shot sends, as it happens (times for a tier 4 game):

| shot      | cues                                                                                                                                                                       |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `worldie` | kick 0.2 (the hook, 0.03), kick 0.35 (A's cross, 0.42), touch (the chest, 0.85), kick 1 (1.25), wind in flight, score + cheer 1 (1.62), vuvuzela at 6 and 7 (0.35 s after) |
| `golazo`  | touch (0.3), kick 0.75 (0.5), wind, score + cheer 0.8 (1.17)                                                                                                               |
| `trivela` | touch (0.3), kick 0.85 (0.5), wind, score + cheer 0.6 (0.99)                                                                                                               |
| `toepoke` | touch (0.3), kick 0.35 (0.85), score + cheer 0.4 (1.17)                                                                                                                    |
| `tapin`   | touch (0.3, 0.52, 0.73: the dribble), kick 0.2 (1.075), score + cheer 0.2 (1.68)                                                                                           |
| `miss`    | touch (0.3), kick 0.8 (0.5; dragged wide 0.6), wind while skied, score `miss` + groan (skied, 1.29) or ooh (wide, 1.15)                                                    |
| `timeup`  | touch (0.3), whistle (0.45); no sting                                                                                                                                      |
| `skipped` | touch (0.3), kick 0.15 (the pass), kick 0.15 (A knocks it back, 3.2); no sting                                                                                             |

- `score` and the cheer go together, once, at the moment the ball goes in (or past); the
  engine sizes the cheer to the ground from `ambience()`. Every goal's fireworks are `firework`
  with `distant: true`, one per rocket as it goes up, at tiers 4 to 7 only. One `vuvuzela`
  for every goal at the World Cup (tiers 6 and 7, never below), 0.35 s after the cheer and as
  big as it (`size` the cheer's). No wall of noise.
- Every power, size and speed here is `GAME` in `app/audio/mix.ts` (`GAME.shots` by shot: its
  kick, cheer and wind; `hook`, `cross`, `lowMiss`, `knockBack`, `fullTimeCheer`,
  `winnersCheer`), the juggle's `JUGGLE.touch`, and the bed's crowd by tier
  `BEDS.places[place].crowd`.
- The juggle while the player types is very quiet: every other touch is a `touch` at `level`
  0.15 (about 1.75 a second), and so is the flick back up after a shot. A shot's own touches
  are at the full level.
- Full time: the long whistle at once, the crowd 0.8 s later (0.9 at tier 7, else 0.5). A
  promotion: `sweep` as it starts, `net` as the ball in the close-up hits the net (0.36), a
  cheer of 0.45 as the new ground appears (1.12).
- With reduced motion only the strike, the result (sting and crowd) and the horn, at once.
- `ambience()`: `venue` park at tiers 0 and 1, ground at 2 and 3, stadium from 4; `crowd`
  0.1, 0.2, 0.35, 0.5, 0.75, 0.85, 1, 1 by tier; `night` from the ground's light (tiers 6 and
  7 always); `tier` the career tier.

**A promotion** (1.5 s, straight to the highest tier crossed): a wall of smoke sweeps in from
the left (0 to 0.5 s) over the far side and the cast (from above the new stands to 9 rows
below the feet), with a big cloud in the middle of the screen (`closeUpSize`: centred on the
action band, 222 x 106 inside at 480 x 270, 114 x 112 on a 130 px phone, reaching past the band
at the low tiers). A hole opens in the cloud (0.24 to 0.34) onto a close-up of the back of a
goal's net: behind it the ground out of focus (the stand's shadow and its lights, the pitch)
and the far netting, dotted. The ball comes in at us out of the goal (0.27 to 0.36, growing,
streaks behind it) and hits the net (a 1 px jolt): the net takes it on a damped spring, out
past where it holds and back (`0.85 * (1 - exp(-7u) cos 18u)`), and the ball keeps turning,
slower and slower. The ball is a truncated icosahedron, its radius 0.48 of the hole's half
height (22 px at 480 x 270): leather in four tones lit from the top left, black pentagons with
a shine, the seams between the hexagons. The near netting is a diamond mesh (diamonds about a
third of the ball across) pulled into a pocket: over the ball's front it is stretched and
wraps round to the rim, the flanks of the pocket gather in a ring round it in shadow, and the
flat net beyond is pulled in towards it, its diamonds long and narrow and leaning in. The
smoke rolls back over the hole (0.72 to 0.86), the new tier goes in under cover with the hole
all but closed (0.8: the ground's rebuild is a long frame), the smoke breaks up into clumps
and drifts away right (0.85 to 1.35), and the new ground has a cheer (1.12). Everything is
graded like the new ground: by the sky's light to tier 1, floodlit from tier 2. Reduced
motion: the ground changes at once.

**Full time.** Tier 7: the trophy lift on the podium (`lift`, the trophy at `handsSpot`,
glinting every 1.4 s), team-mates jumping on the steps and around it (two extra team-mates
join), opponents `dejected`, the keeper `beaten`, confetti over the whole width, the crowd at
`party` (the ground adds fireworks and ticker tape). Below it: he holds the match ball up
(`lift`), A and B celebrate beside him, opponents slump, the crowd cheers.

**Light.** `setLighting` goes to the ground (which keeps tiers 6 and 7 at night); the cast is
graded with `ground.light` (`litKit`, made once per tier and light).

**Cost** (Node, warm, 480 x 270): `update` + `draw` 0.2 to 0.7 ms a frame on average, about 1
to 2.7 ms at worst; the promotion's close-up 3.4 to 3.5 ms a frame; the frame where a promotion
swaps the tier (the ground's rebuild) 7 to 28 ms once, under cover. The scene's own drawing
allocates about 2 KB a frame idle and up to 13 KB during a worldie (boxed numbers from `hash2`
and trigonometry, no objects); the ground's crowd allocates 35 to 55 KB a frame while it
cheers or roars.

**Shots** (`career.shots.ts`): `career/idle` (all eight tiers), `career/idle-t0` to `idle-t7`,
`career/away`, `career/shot-<grade>` (tier 4) and `career/shot-<grade>-t0` (the park) for all
eight grades (`worldie`, `golazo`, `trivela`, `toepoke`, `tapin`, `miss`, `timeup`,
`skipped`), `career/shot-miss-wide` and `-t0` (a game's second miss: dragged wide), playing
over `ctx.t` from the call (use `--strip`), `career/after-<grade>` (from the call back on),
`career/arrival` (the opening, `ctx.t` from the first frame), `career/interrupt` (a toe poke
asked for during a golazo's knee slide), `career/promote` (2 to 3), `promote-t0`, `promote-t1`,
`promote-t3`, `career/fulltime` (tier 7), `fulltime-t3`, `fulltime-t0`, `career/reduced`.
RETRO and NEXT-GEN have their own (`career/retro-*`, `career/nextgen-*`, in
`career-retro-players.shots.ts`, `career-retro-low.shots.ts`, `career-retro-high.shots.ts`,
`career-nextgen-players.shots.ts`, `career-nextgen-high.shots.ts`; the list is in
`docs/API_ART.md`, "Eras").

**Files**: `career.ts` (the class, the plans and beats, the ball's paths, the poses, the
opening, the sound), `career-cast.ts` (who stands where, kits, the sprite spots read once: the
juggle, the kick, the bicycle kick, the keeper's gloves), `career-fx.ts` (the promotion's
smoke and close-up, fireworks, confetti, the whistle sign, the gold burst, the iris, shadows),
`career-fx-retro.ts` and `career-fx-nextgen.ts` (each era's close-up colours and ball, goal
fireworks and confetti, called from `career-fx.ts` when the era asks).

## The career scene and the game page (`~/scenes/career`, `app/routes/play/`)

The API is `docs/CAREER_SCENE.md` section 7, with `CareerLabels { boards?, banners?, nextgen? }`
for `labels` (`nextgen`, `en.play.canvas.nextgen`: NEXT-GEN's own board words, laid over the
others in that era only). Import it from `~/scenes/career` (not from the index). `app/scenes/career.ts` is the
real scene (the section above); the stand-in it replaced kept the same API. `career.test.ts`
holds any scene behind that file to what the page relies on:

- `playShot(grade, onDone)`: about 2.4 s (0.4 s with reduced motion); `onDone` exactly once,
  called after `busy` is false again.
- `promote(total, onDone)`: about 1.5 s if the tier changes; `onDone` **at once, synchronously**,
  if it does not.
- A shot or promotion asked for while another plays finishes that one first (its `onDone`).
- `showFullTime(total)` ends whatever plays; `busy` is false after it.
- The scene starts on ink and an iris opens out of it (`ARRIVAL_SECONDS`, 0.63 s, after
  `OPEN_HOLD` frames of ink once the picture is built): the home screen's kick-off ends on ink.

What the page (`app/routes/play/controller.ts`) does with it: one scene per game, seeded with the
day; `setTotal(total)` for a resumed game (the total **before** the turn on a resumed reveal,
so the promotion it earned still plays on NEXT); `playShot(grade)` when an answer, a pass or
the clock ends a turn, and the reveal when it calls back; `promote(total)` on NEXT when the turn
crossed a tier line (not after question 7), then the next question with a fresh clock;
`showFullTime(total)` at full time. If the scene does not call back within 5 s (shot) or 4 s
(promotion) the game moves on by itself, and a late call back is ignored. The page never calls
the host's methods and reads no number about the picture.
