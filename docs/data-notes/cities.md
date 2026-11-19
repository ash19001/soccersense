# Football cities (`app/data/cities.ts`)

The stops of FURTHEST's career on the map (2026-11-18): each promotion is a move to a city
further from the day's place (`app/scenes/map-journey.ts`; GAME_DESIGN.md section 5.3). Not
question data: no answer comes from this list, and it is not used to judge anything.

- **What is in it**: about 430 cities with a professional club or a big ground, chosen so that
  every day's place (`app/data/places.ts`) has a stop at each distance the journey asks for:
  a town up the road (about 70 km), one across a border or the sea (600), across the continent
  (2,200), another continent (6,000), further round the world (11,000), and a city on the far
  side of the world. Cities near the places that have no big neighbour were added for that
  (Toledo for the Bernabéu, Gwalior for the Taj Mahal, Cusco for Machu Picchu, Kashima and
  Kōfu for Tokyo and Mount Fuji, Reims and Rouen for the Eiffel Tower, Bergamo for San Siro,
  Bursa for Istanbul).
- **Coordinates**: city centres, to about a hundredth of a degree. They are public facts (any
  atlas, and the cities' Wikipedia pages, agree with them to that). Nothing here is copied
  from a game or a data set with a licence.
- **Names**: as the map writes them, in English where English has its own name (Munich,
  Cologne, Seville), else the city's own, with its accents (the font folds them).
- **When a place is added** to `app/data/places.ts`: check its journey has a stop up the road
  under 250 km away (`map-journey.test.ts` asserts it for every place) and add a city near it
  if not.
