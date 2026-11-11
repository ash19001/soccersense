import { describe, expect, it } from "vitest";

import { FACTS, factForDay } from "./facts";

/**
 * Structural checks on the blimp facts. They cannot tell whether a fact is true (that is what
 * docs/data-notes/facts.md is for), only whether the sign can show it.
 */

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** Printable ASCII, no quotation marks (the apostrophe is allowed). */
const SIGN_TEXT = /^[\x20-\x7e]+$/;
const MAX_LENGTH = 110;

describe("FACTS", () => {
  it("has 60 facts, two months before one repeats", () => {
    expect(FACTS).toHaveLength(60);
  });

  it("has unique kebab-case ids", () => {
    for (const fact of FACTS) expect(fact.id, fact.id).toMatch(KEBAB);
    expect(new Set(FACTS.map((f) => f.id)).size).toBe(FACTS.length);
  });

  it("has unique texts", () => {
    const folded = FACTS.map((f) => f.text.toLowerCase());
    expect(new Set(folded).size).toBe(FACTS.length);
  });

  it("keeps every text short enough for the sign", () => {
    for (const fact of FACTS) {
      expect(
        fact.text.length,
        `${fact.id}: ${fact.text.length}`,
      ).toBeLessThanOrEqual(MAX_LENGTH);
    }
  });

  it("uses plain printable ASCII with no quotation marks or stray spaces", () => {
    for (const fact of FACTS) {
      expect(fact.text, fact.id).toMatch(SIGN_TEXT);
      expect(fact.text, fact.id).not.toMatch(/["`]/);
      expect(fact.text, fact.id).toBe(fact.text.trim());
      expect(fact.text, fact.id).not.toMatch(/ {2}/);
    }
  });

  it("ends every text with a full stop or an exclamation mark", () => {
    for (const fact of FACTS) expect(fact.text, fact.id).toMatch(/[.!]$/);
  });

  it("is one sentence each", () => {
    for (const fact of FACTS) {
      // A full stop followed by a space and a capital would start a second sentence.
      expect(fact.text.slice(0, -1), fact.id).not.toMatch(/[.!?] [A-Z]/);
    }
  });

  it("gives every fact an https source", () => {
    for (const fact of FACTS) {
      const url = new URL(fact.source);
      expect(url.protocol, fact.id).toBe("https:");
      expect(url.hostname, fact.id).toContain(".");
    }
  });
});

describe("factForDay", () => {
  it("starts the cycle on day 1", () => {
    expect(factForDay(1)).toBe(FACTS[0]);
    expect(factForDay(2)).toBe(FACTS[1]);
    expect(factForDay(60)).toBe(FACTS[59]);
  });

  it("repeats after 60 days", () => {
    expect(factForDay(61)).toBe(FACTS[0]);
    expect(factForDay(121)).toBe(FACTS[0]);
    for (let day = 1; day <= 200; day++)
      expect(factForDay(day + 60)).toBe(factForDay(day));
  });

  it("shows every fact exactly once in 60 days", () => {
    const seen = new Set<string>();
    for (let day = 1; day <= 60; day++) seen.add(factForDay(day).id);
    expect(seen.size).toBe(60);
  });

  it("handles day 0 and negative days", () => {
    expect(factForDay(0)).toBe(FACTS[59]);
    expect(factForDay(-1)).toBe(FACTS[58]);
    expect(factForDay(-59)).toBe(FACTS[0]);
    expect(factForDay(-600)).toBe(FACTS[59]);
  });

  it("always returns a fact for odd input", () => {
    for (const day of [
      1.5,
      -0.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      Number.MAX_SAFE_INTEGER,
      Number.MIN_SAFE_INTEGER,
    ]) {
      expect(FACTS).toContain(factForDay(day));
    }
    expect(factForDay(1.9)).toBe(FACTS[0]);
    expect(factForDay(Number.NaN)).toBe(FACTS[0]);
  });
});
