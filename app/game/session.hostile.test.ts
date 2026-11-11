/**
 * The reducer under attack: every action in every phase, the exact boundaries of the clock
 * and of PASS, double submits, the last question, and a long random walk.
 */
import { describe, expect, it } from "vitest";

import {
  PASS_AFTER_MS,
  QUESTION_MS,
  canPass,
  createSession,
  currentQuestion,
  currentTurn,
  isLastQuestion,
  msLeft,
  reduce,
  summary,
  tableFor,
} from "./session";
import type { Action, Phase, Session } from "./session";
import { ORIGIN, east, question } from "./test-fixtures";

const T0 = 1_000_000;
const DEADLINE = T0 + QUESTION_MS;

const QUESTIONS = [
  question("q1", [east("Alpha", 1), east("Bravo", 2), east("Charlie", 3)]),
  question("q2", [east("Delta", 1), east("Echo", 2), east("Foxtrot", 3)]),
  question("q3", [east("Golf", 1), east("Hotel", 2), east("India", 3)]),
];

function start(noTimer = false): Session {
  return createSession({
    mode: "home",
    dayNumber: 1,
    stadium: ORIGIN,
    questions: QUESTIONS,
    now: T0,
    noTimer,
  });
}

function run(session: Session, ...actions: Action[]): Session {
  return actions.reduce(reduce, session);
}

const submit = (input: string, now: number): Action => ({
  type: "submit",
  input,
  now,
});
const pass = (now: number): Action => ({ type: "pass", now });
const tick = (now: number): Action => ({ type: "tick", now });
const resolved: Action = { type: "resolved" };
const next = (now: number): Action => ({ type: "next", now });

/** A session parked in each phase, on the first question and on the last. */
function parked(): Record<string, Session> {
  const asking = start();
  const resolving = run(asking, submit("Alpha", T0 + 1000));
  const reveal = run(resolving, resolved);
  const lastAsking = run(
    reveal,
    next(T0),
    submit("Delta", T0 + 1000),
    resolved,
    next(T0),
  );
  const lastResolving = run(lastAsking, submit("Golf", T0 + 1000));
  const lastReveal = run(lastResolving, resolved);
  const done = run(lastReveal, next(T0 + 5000));
  return {
    asking,
    resolving,
    reveal,
    lastAsking,
    lastResolving,
    lastReveal,
    done,
  };
}

