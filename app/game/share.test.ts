import { describe, expect, it } from "vitest";

import { HOME_QUESTIONS, STADIUMS } from "~/data";
import { createSession, reduce } from "./session";
import { shareCardFor } from "./share";

describe("shareCardFor", () => {
  const start = () =>
    createSession({
      mode: "home",
      dayNumber: 5,
      stadium: STADIUMS[0],
      questions: HOME_QUESTIONS,
      now: 0,
      noTimer: true,
    });

  it("has one row per question decided: the question, the answer's name, the shot", () => {
    let s = start();
    s = reduce(s, { type: "submit", input: "Man Utd", now: 1000 });
    s = reduce(s, { type: "resolved" });
    s = reduce(s, { type: "next", now: 2000 });
    s = reduce(s, { type: "pass", now: 20_000 });
    const card = shareCardFor(s);
    expect(card).toMatchObject({
      dayNumber: 5,
      mode: "home",
      total: 100,
      maxTotal: 700,
    });
    expect(card.rows).toEqual([
      {
        prompt: HOME_QUESTIONS[0].prompt,
        answer: "Manchester United",
        year: null,
        grade: "worldie",
        points: 100,
      },
      {
        prompt: HOME_QUESTIONS[1].prompt,
        answer: null,
        year: null,
        grade: "skipped",
        points: 0,
      },
    ]);
  });

  it("has no rows before the first answer", () => {
    expect(shareCardFor(start()).rows).toEqual([]);
  });

  it("never says which stadium the day's pin is", () => {
    // the product owner, 2026-11-17: the stadium's name "shouldn't be mentioned anywhere"
    const card = shareCardFor(start());
    expect(Object.keys(card)).not.toContain("stadiumName");
    expect(JSON.stringify(card)).not.toMatch(/anfield/i);
  });
});
