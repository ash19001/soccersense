import {
  type CSSProperties,
  type KeyboardEvent,
  useEffect,
  useId,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { GAP_DOTS, ICONS } from "./bitmaps";
import { cx } from "./cx";
import { type Bitmap, type GlyphLayer, PixelGlyph } from "./PixelGlyph";
import { isWide, usePixelRootScale } from "./scale";
import { type Slider, createSlider, prefersReducedMotion } from "./slide";
import type { UiMode } from "./types";
import { useStowSlide } from "./useStowSlide";

export interface LeaderboardEntry {
  /** Position in the day's table: 1 is the best. Equal totals share one. */
  rank: number;
  /** The player's handle. Ignored on the player's own row, which says YOU. */
  name: string;
  points: number;
  /** The player's own row: highlighted, named YOU. */
  you?: boolean;
  /** Stable React key. Defaults to rank and name. */
  id?: string;
}

export interface LeaderboardBoard {
  mode: UiMode;
  /** The tab's text: "HOME". */
  label: string;
  /** The top of the table (ten rows), best first. The player's row may be among them. */
  rows: readonly LeaderboardEntry[];
  /** The player's row when it is not among `rows`: shown under them, after a gap. */
  you?: LeaderboardEntry | null;
  /** The table's caption for screen readers: "Today's top 10, HOME". */
  caption: string;
  /** Under the table: "1,284 played today". */
  played: string;
  /** Read out for the player's row in place of YOU: "You: 37th of 1,284". */
  youSpoken?: string;
  /**
   * The player's own line under the table, in place of `played`: where they came today
   * ("You're 37th of 1,284"), or a nudge to play when they have not.
   */
  mine?: string;
  /** The player's last seven days in this mode, from this device: a strip of bars. */
  week?: LeaderboardWeek;
}

/** One day of the strip: its name under the bar, and the total, or null if not played. */
export interface LeaderboardDay {
  /** Under the bar: "MON". */
  label: string;
  total: number | null;
  /** Today's bar: its name is lit. */
  today?: boolean;
}

/** The player's last seven days in a mode, oldest first, today last. */
export interface LeaderboardWeek {
  /** Over the strip: "YOUR LAST 7 DAYS". */
  heading: string;
  days: readonly LeaderboardDay[];
  /** All seven read out in one go, in place of the bars. */
  spoken: string;
}

export interface LeaderboardLabels {
  /** The heading: "TODAY'S TOP 10". */
  heading: string;
  /** The tab list's name for screen readers: "Today's leaderboards". */
  tabs: string;
  /** Column headings: "#", "PLAYER", "PTS". */
  rank: string;
  name: string;
  points: string;
  /** The player's row: "YOU". */
  you: string;
  /** Read out at the gap before the player's row: "Rows left out". */
  gap: string;
  /** The trophy button that opens the sheet on a phone: "Today's top 10". */
  open: string;
  /** The sheet's close button: "Close the leaderboard". */
  close: string;
  /** The name of the tab that slides the panel away and back on a monitor: "Leaderboard". */
  toggle: string;
  /** The tab's tooltip while the panel is out: "Hide the leaderboard". */
  hide: string;
  /** The tab's tooltip while the panel is away: "Show the leaderboard". */
  show: string;
  /** The link to the stats pop-up, at the strip's top right: "ALL STATS". */
  more?: string;
}

export interface LeaderboardProps {
  /** One per mode, HOME then AWAY. */
  boards: readonly LeaderboardBoard[];
  labels: LeaderboardLabels;
  /** The tab shown first (default: the first board). */
  initialMode?: UiMode;
  /**
   * The kick-off is on: the panel slides off the right of the screen (or the trophy button
   * drops away, and an open sheet closes), and nothing in it can be reached.
   */
  stowed?: boolean;
  /** Open the player's stats (the link under the strip, `labels.more`). None: no link. */
  onStats?: () => void;
  className?: string;
}

/** A total's share of a perfect game, for the height of its bar: 0 to 1. */
function share(total: number): number {
  return Number.isFinite(total) ? Math.min(1, Math.max(0, total / 700)) : 0;
}

/**
 * The player's last seven days in the selected mode: seven bars in its colour, under a
 * heading with the link to the stats at its right.
 */
function Week({
  week,
  more,
}: {
  week: LeaderboardWeek;
  more?: { label: string; onClick(): void };
}) {
  return (
    <div className="ss-lb__week">
      <div className="ss-lb__week-head">
        <span aria-hidden="true">{week.heading}</span>
        {more && (
          <button
            type="button"
            className="ss-lb__more"
            aria-haspopup="dialog"
            onClick={more.onClick}
          >
            {more.label}
          </button>
        )}
      </div>
      <p className="ss-sr">{week.spoken}</p>
      <ol className="ss-lb__bars" aria-hidden="true">
        {week.days.map((day, i) => (
          <li
            key={i}
            className={cx(
              "ss-lb__day",
              day.total === null && "is-empty",
              day.today && "is-today",
            )}
            title={day.total === null ? undefined : String(day.total)}
          >
            <span className="ss-lb__track">
              {day.total !== null && (
                <span
                  className="ss-lb__bar"
                  style={{ "--v": share(day.total) } as CSSProperties}
                />
              )}
            </span>
            <span className="ss-lb__dayname">{day.label}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** A cup with two handles on a foot, 9 x 9 like the kit's icons. Not any real trophy. */
export const TROPHY: Bitmap = [
  "#########",
  "#.#####.#",
  "#.#####.#",
  ".##ooo##.",
  "..#####..",
  "...###...",
  "....#....",
  "..#####..",
  "..#####..",
];

/** The tab's arrows, 9 x 9: a solid wedge pointing the way the panel will go. */
export const ARROW_RIGHT: Bitmap = [
  "..#......",
  "..##.....",
  "..###....",
  "..####...",
  "..#####..",
  "..####...",
  "..###....",
  "..##.....",
  "..#......",
];
export const ARROW_LEFT: Bitmap = ARROW_RIGHT.map((row) =>
  [...row].reverse().join(""),
);

/** Where the choice to slide the panel away is kept: "closed", or nothing. */
export const LEADERBOARD_KEY = "soccersense:v1:leaderboard";

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(LEADERBOARD_KEY) === "closed";
  } catch {
    return false;
  }
}

// The choice as a tiny store for `useSyncExternalStore`. The snapshot is a plain variable;
// the storage is read when a panel subscribes (after mounting), never during a render, and
// the build-time page has the panel out.
let collapsedNow = false;
const collapseListeners = new Set<() => void>();

function tellCollapsed(): void {
  for (const listener of [...collapseListeners]) listener();
}

/** Take the choice from storage. True when that changed it. */
function syncCollapsed(): boolean {
  const stored = readCollapsed();
  if (stored === collapsedNow) return false;
  collapsedNow = stored;
  tellCollapsed();
  return true;
}

function subscribeCollapsed(listener: () => void): () => void {
  collapseListeners.add(listener);
  syncCollapsed();
  return () => {
    collapseListeners.delete(listener);
  };
}

const getCollapsed = () => collapsedNow;
const getCollapsedOnServer = () => false;

function setCollapsedNow(collapsed: boolean): void {
  collapsedNow = collapsed;
  try {
    if (collapsed) window.localStorage.setItem(LEADERBOARD_KEY, "closed");
    else window.localStorage.removeItem(LEADERBOARD_KEY);
  } catch {
    // No storage (private mode, blocked): the choice lasts as long as the page.
  }
  tellCollapsed();
}

/**
 * How far the docked panel goes (CSS px): slid away (`--ss-lb-shift`) and stowed
 * (`--ss-lb-stow`), lengths registered in ui.css so the browser works them out. Null where
 * they are not known (no `@property`, the test DOM): then it simply moves, with no slide.
 */
function dockedLengths(
  el: HTMLElement,
): { shift: number; stow: number } | null {
  const style = window.getComputedStyle(el);
  const shift = parseFloat(style.getPropertyValue("--ss-lb-shift"));
  const stow = parseFloat(style.getPropertyValue("--ss-lb-stow"));
  return shift > 0 && stow > 0 ? { shift, stow } : null;
}

/** The sheet's distance below the screen when it is gone (CSS px), or null if unknown. */
function sheetDrop(el: HTMLElement): number | null {
  const height = el.getBoundingClientRect().height;
  // A few pixels more: the ink line outside its frame goes too.
  return height > 0 ? Math.ceil(height) + 4 : null;
}

/** The cup in the button's colour, with a dark band across it. */
const TROPHY_LAYERS: readonly GlyphLayer[] = [
  { char: "#" },
  { char: "o", className: "ss-lb-open__band" },
];

function Row({
  entry,
  labels,
  youSpoken,
  alone = false,
}: {
  entry: LeaderboardEntry;
  labels: LeaderboardLabels;
  youSpoken?: string;
  /**
   * The player's row under the top ten, after the gap. Its rank can have four digits, so
   * it spans the rank and name columns (the flag, then YOU) instead of widening the rank
   * column and taking that room from every name above it.
   */
  alone?: boolean;
}) {
  const you = (
    <>
      <span aria-hidden={youSpoken ? true : undefined}>{labels.you}</span>
      {youSpoken && <span className="ss-sr">{youSpoken}</span>}
    </>
  );
  if (alone) {
    return (
      <tr className="is-you is-alone">
        <th scope="row" colSpan={2} className="ss-lb__name">
          <span
            className="ss-lb__flag"
            aria-hidden={youSpoken ? true : undefined}
          >
            {entry.rank}
          </span>
          {you}
        </th>
        <td className="ss-lb__pts">
          <span className="ss-lb__ptsbox">{entry.points}</span>
        </td>
      </tr>
    );
  }
  return (
    <tr
      className={cx(
        entry.you && "is-you",
        entry.rank === 1 && entry.points > 0 && "is-best",
      )}
    >
      <td className="ss-lb__rank">{entry.rank}</td>
      <th scope="row" className="ss-lb__name">
        {entry.you ? you : entry.name}
      </th>
      <td className="ss-lb__pts">
        <span className="ss-lb__ptsbox">{entry.points}</span>
      </td>
    </tr>
  );
}

/** The heading, the tabs and the selected mode's table. */
function Body({
  boards,
  labels,
  mode,
  onMode,
  headingId,
  close,
  onStats,
}: {
  boards: readonly LeaderboardBoard[];
  labels: LeaderboardLabels;
  mode: UiMode;
  onMode(mode: UiMode): void;
  headingId: string;
  close?: { label: string; onClose(): void };
  onStats?: () => void;
}) {
  const base = useId();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = Math.max(
    0,
    boards.findIndex((b) => b.mode === mode),
  );
  const board = boards[index];
  const more =
    onStats && labels.more
      ? { label: labels.more, onClick: onStats }
      : undefined;

  // Arrow keys move along the tabs and choose as they go (the panel is cheap to show).
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const last = boards.length - 1;
    let next = -1;
    if (e.key === "ArrowRight") next = index === last ? 0 : index + 1;
    else if (e.key === "ArrowLeft") next = index === 0 ? last : index - 1;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = last;
    const target = boards[next];
    if (!target) return;
    e.preventDefault();
    onMode(target.mode);
    tabRefs.current[next]?.focus();
  };

  return (
    <>
      <div className="ss-lb__head">
        <h2 id={headingId} className="ss-lb__title">
          {labels.heading}
        </h2>
        {close && (
          <button
            type="button"
            className="ss-btn ss-btn--icon ss-btn--secondary ss-lb__close"
            aria-label={close.label}
            title={close.label}
            onClick={close.onClose}
          >
            <span className="ss-btn__label">
              <PixelGlyph bitmap={ICONS.close} />
            </span>
          </button>
        )}
      </div>
      <div
        role="tablist"
        aria-label={labels.tabs}
        className="ss-lb__tabs"
        onKeyDown={onKeyDown}
      >
        {boards.map((b, i) => {
          const selected = i === index;
          return (
            <button
              key={b.mode}
              ref={(node) => {
                tabRefs.current[i] = node;
              }}
              type="button"
              role="tab"
              id={`${base}-tab-${b.mode}`}
              aria-selected={selected}
              aria-controls={`${base}-panel`}
              tabIndex={selected ? 0 : -1}
              data-mode={b.mode}
              className={cx("ss-lb__tab", selected && "is-selected")}
              onClick={() => onMode(b.mode)}
            >
              {b.label}
            </button>
          );
        })}
      </div>
      {board && (
        <div
          role="tabpanel"
          id={`${base}-panel`}
          aria-labelledby={`${base}-tab-${board.mode}`}
          className="ss-lb__panel"
          data-mode={board.mode}
        >
          <table className="ss-lb__table">
            <caption className="ss-sr">{board.caption}</caption>
            <thead>
              <tr>
                <th scope="col" className="ss-lb__rank">
                  {labels.rank}
                </th>
                <th scope="col" className="ss-lb__name">
                  {labels.name}
                </th>
                <th scope="col" className="ss-lb__pts">
                  {labels.points}
                </th>
              </tr>
            </thead>
            <tbody>
              {board.rows.map((entry) => (
                <Row
                  key={entry.id ?? `${entry.rank}-${entry.name}`}
                  entry={entry}
                  labels={labels}
                  youSpoken={board.youSpoken}
                />
              ))}
              {board.you && (
                <>
                  <tr className="ss-lb__gap">
                    <td colSpan={3}>
                      <PixelGlyph bitmap={GAP_DOTS} />
                      <span className="ss-sr">{labels.gap}</span>
                    </td>
                  </tr>
                  <Row
                    entry={{ ...board.you, you: true }}
                    labels={labels}
                    youSpoken={board.youSpoken}
                    alone
                  />
                </>
              )}
            </tbody>
          </table>
          <p className={cx("ss-lb__played", board.mine && "is-mine")}>
            {board.mine ?? board.played}
          </p>
          {board.week ? (
            <Week week={board.week} more={more} />
          ) : (
            more && (
              <button
                type="button"
                className="ss-lb__more"
                aria-haspopup="dialog"
                onClick={more.onClick}
              >
                {more.label}
              </button>
            )
          )}
        </div>
      )}
    </>
  );
}

/** Back to the resting state the classes give: no slide's position, nothing held visible. */
function settle(el: HTMLElement | null): void {
  el?.style.removeProperty("transform");
  el?.removeAttribute("data-sliding");
}

/**
 * Today's top ten, a tab per mode, and under it the player's own line for that mode (where
 * they came, or a nudge), their last seven days in it as a strip of bars and a link to their
 * stats. On a wide screen (a monitor) it is a panel standing on
 * the right of the picture. Anywhere else it is a trophy button that opens it as a sheet
 * over the lower part of the screen (a modal dialog: Escape or the close button shuts it,
 * and the focus goes back to the trophy). Use it inside a `GameLayout`.
 *
 * On a monitor a tab on the panel's left edge (a trophy and an arrow) slides the panel off
 * the right of the screen until only the tab is left there, and back. The choice is kept in
 * localStorage (read after mounting): a first visit sees the panel out.
 *
 * Every movement (the panel away and back, off at the kick-off, the sheet up and down) is a
 * slide from `./slide`: every frame, eased, each position on whole device pixels. Under
 * reduced motion, and where the lengths are not known, things are simply where they go.
 */
export function Leaderboard({
  boards,
  labels,
  initialMode,
  stowed = false,
  onStats,
  className,
}: LeaderboardProps) {
  const wide = isWide(usePixelRootScale());
  const [mode, setMode] = useState<UiMode>(
    initialMode ?? boards[0]?.mode ?? "home",
  );
  const [open, setOpen] = useState(false);
  /** Slid away to the right (a monitor only): remembered, and out until known. */
  const collapsed = useSyncExternalStore(
    subscribeCollapsed,
    getCollapsed,
    getCollapsedOnServer,
  );
  const [, refresh] = useReducer((n: number) => n + 1, 0);
  const headingId = useId();
  const bodyId = useId();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  /** The tab was pressed: the change it makes slides (a remembered choice does not). */
  const pressed = useRef(false);
  /** The docked panel's last resting state, and the element it was. */
  const placed = useRef<{
    el: HTMLElement;
    collapsed: boolean;
    stowed: boolean;
  } | null>(null);
  const panelSlide = useRef<Slider | null>(null);
  const sheetSlide = useRef<Slider | null>(null);
  /** The sheet is going down: it closes when it is gone. */
  const sinking = useRef(false);

  // The sheet only exists on a narrow screen and while nothing is leaving. A kick-off (or
  // a window grown into a monitor) closes it for good, so it does not come back by itself.
  const sheet = open && !wide && !stowed;
  if (open && !sheet) setOpen(false);

  // A choice remembered from an earlier visit is in place before the first paint (the
  // store would only read it after the paint): no slide, and no glimpse of the panel out.
  useLayoutEffect(() => {
    if (syncCollapsed()) refresh();
  }, []);

  // The docked panel slides whenever the tab or the kick-off moves it. The classes hold the
  // resting states; while it slides, the slide's position is on the element and
  // `data-sliding` keeps it in view.
  useLayoutEffect(() => {
    const el = panelRef.current;
    const press = pressed.current;
    pressed.current = false;
    if (!el) {
      placed.current = null;
      return;
    }
    const before = placed.current;
    placed.current = { el, collapsed, stowed };
    if (
      !before ||
      before.el !== el ||
      (before.collapsed === collapsed && before.stowed === stowed)
    ) {
      return;
    }
    const slider = (panelSlide.current ??= createSlider({
      apply: (x) => {
        panelRef.current?.style.setProperty("transform", `translateX(${x}px)`);
      },
      end: () => settle(panelRef.current),
      // Turned round, it may carry on a little first, but never left of its place.
      bounds: [0, Infinity],
    }));
    const lengths = dockedLengths(el);
    if (
      !(press || before.stowed !== stowed) ||
      !lengths ||
      prefersReducedMotion()
    ) {
      slider.stop();
      settle(el);
      return;
    }
    const rest = (away: boolean, gone: boolean) =>
      gone ? lengths.stow : away ? lengths.shift : 0;
    el.setAttribute("data-sliding", "");
    slider.to(rest(collapsed, stowed), rest(before.collapsed, before.stowed));
  }, [collapsed, stowed, wide]);

  // On a phone the trophy leaves at the kick-off with the captions, sliding down off the
  // screen.
  useStowSlide(openerRef, stowed);

  // Nothing slides on after the leaderboard has gone.
  useEffect(
    () => () => {
      panelSlide.current?.stop();
      sheetSlide.current?.stop();
    },
    [],
  );

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!sheet || !dialog) return;
    // A modal dialog keeps the focus inside and the page behind out of reach. Where there
    // is no showModal (old browsers, the test DOM) it is simply open.
    try {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    } catch {
      dialog.setAttribute("open", "");
    }
    const onClose = () => setOpen(false);
    dialog.addEventListener("close", onClose);
    // It rises from below the screen (before the first paint, so it is never seen in place
    // first).
    const slider = (sheetSlide.current ??= createSlider({
      apply: (y) => {
        dialogRef.current?.style.setProperty("transform", `translateY(${y}px)`);
      },
      end: () => {
        const current = dialogRef.current;
        if (!sinking.current) {
          current?.style.removeProperty("transform");
        } else if (current?.open && typeof current.close === "function") {
          current.close();
        } else {
          setOpen(false);
        }
      },
      bounds: [0, Infinity],
    }));
    const drop = sheetDrop(dialog);
    if (drop !== null && !prefersReducedMotion()) slider.to(0, drop);
    const opener = openerRef.current;
    return () => {
      slider.stop();
      sinking.current = false;
      dialog.removeEventListener("close", onClose);
      // Back to the button that opened it, as a closed dialog should.
      opener?.focus();
    };
  }, [sheet]);

  const toggle = () => {
    pressed.current = true;
    setCollapsedNow(!collapsed);
  };

  // Shut the sheet: down it goes, then through the dialog, so its close event is the one
  // path. Under reduced motion (or with nothing to measure) it closes at once.
  const shut = () => {
    if (sinking.current) return;
    const dialog = dialogRef.current;
    const slider = sheetSlide.current;
    const drop = dialog ? sheetDrop(dialog) : null;
    if (dialog?.open && slider && drop !== null && !prefersReducedMotion()) {
      sinking.current = true;
      slider.to(drop, 0);
      return;
    }
    if (dialog?.open && typeof dialog.close === "function") dialog.close();
    setOpen(false);
  };

  if (wide) {
    return (
      <aside
        ref={panelRef}
        className={cx(
          "ss-panel ss-panel--bolted ss-lb ss-lb--docked",
          collapsed && "is-collapsed",
          stowed && "is-stowed",
          className,
        )}
        aria-labelledby={headingId}
        inert={stowed}
      >
        <button
          type="button"
          className="ss-btn ss-btn--secondary ss-lb__handle"
          aria-label={labels.toggle}
          title={collapsed ? labels.show : labels.hide}
          aria-expanded={!collapsed}
          aria-controls={bodyId}
          onClick={toggle}
        >
          <span className="ss-btn__label">
            <span className="ss-lb__handle-icon">
              <PixelGlyph bitmap={TROPHY} layers={TROPHY_LAYERS} />
            </span>
            <span className="ss-lb__handle-icon">
              <PixelGlyph bitmap={collapsed ? ARROW_LEFT : ARROW_RIGHT} />
            </span>
          </span>
        </button>
        <div id={bodyId} className="ss-lb__body" inert={collapsed}>
          <Body
            boards={boards}
            labels={labels}
            mode={mode}
            onMode={setMode}
            headingId={headingId}
            onStats={onStats}
          />
        </div>
      </aside>
    );
  }

  return (
    <>
      <button
        ref={openerRef}
        type="button"
        className={cx(
          "ss-btn ss-btn--icon ss-btn--secondary ss-lb-open",
          stowed && "is-stowed",
          className,
        )}
        aria-label={labels.open}
        title={labels.open}
        aria-haspopup="dialog"
        aria-expanded={sheet}
        inert={stowed}
        data-stow=""
        onClick={() => setOpen(true)}
      >
        <span className="ss-btn__label">
          <PixelGlyph bitmap={TROPHY} layers={TROPHY_LAYERS} />
        </span>
      </button>
      {sheet && (
        <dialog
          ref={dialogRef}
          className="ss-lb ss-lb--sheet"
          aria-labelledby={headingId}
          // A press on the backdrop (outside the sheet) lands on the dialog itself.
          onClick={(e) => {
            if (e.target === e.currentTarget) shut();
          }}
          // Escape: down it goes like the close button, rather than gone at once.
          onCancel={(e) => {
            e.preventDefault();
            shut();
          }}
        >
          <Body
            boards={boards}
            labels={labels}
            mode={mode}
            onMode={setMode}
            headingId={headingId}
            close={{ label: labels.close, onClose: shut }}
            onStats={
              onStats &&
              (() => {
                // the sheet goes, and the stats come up in its place
                const dialog = dialogRef.current;
                if (dialog?.open && typeof dialog.close === "function") {
                  dialog.close();
                }
                setOpen(false);
                onStats();
              })
            }
          />
        </dialog>
      )}
    </>
  );
}
