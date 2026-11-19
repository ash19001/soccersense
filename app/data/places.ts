import type { Stadium } from "~/game/types";

/**
 * The day's place: where CLOSEST and FURTHEST measure every answer's distance from, named
 * on their mode card and always on their board (the product owner, 2026-11-18: "it should
 * also say what the location/stadium etc is. this should also be clearly and obviously
 * visible within the game"; a mix of "stadiums, cities and landmarks"). Index 0 is day 1;
 * the days go round the list (`stadiumForDay`).
 *
 * Only these two modes say which place a day's is. The home screen's stadium is the art's
 * own, in club colours picked by the day's number, and is never named (the product owner,
 * 2026-11-17).
 *
 * Coordinates: a stadium's is the centre of its pitch, a landmark's is the landmark's own,
 * a city's is the conventional centre point; 4 decimal places (about 11 m). Sources are in
 * docs/data-notes/places.md. Consecutive days are on different continents, so one day's
 * place is far from the next.
 */
export type PlaceKind = "stadium" | "city" | "landmark";

export interface Place extends Stadium {
  /** As it is shown, with its accents: "Wembley", "Lagos", "Eiffel Tower". */
  name: string;
  /** Where it is: "London, England"; for a city, its country alone: "Nigeria". */
  area: string;
  kind: PlaceKind;
}

