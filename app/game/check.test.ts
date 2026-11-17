/**
 * `checkQuestion` (app/game/check.ts): the sample questions' rules, as a function for
 * questions that arrive as data.
 */
import { describe, expect, it } from "vitest";

import {
  AWAY_QUESTIONS,
  HOME_QUESTIONS,
  NEXT_GEN_QUESTIONS,
  RETRO_QUESTIONS,
} from "~/data";

import { MIN_ANSWERS, checkQuestion } from "./check";
import { SHOT_ORDER, isGoal } from "./shots";
import type { Mode, Question } from "./types";

const SAMPLE: Question[] = [
  ...HOME_QUESTIONS,
  ...AWAY_QUESTIONS,
  ...RETRO_QUESTIONS,
  ...NEXT_GEN_QUESTIONS,
];

/** A copy to break: plain data, as a draft arrives. */
const draft = (
  question: Question,
): Record<string, unknown> & { answers: Record<string, unknown>[] } =>
  JSON.parse(JSON.stringify(question));

const problemsOf = (raw: unknown, mode: Mode) =>
  checkQuestion(raw, mode).problems;

describe("checkQuestion", () => {
  it("passes every sample question, as data with no shots in it", () => {
    for (const question of SAMPLE) {
      const raw = draft(question);
      for (const answer of raw.answers) delete answer.shot;
      const checked = checkQuestion(raw, question.mode);
      expect(checked.problems, question.id).toEqual([]);
      expect(checked.question?.id).toBe(question.id);
      expect(checked.question?.answers).toHaveLength(question.answers.length);
    }
  });

  it("files every answer's shot itself, by the mode's rule: a draft cannot say otherwise", () => {
    const question = HOME_QUESTIONS[0];
    const raw = draft(question);
    // the least common answer claims to be the worldie
    const least = [...raw.answers].sort(
      (a, b) => (a.popularity as number) - (b.popularity as number),
    )[0];
    least.shot = "worldie";
    const checked = checkQuestion(raw, "home").question;
    const filed = checked?.answers.find((a) => a.id === least.id);
    expect(filed?.shot).toBe("miss");
    // the most common is the worldie in HOME, and every scoring shot has an answer
    const most = [...(checked?.answers ?? [])].sort(
      (a, b) => b.popularity - a.popularity,
    )[0];
    expect(most.shot).toBe("worldie");
    const used = new Set(checked?.answers.map((a) => a.shot));
    expect(SHOT_ORDER.filter((s) => isGoal(s) && !used.has(s))).toEqual([]);

    // AWAY turns it over: the least common is the worldie
    const away = draft(AWAY_QUESTIONS[0]);
    const awayChecked = checkQuestion(away, "away").question;
    const rarest = [...(awayChecked?.answers ?? [])].sort(
      (a, b) => a.popularity - b.popularity,
    )[0];
    expect(rarest.shot).toBe("worldie");
  });

  it("keeps only what a question is made of: nothing else in a draft gets through", () => {
    const raw = draft(HOME_QUESTIONS[0]);
    raw.extra = "ignore me";
    raw.answers[0].points = 1000;
    const checked = checkQuestion(raw, "home").question;
    expect(Object.keys(checked ?? {}).sort()).toEqual(
      [
        "answers",
        "asOf",
        "id",
        "measure",
        "measureLabel",
        "mode",
        "prompt",
      ].sort(),
    );
    expect(checked?.answers[0]).not.toHaveProperty("points");
  });

  it("says what is wrong, every problem at once, and gives no question", () => {
    const raw = draft(HOME_QUESTIONS[0]);
    raw.id = "Not Kebab";
    raw.prompt = "Which club won the league?";
    raw.asOf = "2026-02-30";
    raw.measure = "moon";
    const checked = checkQuestion(raw, "home");
    expect(checked.question).toBeNull();
    expect(checked.problems).toHaveLength(4);
    expect(checked.problems.join("\n")).toMatch(/kebab-case/);
    expect(checked.problems.join("\n")).toMatch(/must start "Name a/);
    expect(checked.problems.join("\n")).toMatch(/not a real date/);
    expect(checked.problems.join("\n")).toMatch(/measure is moon/);
  });

  it("is for the mode it is given: another mode's question is turned down", () => {
    expect(problemsOf(draft(HOME_QUESTIONS[0]), "away").join()).toMatch(
      /mode is home, not away/,
    );
  });

  it("anything that is not a question is turned down without throwing", () => {
    for (const junk of [
      null,
      undefined,
      7,
      "question",
      [],
      {},
      { answers: 3 },
    ]) {
      const checked = checkQuestion(junk, "home");
      expect(checked.question).toBeNull();
      expect(checked.problems.length).toBeGreaterThan(0);
    }
  });

  it("needs enough answers for its mode", () => {
    const home = draft(HOME_QUESTIONS[0]);
    home.answers = home.answers.slice(0, MIN_ANSWERS.home - 1);
    expect(problemsOf(home, "home").join()).toMatch(/needs at least 6/);
    const retro = draft(RETRO_QUESTIONS[0]);
    retro.answers = retro.answers.slice(0, MIN_ANSWERS.retro - 1);
    expect(problemsOf(retro, "retro").join()).toMatch(/needs at least 12/);
  });

  it("an answer needs an id of its own, a name, a place, a country and coordinates", () => {
    const raw = draft(HOME_QUESTIONS[0]);
    raw.answers[1].id = raw.answers[0].id;
    raw.answers[2].name = " ";
    raw.answers[3].place = "";
    delete raw.answers[4].country;
    raw.answers[5].lat = 0;
    raw.answers[6].lng = 181;
    const problems = problemsOf(raw, "home").join("\n");
    expect(problems).toMatch(/the id is used twice/);
    expect(problems).toMatch(/no name/);
    expect(problems).toMatch(/no place/);
    expect(problems).toMatch(/no country/);
    expect(problems.match(/is not a place/g)).toHaveLength(2);
  });

  it("popularity is 0.1 to 100 to one decimal, adds up to 100, with no tie at either end", () => {
    const odd = draft(HOME_QUESTIONS[0]);
    odd.answers[0].popularity = 12.34;
    odd.answers[1].popularity = 0;
    odd.answers[2].popularity = "lots";
    expect(
      problemsOf(odd, "home").filter((p) => /popularity/.test(p)),
    ).toHaveLength(3);

    const heavy = draft(HOME_QUESTIONS[0]);
    (heavy.answers[0].popularity as number) += 5;
    expect(problemsOf(heavy, "home").join()).toMatch(/add up to .*, not 100/);

    const tied = draft(HOME_QUESTIONS[0]);
    const byShare = [...tied.answers].sort(
      (a, b) => (b.popularity as number) - (a.popularity as number),
    );
    // the top two swap to the same share, the sum unchanged
    const total =
      (byShare[0].popularity as number) + (byShare[1].popularity as number);
    byShare[0].popularity = Math.round(total * 5) / 10;
    byShare[1].popularity =
      Math.round((total - (byShare[0].popularity as number)) * 10) / 10;
    if (byShare[0].popularity === byShare[1].popularity) {
      expect(problemsOf(tied, "home").join()).toMatch(/tie as the most common/);
    }
  });

  it("RETRO and NEXT-GEN answers need their years: whole, ascending, not after asOf", () => {
    const missing = draft(RETRO_QUESTIONS[0]);
    delete missing.answers[0].years;
    expect(problemsOf(missing, "retro").join()).toMatch(
      /years must be whole years/,
    );

    const backwards = draft(RETRO_QUESTIONS[0]);
    backwards.answers[0].years = [1990, 1985];
    expect(problemsOf(backwards, "retro").join()).toMatch(/ascending/);

    const future = draft(NEXT_GEN_QUESTIONS[0]);
    future.answers[0].years = [2999];
    expect(problemsOf(future, "nextgen").join()).toMatch(/years must be/);

    // HOME and AWAY may leave them out
    const home = draft(HOME_QUESTIONS[0]);
    for (const answer of home.answers) delete answer.years;
    expect(problemsOf(home, "home")).toEqual([]);
  });

  it("no two answers may be reached by the same words, and an alias is never the name", () => {
    const shared = draft(HOME_QUESTIONS[0]);
    (shared.answers[1].aliases as string[]).push(
      shared.answers[0].name as string,
    );
    expect(problemsOf(shared, "home").join()).toMatch(
      /is also a name or alias of/,
    );

    // as the judge reads them: case, accents and "the" make no difference
    const folded = draft(HOME_QUESTIONS[0]);
    (folded.answers[1].aliases as string[]).push(
      `THE ${(folded.answers[0].name as string).toUpperCase()}`,
    );
    expect(problemsOf(folded, "home").join()).toMatch(
      /is also a name or alias of/,
    );

    const own = draft(HOME_QUESTIONS[0]);
    (own.answers[0].aliases as string[]).push(own.answers[0].name as string);
    expect(problemsOf(own, "home").join()).toMatch(/is the name itself/);

    const list = draft(HOME_QUESTIONS[0]);
    list.answers[0].aliases = "Man Utd";
    expect(problemsOf(list, "home").join()).toMatch(/aliases is not a list/);
  });

  it("a decoy the judge would accept is a problem, and decoys that hold are kept", () => {
    const raw = draft(HOME_QUESTIONS[0]);
    raw.decoys = [raw.answers[0].name];
    expect(problemsOf(raw, "home").join()).toMatch(
      /the decoy .* is accepted as/,
    );

    const withDecoys = SAMPLE.find((q) => (q.decoys ?? []).length > 0);
    expect(withDecoys).toBeDefined();
    if (withDecoys) {
      const checked = checkQuestion(draft(withDecoys), withDecoys.mode);
      expect(checked.problems).toEqual([]);
      expect(checked.question?.decoys).toEqual(withDecoys.decoys);
    }
  });

  it("shares or years too bunched to fill the five scoring shots are a problem", () => {
    const raw = draft(RETRO_QUESTIONS[0]);
    // every answer first won in the same year: nothing to rank
    for (const answer of raw.answers) answer.years = [1950];
    expect(problemsOf(raw, "retro").join()).toMatch(/no answer would be a/);
  });
});
