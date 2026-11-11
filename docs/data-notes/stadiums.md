# Data notes: daily stadiums

Checked on 2026-11-10 for `app/data/stadiums.ts`.

## Method

- Every coordinate is the centre of the `leisure=pitch` outline inside the stadium in
  OpenStreetMap (Overpass API, data timestamp 2026-11-10), rounded to 4 decimal places
  (about 11 m).
- Each one was cross-checked against the coordinates on the stadium's English Wikipedia article,
  or its Wikidata item where the article exposes none through the API. The difference is given
  on each line. The largest is 55 m.
- Names are the ones fans use. A traditional name is preferred over a sponsor name. Accents are
  kept in `name`. `id` is plain ASCII.
- Countries use the football nation: England and Scotland, not United Kingdom.

## One line per stadium

| day | id                          | lat, lng           | source                                                 | naming and status                                                                                                                        |
| --- | --------------------------- | ------------------ | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | anfield                     | 53.4308, -2.9608   | OSM way 124589354. Wikipedia agrees to 5 m             | No naming choice                                                                                                                         |
| 2   | maracana                    | -22.9121, -43.2302 | OSM way 1361281074. Wikipedia agrees to 13 m           | "Maracanã", not the official "Estádio Jornalista Mário Filho"                                                                            |
| 3   | japan-national-stadium      | 35.6778, 139.7145  | OSM way 774932431. Wikipedia is 55 m north             | Renamed "MUFG Stadium" by a sponsor in January 2026. Traditional name kept                                                               |
| 4   | santiago-bernabeu           | 40.4531, -3.6884   | OSM way 1446479375. Wikipedia agrees to 6 m            | Wikipedia now titles it "Bernabéu". "Santiago Bernabéu" is still what fans say                                                           |
| 5   | estadio-azteca              | 19.3029, -99.1505  | OSM way 118934909. Wikipedia agrees to 8 m             | Sponsor name "Estadio Banorte". Traditional name kept                                                                                    |
| 6   | san-siro                    | 45.4781, 9.1240    | OSM way 218520544. Wikipedia agrees to 11 m            | "San Siro", not the official "Stadio Giuseppe Meazza"                                                                                    |
| 7   | soccer-city                 | -26.2347, 27.9826  | OSM way 119208355. Wikipedia is 44 m west              | Sponsor name "FNB Stadium". "Soccer City" is the non-sponsor name used at the 2010 World Cup                                             |
| 8   | la-bombonera                | -34.6356, -58.3647 | OSM way 105653198. Wikidata Q499855 agrees to 3 m      | "La Bombonera", not the official "Estadio Alberto J. Armando"                                                                            |
| 9   | wembley                     | 51.5560, -0.2796   | OSM way 116539074. Wikipedia is 42 m south-east        | Name is "Wembley", as fans say it, not "Wembley Stadium"                                                                                 |
| 10  | stadium-australia           | -33.8471, 151.0634 | OSM way 119388916 (the oval). Wikipedia agrees to 24 m | Sponsor name "Accor Stadium". "Stadium Australia" kept                                                                                   |
| 11  | westfalenstadion            | 51.4926, 7.4518    | OSM way 17235988. Wikipedia agrees to 15 m             | Sponsor name "Signal Iduna Park". Traditional name kept                                                                                  |
| 12  | rose-bowl                   | 34.1613, -118.1676 | OSM way 119369552. Wikipedia is 49 m south-west        | No naming choice. Country written "United States". City is Pasadena, not Los Angeles                                                     |
| 13  | celtic-park                 | 55.8497, -4.2055   | OSM way 193158462. Wikipedia agrees to 5 m             | "Celtic Park", not the nickname "Parkhead"                                                                                               |
| 14  | estadio-centenario          | -34.8945, -56.1528 | OSM way 179533172. Wikidata Q498245 agrees to 8 m      | In use on 2026-11-10. Reported to host the Copa Libertadores final on 2026-11-28 and then close for rebuilding before the 2030 World Cup |
| 15  | lusail-stadium              | 25.4208, 51.4903   | OSM way 1006062424. Wikipedia agrees to 13 m           | No naming choice. City given as Lusail, the new town north of Doha                                                                       |
| 16  | estadio-da-luz              | 38.7527, -9.1847   | OSM way 54756292. Wikipedia agrees to 2 m              | "Estádio da Luz", not the official "Estádio do Sport Lisboa e Benfica"                                                                   |
| 17  | cairo-international-stadium | 30.0691, 31.3123   | OSM way 44637021. Wikipedia agrees to 14 m             | No naming choice. Reported as a 2026-27 home venue for Al Ahly and Zamalek                                                               |
| 18  | old-trafford                | 53.4631, -2.2913   | OSM way 165256230. Wikipedia agrees to 5 m             | City given as Manchester. The ground is in Stretford, Trafford                                                                           |
| 19  | estadio-cuscatlan           | 13.6811, -89.2224  | OSM way 1565757111. Wikipedia agrees to 13 m           | No naming choice. Chosen as the Central American pin                                                                                     |
| 20  | parc-des-princes            | 48.8414, 2.2531    | OSM way 88005247. Wikidata Q193431 agrees to 3 m       | No naming choice                                                                                                                         |
| 21  | estadio-hernando-siles      | -16.4994, -68.1227 | OSM way 148644726. Wikipedia agrees to 14 m            | No naming choice                                                                                                                         |

## Spread and order

- Europe 9 (England 3, Spain, Italy, Germany, Scotland, Portugal, France), South America 4,
  North and Central America 3, Africa 2, Asia 2, Oceania 1.
- No two consecutive days share a country or a continent. That includes the wrap from day 21
  (La Paz) back to day 1 (Anfield).

## Things to know

- Four names carry accents: Maracanã, Santiago Bernabéu, Estádio da Luz, Estadio Cuscatlán. The
  canvas bitmap fonts cover unaccented letters only, so the scoreboard has to strip accents
  before drawing.
- Estadio Centenario is expected to be closed for rebuilding from 2027. Replace it if this list
  is still in use then.
- In-use status was confirmed by search only for Estadio Centenario, Cairo International Stadium
  and Japan National Stadium. The other 18 are long-standing active venues and were not
  individually re-checked.

## Verification

Independent check on **2026-11-10**. No value in `app/data/stadiums.ts` was changed.

- **Count and order**: 21 stadiums, Anfield first, ids unique. No two consecutive days share a
  country, including the wrap from day 21 to day 1. `app/data/data.test.ts` now enforces this.
- **Coordinates**: all 21 were compared by script with a second source: 18 with the English
  Wikipedia coordinates API and 3 with Wikidata (La Bombonera, Estadio Centenario, Parc des
  Princes). Every one is within 100 m, well inside the 300 m limit. There are no swapped signs
  and no swapped latitude and longitude. The OpenStreetMap pitch outlines were not fetched
  again.
- **In use**: confirmed by search for Estadio Centenario, which hosts the Copa Libertadores
  final (Palmeiras v Estudiantes) on 28 November 2026 and is reported to close for rebuilding
  after it. The other 20 were not searched one by one: they are long-standing homes of clubs
  or national teams.
- **A naming change made in another file to match this one**: the AWAY question on World Cup
  final stadiums now calls the Johannesburg ground `Soccer City`, as here, not `FNB Stadium`.

Not confirmed:

- That each of the 21 has a fixture in November 2026. "In use" was taken to mean open and
  hosting matches this season.
- Estadio Centenario is day 14 (23 November 2026) and comes round again on day 35 (14 December 2026). By the second date it may be closed. Replace it before then if the list is still live.
