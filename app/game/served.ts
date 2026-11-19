/**
 * A game the server runs.
 *
 * Where the page runs a game itself, every question and every answer is in its code, for
 * anyone to read. Where the server runs it (worker/games), the page is sent a question as
 * that question's clock starts, the server judges what is typed, and the reveal comes once
 * the question is decided. After every move the server answers with the game as its player
 * may see it: a `GameSnapshot`. The page makes its `Session` from that (`sessionFrom`), so
 * the board, the sheet and the full-time card read it as they always have.
 *
 * Both ends use this file: the Worker to make a snapshot (`snapshotOf`), the page to check
 * and read one (`isGameSnapshot`, `sessionFrom`).
 */
import { type Reveal, type RevealRow, revealOf } from "./reveal";
import {
  type Phase,
  type Rejection,
  type Session,
  type Turn,
  tableFor,
} from "./session";
import { isDistanceMode } from "./modes";
import { SHOT_ORDER } from "./shots";
import { isTurn } from "./storage";
import type {
  LatLng,
  Measure,
  Mode,
  Question,
  RankedAnswer,
  Shot,
  Stadium,
} from "./types";

/** A question as the page is given it: asked, with none of its answers. */
export type AskedQuestion = Pick<
  Question,
  "id" | "prompt" | "measure" | "measureLabel"
>;

/**
 * Where a game the server runs can be. It has no `resolving`: that is the page playing the
 * shot, between hearing the verdict and opening the sheet.
 */
export type ServedPhase = Exclude<Phase, "resolving">;

/** The game as its player may see it now: what the server sends after every move. */
export interface GameSnapshot {
  /** The game's day (`dayNumber`) and mode. */
  day: number;
  mode: Mode;
  /** How many questions the game has. */
  count: number;
  /** The questions asked so far, in order: the current one is the last. Never one ahead. */
  questions: AskedQuestion[];
  /** The current question, 0-based. The last one once done. */
  index: number;
  phase: ServedPhase;
  /** One per question decided so far, in order. */
  turns: Turn[];
  total: number;
  /** The current question's clock, by the server's time. */
  startedAt: number;
  /** When it runs out. Null unless a question is being asked. */
  deadline: number | null;
  /** The current question's reveal, while the game is at it. Null otherwise. */
  reveal: Reveal | null;
  /** The answer just sent, if the judge did not know it. Only in the reply to that answer. */
  rejected: Rejection | null;
}

/** The part of a question the page may have before it is decided. */
export function askedQuestion(question: Question): AskedQuestion {
  return {
    id: question.id,
    prompt: question.prompt,
    measure: question.measure,
    measureLabel: question.measureLabel,
  };
}

/**
 * A question as the page holds it in a game the server runs: what was asked, and an empty
 * answer list. With nothing given it is a blank, standing in for a question not asked yet.
 */
export function blankQuestion(
  mode: Mode,
  asked: Partial<AskedQuestion> = {},
): Question {
  return {
    id: asked.id ?? "",
    mode,
    prompt: asked.prompt ?? "",
    measure: asked.measure ?? "location",
    measureLabel: asked.measureLabel ?? "",
    asOf: "",
    answers: [],
  };
}

function shownRow<T extends RankedAnswer>(row: T, mapped: boolean): T {
  const { id, name, country } = row.answer;
  if (!mapped) return { ...row, answer: { id, name, country } };
  const { lat, lng } = row.answer as RankedAnswer["answer"] & Partial<LatLng>;
  return { ...row, answer: { id, name, country, lat, lng } };
}

/**
 * A reveal with nothing in it the sheet does not show: no aliases, places or map points.
 * `mapped`: CLOSEST and FURTHEST, whose map shows where each decided answer is: its point
 * on the map stays (the question is decided: nothing is given away).
 */
export function shownReveal(reveal: Reveal, mapped = false): Reveal {
  return {
    rows: reveal.rows.map((row) => shownRow(row, mapped)),
    row: reveal.row ? shownRow(reveal.row, mapped) : null,
    best: reveal.best ? shownRow(reveal.best, mapped) : null,
    tableSize: reveal.tableSize,
    oneCountry: reveal.oneCountry,
  };
}

/**
 * The snapshot of a game held with its full questions (the server's side): the questions
 * asked so far without their answers, and the current question's reveal once it is decided.
 * `rejected` is the answer just turned down, for the reply to it.
 */
export function snapshotOf(
  session: Session,
  rejected: Rejection | null = null,
): GameSnapshot {
  const phase: ServedPhase =
    session.phase === "resolving" ? "reveal" : session.phase;
  const turn = session.turns[session.index];
  return {
    day: session.dayNumber,
    mode: session.mode,
    count: session.questions.length,
    questions: session.questions.slice(0, session.index + 1).map(askedQuestion),
    index: session.index,
    phase,
    turns: [...session.turns],
    total: session.total,
    startedAt: session.startedAt,
    deadline: phase === "asking" ? session.deadline : null,
    reveal:
      phase === "reveal" && turn
        ? shownReveal(
            revealOf(tableFor(session, session.index), turn.answerId),
            isDistanceMode(session.mode),
          )
        : null,
    rejected: phase === "asking" ? rejected : null,
  };
}

/**
 * The page's session for a snapshot: the questions asked so far with no answers, blanks for
 * the ones to come, and the current reveal where `revealFor` looks for it. The stadium is
 * the day's pin, which the page works out for itself.
 */
