# Interface kit reference (`~/ui`)

The DOM skin of the game: the board, the answer bar, the reveal sheet, the full-time card, the
menu captions and their parts. Presentational only: props in, events out, no game rules, no text
of its own (every string is a prop, so it comes from `app/i18n`). Import everything from `~/ui`.
The styles (`app/ui/tokens.css`, `app/ui/ui.css`) are loaded once from `app/app.css`.

Look at it: `/dev/ui` is the gallery, `/dev/ui?only=<name>` is one composition full-screen.
Beside it, `/dev/sound` is the sound board: every sound the game plays, with its level from
`app/audio/mix.ts` on a slider (docs/AUDIO.md, "Changing the volumes").

`~/ui` also holds the canvas host, `PixelStage`, and the hook that gives a page the player's own
sky, `useDeviceSky`. They have their own section below ("The canvas host") and their own test
card at `/dev/stage`. What the host runs (the scene contract and the menu scene) is in
`docs/API_SCENES.md`. The pages themselves are under "The pages" at the end.

## Units

Everything is sized from a few CSS variables. `PixelRoot` (and so `GameLayout`) sets them and
keeps them in step with the window and with the device pixel ratio. Outside one, `:root` carries
the CSS-pixel half of the rule in CSS (CSS cannot ask for the ratio, so it takes it to be 1).

| variable  | what it is                                                                | used for                                     |
| --------- | ------------------------------------------------------------------------- | -------------------------------------------- |
| `--px`    | CSS px per logical (scene) pixel: a whole number of device pixels         | borders, shadows, padding, gaps, plates      |
| `--fp`    | CSS px per font pixel: a third of `--px`, in whole device pixels          | type sizes, line heights, LED lamps          |
| `--cp`    | CSS px per caption pixel: half of `--px` rounded up, never less than `fp` | type set straight on the picture (wide menu) |
| `--snap`  | the step to round layout to: the whole device pixels nearest one CSS px   | every `round()` in ui.css                    |
| `--nudge` | a 64th of `--snap` (0 at whole ratios), added before a `round()`          | keeps a length already on the grid on it     |
| `--tx`    | the older text unit, `max(2, px - 1)`                                     | canvas code only; the skin never reads it    |

### The rule: sized in CSS pixels, drawn in device pixels

How big things should be is decided in CSS pixels, because display scaling and browser zoom exist
so that things are big enough for the person. `pixelScale(cssWidth, cssHeight, dpr = 1)` (art
bible section 2):

- portrait (`h >= w`): `target = clamp(min(round(w / 135), floor(h / 220)), 2, 8)`
- landscape: `target = clamp(round(h / 290), 2, 8)`

Then the device decides, so that every pixel on screen is the same size at any scaling or zoom:

```
dp = max(2, round(target * dpr))      device pixels per logical pixel
px = dp / dpr                         the same in CSS px: 3.2 at 125% is exactly 4 device pixels
fp = max(1, round(max(1, round(target / 3)) * dpr)) / dpr
cp = max(fp * dpr, ceil(dp / 2)) / dpr
logical canvas = ceil(device size / dp)
```

At device pixel ratios 1, 2 and 3 nothing differs from the CSS-pixel rule: `px` and `fp` are the
whole numbers they always were, and so are the logical canvas and every layout. At a fractional
ratio they are fractions of a CSS pixel. It returns
`{ px, tx, fp, cp, logicalW, logicalH, portrait, dpr, dp, snap }` (`dp` is device pixels per
logical pixel; `fp * dpr` and `cp * dpr` are whole too).

| viewport (CSS px) | ratio | dp  | px      | fp (device) | cp (device) | logical canvas | column (CSS px) | wide |
| ----------------- | ----- | --- | ------- | ----------- | ----------- | -------------- | --------------- | ---- |
| 1920 x 1080       | 1     | 4   | 4       | 1 (1)       | 2 (2)       | 480 x 270      | 540             | yes  |
| 1440 x 900        | 1     | 3   | 3       | 1 (1)       | 2 (2)       | 480 x 300      | 405             | yes  |
| 1366 x 768        | 1     | 3   | 3       | 1 (1)       | 2 (2)       | 456 x 256      | 405             | yes  |
| 2560 x 1440       | 1     | 5   | 5       | 2 (2)       | 3 (3)       | 512 x 288      | 810             | yes  |
| 1536 x 864        | 1.25  | 4   | 3.2     | 0.8 (1)     | 1.6 (2)     | 480 x 270      | 432             | yes  |
| 1280 x 720        | 1.5   | 3   | 2       | 1.33334 (2) | 1.33334 (2) | 640 x 360      | 540             | yes  |
| 1097 x 617        | 1.75  | 4   | 2.28572 | 1.14286 (2) | 1.14286 (2) | 480 x 270      | 462.86          | yes  |
| 1707 x 960        | 1.5   | 5   | 3.33334 | 1.33334 (2) | 2 (3)       | 513 x 288      | 540             | yes  |
| 1745 x 982        | 1.1   | 3   | 2.72728 | 0.9091 (1)  | 1.81819 (2) | 640 x 361      | 368.19          | yes  |
| 2133 x 1200       | 0.9   | 4   | 4.44445 | 1.11112 (1) | 2.22223 (2) | 480 x 270      | 600             | yes  |
| 390 x 844         | 2     | 6   | 3       | 1 (2)       | 1.5 (3)     | 130 x 282      | 390             | no   |
| 390 x 844         | 3     | 9   | 3       | 1 (3)       | 1.66667 (5) | 130 x 282      | 390             | no   |
| 360 x 740         | 3     | 9   | 3       | 1 (3)       | 1.66667 (5) | 120 x 247      | 360             | no   |
| 375 x 667         | 2     | 6   | 3       | 1 (2)       | 1.5 (3)     | 125 x 223      | 375             | no   |
| 320 x 568         | 2     | 4   | 2       | 1 (2)       | 1 (2)       | 160 x 284      | 320             | no   |
| 768 x 1024        | 2     | 8   | 4       | 1 (2)       | 2 (4)       | 192 x 256      | 540             | no   |
| 820 x 1180        | 2     | 10  | 5       | 2 (4)       | 2.5 (5)     | 164 x 236      | 810             | no   |

(1536 x 864 at 125% and 1097 x 617 at 175% are a 1920 x 1080 panel: both get the picture of the
100% monitor, 480 x 270 at 4 device pixels. 1745 x 982 at 1.1 is browser zoom 110% on that panel,
2133 x 1200 at 0.9 is zoom 90%. The fractions are written with their fifth decimal rounded up, so
the browser lands on the whole device pixel or a hair above it, never a hair below.)

What that means for the person: on most screens a font pixel is one CSS pixel, so between 100%
and 149% scaling or zoom the DOM type stays at one device pixel per font pixel (no bigger on the
glass, and smaller in CSS pixels), and at 150% it doubles. That is the price of whole pixels.

Hooks: `usePixelScale()` reads the window and `devicePixelRatio` (safe at build time: it returns
`DEFAULT_SCALE`, a 390 x 844 phone at ratio 1, which is also the first client render, so there
is no hydration mismatch). It follows the window live: resize, orientation change, and a change
of ratio (browser zoom, or the window dragged to a monitor with another scaling) through a
`resolution` media query. `PixelStage` also checks the ratio once a frame
(`noticeDevicePixelRatio()`), for the browsers and tools that change it without an event.
`usePixelRootScale()` gives the scale of the nearest `PixelRoot`, for the canvas stage. An open
keyboard never changes the scale. Where the browser gives the exact viewport size (the visual
viewport: 1745.45 x 981.82 CSS px for 1920 x 1080 at 110%, where `innerHeight` says 982), the
logical canvas is exact; from whole CSS pixels it is rounded up and can be one row too many.

Also from `~/ui`: `deviceToCss(devicePixels, dpr)`, `pixelVariables(scale)` (the six variables as
strings), `isWide(scale)` with `WIDE_ROW_PX` and `WIDE_ROW_CP`, and `noticeDevicePixelRatio()`.

Derived variables (declared on `:root` and `.ss-root`): `--u`, `--u2` ... `--u6`, `--u8` (that
many `--px`), `--tap` (smallest touch target: 44 CSS px rounded up to an even number of snaps, or
14 px if that is more), `--ring` (focus ring width: one logical pixel, never under 2 CSS px,
rounded up to whole device pixels; `app.css` draws every focus ring with it), `--plate` (height
of a one-line plate),
`--fs-10/15/20/25` and `--lh-10/15/20/25` (type), `--lh-tight` (15 fp: one tight line of body
text), `--font-10/15/20/25`. The ones that follow the font pixel (`--fs-*`, `--lh-*`, `--plate`)
are declared again on `.ss-menu` and on the game's four screens (`.ss-board`, `.ss-answer`,
`.ss-sheet`, `.ss-full`), which swap `--fp` for `--cp` on a wide screen.

**Whole device pixels, in CSS.** `1px` is not a pixel at 125%, so ui.css has no bare lengths:
everything is a multiple of `--px`, `--fp` or `--cp`, and what has to be rounded is rounded to
`--snap` with the nudge, `round(down, calc(X + var(--nudge)), var(--snap))` (minus the nudge
when rounding up). At ratios 1, 2 and 3 `--snap` is `1px` and `--nudge` is `0px`, which is the
CSS there always was. A test in `kit.test.tsx` reads the stylesheet and fails on a bare step.

Palette: `--c-<kebab-name>` for every colour in art bible section 3.1 (`--c-ink`, `--c-amber`,
`--c-home-light`, `--c-grade-golazo` ...). No other colours. A test in
`app/art/palette.test.ts` checks every one against the palette.

Set by `GameLayout` for its children: `--ss-h` (the full height the sheet and the card measure
their 46% against), `--ss-pad-t` and `--ss-pad-b` (column padding, safe areas included),
`--ss-col` (column width).

## Type classes

Each Jersey face is used at the one size that puts its pixel grid on `--fp`. No other sizes.

