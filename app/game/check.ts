/**
 * Whether a question is fit to be played.
 *
 * The sample questions are held to their rules by tests (app/data/*.test.ts). A question
 * that arrives as data (drafted by AI, sent to the server, approved by the product owner)
 * has no test to hold it, so the same rules are here as a function: `checkQuestion` takes
 * anything, and gives back either the question, typed and with every answer's shot filed,
 * or what is wrong with it in plain words.
 *
 * A draft does not say which shot an answer is: that is worked out here from the answers'
 * shares (HOME, AWAY) or years (RETRO, NEXT-GEN) by `shotsFor`, the rule the game scores
 * by, so a draft cannot disagree with it. CLOSEST's and FURTHEST's shots depend on the day's
 * place, so they are worked out as the question is played, never filed; their answers need
 * no share of players, only a place.
 */

import { judge, normalise } from "./judge";
import { isDistanceRule, rankingYear, ruleFor } from "./scoring";
import { SHOT_ORDER, isGoal, shotsFor } from "./shots";
import type { Answer, Measure, Mode, Question } from "./types";

/** The modes a question can be for, and the fewest answers one needs in each. */
export const MIN_ANSWERS: Readonly<Record<Mode, number>> = {
  home: 6,
  away: 6,
  retro: 12,
  nextgen: 12,
  closest: 6,
  furthest: 6,
};
/** The most answers a question may have, and the most other spellings an answer may. */
export const MAX_ANSWERS = 250;
export const MAX_ALIASES = 30;

const MEASURES: readonly Measure[] = [
  "birthplace",
  "ground",
  "location",
  "capital",
];
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** The first year football has anything to list. */
const FIRST_YEAR = 1850;

export interface Checked {
  /** The question, ready to play, or null if anything is wrong with it. */
  question: Question | null;
  /** What is wrong, one line each; empty when the question is fit. */
  problems: string[];
}

type Bag = Record<string, unknown>;

const isBag = (value: unknown): value is Bag =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** A real ISO date, "2026-11-17". */
function isDate(text: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const time = Date.parse(`${text}T00:00:00Z`);
  return (
    Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === text
  );
}

/**
 * Checks `raw` as a question for `mode`. Every problem is reported, not just the first, so
 * a draft can be put right in one go.
 */
