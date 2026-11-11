import { describe, expect, it } from "vitest";

import {
  dayKeyFor,
  dayNumber,
  EPOCH_UTC,
  MS_PER_DAY,
  msUntilNextDay,
  parseOverrides,
  resolveToday,
  stadiumForDay,
  utcDayKey,
} from "./day";
import { stadium } from "./test-fixtures";

const at = (iso: string) => new Date(iso);

const STADIUMS = [stadium("anfield"), stadium("hampden"), stadium("maracana")];

describe("EPOCH_UTC", () => {
  it("is midnight UTC on 10 November 2026", () => {
    expect(EPOCH_UTC).toBe(Date.UTC(2026, 10, 10));
    expect(new Date(EPOCH_UTC).toISOString()).toBe("2026-11-10T00:00:00.000Z");
  });
});

describe("dayNumber", () => {
  it("is 1 for the whole of the epoch day", () => {
    expect(dayNumber(at("2026-11-10T00:00:00.000Z"))).toBe(1);
    expect(dayNumber(at("2026-11-10T12:00:00.000Z"))).toBe(1);
    expect(dayNumber(at("2026-11-10T23:59:59.999Z"))).toBe(1);
  });

  it("changes at midnight UTC", () => {
    expect(dayNumber(at("2026-11-11T00:00:00.000Z"))).toBe(2);
    expect(dayNumber(at("2026-11-11T23:59:59.999Z"))).toBe(2);
    expect(dayNumber(at("2026-11-12T00:00:00.000Z"))).toBe(3);
    expect(dayNumber(new Date(EPOCH_UTC + MS_PER_DAY - 1))).toBe(1);
    expect(dayNumber(new Date(EPOCH_UTC + MS_PER_DAY))).toBe(2);
  });

  it("ignores the player's own time zone", () => {
    // 00:30 on the 11th in Paris is still the 10th in UTC.
    expect(dayNumber(at("2026-11-11T00:30:00+01:00"))).toBe(1);
    // 20:00 on the 10th in New York is already the 11th in UTC.
    expect(dayNumber(at("2026-11-10T20:00:00-05:00"))).toBe(2);
    // The same instant written two ways.
    expect(dayNumber(at("2026-11-12T09:00:00+09:00"))).toBe(
      dayNumber(at("2026-11-12T00:00:00Z")),
    );
  });

  it("is 1 before the epoch", () => {
    expect(dayNumber(new Date(EPOCH_UTC - 1))).toBe(1);
    expect(dayNumber(at("2026-11-09T23:59:59.999Z"))).toBe(1);
    expect(dayNumber(at("2020-01-01T00:00:00Z"))).toBe(1);
    expect(dayNumber(new Date(0))).toBe(1);
  });

  it("is 1 for an invalid date", () => {
    expect(dayNumber(new Date(Number.NaN))).toBe(1);
  });

  it("keeps counting across months and years", () => {
    expect(dayNumber(at("2026-12-01T00:00:00Z"))).toBe(22);
    expect(dayNumber(at("2027-01-01T00:00:00Z"))).toBe(53);
    expect(dayNumber(at("2027-11-10T00:00:00Z"))).toBe(366);
    // 2028 is a leap year.
    expect(dayNumber(at("2028-11-10T00:00:00Z"))).toBe(732);
  });
});

describe("utcDayKey", () => {
  it("is the UTC calendar date", () => {
    expect(utcDayKey(at("2026-11-10T00:00:00.000Z"))).toBe("2026-11-10");
    expect(utcDayKey(at("2026-11-10T23:59:59.999Z"))).toBe("2026-11-10");
    expect(utcDayKey(at("2026-11-11T00:00:00.000Z"))).toBe("2026-11-11");
  });

  it("pads months and days", () => {
    expect(utcDayKey(at("2027-01-05T10:00:00Z"))).toBe("2027-01-05");
  });

  it("ignores the player's own time zone", () => {
    expect(utcDayKey(at("2026-11-11T00:30:00+01:00"))).toBe("2026-11-10");
    expect(utcDayKey(at("2026-12-31T20:00:00-05:00"))).toBe("2027-01-01");
  });

  it("falls back to the epoch day for an invalid date", () => {
    expect(utcDayKey(new Date(Number.NaN))).toBe("2026-11-10");
  });
});

