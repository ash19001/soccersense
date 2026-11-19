// @vitest-environment node
/**
 * Accounts (worker/accounts), through the Worker's own `handle`, against a real SQLite in
 * memory. Each `Device` is a browser: it keeps the cookies it is handed and sends them
 * back. The email service and Google are stood in for by `outsideWorld`, so nothing here
 * leaves the machine.
 */
import { afterEach, describe, expect, test, vi } from "vitest";

import { HOME_QUESTIONS } from "~/data";
import type { AccountAnswer } from "~/game/account";
import type { BoardAnswer } from "~/game/board";
import { EPOCH_UTC, MS_PER_DAY } from "~/game/day";

import { handle } from "../app";
import { SCHEMA_VERSION } from "../db/migrate";
import type { Env, Outside } from "../env";
import type { GameAnswer } from "../games/play";
import { type MemoryD1, memoryD1 } from "../testing/d1";
import { LINKS_PER_EMAIL, fromThisSite } from "./api";
import { SITEVERIFY_URL } from "./check";
import { GOOGLE_AUTH_URL, GOOGLE_TOKEN_URL } from "./google";
import { DEFAULT_FROM, REPLY_TO, RESEND_URL } from "./mail";
import { checkAccountName } from "./names";
import { SESSION_LIFE_MS } from "./session";
import { LINK_LIFE_MS } from "./store";
import { hashOf, toBase64Url } from "./tokens";

/** Noon on the game's eighth day: 2026-11-17. */
const NOON = EPOCH_UTC + 7 * MS_PER_DAY + MS_PER_DAY / 2;
const SITE = "https://soccersense.example";
const CLIENT = "client-id.apps.googleusercontent.com";

const open: MemoryD1[] = [];
afterEach(() => {
  for (const db of open.splice(0)) db.close();
  vi.restoreAllMocks();
});

/** A Worker with everything set up, unless `over` says otherwise. */
function world(over: Omit<Partial<Env>, "DB"> = {}): Env & { DB: MemoryD1 } {
  const DB = memoryD1();
  open.push(DB);
  return {
    DB,
    ASSETS: { fetch: async () => new Response("the built site") },
    RESEND_API_KEY: "re_test_key",
    MAIL_FROM: "soccersense <signin@soccersense.example>",
    GOOGLE_CLIENT_ID: CLIENT,
    GOOGLE_CLIENT_SECRET: "google-secret",
    ...over,
  };
}

interface SentMail {
  to: string;
  from: string;
  subject: string;
  text: string;
  html: string;
  key: string | null;
  replyTo: unknown;
}

interface GooglePerson {
  sub: string;
  email: string;
  email_verified?: boolean | string;
  aud?: string;
  iss?: string;
  exp?: number;
}

/** Everything that is not this site: the email service and Google, as the tests need them. */
function outsideWorld() {
  const mails: SentMail[] = [];
  /** A one-time code Google has given out: who it is for, and the challenge it was asked with. */
  const codes = new Map<string, { person: GooglePerson; challenge: string }>();
  const state = { mailWorks: true, calls: [] as string[] };
  const outside: Outside = async (url, init) => {
    state.calls.push(url);
    if (url === RESEND_URL) {
      if (!state.mailWorks) return new Response("{}", { status: 429 });
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      mails.push({
        to: (body.to as string[])[0],
        from: body.from as string,
        subject: body.subject as string,
        text: body.text as string,
        html: body.html as string,
        key: new Headers(init.headers).get("authorization"),
        replyTo: body.reply_to,
      });
      return new Response(JSON.stringify({ id: "mail-1" }), { status: 200 });
    }
    if (url === GOOGLE_TOKEN_URL) {
      const form = new URLSearchParams(String(init.body));
      const known = codes.get(form.get("code") ?? "");
      codes.delete(form.get("code") ?? "");
      // Google checks the client's secret and that the verifier is the challenge's.
      if (
        !known ||
        form.get("client_secret") !== "google-secret" ||
        (await hashOf(form.get("code_verifier") ?? "")) !== known.challenge
      ) {
        return new Response('{"error":"invalid_grant"}', { status: 400 });
      }
      const claims = {
        iss: "https://accounts.google.com",
        aud: CLIENT,
        exp: Math.round(NOON / 1000) + 3600,
        email_verified: true,
        ...known.person,
      };
      const part = (value: unknown) =>
        toBase64Url(new TextEncoder().encode(JSON.stringify(value)));
      const idToken = `${part({ alg: "RS256" })}.${part(claims)}.signature`;
      return new Response(JSON.stringify({ id_token: idToken }), {
        status: 200,
      });
    }
    throw new Error(`a request to somewhere unexpected: ${url}`);
  };
  /** The token in the last sign-in email. */
  const lastToken = (): string => {
    const text = mails[mails.length - 1]?.text ?? "";
    return /#([A-Za-z0-9_-]+)/.exec(text)?.[1] ?? "";
  };
  return { outside, mails, codes, state, lastToken };
}

type World = ReturnType<typeof outsideWorld>;

interface Heard<T> {
  status: number;
  body: T;
  response: Response;
  /** The `Set-Cookie` lines of the answer. */
  set: string[];
}

/** One browser: it keeps its cookies. */
class Device {
  readonly cookies = new Map<string, string>();
  constructor(
    readonly env: Env,
    readonly out: World,
    readonly site = SITE,
  ) {}

  async ask<T = AccountAnswer>(
    path: string,
    now: number,
    init: { method?: string; body?: unknown; origin?: string | null } = {},
  ): Promise<Heard<T>> {
    const method = init.method ?? (init.body === undefined ? "GET" : "POST");
    const headers = new Headers();
    if (this.cookies.size > 0) {
      headers.set(
        "cookie",
        [...this.cookies].map(([name, value]) => `${name}=${value}`).join("; "),
      );
    }
    if (method === "POST") {
      headers.set("content-type", "application/json");
      // A browser says where a POST is from.
      const origin = init.origin === undefined ? this.site : init.origin;
      if (origin !== null) headers.set("origin", origin);
    }
    const response = await handle(
      new Request(`${this.site}${path}`, {
        method,
        headers,
        ...(method === "POST" && { body: JSON.stringify(init.body ?? {}) }),
      }),
      this.env,
      now,
      this.out.outside,
    );
    const set = response.headers.getSetCookie();
    for (const line of set) {
      const [pair, ...attributes] = line.split("; ");
      const at = pair.indexOf("=");
      const name = pair.slice(0, at);
      const value = pair.slice(at + 1);
      if (value === "" || attributes.includes("Max-Age=0")) {
        this.cookies.delete(name);
      } else {
        this.cookies.set(name, value);
      }
    }
    const text = await response.text();
    let body: unknown = null;
    try {
      body = JSON.parse(text);
    } catch {
      // a redirect, or nothing
    }
    return { status: response.status, body: body as T, response, set };
  }

  me = (now: number) => this.ask("/api/account", now);

  /** Asks for a link and uses it: the whole of signing in by email. */
  async signIn(email: string, now: number): Promise<Heard<AccountAnswer>> {
    const asked = await this.ask("/api/account/link", now, { body: { email } });
    expect(asked.status).toBe(200);
    return this.ask("/api/account/enter", now, {
      body: { token: this.out.lastToken() },
    });
  }

  /**
   * Signs in with Google as `person`: off to Google, the person picks their account there,
   * and back.
   */
  async google(person: GooglePerson, now: number): Promise<Heard<null>> {
    const off = await this.ask<null>("/api/account/google", now);
    expect(off.status).toBe(302);
    const there = new URL(off.response.headers.get("location") ?? "");
    const code = `code-${this.out.codes.size + 1}-${person.sub}`;
    this.out.codes.set(code, {
      person,
      challenge: there.searchParams.get("code_challenge") ?? "",
    });
    return this.ask<null>(
      `/api/account/google/callback?code=${code}&state=${there.searchParams.get("state")}`,
      now,
    );
  }
}

