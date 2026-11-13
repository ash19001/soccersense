import { afterEach, describe, expect, it, vi } from "vitest";

import { dayKeyFor } from "./day";
import type { Session, Turn } from "./session";
import {
  HISTORY_DAYS,
  MODES,
  clearGame,
  dayOfKey,
  loadDay,
  loadGame,
  loadHistory,
  pruneHistory,
  saveGame,
  saveSession,
  STORAGE_PREFIX,
  storageKey,
} from "./storage";
import type { ListableStorage, StorageLike, StoredGame } from "./storage";

/** A minimal in-memory Storage. */
class FakeStorage implements StorageLike {
  readonly items = new Map<string, string>();
  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.items.set(key, String(value));
  }
  removeItem(key: string): void {
    this.items.delete(key);
  }
}

/** Storage as it behaves when blocked or full: every call throws. */
const BROKEN: StorageLike = {
  getItem() {
    throw new DOMException("denied", "SecurityError");
  },
  setItem() {
    throw new DOMException("full", "QuotaExceededError");
  },
  removeItem() {
    throw new DOMException("denied", "SecurityError");
  },
};

const TURNS: Turn[] = [
  {
    questionId: "q1",
    input: "Trent",
    answerId: "trent-alexander-arnold",
    grade: "worldie",
    points: 100,
    km: 3,
    share: 34,
    rank: 1,
    msLeft: 21_500,
  },
  {
    questionId: "q2",
    input: null,
    answerId: null,
    grade: "skipped",
    points: 0,
    km: null,
    share: null,
    rank: null,
    msLeft: 12_000,
  },
  {
    questionId: "q3",
    input: null,
    answerId: null,
    grade: "timeup",
    points: 0,
    km: null,
    share: null,
    rank: null,
    msLeft: 0,
  },
];
const GAME: StoredGame = { total: 100, turns: TURNS };
const DAY = "2026-11-10";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("storageKey", () => {
  it("is soccersense:v1:<day>:<mode>", () => {
    expect(STORAGE_PREFIX).toBe("soccersense:v1");
    expect(storageKey("2026-11-10", "home")).toBe(
      "soccersense:v1:2026-11-10:home",
    );
    expect(storageKey("2027-01-05", "away")).toBe(
      "soccersense:v1:2027-01-05:away",
    );
  });
});

