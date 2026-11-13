/**
 * The home screen's backdrop: a football stadium seen from the air, in its town, under
 * the player's own sky. Everything on the home screen except the menu ball, the wordmark
 * and the DOM captions.
 *
 * One aerial camera for everything (stadium-view.ts): the ground is a plane running away
 * to a horizon between a quarter and a third of the way down, the stadium is whole in
 * the middle, the town is planned (stadium-plan.ts) and painted round it
 * (stadium-town.ts, stadium-bowl.ts, stadium-things.ts), a city stands on the horizon
 * (stadium-skyline.ts), and an airship carries a sign with the fact of the day
 * (stadium-airship.ts).
 *
 * What moves is in stadium-life.ts: the match on the pitch (stadium-match.ts), the
 * traffic (Stadium Road and its zebra: stadium-road.ts), the away coach, the trains,
 * supporters, flags, smoke, birds, cloud shadows, and the roar.
 *
 * The airship can be poked, and popped (stadium-airship-poke.ts): it falls into the town
 * (stadium-airship-fall.ts) and a new one drifts in with the same fact. Its state is the
 * poke history, kept here apart from the cached paint, so a change of size or light never
 * loses it. The fact's marquee starts again from the left each time an airship arrives.
 *
 * The static picture is painted once per size and light and cached; a frame is the sky,
 * two copies and the moving things. `MenuBackdrop` and its methods are the backdrop
 * contract (docs/API_ART.md): the menu scene uses nothing else.
 *
 * The old view from the centre circle is kept in stadium-inside.ts.
 */

import { Surface, clamp } from "~/pixel";
import { lightingFor, type Lighting } from "~/art/lighting";
import { drawSky } from "~/art/sky";
import {
  airshipDrift,
  airshipHit,
  drawAirship,
  drawAirshipPosed,
  paintAirship,
  signAt,
  signPlace,
  type Airship,
  type SignText,
} from "~/art/stadium-airship";
import {
  buildFallKit,
  drawDown,
  drawPuffs,
  findCrashSite,
  type CrashSite,
  type FallKit,
} from "~/art/stadium-airship-fall";
import {
  ARRIVE,
  AirshipPokes,
  FALL,
  RETURN,
  poseAt,
  type Pose,
} from "~/art/stadium-airship-poke";
import {
  DEFAULT_SCHEME,
  clubLight,
  schemeById,
  type ClubScheme,
} from "~/art/stadium-club";
import { FIREWORKS, makeLife, type Life } from "~/art/stadium-life";
import { GOAL_AT, MATCH_PERIOD } from "~/art/stadium-match";
import {
  MascotPokes,
  drawMascot,
  findMascotSpot,
  mascotCues,
  mascotFrame,
  mascotZone,
} from "~/art/stadium-mascot";
import { HOME_PAGE } from "~/audio/mix";
import type { SoundCue } from "~/scenes/scene";
import {
  drawFlyby,
  paintBanner,
  planeRoute,
  type Banner,
} from "~/art/stadium-plane";
import { paintTown, type Town } from "~/art/stadium-town";
import { makeView, project, type View } from "~/art/stadium-view";

/** What the airship's sign says: a short header over the fact of the day. */
/** What is heard of the match on the pitch, far off: the goal's cheer and its rockets. */
const GOAL_CHEER: SoundCue = { kind: "cheer", size: HOME_PAGE.pictureCheer };
const FAR_FIREWORK: SoundCue = { kind: "firework", distant: true };
/** Over this much roar the goal's rockets are not drawn (stadium-life.ts), nor heard. */
const ROCKETS_ROAR = 0.45;

export interface MenuSign {
  /** The first line, for example "DID YOU KNOW?" or "HOME TODAY". Short: it does not scroll. */
  header: string;
  /** Under it: the fact (it scrolls), or a short line such as "360 PTS". */
  text: string;
}

/** The sign as it is drawn: capitals, on one line. */
function signText(sign: MenuSign): SignText {
  const line = (x: string): string =>
    x.replace(/\s+/g, " ").trim().toUpperCase();
  return { header: line(sign.header), text: line(sign.text) };
}

/**
 * Where the people on foot walk, on screen: their feet every half second over three minutes,
 * which traces every way they take. The mascot keeps off them.
 */
function trodden(view: View, life: Life): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let t = 0; t < 180; t += 0.5) {
    life.people(
      t,
      (X, V) => {
        const p = project(view, X, V);
        out.push({ x: p.x, y: p.y });
      },
      // every walker of the day, so the mascot stands in the same place at night
      true,
    );
  }
  return out;
}

