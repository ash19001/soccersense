# Art reference (`~/art`)

What exists in `app/art`, how to call it, and the numbers other painters must build to. Read
`docs/ART_BIBLE.md` for the rules and `docs/API_ENGINE.md` for the drawing engine. Each file's
own header comment has the fine detail.

Look at any of it without a browser:

```sh
./node_modules/.bin/tsx tools/snap.ts --list
./node_modules/.bin/tsx tools/snap.ts stadium/composed --time all --scale 3 --out .snaps/x.png
```

## Palette (`~/art/palette`)

- `P`: every colour as an engine `Color`, by role name (`P.grass`, `P.homeLight`). Painters
  never write hex.
- `PALETTE_HEX` (the same as `"#rrggbb"`), `PALETTE_NAMES`, `type PaletteName`.
- `MODE_COLORS[mode]`: `{ dark, base, light }`. HOME is warm red-orange, AWAY is teal.
- `GRADE_COLORS[grade]`: worldie, topbins, goal, ontarget, wide, timeup, skipped.
- The values are the art bible's table and match `app/ui/tokens.css` (a test compares them).
  Seven colours exist only here: `nightGlow`, `cloudLight`, `cloud`, `cloudShade`, `sun`,
  `moon`, `moonShade`. The grades are named `gradeWorldie`, `gradeTopbins`, `gradeGoal`,
  `gradeOntarget`, `gradeWide`, `gradeTimeup`.

## Lighting (`~/art/lighting`)

```ts
type Sun = { elevation: number; morning: boolean };   // degrees above the horizon
type Phase = "night" | "dawn" | "day" | "dusk";
interface Lighting { sun; phase; lightsOn: boolean; env(c): Color; lit(c): Color }
lightingFor(sun): Lighting      // cached and frozen: call it as often as you like
distant(light, c, depth): Color // env for far things. depth 0 is env, 1 is the far horizon
skyFor(light): SkySpec          // band colours, cloud tones, star and moon strength
```

- Day from 6 degrees up, night below -6, dawn or dusk between. `lightsOn` below 4 degrees.
- `env(c)` for anything lit by the sky. `lit(c)` for anything under the floodlights: the same
  as `env` while the lights are off, the full floodlit grade by -4 degrees. Both work unbound:
  `layer.recolor(light.env)`.
