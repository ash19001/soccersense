import { describe, expect, it } from "vitest";

import { signFits, signPlace } from "~/art/stadium-airship";
import { makeView } from "~/art/stadium-view";
import { MOCK_FIELD, mockBoards } from "~/data/leaderboard";
import { type BoardAnswer, TITLES, rankFor, titleFor } from "~/game";
import { strings } from "~/i18n";

import { signMessages } from "./home-sign";

const DAY = 12;

type Mode = "home" | "away" | "retro" | "nextgen" | "closest" | "furthest";
/** Today's totals: every mode unplayed unless given. */
const day = (scores: Partial<Record<Mode, number>> = {}) => ({
  home: scores.home ?? null,
  away: scores.away ?? null,
  retro: scores.retro ?? null,
  nextgen: scores.nextgen ?? null,
  closest: scores.closest ?? null,
  furthest: scores.furthest ?? null,
});

const BOARDS = mockBoards(DAY);

/** The day's boards with a signed-in player on one of them, at the place `points` gives. */
function withYou(mode: Mode, points: number): BoardAnswer {
  const board = BOARDS.modes[mode];
  return {
    ...BOARDS,
    modes: {
      ...BOARDS.modes,
      [mode]: {
        ...board,
        count: board.count + 1,
        you: { rank: rankFor(board.tally, points), points },
      },
    },
  };
}

describe("the airship's messages", () => {
  it("before a game: a nudge for each mode and how many are on the board", () => {
    const out = signMessages(DAY, day(), 0, BOARDS);
    expect(out).toEqual([
      { header: "HOME", text: "IS WAITING" },
      { header: "AWAY", text: "IS WAITING" },
      { header: "RETRO", text: "IS WAITING" },
      { header: "NEXT-GEN", text: "IS WAITING" },
      { header: "CLOSEST", text: "IS WAITING" },
      { header: "FURTHEST", text: "IS WAITING" },
      {
        header: "ON THE BOARD",
        text: BOARDS.modes.home.count.toLocaleString("en-GB"),
      },
    ]);
  });

  it("before the boards have arrived, no count", () => {
    expect(signMessages(DAY, day(), 0, null).map((m) => m.header)).toEqual([
      "HOME",
      "AWAY",
      "RETRO",
      "NEXT-GEN",
      "CLOSEST",
      "FURTHEST",
    ]);
    // nor another day's
    expect(
      signMessages(DAY + 1, day(), 0, BOARDS).some(
        (m) => m.header === "ON THE BOARD",
      ),
    ).toBe(false);
  });

  it("a streak still alive from yesterday is shown before the nudges", () => {
    const out = signMessages(DAY, day(), 4);
    expect(out[0]).toEqual({ header: "DAILY STREAK", text: "4 DAYS" });
    expect(signMessages(DAY, day(), 1)[0].text).toBe("1 DAY");
  });

  it("after HOME, on the board: its total, its place there, its title, the streak, then AWAY", () => {
    const boards = withYou("home", 360);
    const out = signMessages(DAY, day({ home: 360 }), 2, boards);
    const board = boards.modes.home;
    expect(out.map((m) => m.header)).toEqual([
      "HOME",
      "HOME",
      "",
      "DAILY STREAK",
      "AWAY",
      "RETRO",
      "NEXT-GEN",
      "CLOSEST",
      "FURTHEST",
      "ON THE BOARD",
    ]);
    expect(out[0].text).toBe("360 PTS");
    expect(out[1].text).toBe(
      `${board.you?.rank} OF ${board.count.toLocaleString("en-GB")}`,
    );
    expect(out[2].text).toBe(strings.play.titles.home[titleFor("home", 360)]);
    // the crowd is the leaderboard panel's own count
    expect(out.at(-1)?.text).toBe(board.count.toLocaleString("en-GB"));
  });

  it("after HOME with no account: no place on the sign (the panel says where it would be)", () => {
    const out = signMessages(DAY, day({ home: 360 }), 0, BOARDS);
    expect(out.filter((m) => m.header === "HOME").map((m) => m.text)).toEqual([
      "360 PTS",
    ]);
  });

  it("after AWAY only, the crowd is AWAY's, as the panel opens on AWAY", () => {
    const out = signMessages(DAY, day({ away: 200 }), 1, BOARDS);
    expect(out.at(-1)?.text).toBe(
      BOARDS.modes.away.count.toLocaleString("en-GB"),
    );
    expect(
      out.some((m) => m.header === "HOME" && m.text === "IS WAITING"),
    ).toBe(true);
  });

  it("after RETRO only, the crowd is RETRO's; with two played, HOME's", () => {
    expect(signMessages(DAY, day({ retro: 410 }), 0, BOARDS).at(-1)?.text).toBe(
      BOARDS.modes.retro.count.toLocaleString("en-GB"),
    );
    expect(
      signMessages(DAY, day({ away: 90, nextgen: 300 }), 0, BOARDS).at(-1)
        ?.text,
    ).toBe(BOARDS.modes.home.count.toLocaleString("en-GB"));
  });

  it("puts the place out of everyone who played: 37 OF 1,284", () => {
    const words = strings.home.sign;
    expect(words.rank(1, 5)).toBe("1 OF 5");
    expect(words.rank(37, 1284)).toBe("37 OF 1,284");
    expect(words.rank(3, 1000)).toBe("3 OF 1,000");
    expect(words.rank(1891, 1891)).toBe("1891 OF 1,891");
  });

  // Since 2026-11-13 the airship is smaller (the product owner); since the era-art review
  // the words are short enough that nothing scrolls: every message fits whole, as it is.
  it("every message fits the sign without scrolling, on a monitor and a phone", () => {
    const all = [
      ...signMessages(
        DAY,
        day({ home: 0, away: 700, retro: 350, nextgen: 10 }),
        365,
        withYou("away", 700),
      ),
      ...signMessages(DAY, day(), 0, BOARDS),
    ];
    // every title, and the longest rank
    for (const mode of ["home", "away", "retro", "nextgen"] as const) {
      for (const rung of TITLES[mode]) {
        all.push({
          header: "",
          text: strings.play.titles[mode][rung.id as never],
        });
      }
    }
    // the longest place the leaderboard can give: its biggest field with the player
    // counted in, and last
    const most = MOCK_FIELD.max + 1;
    all.push({
      header: "NEXT-GEN",
      text: strings.home.sign.rank(most, most),
    });

    for (const [w, h] of [
      [960, 540],
      [683, 384],
      [768, 432],
      [234, 507],
      [260, 563],
    ]) {
      const panel = signPlace(makeView(w, h)).panel;
      for (const m of all) {
        expect(
          signFits(m, panel.w, panel.h),
          `${m.header} / ${m.text} at ${w}x${h}`,
        ).toBe(true);
      }
      // the fact's header never scrolls
      expect(
        signFits({ header: "DID YOU KNOW?", text: "1889" }, panel.w, panel.h),
      ).toBe(true);
    }
  });
});
