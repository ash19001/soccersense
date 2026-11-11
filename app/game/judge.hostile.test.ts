/**
 * Hostile inputs for the judge. Three rules are checked against lists of similar names:
 * no wrong matches, sensible short forms match, and ambiguity is reported, never guessed.
 */
import { describe, expect, it } from "vitest";

import { judge, normalise, typoDistance } from "./judge";
import { answer, question } from "./test-fixtures";
import type { Question } from "./types";

const a = (name: string, aliases: string[] = []) => answer(name, 0, 0, aliases);

const PEOPLE = question(
  "people",
  [
    a("Ronaldo", ["Ronaldo Nazário", "R9"]),
    a("Ronaldinho", ["Ronaldinho Gaúcho"]),
    a("Rivaldo"),
    a("Cristiano Ronaldo", ["CR7", "Cristiano"]),
    a("Thomas Müller"),
    a("Gerd Müller", ["Der Bomber"]),
    a("Bobby Charlton"),
    a("Jack Charlton"),
    a("Jimmy Floyd Hasselbaink"),
    a("Allan Saint-Maximin"),
  ],
  "home",
  "birthplace",
);

const CLUBS = question(
  "clubs",
  [
    a("AC Milan", ["Milan"]),
    a("Inter Milan", ["Inter", "Internazionale"]),
    a("Real Madrid", ["Real"]),
    a("Atlético Madrid", ["Atletico", "Atleti"]),
    a("Manchester United", ["Man Utd", "Man U"]),
    a("Manchester City", ["Man City"]),
    a("Leeds United"),
    a("São Paulo"),
    a("Saint-Étienne", ["ASSE"]),
    a("Racing Club", ["Racing"]),
    a("Porto"),
  ],
  "home",
  "ground",
);

const COUNTRIES: Question = {
  ...question(
    "countries",
    [
      a("Austria"),
      a("Australia"),
      a("Niger"),
      a("Nigeria"),
      a("United States", ["USA", "US", "America", "United States of America"]),
      a("Côte d'Ivoire", ["Ivory Coast"]),
      a("South Korea", ["Korea Republic"]),
      a("Equatorial Guinea"),
      a("Iceland"),
      a("Zambia"),
    ],
    "home",
    "capital",
  ),
  decoys: ["Ireland"],
};

const STADIUMS = question(
  "stadiums",
  [
    a("Wembley Stadium", ["Wembley"]),
    a("Hampden Park", ["Hampden"]),
    a("Ernst-Happel-Stadion"),
    a("Stadio Olimpico"),
    a("Estadio Azteca"),
    a("Santiago Bernabéu"),
    a("Maracanã"),
    a("Allianz Arena"),
    a("Rose Bowl"),
    a("Stade de France"),
  ],
  "home",
  "location",
);

/** "= Name" for a match, "? A | B" for ambiguous, otherwise the kind. */
function outcome(q: Question, input: string): string {
  const result = judge(q, input);
  if (result.kind === "match") return `= ${result.answer.name}`;
  if (result.kind === "ambiguous") {
    return `? ${result.candidates.map((c) => c.name).join(" | ")}`;
  }
  return result.kind;
}

type Case = [input: string, expected: string];

