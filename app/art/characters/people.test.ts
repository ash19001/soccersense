/**
 * The people: animation tables, cells, drawing, spots and kits, for every animation. The
 * youth's moves and the shots have their own files (youth.test.ts, adult-shots.test.ts,
 * youth-shots.test.ts), the keeper and the props keeper.test.ts.
 */

import { describe, expect, it } from "vitest";
import { Surface, TRANSPARENT, rgb, type Color } from "~/pixel";
import { castSpots } from "~/scenes/career-cast";
import { FAN, KEEPER, MATCH_BALL, PLAYER, TROPHY, YOUTH } from "../layout";
import { lightingFor, type Lighting } from "../lighting";
import { P } from "../palette";
import { LEGEND } from "./figure";
import {
  HERO_LOOK,
  KIT_BASES,
  kitColors,
  litKit,
  makeKit,
  type Kit,
  type KitBase,
} from "./kit";
import {
  BICYCLE_CELL,
  BICYCLE_YOUTH_CELL,
  KEEPER_ANIMS,
  KEEPER_ANIM_NAMES,
  KICK_STRIKE_FRAME,
  PLAYER_ANIMS,
  PLAYER_ANIM_NAMES,
  SHOT_ANIMS,
  SPRAWL_CELL,
  STRIKE_FRAME,
  ballSpot,
  drawKeeper,
  drawPlayer,
  handsSpot,
  keeperCell,
  keeperHands,
  keeperSprite,
  playerCell,
  playerSprite,
  type KeeperAnim,
  type PlayerAnim,
} from "./people";

const DAY = lightingFor({ elevation: 45, morning: false });
const KIT = makeKit("home");
/** The colour slots (today's kit has no era fields). */
const SLOTS = Object.keys(KIT) as Exclude<
  keyof Kit,
  "era" | "eraColors" | "eraGlows"
>[];
const X = 60;
const Y = 70;

/** The moves: every animation but the shots. */
const MOVES: readonly PlayerAnim[] = [
  "idle",
  "run",
  "kick",
  "juggle",
  "celebrate",
  "dejected",
  "lift",
  "shrug",
  "slide",
];

function painted(s: Surface): [number, number][] {
  const out: [number, number][] = [];
  for (let y = 0; y < s.h; y++) {
    for (let x = 0; x < s.w; x++) {
      if (s.get(x, y) !== TRANSPARENT) out.push([x, y]);
    }
  }
  return out;
}

function drawn(draw: (s: Surface) => void) {
  const s = new Surface(120, 90);
  draw(s);
  const px = painted(s);
  const xs = px.map(([x]) => x);
  const ys = px.map(([, y]) => y);
  return {
    s,
    count: px.length,
    x0: Math.min(...xs),
    x1: Math.max(...xs),
    y0: Math.min(...ys),
    y1: Math.max(...ys),
  };
}

describe("sizes", () => {
  it("the layout's sprite sizes are the art bible's", () => {
    expect(PLAYER).toEqual({ w: 24, h: 36, cellW: 32, cellH: 40 });
    expect(YOUTH).toEqual({ w: 20, h: 28, cellW: 28, cellH: 32 });
    expect(KEEPER).toBe(PLAYER);
    expect(MATCH_BALL).toEqual({ size: 6, shadow: 2 });
    expect(FAN).toEqual({ w: 6, h: 8, pitch: 8 });
    expect(TROPHY).toEqual({ w: 18, h: 24 });
  });

  it("cells are the layout's, but for the bicycle and the sprawl", () => {
    for (const anim of PLAYER_ANIM_NAMES) {
      const big = anim === "bicycle";
      expect(playerCell(anim)).toBe(big ? BICYCLE_CELL : PLAYER);
      expect(playerCell(anim, true)).toBe(big ? BICYCLE_YOUTH_CELL : YOUTH);
    }
    expect(BICYCLE_CELL).toEqual({ cellW: 48, cellH: 56 });
    expect(BICYCLE_YOUTH_CELL).toEqual({ cellW: 40, cellH: 44 });
    expect(SPRAWL_CELL).toEqual({ cellW: 48, cellH: 40 });
    for (const anim of KEEPER_ANIM_NAMES) {
      expect(keeperCell(anim)).toBe(anim === "sprawl" ? SPRAWL_CELL : KEEPER);
    }
    // Every cell is even, so the anchor column is the cell's middle.
    for (const c of [BICYCLE_CELL, BICYCLE_YOUTH_CELL, SPRAWL_CELL]) {
      expect(c.cellW % 2).toBe(0);
    }
  });

  it("the legend has the kit's slots and seven tones more, all coloured by kitColors", () => {
    // then the eras' twelve slots (.snaps/era-art/THEME.md): unused, so empty, today
    expect(LEGEND).toBe("khsStTrpqoObgGHmURBwl" + "123456789ACD");
    for (const base of KIT_BASES) {
      const kit = makeKit(base);
      const colors = kitColors(kit);
      expect(colors.length).toBe(LEGEND.length);
      expect(colors.slice(0, 3)).toEqual([kit.outline, kit.hair, kit.skin]);
      for (const c of colors.slice(0, 21)) expect(c).not.toBe(TRANSPARENT);
      for (const c of colors.slice(21)) expect(c).toBe(TRANSPARENT);
    }
  });
});