describe("every action in every phase", () => {
  const states = parked();

  it("parks the sessions where the test expects them", () => {
    const phases = Object.fromEntries(
      Object.entries(states).map(([name, s]) => [name, [s.phase, s.index]]),
    );
    expect(phases).toEqual({
      asking: ["asking", 0],
      resolving: ["resolving", 0],
      reveal: ["reveal", 0],
      lastAsking: ["asking", 2],
      lastResolving: ["resolving", 2],
      lastReveal: ["reveal", 2],
      done: ["done", 2],
    });
  });

  /** What each action does from each parked state: the new phase, or "same" for ignored. */
  const table: [string, Action, Record<string, Phase | "same">][] = [
    [
      "submit a valid answer",
      submit("Bravo", T0 + 2000),
      {
        asking: "resolving",
        resolving: "same",
        reveal: "same",
        lastAsking: "same", // "Bravo" is not an answer to question 3: rejected, see below
        lastResolving: "same",
        lastReveal: "same",
        done: "same",
      },
    ],
    [
      "submit an empty answer",
      submit("   ", T0 + 2000),
      {
        asking: "same",
        resolving: "same",
        reveal: "same",
        lastAsking: "same",
        lastResolving: "same",
        lastReveal: "same",
        done: "same",
      },
    ],
    [
      "submit after the deadline",
      submit("Alpha", DEADLINE + 1),
      {
        asking: "resolving",
        resolving: "same",
        reveal: "same",
        lastAsking: "resolving",
        lastResolving: "same",
        lastReveal: "same",
        done: "same",
      },
    ],
    [
      "pass before 8 seconds",
      pass(T0 + PASS_AFTER_MS - 1),
      {
        asking: "same",
        resolving: "same",
        reveal: "same",
        lastAsking: "same",
        lastResolving: "same",
        lastReveal: "same",
        done: "same",
      },
    ],
    [
      "pass after 8 seconds",
      pass(T0 + PASS_AFTER_MS + 1),
      {
        asking: "resolving",
        resolving: "same",
        reveal: "same",
        lastAsking: "resolving",
        lastResolving: "same",
        lastReveal: "same",
        done: "same",
      },
    ],
    [
      "tick with time left",
      tick(T0 + 10_000),
      {
        asking: "same",
        resolving: "same",
        reveal: "same",
        lastAsking: "same",
        lastResolving: "same",
        lastReveal: "same",
        done: "same",
      },
    ],
    [
      "tick after the deadline",
      tick(DEADLINE + 50),
      {
        asking: "resolving",
        resolving: "same",
        reveal: "same",
        lastAsking: "resolving",
        lastResolving: "same",
        lastReveal: "same",
        done: "same",
      },
    ],
    [
      "resolved",
      resolved,
      {
        asking: "same",
        resolving: "reveal",
        reveal: "same",
        lastAsking: "same",
        lastResolving: "reveal",
        lastReveal: "same",
        done: "same",
      },
    ],
    [
      "next",
      next(T0 + 40_000),
      {
        asking: "same",
        resolving: "same",
        reveal: "asking",
        lastAsking: "same",
        lastResolving: "same",
        lastReveal: "done",
        done: "same",
      },
    ],
  ];

  for (const [name, action, expected] of table) {
    for (const [stateName, outcome] of Object.entries(expected)) {
      it(`${name}, while ${stateName}: ${outcome}`, () => {
        const before = states[stateName];
        const frozen = JSON.stringify(before);
        const after = reduce(before, action);
        if (outcome === "same") {
          // A rejection is the one "nothing happened" that returns a new object.
          const rejected =
            action.type === "submit" &&
            action.input.trim() !== "" &&
            before.phase === "asking";
          if (rejected) {
            expect(after.phase).toBe("asking");
            expect(after.turns).toBe(before.turns);
            expect(after.total).toBe(before.total);
            expect(after.deadline).toBe(before.deadline);
            expect(after.rejected).toEqual({
              input: "Bravo",
              reason: "unknown",
            });
          } else {
            expect(after).toBe(before);
          }
        } else {
          expect(after).not.toBe(before);
          expect(after.phase).toBe(outcome);
        }
        // Never mutates what it was given.
        expect(JSON.stringify(before)).toBe(frozen);
      });
    }
  }
});

