import type { Answer, Measure, Question } from "./types";

export type JudgeResult =
  | { kind: "empty" }
  | { kind: "unknown" }
  | { kind: "ambiguous"; candidates: Answer[] }
  | { kind: "match"; answer: Answer; via: "exact" | "surname" | "fuzzy" };

/** Letters that Unicode decomposition does not reduce to a base letter plus marks. */
const LETTERS: Record<string, string> = {
  ø: "o",
  ł: "l",
  đ: "d",
  ð: "d",
  þ: "th",
  ß: "ss",
  æ: "ae",
  œ: "oe",
  ı: "i",
  ħ: "h",
  ŧ: "t",
};
const LETTER_PATTERN = /[øłđðþßæœıħŧ]/g;

/** Apostrophes, primes and dots vanish: "d'Or" is "dor", "A.C." is "ac", "O'Neill" is "oneill". */
const DROPPED = /['‘’‛ʼʻʹ′`´.]/g;
const MARKS = /\p{M}/gu;
/** Invisible characters a paste can carry: zero-width spaces and joiners, soft hyphens. */
const INVISIBLE = /\p{Cf}/gu;
/** Everything else that is not a letter or a digit separates words: hyphens, commas, "&", "/". */
const SEPARATORS = /[^\p{L}\p{N}]+/gu;

/** Short forms that are read as the full word, wherever they stand. */
const WORDS: Record<string, string> = {
  st: "saint",
  utd: "united",
  jr: "junior",
};

/**
 * The form in which answers are compared: lower case, no accents, no punctuation, single
 * spaces, no leading "the", and no "and" between words ("Brighton & Hove Albion",
 * "Brighton and Hove Albion" and "brighton hove albion" are all the same). "St", "Utd" and
 * "Jr" are spelt out, so "St Etienne" is "Saint-Étienne" and "Man Utd" is "Man United".
 */
export function normalise(text: string): string {
  const flat = text
    .normalize("NFKD")
    .toLowerCase()
    .replace(LETTER_PATTERN, (ch) => LETTERS[ch] ?? ch)
    .replace(MARKS, "")
    .replace(INVISIBLE, "")
    .replace(DROPPED, "")
    .replace(SEPARATORS, " ")
    .trim();
  if (flat === "") return "";
  let words = flat.split(" ");
  while (words.length > 1 && words[0] === "the") words = words.slice(1);
  if (words.length > 2) {
    const last = words.length - 1;
    words = words.filter((w, i) => w !== "and" || i === 0 || i === last);
  }
  return words.map((w) => WORDS[w] ?? w).join(" ");
}

/**
 * Damerau-Levenshtein distance (optimal string alignment): insertions, deletions,
 * substitutions and swaps of two neighbouring characters each cost 1.
 */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let before: number[] = new Array<number>(n + 1).fill(0);
  let prev: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  let curr: number[] = new Array<number>(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= n; j++) {
      const cb = b.charCodeAt(j - 1);
      const cost = ca === cb ? 0 : 1;
      let d = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (
        i > 1 &&
        j > 1 &&
        ca === b.charCodeAt(j - 2) &&
        a.charCodeAt(i - 2) === cb
      ) {
        d = Math.min(d, before[j - 2] + 1);
      }
      curr[j] = d;
    }
    const spare = before;
    before = prev;
    prev = curr;
    curr = spare;
  }
  return prev[n];
}

/** How many typos are forgiven in a string of this length. */
export function allowedTypos(length: number): number {
  if (length < 5) return 0;
  if (length < 9) return 1;
  return 2;
}

/** First letters that are one sound spelt two ways: "Kroatia", "Zenegal", "Yugoslavia". */
const SOUND_ALIKE = new Set(["ck", "kc", "sz", "zs", "jy", "yj"]);

/** A slip of the finger keeps the first letter, or swaps the first two. */
function sameStart(a: string, b: string): boolean {
  if (a[0] === b[0]) return true;
  if (SOUND_ALIKE.has(a[0] + b[0])) return true;
  return a.length > 1 && b.length > 1 && a[0] === b[1] && a[1] === b[0];
}

