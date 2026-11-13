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
- `GRADE_COLORS[grade]`: worldie, golazo, trivela, toepoke, tapin, miss, timeup, skipped.
- The values are the art bible's table and match `app/ui/tokens.css` (a test compares them).
  Seven colours exist only here: `nightGlow`, `cloudLight`, `cloud`, `cloudShade`, `sun`,
  `moon`, `moonShade`. The grades are named `gradeWorldie`, `gradeGolazo`, `gradeTrivela`,
  `gradeToepoke`, `gradeTapin`, `gradeMiss`, `gradeTimeup` (renamed on 2026-11-11 with the six
  shots; `gradeTapin` is new).

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

Shared sizes: `PLAYER` (24 x 36 in a 32 x 40 cell), `YOUTH` (20 x 28 in 28 x 32), `KEEPER`,
`MATCH_BALL` (6 px, 2 px shadow), `FAN` (6 x 8 on an 8 px pitch), `TROPHY` (18 x 24),
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
| `scoreboard` | zone: the sign at full size; the airship draws it at `AIRSHIP_SIZE` (0.64) round its centre               | (18, 8, 184, 70) at 960 x 540; (-1, 76, 172, 66) at 234 x 507                         |
| `stand`      | zone: the stadium, the box round the bowl on screen                                                       | (0, 98, 130, 47); (82, 87, 316, 108)                                                  |
| `pitch`      | zone: the land in front of the stadium, from its near wall to the bottom                                  | y 145, 122, 164, 195                                                                  |
| `caption`    | zone: the bottom 10% (the DOM captions: its middle 135 px on a phone, a row across its foot on a monitor) | y 253, 200, 270, 243                                                                  |
| `sky`        | `{ horizonY, clearTop, sunX, moon }`, spread into drawSky                                                 | horizon 92, clearTop 42, sunX 65 (`cx`); moon (11, 12), (11, 12), (80, 69), (394, 28) |
| `scale`      | the camera: pixels per map unit at the centre spot (not a whole number)                                   | 0.42, 0.39, 0.52, 0.96                                                                |
| `spotY`      | the row of the centre spot of the pitch (its column is `cx`)                                              | 116, 95, 128, 129                                                                     |

