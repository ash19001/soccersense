import { describe, expect, it } from "vitest";

import { PASS_AFTER_MS, QUESTION_MS, createSession, reduce } from "./session";
import type { Action, Session } from "./session";
import { buildShareText } from "./share";
import { ORIGIN, east, popular, question } from "./test-fixtures";
import {
  clockView,
  pips,
  progressFor,
  questionView,
  results,
  revealFor,
  shareInputFor,
} from "./view";

const T0 = 50_000;

/** Ten answers one degree apart: from ORIGIN the HOME points run 100, 89, 78 ... 11, 0. */
const LONG = question(
  "long",
  Array.from({ length: 10 }, (_, i) => east(`Answer ${i}`, i + 1)),
);
const SHORT = question("short", [east("Near", 1), east("Far", 9)]);
const LAST = question("last", [east("Only", 4)]);

function start(mode: "home" | "away" = "home", noTimer = false): Session {
  return createSession({
    mode,
    dayNumber: 12,
    stadium: ORIGIN,
    questions: [LONG, SHORT, LAST],
    now: T0,
    noTimer,
  });
}

function run(session: Session, ...actions: Action[]): Session {
  return actions.reduce(reduce, session);
}

describe("questionView", () => {
  it("is everything the board shows for the question", () => {
    expect(questionView(start("away"))).toEqual({
      number: 1,
      count: 3,
      question: LONG,
      prompt: LONG.prompt,
      mode: "away",
      rule: "niche",
      stadium: ORIGIN,
      measure: "birthplace",
      measureLabel: "where it was born",
      isLast: false,
    });
  });

  it("follows the game to the last question and stays there", () => {
    let s = run(
      start(),
      { type: "submit", input: "Answer 0", now: T0 + 1 },
      { type: "resolved" },
    );
    expect(questionView(s).number).toBe(1);
    s = run(s, { type: "next", now: T0 + 2 });
    expect(questionView(s)).toMatchObject({
      number: 2,
      question: SHORT,
      isLast: false,
    });
    s = run(
      s,
      { type: "submit", input: "Near", now: T0 + 3 },
      { type: "resolved" },
      { type: "next", now: T0 + 4 },
    );
    expect(questionView(s)).toMatchObject({ number: 3, isLast: true });
    s = run(
      s,
      { type: "submit", input: "Only", now: T0 + 5 },
      { type: "resolved" },
      { type: "next", now: T0 + 6 },
    );
    expect(s.phase).toBe("done");
    expect(questionView(s)).toMatchObject({
      number: 3,
      count: 3,
      question: LAST,
      isLast: true,
    });
  });
});

describe("clockView", () => {
  it("starts full, with PASS 8 seconds away", () => {
    expect(clockView(start(), T0)).toEqual({
      msLeft: QUESTION_MS,
      secondsLeft: 30,
      fraction: 1,
      running: true,
      canPass: false,
      msUntilPass: PASS_AFTER_MS,
    });
  });

  it.each([
    [1, 30],
    [999, 30],
    [1000, 29],
    [1001, 29],
    [28_999, 2],
    [29_000, 1],
    [29_999, 1],
    [30_000, 0],
    [45_000, 0],
  ])("after %i ms shows %i seconds", (elapsed, seconds) => {
    const view = clockView(start(), T0 + elapsed);
    expect(view.secondsLeft).toBe(seconds);
    expect(view.msLeft).toBe(Math.max(0, QUESTION_MS - elapsed));
    expect(view.fraction).toBeCloseTo(view.msLeft / QUESTION_MS, 10);
  });

  it("counts PASS in", () => {
    const s = start();
    expect(clockView(s, T0 + 3000)).toMatchObject({
      canPass: false,
      msUntilPass: 5000,
    });
    expect(clockView(s, T0 + PASS_AFTER_MS - 1)).toMatchObject({
      canPass: false,
      msUntilPass: 1,
    });
    expect(clockView(s, T0 + PASS_AFTER_MS)).toMatchObject({
      canPass: true,
      msUntilPass: 0,
    });
    expect(clockView(s, T0 + 20_000)).toMatchObject({
      canPass: true,
      msUntilPass: 0,
    });
  });

  it("freezes once the question is decided, and offers no PASS", () => {
    const s = run(start(), { type: "pass", now: T0 + 12_345 });
    expect(clockView(s, T0 + 25_000)).toEqual({
      msLeft: QUESTION_MS - 12_345,
      secondsLeft: 18,
      fraction: (QUESTION_MS - 12_345) / QUESTION_MS,
      running: false,
      canPass: false,
      msUntilPass: null,
    });
  });

  it("stays full and stopped with no timer, but PASS still waits", () => {
    const s = start("home", true);
    expect(clockView(s, T0 + 999_999)).toEqual({
      msLeft: QUESTION_MS,
      secondsLeft: 30,
      fraction: 1,
      running: false,
      canPass: true,
      msUntilPass: 0,
    });
    expect(clockView(s, T0 + 1000)).toMatchObject({
      canPass: false,
      msUntilPass: 7000,
    });
  });

  it("is safe for a time that is not a number, or one before the start", () => {
    for (const now of [NaN, Infinity, T0 - 5000]) {
      const view = clockView(start(), now);
      expect(view).toEqual({
        msLeft: QUESTION_MS,
        secondsLeft: 30,
        fraction: 1,
        running: true,
        canPass: false,
        msUntilPass: PASS_AFTER_MS,
      });
    }
  });
});

