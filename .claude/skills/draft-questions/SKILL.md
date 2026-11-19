---
name: draft-questions
description: Draft the coming days' questions and places for soccersense (the daily football trivia game) and send them to the approval desk. Use for the weekly scheduled drafting run, or when asked to draft, redraft or top up the day's questions or places.
---

# Drafting the day's questions

soccersense asks seven questions a day in each of six modes, and has a place a day (a
stadium, a city or a landmark) that two of them, CLOSEST and FURTHEST, measure every
answer from. You write the drafts; the product owner approves every one by hand at
https://soccersense.io/admin before it is played. Your job is to give every coming day
without one a place, and to fill every empty or rejected question for the coming days with
one that is correct, complete and fun, and to send them all to the desk as drafts.

You never approve anything, never change what the live game plays, never commit or push
drafts, and never print, echo or store a token.

## The run

1. Install once: `pnpm install` (the tool needs the project's packages). If pnpm stops on
   the Node version, run `pnpm install --config.engine-strict=false`; any Node from 22 runs
   this tool.
2. See what is needed: `pnpm questions todo --json`. It prints today's day number;
   `days` (each day whose place is `empty` or `rejected`, with the reviewer's reason, the
   place turned down, and the days either side's places, `before` and `after`);
   `places` (the questions: each a day, a mode and a slot 0 to 6 that is `empty` or
   `rejected`, with the reviewer's reason and the question that was turned down; CLOSEST's
   and FURTHEST's also with the day's `place`, or `waitsForPlace` while the day has
   none); `used` (every question asked in the last 90 days and already drafted for the
   days ahead) and `usedPlaces` (the same for the days' places).
   - A 401 means the desk's token is not reaching it: say so, with the tool's own words
     (it says whether no token arrived or a wrong one), and stop. The token is added to
     requests by the environment (a network secret for soccersense.io) or by the
     `SOCCERSENSE_ADMIN_TOKEN` variable. Do not look for it or ask for it.
   - No days and no places: say the week is fully drafted, and stop.
3. **The days' places first**, since CLOSEST and FURTHEST are chosen for them: write every
   day in `days` to `.drafts/places.json` (see "A day's place" below), run
   `pnpm questions check .drafts/places.json`, put right everything it reports, then
   `pnpm questions submit .drafts/places.json`. Then run `pnpm questions todo --json`
   again: CLOSEST's and FURTHEST's places now say each day's place.
4. Then the questions, one game at a time (a day and mode: up to seven places), earliest
   day first. For
   each game, write its drafts to `.drafts/day-<day>-<mode>.json` (the folder is ignored by
   git), run `pnpm questions check <file>`, put right everything it reports, then
   `pnpm questions submit <file>`. Sending as you go means a run that stops early has still
   delivered, and the next run picks up what is left.
   A CLOSEST or FURTHEST game whose day still `waitsForPlace` is left for the next run.
5. Where subagents are available, give each a whole game to draft and check, and submit
   their files yourself. Give them this skill's rules and the `used` list.
6. Finish with a short report: which days' places were saved, how many drafts for which
   days, anything the desk refused, and every doubt the product owner should look at
   first.

## The file

```json
{
  "drafts": [
    {
      "day": 15,
      "mode": "home",
      "slot": 0,
      "note": "Sources: <urls>. Counting rule: <what counts>. Doubts: <any>.",
      "question": {
        "id": "pl-winning-clubs",
        "mode": "home",
        "prompt": "Name a club that has won the Premier League",
        "measure": "ground",
        "measureLabel": "where the club plays its home games",
        "asOf": "2026-11-17",
        "answers": [
          {
            "id": "blackburn-rovers",
            "name": "Blackburn Rovers",
            "aliases": ["Blackburn", "BRFC"],
            "place": "Ewood Park, Blackburn",
            "country": "England",
            "lat": 53.7286,
            "lng": -2.4892,
            "popularity": 2
          }
        ]
      }
    }
  ]
}
```

Do not write `shot`: the game files every answer's shot itself. `app/data/questions/*.ts`
are finished examples of every mode (CLOSEST's and FURTHEST's, in `distance.ts`, are other
modes' questions played again); `docs/data-notes/` says how they were made.

## A day's place

`.drafts/places.json`:

```json
{
  "places": [
    {
      "day": 15,
      "note": "Sources: <urls>. Coordinates: the pitch's centre, from <url>. Doubts: <any>.",
      "place": {
        "id": "estadio-centenario",
        "name": "Estadio Centenario",
        "area": "Montevideo, Uruguay",
        "kind": "stadium",
        "lat": -34.8945,
        "lng": -56.1529
      }
    }
  ]
}
```

- **A place a football fan anywhere would know or enjoy meeting**: a famous ground (a World
  Cup final's, a great club's), a city with football in it, or a landmark of the world.
  `app/data/places.ts` has 30 finished examples (the game's fallback: a day with no
  approved place plays its turn of them); do not draft those.
- **Mix the kinds**: `stadium`, `city` or `landmark`, never the same kind two days
  running, and about half of them stadiums over a week.
- **Spread round the world**: each day's place at least 2,000 km from the day before's and
  the day after's (`before`, `after`, and your own file), on another continent where it
  can be; over a week, every continent with football, not mostly Europe.
- **Not a repeat**: nothing in `usedPlaces` (90 days back and the days ahead), and nothing
  twice in your file.
- **Thought of with its CLOSEST and FURTHEST**: a place where good lists reach both near and
  far. Lagos (African clubs and players nearby) works; the middle of an ocean does not.
- `id`: kebab-case, a to z, digits and hyphens. `name`: as it is known, with its
  accents, 28 characters at most, Latin letters (the game's pixel font has no others).
  `area`: for a stadium or a landmark its town and country ("Montevideo, Uruguay"), for a
  city its country alone ("Nigeria"); 40 characters at most. The game names it
  "Estadio Centenario, Montevideo" or "Lagos, Nigeria".
- **Coordinates** from the place's own article or official page, never from memory: a
  stadium's is the centre of its pitch, a landmark's its own point, a city's its
  conventional centre; 4 decimal places, never exactly 0, no nearer the poles than 70
  degrees. Put the source in `note`.
- A rejected day: read the reviewer's reason, and draft another place (or the same one put
  right, if that is what the reason asks).

## What makes a question

- **A closed list with a right answer for everything.** "Name a club that has won the
  Premier League", "Name a player who has won the Ballon d'Or". Every valid answer is in
  the list, and nothing else is. If you cannot be sure the list is complete, pick another
  question.
- **It starts "Name a ..." or "Name an ...".** One line, no trick wording. Say the cut-off
  in the prompt when there is one: "(1993 onwards)".
- **True on the day it is played.** `asOf` is today's date. Do not use a list that will
  change before its day (a final played that week, a title being decided).
- **Sized to play.** At least 6 answers in HOME and AWAY, at least 12 in RETRO and
  NEXT-GEN, at least 8 in CLOSEST and FURTHEST; most between 8 and 40; one long list (up
  to about 80) a game at most.
- **Not a repeat.** Nothing in `used`, nothing asked twice in your own files, and not the
  same list reworded. HOME and AWAY on the same day get different questions; so do RETRO
  and NEXT-GEN, and CLOSEST and FURTHEST.
- **A good mix in each game of seven**: clubs, players, managers, countries and stadiums;
  England, Europe and the rest of the world; old and recent; easy and hard. Written in
  British English for a British football fan.

### The modes

- **HOME**: the most common answer scores best. Pick lists with clear favourites.
- **AWAY**: the most uncommon answer scores best. Pick lists with a long tail of answers
  only a keen fan would name.
- **RETRO**: the answer with the earliest year scores best. **NEXT-GEN**: the latest. Every
  answer needs `years`: every year that makes it a valid answer, whole and ascending. A
  league season counts as the year it ended (2025-26 is 2026), a cup as the year of its
  final, a tournament as the year in its official name (Euro 2020 is 2020). Pick lists
  whose years are well spread, or the check will say the scoring shots cannot be filled.
- **CLOSEST**: the answer whose place is nearest the day's place scores best. **FURTHEST**:
  the one furthest from it. Each of their places in `todo` says the day's `place` (a
  stadium, a city or a landmark, with its coordinates: the one drafted for the day, which
  may still be a draft); the game says it on the board, and
  measures every answer from it by the answer's own place (see `measure` below), so the
  coordinates must be right. Choose each question for its day's place: answers at every
  sort of distance from it, some near (its country, its region) and some on other
  continents. CLOSEST at Lagos wants a list with African answers in it; FURTHEST at
  Wembley one that reaches South America, Asia and Oceania. A list all in one country, or
  all far from the place, makes a dull game: the check works the shots out from that day's
  place and says when the reveal cannot be filled. No `years`.

### Each answer

- `id`: kebab-case, a to z, digits and hyphens, unique in its question. The question's
  `id` likewise, and it should say what the list is.
- `name`: the display name, with its accents.
- `aliases`: other things a fan would type: nicknames, initials, former names, other
  transliterations, a spelling by sound. Be generous, within these limits: never the name
  itself; never words that reach two answers ("United", "City", "Milan", a shared
  surname); nothing the judge already handles (capitals, accents, "the", "FC", "Sir", a
  surname on its own, one or two typos). `[]` when there are none.
- `measure` and the place: people are measured by `birthplace` ("where the player was
  born"), clubs by `ground` ("where the club plays its home games"), stadiums by
  `location` ("where the stadium is"), countries by `capital` ("the country's capital").
  `place` is the most specific first ("West Derby, Liverpool"), `country` its country,
  `lat` and `lng` to four decimal places, never 0.
- `popularity`: your estimate of the share of fans, in percent, who would give this answer
  if the question were put to them on the spot: 0.1 to 100, one decimal place at most.
  The shares of a question add up to 100, with no tie for the most common or for the
  least. Weigh, in this order: household names, how often they won, how recently, a
  British audience, then the long tail. Every question needs these, RETRO, NEXT-GEN,
  CLOSEST and FURTHEST too.
- `decoys` (on the question, optional): real things that are not answers but could be
  taken for one by a typo or a shared last word ("Ireland" in a list with Iceland).

## Getting it right

- **Check lists against sources, not memory**: the competition's own records or the
  English Wikipedia list page, fetched on the day. Anything from the last two years is
  checked twice. Birthplaces and coordinates from the person's or the ground's own
  article. Put the URLs and the counting rule in `note`.
- If you have no way to read the web in this run, say so at the top of every `note` and in
  your report, and keep to lists you are certain of.
- **A rejected place**: read the reviewer's reason. Fix that question if it can be fixed;
  otherwise replace it with a different one.
- `pnpm questions check` holds every question to the game's rules (ids, shares, years,
  spellings that clash, the judge accepting every name and alias, CLOSEST's and FURTHEST's
  shots from their day's place). Never send a file it has not passed, and never weaken a
  question to get it past: fix the data.
