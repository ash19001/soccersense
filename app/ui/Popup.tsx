import {
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
import { type Bitmap, PixelGlyph } from "./PixelGlyph";
import { isWide, usePixelRootScale } from "./scale";
import { type Slider, createSlider } from "./slide";

export interface PopupProps {
  /** Up, or not. The dialog plays its own way out before it asks to be closed. */
  open: boolean;
  /** The card's heading, and the dialog's name. */
  heading: string;
  /** The line under the heading, and the dialog's description. Leave out for none. */
  intro?: string;
  /** The close button's name. */
  close: string;
  /** The close button, Escape or a press outside: called once the card has gone. */
  onClose(): void;
  /** Where the focus goes back to on closing: the button that opened it. */
  returnFocus?: RefObject<HTMLElement | null>;
  /**
   * A button of the card's own in its head, just before the close button (the review's
   * SHARE). Give it the class `ss-popup__action`.
   */
  action?: ReactNode;
  /** What follows the line. */
  children?: ReactNode;
  /** On the card (`ss-help ss-popup`), for its own styles. */
  className?: string;
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
 * A small pop-up over the home screen, built like the rules' and the stats' (`HowToPlay`,
 * `Stats`): a modal dialog with a bolted card in the middle of a monitor over a dither of
 * ink, or a sheet on the bottom edge of a phone; the same rise and drop (on whole device
 * pixels, instant under reduced motion), the same ways to close it (the close button,
 * Escape, a press outside), the focus kept inside and given back to `returnFocus`. It uses
 * the rules' classes for the frame and the motion (`ss-help-dialog`, `ss-help`), with
 * `ss-popup` on the card: narrower than the rules', one column. `RemindMe` and `Support`
 * are built on it.
 */
export function Popup({ open, ...rest }: PopupProps) {
  return open ? <Dialog {...rest} /> : null;
}

function Dialog({
  heading,
  intro,
  close,
  onClose,
  returnFocus,
  action,
  children,
  className,
}: Omit<PopupProps, "open">) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const headingId = useId();
  const introId = useId();
  const [phase, setPhase] = useState<
    "waiting" | "rising" | "still" | "leaving"
  >(() => (motionless() ? "still" : "waiting"));
  const [scrolls, setScrolls] = useState(false);
  const scale = usePixelRootScale();
  const wide = isWide(scale);
  const dither = `ss-popup-dither-${headingId.replace(/[^\w-]/g, "")}`;

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
      className={cx("ss-help-dialog ss-popup-dialog", `is-${phase}`)}
      data-wide={wide ? "" : undefined}
      aria-labelledby={headingId}
      aria-describedby={intro ? introId : undefined}
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
      <div
        className={cx("ss-help ss-popup", className)}
        data-wide={wide ? "" : undefined}
      >
        <div className="ss-help__head">
          <h2 id={headingId} className="ss-help__title">
            {heading}
          </h2>
          {action}
          <IconButton
            ref={closeRef}
            icon="close"
            label={close}
            variant="secondary"
            className="ss-help__close"
            onClick={requestClose}
          />
        </div>
        <div
          ref={bodyRef}
          className="ss-help__body ss-popup__body"
          tabIndex={scrolls ? 0 : undefined}
        >
          {intro && (
            <p id={introId} className="ss-popup__intro">
              {intro}
            </p>
          )}
          {children}
        </div>
      </div>
    </dialog>
  );
}

export interface PopupButtonProps {
  /** The 9 x 9 icon. */
  icon: Bitmap;
  /** Its name for screen readers, and its tooltip. */
  label: string;
  onClick: () => void;
  /** Its pop-up is up, or not. */
  open?: boolean;
  ref?: Ref<HTMLButtonElement>;
  className?: string;
}

/** A square steel icon button that opens a pop-up (like the stats button). */
export function PopupButton({
  icon,
  label,
  onClick,
  open,
  ref,
  className,
}: PopupButtonProps) {
  return (
    <button
      ref={ref}
      type="button"
      className={cx("ss-btn ss-btn--icon ss-btn--secondary", className)}
      aria-label={label}
      title={label}
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={onClick}
    >
      <span className="ss-btn__label">
        <PixelGlyph bitmap={icon} unit="ip" />
      </span>
    </button>
  );
}