const rows = async <T = Record<string, unknown>>(db: MemoryD1, sql: string) =>
  (await db.prepare(sql).all<T>()).results;

const count = async (db: MemoryD1, table: string) =>
  (await rows<{ n: number }>(db, `SELECT COUNT(*) AS n FROM ${table}`))[0].n;

describe("a player with no account", () => {
  test("is nobody, is told which ways of signing in there are, and costs no database work", async () => {
    const env = world();
    const device = new Device(env, outsideWorld());
    const heard = await device.me(NOON);
    expect(heard.status).toBe(200);
    expect(heard.body).toEqual({
      account: null,
      player: null,
      signIn: { email: true, google: true, check: null },
    });
    expect(heard.set).toEqual([]);
    expect(env.DB.log).toEqual([]);
  });

  test("a way of signing in with no key is off", async () => {
    const env = world({
      RESEND_API_KEY: undefined,
      GOOGLE_CLIENT_SECRET: undefined,
    });
    const device = new Device(env, outsideWorld());
    expect((await device.me(NOON)).body.signIn).toEqual({
      email: false,
      google: false,
      check: null,
    });
    const asked = await device.ask("/api/account/link", NOON, {
      body: { email: "fan@example.com" },
    });
    expect(asked.status).toBe(503);
    expect(asked.body).toEqual({ error: "not_set_up" });
    const off = await device.ask<null>("/api/account/google", NOON);
    expect(off.status).toBe(302);
    expect(off.response.headers.get("location")).toBe("/enter#failed");
  });

  test("before their first game, nothing about them is kept", async () => {
    const env = world();
    const device = new Device(env, outsideWorld());
    await device.me(NOON);
    await device.ask("/api/leaderboard", NOON);
    expect(device.cookies.size).toBe(0);
    expect(await count(env.DB, "accounts")).toBe(0);
    expect(await count(env.DB, "sessions")).toBe(0);
  });
});

describe("a player with no account is kept by the server: a guest", () => {
  const start = (
    device: Device,
    now: number,
    body: Record<string, unknown> = {},
    mode = "home",
  ) => device.ask<GameAnswer>(`/api/games/${mode}/start`, now, { body });

  /** Plays today's HOME game through from its start, the best answer to each question. */
  async function playHome(device: Device, from: number): Promise<number> {
    let now = from;
    const started = await start(device, now);
    const day = started.body.game?.day;
    for (let index = 0; index < HOME_QUESTIONS.length; index++) {
      const best =
        HOME_QUESTIONS[index].answers.find((a) => a.shot === "worldie") ??
        HOME_QUESTIONS[index].answers[0];
      await device.ask<GameAnswer>("/api/games/home/answer", (now += 1000), {
        body: { day, index, input: best.name },
      });
      await device.ask<GameAnswer>("/api/games/home/next", (now += 1000), {
        body: { day, index },
      });
    }
    return now;
  }

  const accounts = (env: Env & { DB: MemoryD1 }) =>
    rows<{ id: string; email: string | null; nickname: string }>(
      env.DB,
      "SELECT id, email, nickname FROM accounts ORDER BY created_at, nickname",
    );

  test("their first game makes them one: a soccerfan name, a cookie for a year, the game kept", async () => {
    const env = world();
    const device = new Device(env, outsideWorld());
    const started = await start(device, NOON);
    expect(started.status).toBe(200);
    expect(started.body.ticket).toBeNull();
    expect(started.set).toHaveLength(1);
    expect(started.set[0]).toMatch(/^__Host-ss=[\w-]{43}; /);
    expect(started.set[0]).toContain(`Max-Age=${365 * 24 * 60 * 60}`);
    expect(started.set[0]).toContain("HttpOnly");
    const [guest] = await accounts(env);
    expect(guest).toMatchObject({ email: null, nickname: "soccerfan1" });
    expect(
      await rows(env.DB, "SELECT player_id, day, mode FROM games"),
    ).toEqual([{ player_id: guest.id, day: 8, mode: "home" }]);
    // the page is told their name, and that nobody is signed in
    expect((await device.me(NOON + 1)).body).toEqual({
      account: null,
      player: { nickname: "soccerfan1" },
      signIn: { email: true, google: true, check: null },
    });
    // a mode is played once a day: starting again is the same game
    const again = await start(device, NOON + 5000);
    expect(again.body.game?.startedAt).toBe(NOON);
    expect(again.set).toEqual([]);
    expect(await count(env.DB, "games")).toBe(1);
    expect(await count(env.DB, "accounts")).toBe(1);
  });

  test("the name their device has shown is theirs, where it is a fit one and free", async () => {
    const env = world();
    const nameOf = async (name: unknown) => {
      const device = new Device(env, outsideWorld());
      await start(device, NOON, { name });
      return (await device.me(NOON + 1)).body.player?.nickname;
    };
    expect(await nameOf("Row Z Rita")).toBe("Row Z Rita");
    // taken (in any capitals), made up on the device, unfit, or none: the next number
    expect(await nameOf("row z rita")).toBe("soccerfan1");
    expect(await nameOf("soccerfan4821")).toBe("soccerfan2");
    expect(await nameOf("hitler fan")).toBe("soccerfan3");
    expect(await nameOf(42)).toBe("soccerfan4");
  });

  test("a name chosen before a first game makes them one, with it; one taken or unfit makes nothing", async () => {
    const env = world();
    const first = new Device(env, outsideWorld());
    const named = await first.ask("/api/account/name", NOON, {
      body: { nickname: "  Nutmeg   Nina " },
    });
    expect(named.status).toBe(200);
    expect(named.body).toMatchObject({
      account: null,
      player: { nickname: "Nutmeg Nina" },
    });
    expect(named.set).toHaveLength(1);
    expect(await count(env.DB, "accounts")).toBe(1);

    const second = new Device(env, outsideWorld());
    const taken = await second.ask<{ error: string }>(
      "/api/account/name",
      NOON,
      { body: { nickname: "nutmeg nina" } },
    );
    expect(taken.status).toBe(409);
    expect(taken.body).toEqual({ error: "taken" });
    const unfit = await second.ask<{ error: string; problem: string }>(
      "/api/account/name",
      NOON,
      { body: { nickname: "soccerfan77" } },
    );
    expect(unfit.status).toBe(400);
    expect(unfit.body).toEqual({ error: "bad_name", problem: "reserved" });
    expect(second.cookies.size).toBe(0);
    expect(await count(env.DB, "accounts")).toBe(1);

    // and with a player made, the name is changed as an account's is
    const changed = await first.ask("/api/account/name", NOON + 1, {
      body: { nickname: "Keeper Kim" },
    });
    expect(changed.body.player?.nickname).toBe("Keeper Kim");
    expect(await count(env.DB, "accounts")).toBe(1);
  });

  test("they are on the leaderboard by their name, and told their own place", async () => {
    const env = world();
    const device = new Device(env, outsideWorld());
    await playHome(device, NOON);
    const board = (
      await device.ask<BoardAnswer>("/api/leaderboard", NOON + 60_000)
    ).body.modes.home;
    expect(board.count).toBe(1);
    expect(board.top).toEqual([
      { rank: 1, name: "soccerfan1", points: 700, you: true },
    ]);
    expect(board.you).toEqual({ rank: 1, points: 700 });
  });

  test("signing in with an address that has no account: the guest becomes it, name and games and all", async () => {
    const env = world();
    const device = new Device(env, outsideWorld());
    await start(device, NOON);
    await device.ask("/api/account/name", NOON + 1, {
      body: { nickname: "Keeper Kim" },
    });
    const [guest] = await accounts(env);
    const signed = await device.signIn("fan@example.com", NOON + 2);
    expect(signed.body).toMatchObject({
      account: { nickname: "Keeper Kim", email: "fan@example.com" },
      player: { nickname: "Keeper Kim" },
    });
    expect(await accounts(env)).toEqual([
      { id: guest.id, email: "fan@example.com", nickname: "Keeper Kim" },
    ]);
    expect(await rows(env.DB, "SELECT player_id FROM games")).toEqual([
      { player_id: guest.id },
    ]);
    // a new cookie, for an account's life; the guest's is gone
    expect(signed.set[0]).toContain(`Max-Age=${SESSION_LIFE_MS / 1000}`);
    expect(await count(env.DB, "sessions")).toBe(1);
  });

  test("signing in to an account there is: the guest's games come into it, but the account's own stand", async () => {
    const env = world();
    const out = outsideWorld();
    const mine = new Device(env, out);
    await mine.signIn("fan@example.com", NOON);
    await playHome(mine, NOON);
    const [account] = await accounts(env);

    const other = new Device(env, out);
    await playHome(other, NOON + 100_000);
    await start(other, NOON + 200_000, {}, "away");
    // two on today's HOME board: the account and the guest
    expect(
      (await other.ask<BoardAnswer>("/api/leaderboard", NOON + 200_001)).body
        .modes.home.count,
    ).toBe(2);

    const signed = await other.signIn("fan@example.com", NOON + 300_000);
    expect(signed.body.account?.email).toBe("fan@example.com");
    // the guest is gone, with its HOME game: the account had played HOME
    expect(await accounts(env)).toEqual([
      { id: account.id, email: "fan@example.com", nickname: "soccerfan1" },
    ]);
    expect(
      await rows(
        env.DB,
        "SELECT player_id, mode, created_at FROM games ORDER BY mode",
      ),
    ).toEqual([
      { player_id: account.id, mode: "away", created_at: NOON + 200_000 },
      { player_id: account.id, mode: "home", created_at: NOON },
    ]);
    const board = (
      await other.ask<BoardAnswer>("/api/leaderboard", NOON + 300_001)
    ).body.modes.home;
    expect(board.count).toBe(1);
    expect(board.you).toEqual({ rank: 1, points: 700 });
  });

  test("signing in with Google: the guest becomes the account too", async () => {
    const env = world();
    const out = outsideWorld();
    const device = new Device(env, out);
    await start(device, NOON);
    const [guest] = await accounts(env);
    const back = await device.google(
      { sub: "google-7", email: "kim@example.com", email_verified: true },
      NOON + 1,
    );
    expect(back.status).toBe(302);
    expect(
      await rows(env.DB, "SELECT id, email, google_id FROM accounts"),
    ).toEqual([
      { id: guest.id, email: "kim@example.com", google_id: "google-7" },
    ]);
  });

  test("their streak and stats are their device's own: nothing to swap", async () => {
    const env = world();
    const device = new Device(env, outsideWorld());
    await start(device, NOON);
    const heard = await device.ask("/api/account/history", NOON + 1, {
      body: { have: [[7, "home", 500]] },
    });
    expect(heard.status).toBe(200);
    expect(heard.body).toEqual({ games: [], want: [], saved: 0 });
  });

  test("they can delete everything the server keeps for them", async () => {
    const env = world();
    const device = new Device(env, outsideWorld());
    await playHome(device, NOON);
    const gone = await device.ask("/api/account/delete", NOON + 60_000, {
      body: {},
    });
    expect(gone.status).toBe(200);
    expect(gone.body).toMatchObject({ account: null, player: null });
    expect(device.cookies.size).toBe(0);
    for (const table of ["accounts", "games", "sessions", "board_tally"]) {
      expect(await count(env.DB, table), table).toBe(0);
    }
  });

  test("where this connection has made too many players just now, the game is the player's own", async () => {
    const env = world({
      NEW_PLAYER_LIMIT: { limit: async () => ({ success: false }) },
    });
    const device = new Device(env, outsideWorld());
    const started = await start(device, NOON);
    expect(started.status).toBe(200);
    expect(typeof started.body.ticket).toBe("string");
    expect(started.set).toEqual([]);
    expect(await count(env.DB, "accounts")).toBe(0);
    const named = await device.ask<{ error: string }>(
      "/api/account/name",
      NOON,
      { body: { nickname: "Nutmeg Nina" } },
    );
    expect(named.status).toBe(429);
    expect(named.body).toEqual({ error: "too_many" });
  });
});

