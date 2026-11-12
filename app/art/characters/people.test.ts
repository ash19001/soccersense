import { describe, expect, it } from "vitest";
import { Surface, TRANSPARENT, rgb, type Color } from "~/pixel";
import { KEEPER, PLAYER, YOUTH } from "../layout";
import { lightingFor, type Lighting } from "../lighting";
import { P } from "../palette";
import {
  BICYCLE_CELL,
  BICYCLE_YOUTH_CELL,
  HERO_LOOK,
  KEEPER_ANIMS,
  KICK_STRIKE_FRAME,
  PLAYER_ANIMS,
  SHOT_ANIMS,
  SPRAWL_CELL,
  STRIKE_FRAME,
  ballSpot,
  drawKeeper,
  drawMatchBall,
  drawPlayer,
  drawPuff,
  drawTrophy,
  handsSpot,
  keeperCell,
  keeperHands,
  litKit,
  makeKit,
  playerCell,
  type Kit,
  type KitBase,
  type KeeperAnim,
  type PlayerAnim,
} from "./index";
import {
  KEEPER_ANIM_NAMES,
  PLAYER_ANIM_NAMES,
  keeperSprite,
  playerSprite,
} from "./people";
import { KIT_BASES } from "./kit";

const DAY = lightingFor({ elevation: 45, morning: false });
const KIT = makeKit("home");
const SLOTS = Object.keys(KIT) as (keyof Kit)[];

/** Every painted pixel of a surface, as [x, y]. */
function painted(s: Surface): [number, number][] {
  const out: [number, number][] = [];
  for (let y = 0; y < s.h; y++) {
    for (let x = 0; x < s.w; x++) {
      if (s.get(x, y) !== TRANSPARENT) out.push([x, y]);
    }
  }
  return out;
}

function bounds(s: Surface) {
  const px = painted(s);
  const xs = px.map(([x]) => x);
  const ys = px.map(([, y]) => y);
  return {
    count: px.length,
    x0: Math.min(...xs),
    x1: Math.max(...xs),
    y0: Math.min(...ys),
    y1: Math.max(...ys),
  };
}

const X = 40;
const Y = 40;

function drawn(
  draw: (s: Surface) => void,
): ReturnType<typeof bounds> & { s: Surface } {
  const s = new Surface(80, 60);
  draw(s);
  return { ...bounds(s), s };
}

