/**
 * CLOSEST's and FURTHEST's scene: the day's place on the Earth, as a pin in the mode's colour
 * under its name, and the footballer's career round it (the product owner, 2026-11-18: the
 * pixel world map, the day's place "clearly and obviously visible"; then the career's stages
 * on it, chosen from image demos: "sure do it").
 *
 * The ground is ~/art/earth-zoom's at any scale, from the town round the place (~/art/
 * stadium-top: the home picture's town from above, the stadium in the day's colours) to the
 * whole globe among stars. A camera looks at it: where it is centred, how far out, and the
 * row of the picture its middle is on. It eases from one view to the next, panning ahead of
 * the zoom going in and behind it going out; moving, the ground is drawn in a mosaic of a
 * few pixels, and once it is still it sharpens, a band of rows a frame, then shows at once.
 *
 * - **The career's view** (`homeView`): CLOSEST's closes in on the place a step a tier
 *   (CLOSEST_ACROSS: the globe, a continent, a country, a region, the city, the
 *   neighbourhood, the ground, the pitch), the ground the footballer plays at growing beside
 *   the pin (~/art/ground-badge) until the map shows it itself, and then the final at night
 *   (flashes) and the trophy (fireworks, confetti, the cup on the centre spot). FURTHEST's
 *   pulls back from the globe a step a tier, out into space (~/art/cosmos; the product
 *   owner, 2026-11-19: "it should also start on the globe level but instead of zooming in
 *   (like closest) it should zoom out to galaxy, universe, etc."): the Earth and the Moon,
 *   the inner planets, the solar system, the nearest stars, the Milky Way, the Local Group,
 *   and the observable universe, the pin at its middle in fireworks (`spaceView` fits each
 *   in the picture). Its ground is in the badge by the pin all the way.
 *   Tiers 6 and 7 are played at night, whatever the sky, as the career's are.
 * - **The pin** stands on the day's place, pulsing, its name on a plate above it, clear of
 *   the board (`setCeiling`). CLOSEST draws target rings round it (the nearer, the better);
 *   FURTHEST round the other side of the world, a cross where the best answer would be.
 * - **An answer** is a kick from the pin to the answer's place: the camera pulls back (or
 *   goes in) to hold the pin and the landing, the landing above where the reveal's sheet
 *   comes up; the ball flies the shortest way over the globe, high in the middle, leaving a
 *   dotted trail, and lands with a burst in its shot's colour, its distance counting up.
 *   The next question brings the camera home. From space the camera dives to the Earth
 *   first and the ball waits for it; moves take longer the further they zoom (DECADE_S). A
 *   landing stays as a marker; off the picture, an arrow at its edge points the way to it
 *   (on a globe big enough to show them: DETAIL_PX).
 * - **No answer** (a pass, the clock): the pin shakes, and that is all.
 * - **A promotion**: the camera goes a step in (CLOSEST) or out (FURTHEST), and the new
 *   ground arrives in the badge.
 * - **Full time**: the career's view for the tier reached.
 *
 * It answers what the game page asks of a scene (`GameScene`, ./game-scene.ts) as the
 * career does. Pure, like every scene: time moves only in `update` (the drawing keeps what
 * it has drawn, to draw it again).
 */

import { drawMatchBall } from "~/art/characters/props";
import { type CosmosLabels, cosmosSpots, drawCosmos } from "~/art/cosmos";
import { drawSpaceLife } from "~/art/cosmos-sky";
import {
  EARTH_SAMPLES,
  drawEarthZoom,
  earthIsFlat,
  earthPoint,
} from "~/art/earth-zoom";
import { drawMapPin } from "~/art/globe";
import { BADGE_H, BADGE_W, drawGroundBadge } from "~/art/ground-badge";
import { type Lighting, lightingFor } from "~/art/lighting";
import { GRADE_COLORS, MODE_COLORS, P } from "~/art/palette";
import { clubLight, clubRaw, schemeForDay } from "~/art/stadium-club";
import { TopTones, TopTown, levelFor } from "~/art/stadium-top";
import {
  EARTH_KM,
  type GeoPoint,
  alongGreatCircle,
  antipode,
  destination,
  wrapLng,
} from "~/art/world-map";
import { tierFor } from "~/game/career";
import { distanceKm } from "~/game/geo";
import type { Grade, Mode } from "~/game/types";
import {
  type Color,
  FONT_3x5,
  FONT_5x7,
  Surface,
  clamp,
  drawText,
  easeInOutCubic,
  hash2,
  lerp,
  measureText,
} from "~/pixel";

import type { GameScene, ShotLanding } from "./game-scene";
import type { Ambience, SoundCue } from "./scene";

export interface MapSceneOptions {
  /** The day number: it seeds the town and the day's club colours. */
  seed: number;
  /** CLOSEST or FURTHEST (any other mode is drawn as CLOSEST). */
  mode: Mode;
  /** The day's place: where the distances are measured from, and its name on the pin. */
  place: GeoPoint & { name: string };
  /** A distance as the counter says it, in capitals: "1,204 MILES". */
  distance: (km: number) => string;
  /** What FURTHEST's space names (en.play.space); nothing is named without. */
  labels?: CosmosLabels;
}

/**
 * Where the pin stands, as a share of the picture's height: in the band always in view. Lower
 * where the board over the picture comes down further (`setCeiling`): the pin's name plate
 * stays CEILING_GAP pixels under it (2026-11-18: on a monitor it ran into the board), down to
 * PIN_Y_MAX at most.
 */
export const PIN_Y = 0.42;
const PIN_Y_MAX = 0.56;
const CEILING_GAP = 6;
/** The band a landing must be in to be seen while the reveal's sheet is up. */
const SEEN_TOP = 0.2;
const SEEN_BOTTOM = 0.52;
/** What a flight's view may fill below that band, while the sheet is down. */
const FLIGHT_BOTTOM = 0.86;
/** From this wide a picture, the pin and its words are drawn twice the size. */
const BIG_FROM = 600;
/** A name plate's height for `count` lines of the 5 x 7 font at `k`. */
function plateHeight(count: number, k: number): number {
  return 7 * k * count + 2 * k * (count - 1) + 6 * k;
}

/**
 * How far above the pin's point its plate reaches: the pin (8 and 5 of `k`, and a pixel),
 * the gap over its head (5) and the plate with its ink edge.
 */
function plateAbove(lines: readonly string[], k: number): number {
  return 13 * k + 1 + 5 * k + plateHeight(Math.max(1, lines.length), k) + 1;
}

/**
 * The pin's name in lines no wider than `room` pixels inside its plate, words kept whole
 * ("CAIRO INTERNATIONAL" over "STADIUM" on a phone): one line where it fits.
 */
