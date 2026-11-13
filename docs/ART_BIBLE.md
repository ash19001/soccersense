# soccersense: art bible

Every pixel in the game follows this document. If you draw anything, read all of it first.

## 1. North star

**A 16-bit football game you half remember, on a perfect matchday.** Bright, confident, a bit
cheeky. Chunky pixels, clean shapes, saturated grass, a sky that matches the player's own.
Small characters with big personality. Everything is drawn in code, and everything moves a
little.

It must look like its own game. Do not look at, reference or imitate wonderhop.io or any other
game's art, palette, mascot or interface. No real club crests, kit designs, sponsor logos or
trophy designs.

## 2. Pixel scale

(History: until 2026-11-12 the scene art was drawn at half these sizes, a player 12 x 18 on a
480 x 270 canvas; it was redrawn natively at twice the detail, and the old art was removed.)

- **Compose for a PC monitor first.** The product owner pictures the game on a monitor, so the
  landscape picture (reference **960 x 540**, a 1920 x 1080 monitor) is the main one. Phones
  must still get a good picture of their own, composed second.
- All scene art is drawn at **canvas resolution** into a software framebuffer and scaled up
  with nearest-neighbour. Everything drawn at a fixed size (players, keeper, crowds, stands,
  boards, goals, props, effects, cars, coaches, people, the mascot, the airship and its sign,
  the wordmark, the menu ball's icons and words, every letter in the picture) is drawn
  natively at the sizes in section 5: never scaled up, with the palette, lighting calls and
  rules of section 4 (1 px `ink` outlines, no alpha, no anti-aliasing).
- **The interface's logical pixel** (`--px` CSS pixels, a whole number of device pixels: 4 on a
  1920 x 1080 monitor, 3 on most phones) sizes the DOM interface:
  - Portrait (phones, upright tablets): `px = clamp(min(round(cssWidth / 135), floor(cssHeight / 220)), 2, 8)`.
    The second term stops a wide, short screen from getting pixels so big that the picture
    is too short.
  - Landscape (desktop, tablets): `px = clamp(round(cssHeight / 290), 2, 8)`.
- **The canvas's pixel** is half the interface's, in device pixels, **rounded up**:
  `max(1, ceil(dp / 2))` (`canvasDpFor` in `app/ui/scale.ts`), so the canvas has about twice
  the interface's logical pixels each way. Where the interface's pixel is an even number of
  device pixels it is exactly twice (**960 x 540** at 1920 x 1080, 2 device pixels each);
  where it is odd a little less: 1.5 times at 3 device pixels (1366 x 768 and 1440 x 900 at
  100%: 683 x 384, 720 x 450; 1080p at 150%: 960 x 540), 1.67 at 5 (2560 x 1440: 854 x 480),
  1.75 at 7 (4K at 100%: 960 x 540), 1.8 at 9 (phones at ratio 3: 234 x 507). A canvas pixel
  is never one device pixel except where the interface's is two (a 1280 x 720 window at 100%:
  1280 x 720 at 1 each).
- **The sizes every painter must hold at**: landscape about **600 to 1440 wide and 360 to 720
  tall** (reference **960 x 540**); portrait about **215 to 390 wide and 400 to 620 tall**
  (reference **260 x 562**, a 390 x 844 phone; 234 x 507 at ratio 3). The canvas is a little
  "closer in" on the screens where it is 1.5 to 1.8 times the interface's: compose from the
  centre, the horizon and the ground line, never from an edge, and it holds.
- Every painter must draw correctly at any size in those ranges. Never hard-code 960, 540, 260
  or 562. Anchor to the centre, the horizon or the ground line, and extend sideways by
  repeating or generating more of the same (more stand, more houses, more sky). Positions
  that are fractions of the canvas (`round(H * 0.52)`) scale with it; fixed lengths (a gap,
  an offset, a threshold) are written plainly in canvas pixels.
- One pixel size everywhere in a scene. Never scale a sprite by a non-integer, never rotate a
  sprite, never draw sub-pixel positions: round every coordinate. Look at your work with
  `tsx tools/snap.ts <shot> --w 960 --h 540 --scale 1`.

## 3. Colour

