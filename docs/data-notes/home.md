# HOME questions: data notes

File: `app/data/questions/home.ts`. Lists verified on 10 November 2026 (`asOf: "2026-11-10"`).

## How the data was checked

- Everything from mid-2025 onwards was checked by web search on 10 November 2026, not from
  memory: the 2025-26 Premier League champion and Golden Boot, the 2025 and 2026 Ballon d'Or,
  the 2026 Champions League final (venue and winner), the 2026 World Cup winner, and
  Barcelona's ground for 2026-27.
- Full lists were then read back from the English Wikipedia list pages (fetched the same day):
  `Premier_League_Golden_Boot`, `List_of_Premier_League_winning_managers`,
  `List_of_European_Cup_and_UEFA_Champions_League_finals`, `Ballon_d'Or`.
- Birthplaces: the infobox `birth_place` of each person's English Wikipedia article and the
  Wikidata "place of birth" (P19) were pulled for all 84 people and compared. Where they
  disagree, the choice is listed under "Doubts" below.
- Coordinates: Wikipedia article coordinates (stadium articles, locality articles) and
  Wikidata P625, fetched through the MediaWiki API. Volksparkstadion, Parc des Princes and the
  Athens Olympic Stadium came from the German/French Wikipedia because the English article
  exposes none. A few low-precision city values (Amsterdam, Rotterdam, Aberdeen, Chester,
  Nördlingen, Lippstadt, Paramaribo, Salto, San Sebastián, Funchal, Oss) were replaced with
  the city-centre figure from the city's own article.
- Aliases were checked against `app/game/judge.ts`: every name and alias resolves to its own
  answer, no alias repeats a name or trailing "surname" the judge already accepts, and no
  normalised name or alias is shared by two answers in a question.

## Naming choices that follow from the judge

The judge accepts any trailing words of a name as a "surname". So:

- Stadium names are written so the trailing words are either unique and correct or shared:
  `Munich Olympic Stadium`, `Berlin Olympic Stadium`, `Athens Olympic Stadium`,
  `Atatürk Olympic Stadium`. Typing "Olympic Stadium" is reported as ambiguous (four
  candidates). "Olympiastadion Munich" and "Olympiastadion Berlin" are aliases. A bare
  "Olympiastadion" or "Munich" is not accepted, because adding it as an alias to two answers is
  not allowed by the data rules.
