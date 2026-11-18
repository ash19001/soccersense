/**
 * The games the server runs: `POST /api/games/<mode>/<move>`.
 *
 *   start    start today's game: question 1 is sent and its clock starts now. With no
 *            player yet, { name?, check? } makes one (worker/app.ts): the name the device
 *            has shown, and the bot check's token
 *   look     the game as it stands now (on coming back to the page)
 *   answer   { day, index, input, whistle? }: an answer to question `index`. `whistle`: it
 *            is what was in the field when the page's clock ran out.
 *   pass     { day, index }
 *   next     { day, index }: on from question `index`'s reveal. The next question is sent
 *            and its clock starts now.
 *
 * `<mode>` is home, away, retro or nextgen. Every answer is `{ game, ticket }`: the game as
 * its player may see it now (`GameSnapshot`, ~/game/served), or null where there is none.
 *
 * **Who keeps the game** (the product owner, 2026-11-17: "for no account users everything
 * is stored on localstorage. the database is only used to check the question and answer
 * but not actually store anything"):
 *
 * - A player with no account keeps it themselves. `ticket` is the game with the server's
 *   seal on it (./ticket.ts); the page keeps it on the device and sends it back with every
 *   move. The server stores nothing about them: no row, no cookie.
 * - An account's game is a row in the database (./store.ts), and `ticket` is null. The
 *   Worker says who is signed in (`account`, from ../accounts/api.ts).
 *
 * The rules are the game's own (`reduce`, ~/game/session), the same code that runs a game
 * in the page, here with the questions' answers and the server's clock:
 *
 * - **A question is sent only as its clock starts**, never ahead; its answers are never
 *   sent, only the reveal once it is decided.
 * - **The clock is the server's.** An answer that arrives after the deadline is the whistle:
 *   it counts if the judge knows it, within `GRACE_MS` (the page sends what was in the field
 *   as its clock reaches zero, so it arrives a moment late). After that it is a time-up
 *   whatever was sent, and a game left alone is timed out by the next request to see it.
 * - **A move says which question it is about.** One that does not fit where the game is
 *   changes nothing and gets the game as it stands.
 *
 * What only a kept game can promise: one game a day, and a move sent twice happening once.
 * A ticket can be sent again, because the server does not remember it; what comes of that
 * never leaves the player's own device. So a ticket's game is on no board, and its player
 * is told where their total would have placed. Since 2026-11-18 a player with no account is
 * kept by the server as a guest (../accounts/api.ts), made at their first game: a ticket is
 * only where no guest could be made (the new-player limit).
 *
 * **HOME's and AWAY's shares move with the day** (~/game/day-shares): the question being
 * asked is scored on its natural shares blended with the answers players have given it
 * so far that day (./shares.ts), for every player alike. A score is the player's as they
 * answer: the turn keeps it, and nothing is scored again later.
 */

import { STADIUMS } from "~/data";
import { dayNumber, stadiumForDay } from "~/game/day";
import {
  type GameSnapshot,
  type ServedPhase,
  snapshotOf,
  storedQuestions,
} from "~/game/served";
import { scoredToday, sharesMove } from "~/game/day-shares";
import {
  PASS_AFTER_MS,
  type Rejection,
  type Session,
  createSession,
  reduce,
} from "~/game/session";
import type { Mode, Question } from "~/game/types";

import { database } from "../db/migrate";
import type { D1, Env } from "../env";
import { failure, json, wrongMethod } from "../http";
import { QUESTION_MODES } from "../questions/store";
import { type DayQuestions, questionsOn } from "./questions";
import { type CountedAnswer, dayCounts } from "./shares";
import type { GameState } from "./state";
import { deleteGame, gameOf, insertGame, updateGame } from "./store";
import { MAX_TICKET, seal, ticketKey, unseal } from "./ticket";

/** How long after the deadline an answer still counts as sent at the whistle. */
export const GRACE_MS = 2000;
/** A PASS this much early by the server's clock is taken as on time (the clocks differ). */
export const PASS_SLACK_MS = 1000;
/** The longest answer read: more than any name. */
export const MAX_INPUT = 200;
/** The most a move's request may carry: a ticket, and a little. */
export const MAX_BODY = MAX_TICKET + 1000;

