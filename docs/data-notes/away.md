# AWAY questions: data notes

File: `app/data/questions/away.ts`. All seven lists checked on **2026-11-10** (`asOf`).

## How the data was checked

- **Anything from mid-2025 onwards was checked by web search on 2026-11-10**, not taken from
  memory: the 2026 World Cup (hosts, final venue, top scorer), the 2026 Champions League and
  Europa League finals, the 2025 Copa Libertadores final and the date of the 2026 final, the
  2025 Africa Cup of Nations and its disputed result, and every club ground that might have
  changed (see question 4 and 7).
- **Coordinates** come from the English Wikipedia coordinates API (and Wikidata where the API
  had none), each compared against an independent hand value. Stadiums are 4 decimal places
  (pitch centre as given by Wikipedia), towns and capitals 3 decimal places. Where Wikipedia
  only gives a town to the nearest arc-minute, a hand-checked town-centre value within a few
  km of it is used instead (Mexico City, Viareggio, Lörrach, Mönchengladbach, Reggiolo,
  Schaffhausen, Gijón, Heidelberg, Krumbach, Parque Patricios, Recife, Malbork, Bell Ville,
  Plovdiv, Weilheim, Yaoundé, Accra, Abuja, Abidjan, Brazzaville, Lusaka).
- **Aliases** were run through the real `judge()`: every name and alias resolves to its own
  answer, no alias is shared by two answers in a question, and aliases the judge already
  covers (accents, case, hyphens, apostrophes, dots, leading "the", a unique trailing word such
  as "Azteca", "Van Gaal", "Leverkusen") were removed.

## 1. world-cup-hosts (19 answers)

- Rule: every country that staged a men's World Cup, 1930 to 2026. Co-hosts all count
  (South Korea and Japan 2002; United States, Canada and Mexico 2026). Future hosts (2030, 2034) are not included.
- Sources: FIFA tournament list (long-standing facts); 2026 hosts and the fact that the
  tournament was played confirmed by search (final 19 July 2026, Spain 1-0 Argentina a.e.t.).
- West Germany (1974) is the answer **Germany**, alias `West Germany`, measured at Berlin (the
  capital in 1974 was Bonn).
- South Africa is measured at Pretoria, as instructed. England is measured at London.
- Left out: nothing.
- Doubts: none on the list. `UK`/`Britain` are deliberately not aliases for England.

## 2. world-cup-final-stadiums (21 answers)

- Rule: the stadium of each final, 1930 to 2026. 1950 had a final group, so the Maracanã
  (deciding match, Uruguay v Brazil) is used. 23 tournaments, 21 stadiums: the Maracanã (1950, 2014) and the Azteca (1970, 1986) hosted twice.
- Sources: Wikipedia pages of each stadium and final; 2026 final at MetLife Stadium confirmed
  by search.
- Rebuilt on the same site, one answer: Wembley (1966, old stadium; coordinates of the current
  pitch), Wankdorf (1954; now Stadion Wankdorf / Stade de Suisse).
- **Stadio Nazionale PNF** (1934, Rome) was demolished in 1953 and the Stadio Flaminio was
  built on the site. The answer keeps the 1934 name; `Stadio Flaminio` and `Flaminio` are
  aliases under the same-site rule, although the Flaminio itself never hosted a final. Remove
  those two aliases if that is too generous.
- **Råsunda** (1958, Solna) was demolished in 2013 and not rebuilt; coordinates are the former
  pitch. Friends Arena is a different site and is not an alias.
- Names: `Soccer City` with aliases `FNB Stadium` and `FNB` (changed in verification, see the end
  of this file); `Estadio Azteca` with aliases `Estadio Banorte`
  (sponsor name since 2025) and `Mexico City Stadium` (FIFA name in 2026); `MetLife Stadium`
  with alias `New York New Jersey Stadium`; `International Stadium Yokohama` with alias
  `Nissan Stadium`.
- The two Olympiastadions are named `Olympiastadion Munich` and `Olympiastadion Berlin`.
  "Munich" and "Berlin" alone are accepted by the judge's trailing-word rule. A bare
  "Olympiastadion" or "Olympic Stadium" is **not recognised** (it could be Munich, Berlin or
  Rome). The judge can return "ambiguous" for an alias shared by two answers, so the lead
  could add a shared alias if a "which one?" prompt is wanted; the brief said not to.
