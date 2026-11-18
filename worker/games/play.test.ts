// @vitest-environment node
/**
 * The games the server runs (worker/games/play.ts), against a real SQLite in memory. Each
 * `Browser` here is one player, of one of two kinds:
 *
 * - with no account: through the Worker's own `handle`, as the page does. Their first game
 *   makes them a guest, kept by the server (worker/accounts/api.ts) with a cookie, which
 *   the browser keeps and sends back. Where no player can be made (the new-player limit
 *   refuses: `NO_NEW_PLAYERS`), the game is a ticket they keep themselves, and the browser
 *   keeps that and sends it back.
 * - with an account: the game is kept in the database. Signing in is tested with the
 *   accounts themselves (../accounts/api.test.ts), so these go straight to `games` with
 *   an account's id, as the Worker does for whoever is signed in.
 */
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { AWAY_QUESTIONS, HOME_QUESTIONS } from "~/data";
import { EPOCH_UTC, MS_PER_DAY } from "~/game/day";
import { type GameSnapshot, isGameSnapshot } from "~/game/served";
import { PASS_AFTER_MS, QUESTION_MS } from "~/game/session";
import type { Question } from "~/game/types";

import { handle } from "../app";
import { database } from "../db/migrate";
import type { Env } from "../env";
import { saveDraft, setStatus } from "../questions/store";
import { type MemoryD1, memoryD1 } from "../testing/d1";
import {
  GRACE_MS,
  type GameAnswer,
  MAX_BODY,
  MAX_INPUT,
  PASS_SLACK_MS,
  games,
} from "./play";
import { QUESTIONS_KEPT_MS } from "./questions";
import { MAX_TICKET } from "./ticket";

/** Noon on the game's eighth day: 2026-11-17. */
const NOON = EPOCH_UTC + 7 * MS_PER_DAY + MS_PER_DAY / 2;
const TODAY = 8;

const open: MemoryD1[] = [];
afterEach(() => {
  for (const db of open.splice(0)) db.close();
});

/** Settings every world starts with in a test (see `NO_NEW_PLAYERS`). */
let defaults: Omit<Partial<Env>, "DB"> = {};
afterEach(() => {
  defaults = {};
});

/** A new-player limit that turns every new player away: games are tickets again. */
const NO_NEW_PLAYERS: Omit<Partial<Env>, "DB"> = {
  NEW_PLAYER_LIMIT: { limit: async () => ({ success: false }) },
};

function world(over: Omit<Partial<Env>, "DB"> = {}): Env & { DB: MemoryD1 } {
  const DB = memoryD1();
  open.push(DB);
  return {
    DB,
    ASSETS: { fetch: async () => new Response("the built site") },
    ...defaults,
    ...over,
  };
}

interface Heard {
  status: number;
  game: GameSnapshot | null;
  ticket: string | null;
  /** The answer's text, to look for what must not be in it. */
  text: string;
  response: Response;
}

/** One player. With no account, the ticket of each mode's game is kept and sent back. */
class Browser {
  readonly tickets = new Map<string, string>();
  /** The cookies the server has set: a guest's, once their first game has made one. */
  readonly cookies = new Map<string, string>();
  constructor(
    readonly env: Env,
    readonly account: string | null = null,
  ) {}

