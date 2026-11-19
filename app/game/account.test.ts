import { describe, expect, it } from "vitest";

import {
  ACCOUNT_KEY,
  EMAIL_MAX,
  HISTORY_TEXT_MAX,
  isHistoryAnswer,
  isHistoryGame,
  LINK_ASKED_KEY,
  LINK_ASKED_MS,
  checkEmail,
  forgetLinkAsked,
  isAccountAnswer,
  linkAsked,
  loadAccount,
  noteLinkAsked,
  saveAccount,
} from "./account";
import { isFanNickname, nicknameKey } from "./nickname";
import type { StorageLike } from "./storage";

function memory(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, String(value)),
    removeItem: (key) => void data.delete(key),
  };
}

/** Storage that fails at everything, as a blocked or full one does. */
const broken: StorageLike = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("full");
  },
  removeItem: () => {
    throw new Error("blocked");
  },
};

describe("an email address", () => {
  it("is tidied: no spaces round it, lower case", () => {
    expect(checkEmail("  Fan@Example.COM ")).toEqual({
      ok: true,
      email: "fan@example.com",
    });
    expect(checkEmail("nina.o'neil+game@mail.example.co.uk")).toEqual({
      ok: true,
      email: "nina.o'neil+game@mail.example.co.uk",
    });
  });

  it("must have the shape of one", () => {
    for (const text of [
      "",
      " ",
      "fan",
      "fan@",
      "@example.com",
      "fan@example",
      "fan@.com",
      "fan@example.",
      "fan@exam ple.com",
      "fan@@example.com",
      "a@b@example.com",
      `${"x".repeat(EMAIL_MAX)}@example.com`,
      null,
      undefined,
      42,
      {},
    ]) {
      expect([text, checkEmail(text).ok]).toEqual([text, false]);
    }
  });

  it("may be as long as an address can be", () => {
    const longest = `${"x".repeat(EMAIL_MAX - "@example.com".length)}@example.com`;
    expect(longest).toHaveLength(EMAIL_MAX);
    expect(checkEmail(longest).ok).toBe(true);
  });
});

describe("what the server says about the account", () => {
  const ways = { email: true, google: false, check: null };

  it("is somebody or nobody, and the ways of signing in", () => {
    expect(isAccountAnswer({ account: null, signIn: ways })).toBe(true);
    expect(
      isAccountAnswer({
        account: { nickname: "soccerfan1", email: "fan@example.com" },
        signIn: ways,
      }),
    ).toBe(true);
  });

  it("is nothing else", () => {
    for (const value of [
      null,
      undefined,
      "account",
      [],
      {},
      { account: null },
      { signIn: ways },
      { account: {}, signIn: ways },
      { account: { nickname: "", email: "fan@example.com" }, signIn: ways },
      { account: { nickname: "soccerfan1" }, signIn: ways },
      { account: null, signIn: { email: "yes", google: false, check: null } },
      { account: null, signIn: { email: true, google: false } },
      { account: null, signIn: { email: true, google: false, check: "" } },
      { error: "signed_out" },
      { sent: true },
    ]) {
      expect([value, isAccountAnswer(value)]).toEqual([value, false]);
    }
  });
});

describe("the device's note of who is signed in", () => {
  const fan = { nickname: "soccerfan1", email: "fan@example.com" };

  it("is kept, read back, and taken away", () => {
    const storage = memory();
    expect(loadAccount(storage)).toBeNull();
    saveAccount(fan, storage);
    expect([...storage.data.keys()]).toEqual([ACCOUNT_KEY]);
    expect(loadAccount(storage)).toEqual(fan);
    saveAccount(null, storage);
    expect(storage.data.size).toBe(0);
    expect(loadAccount(storage)).toBeNull();
  });

  it("holds the name and the address and nothing else", () => {
    const storage = memory();
    saveAccount({ ...fan, id: "secret", token: "x" } as typeof fan, storage);
    expect(JSON.parse(storage.data.get(ACCOUNT_KEY) ?? "")).toEqual(fan);
  });

  it("junk is nobody", () => {
    for (const raw of ["", "{", "null", "[]", '{"nickname":"x"}', '"fan"']) {
      const storage = memory();
      storage.data.set(ACCOUNT_KEY, raw);
      expect([raw, loadAccount(storage)]).toEqual([raw, null]);
    }
  });

  it("no storage, or storage that fails, is nobody and never throws", () => {
    expect(loadAccount(null)).toBeNull();
    expect(() => saveAccount(fan, null)).not.toThrow();
    expect(loadAccount(broken)).toBeNull();
    expect(() => saveAccount(fan, broken)).not.toThrow();
    expect(() => saveAccount(null, broken)).not.toThrow();
  });
});

