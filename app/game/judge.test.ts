import { describe, expect, it } from "vitest";

import { allowedTypos, editDistance, judge, normalise } from "./judge";
import type { JudgeResult } from "./judge";
import { answer, question } from "./test-fixtures";
import type { Question } from "./types";

const a = (name: string, aliases: string[] = []) => answer(name, 0, 0, aliases);

const PLAYERS = question("players", [
  a("Trent Alexander-Arnold", ["Alexander-Arnold", "TAA", "Trent"]),
  a("Ronaldo", ["Ronaldo Nazário", "R9", "O Fenômeno"]),
  a("Ronaldinho", ["Ronaldinho Gaúcho"]),
  a("Cristiano Ronaldo", ["CR7"]),
  a("Gary Neville"),
  a("Phil Neville"),
  a("Virgil van Dijk"),
  a("Kevin De Bruyne", ["KDB"]),
  a("Łukasz Fabiański"),
  a("Martin Ødegaard"),
  a("Mesut Özil"),
  a("İlkay Gündoğan"),
  a("Antoine Griezmann"),
  a("Sir Alex Ferguson", ["Alex Ferguson", "Fergie"]),
  a("Demba Ba"),
  a("John O'Shea"),
  a("Eiður Guðjohnsen"),
]);

const CLUBS = question("clubs", [
  a("AC Milan", ["Milan", "A.C. Milan"]),
  a("Inter Milan", ["Inter", "Internazionale"]),
  a("Manchester United", ["Man United", "Man Utd"]),
  a("Newcastle United"),
  a("Brighton & Hove Albion", ["Brighton"]),
  a("Paris Saint-Germain", ["PSG"]),
  a("The New Saints", ["TNS"]),
  a("St. Pauli"),
  a("1. FC Köln", ["Cologne"]),
]);

const COUNTRIES = question("countries", [
  a("Austria"),
  a("Australia"),
  a("Niger"),
  a("Nigeria"),
  a("Iran"),
  a("Iraq"),
  a("Trinidad and Tobago"),
  a("Côte d'Ivoire", ["Ivory Coast"]),
  a("South Korea", ["Korea Republic"]),
  a("North Korea", ["Korea DPR"]),
]);

function matched(q: Question, input: string): [string, string] | string {
  const result = judge(q, input);
  return result.kind === "match"
    ? [result.answer.name, result.via]
    : result.kind;
}

function candidates(result: JudgeResult): string[] {
  return result.kind === "ambiguous"
    ? result.candidates.map((c) => c.name)
    : [];
}