### 3.1 The palette (v0)

Colours are named by role. Painters use the names from `app/art/palette.ts`, never raw hex.
The values below are the starting point. The art-core owner may tune a value after seeing it
rendered, but the names and roles are fixed and every change must be reported.

| group       | names and values                                                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| neutrals    | `ink #0f1220`, `night #1a2036`, `slate #2c3654`, `steel #56668a`, `mist #9fb0cc`, `chalk #f3eedd`, `white #ffffff`                   |
| grass       | `grassDeep #1b5e3f`, `grassDark #23824a`, `grass #33a653`, `grassLight #5cc45a`, `grassHi #9be06a`                                   |
| day sky     | `skyTop #2f6fd0`, `skyMid #5aa6f0`, `skyLow #a5dcf7`, `haze #e3f4f7`                                                                 |
| dusk sky    | `duskTop #2b2a66`, `duskMid #8c3f7d`, `duskLow #f0774a`, `duskGlow #ffcf6b`                                                          |
| dawn sky    | `dawnTop #2a3f86`, `dawnMid #b877a8`, `dawnLow #ffc58a`, `dawnGlow #fff0c2`                                                          |
| night sky   | `nightTop #070a1c`, `nightMid #101a3c`, `nightLow #1f2f5e`                                                                           |
| structure   | `concreteDark #3b4159`, `concrete #6b7390`, `concreteLight #a2abc2`, `steelHi #d6dceb`                                               |
| warm build  | `brickDark #6e2c2a`, `brick #a8483a`, `brickLight #d0714f`, `wood #8a5a34`, `woodDark #5c3a22`                                       |
| skin        | `skinA #f2c6a0` / `skinAShade #c98d6b`, `skinB #c98a5e` / `skinBShade #9a6040`, `skinC #7a4a32` / `skinCShade #55301f`               |
| hair        | `hairDark #2a1c16`, `hairBrown #7a4b20`, `hairBlond #e0b040`                                                                         |
| HOME (warm) | `homeDark #a3271f`, `home #e8452c`, `homeLight #ff8552`                                                                              |
| AWAY (cool) | `awayDark #116a80`, `away #19a9bf`, `awayLight #6fe0dc`                                                                              |
| gold        | `goldDark #b9770e`, `gold #ffc928`, `goldLight #fff2a0`                                                                              |
| scoreboard  | `ledOff #1c1f2b`, `amberDim #6b3f0e`, `amber #ffb21f`, `ledGreen #6dff7a`, `ledRed #ff5a4d`                                          |
| grades      | `worldie` = `gold`, `golazo #8fe35c`, `trivela #2fb36b`, `toepoke #4aa6e8`, `tapin #a66bea`, `miss #e9584a`, `timeup #7b86a3`        |
| sky extras  | `nightGlow #344a82`, `cloudLight #ffffff`, `cloud #d6e6f7`, `cloudShade #b4cbe8`, `sun #fff8d0`, `moon #f6f1dc`, `moonShade #c3c8d8` |

The grades are the six shots, best first, then the time-up grey: a ramp round the colour wheel
from gold through the greens and blue to red. `tapin` (added 2026-11-11 with the six shots) is
the ramp's step between the toe poke's blue and the miss's red, a violet as light as its
neighbours. In code the grades are named `gradeWorldie`, `gradeGolazo`, `gradeTrivela`,
`gradeToepoke`, `gradeTapin`, `gradeMiss` and `gradeTimeup` (renamed 2026-11-11 with the
shots, the colours unchanged). The sky extras exist only in `app/art/palette.ts`; every other
colour is also a CSS variable in `app/ui/tokens.css`, and a test keeps the two in step.

HOME is always warm red-orange and AWAY is always teal: in kits, patches, badges, buttons.

Rules for adding a colour: add it to the palette with a role name, as part of a ramp of two to
five steps, and shift hue along the ramp (shadows lean blue or purple, highlights lean yellow).
Never darken by adding black, never lighten by adding white.

### 3.2 Light

- Daylight comes from the **top left**. Tops and left faces are lighter, right faces and
  undersides darker. Cast shadows fall to the bottom right.
