# soccersense: game design (iteration 1, frontend demo)

This is the product brief for the first playable build. It is frontend only: there is no
backend, the question data is a small built-in sample, and the goal of this iteration is that
the game **looks and feels right**. Graphics come first.

## 1. The game in one paragraph

A daily football trivia game. The stadium on the home screen changes its colours every day; it
has no name, and nothing in the game says which stadium it is. The player picks a mode on the home screen
and answers 7 typed questions against a 30 second clock. Every valid answer has a **popularity**:
the share of players who give it. In **HOME** you want the _most common_ answer, the one most
players give. In **AWAY** you want the _most uncommon_ one, the valid answer fewest players
think of. Each answer is one of six shots, from a miss (0) to a worldie (100), a game is out of
700, and the running total drives a footballer's career from a kickabout in the park to
lifting the World Cup. At full time the total also earns the player a title (section 6).

(Changed on 2026-11-11. HOME and AWAY used to be "closest to today's stadium" and "furthest from
it". Those two rules were kept, as the modes **CLOSEST** and **FURTHEST** on the back of the
ball, locked until 2026-11-18; **NEXT-GEN** and **RETRO** were locked too, on its top and bottom
patches, until 2026-11-13.)

**RETRO and NEXT-GEN** (2026-11-13; the product owner: "It's the same as home and away in the
sense that it's general questions and you slowly progress from park to World Cup. However,
retro rewards based off the oldest answer and next gen is rewarded based off most recent
answer. E.g. name a team who won champions league: retro best answer would be first ever team
to win it and next gen best answer would be the team that won it most recently."). Every valid
answer to their questions has its **years**: each year that makes it valid (a title, a final, a
tournament hosted). In **RETRO** the answer whose _first_ year is the earliest wins (a club
with several titles counts its first); in **NEXT-GEN** the one whose _last_ year is the latest
(a club counts its most recent). Answers from the same year tie. Everything else plays exactly
as HOME and AWAY: seven questions, the clock, the six shots, the career, the titles. Their own
look (old kits and grounds for RETRO, everything futuristic for NEXT-GEN) comes later; for now
they use HOME's scenery. Their questions and years: `app/data/questions/retro.ts`,
`next-gen.ts`, sources in `docs/data-notes/retro-next-gen.md`. Their pages are `/play/retro`
and `/play/next-gen`. Each mode has its colour, on its badge, the board, the reveal, the
full-time card, the share picture and the stats: HOME warm red-orange, AWAY teal, RETRO old
gold (a sepia-warmed brass), NEXT-GEN electric magenta, CLOSEST green, FURTHEST periwinkle.

**CLOSEST and FURTHEST** (open since 2026-11-18; the product owner: "this should work very
similar to home and away except in the transition title screen it should also say what the
location/stadium etc is. this should also be clearly and obviously visible within the game so
they can always see it"). Each day has a **place** on the map: a stadium, a city or a landmark
(the product owner's choice: "Stadiums, cities and landmarks"), never two days running of one
kind, each at least 2,000 km from the next. Since 2026-11-19 each day's is drafted with the
week's questions and approved like them (the product owner: "i dont want fixed places because
eventually questions will get repetitive so it should also be generated"); a day with none
approved, or with the sample questions on, has its turn of a fixed 30 (`app/data/places.ts`;
sources in `docs/data-notes/places.md`).
Every valid answer has a place of its own, and the question says which ("Measured by where the
player was born": a player's or a manager's birthplace, a club's ground, a stadium, a country's
capital). In **CLOSEST** the answer whose place is nearest the day's place wins; in
**FURTHEST** the one furthest from it, by great-circle distance. The shots come from the same
standing and bands as the other modes', the gap measured in kilometres from the best place,
worked out from the day's place as the game is played. Everything else plays as HOME does:
seven questions, the clock, the six shots, the career, titles of their own.

- **The day's place is named in these two modes**, unlike the home screen's stadium (section
  2): on the mode's title card ("CLOSEST / GIVE THE ANSWER NEAREST TO / WEMBLEY, LONDON"), on a
  plate on the board for the whole game ("TODAY'S PLACE Wembley, London"), on the map's pin, in
  the reveal ("Lionel Messi: 1,266 miles from Maracanã") and on the full-time card.
- **The scenery is a pixel world map** (the product owner's choice of the ideas offered, "Pixel
  world map"): the land in the day's light, the pin on the day's place, its name on a plate
  over it, always below the board (2026-11-18: it had run into it), with rings round it (in
  FURTHEST round the far side of the world, the place's antipode, marked with an X). Each
  answer is a ball kicked from the pin along the great circle; it lands on the answer's place,
  its distance counted up beside it, and a marker in its shot's colour stays where it came
  down. The camera pulls back (or goes in) to hold the pin and the landing, and comes home on
  the next question (`MapScene`, `app/scenes/map.ts`). The map is the ground at any scale,
  from the town round the place to the globe, and the career plays on it (section 5.3).
- In the table the distance is short ("1,266 mi"); in the sentence it is whole ("1,266 miles").
- Their pages are `/play/closest` and `/play/furthest`. They are free, like the other four
  (the product owner, 2026-11-18: "for now it will always be free but when game is popular i
  might but it behind the membership").
- Their sample questions (testing only, until the weekly drafts have their own) are seven of
  the other modes' sample questions each whose answers are spread over the world
  (`app/data/questions/distance.ts`).

## 2. Daily structure

- The day changes at midnight UTC, for everyone at once. `dayNumber` counts whole UTC days from
  2026-11-10, which is day 1.
- The day is the site's server's, not the device's (2026-11-15): turning the phone's clock on or
  back does not open another day's game. The page reads the time from the `Date` header of a
  request to its own address, and a game does not start until it has (`gameClock`, docs/API_UI.md).
- **The stadium has no name** (the product owner, 2026-11-17: "the stadium can still change
  colour daily but the name isn't mentioned anywhere and shouldn't be mentioned anywhere";
  CLOSEST and FURTHEST name the day's place, section 1, and only they do).
  The stadium in the home screen's picture is the art's own, in club colours picked by the
  day's number. No screen, share, picture or read-out says which stadium a day's is, and
  nothing in the data or the interface text holds a stadium's name, city or country.
- One pin per day, shared by every mode: the day's place, approved for the day
  (`worker/questions/places.ts`), or else the fixed list's (`app/data/places.ts`, which
  `app/data/stadiums.ts` hands on as `STADIUMS`), index `(dayNumber - 1) mod count`. It
  does not score HOME, AWAY, RETRO or NEXT-GEN; it is the scoring pin of CLOSEST and FURTHEST
  (every answer keeps a place on the map for them: where a player was born, a club's ground, a
  stadium, a country's capital), which call it "today's place" and give its name.
- Each mode has its **own** 7 questions, so the reveal in one mode never gives away the other.
  The demo ships one fixed set per mode.
- Popularity is a share of players in percent, at most one decimal place, and the shares of a
  question add up to about 100. Each question carries an **estimate** of it, written with it
  (method: `docs/data-notes/popularity.md`): the foundation, "what fans would naturally
  say". In HOME and AWAY the answers accounts give that day add weight to it as the day goes:
  at most about a third of a share (decided 2026-11-16, built 2026-11-18; the rule and its
  numbers are in docs/ARCHITECTURE.md section 8). Every player is scored on the shares as
  they stand when they answer, and the score never changes afterwards.
- Debug overrides (query string): `?stadium=<id>`, `?day=<n>`, `?time=HH:MM` (forces the sky's
  time of day), `?notimer=1`. `?day=`, `?stadium=` and `?notimer=` change the game itself, so
  they work in development builds only (`gameSearch`); a production build ignores them.

## 3. One question, start to finish

Before question 1 of a new game, the **mode card** (6.2): the mode's name and the one thing
to do in it, for about two and a half seconds. No clock runs while it is up.

1. The board shows `Question 3 of 7`, the mode's badge, the question and two short lines (not
   the day's stadium: the question has the room; changed 2026-11-11). The question is
   dribbled on (2026-11-16; the product owner: "for each question can you add a transition
   for the question text appearing", then "make it feel more polished by adding a shine to it
   as it appears maybe or a football specific type animation"): a small football runs along
   the board's screen and the letters appear behind it, in reading order, each word landing
   gold and cooling to chalk; after the last letter the ball hops, lands and goes out in a
   glint. The question is whole within 0.7 s; the clock runs meanwhile. The two lines:
   - HOME: `The most common answer wins.` plus `Scored by how many players give the same answer.`
   - AWAY: `The most uncommon answer wins.` plus `Scored by how few players give the same answer.`
   - RETRO: `The oldest answer wins.` plus `Scored by how far back it first happened.`
   - NEXT-GEN: `The most recent answer wins.` plus `Scored by how recently it last happened.`
2. A 30 second timer runs. The player types an answer and presses **SHOOT** (Enter also works).
3. The judge checks the answer against the question's answer list (names plus aliases, accents
   and case ignored, small typos forgiven).
   - Not recognised: the input shakes and says `Not on the teamsheet. Try another.` The clock
     keeps running. There is no penalty and no limit on tries.
   - After 8 seconds a **PASS** button appears. Passing scores 0.
   - Clock hits zero: an answer still in the field counts as though SHOOT had been pressed
     at the whistle (the product owner, 2026-11-15: "if an answer is typed but enter wasn't
     pressed and time ran out then it still counts as submitted"). The judge checks it as
     above; recognised, it is the player's answer, with 0 seconds left. An empty field, or
     one the judge does not know, is `TIME'S UP`, 0 points.
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
   - **RETRO and NEXT-GEN** (2026-11-13) show a **year** wherever HOME and AWAY show a share: the
     table's third column is the year each answer first counted in RETRO (headed `FIRST`) and
     last counted in NEXT-GEN (`LATEST`), the player's own line under the sentence carries it
     too (`YOU Brazil 2016 MISS 0`), and the sentence says it in the mode's voice:
     `Preston North End: first did it in 1889. Straight out of the history books. Worldie!` down
     to `Brazil: first did it in 2016. Right answer, but that's practically yesterday!`;
     `Bayern Munich: last did it in 2026. Hot off the press. Worldie!` down to
     `AC Milan: last did it in 2007. Right answer, but that's ancient history!`. A pass or a
     time-up names the oldest answer (`Passed. The oldest answer was Genoa, all the way back`
     `in 1898.`) or the most recent (`... as recently as 2026.`). Each row is the shot's best
     year.
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
| `timeup`  | 0      | TIME'S UP | no answer the judge knows when the whistle went                 |
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

| rule       | used by  | best answer                     |
| ---------- | -------- | ------------------------------- |
| `common`   | HOME     | the highest share of players    |
| `niche`    | AWAY     | the lowest share of players     |
| `oldest`   | RETRO    | the earliest first year         |
| `newest`   | NEXT-GEN | the latest last year            |
| `closest`  | CLOSEST  | the place nearest today's place |
| `furthest` | FURTHEST | the place furthest from it      |

RETRO and NEXT-GEN file their shots by the same standing and bands, with the gap measured in
years from the best year (`shotsFor` on each answer's first or last year); answers from the
same year have the same standing, so the same shot, and share a rank in the table. Their
stored shots are the rule's (a test keeps them so).

(The rule `niche` keeps its id in code; every word a player sees says **uncommon**.)

The table lists the answers by shot, worldies first, and within a shot by the rule. Shares
are compared to a tenth of a percent, distances in whole kilometres (great-circle,
`Math.round`). Answers with the same shot that compare equal are tied and share a rank.

In AWAY every valid answer is in the table, so the most uncommon answer is still a real one:
nobody scores for an answer that is not on the list.

The distance rules have no shots in the data: their shots come from the same standing and
bands, with the gap measured in kilometres from the best place, worked out from the day's place
as the game is played (`shotsOf`). A distance question needs no shares, only places: at least
three different ones (`checkQuestion`).

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

From tier 3 the stand behind the goal wraps round towards us; at tiers 3 and 4 there is a gap
at the far corner where the town and the church spire show through. From tier 5 (the product
owner, 2026-11-15: "make seatings in the corners as well when it wraps around rather than
just a gap", then "make it look like it curves around") the corner is filled like a bowl's:
the seats, the fans, the walkway and the roof sweep round from the side stand into the end in
one curve, in all three eras, so closing the corners is part of reaching the international
stage.

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

### 5.3 CLOSEST and FURTHEST: the career on the map

The same ladder, on the map (the product owner, 2026-11-18, from image demos of the stages:
"sure do it"). Between answers the map rests on the career's view; an answer's flight pulls
the camera out to hold the pin and the landing, and the next question brings it home.
Tiers 6 and 7 are played at night, whatever the sky.

**CLOSEST: the local hero.** Everything happens at the day's place, and the map closes in on
it a step a tier; the ground he plays at grows beside the pin (a small panel, the ground from
above) until the map is close enough to show it itself.

| tier | the map                            | the ground                                      |
| ---- | ---------------------------------- | ----------------------------------------------- |
| 0    | the whole globe, the place a speck | a park: jumpers for goalposts                   |
| 1    | its continent                      | a pitch, little goals, a changing hut           |
| 2    | its country                        | one covered stand, floodlight poles             |
| 3    | its region: towns, fields, roads   | stands on three sides, a terrace, a scoreboard  |
| 4    | its city                           | a full stadium                                  |
| 5    | the neighbourhood, from above      | the stadium itself; flags in the streets        |
| 6    | the ground from above, at night    | the final: flashes in the crowd                 |
| 7    | the pitch from above, at night     | the cup on the centre spot, fireworks, confetti |

**FURTHEST: further than anyone.** It starts on the same globe as CLOSEST and pulls back a
step a tier, out into space (the product owner, 2026-11-19: "for furthest, it should also
start on the globe level but instead of zooming in (like closest) it should zoom out to
galaxy, universe, etc."). The pin stays on the day's place, its ground growing in the panel
beside it as CLOSEST's does. Distances and sizes are real (what is too small to see is drawn a
few pixels big), the directions made up so that each tier fits the picture.

| tier | the map                                                       | the ground                                     |
| ---- | ------------------------------------------------------------- | ---------------------------------------------- |
| 0    | the whole globe                                               | a park: jumpers for goalposts                  |
| 1    | the Earth and the Moon                                        | a pitch, little goals, a changing hut          |
| 2    | the Sun and the inner planets on their orbits                 | one covered stand, floodlight poles            |
| 3    | the whole solar system, out to Neptune                        | stands on three sides, a terrace, a scoreboard |
| 4    | the nearest stars (Alpha Centauri, Barnard's Star, Sirius)    | a full stadium                                 |
| 5    | the Milky Way, the pin 26,000 light years out from its middle | the stadium with flags                         |
| 6    | the Local Group: Andromeda, Triangulum, the Magellanic Clouds | the final, at night                            |
| 7    | the observable universe, the pin at its middle, fireworks     | the trophy                                     |

An answer from out in space dives back down to the Earth before the ball is kicked, and the
next question goes back out.

Space is dressed up to look the part rather than to be exact (the product owner, 2026-11-19):
clouds of coloured gas stream past as it pulls back, the Milky Way's band crosses the sky,
the planets have their bands, spots and rings, the belts and comets are there, satellites
circle the Earth, stars twinkle and now and then one shoots.

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
- The two big patches facing the player are **HOME** (left, a stadium with three pennants on
  its rim, warm red-orange: the most common answer wins; it was a house until the product
  owner asked for a stadium on 2026-11-13) and **AWAY** (right, the aeroplane, teal: the most uncommon answer wins).
- **NEXT-GEN** (the patch above, a fast-forward: the future, electric magenta) and **RETRO**
  (the patch below, a rewind: the past, old gold) are open too (since 2026-11-13; the bullet
  below still lists them with the locked modes they were). They
  lie far round the ball, too squashed to carry a word. Each wears its name on a small dark
  tag hanging from its patch towards the middle of the ball, in the mode's colour
  (2026-11-16; the product owner: "on ball can you show the label for next gen and retro
  somehow. even if its not exactly on the patch"). The tag is part of its button: it lights
  up with the patch under the mouse and a press on it starts the mode. Once the mode has
  been played the patch shows today's score and the tag still says which mode it is. On a
  ball too small for HOME and AWAY to carry their words (under 74 canvas pixels in radius: a
  1366 x 768 laptop, a small phone) there are no tags either: the cards under the ball name
  the modes. HOME's and AWAY's words stand on the same dark plate, inside their patches
  (the same day: "can home and away also have that black background as the name tag since
  all other game modes have it"), so every name on the ball is written the same way.
- **CLOSEST** (a map pin, green) and **FURTHEST** (a globe, periwinkle) on the back of the
  ball, directly behind AWAY and HOME, are open too (2026-11-18). Half a turn of the ball
  brings CLOSEST round to where HOME was and FURTHEST to where AWAY was, side by side, their
  names on their patches as HOME's and AWAY's are. Chosen, CLOSEST's
  ball spins into the Earth, which comes closer and spins on in the middle of the screen, the
  whole globe in sight, as the screen closes; FURTHEST's
  camera rises over the stadium to a bird's-eye view of it and its town, then pulls back,
  pixelating, through the town, its fields and the country until it is a speck on the Earth in
  space (2026-11-18:
  "closest turns it to globe and zooms in. furthest just zooms out of the home screen
  entirely"; "no pin should drop, instead its spinning showing the whole globe then
  transition happens"; "it should feel like a place within that globe so maybe there should
  be stages and cities/fields around as it zooms out until its far enough where it looks like
  a globe"; "Maybe the transition should be making stadium birds eye view first and as it
  zooms out it can get pixelated too").
- **Choosing a mode** (a card, All modes, or its patch) turns the ball to show that mode first,
  quickly (NEXT-GEN and RETRO straight on, CLOSEST and FURTHEST round the back side by side),
  and it is struck there; HOME and AWAY face the front already (the product owner,
  2026-11-18: "it spins it to focus on the game mode that was selected then does its
  animation").
- **The cards under the ball** are the first four modes, HOME, AWAY, RETRO and NEXT-GEN (the
  product owner, 2026-11-18: "the home screen cards at the bottom should only have the
  original 4. there should be an option to show all game modes which also shows these 2,
  otherwise they can click on it from the ball"). **All modes**, beside the bell (a square
  with four squares on a phone, a tall button with its name on a monitor), shows all six
  as a grid of tiles, two to a row, each with its picture, badge and line; picking one kicks the ball off for it, and a mode played today opens its
  review.
- **"SPIN ME"** comes and goes round the ball (the product owner, 2026-11-18: "the ball should
  have a small barely noticeable text saying spin me", then "around the ball (like how the wind
  is). it appears and disappears like pulsing so its not always there"): white letters on a dark
  band, arched just over the top of the ball, outside its rim where the wind blows when it
  spins (small grey ones were "not readable" over the pitch). Every
  seven seconds they dissolve in, stay two seconds and dissolve out again. Not at the kick-off.
- Two more patches are **locked modes**, each with its own picture and a small padlock, in
  quiet greys: on the rim, a quarter turn round out past HOME and past AWAY, **GUESS WHO** (the
  back of a shirt with its number) and **SHOOTOUT** (a goal with a ball on the spot). A quarter
  turn to the right brings GUESS WHO to the front, a quarter turn to the left SHOOTOUT. (NEXT-GEN
  and RETRO on the top and bottom patches were locked here until 2026-11-13, CLOSEST and
  FURTHEST until 2026-11-18.)
- The two newest are future modes (the product owner, 2026-11-11), locked until they are built:
  - **GUESS WHO**: the player sees the back of a shirt, a name and a number, and fills in the
    missing details about the player who wore it.
  - **SHOOTOUT**: a penalty shootout of questions, played on lives instead of against the clock.
- The ball can be spun by hand. Let go, it comes to rest: if a patch other than HOME and AWAY
  faces the player most it turns to show it (NEXT-GEN, RETRO, GUESS WHO or SHOOTOUT straight
  on, CLOSEST and FURTHEST side by side) and stays about four seconds, long enough to read it and press it, then goes
  back to HOME and AWAY. Each locked patch shows its word when it faces the player. Pressing one shakes the ball
  ("no") and puts up a notice naming the mode ("RETRO kicks off soon.", or for the two future
  modes a line on what they will be) for 2.5 seconds, which screen readers hear too. HOME and
  AWAY can be chosen from any pose in which they are in view.
- **AWAY and the plane**, an easter egg (the product owner, 2026-11-16: "when you press away,
  you know how the ball flies off into the sky, if the plane is passing through and the ball
  contacts the plane then instead of going into the sky the plane crashes and ball falls to the
  ground, then the transition happens for the match"). Nothing on the page says so. AWAY's ball
  crosses the row the plane flies along near the end of its flight, far out to the right, about
  0.8 seconds after AWAY is chosen; the plane comes in from the right once every 70 seconds. If
  the plane is there as the ball arrives, they meet: that is AWAY chosen about a second after
  the plane's nose shows at the edge of the picture, give or take 0.4 seconds. Then the ball
  knocks the plane out of the sky with a star, and the plane comes down the way the airship
  does when it is popped (the product owner, of a first version: "the ball doesn't fall in the
  right place considering where the plane was flying and the plane crash animation isn't
  proper. look at how the blimp crash animation is"). Its engine stops and it spins down,
  trailing smoke and shrinking as it falls away, into the town under it: the lawn at the right
  of the picture, which is the plane's alone (the product owner: "it should fall where the
  blimp currently falls", which was that lawn in most windows, and then "make the blimp land
  on the left behind the mascot instead. so that area is only for the plane"). It lands on
  open grass (a bounce, dust, the wreck left nose down) or in the pond (a splash, and it
  sinks), behind whatever stands nearer. Its banner, let go, drifts down like a ribbon; and the pilot
  jumps on the way down, floats under a parachute to the grass beside the wreck and waves, so
  nobody is hurt. The ball falls with the plane to the ground beside the wreck, bounces once
  (or bobs, on water) and lies still, and the iris closes on it there, about three seconds
  later than it would have. AWAY is then
  played exactly as ever: it scores nothing and changes nothing in the game. The plane is back
  the next time the home screen is opened. Only where a plane flies (a monitor: not on a
  phone), and never with reduced motion (there is no flight).
- **The golden ball**, an easter egg (the product owner, 2026-11-16: "if people are spinning
  the ball in home screen constantly for a long time (30 seconds or 1 minute), then something
  cool happens"). Kept spinning by hand for **30 seconds**, the ball turns to **gold**. Nothing
  on the page says so beforehand. A pause of up to a second and a half (the gap between two
  flicks) is part of the spinning; a longer one is not, and what has been spun then runs down
  four times as fast as it built. On the way the ball says something is coming: from a
  quarter of the way a glow of gold grows round it and its wind turns gold, then sparks fly
  off its rim, and in the last few seconds the ball itself flickers gold. As it turns, a ring
  of light and a shine go out from it, fireworks go up over the town (eleven big rockets in
  five seconds, gold ones and one in each mode's colour between them), the stadium erupts,
  the crowd cheers, the mascot does a trick and the airship's sign says **GOLDEN BALL! YOU
  FOUND IT** for ten seconds. Nothing else on the page says so (the product owner,
  2026-11-16: "the blimp saying golden ball you found it is enough, no other message
  needed"); the sign's words are read out for screen readers, and not shown. It is heard
  (the product owner the same day, with a recording of a shimmer: "a sparkle sound when it
  turns to gold" and "a quiet background continuous shimmering sound (not too loud so it
  isn't annoying)"): a quiet shimmer comes in with the glow and grows as the ball nears the
  gold, the ball's own sparkle rings as it turns, and the shimmer then falls back to a very
  quiet bed that stays for as long as a golden ball is on the screen. And the shimmer is
  seen (the product owner, 2026-11-16: "add some sparkle effect on ball when its golden so
  the shimmer sound makes sense"): a golden ball sparkles all the time it hovers, small
  four-point glints of white opening and closing here and there on its gold leather, a few at
  a time (more while it is being celebrated), never on a patch or its lettering, with a
  bigger twinkle now and then. The ball stays gold
  for the rest of that day on that device (it is still the
  menu: the patches are as ever), and is an ordinary ball again the next day. Spinning a
  golden ball for another 30 seconds sets the fireworks off again. With reduced motion the
  ball turns to gold with its sounds and the sign: no glow, no sparks, no fireworks, and a few
  glints that stand still on its leather. It
  scores nothing and changes nothing in the game.
- The ball is heard: a light touch when the pointer comes onto it or presses it, wind while it
  spins (louder the faster), and the strike when a mode is chosen, then wind as it flies; HOME's
  ball lands to a roar and a blast of horns, AWAY's whistles away into the distance.
- An airship drifts over the town with a dot-matrix sign on its flank. Since 2026-11-12 (the
  product owner: "make blimp slightly smaller and contain key info like your total points, or
  your position on leaderboard, etc. and it switches between this stuff") it is 7/8 of its old
  size and its sign shows **short messages about the player's day**, one after another, each
  for about 4 seconds, changing as an LED sign does (the lamps roll the old message up and the
  next one up into its place): for each mode played today its total (`NEXT-GEN / 360 PTS`),
  the player's place on today's leaderboard (`NEXT-GEN / 37 OF 1,284`, as the leaderboard
  panel places it) and the title it earned, alone on two lines (`FROM THE / FUTURE`); the
  daily streak (`DAILY STREAK / 4 DAYS`); a nudge for each mode not played yet (`AWAY / IS
WAITING`); and how many are on the board (`ON THE BOARD / 1,136`; the place message is
  only for a player on a board). Since the era-art
  review (2026-11-13) every message fits the smallest sign whole, nothing scrolling: a header
  of 12 small letters at most, a line of 8 big or 12 small ones. The words are in `strings.home.sign`, the list
  in `app/routes/home-sign.ts`.
- **The fact of the day** is towed across the sky on a banner (the product owner, 2026-11-12:
  "the daily fun fact is instead shown by a plane that flies by occasionally with a banner
  behind it saying the fun fact"): a little plane flies over from right to left about once a
  minute (the first pass 6 seconds after the page opens), towing `DID YOU KNOW? ...` and the
  fact in painted letters on a rippling banner, at a reading pace (a letter a seventh of a
  second); at night its cabin and navigation lamps are lit and lamps along the banner light
  it. On a monitor it flies in the sky beside the wordmark, behind the airship. Not on a phone,
  either way up (the product owner, 2026-11-13: "On a phone screen remove the plane with fun fact
  since it's too crowded - that can be large screen only"): it flies where the screen's shorter
  side is at least 500 px (`app/routes/home-plane.ts`), so a phone shows no fact. Before 2026-11-12 the fact scrolled on the airship's sign (the product
  owner, 2026-11-11: "The blimp should now say just a fun football daily fact instead"); it
  showed today's stadium before that; the stadium has not been named anywhere since 2026-11-17. Sixty fact-checked facts
  in a fixed cycle, the first on day 1 (2026-11-10): `app/data/facts.ts`, notes in
  `docs/data-notes/facts.md`. The fact starts at its beginning and rests a moment, then
  scrolls at a steady reading pace (a whole fact passes in 17 to 28 seconds) and comes round
  again. Screen readers hear "Fact of the day: ...". The airship can be clicked: it wobbles,
  five or six quick clicks pop it, it crashes on to the lawn at the left, just behind the
  mascot, who stands in front of the wreck (the product owner, 2026-11-16: "make the blimp
  land on the left behind the mascot instead. so that area is only for the plane": before, in
  most windows, it fell right across the picture to the lawn at the right, where the plane now
  comes down). Its pilot parachutes down beside the wreck, never over the mascot, and a new
  one drifts in with the same messages, from the first.
- **The daily streak** (the product owner, 2026-11-12: "there should be a daily streak showing
  if the user comes on everyday to play then it should keep going up"): a small pixel flame and
  the days in a row with a finished game (`streakFor`, section 6.6) in the day plate under the
  ball (`DAY 12` then the flame and `4`; on a monitor, where the plate is two rows tall, the
  flame and `4` are on the second row, under the day, beside the sound switch, the plate split in
  two like the rows of cards: the product owner, 2026-11-13). The plate is styled as one of the
  mode cards, with an amber stripe down its left edge. The first time it is seen after it went up it hops
  and throws a ring of gold sparks. With no streak nothing shows. It is also on the full-time
  card (`STREAK 4` under the title) and one of the airship's messages. Screen readers hear
  "Daily streak: 4 days in a row".
- The sky is the player's own sky: day, dusk, night or dawn, worked out from their device clock
  and time zone (no location permission prompt). At night the floodlights are on.
- Under the ball: a card per mode, a `?` how-to-play button, the sound switch, a stats
  button (section 6.6) and the day number. On a monitor the sound switch is under the bell at
  the left end and Support is a gold button with a heart and its name at the right end, after
  the `?` and the stats (the product owner, 2026-11-14: "put the sound icon/button where the
  support us/heart button is ... make it somewhere else and more prominent"). A browser lets a
  page make no sound until it has been pressed once, on every visit and every refresh, so on a
  page just opened the sound switch shows the sound waiting (its waves blink, and it says
  "Sound on: it starts when you click or tap"); any press starts it, and a press on the switch
  itself starts it and leaves it on (the product owner, 2026-11-16: "it appears the sound is
  unmuted by the symbol but no sound appears until we mute and unmute"). A card not played today shows the mode's picture
  (the same as its patch on the ball: the stadium, the aeroplane, the arrows), its badge and
  what it is (`HOME` / `Most common wins`), and pressing it plays the mode. Once played it
  shows today's score, the badge and two square icon buttons (the product owner, 2026-11-13):
  **REVIEW** (a list) and **SHARE** (an arrow out of a tray), which shares that game exactly as
  its full-time card's SHARE does: the same picture and text, through the phone's share sheet,
  or downloaded and copied on a computer. The picture is made ahead, in quiet moments after the
  menu is up, so the share sheet can open in the press itself. Once it has worked, SHARE's icon
  is a green tick for a moment (no words on screen; screen readers hear how it went). On a
  phone a played card reads score, badge, REVIEW, and has no SHARE (the product owner,
  2026-11-13): SHARE is in the review, beside its close button. Where a narrow phone's card is
  short of room (NEXT-GEN's badge under 395 px), REVIEW narrows rather than spill out of it.
  On a monitor the left column's cards read outwards from the centre line, like a result:
  `REVIEW HOME 512 | 411 AWAY REVIEW`. On a phone too short for two rows of cards, a card
  shows its badge alone, or its score once played, and the whole of it is the button.
- Choosing a patch: it lights up in the mode's colour and the ball is struck. HOME: it drops
  into the stadium, onto the pitch, and the ground erupts. AWAY: it sails away over the town
  and out of sight. NEXT-GEN and RETRO are not struck: the ball changes era where it hangs.
  NEXT-GEN (the product owner, 2026-11-14: "for next gen can we do it turns into a futuristic
  ball"): the ball spins really fast where it hangs, the other way from RETRO's, and at full
  speed breaks up into big square pixels and comes back together as the ball of the future (a
  sleek ball of eight curved panels, gunmetal and black chrome, with light in its seams). It
  stops as that, its seams flash and light up in NEXT-GEN's magenta with a ring of light round
  it, and it lifts a little, light, and hovers, while the world round it turns neon, a screen
  with scan lines and glitches. Then the screen wipes into the career scene. RETRO (the product owner, 2026-11-13: "instead of shooting the ball
  somewhere, make an animation that transforms the football into an olden brown leather
  football"): the ball spins really fast where it hangs, air streaming round it, and in the
  blur it becomes an old brown leather ball (eighteen panels in strips, laced), so that by the
  time it stops spinning it is the old ball (the product owner, 2026-11-13: "spinning really
  fast then by the time it stops spinning it's the old leather ball"). It stops with its lace
  towards the player, a ring of warm light round it, and settles, heavier, while the world
  round it fades to an old sepia photograph with the scratches of old film. Then the screen
  wipes into the career scene.
- **Each mode is played once a day** (the product owner, 2026-11-13: "the button to play it
  again isn't clickable (you can only play once a day)"). A mode played today shows its score
  on its patch: on HOME and AWAY in the picture's place, over the word, which stays (the
  product owner, 2026-11-13: "why ... is there no title for the home and away patch"), or on a
  ball too small for words, under the picture as before; its card's REVIEW and its patch on the ball open the **review**, a pop-up over
  the home screen (built like the rules', a sheet on a phone, with no line under its heading):
  `YOUR HOME GAME`, the total
  on the full-time card's display, the title it earned, the career tier, the seven answers
  as the full-time card lists them, and a SHARE icon beside the close button (on a phone the
  only SHARE: the cards have none there), which turns into a green tick for a moment once
  it has worked. The game page never starts a second game of a
  mode on the same day: reached any way (its address typed, an old link), it shows that
  day's full-time card again. Testing uses `?day=` for another day (development builds only).
- **Today's leaderboard** (the product owner, 2026-11-11: "leaderboard in home screen (just
  mock data for now)"): today's top ten for HOME and for AWAY, a tab each, every row a rank, a
  handle and a total out of 700, the leader in gold, and under it how many are on the board
  ("1,137 on today's board"). **Every player the server keeps is on the boards**, with an
  account or not (since 2026-11-18; from 2026-11-17 it was accounts only). A player who has played the mode today is in its table
  under their **nickname**, at their rank (first among equal totals): highlighted in place if
  they made the top ten, otherwise under it after a gap ("289 soccerfan4821 420"). A player
  whose game could not be kept (the server turned their connection away for making too many
  players) is told where they would have placed ("You'd be 289th of 1,138") and is not put
  on the board. The tab shown first is the mode they played,
  if they played only one. On a monitor it is a bolted scoreboard panel standing on the right
  of the picture over the park, always open, level with the airship on the other side of the
  logo (higher on a short screen, so it stays clear of the captions), and it slides away with
  the captions at the kick-off. On a phone a gold trophy button above the "?" button opens it as
  a sheet over the lower half of the screen. The boards are the server's (since 2026-11-18:
  docs/ARCHITECTURE.md section 8, "The leaderboards"), refreshed every minute while the page
  is in view; while nobody is on one its table says "Nobody on today's board yet." In
  development with no API the players are made up (`app/data/leaderboard.ts`).
- **Nicknames** (the product owner, 2026-11-15: "everyone who joins gets a nickname assigned to
  them. They can change this. But this is what's used for leaderboard names"; then "make the
  names just soccerfan followed by numbers that increment so its always unique"). The first
  visit gives the player **soccerfan** and a number ("soccerfan4821"), kept on the device. It
  is in the top right corner of the home screen (since 2026-11-17; it was a line under the
  leaderboard's table with CHANGE, and the leaderboard no longer changes it): on a monitor
  the name and a pencil on a plate there, a press opening **YOUR NAME**: a field and
  **SAVE**. A name is 3 to 13 characters of letters, numbers, spaces, - and _, with a
  letter (13: soccerfan and four digits). Numbers that go up one by one and never repeat need
  someone to count: until a backend does, the number is a random one from 1000 to 9999, and the
  backend will hand out the next in order (soccerfan1, soccerfan2, ...; docs/ARCHITECTURE.md
  section 8). Where the leaderboard's column is too short (the monitor's panel), a name ending
  in a number loses letters, never the number: "soccerf…4821".
- **Accounts** (the product owner, 2026-11-17: "start the user accounts"). Optional: nobody
  needs one to play. Beside the name in the top right corner is **SIGN IN** (on a phone,
  one button with a head and shoulders in the corner, for both), which opens the sign-in card:
  signing up is the same thing. The player's name and CHANGE, an email address and
  **EMAIL ME A LINK** (the link in the email signs the player in: there is no password),
  or **CONTINUE WITH GOOGLE**. An account keeps the player's name, games, streak and stats
  on the server, the same on every device (the games the device had played before go with
  it). A player with no account is kept by the server too, from their first game, with
  their name and games (on the leaderboards; only their streak and stats are on the
  device), and can delete them from the card (**DELETE MY GAMES**). A new player is the next soccerfan
  (soccerfan1, soccerfan2, ...), and its name can be changed to any that is free. Signed
  in, SIGN IN reads **ACCOUNT**, and its card says who, with **SIGN OUT** and **DELETE
  ACCOUNT** (which asks first). Its foot links the **terms** and the **privacy notice**
  (/terms, /privacy). There is no offer of an account after a game (the product owner,
  2026-11-17). A player with no account has nothing stored about them (docs/ARCHITECTURE.md
  section 8).

### 6.2 Game screen

- **The mode card** (2026-11-16; the product owner: "when going to each category rather than
  just going straight into game, after transition it shows message of category like 'give the
  most common answer' then transitions to game start"). The home screen's kick-off ends on
  ink; on that ink, before a new game, the mode's name stands large in its colour between two
  rules, and under it what to give:
  - HOME: `GIVE THE MOST COMMON ANSWER`
  - AWAY: `GIVE THE MOST UNCOMMON ANSWER`
  - RETRO: `GIVE THE OLDEST ANSWER`
  - NEXT-GEN: `GIVE THE MOST RECENT ANSWER`

  The words that tell the modes apart (MOST COMMON, MOST UNCOMMON, OLDEST, MOST RECENT) are in
  the mode's light colour. The rules open out from the middle and the words open between them
  like shutters; it stays 2.4 s, shuts the same way in 0.2 s, and then the iris opens on the
  ground and question 1 is asked. A press anywhere, or Enter, Space or Escape, sends it off at
  once (it is seen four times a day). The first question's 30 seconds start when the card has
  gone, not when the page arrives. It is for a new game only: a game carried on after a reload
  goes straight back to where it was (its clock has been running), and a finished game shows
  its full-time card. It also comes before the next mode started from a full-time card. With
  reduced motion it is simply there, then gone. Screen readers hear its words read out; the
  ground's sound is already heard under it.

- The career scene fills the screen (canvas).
- Top: the **board**, styled as a stadium scoreboard. Mode badge, seven result pips, total
  points, career tier with a small progress bar, the question, the instruction line, the timer.
  It does not name the day's stadium (the product owner, 2026-11-11: "no need for that
  detail"); the room goes to the question. Nothing else names it either, to the eye or to a
  screen reader (2026-11-17; a line under the page's heading read it out until then).
- Bottom: the answer bar. Text input and the SHOOT button. PASS appears after 8 seconds.
- While he waits the footballer does keepie-uppies. Team-mates and a keeper idle around him.
- After a goal or a miss that earns no promotion, the same ball is fetched back to him before
  he juggles again: at tiers 0 and 1 (still youths) a youth runs after it and passes it back
  (the child keeper after a goal, a team-mate after a miss); from tier 2 the keeper picks a
  goal out of his net, carries it to his place and rolls it out, and a ball kid behind the
  goal catches or picks up a miss and throws it back. A promotion skips it (the new ground
  starts with the ball at his feet). Details: docs/API_SCENES.md, "The fetch".

### 6.3 Reveal sheet

Slides up from the bottom. A header band in the shot's colour (`GOLAZO!` and `+80`), the
sentence, the player's own answer on a line in the miss colour when it did not score, the table
(five rows, one per shot that scores; see section 3, step 6), the next button. The five rows,
the headings and the player's line are always all in view, whole, with no scrolling: the sheet
is as tall as what it holds, up to the foot of the board. The scene is composed around a sheet
covering the lower 46%, and it usually covers 26 to 46%; with long names it can reach about 50%
on a 1366 x 768 monitor and 57 to 59% on a small phone (360 x 640, 412 x 915), where it then
hides the players for the length of the reveal. On a screen too short even for that the sheet
sets itself tighter rather than cut a row (docs/API_UI.md, `RevealSheet`, "Its height").

### 6.4 Full time

The final tableau for the tier reached, `FULL TIME`, the career tier reached, the total out of
700 and, big under it in the mode's colour, the **title** the total earned; the seven pips with
each answer and its shot, and three buttons: SHARE, on to the next mode, back to the menu.
The next mode (the product owner, 2026-11-15: "it should always direct to next available game
mode") is the first after this one in the menu's order, HOME, AWAY, RETRO, NEXT-GEN, CLOSEST,
FURTHEST and round to HOME again, that has not been played today: finishing HOME offers AWAY,
or RETRO if AWAY is done. The locked modes are never offered. Its button is the mode's name
alone, in its colour, `HOME`, `AWAY`, `RETRO` and so on, read out "Play AWAY" and so on,
since "PLAY NEXT-GEN" wraps the row of buttons. Once all six have been played there is nothing
to go on to and the card has SHARE and MENU only.

**SHARE** (the product owner, 2026-11-12: "pressing share should produce an image you can
share which shows what you answered for each question and your points and final result")
makes a picture of the game, and two lines of text go with it:

- **The picture**: a pixel-art card, 1080 x 1350 PNG (portrait 4:5, 360 x 450 card pixels at
  3 x 3 each), drawn by the game's own engine. From the top: the wordmark on a night sky; the
  mode's badge in its colour and `DAY 12`; the seven questions, one row
  each (its number, the question cut down to one line: no "Name a", nothing in brackets,
  "has won" as "won", then shortened at a word with "..."; the answer, or `no answer` after
  a pass or a time-up, in the big face, the small one if it is too wide, cut short only if
  even that is: one name in the demo, "International Stadium Yokohama"; the shot as its
  grade-coloured tag, `PASSED` or `TIME'S UP` for no answer; the points; in RETRO and
  NEXT-GEN the answer's year, in the mode's light colour, before the tag, or at the end of the
  question's line for the two names too long for both: Wolverhampton Wanderers, Inverness
  Caledonian Thistle); the total on the
  full-time card's dot-matrix display (gold on a 700), the title in the mode's light colour,
  the career tier (or a gold `PERFECT GAME` plate); the site's name on a strip of pitch.
- **Sharing it**: on a phone or tablet whose browser can share files (`navigator.canShare`
  with the PNG), the system share sheet opens with the picture and the text together. On a
  PC (a mouse-first screen, even where the browser could share) the picture is downloaded,
  named `soccersense-day-12-home.png`, and the text copied, and the button says `SAVED!`
  then `COPIED!`. Where no picture can be made, the text alone is copied.
- **The text** is two lines, the same for every game and mode (the product owner,
  2026-11-17: it should say "check out what I got on soccersense! Test your football trivia
  on (link)", and "it shouldn't say all that extra stuff because it's in the image. Only
  first line and last line"):

      Check out what I got on soccersense!
      Test your football trivia on https://...

  Nothing of the result is in it: the day, the mode, the title, the total, the tier and
  the shots are all the picture's. (Until 2026-11-17 the text was a summary: the day and
  the mode, the title, `512/700 · TOP FLIGHT` and a symbol per question. That is gone,
  with the code that built it.) The link is the site's address (`SITE_URL` in
  `app/routes/seo.ts`) once that is set, and until then the address the game is being
  played at. What the game says after SHARE calls the text "the link" ("Picture saved, link
  copied.").

**The way home** (the product owner, 2026-11-12: "when clicking home after playing a match
there should be a black fade out and fade in rather than teleport to home"). MENU fades the
screen to black and the home screen in from black, in the game's pixels: an ordered dither of
ink eats the picture in whole pixels in sixteen steps (0.35 s), the home screen is put up
behind the ink, and the dither shrinks away off it (0.35 s), the ball swelling out of its
star as it does. It is heard as the iris between the home screen and the game is: the whoosh
closing as the ink comes, opening as it goes. Instant under reduced motion. The game screen
has no other way home (the board has no home link); the browser's back button and a visit to
the home page are as they were, with no fade.

The titles (the product owner, 2026-11-11: "based on total points ... it should also give you
an appropriate title"): a ladder of ten a mode, in the matchday voice, funny and never mean,
nothing named after a real award, trophy, club or person. HOME's are the crowd's favourite
(going with the room), AWAY's the scout of the obscure (deep cuts, hipster picks), RETRO's the
keeper of football's past (2026-11-13: from born yesterday to there at the very start),
NEXT-GEN's the one first with the news (from still on dial-up to here from the future). The
rungs are the same for every mode (`titleFor` in `~/game`; the words in
`strings.play.titles`), at most 20 characters so a title is one line on a monitor:

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

| total      | RETRO                | NEXT-GEN             |
| ---------- | -------------------- | -------------------- |
| 0          | BORN YESTERDAY       | STILL ON DIAL-UP     |
| 10 to 110  | FLICKS THE ALMANAC   | SCORES ON TELETEXT   |
| 120 to 210 | BLACK AND WHITE TV   | WAITING FOR REPLAYS  |
| 220 to 290 | HEAVY LEATHER BALL   | ON THE GROUP CHAT    |
| 300 to 370 | PROGRAMME COLLECTOR  | NOTIFICATIONS ON     |
| 380 to 450 | SHORTS PAST THE KNEE | LIVE BLOG REGULAR    |
| 460 to 530 | TERRACE HISTORIAN    | TRANSFER RUMOUR MILL |
| 540 to 610 | KEEPER OF THE LEDGER | FIRST WITH THE NEWS  |
| 620 to 690 | LIVING ARCHIVE       | AHEAD OF THE WHISTLE |
| 700        | THERE AT KICK-OFF    | FROM THE FUTURE      |

### 6.5 How to play

The `?` button on the home screen opens the rules as a pop-up over the menu (the page is not
left): the heading, one line (`7 questions a day. 30 seconds each.`), POINTS (the six shots
and their points) and YOUR CAREER (the eight steps from PARK KICKABOUT to WORLD CUP WINNER).
It names no mode: each mode's rule is on the home screen and the board. Close, Esc or a
click outside shuts it, and the focus goes back to `?`. On a phone it is a bottom sheet sized
to its content. `/how-to-play` stays as a page with the same card, for old links and readers
without script. (Changed on 2026-11-12: it used to be only that page; the HOME and AWAY rules
were dropped from it at the product owner's request.)

At the foot of the card, in small print, the disclaimer (the product owner, 2026-11-12:
"some sort of disclaimer somewhere saying we aren't associated with fifa"): `soccersense is
an independent fan game. It is not affiliated with, endorsed or sponsored by FIFA, UEFA or
any league, club or player. All names and brands belong to their owners and are used for
identification only.` It is on the pop-up, on `/how-to-play` and at the foot of the stats
(6.6): quiet (a small grey line under a rule) but readable.

### 6.6 Your stats

(The product owner, 2026-11-12: "my stats option in home page where it shows your average
result across the categories, today's result, etc.")

A stats button (a bar chart) beside the `?` and the sound switch opens the player's stats as
a pop-up built like the rules' (the same card, the same ways in and out; a sheet on a phone):

- **STREAK**: how many days in a row the player has finished at least one game, in any mode,
  and their best run. Today counts once a game is finished; until then the run up to
  yesterday is still alive.
- Per mode (every mode the game has, in the menu's order: HOME, AWAY, RETRO, NEXT-GEN,
  CLOSEST, FURTHEST; two by two on a monitor): **TODAY**, the total, the title it earned and the seven shots as small tags in
  their colours, or `Not played yet`; then over every day played on this device, **PLAYED**
  (games finished), **AVERAGE** (the mean total, to the whole point), **BEST** (the highest
  total and the day it was first made), and how the answers went: a bar of the shots' colours
  and, under it, how many worldies, golazos, trivelas, toe pokes, tap-ins, misses and no
  answers (a pass or a time-up).
- A first visit says there are no games yet. The small print is at the foot.

The history is the finished games the device already keeps, one per day and mode
(`soccersense:v1:<day>:<mode>` in local storage): a year of them, today included. A game more
than a year older than the one being saved is forgotten as it is saved, and a game played
with a `?day=` override ahead of the day shown is left out. Nothing leaves the device.

## 7. What is deliberately not in this iteration

Real daily content (it waits on the `QUESTIONS` flag), payments, other languages, more
categories. (The backend and accounts were on this list:
they are being built a step at a time, docs/ARCHITECTURE.md section 8.) (Drag-to-spin on the ball and sound
were on this list; the product owner asked for both on 2026-11-11 and they are built. So are
streaks and stats, on 2026-11-12, kept on the device only: section 6.6.) The code should
leave room for them but must not build them.

## 8. Originality

The format (seven typed questions, a clock, graded answers, a daily rhythm) is a genre. The
name, theme, scoring idea, artwork, characters, wording and interface are our own. Do not copy
the look, art, mascot, wording or question content of wonderhop.io or any other game. No real
club crests, kit designs, sponsor logos or trophy designs: kits are plain colours and the trophy
is a generic gold cup.
