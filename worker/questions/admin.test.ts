// @vitest-environment node
/**
 * The approval desk (worker/questions/admin.ts) and the questions' store
 * (worker/questions/store.ts): drafts in, looked at, approved, and only then scheduled.
 */
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { AWAY_QUESTIONS, HOME_QUESTIONS, RETRO_QUESTIONS } from "~/data";
import type { Question } from "~/game/types";

import { handle } from "../app";
import type { Env } from "../env";
import { type MemoryD1, memoryD1 } from "../testing/d1";
import type { DraftResult } from "./admin";
import { type Slot, scheduledFor } from "./store";

const NOW = Date.UTC(2026, 10, 17, 12);
const TOKEN = "a-long-random-secret-for-the-tests-0123456789";

let db: MemoryD1;
let env: Env;

beforeEach(() => {
  db = memoryD1();
  env = {
    DB: db,
    ADMIN_TOKEN: TOKEN,
    ASSETS: { fetch: async () => new Response("the built site") },
  };
});
afterEach(() => db.close());

function call(
  path: string,
  init: { method?: string; body?: unknown; token?: string | null } = {},
  at = NOW,
): Promise<Response> {
  const headers: Record<string, string> = {};
  const token = init.token === undefined ? TOKEN : init.token;
  if (token !== null) headers.authorization = `Bearer ${token}`;
  return handle(
    new Request(`https://soccersense.example/api/admin${path}`, {
      method: init.method ?? "GET",
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    }),
    env,
    at,
  );
}

/** A draft as it is sent: a sample question for a place. */
const draft = (question: Question, day: number, slot: number) => ({
  day,
  mode: question.mode,
  slot,
  question: JSON.parse(JSON.stringify(question)) as unknown,
  note: `sources for ${question.id}`,
});

const send = async (drafts: unknown[], extra: Record<string, unknown> = {}) =>
  (
    (await (
      await call("/questions", { method: "PUT", body: { drafts, ...extra } })
    ).json()) as { results: DraftResult[] }
  ).results;

const look = async (from: number, to = from) =>
  (
    (await (await call(`/questions?from=${from}&to=${to}`)).json()) as {
      slots: Slot[];
    }
  ).slots;

describe("who may use the desk", () => {
  test("nobody, until a token of some length is set", async () => {
    for (const ADMIN_TOKEN of [undefined, "", "short"]) {
      env = { ...env, ADMIN_TOKEN };
      const response = await call("/questions?from=1", { token: "short" });
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ error: "admin_not_set_up" });
    }
  });

  test("only the holder of the token: none, another, or part of it is turned away", async () => {
    for (const token of [null, "", "wrong", TOKEN.slice(0, -1), `${TOKEN}x`]) {
      const response = await call("/questions?from=1", { token });
      expect(response.status, String(token)).toBe(401);
      // and it is told which: no token came, or one that is not the desk's
      expect(await response.json()).toEqual({
        error: "unauthorized",
        reason: token ? "wrong_token" : "no_token",
      });
    }
    expect((await call("/questions?from=1")).status).toBe(200);
    // and nothing was written by the ones turned away
    const sent = await call("/questions", {
      method: "PUT",
      token: "wrong",
      body: { drafts: [draft(HOME_QUESTIONS[0], 9, 0)] },
    });
    expect(sent.status).toBe(401);
    expect(await look(9)).toEqual([]);
  });

  test("with no database the desk says so", async () => {
    env = { ...env, DB: undefined };
    expect((await call("/questions?from=1")).status).toBe(503);
  });
});