describe("signing in by a link sent to an email address", () => {
  test("the link is emailed, and using it makes an account and signs the device in", async () => {
    const env = world();
    const out = outsideWorld();
    const device = new Device(env, out);

    const asked = await device.ask("/api/account/link", NOON, {
      body: { email: "  Fan@Example.com " },
    });
    expect(asked.status).toBe(200);
    expect(asked.body).toEqual({ sent: true });
    expect(asked.set).toEqual([]);

    // one email, to the address as tidied, from the configured sender, with the key
    expect(out.mails).toHaveLength(1);
    const [mail] = out.mails;
    expect(mail.to).toBe("fan@example.com");
    expect(mail.from).toBe("soccersense <signin@soccersense.example>");
    expect(mail.key).toBe("Bearer re_test_key");
    const token = out.lastToken();
    // the link opens the site's own page, with the token after the "#"
    expect(mail.text).toContain(`${SITE}/enter#${token}`);
    expect(mail.html).toContain(`${SITE}/enter#${token}`);
    expect(mail.text).toContain("15 minutes");
    // no account yet: asking for a link makes nothing but the link
    expect(await count(env.DB, "accounts")).toBe(0);

    const entered = await device.ask("/api/account/enter", NOON + 60_000, {
      body: { token },
    });
    expect(entered.status).toBe(200);
    expect(entered.body.account).toEqual({
      nickname: "soccerfan1",
      email: "fan@example.com",
    });
    // the cookie: this site only, not readable by scripts, HTTPS only, not sent cross-site
    expect(entered.set).toHaveLength(1);
    expect(entered.set[0]).toMatch(/^__Host-ss=[A-Za-z0-9_-]{43}; /);
    for (const attribute of ["Path=/", "HttpOnly", "Secure", "SameSite=Lax"]) {
      expect(entered.set[0].split("; ")).toContain(attribute);
    }
    expect(entered.set[0]).toContain(`Max-Age=${SESSION_LIFE_MS / 1000}`);

    expect((await device.me(NOON + 120_000)).body.account).toEqual({
      nickname: "soccerfan1",
      email: "fan@example.com",
    });
  });

  test("neither the link's token nor the cookie's is in the database", async () => {
    const env = world();
    const out = outsideWorld();
    const device = new Device(env, out);
    await device.signIn("fan@example.com", NOON);
    const linkToken = out.lastToken();
    const cookie = device.cookies.get("__Host-ss") ?? "";
    expect(cookie).toHaveLength(43);
    const everything = JSON.stringify([
      await rows(env.DB, "SELECT * FROM sign_in_links"),
      await rows(env.DB, "SELECT * FROM sessions"),
      await rows(env.DB, "SELECT * FROM accounts"),
    ]);
    expect(everything).not.toContain(linkToken);
    expect(everything).not.toContain(cookie);
    // their hashes are what is kept
    expect(everything).toContain(await hashOf(linkToken));
    expect(everything).toContain(await hashOf(cookie));
  });

  test("the next new account is the next soccerfan, and an address is one account", async () => {
    const env = world();
    const out = outsideWorld();
    const first = await new Device(env, out).signIn("one@example.com", NOON);
    const second = await new Device(env, out).signIn("two@example.com", NOON);
    expect(first.body.account?.nickname).toBe("soccerfan1");
    expect(second.body.account?.nickname).toBe("soccerfan2");
    // the first address again, on another device and in other capitals: the same account
    const again = await new Device(env, out).signIn(
      "ONE@example.com",
      NOON + 1000,
    );
    expect(again.body.account).toEqual({
      nickname: "soccerfan1",
      email: "one@example.com",
    });
    expect(await count(env.DB, "accounts")).toBe(2);
    expect(await count(env.DB, "sessions")).toBe(3);
  });

  test("a link works once, for 15 minutes, and only if it is ours", async () => {
    const env = world();
    const out = outsideWorld();
    const device = new Device(env, out);

    await device.ask("/api/account/link", NOON, {
      body: { email: "fan@example.com" },
    });
    const token = out.lastToken();
    const enter = (now: number, value: unknown = token) =>
      new Device(env, out).ask<{ error?: string }>("/api/account/enter", now, {
        body: { token: value },
      });

    // not ours: made up, the wrong shape, nothing
    for (const bad of ["x".repeat(43), "short", "", 7, null]) {
      const heard = await enter(NOON, bad);
      expect(heard.status).toBe(400);
      expect(heard.body).toEqual({ error: "bad_link" });
      expect(heard.set).toEqual([]);
    }
    // used once
    expect((await enter(NOON + 1000)).status).toBe(200);
    expect((await enter(NOON + 2000)).body).toEqual({ error: "bad_link" });

    // run out
    await device.ask("/api/account/link", NOON, {
      body: { email: "late@example.com" },
    });
    const late = out.lastToken();
    expect((await enter(NOON + LINK_LIFE_MS, late)).body).toEqual({
      error: "bad_link",
    });
    expect(await count(env.DB, "accounts")).toBe(1);
  });

  test("two requests with the same link at once sign in once", async () => {
    const env = world();
    const out = outsideWorld();
    await new Device(env, out).ask("/api/account/link", NOON, {
      body: { email: "fan@example.com" },
    });
    const token = out.lastToken();
    const heard = await Promise.all(
      [1, 2].map(() =>
        new Device(env, out).ask("/api/account/enter", NOON, {
          body: { token },
        }),
      ),
    );
    expect(heard.map((h) => h.status).sort()).toEqual([200, 400]);
    expect(await count(env.DB, "sessions")).toBe(1);
  });

  test("what is not an address is turned down, and nothing is sent", async () => {
    const env = world();
    const out = outsideWorld();
    const device = new Device(env, out);
    for (const email of [
      "",
      "fan",
      "fan@",
      "@example.com",
      "fan@example",
      "fan @example.com",
      "a@b@example.com",
      `${"x".repeat(250)}@example.com`,
      42,
      null,
    ]) {
      const heard = await device.ask<{ error: string }>(
        "/api/account/link",
        NOON,
        { body: { email } },
      );
      expect(heard.status).toBe(400);
      expect(heard.body).toEqual({ error: "bad_email" });
    }
    expect(out.mails).toEqual([]);
    // turned down before the database is touched
    expect(env.DB.log).toEqual([]);
  });

  test("an inbox cannot be filled from here: three links to an address, then a wait", async () => {
    const env = world();
    const out = outsideWorld();
    const device = new Device(env, out);
    const link = (email: string, now: number) =>
      device.ask<{ error?: string }>("/api/account/link", now, {
        body: { email },
      });
    for (let i = 0; i < LINKS_PER_EMAIL; i++) {
      expect((await link("fan@example.com", NOON + i)).status).toBe(200);
    }
    const fourth = await link("fan@example.com", NOON + 10);
    expect(fourth.status).toBe(429);
    expect(fourth.body).toEqual({ error: "too_many" });
    expect(out.mails).toHaveLength(LINKS_PER_EMAIL);
    // another address is not held up
    expect((await link("other@example.com", NOON + 20)).status).toBe(200);
    // and once the first links have run out, another can be sent
    expect(
      (await link("fan@example.com", NOON + LINK_LIFE_MS + 5)).status,
    ).toBe(200);
  });

  test("one connection asking over and over is stopped by Cloudflare's limit", async () => {
    const seen: string[] = [];
    const env = world({
      SIGN_IN_LIMIT: {
        limit: async ({ key }) => {
          seen.push(key);
          return { success: seen.length <= 2 };
        },
      },
    });
    const out = outsideWorld();
    const device = new Device(env, out);
    const statuses: number[] = [];
    for (const name of ["a", "b", "c"]) {
      const heard = await device.ask("/api/account/link", NOON, {
        body: { email: `${name}@example.com` },
      });
      statuses.push(heard.status);
    }
    expect(statuses).toEqual([200, 200, 429]);
    expect(out.mails).toHaveLength(2);
  });

  test("if the email cannot be sent the player is told, and the link is taken back", async () => {
    const env = world();
    const out = outsideWorld();
    out.state.mailWorks = false;
    const heard = await new Device(env, out).ask<{ error: string }>(
      "/api/account/link",
      NOON,
      { body: { email: "fan@example.com" } },
    );
    expect(heard.status).toBe(502);
    expect(heard.body).toEqual({ error: "failed" });
    expect(await count(env.DB, "sign_in_links")).toBe(0);
  });

  test("with no sender set, the email is from the default address", async () => {
    const env = world({ MAIL_FROM: undefined });
    const out = outsideWorld();
    await new Device(env, out).ask("/api/account/link", NOON, {
      body: { email: "fan@example.com" },
    });
    expect(out.mails[0].from).toBe(DEFAULT_FROM);
    // a reply goes to the game's own address
    expect(out.mails[0].replyTo).toBe(REPLY_TO);
    expect(REPLY_TO).toBe("info@soccersense.io");
  });

  test("on a developer's machine with no key, the link is written to the log", async () => {
    const env = world({ RESEND_API_KEY: undefined });
    const out = outsideWorld();
    const logged: string[] = [];
    vi.spyOn(console, "log").mockImplementation((line: string) => {
      logged.push(line);
    });
    // the page is the dev server's, on another port
    const device = new Device(env, out, "http://localhost:8787");
    expect((await device.me(NOON)).body.signIn.email).toBe(true);
    const asked = await device.ask("/api/account/link", NOON, {
      body: { email: "fan@example.com" },
      origin: "http://localhost:5173",
    });
    expect(asked.status).toBe(200);
    expect(out.mails).toEqual([]);
    const token = /http:\/\/localhost:5173\/enter#([A-Za-z0-9_-]{43})/.exec(
      logged.join("\n"),
    )?.[1];
    expect(token).toBeDefined();
    const entered = await device.ask("/api/account/enter", NOON, {
      body: { token },
      origin: "http://localhost:5173",
    });
    expect(entered.body.account?.nickname).toBe("soccerfan1");
    // over plain HTTP the cookie has the plain name and no Secure
    expect(entered.set[0]).toMatch(/^ss=/);
    expect(entered.set[0]).not.toContain("Secure");
    expect((await device.me(NOON)).body.account?.email).toBe("fan@example.com");
  });
});