- `Ronaldo Nazário` is the display name of the Brazilian Ronaldo (Ballon d'Or question), with
  aliases such as "R9", "Ronaldo de Lima", "Brazilian Ronaldo", "O Fenômeno". "Ronaldo" was not
  added as an alias to either player. Consequence: a bare "Ronaldo" is read by the surname rule
  as Cristiano Ronaldo. See "Open points".
- "Milan" (European Cup clubs) and "City" (Premier League clubs) are ambiguous by the surname
  rule, which is the right outcome. No alias uses "United", "City", "Milan", "Manchester",
  "Madrid" (stadiums), "Munich" (stadiums), "FCB" or "CFC".

## 1. pl-winning-clubs (7 answers)

- Rule: Premier League titles only, 1992-93 to 2025-26. Pre-1992 First Division titles do not
  count.
- Verified by search: Arsenal won 2025-26 (85 points, first title since 2003-04). Arsenal were
  already an answer.
- Sources: premierleague.com season summary, Wikipedia list of Premier League winning managers
  (club title counts: Man Utd 13, Man City 8, Chelsea 5, Arsenal 4, Liverpool 2, Blackburn 1,
  Leicester 1).
- Grounds on 10 November 2026: Old Trafford, Ewood Park, Emirates Stadium, Stamford Bridge,
  Etihad Stadium, King Power Stadium, Anfield. None has changed; not individually re-searched.
- Liverpool's coordinates equal the Anfield pin in `app/data/stadiums.ts`, so Liverpool is 0 km
  on the Anfield day.
- Shots (2026-11-12): Chelsea is a toe poke, as the rule files its 12%, no longer moved up to a
  trivela by eye, so the question has an answer in each of the five shots that score (the
  reveal shows one of each; see `shots.md`). No fact or estimate changed.
- Left out: nothing.

## 2. pl-winning-managers (13 answers)

- Rule: the manager in charge when the title was won, 1992-93 to 2025-26.
- Verified by search: Mikel Arteta (Arsenal, 2025-26) is new. Arne Slot (2024-25) confirmed.
- Source: Wikipedia list of Premier League winning managers (13 names).
- Birthplaces: Ferguson is given as Govan, Glasgow and Dalglish as Dalmarnock, Glasgow (the
  Wikipedia infobox says only "Glasgow"; the districts are in the article text and Wikidata).
  Ranieri is Rome (city centre; he grew up in San Saba/Testaccio).
- Left out: nothing.

## 3. cl-final-stadiums (23 answers)

- Rule: the 34 finals from 1993 (1992-93 season) to 2026 (2025-26 season). One answer per
  stadium; a stadium rebuilt on the same site is one answer.
- Verified by search: the 2026 final was played at the Puskás Aréna, Budapest, on 30 May 2026
  (PSG beat Arsenal on penalties). 2025 was the Allianz Arena.
- Source: Wikipedia list of European Cup and Champions League finals.
- Venues by year: Munich Olympic 1993, 1997. Athens 1994, 2007. Vienna 1995. Rome 1996, 2009.
  Amsterdam 1998. Camp Nou 1999. Stade de France 2000, 2006, 2022. San Siro 2001, 2016.
  Hampden 2002. Old Trafford 2003. Gelsenkirchen 2004. Istanbul 2005, 2023. Moscow 2008.
  Bernabéu 2010. Wembley 2011, 2013, 2024. Allianz Arena 2012, 2025. Luz 2014, 2020. Berlin 2015. Cardiff 2017. Kyiv 2018. Metropolitano 2019. Porto 2021. Budapest 2026.
- Old names kept as aliases: Amsterdam Arena, Arena AufSchalke, Praterstadion, Giuseppe
  Meazza, Wanda Metropolitano, Principality Stadium, Lenin Stadium, Népstadion (the Puskás
  Aréna stands on the site of the old Népstadion / Puskás Ferenc Stadion).
- `place` is the host city as UEFA lists it: Stade de France is "Saint-Denis", Old Trafford is
  "Manchester" (it is in the borough of Trafford).
- Left out: nothing. The old Wembley only hosted finals before 1993; the present Wembley is the
  answer.

## 4. ballon-dor-winners (48 answers)

- Rule: every men's Ballon d'Or from 1956 to the 2026 ceremony, including the FIFA Ballon d'Or
  years 2010 to 2015. 2020 was not awarded. The 1989 "Super Ballon d'Or" and other trophies
  given at the ceremony are not counted (they add nobody anyway).
- Verified by search: Ousmane Dembélé won in 2025 (22 September 2025, Paris). The 2026 ceremony
  was held on 26 October 2026 at the London Palladium and Harry Kane won (several outlets, and
  the lead of his Wikipedia article).
- Source: Wikipedia `Ballon_d'Or` winners table, 1956 to 2026, read in full.
- Left out: nobody.

Doubts on birthplaces:

- **Ronaldo (Brazil)**: entered as Rio de Janeiro (-22.9111, -43.2056), the place almost every
  profile cites and the one used in the product brief. English Wikipedia now gives Itaguaí, a
  town about 60 km west in the same state (-22.852, -43.775). Swap if the lead prefers the
  Wikipedia value. It does not change his rank for any European pin.
- **Harry Kane**: entered as Walthamstow, London (the commonly cited place, and Wikidata).
  Wikipedia says he was born at Whipps Cross University Hospital in Leytonstone (51.578, 0.002)
  and that the family lived in Walthamstow. The two are about 2 km apart.
- **Rivaldo**: Recife (Wikipedia, Wikidata). Some Brazilian sources say Paulista, about 15 km
  north.
- **Eusébio**: Mafalala, Maputo (then Lourenço Marques). No source with coordinates for the
  Mafalala neighbourhood could be fetched; -25.950, 32.572 is my estimate, within about 2 km.
  Maputo city centre is -25.969, 32.573.
- **Josef Masopust**: Střimice, a village near Most that was later demolished for mining.
  Coordinates from the Czech Wikipedia article on Střimice.
- **Franz Beckenbauer**: Giesing, Munich. Coordinates are those of Obergiesing.
- **Zinedine Zidane**: La Castellane, Marseille (Wikipedia coordinates of the estate).
- **George Weah**: Clara Town, Monrovia. Wikipedia's coordinates are low precision (6.333,
  -10.800).
