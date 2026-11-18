// @vitest-environment node
/**
 * The nightly tidy (worker/tidy.ts), against a real SQLite in memory: a guest who has not
 * played for a year goes, with everything kept for them; anyone else stays.
 */
import { afterEach, describe, expect, test } from "vitest";

import { EPOCH_UTC, MS_PER_DAY, dayNumber } from "~/game/day";

import {
  createAccount,
  createGuest,
  createLink,
  createSession,
} from "./accounts/store";
import { database } from "./db/migrate";
import { type MemoryD1, memoryD1 } from "./testing/d1";
import { GUEST_KEPT_MS, tidy } from "./tidy";

/** A night well into the game's life. */
const NIGHT = EPOCH_UTC + 500 * MS_PER_DAY + 3.7 * 60 * 60 * 1000;
const YEAR_AGO = NIGHT - GUEST_KEPT_MS;

const open: MemoryD1[] = [];
afterEach(() => {
  for (const db of open.splice(0)) db.close();
});

async function fresh(): Promise<MemoryD1> {
  const db = memoryD1();
  open.push(db);
  await database(db, YEAR_AGO - MS_PER_DAY * 30);
  return db;
}

/** A finished game of `day`, and its place on the board's counts. */
async function played(db: MemoryD1, playerId: string, day: number) {
  await db
    .prepare(
      `INSERT INTO games (player_id, day, mode, source, idx, phase, turns, total, started_at,
         deadline, created_at, updated_at, finished_at, origin)
       VALUES (?, ?, 'home', 'sample', 6, 'done', '[]', 500, 1, NULL, 1, 1, 1, 'server')`,
    )
    .bind(playerId, day)
    .run();
  await db
    .prepare(
      `INSERT INTO board_tally (day, mode, total, players) VALUES (?, 'home', 500, 1)
       ON CONFLICT (day, mode, total) DO UPDATE SET players = players + 1`,
    )
    .bind(day)
    .run();
}

const ids = async (db: MemoryD1) =>
  (
    await db
      .prepare("SELECT nickname FROM accounts ORDER BY nickname")
      .all<{ nickname: string }>()
  ).results.map((row) => row.nickname);

describe("the nightly tidy", () => {
  test("takes a guest whose last game was over a year ago, with their games and devices", async () => {
    const db = await fresh();
    const made = YEAR_AGO - 60 * MS_PER_DAY;
    const idle = await createGuest(db, "Idle Ida", made);
    const keen = await createGuest(db, "Keen Ken", made);
    const lapsed = await createAccount(
      db,
      { email: "lapsed@example.com", googleId: null },
      made,
    );
    const longAgo = dayNumber(new Date(YEAR_AGO)) - 10;
    await played(db, idle.id, longAgo);
    await played(db, keen.id, longAgo);
    await played(db, keen.id, dayNumber(new Date(NIGHT)) - 3);
    await played(db, lapsed.id, longAgo);
    await createSession(db, idle.id, made, GUEST_KEPT_MS * 2);

    expect(await tidy(db, NIGHT)).toEqual({ guests: 1 });
    // an account is kept until its player deletes it, however long ago they played
    expect(await ids(db)).toEqual(["Keen Ken", "soccerfan1"]);
    const games = await db
      .prepare("SELECT player_id FROM games WHERE player_id = ?")
      .bind(idle.id)
      .all();
    expect(games.results).toEqual([]);
    const sessions = await db
      .prepare("SELECT 1 FROM sessions WHERE account_id = ?")
      .bind(idle.id)
      .all();
    expect(sessions.results).toEqual([]);
    // their game came off that day's board
    const tally = await db
      .prepare("SELECT players FROM board_tally WHERE day = ?")
      .bind(longAgo)
      .first<{ players: number }>();
    expect(tally?.players).toBe(2);
  });

  test("takes a guest who never played a year after they were made, and keeps a newer one", async () => {
    const db = await fresh();
    await createGuest(db, "Old Name", YEAR_AGO - MS_PER_DAY);
    await createGuest(db, "New Name", YEAR_AGO + MS_PER_DAY);
    expect(await tidy(db, NIGHT)).toEqual({ guests: 1 });
    expect(await ids(db)).toEqual(["New Name"]);
  });

  test("clears devices whose sessions have run out, and sign-in links over a day old", async () => {
    const db = await fresh();
    const guest = await createGuest(db, null, NIGHT - MS_PER_DAY);
    await createSession(db, guest.id, NIGHT - 10 * MS_PER_DAY, MS_PER_DAY);
    await createSession(db, guest.id, NIGHT - MS_PER_DAY, 30 * MS_PER_DAY);
    await createLink(db, "old@example.com", NIGHT - 2 * MS_PER_DAY);
    await createLink(db, "new@example.com", NIGHT - 60 * 1000);
    await tidy(db, NIGHT);
    const count = async (table: string) =>
      (
        await db
          .prepare(`SELECT COUNT(*) AS n FROM ${table}`)
          .first<{ n: number }>()
      )?.n;
    expect(await count("sessions")).toBe(1);
    expect(await count("sign_in_links")).toBe(1);
    expect(await count("accounts")).toBe(1);
  });
});
