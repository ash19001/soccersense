/**
 * Moderation: the admin's tools for players with accounts (the product owner, 2026-11-18:
 * "build the admin action to remove players for moderation"). Behind the admin token, like
 * the approval desk (../questions/admin.ts):
 *
 *   GET  /api/admin/players?q=<text>   accounts whose name or email address has it in
 *                                      (the newest 25 with nothing given)
 *   POST /api/admin/players/<id>       { action, note? }:
 *        rename   a new soccerfan name in place of theirs (for a name that breaks the terms)
 *        ban      off the leaderboards, with a note of why. They still play, keep their
 *                 games, streak and stats; their games are on no board and in none of its
 *                 counts, their answers are not counted for the day's shares, and they are
 *                 told where they would have placed, as a player with no account is
 *        unban    back on the leaderboards, with every game they have played
 *        delete   the account and everything kept for it, as the player can do themselves
 *
 * The terms say so: "We may change a name that breaks this, or close the account", and
 * "We may remove scores or accounts that do" (app/i18n/en.ts, `terms`).
 */

import { fanNickname, nicknameKey } from "~/game/nickname";

import type { D1 } from "../env";
import { failure, json, wrongMethod } from "../http";
import { accountById, deleteAccount, nextFanNumber, rename } from "./store";

/** The most accounts one search lists. */
export const MAX_FOUND = 25;
/** The longest search, and the longest note kept with a ban. */
export const MAX_QUERY = 200;
export const MAX_NOTE = 500;

/** An account as the admin sees it. */
export interface PlayerView {
  id: string;
  nickname: string;
  /** Null for a player with no account (a guest). */
  email: string | null;
  createdAt: number;
  /** When it was taken off the leaderboards, or null. */
  bannedAt: number | null;
  /** The admin's note of why. */
  note: string;
  /** Its games whose last question has been decided. */
  games: number;
  /** The last day it played, or null. */
  lastDay: number | null;
}

export const PLAYER_ACTIONS = ["rename", "ban", "unban", "delete"] as const;
export type PlayerAction = (typeof PLAYER_ACTIONS)[number];

interface Found {
  id: string;
  nickname: string;
  email: string | null;
  created_at: number;
  banned_at: number | null;
  banned_note: string | null;
  games: number;
  last_day: number | null;
}

const VIEW = `SELECT a.id, a.nickname, a.email, a.created_at, a.banned_at, a.banned_note,
    (SELECT COUNT(*) FROM games g
     WHERE g.player_id = a.id AND g.finished_at IS NOT NULL) AS games,
    (SELECT MAX(g.day) FROM games g WHERE g.player_id = a.id) AS last_day
  FROM accounts a`;

const toView = (row: Found): PlayerView => ({
  id: row.id,
  nickname: row.nickname,
  email: row.email,
  createdAt: row.created_at,
  bannedAt: row.banned_at,
  note: row.banned_note ?? "",
  games: row.games,
  lastDay: row.last_day,
});

/** `%` and `_` stand for themselves in a search. */
const likeOf = (text: string) => `%${text.replace(/[\\%_]/g, "\\$&")}%`;

/**
 * Accounts whose name or email address has `query` in it, without regard to capitals, by
 * name; an account's id finds it too. With nothing given, the newest accounts.
 */
export async function findPlayers(
  db: D1,
  query: string,
): Promise<PlayerView[]> {
  const text = nicknameKey(query.slice(0, MAX_QUERY));
  const { results } =
    text === ""
      ? await db
          .prepare(`${VIEW} ORDER BY a.created_at DESC LIMIT ?`)
          .bind(MAX_FOUND)
          .all<Found>()
      : await db
          .prepare(
            `${VIEW}
             WHERE a.nickname_key LIKE ?1 ESCAPE '\\' OR lower(a.email) LIKE ?1 ESCAPE '\\'
               OR a.id = ?2
             ORDER BY a.nickname_key LIMIT ?3`,
          )
          .bind(likeOf(text), text, MAX_FOUND)
          .all<Found>();
  return results.map(toView);
}

/** One account as the admin sees it, or null. */
export async function playerById(
  db: D1,
  id: string,
): Promise<PlayerView | null> {
  const row = await db
    .prepare(`${VIEW} WHERE a.id = ?`)
    .bind(id)
    .first<Found>();
  return row ? toView(row) : null;
}