export function sessionFrom(snapshot: GameSnapshot, stadium: Stadium): Session {
  const count = Math.max(snapshot.count, snapshot.questions.length, 1);
  return {
    mode: snapshot.mode,
    dayNumber: snapshot.day,
    stadium,
    questions: Array.from({ length: count }, (_, i) =>
      blankQuestion(snapshot.mode, snapshot.questions[i]),
    ),
    index: snapshot.index,
    phase: snapshot.phase,
    turns: snapshot.turns,
    total: snapshot.total,
    startedAt: snapshot.startedAt,
    deadline: snapshot.phase === "asking" ? snapshot.deadline : null,
    rejected: snapshot.phase === "asking" ? snapshot.rejected : null,
    noTimer: false,
    reveals: Array.from({ length: count }, (_, i) =>
      i === snapshot.index ? (snapshot.reveal ?? undefined) : undefined,
    ),
  };
}

/**
 * The questions of a finished game kept on the device (`StoredGame`), as far as it says:
 * each turn's question with its prompt and no answers. Enough to show the game again at
 * full time and to share it.
 */
export function storedQuestions(
  mode: Mode,
  turns: readonly Turn[],
  prompts: readonly string[] = [],
): Question[] {
  return turns.map((turn, i) =>
    blankQuestion(mode, { id: turn.questionId, prompt: prompts[i] ?? "" }),
  );
}

// --- checking what arrives -------------------------------------------------------------

const MODES: readonly Mode[] = [
  "home",
  "away",
  "retro",
  "nextgen",
  "closest",
  "furthest",
];
const MEASURES: readonly Measure[] = [
  "birthplace",
  "ground",
  "location",
  "capital",
];
const PHASES: readonly ServedPhase[] = ["asking", "reveal", "done"];

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;
const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const isWhole = (value: unknown): value is number =>
  isNumber(value) && Number.isInteger(value);

function isAsked(value: unknown): value is AskedQuestion {
  return (
    isObject(value) &&
    typeof value.id === "string" &&
    typeof value.prompt === "string" &&
    (MEASURES as readonly unknown[]).includes(value.measure) &&
    typeof value.measureLabel === "string"
  );
}

function isRanked(value: unknown): value is RankedAnswer {
  if (!isObject(value) || !isObject(value.answer)) return false;
  const { answer } = value;
  return (
    typeof answer.id === "string" &&
    typeof answer.name === "string" &&
    typeof answer.country === "string" &&
    isNumber(value.km) &&
    isNumber(value.share) &&
    (SHOT_ORDER as readonly unknown[]).includes(value.shot) &&
    isWhole(value.points) &&
    isWhole(value.rank) &&
    (value.year === null || isNumber(value.year))
  );
}

function isRevealRow(value: unknown): value is RevealRow {
  return (
    isRanked(value) &&
    (value as { grade?: Shot }).grade === value.shot &&
    typeof (value as { isPlayer?: unknown }).isPlayer === "boolean" &&
    isWhole((value as { index?: unknown }).index)
  );
}

function isReveal(value: unknown): value is Reveal {
  return (
    isObject(value) &&
    Array.isArray(value.rows) &&
    value.rows.every(isRevealRow) &&
    (value.row === null || isRanked(value.row)) &&
    (value.best === null || isRanked(value.best)) &&
    isWhole(value.tableSize) &&
    typeof value.oneCountry === "boolean"
  );
}

function isRejection(value: unknown): value is Rejection {
  return (
    isObject(value) &&
    typeof value.input === "string" &&
    (value.reason === "unknown" || value.reason === "ambiguous")
  );
}

/**
 * Whether `value` is a snapshot the page can play from: every part of the right kind, and
 * the parts agreeing with each other (a turn for each question decided, the total their
 * sum, a question for the one being asked). Anything else is not read at all.
 */
export function isGameSnapshot(value: unknown): value is GameSnapshot {
  if (!isObject(value)) return false;
  const { count, index, phase, turns, questions } = value;
  if (!isWhole(value.day) || value.day < 1) return false;
  if (!(MODES as readonly unknown[]).includes(value.mode)) return false;
  if (!isWhole(count) || count < 1 || count > 50) return false;
  if (!isWhole(index) || index < 0 || index >= count) return false;
  if (!(PHASES as readonly unknown[]).includes(phase)) return false;
  if (!Array.isArray(turns) || !turns.every(isTurn)) return false;
  if (!Array.isArray(questions) || !questions.every(isAsked)) return false;
  // A question for the one in hand, and none ahead of it.
  if (questions.length !== index + 1) return false;
  if (turns.length !== (phase === "asking" ? index : index + 1)) return false;
  if (phase === "done" && turns.length !== count) return false;
  if (turns.some((turn, i) => turn.questionId !== questions[i].id)) {
    return false;
  }
  if (value.total !== turns.reduce((sum, turn) => sum + turn.points, 0)) {
    return false;
  }
  if (!isNumber(value.startedAt)) return false;
  if (value.deadline !== null && !isNumber(value.deadline)) return false;
  if (phase === "asking" && value.deadline === null) return false;
  if (value.reveal !== null && !isReveal(value.reveal)) return false;
  if (phase === "reveal" && value.reveal === null) return false;
  return value.rejected === null || isRejection(value.rejected);
}
