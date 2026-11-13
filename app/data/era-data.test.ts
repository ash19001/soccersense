import { describe, expect, it } from "vitest";

import { judge, normalise } from "~/game/judge";
import { ruleFor } from "~/game/scoring";
import { SHOT_ORDER, isGoal, shotForStanding, shotsFor } from "~/game/shots";
import type { EraMode, EraQuestion, Question, Shot } from "~/game/types";

import { AWAY_QUESTIONS } from "./questions/away";
import { HOME_QUESTIONS } from "./questions/home";
import { NEXT_GEN_QUESTIONS } from "./questions/next-gen";
import { RETRO_QUESTIONS } from "./questions/retro";

/**
 * Structural checks on the RETRO and NEXT-GEN questions (docs/data-notes/retro-next-gen.md).
 * RETRO ranks an answer by the first year that makes it valid, NEXT-GEN by the last; equal
 * years tie. Like data.test.ts, these cannot tell whether a year is right, only whether the
 * data can break the game.
 */

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FIRST_YEAR = 1850;
const LAST_YEAR = 2026;
const SCORING: readonly Shot[] = SHOT_ORDER.filter(isGoal);

const SETS: ReadonlyArray<readonly [EraMode, EraQuestion[]]> = [
  ["retro", RETRO_QUESTIONS],
  ["nextgen", NEXT_GEN_QUESTIONS],
];
const ERA_QUESTIONS = [...RETRO_QUESTIONS, ...NEXT_GEN_QUESTIONS];
const OTHER_QUESTIONS: readonly Question[] = [
  ...HOME_QUESTIONS,
  ...AWAY_QUESTIONS,
];

/** The year an answer is ranked by: its first in RETRO, its last in NEXT-GEN. */
function rankingYears(question: EraQuestion): number[] {
  return question.answers.map((a) =>
    question.mode === "retro" ? a.years[0] : a.years[a.years.length - 1],
  );
}

/** The game's own rule: RETRO `oldest` (the earliest year is best), NEXT-GEN `newest`. */
function ruleOf(question: EraQuestion) {
  return ruleFor(question.mode);
}

/** Shots by rank alone: the share of the other (untied) answers that rank better. */
function shotsByRank(question: EraQuestion): Shot[] {
  const years = rankingYears(question);
  const newer = question.mode === "nextgen";
  return years.map((year) => {
    let better = 0;
    let worse = 0;
    for (const other of years) {
      if (other === year) continue;
      if (newer === other > year) better++;
      else worse++;
    }
    return shotForStanding(better + worse > 0 ? better / (better + worse) : 0);
  });
}

/** Lower case, no accents: the comparison data.test.ts uses. */
function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function duplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const twice = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) twice.add(value);
    seen.add(value);
  }
  return [...twice];
}

/** Names and aliases that belong to more than one answer once `key` has been applied. */
function clashes(
  question: EraQuestion,
  key: (text: string) => string,
): string[] {
  const owners = new Map<string, string[]>();
  for (const answer of question.answers) {
    const own = new Set([answer.name, ...answer.aliases].map(key));
    for (const text of own) {
      const list = owners.get(text) ?? [];
      list.push(answer.id);
      owners.set(text, list);
    }
  }
  const found: string[] = [];
  for (const [text, ids] of owners) {
    if (ids.length > 1) found.push(`"${text}" fits ${ids.join(" and ")}`);
  }
  return found;
}

/** The judge takes a shared Question; it reads the answers, the measure and the decoys. */
function asQuestion(question: EraQuestion): Question {
  return { ...question, mode: "home" };
}

describe("RETRO and NEXT-GEN question sets", () => {
  it.each(SETS)("%s has exactly seven questions", (_mode, questions) => {
    expect(questions).toHaveLength(7);
  });

  it.each(SETS)("every %s question has that mode", (mode, questions) => {
    expect(questions.filter((q) => q.mode !== mode).map((q) => q.id)).toEqual(
      [],
    );
  });

  it("question ids are unique and kebab-case across all four modes", () => {
    const ids = [...ERA_QUESTIONS, ...OTHER_QUESTIONS].map((q) => q.id);
    expect(duplicates(ids)).toEqual([]);
    expect(ids.filter((id) => !KEBAB.test(id))).toEqual([]);
  });

  it("no question repeats another's prompt, in any mode", () => {
    const prompts = [...ERA_QUESTIONS, ...OTHER_QUESTIONS].map((q) =>
      normalise(q.prompt),
    );
    expect(duplicates(prompts)).toEqual([]);
  });

  it("no question has the same answer list as another, in any mode", () => {
    const lists = [...ERA_QUESTIONS, ...OTHER_QUESTIONS].map((q) =>
      q.answers
        .map((a) => a.id)
        .sort()
        .join(","),
    );
    expect(duplicates(lists)).toEqual([]);
  });
});