| class    | face      | capital height | line height | for                |
| -------- | --------- | -------------- | ----------- | ------------------ |
| `ss-t10` | Jersey 10 | 10 fp          | 18 fp       | body (the default) |
| `ss-t15` | Jersey 15 | 15 fp          | 24 fp       | questions, buttons |
| `ss-t20` | Jersey 20 | 20 fp          | 30 fp       | headings           |
| `ss-t25` | Jersey 25 | 25 fp          | 36 fp       | big numbers        |

Also `ss-sr` (screen readers only), `ss-page` (a plain page outside the game: rules, errors) and
`ss-root` (what `PixelRoot` renders: body type, chalk on whatever is behind).

## `data-mode` and `data-grade`

Colour is inherited from attributes, on any element:

- `data-mode="home" | "away"` sets `--mode`, `--mode-dark`, `--mode-light` (warm or teal).
  Components that take a `mode` prop set it themselves.
- `data-grade="worldie" | "golazo" | "trivela" | "toepoke" | "tapin" | "miss" | "timeup" | "skipped"`
  sets `--grade`: the six shots (gold, light green, green, blue, violet, red: a ramp round the
  colour wheel, best first), then the time-up grey and, for a pass, mist. (Changed on
  2026-11-11: the six shots replace the sliding grades; renamed the same day, from bicycle,
  finesse, power and chip, the colours unchanged.)

`UiMode` and `UiGrade` are structurally the same as `Mode` and `Grade` in `~/game`, so game values
pass straight in. `UI_GRADES` lists the grades in order, best shot first.

## Components

Props marked `?` are optional. Every component also takes `className?`.

### `GameLayout`

`canvas?`, `top?`, `bottom?`, `children?`, `contained?`, `sound?` (a sound switch in the
corner, off by default: the switch normally lives in `MenuCaptions` and `Board`, see
`SoundToggle`)

The game shell and the only layout component. It is a `PixelRoot` fixed to the viewport, with
the `canvas` slot filling it and one column over it: 135 logical px wide (405 fp where that is
more, never wider than the screen), centred. On a wide screen the column is 656 caption pixels
(1312 CSS px at 1920 x 1080; at most the screen less 8 logical px a side), and the four screens
lie down in it (see "On a wide screen" below).

```tsx
// PixelStage is the canvas host: see "The canvas host" below.
<GameLayout
  canvas={<PixelStage scene={scene} light={sky?.light ?? null} />}
  top={<Board {...board} compact={phase !== "asking"} />}
  bottom={
    phase === "asking" ? (
      <AnswerBar {...answer} />
    ) : phase === "reveal" ? (
      <RevealSheet {...reveal} />
    ) : (
      <FullTimeCard {...fullTime} />
    )
  }
>
  {/* optional: anything that floats over the scene between the two */}
</GameLayout>
```

- The slots take pointer events; the rest of the column lets them through to the canvas.
- The column follows the visual viewport, so the answer bar stays above an on-screen keyboard
  while the canvas does not move. `data-keyboard="open"` is set on the root meanwhile.
- If `top` and `bottom` ever need more height than there is, `bottom` stays whole and covers
  the end of `top`. The answer bar is never pushed off the screen.
- `contained` fills the parent instead of the viewport (the gallery). The parent then needs a
  height and `--ss-h`.
- On a wide screen the root carries `data-wide`: a monitor, not a phone. That is `isWide(scale)`:
  landscape, with a logical canvas at least 60 logical pixels and 480 caption pixels wide (300
  logical pixels at 1920 x 1080, 380 at 1366 x 768). Every size in the table above marked "wide"
  has it; a phone, an upright tablet, a 1024 x 768 window and a contained layout do not. The
  menu captions read it (they leave the column there), and so do the board, the answer bar,
  the reveal sheet and the full-time card ("On a wide screen" below). It is the hook for giving
  any other part a monitor layout: `.ss-game[data-wide] .your-part { ... }`.
- The root carries `data-live` once the page runs in a browser. The build-time HTML does not: it
  is laid out for a 390 x 844 phone at ratio 1, because the screen is not known yet. Anything
  that would visibly jump when the real scale arrives can wait for it in CSS; the menu captions
  do, on a landscape screen (`.ss-game:not([data-live]) .ss-menu`).

What it covers on a 390 x 844 phone (measured, outlines included): board while asking 30% with a
three-line question (27% with two lines), compact board 19%, answer bar 9%, reveal sheet 46%,
full-time card 36% (46% at most), menu captions 9%. On shorter phones the board and the bar
keep their size in CSS px, so they take a larger share: 38% and 12% at 375 x 667.

#### On a wide screen

The board, the answer bar, the reveal sheet and the full-time card are set in caption pixels
(`--fp` is swapped for `--cp` inside each, ui.css section 16b): twice the type of the phone
layout on most monitors (capitals 20 CSS px for body text at 1920 x 1080, 30 for the question),
the size of the home screen's row, every face still on its own grid. Doubled, the phone's stacks
would not fit the heights the career scene is composed around (`COVER` in `app/art/layout.ts`),
so each part lies down. No prop changed; phones and upright tablets are untouched (every gallery
composition compared pixel for pixel at 390 x 844 @3, 360 x 740 @3, 375 x 667 @2, 320 x 568 @2
and 768 x 1024 @2).

- **Board**: the screen with the question on the left; on the right, one line each, the badge,
  the stadium and the score, the lamps and the career bar, and the clock. The right side is
  wide enough for WORLD CUP WINNER beside the lamps and a seven-letter stadium beside the score
  (a longer name ends in an ellipsis, as on a phone). Compact, the recap and the rule are set
  on tight lines (two lines of recap at most stay inside 18% at 1366 x 768).
- **Answer bar**: the field and SHOOT are one line of their type tall inside their border (or
  a touch target if that is more), with only the frame round them, and the bar stands on the
  bottom edge of the screen like the sheet (its outline and shadow below the edge).
- **Reveal sheet**: the grade band, the sentence (it scrolls past the height there is), the
  player's own answer under it when it did not score, and the button on the left; the league
  table on the right, as tall as the sheet.
- **Full-time card**: FULL TIME and the career title across the top, the score and the three
  buttons on the left (the buttons at the foot), the seven answers on the right.

What each part covers, measured over all sixteen game compositions in the gallery (the most of
any; outline and shadow included; "asking" is the board while a question is asked, three lines
of question at 1920 x 1080 and 125% for `ask-long`, two everywhere else):

| screen             | column | board asking | board after | answer bar | with PASS or a rejection | reveal sheet | full-time card |
| ------------------ | ------ | ------------ | ----------- | ---------- | ------------------------ | ------------ | -------------- |
| 1920 x 1080        | 1312   | 26.3%        | 14.3%       | 7.8%       | 14.1%                    | 45.9%        | 32.4%          |
| 1440 x 900         | 1311   | 24.3%        | 15.3%       | 8.3%       | 15.3%                    | 46.0%        | 36.7%          |
| 1366 x 768         | 1311   | 28.5%        | 18.0%       | 9.8%       | 18.0%                    | 46.0%        | 43.0%          |
| 2560 x 1440        | 1965   | 23.4%        | 14.9%       | 8.1%       | 14.9%                    | 46.0%        | 35.1%          |
| 1536 x 864 at 125% | 1049.6 | 26.3%        | 14.3%       | 7.8%       | 14.1%                    | 45.9%        | 32.4%          |
| limit (`COVER`)    |        | 30%          | 18%         | 10%        |                          | 46%          | 46%            |

The board after an answer at 1366 x 768 (17.97%) has no room to spare, and neither has the
board while asking where a question needs three lines on a screen that is three CSS px a
logical pixel and two a caption pixel (1366 x 768, 1440 x 900): a question takes two lines there
up to about 72 characters (the longest in `app/data` is 63). The rejection plate and PASS float
above the bar and are counted separately.

### `PixelRoot`

Any `div` props. Sets `--px`, `--fp`, `--cp`, `--tx`, `--snap`, `--nudge` and
`data-orientation="portrait" | "landscape"`, and provides the scale to `usePixelRootScale()`. Use
it for a page that shows kit components without `GameLayout`. A page with no `PixelRoot` at all
(`ss-page` on its own) gets the CSS fallback, which knows nothing of the device pixel ratio: its
type is exact at ratios 1, 2 and 3 and slightly soft at 125% or 150%. No page of the site is
like that any more: the rules page and the error page are each a `PixelRoot` (see "The pages").

### `Board`

`mode`, `questionNumber` (1-based), `questionCount`, `results` (grade or `null` per question),
`total`, `tierName`, `tierProgress` (0 to 1), `question`, `instruction`, `measureLine`,
`secondsLeft`, `secondsTotal`, `compact?`, `labels: { mode, questionOf, points, totalSpoken?,
timeLeft?, board? }`, `sound?` (the sound switch after the mode badge: labels, default
`strings.sound`, or `false`; see `SoundToggle`). (`stadiumName` is gone, 2026-11-11: the board no longer names the day's
stadium, and on a monitor its right-hand column is only as wide as the career bar needs, the
rest going to the question.)

The scoreboard: badge, total (LED), seven lamps, career bar, the question screen, the
clock. `compact` (from the moment an answer is in) shrinks the question to a recap, keeps the
instruction line, and removes the measure line and the clock.

### `AnswerBar`

`value`, `onChange(value)`, `onSubmit(value)`, `mode`, `labels: { input, shoot, pass }`,
`onPass?`, `canPass?`, `rejection?` (text or `null`), `shakeKey?`, `busy?`, `placeholder?`,
`autoFocus?`, `inputRef?`

Controlled field plus SHOOT (Enter works). The rejection plate and PASS float above the bar, so
nothing moves when they appear. Count the rejections and pass the count as `shakeKey`: the bar
shakes and the message is announced again each time it changes. `busy` (while judging) makes
the field read-only and turns the buttons off.

### `RevealSheet`

`grade`, `mode`, `gradeLabel`, `pointsLabel?`, `sentence`, `rows`, `tableLabels`, `yours?`,
`nextLabel`, `onNext()`, `focusNext?` (default true)