  async call(
    move: string,
    now: number,
    body: unknown = {},
    mode = "home",
    method = "POST",
  ): Promise<Heard> {
    const ticket = this.tickets.get(mode);
    const sent =
      typeof body === "string"
        ? body
        : JSON.stringify({ ...(ticket && { ticket }), ...(body as object) });
    const headers: Record<string, string> = {};
    if (method === "POST") headers["content-type"] = "application/json";
    if (this.cookies.size > 0) {
      headers.cookie = [...this.cookies]
        .map(([name, value]) => `${name}=${value}`)
        .join("; ");
    }
    const request = new Request(
      `https://soccersense.example/api/games/${mode}/${move}`,
      {
        method,
        headers,
        ...(method === "POST" && { body: sent }),
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
          );
    for (const line of response.headers.getSetCookie()) {
      const [pair] = line.split("; ");
      const at = pair.indexOf("=");
      this.cookies.set(pair.slice(0, at), pair.slice(at + 1));
    }
    const text = await response.text();
    let heard: Partial<GameAnswer>;
    try {
      heard = JSON.parse(text) as Partial<GameAnswer>;
    } catch {
      heard = {};
    }
    if (typeof heard.ticket === "string") this.tickets.set(mode, heard.ticket);
    return {
      status: response.status,
      game: heard.game ?? null,
      ticket: heard.ticket ?? null,
      text,
      response,
    };
  }

  /** A new game: the page sends no ticket with it. */
  start = (now: number, mode = "home") => {
    this.tickets.delete(mode);
    return this.call("start", now, {}, mode);
  };
  look = (now: number, mode = "home") => this.call("look", now, {}, mode);
  answer = (
    now: number,
    index: number,
    input: string,
    extra: Record<string, unknown> = {},
  ) => this.call("answer", now, { day: TODAY, index, input, ...extra });
  pass = (now: number, index: number) =>
    this.call("pass", now, { day: TODAY, index });
  next = (now: number, index: number, day = TODAY) =>
    this.call("next", now, { day, index });
}

/** The name of a question's best answer. */
const best = (q: Question) =>
  q.answers.find((a) => a.shot === "worldie")?.name ?? q.answers[0].name;

const rows = async <T>(db: MemoryD1, sql: string) =>
  (await db.prepare(sql).all<T>()).results;

const PLAYERS: [string, string | null, Omit<Partial<Env>, "DB">][] = [
  ["a player with no account (a guest, kept by the server)", null, {}],
  [
    "a player with no account who could not be made one (their game a ticket)",
    null,
    NO_NEW_PLAYERS,
  ],
  ["an account", "account-1", {}],
];

describe.each(PLAYERS)("%s", (name, account, settings) => {
  beforeEach(() => {
    defaults = settings;
  });
  const player = (env: Env) => new Browser(env, account);
  /** Whose game is a ticket: kept on their own device, not by the server. */
  const ticketed = name.includes("ticket");

  describe("starting a game", () => {
    test("start sends question 1 as its clock starts, and nothing else of the game", async () => {
      const heard = await player(world()).start(NOON);
      expect(heard.status).toBe(200);
      expect(isGameSnapshot(heard.game)).toBe(true);
      expect(heard.game).toMatchObject({
        day: TODAY,
        mode: "home",
        count: 7,
        index: 0,
        phase: "asking",
        turns: [],
        total: 0,
        startedAt: NOON,
        deadline: NOON + QUESTION_MS,
        reveal: null,
        rejected: null,
      });
      expect(heard.game?.questions).toEqual([
        {
          id: HOME_QUESTIONS[0].id,
          prompt: HOME_QUESTIONS[0].prompt,
          measure: HOME_QUESTIONS[0].measure,
          measureLabel: HOME_QUESTIONS[0].measureLabel,
        },
      ]);
      // not one answer, and not the next question
      for (const answer of HOME_QUESTIONS[0].answers) {
        expect(heard.text, answer.name).not.toContain(`"${answer.name}"`);
      }
      expect(heard.text).not.toContain(HOME_QUESTIONS[1].prompt);
      expect(heard.response.headers.get("cache-control")).toBe("no-store");
      // a player with no account is given one with their first game, where one can be
      // made; an account has its own already
      expect(heard.response.headers.get("set-cookie") !== null).toBe(
        account === null && !ticketed,
      );
      expect(heard.ticket !== null).toBe(ticketed);
    });

    test("another mode is another game", async () => {
      const me = player(world());
      await me.start(NOON);
      const away = await me.start(NOON + 7000, "away");
      expect(away.game).toMatchObject({ mode: "away", startedAt: NOON + 7000 });
      expect((await me.look(NOON + 8000)).game).toMatchObject({
        mode: "home",
        startedAt: NOON,
      });
    });
  });

  describe("a whole game", () => {
    test("seven questions, each sent as its clock starts, each judged and revealed by the server", async () => {
      const me = player(world());
      let now = NOON;
      await me.start(now);
      let total = 0;
      for (let i = 0; i < 7; i++) {
        const question = HOME_QUESTIONS[i];
        now += 4000;
        const decided = await me.answer(now, i, best(question));
        expect(decided.status).toBe(200);
        expect(isGameSnapshot(decided.game)).toBe(true);
        expect(decided.game).toMatchObject({ index: i, phase: "reveal" });
        expect(decided.game?.turns[i]).toMatchObject({
          questionId: question.id,
          grade: "worldie",
          points: 100,
          name: best(question),
          msLeft: QUESTION_MS - 4000,
        });
        total += 100;
        expect(decided.game?.total).toBe(total);
        // the reveal: the five shots' rows, the player's among them
        const reveal = decided.game?.reveal;
        expect(reveal?.rows.map((row) => row.shot)).toEqual([
          "worldie",
          "golazo",
          "trivela",
          "toepoke",
          "tapin",
        ]);
        // a question can have several worldies: the row shows the player's own
        expect(reveal?.rows[0]).toMatchObject({
          isPlayer: true,
          answer: { name: best(question) },
        });
        expect(reveal?.best?.rank).toBe(1);
        expect(reveal?.tableSize).toBe(question.answers.length);
        // never the next question before its clock starts
        if (i < 6) {
          expect(decided.text).not.toContain(HOME_QUESTIONS[i + 1].prompt);
        }

        now += 3000;
        const on = await me.next(now, i);
        if (i < 6) {
          expect(on.game).toMatchObject({
            index: i + 1,
            phase: "asking",
            startedAt: now,
            deadline: now + QUESTION_MS,
            reveal: null,
          });
          expect(on.game?.questions.at(-1)?.prompt).toBe(
            HOME_QUESTIONS[i + 1].prompt,
          );
        } else {
          expect(on.game).toMatchObject({
            index: 6,
            phase: "done",
            total: 700,
          });
          expect(on.game?.questions).toHaveLength(7);
          expect(on.game?.turns).toHaveLength(7);
        }
      }
      expect((await me.look(now + 1000)).game).toMatchObject({
        phase: "done",
        total: 700,
      });
    });

    test("an answer the judge does not know: the clock runs on and nothing is kept", async () => {
      const env = world();
      const me = player(env);
      await me.start(NOON);
      const before = env.DB.log.length;
      const heard = await me.answer(NOON + 3000, 0, "Qwertyuiop");
      expect(heard.game).toMatchObject({
        phase: "asking",
        index: 0,
        turns: [],
        deadline: NOON + QUESTION_MS,
        rejected: { input: "Qwertyuiop", reason: "unknown" },
      });
      expect(env.DB.log.slice(before).some((sql) => /UPDATE/.test(sql))).toBe(
        false,
      );
      // nothing typed is nothing at all
      expect(
        (await me.answer(NOON + 4000, 0, "   ")).game?.rejected,
      ).toBeNull();
      // and the question is still open
      const good = await me.answer(NOON + 5000, 0, best(HOME_QUESTIONS[0]));
      expect(good.game).toMatchObject({ phase: "reveal", rejected: null });
      expect(MAX_INPUT).toBeGreaterThan(100);
    });

    test("an alias, in any case and with spaces round it, is judged as the page judged it", async () => {
      const me = player(world());
      await me.start(NOON);
      const withAlias = HOME_QUESTIONS[0].answers.find(
        (a) => a.aliases.length > 0,
      );
      expect(withAlias).toBeDefined();
      const heard = await me.answer(
        NOON + 2000,
        0,
        ` ${withAlias?.aliases[0].toUpperCase()} `,
      );
      expect(heard.game?.turns[0]).toMatchObject({
        answerId: withAlias?.id,
        name: withAlias?.name,
      });
    });
  });

  describe("the clock is the server's", () => {
    test("an answer just after the deadline is the whistle: it counts, with nothing left", async () => {
      const me = player(world());
      await me.start(NOON);
      const late = await me.answer(
        NOON + QUESTION_MS + GRACE_MS - 1,
        0,
        best(HOME_QUESTIONS[0]),
        { whistle: true },
      );
      expect(late.game?.turns[0]).toMatchObject({
        grade: "worldie",
        points: 100,
        msLeft: 0,
      });
    });

    test("at the whistle, something the judge does not know is a time-up", async () => {
      const me = player(world());
      await me.start(NOON);
      const late = await me.answer(NOON + QUESTION_MS + 100, 0, "Qwertyuiop", {
        whistle: true,
      });
      expect(late.game).toMatchObject({ phase: "reveal", rejected: null });
      expect(late.game?.turns[0]).toMatchObject({ grade: "timeup", points: 0 });
      expect(late.game?.reveal?.row).toBeNull();
      expect(late.game?.reveal?.rows).toHaveLength(5);
    });

    test("past the grace it is a time-up whatever is sent", async () => {
      const me = player(world());
      await me.start(NOON);
      const late = await me.answer(
        NOON + QUESTION_MS + GRACE_MS,
        0,
        best(HOME_QUESTIONS[0]),
        { whistle: true },
      );
      expect(late.game?.turns[0]).toMatchObject({
        grade: "timeup",
        points: 0,
        answerId: null,
      });
    });

    test("the page's whistle a moment before the server's is still the whistle", async () => {
      const me = player(world());
      await me.start(NOON);
      // the page's clock runs a little ahead: its whistle arrives 300 ms early
      const early = await me.answer(NOON + QUESTION_MS - 300, 0, "", {
        whistle: true,
      });
      expect(early.game?.phase).toBe("reveal");
      expect(early.game?.turns[0]).toMatchObject({
        grade: "timeup",
        msLeft: 0,
      });

      // but a whistle sent long before the deadline is only an answer
      const cheat = player(world());
      await cheat.start(NOON);
      const soon = await cheat.answer(NOON + 5000, 0, "", { whistle: true });
      expect(soon.game).toMatchObject({ phase: "asking", turns: [] });
    });

    test("a game left alone is timed out by the next request to see it", async () => {
      const me = player(world());
      await me.start(NOON);
      const back = await me.look(NOON + 10 * 60_000);
      expect(back.game).toMatchObject({ phase: "reveal", index: 0, total: 0 });
      expect(back.game?.turns[0]).toMatchObject({ grade: "timeup", points: 0 });
      expect(back.game?.reveal).not.toBeNull();
      // and it stays timed out: an answer now changes nothing
      const tooLate = await me.answer(
        NOON + 10 * 60_000 + 1,
        0,
        best(HOME_QUESTIONS[0]),
      );
      expect(tooLate.game?.turns).toEqual(back.game?.turns);
    });

    test("PASS is allowed from 8 seconds by the server's clock, give or take the clocks' difference", async () => {
      const tooSoon = player(world());
      await tooSoon.start(NOON);
      const refused = await tooSoon.pass(
        NOON + PASS_AFTER_MS - PASS_SLACK_MS - 1,
        0,
      );
      expect(refused.game).toMatchObject({ phase: "asking", turns: [] });

      const justEarly = player(world());
      await justEarly.start(NOON);
      const allowed = await justEarly.pass(NOON + PASS_AFTER_MS - 400, 0);
      expect(allowed.game?.turns[0]).toMatchObject({
        grade: "skipped",
        points: 0,
        msLeft: QUESTION_MS - PASS_AFTER_MS,
      });

      const late = player(world());
      await late.start(NOON);
      const timeUp = await late.pass(NOON + QUESTION_MS + 5, 0);
      expect(timeUp.game?.turns[0]).toMatchObject({ grade: "timeup" });
    });

    test("a game started before midnight can be finished after it, as that day's", async () => {
      const me = player(world());
      const late = EPOCH_UTC + TODAY * MS_PER_DAY - 20_000;
      await me.start(late);
      await me.answer(late + 5000, 0, best(HOME_QUESTIONS[0]));
      // past midnight: the page still says which day's game it is playing
      const tomorrow = late + 30_000;
      const on = await me.next(tomorrow, 0, TODAY);
      expect(on.game).toMatchObject({ day: TODAY, index: 1, phase: "asking" });
      // the new day has no game yet
      expect((await me.look(tomorrow)).game).toBeNull();
      // and no other day's game can be moved
      expect((await me.next(tomorrow + MS_PER_DAY, 1, TODAY)).status).toBe(404);
      expect((await me.next(tomorrow, 1, TODAY + 5)).status).toBe(404);
    });
  });

  describe("a move that does not fit", () => {
    test("a move about a question that is not the one in hand changes nothing", async () => {
      const me = player(world());
      await me.start(NOON);
      await me.answer(NOON + 2000, 0, best(HOME_QUESTIONS[0]));
      const on = await me.next(NOON + 4000, 0);
      expect(on.game).toMatchObject({ index: 1, startedAt: NOON + 4000 });
      // question 1 again: an answer, a pass and NEXT are all nothing now
      const answer = await me.answer(NOON + 5000, 0, "anything");
      expect(answer.game).toMatchObject({ index: 1, phase: "asking" });
      expect(answer.game?.turns).toHaveLength(1);
      expect((await me.pass(NOON + 20_000, 0)).game?.turns).toHaveLength(1);
      expect((await me.next(NOON + 21_000, 0)).game).toMatchObject({
        index: 1,
        startedAt: NOON + 4000,
      });
    });

    test("NEXT while a question is still being asked, or with no game, does nothing", async () => {
      const me = player(world());
      expect((await me.next(NOON, 0)).status).toBe(404);
      expect((await me.look(NOON)).game).toBeNull();
      await me.start(NOON);
      expect((await me.next(NOON + 1000, 0)).game).toMatchObject({
        index: 0,
        phase: "asking",
      });
    });

    test("addresses, methods and bodies that are not the API's", async () => {
      const env = world();
      const me = player(env);
      expect((await me.call("start", NOON, {}, "closest")).status).toBe(404);
      expect((await me.call("shoot", NOON)).status).toBe(404);
      expect((await me.call("start/again", NOON)).status).toBe(404);
      expect((await me.call("start", NOON, {}, "home", "GET")).status).toBe(
        405,
      );
      await me.start(NOON);
      for (const body of [
        "not json",
        "[]",
        JSON.stringify({ index: 0 }),
        JSON.stringify({ day: TODAY }),
        JSON.stringify({ day: TODAY, index: -1 }),
        JSON.stringify({ day: TODAY, index: 0, input: 7 }),
        JSON.stringify({ day: "8", index: 0 }),
        JSON.stringify({ day: TODAY, index: 0, ticket: 7 }),
        JSON.stringify({ day: TODAY, index: 0, input: "x".repeat(MAX_BODY) }),
      ]) {
        const heard = await me.call("answer", NOON + 1000, body);
        expect(heard.status, body.slice(0, 40)).toBe(400);
      }
      const none = await new Browser({ ASSETS: env.ASSETS }, account).start(
        NOON,
      );
      expect(none.status).toBe(503);
    });
  });

  describe("the day's questions", () => {
    /** Seven approved questions for a day's HOME, told apart from the sample by their ids. */
    async function schedule(db: MemoryD1, day: number) {
      await database(db, NOON);
      const scheduled = AWAY_QUESTIONS.map((q, slot) => ({
        ...q,
        id: `scheduled-${slot}`,
        mode: "home" as const,
        prompt: `${q.prompt} (day ${day})`,
      }));
      for (const [slot, question] of scheduled.entries()) {
        const key = { day, mode: "home" as const, slot };
        await saveDraft(db, key, { question, note: "", source: "ai" }, NOON);
        await setStatus(db, key, "approved", "", NOON);
      }
      return scheduled;
    }

    test("the sample is played until the flag says scheduled", async () => {
      const env = world();
      await schedule(env.DB, TODAY);
      const heard = await player(env).start(NOON);
      expect(heard.game?.questions[0].id).toBe(HOME_QUESTIONS[0].id);
    });

    test("with the flag on, a day plays the seven approved for it", async () => {
      const env = world({ QUESTIONS: "scheduled" });
      const scheduled = await schedule(env.DB, TODAY);
      const me = player(env);
      const heard = await me.start(NOON);
      expect(heard.game?.questions[0]).toMatchObject({
        id: "scheduled-0",
        prompt: scheduled[0].prompt,
      });
      const decided = await me.answer(
        NOON + 2000,
        0,
        scheduled[0].answers[0].name,
      );
      expect(decided.game?.turns[0].name).toBe(scheduled[0].answers[0].name);
    });

    test("a day without all seven approved plays the sample: never an unapproved question", async () => {
      const env = world({ QUESTIONS: "scheduled" });
      await schedule(env.DB, TODAY);
      await setStatus(
        env.DB,
        { day: TODAY, mode: "home", slot: 3 },
        "draft",
        "",
        NOON,
      );
      const heard = await player(env).start(NOON);
      expect(heard.game?.questions[0].id).toBe(HOME_QUESTIONS[0].id);
      // and a day with nothing scheduled at all
      const tomorrow = await player(env).start(NOON + MS_PER_DAY);
      expect(tomorrow.game?.questions[0].id).toBe(HOME_QUESTIONS[0].id);
    });

    test("if the day's questions change, a game in progress cannot go on and a finished one stands", async () => {
      const env = world({ QUESTIONS: "scheduled" });
      const scheduled = await schedule(env.DB, TODAY);
      const playing = new Browser(env, account);
      const finished = new Browser(env, account && `${account}-b`);
      await playing.start(NOON);
      await playing.answer(NOON + 1000, 0, scheduled[0].answers[0].name);
      let now = NOON;
      await finished.start(now);
      for (let i = 0; i < 7; i++) {
        await finished.answer((now += 1000), i, scheduled[i].answers[0].name);
        await finished.next((now += 1000), i);
      }
      const total = (await finished.look(now)).game?.total;
      expect((await finished.look(now)).game?.phase).toBe("done");

      // the desk takes a question back: the day falls to the sample (within a minute)
      await setStatus(
        env.DB,
        { day: TODAY, mode: "home", slot: 0 },
        "rejected",
        "wrong",
        now,
      );
      now += QUESTIONS_KEPT_MS + 1;

      expect((await playing.look(now)).game).toBeNull();
      expect((await playing.next(now, 0)).status).toBe(404);
      const again = await playing.start(now);
      expect(again.game).toMatchObject({ index: 0, turns: [], startedAt: now });
      expect(again.game?.questions[0].id).toBe(HOME_QUESTIONS[0].id);

      const kept = await finished.look(now);
      expect(kept.game).toMatchObject({ phase: "done", total });
      expect(kept.game?.turns.map((t) => t.questionId)).toEqual(
        scheduled.map((q) => q.id),
      );
      expect(isGameSnapshot(kept.game)).toBe(true);
    });
  });
});

describe("where no player can be made, a player with no account keeps their own game", () => {
  beforeEach(() => {
    defaults = NO_NEW_PLAYERS;
  });

  test("nothing about them is stored: no row, no cookie, only the ticket they are handed", async () => {
    const env = world();
    const me = new Browser(env);
    let now = NOON;
    const started = await me.start(now);
    expect(started.ticket).toMatch(/^t1\.[\w-]+\.[\w-]+$/);
    for (let i = 0; i < 7; i++) {
      const decided = await me.answer(
        (now += 2000),
        i,
        best(HOME_QUESTIONS[i]),
      );
      expect(decided.ticket).not.toBeNull();
      expect(decided.response.headers.get("set-cookie")).toBeNull();
      await me.next((now += 2000), i);
    }
    expect((await me.look(now)).game).toMatchObject({
      phase: "done",
      total: 700,
    });
    expect(await rows(env.DB, "SELECT day FROM games")).toEqual([]);
    // all the database holds is the key the tickets are sealed with, made once
    expect(await rows(env.DB, "SELECT name FROM secrets")).toEqual([
      { name: "game-ticket-key" },
    ]);
    // and it is not written to again, however many games are played
    const before = env.DB.log.length;
    await new Browser(env).start(now);
    expect(
      env.DB.log
        .slice(before)
        .some((sql) => /^\s*(INSERT|UPDATE|DELETE)/i.test(sql)),
    ).toBe(false);
    // a finished game's ticket fits in a request with room to spare
    expect(me.tickets.get("home")?.length).toBeLessThan(MAX_TICKET / 2);
  });

  test("a ticket holds the game and no answers: only what the player has been shown", async () => {
    const me = new Browser(world());
    const started = await me.start(NOON);
    const sealed = (started.ticket ?? "").split(".")[1];
    const inside = Buffer.from(sealed, "base64url").toString("utf8");
    expect(JSON.parse(inside)).toMatchObject({
      day: TODAY,
      mode: "home",
      index: 0,
      phase: "asking",
      turns: [],
    });
    for (const question of HOME_QUESTIONS) {
      expect(inside).not.toContain(question.answers[0].name);
      expect(inside).not.toContain(question.prompt);
    }
  });

  test("a ticket that was changed, made up or cut short is no game", async () => {
    const env = world();
    const me = new Browser(env);
    await me.start(NOON);
    const decided = await me.answer(NOON + 2000, 0, "Qwertyuiop");
    expect(decided.game?.phase).toBe("asking");
    const real = me.tickets.get("home") ?? "";
    const [version, body, mark] = real.split(".");

    // the game inside, rewritten to have scored 700 already
    const state = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as Record<string, unknown>;
    const forged = Buffer.from(
      JSON.stringify({ ...state, total: 700 }),
    ).toString("base64url");
    const fakes = [
      `${version}.${forged}.${mark}`,
      `${version}.${body}.${"A".repeat(mark.length)}`,
      `${version}.${body}`,
      `t0.${body}.${mark}`,
      real.slice(0, -4),
      "not a ticket",
      "x".repeat(MAX_TICKET + 1),
    ];
    for (const fake of fakes) {
      const cheat = new Browser(env);
      cheat.tickets.set("home", fake);
      expect(
        (await cheat.look(NOON + 3000)).game,
        fake.slice(0, 30),
      ).toBeNull();
      expect(
        (await cheat.answer(NOON + 3000, 0, best(HOME_QUESTIONS[0]))).status,
      ).toBe(404);
    }
    // the real one still plays
    expect(
      (await me.answer(NOON + 4000, 0, best(HOME_QUESTIONS[0]))).game?.phase,
    ).toBe("reveal");
  });

  test("a ticket is for its own mode, and for its own day", async () => {
    const env = world();
    const me = new Browser(env);
    await me.start(NOON);
    const home = me.tickets.get("home") ?? "";
    const other = new Browser(env);
    other.tickets.set("away", home);
    expect((await other.look(NOON + 1000, "away")).game).toBeNull();
    // a week on, it is nobody's game
    expect((await me.look(NOON + 7 * MS_PER_DAY)).game).toBeNull();
    expect((await me.next(NOON + 7 * MS_PER_DAY, 0)).status).toBe(404);
  });

  test("starting again is a new game: only the device remembers the first", async () => {
    const me = new Browser(world());
    const first = await me.start(NOON);
    const second = await me.start(NOON + 5000);
    expect(second.game).toMatchObject({ index: 0, startedAt: NOON + 5000 });
    expect(second.ticket).not.toBe(first.ticket);
  });

  test("a ticket can be used twice, since the server does not remember it: so these games are on no leaderboard", async () => {
    const env = world();
    const me = new Browser(env);
    await me.start(NOON);
    const early = me.tickets.get("home") ?? "";
    await me.answer(NOON + 3000, 0, HOME_QUESTIONS[0].answers[5].name);
    // the same question again, from the ticket as it was before the answer
    me.tickets.set("home", early);
    const again = await me.answer(NOON + 4000, 0, best(HOME_QUESTIONS[0]));
    expect(again.game?.turns[0].grade).toBe("worldie");
    // what comes of it is kept nowhere but on their own device
    expect(await rows(env.DB, "SELECT day FROM games")).toEqual([]);
  });
});

describe("an account's game is kept by the server", () => {
  const account = (env: Env, id = "account-1") => new Browser(env, id);

  test("it is a row in the database, and there is no ticket to keep", async () => {
    const env = world();
    const me = account(env);
    const started = await me.start(NOON);
    expect(started.ticket).toBeNull();
    let now = NOON;
    for (let i = 0; i < 7; i++) {
      const decided = await me.answer(
        (now += 4000),
        i,
        best(HOME_QUESTIONS[i]),
      );
      expect(decided.ticket).toBeNull();
      await me.next((now += 3000), i);
    }
    const [game] = await rows<{
      player_id: string;
      total: number;
      phase: string;
      source: string;
      finished_at: number;
    }>(
      env.DB,
      "SELECT player_id, total, phase, source, finished_at FROM games",
    );
    expect(game).toMatchObject({
      player_id: "account-1",
      total: 700,
      phase: "done",
      source: "sample",
    });
    // finished when the last question was decided, not when the card was opened
    expect(game.finished_at).toBe(now - 3000);
  });

  test("a mode is played once a day: starting again gets the same game, clock and all", async () => {
    const env = world();
    const me = account(env);
    await me.start(NOON);
    const again = await me.start(NOON + 5000);
    expect(again.game?.startedAt).toBe(NOON);
    expect(again.game?.deadline).toBe(NOON + QUESTION_MS);
    expect(await rows(env.DB, "SELECT day FROM games")).toHaveLength(1);
    // finished, it is still the day's game
    let now = NOON;
    for (let i = 0; i < 7; i++) {
      await me.answer((now += 1000), i, best(HOME_QUESTIONS[i]));
      await me.next((now += 1000), i);
    }
    expect((await me.start(now + 1000)).game).toMatchObject({
      phase: "done",
      total: 700,
    });
    expect(await rows(env.DB, "SELECT day FROM games")).toHaveLength(1);
  });

  test("each account has its own game", async () => {
    const env = world();
    const one = account(env, "account-1");
    const two = account(env, "account-2");
    await one.start(NOON);
    await two.start(NOON + 1000);
    await one.answer(NOON + 2000, 0, best(HOME_QUESTIONS[0]));
    expect((await one.look(NOON + 3000)).game?.phase).toBe("reveal");
    expect((await two.look(NOON + 3000)).game?.phase).toBe("asking");
    expect((await account(env, "account-3").look(NOON)).game).toBeNull();
  });

  test("a move sent twice happens once", async () => {
    const me = account(world());
    await me.start(NOON);
    const first = await me.answer(NOON + 2000, 0, best(HOME_QUESTIONS[0]));
    const again = await me.answer(NOON + 2500, 0, best(HOME_QUESTIONS[0]));
    expect(again.game).toEqual(first.game);
    // nor does another answer replace the first
    const other = await me.answer(
      NOON + 2600,
      0,
      HOME_QUESTIONS[0].answers[5].name,
    );
    expect(other.game?.turns).toEqual(first.game?.turns);

    const on = await me.next(NOON + 4000, 0);
    const onAgain = await me.next(NOON + 9000, 0);
    // the second NEXT does not skip a question or start its clock again
    expect(onAgain.game).toEqual(on.game);
    expect(onAgain.game).toMatchObject({ index: 1, startedAt: NOON + 4000 });
  });

  test("two answers at the same moment: one is the answer", async () => {
    const me = account(world());
    await me.start(NOON);
    const [a, b] = await Promise.all([
      me.answer(NOON + 2000, 0, best(HOME_QUESTIONS[0])),
      me.answer(NOON + 2000, 0, HOME_QUESTIONS[0].answers[5].name),
    ]);
    expect(a.game?.turns).toHaveLength(1);
    expect(b.game?.turns).toEqual(a.game?.turns);
  });
});