- Use **two or three tones per surface**, not gradients: base, shade, and sometimes one highlight.
- Time of day is applied by the lighting module (`app/art/lighting.ts`), not by hand:
  - `light.env(colour)` for anything lit by the sky (backdrops, exteriors, the park).
  - `light.lit(colour)` for anything under floodlights when they are on (pitch, stands, players).
  - Light sources themselves (lamps, LED text, lit windows, fireworks, flashes) are drawn
    with their raw palette colour, on top.
- At night the sky and backdrop go dark and blue, but a floodlit pitch stays bright green.
  That contrast is the look of a night game: protect it.

## 4. Drawing rules

- **No anti-aliasing, no alpha blending, no blur, no smooth gradients.** A pixel is one palette
  colour or it is transparent.
- **Gradients are bands.** Sky and large glows are three to seven flat bands with an ordered
  (Bayer 4x4) dither only on the boundary rows between bands.
- **Dither sparingly.** Good: sky band edges, light glows, soft shadows, net mesh, far haze.
  Bad: small sprites, faces, text, anything under about 12 px.
- **Outlines.** Characters, the ball and interactive objects get a 1 px `ink` outline (may be
  broken on the lit side). Backgrounds have no outlines: separate planes by value and hue.
- **Clusters, not noise.** No single stray pixels unless they are a deliberate sparkle, star or
  highlight. Textures (grass, crowd, brick) are regular, low-contrast patterns.
- **Readable silhouettes.** Squint test: every object must read as a clear shape at 1x.
- **Depth by value.** Far things are lower contrast and closer to the sky colour. Foreground
  has the darkest darks and the most saturated colour.
- **Curves** use clean pixel runs (for example 3,2,1,1,2,3). No jaggies with random steps.
- **The crowd** is a pattern of 3 x 4 px fans (head and body) on a 4 px pitch, mostly in the
  crowd's main colour, with about 20% in neutral and accent colours.

## 5. Metrics

Reference canvases 960 x 540 and 260 x 562 (section 2). Scale positions with the canvas; never
scale sprites.

| thing                     | size or position                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------ |
| adult player sprite       | 24 wide x 36 tall, drawn in a 32 x 40 cell, anchored bottom-centre                         |
| youth player (tiers 0, 1) | 20 x 28 in a 28 x 32 cell                                                                  |
| goalkeeper                | adult size (24 x 36), gloves, a kit colour used by nobody else in the scene                |
| match ball (career)       | 6 x 6 px plus a 2 px shadow, 2 or 3 spin frames                                            |
| crowd fan                 | 6 x 8 px on an 8 px pitch                                                                  |
| trophy                    | about 18 x 24 px, generic gold cup                                                         |
| walker (home screen)      | 6 x 10 at the near size class                                                              |
| car (home screen)         | 14 x 8 pointing east at the near size class                                                |
| the mascot                | 14 x 16                                                                                    |
| the airship               | 0.64 of the layout's sign zone (`AIRSHIP_SIZE`, `signPlace`), in its proportions; top left |
| the plane                 | 36 x 16, towing a banner 13 px tall (letters 7, `FONT_5x7` capitals)                       |
| menu ball                 | radius `round(min(W * 0.34, H * 0.165))`, centre `(W/2, round(H * 0.70))`: 89 at 960 x 540 |
| menu horizon              | the aerial picture's horizon, `menuLayout().horizonY`: row 146 at 960 x 540                |
| career ground line (feet) | `groundY = round(H * 0.52)`                                                                |
| career stage              | 260 wide on a phone (384 at 960 x 540). Hero at `cx - 52`, goal at `cx + 88`               |

The home picture draws its people, cars and props in three size classes (`sizeClass` in
`app/art/stadium-view.ts`), each drawn natively for its class, never scaled.

What the interface covers (measured on the finished interface kit). The interface sits in one
column centred on the screen, 135 interface pixels (`--px`) wide (wider on the smallest phones, where it is
405 font pixels, and never wider than the screen):