describe("the deadline, to the millisecond", () => {
  it("has a millisecond left one millisecond before", () => {
    const s = start();
    expect(msLeft(s, DEADLINE - 1)).toBe(1);
    expect(reduce(s, tick(DEADLINE - 1))).toBe(s);
    const answered = reduce(s, submit("Alpha", DEADLINE - 1));
    expect(currentTurn(answered)).toMatchObject({
      grade: "worldie",
      points: 100,
      msLeft: 1,
    });
  });

  it("is time up exactly at the deadline, for tick, submit and pass alike", () => {
    const s = start();
    expect(msLeft(s, DEADLINE)).toBe(0);
    for (const action of [
      tick(DEADLINE),
      submit("Alpha", DEADLINE),
      pass(DEADLINE),
    ]) {
      const after = reduce(s, action);
      expect(after.phase).toBe("resolving");
      expect(currentTurn(after)).toEqual({
        questionId: "q1",
        input: null,
        answerId: null,
        grade: "timeup",
        points: 0,
        km: null,
        rank: null,
        msLeft: 0,
      });
      expect(after.total).toBe(0);
      expect(after.deadline).toBeNull();
    }
  });

  it("is still time up for a rubbish or empty submit after the deadline", () => {
    const s = start();
    expect(currentTurn(reduce(s, submit("", DEADLINE + 5)))?.grade).toBe(
      "timeup",
    );
    expect(currentTurn(reduce(s, submit("zzz", DEADLINE + 5)))?.grade).toBe(
      "timeup",
    );
  });

  it("gives every question its own 30 seconds from the moment of next", () => {
    const later = T0 + 123_456;
    const s = run(start(), tick(DEADLINE), resolved, next(later));
    expect(s.index).toBe(1);
    expect(s.startedAt).toBe(later);
    expect(s.deadline).toBe(later + QUESTION_MS);
    expect(msLeft(s, later)).toBe(QUESTION_MS);
    expect(reduce(s, tick(later + QUESTION_MS - 1))).toBe(s);
    expect(reduce(s, tick(later + QUESTION_MS)).phase).toBe("resolving");
  });

  it("time spent on the reveal sheet costs nothing", () => {
    const s = run(start(), submit("Alpha", T0 + 100), resolved);
    // An hour later, still on the reveal: ticks do nothing.
    expect(reduce(s, tick(T0 + 3_600_000))).toBe(s);
    expect(msLeft(s, T0 + 3_600_000)).toBe(QUESTION_MS - 100);
  });

  it("never reports more than a full clock, even if the clock goes backwards", () => {
    const s = start();
    expect(msLeft(s, T0 - 60_000)).toBe(QUESTION_MS);
    expect(canPass(s, T0 - 60_000)).toBe(false);
    expect(reduce(s, tick(T0 - 60_000))).toBe(s);
    const early = reduce(s, submit("Alpha", T0 - 60_000));
    expect(currentTurn(early)?.msLeft).toBe(QUESTION_MS);
  });
});

describe("PASS, to the millisecond", () => {
  it("is refused at 7.999 seconds and allowed at exactly 8", () => {
    const s = start();
    expect(canPass(s, T0)).toBe(false);
    expect(canPass(s, T0 + PASS_AFTER_MS - 1)).toBe(false);
    expect(reduce(s, pass(T0 + PASS_AFTER_MS - 1))).toBe(s);
    expect(canPass(s, T0 + PASS_AFTER_MS)).toBe(true);
    const after = reduce(s, pass(T0 + PASS_AFTER_MS));
    expect(after.phase).toBe("resolving");
    expect(currentTurn(after)).toEqual({
      questionId: "q1",
      input: null,
      answerId: null,
      grade: "skipped",
      points: 0,
      km: null,
      rank: null,
      msLeft: QUESTION_MS - PASS_AFTER_MS,
    });
  });

  it("is allowed up to the last millisecond and is a time-up after it", () => {
    const s = start();
    expect(currentTurn(reduce(s, pass(DEADLINE - 1)))?.grade).toBe("skipped");
    expect(currentTurn(reduce(s, pass(DEADLINE)))?.grade).toBe("timeup");
  });

  it("is not available once the question is decided", () => {
    const s = run(start(), submit("Alpha", T0 + 1000));
    expect(canPass(s, T0 + 20_000)).toBe(false);
    const done = parked().done;
    expect(canPass(done, T0 + 999_999)).toBe(false);
  });

  it("waits 8 seconds again on each question, with or without a timer", () => {
    for (const noTimer of [false, true]) {
      const at = T0 + 50_000;
      const s = run(
        start(noTimer),
        pass(T0 + PASS_AFTER_MS),
        resolved,
        next(at),
      );
      expect(s.phase).toBe("asking");
      expect(canPass(s, at + PASS_AFTER_MS - 1)).toBe(false);
      expect(canPass(s, at + PASS_AFTER_MS)).toBe(true);
    }
  });
});