- Left out: nothing.

## 3. cl-winning-managers (19 answers)

- Rule: the winning head coach of every final from 1993 (first Champions League season) to 2026. 34 finals, 19 managers.
- Sources: UEFA/Wikipedia list of winning managers; 2025 (PSG 5-0 Inter) and 2026 (PSG beat
  Arsenal on penalties after 1-1, Budapest, 30 May 2026) confirmed by search: Luis Enrique
  both times, so 2026 adds no new name.
- Birthplaces (Wikipedia): Goethals Forest (Brussels); Capello San Canzian d'Isonzo; Van Gaal
  and Rijkaard Amsterdam (they tie); Lippi Viareggio; Hitzfeld Lörrach; Heynckes
  Mönchengladbach; Ferguson Govan (Glasgow); Del Bosque Salamanca; Ancelotti Reggiolo; Mourinho
  Setúbal; Benítez Madrid; Guardiola Santpedor; Di Matteo Schaffhausen (Switzerland); Luis
  Enrique Gijón; Zidane La Castellane (Marseille); Klopp Stuttgart; Flick Heidelberg; Tuchel
  Krumbach.
- Less than certain: Capello is often given as born in Pieris, a hamlet of San Canzian
  d'Isonzo about 2 km from the town centre used here. Zidane's coordinates are the La
  Castellane estate, not central Marseille (about 8 km apart).
- Left out: nothing. Marseille's 1993 title stands with UEFA, so Goethals is included.

## 4. libertadores-winning-clubs (27 answers)

- Rule: every champion 1960 to 2025. The 2025 final (Flamengo 1-0 Palmeiras, Lima, 29 November 2025) and the date of the 2026 final (28 November 2026, Montevideo: **after** today, so not
  included) were confirmed by search. Update this list after 28 November 2026 if a new club wins (reported finalists: Palmeiras and Estudiantes, both already in the list).
- Grounds are the club's home on 2026-11-10. Checked by search:
  - **Palmeiras**: the stadium was renamed **Nubank Parque** in 2026 (was Allianz Parque).
  - **Olimpia**: its own ground (Manuel Ferreira / Osvaldo Domínguez Dibb) has been demolished
    for a rebuild due in 2029. Home games are at **Estadio Defensores del Chaco** (about 3 km
    away). Sources for 2026 fixtures were not fully consistent; treat as probable.
  - **Santos**: still at **Vila Belmiro** in October 2026 (home games reported there). The
    stadium is due to be demolished for a new arena, with a move to the Pacaembu planned; no
    confirmed date found. Re-check.
  - **Vasco da Gama**: still at **São Januário** (home fixtures there in November 2026). A
    renovation with a temporary move to the Nilton Santos has been planned but not started.
  - **Corinthians**: stadium still called Neo Química Arena in October 2026, but the club is
    reported to be seeking a new naming sponsor. The name may change; the place does not.
- Flamengo and Fluminense both play at the Maracanã: same coordinates, so they always tie.
- Names: the Uruguayan club is `Nacional` and the Colombian club `Atlético Nacional`. Typing
  "Nacional" gives the Uruguayan club (exact name match). `Atlético` alone is not an alias
  (Nacional or Mineiro). `Inter` is an alias of Internacional here.
- Arena MRV (Atlético Mineiro): sources differ by about 190 m on the coordinates. The value
  now used is the one English Wikipedia and OpenStreetMap agree on (changed in verification).
- Left out: nothing.

## 5. world-cup-golden-boot-winners (31 answers)

- Rule: **every player who finished a World Cup with the highest goal tally**, 1930 to 2026.
  This is the official top scorer list, plus joint top scorers.
  - 1962: six players on 4 goals (Garrincha, Vavá, Leonel Sánchez, Flórián Albert, Valentin
    Ivanov, Dražan Jerković).
  - 1994: Stoichkov and Salenko, 6 each (both received the award).
  - **2010: four players on 5 goals.** Thomas Müller won the Golden Boot on assists; David
    Villa (Silver Boot), Wesley Sneijder (Bronze Boot) and Diego Forlán had the same number of
    goals. All four are in the list because the prompt says "top scorer" and the brief asked
    for shared top scorers. **If only award winners should count, delete the three entries
    marked with a comment in the file** (the list becomes 28).
  - 1934: FIFA's current record credits Oldřich Nejedlý with 5 goals as sole top scorer.
    Older lists show a three-way tie on 4 with Angelo Schiavio and Edmund Conen; those two are
    left out.