Slides up in steps; at most the lower 46% of the screen. Band in the grade colour (the shot's
name and its points: `WORLDIE! +100`, `TAP IN +10`; leave `pointsLabel` out for a miss, a
pass or a time-up), the sentence (three lines at most, then it scrolls), the `yours` line
when given, a `LeagueTable` (with `inlinePlace`), the next button (focused on arrival).

`yours` (`RevealYours`, new): `{ you, name, picked?, shot, points, spoken }`. The player's own
answer when it is not one of `rows` (it did not score: a miss, a pass, a time-up): one line in
the miss colour under the sentence, set like a table row (`YOU Blackburn Rovers 2% MISS 0`;
leave `picked` out with no answer). It sits above the table on a phone and in the left column,
under the sentence, on a wide screen. Screen readers hear `spoken` once ("Your answer: Blackburn
Rovers, picked by 2%. MISS, 0 points."); the pieces are hidden from them. In the game it comes
from `yoursLine(reveal)` in `app/routes/play/Game.tsx`, undefined when the answer is a row.

### `LeagueTable`

`rows: LeagueEntry[]`, `labels: { caption, rank, answer, distance, shot?, points, you, gap }`,
`followYou?` (default true), `pinFirst?` (default true), `inlinePlace?` (default false), `ref?`

`LeagueEntry` is a `LeagueRow` `{ rank, name, place, distance, points, grade?, shot?, you?,
best?, id? }` or a gap marker `{ gap: true }`. The reveal's rows are `revealFor(...).rows` in
`~/game`: five, one for each shot that scores, with no gaps (the gap marker stays in the kit
but the reveal no longer uses it). Format `distance` with `formatShare` (or `formatDistance`
for the distance rules). Pass the rows best first.

- `inlinePlace` (new; the reveal sets it): the place follows the name on its line, in the
  place colour, and wraps after it only when it must, so a row is one line tall (as tall as
  its points box) unless a name is long. The YOU tag stands beside the rank (`6 YOU`), not
  under it, so the player's row is as tall as the others. Without it every row is two lines,
  name over place.
  That is what lets the reveal's five rows and the headings fit at 1366 x 768 and 390 x 844.

- With a `shot` heading in `labels` the table has a SHOT column, between the third column and
  the points: each row's `shot` (`"GOLAZO"`) as a tag in its `grade`'s colour, ink on colour,
  all tags one width. `grade` also goes on the row as `data-grade`.
- `best` (the gold row: gold name and rank, the points on a gold box) defaults to
  `grade === "worldie"`, or to `points === 100` for a row with no grade.

It scrolls inside whatever height it is given (never less than the headings and two rows). The
first row stays pinned under the headings; the player's row is brought into view with the row
above it, until the player scrolls the table themselves. The place is one line (ellipsis),
unless `inlinePlace`. A distance such as `"540 miles"` is split at its last space and stacked.

### `FullTimeCard`

`mode`, `heading`, `total`, `maxTotal`, `totalSpoken?`, `careerTitle`, `earnedTitle?`,
`earnedTitleSpoken?`, `perfectLine?`, `results: { grade, points, answer, label? }[]`,
`resultsLabel?`, `shareLabel`, `onShare()`, `otherLabel`, `otherMode`, `onPlayOther()`,
`menuLabel`, `onMenu()`

Heading and career tier (`careerTitle`), the score as a large LED (gold with `perfectLine`),
under it the title the total earned (`earnedTitle`, new 2026-11-11: big type, the mode's light
colour, one line at 20 characters on a monitor; `earnedTitleSpoken`, "Your title", is read out
before it), the seven answers (each with its lamp, and its shot's `label`, `"TRIVELA"`, in the
shot's colour beside the points; a worldie's answer and points are gold), three buttons. At most the lower 46%; the answers scroll when they do not fit (phones
shorter than about 670 CSS px).

### `MenuCaptions`

`modes: { mode, label, line, score?, scoreSpoken? }[]` (HOME then AWAY), `onSelect?(mode)`,
`onHover?(mode | null)`, `lit?`, `notice?`, `noticeKey?`, `stowed?`,
`howToPlay: { label, to?, onClick?, open? }`, `howToPlayRef?`, `dayLabel`, `sound?` (the sound
switch beside the "?": labels, default `strings.sound`, or `false`; see `SoundToggle`)

The "?" is a link with `to` and a button with `onClick`. With `open` (new 2026-11-12: the home
page's rules pop-up is up, or not) the button carries `aria-haspopup="dialog"` and
`aria-expanded`; `howToPlayRef` is the button, for `HowToPlay` to give the focus back to.

Two cards under the ball, the day, the "?" button and the sound switch. With `onSelect` the cards are buttons, so
the menu works without the canvas (keyboard, screen readers). `score` adds an amber points box.

| prop        | what it does                                                                                                                                                                                                                                        |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `onHover`   | Called with a mode while the mouse is over its card or the keyboard's focus is on it, and with `null` when neither is any more. Only on a change; the mouse wins over focus; a finger never hovers. The page lights that patch on the ball with it. |
| `lit`       | `"home"`, `"away"` or `null`: draw that card as if it were hovered (the pointer is over its patch on the ball).                                                                                                                                     |
| `notice`    | A short line on a plate with a yellow card, for example after a locked patch was pressed. It is a polite live region that is always in the page; `null` empties it. It lets the pointer through.                                                    |
| `noticeKey` | Change it to have the same words announced again (the text gets a fresh node).                                                                                                                                                                      |
| `stowed`    | The kick-off is on: the captions slide down off the screen (`useStowSlide`), are `inert`, and let go of any hover (`onHover(null)`). Coming back is instant.                                                                                        |

There are two layouts, from the same markup (ui.css section 15):

- **On a phone** (and anywhere that is not wide): two cards side by side in the column, the badge
  over the line, with the day and the "?" button stacked at their right. The notice is a plate
  across the column above the cards. Type in font pixels.
- **On a wide screen** (inside a `GameLayout` that is `data-wide`): one row across the foot of the
  picture, `[DAY 12] [ line HOME 478 ][ AWAY line ] [?]`, in **caption pixels** (`--fp` is swapped
  for `--cp` inside the block: capitals 20 CSS px on a 1920 x 1080 monitor, where the column's
  type is 10). The two cards are the same width and the gap between them is on the centre line of
  the screen and of the scene, to the device pixel, so HOME is under the HOME patch and AWAY
  under the AWAY patch. The badges meet in the middle, each line runs outwards from its badge on
  one line, a score sits beside its badge like the score in a result, and AWAY's stripe is on its
  outer edge. The day and the "?" button hang off the two ends of the row and are not part of its
  width. The notice stands **beside** the ball, not under it: its right edge is the ball's
  radius (16.5% of the height) and 6 logical pixels left of the centre line, so it is clear of
  the ball however high the ball floats, and its left edge is the left end of the cards, so it
  stands on the HOME card and never hangs past the row into the picture. The words wrap evenly
  to fit (three lines at 1920 x 1080 and 1366 x 768). Only where that leaves less than 96
  caption pixels does it reach further left.

Measured on the home page (not played, day 2; device pixels in brackets where they differ):

| screen             | caption capitals | each card  | whole row | row top to ball | covers |
| ------------------ | ---------------- | ---------- | --------- | --------------- | ------ |
| 1920 x 1080        | 20 CSS px        | 480 x 60   | 1146      | 18 logical px   | 6.7%   |
| 1440 x 900         | 20               | 466 x 51   | 1096      | 20              | 6.7%   |
| 1366 x 768         | 20               | 466 x 51   | 1096      | 15              | 7.8%   |
| 2560 x 1440        | 30               | 706 x 80   | 1668      | 19              | 6.6%   |
| 1536 x 864 at 125% | 16 (20)          | 384 x 48   | 917       | 18              | 6.7%   |
| 1280 x 720 at 150% | 13.3 (20)        | 310.7 x 46 | 743       | 23              | 7.2%   |

**The row and the picture's pixels.** The plates lie straight on the picture, so their edges
should fall on its pixel grid. The row is a whole number of logical pixels tall (13 caption
pixels and 8 logical pixels, or a touch target, rounded up: 15 logical pixels at 1920 x 1080) and
stands 2 logical pixels off the bottom, so its top and bottom edges are on the grid wherever the
screen is a whole number of logical pixels tall (every size in the table). A browser window
often is not (the tabs and the address bar take their share): there the canvas is cropped by
less than a logical pixel at the bottom and the row's edges are off the grid by that much (1
device pixel at 1536 x 730 at 125%, 2 at 1745 x 982 at 110%). Putting them on it would mean
standing the row on the canvas's bottom edge, which only the canvas's placement (section 19)
knows. The gap in the middle is on the grid too. The outer edges are where the words put them, in caption pixels: on the grid
at 1920 x 1080 and at 125% (but for the day plate's left edge, half a logical pixel off for
"DAY 2"), and one to four device pixels off it at 1440 x 900, 1366 x 768, 2560 x 1440 and 150%.
The words' widths come from the fonts' own metrics, so a card's free edge can be a 64th of a CSS
pixel short of the whole device pixel: it is painted on the whole one.

With both modes played and a three-digit day the row is 1298 px at 1366 x 768: it still fits, with
nothing to spare. Where a wide screen has no room for that (1280 x 1024, a tablet on its side)
the cards shrink and the longer line takes two lines; both cards stay the same height.

The wide row is laid out with CSS `order` and by position (the first card, the last card), so the
markup's order matters: the notice, the cards (HOME then AWAY), the day, the button; and in a
card the badge, the score, the line. Screen readers get that order on both layouts.

### `Leaderboard`

`boards: LeaderboardBoard[]` (HOME then AWAY), `labels: LeaderboardLabels`, `initialMode?`,
`stowed?`

- `LeaderboardBoard`: `{ mode, label, rows, you?, caption, played, youSpoken? }`. `rows` is the
  top of the table, best first (`LeaderboardEntry`: `{ rank, name, points, you?, id? }`; equal
  totals share a rank); `you` is the player's own row when it is not among `rows` (shown under
  them after a gap); `caption` names the table for screen readers ("Today's top 10, HOME");
  `played` is the line under it ("1,284 played today"); `youSpoken` is read out for the
  player's row in place of YOU ("You: 37th of 1,284").