- Light sources (lamps, LED text, lit windows, flashes) are drawn in raw palette colour.
- Use `distant()` for every backdrop plane, so depth looks the same everywhere.
- `SkySpec` also carries `glow` (the horizon band, for filling sky gaps), `cloudLight` and
  `cloudShade` (for a painter's own weather), `stars`, `moonVisibility`, `birds`.

## Sky (`~/art/sky`)

```ts
drawSky(s, { light, t, seed, horizonY, moonPhase?, clouds?, clearTop?, sunX?, moon? })
sunPosition(light, w, horizonY, clearTop?, sunX?): { x, y, r }
moonPosition(w, horizonY, clearTop?): { x, y, r }
cloudSprite(seed, width, tones): Surface   // cached: do not draw on the result
```

- Fills rows 0 to `horizonY - 1`. Bands, stars, a rare shooting star, moon, sun, far clouds,
  near clouds, birds. Pure: same options, same pixels.
- `clearTop`: rows above it are covered by something else, so the sun and moon stay below it.
- `clouds`: 0 clear to 1 crowded (default 0.5). `moonPhase`: 0 new, 0.5 full (default).
- Clouds drift 1 px/s (near) and 0.4 px/s (far), birds 5 px/s. There is no reduced-motion
  input: pass a slower `t`.
- Home screen: `drawSky(s, { light, t, seed, ...menuLayout(w, h).sky })`.
- Career scenes: pass `clearTop: careerLayout(w, h).boardShrunkY`.

## Layout (`~/art/layout`)

Shared sizes: `PLAYER` (12 x 18 in a 16 x 20 cell), `YOUTH` (10 x 14 in 14 x 16), `KEEPER`,
`MATCH_BALL` (3 px, 1 px shadow), `FAN` (3 x 4 on a 4 px pitch), `TROPHY` (9 x 12),
`UI_COLUMN_W` (135), `STAGE_W` (130), `COVER` (what the interface hides, as fractions of the
height: `menuLogo` 0.15, `menuCaptions` 0.1, `boardAsking` 0.3, `boardShrunk` 0.18,
`answerBar` 0.1, `revealSheet` 0.46).

`menuLayout(w, h)`, values at 130x281 | 120x222 | 160x300 | 480x270. It describes the aerial
picture of the home screen (three fields keep the names they had for an older picture):

| field        | meaning                                                                                                   | values                                                                                |
| ------------ | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `cx`         | `round(W / 2)`                                                                                            | 65, 60, 80, 240                                                                       |
| `horizonY`   | the horizon: sky above, the town from here down (0.27 H to 0.33 H)                                        | 92, 72, 98, 73                                                                        |
| `ballR`      | `round(min(W * 0.34, H * 0.165))`                                                                         | 44, 37, 50, 45                                                                        |
| `ballCy`     | `round(H * 0.70)`; the ball floats, centred on `(cx, ballCy)`                                             | 197, 155, 210, 189                                                                    |
| `logo`       | zone: the top 15%, full width: keep it clear sky                                                          | h 42, 33, 45, 41                                                                      |
| `scoreboard` | zone: the sign, the LED panel on the airship, at rest (it drifts 2 px)                                    | (20, 50, 90, 33); (34, 49, 92, 35) at 480                                             |
| `stand`      | zone: the stadium, the box round the bowl on screen                                                       | (0, 98, 130, 47); (82, 87, 316, 108)                                                  |
| `pitch`      | zone: the land in front of the stadium, from its near wall to the bottom                                  | y 145, 122, 164, 195                                                                  |
| `caption`    | zone: the bottom 10% (the DOM captions: its middle 135 px on a phone, a row across its foot on a monitor) | y 253, 200, 270, 243                                                                  |
| `sky`        | `{ horizonY, clearTop, sunX, moon }`, spread into drawSky                                                 | horizon 92, clearTop 42, sunX 65 (`cx`); moon (11, 12), (11, 12), (80, 69), (394, 28) |
| `scale`      | the camera: pixels per map unit at the centre spot (not a whole number)                                   | 0.42, 0.39, 0.52, 0.96                                                                |
| `spotY`      | the row of the centre spot of the pitch (its column is `cx`)                                              | 116, 95, 128, 129                                                                     |

`MENU_CAMERA` holds the camera numbers the layout shares with the painter (the horizon's rise
above the centre spot and the bowl's box, in map units). The sun climbs and sets in the middle
column, behind the city. The moon is placed where all of it shows: on a monitor high on the
right beside the wordmark, above the tallest aerial of the city; on a phone in the corner of
sky left of the stacked wordmark; on a wider phone or tablet beside the airship's tail; where
none of these has room (160 x 300) wholly behind the airship. The sign is upper left on a
monitor and under the wordmark on a phone.

`careerLayout(w, h)`, same four sizes:

| field                       | meaning                                                                                            | values                             |
| --------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `cx`                        | `round(W / 2)`                                                                                     | 65, 60, 80, 240                    |
| `groundY`                   | `round(H * 0.52)`, the row the players' feet are on                                                | 146, 115, 156, 140                 |
| `stageLeft`, `stageRight`   | the stage, centred: 130 wide on a phone, `2 * round(W * 0.2)` up to `STAGE_W_MAX` 208 on a monitor | 0 to 130 at 130; 144 to 336 at 480 |
| `stageScale`                | the stage's width / 130: multiply offsets written for the phone stage by it                        | 1, 1, 1, 1.477                     |
| `heroX`                     | `cx - round(26 * stageScale)`, where the hero rests                                                | 39, 34, 54, 202                    |
| `goalX`                     | `cx + round(44 * stageScale)`, the goal line                                                       | 109, 104, 124, 305                 |
| `keeperX`                   | `goalX - 6`                                                                                        | 103, 98, 118, 299                  |
| `farTouchY`                 | `groundY - 9`                                                                                      | 137, 106, 147, 131                 |
| `nearTouchY`                | `groundY + round(H * 0.12)`                                                                        | 180, 142, 192, 172                 |
| `actionTop`, `actionBottom` | `H * 0.31` to `H * 0.53`: visible in every state                                                   | 87 to 149 at 281                   |
| `boardAskingY`              | the board's bottom edge while a question is asked                                                  | 84, 67, 90, 81                     |
| `boardShrunkY`              | the board's bottom edge after an answer                                                            | 51, 40, 54, 49                     |
| `answerBarY`                | top of the answer bar                                                                              | 253, 200, 270, 243                 |
| `sheetY`                    | top of the reveal sheet                                                                            | 152, 120, 162, 146                 |

Visible while asking: `boardAskingY` to `answerBarY`. Visible after an answer: `boardShrunkY`
to `sheetY`. If a number matters to more than one painter, it goes in this file.

## The menu ball (`~/art/ball`)

```ts
type BallSlot = "left" | "right" | "top" | "bottom" | "backLeft" | "backRight";
const BALL_SLOTS: readonly BallSlot[];      // all six, in that order
type BallIcon = "home" | "away" | "forward" | "rewind" | "pin" | "globe" | "lock" | "none";
interface BallPatch { label: string; icon: BallIcon;
                      accent?: { dark; base; light }; locked?: boolean; badge?: string }
interface BallState { cx; cy; r; yaw; pitch; roll?; hovered; pressed; chosen; t }
type BallPatches = Partial<Record<BallSlot, BallPatch>>;

drawBall(s, state, patches, light)         // the ball
ballSlotAt(state, x, y): BallSlot | null   // hit test: exactly what the renderer drew
ballSlotCenter(state, slot): { x, y, facing }   // facing 1 straight on, 0 on the rim, < 0 behind
ballShowPose(slot): { yaw, pitch, roll }   // the pose that shows a slot
drawBallShadow(s, state, groundY, light)   // a shadow on a ground line, for a ball that rests on one
```

The slots, and what the menu puts on them:

| slot        | where (yaw 0, pitch 0)                      | menu             | icon      | shown by `ballShowPose`          |
| ----------- | ------------------------------------------- | ---------------- | --------- | -------------------------------- |
| `left`      | level, 31.7 degrees left of the middle      | HOME, red-orange | `home`    | the menu pose                    |
| `right`     | level, 31.7 degrees right                   | AWAY, teal       | `away`    | the menu pose                    |
| `top`       | 58.3 degrees above the middle               | NEXT-GEN, locked | `forward` | pitch -58.3 degrees: straight on |
| `bottom`    | 58.3 degrees below                          | RETRO, locked    | `rewind`  | pitch +58.3 degrees: straight on |
| `backRight` | on the back, directly behind `right` (AWAY) | CLOSEST, locked  | `pin`     | yaw pi: where `left` (HOME) was  |
| `backLeft`  | on the back, directly behind `left` (HOME)  | FURTHEST, locked | `globe`   | yaw pi: where `right` (AWAY) was |

The other six pentagons (four on the rim, two on the back, top and bottom) carry nothing and
never hit-test.

- The menu's ball floats in front of the picture and has no ground under it, so the menu scene
  draws **no shadow**: it calls `drawBall` and `ballSlotAt` and nothing else here.
  `drawBallShadow` is kept for a scene whose ball lies on the ground (draw it first, then the
  ball); only the ball's own shots use it today.
- A real 32 panel ball on a sphere, so it can rock, spin and fly. Radians. Positive `yaw` turns
  the front to the right, positive `pitch` rolls it up and away (a ball struck towards the
  stand), positive `roll` is clockwise.
- **A button** (a patch with an `accent` and not `locked`) wears its colour as a line round the
  pentagon, in its icon and in a tab under its word. **A locked patch** never takes a colour:
  its picture with a small padlock at its foot, in mist (chalk while hovered or pressed, when
  the pentagon also lifts a step), so HOME and AWAY lead. Facing the viewer (`facing` at least
  0.62) it adds its word under them; a word wider than the patch (at r = 45 NEXT-GEN, CLOSEST
  and FURTHEST, not RETRO) sits on a dark ink tag that may run over the seams onto the leather,
  moved in as far as it must be to stay inside the outline, and dropped if it cannot. Squashed
  far round (the top and bottom slots in the menu pose) it wears small five-row pictures beside
  the small padlock from r = 44, the small padlock alone below. Icon `lock` is the padlock
  alone; below r = 30 a locked patch shows only the padlock, below 26 nothing.
- **Nothing on a locked patch flickers.** What it carries (picture or not, word bare or on a
  tag) is decided by the radius alone, from room measured once per size at both ends of the
  rock and of a deep nod (0.065 rad): top and bottom straight on, the others in a side place
  (where CLOSEST and FURTHEST rest after half a turn), and the squashed top and bottom of the
  menu pose. A test holds every shown pose to it.
- `hovered`, `pressed` and `chosen` are slots or `null`. `chosen` flashes at 8 Hz off `t`.
  A bar of light crosses HOME then AWAY every five seconds off `t` (off at `t = 0`). There is
  no reduced-motion input: hold `t` still.
- `badge` puts a small plate on the patch (a score once the mode has been played).
- `accent` is usually `MODE_COLORS[mode]`.
- What a button shows depends on the radius: big icons and words from r = 56, icon and word
  from 37, icon only below 37, only the coloured line below 26; and on how far it faces the
  viewer: the icon from `facing` 0.5, the word from 0.62. The menu ball is 36 to 60 px.
- The menu rocks the ball by 0.12 rad of yaw; the label fit is measured for that.
- Shots: `ball/menu`, `states`, `states-small`, `rock`, `sizes`, `flight`, `spin`, `badge`,
  `shine`, `fit`, `modes` (every patch in the pose that shows it), `modes-fit` (those poses at
  r 37 to 59, at both ends of the rock).

## The home-screen stadium (`~/art/stadium`, `~/art/led`)

```ts
interface MenuSign {
  header: string; // the first line, in green: "DID YOU KNOW?" (strings.home.canvas.header)
  text: string; // the fact of the day, in amber: it scrolls
}
class MenuBackdrop {
  constructor(opts: { seed: number; sign: MenuSign });
  resize(w, h): void;
  setLighting(light): void;
  setSign(sign: MenuSign): void; // drawn in capitals on one line (runs of spaces and line breaks become one space)
  setMoonPhase(phase: number): void; // 0 new, 0.5 full
  target(): { x: number; y: number }; // the centre spot of the pitch: (cx, menuLayout().spotY)
  setRoar(amount: number): void; // 0 an ordinary matchday, 1 the whole place erupting
  draw(s: Surface, t: number): void; // covers the whole surface, sky included
  airshipAt(x: number, y: number, t: number): boolean; // on the airship at scene time t (false while it is down)
  pokeAirship(t: number): "wobble" | "pop" | "none"; // a click on it at scene time t
}
```

This class is the **backdrop contract**: the menu scene uses nothing else of the backdrop, and
of `menuLayout` only `cx`, `ballR`, `ballCy` and `logo` (a test in `app/scenes/menu.test.ts`
holds it to that). The scene itself is in `docs/API_SCENES.md`.

**The picture.** A football stadium seen from the air, in its town, under the player's own sky.
One camera for everything: high up to the south, looking north and down, so the ground is a
plane running away to a horizon between a quarter and a third of the way down the screen.
Verticals stay vertical, a circle on the ground is an ellipse, further away is higher up and
smaller. The stadium is whole in the middle (about 65% of a monitor's width, all of a phone's):
a pale roof ring over a packed bowl, warm red-orange walls, the pitch and a match inside. The
menu ball floats in front of its near side. It paints everything on the home screen except the
ball, the wordmark and the DOM captions.

**The town plan** (`stadium-plan.ts`; map units, the centre spot at the origin, north up):

- **Stadium Road** runs east-west in front of the ground. The plaza crosses it on a wide zebra.
  South of it: to the west a street of terraced houses with back gardens, and the pub on the
  plaza corner with its beer garden; to the east the big car park, the pie van at its corner.
- **West Road** and **East Road** run north either side of the concourse. West: the coach park
  (the away coaches in teal), then Western Avenue (a dual carriageway with trees down the
  middle), then the terraces and the school of Westgate.
- East: **Victoria Park** (a pond with an island, a bandstand, a kickabout, a dog walker), then
  Park Lane and more houses.
- Behind the ground: North Road, allotments, a car park, the station forecourt, then the
  **railway** with Stadium Halt to the north east.
- Beyond the railway: the old town (terraces, mills, tower blocks, a church, a gasometer), the
  river and its bridges, fields and woods, hills with wind turbines, and on the horizon the
  **city**: the business district's towers right of the middle, the cathedral and the old town
  left of it, cranes, a television tower. The sun's column is the gap between the two clusters.

**The sign** is a dot-matrix panel (`~/art/led`) on the flank of an airship, which drifts 2 px
either way at the upper left of a monitor (under the wordmark on a phone). Its panel at rest is
`menuLayout().scoreboard` (92 x 35 on a monitor, 90 x 33 on a 130 px phone). It carries the
**fact of the day** (`app/data/facts.ts`, `factForDay`), not the stadium: the stadium belongs to
the game. Two lines, centred in the panel's height: the header in green in `FONT_3x5`, and
5 rows under it the fact in amber in `FONT_5x7`, in capitals, as one marquee (`drawSignText`
in `stadium-airship.ts`). The marquee's window is the panel less 3 px each side (86 px, about
14 letters). It starts flush left with the fact's first words and rests `SIGN_PAUSE` (2.5 s),
then runs left in whole pixels at `SIGN_SPEED` (20 px a second: one pixel every third frame at
60 Hz, so the steps are even) until the start comes round again after a blank `SIGN_GAP`
(36 px), lands exactly where it began and rests again. The 60 facts are 342 to 560 px long in
`FONT_5x7`: a whole fact passes in 17 to 28 s, and a lap with its pause and gap takes 21 to
32 s. The marquee has its own clock: the scene's time until the first pop; a falling or
wrecked sign stands still on the start of the fact; a new airship arrives showing the start
and, once in its place (`RETURN + ARRIVE` after the pop), rests 2.5 s and runs on from there.
A poked airship's sign keeps scrolling while it rocks (it flickers off under the hardest
pokes). Every character of every fact is in `FONT_5x7` (a test checks all sixty; an unknown
character would draw as a box).

