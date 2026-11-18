// @vitest-environment node
/**
 * HOME's and AWAY's shares moving with the day (./shares.ts, ~/game/day-shares) through the
 * game's own API (./play.ts), against a real SQLite in memory: what is counted, what is
 * not, and how every player is scored on the blend.
 */
import { afterEach, describe, expect, test } from "vitest";

import { AWAY_QUESTIONS, HOME_QUESTIONS, RETRO_QUESTIONS } from "~/data";
import { blendShares } from "~/game/day-shares";
import { EPOCH_UTC, MS_PER_DAY } from "~/game/day";
import type { GameSnapshot } from "~/game/served";
import type { Question } from "~/game/types";

import { handle } from "../app";
import { database } from "../db/migrate";
import type { Env } from "../env";
import { type MemoryD1, memoryD1 } from "../testing/d1";
import { type GameAnswer, games } from "./play";
import { COUNTS_KEPT_MS } from "./shares";

/** Noon on the game's eighth day. */
const NOON = EPOCH_UTC + 7 * MS_PER_DAY + MS_PER_DAY / 2;
const TODAY = 8;

const open: MemoryD1[] = [];
afterEach(() => {
  for (const db of open.splice(0)) db.close();
});

function world(): Env & { DB: MemoryD1 } {
  const DB = memoryD1();
  open.push(DB);
  return { DB, ASSETS: { fetch: async () => new Response("") } };
}

/**
 * One player: an account (by id) or, with null, a player with no account, who is made a
 * guest by their first game and kept by a cookie (or, where no player can be made, keeps a
 * ticket).
 */
class Player {
  ticket: string | null = null;
  cookie: string | null = null;
  constructor(
    readonly env: Env,
    readonly account: string | null = null,
    readonly counted = true,
  ) {}