export function plateLines(name: string, room: number, k: number): string[] {
  const width = (text: string) =>
    measureText(text, { font: FONT_5x7, scale: k });
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let line = words[0];
  for (const word of words.slice(1)) {
    const next = `${line} ${word}`;
    if (width(next) <= room) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  lines.push(line);
  return lines;
}

/** The target rings round the pin (CLOSEST) or round the other side (FURTHEST), in km. */
const RINGS_KM: readonly number[] = [500, 1500, 3000, 6000];
/** Seconds: the iris opening on the map, a flight (shortest and longest), the hold after. */
const OPEN_S = 0.8;
const FLY_MIN_S = 0.9;
const FLY_MAX_S = 1.8;
const HOLD_S = 0.55;
/** The counter's count up, after a landing. */
const COUNT_S = 0.6;
/** No answer: the pin's shake. */
const SHAKE_S = 0.7;
/** Samples along a flight's path. */
const PATH_SAMPLES = 64;

/**
 * CLOSEST's career's view, tier by tier: km across the picture (0: the whole globe). The
 * globe, a continent, a country, a region, the city, the neighbourhood, the ground, the pitch.
 */
export const CLOSEST_ACROSS: readonly number[] = [
  0, 4500, 1000, 150, 20, 2.6, 0.7, 0.34,
];
/** CLOSEST shows its ground in a badge up to this tier; past it the map shows the ground. */
const BADGE_UNTIL = 4;
/** No view closer in than this (km across), for a flight that lands close. */
const FRAME_MIN_ACROSS = 1.2;
/** The whole globe in view: its radius, as a share of the picture's shorter side. */
const GLOBE_SIZE = 0.42;
/** A landing in sight from a view no more than this many times as wide as needed: no move. */
const IN_SIGHT_WIDER = 2.5;
/** A flight's pin goes under the board only if the view is this much bigger for it. */
const UNDER_BOARD = 1.6;
/** A view of two places leaves this much room round them (a share of what it could). */
const FRAME_ROOM = 0.86;
/** Camera moves (seconds): back to the career's view; a promotion's. */
const RETURN_S = 1.0;
const PROMOTE_CAM_S = 1.3;
/** A move takes at least this long for every tenfold it zooms (from space, a long way). */
const DECADE_S = 0.1;
/**
 * A shot from space (the Earth less than 1 / DIVE_FROM of the globe's size): the camera
 * dives to the Earth first, DIVE_S at least and DIVE_DECADE_S a tenfold, and the ball waits.
 */
const DIVE_FROM = 2;
const DIVE_S = 0.7;
const DIVE_DECADE_S = 0.07;
/** The rings, the markers and the arrows to them only on a globe this many pixels round. */
const DETAIL_PX = 40;
/** A promotion: the new ground arrives after the camera, and settles. */
const UPGRADE_S = 0.8;
/** Tiers 6 and 7: the final, at night whatever the sky (as the career's). */
const FINAL_NIGHT = lightingFor({ elevation: -30, morning: false });
/** A unit of the home town's plan on the ground (km): its pitch is 136 units, a real one 105 m. */
const KM_A_UNIT = 0.105 / 136;
/** A still view is sharpened about this many samples a frame. */
const SHARPEN_SAMPLES = 40000;
/** By night this share of the town's squares, too small to see its streets, is lit. */
const TOWN_LIGHTS = 0.1;
/** Tier 7's fireworks: one bursts every this many seconds. */
const BURST_EVERY = 0.7;

/**
 * What the camera sees: the Earth turned to `lat`, `lng`, km a pixel, and the row of the
 * picture its middle is on; that middle `sx` km right and `sy` km up of the Earth's (0, 0
 * but in space, where the Earth is off to one side of what it looks at).
 */
interface View {
  lat: number;
  lng: number;
  kpp: number;
  ay: number;
  sx: number;
  sy: number;
}

interface Move {
  from: View;
  to: View;
  t: number;
  dur: number;
  /** A flight's: out fast, then settling; anything else in and out. */
  quick: boolean;
}

interface Landing {
  at: GeoPoint;
  grade: Grade;
  km: number | null;
}

interface Flight {
  path: GeoPoint[];
  t: number;
  dur: number;
  landing: Landing;
  /** After landing: seconds into the hold, or -1 while it flies. */
  held: number;
  /** Seconds before the kick (while the camera dives from space), and its power. */
  wait: number;
  power: number;
  onDone?: () => void;
}

interface Promotion {
  from: number;
  to: number;
  t: number;
  dur: number;
  /** The camera's move to the new view (seconds), after which the new ground arrives. */
  cam: number;
  arrived: boolean;
  onDone?: () => void;
}

export class MapScene implements GameScene {
  onSound: ((cue: SoundCue) => void) | null = null;

  private readonly mode: "closest" | "furthest";
  private readonly place: GeoPoint & { name: string };
  private readonly label: string;
  private readonly distance: (km: number) => string;
  private readonly seed: number;
  private readonly accent: { dark: Color; base: Color; light: Color };
  /** The rings' points, round the pin (CLOSEST) or its other side (FURTHEST). */
  private readonly rings: GeoPoint[][];
  /** Where the rings are centred. */
  private readonly ringCentre: GeoPoint;
  private readonly labels: CosmosLabels | undefined;
  /** The home town from above, built a slice a frame from the start. */
  private readonly town: TopTown;
  private tones: TopTones | null = null;

  private w = 0;
  private h = 0;
  /** How big the pin and the words are: 1, or 2 on a wide picture. */
  private k = 1;
  private light: Lighting = lightingFor({ elevation: 40, morning: true });
  private reduced = false;
  private t = 0;
  /** The career's tier as the map shows it. */
  private tier = 0;

  private cam: View;
  private move: Move | null = null;
  /**
   * The ground as last drawn still: the picture, what it shows (its view without the row:
   * `backFrame`; with the row and the light: `backKey`), the row its middle is on, and
   * whether it is sharp. The sharp copy for the view now is drawn a band at a time
   * (`sharpKey`, `sharpRow`) and takes its place when it is done.
   */
  private back: Surface | null = null;
  private backFrame = "";
  private backKey = "";
  private backAy = 0;
  private backSharp = false;
  private sharp: Surface | null = null;
  private sharpKey = "";
  private sharpRow = 0;
  /** FURTHEST's space as last drawn (`drawCosmos`), and what it shows. */
  private sky: Surface | null = null;
  private skyKey = "";

  /** The pin's row now, and the row it is going to (PIN_Y, setCeiling). */
  private pinY = 0;
  private pinWant = 0;
  /** The foot of the board over the picture (setCeiling), in its rows, or null. */
  private ceiling: number | null = null;
  /** The pin's name, in as many lines as the picture's width needs (`plateLines`). */
  private lines: string[] = [];

  private held = false;
  /**
   * Seconds the iris has been opening (OPEN_S: open). It opens by itself from the first
   * frame, as the career's arrival does, unless the page holds it first (`holdOpening`:
   * behind the mode card, or while the server is asked). A game the page carries on with
   * (coming back to it) is not held, and was left on ink before 2026-11-18.
   */
  private openT = 0;
  private flight: Flight | null = null;
  private landings: Landing[] = [];
  /** The last landing's counter: its distance and how far into counting up. */
  private counter: { landing: Landing; t: number } | null = null;
  private shakeT = -1;
  private shakeDone: (() => void) | undefined;
  private promo: Promotion | null = null;
  /** Tier 7's fireworks: the time of the last burst's sound. */
  private lastBurst = -1;

  constructor(opts: MapSceneOptions) {
    this.mode = opts.mode === "furthest" ? "furthest" : "closest";
    this.place = { ...opts.place, lng: wrapLng(opts.place.lng) };
    this.label = opts.place.name.toUpperCase();
    this.distance = opts.distance;
    this.seed = Math.round(Number.isFinite(opts.seed) ? opts.seed : 0) | 0;
    this.accent = MODE_COLORS[this.mode];
    this.ringCentre =
      this.mode === "furthest" ? antipode(this.place) : this.place;
    this.rings = RINGS_KM.map((km) => {
      const points: GeoPoint[] = [];
      for (let b = 0; b < 360; b += 3) {
        points.push(destination(this.ringCentre, b, km));
      }
      return points;
    });
    this.labels = opts.labels;
    const scheme = schemeForDay(this.seed);
    this.town = new TopTown(
      this.seed,
      clubRaw(clubLight(this.light, scheme)),
      scheme,
    );
    this.cam = {
      lat: this.place.lat,
      lng: this.place.lng,
      kpp: 1,
      ay: 0,
      sx: 0,
      sy: 0,
    };
  }

  // --- what the game page asks of a scene ------------------------------------------------

  /** The career's tier, at once: the camera on its view. */
  setTotal(total: number): void {
    this.tier = tierFor(total);
    this.move = null;
    if (this.w > 0) this.cam = this.homeView();
  }

  /** Wait on ink: only before the iris has begun to open; after that it does nothing. */
  holdOpening(): void {
    if (this.openT === 0) this.held = true;
  }

  beginOpening(): void {
    this.held = false;
    if (this.reduced) this.openT = OPEN_S;
  }

  get waiting(): boolean {
    return this.held;
  }

  /** A new question: the camera comes home, and the last counter goes. */
  ask(): void {
    this.counter = null;
    this.goTo(this.homeView(), RETURN_S, false);
  }

  playShot(
    shot: Grade,
    onDone?: () => void,
    landing?: ShotLanding | null,
  ): void {
    // held behind the mode card: open at once (the game is already under way)
    if (this.held) this.openT = OPEN_S;
    this.held = false;
    this.finishFlight();
    this.finishPromotion();
    if (!landing || shot === "timeup" || shot === "skipped") {
      // no ball: the pin shakes its head
      if (shot === "timeup") this.sound({ kind: "whistle" });
      this.shakeT = this.reduced ? SHAKE_S : 0;
      this.shakeDone = onDone;
      if (this.reduced) this.endShake();
      return;
    }
    const to: GeoPoint = { lat: landing.lat, lng: wrapLng(landing.lng) };
    const path: GeoPoint[] = [];
    for (let i = 0; i <= PATH_SAMPLES; i++) {
      path.push(alongGreatCircle(this.place, to, i / PATH_SAMPLES));
    }
    const km = landing.km;
    const far = clamp((km ?? 0) / 20000);
    const flight: Flight = {
      path,
      t: 0,
      dur: FLY_MIN_S + (FLY_MAX_S - FLY_MIN_S) * Math.sqrt(far),
      landing: { at: to, grade: shot, km },
      held: -1,
      wait: 0,
      power: 0.4 + 0.6 * far,
      onDone,
    };
    this.flight = flight;
    this.counter = null;
    // the camera goes only if it must: to a landing out of sight (or above the sheet's
    // edge), or to one far too small to see from here; from space it dives in first
    const view = this.frameView(this.place, to, true);
    if (!this.inSight(to, view)) {
      if (this.cam.kpp > this.globeKpp() * DIVE_FROM && !this.reduced) {
        const decades = Math.abs(Math.log10(this.cam.kpp / view.kpp));
        flight.wait = this.goTo(
          view,
          Math.max(DIVE_S, decades * DIVE_DECADE_S),
          false,
          false,
        );
      } else this.goTo(view, flight.dur * 0.85, true);
    }
    if (flight.wait <= 0) this.sound({ kind: "kick", power: flight.power });
    if (this.reduced) {
      flight.t = flight.dur;
      this.land(flight);
    }
  }

  promote(total: number, onDone?: () => void): void {
    // held behind the mode card: open at once (the game is already under way)
    if (this.held) this.openT = OPEN_S;
    this.held = false;
    this.finishFlight();
    this.finishPromotion();
    this.counter = null;
    const from = this.tier;
    const to = Math.max(from, tierFor(total));
    this.tier = to;
    const cam = this.goTo(this.homeView(), PROMOTE_CAM_S, false);
    this.promo = {
      from,
      to,
      t: 0,
      cam,
      dur: cam + UPGRADE_S,
      arrived: false,
      onDone,
    };
    this.sound({ kind: "sweep" });
    if (this.reduced) this.finishPromotion();
  }

  showFullTime(total: number): void {
    // held behind the mode card: open at once (the game is already under way)
    if (this.held) this.openT = OPEN_S;
    this.held = false;
    this.finishFlight();
    this.finishPromotion();
    this.endShake();
    this.counter = null;
    this.tier = Math.max(this.tier, tierFor(total));
    this.goTo(this.homeView(), RETURN_S, false);
  }

  // --- the scene ---------------------------------------------------------------------------

  resize(w: number, h: number): void {
    const W = Math.max(1, Math.round(w));
    const H = Math.max(1, Math.round(h));
    if (W === this.w && H === this.h) return;
    this.w = W;
    this.h = H;
    this.k = W >= BIG_FROM ? 2 : 1;
    this.lines = plateLines(this.label, W - 8 * this.k, this.k);
    this.pinWant = this.pinRow();
    this.pinY = this.pinWant;
    this.back = null;
    this.sharp = null;
    this.backKey = "";
    this.move = null;
    this.cam = this.homeView();
  }

  /**
   * The board over the picture ends at row `y` (the game page measures it as it is laid
   * out, at its tallest: a question's, not a reveal's). The pin comes down, if it must, so
   * that its name plate is clear of it; null puts it back where PIN_Y has it.
   */
  setCeiling(y: number | null): void {
    this.ceiling = y === null || !Number.isFinite(y) ? null : Math.round(y);
    this.pinWant = this.pinRow();
    if (this.reduced || this.w === 0) this.pinY = this.pinWant;
    // a still view of two places, or of space, is framed again under the new board
    if (this.w > 0 && !this.move && !this.flight && !this.promo) {
      if (!this.onPlace(this.cam)) this.cam = this.homeView();
      else if (this.cam.sx !== 0 || this.cam.sy !== 0) {
        this.cam = { ...this.homeView(), ay: this.cam.ay };
      }
      if (this.reduced && this.onPlace(this.cam)) {
        this.cam = { ...this.cam, ay: this.pinY };
      }
    }
  }

  /** The pin's row: PIN_Y, or its name plate's height under the ceiling. */
  private pinRow(): number {
    const base = this.h * PIN_Y;
    if (this.ceiling === null) return base;
    const k = this.k;
    const below = this.ceiling + CEILING_GAP * k + plateAbove(this.lines, k);
    return Math.round(Math.min(this.h * PIN_Y_MAX, Math.max(base, below)));
  }

  setLighting(light: Lighting): void {
    this.light = light;
  }

  setReducedMotion(on: boolean): void {
    this.reduced = on;
  }

  ambience(): Ambience {
    return {
      venue: "town",
      crowd: 0.15,
      night: this.viewLight().phase === "night",
    };
  }

  update(dt: number): void {
    const d = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.25) : 0;
    this.t += d;
    // the town from above, a slice a frame until it is built
    if (!this.town.done) this.town.step();
    if (this.reduced && !this.held) this.openT = OPEN_S;
    if (!this.held && this.openT < OPEN_S) this.openT += d;
    // the pin's row eases to where it is wanted; a camera on it follows
    const k = this.reduced ? 1 : 1 - Math.exp(-4 * d);
    this.pinY += (this.pinWant - this.pinY) * k;
    if (Math.abs(this.pinWant - this.pinY) < 0.5) this.pinY = this.pinWant;
    if (!this.move && this.onPlace(this.cam) && this.cam.ay !== this.pinY) {
      this.cam = { ...this.cam, ay: this.pinY };
    }
    const m = this.move;
    if (m) {
      m.t += d;
      const u = clamp(m.t / m.dur);
      const e = m.quick ? 1 - (1 - u) ** 3 : easeInOutCubic(u);
      this.cam = between(m.from, m.to, e);
      if (u >= 1) {
        this.cam = m.to;
        this.move = null;
      }
    }
    const f = this.flight;
    if (f) {
      if (f.held < 0 && f.wait > 0) {
        // waiting for the camera to dive in from space, then the kick
        f.wait -= d;
        if (f.wait <= 0) this.sound({ kind: "kick", power: f.power });
      } else if (f.held < 0) {
        f.t += d;
        if (f.t >= f.dur) this.land(f);
      } else {
        f.held += d;
        if (f.held >= HOLD_S) {
          this.flight = null;
          f.onDone?.();
        }
      }
    }
    if (this.counter) this.counter.t += d;
    if (this.shakeT >= 0) {
      this.shakeT += d;
      if (this.shakeT >= SHAKE_S) this.endShake();
    }
    const p = this.promo;
    if (p) {
      p.t += d;
      if (!p.arrived && p.t >= p.cam) {
        p.arrived = true;
        this.sound({ kind: "cheer", size: 0.6 });
      }
      // out into space: the wind of it
      if (this.mode === "furthest" && !p.arrived) {
        this.sound({ kind: "wind", speed: 0.25 });
      }
      if (p.t >= p.dur) this.finishPromotion();
    }
    // tier 7: fireworks over the cup
    if (this.tier === 7 && !this.reduced && !this.held) {
      const burst = Math.floor(this.t / BURST_EVERY);
      if (burst !== this.lastBurst) {
        this.lastBurst = burst;
        this.sound({ kind: "firework", distant: burst % 3 !== 0 });
      }
    }
  }

  draw(s: Surface): void {
    if (this.w !== s.w || this.h !== s.h) this.resize(s.w, s.h);
    if (this.held) {
      s.clear(P.ink);
      return;
    }
    this.drawBack(s);
    if (this.mode === "furthest") this.drawSpaceLife(s);
    // the rings and the landings only on a globe big enough to show them
    const detail = EARTH_KM / this.cam.kpp >= DETAIL_PX;
    if (detail) {
      this.drawRings(s);
      for (const landing of this.landings) this.drawMarker(s, landing);
    }
    if (this.mode === "closest") this.drawGround(s);
    this.drawPin(s);
    this.drawCareerBadge(s);
    if (this.flight) this.drawFlight(s, this.flight);
    if (this.counter) this.drawCounter(s, this.counter.landing, this.counter.t);
    if (this.tier === 7) this.drawFireworks(s);
    if (detail) this.drawPointers(s);
    if (this.openT < OPEN_S) this.drawIris(s, this.openT / OPEN_S);
  }

  // --- the camera ----------------------------------------------------------------------------

  /** The career's view for the tier it is on. */
  private homeView(): View {
    const w = this.w;
    const h = this.h;
    const ay = this.pinWant || h * PIN_Y;
    const { lat, lng } = this.place;
    if (this.mode === "furthest" && this.tier > 0) {
      return this.spaceView(this.tier, ay);
    }
    const across = this.mode === "closest" ? CLOSEST_ACROSS[this.tier] : 0;
    if (across > 0) return { lat, lng, kpp: across / w, ay, sx: 0, sy: 0 };
    // the whole globe, the place in its middle
    return { lat, lng, kpp: this.globeKpp(), ay, sx: 0, sy: 0 };
  }

  /** Km a pixel with the whole globe in view (GLOBE_SIZE). */
  private globeKpp(): number {
    return EARTH_KM / Math.max(1, Math.min(this.w, this.h) * GLOBE_SIZE);
  }

  /**
   * FURTHEST's view of space at `tier` (1 to 7): as close as holds the Earth and what the
   * tier shows (~/art/cosmos `cosmosSpots`) under the board and over the answer bar, the
   * Earth on the pin's row if it can be (lower if it must) with room by it for the pin's
   * plate and badge, and the whole in the middle across.
   */
  private spaceView(tier: number, ay: number): View {
    const w = this.w;
    const h = this.h;
    const k = this.k;
    const band = Math.max(h * SEEN_TOP, this.ceiling ?? 0) + 12 * k;
    const low = Math.max(band + 20 * k, h * FLIGHT_BOTTOM - 8 * k);
    const margin = Math.max(16, w * 0.08);
    const pin = this.pinRoom();
    const xs: Range[] = [
      {
        v: 0,
        lo: Math.max(margin, pin.left),
        hi: w - Math.max(margin, pin.right),
      },
    ];
    const ys: Range[] = [{ v: 0, lo: ay, hi: low }];
    for (const p of cosmosSpots(tier)) {
      xs.push({ v: p.x, lo: margin, hi: w - margin });
      ys.push({ v: -p.y, lo: band, hi: low });
    }
    const s = Math.min(mostScale(xs), mostScale(ys)) * FRAME_ROOM;
    const across = offsets(xs, s);
    const down = offsets(ys, s);
    const ex = (across.lo + across.hi) / 2;
    const ey = clamp(ay, down.lo, Math.max(down.lo, down.hi));
    const kpp = 1 / s;
    return {
      lat: this.place.lat,
      lng: this.place.lng,
      kpp,
      ay,
      sx: (w / 2 - ex) * kpp,
      sy: (ey - ay) * kpp,
    };
  }

  /** The room the pin's plate needs left of its point, and its plate or badge right of it. */
  private pinRoom(): { left: number; right: number } {
    const k = this.k;
    const tw = Math.max(
      0,
      ...this.lines.map((line) =>
        measureText(line, { font: FONT_5x7, scale: k }),
      ),
    );
    const half = (tw + 8 * k) / 2 + 2;
    return { left: half, right: Math.max(half, 8 * k + BADGE_W * k + 2) };
  }

  /** Whether a view is centred on the day's place (and its middle on the pin's row). */
  private onPlace(v: View): boolean {
    return (
      Math.abs(v.lat - this.place.lat) < 1e-9 &&
      Math.abs(wrapLng(v.lng - this.place.lng)) < 1e-9
    );
  }

  /**
   * A view holding `a` and `b`, half way between them: `b` above where the reveal's sheet
   * comes up (`flight`) or anywhere clear of the board.
   */
  private frameView(a: GeoPoint, b: GeoPoint, flight: boolean): View {
    const w = this.w;
    const h = this.h;
    const k = this.k;
    const band = Math.max(h * SEEN_TOP, this.ceiling ?? 0) + 12 * k;
    const low = h * FLIGHT_BOTTOM - 8 * k;
    const seenBottom = Math.max(h * SEEN_BOTTOM, band + 30 * k);
    const half = w / 2 - Math.max(16, w * 0.08);
    const mid = alongGreatCircle(a, b, 0.5);
    const us = [unit(mid, a), unit(mid, b)];
    const most = EARTH_KM / (FRAME_MIN_ACROSS / w);
    const least = Math.min(w, h) * 0.12;
    type Rows = readonly { lo: number; hi: number }[];
    /** The rows the view's middle may be on for radius r, each in its rows, or null. */
    const fits = (r: number, rows: Rows): { lo: number; hi: number } | null => {
      let lo = -Infinity;
      let hi = Infinity;
      for (let i = 0; i < 2; i++) {
        if (Math.abs(us[i].x) * r > half) return null;
        // a point at row ay - r * u.y must be within its rows
        lo = Math.max(lo, rows[i].lo + r * us[i].y);
        hi = Math.min(hi, rows[i].hi + r * us[i].y);
      }
      return lo <= hi ? { lo, hi } : null;
    };
    /** The biggest radius that fits, found by halving (in proportion: scales are far apart). */
    const biggest = (rows: Rows): number => {
      let lo = Math.log(least);
      let hi = Math.log(most);
      if (!fits(least, rows)) return least;
      for (let i = 0; i < 40 && hi - lo > 1e-4; i++) {
        const m = (lo + hi) / 2;
        if (fits(Math.exp(m), rows)) lo = m;
        else hi = m;
      }
      return Math.exp(lo);
    };
    // the rows each may be on: both clear of the board, a flight's landing above the sheet;
    // a flight's pin may go under the board (it names the place) if that much bigger
    const clear: Rows = flight
      ? [
          { lo: band, hi: low },
          { lo: band, hi: seenBottom },
        ]
      : [
          { lo: band, hi: low },
          { lo: band, hi: low },
        ];
    let rows = clear;
    let r = biggest(clear);
    if (flight) {
      const free: Rows = [
        { lo: 6 * k, hi: low },
        { lo: band, hi: seenBottom },
      ];
      const big = biggest(free);
      if (big > r * UNDER_BOARD) {
        rows = free;
        r = big;
      }
    }
    r *= FRAME_ROOM;
    const span = fits(r, rows) ?? {
      lo: (band + low) / 2,
      hi: (band + low) / 2,
    };
    const ay = (span.lo + span.hi) / 2;
    return {
      lat: mid.lat,
      lng: mid.lng,
      kpp: EARTH_KM / r,
      ay,
      sx: 0,
      sy: 0,
    };
  }

  /**
   * The camera to `to`, in `dur` seconds or DECADE_S a tenfold it zooms if that is longer
   * (`scaled`): from space, a long way. Returns how long it takes (0: there at once).
   */
  private goTo(to: View, dur: number, quick: boolean, scaled = true): number {
    if (this.w === 0) return 0;
    // already there (a new question with the camera at home): no move, so no mosaic
    if (this.reduced || dur <= 0 || this.sameView(this.cam, to)) {
      this.move = null;
      this.cam = to;
      return 0;
    }
    const decades = Math.abs(Math.log10(to.kpp / this.cam.kpp));
    const time = scaled ? Math.max(dur, decades * DECADE_S) : dur;
    this.move = { from: this.cam, to, t: 0, dur: time, quick };
    return time;
  }

  /**
   * Whether a landing is in sight from where the camera is: on the picture, above where the
   * reveal's sheet comes up, clear of the board, and the view no more than IN_SIGHT_WIDER
   * times as wide as `view` (the one that would hold it).
   */
  private inSight(p: GeoPoint, view: View): boolean {
    if (this.move || this.cam.kpp > view.kpp * IN_SIGHT_WIDER) return false;
    const k = this.k;
    const q = this.project(p);
    const top = Math.max(this.h * SEEN_TOP, this.ceiling ?? 0) + 12 * k;
    const bottom = Math.max(this.h * SEEN_BOTTOM, top + 30 * k);
    const margin = Math.max(16, this.w * 0.08);
    return (
      q.seen &&
      q.x >= margin &&
      q.x <= this.w - margin &&
      q.y >= top &&
      q.y <= bottom
    );
  }

  /** Whether two views show the same ground, to within half a pixel. */
  private sameView(a: View, b: View): boolean {
    if (Math.abs(Math.log(a.kpp / b.kpp)) > 1e-4) return false;
    if (Math.abs(a.ay - b.ay) > 0.5) return false;
    if (Math.abs(a.sx - b.sx) / a.kpp > 0.5) return false;
    if (Math.abs(a.sy - b.sy) / a.kpp > 0.5) return false;
    return distanceKm(a, b) / a.kpp < 0.5;
  }

  /** The light the map is seen in: the sky's, or the final's night. */
  private viewLight(): Lighting {
    return this.tier >= 6 ? FINAL_NIGHT : this.light;
  }

  /** Where the Earth's middle is on the picture, from `v`. */
  private earthAt(v: View): { x: number; y: number } {
    return {
      x: Math.round(this.w / 2 - v.sx / v.kpp),
      y: Math.round(v.ay + v.sy / v.kpp),
    };
  }

  /** Where a place is on the picture, as the camera sees it now. */
  private project(p: GeoPoint): { x: number; y: number; seen: boolean } {
    const r = EARTH_KM / this.cam.kpp;
    const e = this.earthAt(this.cam);
    return earthPoint(e.x, e.y, r, this.cam, p, this.w, this.h);
  }

  // --- moves -------------------------------------------------------------------------------

  private sound(cue: SoundCue): void {
    this.onSound?.(cue);
  }

  private land(f: Flight): void {
    if (f.held >= 0) return;
    f.held = 0;
    this.landings.push(f.landing);
    this.counter = { landing: f.landing, t: this.reduced ? COUNT_S : 0 };
    this.sound({ kind: "land", power: 0.7 });
    const grade = f.landing.grade;
    if (grade !== "timeup" && grade !== "skipped") {
      this.sound({ kind: "score", shot: grade });
    }
  }

  /** A flight still going ends where it was going, at once. */
  private finishFlight(): void {
    const f = this.flight;
    if (!f) return;
    this.flight = null;
    if (f.held < 0) {
      f.t = f.dur;
      this.land(f);
    }
    f.onDone?.();
  }

  /** A promotion still playing ends, the camera on its new view. */
  private finishPromotion(): void {
    const p = this.promo;
    if (!p) return;
    this.promo = null;
    if (this.w > 0) {
      this.move = null;
      this.cam = this.homeView();
    }
    p.onDone?.();
  }

  private endShake(): void {
    this.shakeT = -1;
    const done = this.shakeDone;
    this.shakeDone = undefined;
    done?.();
  }

  // --- drawing -------------------------------------------------------------------------------

  /**
   * The ground under the camera. Moving, it is drawn in a mosaic of a few pixels. Still, it
   * is drawn sharp a band of rows a frame and shown when it is done; meanwhile what was shown
   * stays, moved to the row the camera's middle is on now, if the camera has not been
   * anywhere since (the pin easing under the board, the sky's light changing, the town from
   * above built), else the mosaic, at once. So the map is blurred only while it moves, and
   * for the moment after it while it comes into focus.
   */
  private drawBack(s: Surface): void {
    const w = this.w;
    const h = this.h;
    const cam = this.cam;
    const light = this.viewLight();
    // the mosaic: as fine as keeps to EARTH_SAMPLES over the ground there is
    const r = EARTH_KM / cam.kpp;
    const area = earthIsFlat(r, w, h) ? w * h : Math.min(w * h, 4 * r * r);
    const coarse = Math.max(1, Math.ceil(Math.sqrt(area / EARTH_SAMPLES)));
    if (this.move) {
      this.paint(s, coarse, null);
      return;
    }
    const frame = `${w}x${h}|${cam.lat}|${cam.lng}|${cam.kpp}|${cam.sx}|${cam.sy}`;
    const ay = Math.round(cam.ay);
    const key = `${frame}|${ay}|${light.phase}|${light.sun.elevation}|${this.town.done}`;
    if (
      !this.back ||
      this.back.w !== w ||
      this.back.h !== h ||
      this.backFrame !== frame
    ) {
      // somewhere new: the mosaic at once, sharpened from here
      this.back = new Surface(w, h);
      this.paint(this.back, coarse, null);
      this.backFrame = frame;
      this.backKey = key;
      this.backAy = ay;
      this.backSharp = coarse === 1;
    }
    // sharpened once the pin has come to rest: in space, while it slides, the whole sky would
    // be worked out again for every row it moves
    const sliding = this.pinY !== this.pinWant && this.inSpace();
    if (!sliding && (this.backKey !== key || !this.backSharp)) {
      if (
        this.sharpKey !== key ||
        !this.sharp ||
        this.sharp.w !== w ||
        this.sharp.h !== h
      ) {
        this.sharp = new Surface(w, h);
        this.sharpKey = key;
        this.sharpRow = 0;
      }
      const band = Math.max(4, Math.floor(SHARPEN_SAMPLES / w));
      const to = Math.min(h, this.sharpRow + band);
      this.paint(this.sharp, 1, { from: this.sharpRow, to });
      this.sharpRow = to;
      if (to >= h) {
        const done = this.sharp;
        this.sharp = this.back;
        this.back = done;
        this.backKey = key;
        this.backAy = ay;
        this.backSharp = true;
        this.sharpKey = "";
      }
    }
    // what there is, on the row the camera's middle is on now
    const dy = ay - this.backAy;
    if (dy === 0) {
      s.copy(this.back);
      return;
    }
    s.copy(this.back, 0, dy);
    // the rows it uncovers, in the mosaic (a strip, for a moment)
    const rows = dy > 0 ? { from: 0, to: dy } : { from: h + dy, to: h };
    // (sliding: worked out more coarsely; once at rest, the sky being sharpened is used)
    this.paint(s, coarse, rows, sliding);
  }

  /** The ground for the camera now, in squares of `block` pixels, these rows or all. */
  private paint(
    s: Surface,
    block: number,
    rows: { from: number; to: number } | null,
    strip = false,
  ): void {
    const cam = this.cam;
    const light = this.viewLight();
    const r = EARTH_KM / cam.kpp;
    const e = this.earthAt(cam);
    // FURTHEST's space round a globe that does not fill the picture
    const space = this.inSpace();
    if (space) {
      // its glows in squares of two at least while the camera moves, and in a strip the
      // picture uncovers sliding (cheaper: both are gone in a moment)
      const sky = this.skyFor(
        e,
        cam.kpp,
        this.move || strip ? Math.max(block, 2) : block,
      );
      if (rows) {
        const w = this.w;
        s.data.set(
          sky.data.subarray(rows.from * w, rows.to * w),
          rows.from * w,
        );
      } else s.copy(sky);
      // smaller than that, the Earth is space's own blue dot
      if (r < 1.5) return;
    }
    const town = this.town.done ? this.town : null;
    let near: ((east: number, north: number) => Color | undefined) | undefined;
    let suburb:
      ((east: number, north: number) => Color | undefined) | undefined;
    if (town) {
      if (!this.tones || this.tones.light !== light) {
        this.tones = new TopTones(town, light);
      }
      const tones = this.tones;
      const level = levelFor(block / (KM_A_UNIT / cam.kpp));
      const lights = light.lightsOn && level >= 2;
      const cell = (1 << level) * 2;
      const seed = this.seed;
      const lit = (X: number, V: number, c: Color): Color => {
        if (!lights) return c;
        const hl = hash2(Math.floor(X / cell), Math.floor(V / cell), seed + 83);
        return hl < TOWN_LIGHTS / 3
          ? P.amber
          : hl < TOWN_LIGHTS
            ? P.amberDim
            : c;
      };
      near = (east, north) => {
        const X = east / KM_A_UNIT;
        const V = north / KM_A_UNIT;
        const idx = town.at(X, V, level);
        return idx < 0 ? undefined : lit(X, V, tones.color(idx));
      };
      suburb = (east, north) => {
        const X = east / KM_A_UNIT;
        const V = north / KM_A_UNIT;
        const idx = town.suburbAt(X, V, level);
        return idx < 0 ? undefined : lit(X, V, tones.color(idx));
      };
    }
    drawEarthZoom(s, e.x, e.y, r, cam, {
      place: this.place,
      seed: this.seed,
      light,
      block,
      ...(near && { near }),
      ...(suburb && { town: suburb }),
      ...(rows && { rows }),
      ...(space && { space: false }),
    });
  }

  /** Whether the camera sees FURTHEST's space: round a globe that does not fill the picture. */
  private inSpace(): boolean {
    const r = EARTH_KM / this.cam.kpp;
    return (
      this.mode === "furthest" &&
      !earthIsFlat(r, this.w, this.h) &&
      r < Math.hypot(this.w, this.h)
    );
  }

  /**
   * FURTHEST's space with the Earth's middle at `e`, `kpp` km a pixel, its glows in
   * squares of `block`: drawn again only when that changes. Its names keep clear of the
   * pin's plate and badge.
   */
  private skyFor(
    e: { x: number; y: number },
    kpp: number,
    block: number,
  ): Surface {
    const w = this.w;
    const h = this.h;
    const key = `${w}x${h}|${e.x}|${e.y}|${kpp}|${block}`;
    if (this.sky && this.skyKey === key) return this.sky;
    if (!this.sky || this.sky.w !== w || this.sky.h !== h) {
      this.sky = new Surface(w, h);
    }
    const k = this.k;
    const pin = this.pinRoom();
    const top = e.y - plateAbove(this.lines, k);
    drawCosmos(this.sky, {
      ex: e.x,
      ey: e.y,
      kpp,
      k,
      seed: this.seed,
      block,
      ...(this.labels && { labels: this.labels }),
      keep: {
        x: e.x - pin.left,
        y: top,
        w: pin.left + pin.right,
        // the badge goes under the plate, beside the pin's point
        h: e.y + 2 + BADGE_H * k + 2 * k - top,
      },
    });
    this.skyKey = key;
    return this.sky;
  }

  /**
   * FURTHEST's space, alive over its backdrop: stars twinkling and shooting, satellites
   * going round the Earth (~/art/cosmos-sky).
   */
  private drawSpaceLife(s: Surface): void {
    const cam = this.cam;
    const r = EARTH_KM / cam.kpp;
    if (earthIsFlat(r, this.w, this.h) || r >= Math.hypot(this.w, this.h)) {
      return;
    }
    const e = this.earthAt(cam);
    drawSpaceLife(s, {
      ex: e.x,
      ey: e.y,
      kpp: cam.kpp,
      k: this.k,
      seed: this.seed,
      t: this.t,
      reduced: this.reduced,
    });
  }

  private drawRings(s: Surface): void {
    const colours = [
      this.accent.light,
      this.accent.base,
      this.accent.dark,
      this.accent.dark,
    ];
    this.rings.forEach((ring, i) => {
      const c = colours[i] ?? this.accent.dark;
      ring.forEach((p, j) => {
        if ((j + i) % 2 === 1) return;
        const q = this.project(p);
        if (q.seen) s.px(Math.round(q.x), Math.round(q.y), c);
      });
    });
    if (this.mode === "furthest") {
      // the other side of the world: a cross where the best answer of all would be
      const q = this.project(this.ringCentre);
      if (!q.seen) return;
      const cx = Math.round(q.x);
      const cy = Math.round(q.y);
      for (let d = -3; d <= 3; d++) {
        s.px(cx + d, cy + d, this.accent.light);
        s.px(cx + d, cy - d, this.accent.light);
      }
    }
  }

  /** The pin's name plate on the picture, as last drawn: kept clear by the counter. */
  private plate = { x: 0, y: 0, w: 0, h: 0 };

  private drawPin(s: Surface): void {
    const k = this.k;
    const q = this.project(this.place);
    if (
      !q.seen ||
      q.x < -8 ||
      q.x > this.w + 8 ||
      q.y < -8 ||
      q.y > this.h + 40
    ) {
      this.plate = { x: 0, y: 0, w: 0, h: 0 };
      return;
    }
    let cx = Math.round(q.x);
    const cy = Math.round(q.y);
    if (this.shakeT >= 0) {
      const u = this.shakeT / SHAKE_S;
      cx += Math.round(Math.sin(u * Math.PI * 6) * 3 * k * (1 - u));
    }
    const p = this.promo;
    const gold = p !== null;
    const base = gold ? P.gold : this.accent.base;
    const light = gold ? P.goldLight : this.accent.light;
    // the pulse round its point
    const beat = (this.t % 1.6) / 1.6;
    if (!this.reduced && beat < 0.8) {
      dottedCircle(s, cx, cy, Math.round((4 + beat * 12) * k), light, 2);
    }
    // its point, its head, the shine (as the home screen's CLOSEST drops it: ~/art/globe)
    const top = drawMapPin(s, cx, cy, k, base, light);
    // its name on a plate above it, in a line or more, and inside the picture
    const lines = this.lines;
    const tw = Math.max(
      ...lines.map((line) => measureText(line, { font: FONT_5x7, scale: k })),
    );
    const pw = tw + 8 * k;
    const ph = plateHeight(lines.length, k);
    const px = clamp(Math.round(cx - pw / 2), 1, Math.max(1, this.w - pw - 1));
    const py = top - 5 * k - ph;
    s.rect(px - 1, py - 1, pw + 2, ph + 2, P.ink);
    s.rect(px, py, pw, ph, base);
    s.rect(px + k, py + k, pw - 2 * k, ph - 2 * k, P.ink);
    lines.forEach((line, i) => {
      drawText(
        s,
        line,
        px + Math.round(pw / 2),
        py + 3 * k + i * 9 * k,
        P.chalk,
        {
          font: FONT_5x7,
          align: "center",
          scale: k,
        },
      );
    });
    this.plate = {
      x: px - 1,
      y: py - 1,
      w: pw + 2,
      h: py + ph + 1 > cy ? cy - py : ph + 2 + (cy - (py + ph)),
    };
  }

  /** The badge's colours: the mode's. */
  private badgeColors(): {
    frame: Color;
    dark: Color;
    base: Color;
    light: Color;
  } {
    return {
      frame: this.accent.base,
      dark: this.accent.dark,
      base: this.accent.base,
      light: this.accent.light,
    };
  }

  /**
   * The ground at `tier` in its badge beside the point (x, y) (a pin's), clear of the day's
   * pin's plate and of the board; a burst round it as it arrives (`fresh` 0 to 1).
   * Returns its box.
   */
  private drawBadge(
    s: Surface,
    x: number,
    y: number,
    tier: number,
    fresh: number,
  ): { x: number; y: number; w: number; h: number } {
    const k = this.k;
    const bw = BADGE_W * k;
    const bh = BADGE_H * k;
    let bx = x + 8 * k;
    if (bx + bw > this.w - 2) bx = x - 8 * k - bw;
    bx = clamp(bx, 2, Math.max(2, this.w - bw - 2));
    let by = y - Math.round(bh * 0.8);
    const p = this.plate;
    const overPlate =
      p.w > 0 &&
      bx < p.x + p.w &&
      bx + bw > p.x &&
      by < p.y + p.h &&
      by + bh > p.y;
    if (overPlate) by = p.y + p.h + 2;
    by = clamp(by, (this.ceiling ?? 0) + 2, Math.max(2, this.h - bh - 2));
    // a tail to the place
    const tx = bx + bw / 2 < x ? bx + bw : bx;
    s.line(
      Math.round(tx),
      Math.round(by + bh / 2),
      Math.round(x),
      Math.round(y) - 6 * k,
      P.ink,
    );
    drawGroundBadge(
      s,
      Math.round(bx),
      Math.round(by),
      tier,
      k,
      this.badgeColors(),
    );
    if (fresh > 0 && fresh < 1 && !this.reduced) {
      const r = Math.round((bw / 2 + 4 * k) * (0.6 + fresh * 0.8));
      dottedCircle(
        s,
        Math.round(bx + bw / 2),
        Math.round(by + bh / 2),
        r,
        P.goldLight,
        2,
      );
    }
    return { x: bx, y: by, w: bw, h: bh };
  }

  /**
   * The ground in its badge by the pin: CLOSEST's while the map is too far out to show it,
   * FURTHEST's all the way. A promotion's arrives once the camera is there.
   */
  private drawCareerBadge(s: Surface): void {
    const p = this.promo;
    const shown = p && p.t < p.cam ? p.from : this.tier;
    if (this.mode === "closest" && shown > BADGE_UNTIL) return;
    const q = this.project(this.place);
    if (!q.seen) return;
    const fresh = p && p.t >= p.cam ? (p.t - p.cam) / UPGRADE_S : 0;
    this.drawBadge(s, q.x, q.y, shown, fresh);
  }

  /**
   * CLOSEST from the neighbourhood in: the ground itself, dressed for the tier. Flags in the
   * streets for the international game; flashes in the crowd at the final; at the trophy the
   * cup on the centre spot (the fireworks come later, over everything).
   */
  private drawGround(s: Surface): void {
    const tier = this.tier;
    if (tier < 5) return;
    const q = this.project(this.place);
    if (!q.seen) return;
    const u = KM_A_UNIT / this.cam.kpp;
    const k = this.k;
    if (tier === 5) {
      for (let i = 0; i < 80; i++) {
        const a = hash2(i, 1, this.seed) * Math.PI * 2;
        const d = 170 + hash2(i, 2, this.seed) * 330;
        const x = Math.round(q.x + Math.cos(a) * d * u);
        const y = Math.round(q.y - Math.sin(a) * d * u);
        const wave = Math.floor(this.t * 4 + i) % 2;
        s.rect(x, y, k, 4 * k, P.ink);
        s.rect(x + k, y + wave * k, 3 * k, 2 * k, i % 2 ? P.home : P.white);
      }
      return;
    }
    // the final and the trophy: flashes in the crowd
    const frame = Math.floor(this.t * 10);
    for (let i = 0; i < 70; i++) {
      if (hash2(i, frame, this.seed) > 0.35) continue;
      const a = hash2(i, 1, this.seed + 1) * Math.PI * 2;
      const f = 1.03 + hash2(i, 2, this.seed + 1) * 0.22;
      s.px(
        Math.round(q.x + Math.cos(a) * 82 * f * u),
        Math.round(q.y - Math.sin(a) * 57 * f * u),
        P.white,
      );
    }
    if (tier === 7) {
      // the cup on the centre spot
      const x = Math.round(q.x);
      const y = Math.round(q.y);
      s.rect(x - 3 * k, y - 6 * k, 7 * k, 6 * k, P.ink);
      s.rect(x - 2 * k, y - 5 * k, 5 * k, 3 * k, P.gold);
      s.rect(x, y - 2 * k, k, 2 * k, P.goldDark);
      s.rect(x - k, y, 3 * k, k, P.goldDark);
      s.px(x - k, y - 5 * k, P.goldLight);
    }
  }

  private drawMarker(s: Surface, landing: Landing): void {
    const q = this.project(landing.at);
    if (!q.seen) return;
    const cx = Math.round(q.x);
    const cy = Math.round(q.y);
    s.disc(cx, cy, 2 * this.k + 1, P.ink);
    s.disc(cx, cy, 2 * this.k, GRADE_COLORS[landing.grade]);
  }

  /**
   * Landings off the picture (or round the back of the globe), and home: an arrow at the
   * edge, their way.
   */
  private drawPointers(s: Surface): void {
    const k = this.k;
    const margin = 6 * k;
    const top = (this.ceiling ?? 0) + margin;
    const targets: { at: GeoPoint; c: Color }[] = [];
    for (const landing of this.landings) {
      if (this.flight && this.flight.landing === landing) continue;
      targets.push({ at: landing.at, c: GRADE_COLORS[landing.grade] });
    }
    targets.push({ at: this.place, c: this.accent.light });
    const cx = this.w / 2;
    const cy = this.cam.ay;
    for (const { at, c } of targets) {
      const q = this.project(at);
      const inside =
        q.seen &&
        q.x >= margin &&
        q.x <= this.w - margin &&
        q.y >= top &&
        q.y <= this.h - margin;
      if (inside) continue;
      // the way to it: on the picture if it is in front, else from the camera's middle
      let dx = q.x - cx;
      let dy = q.y - cy;
      if (!q.seen || Math.hypot(dx, dy) < 1) {
        const lat = (this.cam.lat * Math.PI) / 180;
        dx = wrapLng(at.lng - this.cam.lng) * Math.cos(lat);
        dy = -(at.lat - this.cam.lat);
      }
      const len = Math.hypot(dx, dy) || 1;
      dx /= len;
      dy /= len;
      const tx =
        dx > 0
          ? (this.w - margin - cx) / dx
          : dx < 0
            ? (margin - cx) / dx
            : Infinity;
      const ty =
        dy > 0
          ? (this.h - margin - cy) / dy
          : dy < 0
            ? (top - cy) / dy
            : Infinity;
      const t = Math.min(tx, ty);
      const x = cx + dx * t;
      const y = cy + dy * t;
      for (let i = 0; i < 5 * k; i++) {
        const back = 5 * k - i;
        for (let j = -Math.floor(i / 2); j <= Math.floor(i / 2); j++) {
          const px = Math.round(x - dx * back - dy * j);
          const py = Math.round(y - dy * back + dx * j);
          s.px(
            px,
            py,
            i === 5 * k - 1 || Math.abs(j) === Math.floor(i / 2) ? P.ink : c,
          );
        }
      }
    }
  }

  private drawFlight(s: Surface, f: Flight): void {
    const u = f.held >= 0 ? 1 : easeInOutCubic(clamp(f.t / f.dur));
    const n = Math.round(u * PATH_SAMPLES);
    const points = f.path.map((p) => this.project(p));
    // how high it goes: by how far it travels on the picture
    let length = 0;
    for (let i = 1; i < points.length; i++) {
      if (!points[i].seen || !points[i - 1].seen) continue;
      length += Math.hypot(
        points[i].x - points[i - 1].x,
        points[i].y - points[i - 1].y,
      );
    }
    const top = Math.min(48, 8 + length * 0.18);
    const lift = (i: number) => top * Math.sin((Math.PI * i) / PATH_SAMPLES);
    // the trail, a dot every other sample, lifted with the ball
    for (let i = 0; i <= n; i += 2) {
      const p = points[i];
      if (!p.seen) continue;
      s.px(Math.round(p.x), Math.round(p.y - lift(i)), P.mist);
    }
    if (f.held >= 0) {
      // the landing: a ring in the shot's colour, spreading
      const p = points[PATH_SAMPLES];
      if (!p.seen) return;
      const r = Math.round(3 + Math.min(1, f.held / HOLD_S) * 9);
      dottedCircle(
        s,
        Math.round(p.x),
        Math.round(p.y),
        r,
        GRADE_COLORS[f.landing.grade],
        1,
      );
      return;
    }
    const at = u * PATH_SAMPLES;
    const i = Math.min(PATH_SAMPLES, Math.floor(at));
    const j = Math.min(PATH_SAMPLES, i + 1);
    if (!points[i].seen || !points[j].seen) return;
    const k = at - i;
    const bx = points[i].x + (points[j].x - points[i].x) * k;
    const by = points[i].y + (points[j].y - points[i].y) * k;
    // the ball's shadow on the map, then the ball above it
    s.disc(Math.round(bx), Math.round(by), 1, P.ink);
    drawMatchBall(
      s,
      Math.round(bx),
      Math.round(by - lift(at)),
      Math.floor(f.t * 14),
      this.light,
      { gold: f.landing.grade === "worldie" },
    );
  }

  private drawCounter(s: Surface, landing: Landing, t: number): void {
    if (landing.km === null) return;
    const k = this.k;
    const u = this.reduced ? 1 : clamp(t / COUNT_S);
    const shown = this.distance(Math.round(landing.km * easeInOutCubic(u)));
    // laid out by the whole distance, so that the words do not move as it counts up
    const text = shown.toUpperCase();
    const whole = this.distance(landing.km).toUpperCase();
    const opts = { font: FONT_5x7, scale: k, tabular: true } as const;
    const tw = measureText(whole, opts);
    const q = this.project(landing.at);
    if (!q.seen) return;
    const cx = clamp(
      Math.round(q.x),
      Math.ceil(tw / 2) + 4,
      this.w - Math.ceil(tw / 2) - 4,
    );
    // above the landing, unless that is over the pin's name: then below it
    const th = 7 * k;
    let ty = Math.round(q.y) - 6 * k - th;
    const p = this.plate;
    const left = cx - tw / 2 - 2;
    const right = cx + tw / 2 + 2;
    const over =
      right > p.x &&
      left < p.x + p.w &&
      ty + th + 2 > p.y &&
      ty - 2 < p.y + p.h;
    if (over) ty = Math.round(q.y) + 5 * k;
    drawText(s, text, cx, ty, GRADE_COLORS[landing.grade], {
      ...opts,
      align: "center",
      outline: P.ink,
    });
    if (landing.grade === "worldie") {
      // a sparkle either side
      const blink = Math.floor(this.t * 6) % 2 === 0;
      const c = blink ? P.goldLight : P.gold;
      const side = { font: FONT_3x5, scale: k } as const;
      drawText(s, "*", cx - Math.round(tw / 2) - 6 * k, ty, c, side);
      drawText(s, "*", cx + Math.round(tw / 2) + 3 * k, ty, c, side);
    }
  }

  /** Tier 7: fireworks over where the cup is lifted, and confetti falling. */
  private drawFireworks(s: Surface): void {
    const q = this.project(this.place);
    if (!q.seen) return;
    const k = this.k;
    const cols = [
      P.gold,
      P.home,
      P.goldLight,
      P.away,
      P.nextgen,
      P.closestLight,
    ];
    const spread = Math.min(this.w * 0.4, 120 * k);
    const t = this.reduced ? 0.6 : this.t;
    for (let b = 0; b < 4; b++) {
      const life = (t + b * 0.37) % 1.4;
      const n = Math.floor((t + b * 0.37) / 1.4);
      const cx = q.x + (hash2(b, n, 11) - 0.5) * spread * 2;
      const cy = q.y - 20 * k - hash2(b, n, 12) * spread * 0.5;
      const r = (6 + life * 14) * k;
      const c = cols[(b + n) % cols.length];
      if (life > 1.1) continue;
      for (let a = 0; a < 360; a += 30) {
        const rad = (a * Math.PI) / 180;
        for (const f of [0.6, 1]) {
          s.rect(
            Math.round(cx + Math.cos(rad) * r * f),
            Math.round(cy + Math.sin(rad) * r * f + life * life * 6 * k),
            k + (f === 1 ? k : 0),
            k + (f === 1 ? k : 0),
            f === 1 ? P.white : c,
          );
        }
      }
    }
    for (let i = 0; i < 40; i++) {
      const x = q.x + (hash2(i, 21, 3) - 0.5) * spread * 2.4;
      const fall = (t * 30 * k + hash2(i, 22, 3) * 200) % (this.h * 0.7);
      s.rect(
        Math.round(x),
        Math.round(q.y - spread * 0.6 + fall),
        2 * k,
        k,
        cols[i % cols.length],
      );
    }
  }

  /** The ink closing in round the pin: `u` 0 shut, 1 open. */
  private drawIris(s: Surface, u: number): void {
    const q = this.project(this.place);
    const x = q.seen ? q.x : this.w / 2;
    const y = q.seen ? q.y : this.cam.ay;
    const far =
      Math.hypot(Math.max(x, this.w - x), Math.max(y, this.h - y)) + 2;
    const r = far * easeInOutCubic(clamp(u));
    for (let row = 0; row < this.h; row++) {
      const dy = row + 0.5 - y;
      const half = dy * dy < r * r ? Math.sqrt(r * r - dy * dy) : -1;
      if (half < 0) {
        s.rect(0, row, this.w, 1, P.ink);
        continue;
      }
      const left = Math.max(0, Math.round(x - half));
      const right = Math.min(this.w, Math.round(x + half));
      if (left > 0) s.rect(0, row, left, 1, P.ink);
      if (right < this.w) s.rect(right, row, this.w - right, 1, P.ink);
    }
  }
}

