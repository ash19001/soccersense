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

- **Compose for a PC monitor first.** The product owner pictures the game on a monitor, so the
  landscape picture (reference 480 x 270, a 1920 x 1080 monitor) is the main one. Phones must
  still get a good picture of their own, composed second.
- All scene art is drawn at **logical resolution** into a software framebuffer and scaled up
  with nearest-neighbour. One logical pixel is `--px` CSS pixels (4 on a 1920 x 1080 monitor,
  3 on most phones).
- Portrait (phones, upright tablets): `px = clamp(min(round(cssWidth / 135), floor(cssHeight / 220)), 2, 8)`,
  so the logical canvas is about **120 to 195 wide and 220 to 310 tall**. The second term stops
  a wide, short screen from getting pixels so big that the canvas is too short. The reference
  size is **130 x 281**.
- Landscape (desktop, tablets): `px = clamp(round(cssHeight / 290), 2, 8)`, giving about
  **400 to 720 wide and 250 to 360 tall**. The reference size is **480 x 270**.
- Every painter must draw correctly at any size in those ranges. Never hard-code 130 or 281.
  Anchor to the centre, the horizon or the ground line, and extend sideways by repeating or
  generating more of the same (more stand, more houses, more sky).
- One pixel size everywhere in a scene. Never scale a sprite by a non-integer, never rotate a
  sprite, never draw sub-pixel positions: round every coordinate.

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

Reference portrait canvas 130 x 281. Scale positions with the canvas; never scale sprites.

| thing                     | size or position                                                             |
| ------------------------- | ---------------------------------------------------------------------------- |
| adult player sprite       | 12 wide x 18 tall, drawn in a 16 x 20 cell, anchored bottom-centre           |
| youth player (tiers 0, 1) | 10 x 14 in a 14 x 16 cell                                                    |
| goalkeeper                | adult size, gloves, a kit colour used by nobody else in the scene            |
| match ball (career)       | 3 x 3 px plus a 1 px shadow, 2 or 3 spin frames                              |
| crowd fan                 | 3 x 4 px on a 4 px pitch                                                     |
| trophy                    | about 9 x 12 px, generic gold cup                                            |
| menu ball                 | radius `round(min(W * 0.34, H * 0.165))`, centre `(W/2, round(H * 0.70))`    |
| menu horizon              | the aerial picture's horizon, `menuLayout().horizonY`: row 73 at 480 x 270   |
| career ground line (feet) | `groundY = round(H * 0.52)`                                                  |
| career stage              | 130 wide, centred on `W/2`. Hero rests at `cx - 26`, goal mouth at `cx + 44` |

What the interface covers (measured on the finished interface kit). The interface sits in one
column centred on the screen, 135 logical px wide (wider on the smallest phones, where it is
405 font pixels, and never wider than the screen):

| part                          | 390 x 844 phone | shorter phones (375 x 667, 320 x 568) | desktop |
| ----------------------------- | --------------- | ------------------------------------- | ------- |
| board while asking (top)      | 27 to 30%       | 38 to 40%                             | 28%     |
| board after an answer (top)   | 19%             | 24%                                   | 18%     |
| answer bar (bottom)           | 9%              | 12%                                   | 9%      |
| reveal sheet (bottom)         | 46%             | 46%                                   | 46%     |
| full-time card (bottom)       | 36%             | 46%                                   | 34%     |
| home screen captions (bottom) | 9%              | 12%                                   | 9%      |

The board and the answer bar keep their size in CSS pixels, so on a short phone they take a
larger share of the height. Painters plan for the 390 x 844 figures (30%, 18%, 10%, 46%, which
are the `COVER` constants in `app/art/layout.ts`) and must stay readable when a short phone
hides a little more.

So the career scene's key action (hero, goal, keeper, the ball's flight) must sit between
`H * 0.31` and `H * 0.53`: that band is visible in every state on a normal phone. Sky and the
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
5. Does it hold at 130 x 281, 120 x 222, 160 x 300 and 480 x 270?
6. Is the scale consistent with the metrics table and with neighbouring art?
7. Does it move? Does the loop return to its start without a pop?
8. Would you be happy to see it in the first screenshot of the game? If not, keep going.

## 10. Never

Alpha blending or anti-aliasing. Raw hex in painters. Randomness without a seed. Sub-pixel
positions. Rotated or non-integer-scaled sprites. Outlined backgrounds. Pure black or pure grey
shadows. Real crests, sponsors, kit designs or trophies. Anything copied from another game.
