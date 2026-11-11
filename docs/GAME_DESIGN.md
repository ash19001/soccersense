# soccersense: game design (iteration 1, frontend demo)

This is the product brief for the first playable build. It is frontend only: there is no
backend, the question data is a small built-in sample, and the goal of this iteration is that
the game **looks and feels right**. Graphics come first.

## 1. The game in one paragraph

A daily football trivia game. Every day has one stadium, "today's stadium" (the pin). The
player picks a mode on the home screen and answers 7 typed questions against a 30 second clock.
Every valid answer has a place on the map: where a player was born, a club's ground, a stadium's
location, a country's capital. In **HOME** you want the answer whose place is _closest_ to
today's stadium. In **AWAY** you want the one _furthest_ from it. Each answer scores 0 to 100,
a game is out of 700, and the running total drives a footballer's career from a kickabout in the
park to lifting the World Cup.

## 2. Daily structure

- The day changes at midnight UTC, for everyone at once. `dayNumber` counts whole UTC days from
  2026-11-10, which is day 1.
- One stadium per day, shared by both modes. In the demo the stadium rotates through
  `app/data/stadiums.ts`: index `(dayNumber - 1) mod count`. Anfield is first.
- Each mode has its **own** 7 questions, so the reveal in one mode never gives away the other.
  The demo ships one fixed set per mode. It still plays differently every day, because every
  answer is scored by its distance from that day's stadium.
- Debug overrides (query string, demo only): `?stadium=<id>`, `?day=<n>`, `?time=HH:MM`
  (forces the sky's time of day), `?notimer=1`.

## 3. One question, start to finish

1. The board shows `Question 3 of 7`, the question, and one instruction line:
   - HOME: `Closest to ANFIELD wins.` plus `Measured by where the manager was born.`
   - AWAY: `Furthest from ANFIELD wins.` plus the same measure line.
2. A 30 second timer runs. The player types an answer and presses **SHOOT** (Enter also works).
3. The judge checks the answer against the question's answer list (names plus aliases, accents
   and case ignored, small typos forgiven).
   - Not recognised: the input shakes and says `Not on the teamsheet. Try another.` The clock
     keeps running. There is no penalty and no limit on tries.
   - After 8 seconds a **PASS** button appears. Passing scores 0.
   - Clock hits zero: `TIME'S UP`, 0 points.
4. Recognised answer: the footballer takes a shot. The shot's outcome is the grade (see 4.2).
5. The career meter fills. If the total crosses a threshold he is promoted and the ground changes.
6. The reveal sheet slides up: grade, points, one plain sentence
   (`Trent Alexander-Arnold was born in West Derby, Liverpool: 3 miles from Anfield.`),
   and **the table**: the ranked answers with place, distance and points, the player's row
   highlighted. Then **NEXT QUESTION**, or **FULL TIME** after question 7.

## 4. Scoring

### 4.1 Points: your place in the table

For a question and today's stadium, every answer gets a distance in whole kilometres
(great-circle, `Math.round`). Answers with the same rounded distance are tied.

- HOME: closer is better. AWAY: further is better.
- `points = round(100 * worse / (better + worse))`, where `better` and `worse` are the numbers
  of answers strictly better and strictly worse than this one. If every answer is tied, 100.
- So the best answer always scores 100, the worst always 0, and ties score the same.

This is rank based on purpose. It needs no tuning per question, it works for any stadium, and
it reads naturally as a league table.

Distances are shown in miles for `en-GB` and `en-US` locales and in kilometres otherwise.

### 4.2 Grades

| id         | points   | label      | the shot                                          |
| ---------- | -------- | ---------- | ------------------------------------------------- |
| `worldie`  | 100      | WORLDIE!   | long-range rocket into the top corner, gold flash |
| `topbins`  | 80 to 99 | TOP BINS   | goal, top corner, big celebration                 |
| `goal`     | 55 to 79 | GOAL!      | goal, low finish, celebration                     |
| `ontarget` | 30 to 54 | ON TARGET  | on target, the keeper saves                       |
| `wide`     | 0 to 29  | OFF TARGET | skied over the bar into the crowd                 |
| `timeup`   | none     | TIME'S UP  | the whistle goes, hands on hips                   |
| `skipped`  | none     | PASSED     | he rolls the ball away                            |

Only the best answer in the list is a WORLDIE, shown in gold.

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

Everything happens in one place, and the ground grows around him. The same pitch, the same
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

Every step up is a ground further from home. Between tiers a small vehicle crosses the screen
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
- **The car parks are full of parked cars, and the cars come and go**: one arrives along the
  road, turns in, finds a bay and parks; another pulls out and drives away. The rest of the
  life in the picture is animated in the same spirit (supporters walking in, coaches, a train).
- **A match is being played inside the stadium**: a looped animation of two teams of tiny
  players and a ball on the pitch, with the crowd reacting to the big moments.
- **The top is all sky**, with the logo in it.
- In front of the picture floats a classic black and white football. **The ball is the menu**,
  the focus point of the screen: it hovers and does not rest on the ground. Its black patches
  are the options.
- The two big patches facing the player are **HOME** (left) and **AWAY** (right). The smaller
  patches above and below are locked `SOON` slots for categories not yet designed.
- A dot-matrix sign reads `TODAY'S STADIUM` and the stadium's name, city and country. What
  carries it must make sense from the air (an airship, the stadium's own screen, or a panel
  floating with the ball).
- The sky is the player's own sky: day, dusk, night or dawn, worked out from their device clock
  and time zone (no location permission prompt). At night the floodlights are on.
- Under the ball: one line per mode (`HOME: closest to the stadium wins`,
  `AWAY: furthest from it wins`), a `?` how-to-play button, and the day number.
- Choosing a patch: it lights up in the mode's colour and the ball is struck. HOME: it drops
  into the stadium, onto the pitch, and the ground erupts. AWAY: it sails away over the town
  and out of sight. Then the screen wipes into the career scene.
- A mode already played today shows its score on its patch. The demo allows replays.

### 6.2 Game screen

- The career scene fills the screen (canvas).
- Top: the **board**, styled as a stadium scoreboard. Mode badge, seven result pips, total
  points, career tier with a small progress bar, the question, the instruction line, the timer.
- Bottom: the answer bar. Text input and the SHOOT button. PASS appears after 8 seconds.
- While he waits the footballer does keepie-uppies. Team-mates and a keeper idle around him.

### 6.3 Reveal sheet

Slides up from the bottom and covers at most the lower 46% of the screen so the scene stays
visible. A header band in the grade's colour (grade label and `+87`), the sentence, the table,
the next button.

### 6.4 Full time

The final tableau for the tier reached, `FULL TIME`, the total out of 700, the career title, the
seven pips with each answer, and three buttons: SHARE (copies a text summary), play the other
mode, back to the menu.

### 6.5 How to play

A short rules page at `/how-to-play`, linked from the `?` button.

## 7. What is deliberately not in this iteration

Backend, accounts, real daily content, leaderboards, streaks, payments, analytics, sound,
other languages, more categories, drag-to-spin on the ball. The code should leave room for them
but must not build them.

## 8. Originality

The format (seven typed questions, a clock, graded answers, a daily rhythm) is a genre. The
name, theme, scoring idea, artwork, characters, wording and interface are our own. Do not copy
the look, art, mascot, wording or question content of wonderhop.io or any other game. No real
club crests, kit designs, sponsor logos or trophy designs: kits are plain colours and the trophy
is a generic gold cup.
