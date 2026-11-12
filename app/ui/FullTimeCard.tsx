import { useId } from "react";

import { Button } from "./Button";
import { cx } from "./cx";
import { LedNumber } from "./LedNumber";
import { Pip } from "./Pips";
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
  results: readonly FullTimeResult[];
  /** Name of the list of answers for screen readers: "Your answers". */
  resultsLabel?: string;
  /** "SHARE" (swap the label to "COPIED!" after a successful copy). */
  shareLabel: string;
  onShare: () => void;
  /** "PLAY AWAY" */
  otherLabel: string;
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
  results,
  resultsLabel,
  shareLabel,
  onShare,
  otherLabel,
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
        <Button variant="primary" onClick={onShare}>
          {shareLabel}
        </Button>
        <Button variant="mode" mode={otherMode} onClick={onPlayOther}>
          {otherLabel}
        </Button>
        <Button variant="secondary" onClick={onMenu}>
          {menuLabel}
        </Button>
      </div>
    </section>
  );
}
