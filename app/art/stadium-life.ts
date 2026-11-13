/**
 * Everything that moves: traffic, supporters, the train, flags, smoke, birds, the
 * shadows of clouds, and the roar. All of it is a function of the time passed in.
 *
 * Moving things are drawn through a depth mask the static painter left behind (which
 * static thing is at each pixel, and how far away), so a car passes behind a tree and a
 * supporter behind a lamp post.
 */

import { Surface, bayer4, hash2, shade, type Color } from "~/pixel";
import { distant, skyFor, type Lighting } from "~/art/lighting";
import { P } from "~/art/palette";
import {
  BAYS,
  HR,
  OUT_A,
  OUT_B,
  PITCH_V,
  PITCH_X,
  wallPoint,
} from "~/art/stadium-bowl";
import {
  lapOf,
  planWalk,
  roadway,
  walkAt,
  type Stop,
  type WalkPlace,
} from "~/art/stadium-crossing";
import { drawGull } from "~/art/sky";

import type { Zone } from "~/art/layout";
import {
  GOAL_AT,
  MATCH_PERIOD,
  PLAYERS,
  REFEREE,
  makeMatchState,
  matchAt,
} from "~/art/stadium-match";
import { GATE, KERB_V } from "~/art/stadium-parking";
import { CYCLE, roadCars, type RoadCar } from "~/art/stadium-road";
import {
  CARPARK,
  COACH_BAY,
  PLAZA_HALF,
  POND,
  RAIL,
  ROAD,
  STATION,
} from "~/art/stadium-plan";
import {
  EAST,
  WEST,
  carLamps,
  coachLamps,
  coachSprite,
  groundHeading,
} from "~/art/stadium-cars";
import {
  car,
  carShadow,
  drawFlag,
  drawPuff,
  drawTinyPlayer,
  person,
  shadowBlob,
  type CarLook,
  type Ink,
  type PersonLook,
} from "~/art/stadium-things";
import { sizeStep } from "~/art/traffic-steps";
import {
  personLampShadow as castPersonShadow,
  vehicleLampShadow as castVehicleShadow,
} from "~/art/lamp-shadows";
import {
  advanceTown,
  carLook,
  coachLook,
  personLook,
  type Town,
} from "~/art/stadium-town";
import { drawDog, drawDuck, drawParkBall } from "~/art/stadium-people";
import { clubOf, clubRaw } from "~/art/stadium-club";
import {
  hazeAt,
  project,
  projectRaw,
  rowAt,
  scaleAt,
  sizeClass,
  type Spot,
  type View,
} from "~/art/stadium-view";

/** Writes pixels only where nothing nearer stands. */
class MaskedInk implements Ink {
  V = 0;
  constructor(
    private s: Surface,
    private readonly depth: Float32Array,
    private readonly w: number,
    private readonly h: number,
  ) {}

  target(s: Surface): void {
    this.s = s;
  }

  /** The surface it draws on now. */
  get surface(): Surface {
    return this.s;
  }

  px(x: number, y: number, c: Color): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x;
    if (this.depth[i] >= this.V) this.s.data[i] = c;
  }

  rect(x: number, y: number, w: number, h: number, c: Color): void {
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) this.px(x + i, y + j, c);
    }
  }

  /** A shadow on the ground (shadowBlob), hidden by the same rule as the thing casting it. */
  shadow(cx: number, cy: number, rx: number, ry: number): void {
    shadowBlob(this.s, cx, cy, rx, ry, this.depth, this.V);
  }
}

interface Route {
  X0: number;
  V0: number;
  X1: number;
  V1: number;
  len: number;
  speed: number;
  /** The way it runs on the map, a unit vector. */
  dX: number;
  dV: number;
  cars: { off: number; paint: number; bus: boolean; key: number }[];
}

interface Path {
  pts: { X: number; V: number }[];
  /** Cumulative length at each point. */
  at: number[];
  len: number;
  lit: boolean;
  walkers: {
    /** Seconds into its lap at time 0. */
    shift: number;
    speed: number;
    lat: number;
    look: number;
    kind: number;
    /** Where it waits for the traffic (stadium-crossing.ts), and how long a lap takes. */
    stops: Stop[];
    lap: number;
    /** Who this is, for the lap-by-lap choice of who is out at night. */
    key: number;
  }[];
}

/** A polyline on the map with its running length. */
interface Way {
  pts: { X: number; V: number }[];
  at: number[];
  len: number;
}

function makeWay(pts: readonly (readonly [number, number])[]): Way {
  const at = [0];
  for (let i = 1; i < pts.length; i++) {
    at.push(
      at[i - 1] +
        Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]),
    );
  }
  return { pts: pts.map(([X, V]) => ({ X, V })), at, len: at[at.length - 1] };
}

const wayOut = { X: 0, V: 0 };
/** The point `d` along a way, `lat` units to its left. The result is reused. */
function wayPoint(way: Way, d: number, lat: number): { X: number; V: number } {
  let i = 1;
  while (i < way.at.length - 1 && way.at[i] < d) i++;
  const a = way.pts[i - 1];
  const b = way.pts[i];
  const seg = way.at[i] - way.at[i - 1];
  const u = seg <= 0 ? 0 : Math.max(0, Math.min(1, (d - way.at[i - 1]) / seg));
  const nx = seg <= 0 ? 0 : -(b.V - a.V) / seg;
  const nv = seg <= 0 ? 0 : (b.X - a.X) / seg;
  wayOut.X = a.X + (b.X - a.X) * u + nx * lat;
  wayOut.V = a.V + (b.V - a.V) * u + nv * lat;
  return wayOut;
}

/**
 * Whether someone `d` along a way is walking away from the camera, up the screen (more
 * up than across): they are drawn from behind. It reuses wayPoint's result.
 */
function awayFrom(way: Way, d: number, lat = 0): boolean {
  const a = wayPoint(way, d, lat);
  const X = a.X;
  const V = a.V;
  const b = wayPoint(way, d + 0.5, lat);
  return b.V - V > 0.35 * Math.abs(b.X - X);
}

interface Stander {
  X: number;
  V: number;
  x: number;
  y: number;
  cls: 0 | 1 | 2;
  /** The scale there, pixels a unit: for the size step (traffic-steps.ts). */
  s: number;
  look: PersonLook;
  key: number;
  /** Facing away from the camera (a queue facing the turnstiles). */
  back: boolean;
}

interface Flag {
  X: number;
  V: number;
  x: number;
  y: number;
  pole: number;
  big: boolean;
  a: Color;
  b: Color;
  post: Color;
  /** The pole's shaded side (the pole is two pixels wide). */
  postShade: Color;
  key: number;
}

export interface Life {
  draw(s: Surface, t: number, roar: number): void;
  /**
   * When the goal's rockets go up, seconds after the goal: only those with room to burst
   * (none on a phone). For the sound of them.
   */
  launches: readonly number[];
  /**
   * Everybody on foot who walks a way at time `t`: where they are on the map, and whether
   * they are standing at a kerb, and who they are (the same number all the way along).
   * For tests (nobody is ever under a car). `everyone`: the day's walkers whatever the
   * light (at night most stay in), for the ways they take.
   */
  people(
    t: number,
    fn: (X: number, V: number, waiting: boolean, who: number) => void,
    everyone?: boolean,
  ): void;
  /**
   * Everybody standing about who never moves from the spot (the queues at the
   * turnstiles, their stewards, groups on the plaza and by the wall): where they stand on
   * the map. For tests (nobody stands on Stadium Road).
   */
  standers(fn: (X: number, V: number) => void): void;
  /**
   * Every car, bus and coach on the road at time `t`: where it is on the map, the heading
   * of its sprite on screen (stadium-cars.ts) and the way its nose points on the map
   * (`fX`, `fV`; a coach backing out points the other way from the way it moves). For tests.
   */
  cars(
    t: number,
    fn: (X: number, V: number, heading: number, fX: number, fV: number) => void,
  ): void;
}

const TAU = Math.PI * 2;

/** The remainder that is never negative: time may be. */
function mod(a: number, n: number): number {
  return ((a % n) + n) % n;
}
/**
 * The share of the day's walkers out and about in this light: all of them by day, fewer
 * at dusk and dawn, 0.28 at night (with the pie van's customers, who keep coming, about a
 * third of the day's people on foot). The queues and the crowd stay: the match is on.
 */
export function walkersOut(light: Lighting): number {
  const e = light.sun.elevation;
  return 0.28 + 0.72 * Math.max(0, Math.min(1, (e + 12) / 18));
}

/** The share of the day's traffic on the roads: thinning more gently, to 0.6 at night. */
export function carsOut(light: Lighting): number {
  const e = light.sun.elevation;
  return 0.6 + 0.4 * Math.max(0, Math.min(1, (e + 12) / 18));
}

/** Seconds the goal's fireworks last, from the moment the ball goes in. */
export const FIREWORKS = 4.2;
/** How many rockets go up for the goal. */
const ROCKETS = 5;
/** Seconds a rocket takes to climb, and its burst by day and by night. */
const RISE = 0.4;
const BURST_DAY = 1.1;
const BURST_NIGHT = 1.5;
/** When rocket `i` goes up, seconds after the goal. */
function launchOf(i: number): number {
  return 0.2 + i * 0.5 + (i % 2) * 0.12;
}

/**
 * How many of the goal's rockets are in the air at time `t` (climbing or bursting): none
 * except in the FIREWORKS seconds after the match's goal. `night`: the longer bursts.
 */
export function fireworksAt(t: number, night = false): number {
  const since = mod(t, MATCH_PERIOD) - GOAL_AT;
  if (!(since >= 0 && since < FIREWORKS)) return 0;
  const burst = night ? BURST_NIGHT : BURST_DAY;
  let n = 0;
  for (let i = 0; i < ROCKETS; i++) {
    const a = since - launchOf(i);
    if (a >= 0 && a < RISE + burst) n++;
  }
  return n;
}

