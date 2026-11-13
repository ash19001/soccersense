import {
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type Ref,
  type RefObject,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { IconButton } from "./Button";
import { cx } from "./cx";
import { ModeBadge } from "./ModeBadge";
import { type Bitmap, PixelGlyph } from "./PixelGlyph";
import { isWide, usePixelRootScale } from "./scale";
import { type Slider, createSlider } from "./slide";
import type { UiGrade, UiMode } from "./types";

/** Three bars rising from a base line: the stats button's icon, 9 x 9 like the kit's others. */
export const STATS_ICON: Bitmap = [
  ".......##",
  ".......##",
  "....##.##",
  "....##.##",
  ".##.##.##",
  ".##.##.##",
  ".##.##.##",
  ".........",
  "#########",
];

/** How many whole cells (logical pixels) the tally's bar is long. */
export const STATS_BAR_CELLS = 100;

export interface StatsLabels {
  /** The card's heading, and the dialog's name: "YOUR STATS". */
  heading: string;
  /** The close button's name. */
  close: string;
  /** The line under the heading, and the dialog's description. */
  intro: string;
  /** In place of everything else on a first visit. */
  empty: string;
  /** Over today's result: "TODAY". */
  today: string;
  /** A mode not played today. */
  notPlayed: string;
  /** Read out for each of today's answers: "Question 3: TRIVELA, 60 points". */
  shot: (n: number, shot: string, points: number) => string;
  /** The name of today's list of answers, read out. */
  shots: string;
  /** Read out for today's total: "420 points". */
  total: (total: number) => string;
  played: string;
  average: string;
  best: string;
  /** Under the best total: "DAY 3". */
  bestDay: (day: number) => string;
  /** Read out for the best total: "520 points, on day 3". */
  bestSpoken: (total: number, day: number) => string;
  /** The tally's name, read out: "YOUR ANSWERS". */
  tally: string;
  /** A number there is none of yet (an average with no games): "-". */
  blank: string;
  streak: string;
  /** "3 DAYS" */
  days: (days: number) => string;
  /** "BEST 5" */
  streakBest: (days: number) => string;
  /** Read out for the streak. */
  streakSpoken: (current: number, best: number) => string;
  /** Small print at the foot of the card. */
  disclaimer?: string;
}

/** One of today's answers. */
export interface StatsShot {
  /** The shot, or no answer: its colour. */
  grade: UiGrade;
  /** "TRIVELA": the tooltip. */
  label: string;
  points: number;
}

/** One line of the tally: how many answers went one way. */
export interface StatsTally {
  /** Its colour: a shot, or `timeup` for no answer. */
  grade: UiGrade;
  /** "WORLDIE", "NO ANSWER" */
  label: string;
  count: number;
  /** Its length in the bar, in whole cells (`STATS_BAR_CELLS` in all, between them). */
  cells: number;
}

/** One mode's column. */
export interface StatsModeView {
  mode: UiMode;
  /** "HOME" */
  label: string;
  /** Today's result, or null if it has not been played today. */
  today: { total: number; title: string; shots: readonly StatsShot[] } | null;
  played: number;
  average: number | null;
  best: { total: number; day: number } | null;
  /** The six shots, best first, then no answer. */
  tally: readonly StatsTally[];
}

export interface StatsCardProps {
  labels: StatsLabels;
  /** One per mode, in the menu's order. */
  modes: readonly StatsModeView[];
  /** Days in a row with a finished game, now and at best. */
  streak: { current: number; best: number };
  /** A first visit: nothing finished yet. Only the line and the small print are shown. */
  empty: boolean;
  /** The heading's level: 2 (in the dialog). */
  headingLevel?: 1 | 2;
  /** Beside the heading: the close button. */
  action?: ReactNode;
  className?: string;
}

interface CardIds {
  heading: string;
  intro: string;
}

/**
 * The player's stats on the rules' bolted card: today's result per mode (the total, the
 * title and the seven shots as small tags in their colours), then each mode over the
 * history (games, average, best and its day, and a bar of how the answers went), and the
 * daily streak. On a wide screen it is set in caption pixels with the modes side by side;
 * anywhere else it is one column.
 */
export function StatsCard(props: StatsCardProps) {
  const heading = useId();
  const intro = useId();
  return <Card {...props} ids={{ heading, intro }} />;
}

function Card({
  labels,
  modes,
  streak,
  empty,
  headingLevel = 2,
  action,
  className,
  ids,
  bodyRef,
  bodyFocusable = false,
}: StatsCardProps & {
  ids: CardIds;
  bodyRef?: Ref<HTMLDivElement>;
  bodyFocusable?: boolean;
}) {
  const wide = isWide(usePixelRootScale());
  const Heading = headingLevel === 1 ? "h1" : "h2";
  const Section = headingLevel === 1 ? "h2" : "h3";
  return (
    <div
      className={cx("ss-help ss-stats", className)}
      data-wide={wide ? "" : undefined}
    >
      <div className="ss-help__head">
        <Heading id={ids.heading} className="ss-help__title">
          {labels.heading}
        </Heading>
        {action}
      </div>
      <div
        ref={bodyRef}
        className="ss-help__body ss-stats__body"
        tabIndex={bodyFocusable ? 0 : undefined}
      >
        <p id={ids.intro} className="ss-stats__intro">
          {labels.intro}
        </p>
        {empty ? (
          <p className="ss-stats__empty">{labels.empty}</p>
        ) : (
          <>
            <p className="ss-stats__streak">
              <span className="ss-stats__k" aria-hidden="true">
                {labels.streak}
              </span>
              <span className="ss-stats__v" aria-hidden="true">
                {labels.days(streak.current)}
              </span>
              <span className="ss-stats__sub" aria-hidden="true">
                {labels.streakBest(streak.best)}
              </span>
              <span className="ss-sr">
                {labels.streakSpoken(streak.current, streak.best)}
              </span>
            </p>
            <ul className="ss-stats__modes">
              {modes.map((m) => (
                <ModeColumn
                  key={m.mode}
                  view={m}
                  labels={labels}
                  Section={Section}
                />
              ))}
            </ul>
          </>
        )}
        {labels.disclaimer && <p className="ss-legal">{labels.disclaimer}</p>}
      </div>
    </div>
  );
}

function ModeColumn({
  view,
  labels,
  Section,
}: {
  view: StatsModeView;
  labels: StatsLabels;
  Section: "h2" | "h3";
}) {
  const { today, best } = view;
  return (
    <li className="ss-stats__mode" data-mode={view.mode}>
      <Section className="ss-stats__mode-h">
        <ModeBadge mode={view.mode} label={view.label} />
      </Section>

      <div className="ss-stats__today">
        <span className="ss-stats__k">{labels.today}</span>
        {today ? (
          <>
            <span className="ss-stats__total" aria-hidden="true">
              {today.total}
            </span>
            <span className="ss-sr">{labels.total(today.total)}</span>
            <span className="ss-stats__title">{today.title}</span>
            <ol className="ss-stats__shots" aria-label={labels.shots}>
              {today.shots.map((shot, i) => (
                <li
                  key={i}
                  className="ss-stats__shot"
                  data-grade={shot.grade}
                  title={shot.label}
                >
                  <span aria-hidden="true">{shot.points}</span>
                  <span className="ss-sr">
                    {labels.shot(i + 1, shot.label, shot.points)}
                  </span>
                </li>
              ))}
            </ol>
          </>
        ) : (
          <span className="ss-stats__none">{labels.notPlayed}</span>
        )}
      </div>

      <dl className="ss-stats__nums">
        <div>
          <dt>{labels.played}</dt>
          <dd>{view.played}</dd>
        </div>
        <div>
          <dt>{labels.average}</dt>
          <dd>{view.average ?? labels.blank}</dd>
        </div>
        <div>
          <dt>{labels.best}</dt>
          <dd>
            {best ? (
              <>
                <span aria-hidden="true">
                  {best.total}{" "}
                  <span className="ss-stats__sub">
                    {labels.bestDay(best.day)}
                  </span>
                </span>
                <span className="ss-sr">
                  {labels.bestSpoken(best.total, best.day)}
                </span>
              </>
            ) : (
              labels.blank
            )}
          </dd>
        </div>
      </dl>

      {view.played > 0 && (
        <>
          <div className="ss-stats__bar" aria-hidden="true">
            {view.tally
              .filter((t) => t.cells > 0)
              .map((t) => (
                <span
                  key={t.label}
                  className="ss-stats__cell"
                  data-grade={t.grade}
                  style={{ "--cells": t.cells } as CSSProperties}
                />
              ))}
          </div>
          <ul className="ss-stats__tally" aria-label={labels.tally}>
            {view.tally.map((t) => (
              <li key={t.label} data-grade={t.grade}>
                <span className="ss-stats__tag">{t.label}</span>{" "}
                <span className="ss-stats__count">{t.count}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </li>
  );
}

export interface StatsButtonProps {
  /** Its name for screen readers, and its tooltip: "Your stats". */
  label: string;
  onClick: () => void;
  /** The stats' dialog is up, or not. */
  open?: boolean;
  ref?: Ref<HTMLButtonElement>;
  className?: string;
}

/** The square steel button with the bar chart that opens the stats. */
export function StatsButton({
  label,
  onClick,
  open,
  ref,
  className,
}: StatsButtonProps) {
  return (
    <button
      ref={ref}
      type="button"
      className={cx(
        "ss-btn ss-btn--icon ss-btn--secondary ss-stats-btn",
        className,
      )}
      aria-label={label}
      title={label}
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={onClick}
    >
      <span className="ss-btn__label">
        <PixelGlyph bitmap={STATS_ICON} unit="ip" />
      </span>
    </button>
  );
}

export interface StatsProps extends Omit<
  StatsCardProps,
  "headingLevel" | "action"
> {
  /** Up, or not. The dialog plays its own way out before it asks to be closed. */
  open: boolean;
  /** The close button, Escape or a press outside: called once the card has gone. */
  onClose(): void;
  /** Where the focus goes back to on closing: the stats button. */
  returnFocus?: RefObject<HTMLElement | null>;
}

/** The longest the way out may take before the dialog closes anyway. */
const EXIT_PATIENCE_MS = 400;

/** No motion: the reduced-motion setting, or a browser (or test DOM) that cannot animate. */
function motionless(): boolean {
  if (typeof window.matchMedia !== "function") return true;
  if (typeof document.documentElement.getAnimations !== "function") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** What Tab can reach inside `root`, in order. */
function tabbable(root: HTMLElement): HTMLElement[] {
  const all = root.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
  );
  return [...all].filter(
    (el) => !el.matches(":disabled") && !el.closest("[inert], [hidden]"),
  );
}

/**
 * The stats as a pop-up, built exactly like the rules' (`HowToPlay`, docs/API_UI.md): a
 * modal dialog with the card in the middle of a monitor over a dither of ink, or a sheet on
 * the bottom edge of a phone; the same rise and drop (on whole device pixels, instant under
 * reduced motion), the same ways to close it (the close button, Escape, a press outside),
 * the focus kept inside and given back to `returnFocus`. It uses the rules' own classes
 * for the frame and the motion (`ss-help-dialog`, `ss-help`), so the two never drift apart.
 */
export function Stats({ open, ...rest }: StatsProps) {
  return open ? <Dialog {...rest} /> : null;
}

function Dialog({
  onClose,
  returnFocus,
  className,
  ...card
}: Omit<StatsProps, "open">) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const heading = useId();
  const intro = useId();
  const [phase, setPhase] = useState<
    "waiting" | "rising" | "still" | "leaving"
  >(() => (motionless() ? "still" : "waiting"));
  const [scrolls, setScrolls] = useState(false);
  const scale = usePixelRootScale();
  const wide = isWide(scale);
  const dither = `ss-stats-dither-${heading.replace(/[^\w-]/g, "")}`;

  const state = useRef({ leaving: false, done: false, timer: 0, phase });
  const onCloseRef = useRef(onClose);
  const returnRef = useRef(returnFocus);
  useEffect(() => {
    onCloseRef.current = onClose;
    returnRef.current = returnFocus;
    state.current.phase = phase;
  });

  const finish = useCallback(() => {
    const st = state.current;
    if (st.done) return;
    st.done = true;
    window.clearTimeout(st.timer);
    onCloseRef.current();
  }, []);

  const requestClose = useCallback(() => {
    const st = state.current;
    if (st.leaving || st.done) return;
    st.leaving = true;
    if (st.phase === "waiting" || motionless()) {
      finish();
      return;
    }
    setPhase("leaving");
    st.timer = window.setTimeout(finish, EXIT_PATIENCE_MS);
  }, [finish]);

  // Below the screen until the dialog's first frame has been drawn, then it rises.
  useEffect(() => {
    if (phase !== "waiting") return;
    let second = 0;
    const first = window.requestAnimationFrame(() => {
      second = window.requestAnimationFrame(() => {
        setPhase((now) => (now === "waiting" ? "rising" : now));
      });
    });
    return () => {
      window.cancelAnimationFrame(first);
      window.cancelAnimationFrame(second);
    };
  }, [phase]);

  // Up as a modal dialog: in the top layer, the rest of the page inert behind it.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const st = state.current;
    st.leaving = false;
    st.done = false;
    const active = document.activeElement;
    const opener =
      active instanceof HTMLElement && active !== document.body ? active : null;
    try {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    } catch {
      dialog.setAttribute("open", "");
    }
    closeRef.current?.focus({ preventScroll: true });

    const onNativeClose = () => {
      if (!dialog.open) finish();
    };
    const onCancel = (event: Event) => {
      event.preventDefault();
      requestClose();
    };
    const onAnimationEnd = (event: AnimationEvent) => {
      if (event.animationName === "ss-help-out") finish();
    };
    dialog.addEventListener("close", onNativeClose);
    dialog.addEventListener("cancel", onCancel);
    dialog.addEventListener("animationend", onAnimationEnd);
    return () => {
      dialog.removeEventListener("close", onNativeClose);
      dialog.removeEventListener("cancel", onCancel);
      dialog.removeEventListener("animationend", onAnimationEnd);
      window.clearTimeout(st.timer);
      if (dialog.open) {
        if (typeof dialog.close === "function") dialog.close();
        else dialog.removeAttribute("open");
      }
      const back = returnRef.current?.current ?? opener;
      if (back?.isConnected) back.focus({ preventScroll: true });
    };
  }, [finish, requestClose]);

  // A phone: the sheet rises from below the screen and drops back with a slide.
  const sheetSlide = useRef<Slider | null>(null);
  const sheetDrop = useRef(0);
  useLayoutEffect(() => {
    if (wide || (phase !== "rising" && phase !== "leaving")) return;
    const sheet = () =>
      dialogRef.current?.querySelector<HTMLElement>(":scope > .ss-help") ??
      null;
    const card = sheet();
    if (!card) return;
    const slider = (sheetSlide.current ??= createSlider({
      apply: (y) =>
        sheet()?.style.setProperty("transform", `translateY(${y}px)`),
      end: () => {
        if (state.current.leaving) finish();
        else sheet()?.style.removeProperty("transform");
      },
      bounds: [0, Infinity],
    }));
    if (phase === "rising") {
      const top = card.getBoundingClientRect().top;
      sheetDrop.current = Math.max(0, Math.ceil(window.innerHeight - top));
      slider.to(0, sheetDrop.current);
    } else {
      slider.to(sheetDrop.current, 0);
    }
  }, [phase, wide, finish]);
  useEffect(() => () => sheetSlide.current?.stop(), []);

  // The body takes the focus by Tab only while it scrolls.
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const measure = () => setScrolls(body.scrollHeight > body.clientHeight + 1);
    measure();
    if (typeof ResizeObserver !== "function") return;
    const observer = new ResizeObserver(measure);
    observer.observe(body);
    return () => observer.disconnect();
  }, []);

  const pressedOutside = useRef(false);

  const onKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      requestClose();
      return;
    }
    if (event.key !== "Tab") return;
    const dialog = event.currentTarget;
    const stops = tabbable(dialog);
    const first = stops[0];
    const last = stops.at(-1);
    if (!first || !last) {
      event.preventDefault();
      return;
    }
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !dialog.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (
      !event.shiftKey &&
      (active === last || !dialog.contains(active))
    ) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className={cx("ss-help-dialog ss-stats-dialog", `is-${phase}`, className)}
      data-wide={wide ? "" : undefined}
      aria-labelledby={heading}
      aria-describedby={intro}
      onKeyDown={onKeyDown}
      onPointerDown={(event: PointerEvent<HTMLDialogElement>) => {
        pressedOutside.current = event.target === event.currentTarget;
      }}
      onClick={(event: MouseEvent<HTMLDialogElement>) => {
        const outside =
          event.target === event.currentTarget && pressedOutside.current;
        pressedOutside.current = false;
        if (outside) requestClose();
      }}
    >
      {wide && (
        <svg
          className="ss-help-dialog__dither"
          aria-hidden="true"
          focusable="false"
          viewBox={`0 0 ${scale.logicalW} ${scale.logicalH}`}
          preserveAspectRatio="none"
          shapeRendering="crispEdges"
          style={{
            width: `calc(var(--px) * ${scale.logicalW})`,
            height: `calc(var(--px) * ${scale.logicalH})`,
          }}
        >
          <defs>
            <pattern
              id={dither}
              width="2"
              height="2"
              patternUnits="userSpaceOnUse"
            >
              <path d="M0 0h1v1H0zM1 1h1v1H1z" fill="currentColor" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#${dither})`} />
        </svg>
      )}
      <Card
        {...card}
        ids={{ heading, intro }}
        bodyRef={bodyRef}
        bodyFocusable={scrolls}
        action={
          <IconButton
            ref={closeRef}
            icon="close"
            label={card.labels.close}
            variant="secondary"
            className="ss-help__close"
            onClick={requestClose}
          />
        }
      />
    </dialog>
  );
}
