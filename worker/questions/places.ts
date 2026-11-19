/**
 * The day's place, in the database: drafted, approved, played.
 *
 * Each day has one: where its CLOSEST and FURTHEST measure every answer from, named on their
 * boards and pinned on their maps. It is drafted with the week's questions and approved at
 * the desk like them (the product owner, 2026-11-19: "i dont want fixed places because
 * eventually questions will get repetitive so it should also be generated"), in the same
 * three states: `draft`, `approved`, `rejected`. Only an approved place is played; a day
 * without one takes the fixed list's in turn (app/data/places.ts, ../games/questions.ts).
 */

import type { Place } from "~/data/places";

import type { D1 } from "../env";
import { type SlotStatus, isSlotKey } from "./store";

export interface PlaceSlot {
  day: number;
  status: SlotStatus;
  place: Place;
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
  status: string;
  place: string;
  note: string;
  review: string;
  source: string;
  created_at: number;
  updated_at: number;
}

const toPlaceSlot = (row: Row): PlaceSlot => ({
  day: row.day,
  status: row.status as SlotStatus,
  place: JSON.parse(row.place) as Place,
  note: row.note,
  review: row.review,
  source: row.source,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/** A whole day number from 1 (as a question's place has). */
export function isPlaceDay(day: number): boolean {
  return isSlotKey({ day, mode: "home", slot: 0 });
}

/** A day's place, or null if none has been drafted for it. */
export async function placeAt(db: D1, day: number): Promise<PlaceSlot | null> {
  const row = await db
    .prepare("SELECT * FROM day_places WHERE day = ?")
    .bind(day)
    .first<Row>();
  return row ? toPlaceSlot(row) : null;
}

/** Every day's place drafted from day `from` to day `to`, in order. */
export async function placesBetween(
  db: D1,
  from: number,
  to: number,
): Promise<PlaceSlot[]> {
  const rows = await db
    .prepare(
      "SELECT * FROM day_places WHERE day >= ? AND day <= ? ORDER BY day",
    )
    .bind(from, to)
    .all<Row>();
  return rows.results.map(toPlaceSlot);
}

/** A day's place if it is approved, else null. */
export async function approvedPlace(
  db: D1,
  day: number,
): Promise<Place | null> {
  const slot = await placeAt(db, day);
  return slot?.status === "approved" ? slot.place : null;
}

/**
 * Puts a place in a day as a draft. An approved one is left alone (`kept`) unless `replace`
 * is set: a week drafted twice must not undo what has been passed.
 */
export async function savePlace(
  db: D1,
  day: number,
  draft: { place: Place; note: string; source: string },
  now: number,
  replace = false,
): Promise<"saved" | "kept"> {
  const stamp = Math.round(now);
  const done = await db
    .prepare(
      `INSERT INTO day_places
         (day, status, place_id, place, note, review, source, created_at, updated_at)
       VALUES (?, 'draft', ?, ?, ?, '', ?, ?, ?)
       ON CONFLICT (day) DO UPDATE SET
         status = 'draft', place_id = excluded.place_id, place = excluded.place,
         note = excluded.note, review = '', source = excluded.source,
         updated_at = excluded.updated_at
       WHERE day_places.status != 'approved' OR ? = 1`,
    )
    .bind(
      day,
      draft.place.id,
      JSON.stringify(draft.place),
      draft.note,
      draft.source,
      stamp,
      stamp,
      replace ? 1 : 0,
    )
    .run();
  return (done.meta.changes ?? 0) > 0 ? "saved" : "kept";
}

/** Sets a day's place's state and the reviewer's note. False if it has none. */
export async function setPlaceStatus(
  db: D1,
  day: number,
  status: SlotStatus,
  review: string,
  now: number,
): Promise<boolean> {
  const done = await db
    .prepare(
      "UPDATE day_places SET status = ?, review = ?, updated_at = ? WHERE day = ?",
    )
    .bind(status, review, Math.round(now), day)
    .run();
  return (done.meta.changes ?? 0) > 0;
}

/** The other days from `from` to `to` whose place has this id (a place used again). */
export async function samePlaceElsewhere(
  db: D1,
  day: number,
  placeId: string,
  from: number,
  to: number,
): Promise<number[]> {
  const rows = await db
    .prepare(
      `SELECT day FROM day_places
       WHERE place_id = ? AND day != ? AND day >= ? AND day <= ? AND status != 'rejected'
       ORDER BY day`,
    )
    .bind(placeId, day, from, to)
    .all<{ day: number }>();
  return rows.results.map((row) => row.day);
}

/**
 * A day's place has changed after its CLOSEST and FURTHEST were passed: their approved
 * questions were judged against the old one, so they go back to draft with a note. How many.
 */
export async function placeChanged(
  db: D1,
  day: number,
  now: number,
): Promise<number> {
  const done = await db
    .prepare(
      `UPDATE question_slots SET status = 'draft', review = ?, updated_at = ?
       WHERE day = ? AND mode IN ('closest', 'furthest') AND status = 'approved'`,
    )
    .bind(PLACE_CHANGED, Math.round(now), day)
    .run();
  return done.meta.changes ?? 0;
}

/** What a question sent back by its day's place changing says. */
export const PLACE_CHANGED =
  "The day's place changed after this was approved: look at it again from the new one.";
