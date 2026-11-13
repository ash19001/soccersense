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
import { isWide, usePixelRootScale } from "./scale";
import { type Slider, createSlider } from "./slide";
import type { UiGrade } from "./types";

export interface HowToPlayLabels {
  /** The card's heading, and the dialog's name: "HOW TO PLAY". */
  heading: string;
  /** The close button's name: "Close". */
  close: string;
  /** The one line under the heading, and the dialog's description: "7 questions a day...". */
  intro: string;
  /** Over the shots: "POINTS". */
  shots: string;
  /** Read out for a shot's number: "100 points". */
  points: (points: number) => string;
  /** Over the ladder: "YOUR CAREER". */
  career: string;
  /** Read out for each step of the ladder: "SUNDAY LEAGUE, from 90 points". */
  step: (tier: string, from: number) => string;
  /** Small print at the foot of the card: that the game is independent (`strings.legal`). */
  disclaimer?: string;
}

export interface HowToPlayShot {
  /** The shot, which is also its colour. */
  grade: UiGrade;
  /** "WORLDIE" */
  label: string;
  points: number;
}

export interface HowToPlayTier {
  /** "PARK KICKABOUT" */
  name: string;
  /** The total it is reached at. */
  from: number;
}

export interface HowToPlayCardProps {
  labels: HowToPlayLabels;
  /** The six shots, best first. */
  shots: readonly HowToPlayShot[];
  /** The career's tiers, from the park up: drawn as a ladder, the two ends named. */
  tiers: readonly HowToPlayTier[];
  /** The heading's level: 2 in the dialog (the default), 1 on a page of its own. */
  headingLevel?: 1 | 2;
  /** The heading element, for a page that gives it the focus on arrival. */
  headingRef?: Ref<HTMLHeadingElement>;
  /** Beside the heading: the close button. */
  action?: ReactNode;
  className?: string;
}

/** The parts the dialog points at. */
interface CardIds {
  heading: string;
  intro: string;
}

/**
 * The rules on one bolted card: a line on the day, the six shots in their colours with their
 * points, and the career's ladder. On a wide screen it is set in caption pixels, the shots
 * and the career side by side under the line; anywhere else it is one column.
 */
export function HowToPlayCard(props: HowToPlayCardProps) {
  const heading = useId();
  const intro = useId();
  return <Card {...props} ids={{ heading, intro }} />;
}

