// The bot check before a player's first game (the product owner, 2026-11-18: "yes add both
// protections"). The server makes a player it keeps (a guest: worker/accounts/api.ts) only
// for a first game, or a first change of name, that comes with a token Cloudflare's
// Turnstile says is good: a script cannot make players that count towards HOME's and AWAY's
// shares and stand on the leaderboards.
//
// A device the server does not know yet runs the check out of sight while the home screen
// or a mode page is up (`FirstGameCheck`): by the time a game starts there is a token
// waiting, so nobody waits for it. Turnstile mostly decides without asking anything; where
// it cannot tell, its widget asks for a click at the foot of the screen. A token works once
// and for five minutes; a fresh one is asked for after each is used. A device the server
// knows (a player, or a signed-in account) runs nothing, and a server with no check set up
// asks for none.
//
// Browser only. `firstCheck.take` is how a first game (./play/server.ts) and a first name
// (./home.tsx) get a token: it waits a while for one, and gives null where there is no
// check to pass, or none came. Without one the server still plays the game: it is kept on
// the device, as before, on no board and not counted.

import { useEffect, useSyncExternalStore } from "react";

import { hasPlayer, loadAccount } from "~/game";
import { BotCheck } from "~/ui/BotCheck";

import { accountStore } from "./account";

/** How long a first game waits for the check before it starts without it. */
export const FIRST_CHECK_WAIT_MS = 10_000;
/** Turnstile's tokens work for five minutes: one older than this is not handed out. */
export const FIRST_CHECK_TOKEN_MS = 270_000;

export interface FirstCheckState {
  /** Bumped when a token has been used: the widget asks for a fresh one. */
  round: number;
  /** Turnstile's script could not be loaded here (blocked, or offline). */
  unavailable: boolean;
}

let state: FirstCheckState = { round: 0, unavailable: false };
let token: { value: string; at: number } | null = null;
const listeners = new Set<() => void>();

function set(change: Partial<FirstCheckState>): void {
  state = { ...state, ...change };
  for (const listener of [...listeners]) listener();
}

/** Whether this device plays as a player the server keeps already: no check is needed. */
const known = (): boolean => {
  const { account, player } = accountStore.read();
  return account !== null || player !== null || hasPlayer() || !!loadAccount();
};

export const firstCheck = {
  subscribe(onChange: () => void): () => void {
    listeners.add(onChange);
    return () => {
      listeners.delete(onChange);
    };
  },
  read: (): FirstCheckState => state,
  server: (): FirstCheckState => ({ round: 0, unavailable: false }),

  /** The widget's token (the check passed), or null: none yet, or run out. */
  put(value: string | null): void {
    token = value === null ? null : { value, at: Date.now() };
    set({ unavailable: false });
  },

  /** The check cannot run here: whatever waits for a token stops waiting. */
  unavailable(): void {
    token = null;
    set({ unavailable: true });
  },

  /**
   * A token for a request that may make a player, used up as it is handed over; or null,
   * where no check is needed (the device is known, or the server has no check), the check
   * cannot run, or none came within `patience`.
   */
  take(patience = FIRST_CHECK_WAIT_MS): Promise<string | null> {
    return new Promise((resolve) => {
      let done = false;
      let timer: ReturnType<typeof setTimeout> | null = null;
      let stopAccount: () => void = () => {};
      const finish = (value: string | null) => {
        if (done) return;
        done = true;
        if (timer !== null) clearTimeout(timer);
        stopAccount();
        listeners.delete(look);
        if (value !== null) {
          token = null;
          set({ round: state.round + 1 });
        }
        resolve(value);
      };
      const look = () => {
        if (done) return;
        if (known()) return finish(null);
        const { asked, signIn } = accountStore.read();
        // Nobody asked the server (no check on this page), or it could not be reached, or
        // it has no check: there is nothing to pass.
        if (asked === "no" || asked === "failed") return finish(null);
        if (asked === "yes" && !signIn?.check) return finish(null);
        if (state.unavailable) return finish(null);
        if (token && Date.now() - token.at < FIRST_CHECK_TOKEN_MS) {
          finish(token.value);
        }
      };
      timer = setTimeout(() => finish(null), patience);
      listeners.add(look);
      stopAccount = accountStore.subscribe(look);
      look();
      // Answered while subscribing: nothing is left listening.
      if (done) stopAccount();
    });
  },
};

/** For the tests: as if the page had just been opened. */
export function resetFirstCheck(): void {
  state = { round: 0, unavailable: false };
  token = null;
  listeners.clear();
}

/**
 * Runs the check, out of sight, on a device the server does not know yet and where the
 * server has a check; nothing anywhere else. Where Turnstile has to ask, its widget shows
 * at the foot of the screen.
 */
export function FirstGameCheck() {
  const account = useSyncExternalStore(
    accountStore.subscribe,
    accountStore.read,
    accountStore.server,
  );
  const check = useSyncExternalStore(
    firstCheck.subscribe,
    firstCheck.read,
    firstCheck.server,
  );
  // A mode page opened directly: the server has not been asked whether it has a check.
  useEffect(() => {
    if (account.asked === "no" && !hasPlayer() && !loadAccount()) {
      void accountStore.refresh();
    }
  }, [account.asked]);

  const siteKey = account.signIn?.check ?? null;
  if (siteKey === null || account.player !== null || account.account !== null) {
    return null;
  }
  return (
    <div className="ss-first-check">
      <BotCheck
        siteKey={siteKey}
        round={check.round}
        onToken={firstCheck.put}
        onUnavailable={firstCheck.unavailable}
      />
    </div>
  );
}
