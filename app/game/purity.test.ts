/**
 * The rules are pure: nothing in app/game reads the clock, the DOM, storage or a random
 * number at import time, and only the storage functions ever touch storage (inside
 * try/catch). Checked twice: by reading the source, and by importing and playing a whole
 * game with those globals booby-trapped (all but `performance`, which the test runner itself
 * needs in order to import a module; the source check covers it).
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";

import { east, ORIGIN, question } from "./test-fixtures";

const HERE = dirname(fileURLToPath(import.meta.url));

const SOURCES = readdirSync(HERE)
  .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
  .sort();

/** Source with the comments removed, so words in prose do not count. */
function code(name: string): string {
  return readFileSync(join(HERE, name), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

const FORBIDDEN: [RegExp, string][] = [
  [/\bDate\.now\b/, "Date.now"],
  [/\bnew Date\(\s*\)/, "new Date()"],
  [/\bperformance\b/, "performance"],
  [/\bMath\.random\b/, "Math.random"],
  [/\bwindow\b/, "window"],
  [/\bdocument\b/, "document"],
  [/\bnavigator\b/, "navigator"],
  [/\bsessionStorage\b/, "sessionStorage"],
  [/\bsetTimeout\b|\bsetInterval\b|\brequestAnimationFrame\b/, "a timer"],
  [/\bfetch\s*\(/, "fetch"],
  [/\bIntl\b|toLocaleString|toLocaleDateString/, "the device locale"],
  [/\bprocess\b/, "process"],
  [/\bcrypto\b/, "crypto"],
];

describe("the source of app/game", () => {
  it("is the set of files this test knows about", () => {
    expect(SOURCES).toEqual([
      "career.ts",
      "day.ts",
      "geo.ts",
      "index.ts",
      "judge.ts",
      "modes.ts",
      "reveal.ts",
      "scoring.ts",
      "session.ts",
      "share.ts",
      "shots.ts",
      "stats.ts",
      "storage.ts",
      "test-fixtures.ts",
      "titles.ts",
      "types.ts",
      "view.ts",
    ]);
  });

  it.each(SOURCES)(
    "%s reads no clock, DOM, timer, locale or randomness",
    (name) => {
      const text = code(name);
      for (const [pattern, what] of FORBIDDEN) {
        expect(pattern.test(text), `${name} uses ${what}`).toBe(false);
      }
    },
  );

  it("only storage.ts mentions localStorage, and only inside resolveStorage", () => {
    for (const name of SOURCES) {
      const text = code(name);
      if (name !== "storage.ts") {
        expect(text.includes("localStorage"), name).toBe(false);
        continue;
      }
      const body = text.slice(
        text.indexOf("function resolveStorage"),
        text.indexOf("const GRADES"),
      );
      const outside = text.replace(body, "");
      expect(body.includes("localStorage")).toBe(true);
      expect(outside.includes("localStorage")).toBe(false);
    }
  });

  it("imports nothing from outside app/game", () => {
    for (const name of SOURCES) {
      const text = readFileSync(join(HERE, name), "utf8");
      const froms = [...text.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
      for (const from of froms) {
        expect(from.startsWith("./"), `${name} imports ${from}`).toBe(true);
      }
    }
  });

  it("does not import the test fixtures from rule code", () => {
    for (const name of SOURCES) {
      if (name === "test-fixtures.ts") continue;
      const text = readFileSync(join(HERE, name), "utf8");
      expect(text.includes("test-fixtures"), name).toBe(false);
    }
  });
});

describe("with every impure global booby-trapped", () => {
  const boom = (what: string) => () => {
    throw new Error(`the rules touched ${what}`);
  };

  /** Runs `body` with the traps set, and always puts the globals back. */
  async function trapped<T>(body: () => Promise<T>): Promise<T> {
    const saved = {
      now: Object.getOwnPropertyDescriptor(Date, "now"),
      random: Object.getOwnPropertyDescriptor(Math, "random"),
      local: Object.getOwnPropertyDescriptor(globalThis, "localStorage"),
      session: Object.getOwnPropertyDescriptor(globalThis, "sessionStorage"),
    };
    Object.defineProperty(Date, "now", {
      configurable: true,
      value: boom("Date.now"),
    });
    Object.defineProperty(Math, "random", {
      configurable: true,
      value: boom("Math.random"),
    });
    for (const key of ["localStorage", "sessionStorage"] as const) {
      Object.defineProperty(globalThis, key, {
        configurable: true,
        get: boom(key),
      });
    }
    const restore = (
      target: object,
      key: string,
      descriptor: PropertyDescriptor | undefined,
    ) => {
      if (descriptor) Object.defineProperty(target, key, descriptor);
      else Reflect.deleteProperty(target, key);
    };
    try {
      return await body();
    } finally {
      restore(Date, "now", saved.now);
      restore(Math, "random", saved.random);
      restore(globalThis, "localStorage", saved.local);
      restore(globalThis, "sessionStorage", saved.session);
    }
  }

  it("imports without touching any of them", async () => {
    vi.resetModules();
    const names = await trapped(async () => {
      const game = await import("./index");
      return Object.keys(game);
    });
    expect(names).toContain("reduce");
    expect(names).toContain("saveGame");
  });

  it("plays a whole game without touching the clock or randomness", async () => {
    vi.resetModules();
    const outcome = await trapped(async () => {
      const game = await import("./index");
      const questions = [
        question("q1", [
          east("Alpha", 1),
          east("Bravo", 2),
          east("Charlie", 3),
        ]),
        question("q2", [east("Delta", 1), east("Echo", 2)]),
      ];
      const today = game.resolveToday(
        new Date(game.EPOCH_UTC + 5000),
        "?notimer=0",
        [ORIGIN],
      );
      let s = game.createSession({
        mode: "away",
        dayNumber: today.dayNumber,
        stadium: today.stadium,
        questions,
        now: 1000,
      });
      const views = [game.questionView(s), game.clockView(s, 1500)];
      s = game.reduce(s, { type: "submit", input: "nobody", now: 2000 });
      s = game.reduce(s, { type: "submit", input: "charlei", now: 3000 });
      s = game.reduce(s, { type: "resolved" });
      const reveal = game.revealFor(s);
      const progress = game.progressFor(s);
      s = game.reduce(s, { type: "next", now: 4000 });
      s = game.reduce(s, { type: "tick", now: 4000 + game.QUESTION_MS });
      s = game.reduce(s, { type: "resolved" });
      s = game.reduce(s, { type: "next", now: 99_000 });
      const text = game.buildShareText(game.shareInputFor(s, "SUNDAY LEAGUE"));
      const distance = game.formatDistance(reveal?.turn.km ?? 0, "en-GB");
      return {
        phase: s.phase,
        total: s.total,
        views: views.length,
        rows: reveal?.rows.length,
        promotions: progress.promotions,
        pips: game.pips(s),
        results: game.results(s).length,
        text,
        distance,
        dayKey: today.dayKey,
        summary: game.summary(s),
      };
    });
    expect(outcome).toMatchObject({
      phase: "done",
      total: 100,
      views: 2,
      rows: 2,
      promotions: [1],
      pips: ["worldie", "timeup"],
      results: 2,
      distance: "208 miles",
      dayKey: "2026-11-10",
    });
    expect(outcome.text.split("\n")[0]).toBe("soccersense #1 · AWAY · ORIGIN");
  });

  it("the storage functions swallow a storage that throws on access", async () => {
    vi.resetModules();
    const out = await trapped(async () => {
      const game = await import("./index");
      const turns: never[] = [];
      return {
        saved: game.saveGame("2026-11-10", "home", { total: 0, turns }),
        loaded: game.loadGame("2026-11-10", "home"),
        day: game.loadDay("2026-11-10"),
        cleared: (() => {
          game.clearGame("2026-11-10", "home");
          return true;
        })(),
      };
    });
    expect(out).toEqual({
      saved: false,
      loaded: null,
      day: { home: null, away: null, retro: null, nextgen: null },
      cleared: true,
    });
  });
});