describe("animation tables", () => {
  it("every animation is drawn with its declared frames, in its cell and the legend", () => {
    for (const youth of [false, true]) {
      for (const anim of PLAYER_ANIM_NAMES) {
        const sp = playerSprite(anim, youth);
        const cell = playerCell(anim, youth);
        expect(sp.frames.length, anim).toBe(PLAYER_ANIMS[anim].frames);
        expect(sp.w, anim).toBe(cell.cellW);
        expect(sp.h, anim).toBe(cell.cellH);
        expect(sp.legend).toBe(LEGEND);
      }
    }
    for (const anim of KEEPER_ANIM_NAMES) {
      const sp = keeperSprite(anim);
      expect(sp.frames.length, anim).toBe(KEEPER_ANIMS[anim].frames);
      expect(sp.w, anim).toBe(keeperCell(anim).cellW);
    }
  });

  it("has at least the minimum frames asked for", () => {
    const min: Record<PlayerAnim, number> = {
      idle: 2,
      run: 4,
      kick: 4,
      juggle: 4,
      celebrate: 3,
      dejected: 2,
      lift: 2,
      shrug: 2,
      slide: 2,
      tapin: 3,
      toepoke: 4,
      trivela: 5,
      chip: 4,
      power: 5,
      finesse: 4,
      bicycle: 7,
    };
    for (const anim of PLAYER_ANIM_NAMES) {
      expect(PLAYER_ANIMS[anim].frames).toBeGreaterThanOrEqual(min[anim]);
    }
    const kmin: Record<KeeperAnim, number> = {
      ready: 2,
      leap: 3,
      smother: 2,
      hold: 1,
      beaten: 1,
      stranded: 3,
      sprawl: 3,
    };
    for (const anim of KEEPER_ANIM_NAMES) {
      expect(KEEPER_ANIMS[anim].frames).toBe(kmin[anim]);
    }
  });

  it("rates are character rates and the strike frame is in the kick", () => {
    for (const anim of PLAYER_ANIM_NAMES) {
      expect(PLAYER_ANIMS[anim].fps).toBeGreaterThan(0);
      expect(PLAYER_ANIMS[anim].fps).toBeLessThanOrEqual(10);
    }
    expect(KICK_STRIKE_FRAME).toBeGreaterThan(0);
    expect(KICK_STRIKE_FRAME).toBeLessThan(PLAYER_ANIMS.kick.frames);
    expect(STRIKE_FRAME.kick).toBe(KICK_STRIKE_FRAME);
    for (const anim of SHOT_ANIMS) {
      expect(PLAYER_ANIMS[anim].loop, anim).toBe(false);
      expect(STRIKE_FRAME[anim], anim).toBeGreaterThan(0);
      expect(STRIKE_FRAME[anim], anim).toBeLessThan(PLAYER_ANIMS[anim].frames);
    }
  });

  it("loops wrap and one-shots hold their last frame", () => {
    const at = (anim: PlayerAnim, f: number) =>
      drawn((s) => drawPlayer(s, anim, f, X, Y, KIT)).s.data.join();
    expect(at("run", 5)).toBe(at("run", 1));
    expect(at("run", -1)).toBe(at("run", 3));
    expect(at("kick", 99)).toBe(at("kick", PLAYER_ANIMS.kick.frames - 1));
    expect(at("kick", -3)).toBe(at("kick", 0));
  });
});

