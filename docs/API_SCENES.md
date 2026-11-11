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
`kickoff-home`, `kickoff-away` (in `menu.shots.ts`).

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
  cursor?(): "default" | "pointer";
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
that floats in front of them and is the menu. HOME is its left patch, AWAY its right, and the
patches above and below are locked.

```ts
interface MenuLabels {
  home: string;
  away: string;
  locked: string;
  header: string;
  tagline?: string;
}
interface MenuSceneOptions {
  seed: number; // the day number: it seeds the town and its life
  stadium: MenuStadiumInfo; // { name, city, country }: the airship's sign
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
  onLocked: ((slot: BallSlot) => void) | null; // a locked patch was pressed and released

  // what the page tells it
  setStadium(stadium: MenuStadiumInfo): void;
  setLabels(labels: MenuLabels): void;
  setScores(scores: Partial<Record<Mode, number | null>>): void; // a badge on the patch; null takes it off
  setMoonPhase(phase: number): void; // 0 new, 0.5 full
  setHovered(mode: Mode | null): void; // hover or keyboard focus on a DOM caption: lights the patch
  choose(mode: Mode): boolean; // start the kick-off from the DOM; false if it cannot start now
  reset(): void; // back to "idle" with no entrance, from any phase
}
```

It takes nothing from `~/art` but the backdrop contract (`MenuBackdrop`: `resize`, `setLighting`,
`setStadium`, `setHeader`, `setMoonPhase`, `target`, `setRoar`, `draw`), `menuLayout`'s `cx`,
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

- A patch is chosen by pressing and releasing on the same patch. Sliding off it and letting go
  chooses nothing; sliding back first chooses. A locked patch answers with a shake of the ball
  (0.35 s) and `onLocked`.
- Hover is the mouse's only: a finger lights nothing, and its `up` ends any hover. `onHover` fires
  only on a change, and with `null` when a kick-off starts.
- A pointer that keeps still keeps its patch while the ball bobs and rocks under it.
- Presses on the ball wait for the entrance: during `intro` a press does nothing. `choose(mode)`
  (the captions, the keyboard) is taken at once even then (`onKickoff` fires, nothing else can be
  chosen, the patch shows pressed) but the ball is only struck when it has settled, so `onChoose`
  can come up to 0.88 + 1.57 s after `onKickoff`.
- From `onKickoff` on, pointer input and `choose` are ignored (`choose` returns `false`) until
  `reset`.
- `cursor()` is `"pointer"` over HOME or AWAY while a choice can be made, otherwise `"default"`.

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
const scene = new MenuScene({ seed: today.dayNumber, stadium: today.stadium, labels: strings.home.canvas, intro });
scene.onHover = (mode) => setLit(mode); // lights the DOM caption
scene.onKickoff = (mode) => setStowed(true); // the captions drop out of the way
scene.onChoose = (mode) => navigate(`/play/${mode}`);
scene.onLocked = () => showTheNotice();
scene.setScores({ home: 478, away: null });

<GameLayout
  canvas={<PixelStage scene={scene} light={sky?.light ?? null} />}
  bottom={<MenuCaptions onSelect={(mode) => scene.choose(mode)} onHover={(mode) => scene.setHovered(mode)} lit={lit} stowed={stowed} ... />}
/>;
```

The page must:

- Make the scene after mounting, never during render or at import: the day and the storage are
  not known at build time. One scene per day (the day seeds the picture); a new day is a new
  scene. Strict mode must still end up with one.
- Pass `intro: false` except the first time the home screen is shown after a page load.
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
