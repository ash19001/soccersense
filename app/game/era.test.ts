// RETRO and NEXT-GEN: the two modes ranked by an answer's year (`oldest`, `newest`), with
// the real questions. Everything else plays as HOME and AWAY do.

import { describe, expect, it } from "vitest";

import { NEXT_GEN_QUESTIONS, RETRO_QUESTIONS, STADIUMS } from "~/data";
import { questionsFor } from "~/data";

import {
  ERA_MODES,
  isEraMode,
  modeOfPath,
  pairedMode,
  playPath,
} from "./modes";
import { SCORING_SHOTS, revealRows } from "./reveal";
import {
  MODE_RULES,
  RULES,
  isDistanceRule,
  isYearRule,
  rankAnswers,
  rankingYear,
  ruleFor,
  shotsOf,
} from "./scoring";
import { createSession, reduce, tableFor } from "./session";
import type { Session } from "./session";
import { buildShareText, shareCardFor } from "./share";
import { SHOT_ORDER, SHOT_POINTS, shotsFor, standings } from "./shots";
import { statsFor } from "./stats";
import { MODES, type PlayedGame } from "./storage";
import { answer, question } from "./test-fixtures";
import type { EraQuestion, Grade, Mode, Question } from "./types";
import { revealFor, shareInputFor } from "./view";

const STADIUM = STADIUMS[0];
const ERA: readonly EraQuestion[] = [...RETRO_QUESTIONS, ...NEXT_GEN_QUESTIONS];

/** A question by id from a set. */
function find(set: readonly EraQuestion[], id: string): EraQuestion {
  const found = set.find((q) => q.id === id);
  if (!found) throw new Error(`no question ${id}`);
  return found;
}

/** A made-up era question: each answer's name and years, its shot filed by the mode's rule. */
function era(
  mode: "retro" | "nextgen",
  answers: [string, number[]][],
): Question {
  const q = question(
    "made-up",
    answers.map(([name]) => answer(name, 0, 0)),
  );
  const rule = ruleFor(mode);
  const withYears = q.answers.map((a, i) => ({ ...a, years: answers[i][1] }));
  const shots = shotsFor(
    withYears.map((a) => rankingYear(a, rule) ?? 0),
    rule,
  );
  return {
    ...q,
    mode,
    answers: withYears.map((a, i) => ({ ...a, shot: shots[i] })),
  };
}

describe("the modes", () => {
  it("are HOME, AWAY, RETRO and NEXT-GEN, in the menu's order", () => {
    expect(MODES).toEqual(["home", "away", "retro", "nextgen"]);
    expect(ERA_MODES).toEqual(["retro", "nextgen"]);
    expect(MODES.filter(isEraMode)).toEqual(["retro", "nextgen"]);
  });

  it("each have their own rule: oldest for RETRO, newest for NEXT-GEN", () => {
    expect(MODE_RULES).toEqual({
      home: "common",
      away: "niche",
      retro: "oldest",
      nextgen: "newest",
    });
    for (const mode of MODES) expect(ruleFor(mode)).toBe(MODE_RULES[mode]);
    expect(RULES.filter(isYearRule)).toEqual(["oldest", "newest"]);
    expect(RULES.filter(isYearRule).some(isDistanceRule)).toBe(false);
  });

  it("each have their own seven questions, of their own mode, every answer with its years", () => {
    for (const mode of MODES) {
      const set = questionsFor(mode);
      expect(set).toHaveLength(7);
      expect(set.every((q) => q.mode === mode)).toBe(true);
    }
    expect(questionsFor("retro")).toBe(RETRO_QUESTIONS);
    expect(questionsFor("nextgen")).toBe(NEXT_GEN_QUESTIONS);
    for (const q of ERA) {
      for (const a of q.answers) expect(a.years.length).toBeGreaterThan(0);
    }
  });

  it("each have a page and a partner", () => {
    expect(MODES.map(playPath)).toEqual([
      "/play/home",
      "/play/away",
      "/play/retro",
      "/play/next-gen",
    ]);
    for (const mode of MODES) {
      expect(modeOfPath(playPath(mode))).toBe(mode);
      expect(modeOfPath(`${playPath(mode)}/`)).toBe(mode);
      expect(pairedMode(pairedMode(mode))).toBe(mode);
    }
    expect(modeOfPath("/play/nextgen")).toBe("nextgen");
    expect(modeOfPath("/")).toBe("home");
    expect(modeOfPath("/play/nowhere")).toBe("home");
    expect(pairedMode("home")).toBe("away");
    expect(pairedMode("retro")).toBe("nextgen");
  });
});