const PEOPLE_CASES: Case[] = [
  // The three R's.
  ["Ronaldo", "= Ronaldo"],
  ["RONALDO", "= Ronaldo"],
  ["  ronaldo  ", "= Ronaldo"],
  ["Ronaldó", "= Ronaldo"],
  ["Ｒｏｎａｌｄｏ", "= Ronaldo"],
  ["Ronal​do", "= Ronaldo"],
  ["Ronaldinho", "= Ronaldinho"],
  ["Rivaldo", "= Rivaldo"],
  ["Cristiano Ronaldo", "= Cristiano Ronaldo"],
  ["Cristiano", "= Cristiano Ronaldo"],
  ["CR7", "= Cristiano Ronaldo"],
  ["R9", "= Ronaldo"],
  ["Ronaldo Nazario", "= Ronaldo"],
  ["ronaldinho gaucho", "= Ronaldinho"],
  ["C Ronaldo", "= Cristiano Ronaldo"],
  ["C. Ronaldo", "= Cristiano Ronaldo"],
  ["Christiano Ronaldo", "= Cristiano Ronaldo"],
  ["ronaldino", "= Ronaldinho"],
  ["ronaldhino", "= Ronaldinho"],
  ["ronalod", "= Ronaldo"],
  ["ronaldoo", "= Ronaldo"],
  ["rivalda", "= Rivaldo"],
  // One letter from two of them: say so.
  ["rinaldo", "? Ronaldo | Rivaldo"],
  ["rovaldo", "? Ronaldo | Rivaldo"],
  // Not close enough to anything, or close only with a different first letter.
  ["Ronaldo Cristiano", "unknown"],
  ["donaldo", "unknown"],
  ["nivaldo", "unknown"],
  ["CR9", "unknown"],
  ["ron", "unknown"],
  ["R", "unknown"],
  // Two Müllers.
  ["Muller", "? Thomas Müller | Gerd Müller"],
  ["Müller", "? Thomas Müller | Gerd Müller"],
  ["MÜLLER", "? Thomas Müller | Gerd Müller"],
  ["Mueller", "? Thomas Müller | Gerd Müller"],
  ["Muler", "? Thomas Müller | Gerd Müller"],
  ["Thomas Muller", "= Thomas Müller"],
  ["Thomas Müller", "= Thomas Müller"],
  ["Gerd Müller", "= Gerd Müller"],
  ["gerd muller", "= Gerd Müller"],
  ["T Muller", "= Thomas Müller"],
  ["T. Müller", "= Thomas Müller"],
  ["G Muller", "= Gerd Müller"],
  ["Thomas Mueller", "= Thomas Müller"],
  ["Tomas Muller", "= Thomas Müller"],
  ["Gerd Muler", "= Gerd Müller"],
  ["Der Bomber", "= Gerd Müller"],
  ["Thomas", "unknown"],
  ["Gerd", "unknown"],
  ["X Muller", "unknown"],
  ["Herd Muller", "unknown"],
  ["Thomas Gerd Muller", "unknown"],
  // Two Charltons, and a title.
  ["Charlton", "? Bobby Charlton | Jack Charlton"],
  ["Sir Charlton", "? Bobby Charlton | Jack Charlton"],
  ["B Charlton", "= Bobby Charlton"],
  ["J. Charlton", "= Jack Charlton"],
  ["Sir Bobby Charlton", "= Bobby Charlton"],
  ["Bobby", "unknown"],
  // Longer names.
  ["Hasselbaink", "= Jimmy Floyd Hasselbaink"],
  ["Floyd Hasselbaink", "= Jimmy Floyd Hasselbaink"],
  ["J Hasselbaink", "= Jimmy Floyd Hasselbaink"],
  ["Jimmy Hasselbaink", "= Jimmy Floyd Hasselbaink"],
  ["Floyd Jimmy Hasselbaink", "unknown"],
  ["John Hasselbaink", "unknown"],
  ["Saint-Maximin", "= Allan Saint-Maximin"],
  ["St Maximin", "= Allan Saint-Maximin"],
  ["Maximin", "= Allan Saint-Maximin"],
  ["Allan St. Maximin", "= Allan Saint-Maximin"],
];