- `LeaderboardLabels`: `heading`, `tabs` (the tab list's name), `rank`, `name`, `points` (the
  column headings), `you`, `gap`, `open` (the trophy button), `close` (the sheet's button),
  `toggle`, `hide`, `show` (the tab that slides the panel away on a monitor: its name and its
  two tooltips).
- Also exported: `TROPHY`, the 9 x 9 cup bitmap of the trophy button (a generic cup, not any
  real trophy); from `./Leaderboard` also `ARROW_RIGHT`, `ARROW_LEFT` and `LEADERBOARD_KEY`.

Today's top ten, a tab per mode (a real `tablist`: click, or the arrow keys, Home and End,
which move the focus and choose as they go). The table is the reveal's `LeagueTable` cut down
to three columns, in the same skin: a slate heading row, night rows with an ink line between
them, the leader gold (its points box too), the player's row a chalk plate with the rank as a
flag in the mode's colour. The player's row under the gap has a rank of up to four digits, so
there the flag and YOU share one cell: a long rank never takes width from the names above it.
A name that does not fit ends in an ellipsis (the mock's handles are at most 10 characters and
all fit). It must be inside a `GameLayout`; it reads the scale with `usePixelRootScale()`:

- **On a wide screen** it is an `aside` (named by its heading) in the bolted `Panel` frame,
  fixed on the right of the screen, in caption pixels like the row of captions (it swaps `--fp`
  for `--cp` and works its type out from that itself: ui.css section 20). It is 128 caption
  pixels and 14 logical pixels wide, 3 logical pixels from the right edge, and its top is level
  with the airship's sign (18% of the height) unless that would bring its bottom within 32
  logical pixels of the bottom of the screen, where the row of captions is (two lines tall when
  both modes are played at 1366 x 768): then it rises (its tallest is 223 caption pixels and 50
  logical pixels, outline included). Measured on the home page, day 2, both modes played
  (HOME 289th, under the gap):

  | screen             | panel box (x, y, w x h, CSS px) | gap above the captions |
  | ------------------ | ------------------------------- | ---------------------- |
  | 1920 x 1080        | 1596, 192, 312 x 634            | 186                    |
  | 1440 x 900         | 1133, 162, 298 x 587            | 69                     |
  | 1366 x 768         | 1059, 75, 298 x 587             | 24                     |
  | 2560 x 1440        | 2091, 255, 454 x 904            | 191                    |
  | 1536 x 864 at 125% | 1276.8, 153.6, 249.6 x 507.2    | 149                    |

  The bowl takes the middle 60% of a monitor's width and the panel a little under the 20%
  beside it: at 1920 x 1080 it is a few pixels clear of the stadium, at the other sizes its
  left edge meets the far tip of the stadium's east wall.

  **Sliding it away.** A tab hangs on the panel's left edge, level with the heading: a steel
  button `--tap` wide with the gold cup over a solid arrow pointing the way the panel will go
  (`ARROW_RIGHT` while it is out, `ARROW_LEFT` while it is away). A press slides the panel off
  the right of the screen by its width plus its gap (`--ss-lb-shift`), so only the tab is left,
  standing on the right edge; another press brings it back. The slide is a `Slider` (see the
  motion rule under "Rules the kit keeps"): 0.3 s, every frame, ease-out each way (it leaves
  quickly and settles gently, out to the edge and back into place), each frame's position on
  whole device pixels. A press halfway turns it round from where it is, at the speed it has. The
  classes hold the resting states (`is-collapsed`: `translateX(--ss-lb-shift)`; `is-stowed`:
  `translateX(--ss-lb-stow)`); while it slides, the slide's `translateX` is on the element's
  style and `data-sliding` keeps it visible, and both go when it comes to rest. The two lengths
  are registered with `@property` as `<length>`, so the script reads them in CSS px; where they
  cannot be read the panel simply moves. Under reduced motion it is instant. The tab is one
  button throughout, so the focus stays on it: named by `labels.toggle` ("Leaderboard"),
  `aria-expanded` (true while the panel is out), `aria-controls` the panel's content, and a
  tooltip of `labels.hide` or `labels.show`. While the panel is away its content is `inert` and
  hidden; the tab is not. The choice is kept in localStorage under `LEADERBOARD_KEY`
  (`soccersense:v1:leaderboard`, `"closed"` or nothing), read in a layout effect after mounting
  (before the first paint) and through `useSyncExternalStore`, never during a render: the
  build-time page and a first visit have it out, and a remembered choice is simply there from
  the first frame, with no slide. Stowed, the tab goes off with the panel. On a phone none of
  this exists: the trophy and the sheet below.

  Measured in Chrome (`tools/shoot.mjs`'s browser, the home page, a real press on the tab;
  every change of the slide's position logged with its frame): 17 frames each way at 16.5 to
  16.9 ms apart at 1920 x 1080 @1, 1366 x 768 @1 and 1536 x 864 @1.25, every position on whole
  device pixels (the panel's box times the ratio, to a thousandth); a press 120 ms in turns it
  round with no frame skipped. The first press after a page load used to start the sound
  engine (about 100 ms of script on the pointer down) and so made one frame late; the engine
  now gets ready in idle moments before any press (docs/AUDIO.md), and the first press's slide
  has no frame over 20 ms (16.8 ms at worst, measured in the dev build). The slide's clock
  still never moves on more than 1/30 s in a frame, so a late frame is a moment's wait.

- **Anywhere else** (a phone, an upright tablet, and the build-time page) it is a gold trophy
  button (`aria-haspopup="dialog"`), placed by ui.css at the bottom right of the column's middle
  slot: just above the "?" button, clear of the ball. It opens the table as a sheet: a modal
  `dialog` (named by the heading; `showModal`, so the focus stays inside, Escape closes it and
  the page behind is out of reach) standing on the bottom edge, the column's width, framed like
  the reveal sheet, with a close button beside the heading. It rises from below the screen
  (its height and 4 px) and goes back down before it closes: a `Slider`, 0.3 s, every frame,
  ease-out, on whole device pixels (at 390 x 844 @3 a third of a CSS px is a step: 16 or 17
  frames 16.5 to 16.8 ms apart, every position a whole device pixel). The picture stays in
  view above it (no scrim). Closing it, by the button, Escape (the dialog's `cancel` is turned
  into the same slide down) or a press outside it, puts the focus back on the trophy once it is
  gone. Under reduced motion it opens and closes at once.
- `stowed` (the kick-off): the panel slides off the right, the tab with it (the same slide), or
  the trophy slides down off the screen with the captions (`useStowSlide`: the same distance
  in the same frames) and an open sheet closes at once; both are `inert`.

The home page builds the boards from `leaderboardFor(day, mode, you)` in
`app/data/leaderboard.ts` (mock data; a backend replaces it behind the same signature:
`{ rows, total, yourRank }`, every player best first, the player among them as `you: true` and
counted in `total`), takes the top ten, and renders it once the day is known (never at build
time).

### `HowToPlay` and `HowToPlayCard`

(New 2026-11-12, at the product owner's request: "make how to play a pop up instead of new
page". Cut down the same day: "less wordy and more human readable. drop the useless text and
things that can be inferred", then "why even mention home and away especially since we are
going to add more game modes". The modes are not on it: each mode's rule is on the home
screen's caption row and on the game's board.)

`HowToPlayCard`: `labels: HowToPlayLabels`, `shots`, `tiers`, `headingLevel?` (2, or 1 on a
page of its own), `headingRef?` (for `useArrivalFocus`), `action?` (beside the heading)

`HowToPlay`: the card's `labels`, `shots`, `tiers`, and `open`, `onClose()`, `returnFocus?` (a
ref: where the focus goes on closing)

- `HowToPlayLabels`: `heading` ("HOW TO PLAY", also the dialog's name), `close`, `intro` (the
  one line under the heading, "7 questions a day. 30 seconds each.", read out as the dialog's
  description), `shots` ("POINTS") and `career` ("YOUR CAREER"), the two section headings, and
  two functions read out by screen readers: `points(n)` ("100 points") and `step(tier, from)`
  ("SUNDAY LEAGUE, from 90 points").
- `shots`: `HowToPlayShot[]`, `{ grade, label, points }`, the six shots best first.
- `tiers`: `HowToPlayTier[]`, `{ name, from }`, the career from the park up.

The home page and `/how-to-play` build all of it the same way, from `strings.howToPlay`,
`strings.play.shots`, `strings.play.tiers`, `SHOT_ORDER`, `SHOT_POINTS` and `TIERS`
(`howToPlayContent()` in `app/routes/how-to-play-card.ts`): change the words in `app/i18n/en.ts`.

**The card** is the rules on one bolted panel (the board's frame, night plate, steel edge, four
bolts): the heading in Jersey 20 with the close button at the far end; the one line on the day;
**POINTS**, the six shots as tags in their grade colours (ink on colour, like the reveal's
table) with their points, best first, no sentence; **YOUR CAREER**, a ladder of eight steps,
each two logical pixels higher than the last and the top one gold, named PARK KICKABOUT and
WORLD CUP WINNER at its ends (each step read out by name and points), no sentence. Nothing else.
Section headings are Jersey 15 in amber. A tag and its points are clipped to their line (the
face's box reaches below a tight line, and would otherwise make the body scroll by a pixel or
two). ui.css section 22.

- **On a wide screen** (`data-wide`, `isWide` of the nearest `PixelRoot`) it is set in caption
  pixels (`--fp` swapped for `--cp`, its type worked out from that in its own rules, like the
  leaderboard's): the line across the top, and under it POINTS on the left (two columns of
  three: WORLDIE, GOLAZO, TRIVELA down the first, TOE POKE, TAP IN, MISS down the second) and
  YOUR CAREER on the right, the two about the same height. It is 440 caption pixels and 10
  logical pixels wide (a whole number of logical pixels, never wider than the screen less 8
  logical pixels a side), as tall as its content, and it is placed on a whole device pixel
  across.
- **Anywhere else** it is one column: the line, the six shots (two columns of three, as on a
  monitor), the career.

**The dialog** is a modal `dialog` (`showModal`) over the whole screen, holding the card (on a
phone, a sheet on the bottom edge):

| screen             | card (x, y, w x h, CSS px) | what is round it                        |
| ------------------ | -------------------------- | --------------------------------------- |
| 1920 x 1080        | 500, 366, 920 x 348        | a dither of ink over the picture        |
| 1366 x 768         | 228, 228, 909 x 312        | the same                                |
| 1536 x 864 at 125% | 400, 292.8, 736 x 278.4    | the same (all on whole device pixels)   |
| 390 x 844 at 3     | 0, 518, 390 x 326          | the picture: a sheet on the bottom edge |
| 360 x 640 at 3     | 0, 365, 360 x 275          | the same                                |

- On a monitor the picture behind is dimmed by a dither of ink, every other logical pixel (an
  SVG pattern drawn in logical pixels from the top left corner, so it is crisp at any ratio and
  nothing fades). On a phone the card is a sheet standing on the bottom edge (changed on
  2026-11-12: it was the whole screen, half of it empty plate once the copy was cut), the
  column's width and as tall as its content, clear of the home indicator, like the
  leaderboard's sheet; the picture stays in view above it and a press there closes it. Its
  body scrolls if it has to (it then takes the focus by Tab, so a keyboard can scroll it).
- **In and out.** The card rises from below the screen and comes to rest in 0.26 s, slowing as
  it arrives, and drops away the same way in 0.2 s, speeding up. Every frame, on a whole device
  pixel: the animation moves a registered number (`--ss-help-t`, 1 to 0) and the offset is
  `round(down, t * 100dvh, --snap)`, so it is smooth and never between pixels (sampled in
  Chrome frame by frame at 1920 x 1080, 1536 x 864 at 125% and 390 x 844 at 3). The card waits
  below the screen until the dialog's first frame has been drawn, so a long first frame does not
  eat the start of the rise. Under reduced motion there is no movement: it is there, and gone.
  On a phone the sheet rises from just below the screen and drops back with a `Slider`
  (`./slide`, 0.3 s, ease-out, every frame on whole device pixels, like the leaderboard's
  sheet), and `onClose()` is called once it is gone (sampled at 390 x 844 and 360 x 640 at 3:
  17 or 18 frames 16.5 to 16.8 ms apart each way, every position a whole device pixel).
- **Closing**: the close button, Escape and a press outside the card (one that starts and ends
  outside it: a drag that starts on the card is not one). The dialog plays its way out, then
  calls `onClose()`; set `open` to false then. Escape is caught before the browser's own close
  request, and if a browser closes the dialog itself anyway, `onClose()` is called at once.
- **Focus**: on opening it goes to the close button; Tab and Shift+Tab go round inside the
  dialog and never out of it; on closing it goes back to `returnFocus` (the "?"), or to what had
  it when the dialog opened.
- **Behind it**: the rest of the page is inert (a modal dialog), so no pointer reaches the canvas
  (no spinning the ball through it), and the page does not scroll (`html` has `overflow:
hidden` while one is open). The click sound is the usual one, from the delegated listener in
  `~/audio`. Like the leaderboard's sheet it is in the browser's top layer; the click burst is
  drawn inside it, so it shows on top (`ClickBurst`).
- It renders nothing while `open` is false, and nothing at build time.

```tsx
const [help, setHelp] = useState(false);
const helpButton = useRef<HTMLButtonElement | null>(null);
<MenuCaptions
  howToPlay={{ label, onClick: () => setHelp(true), open: help }}
  howToPlayRef={helpButton}
  {...rest}
/>;
<HowToPlay
  {...howToPlayContent()}
  open={help}
  onClose={() => setHelp(false)}
  returnFocus={helpButton}
/>;
```

### `ClickBurst`

No props. Mounted once, in `Layout` in `app/root.tsx`, so every page has it.

Every press of the main mouse button and every tap, anywhere, makes a small pixel burst at the
pointer: a chalk plus where it landed, then eight gold sparks flying out and cooling from pale
gold to gold to dark gold, each frame with a hard ink shadow a pixel down and right. Four
frames of `BURST_FRAME_MS` (60 ms), about a quarter second, then it is removed. The frames
(`BURST_FRAMES`, 17 x 17 bitmaps, symmetrical about the point) are drawn with `PixelGlyph` in
logical pixels of the current scale (`usePixelScale`, the layer sets the units itself as it
sits outside any `PixelRoot`), and the point is put on a whole device pixel, so it is crisp at
any ratio. Each frame is shown only while its own animation runs (`ss-burst-frame`, no fill).

It listens on the window in the capture phase (`pointerdown`, passive), so it hears presses
that something below stops; the layer is `position: fixed`, `pointer-events: none`,
`aria-hidden`, and never takes a press. At most `MAX_BURSTS` (4) at once: a fifth replaces the
oldest. A right click and a second finger make none. Nothing is rendered at build time or
before the first press, and nothing under reduced motion (checked at each press, and the layer
is `display: none` there too). A modal `dialog` (the how-to-play pop-up, the leaderboard's sheet
on a phone) is in the browser's top layer, above everything else whatever its z-index, so while
one is open the layer is drawn inside the one on top (a portal) and the burst shows over it.

### `SoundToggle`

`labels: { label, on, off }` (`strings.sound`), `className?`

The sound switch: a square steel icon button with a 9 x 9 pixel speaker, two waves when the
sound is on (`SPEAKER_ON`) and crossed out when it is off (`SPEAKER_OFF`). It is a real switch
for screen readers (`role="switch"`, named "Sound", `aria-checked`), with "Sound on" or "Sound
off" in its tooltip, and works from the keyboard like any button. `data-muted` is set while the
sound is off.

The choice is remembered in `localStorage` (`soccersense:v1:sound`) through `~/audio`. The
build-time HTML and the first render show it on; it follows the storage once the page runs, and
another tab's change too. Turning the sound on is a user gesture, so the engine may start its
audio there and then.

There is only ever one on a screen, beside the how-to-play "?" where there is one:

- **Home**: `MenuCaptions` puts it right after the "?" (its `sound` prop: the labels, default
  `strings.sound`, or `false` for none; the side carries `data-sound`). On a phone the day plate
  sits over the "?" and the speaker, side by side at the right of the cards. On a monitor it is
  a square as tall as the caption row, off the row's right end after the "?"; where the screen
  ends too soon for that (a small phone on its side, with the leaderboard filling the column
  above the "?"), it stands on the day plate at the row's other end instead.
- **The game**: `Board` puts it in its head, after the mode badge (its `sound` prop, the same).
- **Anywhere else**: `GameLayout`'s `sound` prop (`true` for `strings.sound`, or the labels;
  off by default) puts one in the top right corner of the column's middle slot, the free space
  between the board and the bar, sheet or card. Use it only on a screen with neither captions
  nor a board: the game page passes it at full time, where the board has gone.

