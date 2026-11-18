// @vitest-environment node
/**
 * Moderation (./moderation.ts) through the Worker's own `handle`, with a real SQLite: the
 * admin finds a player, gives them a new name, takes them off the leaderboards and puts
 * them back, or deletes their account. The players sign in and play as a browser does
 * (../testing/site.ts).
 */
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { HOME_QUESTIONS } from "~/data";
import type { BoardAnswer } from "~/game/board";
import type { GameSnapshot } from "~/game/served";
import type { Question } from "~/game/types";

import { handle } from "../app";
import { type TestSite, testSite } from "../testing/site";
import { MAX_FOUND, type PlayerView } from "./moderation";
import { rename } from "./store";

const TOKEN = "a-long-random-secret-for-the-tests-0123456789";

let site: TestSite;
beforeEach(() => {
  site = testSite({ ADMIN_TOKEN: TOKEN });
});
afterEach(() => site.close());

/** A request to the admin API, with the token unless told otherwise. */
function admin(
  path: string,
  init: { method?: string; body?: unknown; token?: string | null } = {},
): Promise<Response> {
  const headers: Record<string, string> = {};
  const token = init.token === undefined ? TOKEN : init.token;
  if (token !== null) headers.authorization = `Bearer ${token}`;
  return handle(
    new Request(`https://soccersense.example/api/admin${path}`, {
      method: init.method ?? "GET",
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    }),
    site.env,
    Date.now(),
  );
}

const find = async (q: string): Promise<PlayerView[]> =>
  (
    (await (await admin(`/players?q=${encodeURIComponent(q)}`)).json()) as {
      players: PlayerView[];
    }
  ).players;

const act = async (
  id: string,
  action: string,
  note?: string,
): Promise<PlayerView | null> => {
  const response = await admin(`/players/${id}`, {
    method: "POST",
    body: { action, ...(note === undefined ? {} : { note }) },
  });
  expect(response.status).toBe(200);
  return ((await response.json()) as { player: PlayerView | null }).player;
};

/** The id of the account with this address. */
const idOf = async (email: string): Promise<string> => {
  const [found] = await find(email);
  if (!found) throw new Error(`no account for ${email}`);
  return found.id;
};

const commonest = (q: Question) =>
  [...q.answers].sort((a, b) => b.popularity - a.popularity)[0];