**Poking the airship** (`stadium-airship-poke.ts`, `stadium-airship-fall.ts`). The scene asks
`airshipAt(x, y, t)` for the cursor and for a click, then calls `pokeAirship(t)` with the same
`t` (the poke then dents the envelope where the pointer was). Every poke: the envelope dents
and springs back, the airship lurches away from the click and rocks, squashes and stretches,
and the sign flickers. Each poke adds 1 to its stress, which relaxes to 1/e every 3 s
(`RELAX`); it bursts when a poke would take it to 4.4 (`POP_AT`): the 5th or 6th of quick
clicks (0.12 to 0.4 s apart), never a click a second or slower (that settles at 3.5). Rising
stress shows: past 0.3 of the way the seams and a seam along the top go taut, past 0.6 they
are stitched in red and straining, past 0.4 a hard poke puffs gas from the tail, past 0.5
the pilot waves from the gondola, past 0.7 it trembles and swells. The pop: a white flash,
rays, "POP!", shreds of envelope flung out; then the sign and gondola fall for 2.8 s
(`FALL`), spinning two turns and swinging, shrinking into the distance, the empty envelope
fluttering above on two tethers, and land in the town where `findCrashSite` chose: open grass
(or the pond, preferred if it is near) clear of the ball and captions, as near as possible to
straight below (480 x 270: the lawn by West Road, left of the stadium). On grass it bounces
and raises dust; in water it splashes, rings spread and it sinks with bubbles. The pilot jumps
at the pop, floats down under a parachute, lands beside it and waves. On phones there is no
open grass: it comes down on the allotments behind the stadium and the pilot lands on the
roof. The wreck is cleared (dithered away) 8.6 to 9.6 s after the pop; at 10 s (`RETURN`) a
new airship drifts in from the left and is in place 4.5 s later (`ARRIVE`). `"none"` while it
is down. The state is the poke and pop history (kept apart from the cached paint, so
`resize`, `setLighting` and `setSign` keep it); `draw` is a pure function of it and `t`,
and an airship never poked draws exactly as before. The crash site is chosen once per size.

