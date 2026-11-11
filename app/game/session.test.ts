import { describe, expect, it } from "vitest";

import {
  canPass,
  createSession,
  currentQuestion,
  currentTurn,
  isLastQuestion,
  msLeft,
  PASS_AFTER_MS,
  QUESTION_MS,
  reduce,
  summary,
  tableFor,
} from "./session";
import type { Action, Session } from "./session";
import { east, ORIGIN, question } from "./test-fixtures";
import type { Mode, Question } from "./types";

/** Five answers, 111 km apart, heading east from the pin. HOME points: 100, 75, 50, 25, 0. */
function five(id: string): Question {
  return question(id, [
    east("Alpha Near", 1, ["Al"]),
    east("Bravo Smith", 2),
    east("Charlie Smith", 3),
    east("Delta Jones", 4),
    east("Echo Far", 5),
  ]);
}

const QUESTIONS = [five("q1"), five("q2"), five("q3")];
const T0 = 1_000_000;

function start(options: Partial<Parameters<typeof createSession>[0]> = {}) {
  return createSession({
    mode: "home",
    dayNumber: 12,
    stadium: ORIGIN,
    questions: QUESTIONS,
    now: T0,
    ...options,
  });
}

function run(session: Session, ...actions: Action[]): Session {
  return actions.reduce(reduce, session);
}

/** Answer the current question and step through to the next one (or to done). */
function play(session: Session, input: string, now: number): Session {
  return run(
    session,
    { type: "submit", input, now },
    { type: "resolved" },
    { type: "next", now },
  );
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }
  return value;
}

describe("constants", () => {
  it("gives 30 seconds per question and PASS after 8", () => {
    expect(QUESTION_MS).toBe(30_000);
    expect(PASS_AFTER_MS).toBe(8_000);
  });
});

describe("createSession", () => {
  it("starts question 1 with the clock running", () => {
    const s = start();
    expect(s).toEqual({
      mode: "home",
      dayNumber: 12,
      stadium: ORIGIN,
      questions: QUESTIONS,
      index: 0,
      phase: "asking",
      turns: [],
      total: 0,
      startedAt: T0,
      deadline: T0 + QUESTION_MS,
      rejected: null,
      noTimer: false,
    });
    expect(currentQuestion(s)).toBe(QUESTIONS[0]);
    expect(currentTurn(s)).toBeNull();
    expect(isLastQuestion(s)).toBe(false);
  });

  it("has no deadline with noTimer", () => {
    const s = start({ noTimer: true });
    expect(s.deadline).toBeNull();
    expect(s.noTimer).toBe(true);
    expect(s.phase).toBe("asking");
  });

  it("refuses a game with no questions", () => {
    expect(() => start({ questions: [] })).toThrow(/at least one question/);
  });
});

