import { distanceKm } from "./geo";
import { normalise } from "./judge";
import type {
  Grade,
  LatLng,
  Mode,
  Question,
  RankedAnswer,
  Rule,
} from "./types";

/** Every rule, the two played today first. */
export const RULES: readonly Rule[] = [
  "common",
  "niche",
  "closest",
  "furthest",
];

/**
 * The rule a mode is scored by: HOME is `common` (the most popular answer wins), AWAY is
 * `niche` (the least popular wins). The distance rules, `closest` and `furthest`, belong to
 * the locked modes CLOSEST and FURTHEST: they are switched on by mapping a mode to them here.
 */
export function ruleFor(mode: Mode): Rule {
  return mode === "away" ? "niche" : "common";
}

/** Whether a rule ranks by distance from today's stadium (else by popularity). */
export function isDistanceRule(rule: Rule): boolean {
  return rule === "closest" || rule === "furthest";
}

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
 * The table for one question under one rule: every answer with its share, its distance from
 * the stadium in whole kilometres, its points and its rank, best first (ties in name order).
 *
 * - `common` (HOME): the higher the share, the better.
 * - `niche` (AWAY): the lower the share, the better.
 * - `closest`: nearer the stadium is better. `furthest`: further is better.
 *
 * Answers with the same key (the same share to a tenth of a percent, or the same rounded
 * distance) are tied: they share points and rank (1, 2, 2, 4).
 * `points = round(100 * worse / (better + worse))`, counting the answers strictly better and
 * strictly worse. The best answer scores 100 and the worst 0. Only the best can score 100: in
 * a list long enough for second place to round up to 100 (over 200 answers), it is held at 99.
 * The stadium is only used by the distance rules, but every row carries its distance.
 */
export function rankAnswers(
  question: Question,
  stadium: LatLng,
  rule: Rule,
): RankedAnswer[] {
  const rows: RankedAnswer[] = question.answers.map((answer) => ({
    answer,
    km: Math.round(distanceKm(stadium, answer)),
    share: answer.popularity,
    points: 0,
    rank: 0,
  }));
  const keys = new Map(rows.map((row) => [row, keyFor(rule, row)]));
  const key = (row: RankedAnswer) => keys.get(row) ?? 0;
  rows.sort((a, b) => key(a) - key(b) || byName(a, b));

  const n = rows.length;
  let start = 0;
  while (start < n) {
    let end = start + 1;
    while (end < n && key(rows[end]) === key(rows[start])) end++;
    const better = start;
    const worse = n - end;
    let points = 100;
    if (better + worse > 0) {
      points = Math.round((100 * worse) / (better + worse));
      if (better > 0) points = Math.min(points, 99);
    }
    for (let i = start; i < end; i++) {
      rows[i].points = points;
      rows[i].rank = better + 1;
    }
    start = end;
  }
  return rows;
}

/** The grade of a valid answer worth this many points. Never "timeup" or "skipped". */
export function gradeFor(points: number): Grade {
  if (points >= 100) return "worldie";
  if (points >= 80) return "topbins";
  if (points >= 55) return "goal";
  if (points >= 30) return "ontarget";
  return "wide";
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
  /** The grade these points earn. Only the best answer (and any tied with it) is "worldie". */
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
    grade: gradeFor(table[index].points),
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