const CLUB_CASES: Case[] = [
  // Milan, Inter Milan, AC Milan.
  ["Milan", "= AC Milan"],
  ["AC Milan", "= AC Milan"],
  ["A.C. Milan", "= AC Milan"],
  ["ac milan fc", "= AC Milan"],
  ["Milano", "= AC Milan"],
  ["Inter Milan", "= Inter Milan"],
  ["Inter", "= Inter Milan"],
  ["Internazionale", "= Inter Milan"],
  ["Inter Milano", "= Inter Milan"],
  ["FC Internazionale", "= Inter Milan"],
  ["Inter Miami", "unknown"],
  ["Enter", "unknown"],
  // Real Madrid, Atlético Madrid.
  ["Madrid", "? Real Madrid | Atlético Madrid"],
  ["Real Madrid", "= Real Madrid"],
  ["Real", "= Real Madrid"],
  ["Real Madrid CF", "= Real Madrid"],
  ["Atletico Madrid", "= Atlético Madrid"],
  ["Atlético", "= Atlético Madrid"],
  ["Athletico Madrid", "= Atlético Madrid"],
  ["Real Madird", "= Real Madrid"],
  ["Real Betis", "unknown"],
  ["Real Sociedad", "unknown"],
  // Manchester United, Manchester City, Man Utd, Man City.
  ["Manchester United", "= Manchester United"],
  ["Manchester Utd", "= Manchester United"],
  ["Man Utd", "= Manchester United"],
  ["Man United", "= Manchester United"],
  ["Man U", "= Manchester United"],
  ["Manchester United FC", "= Manchester United"],
  ["Manchester City", "= Manchester City"],
  ["Man City", "= Manchester City"],
  ["Man Cty", "= Manchester City"],
  ["City", "= Manchester City"],
  ["Manchester Untied", "= Manchester United"],
  ["Manchestr Citi", "= Manchester City"],
  ["United", "? Manchester United | Leeds United"],
  ["Utd", "? Manchester United | Leeds United"],
  ["Untied", "? Manchester United | Leeds United"],
  ["Manchester", "unknown"],
  ["Man", "unknown"],
  ["Manchester Unity", "unknown"],
  ["Leeds United", "= Leeds United"],
  ["Leeds Utd", "= Leeds United"],
  ["Newcastle United", "unknown"],
  // São Paulo.
  ["Sao Paulo", "= São Paulo"],
  ["São Paulo", "= São Paulo"],
  ["SAO PAULO FC", "= São Paulo"],
  ["Sao Paolo", "= São Paulo"],
  ["San Paulo", "= São Paulo"],
  ["Paulo", "= São Paulo"],
  ["Sao", "unknown"],
  // St Etienne and Saint-Etienne.
  ["Saint-Étienne", "= Saint-Étienne"],
  ["Saint-Etienne", "= Saint-Étienne"],
  ["Saint Etienne", "= Saint-Étienne"],
  ["St Etienne", "= Saint-Étienne"],
  ["St. Étienne", "= Saint-Étienne"],
  ["St-Etienne", "= Saint-Étienne"],
  ["St Etiene", "= Saint-Étienne"],
  ["Etienne", "= Saint-Étienne"],
  ["ASSE", "= Saint-Étienne"],
  ["Saint", "unknown"],
  // Generic words and optional words.
  ["Club", "unknown"],
  ["FC", "unknown"],
  ["Racing", "= Racing Club"],
  ["Racing Club", "= Racing Club"],
  ["FC Porto", "= Porto"],
  ["Porto FC", "= Porto"],
  ["FC Portp", "= Porto"],
  ["AFC Porto", "unknown"],
];

const COUNTRY_CASES: Case[] = [
  // Austria, Australia.
  ["Austria", "= Austria"],
  ["Australia", "= Australia"],
  ["austrlia", "? Austria | Australia"],
  ["Austalia", "= Australia"],
  ["Australa", "= Australia"],
  ["Austia", "= Austria"],
  ["Austira", "= Austria"],
  // Niger, Nigeria.
  ["Niger", "= Niger"],
  ["Nigeria", "= Nigeria"],
  ["Nigera", "? Niger | Nigeria"],
  ["Nigerria", "= Nigeria"],
  ["Nigr", "unknown"],
  // United States, USA.
  ["United States", "= United States"],
  ["USA", "= United States"],
  ["U.S.A.", "= United States"],
  ["US", "= United States"],
  ["U.S.", "= United States"],
  ["America", "= United States"],
  ["The United States of America", "= United States"],
  ["Untied States", "= United States"],
  ["United", "unknown"],
  ["United Kingdom", "unknown"],
  ["USSR", "unknown"],
  // Côte d'Ivoire, Ivory Coast.
  ["Côte d'Ivoire", "= Côte d'Ivoire"],
  ["Cote d’Ivoire", "= Côte d'Ivoire"],
  ["cote divoire", "= Côte d'Ivoire"],
  ["Cote d Ivoire", "= Côte d'Ivoire"],
  ["Ivory Coast", "= Côte d'Ivoire"],
  ["Ivory Cost", "= Côte d'Ivoire"],
  ["Gold Coast", "unknown"],
  // Different countries that look alike.
  ["South Korea", "= South Korea"],
  ["Korea", "= South Korea"],
  ["North Korea", "unknown"],
  ["Equatorial Guinea", "= Equatorial Guinea"],
  ["Guinea", "unknown"],
  ["Guinee", "unknown"],
  ["Iceland", "= Iceland"],
  ["Icland", "= Iceland"],
  ["Ireland", "unknown"],
  ["Irland", "unknown"],
  ["Zambia", "= Zambia"],
  ["Zambai", "= Zambia"],
  ["Sambia", "= Zambia"],
  ["Gambia", "unknown"],
];

