// @vitest-environment node
/**
 * The day's place at the desk (worker/questions/admin.ts, ./places.ts) and in the games
 * (../games/questions.ts, `/api/today`): drafted, approved before its CLOSEST and FURTHEST,
 * played only once approved, the fixed list's until then. The product owner, 2026-11-19:
 * "i dont want fixed places because eventually questions will get repetitive so it should
 * also be generated".
 */
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { CLOSEST_QUESTIONS, HOME_QUESTIONS } from "~/data";
import { PLACES, type Place } from "~/data/places";
import { stadiumForDay } from "~/game/day";
import type { Question } from "~/game/types";

import { type TodayAnswer, handle } from "../app";
import type { Env } from "../env";
import { questionsOn } from "../games/questions";
import { type MemoryD1, memoryD1 } from "../testing/d1";
import { PLACE_FIRST, type PlaceResult } from "./admin";
import { PLACE_CHANGED, type PlaceSlot } from "./places";
import type { Slot } from "./store";

/** Day 8 at noon: the tests' today. */
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
  init: { method?: string; body?: unknown } = {},
): Promise<Response> {
  return handle(
    new Request(`https://soccersense.example/api${path}`, {
      method: init.method ?? "GET",
      headers: { authorization: `Bearer ${TOKEN}` },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    }),
    env,
    NOW,
  );
}

const byId = (id: string) => PLACES.find((p) => p.id === id) as Place;
const LAGOS = byId("lagos");
const ANFIELD = byId("anfield");

const sendPlaces = async (
  places: { day: number; place: unknown }[],
  extra: Record<string, unknown> = {},
) =>
  (
    (await (
      await call("/admin/places", {
        method: "PUT",
        body: {
          places: places.map((p) => ({ ...p, note: "sources" })),
          ...extra,
        },
      })
    ).json()) as { results: PlaceResult[] }
  ).results;

const setPlace = (day: number, body: Record<string, unknown>) =>
  call(`/admin/places/${day}`, { method: "POST", body });

const look = async (from: number, to = from) =>
  (await (await call(`/admin/questions?from=${from}&to=${to}`)).json()) as {
    slots: Slot[];
    places: PlaceSlot[];
  };

const sendQuestions = (questions: readonly Question[], day: number) =>
  call("/admin/questions", {
    method: "PUT",
    body: {
      drafts: questions.map((question, slot) => ({
        day,
        mode: question.mode,
        slot,
        question,
      })),
    },
  });

const approveQuestion = (day: number, mode: string, slot: number) =>
  call(`/admin/questions/${day}/${mode}/${slot}`, {
    method: "POST",
    body: { status: "approved" },
  });

