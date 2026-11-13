/**
 * The people of the grounds on one sheet: fans in every pose, watchers, backs, the near
 * crowd, the steward, the dog.
 *
 *   ./node_modules/.bin/tsx tools/snap.ts ground/crowd --scale 3
 *   ./node_modules/.bin/tsx tools/snap.ts ground/crowd --scale 3 --time night
 */

import { lightingFor, type Lighting } from "~/art/lighting";
import { P } from "~/art/palette";
import {
  FONT_3x5,
  Surface,
  TRANSPARENT,
  drawText,
  shade,
  type Color,
  type ShotContext,
  type ShotMap,
} from "~/pixel";
import {
  BACKS,
  CROWD_STYLES,
  FanList,
  crowdBack,
  crowdScarf,
  drawDog,
  drawFan,
  drawFlash,
  drawSteward,
  drawWatcher,
  paintBack,
  paintFan,
  type FanLook,
  type Pose,
  type Watcher,
} from "./people";

const SHIRTS: readonly Color[] = [
  P.home,
  P.home,
  P.homeDark,
  P.chalk,
  P.home,
  P.steel,
  P.homeLight,
  P.home,
  P.slate,
  P.home,
  P.awayDark,
  P.homeDark,
];
const SKINS: readonly Color[] = [P.skinA, P.skinB, P.skinC, P.skinA, P.skinB];
const HAIRS: readonly Color[] = [
  P.hairDark,
  P.hairBrown,
  P.hairDark,
  P.hairBlond,
  P.mist,
  P.hairBrown,
  P.hairDark,
];

function look(L: Lighting, i: number, seat: Color, scarf: boolean): FanLook {
  const skin = L.lit(SKINS[i % SKINS.length]);
  return {
    head: skin,
    body: L.lit(SHIRTS[(i * 5) % SHIRTS.length]),
    hand: skin,
    seat,
    scarfA: scarf ? L.lit(P.home) : TRANSPARENT,
    scarfB: L.lit(P.chalk),
    period: 9,
    offset: i,
    withHero: true,
    hair: L.lit(HAIRS[(i * 3) % HAIRS.length]),
  };
}

const POSES: readonly Pose[] = [0, 1, 2, 3, 4, 5];

function sheet(ctx: ShotContext): Surface {
  const L = lightingFor(ctx.sun);
  const out = new Surface(420, 330);
  out.clear(L.lit(P.concreteDark));
  const seat = L.lit(P.slate);
  const label = (text: string, x: number, y: number): void => {
    drawText(out, text, x, y, P.chalk, { font: FONT_3x5, outline: P.ink });
  };

  // 1. a block of fans at rest
  label("FANS AT REST", 4, 2);
  out.rect(4, 10, 16 * 8 + 4, 6 * 8, seat);
  const block = new FanList(200);
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 16; c++) {
      const x = 4 + (r & 1) * 4 + c * 8 + 2;
      if (x + 6 > 4 + 16 * 8 + 4) continue;
      paintFan(
        out,
        block,
        x,
        10 + r * 8,
        look(L, r * 16 + c, seat, (r * 7 + c) % 6 === 0),
      );
    }
  }

  // 2. every pose, with and without a scarf
  label("POSES: REST BOB JUMP HANDS SCARF ARMS", 4, 62);
  const poses = new FanList(40);
  for (const pose of POSES) {
    for (let j = 0; j < 3; j++) {
      const x = 8 + pose * 44 + j * 12;
      out.rect(x - 4, 74, 12, 16, seat);
      const k = poses.n;
      paintFan(out, poses, x, 78, look(L, pose * 3 + j, seat, j !== 1));
      drawFan(out, poses, k, pose);
      // a flash on the third
      if (j === 2 && pose === 0) drawFlash(out, x, 78, true);
    }
  }

  // 3. watchers, adults and children, in every pose
  label("WATCHERS", 4, 120);
  const grass = L.env(P.grass);
  out.rect(0, 128, 420, 40, grass);
  const watcher = (x: number, y: number, kid: boolean, i: number): Watcher => ({
    x,
    y,
    kid,
    hair: L.env(HAIRS[i % HAIRS.length]),
    skin: L.env(SKINS[i % SKINS.length]),
    coat: L.env(
      [P.homeDark, P.awayDark, P.slate, P.home, P.grassDeep, P.wood][i % 6],
    ),
    coatLow: L.env(shade(P.slate, -0.1)),
    legs: L.env(i % 2 === 0 ? P.night : P.slate),
    period: 9,
    offset: i,
    withHero: true,
    scarfA: i % 3 !== 1 ? L.env(P.home) : TRANSPARENT,
    scarfB: L.env(P.chalk),
  });
  for (const pose of POSES) {
    drawWatcher(out, watcher(14 + pose * 34, 166, false, pose), pose);
    drawWatcher(out, watcher(28 + pose * 34, 166, true, pose + 1), pose);
  }
  out.rect(210, 128, 210, 40, grass);

  // 4. backs: a jacket and a long coat; the near crowd; the steward; the dog
  label("BACKS  NEAR CROWD  STEWARD  DOG", 4, 172);
  out.rect(0, 180, 420, 150, L.lit(P.grassDeep));
  paintBack(
    out,
    6,
    206,
    L.lit(P.hairBrown),
    L.lit(P.awayDark),
    false,
    L.lit(P.skinA),
  );
  paintBack(
    out,
    22,
    206,
    L.lit(P.hairBlond),
    L.lit(P.gold),
    false,
    L.lit(P.skinB),
  );
  paintBack(
    out,
    38,
    206,
    L.lit(P.hairDark),
    L.lit(P.home),
    true,
    L.lit(P.skinC),
  );

  // the near crowd: every style, in a few shirts, a scarf held up
  const crowd = L.lit(P.night);
  out.rect(70, 184, 150, 70, crowd);
  for (let r = 0, y = 190; r < 6; r++, y += BACKS.dy) {
    for (let c = 0, x = 70 + (r & 1) * 6 - 6; x < 220; c++, x += BACKS.dx) {
      const i = r * 13 + c;
      crowdBack(
        out,
        x,
        y,
        i % CROWD_STYLES,
        L.lit(HAIRS[i % HAIRS.length]),
        L.lit(SKINS[i % SKINS.length]),
        L.lit(SHIRTS[(i * 7) % SHIRTS.length]),
        L.lit(P.home),
        L.lit(P.chalk),
      );
      if (i % 9 === 4)
        crowdScarf(out, x, y, L.lit(P.home), L.lit(P.chalk), L.lit(P.skinA));
    }
  }
  out.rect(70, 256, 150, 70, crowd);

  // the steward
  drawSteward(
    out,
    240,
    226,
    L.lit(P.goldLight),
    L.lit(P.chalk),
    L.lit(P.skinB),
    L.lit(P.night),
    L.lit(P.night),
  );

  // the dog: stand, trot a, trot b, sit, sit wag
  const dog = [
    L.lit(P.woodDark),
    L.lit(P.wood),
    L.lit(P.chalk),
    P.ink,
    L.lit(shade(P.wood, 0.25)),
    L.lit(shade(P.chalk, -0.2)),
  ];
  for (let f = 0; f < 5; f++) {
    drawDog(out, f, 284 + f * 26, 214, dog, false);
    drawDog(out, f, 284 + f * 26, 240, dog, true);
  }
  return out;
}

export const shots: ShotMap = {
  "ground/crowd": (ctx) => sheet(ctx),
};