const STADIUM_CASES: Case[] = [
  ["Wembley", "= Wembley Stadium"],
  ["Wembley Stadium", "= Wembley Stadium"],
  ["Wembly", "= Wembley Stadium"],
  ["Stadium", "unknown"],
  ["Stadion", "unknown"],
  ["Stadio", "unknown"],
  ["Stadiun", "unknown"],
  ["Arena", "unknown"],
  ["Park", "unknown"],
  ["Bowl", "unknown"],
  ["Hampden", "= Hampden Park"],
  ["Hampden Park", "= Hampden Park"],
  ["Rose Bowl", "= Rose Bowl"],
  ["Azteca", "= Estadio Azteca"],
  ["Azteca Stadium", "= Estadio Azteca"],
  ["Stadio Azteca", "= Estadio Azteca"],
  ["Bernabeu", "= Santiago Bernabéu"],
  ["Estadio Santiago Bernabéu", "= Santiago Bernabéu"],
  ["Bernabeu Stadium", "= Santiago Bernabéu"],
  ["Maracana", "= Maracanã"],
  ["Maracana Stadium", "= Maracanã"],
  ["Estadio Maracana", "= Maracanã"],
  ["Olimpico", "= Stadio Olimpico"],
  ["Happel Stadion", "= Ernst-Happel-Stadion"],
  ["Allianz Arena", "= Allianz Arena"],
  ["Stade de France", "= Stade de France"],
  ["Santiago", "unknown"],
];

describe("the judge against lists of similar names", () => {
  it.each(PEOPLE_CASES)("people: %j gives %j", (input, expected) => {
    expect(outcome(PEOPLE, input)).toBe(expected);
  });

  it.each(CLUB_CASES)("clubs: %j gives %j", (input, expected) => {
    expect(outcome(CLUBS, input)).toBe(expected);
  });

  it.each(COUNTRY_CASES)("countries: %j gives %j", (input, expected) => {
    expect(outcome(COUNTRIES, input)).toBe(expected);
  });

  it.each(STADIUM_CASES)("stadiums: %j gives %j", (input, expected) => {
    expect(outcome(STADIUMS, input)).toBe(expected);
  });

  it("has at least 60 hard inputs", () => {
    const count =
      PEOPLE_CASES.length +
      CLUB_CASES.length +
      COUNTRY_CASES.length +
      STADIUM_CASES.length;
    expect(count).toBeGreaterThanOrEqual(60);
  });
});

describe("one of a pair on the list, the other typed", () => {
  const only = (name: string, measure: Question["measure"]) =>
    question("only", [a(name)], "home", measure);

  it.each<[string, string, Question["measure"]]>([
    ["Ronaldinho", "Ronaldo", "birthplace"],
    ["Ronaldo", "Ronaldinho", "birthplace"],
    ["Rivaldo", "Ronaldo", "birthplace"],
    ["Austria", "Australia", "capital"],
    ["Australia", "Austria", "capital"],
    ["Niger", "Nigeria", "capital"],
    ["Nigeria", "Niger", "capital"],
    ["South Korea", "North Korea", "capital"],
    ["West Germany", "East Germany", "capital"],
    ["Zambia", "Gambia", "capital"],
    ["Equatorial Guinea", "Guinea", "capital"],
    ["South Sudan", "Sudan", "capital"],
    ["DR Congo", "Congo", "capital"],
    ["Northern Ireland", "Ireland", "capital"],
    ["Inter Milan", "AC Milan", "ground"],
    ["AC Milan", "Inter Milan", "ground"],
    ["Real Madrid", "Atletico Madrid", "ground"],
    ["Manchester United", "Manchester City", "ground"],
    ["Manchester City", "Manchester United", "ground"],
    ["Sporting CP", "Sporting KC", "ground"],
    ["John Terry", "Perry", "birthplace"],
    ["Ian Wright", "Bright", "birthplace"],
    ["Wayne Rooney", "Mooney", "birthplace"],
    ["Roy Keane", "Kane", "birthplace"],
    ["Harry Kane", "Keane", "birthplace"],
    ["Wembley Stadium", "Stadium", "location"],
    ["Villa Park", "Park", "location"],
  ])("a list with only %j does not accept %j", (listed, typed, measure) => {
    expect(outcome(only(listed, measure), typed)).toBe("unknown");
    expect(outcome(only(listed, measure), listed)).toBe(`= ${listed}`);
  });
});

