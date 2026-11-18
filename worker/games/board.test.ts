// @vitest-environment node
/**
 * The day's leaderboards (worker/games/board.ts), against a real SQLite in memory: games
 * played through the server by accounts, a player with no account, and games a device sent
 * up, then the boards as `GET /api/leaderboard` gives them.
 */
import { afterEach, describe, expect, test } from "vitest";

import { AWAY_QUESTIONS, HOME_QUESTIONS } from "~/data";
import { type BoardAnswer, rankFor } from "~/game/board";
import { EPOCH_UTC, MS_PER_DAY } from "~/game/day";
import { PASS_AFTER_MS } from "~/game/session";
import type { Mode, Question } from "~/game/types";

import { createAccount, deleteAccount } from "../accounts/store";
import { handle } from "../app";
import { MIGRATIONS, migrate } from "../db/migrate";
import type { Env } from "../env";
import { type MemoryD1, memoryD1 } from "../testing/d1";
import { leaderboard } from "./board";
import { games } from "./play";
import { importGames } from "./store";

/** Noon on the game's eighth day: 2026-11-17. */
const NOON = EPOCH_UTC + 7 * MS_PER_DAY + MS_PER_DAY / 2;
const TODAY = 8;

const open: MemoryD1[] = [];
afterEach(() => {
  for (const db of open.splice(0)) db.close();
});

function world(): Env & { DB: MemoryD1 } {
  const DB = memoryD1();
  open.push(DB);
  return { DB, ASSETS: { fetch: async () => new Response("the site") } };
}

const QUESTIONS: Record<string, readonly Question[]> = {
  home: HOME_QUESTIONS,
  away: AWAY_QUESTIONS,
};

const best = (q: Question) =>
  q.answers.find((a) => a.shot === "worldie")?.name ?? q.answers[0].name;

/**
 * Plays a whole game through the server: a hit (100 points) on each question in `hits`, a
 * PASS on the rest. Returns when the game was decided.
 */