describe("a device signed in", () => {
  test("signing out ends it, on that device only", async () => {
    const env = world();
    const out = outsideWorld();
    const phone = new Device(env, out);
    const laptop = new Device(env, out);
    await phone.signIn("fan@example.com", NOON);
    await laptop.signIn("fan@example.com", NOON + 1);

    const left = await phone.ask("/api/account/leave", NOON + 2, { body: {} });
    expect(left.status).toBe(200);
    expect(left.body.account).toBeNull();
    expect(left.set[0]).toMatch(/^__Host-ss=; .*Max-Age=0/);
    expect(phone.cookies.size).toBe(0);
    expect((await phone.me(NOON + 3)).body.account).toBeNull();
    expect((await laptop.me(NOON + 3)).body.account?.nickname).toBe(
      "soccerfan1",
    );
    expect(await count(env.DB, "sessions")).toBe(1);
  });

  test("stays signed in for 90 days from its last renewal, and is renewed past halfway", async () => {
    const env = world();
    const out = outsideWorld();
    const device = new Device(env, out);
    await device.signIn("fan@example.com", NOON);

    // before halfway: nothing is written, no new cookie
    const early = await device.me(NOON + 10 * MS_PER_DAY);
    expect(early.body.account?.nickname).toBe("soccerfan1");
    expect(early.set).toEqual([]);
    // past halfway: the same cookie again, with its full life from now
    const later = NOON + 50 * MS_PER_DAY;
    const renewed = await device.me(later);
    expect(renewed.set).toHaveLength(1);
    const [session] = await rows<{ expires_at: number }>(
      env.DB,
      "SELECT expires_at FROM sessions",
    );
    expect(session.expires_at).toBe(later + SESSION_LIFE_MS);
    // still in on day 130 (within 90 of the renewal), out once that has passed
    expect(
      (await device.me(NOON + 130 * MS_PER_DAY)).body.account,
    ).not.toBeNull();
    const far = NOON + 130 * MS_PER_DAY + SESSION_LIFE_MS + 1;
    const out2 = await device.me(far);
    expect(out2.body.account).toBeNull();
    expect(out2.set[0]).toContain("Max-Age=0");
  });

  test("a cookie that is not a session of ours is nobody, and is cleared", async () => {
    const env = world();
    const device = new Device(env, outsideWorld());
    for (const value of ["nonsense", "x".repeat(43)]) {
      device.cookies.set("__Host-ss", value);
      const heard = await device.me(NOON);
      expect(heard.body.account).toBeNull();
      expect(heard.set[0]).toContain("Max-Age=0");
      expect(device.cookies.size).toBe(0);
    }
  });

  test("signing in to another account on the same device ends the first session", async () => {
    const env = world();
    const out = outsideWorld();
    const device = new Device(env, out);
    await device.signIn("one@example.com", NOON);
    const second = await device.signIn("two@example.com", NOON + 1);
    expect(second.body.account?.email).toBe("two@example.com");
    expect(await count(env.DB, "sessions")).toBe(1);
  });

  test("their games are kept by the server, and are the same on every device", async () => {
    const env = world();
    const out = outsideWorld();
    const phone = new Device(env, out);
    const laptop = new Device(env, out);
    await phone.signIn("fan@example.com", NOON);
    await laptop.signIn("fan@example.com", NOON);

    const started = await phone.ask<GameAnswer>("/api/games/home/start", NOON, {
      body: {},
    });
    expect(started.status).toBe(200);
    // kept in the database, under the account: no ticket to keep
    expect(started.body.ticket).toBeNull();
    const [account] = await rows<{ id: string }>(
      env.DB,
      "SELECT id FROM accounts",
    );
    expect(
      await rows(env.DB, "SELECT player_id, day, mode FROM games"),
    ).toEqual([{ player_id: account.id, day: 8, mode: "home" }]);
    // the other device sees the same game, and cannot start a second
    const seen = await laptop.ask<GameAnswer>(
      "/api/games/home/look",
      NOON + 5,
      {
        body: {},
      },
    );
    expect(seen.body.game?.questions[0].prompt).toBe(
      started.body.game?.questions[0].prompt,
    );
    await laptop.ask<GameAnswer>("/api/games/home/start", NOON + 6, {
      body: {},
    });
    expect(await count(env.DB, "games")).toBe(1);

    // signed out, the same device is a new player with no account: its next game makes
    // it a guest, with a game of its own
    await phone.ask("/api/account/leave", NOON + 7, { body: {} });
    const fresh = await phone.ask<GameAnswer>(
      "/api/games/home/start",
      NOON + 8,
      {
        body: {},
      },
    );
    expect(fresh.body.ticket).toBeNull();
    expect(fresh.body.game?.startedAt).toBe(NOON + 8);
    expect(await count(env.DB, "games")).toBe(2);
    expect(await count(env.DB, "accounts")).toBe(2);
  });
});