describe("submit", () => {
  it("ignores an empty input", () => {
    const s = start();
    expect(reduce(s, { type: "submit", input: "", now: T0 + 1000 })).toBe(s);
    expect(reduce(s, { type: "submit", input: "   ", now: T0 + 1000 })).toBe(s);
    expect(reduce(s, { type: "submit", input: "-", now: T0 + 1000 })).toBe(s);
  });

  it("rejects an unknown answer and keeps the clock running", () => {
    const s = start();
    const r = reduce(s, { type: "submit", input: " Zidane ", now: T0 + 2000 });
    expect(r).not.toBe(s);
    expect(r.rejected).toEqual({ input: "Zidane", reason: "unknown" });
    expect(r.phase).toBe("asking");
    expect(r.deadline).toBe(T0 + QUESTION_MS);
    expect(r.startedAt).toBe(T0);
    expect(r.turns).toEqual([]);
    expect(r.total).toBe(0);
    expect(r.index).toBe(0);
  });

  it("rejects an ambiguous answer", () => {
    const r = reduce(start(), {
      type: "submit",
      input: "Smith",
      now: T0 + 2000,
    });
    expect(r.rejected).toEqual({ input: "Smith", reason: "ambiguous" });
    expect(r.phase).toBe("asking");
    expect(r.turns).toEqual([]);
  });

  it("makes a fresh rejection every time, even for the same input", () => {
    const first = reduce(start(), {
      type: "submit",
      input: "nope",
      now: T0 + 1,
    });
    const second = reduce(first, {
      type: "submit",
      input: "nope",
      now: T0 + 2,
    });
    expect(second.rejected).toEqual(first.rejected);
    expect(second.rejected).not.toBe(first.rejected);
  });

  it("accepts a valid answer after rejections, with no penalty", () => {
    const s = run(
      start(),
      { type: "submit", input: "Zidane", now: T0 + 2000 },
      { type: "submit", input: "Smith", now: T0 + 4000 },
      { type: "submit", input: " bravo smith ", now: T0 + 6500 },
    );
    expect(s.phase).toBe("resolving");
    expect(s.rejected).toBeNull();
    expect(s.deadline).toBeNull();
    expect(s.index).toBe(0);
    expect(s.total).toBe(75);
    expect(s.turns).toEqual([
      {
        questionId: "q1",
        input: "bravo smith",
        answerId: "bravo-smith",
        grade: "goal",
        points: 75,
        km: 222,
        rank: 2,
        msLeft: QUESTION_MS - 6500,
      },
    ]);
    expect(currentTurn(s)).toBe(s.turns[0]);
  });

  it("grades by the table: best is a worldie, worst is wide", () => {
    const best = reduce(start(), { type: "submit", input: "Al", now: T0 + 1 });
    expect(best.turns[0]).toMatchObject({
      answerId: "alpha-near",
      grade: "worldie",
      points: 100,
      km: 111,
      rank: 1,
    });
    const worst = reduce(start(), {
      type: "submit",
      input: "far",
      now: T0 + 1,
    });
    expect(worst.turns[0]).toMatchObject({
      answerId: "echo-far",
      grade: "wide",
      points: 0,
      km: 556,
      rank: 5,
    });
    expect(worst.total).toBe(0);
  });

  it("forgives a typo", () => {
    const s = reduce(start(), {
      type: "submit",
      input: "delta jonse",
      now: T0,
    });
    expect(s.turns[0]).toMatchObject({
      input: "delta jonse",
      answerId: "delta-jones",
      grade: "wide",
      points: 25,
    });
  });

  it("scores AWAY the other way round", () => {
    const s = start({ mode: "away" });
    const far = reduce(s, { type: "submit", input: "Echo Far", now: T0 + 1 });
    expect(far.turns[0]).toMatchObject({
      points: 100,
      grade: "worldie",
      rank: 1,
    });
    const near = reduce(s, {
      type: "submit",
      input: "Alpha Near",
      now: T0 + 1,
    });
    expect(near.turns[0]).toMatchObject({ points: 0, grade: "wide", rank: 5 });
  });

  it("scores against the session's stadium", () => {
    const s = start({ stadium: { ...ORIGIN, id: "east", lng: 5 } });
    const r = reduce(s, { type: "submit", input: "Echo Far", now: T0 + 1 });
    expect(r.turns[0]).toMatchObject({ points: 100, km: 0, rank: 1 });
  });

  it("counts as time up when it arrives at or after the deadline", () => {
    const s = start();
    const late = reduce(s, {
      type: "submit",
      input: "Alpha Near",
      now: T0 + QUESTION_MS,
    });
    expect(late.turns[0]).toMatchObject({ grade: "timeup", points: 0 });
    const justInTime = reduce(s, {
      type: "submit",
      input: "Alpha Near",
      now: T0 + QUESTION_MS - 1,
    });
    expect(justInTime.turns[0]).toMatchObject({
      grade: "worldie",
      points: 100,
      msLeft: 1,
    });
  });

  it("is ignored outside asking", () => {
    const resolving = reduce(start(), {
      type: "submit",
      input: "Alpha Near",
      now: T0 + 1,
    });
    const again: Action = { type: "submit", input: "Echo Far", now: T0 + 2 };
    expect(reduce(resolving, again)).toBe(resolving);
    const reveal = reduce(resolving, { type: "resolved" });
    expect(reduce(reveal, again)).toBe(reveal);
  });
});

