import { describe, expect, it, vi } from "vitest";

import { STADIUMS, questionsFor } from "~/data";
import {
  SHOT_POINTS,
  type StorageLike,
  type Today,
  dayKeyFor,
  saveGame,
} from "~/game";

import type { ShareKit } from "./play/share-image";
import { createTodayShare } from "./share-today";

const TODAY: Today = {
  dayNumber: 4,
  dayKey: dayKeyFor(4),
  stadium: STADIUMS[0],
  noTimer: false,
};

function memory(): StorageLike {
  const items = new Map<string, string>();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
    removeItem: (key) => void items.delete(key),
  };
}

/** Today's HOME, finished: a WORLDIE with the first answer, then passes. */
function played(storage: StorageLike): void {
  const turns = questionsFor("home").map((q, i) => ({
    questionId: q.id,
    input: i === 0 ? q.answers[0].name : null,
    answerId: i === 0 ? q.answers[0].id : null,
    grade: i === 0 ? ("worldie" as const) : ("skipped" as const),
    points: i === 0 ? SHOT_POINTS.worldie : 0,
    km: null,
    share: null,
    rank: null,
    msLeft: 0,
  }));
  saveGame(TODAY.dayKey, "home", { total: 100, turns }, storage);
}

/** A share kit that makes a picture when told, downloads, and copies. */
function kit(over: Partial<ShareKit> = {}) {
  let finish: (blob: Blob | null) => void = () => {};
  const k = {
    canMakeImage: vi.fn(() => true),
    makeImage: vi.fn(
      () =>
        new Promise<Blob | null>((resolve) => {
          finish = resolve;
        }),
    ),
    canShareFiles: vi.fn(() => false),
    shareFiles: vi.fn(() => Promise.resolve()),
    download: vi.fn(() => true),
    copy: vi.fn(() => Promise.resolve()),
    ...over,
  };
  return { kit: k, finish: (blob: Blob | null) => finish(blob) };
}

describe("createTodayShare", () => {
  it("has nothing to share for a mode not played today", () => {
    const { kit: k } = kit();
    const share = createTodayShare({ kit: k, storage: memory() });
    expect(share.prepare(TODAY, "home")).toBeNull();
    expect(share.share(TODAY, "home")).toBeNull();
    expect(k.makeImage).not.toHaveBeenCalled();
  });

  it("makes the picture once, ahead, and shares it as the full-time card does", async () => {
    const storage = memory();
    played(storage);
    const { kit: k, finish } = kit();
    const share = createTodayShare({ kit: k, storage });
    const prepared = share.prepare(TODAY, "home");
    expect(prepared).not.toBeNull();
    // asked again: the same picture, not a second one
    share.prepare(TODAY, "home");
    expect(k.makeImage).toHaveBeenCalledTimes(1);
    expect(share.ready(TODAY, "home")).toBe(false);
    const png = new Blob(["png"], { type: "image/png" });
    finish(png);
    await prepared;
    expect(share.ready(TODAY, "home")).toBe(true);

    // A computer: the picture downloaded, the text copied.
    await expect(share.share(TODAY, "home")).resolves.toBe("saved");
    expect(k.download).toHaveBeenCalledWith(
      png,
      expect.stringContaining("home"),
    );
    const text = vi.mocked(k.copy).mock.calls[0][0];
    expect(text).toContain("HOME");
    expect(text).toContain("100");
  });

  it("opens the share sheet where the browser takes files, at once when the picture is ready", async () => {
    const storage = memory();
    played(storage);
    const { kit: k, finish } = kit({ canShareFiles: vi.fn(() => true) });
    const share = createTodayShare({ kit: k, storage });
    const prepared = share.prepare(TODAY, "home");
    finish(new Blob(["png"], { type: "image/png" }));
    await prepared;
    const job = share.share(TODAY, "home");
    // in the press itself, not a step later
    expect(k.shareFiles).toHaveBeenCalledTimes(1);
    await expect(job).resolves.toBe("shared");
    expect(k.download).not.toHaveBeenCalled();
  });

  it("waits for a picture still being made, and copies the text where none can be made", async () => {
    const storage = memory();
    played(storage);
    const { kit: k, finish } = kit();
    const share = createTodayShare({ kit: k, storage });
    const job = share.share(TODAY, "home");
    expect(k.copy).not.toHaveBeenCalled();
    finish(null);
    // no picture after all: the text alone
    await expect(job).resolves.toBe("copied");

    const { kit: plain } = kit({ canMakeImage: vi.fn(() => false) });
    const textOnly = createTodayShare({ kit: plain, storage });
    expect(textOnly.ready(TODAY, "home")).toBe(false);
    await expect(textOnly.share(TODAY, "home")).resolves.toBe("copied");
    expect(plain.makeImage).not.toHaveBeenCalled();
  });
});
