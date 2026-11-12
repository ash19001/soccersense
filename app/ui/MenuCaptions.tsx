import {
  type FocusEvent,
  type PointerEvent as ReactPointerEvent,
  type Ref,
  useCallback,
  useEffect,
  useRef,
} from "react";

import { strings } from "~/i18n";

import { IconButton } from "./Button";
import { cx } from "./cx";
import { ModeBadge } from "./ModeBadge";
import { SoundToggle, type SoundToggleLabels } from "./SoundToggle";
import type { UiMode } from "./types";
import { useStowSlide } from "./useStowSlide";

export interface MenuModeCaption {
  mode: UiMode;
  /** "HOME" */
  label: string;
  /** One line: "Closest to the stadium wins" */
  line: string;
  /** The score if this mode was already played today: an amber points box by the badge. */
  score?: number | null;
  /** Read out for the score: "Played today: 347 points". */
  scoreSpoken?: string;
}

export interface MenuCaptionsProps {
  /** HOME then AWAY: they sit left and right, under the two patches of the ball. */
  modes: readonly MenuModeCaption[];
  /**
   * With this the cards are real buttons, so the menu also works without the ball on the
   * canvas (keyboard, screen readers).
   */
  onSelect?: (mode: UiMode) => void;
  /**
   * The mouse is over a card or the keyboard's focus is on it (`null`: neither any more).
   * The page lights that mode's patch on the ball with it. Only called on a change.
   */
  onHover?: (mode: UiMode | null) => void;
  /** Light this card as if it were hovered: the pointer is over its patch on the ball. */
  lit?: UiMode | null;
  /**
   * A short line on a plate that floats above the cards, for example after a locked patch
   * was pressed. It is announced to screen readers. `null` or nothing: no plate.
   */
  notice?: string | null;
  /** Change it to have the same notice announced again. */
  noticeKey?: number;
  /**
   * Step out of the way: the captions drop off the screen and can no longer be pressed,
   * focused or read out. The page sets it when the kick-off starts.
   */
  stowed?: boolean;
  /**
   * The "?" button. Give `to` for a link or `onClick` for a button. With `open` (the rules'
   * dialog is up, or not) the button says that it opens a dialog.
   */
  howToPlay: {
    label: string;
    to?: string;
    onClick?: () => void;
    open?: boolean;
  };
  /** The "?" button (when it is a button), for the dialog to give the focus back to. */
  howToPlayRef?: Ref<HTMLButtonElement>;
  /** "DAY 12" */
  dayLabel: string;
  /**
   * The sound switch beside the "?" button, with these words (default: `strings.sound`), or
   * `false` for none.
   */
  sound?: SoundToggleLabels | false;
  className?: string;
}

/** Focus that came from the keyboard. Where the browser cannot say, any focus counts. */
function focusShows(el: Element): boolean {
  try {
    return el.matches(":focus-visible");
  } catch {
    return true;
  }
}

/**
 * What sits under the ball on the home screen. The markup is the same everywhere; the
 * layout is ui.css section 15, and there are two.
 *
 * On a phone: two cards side by side in the column (the badge over the line), with the day
 * over the "?" and sound buttons, side by side, at their right.
 *
 * On a wide screen (inside a `GameLayout` that is `data-wide`): one row across the foot of
 * the picture, in caption pixels. The gap between the two cards is on the screen's centre
 * line, the badges meet there, each line runs outwards from its badge, and a score sits by
 * its badge like the score in a result. The day and the "?" and sound buttons hang off the
 * row's two ends, and the notice stands beside the ball instead of under it.
 *
 * The wide row is placed with CSS `order` and by position (the first card, the last card),
 * so keep the children in this order: the notice, the cards (HOME then AWAY), the day, the
 * "?" button, the sound switch; and in a card the badge, the score, the line.
 */