describe("revealFor", () => {
  it("is null until the question is decided", () => {
    expect(revealFor(start())).toBeNull();
    expect(revealFor(start(), 1)).toBeNull();
    expect(revealFor(start(), 99)).toBeNull();
    expect(revealFor(start(), -1)).toBeNull();
  });

  it("has the turn, the answer, its row, the best row and one row for each shot that scores", () => {
    const s = run(start(), {
      type: "submit",
      input: "answer 3",
      now: T0 + 2000,
    });
    const reveal = revealFor(s);
    expect(reveal).not.toBeNull();
    if (!reveal) return;
    expect(reveal.index).toBe(0);
    expect(reveal.question).toBe(LONG);
    expect(reveal.turn).toBe(s.turns[0]);
    expect(reveal.answer).toBe(LONG.answers[3]);
    expect(reveal.row).toMatchObject({
      points: 60,
      rank: 4,
      km: 445,
      share: 176,
    });
    expect(reveal.best?.answer).toBe(LONG.answers[0]);
    expect(reveal.best?.points).toBe(100);
    expect(reveal.tableSize).toBe(10);
    expect(reveal.isLast).toBe(false);
    // HOME, the shots of the ten: worldie, golazo x2, trivela, toe poke x2, tap in x2,
    // miss x2. Each shot the player did not get shows its most popular answer.
    expect(reveal.rows.map((r) => [r.shot, r.answer.name, r.index])).toEqual([
      ["worldie", "Answer 0", 0],
      ["golazo", "Answer 1", 1],
      ["trivela", "Answer 3", 3],
      ["toepoke", "Answer 4", 4],
      ["tapin", "Answer 6", 6],
    ]);
    expect(reveal.rows.map((r) => r.isPlayer)).toEqual([
      false,
      false,
      true,
      false,
      false,
    ]);
    expect(reveal.playerInRows).toBe(true);
    // The turn and the highlighted row always agree.
    const mine = reveal.rows.find((r) => r.isPlayer);
    expect(mine).toMatchObject({
      points: reveal.turn.points,
      km: reveal.turn.km,
      share: reveal.turn.share,
      rank: reveal.turn.rank,
    });
  });

  it("puts the player's answer in its shot's row, in place of that shot's best answer", () => {
    const s = run(start(), {
      type: "submit",
      input: "answer 2",
      now: T0 + 2000,
    });
    const reveal = revealFor(s);
    expect(reveal?.rows.map((r) => r.answer.name)).toEqual([
      "Answer 0",
      "Answer 2",
      "Answer 3",
      "Answer 4",
      "Answer 6",
    ]);
    expect(reveal?.rows[1].isPlayer).toBe(true);
    expect(reveal?.rows.filter((r) => r.isPlayer)).toHaveLength(1);
  });

  it("ranks HOME by the most common answer and AWAY by the most uncommon", () => {
    // Popularity runs against distance here: the nearest answer is the rarest.
    const crowd = question("crowd", [
      { ...popular("Rare", 0.4), lat: 0, lng: 1 },
      { ...popular("Middling", 12.5), lat: 0, lng: 2 },
      { ...popular("Everyone", 87.1), lat: 0, lng: 3 },
    ]);
    const game = (mode: "home" | "away") =>
      createSession({
        mode,
        dayNumber: 12,
        stadium: ORIGIN,
        questions: [crowd],
        now: T0,
      });
    const home = run(game("home"), {
      type: "submit",
      input: "Everyone",
      now: T0 + 1,
    });
    expect(questionView(home).rule).toBe("common");
    expect(revealFor(home)?.turn).toMatchObject({
      grade: "worldie",
      points: 100,
      share: 87.1,
      km: 334,
    });
    // Three answers in three shots, one of them a miss: two rows.
    expect(revealFor(home)?.rows.map((r) => r.answer.name)).toEqual([
      "Everyone",
      "Middling",
    ]);
    const away = run(game("away"), {
      type: "submit",
      input: "Everyone",
      now: T0 + 1,
    });
    expect(questionView(away).rule).toBe("niche");
    expect(revealFor(away)?.turn).toMatchObject({ grade: "miss", points: 0 });
    expect(revealFor(away)?.best?.answer.name).toBe("Rare");
    expect(revealFor(away)?.best?.share).toBe(0.4);
    expect(revealFor(away)?.rows.map((r) => r.answer.name)).toEqual([
      "Rare",
      "Middling",
    ]);
    expect(revealFor(away)?.playerInRows).toBe(false);
  });

  it("leaves a listed miss out of the rows, and still knows its row in the table", () => {
    const s = run(start(), {
      type: "submit",
      input: "answer 8",
      now: T0 + 2000,
    });
    const reveal = revealFor(s);
    expect(reveal?.turn).toMatchObject({ grade: "miss", points: 0 });
    expect(reveal?.row).toMatchObject({ shot: "miss", rank: 9, share: 171 });
    expect(reveal?.answer).toBe(LONG.answers[8]);
    expect(reveal?.rows.map((r) => r.shot)).toEqual([
      "worldie",
      "golazo",
      "trivela",
      "toepoke",
      "tapin",
    ]);
    expect(reveal?.rows.some((r) => r.isPlayer)).toBe(false);
    expect(reveal?.playerInRows).toBe(false);
  });

  it("marks no row for a pass or a time-up, and still shows one answer for each shot", () => {
    const passed = run(start(), { type: "pass", now: T0 + 9000 });
    const timedOut = run(start(), { type: "tick", now: T0 + QUESTION_MS });
    for (const s of [passed, timedOut]) {
      const reveal = revealFor(s);
      expect(reveal?.answer).toBeNull();
      expect(reveal?.row).toBeNull();
      expect(reveal?.rows).toHaveLength(5);
      expect(reveal?.rows.some((r) => r.isPlayer)).toBe(false);
      expect(reveal?.playerInRows).toBe(false);
      expect(reveal?.best?.answer).toBe(LONG.answers[0]);
    }
    expect(revealFor(passed)?.turn.grade).toBe("skipped");
    expect(revealFor(timedOut)?.turn.grade).toBe("timeup");
  });

  it("ranks the table for the session's own mode", () => {
    const s = run(start("away"), {
      type: "submit",
      input: "answer 9",
      now: T0 + 1,
    });
    const reveal = revealFor(s);
    expect(reveal?.best?.answer).toBe(LONG.answers[9]);
    expect(reveal?.turn).toMatchObject({ grade: "worldie", points: 100 });
    expect(reveal?.rows[0].isPlayer).toBe(true);
    // AWAY shows each shot's best answer: the least picked in it, which is the first of its
    // shot in an AWAY table (Answer 8, 171, over Answer 7, 172).
    expect(reveal?.rows.map((r) => r.answer.name)).toEqual([
      "Answer 9",
      "Answer 8",
      "Answer 6",
      "Answer 5",
      "Answer 3",
    ]);
  });

  it("can look back at any decided question, and knows the last one", () => {
    const s = run(
      start(),
      { type: "submit", input: "answer 0", now: T0 + 1 },
      { type: "resolved" },
      { type: "next", now: T0 + 2 },
      { type: "submit", input: "far", now: T0 + 3 },
      { type: "resolved" },
      { type: "next", now: T0 + 4 },
      { type: "submit", input: "only", now: T0 + 5 },
    );
    expect(revealFor(s, 0)?.answer).toBe(LONG.answers[0]);
    expect(revealFor(s, 1)).toMatchObject({
      index: 1,
      question: SHORT,
      isLast: false,
      tableSize: 2,
      playerInRows: false,
    });
    expect(revealFor(s, 1)?.turn.points).toBe(0);
    expect(revealFor(s, 1)?.rows.map((r) => r.answer.name)).toEqual(["Near"]);
    expect(revealFor(s)).toMatchObject({ index: 2, isLast: true });
    expect(revealFor(s)?.rows).toHaveLength(1);
    expect(revealFor(s)?.turn.points).toBe(100);
  });

  it("returns the same row objects' data every call", () => {
    const s = run(start(), { type: "submit", input: "answer 2", now: T0 + 1 });
    expect(revealFor(s)).toEqual(revealFor(s));
  });
});

