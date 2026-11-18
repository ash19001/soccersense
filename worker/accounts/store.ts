/**
 * Accounts in the database (migration 4): who has one, the devices signed in to it, and the
 * sign-in links that have been sent.
 *
 * - `accounts`: one row for a player who chose to have an account: their email address,
 *   Google's id for them if they have signed in with Google, and their nickname. No
 *   password: there are none.
 * - `sessions`: one row for each device signed in. Its key is the hash of the token in that
 *   device's cookie (./tokens.ts), never the token.
 * - `sign_in_links`: one row for each link sent, by the hash of its token. A link works
 *   once and for a short while; the rows are also how many have been sent to an address
 *   lately, so nobody's inbox can be filled from here.
 *
 * Nothing here is about a player with no account: they have no row anywhere.
 */

import { fanNickname, nicknameKey } from "~/game/nickname";

import type { D1 } from "../env";
import { SESSION_LIFE_MS } from "./session";
import { hashOf, randomToken } from "./tokens";

/** How long a sign-in link works: 15 minutes. */
export const LINK_LIFE_MS = 15 * 60 * 1000;
/** A link's row is kept this long, to count what has been sent: a day. */
export const LINK_KEPT_MS = 24 * 60 * 60 * 1000;

export interface Account {
  id: string;
  email: string;
  /** Google's id for the person, once they have signed in with Google. */
  googleId: string | null;
  nickname: string;
  createdAt: number;
  updatedAt: number;
  /**
   * When the admin took the account off the leaderboards (./moderation.ts), or null. It
   * still plays; its games are on no board and its answers are not counted.
   */
  bannedAt: number | null;
}

interface Stored {
  id: string;
  email: string;
  google_id: string | null;
  nickname: string;
  created_at: number;
  updated_at: number;
  banned_at?: number | null;
}

const toAccount = (row: Stored): Account => ({
  id: row.id,
  email: row.email,
  googleId: row.google_id,
  nickname: row.nickname,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  bannedAt: row.banned_at ?? null,
});

const one = async (
  db: D1,
  where: string,
  value: string,
): Promise<Account | null> => {
  const row = await db
    .prepare(`SELECT * FROM accounts WHERE ${where} = ?`)
    .bind(value)
    .first<Stored>();
  return row ? toAccount(row) : null;
};

export const accountById = (db: D1, id: string) => one(db, "id", id);
export const accountByEmail = (db: D1, email: string) =>
  one(db, "email", email);
export const accountByGoogle = (db: D1, googleId: string) =>
  one(db, "google_id", googleId);

/** The next soccerfan's number: 1, 2, 3, ... each handed out once (the `counters` table). */
export async function nextFanNumber(db: D1): Promise<number> {
  const row = await db
    .prepare(
      `INSERT INTO counters (name, value) VALUES ('soccerfan', 1)
       ON CONFLICT (name) DO UPDATE SET value = value + 1
       RETURNING value`,
    )
    .first<{ value: number }>();
  if (!row) throw new Error("the soccerfan counter gave no number");
  return row.value;
}

/**
 * A new account for an email address, named `soccerfan` and the next number. If the
 * address (or the Google id) turns out to have an account already, because two sign-ins
 * arrived at once, that account is the answer.
 */
