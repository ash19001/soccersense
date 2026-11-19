import { type RefObject, useRef } from "react";

import { cx } from "./cx";
import { ModePicture } from "./MenuCaptions";
import { ModeBadge } from "./ModeBadge";
import type { Bitmap } from "./PixelGlyph";
import { Popup } from "./Popup";
import { isWide, usePixelRootScale } from "./scale";
import type { UiMode } from "./types";

export interface AllModesLabels {
  /** The button's name and tooltip, and its words on a monitor: "All modes". */
  open: string;
  /** The card's heading, and the dialog's name: "ALL MODES". */
  heading: string;
  close: string;
  /** On a mode played today, at its end: "REVIEW". */
  review: string;
}

export interface AllModesEntry {
  mode: UiMode;
  /** "CLOSEST" */
  label: string;
  /** "The answer nearest today's place wins" */
  line: string;
  /** The mode's picture (`MODE_PICTURES`), before its badge. Leave out for none. */
  picture?: Bitmap;
  /** Today's score, if the mode has been played (once a day): its row opens the review. */
  score?: number | null;
  /** Read out for a played mode: "Review your CLOSEST game. Played today: 347 points". */
  spoken?: string;
}

export interface AllModesProps {
  labels: AllModesLabels;
  /** Every mode there is to play, in the menu's order. */
  modes: readonly AllModesEntry[];
  open: boolean;
  /** The close button, Escape, a press outside, or a mode picked: once the card has gone. */
  onClose(): void;
  /** A mode not played today was picked: start it (called after `onClose`). */
  onChoose(mode: UiMode): void;
  /** A mode played today was picked: its game again (called after `onClose`). */
  onReview(mode: UiMode): void;
  /** Where the focus goes back to on closing: the "All modes" button. */
  returnFocus?: RefObject<HTMLElement | null>;
}

/**
 * Every mode in one list (a `Popup`), the product owner, 2026-11-18: the cards under the ball
 * are the first four modes only, "there should be an option to show all game modes which
 * also shows these 2" (CLOSEST and FURTHEST; they are on the ball as well). A grid of tiles,
 * two to a row in the menu's pairs (the same day: "make it grids not rows"; no line under the
 * heading), each a button that starts its mode: its picture, badge and line; played today,
 * its score and REVIEW, and the button opens its review. The card goes first, then the mode is
 * started or its review opened.
 */
export function AllModes({
  labels,
  modes,
  open,
  onClose,
  onChoose,
  onReview,
  returnFocus,
}: AllModesProps) {
  // A monitor sets the card in caption pixels; where they are bigger than the font pixel,
  // the rows keep the smaller one, as the review's answers do (ui.css, the review).
  const scale = usePixelRootScale();
  const caption = isWide(scale) && scale.cp > scale.fp;
  const dismiss = useRef<(() => void) | null>(null);
  const picked = useRef<{ mode: UiMode; played: boolean } | null>(null);
  const pick = (mode: UiMode, played: boolean) => {
    picked.current = { mode, played };
    dismiss.current?.();
  };
  return (
    <Popup
      open={open}
      heading={labels.heading}
      close={labels.close}
      onClose={() => {
        const chosen = picked.current;
        picked.current = null;
        onClose();
        if (!chosen) return;
        if (chosen.played) onReview(chosen.mode);
        else onChoose(chosen.mode);
      }}
      returnFocus={returnFocus}
      dismissRef={dismiss}
      className={cx("ss-modes", caption && "ss-modes--caption")}
    >
      <ul className="ss-modes__list">
        {modes.map((item) => {
          const played = item.score !== undefined && item.score !== null;
          return (
            <li key={item.mode}>
              <button
                type="button"
                className="ss-modes__mode"
                data-mode={item.mode}
                aria-label={played && item.spoken ? item.spoken : undefined}
                onClick={() => pick(item.mode, played)}
              >
                {played ? (
                  <span className="ss-menu__score" aria-hidden="true">
                    {Math.round(item.score ?? 0)}
                  </span>
                ) : (
                  item.picture && <ModePicture bitmap={item.picture} />
                )}
                <ModeBadge mode={item.mode} label={item.label} />
                <span className="ss-modes__line">{item.line}</span>
                {played && (
                  <span className="ss-modes__review" aria-hidden="true">
                    {labels.review}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </Popup>
  );
}
