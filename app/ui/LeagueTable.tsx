import { type Ref, useEffect, useRef } from "react";

import { GAP_DOTS } from "./bitmaps";
import { cx } from "./cx";
import { PixelGlyph } from "./PixelGlyph";
import type { UiGrade } from "./types";

export interface LeagueRow {
  /** Position in the table. Tied answers share one. */
  rank: number | string;
  /** "Trent Alexander-Arnold" */
  name: string;
  /** "West Derby, Liverpool" */
  place: string;
  /** Already formatted: "3 miles" */
  distance: string;
  points: number;
  /** The answer's shot: colours its tag and its points. */
  grade?: UiGrade;
  /** The shot's name, shown in the SHOT column when the table has one: "GOLAZO". */
  shot?: string;
  /** The player's own answer: highlighted, with the YOU tag. */
  you?: boolean;
  /** Gold row. Defaults to a worldie (`grade`), or `points === 100` without a grade. */
  best?: boolean;
  /** Stable React key. Defaults to rank and name. */
  id?: string;
}

/** Marks a place where rows were left out. */
export interface LeagueGap {
  gap: true;
}

export type LeagueEntry = LeagueRow | LeagueGap;

export interface LeagueTableLabels {
  /** Table caption for screen readers: "The table". */
  caption: string;
  /** Column headings: "#", "ANSWER", "DISTANCE", "SHOT", "PTS". */
  rank: string;
  answer: string;
  distance: string;
  /** Give it for a SHOT column: each row's `shot` as a tag in its grade's colour. */
  shot?: string;
  points: string;
  /** The tag on the player's row: "YOU". */
  you: string;
  /** Read out at a gap marker: "Rows left out". */
  gap: string;
}