describe("pass", () => {
  it("is not allowed before 8 seconds", () => {
    const s = start();
    expect(canPass(s, T0)).toBe(false);
    expect(canPass(s, T0 + PASS_AFTER_MS - 1)).toBe(false);
    expect(reduce(s, { type: "pass", now: T0 })).toBe(s);
    expect(reduce(s, { type: "pass", now: T0 + PASS_AFTER_MS - 1 })).toBe(s);
  });

  it("is allowed from 8 seconds and scores nothing", () => {
    const s = start();
    expect(canPass(s, T0 + PASS_AFTER_MS)).toBe(true);
    const r = reduce(s, { type: "pass", now: T0 + PASS_AFTER_MS });
    expect(r.phase).toBe("resolving");
    expect(r.deadline).toBeNull();
    expect(r.total).toBe(0);
    expect(r.turns).toEqual([
      {
        questionId: "q1",
        input: null,
        answerId: null,
        grade: "skipped",
        points: 0,
        km: null,
        rank: null,
        msLeft: QUESTION_MS - PASS_AFTER_MS,
      },
    ]);
  });

  it("clears a rejection", () => {
    const r = run(
      start(),
      { type: "submit", input: "nope", now: T0 + 1000 },
      { type: "pass", now: T0 + 9000 },
    );
    expect(r.rejected).toBeNull();
    expect(r.turns[0].grade).toBe("skipped");
  });

  it("counts as time up at or after the deadline", () => {
    const r = reduce(start(), { type: "pass", now: T0 + QUESTION_MS });
    expect(r.turns[0]).toMatchObject({ grade: "timeup", msLeft: 0 });
  });

  it("is only available while asking", () => {
    const resolving = reduce(start(), { type: "pass", now: T0 + 9000 });
    expect(canPass(resolving, T0 + 20_000)).toBe(false);
    expect(reduce(resolving, { type: "pass", now: T0 + 20_000 })).toBe(
      resolving,
    );
    const reveal = reduce(resolving, { type: "resolved" });
    expect(canPass(reveal, T0 + 20_000)).toBe(false);
    expect(reduce(reveal, { type: "pass", now: T0 + 20_000 })).toBe(reveal);
  });

  it("restarts its wait on every question", () => {
    const second = play(start(), "Alpha Near", T0 + 20_000);
    expect(second.index).toBe(1);
    expect(canPass(second, T0 + 20_000 + PASS_AFTER_MS - 1)).toBe(false);
    expect(canPass(second, T0 + 20_000 + PASS_AFTER_MS)).toBe(true);
  });
});

describe("tick", () => {
  it("does nothing while there is time left", () => {
    const s = start();
    expect(reduce(s, { type: "tick", now: T0 })).toBe(s);
    expect(reduce(s, { type: "tick", now: T0 + 15_000 })).toBe(s);
    expect(reduce(s, { type: "tick", now: T0 + QUESTION_MS - 1 })).toBe(s);
  });

  it("calls time at the deadline", () => {
    const r = reduce(start(), { type: "tick", now: T0 + QUESTION_MS });
    expect(r.phase).toBe("resolving");
    expect(r.deadline).toBeNull();
    expect(r.total).toBe(0);
    expect(r.turns).toEqual([
      {
        questionId: "q1",
        input: null,
        answerId: null,
        grade: "timeup",
        points: 0,
        km: null,
        rank: null,
        msLeft: 0,
      },
    ]);
  });

  it("calls time long after the deadline, and clears a rejection", () => {
    const r = run(
      start(),
      { type: "submit", input: "nope", now: T0 + 1000 },
      { type: "tick", now: T0 + 10 * QUESTION_MS },
    );
    expect(r.turns[0].grade).toBe("timeup");
    expect(r.rejected).toBeNull();
  });

  it("is ignored outside asking", () => {
    const resolving = reduce(start(), { type: "tick", now: T0 + QUESTION_MS });
    const late: Action = { type: "tick", now: T0 + 5 * QUESTION_MS };
    expect(reduce(resolving, late)).toBe(resolving);
    const reveal = reduce(resolving, { type: "resolved" });
    expect(reduce(reveal, late)).toBe(reveal);
  });
});

