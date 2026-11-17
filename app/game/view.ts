/**
 * Ready-made views of a game for the interface. Each one answers a question a component
 * would otherwise have to work out from the session: what to put on the board, what the
 * clock shows, what goes in the reveal sheet, what the career meter does.
 *
 * All of them are pure and cheap enough to call on every render.
 */
import { careerFor, tiersCrossed } from "./career";
import type { Career } from "./career";
import { revealOf } from "./reveal";
import type { RevealRow } from "./reveal";
import {
  PASS_AFTER_MS,
  QUESTION_MS,
  canPass,
  currentQuestion,
  currentTurn,
  isLastQuestion,
  msLeft,
  ruleOf,
  tableFor,
} from "./session";
import type { Session, Turn } from "./session";
import type {
  Answer,
  Grade,
  Measure,
  Mode,
  Question,
  RankedAnswer,
  Rule,
  ShownAnswer,
  Stadium,
} from "./types";

/** The question on the board and its instruction line. */
export interface QuestionView {
  /** 1-based, for "Question 3 of 7". */
  number: number;
  /** How many questions the game has. */
  count: number;
  question: Question;
  /** "Name a manager who has won the Premier League" */
  prompt: string;
  /** HOME: the most common answer wins. AWAY: the most uncommon answer wins. */
  mode: Mode;
  /** How the answers are ranked: `ruleFor(mode)`. */
  rule: Rule;
  /** The day's pin, which the distance rules measure from. It has no name. */
  stadium: Stadium;
  /** What an answer's place is (the distance rules measure it; the judge reads it too). */
  measure: Measure;
  /** Completes "Measured by ...": "where the manager was born". For the distance rules. */
  measureLabel: string;
  /** This is the last question: the reveal's button reads FULL TIME. */
  isLast: boolean;
}

export function questionView(session: Session): QuestionView {
  const question = currentQuestion(session);
  return {
    number: session.index + 1,
    count: session.questions.length,
    question,
    prompt: question.prompt,
    mode: session.mode,
    rule: ruleOf(session),
    stadium: session.stadium,
    measure: question.measure,
    measureLabel: question.measureLabel,
    isLast: isLastQuestion(session),
  };
}

/** The clock and the PASS button at one moment. */
export interface ClockView {
  /** Milliseconds left: see `msLeft`. */
  msLeft: number;
  /** Whole seconds to show: 30 at the start, 1 until the last instant, 0 at time up. */
  secondsLeft: number;
  /** 1 (full) down to 0 (empty), for the timer strip. */
  fraction: number;
  /** The clock is counting down: a question is being asked and the game has a timer. */
  running: boolean;
  /** PASS can be pressed now. */
  canPass: boolean;
  /** Milliseconds until PASS appears: 0 once it has. Null when no question is being asked. */
  msUntilPass: number | null;
}

export function clockView(session: Session, now: number): ClockView {
  const left = msLeft(session, now);
  const asking = session.phase === "asking";
  const waited = Number.isFinite(now) ? now - session.startedAt : 0;
  return {
    msLeft: left,
    secondsLeft: Math.ceil(left / 1000),
    fraction: left / QUESTION_MS,
    running: asking && !session.noTimer,
    canPass: canPass(session, now),
    msUntilPass: asking
      ? Math.min(PASS_AFTER_MS, Math.max(0, PASS_AFTER_MS - waited))
      : null,
  };
}