- 2026: Kylian Mbappé, 10 goals (Messi 8), confirmed by search. He also won in 2022, so 2026
  adds no new name.
- Birthplaces (Wikipedia): Stábile Parque Patricios (Buenos Aires); Nejedlý Žebrák; Leônidas
  and Ronaldo Rio de Janeiro (they tie, city-centre coordinates); Ademir and Vavá Recife (tie);
  Kocsis Budapest; Fontaine Marrakech; Garrincha Pau Grande (Magé); Sánchez Santiago; Albert
  Hercegszántó; Ivanov Moscow; Jerković Šibenik; Eusébio Maputo (then Lourenço Marques); Gerd
  Müller Nördlingen; Lato Malbork; Kempes Bell Ville; Rossi Prato; Lineker Leicester; Schillaci
  Palermo; Stoichkov Plovdiv; Salenko Saint Petersburg (then Leningrad); Šuker Osijek; Klose
  Opole (Poland); Thomas Müller Weilheim in Oberbayern; Villa Tuilla (Langreo); Sneijder
  Utrecht; Forlán Montevideo; James Rodríguez Cúcuta; Kane Walthamstow (London); Mbappé Paris.
- `Ronaldo` is the answer's name (Cristiano Ronaldo is not an answer). "Müller" alone is
  ambiguous between Gerd and Thomas, which the judge reports.
- Less than certain: the district-level places (Ronaldo is often tied to Bento Ribeiro, Mbappé
  to the 19th arrondissement or to Bondy where he grew up); the city is used for both.

## 6. afcon-winning-countries (15 answers)

- Rule: every champion from 1957 to the 2025 tournament (played 21 December 2025 to 18 January 2026), the most recent one completed. The next is in 2027.
- **The 2025 title is disputed.** Senegal beat Morocco 1-0 in the final; in March 2026 the CAF
  Appeal Board ruled the match a 3-0 forfeit to Morocco; Senegal appealed to CAS, whose award
  was reported as expected at the end of November 2026. Both countries had already won the
  tournament (Morocco 1976, Senegal 2021), so the list is the same either way.