describe("drawing", () => {
  for (const youth of [false, true]) {
    it(`${youth ? "youth" : "adult"}: every frame stays inside its cell, both ways round`, () => {
      for (const anim of PLAYER_ANIM_NAMES) {
        const cell = playerCell(anim, youth);
        const left = X - cell.cellW / 2;
        for (let f = 0; f < PLAYER_ANIMS[anim].frames; f++) {
          for (const flipX of [false, true]) {
            const b = drawn((s) =>
              drawPlayer(s, anim, f, X, Y, KIT, { youth, flipX }),
            );
            const tag = `${anim} ${f} ${flipX}`;
            expect(b.count, tag).toBeGreaterThan(80);
            expect(b.x0, tag).toBeGreaterThanOrEqual(left);
            expect(b.x1, tag).toBeLessThan(left + cell.cellW);
            expect(b.y0, tag).toBeGreaterThanOrEqual(Y - cell.cellH);
            expect(b.y1, tag).toBeLessThan(Y);
          }
        }
      }
    });
  }

  it("keeper: every frame stays inside its cell, both ways round", () => {
    const kit = makeKit("keeper");
    for (const anim of KEEPER_ANIM_NAMES) {
      const cell = keeperCell(anim);
      const left = X - cell.cellW / 2;
      for (let f = 0; f < KEEPER_ANIMS[anim].frames; f++) {
        for (const flipX of [false, true]) {
          const b = drawn((s) => drawKeeper(s, anim, f, X, Y, kit, { flipX }));
          expect(b.x0).toBeGreaterThanOrEqual(left);
          expect(b.x1).toBeLessThan(left + cell.cellW);
          expect(b.y0).toBeGreaterThanOrEqual(Y - cell.cellH);
          expect(b.y1).toBeLessThan(Y);
        }
      }
    }
  });

  it("standing frames stand on the ground row y - 1", () => {
    for (const anim of [
      "idle",
      "run",
      "kick",
      "juggle",
      "dejected",
      "shrug",
    ] as PlayerAnim[]) {
      for (let f = 0; f < PLAYER_ANIMS[anim].frames; f++) {
        if (anim === "run" && f % 2 === 1) continue; // the passing frames are in the air
        const b = drawn((s) => drawPlayer(s, anim, f, X, Y, KIT));
        expect(b.y1, `${anim} ${f}`).toBe(Y - 1);
      }
    }
    for (const anim of ["ready", "hold", "beaten"] as KeeperAnim[]) {
      const b = drawn((s) => drawKeeper(s, anim, 0, X, Y, makeKit("keeper")));
      expect(b.y1, anim).toBe(Y - 1);
    }
  });

  it("the celebration jumps 6 rows on its middle frame", () => {
    const b = drawn((s) => drawPlayer(s, "celebrate", 1, X, Y, KIT));
    expect(b.y1).toBe(Y - 1 - 6);
  });

  it("is outlined in the kit's outline colour, and painted in kit colours only", () => {
    const b = drawn((s) => drawPlayer(s, "idle", 0, X, Y, KIT));
    const soles = painted(b.s).filter(([, y]) => y === Y - 1);
    expect(soles.length).toBeGreaterThan(6);
    for (const [x, y] of soles) expect(b.s.get(x, y)).toBe(KIT.outline);
    for (const base of KIT_BASES) {
      const kit = makeKit(base, { look: 2 });
      const allowed = new Set<Color>(kitColors(kit));
      for (const anim of MOVES) {
        for (let f = 0; f < PLAYER_ANIMS[anim].frames; f++) {
          const { s } = drawn((sf) => drawPlayer(sf, anim, f, X, Y, kit));
          for (const [x, y] of painted(s)) {
            expect(allowed.has(s.get(x, y)), `${base} ${anim} ${f}`).toBe(true);
          }
        }
      }
    }
  });

  it("frames of a move differ from each other", () => {
    for (const anim of MOVES) {
      const seen = new Set<string>();
      for (let f = 0; f < PLAYER_ANIMS[anim].frames; f++) {
        seen.add(drawn((s) => drawPlayer(s, anim, f, X, Y, KIT)).s.data.join());
      }
      // Juggle repeats its stance between touches; everything else is all new frames.
      const want = anim === "juggle" ? 5 : PLAYER_ANIMS[anim].frames;
      expect(seen.size, anim).toBeGreaterThanOrEqual(want);
    }
  });

  it("draws the same pixels for the same inputs", () => {
    for (const anim of MOVES) {
      const a = drawn((s) => drawPlayer(s, anim, 1, X, Y, KIT)).s.data.join();
      const b = drawn((s) => drawPlayer(s, anim, 1, X, Y, KIT)).s.data.join();
      expect(a).toBe(b);
    }
  });
});