describe("the nickname", () => {
  const signedIn = async () => {
    const env = world();
    const out = outsideWorld();
    const device = new Device(env, out);
    await device.signIn("fan@example.com", NOON);
    const rename = (nickname: unknown, now = NOON + 5) =>
      device.ask<AccountAnswer & { error?: string; problem?: string }>(
        "/api/account/name",
        now,
        { body: { nickname } },
      );
    return { env, out, device, rename };
  };

  test("can be changed, and is tidied as the page tidies it", async () => {
    const { device, rename } = await signedIn();
    const heard = await rename("  Nutmeg   Nina ");
    expect(heard.status).toBe(200);
    expect(heard.body.account?.nickname).toBe("Nutmeg Nina");
    expect((await device.me(NOON + 9)).body.account?.nickname).toBe(
      "Nutmeg Nina",
    );
  });

  test("no two accounts share one, whatever the capitals", async () => {
    const { env, out, rename } = await signedIn();
    expect((await rename("Nutmeg Nina")).status).toBe(200);
    const other = new Device(env, out);
    await other.signIn("other@example.com", NOON);
    const taken = await other.ask<{ error: string }>(
      "/api/account/name",
      NOON,
      {
        body: { nickname: "nutmeg NINA" },
      },
    );
    expect(taken.status).toBe(409);
    expect(taken.body).toEqual({ error: "taken" });
    expect((await other.me(NOON)).body.account?.nickname).toBe("soccerfan2");
    // the owner may change its capitals
    expect((await rename("NUTMEG NINA")).body.account?.nickname).toBe(
      "NUTMEG NINA",
    );
  });

  test("one that cannot be used says why", async () => {
    const { rename } = await signedIn();
    const cases: [unknown, string][] = [
      ["ab", "short"],
      ["a name far too long", "long"],
      ["nina!", "characters"],
      ["12345", "letter"],
      [null, "short"],
      // the counter's names: nobody may sit on the one the next player is due
      ["soccerfan2", "reserved"],
      ["SoccerFan999", "reserved"],
      ["Admin", "reserved"],
      ["adm1n", "reserved"],
      ["soccersense", "reserved"],
      ["Official Bob", "reserved"],
      ["Sh1t", "offensive"],
      ["xXfuckXx", "offensive"],
    ];
    for (const [nickname, problem] of cases) {
      const heard = await rename(nickname);
      expect([nickname, heard.status]).toEqual([nickname, 400]);
      expect(heard.body).toEqual({ error: "bad_name", problem });
    }
    // their own soccerfan name may always be kept
    expect((await rename("soccerfan1")).status).toBe(200);
  });

  test("innocent names with an unlucky word inside them are fine", () => {
    for (const name of [
      "ScunthorpeFan",
      "Therapist Tom",
      "Torpedo Ted",
      "Nazir 10",
      "Pakistan Zaid",
      "Swanky Sam",
      "Moderate Mo",
      "Supporter 12",
    ]) {
      expect([name, checkAccountName(name, "soccerfan1").ok]).toEqual([
        name,
        true,
      ]);
    }
  });

  test("with nobody playing here yet, a fit name makes them a player (a guest) with it", async () => {
    const env = world();
    const device = new Device(env, outsideWorld());
    const heard = await device.ask("/api/account/name", NOON, {
      body: { nickname: "Nutmeg Nina" },
    });
    expect(heard.status).toBe(200);
    expect(heard.body).toMatchObject({
      account: null,
      player: { nickname: "Nutmeg Nina" },
    });
  });
});