/**
 * With the same number of words on both sides, no single word may carry more than one typo
 * (two from 9 letters). This is what keeps "North Korea" from being a typo of "South Korea".
 */
function wordsAgree(a: string, b: string): boolean {
  const aw = a.split(" ");
  const bw = b.split(" ");
  if (aw.length !== bw.length) return true;
  return aw.every((word, i) => {
    const other = bw[i];
    const limit = Math.min(word.length, other.length) >= 9 ? 2 : 1;
    return editDistance(word, other) <= limit;
  });
}

/**
 * How far `text` is from `candidate` when it can be read as a typo of it, or null when it
 * cannot. The allowance is counted on the shorter of the two, so that "Australia" is never a
 * typo of "Austria".
 */
export function typoDistance(text: string, candidate: string): number | null {
  const limit = allowedTypos(Math.min(text.length, candidate.length));
  if (limit === 0) return null;
  if (Math.abs(candidate.length - text.length) > limit) return null;
  if (!sameStart(text, candidate)) return null;
  const d = editDistance(text, candidate);
  if (d > limit) return null;
  if (d > 1 && !wordsAgree(text, candidate)) return null;
  return d;
}

/**
 * Last words that say nothing on their own, so they are never accepted as a "surname":
 * "Stadium" must not find the only stadium in the list that happens to end with it, and
 * "Guinea" must not find Equatorial Guinea. Longer endings ("Olympic Stadium") still count.
 */
const GENERIC_ENDINGS: Record<Measure, readonly string[]> = {
  birthplace: ["junior"],
  ground: ["club", "fc", "cf", "afc", "sc"],
  location: [
    "stadium",
    "stadion",
    "stadio",
    "stade",
    "estadio",
    "estadi",
    "arena",
    "park",
    "bowl",
    "ground",
    "road",
    "lane",
    "field",
    "dome",
  ],
  // Countries whose whole name is the end of another country's name, and plain nouns.
  capital: [
    "guinea",
    "sudan",
    "congo",
    "ireland",
    "samoa",
    "republic",
    "kingdom",
    "island",
    "islands",
  ],
};

/**
 * Words a player may add to the front or the back of a name that the answer list leaves out:
 * "Sir Bobby Charlton", "FC Porto", "Porto FC", "Estadio Azteca", "Maracanã Stadium".
 */
const OPTIONAL_WORDS: Record<
  Measure,
  { first: readonly string[]; last: readonly string[] }
> = {
  birthplace: { first: ["sir"], last: [] },
  ground: { first: ["fc", "cf"], last: ["fc", "cf"] },
  location: {
    first: ["estadio", "estadi", "stadio", "stade", "stadion"],
    last: ["stadium", "stadion"],
  },
  capital: { first: [], last: [] },
};

/** The input, then the input without an optional first or last word. */
function formsOf(text: string, measure: Measure): string[] {
  const forms = [text];
  const optional = OPTIONAL_WORDS[measure];
  const words = text.split(" ");
  if (!optional || words.length < 2) return forms;
  if (optional.first.includes(words[0])) forms.push(words.slice(1).join(" "));
  if (optional.last.includes(words[words.length - 1])) {
    forms.push(words.slice(0, -1).join(" "));
  }
  return forms;
}

/** A decoy has no answer. */
const NO_ANSWER = -1;

interface FuzzyCandidate {
  text: string;
  /** Index of the answer in `question.answers`, or NO_ANSWER for a decoy. */
  answer: number;
  /** Whether a hit on this candidate can be accepted, or only makes others ambiguous. */
  counts: boolean;
}

interface JudgeIndex {
  /** The normalised name of every answer, in list order. */
  full: string[];
  /** Normalised full name to answer indexes. */
  names: Map<string, number[]>;
  /** Normalised alias to answer indexes. */
  aliases: Map<string, number[]>;
  /** Trailing words of each name ("dijk", "van dijk") to answer indexes. */
  surnames: Map<string, number[]>;
  /** Words from the front or the middle of each name ("ronaldo" in "Ronaldo Nazário"). */
  inner: Map<string, number[]>;
  /** Things that look like answers and are not. */
  decoys: Set<string>;
  /** Names, aliases and decoys, for typo matching. */
  fuzzy: FuzzyCandidate[];
  /** Surnames and inner words, for typo matching when no name or alias is close. */
  fuzzySurnames: FuzzyCandidate[];
}

