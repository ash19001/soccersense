import { afterEach, describe, expect, it, vi } from "vitest";

import type { Turn } from "./session";
import {
  clearGame,
  loadDay,
  loadGame,
  saveGame,
  STORAGE_PREFIX,
  storageKey,
} from "./storage";
import type { StorageLike, StoredGame } from "./storage";

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
    expect(loadDay(DAY, storage)).toEqual({ home: null, away: null });
    saveGame(DAY, "away", GAME, storage);
    expect(loadDay(DAY, storage)).toEqual({ home: null, away: GAME });
  });

  it("clears one game", () => {
    const storage = new FakeStorage();
    saveGame(DAY, "home", GAME, storage);
    saveGame(DAY, "away", GAME, storage);
    clearGame(DAY, "home", storage);
    expect(loadDay(DAY, storage)).toEqual({ home: null, away: GAME });
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
    expect(loadDay(DAY, BROKEN)).toEqual({ home: null, away: null });
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
    expect(loadDay(DAY, null)).toEqual({ home: null, away: null });
    expect(() => clearGame(DAY, "home", null)).not.toThrow();
  });

  it("does nothing when localStorage does not exist (server render)", () => {
    vi.stubGlobal("localStorage", undefined);
    expect(saveGame(DAY, "home", GAME)).toBe(false);
    expect(loadGame(DAY, "home")).toBeNull();
    expect(loadDay(DAY)).toEqual({ home: null, away: null });
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
      expect(loadDay(DAY)).toEqual({ home: null, away: null });
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
    expect(loadDay(DAY)).toEqual({ home: null, away: GAME });
    clearGame(DAY, "away");
    expect(loadGame(DAY, "away")).toBeNull();
  });
});