describe("with a storage", () => {
  it("saves under the key and reads it back", () => {
    const storage = new FakeStorage();
    expect(saveGame(DAY, "home", GAME, storage)).toBe(true);
    expect([...storage.items.keys()]).toEqual([
      "soccersense:v1:2026-11-10:home",
    ]);
    expect(loadGame(DAY, "home", storage)).toEqual(GAME);
  });

  it("reads a game saved before HOME and AWAY were scored by popularity", () => {
    const storage = new FakeStorage();
    const old = GAME.turns.map((turn) => {
      const copy: Partial<Turn> = { ...turn };
      delete copy.share;
      return copy;
    });
    storage.setItem(
      storageKey(DAY, "home"),
      JSON.stringify({ total: GAME.total, turns: old }),
    );
    const back = loadGame(DAY, "home", storage);
    expect(back?.total).toBe(GAME.total);
    expect(back?.turns.map((turn) => turn.share)).toEqual(
      GAME.turns.map(() => null),
    );
    // A share that is there must be a number.
    storage.setItem(
      storageKey(DAY, "away"),
      JSON.stringify({
        total: GAME.total,
        turns: GAME.turns.map((turn) => ({ ...turn, share: "34%" })),
      }),
    );
    expect(loadGame(DAY, "away", storage)).toBeNull();
  });

  it("reads a game saved before the six shots as nothing", () => {
    const storage = new FakeStorage();
    // (WORLDIE was an old grade too, and is a shot again: see the test below.)
    for (const grade of ["topbins", "goal", "ontarget", "wide"]) {
      storage.setItem(
        storageKey(DAY, "home"),
        JSON.stringify({
          total: GAME.total,
          turns: [{ ...TURNS[0], grade }, TURNS[1], TURNS[2]],
        }),
      );
      expect(loadGame(DAY, "home", storage), grade).toBeNull();
    }
    for (const grade of [
      "worldie",
      "golazo",
      "trivela",
      "toepoke",
      "tapin",
      "miss",
    ]) {
      storage.setItem(
        storageKey(DAY, "home"),
        JSON.stringify({
          total: GAME.total,
          turns: [{ ...TURNS[0], grade }, TURNS[1], TURNS[2]],
        }),
      );
      expect(loadGame(DAY, "home", storage)?.turns[0].grade).toBe(grade);
    }
  });

  it("reads the shots' first names as the shots of the same points", () => {
    const storage = new FakeStorage();
    const first = {
      bicycle: "worldie",
      finesse: "golazo",
      power: "trivela",
      chip: "toepoke",
    };
    for (const [old, now] of Object.entries(first)) {
      storage.setItem(
        storageKey(DAY, "home"),
        JSON.stringify({
          total: GAME.total,
          turns: [{ ...TURNS[0], grade: old }, TURNS[1], TURNS[2]],
        }),
      );
      expect(loadGame(DAY, "home", storage)?.turns[0].grade, old).toBe(now);
    }
  });

  it("stores exactly { total, turns } as JSON", () => {
    const storage = new FakeStorage();
    const extra = { ...GAME, mode: "home", secret: 1 } as StoredGame;
    saveGame(DAY, "home", extra, storage);
    const raw = storage.getItem(storageKey(DAY, "home"));
    expect(JSON.parse(raw ?? "")).toEqual({ total: 100, turns: TURNS });
  });

  it("keeps modes and days apart", () => {
    const storage = new FakeStorage();
    saveGame(DAY, "home", GAME, storage);
    saveGame(DAY, "away", { total: 0, turns: [] }, storage);
    const other = { total: 200, turns: [TURNS[0], TURNS[0]] };
    saveGame("2026-11-11", "home", other, storage);
    expect(loadGame(DAY, "home", storage)?.total).toBe(100);
    expect(loadGame(DAY, "away", storage)?.total).toBe(0);
    expect(loadGame("2026-11-11", "home", storage)?.total).toBe(200);
    expect(loadGame("2026-11-11", "away", storage)).toBeNull();
    expect(storage.items.size).toBe(3);
  });

  it("replaces an earlier game for the same day and mode", () => {
    const storage = new FakeStorage();
    saveGame(DAY, "home", GAME, storage);
    saveGame(DAY, "home", { total: 0, turns: [] }, storage);
    expect(loadGame(DAY, "home", storage)).toEqual({ total: 0, turns: [] });
    expect(storage.items.size).toBe(1);
  });

  it("returns null when nothing is saved", () => {
    expect(loadGame(DAY, "home", new FakeStorage())).toBeNull();
  });

  it("loads both modes for the menu", () => {
    const storage = new FakeStorage();
    expect(loadDay(DAY, storage)).toEqual({
      home: null,
      away: null,
      retro: null,
      nextgen: null,
    });
    saveGame(DAY, "away", GAME, storage);
    expect(loadDay(DAY, storage)).toEqual({
      home: null,
      away: GAME,
      retro: null,
      nextgen: null,
    });
  });

  it("clears one game", () => {
    const storage = new FakeStorage();
    saveGame(DAY, "home", GAME, storage);
    saveGame(DAY, "away", GAME, storage);
    clearGame(DAY, "home", storage);
    expect(loadDay(DAY, storage)).toEqual({
      home: null,
      away: GAME,
      retro: null,
      nextgen: null,
    });
    clearGame(DAY, "home", storage);
    expect(storage.items.size).toBe(1);
  });

  it.each([
    ["not JSON", "{oops"],
    ["an empty string", ""],
    ["null", "null"],
    ["a number", "42"],
    ["an array", "[]"],
    ["no total", JSON.stringify({ turns: [] })],
    ["a text total", JSON.stringify({ total: "100", turns: [] })],
    ["no turns", JSON.stringify({ total: 100 })],
    ["turns that are not a list", JSON.stringify({ total: 100, turns: {} })],
    ["a turn that is not an object", JSON.stringify({ total: 0, turns: [1] })],
    [
      "a turn with an unknown grade",
      JSON.stringify({ total: 0, turns: [{ ...TURNS[0], grade: "banger" }] }),
    ],
    [
      "a turn with missing points",
      JSON.stringify({ total: 0, turns: [{ ...TURNS[0], points: undefined }] }),
    ],
    [
      "a turn with a text distance",
      JSON.stringify({ total: 0, turns: [{ ...TURNS[0], km: "3" }] }),
    ],
  ])("returns null for junk: %s", (_label, raw) => {
    const storage = new FakeStorage();
    storage.setItem(storageKey(DAY, "home"), raw);
    expect(loadGame(DAY, "home", storage)).toBeNull();
  });

  it("never throws when the storage does", () => {
    expect(saveGame(DAY, "home", GAME, BROKEN)).toBe(false);
    expect(loadGame(DAY, "home", BROKEN)).toBeNull();
    expect(loadDay(DAY, BROKEN)).toEqual({
      home: null,
      away: null,
      retro: null,
      nextgen: null,
    });
    expect(() => clearGame(DAY, "home", BROKEN)).not.toThrow();
  });

  it("never throws when the game cannot be serialised", () => {
    const storage = new FakeStorage();
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const bad = { total: 1, turns: [circular] } as unknown as StoredGame;
    expect(saveGame(DAY, "home", bad, storage)).toBe(false);
    expect(storage.items.size).toBe(0);
  });
});