describe("rankingYear", () => {
  const liverpool = find(RETRO_QUESTIONS, "english-top-flight-champions")
    .answers[5];

  it("is the first year under oldest and the last under newest", () => {
    expect(liverpool.name).toBe("Liverpool");
    expect(rankingYear(liverpool, "oldest")).toBe(1901);
    expect(rankingYear(liverpool, "newest")).toBe(2025);
  });

  it("is null under the other rules and with no years", () => {
    expect(rankingYear(liverpool, "common")).toBeNull();
    expect(rankingYear(liverpool, "closest")).toBeNull();
    const plain = answer("Nobody", 0, 0);
    expect(rankingYear(plain, "oldest")).toBeNull();
    expect(rankingYear({ ...plain, years: [] }, "newest")).toBeNull();
  });
});

describe("standings by year", () => {
  it("puts the earliest year first under oldest and the latest under newest", () => {
    const years = [1990, 1872, 2020, 1950];
    const old = standings(years, "oldest");
    const recent = standings(years, "newest");
    expect(old[1]).toBe(0);
    expect(old[2]).toBe(1);
    expect(recent[2]).toBe(0);
    expect(recent[1]).toBe(1);
  });

  it("measures the gap in years: the same as the distance rules on the same numbers", () => {
    const years = [1888, 1890, 1900, 1950, 1951, 2000, 2024];
    expect(standings(years, "oldest")).toEqual(standings(years, "closest"));
    expect(standings(years, "newest")).toEqual(standings(years, "furthest"));
  });

  it("ties answers from the same year: the same standing, the same shot", () => {
    const years = [1960, 1960, 1964, 1968, 2004, 2004, 2020];
    const s = standings(years, "oldest");
    expect(s[0]).toBe(s[1]);
    expect(s[4]).toBe(s[5]);
    const shots = shotsFor(years, "oldest");
    expect(shots[0]).toBe("worldie");
    expect(shots[1]).toBe("worldie");
    expect(shots[4]).toBe(shots[5]);
    expect(shots.at(-1)).toBe("miss");
  });
});

describe("rankAnswers by year, with the real questions", () => {
  it("RETRO: the first club to win the English top flight is top of the table", () => {
    const q = find(RETRO_QUESTIONS, "english-top-flight-champions");
    const table = rankAnswers(q, STADIUM, "oldest");
    expect(table[0].answer.name).toBe("Preston North End");
    expect(table[0].year).toBe(1889);
    expect(table[0].shot).toBe("worldie");
    expect(table[0].points).toBe(100);
    // A club with many titles counts its first: Liverpool's 1901, not 2025.
    const liverpool = table.find((r) => r.answer.id === "liverpool");
    expect(liverpool?.year).toBe(1901);
    expect(table.at(-1)?.answer.name).toBe("Leicester City");
    expect(table.at(-1)?.shot).toBe("miss");
  });

  it("NEXT-GEN: the most recent Bundesliga champion is top, a club counted by its latest title", () => {
    const q = find(NEXT_GEN_QUESTIONS, "bundesliga-champions");
    const table = rankAnswers(q, STADIUM, "newest");
    expect(table[0].answer.name).toBe("Bayern Munich");
    expect(table[0].year).toBe(2026);
    const bremen = table.find((r) => r.answer.id === "werder-bremen");
    expect(bremen?.year).toBe(2004);
    expect(table.at(-1)?.answer.name).toBe("1860 Munich");
    expect(table.at(-1)?.shot).toBe("miss");
  });

  it.each(ERA.map((q) => [q.mode, q.id, q] as const))(
    "%s %s: best first by shot, then by year, with years never out of order",
    (_mode, _id, q) => {
      const rule = ruleFor(q.mode);
      const table = rankAnswers(q, STADIUM, rule);
      for (let i = 1; i < table.length; i++) {
        const a = table[i - 1];
        const b = table[i];
        expect(SHOT_ORDER.indexOf(a.shot)).toBeLessThanOrEqual(
          SHOT_ORDER.indexOf(b.shot),
        );
        const ay = a.year ?? 0;
        const by = b.year ?? 0;
        if (rule === "oldest") expect(ay).toBeLessThanOrEqual(by);
        else expect(ay).toBeGreaterThanOrEqual(by);
        // The same year is the same shot and the same rank; another year a lower rank.
        if (ay === by) {
          expect(b.shot).toBe(a.shot);
          expect(b.rank).toBe(a.rank);
        } else {
          expect(b.rank).toBe(i + 1);
        }
      }
    },
  );

  it("ties the real RETRO answers from the same year (the first Euros final: 1960)", () => {
    const q = find(RETRO_QUESTIONS, "euro-final-countries");
    const table = rankAnswers(q, STADIUM, "oldest");
    expect(
      table.slice(0, 2).map((r) => [r.answer.name, r.year, r.rank]),
    ).toEqual([
      ["Soviet Union", 1960, 1],
      ["Yugoslavia", 1960, 1],
    ]);
    expect(table[2].rank).toBe(3);
    const hosts = rankAnswers(
      find(RETRO_QUESTIONS, "euro-host-countries"),
      STADIUM,
      "oldest",
    );
    const austria = hosts.find((r) => r.answer.id === "austria");
    const switzerland = hosts.find((r) => r.answer.id === "switzerland");
    expect(austria?.rank).toBe(switzerland?.rank);
    expect(austria?.shot).toBe(switzerland?.shot);
  });

  it("ties the real NEXT-GEN answers from the same year (the 2026 World Cup final)", () => {
    const q = find(NEXT_GEN_QUESTIONS, "world-cup-final-countries");
    const table = rankAnswers(q, STADIUM, "newest");
    expect(
      table.slice(0, 2).map((r) => [r.answer.name, r.rank, r.shot]),
    ).toEqual([
      ["Argentina", 1, "worldie"],
      ["Spain", 1, "worldie"],
    ]);
  });

  it("ranks a made-up question both ways, an answer with no year last", () => {
    const q = era("retro", [
      ["Alpha", [1950, 2000]],
      ["Bravo", [1900]],
      ["Charlie", [2010, 2024]],
    ]);
    const plain = { ...q, answers: [...q.answers, answer("Delta", 0, 0)] };
    const old = rankAnswers(plain, STADIUM, "oldest");
    expect(old.map((r) => r.answer.name)).toEqual([
      "Bravo",
      "Alpha",
      "Charlie",
      "Delta",
    ]);
    expect(old.at(-1)?.year).toBeNull();
    const recent = rankAnswers(plain, STADIUM, "newest");
    expect(recent.map((r) => r.answer.name)).toEqual([
      "Charlie",
      "Alpha",
      "Bravo",
      "Delta",
    ]);
    expect(recent.map((r) => r.year)).toEqual([2024, 2000, 1900, null]);
  });
});