/**
 * The way between two views at `e` (0 to 1): its scale even in proportion, its middle
 * moving with the view's width, so that nothing it leaves or goes to is lost on the way.
 */
function between(a: View, b: View, e: number): View {
  const kpp = Math.exp(lerp(Math.log(a.kpp), Math.log(b.kpp), e));
  // the pan follows the view's width: going out it waits until both fit, going in it is
  // done while the view is still wide; between views of about one size it goes evenly
  let p = e;
  const ratio = b.kpp / a.kpp;
  if (ratio > 1.25) p = (kpp - a.kpp) / (b.kpp - a.kpp);
  else if (ratio < 0.8) p = (a.kpp - kpp) / (a.kpp - b.kpp);
  p = clamp(p);
  const c = alongGreatCircle(a, b, p);
  return {
    lat: c.lat,
    lng: c.lng,
    kpp,
    ay: lerp(a.ay, b.ay, p),
    sx: lerp(a.sx, b.sx, p),
    sy: lerp(a.sy, b.sy, p),
  };
}

/** A spot's place along one axis: at `o + v * s` for a scale s, and within lo to hi. */
interface Range {
  v: number;
  lo: number;
  hi: number;
}

/** The biggest scale at which every range can hold its spot at once (Infinity: any). */
function mostScale(ranges: readonly Range[]): number {
  let most = Infinity;
  for (const a of ranges) {
    for (const b of ranges) {
      // a as low as it may go and b as high: o + v s within both
      if (b.v > a.v)
        most = Math.min(most, Math.max(0, b.hi - a.lo) / (b.v - a.v));
    }
  }
  return most;
}

