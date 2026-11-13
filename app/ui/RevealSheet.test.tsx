import { cleanup, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, test } from "vitest";

import { FIT_STEPS, RevealSheet, fitSheet } from "./RevealSheet";

/** The skin's stylesheet, as written (the test environment does not load CSS). */
const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "ui.css"),
  "utf8",
);
const rules = css.replace(/\/\*[\s\S]*?\*\//g, "");

const tableLabels = {
  caption: "The table",
  rank: "#",
  answer: "ANSWER",
  distance: "PICKED",
  shot: "SHOT",
  points: "PTS",
  you: "YOU",
  gap: "Rows left out",
};

const ROWS = [
  ["Manchester United", "England", "WORLDIE", 100],
  ["Wankdorf Stadium", "Switzerland", "GOLAZO", 80],
  ["Liverpool", "England", "TRIVELA", 60],
  ["Olympiastadion Munich", "Germany", "TOE POKE", 30],
  ["Leicester City", "England", "TAP IN", 10],
] as const;

function renderSheet() {
  return render(
    <RevealSheet
      grade="miss"
      mode="home"
      gradeLabel="MISS"
      sentence="Blackburn Rovers: only 2% of players said the same."
      rows={ROWS.map(([name, place, shot, points], i) => ({
        rank: i + 1,
        name,
        place,
        distance: "5%",
        points,
        shot,
        id: name,
      }))}
      tableLabels={tableLabels}
      yours={{
        you: "YOU",
        name: "Blackburn Rovers",
        picked: "2%",
        shot: "MISS",
        points: 0,
        spoken: "Your answer: Blackburn Rovers, picked by 2%. MISS, 0 points.",
      }}
      nextLabel="NEXT QUESTION"
      onNext={() => {}}
      focusNext={false}
    />,
  );
}

function rect(top: number): DOMRect {
  return {
    top,
    bottom: top + 15,
    left: 0,
    right: 100,
    width: 100,
    height: 15,
    x: 0,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

/** A list of rects, as getClientRects returns. */
function rects(...tops: number[]): DOMRectList {
  const list = tops.map(rect);
  return Object.assign(list, {
    item: (i: number) => list[i] ?? null,
  }) as unknown as DOMRectList;
}

/**
 * Lays the sheet out by hand (this environment does not): the table is `need` px tall
 * less what each step saves, in a wrap `room` px tall. Places after the second name wrap
 * onto a line of their own.
 */
function layOut(
  sheet: HTMLElement,
  { need, room, saves }: { need: number; room: number; saves: number[] },
) {
  const wrap = sheet.querySelector<HTMLElement>(".ss-table-wrap");
  const table = wrap?.querySelector("table");
  if (!wrap || !table) throw new Error("no table");
  const height = () => {
    const taken = (sheet.dataset.fit ?? "").split(" ").filter(Boolean);
    return taken.reduce((h, _, i) => h - (saves[i] ?? 0), need);
  };
  Object.defineProperty(table, "offsetHeight", {
    get: height,
    configurable: true,
  });
  Object.defineProperty(wrap, "scrollHeight", {
    get: height,
    configurable: true,
  });
  Object.defineProperty(wrap, "clientHeight", {
    get: () => room,
    configurable: true,
  });
  sheet.querySelectorAll("tbody tr").forEach((row, i) => {
    const name = row.querySelector(".ss-table__name");
    const place = row.querySelector(".ss-table__place");
    if (!name || !place) return;
    name.getClientRects = () => rects(100 * i);
    place.getClientRects = () =>
      i >= 2 ? rects(100 * i + 15) : rects(100 * i);
  });
}

afterEach(cleanup);

describe("fitSheet", () => {
  test("takes no step when the table fits", () => {
    const { container } = renderSheet();
    const sheet = container.querySelector<HTMLElement>(".ss-sheet");
    if (!sheet) throw new Error("no sheet");
    layOut(sheet, { need: 200, room: 200, saves: [] });
    expect(fitSheet(sheet)).toEqual([]);
    expect(sheet.dataset.fit).toBeUndefined();
    expect(sheet.querySelectorAll("[data-cut]")).toHaveLength(0);
  });

  test("takes the steps in order, least visible first, and stops as soon as it fits", () => {
    expect(FIT_STEPS).toEqual(["place", "tight", "band", "over"]);
    const { container } = renderSheet();
    const sheet = container.querySelector<HTMLElement>(".ss-sheet");
    if (!sheet) throw new Error("no sheet");
    layOut(sheet, { need: 230, room: 200, saves: [15, 10, 6, 50] });
    expect(fitSheet(sheet)).toEqual(["place", "tight", "band"]);
    expect(sheet.dataset.fit).toBe("place tight band");
  });

  test("leaves a place to screen readers only in the rows where it wraps", () => {
    const { container } = renderSheet();
    const sheet = container.querySelector<HTMLElement>(".ss-sheet");
    if (!sheet) throw new Error("no sheet");
    layOut(sheet, { need: 210, room: 200, saves: [15] });
    expect(fitSheet(sheet)).toEqual(["place"]);
    const cut = [...sheet.querySelectorAll("[data-cut]")].map(
      (el) => el.textContent,
    );
    // The first two places sit on their name's line; the other three wrapped.
    expect(cut).toEqual(["England", "Germany", "England"]);
    // Still in the row's name for a screen reader, which reads every row whole.
    expect(
      screen.getByRole("rowheader", { name: "Olympiastadion Munich Germany" }),
    ).toBeInTheDocument();
  });

  test("undoes every step first, so a screen that grows gets the sheet back as it was", () => {
    const { container } = renderSheet();
    const sheet = container.querySelector<HTMLElement>(".ss-sheet");
    if (!sheet) throw new Error("no sheet");
    layOut(sheet, { need: 300, room: 200, saves: [15, 10, 6, 50] });
    expect(fitSheet(sheet)).toEqual(FIT_STEPS);
    expect(sheet.querySelectorAll("[data-cut]").length).toBeGreaterThan(0);
    layOut(sheet, { need: 300, room: 400, saves: [] });
    expect(fitSheet(sheet)).toEqual([]);
    expect(sheet.dataset.fit).toBeUndefined();
    expect(sheet.querySelectorAll("[data-cut]")).toHaveLength(0);
  });
});

describe("the reveal sheet's height (ui.css)", () => {
  test("has no ceiling of its own: no rule for the sheet sets a max-height", () => {
    for (const [, selectors, body] of rules.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
      if (!/\.ss-sheet(?![\w-])/.test(selectors ?? "")) continue;
      if (/:has\(/.test(selectors ?? "")) continue;
      expect(body).not.toMatch(/max-height/);
    }
  });

  test("never covers the board, until the last step lets it", () => {
    const flat = rules.replace(/\s+/g, " ");
    expect(flat).toContain(
      ".ss-game__col:has(> .ss-game__bottom > .ss-sheet) > .ss-game__top { flex-shrink: 0; }",
    );
    expect(flat).toContain(
      '.ss-game__col:has(> .ss-game__bottom > .ss-sheet[data-fit~="over"]) > .ss-game__top { flex-shrink: 1; }',
    );
  });

  test("the full-time card keeps its 46%", () => {
    const flat = rules.replace(/\s+/g, " ");
    expect(flat).toContain(
      ".ss-full { --cover: calc(var(--ss-h, 100dvh) * 0.46 - var(--px));",
    );
  });

  test("every step has its rule", () => {
    for (const step of FIT_STEPS) {
      expect(rules).toContain(`[data-fit~="${step}"]`);
    }
  });
});
