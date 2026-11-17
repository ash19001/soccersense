/**
 * The database's tables, kept in step with the code by the Worker itself.
 *
 * Each change to the tables is a migration: a number, a name and its SQL. The first time an
 * instance of the Worker needs the database it looks up the highest number applied
 * (`_migrations`) and applies the ones after it, each as one transaction with its own record,
 * so a migration is applied whole or not at all. Nothing has to be run by hand or added to
 * the deploy: a new database (Cloudflare's, a developer's local one, a test's) is brought up
 * to date by the first request.
 *
 * Rules for whoever adds one: never edit or reorder a migration that has been deployed, only
 * add the next number; and keep each statement safe to meet twice (`IF NOT EXISTS`), since
 * two instances can start at the same moment (the loser's transaction is rolled back by its
 * record's primary key, and it carries on).
 */

import type { D1 } from "../env";

export interface Migration {
  id: number;
  name: string;
  sql: readonly string[];
}

export const MIGRATIONS: readonly Migration[] = [
  {
    id: 1,
    name: "counters: numbers handed out one at a time (the next soccerfan)",
    sql: [
      `CREATE TABLE IF NOT EXISTS counters (
        name TEXT PRIMARY KEY,
        value INTEGER NOT NULL
      )`,
    ],
  },
  {
    id: 2,
    name: "question_slots: the day's questions, drafted, approved, scheduled",
    sql: [
      // One row for each of a day and mode's seven places (worker/questions/store.ts).
      `CREATE TABLE IF NOT EXISTS question_slots (
        day INTEGER NOT NULL,
        mode TEXT NOT NULL,
        slot INTEGER NOT NULL,
        status TEXT NOT NULL,
        question_id TEXT NOT NULL,
        question TEXT NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        review TEXT NOT NULL DEFAULT '',
        source TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (day, mode, slot)
      )`,
    ],
  },
  {
    id: 3,
    name: "games the server runs: the key their tickets are sealed with, and accounts' games",
    sql: [
      // What the Worker makes for itself and keeps to itself (worker/games/ticket.ts).
      `CREATE TABLE IF NOT EXISTS secrets (
        name TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )`,
      // An account's game of a day and mode (worker/games/store.ts): one each, as it
      // stands. A player with no account keeps their own game: nothing of it is here.
      `CREATE TABLE IF NOT EXISTS games (
        player_id TEXT NOT NULL,
        day INTEGER NOT NULL,
        mode TEXT NOT NULL,
        source TEXT NOT NULL,
        idx INTEGER NOT NULL,
        phase TEXT NOT NULL,
        turns TEXT NOT NULL,
        total INTEGER NOT NULL,
        started_at INTEGER NOT NULL,
        deadline INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        finished_at INTEGER,
        PRIMARY KEY (player_id, day, mode)
      )`,
    ],
  },
];

/** The highest migration there is: what `migrate` brings a database to. */
export const SCHEMA_VERSION = MIGRATIONS.reduce((v, m) => Math.max(v, m.id), 0);

/** Applies every migration the database has not had. Returns the version it is now at. */
export async function migrate(
  db: D1,
  now: number,
  migrations: readonly Migration[] = MIGRATIONS,
): Promise<number> {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS _migrations (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at INTEGER NOT NULL
      )`,
    )
    .run();
  const applied = async () =>
    (
      await db.prepare("SELECT MAX(id) AS v FROM _migrations").first<{
        v: number | null;
      }>()
    )?.v ?? 0;
  let version = await applied();
  for (const m of [...migrations].sort((a, b) => a.id - b.id)) {
    if (m.id <= version) continue;
    try {
      await db.batch([
        ...m.sql.map((sql) => db.prepare(sql)),
        db
          .prepare(
            "INSERT INTO _migrations (id, name, applied_at) VALUES (?, ?, ?)",
          )
          .bind(m.id, m.name, Math.round(now)),
      ]);
      version = m.id;
    } catch (error) {
      // Another instance may have applied it in the same moment: then it is there.
      const reached = await applied();
      if (reached < m.id) throw error;
      version = reached;
    }
  }
  return version;
}

const ready = new WeakMap<D1, Promise<number>>();

/**
 * The database, up to date: migrated once for each instance of the Worker, then remembered.
 * A failure is not remembered, so the next request tries again.
 */
export function database(db: D1, now: number): Promise<number> {
  let known = ready.get(db);
  if (!known) {
    known = migrate(db, now);
    ready.set(db, known);
    known.catch(() => ready.delete(db));
  }
  return known;
}