async function play(
  env: Env,
  account: string | null,
  hits: number,
  start: number,
  mode: "home" | "away" = "home",
  ticket: { value: string | null } = { value: null },
): Promise<number> {
  const call = async (move: string, now: number, body: object = {}) => {
    const request = new Request(
      `https://soccersense.example/api/games/${mode}/${move}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...(ticket.value && { ticket: ticket.value }),
          ...body,
        }),
      },
    );
    const response =
      account === null
        ? await handle(request, env, now)
        : await games(request, env, now, `/games/${mode}/${move}`, account);
    const said = (await response.json()) as { ticket: string | null };
    if (typeof said.ticket === "string") ticket.value = said.ticket;
  };
  let now = start;
  await call("start", now);
  for (let index = 0; index < 7; index++) {
    if (index < hits) {
      now += 1000;
      await call("answer", now, {
        day: TODAY,
        index,
        input: best(QUESTIONS[mode][index]),
      });
    } else {
      now += PASS_AFTER_MS + 500;
      await call("pass", now, { day: TODAY, index });
    }
    now += 500;
    if (index < 6) await call("next", now, { day: TODAY, index });
  }
  return now;
}

async function boards(
  env: Env,
  account: string | null = null,
  query = "",
): Promise<BoardAnswer> {
  const response = await leaderboard(
    new Request(`https://soccersense.example/api/leaderboard${query}`),
    env,
    NOON + MS_PER_DAY / 4,
    account,
  );
  expect(response.status).toBe(200);
  return (await response.json()) as BoardAnswer;
}

async function accounts(env: Env & { DB: MemoryD1 }, n: number) {
  await migrate(env.DB, NOON);
  const made = [];
  for (let i = 0; i < n; i++) {
    made.push(
      await createAccount(
        env.DB,
        { email: `fan${i}@example.com`, googleId: null },
        NOON,
      ),
    );
  }
  return made;
}

const tally = async (db: MemoryD1) =>
  (
    await db
      .prepare(
        "SELECT day, mode, total, players FROM board_tally ORDER BY mode, total DESC",
      )
      .all()
  ).results;

describe("a day's boards", () => {
  test("nobody yet: every mode empty", async () => {
    const env = world();
    const answer = await boards(env);
    expect(answer.day).toBe(TODAY);
    for (const mode of ["home", "away", "retro", "nextgen"] as Mode[]) {
      expect(answer.modes[mode]).toEqual({
        count: 0,
        top: [],
        tally: [],
        you: null,
      });
    }
  });

  test("best first; equal totals share a place, the one who finished first listed first", async () => {
    const env = world();
    const [a, b, c, d] = await accounts(env, 4);
    await play(env, a.id, 5, NOON); // 500, finished first of the two 500s
    await play(env, b.id, 7, NOON + 60_000); // 700
    await play(env, c.id, 5, NOON + 120_000); // 500, finished later
    await play(env, d.id, 3, NOON + 180_000); // 300
    const { home, away } = (await boards(env)).modes;
    expect(home.count).toBe(4);
    expect(home.top).toEqual([
      { rank: 1, name: b.nickname, points: 700 },
      { rank: 2, name: a.nickname, points: 500 },
      { rank: 2, name: c.nickname, points: 500 },
      { rank: 4, name: d.nickname, points: 300 },
    ]);
    expect(home.tally).toEqual([
      [700, 1],
      [500, 2],
      [300, 1],
    ]);
    expect(home.you).toBeNull();
    // another mode is its own board
    expect(away.count).toBe(0);
  });

  test("a signed-in player is told their own place, and their row is marked", async () => {
    const env = world();
    const [a, b] = await accounts(env, 2);
    await play(env, a.id, 6, NOON);
    await play(env, b.id, 2, NOON + 60_000);
    const { home } = (await boards(env, b.id)).modes;
    expect(home.you).toEqual({ rank: 2, points: 200 });
    expect(home.top[1]).toEqual({
      rank: 2,
      name: b.nickname,
      points: 200,
      you: true,
    });
    expect(home.top[0].you).toBeUndefined();
    // someone who has not played this mode
    expect((await boards(env, b.id)).modes.away.you).toBeNull();
  });

  test("the top ten only, and a place for everyone from the counts", async () => {
    const env = world();
    const made = await accounts(env, 12);
    for (const [i, account] of made.entries()) {
      // 7, 7, 6, 6, 5, 5, ... hits: totals 700 down to 200
      await play(env, account.id, 7 - Math.floor(i / 2), NOON + i * 60_000);
    }
    const { home } = (await boards(env, made[11].id)).modes;
    expect(home.count).toBe(12);
    expect(home.top).toHaveLength(10);
    expect(home.top.map((row) => row.rank)).toEqual([
      1, 1, 3, 3, 5, 5, 7, 7, 9, 9,
    ]);
    // the last two are not listed, but know their place
    expect(home.you).toEqual({ rank: 11, points: 200 });
    // and a player with no account who scored 450 would have been 7th
    expect(rankFor(home.tally, 450)).toBe(7);
  });

  test("a player with no account is on no board, and nothing about them is kept", async () => {
    const env = world();
    const [a] = await accounts(env, 1);
    await play(env, a.id, 4, NOON);
    await play(env, null, 7, NOON + 60_000);
    const { home } = (await boards(env)).modes;
    expect(home.count).toBe(1);
    expect(home.top.map((row) => row.points)).toEqual([400]);
    // where they would have placed: first, worked out on their own page
    expect(rankFor(home.tally, 700)).toBe(1);
  });

  test("a game a device sent up counts for its streak, never on a board", async () => {
    const env = world();
    const [a, b] = await accounts(env, 2);
    const turns = Array.from({ length: 7 }, (_, i) => ({
      questionId: `q${i}`,
      input: "x",
      answerId: "a",
      grade: "worldie" as const,
      points: 100,
      km: null,
      share: null,
      rank: 1,
      msLeft: 1000,
    }));
    await importGames(
      env.DB,
      a.id,
      [{ day: TODAY, mode: "home", total: 700, turns, prompts: null }],
      NOON,
    );
    await play(env, b.id, 1, NOON);
    const { home } = (await boards(env, a.id)).modes;
    expect(home.count).toBe(1);
    expect(home.top).toEqual([{ rank: 1, name: b.nickname, points: 100 }]);
    expect(home.you).toBeNull();
  });

  test("a game is counted once, however many times its last move is sent", async () => {
    const env = world();
    const [a] = await accounts(env, 1);
    const end = await play(env, a.id, 7, NOON);
    // the last answer sent again, and the full-time card's move twice
    for (const move of ["answer", "next", "next"]) {
      await games(
        new Request(`https://soccersense.example/api/games/home/${move}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            day: TODAY,
            index: 6,
            input: best(HOME_QUESTIONS[6]),
          }),
        }),
        env,
        end + 1000,
        `/games/home/${move}`,
        a.id,
      );
    }
    expect(await tally(env.DB)).toEqual([
      { day: TODAY, mode: "home", total: 700, players: 1 },
    ]);
  });

  test("a last question left to run out is counted when the clock decides it", async () => {
    const env = world();
    const [a] = await accounts(env, 1);
    let now = NOON;
    const call = (move: string, at: number, body: object = {}) =>
      games(
        new Request(`https://soccersense.example/api/games/home/${move}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
        env,
        at,
        `/games/home/${move}`,
        a.id,
      );
    await call("start", now);
    for (let index = 0; index < 6; index++) {
      now += 1000;
      await call("answer", now, {
        day: TODAY,
        index,
        input: best(HOME_QUESTIONS[index]),
      });
      now += 500;
      await call("next", now, { day: TODAY, index });
    }
    // question 7 is never answered: a look long after times it out
    await call("look", now + 120_000);
    await call("look", now + 130_000);
    expect(await tally(env.DB)).toEqual([
      { day: TODAY, mode: "home", total: 600, players: 1 },
    ]);
  });

  test("an account deleted comes off the board", async () => {
    const env = world();
    const [a, b] = await accounts(env, 2);
    await play(env, a.id, 5, NOON);
    await play(env, b.id, 5, NOON + 60_000);
    await play(env, b.id, 2, NOON + 120_000, "away");
    await deleteAccount(env.DB, b);
    const { home, away } = (await boards(env)).modes;
    expect(home.count).toBe(1);
    expect(home.top).toEqual([{ rank: 1, name: a.nickname, points: 500 }]);
    expect(away).toEqual({ count: 0, top: [], tally: [], you: null });
    expect(await tally(env.DB)).toEqual([
      { day: TODAY, mode: "home", total: 500, players: 1 },
    ]);
  });

  test("a changed name shows at once", async () => {
    const env = world();
    const [a] = await accounts(env, 1);
    await play(env, a.id, 3, NOON);
    await env.DB.prepare(
      "UPDATE accounts SET nickname = 'Nutmeg Nina' WHERE id = ?",
    )
      .bind(a.id)
      .run();
    expect((await boards(env)).modes.home.top[0].name).toBe("Nutmeg Nina");
  });

  test("a past day can be asked for; a day to come, or nonsense, cannot", async () => {
    const env = world();
    expect((await boards(env, null, "?day=3")).day).toBe(3);
    for (const query of ["?day=9", "?day=0", "?day=x", "?day=2.5"]) {
      const response = await leaderboard(
        new Request(`https://soccersense.example/api/leaderboard${query}`),
        env,
        NOON,
        null,
      );
      expect([query, response.status]).toEqual([query, 400]);
    }
    const posted = await leaderboard(
      new Request("https://soccersense.example/api/leaderboard", {
        method: "POST",
      }),
      env,
      NOON,
      null,
    );
    expect(posted.status).toBe(405);
  });

  test("through the Worker: anyone may read it, and it is never cached", async () => {
    const env = world();
    const response = await handle(
      new Request("https://soccersense.example/api/leaderboard"),
      env,
      NOON,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  test("a whole day's boards are one round trip of six reads at most", async () => {
    const env = world();
    const [a] = await accounts(env, 1);
    await play(env, a.id, 3, NOON);
    const before = env.DB.log.length;
    await boards(env, a.id);
    const reads = env.DB.log
      .slice(before)
      .filter((sql) => /^\s*select/i.test(sql));
    expect(reads.length).toBeLessThanOrEqual(6);
  });
});

test("migration 5 counts the games decided before it", async () => {
  const DB = memoryD1();
  open.push(DB);
  await migrate(
    DB,
    NOON,
    MIGRATIONS.filter((m) => m.id <= 4),
  );
  const env: Env & { DB: MemoryD1 } = {
    DB,
    ASSETS: { fetch: async () => new Response("") },
  };
  const a = await createAccount(
    env.DB,
    { email: "fan@example.com", googleId: null },
    NOON,
  );
  // a game kept before the boards' counts existed
  await DB.prepare(
    `INSERT INTO games (player_id, day, mode, source, idx, phase, turns, total, started_at,
       deadline, created_at, updated_at, finished_at, origin)
     VALUES (?, ?, 'home', 'sample', 6, 'done', '[]', 600, ?, NULL, ?, ?, ?, 'server')`,
  )
    .bind(a.id, TODAY, NOON, NOON, NOON, NOON)
    .run();
  expect(await migrate(DB, NOON)).toBeGreaterThanOrEqual(5);
  expect(await tally(DB)).toEqual([
    { day: TODAY, mode: "home", total: 600, players: 1 },
  ]);
});