describe("progressFor", () => {
  it("is still while a question is being asked", () => {
    const view = progressFor(start());
    expect(view).toMatchObject({
      totalBefore: 0,
      total: 0,
      gained: 0,
      promotions: [],
    });
    expect(view.before).toEqual(view.after);
    expect(view.after).toMatchObject({ tier: 0, id: "park", progress: 0 });
  });

  it("gives the meter its start, its end and the promotions in between", () => {
    const s = run(start(), { type: "submit", input: "answer 0", now: T0 + 1 });
    expect(s.phase).toBe("resolving");
    const view = progressFor(s);
    expect(view).toMatchObject({
      totalBefore: 0,
      total: 100,
      gained: 100,
      promotions: [1],
    });
    expect(view.before).toMatchObject({ tier: 0, id: "park" });
    expect(view.after).toMatchObject({ tier: 1, id: "sunday", next: 180 });
    expect(view.after.progress).toBeCloseTo(10 / 90, 10);
    // The same through the reveal.
    expect(progressFor(run(s, { type: "resolved" }))).toEqual(view);
  });

  it("starts from the new total on the next question", () => {
    const s = run(
      start(),
      { type: "submit", input: "answer 0", now: T0 + 1 },
      { type: "resolved" },
      { type: "next", now: T0 + 2 },
    );
    expect(progressFor(s)).toMatchObject({
      totalBefore: 100,
      total: 100,
      gained: 0,
      promotions: [],
    });
    const more = run(s, { type: "submit", input: "near", now: T0 + 3 });
    expect(progressFor(more)).toMatchObject({
      totalBefore: 100,
      total: 200,
      gained: 100,
      promotions: [2],
    });
  });

  it("shows nothing gained for a pass, a time-up or a zero", () => {
    for (const action of [
      { type: "pass", now: T0 + 9000 },
      { type: "tick", now: T0 + QUESTION_MS },
      { type: "submit", input: "answer 9", now: T0 + 1 },
    ] satisfies Action[]) {
      expect(progressFor(run(start(), action))).toMatchObject({
        totalBefore: 0,
        total: 0,
        gained: 0,
        promotions: [],
      });
    }
  });

  it("keeps showing the last question's step at full time", () => {
    const s = run(
      start(),
      { type: "pass", now: T0 + 9000 },
      { type: "resolved" },
      { type: "next", now: T0 + 1 },
      { type: "pass", now: T0 + 9001 },
      { type: "resolved" },
      { type: "next", now: T0 + 2 },
      { type: "submit", input: "only", now: T0 + 3 },
      { type: "resolved" },
      { type: "next", now: T0 + 4 },
    );
    expect(s.phase).toBe("done");
    expect(progressFor(s)).toMatchObject({
      totalBefore: 0,
      total: 100,
      gained: 100,
      promotions: [1],
    });
  });
});