/** What every answer of these addresses says. */
export interface GameAnswer {
  game: GameSnapshot | null;
  /**
   * The game for its player to keep and send back with the next move. Null where the
   * server keeps the game (an account's), and where there is no game.
   */
  ticket: string | null;
}

const MOVES = ["start", "look", "answer", "pass", "next"] as const;

/** A game in hand: as it is kept, and the session the rules run on. */
interface Held {
  state: GameState;
  session: Session;
}

/** Where a game is kept between two moves. */
interface Keeper {
  /** The player's game of `day` in this mode, or null. */
  load(day: number): Promise<GameState | null>;
  /** A new game. False if there is one already (it is kept). */
  create(state: GameState): Promise<boolean>;
  /**
   * The game after a move. False if it had been moved on meanwhile: nothing is kept.
   * `prompts`: what the questions asked, once the game is decided. `decided`: this move
   * decided it (an account's game is then counted on the day's board). `answer`: the
   * answer this move decided, in HOME or AWAY (an account's is counted for the day's
   * shares).
   */
  save(
    state: GameState,
    was: { index: number; phase: ServedPhase },
    prompts: readonly string[] | null,
    decided: boolean,
    answer: CountedAnswer | null,
  ): Promise<boolean>;
  /** Takes away a game that cannot be carried on. */
  remove(state: GameState): Promise<void>;
  /** What the page is to keep and send back: the sealed game, or null if it is kept here. */
  hand(state: GameState): Promise<string | null>;
}

/** A player with no account: the game is in the ticket they sent, and nowhere else. */
function ticketKeeper(
  key: CryptoKey,
  mode: Mode,
  given: GameState | null,
): Keeper {
  return {
    load: async (day) =>
      given && given.day === day && given.mode === mode ? given : null,
    create: async () => true,
    save: async () => true,
    remove: async () => undefined,
    hand: (state) => seal(key, state),
  };
}

/**
 * An account: the game is a row in the database. `counted`: its games go on the boards
 * and its answers into the day's shares; false for an account taken off the leaderboards
 * (../accounts/moderation.ts), which still plays.
 */
function rowKeeper(
  db: D1,
  account: string,
  mode: Mode,
  counted: boolean,
): Keeper {
  return {
    load: (day) => gameOf(db, { playerId: account, day, mode }),
    create: (state) => insertGame(db, { ...state, playerId: account }),
    save: (state, was, prompts, decided, answer) =>
      updateGame(
        db,
        { ...state, playerId: account },
        was,
        prompts,
        decided && counted,
        counted ? answer : null,
      ),
    remove: (state) =>
      deleteGame(db, { playerId: account, day: state.day, mode }),
    hand: async () => null,
  };
}

/**
 * The session of a kept game, with the day's questions. A finished game whose questions
 * have since changed is still the player's game: it is held with what its turns say. An
 * unfinished one cannot be carried on: null.
 */
function hold(state: GameState, set: DayQuestions): Held | null {
  const fits =
    state.index < set.questions.length &&
    state.turns.every((turn, i) => set.questions[i]?.id === turn.questionId);
  let questions: readonly Question[] = set.questions;
  if (!fits) {
    if (state.finishedAt === null || state.turns.length === 0) return null;
    questions = storedQuestions(state.mode, state.turns);
  }
  return {
    state,
    session: {
      mode: state.mode,
      dayNumber: state.day,
      stadium: stadiumForDay(state.day, STADIUMS),
      questions,
      index: Math.min(state.index, questions.length - 1),
      phase: state.phase,
      turns: state.turns,
      total: state.total,
      startedAt: state.startedAt,
      deadline: state.phase === "asking" ? state.deadline : null,
      rejected: null,
      noTimer: false,
    },
  };
}

/** The game as it is kept after a move. A shot still playing is, to the server, a reveal. */
function stateAfter(
  state: GameState,
  session: Session,
  now: number,
): GameState {
  const phase = session.phase === "resolving" ? "reveal" : session.phase;
  const decided = session.turns.length >= session.questions.length;
  return {
    ...state,
    index: session.index,
    phase,
    turns: [...session.turns],
    total: session.total,
    startedAt: session.startedAt,
    deadline: phase === "asking" ? session.deadline : null,
    updatedAt: now,
    finishedAt: state.finishedAt ?? (decided ? now : null),
  };
}

