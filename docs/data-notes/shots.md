# Shots: data notes

Field: `Answer.shot` in `app/data/questions/home.ts` and `away.ts`, written on 2026-11-11 for
all 312 answers of the 14 questions.

Every answer in a question's list is filed under one of six shots, and a player scores their
answer's shot (`docs/GAME_DESIGN.md` section 4; renamed on 2026-11-11, the points unchanged):

| shot     | id        | points |
| -------- | --------- | ------ |
| WORLDIE  | `worldie` | 100    |
| GOLAZO   | `golazo`  | 80     |
| TRIVELA  | `trivela` | 60     |
| TOE POKE | `toepoke` | 30     |
| TAP IN   | `tapin`   | 10     |
| MISS     | `miss`    | 0      |

Every shot but the miss is a goal. Each answer is filed **for its own question's mode**: in a
HOME question the most common answers are the worldies, in an AWAY question the most
uncommon. (Played under the other rule, an answer's shot is worked out again by the rule below,
so any question can still be moved to the other mode.)

## The rule

`shotsFor(values, rule)` in `app/game/shots.ts`. It is the rule a backend will run on real
answer counts (turned into shares first), so it is code, not a spreadsheet.

1. **Standing.** Each answer gets a standing from 0 (the best answer) to 1 (the worst): the
   mean of two numbers.
   - **Place**: of the answers not tied with it, the share that are better
     (`better / (better + worse)`, as a league table counts).
   - **Gap**: how far its share is from the best answer's, as a fraction of the way to the
     worst, measured in ratios (on a log scale), so that 30% against 15% is as far apart as 2%
     against 1%.

   The place alone would make Ronaldo Nazário (4.5%) as good a HOME answer as Cristiano
   Ronaldo (24.7%) in a long list; the gap alone would leave a long list with no shot between
   two big names and a long tail. The mean of the two keeps both the order and the size of the
   gaps. Shares tie to a tenth of a percent, as in the table.

2. **Bands.** The standing picks the shot (`SHOT_BANDS`):

   | standing   | shot    |
   | ---------- | ------- |
   | 0 to 0.10  | worldie |
   | up to 0.25 | golazo  |
   | up to 0.42 | trivela |
   | up to 0.58 | toepoke |
   | up to 0.80 | tapin   |
   | above 0.80 | miss    |

What it guarantees: the best answer is always a worldie, the worst (when anything is
worse) always a miss, and a better answer never gets a worse shot. The distance rules of the
locked modes CLOSEST and FURTHEST use the same standing and bands, with the gap measured in
kilometres instead of ratios.

## Looked at by eye

Every question was read through after the rule had filed it. Four answers were moved, each by
one step and never against the popularity (the data tests hold both, and list these four):

| question                      | answer                      | rule    | filed   | why                                                |
| ----------------------------- | --------------------------- | ------- | ------- | -------------------------------------------------- |
| pl-winning-managers (HOME)    | José Mourinho               | trivela | golazo  | three titles: sits with Wenger                     |
| world-cup-winning-countries   | Germany                     | trivela | golazo  | four titles: with Argentina                        |
| world-cup-winning-countries   | Italy                       | tapin   | toepoke | four titles: with Spain, above England             |
| world-cup-final-stadiums (AW) | Stade Olympique de Colombes | golazo  | worldie | the 1938 final's ground is as deep a cut as 1934's |

A fifth, Chelsea in `pl-winning-clubs` (HOME), was moved up from the rule's toe poke to a
trivela ("five titles: with Liverpool and Arsenal, not below") until 2026-11-12. It went back to
the rule's toe poke that day: moved up, it left that question with no toe poke at all, and the
reveal now shows one answer for each shot that scores (`app/game/reveal.ts`), so every question
needs at least one in each. With seven answers the rule cannot do otherwise: the fifth most
common answer of seven is always a toe poke unless it has at least about 19% of players (its
place alone puts it at 0.67, and only a share that close to the top's 30% would pull the
standing under 0.42). No popularity estimate changed; Chelsea's 12% stands. Every question now
uses all six shots.

