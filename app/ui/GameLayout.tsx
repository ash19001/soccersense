import {
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
} from "react";

import { strings } from "~/i18n";

import { cx } from "./cx";
import { PixelRoot } from "./PixelRoot";
import { isEditing, isWide, usePixelScale } from "./scale";
import { SoundToggle, type SoundToggleLabels } from "./SoundToggle";

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
  /**
   * A sound switch in the top right corner of the free space: `true` (with `strings.sound`)
   * or its words. Off by default: the switch lives beside the "?" in the menu captions and
   * in the board's head, so there is only ever one. Ask for it only on a screen that has
   * neither (the full-time card, say).
   */
  sound?: SoundToggleLabels | boolean;
  className?: string;
}

/**
 * Whether the GameLayout round a component is wide (it carries `data-wide`): for the few
 * things that move to another place in the markup on a monitor rather than only in the CSS
 * (the menu captions' sound switch and Support). False outside a GameLayout, in the
 * build-time HTML and in the first client render over it, as `data-wide` is. (Exported for
 * the tests, which set it without a window to measure.)
 */
export const WideContext = createContext(false);

/** The GameLayout round this component is wide (see WideContext). */
export function useWideLayout(): boolean {
  return useContext(WideContext);
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
 * On a touch screen (a phone) the column does not follow the visual viewport: the phone
 * slides the page itself to show the field. While a field is typed into with the keyboard
 * up, the root carries `data-keyboard="open"` and the board comes down to sit on the answer
 * bar, which is never moved (the product owner, 2026-11-15: "the screen slides up then the
 * question slides down").
 *
 * On a wide screen (a monitor: landscape, with room for a row of captions, see
 * `isWide` in scale.ts) the root carries `data-wide`. The menu captions read it:
 * there they leave the column and lie in one row across the foot of the picture. A
 * contained layout is never wide: it is a phone-sized frame, whatever the window is.
 *
 * The sound switch (SoundToggle) normally lives beside the "?" in the menu captions and in
 * the board's head. Asked for with `sound`, it sits in the top right corner of the middle
 * slot, the free space between the two, clear of the board, the bar, the sheet and the
 * captions at every size.
 *
 * The root carries `data-live` once the page is running in a browser. The build-time HTML
 * does not have it: that HTML is written for a phone (the screen is not known yet). Its
 * units, its orientation and its wide mark are put right before the first paint by the
 * PixelRoot's inline script (`./scale-boot`), but its markup is still a phone's, so ui.css
 * holds the menu captions back on a landscape screen until the page is live, instead of
 * showing them in the phone's arrangement for a moment.
 */
export function GameLayout({
  canvas,
  top,
  bottom,
  children,
  contained = false,
  sound = false,
  className,
}: GameLayoutProps) {
  const soundLabels =
    sound === false ? null : sound === true ? strings.sound : sound;
  const rootRef = useRef<HTMLDivElement | null>(null);
  // The same store as the PixelRoot below, so the two always agree.
  const wide = isWide(usePixelScale()) && !contained;
  const live = useSyncExternalStore(subscribeToNothing, inBrowser, atBuildTime);

  // The build-time HTML's own script (./scale-boot, run by the PixelRoot below) marks a wide
  // layout before React is there, so the column is in its place from the first paint. React
  // only takes off what it put on itself: if the window is not wide after all by the time
  // the page is live (turned or resized in between), the mark is taken off here.
  useLayoutEffect(() => {
    if (live && !wide) rootRef.current?.removeAttribute("data-wide");
  }, [live, wide]);

  useEffect(() => {
    const root = rootRef.current;
    const vv = window.visualViewport;
    if (!root || !vv || contained) return;
    // A touch screen (a phone). The column is never moved there: the phone slides the page
    // itself to show a covered field, and chasing the visual viewport fights it (seen on a
    // real iPhone, 2026-11-15: the board and the bar ended up off the screen). Only
    // `data-keyboard` is set, which brings the board down onto the bar (ui.css).
    const coarse =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(pointer: coarse)").matches;

    // The height with no keyboard up, at this width. Some browsers shrink the window with
    // the keyboard, so the window alone cannot say how much the keyboard covers: this is
    // the most there was before the typing began.
    let width = window.innerWidth;
    let full = Math.max(window.innerHeight, vv.height);
    // A finger went down on the field: a phone answers that with its keyboard. Believed
    // only until the measurement has been seen to work on this device.
    let touched = false;
    let measures = false;

    const apply = () => {
      const typing = isEditing();
      if (window.innerWidth !== width || !typing) {
        width = window.innerWidth;
        full = Math.max(window.innerHeight, vv.height);
      } else {
        full = Math.max(full, window.innerHeight);
      }
      if (!typing) touched = false;
      const zoomed = Math.abs(vv.scale - 1) > 0.01;
      const covered = !zoomed && full - vv.height > KEYBOARD_MIN;
      if (covered && typing) measures = true;

      if (coarse) {
        if (typing && (covered || (touched && !measures))) {
          root.dataset.keyboard = "open";
        } else {
          delete root.dataset.keyboard;
        }
        return;
      }
      if (!zoomed && window.innerHeight - vv.height > KEYBOARD_MIN) {
        root.style.setProperty("--ss-vv-top", `${Math.round(vv.offsetTop)}px`);
        root.style.setProperty("--ss-vv-h", `${Math.round(vv.height)}px`);
        root.dataset.keyboard = "open";
      } else {
        root.style.removeProperty("--ss-vv-top");
        root.style.removeProperty("--ss-vv-h");
        delete root.dataset.keyboard;
      }
    };

    // Focus moves before the keyboard does; look again once it has landed.
    let frame = 0;
    const soon = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(apply);
    };
    const pressed = (event: Event) => {
      const el = event.target;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        touched = true;
        soon();
      }
    };

    apply();
    vv.addEventListener("resize", apply);
    vv.addEventListener("scroll", apply);
    window.addEventListener("focusin", soon);
    window.addEventListener("focusout", soon);
    if (coarse) root.addEventListener("pointerdown", pressed);
    return () => {
      cancelAnimationFrame(frame);
      vv.removeEventListener("resize", apply);
      vv.removeEventListener("scroll", apply);
      window.removeEventListener("focusin", soon);
      window.removeEventListener("focusout", soon);
      root.removeEventListener("pointerdown", pressed);
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
      <WideContext.Provider value={wide}>
        <div className="ss-game__canvas">{canvas}</div>
        <div className="ss-game__col">
          <div className="ss-game__top">{top}</div>
          <div className="ss-game__mid">
            {soundLabels && <SoundToggle labels={soundLabels} />}
            {children}
          </div>
          <div className="ss-game__bottom">{bottom}</div>
        </div>
      </WideContext.Provider>
    </PixelRoot>
  );
}
