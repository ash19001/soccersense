import type { RefObject } from "react";

import { cx } from "./cx";
import { type Bitmap, PixelGlyph } from "./PixelGlyph";
import { Popup } from "./Popup";

/** A heart: the Support button's icon, 9 x 9 like the kit's others. */
export const HEART: Bitmap = [
  ".##...##.",
  "####.####",
  "#########",
  "#########",
  "#########",
  ".#######.",
  "..#####..",
  "...###...",
  "....#....",
];

/** A light bulb, beside "Send us an idea" (drawn in font pixels, two to a cell). */
export const BULB: Bitmap = [
  "..#####..",
  ".#######.",
  ".#######.",
  ".#######.",
  "..#####..",
  "...###...",
  ".........",
  "...###...",
  "...###...",
];

/** A steaming cup, beside "Buy us a coffee". */
export const CUP: Bitmap = [
  "..#..#...",
  ".#..#....",
  "..#..#...",
  ".........",
  "#######..",
  "#########",
  "#######.#",
  "#########",
  ".#####...",
];

export interface SupportLabels {
  /** The button's name and tooltip: "Support us". */
  open: string;
  /** The card's heading, and the dialog's name: "SUPPORT US". */
  heading: string;
  close: string;
  /** The line of thanks under the heading, and the dialog's description. */
  intro: string;
  idea: string;
  coffee: string;
  /** On a button whose link is not there yet: "COMING SOON". */
  soon: string;
  /** Read out after a link's name: "(opens in a new tab)". */
  newTab: string;
}

export interface SupportProps {
  labels: SupportLabels;
  /** Where "Send us an idea" goes, or null while there is nowhere yet ("Coming soon"). */
  ideas: string | null;
  /** Where "Buy us a coffee" goes, or null while there is nowhere yet. */
  coffee: string | null;
  open: boolean;
  /** The close button, Escape or a press outside: called once the card has gone. */
  onClose(): void;
  /** Where the focus goes back to on closing: the Support button. */
  returnFocus?: RefObject<HTMLElement | null>;
}

/**
 * The Support pop-up (a `Popup`): a line of thanks and two big buttons, "Send us an idea"
 * and "Buy us a coffee", each a link that opens in a new tab. A link that is not there yet
 * (null) is a pressed-flat button that says "Coming soon" and cannot be pressed.
 */
export function Support({
  labels,
  ideas,
  coffee,
  open,
  onClose,
  returnFocus,
}: SupportProps) {
  return (
    <Popup
      open={open}
      heading={labels.heading}
      intro={labels.intro}
      close={labels.close}
      onClose={onClose}
      returnFocus={returnFocus}
      className="ss-support"
    >
      <div className="ss-popup__ways">
        <Way icon={BULB} label={labels.idea} href={ideas} labels={labels} />
        <Way
          icon={CUP}
          label={labels.coffee}
          href={coffee}
          labels={labels}
          primary
        />
      </div>
    </Popup>
  );
}

function Way({
  icon,
  label,
  href,
  labels,
  primary = false,
}: {
  icon: Bitmap;
  label: string;
  href: string | null;
  labels: SupportLabels;
  primary?: boolean;
}) {
  const glyph = (
    <PixelGlyph bitmap={icon} unit="fp" cell={2} className="ss-support__icon" />
  );
  if (href === null) {
    return (
      <button
        type="button"
        className="ss-btn ss-btn--secondary ss-btn--full ss-support__way"
        disabled
      >
        <span className="ss-btn__label">
          {glyph}
          <span className="ss-support__words">
            {label}
            <span className="ss-support__soon">
              <span className="ss-sr">, </span>
              {labels.soon}
            </span>
          </span>
        </span>
      </button>
    );
  }
  return (
    <a
      className={cx(
        "ss-btn ss-btn--full ss-support__way",
        primary ? "ss-btn--primary" : "ss-btn--secondary",
      )}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      <span className="ss-btn__label">
        {glyph}
        <span className="ss-support__words">
          {label}
          <span className="ss-sr"> {labels.newTab}</span>
        </span>
      </span>
    </a>
  );
}
