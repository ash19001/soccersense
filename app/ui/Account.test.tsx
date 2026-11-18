import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, test, vi } from "vitest";

import { strings } from "~/i18n";

import { Account, type AccountProps, CHECK_PATIENCE_MS } from "./Account";
import { type Turnstile, resetTurnstileLoader } from "./BotCheck";

const LABELS = strings.account;
const FAN = { nickname: "soccerfan12", email: "fan@example.com" };
const BOTH = { email: true, google: true, check: null };

const routed = (node: ReactNode) => <MemoryRouter>{node}</MemoryRouter>;

function props(over: Partial<AccountProps> = {}): AccountProps {
  return {
    labels: LABELS,
    open: true,
    name: "soccerfan4821",
    account: null,
    ways: BOTH,
    status: "ready",
    googleHref: "/api/account/google",
    termsHref: "/terms",
    privacyHref: "/privacy",
    onChangeName: vi.fn(),
    onSend: vi.fn<AccountProps["onSend"]>().mockResolvedValue(null),
    onLeave: vi.fn<AccountProps["onLeave"]>().mockResolvedValue(null),
    onDelete: vi.fn<AccountProps["onDelete"]>().mockResolvedValue(null),
    onRetry: vi.fn(),
    onClose: vi.fn(),
    ...over,
  };
}

function card(over: Partial<AccountProps> = {}) {
  const given = props(over);
  const view = render(routed(<Account {...given} />));
  return {
    ...given,
    rerender: (more: Partial<AccountProps>) =>
      view.rerender(routed(<Account {...given} {...more} />)),
  };
}

const field = (): HTMLInputElement =>
  screen.getByRole("textbox", { name: LABELS.email });

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  resetTurnstileLoader();
});