**What moves** (`stadium-life.ts`; all a pure function of the time and the seed):

- **The match** (`stadium-match.ts`): a scripted passage of play 40 seconds long that loops
  exactly. Kick-off, an interception, a build-up to the left wing, a cross, a header saved (the
  crowd gasps), a break by the away side, a long ball, a goal (arms up all round and a wave
  through the stands), the celebration, the walk back. `matchAt(state, t)` gives 22 players, the
  referee and the ball in map units; movement is stepped at 8 a second.
- **The car park** (`stadium-parking.ts`) is parked full for the day and painted with the
  town: no car drives in or out (the product owner found the parking animation odd). Its bays
  run north on the map, so on screen they lean towards the vanishing point; every parked car
  is drawn along its bay (`mapHeading`) and sits inside the bay's lines (a test checks every
  pixel), the same in the coach park.
- **Cars point the way they go** (`stadium-cars.ts`). A car's sprite is chosen from its
  direction on screen, from 24 headings 15 degrees apart (0 east, anticlockwise; 6 up the
  screen). Seven are hand-placed for each of the three sizes (east, 15, 30, 45, 60, 75,
  north: body, roof, glass with a windscreen at the front, the side towards the camera in
  shade, and the lamps on a second grid); the rest are those mirrored, or turned round (the
  windscreen and the lamps swap ends, the shade stays at the bottom). Coaches and buses use
  the same set: the east-west and north-south coaches are hand-placed and the slanted ones
  sheared from them. Every moving car, bus and coach is within half a step (7.5 degrees) of
  its way on screen (a test samples five minutes at three sizes). The away coach turns into
  its bay on a quarter circle and backs out the same way. The buses on the avenue are drawn
  as buses.

  ```ts
  HEADINGS = 24; HEADING_STEP = 15; EAST = 0; NORTH = 6; WEST = 12; SOUTH = 18;
  headingAngle(h): number                           // degrees
  headingOf(dx, dy): number                         // nearest heading to a screen direction (dy down)
  groundHeading(view, X, V, dX, dV): number         // heading of a way on the map at (X, V)
  mapHeading(view, X, V, dir): number               // dir 0 east, 1 west, 2 north, 3 south
  carSprite(ink, x, y, cls, heading, look: CarLook) // car() in stadium-things adds the shadow
  carLamps(ink, x, y, cls, heading, state: 1 | 2)   // 2: reversing (white tail lights)
  coachSprite(ink, x, y, cls, heading, look: CoachLook)
  coachLamps(ink, x, y, cls, heading, state: 1 | 2)
  ```

  `car(s, x, y, cls, heading, look)` in `stadium-things.ts` now takes a heading (it took 0 to
  3 for east, west, north, south). Stadium Road's cars, pointing east and west, are unchanged.

- **Stadium Road and its zebra** (`stadium-road.ts`): a car and a person are never on the
  zebra at once. Every 25 s (`CYCLE`) it belongs to the cars for 17.45 s (`CARS_UNTIL`), then
  to the people. Each lane runs platoons of up to 4 cars (`PLATOON`, 1.3 s apart, about 4 in
  10 slots left empty) at a steady 8 units a second, timed to reach the stripes as the cars'
  window opens and to be off them 0.5 s (`MARGIN`) before it closes; people step on to the
  stripes only from 0.5 s after their window opens to 0.5 s before it ends. Cars only (buses
  run on the avenue). `roadBusy` counts every slot as taken, `crossingBusy` adds the zebra's
  windows (`onZebra`, `peopleWindow`).
- **People give way** (`stadium-crossing.ts`): a walker who reaches the kerb with a car coming,
  or the zebra in the cars' window, waits there and crosses in one go (the plaza's walkers, the
  pie van's customers, the people from the far end of the car park; a few from the pub cross
  in a gap away from the zebra). Cars keep their timetable. It is still a pure function of the
  time: the traffic repeats every cycle, so each walk is planned once (`planWalk`, memoised
  per size and seed) and `walkAt` reads it; a walker's lap is a whole number of cycles. A test
  steps 20 minutes frame by frame (60 a second) at 480 x 270 and 130 x 281: never a car's
  footprint and a person's on the stripes together, nobody ever under a car.
