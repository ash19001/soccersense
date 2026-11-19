/**
 * The day's questions, in the database: drafted, approved, scheduled.
 *
 * Every day has, for each mode, seven places for a question (`SLOTS`). A place holds one
 * question and its state:
 *
 *   draft      written (by AI, once a week) and waiting to be looked at
 *   approved   passed by the product owner: it will be played on its day
 *   rejected   turned down, with the reason: to be drafted again
 *
 * Nothing is played that has not been approved (the product owner, 2026-11-17: the
 * questions come "from ai after approval and scheduling"). A day and mode is scheduled when
 * all seven of its places are approved, and only then does `scheduledFor` hand them over.
 * A question is stored whole, as the JSON of a `Question` that has passed `checkQuestion`.
 */

import type { Mode, Question } from "~/game/types";

import type { D1 } from "../env";

/** Questions in a game. */
export const SLOTS = 7;
export const QUESTION_MODES: readonly Mode[] = [
  "home",
  "away",
  "retro",
  "nextgen",
  "closest",
  "furthest",
];

export type SlotStatus = "draft" | "approved" | "rejected";
export const SLOT_STATUSES: readonly SlotStatus[] = [
  "draft",
  "approved",
  "rejected",
];

/** Which question: a day's number, a mode, and a place from 0 to 6. */
export interface SlotKey {
  day: number;
  mode: Mode;
  slot: number;
}

export interface Slot extends SlotKey {
  status: SlotStatus;
  question: Question;
  /** The drafter's note: its sources, and anything it was unsure of. */
  note: string;
  /** The reviewer's note: why it was rejected, say. */
  review: string;
  /** Who wrote it: "ai" or "hand". */
  source: string;
  createdAt: number;
  updatedAt: number;
}

interface Row {
  day: number;
  mode: string;
  slot: number;
  status: string;
  question: string;
  note: string;
  review: string;
  source: string;
  created_at: number;
  updated_at: number;
}