/** Plays today's HOME game through, as the browser signed in now. */
async function playHome(): Promise<GameSnapshot> {
  const post = async (move: string, body: unknown) =>
    (
      (await (
        await site.fetch(`/api/games/home/${move}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        })
      ).json()) as { game: GameSnapshot }
    ).game;
  let game = await post("start", {});
  const day = game.day;
  for (let index = 0; index < HOME_QUESTIONS.length; index++) {
    game = await post("answer", {
      day,
      index,
      input: commonest(HOME_QUESTIONS[index]).name,
    });
    if (index < HOME_QUESTIONS.length - 1) {
      game = await post("next", { day, index });
    }
  }
  expect(game.turns).toHaveLength(HOME_QUESTIONS.length);
  return game;
}

/** Today's HOME board, as the browser signed in now sees it. */
const homeBoard = async () =>
  ((await (await site.fetch("/api/leaderboard")).json()) as BoardAnswer).modes
    .home;

/** Signs in as someone else. */
const as = async (email: string) => {
  site.cookies.clear();
  return site.signIn(email);
};

const answersCounted = async () =>
  (
    await site.env.DB.prepare(
      "SELECT COALESCE(SUM(players), 0) AS n FROM answer_tally",
    ).first<{ n: number }>()
  )?.n ?? 0;

describe("who may moderate", () => {
  test("only whoever holds the admin token", async () => {
    expect((await admin("/players", { token: null })).status).toBe(401);
    expect(
      (await admin("/players", { token: "not-it-at-all-0123456789" })).status,
    ).toBe(401);
    expect((await admin("/players")).status).toBe(200);
  });
});

describe("finding a player", () => {
  test("by any part of their name or address, in any capitals, or by id", async () => {
    await as("ana@example.com");
    await as("bo@example.org");
    await as("cy@example.com");
    const bo = await idOf("bo@example.org");
    await rename(site.env.DB, bo, "Row Z Rita", Date.now());

    expect((await find("row z")).map((p) => p.nickname)).toEqual([
      "Row Z Rita",
    ]);
    expect((await find("EXAMPLE.COM")).map((p) => p.email)).toEqual([
      "ana@example.com",
      "cy@example.com",
    ]);
    expect((await find(bo)).map((p) => p.email)).toEqual(["bo@example.org"]);
    // a % or _ stands for itself
    expect(await find("%")).toEqual([]);
    expect(await find("_")).toEqual([]);
  });

  test("with nothing given: the newest accounts, at most MAX_FOUND", async () => {
    await as("first@example.com");
    await as("second@example.com");
    const found = await find("");
    expect(found.map((p) => p.email)).toEqual([
      "second@example.com",
      "first@example.com",
    ]);
    expect(found.length).toBeLessThanOrEqual(MAX_FOUND);
    expect(found[0]).toMatchObject({
      bannedAt: null,
      note: "",
      games: 0,
      lastDay: null,
    });
  });
});

describe("a name that breaks the terms", () => {
  test("is replaced with a new soccerfan name", async () => {
    await as("fan@example.com");
    const id = await idOf("fan@example.com");
    await rename(site.env.DB, id, "Something Rude", Date.now());
    const player = await act(id, "rename");
    expect(player?.nickname).toMatch(/^soccerfan\d+$/);
    expect(player?.nickname).not.toBe("soccerfan1");
    // and the player sees it
    const me = (await (await site.fetch("/api/account")).json()) as {
      account: { nickname: string };
    };
    expect(me.account.nickname).toBe(player?.nickname);
  });
});

describe("off the leaderboards", () => {
  test("off every board and its counts; they still play, and see where they would have placed", async () => {
    await as("ana@example.com");
    await playHome();
    await as("bo@example.com");
    await playHome();
    expect((await homeBoard()).count).toBe(2);
    const bo = await idOf("bo@example.com");

    const player = await act(bo, "ban", "an offensive name");
    expect(player?.bannedAt).not.toBeNull();
    expect(player?.note).toBe("an offensive name");
    expect(player?.games).toBe(1);

    const board = await homeBoard();
    expect(board.count).toBe(1);
    expect(board.top).toHaveLength(1);
    expect(board.top[0].you).toBeUndefined();
    // told nothing of their own place: their page works out where they would have been
    expect(board.you).toBeNull();

    // taken off twice is taken off once
    await act(bo, "ban", "again");
    expect((await homeBoard()).count).toBe(1);
    expect((await find("bo@example.com"))[0].note).toBe("an offensive name");
  });

  test("a game they finish while off is not counted, nor are its answers", async () => {
    await as("bo@example.com");
    const bo = await idOf("bo@example.com");
    await act(bo, "ban", "bots");
    const game = await playHome();
    expect(game.phase).not.toBe("asking");
    expect((await homeBoard()).count).toBe(0);
    expect(await answersCounted()).toBe(0);
  });

  test("back on: with every game they played, those played while off too", async () => {
    await as("ana@example.com");
    await playHome();
    await as("bo@example.com");
    const bo = await idOf("bo@example.com");
    await act(bo, "ban", "checking");
    await playHome();
    expect((await homeBoard()).count).toBe(1);

    const player = await act(bo, "unban");
    expect(player).toMatchObject({ bannedAt: null, note: "" });
    const board = await homeBoard();
    expect(board.count).toBe(2);
    expect(board.you).not.toBeNull();
    expect(board.top.some((row) => row.you)).toBe(true);
    // put back twice is put back once
    await act(bo, "unban");
    expect((await homeBoard()).count).toBe(2);
  });
});

describe("deleting an account", () => {
  test("takes it and its games away, and its game off the board's counts", async () => {
    await as("ana@example.com");
    await playHome();
    await as("bo@example.com");
    await playHome();
    const bo = await idOf("bo@example.com");
    expect(await act(bo, "delete")).toBeNull();
    expect(await find("bo@example.com")).toEqual([]);
    site.cookies.clear();
    expect((await homeBoard()).count).toBe(1);
    // signed out where it was signed in
    await as("ana@example.com");
    expect((await homeBoard()).you).not.toBeNull();
  });

  test("of an account already off the boards: its game comes off the counts once", async () => {
    await as("ana@example.com");
    await playHome();
    await as("bo@example.com");
    await playHome();
    const bo = await idOf("bo@example.com");
    await act(bo, "ban", "first");
    await act(bo, "delete");
    site.cookies.clear();
    expect((await homeBoard()).count).toBe(1);
  });
});

describe("what the admin can send", () => {
  test("an action it knows, for an account there is", async () => {
    await as("fan@example.com");
    const id = await idOf("fan@example.com");
    const post = (path: string, body: unknown) =>
      admin(path, { method: "POST", body });
    expect((await post(`/players/${id}`, { action: "explode" })).status).toBe(
      400,
    );
    expect((await post(`/players/${id}`, {})).status).toBe(400);
    expect(
      (
        await post("/players/00000000-0000-0000-0000-000000000000", {
          action: "ban",
        })
      ).status,
    ).toBe(404);
    expect((await post("/players/not an id", { action: "ban" })).status).toBe(
      404,
    );
    expect((await admin(`/players/${id}`)).status).toBe(405);
    expect((await admin("/players", { method: "POST", body: {} })).status).toBe(
      405,
    );
  });
});