describe("double actions", () => {
  it("a second submit in the same instant is ignored", () => {
    const once = reduce(start(), submit("Alpha", T0 + 500));
    const twice = reduce(once, submit("Alpha", T0 + 500));
    expect(twice).toBe(once);
    expect(reduce(once, submit("Charlie", T0 + 501))).toBe(once);
    expect(once.turns).toHaveLength(1);
    expect(once.total).toBe(100);
  });

  it("a submit and a tick racing at the deadline record one turn", () => {
    const a = run(start(), tick(DEADLINE), submit("Alpha", DEADLINE));
    const b = run(start(), submit("Alpha", DEADLINE), tick(DEADLINE));
    expect(a.turns).toHaveLength(1);
    expect(b.turns).toHaveLength(1);
    expect(a.turns[0]).toEqual(b.turns[0]);
  });

  it("a double pass, a double resolved and a double next each count once", () => {
    let s = run(start(), pass(T0 + 9000), pass(T0 + 9001));
    expect(s.turns).toHaveLength(1);
    s = run(s, resolved, resolved);
    expect(s.phase).toBe("reveal");
    s = run(s, next(T0 + 10_000), next(T0 + 10_001));
    expect(s.index).toBe(1);
    expect(s.phase).toBe("asking");
    expect(s.startedAt).toBe(T0 + 10_000);
  });

  it("the same answer may be given to different questions, never twice to one", () => {
    const q = question("same", [east("Alpha", 1), east("Bravo", 2)]);
    let s = createSession({
      mode: "away",
      dayNumber: 1,
      stadium: ORIGIN,
      questions: [q, q],
      now: T0,
    });
    s = run(s, submit("Bravo", T0 + 1), submit("Bravo", T0 + 2));
    expect(s.turns).toHaveLength(1);
    s = run(s, resolved, next(T0 + 3), submit("Bravo", T0 + 4));
    expect(s.turns.map((t) => t.points)).toEqual([100, 100]);
    expect(s.total).toBe(200);
  });
});

describe("the last question and after", () => {
  it("next on the last question ends the game and keeps the last question in view", () => {
    const { lastReveal } = parked();
    expect(isLastQuestion(lastReveal)).toBe(true);
    const done = reduce(lastReveal, next(T0 + 77_000));
    expect(done.phase).toBe("done");
    expect(done.index).toBe(2);
    expect(done.deadline).toBeNull();
    expect(done.rejected).toBeNull();
    expect(done.turns).toHaveLength(3);
    expect(currentQuestion(done).id).toBe("q3");
    expect(currentTurn(done)?.questionId).toBe("q3");
    expect(msLeft(done, T0 + 77_000)).toBe(0);
    expect(summary(done)).toEqual({
      total: 300,
      tier: 3,
      grades: ["worldie", "worldie", "worldie"],
      perfect: false,
    });
  });

  it("is not the last question before the last question", () => {
    const { asking, reveal, lastAsking } = parked();
    expect(isLastQuestion(asking)).toBe(false);
    expect(isLastQuestion(reveal)).toBe(false);
    expect(isLastQuestion(lastAsking)).toBe(true);
  });

  it("ignores every action once done, whatever the time", () => {
    const { done } = parked();
    const actions: Action[] = [
      submit("Alpha", T0),
      submit("Golf", T0 + 1e9),
      submit("", T0),
      pass(T0 + 1e9),
      tick(T0 + 1e9),
      tick(0),
      resolved,
      next(T0),
      next(T0 + 1e9),
    ];
    for (const action of actions) expect(reduce(done, action)).toBe(done);
    expect(run(done, ...actions, ...actions)).toBe(done);
  });

  it("a one-question game goes asking, resolving, reveal, done", () => {
    let s = createSession({
      mode: "home",
      dayNumber: 9,
      stadium: ORIGIN,
      questions: [QUESTIONS[0]],
      now: T0,
    });
    expect(isLastQuestion(s)).toBe(true);
    const phases: Phase[] = [s.phase];
    for (const action of [submit("Charlie", T0 + 1), resolved, next(T0 + 2)]) {
      s = reduce(s, action);
      phases.push(s.phase);
    }
    expect(phases).toEqual(["asking", "resolving", "reveal", "done"]);
    expect(s.total).toBe(0);
    expect(summary(s).grades).toEqual(["wide"]);
  });
});