/**
 * The game with the question in hand as it is scored now: in HOME and AWAY, its shares
 * blended with the day's answers so far (~/game/day-shares). Asked for while the question
 * is being asked (to score an answer) and at its reveal (to show the table).
 */
async function withTheDay(db: D1, held: Held, now: number): Promise<Held> {
  const { session } = held;
  if (!sharesMove(session.mode)) return held;
  if (session.phase !== "asking" && session.phase !== "reveal") return held;
  const question = session.questions[session.index];
  // A finished game held with only what its turns say has no answers to score.
  if (!question || question.answers.length === 0) return held;
  const counts = await dayCounts(
    db,
    session.dayNumber,
    session.mode,
    question.id,
    now,
  );
  const scored = scoredToday(question, counts);
  if (scored === question) return held;
  const questions = [...session.questions];
  questions[session.index] = scored;
  return { state: held.state, session: { ...session, questions } };
}

/**
 * The answer a move decided, to count for the day's shares: the new turn's, in HOME or
 * AWAY, where the judge accepted one (not a pass or a time-up).
 */
function answerDecided(before: Session, after: Session): CountedAnswer | null {
  if (!sharesMove(after.mode)) return null;
  if (after.turns.length <= before.turns.length) return null;
  const turn = after.turns[before.turns.length];
  if (!turn || turn.answerId === null) return null;
  return {
    day: after.dayNumber,
    mode: after.mode,
    questionId: turn.questionId,
    answerId: turn.answerId,
  };
}

/** The page plays the shot; the server goes straight on to the reveal. */
function settled(session: Session): Session {
  return session.phase === "resolving"
    ? reduce(session, { type: "resolved" })
    : session;
}

/** A question whose clock ran out more than the grace ago is a time-up, whoever asks. */
function timedOut(held: Held, now: number): boolean {
  const { session } = held;
  return (
    session.phase === "asking" &&
    session.deadline !== null &&
    now >= session.deadline + GRACE_MS
  );
}

interface MoveBody {
  ticket: unknown;
  day: number | null;
  index: number | null;
  input: string;
  whistle: boolean;
}

const isWhole = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value);

async function bodyOf(request: Request): Promise<MoveBody | null> {
  let bag: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY) return null;
    bag = text.trim() === "" ? {} : (JSON.parse(text) as unknown);
  } catch {
    return null;
  }
  if (typeof bag !== "object" || bag === null || Array.isArray(bag)) {
    return null;
  }
  const { ticket, day, index, input, whistle } = bag as Record<string, unknown>;
  if (day !== undefined && (!isWhole(day) || day < 1)) return null;
  if (index !== undefined && (!isWhole(index) || index < 0)) return null;
  if (input !== undefined && typeof input !== "string") return null;
  if (ticket !== undefined && ticket !== null && typeof ticket !== "string") {
    return null;
  }
  return {
    ticket: ticket ?? undefined,
    day: day ?? null,
    index: index ?? null,
    input: (input ?? "").slice(0, MAX_INPUT),
    whistle: whistle === true,
  };
}

/**
 * Answers a request under `/api/games`. `route` is the path after `/api`. `account` is
 * the id of the signed-in player's account, whose games are kept in the database; null
 * is a player with no account, who keeps their own. `counted`: an account's games go on
 * the boards and its answers into the day's shares (false: taken off the leaderboards).
 */
