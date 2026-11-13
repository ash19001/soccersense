import { describe, expect, it } from "vitest";

import { signFits, signPlace } from "~/art/stadium-airship";
import { makeView } from "~/art/stadium-view";
import { leaderboardFor, MOCK_FIELD } from "~/data/leaderboard";
import { TITLES, titleFor } from "~/game";
import { strings } from "~/i18n";

import { signMessages } from "./home-sign";

const DAY = 12;

type Mode = "home" | "away" | "retro" | "nextgen";
/** Today's totals: every mode unplayed unless given. */
const day = (scores: Partial<Record<Mode, number>> = {}) => ({
  home: scores.home ?? null,
  away: scores.away ?? null,
  retro: scores.retro ?? null,
  nextgen: scores.nextgen ?? null,
});

describe("the airship's messages", () => {
  it("before a game: a nudge for each mode and how many have played", () => {
    const out = signMessages(DAY, day(), 0);
    expect(out).toEqual([
      { header: "HOME", text: "IS WAITING" },
      { header: "AWAY", text: "IS WAITING" },
      { header: "RETRO", text: "IS WAITING" },
      { header: "NEXT-GEN", text: "IS WAITING" },
      {
        header: "PLAYED TODAY",
        text: leaderboardFor(DAY, "home").total.toLocaleString("en-GB"),
      },
    ]);
  });

  it("a streak still alive from yesterday is shown before the nudges", () => {
    const out = signMessages(DAY, day(), 4);
    expect(out[0]).toEqual({ header: "DAILY STREAK", text: "4 DAYS" });
    expect(signMessages(DAY, day(), 1)[0].text).toBe("1 DAY");
  });

  it("after HOME: its total, the place the leaderboard gives it, its title, the streak, then AWAY", () => {
    const out = signMessages(DAY, day({ home: 360 }), 2);
    const board = leaderboardFor(DAY, "home", 360);
    const rank = board.yourRank as number;
    expect(out.map((m) => m.header)).toEqual([
      "HOME",
      "HOME",
      "",
      "DAILY STREAK",
      "AWAY",
      "RETRO",
      "NEXT-GEN",
      "PLAYED TODAY",
    ]);
    expect(out[0].text).toBe("360 PTS");
    expect(out[1].text).toBe(
      `${rank} OF ${board.total.toLocaleString("en-GB")}`,
    );
    expect(out[2].text).toBe(strings.play.titles.home[titleFor("home", 360)]);
    // the crowd is the leaderboard panel's own count
    expect(out.at(-1)?.text).toBe(board.total.toLocaleString("en-GB"));
  });

  it("after AWAY only, the crowd is AWAY's, as the panel opens on AWAY", () => {
    const out = signMessages(DAY, day({ away: 200 }), 1);
    expect(out.at(-1)?.text).toBe(
      leaderboardFor(DAY, "away", 200).total.toLocaleString("en-GB"),
    );
    expect(
      out.some((m) => m.header === "HOME" && m.text === "IS WAITING"),
    ).toBe(true);
  });

  it("after RETRO only, the crowd is RETRO's; with two played, HOME's", () => {
    expect(signMessages(DAY, day({ retro: 410 }), 0).at(-1)?.text).toBe(
      leaderboardFor(DAY, "retro", 410).total.toLocaleString("en-GB"),
    );
    expect(
      signMessages(DAY, day({ away: 90, nextgen: 300 }), 0).at(-1)?.text,
    ).toBe(leaderboardFor(DAY, "home").total.toLocaleString("en-GB"));
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
      ),
      ...signMessages(DAY, day(), 0),
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
