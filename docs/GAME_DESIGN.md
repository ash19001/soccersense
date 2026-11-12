# soccersense: game design (iteration 1, frontend demo)

This is the product brief for the first playable build. It is frontend only: there is no
backend, the question data is a small built-in sample, and the goal of this iteration is that
the game **looks and feels right**. Graphics come first.

## 1. The game in one paragraph

A daily football trivia game. Every day has one stadium, "today's stadium": the day's venue,
shown on the home screen and named on the scoreboard. The player picks a mode on the home screen
and answers 7 typed questions against a 30 second clock. Every valid answer has a **popularity**:
the share of players who give it. In **HOME** you want the _most common_ answer, the one most
players give. In **AWAY** you want the _most uncommon_ one, the valid answer fewest players
think of. Each answer is one of six shots, from a miss (0) to a worldie (100), a game is out of
700, and the running total drives a footballer's career from a kickabout in the park to
lifting the World Cup. At full time the total also earns the player a title (section 6).

(Changed on 2026-11-11. HOME and AWAY used to be "closest to today's stadium" and "furthest from
it". Those two rules are kept, as the locked modes **CLOSEST** and **FURTHEST** on the back of
the ball; **NEXT-GEN** and **RETRO** are locked too, on its top and bottom patches.)

## 2. Daily structure

- The day changes at midnight UTC, for everyone at once. `dayNumber` counts whole UTC days from
  2026-11-10, which is day 1.
- One stadium per day, shared by every mode: the day's venue, drawn on the home screen and named
  on the board. In the demo it rotates through `app/data/stadiums.ts`: index
  `(dayNumber - 1) mod count`. Anfield is first. It does not score HOME or AWAY; it will be the
  scoring pin of CLOSEST and FURTHEST when they are switched on (every answer keeps a place on
  the map for them: where a player was born, a club's ground, a stadium, a country's capital).
- Each mode has its **own** 7 questions, so the reveal in one mode never gives away the other.
  The demo ships one fixed set per mode.
- Popularity is a share of players in percent, at most one decimal place, and the shares of a
  question add up to about 100. There is no backend yet, so in the demo it is an **estimate**
  built into the sample questions (method: `docs/data-notes/popularity.md`). A backend will
  count the answers real players give and replace the estimates.
- Debug overrides (query string, demo only): `?stadium=<id>`, `?day=<n>`, `?time=HH:MM`
  (forces the sky's time of day), `?notimer=1`.

## 3. One question, start to finish

1. The board shows `Question 3 of 7`, the mode's badge, the question and two short lines (not
   the day's stadium: the question has the room; changed 2026-11-11):
   - HOME: `The most common answer wins.` plus `Scored by how many players give the same answer.`
   - AWAY: `The most uncommon answer wins.` plus `Scored by how few players give the same answer.`
2. A 30 second timer runs. The player types an answer and presses **SHOOT** (Enter also works).
3. The judge checks the answer against the question's answer list (names plus aliases, accents
   and case ignored, small typos forgiven).
   - Not recognised: the input shakes and says `Not on the teamsheet. Try another.` The clock
     keeps running. There is no penalty and no limit on tries.
   - After 8 seconds a **PASS** button appears. Passing scores 0.
   - Clock hits zero: `TIME'S UP`, 0 points.
4. Recognised answer: the footballer takes a shot, the answer's own (see 4): a worldie, a
   golazo, a trivela, a toe poke, a tap-in or a miss.
