// A game in progress, kept in storage as it goes, so a reload carries on where it was.
//
// `~/game/storage` keeps finished games (the home page reads them for the scores on the
// ball). This keeps the unfinished one, under its own key beside it:
// `soccersense:v1:<dayKey>:<mode>:live`. It is written at every step of the game and taken
// away at full time, when the finished game is saved in its place. Like `~/game/storage`,
// nothing here throws: no storage, blocked storage or junk in it reads as "nothing saved".

import {
  type Grade,
  type Phase,
  type Question,
  type Session,
  type StorageLike,
  type Turn,
  SHOT_ORDER,
  dayKeyFor,
  storageKey,
} from "~/game";

export const LIVE_SUFFIX = "live";

/** The key a game in progress is kept under. */
export function liveKey(dayKey: string, mode: Session["mode"]): string {
  return `${storageKey(dayKey, mode)}:${LIVE_SUFFIX}`;
}

/** What is kept: the session without its questions and stadium (those are looked up). */
interface StoredLive {
  stadiumId: string;
  questionIds: string[];
  index: number;
  phase: Phase;
  turns: Turn[];
  startedAt: number;
  deadline: number | null;
  noTimer: boolean;
}

function resolveStorage(
  given: StorageLike | null | undefined,
): StorageLike | null {
  if (given !== undefined) return given;
  try {
    const found = (globalThis as { localStorage?: StorageLike }).localStorage;
    return found && typeof found.getItem === "function" ? found : null;
  } catch {
    return null;
  }
}

/** A game begun before the six shots (with the old grades) is not carried on. */
const GRADES: readonly Grade[] = [...SHOT_ORDER, "timeup", "skipped"];
const PHASES: readonly Phase[] = ["asking", "resolving", "reveal", "done"];

const isNumber = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

function isTurn(value: unknown): value is Turn {
  if (typeof value !== "object" || value === null) return false;
  const t = value as Record<string, unknown>;
  return (
    typeof t.questionId === "string" &&
    (t.input === null || typeof t.input === "string") &&
    (t.answerId === null || typeof t.answerId === "string") &&
    (GRADES as readonly unknown[]).includes(t.grade) &&
    isNumber(t.points) &&
    Number.isInteger(t.points) &&
    t.points >= 0 &&
    t.points <= 100 &&
    (t.km === null || isNumber(t.km)) &&
    // A game begun before HOME and AWAY were scored by popularity has no share: it is not
    // carried on (its points were counted by distance).
    (t.share === null || isNumber(t.share)) &&
    (t.rank === null || isNumber(t.rank)) &&
    isNumber(t.msLeft)
  );
}

/** Keep the game so far. Returns whether it was written. A finished game is not kept here. */
export function saveLive(
  session: Session,
  storage?: StorageLike | null,
): boolean {
  try {
    const store = resolveStorage(storage);
    if (!store || session.phase === "done") return false;
    const value: StoredLive = {
      stadiumId: session.stadium.id,
      questionIds: session.questions.map((q) => q.id),
      index: session.index,
      phase: session.phase,
      turns: [...session.turns],
      startedAt: session.startedAt,
      deadline: session.deadline,
      noTimer: session.noTimer,
    };
    store.setItem(
      liveKey(dayKeyFor(session.dayNumber), session.mode),
      JSON.stringify(value),
    );
    return true;
  } catch {
    return false;
  }
}

export function clearLive(
  dayKey: string,
  mode: Session["mode"],
  storage?: StorageLike | null,
): void {
  try {
    resolveStorage(storage)?.removeItem(liveKey(dayKey, mode));
  } catch {
    // Nothing to do.
  }
}

export interface LiveContext {
  mode: Session["mode"];
  dayNumber: number;
  stadium: Session["stadium"];
  questions: readonly Question[];
}

/**
 * The game in progress for that day and mode, as a session to carry on with, or null if
 * there is none or it does not fit today's game any more (another stadium, other
 * questions, damaged). A game saved in the middle of its shot comes back at its reveal:
 * the shot is not played again.
 */
export function loadLive(
  context: LiveContext,
  storage?: StorageLike | null,
): Session | null {
  try {
    const store = resolveStorage(storage);
    if (!store) return null;
    const raw = store.getItem(
      liveKey(dayKeyFor(context.dayNumber), context.mode),
    );
    if (raw === null) return null;
    const v = JSON.parse(raw) as Partial<StoredLive> | null;
    if (typeof v !== "object" || v === null) return null;
    const { questions, stadium } = context;
    if (v.stadiumId !== stadium.id) return null;
    if (
      !Array.isArray(v.questionIds) ||
      v.questionIds.length !== questions.length ||
      v.questionIds.some((id, i) => id !== questions[i].id)
    ) {
      return null;
    }
    const phase = PHASES.find((p) => p === v.phase);
    if (phase === undefined || phase === "done") return null;
    const index = v.index;
    if (
      !isNumber(index) ||
      !Number.isInteger(index) ||
      index < 0 ||
      index >= questions.length
    ) {
      return null;
    }
    if (!Array.isArray(v.turns) || !v.turns.every(isTurn)) return null;
    const turns: Turn[] = v.turns;
    const decided = phase === "asking" ? index : index + 1;
    if (turns.length !== decided) return null;
    if (turns.some((turn, i) => turn.questionId !== questions[i].id))
      return null;
    if (!isNumber(v.startedAt)) return null;
    if (v.deadline !== null && !isNumber(v.deadline)) return null;
    const noTimer = v.noTimer === true;
    return {
      mode: context.mode,
      dayNumber: context.dayNumber,
      stadium,
      questions,
      index,
      phase: phase === "resolving" ? "reveal" : phase,
      turns,
      total: turns.reduce((sum, t) => sum + t.points, 0),
      startedAt: v.startedAt,
      deadline: phase === "asking" && !noTimer ? (v.deadline ?? null) : null,
      rejected: null,
      noTimer,
    };
  } catch {
    return null;
  }
}

/** A finished game (from `loadGame`) as a session at full time, to show its card again. */
export function finishedSession(
  context: LiveContext,
  turns: readonly Turn[],
  now: number,
): Session | null {
  const { questions } = context;
  if (turns.length !== questions.length) return null;
  if (turns.some((turn, i) => turn.questionId !== questions[i].id)) return null;
  return {
    mode: context.mode,
    dayNumber: context.dayNumber,
    stadium: context.stadium,
    questions,
    index: questions.length - 1,
    phase: "done",
    turns,
    total: turns.reduce((sum, t) => sum + t.points, 0),
    startedAt: now,
    deadline: null,
    rejected: null,
    noTimer: false,
  };
}