describe("sending drafts", () => {
  test("a fit question is saved as a draft, with its note, its shots filed", async () => {
    const results = await send([draft(HOME_QUESTIONS[0], 9, 0)]);
    expect(results).toEqual([
      { day: 9, mode: "home", slot: 0, outcome: "saved", problems: [] },
    ]);
    const [slot] = await look(9);
    expect(slot).toMatchObject({
      day: 9,
      mode: "home",
      slot: 0,
      status: "draft",
      note: `sources for ${HOME_QUESTIONS[0].id}`,
      review: "",
      source: "ai",
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect(slot.question.id).toBe(HOME_QUESTIONS[0].id);
    expect(slot.question.answers.every((a) => typeof a.shot === "string")).toBe(
      true,
    );
  });

  test("an unfit one is refused with what is wrong, and the rest of the batch still goes in", async () => {
    const bad = draft(HOME_QUESTIONS[1], 9, 1);
    (bad.question as { prompt: string }).prompt = "Which club?";
    const results = await send([
      draft(HOME_QUESTIONS[0], 9, 0),
      bad,
      { day: 9, mode: "home", slot: 7, question: {} },
      { day: 0, mode: "home", slot: 0, question: {} },
      { day: 9, mode: "closest", slot: 0, question: {} },
      "not a draft",
      draft(AWAY_QUESTIONS[0], 9, 0),
    ]);
    expect(results.map((r) => r.outcome)).toEqual([
      "saved",
      "refused",
      "refused",
      "refused",
      "refused",
      "refused",
      "saved",
    ]);
    expect(results[1].problems.join()).toMatch(/must start "Name a/);
    expect(results[2].problems.join()).toMatch(/place from 0 to 6/);
    expect((await look(9)).map((s) => [s.mode, s.slot])).toEqual([
      ["home", 0],
      ["away", 0],
    ]);
  });

  test("a question in the wrong mode's place, or twice in one day and mode, is refused", async () => {
    const misplaced = { ...draft(HOME_QUESTIONS[0], 9, 0), mode: "away" };
    expect((await send([misplaced]))[0].problems.join()).toMatch(
      /mode is home, not away/,
    );
    await send([draft(HOME_QUESTIONS[0], 9, 0)]);
    const twice = await send([draft(HOME_QUESTIONS[0], 9, 3)]);
    expect(twice[0].outcome).toBe("refused");
    expect(twice[0].problems.join()).toMatch(/already in place 0/);
    // the same question on another day is its own matter
    expect((await send([draft(HOME_QUESTIONS[0], 10, 3)]))[0].outcome).toBe(
      "saved",
    );
  });

  test("a new draft takes the place of a draft or a rejected one, never of an approved one", async () => {
    await send([draft(HOME_QUESTIONS[0], 9, 0)]);
    expect((await send([draft(HOME_QUESTIONS[1], 9, 0)]))[0].outcome).toBe(
      "saved",
    );
    expect((await look(9))[0].question.id).toBe(HOME_QUESTIONS[1].id);

    await call("/questions/9/home/0", {
      method: "POST",
      body: { status: "approved" },
    });
    const again = await send([draft(HOME_QUESTIONS[2], 9, 0)], {});
    expect(again[0].outcome).toBe("kept");
    expect((await look(9))[0]).toMatchObject({ status: "approved" });
    expect((await look(9))[0].question.id).toBe(HOME_QUESTIONS[1].id);

    // unless the sender says to replace it: then it is a draft again
    const forced = await send([draft(HOME_QUESTIONS[2], 9, 0)], {
      replace: true,
    });
    expect(forced[0].outcome).toBe("saved");
    expect((await look(9))[0]).toMatchObject({ status: "draft" });
  });

  test("what is not a batch of drafts is a bad request", async () => {
    for (const body of [null, [], {}, { drafts: "seven" }]) {
      const response = await call("/questions", { method: "PUT", body });
      expect(response.status).toBe(400);
    }
    const many = Array.from({ length: 251 }, () => ({}));
    expect(
      (await call("/questions", { method: "PUT", body: { drafts: many } }))
        .status,
    ).toBe(400);
  });
});

describe("looking, approving, rejecting, correcting", () => {
  test("a look is every place filled in the days asked for, in order", async () => {
    await send([
      draft(RETRO_QUESTIONS[0], 10, 2),
      draft(HOME_QUESTIONS[1], 9, 1),
      draft(AWAY_QUESTIONS[0], 9, 0),
      draft(HOME_QUESTIONS[0], 9, 0),
      draft(HOME_QUESTIONS[2], 11, 0),
    ]);
    expect(
      (await look(9, 10)).map((s) => `${s.day}/${s.mode}/${s.slot}`),
    ).toEqual(["9/home/0", "9/home/1", "9/away/0", "10/retro/2"]);
    for (const query of [
      "",
      "?from=0",
      "?from=5&to=4",
      "?from=1&to=40",
      "?from=x",
    ]) {
      expect((await call(`/questions${query}`)).status, query).toBe(400);
    }
  });

  test("a brief look is the same places without their answers, over a longer span", async () => {
    await send([
      draft(HOME_QUESTIONS[0], 9, 0),
      draft(RETRO_QUESTIONS[0], 100, 2),
    ]);
    await call("/questions/9/home/0", {
      method: "POST",
      body: { status: "rejected", review: "one club is missing" },
    });
    const response = await call("/questions?from=1&to=120&brief=1");
    expect(response.status).toBe(200);
    const brief = ((await response.json()) as { slots: unknown[] }).slots;
    expect(brief).toEqual([
      {
        day: 9,
        mode: "home",
        slot: 0,
        status: "rejected",
        review: "one club is missing",
        questionId: HOME_QUESTIONS[0].id,
        prompt: HOME_QUESTIONS[0].prompt,
        answers: HOME_QUESTIONS[0].answers.length,
        updatedAt: NOW,
      },
      {
        day: 100,
        mode: "retro",
        slot: 2,
        status: "draft",
        review: "",
        questionId: RETRO_QUESTIONS[0].id,
        prompt: RETRO_QUESTIONS[0].prompt,
        answers: RETRO_QUESTIONS[0].answers.length,
        updatedAt: NOW,
      },
    ]);
    // a whole look may not span that far
    expect((await call("/questions?from=1&to=120")).status).toBe(400);
    expect((await call("/questions?from=1&to=121&brief=1")).status).toBe(400);
  });

  test("approve, reject with a reason, and back to draft", async () => {
    await send([draft(HOME_QUESTIONS[0], 9, 0)]);
    const set = async (body: unknown, at = NOW + 60_000) =>
      call("/questions/9/home/0", { method: "POST", body }, at);

    const approved = (await (await set({ status: "approved" })).json()) as {
      slot: Slot;
    };
    expect(approved.slot).toMatchObject({
      status: "approved",
      updatedAt: NOW + 60_000,
      createdAt: NOW,
    });

    const rejected = (await (
      await set({ status: "rejected", review: "Leicester is missing" })
    ).json()) as { slot: Slot };
    expect(rejected.slot).toMatchObject({
      status: "rejected",
      review: "Leicester is missing",
    });

    expect(
      (await (await set({ status: "draft" })).json()) as { slot: Slot },
    ).toMatchObject({ slot: { status: "draft", review: "" } });
    expect((await set({ status: "published" })).status).toBe(400);
  });

  test("a corrected question takes the place, as a draft, and an unfit correction is refused", async () => {
    await send([draft(HOME_QUESTIONS[0], 9, 0)]);
    const fixed = JSON.parse(JSON.stringify(HOME_QUESTIONS[0])) as Question;
    fixed.prompt = "Name a club that has been champions of the Premier League";
    const done = await call("/questions/9/home/0", {
      method: "POST",
      body: { question: fixed, status: "approved" },
    });
    expect(done.status).toBe(200);
    const slot = ((await done.json()) as { slot: Slot }).slot;
    expect(slot.question.prompt).toBe(fixed.prompt);
    expect(slot.status).toBe("approved");
    // the drafter's note stays with the place
    expect(slot.note).toBe(`sources for ${HOME_QUESTIONS[0].id}`);

    const broken = { ...fixed, answers: fixed.answers.slice(0, 2) };
    const refused = await call("/questions/9/home/0", {
      method: "POST",
      body: { question: broken },
    });
    expect(refused.status).toBe(422);
    expect(
      ((await refused.json()) as { problems: string[] }).problems.join(),
    ).toMatch(/needs at least 6/);
    // and what was there is still there
    expect((await look(9))[0].question.prompt).toBe(fixed.prompt);
  });

  test("a place with nothing in it, or that is not a place, is not found", async () => {
    const post = (path: string) =>
      call(path, { method: "POST", body: { status: "approved" } });
    expect((await post("/questions/9/home/0")).status).toBe(404);
    expect((await post("/questions/9/home/7")).status).toBe(404);
    expect((await post("/questions/9/closest/0")).status).toBe(404);
    expect((await post("/questions/0/home/0")).status).toBe(404);
    expect((await call("/nothing")).status).toBe(404);
    expect((await call("/questions/9/home/0")).status).toBe(405);
  });
});

describe("what is scheduled", () => {
  test("a day and mode is scheduled only when all seven of its places are approved", async () => {
    await send(HOME_QUESTIONS.map((q, slot) => draft(q, 9, slot)));
    expect(await scheduledFor(db, 9, "home")).toBeNull();
    for (let slot = 0; slot < 6; slot++) {
      await call(`/questions/9/home/${slot}`, {
        method: "POST",
        body: { status: "approved" },
      });
    }
    // six of seven: still not a game
    expect(await scheduledFor(db, 9, "home")).toBeNull();
    await call("/questions/9/home/6", {
      method: "POST",
      body: { status: "approved" },
    });
    const questions = await scheduledFor(db, 9, "home");
    expect(questions?.map((q) => q.id)).toEqual(
      HOME_QUESTIONS.map((q) => q.id),
    );
    // another day, another mode: nothing
    expect(await scheduledFor(db, 10, "home")).toBeNull();
    expect(await scheduledFor(db, 9, "away")).toBeNull();

    // one sent back: the day is no longer scheduled
    await call("/questions/9/home/3", {
      method: "POST",
      body: { status: "rejected", review: "out of date" },
    });
    expect(await scheduledFor(db, 9, "home")).toBeNull();
  });
});