| part                          | 390 x 844 phone | shorter phones (375 x 667, 320 x 568) | desktop         |
| ----------------------------- | --------------- | ------------------------------------- | --------------- |
| board while asking (top)      | 27 to 30%       | 38 to 40%                             | 28%             |
| board after an answer (top)   | 19%             | 24%                                   | 18%             |
| answer bar (bottom)           | 9%              | 12%                                   | 9%              |
| reveal sheet (bottom)         | 46% (up to 49%) | 46% (up to 74%)                       | 46% (up to 50%) |
| full-time card (bottom)       | 36%             | 46%                                   | 34%             |
| home screen captions (bottom) | 9%              | 12%                                   | 9%              |

The board and the answer bar keep their size in CSS pixels, so on a short phone they take a
larger share of the height. Painters plan for the 390 x 844 figures (30%, 18%, 10%, 46%, which
are the `COVER` constants in `app/art/layout.ts`) and must stay readable when a short phone
hides a little more. The reveal sheet is the exception: since 2026-11-12 it is as tall as its
five rows need (docs/API_UI.md, `RevealSheet`), so with long names it covers more than 46%: up
to 49% at 390 x 844, 50% at 1366 x 768, 57 to 59% at 412 x 915 and 360 x 640, 74% at 320 x 568.

So the career scene's key action (hero, goal, keeper, the ball's flight) must sit between
`H * 0.31` and `H * 0.53`: that band is visible in every state on a normal phone, except that a
tall reveal sheet can cover its foot (on a small phone, the players) until NEXT. Sky and the
top of the stands show above it once the board shrinks. Below the ground line is the pitch down
to the near touchline (`groundY + round(H * 0.12)`), then boards, benches and photographers,
which are visible while asking and hidden by the sheet after.

Shared constants live in `app/art/layout.ts` (`menuLayout`, `careerLayout`, the sprite sizes),
and `docs/API_ART.md` lists every field with its value at the reference sizes. If a number
matters to more than one painter, it goes there.

## 6. Motion

- Everything is a pure function of time `t` (seconds) and a seed. No `Math.random()`, no
  `Date.now()` inside painters. Same inputs, same pixels.
- Sprite animation is stepped: 6 to 10 frames per second for characters, 2 to 4 for ambient
  loops (crowd bob, flags, lights). Movement is in whole pixels.
- Make things feel alive with small, cheap loops: drifting clouds, a breathing crowd, flags,
  blinking LEDs, a bouncing ball, falling rain or snow.
- Impact gets juice: two or three frames of squash, a 1 or 2 px screen shake, a flash, dust.
- Honour reduced motion: with `reducedMotion` set, drop shake and flashes and slow ambient loops.

## 7. Type

- **In the canvas**: the engine's bitmap fonts only (`FONT_5x7`, `FONT_3x5`). Scoreboards are
  dot matrix: `ledOff` panel, `amber` text, a dim dot grid behind it. Long names scroll.
  Every LED text is lamps (`drawLamps` in `app/art/led.ts`): each pixel of the font's face a
  hot lamp (half way to `goldLight`) on the 2 px pitch, its colour between neighbouring lamps,
  a faint glow beside them; it carries about four fifths of solid letters' light, so a sign
  reads as brightly. Painted words use `paintedFont`.
- **In the page (DOM)**: the Jersey family, self-hosted. One font pixel is `--fp` CSS pixels
  (a third of `--px`, as a whole CSS pixel: 1 on phones). Each face is used only at the size
  that puts its own pixel grid exactly on `--fp`, so nothing is resampled or blurred:
  `Jersey 10` (body), `Jersey 15` (questions, buttons), `Jersey 20` (headings),
  `Jersey 25` (big numbers), through the classes `ss-t10`, `ss-t15`, `ss-t20`, `ss-t25` in
  `app/ui/ui.css`. No other fonts, no other sizes, no synthetic bold or italic.

## 8. Interface skin (DOM)

The interface is matchday furniture, not a web app.

- **The board** is a stadium scoreboard: `ink` and `night` panel, bolted frame, `amber` LED
  numbers, `chalk` question text.
- **The table** in the reveal is a league table: position, name, place, share of players
  (`PICKED`; a distance for the locked modes CLOSEST and FURTHEST), points.