export async function createAccount(
  db: D1,
  who: { email: string; googleId: string | null },
  now: number,
): Promise<Account> {
  const at = Math.round(now);
  for (let tries = 0; tries < 10; tries++) {
    const account: Account = {
      id: crypto.randomUUID(),
      email: who.email,
      googleId: who.googleId,
      nickname: fanNickname(await nextFanNumber(db)),
      createdAt: at,
      updatedAt: at,
      bannedAt: null,
    };
    const done = await db
      .prepare(
        `INSERT OR IGNORE INTO accounts
           (id, email, google_id, nickname, nickname_key, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        account.id,
        account.email,
        account.googleId,
        account.nickname,
        nicknameKey(account.nickname),
        at,
        at,
      )
      .run();
    if ((done.meta.changes ?? 0) > 0) return account;
    // Not written: the address or the Google id has an account, or (it should not
    // happen: nobody can choose a soccerfan name) the name is taken, and the next is tried.
    const existing =
      (await accountByEmail(db, who.email)) ??
      (who.googleId ? await accountByGoogle(db, who.googleId) : null);
    if (existing) return existing;
  }
  throw new Error("no nickname could be given to a new account");
}

/** Notes Google's id on an account that has none, so a later change of address still finds it. */
export async function linkGoogle(
  db: D1,
  id: string,
  googleId: string,
  now: number,
): Promise<void> {
  await db
    .prepare(
      `UPDATE OR IGNORE accounts SET google_id = ?, updated_at = ?
       WHERE id = ? AND google_id IS NULL`,
    )
    .bind(googleId, Math.round(now), id)
    .run();
}

/**
 * Changes an account's nickname. False if another account has that name (compared without
 * regard to capitals): nothing is changed.
 */
export async function rename(
  db: D1,
  id: string,
  nickname: string,
  now: number,
): Promise<boolean> {
  const done = await db
    .prepare(
      `UPDATE OR IGNORE accounts SET nickname = ?, nickname_key = ?, updated_at = ?
       WHERE id = ?`,
    )
    .bind(nickname, nicknameKey(nickname), Math.round(now), id)
    .run();
  return (done.meta.changes ?? 0) > 0;
}

/** Takes an account away with everything kept for it: its games, its devices, its links. */
export async function deleteAccount(db: D1, account: Account): Promise<void> {
  await db.batch([
    // Its games come off the boards' counts first (one game a day and mode each), unless
    // they came off when it was taken off the leaderboards.
    db
      .prepare(
        `UPDATE board_tally SET players = players - 1
         WHERE (SELECT banned_at FROM accounts WHERE id = ?) IS NULL
           AND (day, mode, total) IN (
             SELECT day, mode, total FROM games
             WHERE player_id = ? AND origin = 'server' AND finished_at IS NOT NULL
           )`,
      )
      .bind(account.id, account.id),
    db.prepare("DELETE FROM board_tally WHERE players <= 0"),
    db.prepare("DELETE FROM games WHERE player_id = ?").bind(account.id),
    db.prepare("DELETE FROM sessions WHERE account_id = ?").bind(account.id),
    db.prepare("DELETE FROM sign_in_links WHERE email = ?").bind(account.email),
    db.prepare("DELETE FROM accounts WHERE id = ?").bind(account.id),
  ]);
}

// --- devices signed in ------------------------------------------------------------------

/**
 * Signs a device in to an account: returns the token for its cookie. The account's
 * sessions that have run out are cleared away as it goes.
 */
export async function createSession(
  db: D1,
  accountId: string,
  now: number,
): Promise<string> {
  const token = randomToken();
  const at = Math.round(now);
  await db.batch([
    db
      .prepare("DELETE FROM sessions WHERE account_id = ? AND expires_at <= ?")
      .bind(accountId, at),
    db
      .prepare(
        `INSERT INTO sessions (id, account_id, created_at, expires_at)
         VALUES (?, ?, ?, ?)`,
      )
      .bind(await hashOf(token), accountId, at, at + SESSION_LIFE_MS),
  ]);
  return token;
}

/** The account a session token stands for and when the session runs out, or null. */
export async function sessionOf(
  db: D1,
  token: string,
  now: number,
): Promise<{ account: Account; expiresAt: number } | null> {
  const row = await db
    .prepare(
      `SELECT s.expires_at AS session_expires_at, a.*
       FROM sessions s JOIN accounts a ON a.id = s.account_id
       WHERE s.id = ?`,
    )
    .bind(await hashOf(token))
    .first<Stored & { session_expires_at: number }>();
  if (!row || row.session_expires_at <= now) return null;
  return { account: toAccount(row), expiresAt: row.session_expires_at };
}

/** Gives a session its full life again, from now. */
export async function renewSession(
  db: D1,
  token: string,
  now: number,
): Promise<void> {
  await db
    .prepare("UPDATE sessions SET expires_at = ? WHERE id = ?")
    .bind(Math.round(now) + SESSION_LIFE_MS, await hashOf(token))
    .run();
}

/** Signs a device out. */
export async function endSession(db: D1, token: string): Promise<void> {
  await db
    .prepare("DELETE FROM sessions WHERE id = ?")
    .bind(await hashOf(token))
    .run();
}

// --- sign-in links ----------------------------------------------------------------------

/**
 * A new sign-in link for an address: returns its token. Rows older than a day are cleared
 * away as it goes.
 */
export async function createLink(
  db: D1,
  email: string,
  now: number,
): Promise<string> {
  const token = randomToken();
  const at = Math.round(now);
  await db.batch([
    db
      .prepare("DELETE FROM sign_in_links WHERE created_at < ?")
      .bind(at - LINK_KEPT_MS),
    db
      .prepare(
        `INSERT INTO sign_in_links (id, email, created_at, expires_at, used_at)
         VALUES (?, ?, ?, ?, NULL)`,
      )
      .bind(await hashOf(token), email, at, at + LINK_LIFE_MS),
  ]);
  return token;
}

/** How many links have been made since `since`: for one address, or for everyone. */
export async function linksSince(
  db: D1,
  since: number,
  email?: string,
): Promise<number> {
  const row =
    email === undefined
      ? await db
          .prepare(
            "SELECT COUNT(*) AS n FROM sign_in_links WHERE created_at > ?",
          )
          .bind(Math.round(since))
          .first<{ n: number }>()
      : await db
          .prepare(
            `SELECT COUNT(*) AS n FROM sign_in_links
             WHERE email = ? AND created_at > ?`,
          )
          .bind(email, Math.round(since))
          .first<{ n: number }>();
  return row?.n ?? 0;
}

/**
 * Uses a link: the address it was sent to, or null if it is not a link of ours, has run
 * out, or has been used. A link works once, however many requests carry it at once.
 */
export async function spendLink(
  db: D1,
  token: string,
  now: number,
): Promise<string | null> {
  const at = Math.round(now);
  const row = await db
    .prepare(
      `UPDATE sign_in_links SET used_at = ?
       WHERE id = ? AND used_at IS NULL AND expires_at > ?
       RETURNING email`,
    )
    .bind(at, await hashOf(token), at)
    .first<{ email: string }>();
  return row?.email ?? null;
}

/** Takes back a link that could not be sent. */
export async function dropLink(db: D1, token: string): Promise<void> {
  await db
    .prepare("DELETE FROM sign_in_links WHERE id = ?")
    .bind(await hashOf(token))
    .run();
}
