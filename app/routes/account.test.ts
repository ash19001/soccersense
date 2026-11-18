// The page's account store (./account.ts) against the Worker's own code: only `fetch` is
// stood in for (worker/testing/site.ts), with a browser's cookie jar and a real SQLite.

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  ACCOUNT_KEY,
  LINK_ASKED_KEY,
  dayKeyFor,
  dayNumber,
  hasPlayer,
  loadAccount,
  loadGame,
  loadNickname,
  saveAccount,
  saveGame,
} from "~/game";
import { importGames } from "../../worker/games/store";
import { type TestSite, testSite } from "../../worker/testing/site";
import { accountStore, resetAccountStore } from "./account";
import { nicknameStore } from "./nickname";

let site: TestSite;
let heard: number;
let stop: () => void;

beforeEach(() => {
  window.localStorage.clear();
  resetAccountStore();
  site = testSite();
  vi.stubGlobal("fetch", site.fetch);
  heard = 0;
  stop = accountStore.subscribe(() => heard++);
});

afterEach(() => {
  stop();
  site.close();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe("a player with no account", () => {
  test("is nobody until the server is asked; before a first game it says nobody, and keeps nothing", async () => {
    expect(accountStore.read()).toEqual({
      account: null,
      player: null,
      signIn: null,
      asked: "no",
      synced: 0,
    });
    await accountStore.refresh();
    expect(accountStore.read()).toMatchObject({
      account: null,
      player: null,
      asked: "yes",
    });
    expect(site.cookies.size).toBe(0);
    expect(hasPlayer()).toBe(false);
  });

  test("once their first game has made them a player, the server gives their name, and it is the device's", async () => {
    await site.fetch("/api/games/home/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Row Z Rita" }),
    });
    expect(site.cookies.size).toBe(1);
    await accountStore.refresh();
    expect(accountStore.read()).toMatchObject({
      account: null,
      player: { nickname: "Row Z Rita" },
    });
    expect(hasPlayer()).toBe(true);
    expect(loadNickname()).toBe("Row Z Rita");
    // the history is an account's: none is swapped
    expect(site.calls).not.toContain("POST /api/account/history");
  });

  test("a name chosen before any game makes them a player with it", async () => {
    expect(await accountStore.rename("Nutmeg Nina")).toEqual({ ok: true });
    expect(accountStore.read().player).toEqual({ nickname: "Nutmeg Nina" });
    expect(accountStore.read().account).toBeNull();
    expect(loadNickname()).toBe("Nutmeg Nina");
    // and they can delete it all again
    expect(await accountStore.remove()).toEqual({ ok: true });
    expect(accountStore.read().player).toBeNull();
    expect(hasPlayer()).toBe(false);
    expect(site.cookies.size).toBe(0);
  });

  test("when they open the account's card the server says which ways in there are", async () => {
    await accountStore.refresh();
    expect(site.calls).toEqual(["GET /api/account"]);
    expect(accountStore.read()).toEqual({
      account: null,
      player: null,
      signIn: { email: true, google: false, check: null },
      asked: "yes",
      synced: 0,
    });
    // nothing is kept about them, here or there
    expect(window.localStorage.length).toBe(0);
    expect(site.cookies.size).toBe(0);
  });

  test("a server that cannot be reached is said so, and can be asked again", async () => {
    site.down = true;
    await accountStore.refresh();
    expect(accountStore.read().asked).toBe("failed");
    site.down = false;
    await accountStore.refresh();
    expect(accountStore.read().asked).toBe("yes");
  });
});

