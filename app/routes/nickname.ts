// The player's nickname, for the pages: `soccerfan` and a random four-digit number on the
// first visit (`fanNickname`), kept on the device (`~/game/nickname`), and changed from the
// leaderboard's CHANGE link. One store for the page, for `useSyncExternalStore`: nothing
// is read until React subscribes, which is after mounting. Browser only.

import {
  type NicknameCheck,
  checkNickname,
  ensureNickname,
  fanNickname,
  fanNumber,
  saveNickname,
} from "~/game";

/** A first nickname: `soccerfan` and a random four-digit number ("soccerfan4821"). */
export function freshNickname(): string {
  return fanNickname(fanNumber(Math.random()));
}

let current: string | null = null;
const listeners = new Set<() => void>();

function tell(): void {
  for (const listener of [...listeners]) listener();
}

export const nicknameStore = {
  subscribe(onChange: () => void): () => void {
    const first = listeners.size === 0;
    listeners.add(onChange);
    if (first) {
      // Read again whenever a page starts listening. The first visit makes one up and keeps
      // it; a device that cannot keep it has the same one for the rest of the visit.
      const name = ensureNickname(() => current ?? freshNickname());
      if (name !== current) {
        current = name;
        onChange();
      }
    }
    return () => {
      listeners.delete(onChange);
    };
  },
  /** The nickname, or null before the page has subscribed (and at build time). */
  read: (): string | null => current,
  /** At build time there is no nickname. */
  server: (): string | null => null,
  /**
   * The name of the account this device is signed in to (./account.ts): the server has
   * checked it, so it is the player's nickname from now on, here as well.
   */
  adopt(name: string): void {
    saveNickname(name);
    if (current !== name) {
      current = name;
      tell();
    }
  },
  /**
   * Change the nickname. Returns the check: when it is fine, the tidied name is the
   * player's from now on (kept on the device where it can be; for this visit anyway).
   */
  save(text: string): NicknameCheck {
    const checked = checkNickname(text);
    if (!checked.ok) return checked;
    saveNickname(checked.name);
    if (current !== checked.name) {
      current = checked.name;
      tell();
    }
    return checked;
  },
};