export function MenuCaptions({
  modes,
  onSelect,
  onHover,
  lit = null,
  notice = null,
  noticeKey,
  stowed = false,
  howToPlay,
  howToPlayRef,
  dayLabel,
  sound = strings.sound,
  className,
}: MenuCaptionsProps) {
  // Which card the mouse is over, which one has the keyboard's focus, and what the page
  // was last told. The mouse wins while it is over a card.
  const pointed = useRef<UiMode | null>(null);
  const focused = useRef<UiMode | null>(null);
  const told = useRef<UiMode | null>(null);
  const onHoverRef = useRef(onHover);
  useEffect(() => {
    onHoverRef.current = onHover;
  }, [onHover]);

  const tell = useCallback(() => {
    const next = pointed.current ?? focused.current;
    if (next === told.current) return;
    told.current = next;
    onHoverRef.current?.(next);
  }, []);

  // At the kick-off they slide down off the screen (with the phone's trophy button).
  const rootRef = useRef<HTMLDivElement | null>(null);
  useStowSlide(rootRef, stowed);

  // Stowed captions are neither hovered nor focused, whatever the browser last reported.
  useEffect(() => {
    if (!stowed) return;
    pointed.current = null;
    focused.current = null;
    tell();
  }, [stowed, tell]);

  const handlers = (mode: UiMode) => ({
    onPointerEnter: (event: ReactPointerEvent<HTMLElement>) => {
      // A finger does not hover: its tap is the choice.
      if (event.pointerType === "touch") return;
      pointed.current = mode;
      tell();
    },
    onPointerLeave: () => {
      if (pointed.current !== mode) return;
      pointed.current = null;
      tell();
    },
    onFocus: (event: FocusEvent<HTMLElement>) => {
      if (!focusShows(event.currentTarget)) return;
      focused.current = mode;
      tell();
    },
    onBlur: () => {
      if (focused.current !== mode) return;
      focused.current = null;
      tell();
    },
  });

  return (
    <div
      ref={rootRef}
      className={cx("ss-menu", stowed && "is-stowed", className)}
      inert={stowed}
      data-stow=""
    >
      <p
        className={cx("ss-menu__notice", !notice && "is-empty")}
        role="status"
        aria-live="polite"
      >
        <span className="ss-menu__lamp" aria-hidden="true" />
        {/* A fresh node for every notice, so the same words are announced again. */}
        <span key={noticeKey ?? 0}>{notice}</span>
      </p>
      <div className="ss-menu__modes">
        {modes.map((item) => {
          const inner = (
            <>
              <span className="ss-menu__top">
                <ModeBadge mode={item.mode} label={item.label} />
                {item.score !== undefined && item.score !== null && (
                  <>
                    <span
                      className="ss-menu__score"
                      aria-hidden={item.scoreSpoken ? true : undefined}
                    >
                      {Math.round(item.score)}
                    </span>
                    {item.scoreSpoken && (
                      <span className="ss-sr">{item.scoreSpoken}</span>
                    )}
                  </>
                )}
              </span>
              <span className="ss-menu__line">{item.line}</span>
            </>
          );
          const cardClass = cx("ss-menu__card", lit === item.mode && "is-lit");
          return onSelect ? (
            <button
              key={item.mode}
              type="button"
              className={cardClass}
              data-mode={item.mode}
              onClick={() => onSelect(item.mode)}
              {...handlers(item.mode)}
            >
              {inner}
            </button>
          ) : (
            <div key={item.mode} className={cardClass} data-mode={item.mode}>
              {inner}
            </div>
          );
        })}
      </div>
      <div className="ss-menu__side" data-sound={sound ? "" : undefined}>
        <span className="ss-menu__day">{dayLabel}</span>
        <IconButton
          ref={howToPlayRef}
          icon="question"
          label={howToPlay.label}
          to={howToPlay.to}
          onClick={howToPlay.onClick}
          aria-haspopup={howToPlay.open === undefined ? undefined : "dialog"}
          aria-expanded={howToPlay.open}
          variant="secondary"
        />
        {sound && <SoundToggle labels={sound} />}
      </div>
    </div>
  );
}