function add(map: Map<string, number[]>, key: string, answer: number): void {
  const list = map.get(key);
  if (!list) map.set(key, [answer]);
  else if (!list.includes(answer)) list.push(answer);
}

function buildIndex(question: Question): JudgeIndex {
  const full = question.answers.map((answer) => normalise(answer.name));
  const names = new Map<string, number[]>();
  const aliases = new Map<string, number[]>();
  const surnames = new Map<string, number[]>();
  const inner = new Map<string, number[]>();
  const decoys = new Set<string>();
  const fuzzy: FuzzyCandidate[] = [];
  const fuzzySurnames: FuzzyCandidate[] = [];
  const generic = new Set(GENERIC_ENDINGS[question.measure] ?? []);
  const seen = new Set<string>();
  const addFuzzy = (
    list: FuzzyCandidate[],
    text: string,
    answer: number,
    counts: boolean,
  ) => {
    const key = `${list === fuzzy ? "f" : "s"}${answer}\u0000${text}`;
    if (seen.has(key)) return;
    seen.add(key);
    list.push({ text, answer, counts });
  };

  question.answers.forEach((answer, i) => {
    const name = full[i];
    if (name !== "") {
      add(names, name, i);
      addFuzzy(fuzzy, name, i, true);
    }
    for (const alias of answer.aliases) {
      const text = normalise(alias);
      if (text === "") continue;
      add(aliases, text, i);
      addFuzzy(fuzzy, text, i, true);
    }
  });
  for (const decoy of question.decoys ?? []) {
    const text = normalise(decoy);
    if (text === "") continue;
    decoys.add(text);
    addFuzzy(fuzzy, text, NO_ANSWER, false);
  }
  full.forEach((name, i) => {
    const words = name.split(" ");
    const count = words.length;
    for (let from = 0; from < count; from++) {
      for (let to = from + 1; to <= count; to++) {
        if (from === 0 && to === count) continue; // the whole name
        const run = words.slice(from, to).join(" ");
        if (to === count) {
          if (to - from === 1 && generic.has(run)) continue;
          add(surnames, run, i);
          // Whatever is accepted exactly is also accepted with a typo ("Fergusson").
          addFuzzy(fuzzySurnames, run, i, true);
        } else {
          add(inner, run, i);
        }
      }
    }
  });
  // An inner word only matters where it could be mistaken for someone's surname.
  for (const [run, owners] of inner) {
    for (const i of owners) {
      if (!surnames.get(run)?.includes(i)) {
        addFuzzy(fuzzySurnames, run, i, false);
      }
    }
  }
  return {
    full,
    names,
    aliases,
    surnames,
    inner,
    decoys,
    fuzzy,
    fuzzySurnames,
  };
}

const INDEXES = new WeakMap<Question, JudgeIndex>();

function indexFor(question: Question): JudgeIndex {
  let index = INDEXES.get(question);
  if (!index) {
    index = buildIndex(question);
    INDEXES.set(question, index);
  }
  return index;
}

function resolve(
  question: Question,
  found: readonly number[] | undefined,
  via: "exact" | "surname" | "fuzzy",
): JudgeResult | null {
  if (!found || found.length === 0) return null;
  if (found.length === 1) {
    return { kind: "match", answer: question.answers[found[0]], via };
  }
  const candidates = [...found]
    .sort((a, b) => a - b)
    .map((i) => question.answers[i]);
  return { kind: "ambiguous", candidates };
}

/**
 * The surname step: the input is the last word, or the last few words, of an answer's name.
 * Every answer that carries the same words anywhere in its name is a candidate too, so that
 * "Ronaldo" with Cristiano Ronaldo and Ronaldo Nazário in the list is ambiguous, not a guess.
 *
 * A longer name can also be given as its first word and its surname, leaving out the middle:
 * "Jimmy Hasselbaink", "Ruud Nistelrooy". For people an initial will do: "T Müller" is
 * Thomas, not Gerd.
 */
