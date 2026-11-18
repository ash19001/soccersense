// The bot check before a first game (./first-check.tsx) against the Worker's own code:
// only `fetch` is stood in for (worker/testing/site.ts, where a token starting "pass-"
// passes Turnstile's check once), and Turnstile's widget, whose callbacks are called by
// hand.

import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { type Turnstile, resetTurnstileLoader } from "~/ui/BotCheck";
import { type TestSite, testSite } from "../../worker/testing/site";
import { accountStore, resetAccountStore } from "./account";
import {
  FIRST_CHECK_TOKEN_MS,
  FIRST_CHECK_WAIT_MS,
  FirstGameCheck,
  firstCheck,
  resetFirstCheck,
} from "./first-check";
import { gameServer } from "./play/server";

const KEYS = { TURNSTILE_SITE_KEY: "site-key", TURNSTILE_SECRET_KEY: "secret" };

let site: TestSite;
let opened = false;

function open(over: Parameters<typeof testSite>[0] = KEYS): void {
  if (opened) site.close();
  site = testSite(over);
  opened = true;
  vi.stubGlobal("fetch", site.fetch);
}

/** Turnstile as a page sees it: the widgets rendered, and their callbacks to call by hand. */
function fakeTurnstile() {
  const widgets: Record<string, unknown>[] = [];
  const turnstile: Turnstile & { resets: number } = {
    resets: 0,
    render: (_box, options) => {
      widgets.push(options);
      return `w${widgets.length}`;
    },
    reset: () => void turnstile.resets++,
    remove: () => {},
  };
  vi.stubGlobal("turnstile", turnstile);
  const pass = (token: string) =>
    act(() => (widgets.at(-1)?.callback as (t: string) => void)(token));
  return { turnstile, widgets, pass };
}

/** Shows the check as a page does, once the server has said whether it has one. */
async function showCheck() {
  const fake = fakeTurnstile();
  await accountStore.refresh();
  render(<FirstGameCheck />);
  await act(async () => {});
  return fake;
}

const accounts = async () =>
  (await site.env.DB.prepare("SELECT email, nickname FROM accounts").all())
    .results;

beforeEach(() => {
  window.localStorage.clear();
  resetAccountStore();
  resetFirstCheck();
  resetTurnstileLoader();
  open();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  if (opened) site.close();
  opened = false;
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe("no check to pass", () => {
  test("where nobody has asked the server, or it has no check: nothing, at once", async () => {
    expect(await firstCheck.take()).toBeNull();
    open({});
    await accountStore.refresh();
    expect(accountStore.read().signIn?.check).toBeNull();
    expect(await firstCheck.take()).toBeNull();
    render(<FirstGameCheck />);
    expect(document.querySelector(".ss-first-check")).toBeNull();
  });

  test("on a device the server knows: nothing, and no widget", async () => {
    await accountStore.refresh();
    expect(await accountStore.rename("Nutmeg Nina", "pass-0")).toEqual({
      ok: true,
    });
    expect(await firstCheck.take()).toBeNull();
    const { widgets } = fakeTurnstile();
    render(<FirstGameCheck />);
    await act(async () => {});
    expect(widgets).toEqual([]);
    // a page opened later knows it from the device's note, before asking anything
    resetAccountStore();
    expect(await firstCheck.take()).toBeNull();
  });
});

describe("with a check", () => {
  test("the widget runs out of sight, with the site key", async () => {
    const { widgets } = await showCheck();
    expect(widgets).toHaveLength(1);
    expect(widgets[0]).toMatchObject({
      sitekey: "site-key",
      appearance: "interaction-only",
    });
    expect(document.querySelector(".ss-first-check .ss-check")).not.toBeNull();
  });

  test("a first game waits for its token; each token is used once, and a fresh one asked for", async () => {
    const { pass, turnstile } = await showCheck();
    const waiting = firstCheck.take();
    pass("pass-1");
    expect(await waiting).toBe("pass-1");
    expect(turnstile.resets).toBe(1);

    vi.useFakeTimers();
    const next = firstCheck.take();
    await vi.advanceTimersByTimeAsync(FIRST_CHECK_WAIT_MS);
    // none came in time: the game starts without one
    expect(await next).toBeNull();
  });

  test("a token Turnstile no longer takes is not handed out", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const { pass } = await showCheck();
    pass("pass-1");
    vi.setSystemTime(Date.now() + FIRST_CHECK_TOKEN_MS);
    expect(await firstCheck.take(10)).toBeNull();
  });

  test("where the check cannot run here, nothing waits for it", async () => {
    await accountStore.refresh();
    firstCheck.unavailable();
    expect(await firstCheck.take()).toBeNull();
  });

  test("a first game with the token makes a player the server keeps", async () => {
    const { pass } = await showCheck();
    pass("pass-1");
    const reply = await gameServer().start("home");
    expect(reply.ticket).toBeNull();
    expect(site.cookies.size).toBe(1);
    expect(await accounts()).toEqual([{ email: null, nickname: "soccerfan1" }]);
  });

  test("without one, the game is still played, kept on the device", async () => {
    await accountStore.refresh();
    firstCheck.unavailable();
    const reply = await gameServer().start("home");
    expect(typeof reply.ticket).toBe("string");
    expect(site.cookies.size).toBe(0);
    expect(await accounts()).toEqual([]);
  });

  test("a first name needs it too", async () => {
    const { pass } = await showCheck();
    expect(await accountStore.rename("Nutmeg Nina")).toMatchObject({
      ok: false,
      problem: "bot_check",
    });
    pass("pass-2");
    const check = await firstCheck.take();
    expect(await accountStore.rename("Nutmeg Nina", check)).toEqual({
      ok: true,
    });
    expect(await accounts()).toEqual([
      { email: null, nickname: "Nutmeg Nina" },
    ]);
  });
});
