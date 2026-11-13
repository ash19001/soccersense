# Build progress (iteration 1)

Updated 2026-11-13. This file says what exists, what is in flight and what comes next, so the
build can be picked up after an interruption.

## Done

| piece            | where                         | state                                                       |
| ---------------- | ----------------------------- | ----------------------------------------------------------- |
| Briefs           | `docs/*.md`                   | Game design, art bible, architecture                        |
| Pixel engine     | `app/pixel`, `tools/snap.ts`  | Built and reviewed. Reference: `API_ENGINE.md`              |
| Game rules       | `app/game`                    | Built and reviewed. Reference: `API_GAME.md`                |
| Sun and location | `app/lib`                     | Built                                                       |
| Sample content   | `app/data`, `docs/data-notes` | 7 HOME and 7 AWAY questions, 21 stadiums, fact-checked      |
| Interface kit    | `app/ui`, `/dev/ui` gallery   | Built, reviewed and finished. Reference: `API_UI.md`        |
| Art foundations  | `app/art`                     | Palette, lighting, sky, layout. Reference: `API_ART.md`     |
| Home-screen art  | `app/art`                     | Menu ball, stadium backdrop, LED panel, logo. Judged, final |

1,346 tests pass; types, lint and formatting are clean (checked 2026-11-11 after the art round).

Look at the home screen without a browser:
`./node_modules/.bin/tsx tools/snap.ts stadium/composed --time all --scale 3 --out .snaps/x.png`

## Milestone A: the home screen, live in the browser

1. Done: palette, lighting, sky, layout, the menu ball and the logo.
2. **Changed on 2026-11-11.** The first stadium was a view from the centre circle. The product
   owner saw it and asked for the stadium **from the outside**, as a building behind the ball.
   The inside view is kept as reference art in `app/art/stadium-inside.ts` (shots `inside/*`).
3. **Steered again the same day**, after the product owner saw three unfinished outside views:
   "im imagining on a pc monitor not a phone screen but was imagining like the first picture
   but the stadium bigger and in the middle of the screen, the top is all sky and the bottom is
   grass/trees/maybe car park etc. the ball is just the floating focus point of menu - doesnt
   have to be on floor". The first picture was attempt a (a pale bowl with warm walls, the crowd
   inside, a pavilion, supporters on a path). So: a PC monitor first, the stadium big and
   central, sky above, grounds below, and the ball floats.
4. **And twice more.** Shown attempt a on a monitor (an aerial stadium on a ground drawn from
   ground level): "More flat since that looks like a floating stadium and not in line with the
   ground". Then they sent a reference photograph and wrote: "i meant something a bit more like
   this and id like more detail and thought into surroundings like housing, trees, bushes,
   people, cars, etc." The photograph (a copy is in `.snaps/ref-owner-stadium-aerial.png`,
   which is not in git): an aerial view at night, from a drone, looking down at about 35
   degrees on a whole oval stadium with a glowing roof ring, the pitch visible inside, car
   parks and roads around it, and a town running away to a horizon a quarter of the way down
   the picture. So the final brief is: **one aerial viewpoint for everything**, a PC monitor
   first, the stadium big and central, sky across the top, a thoroughly planned town around
   it, and the menu ball floating in front. The photograph is for viewpoint and composition
   only; the stadium is our own.
5. Done: `MenuScene` in `app/scenes` (to the backdrop contract in `docs/API_ART.md`),
   `PixelStage` and `useDeviceSky` in `app/ui`, the dev page `/dev/stage`, and the home page
   itself: the `/` route with captions and real text, and placeholder pages at `/play/home` and
   `/play/away`. It is live.
6. The product owner was shown a draft of the aerial picture from each of three artists and
   chose one: "c is my favourite - maybe to speed up only do that". They also asked, while the
   drafts were coming in, for a city skyline on the horizon, cars parked in the car parks with
   animations of them arriving and driving off, and a looped animation of a match being played
   in the stadium.
