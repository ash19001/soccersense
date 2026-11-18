import {
  type Ref,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";

import { PENCIL, PERSON } from "./AccountIcons";
import { cx } from "./cx";
import { useWideLayout } from "./GameLayout";
import { PixelGlyph } from "./PixelGlyph";
import { PopupButton } from "./Popup";
import { type Slider, createSlider, prefersReducedMotion } from "./slide";

/**
 * The player's name and account, in the top right corner of the home screen (2026-11-17,
 * the product owner: "in bottom left add the account name (which is clickable if they want
 * to change it) and next to it it says sign in which opens the sign in/ sign up pop up",
 * then "actually move it top right of the screen").
 */
export interface AccountCornerProps {
  /** The player's name. */
  name: string;
  /** The name's button, read out and its tooltip: "Change your name, soccerfan12". */
  nameSpoken: string;
  /** The name was pressed: its pop-up. */
  onName(): void;
  /** Beside it: "SIGN IN", or "ACCOUNT" once signed in. */
  action: string;
  /** Read out for it: "Sign in or make an account". */
  actionSpoken: string;
  /** SIGN IN or ACCOUNT was pressed (or, on a phone, the one button): the account's card. */
  onAction(): void;
  /** The phone's one button, read out and its tooltip: "Your name and account: soccerfan12". */
  phoneLabel: string;
  /** The account's card is up. */
  open?: boolean;
  /** The name's card is up. */
  naming?: boolean;
  /** The kick-off is on: it slides up off the screen, and nothing in it can be reached. */
  stowed?: boolean;
  /** The name's button (a monitor), for its dialog to give the focus back to. */
  nameRef?: Ref<HTMLButtonElement>;
  /** SIGN IN or ACCOUNT, or the phone's button, the same way. */
  actionRef?: Ref<HTMLButtonElement>;
  className?: string;
}

/**
 * The kick-off's way out: up off the top of the screen, every frame, eased, on whole
 * device pixels (`createSlider`), held in view by `data-sliding` while it moves; at rest
 * the `is-stowed` class hides it. Coming back is instant, and so is everything under
 * reduced motion.
 */
function useStowUp(ref: RefObject<HTMLElement | null>, stowed: boolean): void {
  const slide = useRef<Slider | null>(null);
  const was = useRef(stowed);
  useLayoutEffect(() => {
    const el = ref.current;
    const before = was.current;
    was.current = stowed;
    if (!el) return;
    const settle = () => {
      ref.current?.style.removeProperty("transform");
      ref.current?.removeAttribute("data-sliding");
    };
    const slider = (slide.current ??= createSlider({
      apply: (y) =>
        ref.current?.style.setProperty("transform", `translateY(${y}px)`),
      end: settle,
      bounds: [-Infinity, 0],
    }));
    const distance = Math.ceil(el.getBoundingClientRect().bottom) + 4;
    if (
      !stowed ||
      before === stowed ||
      prefersReducedMotion() ||
      !(distance > 4)
    ) {
      slider.stop();
      settle();
      return;
    }
    el.setAttribute("data-sliding", "");
    slider.to(-distance, 0);
  }, [ref, stowed]);
  useEffect(() => () => slide.current?.stop(), []);
}

/**
 * On a monitor, in the top right corner: the name, underlined on the picture itself with a
 * pencil after it (a press changes the name; gold under the pointer), beside SIGN IN, or
 * ACCOUNT once signed in, on a plate like the captions' day plate. Each is a button a touch
 * target tall. The leaderboard's panel starts under them.
 *
 * On a phone: one square button in the corner, a head and shoulders, which opens the
 * account's card (it has the name and CHANGE): the logo leaves no room there for words.
 */
export function AccountCorner({
  name,
  nameSpoken,
  onName,
  action,
  actionSpoken,
  onAction,
  phoneLabel,
  open,
  naming,
  stowed = false,
  nameRef,
  actionRef,
  className,
}: AccountCornerProps) {
  const wide = useWideLayout();
  const rootRef = useRef<HTMLDivElement | null>(null);
  useStowUp(rootRef, stowed);

  return (
    <div
      ref={rootRef}
      className={cx("ss-corner", stowed && "is-stowed", className)}
      inert={stowed}
    >
      {wide ? (
        <>
          <button
            ref={nameRef}
            type="button"
            className="ss-corner__name"
            aria-label={nameSpoken}
            title={nameSpoken}
            aria-haspopup="dialog"
            aria-expanded={naming}
            onClick={onName}
          >
            <span className="ss-corner__words">{name}</span>
            <PixelGlyph bitmap={PENCIL} unit="ip" />
          </button>
          <button
            ref={actionRef}
            type="button"
            className="ss-corner__go"
            aria-label={actionSpoken}
            title={actionSpoken}
            aria-haspopup="dialog"
            aria-expanded={open}
            onClick={onAction}
          >
            {action}
          </button>
        </>
      ) : (
        <PopupButton
          ref={actionRef}
          icon={PERSON}
          label={phoneLabel}
          onClick={onAction}
          open={open}
          className="ss-acct-btn"
        />
      )}
    </div>
  );
}