describe("signing in with Google", () => {
  test("off to Google with what it needs, and nothing more is asked for than the address", async () => {
    const env = world();
    const device = new Device(env, outsideWorld());
    const off = await device.ask<null>("/api/account/google", NOON);
    expect(off.status).toBe(302);
    const there = new URL(off.response.headers.get("location") ?? "");
    expect(there.origin + there.pathname).toBe(GOOGLE_AUTH_URL);
    expect(Object.fromEntries(there.searchParams)).toMatchObject({
      client_id: CLIENT,
      redirect_uri: `${SITE}/api/account/google/callback`,
      response_type: "code",
      scope: "openid email",
      code_challenge_method: "S256",
      prompt: "select_account",
    });
    // the browser carries the trip's two secrets in a short-lived cookie; the secret
    // of the client is not in the address
    expect(off.set[0]).toMatch(/^__Host-ss-google=[\w-]{43}\.[\w-]{43}; /);
    expect(off.set[0]).toContain("Max-Age=600");
    expect(there.href).not.toContain("google-secret");
    const [state, verifier] = (
      device.cookies.get("__Host-ss-google") ?? ""
    ).split(".");
    expect(there.searchParams.get("state")).toBe(state);
    expect(there.searchParams.get("code_challenge")).toBe(
      await hashOf(verifier),
    );
  });

  test("and back: a new person gets an account, the same person the same one", async () => {
    const env = world();
    const out = outsideWorld();
    const device = new Device(env, out);
    const back = await device.google(
      { sub: "google-1", email: "Fan@Gmail.com" },
      NOON,
    );
    expect(back.status).toBe(302);
    expect(back.response.headers.get("location")).toBe("/enter#google");
    // signed in, and the trip's cookie is gone
    expect([...device.cookies.keys()]).toEqual(["__Host-ss"]);
    expect((await device.me(NOON)).body.account).toEqual({
      nickname: "soccerfan1",
      email: "fan@gmail.com",
    });
    // again, on another device, with a changed address at Google: still the same account
    const other = new Device(env, out);
    await other.google({ sub: "google-1", email: "new@gmail.com" }, NOON + 5);
    expect((await other.me(NOON + 6)).body.account).toEqual({
      nickname: "soccerfan1",
      email: "fan@gmail.com",
    });
    expect(await count(env.DB, "accounts")).toBe(1);
  });

  test("an address is one account, whichever way it is reached first", async () => {
    const env = world();
    const out = outsideWorld();
    // by link first, then with Google
    const device = new Device(env, out);
    await device.signIn("fan@gmail.com", NOON);
    await device.ask("/api/account/name", NOON, {
      body: { nickname: "Nutmeg Nina" },
    });
    const other = new Device(env, out);
    await other.google({ sub: "google-7", email: "fan@gmail.com" }, NOON + 5);
    expect((await other.me(NOON + 6)).body.account?.nickname).toBe(
      "Nutmeg Nina",
    );
    expect(await rows(env.DB, "SELECT email, google_id FROM accounts")).toEqual(
      [{ email: "fan@gmail.com", google_id: "google-7" }],
    );

    // with Google first, then by link
    const third = new Device(env, out);
    await third.google({ sub: "google-8", email: "two@gmail.com" }, NOON + 7);
    const fourth = await new Device(env, out).signIn("two@gmail.com", NOON + 8);
    expect(fourth.body.account?.nickname).toBe("soccerfan2");
    expect(await count(env.DB, "accounts")).toBe(2);
  });

  test("the way back is refused unless it belongs to a trip this browser started", async () => {
    const env = world();
    const out = outsideWorld();
    const failed = (heard: Heard<null>) => {
      expect(heard.status).toBe(302);
      expect(heard.response.headers.get("location")).toBe("/enter#failed");
    };

    // no trip at all: someone was sent straight to the way back
    const cold = new Device(env, out);
    out.codes.set("stolen", {
      person: { sub: "google-1", email: "fan@gmail.com" },
      challenge: "",
    });
    failed(
      await cold.ask<null>(
        "/api/account/google/callback?code=stolen&state=anything",
        NOON,
      ),
    );

    // a trip, but another state
    const device = new Device(env, out);
    const off = await device.ask<null>("/api/account/google", NOON);
    const there = new URL(off.response.headers.get("location") ?? "");
    out.codes.set("mine", {
      person: { sub: "google-1", email: "fan@gmail.com" },
      challenge: there.searchParams.get("code_challenge") ?? "",
    });
    failed(
      await device.ask<null>(
        "/api/account/google/callback?code=mine&state=not-the-state",
        NOON,
      ),
    );
    // the person said no at Google: no code comes back
    const again = new Device(env, out);
    const off2 = await again.ask<null>("/api/account/google", NOON);
    const state = new URL(
      off2.response.headers.get("location") ?? "",
    ).searchParams.get("state");
    failed(
      await again.ask<null>(
        `/api/account/google/callback?error=access_denied&state=${state}`,
        NOON,
      ),
    );
    // nothing was asked of Google for any of them, and the database was not touched
    expect(out.state.calls).toEqual([]);
    expect(env.DB.log).toEqual([]);
  });

  test("what Google says is checked: ours, in date, and a verified address", async () => {
    const env = world();
    const out = outsideWorld();
    const people: GooglePerson[] = [
      { sub: "g", email: "fan@gmail.com", email_verified: false },
      { sub: "g", email: "fan@gmail.com", aud: "another-client" },
      { sub: "g", email: "fan@gmail.com", iss: "https://evil.example" },
      { sub: "g", email: "fan@gmail.com", exp: Math.round(NOON / 1000) - 1 },
      { sub: "", email: "fan@gmail.com" },
      { sub: "g", email: "not an address" },
    ];
    for (const person of people) {
      const back = await new Device(env, out).google(person, NOON);
      expect(back.response.headers.get("location")).toBe("/enter#failed");
    }
    expect(await count(env.DB, "accounts")).toBe(0);
    // and one that Google marks verified with a word, as it sometimes does
    const fine = await new Device(env, out).google(
      { sub: "g", email: "fan@gmail.com", email_verified: "true" },
      NOON,
    );
    expect(fine.response.headers.get("location")).toBe("/enter#google");
  });
});

describe("deleting an account", () => {
  test("takes everything kept for it, and signs every device out", async () => {
    const env = world();
    const out = outsideWorld();
    const phone = new Device(env, out);
    const laptop = new Device(env, out);
    await phone.signIn("fan@example.com", NOON);
    await laptop.signIn("fan@example.com", NOON);
    await phone.ask("/api/games/home/start", NOON, { body: {} });
    // someone else's account is left alone
    const other = new Device(env, out);
    await other.signIn("other@example.com", NOON);
    await other.ask("/api/games/away/start", NOON, { body: {} });

    const gone = await phone.ask("/api/account/delete", NOON + 5, { body: {} });
    expect(gone.status).toBe(200);
    expect(gone.body.account).toBeNull();
    expect(phone.cookies.size).toBe(0);
    expect((await laptop.me(NOON + 6)).body.account).toBeNull();

    expect(await rows(env.DB, "SELECT email FROM accounts")).toEqual([
      { email: "other@example.com" },
    ]);
    expect(await rows(env.DB, "SELECT mode FROM games")).toEqual([
      { mode: "away" },
    ]);
    expect(await count(env.DB, "sessions")).toBe(1);
    expect(
      await rows(env.DB, "SELECT DISTINCT email FROM sign_in_links"),
    ).toEqual([{ email: "other@example.com" }]);
    // the address can start again, as a new soccerfan
    const back = await new Device(env, out).signIn(
      "fan@example.com",
      NOON + 10,
    );
    expect(back.body.account?.nickname).toBe("soccerfan3");
  });
});