describe("a surname someone else carries as a first name", () => {
  it("is ambiguous instead of a guess", () => {
    const q = question("q", [
      a("Ronaldo Nazário", ["R9"]),
      a("Cristiano Ronaldo", ["CR7"]),
      a("Jordan Henderson"),
      a("Joe Jordan"),
      a("Michael Owen"),
    ]);
    expect(outcome(q, "Ronaldo")).toBe("? Ronaldo Nazário | Cristiano Ronaldo");
    expect(outcome(q, "Ronaldoo")).toBe(
      "? Ronaldo Nazário | Cristiano Ronaldo",
    );
    expect(outcome(q, "Jordan")).toBe("? Jordan Henderson | Joe Jordan");
    expect(outcome(q, "Joe Jordan")).toBe("= Joe Jordan");
    expect(outcome(q, "J Jordan")).toBe("= Joe Jordan");
    expect(outcome(q, "Henderson")).toBe("= Jordan Henderson");
    expect(outcome(q, "C Ronaldo")).toBe("= Cristiano Ronaldo");
    expect(outcome(q, "Ronaldo Nazario")).toBe("= Ronaldo Nazário");
    // A first name alone is still not an answer.
    expect(outcome(q, "Michael")).toBe("unknown");
    expect(outcome(q, "Cristiano")).toBe("unknown");
    expect(outcome(q, "Michale")).toBe("unknown");
  });

  it("does not count a name's own repeated word against it", () => {
    const q = question("q", [a("Colo-Colo"), a("Boca Juniors")], "home");
    expect(outcome(q, "Colo")).toBe("= Colo-Colo");
  });

  it("lets an alias settle it", () => {
    const q = question("q", [
      a("Ronaldo Nazário", ["Ronaldo"]),
      a("Cristiano Ronaldo"),
    ]);
    expect(outcome(q, "Ronaldo")).toBe("= Ronaldo Nazário");
  });
});

describe("Milan as a name of its own", () => {
  it("takes the exact name over the other club's last word", () => {
    const q = question("q", [a("Milan"), a("Inter Milan")], "home", "ground");
    expect(outcome(q, "Milan")).toBe("= Milan");
    expect(outcome(q, "Inter Milan")).toBe("= Inter Milan");
    expect(outcome(q, "AC Milan")).toBe("unknown");
  });

  it("is ambiguous when neither club owns the word", () => {
    const q = question(
      "q",
      [a("AC Milan"), a("Inter Milan")],
      "home",
      "ground",
    );
    expect(outcome(q, "Milan")).toBe("? AC Milan | Inter Milan");
    expect(outcome(q, "Milano")).toBe("? AC Milan | Inter Milan");
  });
});