describe("spots", () => {
  /** True if some pixel of `colors` is within `r` of the 6 x 6 ball centred on the spot. */
  function touches(
    s: Surface,
    spot: { x: number; y: number },
    colors: readonly Color[],
    r = 1,
  ): boolean {
    for (let dy = -3 - r; dy <= 2 + r; dy++) {
      for (let dx = -3 - r; dx <= 2 + r; dx++) {
        if (colors.includes(s.get(X + spot.x + dx, Y + spot.y + dy)))
          return true;
      }
    }
    return false;
  }

  it("the kick's ball rests on the grass and the near boot meets it on the strike", () => {
    for (let f = 0; f <= KICK_STRIKE_FRAME; f++) {
      expect(ballSpot("kick", f)).toEqual({ x: 14, y: -4 });
    }
    expect(ballSpot("kick", PLAYER_ANIMS.kick.frames - 1)).toBeNull();
    const spot = ballSpot("kick", KICK_STRIKE_FRAME)!;
    const { s } = drawn((sf) =>
      drawPlayer(sf, "kick", KICK_STRIKE_FRAME, X, Y, KIT),
    );
    expect(touches(s, spot, [KIT.boots], 0)).toBe(true);
    // Facing left the ball covers exactly the mirror of its columns facing right.
    const left = ballSpot("kick", KICK_STRIKE_FRAME, { flipX: true })!;
    const m = drawn((sf) =>
      drawPlayer(sf, "kick", KICK_STRIKE_FRAME, X, Y, KIT, { flipX: true }),
    ).s;
    for (let dy = -3; dy <= 2; dy++) {
      for (let dx = -4; dx <= 3; dx++) {
        expect(m.get(X + left.x + dx, Y + left.y + dy)).toBe(
          s.get(X + spot.x - dx - 1, Y + spot.y + dy),
        );
      }
    }
  });

  it("the juggle's ball is on his boot, knee and head on the touches", () => {
    const body = [KIT.boots, KIT.skin, KIT.hair];
    for (let f = 0; f < PLAYER_ANIMS.juggle.frames; f++) {
      const spot = ballSpot("juggle", f);
      expect(spot, `${f}`).not.toBeNull();
      if (f % 2 === 1 && f !== 5) continue;
      if (f === 5) continue; // the top of the big hop: in the air
      const { s } = drawn((sf) => drawPlayer(sf, "juggle", f, X, Y, KIT));
      expect(touches(s, spot!, body), `${f}`).toBe(true);
    }
  });

  it("the lift's hands hold the trophy's foot on both frames", () => {
    for (let f = 0; f < PLAYER_ANIMS.lift.frames; f++) {
      const h = handsSpot("lift", f)!;
      const { s } = drawn((sf) => drawPlayer(sf, "lift", f, X, Y, KIT));
      // His fists are on the trophy's foot row (y + h.y - 1), one each side of it.
      const row = Y + h.y - 1;
      const skin = (x: number) =>
        [KIT.skin, KIT.skinShade].includes(s.get(x, row));
      let left = false;
      let right = false;
      for (let dx = -10; dx < 0; dx++) left ||= skin(X + h.x + dx);
      for (let dx = 1; dx <= 10; dx++) right ||= skin(X + h.x + dx);
      expect(left && right, `${f}`).toBe(true);
    }
  });

  it("hands hold the trophy only in the lift", () => {
    for (const youth of [false, true]) {
      for (const anim of PLAYER_ANIM_NAMES) {
        for (let f = 0; f < PLAYER_ANIMS[anim].frames; f++) {
          const h = handsSpot(anim, f, { youth });
          if (anim === "lift") expect(h, `${anim} ${f}`).not.toBeNull();
          else expect(h, `${anim} ${f}`).toBeNull();
        }
      }
    }
  });

  it("flipX mirrors the spots (-dx: they mark even-sized things) as it mirrors the pixels", () => {
    for (const youth of [false, true]) {
      for (const anim of PLAYER_ANIM_NAMES) {
        for (let f = 0; f < PLAYER_ANIMS[anim].frames; f++) {
          for (const get of [ballSpot, handsSpot]) {
            const a = get(anim, f, { youth });
            const b = get(anim, f, { youth, flipX: true });
            if (a === null) expect(b).toBeNull();
            else expect(b).toEqual({ x: -a.x, y: a.y });
          }
        }
      }
    }
    for (const anim of KEEPER_ANIM_NAMES) {
      for (let f = 0; f < KEEPER_ANIMS[anim].frames; f++) {
        const a = keeperHands(anim, f);
        const b = keeperHands(anim, f, { flipX: true });
        if (a === null) expect(b).toBeNull();
        else expect(b).toEqual({ x: -a.x, y: a.y });
      }
    }
    for (const anim of MOVES) {
      const a = drawn((s) => drawPlayer(s, anim, 1, X, Y, KIT)).s;
      const b = drawn((s) =>
        drawPlayer(s, anim, 1, X, Y, KIT, { flipX: true }),
      ).s;
      for (let y = Y - 40; y < Y; y++) {
        for (let dx = -16; dx < 16; dx++) {
          expect(b.get(X - dx - 1, y)).toBe(a.get(X + dx, y));
        }
      }
    }
  });

  it("the keeper's gloves are known on every frame but the beaten one", () => {
    for (const anim of KEEPER_ANIM_NAMES) {
      for (let f = 0; f < KEEPER_ANIMS[anim].frames; f++) {
        const g = keeperHands(anim, f);
        if (anim === "beaten") expect(g).toBeNull();
        else expect(g, `${anim} ${f}`).not.toBeNull();
      }
    }
  });

  it("the career cast reads its spots from here", () => {
    const two = castSpots();
    expect(castSpots()).toBe(two);
    for (let f = 0; f < 8; f++) {
      const s = ballSpot("juggle", f)!;
      expect(two.JUGGLE_X[f]).toBe(s.x);
      expect(two.JUGGLE_Y[f]).toBe(s.y);
    }
    expect(two.KICK_DX).toBe(14);
    expect(two.KICK_DY).toBe(-4);
    expect(two.KICK_LEFT_DX).toBe(-14);
    expect(two.LIFT[1]).toBe(-34);
  });
});

