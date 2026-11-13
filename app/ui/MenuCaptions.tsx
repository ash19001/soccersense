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
import { PopupButton } from "./Popup";
import { BELL } from "./RemindMe";
import { SoundToggle, type SoundToggleLabels } from "./SoundToggle";
import { StatsButton } from "./Stats";
import { Streak, type StreakProps } from "./Streak";
import { HEART } from "./Support";
import type { UiMode } from "./types";
import { useStowSlide } from "./useStowSlide";

export interface MenuModeCaption {
  mode: UiMode;
  /** "HOME" */
  label: string;
  /** One line: "The most common answer wins". Read out everywhere; shown on a monitor. */
  line: string;
  /**
   * The same, shorter: "Most common wins". Shown in place of `line` (which screen readers
   * still hear). Leave out to show `line`.
   */
  short?: string;
  /** Shorter still, for a phone's cards: "Most common". Leave out to show `short` there. */
  tiny?: string;
  /** The score if this mode was already played today: an amber points box by the badge. */
  score?: number | null;
  /** Read out for the score: "Played today: 347 points". */
  scoreSpoken?: string;
}

export interface MenuCaptionsProps {
  /**
   * The open modes, in pairs: HOME then AWAY, then RETRO then NEXT-GEN. Each pair is a row,
   * the first of it on the left of the centre line and the second on the right.
   */
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
  /** The daily streak, a flame and the days in a row after the day. Leave out for none. */
  streak?: StreakProps;
  /**
   * The sound switch beside the "?" button, with these words (default: `strings.sound`), or
   * `false` for none.
   */
  sound?: SoundToggleLabels | false;
  /**
   * The stats button beside the "?" and the sound switch: its name and what a press does,
   * and `open` while the stats' dialog is up. Leave it out for none.
   */
  stats?: { label: string; onClick: () => void; open?: boolean };
  /** The stats button, for the dialog to give the focus back to. */
  statsRef?: Ref<HTMLButtonElement>;
  /**
   * The bell that opens the daily reminder (`RemindMe`): its name and what a press does,
   * and `open` while its dialog is up. It stands beside the day plate, over the heart.
   * Leave it out for none.
   */
  remind?: { label: string; onClick: () => void; open?: boolean };
  /** The bell, for the dialog to give the focus back to. */
  remindRef?: Ref<HTMLButtonElement>;
  /** The heart that opens Support (`Support`), the same way. Leave it out for none. */
  support?: { label: string; onClick: () => void; open?: boolean };
  /** The heart, for the dialog to give the focus back to. */
  supportRef?: Ref<HTMLButtonElement>;
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
 * On a phone: the cards two by two across the column (the badge beside the tiny line; on a
 * phone too short for that, the four badges alone in one row), the day plate over the left
 * end of them and the "?", sound and stats buttons stacked up the
 * right edge of the screen beside the ball (over the leaderboard's trophy).
 *
 * On a wide screen (inside a `GameLayout` that is `data-wide`): two rows across the foot of
 * the picture, in caption pixels, a pair of cards in each. The gap between the cards of a
 * pair is on the screen's centre line, the badges meet there, each line runs outwards from
 * its badge, and a score sits by its badge like the score in a result. The day hangs off
 * the rows' left end, the "?" and sound buttons off the first row's right end and the
 * stats button under the "?", and the notice stands beside the ball instead of under it.
 *
 * The bell (Remind me) and the heart (Support) stand beside the day plate, at the other end
 * from the "?": on a monitor a column of two off the plate's left end, one to a row; on a
 * phone stacked up the left edge above the plate, the mirror of the "?", sound and stats
 * buttons. They are inside the day plate in the markup (after the day and the streak), so
 * that they follow it whatever its width (ui.css section 27).
 *
 * The wide rows are placed with CSS `order` and by position (odd and even cards), so keep
 * the children in this order: the notice, the cards (in pairs), the day, the "?" button,
 * the sound switch, the stats button; and in a card the badge, the score, the line, the
 * short line, the tiny line.
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
  streak,
  sound = strings.sound,
  stats,
  statsRef,
  remind,
  remindRef,
  support,
  supportRef,
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
              {item.short !== undefined && (
                <span className="ss-menu__short" aria-hidden="true">
                  {item.short}
                </span>
              )}
              {item.short !== undefined && item.tiny !== undefined && (
                <span className="ss-menu__tiny" aria-hidden="true">
                  {item.tiny}
                </span>
              )}
            </>
          );
          const cardClass = cx(
            "ss-menu__card",
            lit === item.mode && "is-lit",
            item.short !== undefined && "has-short",
          );
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
      <div
        className="ss-menu__side"
        data-sound={sound ? "" : undefined}
        data-stats={stats ? "" : undefined}
      >
        <span className="ss-menu__day">
          {dayLabel}
          {streak && <Streak {...streak} />}
          {(remind || support) && (
            <span className="ss-menu__more">
              {remind && (
                <PopupButton
                  ref={remindRef}
                  icon={BELL}
                  label={remind.label}
                  onClick={remind.onClick}
                  open={remind.open}
                  className="ss-remind-btn"
                />
              )}
              {support && (
                <PopupButton
                  ref={supportRef}
                  icon={HEART}
                  label={support.label}
                  onClick={support.onClick}
                  open={support.open}
                  className="ss-support-btn"
                />
              )}
            </span>
          )}
        </span>
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
        {stats && (
          <StatsButton
            ref={statsRef}
            label={stats.label}
            onClick={stats.onClick}
            open={stats.open}
          />
        )}
      </div>
    </div>
  );
}