Checked with real Chrome at 1920 x 1080, 2560 x 1440, 1536 x 864 at 125%, 1440 x 900,
1366 x 768, 1280 x 720 and 800, 1180 x 820, 1024 x 768, 768 x 1024, 844 x 390, 740 x 360 and
phones from 390 x 844 down to 320 x 568: inside the screen and clear of the cards, the day, the
"?", the leaderboard, the badge and the score at every size. Its styles are section 21 of
`ui.css` (`.ss-sound`).

Every press of a button anywhere also plays the engine's `click` (see `docs/AUDIO.md`): the
switch included, so switching the sound on is heard.

### Parts

| component    | props                                                                              | note                                                                                                   |
| ------------ | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `Button`     | `children`, `variant?`, `mode?`, `full?`, `to?`, `forceState?`, any `button` props | `primary` gold, `mode` (needs `mode`), `secondary` steel (default), `ghost`. `to` renders a link.      |
| `IconButton` | `icon`, `label`, `variant?`, `mode?`, `to?`, `forceState?`, any `button` props     | Square, at least 44 px. `icon`: `question`, `back`, `share`, `close`. `label` is the accessible name.  |
| `ModeBadge`  | `mode`, `label`                                                                    | The HOME or AWAY plate.                                                                                |
| `Panel`      | `as?`, `variant?` (`frame`, `plain`), `noBolts?`, any `div` props                  | The bolted scoreboard frame, or a flat dark plate.                                                     |
| `LedNumber`  | `value`, `digits?`, `size?` (`sm`, `lg`), `tone?`, `bare?`, `label?`               | Dot matrix. `sm` digits are 19 x 27 fp, `lg` 29 x 41. Tones: `amber`, `red`, `green`, `gold`, `chalk`. |
| `Pips`       | `results`, `current?`, `label?`                                                    | The row of result lamps; `current` (an index) blinks.                                                  |
| `Pip`        | `grade`, `state?` (`done`, `current`, `todo`)                                      | One lamp.                                                                                              |
| `TierBar`    | `name`, `progress` (0 to 1)                                                        | Career bar. The name is always whole: ink on the gold fill, gold on the track.                         |
| `TimerStrip` | `secondsLeft`, `secondsTotal`, `dangerAt?` (5), `hideSeconds?`, `label?`           | One segment per second and LED seconds; red and blinking from `dangerAt`.                              |
| `PixelGlyph` | `bitmap`, `layers?`, `cell?`, `gap?`, `unit?` (`px`, `fp`), `label?`               | Pixel art from a bitmap of characters. A `gap` makes it a dot matrix.                                  |

`LedNumber` accepts digits, `/ + - :` and spaces. `digits` pads on the left with unlit cells.
`label=""` hides it from screen readers (when the number is already named elsewhere). `bare`
drops the black window.