7. Done on 2026-11-11, each as its own run so that one does not interrupt another:
   - the chosen picture, finished with those requests and installed as `app/art/stadium.ts`
     with `app/art/stadium-*.ts` beside it (same `MenuBackdrop` class and contract);
     `menuLayout` updated; the two abandoned attempts archived in
     `.snaps/abandoned-stadium-attempts.tgz` (not in git) and removed;
   - the menu ball floats (`app/scenes/menu.ts`): a bob and a nod, an entrance out of a star,
     a strike in mid-air;
   - the interface is exact in device pixels at any Windows display scaling or browser zoom
     (`app/ui/scale.ts`), and the menu captions are a wide row sized for a monitor;
   - the kick-offs are fitted to the picture: HOME lobs the ball over the rim onto the centre
     spot and the ground erupts; AWAY curls it away over the town into the sky.
     After all four: tsc, eslint, prettier and 1,553 tests pass.
8. Done: an independent review by an art director and a principal engineer who built none of
   it, in a real browser, monitors first (the engineer's half was finished on Opus 5.5 after
   the Fable usage ran low). Verdict against the product owner's requests: met, except that
   the bottom edge is more road and paving than grass and trees, and the night town is darker
   than their photograph. Fixed in the review: the match ball can be followed, away fans no
   longer cheer the home goal, the roof glows at night (the one change to the chosen look; to
   undo it, remove the `if (tones.lightsOn)` block in the roof branch of `stadium-bowl.ts`),
   the moon is never half hidden, people wait for gaps in the traffic, the highlight holds
   under a still pointer, slow devices no longer run in slow motion, focus moves to each new
   page's heading, unknown addresses no longer raise a hydration error, the heading font is
   fetched ahead. Final state: tsc, eslint, prettier and 1,593 tests pass; the built site has
   no console errors at 1920x1080, 125% scaling and on a phone.

**Milestone A is done.** Measured on the built site at 1920 x 1080: a steady frame costs about
2.7 ms; the first frame takes about 200 ms (the screen is ink for 0.6 s on load); a change of
light, which happens about every two minutes as the sun moves, freezes the picture for 60 to
150 ms; each frame allocates about 155 KB in `app/art` (mostly `drawCloudShadows`).

Waiting for a decision from the product owner:

- The game's other screens (board, answer bar, reveal sheet, full-time card) look like a phone
  app pinned in the middle of a monitor: a 528 px column with 10 px capitals. A monitor layout
  is about a day's work: swap `--fp` for `--cp` inside `.ss-game[data-wide]`, widen the column,
  and give the reveal sheet and full-time card a landscape layout (doubled, the board and the
  sheet no longer fit 1080 px), then update `COVER` in `app/art/layout.ts`.
- The "more modes" notice now wraps to three lines inside the caption row at 1920; before, it
  was one line hanging out to the left of the row.

Next, before or alongside Milestone B: remove the light-change freeze (re-light the picture
incrementally or over several idle frames), stop the per-frame allocation, and paint the first
frame's static layers before the loop starts.

## Milestone B: a playable game

Built on the evening of 2026-11-11 (on Opus 5.5), one artist or engineer per piece, no
tournaments, and playable end to end: the footballer, keeper and props (`app/art/characters`);
the career ground framework and all eight HOME tiers (`app/art/grounds`); a monitor layout for
the game screens (`app/ui`; the product owner pictures the game on a PC, so this was decided
without waiting for an answer); the game page at `/play/home` and `/play/away`
(`app/routes/play.tsx`, `app/routes/play/`); the `CareerScene` (`app/scenes/career*.ts`): idle
keepie-uppies, a shot for every grade, the ground built around him on promotion, fireworks for
goals at the stadium tiers, the full-time tableaux and the trophy lift. The 14 sample questions
in `app/data` are the game's questions for now. Builders' known weak points: the last goal's
ball vanishes from the net when the next shot starts; people snap back if the player moves on
quickly; the child keeper never dives; the near crowd at the stadium tiers is a busy block; the
floodlight beams at tiers 6 and 7 look dotted; the goal is boxy in profile.

Done the same evening, five home-screen changes the product owner asked for: drag and flick to
spin the menu ball; the airship can be clicked, and five or six quick clicks pop it and it
crashes into the town, then a new one drifts in with the sign; about a third fewer cars and
people; a car and a person are never on the zebra together; no car drives in the car park any
more (they asked for that or a fixed parking animation; the lead chose static).

