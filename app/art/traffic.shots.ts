/**
 * Package G's sheets: the home picture's traffic and people (stadium-cars.ts,
 * stadium-people.ts), each on a strip of ground by day and at night.
 *
 *   traffic/cars     every heading of every car class, by day, then at night with the
 *                       lamps; then every coach heading by class, by day and at night
 *   traffic/people   every look of the person in each class, standing, striding,
 *                       jumping, front and back; the dog, the ducks and the park ball
 *
 *   ./node_modules/.bin/tsx tools/snap.ts traffic/cars --scale 2
 */

import { Surface, type Color, type ShotMap } from "~/pixel";
import { distant, lightingFor, type Lighting } from "~/art/lighting";
import { P } from "~/art/palette";
import {
  HEADINGS,
  carLamps,
  carSprite,
  coachLamps,
  coachSprite,
  headingAngle,
} from "~/art/stadium-cars";
import { drawDog, drawDuck, drawParkBall } from "~/art/stadium-people";
import { person } from "~/art/stadium-things";
import { carLook, coachLook, personLook } from "~/art/stadium-town";

const DAY = lightingFor({ elevation: 45, morning: false });
const NIGHT = lightingFor({ elevation: -30, morning: false });

function toneOf(light: Lighting): (c: Color, V: number) => Color {
  return (c) => distant(light, c, 0);
}

function tick(
  s: Surface,
  x: number,
  y: number,
  hd: number,
  r: number,
  c: Color,
): void {
  const a = (headingAngle(hd) * Math.PI) / 180;
  for (let d = r; d < r + 4; d++) {
    s.px(Math.round(x + Math.cos(a) * d), Math.round(y - Math.sin(a) * d), c);
  }
}

/** The 14 drawn headings of each class, as stored (0 to 90 degrees, then 180 to 270). */
const DRAWN = [0, 1, 2, 3, 4, 5, 6, 12, 13, 14, 15, 16, 17, 18];

/** The looks on the people sheet: [pick, kind] (personLook's), to show every style. */
const LOOKS: readonly (readonly [number, number])[] = [];
{
  // the first picks that give each head and body style, for each kind
  const want = new Set<string>();
  const list = LOOKS as [number, number][];

  for (const kind of [0, 1, 2, 3]) {
    for (let i = 0; i < 997 && list.length < 40; i++) {
      const r = (i + 0.5) / 997;
      const k = personLook((c) => c, r, kind);
      const key = `${kind}:${k.head}:${k.body}`;
      if (want.has(key)) continue;
      want.add(key);
      list.push([r, kind]);
    }
  }
}

function peopleSheet(light: Lighting, ground: Color, plaza: Color): Surface {
  const cell = 10;
  const cols = LOOKS.length;
  const s = new Surface(cell * cols + 4, 92);
  s.clear(distant(light, plaza, 0));
  s.rect(0, 46, s.w, 46, distant(light, ground, 0));
  const tone = (c: Color): Color => (light.lightsOn ? light.lit(c) : c);
  LOOKS.forEach(([r, kind], i) => {
    const x = 4 + i * cell;
    const k = personLook(tone, r, kind);
    // front standing, striding; back standing, striding; a jump
    person(s, x, 14, 2, k, 0, 0);
    person(s, x, 28, 2, k, 1, 0);
    person(s, x, 42, 2, k, 0, 0, true);
    person(s, x, 58, 2, k, 1, 0, true);
    person(s, x, 74, 2, k, 0, 4);
    // the middle and far classes, front and back
    person(s, x, 84, 1, k, i % 2, 0);
    person(s, x + 3, 84, 1, k, 0, 0, true);
    person(s, x, 90, 0, k, 0, 0);
    person(s, x + 3, 90, 0, k, 0, 0, true);
  });
  return s;
}