describe("dayKeyFor", () => {
  it("is the date of a day number", () => {
    expect(dayKeyFor(1)).toBe("2026-11-10");
    expect(dayKeyFor(2)).toBe("2026-11-11");
    expect(dayKeyFor(22)).toBe("2026-12-01");
    expect(dayKeyFor(53)).toBe("2027-01-01");
  });

  it("treats anything below 1 as day 1", () => {
    expect(dayKeyFor(0)).toBe("2026-11-10");
    expect(dayKeyFor(-3)).toBe("2026-11-10");
    expect(dayKeyFor(Number.NaN)).toBe("2026-11-10");
  });

  it("agrees with dayNumber and utcDayKey", () => {
    for (const iso of [
      "2026-11-10T00:00:00Z",
      "2026-11-10T23:59:59.999Z",
      "2026-11-11T00:00:00Z",
      "2027-02-28T13:45:00Z",
      "2028-02-29T23:59:59Z",
    ]) {
      expect(dayKeyFor(dayNumber(at(iso)))).toBe(utcDayKey(at(iso)));
    }
  });
});

describe("msUntilNextDay", () => {
  it("counts down to midnight UTC", () => {
    expect(msUntilNextDay(at("2026-11-10T12:00:00.000Z"))).toBe(MS_PER_DAY / 2);
    expect(msUntilNextDay(at("2026-11-10T23:59:59.000Z"))).toBe(1000);
    expect(msUntilNextDay(at("2026-11-10T23:59:59.999Z"))).toBe(1);
  });

  it("is a full day at exactly midnight", () => {
    expect(msUntilNextDay(at("2026-11-10T00:00:00.000Z"))).toBe(MS_PER_DAY);
    expect(msUntilNextDay(at("2026-11-11T00:00:00.000Z"))).toBe(MS_PER_DAY);
  });

  it("lands on the moment the day number changes", () => {
    const now = at("2026-11-14T17:23:45.678Z");
    const next = new Date(now.getTime() + msUntilNextDay(now));
    expect(next.toISOString()).toBe("2026-11-15T00:00:00.000Z");
    expect(dayNumber(next)).toBe(dayNumber(now) + 1);
    expect(dayNumber(new Date(next.getTime() - 1))).toBe(dayNumber(now));
  });

  it("works before 1970 too", () => {
    expect(msUntilNextDay(at("1969-12-31T23:59:59.000Z"))).toBe(1000);
  });
});

describe("stadiumForDay", () => {
  it("starts with the first stadium and cycles", () => {
    expect(stadiumForDay(1, STADIUMS).id).toBe("anfield");
    expect(stadiumForDay(2, STADIUMS).id).toBe("hampden");
    expect(stadiumForDay(3, STADIUMS).id).toBe("maracana");
    expect(stadiumForDay(4, STADIUMS).id).toBe("anfield");
    expect(stadiumForDay(300, STADIUMS).id).toBe("maracana");
  });

  it("always returns the only stadium of a list of one", () => {
    for (const n of [1, 2, 99]) {
      expect(stadiumForDay(n, [STADIUMS[1]])).toBe(STADIUMS[1]);
    }
  });

  it("stays in range for odd day numbers", () => {
    expect(stadiumForDay(0, STADIUMS).id).toBe("maracana");
    expect(stadiumForDay(-1, STADIUMS).id).toBe("hampden");
    expect(stadiumForDay(2.9, STADIUMS).id).toBe("hampden");
    expect(stadiumForDay(Number.NaN, STADIUMS).id).toBe("anfield");
  });

  it("throws on an empty list", () => {
    expect(() => stadiumForDay(1, [])).toThrow(/empty/);
  });
});

