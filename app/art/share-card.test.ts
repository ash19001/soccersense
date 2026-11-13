import { describe, expect, it } from "vitest";

import {
  AWAY_QUESTIONS,
  HOME_QUESTIONS,
  NEXT_GEN_QUESTIONS,
  RETRO_QUESTIONS,
} from "~/data";
import { type Grade, SHOT_ORDER, isShot, rankingYear, ruleFor } from "~/game";
import { strings } from "~/i18n";
import { TRANSPARENT, font10x14, font6x10, measureText } from "~/pixel";
import { GRADE_COLORS, MODE_COLORS, P } from "./palette";
import {
  SHARE_CARD,
  type ShareCardPicture,
  answerFace,
  answerRoom,
  fitText,
  paintShareCard,
  promptRoom,
  scaleSurface,
  yearPlace,
} from "./share-card";

const QUESTIONS = [...HOME_QUESTIONS, ...AWAY_QUESTIONS];

function tagFor(grade: Grade): string {
  if (isShot(grade)) return strings.play.shots[grade];
  return grade === "timeup"
    ? strings.play.yours.timeup
    : strings.play.yours.skipped;
}

function picture(over: Partial<ShareCardPicture> = {}): ShareCardPicture {
  const grades: Grade[] = [
    "worldie",
    "golazo",
    "trivela",
    "toepoke",
    "tapin",
    "miss",
    "skipped",
  ];
  return {
    mode: "home",
    modeLabel: "HOME",
    dayLabel: "DAY 12",
    stadium: "Anfield",
    lines: grades.map((grade, i) => ({
      prompt: strings.play.fullTime.image.prompt(HOME_QUESTIONS[i].prompt),
      answer:
        grade === "skipped"
          ? null
          : (HOME_QUESTIONS[i].answers.find((a) => a.shot === grade)?.name ??
            "Somebody"),
      grade,
      points:
        { worldie: 100, golazo: 80, trivela: 60, toepoke: 30 }[
          grade as string
        ] ?? (grade === "tapin" ? 10 : 0),
      tag: tagFor(grade),
    })),
    noAnswer: "no answer",
    total: 280,
    maxTotal: 700,
    title: "PIE QUEUE REGULAR",
    tier: "LOWER LEAGUES",
    site: "soccersense",
    seed: 12,
    ...over,
  };
}

function colours(s: { data: Uint32Array }): Set<number> {
  return new Set(s.data);
}

describe("paintShareCard", () => {
  it("paints the whole card, at its own size", () => {
    const card = paintShareCard(picture());
    expect([card.w, card.h]).toEqual([SHARE_CARD.w, SHARE_CARD.h]);
    expect(card.data.every((c) => c !== TRANSPARENT)).toBe(true);
  });

  it("is shared at a whole-number scale: 1080 x 1350, portrait", () => {
    expect(SHARE_CARD.w * SHARE_CARD.scale).toBe(1080);
    expect(SHARE_CARD.h * SHARE_CARD.scale).toBe(1350);
  });

  it("paints the same picture every time", () => {
    const a = paintShareCard(picture());
    const b = paintShareCard(picture());
    expect(b.data).toEqual(a.data);
  });

  it("shows the mode in its badge colour, and each shot in its grade colour", () => {
    for (const mode of ["home", "away", "retro", "nextgen"] as const) {
      const seen = colours(
        paintShareCard(
          picture({ mode, modeLabel: strings.home.modes[mode].label }),
        ),
      );
      expect(seen.has(MODE_COLORS[mode].base)).toBe(true);
      // The title in the mode's light colour.
      expect(seen.has(MODE_COLORS[mode].light)).toBe(true);
    }
    const seen = colours(paintShareCard(picture()));
    for (const grade of SHOT_ORDER) {
      expect(seen.has(GRADE_COLORS[grade])).toBe(true);
    }
    expect(seen.has(GRADE_COLORS.skipped)).toBe(true);
  });

  it("lights the score in amber, and in gold on a perfect game", () => {
    const plain = colours(paintShareCard(picture()));
    expect(plain.has(P.amber)).toBe(true);
    const perfect = paintShareCard(
      picture({
        total: 700,
        perfect: "PERFECT GAME",
        lines: picture().lines.map((l) => ({
          ...l,
          grade: "worldie",
          points: 100,
          tag: tagFor("worldie"),
        })),
      }),
    );
    expect(colours(perfect).has(P.gold)).toBe(true);
    expect(colours(perfect).has(P.goldDark)).toBe(true);
  });

  it("paints a game with no answer at all", () => {
    const grades: Grade[] = ["miss", "skipped", "timeup"];
    const card = paintShareCard(
      picture({
        total: 0,
        title: "ONE OF THE HERD",
        tier: "PARK KICKABOUT",
        lines: picture().lines.map((l, i) => {
          const grade = grades[i % 3];
          return {
            ...l,
            grade,
            answer: grade === "miss" ? l.answer : null,
            points: 0,
            tag: tagFor(grade),
          };
        }),
      }),
    );
    expect(colours(card).has(GRADE_COLORS.miss)).toBe(true);
    expect(colours(card).has(GRADE_COLORS.timeup)).toBe(true);
  });

  it("survives words far too long for it", () => {
    const long = "Supercalifragilistic ".repeat(8).trim();
    const card = paintShareCard(
      picture({
        stadium: long,
        title: long,
        lines: picture().lines.map((l) => ({
          ...l,
          prompt: long,
          answer: long,
        })),
      }),
    );
    expect(card.w).toBe(SHARE_CARD.w);
    expect(card.data.every((c) => c !== TRANSPARENT)).toBe(true);
  });
});