export async function games(
  request: Request,
  env: Env,
  now: number,
  route: string,
  account: string | null = null,
  counted = true,
): Promise<Response> {
  const [, modeName, moveName, ...rest] = route.split("/").filter(Boolean);
  const mode = QUESTION_MODES.find((m) => m === modeName);
  const move = MOVES.find((m) => m === moveName);
  if (!mode || !move || rest.length > 0) return failure("not_found", 404, now);
  const refused = wrongMethod(request, ["POST"], now);
  if (refused) return refused;
  if (!env.DB) return failure("no_database", 503, now);
  const db = env.DB;
  await database(db, now);

  const body = await bodyOf(request);
  if (!body) return failure("bad_request", 400, now);

  let keeper: Keeper;
  if (account !== null) {
    keeper = rowKeeper(db, account, mode, counted);
  } else {
    const key = await ticketKey(db, now);
    const given =
      body.ticket === undefined ? null : await unseal(key, body.ticket);
    keeper = ticketKeeper(key, mode, given);
  }

  const today = dayNumber(new Date(now));
  const reply = async (
    held: Held | null,
    rejected: Rejection | null = null,
  ): Promise<Response> => {
    const answer: GameAnswer = {
      game: held ? snapshotOf(held.session, rejected) : null,
      ticket: held ? await keeper.hand(held.state) : null,
    };
    return json(answer, now);
  };

  /** Keeps a move's outcome. Null if the game had been moved on meanwhile. */
  const write = async (held: Held, next: Session): Promise<Held | null> => {
    const session = settled(next);
    const state = stateAfter(held.state, session, now);
    const prompts =
      state.finishedAt === null
        ? null
        : session.questions
            .slice(0, session.turns.length)
            .map((question) => question.prompt);
    const kept = await keeper.save(
      state,
      { index: held.state.index, phase: held.state.phase },
      prompts,
      held.state.finishedAt === null && state.finishedAt !== null,
      answerDecided(held.session, session),
    );
    return kept ? { state, session } : null;
  };

  /** The player's game of a day, held with that day's questions, and brought up to time. */
  const find = async (
    day: number,
  ): Promise<{ held: Held | null; stale: GameState | null }> => {
    const state = await keeper.load(day);
    if (!state) return { held: null, stale: null };
    const set = await questionsOn(env, db, day, mode, now);
    const kept = hold(state, set);
    if (!kept) return { held: null, stale: state };
    let held: Held | null = await withTheDay(db, kept, now);
    if (timedOut(held, now)) {
      const late = await write(
        held,
        reduce(held.session, { type: "tick", now }),
      );
      // Lost to another request: that one's outcome is the game.
      held = late ?? (await find(day)).held;
    }
    return { held, stale: null };
  };

  if (move === "look") return reply((await find(today)).held);

  if (move === "start") {
    const found = await find(today);
    let { held } = found;
    if (!held) {
      // One that cannot be carried on gives way to a new one.
      if (found.stale) await keeper.remove(found.stale);
      const set = await questionsOn(env, db, today, mode, now);
      const session = createSession({
        mode,
        dayNumber: today,
        stadium: stadiumForDay(today, STADIUMS),
        questions: set.questions,
        now,
      });
      const state: GameState = {
        day: today,
        mode,
        source: set.source,
        index: session.index,
        phase: "asking",
        turns: [],
        total: 0,
        startedAt: session.startedAt,
        deadline: session.deadline,
        createdAt: now,
        updatedAt: now,
        finishedAt: null,
      };
      held = (await keeper.create(state))
        ? { state, session }
        : // started twice at once: the other start's game is the game
          (await find(today)).held;
    }
    if (!held) return failure("conflict", 409, now);
    return reply(held);
  }

  if (body.day === null || body.index === null) {
    return failure("bad_request", 400, now);
  }
  // A game belongs to the day it started on, and may be finished a little into the next.
  if (body.day !== today && body.day !== today - 1) {
    return failure("no_game", 404, now);
  }
  const { held } = await find(body.day);
  if (!held) return failure("no_game", 404, now);
  const { session } = held;
  // A move about another question than the one in hand changes nothing.
  if (session.index !== body.index) return reply(held);

  let next = session;
  let rejected: Rejection | null = null;
  if (move === "next") {
    next = reduce(session, { type: "next", now });
  } else if (session.phase === "asking" && session.deadline !== null) {
    if (move === "answer") {
      // The page's whistle can come a moment before the server's: it is the whistle.
      const early = body.whistle && now < session.deadline;
      const at =
        early && session.deadline - now <= GRACE_MS ? session.deadline : now;
      next = reduce(session, { type: "submit", input: body.input, now: at });
      rejected = next.phase === "asking" ? next.rejected : null;
    } else {
      const waited = now - session.startedAt;
      const at =
        waited < PASS_AFTER_MS && PASS_AFTER_MS - waited <= PASS_SLACK_MS
          ? session.startedAt + PASS_AFTER_MS
          : now;
      next = reduce(session, { type: "pass", now: at });
    }
  }

  // Nothing to keep: an answer the judge did not know, or a move that did not apply.
  if (
    next === session ||
    (next.phase === "asking" && next.index === session.index)
  ) {
    return reply(held, rejected);
  }
  const written = await write(held, next);
  const after = written ?? (await find(body.day)).held;
  if (!after) return failure("no_game", 404, now);
  return reply(after);
}