- Panels and buttons: square corners, borders in whole `--px` units, a hard 1 or 2 px drop
  shadow, a darker bottom edge that disappears when pressed. No border-radius, no blur, no
  CSS gradients, no opacity fades. Transitions use `steps()` or are instant.
- Colour carries meaning: HOME warm, AWAY teal, grade colours as in the palette.
- Touch targets are at least 44 CSS px tall. Focus is always visible (a `chalk` or `amber`
  2 px outline).

## 9. Before you say a piece is done

Render it, **look at the PNG**, and check every line. Then fix and render again. Expect at
least five rounds for anything a player will look at for more than a second.

1. Does it read instantly at 1x, in a squint? Is the silhouette clear?
2. Is every colour from the palette, used in its role, with light from the top left?
3. Any stray pixels, accidental noise, banding without dither, dither where it should not be?
4. Does it hold at day, dusk, night and dawn (where it applies)?
5. Does it hold at 260 x 562, 240 x 444, 320 x 600 and 960 x 540 (`snap.ts --size all`), and
   at 234 x 507, 683 x 384 and 854 x 480 (section 2.1)?
6. Is the scale consistent with the metrics table and with neighbouring art?
7. Does it move? Does the loop return to its start without a pop?
8. Would you be happy to see it in the first screenshot of the game? If not, keep going.

## 10. The two era looks: RETRO and NEXT-GEN

Since 2026-11-13 the career scene has three looks, one per era (`app/art/era.ts`; the code is
in `docs/API_ART.md`, "Eras"). HOME and AWAY are drawn in **today's** look, everything above.
**RETRO** is the early days of the game and **NEXT-GEN** the future, in the product owner's
words: "retro should be olden times so the first types of football kits, old brown ball, old
houses in background and net and park and stadiums etc. next gen should all be futuristic."

### 10.1 What stays the same

- **The composition and the play are HOME's.** The stage, the goal and its geometry, every
  stand, hut, board and lamp's place, the stands wrapping round the goal at the stadium
  tiers, the cast's places, every move and shot to the frame, the fetch, the promotion's
  smoke and its close-up of the ball in the net, full time and the trophy lift. RETRO and
  NEXT-GEN tell the hometown hero's story; only the look changes.
- **The sizes are the same.** Every person has today's cell, soles and spots (an era is a
  layer over today's frames, not new frames); the ball is 6 x 6 with three spin frames and
  today's ink ring; the trophy is 18 x 24 on today's footprint.
- **The rules are the same.** The game's palette by role, light from the top left, `env`
  for the sky's light and `lit` under floodlights, tiers 6 and 7 always at night, 1 px ink
  outlines on people and the ball, no gradients, no alpha, no anti-aliasing. Light sources
  (lamps, glowing trims, holograms, lit glass, fireworks) are raw palette colour drawn on
  top; a glow is a stepped pixel halo (a few flat or dithered bands), never a fade.
- **The hero's colour is his mode's colour**, in every era, and his things and his crowd wear
  it: HOME red, RETRO old gold, NEXT-GEN magenta. Neither era puts HOME's red on the hero,
  his things or his crowd.

| era      | the mode's ramp                                                            |
| -------- | -------------------------------------------------------------------------- |
| RETRO    | `retroDark #6b4426`, `retro #c79a3e`, `retroLight #f0d58e` (old gold)      |
| NEXT-GEN | `nextgenDark #7e1fb0`, `nextgen #f03cc8`, `nextgenLight #ff9cee` (magenta) |

### 10.2 RETRO: the early days of the game

The late 1800s to the 1930s in spirit. **Light is warm.** At every tier, every ground colour
is warmed 0.14 of the way to a sepia tan before the light grades it (one grade for the whole
era, `retro-grade.ts`, so a promotion never jumps in colour; lamps, lit windows and the sky
are not warmed), so the picture leans a little faded. It must stay readable: the grass stays
green and the cast stands out. Never a brown fog.

- **The people.** Heavy cotton shirts with long sleeves, buttoned cuffs and a laced collar;
  stripes where a kit has a stripe colour; long baggy shorts to the knee; thick socks with a
  turned-over band; high brown leather boots. Moustaches on the men (handlebar ends, so they
  read on dark skin), slicked hair with a side shine. The keeper in a cream polo neck, a
  tweed flat cap with a peak and leather gloves; the park keeper (tiers 0 and 1) in a cream
  jumper with a green roll neck and cuffs and a green tweed cap. The referee in a navy
  blazer with a white collar.