describe.each(ERA_QUESTIONS.map((q) => [q.id, q] as const))(
  "era question %s",
  (_id, question) => {
    const label = (id: string) => `${question.id}/${id}`;

    it("has a prompt, a measure label, a real asOf date and at least 12 answers", () => {
      expect(question.prompt.trim()).not.toBe("");
      expect(question.prompt).toBe(question.prompt.trim());
      expect(question.measureLabel.trim()).not.toBe("");
      expect(question.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(question.answers.length).toBeGreaterThanOrEqual(12);
    });

    it("answer ids are unique and kebab-case ASCII", () => {
      const ids = question.answers.map((a) => a.id);
      expect(duplicates(ids)).toEqual([]);
      expect(ids.filter((id) => !KEBAB.test(id))).toEqual([]);
    });

    it(`every answer has years: whole, strictly ascending, ${FIRST_YEAR} to ${LAST_YEAR}`, () => {
      const problems: string[] = [];
      for (const answer of question.answers) {
        const years = answer.years;
        if (!Array.isArray(years) || years.length === 0) {
          problems.push(`${label(answer.id)}: no years`);
          continue;
        }
        years.forEach((year, i) => {
          if (
            !Number.isInteger(year) ||
            year < FIRST_YEAR ||
            year > LAST_YEAR
          ) {
            problems.push(`${label(answer.id)}: year ${year} is out of range`);
          }
          if (i > 0 && year <= years[i - 1]) {
            problems.push(`${label(answer.id)}: ${year} after ${years[i - 1]}`);
          }
        });
      }
      expect(problems).toEqual([]);
    });

    it("every answer has a name, a place, a country and coordinates in range", () => {
      const problems: string[] = [];
      for (const a of question.answers) {
        if (a.name.trim() === "" || a.name !== a.name.trim()) {
          problems.push(`${label(a.id)}: name`);
        }
        if (a.place.trim() === "") problems.push(`${label(a.id)}: place`);
        if (a.country.trim() === "") problems.push(`${label(a.id)}: country`);
        if (!(Math.abs(a.lat) <= 90) || a.lat === 0) {
          problems.push(`${label(a.id)}: latitude ${a.lat}`);
        }
        if (!(Math.abs(a.lng) <= 180) || a.lng === 0) {
          problems.push(`${label(a.id)}: longitude ${a.lng}`);
        }
      }
      expect(problems).toEqual([]);
    });

    it("popularity: 0.1 to 100, one decimal, adding up to about 100, no tie at either end", () => {
      const bad = question.answers.filter(
        (a) =>
          !(a.popularity >= 0.1 && a.popularity <= 100) ||
          Math.abs(a.popularity * 10 - Math.round(a.popularity * 10)) > 1e-9,
      );
      expect(bad.map((a) => a.id)).toEqual([]);
      const sum = question.answers.reduce((t, a) => t + a.popularity, 0);
      expect(Math.abs(sum - 100)).toBeLessThanOrEqual(0.5);
      const tenths = question.answers
        .map((a) => Math.round(a.popularity * 10))
        .sort((a, b) => b - a);
      expect(tenths[0]).toBeGreaterThan(tenths[1]);
      expect(tenths.at(-1)).toBeLessThan(tenths.at(-2) ?? 0);
    });

    describe("the ranking by year", () => {
      const ruled = shotsFor(rankingYears(question), ruleOf(question));

      it("files every answer's shot by the rule on its year", () => {
        const moved = question.answers.flatMap((a, i) =>
          a.shot === ruled[i]
            ? []
            : [`${a.id}: ${a.shot}, rule says ${ruled[i]}`],
        );
        expect(moved).toEqual([]);
      });

      it("fills every scoring shot, so the reveal has a row for each", () => {
        expect(SCORING.filter((shot) => !ruled.includes(shot))).toEqual([]);
      });

      it("fills every scoring shot by rank alone too", () => {
        const byRank = shotsByRank(question);
        expect(SCORING.filter((shot) => !byRank.includes(shot))).toEqual([]);
      });

      it("never files a better year under a worse shot", () => {
        const years = rankingYears(question);
        const newer = question.mode === "nextgen";
        const problems: string[] = [];
        question.answers.forEach((a, i) => {
          question.answers.forEach((b, j) => {
            const better = newer ? years[i] > years[j] : years[i] < years[j];
            if (
              better &&
              SHOT_ORDER.indexOf(a.shot) > SHOT_ORDER.indexOf(b.shot)
            ) {
              problems.push(`${a.id} (${a.shot}) below ${b.id} (${b.shot})`);
            }
          });
        });
        expect(problems).toEqual([]);
      });
    });

    it("no alias is empty or equal to its own name", () => {
      const problems: string[] = [];
      for (const answer of question.answers) {
        for (const alias of answer.aliases) {
          if (alias.trim() === "") problems.push(`${label(answer.id)}: empty`);
          if (fold(alias) === fold(answer.name)) {
            problems.push(`${label(answer.id)}: "${alias}" is the name`);
          }
        }
        if (duplicates(answer.aliases.map(fold)).length > 0) {
          problems.push(`${label(answer.id)}: an alias twice`);
        }
      }
      expect(problems).toEqual([]);
    });

    it("aliases are unique within the question (case and accents ignored)", () => {
      expect(clashes(question, fold)).toEqual([]);
    });

    it("aliases are unique within the question as the judge reads them", () => {
      expect(clashes(question, normalise)).toEqual([]);
    });

    it("the judge gives every name and alias to its own answer", () => {
      const problems: string[] = [];
      for (const answer of question.answers) {
        for (const text of [answer.name, ...answer.aliases]) {
          const result = judge(asQuestion(question), text);
          if (result.kind !== "match") {
            problems.push(`${label(answer.id)}: "${text}" is ${result.kind}`);
          } else if (result.answer.id !== answer.id) {
            problems.push(
              `${label(answer.id)}: "${text}" gives ${result.answer.id}`,
            );
          }
        }
      }
      expect(problems).toEqual([]);
    });

    it("the judge accepts no decoy", () => {
      for (const decoy of question.decoys ?? []) {
        expect(judge(asQuestion(question), decoy).kind, decoy).toBe("unknown");
      }
    });
  },
);