- **How busy**: a third fewer movers than before the product owner asked for "slightly less"
  (480 x 270, averaged over a minute: cars 87 to 60, of them Stadium Road 16 to 7; people
  walking 84 to 56, of them on the plaza and the road 28 to 19). The crowd in the stands and
  the queues at the turnstiles are unchanged. `Life.people(t, fn(X, V, waiting, who))` and
  `Life.cars(t, fn(X, V, heading, fX, fV))` list the movers for tests (`who` is the same
  number all along a walk; `fX, fV` is the way the nose points on the map), and
  `Life.standers(fn(X, V))` the people standing about. Nobody stands on Stadium Road: a spot
  there is dropped (the groups by the wall used to reach the road, and the cars drove through
  them on the zebra).
- **Fewer people at night**: the share of walkers out follows the sun (`walkersOut(light)`):
  all by day and at golden hour, fewer at dusk and dawn, 0.28 at night. At 480 x 270, over
  four minutes: 56 walking by day, 38 at dusk, 20 at night (about a third: the pie van's
  customers keep coming). A walker is out for a whole lap or not at all (a hash of who and
  which lap), so people come and go only at the ends of their walks: the edges, the
  turnstiles, the pub, the station, the coaches, the pie van (a test steps 400 s at night and
  at dusk on a monitor and a phone). The traffic thins more gently (`carsOut`: 0.6 at night,
  58 cars to 38), a car missing for a whole lap of its road or a whole pass on Stadium Road.
  The queues, the stewards, the groups on the plaza, the away fans and the crowd stay. By day
  nothing changes. It is still a pure function of the time and the light.
- **Fireworks for the goal**: when the home side scores (`GOAL_AT`, 26 s into the match's
  loop) five small rockets go up from the roof over the far stands, 0.2 to 2.2 s after the
  ball goes in, climb for 0.4 s and burst in streaks of the club's red-orange and gold for
  1.1 s by day (a radius of 7 to 9 px at 480 x 270, the strong tones against a pale sky) or 1.5 s
  by night (9 to 12 px, the light tones with a glow); all over 4.2 s after the goal
  (`FIREWORKS`, `fireworksAt(t, night)` counts the rockets up). Each goes up where its burst
  stays clear of the logo's sky and of the airship (`makeLife(..., clear)` gets the airship's
  box from `MenuBackdrop`); on a phone the airship covers the sky over the far stands, so there
  are none. Under reduced motion the scene's slower clock slows them too. With `setRoar` above
  0.45 the roar's own fireworks take over.
- An **away coach** comes up West Road, turns into its bay, and the away fans walk round to
  their turnstiles with a steward; later it backs out and drives on. A **train** brakes into
  Stadium Halt, waits and leaves. The **queue at the pie van** shuffles up a place every five
  seconds; each customer served walks from the hatch to the kerb, waits, crosses and goes up
  to a turnstile. Supporters stream up the plaza, queue at the turnstiles and stroll in the park;
  traffic on the other roads; flags, chimney smoke, wind turbines, gulls, cloud shadows by
  day; at night headlights and tail lights, lit windows, lamp pools, red lights on the towers.
- **The match ball** has an ink edge on the grass beside it (never over a player) and the home
  side wears dark red shorts, so the ball is the only white thing moving on the pitch.
- **At night** with the floodlights on, the roof is lit: its inner half pale blue, its outer
  half steel, a bright ring between. It is never darker than that glow, so nothing jumps when
  the lights come on at dusk. By day the roof is unchanged.
- **`setRoar`**: the crowd's arms up and flashbulbs (the away pocket keeps its arms down for
  the home goal), flares in the home end, ticker tape over
  the bowl, fireworks from the roof, the floodlights flaring, the people outside jumping, the
  flags going faster. Nothing of it at 0.