- **The kits.** His club in the deep end of the old gold (`goldDark`, shaded `retroDark`)
  with a chalk laced collar and cuffs, dark knickerbockers to the knee and old gold socks
  with a navy turnover, so he stands off the cream boards and the gold crowd behind him;
  the nation in brick red with the same dark knickers and brick socks turned over in chalk;
  rivals in purple-and-white stripes; the lad in the park in his gold jumper, dark knickers
  and light wool socks; park children in wool jumpers; the ball kid in a grey jumper.
- **The props.** A brown leather ball (the close-up's tone) with a chalk lace of dashes on
  its lit side that rolls round as it spins; the worldie's ball is the same leather gilded
  on its lit face, with a gold trail. A gilt lidded cup with ear handles on a wooden plinth
  (the period's cup was gilded; silver sank into the crowd), the same cup on the table at
  tier 6 and in his hands at tier 7.
- **The goal**, at every tier: square timber posts with a flat lit face and a shaded side,
  standing proud of the crossbar with its end grain showing (bare wood with a sagging bar
  and raw hemp at tier 1, painted white and a little chipped from tier 2), and a square
  mesh of 2 px rope cords 8 px apart, cream with a dark wood shade. At tier 0 a jersey in
  his colour and a tweed jacket with a flat cap make the posts.
- **The crowd.** Overcoats, flat caps (light tweed) and black bowler hats (a dome and a brim
  both sides), scarves, some wooden rattles held up with a clacker bar in the club colour;
  old gold, bright gold and chalk to tier 4, the nation's brick red and chalk from tier 5,
  coats a fifth at most. The near crowd from behind (tiers 3 to 7) dresses lighter: over
  40% cream, chalk or old gold coats (chalk and brick from tier 5), navy under 30%, caps a
  step off the coat, and a striped scarf on about one in five. Standing watchers wear caps
  and bowlers and dark overcoats or his old gold (never red or teal); children go
  bare-headed.
- **His street** at every tier: Victorian brick terraces, sooty, with sash windows of small
  panes, painted doors and chimney stacks on every party wall, plumes from the stacks near
  his house (puffs that shrink and vanish, never loose specks); painted shop signs with
  striped blinds (made-up names); cobbles and gas lamps with a lantern and a ladder bar; a
  mill with arched windows of small panes and two tall chimneys with big plumes; a viaduct
  with a steam train; a milk cart and its horse passing; at the stadium tiers the smoke
  rises behind the stands, never out of the pediment or its flag.

| tier              | RETRO                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0 park kickabout  | a village green: a bandstand with a striped roof (lanterns at night), big old trees, a cobbled path, a drinking fountain, a penny-farthing and a hoop; below the path an old gent in a bowler on a bench with a perambulator (near the middle, so phones see it), a pond with ducks and a toy yacht, the park keeper's KEEP OFF THE GRASS board                                      |
| 1 Sunday league   | a pavilion with a gable; leather bags, a canvas holdall, an enamel jug, leather balls in a string bag; the subs in old gold and brown overcoats with flat caps and turned-up collars                                                                                                                                                                                                 |
| 2 non-league      | timber lamp standards with arc lamps, a tea hut of planks with an old gold and chalk awning, a corrugated stand with a painted gable, hand-painted boards, the trainer's bench with a bucket and sponge                                                                                                                                                                              |
| 3 lower leagues   | a wooden grandstand with a gable and a clock, a timber terrace with wooden barriers, a hand-turned scoreboard with a ladder (kept whole on the narrowest phone); timber lamp towers that light the pitch at night; cinders and iron barriers on the near side                                                                                                                        |
| 4 top flight      | a grand old grandstand: corrugated roof, cream timber fascia, a pediment with a clock and the club flag, cast-iron columns, a lattice balcony, a paddock with crush barriers, painted hoardings, a newsreel box (its cranks turning), iron lamp standards with two arms of bare bulbs (a stepped halo by night); the trim in the crowd's colour, old gold to tier 4 and brick from 5 |
| 5 international   | + bunting, roof flags, cloth banners, a brass band on a painted platform in the upper tier, two horns glinting at a time                                                                                                                                                                                                                                                             |
| 6 World Cup final | + searchlight drums on the grandstand and end roofs, giant flags; the cup on a draped table                                                                                                                                                                                                                                                                                          |
| 7 winner          | + fireworks of the era (rockets on sticks, gold willows, red stars, 2 px heads with a powder puff); torn newspaper and streamers for ticker tape; a podium of timber boxes, the winner's raised, lit top planks, the numbers clear                                                                                                                                                   |

The painted boards along the touchline alternate light grounds with dark letters and dark
grounds with light letters; the boards down the end's slant are hand-lettered the same way
(brick on cream, chalk on dark timber) or plain varnished planks, never today's coloured
blocks. At tiers 4 to 7 the end behind the goal has painted hoardings, a cinder terrace and a
hand-turned scoreboard on its roof (on the grandstand's roof, left of the pediment, where the
end's roof is off the canvas, as on phones); the near side has timber hoarding backs, a cinder
track, ball boys on crates, a policeman and press photographers with box cameras. **The
effects**: goal fireworks of the era at today's moments, bolder than today's by day; at the
trophy lift torn paper, with caps and bowlers thrown up; the promotion's close-up is an old
laced leather ball in a rope net, gas lamps blurred behind.

### 10.3 NEXT-GEN: the future

**Light is cool and electric.** Lamps, light strips and lit glass are raw `skyLow` with a
`white` core and `skyMid` halos, with the mode's magenta for accents; at night the lamp pools
at the park are cool, not warm. Everything else is graded as today's is. Glows are stepped
halos, by night only where a real lamp would glow.

- **The people.** Sleek kits with glowing seams where the lit side meets the shade, white-hot
  collars, cuffs and sock bands, a glowing waistband and shorts stripe, light-up soles, and
  a visor across the eyes with its glass in the kit's light.
- **The kits.** His club in magenta with night shorts; the nation in white with magenta
  light; rivals in dark slate with cyan light; the keeper in gold with gloves of light; park
  children in their own tops with light-up trims; the ball kid in his sky-blue bib.
- **The referee** is a man in black with seams of amber light and the cast's visor, in
  today's place and moves (until 2026-11-13 a hovering drone, which read as a floating pill).
- **The props.** A pearl ball with glowing magenta panels (gold for the worldie), and every
  struck shot leaves a light trail. The trophy is a tall, narrow gold cup with angular wing
  handles and a line of cyan light down its bowl, on a dark plinth ringed with magenta; by
  night the line flares up out of the rim. Never the ball's white and magenta.
- **The goal**, at tiers 1 to 3: slim posts and a net drawn as lines of light (today's
  lattice and bulge), with a light along the net's foot. At tier 0 two marker cones (white,
  a magenta light band, a lit tip, a strip of light at the foot, the grass glowing round
  them in steps by night) stand on today's jumper spots, lower than the glass rail. From
  tier 4 the arena goal is today's 4 px frame in light: an ink backing, a white face, a cyan
  core and a `steelHi` side, a stepped halo on the shaded side by night, and today's mesh in
  `awayLight` and `away`, so it reads in front of the glass stands.
- **The crowd** is led by the hero's magenta, a step down (with violet, slate, white, cyan,
  silver and dark), so he stands out in front of it. About a third hold up a 2 x 2 wristband
  of light (a white crest runs across the stands as a light wave, with a stepped halo by
  night), about one in seven wears a cyan visor, and the near crowd from behind wears
  headsets of light. The standing watchers (tiers 0 to 2) wear slim jackets in slate, night,
  steel or panel grey (his magenta where today's wear red) with a hem and zip of cyan or
  white light, about half with a visor.
- **His street** at every tier: a far skyline of glass towers in three depth bands (the far
  one close to the sky's colour, without windows by day; the near one a few lower slate
  towers lit on their left; open sky between the clusters, a ring tower left of centre for
  a landmark; roof gardens, sky bridges, antennas with red lamps, lit windows at night),
  smart townhouses with roof gardens, solar panels and drone pads, solar trees, a needle
  tower for the church spire, a light pole for the street lamp; hover cars and drones pass
  between the skyline and the street. The park's turf is smart turf; at tiers 1 to 3 a row
  of 2 x 1 sensor lights runs just inside each touchline with a pulse of light chasing
  along it.

| tier              | NEXT-GEN                                                                                                                                                                                                                                                                                                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 park kickabout  | a clipped hedge behind a glass rail with a light strip; a lit smart path, a light bench, hoverboards, a robot dog                                                                                                                                                                                                                                                                     |
| 1 Sunday league   | a capsule pod hovering on light for the hut, a line of light on slim posts for the rope, magenta pennants; a hard case in his colour                                                                                                                                                                                                                                                  |
| 2 non-league      | light masts, a kiosk pod with a holographic cup, a light-framed stand with a glass roof, holographic boards that crawl, glass dugouts                                                                                                                                                                                                                                                 |
| 3 lower leagues   | light towers, a scoreboard on dark glass, a white terrace with glass barriers, a main stand with a glass bar and strip lights; holographic boards at the end                                                                                                                                                                                                                          |
| 4 top flight      | an arena of glass and light: a white canopy roof with a magenta light ribbon, a crown of glass vaults, a glass balcony with a band of cyan light along its rail, lit hospitality boxes (every third a magenta holo panel), a magenta strip along the lower tier's front, holographic boards that crawl, camera drones, a holo sign of teal scanlines carried by two drones on tethers |
| 5 international   | + holographic flags, LED banners, light sticks in the crowd                                                                                                                                                                                                                                                                                                                           |
| 6 World Cup final | + the ribs of a dome over the sky and three sweeping lasers, giant flags; the trophy on a white glass pedestal ringed with light                                                                                                                                                                                                                                                      |
| 7 winner          | + a drone light show for fireworks (no dome, no lasers), glowing confetti for ticker tape; a podium of white glass steps                                                                                                                                                                                                                                                              |

NEXT-GEN's boards say their own words (`en.play.canvas.nextgen.boards`: SOCCERSENSE, DRONE
PIES, HOLO SEATS, SCAN TO CHEER), in lamps of chalk, cyan, teal or pale gold on dark glass with
a scanline sweeping down them. At tiers 4 to 7 the near side has slim board backs, a cyan
light strip along the track's edge, glass dugouts in magenta, ball kids in dark bibs with
light trims and visors on hover stools, a steward with a light band and a robot dog; from
tier 3 the photographers wear dark jackets with a seam of light, a visor and a glowing lens,
and from tier 4 a broadcast drone hovers behind the goal line in the first one's place.
These are what a phone sees, where the board hides the roofs. **The effects**: goal bursts
of climbing drones and rings of light (2 to 3 px deep, with spokes while they open) at
today's moments; glowing confetti at the trophy lift; the promotion's close-up is the
glowing ball in a net of light, in a cool mist.

### 10.4 Rules for era art

- Draw an era only in its own files and its own branch of a shared painter, and only when
  `era` says so: with `"today"` every painter draws exactly what it drew before (the
  references in `.snaps/era-art/ref` prove it to the pixel).
- An era changes how a thing looks, never where it is or when it moves. Keep today's
  silhouettes, cells, spots, rows and timings.
- Use the game's palette by role. Each era's own colour is its mode's ramp, and whatever is
  "his colour" (his kit, his door, his crowd, his jersey on the goal pile) takes it.
- RETRO: warm, a little faded, never murky; wood, brick, leather, wool, cinders, smoke.
  NEXT-GEN: cool and electric; glass, white panels, light strips, holograms, drones. Its
  lights shine by day and night, but their halos only at night (a lamp does not glow in
  sunshine).
- Moving things go into the ground's `Life` (an era's movers), made once per build, and
  allocate nothing per frame.

## 11. Never

Alpha blending or anti-aliasing. Raw hex in painters. Randomness without a seed. Sub-pixel
positions. Rotated or non-integer-scaled sprites. Outlined backgrounds. Pure black or pure grey
shadows. Real crests, sponsors, kit designs or trophies. Anything copied from another game.
