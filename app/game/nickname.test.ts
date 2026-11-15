import { describe, expect, test } from "vitest";

import { NAME_MAX } from "~/data/leaderboard";

import {
  FAN_FIRST,
  FAN_LAST,
  NICKNAME_KEY,
  NICKNAME_MAX,
  NICKNAME_MIN,
  checkNickname,
  ensureNickname,
  fanNickname,
  fanNumber,
  loadNickname,
  saveNickname,
} from "./nickname";
import type { StorageLike } from "./storage";

/** A storage that keeps its items in a map. */
function memory(items: Record<string, string> = {}) {
  const map = new Map(Object.entries(items));
  const store: StorageLike = {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  };
  return { store, map };
}

/** A storage where every call throws (blocked, as in some private windows). */
const BLOCKED: StorageLike = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
  removeItem: () => {
    throw new Error("blocked");
  },
};

describe("checkNickname", () => {
  test("tidies the spaces and takes letters, numbers, spaces, - and _", () => {
    expect(checkNickname("  Row   Z  Rita ")).toEqual({
      ok: true,
      name: "Row Z Rita",
    });
    expect(checkNickname("top_bins-9")).toEqual({
      ok: true,
      name: "top_bins-9",
    });
  });

  test("says why a name cannot be used", () => {
    expect(checkNickname("Jo")).toEqual({ ok: false, problem: "short" });
    expect(checkNickname("   ")).toEqual({ ok: false, problem: "short" });
    expect(checkNickname("A".repeat(NICKNAME_MAX + 1))).toEqual({
      ok: false,
      problem: "long",
    });
    expect(checkNickname("Jo!")).toEqual({ ok: false, problem: "characters" });
    expect(checkNickname("Zoë")).toEqual({ ok: false, problem: "characters" });
    expect(checkNickname("<b>hi</b>")).toEqual({
      ok: false,
      problem: "characters",
    });
    expect(checkNickname("123")).toEqual({ ok: false, problem: "letter" });
    expect(checkNickname("A".repeat(NICKNAME_MIN)).ok).toBe(true);
    expect(checkNickname("A".repeat(NICKNAME_MAX)).ok).toBe(true);
  });

  test("takes the longest first nickname, and every handle of the mock field", () => {
    expect(fanNickname(FAN_LAST)).toHaveLength(NICKNAME_MAX);
    expect(NICKNAME_MAX).toBeGreaterThanOrEqual(NAME_MAX);
  });
});

describe("first nicknames", () => {
  test("are soccerfan and the number", () => {
    expect(fanNickname(4821)).toBe("soccerfan4821");
    expect(fanNickname(1)).toBe("soccerfan1");
    expect(fanNickname(0)).toBe("soccerfan1");
    expect(fanNickname(2.5)).toBe("soccerfan1");
    expect(fanNickname(Number.NaN)).toBe("soccerfan1");
  });

  test("a random value gives a four-digit number, each as likely", () => {
    expect(fanNumber(0)).toBe(FAN_FIRST);
    expect(fanNumber(0.9999999)).toBe(FAN_LAST);
    expect(fanNumber(1)).toBe(FAN_LAST);
    expect(fanNumber(-3)).toBe(FAN_FIRST);
    expect(fanNumber(Number.NaN)).toBe(FAN_FIRST);
    expect(fanNumber(0.5)).toBe(5500);
    // Every value from 0 to 1 lands in range, and each is a nickname that can be kept.
    for (let i = 0; i <= 1000; i++) {
      const n = fanNumber(i / 1000);
      expect(n).toBeGreaterThanOrEqual(FAN_FIRST);
      expect(n).toBeLessThanOrEqual(FAN_LAST);
      expect(Number.isInteger(n)).toBe(true);
      const name = fanNickname(n);
      expect(checkNickname(name)).toEqual({ ok: true, name });
    }
  });
});

describe("keeping the nickname", () => {
  test("saves it tidied, and reads it back", () => {
    const { store, map } = memory();
    expect(saveNickname(" Lob  Lou ", store)).toBe("Lob Lou");
    expect(map.get(NICKNAME_KEY)).toBe("Lob Lou");
    expect(loadNickname(store)).toBe("Lob Lou");
  });

  test("a name that cannot be used is not saved", () => {
    const { store, map } = memory();
    expect(saveNickname("!!", store)).toBeNull();
    expect(map.has(NICKNAME_KEY)).toBe(false);
  });

  test("junk in storage reads as none", () => {
    expect(loadNickname(memory({ [NICKNAME_KEY]: "<script>" }).store)).toBe(
      null,
    );
    expect(loadNickname(memory().store)).toBeNull();
    expect(loadNickname(BLOCKED)).toBeNull();
    expect(loadNickname(null)).toBeNull();
  });

  test("the first visit makes one up and keeps it; later visits read it back", () => {
    const { store, map } = memory();
    let made = 0;
    const fresh = () => {
      made++;
      return `Volley${made}`;
    };
    expect(ensureNickname(fresh, store)).toBe("Volley1");
    expect(map.get(NICKNAME_KEY)).toBe("Volley1");
    expect(ensureNickname(fresh, store)).toBe("Volley1");
    expect(made).toBe(1);
  });

  test("junk is replaced; with no storage the made-up name is used anyway", () => {
    const { store, map } = memory({ [NICKNAME_KEY]: "x" });
    expect(ensureNickname(() => "TifoTess", store)).toBe("TifoTess");
    expect(map.get(NICKNAME_KEY)).toBe("TifoTess");
    expect(ensureNickname(() => "TifoTess", BLOCKED)).toBe("TifoTess");
    expect(ensureNickname(() => "TifoTess", null)).toBe("TifoTess");
  });
});
