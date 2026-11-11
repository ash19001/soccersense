import { distanceKm } from "./geo";
import { normalise } from "./judge";
import type { Grade, LatLng, Mode, Question, RankedAnswer } from "./types";

function byName(a: RankedAnswer, b: RankedAnswer): number {
  const an = normalise(a.answer.name);
  const bn = normalise(b.answer.name);
  if (an !== bn) return an < bn ? -1 : 1;
  if (a.answer.id !== b.answer.id) return a.answer.id < b.answer.id ? -1 : 1;
  return 0;
}

/**
 * The table for one question on one day: every answer with its distance from the stadium in
 * whole kilometres, its points and its rank, best first (ties in name order).
 *
 * HOME: nearer is better. AWAY: further is better. Answers with the same rounded distance are
 * tied: they share points and rank (1, 2, 2, 4).
 * `points = round(100 * worse / (better + worse))`, counting the answers strictly better and
 * strictly worse. The best answer scores 100 and the worst 0. Only the best can score 100: in
 * a list long enough for second place to round up to 100 (over 200 answers), it is held at 99.
 */
export function rankAnswers(
  question: Question,
  stadium: LatLng,
  mode: Mode,
): RankedAnswer[] {
  const rows: RankedAnswer[] = question.answers.map((answer) => ({
    answer,
    km: Math.round(distanceKm(stadium, answer)),
    points: 0,
    rank: 0,
  }));
  const direction = mode === "home" ? 1 : -1;
  rows.sort((a, b) => (a.km - b.km) * direction || byName(a, b));

  const n = rows.length;
  let start = 0;
  while (start < n) {
    let end = start + 1;
    while (end < n && rows[end].km === rows[start].km) end++;
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
