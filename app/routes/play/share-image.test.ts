import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { ShareCardPicture } from "~/art/share-card";
import { HOME_QUESTIONS, STADIUMS, questionsFor } from "~/data";
import {
  type Grade,
  type Mode,
  type Session,
  type StorageLike,
  type Today,
  buildShareText,
  createSession,
  dayKeyFor,
  reduce,
  saveSession,
  shareCardFor,
  shareInputFor,
} from "~/game";
import { strings } from "~/i18n";
import {
  GameController,
  SHARE_IMAGE_DELAY_MS,
  SHARE_LABEL_MS,
  tierName,
  titleName,
} from "./controller";
import { type ShareKit, shareCardPicture } from "./share-image";

const full = strings.play.fullTime;

function memory(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

const today: Today = {
  dayNumber: 1,
  dayKey: dayKeyFor(1),
  stadium: STADIUMS[0],
  noTimer: true,
};

/** A whole game (HOME unless said): each question answered with the answer of that shot, or passed. */
function played(grades: readonly Grade[], mode: Mode = "home"): Session {
  const questions = questionsFor(mode);
  let s = createSession({
    mode,
    dayNumber: 1,
    stadium: STADIUMS[0],
    questions,
    now: 0,
    noTimer: true,
  });
  questions.forEach((q, i) => {
    // PASS is there from 8 seconds into each question.
    const now = (i + 1) * 60_000;
    const grade = grades[i];
    const answer = q.answers.find((a) => a.shot === grade);
    if (answer) s = reduce(s, { type: "submit", input: answer.name, now });
    if (s.phase === "asking") s = reduce(s, { type: "pass", now });
    s = reduce(s, { type: "resolved" });
    s = reduce(s, { type: "next", now: now + 1000 });
  });
  return s;
}

const GRADES: Grade[] = [
  "worldie",
  "golazo",
  "trivela",
  "toepoke",
  "tapin",
  "miss",
  "skipped",
];

interface Calls {
  made: ShareCardPicture[];
  shared: ShareData[];
  downloads: { blob: Blob; name: string }[];
  copied: string[];
}

const PNG = new Blob(["png"], { type: "image/png" });

function fakeKit(over: Partial<ShareKit> = {}): {
  kit: ShareKit;
  calls: Calls;
} {
  const calls: Calls = { made: [], shared: [], downloads: [], copied: [] };
  const kit: ShareKit = {
    canMakeImage: () => true,
    makeImage: (picture) => {
      calls.made.push(picture);
      return Promise.resolve(PNG);
    },
    canShareFiles: () => false,
    shareFiles: (data) => {
      calls.shared.push(data);
      return Promise.resolve();
    },
    download: (blob, name) => {
      calls.downloads.push({ blob, name });
      return true;
    },
    copy: (text) => {
      calls.copied.push(text);
      return Promise.resolve();
    },
    ...over,
  };
  return { kit, calls };
}

/** Today's finished game, shown again at full time, with this share kit. */
function atFullTime(kit: ShareKit, session = played(GRADES)): GameController {
  const storage = memory();
  saveSession(session, storage);
  const game = new GameController({
    mode: session.mode,
    today,
    storage,
    restoreFullTime: true,
    shareKit: kit,
  });
  game.start();
  return game;
}

function expectedText(session: Session): string {
  return buildShareText(
    shareInputFor(
      session,
      tierName(session.total),
      titleName(session.mode, session.total),
      strings.home.modes[session.mode].label,
    ),
  );
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("the share picture's words", () => {
  test("come from the game and the interface text", () => {
    const session = played(GRADES);
    const picture = shareCardPicture(
      shareCardFor(session),
      "PIE QUEUE REGULAR",
      "NON-LEAGUE",
    );
    expect(picture.mode).toBe("home");
    expect(picture.modeLabel).toBe("HOME");
    expect(picture.dayLabel).toBe("DAY 1");
    expect(picture.stadium).toBe(STADIUMS[0].name);
    expect(picture.site).toBe(strings.siteName);
    expect(picture.lines).toHaveLength(7);
    expect(picture.lines[0].prompt).toBe("Club that won the Premier League");
    expect(picture.lines.map((l) => l.tag)).toEqual([
      "WORLDIE",
      "GOLAZO",
      "TRIVELA",
      "TOE POKE",
      "TAP IN",
      "MISS",
      "PASSED",
    ]);
    expect(picture.lines[6].answer).toBeNull();
    expect(picture.lines[0].answer).toBe(
      HOME_QUESTIONS[0].answers.find((a) => a.shot === "worldie")?.name,
    );
    expect(picture.perfect).toBeUndefined();
    expect(picture.total).toBe(session.total);
  });

  test("say PERFECT GAME on a 700", () => {
    const session = played(Array<Grade>(7).fill("worldie"));
    expect(session.total).toBe(700);
    const picture = shareCardPicture(shareCardFor(session), "T", "W");
    expect(picture.perfect).toBe(full.perfect);
  });

  test("shorten the question: no 'Name a', no brackets", () => {
    const prompt = full.image.prompt;
    expect(
      prompt(
        "Name a stadium that has hosted a Champions League final (1993 onwards)",
      ),
    ).toBe("Stadium that hosted a Champions League final");
    expect(prompt("Name an English club")).toBe("English club");
    expect(prompt("Name a men's Ballon d'Or winner")).toBe(
      "Men's Ballon d'Or winner",
    );
  });

  test("name the file by the day and the mode", () => {
    expect(full.image.fileName(12, "away")).toBe("soccersense-day-12-away.png");
  });

  test("put each answer's year beside it in RETRO and NEXT-GEN, under the mode's badge", () => {
    const retro = shareCardPicture(
      shareCardFor(played(GRADES, "retro")),
      strings.play.titles.retro.leather,
      "LOWER LEAGUES",
    );
    expect(retro.mode).toBe("retro");
    expect(retro.modeLabel).toBe("RETRO");
    // The year each was ranked by (its first in RETRO), none for the pass.
    // Preston North End, Juventus, Sheffield United, Sweden, Denmark, Vicente del Bosque.
    expect(retro.lines.map((l) => l.year)).toEqual([
      "1889",
      "1905",
      "1899",
      "1992",
      "1992",
      "2010",
      undefined,
    ]);
    const nextgen = shareCardPicture(
      shareCardFor(played(GRADES, "nextgen")),
      "T",
      "W",
    );
    expect(nextgen.modeLabel).toBe("NEXT-GEN");
    expect(nextgen.lines[0].year).toBe("2026");
    // HOME and AWAY rows carry no year.
    const home = shareCardPicture(shareCardFor(played(GRADES)), "T", "W");
    expect(home.lines.every((l) => l.year === undefined)).toBe(true);
  });
});

describe("SHARE", () => {
  test("in NEXT-GEN: the mode's own name in the text, the file and the sheet", async () => {
    const session = played(GRADES, "nextgen");
    const { kit, calls } = fakeKit({ canShareFiles: () => true });
    const game = atFullTime(kit, session);
    await vi.advanceTimersByTimeAsync(SHARE_IMAGE_DELAY_MS);
    game.share();
    await vi.advanceTimersByTimeAsync(0);
    expect(calls.shared).toHaveLength(1);
    const data = calls.shared[0];
    expect(data.text).toBe(expectedText(session));
    expect(data.text?.split("\n")[0]).toContain("· NEXT-GEN ·");
    expect(data.title).toBe(full.image.title(1, "NEXT-GEN"));
    expect(data.files?.[0].name).toBe("soccersense-day-1-nextgen.png");
    expect(calls.made[0].lines[0].year).toBe("2026");
    game.dispose();
  });

  test("makes the picture a moment after full time, once", async () => {
    const { kit, calls } = fakeKit();
    const game = atFullTime(kit);
    expect(calls.made).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(SHARE_IMAGE_DELAY_MS);
    expect(calls.made).toHaveLength(1);
    expect(calls.made[0].lines).toHaveLength(7);
    game.share();
    await vi.advanceTimersByTimeAsync(0);
    expect(calls.made).toHaveLength(1);
    game.dispose();
  });

  test("on a PC: downloads the picture, copies the text, and says so", async () => {
    const { kit, calls } = fakeKit();
    const game = atFullTime(kit);
    await vi.advanceTimersByTimeAsync(SHARE_IMAGE_DELAY_MS);
    game.share();
    await vi.advanceTimersByTimeAsync(0);
    expect(calls.downloads).toEqual([
      { blob: PNG, name: "soccersense-day-1-home.png" },
    ]);
    expect(calls.copied).toEqual([expectedText(game.read().session)]);
    expect(calls.shared).toHaveLength(0);
    expect(game.read().share).toBe("saved");
    expect(game.read().announcement).toBe(full.savedSpoken);
    // The button says SAVED!, then COPIED!, then SHARE again.
    await vi.advanceTimersByTimeAsync(SHARE_LABEL_MS);
    expect(game.read().share).toBe("copied");
    expect(game.read().announcement).toBe(full.savedSpoken);
    await vi.advanceTimersByTimeAsync(SHARE_LABEL_MS);
    expect(game.read().share).toBe("idle");
    game.dispose();
  });

  test("on a phone: opens the share sheet with the picture and the text together", async () => {
    const asked: File[][] = [];
    const { kit, calls } = fakeKit({
      canShareFiles: (files) => {
        asked.push(files);
        return true;
      },
    });
    const game = atFullTime(kit);
    await vi.advanceTimersByTimeAsync(SHARE_IMAGE_DELAY_MS);
    game.share();
    await vi.advanceTimersByTimeAsync(0);
    expect(asked).toHaveLength(1);
    expect(calls.shared).toHaveLength(1);
    const data = calls.shared[0];
    const file = data.files?.[0];
    expect(file?.name).toBe("soccersense-day-1-home.png");
    expect(file?.type).toBe("image/png");
    expect(data.text).toBe(expectedText(game.read().session));
    expect(data.title).toBe("soccersense #1 HOME");
    expect(calls.downloads).toHaveLength(0);
    expect(calls.copied).toHaveLength(0);
    expect(game.read().share).toBe("shared");
    expect(game.read().announcement).toBe(full.sharedSpoken);
    game.dispose();
  });

  test("a share sheet closed by the player leaves SHARE ready, saying nothing", async () => {
    const { kit, calls } = fakeKit({
      canShareFiles: () => true,
      shareFiles: () =>
        Promise.reject(new DOMException("closed", "AbortError")),
    });
    const game = atFullTime(kit);
    await vi.advanceTimersByTimeAsync(SHARE_IMAGE_DELAY_MS);
    game.share();
    await vi.advanceTimersByTimeAsync(0);
    expect(game.read().share).toBe("idle");
    expect(calls.downloads).toHaveLength(0);
    game.dispose();
  });

  test("a share sheet the browser refuses falls back to the download and the copy", async () => {
    const { kit, calls } = fakeKit({
      canShareFiles: () => true,
      shareFiles: () =>
        Promise.reject(new DOMException("too late", "NotAllowedError")),
    });
    const game = atFullTime(kit);
    await vi.advanceTimersByTimeAsync(SHARE_IMAGE_DELAY_MS);
    game.share();
    await vi.advanceTimersByTimeAsync(0);
    expect(calls.downloads).toHaveLength(1);
    expect(calls.copied).toHaveLength(1);
    expect(game.read().share).toBe("saved");
    game.dispose();
  });

  test("says SAVED! when the clipboard says no", async () => {
    const { kit } = fakeKit({ copy: () => Promise.reject(new Error("no")) });
    const game = atFullTime(kit);
    await vi.advanceTimersByTimeAsync(SHARE_IMAGE_DELAY_MS);
    game.share();
    await vi.advanceTimersByTimeAsync(0);
    expect(game.read().share).toBe("downloaded");
    expect(game.read().announcement).toBe(full.downloadedSpoken);
    game.dispose();
  });

  test("is busy while the picture is made, then shares it", async () => {
    let finish: (blob: Blob | null) => void = () => {};
    const { kit, calls } = fakeKit({
      makeImage: (picture) => {
        calls.made.push(picture);
        return new Promise((resolve) => {
          finish = resolve;
        });
      },
    });
    const game = atFullTime(kit);
    // Pressed straight away: the picture is started there and then.
    game.share();
    expect(game.read().share).toBe("making");
    expect(game.read().announcement).toBe(full.makingSpoken);
    game.share();
    await vi.advanceTimersByTimeAsync(SHARE_IMAGE_DELAY_MS);
    expect(calls.made).toHaveLength(1);
    expect(calls.downloads).toHaveLength(0);
    finish(PNG);
    await vi.advanceTimersByTimeAsync(0);
    expect(calls.downloads).toHaveLength(1);
    expect(calls.copied).toHaveLength(1);
    expect(game.read().share).toBe("saved");
    game.dispose();
  });

  test("copies the text as it always did where no picture can be made", async () => {
    const { kit, calls } = fakeKit({ canMakeImage: () => false });
    const game = atFullTime(kit);
    await vi.advanceTimersByTimeAsync(SHARE_IMAGE_DELAY_MS);
    expect(calls.made).toHaveLength(0);
    game.share();
    await vi.advanceTimersByTimeAsync(0);
    expect(calls.copied).toEqual([expectedText(game.read().session)]);
    expect(game.read().share).toBe("copied");
    expect(game.read().announcement).toBe(full.copiedSpoken);
    game.dispose();
  });

  test("copies the text when the picture could not be made after all", async () => {
    const { kit, calls } = fakeKit({ makeImage: () => Promise.resolve(null) });
    const game = atFullTime(kit);
    await vi.advanceTimersByTimeAsync(SHARE_IMAGE_DELAY_MS);
    game.share();
    await vi.advanceTimersByTimeAsync(0);
    expect(calls.downloads).toHaveLength(0);
    expect(game.read().share).toBe("copied");
    game.dispose();
  });

  test("a picture that fails to make is a picture not made", async () => {
    const { kit } = fakeKit({
      makeImage: () => Promise.reject(new Error("no canvas")),
    });
    const game = atFullTime(kit);
    game.share();
    await vi.advanceTimersByTimeAsync(0);
    expect(game.read().share).toBe("copied");
    game.dispose();
  });

  test("does nothing once the page has gone", async () => {
    const { kit, calls } = fakeKit();
    const game = atFullTime(kit);
    game.dispose();
    await vi.advanceTimersByTimeAsync(SHARE_IMAGE_DELAY_MS);
    expect(calls.made).toHaveLength(0);
    game.share();
    await vi.advanceTimersByTimeAsync(0);
    expect(calls.copied).toHaveLength(0);
  });
});