describe("decoys", () => {
  const q: Question = {
    ...question("q", [
      a("Iceland"),
      a("John Barnes"),
      a("Stephen Ireland", ["Stevie"]),
    ]),
    decoys: ["Ireland", "Baines", "  ", "Stevie"],
  };

  it("are never accepted, exactly or by typo", () => {
    expect(outcome(q, "Baines")).toBe("unknown");
    expect(outcome(q, "baines")).toBe("unknown");
    expect(outcome(q, "Bainse")).toBe("unknown");
  });

  it("block the last-word rule", () => {
    expect(outcome(q, "Ireland")).toBe("unknown");
    expect(outcome(q, "Stephen Ireland")).toBe("= Stephen Ireland");
  });

  it("do not block a real name or alias", () => {
    expect(outcome(q, "Stevie")).toBe("= Stephen Ireland");
    expect(outcome(q, "Barnes")).toBe("= John Barnes");
    expect(outcome(q, "Iceland")).toBe("= Iceland");
    expect(outcome(q, "Icelnad")).toBe("= Iceland");
  });

  it("are optional", () => {
    const plain = question("plain", [a("Iceland")]);
    expect(outcome(plain, "Ireland")).toBe("= Iceland");
  });
});

describe("typoDistance", () => {
  it.each<[string, string, number | null]>([
    ["ronaldo", "ronaldo", 0],
    ["ronalda", "ronaldo", 1],
    ["rnoaldo", "ronaldo", 1],
    ["donaldo", "ronaldo", null],
    ["onaldo", "ronaldo", null],
    ["kroatia", "croatia", 1],
    ["zenegal", "senegal", 1],
    ["yamaica", "jamaica", 1],
    ["north korea", "south korea", null],
    ["east germany", "west germany", null],
    ["sporting kc", "sporting cp", null],
    ["manchestr untied", "manchester united", 2],
    ["manchester unity", "manchester united", null],
    ["australia", "austria", null],
    ["kane", "kans", null],
    ["debruyne", "de bruyne", 1],
    // Not normalised on purpose: accents are the caller's job.
    ["szczesny", "szczęsny", 1],
  ])("%j as a typo of %j is %j", (text, candidate, expected) => {
    expect(typoDistance(text, candidate)).toBe(expected);
  });
});

describe("normalise, the awkward corners", () => {
  it.each<[string, string]>([
    ["St Etienne", "saint etienne"],
    ["St. Étienne", "saint etienne"],
    ["Saint-Étienne", "saint etienne"],
    ["Paris St-Germain", "paris saint germain"],
    ["Man Utd", "man united"],
    ["Neymar Jr", "neymar junior"],
    ["Vinícius Júnior", "vinicius junior"],
    ["the the Hawthorns", "hawthorns"],
    ["Ｆｕｌｌ　Ｗｉｄｔｈ", "full width"],
    ["ﬁorentina", "fiorentina"],
    ["Ronal​do", "ronaldo"],
    ["Ronal­do", "ronaldo"],
    ["Hawaiʻi", "hawaii"],
    ["İstanbul", "istanbul"],
    ["STRASSE", "strasse"],
    ["Straße", "strasse"],
    ["ǅ", "dz"],
    ["São  Paulo FC", "sao paulo fc"],
    ["Bosnia and Herzegovina", "bosnia herzegovina"],
    ["Bosnia & Herzegovina", "bosnia herzegovina"],
    ["M'Gladbach", "mgladbach"],
    ["1860 München", "1860 munchen"],
    ["Цска", "цска"],
  ])("%j is %j", (text, expected) => {
    expect(normalise(text)).toBe(expected);
    expect(normalise(normalise(text))).toBe(expected);
  });

  it("copes with very long and very odd input", () => {
    expect(normalise("a".repeat(5000))).toHaveLength(5000);
    expect(normalise("\u0000\u0001�")).toBe("");
    expect(normalise("🙂⚽")).toBe("");
    expect(judge(PEOPLE, "x".repeat(5000)).kind).toBe("unknown");
    expect(judge(PEOPLE, "🙂").kind).toBe("empty");
  });
});

describe("every name and alias finds its own answer", () => {
  it.each([PEOPLE, CLUBS, COUNTRIES, STADIUMS])("in $id", (q) => {
    for (const ans of q.answers) {
      for (const text of [ans.name, ...ans.aliases]) {
        const result = judge(q, text);
        expect(result.kind, text).toBe("match");
        expect(result.kind === "match" && result.answer, text).toBe(ans);
        const shouted = judge(q, `  ${text.toUpperCase()}  `);
        expect(shouted.kind === "match" && shouted.answer, text).toBe(ans);
      }
    }
  });
});
