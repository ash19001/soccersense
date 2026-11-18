// The page a sign-in link opens, and where a trip to Google ends (./enter.tsx), against
// the Worker's own code: only `fetch` is stood in for (worker/testing/site.ts).

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { createRoutesStub } from "react-router";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { loadAccount } from "~/game";
import { strings } from "~/i18n";
import { resetArrivalFocus } from "~/ui/useArrivalFocus";
import { type TestSite, testSite } from "../../worker/testing/site";
import { accountStore, resetAccountStore } from "./account";
import Enter, { meta } from "./enter";

const text = strings.enter;
const FAN = "fan@example.com";

let site: TestSite;

function page(hash: string, strict = false): void {
  window.history.replaceState(null, "", `/enter${hash}`);
  const Stub = createRoutesStub([
    { path: "/", Component: () => <h1>the menu</h1> },
    { path: "/enter", Component: Enter },
  ]);
  const stub = <Stub initialEntries={["/enter"]} />;
  render(strict ? <StrictMode>{stub}</StrictMode> : stub);
}

/** Lets the page's requests be answered. */
async function settle(): Promise<void> {
  await act(async () => {
    for (let turn = 0; turn < 200; turn++) {
      await new Promise<void>((done) => setTimeout(done, 0));
      if (site.pending === 0 && turn > 3) break;
    }
  });
}

const entered = () =>
  site.calls.filter((call) => call === "POST /api/account/enter").length;

beforeEach(() => {
  resetArrivalFocus();
  window.localStorage.clear();
  resetAccountStore();
  site = testSite();
  vi.stubGlobal("fetch", site.fetch);
});

afterEach(() => {
  cleanup();
  site.close();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  window.history.replaceState(null, "", "/");
});

describe("a sign-in link", () => {
  test("opened in the browser that asked for it signs in at once", async () => {
    await accountStore.sendLink(FAN);
    const token = site.lastToken();
    page(`#${token}`);
    await settle();
    expect(entered()).toBe(1);
    expect(screen.getByText(text.done(FAN))).toBeInTheDocument();
    expect(screen.getByText(text.playingAs("soccerfan1"))).toBeInTheDocument();
    // the way on is the menu
    expect(screen.getByRole("link", { name: text.play })).toHaveAttribute(
      "href",
      "/",
    );
    // signed in: the cookie, and the device's note
    expect([...site.cookies.keys()]).toEqual(["ss"]);
    expect(loadAccount()).toEqual({ nickname: "soccerfan1", email: FAN });
    // the token is out of the address bar
    expect(window.location.hash).toBe("");
    expect(window.location.pathname).toBe("/enter");
  });

  test("in strict mode, where effects run twice, it is still used once", async () => {
    await accountStore.sendLink(FAN);
    page(`#${site.lastToken()}`, true);
    await settle();
    expect(entered()).toBe(1);
    expect(screen.getByText(text.done(FAN))).toBeInTheDocument();
  });

  test("opened anywhere else asks for a press first: a mail scanner uses nothing up", async () => {
    // asked for from another browser: this one has no note of it
    await site.fetch("http://localhost:3000/api/account/link", {
      method: "POST",
      body: JSON.stringify({ email: FAN }),
    });
    const token = site.lastToken();
    page(`#${token}`);
    await settle();
    expect(entered()).toBe(0);
    expect(screen.getByText(text.confirm)).toBeInTheDocument();
    expect(window.location.hash).toBe("");
    expect(site.cookies.size).toBe(0);

    fireEvent.click(screen.getByRole("button", { name: text.go }));
    await settle();
    expect(entered()).toBe(1);
    expect(screen.getByText(text.done(FAN))).toBeInTheDocument();
    expect(loadAccount()?.email).toBe(FAN);
  });

  test("that has been used says so, and offers the way back", async () => {
    await accountStore.sendLink(FAN);
    const token = site.lastToken();
    await accountStore.enter(token);
    await accountStore.leave();
    // asked for again from here, so the page tries at once
    await accountStore.sendLink("other@example.com");
    page(`#${token}`);
    await settle();
    expect(screen.getByText(text.failed)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: text.home })).toHaveAttribute(
      "href",
      "/",
    );
    expect(loadAccount()).toBeNull();
  });

  test("that is not a link of ours is not sent anywhere", async () => {
    page("#not-a-token");
    await settle();
    expect(site.calls).toEqual([]);
    expect(screen.getByText(text.failed)).toBeInTheDocument();
    expect(window.location.hash).toBe("");
  });
});

describe("back from Google", () => {
  test("signed in: the page asks who as, and says", async () => {
    // the Worker signed this browser in on the way back (the cookie is set)
    await site.signIn(FAN);
    site.calls.length = 0;
    page("#google");
    await settle();
    expect(site.calls).toEqual([
      "GET /api/account",
      "POST /api/account/history",
    ]);
    expect(screen.getByText(text.done(FAN))).toBeInTheDocument();
    expect(loadAccount()?.email).toBe(FAN);
  });

  test("not signed in: it says Google did not sign them in", async () => {
    page("#google");
    await settle();
    expect(screen.getByText(text.googleFailed)).toBeInTheDocument();
    expect(loadAccount()).toBeNull();
  });

  test("turned back at the server: the same, with no request", async () => {
    page("#failed");
    await settle();
    expect(site.calls).toEqual([]);
    expect(screen.getByText(text.googleFailed)).toBeInTheDocument();
  });
});

describe("the page itself", () => {
  test("with nothing after the address, says there is nothing to sign in with", async () => {
    page("");
    await settle();
    expect(site.calls).toEqual([]);
    expect(screen.getByText(text.nothing)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: text.heading }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: text.back })).toHaveAttribute(
      "href",
      "/",
    );
  });

  test("is built ahead of time without reading the address, and asks not to be indexed", () => {
    window.history.replaceState(null, "", "/enter#secret-token");
    const Stub = createRoutesStub([{ path: "/enter", Component: Enter }]);
    const html = renderToString(<Stub initialEntries={["/enter"]} />);
    expect(html).toContain(text.heading);
    expect(html).toContain(text.working);
    expect(html).not.toContain("secret-token");
    const tags = meta({} as Parameters<typeof meta>[0]) ?? [];
    expect(tags).toContainEqual({ name: "robots", content: "noindex" });
    expect(tags).toContainEqual({
      title: `${text.title} · ${strings.siteName}`,
    });
  });
});