- **Alfredo Di Stéfano**: Barracas, Buenos Aires (the infobox says only Buenos Aires).
- **Lev Yashin, George Best, Johan Cruyff, Ruud Gullit, Ronaldo, Rodri and others born in a
  big city**: city-centre coordinates. Cruyff and Gullit therefore tie on Amsterdam.
- Countries are present-day: Yashin is Russia, Blokhin, Belanov and Shevchenko are Ukraine,
  Masopust and Nedvěd are the Czech Republic, Eusébio is Mozambique, Sammer and Müller Germany.

## 5. world-cup-winning-countries (8 answers)

- Rule: winners of the men's World Cup, 1930 to 2026. West Germany's titles (1954, 1974, 1990)
  belong to Germany, with "West Germany" as an alias and Berlin as the capital.
- Verified by search: Spain won the 2026 final, 1-0 after extra time against Argentina, on
  19 July 2026. Spain were already an answer (2010), so the list is still eight countries:
  Brazil, Germany, Italy, Argentina, France, Uruguay, Spain, England.
- England is listed as a country with London as its capital.
- Left out: nothing.

## 6. pl-golden-boot-winners (26 answers)

- Rule: the top scorer of every Premier League season from 1992-93 to 2025-26, including all
  players in shared seasons (1997-98, 1998-99, 2010-11, 2018-19, 2021-22).
- Verified by search: Erling Haaland won 2025-26 outright with 27 goals (premierleague.com).
  Mohamed Salah won 2024-25 outright.
- Source: Wikipedia `Premier_League_Golden_Boot`, all 34 seasons read back.
- Birthplace notes: Kane as in question 4. Agüero is Buenos Aires (he grew up in Quilmes).
  Mané is Bambali (some profiles say Sédhiou, the nearest town). Shearer is Gosforth, Newcastle
  upon Tyne and Sheringham is Highams Park, London. Cole and Sutton tie on Nottingham. Haaland
  was born in Leeds, England. Hasselbaink was born in Paramaribo, Suriname.
- Left out: nobody.

## 7. european-cup-winning-clubs (24 answers)

- Rule: winners of the European Cup / Champions League, 1955-56 to 2025-26.
- Verified by search: PSG won in 2025 and again in 2026. No new club since Manchester City in 2023. 24 clubs, matching the Wikipedia finals list.
- Grounds on 10 November 2026. Checked by search: Barcelona are back at the Camp Nou for
  2026-27 (reduced capacity, about 62,000, while building continues). Others are unchanged and
  were not individually re-searched: Milan and Inter still share San Siro, so they tie.
- **Steaua București**: the 1986 title is credited by UEFA to FCSB, the club that plays in the
  top flight, while Romanian courts have awarded the pre-2003 honours to the army club CSA
  Steaua. The answer is named "Steaua București" (aliases "Steaua Bucharest", "FCSB") and
  measured at FCSB's home, the Arena Națională. CSA Steaua's Stadionul Steaua is about 6 km
  away in the same city, so the choice cannot change a rank.
- Names: "AC Milan" and "Inter Milan", "Hamburg" (alias "Hamburger SV", "HSV"), "PSV
  Eindhoven", "Red Star Belgrade" (alias "Crvena Zvezda"), "Marseille".
- `place` uses the common city: City Ground is "Nottingham" (it is in West Bridgford), Old
  Trafford is "Manchester".
- Left out: nothing.

## Open points for the lead

1. A bare "Ronaldo" in the Ballon d'Or question silently becomes Cristiano Ronaldo. If it
   should ask instead, add the alias "Ronaldo" to both players: the judge then returns
   `ambiguous` with both candidates. The data rules forbid that alias, so it was not done.
2. In questions 1 and 5 the lists are short (7 and 8 answers), so the points steps are large
   (about 17 and 14 points per place).
3. Ties to expect: AC Milan and Inter (same ground), Cruyff and Gullit (Amsterdam), Cole and
   Sutton (Nottingham).

## Verification

Independent fact-check, 10 November 2026. Every list was rebuilt from scratch first (from
memory for anything up to mid-2025, by web search for everything after), then compared with
the file. Web search and fetch were available.

Result: no wrong, missing or duplicated answer was found in any of the seven lists, and no
coordinate or birthplace needed correcting. Counts are unchanged: 7, 13, 23, 48, 8, 26, 24
(149 answers).

### What was re-checked, and how