describe("pips, results and the share text", () => {
  const played = run(
    start(),
    { type: "submit", input: "answer 1", now: T0 + 1 },
    { type: "resolved" },
    { type: "next", now: T0 + 2 },
    { type: "pass", now: T0 + 9000 },
  );

  it("pips has one slot per question, filled as the game goes", () => {
    expect(pips(start())).toEqual([null, null, null]);
    expect(pips(played)).toEqual(["golazo", "skipped", null]);
  });

  it("results pairs each decided question with the answer given", () => {
    const lines = results(played);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toEqual({
      index: 0,
      question: LONG,
      turn: played.turns[0],
      answer: LONG.answers[1],
    });
    expect(lines[1]).toMatchObject({ index: 1, question: SHORT, answer: null });
    expect(results(start())).toEqual([]);
  });

  it("shareInputFor feeds buildShareText", () => {
    const input = shareInputFor(played, "SUNDAY LEAGUE");
    expect(input).toEqual({
      dayNumber: 12,
      mode: "home",
      stadiumName: "ORIGIN",
      total: 80,
      tierName: "SUNDAY LEAGUE",
      grades: ["golazo", "skipped"],
    });
    expect(buildShareText(input).split("\n").slice(0, 2)).toEqual([
      "soccersense #12 · HOME · ORIGIN",
      "80/700 · SUNDAY LEAGUE",
    ]);
    const titled = shareInputFor(
      played,
      "SUNDAY LEAGUE",
      "STILL FINDING A SEAT",
    );
    expect(titled.title).toBe("STILL FINDING A SEAT");
    expect(buildShareText(titled).split("\n").slice(0, 3)).toEqual([
      "soccersense #12 · HOME · ORIGIN",
      "STILL FINDING A SEAT",
      "80/700 · SUNDAY LEAGUE",
    ]);
  });
});
