import { distanceKm } from "./geo";
import { normalise } from "./judge";
import { SHOT_ORDER, SHOT_POINTS, shotsFor } from "./shots";
import type {
  Answer,
  Grade,
  LatLng,
  Mode,
  Question,
  RankedAnswer,
  Rule,
  Shot,
} from "./types";

/** Every rule, the four played today first. */
export const RULES: readonly Rule[] = [
  "common",
  "niche",
  "oldest",
  "newest",
  "closest",
  "furthest",
];

/**
 * The rule each mode is scored by: HOME is `common` (the most popular answer wins), AWAY
 * `niche` (the least popular), RETRO `oldest` (the earliest year), NEXT-GEN `newest` (the
 * latest). The distance rules, `closest` and `furthest`, belong to the locked modes CLOSEST
 * and FURTHEST: they are switched on by adding the mode and mapping it to them here.
 */
export const MODE_RULES: Readonly<Record<Mode, Rule>> = Object.freeze({
  home: "common",
  away: "niche",
  retro: "oldest",
  nextgen: "newest",
});

/** The rule a mode is scored by (`MODE_RULES`); HOME's for anything unknown. */
export function ruleFor(mode: Mode): Rule {
  return Object.hasOwn(MODE_RULES, mode) ? MODE_RULES[mode] : "common";
}

/** Whether a rule ranks by distance from today's stadium. */
export function isDistanceRule(rule: Rule): boolean {
  return rule === "closest" || rule === "furthest";
}

/** Whether a rule ranks by an answer's year (RETRO and NEXT-GEN). */
export function isYearRule(rule: Rule): boolean {
  return rule === "oldest" || rule === "newest";
}

/**
 * The year an answer is ranked by under a rule: its first (`oldest`) or its last
 * (`newest`) of `Answer.years`. Null under any other rule, and for an answer with no years.
 */
export function rankingYear(answer: Answer, rule: Rule): number | null {
  const years = answer.years;
  if (!isYearRule(rule) || !years || years.length === 0) return null;
  const year = rule === "oldest" ? years[0] : years[years.length - 1];
  return Number.isFinite(year) ? year : null;
}

/** Where an answer with no year sorts under a year rule: after every real year. */
const NO_YEAR = 1e6;

/** A share in tenths of a percent: shares that round to the same tenth are tied. */
function tenths(share: number): number {
  return Math.round(share * 10);
}

/** What a rule sorts by, smallest first. Rows with equal keys are tied. */
function keyFor(rule: Rule, row: RankedAnswer): number {
  switch (rule) {
    case "common":
      return -tenths(row.share);
    case "niche":
      return tenths(row.share);
    case "oldest":
      return row.year ?? NO_YEAR;
    case "newest":
      return row.year === null ? NO_YEAR : -row.year;
    case "closest":
      return row.km;
    case "furthest":
      return -row.km;
  }
}

function byName(a: RankedAnswer, b: RankedAnswer): number {
  const an = normalise(a.answer.name);
  const bn = normalise(b.answer.name);
  if (an !== bn) return an < bn ? -1 : 1;
  if (a.answer.id !== b.answer.id) return a.answer.id < b.answer.id ? -1 : 1;
  return 0;
}

/**
 * The shot of every answer of a question under a rule, in the question's answer order. Under
 * the question's own rule (`ruleFor(question.mode)`) these are the shots filed in the data
 * (`Answer.shot`). Under any other rule they are worked out by `shotsFor`: from the shares
 * for `common` and `niche`, from the years for `oldest` and `newest` (an answer with no
 * year counts as the worst), from the whole kilometres to the stadium for `closest` and
 * `furthest`.
 */
export function shotsOf(
  question: Question,
  stadium: LatLng,
  rule: Rule,
): Shot[] {
  if (rule === ruleFor(question.mode)) {
    return question.answers.map((answer) => answer.shot);
  }
  if (isYearRule(rule)) {
    const years = question.answers.map((answer) => rankingYear(answer, rule));
    const known = years.filter((year): year is number => year !== null);
    // No year at all ranks last: after the latest in RETRO, before the earliest in NEXT-GEN.
    const worst =
      known.length === 0
        ? 0
        : rule === "oldest"
          ? Math.max(...known) + 1
          : Math.min(...known) - 1;
    return shotsFor(
      years.map((year) => year ?? worst),
      rule,
    );
  }
  const values = isDistanceRule(rule)
    ? question.answers.map((answer) => Math.round(distanceKm(stadium, answer)))
    : question.answers.map((answer) => answer.popularity);
  return shotsFor(values, rule);
}