describe("fitting the words", () => {
  const small = { font: font6x10() };

  it("leaves a line that fits as it is", () => {
    expect(fitText("MEN'S BALLON D'OR WINNER", 400, small)).toBe(
      "MEN'S BALLON D'OR WINNER",
    );
  });

  it("cuts a long line at a word, and says so", () => {
    const text = "Club that won the European Cup or Champions League";
    const cut = fitText(text, 200, small);
    expect(cut.endsWith("...")).toBe(true);
    expect(measureText(cut, small)).toBeLessThanOrEqual(200);
    expect(text.startsWith(cut.slice(0, -3))).toBe(true);
    expect(cut).not.toMatch(/ \.\.\.$/);
  });

  it("cuts one long word at a letter", () => {
    const cut = fitText("Mönchengladbachmönchengladbach", 80, small);
    expect(cut.endsWith("...")).toBe(true);
    expect(measureText(cut, small)).toBeLessThanOrEqual(80);
  });

  it("sets an answer big, small if it must, and cut short only if even that is too wide", () => {
    expect(answerFace("Brazil", 200).opts.font).toBe(font10x14());
    const wide = answerFace("Pierre-Emerick Aubameyang", 200);
    expect(wide.opts.font).toBe(font6x10());
    expect(wide.text).toBe("Pierre-Emerick Aubameyang");
    const cut = answerFace("International Stadium Yokohama", 150);
    expect(cut.text.endsWith("...")).toBe(true);
  });

  it("has room for every answer in the demo, whole, beside its own shot's tag", () => {
    const cut: string[] = [];
    for (const q of QUESTIONS) {
      for (const a of q.answers) {
        const face = answerFace(a.name, answerRoom(tagFor(a.shot)));
        if (face.text !== a.name) cut.push(a.name);
      }
    }
    // The one name too long even in the small face: a deep cut, rarely given.
    expect(cut).toEqual(["International Stadium Yokohama"]);
  });

  it("has room for every RETRO and NEXT-GEN answer, whole, with its year beside it or above", () => {
    const cut: string[] = [];
    const above = new Set<string>();
    for (const q of [...RETRO_QUESTIONS, ...NEXT_GEN_QUESTIONS]) {
      for (const a of q.answers) {
        const year = String(rankingYear(a, ruleFor(q.mode)));
        const tag = tagFor(a.shot);
        const place = yearPlace(a.name, tag, year);
        if (place === "above") above.add(a.name);
        const room = answerRoom(tag, place === "beside" ? year : undefined);
        if (answerFace(a.name, room).text !== a.name) cut.push(a.name);
      }
    }
    expect(cut).toEqual([]);
    // Only the two longest names send their year up to the question's line.
    expect([...above]).toEqual([
      "Wolverhampton Wanderers",
      "Inverness Caledonian Thistle",
    ]);
  });

  it("paints an era answer's year in the mode's light colour, before the tag", () => {
    const lines = picture().lines.map((line) => ({ ...line, year: "1889" }));
    const plain = paintShareCard(
      picture({ mode: "retro", modeLabel: "RETRO" }),
    );
    const dated = paintShareCard(
      picture({ mode: "retro", modeLabel: "RETRO", lines }),
    );
    expect(dated.data).not.toEqual(plain.data);
    // Only the rows changed: the year sits on the answer's line, left of the tag.
    const count = (s: typeof plain) => {
      let n = 0;
      for (let i = 0; i < s.data.length; i++) {
        if (s.data[i] === MODE_COLORS.retro.light) n++;
      }
      return n;
    };
    expect(count(dated)).toBeGreaterThan(count(plain));
  });

  it("keeps every demo question to one line, most of them whole", () => {
    const small6 = { font: font6x10() };
    let whole = 0;
    for (const q of QUESTIONS) {
      const short = strings.play.fullTime.image.prompt(q.prompt);
      const fitted = fitText(short, promptRoom(), small6);
      expect(measureText(fitted, small6)).toBeLessThanOrEqual(promptRoom());
      if (fitted === short) whole++;
    }
    expect(whole).toBeGreaterThanOrEqual(QUESTIONS.length - 6);
  });
});

describe("scaleSurface", () => {
  it("makes every pixel a whole block", () => {
    const card = paintShareCard(picture());
    const big = scaleSurface(card, 3);
    expect([big.w, big.h]).toEqual([1080, 1350]);
    for (const [x, y] of [
      [0, 0],
      [17, 93],
      [200, 300],
      [359, 449],
    ]) {
      const c = card.get(x, y);
      for (let dy = 0; dy < 3; dy++) {
        for (let dx = 0; dx < 3; dx++) {
          expect(big.get(x * 3 + dx, y * 3 + dy)).toBe(c);
        }
      }
    }
  });

  it("treats a scale under 1 as 1", () => {
    const card = paintShareCard(picture());
    expect(scaleSurface(card, 0).data).toEqual(card.data);
  });
});
