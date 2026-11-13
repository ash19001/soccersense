import type { RefObject } from "react";

import { cx } from "./cx";
import { type FullTimeResult, FullTimeResults } from "./FullTimeCard";
import { LedNumber } from "./LedNumber";
import { PixelGlyph } from "./PixelGlyph";
import { Popup } from "./Popup";
import { SHARE_ICON, TICK_ICON } from "./ResultIcons";
import { isWide, usePixelRootScale } from "./scale";
import type { UiMode } from "./types";

export interface ReviewLabels {
  /** The card's heading, and the dialog's name: "YOUR HOME GAME". */
  heading: string;
  /** The line under the heading, and the dialog's description. Leave out for none. */
  intro?: string;
  /** The close button's name. */
  close: string;
}

export interface ReviewProps {
  labels: ReviewLabels;
  /** The mode that was played: the title takes its light colour. */
  mode: UiMode;
  total: number;
  /** 700 */
  maxTotal: number;
  /** Read out for the score: "512 out of 700". */
  totalSpoken?: string;
  /** The career tier the total reached: "TOP FLIGHT". */
  careerTitle: string;
  /** The title the total earned: "SEASON TICKET HOLDER". */
  earnedTitle?: string;
  /** Read out before the title: "Your title". */
  earnedTitleSpoken?: string;
  results: readonly FullTimeResult[];
  /** The list's name for screen readers: "Your answers". */
  resultsLabel?: string;
  /**
   * SHARE, as on the full-time card: an icon button (`SHARE_ICON`) in the card's head beside
   * the close button (2026-11-13), its name and tooltip ("Share your HOME game"), `busy`
   * while the picture is being made (it keeps its place and the focus, and does nothing),
   * and what a press does. Leave out for none.
   */
  share?: { label: string; busy?: boolean; done?: boolean; onClick(): void };
  /**
   * How SHARE went ("Picture saved, result copied."): only read out. On screen, SHARE's icon
   * is a tick for a moment once it has worked (`share.done`).
   */
  status?: string;
  open: boolean;
  /** The close button, Escape or a press outside: called once the card has gone. */
  onClose(): void;
  /** Where the focus goes back to on closing: the REVIEW button that opened it. */
  returnFocus?: RefObject<HTMLElement | null>;
}

/**
 * A game played today, again (a `Popup` over the home screen): each mode is played once a
 * day, so its card's REVIEW button (and its patch on the ball) open this instead. The
 * score on the full-time card's dot-matrix display, the title it earned and the career
 * tier under it, and the seven answers as the full-time card lists them
 * (`FullTimeResults`). SHARE, as the full-time card's, is an icon beside the close button,
 * a tick for a moment once it has worked. No line under the heading (2026-11-13).
 */
export function Review({
  labels,
  mode,
  total,
  maxTotal,
  totalSpoken,
  careerTitle,
  earnedTitle,
  earnedTitleSpoken,
  results,
  resultsLabel,
  share,
  status,
  open,
  onClose,
  returnFocus,
}: ReviewProps) {
  // A monitor sets the card in caption pixels; where they are bigger than the font pixel,
  // the answers keep the smaller one (ui.css, the review).
  const scale = usePixelRootScale();
  const caption = isWide(scale) && scale.cp > scale.fp;
  return (
    <Popup
      open={open}
      heading={labels.heading}
      intro={labels.intro}
      close={labels.close}
      onClose={onClose}
      returnFocus={returnFocus}
      className={cx("ss-review", caption && "ss-review--caption")}
      action={
        share && (
          <button
            type="button"
            className={cx(
              "ss-btn ss-btn--icon ss-btn--secondary ss-popup__action ss-review__share",
              share.done && "is-done",
            )}
            aria-label={share.label}
            title={share.label}
            // busy, not disabled: the focus stays on it
            aria-busy={share.busy || undefined}
            onClick={share.busy ? undefined : share.onClick}
          >
            <span className="ss-btn__label">
              <PixelGlyph
                bitmap={share.done ? TICK_ICON : SHARE_ICON}
                unit="ip"
              />
            </span>
          </button>
        )
      }
    >
      <div className="ss-review__score" data-mode={mode}>
        <LedNumber
          value={`${Math.round(total)}/${Math.round(maxTotal)}`}
          size="lg"
          tone="amber"
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
        <p className="ss-review__career">{careerTitle}</p>
      </div>
      <FullTimeResults
        className="ss-review__list"
        results={results}
        label={resultsLabel}
      />
      <p className="ss-sr" role="status">
        {status}
      </p>
    </Popup>
  );
}