`MENU_CAMERA` holds the camera numbers the layout shares with the painter (the horizon's rise
above the centre spot and the bowl's box, in map units). The sun climbs and sets in the middle
column, behind the city. The moon is placed where all of it shows: on a monitor high on the
right beside the wordmark (wherever the airship hangs beside it, 1366 x 768 too), above the
tallest aerial of the city; on a phone in the corner of sky left of the stacked wordmark; on a
wider phone or tablet right of the airship's tail; where none of these has room (160 x 300)
wholly behind the airship. The airship hangs high in the top left (the product owner,
2026-11-13: "blimp even smaller and top left"): beside the wordmark, its envelope's top 12 px
from the top, where it has room there with 16 px to spare (a monitor, 1366 x 768); else just
under the logo zone (a phone); its nose lamp and drift always clear of the left edge
(`max(8, min(24, 4% of W))`).

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
type BallSlot = "left" | "right" | "top" | "bottom" | "backLeft" | "backRight"
              | "rimLeft" | "rimRight";
const BALL_SLOTS: readonly BallSlot[];      // all eight, in that order
type BallIcon = "home" | "away" | "nextgen" | "retro" | "pin" | "globe" | "shirt" | "goal"
              | "lock" | "none";
interface BallPatch { label: string; icon: BallIcon;
                      accent?: { dark; base; light }; locked?: boolean; badge?: string }
interface BallState { cx; cy; r; yaw; pitch; roll?; hovered; pressed; chosen; t }
type BallPatches = Partial<Record<BallSlot, BallPatch>>;

drawBall(s, state, patches, light)         // the ball
ballSlotAt(state, x, y): BallSlot | null   // hit test: exactly what the renderer drew
ballSlotCenter(state, slot): { x, y, facing }   // facing 1 straight on, 0 on the rim, < 0 behind
// app/art/ball-icons.ts: the open modes' pictures as rows of "w" and ".", trimmed top and
// bottom, for the interface (the cards under the ball, 2026-11-13)
MODE_PICTURES: Record<"home" | "away" | "nextgen" | "retro", readonly string[]>
ballShowPose(slot): { yaw, pitch, roll }   // the pose that shows a slot
drawBallShadow(s, state, groundY, light)   // a shadow on a ground line, for a ball that rests on one
```

The slots, and what the menu puts on them:

| slot        | where (yaw 0, pitch 0)                      | menu              | icon      | shown by `ballShowPose`             |
| ----------- | ------------------------------------------- | ----------------- | --------- | ----------------------------------- |
| `left`      | level, 31.7 degrees left of the middle      | HOME, red-orange  | `home`    | the menu pose                       |
| `right`     | level, 31.7 degrees right                   | AWAY, teal        | `away`    | the menu pose                       |
| `top`       | 58.3 degrees above the middle               | NEXT-GEN, magenta | `nextgen` | pitch -58.3 degrees: straight on    |
| `bottom`    | 58.3 degrees below                          | RETRO, old gold   | `retro`   | pitch +58.3 degrees: straight on    |
| `backRight` | on the back, directly behind `right` (AWAY) | CLOSEST, locked   | `pin`     | yaw pi: where `left` (HOME) was     |
| `backLeft`  | on the back, directly behind `left` (HOME)  | FURTHEST, locked  | `globe`   | yaw pi: where `right` (AWAY) was    |
| `rimLeft`   | on the rim out past HOME, 31.7 degrees up   | GUESS WHO, locked | `shirt`   | yaw +pi/2, pitch -31.7: straight on |
| `rimRight`  | on the rim out past AWAY, 31.7 degrees up   | SHOOTOUT, locked  | `goal`    | yaw -pi/2, pitch -31.7: straight on |

A quarter turn by hand brings a rim slot round: a drag to the right `rimLeft`, to the left
`rimRight` (it faces the viewer most from about 69 to 148 degrees of turn; past that the back
slot does). The other four pentagons (two on the lower rim, two on the back, top and bottom)
carry nothing and never hit-test. `shirt` is the back of a shirt with a number cut out of
it, `goal` a goal with its net and a ball on the spot.

- The menu's ball floats in front of the picture and has no ground under it, so the menu scene
  draws **no shadow**: it calls `drawBall` and `ballSlotAt` and nothing else here.
  `drawBallShadow` is kept for a scene whose ball lies on the ground (draw it first, then the
  ball); only the ball's own shots use it today.
- A real 32 panel ball on a sphere, so it can rock, spin and fly. Radians. Positive `yaw` turns
  the front to the right, positive `pitch` rolls it up and away (a ball struck towards the
  stand), positive `roll` is clockwise.
- **A button** (a patch with an `accent` and not `locked`) wears its colour as a line round the
  pentagon and in its icon (no tab under its word since 2026-11-13). **A locked patch** never takes a colour:
  its picture with a small padlock at its foot, in mist (chalk while hovered or pressed, when
  the pentagon also lifts a step), so HOME and AWAY lead. Facing the viewer (`facing` at least
  0.62) it adds its word under them; a word wider than the patch (at r = 45 NEXT-GEN, CLOSEST
  and FURTHEST, not RETRO) sits on a dark ink tag that may run over the seams onto the leather,
  moved in as far as it must be to stay inside the outline, and dropped if it cannot. Squashed
  far round (the top and bottom slots in the menu pose) it wears small five-row pictures beside
  the small padlock from r = 44, the small padlock alone below. Icon `lock` is the padlock
  alone; below r = 30 a locked patch shows only the padlock, below 26 nothing.
- **The open top and bottom patches** (NEXT-GEN and RETRO: an `accent`, not `locked`) are
  buttons with HOME's and AWAY's frame and a locked patch's layout (`drawFront`).
  - **Their border** is the same frame as HOME's and AWAY's: a line in the mode's colour round
    the very edge of the pentagon, `borderW` deep (3, 2 or 1 px). The depth is chosen once a
    frame from HOME's and AWAY's words (`chooseLayout`), so all four borders always match.
    At rest it is lit along the diagonal (the mode's light tone on the side facing the light,
    its base across the middle, its dark tone on the far side); three deep, its outer pixel
    is the dark tone, so it reads against the white leather as well as against the black
    patch. The shine bar crosses them after HOME and AWAY (slots in order, 0.35 s apart, every
    5 s; the frame's pixels under the bar turn leather white). Hovered, the patch lifts: its
    fill takes the mode's three tones in the corners, the border's outer pixel goes dark and,
    three deep, a chalk line runs inside it. Pressed: the dark tone all over with an ink edge,
    the content down 2 px. Chosen: the 8 Hz flash, white or the light tone, the rim in the base
    tone.
  - **Their content** keeps clear of the border (`max(LOCKED_EDGE, borderW + 1)` px in) and
    has no padlock. In the menu pose they are squashed far round the ball: today's score in the
    small digits when it fits the squashed room, else the small five-row picture (from r = 30;
    nothing below r = 26). Shown straight on (`ballShowPose`): the full picture, and under it
    the word or the score. Their ink is the mode's light tone at rest, chalk while hovered or
    pressed, the mode's dark tone when chosen. As on a locked patch, what they carry is decided
    by the radius alone, from room measured once per size, so nothing comes and goes as the
    ball breathes.
- **Nothing on a locked patch flickers.** What it carries (picture or not, word bare or on a
  tag) is decided by the radius alone, from room measured once per size at both ends of the
  rock and of a deep nod (0.065 rad): top, bottom and the two rim slots straight on (the rim
  ones rolled by the nod too, which is what the hover's nod becomes a quarter turn round),
  the back ones in a side place (where CLOSEST and FURTHEST rest after half a turn), and the
  squashed top and bottom of the menu pose. A test holds every shown pose to it.
- `hovered`, `pressed` and `chosen` are slots or `null`. `chosen` flashes at 8 Hz off `t`.
  A bar of light crosses HOME then AWAY every five seconds off `t` (off at `t = 0`). There is
  no reduced-motion input: hold `t` still.
- `badge` writes a score on the patch once the mode has been played: bare figures in the
  button's colour on all four (no plate since 2026-11-13). On HOME and AWAY it takes the
  picture's place, centred in the picture's box over the word, which stays where it was
  (2026-11-13), in big figures if they fit there, else small (`scoreOver`, from the room table's
  `roomScoreAt` entries). Where the words do not fit (below r = 37) or the score does not fit
  there, it takes the word's place under the picture, as before. NEXT-GEN and RETRO show the
  score alone.
- `accent` is usually `MODE_COLORS[mode]`.
- What a button shows depends on the radius: big icons and words from r = 56, icon and word
  from 37, icon only below 37, only the coloured line below 26; and on how far it faces the
  viewer: the icon from `facing` 0.5, the word from 0.62. The menu ball is 36 to 60 px.
- The menu rocks the ball by 0.12 rad of yaw; the label fit is measured for that.
- What a patch carries hangs on the middle of what the patch shows (2026-11-13), not on its
  centre on the sphere, which projects further out (by 5 px for the top and bottom patches
  at r = 90): `MARK_SHARE` 0.94 of the way from the ball's centre, the measured mean of a
  patch's pixels. On HOME and AWAY the picture and the word or score are a pair: the fonts
  and the line are chosen with the text on the pentagon's widest rows, then the pair moves
  down in steps of 2 px towards centred as far as what both patches write still fits there
  (a score alone goes all the way, a word part of it; a played patch's word and the score
  over it must both fit), the same for both so they stay level.
- Shots: `ball/menu`, `states`, `states-small`, `rock`, `sizes`, `flight`, `spin`, `badge`,
  `shine`, `fit`, `modes` (every patch in the pose that shows it), `modes-fit` (those poses at
  r 37 to 59, at both ends of the rock), `rim` (GUESS WHO and SHOOTOUT straight on, big).

## The home-screen stadium (`~/art/stadium`, `~/art/led`)

```ts
interface MenuSign {
  header: string; // the first line, in green: "DID YOU KNOW?", "NEXT-GEN"
  text: string; // in amber: the fact (it scrolls) or a short line, "360 PTS"
}
class MenuBackdrop {
  constructor(opts: { seed: number; sign: MenuSign });
  resize(w, h): void;
  setLighting(light): void;
  setSign(sign: MenuSign): void; // drawn in capitals on one line (runs of spaces and line breaks become one space)
  setMessages(messages: readonly MenuSign[]): void; // the sign cycles these instead (none: setSign's)
  setBanner(text: string): void; // the plane's banner, "DID YOU KNOW? ..." (empty: no plane)
  setMoonPhase(phase: number): void; // 0 new, 0.5 full
  target(): { x: number; y: number }; // the centre spot of the pitch: (cx, menuLayout().spotY)
  setRoar(amount: number): void; // 0 an ordinary matchday, 1 the whole place erupting
  draw(s: Surface, t: number): void; // covers the whole surface, sky included
  airshipAt(x: number, y: number, t: number): boolean; // on the airship at scene time t (false while it is down)
  pokeAirship(t: number): "wobble" | "pop" | "none"; // a click on it at scene time t
  setScheme(id: string): void; // the day's club colours: schemeForDay(day).id (unknown id: red and white)
  schemeId(): string;
  mascotSpot(): { x: number; y: number } | null; // the point between his feet; null: no lawn (phones)
  mascotAt(x: number, y: number, t: number): boolean; // on the mascot (a generous box round him)
  pokeMascot(t: number): "trick" | "busy"; // a click on him: his next trick, or busy with one (or absent)
  cuesBetween(t0: number, t1: number): SoundCue[]; // what is heard of the picture in (t0, t1]
}
// ~/art/stadium-club
schemeForDay(day: number): ClubScheme; // from the game's day number; never the same two days running
SCHEMES: readonly ClubScheme[]; schemeById(id): ClubScheme; DEFAULT_SCHEME // red and white
```

**The day's colours** (`stadium-club.ts`). The stadium wears a different club's colours each
day: its outer walls and their trim band, most of the crowd and their scarves, the flags, the
home side's kit in the match, the supporters' shirts, the airship's fins, and the bunting,
awnings and painted cars round the town. The menu ball's HOME and AWAY never change. Twelve
schemes, in the order the days take them (`dayNumber % 12`): 0 red and white (the stadium as it
was), 1 purple and gold, 2 yellow and green, 3 black and white, 4 claret and sky blue, 5 orange
and black, 6 green and white, 7 pink and black, 8 white and red, 9 yellow and blue, 10 red and
black, 11 purple and white. The new ramps are `CLUB` in `palette.ts` (kept apart from `P`, the
bible's table). The product owner's rule, held by a test: never dark blue and white; no
scheme pairs any blue with white at all, and blue is never a main colour (inside the pale roof
ring a blue bowl would read blue, white, blue). The visitors (their kit, their end, their
coaches) stay teal unless that is within 0.15 (OKLab) of a home colour, then lilac, orange or
crimson. The home kit is never white (the ball is the only white thing moving) nor grass green.
It is a palette swap: the painters still paint the club in the HOME ramp and the visitors in
the AWAY ramp, and `clubLight(light, scheme)` wraps the lighting so `env` and `lit` grade them
in the scheme; colours drawn raw ask `clubRaw(light)`, the second colour `clubOf(light)`. A
change of scheme repaints (like a change of light). Shots: `stadium/schemes` (all twelve), and
`stadium/composed --seed N` wears day N's colours.

**The mascot** (`stadium-mascot.ts`): a black cat with bright green eyes in a big costume, in
the club's kit (shirt, collar and shorts in the second colour, black boots), black paws, pointed
ears pink inside, slit pupils, a pink nose, whiskers and a tail that sways (a step every third of a second,
up high when he cheers, up his back seen from behind, along the grass sat down), with a 4 x 4
ball at his feet, out on the lawn left of the stadium among the people walking there. Drawn at
their scale: a walker is 10 px tall, he is 20 px tall (ear tips to boots) and 17 wide with his
paws (21 with his tail), no outline: a person in a costume, not a giant. His eyes are raw colour
(they catch any light); at night his fur's edge is lit by the floodlights (mist on his right,
steel on top) so he never vanishes on the dark lawn. Front, side, back and sitting views. Shots:
`mascot/sheet` (his idle loop and every trick on the real picture, day and night) and
`mascot/poses`. Idle (a nine-second loop): bounces on his toes,
waves, juggles four touches, blinks, throws his arms up. A click plays the next trick in turn,
each simple enough to read at this size: a juggle (right foot, left foot, right foot, head,
trap), a flick over his own head, a spin (pops it up high and turns all the way round under
it, twice), and a tumble (hoofs it sky-high, topples onto his bottom, it lands on his head and
he sees stars); then idle again from the top of its loop. His spot (`findMascotSpot`) is the
deepest open grass left of the ball: every pixel's distance to anything that is not open lawn
(a path, the road, a tree, a building, the frame, and the ways people walk, traced from
`life.people` over three minutes, when the lawn has room to keep off them) is measured and
the farthest wins, up to 16 px, then nearest the middle of the lawn; at least 7 px all round
or no mascot (480 x 270: (50, 192); 640 x 360: (66, 255)). It is chosen once per size, like the crash site, and the
crash site and the pilot keep clear of him (`findCrashSite(..., avoid)`). `MASCOT_BOX`, his
click box, is 12 x 14 px round the point between his boots (him, his ball at rest and a
little more). Phones have no lawn: no mascot. The state is the trick history (`MascotPokes`);
`draw` is a pure function of it and `t`. Shot: `stadium/mascot`.

**Sound** (`cuesBetween`, `SoundCue` from `app/scenes/scene.ts`): the airship's landing
(`thud`, or `splash` in the pond, `FALL` after the pop), the mascot's `touch`es, `kick`s and
the `thud` of his tumble, and the match far off, as faint background: `{ kind: "cheer", size:
0.1 }` as the home side scores (`GOAL_AT` into each `MATCH_PERIOD`) and `{ kind: "firework",
distant: true }` as each of the goal's rockets goes up (`life.launches`; none on a phone, none
while the roar is over 0.45). Never a horn. Pure; spans that meet never repeat a cue; only the last
second of a longer span is heard. The pop and the pokes of the airship are the scene's to play
(it knows from `pokeAirship`'s answer).

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

The airship is 0.64 of the layout's size (`AIRSHIP_SIZE` in `~/art/layout`, 7/8 until
2026-11-13: `signPlace` shrinks the panel, to even sizes, and the envelope round the same
centre; the painter scales every length of its drawing by `place.size`, so its proportions
hold). The panel is never smaller than `SIGN_MIN_W` x `SIGN_MIN_H` (112 x 44: "DID YOU KNOW?"
over a big line; 118 x 44 on a monitor, 112 x 44 on a phone). Its sign shows `setMessages`' messages one after another (`drawSignBoard`):
each for `SIGN_HOLD` (4 s) or until a line too long for it has scrolled once, then a roll of
`SIGN_ROLL` (0.6 s) in which the panel's lamps carry it up and out and the next one up into
place, a lamp at a time (`signAt(messages, w, signT)` says which is up, a pure function of
the sign's clock). A message is a green header in `FONT_3x5` over an amber line: in
`FONT_5x7` if it fits, else in `FONT_3x5` on one line or two, else in `FONT_5x7` as a
marquee (two small lines only where the panel is tall enough: not at today's size). A header
too long for the panel scrolls in step with the line under it. `signFits(m, w, h)` says
whether a message fits as it is, `signShows(m, w, h)` whether it shows whole (every line in
the panel's height, a long one scrolling); `signAt(messages, w, h, t)` takes the panel's
height too. The words come from the page
(`app/routes/home-sign.ts`). With no messages it is the fact as below. The
wreck keeps the message it showed when it burst.

**The plane** (`~/art/stadium-plane`): `setBanner(text)` gives the words
(`bannerWords(header, fact)`). A plane 36 x 16 (propeller, high wing, the pilot's head in
the cabin window, wheels; ink outline; yellow with the club's red stripe) flies from right to
left at `PLANE_SPEED` (60 px a second: a pixel a frame), its first pass
`PLANE_FIRST` (6 s) after the page opens and one every `PLANE_EVERY` (70 s), towing on a
sagging 2 px rope and a bridle a banner 13 px tall: chalk cloth hemmed in the club's red,
"DID YOU KNOW?" in red and the fact in ink in `FONT_5x7`'s 7 px capitals (the product owner,
2026-11-13: "smaller daily facts on plane"; it was `paintedFont(FONT_3x5)`, 10 px, on 18), as
long as its words (a 110-character fact makes a banner about 660 px long), rippling in whole pixels with folds
in a tone of shade. At night the cabin windows are lit (`goldDark`, a light source), it shows
a red wing-tip lamp, a white tail lamp and a blinking red beacon, and lamps along the banner's
top light it (its cloth and letters take `light.lit`). `planeRoute` flies it where the
airship hung until 2026-11-13, `PLANE_DROP` (48 px) under the logo zone ("plane with fun fact
higher, where current blimp is in elevation"), under the airship's gondola where the airship
hangs across that row (a phone), and never lower than 4 px clear of the stadium's far stand
(`menuLayout().stand.y`) or the ball, so on a phone and at 1366 x 768 it skims the far roof
and never crosses it; never in the logo's zone. It is
drawn after the mascot and before the airship; clicking it does nothing. `planeAt(t, w,
length)` is the nose's x (null between passes). Sheets: `plane/close`, `plane/home`,
`plane/phone`.

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
  referee and the ball in map units, and each player's `stride` (-1 standing, else which foot
  leads). The script says where each means to be; the players run there as people do (no faster
  than a sprint, picking up and losing pace over a few strides, never on one spot), worked out
  once at first use (about 50 ms) into a table read between rows, so everybody moves smoothly,
  at most a pixel a frame, the loop's seam included. The match is sampled every frame (moves are
  whole pixels); a player stands (both feet down) when he is still and only strides when he
  moves, a foot a stride's length of ground. The ball is at the feet of whoever has it, where he
  has really run to. Shot: `match/strip` (consecutive frames at the busy moments and the seam).
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
- **The match ball** has an ink edge on the grass round it, drawn among the players at its depth
  (the far ones first; in the air, over them), and the home side wears dark shorts, so the ball
  is the only white thing moving on the pitch.
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
  airship, a depth mask that lets moving things pass behind trees and lamp posts). A shadow is
  not in the mask: ground that only the static painter's shadows darkened is bare ground (a
  `ShadowLog` tells it apart while the mask is noted), so a walker or a car crossing a tree's
  shadow stays in sight. A moving car's shadow goes through the mask like the car
  (`shadowBlob(s, cx, cy, rx, ry, depth, V)`): it never darkens a tree or a roof that stands in
  front of the car. A frame is the
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
drawLamps(s, text, x, y, color, { font?, bg? }): number   // lit lamps, first lamp at (x, y); its width
lampLook(color, bg = ink): { hot, link, glow }            // the lamps' colours
measureLamps(text, font): number                          // drawLamps' width
ledLap(text, width, { font?, speed?, pause?, gap? }): number // a marquee's seconds round (0: it fits)
```

A line that fits is placed by `align`. A longer one starts flush left, pauses, scrolls one lap in
whole lamps and is back at its start (returns `true` when it scrolls). `speed` and `gap` are in
lamps (2 px each); the housing is `LED_FRAME` (4 px). It draws the text as
given: capitalise first.

**Lamps** (`drawLamps`; every LED text in the game: the airship's sign, the tier-3
scoreboard, the stadium's LED boards). Each pixel of the small face is a lamp
on the panel's 2 px pitch, drawn as a **hot** lamp (half way from its colour to `goldLight`),
with the **link** between two neighbouring lit lamps (and across a diagonal step) in the colour
itself, and a faint **glow** (55% of the way from the field to the colour) in the gaps beside a
lit lamp where none is lit next to it. A stroke one lamp wide is so three pixels wide, with
the unlit lamps still showing round it, and a line carries about four fifths of the light of
solid letters at the same size (two fifths with bare dots and a dim glow): it reads brightly
from a normal distance. The glow reaches one pixel left
of and above the first lamp: put text on an even offset of at least 2 from a lamp field.
Dark words on a light board are paint: their lamps are not made hotter. A layer per face,
colours and words is cached.

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
                                // plus era?, eraColors?, eraGlows? (see "Eras" below)
type KitBase = "home" | "away" | "casual-home" | "casual-away" | "casual" | "rival" | "keeper"
             | "national-home" | "national-away" | "referee";
makeKit(base, opts?: { look?: 0 | 1 | 2; variant?: number; era?: Era }): Kit
HERO_LOOK: 0 | 1 | 2            // 1: skinB, dark hair. The hero's look at every tier.
litKit(kit, light): Kit         // every slot through light.lit; do it once per light, not per frame
                                // (it keeps the era, grades eraColors, copies eraGlows raw)

type ShotAnim = "kick" | "tapin" | "toepoke" | "trivela" | "chip" | "power" | "finesse" | "bicycle";
// one per grade: kick = miss, tapin = tap in, toepoke = toe poke, trivela, finesse = golazo,
// bicycle = worldie. chip (a lob) and power (a rocket) are spares for variety.
type PlayerAnim = "idle" | "run" | "kick" | "juggle" | "celebrate" | "dejected" | "lift" | "shrug" | "slide"
                | ShotAnim;
PLAYER_ANIMS: Record<PlayerAnim, { frames; fps; loop }>
KICK_STRIKE_FRAME = 2
STRIKE_FRAME: Record<ShotAnim, number>   // kick 2, tapin 1, toepoke 1, trivela 2, chip 2, power 2, finesse 2, bicycle 4
SHOT_ANIMS: readonly ShotAnim[]
interface Cell { cellW; cellH }
playerCell(anim, youth?): Cell  // PLAYER / YOUTH, except the bicycle: BICYCLE_CELL 48 x 56, BICYCLE_YOUTH_CELL 40 x 44
keeperCell(anim): Cell          // KEEPER, except the sprawl: SPRAWL_CELL 48 x 40
drawPlayer(s, anim, frame, x, y, kit, opts?: { flipX?; youth? }): void
ballSpot(anim, frame, opts?: { flipX?; youth? }): { x; y } | null
handsSpot(anim, frame, opts?: { flipX?; youth? }): { x; y } | null

type KeeperAnim = "ready" | "leap" | "smother" | "hold" | "beaten" | "stranded" | "sprawl";
KEEPER_ANIMS: Record<KeeperAnim, { frames; fps; loop }>
drawKeeper(s, anim, frame, x, y, kit, opts?: { flipX? }): void
keeperHands(anim, frame, opts?: { flipX? }): { x; y } | null

drawMatchBall(s, x, y, frame, light, opts?: { gold?; era? }): void   // (x, y) the ball's centre
drawBallRing(s, x, y, ink): void                               // its 2 px ink ring, drawn first
drawTrophy(s, x, y, light, glint?, era?): void                // (x, y) the middle of its base
drawPuff(s, x, y, frame, color): void                          // (x, y) the ground point under it
```

- **Anchor.** `(x, y)` is the ground point under the standing feet: the soles' outline is row
  `y - 1`, the cell's left edge `x - floor(cellW / 2)`. Adult 24 x 36 in 32 x 40, youth 20 x 28
  in 28 x 32 (`PLAYER`, `YOUTH`, `KEEPER` in `~/art/layout`). Two animations need more room
  and have their own cell, with the same anchor rule (`playerCell`, `keeperCell`): the
  bicycle kick, 48 x 56 adult (anchor column 24, soles' outline row 55) and 40 x 44 youth
  (column 20, row 43), and the keeper's sprawl, 48 x 40 (column 24, row 39). Swapping to them
  from a 32-wide frame at the same `(x, y)` keeps his feet where they were. Nothing draws
  outside the cell. Everyone faces right; `flipX` faces left. Spots are offsets from
  `(x, y)`; what a spot marks is even-sized (the 6 x 6 ball, the 18-wide trophy), so a
  flipped spot is `-dx` (the exact mirror of the pixels), and the functions already do this.
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
  `{ youth: true, flipX: true }`. The youth frames draw his hands in the glove slot (but the
  kick's, the lift's, the slide's and juggle 2), so he wears the gloves. Use idle for ready, and celebrate, dejected and shrug.

| anim      | frames @ fps | loop | notes                                                                         |
| --------- | ------------ | ---- | ----------------------------------------------------------------------------- |
| idle      | 2 @ 2        | yes  | breathing: head and shoulders drop 1 px                                       |
| run       | 4 @ 10       | yes  | contact, passing (up 2 px), contact, passing; feet and arms alternate         |
| kick      | 5 @ 10       | no   | wind-up, plant, **strike (2)**, follow-through, recover                       |
| juggle    | 8 @ 7        | yes  | touches on 0 (foot), 2 (knee), 4 (foot), 6 (head, on his toes); hops between  |
| celebrate | 3 @ 6        | yes  | crouch, tuck jump with fists up (feet 6 px off the ground), land with arms up |
| dejected  | 2 @ 1.5      | yes  | head bowed, hands on hips; a sigh                                             |
| lift      | 2 @ 3        | yes  | both arms up holding the trophy over his head; the second pumps it up 2 px    |
| shrug     | 2 @ 2.5      | no   | palms out and shoulders up, then back to rest                                 |
| slide     | 2 @ 4        | yes  | on his knees, leaning back, fists up; move him along the grass yourself       |
| tapin     | 4 @ 8        | no   | walking step, **prod with the side of the foot (1)**, step on, stand          |
| toepoke   | 5 @ 10       | no   | lunge, **full stretch, toe end on it (1)**, lurch on one foot, hop, stand     |
| trivela   | 6 @ 10       | no   | stride, cock the leg, **outside of the boot (2)**, flick, land, arms open     |
| chip      | 5 @ 10       | no   | spare: last stride, plant, arms out, **stab under it (2)**, scoop, watch      |
| power     | 6 @ 10       | no   | spare: stride, wind-up, **laces (2)**, off his feet, land, stance             |
| finesse   | 5 @ 10       | no   | stride, plant, arm up, **instep (2)**, arms-wide balance, point               |
| bicycle   | 8 @ 10       | no   | own cell; chest, crouch, take-off, flat, **scissor (4)**, fall, back, sit     |
| ready     | 2 @ 2        | yes  | keeper: crouched, gloves forward, bobbing                                     |
| leap      | 3 @ 8        | no   | keeper: crouch, full stretch up and back, hang                                |
| smother   | 2 @ 8        | no   | keeper: diving down forward, then lying on the ball                           |
| hold      | 1            | yes  | keeper: standing, ball to his chest                                           |
| beaten    | 1            | yes  | keeper: on his knees; drawn looking back over his goal line                   |
| stranded  | 3 @ 6        | no   | keeper: off his line, arms out; reaching up and back, too late; turned        |
| sprawl    | 3 @ 8        | no   | keeper, own cell: push off, full-length dive toward his goal, flat            |

Spots (adult, then youth; `x` right, `y` up is negative):

- `ballSpot("kick", 0..2)`: the ball at rest in front of him, `(14, -4)` (youth too). Draw it
  there from the set until the strike frame, then fly it from that point. `null` on 3 and 4.
- The ground shots (`tapin`, `toepoke`, `trivela`, `chip`, `power`, `finesse`, adult and
  youth) work the same way:
  `(14, -4)` from frame 0 up to `STRIKE_FRAME[anim]`, `null` after it.
- `ballSpot("bicycle", 0..4)`: the ball is his for the first five frames. Adult `(-10,-20)`
  (on his chest; he is facing away from the goal), `(-6,-44)` (popped up), `(2,-52)` (top),
  `(6,-48)` (dropping), `(10,-43)` (**the strike**, over his head, at his boot). Youth
  `(-9,-13) (-5,-33) (1,-39) (7,-37) (9,-35)`. `null` on 5 to 7. Draw it at the spot, or
  `arc()` between this frame's spot and the next for a smoother hang.
- `ballSpot("juggle", f)` on every frame. Adult: `(8,-13) (12,-24) (8,-18) (12,-32)` then
  `(8,-13) (6,-44) (2,-39) (12,-24)`. Youth: `(9,-9) (11,-19) (8,-13) (11,-23)` then
  `(9,-9) (5,-35) (2,-31) (11,-19)`. Even frames are touches; odd frames are the top of the
  hop. For a smoother ball, move it between this frame's spot and the next along `arc()`.
- `handsSpot("lift", f)`: adult `(0,-34) (0,-36)`, youth `(-1,-28) (-1,-29)`:
  `drawTrophy(s, x + h.x, y + h.y, light, glint)` puts the cup on his raised hands.
- `keeperHands`: ready `(8,-16) (9,-15)`, leap `(-11,-14) (-9,-35) (-11,-35)`, smother
  `(10,-10) (11,-7)`, hold `(6,-18)`, beaten `null`, stranded `(9,-14) (-11,-33) (7,-12)`,
  sprawl `(-20,-15) (-19,-13) (-19,-8)` (the leading glove). For hold and smother 1 it is where the
  ball goes: draw the ball there after him.

**Staging the shots** (the hero at `heroX`, facing right; the strike is
`STRIKE_FRAME[anim] / fps` seconds after the shot starts; fly the ball from
`ballSpot(anim, STRIKE_FRAME[anim])`):

- **miss**: `kick`, the ball sent wide or over; keeper `ready` (he watches it go).
- **tapin**: run him close first, then `tapin`; the ball rolls along the ground (`y - 4`) at
  walking pace. Keeper: `smother` 0 then 1 without the ball, then `beaten`, or caught
  flat-footed in `ready`.
- **toepoke** (TOE POKE): he gets there just before the keeper, so stage it close: the keeper
  off his line a few pixels nearer than usual. The strike is only 0.1 s in, so the ball can
  arrive rolling (bring it in along `y - 4` to `(14, -4)` by the strike) or sit there from
  frame 0. It leaves fast and scuffed along the ground (`y - 4`, a 2 px bobble now and then),
  quicker than the tap in. A `drawPuff` of turf under his toe (`(12, 0)`) on the strike. Keeper:
  `stranded` 0 rushing out as he lunges, then `smother` 0 diving at it a beat late, the ball
  squeezing past his gloves, then `beaten`. Frames 2 and 3 are the stumble: nudge him 2 to
  4 px forward over them if you like, then hold 4 and cut to `celebrate`.
- **trivela** (TRIVELA): struck with the outside of the boot, so it bends away from his
  kicking side: rising off the grass on a curve the other way to the finesse's (in profile:
  up quickly, then flattening and dipping late; on screen a sideways bend that starts at
  the keeper and swings away from him). Keeper: `sprawl` a beat late, frame 1 diving where
  the ball was going, the ball bending a few pixels outside the leading glove, holding 2 as
  it goes in; or `ready` until late then `leap` the wrong side. Frame 3 is the showy flick
  (hold it a moment), 5 the arms-open pose; cut to `celebrate` from there.
- **finesse** (GOLAZO): a curling ball into the far top corner (bend it on a sideways arc).
  Keeper: the `leap` at full stretch, the ball a pixel past his gloves, then `beaten`.
- **chip** and **power** are spares, no longer tied to a grade; use them for variety (a
  golazo that is a rocket or a lob). chip: a high, slow arc over the keeper. Keeper:
  `stranded` 0 as it is struck, 1 as it passes over his gloves (`keeperHands("stranded", 1)`
  plus a pixel or two), 2 as it drops in. power: a flat, fast ball, a few pixels off the
  grass. Keeper: `sprawl`, frame 1 timed so the ball passes just beyond the leading glove,
  holding 2 while it hits the net. Add a `drawPuff` under his boot on the strike and under
  the keeper on sprawl 2.
- **bicycle**: he faces away from the goal on frame 0, so bring the ball in to his chest (a
  team-mate's cross, or flick it up from a juggle, then cut to frame 0). Frames 0 to 4 carry
  the ball (spots above); from the strike it flies flat and slightly down toward goal. Lift
  the frames by nothing: the cell already puts him in the air. He ends sitting up facing the
  goal; cut to `celebrate` from there. Keeper: `ready` frame 0 frozen (he never moves), then
  `beaten`. Worth a `drawMatchBall(..., { gold: true })` trail.

**Using the keeper** (he stands at `keeperX` with `flipX: true`, facing the shooter; keep the
same `flipX` for every frame, the beaten frame already looks back at the goal):

- **High save or a top-corner goal** (`topbins`, `worldie` reaction aside): `leap` 0 for one
  frame as the ball is struck, then 1 (full stretch) and 2 (hang) while you lift him on an arc
  of about 10 px (`y - Math.round(arc(u) * 10)`), then back to `ready`. His gloves are at
  `keeperHands("leap", f, { flipX: true })` plus the lift: put a tipped-over ball just beyond
  them, or a goal a pixel past them.
- **Low save** (`ontarget` low, or a smother): `smother` 0 then 1 with the ball drawn at
  `keeperHands("smother", 1)`; then `hold` with the ball at `keeperHands("hold", 0)`. A ball
  straight at his chest (`ontarget`) goes straight to `hold`.
- **Goal conceded**: low (`goal`): `smother` 0 then 1 without the ball, then `beaten`. High:
  the leap, then `beaten`. `worldie`: hold `ready` frame 0 (frozen), then `beaten`.
- **Nothing happens** (`wide`, `timeup`, `skipped`): `ready`.

**The props.** The match ball is 6 x 6 (white, mist and steel shades, a slate panel) with 3
spin frames, its fill `x - 3 .. x + 2` round the centre; pass a running counter as `frame`.
`gold` is the worldie's trail. `drawBallRing(s, x, y, ink)` is its 2 px ink ring (10 x 10),
drawn first on the same centre. The scene draws its shadow. The trophy is 18 x 24
(`x - 9 .. x + 8`), a two-handled gold cup on a wooden plinth, `glint` adds a white flash
on the bowl (light sources are raw colour: the glint is not graded). The puff is 14 x 10, three
frames (a kick of dirt, a cloud, drifting specks), one colour passed in: grade it yourself
(`light.lit(P.grassHi)` on grass, `light.env(P.woodDark)` for park mud). Out of range frames
draw nothing.

Shots: the sheets `people/sheet` (also `-away`, `-rival`, `-referee`), `kits`, `shots`,
`shots-kits`, `youth-sheet` (also `-club`, `-rival`), `youth-keeper`, `youth-kits`,
`youth-shots`, `youth-shots-kits`, `keeper-sheet`, `props`, `fetch-sheet`; one motion shot
per animation (use `--strip 8 --dt 0.1`): the moves `people/idle`, `run`, `kick`, `juggle`,
`celebrate`, `dejected`, `lift`, `shrug`, `slide` and their `people/youth-*` twins; the shots
`people/tapin`, `toepoke`, `trivela`, `chip`, `power`, `finesse`, `bicycle` and their
`people/youth-*` twins (each plays the shot with a stand-in ball flight; `--strip 11 --dt 0.1`
shows a whole bicycle); the keeper's `people/ready`, `leap`, `smother`, `hold`, `beaten`,
`stranded`, `sprawl`.

Files: `kit.ts` (kits and their colour array), `figure.ts` (fill-only art outlined at load,
the shared legend, parts), `adult.ts` (the moves and the heads), `adult-shots.ts` (the seven
shots and the rig every frame is painted on), `youth.ts`, `youth-shots.ts` (the same for the
youth), `keeper.ts`, `fetch.ts` (the keeper's and the ball kid's fetch frames), `people.ts`
(tables, cells, spots, drawing), `props.ts`, `index.ts`, and a `.shots.ts` sheet beside each
art file. Sprites are built once per animation, on first use; drawing allocates nothing.

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
  constructor(opts: { seed: number; mode: Mode; tier: Tier; labels?: GroundLabels; era?: Era });
                                           // era: fixed for the ground's life, "today" by default
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

## Eras (`~/art/era`)

RETRO and NEXT-GEN have a look of their own in the career scene (since 2026-11-13; what they
look like is `docs/ART_BIBLE.md` section 10). HOME and AWAY are drawn in today's look, which
did not change by a pixel. The era is a parameter, never a global.

```ts
type Era = "today" | "retro" | "nextgen";
ERAS: readonly Era[]
eraOf(mode: Mode): Era          // retro -> "retro", nextgen -> "nextgen", every other mode -> "today"
```

- **One rule for every painter.** A painter that draws differently per era takes the era as an
  optional argument, its last, that defaults to `"today"`; with `"today"` it draws exactly
  what it drew before. So every shot and every caller that passes nothing gets today's look.
  Nothing keeps module state keyed on the era, but for caches that have one entry per era.
- **Who decides it.** The career scene, once, from its mode (`eraOf`), beside its journey,
  which stays HOME's for RETRO and NEXT-GEN (`docs/API_SCENES.md`). It hands the era on in
  four ways: to the ground, on the kits, to the props and to the effects.
- **The ground.** `new CareerGround({ ..., era })` keeps it for its life, so its build caches
  need no era key. `paintFor(g, light, tier, mode, seed, labels, era = "today")` puts it in
  the paint context as `Paint.era`, and every ground painter, the crowd and the people read
  `p.era`. RETRO warms every ground colour at every tier, once, before the light grades it:
  `paintFor` runs `E`, `S` and `D` through `retroGrade` (`grounds/retro-grade.ts`:
  `retroWarm(c)` moves a colour `RETRO_WARM` = 0.14 of the way to `mix(P.chalk, P.wood,
0.45)`), so the promotion from tier 3 to 4 keeps its colour. Lamps, lit windows and the
  sky are raw and never pass through it; a RETRO painter must not warm again on top.
- **The goal.** `goalColors(G, tier, era = "today")` puts the era in `GoalColors` (`c.era`)
  with a `style`: `"wood"` for RETRO at every tier (square wooden posts and a rope net,
  `goal-retro.ts`; at tier 0 a `cap` on the near pile of jackets). NEXT-GEN's goal is
  `c.era === "nextgen"`: marker cones at tier 0 (`goalPylon`) and slim posts with a net of
  light at tiers 1 to 3 (`nextgen-low.ts`); from tier 4 `c.arena` switches to the bolder
  arena goal, today's 4 px frame in light (`arenaGoalBack`, `arenaGoalFront` in
  `nextgen-high.ts`, the same signatures as `ngGoalBack` / `ngGoalFront`).
  `drawGoalBack` and `drawGoalFront` read both, so their signatures did not change, and the
  goal's geometry (`GroundGoal`, the bulge) is the same in every era.
- **Movers.** `Life.movers: Mover[]` holds an era's own moving things, made once per build:
  `interface Mover { sky?(s, t): void; far?(s, t): void }`. `sky` is drawn at the start of
  the sky's life, after the sky and before the layer is copied over it, so it shows only
  through the layer's gaps (far skylines, hover traffic, drones, smoke behind the stands);
  `far` at the end of the far side's life, over the layer and the watchers. Today's list is
  empty. Drawing a mover allocates nothing. An optional `seen?(layer)`, called once by
  `CareerGround` when the build is done, lets a mover learn which of its pixels the finished
  layer leaves in view and redraw only those (NEXT-GEN's city behind the stands: 0.02 ms a
  frame at 1920 x 1080, where a full copy cost 0.6; the crawling holographic boards at tiers 2
  and 3, `paintHoloBoards(..., life)`, so the corner flag stays in front). `Life.scoreboard`
  takes an optional `color` for its lamps (amber by default).
- **Board words.** NEXT-GEN's boards say their own words: `en.play.canvas.nextgen.boards`
  reaches the scene as `CareerLabels.nextgen` and replaces `labels.boards` for NEXT-GEN only
  (`career.ts`), so every NEXT-GEN board that reads `p.labels.boards` shows them, drawn in
  lamps on dark glass. RETRO and today keep `labels.boards`.
- **The crowd.** `crowdShirts` and `crowdColors` (`paint.ts`) hand an era its own crowd:
  RETRO old gold and chalk to tier 4, the nation's brick red and chalk from tier 5
  (`retroShirts`); NEXT-GEN the hero's magenta (`nextgenShirts`, `nextgenColors` in
  `grounds/nextgen-people.ts`). The people in `grounds/people.ts` take optional extras, all
  absent for today: NEXT-GEN's glowing wristband and visor (`drawFanAt(..., band?, visor?)`,
  `FanLook`, `FanList`, `Watcher`, and a headset of light through `crowdBack(..., glow?)`;
  the band is a 2 x 2 held up on a wrist, `drawFanBand`, and a remembered fan's is drawn
  each frame so a white crest can run across the stands, `bandCrest` and `drawFanCrest`,
  with its halo `FanLook.halo` by night only), RETRO's
  hats, bowlers and rattles (`hat`, `hatColor`, `rattle`; `grounds/retro-people.ts`).
  RETRO's near crowd from behind (tiers 3 to 7) has its own lighter dress,
  `retroNearDress` (`grounds/retro-near-crowd.ts`, from `crowdBacks`), with a striped
  `neckScarf` on about one in five. The standing watchers (`far.ts` `watcher`): RETRO's
  coats go through `retroCoat` (today's reds to old gold, teal to slate and night) with a cap
  or bowler (`retroWatcherHat`); NEXT-GEN's through `nextgenCoat(E, coat, n)` (red to
  magenta, every other coat a slim jacket in slate, night, steel or panel grey) with
  `nextgenWatcherLights` (the crowd's wristband, a visor on about half, and `Watcher.trim`,
  a hem and zip of raw cyan or white light drawn by `drawWatcher`).
- **The cast.** The era rides on the kit, so no draw call changes:
  - `Kit.era?: Era`; `makeKit(base, { look, variant, era })` makes today's kit, then hands
    it to `retroKit` (`characters/retro.ts`) or `nextgenKit` (`characters/nextgen.ts`).
    `ensureKits(kits, tier, journey, light, era)` (`career-cast.ts`) and `ballKidKit(era)`
    pass it.
  - `Kit.eraColors?` (up to 8, graded with the kit by `litKit`) and `Kit.eraGlows?` (up to 4,
    light sources, copied raw by `litKit`; art bible 3.2). The fill art's legend
    (`figure.ts` `LEGEND`) ends in twelve era letters that today's art never uses: `1 2 3 4`
    are `eraColors[0..3]`, `5 6 7 8` the four glows, `9 A C D` `eraColors[4..7]` (`B` is
    taken by the boot's highlight). `kitColors(kit)` appends all twelve, transparent where a
    kit leaves a slot empty. Each era gives the letters its own meaning: RETRO a moustache,
    shirt stripes, a sock band and the keeper's cap; NEXT-GEN a visor strap, glowing seams
    and trims, and the visor's glass and shine.
  - **Frame layers.** An era's people are a layer over today's fill art, never a second copy
    of it. `eraFrames(era, who, anim, art)` (`characters/era-frames.ts`; `who` is
    `"adult"`, `"youth"`, `"keeper"` or `"fetch"`) passes today's art through and hands the
    others to `retroFrames` or `nextgenFrames`, which rewrite cells inside the figure frame
    by frame before `figure()` outlines it. Every frame keeps its size, its soles and its
    spots, so every move and shot plays as today's. `drawPlayer`, `drawKeeper` and
    `drawFetch` pick their sprites by `kit.era ?? "today"`, from one sprite cache per era
    (`playerSprite(anim, youth, era)`, `keeperSprite(anim, era)`, `fetchSprite(anim, era)`).
  - NEXT-GEN's referee is a man in black with amber light (`nextgenKit`'s `"referee"`, drawn
    by `drawPlayer` like today's), and its struck shots leave a light trail
    (`NEXTGEN_TRAIL`).
- **The props.** `drawMatchBall(..., { gold, era })`: RETRO's brown laced leather ball
  (`drawRetroBall`, `retro-props.ts`), NEXT-GEN's pearl ball with glowing panels
  (`drawNextgenBall`); both 6 x 6 with three spin frames and a gold variant, and
  `drawBallRing` is the same for all. `drawTrophy(..., glint, era)`: RETRO's gilt lidded
  cup, NEXT-GEN's narrow gold cup with a line of light (flaring over its rim when
  `light.lightsOn`); both 18 x 24 on today's footprint.
- **The big grounds** (tiers 4 to 7). RETRO (`retro-high.ts`): `trimFor(tier)` gives the
  stand's trim, hoardings, band, scoreboard, ball boys, table cloth and podium fringe the
  crowd's colour (old gold to tier 4, brick from 5); `lampStandard` draws the iron lamp
  standards with bare bulbs (no lattice pylons) and `searchlightDrum` the drums on the roofs
  at 6 and 7; `handScoreboard` stands on the end's roof (`endScoreboardX`) or, where that is
  off the canvas, on the grandstand's (`standScoreboardX`); a probe drops any far mover whose
  smoke would start inside the pediment's or flag's box; `drawOldBursts(..., bold)` are the
  goal fireworks. `retro-end.ts` `endBoards` letters the end's boards by hand. NEXT-GEN
  (`nextgen-high.ts`): the arena goal (above), the band a phone sees (light along the
  balcony rail and the tier fronts, lit boxes with holo panels, the track's light strip,
  low broadcast drones), `paintArenaPhotographers` (from tier 3, dispatched by `pitch.ts`
  `paintPhotographers`; a drone takes the first photographer's place from tier 4), the
  white-glass plinth, and the holo sign carried by two drones.
- **The effects** (`app/scenes/career-fx.ts`): `buildColors(grade, era)` (the promotion's
  close-up, `BuildColors.era`), `drawGoalFireworks(..., era)` and `drawConfetti(..., era)`
  take the era last and dispatch to `career-fx-retro.ts` and `career-fx-nextgen.ts`, at
  today's timings so the sounds still fit. At tier 7 `CareerGround.drawFront` swaps the
  ticker tape for RETRO's torn paper (`drawPaperTape`) or NEXT-GEN's glowing confetti
  (`drawGlowTape`).

Who draws what (files):

| area                         | RETRO                                                                                                                                                   | NEXT-GEN                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| players, props, crowd people | `characters/retro.ts`, `retro-props.ts`, `grounds/retro-people.ts`                                                                                      | `characters/nextgen.ts`, `grounds/nextgen-people.ts`                      |
| small grounds (tiers 0 to 3) | `grounds/retro-low.ts` (with the street at every tier, `paintRetroStreet`), `retro-club.ts`, `goal-retro.ts` (the goal at every tier), `retro-grade.ts` | `grounds/nextgen-low.ts` (the goal to tier 3)                             |
| big grounds (tiers 4 to 7)   | `grounds/retro-high.ts`, `retro-end.ts`, `retro-near.ts`, `retro-near-crowd.ts`, `retro-pitch.ts`                                                       | `grounds/nextgen-high.ts` (the arena goal, the photographers from tier 3) |
| effects                      | `scenes/career-fx-retro.ts`                                                                                                                             | `scenes/career-fx-nextgen.ts`                                             |

The shared files (`far.ts`, `near.ts`, `pitch.ts`, `end.ts`, `stadium.ts`, `crowd.ts`,
`goal.ts`, `ground.ts`, `kit.ts`, `people.ts`, `fetch.ts`, `props.ts`, `career.ts`,
`career-fx.ts`) hold only one-line dispatches on the era. To change an era's look, work in
its own files.

**Shots.** Every era shot has its own id; today's ids draw today's look.

- People: `people/retro-sheet` (also `-rival`, `-referee`, `-national`), `retro-youth`,
  `retro-keeper`, `retro-kits`, `retro-props`; `people/nextgen-sheet`, `nextgen-youth-sheet`,
  `nextgen-keeper-sheet`, `nextgen-fetch-sheet`, `nextgen-kits`, `nextgen-props`.
- Small grounds: `ground-low/retro-*` (`street`, `park`, `green`, `club`, `proper`, their
  near sides, `goals`, `tier0` to `tier3`, `pair0` to `pair3`, `row`) and
  `ground-low/nextgen-*` (`street`, `park`, `club`, `proper`, near sides, `tier1-far`,
  `tier1-near`, `goal0` to `goal2`, `t0` to `t3`).
- Big grounds: `ground/retro-t4` to `retro-t7`, `retro-stand`, `retro-end`, `retro-near`,
  `retro-goal`.
- The scene: `career/retro-players-*` and `career/nextgen-players-*` (`t0` to `t7`,
  `shot-<grade>` and `-t0`, `ft0`, `ft4`, `ft7`, `sheet`); `career/retro-low-*` (`t0` to
  `t3`, `goal-t0` to `-t3`, `promote1`, `promote3`, `ft0`, `ft3`, `sheet`);
  `career/retro-high-*` (`t4` to `t7`, `goal-t4` to `-t7`, `promote`, `promote5`, `ft4`,
  `ft7`, `sheet`); `career/nextgen-idle-t4` to `-t7`, `nextgen-golazo-t4` to `-t7`,
  `nextgen-worldie-t6`, `nextgen-promote-t4`, `-t5`, `nextgen-fulltime`, `-fulltime-t4`,
  `career/nextgen-high` (a sheet).

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
