/**
 * A game the server runs (./served.ts): the snapshot the server makes hides what the player
 * may not see yet, and the page's session made from it shows what the page's own game shows.
 */
import { describe, expect, it } from "vitest";

import {
  type GameSnapshot,
  blankQuestion,
  isGameSnapshot,
  sessionFrom,
  snapshotOf,
  storedQuestions,
} from "./served";
import { type Action, type Session, createSession, reduce } from "./session";
import { shareCardFor } from "./share";
import { ORIGIN, east, question } from "./test-fixtures";
import { pips, questionView, results, revealFor } from "./view";

const T0 = 50_000;

const LONG = question(
  "long",
  Array.from({ length: 10 }, (_, i) =>
    east(`Answer ${i}`, i + 1, [`alias${i}`]),
  ),
);
const SHORT = question("short", [east("Near", 1), east("Far", 9)]);
const LAST = question("last", [east("Only", 4)]);

/** The server's game: the whole questions. */
function start(): Session {
  return createSession({
    mode: "home",
    dayNumber: 12,
    stadium: ORIGIN,
    questions: [LONG, SHORT, LAST],
    now: T0,
  });
}

const run = (session: Session, ...actions: Action[]): Session =>
  actions.reduce(reduce, session);

/** What goes over the wire: the snapshot as JSON and back. */
const sent = (snapshot: GameSnapshot): unknown =>
  JSON.parse(JSON.stringify(snapshot));

const answered = run(
  start(),
  { type: "submit", input: "Answer 3", now: T0 + 4000 },
  { type: "resolved" },
);

describe("snapshotOf", () => {
  it("sends the question being asked and nothing of its answers, or of the ones to come", () => {
    const snapshot = snapshotOf(start());
    expect(snapshot).toEqual({
      day: 12,
      mode: "home",
      count: 3,
      questions: [
        {
          id: "long",
          prompt: LONG.prompt,
          measure: "birthplace",
          measureLabel: "where it was born",
        },
      ],
      index: 0,
      phase: "asking",
      turns: [],
      total: 0,
      startedAt: T0,
      deadline: start().deadline,
      reveal: null,
      rejected: null,
    });
    const text = JSON.stringify(snapshot);
    for (const hidden of ["Answer 0", "alias", SHORT.prompt, LAST.prompt]) {
      expect(text, hidden).not.toContain(hidden);
    }
  });

  it("says an answer was turned down only while the question is still open", () => {
    const rejected = { input: "Zidane", reason: "unknown" as const };
    expect(snapshotOf(start(), rejected).rejected).toEqual(rejected);
    expect(snapshotOf(answered, rejected).rejected).toBeNull();
  });

  it("sends the reveal once the question is decided: the rows shown, and no more of an answer than a row says", () => {
    const snapshot = snapshotOf(answered);
    expect(snapshot.phase).toBe("reveal");
    expect(snapshot.deadline).toBeNull();
    expect(snapshot.turns).toEqual(answered.turns);
    const reveal = snapshot.reveal;
    expect(reveal?.rows.map((row) => row.shot)).toEqual([
      "worldie",
      "golazo",
      "trivela",
      "toepoke",
      "tapin",
    ]);
    expect(reveal?.tableSize).toBe(10);
    expect(reveal?.oneCountry).toBe(true);
    expect(reveal?.row?.answer).toEqual({
      id: "answer-3",
      name: "Answer 3",
      country: "Testland",
    });
    const text = JSON.stringify(snapshot);
    expect(text).not.toContain("alias");
    for (const field of ["place", "aliases", "popularity", "lat", "lng"]) {
      expect(text, field).not.toContain(`"${field}":`);
    }
    // the next question is still to come
    expect(text).not.toContain(SHORT.prompt);
  });

  it("a shot still playing on the server's side is a reveal to the page", () => {
    const resolving = run(start(), {
      type: "submit",
      input: "Answer 3",
      now: T0 + 4000,
    });
    expect(resolving.phase).toBe("resolving");
    expect(snapshotOf(resolving).phase).toBe("reveal");
    expect(snapshotOf(resolving).reveal).not.toBeNull();
  });

  it("at full time it is the whole result, with every question that was asked", () => {
    const done = run(
      answered,
      { type: "next", now: T0 + 10_000 },
      { type: "submit", input: "Near", now: T0 + 12_000 },
      { type: "resolved" },
      { type: "next", now: T0 + 20_000 },
      { type: "pass", now: T0 + 30_000 },
      { type: "resolved" },
      { type: "next", now: T0 + 40_000 },
    );
    const snapshot = snapshotOf(done);
    expect(snapshot.phase).toBe("done");
    expect(snapshot.questions.map((q) => q.id)).toEqual([
      "long",
      "short",
      "last",
    ]);
    expect(snapshot.turns).toHaveLength(3);
    expect(snapshot.reveal).toBeNull();
    expect(isGameSnapshot(sent(snapshot))).toBe(true);
  });
});

