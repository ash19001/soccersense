---
name: draft-questions
description: Draft the coming days' questions for soccersense (the daily football trivia game) and send them to the approval desk. Use for the weekly scheduled drafting run, or when asked to draft, redraft or top up the day's questions.
---

# Drafting the day's questions

soccersense asks seven questions a day in each of four modes. You write the drafts; the
product owner approves every one by hand at https://soccersense.io/admin before it is
played. Your job is to fill every empty or rejected place for the coming days with a
question that is correct, complete and fun, and to send them to the desk as drafts.

You never approve anything, never change what the live game plays, never commit or push
drafts, and never print, echo or store a token.

## The run

1. Install once: `pnpm install` (the tool needs the project's packages). If pnpm stops on
   the Node version, run `pnpm install --config.engine-strict=false`; any Node from 22 runs
   this tool.
2. See what is needed: `pnpm questions todo --json`. It prints today's day number,
   `places` (each a day, a mode and a slot 0 to 6 that is `empty` or `rejected`, with the
   reviewer's reason and the question that was turned down) and `used` (every question
   asked in the last 90 days and already drafted for the days ahead).
   - A 401 means the desk's token is not reaching it: say so, with the tool's own words
     (it says whether no token arrived or a wrong one), and stop. The token is added to
     requests by the environment (a network secret for soccersense.io) or by the
     `SOCCERSENSE_ADMIN_TOKEN` variable. Do not look for it or ask for it.
   - No places: say the week is fully drafted, and stop.
3. Work one game at a time (a day and mode: up to seven places), earliest day first. For
   each game, write its drafts to `.drafts/day-<day>-<mode>.json` (the folder is ignored by
   git), run `pnpm questions check <file>`, put right everything it reports, then
   `pnpm questions submit <file>`. Sending as you go means a run that stops early has still
   delivered, and the next run picks up what is left.
4. Where subagents are available, give each a whole game to draft and check, and submit
   their files yourself. Give them this skill's rules and the `used` list.
5. Finish with a short report: how many drafts were saved for which days, anything the
   desk refused, and every doubt the product owner should look at first.

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
are finished examples of all four modes; `docs/data-notes/` says how they were made.

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
  NEXT-GEN; most between 8 and 40; one long list (up to about 80) a game at most.
- **Not a repeat.** Nothing in `used`, nothing asked twice in your own files, and not the
  same list reworded. HOME and AWAY on the same day get different questions; so do RETRO
  and NEXT-GEN.
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
  British audience, then the long tail. Every question needs these, RETRO and NEXT-GEN
  too.
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
  spellings that clash, the judge accepting every name and alias). Never send a file it
  has not passed, and never weaken a question to get it past: fix the data.