describe("a day's place at the desk", () => {
  test("a fit place is saved as a draft and looked at with the week's questions", async () => {
    const results = await sendPlaces([{ day: 9, place: LAGOS }]);
    expect(results).toEqual([{ day: 9, outcome: "saved", problems: [] }]);
    const { places } = await look(9, 12);
    expect(places).toMatchObject([
      { day: 9, status: "draft", place: LAGOS, note: "sources", source: "ai" },
    ]);
  });

  test("an unfit place, or one used within 90 days, is refused with why; the rest go in", async () => {
    await sendPlaces([{ day: 9, place: LAGOS }]);
    const results = await sendPlaces([
      { day: 10, place: { ...ANFIELD, lat: 0 } },
      { day: 11, place: LAGOS },
      { day: 12, place: ANFIELD },
      { day: 0, place: ANFIELD },
    ]);
    expect(results.map((r) => r.outcome)).toEqual([
      "refused",
      "refused",
      "saved",
      "refused",
    ]);
    expect(results[0].problems[0]).toMatch(/^lat must be/);
    expect(results[1].problems).toEqual([
      "lagos is already the place of day 9: no place twice within 90 days",
    ]);
    // a hundred days on, it may be again
    expect((await sendPlaces([{ day: 120, place: LAGOS }]))[0].outcome).toBe(
      "saved",
    );
  });

  test("approved, rejected with a reason, corrected; an approved place is kept from a new draft", async () => {
    await sendPlaces([{ day: 9, place: LAGOS }]);
    const approved = (await (
      await setPlace(9, { status: "approved" })
    ).json()) as {
      place: PlaceSlot;
    };
    expect(approved.place.status).toBe("approved");
    // the week drafted again does not undo it
    expect((await sendPlaces([{ day: 9, place: ANFIELD }]))[0].outcome).toBe(
      "kept",
    );
    const rejected = (await (
      await setPlace(9, { status: "rejected", review: "too near yesterday" })
    ).json()) as { place: PlaceSlot };
    expect(rejected.place).toMatchObject({
      status: "rejected",
      review: "too near yesterday",
    });
    // a correction: checked, a draft again
    const unfit = await setPlace(9, { place: { ...ANFIELD, kind: "pub" } });
    expect(unfit.status).toBe(422);
    const fixed = (await (await setPlace(9, { place: ANFIELD })).json()) as {
      place: PlaceSlot;
    };
    expect(fixed.place).toMatchObject({ status: "draft", place: ANFIELD });
    expect((await setPlace(30, { status: "approved" })).status).toBe(404);
  });

  test("a CLOSEST or FURTHEST question is approved only once its day's place is", async () => {
    await sendQuestions(CLOSEST_QUESTIONS, 9);
    const early = await approveQuestion(9, "closest", 0);
    expect(early.status).toBe(422);
    expect(await early.json()).toEqual({
      error: "unfit",
      problems: [PLACE_FIRST],
    });
    // a drafted place is not enough
    await sendPlaces([{ day: 9, place: LAGOS }]);
    expect((await approveQuestion(9, "closest", 0)).status).toBe(422);
    await setPlace(9, { status: "approved" });
    expect((await approveQuestion(9, "closest", 0)).status).toBe(200);
    // the other modes have no place to wait for
    await sendQuestions(HOME_QUESTIONS, 10);
    expect((await approveQuestion(10, "home", 0)).status).toBe(200);
  });

  test("a place changed once approved sends the day's approved CLOSEST and FURTHEST back to draft", async () => {
    await sendPlaces([{ day: 9, place: LAGOS }]);
    await setPlace(9, { status: "approved" });
    await sendQuestions(CLOSEST_QUESTIONS, 9);
    await sendQuestions(HOME_QUESTIONS, 9);
    for (let slot = 0; slot < 7; slot++) {
      await approveQuestion(9, "closest", slot);
      await approveQuestion(9, "home", slot);
    }
    await setPlace(9, { place: ANFIELD });
    const { slots } = await look(9);
    const closest = slots.filter((s) => s.mode === "closest");
    expect(closest.every((s) => s.status === "draft")).toBe(true);
    expect(closest[0].review).toBe(PLACE_CHANGED);
    // HOME is not measured from it
    expect(
      slots
        .filter((s) => s.mode === "home")
        .every((s) => s.status === "approved"),
    ).toBe(true);
  });
});

describe("the place a day plays", () => {
  const scheduled = () => ({ ...env, QUESTIONS: "scheduled" });

  test("with the sample on: the fixed list's in turn, whatever is approved", async () => {
    await sendPlaces([{ day: 8, place: LAGOS }]);
    await setPlace(8, { status: "approved" });
    const set = await questionsOn(env, db, 8, "closest", NOW);
    expect(set.place).toEqual(stadiumForDay(8, PLACES));
    const today = (await (await call("/today")).json()) as TodayAnswer;
    expect(today.place).toEqual(stadiumForDay(8, PLACES));
  });

  test("with the real questions on: the approved place, else the fixed list's", async () => {
    env = scheduled();
    // none approved: the fixed list's
    await sendPlaces([{ day: 8, place: LAGOS }]);
    expect((await questionsOn(env, db, 8, "home", NOW)).place).toEqual(
      stadiumForDay(8, PLACES),
    );
    await setPlace(8, { status: "approved" });
    // remembered a minute: a minute on, the approved one, in every mode and to the page
    const later = NOW + 61_000;
    expect((await questionsOn(env, db, 8, "furthest", later)).place).toEqual(
      LAGOS,
    );
    const today = (await (await call("/today")).json()) as TodayAnswer;
    expect(today.place).toEqual(LAGOS);
  });

  test("CLOSEST's scheduled questions are played only with their day's approved place", async () => {
    env = scheduled();
    await sendPlaces([{ day: 8, place: LAGOS }]);
    await setPlace(8, { status: "approved" });
    await sendQuestions(CLOSEST_QUESTIONS, 8);
    for (let slot = 0; slot < 7; slot++)
      await approveQuestion(8, "closest", slot);
    const played = await questionsOn(env, db, 8, "closest", NOW);
    expect(played.source).toBe("scheduled");
    expect(played.place).toEqual(LAGOS);
    // the place sent back: its questions went back to draft, and the sample plays from
    // the fixed list's place
    await setPlace(8, { status: "rejected", review: "wrong coordinates" });
    const after = await questionsOn(env, db, 8, "closest", NOW + 61_000);
    expect(after.source).toBe("sample");
    expect(after.place).toEqual(stadiumForDay(8, PLACES));
  });

  test("the day's place reaches the page even with the database failing: the fixed list's", async () => {
    env = { ...scheduled(), DB: undefined };
    const today = (await (await call("/today")).json()) as TodayAnswer;
    expect(today.place).toEqual(stadiumForDay(8, PLACES));
  });
});