5. The career meter fills. If the total crosses a threshold he is promoted and the ground changes.
6. The reveal sheet slides up: which shot it was and its points (`WORLDIE! +100`,
   `TAP IN +10`, `MISS` with no points), one plain sentence saying how many players gave that
   answer and what that made it, and **the table**: always five rows, one for each shot that
   scores, best first (WORLDIE 100, GOLAZO 80, TRIVELA 60, TOE POKE 30, TAP IN 10; a miss is
   never a row), each with its share (`PICKED`), its shot as a tag in the shot's colour
   (`SHOT`), its points and its place in the full table (`#`). Then **NEXT QUESTION**, or
   **FULL TIME** after question 7.
   - When the player's answer scored, it is the row for its own shot, highlighted with the
     **YOU** tag. Each other row is an answer they could have given for that shot: the shot's
     best answer, the one ranked highest in the full table (in HOME the most picked answer in
     the shot, in AWAY the least picked), so the WORLDIE row is always #1 and the same
     question always shows the same answers. (Changed on 2026-11-12: it used to be the most
     picked in both modes, which in AWAY left the deepest cut named after a pass off screen.)
   - When it did not score (a listed answer that is a miss, a pass or a time-up), the five
     rows are what they could have given, and their own answer and its 0 stand on one line in
     the miss colour under the sentence (`YOU Blackburn Rovers 2% MISS 0`, or
     `YOU NO ANSWER PASSED 0`): above the table on a phone, in the left column on a wide
     screen. Never as a sixth row. (An answer that is not on the list never ends a question: the bar turns it
     down and the clock runs on, so it reaches the reveal only as a pass or a time-up.)
   - No other answers are listed. The rule is `revealRows` in `app/game/reveal.ts`; every
     question has at least one answer in each shot that scores, which the data tests keep. A
     question that ever lacked one would show the rows it has.
   - (Changed on 2026-11-12, at the product owner's request: "it should show your answer and
     the points it got and every other answer you could've given for the other tiers. so
     overall there must be 5 answers showing." The table used to list every answer, cut down
     to an excerpt with gaps on a long list.)
   - The sentence gives the share, `about 32%` for an answer at least 2% of players gave and
     `only 0.2%` under that, then one line for the shot in the mode's tone. HOME:
     `Lionel Messi: about 32% of players said the same. The whole ground was with you. Worldie!`
     down to
     `Allan Simonsen: only 0.2% of players said the same. Right answer, but the crowd went elsewhere.`
     AWAY: `Chile: only 0.9% of players went for that one. Nobody saw it coming. Worldie!` down to
     `Sevilla: about 16% of players said the same. Right answer, but busy round here!`
     (every line: `strings.play.sentence` in `app/i18n/en.ts`).
   - A pass or a time-up names the top of the table instead: the crowd's favourite in HOME, the
     deepest cut in AWAY.
   - After each name the table shows the answer's country, unless every answer shares one (the
     Premier League's clubs) or the answers are countries themselves.

## 4. Scoring

(Changed on 2026-11-11, at the product owner's request: "instead of fully dynamic points it
should be tiers". Points used to come from the answer's place in the table, 0 to 100 on a
sliding scale. The six shots were renamed the same day, at the product owner's request; the
points did not change.)

### 4.1 The six shots

Every answer in a question's list is filed under one of six **shots**, and a player scores
their answer's shot. Many answers can share a shot.

| id        | points | label     | what it means in HOME / AWAY                                    |
| --------- | ------ | --------- | --------------------------------------------------------------- |
| `worldie` | 100    | WORLDIE!  | the whole ground's answer / nobody saw it coming, shown in gold |
| `golazo`  | 80     | GOLAZO!   | near the top of the crowd's list / well off the beaten track    |
| `trivela` | 60     | TRIVELA   | a good crowd pick / not many saw it coming                      |
| `toepoke` | 30     | TOE POKE  | some of the crowd went that way / a few got there too           |
| `tapin`   | 10     | TAP IN    | most of the crowd went elsewhere / plenty got there first       |
| `miss`    | 0      | MISS      | a right answer, but hardly anyone's / everybody's               |
| `timeup`  | 0      | TIME'S UP | no answer: the whistle went                                     |
| `skipped` | 0      | PASSED    | no answer: passed                                               |

A worldie is a wonder goal (the footballer plays it as a bicycle kick), a golazo a beauty
curled in, a trivela a shot bent with the outside of the boot, a toe poke a scrappy finish off
the end of the boot. Every shot but the miss is a goal, and the footballer plays each one as
itself (the career scene: `docs/CAREER_SCENE.md` section 4). In code: `SHOT_POINTS` and
`SHOT_ORDER` in `~/game`.