- Successor names: Zaire (1974) and Congo-Kinshasa (1968) are **DR Congo**; the United Arab
  Republic (1959) is **Egypt**; Congo (1972, then the People's Republic of the Congo) is the
  Republic of the Congo, shown as **Congo** (its FIFA and CAF name).
  - Typing "Congo" gives Congo (Brazzaville), by exact name. "DR Congo", "DRC", "Zaire",
    "Congo DR", "Congo-Kinshasa" give DR Congo. Kinshasa and Brazzaville are about 7 km apart,
    so the two are always next to each other in the table.
- Capitals:
  - **Ivory Coast is measured at Yamoussoukro** (6.816, -5.274), the official capital since 1983. The first version used Abidjan (5.336, -4.026), where most of the government sits;
    changed in verification, see the end of this file.
  - South Africa: Pretoria. Nigeria: Abuja. Egypt: Cairo (the government now sits in the New
    Administrative Capital, but Cairo is still the capital). Sudan: Khartoum (the government
    worked from Port Sudan during the war; Khartoum remains the capital).
- Team nicknames are included as aliases where unambiguous (`Super Eagles`, `Black Stars`,
  `Bafana Bafana`, ...).
- Left out: nothing.

## 7. europa-league-winning-clubs (31 answers)

- Rule: every winner of the UEFA Cup (1972 to 2009) and Europa League (2010 to 2026). The
  Inter-Cities Fairs Cup is not counted (so no Barcelona, Leeds, Newcastle, Arsenal, Roma,
  Ferencváros, Dinamo Zagreb, Zaragoza).
- Sources: UEFA/Wikipedia list; 2025 (Tottenham) known; **2026: Aston Villa 3-0 Freiburg,
  Istanbul, 20 May 2026**, confirmed by search. Aston Villa is the one new club.
- Grounds on 2026-11-10, checked by search where a change was possible:
  - **Shakhtar Donetsk** have not been able to play in Donetsk since 2014. They are measured
    at **Arena Lviv**, where they play league home games in 2026-27 (confirmed from the club's
    own match report, August 2026). Their 2026-27 Champions League home games are at Stamford
    Bridge. This is the least stable entry in the file; an alternative is the Donbas Arena
    (48.0209, 37.8097) as the club's official home, or leaving the club out.
  - **Valencia**: still at Mestalla; the Nou Mestalla is due in summer 2027.
  - **Parma**: still at the Tardini (rebuild not started).
  - **Atalanta**: the Stadio di Bergamo is called New Balance Arena since September 2025.
  - **Anderlecht**: Lotto Park (name confirmed for 2026-27).
  - Sponsor names used as the common name: Allianz Stadium (Juventus), Deutsche Bank Park
    (Frankfurt), Rams Park (Galatasaray), Gazprom Arena (Zenit), Veltins-Arena (Schalke).
    Neutral names used where they are the common ones: San Siro, Metropolitano, Mestalla.
- Names and aliases:
  - The answer is `Inter` (alias `Inter Milan`, `Internazionale`), not `Inter Milan`: with
    the longer name the judge's trailing-word rule would accept a bare "Milan" for Inter, and
    AC Milan never won this cup.
  - `Bayer` is an alias of Bayer Leverkusen; without it the typo matcher reads "Bayer" as
    "Bayern". A one-letter typo between the two is reported as ambiguous.
  - "Madrid" alone is ambiguous (Real, Atlético). `Real` and `Atlético` are aliases, each
    unique in this question. "United" resolves to Manchester United through the judge's
    trailing-word rule (it is the only United in the list); it is not an alias.
- Left out: nothing.

## Things that will go stale

- Copa Libertadores: final on 28 November 2026.
- AFCON 2025: CAS award (does not change the list).
- Grounds: Santos, Vasco da Gama, Olimpia, Shakhtar Donetsk, Valencia (2027), stadium sponsor
  names (Corinthians, Palmeiras, Atalanta, Juventus, Frankfurt, Galatasaray).

## Verification

Independent check on **2026-11-10**. Each list was rebuilt from scratch and compared with the
file. Every coordinate was compared by script with the English Wikipedia coordinates API, or
with Wikidata or OpenStreetMap for the pages that expose none. Every name and alias was run
through `judge()`, together with about 450 other inputs a fan might type. WebSearch was
available and was used for everything after mid-2025.

### Result per question

| question                      | before | after | list changes |
| ----------------------------- | ------ | ----- | ------------ |
| world-cup-hosts               | 19     | 19    | none         |
| world-cup-final-stadiums      | 21     | 21    | none         |
| cl-winning-managers           | 19     | 19    | none         |
| libertadores-winning-clubs    | 27     | 27    | none         |
| world-cup-golden-boot-winners | 31     | 31    | none         |
| afcon-winning-countries       | 15     | 15    | none         |
| europa-league-winning-clubs   | 31     | 31    | none         |

No answer was missing, wrong or duplicated. No coordinate had a swapped sign, swapped
latitude and longitude, or belonged to a different place of the same name.

### Changes made

1. **afcon-winning-countries, Ivory Coast: Abidjan (5.336, -4.026) changed to Yamoussoukro
   (6.816, -5.274).** The measure line reads "the country's capital city", and the official
   capital is Yamoussoukro (confirmed by search, no change in 2026). Abidjan is where most of
   the government works, but a player who reads "Ivory Coast: Abidjan" in the table will take
   it for a mistake. The move is 215 km. To go back, restore the two numbers and the place.
2. **libertadores-winning-clubs, Atlético Mineiro (Arena MRV): -19.9306, -44.0161 changed to
   -19.93, -44.0144.** The old value (Wikidata) is about 190 m west of the pitch. English
   Wikipedia and the OpenStreetMap stadium outline agree on the new one.
3. **world-cup-final-stadiums: the answer `FNB Stadium` (id `fnb-stadium`) is now
   `Soccer City` (id `soccer-city`)**, with `FNB Stadium` and `FNB` as aliases. This is the
   name it had at the 2010 final and the name of the same ground in `app/data/stadiums.ts`, so
   the pin and the table no longer disagree on day 7. Its longitude went from 27.9822 to 27.9826 to match the pin exactly.
4. **Aliases added**: `Bafana` (South Africa, AFCON), `Nacional Medellín` (Atlético Nacional:
   "Nacional de Medellín" was accepted but the form without "de" was not), `FNB` (Soccer City).

### Confirmed by search on 2026-11-10

- World Cup 2026: final at MetLife Stadium, East Rutherford (Spain 1-0 Argentina after extra
  time). Golden Boot: Kylian Mbappé, 10 goals, the first player to win it twice. No new name.
- Champions League 2026: Paris Saint-Germain beat Arsenal on penalties in Budapest, 30 May 2026. Luis Enrique. No new name.
- Europa League 2026: Aston Villa 3-0 Freiburg, Istanbul, 20 May 2026.
- Copa Libertadores: Flamengo won in 2025 (Lima). The 2026 final is Palmeiras v Estudiantes at
  the Estadio Centenario on 28 November 2026. Both are already in the list, so the list will
  not change this year; only the `asOf` date will need moving.
- AFCON 2025: the CAF Appeal Board, on 17 March 2026, recorded the final as a 3-0 forfeit to
  Morocco. Senegal's appeal to CAS was still open in the reports found. The list is the same
  either way.
- Grounds: Palmeiras at Nubank Parque (renamed 4 May 2026); Atalanta at New Balance Arena
  (renamed 25 September 2025); Galatasaray at Rams Park (2026-27); Corinthians still at Neo
  Química Arena (talks with Caixa over the name were open in mid-October 2026); Vasco da Gama
  at São Januário (home to Corinthians there on 24 October 2026, rebuild not started); Santos
  at Vila Belmiro; Olimpia at Defensores del Chaco (league and Libertadores home games there in
  September 2026); Colo-Colo at the Monumental (rebuild planned in stages without moving out);
  Shakhtar Donetsk at Arena Lviv for league home games in 2026-27 and at Stamford Bridge for
  Champions League home games.

### Could not confirm, or left for the lead to decide

- **Order and wording of the seven questions**: the brief the researcher was given is not in
  the repository, so these could not be compared with it. Ids, modes and `asOf` are right.
- **2010 joint top scorers** (David Villa, Wesley Sneijder, Diego Forlán): kept. They finished
  level on goals with Thomas Müller, but the prompt also says "(Golden Boot winner)" and only
  Müller won that. Delete the three for a strict reading (28 answers).
- **Shakhtar Donetsk at Arena Lviv**: kept. It is where they play league home games, but it is
  not their ground and they move often. The Donbas Arena (48.0209, 37.8097) is the alternative.
- **`Stadio Flaminio` and `Flaminio` as aliases of Stadio Nazionale PNF**: kept (same site,
  the same rule as `Stade de Suisse` for the Wankdorf). The Flaminio itself never hosted a
  final.
- **Grounds not searched one by one**: the European grounds other than those named above, and
  the Argentine, Uruguayan, Colombian and Ecuadorian grounds, were taken as unchanged from
  what was known in mid-2026.
- **São Januário coordinates** could not be fetched by script from Wikipedia, Wikidata or
  OpenStreetMap; the value matches the one remembered from Wikipedia. Gran Parque Central was
  checked against OpenStreetMap only (10 m).
- **Fabio Capello**: San Canzian d'Isonzo kept (the hamlet of Pieris is 2 km away).
- **Birthplaces given as a whole city** (Ronaldo and Leônidas in Rio de Janeiro, Mbappé in
  Paris, Benítez in Madrid) use the city centre. Ronaldo's district, Bento Ribeiro, is about
  20 km from the centre of Rio, which only matters when the pin is the Maracanã.

### Judge behaviour that the data cannot fix (for the owner of `app/game/judge.ts`)

Typo forgiveness accepts a few answers that are wrong, because they are one or two letters
from a right one:

- world-cup-hosts: "North Korea" gives South Korea; "South America" gives South Africa.
- afcon-winning-countries: "Gambia" gives Zambia.
- libertadores-winning-clubs: "Atlético-PR" and "Atlético-GO" give Atlético Mineiro (through
  the alias `Atlético-MG`).
- world-cup-golden-boot-winners: "David Silva" gives David Villa; "Alberto" gives Flórián
  Albert.
- europa-league-winning-clubs: "Palma" gives Parma.

And one gap: in world-cup-final-stadiums a bare "Olympiastadion" or "Olympic Stadium" is not
recognised, though three answers fit it. The data test forbids an alias shared by two answers,
so this needs a judge feature (a "which one?" prompt), not a data change.
