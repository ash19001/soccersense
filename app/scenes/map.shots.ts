/**
 * Shots of CLOSEST's and FURTHEST's map (./map.ts), for the snap tool:
 *
 *   ./node_modules/.bin/tsx tools/snap.ts map/closest --w 960 --h 540 --out .snaps/map.png
 *
 * - `map/closest`, `map/furthest`: the pin on its day's place, after three answers have
 *   landed, the last one's distance still counted beside it.
 * - `map/flight`: a ball in the air, half way to the other side of the world.
 * - `map/opening`: the iris half open on the pin.
 * - `map/closest-0` to `map/closest-7`, `map/furthest-0` to `map/furthest-7`: the
 *   career's view at each tier (the town from above built, the view sharpened).
 */

import { lightingFor } from "~/art/lighting";
import { formatDistance } from "~/game/geo";
import type { Grade, Mode } from "~/game/types";
import { Surface } from "~/pixel";
import type { ShotContext, ShotMap } from "~/pixel/shot";

import { MapScene } from "./map";

/** What space is called (en.play.space: the scenes do not read the words themselves). */
const SPACE = {
  moon: "THE MOON",
  sun: "THE SUN",
  mercury: "MERCURY",
  venus: "VENUS",
  mars: "MARS",
  jupiter: "JUPITER",
  saturn: "SATURN",
  uranus: "URANUS",
  neptune: "NEPTUNE",
  alphaCentauri: "ALPHA CENTAURI",
  barnard: "BARNARD'S STAR",
  sirius: "SIRIUS",
  milkyWay: "THE MILKY WAY",
  andromeda: "ANDROMEDA",
  triangulum: "TRIANGULUM",
  magellanic: "MAGELLANIC CLOUDS",
  universe: "THE OBSERVABLE UNIVERSE",
  asteroidBelt: "ASTEROID BELT",
  kuiperBelt: "KUIPER BELT",
  oortCloud: "OORT CLOUD",
};

const WEMBLEY = { lat: 51.556, lng: -0.2796, name: "Wembley" };
const SYDNEY = { lat: -33.8568, lng: 151.2153, name: "Sydney Opera House" };

/** Places answers come down at (with their whole kilometres from the pin, as the game has them). */
const MADRID = { lat: 40.4531, lng: -3.6884 };
const MILAN = { lat: 45.4781, lng: 9.124 };
const MANCHESTER = { lat: 53.4631, lng: -2.2913 };
const RIO = { lat: -22.9121, lng: -43.2302 };
const LISBON = { lat: 38.7527, lng: -9.1847 };

function scene(mode: Mode, place: typeof WEMBLEY, ctx: ShotContext): MapScene {
  const map = new MapScene({
    seed: ctx.seed,
    mode,
    place,
    distance: (km) => formatDistance(km, "en-GB"),
    labels: SPACE,
  });
  map.resize(ctx.w, ctx.h);
  map.setLighting(lightingFor(ctx.sun));
  map.beginOpening();
  map.update(1);
  return map;
}

function shoot(
  map: MapScene,
  grade: Grade,
  at: { lat: number; lng: number },
  km: number,
): void {
  let done = false;
  map.playShot(grade, () => (done = true), { ...at, km });
  for (let i = 0; i < 400 && !done; i++) map.update(1 / 60);
  map.ask();
  for (let i = 0; i < 120; i++) map.update(1 / 60);
}

function frame(map: MapScene, ctx: ShotContext): Surface {
  const s = new Surface(ctx.w, ctx.h);
  map.update(ctx.t);
  map.draw(s);
  return s;
}

/** The career's view at a tier, still and sharp. */
function career(mode: Mode, tier: number, ctx: ShotContext): Surface {
  const map = scene(mode, WEMBLEY, ctx);
  map.setCeiling(Math.round(ctx.h * 0.16));
  map.setTotal(tier * 90 + 5);
  // the town from above is built a slice a frame; then the view sharpens
  for (let i = 0; i < 200; i++) map.update(1 / 60);
  const s = new Surface(ctx.w, ctx.h);
  for (let i = 0; i < 30; i++) {
    map.update(1 / 60);
    map.draw(s);
  }
  return frame(map, ctx);
}

const careers: ShotMap = {};
for (const mode of ["closest", "furthest"] as const) {
  for (let tier = 0; tier < 8; tier++) {
    careers[`map/${mode}-${tier}`] = (ctx) => career(mode, tier, ctx);
  }
}

export const shots: ShotMap = {
  ...careers,
  "map/closest": (ctx) => {
    const map = scene("closest", WEMBLEY, ctx);
    shoot(map, "toepoke", MADRID, 1264);
    shoot(map, "trivela", MILAN, 960);
    let done = false;
    map.playShot("worldie", () => (done = true), { ...MANCHESTER, km: 263 });
    for (let i = 0; i < 400 && !done; i++) map.update(1 / 60);
    return frame(map, ctx);
  },
  "map/furthest": (ctx) => {
    const map = scene("furthest", SYDNEY, ctx);
    shoot(map, "golazo", RIO, 13513);
    shoot(map, "trivela", MADRID, 17689);
    let done = false;
    map.playShot("worldie", () => (done = true), { ...LISBON, km: 18036 });
    for (let i = 0; i < 400 && !done; i++) map.update(1 / 60);
    return frame(map, ctx);
  },
  "map/flight": (ctx) => {
    const map = scene("furthest", WEMBLEY, ctx);
    map.playShot("golazo", () => {}, {
      lat: -33.8471,
      lng: 151.0634,
      km: 17016,
    });
    for (let i = 0; i < 50; i++) map.update(1 / 60);
    return frame(map, ctx);
  },
  "map/opening": (ctx) => {
    const map = new MapScene({
      seed: ctx.seed,
      mode: "closest",
      place: WEMBLEY,
      distance: (km) => formatDistance(km, "en-GB"),
    });
    map.resize(ctx.w, ctx.h);
    map.setLighting(lightingFor(ctx.sun));
    map.beginOpening();
    map.update(0.4);
    return frame(map, ctx);
  },
};