describe("normalise", () => {
  it("lower-cases and trims", () => {
    expect(normalise("  Steven GERRARD ")).toBe("steven gerrard");
  });

  it("strips accents", () => {
    expect(normalise("Mesut Özil")).toBe("mesut ozil");
    expect(normalise("Ronaldo Nazário")).toBe("ronaldo nazario");
    expect(normalise("Maracanã")).toBe("maracana");
    expect(normalise("Müller")).toBe("muller");
    expect(normalise("Petr Čech")).toBe("petr cech");
    expect(normalise("Estádio da Luz")).toBe("estadio da luz");
  });

  it("treats composed and decomposed accents alike", () => {
    expect(normalise("José")).toBe("jose");
    expect(normalise("José")).toBe("jose");
  });

  it("maps the letters that do not decompose", () => {
    expect(normalise("Martin Ødegaard")).toBe("martin odegaard");
    expect(normalise("ØDEGAARD")).toBe("odegaard");
    expect(normalise("Łukasz Fabiański")).toBe("lukasz fabianski");
    expect(normalise("Đorđe")).toBe("dorde");
    expect(normalise("Pascal Groß")).toBe("pascal gross");
    expect(normalise("Lærke Sæther")).toBe("laerke saether");
    expect(normalise("Cœur")).toBe("coeur");
    expect(normalise("Diyarbakır")).toBe("diyarbakir");
    expect(normalise("İlkay Gündoğan")).toBe("ilkay gundogan");
    expect(normalise("Eiður Guðjohnsen")).toBe("eidur gudjohnsen");
  });

  it("makes hyphens into spaces", () => {
    const expected = "alexander arnold";
    expect(normalise("Alexander-Arnold")).toBe(expected);
    expect(normalise("alexander arnold")).toBe(expected);
    expect(normalise("Alexander Arnold")).toBe(expected);
    expect(normalise("Alexander–Arnold")).toBe(expected);
    expect(normalise("Alexander - Arnold")).toBe(expected);
    expect(normalise("Paris Saint-Germain")).toBe("paris saint germain");
  });

  it("drops apostrophes", () => {
    expect(normalise("Ballon d'Or")).toBe("ballon dor");
    expect(normalise("ballon dor")).toBe("ballon dor");
    expect(normalise("Ballon d’Or")).toBe("ballon dor");
    expect(normalise("John O'Shea")).toBe("john oshea");
    expect(normalise("N'Golo Kanté")).toBe("ngolo kante");
  });

  it("drops dots and turns commas into spaces", () => {
    expect(normalise("A.C. Milan")).toBe("ac milan");
    expect(normalise("St. Pauli")).toBe("saint pauli");
    expect(normalise("1. FC Köln")).toBe("1 fc koln");
    expect(normalise("Santiago, Chile")).toBe("santiago chile");
    expect(normalise("Santiago,Chile")).toBe("santiago chile");
  });

  it("makes '&', 'and' and nothing at all the same", () => {
    const expected = "brighton hove albion";
    expect(normalise("Brighton & Hove Albion")).toBe(expected);
    expect(normalise("Brighton and Hove Albion")).toBe(expected);
    expect(normalise("Brighton Hove Albion")).toBe(expected);
    expect(normalise("Brighton&Hove Albion")).toBe(expected);
    expect(normalise("Trinidad and Tobago")).toBe("trinidad tobago");
  });

  it("keeps 'and' when it is not joining two words", () => {
    expect(normalise("and")).toBe("and");
    expect(normalise("Andy Cole")).toBe("andy cole");
    expect(normalise("Rio Ferdinand")).toBe("rio ferdinand");
    expect(normalise("and one")).toBe("and one");
    expect(normalise("one and")).toBe("one and");
  });

  it("collapses whitespace", () => {
    expect(normalise("  Sir   Alex\tFerguson\n")).toBe("sir alex ferguson");
  });

  it("drops a leading 'the'", () => {
    expect(normalise("The Hawthorns")).toBe("hawthorns");
    expect(normalise("the  New Saints")).toBe("new saints");
    expect(normalise("Theo Walcott")).toBe("theo walcott");
    expect(normalise("Over the Moon")).toBe("over the moon");
    expect(normalise("the")).toBe("the");
  });

  it("is empty for nothing but spaces and punctuation", () => {
    expect(normalise("")).toBe("");
    expect(normalise("   ")).toBe("");
    expect(normalise(" - . ' , & ")).toBe("");
    expect(normalise("?!")).toBe("");
  });

  it("is stable when applied twice", () => {
    for (const text of [
      "Trent Alexander-Arnold",
      "The Brighton & Hove Albion",
      "Côte d'Ivoire",
      "1. FC Köln",
    ]) {
      expect(normalise(normalise(text))).toBe(normalise(text));
    }
  });
});

describe("editDistance", () => {
  it.each([
    ["", "", 0],
    ["abc", "abc", 0],
    ["", "abc", 3],
    ["abc", "", 3],
    ["kitten", "sitting", 3],
    ["ferguson", "fergusson", 1],
    ["ferguson", "fergusn", 1],
    ["ferguson", "fergason", 1],
    ["ab", "ba", 1],
    ["griezmann", "grizemann", 1],
    ["ronaldo", "ronaldinho", 3],
    ["austria", "australia", 2],
    ["niger", "nigeria", 2],
    // Optimal string alignment: a swapped pair cannot be edited again.
    ["ca", "abc", 3],
  ])("%j to %j is %i", (x, y, expected) => {
    expect(editDistance(x, y)).toBe(expected);
    expect(editDistance(y, x)).toBe(expected);
  });
});