**Then the rules changed** (the product owner, 2026-11-11 evening): HOME is now the most common
answer and AWAY the most niche (popularity estimated in the sample data until a backend counts
real answers); CLOSEST and FURTHEST (the old distance modes) are locked patches on the back of
the ball; the top patch is NEXT-GEN and the bottom RETRO, both locked; a ball spun onto a
locked patch holds there about 4.5 s and a click names the mode. Done with it: cars drawn along
their bays and their direction of travel (24 headings), fewer people walking at night, small
fireworks when the home-screen match scores (and at the career scene's stadium tiers).

Done too: the blimp's sign shows a fun football fact of the day ("DID YOU KNOW?"), from 60
facts in `app/data/facts.ts`, each checked against a source (59 of them against Wikipedia;
see `docs/data-notes/facts.md`). Today's stadium no longer shows on the home screen; it stays
the day's venue on the game's board and the pin for CLOSEST and FURTHEST later.

Done: a final independent review of all of it in a real browser (2026-11-11, 19:20). All twelve
of the evening's requests are met on screen; one was not until the review (people standing on
Stadium Road and the zebra: fixed, with a test over 30 days). Also fixed: the cursor now
follows a ball or airship that moves under a still mouse; leftovers of the old sign; stale
docs. Whole HOME and AWAY games were played at 1920 x 1080, 1536 x 864 at 125% and on a phone,
including a perfect 700, saves, reloads and replays. tsc, eslint, prettier and 1,825 tests pass;
the production build loads with no console errors.

Weak points the review left for the product owner: the board cuts the stadium's name short
("MARACA..."); after a reveal that earned a promotion the board shows the new tier while the
picture still shows the old ground until NEXT; in the game scene the players sit in a thin band,
the near crowd fills 30 to 40% of the screen from tier 3, and tiers 0 and 1 have a lot of empty
grass; the how-to-play and 404 pages are phone-sized on a monitor and the rules are one
paragraph; the home page's title and description still say "one stadium a day"; AWAY uses the
HOME grounds until Milestone C. All of this is committed and pushed as `cd66274`.

Done since about 20:00 on 2026-11-11 (run `w10-shots-board-iris.js`, stopped before its last
two steps when new requests came in): six shot categories replace rank-based points (the rule
is `shotsFor` in `app/game/shots.ts`; every answer is stored in one category); the footballer
has a move for each; a mock daily leaderboard on the home screen (a panel over the park on a
monitor, a sheet on a phone; `app/data/leaderboard.ts`); a smooth iris when a mode is chosen.

Done between about 22:20 on 2026-11-11 and 02:00 on 2026-11-12 (runs
`w11-names-sound-mascot.js`, `w12a-home-quiet.js`, `w12b-menu-ui.js`, `w13-recordings.js`),
the product owner's next eleven requests and three rounds of listening feedback:

- The shots renamed: miss 0, tap in 10, toe poke 30, trivela 60, golazo 80, worldie 100 (ids
  `miss`, `tapin`, `toepoke`, `trivela`, `golazo`, `worldie`; a finished game saved under the
  old ids still loads). The footballer has a move for each.
- "Uncommon" instead of "niche" everywhere a player reads it (`en.test.ts` enforces it; the
  rule id in code is still `niche`).
- A title on the full-time screen earned by the total, ten per mode (`app/game/titles.ts`).
- No stadium name on the game's board (screen readers still hear it).
- The stadium's colours change each day: twelve schemes in `app/art/stadium-club.ts`, none
  pairing blue with white (a test holds this). The menu scene sets the day's scheme.
- A clickable owl mascot on the lawn left of the stadium with tricks, scaled to the people
  (8 px tall against their 5) and well inside the lawn. Phones have no lawn, so no mascot.