/** Where `o` may be at scale `s` for every range to hold its spot. */
function offsets(
  ranges: readonly Range[],
  s: number,
): { lo: number; hi: number } {
  let lo = -Infinity;
  let hi = Infinity;
  for (const r of ranges) {
    lo = Math.max(lo, r.lo - r.v * s);
    hi = Math.min(hi, r.hi - r.v * s);
  }
  return { lo, hi };
}

/** Where `p` is, seen straight on from over `centre`: east and north, on a globe of radius 1. */
function unit(centre: GeoPoint, p: GeoPoint): { x: number; y: number } {
  const R = Math.PI / 180;
  const lat0 = centre.lat * R;
  const lat = p.lat * R;
  const d = wrapLng(p.lng - centre.lng) * R;
  let x = Math.cos(lat) * Math.sin(d);
  let y =
    Math.cos(lat0) * Math.sin(lat) -
    Math.sin(lat0) * Math.cos(lat) * Math.cos(d);
  const z =
    Math.sin(lat0) * Math.sin(lat) +
    Math.cos(lat0) * Math.cos(lat) * Math.cos(d);
  if (z < 0) {
    // round the back: on the rim, the way it lies
    const n = Math.hypot(x, y) || 1;
    x /= n;
    y /= n;
  }
  return { x, y };
}

/** A circle of dots, one every `gap` steps round it. */
function dottedCircle(
  s: Surface,
  cx: number,
  cy: number,
  r: number,
  c: Color,
  gap: number,
): void {
  const steps = Math.max(8, Math.round(r * 6));
  for (let i = 0; i < steps; i += gap + 1) {
    const a = (i / steps) * Math.PI * 2;
    s.px(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), c);
  }
}
