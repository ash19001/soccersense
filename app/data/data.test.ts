import { describe, expect, it } from "vitest";

import { judge, normalise } from "~/game/judge";
import type { Answer, Mode, Question, Stadium } from "~/game/types";

import { AWAY_QUESTIONS, HOME_QUESTIONS, STADIUMS, questionsFor } from ".";

/**
 * Structural checks on the demo content. They cannot tell whether a fact is right (that is
 * what docs/data-notes is for), only whether the data can break the game: a duplicate id, a
 * swapped coordinate, an alias that fits two answers.
 */

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MEASURES = ["birthplace", "ground", "location", "capital"];

const SETS: ReadonlyArray<readonly [Mode, Question[]]> = [
  ["home", HOME_QUESTIONS],
  ["away", AWAY_QUESTIONS],
];
const ALL_QUESTIONS = [...HOME_QUESTIONS, ...AWAY_QUESTIONS];

/** Lower case, no accents: the comparison the brief asks for. */
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

function isRealDate(text: string): boolean {
  if (!ISO_DATE.test(text)) return false;
  const date = new Date(`${text}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text
  );
}

/** Problems with a latitude and longitude pair, as readable strings. */
function coordinateProblems(label: string, lat: number, lng: number): string[] {
  const problems: string[] = [];
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    problems.push(`${label}: latitude ${lat} is out of range`);
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    problems.push(`${label}: longitude ${lng} is out of range`);
  }
  if (lat === 0) problems.push(`${label}: latitude is exactly 0`);
  if (lng === 0) problems.push(`${label}: longitude is exactly 0`);
  return problems;
}

/**
 * Names and aliases that belong to more than one answer once `key` has been applied. An answer
 * counts each string once, so two of its own spellings that reduce to the same text are not a
 * clash.
 */
function clashes(question: Question, key: (text: string) => string): string[] {
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

function eachAnswer(
  question: Question,
  check: (answer: Answer, label: string) => string[],
): string[] {
  return question.answers.flatMap((answer) =>
    check(answer, `${question.id}/${answer.id}`),
  );
}

describe("question sets", () => {
  it.each(SETS)("%s has exactly seven questions", (_mode, questions) => {
    expect(questions).toHaveLength(7);
  });

  it.each(SETS)("every %s question has that mode", (mode, questions) => {
    expect(questions.filter((q) => q.mode !== mode).map((q) => q.id)).toEqual(
      [],
    );
  });

  it.each(SETS)("questionsFor(%s) returns that set", (mode, questions) => {
    expect(questionsFor(mode)).toBe(questions);
  });

  it("question ids are unique across both modes", () => {
    expect(duplicates(ALL_QUESTIONS.map((q) => q.id))).toEqual([]);
  });

  it("question ids are kebab-case ASCII", () => {
    expect(
      ALL_QUESTIONS.map((q) => q.id).filter((id) => !KEBAB.test(id)),
    ).toEqual([]);
  });
});

describe.each(ALL_QUESTIONS.map((q) => [q.id, q] as const))(
  "question %s",
  (_id, question) => {
    it("has a prompt, a known measure and a measure label", () => {
      expect(question.prompt.trim()).not.toBe("");
      expect(question.prompt).toBe(question.prompt.trim());
      expect(MEASURES).toContain(question.measure);
      expect(question.measureLabel.trim()).not.toBe("");
    });

    it("asOf is a real ISO date", () => {
      expect(isRealDate(question.asOf), question.asOf).toBe(true);
    });

    it("has at least six answers", () => {
      expect(question.answers.length).toBeGreaterThanOrEqual(6);
    });

    it("answer ids are unique and kebab-case ASCII", () => {
      const ids = question.answers.map((a) => a.id);
      expect(duplicates(ids)).toEqual([]);
      expect(ids.filter((id) => !KEBAB.test(id))).toEqual([]);
    });

    it("every answer has a name, a place and a country", () => {
      expect(
        eachAnswer(question, (answer, label) => {
          const problems: string[] = [];
          if (answer.name.trim() === "") problems.push(`${label}: no name`);
          if (answer.name !== answer.name.trim()) {
            problems.push(`${label}: name has stray spaces`);
          }
          if (answer.place.trim() === "") problems.push(`${label}: no place`);
          if (answer.country.trim() === "") {
            problems.push(`${label}: no country`);
          }
          return problems;
        }),
      ).toEqual([]);
    });

    it("coordinates are in range and never exactly 0", () => {
      expect(
        eachAnswer(question, (answer, label) =>
          coordinateProblems(label, answer.lat, answer.lng),
        ),
      ).toEqual([]);
    });

    it("every answer has a popularity: 0.1 to 100, at most one decimal place", () => {
      expect(
        eachAnswer(question, (answer, label) => {
          const share = answer.popularity;
          const ok =
            typeof share === "number" &&
            Number.isFinite(share) &&
            share >= 0.1 &&
            share <= 100 &&
            Math.abs(share * 10 - Math.round(share * 10)) < 1e-9;
          return ok ? [] : [`${label}: popularity ${String(share)}`];
        }),
      ).toEqual([]);
    });

    it("the popularity shares add up to about 100", () => {
      const sum = question.answers.reduce((t, a) => t + a.popularity, 0);
      expect(Math.abs(sum - 100)).toBeLessThanOrEqual(0.5);
    });

    it("has one most common and one most niche answer (no tie at either end)", () => {
      const tenths = question.answers
        .map((a) => Math.round(a.popularity * 10))
        .sort((a, b) => b - a);
      expect(tenths[0]).toBeGreaterThan(tenths[1]);
      expect(tenths.at(-1)).toBeLessThan(tenths.at(-2) ?? 0);
    });

    it("no alias is empty or equal to its own name", () => {
      expect(
        eachAnswer(question, (answer, label) => {
          const problems: string[] = [];
          for (const alias of answer.aliases) {
            if (alias.trim() === "") problems.push(`${label}: empty alias`);
            if (fold(alias) === fold(answer.name)) {
              problems.push(`${label}: alias "${alias}" is the name`);
            }
          }
          return problems;
        }),
      ).toEqual([]);
    });

    it("no two answers share a name or alias (case and accents ignored)", () => {
      expect(clashes(question, fold)).toEqual([]);
    });

    it("no two answers share a name or alias as the judge reads them", () => {
      expect(clashes(question, normalise)).toEqual([]);
    });

    it("the judge gives every name and alias to its own answer", () => {
      expect(
        eachAnswer(question, (answer, label) => {
          const problems: string[] = [];
          for (const text of [answer.name, ...answer.aliases]) {
            const result = judge(question, text);
            if (result.kind !== "match") {
              problems.push(`${label}: "${text}" is ${result.kind}`);
            } else if (result.answer.id !== answer.id) {
              problems.push(`${label}: "${text}" gives ${result.answer.id}`);
            }
          }
          return problems;
        }),
      ).toEqual([]);
    });
  },
);

describe("stadiums", () => {
  const label = (s: Stadium) => `stadium ${s.id}`;

  it("there are 21, and the first is Anfield", () => {
    expect(STADIUMS).toHaveLength(21);
    expect(STADIUMS[0]?.id).toBe("anfield");
  });

  it("ids are unique and kebab-case ASCII", () => {
    const ids = STADIUMS.map((s) => s.id);
    expect(duplicates(ids)).toEqual([]);
    expect(ids.filter((id) => !KEBAB.test(id))).toEqual([]);
  });

  it("names are unique", () => {
    expect(duplicates(STADIUMS.map((s) => fold(s.name)))).toEqual([]);
  });

  it("every stadium has a name, a city and a country", () => {
    expect(
      STADIUMS.filter(
        (s) =>
          s.name.trim() === "" ||
          s.city.trim() === "" ||
          s.country.trim() === "",
      ).map(label),
    ).toEqual([]);
  });

  it("coordinates are in range and never exactly 0", () => {
    expect(
      STADIUMS.flatMap((s) => coordinateProblems(label(s), s.lat, s.lng)),
    ).toEqual([]);
  });

  it("no two consecutive days are in the same country, including the wrap", () => {
    const repeats = STADIUMS.filter(
      (s, i) => STADIUMS[(i + 1) % STADIUMS.length]?.country === s.country,
    ).map(label);
    expect(repeats).toEqual([]);
  });
});
