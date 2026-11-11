import { describe, expect, it } from "vitest";

import * as game from "./index";

describe("the barrel", () => {
  it("exports every rule the interface needs", () => {
    const functions = [
      // geo
      "distanceKm",
      "usesMiles",
      "formatDistance",
      // scoring
      "rankAnswers",
      "gradeFor",
      "rankedFor",
      "tableExcerpt",
      // judge
      "normalise",
      "judge",
      "editDistance",
      "allowedTypos",
      "typoDistance",
      // career
      "careerFor",
      "tierFor",
      "tiersCrossed",
      "isPerfect",
      // day
      "dayNumber",
      "utcDayKey",
      "dayKeyFor",
      "msUntilNextDay",
      "stadiumForDay",
      "parseOverrides",
      "resolveToday",
      // session
      "createSession",
      "reduce",
      "currentQuestion",
      "currentTurn",
      "isLastQuestion",
      "canPass",
      "msLeft",
      "tableFor",
      "summary",
      // storage
      "storageKey",
      "saveGame",
      "saveSession",
      "loadGame",
      "loadDay",
      "clearGame",
      // share
      "buildShareText",
      // view
      "questionView",
      "clockView",
      "revealFor",
      "progressFor",
      "pips",
      "results",
      "shareInputFor",
    ] as const;
    for (const name of functions) {
      expect(typeof game[name], name).toBe("function");
    }
  });

  it("exports the constants", () => {
    expect(game.QUESTION_MS).toBe(30_000);
    expect(game.PASS_AFTER_MS).toBe(8_000);
    expect(game.MAX_TOTAL).toBe(700);
    expect(game.TIER_STEP).toBe(90);
    expect(game.TOP_TIER).toBe(7);
    expect(game.TIERS).toHaveLength(8);
    expect(game.EPOCH_UTC).toBe(Date.UTC(2026, 10, 10));
    expect(game.MS_PER_DAY).toBe(86_400_000);
    expect(game.EARTH_RADIUS_KM).toBe(6371.0088);
    expect(game.KM_PER_MILE).toBe(1.609344);
    expect(game.STORAGE_PREFIX).toBe("soccersense:v1");
    expect(Object.keys(game.GRADE_SYMBOLS)).toHaveLength(7);
  });

  it("does not export the test fixtures", () => {
    expect(Object.keys(game)).not.toContain("ORIGIN");
    expect(Object.keys(game)).not.toContain("east");
  });

  it("plays a short game end to end", () => {
    const stadiums = [
      {
        id: "anfield",
        name: "Anfield",
        city: "Liverpool",
        country: "England",
        lat: 53.4308,
        lng: -2.9608,
      },
    ];
    const place = (
      id: string,
      name: string,
      lat: number,
      lng: number,
      popularity: number,
    ) => ({
      id,
      name,
      aliases: [],
      place: name,
      country: "",
      lat,
      lng,
      popularity,
    });
    const questions: game.Question[] = [
      {
        id: "managers",
        mode: "home",
        prompt: "Name a manager who has won the Premier League",
        measure: "birthplace",
        measureLabel: "where the manager was born",
        asOf: "2026-11-10",
        answers: [
          place("kenny-dalglish", "Kenny Dalglish", 55.8642, -4.2518, 60),
          place(
            "manuel-pellegrini",
            "Manuel Pellegrini",
            -33.4489,
            -70.6693,
            10,
          ),
          place("jose-mourinho", "José Mourinho", 38.5244, -8.8882, 30),
        ],
      },
    ];
    const now = new Date("2026-11-10T19:45:00Z");
    const today = game.resolveToday(now, "", stadiums);
    let session = game.createSession({
      mode: "home",
      dayNumber: today.dayNumber,
      stadium: today.stadium,
      questions,
      now: now.getTime(),
    });
    session = game.reduce(session, {
      type: "submit",
      input: "dalglish",
      now: now.getTime() + 5000,
    });
    session = game.reduce(session, { type: "resolved" });
    const turn = game.currentTurn(session);
    expect(turn).toMatchObject({
      grade: "worldie",
      points: 100,
      share: 60,
      km: 283,
    });
    expect(game.formatShare(turn?.share ?? 0)).toBe("60%");
    expect(game.formatDistance(turn?.km ?? 0, "en-GB")).toBe("176 miles");
    expect(game.formatDistance(turn?.km ?? 0, "fr-FR")).toBe("283 km");
    const rows = game.tableExcerpt(
      game.tableFor(session, 0),
      "kenny-dalglish",
      5,
    );
    expect(rows.map((r) => [r.answer.name, r.points, r.isPlayer])).toEqual([
      ["Kenny Dalglish", 100, true],
      ["José Mourinho", 50, false],
      ["Manuel Pellegrini", 0, false],
    ]);
    session = game.reduce(session, { type: "next", now: now.getTime() + 9000 });
    expect(session.phase).toBe("done");
    const result = game.summary(session);
    const key = game.utcDayKey(now);
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
    game.saveGame(key, "home", session, storage);
    expect(game.loadGame(key, "home", storage)?.total).toBe(100);
    expect(
      game.buildShareText({
        dayNumber: session.dayNumber,
        mode: session.mode,
        stadiumName: session.stadium.name,
        total: result.total,
        tierName: "SUNDAY LEAGUE",
        grades: result.grades,
      }),
    ).toBe(
      "soccersense #1 · HOME · Anfield\n100/700 · SUNDAY LEAGUE\n\u{1F31F}",
    );
  });
});