describe("the shots of the era questions", () => {
  it.each(ERA.map((q) => [q.mode, q.id, q] as const))(
    "%s %s: the stored shots are the mode's own rule on the years",
    (_mode, _id, q) => {
      const rule = ruleFor(q.mode);
      const years = q.answers.map((a) => rankingYear(a, rule) ?? 0);
      expect(q.answers.map((a) => a.shot)).toEqual(shotsFor(years, rule));
      // Played in its own mode the table uses them as stored.
      expect(shotsOf(q, STADIUM, rule)).toEqual(q.answers.map((a) => a.shot));
    },
  );

  it("played under the other year rule, the shots are worked out again", () => {
    const q = find(RETRO_QUESTIONS, "english-top-flight-champions");
    const recent = rankAnswers(q, STADIUM, "newest");
    // Liverpool's last title (2025) is among the most recent of the list.
    expect(recent[0].shot).toBe("worldie");
    expect(recent.find((r) => r.answer.id === "preston-north-end")?.shot).toBe(
      "miss",
    );
  });
});

describe("the reveal's rows in the era modes", () => {
  it.each(ERA.map((q) => [q.mode, q.id, q] as const))(
    "%s %s: one row per scoring shot, each the shot's best year",
    (mode, _id, q) => {
      const rule = ruleFor(mode);
      const rows = revealRows(q, mode, { answerId: null }, STADIUM);
      expect(rows.map((r) => r.shot)).toEqual([...SCORING_SHOTS]);
      expect(rows[0].rank).toBe(1);
      for (const row of rows) {
        expect(row.year).toBe(rankingYear(row.answer, rule));
        // No answer of the shot has a better year than the row's.
        const sameShot = q.answers.filter((a) => a.shot === row.shot);
        for (const other of sameShot) {
          const y = rankingYear(other, rule) ?? 0;
          if (rule === "oldest") expect(row.year).toBeLessThanOrEqual(y);
          else expect(row.year).toBeGreaterThanOrEqual(y);
        }
      }
      // The player's own answer takes its shot's row, whichever answer of the shot it is.
      for (const a of q.answers) {
        const mine = revealRows(q, mode, { answerId: a.id }, STADIUM);
        expect(mine.map((r) => r.shot)).toEqual([...SCORING_SHOTS]);
        const you = mine.filter((r) => r.isPlayer);
        expect(you.map((r) => r.answer.id)).toEqual(
          a.shot === "miss" ? [] : [a.id],
        );
      }
    },
  );
});

