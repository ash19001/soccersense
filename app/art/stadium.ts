/**
 * The home screen's backdrop: a football stadium seen from the air, in its town, under
 * the player's own sky. Everything on the home screen except the menu ball, the wordmark
 * and the DOM captions.
 *
 * One aerial camera for everything (stadium-view.ts): the ground is a plane running away
 * to a horizon between a quarter and a third of the way down, the stadium is whole in
 * the middle, the town is planned (stadium-plan.ts) and painted round it
 * (stadium-town.ts, stadium-bowl.ts, stadium-things.ts), a city stands on the horizon
 * (stadium-skyline.ts), and an airship carries the matchday sign (stadium-airship.ts).
 *
 * What moves is in stadium-life.ts: the match on the pitch (stadium-match.ts), the cars
 * that come and go in the car park (stadium-parking.ts), the away coach, the trains,
 * supporters, flags, smoke, birds, cloud shadows, and the roar.
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
  drawAirship,
  paintAirship,
  signPlace,
  type Airship,
} from "~/art/stadium-airship";
import { makeLife, type Life } from "~/art/stadium-life";
import { paintTown, type Town } from "~/art/stadium-town";
import { makeView, project, type View } from "~/art/stadium-view";

export interface MenuStadiumInfo {
  name: string;
  city: string;
  country: string;
}

const HEADER = "TODAY'S STADIUM";

export class MenuBackdrop {
  private readonly seed: number;
  private stadium: MenuStadiumInfo;
  private header: string = HEADER;
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

  constructor(opts: {
    seed: number;
    stadium: MenuStadiumInfo;
    header?: string;
  }) {
    this.seed = Math.round(Number.isFinite(opts.seed) ? opts.seed : 0) | 0;
    this.stadium = { ...opts.stadium };
    if (opts.header !== undefined) this.header = opts.header.toUpperCase();
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

  setStadium(stadium: MenuStadiumInfo): void {
    this.stadium = { ...stadium };
  }

  setHeader(text: string): void {
    this.header = text.toUpperCase();
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

  draw(s: Surface, t: number): void {
    if (this.w !== s.w || this.h !== s.h) this.resize(s.w, s.h);
    if (this.dirty || !this.town || !this.life || !this.ship) {
      this.town = paintTown(this.view, this.light, this.seed);
      this.life = makeLife(this.view, this.light, this.seed, this.town);
      this.ship = paintAirship(signPlace(this.view), this.light);
      this.dirty = false;
    }
    const v = this.view;
    const town = this.town;
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
    this.life.draw(s, time, this.roar);
    drawAirship(
      s,
      this.ship,
      {
        header: this.header,
        name: this.stadium.name.toUpperCase(),
        place: `${this.stadium.city}, ${this.stadium.country}`.toUpperCase(),
      },
      this.light,
      time,
    );
  }
}
