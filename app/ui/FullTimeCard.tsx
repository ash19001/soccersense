import { useId } from "react";

import { Button } from "./Button";
import { cx } from "./cx";
import { LedNumber } from "./LedNumber";
import { Pip } from "./Pips";
import { Streak, type StreakProps } from "./Streak";
import type { UiGrade, UiMode } from "./types";

export interface FullTimeResult {
  grade: UiGrade;
  points: number;
  /** What the player answered, or the text for no answer: "Time's up". */
  answer: string;
  /** The shot's name, beside the points: "GOLAZO". Leave out for no answer. */
  label?: string;
}

export interface FullTimeCardProps {
  /** The mode that was just played. */
  mode: UiMode;
  /** "FULL TIME" */
  heading: string;
  total: number;
  /** 700 */
  maxTotal: number;
  /** Read out for the score: "620 out of 700". */
  totalSpoken?: string;
  /** The career tier reached: "WORLD CUP FINAL". */
  careerTitle: string;
  /** The title the total earned, shown big with it: "SEASON TICKET HOLDER". */
  earnedTitle?: string;
  /** Read out before the title: "Your title". */
  earnedTitleSpoken?: string;
  /** "PERFECT GAME", only on a 700. */
  perfectLine?: string;
  /** The daily streak this game kept going: a flame and "STREAK 4" under the title. */
  streak?: StreakProps;
  results: readonly FullTimeResult[];
  /** Name of the list of answers for screen readers: "Your answers". */
  resultsLabel?: string;
  /** "SHARE" (swap the label to say how it went: "COPIED!", "SENT!"). */
  shareLabel: string;
  /**
   * The share picture is being made: the button says so (`shareLabel`, "MAKING"), is
   * marked busy and does nothing when pressed, but keeps its place and the focus.
   */
  shareBusy?: boolean;
  onShare: () => void;
  /** "AWAY" */
  otherLabel: string;
  /** Its name for screen readers, when the label alone is not enough: "Play AWAY". */
  otherSpoken?: string;
  /** The mode that button starts, so it takes that mode's colour. */
  otherMode: UiMode;
  onPlayOther: () => void;
  /** "MENU" */
  menuLabel: string;
  onMenu: () => void;
  className?: string;
}

/**
 * The end of a game: the score, the career title, the seven answers, and what next. It
 * keeps to the lower 46% of the screen so the final tableau stays in view; the answers
 * scroll if they do not fit (on phones shorter than about 670 CSS px).
 */
export function FullTimeCard({
  mode,
  heading,
  total,
  maxTotal,
  totalSpoken,
  careerTitle,
  earnedTitle,
  earnedTitleSpoken,
  perfectLine,
  streak,
  results,
  resultsLabel,
  shareLabel,
  shareBusy = false,
  onShare,
  otherLabel,
  otherSpoken,
  otherMode,
  onPlayOther,
  menuLabel,
  onMenu,
  className,
}: FullTimeCardProps) {
  const headingId = useId();
  return (
    <section
      className={cx("ss-panel ss-panel--bolted ss-full", className)}
      data-mode={mode}
      aria-labelledby={headingId}
    >
      <div className="ss-full__top">
        <h2 id={headingId} className="ss-full__heading">
          {heading}
        </h2>
        <p className="ss-full__career">{careerTitle}</p>
      </div>
      <div className="ss-full__score">
        <LedNumber
          value={`${Math.round(total)}/${Math.round(maxTotal)}`}
          size="lg"
          tone={perfectLine ? "gold" : "amber"}
          label={totalSpoken ?? `${total} / ${maxTotal}`}
        />
        {earnedTitle && (
          <p className="ss-full__title">
            {earnedTitleSpoken && (
              <span className="ss-sr">{earnedTitleSpoken}: </span>
            )}
            {earnedTitle}
          </p>
        )}
        {perfectLine && <p className="ss-full__perfect">{perfectLine}</p>}
        {streak && streak.days > 0 && (
          <p className="ss-full__streak">
            <Streak {...streak} />
          </p>
        )}
      </div>
      <ol
        className="ss-full__list"
        aria-label={resultsLabel}
        // A keyboard user must be able to scroll the list when it does not fit.
        tabIndex={0}
      >
        {results.map((result, i) => (
          <li key={i} className="ss-full__row" data-grade={result.grade}>
            <Pip grade={result.grade} />
            <span className="ss-full__answer">{result.answer}</span>
            {result.label && (
              <span className="ss-full__shot">{result.label}</span>
            )}
            <span className="ss-full__points">{result.points}</span>
          </li>
        ))}
      </ol>
      <div className="ss-full__actions">
        {/* Busy, it is not `disabled`: that would drop the focus from it. */}
        <Button
          variant="primary"
          onClick={shareBusy ? undefined : onShare}
          aria-busy={shareBusy || undefined}
          aria-disabled={shareBusy || undefined}
        >
          {shareLabel}
        </Button>
        <Button
          variant="mode"
          mode={otherMode}
          onClick={onPlayOther}
          aria-label={otherSpoken}
        >
          {otherLabel}
        </Button>
        <Button variant="secondary" onClick={onMenu}>
          {menuLabel}
        </Button>
      </div>
    </section>
  );
}