**Which answer is which shot** is part of the question's data (`Answer.shot`), filed for the
question's own mode: in a HOME question the most common answers are the worldies, in an AWAY
question the most uncommon. The sample answers were filed by a rule and then looked at by
eye (`docs/data-notes/shots.md`); a backend will run the same rule (`shotsFor`) on real answer
counts. The rule, in short: each answer's **standing**, from 0 for the best answer to 1 for
the worst, is the mean of its place (the share of the other answers that are better) and its
gap from the best (in ratios of shares); bands of standing give the shot (worldie up to 0.10,
golazo 0.25, trivela 0.42, toe poke 0.58, tap in 0.80, miss above). The best answer is always
a worldie, the worst a miss, and a more popular answer is never a worse HOME shot (the
reverse in AWAY).

### 4.2 The table

Each mode is scored by a **rule** that ranks the question's answers, best first:

| rule       | used by           | best answer                       |
| ---------- | ----------------- | --------------------------------- |
| `common`   | HOME              | the highest share of players      |
| `niche`    | AWAY              | the lowest share of players       |
| `closest`  | CLOSEST (locked)  | the place nearest today's stadium |
| `furthest` | FURTHEST (locked) | the place furthest from it        |

(The rule `niche` keeps its id in code; every word a player sees says **uncommon**.)

The table lists the answers by shot, worldies first, and within a shot by the rule. Shares
are compared to a tenth of a percent, distances in whole kilometres (great-circle,
`Math.round`). Answers with the same shot that compare equal are tied and share a rank.

In AWAY every valid answer is in the table, so the most uncommon answer is still a real one:
nobody scores for an answer that is not on the list.

The distance rules have no shots in the data: their shots come from the same standing and
bands, with the gap measured in kilometres from the best place. They are tested and ready for
when CLOSEST and FURTHEST are switched on.

Shares are shown as `34%`, `2.5%`, `0.4%`. For the distance rules, distances are shown in miles
for `en-GB` and `en-US` locales and in kilometres otherwise.

## 5. The career

The running total (0 to 700) is the footballer's career. Every 90 points is one step up, so an
excellent answer is roughly one promotion.

| tier | from points | name             |
| ---- | ----------- | ---------------- |
| 0    | 0           | PARK KICKABOUT   |
| 1    | 90          | SUNDAY LEAGUE    |
| 2    | 180         | NON-LEAGUE       |
| 3    | 270         | LOWER LEAGUES    |
| 4    | 360         | TOP FLIGHT       |
| 5    | 450         | INTERNATIONAL    |
| 6    | 540         | WORLD CUP FINAL  |
| 7    | 630         | WORLD CUP WINNER |

Tier 7 can only be reached on the last question, so it is the end screen: the trophy lift.
A perfect 700 adds a `PERFECT GAME` line.

The two modes tell two different stories with the same ladder.

### 5.1 HOME: the hometown hero

The common answer is the crowd's answer, and he is the crowd's man. Everything happens in one
place, and the ground grows around him. The same pitch, the same
row of houses behind it, slowly hidden by the stands he fills.

| tier | the ground                                                                 |
| ---- | -------------------------------------------------------------------------- |
| 0    | The park. Jumpers for goalposts, mates, a dog, a bench, the houses behind  |
| 1    | Real (wonky) goals, painted lines, a rope, a few parents, a changing hut   |
| 2    | One small covered stand, a tea hut, a fence with boards, floodlight poles  |
| 3    | Proper stands, a terrace of a few thousand, a scoreboard, real floodlights |
| 4    | A full two-tier stadium, packed, camera gantry, LED boards                 |
| 5    | The same stadium in national colours: flags, banners, anthem line-up       |
| 6    | World Cup final on home soil, at night: flashes, giant flags               |
| 7    | He lifts the trophy at home. Confetti, fireworks, the whole town there     |

He wears the home kit (warm red-orange). The crowd wears his colours.

