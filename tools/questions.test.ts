// @vitest-environment node
/** The drafter's tool (tools/questions.ts): what needs drafting, and whether a file is fit. */
import { describe, expect, test } from "vitest";

import {
  AWAY_QUESTIONS,
  CLOSEST_QUESTIONS,
  FURTHEST_QUESTIONS,
  HOME_QUESTIONS,
  RETRO_QUESTIONS,
} from "~/data";
import { PLACES, type Place, placeLabel } from "~/data/places";
import type { Question } from "~/game/types";

import {
  APART_KM,
  type BriefSlot,
  type DayPlace,
  type DaySlot,
  TODO_FROM,
  TODO_TO,
  checkDrafts,
  checkPlaces,
  daysToPlace,
  placesToDraft,
} from "./questions";

/** A place on the desk for a day. */
const onDesk = (
  day: number,
  place: Place,
  status: DaySlot["status"] = "draft",
  review = "",
): DaySlot => ({ day, status, place, review });

/** A place as the drafter is told it. */
const told = (place: Place): DayPlace => ({
  id: place.id,
  label: placeLabel(place),
  kind: place.kind,
  lat: place.lat,
  lng: place.lng,
  status: "approved",
});

const copy = (question: Question) =>
  JSON.parse(JSON.stringify(question)) as Record<string, unknown>;
const draft = (question: Question, day: number, slot: number) => ({
  day,
  mode: question.mode,
  slot,
  question: copy(question),
  note: "sources",
});
const brief = (
  day: number,
  mode: BriefSlot["mode"],
  slot: number,
  status: BriefSlot["status"],
  review = "",
): BriefSlot => ({
  day,
  mode,
  slot,
  status,
  review,
  questionId: `q-${day}-${mode}-${slot}`,
  prompt: `Name a thing ${day} ${mode} ${slot}`,
});

describe("what needs drafting", () => {
  test("with nothing drafted: every place from tomorrow to eight days on", () => {
    const todo = placesToDraft(8, []);
    // eight days, six modes, seven places
    expect(todo).toHaveLength((TODO_TO - TODO_FROM + 1) * 6 * 7);
    expect(todo[0]).toEqual({
      day: 9,
      date: "2026-11-18",
      mode: "home",
      slot: 0,
      why: "empty",
    });
    expect(todo.at(-1)).toMatchObject({ day: 16, mode: "furthest", slot: 6 });
    // never today (it is being played) and never further than eight days on
    expect(todo.every((p) => p.day > 8 && p.day <= 16)).toBe(true);
  });

  test("a draft or an approved question is left alone; a rejected one is to be done again, with its reason", () => {
    const todo = placesToDraft(8, [
      brief(9, "home", 0, "draft"),
      brief(9, "home", 1, "approved"),
      brief(9, "home", 2, "rejected", "two winners are missing"),
      // outside the days being drafted: not this run's business
      brief(8, "home", 0, "rejected", "today"),
      brief(17, "home", 0, "rejected", "too far"),
    ]);
    const home9 = todo.filter((p) => p.day === 9 && p.mode === "home");
    expect(home9.map((p) => [p.slot, p.why])).toEqual([
      [2, "rejected"],
      [3, "empty"],
      [4, "empty"],
      [5, "empty"],
      [6, "empty"],
    ]);
    expect(home9[0]).toMatchObject({
      review: "two winners are missing",
      rejected: {
        questionId: "q-9-home-2",
        prompt: "Name a thing 9 home 2",
      },
    });
    expect(todo.some((p) => p.day === 8 || p.day === 17)).toBe(false);
  });

  // the product owner, 2026-11-19: "add these new gamemodes to the schedule so once i remove
  // sample feature flag then these will also get generated and have new ones daily"
  test("CLOSEST and FURTHEST are drafted too, each saying the day's place it is measured from, or waiting for it", () => {
    const todo = placesToDraft(
      8,
      [],
      [onDesk(10, PLACES[5]), onDesk(11, PLACES[6], "rejected", "too near")],
    );
    for (const mode of ["closest", "furthest"] as const) {
      const ten = todo.filter((p) => p.day === 10 && p.mode === mode);
      expect(ten).toHaveLength(7);
      for (const p of ten) {
        expect(p.place).toEqual({ ...told(PLACES[5]), status: "draft" });
        expect(p.waitsForPlace).toBeUndefined();
      }
      // a rejected place is no place: its questions wait for the next
      for (const p of todo.filter((p) => p.day === 11 && p.mode === mode)) {
        expect(p.place).toBeUndefined();
        expect(p.waitsForPlace).toBe(true);
      }
    }
    // the other modes are not measured from it
    expect(
      todo
        .filter((p) => p.place || p.waitsForPlace)
        .every((p) => p.mode === "closest" || p.mode === "furthest"),
    ).toBe(true);
  });

  // the product owner, 2026-11-19: "i dont want fixed places because eventually questions
  // will get repetitive so it should also be generated"
  test("the days whose place is to be drafted: none yet, or rejected, with the days either side's", () => {
    const days = daysToPlace(8, [
      onDesk(9, PLACES[0], "approved"),
      onDesk(10, PLACES[1], "rejected", "a stadium two days running"),
      onDesk(12, PLACES[3]),
    ]);
    expect(days.map((d) => [d.day, d.why])).toEqual([
      [10, "rejected"],
      [11, "empty"],
      [13, "empty"],
      [14, "empty"],
      [15, "empty"],
      [16, "empty"],
    ]);
    expect(days[0]).toMatchObject({
      review: "a stadium two days running",
      rejected: { id: PLACES[1].id, label: placeLabel(PLACES[1]) },
      before: { id: PLACES[0].id, status: "approved" },
    });
    expect(days[1]).toMatchObject({
      after: { id: PLACES[3].id, status: "draft" },
    });
    expect(days[1].before).toBeUndefined();
  });

  test("a week that is all drafted leaves nothing to do", () => {
    const all: BriefSlot[] = [];
    for (let day = 9; day <= 16; day++) {
      for (const mode of [
        "home",
        "away",
        "retro",
        "nextgen",
        "closest",
        "furthest",
      ] as const) {
        for (let slot = 0; slot < 7; slot++) {
          all.push(brief(day, mode, slot, slot % 2 ? "draft" : "approved"));
        }
      }
    }
    expect(placesToDraft(8, all)).toEqual([]);
  });
});

