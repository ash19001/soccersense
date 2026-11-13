/**
 * The title a player earns at full time, by their total and the mode they played: a ladder
 * of ten per mode, the last only for a perfect 700. HOME's titles are the crowd's favourite's
 * (going with the room), AWAY's the scout's of the obscure (deep cuts), RETRO's the keeper
 * of football's past (old-school), NEXT-GEN's the one first with the news. The words are in
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

/** RETRO's titles, lowest first. */
export type RetroTitleId =
  | "yesterday"
  | "almanac"
  | "blackwhite"
  | "leather"
  | "programmes"
  | "longshorts"
  | "historian"
  | "ledger"
  | "archive"
  | "kickoff";

/** NEXT-GEN's titles, lowest first. */
export type NextgenTitleId =
  | "dialup"
  | "teletext"
  | "replays"
  | "groupchat"
  | "alerts"
  | "liveblog"
  | "rumours"
  | "firstnews"
  | "ahead"
  | "future";

export type TitleId = HomeTitleId | AwayTitleId | RetroTitleId | NextgenTitleId;

/** One rung of a ladder: the title, for a total of `from` or more (up to the next rung). */
export interface TitleRung<Id extends TitleId = TitleId> {
  id: Id;
  from: number;
}

/**
 * Where each title starts, the same in every mode: 0 exactly, then up from 10, 120, 220,
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

const RETRO_IDS: readonly RetroTitleId[] = [
  "yesterday",
  "almanac",
  "blackwhite",
  "leather",
  "programmes",
  "longshorts",
  "historian",
  "ledger",
  "archive",
  "kickoff",
];

const NEXTGEN_IDS: readonly NextgenTitleId[] = [
  "dialup",
  "teletext",
  "replays",
  "groupchat",
  "alerts",
  "liveblog",
  "rumours",
  "firstnews",
  "ahead",
  "future",
];

function ladder<Id extends TitleId>(ids: readonly Id[]): TitleRung<Id>[] {
  return ids.map((id, i) => ({ id, from: TITLE_FROM[i] }));
}

/** Each mode's ladder, lowest first. */
export const TITLES: {
  readonly home: readonly TitleRung<HomeTitleId>[];
  readonly away: readonly TitleRung<AwayTitleId>[];
  readonly retro: readonly TitleRung<RetroTitleId>[];
  readonly nextgen: readonly TitleRung<NextgenTitleId>[];
} = {
  home: ladder(HOME_IDS),
  away: ladder(AWAY_IDS),
  retro: ladder(RETRO_IDS),
  nextgen: ladder(NEXTGEN_IDS),
};

/** The title for a total in a mode. Totals under 0 (or NaN) count as 0, over 700 as 700. */
export function titleFor(mode: "home", total: number): HomeTitleId;
export function titleFor(mode: "away", total: number): AwayTitleId;
export function titleFor(mode: "retro", total: number): RetroTitleId;
export function titleFor(mode: "nextgen", total: number): NextgenTitleId;
export function titleFor(mode: Mode, total: number): TitleId;
export function titleFor(mode: Mode, total: number): TitleId {
  const rungs: readonly TitleRung[] = TITLES[mode];
  const t = Number.isNaN(total) ? 0 : total;
  let found = rungs[0];
  for (const rung of rungs) {
    if (t >= rung.from) found = rung;
  }
  return found.id;
}
