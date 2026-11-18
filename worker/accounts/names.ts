/**
 * What an account's nickname may be, beyond the shape every nickname has (`checkNickname`
 * in ~/game/nickname, the same rule the page applies as it is typed).
 *
 * An account's name is shown to other players on the leaderboards, so the server also
 * turns down:
 * - `soccerfan` and a number, unless it is the account's own: those are handed out by the
 *   counter, and nobody may sit on the name the next player is due;
 * - a name that passes itself off as the game or the people who run it;
 * - a name with one of a short list of slurs and swear words in it. The list is a first
 *   net, not a moderation system. The worst are caught anywhere in a name; the ones that
 *   also hide inside innocent words (a therapist, a torpedo, Scunthorpe United) only as a
 *   word of their own. Digits are read as the letters they stand in for.
 *
 * Whether the name is free is the database's to say (./store.ts, `rename`).
 */

import {
  type NicknameProblem,
  checkNickname,
  isFanNickname,
  nicknameKey,
} from "~/game/nickname";

/** Why the server will not take a name: its shape, or what it says. */
export type NameProblem = NicknameProblem | "reserved" | "offensive";

export type NameCheck =
  { ok: true; name: string } | { ok: false; problem: NameProblem };

/** The game's own name: not in anyone's, anywhere. */
const GAME = "soccersense";

/** Names for the people who run a game: not as a name, or as a word of one. */
const STAFF = [
  "admin",
  "administrator",
  "mod",
  "moderator",
  "official",
  "support",
  "staff",
  "system",
];

/** Turned down anywhere in a name. */
const ANYWHERE = [
  "fuck",
  "nigger",
  "nigga",
  "faggot",
  "hitler",
  "bitch",
  "whore",
  "cunt",
  "wanker",
];

/** Turned down as a word of their own: they are inside innocent words too. */
const WORDS = [
  "shit",
  "twat",
  "wank",
  "paki",
  "nazi",
  "pedo",
  "paedo",
  "rapist",
  "slut",
  "retard",
  "spastic",
  "bastard",
];

/** Innocent words that have one of `ANYWHERE` inside them. */
const INNOCENT = /scunthorpe|snigger/g;

const LOOKALIKES: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "8": "b",
};

/**
 * A name's words two ways: as written (digits part the words: "admin99" is "admin"), and
 * with its digits read as letters ("adm1n" is "admin").
 */
function readings(name: string): string[][] {
  const key = nicknameKey(name);
  const spelled = key.replace(/[0-9]/g, (digit) => LOOKALIKES[digit] ?? " ");
  return [key, spelled].map((text) =>
    text.split(/[^a-z]+/).filter((word) => word !== ""),
  );
}

/**
 * A nickname for an account, tidied and checked. `own` is the account's name now: it may
 * always be kept, whatever it is.
 */
export function checkAccountName(text: unknown, own: string): NameCheck {
  const checked = checkNickname(typeof text === "string" ? text : "");
  if (!checked.ok) return checked;
  const { name } = checked;
  if (nicknameKey(name) === nicknameKey(own)) return { ok: true, name };
  if (isFanNickname(name)) return { ok: false, problem: "reserved" };
  for (const words of readings(name)) {
    const joined = words.join("");
    if (
      joined.includes(GAME) ||
      STAFF.includes(joined) ||
      words.some((word) => STAFF.includes(word))
    ) {
      return { ok: false, problem: "reserved" };
    }
    const scanned = joined.replace(INNOCENT, " ");
    if (
      ANYWHERE.some((word) => scanned.includes(word)) ||
      WORDS.includes(joined) ||
      words.some(
        (word) =>
          WORDS.includes(word) || WORDS.includes(word.replace(/s$/, "")),
      )
    ) {
      return { ok: false, problem: "offensive" };
    }
  }
  return { ok: true, name };
}
