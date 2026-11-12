/**
 * The title a player earns at full time, by their total and the mode they played: a ladder
 * of ten per mode, the last only for a perfect 700. HOME's titles are the crowd's favourite's
 * (going with the room), AWAY's the scout's of the obscure (deep cuts). The words are in
 * `strings.play.titles` (app/i18n/en.ts); here are only the ids and where each one starts.
 * See docs/GAME_DESIGN.md section 6.4.
 */
import { MAX_TOTAL } from "./career";
import type { Mode } from "./types";

/** HOME's titles, lowest first. */
export type HomeTitleId =
  | "wrongend"
  | "findingseat"
  | "turnstile"
  | "piequeue"
  | "seasonticket"
  | "knowschants"
  | "startschants"
  | "voice"
  | "whisperer"
  | "hivemind";

/** AWAY's titles, lowest first. */
export type AwayTitleId =
  | "herd"
  | "backpages"
  | "highlights"
  | "retroshirt"
  | "thirdkit"
  | "fanzine"
  | "lowerleague"
  | "beforecool"
  | "deepcuts"
  | "hipster";

export type TitleId = HomeTitleId | AwayTitleId;

/** One rung of a ladder: the title, for a total of `from` or more (up to the next rung). */
export interface TitleRung<Id extends TitleId = TitleId> {
  id: Id;
  from: number;
}

/**
 * Where each title starts, the same for both modes: 0 exactly, then up from 10, 120, 220,
 * 300, 380, 460, 540, 620, and 700 (a perfect game) alone. Most games end in the 300s, so the
 * rungs are closest together there.
 */
export const TITLE_FROM: readonly number[] = [
  0,
  10,
  120,
  220,
  300,
  380,
  460,
  540,
  620,
  MAX_TOTAL,
];

const HOME_IDS: readonly HomeTitleId[] = [
  "wrongend",
  "findingseat",
  "turnstile",
  "piequeue",
  "seasonticket",
  "knowschants",
  "startschants",
  "voice",
  "whisperer",
  "hivemind",
];

const AWAY_IDS: readonly AwayTitleId[] = [
  "herd",
  "backpages",
  "highlights",
  "retroshirt",
  "thirdkit",
  "fanzine",
  "lowerleague",
  "beforecool",
  "deepcuts",
  "hipster",
];

/** Each mode's ladder, lowest first. */
export const TITLES: {
  readonly home: readonly TitleRung<HomeTitleId>[];
  readonly away: readonly TitleRung<AwayTitleId>[];
} = {
  home: HOME_IDS.map((id, i) => ({ id, from: TITLE_FROM[i] })),
  away: AWAY_IDS.map((id, i) => ({ id, from: TITLE_FROM[i] })),
};

/** The title for a total in a mode. Totals under 0 (or NaN) count as 0, over 700 as 700. */
export function titleFor(mode: "home", total: number): HomeTitleId;
export function titleFor(mode: "away", total: number): AwayTitleId;
export function titleFor(mode: Mode, total: number): TitleId;
export function titleFor(mode: Mode, total: number): TitleId {
  const ladder: readonly TitleRung[] = TITLES[mode];
  const t = Number.isNaN(total) ? 0 : total;
  let found = ladder[0];
  for (const rung of ladder) {
    if (t >= rung.from) found = rung;
  }
  return found.id;
}
