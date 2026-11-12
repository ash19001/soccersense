import { describe, expect, it } from "vitest";

import { MAX_TOTAL } from "./career";
import { SHOT_POINTS } from "./shots";
import { TITLE_FROM, TITLES, titleFor } from "./titles";

describe("titles", () => {
  it("has ten rungs a mode, from 0 to a perfect 700 alone", () => {
    expect(TITLE_FROM).toEqual([0, 10, 120, 220, 300, 380, 460, 540, 620, 700]);
    for (const mode of ["home", "away"] as const) {
      expect(TITLES[mode]).toHaveLength(10);
      expect(TITLES[mode].map((rung) => rung.from)).toEqual(TITLE_FROM);
      expect(new Set(TITLES[mode].map((rung) => rung.id)).size).toBe(10);
    }
    expect(TITLE_FROM.at(-1)).toBe(MAX_TOTAL);
  });

  it("gives each mode its own titles", () => {
    const home = new Set<string>(TITLES.home.map((rung) => rung.id));
    expect(TITLES.away.some((rung) => home.has(rung.id))).toBe(false);
  });

  it.each([
    [0, "wrongend", "herd"],
    [10, "findingseat", "backpages"],
    [110, "findingseat", "backpages"],
    [120, "turnstile", "highlights"],
    [210, "turnstile", "highlights"],
    [220, "piequeue", "retroshirt"],
    [290, "piequeue", "retroshirt"],
    [300, "seasonticket", "thirdkit"],
    [370, "seasonticket", "thirdkit"],
    [380, "knowschants", "fanzine"],
    [450, "knowschants", "fanzine"],
    [460, "startschants", "lowerleague"],
    [530, "startschants", "lowerleague"],
    [540, "voice", "beforecool"],
    [610, "voice", "beforecool"],
    [620, "whisperer", "deepcuts"],
    [690, "whisperer", "deepcuts"],
    [700, "hivemind", "hipster"],
  ])("gives %i points %s at HOME and %s AWAY", (total, home, away) => {
    expect(titleFor("home", total)).toBe(home);
    expect(titleFor("away", total)).toBe(away);
  });

  it("keeps the top title for a perfect game", () => {
    // The best a game can be without a perfect one: six worldies and a golazo.
    const nearly = SHOT_POINTS.worldie * 6 + SHOT_POINTS.golazo;
    expect(titleFor("home", nearly)).toBe("whisperer");
    expect(titleFor("away", nearly)).toBe("deepcuts");
  });

  it("clamps totals it should never see", () => {
    expect(titleFor("home", -50)).toBe("wrongend");
    expect(titleFor("away", Number.NaN)).toBe("herd");
    expect(titleFor("home", 900)).toBe("hivemind");
    expect(titleFor("away", Number.POSITIVE_INFINITY)).toBe("hipster");
  });
});