### 5.2 AWAY: the journeyman

The uncommon answer is the road less travelled, and so is his career: every step up is a ground
further from home. Between tiers a small vehicle crosses the screen
(coach, then ferry, then plane) with a `NEXT STOP` caption.

| tier | where                                                                        |
| ---- | ---------------------------------------------------------------------------- |
| 0    | The same park. The team coach is waiting by the gate                         |
| 1    | A cold, wet away night up the road: rain, chimneys, pylons, a few hardy fans |
| 2    | Across the water: a harbour town, cranes, a ferry, gulls                     |
| 3    | Southern sun: a Mediterranean coast at dusk, palms, white houses, flares     |
| 4    | Mountain air: an alpine ground, snow falling, pines, an orange ball          |
| 5    | Desert heat: dunes, palms, glass towers, a hard white sun                    |
| 6    | World Cup final on another continent, at night: hillside lights, ticker tape |
| 7    | He lifts the trophy abroad. Fireworks over a foreign skyline                 |

He wears the away kit (teal). The crowd is hostile: the other team's colours, with one small
pocket of travelling fans in teal.

The stand and pitch build-out per tier is shared by both modes. Only the backdrop, weather,
crowd colours and kit differ.

## 6. Screens

### 6.1 Home screen

- The picture is composed for **a PC monitor first** (a wide screen); phones come second.
- The picture is **a football stadium seen from the air**, like a drone photograph: looking down
  at an angle on the whole oval ground, big and in the middle of the screen, with the pitch and
  the crowd visible inside it. The product owner's reference photograph is described in
  `docs/PROGRESS.md`. It is not a view from the pitch, and not a view from ground level.
- **Everything is seen from that one viewpoint.** The town around the stadium is drawn from the
  air too, and it gets as much thought as the stadium: roads and traffic, car parks full of
  cars, streets of housing with gardens, trees and bushes, a park, people arriving for the
  match. It runs away to a horizon about a quarter of the way down the screen, where **a city
  skyline** stands in silhouette.
- **The car parks are full of parked cars**, each along its bay (on the slanted bays too). They
  are part of the background: no car drives in or out of a car park (the product owner,
  2026-11-11: the parking animation looked wrong, so it went). The rest of the picture is
  alive: traffic on every road, each car facing the way it goes, supporters walking in (fewer
  at night), coaches, a train. A car and a person are never on the zebra at the same time.
- **A match is being played inside the stadium**: a looped animation of two teams of tiny
  players and a ball on the pitch, with the crowd reacting to the big moments.
- **The top is all sky**, with the logo in it.
- In front of the picture floats a classic black and white football. **The ball is the menu**,
  the focus point of the screen: it hovers and does not rest on the ground. Its black patches
  are the options.
- The two big patches facing the player are **HOME** (left, the house, warm red-orange: the most
  common answer wins) and **AWAY** (right, the aeroplane, teal: the most uncommon answer wins).
- Six more patches are **locked modes**, each with its own picture and a small padlock, in
  quiet greys so that HOME and AWAY lead: **NEXT-GEN** on the patch above (a fast-forward: the
  future), **RETRO** on the patch below (a rewind: the past), on the back of the ball, directly
  behind AWAY and HOME, **CLOSEST** (a map pin) and **FURTHEST** (a globe): the old distance
  rules, closest to today's stadium and furthest from it; and on the rim, a quarter turn round
  out past HOME and past AWAY, **GUESS WHO** (the back of a shirt with its number) and
  **SHOOTOUT** (a goal with a ball on the spot). Half a turn of the ball brings CLOSEST round to
  where HOME was and FURTHEST to where AWAY was; a quarter turn to the right brings GUESS WHO
  to the front, a quarter turn to the left SHOOTOUT.
- The two newest are future modes (the product owner, 2026-11-11), locked until they are built:
  - **GUESS WHO**: the player sees the back of a shirt, a name and a number, and fills in the
    missing details about the player who wore it.
  - **SHOOTOUT**: a penalty shootout of questions, played on lives instead of against the clock.
