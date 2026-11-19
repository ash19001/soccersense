/**
 * The day's leaderboards: `GET /api/leaderboard?day=<n>` (today when left out).
 *
 * Every player the server keeps is on them, with an account or not (a guest, since
 * 2026-11-18), with a game played through the server (`origin = 'server'`): a game a device
 * sent up after signing in counts for the account's streak and stats, never here; a game
 * kept on the device alone (a ticket) is on no board, and its player is told where they
 * would have placed by their own page, from the counts this sends (`rankFor`,
 * ~/game/board). Each player has one game a day and mode, so the first is the one that
 * counts. An account the
 * admin took off the leaderboards (../accounts/moderation.ts) is on none, and is not in the
 * counts.
 *
 * For each mode: the top ten (best first; equal totals share a place, the one who finished
 * first listed first), how many accounts finished on each total (`board_tally`, one more as
 * each game is decided: worker/games/store.ts), and, for a signed-in player on the board,
 * their own place. A whole day's boards are a read per mode and two more at most, in one round trip, however
 * many have played: the counts are at most 71 rows a mode, and the top ten come from an
 * index (migration 5).
 */

import {
  BOARD_TOP,
  type BoardAnswer,
  type BoardEntry,
  type ModeBoard,
  type TallyEntry,
  emptyBoard,
  rankFor,
} from "~/game/board";
import { dayNumber } from "~/game/day";
import { MODES } from "~/game/storage";
import type { Mode } from "~/game/types";

import { database } from "../db/migrate";
import type { Env } from "../env";
import { failure, json, wrongMethod } from "../http";

const READ: readonly string[] = ["GET", "HEAD"];

/** Answers `/api/leaderboard`. `account`: the signed-in player's account id, or null. */
export async function leaderboard(
  request: Request,
  env: Env,
  now: number,
  account: string | null,
): Promise<Response> {
  const refused = wrongMethod(request, READ, now);
  if (refused) return refused;
  if (!env.DB) return failure("no_database", 503, now);
  const today = dayNumber(new Date(now));
  const asked = new URL(request.url).searchParams.get("day");
  const day = asked === null ? today : Number(asked);
  // A day that has been, or today: never one to come.
  if (!Number.isInteger(day) || day < 1 || day > today) {
    return failure("bad_request", 400, now);
  }
  const db = env.DB;
  await database(db, now);

  const statements = [
    db
      .prepare(
        `SELECT mode, total, players FROM board_tally
         WHERE day = ? AND players > 0 ORDER BY mode, total DESC`,
      )
      .bind(day),
    ...MODES.map((mode) =>
      db
        .prepare(
          `SELECT a.nickname AS name, g.total AS points, g.player_id = ? AS you
           FROM games g JOIN accounts a ON a.id = g.player_id
           WHERE g.day = ? AND g.mode = ? AND g.origin = 'server'
             AND g.finished_at IS NOT NULL AND a.banned_at IS NULL
           ORDER BY g.total DESC, g.finished_at ASC
           LIMIT ?`,
        )
        .bind(account ?? "", day, mode, BOARD_TOP),
    ),
    ...(account === null
      ? []
      : [
          db
            .prepare(
              `SELECT mode, total FROM games
               WHERE player_id = ? AND day = ? AND origin = 'server'
                 AND finished_at IS NOT NULL`,
            )
            .bind(account, day),
        ]),
  ];
  const [tallyRows, ...rest] = await db.batch(statements);
  const tops = rest.slice(0, MODES.length);
  const mine = rest[MODES.length]?.results ?? [];

  const tallies = new Map<Mode, TallyEntry[]>();
  for (const row of tallyRows.results as {
    mode: Mode;
    total: number;
    players: number;
  }[]) {
    const list = tallies.get(row.mode) ?? [];
    list.push([row.total, row.players]);
    tallies.set(row.mode, list);
  }
  const yours = new Map<Mode, number>();
  for (const row of mine as { mode: Mode; total: number }[]) {
    yours.set(row.mode, row.total);
  }

  const modes = {} as Record<Mode, ModeBoard>;
  MODES.forEach((mode, i) => {
    const tally = tallies.get(mode) ?? [];
    if (tally.length === 0) {
      modes[mode] = emptyBoard();
      return;
    }
    const top: BoardEntry[] = (
      tops[i].results as { name: string; points: number; you: number }[]
    ).map((row) => ({
      rank: rankFor(tally, row.points),
      name: row.name,
      points: row.points,
      ...(row.you ? { you: true } : {}),
    }));
    const points = yours.get(mode);
    modes[mode] = {
      count: tally.reduce((sum, [, players]) => sum + players, 0),
      top,
      tally,
      you:
        points === undefined ? null : { rank: rankFor(tally, points), points },
    };
  });

  const body: BoardAnswer = { day, modes };
  return json(body, now, { head: request.method === "HEAD" });
}
