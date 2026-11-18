/**
 * The nightly tidy (wrangler.jsonc, `triggers`; ./index.ts, `scheduled`): what the server
 * promised not to keep is taken away.
 *
 * - **A guest who has stopped playing** (a player with no account, kept by the server since
 *   2026-11-18): a year after their last game, or a year after they were made if they never
 *   played, they go with everything kept for them, as when they delete themselves (the
 *   product owner, 2026-11-18: "yeah thats fine" to twelve months). Their games come off
 *   past days' boards with them.
 * - **Sessions that have run out**, and **sign-in links** older than a day.
 *
 * A night's work is bounded (`TIDY_BATCH` guests a round, `TIDY_ROUNDS` rounds): whatever is
 * left is taken the next night.
 */

import { dayNumber } from "~/game/day";

import { LINK_KEPT_MS, deleteAccount } from "./accounts/store";
import { database } from "./db/migrate";
import type { D1 } from "./env";

/** How long a guest is kept after their last game: a year. */
export const GUEST_KEPT_MS = 365 * 24 * 60 * 60 * 1000;
export const TIDY_BATCH = 100;
export const TIDY_ROUNDS = 20;

export interface Tidied {
  guests: number;
}

/** Takes away what is no longer kept, as of `now`. */
export async function tidy(db: D1, now: number): Promise<Tidied> {
  await database(db, now);
  const cutoff = Math.round(now - GUEST_KEPT_MS);
  const cutoffDay = dayNumber(new Date(cutoff));
  let guests = 0;
  for (let round = 0; round < TIDY_ROUNDS; round++) {
    const { results } = await db
      .prepare(
        `SELECT id FROM accounts a
         WHERE a.email IS NULL AND a.created_at < ?
           AND NOT EXISTS (
             SELECT 1 FROM games g WHERE g.player_id = a.id AND g.day >= ?
           )
         LIMIT ?`,
      )
      .bind(cutoff, cutoffDay, TIDY_BATCH)
      .all<{ id: string }>();
    for (const { id } of results) {
      await deleteAccount(db, { id, email: null });
    }
    guests += results.length;
    if (results.length < TIDY_BATCH) break;
  }
  await db.batch([
    db
      .prepare("DELETE FROM sessions WHERE expires_at <= ?")
      .bind(Math.round(now)),
    db
      .prepare("DELETE FROM sign_in_links WHERE created_at < ?")
      .bind(Math.round(now - LINK_KEPT_MS)),
  ]);
  return { guests };
}