describe("parseOverrides", () => {
  it("reads everything from a full query string", () => {
    expect(
      parseOverrides("?stadium=anfield&day=3&time=21:30&notimer=1"),
    ).toEqual({
      stadiumId: "anfield",
      day: 3,
      time: { hours: 21, minutes: 30 },
      noTimer: true,
    });
  });

  it("works without the question mark", () => {
    expect(parseOverrides("day=12&stadium=camp-nou")).toEqual({
      stadiumId: "camp-nou",
      day: 12,
      noTimer: false,
    });
  });

  it("has no overrides for an empty or unrelated query", () => {
    expect(parseOverrides("")).toEqual({ noTimer: false });
    expect(parseOverrides("?")).toEqual({ noTimer: false });
    expect(parseOverrides("?utm_source=share&x=1")).toEqual({ noTimer: false });
  });

  it("tidies the stadium id and ignores a malformed one", () => {
    expect(parseOverrides("?stadium=Anfield").stadiumId).toBe("anfield");
    expect(parseOverrides("?stadium=%20san-siro%20").stadiumId).toBe(
      "san-siro",
    );
    expect(parseOverrides("?stadium=").stadiumId).toBeUndefined();
    expect(parseOverrides("?stadium=an%20field").stadiumId).toBeUndefined();
    expect(parseOverrides("?stadium=<script>").stadiumId).toBeUndefined();
    expect(parseOverrides("?stadium=-anfield").stadiumId).toBeUndefined();
  });

  it("ignores an invalid day", () => {
    for (const bad of ["0", "-1", "abc", "1.5", "", "3rd", "1e3", "99999999"]) {
      expect(parseOverrides(`?day=${bad}`)).toEqual({ noTimer: false });
    }
    expect(parseOverrides("?day=1").day).toBe(1);
    expect(parseOverrides("?day=007").day).toBe(7);
    expect(parseOverrides("?day=365").day).toBe(365);
  });

  it("reads a 24 hour time and ignores an invalid one", () => {
    expect(parseOverrides("?time=00:00").time).toEqual({
      hours: 0,
      minutes: 0,
    });
    expect(parseOverrides("?time=7:05").time).toEqual({ hours: 7, minutes: 5 });
    expect(parseOverrides("?time=23:59").time).toEqual({
      hours: 23,
      minutes: 59,
    });
    expect(parseOverrides("?time=21%3A30").time).toEqual({
      hours: 21,
      minutes: 30,
    });
    for (const bad of ["24:00", "12:60", "9:5", "noon", "21", "21:30:00", ""]) {
      expect(parseOverrides(`?time=${bad}`).time).toBeUndefined();
    }
  });

  it("turns the timer off only when asked", () => {
    expect(parseOverrides("?notimer=1").noTimer).toBe(true);
    expect(parseOverrides("?notimer=true").noTimer).toBe(true);
    expect(parseOverrides("?notimer").noTimer).toBe(true);
    expect(parseOverrides("?notimer=0").noTimer).toBe(false);
    expect(parseOverrides("?notimer=false").noTimer).toBe(false);
    expect(parseOverrides("?notimer=maybe").noTimer).toBe(false);
    expect(parseOverrides("?timer=1").noTimer).toBe(false);
  });

  it("keeps the valid values when others are invalid", () => {
    expect(parseOverrides("?stadium=hampden&day=zero&time=99:99")).toEqual({
      stadiumId: "hampden",
      noTimer: false,
    });
  });
});

describe("resolveToday", () => {
  it("uses the clock when there are no overrides", () => {
    expect(
      resolveToday(at("2026-11-10T08:00:00Z"), "", STADIUMS),
    ).toMatchObject({
      dayNumber: 1,
      stadium: STADIUMS[0],
    });
    expect(
      resolveToday(at("2026-11-11T08:00:00Z"), "", STADIUMS),
    ).toMatchObject({
      dayNumber: 2,
      stadium: STADIUMS[1],
    });
    expect(
      resolveToday(at("2026-11-13T00:00:00Z"), "?x=1", STADIUMS),
    ).toMatchObject({
      dayNumber: 4,
      stadium: STADIUMS[0],
    });
  });

  it("changes stadium at midnight UTC", () => {
    const before = resolveToday(at("2026-11-10T23:59:59.999Z"), "", STADIUMS);
    const after = resolveToday(at("2026-11-11T00:00:00.000Z"), "", STADIUMS);
    expect(before.stadium.id).toBe("anfield");
    expect(after.stadium.id).toBe("hampden");
  });

  it("lets ?day pick the day and its stadium", () => {
    expect(
      resolveToday(at("2026-11-10T08:00:00Z"), "?day=3", STADIUMS),
    ).toMatchObject({
      dayNumber: 3,
      stadium: STADIUMS[2],
    });
  });

  it("lets ?stadium pin the stadium without changing the day", () => {
    expect(
      resolveToday(at("2026-11-10T08:00:00Z"), "?stadium=maracana", STADIUMS),
    ).toMatchObject({ dayNumber: 1, stadium: STADIUMS[2] });
  });

  it("applies both together", () => {
    expect(
      resolveToday(
        at("2026-11-10T08:00:00Z"),
        "?stadium=anfield&day=2",
        STADIUMS,
      ),
    ).toMatchObject({ dayNumber: 2, stadium: STADIUMS[0] });
  });

  it("ignores a stadium it does not know", () => {
    expect(
      resolveToday(at("2026-11-11T08:00:00Z"), "?stadium=wembley", STADIUMS),
    ).toMatchObject({ dayNumber: 2, stadium: STADIUMS[1] });
  });
});