/** How fast the side roads' traffic (and the coach in it) goes, units a second. */
const COACH_SPEED = 6;

/** Where people wait for the traffic (stadium-crossing.ts), per canvas size and seed. */
const PLANS = new Map<string, Stop[][]>();

/**
 * What moves, for this view, light and seed over the painted town. `clear`: places on
 * screen the goal's fireworks keep out of (the airship).
 */
export function makeLife(
  view: View,
  light: Lighting,
  seed: number,
  town: Town,
  clear: readonly Zone[] = [],
): Life {
  const { w, h, hy, k } = view;
  const night = light.lightsOn;
  const sunny = light.sun.elevation > 6;
  // the day's club colours (stadium-club.ts): `light` grades the HOME ramp in them
  const club = clubOf(light);
  const raw = clubRaw(light);
  // At night fewer people are about: a walker is out for a whole lap or not at all, so
  // they come and go only at the ends of their walks. Cars thin out more gently.
  const walking = walkersOut(light);
  const driving = carsOut(light);
  /** Whether car `key`, on lap `lap` of its way, is on the road tonight. */
  const carOut = (key: number, lap: number): boolean =>
    driving >= 1 || h2(key, lap + 4099) < driving;
  const h2 = (a: number, b: number): number => hash2(a, b, seed);
  const tone = (c: Color, V: number): Color =>
    distant(light, c, hazeAt(view, V));
  const ink = new MaskedInk(town.land, town.depth, w, h);
  const bowl = town.bowl;

  // Walk plans are asked for in the same order every time a canvas of this size is built,
  // and the light does not change them: a change of light takes them from the memo.
  const planKey = `${w}x${h}:${seed}`;
  let known = PLANS.get(planKey);
  const planned = known !== undefined;
  if (known === undefined) {
    if (PLANS.size >= 6) PLANS.clear();
    known = [];
    PLANS.set(planKey, known);
  }
  const plans = known;
  let planAt = 0;
  const plan: typeof planWalk = (at, len, speed, start, rules) => {
    if (planned && planAt < plans.length) return plans[planAt++];
    const stops = planWalk(at, len, speed, start, rules);
    plans.push(stops);
    planAt++;
    return stops;
  };

  /** A turnstile: the point on the outer wall at this bearing. */
  const gate = (deg: number, out = 1.02): [number, number] => {
    const p = wallPoint((deg * Math.PI) / 180, out);
    return [p.X, p.V];
  };

  // ---- traffic --------------------------------------------------------------
  const routes: Route[] = [];
  const addRoute = (
    X0: number,
    V0: number,
    X1: number,
    V1: number,
    speed: number,
    gap: number,
    key: number,
    buses = false,
  ): void => {
    const len = Math.hypot(X1 - X0, V1 - V0);
    if (len < 1) return;
    const cars: Route["cars"] = [];
    const n = Math.max(1, Math.floor(len / gap));
    for (let i = 0; i < n; i++) {
      if (h2(i, key) < 0.22) continue;
      cars.push({
        off: (i + 0.15 + h2(i, key + 1) * 0.5) * (len / n),
        paint: h2(i, key + 2),
        bus: buses && i % 5 === 2,
        key: key * 61 + i,
      });
    }
    const dX = (X1 - X0) / len;
    const dV = (V1 - V0) / len;
    routes.push({ X0, V0, X1, V1, len, speed, dX, dV, cars });
  };
  // how far east-west the screen reaches at a depth
  const reach = (V: number): number => w / 2 / scaleAt(view, V) + 16;
  const rs = reach(-113);
  const rn = reach(125);
  // (the gaps were a third shorter until the product owner asked for a little less traffic)
  addRoute(-rn, ROAD.northV1 - 2.4, rn, ROAD.northV1 - 2.4, 9, 78, 13);
  addRoute(rn, ROAD.northV0 + 2.4, -rn, ROAD.northV0 + 2.4, 9, 92, 14);
  const westNorth = routes.length;
  addRoute(
    ROAD.westX0 + 2.9,
    ROAD.stadiumV1,
    ROAD.westX0 + 2.9,
    ROAD.northV0,
    COACH_SPEED,
    62,
    15,
  );
  addRoute(
    ROAD.westX1 - 2.9,
    ROAD.northV0,
    ROAD.westX1 - 2.9,
    ROAD.stadiumV1,
    6,
    74,
    16,
  );
  addRoute(
    ROAD.eastX0 + 2.9,
    ROAD.stadiumV1,
    ROAD.eastX0 + 2.9,
    ROAD.northV0,
    6,
    70,
    17,
  );
  addRoute(
    ROAD.eastX1 - 2.9,
    ROAD.northV0,
    ROAD.eastX1 - 2.9,
    ROAD.stadiumV1,
    6,
    80,
    18,
  );
  // the avenue: two lanes each way, out to the far town
  addRoute(-251, -226, -251, 640, 15, 58, 19);
  addRoute(-246.5, -226, -246.5, 640, 12, 76, 20, true);
  addRoute(-229, 640, -229, -226, 15, 56, 21);
  addRoute(-233.5, 640, -233.5, -226, 12, 82, 22);
  addRoute(ROAD.laneX0 + 2.6, -226, ROAD.laneX0 + 2.6, ROAD.sideEnd, 7, 70, 23);
  addRoute(ROAD.laneX1 - 2.6, ROAD.sideEnd, ROAD.laneX1 - 2.6, -226, 7, 80, 24);

  /**
   * Where something moving along the map by (dX, dV) is drawn at (X, V) (G2). It moves
   * along its line on screen a whole pixel at a time: the column (or, when it goes more up
   * the screen than across, the row) is rounded, and the other is read off the line at that
   * column, so a step across and a step up land in the same frame, at an even beat like the
   * train's, instead of each on its own rounding (a stagger of half steps). Still, it is
   * `project`'s place.
   */
  const glide = { x: 0, y: 0, s: 0 };
  const along = (X: number, V: number, dX: number, dV: number): Spot => {
    if (dX === 0 && dV === 0) return project(view, X, V);
    const a = projectRaw(view, X, V);
    const b = projectRaw(view, X + dX * 0.5, V + dV * 0.5);
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    // (nearer than the camera's nearest depth the map stands still on screen)
    if (Math.abs(ex) < 1e-9 && Math.abs(ey) < 1e-9) return project(view, X, V);
    glide.s = a.s;
    if (Math.abs(ex) >= Math.abs(ey)) {
      glide.x = Math.round(a.x);
      glide.y = Math.round(a.y + ((glide.x - a.x) * ey) / ex);
    } else {
      glide.y = Math.round(a.y);
      glide.x = Math.round(a.x + ((glide.y - a.y) * ex) / ey);
    }
    return glide;
  };

  /**
   * A car or a bus on the ground at (X, V), pointing `heading` on screen (stadium-cars.ts),
   * moving along (dX, dV) on the map (for `along`). `state`: 0 parked, 1 driving,
   * 2 reversing.
   */
  const drawCar = (
    X: number,
    V: number,
    heading: number,
    paint: number,
    bus: boolean,
    state: number,
    dX = 0,
    dV = 0,
  ): void => {
    const p = along(X, V, dX, dV);
    if (p.x < -24 || p.x > w + 24 || p.y > h + 16 || p.y < hy) {
      return;
    }
    const cls = sizeClass(p.s);
    //, one of five sizes (traffic-steps.ts), so it shrinks a step at a time
    const step = sizeStep(p.s);
    ink.V = V;
    const lit = night && state !== 0;
    vehicleLampShadow(p.x, p.y, bus, step, heading);
    if (bus) {
      const look = coachLook(tone, V, paint < 0.5 ? 3 : 0);
      coachSprite(ink, p.x, p.y, cls, heading, look, step);
      if (lit) {
        coachLamps(ink, p.x, p.y, cls, heading, state === 2 ? 2 : 1, step);
      }
      return;
    }
    // its shadow goes through the depth mask like the car: never over a tree or a roof
    // that stands in front of it
    const sh = carShadow(heading, cls, step);
    if (sh) ink.shadow(p.x + sh[0], p.y + sh[1], sh[2], sh[3]);
    car(ink, p.x, p.y, cls, heading, carLook(tone, V, paint), step);
    if (lit) carLamps(ink, p.x, p.y, cls, heading, state === 2 ? 2 : 1, step);
  };

  const drawTraffic = (s: Surface, t: number): void => {
    for (const r of routes) {
      for (const cr of r.cars) {
        const run = t * r.speed + cr.off;
        if (!carOut(cr.key, Math.floor(run / r.len))) continue;
        const d = ((run % r.len) + r.len) % r.len;
        const u = d / r.len;
        const X = r.X0 + (r.X1 - r.X0) * u;
        const V = r.V0 + (r.V1 - r.V0) * u;
        const heading = groundHeading(view, X, V, r.dX, r.dV);
        drawCar(X, V, heading, cr.paint, cr.bus, 1, r.dX, r.dV);
      }
    }
  };

  // ---- Stadium Road: its timetable keeps the zebra (stadium-road.ts) -----------------
  /** A Stadium Road car's pass: its paint is a hash of its slot, the same all the way. */
  const roadOut = (rc: RoadCar): boolean =>
    carOut(Math.floor(rc.paint * 65521), 977);
  const roadCar = (rc: RoadCar): void => {
    if (!roadOut(rc)) return;
    drawCar(rc.X, rc.V, rc.dir === 0 ? EAST : WEST, rc.paint, false, 1);
  };
  const drawRoad = (t: number): void => {
    roadCars(t, seed, rs, roadCar);
  };
  const place: WalkPlace = { d: 0, waiting: false };

  // ---- the away coach ---------------------------------------------------------
  // It comes up West Road in a gap in the traffic, turns into its bay in the coach park,
  // and the away fans get off and walk round to their turnstiles with a steward. Later
  // it backs out into the same gap (one lap of the road's traffic later) and drives on.
  const coachRoute = routes[westNorth];
  const coachLap = coachRoute.len / COACH_SPEED;
  const coachCycle = coachLap * 2;
  const coachSlot = ((): number => {
    const offs = coachRoute.cars.map((c) => c.off).sort((a, b) => a - b);
    if (offs.length === 0) return 0;
    let best = 0;
    let at = 0;
    for (let i = 0; i < offs.length; i++) {
      const next = i + 1 < offs.length ? offs[i + 1] : offs[0] + coachRoute.len;
      if (next - offs[i] > best) {
        best = next - offs[i];
        at = offs[i] + best / 2;
      }
    }
    return at % coachRoute.len;
  })();
  // It turns into the coach park on a quarter circle, from pointing north to pointing
  // west, then runs straight into its bay; it backs out the same way.
  const TURN_R = 3;
  const turnArc = (Math.PI * TURN_R) / 2;
  const turnLen = turnArc + (coachRoute.X0 - TURN_R - COACH_BAY.X);
  const coachToBay = (COACH_BAY.V - TURN_R - ROAD.stadiumV1) / COACH_SPEED;
  const coachTurn = turnLen / 4;
  /** Where the coach is `d` along its turn into the bay, and which way it points. */
  const coachPose = { X: 0, V: 0, fX: 0, fV: 1, moving: true, back: false };
  const turnAt = (d: number): void => {
    if (d < turnArc) {
      const a = d / TURN_R;
      coachPose.X = coachRoute.X0 - TURN_R + TURN_R * Math.cos(a);
      coachPose.V = COACH_BAY.V - TURN_R + TURN_R * Math.sin(a);
      coachPose.fX = -Math.sin(a);
      coachPose.fV = Math.cos(a);
      return;
    }
    coachPose.X = coachRoute.X0 - TURN_R - (d - turnArc);
    coachPose.V = COACH_BAY.V;
    coachPose.fX = -1;
    coachPose.fV = 0;
  };
  /** The coach at time t: coachPose. Its lap is coachCycle seconds. */
  const coachAt = (tau: number): void => {
    coachPose.moving = true;
    coachPose.back = false;
    if (tau < coachToBay) {
      coachPose.X = coachRoute.X0;
      coachPose.V = ROAD.stadiumV1 + tau * COACH_SPEED;
      coachPose.fX = 0;
      coachPose.fV = 1;
    } else if (tau < coachToBay + coachTurn) {
      turnAt((tau - coachToBay) * 4);
    } else if (tau < coachToBay + coachLap - coachTurn) {
      turnAt(turnLen);
      coachPose.moving = false;
    } else if (tau < coachToBay + coachLap) {
      turnAt((coachToBay + coachLap - tau) * 4);
      coachPose.back = true;
    } else {
      coachPose.X = coachRoute.X0;
      coachPose.V =
        COACH_BAY.V - TURN_R + (tau - coachToBay - coachLap) * COACH_SPEED;
      coachPose.fX = 0;
      coachPose.fV = 1;
    }
  };
  const coachTau = (t: number): number =>
    (((t + coachSlot / COACH_SPEED) % coachCycle) + coachCycle) % coachCycle;
  const coachWay = makeWay([
    [COACH_BAY.X + 4, COACH_BAY.V - 2.2],
    [-181, COACH_BAY.V - 3.5],
    [-166.5, 52],
    gate(165, 1.03),
  ]);
  const COACH_FANS = 14;
  /**
   * A near person's shadow on the ground at their feet, a little to the right (through
   * the depth mask, as the cars' are): the two nearest of the five sizes (G2,
   * traffic-steps.ts), at `sc` pixels a unit.
   */
  const footShadow = (x: number, y: number, sc: number): void => {
    const size = sizeStep(sc);
    if (size === 4) ink.shadow(x + 1.5, y, 2.5, 0.5);
    else if (size === 3) ink.shadow(x + 1, y, 2, 0.5);
    personLampShadow(x, y, sc);
  };
  /** The lamps lit: a person's shadow from a street lamp (lamp-shadows.ts). */
  const personLampShadow = (x: number, y: number, sc: number): void => {
    if (town.pools.length > 0) {
      castPersonShadow(ink.surface, town, x, y, sizeStep(sc));
    }
  };
  /** The lamps lit: a car's or a coach's shadow from a street lamp. */
  const vehicleLampShadow = (
    x: number,
    y: number,
    bus: boolean,
    step: ReturnType<typeof sizeStep>,
    heading: number,
  ): void => {
    if (town.pools.length > 0) {
      castVehicleShadow(ink.surface, town, x, y, bus, step, heading);
    }
  };
  /**
   * How high a walker jumps for a goal, in canvas pixels: 4 near, 3 for the size between
   * (G2), else 2.
   */
  const leap = (size: number): number => (size === 4 ? 4 : size === 3 ? 3 : 2);
  const coachPaint = coachLook(tone, COACH_BAY.V, 1);
  const drawCoach = (s: Surface, t: number, roar: number): void => {
    const tau = coachTau(t);
    coachAt(tau);
    const { X, V } = coachPose;
    const p = along(X, V, coachPose.fX, coachPose.fV);
    if (p.x > -24 && p.x < w + 24 && p.y < h + 20 && p.y >= hy) {
      const cls = sizeClass(p.s);
      const step = sizeStep(p.s);
      ink.V = V;
      const heading = groundHeading(view, X, V, coachPose.fX, coachPose.fV);
      vehicleLampShadow(p.x, p.y, true, step, heading);
      coachSprite(ink, p.x, p.y, cls, heading, coachPaint, step);
      if (night && coachPose.moving) {
        const state = coachPose.back ? 2 : 1;
        coachLamps(ink, p.x, p.y, cls, heading, state, step);
      }
    }
    // the fans off it, one after another
    const off = tau - coachToBay - coachTurn - 0.8;
    if (off < 0) return;
    const visit = Math.floor((t + coachSlot / COACH_SPEED) / coachCycle);
    const beat = Math.floor(t * 5);
    for (let j = 0; j < COACH_FANS; j++) {
      const d = (off - j * 0.8) * 3.3;
      if (d < 0 || d >= coachWay.len) continue;
      const q = wayPoint(coachWay, d, (h2(j, 640) - 0.5) * 2.4);
      const fp = project(view, q.X, q.V);
      if (fp.x < -8 || fp.x > w + 8 || fp.y > h + 12 || fp.y < hy) {
        continue;
      }
      ink.V = q.V;
      const look = personLook(
        (c) => tone(c, q.V),
        h2(j, 641 + (visit & 63)),
        j % 7 === 0 ? 2 : 1,
        club,
      );
      const jump = roar > 0 && h2(j, beat + 11) < roar * 0.7 ? 2 : 0;
      footShadow(fp.x, fp.y, fp.s);
      // they walk off up the screen to the away turnstiles: seen from behind
      person(
        ink,
        fp.x,
        fp.y,
        sizeClass(fp.s),
        look,
        (beat + j) % 2,
        jump,
        awayFrom(coachWay, d),
        sizeStep(fp.s),
      );
    }
  };

  // ---- the train ------------------------------------------------------------
  const trainSpan = reach(RAIL.mid) + 110;
  const TRAIN_SPEED = 19;
  /** Seconds a train stands at Stadium Halt, and seconds it takes to brake or pull away. */
  const DWELL = 8;
  const BRAKE = 3;
  /**
   * One carriage, `len` px long from x0 with its wheels on row y - 1: a lit
   * roof edge, the roof, a band of windows between pillars (lit at night), the body and
   * the dark underframe; 6 rows tall when near, else 4. Car 0 carries the
   * nose and its lamp.
   */
  const trainCar = (
    x0: number,
    len: number,
    y: number,
    near: boolean,
    line: number,
    i: number,
    V: number,
  ): void => {
    const roof = tone(line === 0 ? P.steelHi : P.chalk, V);
    const roofShade = tone(line === 0 ? P.mist : P.steelHi, V);
    const body = tone(line === 0 ? P.awayDark : P.goldDark, V);
    const under = tone(P.night, V);
    const glass = tone(P.slate, V);
    const tall = near ? 6 : 4;
    const top = y - tall;
    ink.rect(x0, top, len, 1, roof);
    if (near) ink.rect(x0, top + 1, len, 1, roofShade);
    const band = near ? top + 2 : top + 1;
    const rows = near ? 2 : 1;
    ink.rect(x0, band, len, rows, body);
    // windows two wide with a pillar between, clear of the ends
    for (let x = x0 + 2; x + 1 < x0 + len - 1; x += 4) {
      if (night) {
        ink.rect(x, band, 2, rows, P.goldLight);
      } else {
        ink.rect(x, band, 2, rows, glass);
        if (near) ink.px(x, band, roofShade);
      }
    }
    ink.rect(x0, band + rows, len, 1, body);
    ink.rect(x0, y - 1, len, 1, under);
    if (i === 0) {
      const nose = line === 0 ? x0 + len - 1 : x0;
      // the cab's windscreen at the nose end, and its lamp below
      ink.rect(nose, band, 1, rows, glass);
      ink.px(nose, band + rows, night ? P.white : tone(P.gold, V));
    }
  };

  const drawTrain = (s: Surface, t: number): void => {
    for (const line of [0, 1]) {
      const V = RAIL.mid + (line === 0 ? -1.3 : 1.3);
      const lap = trainSpan * 2 + 260;
      // How far along its lap each train stops: with its middle at the platform's middle.
      const mid = (STATION.x0 + STATION.x1) / 2;
      const stop = line === 0 ? mid + 32 + trainSpan : trainSpan - (mid - 24);
      const lapTime = lap / TRAIN_SPEED + DWELL + BRAKE;
      const tau = (((t + line * lapTime * 0.55) % lapTime) + lapTime) % lapTime;
      // constant speed, a steady brake to the platform, the wait, away again
      const t1 = stop / TRAIN_SPEED - BRAKE / 2;
      let d: number;
      if (tau < t1) d = tau * TRAIN_SPEED;
      else if (tau < t1 + BRAKE) {
        const u = (tau - t1) / BRAKE;
        d = t1 * TRAIN_SPEED + TRAIN_SPEED * BRAKE * (u - (u * u) / 2);
      } else if (tau < t1 + BRAKE + DWELL) d = stop;
      else if (tau < t1 + BRAKE * 2 + DWELL) {
        const u = (tau - t1 - BRAKE - DWELL) / BRAKE;
        d = stop + (TRAIN_SPEED * BRAKE * u * u) / 2;
      } else
        d =
          stop +
          (TRAIN_SPEED * BRAKE) / 2 +
          (tau - t1 - BRAKE * 2 - DWELL) * TRAIN_SPEED;
      const head = line === 0 ? -trainSpan + d : trainSpan - d;
      const sc = scaleAt(view, V);
      const y = Math.round(rowAt(view, V));
      const cars = line === 0 ? 5 : 4;
      const carLen = 15;
      ink.V = V;
      for (let i = 0; i < cars; i++) {
        const Xa = head - (line === 0 ? 1 : -1) * i * (carLen + 1);
        const x0 = Math.round(view.cx + (Xa - carLen / 2) * sc);
        const x1 = Math.round(view.cx + (Xa + carLen / 2) * sc) - 1;

        if (x1 < -4 || x0 > w + 4) continue;
        trainCar(x0, Math.max(4, x1 - x0), y, sc > 1.6, line, i, V);
      }
    }
  };

  // ---- supporters on the move -----------------------------------------------
  const paths: Path[] = [];
  let pathKey = 100;
  const addPath = (
    pts: [number, number][],
    count: number,
    kind: number,
    lit: boolean,
    spread = 2.4,
  ): void => {
    const at = [0];
    for (let i = 1; i < pts.length; i++) {
      at.push(
        at[i - 1] +
          Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]),
      );
    }
    const len = at[at.length - 1];
    const walkers: Path["walkers"] = [];
    const path: Path = {
      pts: pts.map(([X, V]) => ({ X, V })),
      at,
      len,
      lit,
      walkers,
    };
    // only the ways that come near Stadium Road have traffic to give way to
    const nearRoad = pts.some(([, V]) => V < ROAD.stadiumV1 + 4);
    const key = pathKey++;
    for (let i = 0; i < count; i++) {
      const speed = 2.6 + h2(i, key + 1) * 1.4;
      const lat = (h2(i, key + 2) - 0.5) * 2 * spread;
      const shift = (((i + h2(i, key) * 0.8) / count) * len) / speed;
      // a lap is a whole number of cycles, so every lap sets off at the moment -shift of one
      const stops = nearRoad
        ? plan((d) => wayPoint(path, d, lat), len, speed, -shift)
        : [];
      walkers.push({
        shift,
        speed,
        lat,
        look: h2(i, key + 3),
        kind: kind === 9 ? (i % 6 === 0 ? 2 : 1) : kind,
        stops,
        lap: nearRoad ? lapOf(len, speed, stops) : len / speed,
        key: key * 97 + i,
      });
    }
    paths.push(path);
  };
  // up the plaza to the main gates, either side of the middle, over the zebra (the
  // outermost lanes come in to its ends). There were 44 of them until the product owner
  // asked for a few less people.
  for (const [lane, deg, n] of [
    [-52, -127.5, 3],
    [-43, -105, 4],
    [-33, -105, 3],
    [-14, -82.5, 2],
    [12, -82.5, 2],
    [33, -82.5, 3],
    [43, -60, 4],
    [52, -60, 3],
  ] as const) {
    const cross = Math.abs(lane) > 45 ? Math.sign(lane) * 45 : lane * 0.98;
    addPath(
      [
        [lane, -236],
        [cross, ROAD.stadiumV0 - 4],
        [cross * 0.97, ROAD.stadiumV1 + 3],
        gate(deg),
      ],
      n,
      0,
      true,
      2.8,
    );
  }
  // from the far end of the car park, along the hedge to the plaza and over the zebra
  addPath(
    [
      [Math.min(CARPARK.x1 - 8, rs), KERB_V],
      [GATE.x1 + 0.5, KERB_V],
      [GATE.x0 - 1.5, KERB_V],
      [57, ROAD.stadiumV0 - 2.5],
      [46, ROAD.stadiumV0 - 0.5],
      [44, ROAD.stadiumV1 + 2],
      gate(-60),
    ],
    6,
    0,
    false,
    0.4,
  );
  // along Stadium Road from the west and the east
  addPath(
    [[-rs, ROAD.stadiumV1 + 1.6], [-162, ROAD.stadiumV1 + 1.6], gate(-150)],
    5,
    0,
    true,
    1.2,
  );
  // (it keeps to the kerb a little longer: the mascot stands on the lawn just inside the
  // corner, stadium-mascot.ts)
  addPath(
    [[-rs, ROAD.stadiumV1 + 1.4], [-111, ROAD.stadiumV1 + 2], gate(-127.5)],
    4,
    0,
    true,
    1.2,
  );
  addPath(
    [[rs, ROAD.stadiumV1 + 1.6], [150, ROAD.stadiumV1 + 1.6], gate(-37.5)],
    4,
    0,
    true,
    1.2,
  );
  // out of the pub, across the road
  addPath(
    [
      [-PLAZA_HALF - 12, ROAD.stadiumV0 - 3],
      [-PLAZA_HALF - 4, ROAD.stadiumV0 - 2],
      [-56, ROAD.stadiumV1 + 2],
      gate(-127.5),
    ],
    3,
    0,
    true,
    1,
  );
  // from the station, down East Road
  addPath(
    [[222, 156], [190, 150], [164.6, 126], [164.4, 44], gate(15, 1.03)],
    7,
    0,
    false,
    1.3,
  );
  addPath(
    [[236, 156], [192, 152], [164.6, 128], [164.2, -8], gate(-15, 1.03)],
    7,
    0,
    false,
    1.3,
  );
  // the away end: off the coaches, stewards alongside
  addPath(
    [[-200, 66], [-181, 60], [-166.5, 52], gate(165, 1.03)],
    3,
    9,
    false,
    1.5,
  );
  addPath(
    [[-198, -24], [-180, -22], [-166.5, -26], gate(-172.5, 1.03)],
    5,
    0,
    false,
    1.5,
  );
  // strollers in the park
  addPath(
    [
      [190, -96],
      [190, 110],
      [326, 110],
      [326, -96],
      [190, -96],
    ],
    5,
    3,
    false,
    1,
  );
  addPath(
    [
      [POND.x - 40, POND.v - 22],
      [POND.x, POND.v],
      [POND.x + 40, POND.v + 22],
    ],
    0,
    3,
    false,
    1,
  );

  const walkerLooks = new Map<number, PersonLook>();
  const lookFor = (
    wk: Path["walkers"][number],
    lit: boolean,
    V: number,
  ): PersonLook => {
    if (lit) {
      const key = Math.floor(wk.look * 4096) * 4 + wk.kind;
      let lk = walkerLooks.get(key);
      if (!lk) {
        lk = personLook(light.lit, wk.look, wk.kind, club);
        walkerLooks.set(key, lk);
      }
      return lk;
    }
    return personLook((c) => tone(c, V), wk.look, wk.kind, club);
  };

  const step: WalkPlace = { d: 0, waiting: false };
  /** Where a path's walker is at time t. False while it is out of sight between laps. */
  const walkerAt = (
    path: Path,
    wk: Path["walkers"][number],
    t: number,
    everyone = false,
  ): boolean => {
    if (walking < 1 && !everyone) {
      const lap = Math.floor((t + wk.shift) / wk.lap);
      if (h2(wk.key, lap + 31337) >= walking) return false;
    }
    const tau = (((t + wk.shift) % wk.lap) + wk.lap) % wk.lap;
    walkAt(wk.stops, wk.speed, tau, step);
    if (step.d >= path.len) return false;
    wayPoint(path, step.d, wk.lat);
    return true;
  };
  const drawWalkers = (s: Surface, t: number, roar: number): void => {
    const beat = Math.floor(t * 5);
    for (const path of paths) {
      for (let wi = 0; wi < path.walkers.length; wi++) {
        const wk = path.walkers[wi];
        if (!walkerAt(path, wk, t)) continue;
        const X = wayOut.X;
        const V = wayOut.V;
        const p = project(view, X, V);
        if (p.x < -8 || p.x > w + 8 || p.y > h + 12 || p.y < hy) {
          continue;
        }
        const cls = sizeClass(p.s);
        const size = sizeStep(p.s);
        ink.V = V;
        const jump = roar > 0 && h2(wi, beat + 7) < roar * 0.7 ? leap(size) : 0;
        footShadow(p.x, p.y, p.s);
        person(
          ink,
          p.x,
          p.y,
          cls,
          lookFor(wk, path.lit, V),
          step.waiting ? 0 : (beat + wi) % 2,
          jump,
          awayFrom(path, step.d, wk.lat),
          size,
        );
      }
    }
  };

  // ---- supporters standing about --------------------------------------------
  const standers: Stander[] = [];
  let standKey = 500;
  const stand = (
    X: number,
    V: number,
    kind: number,
    lit: boolean,
    back = false,
  ): void => {
    const p = project(view, X, V);
    if (p.x < -8 || p.x > w + 8 || p.y > h + 12 || p.y < hy) return;
    const key = standKey++;
    // Nobody stands about on Stadium Road: the cars would drive through them, and some of
    // the groups by the wall reach that far out. (The key is still used up, so everybody
    // else keeps the clothes they had.)
    if (roadway(X, V)) return;
    standers.push({
      X,
      V,
      x: p.x,
      y: p.y,
      cls: sizeClass(p.s),
      s: p.s,
      look: personLook(
        lit ? light.lit : (c) => tone(c, V),
        h2(key, 3),
        kind,
        club,
      ),
      key,
      back,
    });
  };
  // queues at the turnstiles, a steward at each
  for (let b = 1; b < BAYS; b += 3) {
    const a = (b / BAYS) * TAU - Math.PI;
    const awayGate = b === 46 || b === 43;
    const count = 4 + Math.floor(h2(b, 9) * 4);
    for (let j = 0; j < count; j++) {
      for (const col of [-0.75, 0.75]) {
        if (h2(b * 9 + j, col > 0 ? 1 : 2) < 0.12) continue;
        const q = wallPoint(a, 1.018 + j * 0.0125);
        // facing the turnstile: from behind on the near side of the ground
        const facing = Math.sin(a) < 0;
        stand(
          q.X + col * Math.sin(a),
          q.V - col * Math.cos(a),
          awayGate ? 1 : 0,
          true,
          facing,
        );
      }
    }
    const st = wallPoint(a, 1.03);
    stand(st.X + 3.4 * Math.sin(a), st.V - 3.4 * Math.cos(a), 2, true);
  }
  // the pie van's queue (plan: southEast), the kiosks, groups on the plaza
  for (const side of [-1, 1]) {
    for (let i = 0; i < 2; i++) {
      const q = wallPoint(
        (-90 + side * (38 + i * 13)) * (Math.PI / 180),
        1.115,
      );
      stand(q.X - 1.5, q.V - 4, 0, true);
      stand(q.X + 1.6, q.V - 4.6, i === 0 ? 3 : 0, true);
      if (i === 0) stand(q.X + 0.2, q.V - 6.6, 0, true);
    }
  }
  for (let i = 0; i < 30; i++) {
    const X = (h2(i, 40) - 0.5) * 2 * (PLAZA_HALF - 8);
    const V = ROAD.stadiumV0 - 5 - h2(i, 41) * 60;
    stand(X, V, i % 9 === 0 ? 2 : i % 7 === 0 ? 1 : 0, V > ROAD.stadiumV0 - 30);
    if (i % 2 === 0) stand(X + 1.7, V - 0.7, 0, V > ROAD.stadiumV0 - 30);
    if (i % 4 === 0) stand(X - 1.2, V - 1.6, 0, V > ROAD.stadiumV0 - 30);
  }
  for (let i = 0; i < 26; i++) {
    const a = -Math.PI * (0.06 + 0.88 * h2(i, 44));
    const q = wallPoint(a, 1.1 + h2(i, 45) * 0.07);
    stand(q.X, q.V, i % 8 === 0 ? 2 : 0, true);
    if (i % 3 === 0) stand(q.X + 1.6, q.V + 0.5, 0, true);
  }
  // at the bus stops, in the park, by the coaches
  for (let i = 0; i < 5; i++)
    stand(-96 - i * 1.7, ROAD.stadiumV0 - 1.8, i === 1 ? 3 : 0, false, true);
  for (let i = 0; i < 4; i++) stand(212 + i * 3, 86 + (i % 2) * 5, 3, false);
  for (let i = 0; i < 6; i++)
    stand(-196 + (i % 3) * 2, 34 - Math.floor(i / 3) * 14, 1, false);
  standers.sort((a, b) => b.V - a.V);

  const drawStanders = (s: Surface, t: number, roar: number): void => {
    const beat = Math.floor(t * 2);
    const fast = Math.floor(t * 6);
    for (const p of standers) {
      ink.V = p.V;
      const shuffle = h2(p.key, beat) < 0.14 ? 1 : 0;
      const size = sizeStep(p.s);
      const jump =
        roar > 0 && h2(p.key, fast + 3) < roar * 0.75 ? leap(size) : 0;
      footShadow(p.x, p.y, p.s);
      // (a jump for a goal turns them round to cheer)
      const back = p.back && !jump;
      person(ink, p.x, p.y, p.cls, p.look, shuffle, jump, back, size);
    }
  };

  // ---- the queue at the pie van ---------------------------------------------
  // Place 0 is at the hatch. Every five seconds the one at the front is served and walks
  // off over the zebra, everybody behind shuffles up a place and somebody joins.
  const queueSpot = (j: number): { X: number; V: number } => {
    if (j < 0) return { X: PLAZA_HALF - 19, V: ROAD.stadiumV0 - 10.5 + j * -2 };
    return {
      X: PLAZA_HALF - 10 + (j > 3 ? (j - 3) * 1.7 : 0),
      V: ROAD.stadiumV0 - 11.6 - Math.min(j, 4) * 2.3,
    };
  };
  const QUEUE = 7;
  const SERVE = 5;
  const queueSpots: { X: number; V: number }[] = [];
  for (let j = -1; j <= QUEUE; j++) queueSpots.push(queueSpot(j));
  const queueLooks: PersonLook[] = [];
  for (let i = 0; i < 16; i++) {
    queueLooks.push(
      personLook(
        light.lit,
        h2(i, 610),
        i % 5 === 3 ? 3 : i % 7 === 6 ? 1 : 0,
        club,
      ),
    );
  }
  // Whoever has been served steps aside (place -1) and walks off with a pie: to the kerb,
  // over the road in a gap in the traffic like everybody else, and up to a turnstile. They
  // used to walk into the road and vanish there. A turn is SERVE seconds and the traffic
  // repeats every CYCLE (a whole number of turns), so there is one plan for each turn
  // modulo CYCLE / SERVE.
  const pieWay = makeWay([
    [queueSpots[0].X, queueSpots[0].V],
    [PLAZA_HALF - 22, ROAD.stadiumV0 - 2.4],
    [PLAZA_HALF - 24, ROAD.stadiumV1 + 2],
    gate(-60),
  ]);
  const PIE_PACE = 3;
  const piePlans: Stop[][] = [];
  const PIE_PLANS = Math.round(CYCLE / SERVE);
  for (let n = 0; n < PIE_PLANS; n++) {
    piePlans.push(
      plan((d) => wayPoint(pieWay, d, 0), pieWay.len, PIE_PACE, n * SERVE),
    );
  }
  /** How many of them can be on their way at once. */
  const PIE_MOST = Math.ceil((pieWay.len / PIE_PACE + CYCLE) / SERVE);
  /** Everybody walking off with a pie at time t: fn(how many turns ago, which turn, X, V, waiting). */
  /** How far along the pie's way the one pieWalkers is telling of is. */
  let pieAt = 0;
  const pieWalkers = (
    t: number,
    fn: (
      ago: number,
      served: number,
      X: number,
      V: number,
      waiting: boolean,
    ) => void,
  ): void => {
    const turn = Math.floor(t / SERVE);
    for (let ago = 1; ago <= PIE_MOST; ago++) {
      const served = turn - ago;
      const tau = t - (served + 1) * SERVE;
      walkAt(piePlans[mod(served + 1, PIE_PLANS)], PIE_PACE, tau, place);
      if (place.d >= pieWay.len) continue;
      const q = wayPoint(pieWay, place.d, 0);
      pieAt = place.d;
      fn(ago, served, q.X, q.V, place.waiting);
    }
  };
  const drawQueue = (s: Surface, t: number, roar: number): void => {
    const turn = Math.floor(t / SERVE);
    const u = t / SERVE - turn;
    // the shuffle takes the last second and a bit, in three steps
    const move =
      u < 0.76 ? 0 : Math.min(1, (Math.floor(((u - 0.76) / 0.24) * 3) + 1) / 3);
    const beat = Math.floor(t * 6);
    for (let j = QUEUE; j >= 0; j--) {
      const a = queueSpots[j + 1];
      const b = queueSpots[j];
      // the newcomer walks up from the car park's side
      const X = a.X + (b.X - a.X) * move + (j === QUEUE ? (1 - move) * 5 : 0);
      const V = a.V + (b.V - a.V) * move;
      const p = project(view, X, V);
      if (p.x < -8 || p.x > w + 8 || p.y > h + 12 || p.y < hy) {
        continue;
      }
      ink.V = V;
      const who = (((turn + j) % 16) + 16) % 16;
      const jump = roar > 0 && h2(who, beat + 3) < roar * 0.7 ? 2 : 0;
      footShadow(p.x, p.y, p.s);
      // facing the hatch, up the screen
      person(
        ink,
        p.x,
        p.y,
        sizeClass(p.s),
        queueLooks[who],
        move > 0 && move < 1 ? beat % 2 : 0,
        jump,
        jump === 0,
        sizeStep(p.s),
      );
    }
    // those who have been served walk off with a pie, one every turn
    const stride = Math.floor(t * 5);
    pieWalkers(t, (ago, served, X, V, waiting) => {
      const p = project(view, X, V);
      if (p.x < 0 || p.x >= w || p.y >= h || p.y < hy) return;
      ink.V = V;
      const who = mod(served, 16);
      const jump = roar > 0 && h2(who, beat + 3) < roar * 0.7 ? 2 : 0;
      footShadow(p.x, p.y, p.s);
      person(
        ink,
        p.x,
        p.y,
        sizeClass(p.s),
        queueLooks[who],
        waiting ? 0 : (stride + ago) % 2,
        jump,
        jump === 0 && awayFrom(pieWay, pieAt),
        sizeStep(p.s),
      );
    });
  };

  // ---- the kickabout and the dog walker in the park -------------------------
  const kids: { X: number; V: number; kind: number }[] = [
    { X: 208, V: 80, kind: 0 },
    { X: 232, V: 88, kind: 1 },
    { X: 226, V: 72, kind: 3 },
    { X: 214, V: 96, kind: 0 },
  ];
  const drawPark = (s: Surface, t: number): void => {
    const step = Math.floor(t * 4);
    for (let i = 0; i < kids.length; i++) {
      const kd = kids[i];
      const p = project(view, kd.X + ((step + i) % 3) - 1, kd.V);
      if (p.x < 0 || p.x >= w || p.y >= h) continue;
      ink.V = kd.V;
      personLampShadow(p.x, p.y, p.s);
      person(
        ink,
        p.x,
        p.y,
        sizeClass(p.s),
        personLook((c) => tone(c, kd.V), 0.13 * (i + 1), kd.kind, club),
        step % 2,
        0,
        false,
        sizeStep(p.s),
      );
    }
    const leg = t / 1.7;
    const from = kids[mod(Math.floor(leg), kids.length)];
    const to = kids[mod(Math.floor(leg) + 1, kids.length)];
    const u = leg - Math.floor(leg);
    const bp = project(
      view,
      from.X + (to.X - from.X) * u,
      from.V + (to.V - from.V) * u,
      0.6 + 2 * u * (1 - u),
    );
    ink.V = from.V - 20;

    // a ball two pixels across, lit at the top left, over its shadow on the grass
    const gp = project(
      view,
      from.X + (to.X - from.X) * u,
      from.V + (to.V - from.V) * u,
    );
    ink.shadow(gp.x + 0.5, gp.y, 0.5, 0);
    drawParkBall(ink, bp.x - 1, bp.y - 1, tone(P.white, 80), tone(P.mist, 80));

    // the dog walker goes round the pond; the dog runs ahead
    const a = -t / 26;
    for (const [lag, isDog] of [
      [0, false],
      [0.2, true],
    ] as const) {
      const X = POND.x + Math.cos(a - lag) * (POND.a + 6);
      const V = POND.v + Math.sin(a - lag) * (POND.b + 5);
      const p = project(view, X, V);
      if (p.x < 0 || p.x >= w || p.y >= h) continue;
      ink.V = V;
      if (isDog && true) {
        drawDog(
          ink,
          p.x,
          p.y,
          sizeClass(p.s) > 0,
          Math.sin(a - lag) < 0,
          step % 2,
          tone(P.wood, V),
          tone(P.woodDark, V),
          tone(P.ink, V),
        );
      } else if (isDog) {
        ink.px(p.x, p.y - 1, tone(P.wood, V));
        if (sizeClass(p.s) > 0)
          ink.px(p.x + (step % 2 === 0 ? 1 : -1), p.y - 1, tone(P.woodDark, V));
      } else {
        personLampShadow(p.x, p.y, p.s);
        person(
          ink,
          p.x,
          p.y,
          sizeClass(p.s),
          personLook((c) => tone(c, V), 0.77, 3, club),
          step % 2,
          0,
          false,
          sizeStep(p.s),
        );
      }
    }
    // ducks
    for (let i = 0; i < 3; i++) {
      const X = POND.x - 12 + i * 7 + Math.round(2 * Math.sin(t / (5 + i) + i));
      const p = project(view, X, POND.v - 4 + i * 2);
      if (p.x < 0 || p.x >= w || p.y >= h) continue;
      ink.V = POND.v;

      const white = i === 1;
      drawDuck(
        ink,
        p.x,
        p.y,
        Math.cos(t / (5 + i) + i) < 0,
        tone(white ? P.white : P.wood, POND.v),
        tone(white ? P.steelHi : P.woodDark, POND.v),
        tone(white ? P.white : P.grassDark, POND.v),
        tone(P.gold, POND.v),
      );
    }
  };

  // ---- flags ----------------------------------------------------------------
  const flags: Flag[] = [];
  let flagKey = 0;
  const addFlag = (
    X: number,
    V: number,
    H: number,
    pole: number,
    big: boolean,
    floodlit: boolean,
  ): void => {
    const p = project(view, X, V, H);
    if (p.x < 4 || p.x > w - 4) return;
    const key = flagKey++;
    const pair = [
      [P.home, P.homeLight],
      [club.second.base, club.second.light],
      [club.second.dark, club.second.base],
      [P.home, P.homeLight],
      [P.away, P.awayLight],
    ][key % 5];
    const g = floodlit ? light.lit : (c: Color): Color => tone(c, V);
    flags.push({
      X,
      V,
      x: p.x,
      y: p.y,
      pole,
      big,
      a: g(pair[0]),
      b: g(pair[1]),
      post: g(P.steelHi),
      postShade: g(P.mist),
      key,
    });
  };
  // round the far rim of the roof (sizes chosen on half the scale: `k1`)
  const k1 = k / 2;
  for (let deg = 12; deg <= 168; deg += 13) {
    const q = wallPoint((deg * Math.PI) / 180, 1.03);
    addFlag(q.X, q.V, HR, (k1 > 0.7 ? 5 : 3) * 2, k1 > 0.7, false);
  }
  // down both edges of the plaza
  for (let V = ROAD.stadiumV0 - 19; V > -240; V -= 18) {
    for (const side of [-1, 1]) {
      const sc = scaleAt(view, V) / 2;
      addFlag(
        side * (PLAZA_HALF - 3),
        V,
        0,
        Math.round(Math.min(18, 8.5 * sc)) * 2,
        sc > 1.4,
        true,
      );
    }
  }
  const drawFlags = (s: Surface, t: number, roar: number): void => {
    const rate = roar > 0.3 ? 7 : 3;
    for (const f of flags) {
      ink.V = f.V - (f.pole > 12 ? 0 : 60);
      const step = (Math.floor(t * rate) + f.key) % 4;

      const { x, y, pole, big, a, b, post, postShade } = f;
      drawFlag(ink, x, y, pole, big, step, a, b, post, postShade);
    }
  };

  // ---- the match (stadium-match.ts) -------------------------------------------------
  const game = makeMatchState();
  const kit = {
    home: light.lit(club.kit.shirt),
    away: light.lit(P.awayLight),
    // dark shorts for both sides: the ball is the only white thing that moves
    homeShorts: light.lit(club.kit.shorts),
    awayShorts: light.lit(P.awayDark),
    dark: light.lit(P.night),
    homeKeeper: light.lit(P.gold),
    awayKeeper: light.lit(P.duskMid),
    referee: light.lit(P.night),
    heads: [
      light.lit(P.skinA),
      light.lit(P.skinB),
      light.lit(P.skinC),
      light.lit(P.skinA),
      light.lit(P.hairDark),
    ],
    shade: light.lit(P.grassDeep),
    ball: light.lit(P.white),
    rim: light.lit(P.ink),
    hair: light.lit(P.hairBrown),
  };
  const spotX = new Int32Array(PLAYERS);
  const spotY = new Int32Array(PLAYERS);
  const order = Array.from({ length: PLAYERS }, (_, i) => i);
  const drawMatch = (s: Surface, t: number, roar: number): number => {
    if (k1 < 0.3) return 0;
    // every frame: they move a whole pixel at a time, as smoothly as they run
    matchAt(game, t);
    ink.V = -400;
    const tall = k1 >= 0.8;
    drawPlayers(tall);
    return crowdMurmur(s, t, roar);
  };
  /**
   * The match: the players, 2 x 6 each (drawTinyPlayer), standing or in their stride,
   * the far ones first so the near ones stand in front, and the ball 2 x 2 with a dark
   * ring on the grass, in its place among them. Nobody is moved to make room: the runs
   * keep the players apart (stadium-match.ts), so nobody jumps.
   */
  const drawPlayers = (tall: boolean): void => {
    for (let i = 0; i < PLAYERS; i++) {
      const p = project(view, game.x[i], game.v[i]);
      spotX[i] = p.x;
      spotY[i] = p.y;
    }
    order.sort((a, b) => spotY[a] - spotY[b] || spotX[a] - spotX[b] || a - b);
    const g = project(view, game.ballX, game.ballV);
    const b = project(view, game.ballX, game.ballV, game.ballH);
    if (b.y < g.y - 2) ink.rect(g.x, g.y, 2, 1, kit.shade);
    // the ball on the grass is drawn among the players at its depth; in the air, over them
    const ballRow = b.y < g.y - 2 ? Infinity : g.y;
    let ballDrawn = false;
    for (const i of order) {
      if (!ballDrawn && spotY[i] > ballRow) {
        drawMatchBall(tall, b.x, b.y);
        ballDrawn = true;
      }
      const j = i % 11;
      const shirt =
        i === REFEREE
          ? kit.referee
          : j === 0
            ? i < 11
              ? kit.homeKeeper
              : kit.awayKeeper
            : i < 11
              ? kit.home
              : kit.away;
      const shorts =
        i === REFEREE || j === 0
          ? kit.dark
          : i < 11
            ? kit.homeShorts
            : kit.awayShorts;
      const skin = kit.heads[i % 4];
      const hair =
        i % 3 === 0
          ? kit.heads[4]
          : skin === kit.heads[2]
            ? kit.heads[4]
            : kit.hair;
      drawTinyPlayer(
        ink,
        spotX[i],
        spotY[i],
        tall,
        skin,
        hair,
        shirt,
        shorts,
        kit.shade,
        game.stride[i],
      );
    }
    if (!ballDrawn) drawMatchBall(tall, b.x, b.y);
  };
  /** The ball, 2 x 2, its bottom left on (x, y + 1) seen from above; near, a dark ring on the grass round it. */
  const drawMatchBall = (tall: boolean, x: number, y: number): void => {
    const by = tall ? y - 1 : y - 3;
    if (tall) {
      for (let n = 0; n < 8; n++) {
        ink.px(
          x + [-1, -1, 2, 2, 0, 1, 0, 1][n],
          by + [0, 1, 0, 1, -1, -1, 2, 2][n],
          kit.rim,
        );
      }
    }
    ink.rect(x, by, 2, 2, kit.ball);
  };
  /** The crowd: a murmur, a gasp, and for a goal arms up all round with a wave through it. */
  const crowdMurmur = (s: Surface, t: number, roar: number): number => {
    if (roar > 0 || game.cheer <= 0) return game.cheer;
    const data = s.data;
    const beat = Math.floor(t * 8);
    const n = bowl.crowdAt.length;
    const base = game.cheer * 0.34;
    const wave = game.sinceGoal >= 0.4;
    const span = Math.max(1, bowl.layer.w);
    const front = bowl.x + ((game.sinceGoal * 0.42) % 1) * span;
    const band = Math.max(6, span * 0.07);
    // it is the home side's goal: the away end keeps its arms down and its cameras away
    const goal = game.sinceGoal >= 0;
    for (let i = 0; i < n; i++) {
      if (goal && bowl.crowdAway[i] === 1) continue;
      const at = bowl.crowdAt[i];
      let chance = base;
      if (wave) {
        const d = Math.abs((at % w) - front);
        if (d < band || span - d < band) chance = 0.9 * game.cheer;
      }
      if (h2(i, beat) < chance) data[at] = bowl.crowdUp[i];
    }
    if (game.cheer > 0.5 && n > 0) {
      for (let i = 0; i < 5; i++) {
        const who = Math.floor(h2(i, beat + 50) * n);
        if (bowl.crowdAway[who] !== 1) data[bowl.crowdAt[who]] = P.white;
      }
    }
    return game.cheer;
  };

  // ---- smoke, turbines, beacons, birds --------------------------------------
  const sky = skyFor(light);
  const smokeA = sky.cloudLight;
  const smokeB = sky.cloudShade;
  const drawAir = (s: Surface, t: number): void => {
    for (let i = 0; i < town.chimneys.length; i++) {
      const ch = town.chimneys[i];
      const n = ch.big ? 5 : 3;
      for (let j = 0; j < n; j++) {
        const age =
          (((t * (ch.big ? 0.16 : 0.24) + j / n + h2(i, 90)) % 1) + 1) % 1;
        const rise = Math.round(age * (ch.big ? 15 : 8) * 2);
        const x = ch.x + Math.round(age * age * (ch.big ? 9 : 5) * 2);
        const y = ch.y - rise;
        if (age > 0.86) continue;
        const col = age < 0.5 ? smokeA : smokeB;

        // the same puffs with twice the pixels: 2 x 2, then rounder and bigger
        if (age < 0.3) drawPuff(s, x, y, 0, col);
        else if (age < 0.6 || !ch.big) drawPuff(s, x, y - 2, 1, col);
        else drawPuff(s, x - 2, y - 2, 2, col);
      }
    }
    const blade = distant(light, P.white, 0.7);
    const turn = (Math.floor(t * 3) % 4) * (Math.PI / 6);
    for (const tb of town.turbines) {
      for (let b = 0; b < 3; b++) {
        const a = turn + (b * TAU) / 3;
        s.line(
          tb.x,
          tb.y,
          tb.x + Math.round(Math.sin(a) * 3.4 * 2),
          tb.y - Math.round(Math.cos(a) * 3.4 * 2),
          blade,
        );
      }
      // the hub, the nacelle behind it
      s.rect(tb.x - 1, tb.y - 1, 2, 2, blade);
    }
    if (night && Math.floor(t * 1.1) % 2 === 0) {
      for (const b of town.beacons) s.rect(b.x, b.y, 2, 2, P.ledRed);
    }
    if (sky.birds) {
      // gulls below the camera, crossing the town
      const wing = Math.floor(t * 4) % 2;
      const gull = light.env(P.white);
      const lap = w + 160;
      for (let f = 0; f < 2; f++) {
        const bx = ((t * (5 + f * 2) * 2 + f * lap * 0.6) % lap) - 80;
        const by =
          hy +
          Math.round((0.16 + f * 0.19) * (h - hy)) +
          Math.round(6 * Math.sin(t / 4 + f));
        for (let i = 0; i < 4 + f; i++) {
          const x = Math.round(bx - (i * 6 + (i % 2) * 2) * 2);
          const y = by + ((i % 3) * 3 - i) * 2;

          drawGull(s, x, y, wing === 0, gull);
        }
      }
    }
  };

  // ---- cloud shadows --------------------------------------------------------
  const dim = new Map<number, number>();
  const dimOf = (c: number): number => {
    let o = dim.get(c);
    if (o === undefined) {
      o = shade(c as Color, -0.14);
      dim.set(c, o);
    }
    return o;
  };
  const drawCloudShadows = (s: Surface, t: number): void => {
    if (!sunny) return;
    const landH = h - hy;
    const lap = w + 520;
    for (let i = 0; i < 3; i++) {
      const rx = Math.round(Math.max(52, w * (0.11 + 0.03 * i)));
      const ry = Math.max(8, Math.round(landH * (0.05 + 0.02 * i)));
      const cx = Math.round(
        ((t * 1.6 * 2 + i * lap * 0.37 + h2(i, 70) * lap) % lap) - 260,
      );
      const cy = hy + Math.round(landH * (0.2 + 0.27 * i + 0.1 * h2(i, 71)));
      for (let y = Math.max(hy, cy - ry); y <= Math.min(h - 1, cy + ry); y++) {
        const v = (y - cy) / ry;
        const half = rx * Math.sqrt(Math.max(0, 1 - v * v));
        const x0 = Math.max(0, Math.ceil(cx - half));
        const x1 = Math.min(w - 1, Math.floor(cx + half));
        for (let x = x0; x <= x1; x++) {
          const u = (x - cx) / rx;
          const d = u * u + v * v;
          if (d > 0.55 && bayer4(x - cx + 512, y) < (d - 0.55) / 0.45) continue;
          const at = y * w + x;
          s.data[at] = dimOf(s.data[at]);
        }
      }
    }
  };

  // ---- the roar -------------------------------------------------------------
  const TAPE: readonly Color[] = [
    P.chalk,
    club.bright.base,
    raw(P.homeLight),
    P.white,
    raw(P.home),
  ];
  const BURSTS: readonly (readonly Color[])[] = [
    [club.bright.light, club.bright.base],
    [raw(P.homeLight), raw(P.home)],
    [P.white, raw(P.awayLight)],
    [club.bright.light, raw(P.homeLight)],
  ];
  const drawRoar = (s: Surface, t: number, roar: number): void => {
    if (roar <= 0) return;
    // the crowd: arms up in waves, flashbulbs
    const beat = Math.floor(t * 8);
    const data = s.data;
    const n = bowl.crowdAt.length;
    for (let i = 0; i < n; i++) {
      if (h2(i, beat) < roar * 0.42) data[bowl.crowdAt[i]] = bowl.crowdUp[i];
    }
    const flashes = Math.round(roar * 14);
    for (let i = 0; i < flashes; i++) {
      if (n === 0) break;
      const at = bowl.crowdAt[Math.floor(h2(i, beat + 50) * n)];
      data[at] = P.white;
    }
    const top = project(view, 0, OUT_B, HR);
    const foot = project(view, 0, -PITCH_V - 8, 0);
    const halfW = Math.round(OUT_A * k * 0.82);
    // the caps are on half the scale (`k1`), and the sizes twice that
    const grow = Math.min(1.3, k1 + 0.3) * 2;
    // flares in the home end: red smoke climbing
    if (roar > 0.25) {
      for (let i = 0; i < 3; i++) {
        const base = project(view, -PITCH_X - 20 - i * 4, -18 + i * 18, 5);
        for (let j = 0; j < 5; j++) {
          const age = (((t * 0.5 + j / 5 + i * 0.13) % 1) + 1) % 1;
          const r = Math.max(2, Math.round((1 + age * 4) * grow * roar));
          const x = base.x + Math.round(age * 6 * 2);
          const y = base.y - Math.round(age * 16 * grow);
          s.disc(
            x,
            y,
            r,
            age < 0.5 ? raw(P.homeLight) : raw(P.home),
            age < 0.35 ? 1 : age < 0.7 ? 0.5 : 0.25,
          );
        }
        s.rect(base.x, base.y, 2, 2, P.white);
        s.rect(base.x, base.y - 2, 2, 2, P.ledRed);
      }
    }
    // ticker tape over the bowl
    const pieces = Math.round(roar * (40 + halfW * 0.6));
    const span = Math.max(8, foot.y - top.y);
    for (let i = 0; i < pieces; i++) {
      const fall =
        (((t * (9 + h2(i, 61) * 9) * 2 + h2(i, 62) * span) % span) + span) %
        span;
      const x =
        view.cx +
        Math.round((h2(i, 63) - 0.5) * 2 * halfW + Math.sin(t * 2 + i) * 2 * 2);
      const y = top.y + Math.round(fall);
      const c = TAPE[i % TAPE.length];

      // a strip of paper turning as it falls: flat, then edge on
      if (Math.floor(t * 6 + i) % 2 === 0) s.rect(x, y, 2, 1, c);
      else s.rect(x, y, 1, 2, c);
    }
    // fireworks from the roof, over the far rim (never into the logo's sky)
    if (roar > 0.45) {
      s.pushClip(0, view.logoH, w, h);
      for (let i = 0; i < 5; i++) {
        const period = 1.5 + i * 0.13;
        const ph = (((t + i * 0.37) % period) + period) % period;
        const u = ph / period;
        const shot = Math.floor((t + i * 0.37) / period);
        const deg = 28 + ((i * 31 + shot * 47) % 124);
        const q = wallPoint((deg * Math.PI) / 180, 1.0);
        const base = project(view, q.X, q.V, HR);
        const burst = Math.min(1.25, k1 + 0.35) * 2;
        const rise = Math.round((16 + ((i * 7 + shot * 5) % 12)) * burst);
        const colors = BURSTS[mod(i + shot, BURSTS.length)];
        if (u < 0.3) {
          const y = base.y - Math.round((u / 0.3) * rise);
          s.rect(base.x, y, 1, 6, P.goldLight);
        } else {
          const e = (u - 0.3) / 0.7;
          const r = (3 + e * 9) * burst * (0.6 + 0.4 * roar);
          const cy = base.y - rise + Math.round(e * e * 4 * 2);
          const rays = 12;
          for (let a = 0; a < rays; a++) {
            const an = (a / rays) * TAU + i;
            const x = base.x + Math.round(Math.cos(an) * r);
            const y = cy + Math.round(Math.sin(an) * r * 0.9);
            if (e < 0.85 || (a + beat) % 2 === 0) s.px(x, y, colors[a % 2]);
            if (e > 0.25 && e < 0.7) {
              s.px(
                base.x + Math.round(Math.cos(an) * r * 0.55),
                cy + Math.round(Math.sin(an) * r * 0.5),
                colors[1],
              );
            }
          }
          if (e < 0.2) s.disc(base.x, cy, 2, P.white);
        }
      }
      s.popClip();
    }
    // the floodlights flare
    if (beat % 4 < 2) {
      for (const pl of town.pylons) {
        s.disc(pl.x, pl.y, Math.round((2 + roar * 5) * 2), P.white, 0.25);
        s.disc(pl.x, pl.y, Math.round((1 + roar * 3) * 2), P.white, 0.5);
      }
    }
  };

  // ---- fireworks for the goal ------------------------------------------------
  // A few small rockets go up from the roof over the far stands when the home side
  // scores, and burst in the club's colours and gold; bigger and longer by night. Each
  // goes up where its burst stays clear of the logo's sky and of the airship.
  const fwScale = Math.min(1.25, k1 + 0.35) * 2;
  const burstFor = night ? BURST_NIGHT : BURST_DAY;
  const rockets: ({ x: number; y: number; top: number; r: number } | null)[] =
    [];
  const meets = (a: Zone, b: Zone): boolean =>
    a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  for (let i = 0; i < ROCKETS; i++) {
    const r = Math.round(
      (night ? 7.5 + h2(i, 811) * 2.5 : 5.5 + h2(i, 811) * 2) * fwScale,
    );
    const full = (11 + h2(i, 812) * 7) * fwScale;
    let found: (typeof rockets)[number] = null;
    // where there is no room (a phone, the airship right over the far stands) it climbs
    // less, over the ends of the ground
    for (let tries = 0; tries < 32 && !found; tries++) {
      const rise = Math.round(tries < 16 ? full : full * 0.55);
      const deg =
        32 + ((i * 47 + tries * 29 + Math.floor(h2(i, 813) * 40)) % 116);
      const q = wallPoint((deg * Math.PI) / 180, 1.0);
      const base = project(view, q.X, q.V, HR);
      const top = base.y - rise;
      const box: Zone = {
        x: base.x - r - 2,
        y: top - r - 2,
        w: r * 2 + 6,
        h: base.y - top + r + 4,
      };
      if (box.y <= view.logoH + 2 || box.x < 2 || box.x + box.w >= w - 2) {
        continue;
      }
      if (clear.some((z) => meets(z, box))) continue;
      if (rockets.some((o) => o && Math.abs(o.x - base.x) < r + 4)) {
        continue;
      }
      found = { x: base.x, y: base.y, top, r };
    }
    rockets.push(found);
  }
  // the club's main colour and its bright one (its second, or gold when that is dark)
  const fwMain = club.spark;
  const fwBright = club.bright;
  const SPARK_A: readonly (readonly [Color, Color])[] = [
    [fwMain.light, fwBright.light],
    [fwBright.light, fwMain.light],
    [P.white, fwMain.base],
  ];
  const SPARK_B: readonly (readonly [Color, Color])[] = [
    [fwMain.base, fwBright.base],
    [fwBright.base, fwMain.base],
    [fwBright.light, fwMain.dark],
  ];
  const SPARK_C: readonly (readonly [Color, Color])[] = [
    [fwMain.dark, fwBright.dark],
    [fwBright.dark, fwMain.dark],
    [fwBright.base, P.brickDark],
  ];
  const drawFireworks = (s: Surface, t: number, roar: number): void => {
    if (roar > 0.45) return; // the roar sends up its own
    const since = mod(t, MATCH_PERIOD) - GOAL_AT;
    if (!(since >= 0 && since < FIREWORKS)) return;
    const beat = Math.floor(t * 12);
    s.pushClip(0, view.logoH, w, h);
    for (let i = 0; i < rockets.length; i++) {
      const rk = rockets[i];
      if (!rk) continue;
      const a = since - launchOf(i);
      if (a < 0) continue;
      if (a < RISE) {
        // the climb slows as it goes
        const u = a / RISE;
        const y = rk.y - Math.round(u * (2 - u) * (rk.y - rk.top));

        // a 2 x 2 spark and a thin trail behind it
        s.rect(rk.x, y, 2, 2, P.goldLight);
        s.rect(rk.x, y + 2, 1, 2, P.gold);
        if (night) s.rect(rk.x, y + 4, 1, 2, P.goldDark);
        continue;
      }
      const e = (a - RISE) / burstFor;
      if (e >= 1) continue;
      // it opens fast and hangs, drooping a little as it fades
      const grow = 1 - (1 - e) * (1 - e) * (1 - e);
      const r = rk.r * grow;
      const droop = Math.round(e * e * 3 * fwScale);
      const cy = rk.top + droop;
      const pal = i % SPARK_A.length;
      if (night && e < 0.45) {
        const glow = Math.max(1, Math.round(r * 0.9));
        s.disc(rk.x, cy, glow, P.goldLight, e < 0.2 ? 0.3 : 0.15);
      }
      if (e < 0.16) s.disc(rk.x, cy, (e < 0.08 ? 2 : 1) * 2, P.white);
      const n = night ? 12 : 10;
      for (let j = 0; j < n; j++) {
        // the last of it twinkles out
        if (e > 0.6 && (j + beat + i) % 3 === 0) continue;
        if (e > 0.8 && (j + beat) % 2 === 0) continue;
        const an = (j / n) * Math.PI * 2 + i * 0.7;
        const c = Math.cos(an);
        const sn = Math.sin(an) * 0.85;
        // by night the light tones glow; by day, against a pale sky, the strong ones
        const head = (night && e < 0.45 ? SPARK_A : SPARK_B)[pal][j % 2];
        const tail = (night ? SPARK_B : SPARK_C)[pal][j % 2];
        // a streak from the middle outwards: bright at its head
        const len = (e < 0.55 ? (night ? 3 : 2) : 1) * 2;
        for (let q = len; q >= 1; q--) {
          const d = r - (q - 1) * 1.2;
          if (d < 2) continue;
          s.px(
            rk.x + Math.round(c * d),
            cy + Math.round(sn * d),
            q === 1 ? head : tail,
          );
        }
      }
    }
    s.popClip();
  };

  // ---- lights that twinkle at night -----------------------------------------
  const drawNight = (s: Surface, t: number): void => {
    if (!night) return;
    const beat = Math.floor(t * 2);
    for (let i = 0; i < bowl.rimLamps.length; i += 3) {
      const l = bowl.rimLamps[mod(i + beat, bowl.rimLamps.length)];
      s.px(l.x, l.y, P.goldLight);
    }
    for (const pl of town.pylons) {
      if ((beat + pl.x) % 5 === 0) s.rect(pl.x + 2, pl.y, 2, 2, P.goldLight);
    }
  };

  return {
    launches: rockets.flatMap((r, i) => (r ? [launchOf(i)] : [])),
    draw(s: Surface, t: number, roar: number): void {
      // a town still being built after a change of light: one more slice of it
      advanceTown(town);
      ink.target(s);
      drawCloudShadows(s, t);
      drawMatch(s, t, roar);
      drawTrain(s, t);
      drawTraffic(s, t);
      drawRoad(t);
      drawCoach(s, t, roar);
      drawStanders(s, t, roar);
      drawQueue(s, t, roar);
      drawWalkers(s, t, roar);
      drawPark(s, t);
      drawFlags(s, t, roar);
      drawNight(s, t);
      drawAir(s, t);
      drawRoar(s, t, roar);
      drawFireworks(s, t, roar);
    },
    people(t, fn, everyone = false): void {
      for (const path of paths) {
        for (const wk of path.walkers) {
          if (walkerAt(path, wk, t, everyone)) {
            fn(wayOut.X, wayOut.V, step.waiting, wk.key);
          }
        }
      }
      pieWalkers(t, (_ago, served, X, V, waiting) =>
        fn(X, V, waiting, -1 - served),
      );
    },
    standers(fn): void {
      for (const p of standers) fn(p.X, p.V);
    },
    cars(t, fn): void {
      for (const r of routes) {
        for (const cr of r.cars) {
          const run = t * r.speed + cr.off;
          if (!carOut(cr.key, Math.floor(run / r.len))) continue;
          const d = ((run % r.len) + r.len) % r.len;
          const u = d / r.len;
          const X = r.X0 + (r.X1 - r.X0) * u;
          const V = r.V0 + (r.V1 - r.V0) * u;
          fn(X, V, groundHeading(view, X, V, r.dX, r.dV), r.dX, r.dV);
        }
      }
      roadCars(t, seed, rs, (rc) => {
        if (!roadOut(rc)) return;
        const f = rc.dir === 0 ? 1 : -1;
        fn(rc.X, rc.V, rc.dir === 0 ? EAST : WEST, f, 0);
      });
      coachAt(coachTau(t));
      const { X, V, fX, fV } = coachPose;
      fn(X, V, groundHeading(view, X, V, fX, fV), fX, fV);
    },
  };
}

export type { CarLook };