describe("animation tables", () => {
  it("every player animation has its declared frames, adult and youth", () => {
    for (const anim of PLAYER_ANIM_NAMES) {
      const n = PLAYER_ANIMS[anim].frames;
      expect(playerSprite(anim, false).frames.length, anim).toBe(n);
      expect(playerSprite(anim, true).frames.length, anim).toBe(n);
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
      expect(keeperSprite(anim).frames.length).toBe(kmin[anim]);
    }
  });

  it("uses the cell sizes from the layout, but for the bicycle and the sprawl", () => {
    for (const anim of PLAYER_ANIM_NAMES) {
      const big = anim === "bicycle";
      const adult = big ? BICYCLE_CELL : PLAYER;
      const youth = big ? BICYCLE_YOUTH_CELL : YOUTH;
      expect(playerCell(anim).cellW).toBe(adult.cellW);
      expect(playerCell(anim, true).cellH).toBe(youth.cellH);
      expect(playerSprite(anim).w).toBe(adult.cellW);
      expect(playerSprite(anim).h).toBe(adult.cellH);
      expect(playerSprite(anim, true).w).toBe(youth.cellW);
      expect(playerSprite(anim, true).h).toBe(youth.cellH);
    }
    for (const anim of KEEPER_ANIM_NAMES) {
      const cell = anim === "sprawl" ? SPRAWL_CELL : KEEPER;
      expect(keeperCell(anim).cellW).toBe(cell.cellW);
      expect(keeperSprite(anim).w).toBe(cell.cellW);
      expect(keeperSprite(anim).h).toBe(cell.cellH);
    }
    // Every cell is even, so a flipped spot is -dx - 1 and the anchor stays put.
    for (const c of [BICYCLE_CELL, BICYCLE_YOUTH_CELL, SPRAWL_CELL]) {
      expect(c.cellW % 2).toBe(0);
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
});

describe("drawing stays inside the cell", () => {
  for (const youth of [false, true]) {
    it(`${youth ? "youth" : "adult"}: every frame, both ways round`, () => {
      for (const anim of PLAYER_ANIM_NAMES) {
        const cell = playerCell(anim, youth);
        const left = X - Math.floor(cell.cellW / 2);
        for (let f = 0; f < PLAYER_ANIMS[anim].frames; f++) {
          for (const flipX of [false, true]) {
            const b = drawn((s) =>
              drawPlayer(s, anim, f, X, Y, KIT, { youth, flipX }),
            );
            const tag = `${anim} ${f} ${flipX}`;
            expect(b.count, tag).toBeGreaterThan(20);
            expect(b.x0, tag).toBeGreaterThanOrEqual(left);
            expect(b.x1, tag).toBeLessThan(left + cell.cellW);
            expect(b.y0, tag).toBeGreaterThanOrEqual(Y - cell.cellH);
            expect(b.y1, tag).toBeLessThan(Y);
          }
        }
      }
    });
  }

  it("keeper: every frame, both ways round", () => {
    for (const anim of KEEPER_ANIM_NAMES) {
      const cell = keeperCell(anim);
      const left = X - Math.floor(cell.cellW / 2);
      for (let f = 0; f < KEEPER_ANIMS[anim].frames; f++) {
        for (const flipX of [false, true]) {
          const b = drawn((s) =>
            drawKeeper(s, anim, f, X, Y, makeKit("keeper"), { flipX }),
          );
          expect(b.x0).toBeGreaterThanOrEqual(left);
          expect(b.x1).toBeLessThan(left + cell.cellW);
          expect(b.y0).toBeGreaterThanOrEqual(Y - cell.cellH);
          expect(b.y1).toBeLessThan(Y);
        }
      }
    }
  });

  it("standing frames stand on the ground row y - 1", () => {
    for (const youth of [false, true]) {
      for (const anim of [
        "idle",
        "run",
        "kick",
        "juggle",
        "tapin",
        "toepoke",
        "trivela",
        "chip",
        "power",
        "finesse",
        "bicycle",
      ] as PlayerAnim[]) {
        const b = drawn((s) => drawPlayer(s, anim, 0, X, Y, KIT, { youth }));
        expect(b.y1, anim).toBe(Y - 1);
      }
    }
    for (const anim of ["ready", "hold", "beaten"] as KeeperAnim[]) {
      const b = drawn((s) => drawKeeper(s, anim, 0, X, Y, makeKit("keeper")));
      expect(b.y1, anim).toBe(Y - 1);
    }
  });

  it("is outlined in the kit's outline colour", () => {
    const b = drawn((s) => drawPlayer(s, "idle", 0, X, Y, KIT));
    const soles = painted(b.s).filter(([, y]) => y === Y - 1);
    expect(soles.length).toBeGreaterThan(3);
    for (const [x, y] of soles) expect(b.s.get(x, y)).toBe(P.ink);
  });
});

describe("frames", () => {
  it("loops wrap and one-shots hold their last frame", () => {
    const at = (anim: PlayerAnim, f: number) =>
      drawn((s) => drawPlayer(s, anim, f, X, Y, KIT)).s.data.join();
    expect(at("run", 5)).toBe(at("run", 1));
    expect(at("run", -1)).toBe(at("run", 3));
    expect(at("kick", 99)).toBe(at("kick", PLAYER_ANIMS.kick.frames - 1));
    expect(at("kick", -3)).toBe(at("kick", 0));
  });

  it("frames of an animation differ from each other", () => {
    for (const youth of [false, true]) {
      for (const anim of PLAYER_ANIM_NAMES) {
        const seen = new Set<string>();
        for (let f = 0; f < PLAYER_ANIMS[anim].frames; f++) {
          seen.add(
            drawn((s) =>
              drawPlayer(s, anim, f, X, Y, KIT, { youth }),
            ).s.data.join(),
          );
        }
        // Juggle repeats its stance between touches; everything else is all new frames.
        const want = anim === "juggle" ? 5 : PLAYER_ANIMS[anim].frames;
        expect(seen.size, `${anim} ${youth}`).toBeGreaterThanOrEqual(want);
      }
    }
  });
});

describe("spots", () => {
  it("the ball is on his boot at the strike and on every juggle frame", () => {
    for (const youth of [false, true]) {
      expect(ballSpot("kick", KICK_STRIKE_FRAME, { youth })).not.toBeNull();
      for (let f = 0; f < PLAYER_ANIMS.juggle.frames; f++) {
        expect(ballSpot("juggle", f, { youth }), `${f}`).not.toBeNull();
      }
      expect(
        ballSpot("kick", PLAYER_ANIMS.kick.frames - 1, { youth }),
      ).toBeNull();
      expect(ballSpot("idle", 0, { youth })).toBeNull();
      expect(ballSpot("run", 0, { youth })).toBeNull();
    }
  });

  it("the strike spot sits against the kicking boot", () => {
    for (const youth of [false, true]) {
      const spot = ballSpot("kick", KICK_STRIKE_FRAME, { youth });
      if (spot === null) throw new Error("no spot");
      const { s } = drawn((sf) =>
        drawPlayer(sf, "kick", KICK_STRIKE_FRAME, X, Y, KIT, { youth }),
      );
      // Some boot pixel is within one pixel of the ball's 3 x 3.
      let near = false;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          if (s.get(X + spot.x + dx, Y + spot.y + dy) === KIT.boots)
            near = true;
        }
      }
      expect(near, `${youth}`).toBe(true);
      expect(spot.y).toBe(-2); // a ball at rest: its bottom row is on the ground
    }
  });

  it("every shot has the ball on him at the strike, and loose after it", () => {
    for (const youth of [false, true]) {
      for (const anim of SHOT_ANIMS) {
        const strike = STRIKE_FRAME[anim];
        const spot = ballSpot(anim, strike, { youth });
        if (spot === null) throw new Error(`${anim} ${youth}: no strike spot`);
        const { s } = drawn((sf) =>
          drawPlayer(sf, anim, strike, X, Y, KIT, { youth }),
        );
        let near = false;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            if (s.get(X + spot.x + dx, Y + spot.y + dy) === KIT.boots)
              near = true;
          }
        }
        expect(near, `${anim} ${youth}`).toBe(true);
        // On the ground for every shot but the bicycle, struck over his head.
        if (anim === "bicycle") expect(spot.y).toBeLessThan(youth ? -14 : -18);
        else expect(spot.y, anim).toBe(-2);
        for (let f = 0; f < strike; f++) {
          expect(ballSpot(anim, f, { youth }), `${anim} ${f}`).not.toBeNull();
        }
        for (let f = strike + 1; f < PLAYER_ANIMS[anim].frames; f++) {
          expect(ballSpot(anim, f, { youth }), `${anim} ${f}`).toBeNull();
        }
      }
    }
  });

  it("the bicycle starts with the ball on his chest", () => {
    for (const youth of [false, true]) {
      const spot = ballSpot("bicycle", 0, { youth });
      if (spot === null) throw new Error("no chest spot");
      const { s } = drawn((sf) =>
        drawPlayer(sf, "bicycle", 0, X, Y, KIT, { youth }),
      );
      let shirt = false;
      for (let dx = 1; dx <= 3; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const c = s.get(X + spot.x + dx, Y + spot.y + dy);
          if (c === KIT.shirt || c === KIT.shirtShade) shirt = true;
        }
      }
      expect(shirt, `${youth}`).toBe(true);
    }
  });

  it("hands hold the trophy for every lift frame, and only then", () => {
    for (const youth of [false, true]) {
      for (let f = 0; f < PLAYER_ANIMS.lift.frames; f++) {
        expect(handsSpot("lift", f, { youth })).not.toBeNull();
      }
      expect(handsSpot("celebrate", 0, { youth })).toBeNull();
    }
  });

  it("flipX mirrors the spots exactly as it mirrors the pixels", () => {
    const check = (
      spot: { x: number; y: number } | null,
      flipped: { x: number; y: number } | null,
    ) => {
      if (spot === null) {
        expect(flipped).toBeNull();
        return;
      }
      expect(flipped).toEqual({ x: -spot.x - 1, y: spot.y });
    };
    for (const youth of [false, true]) {
      for (const anim of PLAYER_ANIM_NAMES) {
        for (let f = 0; f < PLAYER_ANIMS[anim].frames; f++) {
          check(
            ballSpot(anim, f, { youth }),
            ballSpot(anim, f, { youth, flipX: true }),
          );
          check(
            handsSpot(anim, f, { youth }),
            handsSpot(anim, f, { youth, flipX: true }),
          );
        }
      }
    }
    for (const anim of KEEPER_ANIM_NAMES) {
      for (let f = 0; f < KEEPER_ANIMS[anim].frames; f++) {
        check(keeperHands(anim, f), keeperHands(anim, f, { flipX: true }));
      }
    }
    // And the pixels: column x + dx facing right is column x - dx - 1 facing left.
    const mirror = (draw: (s: Surface, flipX: boolean) => void, w: number) => {
      const a = drawn((s) => draw(s, false)).s;
      const b = drawn((s) => draw(s, true)).s;
      for (let y = Y - 28; y < Y; y++) {
        for (let dx = -w / 2; dx < w / 2; dx++) {
          expect(b.get(X - dx - 1, y)).toBe(a.get(X + dx, y));
        }
      }
    };
    mirror((s, flipX) => drawPlayer(s, "kick", 1, X, Y, KIT, { flipX }), 16);
    mirror((s, flipX) => drawPlayer(s, "bicycle", 4, X, Y, KIT, { flipX }), 24);
    mirror(
      (s, flipX) =>
        drawKeeper(s, "sprawl", 1, X, Y, makeKit("keeper"), { flipX }),
      24,
    );
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

  it("each glove spot is on or beside a glove pixel", () => {
    const kit = makeKit("keeper");
    for (const anim of KEEPER_ANIM_NAMES) {
      for (let f = 0; f < KEEPER_ANIMS[anim].frames; f++) {
        const g = keeperHands(anim, f);
        if (g === null) continue;
        const { s } = drawn((sf) => drawKeeper(sf, anim, f, X, Y, kit));
        let near = false;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (s.get(X + g.x + dx, Y + g.y + dy) === kit.gloves) near = true;
          }
        }
        expect(near, `${anim} ${f}`).toBe(true);
      }
    }
  });
});