/**
 * The table for one question under one rule: every answer with its share, its distance from
 * the stadium in whole kilometres, its year (under `oldest` and `newest`), its shot, its
 * points and its rank, best first.
 *
 * Answers are ranked by their shot, worldies first (`SHOT_ORDER`), and within a shot by
 * the rule:
 * - `common` (HOME): the higher the share, the better.
 * - `niche` (AWAY): the lower the share, the better.
 * - `oldest` (RETRO): the earlier the answer's first year, the better.
 * - `newest` (NEXT-GEN): the later the answer's last year, the better.
 * - `closest`: nearer the stadium is better. `furthest`: further is better.
 *
 * Then by name. The shots are `shotsOf`, and an answer's points are its shot's
 * (`SHOT_POINTS`). Answers with the same shot and the same key (the same share to a tenth of
 * a percent, the same year, or the same whole kilometres) are tied: they share a rank
 * (1, 2, 2, 4).
 * The stadium is only used by the distance rules, but every row carries its distance.
 */
export function rankAnswers(
  question: Question,
  stadium: LatLng,
  rule: Rule,
): RankedAnswer[] {
  const shots = shotsOf(question, stadium, rule);
  const rows: RankedAnswer[] = question.answers.map((answer, i) => ({
    answer,
    km: Math.round(distanceKm(stadium, answer)),
    share: answer.popularity,
    shot: shots[i],
    points: SHOT_POINTS[shots[i]],
    rank: 0,
    year: rankingYear(answer, rule),
  }));
  const keys = new Map(rows.map((row) => [row, keyFor(rule, row)]));
  const key = (row: RankedAnswer) => keys.get(row) ?? 0;
  const order = (row: RankedAnswer) => SHOT_ORDER.indexOf(row.shot);
  const same = (a: RankedAnswer, b: RankedAnswer) =>
    order(a) === order(b) && key(a) === key(b);
  rows.sort((a, b) => order(a) - order(b) || key(a) - key(b) || byName(a, b));

  for (let i = 0; i < rows.length; i++) {
    rows[i].rank =
      i > 0 && same(rows[i], rows[i - 1]) ? rows[i - 1].rank : i + 1;
  }
  return rows;
}

/** The table row of one answer, or null when the id is not in the table. */
export function rankedFor(
  table: readonly RankedAnswer[],
  answerId: string | null,
): RankedAnswer | null {
  if (answerId === null) return null;
  return table.find((row) => row.answer.id === answerId) ?? null;
}

/** A table row chosen for the reveal sheet. */
export interface TableRow extends RankedAnswer {
  /** The row's shot as a grade (the same value as `shot`), for `data-grade`. */
  grade: Grade;
  /** The answer the player gave. */
  isPlayer: boolean;
  /** 0-based position of this row in the full table. */
  index: number;
  /** Rows of the full table were left out just above this one. */
  gapBefore: boolean;
}

/**
 * The rows to show in the reveal when the full table is too long: always the best row, the
 * player's row (if they gave an answer) and the worst row, plus others spread evenly through
 * the table, in table order. Tables that fit are returned whole. When `maxRows` is smaller
 * than the rows that must be shown (2, or 3 with a player's row in the middle), those rows
 * are still all returned.
 */
export function tableExcerpt(
  table: readonly RankedAnswer[],
  answerId: string | null,
  maxRows: number,
): TableRow[] {
  const n = table.length;
  const player =
    answerId === null ? -1 : table.findIndex((r) => r.answer.id === answerId);
  const limit = Number.isNaN(maxRows) ? n : Math.floor(maxRows);
  let picked: number[];
  if (n <= limit || n <= 2) {
    picked = table.map((_, i) => i);
  } else {
    const interiorPlayer = player > 0 && player < n - 1;
    const slots = Math.max(limit, interiorPlayer ? 3 : 2);
    picked = [];
    for (let i = 0; i < slots; i++) {
      picked.push(Math.round((i * (n - 1)) / (slots - 1)));
    }
    if (interiorPlayer && !picked.includes(player)) {
      // Swap the nearest spread-out row (never the first or last) for the player's.
      let nearest = 1;
      for (let i = 2; i < slots - 1; i++) {
        if (Math.abs(picked[i] - player) < Math.abs(picked[nearest] - player)) {
          nearest = i;
        }
      }
      picked[nearest] = player;
      picked.sort((a, b) => a - b);
    }
  }
  return picked.map((index, i) => ({
    ...table[index],
    grade: table[index].shot,
    isPlayer: index === player,
    index,
    gapBefore: index > 0 && (i === 0 || picked[i - 1] !== index - 1),
  }));
}

/**
 * A share of players as the reveal and the table show it: "34%", "2.5%", "0.4%". At most one
 * decimal place, none for a whole number; "under 0.1%" for anything smaller than 0.05.
 */
export function formatShare(share: number): string {
  if (!Number.isFinite(share) || share < 0.05) return "under 0.1%";
  const rounded = tenths(Math.min(share, 100)) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}%`;
}
