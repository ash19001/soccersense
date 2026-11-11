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
`kickoff-home`, `kickoff-away`, `drag`, `spin`, `rest` (each locked patch shown, close up),
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

## The menu scene (`~/scenes/menu`)

The home screen's picture: the aerial stadium (`MenuBackdrop`), the wordmark, and the football
that floats in front of them and is the menu. HOME (the most common answer wins) is its left
patch, AWAY (the most niche answer wins) its right. Four more patches are locked modes:
NEXT-GEN on the top patch, RETRO on the bottom one, and CLOSEST and FURTHEST on the back,
directly behind AWAY and HOME, so that half a turn brings CLOSEST round to where HOME was and
FURTHEST to where AWAY was. Which pentagon each one is: `docs/API_ART.md`, the menu ball.

```ts
type LockedMode = "nextgen" | "retro" | "closest" | "furthest";
const LOCKED_MODES: readonly LockedMode[];
const MODE_SLOTS: Record<Mode | LockedMode, BallSlot>; // home left, away right, nextgen top,
// retro bottom, closest backRight, furthest backLeft
interface MenuLabels {
  home: string;
  away: string;
  nextgen: string; // the locked patches' words: "NEXT-GEN", "RETRO", "CLOSEST", "FURTHEST"
  retro: string;
  closest: string;
  furthest: string;
  header: string; // the airship's sign, over the fact: "DID YOU KNOW?"
  tagline?: string;
}
interface MenuSceneOptions {
  seed: number; // the day number: it seeds the town and its life
  fact: string; // the fact of the day on the airship's sign (factForDay(day).text), any case
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

  // what the page tells it
  setFact(text: string): void; // a new fact on the sign (the same again does nothing)
  setLabels(labels: MenuLabels): void; // a new header goes to the sign too
  setScores(scores: Partial<Record<Mode, number | null>>): void; // a badge on the patch; null takes it off
  setMoonPhase(phase: number): void; // 0 new, 0.5 full
  setHovered(mode: Mode | null): void; // hover or keyboard focus on a DOM caption: lights the patch
  choose(mode: Mode): boolean; // start the kick-off from the DOM; false if it cannot start now
  reset(): void; // back to "idle" with no entrance, from any phase
}
```

It takes nothing from `~/art` but the backdrop contract (`MenuBackdrop`: `resize`, `setLighting`,
`setSign`, `setMoonPhase`, `target`, `setRoar`, `draw`, `airshipAt`, `pokeAirship`), `menuLayout`'s `cx`,
`ballR`, `ballCy` and `logo`, the ball, the logo and the palette. A test holds it to that.

### Phases and timings

| phase     | how long                     | what happens                                                                                   | leaves by                    |
| --------- | ---------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------- |
| `intro`   | 0.88 s                       | the ball swells out of a star under its spot (full size at 0.45 s), floats past it and settles | time; reduced motion ends it |
| `idle`    | until a mode is chosen       | it hovers: a bob every 4 s (a deep breath every third), a nod, a rock every 5 s, a shine       | a patch, or `choose`         |
| `kickoff` | 1.57 s (0.15 s when reduced) | flash, strike, flight, iris (below). No input is taken                                         | time: `onChoose` fires       |
| `done`    | until `reset`                | plain ink                                                                                      | `reset`                      |

The kick-off, in seconds from the moment it starts. `onKickoff` fires at 0 and `onChoose` at 1.57.

