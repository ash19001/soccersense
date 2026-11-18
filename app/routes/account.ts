// The player's account, for the pages: who plays on this device as the server keeps them,
// who is signed in, and the requests that sign in and out (worker/accounts/api.ts). One
// store for the page, for `useSyncExternalStore`: nothing is read until React subscribes,
// which is after mounting. Browser only.
//
// An account is optional. Every player who has played is kept by the server all the same
// (the product owner, 2026-11-18): a player with no account is a guest, with a name the
// server gave or took and a place on the leaderboards. The home screen asks who plays here
// as it opens (`refresh`): before a first game the answer is nobody, at no cost to the
// server. Whoever it is, their name is this device's nickname from then on.
//
// A device signed in swaps its finished games with the account's (`sync`), each time the
// server says who is signed in: the account's games it lacks are kept on the device, where
// the streak, the stats, the scores and the reviews read them, and the device's own games
// the account lacks are sent up (the product owner, 2026-11-17: "streaks, stats, etc.
// should be saved to database if the user is logged in").

import {
  ACCOUNT_PROBLEMS,
  type AccountAnswer,
  type AccountProblem,
  type AccountView,
  HISTORY_BATCH,
  type HistoryAnswer,
  type HistoryGame,
  type HistoryKey,
  type PlayerView,
  type SignInWays,
  dayKeyFor,
  dayNumber,
  forgetLinkAsked,
  isAccountAnswer,
  isHistoryAnswer,
  loadAccount,
  loadGame,
  loadHistory,
  noteLinkAsked,
  notePlayer,
  saveAccount,
  saveGame,
} from "~/game";

import { nicknameStore } from "./nickname";

/** A request with no answer by now has failed. */
export const ACCOUNT_TIMEOUT_MS = 10_000;

export interface AccountState {
  /** Who is signed in on this device, as far as the page knows. */
  account: AccountView | null;
  /**
   * Whoever plays on this device as the server keeps them, signed in or not (a guest); null
   * before their first game, or until the server has said.
   */
  player: PlayerView | null;
  /** The ways of signing in the server is set up for; null until it has said. */
  signIn: SignInWays | null;
  /**
   * Asking the server who is signed in: not yet, asking now, it answered, or it could
   * not be reached.
   */
  asked: "no" | "asking" | "yes" | "failed";
  /** Counts the times the account's games have been brought onto the device. */
  synced: number;
}

/** How a request went: done, or why not (and, for a name, what is wrong with it). */
export type AccountResult =
  { ok: true } | { ok: false; problem: AccountProblem; detail: string | null };

const NOBODY: AccountState = {
  account: null,
  player: null,
  signIn: null,
  asked: "no",
  synced: 0,
};

let state: AccountState = NOBODY;
const listeners = new Set<() => void>();

function set(change: Partial<AccountState>): void {
  state = { ...state, ...change };
  for (const listener of [...listeners]) listener();
}

/**
 * Takes what the server said about who plays here: the device's notes and the nickname
 * follow.
 */
function take(answer: AccountAnswer): void {
  saveAccount(answer.account);
  const player =
    answer.player ??
    (answer.account ? { nickname: answer.account.nickname } : null);
  notePlayer(player !== null);
  if (player) nicknameStore.adopt(player.nickname);
  set({
    account: answer.account,
    player,
    signIn: answer.signIn,
    asked: "yes",
  });
}

function api(path: string): string {
  const base = import.meta.env.BASE_URL || "/";
  return new URL(`${base}api/account${path}`, window.location.href).href;
}

/** One request to the account API: the answer if it is one, or why not. */
async function ask(
  path: string,
  body?: Record<string, unknown>,
): Promise<
  AccountAnswer | { sent: true } | Extract<AccountResult, { ok: false }>
