// @vitest-environment node
/** The drafter's tool (tools/questions.ts): what needs drafting, and whether a file is fit. */
import { describe, expect, test } from "vitest";

import { AWAY_QUESTIONS, HOME_QUESTIONS, RETRO_QUESTIONS } from "~/data";
import type { Question } from "~/game/types";

import {
  type BriefSlot,
  TODO_FROM,
  TODO_TO,
  checkDrafts,
  placesToDraft,
} from "./questions";

const copy = (question: Question) =>
  JSON.parse(JSON.stringify(question)) as Record<string, unknown>;
const draft = (question: Question, day: number, slot: number) => ({
  day,
  mode: question.mode,
  slot,
  question: copy(question),
  note: "sources",
});
const brief = (
  day: number,
  mode: BriefSlot["mode"],
  slot: number,
  status: BriefSlot["status"],
  review = "",
): BriefSlot => ({
  day,
  mode,
  slot,
  status,
  review,
  questionId: `q-${day}-${mode}-${slot}`,
  prompt: `Name a thing ${day} ${mode} ${slot}`,
});

describe("what needs drafting", () => {
  test("with nothing drafted: every place from tomorrow to eight days on", () => {
    const todo = placesToDraft(8, []);
    // eight days, four modes, seven places
    expect(todo).toHaveLength((TODO_TO - TODO_FROM + 1) * 4 * 7);
    expect(todo[0]).toEqual({
      day: 9,
      date: "2026-11-18",
      mode: "home",
      slot: 0,
      why: "empty",
    });
    expect(todo.at(-1)).toMatchObject({ day: 16, mode: "nextgen", slot: 6 });
    // never today (it is being played) and never further than eight days on
    expect(todo.every((p) => p.day > 8 && p.day <= 16)).toBe(true);
  });

  test("a draft or an approved question is left alone; a rejected one is to be done again, with its reason", () => {
    const todo = placesToDraft(8, [
      brief(9, "home", 0, "draft"),
      brief(9, "home", 1, "approved"),
      brief(9, "home", 2, "rejected", "two winners are missing"),
      // outside the days being drafted: not this run's business
      brief(8, "home", 0, "rejected", "today"),
      brief(17, "home", 0, "rejected", "too far"),
    ]);
    const home9 = todo.filter((p) => p.day === 9 && p.mode === "home");
    expect(home9.map((p) => [p.slot, p.why])).toEqual([
      [2, "rejected"],
      [3, "empty"],
      [4, "empty"],
      [5, "empty"],
      [6, "empty"],
    ]);
    expect(home9[0]).toMatchObject({
      review: "two winners are missing",
      rejected: {
        questionId: "q-9-home-2",
        prompt: "Name a thing 9 home 2",
      },
    });
    expect(todo.some((p) => p.day === 8 || p.day === 17)).toBe(false);
  });

  test("a week that is all drafted leaves nothing to do", () => {
    const all: BriefSlot[] = [];
    for (let day = 9; day <= 16; day++) {
      for (const mode of ["home", "away", "retro", "nextgen"] as const) {
        for (let slot = 0; slot < 7; slot++) {
          all.push(brief(day, mode, slot, slot % 2 ? "draft" : "approved"));
        }
      }
    }
    expect(placesToDraft(8, all)).toEqual([]);
  });
});

describe("checking a file of drafts", () => {
  test("a game of sample questions is fit to send", () => {
    const file = {
      drafts: [
        ...HOME_QUESTIONS.map((q, slot) => draft(q, 9, slot)),
        ...RETRO_QUESTIONS.map((q, slot) => draft(q, 9, slot)),
      ],
    };
    expect(checkDrafts(file)).toEqual([]);
  });

  test("what is not a file of drafts is said so", () => {
    for (const junk of [null, [], {}, { drafts: 7 }, "drafts"]) {
      expect(checkDrafts(junk)).toEqual([
        'the file is not { "drafts": [...] }',
      ]);
    }
    expect(checkDrafts({ drafts: ["x"] })).toEqual(["draft 1: not an object"]);
  });

  test("a place must be a day, a mode and 0 to 6, and may be filled once", () => {
    const problems = checkDrafts({
      drafts: [
        { ...draft(HOME_QUESTIONS[0], 9, 0), slot: 7 },
        { ...draft(HOME_QUESTIONS[0], 9, 0), mode: "closest" },
        { ...draft(HOME_QUESTIONS[0], 9, 0), day: 0 },
        draft(HOME_QUESTIONS[0], 9, 0),
        draft(HOME_QUESTIONS[1], 9, 0),
      ],
    });
    expect(problems.filter((p) => /must be a day number/.test(p))).toHaveLength(
      3,
    );
    expect(problems.join("\n")).toMatch(
      /day 9 home 0: the place is filled twice/,
    );
  });

  test("every question's own problems are reported with its place", () => {
    const bad = draft(HOME_QUESTIONS[0], 12, 3);
    bad.question.prompt = "Which club?";
    (bad.question.answers as Record<string, unknown>[])[0].lat = 0;
    const problems = checkDrafts({ drafts: [bad] });
    expect(problems).toHaveLength(2);
    expect(problems.every((p) => p.startsWith("day 12 home 3: "))).toBe(true);
  });

  test("no question twice in a game, and no prompt twice in the file, whatever the mode", () => {
    const again = checkDrafts({
      drafts: [draft(HOME_QUESTIONS[0], 9, 0), draft(HOME_QUESTIONS[0], 9, 1)],
    });
    expect(again.join("\n")).toMatch(/is in that day and mode twice/);

    // the same thing asked on another day, in another mode, with the wording dressed up
    const reworded = copy(AWAY_QUESTIONS[0]);
    reworded.prompt = `${HOME_QUESTIONS[0].prompt.replace("Premier League", "PREMIER   LEAGUE")}!`;
    const repeated = checkDrafts({
      drafts: [
        draft(HOME_QUESTIONS[0], 9, 0),
        { day: 11, mode: "away", slot: 2, question: reworded },
      ],
    });
    expect(repeated.join("\n")).toMatch(/is also asked at day 9 home 0/);
  });
});
