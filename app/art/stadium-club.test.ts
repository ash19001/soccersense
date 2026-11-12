import { describe, expect, it } from "vitest";
import { Surface, hex, shade, toOklab, type Color } from "~/pixel";
import { lightingFor } from "~/art/lighting";
import { P } from "~/art/palette";
import { MenuBackdrop } from "~/art/stadium";
import { paintBowl } from "~/art/stadium-bowl";
import { makeView } from "~/art/stadium-view";
import {
  AWAY_CLEAR,
  DEFAULT_SCHEME,
  SCHEMES,
  clubLight,
  clubOf,
  clubRaw,
  colorDistance,
  schemeById,
  schemeForDay,
  type ClubScheme,
  type Ramp,
} from "~/art/stadium-club";

/** Any blue at all: from sky blue to navy (OKLCH hue 225 to 290 degrees, with some colour). */
function isBlue(c: Color): boolean {
  const [, a, b] = toOklab(c);
  const hue = ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
  return Math.hypot(a, b) > 0.05 && hue >= 225 && hue <= 290;
}

/** White or near it. */
function isWhite(c: Color): boolean {
  const [L, a, b] = toOklab(c);
  return L > 0.85 && Math.hypot(a, b) < 0.04;
}

/** Leans blue at all, however dark or grey: what navy and slate do next to white. */
function leansBlue(c: Color): boolean {
  const [, a, b] = toOklab(c);
  const hue = ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
  return Math.hypot(a, b) > 0.015 && hue >= 225 && hue <= 290;
}

const tones = (r: Ramp): Color[] => [r.dark, r.base, r.light];

describe("club schemes", () => {
  it("has about a dozen, each with its own id", () => {
    expect(SCHEMES.length).toBeGreaterThanOrEqual(10);
    expect(new Set(SCHEMES.map((s) => s.id)).size).toBe(SCHEMES.length);
    expect(DEFAULT_SCHEME.id).toBe("redwhite");
  });

  it("never pairs any blue with white (it must never look like the flag of Israel)", () => {
    // the test's own sense of colour: navy and white are caught
    expect(isBlue(0xff0038b8 as Color) || isBlue(P.skyTop)).toBe(true);
    expect(isWhite(P.white)).toBe(true);
    for (const s of SCHEMES) {
      const own = [...tones(s.main), ...tones(s.second), s.kit.shirt];
      const blue = own.some(isBlue);
      const white = own.some(isWhite);
      expect(blue && white, s.id).toBe(false);
      // blue is never the main colour
      expect(tones(s.main).some(isBlue), s.id).toBe(false);
      // and a white club's visitors are never blue either
      if (white) expect(tones(s.away).some(isBlue), s.id).toBe(false);
    }
  });

  it("gives a club with white no colour that even leans blue (no navy or slate with white)", () => {
    // the test's own sense of it: the old slate charcoal and its blue-grey white are caught
    expect(leansBlue(hex("#43435a"))).toBe(true);
    expect(leansBlue(hex("#b9bccb"))).toBe(true);
    for (const s of SCHEMES) {
      const own = [
        ...tones(s.main),
        ...tones(s.second),
        s.kit.shirt,
        s.kit.shorts,
      ];
      if (!own.some(isWhite)) continue;
      for (const c of own) expect(leansBlue(c), s.id).toBe(false);
    }
  });

  it("keeps the visitors clear of the home colours", () => {
    for (const s of SCHEMES) {
      for (const c of [s.main.base, s.main.light, s.second.base, s.kit.shirt]) {
        expect(colorDistance(c, s.away.base), s.id).toBeGreaterThanOrEqual(
          AWAY_CLEAR,
        );
        expect(colorDistance(c, s.away.light), s.id).toBeGreaterThanOrEqual(
          AWAY_CLEAR,
        );
      }
    }
  });

  it("dresses the home side in a kit that is neither white nor grass", () => {
    for (const s of SCHEMES) {
      expect(isWhite(s.kit.shirt), s.id).toBe(false);
      expect(isWhite(s.kit.shorts), s.id).toBe(false);
      for (const g of [P.grass, P.grassLight, P.grassDark]) {
        expect(colorDistance(s.kit.shirt, g), s.id).toBeGreaterThan(0.1);
      }
      // fireworks are never dark
      expect(toOklab(s.bright.base)[0], s.id).toBeGreaterThan(0.5);
      expect(toOklab(s.spark.base)[0], s.id).toBeGreaterThan(0.5);
    }
  });
});