- Two more locked patches on the ball: GUESS WHO and SHOOTOUT.
- Sound (`app/audio`, `docs/AUDIO.md`): synthesised in the browser and replaceable by
  recordings in `public/sounds`. The product owner's five recordings (kick, ball tap, button
  click, firework, ball into net) are cut by `tools/sounds.mjs` from `sounds-src/`, with taps
  played round-robin and the net under every goal. Background ambience is matched to each
  career tier, and the home page's bed is quiet: no horns, only a faint cheer and distant pops
  when its match scores. A click sounds only on a press of the menu ball, never on hover. Every
  button clicks, and a whoosh plays at both ends of the iris. The referee's whistle sounds as a
  mode starts, a kick goes with every shot, each shot has its own sting and the cheer is sized
  to the venue. The idle juggling is very quiet. The mute switch sits next to "?" (in the
  board's corner in the game, and on the full-time screen).
- Wind streaks round the spinning ball; a pixel click burst wherever the pointer clicks; the
  leaderboard collapses to a tab at the right edge (and remembers it).
- The career scene: the promotion's smoke opens on a close-up of the ball driven into the back
  of the net (after the product owner's reference photo), and a smooth opening from black (every
  frame 16.4 to 16.9 ms in Chrome).

The final review (2026-11-12, about 01:40) played whole HOME and AWAY games on a monitor and a
phone and found and fixed four defects: the stadium never changed colour (the scheme was never
set), the far upper stand kept its red crowd, the full-time screen had no mute switch, and the
game page's opening whoosh was always dropped. Weak points it left: one 33 ms frame at the page
change, while the screen is all ink; the net close-up is centred, where the reference has the
ball off to one side; the near stands still change abruptly under the promotion's smoke; a
fourth quick poke on the airship is silent; the source and licence of the product owner's five
recordings are still to be recorded in `public/sounds/CREDITS.md`.

Done on the morning of 2026-11-12 (runs `soccersense-sounds-board-help-shadows`,
`soccersense-reveal-five`, `soccersense-help-copy`), the product owner's next requests,
checked by a final review in a real browser:

- Their new recordings: every clap in the game now comes from `clapping` (layered from one in
  the park to nine at the final); `star_sparkle` plays as the AWAY ball twinkles away into the
  sky; a landing thud cut from `ball_sound` plays as the HOME ball lands on the stadium (and a
  softer one for its bounce); `vuvuzela` plays only at the World Cup stage (tiers 6 and 7): a
  low hum in the crowd plus a blast with each goal (the worldie's horn at tiers 4 and 5 is
  gone). The background fireworks are 2 dB louder.
- Every volume is in one commented file, `app/audio/mix.ts`, and the sound board at
  `/dev/sound` plays every sound with a slider for each level and copies the changed lines.
  `docs/AUDIO.md` opens with "Changing the volumes".
- The leaderboard slides every frame (eased, on whole device pixels) instead of in four steps,
  on a monitor and as the phone's sheet; the captions and trophy leave the same way at the
  kick-off. The sound engine now prepares itself while the page is idle, so the first press no
  longer stalls a frame.
- How to play is a pop-up over the home screen (a sheet sized to its content on a phone), cut
  down at the product owner's request to one line, the points and the career ladder, with no
  mention of HOME or AWAY (more modes are coming). `/how-to-play` still works for old links.
- Car shadows go through the same depth mask as the cars, so a car behind a tree or a roof no
  longer leaves its shadow on top (and walkers no longer vanish in a tree's shadow).
- The reveal shows exactly five answers, one per scoring shot, best first: the player's own
  in its row when it scored (or on its own line when it did not), and for the other shots the
  best answer in each (the most picked in HOME, the least picked in AWAY). Every question now
  has an answer in each scoring shot (a test holds it).
- One background bird, a long trill sliding down in pitch, was removed: the product owner
  heard it as something falling.
- Then (run `soccersense-reveal-fit-and-result-sounds`): the reveal always shows all five rows
  and the player's own line, with nothing cut or scrolled, measured over every question and
  every kind of result at 15 screen sizes. The sheet grows as tall as it needs, and only on
  very short screens does it hide countries or tighten rows. A result's sounds (the sting, the net,
  the cheer, the groan, the whistle, the horn) are never dropped as busy any more: the oldest
  fades out in 0.3 s to make room. The review also stopped a late horn after a quick NEXT into
  the World Cup.

Open after this round: on small phones (360x640) the reveal now covers about 58% of the scene,
so the players are hidden until NEXT; trying the compact steps before growing past 46% on
phones would keep more of the scene in view.

## Detail 2: twice the detail (2026-11-12)

The product owner asked for more detail in the home screen's map (cars, people) and in the
game. Every fixed-size drawing was redrawn natively with twice the pixels at the same size on
screen (art bible 2 and 5): the players, the keeper and the youth, the crowds, the grounds at
every tier, the town and its traffic, the mascot, the airship and its sign, the wordmark, the
menu ball and the lettering, in two waves of artists and a polish round (with new features
that came with it: the sign's messages, the plane towing the fact, the daily streak, the ball
fetched back after a shot, the end stand behind the goal, lamp shadows). Then **the default
flipped to detail 2** (`DEFAULT_DETAIL` in `app/art/detail.ts`): every page, the prerender and
the first client render drew at 2, and the snap tool at 2 unless `--detail 1`. The old
art (detail 1) was kept, pixel for pixel, for comparison with `?detail=1` (kept for the tab's
visit) and `snap.ts --detail 1`; step 3b removed it with its tests and the `pick`/`dpx`
branches. Proof of the flip: the home page and the game at the default are 0 pixels from
`?detail=2` just before it, on four screens.

**The cleanup (step 3b, 2026-11-12).** The old art and the switch are gone: there is one
scale, and twice the detail is simply the game's art. `app/art/detail.ts` (`detail`,
`setDetail`, `withDetail`, `pick`, `dpx`, `perDetail`, `drawFallback`), the `?detail` query
and `snap.ts --detail` were removed with every detail-1 drawing, table, spot, size and test;
every `dpx(n)` is its plain value, every `pick(today, d2)` its second value, every `-d2` file
and `D2` name took today's name and place, and caches lost their level key. `app/ui/scale.ts`
has one canvas rule (`canvasDpFor(dp)`, half the interface's pixel rounded up), and
`PixelRoot` forgets a tab's stored choice (`app/ui/forget-detail.ts`). Four cleaners worked at
once (characters, grounds and the game, the home screen, the core), proven against references
taken before the first change: step 1's 24 shots and 96 more (every tier asking, full time,
the stats, the streak, the sign's messages, the plane, the fetch) at 1920 x 1080, 1366 x 768,
1536 x 864 at 1.25 and 390 x 844 at 3 are 0 pixels apart; every shot sheet is the same or
renamed and identical, but for the comparison sheets that showed the old art beside the new.

## Era art: RETRO and NEXT-GEN get their own look (2026-11-13)

The product owner: "retro should be olden times so the first types of football kits, old
brown ball, old houses in background and net and park and stadiums etc. next gen should all
be futuristic." RETRO and NEXT-GEN had played as HOME, in HOME's look. Now the career scene
draws each in its own era: RETRO the early days of the game, NEXT-GEN the future (art bible
section 10). The composition and the play are HOME's in both; only the look changes. HOME
and AWAY did not change by a pixel.

- **The era parameter** (`app/art/era.ts`, `docs/API_ART.md` "Eras"): the scene decides it
  once from its mode and passes it to the ground (`Paint.era`), on the kits (`Kit.era`,
  `eraColors`, `eraGlows`, with twelve era letters in the people's legend and a frame layer
  per era in `era-frames.ts`), to the ball and the trophy, and to the effects. Every painter
  takes it as an optional last argument that defaults to today's look. The ground gained
  `Life.movers` for an era's moving things.
- **Six artists**, one per era and area: RETRO players, small grounds (tiers 0 to 3), big
  grounds (4 to 7) and effects; NEXT-GEN the same. Each worked in its own files, with
  one-line dispatches in the shared painters. Their reports and sheets are in
  `.snaps/era-art/` (`reports/*.txt`, `*.png`); the agreements between them in
  `.snaps/era-art/THEME.md`.
- **The review** played both eras at every tier, by day and at night, and fixed what did not
  match: the hero's colour is his mode's in every era and his crowd and things wear it
  (RETRO old gold, NEXT-GEN magenta, never HOME's red); RETRO's tier 6 cup is the silver cup
  he lifts at tier 7; NEXT-GEN's holo screen moved clear of the question board. It also made
  every airship sign message fit without scrolling and made the full-time card's
  paired-mode button the mode's name alone.
- **Housekeeping**: the sign's place line reads "37 OF 1,284" (it was "37TH/1,284"; the
  longest the leaderboard can give, "1891 OF 1,891", fits the smallest sign, where "#" or
  "TH" would not). The references in `.snaps/era-art/ref` were retaken for the two changes
  the review made on purpose (the home page's sign, the full-time buttons); everything else
  in them is as taken before the round.
- **Proof**: the shot sheets' fingerprints (311 of today's shots) are unchanged by day and at
  night at two sizes; the browser references (HOME and AWAY asking at every tier, the reveal,
  shots in flight, promotions, full time, night) are 0 pixels apart but for the two changes
  above. **Cost** (the review, Chrome at 1920 x 1080): no frame over 16.7 ms in either era;
  the worst 14.3 ms (RETRO, the promotion to tier 6) and 13.7 ms (NEXT-GEN, a worldie at
  tier 4).

What is weak (from the artists and the review; six polishers follow):

- RETRO: the tier 4 crowd in old gold and dark coats is busy and leans brown; the
  grandstand's red trim at tier 4 does not match the gold crowd; caps and bowlers are hard
  to tell apart at 1x, and rattles barely show; the brass band and the newsreel men are
  tiny; a moustache on dark skin is faint; the tier 1 subs wear plain red and navy coats; the
  end's scoreboard is off screen on phones; the mill smoke rises behind the pediment's clock;
  the warm grade stops at tier 3, so the colour shifts a little at the promotion to tier 4.
- NEXT-GEN: the daytime skyline behind the low tiers is busy; goal bursts are thin by day;
  the referee drone's rotors are faint; the glowing seams on the club shirt are subtle;
  wristbands at rest are a single pixel; the trophy orb can blend into the crowd at tier 7;
  the tier 3 photographers are today's; on a phone the end and the holo screen are mostly
  off screen; the sky at tiers 6 and 7 is busy.
- Both: a title on the airship's sign shows without its mode's label; the paired-mode button
  no longer says "PLAY" on screen (it is read out as "Play AWAY").

## Era art: the polish (2026-11-13)

Two critics played RETRO and NEXT-GEN beside HOME at the same frozen moments (their sheets:
`.snaps/era-art/crit-retro.png`, `crit-nextgen.png`) and found 27 things; six polishers, one
per era and area as before, fixed them and the weak points above. A review then checked
every finding in the game and fixed what was left. Everything is written up in
`.snaps/era-art/THEME.md` ("Polish notes"), the polishers' logs `progress-*.md` and sheets
`polish-*.png`; the art bible's section 10 and `docs/API_ART.md` "Eras" describe the result.

- **RETRO.** The hero's kit is the deep end of the old gold with a chalk laced collar and
  dark knickerbockers to the knee, so he stands off the cream boards and the gold crowd (he
  had vanished in the bicycle kick); the park keeper wears a cream jumper with a green roll
  neck and a tweed cap; the ball's lace is a row of dashes, the worldie's ball gilded leather;
  the cup is gilt. Caps and bowlers read apart, rattles have a clacker. His street is RETRO's
  own (sash windows, painted doors and shop signs, gas lamps, cobbles, plumes from the
  stacks, a viaduct with a steam train, a milk cart), with an old gent and a pram near the
  middle of the lower green so phones see it; the subs wear old gold overcoats; the goal is
  squared timber and a rope mesh at every tier; one warm grade covers every tier
  (`retro-grade.ts`), so the promotion to tier 4 no longer jumps. From tier 3 the near crowd
  dresses lighter (no more brown mush), iron lamp standards with bare bulbs replace the
  lattice pylons (timber lamp towers light tier 3 by night), the end's boards are lettered
  by hand, the trim follows the crowd (gold to 4, brick from 5), the scoreboard moves to the
  grandstand's roof on phones, no smoke rises out of the pediment, the podium's winner
  stands higher, and the band, newsreel cranks and fireworks read better.
- **NEXT-GEN.** The referee is a man in black with amber seams and a visor (the drone read
  as a floating pill); the trophy is a tall gold cup, not an orb; the crowd mixes violet,
  slate, white, cyan and silver under the magenta, with 2 x 2 wristbands that run a light
  wave, visors and headsets. The park's goal is two marker cones, the day skyline sits back
  in three depths, the turf's stray studs became sensor rows along the touchlines, the
  holographic boards crawl, and the city behind the stands costs 0.02 ms where it cost 0.6.
  From tier 4 the goal is a bold frame of light, the band a phone sees (balcony, boxes, tier
  fronts, track edge, drones, ball kids, dugouts) is clearly of the future, the boards say
  NEXT-GEN's own words (DRONE PIES, HOLO SEATS, SCAN TO CHEER), the plinth is white glass,
  the holo sign is scanlines carried by drones, photographers wear light and a drone takes
  one's place, bursts are bolder by day, and the sky at 6 and 7 is quieter.
- **The review** fixed the critics' one finding nobody had taken: the standing watchers at
  tiers 0 to 2 in NEXT-GEN still wore today's coats; they now wear slim jackets with a hem
  and zip of light, about half with a visor (`nextgenCoat`, `nextgenWatcherLights`,
  `Watcher.trim`). The park's planter lost its last red blooms (magenta now).
- **Proof**: the four shot-sheet fingerprints still say "311 same, 0 differ or gone"; every
  browser reference of HOME and AWAY (all groups, all four sizes) is 164 compared, 0 differ.
  **Cost** (Chrome at 1920 x 1080, every shot, a miss and its fetch, all six promotions, full
  time at 0, 4 and 7, by day and at night): no frame over 16.7 ms; the worst 14.9 ms (RETRO,
  full time at tier 7 by night) and 15.7 ms (NEXT-GEN, the promotion to tier 6). In Node at
  960 x 540 the first build of a new ground on a promotion can reach 17 to 18 ms (RETRO, tier
  3 to 4, while the code is still cold; about 9 ms warm). The whole suite passes (121 files,
  2,815 tests).

What is still weak:

- RETRO: the cream boards still sit behind the hero at some spots (his dark knickers carry
  him); the bandsmen and newsreel men are a few pixels each at 1x; tier 5's brick coats are
  duller than HOME's red; the mill smoke is a stylised arc; the flower bed keeps a few red
  geraniums.
- NEXT-GEN: the holo sign is top left only, so phones never see it (the band below carries
  the look there); magenta is still loud in the tier 4 upper stand; the cast's cyan visors
  make faces alike at 1x; the near crowd's headsets can run a pixel past a small head; by day
  the street's townhouses are the brightest band behind the action; the photographers'
  drone is cut off at the phone's right edge.
- Both: the lower park below the path at tiers 0 and 1 is empty grass in NEXT-GEN (as in
  HOME), where RETRO has its lower green.

## Milestone C: the AWAY journey and polish

Six away backdrops and their weather, travel transitions, trophy lift, a dev art gallery page,
answer-judge decoys for near-miss names, whole-game visual checks on phone and desktop sizes.

## Known follow-ups

- Judge: a few real-but-wrong names are one typo from a listed answer ("Bayer" next to
  "Bayern", "Alberto" next to "Albert", "Palma" next to "Parma"). Fill `Question.decoys`.
- Estadio Centenario is due to close after 28 Nov 2026: replace it in the stadium list later.
- `/dev/ui` is registered unconditionally and would be prerendered into a production build.
- Very short landscape phones (under about 440 CSS px tall) do not have room for the layout.
- Tablets in portrait at 820 x 1180 get a cramped layout (the font pixel doubles there).
- Art: the sun jumps sides at solar noon; golden hour turns the pitch a little olive; the
  stadium stand is a flat band on wide screens; locked ball patches show a padlock but no word.
- The interface kit has only been checked in Chrome.
- Words painted into the stadium (banners and hoardings) are fixed English art, not text from
  `app/i18n`.
- Sound: record the source and licence of the product owner's recordings in
  `public/sounds/CREDITS.md`. If the idle juggling still sounds too present, lower
  `JUGGLE_TOUCH` in `app/scenes/career.ts` from 0.15 to 0.08 (about 5.5 dB quieter).

## Working notes

- The machine's C: drive runs nearly full. Check free space before a multi-agent round, and
  write only inside the repository.
- The code is on GitHub (`origin`, branch `main`). First commit `0db2e54` on 2026-11-11, at the
  end of Milestone A; then `cd66274` the same evening (the playable game, the new HOME and AWAY
  rules, the home screen changes). Commit and push only when the product owner asks.
- The losing attempts from the art round (two balls, three stadiums) are in scratch folders on
  D: (`D:\ss-ball-a-tmp`, `D:\tmp\soccersense-ball-b`, `D:\claude-scratch`,
  `D:\claude-scratch-stadium-b`, `D:\soccersense-stadium-c-scratch`, `D:\soccersense-logo-scratch`).
  Stadium attempt B has a perspective sweep for wide screens that may be worth borrowing.
