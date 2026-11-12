import { describe, expect, test } from "vitest";

import { HOME_QUESTIONS, STADIUMS } from "~/data";
import {
  type Session,
  type StorageLike,
  createSession,
  reduce,
  storageKey,
} from "~/game";
import {
  clearLive,
  finishedSession,
  liveKey,
  loadLive,
  saveLive,
} from "./progress";

function memory(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

const context = {
  mode: "home" as const,
  dayNumber: 1,
  stadium: STADIUMS[0],
  questions: HOME_QUESTIONS,
};

function started(now = 1000): Session {
  return createSession({ ...context, now });
}

describe("the game in progress", () => {
  test("is kept beside the finished game, under its own key", () => {
    expect(liveKey("2026-11-10", "home")).toBe(
      `${storageKey("2026-11-10", "home")}:live`,
    );
  });

  test("comes back as it was: asking, with its clock", () => {
    const store = memory();
    let s = started();
    s = reduce(s, { type: "submit", input: "Liverpool", now: 2000 });
    s = reduce(s, { type: "resolved" });
    s = reduce(s, { type: "next", now: 3000 });
    expect(saveLive(s, store)).toBe(true);
    const back = loadLive(context, store);
    expect(back).not.toBeNull();
    expect(back?.phase).toBe("asking");
    expect(back?.index).toBe(1);
    // Liverpool: third most common of the seven Premier League winners, a trivela.
    expect(back?.total).toBe(60);
    expect(back?.turns[0].share).toBe(17);
    expect(back?.turns[0].grade).toBe("trivela");
    expect(back?.startedAt).toBe(3000);
    expect(back?.deadline).toBe(33000);
    expect(back?.questions).toBe(HOME_QUESTIONS);
  });

  test("a game saved in the middle of its shot comes back at its reveal", () => {
    const store = memory();
    const s = reduce(started(), {
      type: "submit",
      input: "Liverpool",
      now: 2000,
    });
    expect(s.phase).toBe("resolving");
    saveLive(s, store);
    const back = loadLive(context, store);
    expect(back?.phase).toBe("reveal");
    expect(back?.deadline).toBeNull();
  });

  test("anything that does not fit today's game is nothing", () => {
    const store = memory();
    saveLive(started(), store);
    expect(loadLive({ ...context, stadium: STADIUMS[1] }, store)).toBeNull();
    expect(
      loadLive({ ...context, questions: HOME_QUESTIONS.slice(1) }, store),
    ).toBeNull();
    expect(loadLive({ ...context, dayNumber: 2 }, store)).toBeNull();

    const key = liveKey("2026-11-10", "home");
    for (const junk of [
      "not json",
      "null",
      "{}",
      JSON.stringify({ ...JSON.parse(store.map.get(key) ?? "{}"), index: 9 }),
      JSON.stringify({ ...JSON.parse(store.map.get(key) ?? "{}"), turns: [1] }),
    ]) {
      const bad = memory();
      bad.setItem(key, junk);
      expect(loadLive(context, bad)).toBeNull();
    }
    expect(loadLive(context, null)).toBeNull();
  });

  test("a game begun before HOME and AWAY were scored by popularity is not carried on", () => {
    const store = memory();
    let s = started();
    s = reduce(s, { type: "submit", input: "Liverpool", now: 2000 });
    saveLive(s, store);
    const key = liveKey("2026-11-10", "home");
    const saved = JSON.parse(store.map.get(key) ?? "{}") as {
      turns: Record<string, unknown>[];
    };
    for (const turn of saved.turns) delete turn.share;
    store.setItem(key, JSON.stringify(saved));
    expect(loadLive(context, store)).toBeNull();
  });

  test("a game begun before the six shots is not carried on", () => {
    const store = memory();
    let s = started();
    s = reduce(s, { type: "submit", input: "Liverpool", now: 2000 });
    saveLive(s, store);
    expect(loadLive(context, store)).not.toBeNull();
    const key = liveKey("2026-11-10", "home");
    const saved = JSON.parse(store.map.get(key) ?? "{}") as {
      turns: Record<string, unknown>[];
    };
    saved.turns[0].grade = "goal";
    store.setItem(key, JSON.stringify(saved));
    expect(loadLive(context, store)).toBeNull();
  });

  test("a finished game is not kept here, and clearing forgets it", () => {
    const store = memory();
    saveLive(started(), store);
    clearLive("2026-11-10", "home", store);
    expect(loadLive(context, store)).toBeNull();
    expect(saveLive({ ...started(), phase: "done" }, store)).toBe(false);
  });

  test("never throws, whatever the storage does", () => {
    const hostile: StorageLike = {
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
    expect(saveLive(started(), hostile)).toBe(false);
    expect(loadLive(context, hostile)).toBeNull();
    expect(() => clearLive("2026-11-10", "home", hostile)).not.toThrow();
  });

  test("a finished game's turns make a session at full time", () => {
    let s = started();
    for (let i = 0; i < HOME_QUESTIONS.length; i++) {
      s = reduce(s, { type: "pass", now: s.startedAt + 9000 });
      s = reduce(s, { type: "resolved" });
      s = reduce(s, { type: "next", now: s.startedAt + 10000 });
    }
    expect(s.phase).toBe("done");
    const again = finishedSession(context, s.turns, 5);
    expect(again?.phase).toBe("done");
    expect(again?.turns).toEqual(s.turns);
    expect(finishedSession(context, s.turns.slice(1), 5)).toBeNull();
  });
});