describe("the trivela and the toe poke", () => {
  const moves = [
    { anim: "trivela", frames: 6, fps: 10, strike: 2 },
    { anim: "toepoke", frames: 5, fps: 10, strike: 1 },
  ] as const;

  it("are shots with their frames, rates and strike frames", () => {
    for (const m of moves) {
      expect(SHOT_ANIMS).toContain(m.anim);
      expect(PLAYER_ANIMS[m.anim]).toEqual({
        frames: m.frames,
        fps: m.fps,
        loop: false,
      });
      expect(STRIKE_FRAME[m.anim]).toBe(m.strike);
      for (const youth of [false, true]) {
        expect(playerSprite(m.anim, youth).frames.length).toBe(m.frames);
      }
    }
  });

  it("use the standard cells", () => {
    for (const m of moves) {
      expect(playerCell(m.anim)).toBe(PLAYER);
      expect(playerCell(m.anim, true)).toBe(YOUTH);
    }
  });

  it("keep the ball at rest in front of him until the strike", () => {
    for (const m of moves) {
      for (const youth of [false, true]) {
        for (let f = 0; f < m.frames; f++) {
          const b = ballSpot(m.anim, f, { youth });
          if (f <= m.strike)
            expect(b, `${m.anim} ${f}`).toEqual({ x: 7, y: -2 });
          else expect(b, `${m.anim} ${f}`).toBeNull();
          const flipped = ballSpot(m.anim, f, { youth, flipX: true });
          if (f <= m.strike) expect(flipped).toEqual({ x: -8, y: -2 });
          else expect(flipped).toBeNull();
        }
      }
    }
  });

  it("strike with the boot against the ball", () => {
    for (const m of moves) {
      for (const youth of [false, true]) {
        const { s } = drawn((sf) =>
          drawPlayer(sf, m.anim, m.strike, X, Y, KIT, { youth }),
        );
        // the boot's furthest pixel is the column just left of the ball's 3 x 3
        let reach = -99;
        for (const [x, y] of painted(s)) {
          if (s.get(x, y) === KIT.boots) reach = Math.max(reach, x - X);
        }
        expect(reach, `${m.anim} ${youth}`).toBe(5);
      }
    }
  });

  it("mirror pixel for pixel, adult and youth", () => {
    for (const m of moves) {
      for (const youth of [false, true]) {
        const w = playerCell(m.anim, youth).cellW;
        for (let f = 0; f < m.frames; f++) {
          const a = drawn((sf) =>
            drawPlayer(sf, m.anim, f, X, Y, KIT, { youth }),
          ).s;
          const b = drawn((sf) =>
            drawPlayer(sf, m.anim, f, X, Y, KIT, { youth, flipX: true }),
          ).s;
          for (let y = Y - 20; y < Y; y++) {
            for (let dx = -w / 2; dx < w / 2; dx++) {
              expect(b.get(X - dx - 1, y)).toBe(a.get(X + dx, y));
            }
          }
        }
      }
    }
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

  it("only the keeper wears gloves; a child in his kit has them on the youth frames", () => {
    for (const base of KIT_BASES) {
      const k = makeKit(base, { look: 2 });
      if (base === "keeper") expect(k.gloves).not.toBe(k.skin);
      else expect(k.gloves, base).toBe(k.skin);
    }
    const keeper = makeKit("keeper");
    for (const anim of ["idle", "celebrate", "run"] as PlayerAnim[]) {
      const { s } = drawn((sf) =>
        drawPlayer(sf, anim, 0, X, Y, keeper, { youth: true }),
      );
      const gloves = painted(s).filter(
        ([x, y]) => s.get(x, y) === keeper.gloves,
      );
      expect(gloves.length, anim).toBeGreaterThan(0);
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

describe("props", () => {
  it("the match ball is 3 x 3 round its centre, in 3 spin frames", () => {
    const frames = new Set<string>();
    for (let f = 0; f < 3; f++) {
      for (const gold of [false, true]) {
        const b = drawn((s) => drawMatchBall(s, X, Y, f, DAY, { gold }));
        expect([b.x0, b.x1, b.y0, b.y1]).toEqual([X - 1, X + 1, Y - 1, Y + 1]);
        expect(b.count).toBe(9);
        frames.add(b.s.data.join());
      }
    }
    expect(frames.size).toBe(6);
  });

  it("the trophy is 9 x 12 standing on (x, y), with a glint frame", () => {
    const a = drawn((s) => drawTrophy(s, X, Y, DAY));
    expect([a.x0, a.x1, a.y0, a.y1]).toEqual([X - 4, X + 4, Y - 12, Y - 1]);
    const g = drawn((s) => drawTrophy(s, X, Y, DAY, true));
    expect(g.s.data.join()).not.toBe(a.s.data.join());
    expect(painted(g.s).some(([x, y]) => g.s.get(x, y) === P.white)).toBe(true);
  });

  it("the puff is three frames of one colour on the ground point", () => {
    for (let f = 0; f < 3; f++) {
      const b = drawn((s) => drawPuff(s, X, Y, f, P.chalk));
      expect(b.count).toBeGreaterThan(0);
      expect(b.x0).toBeGreaterThanOrEqual(X - 3);
      expect(b.x1).toBeLessThanOrEqual(X + 3);
      expect(b.y0).toBeGreaterThanOrEqual(Y - 5);
      expect(b.y1).toBeLessThan(Y);
      for (const [x, y] of painted(b.s)) expect(b.s.get(x, y)).toBe(P.chalk);
    }
    expect(drawn((s) => drawPuff(s, X, Y, 3, P.chalk)).count).toBe(0);
  });
});