describe("sessionFrom", () => {
  it("is the page's game: the question on the board, blanks for the ones to come", () => {
    const snapshot = snapshotOf(start());
    const page = sessionFrom(snapshot, ORIGIN);
    expect(questionView(page)).toMatchObject({
      number: 1,
      count: 3,
      prompt: LONG.prompt,
      measure: "birthplace",
      isLast: false,
    });
    expect(page.questions.map((q) => q.answers)).toEqual([[], [], []]);
    expect(page.questions[1]).toEqual(blankQuestion("home"));
    expect(page.deadline).toBe(snapshot.deadline);
    expect(page.noTimer).toBe(false);
    expect(pips(page)).toEqual([null, null, null]);
  });

  it("shows the reveal the server sent, as the page's own game would", () => {
    const page = sessionFrom(
      sent(snapshotOf(answered)) as GameSnapshot,
      ORIGIN,
    );
    const mine = revealFor(page);
    const whole = revealFor(answered);
    expect(mine).not.toBeNull();
    expect(mine?.turn).toEqual(whole?.turn);
    expect(mine?.answer?.name).toBe("Answer 3");
    expect(mine?.best?.answer.name).toBe(whole?.best?.answer.name);
    expect(mine?.rows.map((r) => [r.answer.name, r.rank, r.points])).toEqual(
      whole?.rows.map((r) => [r.answer.name, r.rank, r.points]),
    );
    expect(mine?.rows.map((r) => r.isPlayer)).toEqual(
      whole?.rows.map((r) => r.isPlayer),
    );
    expect(mine?.playerInRows).toBe(whole?.playerInRows);
    expect(mine?.tableSize).toBe(10);
    expect(mine?.oneCountry).toBe(true);
    expect(mine?.isLast).toBe(false);
  });

  it("reads a result without the answers: the turn says its own answer's name", () => {
    const page = sessionFrom(snapshotOf(answered), ORIGIN);
    expect(results(page)).toMatchObject([
      { index: 0, answer: null, name: "Answer 3" },
    ]);
    expect(shareCardFor(page).rows).toEqual([
      {
        prompt: LONG.prompt,
        answer: "Answer 3",
        year: null,
        grade: answered.turns[0].grade,
        points: answered.turns[0].points,
      },
    ]);
  });

  it("a turn kept before it carried its answer's name reads as it was typed", () => {
    const snapshot = snapshotOf(answered);
    const old = { ...snapshot.turns[0], input: "answer three" };
    delete old.name;
    delete old.year;
    const page = sessionFrom({ ...snapshot, turns: [old] }, ORIGIN);
    expect(results(page)[0].name).toBe("answer three");
    expect(shareCardFor(page).rows[0]).toMatchObject({
      answer: "answer three",
      year: null,
    });
  });

  it("a question whose reveal was not sent has an empty table, not a crash", () => {
    const snapshot = { ...snapshotOf(answered), reveal: null };
    const reveal = revealFor(sessionFrom(snapshot, ORIGIN));
    expect(reveal?.rows).toEqual([]);
    expect(reveal?.best).toBeNull();
  });
});

describe("storedQuestions", () => {
  it("are a finished game's questions as far as the device kept them", () => {
    expect(storedQuestions("away", answered.turns, [LONG.prompt])).toEqual([
      blankQuestion("away", { id: "long", prompt: LONG.prompt }),
    ]);
    // a game saved before its prompts were kept
    expect(storedQuestions("away", answered.turns)[0].prompt).toBe("");
  });
});

describe("isGameSnapshot", () => {
  const good = () => sent(snapshotOf(answered)) as Record<string, unknown>;

  it("takes what the server sends, at every stage of a game", () => {
    expect(isGameSnapshot(sent(snapshotOf(start())))).toBe(true);
    expect(
      isGameSnapshot(
        sent(snapshotOf(start(), { input: "x", reason: "ambiguous" })),
      ),
    ).toBe(true);
    expect(isGameSnapshot(good())).toBe(true);
  });

  it("takes nothing that is not one, or whose parts disagree", () => {
    for (const junk of [null, undefined, 7, "game", [], {}]) {
      expect(isGameSnapshot(junk)).toBe(false);
    }
    const broken: [string, Record<string, unknown>][] = [
      ["no day", { day: 0 }],
      ["an unknown mode", { mode: "guesswho" }],
      ["an index past the end", { index: 3 }],
      ["a phase the server has not got", { phase: "resolving" }],
      ["a total that is not the turns'", { total: 999 }],
      [
        "a question too many",
        {
          questions: [
            ...snapshotOf(answered).questions,
            snapshotOf(answered).questions[0],
          ],
        },
      ],
      ["no questions", { questions: [] }],
      ["a turn too few", { turns: [] }],
      ["a reveal phase with no reveal", { reveal: null }],
      ["a reveal that is not one", { reveal: { rows: "none" } }],
      ["a rejection that is not one", { rejected: { input: 1 } }],
      ["a clock that is not a time", { startedAt: "noon" }],
    ];
    for (const [what, change] of broken) {
      expect(isGameSnapshot({ ...good(), ...change }), what).toBe(false);
    }
    // a question being asked has a clock
    const asking = sent(snapshotOf(start())) as Record<string, unknown>;
    expect(isGameSnapshot({ ...asking, deadline: null })).toBe(false);
  });
});