describe("checking a file of drafts", () => {
  test("a game of sample questions is fit to send", () => {
    const file = {
      drafts: [
        ...HOME_QUESTIONS.map((q, slot) => draft(q, 9, slot)),
        ...RETRO_QUESTIONS.map((q, slot) => draft(q, 9, slot)),
      ],
    };
    expect(checkDrafts(file)).toEqual([]);
  });

  test("what is not a file of drafts is said so", () => {
    for (const junk of [null, [], {}, { drafts: 7 }, "drafts"]) {
      expect(checkDrafts(junk)).toEqual([
        'the file is not { "drafts": [...] }',
      ]);
    }
    expect(checkDrafts({ drafts: ["x"] })).toEqual(["draft 1: not an object"]);
  });

  test("a place must be a day, a mode and 0 to 6, and may be filled once", () => {
    const problems = checkDrafts({
      drafts: [
        { ...draft(HOME_QUESTIONS[0], 9, 0), slot: 7 },
        { ...draft(HOME_QUESTIONS[0], 9, 0), mode: "penalties" },
        { ...draft(HOME_QUESTIONS[0], 9, 0), day: 0 },
        draft(HOME_QUESTIONS[0], 9, 0),
        draft(HOME_QUESTIONS[1], 9, 0),
      ],
    });
    expect(problems.filter((p) => /must be a day number/.test(p))).toHaveLength(
      3,
    );
    expect(problems.join("\n")).toMatch(
      /day 9 home 0: the place is filled twice/,
    );
  });

  test("every question's own problems are reported with its place", () => {
    const bad = draft(HOME_QUESTIONS[0], 12, 3);
    bad.question.prompt = "Which club?";
    (bad.question.answers as Record<string, unknown>[])[0].lat = 0;
    const problems = checkDrafts({ drafts: [bad] });
    expect(problems).toHaveLength(2);
    expect(problems.every((p) => p.startsWith("day 12 home 3: "))).toBe(true);
  });

  test("no question twice in a game, and no prompt twice in the file, whatever the mode", () => {
    const again = checkDrafts({
      drafts: [draft(HOME_QUESTIONS[0], 9, 0), draft(HOME_QUESTIONS[0], 9, 1)],
    });
    expect(again.join("\n")).toMatch(/is in that day and mode twice/);

    // the same thing asked on another day, in another mode, with the wording dressed up
    const reworded = copy(AWAY_QUESTIONS[0]);
    reworded.prompt = `${HOME_QUESTIONS[0].prompt.replace("Premier League", "PREMIER   LEAGUE")}!`;
    const repeated = checkDrafts({
      drafts: [
        draft(HOME_QUESTIONS[0], 9, 0),
        { day: 11, mode: "away", slot: 2, question: reworded },
      ],
    });
    expect(repeated.join("\n")).toMatch(/is also asked at day 9 home 0/);
  });

  test("CLOSEST and FURTHEST are checked from their day's place: there must be one, and every scoring shot must be some answer's", () => {
    // no place on the desk for the day: drafted first
    const waiting = checkDrafts({
      drafts: [draft(CLOSEST_QUESTIONS[0], 9, 0)],
    });
    expect(waiting).toEqual([
      "day 9 closest 0: day 9 has no place yet: draft and send the day's place first (it is measured from it)",
    ]);
    const results: { fit: boolean; problems: string[]; place: Place }[] = [];
    for (const questions of [CLOSEST_QUESTIONS, FURTHEST_QUESTIONS]) {
      for (const question of questions) {
        for (const place of PLACES) {
          const problems = checkDrafts(
            { drafts: [draft(question, 9, 0)] },
            (day) => (day === 9 ? told(place) : null),
          );
          results.push({ fit: problems.length === 0, problems, place });
        }
      }
    }
    // most of the sample suits most places; some do not, and are told why, by the place
    const fit = results.filter((r) => r.fit).length;
    expect(fit).toBeGreaterThan(results.length / 2);
    const unfit = results.filter((r) => !r.fit);
    expect(unfit.length).toBeGreaterThan(0);
    for (const r of unfit) {
      expect(r.problems).toHaveLength(1);
      expect(r.problems[0]).toContain(
        `measured from day 9's place, ${placeLabel(r.place)}, no answer would be a`,
      );
    }
  });
});

