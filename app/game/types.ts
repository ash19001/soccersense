/** Shared game types. Data files and rules both import from here. See docs/GAME_DESIGN.md. */

/**
 * The modes on the ball that can be played: HOME and AWAY (ranked by how many players give
 * an answer), RETRO and NEXT-GEN (ranked by an answer's year). The menu's order is `MODES`.
 */
export type Mode = "home" | "away" | "retro" | "nextgen";

/** The two modes ranked by an answer's year: RETRO (the oldest wins), NEXT-GEN (the newest). */
export type EraMode = "retro" | "nextgen";

/**
 * How a question's answers are ranked, best first.
 * - `common`: the most popular answer wins (HOME).
 * - `niche`: the least popular answer wins (AWAY).
 * - `oldest`: the answer with the earliest year wins (RETRO): its first year, `years[0]`.
 * - `newest`: the answer with the latest year wins (NEXT-GEN): its last year.
 * - `closest`: the answer whose place is nearest today's stadium wins (locked mode CLOSEST).
 * - `furthest`: the furthest from today's stadium wins (locked mode FURTHEST).
 */
export type Rule =
  "common" | "niche" | "oldest" | "newest" | "closest" | "furthest";

export interface LatLng {
  /** Degrees, north positive. */
  lat: number;
  /** Degrees, east positive. */
  lng: number;
}

/** A daily pin. */
export interface Stadium extends LatLng {
  /** kebab-case, unique: "anfield" */
  id: string;
  /** Display name: "Anfield" */
  name: string;
  /** "Liverpool" */
  city: string;
  /** "England" */
  country: string;
}

/** What an answer's place means for a question. */
export type Measure = "birthplace" | "ground" | "location" | "capital";

export interface Answer extends LatLng {
  /** kebab-case, unique within its question: "trent-alexander-arnold" */
  id: string;
  /** Display name, with correct accents: "Trent Alexander-Arnold" */
  name: string;
  /** Other spellings the judge accepts: ["Alexander-Arnold", "TAA", "Trent"]. Never the name itself. */
  aliases: string[];
  /** The measured place, most specific first: "West Derby, Liverpool" */
  place: string;
  /** Country of that place: "England" */
  country: string;
  /**
   * The estimated share of players who give this answer, in percent: 0.1 to 100, at most one
   * decimal place. The shares of a question add up to about 100. HOME and AWAY are scored by
   * it. For now these are estimates built into the sample questions (docs/data-notes); a
   * backend will count real answers later.
   */
  popularity: number;
  /**
   * The shot this answer is in its question's own mode (HOME: the most common answers are the
   * worldies; AWAY: the most uncommon). Filed from the popularity estimates by `shotsFor` and
   * then checked by eye (docs/data-notes/shots.md); a backend will file real answers the same
   * way. Played under another rule, the answer's shot is worked out again from that rule.
   */
  shot: Shot;
  /**
   * Every year that makes this a valid answer (title, final or hosting years), whole and
   * ascending. Ranks RETRO (the first year, `oldest`) and NEXT-GEN (the last, `newest`), and
   * is required in their questions (`EraAnswer`); HOME and AWAY questions leave it out.
   */
  years?: number[];
}

/** An answer to a RETRO or NEXT-GEN question: its years are required. */
export interface EraAnswer extends Answer {
  years: number[];
}

export interface Question {
  /** kebab-case, unique: "pl-winning-managers" */
  id: string;
  mode: Mode;
  /** "Name a manager who has won the Premier League" */
  prompt: string;
  measure: Measure;
  /** Completes "Measured by ...": "where the manager was born" */
  measureLabel: string;
  /** ISO date the answer list was last verified: "2026-11-10" */
  asOf: string;
  answers: Answer[];
  /**
   * Optional. Real things that are not answers but could be mistaken for one by the judge's
   * typo or last-word rules: "Ireland" in a list that has Iceland, "Guinea" in one that has
   * Equatorial Guinea. The judge never accepts them, or a typo of them.
   */
  decoys?: string[];
}

/**
 * A RETRO or NEXT-GEN question: every answer has its years (`EraAnswer`). It is a
 * `Question`, so it plays through the same rules.
 */
export interface EraQuestion extends Omit<Question, "mode" | "answers"> {
  mode: EraMode;
  answers: EraAnswer[];
}

/**
 * The six shots an answer can be, best first: WORLDIE 100, GOLAZO 80, TRIVELA 60,
 * TOE POKE 30, TAP IN 10, MISS 0. Every answer is a goal of some kind except a miss. The points
 * and the order are SHOT_POINTS and SHOT_ORDER (app/game/shots.ts).
 */
export type Shot =
  "worldie" | "golazo" | "trivela" | "toepoke" | "tapin" | "miss";

/** How a question went: a shot, or no answer ("timeup": the clock ran out; "skipped": passed). */
export type Grade = Shot | "timeup" | "skipped";

/** One answer placed in the table for a given stadium and rule. */
export interface RankedAnswer {
  answer: Answer;
  /** Whole kilometres from the stadium (shown by the distance rules). */
  km: number;
  /** The answer's popularity: the share of players who give it, in percent. */
  share: number;
  /** The shot this answer is under the table's rule. */
  shot: Shot;
  /** The shot's points: SHOT_POINTS[shot]. */
  points: number;
  /** 1-based position in the table; tied answers share a rank. */
  rank: number;
  /**
   * The year the table's rule ranks the answer by: its first (`oldest`, RETRO) or its last
   * (`newest`, NEXT-GEN). Null under the other rules, and for an answer with no years.
   */
  year: number | null;
}