`forceState` (`pressed`, `focus`) only exists to draw a state in the gallery.

Also exported: `ICONS`, `bitmapPath`, `bitmapSize`, `pixelScale`, `DEFAULT_SCALE`,
`COLUMN_LOGICAL_WIDTH`, `PixelScaleContext`, `usePixelScale`, `usePixelRootScale`, `deviceToCss`,
`pixelVariables`, `isWide`, `WIDE_ROW_PX`, `WIDE_ROW_CP`, `noticeDevicePixelRatio`,
`useArrivalFocus`, `fetchHeadingFaces`, `HEADING_FACES`, and the prop types of everything above.

## The canvas host

### `PixelStage`

`scene` (`Scene | null`), `light` (`Lighting | null`), `paused?`, `timeScale?` (default 1),
`className?`

It goes in `GameLayout`'s `canvas` slot, fills it, and drives one `Scene` (the contract is
`app/scenes/scene.ts`). It owns the frame loop, the framebuffer and the pointer mapping. Nothing
runs while `scene` or `light` is `null`: with no scene the canvas is plain ink.

```tsx
const sky = useDeviceSky(); // null at build time and on the first render
const [scene] = useState(() => new MenuScene());
<GameLayout canvas={<PixelStage scene={scene} light={sky?.light ?? null} />} />;
```

**One frame**, always in this order: `resize(w, h)` if the logical size changed, `setLighting` if
the light changed, `setReducedMotion` if that changed, `update(dt)`, `draw(surface)`, then the
surface goes to the canvas. A scene that is new to the stage gets the first three before its
first `update`, and that first `update` has `dt` 0.

- `dt` is the real time since the last frame in seconds, never more than 0.1, times
  `timeScale`. The first frame after any start or resume has `dt` 0.
- A frame that told the scene something new (its first frame, a new size, a new light) and
  itself took 34 ms or more is the scene building its picture (40 to 180 ms for the home
  screen). The next `dt` is measured from the end of that frame, so the animation does not jump
  a tenth of a second over it: an entrance that starts in the first frame is seen from its
  first step. Any other frame is counted in full however long it took: on a slow device that
  is the animation's real time, and not counting it would put the whole menu in slow motion.
- The loop runs on `requestAnimationFrame`. It stops while the document is hidden, while
  `paused` is true and while `scene` or `light` is `null`. There is never more than one loop,
  strict mode included.
- While the loop is `paused`, a change of scene, light, size or reduced motion still paints one
  frame with `dt` 0, so what is on screen is never out of date. That is also why a stage that
  is `paused` from the start shows a still frame and not an empty canvas.
- While the document is hidden **nothing is painted**, whatever changes: nobody is looking, and
  a new light costs the scene tens of milliseconds. What changed is painted when the document
  is shown again: by the loop's first frame, or at once if the stage is `paused`.
- Reduced motion is the `(prefers-reduced-motion: reduce)` media query, followed live.
- If the scene throws in the loop, the loop stops (one error, not sixty a second). Hiding and
  showing the tab, or a new `paused` value, starts it again. If it throws in one of the
  repaints outside the loop (they run inside React's commit, where an error would unmount the
  page up to the error page), the error is reported with `reportError` and the page stands.
- With no 2D context (the test environment) nothing runs and nothing throws.

**The canvas.** Its backing store is exactly `logicalW` x `logicalH` (from
`usePixelRootScale()`), and it is shown at exactly `dp` device pixels per logical pixel, scaled
with `image-rendering: pixelated`: its CSS size is `logicalW * dp / dpr` by `logicalH * dp / dpr`,
which is a fraction of a CSS pixel at a fractional ratio (640 x 361 logical at 110% is
`1745.45455px` by `984.54546px`, and exactly 1920 x 1083 device pixels). The surface is wrapped
in one `ImageData` per size (the same memory, no copy) and sent with one `putImageData`. The
canvas is `aria-hidden`, cannot take focus, and has `touch-action: manipulation`.

The logical size is rounded up, so the canvas is less than one logical pixel larger than the
screen each way. It is centred on the slot at a whole pixel (`--snap`: a CSS pixel, or whole
device pixels where those differ) and the slot crops the extra. An odd pixel left over is
cropped on the left and the top (ui.css section 19):

| viewport           | dp  | canvas (logical) | canvas (device px) | cropped, device px: left, right, top, bottom |
| ------------------ | --- | ---------------- | ------------------ | -------------------------------------------- |
| 390 x 844 at 2     | 6   | 130 x 282        | 780 x 1692         | 0, 0, 2, 2                                   |
| 360 x 740 at 3     | 9   | 120 x 247        | 1080 x 2223        | 0, 0, 3, 0                                   |
| 1366 x 768         | 3   | 456 x 256        | 1368 x 768         | 1, 1, 0, 0                                   |
| 1440 x 900         | 3   | 480 x 300        | 1440 x 900         | none                                         |
| 1536 x 864 at 125% | 4   | 480 x 270        | 1920 x 1080        | none                                         |
| 1707 x 960 at 150% | 5   | 513 x 288        | 2565 x 1440        | 2, 2, 0, 0                                   |
| 1745 x 982 at 110% | 3   | 640 x 361        | 1920 x 1083        | 0, 0, 1, 2                                   |

So the line down the middle of the scene (`w / 2`) is the middle of the screen, or half a pixel
left of it. The interface column and the wide menu row are centred with the same rounding, so
the centre lines are never more than half a pixel apart. **Place things in a scene from its
centre, not from a column edge worked out in logical pixels.** The column's edges only fall on
the canvas's pixel grid when the column is a whole number of logical pixels wide and as odd or
even as `logicalW`. They do at 390 x 844 and 820 x 1180. At 1440 x 900 the column starts at
logical 172.33, at 1920 x 1080 and 768 x 1024 on a half pixel, and at `px` 2 the column is 202.5
logical pixels wide. Browsers without CSS `round()` put the canvas at 0, 0 and crop it on the
right and the bottom.

**Every logical pixel is the same whole block of device pixels at any ratio.** Checked device
pixel by device pixel in Chrome on the test card (the 1 px checkerboard: 576 identical squares of
`dp` x `dp`, exactly two colours) at 1920 x 1080, 1440 x 900, 1366 x 768 and 2560 x 1440 at 1;
1536 x 864 at 1.25; 1280 x 720 and 1707 x 960 at 1.5; 1097 x 617 at 1.75; 1745 x 982 at 1.1;
2133 x 1200 at 0.9; and the phones 390 x 844 at 2 and 3, 360 x 740 at 3, 375 x 667, 320 x 568
and 768 x 1024 at 2. The DOM was checked on the same card: its two checkerboards (a cell of
`--px`, a cell of `--fp`) are exact, every box is on a whole device pixel, and each Jersey face,
thresholded, is glyph for glyph the face at a whole ratio with the same device font pixel.

Two things to know when checking this yourself:

- A fractional ratio has to be the browser's own (`--force-device-scale-factor`, which is what
  `tools/shoot.mjs` does for `@1.25`): that is how Windows scaling and browser zoom arrive, and
  Chrome then lays the page out in device pixels. A fractional ratio **emulated** by DevTools is
  laid out in CSS pixels to a 64th, lands nothing on a device pixel, and shows logical pixels of
  3 and 4 device pixels however the page is written. Safari lays out in CSS pixels too.
- Type is never two colours on Windows. Every vertical edge of a glyph gets a one-device-pixel
  fringe from the system's text rendering, at any ratio, 100% included (coloured where Chrome
  can use LCD anti-aliasing, grey over the canvas). So type is judged by comparing glyphs, not
  by counting colours. And text is drawn where it is put, to a quarter of a pixel: centre a line
  with `text-align: center` or a flex box and an odd number of pixels to spare puts it on a
  half pixel, which is drawn soft. The kit does that in a few places (button labels, the day
  plate on a phone); the wide menu row avoids it.

**The pointer.** `pointermove`, `pointerdown` and `pointerup` are forwarded to `scene.pointer`
as `move`, `down` and `up`, and `pointerleave` and `pointercancel` both as `leave`, in logical
pixels with fractions (`Math.floor` gives the pixel under the pointer). `touch` is true for
anything that is not a mouse.

- Only the primary pointer is forwarded (a second finger is ignored), and for a mouse only the
  main button presses.
- `down` captures the pointer, so `up` arrives even when the pointer has slid off the canvas or
  over the interface. A capture that fails is ignored.
- After every pointer event the canvas's cursor is set from `scene.cursor()` if there is one.
- A scene hears no pointer before its first frame (it has no size yet).
- A tap arrives as `down`, `up`, `leave`. Because of `touch-action: manipulation`, a finger that
  is dragged more than a few pixels is taken by the browser as a pan and the scene gets `leave`.
  That suits buttons. A scene that needs drags from a finger needs `touch-action: none` on its
  canvas (pass a `className` and set it on `.that-class canvas`).

**Sound.** When the stage is given a scene it connects it to the page's one sound engine
(`soundEngine()` from `~/audio`, made on first use in the browser): it sets `scene.onSound`, so
the scene's cues are played, and asks for `scene.ambience()` straight away and then once a
second (the engine crossfades a change). When the scene changes or the stage unmounts, it sets
`onSound` back to null, stops asking and lets the bed fade out. The engine stays quiet before
the first gesture, while the sound is off and while the tab is hidden; reduced motion does not
mute. Without Web Audio (or at build time) nothing is connected and the stage runs as before.
See `docs/AUDIO.md`.

**Cost.** Everything the host does in a frame apart from the scene's own `update` and `draw`
takes about 0.13 ms at 480 x 270 and 0.4 ms at worst, against a budget of 1 ms (measured in
Chrome with `/dev/stage?bench=1` at 1920 x 1080). With the menu scene a whole frame of the home
page is 1.4 to 2.5 ms on average, at 60 frames a second with none dropped; the figures are in
`docs/API_SCENES.md`. Nothing runs after the page is left: no frames, no timers, no listeners
(counted across ten visits, strict mode on).