| at   | HOME                                                                                           | AWAY                                                             |
| ---- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 0    | the chosen patch flashes in its mode's colour                                                  | the same                                                         |
| 0.22 | the strike: a star, a ring, sparks, the ball pressed flat, the picture shakes 2 px up and down | the same, struck from HOME's side, shaking sideways              |
| 0.29 | it flies up the middle, shrinking fast, to hang over the far rim at 0.58                       | it leaves low to the right and curls up over the town            |
| 0.84 | the ground starts to roar (`setRoar`, six steps, full by 1.02)                                 |                                                                  |
| 0.89 | it lands on the centre spot (`backdrop.target()`): a thump, a burst, a ripple, one bounce      |                                                                  |
| 0.97 |                                                                                                | gone, a speck over the skyline: a twinkle, which goes on winking |
| 1.14 | the iris starts to close on the centre spot                                                    | the iris starts to close on the twinkle                          |
| 1.34 | held as a ring (0.75 of the ball's radius: the pitch and the stand round it)                   | held as a ring (0.22 of the radius: a little sky)                |
| 1.44 | the ring shuts                                                                                 | the same                                                         |
| 1.51 | ink                                                                                            | ink                                                              |
| 1.57 | `done`, `onChoose("home")`                                                                     | `done`, `onChoose("away")`                                       |

On a canvas under 200 logical pixels wide (a phone) the flights are the phone picture's: HOME's
apex is lower, under the sign, and AWAY flies out over the right edge and comes back in small
beside the wordmark. The times are the same.

With reduced motion: no entrance (an `intro` ends at once), no bob, no nod, no shine on the
patches or the wordmark, no "no" shake, the rock and the town at a quarter of their speed, and
the kick-off is a cut: the patch lights for 0.15 s, then ink and `onChoose`.

### Input

- A patch is chosen by pressing and releasing on the same patch without moving more than 3 logical
  pixels (12 CSS px on the reference monitor). Further than that the press is a drag (below) and
  never chooses, wherever it is let go. A locked patch answers with a shake of the ball (0.35 s)
  and `onLocked(mode)`, and never chooses. HOME and AWAY choose from any pose in which they are
  in view (their pentagon is under the pointer); from a pose other than the menu pose the ball
  is first brought round, as for `choose` mid-spin (below).
- A locked patch under the mouse lifts a step (it never takes a colour); `onHover` is only
  about HOME and AWAY, so it stays `null` there.
- Hover is the mouse's only: a finger lights nothing, and its `up` ends any hover. `onHover` fires
  only on a change, and with `null` when a kick-off starts.
- A pointer that keeps still keeps its patch while the ball bobs and rocks under it.
- Presses on the ball wait for the entrance: during `intro` a press does nothing. `choose(mode)`
  (the captions, the keyboard) is taken at once even then (`onKickoff` fires, nothing else can be
  chosen, the patch shows pressed) but the ball is only struck when it has settled, so `onChoose`
  can come up to 0.88 + 1.57 s after `onKickoff`.
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
  the same spring takes it to the pose that shows that patch (`ballShowPose`: NEXT-GEN or RETRO
  straight on, or half a turn for CLOSEST and FURTHEST, side by side where HOME and AWAY were)
  and holds it exactly there. It is a menu again: every patch in view hovers and can be pressed.
  After 4.5 s from when it stopped (about four seconds still) it heads home. A press on a locked
  patch starts the wait again; it stands still while the pointer is on a patch or pressing the
  ball. A press that moves is a drag, as from the menu pose.
- **Catch.** A press on a turning ball holds it (it is a drag at once) and never chooses.
- While dragged or turning (not at rest), no patch hovers or chooses from the pointer
  (`onHover(null)` when a drag starts); a hover set from the DOM still shows.
- **`choose(mode)` mid-spin** (or mid-drag) is taken at once: `onKickoff` fires, the patch shows
  pressed, the hand lets go, and the ball is brought round to its pose in 0.24 s (fast, easing
  in), then struck as usual. `onChoose` comes 0.24 + 1.57 s after `onKickoff`. With reduced
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

The sign carries the fact (`setSign({ header: labels.header, text: fact })`, sent when either
changes). The scene knows nothing of the stadium: today's stadium is the game page's. The
fact's marquee runs on the ambient clock, so under reduced motion it scrolls slower too.

### Cost (Chrome, 1920 x 1080, so 480 x 270 logical)

- A frame: 1.4 to 2.5 ms on average, 99th percentile 2.8 to 3.9 ms, worst 5 to 6 ms, 60 frames a
  second with none dropped.
- The first frame, and the first frame under a new light or at a new size, repaints the static
  picture: 120 to 180 ms on a page just loaded (the code is cold), 40 to 80 ms after that. The
  host does not count it against the animation (see above), but the main thread is busy for
  that long.
- `MenuBackdrop.draw` allocates about 140 KB a frame (cloud shadows, cars, walkers), which is
  where the worst frames come from. See "Known weak points" in `docs/API_ART.md`.

## What the page does with it (`app/routes/home.tsx`)

The page owns the scene, the host runs it, and the DOM captions are its second set of controls.

```tsx
const scene = new MenuScene({ seed: today.dayNumber, fact: factForDay(today.dayNumber).text, labels: strings.home.canvas, intro });
scene.onHover = (mode) => setLit(mode); // lights the DOM caption
scene.onKickoff = (mode) => setStowed(true); // the captions drop out of the way
scene.onChoose = (mode) => navigate(`/play/${mode}`);
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
(`CareerGround`, `~/art/grounds`) with the cast on it (`~/art/characters`). It is the real
scene now; the stand-in is gone. The API is unchanged:

```ts
new CareerScene({ seed, mode, total?, labels?: CareerLabels });
scene.setTotal(total);               // the tier at once, nothing playing at full time
scene.playShot(grade, onDone?);      // SHOT_SECONDS (2.4); 0.4 with reduced motion
scene.promote(total, onDone?);       // PROMOTION_SECONDS (1.5); 0.25 reduced; at once if the tier is the same
scene.showFullTime(total);           // the tableau; ends whatever plays
scene.busy;                          // a shot until its onDone, or a promotion
SHOT_SECONDS, PROMOTION_SECONDS, ARRIVAL_SECONDS
```

It keeps every promise in "The career scene and the game page" below (held by
`career.test.ts`). The picture plays on after a shot's `onDone`: the reaction ends, he gets a
new ball and juggles again, without being `busy`. A shot or promotion asked for while one
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

**A shot**, in seconds from `playShot`:

| beat    | when           | what                                                                                      |
| ------- | -------------- | ----------------------------------------------------------------------------------------- |
| set     | 0 to 0.3       | he stops, steps back 2 px, the ball drops to his feet                                     |
| strike  | 0.3, 0.4, 0.5  | kick frames 0, 1, 2 (`KICK_STRIKE_FRAME`) at 10 fps: a grass puff and a 1 px shake at 0.5 |
| flight  | 0.5 + by grade | worldie 0.42, goal and ontarget 0.5, skipped 0.6, topbins 0.62, wide 1.1 (to out of view) |
| outcome | to 2.4         | the reaction, the crowd's `setMood` as the ball gets there; `onDone` at 2.4               |
| after   | 3.0 on         | everyone back, a new ball, the flick up (0.22 s), juggling                                |

| grade      | the ball                                                                            | the keeper                                   | him; the others                                                         | mood    |
| ---------- | ----------------------------------------------------------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------- | ------- |
| `worldie`  | a rocket with a gold streak into the top corner, gold burst, bulge 1, 2 px shake    | `ready` 0 frozen, then `beaten`              | runs and knee-slides (18 px x stageScale, 5 rows nearer); mates mob him | `roar`  |
| `topbins`  | rises over bar height and dips under it into the top corner, bulge 0.8              | leaps (`leap` 0, 1, 2) a pixel short, beaten | celebrate (jumping); mates celebrate, opponents slump                   | `cheer` |
| `goal`     | low along the grass into the bottom corner, bulge 0.65                              | `smother` late, without it, then `beaten`    | fist pump (celebrate 0 and 2); the same                                 | `cheer` |
| `ontarget` | chest high, straight into his `hold`                                                | `leap` 0, `hold`; rolls it out to him after  | hands on head (`lift` 0); B too, opponent B celebrates                  | `ooh`   |
| `wide`     | skied over the bar, gone behind the far side as it comes down (the hedge at 0)      | `ready`                                      | `dejected`; mates slump, opponents celebrate                            | `groan` |
| `timeup`   | never struck: rolls 4 px off his foot; a whistle sign over the referee (him at 0/1) | `ready`, slower                              | `dejected` (hands on hips)                                              | `hush`  |
| `skipped`  | he turns and side-foots it to team-mate A, who knocks it back after                 | `ready`, slower                              | `shrug`, then faces the goal again                                      | `idle`  |

- In the net the ball reaches the back, is held by the bulge, drops to the floor and stays
  there (until the next shot or promotion). At tier 0 there is no net: it runs on towards the
  hedge. The child keeper (tiers 0, 1) holds a save over his head (`lift`) and is `dejected`
  after a goal.
- The new ball after a goal or a miss is thrown on from the near side (it enters from the
  bottom edge, bounces, rolls to his feet); after a save the keeper rolls it out; after a pass
  A knocks it back; after time up it is the same ball, drawn back to his foot.
- At tiers 4 to 7 every goal sets off small fireworks over the stand roof (3; a worldie 6,
  bigger and higher), as `CAREER_SCENE.md` section 4 asks.
- Reduced motion: the shot is drawn still at its settled moment (the ball's final place, the
  reaction) from the call, the crowd reacts at once, `onDone` at 0.4 s, and 1.8 s later he is
  juggling again (a cut). No shake, puff, gold burst, fireworks or confetti; the juggle runs at
  half speed.

**A promotion** (1.5 s, straight to the highest tier crossed): a wall of builders' dust sweeps
in from the left (0 to 0.5 s) over the far side and the cast (from above the new stands to 9
rows below the feet), girders and a yellow tower crane swinging a beam show through it (0.22
to 1.0), the new tier goes in under full cover (0.7), the dust breaks up into clumps and
drifts away right (0.85 to 1.35), and the stands land with a 1 px thud and a `cheer` (1.12).
The dust is graded like the new ground: by the sky's light to tier 1, floodlit from tier 2.
Reduced motion: the ground changes at once.

**Full time.** Tier 7: the trophy lift on the podium (`lift`, the trophy at `handsSpot`,
glinting every 1.4 s), team-mates jumping on the steps and around it (two extra team-mates
join), opponents `dejected`, the keeper `beaten`, confetti over the whole width, the crowd at
`party` (the ground adds fireworks and ticker tape). Below it: he holds the match ball up
(`lift`), A and B celebrate beside him, opponents slump, the crowd cheers.

**Light.** `setLighting` goes to the ground (which keeps tiers 6 and 7 at night); the cast is
graded with `ground.light` (`litKit`, made once per tier and light).

**Cost** (Node, warm, 480 x 270): `update` + `draw` 0.2 to 0.6 ms a frame on average, about 1 to
2.7 ms at worst; the frame where a promotion swaps the tier (the ground's rebuild) 7 to 10 ms
once. The scene's own drawing allocates about 2 KB a frame idle and up to 13 KB during a worldie
and 25 KB during the dust (boxed numbers from `hash2` and trigonometry, no objects); the ground's
crowd allocates 35 to 55 KB a frame while it cheers or roars.

**Shots** (`career.shots.ts`): `career/idle` (all eight tiers), `career/idle-t0` to `idle-t7`,
`career/away`, `career/shot-<grade>` (tier 4) and `career/shot-<grade>-t0` (the park), playing
over `ctx.t` from the call (use `--strip`), `career/after-<grade>` (from the call back on),
`career/promote` (2 to 3), `promote-t0`, `promote-t1`, `promote-t3`, `career/fulltime`
(tier 7), `fulltime-t3`, `fulltime-t0`, `career/reduced`.

**Files**: `career.ts` (the class, the beats, the ball's paths, the poses), `career-cast.ts`
(who stands where, kits, the sprite spots read once), `career-fx.ts` (dust and crane,
fireworks, confetti, the whistle sign, the gold burst, shadows).

## The career scene and the game page (`~/scenes/career`, `app/routes/play/`)

The API is `docs/CAREER_SCENE.md` section 7, with `CareerLabels { boards?, banners? }` for
`labels`. Import it from `~/scenes/career` (not from the index). `app/scenes/career.ts` is the
real scene (the section above); the stand-in it replaced kept the same API. `career.test.ts`
holds any scene behind that file to what the page relies on:

- `playShot(grade, onDone)`: about 2.4 s (0.4 s with reduced motion); `onDone` exactly once,
  called after `busy` is false again.
- `promote(total, onDone)`: about 1.5 s if the tier changes; `onDone` **at once, synchronously**,
  if it does not.
- A shot or promotion asked for while another plays finishes that one first (its `onDone`).
- `showFullTime(total)` ends whatever plays; `busy` is false after it.
- The scene starts on ink and opens out (0.5 s): the home screen's kick-off ends on ink.

What the page (`app/routes/play/controller.ts`) does with it: one scene per game, seeded with the
day; `setTotal(total)` for a resumed game (the total **before** the turn on a resumed reveal,
so the promotion it earned still plays on NEXT); `playShot(grade)` when an answer, a pass or
the clock ends a turn, and the reveal when it calls back; `promote(total)` on NEXT when the turn
crossed a tier line (not after question 7), then the next question with a fresh clock;
`showFullTime(total)` at full time. If the scene does not call back within 5 s (shot) or 4 s
(promotion) the game moves on by itself, and a late call back is ignored. The page never calls
the host's methods and reads no number about the picture.
