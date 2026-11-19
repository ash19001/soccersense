// The mode card before the page's code has loaded (Game.tsx, `EARLY_CARD`; ModeIntro's
// `early`): what the build-time HTML of a mode page carries, what its script does on each
// kind of device, and React taking the card over as the script left it.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { act } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { ACCOUNT_KEY, PLAYER_KEY, STORAGE_PREFIX } from "~/game";
import { strings } from "~/i18n";
import { ModeIntro } from "~/ui";
import { deviceClock, setGameClock } from "~/ui/game-clock";

import Play from "../play";
import { INTRO_LEAVE_MS, INTRO_MS } from "./controller";
import { EARLY_CARD } from "./Game";

/** A mode page as the build renders it: no browser to read. */
function built(path: string): string {
  vi.stubGlobal("window", undefined);
  vi.stubGlobal("document", undefined);
  vi.stubGlobal("localStorage", undefined);
  try {
    return renderToString(
      <MemoryRouter initialEntries={[path]}>
        <Play />
      </MemoryRouter>,
    );
  } finally {
    vi.unstubAllGlobals();
  }
}

/**
 * Runs the script as the browser would, first inside a card, on a device whose storage
 * holds `kept`. Returns whether it showed the card (took `data-pending` off).
 */
function shows(
  kept: Record<string, string> | "blocked" | "throws",
  script = EARLY_CARD,
): boolean {
  let shown = false;
  const card = {
    removeAttribute: (name: string) => {
      if (name === "data-pending") shown = true;
    },
  };
  const keys = typeof kept === "string" ? [] : Object.keys(kept);
  const storage =
    kept === "throws"
      ? {
          get length(): number {
            throw new Error("no storage here");
          },
          getItem: () => {
            throw new Error("no storage here");
          },
          key: () => null,
        }
      : {
          length: keys.length,
          getItem: (name: string) =>
            typeof kept === "string" ? null : (kept[name] ?? null),
          key: (index: number) => keys[index] ?? null,
        };
  const run = new Function("document", "localStorage", script);
  run(
    { currentScript: { parentElement: card } },
    kept === "blocked" ? undefined : storage,
  );
  return shown;
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  document.body.innerHTML = "";
  window.history.replaceState(null, "", "/");
});

