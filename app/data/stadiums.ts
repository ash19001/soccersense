import type { Stadium } from "~/game/types";

/**
 * Daily pins for the demo: where the distance rules measure from (the locked modes CLOSEST
 * and FURTHEST). Index 0 is day 1.
 *
 * A pin is a place and an id, nothing more. It has no name, city or country: no screen, share
 * or read-out says which stadium a day's pin is. The ids are for code and storage only.
 *
 * Coordinates are the centre of a real pitch (4 decimal places, about 11 m), taken from the
 * OpenStreetMap pitch outline and cross-checked against Wikipedia. Sources are in
 * docs/data-notes/stadiums.md.
 *
 * Order matters: consecutive days (including the wrap from the last back to the first) are
 * never on the same continent, so one day's pin is far from the next.
 */
export const STADIUMS: Stadium[] = [
  // 1. Europe
  {
    id: "anfield",
    lat: 53.4308,
    lng: -2.9608,
  },
  // 2. South America
  {
    id: "maracana",
    lat: -22.9121,
    lng: -43.2302,
  },
  // 3. Asia
  {
    id: "japan-national-stadium",
    lat: 35.6778,
    lng: 139.7145,
  },
  // 4. Europe
  {
    id: "santiago-bernabeu",
    lat: 40.4531,
    lng: -3.6884,
  },
  // 5. North America
  {
    id: "estadio-azteca",
    lat: 19.3029,
    lng: -99.1505,
  },
  // 6. Europe
  {
    id: "san-siro",
    lat: 45.4781,
    lng: 9.124,
  },
  // 7. Africa
  {
    id: "soccer-city",
    lat: -26.2347,
    lng: 27.9826,
  },
  // 8. South America
  {
    id: "la-bombonera",
    lat: -34.6356,
    lng: -58.3647,
  },
  // 9. Europe
  {
    id: "wembley",
    lat: 51.556,
    lng: -0.2796,
  },
  // 10. Oceania
  {
    id: "stadium-australia",
    lat: -33.8471,
    lng: 151.0634,
  },
  // 11. Europe
  {
    id: "westfalenstadion",
    lat: 51.4926,
    lng: 7.4518,
  },
  // 12. North America
  {
    id: "rose-bowl",
    lat: 34.1613,
    lng: -118.1676,
  },
  // 13. Europe
  {
    id: "celtic-park",
    lat: 55.8497,
    lng: -4.2055,
  },
  // 14. South America
  {
    id: "estadio-centenario",
    lat: -34.8945,
    lng: -56.1528,
  },
  // 15. Asia
  {
    id: "lusail-stadium",
    lat: 25.4208,
    lng: 51.4903,
  },
  // 16. Europe
  {
    id: "estadio-da-luz",
    lat: 38.7527,
    lng: -9.1847,
  },
  // 17. Africa
  {
    id: "cairo-international-stadium",
    lat: 30.0691,
    lng: 31.3123,
  },
  // 18. Europe
  {
    id: "old-trafford",
    lat: 53.4631,
    lng: -2.2913,
  },
  // 19. Central America
  {
    id: "estadio-cuscatlan",
    lat: 13.6811,
    lng: -89.2224,
  },
  // 20. Europe
  {
    id: "parc-des-princes",
    lat: 48.8414,
    lng: 2.2531,
  },
  // 21. South America
  {
    id: "estadio-hernando-siles",
    lat: -16.4994,
    lng: -68.1227,
  },
];