describe("allowedTypos", () => {
  it.each([
    [1, 0],
    [4, 0],
    [5, 1],
    [8, 1],
    [9, 2],
    [30, 2],
  ])("length %i allows %i", (length, typos) => {
    expect(allowedTypos(length)).toBe(typos);
  });
});

describe("judge", () => {
  describe("empty input", () => {
    it.each(["", "   ", "\t\n", "--", "'", "..."])("%j is empty", (input) => {
      expect(judge(PLAYERS, input)).toEqual({ kind: "empty" });
    });
  });

  describe("exact", () => {
    it("matches the name whatever the case", () => {
      expect(matched(PLAYERS, "Gary Neville")).toEqual([
        "Gary Neville",
        "exact",
      ]);
      expect(matched(PLAYERS, "gary neville")).toEqual([
        "Gary Neville",
        "exact",
      ]);
      expect(matched(PLAYERS, "GARY NEVILLE")).toEqual([
        "Gary Neville",
        "exact",
      ]);
      expect(matched(PLAYERS, "  gary   neville ")).toEqual([
        "Gary Neville",
        "exact",
      ]);
    });

    it("returns the question's own answer object", () => {
      const result = judge(PLAYERS, "gary neville");
      expect(result.kind === "match" && result.answer).toBe(PLAYERS.answers[4]);
    });

    it("ignores accents in either direction", () => {
      expect(matched(PLAYERS, "mesut ozil")).toEqual(["Mesut Özil", "exact"]);
      expect(matched(PLAYERS, "Mesut Özil")).toEqual(["Mesut Özil", "exact"]);
      expect(matched(PLAYERS, "martin odegaard")).toEqual([
        "Martin Ødegaard",
        "exact",
      ]);
      expect(matched(PLAYERS, "lukasz fabianski")).toEqual([
        "Łukasz Fabiański",
        "exact",
      ]);
      expect(matched(PLAYERS, "ilkay gundogan")).toEqual([
        "İlkay Gündoğan",
        "exact",
      ]);
      expect(matched(PLAYERS, "Ronaldó")).toEqual(["Ronaldo", "exact"]);
      expect(matched(CLUBS, "1 fc koln")).toEqual(["1. FC Köln", "exact"]);
    });

    it("ignores hyphens", () => {
      for (const input of [
        "Trent Alexander-Arnold",
        "trent alexander arnold",
        "TRENT ALEXANDER - ARNOLD",
      ]) {
        expect(matched(PLAYERS, input)).toEqual([
          "Trent Alexander-Arnold",
          "exact",
        ]);
      }
      expect(matched(CLUBS, "paris saint germain")).toEqual([
        "Paris Saint-Germain",
        "exact",
      ]);
    });

    it("ignores apostrophes", () => {
      for (const input of [
        "Côte d'Ivoire",
        "cote d'ivoire",
        "cote divoire",
        "Cote d’Ivoire",
      ]) {
        expect(matched(COUNTRIES, input)).toEqual(["Côte d'Ivoire", "exact"]);
      }
      expect(matched(PLAYERS, "john oshea")).toEqual(["John O'Shea", "exact"]);
    });

    it("accepts aliases", () => {
      expect(matched(PLAYERS, "TAA")).toEqual([
        "Trent Alexander-Arnold",
        "exact",
      ]);
      expect(matched(PLAYERS, "trent")).toEqual([
        "Trent Alexander-Arnold",
        "exact",
      ]);
      expect(matched(PLAYERS, "alexander arnold")).toEqual([
        "Trent Alexander-Arnold",
        "exact",
      ]);
      expect(matched(PLAYERS, "fergie")).toEqual([
        "Sir Alex Ferguson",
        "exact",
      ]);
      expect(matched(PLAYERS, "alex ferguson")).toEqual([
        "Sir Alex Ferguson",
        "exact",
      ]);
      expect(matched(PLAYERS, "cr7")).toEqual(["Cristiano Ronaldo", "exact"]);
      expect(matched(PLAYERS, "r9")).toEqual(["Ronaldo", "exact"]);
      expect(matched(PLAYERS, "o fenomeno")).toEqual(["Ronaldo", "exact"]);
      expect(matched(COUNTRIES, "ivory coast")).toEqual([
        "Côte d'Ivoire",
        "exact",
      ]);
      expect(matched(CLUBS, "psg")).toEqual(["Paris Saint-Germain", "exact"]);
      expect(matched(CLUBS, "Man Utd")).toEqual(["Manchester United", "exact"]);
    });

    it("ignores 'the', '&' and 'and'", () => {
      expect(matched(CLUBS, "New Saints")).toEqual(["The New Saints", "exact"]);
      expect(matched(CLUBS, "the new saints")).toEqual([
        "The New Saints",
        "exact",
      ]);
      expect(matched(CLUBS, "the brighton")).toEqual([
        "Brighton & Hove Albion",
        "exact",
      ]);
      expect(matched(CLUBS, "brighton and hove albion")).toEqual([
        "Brighton & Hove Albion",
        "exact",
      ]);
      expect(matched(COUNTRIES, "Trinidad & Tobago")).toEqual([
        "Trinidad and Tobago",
        "exact",
      ]);
    });

    it("prefers a full name to another answer's alias", () => {
      const q = question("q", [
        a("Cristiano Ronaldo", ["Ronaldo", "CR7"]),
        a("Ronaldo"),
      ]);
      expect(matched(q, "ronaldo")).toEqual(["Ronaldo", "exact"]);
    });

    it("is ambiguous when two answers share an alias", () => {
      const q = question("q", [
        a("Gary Neville", ["Nev"]),
        a("Steven Gerrard"),
        a("Phil Neville", ["Nev"]),
      ]);
      const result = judge(q, "nev");
      expect(candidates(result)).toEqual(["Gary Neville", "Phil Neville"]);
    });

    it("is ambiguous when two answers share a name", () => {
      const q = question("q", [
        { ...a("Danny Ward"), id: "danny-ward-1" },
        { ...a("Danny Ward"), id: "danny-ward-2" },
      ]);
      expect(judge(q, "danny ward").kind).toBe("ambiguous");
    });
  });

  describe("surname", () => {
    it("matches a surname that only one answer has", () => {
      expect(matched(PLAYERS, "Ferguson")).toEqual([
        "Sir Alex Ferguson",
        "surname",
      ]);
      expect(matched(PLAYERS, "ozil")).toEqual(["Mesut Özil", "surname"]);
      expect(matched(PLAYERS, "Ødegaard")).toEqual([
        "Martin Ødegaard",
        "surname",
      ]);
      expect(matched(PLAYERS, "griezmann")).toEqual([
        "Antoine Griezmann",
        "surname",
      ]);
      expect(matched(PLAYERS, "O'Shea")).toEqual(["John O'Shea", "surname"]);
      expect(matched(PLAYERS, "arnold")).toEqual([
        "Trent Alexander-Arnold",
        "surname",
      ]);
    });

    it("matches a surname of several words", () => {
      expect(matched(PLAYERS, "van Dijk")).toEqual([
        "Virgil van Dijk",
        "surname",
      ]);
      expect(matched(PLAYERS, "dijk")).toEqual(["Virgil van Dijk", "surname"]);
      expect(matched(PLAYERS, "De Bruyne")).toEqual([
        "Kevin De Bruyne",
        "surname",
      ]);
    });

    it("does not match a first name", () => {
      expect(matched(PLAYERS, "gary")).toBe("unknown");
      expect(matched(PLAYERS, "virgil")).toBe("unknown");
      expect(matched(PLAYERS, "virgil van")).toBe("unknown");
    });

    it("needs three characters", () => {
      expect(matched(PLAYERS, "ba")).toBe("unknown");
      expect(matched(PLAYERS, "demba ba")).toEqual(["Demba Ba", "exact"]);
      const q = question("q", [a("Park Ji Sun"), a("Li Xu")]);
      expect(matched(q, "sun")).toEqual(["Park Ji Sun", "surname"]);
      expect(matched(q, "xu")).toBe("unknown");
    });

    it("is ambiguous when several answers share the surname", () => {
      const result = judge(PLAYERS, "Neville");
      expect(result.kind).toBe("ambiguous");
      expect(candidates(result)).toEqual(["Gary Neville", "Phil Neville"]);
      expect(result.kind === "ambiguous" && result.candidates[0]).toBe(
        PLAYERS.answers[4],
      );
      expect(candidates(judge(CLUBS, "united"))).toEqual([
        "Manchester United",
        "Newcastle United",
      ]);
      expect(candidates(judge(COUNTRIES, "korea"))).toEqual([
        "South Korea",
        "North Korea",
      ]);
    });

    it("resolves once the player is specific", () => {
      expect(matched(PLAYERS, "phil neville")).toEqual([
        "Phil Neville",
        "exact",
      ]);
      expect(matched(CLUBS, "newcastle united")).toEqual([
        "Newcastle United",
        "exact",
      ]);
    });

    it("lets a full name beat the same word as another answer's surname", () => {
      // "Ronaldo" is a whole name, and also the last word of "Cristiano Ronaldo".
      expect(matched(PLAYERS, "ronaldo")).toEqual(["Ronaldo", "exact"]);
      expect(matched(PLAYERS, "cristiano ronaldo")).toEqual([
        "Cristiano Ronaldo",
        "exact",
      ]);
    });

    it("lets an alias beat the same word as another answer's surname", () => {
      // "Milan" is AC Milan's alias, and also the last word of "Inter Milan".
      expect(matched(CLUBS, "milan")).toEqual(["AC Milan", "exact"]);
      expect(matched(CLUBS, "inter milan")).toEqual(["Inter Milan", "exact"]);
      expect(matched(CLUBS, "inter")).toEqual(["Inter Milan", "exact"]);
      expect(matched(CLUBS, "ac milan")).toEqual(["AC Milan", "exact"]);
      expect(matched(CLUBS, "A.C. Milan")).toEqual(["AC Milan", "exact"]);
    });
  });

  describe("fuzzy", () => {
    it("forgives one typo in a name of 5 to 8 characters", () => {
      expect(matched(COUNTRIES, "austira")).toEqual(["Austria", "fuzzy"]);
      expect(matched(COUNTRIES, "nigerai")).toEqual(["Nigeria", "fuzzy"]);
      expect(matched(PLAYERS, "ronalda")).toEqual(["Ronaldo", "fuzzy"]);
      expect(matched(PLAYERS, "fergi")).toEqual(["Sir Alex Ferguson", "fuzzy"]);
    });

    it("forgives a missing, extra, wrong or swapped letter", () => {
      expect(matched(PLAYERS, "gary nevile")).toEqual([
        "Gary Neville",
        "fuzzy",
      ]);
      expect(matched(PLAYERS, "gary nevillle")).toEqual([
        "Gary Neville",
        "fuzzy",
      ]);
      expect(matched(PLAYERS, "gary nevelle")).toEqual([
        "Gary Neville",
        "fuzzy",
      ]);
      expect(matched(PLAYERS, "gary nevlile")).toEqual([
        "Gary Neville",
        "fuzzy",
      ]);
    });

    it("forgives typos in a surname", () => {
      expect(matched(PLAYERS, "Fergusson")).toEqual([
        "Sir Alex Ferguson",
        "fuzzy",
      ]);
      expect(matched(PLAYERS, "odegard")).toEqual(["Martin Ødegaard", "fuzzy"]);
      expect(matched(PLAYERS, "grizemann")).toEqual([
        "Antoine Griezmann",
        "fuzzy",
      ]);
      expect(matched(PLAYERS, "van djik")).toEqual([
        "Virgil van Dijk",
        "fuzzy",
      ]);
      expect(matched(PLAYERS, "debruyne")).toEqual([
        "Kevin De Bruyne",
        "fuzzy",
      ]);
    });

    it("forgives typos in an alias", () => {
      expect(matched(PLAYERS, "alexander arnol")).toEqual([
        "Trent Alexander-Arnold",
        "fuzzy",
      ]);
      expect(matched(CLUBS, "internazionle")).toEqual(["Inter Milan", "fuzzy"]);
      expect(matched(COUNTRIES, "ivory cost")).toEqual([
        "Côte d'Ivoire",
        "fuzzy",
      ]);
    });

    it("forgives two typos from 9 characters", () => {
      expect(matched(PLAYERS, "alexandr arnld")).toEqual([
        "Trent Alexander-Arnold",
        "fuzzy",
      ]);
      expect(matched(PLAYERS, "christiano ronldo")).toEqual([
        "Cristiano Ronaldo",
        "fuzzy",
      ]);
      expect(matched(CLUBS, "manchestr untied")).toEqual([
        "Manchester United",
        "fuzzy",
      ]);
    });

    it("forgives no typos under 5 characters", () => {
      expect(matched(COUNTRIES, "irna")).toBe("unknown");
      expect(matched(COUNTRIES, "irak")).toBe("unknown");
      expect(matched(COUNTRIES, "ira")).toBe("unknown");
      expect(matched(PLAYERS, "ozli")).toBe("unknown");
      expect(matched(PLAYERS, "taaa")).toBe("unknown");
      expect(matched(CLUBS, "pzg")).toBe("unknown");
    });

    it("does not forgive more than the allowance", () => {
      expect(matched(PLAYERS, "fergsn")).toBe("unknown");
      expect(matched(PLAYERS, "nevil")).toBe("unknown");
      expect(matched(PLAYERS, "alexandr arnl")).toBe("unknown");
      expect(matched(PLAYERS, "lionel messi")).toBe("unknown");
      expect(matched(COUNTRIES, "germany")).toBe("unknown");
    });

    it("is ambiguous when two answers are equally close", () => {
      // One letter from "niger" and one from "nigeria".
      expect(candidates(judge(COUNTRIES, "nigera"))).toEqual([
        "Niger",
        "Nigeria",
      ]);
      // One letter from "austria" and one from "australia".
      expect(candidates(judge(COUNTRIES, "austrlia"))).toEqual([
        "Austria",
        "Australia",
      ]);
      expect(candidates(judge(PLAYERS, "nevile"))).toEqual([
        "Gary Neville",
        "Phil Neville",
      ]);
      expect(candidates(judge(CLUBS, "untied"))).toEqual([
        "Manchester United",
        "Newcastle United",
      ]);
    });

    it("picks the closer answer when one is nearer", () => {
      expect(matched(COUNTRIES, "australa")).toEqual(["Australia", "fuzzy"]);
      expect(matched(COUNTRIES, "nigerria")).toEqual(["Nigeria", "fuzzy"]);
      expect(matched(PLAYERS, "ronaldino")).toEqual(["Ronaldinho", "fuzzy"]);
      expect(matched(PLAYERS, "ronaldinhio")).toEqual(["Ronaldinho", "fuzzy"]);
    });
  });

  describe("similar names never cross", () => {
    it("Ronaldo and Ronaldinho", () => {
      expect(matched(PLAYERS, "Ronaldo")).toEqual(["Ronaldo", "exact"]);
      expect(matched(PLAYERS, "Ronaldinho")).toEqual(["Ronaldinho", "exact"]);
      const onlyRonaldinho = question("q", [a("Ronaldinho")]);
      expect(matched(onlyRonaldinho, "ronaldo")).toBe("unknown");
      const onlyRonaldo = question("q", [a("Ronaldo"), a("Cristiano Ronaldo")]);
      expect(matched(onlyRonaldo, "ronaldinho")).toBe("unknown");
    });

    it("Milan and Inter Milan", () => {
      expect(matched(CLUBS, "Milan")).toEqual(["AC Milan", "exact"]);
      expect(matched(CLUBS, "Inter Milan")).toEqual(["Inter Milan", "exact"]);
      expect(matched(CLUBS, "inter milano")).toEqual(["Inter Milan", "fuzzy"]);
      expect(matched(CLUBS, "milano")).toEqual(["AC Milan", "fuzzy"]);
      const onlyAc = question("q", [a("AC Milan", ["Milan"])]);
      expect(matched(onlyAc, "inter milan")).toBe("unknown");
      expect(matched(onlyAc, "inter")).toBe("unknown");
    });

    it("Austria and Australia", () => {
      expect(matched(COUNTRIES, "Austria")).toEqual(["Austria", "exact"]);
      expect(matched(COUNTRIES, "Australia")).toEqual(["Australia", "exact"]);
      const onlyAustria = question("q", [a("Austria")]);
      expect(matched(onlyAustria, "australia")).toBe("unknown");
      const onlyAustralia = question("q", [a("Australia")]);
      expect(matched(onlyAustralia, "austria")).toBe("unknown");
    });

    it("Niger and Nigeria", () => {
      expect(matched(COUNTRIES, "Niger")).toEqual(["Niger", "exact"]);
      expect(matched(COUNTRIES, "Nigeria")).toEqual(["Nigeria", "exact"]);
      const onlyNiger = question("q", [a("Niger")]);
      expect(matched(onlyNiger, "nigeria")).toBe("unknown");
      const onlyNigeria = question("q", [a("Nigeria")]);
      expect(matched(onlyNigeria, "niger")).toBe("unknown");
    });

    it("Iran and Iraq", () => {
      expect(matched(COUNTRIES, "iran")).toEqual(["Iran", "exact"]);
      expect(matched(COUNTRIES, "iraq")).toEqual(["Iraq", "exact"]);
    });

    it("an exact name or alias is never read as a typo of another answer", () => {
      const q = question("q", [
        a("Leighton Baines", ["Baines"]),
        a("John Barnes", ["Barnes"]),
        a("Bobby Charlton"),
        a("Jack Charlton", ["Big Jack"]),
        a("Charlton Athletic", ["Charlton"]),
      ]);
      expect(matched(q, "baines")).toEqual(["Leighton Baines", "exact"]);
      expect(matched(q, "barnes")).toEqual(["John Barnes", "exact"]);
      // An alias wins over two surnames.
      expect(matched(q, "charlton")).toEqual(["Charlton Athletic", "exact"]);
    });
  });

  describe("the index", () => {
    it("gives the same result every time", () => {
      const first = judge(PLAYERS, "fergusson");
      const second = judge(PLAYERS, "fergusson");
      expect(second).toEqual(first);
    });

    it("keeps questions apart", () => {
      expect(matched(CLUBS, "ronaldo")).toBe("unknown");
      expect(matched(PLAYERS, "milan")).toBe("unknown");
    });

    it("handles a question with no answers", () => {
      expect(judge(question("none", []), "anyone")).toEqual({
        kind: "unknown",
      });
    });

    it("ignores blank aliases", () => {
      const q = question("q", [a("Pelé", ["", "  ", "-"])]);
      expect(judge(q, "-")).toEqual({ kind: "empty" });
      expect(matched(q, "pele")).toEqual(["Pelé", "exact"]);
    });

    it("stays quick on a long list", () => {
      const many = question(
        "many",
        Array.from({ length: 3000 }, (_, i) =>
          a(`Player${i} Surname${i}`, [`Nick${i}`]),
        ),
      );
      judge(many, "warm up");
      const start = performance.now();
      for (let i = 0; i < 20; i++) judge(many, "playr1234 surname1234");
      expect(matched(many, "playr1234 surname1234")).toEqual([
        "Player1234 Surname1234",
        "fuzzy",
      ]);
      // Generous: this is about catching accidental quadratic work, not benchmarking.
      expect(performance.now() - start).toBeLessThan(2000);
    });
  });
});