describe("checking a file of the days' places", () => {
  const sent = (day: number, place: unknown) => ({
    day,
    place,
    note: "sources",
  });

  test("places that keep every rule are fit to send", () => {
    // the fixed list keeps them: far apart, a kind at a time
    const file = { places: PLACES.slice(0, 7).map((p, i) => sent(20 + i, p)) };
    expect(checkPlaces(file)).toEqual([]);
  });

  test("what is not a file of places is said so; each place's own problems with its day", () => {
    expect(checkPlaces({ drafts: [] })).toEqual([
      'the file is not { "places": [...] }',
    ]);
    const problems = checkPlaces({
      places: [
        sent(20, { ...PLACES[0], lat: 0, name: "Стадион" }),
        sent(0, PLACES[1]),
      ],
    });
    expect(problems).toEqual([
      expect.stringMatching(
        /^day 20: name "Стадион" has characters the game cannot draw/,
      ),
      expect.stringMatching(/^day 20: lat must be/),
      "place 2: day must be a day number",
    ]);
  });

  test("a day's place is far from the days either side's and of another kind, in the file or on the desk", () => {
    const wembley = PLACES[0];
    const anfield = PLACES.find((p) => p.id === "anfield") as Place;
    const lagos = PLACES.find((p) => p.id === "lagos") as Place;
    // two stadiums in England, a day apart, in the file
    const near = checkPlaces({
      places: [sent(20, wembley), sent(21, anfield)],
    });
    expect(near).toEqual([
      expect.stringMatching(
        new RegExp(
          `^day 20: .* km from day 21's, ${placeLabel(anfield)}: a day's place is ${APART_KM} km or more`,
        ),
      ),
      "day 20: a stadium, as day 21's is: no two days running of one kind",
    ]);
    // the day before is on the desk
    const desk = checkPlaces({ places: [sent(21, anfield)] }, (day) =>
      day === 20 ? told(wembley) : null,
    );
    expect(desk).toHaveLength(2);
    // far apart, and another kind: fit
    expect(
      checkPlaces({ places: [sent(21, lagos)] }, (day) =>
        day === 20 ? told(wembley) : null,
      ),
    ).toEqual([]);
  });

  test("no place twice: not in the file, nor one used within the last days and the days ahead", () => {
    const twice = checkPlaces({
      places: [sent(20, PLACES[0]), sent(25, PLACES[0])],
    });
    expect(twice.join("\n")).toMatch(/is also day 20's in this file/);
    const used = checkPlaces({ places: [sent(30, PLACES[0])] }, () => null, [
      { day: 12, id: PLACES[0].id },
    ]);
    expect(used).toEqual([
      `day 30: ${PLACES[0].id} is already day 12's place: no place twice within 90 days`,
    ]);
    // sent again for its own day: the same place, no problem
    expect(
      checkPlaces({ places: [sent(12, PLACES[0])] }, () => null, [
        { day: 12, id: PLACES[0].id },
      ]),
    ).toEqual([]);
  });
});
