# RETRO and NEXT-GEN questions: data notes

Files: `app/data/questions/retro.ts` (`RETRO_QUESTIONS`) and `app/data/questions/next-gen.ts`
(`NEXT_GEN_QUESTIONS`), seven questions each, written on **2026-11-12** (`asOf`). Checked by
`app/data/era-data.test.ts`. The two modes are still locked; the game code for them comes later.

## The rules

The product owner's brief: "retro rewards based off the oldest answer and next gen is rewarded
based off most recent answer. E.g. name a team who won champions league: retro best answer would
be first ever team to win it and next gen best answer would be the team that won it most
recently."

- Every answer has `years`: **every** year that makes it a valid answer (title, final or hosting
  years), ascending, 1850 to 2026.
- **RETRO** ranks an answer by its **first** year (a club with several titles counts its first),
  **NEXT-GEN** by its **last**. Equal years tie.
- Which year a season or tournament counts as:
  - league seasons: the year the season ended (1888-89 is 1889, 2025-26 is 2026);
  - domestic cups: the year of the final (the Scottish Cup's 2019-20 final, played in December
    2020, is 2020);
  - tournaments: the year in the official edition name, even when it was played later: Euro 2020
    (played 2021) is 2020, the Tokyo 2020 Olympics (played 2021) are 2020, the FIFA Club World
    Cup 2022 (final February 2023) is 2022, the 1984 UEFA Super Cup (played January 1985) is 1984.
    This is the year Wikipedia's and the organisers' lists show.
- `shot` is filed for the question's own mode by the existing rule on the ranking year:
  `shotsFor(firstYears, "closest")` for RETRO (earlier is better, like a shorter distance) and
  `shotsFor(lastYears, "furthest")` for NEXT-GEN. No answer was moved by eye. Every question has
  at least one answer in each of the five scoring shots, both by that rule and by rank alone
  (the test checks both), so the reveal always has its five rows.
- `popularity` is estimated as for HOME and AWAY (`popularity.md`): household names and
  recent, frequent winners high, early, one-off and defunct winners low. Shares add up to 100,
  no tie at either end. Not used by RETRO or NEXT-GEN scoring; kept so any question can move to
  another mode.
- **Types.** `Answer` in `app/game/types.ts` gained an optional `years?: number[]` (the only edit
  there). The shared `Mode` is still `"home" | "away"` (widening it would break every
  `Record<Mode, ...>` in the art code), so `retro.ts` exports `EraMode` (`"retro" | "next-gen"`),
  `EraAnswer` (`Answer` with `years` required) and `EraQuestion` (`Question` with those two);
  `next-gen.ts` imports them. The game team can move them into `types.ts` when the modes go in.
  `app/data/index.ts` does not export the new sets yet.
