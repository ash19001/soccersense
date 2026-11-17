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