- Searched again, independently of the first pass: Arsenal won the 2025-26 Premier League
  (manager Mikel Arteta); Erling Haaland won the 2025-26 Golden Boot outright with 27 goals;
  the 2026 Champions League final was at the Puskás Aréna on 30 May 2026 and PSG beat Arsenal
  on penalties, so there is no new winning club; Spain beat Argentina 1-0 after extra time in
  the World Cup final on 19 July 2026; Harry Kane won the 2026 Ballon d'Or on 26 October 2026
  (uefa.com and the Wikipedia article on the 2026 award; one aggregator page that names
  another player was discarded); Barcelona are playing 2026-27 at the Camp Nou.
- Golden Boot: all 34 seasons read back from the Wikipedia table, including the five shared
  seasons. 26 different players.
- Coordinates: all 149 compared by script with the coordinates of the English Wikipedia
  article for the place (stadium or town) and, for the 87 people, with the Wikidata place of
  birth. Largest gap for a stadium: 20 m. Largest gap for a town against its own article:
  2.3 km (Abidjan); Střimice is 3.9 km from Most. Where Wikidata names a wider place than the
  file (Yahotyn for Dvirkivshchyna, Buenos Aires for Barracas, London for Walthamstow) the gap
  is larger, as expected, and the file's more specific place is the one in the player's
  Wikipedia article. The Athens Olympic Stadium, Parc des Princes and Volksparkstadion have no
  coordinates on the English article, so they were checked against Wikidata (all within
  40 m). No swapped signs, no swapped lat and lng, no same-name places.
- Ids: unique kebab-case ASCII within each question. `mode` is `home` and `asOf` is
  `2026-11-10` on all seven.
- Names and aliases: every name and alias run through `app/game/judge.ts`. None equals its
  own name, none repeats a surname the judge already accepts, none is shared by two answers,
  each resolves to its own answer. About 700 fan-style inputs (surnames, nicknames, typos, and
  well-known wrong answers) were then tried against the seven questions.

### Changes made

Four aliases added, all for inputs a fan could reasonably type that were rejected:

1. `cl-final-stadiums` / Johan Cruyff Arena: added "Johan Cruyff". The bare "Cruyff" was
   already accepted, so the fuller form being rejected was inconsistent.
2. `cl-final-stadiums` / Atatürk Olympic Stadium: added "Olympic Stadium Istanbul". The other
   Olympic stadiums accept both word orders; this one only accepted "Istanbul Olympic Stadium".
3. `cl-final-stadiums` / Allianz Arena: added "Football Arena Munich", the name UEFA used for
   the ground at the 2012 final ("Munich Football Arena" was already there).
4. `ballon-dor-winners` / Lev Yashin: added "Yachine". "Lev Yachine" was an alias, but the
   bare surname in that spelling is two edits from "Yashin" and was rejected.

Nothing else in the data file was changed.

### Could not be confirmed, or left for the lead

- **Ronaldo (Brazil)** stays at Rio de Janeiro, as the product brief states. Sources really do
  disagree: English Wikipedia, Wikidata (first value) and Biography.com say Itaguaí, 59 km
  west; Olympedia, Infopedia and Diário do Rio say Rio (Bento Ribeiro). No primary source was
  found. The choice matters a little: of the 21 pins in `app/data/stadiums.ts` it changes his
  points on three (Estadio Azteca 87 or 89, Rose Bowl 13 or 19, Cairo International 11 or 9)
  and nothing on the other 18, including Anfield and the Maracanã, where he is the best
  answer either way.
- **Eusébio**: there is still no citable coordinate for Mafalala. The estimate is 2.1 km from
  the centre of Maputo, well inside the 10 km tolerance.
- **The researcher's brief** (the exact order and wording of the seven prompts) was not
  available to the checker. The prompts are sensible and consistent with the lists, but the
  order and wording could not be compared with what was asked for.
- **Grounds**: only Barcelona's was searched. The other 26 clubs' grounds were checked from
  memory as unchanged in November 2026, not searched one by one.
- **Judge behaviour that data cannot fix** (for the owner of `app/game/judge.ts`):
  - European Cup clubs: "Bayer" is accepted as a typo of the alias "Bayern", so a player who
    means Bayer Leverkusen (never a winner) is credited with Bayern Munich.
  - World Cup countries: "East Germany" is accepted as a typo of "West Germany".
  - Ballon d'Or: a bare "Ronaldo" still resolves silently to Cristiano Ronaldo (open point 1
    above stands).
  - Stadiums: a bare "Olympiastadion" is rejected rather than reported as ambiguous.