> {
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), ACCOUNT_TIMEOUT_MS);
  try {
    const response = await fetch(api(path), {
      method: body ? "POST" : "GET",
      cache: "no-store",
      credentials: "same-origin",
      signal: stop.signal,
      ...(body && {
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    });
    const said: unknown = await response.json().catch(() => null);
    if (response.ok && isAccountAnswer(said)) return said;
    const bag =
      typeof said === "object" && said !== null
        ? (said as Record<string, unknown>)
        : {};
    if (response.ok && bag.sent === true) return { sent: true };
    const problem = ACCOUNT_PROBLEMS.find((p) => p === bag.error) ?? "failed";
    return {
      ok: false,
      problem,
      detail: typeof bag.problem === "string" ? bag.problem : null,
    };
  } catch {
    return { ok: false, problem: "failed", detail: null };
  } finally {
    clearTimeout(timer);
  }
}

const failed = (
  heard: Awaited<ReturnType<typeof ask>>,
): heard is Extract<AccountResult, { ok: false }> =>
  "ok" in heard && heard.ok === false;

/** One swap of games with the account (`POST /api/account/history`), or null if it failed. */
async function swap(body: {
  have?: HistoryKey[];
  give?: HistoryGame[];
}): Promise<HistoryAnswer | null> {
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), ACCOUNT_TIMEOUT_MS * 3);
  try {
    const response = await fetch(api("/history"), {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
      signal: stop.signal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const said: unknown = await response.json().catch(() => null);
    return response.ok && isHistoryAnswer(said) ? said : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

let syncing = false;

/**
 * Swaps finished games with the account: the account's that this device lacks (or holds
 * with another total: the account's wins) are kept here, and this device's that the
 * account lacks are sent up, a batch at a time. Nothing happens with nobody signed in.
 */
async function sync(): Promise<void> {
  if (syncing || !state.account) return;
  syncing = true;
  try {
    const have: HistoryKey[] = loadHistory(dayNumber(new Date())).map(
      (game) => [game.day, game.mode, game.total],
    );
    const heard = await swap({ have });
    if (!heard) return;
    for (const game of heard.games) {
      saveGame(dayKeyFor(game.day), game.mode, {
        total: game.total,
        turns: game.turns,
        ...(game.prompts && { prompts: game.prompts }),
      });
    }
    if (heard.games.length > 0) set({ synced: state.synced + 1 });
    for (let at = 0; at < heard.want.length; at += HISTORY_BATCH) {
      const give = heard.want
        .slice(at, at + HISTORY_BATCH)
        .flatMap(([day, mode]): HistoryGame[] => {
          const game = loadGame(dayKeyFor(day), mode);
          return game
            ? [
                {
                  day,
                  mode,
                  total: game.total,
                  turns: [...game.turns],
                  prompts: game.prompts ? [...game.prompts] : null,
                },
              ]
            : [];
        });
      if (give.length > 0 && !(await swap({ give }))) return;
    }
  } finally {
    syncing = false;
  }
}

/** A change to the account: the server's answer is who is signed in now. */
async function change(
  path: string,
  body: Record<string, unknown>,
): Promise<AccountResult> {
  const heard = await ask(path, body);
  if (failed(heard)) {
    // The device thought someone played here; the server says nobody does.
    if (heard.problem === "signed_out") {
      saveAccount(null);
      notePlayer(false);
      set({ account: null, player: null });
    }
    return heard;
  }
  if ("sent" in heard) return { ok: false, problem: "failed", detail: null };
  take(heard);
  return { ok: true };
}

export const accountStore = {
  subscribe(onChange: () => void): () => void {
    const first = listeners.size === 0;
    listeners.add(onChange);
    if (first) {
      // Read the device's note again whenever a page starts listening.
      const noted = loadAccount();
      if (
        noted?.email !== state.account?.email ||
        noted?.nickname !== state.account?.nickname
      ) {
        state = { ...state, account: noted };
        onChange();
      }
    }
    return () => {
      listeners.delete(onChange);
    };
  },
  read: (): AccountState => state,
  /** At build time nobody is signed in. */
  server: (): AccountState => NOBODY,

  /** Asks the server who is signed in on this device, and which ways of signing in there are. */
  async refresh(): Promise<void> {
    if (state.asked === "asking") return;
    set({ asked: "asking" });
    const heard = await ask("");
    if (failed(heard) || "sent" in heard) {
      // Not reached: what the device noted stands until the server can be asked.
      set({ asked: "failed" });
      return;
    }
    take(heard);
    await sync();
  },

  /**
   * Sends a sign-in link to an email address, with the bot check's token where the server
   * has a check.
   */
  async sendLink(
    email: string,
    check: string | null = null,
  ): Promise<AccountResult> {
    const heard = await ask("/link", {
      email,
      ...(check !== null && { check }),
    });
    if (failed(heard)) return heard;
    // So the page the link opens knows it was asked for from this browser.
    noteLinkAsked(Date.now());
    return { ok: true };
  },

  /** Uses a sign-in link's token: signs this device in. */
  async enter(token: string): Promise<AccountResult> {
    const done = await change("/enter", { token });
    if (done.ok) {
      forgetLinkAsked();
      await sync();
    }
    return done;
  },

  /**
   * Changes the player's nickname: an account's, a guest's, or (before a first game) the
   * name a new guest is made with, which needs the bot check's token where the server has
   * a check (./first-check.tsx).
   */
  rename: (
    nickname: string,
    check: string | null = null,
  ): Promise<AccountResult> =>
    change("/name", { nickname, ...(check !== null && { check }) }),

  /** Signs this device out. */
  leave: (): Promise<AccountResult> => change("/leave", {}),

  /**
   * Deletes the account (or the guest) and everything the server keeps for it. This device
   * keeps its own copy of the games, and its streak and stats.
   */
  remove: (): Promise<AccountResult> => change("/delete", {}),

  /** Swaps games with the account now (it is done each time the server is asked anyway). */
  sync,

  /**
   * Where the browser goes to sign in with Google: an address on this site, written from
   * its root so that it can be read while rendering (nothing here looks at the window).
   */
  googleUrl: (): string =>
    `${import.meta.env.BASE_URL || "/"}api/account/google`,
};

/** For the tests: as if the page had just been opened. */
export function resetAccountStore(): void {
  state = NOBODY;
  syncing = false;
  listeners.clear();
}