### `useDeviceSky`

`useDeviceSky(): DeviceSky | null`, where `DeviceSky` is
`{ sun: Sun; light: Lighting; moonPhase: number }`.

The player's own sky. `null` at build time and on the first render. After mounting it works out
the sun for where the device's time zone says it is (`sunForDevice` in `~/lib/where`, no
permission prompt), the light for that sun (`lightingFor`) and the moon's phase (`moonPhase` in
`~/lib/sun`, rounded to a hundredth). `light` goes to `PixelStage`. `sun` is `light.sun`, with the
elevation in half degrees.

- It refreshes every minute while the tab is in view, and when the tab becomes visible again.
  A hidden tab works nothing out (a new light makes the page paint).
- It returns the same object while nothing has changed (the light changes once per half degree
  of sun, every two minutes or so at the fastest), so it is safe as an effect dependency.
- `?time=HH:MM` in the address pins the clock to that time today (`parseTimeOverride`), to look
  at dusk at lunchtime. Anything that is not a time is ignored.

### `useArrivalFocus`

`useArrivalFocus<T extends HTMLElement>(): RefObject<T | null>`

Focus for a page that the router swapped in. A browser that loads a page starts the keyboard and
a screen reader at its top; a page arrived at inside the same document gets nothing (the focus is
left on `body`, and a screen reader says nothing). Give the ref to the page's main heading, with
`tabIndex={-1}`:

```tsx
const heading = useArrivalFocus<HTMLHeadingElement>();
<h1 ref={heading} tabIndex={-1} className="ss-t20">
  ...
</h1>;
```

- The page the browser loaded is left alone. Every page arrived at after that gives its heading
  the focus, once, when it mounts: a screen reader reads the heading, and the next Tab goes to
  the first control after it.
- It does not scroll, and the heading shows no ring (`[tabindex="-1"]:focus` inside `ss-root` or
  `ss-page` has no outline: a heading is not a control).
- One call per page, in the page's own component. The home page, the mode pages and the rules
  page use it.

### `fetchHeadingFaces`

`fetchHeadingFaces(): void`, with `HEADING_FACES` (`['1em "Jersey 20"']`).

A browser fetches a face the first time something on screen is set in it. The home screen sets
nothing in Jersey 20, so the first page after it (a mode page, the rules) showed its `ss-t20`
heading in `ui-monospace` for a moment and then swapped it. This asks for the face ahead of
time. Browser only (an effect or a handler); free to call again; it does nothing where there is
no font loading API and never throws. The home page calls it 1.5 s after the menu is up, or at
once when a mode is pointed at, focused or chosen.

### The stage test card: `/dev/stage`

`app/routes/dev-stage.tsx`: a `GameLayout` with a `PixelStage` running a small test scene. Like
`/dev/ui` it is a development aid and asks not to be indexed. What is on it, and what it proves:

| on the card                                                  | proves                                                                                             |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| the sky, the grass, two rows of swatches (`env` over `lit`)  | the light arrives and changes with `?time`                                                         |
| a 1 px checkerboard, hairlines, a diagonal, a dot grid       | one logical pixel is one hard-edged block                                                          |
| an amber frame on the surface's outer edge                   | how much of the canvas is cropped, on each side                                                    |
| a red cross on column `floor(w / 2)` and row `floor(h / 2)`  | where the middle of the scene is on the screen                                                     |
| a marker under the pointer: a cross, or a square while held  | pointer mapping (the white pixel is the one hit)                                                   |
| `W x H PX n`, `T` seconds, `F` frames, the phase and the sun | the scale, the loop, pausing and `timeScale`                                                       |
| `LIGHTS`, `REDUCED`, `PTR x,y TYPE [HELD] [TOUCH]`           | lights on, reduced motion, the last pointer event                                                  |
| `DPR r DP n FP n CP n`                                       | the device: its ratio, and how many DEVICE pixels a logical, a font and a caption pixel are        |
| in the DOM plate: two 8 x 8 checkerboards and the four faces | the DOM is on the device grid too: a cell of `--px`, a cell of `--fp`, each face on its font pixel |

`PX` is in CSS pixels, so at 125% the card reads `480X270 PX 3.2` and `DPR 1.25 DP 4 FP 1 CP 2`.
The parts of the plate carry `data-proof` (`px`, `fp`, `t10`, `t15`, `t20`, `t25`) for scripts
that measure them. The cursor is a hand over the checkerboard (`scene.cursor()`).

| query         | meaning                                                                       |
| ------------- | ----------------------------------------------------------------------------- |
| `?time=HH:MM` | pin the clock (`useDeviceSky`): `12:00` is day, `23:00` is night              |
| `?pause=1`    | `paused`: one still frame, `T 0.00`                                           |
| `?speed=<n>`  | `timeScale`: `4` is fast forward, `0.25` slow motion                          |
| `?bench=1`    | adds `HOST <mean> MAX <worst> SCENE <mean> MS`: the host's own cost per frame |

```sh
node tools/shoot.mjs "http://localhost:5173/dev/stage?time=12:00" ".snaps/stage-{w}x{h}@{dpr}.png" \
  --sizes 390x844@2,390x844@3,360x740@3,320x568@2,768x1024@2,1440x900@1,1920x1080@1,1536x864@1.25 --strict
node tools/shoot.mjs "http://localhost:5173/dev/stage?time=23:00" .snaps/stage-ptr.png --move 386,300
# The checkerboard alone at 125%, every device pixel enlarged 8 times: it must report 2 colours.
# (24 logical pixels at (6, round(H * 0.3) + 6): at 480 x 270 and 3.2 CSS px that is this clip.)
node tools/shoot.mjs "http://localhost:5173/dev/stage?time=12:00&pause=1" .snaps/checker.png \
  --sizes 1536x864@1.25 --clip 19.2,278.4,76.8,76.8 --zoom 8 --colors
```

## Rules the kit keeps (keep them when adding to it)

- Square corners, borders and shadows in whole `--px`, no gradients, blur or fades. Reduced
  motion turns every animation off.