describe("with no storage", () => {
  it("does nothing when told there is none", () => {
    expect(saveGame(DAY, "home", GAME, null)).toBe(false);
    expect(loadGame(DAY, "home", null)).toBeNull();
    expect(loadDay(DAY, null)).toEqual({
      home: null,
      away: null,
      retro: null,
      nextgen: null,
    });
    expect(() => clearGame(DAY, "home", null)).not.toThrow();
  });

  it("does nothing when localStorage does not exist (server render)", () => {
    vi.stubGlobal("localStorage", undefined);
    expect(saveGame(DAY, "home", GAME)).toBe(false);
    expect(loadGame(DAY, "home")).toBeNull();
    expect(loadDay(DAY)).toEqual({
      home: null,
      away: null,
      retro: null,
      nextgen: null,
    });
    expect(() => clearGame(DAY, "home")).not.toThrow();
  });

  it("does nothing when reading localStorage throws (blocked storage)", () => {
    const original = Object.getOwnPropertyDescriptor(
      globalThis,
      "localStorage",
    );
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("denied", "SecurityError");
      },
    });
    try {
      expect(saveGame(DAY, "home", GAME)).toBe(false);
      expect(loadGame(DAY, "home")).toBeNull();
      expect(loadDay(DAY)).toEqual({
        home: null,
        away: null,
        retro: null,
        nextgen: null,
      });
      expect(() => clearGame(DAY, "home")).not.toThrow();
    } finally {
      if (original) Object.defineProperty(globalThis, "localStorage", original);
      else Reflect.deleteProperty(globalThis, "localStorage");
    }
  });

  it("does nothing when localStorage is not a real storage", () => {
    vi.stubGlobal("localStorage", { getItem: "nope" });
    expect(saveGame(DAY, "home", GAME)).toBe(false);
    expect(loadGame(DAY, "home")).toBeNull();
  });
});

describe("with the default localStorage", () => {
  it("uses the global one when no storage is passed", () => {
    const storage = new FakeStorage();
    vi.stubGlobal("localStorage", storage);
    expect(saveGame(DAY, "away", GAME)).toBe(true);
    expect(storage.items.has("soccersense:v1:2026-11-10:away")).toBe(true);
    expect(loadGame(DAY, "away")).toEqual(GAME);
    expect(loadDay(DAY)).toEqual({
      home: null,
      away: GAME,
      retro: null,
      nextgen: null,
    });
    clearGame(DAY, "away");
    expect(loadGame(DAY, "away")).toBeNull();
  });
});

/** A FakeStorage that can list its keys, as localStorage can. */
class ListedStorage extends FakeStorage implements ListableStorage {
  get length(): number {
    return this.items.size;
  }
  key(index: number): string | null {
    return [...this.items.keys()][index] ?? null;
  }
}

/** A finished game of seven questions with these grades (points from the grades). */
function finished(grades: Turn["grade"][]): StoredGame {
  const points = {
    worldie: 100,
    golazo: 80,
    trivela: 60,
    toepoke: 30,
    tapin: 10,
  };
  const turns = grades.map((grade, i): Turn => ({
    ...TURNS[0],
    questionId: `q${i + 1}`,
    grade,
    points: (points as Record<string, number>)[grade] ?? 0,
  }));
  return { total: turns.reduce((s, t) => s + t.points, 0), turns };
}

describe("dayOfKey", () => {
  it("is dayKeyFor the other way round", () => {
    for (const day of [1, 2, 31, 52, 365, 366, 1000]) {
      expect(dayOfKey(dayKeyFor(day))).toBe(day);
    }
    expect(dayOfKey("2026-11-10")).toBe(1);
    expect(dayOfKey("2026-11-12")).toBe(3);
  });

  it("is null for anything that is not a day from day 1 on", () => {
    for (const key of [
      "2026-11-09",
      "2026-02-31",
      "2026-13-01",
      "26-11-10",
      "2026-11-10:home",
      "",
      "leaderboard",
    ]) {
      expect(dayOfKey(key), key).toBeNull();
    }
  });
});