export class MenuBackdrop {
  private readonly seed: number;
  private sign: SignText;
  /** The sign cycles through these (the player's day) instead of the fact. */
  private messages: SignText[] = [];
  /** The plane tows this across the sky (empty: no plane). */
  private bannerText = "";
  private banner: Banner | null = null;
  private light: Lighting = lightingFor({ elevation: 45, morning: false });
  private scheme: ClubScheme = DEFAULT_SCHEME;
  private moonPhase: number | undefined = undefined;
  private roar = 0;
  private w = 0;
  private h = 0;
  private dirty = true;
  /** Draws left before a change of light repaints the picture. */
  private relit = 0;
  private view: View = makeView(1, 1);
  private town: Town | null = null;
  private life: Life | null = null;
  private ship: Airship | null = null;
  private work: Surface | null = null;
  private kit: FallKit | null = null;
  private site: CrashSite | null = null;
  private readonly sites = new Map<string, CrashSite>();
  private readonly pokes = new AirshipPokes();
  /** Where the mascot stands, per size (null: no lawn, no mascot). */
  private spot: { x: number; y: number } | null = null;
  private readonly spots = new Map<string, { x: number; y: number } | null>();
  private readonly mascot = new MascotPokes();
  /** The last point airshipAt found on the airship: a poke at the same moment dents it there. */
  private hit = { x: 0, y: 0, t: Number.NaN };

  constructor(opts: { seed: number; sign: MenuSign }) {
    this.seed = Math.round(Number.isFinite(opts.seed) ? opts.seed : 0) | 0;
    this.sign = signText(opts.sign);
  }

  resize(w: number, h: number): void {
    const W = Math.max(1, Math.round(Number.isFinite(w) ? w : 1));
    const H = Math.max(1, Math.round(Number.isFinite(h) ? h : 1));
    if (W === this.w && H === this.h) return;
    this.w = W;
    this.h = H;
    this.view = makeView(W, H);
    this.dirty = true;
    this.relit = 0;
  }

  setLighting(light: Lighting): void {
    if (light === this.light) return;
    this.light = light;
    // already painted: the sky moves on in this frame, the menu ball in the next
    // (menu.ts), the picture in the one after and the town a slice a frame after that, so
    // no one frame pays for the whole step
    if (!this.dirty && this.town) this.relit = 2;
    this.dirty = true;
  }

  /**
   * The day's club colours (stadium-club.ts: `schemeForDay(day).id`). An unknown id is the
   * default, red and white. The menu ball's HOME and AWAY colours never change.
   */
  setScheme(id: string): void {
    const scheme = schemeById(id);
    if (scheme === this.scheme) return;
    this.scheme = scheme;
    this.dirty = true;
  }

  /** The id of the colours it wears. */
  schemeId(): string {
    return this.scheme.id;
  }

  /** The light the stadium is painted in: the sky's, in the club's colours. */
  private clubbed(): Lighting {
    return clubLight(this.light, this.scheme);
  }

  /** What the sign says. It is drawn in capitals. */
  setSign(sign: MenuSign): void {
    this.sign = signText(sign);
  }

  /**
   * What the sign says instead of `setSign`'s: these messages one after
   * another (stadium-airship.ts `drawSignBoard`). None: `setSign`'s again.
   */
  setMessages(messages: readonly MenuSign[]): void {
    this.messages = messages.map(signText);
  }

  /** The words on the banner the plane tows across the sky (stadium-plane.ts). Empty: no plane. */
  setBanner(text: string): void {
    const words = text.replace(/\s+/g, " ").trim().toUpperCase();
    if (words === this.bannerText) return;
    this.bannerText = words;
    this.banner = null;
  }

  /** What the sign shows. */
  private shown(): SignText[] {
    return this.messages.length > 0 ? this.messages : [this.sign];
  }

  setMoonPhase(phase: number): void {
    this.moonPhase = Number.isFinite(phase) ? phase : undefined;
  }

  target(): { x: number; y: number } {
    const p = project(this.view, 0, 0);
    return { x: p.x, y: p.y };
  }

  setRoar(amount: number): void {
    this.roar = Number.isFinite(amount) ? clamp(amount, 0, 1) : 0;
  }

