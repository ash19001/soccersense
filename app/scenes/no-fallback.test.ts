// @vitest-environment node
/**
 * Nothing any player can see is drawn in the old, coarse lettering (the check made when the
 * art was redrawn at twice the detail, DECISIONS.md 7, kept since). Plays the home page (day,
 * dusk and night: the intro, both kick-offs, the airship poked, popped and crashed, the
 * mascot's tricks) and the career at every tier (idle, HOME and AWAY, every kind of shot,
 * every promotion, full time at tiers 0, 4 and 7) on monitor and phone canvases, and lists
 * every painted word in the small faces (`FONT_3x5`, `FONT_5x7`) rather than the painted ones
 * (`font6x10`, `font10x14`), unless it is lamps: a small face at scale 2 with dots,
 * DECISIONS.md 1. The list must be empty. Records `drawSprite` and `drawText` through a mock
 * of the pixel engine's modules, so nothing in the art is changed for it.
 */

import { describe, expect, test, vi } from "vitest";

const rec = {
  /** Sprites drawn, and where from (to show the recording saw the drawing). */
  sprites: new Map<object, string>(),
  /** The small faces as painted words: "FONT_.. scale .. <- painter". */
  words: new Set<string>(),
};

/** The first frame of the stack outside the pixel engine and this file: the painter. */
function painter(): string {
  const stack = new Error().stack?.split("\n") ?? [];
  for (const line of stack.slice(2)) {
    if (/[\\/]pixel[\\/]|no-fallback|node_modules/.test(line)) {
      continue;
    }
    const m = /at (?:(\S+) )?\(?(?:.*[\\/])?(app[\\/][^:)]+):(\d+)/.exec(line);
    if (m) return `${m[1] ?? "?"} (${m[2].replace(/\\/g, "/")}:${m[3]})`;
  }
  return "?";
}

vi.mock("~/pixel/sprite", async (importOriginal) => {
  const real = await importOriginal<typeof import("~/pixel/sprite")>();
  return {
    ...real,
    drawSprite: (...a: Parameters<typeof real.drawSprite>): void => {
      if (!rec.sprites.has(a[1])) rec.sprites.set(a[1], painter());
      real.drawSprite(...a);
    },
  };
});

/**
 * A small face solid at scale 2 is the glow under a line of lamps (led.ts, the LED boards)
 * when the same words are then drawn as lamps at the same place: kept here until they are.
 */
const glows = new Map<string, string>();

vi.mock("~/pixel/text", async (importOriginal) => {
  const real = await importOriginal<typeof import("~/pixel/text")>();
  return {
    ...real,
    drawText: (...a: Parameters<typeof real.drawText>): number => {
      const o = a[5];
      const font = o?.font ?? real.FONT_5x7;
      const scale = o?.scale ?? 1;
      const small = font === real.FONT_3x5 || font === real.FONT_5x7;
      const key = `${a[1]}|${Math.round(a[2])}|${Math.round(a[3])}`;
      if (small && scale >= 2 && o?.dots === true) {
        glows.delete(key);
      } else if (small) {
        const name = font === real.FONT_3x5 ? "FONT_3x5" : "FONT_5x7";
        const label = `${name} scale ${scale} <- ${painter()}`;
        if (scale >= 2) glows.set(key, label);
        else rec.words.add(label);
      }
      return real.drawText(...a);
    },
  };
});

/**
 * A small face by design, not a fallback (reviewed): the lamps' mask, the small face drawn
 * once off screen with each of its pixels then a lamp (led.ts `lampLayer`,
 * DECISIONS.md 1 as the polish round brightened it). The podium's place numbers used to be
 * listed here; they are drawn as native shapes now.
 */