  async call(
    mode: string,
    move: string,
    now: number,
    body: Record<string, unknown> = {},
  ): Promise<GameSnapshot | null> {
    const request = new Request(
      `https://soccersense.example/api/games/${mode}/${move}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(this.cookie && { cookie: this.cookie }),
        },
        body: JSON.stringify({
          ...(this.ticket && move !== "start" ? { ticket: this.ticket } : {}),
          ...body,
        }),
      },
    );
    const response =
      this.account === null
        ? await handle(request, this.env, now)
        : await games(
            request,
            this.env,
            now,
            `/games/${mode}/${move}`,
            this.account,
            this.counted,
          );
    const set = response.headers.getSetCookie()[0];
    if (set) this.cookie = set.split("; ")[0];
    const heard = (await response.json()) as GameAnswer;
    if (heard.ticket) this.ticket = heard.ticket;
    return heard.game;
  }

  start = (mode: string, now: number) => this.call(mode, "start", now);
  answer = (mode: string, now: number, index: number, input: string) =>
    this.call(mode, "answer", now, { day: TODAY, index, input });
  pass = (mode: string, now: number, index: number) =>
    this.call(mode, "pass", now, { day: TODAY, index });
}

type Tally = {
  day: number;
  mode: string;
  question_id: string;
  answer_id: string;
  players: number;
}[];

const tally = async (db: MemoryD1): Promise<Tally> =>
  (
    await db
      .prepare(
        "SELECT * FROM answer_tally ORDER BY mode, question_id, answer_id",
      )
      .all<Tally[number]>()
  ).results;

/** Adds counts for a question, as though that many more players had answered. */
async function counted(
  db: MemoryD1,
  mode: string,
  question: Question,
  counts: Record<string, number>,
) {
  await database(db, NOON);
  for (const [answerId, players] of Object.entries(counts)) {
    await db
      .prepare(
        `INSERT INTO answer_tally (day, mode, question_id, answer_id, players)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (day, mode, question_id, answer_id)
         DO UPDATE SET players = players + excluded.players`,
      )
      .bind(TODAY, mode, question.id, answerId, players)
      .run();
  }
}

const rarest = (q: Question) =>
  [...q.answers].sort((a, b) => a.popularity - b.popularity)[0];
const commonest = (q: Question) =>
  [...q.answers].sort((a, b) => b.popularity - a.popularity)[0];

describe("what is counted", () => {
  test("an account's accepted answer: once, for its day, mode, question and answer", async () => {
    const env = world();
    const fan = new Player(env, "account-1");
    const q = AWAY_QUESTIONS[0];
    await fan.start("away", NOON);
    const answer = rarest(q);
    await fan.answer("away", NOON + 1000, 0, answer.name);
    // the same answer sent again changes nothing
    await fan.answer("away", NOON + 1500, 0, answer.name);
    expect(await tally(env.DB)).toEqual([
      {
        day: TODAY,
        mode: "away",
        question_id: q.id,
        answer_id: answer.id,
        players: 1,
      },
    ]);
  });

  test("its aliases and spellings count as the one answer", async () => {
    const env = world();
    const q = HOME_QUESTIONS[0];
    const answer = q.answers.find((a) => a.aliases.length > 0);
    if (!answer) throw new Error("the sample has an answer with an alias");
    const one = new Player(env, "account-1");
    const two = new Player(env, "account-2");
    await one.start("home", NOON);
    await two.start("home", NOON);
    await one.answer("home", NOON + 1000, 0, answer.name);
    await two.answer("home", NOON + 1000, 0, answer.aliases[0]);
    expect(await tally(env.DB)).toEqual([
      expect.objectContaining({ answer_id: answer.id, players: 2 }),
    ]);
  });

  test("not a pass, a time-up, or an answer the judge does not know", async () => {
    const env = world();
    const fan = new Player(env, "account-1");
    await fan.start("home", NOON);
    await fan.answer("home", NOON + 1000, 0, "nobody anyone has heard of");
    await fan.pass("home", NOON + 9000, 0);
    await fan.call("home", "next", NOON + 10_000, { day: TODAY, index: 0 });
    // question 2 is left until its clock is long gone
    await fan.call("home", "look", NOON + 80_000);
    expect(await tally(env.DB)).toEqual([]);
  });

  test("a player with no account's too: their first game makes them a player the server keeps", async () => {
    const env = world();
    const guest = new Player(env);
    await guest.start("away", NOON);
    expect(guest.cookie).not.toBeNull();
    const answer = rarest(AWAY_QUESTIONS[0]);
    await guest.answer("away", NOON + 1000, 0, answer.name);
    await guest.answer("away", NOON + 1500, 0, answer.name);
    expect(await tally(env.DB)).toEqual([
      expect.objectContaining({ answer_id: answer.id, players: 1 }),
    ]);
  });

  test("not a game no player could be made for: a ticket can be sent again", async () => {
    const env = {
      ...world(),
      NEW_PLAYER_LIMIT: { limit: async () => ({ success: false }) },
    };
    const guest = new Player(env);
    await guest.start("away", NOON);
    expect(guest.cookie).toBeNull();
    const game = await guest.answer(
      "away",
      NOON + 1000,
      0,
      rarest(AWAY_QUESTIONS[0]).name,
    );
    expect(game?.turns).toHaveLength(1);
    expect(await tally(env.DB)).toEqual([]);
  });

  test("not an account taken off the leaderboards", async () => {
    const env = world();
    const off = new Player(env, "account-1", false);
    await off.start("home", NOON);
    const game = await off.answer(
      "home",
      NOON + 1000,
      0,
      commonest(HOME_QUESTIONS[0]).name,
    );
    expect(game?.turns).toHaveLength(1);
    expect(await tally(env.DB)).toEqual([]);
  });

  test("not RETRO or NEXT-GEN: years are facts", async () => {
    const env = world();
    const fan = new Player(env, "account-1");
    await fan.start("retro", NOON);
    await fan.answer(
      "retro",
      NOON + 1000,
      0,
      RETRO_QUESTIONS[0].answers[0].name,
    );
    expect(await tally(env.DB)).toEqual([]);
  });
});

describe("how everyone is scored", () => {
  test("on the natural shares while nothing has been counted", async () => {
    const env = world();
    const guest = new Player(env);
    const q = AWAY_QUESTIONS[0];
    const answer = rarest(q);
    await guest.start("away", NOON);
    const game = await guest.answer("away", NOON + 1000, 0, answer.name);
    expect(game?.turns[0]).toMatchObject({
      answerId: answer.id,
      share: answer.popularity,
      grade: answer.shot,
    });
  });

  test("on the blend once the day has answers, with or without an account", async () => {
    const env = world();
    const q = AWAY_QUESTIONS[0];
    const answer = rarest(q);
    // A rare answer most of the day's players gave: a leak.
    const counts = { [answer.id]: 900, [commonest(q).id]: 100 };
    await counted(env.DB, "away", q, counts);
    const expected = blendShares(q, new Map(Object.entries(counts)))[
      q.answers.indexOf(answer)
    ];
    expect(expected).toBeGreaterThan(answer.popularity + 10);

    for (const player of [new Player(env), new Player(env, "account-1")]) {
      await player.start("away", NOON);
      const game = await player.answer("away", NOON + 1000, 0, answer.name);
      const turn = game?.turns[0];
      expect(turn?.share).toBeCloseTo(expected, 2);
      // no longer AWAY's best shot
      expect(turn?.grade).not.toBe("worldie");
      // and the reveal shows the same table it was scored on
      expect(game?.reveal?.row?.share).toBe(turn?.share);
      expect(game?.reveal?.row?.shot).toBe(turn?.grade);
    }
  });

  test("on counts at most COUNTS_KEPT_MS old", async () => {
    const env = world();
    const q = HOME_QUESTIONS[0];
    const answer = rarest(q);
    const first = new Player(env);
    await first.start("home", NOON);
    await first.answer("home", NOON + 1000, 0, answer.name);
    // the day then gives that answer a lot
    await counted(env.DB, "home", q, { [answer.id]: 5000 });

    const soon = new Player(env);
    await soon.start("home", NOON + 2000);
    const early = await soon.answer("home", NOON + 3000, 0, answer.name);
    expect(early?.turns[0]?.share).toBe(answer.popularity);

    const later = new Player(env);
    const at = NOON + 1000 + COUNTS_KEPT_MS;
    await later.start("home", at);
    const moved = await later.answer("home", at + 1000, 0, answer.name);
    expect(moved?.turns[0]?.share).toBeGreaterThan(answer.popularity + 10);
  });

  test("a score is the player's as they answered: the day moving on does not change it", async () => {
    const env = world();
    const q = AWAY_QUESTIONS[0];
    const answer = rarest(q);
    const fan = new Player(env, "account-1");
    await fan.start("away", NOON);
    const scored = await fan.answer("away", NOON + 1000, 0, answer.name);
    await counted(env.DB, "away", q, { [commonest(q).id]: 10_000 });
    const later = await fan.call("away", "look", NOON + 1000 + COUNTS_KEPT_MS);
    expect(later?.turns[0]).toEqual(scored?.turns[0]);
    expect(later?.total).toBe(scored?.total);
  });
});