const toSlot = (row: Row): Slot => ({
  day: row.day,
  mode: row.mode as Mode,
  slot: row.slot,
  status: row.status as SlotStatus,
  question: JSON.parse(row.question) as Question,
  note: row.note,
  review: row.review,
  source: row.source,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/** A whole day number from 1, a mode that has questions, a place from 0 to 6. */
export function isSlotKey(key: SlotKey): boolean {
  return (
    Number.isInteger(key.day) &&
    key.day >= 1 &&
    key.day <= 100_000 &&
    QUESTION_MODES.includes(key.mode) &&
    Number.isInteger(key.slot) &&
    key.slot >= 0 &&
    key.slot < SLOTS
  );
}

/** One place, or null if nothing has been drafted for it. */
export async function slotAt(db: D1, key: SlotKey): Promise<Slot | null> {
  const row = await db
    .prepare(
      "SELECT * FROM question_slots WHERE day = ? AND mode = ? AND slot = ?",
    )
    .bind(key.day, key.mode, key.slot)
    .first<Row>();
  return row ? toSlot(row) : null;
}

/** Every place filled from day `from` to day `to`, in order of day, mode and place. */
export async function slotsBetween(
  db: D1,
  from: number,
  to: number,
): Promise<Slot[]> {
  const rows = await db
    .prepare(
      `SELECT * FROM question_slots WHERE day >= ? AND day <= ?
       ORDER BY day, CASE mode WHEN 'home' THEN 0 WHEN 'away' THEN 1
         WHEN 'retro' THEN 2 WHEN 'nextgen' THEN 3 WHEN 'closest' THEN 4
         ELSE 5 END, slot`,
    )
    .bind(from, to)
    .all<Row>();
  return rows.results.map(toSlot);
}

/** A place without its answers: which question is there, and its state. */
export interface BriefSlot extends SlotKey {
  status: SlotStatus;
  review: string;
  questionId: string;
  prompt: string;
  answers: number;
  updatedAt: number;
}

/** Every place filled from day `from` to day `to`, in brief: for a long look back. */
export async function briefBetween(
  db: D1,
  from: number,
  to: number,
): Promise<BriefSlot[]> {
  const rows = await db
    .prepare(
      `SELECT day, mode, slot, status, review, question_id, updated_at,
         json_extract(question, '$.prompt') AS prompt,
         json_array_length(question, '$.answers') AS answers
       FROM question_slots WHERE day >= ? AND day <= ?
       ORDER BY day, CASE mode WHEN 'home' THEN 0 WHEN 'away' THEN 1
         WHEN 'retro' THEN 2 WHEN 'nextgen' THEN 3 WHEN 'closest' THEN 4
         ELSE 5 END, slot`,
    )
    .bind(from, to)
    .all<{
      day: number;
      mode: string;
      slot: number;
      status: string;
      review: string;
      question_id: string;
      updated_at: number;
      prompt: string;
      answers: number;
    }>();
  return rows.results.map((row) => ({
    day: row.day,
    mode: row.mode as Mode,
    slot: row.slot,
    status: row.status as SlotStatus,
    review: row.review,
    questionId: row.question_id,
    prompt: row.prompt,
    answers: row.answers,
    updatedAt: row.updated_at,
  }));
}

/**
 * Puts a question in a place as a draft. An approved question is left alone (`kept`) unless
 * `replace` is set: a week drafted twice must not undo what has been passed.
 */
export async function saveDraft(
  db: D1,
  key: SlotKey,
  draft: { question: Question; note: string; source: string },
  now: number,
  replace = false,
): Promise<"saved" | "kept"> {
  const stamp = Math.round(now);
  const done = await db
    .prepare(
      `INSERT INTO question_slots
         (day, mode, slot, status, question_id, question, note, review, source,
          created_at, updated_at)
       VALUES (?, ?, ?, 'draft', ?, ?, ?, '', ?, ?, ?)
       ON CONFLICT (day, mode, slot) DO UPDATE SET
         status = 'draft', question_id = excluded.question_id,
         question = excluded.question, note = excluded.note, review = '',
         source = excluded.source, updated_at = excluded.updated_at
       WHERE question_slots.status != 'approved' OR ? = 1`,
    )
    .bind(
      key.day,
      key.mode,
      key.slot,
      draft.question.id,
      JSON.stringify(draft.question),
      draft.note,
      draft.source,
      stamp,
      stamp,
      replace ? 1 : 0,
    )
    .run();
  return (done.meta.changes ?? 0) > 0 ? "saved" : "kept";
}

/** Sets a place's state and the reviewer's note. False if there is nothing in the place. */
export async function setStatus(
  db: D1,
  key: SlotKey,
  status: SlotStatus,
  review: string,
  now: number,
): Promise<boolean> {
  const done = await db
    .prepare(
      `UPDATE question_slots SET status = ?, review = ?, updated_at = ?
       WHERE day = ? AND mode = ? AND slot = ?`,
    )
    .bind(status, review, Math.round(now), key.day, key.mode, key.slot)
    .run();
  return (done.meta.changes ?? 0) > 0;
}

/** The other places of a day and mode that hold a question with this id. */
export async function sameQuestionElsewhere(
  db: D1,
  key: SlotKey,
  questionId: string,
): Promise<number[]> {
  const rows = await db
    .prepare(
      `SELECT slot FROM question_slots
       WHERE day = ? AND mode = ? AND question_id = ? AND slot != ?`,
    )
    .bind(key.day, key.mode, questionId, key.slot)
    .all<{ slot: number }>();
  return rows.results.map((row) => row.slot);
}

/**
 * The seven questions scheduled for a day and mode, in order, or null unless every one of
 * its places is approved: a day is played whole or not at all.
 */
export async function scheduledFor(
  db: D1,
  day: number,
  mode: Mode,
): Promise<Question[] | null> {
  const rows = await db
    .prepare(
      `SELECT * FROM question_slots
       WHERE day = ? AND mode = ? AND status = 'approved' ORDER BY slot`,
    )
    .bind(day, mode)
    .all<Row>();
  if (rows.results.length !== SLOTS) return null;
  return rows.results.map((row) => toSlot(row).question);
}