/** One decided question, with everything the reveal sheet shows. */
export interface RevealView {
  /** 0-based question index. */
  index: number;
  question: Question;
  /** The outcome: grade, points, share, distance, rank. */
  turn: Turn;
  /** The answer the player gave. Null for a pass or a time-up. */
  answer: ShownAnswer | null;
  /** That answer's row in the table. Null for a pass or a time-up. */
  row: RankedAnswer | null;
  /** The best answer under the game's rule: the top row. Null only for an empty answer list. */
  best: RankedAnswer | null;
  /**
   * The table rows to draw: one per scoring shot, best first (`shotRows`). The player's
   * answer is the row for its shot when it scored, marked `isPlayer`.
   */
  rows: RevealRow[];
  /**
   * The player's answer is one of `rows`: it scored. False for a miss, a pass or a
   * time-up, which the sheet shows above the table instead.
   */
  playerInRows: boolean;
  /** How many answers the full table has. */
  tableSize: number;
  /** Every answer to the question is in the one country: the table does not repeat it. */
  oneCountry: boolean;
  /** This was the last question: the button reads FULL TIME. */
  isLast: boolean;
}

/**
 * The reveal for one question: the current one unless `index` is given. Null while the
 * question has not been decided yet.
 *
 * Where the page runs the game it is worked out from the question's table. In a game the
 * server runs it is the reveal the server sent (`session.reveals`); a question whose reveal
 * the page was not sent has an empty table.
 */
export function revealFor(
  session: Session,
  index = session.index,
): RevealView | null {
  const question = session.questions[index];
  const turn = session.turns[index];
  if (!question || !turn) return null;
  const reveal =
    session.reveals?.[index] ??
    revealOf(tableFor(session, index), turn.answerId);
  return {
    index,
    question,
    turn,
    answer: reveal.row?.answer ?? null,
    row: reveal.row,
    best: reveal.best,
    rows: reveal.rows,
    playerInRows: reveal.rows.some((r) => r.isPlayer),
    tableSize: reveal.tableSize,
    oneCountry: reveal.oneCountry,
    isLast: index >= session.questions.length - 1,
  };
}

/** What the current question's turn did to the career. */
export interface ProgressView {
  /** The running total before the current question was decided. */
  totalBefore: number;
  /** The running total now. */
  total: number;
  /** Points the current question added: 0 while it is still being asked. */
  gained: number;
  /** The career before the current question was decided. */
  before: Career;
  /** The career now. */
  after: Career;
  /** Tiers reached by the current question's answer, in order. Empty for none. */
  promotions: number[];
}

/**
 * The career meter. While a question is being asked `before` and `after` are the same. From
 * `resolving` on, `before` is where the meter starts and `after` where it ends, so the
 * interface can hold the old total until the shot lands and then fill to the new one.
 */
export function progressFor(session: Session): ProgressView {
  const gained = currentTurn(session)?.points ?? 0;
  const total = session.total;
  const totalBefore = total - gained;
  return {
    totalBefore,
    total,
    gained,
    before: careerFor(totalBefore),
    after: careerFor(total),
    promotions: tiersCrossed(totalBefore, total),
  };
}

/** The result pips: one per question, the grade once decided and null until then. */
export function pips(session: Session): (Grade | null)[] {
  return session.questions.map((_, i) => session.turns[i]?.grade ?? null);
}

/** One line of the full-time list. */
export interface ResultLine {
  /** 0-based question index. */
  index: number;
  question: Question;
  turn: Turn;
  /**
   * The answer the player gave, from the question's list. Null for a pass or a time-up,
   * and in a game the server runs (the page has no list): read `name`.
   */
  answer: Answer | null;
  /**
   * The name of the answer the player gave. Null for a pass or a time-up. Where nothing
   * says its name any more (a game kept before turns carried it, read with no list of
   * answers), it is the answer as it was typed.
   */
  name: string | null;
}

/** Every question decided so far with the answer that was given, in order. */
export function results(session: Session): ResultLine[] {
  return session.turns.map((turn, index) => {
    const question = session.questions[index];
    const answer =
      turn.answerId === null
        ? null
        : (question.answers.find((a) => a.id === turn.answerId) ?? null);
    return {
      index,
      question,
      turn,
      answer,
      name:
        turn.name ??
        answer?.name ??
        (turn.answerId === null ? null : turn.input),
    };
  });
}
