import { useEffect, useId, useLayoutEffect, useRef } from "react";

import { Button } from "./Button";
import { cx } from "./cx";
import {
  type LeagueEntry,
  LeagueTable,
  type LeagueTableLabels,
} from "./LeagueTable";
import type { UiGrade, UiMode } from "./types";

/**
 * The player's own answer when it is not a row of the table (it did not score: a miss, a
 * pass or a time-up), shown above the table as one line in the miss colour.
 */
export interface RevealYours {
  /** The tag at the start, as on the player's row: "YOU". */
  you: string;
  /** "Blackburn Rovers", or "NO ANSWER" after a pass or a time-up. */
  name: string;
  /** The share of players who gave it, formatted: "2%". Leave out with no answer. */
  picked?: string;
  /** "MISS", "TIME'S UP", "PASSED" */
  shot: string;
  /** What it scored: 0. */
  points: number;
  /** The whole line as one sentence for screen readers. */
  spoken: string;
}

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
  /** The player's answer, above the table, when it is not one of `rows`. */
  yours?: RevealYours;
  /** "NEXT QUESTION" or "FULL TIME" */
  nextLabel: string;
  onNext: () => void;
  /** Move keyboard focus to the next button when the sheet appears (default true). */
  focusNext?: boolean;
  className?: string;
}

/**
 * The ways the sheet is made to fit a screen too short for it, least visible first. Each
 * is kept for the rest of the sheet once taken, in `data-fit` (space-separated):
 *
 * - `place`: the place after a name is kept for screen readers only in the rows where it
 *   does not fit on the name's line (and so would take a line of its own).
 * - `tight`: the rows are set tighter: less padding, the points on a lower box.
 * - `over`: the board gives way and the sheet covers the foot of it, up to the whole
 *   column.
 *
 * Past all three the table scrolls, as before; no screen measured needs that (docs/API_UI.md).
 */
export const FIT_STEPS = ["place", "tight", "over"] as const;
export type FitStep = (typeof FIT_STEPS)[number];

/** Whether the sheet's table shows every row whole, with no scrolling. */
function tableFits(sheet: HTMLElement): boolean {
  const wrap = sheet.querySelector<HTMLElement>(".ss-table-wrap");
  const table = wrap?.querySelector("table");
  if (!wrap || !table) return true;
  return table.offsetHeight <= wrap.clientHeight;
}

/** `place`: keep a place that would wrap onto a line of its own for screen readers only. */
function cutWrappedPlaces(sheet: HTMLElement): void {
  for (const place of sheet.querySelectorAll<HTMLElement>(
    ".ss-table__place",
  )) {
    const name = place.parentElement?.querySelector(".ss-table__name");
    if (!name || !place.textContent) continue;
    const lines = name.getClientRects();
    const last = lines[lines.length - 1];
    if (!last) continue;
    const below = Array.from(place.getClientRects()).some(
      (rect) => rect.top > last.top + 1,
    );
    if (below) place.dataset.cut = "";
  }
}

/**
 * Fits the sheet to the room it has: undoes every step, then takes them in order
 * (FIT_STEPS) until the table shows all its rows whole. Returns the steps taken. It reads
 * the layout, so call it once the sheet is in the document (and again when the room
 * changes).
 */
export function fitSheet(sheet: HTMLElement): FitStep[] {
  delete sheet.dataset.fit;
  for (const place of sheet.querySelectorAll<HTMLElement>("[data-cut]")) {
    delete place.dataset.cut;
  }
  const taken: FitStep[] = [];
  for (const step of FIT_STEPS) {
    if (tableFits(sheet)) break;
    taken.push(step);
    sheet.dataset.fit = taken.join(" ");
    if (step === "place") cutWrappedPlaces(sheet);
  }
  return taken;
}

/**
 * The reveal: slides up from the bottom in steps, as tall as what it holds, so the five
 * rows of the table and the player's own line are always all in view, whole and without
 * scrolling. It may cover more than the lower 46% of the scene, never the board; on a
 * screen too short even for that it fits itself (`fitSheet`). The best answer is pinned
 * under the headings and the player's row is brought into view if the table must ever
 * scroll. An answer that is not a row (`yours`) stands on its own line under the sentence:
 * above the table on a phone, in the left column on a wide screen.
 */
export function RevealSheet({
  grade,
  mode,
  gradeLabel,
  pointsLabel,
  sentence,
  rows,
  tableLabels,
  yours,
  nextLabel,
  onNext,
  focusNext = true,
  className,
}: RevealSheetProps) {
  const titleId = useId();
  const liveRef = useRef<HTMLParagraphElement | null>(null);
  const nextRef = useRef<HTMLButtonElement | null>(null);
  const sheetRef = useRef<HTMLElement | null>(null);

  // A live region only speaks when its text changes after it exists, so fill it once mounted.
  const spoken = [gradeLabel, pointsLabel, sentence].filter(Boolean).join(". ");
  useEffect(() => {
    if (liveRef.current) liveRef.current.textContent = spoken;
  }, [spoken]);

  useEffect(() => {
    if (focusNext) nextRef.current?.focus({ preventScroll: true });
  }, [focusNext]);

  // Fit to the room before the first paint, and again whenever the room or the type
  // changes: the column is resized (a window, the keyboard going down) or the fonts arrive.
  const content = [
    sentence,
    yours?.name,
    ...rows.map((row) => ("gap" in row ? "-" : `${row.name}/${row.place}`)),
  ].join("|");
  useLayoutEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    const fit = () => {
      fitSheet(sheet);
    };
    fit();
    const room = sheet.closest(".ss-game__col") ?? sheet.parentElement;
    const observer =
      typeof ResizeObserver === "undefined" || !room
        ? null
        : new ResizeObserver(fit);
    if (room) observer?.observe(room);
    const fonts = typeof document === "undefined" ? undefined : document.fonts;
    fonts?.addEventListener("loadingdone", fit);
    return () => {
      observer?.disconnect();
      fonts?.removeEventListener("loadingdone", fit);
    };
  }, [content]);

  return (
    <section
      ref={sheetRef}
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
        {yours && (
          <p className="ss-sheet__yours" data-grade="miss">
            <span className="ss-sr">{yours.spoken}</span>
            <span className="ss-sheet__yours-you" aria-hidden="true">
              {yours.you}
            </span>
            <span className="ss-sheet__yours-name" aria-hidden="true">
              {yours.name}
            </span>
            {yours.picked && (
              <span className="ss-sheet__yours-picked" aria-hidden="true">
                {yours.picked}
              </span>
            )}
            <span className="ss-sheet__yours-tag" aria-hidden="true">
              {yours.shot}
            </span>
            <span className="ss-sheet__yours-pts" aria-hidden="true">
              {yours.points}
            </span>
          </p>
        )}
        <LeagueTable rows={rows} labels={tableLabels} inlinePlace />
        <Button ref={nextRef} variant="mode" mode={mode} full onClick={onNext}>
          {nextLabel}
        </Button>
      </div>
    </section>
  );
}