describe("signing in by an emailed link", () => {
  test("the link is asked for, and this browser notes that it asked", async () => {
    expect(await accountStore.sendLink("fan@example.com")).toEqual({
      ok: true,
    });
    expect(site.links).toHaveLength(1);
    expect(window.localStorage.getItem(LINK_ASKED_KEY)).not.toBeNull();
    // not signed in yet
    expect(accountStore.read().account).toBeNull();
    expect(site.cookies.size).toBe(0);
  });

  test("what the server will not send is said why", async () => {
    expect(await accountStore.sendLink("not an address")).toEqual({
      ok: false,
      problem: "bad_email",
      detail: null,
    });
    for (let i = 0; i < 3; i++) await accountStore.sendLink("fan@example.com");
    expect(await accountStore.sendLink("fan@example.com")).toMatchObject({
      ok: false,
      problem: "too_many",
    });
    site.down = true;
    expect(await accountStore.sendLink("other@example.com")).toMatchObject({
      ok: false,
      problem: "failed",
    });
  });

  test("using the link signs the device in: the note, the nickname and the cookie", async () => {
    await accountStore.sendLink("fan@example.com");
    const before = heard;
    expect(await accountStore.enter(site.lastToken())).toEqual({ ok: true });
    const fan = { nickname: "soccerfan1", email: "fan@example.com" };
    expect(accountStore.read()).toEqual({
      account: fan,
      player: { nickname: "soccerfan1" },
      signIn: { email: true, google: false, check: null },
      asked: "yes",
      synced: 0,
    });
    expect(heard).toBeGreaterThan(before);
    expect(loadAccount()).toEqual(fan);
    // the account's name is the player's nickname on this device from now on
    expect(loadNickname()).toBe("soccerfan1");
    expect(nicknameStore.read()).toBe("soccerfan1");
    expect([...site.cookies.keys()]).toEqual(["ss"]);
    // the note that a link was asked for has done its work
    expect(window.localStorage.getItem(LINK_ASKED_KEY)).toBeNull();
  });

  test("a link that has been used signs nobody in", async () => {
    await accountStore.sendLink("fan@example.com");
    const token = site.lastToken();
    await accountStore.enter(token);
    await accountStore.leave();
    expect(await accountStore.enter(token)).toEqual({
      ok: false,
      problem: "bad_link",
      detail: null,
    });
    expect(accountStore.read().account).toBeNull();
  });
});

describe("a device signed in", () => {
  beforeEach(async () => {
    await accountStore.sendLink("fan@example.com");
    await accountStore.enter(site.lastToken());
    site.calls.length = 0;
  });

  test("a page opened later reads the note, then asks the server", async () => {
    stop();
    resetAccountStore();
    stop = accountStore.subscribe(() => heard++);
    // known at once from the note, before any request
    expect(accountStore.read().account?.email).toBe("fan@example.com");
    expect(accountStore.read().asked).toBe("no");
    void accountStore.refresh();
    await vi.waitFor(() =>
      expect(site.calls).toEqual([
        "GET /api/account",
        "POST /api/account/history",
      ]),
    );
    expect(accountStore.read().asked).toBe("yes");
  });

  test("the nickname is changed on the server, and here once it has been", async () => {
    expect(await accountStore.rename("Nutmeg Nina")).toEqual({ ok: true });
    expect(accountStore.read().account?.nickname).toBe("Nutmeg Nina");
    expect(loadAccount()?.nickname).toBe("Nutmeg Nina");
    expect(nicknameStore.read()).toBe("Nutmeg Nina");
  });

  test("a name the server turns down is not taken here either, and says why", async () => {
    expect(await accountStore.rename("soccerfan77")).toEqual({
      ok: false,
      problem: "bad_name",
      detail: "reserved",
    });
    expect(await accountStore.rename("x")).toEqual({
      ok: false,
      problem: "bad_name",
      detail: "short",
    });
    expect(accountStore.read().account?.nickname).toBe("soccerfan1");
    expect(nicknameStore.read()).toBe("soccerfan1");
  });

  test("signing out: nobody here, no note, no cookie; the nickname stays", async () => {
    expect(await accountStore.leave()).toEqual({ ok: true });
    expect(accountStore.read().account).toBeNull();
    expect(window.localStorage.getItem(ACCOUNT_KEY)).toBeNull();
    expect(site.cookies.size).toBe(0);
    expect(loadNickname()).toBe("soccerfan1");
  });

  test("if the server no longer knows the device, the note goes", async () => {
    // signed out everywhere: the account's sessions are gone
    await site.env.DB.prepare("DELETE FROM sessions").run();
    await accountStore.refresh();
    expect(accountStore.read().account).toBeNull();
    expect(loadAccount()).toBeNull();
    // and a change asked for just before the page knew
    resetAccountStore();
    window.localStorage.setItem(
      ACCOUNT_KEY,
      JSON.stringify({ nickname: "soccerfan1", email: "fan@example.com" }),
    );
    stop = accountStore.subscribe(() => heard++);
    // the server knows nobody here: the name makes them a new player with no account
    expect(await accountStore.rename("Nutmeg Nina")).toEqual({ ok: true });
    expect(accountStore.read().account).toBeNull();
    expect(accountStore.read().player).toEqual({ nickname: "Nutmeg Nina" });
    expect(loadAccount()).toBeNull();
  });

  test("a server that cannot be reached leaves the note alone", async () => {
    site.down = true;
    await accountStore.refresh();
    expect(accountStore.read().asked).toBe("failed");
    expect(accountStore.read().account?.email).toBe("fan@example.com");
    expect(loadAccount()?.email).toBe("fan@example.com");
  });
});

test("the way to Google is an address on this site", () => {
  expect(accountStore.googleUrl()).toBe("/api/account/google");
});

