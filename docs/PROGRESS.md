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

## The golden ball (2026-11-16)

An easter egg on the home screen (the product owner: "if people are spinning the ball in home
screen constantly for a long time (30 seconds or 1 minute), then something cool happens"). The
ball kept spinning by hand for 30 seconds turns to gold: a glow, gold wind and sparks on the
way, then fireworks over the town, the stadium's roar, a cheer, the mascot's trick and the
airship's sign (the only thing that says so). Gold for the rest of the day on that device.
Its sounds are cut from the product owner's `shimmering.mp3` (`tools/sounds.mjs`): the
ball's own sparkle as it turns (`sparkle-gold.mp3`) and a quiet looped shimmer
(`shimmer.mp3`) that comes in with the glow and stays, quieter, under a golden ball. Rules:
docs/GAME_DESIGN.md (the home screen); the scene: docs/API_SCENES.md; the art:
`BallState.gold` and `~/art/gold-show` (docs/API_ART.md); the sounds: docs/AUDIO.md, their
levels in `app/audio/mix.ts` (`SOUNDS.shimmer.level`, `HOME_PAGE.goldenShimmer`,
`goldenShimmerBuild`, `goldenSparkleDb`, `goldenCheer`), with rows on `/dev/sound`. The
shimmer's file is made at three quarters of the take's pitch and half its speed (the product
owner found the take squeaky, and an octave lower too low): `pitch` and `tempo` in
`tools/sounds.mjs`, then `node tools/sounds.mjs shimmer`. The
levels were set by the numbers; the product owner then heard the shimmer and asked for it
quieter, twice, and it was halved each time (the kept shimmer is now about 12 dB under the
town's own bed). To see it quickly, `?speed=8` on the home page runs the scene eight
times as fast.

The shimmer is seen too (the product owner, later the same day: "add some sparkle effect on
ball when its golden so the shimmer sound makes sense"): a golden ball sparkles all the time
it hovers, glints opening and closing on its gold leather (`~/art/gold-sparkle`,
docs/API_ART.md). Before, it only twinkled once every 2.4 s.

## AWAY and the plane (2026-11-16)

A second easter egg on the home screen (the product owner: "if the plane is passing through
and the ball contacts the plane then instead of going into the sky the plane crashes and ball
falls to the ground, then the transition happens for the match"). AWAY chosen about a second
after the plane's nose shows sends the ball into it: the plane comes down as the airship does
(spinning into the town under it, with the airship's dust or splash, its pilot under a
parachute), the ball falls to the ground beside the wreck, and AWAY starts about three seconds
later than usual. The two wrecks have a place each: the plane's is the lawn at the right
(where the airship used to fall in most windows: "it should fall where the blimp currently
falls"), and the airship now lands at the left, just behind the mascot ("make the blimp land
on the left behind the mascot instead. so that area is only for the plane"). Rules:
docs/GAME_DESIGN.md (the home screen);
the scene: docs/API_SCENES.md; the art: `planeBox` in `~/art/stadium-plane` and the fall in
`~/art/stadium-plane-fall` (docs/API_ART.md); its sounds' levels: `HOME_PAGE.planeHit` and
`planeBallLand`, with a row on `/dev/sound`. To see it:
`pnpm snap menu/away-plane --size 960x457 --t 0.9 --strip 8 --dt 0.45 --scale 1 --crop 720,60,240,300`
(the plane), and `pnpm snap stadium/airship --size 960x457 --scale 1` (the airship: eight
frames, the last four its fall, its wreck behind the mascot and the new one coming in).
Monitors only: no plane flies on a phone.

## The sound waiting for the first press (2026-11-16)

Reported as a glitch: on a first load or a refresh the speaker showed the sound on, nothing was
heard, and it took a mute and an unmute to hear anything. Nothing was broken in the engine: a
browser holds every page silent until its first press (a refresh too), the speaker showed only
the remembered choice, and a first press on the speaker started the sound and switched it off
at once. Now the speaker shows the sound waiting until it has really started (blinking waves
and a tooltip), and a press on it while it waits starts the sound and leaves it on. The engine
says when it has started (`onStarted`), through `app/audio/started.ts`. docs/AUDIO.md (waiting
for the first press) and docs/API_UI.md (`SoundToggle`) have the detail. The page still cannot
play anything before a press: no page can.

## The mode card before a game (2026-11-16)

The product owner: "when going to each category rather than just going straight into game,
after transition it shows message of category like 'give the most common answer' then
transitions to game start". Before a new game the game page now shows a mode card on the ink
the kick-off ends on: the mode's name, large and in its colour, between two rules, over
`GIVE THE MOST COMMON ANSWER` (AWAY: most uncommon; RETRO: oldest; NEXT-GEN: most recent),
the words that tell the modes apart in the mode's light colour. It stays 2.4 s (a press
anywhere, or Enter, Space or Escape, sends it off sooner), shuts in 0.2 s, and then the iris
opens and question 1 is asked.

- `app/ui/ModeIntro.tsx` and ui.css section 30 (the card; docs/API_UI.md, `ModeIntro`).
- `app/routes/play/controller.ts`: `view.intro`, `INTRO_MS`, `INTRO_LEAVE_MS`, `skipIntro`.
  **Question 1's clock now starts when the card has gone**; before, it started as the page
  arrived, under the opening iris. Nothing is kept in storage until then, so a reload under the
  card starts the same new game. A game carried on, or a finished one, has no card.
- `app/scenes/career.ts`: `holdOpening()`, `beginOpening()`, `waiting` (docs/API_SCENES.md,
  "Held for the mode card").
- Words in `strings.play.intro`. Gallery: `/dev/ui?only=intro-home` and the other three.
- Looked at in Chrome from the home page through to question 1, on a monitor and a phone;
  stills in `.snaps/intro/`.

**Each question is dribbled on** (the same day; the product owner: "for each question can you
add a transition for the question text appearing", then "make it feel more polished by adding
a shine to it as it appears maybe or a football specific type animation"). On the board a
small pixel football runs along the line and the question appears behind it, in reading order
at one even speed (16 ms a character, never more than 0.7 s in all); each word lands gold and
cools to chalk; after the last letter the ball hops, lands and goes out in a four-point glint
(0.4 s more). `typedQuestion` and `TypedQuestion` in `app/ui/Board.tsx`, ui.css section 10,
docs/API_UI.md under `Board`. It is all CSS: every word has its own ball, shown only while
that word types, so nothing is measured and nothing moves. The whole question is in the page
from the start, so a screen reader hears it once. The clock is not held for it. Seen in
Chrome on questions 1 and 2 of a real game, on a phone and a monitor.

Not done, and worth asking about: a sound of its own for the card (the ground's bed is heard
under it, and the iris's whoosh and the whistle follow it as before); whether a player who has
seen it many times should get a shorter one; and a sound for the question's ball (a soft roll, a tap as it lands).

## NEXT-GEN's and RETRO's names on the ball (2026-11-16)

The product owner: "on ball can you show the label for next gen and retro somehow. even if its
not exactly on the patch, i think it will look better like that". Their patches lie far round
the ball, squashed, with room for a small picture only. Each now wears its word on a dark name
tag hanging from the patch over the white panel beside it, the word in the mode's colour
(`tagPlace` and `drawTag` in `app/art/ball.ts`; docs/API_ART.md, "Their name tags"). The tag
rides the ball, takes its button's states, and is its button: the menu hit-tests with its
patches, so the word is hovered and pressed like the patch. Shown only where HOME and AWAY
carry their words (a radius of 74 or more), so the four always match.

Two looks were tried: the word printed straight on the leather in the mode's dark tone, and
the tag. The tag was kept: it is the patches' own dark plate, so the word reads the same
whatever the light does to the leather (printed, RETRO's brown was the weaker of the two), and it
can light up with its patch. Stills in `.snaps/labels/`. Seen in Chrome at rest, hovered, and
on a phone.

**The same plate under HOME and AWAY** (the same day; the product owner: "can home and away
also have that black background as the name tag since all other game modes have it"). Their
words now stand on the name tag's ink plate, inside the patch and clear of its frame
(`wordPlate` in `app/art/ball.ts`), at rest; a lit, pressed or flashing patch has none. The
few other words that were still bare (RETRO when the ball is turned to show it, open or
locked) have it too, so every word on the ball is on a plate. Three fits were tried: inside
the frame, over the frame, and spilling onto the leather like a tag; inside was kept, as the
other two broke the coloured frame for a pixel or two of overhang. On a patch in shadow the
plate is close to the patch's own tone (AWAY's at night).

Not done: tags for HOME and AWAY on a ball too small for their words (they have icons alone
there, as before).

## The tab icon (2026-11-17)

`public/favicon.svg` was a plain green circle. The product owner asked for a football with SS,
turned down a first try (a 16 px ball with SS on its middle patch), and said what it should
be: "a proper football then a big SS in the middle in front of the ball (not within the
football). Make the football look how it does on the home page but smaller and obviously no
icons/text. Then in front of it add a yellow electric font of SS which is taller than the
ball"; then "make the SS italic maybe and slightly smaller"; and, shown letters taller than
the ball, "make the SS smaller, I don't like it". A staircase was then tried at their
suggestion ("so the SS can be closer together") and turned down for the letters side by side:
"no don't staircase. I was happy with this".

- The drawing is `app/art/tab-icon.ts`, 32 x 32: the menu's own ball (`drawBall`, its menu
  pose, by day, nothing on its patches) filling the picture, and in the middle of it two
  italic S's 17 tall (19 with their line of ink), in the palette's gold, lit along the top
  and left of each stroke and shaded along the bottom and right, a glint on each. The ball
  shows all round them: its black patches above and below, its leather either side. They
  stand side by side on one line, ten pixels from one to the next, the least that keeps a
  line of ink between them. (The letters were first the picture's whole height with a 26
  pixel ball behind them, as first asked; they hid the ball and were not liked. The
  staircase, the second letter four pixels lower and three closer, in front of the first,
  was not liked either. Do not bring either back.)
- The S's are round: each is two ovals drawn with a round brush and leaned to the right. They
  are deliberately not jagged bolts: two leaning lightning bolts side by side are the badge of
  the Nazi SS, and an "electric" SS must not drift towards it. A test holds them to curves
  (a flat of a curve at head and foot, and a stroke that doubles back into a hook).
- `tools/favicon.ts` (`pnpm favicon`) writes the file: an SVG that holds the picture as a PNG,
  magnified four times, not as shapes. A tab shows the icon at 16 px, half its size, and as
  SVG rectangles the pixels broke up there (rows dropped with hard edges, seams showing when
  smoothed); as a picture it is averaged down cleanly. At 32 px (a high-density screen) it is
  exact. `app/art/tab-icon.test.ts` decodes the file and holds it to the drawing, pixel for
  pixel.
- The file keeps its name and stays an SVG: the game clock asks the server the time with a
  HEAD request to it.

At a tab's 16 px on an ordinary screen it is soft: a ball and two letters is a lot for 256
pixels. It is crisp from 32 px up.

Not done: PNG versions (an `apple-touch-icon` for a phone's home screen, and a fallback for
any browser that does not take an SVG tab icon). Only the SVG is served, as before, and it
has been looked at in Chrome only.

## Search engines and link previews (2026-11-17)

The product owner: "can you also add meta data to the pages for seo". Each page had a title
and a description and nothing more.

- **One helper.** `app/routes/seo.ts` `pageMeta` makes the tags of every page players are
  sent to (the home page, the four mode pages, the rules): title, description, leave to index,
  and Open Graph tags for a link's preview. The home page adds structured data (the site and
  the game). `docs/ARCHITECTURE.md` section 1 has the rules.
- **Words changed.** The home page's title was "soccersense: daily football trivia, one
  stadium a day" and is "soccersense: the daily football trivia game": the stadium is no
  longer how HOME and AWAY are scored (the weak point noted on 2026-11-11), and a searcher
  learns nothing from it. Its description was 215 characters about HOME and AWAY only, cut
  short in a search result; it is now 152 and names all four ways to play. It is also what
  the page says of itself with scripts off. Each mode page's description now says "football".
- **The preview's picture.** `public/social-card.png`, 1200 x 630: the home scene by day at
  600 x 315, magnified twice, so the wordmark is over a third of the picture's width and reads
  at a thumbnail's size. The airship's sign says DAILY FOOTBALL / TRIVIA in place of the fact
  of the day, which scrolls and would be cut off mid-word in a still. 54 KB.
- **robots.txt** lets every crawler in everywhere. The development pages are not shut out
  there: each says `noindex`, which a crawler that is kept out never reads.
- **An address that is not a page** now has a title ("Offside! · soccersense") and says
  `noindex`: the static host answers it "200 OK" with the one fallback page, and a search
  engine could have listed any mistyped address.
- **Waiting on the site's address.** There is none in the repository. `SITE_URL` in
  `app/routes/seo.ts` is empty, so pages carry no canonical link, no `og:url`, no preview
  picture and no structured data, and there is no sitemap: all of them must be written out
  in full. With a pretend address the built pages were checked to carry every one of them,
  and the sitemap to list the six pages. To switch them on: set `SITE_URL`, run `pnpm seo`.
- `tools/png.ts` gained `decodePng`, which the picture's test and the tab icon's use to hold
  a file to its drawing.

Checked on the built site in Chrome: every page has one of each tag after the script takes
over, the not-found page says `noindex`, and nothing is reported in the console.

Not done: the preview has not been seen in a real chat or feed (it needs a public address);
each mode shares the one picture; no `apple-touch-icon` or web app manifest; whether the host
adds a closing slash to addresses (see the architecture's note) is for when one is chosen.

## The stadium has no name (2026-11-17)

The product owner: "Can you remove the stadium name stuff. The stadium can still change
colour daily but the name isn't mentioned anywhere and shouldn't be mentioned anywhere so
remove code referencing that". It was still mentioned in four places a player could meet,
and carried through the code to reach them:

- **The share text's** first line ended with it (`soccersense #12 · HOME · Anfield`). The
  name is gone from it (and the text was reworded the same day: the next section).
- **The share picture** had it on the right of the badge's line. That line is the badge and
  the day.
- **The game screen** read it out to screen readers under the heading ("Today's stadium:
  Anfield, Liverpool, England."). The line is gone, with its words (`play.stadium`).
- **The sentences kept for CLOSEST and FURTHEST** took the name ("3 miles from Anfield").
  They say "from today's stadium".

So `Stadium` is an id and a place, nothing more: `name`, `city` and `country` are out of the
type and out of the 21 entries of `app/data/stadiums.ts`, and `ShareCard` has no
`stadiumName`. Tests hold it there: a pin has no other fields, the share picture's content
has no stadium, and the game page never says "Anfield" or "today's stadium".

The old reference picture of the stadium from inside (`app/art/stadium-inside.ts`, not used
by the game) had a scoreboard reading TODAY'S STADIUM over the name and the city. It is kept,
and its board shows the words it is given (`InsideBoardWords`).

What is left, on purpose: the day still has a **pin** (an id and coordinates, rotating
through the 21, and `?stadium=<id>` in development to choose one), because the locked modes
CLOSEST and FURTHEST rank answers by distance from it and the rules for that are built. The
ids are real stadiums' names in lower case; they are never shown. If CLOSEST and FURTHEST are
dropped, the pins, the distance rules and every answer's place can go with them.

The stadium in the home screen's picture was never the pin: its club colours come from the
day's number, and still change every day.

## The share text is two lines: "check out what I got" and where to play (2026-11-17)

The product owner: "In the text that gets copied when you share it, it should also instead
say 'check out what I got on soccersense! Test your football trivia on (link)'". It was
first built with the old summary kept between the two halves, and turned down: "It shouldn't
say all that extra stuff because it's in the image. Only first line and last line". So the
text SHARE copies, and hands to a phone's share sheet with the picture, is:

    Check out what I got on soccersense!
    Test your football trivia on https://...

- **Nothing of the result is in the text.** The day, the mode, the title, the total, the
  tier and the shots are the picture's. The text is the same for every game and mode.
- **The text summary is gone, with its code**: `buildShareText`, `ShareInput`,
  `GRADE_SYMBOLS` (the symbol per question) and `shareInputFor` are out of `~/game`, with
  their tests. The game's side of SHARE is `shareCardFor`, the picture's content.
- **The link** is `shareLink()` (`app/routes/play/share-image.ts`): `SITE_URL` once the
  site's address is set (`app/routes/seo.ts`), and until then the address the game is being
  played at, so it works today wherever the site is served (on a development machine it
  reads `http://localhost:5173`). It is written out in full, "https://" and all, so every
  chat app makes a link of it.
- The words are `strings.play.fullTime.message`; both SHARE buttons (the full-time card's
  and the home screen's) get the text from `shareText(link)` in
  `app/routes/play/names.ts`.
- What the game says after SHARE no longer calls the text "your result": "Picture saved,
  link copied.", "Link copied. Paste it anywhere." and the read-out lines to match.
- Known and left: where no picture can be made at all (a browser with no canvas), the two
  lines are copied on their own, and say nothing of the result.

## The goal show: pyro, flares, confetti and birds (2026-11-17)

The product owner: "Inside the game when a right answer is given and the player scores, can
you make it feel more interactive by having some pyro/flame machines going off and maybe
confetti - I don't know. You decide what makes sense for football". Decided here: the show
grows with the ground, as the career does, so every goal sets something off from the first
question, and the stadium's is the biggest (`app/scenes/career-pyro.ts`,
`docs/CAREER_SCENE.md` section 4).

- **The park and the Sunday pitch (tiers 0, 1)**: no machines there. The cheer puts up the
  birds from behind the goal.
- **A small ground (tiers 2, 3)**: fans here and there in the crowd light flares, each in
  their own time, and their smoke rolls up out of the stand. (First they were evenly
  spaced along one row and all lit together; the product owner: "can the smoke be random
  people in crowd, not the same four people in a row that do it at the exact same time.
  just so it feels more natural".)
- **A stadium (tiers 4 to 7)**: flame jets along the far touchline, off in a wave from the
  goal end; two confetti cannons for a golazo or a worldie. The fireworks over the roof
  (2026-11-11) go with them.
- The better the shot, the more of it: a tap in is two jets once (or two flares, or four
  birds), a worldie every jet three times (five flares, twelve birds).
- RETRO and NEXT-GEN have their own: torches on stakes throwing sparks and red Bengal
  lights; jets of cool plasma and flares of sky light.
- The flares' smoke was drawn twice. The product owner on the first (a line of separate
  white blobs): "i like it all except the white smoke, you cant tell its smoke properly".
  It is now a billowing plume a flare, lit red at its foot, grey with shade down one side,
  leaning with the wind and breaking up at the top (`docs/CAREER_SCENE.md` section 4).
- With reduced motion nothing goes off.
- **Not done: sound.** The show is silent. A whoosh for the jets and a fizz for the flares
  want making and tuning by ear with the product owner.
- Looked at: `career/pyro-<grade>-t<tier>` at 960 x 540 and 260 x 562, by day and at
  night, in the three eras. Tests: `app/scenes/career-pyro.test.ts`.

## Hosting on Cloudflare: the first deploy failed (2026-11-17)

The product owner connected the repository to Cloudflare and the deploy failed:
`[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: workerd@1.20261113.1`, then "Failed: error
occurred while running deploy command".

- **Why.** The repository had no Wrangler configuration, so `npx wrangler deploy` set the
  project up by itself: it added wrangler as a dependency with pnpm, and pnpm 11 stops an
  install when a package's build script (workerd's) is not allowed.
- **The fix.** `wrangler.jsonc` is in the repository, so there is no automatic setup: a
  Worker with no code serving `build/client`. `pnpm-workspace.yaml` allows workerd's
  script as well. `pnpm build` now also writes `404.html` (`tools/not-found.ts`), the page
  for an address that is not one. `docs/ARCHITECTURE.md`, "Hosting".
- **Not run here**: no deploy was made from this machine (wrangler is not installed: the
  disk has under 2 GB free). The keys are Cloudflare's documented ones, and the build was
  run and its output looked at.
- **For the product owner in the dashboard**: the build command is `pnpm build`; the
  Worker's name must be `soccersense` (or `name` in `wrangler.jsonc` changed to match).
- Once the site has its address, `SITE_URL` (`app/routes/seo.ts`) and `pnpm seo`.

## The backend's first step: the API, its database, the site's address (2026-11-17)

The product owner asked how to start the Cloudflare backend, then answered three questions:
the day's questions will come from AI, drafted a week at a time, approved and scheduled, and
only behind a feature flag while the game is in testing; disk space was freed; and the
domain is soccersense.io. Built so far (`docs/ARCHITECTURE.md` section 8):

- The Worker has code: `worker/` answers `/api/*`, and everything else is still served
  straight from the build. `GET /api/today` is the day by the server; `GET /api/health`
  says whether the database is up to date.
- A D1 database, bound as `DB`, made by Cloudflare on the first deploy. The Worker applies
  its own numbered migrations on the first request, so nothing is run by hand.
- The game's clock reads `/api/today` (`x-server-time`, to the millisecond), and the
  `Date` header where there is no API.
- The flag `QUESTIONS` is `sample`. Nothing reads `scheduled` yet.
- `SITE_URL` is https://soccersense.io and `pnpm seo` has been run: the canonical links,
  `og:url`, the preview's picture, the structured data and `public/sitemap.xml` are on.
  The share text's link is the site's address.
- Wrangler is a development dependency; `pnpm api` runs the Worker locally.

Checked: the Worker run locally under Cloudflare's own runtime (`wrangler dev`): the API's
answers, a page, a page with a closing slash (sent to the one without), an address that is
not a page (the Offside! page, 404). The live site was looked at before this was pushed: it
serves at soccersense.io as configured. **Seen on Cloudflare after the push** (2026-11-17):
`/api/health` answers `{"ok":true,"db":2,"schema":2}`, so Cloudflare made the database from
the binding alone and the Worker migrated it; `/api/today` answers; `/dev/sound` is a 404;
the approval desk answers 503 until `ADMIN_TOKEN` is set.

Next, in order: the question pipeline (draft, approve, schedule), games run by the server,
the leaderboard, accounts.

## The development pages are for development; the question pipeline's foundation (2026-11-17)

- The product owner: "why can i access links like /dev/sound on prod. i thought that was for
  dev only". They were ordinary pages that asked not to be indexed, so they were built and
  deployed. `app/routes.ts` now leaves `/dev/ui`, `/dev/sound` and `/dev/stage` out when
  the site is being built (by the command, `react-router build`: typegen also runs as
  "production" and must still see them). The dev server and the tests have them as before.
- The question pipeline's decisions (the product owner): all 196 questions a week will be
  approved by hand; the weekly draft runs on their Claude account as a scheduled skill, not
  through the Claude API.
- Built (`docs/ARCHITECTURE.md` section 8): `checkQuestion`, the rules a drafted question
  must pass; the table the questions are kept in, a place for each of a day and mode's
  seven; and the approval desk's API behind an admin token. Tried locally under
  Cloudflare's runtime: a draft sent, looked at and approved.
- Next: the approval page, the drafting skill and its schedule, then games run by the
  server (which is what plays the scheduled questions when the flag is switched).
- Suggested and not decided: an LLM as the judge's second opinion for an answer it does
  not know (Claude Haiku through the API, on the server, each new spelling ruled on once
  and remembered). It needs the server-run games first.

## The approval page (2026-11-17)

The product owner: "what is the approval page link?". There was none: only the API. It is
`/admin` now (`docs/ARCHITECTURE.md` section 8): sign in with the admin token, see the
week, open a day and mode, approve, reject with a reason, or correct each question.

- Looked at in Chrome against the Worker run locally with sample drafts loaded: signing in,
  the week's table, a day's questions, the answers, approving one. No console errors.
- Its words are `strings.admin`. Its tests stand in for the API
  (`app/routes/admin.test.tsx`).
- For the product owner before it can be used: the secret `ADMIN_TOKEN` in Cloudflare.
- Seen and left: the game's click sparks play on this page too (they are the root's);
  approving or rejecting a question closes its list of answers.
- Next: the drafting skill and its weekly schedule.

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