describe("msLeft", () => {
  it("counts down while asking and never goes negative", () => {
    const s = start();
    expect(msLeft(s, T0)).toBe(QUESTION_MS);
    expect(msLeft(s, T0 + 12_345)).toBe(QUESTION_MS - 12_345);
    expect(msLeft(s, T0 + QUESTION_MS)).toBe(0);
    expect(msLeft(s, T0 + QUESTION_MS + 5000)).toBe(0);
    // A clock that jumps backwards cannot add time.
    expect(msLeft(s, T0 - 5000)).toBe(QUESTION_MS);
  });

  it("freezes once the turn is decided", () => {
    const resolving = reduce(start(), {
      type: "submit",
      input: "Alpha Near",
      now: T0 + 4000,
    });
    expect(msLeft(resolving, T0 + 20_000)).toBe(26_000);
    const reveal = reduce(resolving, { type: "resolved" });
    expect(msLeft(reveal, T0 + 90_000)).toBe(26_000);
  });

  it("starts full again on the next question", () => {
    const second = play(start(), "Alpha Near", T0 + 20_000);
    expect(msLeft(second, T0 + 20_000)).toBe(QUESTION_MS);
    expect(msLeft(second, T0 + 21_000)).toBe(QUESTION_MS - 1000);
  });
});

describe("resolved and next", () => {
  it("resolved moves resolving to reveal, and nothing else", () => {
    const asking = start();
    expect(reduce(asking, { type: "resolved" })).toBe(asking);
    const resolving = reduce(asking, {
      type: "submit",
      input: "Alpha Near",
      now: T0 + 1,
    });
    const reveal = reduce(resolving, { type: "resolved" });
    expect(reveal.phase).toBe("reveal");
    expect(reveal.turns).toBe(resolving.turns);
    expect(reveal.index).toBe(0);
    expect(reduce(reveal, { type: "resolved" })).toBe(reveal);
  });

  it("next moves reveal to the next question with a fresh clock", () => {
    const asking = start();
    expect(reduce(asking, { type: "next", now: T0 + 1 })).toBe(asking);
    const resolving = reduce(asking, {
      type: "submit",
      input: "Alpha Near",
      now: T0 + 5000,
    });
    expect(reduce(resolving, { type: "next", now: T0 + 6000 })).toBe(resolving);
    const reveal = reduce(resolving, { type: "resolved" });
    const next = reduce(reveal, { type: "next", now: T0 + 60_000 });
    expect(next).toMatchObject({
      index: 1,
      phase: "asking",
      startedAt: T0 + 60_000,
      deadline: T0 + 60_000 + QUESTION_MS,
      rejected: null,
      total: 100,
    });
    expect(next.turns).toHaveLength(1);
    expect(currentQuestion(next)).toBe(QUESTIONS[1]);
    expect(currentTurn(next)).toBeNull();
  });

  it("goes to done after the last question", () => {
    let s = start();
    s = play(s, "Alpha Near", T0 + 5000);
    s = play(s, "Bravo Smith", T0 + 10_000);
    expect(s.index).toBe(2);
    expect(isLastQuestion(s)).toBe(true);
    s = run(
      s,
      { type: "submit", input: "Charlie Smith", now: T0 + 15_000 },
      { type: "resolved" },
    );
    expect(s.phase).toBe("reveal");
    const done = reduce(s, { type: "next", now: T0 + 90_000 });
    expect(done.phase).toBe("done");
    expect(done.index).toBe(2);
    expect(done.deadline).toBeNull();
    expect(done.total).toBe(225);
    expect(done.turns.map((t) => t.points)).toEqual([100, 75, 50]);
    expect(done.turns.map((t) => t.questionId)).toEqual(["q1", "q2", "q3"]);
    expect(currentQuestion(done)).toBe(QUESTIONS[2]);
    expect(msLeft(done, T0 + 90_000)).toBe(0);
    expect(canPass(done, T0 + 900_000)).toBe(false);
  });

  it("ignores everything once done", () => {
    let done = start();
    for (let i = 0; i < 3; i++) done = play(done, "Alpha Near", T0 + i);
    expect(done.phase).toBe("done");
    const actions: Action[] = [
      { type: "submit", input: "Alpha Near", now: T0 + 10 },
      { type: "pass", now: T0 + 100_000 },
      { type: "tick", now: T0 + 100_000 },
      { type: "resolved" },
      { type: "next", now: T0 + 100_000 },
    ];
    for (const action of actions) expect(reduce(done, action)).toBe(done);
  });

  it("ignores an action it does not know", () => {
    const s = start();
    expect(reduce(s, { type: "restart" } as unknown as Action)).toBe(s);
  });
});