const BY_DESIGN = [
  /^FONT_(3x5|5x7) scale 1 <- lampLayer \(app\/art\/led\.ts:/,
  // the plane's banner: the main face's 7 px capitals since 2026-11-13 (the product
  // owner: "smaller daily facts on plane")
  /^FONT_5x7 scale 1 <- paintBanner \(app\/art\/stadium-plane\.ts:/,
];

const { lightingFor } = await import("~/art/lighting");
const { MenuBackdrop } = await import("~/art/stadium");
const { Surface } = await import("~/pixel");
const { CareerScene } = await import("./career");
const { MenuScene } = await import("./menu");

type Grade = import("~/game").Grade;
type Mode = import("~/game").Mode;
type Lighting = import("~/art/lighting").Lighting;

const STEP = 1 / 60;
const DAY = lightingFor({ elevation: 40, morning: false });
const DUSK = lightingFor({ elevation: 2, morning: false });
const NIGHT = lightingFor({ elevation: -25, morning: false });
const TOTALS = [0, 100, 200, 300, 400, 500, 600, 680];
const GRADES: Grade[] = [
  "worldie",
  "golazo",
  "trivela",
  "toepoke",
  "tapin",
  "miss",
  "timeup",
  "skipped",
];
const LABELS = {
  boards: ["SOCCERSENSE", "HOT PIES", "TEA BAR", "COME ON THEN"],
  banners: ["HOMETOWN HERO", "ONE OF OUR OWN", "BRING IT HOME"],
};
const MENU_LABELS = {
  home: "HOME",
  away: "AWAY",
  nextgen: "NEXT-GEN",
  retro: "RETRO",
  closest: "CLOSEST",
  furthest: "FURTHEST",
  guesswho: "GUESS WHO",
  shootout: "SHOOTOUT",
  header: "DID YOU KNOW?",
  tagline: "DAILY FOOTBALL TRIVIA",
};
const FACT =
  "The penalty kick was the idea of William McCrum, a goalkeeper from County Armagh, and arrived in 1891.";

/** Canvases: monitor, 1440p, 1366, phone. */
const SIZES: readonly (readonly [number, number])[] = [
  [960, 540],
  [854, 480],
  [683, 384],
  [234, 507],
];

/** Advance `seconds` at 60 a second, drawing every `every` seconds. */
function play(
  scene: {
    update(dt: number): void;
    draw(s: InstanceType<typeof Surface>): void;
  },
  s: InstanceType<typeof Surface>,
  seconds: number,
  every = 0.2,
): void {
  const n = Math.round(seconds / STEP);
  const k = Math.max(1, Math.round(every / STEP));
  for (let i = 1; i <= n; i++) {
    scene.update(STEP);
    if (i % k === 0) scene.draw(s);
  }
}

function career(
  size: readonly [number, number],
  light: Lighting,
  total: number,
  mode: Mode,
  act: (scene: InstanceType<typeof CareerScene>) => void,
  seconds: number,
): void {
  const scene = new CareerScene({ seed: 3, mode, total, labels: LABELS });
  scene.resize(size[0], size[1]);
  scene.setLighting(light);
  const s = new Surface(size[0], size[1]);
  scene.update(0);
  play(scene, s, 1.4, 0.35);
  act(scene);
  play(scene, s, seconds);
}

/** The whole career: what a player can see in a game. */
function careerAll(): void {
  const sizes = SIZES;
  let i = 0;
  const next = () => sizes[i++ % sizes.length];
  const lights = [DAY, NIGHT, DUSK];
  for (let tier = 0; tier < 8; tier++) {
    const light = lights[tier % 3];
    for (const mode of ["home", "away"] as const) {
      career(next(), light, TOTALS[tier], mode, () => {}, 1);
    }
    for (const [g, grade] of GRADES.entries()) {
      career(
        next(),
        lights[(tier + g) % 3],
        TOTALS[tier],
        g % 2 === 0 ? "home" : "away",
        (scene) => {
          if (grade === "miss") {
            scene.playShot("miss");
            for (let k = 0; k < 360; k++) scene.update(STEP);
          }
          scene.playShot(grade);
        },
        6,
      );
    }
    if (tier < 7) {
      career(
        next(),
        light,
        TOTALS[tier],
        "home",
        (scene) => scene.promote(TOTALS[tier + 1]),
        2.5,
      );
    }
  }
  for (const tier of [0, 4, 7]) {
    for (const size of [sizes[0], sizes[3]]) {
      career(
        size,
        tier === 7 ? NIGHT : DAY,
        TOTALS[Math.max(0, tier - 1)],
        "home",
        (scene) => scene.showFullTime(TOTALS[tier]),
        8,
      );
    }
  }
}

/** The home page: the menu scene, and the picture poked. */
function homeAll(): void {
  for (const [n, size] of SIZES.entries()) {
    for (const light of [DAY, DUSK, NIGHT]) {
      // the menu: its entrance, a hover, then a kick-off
      const menu = new MenuScene({
        seed: 2 + n,
        fact: FACT,
        labels: MENU_LABELS,
      });
      menu.resize(size[0], size[1]);
      menu.setLighting(light);
      const s = new Surface(size[0], size[1]);
      menu.update(0);
      play(menu, s, 3, 0.1);
      menu.choose(light === NIGHT ? "away" : "home");
      play(menu, s, 2, 0.05);

      // the picture: the airship poked to bursting, its fall and crash; the mascot's tricks
      const back = new MenuBackdrop({
        seed: 2 + n,
        sign: { header: "DID YOU KNOW?", text: "THE PENALTY KICK" },
      });
      back.resize(size[0], size[1]);
      back.setLighting(light);
      let t = 1;
      back.draw(s, t);
      for (let k = 0; k < 40 && back.pokeAirship(t) !== "pop"; k++) {
        t += 0.4;
        back.draw(s, t);
      }
      for (let k = 0; k < 120; k++) {
        t += 0.15;
        back.draw(s, t);
        if (k % 20 === 0) back.pokeMascot(t);
      }
      back.setRoar(1);
      for (let k = 0; k < 20; k++) {
        t += 0.1;
        back.draw(s, t);
      }
    }
  }
}

describe("nothing falls back to the old lettering", () => {
  test("home, every tier, shot, promotion and full time: the painted faces and lamps only", () => {
    homeAll();
    careerAll();

    const words = [...rec.words, ...glows.values()].filter(
      (w) => !BY_DESIGN.some((r) => r.test(w)),
    );
    expect([...new Set(words)].sort()).toEqual([]);
    // and the recording saw the drawing it should (not an empty pass)
    expect(rec.sprites.size).toBeGreaterThan(20);
  }, 600_000);
});