- Motion. A thing that slides (a panel, a sheet) moves every frame, eased, and stays crisp:
  each frame's position is rounded to whole device pixels
  (`Math.round(x * devicePixelRatio) / devicePixelRatio`) before it is shown. Use `createSlider`
  from `app/ui/slide.ts`: it runs on `requestAnimationFrame`, `SLIDE_MS` (0.3 s), an ease-out
  cubic from rest (it leaves quickly and settles gently; the way back is the same curve the
  other way), and `to()` while it is moving turns it round from where it is at the speed it has
  (a cubic from that position and speed to rest, so there is no jolt; never towards the target
  faster than a fresh slide, so it never passes it). Its clock starts one frame in on its first
  frame and never moves on more than `MAX_STEP_MS` (1/30 s) in a frame: a late frame is a
  moment's wait, not a jump. Keep the resting states in classes and put only the moving
  position on the element's style, cleared when it comes to rest; check
  `prefersReducedMotion()` at each start and simply move there when it is true. A CSS
  transition or an unstepped keyframe animation cannot do this: the browser places its frames
  between pixels. Things that change in a beat rather than travel (the click burst's frames)
  use `steps()`. The reveal sheet's rise still travels in `steps()`. The kick-off's captions and
  the phone's trophy slide with `useStowSlide(ref, stowed)` (`app/ui/useStowSlide.ts`): every
  element marked `data-stow` goes the same distance, just enough to take the highest of them off
  the bottom of the screen, so they leave together.
- No animation fills `forwards` or `both`. One that goes on filling after it has ended keeps its
  element in a compositing layer of its own for as long as it is on screen, and in such a layer
  text with no background of its own is drawn without sub-pixel anti-aliasing (the reveal
  sheet's sentence was, for that reason). End on the element's own state and fill `backwards`.
  A test reads the stylesheet for it.
- Text contrast is at least 4.5 to 1 (the closest: a disabled label, 4.6; ink on HOME red, 4.7;
  chalk on a steel button, 4.9). Touch targets are at least 44 CSS px. Focus is an amber ring
  with an ink halo.
- Whole device pixels. No bare CSS lengths: sizes are multiples of `--px`, `--fp` or `--cp`, and
  what must be rounded is rounded to `--snap` with `--nudge` (see Units). A `--px` thing and an
  `--fp` thing are never centred against each other with a flex box: either their sizes differ by
  an even amount at every scale, or the offset is rounded with CSS `round()`. Widths shared
  between siblings are rounded the same way.
- Do not centre text with `text-align: center` or a flex box unless the space left over is even
  at every scale: text that starts on half a pixel is drawn soft. Anchor it to a side at a whole
  offset. (Older parts of the kit still centre: button labels, the day plate on a phone.)
- Nothing reads `window` during render. The scale comes from `useSyncExternalStore`, so the
  build-time HTML and the first client render agree (no hydration warnings). The device pixel
  ratio is unknown at build time and is 1 there.

## The gallery: `/dev/ui`

`app/routes/dev-ui.tsx`. Without a query it shows every composition in a phone-sized frame and
then the loose parts. `?only=<name>` shows one composition exactly as the game would:

| names                                                                                                                  | what                                                     |
| ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `ask-home`, `ask-away`                                                                                                 | asking                                                   |
| `ask-reject`, `ask-pass`, `ask-reject-pass`                                                                            | a rejected answer, PASS available, both                  |
| `ask-last5`                                                                                                            | the last five seconds                                    |
| `ask-long`                                                                                                             | the longest strings the layout has to survive            |
| `reveal-` and a grade: `worldie`, `golazo`, `trivela`, `toepoke`, `tapin`, `miss`, `timeup`, `skipped`, the best first | the reveal for each grade, over the compact board        |
| `fulltime`, `fulltime-perfect`                                                                                         | full time                                                |
| `menu`, `menu-played`, `menu-notice`                                                                                   | menu captions: fresh, HOME played, a notice and AWAY lit |
| `help`                                                                                                                 | how to play: the pop-up over the menu captions           |
| `parts`                                                                                                                | every part on its own, in every state (a long page)      |

The backdrop is a flat stand-in. The text is sample content, not game copy. The menu
compositions show the phone layout at a phone's size and the wide row at a monitor's
(`?only=menu-notice` at 1920 x 1080: the square is where the ball is, and the notice must stand
clear of it). In the overview's phone-sized frames they are always the phone layout. `help` uses
the game's own words; full-screen it is the real modal dialog (close it, and the "?" opens it
again), and in the overview's frames, where a modal dialog would take over the whole gallery,
it is the card alone.

## Screenshots: `tools/shoot.mjs`

It drives the installed Chrome (or Edge) through `playwright-core`. Start the dev server first
(`./node_modules/.bin/react-router dev --port 5173`), then:

```sh
# one shot (defaults: 390 x 844, dpr 2)
node tools/shoot.mjs "http://localhost:5173/dev/ui?only=ask-home" .snaps/ui-ask-home-390.png

# many shots with one browser: {name}, {w}, {h} and {dpr} are filled in
node tools/shoot.mjs "http://localhost:5173/dev/ui?only={name}" ".snaps/ui-{name}-{w}.png" \
  --names ask-home,reveal-goal,fulltime \
  --sizes 390x844@2,360x740@3,375x667@2,320x568@2,768x1024@2,1440x900@1
```

| option                  | meaning                                                                                  |
| ----------------------- | ---------------------------------------------------------------------------------------- |
| `--w --h --dpr`         | viewport in CSS px and the device pixel ratio                                            |
| `--sizes WxH[@dpr],...` | one shot per size (instead of the three above)                                           |
| `--names a,b,...`       | one shot per name                                                                        |
| `--full`                | the whole page, not only the viewport (`parts`)                                          |
| `--clip x,y,w,h`        | only that rectangle, in CSS px (fractions allowed: 19.2 at 125% is 24 device px)         |
| `--zoom <n>`            | enlarge the finished shot `n` times with hard edges, to look at device pixels (PNG only) |
| `--colors`              | report on stderr how many different colours the shot has: 2 for a crisp clip             |
| `--emulate`             | emulate a fractional ratio instead of starting the browser at it (see below)             |
| `--eval "<js>"`         | run in the page before the shot (focus a field, click, set a style)                      |
| `--init "<js>"`         | run in the page before any of its own scripts, on every load (a saved game in storage)   |
| `--wait <ms>`           | settle time before the shot (default 400)                                                |
| `--reduce`, `--touch`   | reduced motion; mobile and touch emulation                                               |
| `--timeout <ms>`        | navigation timeout (default 30000)                                                       |
| `--strict`              | exit with code 1 if any page reported a problem                                          |

**Device pixel ratios.** A whole ratio (1, 2, 3) is emulated, as DevTools does it. A fractional
one (`@1.25`, `@1.5`, `@1.1`: Windows display scaling, browser zoom) is given to the browser
itself with `--force-device-scale-factor`, one browser per ratio, because that is how a real
display reaches Chrome and only then is the page laid out in device pixels. An emulated
fractional ratio is laid out in CSS pixels to a 64th: nothing lands on a whole device pixel in
it, whatever the page does. `--emulate` asks for that all the same. A higher `--dpr` is no longer
a way to zoom into a clip, because the page lays itself out for the ratio: use `--zoom`.

Real input before the shot, made with the browser's own mouse, keyboard and touch screen, so the
page gets trusted events at real coordinates. These run in the order given, after the `--wait`
settle time, and each can be repeated:

| option                | meaning                                                         |
| --------------------- | --------------------------------------------------------------- |
| `--move x,y`          | move the mouse there (CSS px from the viewport's corner)        |
| `--click x,y`         | move there, press and release                                   |
| `--down x,y`          | move there and press: the button is still held in the shot      |
| `--up x,y`            | move there and release (after a `--down`: a press that slides)  |
| `--press Key[,Key..]` | press keys in turn: `Tab`, `Enter`, `Shift+Tab`, `a`            |
| `--sleep <ms>`        | wait that long before the next input                            |
| `--resize WxH`        | change the viewport: a window being resized                     |
| `--run "<js>"`        | run in the page at this point (fake a hidden tab, read a value) |
| `--after <ms>`        | wait after the last input, before the shot (default 150)        |

With `--touch`, `--click` is a tap and `--down` is a finger held on the screen (a `--move` after
it drags that finger, and `--up` lifts it).

```sh
node tools/shoot.mjs "http://localhost:5173/dev/stage" .snaps/stage-held.png --move 40,60 --down 300,700
node tools/shoot.mjs "http://localhost:5173/dev/ui?only=ask-home" .snaps/ui-typed.png --press Tab,a,b,Enter
# the home page on a 1920 x 1080 panel at 125%, the mouse over the HOME card
node tools/shoot.mjs "http://localhost:5173/?day=2&time=14:00" .snaps/home-125.png \
  --sizes 1536x864@1.25 --wait 3000 --move 500,838 --after 400
# a played game put in storage first, then a press that slides off the ball
node tools/shoot.mjs "http://localhost:5173/?day=2" .snaps/home-slide.png --w 1920 --h 1080 --dpr 1 \
  --init "localStorage.setItem('soccersense:v1:2026-11-11:home', '{...}')" \
  --wait 3000 --down 880,760 --sleep 200 --up 400,300
```

Console errors (hydration warnings are console errors), page errors and failed requests are
printed on stderr with the shot they belong to, and a batch ends with a count:
`shoot: 108 shots, 0 problems reported`. Then open the PNGs and look at them.

To check the built site, serve it as a static host would and shoot that, an address that does
not exist included (the dev server answers those itself and never shows what the fallback
document does):

```sh
./node_modules/.bin/react-router build
./node_modules/.bin/sirv build/client --single __spa-fallback.html --port 4173
node tools/shoot.mjs "http://localhost:4173/{name}" ".snaps/built-{name}-{w}.png" \
  --names how-to-play,no-such-page --sizes 1920x1080@1,1536x864@1.25,390x844@3 --strict
```

`sirv` lists the files once, when it starts: start it again after every build, or the new files
(their names change) answer 404. A `--names` value goes into the output path as it is: no `:`
and no `/` in it (on Windows a colon writes to a stream of another file).

## The pages

| address                    | file                         | what it is                                                                          |
| -------------------------- | ---------------------------- | ----------------------------------------------------------------------------------- |
| `/`                        | `app/routes/home.tsx`        | the home screen: `GameLayout` with `PixelStage` (the menu scene) and `MenuCaptions` |
| `/play/home`, `/play/away` | `app/routes/play.tsx`        | the game, one page per mode (`app/routes/play/`)                                    |
| `/how-to-play`             | `app/routes/how-to-play.tsx` | the rules for old links (the "?" button now opens them over the home screen)        |
| any other                  | `app/root.tsx`               | the error page (`ErrorBoundary`), which is also the 404                             |
| `/dev/ui`, `/dev/stage`    | `app/routes/dev-*.tsx`       | the gallery and the stage test card                                                 |
| `/dev/sound`               | `app/routes/dev-sound.tsx`   | the sound board: every sound and its level from `app/audio/mix.ts` (docs/AUDIO.md)  |

Every page is rendered to HTML at build time, so none of them reads the window, the address or
the storage while rendering: what depends on the day arrives after mounting, through
`useSyncExternalStore`.

**The home page** makes one `MenuScene` per day after mounting and listens to it (what a page
must and must not do with a scene is in `docs/API_SCENES.md`). Beyond that:

- Debug queries: `?day=<n>`, `?stadium=<id>`, `?time=HH:MM` and `?speed=<0 to 16>` (the scene's
  time: `0.1` is slow motion). The query is carried to the mode pages, and they carry it back.
- The "?" button opens the rules over the menu (`HowToPlay`, a modal dialog); the address does
  not change, and closing them puts the focus back on the "?".
- The mode's page is fetched ahead of the kick-off (`PrefetchPageLinks`), from the moment a mode
  is pointed at, focused or chosen, so the ink the kick-off ends on lasts one frame. So is the
  face of the next page's heading (`fetchHeadingFaces`).
- If the page is still there 8 s after it asked to leave, the menu comes back (`scene.reset()`,
  the captions unstowed). If the scene never reports the end of the kick-off, the page leaves by
  itself after 6 s. From `onKickoff` on, the page does not replace the scene at midnight or on
  coming back into view, even while a mode chosen during the entrance waits for the ball to
  settle (the phase is still `intro` then).
- For screen readers: a visually hidden `h1` (the name, which takes the focus on coming back
  from another page) and a line with the fact of the day; the two cards are buttons; the notice is a
  polite live region. With no script, a `noscript` panel says what the site is.

**A plain page** (the placeholder, the error page) is a `PixelRoot` with `ss-page`, its
content in the game's own column in the middle of the screen: a `Panel`, and a button back to the
ball. The heading of the placeholder takes the focus on arrival.

**The rules page** (`/how-to-play`, 2026-11-12) keeps old links working now that the "?" opens a
pop-up. It is a `PixelRoot` with `ss-page` holding the pop-up's own card (`HowToPlayCard`, the
same content, two columns on a monitor), its `h1` taking the focus on arrival, with the way back
to the ball (a link carrying the query, `strings.play.back`) where the pop-up has its close
button. It is a page rather than the home screen with the pop-up open because the site is
prerendered with no server: as a page its HTML carries the whole of the rules (readable with no
script, and by search engines), and one address does not have to show another's page by
rewriting the address bar behind the router.

**The error page and the fallback document.** The build writes `__spa-fallback.html`, which a
static host serves for any address that is not a prerendered page. It holds the root layout round
`HydrateFallback` (in `app/root.tsx`): an empty `PixelRoot` page. For an address that does not
exist the router renders `ErrorBoundary` straight away, so `ErrorBoundary` renders exactly what
`HydrateFallback` does while the browser takes the document over, and its words after that. Keep
the two in step: a difference is a hydration error (React's error 418) on every unknown address
of the built site, which the dev server never shows. A test compares them.