- The ball can be spun by hand. Let go, it comes to rest: if a locked patch faces the player most
  it turns to show it (NEXT-GEN, RETRO, GUESS WHO or SHOOTOUT straight on, CLOSEST and FURTHEST
  side by side) and stays about four seconds, long enough to read it and press it, then goes
  back to HOME and AWAY. Each locked patch shows its word when it faces the player. Pressing one shakes the ball
  ("no") and puts up a notice naming the mode ("RETRO kicks off soon.", or for the two future
  modes a line on what they will be) for 2.5 seconds, which screen readers hear too. HOME and
  AWAY can be chosen from any pose in which they are in view.
- The ball is heard: a light touch when the pointer comes onto it or presses it, wind while it
  spins (louder the faster), and the strike when a mode is chosen, then wind as it flies; HOME's
  ball lands to a roar and a blast of horns, AWAY's whistles away into the distance.
- An airship drifts over the town with a dot-matrix sign on its flank: `DID YOU KNOW?` in
  green and under it **a fun football fact of the day** in amber, scrolling (the product owner,
  2026-11-11: "The blimp should now say just a fun football daily fact instead"). It used to
  show today's stadium; the stadium now belongs to the game screens. Sixty fact-checked facts
  in a fixed cycle, the first on day 1 (2026-11-10): `app/data/facts.ts`, notes in
  `docs/data-notes/facts.md`. The fact starts at its beginning and rests a moment, then
  scrolls at a steady reading pace (a whole fact passes in 17 to 28 seconds) and comes round
  again. Screen readers hear "Fact of the day: ...". The airship can be clicked: it wobbles,
  five or six quick clicks pop it, it crashes into the town, and a new one drifts in with the
  same fact, from its start.
- The sky is the player's own sky: day, dusk, night or dawn, worked out from their device clock
  and time zone (no location permission prompt). At night the floodlights are on.
- Under the ball: one line per mode (`HOME: the most common answer wins`,
  `AWAY: the most uncommon answer wins`), a `?` how-to-play button, and the day number.
- Choosing a patch: it lights up in the mode's colour and the ball is struck. HOME: it drops
  into the stadium, onto the pitch, and the ground erupts. AWAY: it sails away over the town
  and out of sight. Then the screen wipes into the career scene.
- A mode already played today shows its score on its patch. The demo allows replays.
- **Today's leaderboard** (the product owner, 2026-11-11: "leaderboard in home screen (just
  mock data for now)"): today's top ten for HOME and for AWAY, a tab each, every row a rank, a
  handle and a total out of 700, the leader in gold, and under it how many played today
  ("1,137 played today"). A player who has played the mode today is in its table as **YOU**,
  at their rank (first among equal totals): highlighted in place if they made the top ten,
  otherwise under it after a gap ("289 YOU 420"). The tab shown first is the mode they played,
  if they played only one. On a monitor it is a bolted scoreboard panel standing on the right
  of the picture over the park, always open, level with the airship on the other side of the
  logo (higher on a short screen, so it stays clear of the captions), and it slides away with
  the captions at the kick-off. On a phone a gold trophy button above the "?" button opens it as
  a sheet over the lower half of the screen. The players are **mock data**
  (`app/data/leaderboard.ts`): a few hundred to about 1,900 invented players a day per mode,
  with light-hearted handles built from football words and first names ("NutmegNina",
  "Row Z Rita", "TifoTony94"; nothing about real people, clubs or nations) and totals that are
  sums of seven shots (0, 10, 30, 60, 80 or 100 each): mostly in the 300s, a handful in the
  600s, a 700 about one day in thirty. A backend replaces it behind the same function.

### 6.2 Game screen

- The career scene fills the screen (canvas).
- Top: the **board**, styled as a stadium scoreboard. Mode badge, seven result pips, total
  points, career tier with a small progress bar, the question, the instruction line, the timer.
  It does not name the day's stadium (the product owner, 2026-11-11: "no need for that
  detail"); the room goes to the question. The stadium is still read out under the page's
  heading.