describe("kits", () => {
  const key = (k: Kit) =>
    [k.shirt, k.shirtShade, k.trim, k.shorts, k.socks].join();

  it("every base is its own kit", () => {
    const seen = new Map<string, KitBase>();
    for (const base of KIT_BASES) {
      const k = key(makeKit(base));
      expect(seen.get(k), base).toBeUndefined();
      seen.set(k, base);
    }
  });

  it("every kit has distinct tones where they meet", () => {
    for (const base of KIT_BASES) {
      for (const look of [0, 1, 2] as const) {
        const k = makeKit(base, { look });
        expect(k.shirt, base).not.toBe(k.shirtShade);
        expect(k.skin, base).not.toBe(k.skinShade);
        expect(k.shirt, base).not.toBe(k.shorts);
        expect(k.shirt, base).not.toBe(k.trim);
        expect(k.socks, base).not.toBe(k.boots);
        expect(k.hair, base).not.toBe(k.skin);
        expect(k.outline).toBe(P.ink);
      }
    }
  });

  it("HOME is warm, AWAY is teal, the keeper wears a colour nobody else does", () => {
    expect(makeKit("home").shirt).toBe(P.home);
    expect(makeKit("away").shirt).toBe(P.away);
    expect(makeKit("casual-home").shirt).toBe(P.home);
    expect(makeKit("casual-away").shirt).toBe(P.away);
    expect(makeKit("national-home").trim).toBe(P.home);
    expect(makeKit("national-away").trim).toBe(P.away);
    const keeper = makeKit("keeper").shirt;
    for (const base of KIT_BASES) {
      if (base === "keeper") continue;
      for (let v = 0; v < 12; v++) {
        expect(makeKit(base, { variant: v }).shirt, base).not.toBe(keeper);
      }
    }
    const rival = makeKit("rival").shirt;
    for (const c of [P.home, P.away, P.homeDark, P.awayDark, P.grass]) {
      expect(rival).not.toBe(c);
    }
  });

  it("looks change skin and hair only; the hero's is fixed", () => {
    const looks = ([0, 1, 2] as const).map((look) => makeKit("home", { look }));
    expect(new Set(looks.map((k) => k.skin)).size).toBe(3);
    expect(looks[0].shirt).toBe(looks[2].shirt);
    expect(makeKit("home")).toEqual(makeKit("home", { look: HERO_LOOK }));
    expect(makeKit("casual-home").skin).toBe(makeKit("home").skin);
  });

  it("only the keeper wears gloves", () => {
    for (const base of KIT_BASES) {
      const k = makeKit(base, { look: 2 });
      if (base === "keeper") expect(k.gloves).not.toBe(k.skin);
      else expect(k.gloves, base).toBe(k.skin);
    }
  });

  it("casual variants give different tops", () => {
    const tops = new Set<Color>();
    for (let v = 0; v < 6; v++)
      tops.add(makeKit("casual", { variant: v }).shirt);
    expect(tops.size).toBe(6);
  });

  it("litKit grades every slot through light.lit", () => {
    const marker = rgb(0x123456);
    const fake: Lighting = { ...DAY, lit: () => marker };
    const lit = litKit(makeKit("away"), fake);
    for (const slot of SLOTS) expect(lit[slot], slot).toBe(marker);
    const night = lightingFor({ elevation: -30, morning: false });
    const k = makeKit("home");
    const n = litKit(k, night);
    for (const slot of SLOTS) expect(n[slot], slot).toBe(night.lit(k[slot]));
  });
});