describe("an account's games on this device", () => {
  const TODAY = dayNumber(new Date());
  const turns = (points: number) =>
    Array.from({ length: 7 }, (_, i) => ({
      questionId: `q${i}`,
      input: "x",
      answerId: "a",
      grade: "golazo" as const,
      points,
      km: null,
      share: null,
      rank: 2,
      msLeft: 1000,
    }));
  const accountId = async () =>
    (
      await site.env.DB.prepare("SELECT id FROM accounts").first<{
        id: string;
      }>()
    )?.id ?? "";
  const rows = async () =>
    (
      await site.env.DB.prepare(
        "SELECT day, mode, total, origin, prompts FROM games ORDER BY day, mode",
      ).all()
    ).results;

  test("signing in swaps them: the account's come here, this device's go there", async () => {
    // this device, before signing in
    saveGame(dayKeyFor(TODAY - 1), "away", {
      total: 210,
      turns: turns(30),
      prompts: Array.from({ length: 7 }, () => "Name a club"),
    });
    // the account, from another device
    await site.signIn("fan@example.com");
    await importGames(
      site.env.DB,
      await accountId(),
      [
        {
          day: TODAY - 2,
          mode: "home",
          total: 560,
          turns: turns(80),
          prompts: null,
        },
      ],
      Date.now(),
    );
    site.cookies.clear();

    await accountStore.sendLink("fan@example.com");
    expect(await accountStore.enter(site.lastToken())).toEqual({ ok: true });
    expect(loadGame(dayKeyFor(TODAY - 2), "home")?.total).toBe(560);
    expect(accountStore.read().synced).toBe(1);
    expect(await rows()).toEqual([
      {
        day: TODAY - 2,
        mode: "home",
        total: 560,
        origin: "device",
        prompts: null,
      },
      {
        day: TODAY - 1,
        mode: "away",
        total: 210,
        origin: "device",
        prompts: JSON.stringify(Array.from({ length: 7 }, () => "Name a club")),
      },
    ]);
  });

  test("the account's game wins over another of the same day and mode here", async () => {
    saveGame(dayKeyFor(TODAY), "home", { total: 70, turns: turns(10) });
    await site.signIn("fan@example.com");
    await importGames(
      site.env.DB,
      await accountId(),
      [
        {
          day: TODAY,
          mode: "home",
          total: 700,
          turns: turns(100),
          prompts: null,
        },
      ],
      Date.now(),
    );
    saveAccount({ nickname: "soccerfan1", email: "fan@example.com" });
    await accountStore.refresh();
    expect(loadGame(dayKeyFor(TODAY), "home")?.total).toBe(700);
    expect((await rows()).length).toBe(1);
  });

  test("once swapped, asking again sends nothing more", async () => {
    saveGame(dayKeyFor(TODAY), "retro", { total: 70, turns: turns(10) });
    await accountStore.sendLink("fan@example.com");
    await accountStore.enter(site.lastToken());
    site.calls.length = 0;
    await accountStore.refresh();
    expect(site.calls).toEqual([
      "GET /api/account",
      "POST /api/account/history",
    ]);
    expect(accountStore.read().synced).toBe(0);
  });

  test("nobody signed in: nothing is swapped", async () => {
    saveGame(dayKeyFor(TODAY), "retro", { total: 70, turns: turns(10) });
    await accountStore.refresh();
    expect(site.calls).toEqual(["GET /api/account"]);
  });

  test("a server that cannot be reached leaves this device's games alone", async () => {
    saveGame(dayKeyFor(TODAY), "retro", { total: 70, turns: turns(10) });
    await accountStore.sendLink("fan@example.com");
    await accountStore.enter(site.lastToken());
    site.down = true;
    await accountStore.sync();
    expect(loadGame(dayKeyFor(TODAY), "retro")?.total).toBe(70);
  });

  test("DELETE: the account goes, this device keeps its games and its name", async () => {
    saveGame(dayKeyFor(TODAY), "retro", { total: 70, turns: turns(10) });
    await accountStore.sendLink("fan@example.com");
    await accountStore.enter(site.lastToken());
    expect(await accountStore.remove()).toEqual({ ok: true });
    expect(accountStore.read().account).toBeNull();
    expect(loadAccount()).toBeNull();
    expect(site.cookies.size).toBe(0);
    expect(await rows()).toEqual([]);
    expect(loadGame(dayKeyFor(TODAY), "retro")?.total).toBe(70);
    expect(loadNickname()).toBe("soccerfan1");
  });
});

test("the bot check's token goes with a request for a link", async () => {
  await accountStore.sendLink("fan@example.com", "the-token");
  // the Worker here has no check: it takes the request either way
  expect(site.links).toHaveLength(1);
});