describe("a whole game", () => {
  it("mixes answers, a pass and a time-up, and the total is always the sum", () => {
    let s = start();
    const totals: number[] = [];
    const check = (next: Session) => {
      expect(next.total).toBe(next.turns.reduce((sum, t) => sum + t.points, 0));
      totals.push(next.total);
      return next;
    };
    s = check(
      reduce(s, { type: "submit", input: "Bravo Smith", now: T0 + 3000 }),
    );
    s = run(s, { type: "resolved" }, { type: "next", now: T0 + 10_000 });
    s = check(reduce(s, { type: "pass", now: T0 + 19_000 }));
    s = run(s, { type: "resolved" }, { type: "next", now: T0 + 25_000 });
    s = check(reduce(s, { type: "tick", now: T0 + 25_000 + QUESTION_MS }));
    s = run(s, { type: "resolved" }, { type: "next", now: T0 + 70_000 });
    expect(totals).toEqual([75, 75, 75]);
    expect(s.phase).toBe("done");
    expect(summary(s)).toEqual({
      total: 75,
      tier: 0,
      grades: ["goal", "skipped", "timeup"],
      perfect: false,
    });
  });

  it.each<Mode>(["home", "away"])(
    "seven best answers make a perfect 700 (%s)",
    (mode) => {
      const seven = Array.from({ length: 7 }, (_, i) => five(`q${i + 1}`));
      let s = start({ mode, questions: seven });
      const tiers: number[] = [];
      for (let i = 0; i < 7; i++) {
        s = play(
          s,
          mode === "home" ? "Alpha Near" : "Echo Far",
          T0 + i * 10_000,
        );
        tiers.push(summary(s).tier);
      }
      expect(s.phase).toBe("done");
      expect(s.total).toBe(700);
      expect(tiers).toEqual([1, 2, 3, 4, 5, 6, 7]);
      expect(summary(s)).toEqual({
        total: 700,
        tier: 7,
        grades: Array<string>(7).fill("worldie"),
        perfect: true,
      });
    },
  );

  it("summarises a game in progress", () => {
    expect(summary(start())).toEqual({
      total: 0,
      tier: 0,
      grades: [],
      perfect: false,
    });
    const s = reduce(start(), { type: "submit", input: "Al", now: T0 + 1 });
    expect(summary(s)).toEqual({
      total: 100,
      tier: 1,
      grades: ["worldie"],
      perfect: false,
    });
  });

  it("never changes the session it was given", () => {
    let s = deepFreeze(start());
    const steps: Action[] = [
      { type: "submit", input: "nope", now: T0 + 1000 },
      { type: "submit", input: "Bravo Smith", now: T0 + 2000 },
      { type: "resolved" },
      { type: "next", now: T0 + 3000 },
      { type: "pass", now: T0 + 12_000 },
      { type: "resolved" },
      { type: "next", now: T0 + 13_000 },
      { type: "tick", now: T0 + 50_000 },
      { type: "resolved" },
      { type: "next", now: T0 + 60_000 },
    ];
    for (const action of steps) {
      const next = reduce(s, action);
      expect(next).not.toBe(s);
      s = deepFreeze(next);
    }
    expect(s.phase).toBe("done");
    expect(s.total).toBe(75);
  });
});

