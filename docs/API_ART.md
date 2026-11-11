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

| field                       | meaning                                             | values             |
| --------------------------- | --------------------------------------------------- | ------------------ |
| `cx`                        | `round(W / 2)`                                      | 65, 60, 80, 240    |
| `groundY`                   | `round(H * 0.52)`, the row the players' feet are on | 146, 115, 156, 140 |
| `stageLeft`, `stageRight`   | the 130 px stage, centred                           | 0 to 130 at 130    |
| `heroX`                     | `cx - 26`, where the hero rests                     | 39, 34, 54, 214    |
| `goalX`                     | `cx + 44`, the goal line                            | 109, 104, 124, 284 |
| `keeperX`                   | `cx + 38`                                           | 103, 98, 118, 278  |
| `farTouchY`                 | `groundY - 9`                                       | 137, 106, 147, 131 |
| `nearTouchY`                | `groundY + round(H * 0.12)`                         | 180, 142, 192, 172 |
| `actionTop`, `actionBottom` | `H * 0.31` to `H * 0.53`: visible in every state    | 87 to 149 at 281   |
| `boardAskingY`              | the board's bottom edge while a question is asked   | 84, 67, 90, 81     |
| `boardShrunkY`              | the board's bottom edge after an answer             | 51, 40, 54, 49     |
| `answerBarY`                | top of the answer bar                               | 253, 200, 270, 243 |
| `sheetY`                    | top of the reveal sheet                             | 152, 120, 162, 146 |

Visible while asking: `boardAskingY` to `answerBarY`. Visible after an answer: `boardShrunkY`
to `sheetY`. If a number matters to more than one painter, it goes in this file.

## The menu ball (`~/art/ball`)

```ts
type BallSlot = "left" | "right" | "top" | "bottom";
interface BallPatch { label: string; icon: "home" | "away" | "lock" | "none";
                      accent?: { dark; base; light }; locked?: boolean; badge?: string }
interface BallState { cx; cy; r; yaw; pitch; roll?; hovered; pressed; chosen; t }
type BallPatches = Partial<Record<BallSlot, BallPatch>>;

drawBall(s, state, patches, light)         // the ball
ballSlotAt(state, x, y): BallSlot | null   // hit test: exactly what the renderer drew
ballSlotCenter(state, slot): { x, y, facing }   // facing 1 straight on, 0 on the rim
drawBallShadow(s, state, groundY, light)   // a shadow on a ground line, for a ball that rests on one
```

- The menu's ball floats in front of the picture and has no ground under it, so the menu scene
  draws **no shadow**: it calls `drawBall` and `ballSlotAt` and nothing else here.
  `drawBallShadow` is kept for a scene whose ball lies on the ground (draw it first, then the
  ball); only the ball's own shots use it today.
- A real 32 panel ball on a sphere, so it can rock, spin and fly. At yaw 0, pitch 0 two
  pentagons sit level left and right of the middle (HOME and AWAY) and two more above and below
  (locked slots). Radians. Positive `yaw` turns the front to the right, positive `pitch` rolls
  it up and away (a ball struck towards the stand), positive `roll` is clockwise.
- `hovered`, `pressed` and `chosen` are slots or `null`. `chosen` flashes at 8 Hz off `t`.
  A bar of light crosses HOME then AWAY every five seconds off `t` (off at `t = 0`). There is
  no reduced-motion input: hold `t` still.
- `badge` puts a small plate on the patch (a score once the mode has been played).
- `accent` is usually `MODE_COLORS[mode]`.
- What a patch shows depends on the radius: big icons and words from r = 56, icon and word from
  37, icon only below 37, only the coloured line below 26. The menu ball is 36 to 60 px.
- The menu rocks the ball by 0.12 rad of yaw; the label fit is measured for that.
- Shots: `ball/menu`, `states`, `states-small`, `rock`, `sizes`, `flight`, `spin`, `badge`,
  `shine`, `fit`.

## The home-screen stadium (`~/art/stadium`, `~/art/led`)

```ts
interface MenuStadiumInfo {
  name: string;
  city: string;
  country: string;
}
class MenuBackdrop {
  constructor(opts: {
    seed: number;
    stadium: MenuStadiumInfo;
    header?: string;
  });
  resize(w, h): void;
  setLighting(light): void;
  setStadium(stadium): void;
  setHeader(text: string): void; // the sign's first line; default "TODAY'S STADIUM"
  setMoonPhase(phase: number): void; // 0 new, 0.5 full
  target(): { x: number; y: number }; // the centre spot of the pitch: (cx, menuLayout().spotY)
  setRoar(amount: number): void; // 0 an ordinary matchday, 1 the whole place erupting
  draw(s: Surface, t: number): void; // covers the whole surface, sky included
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
either way at the upper left of a monitor (under the wordmark on a phone): the header, the
stadium's name (it scrolls when it is too long) and "CITY, COUNTRY". Its panel at rest is
`menuLayout().scoreboard`.

**What moves** (`stadium-life.ts`; all a pure function of the time and the seed):

- **The match** (`stadium-match.ts`): a scripted passage of play 40 seconds long that loops
  exactly. Kick-off, an interception, a build-up to the left wing, a cross, a header saved (the
  crowd gasps), a break by the away side, a long ball, a goal (arms up all round and a wave
  through the stands), the celebration, the walk back. `matchAt(state, t)` gives 22 players, the
  referee and the ball in map units; movement is stepped at 8 a second.
- **The car park** (`stadium-parking.ts`): ten of the bays in the first two rows are live. Every
  6 seconds one car comes along Stadium Road, turns in at the gate, drives down the aisle,
  reverses into its bay and stays; and one pulls out, drives to the gate and leaves. Its
  people get out and walk along the hedge, over the zebra and up to the turnstiles. The through
  traffic on Stadium Road is slotted between the timetable's cars, and is cars only (a bus
  would fill the gaps people cross in; buses run on the avenue). Tests walk the whole
  timetable: never two cars in a bay, never one through another.
- **People give way** (`stadium-crossing.ts`): a walker who reaches the kerb with a car coming
  waits for the gap and crosses in one go, on Stadium Road (the zebra, the pie van's customers),
  at the car park's gate and, for people leaving their cars, in the aisle. Cars keep their
  timetable. It is still a pure function of the time: the traffic repeats every 6 s, so each
  walk is planned once (`planWalk`, memoised per size and seed, about 10 ms once per size) and
  `walkAt` reads it. Tests run 20 minutes of every walker against every real car at 480 x 270
  and 130 x 281: nobody is ever touched.
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
`stadium-skyline.ts`, `stadium-airship.ts`, `stadium-life.ts`, `stadium-match.ts`,
`stadium-parking.ts` (the car park's timetable, `roadBusy`), `stadium-crossing.ts` (people
giving way). The first version of the home screen, a view from the centre circle, is
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
- Shots: `stadium/full`, `composed` (with the real ball and wordmark), `long-name`, `sign`,
  `roar` (with a marker at `target()`), `captions` (what the DOM leaves visible), `led/panel`.

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