/** A whole game in a mode, answering each question with the first answer of `shots[i]`. */
function playGame(mode: Mode, shots: readonly Grade[]): Session {
  let s = createSession({
    mode,
    dayNumber: 3,
    stadium: STADIUM,
    questions: questionsFor(mode),
    now: 0,
    noTimer: true,
  });
  shots.forEach((shot, i) => {
    const now = (i + 1) * 10_000;
    const named = s.questions[i].answers.find((a) => a.shot === shot);
    s = named
      ? reduce(s, { type: "submit", input: named.name, now })
      : reduce(s, { type: "pass", now: now + 9000 });
    s = reduce(s, { type: "resolved" });
    s = reduce(s, { type: "next", now: now + 5000 });
  });
  return s;
}

describe("a whole RETRO game and a whole NEXT-GEN game", () => {
  const GRADES: Grade[] = [
    "worldie",
    "golazo",
    "trivela",
    "toepoke",
    "tapin",
    "miss",
    "skipped",
  ];

  it.each(["retro", "nextgen"] as const)(
    "%s scores every shot by its year, and the reveal and the share card carry the years",
    (mode) => {
      const s = playGame(mode, GRADES);
      expect(s.phase).toBe("done");
      expect(s.turns.map((t) => t.grade)).toEqual(GRADES);
      expect(s.total).toBe(100 + 80 + 60 + 30 + 10);
      const rule = ruleFor(mode);
      for (let i = 0; i < 7; i++) {
        const reveal = revealFor(s, i);
        expect(reveal).not.toBeNull();
        expect(reveal?.rows).toHaveLength(5);
        expect(tableFor(s, i).every((r) => r.year !== null)).toBe(true);
        if (reveal?.row) {
          expect(reveal.row.year).toBe(rankingYear(reveal.row.answer, rule));
        }
      }
      // The pass: the top of the table is the oldest (or newest) answer.
      const passed = revealFor(s, 6);
      expect(passed?.answer).toBeNull();
      expect(passed?.best?.rank).toBe(1);

      const card = shareCardFor(s);
      expect(card.mode).toBe(mode);
      expect(card.rows.map((r) => r.year === null)).toEqual([
        false,
        false,
        false,
        false,
        false,
        false,
        true,
      ]);
      expect(card.rows[0].year).toBe(revealFor(s, 0)?.row?.year);
    },
  );

  it("shares under the mode's own name, with no years in the text", () => {
    const s = playGame("nextgen", GRADES);
    const text = buildShareText(
      shareInputFor(s, "LOWER LEAGUES", "ON THE GROUP CHAT", "NEXT-GEN"),
    );
    expect(text.split("\n")[0]).toBe(
      `soccersense #3 · NEXT-GEN · ${STADIUM.name}`,
    );
    expect(text).not.toMatch(/\b(18|19|20)\d\d\b/);
    // Without a label the id in capitals, as it always was for HOME and AWAY.
    expect(
      buildShareText(shareInputFor(playGame("retro", GRADES), "X")).split(
        "\n",
      )[0],
    ).toContain("· RETRO ·");
  });
});

describe("the stats over all four modes", () => {
  function game(day: number, mode: Mode, grades: Grade[]): PlayedGame {
    const points = grades.map((g) => SHOT_POINTS[g]);
    return {
      day,
      mode,
      grades,
      points,
      total: points.reduce((a, b) => a + b, 0),
    };
  }

  it("counts each mode on its own and every game in the totals", () => {
    const games = [
      game(1, "home", Array<Grade>(7).fill("worldie")),
      game(1, "retro", Array<Grade>(7).fill("golazo")),
      game(2, "nextgen", Array<Grade>(7).fill("tapin")),
      game(3, "retro", Array<Grade>(7).fill("miss")),
      game(3, "away", Array<Grade>(7).fill("skipped")),
    ];
    const stats = statsFor(games, 3);
    expect(stats.modes.map((m) => m.mode)).toEqual(MODES);
    expect(stats.played).toBe(5);
    expect(stats.modes.reduce((sum, m) => sum + m.played, 0)).toBe(5);
    const retro = stats.modes.find((m) => m.mode === "retro");
    expect(retro?.played).toBe(2);
    expect(retro?.average).toBe(280);
    expect(retro?.best).toEqual({ total: 560, day: 1 });
    expect(retro?.today?.total).toBe(0);
    expect(retro?.tally.golazo).toBe(7);
    expect(retro?.tally.miss).toBe(7);
    const nextgen = stats.modes.find((m) => m.mode === "nextgen");
    expect(nextgen?.played).toBe(1);
    expect(nextgen?.today).toBeNull();
    expect(nextgen?.tally.tapin).toBe(7);
    // Every answer counted once, in some mode.
    const answers = stats.modes.reduce(
      (sum, m) => sum + Object.values(m.tally).reduce((a, b) => a + b, 0),
      0,
    );
    expect(answers).toBe(35);
    expect(stats.streak).toEqual({ current: 3, best: 3 });
  });
});