- **Coordinates and places** follow the existing measures (a club's ground, a manager's
  birthplace, a country's capital). Values already in `home.ts` and `away.ts` were reused;
  the rest come from the English Wikipedia coordinates API (stadiums 4 decimal places, towns 3),
  Pujato (Scaloni's birthplace) from Wikidata. Grounds are the current ones from each club's
  Wikipedia infobox (Everton: Hill Dickinson Stadium since 2025; Huddersfield: Accu Stadium).
  Defunct clubs use their last or best-known ground, under the label "where the club plays its
  home games (or last did)".
- **Aliases** were kept to other spellings, short forms and well-known nicknames, and run
  through the real `judge()`: every name and alias resolves to its own answer and none is shared.
  Nicknames shared inside a question were left out (Newcastle keep "Magpies", Notts County do
  not; St Johnstone keep "Saints", St Mirren have "Buddies").

## Results checked on the web on 2026-11-12

The history comes from the Wikipedia lists named below (wikitext fetched 2026-11-12, every
list already including the 2025-26 seasons). Every result from 2025 onwards was also checked
in news reports:

| result                                                                                                           | source                                                                                                                                                                                                                                                       |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Premier League 2025-26: Arsenal (confirmed 19 May 2026)                                                          | [NBC Sports](https://www.nbcsports.com/soccer/news/arsenal-win-premier-league-title-for-first-time-in-22-years), [premierleague.com](https://www.premierleague.com/en/news/4668605/everything-thats-been-decided-in-202526-premier-league)                   |
| FA Cup 2026: Manchester City 1-0 Chelsea, 16 May 2026                                                            | [Fox Sports](https://www.foxsports.com/articles/soccer/manchester-city-wins-the-fa-cup-after-beating-chelsea-10-in-the-final)                                                                                                                                |
| League Cup 2026: Manchester City 2-0 Arsenal, 22 March 2026                                                      | [ESPN](https://africa.espn.com/football/report/_/gameId/401859837)                                                                                                                                                                                           |
| Scottish Cup 2026: Celtic 3-1 Dunfermline, 23 May 2026                                                           | [Scottish FA](https://www.scottishfa.co.uk/en/news/celtic-complete-domestic-double-with-victory-in-scottish-gas-mens-scottish-cup-final)                                                                                                                     |
| Serie A 2025-26: Inter (clinched 3 May 2026)                                                                     | [Inter](https://www.inter.it/en/news/inter-statistics-numbers-scudetto-2025-26), [Flashscore](https://www.flashscore.com/news/soccer-serie-a-chivu-s-imperious-inter-milan-clinch-serie-a-title-with-three-rounds-to-spare/l0PNSmb4/)                        |
| Bundesliga 2025-26: Bayern Munich (clinched 19 April 2026)                                                       | [Al Jazeera](https://www.aljazeera.com/sports/2026/4/20/kane-scores-as-bayern-munich-claim-bundesliga-title-with-stuttgart-victory), [FC Bayern](https://fcbayern.com/en/news/matchreports/2026/04/match-report-bundesliga-fc-bayern-v-vfb-stuttgart-190426) |
| Ligue 1 2025-26: Paris Saint-Germain (clinched 13 May 2026)                                                      | [PSG](https://www.psg.fr/en/content/pr-paris-saint-germain-crowned-as-french-champions-for-fifth-time-in-a-row)                                                                                                                                              |
| World Cup 2026 final: Spain 1-0 Argentina a.e.t., MetLife Stadium, 19 July 2026; Spain's coach Luis de la Fuente | [ESPN](https://www.espn.com/soccer/story/_/id/49402253/), [NPR / St. Louis Public Radio](https://www.stlpr.org/npr/2026-07-18/spain-is-the-2026-world-cup-champion-defeating-argentina-for-its-2nd-title)                                                    |
| UEFA Super Cup 2026: PSG 2-1 Aston Villa, 12 August 2026 (2025: PSG beat Tottenham on penalties)                 | [Al Jazeera](https://www.aljazeera.com/sports/2026/8/12/psg-win-back-to-back-uefa-super-cups-with-victory-over-aston-villa)                                                                                                                                  |
| FIFA Club World Cup 2025: Chelsea 3-0 PSG, 13 July 2025                                                          | [beIN Sports](https://www.beinsports.com/en-mena/football/fifa-club-world-cup/articles-video/chelsea-beat-psg-3-0-in-final-to-win-club-world-cup-2025-07-13)                                                                                                 |
| Olympic men's football 2024: Spain 5-3 France a.e.t.                                                             | [Olympics.com](https://olympics.com/en/news/paris-2024-football-men-spain-win-gold-over-france)                                                                                                                                                              |

Earlier recent results confirmed in the same lists: Crystal Palace FA Cup 2025, Newcastle
League Cup 2025, Aberdeen Scottish Cup 2025, Liverpool league 2025, Napoli Serie A 2025,
Leverkusen Bundesliga 2024, Real Madrid Super Cup 2024, Spain Euro 2024 (final against England).

## RETRO

### 1. english-top-flight-champions (24 answers)

- "Name a club that has won the English top flight": Football League (First Division) 1888-89
  to 1991-92 and Premier League since. Source: Wikipedia, List of English football champions
  (table by club). Oldest: Preston North End 1889; newest first title: Leicester City 2016.
- Left out: nothing. Doubts: none.

### 2. italian-league-champions (16 answers)

- "Name a club that has won the Italian league": every official Italian champion since 1898
  (Campionato Italiano, Prima Categoria, Prima Divisione, Divisione Nazionale, Serie A). Source:
  Wikipedia, List of Italian football champions. Oldest: Genoa 1898; newest: Sampdoria 1991.
- Torino's revoked 1927 title is not a year; Juventus's revoked 2005 and the unassigned-to-them
  2006 are not years (2006 is Inter's, as the FIGC assigned it). 1921-22 had two champions,
  Novese (FIGC) and Pro Vercelli (CCI): both count. Genoa's 1915 title, awarded in 1919, counts.
- Casale is measured at the centre of Casale Monferrato (the Stadio Natale Palli has no
  coordinates on Wikipedia). Genoa and Sampdoria share the Ferraris, Milan and Inter San Siro,
  Roma and Lazio the Olimpico. "Milan" is an alias of AC Milan only.

### 3. fa-cup-winning-clubs (45 answers)

- Every FA Cup winner, 1872 to 2026. Source: Wikipedia, List of FA Cup finals (finals table,
  replays included, cross-checked against its table by club). Oldest: Wanderers 1872; newest
  first win: Crystal Palace 2025.
- Sheffield Wednesday include The Wednesday's 1896 and 1907 wins. Wimbledon is the defunct
  Wimbledon FC (1988, Plough Lane); AFC Wimbledon and MK Dons are not aliases.
- Places of the 1870s amateur clubs are approximate: Wanderers at The Oval (where they mostly
  played), Royal Engineers at Chatham, Old Etonians at Eton, Old Carthusians at Charterhouse
  (Godalming), Clapham Rovers on Clapham Common, Blackburn Olympic at Blackburn town centre.

### 4. euro-host-countries (20 answers)

- Every country that hosted the men's European Championship finals, 1960 to 2024. Source:
  Wikipedia, UEFA European Championship (results table and its note on Euro 2020). Oldest:
  France 1960; newest first time: the six Euro 2020 debutants.
- Euro 2020 counts all eleven host countries (Azerbaijan, Denmark, England, Germany, Hungary,
  Italy, Netherlands, Romania, Russia, Scotland, Spain) as 2020. Ireland, dropped as a host
  before the tournament, is not an answer. Euro 2028 and 2032 hosts are not answers yet.
- West Germany (1988) is the answer Germany, measured at Berlin, as in `away.ts`.

### 5. euro-final-countries (14 answers)

- Every country that played in a men's Euro final, 1960 to 2024. Source: Wikipedia, List of
  UEFA European Championship finals. Oldest: Soviet Union and Yugoslavia 1960 (tied); newest
  first final: England 2020.
- Successor states are separate: Russia and Serbia are not aliases; Czechoslovakia (1976) and
  the Czech Republic (1996) are two answers.

### 6. world-cup-winning-managers (22 answers)

- The head coach of every men's World Cup winner, 1930 to 2026. Source: Wikipedia, List of FIFA
  World Cup winning managers (already listing Luis de la Fuente for 2026), and each manager's
  article for the birthplace. Oldest: Alberto Suppici 1930; newest: Luis de la Fuente 2026.
- 1950 had a final group; Juan López (Uruguay) is its winning coach.

### 7. olympic-football-gold-countries (19 answers)

- Every men's Olympic football champion, 1900 to 2024. Source: Wikipedia, Football at the
  Summer Olympics (men's results). Oldest: Great Britain 1900; newest first gold: Brazil 2016.
- **Doubt:** the 1900 (Upton Park FC for Great Britain) and 1904 (Galt FC for Canada) tournaments
  were played by club sides. The IOC counts them as official, FIFA does not. They are kept;
  removing them would make Great Britain 1908 the oldest and drop Canada.
- 1920: Belgium were awarded gold after Czechoslovakia walked off in the final.
- "Germany" and "West Germany" are decoys: neither won gold, and without the decoys the judge's
  last-word rule would give them East Germany. "England" is not an alias of Great Britain.

## NEXT-GEN

### 1. bundesliga-champions (13 answers)

- Bundesliga champions only, 1963-64 to 2025-26 (earlier German championships are not
  answers). Source: Wikipedia, List of German football champions (Bundesliga table and table by
  club). Newest: Bayern Munich 2026 (34 Bundesliga titles); oldest last title: 1860 Munich 1966.

### 2. ligue-1-champions (18 answers)

- "Name a club that has won Ligue 1 (1932 onwards)": professional-era French champions,
  1932-33 to 2025-26. Source: Wikipedia, List of French football champions (professional-era
  table). Newest: Paris Saint-Germain 2026; oldest last title: Racing Club de Paris 1936.
- **Doubt:** the 1933 title was won by Olympique Lillois, a predecessor of Lille OSC. Wikipedia
  credits it to Lille, which is followed (with "Olympique Lillois" as an alias); it only moves
  Lille's first year, not its last (2021).
- Racing Club de Paris (1936) is measured at its ground of the time, the Stade Olympique
  Yves-du-Manoir in Colombes. CO Roubaix-Tourcoing (1947) is defunct: Stade Amédée-Prouvost,
  Wattrelos. Metz appear in the source only as runners-up.
- Review fix (2026-11-13): Monaco's 1999-2000 title (2000) had been left out of its `years`
  (8 titles: 1961, 1963, 1978, 1982, 1988, 1997, 2000, 2017). Its last year is still 2017, so
  no rank or shot moved.

### 3. league-cup-winning-clubs (24 answers)

- Every Football League Cup (EFL Cup) winner, 1961 to 2026. Source: Wikipedia, List of EFL Cup
  finals (winners by club). Newest: Manchester City 2026; oldest last win: West Bromwich Albion 1966.

### 4. scottish-cup-winning-clubs (25 answers)

- Every Scottish Cup winner, 1874 to 2026. Source: Wikipedia, List of Scottish Cup finals
  (finals table, cross-checked with its table by club). Newest: Celtic 2026; oldest last win:
  Vale of Leven 1879.
- 1909 is nobody's year (the cup was withheld after the replay riot). Third Lanark include
  1889 as 3rd Lanark RV. Airdrieonians is the original club (1878-2002, 1924 cup, last ground the
  Excelsior Stadium); "Airdrie" is accepted. St Bernard's (1895, defunct) is measured at
  Edinburgh city centre; their grounds are uncertain in the sources.

### 5. world-cup-final-countries (13 answers)

- Every country that played in a men's World Cup final, 1930 to 2026. Source: Wikipedia, List of
  FIFA World Cup finals; 2026 checked in news reports (above). Newest: Spain and Argentina
  2026 (tied); oldest last final: Uruguay 1950.
- 1950 had no final; the deciding match of the final group (Uruguay v Brazil) counts, as in
  `away.ts`. West Germany is the answer Germany.

### 6. club-world-cup-winning-clubs (12 answers)

- FIFA Club World Cup winners only: 2000, 2005 to 2023 and 2025. Source: Wikipedia, FIFA Club
  World Cup (performances by club). Newest: Chelsea 2025; oldest last win: São Paulo 2005.
- **Not included:** the Intercontinental Cup (1960-2004) and the FIFA Intercontinental Cup
  (2024 onwards), although FIFA calls their winners club world champions too. The prompt names
  the FIFA Club World Cup to keep that clear.

### 7. uefa-super-cup-winning-clubs (26 answers)

- Every UEFA Super Cup winner, 1973 to 2026. Source: Wikipedia, List of UEFA Super Cup matches
  (performance by club). Newest: Paris Saint-Germain 2026; oldest last win: Dynamo Kyiv 1975.
- The 1972 match (Ajax) was not organised or recognised by UEFA and is not a year. No Super Cup
  was played in 1974, 1981 or 1985.

## Left out

No valid answer was left out of any list. Nothing that could not be confirmed was used.

## Doubts

- The year rule for tournaments played a year late (Euro 2020, Tokyo 2020, Club World Cups
  played in February) is a choice; using the year of play instead would change no question's
  best answer and only a few ties.
- Popularity and the places of defunct clubs are estimates, as described above.
