// What the stats pop-up on the home screen says: the history of finished games on this
// device (`loadHistory`), worked out by `statsFor` and put in the interface's words. Built
// over the game's list of modes (`MODES`), so a new mode joins it by itself.

import {
  type Grade,
  type Mode,
  OUTCOMES,
  SHOT_POINTS,
  type PlayedGame,
  apportion,
  isShot,
  loadHistory,
  statsFor,
  titleFor,
} from "~/game";
import { strings } from "~/i18n";
import {
  STATS_BAR_CELLS,
  type StatsCardProps,
  type StatsLabels,
  type UiGrade,
} from "~/ui";

export type StatsContent = Pick<
  StatsCardProps,
  "labels" | "modes" | "streak" | "empty"
>;

/**
 * The card's words, from `strings.stats`. No line under the heading and no small print
 * (the product owner, 2026-11-13): the heading says what it is.
 */
export function statsLabels(): StatsLabels {
  const text = strings.stats;
  return {
    heading: text.heading,
    close: text.close,
    empty: text.empty,
    today: text.today,
    notPlayed: text.notPlayed,
    shot: text.shot,
    shots: text.shots,
    total: text.total,
    played: text.played,
    average: text.average,
    best: text.best,
    bestDay: text.bestDay,
    bestSpoken: text.bestSpoken,
    tally: text.tally,
    blank: text.blank,
    streak: text.streak,
    days: text.days,
    streakBest: text.streakBest,
    streakSpoken: text.streakSpoken,
  };
}

/** A grade's name: the shot's, or TIME'S UP and PASSED. */
function gradeName(grade: Grade): string {
  return isShot(grade) ? strings.play.shots[grade] : strings.play.grades[grade];
}

/** The title a total earned in a mode, in words. */
function titleOf(mode: Mode, total: number): string {
  const titles: Readonly<Record<string, string>> = strings.play.titles[mode];
  return titles[titleFor(mode, total)] ?? "";
}

/**
 * The stats on `today` (the game day, with any `?day=` override). Reads browser storage
 * unless `games` is given: call it in an effect or a handler, never while rendering.
 */
export function statsContent(
  today: number,
  games: readonly PlayedGame[] = loadHistory(today),
): StatsContent {
  const stats = statsFor(games, today);
  return {
    labels: statsLabels(),
    empty: stats.played === 0,
    streak: stats.streak,
    modes: stats.modes.map((m) => {
      const counts = OUTCOMES.map((o) => m.tally[o]);
      const cells = apportion(counts, STATS_BAR_CELLS);
      return {
        mode: m.mode,
        label: strings.home.modes[m.mode].label,
        today: m.today && {
          total: m.today.total,
          title: titleOf(m.mode, m.today.total),
          // The points as saved: a game saved under older points shows its own, which
          // add up to its total.
          shots: m.today.grades.map((grade, i) => ({
            grade,
            label: gradeName(grade),
            points: m.today?.points[i] ?? SHOT_POINTS[grade],
          })),
        },
        played: m.played,
        average: m.average,
        best: m.best,
        tally: OUTCOMES.map((o, i) => ({
          grade: (o === "none" ? "timeup" : o) satisfies UiGrade,
          label: o === "none" ? strings.stats.none : strings.play.shots[o],
          count: counts[i],
          cells: cells[i],
        })),
      };
    }),
  };
}
