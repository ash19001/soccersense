import { describe, expect, it } from "vitest";

import {
  BOARD_TOP,
  emptyBoard,
  isBoardAnswer,
  rankFor,
  type TallyEntry,
} from "./board";

const TALLY: TallyEntry[] = [
  [700, 1],
  [500, 2],
  [300, 1],
];

describe("a place on a board", () => {
  it("is one more than the players with more; equal totals share it", () => {
    expect(rankFor(TALLY, 700)).toBe(1);
    expect(rankFor(TALLY, 500)).toBe(2);
    expect(rankFor(TALLY, 300)).toBe(4);
  });

  it("is where a player not on the board would have placed", () => {
    expect(rankFor(TALLY, 710)).toBe(1);
    expect(rankFor(TALLY, 600)).toBe(2);
    expect(rankFor(TALLY, 400)).toBe(4);
    expect(rankFor(TALLY, 0)).toBe(5);
  });

  it("on an empty board is first", () => {
    expect(rankFor([], 0)).toBe(1);
    expect(emptyBoard()).toEqual({ count: 0, top: [], tally: [], you: null });
  });
});

describe("what the server sends", () => {
  const board = {
    count: 4,
    top: [{ rank: 1, name: "soccerfan1", points: 700, you: true }],
    tally: TALLY,
    you: { rank: 1, points: 700 },
  };
  const answer = {
    day: 8,
    modes: {
      home: board,
      away: emptyBoard(),
      retro: emptyBoard(),
      nextgen: emptyBoard(),
      closest: emptyBoard(),
      furthest: emptyBoard(),
    },
  };

  it("is a day and a board for every mode", () => {
    expect(isBoardAnswer(answer)).toBe(true);
  });

  it("is nothing else", () => {
    for (const value of [
      null,
      {},
      { day: 8 },
      { ...answer, modes: { ...answer.modes, nextgen: undefined } },
      { ...answer, modes: { ...answer.modes, home: { ...board, count: -1 } } },
      {
        ...answer,
        modes: {
          ...answer.modes,
          home: { ...board, top: [{ rank: 0, name: "x", points: 1 }] },
        },
      },
      {
        ...answer,
        modes: {
          ...answer.modes,
          home: { ...board, top: [{ rank: 1, name: "x", points: 701 }] },
        },
      },
      {
        ...answer,
        modes: { ...answer.modes, home: { ...board, tally: [[700]] } },
      },
      {
        ...answer,
        modes: { ...answer.modes, home: { ...board, you: { rank: 1 } } },
      },
      {
        ...answer,
        modes: {
          ...answer.modes,
          home: {
            ...board,
            top: Array.from({ length: BOARD_TOP + 1 }, () => board.top[0]),
          },
        },
      },
    ]) {
      expect(isBoardAnswer(value)).toBe(false);
    }
  });
});
