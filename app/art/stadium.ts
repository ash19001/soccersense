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
  RETURN,
  poseAt,
  type Pose,
} from "~/art/stadium-airship-poke";
import { makeLife, type Life } from "~/art/stadium-life";
import { paintTown, type Town } from "~/art/stadium-town";
import { makeView, project, type View } from "~/art/stadium-view";

/** What the airship's sign says: a short header over the fact of the day. */
export interface MenuSign {
  /** The first line, for example "DID YOU KNOW?". Short: it does not scroll. */
  header: string;
  /** The fact. It scrolls. */
  text: string;
}

/** The sign as it is drawn: capitals, on one line. */
function signText(sign: MenuSign): SignText {
  const line = (x: string): string =>
    x.replace(/\s+/g, " ").trim().toUpperCase();
  return { header: line(sign.header), text: line(sign.text) };
}

export class MenuBackdrop {
  private readonly seed: number;
  private sign: SignText;
  private light: Lighting = lightingFor({ elevation: 45, morning: false });
  private moonPhase: number | undefined = undefined;
  private roar = 0;
  private w = 0;
  private h = 0;
  private dirty = true;
  private view: View = makeView(1, 1);
  private town: Town | null = null;
  private life: Life | null = null;
  private ship: Airship | null = null;
  private work: Surface | null = null;
  private kit: FallKit | null = null;
  private site: CrashSite | null = null;
  private readonly sites = new Map<string, CrashSite>();
  private readonly pokes = new AirshipPokes();
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
  }

  setLighting(light: Lighting): void {
    if (light === this.light) return;
    this.light = light;
    this.dirty = true;
  }

  /** What the sign says. It is drawn in capitals. */
  setSign(sign: MenuSign): void {
    this.sign = signText(sign);
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
    return poseAt(this.pokes, t, rx, ry, ship.x + ship.layer.w + 2);
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
    if (
      this.dirty ||
      !this.town ||
      !this.life ||
      !this.ship ||
      !this.work ||
      !this.kit ||
      !this.site
    ) {
      this.town = paintTown(this.view, this.light, this.seed);
      this.ship = paintAirship(signPlace(this.view), this.light);
      // the goal's fireworks keep clear of the airship (it drifts and lurches a little)
      const ship = this.ship;
      this.life = makeLife(this.view, this.light, this.seed, this.town, [
        {
          x: ship.x - 4,
          y: ship.y - 4,
          w: ship.layer.w + 8,
          h: ship.layer.h + 8,
        },
      ]);
      this.work = new Surface(this.ship.layer.w, this.ship.layer.h);
      this.kit = buildFallKit(this.ship);
      // chosen once per size, so a change of light never moves a wreck
      const key = `${this.w}x${this.h}`;
      let site = this.sites.get(key);
      if (!site) {
        site = findCrashSite(
          this.view,
          this.town.land,
          this.town.top,
          this.town.depth,
          this.seed,
          this.ship.x + this.ship.centre.x,
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
    if (this.w !== s.w || this.h !== s.h) this.resize(s.w, s.h);
    const { life, ship, work, kit, site } = this.paint();
    const v = this.view;
    const town = this.paint().town;
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
    const text = this.sign;
    const phase = this.pokes.phase(time);
    if (phase.kind === "down") {
      drawDown(
        s,
        ship,
        kit,
        site,
        text,
        this.light,
        time,
        phase.since,
        town.depth,
      );
      return;
    }
    const pose = this.poseOf(ship, time);
    if (!pose) {
      drawAirship(s, ship, text, this.light, time, this.signTime(time));
      return;
    }
    drawAirshipPosed(
      s,
      ship,
      text,
      this.light,
      time,
      pose,
      work,
      this.signTime(time),
    );
    drawPuffs(s, ship, this.pokes, pose, this.light, time);
  }
}