- Bottom: the answer bar. Text input and the SHOOT button. PASS appears after 8 seconds.
- While he waits the footballer does keepie-uppies. Team-mates and a keeper idle around him.

### 6.3 Reveal sheet

Slides up from the bottom and covers at most the lower 46% of the screen so the scene stays
visible. A header band in the shot's colour (`GOLAZO!` and `+80`), the sentence, the player's
own answer on a line in the miss colour when it did not score, the table (five rows, one per
shot that scores; see section 3, step 6), the next button. The five rows and the headings fit
without scrolling at 1920 x 1080, 1366 x 768 and 390 x 844 for the sample questions; a long
name that takes two lines can make the table scroll by a few pixels on a phone, with the
worldie row pinned under the headings.

### 6.4 Full time

The final tableau for the tier reached, `FULL TIME`, the career tier reached, the total out of
700 and, big under it in the mode's colour, the **title** the total earned; the seven pips with
each answer and its shot, and three buttons: SHARE (copies a text summary, title included),
play the other mode, back to the menu.

The titles (the product owner, 2026-11-11: "based on total points ... it should also give you
an appropriate title"): a ladder of ten a mode, in the matchday voice, funny and never mean,
nothing named after a real award, trophy, club or person. HOME's are the crowd's favourite
(going with the room), AWAY's the scout of the obscure (deep cuts, hipster picks). The rungs
are the same for both modes (`titleFor` in `~/game`; the words in `strings.play.titles`), at
most 20 characters so a title is one line on a monitor:

| total      | HOME                 | AWAY                 |
| ---------- | -------------------- | -------------------- |
| 0          | IN THE WRONG END     | ONE OF THE HERD      |
| 10 to 110  | STILL FINDING A SEAT | READS THE BACK PAGES |
| 120 to 210 | QUEUING TO GET IN    | WATCHES HIGHLIGHTS   |
| 220 to 290 | PIE QUEUE REGULAR    | OWNS ONE RETRO SHIRT |
| 300 to 370 | SEASON TICKET HOLDER | THIRD KIT COLLECTOR  |
| 380 to 450 | KNOWS ALL THE CHANTS | FANZINE SUBSCRIBER   |
| 460 to 530 | STARTS THE CHANTS    | LOWER-LEAGUE SCOUT   |
| 540 to 610 | VOICE OF THE TERRACE | KNEW THEM FIRST      |
| 620 to 690 | CROWD WHISPERER      | DEEP CUT SPECIALIST  |
| 700        | THE HIVE MIND        | HIPSTER'S HIPSTER    |

### 6.5 How to play

The `?` button on the home screen opens the rules as a pop-up over the menu (the page is not
left): the heading, one line (`7 questions a day. 30 seconds each.`), POINTS (the six shots
and their points) and YOUR CAREER (the eight steps from PARK KICKABOUT to WORLD CUP WINNER).
It names no mode: each mode's rule is on the home screen and the board. Close, Esc or a
click outside shuts it, and the focus goes back to `?`. On a phone it is a bottom sheet sized
to its content. `/how-to-play` stays as a page with the same card, for old links and readers
without script. (Changed on 2026-11-12: it used to be only that page; the HOME and AWAY rules
were dropped from it at the product owner's request.)

## 7. What is deliberately not in this iteration

Backend, accounts, real daily content, real leaderboards (the home screen's is mock data),
streaks, payments, analytics, other languages, more categories. (Drag-to-spin on the ball
and sound were on this list; the product owner asked for both on 2026-11-11 and they are
built.) The code should leave room for them but must not build them.

## 8. Originality

The format (seven typed questions, a clock, graded answers, a daily rhythm) is a genre. The
name, theme, scoring idea, artwork, characters, wording and interface are our own. Do not copy
the look, art, mascot, wording or question content of wonderhop.io or any other game. No real
club crests, kit designs, sponsor logos or trophy designs: kits are plain colours and the trophy
is a generic gold cup.