export const shots: ShotMap = {
  // every look (home, away, steward, anyone, in every head and body style):
  // front standing and striding on the plaza, back standing and striding, a jump with
  // arms up, then the middle and far classes; by day, then at night under the floodlights
  "traffic/people": () => {
    const day = peopleSheet(DAY, P.grass, P.concreteLight);
    const night = peopleSheet(NIGHT, P.grass, P.concreteLight);
    const s = new Surface(day.w, day.h * 2 + 2);
    s.blit(day, 0, 0);
    s.blit(night, 0, day.h + 2);
    return s;
  },

  // the park: the dog trotting both ways in both classes, the ducks both
  // ways, the ball; day then night
  "traffic/park": () => {
    const s = new Surface(64, 40);
    for (const [row, light] of [
      [0, DAY],
      [1, NIGHT],
    ] as const) {
      const y0 = row * 20;
      const t = (c: Color): Color => distant(light, c, 0);
      s.rect(0, y0, 32, 20, t(P.grass));
      s.rect(32, y0, 32, 20, t(P.skyMid));
      for (let f = 0; f < 2; f++) {
        drawDog(
          s,
          4 + f * 7,
          y0 + 8,
          true,
          false,
          f,
          t(P.wood),
          t(P.woodDark),
          t(P.ink),
        );
        drawDog(
          s,
          4 + f * 7,
          y0 + 16,
          true,
          true,
          f,
          t(P.wood),
          t(P.woodDark),
          t(P.ink),
        );
      }
      drawDog(
        s,
        20,
        y0 + 8,
        false,
        false,
        0,
        t(P.wood),
        t(P.woodDark),
        t(P.ink),
      );
      drawParkBall(s, 25, y0 + 12, t(P.white), t(P.mist));
      drawDuck(
        s,
        38,
        y0 + 6,
        false,
        t(P.wood),
        t(P.woodDark),
        t(P.grassDark),
        t(P.gold),
      );
      drawDuck(
        s,
        46,
        y0 + 6,
        true,
        t(P.wood),
        t(P.woodDark),
        t(P.grassDark),
        t(P.gold),
      );
      drawDuck(
        s,
        38,
        y0 + 14,
        false,
        t(P.white),
        t(P.steelHi),
        t(P.white),
        t(P.gold),
      );
      drawDuck(
        s,
        46,
        y0 + 14,
        true,
        t(P.white),
        t(P.steelHi),
        t(P.white),
        t(P.gold),
      );
    }
    return s;
  },

  // the drawn grids of one class (--seed 0, 1 or 2; 3, 4, 5 for the coaches), in one
  // paint by day (the first row) and with the lamps at night (the second), for clean-up
  "traffic/grids": (ctx) => {
    const coach = ctx.seed >= 3;
    const cls = (ctx.seed % 3) as 0 | 1 | 2;
    const cell = coach ? 44 : 22;
    const s = new Surface(cell * DRAWN.length, cell * 2);
    s.clear(distant(DAY, P.concrete, 0));
    s.rect(0, cell, s.w, cell, distant(NIGHT, P.concrete, 0));
    DRAWN.forEach((hd, i) => {
      const x = i * cell + cell / 2;
      for (const night of [false, true]) {
        const light = night ? NIGHT : DAY;
        const y = (night ? cell : 0) + Math.round(cell * 0.62);
        if (coach) {
          coachSprite(s, x, y, cls, hd, coachLook(toneOf(light), 0, 1));
          if (night) coachLamps(s, x, y, cls, hd, 1);
        } else {
          carSprite(s, x, y, cls, hd, carLook(toneOf(light), 0, 0.51));
          if (night) carLamps(s, x, y, cls, hd, 1);
        }
        s.px(x, y + 3, P.goldLight);
      }
    });
    return s;
  },

  "traffic/cars": () => {
    const cell = 44;
    const big = 64;
    const rows = [cell, cell, cell, cell, cell, cell, big, cell, cell, big];
    const top: number[] = [];
    let y0 = 2;
    for (const r of rows) {
      top.push(y0);
      y0 += r;
    }
    const s = new Surface(big * HEADINGS + 4, y0 + 2);
    s.clear(distant(DAY, P.concrete, 0));
    for (const i of [3, 4, 5, 9]) {
      s.rect(0, top[i], s.w, rows[i], distant(NIGHT, P.concrete, 0));
    }
    for (let hd = 0; hd < HEADINGS; hd++) {
      for (let row = 0; row < rows.length; row++) {
        const coach = row >= 6;
        const night = row >= 3 && row <= 5 ? true : row === 9;
        const light = night ? NIGHT : DAY;
        const w = coach ? big : cell;
        const x = 2 + hd * (coach ? big : cell) + w / 2;
        if (!coach && x > s.w) continue;
        const y = top[row] + rows[row] / 2;
        tick(s, x, y, hd, coach ? 22 : 14, night ? P.slate : P.concreteDark);
        if (coach) {
          const cls = (row === 9 ? 2 : 8 - row) as 0 | 1 | 2;
          const look = coachLook(toneOf(light), 0, hd % 6);
          coachSprite(s, x, y, cls, hd, look);
          if (night) coachLamps(s, x, y, cls, hd, 1);
          continue;
        }
        const cls = (2 - (row % 3)) as 0 | 1 | 2;
        const look = carLook(toneOf(light), 0, ((hd * 5) % 12) / 12 + 0.01);
        carSprite(s, x, y, cls, hd, look);
        if (night) carLamps(s, x, y, cls, hd, 1);
      }
    }
    return s;
  },
};