describe("another site's page", () => {
  test("cannot change anything here, signed in or not", async () => {
    const env = world();
    const out = outsideWorld();
    const device = new Device(env, out);
    await device.signIn("fan@example.com", NOON);
    for (const path of [
      "/api/account/leave",
      "/api/account/delete",
      "/api/account/name",
      "/api/account/enter",
      "/api/account/link",
      "/api/games/home/start",
    ]) {
      for (const origin of ["https://evil.example", "null"]) {
        const heard = await device.ask<{ error: string }>(path, NOON, {
          body: { nickname: "Hacked", email: "x@example.com" },
          origin,
        });
        expect([path, heard.status]).toEqual([path, 403]);
        expect(heard.body).toEqual({ error: "forbidden" });
      }
    }
    expect((await device.me(NOON)).body.account?.nickname).toBe("soccerfan1");
    expect(await count(env.DB, "games")).toBe(0);
  });

  test("what counts as this site", () => {
    const from = (url: string, origin: string | null) =>
      fromThisSite(
        new Request(url, {
          method: "POST",
          headers: origin === null ? {} : { origin },
        }),
      );
    expect(from(`${SITE}/api/x`, SITE)).toBe(true);
    expect(from(`${SITE}/api/x`, "https://evil.example")).toBe(false);
    expect(from(`${SITE}/api/x`, "http://soccersense.example.evil.io")).toBe(
      false,
    );
    expect(from(`${SITE}/api/x`, "null")).toBe(false);
    // not a page at all: a script, the drafting tool
    expect(from(`${SITE}/api/x`, null)).toBe(true);
    // a developer's machine: the pages are on another port, or a phone on the network
    expect(from("http://127.0.0.1:8787/api/x", "http://localhost:5173")).toBe(
      true,
    );
    expect(
      from("http://localhost:8787/api/x", "http://192.168.1.20:5174"),
    ).toBe(true);
  });
});

describe("the database", () => {
  test("has the accounts' tables", async () => {
    const env = world();
    await new Device(env, outsideWorld()).signIn("fan@example.com", NOON);
    expect(SCHEMA_VERSION).toBeGreaterThanOrEqual(4);
    const tables = (
      await rows<{ name: string }>(
        env.DB,
        "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
      )
    ).map((row) => row.name);
    for (const name of ["accounts", "sessions", "sign_in_links"]) {
      expect(tables).toContain(name);
    }
  });
});

describe("an account's games, swapped with its devices", () => {
  const TODAY = 8;
  const turns = (points: number) =>
    Array.from({ length: 7 }, (_, i) => ({
      questionId: `q${i}`,
      input: "x",
      answerId: "a",
      grade: "golazo",
      points,
      km: null,
      share: null,
      rank: 2,
      msLeft: 1000,
    }));
  const game = (day: number, mode: string, points = 80) => ({
    day,
    mode,
    total: points * 7,
    turns: turns(points),
    prompts: null,
  });
  interface Swap {
    games: { day: number; mode: string; total: number }[];
    want: [number, string][];
    saved: number;
  }
  const swap = (device: Device, body: unknown, now = NOON) =>
    device.ask<Swap>("/api/account/history", now, { body });
  const kept = (env: Env & { DB: MemoryD1 }) =>
    rows(
      env.DB,
      "SELECT day, mode, total, origin FROM games ORDER BY day, mode",
    );

  test("needs someone signed in", async () => {
    const env = world();
    const heard = await swap(new Device(env, outsideWorld()), { have: [] });
    expect(heard.status).toBe(401);
    expect(heard.body).toEqual({ error: "signed_out" });
  });

  test("a device's games the account lacks are wanted, then kept as the device's", async () => {
    const env = world();
    const device = new Device(env, outsideWorld());
    await device.signIn("fan@example.com", NOON);
    const first = await swap(device, {
      have: [
        [TODAY, "home", 560],
        [TODAY - 1, "away", 420],
      ],
    });
    expect(first.status).toBe(200);
    expect(first.body).toEqual({
      games: [],
      want: [
        [TODAY, "home"],
        [TODAY - 1, "away"],
      ],
      saved: 0,
    });
    const given = await swap(device, {
      give: [game(TODAY, "home"), game(TODAY - 1, "away", 60)],
    });
    expect(given.body).toEqual({ games: [], want: [], saved: 2 });
    expect(await kept(env)).toEqual([
      { day: TODAY - 1, mode: "away", total: 420, origin: "device" },
      { day: TODAY, mode: "home", total: 560, origin: "device" },
    ]);
    // asked again: nothing more either way
    const again = await swap(device, {
      have: [
        [TODAY, "home", 560],
        [TODAY - 1, "away", 420],
      ],
    });
    expect(again.body).toEqual({ games: [], want: [], saved: 0 });
  });

  test("another device is sent the account's games it lacks, and the account's win", async () => {
    const env = world();
    const out = outsideWorld();
    const phone = new Device(env, out);
    await phone.signIn("fan@example.com", NOON);
    await swap(phone, {
      give: [game(TODAY, "home"), game(TODAY - 3, "retro", 30)],
    });
    const laptop = new Device(env, out);
    await laptop.signIn("fan@example.com", NOON);
    // the laptop has its own HOME game today, with another total
    const heard = await swap(laptop, { have: [[TODAY, "home", 70]] });
    expect(heard.body.games.map((g) => [g.day, g.mode, g.total])).toEqual([
      [TODAY - 3, "retro", 210],
      [TODAY, "home", 560],
    ]);
    expect(heard.body.want).toEqual([]);
  });

  test("a game played through the server is the account's, and is sent with its questions", async () => {
    const env = world();
    const device = new Device(env, outsideWorld());
    await device.signIn("fan@example.com", NOON);
    await device.ask("/api/games/home/start", NOON, { body: {} });
    for (let index = 0; index < 7; index++) {
      const at = NOON + index * 60_000;
      await device.ask("/api/games/home/pass", at + 20_000, {
        body: { day: TODAY, index },
      });
      if (index < 6) {
        await device.ask("/api/games/home/next", at + 21_000, {
          body: { day: TODAY, index },
        });
      }
    }
    const heard = await swap(device, { have: [] }, NOON + 600_000);
    expect(heard.body.games).toHaveLength(1);
    const [played] = heard.body.games as unknown as {
      mode: string;
      total: number;
      prompts: string[];
    }[];
    expect(played.mode).toBe("home");
    expect(played.total).toBe(0);
    expect(played.prompts).toHaveLength(7);
    expect(played.prompts.every((prompt) => prompt.length > 10)).toBe(true);
    expect(await kept(env)).toEqual([
      { day: TODAY, mode: "home", total: 0, origin: "server" },
    ]);
  });

  test("a device's game of today is today's game for the account too: once a day", async () => {
    const env = world();
    const device = new Device(env, outsideWorld());
    await device.signIn("fan@example.com", NOON);
    await swap(device, { give: [game(TODAY, "home")] });
    const started = await device.ask<GameAnswer>(
      "/api/games/home/start",
      NOON,
      { body: {} },
    );
    expect(started.body.game?.phase).toBe("done");
    expect(started.body.game?.total).toBe(560);
  });

  test("only whole games of the last year are taken; anything else is left out", async () => {
    const env = world();
    const device = new Device(env, outsideWorld());
    await device.signIn("fan@example.com", NOON);
    const heard = await swap(device, {
      give: [
        game(TODAY + 1, "home"),
        game(TODAY - 400, "home"),
        { ...game(TODAY, "home"), total: 700 },
        { ...game(TODAY, "away"), turns: turns(80).slice(1) },
        { ...game(TODAY, "retro"), mode: "guesswho" },
        "a game",
        game(TODAY, "nextgen"),
      ],
      have: [[TODAY + 1, "home", 0], [TODAY, "nope", 0], "x"],
    });
    expect(heard.body).toEqual({
      games: [game(TODAY, "nextgen")],
      want: [],
      saved: 1,
    });
    expect(await kept(env)).toEqual([
      { day: TODAY, mode: "nextgen", total: 560, origin: "device" },
    ]);
  });

  test("deleting the account takes its games of either kind", async () => {
    const env = world();
    const device = new Device(env, outsideWorld());
    await device.signIn("fan@example.com", NOON);
    await swap(device, { give: [game(TODAY, "home")] });
    await device.ask("/api/games/away/start", NOON, { body: {} });
    expect((await kept(env)).length).toBe(2);
    await device.ask("/api/account/delete", NOON, { body: {} });
    expect(await kept(env)).toEqual([]);
  });
});