describe("Account, with nobody signed in", () => {
  test("is the sign-in card, which signs up too, with both ways in", () => {
    card();
    expect(
      screen.getByRole("dialog", { name: LABELS.heading }),
    ).toHaveAccessibleDescription(LABELS.intro);
    expect(field()).toHaveAttribute("type", "email");
    expect(field()).toHaveAttribute("autocomplete", "email");
    expect(field()).toHaveAccessibleDescription(LABELS.emailNote);
    expect(screen.getByRole("button", { name: LABELS.send })).toBeEnabled();
    // Google is a page load, not a request: a link to this site's own address
    const google = screen.getByRole("link", { name: LABELS.google });
    expect(google).toHaveAttribute("href", "/api/account/google");
    expect(google).not.toHaveAttribute("target");
  });

  test("shows the player's name, and CHANGE brings the name's card", () => {
    const { onChangeName } = card();
    expect(screen.getByText("soccerfan4821")).toBeInTheDocument();
    const change = screen.getByRole("button", {
      name: LABELS.changeSpoken("soccerfan4821"),
    });
    expect(change).toHaveTextContent(LABELS.change);
    expect(change).toHaveAttribute("aria-haspopup", "dialog");
    fireEvent.click(change);
    expect(onChangeName).toHaveBeenCalledTimes(1);
  });

  test("links the terms and the privacy notice at its foot", () => {
    card();
    expect(screen.getByRole("link", { name: LABELS.terms })).toHaveAttribute(
      "href",
      "/terms",
    );
    expect(screen.getByRole("link", { name: LABELS.privacy })).toHaveAttribute(
      "href",
      "/privacy",
    );
  });

  test("only the ways that are switched on are offered", () => {
    const { rerender } = card({
      ways: { email: true, google: false, check: null },
    });
    expect(screen.queryByRole("link", { name: LABELS.google })).toBeNull();
    expect(field()).toBeInTheDocument();
    rerender({ ways: { email: false, google: true, check: null } });
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByRole("link", { name: LABELS.google })).toBeVisible();
  });

  test("with neither switched on it says so, and offers no way in", () => {
    card({ ways: { email: false, google: false, check: null } });
    expect(screen.getByText(LABELS.none)).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("link", { name: LABELS.google })).toBeNull();
  });

  test("EMAIL ME A LINK sends the address, waits, then says where the link went", async () => {
    let answer: (problem: string | null) => void = () => {};
    const onSend = vi.fn(
      () => new Promise<string | null>((done) => (answer = done)),
    );
    card({ onSend });
    fireEvent.change(field(), { target: { value: " fan@example.com " } });
    fireEvent.submit(field().closest("form") as HTMLFormElement);
    // no bot check here: no token
    expect(onSend).toHaveBeenCalledWith("fan@example.com", null);
    // waiting: once only
    expect(screen.getByRole("button", { name: LABELS.sending })).toBeDisabled();
    fireEvent.submit(field().closest("form") as HTMLFormElement);
    expect(onSend).toHaveBeenCalledTimes(1);
    await act(async () => answer(null));
    expect(screen.getByRole("status")).toHaveTextContent(
      LABELS.sent("fan@example.com"),
    );
    expect(screen.getByText(LABELS.sentNote)).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
    // and back to the field for another address
    fireEvent.click(screen.getByRole("button", { name: LABELS.another }));
    expect(field()).toBeInTheDocument();
  });

  test("an address that is turned down says why, and the card stays as it was", async () => {
    const onSend = vi
      .fn<AccountProps["onSend"]>()
      .mockResolvedValue(LABELS.problems.bad_email);
    card({ onSend });
    fireEvent.change(field(), { target: { value: "nope" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: LABELS.send }));
    });
    expect(screen.getByText(LABELS.problems.bad_email)).toBeInTheDocument();
    expect(field()).toHaveAttribute("aria-invalid", "true");
    expect(field()).toHaveValue("nope");
    // typing again takes the words away
    fireEvent.change(field(), { target: { value: "nope@" } });
    expect(screen.queryByText(LABELS.problems.bad_email)).toBeNull();
  });

  test("a request that falls over says the game cannot be reached", async () => {
    const onSend = vi
      .fn<AccountProps["onSend"]>()
      .mockRejectedValue(new Error("offline"));
    card({ onSend });
    fireEvent.change(field(), { target: { value: "fan@example.com" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: LABELS.send }));
    });
    expect(screen.getByText(LABELS.unreachable)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: LABELS.send })).toBeEnabled();
  });

  test("while the server is being asked it says so; unreachable, it offers to ask again", () => {
    const { onRetry, rerender } = card({ ways: null, status: "asking" });
    expect(screen.getByRole("status")).toHaveTextContent(LABELS.checking);
    expect(screen.queryByRole("textbox")).toBeNull();
    rerender({ ways: null, status: "failed" });
    expect(screen.getByRole("alert")).toHaveTextContent(LABELS.unreachable);
    fireEvent.click(screen.getByRole("button", { name: LABELS.retry }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe("the bot check, where the server has one", () => {
  const CHECKED = { email: true, google: false, check: "site-key" };

  /** Turnstile as a page sees it: the widget's callbacks, to call by hand. */
  function fakeTurnstile() {
    const widgets: Record<string, unknown>[] = [];
    const turnstile: Turnstile & { resets: number; removed: number } = {
      resets: 0,
      removed: 0,
      render: (_box, options) => {
        widgets.push(options);
        return `w${widgets.length}`;
      },
      reset: () => void turnstile.resets++,
      remove: () => void turnstile.removed++,
    };
    vi.stubGlobal("turnstile", turnstile);
    const pass = (token: string) =>
      act(() => (widgets.at(-1)?.callback as (t: string) => void)(token));
    return { turnstile, widgets, pass };
  }

  test("is shown with the site key, decided mostly out of sight, and its token goes with the address", async () => {
    const { widgets, pass, turnstile } = fakeTurnstile();
    const { onSend } = card({ ways: CHECKED });
    await act(async () => {});
    expect(widgets).toHaveLength(1);
    expect(widgets[0]).toMatchObject({
      sitekey: "site-key",
      appearance: "interaction-only",
    });
    pass("token-1");
    fireEvent.change(field(), { target: { value: "fan@example.com" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: LABELS.send }));
    });
    expect(onSend).toHaveBeenCalledWith("fan@example.com", "token-1");
    // the link has gone: the form, and the widget with it
    expect(turnstile.removed).toBe(1);
  });

  test("a token works once: after a send that failed, a fresh one is asked for", async () => {
    const { pass, turnstile } = fakeTurnstile();
    const onSend = vi
      .fn<AccountProps["onSend"]>()
      .mockResolvedValue(LABELS.problems.too_many);
    card({ ways: CHECKED, onSend });
    await act(async () => {});
    pass("token-1");
    fireEvent.change(field(), { target: { value: "fan@example.com" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: LABELS.send }));
    });
    expect(screen.getByText(LABELS.problems.too_many)).toBeInTheDocument();
    expect(turnstile.resets).toBe(1);
    // and the next press waits for it
    fireEvent.click(screen.getByRole("button", { name: LABELS.send }));
    expect(onSend).toHaveBeenCalledTimes(1);
    await act(async () => pass("token-2"));
    expect(onSend).toHaveBeenLastCalledWith("fan@example.com", "token-2");
  });

  test("a press before the check has decided waits for it, then sends", async () => {
    const { pass } = fakeTurnstile();
    const { onSend } = card({ ways: CHECKED });
    await act(async () => {});
    fireEvent.change(field(), { target: { value: "fan@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: LABELS.send }));
    expect(onSend).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: LABELS.checkWaiting }),
    ).toBeDisabled();
    await act(async () => pass("token-2"));
    expect(onSend).toHaveBeenCalledWith("fan@example.com", "token-2");
  });

  test("a check that never decides gives up and says so", async () => {
    vi.useFakeTimers();
    fakeTurnstile();
    const { onSend } = card({ ways: CHECKED });
    await act(async () => {});
    fireEvent.change(field(), { target: { value: "fan@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: LABELS.send }));
    await act(async () => {
      vi.advanceTimersByTime(CHECK_PATIENCE_MS);
    });
    expect(onSend).not.toHaveBeenCalled();
    expect(screen.getByText(LABELS.checkFailed)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: LABELS.send })).toBeEnabled();
  });

  test("a check whose script cannot load says so", async () => {
    // no Turnstile on the page, and its script fails to load
    const append = vi
      .spyOn(document.head, "append")
      .mockImplementation((...nodes) => {
        for (const node of nodes) {
          if (node instanceof HTMLScriptElement) {
            queueMicrotask(() => node.onerror?.(new Event("error")));
          }
        }
      });
    card({ ways: CHECKED });
    await act(async () => {});
    expect(append).toHaveBeenCalled();
    const script = append.mock.calls[0][0] as HTMLScriptElement;
    expect(script.src).toBe(
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit",
    );
    expect(screen.getByText(LABELS.checkFailed)).toBeInTheDocument();
    append.mockRestore();
  });

  test("closing the card takes the widget away", async () => {
    const { turnstile, widgets } = fakeTurnstile();
    const { rerender } = card({ ways: CHECKED });
    await act(async () => {});
    expect(widgets).toHaveLength(1);
    rerender({ open: false });
    expect(turnstile.removed).toBe(1);
  });
});

describe("Account, with someone signed in", () => {
  test("says who, the name they play under with CHANGE, SIGN OUT and DELETE ACCOUNT", () => {
    card({ account: FAN });
    expect(
      screen.getByRole("dialog", { name: LABELS.headingIn }),
    ).toHaveAccessibleDescription(LABELS.introIn);
    expect(screen.getByText(FAN.email)).toBeInTheDocument();
    expect(screen.getByText(FAN.nickname)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: LABELS.changeSpoken(FAN.nickname) }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("link", { name: LABELS.google })).toBeNull();
    expect(screen.getByRole("button", { name: LABELS.leave })).toBeEnabled();
    expect(screen.getByRole("button", { name: LABELS.remove })).toBeEnabled();
  });

  test("SIGN OUT waits for the server, once", async () => {
    let answer: (problem: string | null) => void = () => {};
    const onLeave = vi.fn(
      () => new Promise<string | null>((done) => (answer = done)),
    );
    card({ account: FAN, onLeave });
    fireEvent.click(screen.getByRole("button", { name: LABELS.leave }));
    const waiting = screen.getByRole("button", { name: LABELS.leaving });
    expect(waiting).toBeDisabled();
    fireEvent.click(waiting);
    expect(onLeave).toHaveBeenCalledTimes(1);
    await act(async () => answer(null));
    expect(screen.getByRole("button", { name: LABELS.leave })).toBeEnabled();
  });

  test("a sign-out that fails says why", async () => {
    const onLeave = vi
      .fn<AccountProps["onLeave"]>()
      .mockResolvedValue(LABELS.problems.failed);
    card({ account: FAN, onLeave });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: LABELS.leave }));
    });
    expect(screen.getByText(LABELS.problems.failed)).toBeInTheDocument();
  });

  test("DELETE ACCOUNT asks first; KEEP MY ACCOUNT goes back", () => {
    const { onDelete } = card({ account: FAN });
    fireEvent.click(screen.getByRole("button", { name: LABELS.remove }));
    expect(screen.getByText(LABELS.removeAsk)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: LABELS.leave })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: LABELS.removeNo }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: LABELS.leave })).toBeEnabled();
  });

  test("DELETE FOR GOOD deletes it, then says so on the sign-in card", async () => {
    let answer: (problem: string | null) => void = () => {};
    const onDelete = vi.fn(
      () => new Promise<string | null>((done) => (answer = done)),
    );
    const { rerender } = card({ account: FAN, onDelete });
    fireEvent.click(screen.getByRole("button", { name: LABELS.remove }));
    fireEvent.click(screen.getByRole("button", { name: LABELS.removeYes }));
    expect(
      screen.getByRole("button", { name: LABELS.removing }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: LABELS.removeNo }),
    ).toBeDisabled();
    await act(async () => answer(null));
    expect(onDelete).toHaveBeenCalledTimes(1);
    // the page hears the account has gone
    rerender({ account: null, onDelete });
    expect(screen.getByRole("status")).toHaveTextContent(LABELS.removed);
    expect(field()).toBeInTheDocument();
  });

  test("a delete that fails says why, and asks again", async () => {
    const onDelete = vi
      .fn<AccountProps["onDelete"]>()
      .mockResolvedValue(LABELS.problems.failed);
    card({ account: FAN, onDelete });
    fireEvent.click(screen.getByRole("button", { name: LABELS.remove }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: LABELS.removeYes }));
    });
    expect(screen.getByText(LABELS.problems.failed)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: LABELS.removeYes }),
    ).toBeEnabled();
  });
});

test("closed, there is nothing; at build time it renders nothing either", () => {
  const html = renderToString(
    routed(<Account {...props({ open: false, account: FAN })} />),
  );
  expect(html).toBe("");
});

test("the close button closes it", () => {
  const { onClose } = card();
  act(() => {
    fireEvent.click(screen.getByRole("button", { name: LABELS.close }));
  });
  expect(onClose).toHaveBeenCalledTimes(1);
});