export function checkQuestion(raw: unknown, mode: Mode): Checked {
  const problems: string[] = [];
  const fail = (): Checked => ({ question: null, problems });
  if (!isBag(raw)) {
    problems.push("the question is not an object");
    return fail();
  }

  const text = (bag: Bag, key: string, where: string, max: number): string => {
    const value = bag[key];
    if (typeof value !== "string" || value.trim() === "") {
      problems.push(`${where}: no ${key}`);
      return "";
    }
    const trimmed = value.trim();
    if (trimmed.length > max) {
      problems.push(`${where}: ${key} is longer than ${max} characters`);
    }
    return trimmed;
  };

  const id = text(raw, "id", "question", 80);
  if (id !== "" && !KEBAB.test(id)) {
    problems.push(`question: id "${id}" is not kebab-case (a-z, 0-9, hyphens)`);
  }
  const where = id === "" ? "question" : id;
  if (raw.mode !== mode) {
    problems.push(`${where}: mode is ${String(raw.mode)}, not ${mode}`);
  }
  const prompt = text(raw, "prompt", where, 140);
  if (prompt !== "" && !/^Name (a|an) \S/.test(prompt)) {
    problems.push(
      `${where}: the prompt must start "Name a ..." or "Name an ..."`,
    );
  }
  const measureLabel = text(raw, "measureLabel", where, 80);
  const asOf = text(raw, "asOf", where, 10);
  if (asOf !== "" && !isDate(asOf)) {
    problems.push(`${where}: asOf "${asOf}" is not a real date (YYYY-MM-DD)`);
  }
  const measure = raw.measure as Measure;
  if (!MEASURES.includes(measure)) {
    problems.push(
      `${where}: measure is ${String(raw.measure)}, not one of ${MEASURES.join(", ")}`,
    );
  }

  const era = mode === "retro" || mode === "nextgen";
  /** CLOSEST and FURTHEST: ranked by distance from the day's place, not by shares. */
  const distance = isDistanceRule(ruleFor(mode));
  const lastYear = isDate(asOf) ? Number(asOf.slice(0, 4)) : 9999;
  const list = Array.isArray(raw.answers) ? raw.answers : null;
  if (!list) {
    problems.push(`${where}: no answers`);
    return fail();
  }
  if (list.length < MIN_ANSWERS[mode]) {
    problems.push(
      `${where}: ${list.length} answers, and ${mode} needs at least ${MIN_ANSWERS[mode]}`,
    );
  }
  if (list.length > MAX_ANSWERS) {
    problems.push(`${where}: more than ${MAX_ANSWERS} answers`);
    return fail();
  }

  const answers: Answer[] = [];
  const ids = new Set<string>();
  list.forEach((item, i) => {
    if (!isBag(item)) {
      problems.push(`${where}: answer ${i + 1} is not an object`);
      return;
    }
    const answerId = text(item, "id", `${where}: answer ${i + 1}`, 80);
    const at = `${where}/${answerId === "" ? i + 1 : answerId}`;
    if (answerId !== "" && !KEBAB.test(answerId)) {
      problems.push(`${at}: id is not kebab-case (a-z, 0-9, hyphens)`);
    }
    if (ids.has(answerId)) problems.push(`${at}: the id is used twice`);
    ids.add(answerId);
    const name = text(item, "name", at, 80);
    const place = text(item, "place", at, 120);
    const country = text(item, "country", at, 60);

    const aliases: string[] = [];
    if (!Array.isArray(item.aliases)) {
      problems.push(`${at}: aliases is not a list (use [] for none)`);
    } else {
      if (item.aliases.length > MAX_ALIASES) {
        problems.push(`${at}: more than ${MAX_ALIASES} aliases`);
      }
      for (const alias of item.aliases.slice(0, MAX_ALIASES)) {
        if (typeof alias !== "string" || alias.trim() === "") {
          problems.push(`${at}: an alias is empty`);
        } else if (alias.trim() === name) {
          problems.push(
            `${at}: the alias "${alias.trim()}" is the name itself`,
          );
        } else {
          aliases.push(alias.trim());
        }
      }
    }

    const lat = item.lat;
    const lng = item.lng;
    const placed =
      typeof lat === "number" &&
      typeof lng === "number" &&
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      Math.abs(lat) <= 90 &&
      Math.abs(lng) <= 180 &&
      lat !== 0 &&
      lng !== 0;
    if (!placed) {
      problems.push(
        `${at}: lat ${String(lat)}, lng ${String(lng)} is not a place`,
      );
    }

    const share = item.popularity;
    const shared =
      typeof share === "number" &&
      Number.isFinite(share) &&
      share >= 0.1 &&
      share <= 100 &&
      Math.abs(share * 10 - Math.round(share * 10)) < 1e-9;
    // A distance mode has no use for a share: one may be left out.
    if (!shared && !(distance && share === undefined)) {
      problems.push(
        `${at}: popularity ${String(share)} is not 0.1 to 100 with at most one decimal place`,
      );
    }

    let years: number[] | undefined;
    if (item.years !== undefined || era) {
      const given = Array.isArray(item.years) ? item.years : null;
      const whole =
        given !== null &&
        given.length > 0 &&
        given.every(
          (y, k) =>
            Number.isInteger(y) &&
            y >= FIRST_YEAR &&
            y <= lastYear &&
            (k === 0 || y > given[k - 1]),
        );
      if (!whole) {
        problems.push(
          `${at}: years must be whole years, ascending, none repeated, ${FIRST_YEAR} to ${lastYear === 9999 ? "now" : lastYear}` +
            (era ? ` (${mode} is ranked by them)` : ""),
        );
      } else {
        years = [...(given as number[])];
      }
    }

    answers.push({
      id: answerId,
      name,
      aliases,
      place,
      country,
      lat: placed ? (lat as number) : 0,
      lng: placed ? (lng as number) : 0,
      popularity: shared ? (share as number) : 0,
      // filed below, once every answer is known
      shot: "miss",
      ...(years ? { years } : {}),
    });
  });

  let decoys: string[] | undefined;
  if (raw.decoys !== undefined) {
    if (
      !Array.isArray(raw.decoys) ||
      raw.decoys.some((d) => typeof d !== "string" || d.trim() === "")
    ) {
      problems.push(`${where}: decoys is not a list of names`);
    } else {
      decoys = raw.decoys.map((d: string) => d.trim());
    }
  }

  // Anything wrong so far makes the checks of the whole (shares, shots, the judge) unsafe
  // to run or misleading to read.
  if (problems.length > 0) return fail();

  if (!distance) {
    const sum = answers.reduce((total, a) => total + a.popularity, 0);
    if (Math.abs(sum - 100) > 0.5) {
      problems.push(
        `${where}: the popularity shares add up to ${Math.round(sum * 10) / 10}, not 100`,
      );
    }
    const tenths = answers
      .map((a) => Math.round(a.popularity * 10))
      .sort((a, b) => b - a);
    if (tenths[0] === tenths[1]) {
      problems.push(`${where}: two answers tie as the most common`);
    }
    if (tenths.at(-1) === tenths.at(-2)) {
      problems.push(`${where}: two answers tie as the most uncommon`);
    }

    // The shots, by the rule the mode is scored by.
    const rule = ruleFor(mode);
    const values = answers.map((a) =>
      era ? (rankingYear(a, rule) ?? 0) : a.popularity,
    );
    shotsFor(values, rule).forEach((shot, i) => {
      answers[i].shot = shot;
    });
    const used = new Set(answers.map((a) => a.shot));
    const empty = SHOT_ORDER.filter((shot) => isGoal(shot) && !used.has(shot));
    if (empty.length > 0) {
      problems.push(
        `${where}: no answer would be a ${empty.join(" or a ")} (the reveal shows one for each of the five shots that score: the ${era ? "years" : "shares"} are too bunched)`,
      );
    }
  } else {
    // Worked out against the day's place as the question is played (`shotsOf`).
    const places = new Set(answers.map((a) => `${a.lat},${a.lng}`));
    if (places.size < 3) {
      problems.push(
        `${where}: the answers are in ${places.size === 1 ? "one place" : "two places"}: a distance mode needs them spread out`,
      );
    }
  }

  const question: Question = {
    id,
    mode,
    prompt,
    measure,
    measureLabel,
    asOf,
    answers,
    ...(decoys && decoys.length > 0 ? { decoys } : {}),
  };

  // No two answers may be reached by the same words, as the judge reads them.
  const owner = new Map<string, string>();
  for (const answer of answers) {
    for (const words of [answer.name, ...answer.aliases]) {
      const form = normalise(words);
      const other = owner.get(form);
      if (form === "") {
        problems.push(`${where}/${answer.id}: "${words}" has no letters in it`);
      } else if (other !== undefined && other !== answer.id) {
        problems.push(
          `${where}/${answer.id}: "${words}" is also a name or alias of ${other}`,
        );
      } else {
        owner.set(form, answer.id);
      }
    }
  }
  if (problems.length > 0) return fail();

  // And the judge must give every name and alias to its own answer, and no decoy to any.
  for (const answer of answers) {
    for (const words of [answer.name, ...answer.aliases]) {
      const result = judge(question, words);
      if (result.kind !== "match") {
        problems.push(
          `${where}/${answer.id}: the judge does not accept "${words}" (${result.kind})`,
        );
      } else if (result.answer.id !== answer.id) {
        problems.push(
          `${where}/${answer.id}: the judge gives "${words}" to ${result.answer.id}`,
        );
      }
    }
  }
  for (const decoy of decoys ?? []) {
    const result = judge(question, decoy);
    if (result.kind === "match") {
      problems.push(
        `${where}: the decoy "${decoy}" is accepted as ${result.answer.id}`,
      );
    }
  }

  return problems.length > 0 ? fail() : { question, problems };
}
