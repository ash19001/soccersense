// What the airship's sign says on the home screen: short messages about the
// player's day, one after another, from what this device knows. The words are in
// `strings.home.sign`; the order is:
//
// - for each mode played today: its total ("NEXT-GEN / 360 PTS"), the player's place on
//   today's (mock) leaderboard ("NEXT-GEN / 37 OF 1,284", placed as the leaderboard panel
//   places it) and the title it earned, alone on two small lines ("FROM THE / FUTURE");
// - the daily streak, when there is one ("DAILY STREAK / 4 DAYS");
// - for each mode not played yet, a nudge ("NEXT-GEN / IS WAITING");
//
// Every message fits the smallest sign whole, nothing scrolling (`strings.home.sign`).
// - how many have played today ("PLAYED TODAY / 1,136"), as the leaderboard panel counts
//   them (the mode it opens on).
//
// Pure: the day, the scores and the streak are passed in.

import { leaderboardFor } from "~/data/leaderboard";
import { MODES, type Mode, titleFor } from "~/game";
import { strings } from "~/i18n";

export interface SignMessage {
  header: string;
  text: string;
}

/** The sign's messages for `day`, with today's total per mode (null: not played) and the streak. */
export function signMessages(
  day: number,
  scores: Readonly<Record<Mode, number | null>>,
  streak: number,
): SignMessage[] {
  const words = strings.home.sign;
  const out: SignMessage[] = [];
  // the count the leaderboard panel shows first: the mode played today if only one was
  // (as home.tsx opens the panel), else HOME
  const played = MODES.filter((mode) => scores[mode] !== null);
  const shown: Mode = played.length === 1 ? played[0] : "home";
  let crowd = 0;
  for (const mode of MODES) {
    const score = scores[mode];
    const board = leaderboardFor(day, mode, score);
    if (mode === shown) crowd = board.total;
    if (score === null) continue;
    const label = strings.home.modes[mode].label;
    out.push({ header: label, text: words.points(score) });
    if (board.yourRank !== null) {
      out.push({
        header: label,
        text: words.rank(board.yourRank, board.total),
      });
    }
    // the title alone, on two small lines: under a header it would scroll
    const titles: Readonly<Record<string, string>> = strings.play.titles[mode];
    const title = titles[titleFor(mode, score)];
    if (title) out.push({ header: "", text: title });
  }
  if (streak > 0) {
    out.push({ header: words.streak, text: words.days(streak) });
  }
  for (const mode of MODES) {
    if (scores[mode] !== null) continue;
    out.push({
      header: strings.home.modes[mode].label,
      text: words.isWaiting,
    });
  }
  out.push({ header: words.crowd, text: words.count(crowd) });
  return out;
}