describe("schemeForDay", () => {
  it("gives every day one, the same each time, never the same two days running", () => {
    for (let d = -40; d < 400; d++) {
      const s = schemeForDay(d);
      expect(SCHEMES).toContain(s);
      expect(schemeForDay(d)).toBe(s);
      expect(schemeForDay(d + 1)).not.toBe(s);
    }
  });

  it("wears every scheme in turn", () => {
    const seen = new Set<string>();
    for (let d = 100; d < 100 + SCHEMES.length; d++) {
      seen.add(schemeForDay(d).id);
    }
    expect(seen.size).toBe(SCHEMES.length);
  });

  it("takes odd days", () => {
    expect(schemeForDay(Number.NaN)).toBe(SCHEMES[0]);
    expect(schemeForDay(Infinity)).toBe(SCHEMES[0]);
    expect(schemeForDay(3.7)).toBe(schemeForDay(3));
    expect(schemeById("nope")).toBe(DEFAULT_SCHEME);
  });
});

describe("clubLight", () => {
  const light = lightingFor({ elevation: 30, morning: false });
  const night = lightingFor({ elevation: -30, morning: false });

  it("grades the HOME ramp as the club's colour and the AWAY ramp as the visitors'", () => {
    for (const s of SCHEMES) {
      for (const l of [light, night]) {
        const c = clubLight(l, s);
        expect(c.env(P.home)).toBe(l.env(s.main.base));
        expect(c.lit(P.homeDark)).toBe(l.lit(s.main.dark));
        expect(c.lit(P.awayLight)).toBe(l.lit(s.away.light));
        expect(c.env(P.grass)).toBe(l.env(P.grass));
        expect(clubOf(c)).toBe(s);
        expect(clubRaw(c)(P.home)).toBe(s.main.base);
        expect(clubRaw(c)(P.gold)).toBe(P.gold);
      }
    }
  });

  it("is cached: the same light and scheme give the same object", () => {
    const s = SCHEMES[3];
    expect(clubLight(light, s)).toBe(clubLight(light, s));
    expect(clubLight(clubLight(light, s), s)).toBe(clubLight(light, s));
    expect(clubOf(light)).toBe(DEFAULT_SCHEME);
  });
});

describe("the stadium in the day's colours", () => {
  const paint = (scheme: ClubScheme | null): Surface => {
    const b = new MenuBackdrop({ seed: 2, sign: { header: "A", text: "B" } });
    if (scheme) b.setScheme(scheme.id);
    const s = new Surface(480, 270);
    b.draw(s, 3);
    return s;
  };

  it("is the same picture for the same scheme, and a different one for another", () => {
    const a = paint(SCHEMES[1]);
    expect(paint(SCHEMES[1]).data).toEqual(a.data);
    const other = paint(SCHEMES[2]);
    let diff = 0;
    for (let i = 0; i < a.data.length; i++) {
      if (a.data[i] !== other.data[i]) diff++;
    }
    expect(diff).toBeGreaterThan(2000);
    // the default is red and white
    expect(paint(null).data).toEqual(paint(DEFAULT_SCHEME).data);
  });

  it("dresses the crowd in the roof's shadow too, not only the sunlit seats", () => {
    const light = lightingFor({ elevation: 45, morning: false });
    // the reds of the stadium as it always was, shaded as the crowd under the roof is
    const red = new Set(
      [P.home, P.homeLight, P.homeDark].map((c) => light.lit(shade(c, -0.3))),
    );
    const reds = (scheme: ClubScheme): number => {
      const l = clubLight(light, scheme);
      const tones = { lit: l.lit, env: l.env, lightsOn: false, sunny: true };
      const bowl = paintBowl(
        makeView(480, 270),
        { ...tones, club: clubOf(l), raw: clubRaw(l) },
        2,
      );
      let n = 0;
      for (const c of bowl.layer.data) if (red.has(c as Color)) n++;
      return n;
    };
    expect(reds(DEFAULT_SCHEME)).toBeGreaterThan(50);
    for (const id of ["purplegold", "yellowgreen", "blackwhite"]) {
      expect(reds(schemeById(id)), id).toBe(0);
    }
  });
});
