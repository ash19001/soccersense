import { tierFor, isPerfect } from "./career";
import { judge } from "./judge";
import { rankAnswers, rankedFor, ruleFor } from "./scoring";
import type {
  Grade,
  Mode,
  Question,
  RankedAnswer,
  Rule,
  Stadium,
} from "./types";

/** The clock for one question. */
export const QUESTION_MS = 30_000;
/** PASS becomes available this long into a question. */
export const PASS_AFTER_MS = 8_000;

/**
 * - `asking`: the clock is running and the player can answer.
 * - `resolving`: the answer is locked and the shot animation is playing.
 * - `reveal`: the reveal sheet is open.
 * - `done`: full time.
 */
export type Phase = "asking" | "resolving" | "reveal" | "done";

/** The outcome of one question. */
export interface Turn {
  questionId: string;
  /** What the player typed (trimmed). Null for a pass or a time-up. */
  input: string | null;
  /** The matched answer. Null for a pass or a time-up. */
  answerId: string | null;
  grade: Grade;
  /** 0 to 100. */
  points: number;
  /** Whole kilometres from the stadium to the answer's place. Null without an answer. */
  km: number | null;
  /** The answer's share of players, in percent. Null without an answer. */
  share: number | null;
  /** 1-based place in the table. Null without an answer. */
  rank: number | null;
  /** What was left on the clock when the turn was decided. QUESTION_MS with no timer. */
  msLeft: number;
}

export interface Rejection {
  /** What the player typed (trimmed). */
  input: string;
  reason: "unknown" | "ambiguous";
}

export interface Session {
  mode: Mode;
  dayNumber: number;
  stadium: Stadium;
  questions: readonly Question[];
  /** The current question, 0-based. Stays on the last question once done. */
  index: number;
  phase: Phase;
  /** One per question decided so far, in order. */
  turns: readonly Turn[];
  /** Always the sum of the turns' points. */
  total: number;
  /** When the current question's clock started. */
  startedAt: number;
  /** When the clock runs out. Null outside `asking` and with no timer. */
  deadline: number | null;
  /**
   * The last answer that was not accepted for the current question. A fresh object on every
   * rejection, so the interface can replay its shake even for the same input twice.
   */
  rejected: Rejection | null;
  noTimer: boolean;
}

export type Action =
  | { type: "submit"; input: string; now: number }
  | { type: "pass"; now: number }
  | { type: "tick"; now: number }
  | { type: "resolved" }
  | { type: "next"; now: number };

export interface SessionOptions {
  mode: Mode;
  dayNumber: number;
  stadium: Stadium;
  questions: readonly Question[];
  /** The current time in milliseconds (the same clock as every later `now`). */
  now: number;
  noTimer?: boolean;
}

/** Start a game on question 1. Throws if there are no questions or `now` is not a time. */
export function createSession(options: SessionOptions): Session {
  const { mode, dayNumber, stadium, questions, now } = options;
  if (questions.length === 0) {
    throw new Error("createSession: a game needs at least one question");
  }
  if (!Number.isFinite(now)) {
    throw new Error("createSession: now must be a time in milliseconds");
  }
  const noTimer = options.noTimer ?? false;
  return {
    mode,
    dayNumber,
    stadium,
    questions,
    index: 0,
    phase: "asking",
    turns: [],
    total: 0,
    startedAt: now,
    deadline: noTimer ? null : now + QUESTION_MS,
    rejected: null,
    noTimer,
  };
}

const TABLES = new WeakMap<Question, Map<string, RankedAnswer[]>>();

function tableOf(
  question: Question,
  stadium: Stadium,
  rule: Rule,
): RankedAnswer[] {
  let byPin = TABLES.get(question);
  if (!byPin) {
    byPin = new Map();
    TABLES.set(question, byPin);
  }
  const key = `${rule}:${stadium.lat},${stadium.lng}`;
  let table = byPin.get(key);
  if (!table) {
    table = rankAnswers(question, stadium, rule);
    byPin.set(key, table);
  }
  return table;
}

/** The rule this game is scored by: `ruleFor(session.mode)`. */
export function ruleOf(session: Session): Rule {
  return ruleFor(session.mode);
}

/**
 * The full ranked table for question `index` of this game (best first), under the game's
 * rule. Computed once per question, stadium and rule, so it is cheap to call on every render.
 * Empty for a bad index.
 */
export function tableFor(
  session: Session,
  index: number,
): readonly RankedAnswer[] {
  const question = session.questions[index];
  if (!question) return [];
  return tableOf(question, session.stadium, ruleOf(session));
}

/** The question being asked, or just answered. The last question once the game is done. */
export function currentQuestion(session: Session): Question {
  return session.questions[session.index];
}

/** The turn recorded for the current question: null while it is still being asked. */
export function currentTurn(session: Session): Turn | null {
  return session.turns[session.index] ?? null;
}