describe("rejections", () => {
  it("keeps the clock, the turns and the total, and records what was typed", () => {
    const s = start();
    const r = reduce(s, submit("  Zulu  ", T0 + 4000));
    expect(r).not.toBe(s);
    expect(r.rejected).toEqual({ input: "Zulu", reason: "unknown" });
    expect(r.phase).toBe("asking");
    expect(r.deadline).toBe(DEADLINE);
    expect(r.startedAt).toBe(T0);
    expect(r.turns).toBe(s.turns);
    expect(msLeft(r, T0 + 4000)).toBe(QUESTION_MS - 4000);
  });

  it("says ambiguous, without leaking the candidates", () => {
    const q = question("nevilles", [
      east("Gary Neville", 1),
      east("Phil Neville", 2),
    ]);
    const s = createSession({
      mode: "home",
      dayNumber: 1,
      stadium: ORIGIN,
      questions: [q],
      now: T0,
    });
    const r = reduce(s, submit("Neville", T0 + 1));
    expect(r.rejected).toEqual({ input: "Neville", reason: "ambiguous" });
    expect(JSON.stringify(r.rejected)).not.toContain("Gary");
  });

  it("an empty submit does not clear the last rejection", () => {
    const r = reduce(start(), submit("Zulu", T0 + 1));
    expect(reduce(r, submit("", T0 + 2))).toBe(r);
  });

  it("does not stop the clock running out", () => {
    const r = reduce(start(), submit("Zulu", DEADLINE - 1));
    const out = reduce(r, tick(DEADLINE));
    expect(currentTurn(out)?.grade).toBe("timeup");
    expect(out.rejected).toBeNull();
  });

  it("is cleared by the next question", () => {
    const s = run(
      start(),
      submit("Zulu", T0 + 1),
      submit("Alpha", T0 + 2),
      resolved,
      next(T0 + 3),
    );
    expect(s.rejected).toBeNull();
  });
});

describe("times that are not times", () => {
  it("ignores an action whose now is NaN or infinite", () => {
    const { asking, reveal } = parked();
    for (const bad of [NaN, Infinity, -Infinity]) {
      expect(reduce(asking, submit("Alpha", bad))).toBe(asking);
      expect(reduce(asking, pass(bad))).toBe(asking);
      expect(reduce(asking, tick(bad))).toBe(asking);
      expect(reduce(reveal, next(bad))).toBe(reveal);
      expect(canPass(asking, bad)).toBe(false);
      expect(msLeft(asking, bad)).toBe(QUESTION_MS);
    }
  });

  it("refuses to start a game at a time that is not a number", () => {
    expect(() =>
      createSession({
        mode: "home",
        dayNumber: 1,
        stadium: ORIGIN,
        questions: QUESTIONS,
        now: NaN,
      }),
    ).toThrow();
  });
});

describe("noTimer", () => {
  it("never times out, and records a full clock on every turn", () => {
    let s = start(true);
    expect(s.deadline).toBeNull();
    expect(reduce(s, tick(T0 + 1e9))).toBe(s);
    s = reduce(s, submit("Bravo", T0 + 1e9));
    expect(currentTurn(s)).toMatchObject({ points: 50, msLeft: QUESTION_MS });
    s = run(s, resolved, next(T0 + 2e9));
    expect(s.deadline).toBeNull();
    s = reduce(s, pass(T0 + 2e9 + PASS_AFTER_MS));
    expect(currentTurn(s)).toMatchObject({
      grade: "skipped",
      msLeft: QUESTION_MS,
    });
  });
});

