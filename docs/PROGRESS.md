# Build progress (iteration 1)

Updated 2026-11-11. This file says what exists, what is in flight and what comes next, so the
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
HOME grounds until Milestone C. Not yet committed since `0db2e54`.

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

## Working notes

- The machine's C: drive runs nearly full. Check free space before a multi-agent round, and
  write only inside the repository.
- The code is on GitHub (`origin`, branch `main`). First commit `0db2e54` on 2026-11-11, at the
  end of Milestone A. Commit and push only when the product owner asks.
- The losing attempts from the art round (two balls, three stadiums) are in scratch folders on
  D: (`D:\ss-ball-a-tmp`, `D:\tmp\soccersense-ball-b`, `D:\claude-scratch`,
  `D:\claude-scratch-stadium-b`, `D:\soccersense-stadium-c-scratch`, `D:\soccersense-logo-scratch`).
  Stadium attempt B has a perspective sweep for wide screens that may be worth borrowing.
