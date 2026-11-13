import { describe, expect, test } from "vitest";

import { MODES } from "~/game/storage";
import { hash2 } from "~/pixel";

import {
  LEADERBOARD_MAX,
  MOCK_FIELD,
  NAME_MAX,
  fieldSize,
  leaderboardFor,
} from "./leaderboard";

const DAYS = [1, 2, 3, 17, 120, 365];

describe("leaderboardFor (mock)", () => {
  test("is the same for the same day and mode, and differs between them", () => {
    const a = leaderboardFor(2, "home");
    const b = leaderboardFor(2, "home");
    expect(b).toEqual(a);
    expect(leaderboardFor(2, "away").rows.slice(0, 20)).not.toEqual(
      a.rows.slice(0, 20),
    );
    expect(leaderboardFor(3, "home").rows.slice(0, 20)).not.toEqual(
      a.rows.slice(0, 20),
    );
  });

  test("has its own field for each of the four modes, HOME's and AWAY's as they were", () => {
    const tops = MODES.map((mode) =>
      JSON.stringify(leaderboardFor(7, mode).rows.slice(0, 20)),
    );
    expect(new Set(tops).size).toBe(4);
    for (const mode of ["retro", "nextgen"] as const) {
      expect(leaderboardFor(7, mode)).toEqual(leaderboardFor(7, mode));
      const mine = leaderboardFor(7, mode, 560);
      expect(mine.yourRank).not.toBeNull();
      expect(mine.total).toBe(fieldSize(7, mode) + 1);
    }
    // The fields HOME and AWAY had before RETRO and NEXT-GEN joined (their old hashes).
    const before = (salt: number) =>
      MOCK_FIELD.min +
      Math.floor(
        hash2(1, salt, 0xf1e1d) * (MOCK_FIELD.max - MOCK_FIELD.min + 1),
      );
    expect(fieldSize(1, "home")).toBe(before(11));
    expect(fieldSize(1, "away")).toBe(before(12));
  });

  test("counts a few hundred to a couple of thousand players, deterministically", () => {
    for (const day of DAYS) {
      for (const mode of MODES) {
        const board = leaderboardFor(day, mode);
        expect(board.total).toBe(board.rows.length);
        expect(board.total).toBe(fieldSize(day, mode));
        expect(board.total).toBeGreaterThanOrEqual(MOCK_FIELD.min);
        expect(board.total).toBeLessThanOrEqual(MOCK_FIELD.max);
        expect(board.yourRank).toBeNull();
      }
    }
  });

  test("totals are sums of shots: multiples of 10 from 0 to 700, best first", () => {
    for (const day of DAYS) {
      const { rows } = leaderboardFor(day, "away");
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]!;
        expect(row.total % 10).toBe(0);
        expect(row.total).toBeGreaterThanOrEqual(0);
        expect(row.total).toBeLessThanOrEqual(LEADERBOARD_MAX);
        if (i > 0) expect(row.total).toBeLessThanOrEqual(rows[i - 1]!.total);
      }
    }
  });

  test("has a plausible spread: a handful in the 600s, the middle in the 300s", () => {
    for (const day of DAYS) {
      const { rows } = leaderboardFor(day, "home");
      const high = rows.filter((r) => r.total >= 600).length;
      expect(high).toBeGreaterThan(0);
      expect(high).toBeLessThan(40);
      const median = rows[rows.length >> 1]!.total;
      expect(median).toBeGreaterThanOrEqual(250);
      expect(median).toBeLessThanOrEqual(400);
    }
  });

  test("ranks share a position on equal totals (1, 2, 2, 4)", () => {
    const { rows } = leaderboardFor(5, "home");
    expect(rows[0]!.rank).toBe(1);
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]!;
      const prev = rows[i - 1]!;
      expect(row.rank).toBe(row.total === prev.total ? prev.rank : i + 1);
    }
  });

  test("handles are unique, short, and only letters, digits and spaces", () => {
    for (const day of DAYS) {
      const { rows } = leaderboardFor(day, "home");
      const names = rows.map((r) => r.name);
      expect(new Set(names).size).toBe(names.length);
      for (const name of names) {
        expect(name.length).toBeGreaterThan(1);
        expect(name.length).toBeLessThanOrEqual(NAME_MAX);
        expect(name).toMatch(/^[A-Za-z][A-Za-z0-9 ]*$/);
      }
    }
  });

  test("places the player at their rank, first among equal totals", () => {
    const plain = leaderboardFor(2, "home");
    const mine = leaderboardFor(2, "home", 420);
    expect(mine.total).toBe(plain.total + 1);
    const better = plain.rows.filter((r) => r.total > 420).length;
    expect(mine.yourRank).toBe(better + 1);
    const row = mine.rows[better]!;
    expect(row).toEqual({ rank: better + 1, name: "", total: 420, you: true });
    expect(mine.rows.filter((r) => r.you)).toHaveLength(1);
    // Everyone below the player moved down one place.
    expect(mine.rows[better + 1]!.total).toBeLessThanOrEqual(420);
  });

  test("puts a perfect score first and a zero last", () => {
    const top = leaderboardFor(9, "away", 700);
    expect(top.yourRank).toBe(1);
    expect(top.rows[0]!.you).toBe(true);
    const bottom = leaderboardFor(9, "away", 0);
    const zeros = bottom.rows.filter((r) => r.total === 0 && !r.you).length;
    expect(bottom.yourRank).toBe(bottom.total - zeros);
  });

  test("clamps and rounds a stray total", () => {
    expect(leaderboardFor(4, "home", 900).rows[0]!.total).toBe(700);
    const low = leaderboardFor(4, "home", -5);
    expect(low.rows.find((r) => r.you)?.total).toBe(0);
    expect(low.yourRank).toBe(low.rows.filter((r) => r.total > 0).length + 1);
    expect(
      leaderboardFor(4, "home", 333.6).rows.find((r) => r.you)?.total,
    ).toBe(334);
    expect(leaderboardFor(4, "home", Number.NaN).yourRank).toBeNull();
  });
});
