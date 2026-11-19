# The day's places (CLOSEST and FURTHEST)

`app/data/places.ts`: the 30 places CLOSEST and FURTHEST measure answers from, one a day in
this order (`(dayNumber - 1) mod 30`), the same pin every mode is given (`STADIUMS` in
`app/data/stadiums.ts` is this list). Chosen on 2026-11-18, when the two modes opened; the
product owner chose "Stadiums, cities and landmarks".

## How they were chosen

- **Stadiums, cities and landmarks in turn** (14, 8 and 8: a stadium every other day), never
  two days running of one kind (a test keeps it so, round the wrap from day 30 to day 1 too).
- **Spread over the world**: every continent with football, and one day's place 2,000 km or
  more from the next (a test), so that the nearest answers change from day to day.
- **Places a player knows by name**: famous grounds (several World Cup final venues), big
  football cities, world-famous landmarks. No club's crest or kit is drawn: the place is a
  name and a pin.
- **Named** as `name, area` ("Wembley, London"; "Montevideo, Uruguay"): `placeLabel`. The
  name is the one in common English use, with its accents (Maracanã, Santiago Bernabéu).

## Where each point comes from

- **Stadiums** (14 of the 30): the points already checked for the stadium list
  (`docs/data-notes/stadiums.md`, the centre of the pitch); every one of them is on it.
- **Cities and landmarks**: the point on the place's Wikipedia article and its Wikidata item
  (P625), checked against the OpenStreetMap object carrying the same Wikidata id (found with
  Nominatim). A city's point is its centre as those sources give it.

A distance is measured from the point to an answer's place, great-circle, in whole kilometres:
a few hundred metres either way does not change a shot.

## The list

| day | id                            | name                        | area                       | kind     | lat, lng           | point from                            |
| --- | ----------------------------- | --------------------------- | -------------------------- | -------- | ------------------ | ------------------------------------- |
| 1   | `wembley`                     | Wembley                     | London, England            | stadium  | 51.556, -0.2796    | the stadium list (`stadiums.md`)      |
| 2   | `montevideo`                  | Montevideo                  | Uruguay                    | city     | -34.9056, -56.1842 | Wikipedia and Wikidata, OpenStreetMap |
| 3   | `japan-national-stadium`      | Japan National Stadium      | Tokyo, Japan               | stadium  | 35.6778, 139.7145  | the stadium list (`stadiums.md`)      |
| 4   | `statue-of-liberty`           | Statue of Liberty           | New York, United States    | landmark | 40.6892, -74.0444  | Wikipedia and Wikidata, OpenStreetMap |
| 5   | `santiago-bernabeu`           | Santiago Bernabéu           | Madrid, Spain              | stadium  | 40.4531, -3.6884   | the stadium list (`stadiums.md`)      |
| 6   | `auckland`                    | Auckland                    | New Zealand                | city     | -36.8492, 174.7653 | Wikipedia and Wikidata, OpenStreetMap |
| 7   | `estadio-azteca`              | Estadio Azteca              | Mexico City, Mexico        | stadium  | 19.3029, -99.1505  | the stadium list (`stadiums.md`)      |
| 8   | `great-pyramid-of-giza`       | Great Pyramid of Giza       | Giza, Egypt                | landmark | 29.9792, 31.1342   | Wikipedia and Wikidata, OpenStreetMap |
| 9   | `maracana`                    | Maracanã                    | Rio de Janeiro, Brazil     | stadium  | -22.9121, -43.2302 | the stadium list (`stadiums.md`)      |
| 10  | `istanbul`                    | Istanbul                    | Turkey                     | city     | 41.0136, 28.955    | Wikipedia and Wikidata, OpenStreetMap |
| 11  | `lusail-stadium`              | Lusail Stadium              | Lusail, Qatar              | stadium  | 25.4208, 51.4903   | the stadium list (`stadiums.md`)      |
| 12  | `sydney-opera-house`          | Sydney Opera House          | Sydney, Australia          | landmark | -33.8568, 151.2151 | Wikipedia and Wikidata, OpenStreetMap |
| 13  | `soccer-city`                 | Soccer City                 | Johannesburg, South Africa | stadium  | -26.2347, 27.9826  | the stadium list (`stadiums.md`)      |
| 14  | `guadalajara`                 | Guadalajara                 | Mexico                     | city     | 20.6767, -103.3475 | Wikipedia and Wikidata, OpenStreetMap |
| 15  | `anfield`                     | Anfield                     | Liverpool, England         | stadium  | 53.4308, -2.9608   | the stadium list (`stadiums.md`)      |
| 16  | `machu-picchu`                | Machu Picchu                | Peru                       | landmark | -13.1633, -72.5456 | Wikipedia and Wikidata, OpenStreetMap |
| 17  | `cairo-international-stadium` | Cairo International Stadium | Cairo, Egypt               | stadium  | 30.0691, 31.3123   | the stadium list (`stadiums.md`)      |
| 18  | `seoul`                       | Seoul                       | South Korea                | city     | 37.56, 126.99      | Wikipedia and Wikidata, OpenStreetMap |
| 19  | `rose-bowl`                   | Rose Bowl                   | Pasadena, United States    | stadium  | 34.1613, -118.1676 | the stadium list (`stadiums.md`)      |
| 20  | `eiffel-tower`                | Eiffel Tower                | Paris, France              | landmark | 48.8582, 2.2945    | Wikipedia and Wikidata, OpenStreetMap |
| 21  | `stadium-australia`           | Stadium Australia           | Sydney, Australia          | stadium  | -33.8471, 151.0634 | the stadium list (`stadiums.md`)      |
| 22  | `casablanca`                  | Casablanca                  | Morocco                    | city     | 33.5992, -7.62     | Wikipedia and Wikidata, OpenStreetMap |
| 23  | `westfalenstadion`            | Westfalenstadion            | Dortmund, Germany          | stadium  | 51.4926, 7.4518    | the stadium list (`stadiums.md`)      |
| 24  | `mount-fuji`                  | Mount Fuji                  | Japan                      | landmark | 35.3608, 138.7275  | Wikipedia and Wikidata, OpenStreetMap |
| 25  | `la-bombonera`                | La Bombonera                | Buenos Aires, Argentina    | stadium  | -34.6356, -58.3647 | the stadium list (`stadiums.md`)      |
| 26  | `lagos`                       | Lagos                       | Nigeria                    | city     | 6.4561, 3.3936     | Wikipedia and Wikidata, OpenStreetMap |
| 27  | `san-siro`                    | San Siro                    | Milan, Italy               | stadium  | 45.4781, 9.124     | the stadium list (`stadiums.md`)      |
| 28  | `cn-tower`                    | CN Tower                    | Toronto, Canada            | landmark | 43.6426, -79.3871  | Wikipedia and Wikidata, OpenStreetMap |
| 29  | `sao-paulo`                   | São Paulo                   | Brazil                     | city     | -23.55, -46.6333   | Wikipedia and Wikidata, OpenStreetMap |
| 30  | `taj-mahal`                   | Taj Mahal                   | Agra, India                | landmark | 27.175, 78.0419    | Wikipedia and Wikidata, OpenStreetMap |