describe("the bot check on asking for a link (Turnstile)", () => {
  const KEYS = {
    TURNSTILE_SITE_KEY: "site-key",
    TURNSTILE_SECRET_KEY: "secret-key",
  };

  /** Turnstile's siteverify, as the tests need it: these tokens pass, once each. */
  function withTurnstile(good: string[]) {
    const out = outsideWorld();
    const asked: Record<string, unknown>[] = [];
    const left = new Set(good);
    const inner = out.outside;
    const outside: Outside = async (url, init) => {
      if (url !== SITEVERIFY_URL) return inner(url, init);
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      asked.push(body);
      const success =
        body.secret === "secret-key" && left.delete(String(body.response));
      return new Response(JSON.stringify({ success }), { status: 200 });
    };
    return { ...out, outside, asked };
  }

  const post = (body: unknown, headers: Record<string, string> = {}) =>
    new Request(`${SITE}/api/account/link`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: SITE, ...headers },
      body: JSON.stringify(body),
    });

  test("is off until both keys are there; then the page is told the site key", async () => {
    const off = await new Device(
      world({ TURNSTILE_SITE_KEY: "site-key" }),
      outsideWorld(),
    ).me(NOON);
    expect(off.body.signIn.check).toBeNull();
    const on = await new Device(world(KEYS), outsideWorld()).me(NOON);
    expect(on.body.signIn.check).toBe("site-key");
    // the secret is never sent to the page
    expect(JSON.stringify(on.body)).not.toContain("secret-key");
  });

  test("a link is sent only with a token Turnstile says is good, and each token works once", async () => {
    const env = world(KEYS);
    const out = withTurnstile(["good"]);
    const ask = async (check?: string) => {
      const response = await handle(
        post({ email: "fan@example.com", ...(check && { check }) }),
        env,
        NOON,
        out.outside,
      );
      return { status: response.status, body: await response.json() };
    };
    expect(await ask()).toEqual({ status: 403, body: { error: "bot_check" } });
    expect(await ask("made-up")).toEqual({
      status: 403,
      body: { error: "bot_check" },
    });
    expect((await ask("good")).status).toBe(200);
    // the same token again: spent
    expect(await ask("good")).toEqual({
      status: 403,
      body: { error: "bot_check" },
    });
    expect(out.mails).toHaveLength(1);
    // no token at all: Turnstile is not even asked
    expect(out.asked[0]).toEqual({ secret: "secret-key", response: "made-up" });
  });

  test("the connection's address goes to Turnstile where Cloudflare gives it", async () => {
    const env = world(KEYS);
    const out = withTurnstile(["good"]);
    await handle(
      post(
        { email: "fan@example.com", check: "good" },
        { "cf-connecting-ip": "203.0.113.7" },
      ),
      env,
      NOON,
      out.outside,
    );
    expect(out.asked[0]).toEqual({
      secret: "secret-key",
      response: "good",
      remoteip: "203.0.113.7",
    });
    expect(out.mails).toHaveLength(1);
  });

  test("Turnstile not answering is a no", async () => {
    const env = world(KEYS);
    const out = outsideWorld();
    const outside: Outside = async (url, init) =>
      url === SITEVERIFY_URL
        ? new Response("down", { status: 500 })
        : out.outside(url, init);
    const heard = await handle(
      post({ email: "fan@example.com", check: "good" }),
      env,
      NOON,
      outside,
    );
    expect(heard.status).toBe(403);
    expect(out.mails).toEqual([]);
  });
});

describe("the bot check before a first game (Turnstile)", () => {
  const KEYS = {
    TURNSTILE_SITE_KEY: "site-key",
    TURNSTILE_SECRET_KEY: "secret-key",
  };

  /** Turnstile's siteverify: these tokens pass, once each. */
  function withTurnstile(good: string[]) {
    const out = outsideWorld();
    const left = new Set(good);
    const asked: string[] = [];
    const inner = out.outside;
    const outside: Outside = async (url, init) => {
      if (url !== SITEVERIFY_URL) return inner(url, init);
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      asked.push(String(body.response));
      const success =
        body.secret === "secret-key" && left.delete(String(body.response));
      return new Response(JSON.stringify({ success }), { status: 200 });
    };
    return { ...out, outside, asked };
  }

  const start = (device: Device, body: Record<string, unknown>) =>
    device.ask<GameAnswer>("/api/games/home/start", NOON, { body });

  test("a first game makes a player only with a token that passes; without, it is the player's own", async () => {
    const env = world(KEYS);
    const out = withTurnstile(["good-1"]);
    for (const body of [{}, { check: "made-up" }]) {
      const device = new Device(env, out);
      const started = await start(device, body);
      expect(started.status).toBe(200);
      // still a game: kept on the device, on no board, not counted
      expect(typeof started.body.ticket).toBe("string");
      expect(started.set).toEqual([]);
    }
    expect(await count(env.DB, "accounts")).toBe(0);

    const device = new Device(env, out);
    const started = await start(device, { check: "good-1" });
    expect(started.body.ticket).toBeNull();
    expect(started.set).toHaveLength(1);
    expect(await count(env.DB, "accounts")).toBe(1);
    expect(out.asked).toEqual(["made-up", "good-1"]);
    // a token works once
    const again = await start(new Device(env, out), { check: "good-1" });
    expect(typeof again.body.ticket).toBe("string");
    expect(await count(env.DB, "accounts")).toBe(1);
    // and a player already made is not asked again
    await device.ask("/api/games/home/look", NOON + 1, { body: {} });
    expect(out.asked).toEqual(["made-up", "good-1", "good-1"]);
  });

  test("a name chosen before a first game needs it too", async () => {
    const env = world(KEYS);
    const out = withTurnstile(["good-2"]);
    const device = new Device(env, out);
    const refused = await device.ask<{ error: string }>(
      "/api/account/name",
      NOON,
      { body: { nickname: "Nutmeg Nina" } },
    );
    expect(refused.status).toBe(403);
    expect(refused.body).toEqual({ error: "bot_check" });
    expect(await count(env.DB, "accounts")).toBe(0);
    const named = await device.ask("/api/account/name", NOON, {
      body: { nickname: "Nutmeg Nina", check: "good-2" },
    });
    expect(named.status).toBe(200);
    expect(named.body.player).toEqual({ nickname: "Nutmeg Nina" });
    // a player already made changes their name with no check
    const changed = await device.ask("/api/account/name", NOON + 1, {
      body: { nickname: "Keeper Kim" },
    });
    expect(changed.body.player).toEqual({ nickname: "Keeper Kim" });
  });
});