export interface LeagueTableProps {
  rows: readonly LeagueEntry[];
  labels: LeagueTableLabels;
  /**
   * Bring the player's row into view inside the table, with the row above it when there
   * is room (default true). It stops as soon as the player scrolls the table themselves.
   */
  followYou?: boolean;
  /**
   * Keep the first row (the best answer) in sight under the headings while the rest
   * scrolls beneath it (default true). Pass the rows best first.
   */
  pinFirst?: boolean;
  /**
   * Put each place on its name's line, after it, instead of on a line of its own (default
   * false): rows are one line tall unless a name is long, so five rows and the headings fit
   * a short screen. The reveal uses it.
   */
  inlinePlace?: boolean;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

function isGap(entry: LeagueEntry): entry is LeagueGap {
  return "gap" in entry;
}

/** "540 miles" as the number over the unit, so the column stays narrow and lines up. */
function Distance({ text }: { text: string }) {
  const cut = text.lastIndexOf(" ");
  if (cut <= 0) return <span className="ss-table__num">{text}</span>;
  return (
    <>
      <span className="ss-table__num">{text.slice(0, cut)}</span>
      <span className="ss-table__unit">{text.slice(cut + 1)}</span>
    </>
  );
}

/** The reveal's league table: position, name and place, distance, the shot, points. */
export function LeagueTable({
  rows,
  labels,
  followYou = true,
  pinFirst = true,
  inlinePlace = false,
  className,
  ref,
}: LeagueTableProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const tableRef = useRef<HTMLTableElement | null>(null);
  const tailRef = useRef<HTMLDivElement | null>(null);
  const youRef = useRef<HTMLTableRowElement | null>(null);

  // What the rows are, so the table is only moved again when they really change (a parent
  // that builds a new array on every render must not undo the player's own scrolling).
  const shots = labels.shot !== undefined;
  const signature = rows
    .map((entry) =>
      isGap(entry)
        ? "-"
        : `${entry.id ?? entry.rank}/${entry.name}/${entry.you ? "you" : ""}`,
    )
    .join("|");

  useEffect(() => {
    const wrap = wrapRef.current;
    const table = tableRef.current;
    const tail = tailRef.current;
    if (!wrap || !table || !tail) return;
    let touched = false;

    const settle = () => {
      const head = table.tHead;
      const pinned = table.querySelector<HTMLElement>("tr.is-pinned");
      const headH = head ? head.offsetHeight : 0;
      const covered = headH + (pinned ? pinned.offsetHeight : 0);
      // The pinned row sticks under the headings, and rows snap to rest under both.
      wrap.style.setProperty("--thead", `${headH}px`);
      wrap.style.scrollPaddingTop = `${covered}px`;

      const row = youRef.current;
      if (!followYou || touched) return;
      tail.style.height = "0px";
      // Nothing to look for, or everything down to the player's row fits: the top.
      if (
        !row ||
        row === pinned ||
        row.offsetTop + row.offsetHeight <= wrap.clientHeight
      ) {
        wrap.scrollTop = 0;
        return;
      }
      // Otherwise lead with the row above the player's when there is room for both.
      const room = wrap.clientHeight - covered;
      const before = (el: Element): HTMLElement | null => {
        const prev = el.previousElementSibling;
        return prev instanceof HTMLElement && prev !== pinned ? prev : null;
      };
      let lead: HTMLElement = row;
      const above = before(row);
      if (above && above.offsetHeight + row.offsetHeight <= room) lead = above;
      // Near the end of the table the rest of it may not fill the room. Start further up
      // then, as far as whole rows fit...
      const end = table.offsetHeight;
      for (let prev = before(lead); prev; prev = before(prev)) {
        if (end - prev.offsetTop > room) break;
        lead = prev;
      }
      // ...and pad the end with what is still spare, so the leading row can rest right
      // under the pinned one instead of being cut in half by it.
      const spare = room - (end - lead.offsetTop);
      if (spare > 0) tail.style.height = `${spare}px`;
      // Never scrollIntoView: that would also move the page behind the sheet.
      wrap.scrollTop = Math.max(0, lead.offsetTop - covered);
    };
    // Once the player scrolls the table themselves, leave it where they put it.
    const stop = () => {
      touched = true;
    };

    settle();
    // Row heights change when the fonts arrive or the sheet is resized.
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(settle);
    observer?.observe(wrap);
    observer?.observe(table);
    wrap.addEventListener("wheel", stop, { passive: true });
    wrap.addEventListener("touchstart", stop, { passive: true });
    wrap.addEventListener("pointerdown", stop);
    wrap.addEventListener("keydown", stop);
    return () => {
      observer?.disconnect();
      wrap.removeEventListener("wheel", stop);
      wrap.removeEventListener("touchstart", stop);
      wrap.removeEventListener("pointerdown", stop);
      wrap.removeEventListener("keydown", stop);
    };
  }, [followYou, pinFirst, signature]);

  function setWrap(node: HTMLDivElement | null) {
    wrapRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  }

  return (
    // A keyboard user must be able to scroll a table that does not fit.
    <div
      ref={setWrap}
      className={cx("ss-table-wrap", className)}
      role="group"
      aria-label={labels.caption}
      tabIndex={0}
    >
      <table
        ref={tableRef}
        className={cx("ss-table", inlinePlace && "ss-table--inline")}
      >
        <caption className="ss-sr">{labels.caption}</caption>
        <thead>
          <tr>
            <th scope="col" className="ss-table__rank">
              {labels.rank}
            </th>
            <th scope="col" className="ss-table__who">
              {labels.answer}
            </th>
            <th scope="col" className="ss-table__dist">
              {labels.distance}
            </th>
            {shots && (
              <th scope="col" className="ss-table__shot">
                {labels.shot}
              </th>
            )}
            <th scope="col" className="ss-table__pts">
              {labels.points}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((entry, i) => {
            if (isGap(entry)) {
              return (
                <tr key={`gap-${i}`} className="ss-table__gap">
                  <td colSpan={shots ? 5 : 4}>
                    <PixelGlyph bitmap={GAP_DOTS} />
                    <span className="ss-sr">{labels.gap}</span>
                  </td>
                </tr>
              );
            }
            const best =
              entry.best ??
              (entry.grade ? entry.grade === "worldie" : entry.points === 100);
            return (
              <tr
                key={entry.id ?? `${entry.rank}-${entry.name}`}
                ref={entry.you ? youRef : undefined}
                data-grade={entry.grade}
                className={cx(
                  entry.you && "is-you",
                  best && "is-best",
                  pinFirst && i === 0 && "is-pinned",
                )}
              >
                <td className="ss-table__rank">
                  <span className="ss-table__pos">{entry.rank}</span>
                  {entry.you && (
                    <span className="ss-table__you">{labels.you}</span>
                  )}
                </td>
                <th scope="row" className="ss-table__who">
                  <span className="ss-table__name">{entry.name}</span>
                  {/* A space, so a place on the name's line can wrap after it. */}
                  {entry.place && " "}
                  <span className="ss-table__place">{entry.place}</span>
                </th>
                <td className="ss-table__dist">
                  <Distance text={entry.distance} />
                </td>
                {shots && (
                  <td className="ss-table__shot">
                    {entry.shot && (
                      <span className="ss-table__tag">{entry.shot}</span>
                    )}
                  </td>
                )}
                <td className="ss-table__pts">
                  <span className="ss-table__ptsbox">{entry.points}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {/* Empty space after the last row, sized by the effect above. */}
      <div ref={tailRef} className="ss-table__tail" aria-hidden="true" />
    </div>
  );
}