describe("the history", () => {
  it("lists every finished game in the year up to today, oldest first", () => {
    const storage = new ListedStorage();
    saveGame(dayKeyFor(5), "away", finished(["worldie", "miss"]), storage);
    saveGame(dayKeyFor(5), "home", finished(["golazo"]), storage);
    saveGame(dayKeyFor(3), "home", finished(["tapin", "timeup"]), storage);
    // Not finished games: one in progress, the leaderboard's choice, the sound, junk.
    storage.setItem(`${storageKey(dayKeyFor(6), "home")}:live`, "{}");
    storage.setItem("soccersense:v1:leaderboard", "closed");
    storage.setItem("soccersense:v1:sound", "off");
    storage.setItem(storageKey(dayKeyFor(4), "home"), "{oops");
    storage.setItem("soccersense:v1:2026-11-12:retro", "{}");
    expect(loadHistory(5, storage)).toEqual([
      {
        day: 3,
        mode: "home",
        total: 10,
        grades: ["tapin", "timeup"],
        points: [10, 0],
      },
      { day: 5, mode: "home", total: 80, grades: ["golazo"], points: [80] },
      {
        day: 5,
        mode: "away",
        total: 100,
        grades: ["worldie", "miss"],
        points: [100, 0],
      },
    ]);
  });

  it("leaves out games after today and before the year", () => {
    const storage = new ListedStorage();
    saveGame(dayKeyFor(1), "home", finished(["miss"]), storage);
    saveGame(dayKeyFor(2), "home", finished(["miss"]), storage);
    saveGame(dayKeyFor(400), "home", finished(["miss"]), storage);
    const today = 1 + HISTORY_DAYS;
    expect(loadHistory(today, storage).map((g) => g.day)).toEqual([2]);
    expect(loadHistory(1, storage).map((g) => g.day)).toEqual([1]);
  });

  it("is empty with no storage, broken storage or storage that cannot list", () => {
    expect(loadHistory(5, null)).toEqual([]);
    expect(loadHistory(5, BROKEN as ListableStorage)).toEqual([]);
    const unlisted = new FakeStorage();
    saveGame(DAY, "home", GAME, unlisted);
    expect(loadHistory(1, unlisted as unknown as ListableStorage)).toEqual([]);
    vi.stubGlobal("localStorage", undefined);
    expect(loadHistory(5)).toEqual([]);
  });

  it("reads the global localStorage when no storage is passed", () => {
    const storage = new ListedStorage();
    vi.stubGlobal("localStorage", storage);
    saveGame(dayKeyFor(2), "away", finished(["trivela"]), storage);
    expect(loadHistory(2)).toEqual([
      { day: 2, mode: "away", total: 60, grades: ["trivela"], points: [60] },
    ]);
  });

  it("is pruned to a year as a finished game is saved", () => {
    const storage = new ListedStorage();
    saveGame(dayKeyFor(1), "home", finished(["miss"]), storage);
    saveGame(dayKeyFor(1), "away", finished(["miss"]), storage);
    saveGame(dayKeyFor(2), "home", finished(["miss"]), storage);
    storage.setItem(`${storageKey(dayKeyFor(1), "home")}:live`, "{}");
    storage.setItem("soccersense:v1:leaderboard", "closed");
    expect(pruneHistory(HISTORY_DAYS, storage)).toBe(0);
    expect(pruneHistory(HISTORY_DAYS + 1, storage)).toBe(2);
    expect([...storage.items.keys()].sort()).toEqual([
      "soccersense:v1:2026-11-10:home:live",
      `soccersense:v1:${dayKeyFor(2)}:home`,
      "soccersense:v1:leaderboard",
    ]);
    // saveSession prunes from the day of the game it saves.
    const session = {
      ...finished(["worldie"]),
      phase: "done",
      mode: "home",
      dayNumber: HISTORY_DAYS + 2,
    } as unknown as Session;
    expect(saveSession(session, storage)).toBe(true);
    expect(loadHistory(HISTORY_DAYS + 2, storage).map((g) => g.day)).toEqual([
      HISTORY_DAYS + 2,
    ]);
  });

  it("prunes from the real day, so a game on a far-off ?day= keeps the real games", () => {
    const storage = new ListedStorage();
    saveGame(dayKeyFor(1), "home", finished(["miss"]), storage);
    saveGame(dayKeyFor(2), "away", finished(["miss"]), storage);
    const future = {
      ...finished(["worldie"]),
      phase: "done",
      mode: "home",
      dayNumber: 5000,
    } as unknown as Session;
    // Played with ?day=5000 on day 3: nothing of the real year goes.
    expect(saveSession(future, storage, 3)).toBe(true);
    expect(loadHistory(5000, storage).map((g) => g.day)).toEqual([5000]);
    expect(loadHistory(3, storage).map((g) => g.day)).toEqual([1, 2]);
    // A real day more than a year on prunes them.
    expect(saveSession(future, storage, 1 + HISTORY_DAYS)).toBe(true);
    expect(loadHistory(1 + HISTORY_DAYS, storage).map((g) => g.day)).toEqual([
      2,
    ]);
  });

  it("never throws when pruning cannot be done", () => {
    expect(pruneHistory(500, null)).toBe(0);
    expect(pruneHistory(500, BROKEN)).toBe(0);
    expect(pruneHistory(500, new FakeStorage())).toBe(0);
  });

  it("lists the modes in the menu's order", () => {
    expect(MODES).toEqual(["home", "away", "retro", "nextgen"]);
  });
});