  /** Is (x, y) on the airship (envelope, gondola, fins or its sign) at scene time t? For the cursor and for clicks. */
  airshipAt(x: number, y: number, t: number): boolean {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(t)) {
      return false;
    }
    if (this.w === 0 || this.h === 0) return false;
    if (this.pokes.phase(t).kind !== "ship") return false;
    const ship = this.paint().ship;
    const at = this.shipOffset(ship, t);
    if (!airshipHit(ship, x, y, at.x, at.y)) return false;
    this.hit = {
      x: x - at.x - ship.x - ship.centre.x,
      y: y - at.y - ship.y - ship.centre.y,
      t,
    };
    return true;
  }

  /** A click on the airship at scene time t (the clock passed to draw). "wobble": it reacted; "pop": this click burst it; "none": nothing to click (falling, crashed or gone). */
  pokeAirship(t: number): "wobble" | "pop" | "none" {
    const known = this.hit.t === t;
    return this.pokes.poke(
      t,
      known ? this.hit.x : Number.NaN,
      known ? this.hit.y : Number.NaN,
    );
  }

  /** Where the mascot stands (the point between his feet), or null when there is no lawn for him. */
  mascotSpot(): { x: number; y: number } | null {
    if (this.w === 0 || this.h === 0) return null;
    this.paint();
    return this.spot ? { ...this.spot } : null;
  }

  /** Is (x, y) on the mascot at scene time t? For the cursor and for clicks. False on a phone (no lawn, no mascot). */
  mascotAt(x: number, y: number, t: number): boolean {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(t)) {
      return false;
    }
    if (this.w === 0 || this.h === 0) return false;
    this.paint();
    if (!this.spot) return false;
    const z = mascotZone(this.spot);
    return x >= z.x && x < z.x + z.w && y >= z.y && y < z.y + z.h;
  }

  /** A click on the mascot at scene time t: he does his next trick, or is "busy" with one (or absent). */
  pokeMascot(t: number): "trick" | "busy" {
    if (this.w === 0 || this.h === 0) return "busy";
    this.paint();
    if (!this.spot) return "busy";
    return this.mascot.poke(t);
  }

  /**
   * What is heard of the picture in the span (t0, t1] of scene time: the airship's landing
   * (a thud, or a splash in the pond), the mascot's touches and kicks, and the match far
   * off: as the home side scores, a very small cheer (`size` 0.1) and, as each of the goal's
   * rockets goes up, a distant firework (none while the roar sends up its own). Never a
   * horn: it is background. Pure: the same span gives the same cues, and spans that meet
   * never repeat one.
   * Only the last second of a longer span is heard (a tab coming back does not get a minute
   * of noise at once).
   */
  cuesBetween(t0: number, t1: number): SoundCue[] {
    const out: SoundCue[] = [];
    if (!Number.isFinite(t0) || !Number.isFinite(t1) || !(t1 > t0)) return out;
    const from = Math.max(t0, t1 - 1);
    const at = (time: number): boolean => time > from && time <= t1;
    // the airship comes down
    const pop = this.pokes.poppedAt(t1 - FALL);
    if (Number.isFinite(pop) && at(pop + FALL)) {
      const water = this.w > 0 && this.h > 0 && this.paint().site.water;
      out.push(water ? { kind: "splash" } : { kind: "thud" });
    }
    mascotCues(this.mascot, from, t1, out);
    // the match far off: the goal, and its rockets (they go up for FIREWORKS seconds)
    if (this.w > 0 && this.h > 0) {
      const launches = this.paint().life.launches;
      const first = Math.floor((from - FIREWORKS - GOAL_AT) / MATCH_PERIOD);
      const last = Math.ceil((t1 - GOAL_AT) / MATCH_PERIOD);
      for (let k = first; k <= last; k++) {
        const goal = GOAL_AT + k * MATCH_PERIOD;
        if (at(goal)) out.push(GOAL_CHEER);
        if (this.roar > ROCKETS_ROAR) continue;
        for (const launch of launches) {
          if (at(goal + launch)) out.push(FAR_FIREWORK);
        }
      }
    }
    return out;
  }

  /**
   * The marquee's clock at t: the scene's time until the first pop. A fallen airship's sign
   * stands still at the start of the fact, and the new one's does until it is in its place.
   */
  private signTime(t: number): number {
    const pop = this.pokes.poppedAt(t);
    if (!(pop <= t)) return t;
    return Math.max(0, t - pop - RETURN - ARRIVE);
  }

  /** The pose of the airship in the air at t (null at rest). */
  private poseOf(ship: Airship, t: number): Pose | null {
    const { rx, ry } = ship.place;
    return poseAt(this.pokes, t, rx, ry, ship.x + ship.layer.w + 4);
  }

  /** How far the airship is from its rest at t: its drift and its pose. */
  private shipOffset(ship: Airship, t: number): { x: number; y: number } {
    const d = airshipDrift(t);
    const pose = this.poseOf(ship, t);
    return { x: d.dx + (pose?.dx ?? 0), y: d.dy + (pose?.dy ?? 0) };
  }

  /** The cached picture for this size and light, painted if need be. */
  private paint(): {
    town: Town;
    life: Life;
    ship: Airship;
    work: Surface;
    kit: FallKit;
    site: CrashSite;
  } {
    const held =
      this.relit > 0 &&
      !!this.town &&
      !!this.life &&
      !!this.ship &&
      !!this.work &&
      !!this.kit &&
      !!this.site;
    if (
      (this.dirty && !held) ||
      !this.town ||
      !this.life ||
      !this.ship ||
      !this.work ||
      !this.kit ||
      !this.site
    ) {
      const light = this.clubbed();
      this.town = paintTown(this.view, light, this.seed);
      this.ship = paintAirship(signPlace(this.view), light);
      // the goal's fireworks keep clear of the airship (it drifts and lurches a little)
      const ship = this.ship;
      this.life = makeLife(this.view, light, this.seed, this.town, [
        {
          x: ship.x - 8,
          y: ship.y - 8,
          w: ship.layer.w + 16,
          h: ship.layer.h + 16,
        },
      ]);
      this.work = new Surface(this.ship.layer.w, this.ship.layer.h);
      this.kit = buildFallKit(this.ship);
      // chosen once per size, so a change of light never moves a wreck or the mascot
      const key = `${this.w}x${this.h}`;
      if (!this.spots.has(key)) {
        if (this.spots.size > 8) this.spots.clear();
        this.spots.set(
          key,
          findMascotSpot(
            this.view,
            this.town.depth,
            this.seed,
            [{ x: ship.x, y: ship.y, w: ship.layer.w, h: ship.layer.h }],
            trodden(this.view, this.life),
          ),
        );
      }
      this.spot = this.spots.get(key) ?? null;
      let site = this.sites.get(key);
      if (!site) {
        site = findCrashSite(
          this.view,
          this.town.land,
          this.town.top,
          this.town.depth,
          this.seed,
          this.ship.x + this.ship.centre.x,
          this.spot ? [mascotZone(this.spot)] : [],
        );
        if (this.sites.size > 8) this.sites.clear();
        this.sites.set(key, site);
      }
      this.site = site;
      this.dirty = false;
    }
    return {
      town: this.town,
      life: this.life,
      ship: this.ship,
      work: this.work,
      kit: this.kit,
      site: this.site,
    };
  }

  draw(s: Surface, t: number): void {
    if (this.w !== s.w || this.h !== s.h) {
      this.resize(s.w, s.h);
    }
    const { life, ship, work, kit, site } = this.paint();
    const v = this.view;
    const town = this.paint().town;
    if (this.relit > 0) this.relit--;
    const time = Number.isFinite(t) ? t : 0;
    const sky = {
      light: this.light,
      t: time,
      seed: this.seed,
      horizonY: v.hy,
      clearTop: v.logoH,
      sunX: v.cx,
      moon: v.moon,
    };
    if (this.moonPhase === undefined) drawSky(s, sky);
    else drawSky(s, { ...sky, moonPhase: this.moonPhase });
    s.blit(town.skyline, 0, town.skylineY);
    s.copy(town.land, 0, town.top);
    life.draw(s, time, this.roar);
    const light = this.clubbed();
    if (this.spot) {
      drawMascot(
        s,
        this.spot.x,
        this.spot.y,
        mascotFrame(this.mascot, time),
        light,
      );
    }
    // the plane and its banner, far off: behind the airship
    if (this.bannerText !== "") {
      if (
        this.banner?.light !== light ||
        this.banner.text !== this.bannerText
      ) {
        this.banner = paintBanner(this.bannerText, light);
      }
      // the airship down to its gondola's keel
      const box = {
        x: ship.x,
        y: ship.y,
        w: ship.layer.w,
        h: ship.gondola.y + ship.gondola.h,
      };
      drawFlyby(s, this.banner, planeRoute(v, box), light, time);
    }
    const text = this.shown();
    const phase = this.pokes.phase(time);
    if (phase.kind === "down") {
      // the wreck's sign keeps the message it showed when it burst
      const pop = time - phase.since;
      const z = ship.place.panel;
      const last =
        text[signAt(text, z.w, z.h, this.signTime(pop)).index] ?? text[0];
      drawDown(s, ship, kit, site, last, light, time, phase.since, town.depth);
      return;
    }
    const pose = this.poseOf(ship, time);
    if (!pose) {
      drawAirship(s, ship, text, light, time, this.signTime(time));
      return;
    }
    drawAirshipPosed(
      s,
      ship,
      text,
      light,
      time,
      pose,
      work,
      this.signTime(time),
    );
    drawPuffs(s, ship, this.pokes, pose, light, time);
  }
}
