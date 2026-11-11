import { useEffect, useId, useRef } from "react";

import { Button } from "./Button";
import { cx } from "./cx";
import {
  type LeagueEntry,
  LeagueTable,
  type LeagueTableLabels,
} from "./LeagueTable";
import type { UiGrade, UiMode } from "./types";

export interface RevealSheetProps {
  grade: UiGrade;
  mode: UiMode;
  /** "TOP BINS" */
  gradeLabel: string;
  /** "+87". Leave out for time's up and passes if there is nothing to show. */
  pointsLabel?: string;
  /** "Trent Alexander-Arnold was born in West Derby, Liverpool: 3 miles from Anfield." */
  sentence: string;
  rows: readonly LeagueEntry[];
  tableLabels: LeagueTableLabels;
  /** "NEXT QUESTION" or "FULL TIME" */
  nextLabel: string;
  onNext: () => void;
  /** Move keyboard focus to the next button when the sheet appears (default true). */
  focusNext?: boolean;
  className?: string;
}

/**
 * The reveal: slides up from the bottom in steps and never covers more than the lower 46%
 * of the screen. The table scrolls inside it when it does not fit, with the best answer
 * pinned under the headings and the row of the player in view.
 */
export function RevealSheet({
  grade,
  mode,
  gradeLabel,
  pointsLabel,
  sentence,
  rows,
  tableLabels,
  nextLabel,
  onNext,
  focusNext = true,
  className,
}: RevealSheetProps) {
  const titleId = useId();
  const liveRef = useRef<HTMLParagraphElement | null>(null);
  const nextRef = useRef<HTMLButtonElement | null>(null);

  // A live region only speaks when its text changes after it exists, so fill it once mounted.
  const spoken = [gradeLabel, pointsLabel, sentence].filter(Boolean).join(". ");
  useEffect(() => {
    if (liveRef.current) liveRef.current.textContent = spoken;
  }, [spoken]);

  useEffect(() => {
    if (focusNext) nextRef.current?.focus({ preventScroll: true });
  }, [focusNext]);

  return (
    <section
      className={cx("ss-sheet", className)}
      data-grade={grade}
      data-mode={mode}
      aria-labelledby={titleId}
    >
      <p ref={liveRef} className="ss-sr" role="status" aria-live="polite" />
      <header className="ss-sheet__band">
        <h2 id={titleId} className="ss-sheet__grade">
          {gradeLabel}
        </h2>
        {pointsLabel && <p className="ss-sheet__points">{pointsLabel}</p>}
      </header>
      <div className="ss-sheet__body">
        <p className="ss-sheet__sentence">{sentence}</p>
        <LeagueTable rows={rows} labels={tableLabels} />
        <Button ref={nextRef} variant="mode" mode={mode} full onClick={onNext}>
          {nextLabel}
        </Button>
      </div>
    </section>
  );
}