**Files**: `stadium.ts` (the class), `stadium-view.ts` (the camera), `stadium-plan.ts`,
`stadium-town.ts`, `stadium-bowl.ts`, `stadium-things.ts` (sprites in three fixed sizes),
`stadium-skyline.ts`, `stadium-airship.ts` (and `-poke.ts`, `-fall.ts`), `stadium-life.ts`,
`stadium-match.ts`, `stadium-parking.ts` (the car park's layout), `stadium-road.ts` (Stadium
Road's timetable and the zebra, `roadBusy`), `stadium-crossing.ts` (people giving way),
`stadium-cars.ts` (cars and coaches at every heading). The first version of the home screen, a view from the centre circle, is
kept as reference in `stadium-inside.ts` (`InsideBackdrop`, with its frozen layout in
`stadium-inside-layout.ts` and its shots as `inside/*`): it is not used by the game.

- The static picture is painted once per size and light and cached (the land, the skyline, the
  airship, a depth mask that lets moving things pass behind trees and lamp posts). A frame is the
  sky, two copies and the moving things: 0.2 to 0.5 ms at 480 x 270 (0.9 ms at 720 x 360); the first frame after a change of size or
  light costs 15 to 35 ms on a phone, about 45 ms at 480 x 270 and 90 ms at 720 x 360.
- Those figures are from Node with the code warm. In Chrome at 1920 x 1080 (480 x 270) a whole
  frame of the home screen, backdrop, ball and wordmark, is 1.4 to 2.5 ms on average; the first
  frame of a page just loaded is 120 to 180 ms (the code is cold), and a later change of light 40
  to 80 ms. `draw` allocates about 140 KB a frame: see "Known weak points".
- No reduced-motion input: pass a slower `t`.
- Shots: `stadium/full`, `composed` (with the real ball and wordmark), `sign` (a close crop;
  `--strip 8 --dt 0.5 --t 2.5` watches it scroll), all with the fact of day `--seed`,
  `roar` (with a marker at `target()`), `captions` (what the DOM leaves visible), `airship`
  (eight frames: a poke, a poke near bursting, the pop, the fall, the crash, the pilot down,
  the new airship drifting in), `zebra` (a crop of the zebra, no ball: use `--strip`),
  `cars` (every heading at each size, by day and with the lamps by night, and the coach; a
  grey tick shows the true direction), `led/panel`.

`~/art/led` is the shared dot-matrix panel:

```ts
drawLedPanel(s, x, y, w, h, { grade? }): Zone   // housing and unlit lamps; returns the lamp field
drawLedLine(s, text, x, y, width, { font?, color?, t?, align?, speed?, pause?, gap? }): boolean
ledField(x, y, w, h): Zone
```

A line that fits is placed by `align`. A longer one starts flush left, pauses, scrolls one lap in
whole pixels and is back at its start (returns `true` when it scrolls). It draws the text as
given: capitalise first.

## The logo (`~/art/logo`)

```ts
interface LogoOptions { maxWidth: number; maxHeight?: number; t?: number; tagline?: string;
                        reducedMotion?: boolean }
logoSize(opts): { w, h, stacked }
drawLogo(s, cx, top, opts): { w, h }   // centred on cx, top row at `top`
```

- One line (132 x 17) when `maxWidth` is 132 or more, otherwise SOCCER over SENSE (74 x 31).
  Sizes include a 2 px shadow that hangs off the right and the bottom. With a tagline it is
  7 rows taller; the tagline is dropped when it does not fit `maxWidth` or `maxHeight`.
- On phones pass a `maxWidth` of at most 104 so the stacked layout is used.
- Raw palette colours on purpose: the wordmark is interface, not scenery.
- A streak of light crosses it every 6 s off `t` (nothing at `t = 0` or with `reducedMotion`).
- Shots: `logo/stacked`, `line`, `tagline`, `on-skies`, `menu`, `glint`.

## Putting the home screen together

```ts
const m = menuLayout(s.w, s.h);
backdrop.draw(s, t); // MenuBackdrop
drawBall(s, ball, patches, light); // floating: ball.cx = m.cx, cy = m.ballCy plus a bob, r = m.ballR
const opts = { maxWidth: Math.min(s.w - 26, 132), maxHeight: m.logo.h, t };
drawLogo(s, m.cx, Math.floor((m.logo.h - logoSize(opts).h) / 2), opts);
```

## Characters (`~/art/characters`)

The people of the career scene: the footballer (adult and youth), the goalkeeper, the match
ball, the trophy and a dust puff. Import from `~/art/characters` only.

```ts
interface Kit { outline; skin; skinShade; hair; shirt; shirtShade; trim; shorts; socks; boots; gloves } // Colors
type KitBase = "home" | "away" | "casual-home" | "casual-away" | "casual" | "rival" | "keeper"
             | "national-home" | "national-away" | "referee";
makeKit(base, opts?: { look?: 0 | 1 | 2; variant?: number }): Kit
HERO_LOOK: 0 | 1 | 2            // 1: skinB, dark hair. The hero's look at every tier.
litKit(kit, light): Kit         // every slot through light.lit; do it once per light, not per frame

type PlayerAnim = "idle" | "run" | "kick" | "juggle" | "celebrate" | "dejected" | "lift" | "shrug" | "slide";
PLAYER_ANIMS: Record<PlayerAnim, { frames; fps; loop }>
KICK_STRIKE_FRAME = 2
drawPlayer(s, anim, frame, x, y, kit, opts?: { flipX?; youth? }): void
ballSpot(anim, frame, opts?: { flipX?; youth? }): { x; y } | null
handsSpot(anim, frame, opts?: { flipX?; youth? }): { x; y } | null

type KeeperAnim = "ready" | "leap" | "smother" | "hold" | "beaten";
KEEPER_ANIMS: Record<KeeperAnim, { frames; fps; loop }>
drawKeeper(s, anim, frame, x, y, kit, opts?: { flipX? }): void
keeperHands(anim, frame, opts?: { flipX? }): { x; y } | null

drawMatchBall(s, x, y, frame, light, opts?: { gold? }): void   // (x, y) the ball's centre
drawTrophy(s, x, y, light, glint?): void                      // (x, y) the middle of its base
drawPuff(s, x, y, frame, color): void                          // (x, y) the ground point under it
```

- **Anchor.** `(x, y)` is the ground point under the standing feet: the soles' outline is row
  `y - 1`, the cell's left edge `x - floor(cellW / 2)`. Adult 12 x 18 in 16 x 20, youth 10 x 14
  in 14 x 16 (`PLAYER`, `YOUTH`, `KEEPER` in `~/art/layout`). Nothing draws outside the cell.
  Everyone faces right; `flipX` faces left. Spots are offsets from `(x, y)`; a flipped spot is
  `-dx - 1` (the exact mirror of the pixels), and the functions already do this.
- **Frames.** `frame` is a running counter: looping animations wrap, one-shots hold their last
  frame. Pick it with `frameAt(t, fps, frames)` (loops) or `min(floor(t * fps), frames - 1)`.
- **Light.** Draw with `litKit(kit, light)`, and pass `light` to the ball and trophy. The
  outline is in the kit, so it is graded too.
- **Kits.** home: red-orange shirt, chalk shorts. away: teal, night shorts. casual-home and
  casual-away: a top in the mode colour, park shorts, white socks. casual: `variant` picks the
  top (6, never a mode colour, gold or green) and the shorts (4). rival: plum, reads on grass
  and clashes with neither mode. keeper: gold and night with lime gloves, a colour nobody else
  wears. national-home and national-away: chalk with the mode colour as trim. referee: near
  black. `look` 0 skinA and brown hair, 1 skinB and dark hair, 2 skinC and dark hair. Only the
  keeper kit has gloves: in every other kit the glove slot is the bare hand.
- **The tier 0 and 1 keeper** is a child in the keeper kit on the youth frames, drawn with
  `{ youth: true, flipX: true }`. The youth frames draw his hands in the glove slot, so he
  wears the gloves. Use idle for ready, and celebrate, dejected and shrug.

| anim      | frames @ fps | loop | notes                                                                         |
| --------- | ------------ | ---- | ----------------------------------------------------------------------------- |
| idle      | 2 @ 2        | yes  | breathing: head and shoulders drop 1 px                                       |
| run       | 4 @ 10       | yes  | contact, passing (up 1 px), contact, passing; feet and arms alternate         |
| kick      | 5 @ 10       | no   | wind-up, plant, **strike (2)**, follow-through, recover                       |
| juggle    | 8 @ 7        | yes  | touches on 0 (foot), 2 (knee), 4 (foot), 6 (head, on his toes); hops between  |
| celebrate | 3 @ 6        | yes  | crouch, tuck jump with fists up (feet 3 px off the ground), land with arms up |
| dejected  | 2 @ 1.5      | yes  | head bowed, hands on hips; a sigh                                             |
| lift      | 2 @ 3        | yes  | both arms up holding the trophy over his head; the second pumps it up 1 px    |
| shrug     | 2 @ 2.5      | no   | palms out and shoulders up, then back to rest                                 |
| slide     | 2 @ 4        | yes  | on his knees, leaning back, fists up; move him along the grass yourself       |
| ready     | 2 @ 2        | yes  | keeper: crouched, gloves forward, bobbing                                     |
| leap      | 3 @ 8        | no   | keeper: crouch, full stretch up and back, hang                                |
| smother   | 2 @ 8        | no   | keeper: diving down forward, then lying on the ball                           |
| hold      | 1            | yes  | keeper: standing, ball to his chest                                           |
| beaten    | 1            | yes  | keeper: on his knees; drawn looking back over his goal line                   |

Spots (adult, then youth; `x` right, `y` up is negative):

- `ballSpot("kick", 0..2)`: the ball at rest in front of him, `(7, -2)` (youth too). Draw it
  there from the set until the strike frame, then fly it from that point. `null` on 3 and 4.
- `ballSpot("juggle", f)` on every frame. Adult: `(4,-7) (6,-12) (4,-11) (6,-16)` then
  `(4,-7) (3,-22) (1,-20) (6,-12)`. Youth: `(4,-6) (5,-10) (3,-9) (5,-13)` then
  `(4,-6) (3,-18) (1,-17) (5,-9)`. Even frames are touches; odd frames are the top of the
  hop. For a smoother ball, move it between this frame's spot and the next along `arc()`.
- `handsSpot("lift", f)`: adult `(0,-17) (0,-18)`, youth `(0,-13) (0,-14)`:
  `drawTrophy(s, x + h.x, y + h.y, light, glint)` puts the cup on his raised hands.
- `keeperHands`: ready `(4,-8) (4,-7)`, leap `(-6,-8) (-5,-18) (-6,-18)`, smother
  `(5,-5) (2,-3)`, hold `(3,-10)`, beaten `null`. For hold and smother 1 it is where the
  ball goes: draw the ball there after him.

**Using the keeper** (he stands at `keeperX` with `flipX: true`, facing the shooter; keep the
same `flipX` for every frame, the beaten frame already looks back at the goal):

- **High save or a top-corner goal** (`topbins`, `worldie` reaction aside): `leap` 0 for one
  frame as the ball is struck, then 1 (full stretch) and 2 (hang) while you lift him on an arc
  of about 5 px (`y - Math.round(arc(u) * 5)`), then back to `ready`. His gloves are at
  `keeperHands("leap", f, { flipX: true })` plus the lift: put a tipped-over ball just beyond
  them, or a goal a pixel past them.
- **Low save** (`ontarget` low, or a smother): `smother` 0 then 1 with the ball drawn at
  `keeperHands("smother", 1)`; then `hold` with the ball at `keeperHands("hold", 0)`. A ball
  straight at his chest (`ontarget`) goes straight to `hold`.
- **Goal conceded**: low (`goal`): `smother` 0 then 1 without the ball, then `beaten`. High:
  the leap, then `beaten`. `worldie`: hold `ready` frame 0 (frozen), then `beaten`.
- **Nothing happens** (`wide`, `timeup`, `skipped`): `ready`.

**The props.** The match ball is 3 x 3 (white, mist shade, a slate panel) with 3 spin frames;
pass a running counter as `frame`. `gold` is the worldie's trail. The scene draws its shadow.
The trophy is 9 x 12, a two-handled gold cup on a dark plinth, `glint` adds a white flash
on the bowl (light sources are raw colour: the glint is not graded). The puff is 7 x 5, three
frames (a kick of dirt, a cloud, drifting specks), one colour passed in: grade it yourself
(`light.lit(P.grassHi)` on grass, `light.env(P.woodDark)` for park mud). Out of range frames
draw nothing.

Shots: `people/sheet`, `youth-sheet`, `keeper-sheet`, `kits`, `props`, `in-context` (a strip
of pitch at 480 x 90), `park`, and the motion shots `people/run`, `kick`, `juggle`,
`celebrate`, `lift`, `leap`, `smother`, `youth-run`, `youth-kick`, `youth-juggle` (use
`--strip 8 --dt 0.1`).

Files: `kit.ts` (kits), `figure.ts` (fill-only art outlined at load, the shared legend),
`adult.ts`, `youth.ts`, `keeper.ts` (the frames as text), `people.ts` (tables, spots,
drawing), `props.ts`, `index.ts`. Sprites are built once, on first use; drawing allocates
nothing.

## Grounds (`~/art/grounds`)

The career scene's ground (`docs/CAREER_SCENE.md`): sky, his street, the stands, the crowd,
the pitch, the goal and the near side, at each of the eight tiers.

```ts
type Tier = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;              GROUND_TIERS: readonly Tier[]
type CrowdMood = "idle" | "hush" | "ooh" | "groan" | "cheer" | "roar" | "party";   CROWD_MOODS
interface GroundGoal { kind: "jumpers" | "small" | "full"; lineX: number; barY: number; depth: number }
interface NetBulge { y: number; amount: number }          // amount 0 to 1
interface GroundLabels { boards?: readonly string[]; banners?: readonly string[] }
interface GroundPodium { x: number; top: number; w: number }  // tier 7: his feet on (x, top)
const FINAL_NIGHT: Lighting;                               // the light of tiers 6 and 7

class CareerGround {
  constructor(opts: { seed: number; mode: Mode; tier: Tier; labels?: GroundLabels });
  resize(w: number, h: number): void;
  setLighting(light: Lighting): void;      // the player's sky; ignored at tiers 6 and 7
  setMode(mode: Mode): void;
  setTier(tier: Tier): void;               // out-of-range tiers are clamped
  setMood(mood: CrowdMood, t: number): void;   // the reaction starts at scene time t
  readonly goal: GroundGoal;
  readonly light: Lighting;                // grade the cast with this: night at tiers 6 and 7
  readonly podium: GroundPodium | null;    // tier 7 only
  drawBack(s: Surface, t: number): void;   // every pixel, then the goal's back layer
  drawFront(s: Surface, t: number, bulge?: NetBulge | null): void;
}
```

- Draw order: `drawBack`, the cast and the ball, `drawFront`. `drawFront` is the goal's front
  layer (roof and back of the net, the near side's netting, the crossbar, the near post) and,
  at tier 7, ticker tape. A ball in the net shows through the mesh. A surface of another size
  than the last `resize` resizes the ground itself.
- The goal per tier, at the feet row `groundY` and goal line `goalX` of `careerLayout`:

  | tier   | kind      | `barY`         | `depth` | posts                                                                  |
  | ------ | --------- | -------------- | ------- | ---------------------------------------------------------------------- |
  | 0      | `jumpers` | `groundY - 15` | 0       | jumper piles at `(goalX - 3, groundY - 3)`, `(goalX + 1, groundY + 2)` |
  | 1      | `small`   | `groundY - 17` | 8       | a wonky near post, a sagging net                                       |
  | 2 to 7 | `full`    | `groundY - 24` | 11      | 2 px posts                                                             |

  The near post stands on `(goalX + 1, groundY + 2)`, the far post on `(goalX - 3, groundY - 3)`.
  The bulge pushes the back of the net right by up to 5 px, 8 rows either side of `y`.

- Moods: the crowd (3 x 4 fans) and the people standing to watch react from the `t` given
  to `setMood`: `cheer` jumps with arms up for about 2.6 s, then bobs and holds scarves to 6 s;
  `roar` is longer (to 9 s) with scarves held up and camera flashes; `ooh` and `groan` put
  hands on heads for about 2 s; `hush` holds everyone still; `party` never stops. Then they
  go back to idle bobbing. In AWAY mode the hostile crowd feels the opposite (they groan at his
  goal and cheer his miss); the teal pocket of travelling fans is with him.
- Light: tiers 0 and 1 are lit by the sky (`env`), with the street lamp's warm pool over the
  stage at night; tiers 2 to 5 are floodlit at night (`lit`); tiers 6 and 7 always use
  `FINAL_NIGHT`. Lamps, lit windows, LED text and fireworks are raw palette colour.
- Words come only from `labels`: `boards` on the painted boards (tiers 2 and 3), the
  scoreboard (tier 3, the first board) and the crawling LED boards (4 up); `banners` on the
  balcony from tier 5. Without labels the boards show plain stripes.
- Crowd colours: HOME his colour (more of it each tier; chalk and his colour from tier 5);
  AWAY the rival's plum (`duskMid`, `duskTop`, as the rival kit) with a teal pocket in the far
  stand (its upper tier from tier 4).
- Shots: `ground/tier0` to `ground/tier7` (stand-in cast), `ground/ladder` (all eight),
  `ground/away`, `ground/moods`, `ground/goal` (the three kinds, a ball in the net, bulge 0,
  0.5, 1), `ground/guides` (tier 4 with the interface's edges and the stage).
- Cost (Node, warm, 480 x 270): a frame (`drawBack` + `drawFront`) 0.2 to 0.8 ms; a rebuild
  after a change of size, light, tier or mode 4 to 13 ms (the first one, cold, up to 35 ms).
  A frame allocates 0.5 to 3 KB, about what `drawSky` alone makes (2.3 KB); the ground's own
  drawing reuses its objects and typed arrays.

**Building blocks** (`app/art/grounds/`): `ground.ts` (the class: builds one cached layer per
size, light, tier and mode, and the per-frame order), `paint.ts` (geometry `geoFor`, the paint
context, `sx(g, offset)` to place things on the stage, `across` for lines that lean like the
goal posts, the crowd colour tables), `far.ts` (his street `paintStreet`, `paintHedge`,
`paintHut`, `paintClubGround` tier 2, `paintProperGround` tier 3, `paintStadium` tiers 4 to
7, `fanBlock` for any block of seats, `paintBoards`), `pitch.ts` (grass, lines, the lamp's
pool, photographers, the podium), `near.ts` (the near side per tier, `crowdBacks`), `goal.ts`,
`people.ts` (fans, watchers, people from behind, the dog, `poseFor`), `life.ts` (everything
that moves: a build fills a `Life`, the frame draws it). To add a tier: paint its far side
in `far.ts` (heights are measured up from the far touchline `g.F`; his street's foot is
`g.B`; place things with `sx(g, offsetOnThe130pxStage)`), its near side in `near.ts`, hand
anything that moves to the `Life`, and call it from `CareerGround.build`.

## Known weak points

- The sun jumps from the left column to the right at solar noon (once a day).
- Golden hour turns the pitch a little olive.
- The home screen on a phone: the airship hides most of the city's skyline, and the plaza under
  the ball is plain paving.
- Cars turn corners by swapping sprites.
- People crossing West Road and East Road (the away fans, the station crowd) do not give way:
  only Stadium Road, the car park's gate and its aisle are planned.
- At night the town is dark, with sparse lights; the roads do not glow and the car park is
  nearly black.
- The match is one passage of play: the home side scores every 40 seconds.
- At 720 x 360 a frame of the backdrop costs 0.9 ms and a change of light 90 ms.
- `MenuBackdrop.draw` makes garbage every frame: about 140 KB at 480 x 270 (measured in Chrome by
  allocation sampling: `drawCloudShadows` in `stadium-life.ts` about 40% of it, then `carLook`,
  `project`, `drawWalkers`, `person`). That is 8 MB a second for the collector, and it is where
  the frames of 5 to 6 ms come from. The scene contract asks `draw` to allocate nothing.
- The first frame in a browser is 120 to 180 ms, three times the Node figure, because nothing
  has been compiled yet. Painting the static picture in slices over a few frames, or in a
  worker, would take it off the page's first paint.
- `docs/ART_BIBLE.md` section 5 still lists the old "menu horizon (pitch edge) round(H * 0.44)".
- At radius 36 (a canvas 220 or 221 tall) the ball's patches show icons but no words.
- The top and bottom patches show a padlock only.
- `led.ts` has no tests.