export const PLACES: Place[] = [
  // 1. Europe
  {
    id: "wembley",
    name: "Wembley",
    area: "London, England",
    kind: "stadium",
    lat: 51.556,
    lng: -0.2796,
  },
  // 2. South America
  {
    id: "montevideo",
    name: "Montevideo",
    area: "Uruguay",
    kind: "city",
    lat: -34.9056,
    lng: -56.1842,
  },
  // 3. Asia
  {
    id: "japan-national-stadium",
    name: "Japan National Stadium",
    area: "Tokyo, Japan",
    kind: "stadium",
    lat: 35.6778,
    lng: 139.7145,
  },
  // 4. North and Central America
  {
    id: "statue-of-liberty",
    name: "Statue of Liberty",
    area: "New York, United States",
    kind: "landmark",
    lat: 40.6892,
    lng: -74.0444,
  },
  // 5. Europe
  {
    id: "santiago-bernabeu",
    name: "Santiago Bernabéu",
    area: "Madrid, Spain",
    kind: "stadium",
    lat: 40.4531,
    lng: -3.6884,
  },
  // 6. Oceania
  {
    id: "auckland",
    name: "Auckland",
    area: "New Zealand",
    kind: "city",
    lat: -36.8492,
    lng: 174.7653,
  },
  // 7. North and Central America
  {
    id: "estadio-azteca",
    name: "Estadio Azteca",
    area: "Mexico City, Mexico",
    kind: "stadium",
    lat: 19.3029,
    lng: -99.1505,
  },
  // 8. Africa
  {
    id: "great-pyramid-of-giza",
    name: "Great Pyramid of Giza",
    area: "Giza, Egypt",
    kind: "landmark",
    lat: 29.9792,
    lng: 31.1342,
  },
  // 9. South America
  {
    id: "maracana",
    name: "Maracanã",
    area: "Rio de Janeiro, Brazil",
    kind: "stadium",
    lat: -22.9121,
    lng: -43.2302,
  },
  // 10. Europe
  {
    id: "istanbul",
    name: "Istanbul",
    area: "Turkey",
    kind: "city",
    lat: 41.0136,
    lng: 28.955,
  },
  // 11. Asia
  {
    id: "lusail-stadium",
    name: "Lusail Stadium",
    area: "Lusail, Qatar",
    kind: "stadium",
    lat: 25.4208,
    lng: 51.4903,
  },
  // 12. Oceania
  {
    id: "sydney-opera-house",
    name: "Sydney Opera House",
    area: "Sydney, Australia",
    kind: "landmark",
    lat: -33.8568,
    lng: 151.2151,
  },
  // 13. Africa
  {
    id: "soccer-city",
    name: "Soccer City",
    area: "Johannesburg, South Africa",
    kind: "stadium",
    lat: -26.2347,
    lng: 27.9826,
  },
  // 14. North and Central America
  {
    id: "guadalajara",
    name: "Guadalajara",
    area: "Mexico",
    kind: "city",
    lat: 20.6767,
    lng: -103.3475,
  },
  // 15. Europe
  {
    id: "anfield",
    name: "Anfield",
    area: "Liverpool, England",
    kind: "stadium",
    lat: 53.4308,
    lng: -2.9608,
  },
  // 16. South America
  {
    id: "machu-picchu",
    name: "Machu Picchu",
    area: "Peru",
    kind: "landmark",
    lat: -13.1633,
    lng: -72.5456,
  },
  // 17. Africa
  {
    id: "cairo-international-stadium",
    name: "Cairo International Stadium",
    area: "Cairo, Egypt",
    kind: "stadium",
    lat: 30.0691,
    lng: 31.3123,
  },
  // 18. Asia
  {
    id: "seoul",
    name: "Seoul",
    area: "South Korea",
    kind: "city",
    lat: 37.56,
    lng: 126.99,
  },
  // 19. North and Central America
  {
    id: "rose-bowl",
    name: "Rose Bowl",
    area: "Pasadena, United States",
    kind: "stadium",
    lat: 34.1613,
    lng: -118.1676,
  },
  // 20. Europe
  {
    id: "eiffel-tower",
    name: "Eiffel Tower",
    area: "Paris, France",
    kind: "landmark",
    lat: 48.8582,
    lng: 2.2945,
  },
  // 21. Oceania
  {
    id: "stadium-australia",
    name: "Stadium Australia",
    area: "Sydney, Australia",
    kind: "stadium",
    lat: -33.8471,
    lng: 151.0634,
  },
  // 22. Africa
  {
    id: "casablanca",
    name: "Casablanca",
    area: "Morocco",
    kind: "city",
    lat: 33.5992,
    lng: -7.62,
  },
  // 23. Europe
  {
    id: "westfalenstadion",
    name: "Westfalenstadion",
    area: "Dortmund, Germany",
    kind: "stadium",
    lat: 51.4926,
    lng: 7.4518,
  },
  // 24. Asia
  {
    id: "mount-fuji",
    name: "Mount Fuji",
    area: "Japan",
    kind: "landmark",
    lat: 35.3608,
    lng: 138.7275,
  },
  // 25. South America
  {
    id: "la-bombonera",
    name: "La Bombonera",
    area: "Buenos Aires, Argentina",
    kind: "stadium",
    lat: -34.6356,
    lng: -58.3647,
  },
  // 26. Africa
  {
    id: "lagos",
    name: "Lagos",
    area: "Nigeria",
    kind: "city",
    lat: 6.4561,
    lng: 3.3936,
  },
  // 27. Europe
  {
    id: "san-siro",
    name: "San Siro",
    area: "Milan, Italy",
    kind: "stadium",
    lat: 45.4781,
    lng: 9.124,
  },
  // 28. North and Central America
  {
    id: "cn-tower",
    name: "CN Tower",
    area: "Toronto, Canada",
    kind: "landmark",
    lat: 43.6426,
    lng: -79.3871,
  },
  // 29. South America
  {
    id: "sao-paulo",
    name: "São Paulo",
    area: "Brazil",
    kind: "city",
    lat: -23.55,
    lng: -46.6333,
  },
  // 30. Asia
  {
    id: "taj-mahal",
    name: "Taj Mahal",
    area: "Agra, India",
    kind: "landmark",
    lat: 27.175,
    lng: 78.0419,
  },
];

/** A place by its id, or null. */
export function placeById(id: string): Place | null {
  return PLACES.find((place) => place.id === id) ?? null;
}

/**
 * How the day's place reads on the mode card and the board: its name and its town
 * ("Wembley, London"), or a city and its country ("Lagos, Nigeria").
 */
export function placeLabel(place: Place): string {
  const town = place.area.split(",")[0]?.trim() ?? "";
  if (place.kind === "city" || town === "" || town === place.name) {
    return `${place.name}, ${place.area.split(",").at(-1)?.trim() ?? place.area}`;
  }
  return `${place.name}, ${town}`;
}
