/**
 * A game kept by its player, not by the server.
 *
 * A player with no account has nothing stored about them (the product owner, 2026-11-17:
 * "for no account users everything is stored on localstorage. the database is only used to
 * check the question and answer but not actually store anything"). So the server hands the
 * game back after every move as a ticket: the game as it stands (./state.ts), with the
 * server's seal on it. The page keeps the ticket on the device and sends it with its next
 * move; the server checks the seal, plays the move, and seals the result.
 *
 * The seal (HMAC-SHA256) means a ticket cannot be made up or changed: every answer in it
 * was judged by the server, and its clock is the server's. What a seal cannot do is make
 * the server remember. A ticket already used can be sent again, so a question can be
 * answered twice by someone who goes out of their way to; the result is only ever kept on
 * their own device. A game that has to be beyond that (an account's, for a leaderboard)
 * is kept in the database instead (./store.ts).
 *
 * The key is made by the Worker the first time it is needed and kept in the database
 * (`secrets`, migration 3), so there is nothing to set up. Each instance reads it once.
 */

import { isTurn } from "~/game/storage";
import type { Mode } from "~/game/types";

import type { D1 } from "../env";
import { QUESTION_MODES } from "../questions/store";
import type { GameState } from "./state";

const KEY_NAME = "game-ticket-key";
const VERSION = "t1";
/** The longest ticket read: a finished game's is about 3,000 characters. */
export const MAX_TICKET = 12_000;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) return null;
  try {
    const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

const keys = new WeakMap<D1, Promise<CryptoKey>>();

async function readKey(db: D1, now: number): Promise<CryptoKey> {
  const stored = () =>
    db
      .prepare("SELECT value FROM secrets WHERE name = ?")
      .bind(KEY_NAME)
      .first<{ value: string }>();
  let found = await stored();
  if (!found) {
    // The first instance to need it makes it; one that loses the race reads the winner's.
    const fresh = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
    await db
      .prepare(
        "INSERT OR IGNORE INTO secrets (name, value, created_at) VALUES (?, ?, ?)",
      )
      .bind(KEY_NAME, fresh, Math.round(now))
      .run();
    found = await stored();
  }
  const raw = found ? fromBase64Url(found.value) : null;
  if (!raw || raw.length < 32) throw new Error("the ticket key cannot be read");
  return crypto.subtle.importKey(
    "raw",
    raw,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

/** The key tickets are sealed with: read once by each instance, then remembered. */
export function ticketKey(db: D1, now: number): Promise<CryptoKey> {
  let known = keys.get(db);
  if (!known) {
    known = readKey(db, now);
    keys.set(db, known);
    known.catch(() => keys.delete(db));
  }
  return known;
}

/** The game, sealed: what the page keeps and sends back. */
export async function seal(key: CryptoKey, state: GameState): Promise<string> {
  const body = toBase64Url(encoder.encode(JSON.stringify(state)));
  const mark = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(`${VERSION}.${body}`)),
  );
  return `${VERSION}.${body}.${toBase64Url(mark)}`;
}

const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const isWhole = (value: unknown): value is number =>
  isNumber(value) && Number.isInteger(value);

/** Whether what was sealed is a game: the seal is ours, so this guards against our own slips. */
function isState(value: unknown): value is GameState {
  if (typeof value !== "object" || value === null) return false;
  const s = value as Record<string, unknown>;
  return (
    isWhole(s.day) &&
    s.day >= 1 &&
    QUESTION_MODES.includes(s.mode as Mode) &&
    (s.source === "sample" || s.source === "scheduled") &&
    isWhole(s.index) &&
    s.index >= 0 &&
    (s.phase === "asking" || s.phase === "reveal" || s.phase === "done") &&
    Array.isArray(s.turns) &&
    s.turns.every(isTurn) &&
    isWhole(s.total) &&
    isNumber(s.startedAt) &&
    (s.deadline === null || isNumber(s.deadline)) &&
    isNumber(s.createdAt) &&
    isNumber(s.updatedAt) &&
    (s.finishedAt === null || isNumber(s.finishedAt))
  );
}

/**
 * The game in a ticket, or null for anything that is not a ticket this server sealed:
 * made up, changed, cut short, or too long to be one.
 */
export async function unseal(
  key: CryptoKey,
  ticket: unknown,
): Promise<GameState | null> {
  if (typeof ticket !== "string" || ticket.length > MAX_TICKET) return null;
  const [version, body, mark, ...rest] = ticket.split(".");
  if (version !== VERSION || !body || !mark || rest.length > 0) return null;
  const given = fromBase64Url(mark);
  const bytes = fromBase64Url(body);
  if (!given || !bytes) return null;
  const ours = await crypto.subtle.verify(
    "HMAC",
    key,
    given,
    encoder.encode(`${VERSION}.${body}`),
  );
  if (!ours) return null;
  try {
    const state: unknown = JSON.parse(decoder.decode(bytes));
    return isState(state) ? state : null;
  } catch {
    return null;
  }
}
