// What the airship's sign says on the home screen: short messages about the
// player's day, one after another, from what this device knows. The words are in
// `strings.home.sign`; the order is:
//
// - for each mode played today: its total ("NEXT-GEN / 360 PTS"), the player's place on
//   today's board where they are on it (an account's game played through the server:
//   "NEXT-GEN / 37 OF 1,284", as the leaderboard panel places it) and the title it earned,
//   alone on two small lines ("FROM THE / FUTURE");
// - the daily streak, when there is one ("DAILY STREAK / 4 DAYS");
// - for each mode not played yet, a nudge ("NEXT-GEN / IS WAITING");
//
// Every message fits the smallest sign whole, nothing scrolling (`strings.home.sign`).
// - how many are on the board ("ON THE BOARD / 1,136"), as the leaderboard panel counts
//   them (the mode it opens on), once the boards have arrived.
//
// Pure: the day, the scores, the streak and the day's boards are passed in.

import { type BoardAnswer, MODES, type Mode, titleFor } from "~/game";
import { strings } from "~/i18n";

export interface SignMessage {
  header: string;
  text: string;
}

/**
 * The sign's messages for `day`, with today's total per mode (null: not played), the
 * streak, and the day's boards (null until they have arrived).
 */
export function signMessages(
  day: number,
  scores: Readonly<Record<Mode, number | null>>,
  streak: number,
  boards: BoardAnswer | null = null,
): SignMessage[] {
  const words = strings.home.sign;
  const out: SignMessage[] = [];
  // the count the leaderboard panel shows first: the mode played today if only one was
  // (as home.tsx opens the panel), else HOME
  const played = MODES.filter((mode) => scores[mode] !== null);
  const shown: Mode = played.length === 1 ? played[0] : "home";
  const today = boards !== null && boards.day === day ? boards : null;
  for (const mode of MODES) {
    const score = scores[mode];
    if (score === null) continue;
    const board = today?.modes[mode];
    const label = strings.home.modes[mode].label;
    out.push({ header: label, text: words.points(score) });
    // Only a place on the board: a player not on it is told on the panel where they
    // would have placed.
    if (board?.you) {
      out.push({
        header: label,
        text: words.rank(board.you.rank, board.count),
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
  if (today) {
    out.push({
      header: words.crowd,
      text: words.count(today.modes[shown].count),
    });
  }
  return out;
}