function bySurname(
  question: Question,
  index: JudgeIndex,
  text: string,
): JudgeResult | null {
  if (text.length < 3) return null;
  const owners = index.surnames.get(text);
  if (owners) {
    const found = [...owners];
    for (const i of index.inner.get(text) ?? []) {
      if (!found.includes(i)) found.push(i);
    }
    return resolve(question, found, "surname");
  }
  const space = text.indexOf(" ");
  if (space < 1) return null;
  const first = text.slice(0, space);
  const rest = text.slice(space + 1);
  if (rest.length < 3) return null;
  const initial = first.length === 1 && question.measure === "birthplace";
  const found = (index.surnames.get(rest) ?? []).filter((i) => {
    const name = index.full[i];
    const own = name.slice(0, name.indexOf(" "));
    return initial ? own.startsWith(first) : own === first;
  });
  return resolve(question, found, "surname");
}

/**
 * The typo step over one list: the answers whose candidate strings are nearest to `text`.
 * Null when nothing acceptable is close enough. "unknown" when a decoy is at least as close
 * as the nearest answer. An inner word of a name is never an answer on its own (a first name
 * does not count), but when it is as close as the nearest surname it makes the result
 * ambiguous.
 */
function byTypo(
  question: Question,
  list: readonly FuzzyCandidate[],
  text: string,
): JudgeResult | null {
  if (allowedTypos(text.length) === 0) return null;
  const near: { candidate: FuzzyCandidate; d: number }[] = [];
  let best = Infinity;
  for (const candidate of list) {
    const d = typoDistance(text, candidate.text);
    if (d === null) continue;
    near.push({ candidate, d });
    if (candidate.counts && d < best) best = d;
  }
  if (near.some((n) => n.candidate.answer === NO_ANSWER && n.d <= best)) {
    return { kind: "unknown" };
  }
  if (best === Infinity) return null;
  const found: number[] = [];
  for (const { candidate, d } of near) {
    const close = candidate.counts ? d === best : d <= best;
    if (!close || found.includes(candidate.answer)) continue;
    found.push(candidate.answer);
  }
  return resolve(question, found, "fuzzy");
}

/**
 * Check a typed answer against a question's answer list.
 *
 * 1. exact: the normalised input is an answer's name, or failing that an alias. Two answers
 *    with the same name or alias: ambiguous. A decoy (`question.decoys`) is unknown.
 * 2. surname: the input (3 or more characters) is the last word, or the last few words, of an
 *    answer's name. Several answers, or another answer with the same word elsewhere in its
 *    name: ambiguous. Generic last words ("Stadium", "Park", "Club") do not count. The first
 *    word and the surname of a longer name ("Jimmy Hasselbaink") is accepted too, and for
 *    people an initial and a surname ("T Müller").
 * 3. Steps 1 and 2 again without an optional first or last word: "Sir", "FC", "Stadium".
 * 4. fuzzy: the closest name or alias within the typo allowance (none under 5 characters, 1
 *    for 5 to 8, 2 for 9 or more, counted on the shorter of the two strings; the first letter
 *    must agree; no more than one typo in any one word). Several answers equally close:
 *    ambiguous. Only if no name or alias is close enough, the same test is run on surnames,
 *    so that "Fergusson" finds Sir Alex Ferguson.
 *
 * Because exact matches are tried first, an input that is exactly one answer's name or alias
 * can never be read as a typo of another.
 */
export function judge(question: Question, input: string): JudgeResult {
  const text = normalise(input);
  if (text === "") return { kind: "empty" };
  const index = indexFor(question);
  const forms = formsOf(text, question.measure);

  for (const form of forms) {
    const exact =
      resolve(question, index.names.get(form), "exact") ??
      resolve(question, index.aliases.get(form), "exact");
    if (exact) return exact;
    if (index.decoys.has(form)) return { kind: "unknown" };
    const surname = bySurname(question, index, form);
    if (surname) return surname;
  }
  for (const list of [index.fuzzy, index.fuzzySurnames]) {
    for (const form of forms) {
      const typo = byTypo(question, list, form);
      if (typo) return typo;
    }
  }
  return { kind: "unknown" };
}
