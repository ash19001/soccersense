# Popularity: data notes

Field: `Answer.popularity` in `app/data/questions/home.ts` and `away.ts`, written on
2026-11-11, for all 312 answers of the 14 questions.

HOME is scored by the most common answer and AWAY by the most niche one (`docs/GAME_DESIGN.md`
section 4). "How many players gave this answer" needs real players, and there is no backend
yet. So every answer carries an **estimate**: the share of players, in percent, who would give
that answer if the question were put to a crowd of football fans. **These are demo numbers, not
measurements.** A backend will count the answers real players give and replace them; the game
reads only `popularity`, so nothing else changes when it does.

## The rules the numbers keep

Checked by `app/data/data.test.ts`:

- every answer has one: 0.1 to 100, at most one decimal place (nothing valid is 0: someone
  always thinks of it);
- the shares of a question add up to 100 (the test allows 99.5 to 100.5);
- one answer is the most common and one the most niche: no tie at the very top or the very
  bottom. Ties in the middle are allowed (they share a shot and a rank, as in any table).

Each answer's shot (WORLDIE down to MISS) is filed from these numbers: see `shots.md`.

## How they were estimated

By hand, one question at a time, as a football fan's sense of what comes to mind first when
the question is put on the spot, then tidied so the shares add up to 100. The weights, roughly
in this order:

1. **Star power and household names.** Messi and Cristiano Ronaldo are far ahead of every
   other Ballon d'Or winner; Sir Alex Ferguson leads the Premier League managers; the
   Maracanã and Wembley lead the World Cup final stadiums.
2. **How often they won.** Real Madrid (15 European Cups) lead their question; Sevilla (seven
   UEFA Cup and Europa League titles) are far ahead in theirs; Egypt lead the Cup of Nations.
3. **Recency.** Recent winners come to mind: Arteta (2025-26), Slot (2024-25), Harry Kane's
   2026 Ballon d'Or, Spain's 2026 World Cup, PSG (2025 and 2026), Aston Villa's 2026 Europa
   League, MetLife and Lusail.
4. **The audience.** The game is written in British English, so English football is a little
   over-represented: Manchester United are ahead of City and Liverpool among Premier League
   winners, Gary Lineker is high among World Cup top scorers, Ipswich are not the rarest
   UEFA Cup winners.
5. **The long tail.** Early, one-off and foreign-to-a-British-fan answers are niche: Blackburn
   and Leicester among Premier League winners, Josef Masopust and Allan Simonsen among Ballon
   d'Or winners, Raymond Goethals among Champions League managers, Once Caldas among
   Libertadores winners.

Two deliberate quirks:

- **Luis Suárez** (Ballon d'Or 1960, the Spaniard) gets 0.8%, more than his fame alone would
  give him: players typing the Uruguayan's name land on him.
- **Ronaldo** in the World Cup top scorers (the Brazilian) is the most common answer there:
  many players will type the name hoping for either Ronaldo.

## The extremes of every question

| question                      | most common (HOME 100 / AWAY 0) | most niche (AWAY 100 / HOME 0) |
| ----------------------------- | ------------------------------- | ------------------------------ |
| pl-winning-clubs              | Manchester United 30%           | Blackburn Rovers 2%            |
| pl-winning-managers           | Sir Alex Ferguson 28%           | Manuel Pellegrini 0.5%         |
| cl-final-stadiums             | Wembley Stadium 14%             | Ernst-Happel-Stadion 1%        |
| ballon-dor-winners            | Lionel Messi 32%                | Josef Masopust 0.1%            |
| world-cup-winning-countries   | Brazil 29%                      | Uruguay 2%                     |
| pl-golden-boot-winners        | Erling Haaland 15%              | Chris Sutton 0.3%              |
| european-cup-winning-clubs    | Real Madrid 24%                 | Steaua București 0.2%          |
| world-cup-hosts               | Brazil 13%                      | Chile 0.9%                     |
| world-cup-final-stadiums      | Maracanã 17.6%                  | Stadio Nazionale PNF 0.2%      |
| cl-winning-managers           | Pep Guardiola 15.5%             | Raymond Goethals 0.3%          |
| libertadores-winning-clubs    | Boca Juniors 15.5%              | Once Caldas 0.4%               |
| world-cup-golden-boot-winners | Ronaldo 12%                     | Dražan Jerković 0.2%           |
| afcon-winning-countries       | Egypt 17%                       | Sudan 0.8%                     |
| europa-league-winning-clubs   | Sevilla 16%                     | IFK Göteborg 0.5%              |

Only the HOME questions are played in HOME and the AWAY questions in AWAY, but every question
has both ends, so any of them can be moved to either mode.

## Doubts

- These are one person's estimates. The middle of each list is the least certain: whether
  Arsenal or Chelsea, Lineker or Thomas Müller come to mind first is a matter of taste, and of
  the player's age and country.
- Recency fades: the 2026 winners' shares will be too high in a year.
- The questions were left as they were. Every one reads as well for "the most common" as for
  "the most niche"; the 1993-onwards limit on the Champions League questions matters more now,
  since the niche end of a list is where a wrong era would creep in.
