// The board's question dribbled on: how it is cut up and timed (typedQuestion), and what
// the skin does with that (the typing, the ball, the warm wake, the glint at the end). The
// board itself is in kit.test.tsx.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

import { questionsFor } from "~/data";
import { MODES } from "~/game";
import {
  TYPE_CHAR_MS,
  TYPE_MAX_MS,
  TYPE_SETTLE_MS,
  typedQuestion,
} from "./Board";

/** The skin's stylesheet, as written, without its comments. */
const skin = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "ui.css"),
  "utf8",
).replace(/\/\*[\s\S]*?\*\//g, "");

const flat = (text: string): string => text.replace(/\s+/g, " ");

/** Every rule of the skin: its selector list and its body, both on one line. */
const RULES = [...skin.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(
  ([, selectors, body]) => [flat(selectors).trim(), flat(body).trim()] as const,
);

/** The body of the one rule whose selector list is exactly `selectors`. */
function rule(selectors: string): string {
  const found = RULES.filter(([list]) => list === selectors);
  expect(found.length, selectors).toBe(1);
  return found[0]?.[1] ?? "";
}

/** A set of keyframes, flattened. */
function keyframes(name: string): string {
  const at = skin.indexOf(`@keyframes ${name} {`);
  expect(at, name).toBeGreaterThanOrEqual(0);
  const next = skin.indexOf("\n}", at);
  return flat(skin.slice(at, next));
}

const LONGEST =
  "Name a manager who has won the Champions League (1993 onwards)";

describe("typedQuestion", () => {
  test("cuts the question into its words and the spaces between, and they are the question again", () => {
    for (const question of [
      "Name a club that has won the European Cup",
      LONGEST,
      "  Two  spaces and\ta tab ",
      "Goalkeeper",
      "Šuker Çalhanoğlu Ødegaard",
      "",
    ]) {
      const { parts } = typedQuestion(question);
      expect(
        parts
          .map((part) => (typeof part === "string" ? part : part.text))
          .join(""),
      ).toBe(question);
      // Each word starts where the characters before it end.
      let count = 0;
      for (const part of parts) {
        if (typeof part === "string") {
          expect(part).toMatch(/^\s+$/);
          count += [...part].length;
        } else {
          expect(part.text).not.toMatch(/\s/);
          expect(part.before).toBe(count);
          expect(part.letters).toBe([...part.text].length);
          count += part.letters;
        }
      }
      expect(count).toBe([...question].length);
    }
  });

  test("a word's letters are counted as the eye counts them", () => {
    const [first, , second] = typedQuestion("Çalhanoğlu 😀x").parts;
    expect(first).toEqual({ text: "Çalhanoğlu", letters: 10, before: 0 });
    // the face is one character, though it is two code units long
    expect(second).toEqual({ text: "😀x", letters: 2, before: 11 });
  });

  test("a character takes 16 ms, less in a long question: it is all there within 0.7 s", () => {
    expect(TYPE_CHAR_MS).toBe(16);
    expect(TYPE_MAX_MS).toBe(700);
    const short = typedQuestion("Name an English club");
    expect(short.charMs).toBe(16);
    expect(short.totalMs).toBe(20 * 16);
    const long = typedQuestion(LONGEST);
    expect(long.charMs).toBeLessThan(16);
    expect(long.totalMs).toBeCloseTo(700, 6);
    // nothing to type is no time at all, and no division by nothing
    expect(typedQuestion("").totalMs).toBe(0);
    expect(Number.isFinite(typedQuestion("").charMs)).toBe(true);
  });

  test("every question the game asks is dribbled on in half to seven tenths of a second", () => {
    let asked = 0;
    for (const mode of MODES) {
      for (const question of questionsFor(mode)) {
        const { totalMs, charMs } = typedQuestion(question.prompt);
        expect(totalMs).toBeLessThanOrEqual(700.0001);
        expect(totalMs).toBeGreaterThan(450);
        // never so fast that the ball is a blur: 10 ms a character or more
        expect(charMs).toBeGreaterThanOrEqual(10);
        asked++;
      }
    }
    expect(asked).toBeGreaterThanOrEqual(28);
  });
});

describe("the skin's typing", () => {
  test("a word is a box, and its ink is uncovered in its letters' steps after the characters before it", () => {
    const word = rule(".ss-board__word");
    expect(word).toContain("display: inline-block;");
    // the ball is placed against it
    expect(word).toContain("position: relative;");
    // a word wider than the board still breaks, inside its box
    expect(word).toContain("max-width: 100%;");
    expect(word).not.toContain("animation");

    const ink = rule(".ss-board__ink");
    expect(ink).toContain(
      "ss-board-type calc(var(--ss-type, 16ms) * var(--n, 1)) steps(var(--n, 1), end) calc(var(--ss-type, 16ms) * var(--d, 0)) backwards,",
    );
    // uncovered from the left, open above and below so no accent is cut as it types
    expect(keyframes("ss-board-type")).toContain(
      "from { clip-path: inset(-50% 100% -50% 0); } to { clip-path: inset(-50% 0 -50% 0); }",
    );
  });

  test("the shine: a word is gold while it types, pale gold a moment more, then the chalk it stays", () => {
    const ink = rule(".ss-board__ink");
    // as long as the word's typing and a little over, each colour holding until the next
    expect(ink).toContain(
      "ss-board-hot calc(var(--ss-type, 16ms) * var(--n, 1) + 110ms) step-end calc(var(--ss-type, 16ms) * var(--d, 0));",
    );
    const hot = keyframes("ss-board-hot");
    expect(hot).toContain("from { color: var(--c-gold); }");
    expect(hot).toContain("55% { color: var(--c-gold-light); }");
    // it does not go on filling: the word's own colour is the board's chalk
    expect(ink).not.toMatch(/ss-board-hot[^,;]*\b(forwards|both)\b/);
  });

  test("the ball: each word's own, hidden but while that word types, along it in the word's steps and one more", () => {
    const shared = rule(
      ".ss-board__word::after, .ss-board__end, .ss-board__end::before, .ss-board__end::after",
    );
    expect(shared).toContain("position: absolute;");
    expect(shared).toContain("visibility: hidden;");
    expect(shared).toContain("pointer-events: none;");
    // thirteen font pixels across, its foot on the baseline
    expect(shared).toContain("width: var(--ss-q-ball-w);");
    expect(rule(".ss-board__typed")).toContain(
      "--ss-q-ball-w: calc(var(--fp) * 13);",
    );

    const ball = rule(".ss-board__word::after");
    expect(ball).toContain("animation-name: ss-board-dribble, ss-board-roll;");
    expect(ball).toContain(
      "animation-timing-function: steps(var(--m, 2), end), steps(4, end);",
    );
    // it turns a quarter every two characters, for as long as it is on its word
    expect(ball).toContain("calc(var(--ss-type, 16ms) * 8);");
    expect(ball).toContain(
      "animation-iteration-count: 1, calc(var(--m, 2) / 8);",
    );
    const dribble = keyframes("ss-board-dribble");
    expect(dribble).toContain("from { left: 0; visibility: visible; }");
    expect(dribble).toContain(
      "to { left: calc(100% * var(--m, 2) / var(--n, 1)); visibility: visible; }",
    );
  });

  test("the ball and the glint are white boxes cut out by masks: no colour of their own, and the palette's alone", () => {
    const typed = rule(".ss-board__typed");
    for (const name of ["--ss-q-ball", "--ss-q-glint"]) {
      const shape = new RegExp(
        `${name}: url\\( ?"data:image/svg\\+xml,%3Csvg [^"]*viewBox='0 0 13 13'[^"]*shape-rendering='crispEdges'[^"]*" ?\\)`,
      );
      expect(typed).toMatch(shape);
    }
    // no fill, no stroke, no colour in the shapes: what shows is the box's background
    expect(typed).not.toMatch(/fill=|stroke=|%23[0-9a-f]{3,6}|rgb/i);
    const drawn = rule(
      ".ss-board__word::after, .ss-board__end::before, .ss-board__end::after",
    );
    expect(drawn).toContain('content: "";');
    expect(drawn).toContain("background: var(--c-white);");
    expect(drawn).toContain(
      "mask: var(--ss-q-ball) center / 100% 100% no-repeat;",
    );
    expect(drawn).toContain(
      "-webkit-mask: var(--ss-q-ball) center / 100% 100% no-repeat;",
    );
    expect(rule(".ss-board__end::after")).toContain(
      "mask-image: var(--ss-q-glint);",
    );
  });

  test("the end: where the last ball stopped it hops and lands, then goes out in a glint, in TYPE_SETTLE_MS", () => {
    expect(TYPE_SETTLE_MS).toBe(400);
    expect(rule(".ss-board__end")).toContain("left: 100%;");
    const both = rule(".ss-board__end::before, .ss-board__end::after");
    // it starts as the last word's ball goes: after the characters before and its steps
    expect(both).toContain(
      `animation: ${TYPE_SETTLE_MS}ms step-end calc(var(--ss-type, 16ms) * (var(--d, 0) + var(--m, 2)));`,
    );
    const settle = keyframes("ss-board-settle");
    expect(settle).toContain("from { translate: 0 0; visibility: visible; }");
    expect(settle).toContain("translate: 0 calc(var(--fp) * -6);");
    expect(settle).toContain("64% { visibility: hidden; }");
    const glint = keyframes("ss-board-glint");
    expect(glint).toContain("from { visibility: hidden; }");
    // a diamond, the whole star, the diamond again
    expect(glint).toContain(
      "64% { clip-path: inset(calc(var(--fp) * 3)); visibility: visible; }",
    );
    expect(glint).toContain(
      "74% { clip-path: inset(0); visibility: visible; }",
    );
    expect(glint).toContain(
      "90% { clip-path: inset(calc(var(--fp) * 3)); visibility: visible; }",
    );
  });

  test("a board that starts compact types nothing, and nothing fills after it has ended", () => {
    const compact = rule(
      ".ss-board--compact .ss-board__ink, .ss-board--compact .ss-board__word::after, .ss-board--compact .ss-board__end::before, .ss-board--compact .ss-board__end::after",
    );
    expect(compact).toContain("animation: none;");
    // from the typing's rules to the compact one: no fill but the typing's `backwards`
    const typing = skin.slice(
      skin.indexOf(".ss-board__typed {"),
      skin.indexOf(".ss-board--compact .ss-board__ink,"),
    );
    expect(typing.length).toBeGreaterThan(2000);
    expect(typing).not.toMatch(/\b(forwards|both)\b/);
    expect(typing).not.toContain("animation-fill-mode");
    expect(typing).not.toContain("infinite");
  });

  test("the skin's fallback speed is the board's", () => {
    expect(skin).toContain(`var(--ss-type, ${TYPE_CHAR_MS}ms)`);
    expect(skin).not.toMatch(/var\(--ss-type, (?!16ms)/);
  });
});
