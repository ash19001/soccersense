import { type ReactNode, useEffect, useRef, useSyncExternalStore } from "react";

import { cx } from "./cx";
import { PixelRoot } from "./PixelRoot";
import { isWide, usePixelScale } from "./scale";

export interface GameLayoutProps {
  /** Full-bleed layer behind everything: the canvas stage. */
  canvas?: ReactNode;
  /** Pinned to the top of the column: the Board. */
  top?: ReactNode;
  /** Pinned to the bottom of the column: AnswerBar, RevealSheet, FullTimeCard, MenuCaptions. */
  bottom?: ReactNode;
  /** Free space between the two, for anything that floats over the scene. */
  children?: ReactNode;
  /**
   * Fill the parent element instead of the viewport (the parent needs a height). Used by
   * the gallery; the real game leaves it off.
   */
  contained?: boolean;
  className?: string;
}

/** Keyboards are at least this tall; smaller changes are browser bars sliding. */
const KEYBOARD_MIN = 120;

// False in the build-time HTML and in the first client render over it, true from then on.
function subscribeToNothing(): () => void {
  return () => {};
}
const inBrowser = () => true;
const atBuildTime = () => false;

/**
 * The game shell. A full-screen canvas slot behind, and over it a column (135 logical
 * pixels wide, or 405 font pixels where that is more; never wider than the screen; centred)
 * with the board at the top and the answer bar or sheet at the bottom. It is a PixelRoot,
 * so it sets --px, --fp and the other units. It respects the safe-area insets, uses the
 * dynamic viewport height, and keeps the column inside the visual viewport so the answer
 * bar stays above the on-screen keyboard while the canvas does not move. If the two slots
 * ever need more height than there is, the bottom one stays whole and covers the end of
 * the top one.
 *
 * On a wide screen (a monitor: landscape, with room for a row of captions, see
 * `isWide` in scale.ts) the root carries `data-wide`. The menu captions read it:
 * there they leave the column and lie in one row across the foot of the picture. A
 * contained layout is never wide: it is a phone-sized frame, whatever the window is.
 *
 * The root carries `data-live` once the page is running in a browser. The build-time HTML
 * does not have it: that HTML is laid out for a phone (the screen is not known yet), and
 * ui.css holds the menu captions back on a landscape screen until the real scale is in,
 * instead of showing them in the phone's layout for a moment.
 */
export function GameLayout({
  canvas,
  top,
  bottom,
  children,
  contained = false,
  className,
}: GameLayoutProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  // The same store as the PixelRoot below, so the two always agree.
  const wide = isWide(usePixelScale()) && !contained;
  const live = useSyncExternalStore(subscribeToNothing, inBrowser, atBuildTime);

  useEffect(() => {
    const root = rootRef.current;
    const vv = window.visualViewport;
    if (!root || !vv || contained) return;

    const apply = () => {
      const covered = window.innerHeight - vv.height;
      const zoomed = Math.abs(vv.scale - 1) > 0.01;
      if (!zoomed && covered > KEYBOARD_MIN) {
        root.style.setProperty("--ss-vv-top", `${Math.round(vv.offsetTop)}px`);
        root.style.setProperty("--ss-vv-h", `${Math.round(vv.height)}px`);
        root.dataset.keyboard = "open";
      } else {
        root.style.removeProperty("--ss-vv-top");
        root.style.removeProperty("--ss-vv-h");
        delete root.dataset.keyboard;
      }
    };

    apply();
    vv.addEventListener("resize", apply);
    vv.addEventListener("scroll", apply);
    return () => {
      vv.removeEventListener("resize", apply);
      vv.removeEventListener("scroll", apply);
      root.style.removeProperty("--ss-vv-top");
      root.style.removeProperty("--ss-vv-h");
      delete root.dataset.keyboard;
    };
  }, [contained]);

  return (
    <PixelRoot
      ref={rootRef}
      className={cx("ss-game", contained && "ss-game--contained", className)}
      data-wide={wide ? "" : undefined}
      data-live={live ? "" : undefined}
    >
      <div className="ss-game__canvas">{canvas}</div>
      <div className="ss-game__col">
        <div className="ss-game__top">{top}</div>
        <div className="ss-game__mid">{children}</div>
        <div className="ss-game__bottom">{bottom}</div>
      </div>
    </PixelRoot>
  );
}