describe("a long random walk", () => {
  function seeded(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const INPUTS = [
    "Alpha",
    "Bravo",
    "Charlie",
    "Delta",
    "Echo",
    "Foxtrot",
    "Golf",
    "Hotel",
    "India",
    "",
    "nonsense",
  ];
  const ORDER: Phase[] = ["asking", "resolving", "reveal", "done"];

  it("keeps every invariant through 20,000 random actions", () => {
    const rand = seeded(2026);
    // Plain checks collected into one list: 20,000 steps of `expect` would take seconds.
    const problems: string[] = [];
    let finished = 0;
    for (let game = 0; game < 200; game++) {
      let now = T0;
      let s = start(rand() < 0.2);
      for (let step = 0; step < 100; step++) {
        now += Math.floor(rand() * 9000);
        const roll = rand();
        const action: Action =
          roll < 0.35
            ? submit(INPUTS[Math.floor(rand() * INPUTS.length)], now)
            : roll < 0.5
              ? pass(now)
              : roll < 0.7
                ? tick(now)
                : roll < 0.85
                  ? resolved
                  : next(now);
        const before = s;
        s = reduce(s, action);
        const check = (ok: boolean, what: string) => {
          if (!ok) problems.push(`game ${game} step ${step}: ${what}`);
        };

        // The total is the sum of the turns, and every turn is consistent.
        check(
          s.total === s.turns.reduce((sum, t) => sum + t.points, 0),
          "total is not the sum of the turns",
        );
        s.turns.forEach((turn, i) => {
          check(turn.questionId === QUESTIONS[i].id, "turn out of order");
          check(turn.points >= 0 && turn.points <= 100, "points out of range");
          check(
            turn.msLeft >= 0 && turn.msLeft <= QUESTION_MS,
            "msLeft out of range",
          );
          if (turn.answerId === null) {
            check(
              (turn.grade === "timeup" || turn.grade === "skipped") &&
                turn.points === 0 &&
                turn.km === null &&
                turn.rank === null &&
                turn.input === null,
              "a blank turn carries something",
            );
          } else {
            const row = tableFor(s, i).find(
              (r) => r.answer.id === turn.answerId,
            );
            check(
              row !== undefined &&
                row.points === turn.points &&
                row.km === turn.km &&
                row.rank === turn.rank,
              "turn disagrees with the table",
            );
          }
        });

        // Turns only ever grow by one, and are never rewritten.
        const grown = s.turns.length - before.turns.length;
        check(grown === 0 || grown === 1, "turns grew by more than one");
        check(
          before.turns.every((turn, i) => s.turns[i] === turn),
          "an earlier turn was rewritten",
        );

        // The phase and the index only ever move forwards.
        const position = (x: Session) => x.index * 10 + ORDER.indexOf(x.phase);
        check(position(s) >= position(before), "the game went backwards");
        check(s.index < QUESTIONS.length, "index past the last question");

        // The shape that goes with each phase.
        const decided = s.phase === "asking" ? s.index : s.index + 1;
        check(s.turns.length === decided, "turns do not match the phase");
        if (s.phase === "asking") {
          check(
            s.deadline === (s.noTimer ? null : s.startedAt + QUESTION_MS),
            "wrong deadline while asking",
          );
          check(currentTurn(s) === null, "a turn while asking");
        } else {
          check(s.deadline === null, "a deadline outside asking");
          check(s.rejected === null, "a rejection outside asking");
          check(currentTurn(s) !== null, "no turn outside asking");
        }
        const left = msLeft(s, now);
        check(left >= 0 && left <= QUESTION_MS, "clock out of range");
      }
      if (s.phase === "done") finished++;
    }
    expect(problems).toEqual([]);
    // The walk really does reach full time, often.
    expect(finished).toBeGreaterThan(20);
  });
});
