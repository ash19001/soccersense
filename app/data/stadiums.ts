import type { Stadium } from "~/game/types";

/**
 * Daily pins for the demo. Index 0 is day 1.
 *
 * Coordinates are the centre of the pitch (4 decimal places, about 11 m), taken from the
 * OpenStreetMap pitch outline and cross-checked against Wikipedia. Sources and naming
 * choices are in docs/data-notes/stadiums.md.
 *
 * Order matters: consecutive days (including the wrap from the last back to Anfield) are
 * never in the same country or on the same continent.
 */
export const STADIUMS: Stadium[] = [
  // 1. Europe
  {
    id: "anfield",
    name: "Anfield",
    city: "Liverpool",
    country: "England",
    lat: 53.4308,
    lng: -2.9608,
  },
  // 2. South America
  {
    id: "maracana",
    name: "Maracanã",
    city: "Rio de Janeiro",
    country: "Brazil",
    lat: -22.9121,
    lng: -43.2302,
  },
  // 3. Asia
  {
    id: "japan-national-stadium",
    name: "Japan National Stadium",
    city: "Tokyo",
    country: "Japan",
    lat: 35.6778,
    lng: 139.7145,
  },
  // 4. Europe
  {
    id: "santiago-bernabeu",
    name: "Santiago Bernabéu",
    city: "Madrid",
    country: "Spain",
    lat: 40.4531,
    lng: -3.6884,
  },
  // 5. North America
  {
    id: "estadio-azteca",
    name: "Estadio Azteca",
    city: "Mexico City",
    country: "Mexico",
    lat: 19.3029,
    lng: -99.1505,
  },
  // 6. Europe
  {
    id: "san-siro",
    name: "San Siro",
    city: "Milan",
    country: "Italy",
    lat: 45.4781,
    lng: 9.124,
  },
  // 7. Africa
  {
    id: "soccer-city",
    name: "Soccer City",
    city: "Johannesburg",
    country: "South Africa",
    lat: -26.2347,
    lng: 27.9826,
  },
  // 8. South America
  {
    id: "la-bombonera",
    name: "La Bombonera",
    city: "Buenos Aires",
    country: "Argentina",
    lat: -34.6356,
    lng: -58.3647,
  },
  // 9. Europe
  {
    id: "wembley",
    name: "Wembley",
    city: "London",
    country: "England",
    lat: 51.556,
    lng: -0.2796,
  },
  // 10. Oceania
  {
    id: "stadium-australia",
    name: "Stadium Australia",
    city: "Sydney",
    country: "Australia",
    lat: -33.8471,
    lng: 151.0634,
  },
  // 11. Europe
  {
    id: "westfalenstadion",
    name: "Westfalenstadion",
    city: "Dortmund",
    country: "Germany",
    lat: 51.4926,
    lng: 7.4518,
  },
  // 12. North America
  {
    id: "rose-bowl",
    name: "Rose Bowl",
    city: "Pasadena",
    country: "United States",
    lat: 34.1613,
    lng: -118.1676,
  },
  // 13. Europe
  {
    id: "celtic-park",
    name: "Celtic Park",
    city: "Glasgow",
    country: "Scotland",
    lat: 55.8497,
    lng: -4.2055,
  },
  // 14. South America
  {
    id: "estadio-centenario",
    name: "Estadio Centenario",
    city: "Montevideo",
    country: "Uruguay",
    lat: -34.8945,
    lng: -56.1528,
  },
  // 15. Asia
  {
    id: "lusail-stadium",
    name: "Lusail Stadium",
    city: "Lusail",
    country: "Qatar",
    lat: 25.4208,
    lng: 51.4903,
  },
  // 16. Europe
  {
    id: "estadio-da-luz",
    name: "Estádio da Luz",
    city: "Lisbon",
    country: "Portugal",
    lat: 38.7527,
    lng: -9.1847,
  },
  // 17. Africa
  {
    id: "cairo-international-stadium",
    name: "Cairo International Stadium",
    city: "Cairo",
    country: "Egypt",
    lat: 30.0691,
    lng: 31.3123,
  },
  // 18. Europe
  {
    id: "old-trafford",
    name: "Old Trafford",
    city: "Manchester",
    country: "England",
    lat: 53.4631,
    lng: -2.2913,
  },
  // 19. Central America
  {
    id: "estadio-cuscatlan",
    name: "Estadio Cuscatlán",
    city: "San Salvador",
    country: "El Salvador",
    lat: 13.6811,
    lng: -89.2224,
  },
  // 20. Europe
  {
    id: "parc-des-princes",
    name: "Parc des Princes",
    city: "Paris",
    country: "France",
    lat: 48.8414,
    lng: 2.2531,
  },
  // 21. South America
  {
    id: "estadio-hernando-siles",
    name: "Estadio Hernando Siles",
    city: "La Paz",
    country: "Bolivia",
    lat: -16.4994,
    lng: -68.1227,
  },
];
