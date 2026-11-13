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
import {
  type Bitmap,
  type GlyphLayer,
  PixelGlyph,
  bitmapSize,
} from "./PixelGlyph";
import { PopupButton } from "./Popup";
import { REVIEW_ICON, SHARE_ICON, TICK_ICON } from "./ResultIcons";
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
  /**
   * The mode's picture, before its badge on a card not played yet: rows of "w" and "."
   * (the ball's art, `MODE_PICTURES` in app/art/ball-icons.ts), drawn in the mode's colour
   * in font pixels. Leave out for none.
   */
  picture?: Bitmap;
  /**
   * The score if this mode was already played today. A mode is played once a day, so its
   * card is then no longer a button: an amber points box, the badge and the REVIEW button
   * (`review`) in place of the picture, the badge and the line.
   */
  score?: number | null;
  /** Read out for the score: "Played today: 347 points". */
  scoreSpoken?: string;
}

/** The picture's ink: the "w" cells of the ball's art, in the current colour. */
const PICTURE_LAYERS: readonly GlyphLayer[] = [{ char: "w" }];

/**
 * Every picture stands in a box this many font pixels square (the largest is 18 x 18), in
 * its middle to the whole font pixel, so the four line up and none lands on half a pixel.
 */
export const PICTURE_BOX = 18;

/** A picture in its box: the whole font pixels left above it and before it. */
function picture(bitmap: Bitmap) {
  const { w, h } = bitmapSize(bitmap);
  const top = Math.max(0, Math.floor((PICTURE_BOX - h) / 2));
  const left = Math.max(0, Math.floor((PICTURE_BOX - w) / 2));
  return (
    <span
      className="ss-menu__pic"
      aria-hidden="true"
      style={{
        paddingTop: `calc(var(--fp) * ${top})`,
        paddingLeft: `calc(var(--fp) * ${left})`,
      }}
    >
      <PixelGlyph bitmap={bitmap} layers={PICTURE_LAYERS} unit="fp" />
    </span>
  );
}

export interface MenuCaptionsProps {
  /**
   * The open modes, in pairs: HOME then AWAY, then RETRO then NEXT-GEN. Each pair is a row,
   * the first of it on the left of the centre line and the second on the right.
   */
  modes: readonly MenuModeCaption[];
  /**
   * With this the cards of the modes not played today are real buttons, so the menu also
   * works without the ball on the canvas (keyboard, screen readers).
   */
  onSelect?: (mode: UiMode) => void;
  /**
   * The REVIEW button on the card of a mode played today (one with a score): a square icon
   * button (`REVIEW_ICON`), its name for screen readers and its tooltip ("Review your HOME
   * game", from the mode's label), what a press does, and `open`: the mode whose review is
   * up. Leave it out for no button.
   */
  review?: {
    spoken: (mode: string) => string;
    onClick: (mode: UiMode) => void;
    open?: UiMode | null;
  };
  /**
   * The SHARE button beside REVIEW (`SHARE_ICON`): its name ("Share your HOME game"), what
   * a press does (the page shares that mode's game as its full-time card does), `busy`:
   * the mode whose picture is still being made (its button is marked busy), and `done`:
   * the mode whose SHARE has just worked (its icon is a green tick for a moment).
   */
  share?: {
    spoken: (mode: string) => string;
    onClick: (mode: UiMode) => void;
    busy?: UiMode | null;
    done?: UiMode | null;
  };
  /**
   * The mouse is over a card or the keyboard's focus is on it (`null`: neither any more).
   * The page lights that mode's patch on the ball with it. Only called on a change.
   */
  onHover?: (mode: UiMode | null) => void;
  /**
   * Light this card as if it were hovered: the pointer is over its patch on the ball. A
   * played card is never lit, and never reports a hover (`onHover`): it plays nothing.
   */
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
 * the sound switch, the stats button; in a card not played the picture, the badge, the
 * line, the short line, the tiny line; and in a played one (a mode is played once a day:
 * it is no button) the score, the badge, and REVIEW and SHARE (icons) together (ui.css
 * section 28).
 */
export function MenuCaptions({
  modes,
  onSelect,
  review,
  share,
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

  // A card that has just been played (a game finished in another tab) lets go of its hover.
  const played = modes
    .filter((item) => item.score !== undefined && item.score !== null)
    .map((item) => item.mode)
    .join(" ");
  useEffect(() => {
    const done = new Set(played.split(" "));
    let changed = false;
    if (pointed.current && done.has(pointed.current)) {
      pointed.current = null;
      changed = true;
    }
    if (focused.current && done.has(focused.current)) {
      focused.current = null;
      changed = true;
    }
    if (changed) tell();
  }, [played, tell]);

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
          const badge = (
            <span className="ss-menu__top">
              <ModeBadge mode={item.mode} label={item.label} />
            </span>
          );
          if (item.score !== undefined && item.score !== null) {
            // Played today, and played once a day: the score, the badge and REVIEW. It is
            // not a way to the ball's patch any more: the two no longer light each other.
            return (
              <div
                key={item.mode}
                className="ss-menu__card is-played"
                data-mode={item.mode}
              >
                <span
                  className="ss-menu__score"
                  aria-hidden={item.scoreSpoken ? true : undefined}
                >
                  {Math.round(item.score)}
                </span>
                {item.scoreSpoken && (
                  <span className="ss-sr">{item.scoreSpoken}</span>
                )}
                {badge}
                {(review || share) && (
                  <span className="ss-menu__acts">
                    {review && (
                      <PopupButton
                        icon={REVIEW_ICON}
                        label={review.spoken(item.label)}
                        onClick={() => review.onClick(item.mode)}
                        open={review.open === item.mode}
                        className="ss-menu__review"
                      />
                    )}
                    {share && (
                      <button
                        type="button"
                        className={cx(
                          "ss-btn ss-btn--icon ss-btn--secondary ss-menu__share",
                          share.done === item.mode && "is-done",
                        )}
                        aria-label={share.spoken(item.label)}
                        title={share.spoken(item.label)}
                        // busy, not disabled: the focus stays on it
                        aria-busy={share.busy === item.mode || undefined}
                        onClick={() => share.onClick(item.mode)}
                      >
                        <span className="ss-btn__label">
                          <PixelGlyph
                            bitmap={
                              share.done === item.mode ? TICK_ICON : SHARE_ICON
                            }
                            unit="ip"
                          />
                        </span>
                      </button>
                    )}
                  </span>
                )}
              </div>
            );
          }
          const inner = (
            <>
              {item.picture && picture(item.picture)}
              {badge}
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
            item.picture !== undefined && "has-pic",
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
