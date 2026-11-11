/** Shared game types. Data files and rules both import from here. See docs/GAME_DESIGN.md. */

/** The two modes on the ball that can be played today. */
export type Mode = "home" | "away";

/**
 * How a question's answers are ranked, best first.
 * - `common`: the most popular answer wins (HOME).
 * - `niche`: the least popular answer wins (AWAY).
 * - `closest`: the answer whose place is nearest today's stadium wins (locked mode CLOSEST).
 * - `furthest`: the furthest from today's stadium wins (locked mode FURTHEST).
 */
export type Rule = "common" | "niche" | "closest" | "furthest";

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

export type Grade =
  "worldie" | "topbins" | "goal" | "ontarget" | "wide" | "timeup" | "skipped";

/** One answer placed in the table for a given stadium and rule. */
export interface RankedAnswer {
  answer: Answer;
  /** Whole kilometres from the stadium (shown by the distance rules). */
  km: number;
  /** The answer's popularity: the share of players who give it, in percent. */
  share: number;
  /** 0 to 100. */
  points: number;
  /** 1-based position in the table; tied answers share a rank. */
  rank: number;
}