describe("the mode card's own script", () => {
  test("a device that has never played is shown the card at once", () => {
    expect(shows({})).toBe(true);
    // what a visitor who has only looked at the home screen has kept: none of it is a game
    expect(
      shows({
        [`${STORAGE_PREFIX}:sound`]: "off",
        [`${STORAGE_PREFIX}:nickname`]: "soccerfan1",
        [`${STORAGE_PREFIX}:leaderboard`]: "home",
        "another-site:v1:2026-11-19:home": "{}",
      }),
    ).toBe(true);
  });

  test("a device with a player, an account or a game kept is not: the page decides", () => {
    expect(shows({ [PLAYER_KEY]: "1" })).toBe(false);
    expect(shows({ [ACCOUNT_KEY]: "{}" })).toBe(false);
    // a game of any day and any mode, finished or not
    expect(shows({ [`${STORAGE_PREFIX}:2026-11-19:home`]: "{}" })).toBe(false);
    expect(shows({ [`${STORAGE_PREFIX}:2025-01-02:furthest`]: "{}" })).toBe(
      false,
    );
    expect(
      shows({
        [`${STORAGE_PREFIX}:sound`]: "on",
        [`${STORAGE_PREFIX}:2026-11-18:away`]: "{}",
      }),
    ).toBe(false);
  });

  test("storage that cannot be read has nothing kept either: the card is shown", () => {
    expect(shows("blocked")).toBe(true);
    expect(shows("throws")).toBe(true);
  });

  test("it is plain old JavaScript, safe inside a page, and does nothing where it is not in a card", () => {
    expect(EARLY_CARD).not.toMatch(/=>|`|\b(?:let|const|class)\b|<\/|\n/);
    const run = new Function("document", "localStorage", EARLY_CARD);
    expect(() => run({ currentScript: null }, undefined)).not.toThrow();
    expect(() =>
      run({ currentScript: { parentElement: null } }, undefined),
    ).not.toThrow();
  });
});

describe("the card in a mode page's build-time HTML", () => {
  test("HOME's, AWAY's, RETRO's and NEXT-GEN's pages carry their card out of sight, its script first inside it", () => {
    for (const [path, mode] of [
      ["/play/home", "home"],
      ["/play/away", "away"],
      ["/play/retro", "retro"],
      ["/play/next-gen", "nextgen"],
    ] as const) {
      const html = built(path);
      expect(html, path).toContain(
        `<div class="ss-intro" data-mode="${mode}" data-pending="" aria-hidden="true">` +
          `<script>${EARLY_CARD}</script>`,
      );
      // the card's own words, there to be painted the moment the script shows it
      expect(html, path).toContain(strings.home.modes[mode].label);
      // one card
      expect(html.split('class="ss-intro"'), path).toHaveLength(2);
    }
  });

  test("CLOSEST's and FURTHEST's have none: their card names the day's place, which comes with the game", () => {
    for (const path of ["/play/closest", "/play/furthest"]) {
      const html = built(path);
      expect(html, path).not.toContain("ss-intro");
      expect(html, path).not.toContain("data-pending");
    }
  });

  test("the stylesheet keeps a card that is waiting out of sight", () => {
    const css = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "..", "..", "ui", "ui.css"),
      "utf8",
    );
    expect(css).toMatch(/\.ss-intro\[data-pending\]\s*\{\s*display:\s*none;/);
  });
});

describe("the card as a component", () => {
  test("with `early` it waits out of sight with the script first inside it; without, it is a card like any other", () => {
    const early = renderToString(
      <ModeIntro mode="home" name="HOME" line="A LINE" early="void 0" />,
    );
    expect(early).toMatch(
      /^<div class="ss-intro" data-mode="home" data-pending="" aria-hidden="true"><script>void 0<\/script>/,
    );
    const plain = renderToString(
      <ModeIntro mode="home" name="HOME" line="A LINE" />,
    );
    expect(plain).not.toContain("data-pending");
    expect(plain).not.toContain("<script");
  });
});

describe("React taking the page over", () => {
  test("a card the script has shown stays the same element, and its script goes", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    window.history.replaceState(null, "", "/play/home");
    const page = (
      <MemoryRouter initialEntries={["/play/home"]}>
        <Play />
      </MemoryRouter>
    );
    const host = document.createElement("div");
    document.body.append(host);
    host.innerHTML = built("/play/home");
    const card = host.querySelector(".ss-intro") as HTMLElement;
    expect(card).toHaveAttribute("data-pending");
    // as the script leaves it on a device that has never played
    card.removeAttribute("data-pending");

    const failed = vi.fn();
    let app: ReturnType<typeof hydrateRoot> | undefined;
    await act(async () => {
      app = hydrateRoot(host, page, { onRecoverableError: failed });
    });

    // taken over as it was: nothing thrown away and rendered again
    expect(failed).not.toHaveBeenCalled();
    expect(errors).not.toHaveBeenCalled();
    // the game is there by now (a new one opens with its card): the very same element
    expect(host.querySelector(".ss-intro")).toBe(card);
    expect(host.querySelectorAll(".ss-intro")).toHaveLength(1);
    expect(card).not.toHaveAttribute("data-pending");
    expect(card.querySelector("script")).toBeNull();
    expect(card).toHaveAttribute("data-mode", "home");

    await act(async () => {
      app?.unmount();
    });
    host.remove();
  });

  test("while the server is asked what a kept player's game is, the card stays as it was: the same element, still up", async () => {
    // Nothing is kept on this device, so its script showed the card. But the server still
    // knows the player (the cookie outlives what a browser lets a page keep), and has said
    // so by the time the game is made: the page then asks the server for the player's game
    // before it shows one. The card must not go and come back meanwhile.
    vi.useFakeTimers();
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    setGameClock({ ...deviceClock(), api: () => true });
    // the server's answer is on its way for as long as this test looks
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => {})),
    );
    window.history.replaceState(null, "", "/play/home");
    const page = (
      <MemoryRouter initialEntries={["/play/home"]}>
        <Play />
      </MemoryRouter>
    );
    const host = document.createElement("div");
    document.body.append(host);
    host.innerHTML = built("/play/home");
    const card = host.querySelector(".ss-intro") as HTMLElement;
    card.removeAttribute("data-pending");
    window.localStorage.setItem(PLAYER_KEY, "1");

    let app: ReturnType<typeof hydrateRoot> | undefined;
    await act(async () => {
      app = hydrateRoot(host, page);
    });
    // long past the time a new game's card would have left by itself: no game has begun,
    // the server is still being asked
    await act(async () => {
      vi.advanceTimersByTime(INTRO_MS + INTRO_LEAVE_MS + 5000);
    });
    expect(host.querySelector(".ss-board")).toBeNull();
    expect(host.querySelector(".ss-intro")).toBe(card);
    expect(host.querySelectorAll(".ss-intro")).toHaveLength(1);
    expect(card).not.toHaveAttribute("data-pending");
    expect(card).not.toHaveAttribute("data-leaving");
    expect(errors).not.toHaveBeenCalled();

    await act(async () => {
      app?.unmount();
    });
    host.remove();
    setGameClock(deviceClock());
  });

  test("a kept player's own page keeps the card out of sight while the server is asked", async () => {
    vi.useFakeTimers();
    setGameClock({ ...deviceClock(), api: () => true });
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => {})),
    );
    window.localStorage.setItem(PLAYER_KEY, "1");
    window.history.replaceState(null, "", "/play/away");
    const page = (
      <MemoryRouter initialEntries={["/play/away"]}>
        <Play />
      </MemoryRouter>
    );
    const host = document.createElement("div");
    document.body.append(host);
    // as the browser leaves it on such a device: the script found the player and did nothing
    host.innerHTML = built("/play/away");
    const card = host.querySelector(".ss-intro") as HTMLElement;
    expect(shows({ [PLAYER_KEY]: "1" })).toBe(false);

    let app: ReturnType<typeof hydrateRoot> | undefined;
    await act(async () => {
      app = hydrateRoot(host, page);
    });
    await act(async () => {
      vi.advanceTimersByTime(INTRO_MS + INTRO_LEAVE_MS + 5000);
    });
    expect(host.querySelector(".ss-intro")).toBe(card);
    expect(card).toHaveAttribute("data-pending");
    expect(host.querySelector(".ss-board")).toBeNull();

    await act(async () => {
      app?.unmount();
    });
    host.remove();
    setGameClock(deviceClock());
  });
});
