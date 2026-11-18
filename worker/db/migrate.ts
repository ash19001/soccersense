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
  {
    id: 4,
    name: "accounts: who has one, the devices signed in, the sign-in links sent, their games' history",
    sql: [
      // A player who chose to have an account (worker/accounts/store.ts). No password:
      // they sign in by a link sent to the address, or with Google. `nickname_key` is the
      // name in lower case: no two accounts may have the same one.
      `CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        google_id TEXT,
        nickname TEXT NOT NULL,
        nickname_key TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS accounts_email ON accounts (email)`,
      `CREATE UNIQUE INDEX IF NOT EXISTS accounts_google ON accounts (google_id)
        WHERE google_id IS NOT NULL`,
      `CREATE UNIQUE INDEX IF NOT EXISTS accounts_nickname ON accounts (nickname_key)`,
      // A device signed in to an account. `id` is the hash of the token in its cookie.
      `CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS sessions_account ON sessions (account_id)`,
      // A sign-in link that was sent. `id` is the hash of its token. Kept for a day.
      `CREATE TABLE IF NOT EXISTS sign_in_links (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        used_at INTEGER
      )`,
      `CREATE INDEX IF NOT EXISTS sign_in_links_email
        ON sign_in_links (email, created_at)`,
      // An account's games (worker/games/store.ts): where each came from (`server`, played
      // through the server; `device`, played on one of its devices before it signed in,
      // kept for its streak and stats and never for a leaderboard), and what its questions
      // asked, so another device can show it again. (A column cannot be added "if not
      // exists": an instance that meets this a second time has its whole migration rolled
      // back, and carries on, as above.)
      `ALTER TABLE games ADD COLUMN origin TEXT NOT NULL DEFAULT 'server'`,
      `ALTER TABLE games ADD COLUMN prompts TEXT`,
    ],
  },
  {
    id: 5,
    name: "the leaderboards: how many accounts finished on each total, and the top ten's index",
    sql: [
      // For each day, mode and total, how many accounts' games (played through the server)
      // were decided on it (worker/games/board.ts): a place is worked out from these
      // counts, so a board never has to read every game. One more as each game is decided.
      `CREATE TABLE IF NOT EXISTS board_tally (
        day INTEGER NOT NULL,
        mode TEXT NOT NULL,
        total INTEGER NOT NULL,
        players INTEGER NOT NULL,
        PRIMARY KEY (day, mode, total)
      )`,
      // The top ten of a day and mode, read from the index alone.
      `CREATE INDEX IF NOT EXISTS games_board
        ON games (day, mode, total DESC, finished_at)
        WHERE origin = 'server' AND finished_at IS NOT NULL`,
      // The counts of the games already decided.
      `INSERT OR IGNORE INTO board_tally (day, mode, total, players)
        SELECT day, mode, total, COUNT(*) FROM games
        WHERE origin = 'server' AND finished_at IS NOT NULL
        GROUP BY day, mode, total`,
    ],
  },
  {
    id: 6,
    name: "HOME's and AWAY's answers counted for the day's shares; accounts taken off the leaderboards",
    sql: [
      // For each day, mode and question, how many accounts gave each answer the judge
      // accepted (worker/games/shares.ts): it moves the answers' shares as the day goes
      // (~/game/day-shares). Counts only: nothing says whose answer was whose.
      `CREATE TABLE IF NOT EXISTS answer_tally (
        day INTEGER NOT NULL,
        mode TEXT NOT NULL,
        question_id TEXT NOT NULL,
        answer_id TEXT NOT NULL,
        players INTEGER NOT NULL,
        PRIMARY KEY (day, mode, question_id, answer_id)
      )`,
      // An account the admin has taken off the leaderboards (worker/accounts/moderation.ts):
      // when, and the admin's note of why. It still plays; its games are on no board and
      // its answers are not counted.
      `ALTER TABLE accounts ADD COLUMN banned_at INTEGER`,
      `ALTER TABLE accounts ADD COLUMN banned_note TEXT`,
    ],
  },
  {
    id: 7,
    name: "every player kept by the server: a player with no account is an account with no email address",
    sql: [
      // The product owner, 2026-11-18: players with no account on the leaderboards, their
      // answers counted, only their stats and streak on the device. Such a player is a
      // row here with no address (a guest, worker/accounts/store.ts); signing in gives it
      // one. SQLite cannot let a column go empty in place: the table is made again, with
      // the rows it had and the same indexes, in this migration's one transaction.
      `CREATE TABLE IF NOT EXISTS accounts_new (
        id TEXT PRIMARY KEY,
        email TEXT,
        google_id TEXT,
        nickname TEXT NOT NULL,
        nickname_key TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        banned_at INTEGER,
        banned_note TEXT
      )`,
      `INSERT INTO accounts_new (id, email, google_id, nickname, nickname_key, created_at,
         updated_at, banned_at, banned_note)
        SELECT id, email, google_id, nickname, nickname_key, created_at, updated_at,
          banned_at, banned_note
        FROM accounts`,
      `DROP TABLE accounts`,
      `ALTER TABLE accounts_new RENAME TO accounts`,
      `CREATE UNIQUE INDEX IF NOT EXISTS accounts_email ON accounts (email)
        WHERE email IS NOT NULL`,
      `CREATE UNIQUE INDEX IF NOT EXISTS accounts_google ON accounts (google_id)
        WHERE google_id IS NOT NULL`,
      `CREATE UNIQUE INDEX IF NOT EXISTS accounts_nickname ON accounts (nickname_key)`,
      // The guests the nightly tidy looks through (../tidy.ts).
      `CREATE INDEX IF NOT EXISTS accounts_guests ON accounts (created_at)
        WHERE email IS NULL`,
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
