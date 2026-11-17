// The page's side of the games the server runs (worker/games/play.ts): the five requests,
// and what each can come back with. The referee (./controller.ts) decides what to do with
// the answers; this only asks, and says plainly how asking went.
//
// Browser only. A player with no account keeps their own game: the server hands it back
// after every move as a sealed ticket, which the page keeps on the device and sends with
// the next move. The server stores nothing about them, and sets no cookie.

import { type GameSnapshot, type Mode, isGameSnapshot } from "~/game";

/** A request with no answer by now has failed. */
export const SERVER_TIMEOUT_MS = 8000;

/**
 * How asking went wrong.
 * - `unreachable`: no answer, or not the API's (offline, a timeout, the server failing).
 *   Asking again may work.
 * - `gone`: the server will not take the game up (its ticket is not one it sealed, it is
 *   another day's, or the day's questions were changed under it). The page starts afresh.
 */
export class ServerError extends Error {
  constructor(
    readonly kind: "unreachable" | "gone",
    readonly status: number | null = null,
  ) {
    super(`the game server: ${kind}${status === null ? "" : ` (${status})`}`);
    this.name = "ServerError";
  }
}

/** What the server says after a move: the game, and the ticket to send with the next. */
export interface Reply {
  game: GameSnapshot;
  /** Null where the server keeps the game itself (an account's). */
  ticket: string | null;
}

/** The games the server runs, as the page asks for them. Every answer is the whole game. */
export interface GameServer {
  /** Start today's game: question 1 arrives and its clock starts. */
  start(mode: Mode): Promise<Reply>;
  /**
   * The game as it stands now (on coming back to the page): the clock may have moved it
   * on. Null if there is no game of today's to take up.
   */
  look(mode: Mode, ticket: string | null): Promise<Reply | null>;
  /** An answer to question `index`. `whistle`: what was in the field as the clock ran out. */
  answer(
    mode: Mode,
    ticket: string | null,
    day: number,
    index: number,
    input: string,
    whistle: boolean,
  ): Promise<Reply>;
  pass(
    mode: Mode,
    ticket: string | null,
    day: number,
    index: number,
  ): Promise<Reply>;
  /** On from question `index`'s reveal: the next question arrives and its clock starts. */
  next(
    mode: Mode,
    ticket: string | null,
    day: number,
    index: number,
  ): Promise<Reply>;
}

export interface GameServerOptions {
  /** `fetch`, unless a test says otherwise. */
  request?: (url: string, init: RequestInit) => Promise<Response>;
  /** Where the API is: the site's own `/api/games`. */
  base?: string;
  timeoutMs?: number;
}

function siteBase(): string {
  const base = import.meta.env.BASE_URL || "/";
  return new URL(`${base}api/games`, window.location.href).href;
}

/** The API's own words for a game it will not take up. */
const GONE: readonly unknown[] = ["no_game", "conflict"];

/** The site's own game server. */
export function gameServer(options: GameServerOptions = {}): GameServer {
  const request =
    options.request ?? ((url: string, init: RequestInit) => fetch(url, init));
  const timeoutMs = options.timeoutMs ?? SERVER_TIMEOUT_MS;

  const ask = async (
    path: string,
    body: Record<string, unknown>,
  ): Promise<Reply | null> => {
    const stop = new AbortController();
    const timer = setTimeout(() => stop.abort(), timeoutMs);
    let response: Response;
    let heard: unknown;
    try {
      response = await request(`${options.base ?? siteBase()}/${path}`, {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        signal: stop.signal,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      heard = await response.json().catch(() => null);
    } catch {
      throw new ServerError("unreachable");
    } finally {
      clearTimeout(timer);
    }
    const said: Record<string, unknown> =
      typeof heard === "object" && heard !== null
        ? (heard as Record<string, unknown>)
        : {};
    // The API itself says it has no such game. (A bare 404 is no API answering at all.)
    if (
      (response.status === 404 || response.status === 409) &&
      GONE.includes(said.error)
    ) {
      throw new ServerError("gone", response.status);
    }
    if (response.status !== 200 || !("game" in said)) {
      throw new ServerError("unreachable", response.status);
    }
    if (said.game === null) return null;
    // Anything that is not a game the page can play from is no answer at all.
    if (!isGameSnapshot(said.game)) throw new ServerError("unreachable", 200);
    return {
      game: said.game,
      ticket: typeof said.ticket === "string" ? said.ticket : null,
    };
  };

  /** A move's answer is always a game. */
  const move = async (
    path: string,
    body: Record<string, unknown>,
  ): Promise<Reply> => {
    const reply = await ask(path, body);
    if (reply === null) throw new ServerError("gone", 200);
    return reply;
  };

  /** The ticket goes with a move only where there is one. */
  const held = (ticket: string | null) => (ticket === null ? {} : { ticket });

  return {
    start: (mode) => move(`${mode}/start`, {}),
    look: (mode, ticket) => ask(`${mode}/look`, held(ticket)),
    answer: (mode, ticket, day, index, input, whistle) =>
      move(`${mode}/answer`, { ...held(ticket), day, index, input, whistle }),
    pass: (mode, ticket, day, index) =>
      move(`${mode}/pass`, { ...held(ticket), day, index }),
    next: (mode, ticket, day, index) =>
      move(`${mode}/next`, { ...held(ticket), day, index }),
  };
}