function Card({
  labels,
  shots,
  tiers,
  headingLevel = 2,
  headingRef,
  action,
  className,
  ids,
  bodyRef,
  bodyFocusable = false,
}: HowToPlayCardProps & {
  ids: CardIds;
  bodyRef?: Ref<HTMLDivElement>;
  /** The body scrolls: it takes the focus by Tab, so the keyboard can scroll it. */
  bodyFocusable?: boolean;
}) {
  const wide = isWide(usePixelRootScale());
  const Heading = headingLevel === 1 ? "h1" : "h2";
  const Section = headingLevel === 1 ? "h2" : "h3";
  const first = tiers[0];
  const last = tiers.at(-1);
  return (
    <div className={cx("ss-help", className)} data-wide={wide ? "" : undefined}>
      <div className="ss-help__head">
        <Heading
          ref={headingRef}
          id={ids.heading}
          tabIndex={headingRef ? -1 : undefined}
          className="ss-help__title"
        >
          {labels.heading}
        </Heading>
        {action}
      </div>
      <div
        ref={bodyRef}
        className="ss-help__body"
        tabIndex={bodyFocusable ? 0 : undefined}
      >
        <p id={ids.intro} className="ss-help__intro">
          {labels.intro}
        </p>

        <section className="ss-help__part ss-help__part--shots">
          <Section className="ss-help__h">{labels.shots}</Section>
          <ul className="ss-help__shots">
            {shots.map((shot) => (
              <li
                key={shot.grade}
                className="ss-help__shot"
                data-grade={shot.grade}
              >
                <span className="ss-help__tag">{shot.label}</span>
                <span className="ss-help__pts" aria-hidden="true">
                  {shot.points}
                </span>
                <span className="ss-sr">{labels.points(shot.points)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="ss-help__part ss-help__part--career">
          <Section className="ss-help__h">{labels.career}</Section>
          <ol className="ss-help__ladder">
            {tiers.map((tier, i) => (
              <li
                key={tier.name}
                className={cx(
                  "ss-help__step",
                  i === tiers.length - 1 && "is-top",
                )}
                style={{ "--step": i + 1 } as CSSProperties}
              >
                <span className="ss-sr">
                  {labels.step(tier.name, tier.from)}
                </span>
              </li>
            ))}
          </ol>
          {first && last && (
            <p className="ss-help__ends" aria-hidden="true">
              <span>{first.name}</span>
              <span className="ss-help__top">{last.name}</span>
            </p>
          )}
        </section>

        {labels.disclaimer && <p className="ss-legal">{labels.disclaimer}</p>}
      </div>
    </div>
  );
}

export interface HowToPlayProps extends Omit<
  HowToPlayCardProps,
  "headingLevel" | "headingRef" | "action"
> {
  /** Up, or not. The dialog plays its own way out before it asks to be closed. */
  open: boolean;
  /**
   * The close button, Escape or a press outside the card: called once the card has gone
   * (after its exit, or at once under reduced motion). Set `open` to false then.
   */
  onClose(): void;
  /**
   * Where the focus goes back to on closing: the "?" button. Without it, whatever had the
   * focus when the dialog opened (if anything did).
   */
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
 * How to play, as a pop-up: a modal dialog with the rules on a bolted card. On a wide
 * screen it is a card in the middle of the picture, over a dither of ink; anywhere else it
 * is a sheet standing on the bottom of the screen, as tall as its content. It rises into
 * place when it opens and drops away when it closes (about a quarter of a second, eased,
 * on whole device pixels; instant under reduced motion).
 *
 * It closes by its close button, Escape and a press outside the card. While it is up the
 * focus stays inside it, the page behind is out of reach (no pointer reaches the canvas)
 * and does not scroll. The focus goes to the close button on opening and back to
 * `returnFocus` on closing. Use it inside a `PixelRoot` (a `GameLayout`).
 */
export function HowToPlay({ open, ...rest }: HowToPlayProps) {
  return open ? <Dialog {...rest} /> : null;
}

function Dialog({
  onClose,
  returnFocus,
  className,
  ...card
}: Omit<HowToPlayProps, "open">) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const heading = useId();
  const intro = useId();
  /**
   * Where the card is: waiting below the screen for its first frame to be drawn, rising,
   * at rest (no motion), or dropping away.
   */
  const [phase, setPhase] = useState<
    "waiting" | "rising" | "still" | "leaving"
  >(() => (motionless() ? "still" : "waiting"));
  const [scrolls, setScrolls] = useState(false);
  const scale = usePixelRootScale();
  const wide = isWide(scale);
  const dither = `ss-help-dither-${heading.replace(/[^\w-]/g, "")}`;

  /** Asked to close, and when; whether the page has been told; the phase, for handlers. */
  const state = useRef({ leaving: false, done: false, timer: 0, phase });

  // The latest callbacks and phase, for listeners that are set up once.
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
    // Still below the screen (or no motion): nothing to see go.
    if (st.phase === "waiting" || motionless()) {
      finish();
      return;
    }
    setPhase("leaving");
    st.timer = window.setTimeout(finish, EXIT_PATIENCE_MS);
  }, [finish]);

  // The card waits below the screen until the dialog's first frame has been drawn (laying
  // the card out can take a long frame of its own, which would eat the start of the rise),
  // then rises: so the whole way up is seen.
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

    // Escape, where the browser closes the dialog itself before the way out could play.
    // (Not the close event of a dialog that is open again: strict mode's second mount.)
    const onNativeClose = () => {
      if (!dialog.open) finish();
    };
    // Escape: play the way out first.
    const onCancel = (event: Event) => {
      event.preventDefault();
      requestClose();
    };
    // The card's way out has ended (the event bubbles up from the card).
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

  // A phone: the sheet rises from below the screen and drops back with a slide (every
  // frame, eased, on whole device pixels), like the leaderboard's sheet; it is asked to be
  // closed once it is gone. (A monitor's card has its own animation, in the CSS.)
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
      // From just below the screen: as far as the sheet stands above its bottom edge.
      const top = card.getBoundingClientRect().top;
      sheetDrop.current = Math.max(0, Math.ceil(window.innerHeight - top));
      slider.to(0, sheetDrop.current);
    } else {
      slider.to(sheetDrop.current, 0);
    }
  }, [phase, wide, finish]);
  useEffect(() => () => sheetSlide.current?.stop(), []);

  // The body takes the focus by Tab only while it scrolls (a phone, a short window).
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

  /** A press that started on the backdrop: only then does its click close the dialog. */
  const pressedOutside = useRef(false);

  const onKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === "Escape") {
      // Before the browser's own close request, which it may not let us delay.
      event.preventDefault();
      requestClose();
      return;
    }
    if (event.key !== "Tab") return;
    // The focus goes round inside the dialog, never out of it to the browser.
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
      className={cx("ss-help-dialog", `is-${phase}`, className)}
      data-wide={wide ? "" : undefined}
      aria-labelledby={heading}
      aria-describedby={intro}
      onKeyDown={onKeyDown}
      // The dialog is the whole screen and the card is in it: a press on the dialog itself
      // is a press outside the card.
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
      {/*
       * On a monitor the picture behind is dimmed by a dither of ink, every other logical
       * pixel, on the same grid as the picture's pixels: crisp, and no fade.
       */}
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