describe("the note that a sign-in link was asked for from this browser", () => {
  const NOW = 1_800_000_000_000;

  it("counts for a little longer than a link works, then not", () => {
    const storage = memory();
    expect(linkAsked(NOW, storage)).toBe(false);
    noteLinkAsked(NOW, storage);
    expect([...storage.data.keys()]).toEqual([LINK_ASKED_KEY]);
    expect(linkAsked(NOW, storage)).toBe(true);
    expect(linkAsked(NOW + LINK_ASKED_MS - 1, storage)).toBe(true);
    expect(linkAsked(NOW + LINK_ASKED_MS, storage)).toBe(false);
    // a clock put back does not make an old note count
    expect(linkAsked(NOW - 1, storage)).toBe(false);
  });

  it("is forgotten once the link is used", () => {
    const storage = memory();
    noteLinkAsked(NOW, storage);
    forgetLinkAsked(storage);
    expect(linkAsked(NOW, storage)).toBe(false);
    expect(storage.data.size).toBe(0);
  });

  it("junk, no storage or failing storage is no note, and never throws", () => {
    const storage = memory();
    storage.data.set(LINK_ASKED_KEY, "soon");
    expect(linkAsked(NOW, storage)).toBe(false);
    expect(linkAsked(NOW, null)).toBe(false);
    expect(linkAsked(NOW, broken)).toBe(false);
    expect(() => noteLinkAsked(NOW, broken)).not.toThrow();
    expect(() => forgetLinkAsked(broken)).not.toThrow();
  });
});

describe("nicknames, as accounts need them", () => {
  it("a first nickname is soccerfan and a number, in any capitals", () => {
    for (const name of ["soccerfan1", "SoccerFan4821", " soccerfan07 "]) {
      expect([name, isFanNickname(name)]).toEqual([name, true]);
    }
    for (const name of ["soccerfan", "soccerfan 1", "soccerfan1a", "fan12"]) {
      expect([name, isFanNickname(name)]).toEqual([name, false]);
    }
  });

  it("two names are one name whatever their capitals and spacing", () => {
    expect(nicknameKey("  Nutmeg   NINA ")).toBe("nutmeg nina");
    expect(nicknameKey("Nutmeg Nina")).toBe(nicknameKey("nutmeg nina"));
    expect(nicknameKey("Nutmeg-Nina")).not.toBe(nicknameKey("Nutmeg Nina"));
  });
});

describe("a finished game, as a device and the server swap them", () => {
  const turn = (points: number) => ({
    questionId: "q",
    input: "Messi",
    answerId: "messi",
    grade: "worldie",
    points,
    km: null,
    share: 0.3,
    rank: 1,
    msLeft: 1000,
    name: "Lionel Messi",
    year: null,
  });
  const whole = {
    day: 8,
    mode: "home",
    total: 700,
    turns: Array.from({ length: 7 }, () => turn(100)),
    prompts: null,
  };

  it("is seven turns, a total that is their sum, and what each asked or null", () => {
    expect(isHistoryGame(whole)).toBe(true);
    expect(
      isHistoryGame({
        ...whole,
        prompts: Array.from({ length: 7 }, () => "Q?"),
      }),
    ).toBe(true);
    // a game kept before turns had their names
    const old = whole.turns.map((turn) => {
      const rest: Partial<typeof turn> = { ...turn };
      delete rest.name;
      delete rest.year;
      return rest;
    });
    expect(isHistoryGame({ ...whole, turns: old })).toBe(true);
  });

  it("is nothing else, and nothing longer than a game holds", () => {
    const long = "x".repeat(HISTORY_TEXT_MAX + 1);
    for (const value of [
      null,
      { ...whole, day: 0 },
      { ...whole, day: 1.5 },
      { ...whole, mode: "guesswho" },
      { ...whole, total: 690 },
      { ...whole, turns: whole.turns.slice(1), total: 600 },
      { ...whole, turns: [...whole.turns, turn(0)] },
      { ...whole, prompts: ["just one"] },
      { ...whole, prompts: Array.from({ length: 7 }, () => 7) },
      {
        ...whole,
        turns: whole.turns.map((t) => ({ ...t, points: 101 })),
        total: 707,
      },
      { ...whole, turns: whole.turns.map((t) => ({ ...t, input: long })) },
      { ...whole, turns: whole.turns.map((t) => ({ ...t, name: long })) },
    ]) {
      expect(isHistoryGame(value)).toBe(false);
    }
  });

  it("the server's answer is games, what it wants, and how many it kept", () => {
    expect(
      isHistoryAnswer({ games: [whole], want: [[7, "away"]], saved: 0 }),
    ).toBe(true);
    expect(isHistoryAnswer({ games: [], want: [], saved: 2 })).toBe(true);
    for (const value of [
      null,
      { games: [{}], want: [], saved: 0 },
      { games: [], want: [[7, "guesswho"]], saved: 0 },
      { games: [], want: [] },
    ]) {
      expect(isHistoryAnswer(value)).toBe(false);
    }
  });
});