export function isLastQuestion(session: Session): boolean {
  return session.index >= session.questions.length - 1;
}

/**
 * Milliseconds left on the clock, never negative. While asking it counts down (it stays at
 * QUESTION_MS with no timer, or when `now` is not a number). In `resolving` and `reveal` it
 * is frozen at the value the turn was decided on. 0 once done.
 */
export function msLeft(session: Session, now: number): number {
  if (session.phase === "done") return 0;
  if (session.phase !== "asking") return currentTurn(session)?.msLeft ?? 0;
  if (session.deadline === null || !Number.isFinite(now)) return QUESTION_MS;
  return Math.min(QUESTION_MS, Math.max(0, session.deadline - now));
}

/** Whether PASS is available: asking, and at least PASS_AFTER_MS into the question. */
export function canPass(session: Session, now: number): boolean {
  return (
    session.phase === "asking" &&
    Number.isFinite(now) &&
    now - session.startedAt >= PASS_AFTER_MS
  );
}

export interface Summary {
  total: number;
  /** Career tier 0 to 7 for the total. */
  tier: number;
  /** One grade per question decided so far, in order. */
  grades: Grade[];
  /** Every answer was the best one. */
  perfect: boolean;
}

export function summary(session: Session): Summary {
  return {
    total: session.total,
    tier: tierFor(session.total),
    grades: session.turns.map((turn) => turn.grade),
    perfect: isPerfect(session.total),
  };
}

function timedOut(session: Session, now: number): boolean {
  return session.deadline !== null && now >= session.deadline;
}

function record(session: Session, turn: Turn): Session {
  const turns = [...session.turns, turn];
  return {
    ...session,
    phase: "resolving",
    turns,
    total: turns.reduce((sum, t) => sum + t.points, 0),
    deadline: null,
    rejected: null,
  };
}

function blank(session: Session, grade: Grade, left: number): Session {
  return record(session, {
    questionId: currentQuestion(session).id,
    input: null,
    answerId: null,
    grade,
    points: 0,
    km: null,
    share: null,
    rank: null,
    msLeft: left,
  });
}

/**
 * Advance the game. Actions that make no sense in the current phase return the same session
 * object, so `next === session` means nothing happened.
 *
 * - `submit` (asking): an empty input is ignored. An unknown or ambiguous one sets `rejected`
 *   and the clock keeps running. A match records the turn and moves to `resolving`.
 * - `pass` (asking, once `canPass`): records `skipped` for 0 points, moves to `resolving`.
 * - `tick` (asking): at or past the deadline, records `timeup` for 0 points, moves to
 *   `resolving`. Otherwise nothing.
 * - `resolved` (resolving): the shot has played. Moves to `reveal`.
 * - `next` (reveal): the next question with a fresh clock, or `done` after the last.
 *
 * The clock is the referee: a `submit` or `pass` that arrives at or after the deadline is a
 * time-up, whatever it carried. An action whose `now` is not a finite number is ignored.
 */
export function reduce(session: Session, action: Action): Session {
  if ("now" in action && !Number.isFinite(action.now)) return session;
  switch (action.type) {
    case "tick": {
      if (session.phase !== "asking" || !timedOut(session, action.now)) {
        return session;
      }
      return blank(session, "timeup", 0);
    }
    case "pass": {
      if (session.phase !== "asking") return session;
      if (timedOut(session, action.now)) return blank(session, "timeup", 0);
      if (!canPass(session, action.now)) return session;
      return blank(session, "skipped", msLeft(session, action.now));
    }
    case "submit": {
      if (session.phase !== "asking") return session;
      if (typeof action.input !== "string") return session;
      if (timedOut(session, action.now)) return blank(session, "timeup", 0);
      const question = currentQuestion(session);
      const result = judge(question, action.input);
      if (result.kind === "empty") return session;
      const input = action.input.trim();
      if (result.kind !== "match") {
        return { ...session, rejected: { input, reason: result.kind } };
      }
      const table = tableOf(question, session.stadium, ruleOf(session));
      const row = rankedFor(table, result.answer.id);
      if (!row) return session;
      return record(session, {
        questionId: question.id,
        input,
        answerId: row.answer.id,
        grade: row.shot,
        points: row.points,
        km: row.km,
        share: row.share,
        rank: row.rank,
        msLeft: msLeft(session, action.now),
      });
    }
    case "resolved": {
      if (session.phase !== "resolving") return session;
      return { ...session, phase: "reveal" };
    }
    case "next": {
      if (session.phase !== "reveal") return session;
      if (isLastQuestion(session)) {
        return { ...session, phase: "done", deadline: null, rejected: null };
      }
      return {
        ...session,
        index: session.index + 1,
        phase: "asking",
        startedAt: action.now,
        deadline: session.noTimer ? null : action.now + QUESTION_MS,
        rejected: null,
      };
    }
    default:
      return session;
  }
}