describe("noTimer", () => {
  it("never calls time", () => {
    const s = start({ noTimer: true });
    expect(reduce(s, { type: "tick", now: T0 + 100 * QUESTION_MS })).toBe(s);
    expect(msLeft(s, T0 + 100 * QUESTION_MS)).toBe(QUESTION_MS);
  });

  it("accepts an answer however late", () => {
    const s = reduce(start({ noTimer: true }), {
      type: "submit",
      input: "Alpha Near",
      now: T0 + 100 * QUESTION_MS,
    });
    expect(s.phase).toBe("resolving");
    expect(s.turns[0]).toMatchObject({ points: 100, msLeft: QUESTION_MS });
  });

  it("still makes PASS wait 8 seconds", () => {
    const s = start({ noTimer: true });
    expect(canPass(s, T0 + PASS_AFTER_MS - 1)).toBe(false);
    expect(reduce(s, { type: "pass", now: T0 + PASS_AFTER_MS - 1 })).toBe(s);
    expect(canPass(s, T0 + PASS_AFTER_MS)).toBe(true);
    const passed = reduce(s, { type: "pass", now: T0 + 10 * QUESTION_MS });
    expect(passed.turns[0]).toMatchObject({
      grade: "skipped",
      msLeft: QUESTION_MS,
    });
  });

  it("carries through to the next question and to the end", () => {
    let s = play(start({ noTimer: true }), "Alpha Near", T0 + 500_000);
    expect(s).toMatchObject({
      index: 1,
      phase: "asking",
      deadline: null,
      startedAt: T0 + 500_000,
      noTimer: true,
    });
    s = play(s, "Alpha Near", T0 + 900_000);
    s = play(s, "Alpha Near", T0 + 1_900_000);
    expect(s.phase).toBe("done");
    expect(s.total).toBe(300);
  });
});

describe("tableFor", () => {
  it("is the ranked table for a question of this game", () => {
    const table = tableFor(start(), 0);
    expect(table.map((r) => [r.answer.id, r.km, r.points, r.rank])).toEqual([
      ["alpha-near", 111, 100, 1],
      ["bravo-smith", 222, 75, 2],
      ["charlie-smith", 334, 50, 3],
      ["delta-jones", 445, 25, 4],
      ["echo-far", 556, 0, 5],
    ]);
  });

  it("is computed once per question", () => {
    const s = start();
    expect(tableFor(s, 0)).toBe(tableFor(s, 0));
    expect(tableFor(s, 1)).toBe(tableFor(s, 1));
    expect(tableFor(s, 1)).not.toBe(tableFor(s, 0));
    // Another session on the same day shares it.
    expect(tableFor(start(), 0)).toBe(tableFor(s, 0));
    const later = reduce(s, { type: "submit", input: "Al", now: T0 + 1 });
    expect(tableFor(later, 0)).toBe(tableFor(s, 0));
  });

  it("is kept apart by mode and by stadium", () => {
    const home = tableFor(start(), 0);
    const away = tableFor(start({ mode: "away" }), 0);
    expect(away).not.toBe(home);
    expect(away[0].answer.id).toBe("echo-far");
    expect(home[0].answer.id).toBe("alpha-near");
    const elsewhere = tableFor(
      start({ stadium: { ...ORIGIN, id: "east", lng: 5 } }),
      0,
    );
    expect(elsewhere[0].answer.id).toBe("echo-far");
    expect(tableFor(start(), 0)).toBe(home);
  });

  it("is empty for a question that does not exist", () => {
    expect(tableFor(start(), 3)).toEqual([]);
    expect(tableFor(start(), -1)).toEqual([]);
  });

  it("agrees with the turn that was recorded", () => {
    const s = reduce(start(), {
      type: "submit",
      input: "Charlie Smith",
      now: T0 + 1,
    });
    const row = tableFor(s, 0).find((r) => r.answer.id === s.turns[0].answerId);
    expect(row).toMatchObject({
      km: s.turns[0].km,
      points: s.turns[0].points,
      rank: s.turns[0].rank,
    });
  });
});