/**
 * Takes an account off the leaderboards: its games come off the boards' counts, and it is
 * marked, in one transaction. One already off is left as it is (its note too).
 */
export async function banPlayer(
  db: D1,
  id: string,
  note: string,
  now: number,
): Promise<void> {
  await db.batch([
    // Only while it is still on: once marked, its games are already off the counts.
    db
      .prepare(
        `UPDATE board_tally SET players = players - 1
         WHERE (SELECT banned_at FROM accounts WHERE id = ?) IS NULL
           AND (day, mode, total) IN (
             SELECT day, mode, total FROM games
             WHERE player_id = ? AND origin = 'server' AND finished_at IS NOT NULL
           )`,
      )
      .bind(id, id),
    db.prepare("DELETE FROM board_tally WHERE players <= 0"),
    db
      .prepare(
        `UPDATE accounts SET banned_at = ?, banned_note = ?, updated_at = ?
         WHERE id = ? AND banned_at IS NULL`,
      )
      .bind(Math.round(now), note.slice(0, MAX_NOTE), Math.round(now), id),
  ]);
}

/**
 * Puts an account back on the leaderboards: every game it has played through the server
 * goes back on the boards' counts (those it finished while off as well), in one
 * transaction. One that is on is left as it is.
 */
export async function unbanPlayer(
  db: D1,
  id: string,
  now: number,
): Promise<void> {
  await db.batch([
    db
      .prepare(
        `INSERT INTO board_tally (day, mode, total, players)
         SELECT day, mode, total, 1 FROM games
         WHERE player_id = ? AND origin = 'server' AND finished_at IS NOT NULL
           AND (SELECT banned_at FROM accounts WHERE id = ?) IS NOT NULL
         ON CONFLICT (day, mode, total) DO UPDATE SET players = players + 1`,
      )
      .bind(id, id),
    db
      .prepare(
        `UPDATE accounts SET banned_at = NULL, banned_note = NULL, updated_at = ?
         WHERE id = ? AND banned_at IS NOT NULL`,
      )
      .bind(Math.round(now), id),
  ]);
}

/** Gives an account a new soccerfan name in place of its own. */
export async function renamePlayer(
  db: D1,
  id: string,
  now: number,
): Promise<void> {
  // A soccerfan name is never taken (nobody can choose one), but a few tries cost nothing.
  for (let tries = 0; tries < 5; tries++) {
    if (await rename(db, id, fanNickname(await nextFanNumber(db)), now)) {
      return;
    }
  }
  throw new Error("no new name could be given");
}

async function bodyOf(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (text.length > 10_000) return {};
  try {
    const bag = JSON.parse(text) as unknown;
    return typeof bag === "object" && bag !== null && !Array.isArray(bag)
      ? (bag as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/**
 * Answers `/api/admin/players`. The caller has checked the admin token and brought the
 * database up to date.
 */
export async function players(
  request: Request,
  db: D1,
  now: number,
  route: string,
): Promise<Response> {
  if (route === "/admin/players") {
    const wrong = wrongMethod(request, ["GET"], now);
    if (wrong) return wrong;
    const query = new URL(request.url).searchParams.get("q") ?? "";
    return json({ players: await findPlayers(db, query) }, now);
  }

  const one = /^\/admin\/players\/([0-9a-f-]{1,64})$/.exec(route);
  if (!one) return failure("not_found", 404, now);
  const wrong = wrongMethod(request, ["POST"], now);
  if (wrong) return wrong;
  const id = one[1];
  const sent = await bodyOf(request);
  const action = PLAYER_ACTIONS.find((a) => a === sent.action);
  if (!action) return failure("bad_action", 400, now);
  const account = await accountById(db, id);
  if (!account) return failure("not_found", 404, now);

  switch (action) {
    case "rename":
      await renamePlayer(db, id, now);
      break;
    case "ban":
      await banPlayer(
        db,
        id,
        typeof sent.note === "string" ? sent.note.trim() : "",
        now,
      );
      break;
    case "unban":
      await unbanPlayer(db, id, now);
      break;
    case "delete":
      await deleteAccount(db, account);
      return json({ player: null }, now);
  }
  return json({ player: await playerById(db, id) }, now);
}