## How many of each

| question                      | mode | answers | worldie | golazo | trivela | toepoke | tapin | miss |
| ----------------------------- | ---- | ------- | ------- | ------ | ------- | ------- | ----- | ---- |
| pl-winning-clubs              | HOME | 7       | 1       | 1      | 2       | 1       | 1     | 1    |
| pl-winning-managers           | HOME | 13      | 2       | 2      | 1       | 3       | 3     | 2    |
| cl-final-stadiums             | HOME | 23      | 1       | 4      | 4       | 5       | 5     | 4    |
| ballon-dor-winners            | HOME | 48      | 2       | 3      | 8       | 9       | 13    | 13   |
| world-cup-winning-countries   | HOME | 8       | 1       | 2      | 1       | 2       | 1     | 1    |
| pl-golden-boot-winners        | HOME | 26      | 3       | 3      | 4       | 5       | 6     | 5    |
| european-cup-winning-clubs    | HOME | 24      | 2       | 4      | 4       | 4       | 5     | 5    |
| world-cup-hosts               | AWAY | 19      | 2       | 2      | 3       | 3       | 5     | 4    |
| world-cup-final-stadiums      | AWAY | 21      | 2       | 3      | 2       | 4       | 5     | 5    |
| cl-winning-managers           | AWAY | 19      | 1       | 2      | 4       | 3       | 4     | 5    |
| libertadores-winning-clubs    | AWAY | 27      | 2       | 3      | 6       | 6       | 6     | 4    |
| world-cup-golden-boot-winners | AWAY | 31      | 3       | 3      | 5       | 6       | 8     | 6    |
| afcon-winning-countries       | AWAY | 15      | 2       | 1      | 3       | 2       | 3     | 4    |
| europa-league-winning-clubs   | AWAY | 31      | 3       | 5      | 6       | 5       | 7     | 5    |

Three of them in full:

- **world-cup-winning-countries (HOME).** Worldie: Brazil 29%. Golazo: Argentina 19%,
  Germany 15%. Trivela: France 12%. Toe poke: Spain 10%, Italy 8%. Tap in: England 5%. Miss:
  Uruguay 2%.
- **pl-winning-clubs (HOME).** Worldie: Manchester United 30%. Golazo: Manchester City
  21%. Trivela: Liverpool 17%, Arsenal 14%. Toe poke: Chelsea 12%. Tap in: Leicester City 4%.
  Miss: Blackburn Rovers 2%.
- **afcon-winning-countries (AWAY).** Worldie: Sudan 0.8%, Ethiopia 1%. Golazo: Congo
  1.2%. Trivela: DR Congo 2%, Tunisia 2.5%, Zambia 3%. Toe poke: South Africa 4%, Morocco 5%.
  Tap in: Algeria 6%, Ghana 9%, Ivory Coast 11%. Miss: Senegal 12%, Nigeria 12.5%, Cameroon
  13%, Egypt 17%.

## Checked by `app/data/data.test.ts`

Every answer has a shot; the shots never contradict the popularity (HOME: a more popular answer
is never a worse shot; AWAY the other way round); the best answer is a worldie and
something is below it; a question of a dozen answers or more uses all six, a smaller one at
least four with a miss among them; **every question has at least one answer in each of the
five shots that score** (the reveal shows one of each, so an empty shot would be a missing
row; checked as well by building the reveal for every answer of every question); and the
shots are exactly the rule's but for the four answers above.

## Doubts

- The bands were set by eye on these fourteen lists. Real counts will be flatter or steeper
  than the estimates; the bands may want tuning once a backend has a few days of answers.
- A long tail of ties (in the Ballon d'Or list twelve winners share 0.2%) puts a whole group in
  one shot: all twelve are misses in HOME.
- In HOME a miss is still a right answer. The reveal says so ("Right answer, but the crowd
  went elsewhere"), but 0 for a correct name may feel harsh to a player; a miss could be worth
  a token point later without changing anything else (`SHOT_POINTS`).
